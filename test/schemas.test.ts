import { describe, expect, test } from "bun:test"
import { Effect, Either } from "effect"
import * as Schemas from "../src/schemas/index.js"

describe("MCP Schemas", () => {
  describe("JsonRpcRequest", () => {
    test("should validate valid JSON-RPC request", () => {
      const valid = {
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1
      }

      const result = Schemas.validateEither(Schemas.JsonRpcRequest)(valid)
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.method).toBe("tools/list")
      }
    })

    test("should reject invalid JSON-RPC version", () => {
      const invalid = {
        jsonrpc: "1.0",
        method: "tools/list",
        id: 1
      }

      const result = Schemas.validateEither(Schemas.JsonRpcRequest)(invalid)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe("Tool schemas", () => {
    test("should validate tool definition", () => {
      const tool = {
        name: "advice",
        description: "Get advice from AI models",
        inputSchema: {
          type: "object",
          properties: {
            model: { type: "string" },
            query: { type: "string" }
          },
          required: ["model", "query"]
        }
      }

      const result = Schemas.validateEither(Schemas.Tool)(tool)
      expect(Either.isRight(result)).toBe(true)
    })

    test("should validate tool call request", () => {
      const request = {
        name: "advice",
        arguments: {
          model: "gpt-4",
          query: "How to implement Effect services?"
        }
      }

      const result = Schemas.validateEither(Schemas.ToolCallRequest)(request)
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe("Initialize messages", () => {
    test("should validate initialize request", () => {
      const request = {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      }

      const result = Schemas.validateEither(Schemas.InitializeRequest)(request)
      expect(Either.isRight(result)).toBe(true)
    })

    test("should validate initialize response", () => {
      const response = {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "phone-a-friend",
          version: "1.0.0"
        }
      }

      const result = Schemas.validateEither(Schemas.InitializeResponse)(response)
      expect(Either.isRight(result)).toBe(true)
    })
  })
})

describe("Provider Schemas", () => {
  describe("Model metadata", () => {
    test("should validate model metadata", () => {
      const model = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai",
        capabilities: {
          chat: true,
          completion: true,
          embedding: false,
          functionCalling: true,
          vision: false,
          audio: false,
          streaming: true,
          jsonMode: true
        },
        contextWindow: 8192,
        maxOutputTokens: 4096
      }

      const result = Schemas.validateEither(Schemas.ModelMetadata)(model)
      expect(Either.isRight(result)).toBe(true)
    })

    test("should normalize model metadata", () => {
      const model: Schemas.ModelMetadata = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai",
        capabilities: {
          chat: true,
          completion: true,
          embedding: false,
          functionCalling: true,
          vision: false,
          audio: false,
          streaming: true,
          jsonMode: true
        },
        contextWindow: 8192,
        deprecated: false
      }

      const normalized = Schemas.normalizeModel(model)
      expect(normalized.id).toBe("openai/gpt-4")
      expect(normalized.capabilities).toContain("chat")
      expect(normalized.capabilities).toContain("function_calling")
      expect(normalized.capabilities).not.toContain("vision")
    })
  })

  describe("Chat completion", () => {
    test("should validate chat completion request", () => {
      const request = {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "Hello!" }
        ],
        temperature: 0.7,
        maxTokens: 1000
      }

      const result = Schemas.validateEither(Schemas.ChatCompletionRequest)(request)
      expect(Either.isRight(result)).toBe(true)
    })

    test("should validate advice request", () => {
      const request = {
        model: "gpt-4",
        provider: "openai",
        query: "How to implement Effect services?",
        temperature: 0.7,
        stream: false
      }

      const result = Schemas.validateEither(Schemas.AdviceRequest)(request)
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe("Provider configuration", () => {
    test("should validate provider config", () => {
      const config = {
        name: "openai",
        apiKey: "sk-test123",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4",
        timeout: 30000,
        maxRetries: 3
      }

      const result = Schemas.validateEither(Schemas.ProviderConfig)(config)
      expect(Either.isRight(result)).toBe(true)
    })
  })
})

describe("Utility functions", () => {
  test("should normalize model IDs", () => {
    expect(Schemas.normalizeModelId("openai", "gpt-4")).toBe("openai/gpt-4")
    expect(Schemas.normalizeModelId("openai", "openai/gpt-4")).toBe("openai/gpt-4")
  })

  test("should parse model IDs", () => {
    const parsed = Schemas.parseModelId("openai/gpt-4")
    expect(parsed).not.toBeNull()
    expect(parsed?.provider).toBe("openai")
    expect(parsed?.modelId).toBe("gpt-4")
  })

  test("should return null for invalid model ID", () => {
    expect(Schemas.parseModelId("invalid")).toBeNull()
    expect(Schemas.parseModelId("unknown/provider/model")).toBeNull()
  })

  test("should convert parse errors to MCP errors", () => {
    const invalidData = { jsonrpc: "invalid" }
    const result = Schemas.validateEither(Schemas.JsonRpcRequest)(invalidData)
    
    if (Either.isLeft(result)) {
      const mcpError = Schemas.parseErrorToMCPError(result.left)
      expect(mcpError.code).toBe(Schemas.MCPErrorCode.InvalidParams)
      expect(mcpError.message).toBe("Validation error")
    }
  })

  test("should convert provider errors to MCP errors", () => {
    const providerError: Schemas.ProviderError = {
      provider: "openai",
      code: "rate_limit",
      message: "Rate limit exceeded",
      statusCode: 429
    }

    const mcpError = Schemas.providerErrorToMCPError(providerError)
    expect(mcpError.code).toBe(Schemas.MCPErrorCode.ToolExecutionError)
    expect(mcpError.message).toContain("Provider error")
  })
})