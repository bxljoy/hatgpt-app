import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { getOpenAIService } from '@/services/OpenAIService';
import { AIAgentService } from '@/services/AIAgentService';
import { Message, OpenAIError } from '@/types';

interface UseAIAgentState {
  isLoading: boolean;
  error: string | null;
  currentStep: string | null;
  toolsUsed: string[];
}

interface UseAIAgentOptions {
  conversationId?: string;
  systemPrompt?: string;
  onSuccess?: (response: string) => void;
  onError?: (error: OpenAIError | Error) => void;
  onStepUpdate?: (step: string) => void;
  enableWebSearch?: boolean;
  enableCalculator?: boolean;
  enableDateTime?: boolean;
}

export function useAIAgent(options: UseAIAgentOptions = {}) {
  const [state, setState] = useState<UseAIAgentState>({
    isLoading: false,
    error: null,
    currentStep: null,
    toolsUsed: [],
  });

  const agentRef = useRef<AIAgentService | null>(null);

  // Initialize AI Agent service
  const getAgent = useCallback(() => {
    if (!agentRef.current) {
      try {
        const openAIService = getOpenAIService();
        agentRef.current = new AIAgentService(openAIService);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize AI Agent service';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw error;
      }
    }
    return agentRef.current;
  }, []);

  // Process query through AI Agent pipeline
  const processQuery = useCallback(async (
    query: string,
    conversationId?: string,
    customOptions?: Partial<UseAIAgentOptions>
  ): Promise<string | null> => {
    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: null, 
        currentStep: 'Analyzing query...', 
        toolsUsed: [] 
      }));
      
      const agent = getAgent();
      const convId = conversationId || options.conversationId;
      
      if (!convId) {
        throw new Error('Conversation ID is required for AI Agent processing');
      }

      // Step 1: Intent Analysis
      setState(prev => ({ ...prev, currentStep: 'Understanding your request...' }));
      options.onStepUpdate?.('Understanding your request...');

      // Step 2: Tool Selection and Execution
      setState(prev => ({ ...prev, currentStep: 'Gathering information...' }));
      options.onStepUpdate?.('Gathering information...');

      // Step 3: Generate Response
      setState(prev => ({ ...prev, currentStep: 'Generating response...' }));
      options.onStepUpdate?.('Generating response...');

      const response = await agent.processQuery(
        query,
        convId,
        options.systemPrompt || customOptions?.systemPrompt
      );

      // Get tools that were used
      const availableTools = agent.getAvailableTools();
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        currentStep: null,
        toolsUsed: availableTools // This would need to be updated based on actual tools used
      }));
      
      options.onSuccess?.(response);
      customOptions?.onSuccess?.(response);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process query with AI Agent';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false, 
        currentStep: null 
      }));
      
      options.onError?.(error as OpenAIError | Error);
      customOptions?.onError?.(error as OpenAIError | Error);
      
      Alert.alert(
        'AI Agent Error',
        'Failed to process your request. Would you like to try with basic chat instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Use Basic Chat', 
            onPress: () => {
              // This would fallback to basic OpenAI service
              console.log('Falling back to basic chat...');
            }
          },
        ]
      );
      
      return null;
    }
  }, [options, getAgent]);

  // Send message with Image (enhanced for AI Agent)
  const processImageQuery = useCallback(async (
    message: Message,
    conversationId?: string,
    customOptions?: Partial<UseAIAgentOptions>
  ): Promise<string | null> => {
    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: null, 
        currentStep: 'Analyzing image...', 
        toolsUsed: [] 
      }));
      
      const agent = getAgent();
      const convId = conversationId || options.conversationId;
      
      if (!convId) {
        throw new Error('Conversation ID is required for AI Agent processing');
      }

      // For image messages, we still need to use the OpenAI service directly
      // since the agent system is primarily for text-based tool calling
      setState(prev => ({ ...prev, currentStep: 'Processing image with AI...' }));
      options.onStepUpdate?.('Processing image with AI...');

      // Get the OpenAI service directly for image processing
      const openAIService = getOpenAIService();
      const response = await openAIService.sendMessageWithContext(
        message,
        convId,
        options.systemPrompt || customOptions?.systemPrompt
      );

      if (response.choices[0]?.message?.content) {
        const content = response.choices[0].message.content;
        
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          currentStep: null,
          toolsUsed: ['ImageAnalysis']
        }));
        
        options.onSuccess?.(content);
        customOptions?.onSuccess?.(content);
        
        return content;
      }

      throw new Error('No response content received');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process image query';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false, 
        currentStep: null 
      }));
      
      options.onError?.(error as OpenAIError | Error);
      customOptions?.onError?.(error as OpenAIError | Error);
      
      return null;
    }
  }, [options, getAgent]);

  // Set conversation history (pass through to OpenAI service)
  const setConversationHistory = useCallback((
    conversationId: string,
    messages: Message[]
  ) => {
    try {
      const agent = getAgent();
      // Access the OpenAI service through the agent to set history
      const openAIService = getOpenAIService();
      openAIService.setConversationHistory(conversationId, messages);
    } catch (error) {
      console.error('[useAIAgent] Failed to set conversation history:', error);
    }
  }, [getAgent]);

  // Clear conversation history
  const clearConversationHistory = useCallback((conversationId?: string) => {
    try {
      const openAIService = getOpenAIService();
      if (conversationId) {
        openAIService.clearConversationHistory(conversationId);
      } else {
        openAIService.clearAllConversationHistory();
      }
    } catch (error) {
      console.error('[useAIAgent] Failed to clear conversation history:', error);
    }
  }, []);

  // Get available tools
  const getAvailableTools = useCallback(() => {
    try {
      const agent = getAgent();
      return agent.getAvailableTools();
    } catch (error) {
      console.error('[useAIAgent] Failed to get available tools:', error);
      return [];
    }
  }, [getAgent]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    currentStep: state.currentStep,
    toolsUsed: state.toolsUsed,
    
    // Actions
    processQuery,
    processImageQuery,
    setConversationHistory,
    clearConversationHistory,
    getAvailableTools,
    clearError,
  };
}