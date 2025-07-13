import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export type VoiceRecordingState = 'idle' | 'recording' | 'processing' | 'transcribing' | 'editing' | 'completed' | 'error' | 'cancelled';

interface VoiceRecordingOverlayProps {
  isVisible: boolean;
  voiceState: VoiceRecordingState;
  onClose: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onToggleListening: () => void;
  isListening: boolean;
  currentText?: string;
  responseText?: string;
  enableHaptics?: boolean;
}

export const VoiceRecordingOverlay: React.FC<VoiceRecordingOverlayProps> = ({
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
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Animation for entry/exit
  useEffect(() => {
    if (isVisible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  // Waveform animation for recording state
  useEffect(() => {
    if (isListening || voiceState === 'recording') {
      const animate = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(waveAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: false,
            }),
            Animated.timing(waveAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: false,
            }),
          ])
        ).start();
      };
      animate();
    } else {
      waveAnim.setValue(0);
    }
  }, [isListening]);

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
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <SafeAreaView style={styles.container}>
          {/* Main content - centered */}
          <View style={styles.content}>
            {/* Listening indicator with waveform */}
            <View style={styles.listeningContainer}>
              <View style={styles.waveform}>
                {[...Array(6)].map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: waveAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [4, 8 + i * 6],
                        }),
                        opacity: waveAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ]}
                  />
                ))}
              </View>
              
              <Text style={styles.listeningText}>
                {voiceState === 'recording' ? 'Listening' : 
                 voiceState === 'processing' ? 'Processing' :
                 voiceState === 'transcribing' ? 'Processing' :
                 'Listening'}
              </Text>
            </View>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            {/* Cancel button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelIcon}>✕</Text>
            </TouchableOpacity>

            {/* Confirm button */}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onStopListening}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmIcon}>✓</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 16,
    height: 40,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#666666',
    borderRadius: 1.5,
    minHeight: 4,
  },
  listeningText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 60,
    paddingBottom: 50,
  },
  cancelButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  confirmButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '400',
  },
});