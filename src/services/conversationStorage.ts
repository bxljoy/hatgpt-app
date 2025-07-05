import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { 
  Conversation, 
  StorageConversation, 
  Message, 
  ConversationSearchFilters, 
  ConversationBackup,
  ConversationStatistics,
  VoiceType
} from '@/types';

// Storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: '@conversations',
  CONVERSATION_INDEX: '@conversation_index',
  LAST_CONVERSATION_ID: '@last_conversation_id',
  BACKUP_METADATA: '@backup_metadata',
  STATISTICS: '@statistics',
} as const;

// Version for data migration
const STORAGE_VERSION = '1.0.0';

export class ConversationStorageService {
  // Convert between runtime and storage formats
  private static toStorageFormat(conversation: Conversation): StorageConversation {
    return {
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      lastActivity: conversation.lastActivity.toISOString(),
      messages: conversation.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      })),
    };
  }

  private static fromStorageFormat(storage: StorageConversation): Conversation {
    return {
      ...storage,
      createdAt: new Date(storage.createdAt),
      updatedAt: new Date(storage.updatedAt),
      lastActivity: new Date(storage.lastActivity),
      messages: storage.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    };
  }

  // Calculate conversation statistics
  private static calculateStatistics(messages: Message[]): ConversationStatistics {
    const stats: ConversationStatistics = {
      totalCharacters: 0,
      totalWords: 0,
      voiceInputCount: 0,
      textInputCount: 0,
      averageResponseTime: 0,
      modelsUsed: [],
      voicesUsed: [],
      totalDuration: 0,
      audioFileCount: 0,
      audioFileSizes: 0,
    };

    const responseTimes: number[] = [];
    const models = new Set<string>();
    const voices = new Set<VoiceType>();

    messages.forEach(msg => {
      stats.totalCharacters += msg.content.length;
      stats.totalWords += msg.content.split(/\s+/).filter(word => word.length > 0).length;

      if (msg.role === 'user') {
        if (msg.metadata?.inputType === 'voice') {
          stats.voiceInputCount++;
        } else {
          stats.textInputCount++;
        }
      }

      if (msg.metadata?.model) {
        models.add(msg.metadata.model);
      }

      if (msg.metadata?.audioSettings?.voice) {
        voices.add(msg.metadata.audioSettings.voice);
      }

      if (msg.metadata?.processingTime) {
        responseTimes.push(msg.metadata.processingTime);
      }

      if (msg.audioUrl) {
        stats.audioFileCount++;
      }
    });

    stats.modelsUsed = Array.from(models);
    stats.voicesUsed = Array.from(voices);
    
    if (responseTimes.length > 0) {
      stats.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    return stats;
  }

  // Generate conversation title using OpenAI
  static async generateTitle(messages: Message[], openaiApiKey: string): Promise<string> {
    if (messages.length === 0) {
      return 'New Conversation';
    }

    try {
      // Use first few messages to generate title
      const contextMessages = messages.slice(0, 3);
      const context = contextMessages.map(msg => 
        `${msg.role}: ${msg.content.substring(0, 200)}`
      ).join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Generate a short, descriptive title (max 50 characters) for this conversation. Return only the title, no quotes or explanations.',
            },
            {
              role: 'user',
              content: context,
            },
          ],
          max_tokens: 20,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const title = data.choices[0]?.message?.content?.trim();
        return title && title.length > 0 ? title.substring(0, 50) : 'New Conversation';
      }
    } catch (error) {
      console.warn('Failed to generate title:', error);
    }

    // Fallback: use first message content
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      const words = firstUserMessage.content.split(' ').slice(0, 6);
      return words.join(' ').substring(0, 50) + (words.length > 6 ? '...' : '');
    }

    return 'New Conversation';
  }

  // Save conversation
  static async saveConversation(conversation: Conversation): Promise<void> {
    try {
      const storageConversation = this.toStorageFormat(conversation);
      
      // Calculate and update statistics
      storageConversation.statistics = this.calculateStatistics(conversation.messages);
      storageConversation.messageCount = conversation.messages.length;
      storageConversation.updatedAt = new Date().toISOString();
      storageConversation.lastActivity = new Date().toISOString();

      // Save individual conversation
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.CONVERSATIONS}:${conversation.id}`,
        JSON.stringify(storageConversation)
      );

      // Update conversation index
      await this.updateConversationIndex(conversation.id);

      // Update last conversation ID
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CONVERSATION_ID, conversation.id);

    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw new Error('Failed to save conversation');
    }
  }

  // Load conversation by ID
  static async loadConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEYS.CONVERSATIONS}:${conversationId}`);
      if (!data) {
        return null;
      }

      const storageConversation: StorageConversation = JSON.parse(data);
      return this.fromStorageFormat(storageConversation);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      return null;
    }
  }

  // Get all conversations with filters
  static async getConversations(filters: ConversationSearchFilters = {}): Promise<Conversation[]> {
    try {
      const index = await this.getConversationIndex();
      let conversations: Conversation[] = [];

      // Load conversations in batches
      for (const id of index) {
        const conversation = await this.loadConversation(id);
        if (conversation) {
          conversations.push(conversation);
        }
      }

      // Apply filters
      conversations = this.applyFilters(conversations, filters);

      // Apply sorting
      conversations = this.applySorting(conversations, filters);

      // Apply pagination
      if (filters.offset || filters.limit) {
        const start = filters.offset || 0;
        const end = filters.limit ? start + filters.limit : undefined;
        conversations = conversations.slice(start, end);
      }

      return conversations;
    } catch (error) {
      console.error('Failed to get conversations:', error);
      return [];
    }
  }

  // Delete conversation
  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Load conversation to get audio files
      const conversation = await this.loadConversation(conversationId);
      
      // Delete audio files
      if (conversation) {
        for (const message of conversation.messages) {
          if (message.audioUrl) {
            try {
              await FileSystem.deleteAsync(message.audioUrl, { idempotent: true });
            } catch (error) {
              console.warn('Failed to delete audio file:', error);
            }
          }
        }
      }

      // Delete conversation data
      await AsyncStorage.removeItem(`${STORAGE_KEYS.CONVERSATIONS}:${conversationId}`);

      // Remove from index
      await this.removeFromConversationIndex(conversationId);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw new Error('Failed to delete conversation');
    }
  }

  // Update conversation
  static async updateConversation(
    conversationId: string, 
    updates: Partial<Conversation>
  ): Promise<void> {
    try {
      const conversation = await this.loadConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const updatedConversation: Conversation = {
        ...conversation,
        ...updates,
        updatedAt: new Date(),
        lastActivity: new Date(),
      };

      await this.saveConversation(updatedConversation);
    } catch (error) {
      console.error('Failed to update conversation:', error);
      throw new Error('Failed to update conversation');
    }
  }

  // Search conversations
  static async searchConversations(query: string): Promise<Conversation[]> {
    const filters: ConversationSearchFilters = {
      query,
      sortBy: 'lastActivity',
      sortOrder: 'desc',
    };
    return this.getConversations(filters);
  }

  // Get conversation index
  private static async getConversationIndex(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATION_INDEX);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get conversation index:', error);
      return [];
    }
  }

  // Update conversation index
  private static async updateConversationIndex(conversationId: string): Promise<void> {
    try {
      const index = await this.getConversationIndex();
      if (!index.includes(conversationId)) {
        index.unshift(conversationId); // Add to beginning for recent-first order
        await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATION_INDEX, JSON.stringify(index));
      }
    } catch (error) {
      console.error('Failed to update conversation index:', error);
    }
  }

  // Remove from conversation index
  private static async removeFromConversationIndex(conversationId: string): Promise<void> {
    try {
      const index = await this.getConversationIndex();
      const updatedIndex = index.filter(id => id !== conversationId);
      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATION_INDEX, JSON.stringify(updatedIndex));
    } catch (error) {
      console.error('Failed to remove from conversation index:', error);
    }
  }

  // Apply filters to conversations
  private static applyFilters(
    conversations: Conversation[], 
    filters: ConversationSearchFilters
  ): Conversation[] {
    return conversations.filter(conversation => {
      // Text search
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const titleMatch = conversation.title.toLowerCase().includes(query);
        const contentMatch = conversation.messages.some(msg => 
          msg.content.toLowerCase().includes(query)
        );
        const tagMatch = conversation.tags?.some(tag => 
          tag.toLowerCase().includes(query)
        );
        
        if (!titleMatch && !contentMatch && !tagMatch) {
          return false;
        }
      }

      // Archive filter
      if (filters.isArchived !== undefined && conversation.isArchived !== filters.isArchived) {
        return false;
      }

      // Starred filter
      if (filters.isStarred !== undefined && conversation.isStarred !== filters.isStarred) {
        return false;
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => 
          conversation.tags?.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange) {
        const { start, end } = filters.dateRange;
        if (conversation.createdAt < start || conversation.createdAt > end) {
          return false;
        }
      }

      // Message count filter
      if (filters.messageCountRange) {
        const { min, max } = filters.messageCountRange;
        const messageCount = conversation.messages.length;
        if (messageCount < min || messageCount > max) {
          return false;
        }
      }

      return true;
    });
  }

  // Apply sorting to conversations
  private static applySorting(
    conversations: Conversation[], 
    filters: ConversationSearchFilters
  ): Conversation[] {
    const { sortBy = 'lastActivity', sortOrder = 'desc' } = filters;

    return [...conversations].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'lastActivity':
          comparison = a.lastActivity.getTime() - b.lastActivity.getTime();
          break;
        case 'messageCount':
          comparison = a.messages.length - b.messages.length;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = a.lastActivity.getTime() - b.lastActivity.getTime();
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  // Export conversations to backup
  static async exportConversations(): Promise<ConversationBackup> {
    try {
      const conversations = await this.getConversations();
      const storageConversations = conversations.map(conv => this.toStorageFormat(conv));

      // Get settings (you may need to implement settings storage)
      const settings = {}; // TODO: Load from settings storage

      const backup: ConversationBackup = {
        version: STORAGE_VERSION,
        exportDate: new Date().toISOString(),
        conversations: storageConversations,
        settings: settings as any,
        metadata: {
          totalConversations: conversations.length,
          totalMessages: conversations.reduce((total, conv) => total + conv.messages.length, 0),
          backupSize: JSON.stringify(storageConversations).length,
          appVersion: '1.0.0', // TODO: Get from app config
        },
      };

      return backup;
    } catch (error) {
      console.error('Failed to export conversations:', error);
      throw new Error('Failed to export conversations');
    }
  }

  // Import conversations from backup
  static async importConversations(backup: ConversationBackup): Promise<void> {
    try {
      // Validate backup
      if (!backup.conversations || !Array.isArray(backup.conversations)) {
        throw new Error('Invalid backup format');
      }

      // Import conversations
      for (const storageConversation of backup.conversations) {
        const conversation = this.fromStorageFormat(storageConversation);
        await this.saveConversation(conversation);
      }

      console.log(`Imported ${backup.conversations.length} conversations`);
    } catch (error) {
      console.error('Failed to import conversations:', error);
      throw new Error('Failed to import conversations');
    }
  }

  // Clear all conversations
  static async clearAllConversations(): Promise<void> {
    try {
      const index = await this.getConversationIndex();

      // Delete all conversation data
      for (const id of index) {
        await this.deleteConversation(id);
      }

      // Clear index
      await AsyncStorage.removeItem(STORAGE_KEYS.CONVERSATION_INDEX);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_CONVERSATION_ID);
    } catch (error) {
      console.error('Failed to clear conversations:', error);
      throw new Error('Failed to clear conversations');
    }
  }

  // Get storage statistics
  static async getStorageStatistics(): Promise<{
    conversationCount: number;
    totalMessages: number;
    totalSize: number;
    audioFileCount: number;
    oldestConversation?: Date;
    newestConversation?: Date;
  }> {
    try {
      const conversations = await this.getConversations();
      
      let totalSize = 0;
      let audioFileCount = 0;
      let oldestDate: Date | undefined;
      let newestDate: Date | undefined;

      for (const conversation of conversations) {
        // Calculate approximate size
        totalSize += JSON.stringify(this.toStorageFormat(conversation)).length;
        
        // Count audio files
        audioFileCount += conversation.messages.filter(msg => msg.audioUrl).length;
        
        // Track date ranges
        if (!oldestDate || conversation.createdAt < oldestDate) {
          oldestDate = conversation.createdAt;
        }
        if (!newestDate || conversation.createdAt > newestDate) {
          newestDate = conversation.createdAt;
        }
      }

      return {
        conversationCount: conversations.length,
        totalMessages: conversations.reduce((total, conv) => total + conv.messages.length, 0),
        totalSize,
        audioFileCount,
        oldestConversation: oldestDate,
        newestConversation: newestDate,
      };
    } catch (error) {
      console.error('Failed to get storage statistics:', error);
      return {
        conversationCount: 0,
        totalMessages: 0,
        totalSize: 0,
        audioFileCount: 0,
      };
    }
  }
}