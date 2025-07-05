import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Conversation, ConversationSearchFilters } from '@/types';
import { ConversationStorageService } from '@/services/conversationStorage';
import { ConversationListSkeleton } from './SkeletonLoader';

interface ConversationSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  currentConversationId?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onPress: () => void;
  onDelete: () => void;
}

const ConversationItem = memo(({ conversation, isSelected, onPress, onDelete }: ConversationItemProps) => {
  // Memoize expensive calculations
  const formattedDate = useMemo(() => {
    const now = new Date();
    const diffMs = now.getTime() - conversation.lastActivity.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return conversation.lastActivity.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return conversation.lastActivity.toLocaleDateString([], { weekday: 'short' });
    } else {
      return conversation.lastActivity.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, [conversation.lastActivity]);

  const previewText = useMemo(() => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage) {
      return lastMessage.content.length > 50 
        ? lastMessage.content.substring(0, 50) + '...'
        : lastMessage.content;
    }
    return 'No messages';
  }, [conversation.messages]);

  // Memoize styles
  const itemStyle = useMemo(() => [
    styles.conversationItem,
    isSelected && styles.selectedConversationItem,
  ], [isSelected]);

  const titleStyle = useMemo(() => [
    styles.conversationTitle,
    isSelected && styles.selectedConversationTitle,
  ], [isSelected]);

  const previewStyle = useMemo(() => [
    styles.conversationPreview,
    isSelected && styles.selectedConversationPreview,
  ], [isSelected]);

  return (
    <TouchableOpacity
      style={itemStyle}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.conversationHeader}>
        <Text 
          style={titleStyle} 
          numberOfLines={1}
        >
          {conversation.title}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      </View>
      
      <Text 
        style={previewStyle} 
        numberOfLines={2}
      >
        {previewText}
      </Text>
      
      <Text style={styles.conversationDate}>
        {formattedDate}
      </Text>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.title === nextProps.conversation.title &&
    prevProps.conversation.lastActivity.getTime() === nextProps.conversation.lastActivity.getTime() &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.conversation.messages.length === nextProps.conversation.messages.length
  );
});

const ConversationSidebarComponent = ({
  isVisible,
  onClose,
  onConversationSelect,
  onNewConversation,
  currentConversationId,
}: ConversationSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const ITEMS_PER_PAGE = 20;

  // Animation values
  const slideAnim = useRef(new Animated.Value(-screenWidth * 0.8)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Load conversations with pagination
  const loadConversations = useCallback(async (reset = false) => {
    try {
      setIsLoading(true);
      const currentPage = reset ? 0 : page;
      
      const searchFilters: ConversationSearchFilters = {
        sortBy: 'lastActivity',
        sortOrder: 'desc',
        isArchived: false,
        query: searchQuery.trim() || undefined,
        limit: ITEMS_PER_PAGE,
        offset: currentPage * ITEMS_PER_PAGE,
      };
      
      const loadedConversations = await ConversationStorageService.getConversations(searchFilters);
      
      if (reset) {
        setConversations(loadedConversations);
        setPage(0);
      } else {
        // Prevent duplicate conversations when appending
        setConversations(prev => {
          const existingIds = new Set(prev.map(conv => conv.id));
          const newConversations = loadedConversations.filter(conv => !existingIds.has(conv.id));
          return [...prev, ...newConversations];
        });
      }
      
      setHasMore(loadedConversations.length === ITEMS_PER_PAGE);
      if (!reset) setPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, page, ITEMS_PER_PAGE]);

  // Load more conversations (pagination)
  const loadMoreConversations = useCallback(() => {
    if (!isLoading && hasMore) {
      loadConversations(false);
    }
  }, [isLoading, hasMore, loadConversations]);

  // Load conversations on mount
  useEffect(() => {
    if (isVisible) {
      loadConversations(true);
    }
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search - separate from mount effect
  useEffect(() => {
    if (!isVisible) return;
    
    const timer = setTimeout(() => {
      // Reset pagination when search changes
      setPage(0);
      setHasMore(true);
      loadConversations(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle sidebar animation
  useEffect(() => {
    if (isVisible) {
      // Show sidebar
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide sidebar
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -screenWidth * 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, overlayOpacity]);

  // Handle conversation selection
  const handleConversationSelect = useCallback((conversationId: string) => {
    onConversationSelect(conversationId);
    onClose();
  }, [onConversationSelect, onClose]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    onNewConversation();
    onClose();
  }, [onNewConversation, onClose]);

  // Delete conversation
  const handleDeleteConversation = useCallback(async (conversationId: string, title: string) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ConversationStorageService.deleteConversation(conversationId);
              await loadConversations();
            } catch (error) {
              console.error('Failed to delete conversation:', error);
              Alert.alert('Error', 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  }, [loadConversations]);

  // Render conversation item
  const renderConversation = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      isSelected={item.id === currentConversationId}
      onPress={() => handleConversationSelect(item.id)}
      onDelete={() => handleDeleteConversation(item.id, item.title)}
    />
  ), [currentConversationId, handleConversationSelect, handleDeleteConversation]);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return <ConversationListSkeleton count={5} />;
    }
    
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>
          {searchQuery ? 'No conversations found' : 'No conversations yet'}
        </Text>
      </View>
    );
  }, [searchQuery, isLoading]);

  // Render footer with loading indicator
  const renderFooter = useCallback(() => {
    if (!hasMore || isLoading) {
      return null;
    }
    
    return (
      <View style={styles.loadingFooter}>
        <ConversationListSkeleton count={2} />
      </View>
    );
  }, [hasMore, isLoading]);

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {/* Overlay */}
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: overlayOpacity }
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          onPress={onClose}
          activeOpacity={1}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        </TouchableOpacity>
      </Animated.View>

      {/* Sidebar */}
      <Animated.View 
        style={[
          styles.sidebar,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Conversations</Text>
            <TouchableOpacity
              style={styles.newButton}
              onPress={handleNewConversation}
            >
              <Text style={styles.newButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Conversations List */}
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.id}
            style={styles.conversationsList}
            contentContainerStyle={styles.conversationsContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderFooter}
            onEndReached={loadMoreConversations}
            onEndReachedThreshold={0.1}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={10}
            getItemLayout={(data, index) => ({
              length: 80, // Approximate item height
              offset: 80 * index,
              index,
            })}
          />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

// Export memoized component
export const ConversationSidebar = memo(ConversationSidebarComponent);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overlayTouchable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: screenWidth * 0.8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  newButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    fontSize: 18,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    height: 36,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000000',
  },
  conversationsList: {
    flex: 1,
  },
  conversationsContainer: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  conversationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 2,
    marginHorizontal: 8,
  },
  selectedConversationItem: {
    backgroundColor: '#E3F2FD',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  selectedConversationTitle: {
    color: '#1976D2',
  },
  deleteButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  conversationPreview: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
    marginBottom: 4,
  },
  selectedConversationPreview: {
    color: '#1976D2',
  },
  conversationDate: {
    fontSize: 10,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  loadingFooter: {
    paddingVertical: 10,
  },
});