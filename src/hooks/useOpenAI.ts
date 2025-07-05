import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { getOpenAIService, OpenAIService } from '@/services/OpenAIService';
import { Message, OpenAIChatResponse, OpenAIError } from '@/types';

interface UseOpenAIState {
  isLoading: boolean;
  error: string | null;
  lastResponse: OpenAIChatResponse | null;
}

interface UseOpenAIOptions {
  conversationId?: string;
  systemPrompt?: string;
  onSuccess?: (response: OpenAIChatResponse) => void;
  onError?: (error: OpenAIError | Error) => void;
  autoRetry?: boolean;
  maxRetries?: number;
}

export function useOpenAI(options: UseOpenAIOptions = {}) {
  const [state, setState] = useState<UseOpenAIState>({
    isLoading: false,
    error: null,
    lastResponse: null,
  });

  const serviceRef = useRef<OpenAIService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize service
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      try {
        serviceRef.current = getOpenAIService();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize OpenAI service';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw error;
      }
    }
    return serviceRef.current;
  }, []);

  // Send a single message without conversation context
  const sendMessage = useCallback(async (
    message: string,
    customOptions?: Partial<UseOpenAIOptions>
  ): Promise<OpenAIChatResponse | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const service = getService();
      const response = await service.sendSingleMessage(message, {
        max_tokens: 4000,
        temperature: 0.7,
      });

      setState(prev => ({ ...prev, lastResponse: response, isLoading: false }));
      
      options.onSuccess?.(response);
      customOptions?.onSuccess?.(response);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      
      options.onError?.(error as OpenAIError | Error);
      customOptions?.onError?.(error as OpenAIError | Error);
      
      if (options.autoRetry !== false) {
        Alert.alert(
          'Error',
          'Failed to send message. Would you like to retry?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => sendMessage(message, customOptions) },
          ]
        );
      }
      
      return null;
    }
  }, [options, getService]);

  // Send a message with conversation context
  const sendMessageWithContext = useCallback(async (
    message: string,
    conversationId?: string,
    customOptions?: Partial<UseOpenAIOptions>
  ): Promise<OpenAIChatResponse | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const service = getService();
      const convId = conversationId || options.conversationId;
      
      if (!convId) {
        throw new Error('Conversation ID is required for context-aware messages');
      }

      const response = await service.sendMessageWithContext(
        message,
        convId,
        options.systemPrompt || customOptions?.systemPrompt,
        {
          max_tokens: 4000,
          temperature: 0.7,
        }
      );

      setState(prev => ({ ...prev, lastResponse: response, isLoading: false }));
      
      options.onSuccess?.(response);
      customOptions?.onSuccess?.(response);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message with context';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      
      options.onError?.(error as OpenAIError | Error);
      customOptions?.onError?.(error as OpenAIError | Error);
      
      if (options.autoRetry !== false) {
        Alert.alert(
          'Error',
          'Failed to send message. Would you like to retry?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => sendMessageWithContext(message, conversationId, customOptions) },
          ]
        );
      }
      
      return null;
    }
  }, [options, getService]);

  // Set conversation history from existing messages
  const setConversationHistory = useCallback((
    conversationId: string,
    messages: Message[]
  ) => {
    try {
      const service = getService();
      service.setConversationHistory(conversationId, messages);
    } catch (error) {
      console.error('[useOpenAI] Failed to set conversation history:', error);
    }
  }, [getService]);

  // Clear conversation history
  const clearConversationHistory = useCallback((conversationId?: string) => {
    try {
      const service = getService();
      if (conversationId) {
        service.clearConversationHistory(conversationId);
      } else {
        service.clearAllConversationHistory();
      }
    } catch (error) {
      console.error('[useOpenAI] Failed to clear conversation history:', error);
    }
  }, [getService]);

  // Get current queue and rate limit status
  const getStatus = useCallback(() => {
    try {
      const service = getService();
      return {
        queue: service.getQueueStatus(),
        rateLimit: service.getRateLimitStatus(),
      };
    } catch (error) {
      console.error('[useOpenAI] Failed to get status:', error);
      return null;
    }
  }, [getService]);

  // Test OpenAI connection
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const service = getService();
      const isConnected = await service.testConnection();
      
      setState(prev => ({ ...prev, isLoading: false }));
      
      if (!isConnected) {
        setState(prev => ({ ...prev, error: 'Connection test failed' }));
      }
      
      return isConnected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      return false;
    }
  }, [getService]);

  // Cancel current request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    lastResponse: state.lastResponse,
    
    // Actions
    sendMessage,
    sendMessageWithContext,
    setConversationHistory,
    clearConversationHistory,
    testConnection,
    cancelRequest,
    clearError,
    getStatus,
  };
}