import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AudioWaveformProps {
  isActive?: boolean;
  isRecording?: boolean;
  waveColor?: string;
  inactiveColor?: string;
  height?: number;
  width?: number;
  barCount?: number;
  barWidth?: number;
  barSpacing?: number;
  animationSpeed?: number;
  intensity?: number;
  style?: any;
}

const { width: screenWidth } = Dimensions.get('window');

interface WaveBar {
  id: number;
  animValue: Animated.Value;
  baseHeight: number;
  maxHeight: number;
  delay: number;
}

export function AudioWaveform({
  isActive = false,
  isRecording = false,
  waveColor = '#007AFF',
  inactiveColor = '#E5E5EA',
  height = 60,
  width = screenWidth * 0.7,
  barCount = 30,
  barWidth = 3,
  barSpacing = 2,
  animationSpeed = 800,
  intensity = 1,
  style,
}: AudioWaveformProps) {
  const [waveBars, setWaveBars] = useState<WaveBar[]>([]);
  const masterAnimValue = useRef(new Animated.Value(0)).current;

  // Initialize wave bars
  useEffect(() => {
    const bars: WaveBar[] = [];
    
    for (let i = 0; i < barCount; i++) {
      bars.push({
        id: i,
        animValue: new Animated.Value(0),
        baseHeight: Math.random() * 8 + 4, // Random base height between 4-12
        maxHeight: Math.random() * (height * 0.8) + (height * 0.2), // Random max height
        delay: i * 50, // Staggered delay for wave effect
      });
    }
    
    setWaveBars(bars);
  }, [barCount, height]);

  // Main wave animation
  useEffect(() => {
    if (isActive && isRecording && waveBars.length > 0) {
      // Create individual bar animations
      const animations = waveBars.map((bar, index) => {
        const loopAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(bar.animValue, {
              toValue: 1,
              duration: animationSpeed + Math.random() * 400,
              useNativeDriver: false,
            }),
            Animated.timing(bar.animValue, {
              toValue: 0,
              duration: animationSpeed + Math.random() * 400,
              useNativeDriver: false,
            }),
          ])
        );
        
        // Add random delay for more natural look
        return Animated.delay(bar.delay + Math.random() * 200).start(() => {
          loopAnimation.start();
        });
      });

      // Master animation for overall wave effect
      const masterAnimation = Animated.loop(
        Animated.timing(masterAnimValue, {
          toValue: 1,
          duration: animationSpeed * 2,
          useNativeDriver: false,
        })
      );
      
      masterAnimation.start();

      return () => {
        masterAnimation.stop();
        waveBars.forEach(bar => {
          bar.animValue.stopAnimation();
          bar.animValue.setValue(0);
        });
      };
    } else {
      // Fade out animation when not active
      const fadeOutAnimations = waveBars.map(bar =>
        Animated.timing(bar.animValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        })
      );
      
      Animated.parallel(fadeOutAnimations).start();
      masterAnimValue.setValue(0);
    }
  }, [isActive, isRecording, waveBars, animationSpeed, masterAnimValue]);

  // Generate wave pattern based on frequency simulation
  const generateWavePattern = (barIndex: number) => {
    const centerIndex = barCount / 2;
    const distanceFromCenter = Math.abs(barIndex - centerIndex);
    const normalizedDistance = distanceFromCenter / centerIndex;
    
    // Create a wave pattern that's higher in the center
    const waveMultiplier = Math.cos(normalizedDistance * Math.PI / 2);
    return waveMultiplier * intensity;
  };

  const renderWaveBar = (bar: WaveBar, index: number) => {
    const wavePattern = generateWavePattern(index);
    
    const animatedHeight = bar.animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [bar.baseHeight, bar.maxHeight * wavePattern],
    });

    const animatedOpacity = bar.animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    });

    // Create a shimmer effect
    const shimmerTranslateX = masterAnimValue.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, width],
    });

    const currentColor = isActive && isRecording ? waveColor : inactiveColor;

    return (
      <View key={bar.id} style={styles.barContainer}>
        <Animated.View
          style={[
            styles.waveBar,
            {
              width: barWidth,
              height: animatedHeight,
              backgroundColor: currentColor,
              opacity: animatedOpacity,
              borderRadius: barWidth / 2,
            },
          ]}
        />
        
        {/* Shimmer overlay */}
        {isActive && isRecording && (
          <Animated.View
            style={[
              styles.shimmerOverlay,
              {
                width: barWidth,
                height: animatedHeight,
                transform: [{ translateX: shimmerTranslateX }],
                borderRadius: barWidth / 2,
              },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.6)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        )}
      </View>
    );
  };

  const totalWidth = barCount * (barWidth + barSpacing) - barSpacing;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          width: Math.min(width, totalWidth),
        },
        style,
      ]}
    >
      <View style={styles.waveContainer}>
        {waveBars.map((bar, index) => renderWaveBar(bar, index))}
      </View>
      
      {/* Background glow effect */}
      {isActive && isRecording && (
        <Animated.View
          style={[
            styles.glowBackground,
            {
              opacity: masterAnimValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.3],
              }),
            },
          ]}
        />
      )}
    </View>
  );
}

// Preset configurations
export const WaveformPresets = {
  minimal: {
    barCount: 15,
    barWidth: 2,
    barSpacing: 3,
    height: 40,
    animationSpeed: 1000,
  },
  standard: {
    barCount: 25,
    barWidth: 3,
    barSpacing: 2,
    height: 60,
    animationSpeed: 800,
  },
  detailed: {
    barCount: 40,
    barWidth: 2,
    barSpacing: 1,
    height: 80,
    animationSpeed: 600,
  },
  compact: {
    barCount: 12,
    barWidth: 4,
    barSpacing: 2,
    height: 30,
    animationSpeed: 900,
  },
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 8,
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
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  barContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
    position: 'relative',
  },
  waveBar: {
    minHeight: 2,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  glowBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
});