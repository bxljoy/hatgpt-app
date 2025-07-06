import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

interface SparklingOrbProps {
  size?: number;
  color?: string;
}

export function SparklingOrb({ size = 40, color = '#9CA3AF' }: SparklingOrbProps) {
  // Animation values for the main orb
  const orbScale = useRef(new Animated.Value(0.8)).current;
  const orbOpacity = useRef(new Animated.Value(0.6)).current;

  // Animation values for sparkling dots
  const dot1Scale = useRef(new Animated.Value(0)).current;
  const dot1Opacity = useRef(new Animated.Value(0)).current;
  const dot1Rotation = useRef(new Animated.Value(0)).current;

  const dot2Scale = useRef(new Animated.Value(0)).current;
  const dot2Opacity = useRef(new Animated.Value(0)).current;
  const dot2Rotation = useRef(new Animated.Value(0)).current;

  const dot3Scale = useRef(new Animated.Value(0)).current;
  const dot3Opacity = useRef(new Animated.Value(0)).current;
  const dot3Rotation = useRef(new Animated.Value(0)).current;

  const dot4Scale = useRef(new Animated.Value(0)).current;
  const dot4Opacity = useRef(new Animated.Value(0)).current;
  const dot4Rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main orb breathing animation
    const orbAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, {
            toValue: 1.1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbOpacity, {
            toValue: 0.9,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, {
            toValue: 0.8,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbOpacity, {
            toValue: 0.6,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Sparkling dots animations with staggered timing
    const createSparkleAnimation = (
      scale: Animated.Value,
      opacity: Animated.Value,
      rotation: Animated.Value,
      delay: number
    ) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(scale, {
                toValue: 1,
                duration: 400,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
              }),
              Animated.timing(scale, {
                toValue: 0,
                duration: 600,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(opacity, {
                toValue: 0.8,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(rotation, {
              toValue: 1,
              duration: 1000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(1500), // Pause between sparkles
        ])
      );
    };

    // Start animations
    orbAnimation.start();

    const sparkle1 = createSparkleAnimation(dot1Scale, dot1Opacity, dot1Rotation, 0);
    const sparkle2 = createSparkleAnimation(dot2Scale, dot2Opacity, dot2Rotation, 400);
    const sparkle3 = createSparkleAnimation(dot3Scale, dot3Opacity, dot3Rotation, 800);
    const sparkle4 = createSparkleAnimation(dot4Scale, dot4Opacity, dot4Rotation, 1200);

    sparkle1.start();
    sparkle2.start();
    sparkle3.start();
    sparkle4.start();

    // Cleanup animations
    return () => {
      orbAnimation.stop();
      sparkle1.stop();
      sparkle2.stop();
      sparkle3.stop();
      sparkle4.stop();
    };
  }, []);

  const sparkleStyle = (
    scale: Animated.Value,
    opacity: Animated.Value,
    rotation: Animated.Value,
    position: { top?: number; right?: number; bottom?: number; left?: number }
  ) => ({
    position: 'absolute' as const,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    ...position,
    transform: [
      {
        scale,
      },
      {
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
    opacity,
  });

  return (
    <View style={[styles.container, { width: size + 20, height: size + 20 }]}>
      {/* Main orb */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale: orbScale }],
            opacity: orbOpacity,
          },
        ]}
      />

      {/* Sparkling dots positioned around the orb */}
      <Animated.View style={sparkleStyle(dot1Scale, dot1Opacity, dot1Rotation, { top: 2, right: 8 })} />
      <Animated.View style={sparkleStyle(dot2Scale, dot2Opacity, dot2Rotation, { bottom: 2, left: 8 })} />
      <Animated.View style={sparkleStyle(dot3Scale, dot3Opacity, dot3Rotation, { top: 8, left: 2 })} />
      <Animated.View style={sparkleStyle(dot4Scale, dot4Opacity, dot4Rotation, { bottom: 8, right: 2 })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orb: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});