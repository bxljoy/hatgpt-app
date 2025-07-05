import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Conversation, ConversationBackup } from '@/types';
import { ConversationStorageService } from './conversationStorage';

export interface ExportOptions {
  format: 'json' | 'txt' | 'csv' | 'markdown';
  includeAudio?: boolean;
  includeMetadata?: boolean;
  includeTags?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ShareOptions {
  format: 'json' | 'txt' | 'csv' | 'markdown';
  conversations?: Conversation[];
  includeAudio?: boolean;
  title?: string;
}

export class ConversationExportService {
  // Export single conversation to different formats
  static async exportConversation(
    conversation: Conversation,
    options: ExportOptions
  ): Promise<string> {
    const { format, includeMetadata = true, includeTags = true } = options;

    switch (format) {
      case 'json':
        return this.exportToJSON([conversation], includeMetadata);
      case 'txt':
        return this.exportToText([conversation], includeMetadata);
      case 'csv':
        return this.exportToCSV([conversation], includeMetadata);
      case 'markdown':
        return this.exportToMarkdown([conversation], includeMetadata, includeTags);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Export multiple conversations
  static async exportConversations(
    conversations: Conversation[],
    options: ExportOptions
  ): Promise<string> {
    const { format, includeMetadata = true, includeTags = true } = options;

    // Filter by date range if specified
    let filteredConversations = conversations;
    if (options.dateRange) {
      const { start, end } = options.dateRange;
      filteredConversations = conversations.filter(conv => 
        conv.createdAt >= start && conv.createdAt <= end
      );
    }

    switch (format) {
      case 'json':
        return this.exportToJSON(filteredConversations, includeMetadata);
      case 'txt':
        return this.exportToText(filteredConversations, includeMetadata);
      case 'csv':
        return this.exportToCSV(filteredConversations, includeMetadata);
      case 'markdown':
        return this.exportToMarkdown(filteredConversations, includeMetadata, includeTags);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Export to JSON format
  private static exportToJSON(conversations: Conversation[], includeMetadata: boolean): string {
    const data = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      lastActivity: conv.lastActivity.toISOString(),
      messageCount: conv.messages.length,
      ...(includeMetadata && {
        tags: conv.tags,
        isStarred: conv.isStarred,
        isArchived: conv.isArchived,
        statistics: conv.statistics,
        summary: conv.summary,
      }),
      messages: conv.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        ...(includeMetadata && {
          metadata: msg.metadata,
          tokenCount: msg.tokenCount,
        }),
      })),
    }));

