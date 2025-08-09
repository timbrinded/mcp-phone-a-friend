// Helper to get first non-empty env var
const getEnvVar = (...vars: (string | undefined)[]): string | undefined => {
  for (const v of vars) {
    if (v && v.trim()) return v;
  }
  return undefined;
};

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    // Keep legacy IDs for tests; add latest reasoning models
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      // Latest OpenAI reasoning/general models (additive)
      'o3',
      'o3-mini',
      'o3-pro',
      'o4',
      'o4-mini'
    ]
  },
  google: {
    apiKey: getEnvVar(process.env.GOOGLE_API_KEY, process.env.GEMINI_API_KEY),
    // Keep legacy stable IDs; add Gemini 2.x series
    models: [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      // Latest Gemini 2.x (stable/preview identifiers as per docs)
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash'
    ]
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Keep legacy IDs for tests; add Claude 4 series snapshots/aliases
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
      // Newer Claude models (additive)
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-haiku-20241022'
    ]
  },
  xai: {
    apiKey: getEnvVar(process.env.XAI_API_KEY, process.env.GROK_API_KEY),
    // Keep legacy IDs for tests; add latest Grok models
    models: [
      'grok-beta',
      'grok-2',
      'grok-2-mini',
      // Latest Grok
      'grok-4',
      'grok-3',
      'grok-3-mini'
    ]
  }
};