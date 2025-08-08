# Phone-a-Friend MCP Server Implementation Plan

## Overview
Build a TypeScript MCP (Model Context Protocol) server using Effect-TS services architecture that bridges AI models using the Vercel AI SDK, allowing AI agents to consult other models for advice.

## Architecture Principles
- **Effect-TS Service Architecture**: Use Effect-TS services for dependency injection and type-safe effects
- **MCP Protocol 2025-06-18**: Full compliance with latest MCP specification
- **Type Safety**: Full TypeScript with runtime validation using Zod and Effect-TS Schema
- **Streaming-First**: Design all APIs for streaming using Effect streams
- **Graceful Error Handling**: Effect-TS error management with structured failures
- **Bun Runtime**: Leverage Bun's built-in capabilities (SQLite, native TypeScript)

## Project Structure
```
phone-a-friend-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point with Effect runtime
│   ├── server.ts                # Core MCP server implementation with Effect
│   ├── services/
│   │   ├── mcp.service.ts       # MCP server service definition
│   │   ├── provider.service.ts  # AI provider service interface
│   │   ├── cache.service.ts     # SQLite caching service
│   │   ├── rate-limiter.service.ts # Rate limiting service
│   │   ├── model-discovery.service.ts # Model discovery service
│   │   └── index.ts             # Service exports
│   ├── providers/
│   │   ├── openai.provider.ts   # OpenAI Effect service implementation
│   │   ├── gemini.provider.ts   # Google Gemini Effect service
│   │   ├── xai.provider.ts      # X.AI Effect service
│   │   └── index.ts             # Provider exports
│   ├── tools/
│   │   ├── models.tool.ts       # /models discovery tool with Effect
│   │   └── advice.tool.ts       # /advice consultation tool with Effect
│   ├── layers/
│   │   ├── providers.layer.ts   # Provider service layers
│   │   ├── cache.layer.ts       # Cache service layer
│   │   ├── config.layer.ts      # Configuration layer
│   │   └── index.ts             # Layer exports
│   ├── schemas/
│   │   ├── mcp.schema.ts        # MCP protocol schemas (Schema module)
│   │   ├── providers.schema.ts  # Provider request/response schemas
│   │   └── index.ts             # Schema exports
│   ├── config/
│   │   ├── constants.ts         # API endpoints, model mappings
│   │   └── prompts.ts           # Advice prompt templates
│   └── utils/
│       ├── environment.ts       # Environment Effect service
│       ├── errors.ts            # Effect error classes
│       └── streams.ts           # Effect stream utilities
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   ├── providers/
│   │   └── tools/
│   └── integration/
│       └── mcp-server.test.ts
├── package.json
├── tsconfig.json
├── bunfig.toml
├── .env.example
└── README.md
```

## Implementation Tasks

### Phase 1: Foundation (Days 1-2)
- [ ] **1.1 Project Setup**
  - Initialize Bun project with TypeScript
  - Configure tsconfig.json for strict type checking
  - Install core dependencies:
    ```bash
    bcp add @modelcontextprotocol/sdk ai @ai-sdk/openai @ai-sdk/google@1.2.22 @ai-sdk/anthropic effect @effect/schema
    bun add -d @types/bun typescript
    ```
  - Set up Effect-TS project structure with services and layers

- [ ] **1.2 Schema Definitions**
  - Define Effect Schema for MCP protocol compliance (2025-06-18)
  - Create provider request/response schemas using @effect/schema
  - Implement model capability normalization schemas
  - Set up validation pipelines with Effect Schema decode

- [ ] **1.3 Core Services Setup**
  - Define MCP server service interface using Effect Context.Tag
  - Create base Effect runtime with proper error handling
  - Set up service dependency graph with Effect layers
  - Implement structured logging service with Effect

### Phase 2: Effect Services Architecture (Days 3-4)
- [ ] **2.1 Provider Service Interface**
  - Define ProviderService interface using Effect Context.Tag
  - Create Effect-based provider capabilities (isAvailable, detectApiKey)
  - Implement unified error handling with Effect error types
  - Set up provider service dependency contracts

- [ ] **2.2 Provider Registry Service**
  - Implement ProviderRegistryService using Effect
  - Add auto-discovery based on environment variables (Effect Config)
  - Create provider factory pattern with Effect layers
  - Handle provider initialization failures using Effect error management

- [ ] **2.3 Environment Service**
  - Create EnvironmentService using Effect Config
  - Support multiple API key variants per provider with Effect Config.map
  - Validate environment on startup using Effect Config validation
  - Add .env.example with all supported keys

