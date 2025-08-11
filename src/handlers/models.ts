import type { ProviderInfo } from '../providers.js';

export async function handleListModels(providers: Map<string, ProviderInfo>) {
  const models = Array.from(providers.keys());
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