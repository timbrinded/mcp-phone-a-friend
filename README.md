# Phone-a-Friend MCP Server

A simple MCP (Model Context Protocol) server that bridges AI models using the Vercel AI SDK, allowing AI agents to consult other models for advice.

## Features

- 🤖 Support for multiple AI providers (OpenAI, Google, Anthropic, xAI)
- 🔧 Simple MCP tools for model discovery and consultation
- 📡 Standard stdio transport for local use
- ⚡ Built with Bun for fast performance
- 🛡️ Comprehensive error handling with MCP-compliant responses
- ✅ Input validation for all tool parameters

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/phone-a-friend-mcp.git
cd phone-a-friend-mcp

# Install dependencies
bun install

# Link for global use (optional)
bun link
```

### Global Installation

After linking, you can run the server from anywhere:

```bash
phone-a-friend
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

# xAI (Grok)
export XAI_API_KEY=xai-...
# or
export GROK_API_KEY=xai-...
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

### xAI (Grok)
- grok-beta
- grok-2
- grok-2-mini

## Troubleshooting

### No providers configured

If you see "No AI providers configured" when starting the server, ensure you have set at least one API key as an environment variable.

### Model not found

When calling the `advice` tool, make sure to use the full model ID format: `provider:model-name`, for example:
- `openai:gpt-4o`
- `google:gemini-1.5-pro`
- `anthropic:claude-3-5-sonnet-20241022`
- `xai:grok-2`

### Rate limit errors

If you encounter rate limit errors, the server will return an MCP-compliant error with code `-32003`. Consider:
- Using a different provider
- Waiting before retrying
- Checking your API plan limits

### API key issues

Invalid or missing API keys will result in error code `-32002`. Verify:
- Your API key is correctly set in environment variables
- The API key has not expired
- You have the necessary permissions for the requested model

## Development

### Running Tests

```bash
bun test
```

### Type Checking

```bash
bun run check
```

## License

MIT