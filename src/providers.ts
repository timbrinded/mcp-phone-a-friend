import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createXai } from '@ai-sdk/xai';
import { config } from './config.js';

export interface ProviderInfo {
  provider: any;
  models: string[];
}

export function setupProviders(): Map<string, ProviderInfo> {
  const providers = new Map<string, ProviderInfo>();

  // OpenAI
  if (config.openai.apiKey) {
    const openai = createOpenAI({
      apiKey: config.openai.apiKey
    });
    
    config.openai.models.forEach(model => {
      providers.set(`openai:${model}`, {
        provider: openai(model),
        models: [model]
      });
    });
  }

  // Google
  if (config.google.apiKey) {
    const google = createGoogleGenerativeAI({
      apiKey: config.google.apiKey
    });
    
    config.google.models.forEach(model => {
      providers.set(`google:${model}`, {
        provider: google(model),
        models: [model]
      });
    });
  }

  // Anthropic
  if (config.anthropic.apiKey) {
    const anthropic = createAnthropic({
      apiKey: config.anthropic.apiKey
    });
    
    config.anthropic.models.forEach(model => {
      providers.set(`anthropic:${model}`, {
        provider: anthropic(model),
        models: [model]
      });
    });
  }

  // XAI (Grok)
  if (config.xai.apiKey) {
    const xai = createXai({
      apiKey: config.xai.apiKey
    });
    
    config.xai.models.forEach(model => {
      providers.set(`xai:${model}`, {
        provider: xai(model),
        models: [model]
      });
    });
  }

  return providers;
}