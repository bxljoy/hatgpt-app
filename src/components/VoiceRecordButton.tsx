import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  Vibration,
  Platform,
} from 'react-native';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface VoiceRecordButtonProps {
  onRecordingStart?: () => void;
  onRecordingComplete?: (uri: string, duration: number) => void;
  onRecordingError?: (error: string) => void;
  size?: number;
  disabled?: boolean;
  maxDuration?: number;
  quality?: 'low' | 'medium' | 'high';
}

export function VoiceRecordButton({
  onRecordingStart,
  onRecordingComplete,
  onRecordingError,
  size = 40,
  disabled = false,
  maxDuration = 300000, // 5 minutes
  quality = 'medium',
}: VoiceRecordButtonProps) {
  const {
    isRecording,
    isProcessing,
    recordingStatus,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    maxDuration,
    quality,
    onRecordingComplete: (uri, duration) => {
      onRecordingComplete?.(uri, duration);
    },
    onError: (error) => {
      onRecordingError?.(error);
    },
  });

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Scale animation for press feedback
  const animatePress = (pressed: boolean) => {
    Animated.spring(scaleAnim, {
      toValue: pressed ? 0.9 : 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  // Pulse animation during recording
  useEffect(() => {
    if (isRecording) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
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
  }, [isRecording, pulseAnim]);

  // Rotation animation during processing
  useEffect(() => {
    if (isProcessing) {
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();
      
      return () => rotateAnimation.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isProcessing, rotateAnim]);

  const handlePressIn = () => {
    if (disabled || isProcessing) return;
    
    animatePress(true);
    
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    }
  };

  const handlePressOut = () => {
    if (disabled || isProcessing) return;
    
    animatePress(false);
  };

  const handlePress = async () => {
    if (disabled || isProcessing) return;

    if (isRecording) {
      // Stop recording
      await stopRecording();
    } else {
      // Start recording
      onRecordingStart?.();
      await startRecording();
    }
  };

  const handleLongPress = async () => {
    if (disabled || isProcessing) return;

    if (isRecording) {
      // Cancel recording on long press
      await cancelRecording();
    }
  };

  const getButtonStyle = () => {
    const baseStyle = [
      styles.button,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
    ];

    if (disabled) {
      return [...baseStyle, styles.buttonDisabled];
    }

    switch (recordingStatus) {
      case 'recording':
        return [...baseStyle, styles.buttonRecording];
      case 'processing':
        return [...baseStyle, styles.buttonProcessing];
      case 'error':
        return [...baseStyle, styles.buttonError];
      default:
        return [...baseStyle, styles.buttonIdle];
    }
  };

  const getIconStyle = () => {
    const iconSize = size * 0.4;
    
    return {
      width: iconSize,
      height: iconSize,
      borderRadius: iconSize / 2,
    };
  };

  const renderIcon = () => {
    if (isProcessing) {
      return (
        <Animated.View
          style={[
            styles.processingIcon,
            getIconStyle(),
            {
              transform: [
                {
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      );
    }

    if (isRecording) {
      return (
        <Animated.View
          style={[
            styles.stopIcon,
            getIconStyle(),
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      );
    }

    return (
      <Animated.View
        style={[
          styles.micIcon,
          getIconStyle(),
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />
    );
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
      disabled={disabled}
      activeOpacity={0.8}
      delayLongPress={1000}
    >
      {renderIcon()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonIdle: {
    backgroundColor: '#E5E5EA',
  },
  buttonRecording: {
    backgroundColor: '#FF3B30',
  },
  buttonProcessing: {
    backgroundColor: '#8E8E93',
  },
  buttonError: {
    backgroundColor: '#FF6B6B',
  },
  buttonDisabled: {
    backgroundColor: '#C7C7CC',
    opacity: 0.6,
  },
  micIcon: {
    backgroundColor: '#666666',
  },
  stopIcon: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  processingIcon: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: '#666666',
  },
});