import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

export type SpeakingState = 'idle' | 'preparing' | 'speaking' | 'paused' | 'error';

interface SpeakingIndicatorProps {
  isActive: boolean;
  state: SpeakingState;
  text?: string;
  progress?: number; // 0-100 for text progress
  style?: any;
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
  showText?: boolean;
  showProgress?: boolean;
  animationType?: 'waves' | 'dots' | 'pulse' | 'bars';
}

const { width: screenWidth } = Dimensions.get('window');

export function SpeakingIndicator({
  isActive,
  state,
  text,
  progress = 0,
  style,
  size = 'medium',
  theme = 'light',
  showText = true,
  showProgress = false,
  animationType = 'waves',
}: SpeakingIndicatorProps) {
  // Animation refs for different types
  const waveAnims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.6),
    new Animated.Value(0.8),
    new Animated.Value(0.4),
    new Animated.Value(0.7),
    new Animated.Value(0.5),
  ]).current;

  const dotAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  const barAnims = useRef([
    new Animated.Value(0.2),
    new Animated.Value(0.4),
    new Animated.Value(0.6),
    new Animated.Value(0.3),
    new Animated.Value(0.8),
    new Animated.Value(0.5),
    new Animated.Value(0.7),
  ]).current;

  // Size configurations
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          waveHeight: 20,
          waveWidth: 3,
          dotSize: 6,
          barHeight: 16,
          barWidth: 2,
          fontSize: 12,
          iconSize: 16,
          containerPadding: 8,
        };
      case 'large':
        return {
          waveHeight: 40,
          waveWidth: 5,
          dotSize: 12,
          barHeight: 32,
          barWidth: 4,
          fontSize: 18,
          iconSize: 32,
          containerPadding: 20,
        };
      default: // medium
        return {
          waveHeight: 30,
          waveWidth: 4,
          dotSize: 8,
          barHeight: 24,
          barWidth: 3,
          fontSize: 14,
          iconSize: 24,
          containerPadding: 12,
        };
    }
  };

  const sizeConfig = getSizeConfig();

  // Theme colors
  const getThemeColors = () => {
    if (theme === 'dark') {
      return {
        primary: '#007AFF',
        secondary: '#FF9500',
        success: '#00C851',
        error: '#FF3B30',
        background: '#1C1C1E',
        surface: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
      };
    }
    return {
      primary: '#007AFF',
      secondary: '#FF9500',
      success: '#00C851',
      error: '#FF3B30',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      text: '#000000',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
    };
  };

  const colors = getThemeColors();

  // Get state color
  const getStateColor = () => {
    switch (state) {
      case 'preparing':
        return colors.secondary;
      case 'speaking':
        return colors.primary;
      case 'paused':
        return colors.textSecondary;
      case 'error':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  // Start animations based on state and type
  useEffect(() => {
    if (isActive && state === 'speaking') {
      startAnimations();
    } else if (state === 'preparing') {
      startPreparingAnimation();
    } else {
      stopAnimations();
    }

    return () => {
      stopAnimations();
    };
  }, [isActive, state, animationType]);

  const startAnimations = () => {
    switch (animationType) {
      case 'waves':
        startWaveAnimation();
        break;
      case 'dots':
        startDotAnimation();
        break;
      case 'pulse':
        startPulseAnimation();
        break;
      case 'bars':
        startBarAnimation();
        break;
    }
  };

  const startWaveAnimation = () => {
    const animations = waveAnims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400 + index * 50,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400 + index * 50,
            useNativeDriver: true,
          }),
        ])
      )
    );

    Animated.stagger(80, animations).start();
  };

  const startDotAnimation = () => {
    const animations = dotAnims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      )
    );

    Animated.stagger(0, animations).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startBarAnimation = () => {
    const animations = barAnims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 0.8 + 0.2,
            duration: 200 + Math.random() * 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: Math.random() * 0.5 + 0.2,
            duration: 200 + Math.random() * 300,
            useNativeDriver: true,
          }),
        ])
      )
    );

    Animated.stagger(50, animations).start();
  };

  const startPreparingAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopAnimations = () => {
    // Stop all animations
    waveAnims.forEach(anim => anim.stopAnimation());
    dotAnims.forEach(anim => anim.stopAnimation());
    barAnims.forEach(anim => anim.stopAnimation());
    pulseAnim.stopAnimation();
    rotateAnim.stopAnimation();

    // Reset to default values
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    rotateAnim.setValue(0);
  };

  const renderWaveAnimation = () => (
    <View style={[styles.animationContainer, { height: sizeConfig.waveHeight }]}>
      {waveAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              width: sizeConfig.waveWidth,
              height: sizeConfig.waveHeight,
              backgroundColor: getStateColor(),
              transform: [{ scaleY: anim }],
              marginHorizontal: 1,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderDotAnimation = () => (
    <View style={styles.animationContainer}>
      {dotAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              width: sizeConfig.dotSize,
              height: sizeConfig.dotSize,
              backgroundColor: getStateColor(),
              opacity: anim,
              marginHorizontal: 2,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderPulseAnimation = () => (
    <View style={styles.animationContainer}>
      <Animated.View
        style={[
          styles.pulseCircle,
          {
            width: sizeConfig.iconSize,
            height: sizeConfig.iconSize,
            backgroundColor: getStateColor(),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Text style={[styles.pulseIcon, { fontSize: sizeConfig.iconSize * 0.6 }]}>
          🔊
        </Text>
      </Animated.View>
    </View>
  );

  const renderBarAnimation = () => (
    <View style={[styles.animationContainer, { height: sizeConfig.barHeight }]}>
      {barAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              width: sizeConfig.barWidth,
              height: sizeConfig.barHeight,
              backgroundColor: getStateColor(),
              transform: [{ scaleY: anim }],
              marginHorizontal: 1,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderPreparingIndicator = () => {
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={styles.animationContainer}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
          <Text style={[styles.spinnerIcon, { 
            fontSize: sizeConfig.iconSize,
            color: getStateColor() 
          }]}>
            ⟳
          </Text>
        </Animated.View>
      </View>
    );
  };

  const renderAnimation = () => {
    if (state === 'preparing') {
      return renderPreparingIndicator();
    }

    switch (animationType) {
      case 'waves':
        return renderWaveAnimation();
      case 'dots':
        return renderDotAnimation();
      case 'pulse':
        return renderPulseAnimation();
      case 'bars':
        return renderBarAnimation();
      default:
        return renderWaveAnimation();
    }
  };

  const renderStateText = () => {
    if (!showText) return null;

    const getStateText = () => {
      switch (state) {
        case 'preparing':
          return 'Preparing to speak...';
        case 'speaking':
          return 'Speaking...';
        case 'paused':
          return 'Speech paused';
        case 'error':
          return 'Speech error';
        default:
          return 'Ready to speak';
      }
    };

    return (
      <Text style={[
        styles.stateText,
        {
          fontSize: sizeConfig.fontSize,
          color: getStateColor(),
        },
      ]}>
        {text || getStateText()}
      </Text>
    );
  };

  const renderProgress = () => {
    if (!showProgress || progress === 0) return null;

    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: getStateColor(),
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { 
          fontSize: sizeConfig.fontSize * 0.8,
          color: colors.textSecondary 
        }]}>
          {Math.round(progress)}%
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          padding: sizeConfig.containerPadding,
        },
        style,
      ]}
    >
      {renderAnimation()}
      {renderStateText()}
      {renderProgress()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  animationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  waveBar: {
    borderRadius: 2,
  },
  dot: {
    borderRadius: 50,
  },
  bar: {
    borderRadius: 1,
  },
  pulseCircle: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseIcon: {
    color: '#FFFFFF',
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerIcon: {
    fontWeight: 'bold',
  },
  stateText: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressText: {
    fontWeight: '500',
    minWidth: 35,
    textAlign: 'right',
  },
});