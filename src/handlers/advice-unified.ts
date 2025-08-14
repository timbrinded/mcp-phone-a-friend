import { handleAdvice as handleSyncAdvice } from './advice.js';
import { handleAsyncAdvice } from './advice-async.js';
import type { ProviderInfo } from '../providers.js';
import { validateString } from '../errors.js';

/**
 * Unified advice handler that intelligently routes to async or sync based on provider
 * 
 * OpenAI models use async for true non-blocking operations and multi-turn support
 * Other providers use the standard sync implementation
 */
export async function handleUnifiedAdvice(
  args: any,
  providers: Map<string, ProviderInfo>
): Promise<any> {
  const modelName = validateString(args.model, 'model');
  
  // Extract provider from model name (format: "provider:model")
  const [provider] = modelName.split(':');
  
  // Route to async handler for OpenAI models (they support true async via Responses API)
  // All other providers use the sync handler
  if (provider === 'openai') {
    // Normalize parameter names for async handler (uses snake_case)
    const asyncArgs = {
      ...args,
      reasoning_effort: args.reasoningEffort || args.reasoning_effort,
      max_completion_tokens: args.max_completion_tokens,
      wait_timeout_ms: args.wait_timeout_ms,
      conversation_id: args.conversation_id,
      request_id: args.request_id,
      check_status: args.check_status
    };
    
    // Remove camelCase versions to avoid confusion
    delete asyncArgs.reasoningEffort;
    
    return await handleAsyncAdvice(asyncArgs, providers);
  } else {
    // Sync handler uses camelCase
    return await handleSyncAdvice(args, providers);
  }
}