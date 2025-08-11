// Helper to get first non-empty env var
const getEnvVar = (...vars: (string | undefined)[]): string | undefined => {
  for (const v of vars) {
    if (v && v.trim()) return v;
  }
  return undefined;
};

// Reasoning models that require special parameters
export const reasoningModels = new Set([
  // OpenAI reasoning models
  'o3',
  'o3-mini',
  'o3-pro',
  'o3-pro-2025-06-10',
  'o3-deep-research',
  'o4-mini',
  // GPT-5 reasoning models
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  // Google thinking models
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  // Anthropic hybrid reasoning models
  'claude-opus-4-1-20250805',
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  // XAI reasoning models
  'grok-4',
]);

// Model-specific parameter configurations
export const modelParameters = {
  // OpenAI o-series models
  'o3': { reasoningEffort: 'medium' },
  'o3-mini': { reasoningEffort: 'low' },
  'o3-pro': { reasoningEffort: 'high' },
  'o3-pro-2025-06-10': { reasoningEffort: 'high' },
  'o3-deep-research': { reasoningEffort: 'high' },
  'o4-mini': { reasoningEffort: 'low' },
  // GPT-5 models
  'gpt-5': { reasoningEffort: 'minimal', verbosity: 'medium' },
  'gpt-5-mini': { reasoningEffort: 'minimal', verbosity: 'low' },
  'gpt-5-nano': { reasoningEffort: 'minimal', verbosity: 'low' },
};

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    models: [
      // GPT-5 series (2025 release with reasoning)
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      // GPT-4.1 series (2025 release)
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      // GPT-4o series
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      // O-series reasoning models
      'o3',
      'o3-mini',
      'o3-pro',
      'o3-pro-2025-06-10',
      'o3-deep-research',
      'o4-mini'
    ]
  },
  google: {
    apiKey: getEnvVar(process.env.GOOGLE_API_KEY, process.env.GEMINI_API_KEY),
    models: [
      // Gemini 1.x series
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      // Gemini 2.0 series
      'gemini-2.0-flash',
      'gemini-2.0-flash-preview-image-generation',
      // Gemini 2.5 series (thinking models)
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ]
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    models: [
      // Claude 3 series
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
      'claude-3-7-sonnet-20250219',
      // Claude 4 series (hybrid reasoning)
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514'
    ]
  },
  xai: {
    apiKey: getEnvVar(process.env.XAI_API_KEY, process.env.GROK_API_KEY),
    models: [
      // Grok legacy
      'grok-beta',
      // Grok 2 series
      'grok-2',
      'grok-2-mini',
      // Grok 3 series
      'grok-3',
      'grok-3-mini',
      // Grok 4 series (reasoning)
      'grok-4',
    ]
  }
};