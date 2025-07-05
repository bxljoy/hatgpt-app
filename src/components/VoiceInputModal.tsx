import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useVoiceToText, VoiceToTextState } from '@/hooks/useVoiceToText';
import { VoiceRecordButtonAdvanced } from './VoiceRecordButtonAdvanced';
import { AudioProcessingLoader } from './AudioProcessingLoader';
import { VoiceErrorState } from './VoiceErrorState';

interface VoiceInputModalProps {
  isVisible: boolean;
  onClose: () => void;
  onTextConfirmed: (text: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  maxRecordingDuration?: number;
  language?: string;
  enableTextEditing?: boolean;
  autoCompleteOnTranscription?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function VoiceInputModal({
  isVisible,
  onClose,
  onTextConfirmed,
  onCancel,
  placeholder = "Tap the microphone to start recording",
  maxRecordingDuration = 300000, // 5 minutes
  language,
  enableTextEditing = true,
  autoCompleteOnTranscription = false,
}: VoiceInputModalProps) {
  const [editableText, setEditableText] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Animation refs
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Voice-to-text hook
  const {
    state,
    progress,
    result,
    error,
    canCancel,
    canRetry,
    startRecording,
    stopRecording,
    startTranscription,
    retryTranscription,
    updateText,
    confirmText,
    cancel,
    reset,
    formatDuration,
    getStateMessage,
    isProcessing,
  } = useVoiceToText({
    maxRecordingDuration,
    language,
    autoCompleteOnTranscription,
    enableTextEditing,
    onStateChange: (progress) => {
      // Trigger haptic feedback for state changes
      if (progress.state === 'recording') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (progress.state === 'transcribing') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (progress.state === 'completed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (progress.state === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    onResult: (result) => {
      setEditableText(result.text);
      if (autoCompleteOnTranscription) {
        handleConfirmText(result.text);
      }
    },
    onError: (error, errorState) => {
      console.error(`Voice input error in ${errorState}:`, error);
    },
  });

  // Handle modal animation
  useEffect(() => {
    if (isVisible) {
      // Show modal
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide modal
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  // Pulse animation for recording state
  useEffect(() => {
    if (state === 'recording') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [state]);

  // Update editable text when result changes
  useEffect(() => {
    if (result && enableTextEditing) {
      setEditableText(result.text);
    }
  }, [result, enableTextEditing]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isVisible) {
      setTimeout(() => {
        reset();
        setEditableText('');
        setShowConfirmation(false);
      }, 300);
    }
  }, [isVisible, reset]);

  const handleClose = () => {
    if (isProcessing) {
      cancel();
    }
    onClose();
  };

  const handleCancel = () => {
    cancel();
    onCancel?.();
    onClose();
  };

  const handleConfirmText = (text?: string) => {
    const finalText = text || editableText.trim();
    if (finalText) {
      setShowConfirmation(true);
      setTimeout(() => {
        onTextConfirmed(finalText);
        onClose();
      }, 200);
    }
  };


  const getButtonState = (): 'idle' | 'recording' | 'processing' => {
    if (state === 'recording') return 'recording';
    if (isProcessing) return 'processing';
    return 'idle';
  };

  const getStatusTextStyle = () => {
    switch (state) {
      case 'recording':
        return { color: '#FF3B30' };
      case 'transcribing':
        return { color: '#FF9500' };
      case 'completed':
        return { color: '#00C851' };
      case 'error':
        return { color: '#FF3B30' };
      default:
        return { color: '#666666' };
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Text style={styles.closeButtonText}>×</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Voice Input</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderRecordingInterface = () => (
    <View style={styles.recordingContainer}>
      <Animated.View style={[
        styles.recordButtonContainer,
        { transform: [{ scale: pulseAnim }] }
      ]}>
        <VoiceRecordButtonAdvanced
          size={120}
          onRecordingStart={() => startRecording()}
          onRecordingComplete={(uri, duration) => {
            // Handle recording completion
            stopRecording();
          }}
          onRecordingError={(error) => {
            console.error('Recording error:', error);
          }}
          disabled={state === 'transcribing' || state === 'editing'}
          maxDuration={maxRecordingDuration}
          quality="medium"
          style={styles.recordButton}
        />
      </Animated.View>

      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, getStatusTextStyle()]}>
          {getStateMessage()}
        </Text>
        
        {!!progress.recordingDuration && state === 'recording' && (
          <Text style={styles.durationText}>
            {formatDuration(progress.recordingDuration)}
          </Text>
        )}

        {!!result?.confidence && (
          <Text style={styles.confidenceText}>
            Confidence: {Math.round((result.confidence || 0) * 100)}%
          </Text>
        )}
      </View>
    </View>
  );

  const renderProgressIndicator = () => {
    if (!isProcessing) return null;

    return (
      <View style={styles.progressContainer}>
        <AudioProcessingLoader
          isVisible={true}
          type={state === 'transcribing' ? 'transcribing' : 'processing'}
          message={getStateMessage()}
          progress={progress.transcriptionProgress}
          size="small"
        />
        
        {progress.transcriptionProgress !== undefined && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressBarFill,
                  { width: `${progress.transcriptionProgress || 0}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress.transcriptionProgress || 0)}%
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTextEditor = () => {
    if (state !== 'editing' || !enableTextEditing) return null;

    return (
      <View style={styles.editorContainer}>
        <Text style={styles.editorTitle}>Edit Transcription</Text>
        <ScrollView style={styles.editorScrollView}>
          <TextInput
            style={styles.textInput}
            value={editableText}
            onChangeText={(text) => {
              setEditableText(text);
              updateText(text);
            }}
            placeholder="Edit your transcription..."
            placeholderTextColor="#999999"
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </ScrollView>
        
        <View style={styles.editorActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelActionButton]}
            onPress={handleCancel}
          >
            <Text style={styles.cancelActionText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.confirmActionButton]}
            onPress={() => handleConfirmText()}
            disabled={!editableText.trim()}
          >
            <Text style={styles.confirmActionText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderErrorState = () => {
    if (state !== 'error' || !error) return null;

    return (
      <VoiceErrorState
        isVisible={true}
        error={error}
        errorType="processing"
        onRetry={canRetry ? retryTranscription : undefined}
        onDismiss={() => reset()}
        size="medium"
        style={styles.errorState}
      />
    );
  };

  const renderActions = () => {
    if (state === 'editing' || isProcessing) return null;

    return (
      <View style={styles.actionsContainer}>
        {canCancel && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {state === 'processing' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.transcribeButton]}
            onPress={startTranscription}
          >
            <Text style={styles.transcribeButtonText}>Start Transcription</Text>
          </TouchableOpacity>
        )}

        {state === 'completed' && result && !autoCompleteOnTranscription && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.sendButton]}
            onPress={() => handleConfirmText()}
          >
            <Text style={styles.sendButtonText}>Send Message</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <SafeAreaView style={styles.safeArea}>
              <LinearGradient
                colors={['#FFFFFF', '#F8F9FA']}
                style={styles.gradient}
              >
                {renderHeader()}
                
                <ScrollView 
                  style={styles.content}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.contentContainer}
                >
                  {renderRecordingInterface()}
                  {renderProgressIndicator()}
                  {renderTextEditor()}
                  {renderErrorState()}
                </ScrollView>

                {renderActions()}

                {showConfirmation && (
                  <View style={styles.confirmationOverlay}>
                    <Text style={styles.confirmationText}>Message Sent!</Text>
                  </View>
                )}
              </LinearGradient>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: screenHeight * 0.8,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666666',
    fontWeight: '500',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  recordingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  recordButtonContainer: {
    marginBottom: 30,
  },
  recordButton: {
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  statusContainer: {
    alignItems: 'center',
    minHeight: 60,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  durationText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: '#666666',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    minWidth: 40,
  },
  editorContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  editorScrollView: {
    flex: 1,
    maxHeight: 200,
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  editorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  errorState: {
    marginVertical: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  cancelActionButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  transcribeButton: {
    backgroundColor: '#007AFF',
  },
  transcribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sendButton: {
    backgroundColor: '#00C851',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmActionButton: {
    backgroundColor: '#007AFF',
  },
  confirmActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 200, 81, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});