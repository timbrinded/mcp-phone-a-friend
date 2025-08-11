import pLimit from 'p-limit';

export const providerConcurrency = new Map([
  ['openai', pLimit(8)],
  ['google', pLimit(6)],
  ['anthropic', pLimit(6)],
  ['xai', pLimit(4)]
]);

export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  
  constructor(private ttlMs: number) {}
  
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs
    });
  }
  
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

export const inflightDetection = new Map<string, Promise<boolean>>();

export async function detectStructuredSupport(
  modelName: string,
  detector: () => Promise<boolean>,
  cache: TTLCache<string, boolean>
): Promise<boolean> {
  const cached = cache.get(modelName);
  if (cached !== undefined) return cached;
  
  let promise = inflightDetection.get(modelName);
  if (!promise) {
    promise = (async () => {
      try {
        const supported = await detector();
        cache.set(modelName, supported);
        return supported;
      } catch {
        cache.set(modelName, false);
        return false;
      } finally {
        inflightDetection.delete(modelName);
      }
    })();
    inflightDetection.set(modelName, promise);
  }
  
  return promise;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function exponentialBackoff(attempt: number, baseMs = 150): number {
  const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
  return Math.min(2000, Math.floor(Math.pow(2, attempt) * baseMs * jitter));
}

// Model-specific timeout configurations
export const MODEL_TIMEOUTS = {
  // Reasoning models need much more time
  reasoning: {
    detection: 10000,     // 10s for detection
    structured: 120000,   // 2 minutes for structured output
    overall: 180000,      // 3 minutes overall
    models: ['o3', 'o3-mini', 'o3-pro', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano']
  },
  // Standard models
  standard: {
    detection: 5000,      // 5s for detection
    structured: 60000,    // 1 minute for structured output
    overall: 90000,       // 1.5 minutes overall
    models: ['gpt-4', 'gpt-4.1', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'grok-3']
  },
  // Fast models
  fast: {
    detection: 3000,      // 3s for detection
    structured: 30000,    // 30s for structured output
    overall: 45000,       // 45s overall
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano', 'claude-3-5-haiku', 'gemini-1.5-flash', 'gpt-3.5-turbo', 'haiku', 'flash']
  },
  // Default fallback
  default: {
    detection: 5000,
    structured: 60000,
    overall: 90000
  }
};

export function getTimeoutsForModel(modelName: string): typeof MODEL_TIMEOUTS.default {
  const baseModel = modelName.split(':')[1] || modelName;
  const lowerModel = baseModel.toLowerCase();
  
  // Check fast models first (more specific matches)
  if (MODEL_TIMEOUTS.fast.models.some(m => lowerModel.includes(m.toLowerCase()))) {
    return MODEL_TIMEOUTS.fast;
  }
  
  // Check reasoning models
  if (MODEL_TIMEOUTS.reasoning.models.some(m => lowerModel.includes(m.toLowerCase()))) {
    return MODEL_TIMEOUTS.reasoning;
  }
  
  // Check standard models
  if (MODEL_TIMEOUTS.standard.models.some(m => lowerModel.includes(m.toLowerCase()))) {
    return MODEL_TIMEOUTS.standard;
  }
  
  return MODEL_TIMEOUTS.default;
}

export interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  shouldRetry?: (error: any) => boolean;
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    timeoutMs = 90000,  // Increased default from 30s to 90s
    signal: parentSignal,
    shouldRetry = (error) => {
      const status = error?.status || error?.response?.status;
      return status === 429 || (status >= 500 && status < 600);
    }
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    if (parentSignal?.aborted) {
      clearTimeout(timeout);
      throw new Error('Request aborted');
    }
    
    parentSignal?.addEventListener('abort', () => controller.abort());
    
    try {
      const result = await fn(controller.signal);
      clearTimeout(timeout);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      
      if (!shouldRetry(error) || attempt === maxRetries) {
        throw error;
      }
      
      await sleep(exponentialBackoff(attempt));
    }
  }
  
  throw lastError;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  );
  
  return Promise.race([promise, timeout]);
}