    return JSON.stringify({
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      conversationCount: conversations.length,
      conversations: data,
    }, null, 2);
  }

  // Export to plain text format
  private static exportToText(conversations: Conversation[], includeMetadata: boolean): string {
    let output = '';
    
    output += `Conversation Export - ${new Date().toLocaleDateString()}\n`;
    output += `Total Conversations: ${conversations.length}\n\n`;
    output += '=' .repeat(60) + '\n\n';

    conversations.forEach((conv, index) => {
      output += `CONVERSATION ${index + 1}: ${conv.title}\n`;
      output += `Created: ${conv.createdAt.toLocaleDateString()}\n`;
      output += `Messages: ${conv.messages.length}\n`;
      
      if (includeMetadata) {
        if (conv.tags && conv.tags.length > 0) {
          output += `Tags: ${conv.tags.join(', ')}\n`;
        }
        if (conv.summary) {
          output += `Summary: ${conv.summary}\n`;
        }
      }
      
      output += '\n' + '-'.repeat(40) + '\n\n';

      conv.messages.forEach((msg, msgIndex) => {
        const timestamp = msg.timestamp.toLocaleString();
        const role = msg.role.toUpperCase();
        
        output += `[${timestamp}] ${role}:\n`;
        output += `${msg.content}\n\n`;
        
        if (includeMetadata && msg.metadata) {
          if (msg.metadata.inputType) {
            output += `  Input Type: ${msg.metadata.inputType}\n`;
          }
          if (msg.metadata.model) {
            output += `  Model: ${msg.metadata.model}\n`;
          }
          if (msg.tokenCount) {
            output += `  Tokens: ${msg.tokenCount}\n`;
          }
          output += '\n';
        }
      });

      output += '\n' + '='.repeat(60) + '\n\n';
    });

    return output;
  }

  // Export to CSV format
  private static exportToCSV(conversations: Conversation[], includeMetadata: boolean): string {
    const headers = [
      'Conversation ID',
      'Conversation Title',
      'Created Date',
      'Message Index',
      'Message ID',
      'Role',
      'Content',
      'Timestamp',
    ];

    if (includeMetadata) {
      headers.push(
        'Input Type',
        'Model',
        'Token Count',
        'Processing Time',
        'Voice',
        'Tags'
      );
    }

    let csv = headers.join(',') + '\n';

    conversations.forEach(conv => {
      conv.messages.forEach((msg, msgIndex) => {
        const row = [
          this.escapeCsvValue(conv.id),
          this.escapeCsvValue(conv.title),
          this.escapeCsvValue(conv.createdAt.toISOString()),
          msgIndex + 1,
          this.escapeCsvValue(msg.id),
          this.escapeCsvValue(msg.role),
          this.escapeCsvValue(msg.content),
          this.escapeCsvValue(msg.timestamp.toISOString()),
        ];

        if (includeMetadata) {
          row.push(
            this.escapeCsvValue(msg.metadata?.inputType || ''),
            this.escapeCsvValue(msg.metadata?.model || ''),
            msg.tokenCount || '',
            msg.metadata?.processingTime || '',
            this.escapeCsvValue(msg.metadata?.audioSettings?.voice || ''),
            this.escapeCsvValue(conv.tags?.join('; ') || '')
          );
        }

        csv += row.join(',') + '\n';
      });
    });

    return csv;
  }

  // Export to Markdown format
  private static exportToMarkdown(
    conversations: Conversation[], 
    includeMetadata: boolean, 
    includeTags: boolean
  ): string {
    let markdown = '';
    
    markdown += `# Conversation Export\n\n`;
    markdown += `**Export Date:** ${new Date().toLocaleDateString()}\n`;
    markdown += `**Total Conversations:** ${conversations.length}\n\n`;
    markdown += `---\n\n`;

    conversations.forEach((conv, index) => {
      markdown += `## ${index + 1}. ${conv.title}\n\n`;
      
      markdown += `**Created:** ${conv.createdAt.toLocaleDateString()}\n`;
      markdown += `**Last Activity:** ${conv.lastActivity.toLocaleDateString()}\n`;
      markdown += `**Messages:** ${conv.messages.length}\n`;
      
      if (includeMetadata && includeTags && conv.tags && conv.tags.length > 0) {
        markdown += `**Tags:** ${conv.tags.map(tag => `\`${tag}\``).join(', ')}\n`;
      }
      
      if (includeMetadata && conv.summary) {
        markdown += `**Summary:** ${conv.summary}\n`;
      }
      
      markdown += '\n';

      conv.messages.forEach((msg, msgIndex) => {
        const timestamp = msg.timestamp.toLocaleString();
        const role = msg.role === 'user' ? '👤 **User**' : '🤖 **Assistant**';
        
        markdown += `### ${role}\n`;
        markdown += `*${timestamp}*\n\n`;
        markdown += `${msg.content}\n\n`;
        
        if (includeMetadata && msg.metadata) {
          const metadata = [];
          if (msg.metadata.inputType) {
            metadata.push(`Input: ${msg.metadata.inputType}`);
          }
          if (msg.metadata.model) {
            metadata.push(`Model: ${msg.metadata.model}`);
          }
          if (msg.tokenCount) {
            metadata.push(`Tokens: ${msg.tokenCount}`);
          }
          if (msg.metadata.audioSettings?.voice) {
            metadata.push(`Voice: ${msg.metadata.audioSettings.voice}`);
          }
          
          if (metadata.length > 0) {
            markdown += `*${metadata.join(' • ')}*\n\n`;
          }
        }
      });

      markdown += `---\n\n`;
    });

    return markdown;
  }

  // Helper to escape CSV values
  private static escapeCsvValue(value: string | number): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  // Share conversation via platform sharing
  static async shareConversation(
    conversation: Conversation,
    options: ShareOptions
  ): Promise<void> {
    try {
      const content = await this.exportConversation(conversation, {
        format: options.format,
        includeMetadata: true,
        includeTags: true,
      });

      const filename = this.generateFilename(conversation.title, options.format);
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: this.getMimeType(options.format),
          dialogTitle: options.title || `Share ${conversation.title}`,
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }

      // Clean up temporary file
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Failed to share conversation:', error);
      throw new Error('Failed to share conversation');
    }
  }

  // Share multiple conversations
  static async shareConversations(
    conversations: Conversation[],
    options: ShareOptions
  ): Promise<void> {
    try {
      const content = await this.exportConversations(conversations, {
        format: options.format,
        includeMetadata: true,
        includeTags: true,
      });

      const filename = this.generateFilename(
        `${conversations.length}-conversations`, 
        options.format
      );
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: this.getMimeType(options.format),
          dialogTitle: options.title || `Share ${conversations.length} Conversations`,
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }

      // Clean up temporary file
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Failed to share conversations:', error);
      throw new Error('Failed to share conversations');
    }
  }

  // Export full backup
  static async exportBackup(): Promise<void> {
    try {
      const backup = await ConversationStorageService.exportConversations();
      const content = JSON.stringify(backup, null, 2);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `hatgpt-backup-${timestamp}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Conversation Backup',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }

      // Clean up temporary file
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Failed to export backup:', error);
      throw new Error('Failed to export backup');
    }
  }

  // Import backup from file
  static async importBackup(fileUri: string): Promise<void> {
    try {
      const content = await FileSystem.readAsStringAsync(fileUri);
      const backup: ConversationBackup = JSON.parse(content);
      
      await ConversationStorageService.importConversations(backup);
    } catch (error) {
      console.error('Failed to import backup:', error);
      throw new Error('Failed to import backup');
    }
  }

  // Generate appropriate filename
  private static generateFilename(title: string, format: string): string {
    const sanitizedTitle = title
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    
    const timestamp = new Date().toISOString().split('T')[0];
    return `${sanitizedTitle}-${timestamp}.${format}`;
  }

  // Get MIME type for format
  private static getMimeType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'txt':
        return 'text/plain';
      case 'csv':
        return 'text/csv';
      case 'markdown':
        return 'text/markdown';
      default:
        return 'text/plain';
    }
  }

  // Get file extension for format
  static getFileExtension(format: string): string {
    switch (format) {
      case 'json':
        return 'json';
      case 'txt':
        return 'txt';
      case 'csv':
        return 'csv';
      case 'markdown':
        return 'md';
      default:
        return 'txt';
    }
  }

  // Get available export formats
  static getAvailableFormats(): Array<{ key: string; label: string; description: string }> {
    return [
      {
        key: 'json',
        label: 'JSON',
        description: 'Structured data format with full metadata',
      },
      {
        key: 'txt',
        label: 'Text',
        description: 'Plain text format for easy reading',
      },
      {
        key: 'csv',
        label: 'CSV',
        description: 'Spreadsheet format for data analysis',
      },
      {
        key: 'markdown',
        label: 'Markdown',
        description: 'Formatted text with rich formatting',
      },
    ];
  }
}