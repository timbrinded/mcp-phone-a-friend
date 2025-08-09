# Phone-a-Friend MCP Server Implementation Plan

## 📊 Progress Status
**Last Updated:** 2025-08-08
- **Current Phase:** Day 2 - Complete ✅
- **Runtime:** Bun/Node.js
- **Architecture:** Simple, Direct MCP SDK Implementation
- **Timeline:** 2 Days Total

## Overview
Build a simple, maintainable MCP (Model Context Protocol) server that bridges AI models using the Vercel AI SDK, allowing AI agents to consult other models for advice. Follows MCP best practices for local servers.

## Architecture Principles
- **Simplicity First**: Direct implementation using official MCP SDK
- **No Over-Engineering**: Avoid unnecessary abstractions and frameworks
- **MCP Protocol Compliance**: Full compliance with MCP 2025-06-18 specification
- **Promise-Based**: Direct async/await with Vercel AI SDK
- **Local-First**: Optimized for stdio transport and local use

## Project Structure
```
phone-a-friend-mcp/
├── src/
│   ├── index.ts          # Entry point
│   ├── server.ts         # MCP server implementation
│   ├── providers.ts      # AI provider setup
│   ├── tools.ts          # MCP tool implementations
│   └── config.ts         # Configuration and environment
├── tests/
│   └── server.test.ts    # Basic tests
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Implementation Tasks

### Day 1: Core Implementation (8 hours)

#### Morning (4 hours)
- [x] **1.1 Project Setup** (30 min)
  - Initialize project with TypeScript
  - Install dependencies:
    ```bash
    bun add @modelcontextprotocol/sdk ai @ai-sdk/openai @ai-sdk/google @ai-sdk/anthropic
    bun add -d @types/node typescript
    ```
  - Configure tsconfig.json for ES modules
  - Set up basic project structure

- [x] **1.2 Basic MCP Server** (1.5 hours)
  - Create server class using official SDK
  - Implement stdio transport
  - Set up basic server lifecycle (start/stop)
  - Add console logging to stderr

- [x] **1.3 Provider Integration** (2 hours)
  - Set up provider registry with Map
  - Integrate OpenAI provider
  - Add environment variable configuration
  - Test basic text generation

#### Afternoon (4 hours)
- [x] **1.4 Implement /models Tool** (1 hour)
  - Register tool with MCP server
  - Return list of available models
  - Handle provider availability based on API keys

- [x] **1.5 Implement /advice Tool** (2 hours)
  - Register tool with parameters schema
  - Handle model selection
  - Integrate Vercel AI SDK streaming
  - Return formatted responses

- [x] **1.6 End-to-End Testing** (1 hour)
  - Test with MCP inspector
  - Verify tool registration
  - Test actual AI responses
  - Fix any issues found

### Day 2: Polish & Release (8 hours) ✅

#### Morning (4 hours)
- [x] **2.1 Multi-Provider Support** (2 hours)
  - Add Google Gemini provider ✅
  - Add Anthropic Claude provider ✅
  - Add xAI Grok provider ✅
  - Support provider-specific model naming ✅
  - Test all providers ✅

- [x] **2.2 Error Handling** (2 hours)
  - Add try-catch blocks for API calls ✅
  - Handle missing API keys gracefully ✅
  - Implement proper MCP error responses ✅
  - Add input validation ✅

#### Afternoon (4 hours)
- [x] **2.3 Configuration** (1 hour)
  - Create .env.example file ✅
  - Support multiple API key formats ✅
  - Add model configuration ✅
  - Document environment variables ✅

- [x] **2.4 Documentation** (2 hours)
  - Write comprehensive README ✅
  - Add usage examples ✅
  - Document supported models ✅
  - Create troubleshooting guide ✅

## Code Examples

### Simple Server Implementation
```typescript
// src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class PhoneAFriendServer {
  private server: Server;
  private providers = new Map();

  constructor() {
    this.server = new Server({
      name: 'phone-a-friend',
      version: '1.0.0'
    });
  }

  async start() {
    this.setupProviders();
    this.registerTools();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Phone-a-Friend MCP server started on stdio');
  }

  private setupProviders() {
    // Simple, direct provider setup
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('gpt-4', { /* provider config */ });
    }
  }

  private registerTools() {
    this.server.addTool({
      name: 'models',
      description: 'List available AI models',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => this.listModels()
    });

    this.server.addTool({
      name: 'advice',
      description: 'Get advice from an AI model',
      inputSchema: {
        type: 'object',
        properties: {
          model: { type: 'string' },
          prompt: { type: 'string' }
        },
        required: ['model', 'prompt']
      },
      handler: async (args) => this.getAdvice(args.model, args.prompt)
    });
  }
}
```

### Direct Vercel AI SDK Usage
```typescript
// src/tools.ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

async getAdvice(modelId: string, prompt: string) {
  const model = this.providers.get(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not available`);
  }

  const { text } = await generateText({
    model: openai(modelId),
    prompt
  });

  return { content: text };
}
```

## Environment Variables
```bash
# .env.example
# OpenAI
OPENAI_API_KEY=sk-...

# Google
GOOGLE_API_KEY=... 
# or
GEMINI_API_KEY=...

# Anthropic  
ANTHROPIC_API_KEY=sk-ant-...

# X.AI
XAI_API_KEY=...
# or
GROK_API_KEY=...
```

## Testing Commands
```bash
# Run the server locally
bun run src/index.ts

# Test with MCP inspector
bunx @modelcontextprotocol/inspector

# Test tool listing
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | bun run src/index.ts

# Run tests
bun test
```

## Key Dependencies
- `@modelcontextprotocol/sdk`: Official MCP SDK
- `ai`: Vercel AI SDK core
- `@ai-sdk/openai`: OpenAI provider
- `@ai-sdk/google`: Google provider
- `@ai-sdk/anthropic`: Anthropic provider
- `typescript`: Type checking
- `bun` or `node`: Runtime

## Success Criteria
- [x] Server starts without errors ✅
- [x] Tools are registered and discoverable ✅
- [x] `/models` returns available models ✅
- [x] `/advice` successfully queries each provider ✅
- [x] Works with MCP inspector ✅
- [x] Error handling prevents crashes ✅
- [x] Documentation is clear and complete ✅
- [x] Can be installed and run by others ✅

## What We're NOT Building
- ❌ Effect-TS layers and services
- ❌ SQLite caching
- ❌ Rate limiting
- ❌ Circuit breakers
- ❌ Complex error taxonomies
- ❌ Dependency injection
- ❌ Service orchestration
- ❌ 14 days of unnecessary complexity

## Notes
- Keep it simple - this is a local utility, not a distributed system
- Follow patterns from official MCP examples
- Test early and often with the MCP inspector
- Focus on core functionality first
- Only add complexity if users actually need it

## Resources
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [MCP Server Examples](https://github.com/modelcontextprotocol/servers)