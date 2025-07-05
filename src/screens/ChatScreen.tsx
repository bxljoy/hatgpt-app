import React, { useState, useEffect, useRef } from 'react';
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
import { useRoute, RouteProp } from '@react-navigation/native';
import { MessageBubble } from '@/components/MessageBubble';
import { ChatInputWithVoice } from '@/components/ChatInputWithVoice';
import { useOpenAI } from '@/hooks/useOpenAI';
import { Message } from '@/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { convertOpenAIResponseToMessage, generateConversationTitle, getSystemPrompt } from '@/utils/openai';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null);
  const [conversationId] = useState(() => route.params?.conversationId || `conv_${Date.now()}`);
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
    onSuccess: (response) => {
      try {
        const assistantMessage = convertOpenAIResponseToMessage(response, conversationId);
        setMessages(prev => [...prev, assistantMessage]);
        scrollToBottom();
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
    // Load existing conversation if conversationId is provided
    if (route.params?.conversationId) {
      loadConversation(route.params.conversationId);
    }
  }, [route.params?.conversationId]);

  const loadConversation = async (conversationId: string) => {
    try {
      setIsLoading(true);
      // TODO: Implement conversation loading from storage
      // const conversation = await loadConversationFromStorage(conversationId);
      // setMessages(conversation.messages);
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

  const handleSendMessage = async (messageContent: string, type: 'text' | 'voice' = 'text') => {
    if (!messageContent.trim()) return;

    const userMessage: Message = {
      id: generateMessageId(),
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
      metadata: type === 'voice' ? { inputType: 'voice' } : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    scrollToBottom();

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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
          enableTextEditing={true}
          autoCompleteOnTranscription={false}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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