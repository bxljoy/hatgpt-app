import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
  Image,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

interface ImagePromptModalProps {
  isVisible: boolean;
  imageUri: string | null;
  onSend: (prompt: string) => void;
  onCancel: () => void;
  placeholder?: string;
  maxLength?: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function ImagePromptModal({
  isVisible,
  imageUri,
  onSend,
  onCancel,
  placeholder = "Describe what you want to know about this image...",
  maxLength = 500,
}: ImagePromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const textInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // Focus input when modal opens
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 300);
    } else {
      setPrompt(''); // Clear prompt when modal closes
    }
  }, [isVisible]);

  const handleSend = () => {
    const finalPrompt = prompt.trim() || 'Analyze this image';
    onSend(finalPrompt);
  };

  const canSend = prompt.trim().length > 0;

  // Suggested prompts
  const suggestedPrompts = [
    "What do you see in this image?",
    "Describe this image in detail",
    "What text is in this image?",
    "Explain what's happening here",
    "Identify objects in this image",
  ];

  const handleSuggestedPrompt = (suggestedPrompt: string) => {
    setPrompt(suggestedPrompt);
  };

  if (!isVisible || !imageUri) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <BlurView intensity={20} style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.modal, { paddingBottom: insets.bottom + 20 }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={onCancel} 
                style={styles.cancelButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Image Analysis</Text>
              <TouchableOpacity
                onPress={handleSend}
                style={[
                  styles.sendButton,
                  canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
                ]}
                disabled={!canSend}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Image Preview */}
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              </View>

              {/* Prompt Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>What would you like to know about this image?</Text>
                <TextInput
                  ref={textInputRef}
                  style={styles.textInput}
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder={placeholder}
                  placeholderTextColor="#8E8E93"
                  multiline
                  maxLength={maxLength}
                  returnKeyType="default"
                  blurOnSubmit={false}
                />
                <Text style={styles.characterCount}>
                  {maxLength - prompt.length} characters remaining
                </Text>
              </View>

              {/* Suggested Prompts */}
              <View style={styles.suggestionsSection}>
                <Text style={styles.suggestionsTitle}>Quick suggestions:</Text>
                <View style={styles.suggestionsGrid}>
                  {suggestedPrompts.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionButton}
                      onPress={() => handleSuggestedPrompt(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.9,
    minHeight: screenHeight * 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    minHeight: 64,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 80,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  sendButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    minWidth: 80,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  imagePreview: {
    width: screenWidth * 0.7,
    height: screenWidth * 0.5,
    borderRadius: 12,
  },
  inputSection: {
    marginTop: 8,
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    ...Platform.select({
      ios: {
        paddingTop: 12,
      },
    }),
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'right',
  },
  suggestionsSection: {
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  suggestionsGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  suggestionButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  suggestionText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
  },
});