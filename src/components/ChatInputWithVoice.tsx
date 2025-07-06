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
  Alert,
  Linking,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { VoiceInputModal } from './VoiceInputModal';

interface ChatInputWithVoiceProps {
  onSendMessage: (message: string, type: 'text' | 'voice') => void;
  onImageMessage?: (imageUri: string, prompt: string) => void;
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
  onImageMessage,
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
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const canSend = (message.trim().length > 0 || selectedImageUri) && !disabled && !isProcessing;
  const canUseVoice = enableVoiceToText && !disabled && !isProcessing;

  const handleSend = () => {
    if (canSend) {
      if (selectedImageUri && onImageMessage) {
        // Send image with prompt
        const prompt = message.trim() || 'Analyze this image';
        onImageMessage(selectedImageUri, prompt);
        setSelectedImageUri(null);
      } else {
        // Send regular text message
        onSendMessage(message.trim(), 'text');
      }
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

  const handleImageUpload = async () => {
    if (!onImageMessage) return;

    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          'Photo Access Required',
          'To upload and analyze images, please:\n\n1. Go to iPhone Settings\n2. Find this app\n3. Tap "Photos"\n4. Select "All Photos" or "Selected Photos"',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  // Try multiple approaches to get as close as possible
                  
                  // Method 1: Try to open directly to app settings (iOS 8+)
                  Linking.openURL('app-settings:').catch(() => {
                    
                    // Method 2: Try to open Photos privacy settings (may not work on newer iOS)
                    Linking.openURL('App-Prefs:Privacy&path=PHOTOS').catch(() => {
                      
                      // Method 3: Try to open Privacy settings
                      Linking.openURL('App-Prefs:Privacy').catch(() => {
                        
                        // Method 4: Fallback to main Settings app
                        Linking.openURL('App-Prefs:').catch(() => {
                          console.log('Cannot open settings - user needs to navigate manually');
                        });
                      });
                    });
                  });
                }
              }
            }
          ]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedImageUri(asset.uri);
        setIsExpanded(true); // Expand input to show image attachment
        
        // Focus on text input to encourage adding a prompt
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
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

  const handleRemoveImage = () => {
    setSelectedImageUri(null);
    setIsExpanded(false);
  };

  const handleTextChange = (text: string) => {
    setMessage(text);
    setIsExpanded(text.length > 50 || text.includes('\n') || selectedImageUri !== null);
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    if (message.length <= 50 && !message.includes('\n') && !selectedImageUri) {
      setIsExpanded(false);
    }
  };

  const renderActionButton = () => {
    const hasInput = message.trim().length > 0 || selectedImageUri !== null;
    
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

  const renderImageAttachment = () => {
    if (!selectedImageUri) return null;

    return (
      <View style={styles.imageAttachment}>
        <Image source={{ uri: selectedImageUri }} style={styles.attachedImage} />
        <TouchableOpacity 
          style={styles.removeImageButton}
          onPress={handleRemoveImage}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Text style={styles.removeImageText}>×</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <View style={[
        styles.container,
        { paddingBottom: insets.bottom || 16 },
      ]}>
        <View style={styles.inputWrapper}>
          {/* Input Container - Full Width */}
          <View style={[
            styles.inputContainer,
            isExpanded && styles.inputContainerExpanded,
            disabled && styles.inputContainerDisabled,
          ]}>
            {renderImageAttachment()}
            <View style={styles.textInputContainer}>
              <TextInput
                ref={textInputRef}
                style={[
                  styles.textInput,
                  isExpanded && styles.textInputExpanded,
                  selectedImageUri && styles.textInputWithImage,
                ]}
                value={message}
                onChangeText={handleTextChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={selectedImageUri ? "Add a message about this image..." : placeholder}
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
            </View>
          </View>
          
          {/* Button Row - Below Input */}
          <View style={styles.buttonRow}>
            <View style={styles.leftButtons}>
              {onImageMessage && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.imageButton,
                    !disabled ? styles.imageButtonActive : styles.actionButtonDisabled,
                  ]}
                  onPress={handleImageUpload}
                  disabled={disabled}
                >
                  <Text style={styles.imageButtonText}>📷</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.rightButtons}>
              {renderCharacterCount()}
              {renderActionButton()}
            </View>
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
  inputWrapper: {
    maxWidth: isTablet ? '80%' : '100%',
    alignSelf: isTablet ? 'center' : 'stretch',
  },
  inputContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
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
    width: '100%',
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
  textInputWithImage: {
    minHeight: 40,
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
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginRight: 8,
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
  imageButton: {
    // Specific styles for image button
  },
  imageButtonActive: {
    backgroundColor: '#FF9500',
  },
  imageButtonText: {
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
  imageAttachment: {
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  attachedImage: {
    width: 120,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
  },
});