import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useOpenAI } from '@/hooks/useOpenAI';
import { Message } from '@/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { convertOpenAIResponseToMessage, generateConversationTitle, getSystemPrompt } from '@/utils/openai';
import { ConversationStorageService } from '@/services/conversationStorage';
import { Conversation } from '@/types';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(() => route.params?.conversationId || `conv_${Date.now()}`);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationTitle, setConversationTitle] = useState('New Conversation');
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const {
    isLoading: openAILoading,
    error: openAIError,
    sendMessageWithContext,
    setConversationHistory,
    clearError,
  } = useOpenAI({
    conversationId,
    systemPrompt: getSystemPrompt('voice'),
    onSuccess: async (response) => {
      try {
        const assistantMessage = convertOpenAIResponseToMessage(response, conversationId);
        const updatedMessages = [...messages, assistantMessage];
        setMessages(updatedMessages);
        scrollToBottom();
        
        // Save conversation after each assistant response
        await saveCurrentConversation(updatedMessages);
      } catch (error) {
        console.error('Error processing OpenAI response:', error);
        Alert.alert('Error', 'Failed to process AI response');
      }
    },
    onError: (error) => {
      console.error('OpenAI error:', error);
      Alert.alert('AI Error', 'Failed to get AI response. Please try again.');
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
      setConversationTitle('New Conversation');
    }
  }, [conversationId]);

  const loadConversation = async (loadConversationId: string) => {
    try {
      setIsLoading(true);
      const loadedConversation = await ConversationStorageService.loadConversation(loadConversationId);
      if (loadedConversation) {
        setConversation(loadedConversation);
        setMessages(loadedConversation.messages);
        setConversationTitle(loadedConversation.title);
        setConversationHistory(loadedConversation.messages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      Alert.alert('Error', 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const saveCurrentConversation = async (currentMessages: Message[]) => {
    try {
      // Generate title if this is a new conversation and we have messages
      let title = conversationTitle;
      if (title === 'New Conversation' && currentMessages.length >= 2) {
        // Generate title from first few messages
        const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
        if (apiKey) {
          try {
            title = await ConversationStorageService.generateTitle(currentMessages, apiKey);
            setConversationTitle(title);
          } catch (error) {
            console.warn('Failed to generate title, using default');
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
    scrollToBottom();

    // Save conversation after user message
    await saveCurrentConversation(updatedMessages);

    try {
      await sendMessageWithContext(messageContent, conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update user message with error state
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, error: 'Failed to send message' }
            : msg
        )
      );
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
    }
  };

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
    // Create a new conversation ID and navigate
    const newConversationId = `conv_${Date.now()}`;
    navigation.navigate('Chat', { conversationId: newConversationId });
  }, [navigation]);

  // Toggle sidebar visibility
  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
  }, []);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      onRetry={() => handleRetryMessage(item.id)}
      onPlayAudio={() => handlePlayAudio(item.id)}
      isAudioPlaying={currentPlayingAudio === item.id}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>Start a conversation</Text>
      <Text style={styles.emptyStateText}>
        Type a message or tap the microphone to start talking
      </Text>
    </View>
  );

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
      
      <View style={styles.headerSpacer} />
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
          onContentSizeChange={scrollToBottom}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
        
        <ChatInputWithVoice
          onSendMessage={handleSendMessage}
          isProcessing={openAILoading}
          disabled={isLoading || openAILoading}
          enableVoiceToText={true}
          enableTextEditing={false}
          autoCompleteOnTranscription={true}
        />
        
        {openAIError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{openAIError}</Text>
            <TouchableOpacity onPress={clearError} style={styles.errorDismiss}>
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
    </SafeAreaView>
  );
}

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
});