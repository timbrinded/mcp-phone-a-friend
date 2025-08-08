/**
 * Schema exports and validation utilities
 * Central export point for all schemas with validation pipelines
 */

import { Schema, ParseResult, TreeFormatter } from "@effect/schema"
import { Effect, Either } from "effect"

// Re-export all schemas
export * from "./mcp.schema.js"
export * from "./providers.schema.js"

// Import schemas for validation utilities
import * as MCP from "./mcp.schema.js"
import * as Providers from "./providers.schema.js"

// ============================================================================
// Validation Pipelines
// ============================================================================

/**
 * Generic validation function that returns an Effect
 */
export const validate = <A, I>(
  schema: Schema.Schema<A, I>
) => (
  input: unknown
): Effect.Effect<A, ParseResult.ParseError> =>
  Schema.decodeUnknown(schema)(input)

/**
 * Generic validation function that returns an Either
 */
export const validateEither = <A, I>(
  schema: Schema.Schema<A, I>
) => (
  input: unknown
): Either.Either<A, ParseResult.ParseError> =>
  Schema.decodeUnknownEither(schema)(input)

/**
 * Generic validation function that throws or returns value
 */
export const validateSync = <A, I>(
  schema: Schema.Schema<A, I>
) => (
  input: unknown
): A =>
  Schema.decodeUnknownSync(schema)(input)

// ============================================================================
// MCP-specific Validators
// ============================================================================

export const validateJsonRpcRequest = validate(MCP.JsonRpcRequest)
export const validateJsonRpcResponse = validate(MCP.JsonRpcResponse)
export const validateToolCallRequest = validate(MCP.ToolCallRequest)
export const validateToolCallResponse = validate(MCP.ToolCallResponse)
export const validateInitializeRequest = validate(MCP.InitializeRequest)
export const validateInitializeResponse = validate(MCP.InitializeResponse)

// ============================================================================
// Provider-specific Validators
// ============================================================================

export const validateChatCompletionRequest = validate(Providers.ChatCompletionRequest)
export const validateChatCompletionResponse = validate(Providers.ChatCompletionResponse)
export const validateAdviceRequest = validate(Providers.AdviceRequest)
export const validateModelMetadata = validate(Providers.ModelMetadata)
export const validateProviderConfig = validate(Providers.ProviderConfig)

// ============================================================================
// Model Normalization Utilities
// ============================================================================

/**
 * Normalize model metadata to MCP-compatible format
 */
export const normalizeModel = (
  model: Providers.ModelMetadata
): Providers.NormalizedModel => {
  const capabilities: string[] = []
  
  if (model.capabilities.chat) capabilities.push("chat")
  if (model.capabilities.completion) capabilities.push("completion")
  if (model.capabilities.embedding) capabilities.push("embedding")
  if (model.capabilities.functionCalling) capabilities.push("function_calling")
  if (model.capabilities.vision) capabilities.push("vision")
  if (model.capabilities.audio) capabilities.push("audio")
  if (model.capabilities.streaming) capabilities.push("streaming")
  if (model.capabilities.jsonMode) capabilities.push("json_mode")

  return {
    id: `${model.provider}/${model.id}`,
    displayName: model.name,
    provider: model.provider,
    capabilities,
    contextWindow: model.contextWindow,
    isDeprecated: model.deprecated ?? false
  }
}

/**
 * Normalize provider-specific model ID to standardized format
 */
export const normalizeModelId = (
  provider: Providers.ProviderName,
  modelId: string
): string => {
  // Remove provider prefix if already present
  const cleanId = modelId.replace(new RegExp(`^${provider}/`), "")
  return `${provider}/${cleanId}`
}

/**
 * Parse normalized model ID into provider and model
 */
export const parseModelId = (
  normalizedId: string
): { provider: Providers.ProviderName; modelId: string } | null => {
  const parts = normalizedId.split("/")
  if (parts.length !== 2) return null
  
  const [provider, modelId] = parts
  
  // Validate provider name
  const providerResult = Schema.decodeUnknownEither(Providers.ProviderName)(provider)
  if (providerResult._tag === "Left") return null
  
  return {
    provider: providerResult.right,
    modelId
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Convert Schema parse errors to MCP errors
 */
export const parseErrorToMCPError = (
  error: ParseResult.ParseError
): MCP.MCPError => ({
  code: MCP.MCPErrorCode.InvalidParams,
  message: "Validation error",
  data: {
    issues: TreeFormatter.formatErrorSync(error)
  }
})

/**
 * Convert provider errors to MCP errors
 */
export const providerErrorToMCPError = (
  error: Providers.ProviderError
): MCP.MCPError => ({
  code: MCP.MCPErrorCode.ToolExecutionError,
  message: `Provider error: ${error.message}`,
  data: {
    provider: error.provider,
    originalError: error
  }
})