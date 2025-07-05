import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

import { SpeakingIndicator, SpeakingState } from './SpeakingIndicator';

export type SpeechControllerState = 'idle' | 'preparing' | 'speaking' | 'paused' | 'stopping' | 'stopped' | 'error';

export interface SpeechQueueItem {
  id: string;
  text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  voice?: string;
  speed?: number;
  volume?: number;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface SpeechControllerProps {
  onSpeechRequest?: (text: string, options?: any) => Promise<string>; // Returns audio URI
  onStateChange?: (state: SpeechControllerState) => void;
  autoPlay?: boolean;
  allowInterruption?: boolean;
  maxQueueSize?: number;
  style?: any;
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
  showQueue?: boolean;
  showProgress?: boolean;
}

export function SpeechController({
  onSpeechRequest,
  onStateChange,
  autoPlay = true,
  allowInterruption = true,
  maxQueueSize = 10,
  style,
  size = 'medium',
  theme = 'light',
  showQueue = true,
  showProgress = true,
}: SpeechControllerProps) {
  const [state, setState] = useState<SpeechControllerState>('idle');
  const [queue, setQueue] = useState<SpeechQueueItem[]>([]);
  const [currentItem, setCurrentItem] = useState<SpeechQueueItem | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [progress, setProgress] = useState(0);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Size configurations
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          buttonSize: 32,
          iconSize: 16,
          fontSize: 12,
          padding: 8,
        };
      case 'large':
        return {
          buttonSize: 64,
          iconSize: 32,
          fontSize: 18,
          padding: 20,
        };
      default: // medium
        return {
          buttonSize: 48,
          iconSize: 24,
          fontSize: 14,
          padding: 12,
        };
    }
  };

  const sizeConfig = getSizeConfig();

  // Theme colors
  const getThemeColors = () => {
    if (theme === 'dark') {
      return {
        primary: '#007AFF',
        danger: '#FF3B30',
        warning: '#FF9500',
        success: '#00C851',
        background: '#1C1C1E',
        surface: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
      };
    }
    return {
      primary: '#007AFF',
      danger: '#FF3B30',
      warning: '#FF9500',
      success: '#00C851',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      text: '#000000',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
    };
  };

  const colors = getThemeColors();

  // Update state and notify parent
  const updateState = (newState: SpeechControllerState) => {
    setState(newState);
    onStateChange?.(newState);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Auto-start next item when current completes
  useEffect(() => {
    if (state === 'stopped' && queue.length > 0 && autoPlay) {
      processNextQueueItem();
    }
  }, [state, queue.length, autoPlay]);

  // Animation effects
  useEffect(() => {
    if (state === 'speaking') {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [state]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
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

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const cleanup = async () => {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
      setSound(null);
    }
    setCurrentItem(null);
    setProgress(0);
  };

  const addToQueue = (item: SpeechQueueItem) => {
    setQueue(prev => {
      // Remove items if queue is at max size (keep urgent items)
      let newQueue = prev;
      if (prev.length >= maxQueueSize) {
        newQueue = prev.filter(queueItem => queueItem.priority === 'urgent').slice(0, maxQueueSize - 1);
      }

      // Insert based on priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const insertIndex = newQueue.findIndex(queueItem => 
        priorityOrder[item.priority] < priorityOrder[queueItem.priority]
      );

      if (insertIndex === -1) {
        return [...newQueue, item];
      } else {
        return [
          ...newQueue.slice(0, insertIndex),
          item,
          ...newQueue.slice(insertIndex),
        ];
      }
    });

    // Auto-start if idle
    if (state === 'idle' && autoPlay) {
      processNextQueueItem();
    }
  };

  const removeFromQueue = (itemId: string) => {
    setQueue(prev => prev.filter(item => item.id !== itemId));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const clearQueue = () => {
    Alert.alert(
      'Clear Queue',
      'Are you sure you want to clear all queued speech items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setQueue([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const processNextQueueItem = async () => {
    if (queue.length === 0) {
      updateState('idle');
      return;
    }

    const nextItem = queue[0];
    setQueue(prev => prev.slice(1));
    setCurrentItem(nextItem);

    await startSpeech(nextItem);
  };

  const startSpeech = async (item: SpeechQueueItem) => {
    if (!onSpeechRequest) {
      updateState('error');
      item.onError?.('No speech request handler provided');
      return;
    }

    try {
      updateState('preparing');
      setProgress(0);
      
      item.onStart?.();

      // Request speech synthesis
      const audioUri = await onSpeechRequest(item.text, {
        voice: item.voice,
        speed: item.speed,
        volume: item.volume,
      });

      // Load and play audio
      updateState('speaking');
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay: true,
          isLooping: false,
          volume: item.volume || 1.0,
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    } catch (error) {
      console.error('Speech synthesis error:', error);
      updateState('error');
      item.onError?.(error instanceof Error ? error.message : 'Speech synthesis failed');
      setCurrentItem(null);
      
      // Try next item after error
      if (queue.length > 0) {
        setTimeout(() => processNextQueueItem(), 1000);
      }
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      const progressPercent = status.durationMillis > 0 
        ? (status.positionMillis / status.durationMillis) * 100 
        : 0;
      setProgress(progressPercent);

      if (status.didJustFinish) {
        handleSpeechComplete();
      }
    }
  };

  const handleSpeechComplete = () => {
    updateState('stopped');
    currentItem?.onComplete?.();
    setCurrentItem(null);
    setProgress(0);
    cleanup();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const interrupt = async () => {
    if (state === 'idle' || state === 'stopped') return;

    if (!allowInterruption && state === 'speaking') {
      Alert.alert(
        'Interruption Not Allowed',
        'Current speech cannot be interrupted. Please wait for it to complete.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      updateState('stopping');
      
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      setCurrentItem(null);
      setProgress(0);
      updateState('stopped');
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.error('Error interrupting speech:', error);
      updateState('error');
    }
  };

  const pause = async () => {
    if (state !== 'speaking' || !sound) return;

    try {
      await sound.pauseAsync();
      updateState('paused');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error pausing speech:', error);
    }
  };

  const resume = async () => {
    if (state !== 'paused' || !sound) return;

    try {
      await sound.playAsync();
      updateState('speaking');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error resuming speech:', error);
    }
  };

  const skipCurrent = () => {
    interrupt();
    if (queue.length > 0) {
      setTimeout(() => processNextQueueItem(), 500);
    }
  };

  // Public API
  const speak = (text: string, options: Partial<SpeechQueueItem> = {}) => {
    const item: SpeechQueueItem = {
      id: `speech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      priority: 'medium',
      ...options,
    };

    addToQueue(item);
  };

  const speakUrgent = (text: string, options: Partial<SpeechQueueItem> = {}) => {
    // Interrupt current speech for urgent messages
    if (state === 'speaking' || state === 'paused') {
      interrupt();
    }
    
    speak(text, { ...options, priority: 'urgent' });
  };

  const getSpeakingIndicatorState = (): SpeakingState => {
    switch (state) {
      case 'preparing':
        return 'preparing';
      case 'speaking':
        return 'speaking';
      case 'paused':
        return 'paused';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  };

  const renderMainControls = () => (
    <View style={styles.mainControls}>
      <SpeakingIndicator
        isActive={state === 'speaking'}
        state={getSpeakingIndicatorState()}
        text={currentItem?.text}
        progress={showProgress ? progress : undefined}
        size={size}
        theme={theme}
        showText={currentItem !== null}
        showProgress={showProgress}
        animationType="waves"
      />

      <View style={styles.controlButtons}>
        {state === 'speaking' && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.warning }]}
            onPress={pause}
          >
            <Text style={[styles.controlButtonIcon, { fontSize: sizeConfig.iconSize }]}>
              ⏸
            </Text>
          </TouchableOpacity>
        )}

        {state === 'paused' && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.success }]}
            onPress={resume}
          >
            <Text style={[styles.controlButtonIcon, { fontSize: sizeConfig.iconSize }]}>
              ▶
            </Text>
          </TouchableOpacity>
        )}

        {(state === 'speaking' || state === 'paused') && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.danger }]}
            onPress={interrupt}
          >
            <Text style={[styles.controlButtonIcon, { fontSize: sizeConfig.iconSize }]}>
              ⏹
            </Text>
          </TouchableOpacity>
        )}

        {queue.length > 0 && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.primary }]}
            onPress={skipCurrent}
          >
            <Text style={[styles.controlButtonIcon, { fontSize: sizeConfig.iconSize }]}>
              ⏭
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderQueue = () => {
    if (!showQueue || queue.length === 0) return null;

    return (
      <View style={[styles.queueSection, { backgroundColor: colors.surface }]}>
        <View style={styles.queueHeader}>
          <Text style={[styles.queueTitle, { color: colors.text }]}>
            Queue ({queue.length})
          </Text>
          <TouchableOpacity style={styles.clearButton} onPress={clearQueue}>
            <Text style={[styles.clearButtonText, { color: colors.danger }]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        {queue.slice(0, 3).map((item, index) => (
          <View key={item.id} style={styles.queueItem}>
            <View style={styles.queueItemInfo}>
              <Text
                style={[styles.queueItemText, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.text}
              </Text>
              <Text style={[styles.queueItemMeta, { color: colors.textSecondary }]}>
                Priority: {item.priority}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeFromQueue(item.id)}
            >
              <Text style={[styles.removeButtonText, { color: colors.danger }]}>
                ×
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {queue.length > 3 && (
          <Text style={[styles.moreItemsText, { color: colors.textSecondary }]}>
            +{queue.length - 3} more items
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      {renderMainControls()}
      {renderQueue()}
    </View>
  );
}

// Export the public API methods
export const createSpeechController = () => {
  const controllerRef = useRef<{
    speak: (text: string, options?: Partial<SpeechQueueItem>) => void;
    speakUrgent: (text: string, options?: Partial<SpeechQueueItem>) => void;
    interrupt: () => void;
    pause: () => void;
    resume: () => void;
    clearQueue: () => void;
  } | null>(null);

  return {
    ref: controllerRef,
    component: SpeechController,
  };
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  mainControls: {
    padding: 16,
    alignItems: 'center',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtonIcon: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  queueSection: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemText: {
    fontSize: 14,
    marginBottom: 2,
  },
  queueItemMeta: {
    fontSize: 12,
  },
  removeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  moreItemsText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});