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

import { VoiceRecordingOverlay } from './VoiceRecordingOverlay';
import { useVoiceToText } from '../hooks/useVoiceToText';

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
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // Voice-to-text functionality
  const voiceToText = useVoiceToText({
    autoCompleteOnTranscription: true,
    enableTextEditing: false,
    onResult: (result) => {
      if (result.text.trim()) {
        onSendMessage(result.text.trim(), 'voice');
      }
      setShowVoiceModal(false);
    },
    onError: (error) => {
      console.error('Voice transcription error:', error);
      Alert.alert('Voice Error', error);
      setShowVoiceModal(false);
    },
    onCancel: () => {
      setShowVoiceModal(false);
    },
  });

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

  const handleVoiceInput = async () => {
    if (canUseVoice) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowVoiceModal(true);
      try {
        await voiceToText.startRecording();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setShowVoiceModal(false);
      }
    }
  };

  const handleConversationMode = () => {
    if (onEnterVoiceMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onEnterVoiceMode();
    }
  };

  const handleGalleryPick = async () => {
    if (!onImageMessage) return;
    setShowAttachmentMenu(false);

    try {
      // Request photo library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          'Photo Access Required',
          'To upload and analyze images, please:\n\n1. Go to iPhone Settings\n2. Find this app\n3. Tap "Photos"\n4. Select "All Photos" or "Selected Photos"',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => openAppSettings('photos')
            }
          ]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedImageUri(asset.uri);
        setIsExpanded(true);
        
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleCameraCapture = async () => {
    if (!onImageMessage) return;
    setShowAttachmentMenu(false);

    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraPermission.granted === false) {
        Alert.alert(
          'Camera Access Required',
          'To take photos, please:\n\n1. Go to iPhone Settings\n2. Find this app\n3. Tap "Camera"\n4. Enable camera access',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => openAppSettings('camera')
            }
          ]
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedImageUri(asset.uri);
        setIsExpanded(true);
        
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleAttachmentPress = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
  };

  const openAppSettings = (type: 'photos' | 'camera') => {
    if (Platform.OS === 'ios') {
      // Try multiple approaches to get as close as possible to the right settings
      const settingsUrls = [
        'app-settings:', // Direct app settings
        'App-Prefs:Privacy&path=CAMERA', // Camera privacy (might not work on newer iOS)
        'App-Prefs:Privacy&path=PHOTOS', // Photos privacy (might not work on newer iOS)
        'App-Prefs:Privacy', // Privacy settings
        'App-Prefs:' // Main settings
      ];

      const tryUrl = (index: number) => {
        if (index >= settingsUrls.length) {
          console.log('All settings URLs failed - user needs to navigate manually');
          return;
        }

        Linking.openURL(settingsUrls[index]).catch(() => {
          tryUrl(index + 1);
        });
      };

      tryUrl(0);
    }
  };

  const handleVoiceCancel = () => {
    voiceToText.cancel();
    setShowVoiceModal(false);
  };

  const handleStopListening = async () => {
    try {
      await voiceToText.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setShowVoiceModal(false);
    }
  };

  const handleToggleListening = () => {
    if (voiceToText.state === 'recording') {
      handleStopListening();
    }
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

  const renderAttachmentMenu = () => {
    if (!showAttachmentMenu) return null;

    return (
      <View style={styles.attachmentMenuContainer}>
        <View style={styles.attachmentMenu}>
          <TouchableOpacity 
            style={styles.attachmentMenuItem}
            onPress={handleCameraCapture}
            activeOpacity={0.7}
          >
            <View style={styles.attachmentMenuIcon}>
              <Text style={styles.attachmentMenuIconText}>📷</Text>
            </View>
            <Text style={styles.attachmentMenuText}>Camera</Text>
          </TouchableOpacity>
          
          <View style={styles.attachmentMenuDivider} />
          
          <TouchableOpacity 
            style={styles.attachmentMenuItem}
            onPress={handleGalleryPick}
            activeOpacity={0.7}
          >
            <View style={styles.attachmentMenuIcon}>
              <Text style={styles.attachmentMenuIconText}>🖼️</Text>
            </View>
            <Text style={styles.attachmentMenuText}>Photo Library</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Overlay to close attachment menu */}
      {showAttachmentMenu && (
        <TouchableOpacity 
          style={styles.menuOverlay}
          onPress={() => setShowAttachmentMenu(false)}
          activeOpacity={1}
        />
      )}
      
      <View style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom - 8, 4) },
      ]}>
        <View style={styles.inputWrapper}>
          {/* Main Input Row */}
          <View style={styles.mainInputRow}>
            {/* Plus Button */}
            {onImageMessage && (
              <View>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.attachmentButton,
                    !disabled ? styles.attachmentButtonActive : styles.actionButtonDisabled,
                  ]}
                  onPress={handleAttachmentPress}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text style={styles.attachmentButtonText}>+</Text>
                </TouchableOpacity>
                {renderAttachmentMenu()}
              </View>
            )}
            
            {/* Input Container */}
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
            
            {/* Microphone Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.voiceButton,
                canUseVoice ? styles.voiceButtonActive : styles.actionButtonDisabled,
              ]}
              onPress={handleVoiceInput}
              disabled={!canUseVoice}
              activeOpacity={0.7}
            >
              <Text style={styles.voiceButtonText}>🎤</Text>
            </TouchableOpacity>
            
            {/* Voice/Send Button */}
            {renderActionButton()}
          </View>
        </View>
      </View>

      {/* Voice Input Modal */}
      <VoiceRecordingOverlay
        isVisible={showVoiceModal}
        voiceState={voiceToText.state}
        onClose={handleVoiceCancel}
        onStartListening={() => voiceToText.startRecording()}
        onStopListening={handleStopListening}
        onToggleListening={handleToggleListening}
        isListening={voiceToText.state === 'recording'}
        enableHaptics={true}
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
  mainInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: '#E5E5EA',
  },
  voiceButtonActive: {
    backgroundColor: '#E5E5EA',
  },
  voiceButtonText: {
    fontSize: 18,
    color: '#000000',
  },
  conversationButton: {
    // Specific styles for conversation button
  },
  conversationButtonActive: {
    backgroundColor: '#000000',
  },
  conversationButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  attachmentButton: {
    backgroundColor: '#E5E5EA',
  },
  attachmentButtonActive: {
    backgroundColor: '#E5E5EA',
  },
  attachmentButtonText: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '300',
    lineHeight: 18,
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
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  attachmentMenuContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    zIndex: 999,
  },
  attachmentMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  attachmentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachmentMenuIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attachmentMenuIconText: {
    fontSize: 16,
  },
  attachmentMenuText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '400',
  },
  attachmentMenuDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 16,
  },
});