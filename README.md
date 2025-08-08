# Phone-a-Friend MCP Server

A simple MCP (Model Context Protocol) server that bridges AI models using the Vercel AI SDK, allowing AI agents to consult other models for advice.

## Features

- 🤖 Support for multiple AI providers (OpenAI, Google, Anthropic)
- 🔧 Simple MCP tools for model discovery and consultation
- 📡 Standard stdio transport for local use
- ⚡ Built with Bun for fast performance

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/phone-a-friend-mcp.git
cd phone-a-friend-mcp

# Install dependencies
bun install
```

## Configuration

Set your API keys as environment variables:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Google/Gemini
export GOOGLE_API_KEY=...
# or
export GEMINI_API_KEY=...

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

### Run the server

```bash
bun run src/index.ts
```

### Available Tools

#### `models`
Lists all available AI models based on configured API keys.

#### `advice`
Gets advice from a specific AI model.

**Parameters:**
- `model` (string): The model ID (e.g., "openai:gpt-4o")
- `prompt` (string): The prompt to send to the model

### Testing

Run the test script to verify the server is working:

```bash
bun test-server.js
```

### Use with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "phone-a-friend": {
      "command": "bun",
      "args": ["run", "/path/to/phone-a-friend-mcp/src/index.ts"],
      "env": {
        "OPENAI_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Supported Models

### OpenAI
- gpt-4o
- gpt-4o-mini
- gpt-4-turbo
- gpt-3.5-turbo

### Google
- gemini-1.5-pro
- gemini-1.5-flash
- gemini-1.0-pro

### Anthropic
- claude-3-5-sonnet-20241022
- claude-3-opus-20240229
- claude-3-haiku-20240307

## License

MIT