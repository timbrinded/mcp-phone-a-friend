import { generateText } from 'ai';
import { MCPError, ErrorCode, validateString, wrapProviderError } from '../errors.js';
import { reasoningModels, modelParameters } from '../config.js';
import type { ProviderInfo } from '../providers.js';

export async function handleAdvice(
  args: any,
  providers: Map<string, ProviderInfo>
) {
  const modelName = validateString(args?.model, 'model');
  const prompt = validateString(args?.prompt, 'prompt');
  
  const providerInfo = providers.get(modelName);
  if (!providerInfo) {
    throw new MCPError(
      `Model "${modelName}" not found. Available models: ${Array.from(providers.keys()).join(', ')}`,
      ErrorCode.ModelNotFound,
      { requestedModel: modelName, availableModels: Array.from(providers.keys()) }
    );
  }
  
  try {
    const baseModelName = modelName.split(':')[1];
    const isReasoningModel = reasoningModels.has(baseModelName);
    const defaultParams = modelParameters[baseModelName] || {};
    
    // Build parameters based on model capabilities
    const params: any = {
      model: providerInfo.provider,
      prompt,
      maxRetries: 2
    };
    
    // Handle reasoning effort for reasoning models
    if (isReasoningModel && modelName.startsWith('openai:')) {
      const reasoningEffort = args?.reasoningEffort || defaultParams.reasoningEffort;
      if (reasoningEffort) {
        params.experimental_providerMetadata = {
          openai: { reasoningEffort }
        };
      }
    }
    
    // Handle verbosity for GPT-5 models
    if (baseModelName.startsWith('gpt-5') && modelName.startsWith('openai:')) {
      const verbosity = args?.verbosity || defaultParams.verbosity;
      if (verbosity) {
        if (!params.experimental_providerMetadata) {
          params.experimental_providerMetadata = { openai: {} };
        }
        params.experimental_providerMetadata.openai.verbosity = verbosity;
      }
    }
    
    const result = await generateText(params);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: result.text
        }
      ]
    };
  } catch (error) {
    throw wrapProviderError(error, modelName);
  }
}