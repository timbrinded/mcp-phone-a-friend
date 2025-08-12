# model-agency

MCP server that provides unified access to multiple AI models (OpenAI, Google, Anthropic, xAI) with structured output support, async operations, and idiomatic code pattern enforcement.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Version](https://img.shields.io/badge/MCP-1.17.2-blue)](https://github.com/modelcontextprotocol/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1.0-black)](https://bun.sh/)

## Features

- Multi-provider AI integration (OpenAI, Google, Anthropic, xAI)
- Automatic structured output detection with JSON response support
- Async operations with request tracking and caching
- Idiomatic pattern enforcement to prevent common anti-patterns
- Smart retry logic with exponential backoff
- Real-time model health checks and capability detection

## Installation

```bash
git clone https://github.com/yourusername/model-agency
cd model-agency
bun install
bun run build
```

## Configuration

Set API keys as environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."     # or GEMINI_API_KEY
export ANTHROPIC_API_KEY="..."
export XAI_API_KEY="..."         # or GROK_API_KEY
```

## Usage

Start the server:
```bash
bun start
```

Development mode:
```bash
bun run dev
```

## Available Tools

### models
List available models with capabilities and performance characteristics.

```typescript
{ "detailed": false }  // Basic listing
{ "detailed": true }   // Include configuration status
```

### advice
Get AI assistance with automatic capability detection.

```typescript
{
  "model": "openai:gpt-4o",
  "prompt": "How do I optimize this React component?",
  "reasoningEffort": "medium",  // o3/GPT-5 only
  "verbosity": "low"            // GPT-5 only
}
```

Features:
- Automatic structured output when supported
- Fallback to text mode for incompatible models
- Response includes confidence scores

### advice_async
Handle long-running AI operations with conversation support.

```typescript
{
  "model": "openai:o3",
  "prompt": "Analyze this architecture...",
  "conversation_id": "uuid",     // For multi-turn
  "max_completion_tokens": 2000,
  "temperature": 0.7,
  "wait_timeout_ms": 120000
}
```

Features:
- Multi-turn conversation support
- Request caching and deduplication
- Non-blocking operations
- Automatic context iteration (max 3 rounds)

### idiom
Get ecosystem-aware implementation approaches.

```typescript
{
  "task": "Implement global state management in React",
  "context": {
    "dependencies": "{ \"react\": \"^18.2.0\" }",
    "language": "typescript",
    "constraints": ["no new dependencies"]
  }
}
```

Returns:
- Recommended approach with rationale
- Packages to use/avoid
- Code examples
- Anti-patterns to avoid

## Architecture

```
src/
├── server.ts           # Main MCP server
├── providers.ts        # Provider configuration
├── model-registry.ts   # Model factory registry
├── handlers/
│   ├── advice.ts       # Sync advice handler
│   ├── advice-async.ts # Async with caching
│   ├── idiom.ts        # Pattern enforcement
│   └── models.ts       # Model listing
├── utils/
│   ├── errors.ts       # Error handling
│   └── optimization.ts # Performance utils
└── clients/
    └── openai-async.ts # OpenAI async client
```

## Available Models

### OpenAI
- **Reasoning**: o3, o3-mini, o3-pro, o4-mini (60-120s)
- **Fast**: gpt-4o, gpt-4o-mini (5-15s)
- **GPT-5 Series**: gpt-5, gpt-5-mini, gpt-5-nano (with reasoning)
- **GPT-4.1 Series**: gpt-4.1, gpt-4.1-mini, gpt-4.1-nano

### Google
- **Gemini 2.5**: gemini-2.5-pro, gemini-2.5-flash (with thinking mode)
- **Gemini 2.0**: gemini-2.0-flash, gemini-2.0-flash-lite
- **Gemini 1.x**: gemini-1.5-pro, gemini-1.5-flash, gemini-1.0-pro

### Anthropic
- **Claude 4 (Opus)**: claude-opus-4-1-20250805, claude-opus-4-20250514 (hybrid reasoning)
- **Claude 3.7**: claude-3-7-sonnet-20250219
- **Claude 3.5**: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022
- **Claude 3**: claude-3-opus-20240229, claude-3-haiku-20240307

### xAI
- **Grok 4**: grok-4 (with reasoning)
- **Grok 3**: grok-3, grok-3-mini
- **Grok 2**: grok-2
- **Legacy**: grok-beta

## Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Testing

```bash
bun test           # Run all tests
bun test:watch     # Watch mode
bun check          # Type checking
```

## Troubleshooting

**No models available**: Check that at least one API key is set.

**Model not found**: Use full format `provider:model-name` (e.g., `openai:gpt-4o`).

**Rate limits**: Error `-32003` indicates rate limiting. Try another provider or wait.

**API key issues**: Error `-32002` indicates auth problems. Verify key is valid.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit changes
4. Push to branch
5. Open a Pull Request

## License

MIT - see [LICENSE](LICENSE) file.

## Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol/sdk)
- [AI SDK](https://sdk.vercel.ai/)
- [Bun](https://bun.sh/)