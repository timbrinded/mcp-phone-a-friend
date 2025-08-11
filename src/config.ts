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
  parameters?: {
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
  };
}

// Single source of truth for all models
const MODEL_REGISTRY: ModelDefinition[] = [
  // OpenAI Models
  // GPT-5 series (2025 release with reasoning)
  { provider: 'openai', name: 'gpt-5', reasoning: true, parameters: { reasoningEffort: 'high', verbosity: 'high' } },
  { provider: 'openai', name: 'gpt-5-mini', reasoning: true, parameters: { reasoningEffort: 'high', verbosity: 'low' } },
  { provider: 'openai', name: 'gpt-5-nano', reasoning: true, parameters: { reasoningEffort: 'high', verbosity: 'low' } },
  
  // GPT-4.1 series (2025 release)
  { provider: 'openai', name: 'gpt-4.1' },
  { provider: 'openai', name: 'gpt-4.1-mini' },
  { provider: 'openai', name: 'gpt-4.1-nano' },
  
  // GPT-4o series
  { provider: 'openai', name: 'gpt-4o' },
  { provider: 'openai', name: 'gpt-4o-mini' },
  { provider: 'openai', name: 'gpt-4-turbo' },
  { provider: 'openai', name: 'gpt-3.5-turbo' },
  
  // O-series reasoning models
  { provider: 'openai', name: 'o3', reasoning: true, parameters: { reasoningEffort: 'medium' } },
  { provider: 'openai', name: 'o3-mini', reasoning: true, parameters: { reasoningEffort: 'low' } },
  { provider: 'openai', name: 'o3-pro', reasoning: true, parameters: { reasoningEffort: 'high' } },
  { provider: 'openai', name: 'o3-pro-2025-06-10', reasoning: true, parameters: { reasoningEffort: 'high' } },
  { provider: 'openai', name: 'o3-deep-research', reasoning: true, parameters: { reasoningEffort: 'high' } },
  { provider: 'openai', name: 'o4-mini', reasoning: true, parameters: { reasoningEffort: 'low' } },
  
  // Google Models
  // Gemini 1.x series
  { provider: 'google', name: 'gemini-1.5-pro' },
  { provider: 'google', name: 'gemini-1.5-flash' },
  { provider: 'google', name: 'gemini-1.0-pro' },
  
  // Gemini 2.0 series
  { provider: 'google', name: 'gemini-2.0-flash' },
  { provider: 'google', name: 'gemini-2.0-flash-preview-image-generation' },
  
  // Gemini 2.5 series (thinking models)
  { provider: 'google', name: 'gemini-2.5-pro', reasoning: true },
  { provider: 'google', name: 'gemini-2.5-flash', reasoning: true },
  { provider: 'google', name: 'gemini-2.5-flash-lite' },
  
  // Anthropic Models
  // Claude 3 series
  { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' },
  { provider: 'anthropic', name: 'claude-3-5-haiku-20241022' },
  { provider: 'anthropic', name: 'claude-3-opus-20240229' },
  { provider: 'anthropic', name: 'claude-3-haiku-20240307' },
  { provider: 'anthropic', name: 'claude-3-7-sonnet-20250219' },
  
  // Claude 4 series (hybrid reasoning)
  { provider: 'anthropic', name: 'claude-opus-4-1-20250805', reasoning: true },
  { provider: 'anthropic', name: 'claude-opus-4-20250514', reasoning: true },
  { provider: 'anthropic', name: 'claude-sonnet-4-20250514', reasoning: true },
  
  // XAI Models
  // Grok legacy
  { provider: 'xai', name: 'grok-beta' },
  
  // Grok 2 series
  { provider: 'xai', name: 'grok-2' },
  { provider: 'xai', name: 'grok-2-mini' },
  
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

export const modelParameters = Object.fromEntries(
  MODEL_REGISTRY
    .filter(m => m.parameters)
    .map(m => [m.name, m.parameters!])
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