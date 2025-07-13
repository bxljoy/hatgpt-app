import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  PanResponder,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceConversationOverlayProps {
  isVisible: boolean;
  voiceState: VoiceState;
  onClose: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onToggleListening: () => void;
  isListening: boolean;
  currentText?: string;
  responseText?: string;
  enableHaptics?: boolean;
}

export const VoiceConversationOverlay: React.FC<VoiceConversationOverlayProps> = ({
  isVisible,
  voiceState,
  onClose,
  onStartListening,
  onStopListening,
  onToggleListening,
  isListening,
  currentText = '',
  responseText = '',
  enableHaptics = true,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const orbScaleAnim = useRef(new Animated.Value(0.8)).current;
  const orbOpacityAnim = useRef(new Animated.Value(0.6)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Animation sequences for different states
  useEffect(() => {
    if (isVisible) {
      // Enter animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(orbScaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(orbOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  // State-based animations
  useEffect(() => {
    switch (voiceState) {
      case 'idle':
        startIdleAnimation();
        break;
      case 'listening':
        startListeningAnimation();
        break;
      case 'processing':
        startProcessingAnimation();
        break;
      case 'speaking':
        startSpeakingAnimation();
        break;
    }
  }, [voiceState]);

  const startIdleAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startListeningAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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
  };

  const startProcessingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startSpeakingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
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

  // Pan responder for swipe gestures
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dy) > 20;
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dy > 0) {
        slideAnim.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dy > 150 || gestureState.vy > 1.5) {
        onClose();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const handleOrbPress = () => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onToggleListening();
  };

  const getOrbColor = () => {
    switch (voiceState) {
      case 'listening':
        return ['#FF6B6B', '#FF8E53'];
      case 'processing':
        return ['#4ECDC4', '#44A08D'];
      case 'speaking':
        return ['#A8E6CF', '#7FCDCD'];
      default:
        return ['#667eea', '#764ba2'];
    }
  };

  const getStateText = () => {
    switch (voiceState) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'speaking':
        return 'Speaking...';
      default:
        return 'Tap to start';
    }
  };


  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <BlurView intensity={90} style={StyleSheet.absoluteFillObject}>
          <SafeAreaView style={styles.container}>
            {/* Close indicator */}
            <View style={styles.closeIndicator}>
              <View style={styles.closeHandle} />
            </View>

            {/* Main content */}
            <View style={styles.content}>
              {/* Orb container */}
              <View style={styles.orbContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleOrbPress}
                  style={styles.orbTouchable}
                >
                  <Animated.View
                    style={[
                      styles.orbWrapper,
                      {
                        transform: [
                          { scale: orbScaleAnim },
                          { scale: pulseAnim },
                        ],
                        opacity: orbOpacityAnim,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={getOrbColor()}
                      style={styles.orb}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    
                    {/* Ripple effect for processing */}
                    {voiceState === 'processing' && (
                      <Animated.View
                        style={[
                          styles.ripple,
                          {
                            transform: [
                              {
                                scale: waveAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 2],
                                }),
                              },
                            ],
                            opacity: waveAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 0],
                            }),
                          },
                        ]}
                      />
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* State text */}
              <Text style={styles.stateText}>{getStateText()}</Text>


              {/* Controls */}
              <View style={styles.controls}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.controlButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  closeIndicator: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  closeHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  orbTouchable: {
    position: 'relative',
  },
  orbWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ripple: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stateText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});