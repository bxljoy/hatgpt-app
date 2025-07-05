import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppSettings } from '@/types';
import { SettingsStorageService } from '@/services/settingsStorage';
import { RootStackParamList } from '@/navigation/AppNavigator';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedSettings = await SettingsStorageService.loadSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Refresh settings
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettings();
    setRefreshing(false);
  }, [loadSettings]);

  // Settings sections
  const settingsSections: SettingsSection[] = [
    {
      id: 'api',
      title: 'API Settings',
      description: 'OpenAI API configuration and model settings',
      icon: '🔗',
      color: '#007AFF',
      onPress: () => navigation.navigate('APISettings' as any),
    },
    {
      id: 'voice',
      title: 'Voice Settings',
      description: 'Voice type, speed, and audio preferences',
      icon: '🎙️',
      color: '#34C759',
      onPress: () => navigation.navigate('VoiceSettings' as any),
    },
    {
      id: 'audio',
      title: 'Audio & Recording',
      description: 'Audio quality, recording, and playback settings',
      icon: '🔊',
      color: '#FF9500',
      onPress: () => navigation.navigate('AudioSettings' as any),
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Theme, colors, fonts, and display options',
      icon: '🎨',
      color: '#AF52DE',
      onPress: () => navigation.navigate('AppearanceSettings' as any),
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      description: 'Data collection, analytics, and security settings',
      icon: '🔒',
      color: '#FF3B30',
      onPress: () => navigation.navigate('PrivacySettings' as any),
    },
    {
      id: 'backup',
      title: 'Backup & Export',
      description: 'Data backup, export, and sync settings',
      icon: '💾',
      color: '#5AC8FA',
      onPress: () => navigation.navigate('BackupSettings' as any),
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      description: 'Voice over, contrast, and accessibility options',
      icon: '♿',
      color: '#FFCC02',
      onPress: () => navigation.navigate('AccessibilitySettings' as any),
    },
    {
      id: 'about',
      title: 'About',
      description: 'App information, version, and support',
      icon: 'ℹ️',
      color: '#8E8E93',
      onPress: () => navigation.navigate('AboutScreen' as any),
    },
  ];

  // Render settings section
  const renderSettingsSection = (section: SettingsSection) => (
    <TouchableOpacity
      key={section.id}
      style={styles.sectionItem}
      onPress={section.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.sectionIcon, { backgroundColor: section.color }]}>
        <Text style={styles.sectionIconText}>{section.icon}</Text>
      </View>
      
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionDescription}>{section.description}</Text>
      </View>
      
      <View style={styles.sectionArrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );

  // Render quick settings overview
  const renderQuickSettings = () => {
    if (!settings) return null;

    return (
      <View style={styles.quickSettingsContainer}>
        <Text style={styles.quickSettingsTitle}>Quick Settings</Text>
        
        <View style={styles.quickSettingsGrid}>
          <View style={styles.quickSettingItem}>
            <Text style={styles.quickSettingLabel}>Model</Text>
            <Text style={styles.quickSettingValue}>{settings.model}</Text>
          </View>
          
          <View style={styles.quickSettingItem}>
            <Text style={styles.quickSettingLabel}>Voice</Text>
            <Text style={styles.quickSettingValue}>{settings.voiceType}</Text>
          </View>
          
          <View style={styles.quickSettingItem}>
            <Text style={styles.quickSettingLabel}>Theme</Text>
            <Text style={styles.quickSettingValue}>{settings.theme}</Text>
          </View>
          
          <View style={styles.quickSettingItem}>
            <Text style={styles.quickSettingLabel}>Quality</Text>
            <Text style={styles.quickSettingValue}>{settings.audioQuality}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Check if API key is configured
  const renderApiKeyStatus = () => {
    if (!settings) return null;

    const hasApiKey = settings.openaiApiKey && settings.openaiApiKey.length > 0;
    
    return (
      <View style={[styles.statusContainer, hasApiKey ? styles.statusSuccess : styles.statusWarning]}>
        <Text style={styles.statusIcon}>{hasApiKey ? '✅' : '⚠️'}</Text>
        <View style={styles.statusContent}>
          <Text style={styles.statusTitle}>
            {hasApiKey ? 'API Key Configured' : 'API Key Required'}
          </Text>
          <Text style={styles.statusDescription}>
            {hasApiKey 
              ? 'Your OpenAI API key is securely stored and ready to use'
              : 'Configure your OpenAI API key to start chatting'
            }
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Configure your app preferences</Text>
        </View>

        {/* API Key Status */}
        {renderApiKeyStatus()}

        {/* Quick Settings */}
        {renderQuickSettings()}

        {/* Settings Sections */}
        <View style={styles.sectionsContainer}>
          <Text style={styles.sectionsTitle}>All Settings</Text>
          
          {settingsSections.map(renderSettingsSection)}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              Alert.alert(
                'Reset Settings',
                'This will reset all settings to their default values. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await SettingsStorageService.resetSettings();
                        await loadSettings();
                        Alert.alert('Success', 'Settings have been reset to defaults');
                      } catch (error) {
                        Alert.alert('Error', 'Failed to reset settings');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.resetButtonText}>Reset All Settings</Text>
          </TouchableOpacity>
          
          <Text style={styles.footerText}>HatGPT v1.0.0</Text>
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
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: '#E8F5E8',
    borderColor: '#34C759',
  },
  statusWarning: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9500',
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 14,
    color: '#666666',
  },
  quickSettingsContainer: {
    margin: 20,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  quickSettingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  quickSettingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickSettingItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  quickSettingLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  quickSettingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textTransform: 'capitalize',
  },
  sectionsContainer: {
    margin: 20,
    marginTop: 0,
  },
  sectionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 1,
    borderRadius: 0,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionIconText: {
    fontSize: 20,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
  },
  sectionArrow: {
    marginLeft: 8,
  },
  arrowText: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '300',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  resetButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    marginBottom: 16,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});