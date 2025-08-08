/**
 * Provider Request/Response Schemas
 * Defines schemas for AI provider interactions using Effect Schema
 */

import { Schema } from "@effect/schema"

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported AI providers
 */
export const ProviderName = Schema.Literal(
  "openai",
  "gemini",
  "xai",
  "anthropic",
  "deepseek"
).annotations({
  identifier: "ProviderName",
  description: "Supported AI provider names"
})

/**
 * Provider status
 */
export const ProviderStatus = Schema.Literal(
  "available",
  "unavailable",
  "error",
  "rate_limited"
).annotations({
  identifier: "ProviderStatus",
  description: "Provider availability status"
})

// ============================================================================
// Model Schemas
// ============================================================================

/**
 * Model capability flags
 */
export const ModelCapabilities = Schema.Struct({
  chat: Schema.Boolean,
  completion: Schema.Boolean,
  embedding: Schema.Boolean,
  functionCalling: Schema.Boolean,
  vision: Schema.Boolean,
  audio: Schema.Boolean,
  streaming: Schema.Boolean,
  jsonMode: Schema.Boolean
}).annotations({
  identifier: "ModelCapabilities",
  description: "Model capability flags"
})

/**
 * Model metadata
 */
export const ModelMetadata = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  provider: ProviderName,
  capabilities: ModelCapabilities,
  contextWindow: Schema.Number,
  maxOutputTokens: Schema.optional(Schema.Number),
  costPer1kInput: Schema.optional(Schema.Number),
  costPer1kOutput: Schema.optional(Schema.Number),
  deprecated: Schema.optional(Schema.Boolean),
  replacedBy: Schema.optional(Schema.String)
}).annotations({
  identifier: "ModelMetadata",
  description: "Complete model metadata"
})

/**
 * Normalized model information for clients
 */
export const NormalizedModel = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  provider: ProviderName,
  capabilities: Schema.Array(Schema.String),
  contextWindow: Schema.Number,
  isDeprecated: Schema.Boolean
}).annotations({
  identifier: "NormalizedModel",
  description: "Normalized model information for MCP clients"
})

// ============================================================================
// Provider Requests
// ============================================================================

/**
 * List models request
 */
export const ListModelsRequest = Schema.Struct({
  provider: Schema.optional(ProviderName),
  includeDeprecated: Schema.optional(Schema.Boolean)
}).annotations({
  identifier: "ListModelsRequest",
  description: "Request to list available models"
})

/**
 * Chat completion request
 */
export const ChatMessage = Schema.Struct({
  role: Schema.Literal("system", "user", "assistant", "function"),
  content: Schema.String,
  name: Schema.optional(Schema.String),
  functionCall: Schema.optional(Schema.Struct({
    name: Schema.String,
    arguments: Schema.String
  }))
}).annotations({
  identifier: "ChatMessage"
})

export const ChatCompletionRequest = Schema.Struct({
  model: Schema.String,
  messages: Schema.Array(ChatMessage),
  temperature: Schema.optional(Schema.Number),
  maxTokens: Schema.optional(Schema.Number),
  topP: Schema.optional(Schema.Number),
  frequencyPenalty: Schema.optional(Schema.Number),
  presencePenalty: Schema.optional(Schema.Number),
  stop: Schema.optional(Schema.Union(Schema.String, Schema.Array(Schema.String))),
  stream: Schema.optional(Schema.Boolean),
  systemPrompt: Schema.optional(Schema.String)
}).annotations({
  identifier: "ChatCompletionRequest",
  description: "Chat completion request to provider"
})

/**
 * Advice request (internal schema for /advice tool)
 */
export const AdviceRequest = Schema.Struct({
  model: Schema.String,
  provider: Schema.optional(ProviderName),
  query: Schema.String,
  context: Schema.optional(Schema.String),
  temperature: Schema.optional(Schema.Number),
  maxTokens: Schema.optional(Schema.Number),
  stream: Schema.optional(Schema.Boolean)
}).annotations({
  identifier: "AdviceRequest",
  description: "Request for AI model advice"
})

// ============================================================================
// Provider Responses
// ============================================================================

/**
 * List models response
 */
export const ListModelsResponse = Schema.Struct({
  models: Schema.Array(ModelMetadata)
}).annotations({
  identifier: "ListModelsResponse"
})

