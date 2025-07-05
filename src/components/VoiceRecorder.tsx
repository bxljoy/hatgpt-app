import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface VoiceRecorderProps {
  onRecordingComplete?: (uri: string, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onError?: (error: string) => void;
  maxDuration?: number;
  quality?: 'low' | 'medium' | 'high';
  visible?: boolean;
  onClose?: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function VoiceRecorder({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  onError,
  maxDuration = 300000, // 5 minutes
  quality = 'medium',
  visible = true,
  onClose,
}: VoiceRecorderProps) {
  const insets = useSafeAreaInsets();
  
  const {
    isRecording,
    isProcessing,
    duration,
    error,
    isPaused,
    recordingStatus,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    durationFormatted,
    progressPercentage,
    canRecord,
    canStop,
    canPause,
    canResume,
  } = useAudioRecorder({
    maxDuration,
    quality,
    onRecordingComplete: (uri, duration, size) => {
      onRecordingComplete?.(uri, duration);
    },
    onError: (errorMessage) => {
      onError?.(errorMessage);
    },
  });

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for recording button
  useEffect(() => {
    if (isRecording && !isPaused) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
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
  }, [isRecording, isPaused, pulseAnim]);

  // Wave animation
  useEffect(() => {
    if (isRecording && !isPaused) {
      const waveAnimation = Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      waveAnimation.start();
      
      return () => waveAnimation.stop();
    } else {
      waveAnim.setValue(0);
    }
  }, [isRecording, isPaused, waveAnim]);

  // Scale and opacity animations for modal
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleRecordPress = async () => {
    if (isRecording) {
      if (isPaused) {
        await resumeRecording();
      } else {
        await pauseRecording();
      }
    } else {
      onRecordingStart?.();
      await startRecording();
    }
  };

  const handleStopPress = async () => {
    onRecordingStop?.();
    await stopRecording();
  };

  const handleCancelPress = async () => {
    await cancelRecording();
    onClose?.();
  };

  const getRecordButtonContent = () => {
    if (isProcessing) {
      return <Text style={styles.processingText}>●●●</Text>;
    }
    
    if (isRecording && !isPaused) {
      return <View style={styles.pauseIcon} />;
    }
    
    if (isPaused) {
      return <Text style={styles.playIcon}>▶</Text>;
    }
    
    return <View style={styles.recordIcon} />;
  };

  const getStatusText = () => {
    switch (recordingStatus) {
      case 'recording':
        return 'Recording...';
      case 'paused':
        return 'Paused';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Recording complete';
      case 'error':
        return 'Error occurred';
      default:
        return 'Tap to start recording';
    }
  };

  const renderWaveform = () => {
    const waves = Array.from({ length: 20 }, (_, i) => {
      const animatedHeight = waveAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [4, Math.random() * 40 + 10],
      });

      const delay = i * 100;
      const animatedOpacity = waveAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 1, 0.3],
      });

      return (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              height: animatedHeight,
              opacity: animatedOpacity,
              transform: [
                {
                  scaleY: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
            },
          ]}
        />
      );
    });

    return <View style={styles.waveformContainer}>{waves}</View>;
  };

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancelPress} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Voice Recording</Text>
          
          {canStop && (
            <TouchableOpacity onPress={handleStopPress} style={styles.doneButton}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status and Timer */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          <Text style={styles.timerText}>{durationFormatted}</Text>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progressPercentage, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progressPercentage)}%
            </Text>
          </View>
        </View>

        {/* Waveform Visualization */}
        {(isRecording || isPaused) && (
          <View style={styles.visualizationContainer}>
            {renderWaveform()}
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Recording Controls */}
        <View style={styles.controlsContainer}>
          {/* Main Record Button */}
          <Animated.View
            style={[
              styles.recordButtonContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
                isPaused && styles.recordButtonPaused,
                isProcessing && styles.recordButtonProcessing,
              ]}
              onPress={handleRecordPress}
              disabled={isProcessing || (!canRecord && !isRecording)}
            >
              {getRecordButtonContent()}
            </TouchableOpacity>
          </Animated.View>

          {/* Instructions */}
          <Text style={styles.instructionText}>
            {isRecording 
              ? (isPaused ? 'Tap to resume' : 'Tap to pause')
              : 'Tap to start recording'
            }
          </Text>
        </View>

        {/* Additional Controls */}
        {isRecording && (
          <View style={styles.additionalControls}>
            {canPause && (
              <TouchableOpacity onPress={pauseRecording} style={styles.controlButton}>
                <Text style={styles.controlButtonText}>⏸️ Pause</Text>
              </TouchableOpacity>
            )}
            
            {canResume && (
              <TouchableOpacity onPress={resumeRecording} style={styles.controlButton}>
                <Text style={styles.controlButtonText}>▶️ Resume</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity onPress={handleStopPress} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>⏹️ Stop</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxWidth: screenWidth - 40,
    minHeight: screenHeight * 0.6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  doneText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#000000',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
  },
  visualizationContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#007AFF',
    marginHorizontal: 1,
    borderRadius: 1.5,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButtonContainer: {
    marginBottom: 20,
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  recordButtonActive: {
    backgroundColor: '#FF3B30',
  },
  recordButtonPaused: {
    backgroundColor: '#FF9500',
  },
  recordButtonProcessing: {
    backgroundColor: '#8E8E93',
  },
  recordIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
  },
  pauseIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  playIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  processingText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  controlButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});