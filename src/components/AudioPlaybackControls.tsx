import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export type PlaybackSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

interface AudioPlaybackControlsProps {
  audioUri?: string;
  autoPlay?: boolean;
  showProgress?: boolean;
  showSpeed?: boolean;
  showVolume?: boolean;
  initialSpeed?: PlaybackSpeed;
  initialVolume?: number;
  onStateChange?: (state: PlaybackState) => void;
  onProgress?: (position: number, duration: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  style?: any;
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
}

const { width: screenWidth } = Dimensions.get('window');

export function AudioPlaybackControls({
  audioUri,
  autoPlay = false,
  showProgress = true,
  showSpeed = true,
  showVolume = false,
  initialSpeed = 1.0,
  initialVolume = 1.0,
  onStateChange,
  onProgress,
  onComplete,
  onError,
  style,
  size = 'medium',
  theme = 'light',
}: AudioPlaybackControlsProps) {
  const [state, setState] = useState<PlaybackState>('idle');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(initialSpeed);
  const [volume, setVolume] = useState(initialVolume);
  const [isLoaded, setIsLoaded] = useState(false);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.4),
    new Animated.Value(0.7),
  ]).current;

  const progressUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Size configurations
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          buttonSize: 32,
          iconSize: 16,
          progressHeight: 3,
          waveHeight: 20,
        };
      case 'large':
        return {
          buttonSize: 64,
          iconSize: 32,
          progressHeight: 6,
          waveHeight: 40,
        };
      default: // medium
        return {
          buttonSize: 48,
          iconSize: 24,
          progressHeight: 4,
          waveHeight: 30,
        };
    }
  };

  const sizeConfig = getSizeConfig();

  // Theme colors
  const getThemeColors = () => {
    if (theme === 'dark') {
      return {
        primary: '#007AFF',
        secondary: '#8E8E93',
        background: '#1C1C1E',
        surface: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
      };
    }
    return {
      primary: '#007AFF',
      secondary: '#8E8E93',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      text: '#000000',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
    };
  };

  const colors = getThemeColors();

  // Update state and notify parent
  const updateState = (newState: PlaybackState) => {
    setState(newState);
    onStateChange?.(newState);
  };

  // Setup audio
  useEffect(() => {
    setupAudio();
    return () => {
      cleanup();
    };
  }, []);

  // Load audio when URI changes
  useEffect(() => {
    if (audioUri) {
      loadAudio();
    } else {
      cleanup();
    }
  }, [audioUri]);

  // Auto play when loaded
  useEffect(() => {
    if (isLoaded && autoPlay && state === 'idle') {
      handlePlay();
    }
  }, [isLoaded, autoPlay]);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  };

  const loadAudio = async () => {
    if (!audioUri) return;

    try {
      updateState('loading');
      
      // Unload previous sound
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay: false,
          isLooping: false,
          rate: speed,
          volume: volume,
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsLoaded(true);
      updateState('idle');
    } catch (error) {
      console.error('Failed to load audio:', error);
      updateState('error');
      onError?.('Failed to load audio file');
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      
      onProgress?.(status.positionMillis || 0, status.durationMillis || 0);

      if (status.didJustFinish) {
        handleComplete();
      }
    }
  };

  const cleanup = async () => {
    if (progressUpdateRef.current) {
      clearInterval(progressUpdateRef.current);
    }

    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
      setSound(null);
    }

    setIsLoaded(false);
    setPosition(0);
    setDuration(0);
    updateState('idle');
  };

  const handlePlay = async () => {
    if (!sound || !isLoaded) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (state === 'paused') {
        await sound.playAsync();
      } else {
        await sound.replayAsync();
      }
      
      updateState('playing');
      startAnimations();
    } catch (error) {
      console.error('Failed to play audio:', error);
      updateState('error');
      onError?.('Failed to play audio');
    }
  };

  const handlePause = async () => {
    if (!sound || state !== 'playing') return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sound.pauseAsync();
      updateState('paused');
      stopAnimations();
    } catch (error) {
      console.error('Failed to pause audio:', error);
      onError?.('Failed to pause audio');
    }
  };

  const handleStop = async () => {
    if (!sound) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      updateState('stopped');
      stopAnimations();
      setPosition(0);
    } catch (error) {
      console.error('Failed to stop audio:', error);
      onError?.('Failed to stop audio');
    }
  };

  const handleComplete = () => {
    updateState('stopped');
    stopAnimations();
    setPosition(0);
    onComplete?.();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSeek = async (seekPosition: number) => {
    if (!sound || !isLoaded) return;

    try {
      await sound.setPositionAsync(seekPosition);
      setPosition(seekPosition);
    } catch (error) {
      console.error('Failed to seek audio:', error);
    }
  };

  const handleSpeedChange = async () => {
    const speeds: PlaybackSpeed[] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];

    setSpeed(newSpeed);

    if (sound && isLoaded) {
      try {
        await sound.setRateAsync(newSpeed, true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error('Failed to change playback speed:', error);
      }
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);

    if (sound && isLoaded) {
      try {
        await sound.setVolumeAsync(clampedVolume);
      } catch (error) {
        console.error('Failed to change volume:', error);
      }
    }
  };

  const startAnimations = () => {
    // Pulse animation for play button
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

    // Wave animations
    const waveAnimations = waveAnims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 300 + index * 100,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 300 + index * 100,
            useNativeDriver: true,
          }),
        ])
      )
    );

    Animated.stagger(100, waveAnimations).start();
  };

  const stopAnimations = () => {
    pulseAnim.stopAnimation();
    waveAnims.forEach(anim => anim.stopAnimation());
    
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const formatTime = (timeMs: number) => {
    const seconds = Math.floor(timeMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (duration === 0) return 0;
    return (position / duration) * 100;
  };

  const renderMainButton = () => {
    const isPlayingOrPaused = state === 'playing' || state === 'paused';
    
    return (
      <Animated.View style={[
        styles.mainButton,
        {
          width: sizeConfig.buttonSize,
          height: sizeConfig.buttonSize,
          backgroundColor: colors.primary,
        },
        state === 'playing' && { transform: [{ scale: pulseAnim }] }
      ]}>
        <TouchableOpacity
          style={styles.buttonTouchable}
          onPress={isPlayingOrPaused && state === 'playing' ? handlePause : handlePlay}
          disabled={state === 'loading' || state === 'error' || !isLoaded}
        >
          <Text style={[styles.buttonIcon, { fontSize: sizeConfig.iconSize }]}>
            {state === 'loading' ? '⟳' : 
             state === 'playing' ? '⏸' : 
             state === 'error' ? '⚠' : '▶'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSecondaryControls = () => (
    <View style={styles.secondaryControls}>
      <TouchableOpacity
        style={[styles.secondaryButton, { backgroundColor: colors.surface }]}
        onPress={handleStop}
        disabled={state === 'idle' || state === 'loading' || state === 'error'}
      >
        <Text style={[styles.secondaryButtonIcon, { color: colors.text }]}>⏹</Text>
      </TouchableOpacity>

      {showSpeed && (
        <TouchableOpacity
          style={[styles.speedButton, { backgroundColor: colors.surface }]}
          onPress={handleSpeedChange}
          disabled={state === 'loading' || state === 'error'}
        >
          <Text style={[styles.speedButtonText, { color: colors.text }]}>
            {speed}×
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderProgress = () => {
    if (!showProgress) return null;

    return (
      <View style={styles.progressContainer}>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {formatTime(position)}
        </Text>
        
        <View style={[styles.progressTrack, { 
          height: sizeConfig.progressHeight,
          backgroundColor: colors.border 
        }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${getProgressPercentage()}%`,
                height: sizeConfig.progressHeight,
                backgroundColor: colors.primary,
              },
            ]}
          />
          <TouchableOpacity
            style={[styles.progressHandle, {
              left: `${getProgressPercentage()}%`,
              backgroundColor: colors.primary,
            }]}
            onPanResponderMove={(evt) => {
              // Handle seeking - would need PanResponder for full implementation
            }}
          />
        </View>
        
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {formatTime(duration)}
        </Text>
      </View>
    );
  };

  const renderWaveAnimation = () => {
    if (state !== 'playing') return null;

    return (
      <View style={[styles.waveContainer, { height: sizeConfig.waveHeight }]}>
        {waveAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.waveBar,
              {
                height: sizeConfig.waveHeight,
                backgroundColor: colors.primary,
                transform: [{ scaleY: anim }],
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderVolumeControl = () => {
    if (!showVolume) return null;

    return (
      <View style={styles.volumeContainer}>
        <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>
          🔊
        </Text>
        <View style={[styles.volumeTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.volumeFill,
              {
                width: `${volume * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
        <Text style={[styles.volumeValue, { color: colors.textSecondary }]}>
          {Math.round(volume * 100)}%
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      <View style={styles.controlsRow}>
        {renderMainButton()}
        {renderSecondaryControls()}
      </View>
      
      {renderWaveAnimation()}
      {renderProgress()}
      {renderVolumeControl()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  mainButton: {
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryControls: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonIcon: {
    fontSize: 14,
  },
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginBottom: 12,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
    marginBottom: 8,
  },
  progressTrack: {
    flex: 1,
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    borderRadius: 2,
  },
  progressHandle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -4,
    marginLeft: -6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 35,
    textAlign: 'center',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  volumeLabel: {
    fontSize: 14,
  },
  volumeTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  volumeFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  volumeValue: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 35,
    textAlign: 'right',
  },
});