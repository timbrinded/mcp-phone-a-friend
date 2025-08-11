import { type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createXai } from '@ai-sdk/xai';
import { config } from './config.js';

// Type for model factory functions
type ModelFactory = () => LanguageModel;

// Build the model registry based on configured providers
function buildModelRegistry(): Record<string, ModelFactory> {
  const registry: Record<string, ModelFactory> = {};

  // OpenAI models
  if (config.openai.apiKey?.trim()) {
    const openai = createOpenAI({
      apiKey: config.openai.apiKey
    });
    
    config.openai.models.forEach(model => {
      registry[`openai:${model}`] = () => openai(model);
    });
  }

  // Google models
  if (config.google.apiKey?.trim()) {
    const google = createGoogleGenerativeAI({
      apiKey: config.google.apiKey
    });
    
    config.google.models.forEach(model => {
      registry[`google:${model}`] = () => google(model);
    });
  }

  // Anthropic models
  if (config.anthropic.apiKey?.trim()) {
    const anthropic = createAnthropic({
      apiKey: config.anthropic.apiKey
    });
    
    config.anthropic.models.forEach(model => {
      registry[`anthropic:${model}`] = () => anthropic(model);
    });
  }

  // xAI models
  if (config.xai.apiKey?.trim()) {
    const xai = createXai({
      apiKey: config.xai.apiKey
    });
    
    config.xai.models.forEach(model => {
      registry[`xai:${model}`] = () => xai(model);
    });
  }

  return registry;
}

// Export the registry
export const MODEL_REGISTRY = buildModelRegistry();

// Type for valid model IDs
export type ModelId = keyof typeof MODEL_REGISTRY;

// Helper to check if a string is a valid model ID
export function isModelId(value: string): value is ModelId {
  return value in MODEL_REGISTRY;
}

// Helper to get a model instance
export function getModel(modelId: string): LanguageModel | null {
  if (!isModelId(modelId)) {
    return null;
  }
  const factory = MODEL_REGISTRY[modelId];
  return factory();
}

// Helper to list available models
export function listAvailableModels(): string[] {
  return Object.keys(MODEL_REGISTRY);
}

// Helper to get provider info for backward compatibility
export function getProviderInfo(modelId: string): { provider: LanguageModel; models: string[] } | null {
  const model = getModel(modelId);
  if (!model) return null;
  
  const modelName = modelId.split(':')[1];
  return {
    provider: model,
    models: [modelName]
  };
}