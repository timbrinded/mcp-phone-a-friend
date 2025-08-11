import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { MCPError, ErrorCode, validateString } from '../errors.js';
import { getModel, isModelId, MODEL_REGISTRY } from '../model-registry.js';
import { handleAIError, getRetryInfo } from '../utils/errors.js';
import { withTimeout, getTimeoutsForModel } from '../utils/optimization.js';

// Schema for the idiom response
const IdiomResponseSchema = z.object({
  approach: z.string().describe('The idiomatic way to accomplish this task using existing ecosystem tools'),
  packages_to_use: z.array(z.string()).describe('Existing packages from dependencies or recommended packages to use'),
  anti_patterns: z.array(z.string()).describe('Common mistakes and what NOT to do'),
  example_code: z.string().describe('Concrete code example showing the idiomatic approach'),
  rationale: z.string().describe('Why this is the correct approach in this ecosystem'),
  references: z.array(z.string()).optional().describe('Links to documentation or popular repos using this pattern')
});

type IdiomResponse = z.infer<typeof IdiomResponseSchema>;

function analyzeContext(context: any): {
  ecosystem: string;
  existingPackages: string[];
  framework?: string;
} {
  const deps = context.dependencies || '';
  const existingPackages: string[] = [];
  let ecosystem = 'javascript'; // default
  let framework: string | undefined;

  // Parse package.json if provided
  if (deps.includes('"dependencies"') || deps.includes('"devDependencies"')) {
    try {
      const parsed = JSON.parse(deps);
      const allDeps = {
        ...parsed.dependencies,
        ...parsed.devDependencies
      };
      existingPackages.push(...Object.keys(allDeps));

      // Detect ecosystem and framework
      if (allDeps.react) {
        ecosystem = 'react';
        framework = 'react';
        if (allDeps['next']) framework = 'nextjs';
        if (allDeps['remix']) framework = 'remix';
      } else if (allDeps.vue) {
        ecosystem = 'vue';
        framework = 'vue';
      } else if (allDeps.express || allDeps.fastify || allDeps.koa) {
        ecosystem = 'nodejs';
        framework = Object.keys(allDeps).find(k => ['express', 'fastify', 'koa'].includes(k));
      } else if (allDeps.viem || allDeps.ethers || allDeps['web3']) {
        ecosystem = 'ethereum';
      }
    } catch (e) {
      // If parsing fails, continue with text analysis
    }
  }

  // Cargo.toml detection
  if (deps.includes('[dependencies]') && deps.includes('tokio')) {
    ecosystem = 'rust';
  }

  // Python detection (requirements.txt or pyproject.toml)
  if (deps.includes('django') || deps.includes('flask') || deps.includes('fastapi')) {
    ecosystem = 'python';
    framework = deps.includes('django') ? 'django' : deps.includes('flask') ? 'flask' : 'fastapi';
  }

  return { ecosystem, existingPackages, framework };
}

