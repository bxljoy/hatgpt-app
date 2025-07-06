import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  OpenAIMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIError,
  Message,
  ModelType,
} from '@/types';
import { DEFAULT_COST_OPTIMIZATION, CostOptimizationConfig } from '@/config/costOptimization';

interface QueuedRequest {
  id: string;
  request: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
  retryCount: number;
  maxRetries: number;
}

interface RateLimitState {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestCount: number;
  tokenCount: number;
  lastResetTime: number;
}

interface OpenAIServiceConfig {
  apiKey: string;
  baseURL?: string;
  model?: ModelType;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  requestTimeout?: number;
  rateLimitRPM?: number;
  rateLimitTPM?: number;
  costOptimization?: CostOptimizationConfig;
}

export class OpenAIService {
  private axios: AxiosInstance;
  private config: Required<OpenAIServiceConfig>;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private rateLimitState: RateLimitState;
  private conversationHistory: Map<string, OpenAIMessage[]> = new Map();

  constructor(config: OpenAIServiceConfig) {
    this.config = {
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      maxTokens: 4000,
      temperature: 0.7,
      maxRetries: 3,
      requestTimeout: 60000,
      rateLimitRPM: 60,
      rateLimitTPM: 90000,
      costOptimization: DEFAULT_COST_OPTIMIZATION,
      ...config,
    };

    this.rateLimitState = {
      requestsPerMinute: this.config.rateLimitRPM,
      tokensPerMinute: this.config.rateLimitTPM,
      requestCount: 0,
      tokenCount: 0,
      lastResetTime: Date.now(),
    };

    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.requestTimeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'HatGPT-App/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axios.interceptors.request.use(
      (config) => {
        console.log(`[OpenAI] Making request to ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[OpenAI] Request error:', error);
        return Promise.reject(error);
      }
    );

    this.axios.interceptors.response.use(
      (response) => {
        console.log(`[OpenAI] Response received with status ${response.status}`);
        this.updateRateLimitFromHeaders(response.headers);
        return response;
      },
      (error: AxiosError) => {
        console.error('[OpenAI] Response error:', error.response?.status, error.message);
        return Promise.reject(this.handleAxiosError(error));
      }
    );
  }

  private updateRateLimitFromHeaders(headers: any): void {
    const remaining = headers['x-ratelimit-remaining-requests'];
    const resetTime = headers['x-ratelimit-reset-requests'];
    
    if (remaining !== undefined) {
      this.rateLimitState.requestCount = this.rateLimitState.requestsPerMinute - parseInt(remaining);
    }
    
    if (resetTime !== undefined) {
      this.rateLimitState.lastResetTime = Date.now() + (parseInt(resetTime) * 1000);
    }
  }

  private handleAxiosError(error: AxiosError): OpenAIError {
    const response = error.response;
    
    if (response?.data && typeof response.data === 'object' && 'error' in response.data) {
      return response.data as OpenAIError;
    }

    return {
      error: {
        message: error.message || 'Network error occurred',
        type: 'network_error',
        param: null,
        code: error.code || null,
      },
    };
  }

  private async checkRateLimit(estimatedTokens: number = 100): Promise<void> {
    const now = Date.now();
    const timeSinceReset = now - this.rateLimitState.lastResetTime;

    // Reset counters if a minute has passed
    if (timeSinceReset >= 60000) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.tokenCount = 0;
      this.rateLimitState.lastResetTime = now;
    }

    // Check if we're approaching rate limits
    if (
      this.rateLimitState.requestCount >= this.rateLimitState.requestsPerMinute - 5 ||
      this.rateLimitState.tokenCount + estimatedTokens >= this.rateLimitState.tokensPerMinute
    ) {
      const waitTime = 60000 - timeSinceReset;
      console.log(`[OpenAI] Rate limit approached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async addToQueue<T>(
    request: () => Promise<T>,
    priority: number = 1,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: this.generateRequestId(),
        request,
        resolve,
        reject,
        priority,
        retryCount: 0,
        maxRetries,
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.requestQueue.findIndex(req => req.priority < priority);
      if (insertIndex === -1) {
        this.requestQueue.push(queuedRequest);
      } else {
        this.requestQueue.splice(insertIndex, 0, queuedRequest);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const queuedRequest = this.requestQueue.shift()!;

      try {
        await this.checkRateLimit();
        const result = await queuedRequest.request();
        queuedRequest.resolve(result);
      } catch (error) {
        if (queuedRequest.retryCount < queuedRequest.maxRetries) {
          queuedRequest.retryCount++;
          const delay = Math.min(1000 * Math.pow(2, queuedRequest.retryCount), 30000);
          console.log(`[OpenAI] Retrying request ${queuedRequest.id} in ${delay}ms (attempt ${queuedRequest.retryCount})`);
          
          setTimeout(() => {
            this.requestQueue.unshift(queuedRequest);
            this.processQueue();
          }, delay);
        } else {
          console.error(`[OpenAI] Request ${queuedRequest.id} failed after ${queuedRequest.maxRetries} retries`);
          queuedRequest.reject(error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  private estimateTokenCount(messages: OpenAIMessage[]): number {
    const totalLength = messages.reduce((sum, msg) => {
      if (typeof msg.content === 'string') {
        return sum + msg.content.length;
      } else if (Array.isArray(msg.content)) {
        // For array content (with images), estimate tokens for text parts
        const textLength = msg.content
          .filter(item => item.type === 'text')
          .reduce((textSum, item) => textSum + (item.text?.length || 0), 0);
        // Add estimated tokens for images (roughly 765 tokens per image)
        const imageCount = msg.content.filter(item => item.type === 'image_url').length;
        return sum + textLength + (imageCount * 765);
      }
      return sum;
    }, 0);
    return Math.ceil(totalLength / 4); // Rough estimation: 4 characters per token
  }

  private convertMessageToOpenAI(message: Message): OpenAIMessage {
    // Check if message has an image
    if (message.imageUrl || message.imageBase64) {
      const imageUrl = message.imageUrl || `data:image/jpeg;base64,${message.imageBase64}`;
      
      console.log('[OpenAI] Converting image message:', {
        hasImageUrl: !!message.imageUrl,
        hasImageBase64: !!message.imageBase64,
        base64Length: message.imageBase64?.length,
        content: message.content,
      });
      
      const openAIMessage = {
        role: message.role as 'user' | 'assistant',
        content: [
          {
            type: 'text',
            text: message.content || 'What do you see in this image?',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high', // Use high detail for better analysis
            },
          },
        ],
      };
      
      console.log('[OpenAI] Created OpenAI message with image:', {
        role: openAIMessage.role,
        contentLength: openAIMessage.content.length,
        hasImageUrl: openAIMessage.content.some(item => item.type === 'image_url'),
      });
      
      return openAIMessage;
    }

    // Regular text message
    return {
      role: message.role as 'user' | 'assistant',
      content: message.content,
    };
  }

  private convertMessagesToOpenAI(messages: Message[]): OpenAIMessage[] {
    if (!messages || !Array.isArray(messages)) {
      console.warn('[OpenAIService] convertMessagesToOpenAI: messages is undefined or not an array, returning empty array');
      return [];
    }
    
    return messages
      .filter(msg => msg && msg.role !== 'system')
      .map(msg => this.convertMessageToOpenAI(msg));
  }

  // Public methods

  public async sendSingleMessage(
    message: string,
    options?: Partial<OpenAIChatRequest>
  ): Promise<OpenAIChatResponse> {
    const messages: OpenAIMessage[] = [
      {
        role: 'user',
        content: message,
      },
    ];

    return this.sendChatCompletion(messages, options);
  }

  public async sendMessageWithContext(
    message: string | Message,
    conversationId: string,
    systemPrompt?: string,
    options?: Partial<OpenAIChatRequest>
  ): Promise<OpenAIChatResponse> {
    const fullConversationHistory = this.getConversationHistory(conversationId);
    
    const messages: OpenAIMessage[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // COST OPTIMIZATION: Smart context management
    const optimizedHistory = await this.optimizeConversationContext(fullConversationHistory);
    messages.push(...optimizedHistory);

    // Add new user message - handle both string and Message object
    let newUserMessage: OpenAIMessage;
    if (typeof message === 'string') {
      // Simple text message
      newUserMessage = {
        role: 'user',
        content: message,
      };
    } else {
      // Full Message object (may include image)
      newUserMessage = this.convertMessageToOpenAI(message);
    }
    messages.push(newUserMessage);

    const response = await this.sendChatCompletion(messages, options);

    // Update conversation history
    this.addToConversationHistory(conversationId, newUserMessage);

    if (response.choices[0]?.message) {
      this.addToConversationHistory(conversationId, response.choices[0].message);
    }

    return response;
  }

  public async sendChatCompletion(
    messages: OpenAIMessage[],
    options?: Partial<OpenAIChatRequest>
  ): Promise<OpenAIChatResponse> {
    const request: OpenAIChatRequest = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      ...options,
    };

    const estimatedTokens = this.estimateTokenCount(messages) + (request.max_tokens || 0);

    // Debug logging for image messages
    const hasImageMessages = messages.some(msg => 
      Array.isArray(msg.content) && msg.content.some(item => item.type === 'image_url')
    );
    
    if (hasImageMessages) {
      console.log('[OpenAI] Sending request with images:', {
        model: request.model,
        messagesCount: messages.length,
        imageMessages: messages.filter(msg => 
          Array.isArray(msg.content) && msg.content.some(item => item.type === 'image_url')
        ).length,
      });
      
      // Log the structure of image messages (without the actual base64 data)
      messages.forEach((msg, index) => {
        if (Array.isArray(msg.content)) {
          console.log(`[OpenAI] Message ${index}:`, {
            role: msg.role,
            contentItems: msg.content.map(item => ({ 
              type: item.type,
              hasText: !!item.text,
              hasImageUrl: !!item.image_url,
            })),
          });
        }
      });
    }

    return this.addToQueue(async () => {
      this.rateLimitState.requestCount++;
      this.rateLimitState.tokenCount += estimatedTokens;

      const response = await this.axios.post<OpenAIChatResponse>('/chat/completions', request);
      
      if (hasImageMessages) {
        console.log('[OpenAI] Received response for image request:', {
          choices: response.data.choices.length,
          finishReason: response.data.choices[0]?.finish_reason,
          usage: response.data.usage,
        });
      }
      
      return response.data;
    });
  }

  public getConversationHistory(conversationId: string): OpenAIMessage[] {
    return this.conversationHistory.get(conversationId) || [];
  }

  public addToConversationHistory(conversationId: string, message: OpenAIMessage): void {
    const history = this.getConversationHistory(conversationId);
    history.push(message);
    
    // Keep only last 50 messages to prevent token overflow
    if (history.length > 50) {
      this.conversationHistory.set(conversationId, history.slice(-50));
    } else {
      this.conversationHistory.set(conversationId, history);
    }
  }

  public setConversationHistory(conversationId: string, messages: Message[]): void {
    if (!conversationId) {
      console.warn('[OpenAIService] setConversationHistory: conversationId is required');
      return;
    }
    
    const openAIMessages = this.convertMessagesToOpenAI(messages);
    this.conversationHistory.set(conversationId, openAIMessages);
  }

  public clearConversationHistory(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
  }

  public clearAllConversationHistory(): void {
    this.conversationHistory.clear();
  }

  public getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.requestQueue.length,
      processing: this.isProcessingQueue,
    };
  }

  public getRateLimitStatus(): RateLimitState {
    return { ...this.rateLimitState };
  }

  public updateConfig(newConfig: Partial<OpenAIServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.apiKey) {
      this.axios.defaults.headers['Authorization'] = `Bearer ${newConfig.apiKey}`;
    }
  }

  // COST OPTIMIZATION: Smart context management
  private async optimizeConversationContext(history: OpenAIMessage[]): Promise<OpenAIMessage[]> {
    const { costOptimization } = this.config;
    
    if (!costOptimization.enableContextOptimization) {
      return history;
    }

    const { maxContextMessages, maxContextTokens } = costOptimization;
    
    if (history.length <= maxContextMessages) {
      return history;
    }

    // Always keep the most recent messages
    const recentMessages = history.slice(-maxContextMessages);

    // Estimate tokens (rough approximation: 4 chars = 1 token)
    const estimateTokens = (messages: OpenAIMessage[]) => 
      messages.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);

    const recentTokens = estimateTokens(recentMessages);
    
    // If recent messages are within token limit, return them
    if (recentTokens <= maxContextTokens) {
      console.log(`[OpenAI] Context kept: ${recentMessages.length} messages (~${recentTokens} tokens)`);
      return recentMessages;
    }

    // If recent messages exceed token limit, truncate them
    let tokenCount = 0;
    const truncatedRecent: OpenAIMessage[] = [];
    
    // Add messages from most recent backwards until we hit token limit
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const messageTokens = Math.ceil(recentMessages[i].content.length / 4);
      if (tokenCount + messageTokens <= maxContextTokens) {
        truncatedRecent.unshift(recentMessages[i]);
        tokenCount += messageTokens;
      } else {
        break;
      }
    }

    console.log(`[OpenAI] Context optimized: ${history.length} → ${truncatedRecent.length} messages (~${tokenCount} tokens)`);
    return truncatedRecent;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.sendSingleMessage('Hello', { max_tokens: 1 });
      return true;
    } catch (error) {
      console.error('[OpenAI] Connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let openAIServiceInstance: OpenAIService | null = null;

export function getOpenAIService(): OpenAIService {
  if (!openAIServiceInstance) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set EXPO_PUBLIC_OPENAI_API_KEY in your environment variables.');
    }

    openAIServiceInstance = new OpenAIService({
      apiKey,
    });
  }

  return openAIServiceInstance;
}

export function createOpenAIService(config: OpenAIServiceConfig): OpenAIService {
  return new OpenAIService(config);
}