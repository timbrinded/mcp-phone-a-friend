export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro']
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
  },
  xai: {
    apiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
    models: ['grok-beta', 'grok-2', 'grok-2-mini']
  }
};