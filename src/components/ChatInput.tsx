import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoiceRecordButton } from './VoiceRecordButton';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onVoiceMessage?: (uri: string, duration: number) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export function ChatInput({
  onSendMessage,
  onVoiceMessage,
  isProcessing = false,
  disabled = false,
  placeholder = 'Type a message...',
  maxLength = 4000,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const canSend = message.trim().length > 0 && !disabled && !isProcessing;
  const canRecord = onVoiceMessage && !disabled && !isProcessing;

  const handleSend = () => {
    if (canSend) {
      onSendMessage(message.trim());
      setMessage('');
      setIsExpanded(false);
    }
  };

  const handleVoiceRecording = (uri: string, duration: number) => {
    onVoiceMessage?.(uri, duration);
  };

  const handleTextChange = (text: string) => {
    setMessage(text);
    setIsExpanded(text.length > 50 || text.includes('\n'));
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    if (message.length <= 50 && !message.includes('\n')) {
      setIsExpanded(false);
    }
  };

  const renderSendButton = () => {
    if (isProcessing) {
      return (
        <View style={[styles.sendButton, styles.sendButtonDisabled]}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.sendButton,
          canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!canSend}
      >
        <Text style={styles.sendButtonText}>➤</Text>
      </TouchableOpacity>
    );
  };

  const renderRecordButton = () => {
    if (!canRecord) return null;

    return (
      <VoiceRecordButton
        onRecordingComplete={handleVoiceRecording}
        disabled={disabled || isProcessing}
        size={32}
        maxDuration={300000} // 5 minutes
        quality="medium"
      />
    );
  };

  const renderCharacterCount = () => {
    const remaining = maxLength - message.length;
    const showCount = remaining < 100;
    
    if (!showCount) return null;

    return (
      <Text style={[
        styles.characterCount,
        remaining < 20 && styles.characterCountWarning,
      ]}>
        {remaining}
      </Text>
    );
  };

  return (
    <View style={[
      styles.container,
      { paddingBottom: insets.bottom || 16 },
    ]}>
      <View style={[
        styles.inputContainer,
        isExpanded && styles.inputContainerExpanded,
        disabled && styles.inputContainerDisabled,
      ]}>
        <TextInput
          ref={textInputRef}
          style={[
            styles.textInput,
            isExpanded && styles.textInputExpanded,
          ]}
          value={message}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
          editable={!disabled}
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          enablesReturnKeyAutomatically
        />
        
        <View style={styles.buttonContainer}>
          {renderCharacterCount()}
          {renderRecordButton()}
          {renderSendButton()}
        </View>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
    maxWidth: isTablet ? '80%' : '100%',
    alignSelf: isTablet ? 'center' : 'stretch',
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
  inputContainerExpanded: {
    borderRadius: 16,
    paddingVertical: 12,
  },
  inputContainerDisabled: {
    opacity: 0.6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
    maxHeight: 120,
    minHeight: 32,
  },
  textInputExpanded: {
    maxHeight: 200,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginRight: 8,
    marginBottom: 6,
  },
  characterCountWarning: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});