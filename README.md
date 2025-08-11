# 🏢 Model Agency MCP

> A Model Context Protocol (MCP) server that provides an agency of AI models working together for expert consultation, idiomatic code generation, and collaborative problem-solving.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Version](https://img.shields.io/badge/MCP-1.17.2-blue)](https://github.com/modelcontextprotocol/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1.0-black)](https://bun.sh/)

## 🌟 Features

### Your AI Model Agency
Think of it as having an entire agency of AI specialists at your disposal:
- **The Consultants**: Multiple AI providers (OpenAI, Google, Anthropic, xAI) ready to provide expert advice
- **The Standards Enforcer**: Prevents "AI slop" by enforcing idiomatic patterns and best practices
- **The Project Manager**: Handles async operations with smart retry logic and caching
- **The Quality Assurance**: Real-time model health checks and capability detection

### Multi-Provider AI Integration
- **OpenAI**: GPT-4, GPT-4.1, GPT-5, o3, o3-mini, o4-mini models
- **Google**: Gemini 2.0 Flash, Gemini 2.5 Flash/Pro models  
- **Anthropic**: Claude models (3-7-sonnet)
- **xAI**: Grok-3, Grok-4 models

### Intelligent Capabilities
- 🧠 **Expert Advice**: Get AI assistance with automatic capability detection and structured output support
- 🎯 **Idiomatic Patterns**: Prevent "AI slop" by enforcing ecosystem best practices and recommending battle-tested solutions
- ⚡ **Async Operations**: Handle long-running AI operations with request tracking and caching
- 🔄 **Smart Retry Logic**: Automatic retry with exponential backoff for transient failures
- 📊 **Model Status Monitoring**: Real-time health checks and capability matrix for all providers

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) runtime (v1.1.0+)
- At least one AI provider API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/model-agency
cd model-agency

# Install dependencies
bun install

# Build the project
bun run build
```

### Configuration

Set up your API keys as environment variables:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Google/Gemini
export GOOGLE_API_KEY="..."
# or
export GEMINI_API_KEY="..."

# Anthropic
export ANTHROPIC_API_KEY="..."

# xAI/Grok
export XAI_API_KEY="..."
# or
export GROK_API_KEY="..."
```

### Running the Server

```bash
# Start the MCP server
bun start

# Development mode with hot reload
bun run dev
```

## 🛠️ Available Tools

### `models`
List all available AI models in your agency with their capabilities and performance characteristics.

```typescript
// Basic usage
{ "detailed": false }

// Detailed view with configuration status
{ "detailed": true }
```

**Response includes:**
- Model categorization (reasoning, fast, standard)
- Performance characteristics (response times)
- Capability matrix (structured output, vision, etc.)
- Configuration status per provider

### `advice`
Consult with an AI model from your agency for expert advice.

```typescript
{
  "model": "openai:gpt-4o",
  "prompt": "How do I optimize this React component?",
  "reasoningEffort": "medium",  // For o3/GPT-5 models
  "verbosity": "low"            // For GPT-5 models
}
```

**Features:**
- Automatic structured output detection
- Smart fallback to text mode
- Response confidence scores
- Context request handling

### `advice_async`
Assign long-running tasks to your AI agency with multi-turn conversation support.

```typescript
{
  "model": "openai:o3",
  "prompt": "Analyze this complex architecture...",
  "conversation_id": "uuid",     // Optional, for multi-turn
  "max_completion_tokens": 2000,
  "temperature": 0.7,
  "wait_timeout_ms": 120000
}
```

**Advantages:**
- Multi-turn conversation support
- Request caching and deduplication
- Non-blocking for long operations
- Automatic context iteration (max 3 rounds)

### `idiom`
Have your agency's standards enforcer ensure idiomatic, ecosystem-aware approaches.

```typescript
{
  "task": "Implement global state management in React",
  "context": {
    "dependencies": "{ \"react\": \"^18.2.0\" }",
    "language": "typescript",
    "constraints": ["no new dependencies"]
  },
  "current_approach": "// Optional: code to evaluate"
}
```

**Returns:**
- Idiomatic approach with rationale
- Recommended packages to use
- Anti-patterns to avoid
- Concrete code examples
- References to documentation

## 🏗️ Architecture

### Core Components

