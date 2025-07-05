import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface VoiceErrorStateProps {
  isVisible: boolean;
  error: string;
  errorType?: 'permission' | 'network' | 'recording' | 'processing' | 'unknown';
  onRetry?: () => void;
  onDismiss?: () => void;
  onOpenSettings?: () => void;
  canRetry?: boolean;
  retryCount?: number;
  maxRetries?: number;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export function VoiceErrorState({
  isVisible,
  error,
  errorType = 'unknown',
  onRetry,
  onDismiss,
  onOpenSettings,
  canRetry = true,
  retryCount = 0,
  maxRetries = 3,
  size = 'medium',
  style,
}: VoiceErrorStateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Fade in/out animation
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
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
      
      // Trigger haptic feedback for error
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  // Shake animation for errors
  useEffect(() => {
    if (isVisible) {
      const shakeAnimation = Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]);
      
      shakeAnimation.start();
    }
  }, [isVisible, shakeAnim]);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { padding: 12, borderRadius: 8 },
          icon: { fontSize: 24, marginBottom: 8 },
          title: { fontSize: 14, marginBottom: 4 },
          message: { fontSize: 12, marginBottom: 12 },
          button: { paddingHorizontal: 12, paddingVertical: 6 },
          buttonText: { fontSize: 12 },
        };
      case 'large':
        return {
          container: { padding: 24, borderRadius: 16 },
          icon: { fontSize: 48, marginBottom: 16 },
          title: { fontSize: 20, marginBottom: 8 },
          message: { fontSize: 16, marginBottom: 20 },
          button: { paddingHorizontal: 20, paddingVertical: 12 },
          buttonText: { fontSize: 16 },
        };
      default: // medium
        return {
          container: { padding: 16, borderRadius: 12 },
          icon: { fontSize: 32, marginBottom: 12 },
          title: { fontSize: 16, marginBottom: 6 },
          message: { fontSize: 14, marginBottom: 16 },
          button: { paddingHorizontal: 16, paddingVertical: 8 },
          buttonText: { fontSize: 14 },
        };
    }
  };

  const getErrorInfo = () => {
    switch (errorType) {
      case 'permission':
        return {
          icon: '🔒',
          title: 'Microphone Access Required',
          color: '#FF9500',
          gradient: ['#FF9500', '#FF6B00'],
          suggestion: 'Please allow microphone access in your device settings.',
          primaryAction: 'Open Settings',
          secondaryAction: 'Cancel',
        };
      case 'network':
        return {
          icon: '🌐',
          title: 'Network Error',
          color: '#FF3B30',
          gradient: ['#FF3B30', '#D70015'],
          suggestion: 'Check your internet connection and try again.',
          primaryAction: 'Retry',
          secondaryAction: 'Cancel',
        };
      case 'recording':
        return {
          icon: '🎤',
          title: 'Recording Failed',
          color: '#FF3B30',
          gradient: ['#FF3B30', '#D70015'],
          suggestion: 'Unable to record audio. Please try again.',
          primaryAction: 'Try Again',
          secondaryAction: 'Cancel',
        };
      case 'processing':
        return {
          icon: '⚠️',
          title: 'Processing Error',
          color: '#FF9500',
          gradient: ['#FF9500', '#FF6B00'],
          suggestion: 'Failed to process your audio. Please try again.',
          primaryAction: 'Retry',
          secondaryAction: 'Cancel',
        };
      default:
        return {
          icon: '❌',
          title: 'Something Went Wrong',
          color: '#FF3B30',
          gradient: ['#FF3B30', '#D70015'],
          suggestion: 'An unexpected error occurred. Please try again.',
          primaryAction: 'Try Again',
          secondaryAction: 'Cancel',
        };
    }
  };

  const handleRetry = () => {
    if (retryCount >= maxRetries) {
      Alert.alert(
        'Maximum Retries Reached',
        `You've tried ${maxRetries} times. Would you like to try once more?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: onRetry },
        ]
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onRetry?.();
    }
  };

  const handlePrimaryAction = () => {
    if (errorType === 'permission') {
      onOpenSettings?.();
    } else {
      handleRetry();
    }
  };

  const handleSecondaryAction = () => {
    onDismiss?.();
  };

  const sizeStyles = getSizeStyles();
  const errorInfo = getErrorInfo();

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        sizeStyles.container,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateX: shakeAnim },
          ],
        },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.95)', 'rgba(248, 249, 250, 0.95)']}
        style={styles.backgroundGradient}
      />
      
      <View style={styles.content}>
        {/* Error Icon */}
        <Text style={[styles.errorIcon, sizeStyles.icon]}>
          {errorInfo.icon}
        </Text>
        
        {/* Error Title */}
        <Text style={[styles.errorTitle, sizeStyles.title, { color: errorInfo.color }]}>
          {errorInfo.title}
        </Text>
        
        {/* Error Message */}
        <Text style={[styles.errorMessage, sizeStyles.message]}>
          {error || errorInfo.suggestion}
        </Text>
        
        {/* Retry Count Indicator */}
        {retryCount > 0 && (
          <Text style={styles.retryCount}>
            Attempt {retryCount + 1} of {maxRetries + 1}
          </Text>
        )}
        
        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {canRetry && (retryCount < maxRetries || errorType === 'permission') && (
            <TouchableOpacity
              style={[styles.primaryButton, sizeStyles.button]}
              onPress={handlePrimaryAction}
            >
              <LinearGradient
                colors={errorInfo.gradient}
                style={[styles.buttonGradient, sizeStyles.button]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.primaryButtonText, sizeStyles.buttonText]}>
                  {errorInfo.primaryAction}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.secondaryButton, sizeStyles.button]}
            onPress={handleSecondaryAction}
          >
            <Text style={[styles.secondaryButtonText, sizeStyles.buttonText]}>
              {errorInfo.secondaryAction}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Additional Help Text */}
        {errorType === 'permission' && (
          <Text style={styles.helpText}>
            You can also enable microphone access in Settings → Privacy & Security → Microphone
          </Text>
        )}
        
        {retryCount >= maxRetries && errorType !== 'permission' && (
          <Text style={styles.helpText}>
            If the problem persists, please check your network connection or try again later.
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// Preset error configurations
export const ErrorPresets = {
  microphonePermission: {
    errorType: 'permission' as const,
    error: 'Microphone access is required to record voice messages.',
    canRetry: true,
  },
  networkError: {
    errorType: 'network' as const,
    error: 'Unable to connect to the server. Please check your internet connection.',
    canRetry: true,
  },
  recordingFailed: {
    errorType: 'recording' as const,
    error: 'Failed to start recording. Please try again.',
    canRetry: true,
  },
  processingFailed: {
    errorType: 'processing' as const,
    error: 'Unable to process your audio recording.',
    canRetry: true,
  },
  quotaExceeded: {
    errorType: 'processing' as const,
    error: 'You have reached your usage limit. Please try again later.',
    canRetry: false,
  },
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  errorIcon: {
    textAlign: 'center',
  },
  errorTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  errorMessage: {
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryCount: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  buttonGradient: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  secondaryButtonText: {
    color: '#666666',
    fontWeight: '500',
    textAlign: 'center',
  },
  helpText: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
    maxWidth: 280,
  },
});