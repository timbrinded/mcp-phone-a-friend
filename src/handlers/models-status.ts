import { config } from '../config.js';
import type { ProviderInfo } from '../providers.js';

export async function handleModelsStatus(providers: Map<string, ProviderInfo>) {
  const isConfigured = (apiKey: string | undefined) => !!(apiKey && apiKey.trim());
  
  const status = {
    providers: {
      openai: {
        configured: isConfigured(config.openai.apiKey),
        models: config.openai.models,
        apiKey: isConfigured(config.openai.apiKey) ? 'Configured ✓' : 'Missing - Set OPENAI_API_KEY',
        available: config.openai.models.map(m => `openai:${m}`).filter(m => providers.has(m))
      },
      google: {
        configured: isConfigured(config.google.apiKey),
        models: config.google.models,
        apiKey: isConfigured(config.google.apiKey) ? 'Configured ✓' : 'Missing - Set GOOGLE_API_KEY or GEMINI_API_KEY',
        available: config.google.models.map(m => `google:${m}`).filter(m => providers.has(m))
      },
      anthropic: {
        configured: isConfigured(config.anthropic.apiKey),
        models: config.anthropic.models,
        apiKey: isConfigured(config.anthropic.apiKey) ? 'Configured ✓' : 'Missing - Set ANTHROPIC_API_KEY',
        available: config.anthropic.models.map(m => `anthropic:${m}`).filter(m => providers.has(m))
      },
      xai: {
        configured: isConfigured(config.xai.apiKey),
        models: config.xai.models,
        apiKey: isConfigured(config.xai.apiKey) ? 'Configured ✓' : 'Missing - Set XAI_API_KEY or GROK_API_KEY',
        available: config.xai.models.map(m => `xai:${m}`).filter(m => providers.has(m))
      }
    },
    summary: {
      totalProvidersConfigured: Object.values({
        openai: isConfigured(config.openai.apiKey),
        google: isConfigured(config.google.apiKey),
        anthropic: isConfigured(config.anthropic.apiKey),
        xai: isConfigured(config.xai.apiKey)
      }).filter(Boolean).length,
      totalModelsAvailable: providers.size,
      readyToUse: providers.size > 0
    },
    quickSetup: providers.size === 0 ? [
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