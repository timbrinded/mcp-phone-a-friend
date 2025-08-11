import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupProviders, type ProviderInfo } from './providers.js';
import { generateText } from 'ai';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPError, ErrorCode, validateString, wrapProviderError } from './errors.js';
import { config, reasoningModels, modelParameters } from './config.js';

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
          name: 'models-status',
          description: 'Show detailed status of all model providers and their availability',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
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
        } else if (name === 'models-status') {
          return await this.handleModelsStatus();
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

  private async handleModelsStatus() {
    const isConfigured = (apiKey: string | undefined) => !!(apiKey && apiKey.trim());
    
    const status = {
      providers: {
        openai: {
          configured: isConfigured(config.openai.apiKey),
          models: config.openai.models,
          apiKey: isConfigured(config.openai.apiKey) ? 'Configured ✓' : 'Missing - Set OPENAI_API_KEY',
          available: config.openai.models.map(m => `openai:${m}`).filter(m => this.providers.has(m))
        },
        google: {
          configured: isConfigured(config.google.apiKey),
          models: config.google.models,
          apiKey: isConfigured(config.google.apiKey) ? 'Configured ✓' : 'Missing - Set GOOGLE_API_KEY or GEMINI_API_KEY',
          available: config.google.models.map(m => `google:${m}`).filter(m => this.providers.has(m))
        },
        anthropic: {
          configured: isConfigured(config.anthropic.apiKey),
          models: config.anthropic.models,
          apiKey: isConfigured(config.anthropic.apiKey) ? 'Configured ✓' : 'Missing - Set ANTHROPIC_API_KEY',
          available: config.anthropic.models.map(m => `anthropic:${m}`).filter(m => this.providers.has(m))
        },
        xai: {
          configured: isConfigured(config.xai.apiKey),
          models: config.xai.models,
          apiKey: isConfigured(config.xai.apiKey) ? 'Configured ✓' : 'Missing - Set XAI_API_KEY or GROK_API_KEY',
          available: config.xai.models.map(m => `xai:${m}`).filter(m => this.providers.has(m))
        }
      },
      summary: {
        totalProvidersConfigured: Object.values({
          openai: isConfigured(config.openai.apiKey),
          google: isConfigured(config.google.apiKey),
          anthropic: isConfigured(config.anthropic.apiKey),
          xai: isConfigured(config.xai.apiKey)
        }).filter(Boolean).length,
        totalModelsAvailable: this.providers.size,
        readyToUse: this.providers.size > 0
      },
      quickSetup: this.providers.size === 0 ? [
        'To get started, set at least one API key:',
        '',
        'export OPENAI_API_KEY=sk-...',
        'export GOOGLE_API_KEY=...',
        'export ANTHROPIC_API_KEY=sk-ant-...',
        'export XAI_API_KEY=xai-...'
      ] : []
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(status, null, 2)
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
      
      // Optional parameters
      const userReasoningEffort = params.reasoningEffort as string | undefined;
      const userVerbosity = params.verbosity as string | undefined;
      
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
      const modelName = model.split(':')[1];

      try {
        // Check if this is a reasoning model that needs special handling
        const isReasoningModel = reasoningModels.has(modelName);
        
        // Build options based on model type
        const generateOptions: any = {
          model: providerInfo.provider,
          prompt
        };
        
        // Add provider-specific parameters based on model
        if (isReasoningModel && providerName === 'openai') {
          const providerOptions: any = {};
          
          // Get model-specific default parameters from configuration
          const modelParams = (modelParameters as any)[modelName];
          
          // Use user-provided parameters or fall back to model defaults
          if (userReasoningEffort || modelParams?.reasoningEffort) {
            providerOptions.reasoningEffort = userReasoningEffort || modelParams.reasoningEffort;
          }
          
          // Handle verbosity parameter for GPT-5 models
          if (userVerbosity || modelParams?.verbosity) {
            providerOptions.textVerbosity = userVerbosity || modelParams.verbosity;
          }
          
          // Only add provider metadata if we have parameters to set
          if (Object.keys(providerOptions).length > 0) {
            generateOptions.experimental_providerMetadata = {
              openai: providerOptions
            };
          }
        }
        // Note: Gemini 2.5 thinking models handle thinking internally
        // Note: Claude 4 hybrid models handle reasoning internally
        // Note: Grok-4 is always in reasoning mode
        
        const { text } = await generateText(generateOptions);

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