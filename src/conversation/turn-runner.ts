import { ChatStore, Role } from '../db/store.js';
import { 
  executeOpenAIRequest, 
  createAsyncResponse, 
  getResponseById,
  CreateResponseParams, 
  AsyncResponse,
  RESPONSES_API_MODELS 
} from '../clients/openai-async.js';

export type TurnOptions = {
  model: string;
  temperature?: number;
  top_p?: number;
  max_completion_tokens?: number;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  overallTimeoutMs?: number;
  initialPollDelayMs?: number;
  maxPollDelayMs?: number;
  onStatus?: (status: { 
    requestId: number; 
    openaiId?: string; 
    status: string;
    message?: string;
  }) => void;
  maxRetries?: number;
  maxHistoryMessages?: number;
};

export type TurnResult = 
  | { status: 'completed'; text: string; requestId: number; usage?: any }
  | { status: 'waiting'; requestId: number; openaiId: string }
  | { status: 'error'; error: Error; requestId: number };

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build messages array for OpenAI from conversation history
 */
function buildMessagesForOpenAI(
  messages: Array<{ role: Role; content: string }>,
  maxHistory: number = 50
): CreateResponseParams['messages'] {
  // Trim to last N messages if needed
  const start = Math.max(0, messages.length - maxHistory);
  const slice = messages.slice(start);
  
  // Convert our Role type to OpenAI's expected format
  return slice.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content
  }));
}

/**
 * Run a conversation turn with caching and async support
 */
export async function runTurn(
  store: ChatStore,
  conversationId: number,
  userText: string,
  opts: TurnOptions
): Promise<TurnResult> {
  // 1. Append user message to conversation
  const userMessageId = store.appendMessage(conversationId, 'user', userText);
  
  // 2. Build messages from conversation history
  const messages = store.getMessages(conversationId).map(m => ({
    role: m.role,
    content: m.content
  }));
  const openaiMessages = buildMessagesForOpenAI(messages, opts.maxHistoryMessages);
  
  // 3. Create/find request with deduplication
  const params = {
    temperature: opts.temperature,
    top_p: opts.top_p,
    max_completion_tokens: opts.max_completion_tokens,
    reasoning_effort: opts.reasoning_effort,
    verbosity: opts.verbosity
  };
  
  const requestRow = store.upsertRequest({
    conversationId,
    messageId: userMessageId,
    model: opts.model,
    params,
    inputForHash: openaiMessages
  });
  
  // 4. Check if we already have a completed result (cache hit)
  if (requestRow.status === 'completed' && requestRow.output_text) {
    opts.onStatus?.({
      requestId: requestRow.id,
      status: 'cache_hit',
      message: 'Using cached response'
    });
    
    const usage = requestRow.usage_json ? JSON.parse(requestRow.usage_json) : undefined;
    return { 
      status: 'completed', 
      text: requestRow.output_text, 
      requestId: requestRow.id,
      usage 
    };
  }
  
  // 5. If request is already in progress, just return its status
  if (requestRow.status === 'in_progress' && requestRow.openai_response_id) {
    opts.onStatus?.({
      requestId: requestRow.id,
      openaiId: requestRow.openai_response_id,
      status: 'already_in_progress',
      message: 'Request already in progress'
    });
    
    return {
      status: 'waiting',
      requestId: requestRow.id,
      openaiId: requestRow.openai_response_id
    };
  }
  
  // 6. Execute new request or poll existing one
  let openaiId = requestRow.openai_response_id;
  const supportsResponsesAPI = RESPONSES_API_MODELS.has(opts.model);
  
  if (!openaiId) {
    opts.onStatus?.({
      requestId: requestRow.id,
      status: 'starting',
      message: `Starting new request with ${supportsResponsesAPI ? 'Responses API' : 'Chat Completions API'}`
    });
    
    try {
      store.incrementTries(requestRow.id);
      
      // Create the request (async or sync depending on model support)
      const response = await createAsyncResponse({
        model: opts.model,
        messages: openaiMessages,
        temperature: opts.temperature,
        top_p: opts.top_p,
        max_completion_tokens: opts.max_completion_tokens,
        reasoning_effort: opts.reasoning_effort,
        verbosity: opts.verbosity,
        useResponsesAPI: supportsResponsesAPI
      });
      
      // Store the response ID
      openaiId = response.id;
      store.markRequestStarted(requestRow.id, openaiId);
      
      // If response is already completed (synchronous), handle it
      if (response.status === 'completed' && response.choices?.[0]) {
        const outputText = response.choices[0].message.content;
        store.saveCompletion(requestRow.id, outputText, response, response.usage);
        store.linkAssistantMessage(conversationId, requestRow.id, outputText);
        
        opts.onStatus?.({
          requestId: requestRow.id,
          openaiId,
          status: 'completed',
          message: 'Request completed successfully'
        });
        
        return {
          status: 'completed',
          text: outputText,
          requestId: requestRow.id,
          usage: response.usage
        };
      }
      
      // If failed immediately
      if (response.status === 'failed') {
        store.saveFailure(requestRow.id, response.error, 'failed');
        
        opts.onStatus?.({
          requestId: requestRow.id,
          openaiId,
          status: 'failed',
          message: response.error?.message || 'Request failed'
        });
        
        return {
          status: 'error',
          error: new Error(response.error?.message || 'Request failed'),
          requestId: requestRow.id
        };
      }
      
      // Response is async, need to poll
      store.saveInProgressStatus(requestRow.id, response.status);
      
    } catch (error: any) {
      store.saveFailure(requestRow.id, error, 'failed');
      
      opts.onStatus?.({
        requestId: requestRow.id,
        openaiId: openaiId || 'unknown',
        status: 'error',
        message: error.message
      });
      
      return {
        status: 'error',
        error: error,
        requestId: requestRow.id
      };
    }
  }
  
  // 7. Poll for async response if using Responses API
  if (supportsResponsesAPI && openaiId) {
    const startTime = Date.now();
    const timeout = opts.overallTimeoutMs || 30000;
    const pollInterval = opts.initialPollDelayMs || 1000;
    const maxPollInterval = opts.maxPollDelayMs || 5000;
    let currentInterval = pollInterval;
    
    while (Date.now() - startTime < timeout) {
      await sleep(currentInterval);
      
      try {
        const response = await getResponseById(openaiId);
        
        if (response.status === 'completed' && response.choices?.[0]) {
          const outputText = response.choices[0].message.content;
          store.saveCompletion(requestRow.id, outputText, response, response.usage);
          store.linkAssistantMessage(conversationId, requestRow.id, outputText);
          
          opts.onStatus?.({
            requestId: requestRow.id,
            openaiId,
            status: 'completed',
            message: 'Request completed successfully'
          });
          
          return {
            status: 'completed',
            text: outputText,
            requestId: requestRow.id,
            usage: response.usage
          };
        }
        
        if (response.status === 'failed' || response.status === 'cancelled' || response.status === 'expired') {
          store.saveFailure(requestRow.id, response.error, response.status);
          
          opts.onStatus?.({
            requestId: requestRow.id,
            openaiId,
            status: response.status,
            message: response.error?.message || `Request ${response.status}`
          });
          
          return {
            status: 'error',
            error: new Error(response.error?.message || `Request ${response.status}`),
            requestId: requestRow.id
          };
        }
        
        // Still in progress
        store.saveInProgressStatus(requestRow.id, response.status);
        opts.onStatus?.({
          requestId: requestRow.id,
          openaiId,
          status: 'polling',
          message: `Status: ${response.status}`
        });
        
        // Exponential backoff
        currentInterval = Math.min(currentInterval * 1.5, maxPollInterval);
        
      } catch (error: any) {
        console.error('Polling error:', error);
        // Continue polling despite errors
      }
    }
    
    // Timeout reached
    opts.onStatus?.({
      requestId: requestRow.id,
      openaiId,
      status: 'timeout',
      message: 'Request timed out, still processing'
    });
    
    return {
      status: 'waiting',
      requestId: requestRow.id,
      openaiId
    };
  }
  
  // For non-Responses API models, we've already handled synchronously above
  return {
    status: 'waiting',
    requestId: requestRow.id,
    openaiId
  };
}

