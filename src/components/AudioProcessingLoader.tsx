import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AudioProcessingLoaderProps {
  isVisible: boolean;
  message?: string;
  progress?: number; // 0-100
  type?: 'transcribing' | 'processing' | 'uploading' | 'analyzing';
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export function AudioProcessingLoader({
  isVisible,
  message = 'Processing audio...',
  progress = -1, // -1 for indeterminate
  type = 'processing',
  size = 'medium',
  style,
}: AudioProcessingLoaderProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Fade in/out animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, fadeAnim]);

  // Rotation animation for spinner
  useEffect(() => {
    if (isVisible && progress < 0) {
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();
      
      return () => rotateAnimation.stop();
    }
  }, [isVisible, progress, rotateAnim]);

  // Pulse animation
  useEffect(() => {
    if (isVisible) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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
    }
  }, [isVisible, pulseAnim]);

  // Wave animation for audio processing
  useEffect(() => {
    if (isVisible && (type === 'transcribing' || type === 'analyzing')) {
      const waveAnimation = Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        })
      );
      waveAnimation.start();
      
      return () => waveAnimation.stop();
    }
  }, [isVisible, type, waveAnim]);

  // Progress animation
  useEffect(() => {
    if (progress >= 0) {
      Animated.timing(progressAnim, {
        toValue: progress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, progressAnim]);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { padding: 12 },
          spinner: { width: 24, height: 24 },
          text: { fontSize: 12, marginTop: 8 },
          progress: { height: 2, marginTop: 6 },
        };
      case 'large':
        return {
          container: { padding: 24 },
          spinner: { width: 60, height: 60 },
          text: { fontSize: 18, marginTop: 16 },
          progress: { height: 6, marginTop: 12 },
        };
      default: // medium
        return {
          container: { padding: 16 },
          spinner: { width: 40, height: 40 },
          text: { fontSize: 14, marginTop: 12 },
          progress: { height: 4, marginTop: 8 },
        };
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'transcribing':
        return '🎤';
      case 'uploading':
        return '☁️';
      case 'analyzing':
        return '🧠';
      default:
        return '⚡';
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'transcribing':
        return '#007AFF';
      case 'uploading':
        return '#5AC8FA';
      case 'analyzing':
        return '#AF52DE';
      default:
        return '#FF9500';
    }
  };

  const sizeStyles = getSizeStyles();
  const typeColor = getTypeColor();

  const renderSpinner = () => {
    if (progress >= 0) return null; // Don't show spinner if we have progress

    return (
      <Animated.View
        style={[
          styles.spinner,
          sizeStyles.spinner,
          {
            transform: [
              {
                rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[typeColor, typeColor + '80']}
          style={[styles.spinnerGradient, sizeStyles.spinner]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.spinnerInner}>
            <Text style={[styles.spinnerIcon, { fontSize: sizeStyles.spinner.width * 0.4 }]}>
              {getTypeIcon()}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderWaveform = () => {
    if (type !== 'transcribing' && type !== 'analyzing') return null;
    if (progress >= 0) return null; // Don't show waveform if we have progress

    const waveCount = size === 'small' ? 5 : size === 'large' ? 12 : 8;
    const waves = Array.from({ length: waveCount }, (_, i) => {
      const delay = i * 100;
      const animatedHeight = waveAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [2, Math.random() * 20 + 5],
      });

      return (
        <Animated.View
          key={i}
          style={[
            styles.wave,
            {
              height: animatedHeight,
              backgroundColor: typeColor,
              width: size === 'small' ? 2 : 3,
              marginHorizontal: 1,
              opacity: waveAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 1, 0.3],
              }),
            },
          ]}
        />
      );
    });

    return <View style={styles.waveContainer}>{waves}</View>;
  };

  const renderProgressBar = () => {
    if (progress < 0) return null;

    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressBackground, sizeStyles.progress]}>
          <Animated.View
            style={[
              styles.progressFill,
              sizeStyles.progress,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: typeColor,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>
    );
  };

  const renderContent = () => (
    <View style={[styles.content, sizeStyles.container]}>
      {renderSpinner()}
      {renderWaveform()}
      
      <Text style={[styles.message, sizeStyles.text, { color: typeColor }]}>
        {message}
      </Text>
      
      {renderProgressBar()}
    </View>
  );

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              scale: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        },
        style,
      ]}
    >
      <View style={styles.backdrop}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.95)', 'rgba(248, 249, 250, 0.95)']}
          style={styles.backgroundGradient}
        />
        {renderContent()}
      </View>
    </Animated.View>
  );
}

// Preset configurations
export const LoaderPresets = {
  transcribing: {
    type: 'transcribing' as const,
    message: 'Converting speech to text...',
  },
  processing: {
    type: 'processing' as const,
    message: 'Processing audio...',
  },
  uploading: {
    type: 'uploading' as const,
    message: 'Uploading recording...',
  },
  analyzing: {
    type: 'analyzing' as const,
    message: 'Analyzing audio...',
  },
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    borderRadius: 16,
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
    minWidth: 120,
  },
  spinner: {
    borderRadius: 50,
  },
  spinnerGradient: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerInner: {
    width: '60%',
    height: '60%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerIcon: {
    textAlign: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    marginBottom: 8,
  },
  wave: {
    borderRadius: 2,
  },
  message: {
    textAlign: 'center',
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});