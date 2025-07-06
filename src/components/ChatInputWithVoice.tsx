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
  onEnterVoiceMode?: () => void;
  onNewConversation?: () => void;
  hideButtons?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export function ChatInputWithVoice({
  onSendMessage,
  isProcessing = false,
  disabled = false,
  placeholder = 'Message...',
  maxLength = 4000,
  language,
  enableVoiceToText = true,
  enableTextEditing = true,
  autoCompleteOnTranscription = false,
  onEnterVoiceMode,
  onNewConversation,
  hideButtons = false,
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

  const handleConversationMode = () => {
    if (onEnterVoiceMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onEnterVoiceMode();
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

  const renderActionButton = () => {
    const hasInput = message.trim().length > 0;
    
    if (isProcessing) {
      return (
        <View style={[styles.actionButton, styles.sendButton, styles.actionButtonDisabled]}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      );
    }

    if (hasInput) {
      // Show send button when there's input
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
    } else {
      // Show conversation mode button when no input
      return (
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.conversationButton,
            !disabled ? styles.conversationButtonActive : styles.actionButtonDisabled,
          ]}
          onPress={handleConversationMode}
          disabled={disabled}
        >
          <View style={styles.soundWaveIcon}>
            <View style={[styles.soundWaveLine, styles.soundWaveLine1]} />
            <View style={[styles.soundWaveLine, styles.soundWaveLine2]} />
            <View style={[styles.soundWaveLine, styles.soundWaveLine3]} />
            <View style={[styles.soundWaveLine, styles.soundWaveLine4]} />
            <View style={[styles.soundWaveLine, styles.soundWaveLine3]} />
            <View style={[styles.soundWaveLine, styles.soundWaveLine2]} />
            <View style={[styles.soundWaveLine, styles.soundWaveLine1]} />
          </View>
        </TouchableOpacity>
      );
    }
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
    // Removed the indicator to keep input area clean
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
            {renderActionButton()}
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
        placeholder="Tap to record"
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
  conversationButton: {
    // Specific styles for conversation button
  },
  conversationButtonActive: {
    backgroundColor: '#10A37F',
  },
  conversationButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  soundWaveIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 12,
    gap: 1.5,
  },
  soundWaveLine: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0.5,
    width: 1.5,
  },
  soundWaveLine1: {
    height: 4,
  },
  soundWaveLine2: {
    height: 8,
  },
  soundWaveLine3: {
    height: 12,
  },
  soundWaveLine4: {
    height: 6,
  },
});