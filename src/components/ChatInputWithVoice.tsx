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
import * as Haptics from 'expo-haptics';

import { VoiceInputModal } from './VoiceInputModal';

interface ChatInputWithVoiceProps {
  onSendMessage: (message: string, type: 'text' | 'voice') => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  language?: string;
  enableVoiceToText?: boolean;
  enableTextEditing?: boolean;
  autoCompleteOnTranscription?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export function ChatInputWithVoice({
  onSendMessage,
  isProcessing = false,
  disabled = false,
  placeholder = 'Type a message or use voice...',
  maxLength = 4000,
  language,
  enableVoiceToText = true,
  enableTextEditing = true,
  autoCompleteOnTranscription = false,
}: ChatInputWithVoiceProps) {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const canSend = message.trim().length > 0 && !disabled && !isProcessing;
  const canUseVoice = enableVoiceToText && !disabled && !isProcessing;

  const handleSend = () => {
    if (canSend) {
      onSendMessage(message.trim(), 'text');
      setMessage('');
      setIsExpanded(false);
    }
  };

  const handleVoiceInput = () => {
    if (canUseVoice) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowVoiceModal(true);
    }
  };

  const handleVoiceTextConfirmed = (text: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSendMessage(text, 'voice');
    setShowVoiceModal(false);
  };

  const handleVoiceCancel = () => {
    setShowVoiceModal(false);
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
        <View style={[styles.actionButton, styles.sendButton, styles.actionButtonDisabled]}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.sendButton,
          canSend ? styles.sendButtonActive : styles.actionButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!canSend}
      >
        <Text style={styles.sendButtonText}>➤</Text>
      </TouchableOpacity>
    );
  };

  const renderVoiceButton = () => {
    if (!enableVoiceToText) return null;

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.voiceButton,
          canUseVoice ? styles.voiceButtonActive : styles.actionButtonDisabled,
        ]}
        onPress={handleVoiceInput}
        disabled={!canUseVoice}
      >
        <Text style={styles.voiceButtonText}>🎤</Text>
      </TouchableOpacity>
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

  const renderInputIndicator = () => {
    if (!isExpanded && message.length === 0 && enableVoiceToText) {
      return (
        <View style={styles.inputIndicator}>
          <Text style={styles.inputIndicatorText}>
            💬 Type or 🎤 Voice
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <>
      <View style={[
        styles.container,
        { paddingBottom: insets.bottom || 16 },
      ]}>
        <View style={[
          styles.inputContainer,
          isExpanded && styles.inputContainerExpanded,
          disabled && styles.inputContainerDisabled,
        ]}>
          <View style={styles.textInputContainer}>
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
            {renderInputIndicator()}
          </View>
          
          <View style={styles.buttonContainer}>
            {renderCharacterCount()}
            {renderVoiceButton()}
            {renderSendButton()}
          </View>
        </View>
      </View>

      {/* Voice Input Modal */}
      <VoiceInputModal
        isVisible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onTextConfirmed={handleVoiceTextConfirmed}
        onCancel={handleVoiceCancel}
        maxRecordingDuration={300000} // 5 minutes
        language={language}
        enableTextEditing={enableTextEditing}
        autoCompleteOnTranscription={autoCompleteOnTranscription}
        placeholder="Tap the microphone to start recording your voice message"
      />
    </>
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
  textInputContainer: {
    flex: 1,
    position: 'relative',
  },
  textInput: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
    maxHeight: 120,
    minHeight: 32,
  },
  textInputExpanded: {
    maxHeight: 200,
  },
  inputIndicator: {
    position: 'absolute',
    right: 8,
    top: 6,
    pointerEvents: 'none',
  },
  inputIndicatorText: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 8,
    gap: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 6,
  },
  characterCountWarning: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  actionButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButton: {
    // Specific styles for send button
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  sendButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  voiceButton: {
    // Specific styles for voice button
  },
  voiceButtonActive: {
    backgroundColor: '#00C851',
  },
  voiceButtonText: {
    fontSize: 16,
  },
});