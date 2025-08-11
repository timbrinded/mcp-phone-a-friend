import { generateText, generateObject } from 'ai';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { MCPError, ErrorCode, validateString, wrapProviderError } from '../errors.js';
import { reasoningModels, structuredOutputModels, modelParameters } from '../config.js';
import type { ProviderInfo } from '../providers.js';
import { 
  TTLCache, 
  detectStructuredSupport, 
  withRetry, 
  withTimeout,
  providerConcurrency,
  getTimeoutsForModel 
} from '../utils/optimization.js';

// Zod schema for structured advice responses
const AdviceResponseSchema = z.object({
  response_type: z.enum(['complete', 'needs_context', 'continue']).describe(
    'complete: Final answer provided, needs_context: Missing information needed, continue: Partial answer expecting more interaction'
  ),
  response: z.string().describe('The main response text to show the user'),
  context_needed: z.array(z.object({
    type: z.enum(['code', 'library', 'environment', 'error', 'requirements', 'other']),
    description: z.string()
  })).optional().describe('Specific context items needed if response_type is needs_context'),
  questions: z.array(z.string()).optional().describe('Follow-up questions to ask the user'),
  confidence: z.number().min(0).max(1).optional().describe('Confidence in the response (0-1)')
});

type AdviceResponse = z.infer<typeof AdviceResponseSchema>;

// TTL cache for runtime detection of structured output support (1 hour TTL)
const structuredOutputCache = new TTLCache<string, boolean>(60 * 60 * 1000);

async function tryStructuredOutput(
  params: any,
  modelName: string,
  conversationId: string,
  iteration: number,
  signal?: AbortSignal
): Promise<any> {
  try {
    // Add system message for better structured output
    const structuredParams = {
      ...params,
      schema: AdviceResponseSchema,
      system: `You are a helpful AI assistant. When responding:
- If you have all needed context, set response_type to "complete"
- If you need more information, set response_type to "needs_context" and specify what's needed
- If providing a partial answer expecting continuation, set response_type to "continue"
Always be specific about what context you need.`,
      abortSignal: signal
    };
    
    // Get model-specific timeouts
    const timeouts = getTimeoutsForModel(modelName);
    
    // Apply timeout for structured output attempts
    const result = await withTimeout(
      generateObject(structuredParams),
      timeouts.structured,
      'Structured output generation timed out'
    );
    
    // Mark this model as supporting structured output
    structuredOutputCache.set(modelName, true);
    
    // Convert to MCP response format
    const response = result.object as AdviceResponse;
    
    return {
      content: [
        {
          type: 'text' as const,
          text: response.response
        }
      ],
      metadata: {
        status: response.response_type === 'needs_context' ? 'needs_context' : 'complete',
        conversation_id: conversationId,
        ...(response.response_type === 'needs_context' && {
          context_request: {
            needed: response.context_needed?.map(c => c.type) || [],
            questions: response.questions || [],
            iteration: iteration + 1,
            details: response.context_needed
          }
        }),
        confidence: response.confidence
      }
    };
  } catch (error) {
    // Mark this model as not supporting structured output if it's a format error
    const isFormatError = (error as any)?.status === 400 || 
                         (error as any)?.code === 'UNSUPPORTED_FORMAT';
    if (isFormatError) {
      structuredOutputCache.set(modelName, false);
    }
    throw error;
  }
}

async function fallbackToText(
  params: any,
  conversationId: string,
  signal?: AbortSignal
): Promise<any> {
  // Simple single-turn fallback with abort signal
  const textParams = {
    ...params,
    abortSignal: signal
  };
  const result = await generateText(textParams);
  
  return {
    content: [
      {
        type: 'text' as const,
        text: result.text
      }
    ],
    metadata: {
      status: 'complete' as const,
      conversation_id: conversationId,
      fallback_mode: true
    }
  };
}

