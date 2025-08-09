import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupProviders, type ProviderInfo } from './providers.js';
import { generateText } from 'ai';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPError, ErrorCode, validateString, wrapProviderError } from './errors.js';

export class PhoneAFriendServer {
  private server: Server;
  private providers = new Map<string, ProviderInfo>();

  constructor() {
    this.server = new Server({
      name: 'phone-a-friend',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    this.setupHandlers();
  }

  async start() {
    try {
      this.setupProviders();
      this.validateConfiguration();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Phone-a-Friend MCP server started on stdio');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupProviders() {
    this.providers = setupProviders();
    console.error(`Initialized ${this.providers.size} AI model providers`);
    
    if (this.providers.size === 0) {
      console.error('Warning: No providers configured. Please set API keys in environment variables.');
    }
  }

  private validateConfiguration() {
    if (this.providers.size === 0) {
      console.error('⚠️  No AI providers configured!');
      console.error('Please set at least one API key:');
      console.error('  - OPENAI_API_KEY for OpenAI');
      console.error('  - GOOGLE_API_KEY or GEMINI_API_KEY for Google');
      console.error('  - ANTHROPIC_API_KEY for Anthropic');
      console.error('  - XAI_API_KEY or GROK_API_KEY for xAI');
    }
  }

  private setupHandlers() {
    // Handle tools/list request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'models',
          description: 'List all available AI models',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'advice',
          description: 'Get advice from a specific AI model',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'The model ID to use (e.g., "openai:gpt-4o")'
              },
              prompt: {
                type: 'string',
                description: 'The prompt to send to the model'
              }
            },
            required: ['model', 'prompt']
          }
        }
      ]
    }));

    // Handle tools/call request
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        
        if (name === 'models') {
          return await this.handleListModels();
        } else if (name === 'advice') {
          return await this.handleAdvice(args);
        }
        
        throw new MCPError(
          `Unknown tool: ${name}`,
          ErrorCode.MethodNotFound,
          { requestedTool: name }
        );
      } catch (error) {
        // Convert errors to MCP error format
        if (error instanceof MCPError) {
          throw error;
        }
        throw new MCPError(
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCode.InternalError
        );
      }
    });
  }

  private async handleListModels() {
    const models = Array.from(this.providers.keys());
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            models,
            count: models.length
          }, null, 2)
        }
      ]
    };
  }

  private async handleAdvice(args: unknown) {
    try {
      // Validate input parameters
      const params = args as Record<string, unknown>;
      const model = validateString(params.model, 'model');
      const prompt = validateString(params.prompt, 'prompt');
      
      // Check if model exists
      const providerInfo = this.providers.get(model);
      if (!providerInfo) {
        const availableModels = Array.from(this.providers.keys());
        throw new MCPError(
          `Model "${model}" not found. Available models: ${availableModels.join(', ')}`,
          ErrorCode.ModelNotFound,
          { requestedModel: model, availableModels }
        );
      }

      // Extract provider name from model ID (e.g., "openai:gpt-4" -> "openai")
      const providerName = model.split(':')[0];

      try {
        const { text } = await generateText({
          model: providerInfo.provider,
          prompt
        });

        return {
          content: [
            {
              type: 'text' as const,
              text
            }
          ]
        };
      } catch (error: any) {
        // Wrap provider-specific errors
        throw wrapProviderError(error, providerName);
      }
    } catch (error) {
      // If it's already an MCPError, re-throw it
      if (error instanceof MCPError) {
        throw error;
      }
      
      // Otherwise, wrap as internal error
      throw new MCPError(
        `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.InternalError
      );
    }
  }
}