export async function handleIdiom(args: any) {
  const task = validateString(args?.task, 'task');
  const context = args?.context || {};
  const currentApproach = args?.current_approach;

  // Analyze the provided context
  const { ecosystem, existingPackages, framework } = analyzeContext(context);

  // Build a comprehensive prompt
  const systemPrompt = `You are an expert software architect who deeply understands ecosystem best practices and idiomatic patterns.
Your role is to prevent "AI slop" - custom implementations when battle-tested solutions exist.

Current ecosystem: ${ecosystem}
${framework ? `Framework: ${framework}` : ''}
Existing dependencies: ${existingPackages.join(', ') || 'none specified'}

Core principles:
1. ALWAYS prefer established packages over custom implementations
2. Follow framework conventions religiously  
3. Use patterns the community has converged on
4. Reject anti-patterns even if they "work"
5. Prioritize maintainability and ecosystem compatibility

You must be prescriptive and opinionated. If asked to do something the wrong way, explain why it's wrong and provide the correct approach.`;

  const prompt = `Task: ${task}

${currentApproach ? `Current approach being evaluated:\n${currentApproach}\n` : ''}

Context provided:
- Language/Ecosystem: ${context.language || ecosystem}
- Dependencies: ${context.dependencies ? 'Provided' : 'Not provided'}
- Framework config: ${context.framework_config ? 'Provided' : 'Not provided'}
- Constraints: ${context.constraints?.join(', ') || 'None specified'}

Analyze this task and provide the idiomatic way to accomplish it in this ecosystem. Be specific about which packages to use and why.`;

  // Select an appropriate model - we want one with good structured output
  const modelId = args?.model || 'openai:gpt-4o';
  
  // Check if model exists in registry
  if (!isModelId(modelId)) {
    // Fallback to first available model
    const availableModels = Object.keys(MODEL_REGISTRY);
    if (availableModels.length === 0) {
      throw new MCPError(
        'No AI providers configured',
        ErrorCode.InvalidRequest
      );
    }
    
    const fallbackModelId = availableModels[0];
    const model = getModel(fallbackModelId);
    
    if (!model) {
      throw new MCPError(
        'Failed to load fallback model',
        ErrorCode.InternalError
      );
    }
    
    try {
      const result = await withTimeout(
        generateObject({
          model,
          system: systemPrompt,
          prompt,
          schema: IdiomResponseSchema as any,
          maxRetries: 2
        }),
        30000,
        'Idiom analysis timed out'
      );

      const response = result.object as IdiomResponse;

      return {
        content: [
          {
            type: 'text' as const,
            text: formatIdiomResponse(response)
          }
        ],
        metadata: {
          ecosystem,
          framework,
          existing_packages: existingPackages,
          model_used: fallbackModelId
        }
      };
    } catch (error) {
      // If structured output fails, try text mode
      try {
        const result = await generateText({
          model,
          system: systemPrompt,
          prompt: prompt + '\n\nProvide your response in a clear, structured format.',
          maxRetries: 2
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: result.text
            }
          ],
          metadata: {
            ecosystem,
            framework,
            existing_packages: existingPackages,
            model_used: fallbackModelId,
            fallback_mode: true
          }
        };
      } catch (textError) {
        handleAIError(textError, fallbackModelId);
      }
    }
  }

  // Use the specified model
  const model = getModel(modelId);
  
  if (!model) {
    throw new MCPError(
      `Model "${modelId}" not found. Available models: ${Object.keys(MODEL_REGISTRY).join(', ')}`,
      ErrorCode.ModelNotFound,
      { 
        requestedModel: modelId,
        availableModels: Object.keys(MODEL_REGISTRY)
      }
    );
  }

  try {
    const timeouts = getTimeoutsForModel(modelId);
    
    const result = await withTimeout(
      generateObject({
        model,
        system: systemPrompt,
        prompt,
        schema: IdiomResponseSchema as any,
        maxRetries: 2
      }),
      timeouts.structured || 30000,
      'Idiom analysis timed out'
    );

    const response = result.object as IdiomResponse;

    return {
      content: [
        {
          type: 'text' as const,
          text: formatIdiomResponse(response)
        }
      ],
      metadata: {
        ecosystem,
        framework,
        existing_packages: existingPackages,
        model_used: modelId
      }
    };
  } catch (error) {
    // Check if we should retry
    const retryInfo = getRetryInfo(error);
    
    if (retryInfo.shouldRetry && args?.allowRetry !== false) {
      // Wait and retry once
      await new Promise(resolve => setTimeout(resolve, retryInfo.retryAfter || 1000));
      
      try {
        const result = await generateObject({
          model,
          system: systemPrompt,
          prompt,
          schema: IdiomResponseSchema as any,
          maxRetries: 1
        });

        const response = result.object as IdiomResponse;

        return {
          content: [
            {
              type: 'text' as const,
              text: formatIdiomResponse(response)
            }
          ],
          metadata: {
            ecosystem,
            framework,
            existing_packages: existingPackages,
            model_used: modelId,
            retried: true
          }
        };
      } catch (retryError) {
        // If retry also fails, fall back to text
        try {
          const result = await generateText({
            model,
            system: systemPrompt,
            prompt: prompt + '\n\nProvide your response in a clear, structured format.',
            maxRetries: 1
          });

          return {
            content: [
              {
                type: 'text' as const,
                text: result.text
              }
            ],
            metadata: {
              ecosystem,
              framework,
              existing_packages: existingPackages,
              model_used: modelId,
              fallback_mode: true,
              retried: true
            }
          };
        } catch (finalError) {
          handleAIError(finalError, modelId);
        }
      }
    }
    
    // If not retryable or retry disabled, try text fallback
    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: prompt + '\n\nProvide your response in a clear, structured format.',
        maxRetries: 2
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: result.text
          }
        ],
        metadata: {
          ecosystem,
          framework,
          existing_packages: existingPackages,
          model_used: modelId,
          fallback_mode: true
        }
      };
    } catch (textError) {
      handleAIError(textError, modelId);
    }
  }
}

function formatIdiomResponse(response: IdiomResponse): string {
  let formatted = `## Idiomatic Approach\n\n${response.approach}\n\n`;
  
  if (response.packages_to_use.length > 0) {
    formatted += `### Packages to Use\n`;
    response.packages_to_use.forEach(pkg => {
      formatted += `- ${pkg}\n`;
    });
    formatted += '\n';
  }

  if (response.anti_patterns.length > 0) {
    formatted += `### ❌ Anti-Patterns to Avoid\n`;
    response.anti_patterns.forEach(pattern => {
      formatted += `- ${pattern}\n`;
    });
    formatted += '\n';
  }

  formatted += `### Example Implementation\n\`\`\`\n${response.example_code}\n\`\`\`\n\n`;
  
  formatted += `### Rationale\n${response.rationale}\n`;

  if (response.references && response.references.length > 0) {
    formatted += `\n### References\n`;
    response.references.forEach(ref => {
      formatted += `- ${ref}\n`;
    });
  }

  return formatted;
}