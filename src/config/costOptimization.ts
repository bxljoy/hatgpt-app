// Cost optimization configuration for OpenAI API usage

export interface CostOptimizationConfig {
  // Context management
  maxContextMessages: number;      // Maximum messages to send as context
  maxContextTokens: number;        // Maximum tokens to send as context
  
  // Model selection
  useGPT4ForComplexTasks: boolean; // Use GPT-4 only for complex tasks
  fallbackToGPT35: boolean;        // Fallback to GPT-3.5 for simple questions
  
  // Response optimization
  maxResponseTokens: number;       // Limit response length
  temperature: number;             // Lower temperature = more focused responses
  
  // Feature toggles
  enableContextOptimization: boolean;
  enableSmartModelSelection: boolean;
  enableResponseLengthOptimization: boolean;
}

export const DEFAULT_COST_OPTIMIZATION: CostOptimizationConfig = {
  // Context management - reduces input token costs
  maxContextMessages: 20,          // ~10 conversation exchanges
  maxContextTokens: 3000,          // ~$0.003 per request at GPT-4 rates
  
  // Model selection - use cheaper models when possible
  useGPT4ForComplexTasks: true,
  fallbackToGPT35: false,          // Disabled by default for quality
  
  // Response optimization - reduces output token costs
  maxResponseTokens: 1000,         // Reasonable response length
  temperature: 0.7,                // Standard creativity level
  
  // Feature toggles
  enableContextOptimization: true,
  enableSmartModelSelection: false, // Disabled until implemented
  enableResponseLengthOptimization: true,
};

export const AGGRESSIVE_COST_OPTIMIZATION: CostOptimizationConfig = {
  maxContextMessages: 10,          // Only 5 exchanges
  maxContextTokens: 1500,          // Minimal context
  useGPT4ForComplexTasks: false,
  fallbackToGPT35: true,
  maxResponseTokens: 500,          // Shorter responses
  temperature: 0.5,                // More focused
  enableContextOptimization: true,
  enableSmartModelSelection: true,
  enableResponseLengthOptimization: true,
};

export const QUALITY_FIRST_CONFIG: CostOptimizationConfig = {
  maxContextMessages: 50,          // More context for better responses
  maxContextTokens: 6000,          // Higher token limit
  useGPT4ForComplexTasks: true,
  fallbackToGPT35: false,
  maxResponseTokens: 2000,         // Longer responses allowed
  temperature: 0.8,                // More creative
  enableContextOptimization: false, // Disable optimization for quality
  enableSmartModelSelection: false,
  enableResponseLengthOptimization: false,
};

// Cost estimation helpers
export const estimateTokenCost = (inputTokens: number, outputTokens: number, model: string = 'gpt-4o') => {
  const rates = {
    'gpt-4o': { input: 0.005, output: 0.015 },      // per 1K tokens
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
  };
  
  const rate = rates[model as keyof typeof rates] || rates['gpt-4o'];
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
};

export const getOptimizationStrategy = (totalMessages: number): CostOptimizationConfig => {
  if (totalMessages < 10) {
    return DEFAULT_COST_OPTIMIZATION;
  } else if (totalMessages < 50) {
    return {
      ...DEFAULT_COST_OPTIMIZATION,
      maxContextMessages: 15,
      maxContextTokens: 2000,
    };
  } else {
    return AGGRESSIVE_COST_OPTIMIZATION;
  }
};