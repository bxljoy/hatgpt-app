import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

export interface VolumeSettings {
  volume: number; // 0.0 - 1.0 (app volume)
  systemVolume: number; // 0.0 - 1.0 (system volume)
  isMuted: boolean;
  useSystemVolume: boolean;
}

interface VolumeControlProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
  onMuteToggle?: (isMuted: boolean) => void;
  onSystemVolumeToggle?: (useSystem: boolean) => void;
  isMuted?: boolean;
  useSystemVolume?: boolean;
  showSystemVolume?: boolean;
  showMuteButton?: boolean;
  style?: any;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
  hapticFeedback?: boolean;
  precision?: number; // Number of decimal places for volume
}

export function VolumeControl({
  volume,
  onVolumeChange,
  onMuteToggle,
  onSystemVolumeToggle,
  isMuted = false,
  useSystemVolume = false,
  showSystemVolume = true,
  showMuteButton = true,
  style,
  orientation = 'horizontal',
  size = 'medium',
  theme = 'light',
  hapticFeedback = true,
  precision = 2,
}: VolumeControlProps) {
  const [systemVolume, setSystemVolume] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [tempVolume, setTempVolume] = useState(volume);
  const [trackSize, setTrackSize] = useState(0);

  // Animation refs
  const volumeAnim = useRef(new Animated.Value(volume)).current;
  const muteAnim = useRef(new Animated.Value(isMuted ? 0 : 1)).current;
  const systemIndicatorAnim = useRef(new Animated.Value(useSystemVolume ? 1 : 0)).current;

  // Pan responder for volume slider
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !useSystemVolume,
      onMoveShouldSetPanResponder: () => !useSystemVolume,
      
      onPanResponderGrant: (evt) => {
        if (useSystemVolume) return;
        
        setIsDragging(true);
        if (hapticFeedback) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        
        const newVolume = calculateVolumeFromTouch(evt.nativeEvent);
        setTempVolume(newVolume);
      },
      
      onPanResponderMove: (evt) => {
        if (useSystemVolume || !isDragging) return;
        
        const newVolume = calculateVolumeFromTouch(evt.nativeEvent);
        setTempVolume(newVolume);
        
        // Animate volume indicator
        Animated.timing(volumeAnim, {
          toValue: newVolume,
          duration: 0,
          useNativeDriver: false,
        }).start();
      },
      
      onPanResponderRelease: () => {
        if (useSystemVolume || !isDragging) return;
        
        setIsDragging(false);
        const finalVolume = parseFloat(tempVolume.toFixed(precision));
        onVolumeChange(finalVolume);
        
        if (hapticFeedback) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
    })
  ).current;

  // Size configurations
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          trackHeight: orientation === 'horizontal' ? 4 : 100,
          trackWidth: orientation === 'horizontal' ? 100 : 4,
          thumbSize: 16,
          iconSize: 16,
          fontSize: 10,
          padding: 8,
        };
      case 'large':
        return {
          trackHeight: orientation === 'horizontal' ? 8 : 200,
          trackWidth: orientation === 'horizontal' ? 200 : 8,
          thumbSize: 24,
          iconSize: 24,
          fontSize: 16,
          padding: 20,
        };
      default: // medium
        return {
          trackHeight: orientation === 'horizontal' ? 6 : 150,
          trackWidth: orientation === 'horizontal' ? 150 : 6,
          thumbSize: 20,
          iconSize: 20,
          fontSize: 12,
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
        secondary: '#FF9500',
        danger: '#FF3B30',
        background: '#1C1C1E',
        surface: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        track: '#38383A',
        muted: '#666666',
      };
    }
    return {
      primary: '#007AFF',
      secondary: '#FF9500',
      danger: '#FF3B30',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      text: '#000000',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
      track: '#E5E5EA',
      muted: '#C7C7CC',
    };
  };

  const colors = getThemeColors();

  // Get system volume on mount
  useEffect(() => {
    getSystemVolume();
    const interval = setInterval(getSystemVolume, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // Animate volume changes
  useEffect(() => {
    if (!isDragging) {
      Animated.timing(volumeAnim, {
        toValue: volume,
        duration: 200,
        useNativeDriver: false,
      }).start();
      setTempVolume(volume);
    }
  }, [volume, isDragging]);

  // Animate mute state
  useEffect(() => {
    Animated.timing(muteAnim, {
      toValue: isMuted ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isMuted]);

  // Animate system volume indicator
  useEffect(() => {
    Animated.timing(systemIndicatorAnim, {
      toValue: useSystemVolume ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [useSystemVolume]);

  const getSystemVolume = async () => {
    try {
      // Note: Getting actual system volume requires native modules
      // This is a placeholder implementation
      if (Platform.OS === 'ios') {
        // On iOS, we could use react-native-volume-manager or similar
        // For now, we'll simulate system volume
        setSystemVolume(0.8);
      } else {
        // On Android, we could use react-native-system-setting or similar
        setSystemVolume(0.8);
      }
    } catch (error) {
      console.error('Failed to get system volume:', error);
    }
  };

  const setSystemVolumeLevel = async (newVolume: number) => {
    try {
      // Note: Setting system volume requires native modules
      // This is a placeholder implementation
      console.log('Setting system volume to:', newVolume);
      setSystemVolume(newVolume);
    } catch (error) {
      console.error('Failed to set system volume:', error);
    }
  };

  const calculateVolumeFromTouch = (nativeEvent: any) => {
    const { locationX, locationY } = nativeEvent;
    
    if (orientation === 'horizontal') {
      const percentage = Math.max(0, Math.min(1, locationX / trackSize));
      return percentage;
    } else {
      const percentage = Math.max(0, Math.min(1, 1 - (locationY / trackSize)));
      return percentage;
    }
  };

  const getCurrentVolume = () => {
    return isDragging ? tempVolume : volume;
  };

  const getVolumePercentage = () => {
    return getCurrentVolume() * 100;
  };

  const getVolumeIcon = () => {
    const currentVol = getCurrentVolume();
    
    if (isMuted || currentVol === 0) return '🔇';
    if (currentVol < 0.33) return '🔈';
    if (currentVol < 0.66) return '🔉';
    return '🔊';
  };

  const handleMuteToggle = () => {
    onMuteToggle?.(!isMuted);
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSystemVolumeToggle = () => {
    onSystemVolumeToggle?.(!useSystemVolume);
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleVolumePresets = (preset: number) => {
    onVolumeChange(preset);
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderVolumeSlider = () => {
    const isHorizontal = orientation === 'horizontal';
    const trackLength = isHorizontal ? sizeConfig.trackWidth : sizeConfig.trackHeight;
    const trackThickness = isHorizontal ? sizeConfig.trackHeight : sizeConfig.trackWidth;

    return (
      <View
        style={[
          styles.sliderContainer,
          {
            width: isHorizontal ? trackLength : trackThickness + 20,
            height: isHorizontal ? trackThickness + 20 : trackLength,
          },
        ]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setTrackSize(isHorizontal ? width - 20 : height - 20);
        }}
      >
        <View
          style={[
            styles.track,
            {
              width: isHorizontal ? trackLength : trackThickness,
              height: isHorizontal ? trackThickness : trackLength,
              backgroundColor: useSystemVolume ? colors.muted : colors.track,
              opacity: isMuted ? 0.5 : 1,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Volume fill */}
          <Animated.View
            style={[
              styles.volumeFill,
              {
                [isHorizontal ? 'width' : 'height']: volumeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
                [isHorizontal ? 'height' : 'width']: '100%',
                backgroundColor: isMuted ? colors.muted : colors.primary,
                opacity: muteAnim,
              },
            ]}
          />

          {/* Volume thumb */}
          <Animated.View
            style={[
              styles.thumb,
              {
                width: sizeConfig.thumbSize,
                height: sizeConfig.thumbSize,
                backgroundColor: isMuted ? colors.muted : colors.primary,
                [isHorizontal ? 'left' : 'bottom']: volumeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
                [isHorizontal ? 'marginLeft' : 'marginBottom']: -sizeConfig.thumbSize / 2,
                opacity: muteAnim,
                transform: [{ scale: isDragging ? 1.2 : 1 }],
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderVolumeInfo = () => (
    <View style={[styles.volumeInfo, orientation === 'vertical' && styles.volumeInfoVertical]}>
      <Text style={[styles.volumeText, { 
        color: colors.text,
        fontSize: sizeConfig.fontSize 
      }]}>
        {Math.round(getVolumePercentage())}%
      </Text>
      
      {useSystemVolume && (
        <Text style={[styles.systemText, { 
          color: colors.textSecondary,
          fontSize: sizeConfig.fontSize * 0.8 
        }]}>
          System: {Math.round(systemVolume * 100)}%
        </Text>
      )}
    </View>
  );

  const renderControls = () => (
    <View style={[styles.controls, orientation === 'vertical' && styles.controlsVertical]}>
      {showMuteButton && (
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.surface }]}
          onPress={handleMuteToggle}
        >
          <Text style={[styles.controlIcon, { fontSize: sizeConfig.iconSize }]}>
            {getVolumeIcon()}
          </Text>
        </TouchableOpacity>
      )}

      {showSystemVolume && (
        <TouchableOpacity
          style={[
            styles.controlButton,
            {
              backgroundColor: useSystemVolume ? colors.primary : colors.surface,
            },
          ]}
          onPress={handleSystemVolumeToggle}
        >
          <Animated.View style={{ opacity: systemIndicatorAnim }}>
            <Text style={[
              styles.controlIcon,
              {
                fontSize: sizeConfig.iconSize * 0.8,
                color: useSystemVolume ? '#FFFFFF' : colors.textSecondary,
              },
            ]}>
              📱
            </Text>
          </Animated.View>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderVolumePresets = () => (
    <View style={[styles.presets, orientation === 'vertical' && styles.presetsVertical]}>
      {[0, 0.25, 0.5, 0.75, 1].map((preset) => (
        <TouchableOpacity
          key={preset}
          style={[
            styles.presetButton,
            {
              backgroundColor: Math.abs(getCurrentVolume() - preset) < 0.05 
                ? colors.primary 
                : colors.surface,
            },
          ]}
          onPress={() => handleVolumePresets(preset)}
          disabled={useSystemVolume}
        >
          <Text style={[
            styles.presetText,
            {
              fontSize: sizeConfig.fontSize * 0.8,
              color: Math.abs(getCurrentVolume() - preset) < 0.05
                ? '#FFFFFF'
                : colors.textSecondary,
            },
          ]}>
            {Math.round(preset * 100)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.background,
        padding: sizeConfig.padding,
        flexDirection: orientation === 'horizontal' ? 'column' : 'row',
        alignItems: 'center',
      },
      style,
    ]}>
      {renderControls()}
      {renderVolumeSlider()}
      {renderVolumeInfo()}
      {size !== 'small' && renderVolumePresets()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    gap: 12,
  },
  sliderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  volumeFill: {
    borderRadius: 10,
  },
  thumb: {
    position: 'absolute',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  volumeInfo: {
    alignItems: 'center',
    gap: 4,
  },
  volumeInfoVertical: {
    width: 60,
  },
  volumeText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  systemText: {
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlsVertical: {
    flexDirection: 'column',
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  controlIcon: {
    fontWeight: '600',
  },
  presets: {
    flexDirection: 'row',
    gap: 6,
  },
  presetsVertical: {
    flexDirection: 'column',
  },
  presetButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 30,
    alignItems: 'center',
  },
  presetText: {
    fontWeight: '600',
  },
});