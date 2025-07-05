import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import {
  VoiceRecordButtonAdvanced,
  VoiceInputModal,
  AudioWaveform,
  RecordingTimer,
  AudioProcessingLoader,
  VoiceErrorState,
  WaveformPresets,
  TimerPresets,
  LoaderPresets,
  ErrorPresets,
} from './index';

// Example 1: Simple Voice Record Button
export function SimpleVoiceButtonExample() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecordingComplete = (uri: string, duration: number) => {
    console.log('Recording complete:', { uri, duration });
    Alert.alert('Recording Complete', `Duration: ${Math.round(duration / 1000)}s`);
  };

  return (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <VoiceRecordButtonAdvanced
        size={80}
        quality="high"
        maxDuration={60000} // 1 minute
        onRecordingComplete={handleRecordingComplete}
        onRecordingError={(error) => Alert.alert('Error', error)}
        disabled={isProcessing}
      />
    </View>
  );
}

// Example 2: Full Voice Input Modal
export function VoiceModalExample() {
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecordingComplete = async (uri: string, duration: number) => {
    setIsProcessing(true);
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      Alert.alert('Success', 'Voice message processed!');
    }, 2000);
  };

  return (
    <View>
      <VoiceRecordButtonAdvanced
        size={60}
        onRecordingStart={() => setShowModal(true)}
      />
      
      <VoiceInputModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onRecordingComplete={handleRecordingComplete}
        title="Record Voice Message"
        subtitle="Speak clearly into your microphone"
        maxDuration={300000} // 5 minutes
        quality="medium"
        showWaveform={true}
        showTimer={true}
        autoClose={true}
      />
      
      <AudioProcessingLoader
        isVisible={isProcessing}
        {...LoaderPresets.transcribing}
        size="medium"
      />
    </View>
  );
}

// Example 3: Advanced Audio Visualization
export function AudioVisualizationExample() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  return (
    <View style={{ padding: 20 }}>
      {/* Waveform with different presets */}
      <AudioWaveform
        isActive={isRecording}
        isRecording={isRecording}
        {...WaveformPresets.detailed}
        waveColor="#007AFF"
        style={{ marginBottom: 20 }}
      />
      
      {/* Timer with different configurations */}
      <RecordingTimer
        duration={duration}
        maxDuration={180000} // 3 minutes
        isRecording={isRecording}
        {...TimerPresets.prominent}
        style={{ marginBottom: 20 }}
      />
      
      {/* Control button */}
      <VoiceRecordButtonAdvanced
        size={70}
        onRecordingStart={() => {
          setIsRecording(true);
          // Start duration timer
          const interval = setInterval(() => {
            setDuration(prev => prev + 100);
          }, 100);
          // Store interval ID to clear later
        }}
        onRecordingComplete={() => {
          setIsRecording(false);
          setDuration(0);
        }}
      />
    </View>
  );
}

// Example 4: Error Handling States
export function ErrorHandlingExample() {
  const [showError, setShowError] = useState(false);
  const [errorType, setErrorType] = useState<'permission' | 'network' | 'recording'>('permission');
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setShowError(false);
    
    // Simulate retry logic
    setTimeout(() => {
      if (retryCount < 2) {
        setShowError(true);
      } else {
        Alert.alert('Success', 'Operation completed!');
        setRetryCount(0);
      }
    }, 1000);
  };

  const triggerError = (type: 'permission' | 'network' | 'recording') => {
    setErrorType(type);
    setShowError(true);
    setRetryCount(0);
  };

  return (
    <View style={{ padding: 20 }}>
      {/* Error trigger buttons */}
      <View style={{ marginBottom: 20 }}>
        <VoiceRecordButtonAdvanced
          size={60}
          onRecordingStart={() => triggerError('permission')}
        />
      </View>
      
      {/* Error State Component */}
      <VoiceErrorState
        isVisible={showError}
        {...ErrorPresets.microphonePermission}
        retryCount={retryCount}
        maxRetries={3}
        onRetry={handleRetry}
        onDismiss={() => setShowError(false)}
        onOpenSettings={() => Alert.alert('Settings', 'Opening settings...')}
        size="medium"
      />
    </View>
  );
}

// Example 5: Complete Voice Chat Integration
export function VoiceChatIntegrationExample() {
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showError, setShowError] = useState(false);
  const [processingState, setProcessingState] = useState<{
    type: 'transcribing' | 'processing' | 'uploading';
    progress: number;
  }>({ type: 'transcribing', progress: 0 });

  const handleVoiceMessage = async (uri: string, duration: number) => {
    setShowModal(false);
    setIsProcessing(true);
    
    try {
      // Step 1: Transcribing
      setProcessingState({ type: 'transcribing', progress: 0 });
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setProcessingState(prev => ({ ...prev, progress: i }));
      }
      
      // Step 2: Processing
      setProcessingState({ type: 'processing', progress: 0 });
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 150));
        setProcessingState(prev => ({ ...prev, progress: i }));
      }
      
      // Step 3: Uploading
      setProcessingState({ type: 'uploading', progress: 0 });
      for (let i = 0; i <= 100; i += 25) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setProcessingState(prev => ({ ...prev, progress: i }));
      }
      
      setIsProcessing(false);
      Alert.alert('Success', 'Voice message sent!');
      
    } catch (error) {
      setIsProcessing(false);
      setShowError(true);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {/* Voice input trigger */}
      <VoiceRecordButtonAdvanced
        size={80}
        onRecordingStart={() => setShowModal(true)}
        disabled={isProcessing}
      />
      
      {/* Voice Input Modal */}
      <VoiceInputModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onRecordingComplete={handleVoiceMessage}
        title="Send Voice Message"
        subtitle="Tap and hold to record"
        maxDuration={300000}
        quality="high"
        showWaveform={true}
        showTimer={true}
      />
      
      {/* Processing States */}
      <AudioProcessingLoader
        isVisible={isProcessing}
        type={processingState.type}
        progress={processingState.progress}
        message={
          processingState.type === 'transcribing' ? 'Converting speech to text...' :
          processingState.type === 'processing' ? 'Processing with AI...' :
          'Sending message...'
        }
        size="medium"
      />
      
      {/* Error State */}
      <VoiceErrorState
        isVisible={showError}
        {...ErrorPresets.networkError}
        onRetry={() => {
          setShowError(false);
          setShowModal(true);
        }}
        onDismiss={() => setShowError(false)}
        size="medium"
      />
    </View>
  );
}

// Export all examples
export const VoiceComponentExamples = {
  SimpleVoiceButtonExample,
  VoiceModalExample,
  AudioVisualizationExample,
  ErrorHandlingExample,
  VoiceChatIntegrationExample,
};