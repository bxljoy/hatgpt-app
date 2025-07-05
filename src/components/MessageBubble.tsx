import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  onRetry?: () => void;
  onPlayAudio?: () => void;
  isAudioPlaying?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export function MessageBubble({
  message,
  onRetry,
  onPlayAudio,
  isAudioPlaying,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  
  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(timestamp);
  };

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>Failed to send message</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" color="#666" />
      <Text style={styles.loadingText}>
        {isUser ? 'Sending...' : 'Thinking...'}
      </Text>
    </View>
  );

  const renderAudioButton = () => {
    if (!message.audioUrl) return null;
    
    return (
      <TouchableOpacity
        style={styles.audioButton}
        onPress={onPlayAudio}
        disabled={isAudioPlaying}
      >
        <Text style={styles.audioButtonText}>
          {isAudioPlaying ? '⏸️' : '🔊'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTokenCount = () => {
    if (!message.tokenCount) return null;
    
    return (
      <Text style={styles.tokenCount}>
        {message.tokenCount} tokens
      </Text>
    );
  };

  return (
    <View style={[
      styles.messageContainer,
      isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
        message.error && styles.errorBubble,
      ]}>
        {message.isLoading ? (
          renderLoadingIndicator()
        ) : (
          <>
            <Text style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.assistantMessageText,
            ]}>
              {message.content}
            </Text>
            
            {message.error && renderError()}
            
            <View style={styles.messageFooter}>
              <Text style={[
                styles.timestamp,
                isUser ? styles.userTimestamp : styles.assistantTimestamp,
              ]}>
                {formatTime(message.timestamp)}
              </Text>
              
              {renderTokenCount()}
              {renderAudioButton()}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    maxWidth: '100%',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: isTablet ? '60%' : '75%',
    minWidth: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: '#F2F2F7',
    borderBottomLeftRadius: 6,
  },
  errorBubble: {
    backgroundColor: '#FF3B30',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#000000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
  },
  userTimestamp: {
    color: '#FFFFFF',
  },
  assistantTimestamp: {
    color: '#666666',
  },
  tokenCount: {
    fontSize: 11,
    color: '#666666',
    opacity: 0.6,
    marginLeft: 8,
  },
  audioButton: {
    marginLeft: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  audioButtonText: {
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
  errorContainer: {
    marginTop: 6,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});