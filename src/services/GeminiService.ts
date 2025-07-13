import { Message } from '@/types';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  tools?: Array<{
    google_search?: {};
  }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
    groundingMetadata?: {
      webSearchQueries?: string[];
      searchEntryPoint?: {
        renderedContent?: string;
      };
      groundingChunks?: Array<{
        web?: {
          uri: string;
          title: string;
        };
      }>;
      groundingSupports?: Array<{
        segment?: {
          startIndex: number;
          endIndex: number;
          text: string;
        };
        groundingChunkIndices?: number[];
      }>;
    };
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private shouldEnableGrounding(messages: Message[]): boolean {
    // Enable grounding for queries that likely need real-time information
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') return false;

    const content = lastMessage.content.toLowerCase();
    
    // Keywords and patterns that suggest need for real-time information
    const groundingTriggers = [
      // Time-sensitive queries
      'latest', 'recent', 'current', 'today', 'yesterday', 'this week', 'this month', 'this year',
      'now', 'currently', 'at the moment', 'up to date', 'newest', 'updated',
      
      // News and events
      'news', 'breaking', 'happened', 'event', 'announcement', 'release',
      
      // Market and financial data
      'price', 'stock', 'market', 'exchange rate', 'cryptocurrency', 'bitcoin', 'ethereum',
      
      // Sports and competitions
      'score', 'match', 'game', 'tournament', 'championship', 'winner', 'result',
      
      // Weather
      'weather', 'temperature', 'forecast', 'rain', 'snow', 'storm',
      
      // Reviews and ratings
      'review', 'rating', 'opinion', 'feedback', 'consumer', '评价', 'evaluation',
      
      // Product information and availability
      'available', 'in stock', 'buy', 'purchase', 'store', 'shop',
      
      // Location-specific information
      'near me', 'in ', 'restaurant', 'hotel', 'travel',
      
      // Technology and updates
      'version', 'update', 'release', 'feature', 'bug', 'patch',
      
      // Chinese equivalents
      '最新', '最近', '当前', '今天', '昨天', '现在', '目前', '新闻', '消息', '价格', '股票', '市场',
      '天气', '评价', '评论', '可用', '购买', '商店', '版本', '更新', '发布'
    ];

    return groundingTriggers.some(trigger => content.includes(trigger));
  }

  private convertMessagesToGemini(messages: Message[]): GeminiMessage[] {
    return messages.map(msg => {
      const parts: GeminiMessage['parts'] = [];
      
      // Add text content
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      
      // Add image if present
      if (msg.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: msg.imageBase64
          }
        });
      }
      
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });
  }

  async sendMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      enableGrounding?: boolean;
    } = {}
  ): Promise<GeminiResponse> {
    try {
      const geminiMessages = this.convertMessagesToGemini(messages);
      
      // Add system prompt as first user message if provided
      if (options.systemPrompt) {
        geminiMessages.unshift({
          role: 'user',
          parts: [{ text: options.systemPrompt }]
        });
        geminiMessages.splice(1, 0, {
          role: 'model',
          parts: [{ text: 'I understand. I will follow these instructions.' }]
        });
      }

      // Automatically enable grounding if not explicitly set
      const shouldUseGrounding = options.enableGrounding ?? this.shouldEnableGrounding(messages);

      const request: GeminiRequest = {
        contents: geminiMessages,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 4096,
          topK: 40,
          topP: 0.95,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };

      // Add Google Search grounding tool if enabled
      if (shouldUseGrounding) {
        request.tools = [{ google_search: {} }];
        console.log('🔍 Gemini: Enabling Google Search grounding for query');
      }

      const response = await fetch(
        `${this.baseUrl}/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
      }

      const data: GeminiResponse = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      return data;
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  convertResponseToMessage(response: GeminiResponse, conversationId: string): Message {
    const candidate = response.candidates[0];
    const content = candidate.content.parts.map(part => part.text).join('');
    
    // Extract grounding metadata if available
    const groundingMetadata = candidate.groundingMetadata;
    const metadata: any = {
      model: 'gemini-2.5-flash',
      processingTime: Date.now(),
    };

    // Add grounding information to metadata if available
    if (groundingMetadata) {
      metadata.grounding = {
        webSearchQueries: groundingMetadata.webSearchQueries || [],
        sources: groundingMetadata.groundingChunks?.map(chunk => ({
          uri: chunk.web?.uri,
          title: chunk.web?.title,
        })) || [],
        citations: groundingMetadata.groundingSupports?.map(support => ({
          startIndex: support.segment?.startIndex,
          endIndex: support.segment?.endIndex,
          text: support.segment?.text,
          sourceIndices: support.groundingChunkIndices || [],
        })) || [],
      };
    }
    
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      role: 'assistant',
      timestamp: new Date(),
      tokenCount: response.usageMetadata.totalTokenCount,
      metadata,
    };
  }
}