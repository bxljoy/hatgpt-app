import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  RefreshControl,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { MessageBubble } from '@/components/MessageBubble';
import { ChatInputWithVoice } from '@/components/ChatInputWithVoice';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { VoiceConversationOverlay } from '@/components/VoiceConversationOverlay';
import { useOpenAI } from '@/hooks/useOpenAI';
import { useAIAgent } from '@/hooks/useAIAgent';
import { useVoiceMode } from '@/hooks/useVoiceMode';
import { Message } from '@/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { convertOpenAIResponseToMessage, generateConversationTitle, getSystemPrompt } from '@/utils/openai';
import { ConversationStorageService } from '@/services/conversationStorage';
import { Conversation } from '@/types';
import { MessageSkeleton } from '@/components/SkeletonLoader';
import { SparklingOrb } from '@/components/SparklingOrb';
import { performanceMonitor, measureAsync } from '@/utils/performanceMonitor';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

const ChatScreenComponent = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(() => route.params?.conversationId || `conv_${Date.now()}`);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationTitle, setConversationTitle] = useState('HatGPT AI Agent');
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [wasAtBottomBeforeProcessing, setWasAtBottomBeforeProcessing] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Voice mode state
  const [voiceModeState, voiceModeActions] = useVoiceMode({
    enableHaptics: true,
    maxRecordingDuration: 60000,
    onTranscriptionComplete: (text) => {
      // When transcription is complete, send it as a message
      if (text.trim()) {
        handleSendMessage(text, 'voice');
      }
    },
    onError: (error) => {
      console.error('Voice mode error:', error);
      Alert.alert('Voice Error', error);
    },
  });

  // Performance tracking
  useEffect(() => {
    performanceMonitor.trackComponentMount('ChatScreen');
    return () => {
      performanceMonitor.trackComponentUnmount('ChatScreen');
    };
  }, []);

  // AI Agent hook for enhanced processing
  const {
    isLoading: agentLoading,
    error: agentError,
    currentStep,
    toolsUsed,
    processQuery,
    processImageQuery,
    setConversationHistory: setAgentHistory,
    clearConversationHistory: clearAgentHistory,
    clearError: clearAgentError,
  } = useAIAgent({
    conversationId,
    systemPrompt: getSystemPrompt('chatgpt'),
    onStepUpdate: (step) => {
      console.log('🤖 AI Agent step:', step);
    },
    onSuccess: async (response) => {
      try {
        // Create assistant message from AI Agent response
        const assistantMessage: Message = {
          id: generateMessageId(),
          content: response,
          role: 'assistant',
          timestamp: new Date(),
          metadata: {
            agentUsed: true,
            toolsUsed: toolsUsed,
          },
        };
        
        // Use functional state update to ensure we have the latest messages
        setMessages(currentMessages => {
          const updatedMessages = [...currentMessages, assistantMessage];
          console.log('✅ AI Agent response - updated messages:', updatedMessages.map(m => ({ 
            role: m.role, 
            content: m.content.substring(0, 50),
            toolsUsed: m.metadata?.toolsUsed
          })));
          
          // Save conversation with the updated messages
          saveCurrentConversation(updatedMessages);
          
          return updatedMessages;
        });
        
        // If voice mode is active, speak the response
        if (voiceModeState.isVoiceModeActive) {
          // Transition directly to speaking state
          voiceModeActions.setVoiceState('speaking');
          // For voice mode, we'll use the text response as-is since our voice system prompt
          // already optimizes for speech delivery
          await voiceModeActions.speakResponse(response);
        }
      } catch (error) {
        console.error('Error processing AI Agent response:', error);
        Alert.alert('Error', 'Failed to process AI response');
        // Reset to idle state on error
        if (voiceModeState.isVoiceModeActive) {
          voiceModeActions.setVoiceState('idle');
        }
      }
    },
    onError: (error) => {
      console.error('AI Agent error:', error);
      Alert.alert('AI Agent Error', 'Failed to get enhanced AI response. Falling back to basic chat.');
      // Reset to idle state on error
      if (voiceModeState.isVoiceModeActive) {
        voiceModeActions.setVoiceState('idle');
      }
    },
  });

  // Fallback OpenAI hook for basic functionality
  const {
    isLoading: openAILoading,
    error: openAIError,
    sendMessageWithContext,
    setConversationHistory,
    clearConversationHistory,
    clearError,
  } = useOpenAI({
    conversationId,
    systemPrompt: getSystemPrompt('chatgpt'),
    onSuccess: async (response) => {
      try {
        const assistantMessage = convertOpenAIResponseToMessage(response, conversationId);
        
        // Use functional state update to ensure we have the latest messages
        setMessages(currentMessages => {
          const updatedMessages = [...currentMessages, assistantMessage];
          console.log('✅ AI response - updated messages:', updatedMessages.map(m => ({ 
            role: m.role, 
            content: m.content.substring(0, 50) 
          })));
          
          // Save conversation with the updated messages
          saveCurrentConversation(updatedMessages);
          
          return updatedMessages;
        });
        
        // If voice mode is active, speak the response
        if (voiceModeState.isVoiceModeActive) {
          // Transition directly to speaking state
          voiceModeActions.setVoiceState('speaking');
          await voiceModeActions.speakResponse(assistantMessage.content);
        }
      } catch (error) {
        console.error('Error processing OpenAI response:', error);
        Alert.alert('Error', 'Failed to process AI response');
        // Reset to idle state on error
        if (voiceModeState.isVoiceModeActive) {
          voiceModeActions.setVoiceState('idle');
        }
      }
    },
    onError: (error) => {
      console.error('OpenAI error:', error);
      Alert.alert('AI Error', 'Failed to get AI response. Please try again.');
      // Reset to idle state on error
      if (voiceModeState.isVoiceModeActive) {
        voiceModeActions.setVoiceState('idle');
      }
    },
  });

  useEffect(() => {
    // Update conversation ID when route params change
    if (route.params?.conversationId && route.params.conversationId !== conversationId) {
      setConversationId(route.params.conversationId);
    }
  }, [route.params?.conversationId]);

  useEffect(() => {
    // Load existing conversation if conversationId is provided
    if (conversationId && conversationId.startsWith('conv_')) {
      loadConversation(conversationId);
    } else {
      // Reset for new conversation
      setMessages([]);
      setConversation(null);
      setConversationTitle('HatGPT AI Agent');
      // Reset scroll states for new conversation
      setIsAtBottom(true);
      setShowScrollButton(false);
      setWasAtBottomBeforeProcessing(true);
    }
  }, [conversationId]);

  // Scroll to bottom when messages are loaded from conversation history
  useEffect(() => {
    if (messages.length > 0 && conversation && !isLoading && !agentLoading && !openAILoading) {
      // This means we just loaded a conversation from history
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
          setIsAtBottom(true);
          setShowScrollButton(false);
        }
      }, 200);
      
      // Ensure it actually scrolled
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 600);
    }
  }, [messages.length, conversation?.id, isLoading, agentLoading, openAILoading]);

  const loadConversation = useCallback(async (loadConversationId: string) => {
    await measureAsync('load_conversation', async () => {
      try {
        setIsLoading(true);
        const loadedConversation = await ConversationStorageService.loadConversation(loadConversationId);
        if (loadedConversation) {
          console.log('📥 Loaded conversation:', {
            id: loadedConversation.id,
            title: loadedConversation.title,
            messageCount: loadedConversation.messages.length,
            messages: loadedConversation.messages.map(m => ({ 
              role: m.role, 
              content: m.content.substring(0, 50),
              metadata: m.metadata 
            }))
          });
          setConversation(loadedConversation);
          setMessages(loadedConversation.messages);
          setConversationTitle(loadedConversation.title);
          // Set history in both AI Agent and OpenAI service
          setAgentHistory(loadConversationId, loadedConversation.messages);
          setConversationHistory(loadConversationId, loadedConversation.messages);
          
          // Auto-scroll to bottom when loading existing conversation
          // Use multiple attempts to ensure scroll works
          setTimeout(() => {
            if (flatListRef.current && loadedConversation.messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: false });
              setIsAtBottom(true);
              setShowScrollButton(false);
              setWasAtBottomBeforeProcessing(true);
            }
          }, 100);
          
          setTimeout(() => {
            if (flatListRef.current && loadedConversation.messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }, 500);
        } else {
          console.log('📥 No conversation found for ID:', loadConversationId);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        Alert.alert('Error', 'Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    }, { conversationId: loadConversationId, messageCount: messages.length });
  }, [setAgentHistory, setConversationHistory]);

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateConversationTitle = useCallback((messages: Message[]): string => {
    // Find the first user message
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (!firstUserMessage) return 'HatGPT 4o';

    let content = firstUserMessage.content.trim();
    
    // Remove common question prefixes
    content = content.replace(/^(what|how|why|when|where|who|can you|could you|please|help me|i need|i want)/i, '');
    content = content.trim();
    
    // If content is empty after cleaning, use original
    if (!content) {
      content = firstUserMessage.content.trim();
    }
    
    // Truncate to reasonable length and clean up
    if (content.length > 50) {
      content = content.substring(0, 47) + '...';
    }
    
    // Remove trailing punctuation and capitalize first letter
    content = content.replace(/[.!?]+$/, '');
    content = content.charAt(0).toUpperCase() + content.slice(1);
    
    // If it's still too generic or empty, use a time-based title
    if (!content || content.length < 3 || /^(hi|hello|hey|test)$/i.test(content)) {
      const now = new Date();
      return `Chat ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return content;
  }, []);

  const saveCurrentConversation = async (currentMessages: Message[]) => {
    try {
      // Generate title if this is a new conversation and we have messages
      let title = conversationTitle;
      
      if (title === 'HatGPT 4o' && currentMessages.length >= 1) {
        // First, generate a quick local title from the first message
        title = generateConversationTitle(currentMessages);
        setConversationTitle(title);
        
        // If we have 2+ messages, try to generate a better AI-powered title
        if (currentMessages.length >= 2) {
          const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
          if (apiKey) {
            try {
              const aiTitle = await ConversationStorageService.generateTitle(currentMessages, apiKey);
              if (aiTitle && aiTitle !== title && aiTitle.length > 5) {
                title = aiTitle;
                setConversationTitle(title);
              }
            } catch (error) {
              console.warn('Failed to generate AI title, keeping local title');
            }
          }
        }
      }

      const conversationToSave: Conversation = {
        id: conversationId,
        title,
        messages: currentMessages,
        createdAt: conversation?.createdAt || new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: currentMessages.length,
        totalTokens: currentMessages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0),
        isArchived: conversation?.isArchived || false,
        isStarred: conversation?.isStarred || false,
        tags: conversation?.tags || [],
      };

      console.log('💾 Saving conversation:', {
        id: conversationToSave.id,
        title: conversationToSave.title,
        messageCount: conversationToSave.messages.length,
        messages: conversationToSave.messages.map(m => ({ 
          role: m.role, 
          content: m.content.substring(0, 50),
          metadata: m.metadata 
        }))
      });

      await ConversationStorageService.saveConversation(conversationToSave);
      setConversation(conversationToSave);
    } catch (error) {
      console.error('Failed to save conversation:', error);
      // Don't show alert for save failures to avoid interrupting the chat flow
    }
  };

  const handleSendMessage = async (messageContent: string, type: 'text' | 'voice' = 'text') => {
    if (!messageContent.trim()) return;

    const userMessage: Message = {
      id: generateMessageId(),
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
      metadata: type === 'voice' ? { inputType: 'voice' } : undefined,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Always scroll to bottom when user sends a message
    scrollToBottom();

    // Save conversation after user message
    await saveCurrentConversation(updatedMessages);

    // Remember scroll position before processing starts
    setWasAtBottomBeforeProcessing(isAtBottom);

    try {
      // Use AI Agent for enhanced processing
      await processQuery(messageContent, conversationId);
    } catch (error) {
      console.error('Error sending message with AI Agent:', error);
      
      // Fallback to basic OpenAI if agent fails
      try {
        console.log('Falling back to basic OpenAI...');
        await sendMessageWithContext(messageContent, conversationId);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        
        // Update user message with error state
        setMessages(prev => 
          prev.map(msg => 
            msg.id === userMessage.id 
              ? { ...msg, error: 'Failed to send message' }
              : msg
          )
        );
      }
    }
  };

  const handleImageMessage = async (imageUri: string, prompt: string) => {
    if (!imageUri) return;

    try {
      // Read image as base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1]; // Remove data:image/jpeg;base64, prefix

        console.log('[ChatScreen] Processing image:', {
          imageUri,
          prompt,
          base64Length: base64.length,
          base64Preview: base64.substring(0, 50) + '...',
        });

        const userMessage: Message = {
          id: generateMessageId(),
          content: prompt,
          role: 'user',
          timestamp: new Date(),
          imageBase64: base64,
          metadata: { 
            inputType: 'image',
            imageSettings: {
              format: 'jpeg',
              originalSize: { width: 0, height: 0 }, // Will be filled by actual image dimensions
            }
          },
        };

        console.log('[ChatScreen] Created user message with image:', {
          id: userMessage.id,
          content: userMessage.content,
          hasImageBase64: !!userMessage.imageBase64,
          imageBase64Length: userMessage.imageBase64?.length,
        });

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        
        // Always scroll to bottom when user sends a message
        scrollToBottom();

        // Save conversation after user message
        await saveCurrentConversation(updatedMessages);

        // Remember scroll position before processing starts
        setWasAtBottomBeforeProcessing(isAtBottom);

        try {
          console.log('[ChatScreen] Sending image message to AI Agent:', {
            messageId: userMessage.id,
            hasImageBase64: !!userMessage.imageBase64,
            conversationId,
          });
          
          // Use AI Agent for image processing
          await processImageQuery(userMessage, conversationId);
          
          console.log('[ChatScreen] Successfully sent image message');
        } catch (error) {
          console.error('Error sending image message:', error);
          
          // Update user message with error state
          setMessages(prev => 
            prev.map(msg => 
              msg.id === userMessage.id 
                ? { ...msg, error: 'Failed to send image message' }
                : msg
            )
          );
        }
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    }
  };

  const handleRetryMessage = (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (message && message.role === 'user') {
      // Remove the failed message and resend
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      handleSendMessage(message.content);
    }
  };


  const handlePlayAudio = (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (message?.audioUrl) {
      setCurrentPlayingAudio(currentPlayingAudio === messageId ? null : messageId);
      // TODO: Implement audio playback
      console.log('Play audio for message:', messageId);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
      setIsAtBottom(true);
      setShowScrollButton(false);
    }
  };

  const scrollToShowProcessing = () => {
    // Scroll to show the AI thinking animation
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottomNow = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    
    setIsAtBottom(isAtBottomNow);
    setShowScrollButton(!isAtBottomNow && messages.length > 0);
  }, [messages.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Implement refresh logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // Handle conversation selection from sidebar
  const handleConversationSelect = useCallback((selectedConversationId: string) => {
    if (selectedConversationId !== conversationId) {
      // Navigate to the selected conversation
      navigation.navigate('Chat', { conversationId: selectedConversationId });
    }
  }, [conversationId, navigation]);

  // Handle new conversation from sidebar
  const handleNewConversation = useCallback(() => {
    try {
      // Create a new conversation ID
      const newConversationId = `conv_${Date.now()}`;
      
      // Close sidebar immediately for better UX
      setIsSidebarVisible(false);
      
      // Reset conversation state
      setConversationId(newConversationId);
      setMessages([]);
      setConversation(null);
      setConversationTitle('HatGPT AI Agent');
      
      // Reset scroll states for new conversation
      setIsAtBottom(true);
      setShowScrollButton(false);
      setWasAtBottomBeforeProcessing(true);
      
      // Clear conversation history in both AI Agent and OpenAI service
      clearAgentHistory(conversationId);
      clearConversationHistory(conversationId);
      
      // Track navigation for performance monitoring
      performanceMonitor.trackNavigation('Chat', 'NewChat', { newConversationId });
      
      console.log('Started new conversation:', newConversationId);
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      Alert.alert('Error', 'Failed to create new conversation');
    }
  }, [conversationId, clearConversationHistory]);

  // Toggle sidebar visibility
  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
  }, []);

  // Memoized render functions for better performance
  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      onRetry={() => handleRetryMessage(item.id)}
      onPlayAudio={() => handlePlayAudio(item.id)}
      isAudioPlaying={currentPlayingAudio === item.id}
    />
  ), [handleRetryMessage, handlePlayAudio, currentPlayingAudio]);

  const renderLoadingMessage = useCallback(() => (
    <MessageSkeleton isUser={false} />
  ), []);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>Start a conversation</Text>
      <Text style={styles.emptyStateText}>
        Type a message below to begin chatting
      </Text>
    </View>
  ), []);

  const renderScrollToBottomButton = () => {
    if (!showScrollButton) return null;
    
    return (
      <TouchableOpacity
        style={styles.scrollToBottomButton}
        onPress={scrollToBottom}
        activeOpacity={0.8}
      >
        <Text style={styles.scrollToBottomIcon}>↓</Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={toggleSidebar}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.menuIcon}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </View>
      </TouchableOpacity>
      
      <Text style={styles.headerTitle} numberOfLines={1}>
        {conversationTitle}
      </Text>
      
      
      <TouchableOpacity
        style={styles.newConversationButton}
        onPress={handleNewConversation}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.editIcon}>
          <View style={styles.editPenBody} />
          <View style={styles.editPenTip} />
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContainer,
            messages.length === 0 && styles.messagesContainerEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={(contentWidth, contentHeight) => {
            // Auto-scroll to show AI thinking animation when processing starts
            if ((agentLoading || openAILoading) && messages.length > 0) {
              scrollToShowProcessing();
            }
            // Only auto-scroll after AI completes if user was at bottom before processing
            else if (!agentLoading && !openAILoading && wasAtBottomBeforeProcessing && messages.length > 0) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
            />
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={(agentLoading || openAILoading) ? renderLoadingMessage : undefined}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={15}
        />
        
        {renderScrollToBottomButton()}
        
        <ChatInputWithVoice
          onSendMessage={handleSendMessage}
          onImageMessage={handleImageMessage}
          isProcessing={agentLoading || openAILoading}
          disabled={isLoading || agentLoading || openAILoading}
          enableVoiceToText={true}
          enableTextEditing={false}
          autoCompleteOnTranscription={true}
          onEnterVoiceMode={voiceModeActions.enterVoiceMode}
          onNewConversation={handleNewConversation}
          placeholder={currentStep || "Ask anything"}
        />
        
        
        {(agentError || openAIError) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{agentError || openAIError}</Text>
            <TouchableOpacity onPress={() => {
              clearAgentError();
              clearError();
            }} style={styles.errorDismiss}>
              <Text style={styles.errorDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <ConversationSidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
        currentConversationId={conversationId}
      />

      <VoiceConversationOverlay
        isVisible={voiceModeState.isVoiceModeActive}
        voiceState={voiceModeState.voiceState}
        onClose={voiceModeActions.exitVoiceMode}
        onStartListening={voiceModeActions.startListening}
        onStopListening={voiceModeActions.stopListening}
        onToggleListening={voiceModeActions.toggleListening}
        isListening={voiceModeState.isListening}
        currentText={voiceModeState.currentTranscription}
        responseText={voiceModeState.currentResponse}
        enableHaptics={true}
      />
    </SafeAreaView>
  );
};

// Export memoized component
export const ChatScreen = memo(ChatScreenComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: 20,
    height: 16,
    justifyContent: 'space-between',
  },
  menuLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#000000',
    borderRadius: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  newConversationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editIcon: {
    width: 18,
    height: 18,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPenBody: {
    position: 'absolute',
    width: 2.5,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.25,
    transform: [{ rotate: '45deg' }],
    top: 1,
    left: 7.75,
  },
  editPenTip: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    top: -1,
    left: 6.75,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingTop: 16,
  },
  messagesContainerEmpty: {
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  errorDismiss: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  errorDismissText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  processingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  scrollToBottomIcon: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
});