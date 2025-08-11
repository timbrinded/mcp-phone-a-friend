import OpenAI from 'openai';

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for async responses');
  }
  return new OpenAI({ apiKey });
};

// Models that support the Responses API
export const RESPONSES_API_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-11-20',
  'gpt-4o-2024-08-06',
  'gpt-4o-audio-preview',
  'gpt-4o-audio-preview-2024-12-17',
  'o1',
  'o1-mini',
  'o1-preview',
  'o3',
  'o3-mini'
]);

export type CreateResponseParams = {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  max_completion_tokens?: number;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
  useResponsesAPI?: boolean; // Explicitly control whether to use Responses API
};

export type ResponseStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface OpenAIResponsesAPIResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  status: ResponseStatus;
  output?: Array<{
    id: string;
    type: string;
    status: string;
    role: string;
    content: Array<{
      type: string;
      text: string;
      annotations?: any[];
      logprobs?: any[];
    }>;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

export interface AsyncResponse {
  id: string;
  status: ResponseStatus;
  created_at: number;
  metadata?: Record<string, any>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  // When completed
  choices?: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  // When failed
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

/**
 * Create an async response using OpenAI's Responses API
 * This uses the /v1/responses endpoint for models that support it
 */
export async function createAsyncResponse(params: CreateResponseParams): Promise<AsyncResponse> {
  const client = getOpenAIClient();
  
  // Check if model supports Responses API
  const supportsResponsesAPI = params.useResponsesAPI !== false && 
                               RESPONSES_API_MODELS.has(params.model);
  
  if (supportsResponsesAPI) {
    // Use the Responses API endpoint
    try {
      // Convert messages to Responses API input format
      const input = params.messages.map(msg => ({
        role: msg.role,
        content: [{ type: 'input_text', text: msg.content }]
      }));
      
      // Build request body for Responses API
      const requestBody: any = {
        model: params.model,
        input,
        stream: false, // Disable streaming for async polling
        temperature: params.temperature,
        top_p: params.top_p,
        max_output_tokens: params.max_completion_tokens // Note: different parameter name in Responses API
      };
      
      // Add reasoning effort for o1/o3 models
      if (params.reasoning_effort && (params.model.includes('o1') || params.model.includes('o3'))) {
        requestBody.reasoning = {
          effort: params.reasoning_effort
        };
      }
      
      // Make request to Responses API
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error((errorData as any).error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as OpenAIResponsesAPIResponse;
      
      // Convert to our AsyncResponse format
      let content = '';
      let role = 'assistant';
      
      if (data.output && Array.isArray(data.output) && data.output.length > 0) {
        const firstMessage = data.output[0];
        role = firstMessage.role || 'assistant';
        
        if (firstMessage.content && Array.isArray(firstMessage.content)) {
          content = firstMessage.content
            .filter((c: any) => c.type === 'output_text' && c.text)
            .map((c: any) => c.text)
            .join('');
        }
      }
      
      return {
        id: data.id,
        status: data.status,
        created_at: data.created_at * 1000, // Convert to milliseconds
        metadata: params.metadata,
        usage: data.usage,
        choices: content ? [{
          index: 0,
          message: {
            role,
            content
          },
          finish_reason: 'stop'
        }] : undefined,
        error: data.error
      };
    } catch (error: any) {
      console.error('Responses API error:', error);
      // Fall back to regular API
      return executeOpenAIRequest(params);
    }
  } else {
    // Use regular Chat Completions API
    return executeOpenAIRequest(params);
  }
}

/**
 * Poll for response status using GET /v1/responses/{id}
 */
export async function getResponseById(id: string): Promise<AsyncResponse> {
  try {
    const response = await fetch(`https://api.openai.com/v1/responses/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error((errorData as any).error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as OpenAIResponsesAPIResponse;
    
    // Convert to our AsyncResponse format
    let content = '';
    let role = 'assistant';
    
    if (data.output && Array.isArray(data.output) && data.output.length > 0) {
      const firstMessage = data.output[0];
      role = firstMessage.role || 'assistant';
      
      if (firstMessage.content && Array.isArray(firstMessage.content)) {
        content = firstMessage.content
          .filter((c: any) => c.type === 'output_text' && c.text)
          .map((c: any) => c.text)
          .join('');
      }
    }
    
    return {
      id: data.id,
      status: data.status,
      created_at: data.created_at * 1000,
      usage: data.usage,
      choices: content ? [{
        index: 0,
        message: {
          role,
          content
        },
        finish_reason: 'stop'
      }] : undefined,
      error: data.error
    };
  } catch (error: any) {
    return {
      id,
      status: 'failed',
      created_at: Date.now(),
      error: {
        message: error.message || 'Failed to retrieve response',
        type: 'api_error'
      }
    };
  }
}

/**
 * Execute a synchronous OpenAI request (for immediate responses)
 * This is what we'll actually use behind the scenes until OpenAI has a proper async API
 */
export async function executeOpenAIRequest(params: CreateResponseParams): Promise<AsyncResponse> {
  const client = getOpenAIClient();
  
  try {
    // Build the request parameters
    const requestParams: any = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_completion_tokens: params.max_completion_tokens,
    };

    // Add reasoning effort for o3/o1 models
    if (params.reasoning_effort && (params.model.includes('o3') || params.model.includes('o1'))) {
      requestParams.reasoning_effort = params.reasoning_effort;
    }

    // Add verbosity for GPT-5 models
    if (params.verbosity && params.model.includes('gpt-5')) {
      requestParams.verbosity = params.verbosity;
    }

    const completion = await client.chat.completions.create(requestParams);
    
    return {
      id: completion.id,
      status: 'completed',
      created_at: Date.now(),
      metadata: params.metadata,
      usage: completion.usage ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      } : undefined,
      choices: completion.choices.map(choice => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content || ''
        },
        finish_reason: choice.finish_reason || 'stop'
      }))
    };
  } catch (error: any) {
    return {
      id: `error_${Date.now()}`,
      status: 'failed',
      created_at: Date.now(),
      metadata: params.metadata,
      error: {
        message: error.message || 'Unknown error',
        type: error.type,
        code: error.code
      }
    };
  }
}