### Phase 3: Provider Service Implementations (Days 5-6)
- [ ] **3.1 OpenAI Provider Service**
  - Implement OpenAIProviderService as Effect service with Vercel AI SDK
  - Add model list using Effect (hardcoded initially)
  - Create Effect-based text generation with proper error handling
  - Implement streaming support using Effect Streams

- [ ] **3.2 Gemini Provider Service**
  - Implement GeminiProviderService using Effect (use @ai-sdk/google@1.2.22)
  - Handle Gemini-specific model naming with Effect Config
  - Add fallback for missing list endpoint using Effect tryOrElse
  - Test with sample requests using Effect test utilities

- [ ] **3.3 X.AI Provider Service**
  - Implement XAIProviderService using Effect
  - Support both XAI_API_KEY and GROK_API_KEY with Effect Config
  - Add Grok model variants configuration
  - Test integration with Effect test framework

### Phase 4: MCP Tool Implementation (Days 7-8)
- [ ] **4.1 Models Discovery Tool**
  - Implement /models tool handler using Effect and MCP 2025-06-18 spec
  - Query all available providers in parallel using Effect.allWith
  - Normalize model information using Effect Schema
  - Return aggregated model list with MCP-compliant capabilities

- [ ] **4.2 Advice Tool**
  - Implement /advice tool handler with Effect error management
  - Parse model selection from request using Effect Schema
  - Build specialized prompt templates with Effect Config
  - Handle both streaming and non-streaming responses using Effect Streams
  - Convert streams to MCP 2025-06-18 compatible format

- [ ] **4.3 Prompt Engineering Service**
  - Create PromptService using Effect Context.Tag
  - Add provider-specific prompt optimizations with Effect Config
  - Implement request context preservation using Effect Ref
  - Support custom system prompts through configuration

### Phase 5: Performance & Resilience Services (Days 9-10)
- [ ] **5.1 Caching Service**
  - Implement CacheService using Effect and bun:sqlite
  - Cache model lists with 10-minute TTL using Effect Schedule
  - Add cache invalidation strategies with Effect Ref
  - Persist cache across restarts using Effect Resource management

- [ ] **5.2 Rate Limiting Service**
  - Implement RateLimiterService using Effect and token bucket algorithm
  - Add per-provider rate limits with Effect Config
  - Support adaptive throttling using Effect Schedule
  - Handle rate limit errors using Effect error channel

- [ ] **5.3 Stream Handling Service**
  - Implement proper backpressure handling with Effect Streams
  - Convert Vercel AI streams to MCP format using Effect Stream transforms
  - Add stream timeout protection using Effect.timeout
  - Support partial stream recovery with Effect error handling

- [ ] **5.4 Error Management**
  - Create unified error taxonomy using Effect Data.TaggedError
  - Map provider-specific errors to Effect error types
  - Implement circuit breaker pattern with Effect Resource
  - Add retry logic with exponential backoff using Effect Schedule

### Phase 6: Testing & Documentation (Days 11-12)
- [ ] **6.1 Effect Unit Tests**
  - Test each provider service independently using Effect test utilities
  - Mock API responses with Effect test layers
  - Test error handling paths with Effect error simulation
  - Verify type safety with Effect Schema validation

- [ ] **6.2 Integration Tests**
  - Test MCP server with actual requests using Effect test runtime
  - Verify tool registration with MCP 2025-06-18 compliance
  - Test streaming responses with Effect Stream testing
  - Validate error responses using Effect error matching

- [ ] **6.3 Documentation**
  - Write comprehensive README with Effect architecture explanation
  - Document service interfaces and layer composition
  - Add usage examples with Effect runtime setup
  - Create provider configuration guide for Effect Config

### Phase 7: Production Hardening (Days 13-14)
- [ ] **7.1 Observability Services**
  - Add structured logging service with correlation IDs using Effect Logger
  - Implement health check service with Effect Ref state tracking
  - Add metrics collection service using Effect Metrics
  - Create monitoring dashboard with Effect observability integration

- [ ] **7.2 Security Services**
  - Validate all external inputs using Effect Schema decode
  - Sanitize API keys from logs with Effect Logger redact
  - Implement request signing service with Effect crypto utilities
  - Add audit logging service with Effect structured logging

- [ ] **7.3 Performance Optimization**
  - Profile and optimize hot paths using Effect tracing
  - Implement connection pooling with Effect Resource pool
  - Add request coalescing using Effect batching
  - Optimize memory usage with Effect Resource management

## Critical Implementation Details

