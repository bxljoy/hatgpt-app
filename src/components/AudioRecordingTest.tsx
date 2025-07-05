import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { VoiceRecordButtonAdvanced } from './VoiceRecordButtonAdvanced';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export function AudioRecordingTest() {
  const [lastRecording, setLastRecording] = useState<{
    uri: string;
    duration: number;
    size: number;
  } | null>(null);

  const {
    isRecording,
    isProcessing,
    duration,
    error,
    recordingStatus,
    startRecording,
    stopRecording,
    formatDuration,
  } = useAudioRecorder({
    maxDuration: 60000, // 1 minute for testing
    quality: 'medium',
    onRecordingComplete: (uri, duration, size) => {
      setLastRecording({ uri, duration, size });
      Alert.alert(
        'Recording Complete!',
        `Duration: ${Math.round(duration / 1000)}s\nSize: ${Math.round(size / 1024)}KB\nFile: ${uri}`,
        [{ text: 'OK' }]
      );
    },
    onError: (errorMessage) => {
      Alert.alert('Recording Error', errorMessage);
    },
  });

  const handleTestStart = async () => {
    try {
      await startRecording();
    } catch (error) {
      Alert.alert('Failed to start recording', String(error));
    }
  };

  const handleTestStop = async () => {
    try {
      await stopRecording();
    } catch (error) {
      Alert.alert('Failed to stop recording', String(error));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Audio Recording Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {recordingStatus}
        </Text>
        <Text style={styles.statusText}>
          Duration: {formatDuration(duration)}
        </Text>
        {error && (
          <Text style={[styles.statusText, { color: '#FF3B30' }]}>
            Error: {error}
          </Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <VoiceRecordButtonAdvanced
          size={80}
          onRecordingStart={handleTestStart}
          onRecordingComplete={(uri, duration) => {
            setLastRecording({ uri, duration, size: 0 });
          }}
          onRecordingError={(error) => {
            Alert.alert('Recording Error', error);
          }}
          disabled={isProcessing}
          maxDuration={60000}
          quality="medium"
        />
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, !isRecording && styles.disabledButton]}
          onPress={handleTestStop}
          disabled={!isRecording}
        >
          <Text style={styles.controlButtonText}>Stop Recording</Text>
        </TouchableOpacity>
      </View>

      {lastRecording && (
        <View style={styles.lastRecordingContainer}>
          <Text style={styles.lastRecordingTitle}>Last Recording:</Text>
          <Text style={styles.lastRecordingText}>
            Duration: {Math.round(lastRecording.duration / 1000)}s
          </Text>
          <Text style={styles.lastRecordingText}>
            File: {lastRecording.uri.split('/').pop()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 30,
    color: '#000000',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 30,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 200,
  },
  statusText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  buttonContainer: {
    marginBottom: 30,
  },
  controlsContainer: {
    marginBottom: 30,
  },
  controlButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  lastRecordingContainer: {
    padding: 16,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    alignItems: 'center',
  },
  lastRecordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  lastRecordingText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
});