import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppError, ErrorSeverity } from '@/types/errors';

interface ErrorNotificationProps {
  error: AppError | null;
  onDismiss: () => void;
  onActionPress?: (actionId: string) => void;
  position?: 'top' | 'bottom';
  autoHideDelay?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export function ErrorNotification({
  error,
  onDismiss,
  onActionPress,
  position = 'top',
  autoHideDelay = 5000,
}: ErrorNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const autoHideTimer = useRef<NodeJS.Timeout | null>(null);

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (_, gestureState) => {
        const translateX = gestureState.dx;
        slideAnim.setValue(translateX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const dismissThreshold = screenWidth * 0.3;
        
        if (Math.abs(dx) > dismissThreshold || Math.abs(vx) > 0.5) {
          // Dismiss
          hideNotification();
        } else {
          // Snap back
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (error) {
      showNotification();
    } else {
      hideNotification();
    }
  }, [error]);

  useEffect(() => {
    return () => {
      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
      }
    };
  }, []);

  const showNotification = () => {
    setIsVisible(true);
    
    const slideToValue = 0;
    const slideFromValue = position === 'top' ? -100 : 100;
    
    slideAnim.setValue(slideFromValue);
    
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: slideToValue,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide for non-critical errors
    if (error?.severity !== ErrorSeverity.CRITICAL && autoHideDelay > 0) {
      autoHideTimer.current = setTimeout(() => {
        hideNotification();
      }, autoHideDelay);
    }
  };

  const hideNotification = () => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }

    const slideToValue = position === 'top' ? -100 : 100;
    
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: slideToValue,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      onDismiss();
    });
  };

  const handleActionPress = (actionId: string) => {
    if (onActionPress) {
      onActionPress(actionId);
    }
    hideNotification();
  };

  const getNotificationStyle = () => {
    if (!error) return {};

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return {
          backgroundColor: '#FF3B30',
          borderColor: '#D70015',
        };
      case ErrorSeverity.HIGH:
        return {
          backgroundColor: '#FF9500',
          borderColor: '#FF8C00',
        };
      case ErrorSeverity.MEDIUM:
        return {
          backgroundColor: '#FFCC02',
          borderColor: '#FFB800',
        };
      case ErrorSeverity.LOW:
        return {
          backgroundColor: '#34C759',
          borderColor: '#30B552',
        };
      default:
        return {
          backgroundColor: '#8E8E93',
          borderColor: '#6D6D70',
        };
    }
  };

  const getTextColor = () => {
    if (!error) return '#000000';

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return '#FFFFFF';
      case ErrorSeverity.MEDIUM:
        return '#000000';
      case ErrorSeverity.LOW:
        return '#FFFFFF';
      default:
        return '#FFFFFF';
    }
  };

  const getIcon = () => {
    if (!error) return '❓';

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return '🚨';
      case ErrorSeverity.HIGH:
        return '⚠️';
      case ErrorSeverity.MEDIUM:
        return '⚠️';
      case ErrorSeverity.LOW:
        return 'ℹ️';
      default:
        return '❓';
    }
  };

  if (!isVisible || !error) {
    return null;
  }

  const notificationStyle = getNotificationStyle();
  const textColor = getTextColor();
  const icon = getIcon();

  return (
    <SafeAreaView style={[styles.container, { [position]: 0 }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.notification,
          notificationStyle,
          {
            transform: [
              { translateY: slideAnim },
              { translateX: slideAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Main Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.icon}>{icon}</Text>
            <View style={styles.messageContainer}>
              <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
                {error.userMessage}
              </Text>
              {error.context?.component && (
                <Text style={[styles.context, { color: textColor }]} numberOfLines={1}>
                  {error.context.component}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={hideNotification}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.dismissText, { color: textColor }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Recovery Actions */}
          {error.recoveryActions && error.recoveryActions.length > 0 && (
            <View style={styles.actionsContainer}>
              {error.recoveryActions.slice(0, 2).map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionButton,
                    action.isPrimary && styles.primaryActionButton,
                  ]}
                  onPress={() => handleActionPress(action.id)}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: textColor },
                      action.isPrimary && styles.primaryActionButtonText,
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Progress Bar for Auto-hide */}
        {error.severity !== ErrorSeverity.CRITICAL && autoHideDelay > 0 && (
          <ProgressBar duration={autoHideDelay} color={textColor} />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// Progress bar component for auto-hide timer
function ProgressBar({ duration, color }: { duration: number; color: string }) {
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();
  }, [duration, progressAnim]);

  return (
    <View style={styles.progressContainer}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: color,
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },
  notification: {
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  messageContainer: {
    flex: 1,
    marginRight: 12,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 2,
  },
  context: {
    fontSize: 12,
    opacity: 0.8,
  },
  dismissButton: {
    padding: 4,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  primaryActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryActionButtonText: {
    color: '#000000',
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBar: {
    height: 3,
    opacity: 0.6,
  },
});