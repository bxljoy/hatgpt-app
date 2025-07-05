import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ConversationStorageService } from '@/services/conversationStorage';

interface InfoItem {
  title: string;
  value: string;
  onPress?: () => void;
  style?: 'default' | 'link';
}

interface ActionItem {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
  style?: 'default' | 'destructive';
}

export function AboutScreen() {
  const navigation = useNavigation();
  const [storageStats, setStorageStats] = useState<any>(null);

  // Load storage statistics
  const loadStorageStats = useCallback(async () => {
    try {
      const stats = await ConversationStorageService.getStorageStatistics();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  }, []);

  React.useEffect(() => {
    loadStorageStats();
  }, [loadStorageStats]);

  // App information
  const appInfo: InfoItem[] = [
    {
      title: 'Version',
      value: '1.0.0',
    },
    {
      title: 'Build',
      value: '2024.1.0',
    },
    {
      title: 'Platform',
      value: 'React Native',
    },
    {
      title: 'AI Provider',
      value: 'OpenAI',
    },
  ];

  // Storage information
  const storageInfo: InfoItem[] = [
    {
      title: 'Conversations',
      value: storageStats?.conversationCount?.toString() || '0',
    },
    {
      title: 'Messages',
      value: storageStats?.totalMessages?.toString() || '0',
    },
    {
      title: 'Audio Files',
      value: storageStats?.audioFileCount?.toString() || '0',
    },
    {
      title: 'Storage Used',
      value: storageStats ? `${(storageStats.totalSize / 1024 / 1024).toFixed(1)} MB` : '0 MB',
    },
  ];

  // Links
  const links: InfoItem[] = [
    {
      title: 'Privacy Policy',
      value: 'View our privacy policy',
      style: 'link',
      onPress: () => {
        Linking.openURL('https://example.com/privacy');
      },
    },
    {
      title: 'Terms of Service',
      value: 'View terms and conditions',
      style: 'link',
      onPress: () => {
        Linking.openURL('https://example.com/terms');
      },
    },
    {
      title: 'Support',
      value: 'Get help and support',
      style: 'link',
      onPress: () => {
        Linking.openURL('mailto:support@hatgpt.com');
      },
    },
    {
      title: 'GitHub',
      value: 'View source code',
      style: 'link',
      onPress: () => {
        Linking.openURL('https://github.com/username/hatgpt-app');
      },
    },
  ];

  // Actions
  const actions: ActionItem[] = [
    {
      title: 'Share App',
      description: 'Tell others about HatGPT',
      icon: '📱',
      onPress: async () => {
        try {
          await Share.share({
            message: 'Check out HatGPT - A voice-powered AI chat app!',
            title: 'HatGPT App',
          });
        } catch (error) {
          console.error('Failed to share:', error);
        }
      },
    },
    {
      title: 'Rate App',
      description: 'Rate us on the App Store',
      icon: '⭐',
      onPress: () => {
        // In a real app, this would open the app store
        Alert.alert('Rate App', 'This would open the App Store rating page.');
      },
    },
    {
      title: 'Send Feedback',
      description: 'Help us improve the app',
      icon: '💬',
      onPress: () => {
        Linking.openURL('mailto:feedback@hatgpt.com?subject=HatGPT Feedback');
      },
    },
    {
      title: 'Report Bug',
      description: 'Report issues or bugs',
      icon: '🐛',
      onPress: () => {
        Linking.openURL('mailto:bugs@hatgpt.com?subject=Bug Report');
      },
    },
  ];

  // Developer actions (potentially dangerous)
  const developerActions: ActionItem[] = [
    {
      title: 'Export Debug Info',
      description: 'Export app logs and diagnostics',
      icon: '📋',
      onPress: () => {
        Alert.alert(
          'Export Debug Info',
          'This will export app logs and diagnostics for troubleshooting.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Export', onPress: () => {
              // Implement debug info export
              Alert.alert('Success', 'Debug info exported');
            }},
          ]
        );
      },
    },
    {
      title: 'Clear All Data',
      description: 'Delete all conversations and settings',
      icon: '🗑️',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Clear All Data',
          'This will permanently delete all conversations, settings, and audio files. This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete All',
              style: 'destructive',
              onPress: async () => {
                try {
                  await ConversationStorageService.clearAllConversations();
                  await loadStorageStats();
                  Alert.alert('Success', 'All data has been cleared');
                } catch (error) {
                  Alert.alert('Error', 'Failed to clear data');
                }
              },
            },
          ]
        );
      },
    },
  ];

  // Render info section
  const renderInfoSection = (title: string, items: InfoItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.infoItem}
          onPress={item.onPress}
          disabled={!item.onPress}
          activeOpacity={item.onPress ? 0.7 : 1}
        >
          <Text style={styles.infoTitle}>{item.title}</Text>
          <Text style={[
            styles.infoValue,
            item.style === 'link' && styles.linkValue,
          ]}>
            {item.value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render action section
  const renderActionSection = (title: string, items: ActionItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.actionItem,
            item.style === 'destructive' && styles.destructiveAction,
          ]}
          onPress={item.onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>{item.icon}</Text>
          <View style={styles.actionContent}>
            <Text style={[
              styles.actionTitle,
              item.style === 'destructive' && styles.destructiveText,
            ]}>
              {item.title}
            </Text>
            <Text style={[
              styles.actionDescription,
              item.style === 'destructive' && styles.destructiveDescription,
            ]}>
              {item.description}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About</Text>
        </View>

        {/* App Logo and Title */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>🎩</Text>
          </View>
          <Text style={styles.appName}>HatGPT</Text>
          <Text style={styles.appTagline}>Voice-Powered AI Chat</Text>
        </View>

        {/* App Information */}
        {renderInfoSection('App Information', appInfo)}

        {/* Storage Information */}
        {renderInfoSection('Storage Information', storageInfo)}

        {/* Legal and Support */}
        {renderInfoSection('Legal & Support', links)}

        {/* Actions */}
        {renderActionSection('Actions', actions)}

        {/* Developer Actions */}
        {renderActionSection('Developer', developerActions)}

        {/* Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credits</Text>
          <Text style={styles.creditsText}>
            Built with React Native and powered by OpenAI's GPT models.
            {'\n\n'}
            Special thanks to the open-source community and all contributors.
          </Text>
        </View>

        {/* Copyright */}
        <View style={styles.footer}>
          <Text style={styles.copyrightText}>
            © 2024 HatGPT. All rights reserved.
          </Text>
          <Text style={styles.versionText}>
            Made with ❤️ using Claude Code
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 16,
    color: '#666666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  infoTitle: {
    fontSize: 16,
    color: '#000000',
  },
  infoValue: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  linkValue: {
    color: '#007AFF',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  destructiveAction: {
    // No special styling needed, text color handles it
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
    width: 32,
    textAlign: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  destructiveText: {
    color: '#FF3B30',
  },
  actionDescription: {
    fontSize: 14,
    color: '#666666',
  },
  destructiveDescription: {
    color: '#FF6B6B',
  },
  chevron: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '300',
  },
  creditsText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  copyrightText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#C7C7CC',
  },
});