/**
 * Check status of a request and optionally wait for completion
 */
export async function checkOrWait(
  store: ChatStore,
  requestId: number,
  waitMs: number = 20000
): Promise<
  | { status: 'completed'; text: string; usage?: any }
  | { status: 'waiting' }
  | { status: 'failed' | 'cancelled' | 'expired' }
> {
  const req = store.getRequestById(requestId);
  if (!req) {
    throw new Error('Unknown request ID: ' + requestId);
  }
  
  // If already completed, return immediately
  if (req.status === 'completed' && req.output_text) {
    const usage = req.usage_json ? JSON.parse(req.usage_json) : undefined;
    return { status: 'completed', text: req.output_text, usage };
  }
  
  // If already failed, return immediately
  if (req.status === 'failed' || req.status === 'cancelled' || req.status === 'expired') {
    return { status: req.status };
  }
  
  // If we have an OpenAI response ID, poll for status
  if (req.openai_response_id && (req.status === 'queued' || req.status === 'in_progress')) {
    const startTime = Date.now();
    const pollInterval = 1000;
    const maxPollInterval = 5000;
    let currentInterval = pollInterval;
    
    while (Date.now() - startTime < waitMs) {
      await sleep(currentInterval);
      
      try {
        const response = await getResponseById(req.openai_response_id);
        
        if (response.status === 'completed' && response.choices?.[0]) {
          const outputText = response.choices[0].message.content;
          store.saveCompletion(req.id, outputText, response, response.usage);
          store.linkAssistantMessage(req.conversation_id, req.id, outputText);
          
          return {
            status: 'completed',
            text: outputText,
            usage: response.usage
          };
        }
        
        if (response.status === 'failed' || response.status === 'cancelled' || response.status === 'expired') {
          store.saveFailure(req.id, response.error, response.status);
          return { status: response.status };
        }
        
        // Still in progress
        store.saveInProgressStatus(req.id, response.status);
        
        // Exponential backoff
        currentInterval = Math.min(currentInterval * 1.5, maxPollInterval);
        
      } catch (error: any) {
        console.error('Polling error in checkOrWait:', error);
        // Continue polling despite errors
      }
    }
  }
  
  // Still waiting
  return { status: 'waiting' };
}