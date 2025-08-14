import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupProviders, type ProviderInfo } from './providers.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPError, ErrorCode } from './errors.js';
import { handleListModels, handleUnifiedAdvice, handleModelsStatus, handleIdiom } from './handlers/index.js';
import { closeStore } from './handlers/advice-async.js';

export class ModelAgencyServer {
  private server: Server;
  private providers = new Map<string, ProviderInfo>();

  constructor() {
    this.server = new Server({
      name: 'model-agency',
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
      console.error('Model Agency MCP server started on stdio');
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
          description: `List AI models with capabilities and performance characteristics.
Models are categorized by their strengths:
• Reasoning models: Deep thinking, complex analysis (o3, GPT-5, gemini-2.5-pro) - 60-120s+
• Fast models: Quick responses, simple tasks (gpt-4o, gemini-flash) - 5-15s
• Standard models: Balanced performance (gpt-4.1, claude-sonnet) - 15-30s
• Structured output: Models that can return JSON responses reliably
• Vision capable: Models that can process images
Use 'detailed=true' to see full capabilities matrix, configuration status, and setup instructions`,
          inputSchema: {
            type: 'object',
            properties: {
              detailed: {
                type: 'boolean',
                description: 'Show detailed configuration status, capabilities matrix, and setup instructions for each provider',
                default: false
              }
            },
            required: []
          }
        },
        {
          name: 'advice',
          description: `Get expert advice from AI models with intelligent routing and automatic capability detection.
Best for: code review, debugging, architecture decisions, implementation guidance, explanations.

Key features:
• Automatic async support for OpenAI models (via Responses API)
• Synchronous execution for other providers (Google, Anthropic, etc.)
• Multi-turn conversation support (OpenAI only)
• Automatic structured output detection - returns JSON when supported
• Smart fallback to text for incompatible models
• Response includes confidence scores and context requests
• Optimized timeouts based on model type
• Request caching and deduplication (OpenAI async mode)

Response formats:
• Structured (when supported): {response_type, response, confidence, context_needed}
• Text fallback: Simple text response with metadata.fallback_mode=true

OpenAI models benefit from:
• Non-blocking operations for long-running tasks
• Poll for completion with request_id
• Conversation context preservation
• Automatic context iteration (max 3 rounds)`,
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: `Model ID format: "provider:model-name"

Examples by use case:
• Fast responses (5-15s): "openai:gpt-4o", "google:gemini-2.5-flash"
• Balanced (15-30s): "openai:gpt-4.1", "anthropic:claude-3-7-sonnet"
• Deep reasoning (60-120s+): "openai:o3", "openai:gpt-5", "google:gemini-2.5-pro"

Performance characteristics:
• gpt-4o, gemini-flash: Instant responses, great for simple queries
• gpt-4.1, claude-sonnet: Good balance of quality and speed
• o3, gpt-5: Maximum intelligence, complex problem solving
• gemini-2.5-pro: Built-in thinking process, excellent for analysis

Choose based on complexity vs speed tradeoff`
              },
              prompt: {
                type: 'string',
                description: `Your question or task for the model.

Tips for better results:
• Be specific and provide context
• Include examples if relevant
• Specify desired output format
• For code: include language and framework
• For debugging: include error messages and stack traces`
              },
              reasoningEffort: {
                type: 'string',
                enum: ['minimal', 'low', 'medium', 'high'],
                description: `Controls reasoning depth for o3/GPT-5 models (ignored by others):

• minimal: Quick analysis, basic logic (~30s) - simple bugs, syntax questions
• low: Standard reasoning, some exploration (~60s) - typical coding tasks
• medium: Deep analysis, multiple approaches (~90s) - complex debugging
• high: Exhaustive reasoning, all angles (~120s+) - architecture decisions

Higher effort = better quality but longer wait
Default: model-specific optimal setting`
              },
              verbosity: {
                type: 'string', 
                enum: ['low', 'medium', 'high'],
                description: `Output detail level for GPT-5 models (ignored by others):

• low: Concise, key points only - quick answers
• medium: Balanced explanation - standard responses  
• high: Detailed with examples - learning/documentation

Default: 'low' for efficiency`
              },
              conversation_id: {
                type: 'string',
                description: `[OpenAI models only] Conversation ID for multi-turn dialogue.
• Auto-generated UUID if not provided
• Preserves context across multiple calls
• Use same ID to continue conversation
• Start fresh conversation with new ID or omit`
              },
              request_id: {
                type: 'number',
                description: `[OpenAI models only] Check status of existing async request.
• Required for polling long-running operations
• Returned in initial response metadata
• Use to retrieve cached results`
              },
              check_status: {
                type: 'boolean',
                description: `[OpenAI models only] Poll for request completion (requires request_id).
Returns current status: pending, complete, or error`,
                default: false
              },
              temperature: {
                type: 'number',
                description: `[OpenAI models only] Response creativity (0-2):
• 0: Deterministic, same response each time
• 0.7: Balanced creativity (default)
• 1.0: Creative responses
• 2.0: Maximum randomness (may be incoherent)`,
                minimum: 0,
                maximum: 2
              },
              max_completion_tokens: {
                type: 'number',
                description: `[OpenAI models only] Output length limit in tokens (~4 chars/token).
• Short answer: 500 tokens
• Standard: 2000 tokens (default)
• Detailed: 4000 tokens
• Maximum: model-specific limit`
              },
              wait_timeout_ms: {
                type: 'number',
                description: `[OpenAI models only] Max wait time before returning pending status.
• Default: 30000ms (30s) for fast models
• Reasoning models auto-extend to 120000ms
• Set lower for quick status checks
• Set higher for guaranteed completion`,
                default: 30000
              }
            },
            required: ['model', 'prompt']
          }
        },
        {
          name: 'idiom',
          description: `Get the idiomatic, ecosystem-aware approach for tasks to prevent "AI slop".
Best for: Preventing custom implementations when established solutions exist.

Key features:
• Enforces ecosystem best practices and conventions
• Recommends existing packages over custom code
• Identifies anti-patterns to avoid
• Provides concrete code examples
• Can reject bad approaches with explanations

Examples:
• "Store global state in React" → Use Zustand, not Context+useReducer
• "Make HTTP requests with retry" → Use axios with axios-retry
• "Interact with Ethereum" → Use viem, never raw JSON-RPC

Requires comprehensive context for best results.`,
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'The task or problem you need to accomplish'
              },
              current_approach: {
                type: 'string',
                description: 'Optional: Current code or approach to evaluate for idiomaticity'
              },
              context: {
                type: 'object',
                description: 'Environment context for accurate recommendations',
                properties: {
                  dependencies: {
                    type: 'string',
                    description: 'package.json, Cargo.toml, requirements.txt, or similar dependency file contents'
                  },
                  framework_config: {
                    type: 'string',
                    description: 'Framework configuration files (next.config.js, vite.config.js, etc.)'
                  },
                  existing_patterns: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Example files showing current code patterns in the project'
                  },
                  language: {
                    type: 'string',
                    description: 'Programming language (typescript, javascript, python, rust, etc.)'
                  },
                  constraints: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Any constraints like "no new dependencies" or "must be synchronous"'
                  }
                }
              },
              model: {
                type: 'string',
                description: 'Optional: Specific model to use for analysis (defaults to gpt-4o)'
              }
            },
            required: ['task']
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
          return await handleUnifiedAdvice(args, this.providers);
        } else if (name === 'idiom') {
          return await handleIdiom(args);
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