/**
 * MCP Error Codes based on JSON-RPC 2.0
 */
export enum ErrorCode {
  // JSON-RPC 2.0 standard error codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // Custom error codes
  ProviderError = -32000,
  ModelNotFound = -32001,
  ApiKeyMissing = -32002,
  RateLimitError = -32003,
}

/**
 * MCP-compliant error class
 */
export class MCPError extends Error {
  code: number;
  data?: any;

  constructor(message: string, code: number = ErrorCode.InternalError, data?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.data && { data: this.data })
    };
  }
}

/**
 * Validate required string parameter
 */
export function validateString(
  value: unknown,
  paramName: string,
  allowEmpty = false
): string {
  if (typeof value !== 'string') {
    throw new MCPError(
      `Invalid parameter "${paramName}": expected string, got ${typeof value}`,
      ErrorCode.InvalidParams
    );
  }
  
  if (!allowEmpty && value.trim() === '') {
    throw new MCPError(
      `Invalid parameter "${paramName}": cannot be empty`,
      ErrorCode.InvalidParams
    );
  }
  
  return value;
}

/**
 * Validate required object parameter
 */
export function validateObject(
  value: unknown,
  paramName: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new MCPError(
      `Invalid parameter "${paramName}": expected object, got ${typeof value}`,
      ErrorCode.InvalidParams
    );
  }
  
  return value as Record<string, unknown>;
}

/**
 * Wrap provider errors with MCP-compliant errors
 */
export function wrapProviderError(error: any, provider: string): MCPError {
  // Handle different error types from AI providers
  if (error.status === 429 || error.message?.includes('rate limit')) {
    return new MCPError(
      `Rate limit exceeded for ${provider}`,
      ErrorCode.RateLimitError,
      { provider, originalError: error.message }
    );
  }
  
  if (error.status === 401 || error.message?.includes('API key')) {
    return new MCPError(
      `Invalid or missing API key for ${provider}`,
      ErrorCode.ApiKeyMissing,
      { provider }
    );
  }
  
  if (error.status === 404 || error.message?.includes('model')) {
    return new MCPError(
      `Model not found or not available for ${provider}`,
      ErrorCode.ModelNotFound,
      { provider, originalError: error.message }
    );
  }
  
  // Generic provider error
  return new MCPError(
    `Provider error from ${provider}: ${error.message || 'Unknown error'}`,
    ErrorCode.ProviderError,
    { provider, originalError: error.message }
  );
}