```
src/
├── server.ts           # Main MCP server (ModelAgencyServer)
├── providers.ts        # AI provider setup and configuration
├── model-registry.ts   # Typed model factory registry
├── handlers/
│   ├── advice.ts       # Synchronous advice handler
│   ├── advice-async.ts # Async advice with caching
│   ├── idiom.ts        # Idiomatic pattern enforcement
│   └── models.ts       # Model listing and status
├── utils/
│   ├── errors.ts       # AI SDK error handling
│   └── optimization.ts # Performance utilities
└── clients/
    └── openai-async.ts # OpenAI async client
```

### Design Patterns

- **Typed Model Registry**: Type-safe model factories with lazy instantiation
- **Error Handling**: Leverages AI SDK error utilities with `.isInstance()` checks
- **Retry Logic**: Smart retry based on error types (429, 5xx)
- **Caching**: TTL-based cache for structured output detection
- **Concurrency Control**: Provider-specific rate limiting

## 🧪 Testing

```bash
# Run all tests
bun test

# Watch mode
bun test:watch

# Specific test suites
bun test:server      # Server tests
bun test:tools       # Tool handler tests
bun test:integration # Integration tests
```

## 📝 Development

### Type Checking
```bash
bun check
```

### Building
```bash
bun run build
```

### Project Structure
- Uses ES modules (`"type": "module"`)
- Built with `zshy` (bundler-free TypeScript build tool)
- Full TypeScript with strict typing
- MCP SDK for protocol implementation

## 🔌 Integration with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "model-agency": {
      "command": "bun",
      "args": ["run", "/path/to/model-agency/dist/run.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "GOOGLE_API_KEY": "...",
        "ANTHROPIC_API_KEY": "...",
        "XAI_API_KEY": "..."
      }
    }
  }
}
```

## 📊 Your Agency's Model Roster

### OpenAI Division
- **Reasoning Specialists**: o3, o3-mini, o4-mini (60-120s response time)
- **Fast Response Team**: gpt-4o, gpt-4o-mini (5-15s response time)
- **Advanced Analysts**: gpt-4.1, gpt-5 (with verbosity control)
- **Standard Consultants**: gpt-4-turbo, gpt-3.5-turbo

### Google Gemini Division
- **Latest Models**: gemini-2.0-flash, gemini-2.0-flash-lite
- **Pro Team**: gemini-2.5-flash, gemini-2.5-pro (with thinking mode)
- **Legacy Support**: gemini-1.5-pro, gemini-1.5-flash

### Anthropic Claude Division
- **Latest**: claude-3-7-sonnet (newest)
- **Classic Team**: claude-3-5-sonnet, claude-3-opus, claude-3-haiku

### xAI Grok Division
- **Latest**: grok-4 (256K context, multimodal)
- **Standard**: grok-3, grok-3-fast (131K context)
- **Legacy**: grok-2, grok-2-mini, grok-beta

## 🤝 Contributing

We welcome contributions to expand the Model Agency's capabilities!

### Development Setup

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- TypeScript with strict mode
- AI SDK idiomatic patterns
- Comprehensive error handling
- Documentation for complex logic

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol/sdk) by Anthropic
- [AI SDK](https://sdk.vercel.ai/) by Vercel
- [Bun](https://bun.sh/) runtime
- All the AI provider teams (OpenAI, Google, Anthropic, xAI)

## 🐛 Troubleshooting

### No models available in your agency
If you see "No AI providers configured", ensure you have set at least one API key as an environment variable.

### Model not found
Use the full model ID format: `provider:model-name`
- ✅ `openai:gpt-4o`
- ✅ `google:gemini-2.5-pro`
- ❌ `gpt-4o` (missing provider prefix)

### Rate limit errors
- MCP error code `-32003` indicates rate limiting
- Try a different provider or wait before retrying
- Check your API plan limits

### API key issues
- Error code `-32002` indicates authentication problems
- Verify your API key is correctly set
- Check key expiration and permissions

## 📞 Support

For issues, questions, or suggestions about the Model Agency, please open an issue on GitHub.

---

**Note**: Model Agency is an MCP server designed to be used with MCP-compatible clients like Claude Desktop, Cursor, or other tools that support the Model Context Protocol. Think of it as your personal AI agency, ready to tackle any task with the right specialist for the job.