### Effect Config Environment Mapping
```typescript
// Using Effect Config for environment variable management
import { Config } from "effect"

export const OpenAIConfig = Config.string("OPENAI_API_KEY")
export const GeminiConfig = Config.first(
  Config.string("GEMINI_API_KEY"),
  Config.string("GOOGLE_API_KEY")
)
export const XAIConfig = Config.first(
  Config.string("XAI_API_KEY"), 
  Config.string("GROK_API_KEY")
)
export const AnthropicConfig = Config.string("ANTHROPIC_API_KEY")
export const DeepSeekConfig = Config.string("DEEPSEEK_API_KEY")
```

### Effect Stream Conversion Pattern
```typescript
// Converting provider streams to MCP format using Effect Streams
import { Stream, Effect } from "effect"

const providerStreamToMcp = (
  stream: ReadableStream
): Stream.Stream<string, StreamError> =>
  Stream.fromReadableStream(() => stream, (error) => new StreamError({ cause: error }))
    .pipe(
      Stream.mapEffect(chunk => 
        Effect.try(() => JSON.stringify(chunk) + "\n")
          .pipe(Effect.mapError(error => new SerializationError({ cause: error })))
      ),
      Stream.rechunk(1024), // Handle backpressure
      Stream.timeout("30 seconds") // Add timeout protection
    )
```

### Effect Error Handling Pattern
```typescript
// Using Effect Data.TaggedError for structured error handling
import { Data } from "effect"

export class MCPError extends Data.TaggedError("MCPError")<{
  readonly code: string
  readonly details?: unknown
  readonly cause?: unknown
}> {}

export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly provider: string
  readonly cause: unknown
}> {}

export class StreamError extends Data.TaggedError("StreamError")<{
  readonly cause: unknown
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly issues: Array<{ path: string; message: string }>
}> {}
```

## Testing Commands
```bash
# Run Effect unit tests  
bun test

# Test MCP server locally with inspector
bunx @modelcontextprotocol/inspector

# Test with MCP 2025-06-18 compliant requests
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | bun run src/index.ts

# Run Effect runtime with specific config
OPENAI_API_KEY=test bun run src/index.ts
```

## Key Dependencies & Versions
- `@modelcontextprotocol/sdk`: Latest (MCP 2025-06-18 support)
- `effect`: ^3.10.0 (Effect-TS for services architecture)
- `@effect/schema`: ^0.77.0 (Schema validation and parsing)
- `ai`: ^4.0.0 (Vercel AI SDK)
- `@ai-sdk/openai`: Latest
- `@ai-sdk/google`: 1.2.22 (CRITICAL: For AI SDK v4 compatibility)
- `@ai-sdk/anthropic`: Latest
- `bun`: >=1.0.0 (Runtime and package manager)

## Success Criteria
- [ ] Effect runtime starts MCP server without errors
- [ ] All services initialize properly through Effect layers
- [ ] `/models` tool discovers all configured providers using Effect concurrency
- [ ] `/advice` tool successfully queries each provider with Effect error handling
- [ ] Streaming responses work correctly with Effect Streams
- [ ] All Effect Schema validations pass for MCP 2025-06-18 compliance
- [ ] Effect test suite achieves >80% coverage
- [ ] Documentation covers Effect architecture and service composition

## Potential Pitfalls to Avoid
1. **Effect Error Handling**: Always handle errors in the Effect error channel, never throw
2. **MCP 2025-06-18 Compliance**: Ensure all tools/resources/prompts follow latest spec
3. **Gemini SDK Version**: Must use @ai-sdk/google@1.2.22 for AI SDK v4 compatibility
4. **Effect Streaming**: Use Effect Streams properly for backpressure and error handling
5. **Service Dependencies**: Define all service dependencies correctly in Effect layers
6. **Environment Variables**: Use Effect Config instead of direct Bun.env access
7. **Effect Resource Management**: Properly acquire/release resources using Effect Resource
8. **Schema Validation**: Always validate inputs/outputs using Effect Schema

## Notes
- Start with OpenAI provider service as it has the most mature SDK support
- Test Effect streaming early - retrofitting with Effect Streams is complex
- Use `bunx @modelcontextprotocol/inspector` for MCP 2025-06-18 debugging
- Keep provider services isolated using Effect Context.Tag for easy addition
- Use Effect layers for clean dependency injection and testability
- Consider Effect clustering for distributed caching in production
- Follow Effect best practices for composable and maintainable services

## Resources
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Effect-TS Documentation](https://effect.website/docs/getting-started/introduction)
- [Effect-TS Services Guide](https://effect.website/docs/guides/context-management/services)
- [Effect Schema Documentation](https://effect.website/docs/schema/introduction)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction)
- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)