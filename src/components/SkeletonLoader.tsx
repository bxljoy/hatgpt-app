import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const { width: screenWidth } = Dimensions.get('window');

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Message skeleton for chat loading
export const MessageSkeleton: React.FC<{ isUser?: boolean }> = ({ isUser = false }) => (
  <View style={[
    styles.messageSkeletonContainer,
    isUser ? styles.userMessageSkeleton : styles.assistantMessageSkeleton,
  ]}>
    <View style={[
      styles.messageBubbleSkeleton,
      isUser ? styles.userBubbleSkeleton : styles.assistantBubbleSkeleton,
    ]}>
      <SkeletonLoader height={16} style={{ marginBottom: 8 }} />
      <SkeletonLoader height={16} width="80%" style={{ marginBottom: 8 }} />
      <SkeletonLoader height={12} width="40%" />
    </View>
  </View>
);

// Conversation item skeleton
export const ConversationItemSkeleton: React.FC = () => (
  <View style={styles.conversationItemSkeleton}>
    <View style={styles.conversationHeaderSkeleton}>
      <SkeletonLoader width="60%" height={16} />
      <SkeletonLoader width="40px" height={12} />
    </View>
    <SkeletonLoader height={14} style={{ marginVertical: 8 }} />
    <SkeletonLoader height={14} width="70%" />
    <View style={styles.conversationFooterSkeleton}>
      <SkeletonLoader width="80px" height={12} />
    </View>
  </View>
);

// List skeleton for conversation history
export const ConversationListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <View style={styles.listSkeleton}>
    {Array.from({ length: count }, (_, index) => (
      <ConversationItemSkeleton key={index} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
  },
  messageSkeletonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    maxWidth: '100%',
  },
  userMessageSkeleton: {
    justifyContent: 'flex-end',
  },
  assistantMessageSkeleton: {
    justifyContent: 'flex-start',
  },
  messageBubbleSkeleton: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  userBubbleSkeleton: {
    backgroundColor: '#E3F2FD',
    borderBottomRightRadius: 6,
  },
  assistantBubbleSkeleton: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 6,
  },
  conversationItemSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  conversationHeaderSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversationFooterSkeleton: {
    marginTop: 12,
  },
  listSkeleton: {
    flex: 1,
    paddingTop: 16,
  },
});