export async function handleAdvice(
  args: any,
  providers: Map<string, ProviderInfo>
) {
  const modelName = validateString(args?.model, 'model');
  const prompt = validateString(args?.prompt, 'prompt');
  
  // Multi-turn conversation support
  const conversationId = args?.conversation_id || randomUUID();
  const iteration = args?.iteration || 1;
  const additionalContext = args?.additional_context;
  
  // Prevent infinite context loops
  if (iteration > 3) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Maximum context iterations reached. Please provide all necessary context upfront.'
        }
      ],
      metadata: {
        status: 'complete' as const,
        conversation_id: conversationId
      }
    };
  }
  
  const providerInfo = providers.get(modelName);
  if (!providerInfo) {
    throw new MCPError(
      `Model "${modelName}" not found. Available models: ${Array.from(providers.keys()).join(', ')}`,
      ErrorCode.ModelNotFound,
      { requestedModel: modelName, availableModels: Array.from(providers.keys()) }
    );
  }
  
  try {
    const baseModelName = modelName.split(':')[1];
    const isReasoningModel = reasoningModels.has(baseModelName);
    const defaultParams = modelParameters[baseModelName] || {};
    
    // Enhance prompt with additional context if provided
    let enrichedPrompt = prompt;
    if (additionalContext) {
      enrichedPrompt = `${prompt}\n\nAdditional Context Provided:\n${additionalContext}`;
    }
    
    // Build base parameters
    const params: any = {
      model: providerInfo.provider,
      prompt: enrichedPrompt,
      maxRetries: 2
    };
    
    // Handle reasoning effort for reasoning models
    if (isReasoningModel && modelName.startsWith('openai:')) {
      const reasoningEffort = args?.reasoningEffort || defaultParams.reasoningEffort;
      if (reasoningEffort) {
        params.experimental_providerMetadata = {
          openai: { reasoningEffort }
        };
      }
    }
    
    // Handle verbosity for GPT-5 models
    if (baseModelName.startsWith('gpt-5') && modelName.startsWith('openai:')) {
      const verbosity = args?.verbosity || defaultParams.verbosity;
      if (verbosity) {
        if (!params.experimental_providerMetadata) {
          params.experimental_providerMetadata = { openai: {} };
        }
        params.experimental_providerMetadata.openai.verbosity = verbosity;
      }
    }
    
    // Get provider-specific concurrency limiter
    const providerKey = modelName.split(':')[0];
    const limiter = providerConcurrency.get(providerKey);
    
    // Execute with concurrency control and retries
    const executeRequest = async (signal: AbortSignal) => {
      // Check if model supports structured output with caching
      const supportsStructured = await detectStructuredSupport(
        modelName,
        async () => {
          // Optimistic probe with tight timeout
          try {
            const testParams = {
              ...params,
              schema: AdviceResponseSchema,
              abortSignal: signal
            };
            const timeouts = getTimeoutsForModel(modelName);
            await withTimeout(
              generateObject(testParams),
              timeouts.detection,
              'Structured output detection timed out'
            );
            return true;
          } catch {
            return false;
          }
        },
        structuredOutputCache
      ) || structuredOutputModels.has(baseModelName);
      
      if (supportsStructured) {
        try {
          return await tryStructuredOutput(params, modelName, conversationId, iteration, signal);
        } catch (error) {
          // Check if it's a format error that should trigger fallback
          const isFormatError = (error as any)?.status === 400 || 
                               (error as any)?.code === 'UNSUPPORTED_FORMAT' ||
                               (error as any)?.message?.includes('timed out');
          if (isFormatError) {
            console.warn(`Structured output failed for ${modelName}, falling back to text`);
            return await fallbackToText(params, conversationId, signal);
          }
          throw error;
        }
      } else {
        // Use text mode for models without structured output support
        return await fallbackToText(params, conversationId, signal);
      }
    };
    
    // Get model-specific timeouts
    const timeouts = getTimeoutsForModel(modelName);
    
    // Apply retry logic with exponential backoff
    const result = await withRetry(
      executeRequest,
      {
        maxRetries: 2,
        timeoutMs: timeouts.overall,
        shouldRetry: (error) => {
          const status = (error as any)?.status;
          return status === 429 || (status >= 500 && status < 600);
        }
      }
    );
    
    // Apply concurrency limiting if limiter is available
    if (limiter) {
      return await limiter(() => Promise.resolve(result));
    }
    
    return result;
  } catch (error) {
    throw wrapProviderError(error, modelName);
  }
}