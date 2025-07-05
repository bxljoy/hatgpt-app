import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export type AudioState = 
  | 'idle'
  | 'loading'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'ended'
  | 'error'
  | 'muted'
  | 'volume_changed';

export interface AudioVisualizationData {
  state: AudioState;
  volume: number;
  position: number;
  duration: number;
  buffered: number;
  frequency?: number[]; // Audio frequency data for spectrum visualization
  waveform?: number[]; // Waveform data
  bitrate?: number;
  isLive?: boolean;
}

interface AudioVisualFeedbackProps {
  data: AudioVisualizationData;
  style?: any;
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
  visualizationType?: 'waveform' | 'spectrum' | 'circle' | 'bars' | 'minimal';
  showStateText?: boolean;
  showMetadata?: boolean;
  animationIntensity?: 'low' | 'medium' | 'high';
  responsiveToAudio?: boolean;
}

export function AudioVisualFeedback({
  data,
  style,
  size = 'medium',
  theme = 'light',
  visualizationType = 'waveform',
  showStateText = true,
  showMetadata = false,
  animationIntensity = 'medium',
  responsiveToAudio = true,
}: AudioVisualFeedbackProps) {
  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  
  // Visualization data animations
  const waveAnims = useRef(
    Array.from({ length: 20 }, () => new Animated.Value(0.3))
  ).current;
  
  const spectrumAnims = useRef(
    Array.from({ length: 32 }, () => new Animated.Value(0.1))
  ).current;

  const barAnims = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(0.2))
  ).current;

  // Size configurations
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          containerSize: 60,
          iconSize: 20,
          fontSize: 10,
          waveHeight: 20,
          barHeight: 15,
          circleSize: 40,
        };
      case 'large':
        return {
          containerSize: 120,
          iconSize: 40,
          fontSize: 16,
          waveHeight: 50,
          barHeight: 40,
          circleSize: 100,
        };
      default: // medium
        return {
          containerSize: 80,
          iconSize: 28,
          fontSize: 12,
          waveHeight: 30,
          barHeight: 25,
          circleSize: 70,
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
        warning: '#FF9500',
        error: '#FF3B30',
        background: '#1C1C1E',
        surface: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        wave: '#007AFF',
        spectrum: ['#FF3B30', '#FF9500', '#FFCC02', '#00C851', '#007AFF', '#5856D6'],
      };
    }
    return {
      primary: '#007AFF',
      secondary: '#FF9500',
      success: '#00C851',
      warning: '#FF9500',
      error: '#FF3B30',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      text: '#000000',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
      wave: '#007AFF',
      spectrum: ['#FF3B30', '#FF9500', '#FFCC02', '#00C851', '#007AFF', '#5856D6'],
    };
  };

  const colors = getThemeColors();

  // Get animation intensity multiplier
  const getIntensityMultiplier = () => {
    switch (animationIntensity) {
      case 'low': return 0.5;
      case 'high': return 1.5;
      default: return 1.0;
    }
  };

  const intensityMultiplier = getIntensityMultiplier();

  // Get state color
  const getStateColor = () => {
    switch (data.state) {
      case 'playing':
        return colors.success;
      case 'paused':
        return colors.warning;
      case 'loading':
      case 'buffering':
        return colors.secondary;
      case 'error':
        return colors.error;
      case 'seeking':
        return colors.primary;
      default:
        return colors.textSecondary;
    }
  };

  // Get state icon
  const getStateIcon = () => {
    switch (data.state) {
      case 'playing':
        return '▶';
      case 'paused':
        return '⏸';
      case 'loading':
      case 'buffering':
        return '⟳';
      case 'error':
        return '⚠';
      case 'seeking':
        return '⏩';
      case 'ended':
        return '⏹';
      case 'muted':
        return '🔇';
      default:
        return '⏸';
    }
  };

  // Get state message
  const getStateMessage = () => {
    switch (data.state) {
      case 'playing':
        return 'Playing';
      case 'paused':
        return 'Paused';
      case 'loading':
        return 'Loading...';
      case 'buffering':
        return 'Buffering...';
      case 'error':
        return 'Error';
      case 'seeking':
        return 'Seeking...';
      case 'ended':
        return 'Ended';
      case 'muted':
        return 'Muted';
      case 'volume_changed':
        return `Volume ${Math.round(data.volume * 100)}%`;
      default:
        return 'Ready';
    }
  };

  // Start animations based on state
  useEffect(() => {
    switch (data.state) {
      case 'playing':
        startPlayingAnimation();
        break;
      case 'loading':
      case 'buffering':
        startLoadingAnimation();
        break;
      case 'seeking':
        startSeekingAnimation();
        break;
      case 'volume_changed':
        startVolumeAnimation();
        break;
      case 'error':
        startErrorAnimation();
        break;
      default:
        stopAnimations();
    }
  }, [data.state]);

  // Update visualization based on audio data
  useEffect(() => {
    if (data.state === 'playing' && responsiveToAudio) {
      updateVisualization();
    }
  }, [data.frequency, data.waveform, data.volume]);

  const startPlayingAnimation = () => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1 + (0.1 * intensityMultiplier),
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Start visualization animations
    startVisualizationAnimation();
  };

  const startLoadingAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  };

  const startSeekingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startVolumeAnimation = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startErrorAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
    ).start();
  };

  const startVisualizationAnimation = () => {
    if (visualizationType === 'waveform') {
      const animations = waveAnims.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * intensityMultiplier + 0.3,
              duration: 200 + index * 50,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 200 + index * 50,
              useNativeDriver: true,
            }),
          ])
        )
      );
      Animated.stagger(100, animations).start();
    } else if (visualizationType === 'spectrum') {
      const animations = spectrumAnims.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * intensityMultiplier + 0.1,
              duration: 150 + index * 20,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.1,
              duration: 150 + index * 20,
              useNativeDriver: true,
            }),
          ])
        )
      );
      Animated.stagger(50, animations).start();
    } else if (visualizationType === 'bars') {
      const animations = barAnims.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * intensityMultiplier + 0.2,
              duration: 300 + index * 25,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2,
              duration: 300 + index * 25,
              useNativeDriver: true,
            }),
          ])
        )
      );
      Animated.stagger(80, animations).start();
    }
  };

  const updateVisualization = () => {
    if (data.frequency && visualizationType === 'spectrum') {
      data.frequency.forEach((freq, index) => {
        if (index < spectrumAnims.length) {
          Animated.timing(spectrumAnims[index], {
            toValue: (freq / 255) * intensityMultiplier,
            duration: 50,
            useNativeDriver: true,
          }).start();
        }
      });
    }

    if (data.waveform && visualizationType === 'waveform') {
      data.waveform.forEach((wave, index) => {
        if (index < waveAnims.length) {
          Animated.timing(waveAnims[index], {
            toValue: Math.abs(wave) * intensityMultiplier + 0.3,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }
      });
    }
  };

  const stopAnimations = () => {
    pulseAnim.stopAnimation();
    rotateAnim.stopAnimation();
    glowAnim.stopAnimation();
    bounceAnim.stopAnimation();

    waveAnims.forEach(anim => anim.stopAnimation());
    spectrumAnims.forEach(anim => anim.stopAnimation());
    barAnims.forEach(anim => anim.stopAnimation());

    // Reset to defaults
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    rotateAnim.setValue(0);
    bounceAnim.setValue(0);
    glowAnim.setValue(0);
  };

  const renderWaveform = () => (
    <View style={[styles.visualization, { height: sizeConfig.waveHeight }]}>
      {waveAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              height: sizeConfig.waveHeight,
              backgroundColor: colors.wave,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );

  const renderSpectrum = () => (
    <View style={[styles.visualization, { height: sizeConfig.waveHeight }]}>
      {spectrumAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.spectrumBar,
            {
              height: sizeConfig.waveHeight,
              backgroundColor: colors.spectrum[index % colors.spectrum.length],
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );

  const renderBars = () => (
    <View style={[styles.visualization, { height: sizeConfig.barHeight }]}>
      {barAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height: sizeConfig.barHeight,
              backgroundColor: getStateColor(),
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );

  const renderCircle = () => {
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Animated.View
        style={[
          styles.circle,
          {
            width: sizeConfig.circleSize,
            height: sizeConfig.circleSize,
            borderColor: getStateColor(),
            transform: [
              { scale: pulseAnim },
              { rotate: spin },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.circleGlow,
            {
              width: sizeConfig.circleSize + 20,
              height: sizeConfig.circleSize + 20,
              borderColor: getStateColor(),
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          ]}
        />
        <Text style={[styles.circleIcon, { 
          fontSize: sizeConfig.iconSize,
          color: getStateColor() 
        }]}>
          {getStateIcon()}
        </Text>
      </Animated.View>
    );
  };

  const renderMinimal = () => (
    <Animated.View
      style={[
        styles.minimal,
        {
          backgroundColor: getStateColor(),
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <Text style={[styles.minimalIcon, { fontSize: sizeConfig.iconSize }]}>
        {getStateIcon()}
      </Text>
    </Animated.View>
  );

  const renderVisualization = () => {
    switch (visualizationType) {
      case 'spectrum':
        return renderSpectrum();
      case 'circle':
        return renderCircle();
      case 'bars':
        return renderBars();
      case 'minimal':
        return renderMinimal();
      default:
        return renderWaveform();
    }
  };

  const renderStateText = () => {
    if (!showStateText) return null;

    return (
      <Text style={[
        styles.stateText,
        {
          fontSize: sizeConfig.fontSize,
          color: getStateColor(),
        },
      ]}>
        {getStateMessage()}
      </Text>
    );
  };

  const renderMetadata = () => {
    if (!showMetadata) return null;

    return (
      <View style={styles.metadata}>
        {data.bitrate && (
          <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
            {Math.round(data.bitrate / 1000)}kbps
          </Text>
        )}
        {data.isLive && (
          <View style={[styles.liveBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.surface,
        width: sizeConfig.containerSize,
        height: sizeConfig.containerSize,
      },
      style,
    ]}>
      {renderVisualization()}
      {renderStateText()}
      {renderMetadata()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  visualization: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 8,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  spectrumBar: {
    width: 2,
    borderRadius: 1,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
  circle: {
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circleGlow: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 2,
  },
  circleIcon: {
    fontWeight: '600',
  },
  minimal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalIcon: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stateText: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metadataText: {
    fontSize: 10,
    fontWeight: '500',
  },
  liveBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
});