/**
 * Chat completion response (non-streaming)
 */
export const ChatCompletionResponse = Schema.Struct({
  id: Schema.String,
  model: Schema.String,
  choices: Schema.Array(Schema.Struct({
    index: Schema.Number,
    message: ChatMessage,
    finishReason: Schema.optional(Schema.String)
  })),
  usage: Schema.optional(Schema.Struct({
    promptTokens: Schema.Number,
    completionTokens: Schema.Number,
    totalTokens: Schema.Number
  }))
}).annotations({
  identifier: "ChatCompletionResponse"
})

/**
 * Stream chunk for streaming responses
 */
export const StreamChunk = Schema.Struct({
  id: Schema.String,
  model: Schema.String,
  choices: Schema.Array(Schema.Struct({
    index: Schema.Number,
    delta: Schema.Struct({
      content: Schema.optional(Schema.String),
      role: Schema.optional(Schema.String),
      functionCall: Schema.optional(Schema.Struct({
        name: Schema.optional(Schema.String),
        arguments: Schema.optional(Schema.String)
      }))
    }),
    finishReason: Schema.optional(Schema.String)
  }))
}).annotations({
  identifier: "StreamChunk"
})

/**
 * Provider error response
 */
export const ProviderError = Schema.Struct({
  provider: ProviderName,
  code: Schema.String,
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
  details: Schema.optional(Schema.Unknown)
}).annotations({
  identifier: "ProviderError"
})

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Provider configuration
 */
export const ProviderConfig = Schema.Struct({
  name: ProviderName,
  apiKey: Schema.String,
  baseUrl: Schema.optional(Schema.String),
  defaultModel: Schema.optional(Schema.String),
  timeout: Schema.optional(Schema.Number),
  maxRetries: Schema.optional(Schema.Number),
  rateLimitPerMinute: Schema.optional(Schema.Number)
}).annotations({
  identifier: "ProviderConfig"
})

/**
 * Provider registry entry
 */
export const ProviderRegistryEntry = Schema.Struct({
  name: ProviderName,
  status: ProviderStatus,
  config: Schema.optional(ProviderConfig),
  models: Schema.optional(Schema.Array(ModelMetadata)),
  lastUpdated: Schema.Date,
  error: Schema.optional(ProviderError)
}).annotations({
  identifier: "ProviderRegistryEntry"
})

/**
 * Provider capabilities (simplified)
 */
export const ProviderCapabilities = Schema.Struct({
  text: Schema.optional(Schema.Boolean),
  stream: Schema.optional(Schema.Boolean),
}).annotations({
  identifier: "ProviderCapabilities"
})

/**
 * Provider model (simplified)
 */
export const ProviderModel = Schema.Struct({
  provider: Schema.String,
  id: Schema.String,
  capabilities: ProviderCapabilities,
}).annotations({
  identifier: "ProviderModel"
})

// ============================================================================
// Type exports
// ============================================================================

export type ProviderName = Schema.Schema.Type<typeof ProviderName>
export type ProviderStatus = Schema.Schema.Type<typeof ProviderStatus>
export type ModelCapabilities = Schema.Schema.Type<typeof ModelCapabilities>
export type ModelMetadata = Schema.Schema.Type<typeof ModelMetadata>
export type NormalizedModel = Schema.Schema.Type<typeof NormalizedModel>
export type ListModelsRequest = Schema.Schema.Type<typeof ListModelsRequest>
export type ChatMessage = Schema.Schema.Type<typeof ChatMessage>
export type ChatCompletionRequest = Schema.Schema.Type<typeof ChatCompletionRequest>
export type AdviceRequest = Schema.Schema.Type<typeof AdviceRequest>
export type ListModelsResponse = Schema.Schema.Type<typeof ListModelsResponse>
export type ChatCompletionResponse = Schema.Schema.Type<typeof ChatCompletionResponse>
export type StreamChunk = Schema.Schema.Type<typeof StreamChunk>
export type ProviderError = Schema.Schema.Type<typeof ProviderError>
export type ProviderConfig = Schema.Schema.Type<typeof ProviderConfig>
export type ProviderRegistryEntry = Schema.Schema.Type<typeof ProviderRegistryEntry>
export type ProviderCapabilities = Schema.Schema.Type<typeof ProviderCapabilities>
export type ProviderModel = Schema.Schema.Type<typeof ProviderModel>