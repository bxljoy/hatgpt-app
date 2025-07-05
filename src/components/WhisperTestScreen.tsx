import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useWhisper } from '@/hooks/useWhisper';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { VoiceRecordButtonAdvanced } from './VoiceRecordButtonAdvanced';
import { AudioProcessingLoader } from './AudioProcessingLoader';
import { VoiceErrorState } from './VoiceErrorState';
import { validateAudioFile, formatTranscriptionResult, getOptimalTranscriptionSettings } from '@/utils/whisper';

const { width: screenWidth } = Dimensions.get('window');

interface TranscriptionHistory {
  id: string;
  text: string;
  duration?: number;
  confidence?: number;
  language?: string;
  timestamp: Date;
  fileSize: number;
  processingTime?: number;
}

export function WhisperTestScreen() {
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionHistory[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [showSettings, setShowSettings] = useState(false);

  // Audio recording hook
  const {
    isRecording,
    isProcessing: isRecordingProcessing,
    duration: recordingDuration,
    recordingStatus,
    startRecording,
    stopRecording,
    formatDuration,
  } = useAudioRecorder({
    maxDuration: 300000, // 5 minutes
    quality: 'medium',
    onRecordingComplete: (uri, duration) => {
      handleRecordingComplete(uri, duration);
    },
    onError: (error) => {
      Alert.alert('Recording Error', error);
    },
  });

  // Whisper transcription hook
  const {
    isTranscribing,
    progress,
    error: whisperError,
    lastResult,
    canCancel,
    transcribeAudio,
    cancelTranscription,
    clearError,
    getConfidenceDescription,
    formatDuration: formatTranscriptionDuration,
    isSupportedFile,
    getMaxFileSize,
    formatFileSize,
    estimateTranscriptionTime,
  } = useWhisper({
    language: selectedLanguage === 'auto' ? undefined : selectedLanguage,
    includeSegments: true,
    onSuccess: (result) => {
      handleTranscriptionSuccess(result);
    },
    onError: (error) => {
      console.error('Whisper error:', error);
    },
  });

  const handleRecordingComplete = async (uri: string, duration: number) => {
    try {
      // Validate the recorded file
      const validation = await validateAudioFile(uri);
      
      if (!validation.isValid) {
        Alert.alert('Invalid Audio File', validation.error || 'Unknown validation error');
        return;
      }

      if (validation.warnings && validation.warnings.length > 0) {
        Alert.alert(
          'Audio File Warnings',
          validation.warnings.join('\n'),
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => startTranscription(uri, duration) },
          ]
        );
      } else {
        startTranscription(uri, duration);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to validate audio file');
    }
  };

  const startTranscription = async (uri: string, duration: number) => {
    try {
      // Get optimal settings for this audio file
      const fileInfo = await validateAudioFile(uri);
      const settings = getOptimalTranscriptionSettings(
        fileInfo.fileInfo?.size || 0,
        duration / 1000
      );

      if (settings.recommendations.length > 0) {
        console.log('Transcription recommendations:', settings.recommendations);
      }

      await transcribeAudio(uri, {
        response_format: settings.responseFormat,
        temperature: settings.temperature,
        language: selectedLanguage === 'auto' ? undefined : selectedLanguage,
      });
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  };

  const handleTranscriptionSuccess = (result: any) => {
    const formatted = formatTranscriptionResult(result);
    
    const historyItem: TranscriptionHistory = {
      id: `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: result.text,
      duration: result.duration,
      confidence: result.confidence,
      language: result.language,
      timestamp: new Date(),
      fileSize: 0, // Would need to get from file info
      processingTime: result.processing_time,
    };

    setTranscriptionHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10

    Alert.alert(
      'Transcription Complete!',
      formatted.summary,
      [
        { text: 'OK' },
        { text: 'View Details', onPress: () => showTranscriptionDetails(result) },
      ]
    );
  };

  const showTranscriptionDetails = (result: any) => {
    const formatted = formatTranscriptionResult(result);
    
    Alert.alert(
      'Transcription Details',
      `Text: ${formatted.plainText.substring(0, 200)}${formatted.plainText.length > 200 ? '...' : ''}\n\n` +
      `Language: ${result.language || 'Unknown'}\n` +
      `Duration: ${formatTranscriptionDuration(result.duration)}\n` +
      `Confidence: ${getConfidenceDescription(result.confidence)}\n` +
      `Processing Time: ${result.processing_time ? Math.round(result.processing_time / 1000) : 'Unknown'}s\n` +
      `Segments: ${result.segments?.length || 0}`,
      [{ text: 'OK' }]
    );
  };

  const handleCancelTranscription = () => {
    Alert.alert(
      'Cancel Transcription',
      'Are you sure you want to cancel the current transcription?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: cancelTranscription },
      ]
    );
  };

  const renderProgressSection = () => {
    if (!isTranscribing || !progress) return null;

    const phaseMessages = {
      validating: 'Validating audio file...',
      uploading: 'Uploading to OpenAI...',
      processing: 'Transcribing audio...',
      completed: 'Transcription complete!',
      error: 'Transcription failed',
    };

    return (
      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>
          {phaseMessages[progress.phase]}
        </Text>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress.progress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress.progress)}%</Text>
        </View>

        {progress.bytesUploaded && progress.totalBytes && (
          <Text style={styles.progressDetails}>
            {formatFileSize(progress.bytesUploaded)} / {formatFileSize(progress.totalBytes)}
          </Text>
        )}

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelTranscription}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderHistorySection = () => {
    if (transcriptionHistory.length === 0) return null;

    return (
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Recent Transcriptions</Text>
        <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
          {transcriptionHistory.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.historyItem}
              onPress={() => showTranscriptionDetails(item)}
            >
              <Text style={styles.historyText} numberOfLines={2}>
                {item.text}
              </Text>
              <View style={styles.historyMeta}>
                <Text style={styles.historyMetaText}>
                  {item.language ? item.language.toUpperCase() : 'Unknown'} • 
                  {item.confidence ? ` ${Math.round(item.confidence * 100)}%` : ' Unknown%'} • 
                  {formatTranscriptionDuration(item.duration)}
                </Text>
                <Text style={styles.historyTimestamp}>
                  {item.timestamp.toLocaleTimeString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderStatusSection = () => (
    <View style={styles.statusSection}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Recording:</Text>
        <Text style={[styles.statusValue, { color: isRecording ? '#00C851' : '#666' }]}>
          {recordingStatus === 'recording' ? `${formatDuration(recordingDuration)}` : recordingStatus}
        </Text>
      </View>
      
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Transcription:</Text>
        <Text style={[styles.statusValue, { color: isTranscribing ? '#FF9500' : '#666' }]}>
          {isTranscribing ? progress?.phase || 'Processing' : 'Idle'}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Max File Size:</Text>
        <Text style={styles.statusValue}>{formatFileSize(getMaxFileSize())}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8F9FA', '#FFFFFF']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Whisper API Test</Text>
            <Text style={styles.subtitle}>
              Test OpenAI Whisper speech-to-text integration
            </Text>
          </View>

          {/* Status Section */}
          {renderStatusSection()}

          {/* Recording Section */}
          <View style={styles.recordingSection}>
            <Text style={styles.sectionTitle}>Record Audio</Text>
            <VoiceRecordButtonAdvanced
              size={100}
              maxDuration={300000}
              quality="medium"
              disabled={isTranscribing}
              style={styles.recordButton}
            />
            <Text style={styles.recordingInstructions}>
              Tap to start recording • Hold for continuous recording
            </Text>
          </View>

          {/* Progress Section */}
          {renderProgressSection()}

          {/* Error Section */}
          {whisperError && (
            <VoiceErrorState
              isVisible={!!whisperError}
              error={whisperError}
              errorType="processing"
              onRetry={() => {
                clearError();
                // Could retry last transcription here
              }}
              onDismiss={clearError}
              size="medium"
              style={styles.errorState}
            />
          )}

          {/* Loading Section */}
          <AudioProcessingLoader
            isVisible={isTranscribing}
            type="transcribing"
            message="Converting speech to text..."
            progress={progress?.progress}
            size="medium"
            style={styles.loader}
          />

          {/* History Section */}
          {renderHistorySection()}

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Supported Features</Text>
            <Text style={styles.infoText}>
              • Audio formats: M4A, MP3, WAV, WebM, MP4, OGG{'\n'}
              • Maximum file size: 25MB{'\n'}
              • Automatic language detection{'\n'}
              • Confidence scoring{'\n'}
              • Timestamp segments{'\n'}
              • Progress tracking{'\n'}
              • Retry logic{'\n'}
              • Error recovery
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  statusSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  recordingSection: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 20,
  },
  recordButton: {
    marginBottom: 16,
  },
  recordingInstructions: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  progressSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    minWidth: 40,
  },
  progressDetails: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  historyList: {
    maxHeight: 200,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  historyText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  historyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMetaText: {
    fontSize: 12,
    color: '#666666',
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#999999',
  },
  errorState: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  loader: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  infoSection: {
    backgroundColor: '#F8F9FA',
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});