import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

interface ThinkingDotsProps {
  size?: number;
  color?: string;
}

export function ThinkingDots({ size = 8, color = '#9CA3AF' }: ThinkingDotsProps) {
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  const dot1Scale = useRef(new Animated.Value(0.8)).current;
  const dot2Scale = useRef(new Animated.Value(0.8)).current;
  const dot3Scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const createDotAnimation = (
      opacity: Animated.Value,
      scale: Animated.Value,
      delay: number
    ) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(opacity, {
                toValue: 1,
                duration: 400,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0.3,
                duration: 400,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(scale, {
                toValue: 1.2,
                duration: 400,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(scale, {
                toValue: 0.8,
                duration: 400,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.delay(200), // Pause before next cycle
        ])
      );
    };

    const animation1 = createDotAnimation(dot1Opacity, dot1Scale, 0);
    const animation2 = createDotAnimation(dot2Opacity, dot2Scale, 200);
    const animation3 = createDotAnimation(dot3Opacity, dot3Scale, 400);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, []);

  const dotStyle = (opacity: Animated.Value, scale: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    marginHorizontal: 2,
    opacity,
    transform: [{ scale }],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={dotStyle(dot1Opacity, dot1Scale)} />
      <Animated.View style={dotStyle(dot2Opacity, dot2Scale)} />
      <Animated.View style={dotStyle(dot3Opacity, dot3Scale)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});