import { Message, OpenAIMessage, OpenAIChatResponse, ModelType } from '@/types';

// Token estimation utilities
export function estimateTokenCount(text: string): number {
  // More accurate token estimation
  // OpenAI uses tiktoken, but this is a reasonable approximation
  const words = text.split(/\s+/).length;
  const characters = text.length;
  
  // Estimate based on the rule that 1 token ≈ 4 characters or ≈ 0.75 words
  const charBasedEstimate = Math.ceil(characters / 4);
  const wordBasedEstimate = Math.ceil(words / 0.75);
  
  // Use the higher estimate to be safe
  return Math.max(charBasedEstimate, wordBasedEstimate);
}

export function estimateMessagesTokenCount(messages: OpenAIMessage[]): number {
  let totalTokens = 0;
  
  for (const message of messages) {
    // Each message has overhead tokens
    totalTokens += 4; // Overhead per message
    
    // Handle both string and array content (for image messages)
    if (typeof message.content === 'string') {
      totalTokens += estimateTokenCount(message.content);
    } else if (Array.isArray(message.content)) {
      // For array content (with images), estimate tokens for text parts
      const textTokens = message.content
        .filter(item => item.type === 'text')
        .reduce((sum, item) => sum + estimateTokenCount(item.text || ''), 0);
      // Add estimated tokens for images (roughly 765 tokens per image)
      const imageCount = message.content.filter(item => item.type === 'image_url').length;
      totalTokens += textTokens + (imageCount * 765);
    }
    
    totalTokens += estimateTokenCount(message.role);
  }
  
  totalTokens += 2; // Overhead for the entire request
  
  return totalTokens;
}

// Model-specific token limits
export function getModelTokenLimit(model: ModelType): number {
  const limits: Record<ModelType, number> = {
    'gpt-3.5-turbo': 4096,
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
  };
  
  return limits[model] || 4096;
}

// Message processing utilities
export function convertAppMessageToOpenAI(message: Message): OpenAIMessage {
  return {
    role: message.role as 'user' | 'assistant',
    content: message.content,
  };
}

export function convertAppMessagesToOpenAI(messages: Message[]): OpenAIMessage[] {
  return messages
    .filter(msg => msg.role !== 'system' && msg.content.trim().length > 0)
    .map(convertAppMessageToOpenAI);
}

export function convertOpenAIResponseToMessage(
  response: OpenAIChatResponse,
  conversationId?: string
): Message {
  const choice = response.choices[0];
  if (!choice || !choice.message) {
    throw new Error('Invalid OpenAI response: no message content');
  }

  return {
    id: `msg_${response.id}_${Date.now()}`,
    content: choice.message.content,
    role: choice.message.role as 'assistant',
    timestamp: new Date(),
    tokenCount: response.usage?.completion_tokens,
  };
}

// Context management utilities
export function trimMessagesForTokenLimit(
  messages: OpenAIMessage[],
  maxTokens: number,
  systemPrompt?: string
): OpenAIMessage[] {
  const systemTokens = systemPrompt ? estimateTokenCount(systemPrompt) + 4 : 0;
  const availableTokens = maxTokens - systemTokens - 100; // Reserve 100 tokens for response
  
  if (availableTokens <= 0) {
    throw new Error('System prompt is too long for the model token limit');
  }
  
  let currentTokens = 0;
  const trimmedMessages: OpenAIMessage[] = [];
  
  // Process messages in reverse order (newest first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokenCount(message.content) + 4; // +4 for overhead
    
    if (currentTokens + messageTokens <= availableTokens) {
      trimmedMessages.unshift(message);
      currentTokens += messageTokens;
    } else {
      break;
    }
  }
  
  return trimmedMessages;
}

// Error handling utilities
export function isOpenAIError(error: any): error is { error: { message: string; type: string; code?: string } } {
  return error && typeof error === 'object' && 'error' in error && typeof error.error === 'object';
}

export function getErrorMessage(error: any): string {
  if (isOpenAIError(error)) {
    return error.error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred';
}

export function isRateLimitError(error: any): boolean {
  if (isOpenAIError(error)) {
    return error.error.type === 'rate_limit_exceeded' || 
           error.error.code === 'rate_limit_exceeded';
  }
  
  return false;
}

export function isQuotaError(error: any): boolean {
  if (isOpenAIError(error)) {
    return error.error.type === 'insufficient_quota' ||
           error.error.code === 'insufficient_quota';
  }
  
  return false;
}

export function isNetworkError(error: any): boolean {
  return error instanceof Error && 
         (error.message.includes('Network Error') || 
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED'));
}

// Retry logic utilities
export function shouldRetryError(error: any, retryCount: number, maxRetries: number): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }
  
  // Don't retry quota errors or authentication errors
  if (isQuotaError(error) || 
      (isOpenAIError(error) && error.error.type === 'invalid_api_key')) {
    return false;
  }
  
  // Retry rate limit errors and network errors
  return isRateLimitError(error) || isNetworkError(error);
}

export function calculateRetryDelay(retryCount: number, baseDelay: number = 1000): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  const maxDelay = 30000; // Cap at 30 seconds
  
  return Math.min(exponentialDelay + jitter, maxDelay);
}

// Conversation utilities
export function generateConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(msg => msg.role === 'user')?.content;
  
  if (!firstUserMessage) {
    return 'New Conversation';
  }
  
  // Take first 50 characters and clean up
  const title = firstUserMessage
    .substring(0, 50)
    .replace(/\n/g, ' ')
    .trim();
  
  return title.length < firstUserMessage.length ? `${title}...` : title;
}

export function calculateConversationStats(messages: Message[]): {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
  avgResponseTime?: number;
} {
  const userMessages = messages.filter(msg => msg.role === 'user');
  const assistantMessages = messages.filter(msg => msg.role === 'assistant');
  const totalTokens = messages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
  
  return {
    totalMessages: messages.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    totalTokens,
  };
}

// System prompt templates
export const SYSTEM_PROMPTS = {
  default: "You are a helpful AI assistant. Provide clear, accurate, and helpful responses.",
  
  concise: "You are a helpful AI assistant. Provide clear, accurate, and concise responses. Keep your answers brief unless specifically asked for detailed explanations.",
  
  creative: "You are a creative AI assistant. Feel free to be imaginative and think outside the box while still being helpful and accurate.",
  
  technical: "You are a technical AI assistant with expertise in programming, technology, and engineering. Provide detailed, accurate technical information and solutions.",
  
  casual: "You are a friendly and casual AI assistant. Use a conversational tone and feel free to be a bit more relaxed in your responses while still being helpful.",
  
  voice: "You are a voice AI assistant. Keep your responses concise and natural for speech. Avoid using markdown, code blocks, or complex formatting since your responses will be spoken aloud.",
};

export function getSystemPrompt(type: keyof typeof SYSTEM_PROMPTS = 'default'): string {
  return SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.default;
}