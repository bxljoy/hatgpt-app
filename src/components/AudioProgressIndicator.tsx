import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

export interface AudioProgressData {
  position: number; // Current position in milliseconds
  duration: number; // Total duration in milliseconds
  buffered?: number; // Buffered amount in milliseconds
  isLoaded: boolean;
  isPlaying: boolean;
  playbackRate?: number;
}

interface AudioProgressIndicatorProps {
  progress: AudioProgressData;
  onSeek?: (position: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  style?: any;
  theme?: 'light' | 'dark';
  size?: 'small' | 'medium' | 'large';
  showTime?: boolean;
  showBuffer?: boolean;
  showPlaybackRate?: boolean;
  allowScrubbing?: boolean;
  chapters?: Array<{
    title: string;
    startTime: number;
    endTime: number;
  }>;
}

export function AudioProgressIndicator({
  progress,
  onSeek,
  onSeekStart,
  onSeekEnd,
  style,
  theme = 'light',
  size = 'medium',
  showTime = true,
  showBuffer = true,
  showPlaybackRate = false,
  allowScrubbing = true,
  chapters = [],
}: AudioProgressIndicatorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [tempPosition, setTempPosition] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => allowScrubbing,
      onMoveShouldSetPanResponder: () => allowScrubbing,
      
      onPanResponderGrant: (evt) => {
        if (!allowScrubbing) return;
        
        setIsDragging(true);
        onSeekStart?.();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const touchX = evt.nativeEvent.locationX;
        const newPosition = (touchX / trackWidth) * progress.duration;
        setTempPosition(Math.max(0, Math.min(progress.duration, newPosition)));
      },
      
      onPanResponderMove: (evt) => {
        if (!allowScrubbing || !isDragging) return;
        
        const touchX = Math.max(0, Math.min(trackWidth, evt.nativeEvent.locationX));
        const newPosition = (touchX / trackWidth) * progress.duration;
        setTempPosition(Math.max(0, Math.min(progress.duration, newPosition)));
      },
      
      onPanResponderRelease: () => {
        if (!allowScrubbing || !isDragging) return;
        
        setIsDragging(false);
        onSeek?.(tempPosition);
        onSeekEnd?.();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    })
  ).current;

  // Animation values
  const thumbScaleAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Size configurations
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          trackHeight: 3,
          thumbSize: 12,
          fontSize: 10,
          padding: 8,
        };
      case 'large':
        return {
          trackHeight: 8,
          thumbSize: 20,
          fontSize: 16,
          padding: 20,
        };
      default: // medium
        return {
          trackHeight: 5,
          thumbSize: 16,
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
        background: '#1C1C1E',
        surface: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        track: '#38383A',
        buffered: '#666666',
      };
    }
    return {
      primary: '#007AFF',
      secondary: '#FF9500',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      text: '#000000',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
      track: '#E5E5EA',
      buffered: '#C7C7CC',
    };
  };

  const colors = getThemeColors();

  // Animate thumb when dragging
  useEffect(() => {
    Animated.timing(thumbScaleAnim, {
      toValue: isDragging ? 1.5 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isDragging]);

  // Wave animation when playing
  useEffect(() => {
    if (progress.isPlaying && !isDragging) {
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
    } else {
      waveAnim.stopAnimation();
      Animated.timing(waveAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [progress.isPlaying, isDragging]);

  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCurrentPosition = () => {
    return isDragging ? tempPosition : progress.position;
  };

  const getProgressPercentage = () => {
    if (progress.duration === 0) return 0;
    return (getCurrentPosition() / progress.duration) * 100;
  };

  const getBufferedPercentage = () => {
    if (!showBuffer || !progress.buffered || progress.duration === 0) return 0;
    return (progress.buffered / progress.duration) * 100;
  };

  const renderChapterMarkers = () => {
    if (chapters.length === 0 || progress.duration === 0) return null;

    return chapters.map((chapter, index) => {
      const startPercentage = (chapter.startTime / progress.duration) * 100;
      
      return (
        <View
          key={index}
          style={[
            styles.chapterMarker,
            {
              left: `${startPercentage}%`,
              backgroundColor: colors.secondary,
            },
          ]}
        />
      );
    });
  };

  const renderCurrentChapter = () => {
    if (chapters.length === 0) return null;

    const currentChapter = chapters.find(
      chapter => getCurrentPosition() >= chapter.startTime && getCurrentPosition() <= chapter.endTime
    );

    if (!currentChapter) return null;

    return (
      <Text style={[styles.chapterText, { color: colors.textSecondary }]}>
        {currentChapter.title}
      </Text>
    );
  };

  const renderTimeDisplay = () => {
    if (!showTime) return null;

    return (
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, { 
          color: colors.text,
          fontSize: sizeConfig.fontSize 
        }]}>
          {formatTime(getCurrentPosition())}
        </Text>
        
        {showPlaybackRate && progress.playbackRate && progress.playbackRate !== 1 && (
          <View style={[styles.playbackRateBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.playbackRateText}>
              {progress.playbackRate}×
            </Text>
          </View>
        )}
        
        <Text style={[styles.timeText, { 
          color: colors.textSecondary,
          fontSize: sizeConfig.fontSize 
        }]}>
          {formatTime(progress.duration)}
        </Text>
      </View>
    );
  };

  const renderProgressTrack = () => (
    <View
      style={[styles.trackContainer, { padding: sizeConfig.padding }]}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        setTrackWidth(width - sizeConfig.padding * 2);
      }}
    >
      <View
        style={[
          styles.track,
          {
            height: sizeConfig.trackHeight,
            backgroundColor: colors.track,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Buffered progress */}
        {showBuffer && (
          <View
            style={[
              styles.bufferedTrack,
              {
                width: `${getBufferedPercentage()}%`,
                height: sizeConfig.trackHeight,
                backgroundColor: colors.buffered,
              },
            ]}
          />
        )}

        {/* Chapter markers */}
        {renderChapterMarkers()}

        {/* Progress fill */}
        <Animated.View
          style={[
            styles.progressTrack,
            {
              width: `${getProgressPercentage()}%`,
              height: sizeConfig.trackHeight,
              backgroundColor: colors.primary,
              opacity: progress.isPlaying && !isDragging ? waveAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }) : 1,
            },
          ]}
        />

        {/* Thumb */}
        {allowScrubbing && (
          <Animated.View
            style={[
              styles.thumb,
              {
                width: sizeConfig.thumbSize,
                height: sizeConfig.thumbSize,
                backgroundColor: colors.primary,
                left: `${getProgressPercentage()}%`,
                marginLeft: -sizeConfig.thumbSize / 2,
                transform: [{ scale: thumbScaleAnim }],
              },
            ]}
          />
        )}

        {/* Loading overlay */}
        {!progress.isLoaded && (
          <View style={[styles.loadingOverlay, {
            height: sizeConfig.trackHeight,
            backgroundColor: colors.border,
          }]}>
            <Animated.View
              style={[
                styles.loadingShimmer,
                {
                  height: sizeConfig.trackHeight,
                  backgroundColor: colors.primary,
                  opacity: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.7],
                  }),
                },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );

  const renderWaveform = () => {
    if (!progress.isPlaying || size === 'small') return null;

    const waveCount = Math.floor(screenWidth / 6);
    const waves = Array.from({ length: waveCount }, (_, index) => (
      <Animated.View
        key={index}
        style={[
          styles.waveBar,
          {
            height: sizeConfig.trackHeight * 2,
            backgroundColor: colors.primary,
            opacity: waveAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.8],
            }),
            transform: [{
              scaleY: waveAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
            }],
          },
        ]}
      />
    ));

    return (
      <View style={styles.waveformContainer}>
        {waves}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {renderCurrentChapter()}
      {renderTimeDisplay()}
      {renderProgressTrack()}
      {renderWaveform()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  timeText: {
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  playbackRateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  playbackRateText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  chapterText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  trackContainer: {
    width: '100%',
    justifyContent: 'center',
  },
  track: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  bufferedTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 10,
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 10,
  },
  chapterMarker: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    borderRadius: 1,
  },
  thumb: {
    position: 'absolute',
    top: -5,
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 10,
    overflow: 'hidden',
  },
  loadingShimmer: {
    width: '30%',
    borderRadius: 10,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
    marginTop: 8,
    gap: 2,
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
  },
});