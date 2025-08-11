// Helper to get first non-empty env var
const getEnvVar = (...vars: (string | undefined)[]): string | undefined => {
  for (const v of vars) {
    if (v && v.trim()) return v;
  }
  return undefined;
};

// Model type definition for better type safety
interface ModelDefinition {
  provider: 'openai' | 'google' | 'anthropic' | 'xai';
  name: string;
  reasoning?: boolean;
  structuredOutput?: boolean;
  parameters?: {
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
  };
  // Enhanced capability metadata
  capabilities?: {
    speed: 'instant' | 'fast' | 'standard' | 'slow';  // Response time expectation
    intelligence: 'basic' | 'good' | 'advanced' | 'maximum';  // Problem-solving ability
    contextWindow?: number;  // Max context tokens
    vision?: boolean;  // Can process images
    audio?: boolean;  // Can process audio
    bestFor?: string[];  // Ideal use cases
    responseTime?: string;  // Typical response time range
  };
}

// Single source of truth for all models
const MODEL_REGISTRY: ModelDefinition[] = [
  // OpenAI Models
  // GPT-5 series (2025 release with reasoning)
  { 
    provider: 'openai', 
    name: 'gpt-5', 
    reasoning: true, 
    structuredOutput: true, 
    parameters: { reasoningEffort: 'high', verbosity: 'low' },
    capabilities: {
      speed: 'slow',
      intelligence: 'maximum',
      contextWindow: 200000,
      vision: true,
      bestFor: ['complex reasoning', 'architecture design', 'difficult debugging'],
      responseTime: '60-120s'
    }
  },
  { 
    provider: 'openai', 
    name: 'gpt-5-mini', 
    reasoning: true, 
    structuredOutput: true, 
    parameters: { reasoningEffort: 'high', verbosity: 'low' },
    capabilities: {
      speed: 'standard',
      intelligence: 'advanced',
      contextWindow: 200000,
      vision: true,
      bestFor: ['balanced reasoning', 'code review', 'problem solving'],
      responseTime: '30-60s'
    }
  },
  { 
    provider: 'openai', 
    name: 'gpt-5-nano', 
    reasoning: true, 
    structuredOutput: true, 
    parameters: { reasoningEffort: 'high', verbosity: 'low' },
    capabilities: {
      speed: 'fast',
      intelligence: 'good',
      contextWindow: 200000,
      bestFor: ['quick reasoning', 'simple analysis'],
      responseTime: '15-30s'
    }
  },
  
  // GPT-4.1 series (2025 release)
  { 
    provider: 'openai', 
    name: 'gpt-4.1', 
    structuredOutput: true,
    capabilities: {
      speed: 'standard',
      intelligence: 'advanced',
      contextWindow: 1000000,
      vision: true,
      bestFor: ['general tasks', 'code generation', 'analysis'],
      responseTime: '15-30s'
    }
  },
  { provider: 'openai', name: 'gpt-4.1-mini', structuredOutput: true },
  { provider: 'openai', name: 'gpt-4.1-nano', structuredOutput: true },
  
  // GPT-4o series
  { 
    provider: 'openai', 
    name: 'gpt-4o', 
    structuredOutput: true,
    capabilities: {
      speed: 'instant',
      intelligence: 'good',
      contextWindow: 128000,
      vision: true,
      audio: true,
      bestFor: ['quick responses', 'simple tasks', 'real-time interaction'],
      responseTime: '5-15s'
    }
  },
  
  // O-series reasoning models
  { 
    provider: 'openai', 
    name: 'o3', 
    reasoning: true, 
    parameters: { reasoningEffort: 'medium' },
    capabilities: {
      speed: 'slow',
      intelligence: 'maximum',
      contextWindow: 200000,
      bestFor: ['complex logic', 'mathematical proofs', 'deep analysis'],
      responseTime: '60-90s'
    }
  },
  { 
    provider: 'openai', 
    name: 'o3-mini', 
    reasoning: true, 
    parameters: { reasoningEffort: 'low' },
    capabilities: {
      speed: 'standard',
      intelligence: 'advanced',
      contextWindow: 200000,
      bestFor: ['moderate reasoning', 'code debugging', 'optimization'],
      responseTime: '30-60s'
    }
  },
  { 
    provider: 'openai', 
    name: 'o3-pro', 
    reasoning: true, 
    parameters: { reasoningEffort: 'high' },
    capabilities: {
      speed: 'slow',
      intelligence: 'maximum',
      contextWindow: 200000,
      bestFor: ['critical decisions', 'complex architecture', 'research'],
      responseTime: '90-120s+'
    }
  },
  { provider: 'openai', name: 'o3-pro-2025-06-10', reasoning: true, parameters: { reasoningEffort: 'high' } },
  { provider: 'openai', name: 'o3-deep-research', reasoning: true, parameters: { reasoningEffort: 'high' } },
  { provider: 'openai', name: 'o4-mini', reasoning: true, parameters: { reasoningEffort: 'low' } },
  
  // Google Models
  // Gemini 1.x series
  { provider: 'google', name: 'gemini-1.5-pro', structuredOutput: true },
  { provider: 'google', name: 'gemini-1.5-flash', structuredOutput: true },
  { provider: 'google', name: 'gemini-1.0-pro', structuredOutput: true },
  
  // Gemini 2.0 series
  { provider: 'google', name: 'gemini-2.0-flash', structuredOutput: true },
  { provider: 'google', name: 'gemini-2.0-flash-preview-image-generation', structuredOutput: true },
  
  // Gemini 2.5 series (thinking models)
  { 
    provider: 'google', 
    name: 'gemini-2.5-pro', 
    reasoning: true, 
    structuredOutput: true,
    capabilities: {
      speed: 'slow',
      intelligence: 'maximum',
      contextWindow: 1000000,
      vision: true,
      bestFor: ['deep thinking', 'complex analysis', 'research'],
      responseTime: '60-120s'
    }
  },
  { 
    provider: 'google', 
    name: 'gemini-2.5-flash', 
    reasoning: true, 
    structuredOutput: true,
    capabilities: {
      speed: 'instant',
      intelligence: 'advanced',
      contextWindow: 1000000,
      vision: true,
      bestFor: ['fast thinking', 'quick analysis', 'rapid iteration'],
      responseTime: '5-15s'
    }
  },
  { provider: 'google', name: 'gemini-2.5-flash-lite', structuredOutput: true },
  
  // Anthropic Models
  // Claude 3 series
  { 
    provider: 'anthropic', 
    name: 'claude-3-5-sonnet-20241022', 
    structuredOutput: true,
    capabilities: {
      speed: 'fast',
      intelligence: 'advanced',
      contextWindow: 200000,
      vision: true,
      bestFor: ['code generation', 'detailed analysis', 'writing'],
      responseTime: '10-20s'
    }
  },
  { provider: 'anthropic', name: 'claude-3-5-haiku-20241022', structuredOutput: true },
  { provider: 'anthropic', name: 'claude-3-opus-20240229', structuredOutput: true },
  { provider: 'anthropic', name: 'claude-3-haiku-20240307', structuredOutput: true },
  { 
    provider: 'anthropic', 
    name: 'claude-3-7-sonnet-20250219', 
    structuredOutput: true,
    capabilities: {
      speed: 'standard',
      intelligence: 'advanced',
      contextWindow: 200000,
      vision: true,
      bestFor: ['balanced tasks', 'code review', 'documentation'],
      responseTime: '15-30s'
    }
  },
  
  // Claude 4 series (hybrid reasoning)
  { provider: 'anthropic', name: 'claude-opus-4-1-20250805', reasoning: true, structuredOutput: true },
  { provider: 'anthropic', name: 'claude-opus-4-20250514', reasoning: true, structuredOutput: true },
  { provider: 'anthropic', name: 'claude-sonnet-4-20250514', reasoning: true, structuredOutput: true },
  
  // XAI Models
  // Grok legacy
  { provider: 'xai', name: 'grok-beta' },
  
  // Grok 2 series
  { provider: 'xai', name: 'grok-2' },
  
  // Grok 3 series
  { provider: 'xai', name: 'grok-3' },
  { provider: 'xai', name: 'grok-3-mini' },
  
  // Grok 4 series (reasoning)
  { provider: 'xai', name: 'grok-4', reasoning: true },
];

