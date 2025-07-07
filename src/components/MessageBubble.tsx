import React, { memo, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  onRetry?: () => void;
  onPlayAudio?: () => void;
  isAudioPlaying?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

const MessageBubbleComponent = ({
  message,
  onRetry,
  onPlayAudio,
  isAudioPlaying,
}: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  
  // Memoize expensive calculations
  const formattedTime = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(message.timestamp);
  }, [message.timestamp]);

  // Memoize style calculations
  const containerStyle = useMemo(() => [
    styles.messageContainer,
    isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
  ], [isUser]);

  const bubbleStyle = useMemo(() => [
    isUser ? styles.userBubble : styles.assistantMessage,
    message.error && styles.errorBubble,
  ], [isUser, message.error]);

  // Markdown styles for assistant messages
  const markdownStyles = useMemo(() => ({
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: '#000000',
      fontFamily: Platform.OS === 'ios' ? 'San Francisco' : 'Roboto',
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
      fontSize: 16,
      lineHeight: 24,
      color: '#000000',
    },
    strong: {
      fontWeight: '600',
      color: '#000000',
    },
    em: {
      fontStyle: 'italic',
      color: '#000000',
    },
    list_item: {
      marginBottom: 4,
      fontSize: 16,
      lineHeight: 24,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    heading1: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 12,
      color: '#000000',
    },
    heading2: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 6,
      marginTop: 10,
      color: '#000000',
    },
    heading3: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
      marginTop: 8,
      color: '#000000',
    },
    code_inline: {
      backgroundColor: '#F5F5F5',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    code_block: {
      backgroundColor: '#F5F5F5',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      fontSize: 14,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    blockquote: {
      backgroundColor: '#F9F9F9',
      borderLeftWidth: 4,
      borderLeftColor: '#E0E0E0',
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
  }), []);

  const messageTextStyle = useMemo(() => [
    styles.messageText,
    isUser ? styles.userMessageText : styles.assistantMessageText,
  ], [isUser]);

  const timestampStyle = useMemo(() => [
    styles.timestamp,
    isUser ? styles.userTimestamp : styles.assistantTimestamp,
  ], [isUser]);

  // Memoize render functions
  const renderError = useCallback(() => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>Failed to send message</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [onRetry]);

  const renderLoadingIndicator = useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" color="#666" />
      <Text style={styles.loadingText}>
        {isUser ? 'Sending...' : 'Thinking...'}
      </Text>
    </View>
  ), [isUser]);

  const renderAudioButton = useCallback(() => {
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
  }, [message.audioUrl, onPlayAudio, isAudioPlaying]);

  const renderTokenCount = useCallback(() => {
    if (!message.tokenCount) return null;
    
    return (
      <Text style={styles.tokenCount}>
        {message.tokenCount} tokens
      </Text>
    );
  }, [message.tokenCount]);

  const renderImage = useCallback(() => {
    const imageSource = message.imageUrl || (message.imageBase64 ? `data:image/jpeg;base64,${message.imageBase64}` : null);
    if (!imageSource) return null;
    
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageSource }}
          style={styles.messageImage}
          resizeMode="cover"
        />
      </View>
    );
  }, [message.imageUrl, message.imageBase64]);

  if (isUser) {
    // User message with bubble
    return (
      <View style={containerStyle}>
        <View style={bubbleStyle}>
          {message.isLoading ? (
            renderLoadingIndicator()
          ) : (
            <>
              {renderImage()}
              
              <Text style={messageTextStyle}>
                {message.content}
              </Text>
              
              {message.error && renderError()}
              
              <View style={styles.messageFooter}>
                <Text style={timestampStyle}>
                  {formattedTime}
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

  // Assistant message - full width, no bubble
  return (
    <View style={styles.assistantContainer}>
      <View style={styles.assistantAvatar}>
        <Text style={styles.assistantAvatarText}>🎩</Text>
      </View>
      
      <View style={styles.assistantContent}>
        {message.isLoading ? (
          renderLoadingIndicator()
        ) : (
          <>
            {renderImage()}
            
            <Markdown style={markdownStyles}>
              {message.content}
            </Markdown>
            
            {message.error && renderError()}
            
            <View style={styles.assistantFooter}>
              <Text style={timestampStyle}>
                {formattedTime}
              </Text>
              
              {renderTokenCount()}
              {renderAudioButton()}
            </View>
          </>
        )}
      </View>
    </View>
  );
};

// Export memoized component with custom comparison
export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isLoading === nextProps.message.isLoading &&
    prevProps.message.error === nextProps.message.error &&
    prevProps.message.imageUrl === nextProps.message.imageUrl &&
    prevProps.message.imageBase64 === nextProps.message.imageBase64 &&
    prevProps.isAudioPlaying === nextProps.isAudioPlaying &&
    prevProps.message.timestamp.getTime() === nextProps.message.timestamp.getTime()
  );
});

const styles = StyleSheet.create({
  messageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    maxWidth: '100%',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  userBubble: {
    maxWidth: isTablet ? '85%' : '90%',
    minWidth: 60,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  assistantMessage: {
    // This is not used anymore - replaced by assistantContainer
  },
  // New ChatGPT-style assistant layout
  assistantContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
    width: '100%',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10A37F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  assistantAvatarText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  assistantContent: {
    flex: 1,
    paddingRight: 16,
  },
  assistantFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'flex-start',
  },
  errorBubble: {
    backgroundColor: '#FF3B30',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
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
  imageContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
});