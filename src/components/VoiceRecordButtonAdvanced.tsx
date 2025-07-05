import React, { useEffect, useRef, useState } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface VoiceRecordButtonAdvancedProps {
  onRecordingStart?: () => void;
  onRecordingComplete?: (uri: string, duration: number) => void;
  onRecordingError?: (error: string) => void;
  size?: number;
  disabled?: boolean;
  maxDuration?: number;
  quality?: 'low' | 'medium' | 'high';
  style?: any;
}

export function VoiceRecordButtonAdvanced({
  onRecordingStart,
  onRecordingComplete,
  onRecordingError,
  size = 60,
  disabled = false,
  maxDuration = 300000, // 5 minutes
  quality = 'medium',
  style,
}: VoiceRecordButtonAdvancedProps) {
  const [pressStartTime, setPressStartTime] = useState<number | null>(null);
  
  const {
    isRecording,
    isProcessing,
    recordingStatus,
    duration,
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
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Haptic feedback helper
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
    if (Platform.OS === 'ios') {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    }
  };

  // Press animation
  const animatePress = (pressed: boolean) => {
    Animated.spring(scaleAnim, {
      toValue: pressed ? 0.95 : 1,
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
            toValue: 1.15,
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
  }, [isRecording, pulseAnim]);

  // Breathing animation for idle state
  useEffect(() => {
    if (!isRecording && !isProcessing && recordingStatus === 'idle') {
      const breatheAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.02,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      breatheAnimation.start();
      
      return () => breatheAnimation.stop();
    }
  }, [isRecording, isProcessing, recordingStatus, breatheAnim]);

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

  // Glow animation
  useEffect(() => {
    if (isRecording) {
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      glowAnimation.start();
      
      return () => glowAnimation.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [isRecording, glowAnim]);

  // Ripple animation on press
  const animateRipple = () => {
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => {
    if (disabled || isProcessing) return;
    
    animatePress(true);
    setPressStartTime(Date.now());
    triggerHaptic('light');
  };

  const handlePressOut = () => {
    if (disabled || isProcessing) return;
    
    animatePress(false);
  };

  const handlePress = async () => {
    if (disabled || isProcessing) return;

    const pressDuration = pressStartTime ? Date.now() - pressStartTime : 0;
    setPressStartTime(null);

    if (isRecording) {
      // Stop recording
      triggerHaptic('success');
      await stopRecording();
    } else {
      // Start recording
      animateRipple();
      triggerHaptic('medium');
      onRecordingStart?.();
      await startRecording();
    }
  };

  const handleLongPress = async () => {
    if (disabled || isProcessing || !isRecording) return;

    // Cancel recording on long press
    triggerHaptic('warning');
    await cancelRecording();
  };

  const getButtonColors = () => {
    if (disabled) {
      return {
        gradient: ['#C7C7CC', '#C7C7CC'],
        shadow: '#C7C7CC',
      };
    }

    switch (recordingStatus) {
      case 'recording':
        return {
          gradient: ['#FF6B6B', '#FF3B30'],
          shadow: '#FF3B30',
        };
      case 'processing':
        return {
          gradient: ['#8E8E93', '#666666'],
          shadow: '#666666',
        };
      case 'error':
        return {
          gradient: ['#FF9500', '#FF6B00'],
          shadow: '#FF6B00',
        };
      default:
        return {
          gradient: ['#F2F2F7', '#E5E5EA'],
          shadow: '#007AFF',
        };
    }
  };

  const renderIcon = () => {
    const iconSize = size * 0.35;
    const colors = getButtonColors();

    if (isProcessing) {
      return (
        <Animated.View
          style={[
            styles.processingIcon,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
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
            {
              width: iconSize * 0.7,
              height: iconSize * 0.7,
              backgroundColor: '#FFFFFF',
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
          {
            width: iconSize,
            height: iconSize,
            backgroundColor: colors.gradient[1],
            transform: [{ scale: breatheAnim }],
          },
        ]}
      />
    );
  };

  const colors = getButtonColors();

  return (
    <View style={[styles.container, style]}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.6],
            }),
            transform: [
              {
                scale: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
                }),
              },
            ],
          },
        ]}
      />

      {/* Ripple effect */}
      <Animated.View
        style={[
          styles.ripple,
          {
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            opacity: rippleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 0],
            }),
            transform: [
              {
                scale: rippleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ],
          },
        ]}
      />

      {/* Main button */}
      <Animated.View
        style={[
          {
            transform: [
              { scale: scaleAnim },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          disabled={disabled}
          activeOpacity={0.9}
          delayLongPress={1000}
        >
          <LinearGradient
            colors={colors.gradient}
            style={[
              styles.gradient,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {renderIcon()}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    borderRadius: 50,
  },
  stopIcon: {
    borderRadius: 3,
  },
  processingIcon: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: '#FFFFFF',
    borderRadius: 50,
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  ripple: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
});