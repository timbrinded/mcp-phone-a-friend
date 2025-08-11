import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupProviders, type ProviderInfo } from './providers.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPError, ErrorCode } from './errors.js';
import { handleListModels, handleAdvice, handleModelsStatus } from './handlers/index.js';
import { handleAsyncAdvice, closeStore } from './handlers/advice-async.js';

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
      
      // Handle cleanup on exit
      process.on('SIGINT', () => {
        console.error('Shutting down...');
        closeStore();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        console.error('Shutting down...');
        closeStore();
        process.exit(0);
      });
      
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
          description: 'List available AI models. Use detailed=true for configuration status',
          inputSchema: {
            type: 'object',
            properties: {
              detailed: {
                type: 'boolean',
                description: 'Show detailed configuration status and setup instructions',
                default: false
              }
            },
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
              },
              reasoningEffort: {
                type: 'string',
                enum: ['minimal', 'low', 'medium', 'high'],
                description: 'Reasoning effort for OpenAI reasoning models (o3, GPT-5). Optional - uses model defaults if not specified'
              },
              verbosity: {
                type: 'string', 
                enum: ['low', 'medium', 'high'],
                description: 'Text verbosity for GPT-5 models. Optional - uses model defaults if not specified'
              }
            },
            required: ['model', 'prompt']
          }
        },
        {
          name: 'advice_async',
          description: 'Get advice asynchronously with conversation support and caching',
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
              },
              conversation_id: {
                type: 'string',
                description: 'Optional conversation ID for multi-turn conversations'
              },
              request_id: {
                type: 'number',
                description: 'Optional request ID to check status of existing request'
              },
              check_status: {
                type: 'boolean',
                description: 'Check status of existing request (requires request_id)',
                default: false
              },
              reasoning_effort: {
                type: 'string',
                enum: ['minimal', 'low', 'medium', 'high'],
                description: 'Reasoning effort for OpenAI reasoning models'
              },
              verbosity: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Text verbosity for GPT-5 models'
              },
              temperature: {
                type: 'number',
                description: 'Temperature for response generation (0-2)',
                minimum: 0,
                maximum: 2
              },
              max_completion_tokens: {
                type: 'number',
                description: 'Maximum tokens in completion'
              },
              wait_timeout_ms: {
                type: 'number',
                description: 'How long to wait for response in milliseconds',
                default: 30000
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
          const detailed = (args as any)?.detailed || false;
          return detailed 
            ? await handleModelsStatus(this.providers)
            : await handleListModels(this.providers);
        } else if (name === 'advice') {
          return await handleAdvice(args, this.providers);
        } else if (name === 'advice_async') {
          return await handleAsyncAdvice(args as any, this.providers);
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
}