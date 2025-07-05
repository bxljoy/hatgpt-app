import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface RecordingTimerProps {
  duration: number; // in milliseconds
  maxDuration?: number; // in milliseconds
  isRecording?: boolean;
  isPaused?: boolean;
  showProgress?: boolean;
  showWarning?: boolean;
  warningThreshold?: number; // percentage (0-100)
  size?: 'small' | 'medium' | 'large';
  style?: any;
  textColor?: string;
  progressColor?: string;
  warningColor?: string;
  backgroundColor?: string;
}

export function RecordingTimer({
  duration,
  maxDuration = 300000, // 5 minutes default
  isRecording = false,
  isPaused = false,
  showProgress = true,
  showWarning = true,
  warningThreshold = 80,
  size = 'medium',
  style,
  textColor = '#000000',
  progressColor = '#007AFF',
  warningColor = '#FF3B30',
  backgroundColor = '#F2F2F7',
}: RecordingTimerProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const warningAnim = useRef(new Animated.Value(0)).current;

  // Calculate progress percentage
  const progressPercentage = Math.min((duration / maxDuration) * 100, 100);
  const isInWarningZone = progressPercentage >= warningThreshold;
  
  // Format duration for display
  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);
    
    if (size === 'small') {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Get size-specific styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
          text: { fontSize: 12, fontWeight: '500' as const },
          progress: { height: 2 },
        };
      case 'large':
        return {
          container: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
          text: { fontSize: 28, fontWeight: '300' as const },
          progress: { height: 6 },
        };
      default: // medium
        return {
          container: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
          text: { fontSize: 18, fontWeight: '400' as const },
          progress: { height: 4 },
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Pulse animation for recording state
  useEffect(() => {
    if (isRecording && !isPaused) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
  }, [isRecording, isPaused, pulseAnim]);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercentage / 100,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [progressPercentage, progressAnim]);

  // Warning animation
  useEffect(() => {
    if (isInWarningZone && showWarning) {
      const warningAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(warningAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(warningAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      warningAnimation.start();
      
      return () => warningAnimation.stop();
    } else {
      warningAnim.setValue(0);
    }
  }, [isInWarningZone, showWarning, warningAnim]);

  const getCurrentTextColor = () => {
    if (isInWarningZone && showWarning) {
      return warningColor;
    }
    if (isPaused) {
      return '#8E8E93';
    }
    return textColor;
  };

  const renderProgressBar = () => {
    if (!showProgress) return null;

    return (
      <View style={[styles.progressContainer, { height: sizeStyles.progress.height }]}>
        <View style={[styles.progressBackground, { backgroundColor }]} />
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: isInWarningZone ? warningColor : progressColor,
            },
          ]}
        />
        
        {/* Gradient overlay for better visual */}
        <Animated.View
          style={[
            styles.progressGradient,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={
              isInWarningZone
                ? [warningColor, '#FF6B6B']
                : [progressColor, '#5AC8FA']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
    );
  };

  const renderStatusIndicator = () => {
    if (size === 'small') return null;

    let indicatorColor = '#00C851'; // Green for recording
    let indicatorText = '●';

    if (isPaused) {
      indicatorColor = '#FF9500'; // Orange for paused
      indicatorText = '⏸';
    } else if (!isRecording) {
      indicatorColor = '#8E8E93'; // Gray for stopped
      indicatorText = '⏹';
    }

    return (
      <Animated.View
        style={[
          styles.statusIndicator,
          {
            opacity: isRecording && !isPaused ? pulseAnim : 1,
          },
        ]}
      >
        <Text style={[styles.statusText, { color: indicatorColor }]}>
          {indicatorText}
        </Text>
      </Animated.View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        sizeStyles.container,
        {
          backgroundColor,
          transform: [{ scale: pulseAnim }],
        },
        isInWarningZone && showWarning && {
          backgroundColor: warningAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [backgroundColor, 'rgba(255, 59, 48, 0.1)'],
          }),
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {renderStatusIndicator()}
        
        <Text
          style={[
            styles.timerText,
            sizeStyles.text,
            {
              color: getCurrentTextColor(),
              fontVariant: ['tabular-nums'],
            },
          ]}
        >
          {formatDuration(duration)}
        </Text>
        
        {size !== 'small' && (
          <Text style={[styles.maxDurationText, { color: textColor + '80' }]}>
            / {formatDuration(maxDuration)}
          </Text>
        )}
      </View>
      
      {renderProgressBar()}
      
      {/* Warning overlay */}
      {isInWarningZone && showWarning && (
        <Animated.View
          style={[
            styles.warningOverlay,
            {
              opacity: warningAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.2],
              }),
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

// Preset configurations
export const TimerPresets = {
  compact: {
    size: 'small' as const,
    showProgress: false,
    backgroundColor: 'transparent',
  },
  standard: {
    size: 'medium' as const,
    showProgress: true,
    showWarning: true,
  },
  prominent: {
    size: 'large' as const,
    showProgress: true,
    showWarning: true,
  },
  minimal: {
    size: 'medium' as const,
    showProgress: false,
    backgroundColor: 'transparent',
    textColor: '#666666',
  },
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  timerText: {
    textAlign: 'center',
  },
  maxDurationText: {
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 4,
    opacity: 0.6,
  },
  progressContainer: {
    width: '100%',
    marginTop: 6,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBackground: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressGradient: {
    position: 'absolute',
    height: '100%',
    borderRadius: 2,
  },
  warningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
  },
});