import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { SparklingOrb } from './SparklingOrb';
import { ThinkingDots } from './ThinkingDots';

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

// Message skeleton for chat loading with ChatGPT-style animations
export const MessageSkeleton: React.FC<{ isUser?: boolean; animationType?: 'orb' | 'dots' }> = ({ 
  isUser = false, 
  animationType = 'dots' 
}) => {
  if (isUser) {
    // Keep skeleton for user messages
    return (
      <View style={[
        styles.messageSkeletonContainer,
        styles.userMessageSkeleton,
      ]}>
        <View style={[
          styles.messageBubbleSkeleton,
          styles.userBubbleSkeleton,
        ]}>
          <SkeletonLoader height={16} style={{ marginBottom: 8 }} />
          <SkeletonLoader height={16} width="80%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={12} width="40%" />
        </View>
      </View>
    );
  }

  // Use different animations for assistant loading
  if (animationType === 'orb') {
    return (
      <View style={styles.sparklingOrbContainer}>
        <SparklingOrb size={36} color="#9CA3AF" />
      </View>
    );
  }

  // Default: ChatGPT-style thinking dots in a message bubble
  return (
    <View style={styles.thinkingContainer}>
      <View style={styles.thinkingBubble}>
        <ThinkingDots size={8} color="#9CA3AF" />
      </View>
    </View>
  );
};

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
  sparklingOrbContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  thinkingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  thinkingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
});