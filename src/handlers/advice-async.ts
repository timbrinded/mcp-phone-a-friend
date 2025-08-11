import { ChatStore } from '../db/store.js';
import { runTurn, checkOrWait, TurnOptions } from '../conversation/turn-runner.js';
import { MCPError, ErrorCode, validateString } from '../errors.js';
import { reasoningModels, modelParameters } from '../config.js';
import type { ProviderInfo } from '../providers.js';

// Singleton store instance
let store: ChatStore | null = null;

function getStore(): ChatStore {
  if (!store) {
    store = new ChatStore('chat.db');
  }
  return store;
}

export interface AsyncAdviceArgs {
  model: string;
  prompt: string;
  conversation_id?: string;
  request_id?: number;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  temperature?: number;
  max_completion_tokens?: number;
  wait_timeout_ms?: number;
  check_status?: boolean;
}

export interface AsyncAdviceResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  metadata: {
    status: 'completed' | 'waiting' | 'error';
    conversation_id: string;
    request_id: number;
    openai_id?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    error?: string;
    retry_after_ms?: number;
  };
}

/**
 * Handle async advice requests with conversation support
 */
export async function handleAsyncAdvice(
  args: AsyncAdviceArgs,
  providers: Map<string, ProviderInfo>
): Promise<AsyncAdviceResponse> {
  const modelName = validateString(args.model, 'model');
  const prompt = validateString(args.prompt, 'prompt');
  
  // Validate model exists
  const providerInfo = providers.get(modelName);
  if (!providerInfo) {
    throw new MCPError(
      `Model "${modelName}" not found. Available models: ${Array.from(providers.keys()).join(', ')}`,
      ErrorCode.ModelNotFound,
      { requestedModel: modelName, availableModels: Array.from(providers.keys()) }
    );
  }
  
  const store = getStore();
  
  // Check if we're checking status of existing request
  if (args.check_status && args.request_id) {
    const waitMs = args.wait_timeout_ms || 5000;
    const result = await checkOrWait(store, args.request_id, waitMs);
    
    if (result.status === 'completed') {
      return {
        content: [{ type: 'text', text: result.text }],
        metadata: {
          status: 'completed',
          conversation_id: args.conversation_id || 'unknown',
          request_id: args.request_id,
          usage: result.usage
        }
      };
    } else if (result.status === 'waiting') {
      return {
        content: [{ type: 'text', text: 'Still processing your request...' }],
        metadata: {
          status: 'waiting',
          conversation_id: args.conversation_id || 'unknown',
          request_id: args.request_id,
          retry_after_ms: 2000
        }
      };
    } else {
      return {
        content: [{ type: 'text', text: `Request ${result.status}` }],
        metadata: {
          status: 'error',
          conversation_id: args.conversation_id || 'unknown',
          request_id: args.request_id,
          error: `Request ${result.status}`
        }
      };
    }
  }
  
  // Create or get conversation
  let conversationId: number;
  if (args.conversation_id) {
    // Parse conversation ID (could be number or string)
    conversationId = typeof args.conversation_id === 'string' 
      ? parseInt(args.conversation_id, 10) 
      : args.conversation_id;
    
    // Validate it exists by trying to get messages
    try {
      store.getMessages(conversationId);
    } catch {
      // If conversation doesn't exist, create new one
      conversationId = store.createConversation(`Conversation ${args.conversation_id}`);
    }
  } else {
    // Create new conversation
    conversationId = store.createConversation('New Conversation');
  }
  
  // Extract base model name for configuration
  const baseModelName = modelName.split(':')[1];
  const isReasoningModel = reasoningModels.has(baseModelName);
  const defaultParams = modelParameters[baseModelName] || {};
  
  // Build turn options
  const turnOptions: TurnOptions = {
    model: baseModelName,
    temperature: args.temperature,
    max_completion_tokens: args.max_completion_tokens,
    overallTimeoutMs: args.wait_timeout_ms || 30000,
    maxHistoryMessages: 50,
    onStatus: (status) => {
      console.log(`[${new Date().toISOString()}] Request ${status.requestId}: ${status.status} - ${status.message || ''}`);
    }
  };
  
  // Add reasoning effort for reasoning models
  if (isReasoningModel) {
    turnOptions.reasoning_effort = args.reasoning_effort || defaultParams.reasoningEffort;
  }
  
  // Add verbosity for GPT-5 models
  if (baseModelName.startsWith('gpt-5')) {
    turnOptions.verbosity = args.verbosity || defaultParams.verbosity;
  }
  
  // Run the turn
  try {
    const result = await runTurn(store, conversationId, prompt, turnOptions);
    
    if (result.status === 'completed') {
      return {
        content: [{ type: 'text', text: result.text }],
        metadata: {
          status: 'completed',
          conversation_id: conversationId.toString(),
          request_id: result.requestId,
          usage: result.usage
        }
      };
    } else if (result.status === 'waiting') {
      return {
        content: [{ 
          type: 'text', 
          text: 'Your request is being processed. Please check back in a moment.' 
        }],
        metadata: {
          status: 'waiting',
          conversation_id: conversationId.toString(),
          request_id: result.requestId,
          openai_id: result.openaiId,
          retry_after_ms: 2000
        }
      };
    } else {
      return {
        content: [{ 
          type: 'text', 
          text: `Error: ${result.error.message}` 
        }],
        metadata: {
          status: 'error',
          conversation_id: conversationId.toString(),
          request_id: result.requestId,
          error: result.error.message
        }
      };
    }
  } catch (error: any) {
    console.error('Error in handleAsyncAdvice:', error);
    throw new MCPError(
      `Failed to process request: ${error.message}`,
      ErrorCode.InternalError,
      { error: error.message }
    );
  }
}

/**
 * Clean up resources
 */
export function closeStore(): void {
  if (store) {
    store.close();
    store = null;
  }
}