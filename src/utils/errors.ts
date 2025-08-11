import { 
  APICallError,
  InvalidResponseDataError,
  UnsupportedFunctionalityError,
  RetryError,
  NoSuchModelError,
  InvalidArgumentError,
  TypeValidationError
} from 'ai';
import { ZodError } from 'zod';
import { MCPError, ErrorCode } from '../errors.js';

/**
 * Enhanced error handler using AI SDK utilities
 */
export function handleAIError(error: unknown, modelName: string): never {
  // Check if it's an API call error using the static method
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    
    if (status === 401) {
      throw new MCPError(
        `Authentication failed for ${modelName}. Check your API key.`,
        ErrorCode.InvalidRequest,
        { model: modelName, status }
      );
    }
    
    if (status === 429) {
      throw new MCPError(
        `Rate limit exceeded for ${modelName}. Please try again later.`,
        ErrorCode.InvalidRequest,
        { model: modelName, status, retryAfter: error.responseHeaders?.['retry-after'] }
      );
    }
    
    if (status && status >= 500) {
      throw new MCPError(
        `Provider service error for ${modelName}. The service may be temporarily unavailable.`,
        ErrorCode.InternalError,
        { model: modelName, status }
      );
    }
    
    // Generic API error
    throw new MCPError(
      `API call failed for ${modelName}: ${error.message}`,
      ErrorCode.InternalError,
      { model: modelName, status, url: error.url }
    );
  }
  
  // Check if it's an invalid response error
  if (InvalidResponseDataError.isInstance(error)) {
    throw new MCPError(
      `Invalid response from ${modelName}. The model returned unexpected data.`,
      ErrorCode.InternalError,
      { model: modelName, originalError: error.message }
    );
  }
  
  // Check if it's an unsupported functionality error
  if (UnsupportedFunctionalityError.isInstance(error)) {
    throw new MCPError(
      `${modelName} doesn't support this feature: ${error.functionality}`,
      ErrorCode.InvalidRequest,
      { model: modelName, feature: error.functionality }
    );
  }
  
  // Check if it's a no such model error
  if (NoSuchModelError.isInstance(error)) {
    throw new MCPError(
      `Model ${modelName} not found: ${error.message}`,
      ErrorCode.ModelNotFound,
      { model: modelName }
    );
  }
  
  // Check if it's a retry error
  if (RetryError.isInstance(error)) {
    throw new MCPError(
      `Failed after retries for ${modelName}: ${error.message}`,
      ErrorCode.InternalError,
      { model: modelName, lastError: error.lastError }
    );
  }
  
  // Check if it's an invalid argument error
  if (InvalidArgumentError.isInstance(error)) {
    throw new MCPError(
      `Invalid argument for ${modelName}: ${error.message}`,
      ErrorCode.InvalidRequest,
      { model: modelName, parameter: error.parameter, value: error.value }
    );
  }
  
  // Check if it's a type validation error
  if (TypeValidationError.isInstance(error)) {
    throw new MCPError(
      `Type validation failed for ${modelName}: ${error.message}`,
      ErrorCode.InvalidRequest,
      { model: modelName, value: error.value }
    );
  }
  
  // Check if it's a Zod validation error
  if (error instanceof ZodError) {
    const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    throw new MCPError(
      `Schema validation failed: ${issues.join(', ')}`,
      ErrorCode.InvalidRequest,
      { issues: error.issues }
    );
  }
  
  // Check for timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    throw new MCPError(
      `Request to ${modelName} timed out. Try a simpler prompt or use async mode.`,
      ErrorCode.InternalError,
      { model: modelName, tip: 'Use advice_async for long-running operations' }
    );
  }
  
  // Generic error handling
  if (error instanceof Error) {
    throw new MCPError(
      `Error with ${modelName}: ${error.message}`,
      ErrorCode.InternalError,
      { model: modelName }
    );
  }
  
  // Unknown error
  throw new MCPError(
    `Unknown error occurred with ${modelName}`,
    ErrorCode.InternalError,
    { model: modelName, error: String(error) }
  );
}

/**
 * Type guard for AI SDK API errors
 */
export function isProviderError(error: unknown): boolean {
  return APICallError.isInstance(error) || 
         InvalidResponseDataError.isInstance(error) ||
         UnsupportedFunctionalityError.isInstance(error) ||
         NoSuchModelError.isInstance(error) ||
         RetryError.isInstance(error);
}

/**
 * Extract retry information from errors
 */
export function getRetryInfo(error: unknown): { shouldRetry: boolean; retryAfter?: number } {
  if (APICallError.isInstance(error)) {
    // Rate limiting
    if (error.statusCode === 429) {
      const retryAfter = error.responseHeaders?.['retry-after'];
      return {
        shouldRetry: true,
        retryAfter: retryAfter ? parseInt(retryAfter) * 1000 : 60000 // Default to 1 minute
      };
    }
    
    // Temporary failures
    if (error.statusCode && error.statusCode >= 500 && error.statusCode < 600) {
      return {
        shouldRetry: true,
        retryAfter: 5000 // Retry after 5 seconds for server errors
      };
    }
  }
  
  // Retry errors should be retried with exponential backoff
  if (RetryError.isInstance(error)) {
    return {
      shouldRetry: true,
      retryAfter: 10000 // Default 10 second retry
    };
  }
  
  return { shouldRetry: false };
}