// Build derived structures from the registry
export const reasoningModels = new Set(
  MODEL_REGISTRY
    .filter(m => m.reasoning)
    .map(m => m.name)
);

export const structuredOutputModels = new Set(
  MODEL_REGISTRY
    .filter(m => m.structuredOutput)
    .map(m => m.name)
);

export const modelParameters = Object.fromEntries(
  MODEL_REGISTRY
    .filter(m => m.parameters)
    .map(m => [m.name, m.parameters!])
);

// Export model capabilities for use in handlers
export const modelCapabilities = Object.fromEntries(
  MODEL_REGISTRY
    .filter(m => m.capabilities)
    .map(m => [m.name, m.capabilities!])
);

// Group models by provider
const modelsByProvider = MODEL_REGISTRY.reduce((acc, model) => {
  if (!acc[model.provider]) {
    acc[model.provider] = [];
  }
  acc[model.provider].push(model.name);
  return acc;
}, {} as Record<string, string[]>);

// Build the config object from the registry
export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    models: modelsByProvider.openai || []
  },
  google: {
    apiKey: getEnvVar(process.env.GOOGLE_API_KEY, process.env.GEMINI_API_KEY),
    models: modelsByProvider.google || []
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    models: modelsByProvider.anthropic || []
  },
  xai: {
    apiKey: getEnvVar(process.env.XAI_API_KEY, process.env.GROK_API_KEY),
    models: modelsByProvider.xai || []
  }
};

// Export the registry for easy model addition
export { MODEL_REGISTRY };

// Helper function to add a new model (for runtime additions if needed)
export function addModel(model: ModelDefinition) {
  MODEL_REGISTRY.push(model);
  
  // Update derived structures
  if (model.reasoning) {
    reasoningModels.add(model.name);
  }
  if (model.parameters) {
    modelParameters[model.name] = model.parameters;
  }
  
  // Update config
  if (!config[model.provider].models.includes(model.name)) {
    config[model.provider].models.push(model.name);
  }
}