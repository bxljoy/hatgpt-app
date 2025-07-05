import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Conversation, ConversationSearchFilters } from '@/types';
import { ConversationStorageService } from '@/services/conversationStorage';
import { RootStackParamList } from '@/navigation/AppNavigator';

type ConversationListNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConversationList'>;

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  onLongPress: () => void;
  onStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function ConversationItem({ 
  conversation, 
  onPress, 
  onLongPress, 
  onStar, 
  onArchive, 
  onDelete 
}: ConversationItemProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getPreviewText = () => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage) {
      return lastMessage.content.length > 80 
        ? lastMessage.content.substring(0, 80) + '...'
        : lastMessage.content;
    }
    return 'No messages';
  };

  return (
    <TouchableOpacity
      style={[styles.conversationItem, conversation.isArchived && styles.archivedItem]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.conversationHeader}>
        <View style={styles.conversationTitleRow}>
          <Text style={[styles.conversationTitle, conversation.isArchived && styles.archivedText]} numberOfLines={1}>
            {conversation.title}
          </Text>
          <TouchableOpacity onPress={onStar} style={styles.starButton}>
            <Text style={[styles.starIcon, conversation.isStarred && styles.starIconActive]}>
              {conversation.isStarred ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.conversationDate}>{formatDate(conversation.lastActivity)}</Text>
      </View>
      
      <Text style={[styles.conversationPreview, conversation.isArchived && styles.archivedText]} numberOfLines={2}>
        {getPreviewText()}
      </Text>
      
      <View style={styles.conversationFooter}>
        <Text style={styles.messageCount}>
          {conversation.messages.length} message{conversation.messages.length !== 1 ? 's' : ''}
        </Text>
        
        <View style={styles.actionButtons}>
          {conversation.isArchived ? (
            <TouchableOpacity onPress={onArchive} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Unarchive</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onArchive} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Archive</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDelete} style={[styles.actionButton, styles.deleteButton]}>
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
        
        {conversation.tags && conversation.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {conversation.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {conversation.tags.length > 3 && (
              <Text style={styles.moreTagsText}>+{conversation.tags.length - 3}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function ConversationListScreen() {
  const navigation = useNavigation<ConversationListNavigationProp>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'starred' | 'archived'>('all');

  // Search filters based on current state
  const searchFilters = useMemo((): ConversationSearchFilters => {
    const filters: ConversationSearchFilters = {
      sortBy: 'lastActivity',
      sortOrder: 'desc',
    };

    if (searchQuery.trim()) {
      filters.query = searchQuery.trim();
    }

    switch (selectedFilter) {
      case 'starred':
        filters.isStarred = true;
        filters.isArchived = false;
        break;
      case 'archived':
        filters.isArchived = true;
        break;
      case 'all':
      default:
        filters.isArchived = false;
        break;
    }

    return filters;
  }, [searchQuery, selectedFilter]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedConversations = await ConversationStorageService.getConversations(searchFilters);
      setConversations(loadedConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [searchFilters]);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh conversations
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  // Create new conversation
  const createNewConversation = useCallback(() => {
    navigation.navigate('Chat');
  }, [navigation]);

  // Open conversation
  const openConversation = useCallback((conversationId: string) => {
    navigation.navigate('Chat', { conversationId });
  }, [navigation]);

  // Star/unstar conversation
  const toggleStar = useCallback(async (conversationId: string, isStarred: boolean) => {
    try {
      await ConversationStorageService.updateConversation(conversationId, {
        isStarred: !isStarred,
      });
      await loadConversations();
    } catch (error) {
      console.error('Failed to toggle star:', error);
      Alert.alert('Error', 'Failed to update conversation');
    }
  }, [loadConversations]);

  // Archive/unarchive conversation
  const toggleArchive = useCallback(async (conversationId: string, isArchived: boolean) => {
    try {
      await ConversationStorageService.updateConversation(conversationId, {
        isArchived: !isArchived,
      });
      await loadConversations();
    } catch (error) {
      console.error('Failed to toggle archive:', error);
      Alert.alert('Error', 'Failed to update conversation');
    }
  }, [loadConversations]);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string, title: string) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
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

  // Handle long press for context menu
  const handleLongPress = useCallback((conversation: Conversation) => {
    Alert.alert(
      conversation.title,
      'Choose an action',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: conversation.isStarred ? 'Remove Star' : 'Add Star',
          onPress: () => toggleStar(conversation.id, conversation.isStarred || false),
        },
        {
          text: conversation.isArchived ? 'Unarchive' : 'Archive',
          onPress: () => toggleArchive(conversation.id, conversation.isArchived || false),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteConversation(conversation.id, conversation.title),
        },
      ]
    );
  }, [toggleStar, toggleArchive, deleteConversation]);

  // Render conversation item
  const renderConversation = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      onPress={() => openConversation(item.id)}
      onLongPress={() => handleLongPress(item)}
      onStar={() => toggleStar(item.id, item.isStarred || false)}
      onArchive={() => toggleArchive(item.id, item.isArchived || false)}
      onDelete={() => deleteConversation(item.id, item.title)}
    />
  ), [openConversation, handleLongPress, toggleStar, toggleArchive, deleteConversation]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>
        {searchQuery ? 'No conversations found' : 'No conversations yet'}
      </Text>
      <Text style={styles.emptyStateText}>
        {searchQuery 
          ? 'Try adjusting your search or create a new conversation'
          : 'Start a new conversation to get started'
        }
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={createNewConversation}>
        <Text style={styles.createButtonText}>New Conversation</Text>
      </TouchableOpacity>
    </View>
  ), [searchQuery, createNewConversation]);

  // Render filter pills
  const renderFilterPills = () => (
    <View style={styles.filterContainer}>
      {[
        { key: 'all', label: 'All' },
        { key: 'starred', label: 'Starred' },
        { key: 'archived', label: 'Archived' },
      ].map(filter => (
        <TouchableOpacity
          key={filter.key}
          style={[
            styles.filterPill,
            selectedFilter === filter.key && styles.filterPillActive,
          ]}
          onPress={() => setSelectedFilter(filter.key as any)}
        >
          <Text
            style={[
              styles.filterPillText,
              selectedFilter === filter.key && styles.filterPillTextActive,
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Conversations</Text>
        <TouchableOpacity style={styles.newButton} onPress={createNewConversation}>
          <Text style={styles.newButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter Pills */}
      {renderFilterPills()}

      {/* Conversation List */}
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        style={styles.conversationsList}
        contentContainerStyle={[
          styles.conversationsContainer,
          conversations.length === 0 && styles.conversationsContainerEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={renderEmptyState}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    height: 44,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000000',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  filterPillActive: {
    backgroundColor: '#007AFF',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  conversationsList: {
    flex: 1,
  },
  conversationsContainer: {
    paddingHorizontal: 20,
  },
  conversationsContainerEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  conversationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  archivedItem: {
    opacity: 0.6,
    backgroundColor: '#F9F9F9',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  conversationTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  archivedText: {
    color: '#999999',
  },
  starButton: {
    padding: 4,
    marginLeft: 8,
  },
  starIcon: {
    fontSize: 16,
    color: '#C7C7CC',
  },
  starIconActive: {
    color: '#FFD700',
  },
  conversationDate: {
    fontSize: 12,
    color: '#8E8E93',
    minWidth: 60,
    textAlign: 'right',
  },
  conversationPreview: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  conversationFooter: {
    gap: 8,
  },
  messageCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  deleteButtonText: {
    color: '#FFFFFF',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#1976D2',
  },
  moreTagsText: {
    fontSize: 10,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});