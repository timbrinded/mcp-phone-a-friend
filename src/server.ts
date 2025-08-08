import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupProviders, type ProviderInfo } from './providers.js';
import { generateText } from 'ai';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

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
    this.setupProviders();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Phone-a-Friend MCP server started on stdio');
  }

  private setupProviders() {
    this.providers = setupProviders();
    console.error(`Initialized ${this.providers.size} AI model providers`);
    
    if (this.providers.size === 0) {
      console.error('Warning: No providers configured. Please set API keys in environment variables.');
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
      const { name, arguments: args } = request.params;
      
      if (name === 'models') {
        return this.handleListModels();
      } else if (name === 'advice') {
        return this.handleAdvice(args);
      }
      
      throw new Error(`Unknown tool: ${name}`);
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
    const { model, prompt } = args as { model: string; prompt: string };
    
    const providerInfo = this.providers.get(model);
    if (!providerInfo) {
      throw new Error(`Model not found: ${model}. Available models: ${Array.from(this.providers.keys()).join(', ')}`);
    }

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
    } catch (error) {
      throw new Error(`Failed to generate text: ${error}`);
    }
  }
}