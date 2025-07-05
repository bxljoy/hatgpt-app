import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppSettings } from '@/types';
import { SettingsStorageService } from '@/services/settingsStorage';

export function AppearanceSettingsScreen() {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save setting
  const saveSetting = useCallback(async (key: keyof AppSettings, value: any) => {
    try {
      setIsSaving(true);
      await SettingsStorageService.updateSetting(key, value);
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
      Alert.alert('Error', `Failed to save ${key}`);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Theme options
  const themeOptions = [
    { value: 'light', label: 'Light', description: 'Always use light theme' },
    { value: 'dark', label: 'Dark', description: 'Always use dark theme' },
    { value: 'system', label: 'System', description: 'Follow device setting' },
  ];

  // Color scheme options
  const colorOptions = [
    { value: 'blue', label: 'Blue', color: '#007AFF' },
    { value: 'green', label: 'Green', color: '#34C759' },
    { value: 'purple', label: 'Purple', color: '#AF52DE' },
    { value: 'orange', label: 'Orange', color: '#FF9500' },
    { value: 'red', label: 'Red', color: '#FF3B30' },
  ];

  // Font size options
  const fontSizeOptions = [
    { value: 'small', label: 'Small', description: 'Compact text size' },
    { value: 'medium', label: 'Medium', description: 'Standard text size' },
    { value: 'large', label: 'Large', description: 'Larger text size' },
    { value: 'extra-large', label: 'Extra Large', description: 'Maximum text size' },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>Appearance</Text>
        </View>

        {/* Theme Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <Text style={styles.sectionDescription}>
            Choose your preferred app theme
          </Text>
          
          {themeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                settings?.theme === option.value && styles.optionItemActive,
              ]}
              onPress={() => saveSetting('theme', option.value)}
              disabled={isSaving}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionTitle,
                  settings?.theme === option.value && styles.optionTitleActive,
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.optionDescription,
                  settings?.theme === option.value && styles.optionDescriptionActive,
                ]}>
                  {option.description}
                </Text>
              </View>
              {settings?.theme === option.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Color Scheme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color Scheme</Text>
          <Text style={styles.sectionDescription}>
            Choose your accent color
          </Text>
          
          <View style={styles.colorGrid}>
            {colorOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.colorOption,
                  { backgroundColor: option.color },
                  settings?.colorScheme === option.value && styles.colorOptionActive,
                ]}
                onPress={() => saveSetting('colorScheme', option.value)}
                disabled={isSaving}
              >
                {settings?.colorScheme === option.value && (
                  <Text style={styles.colorCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.colorLabels}>
            {colorOptions.map((option) => (
              <Text
                key={`${option.value}-label`}
                style={[
                  styles.colorLabel,
                  settings?.colorScheme === option.value && styles.colorLabelActive,
                ]}
              >
                {option.label}
              </Text>
            ))}
          </View>
        </View>

        {/* Font Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Font Size</Text>
          <Text style={styles.sectionDescription}>
            Adjust text size for better readability
          </Text>
          
          {fontSizeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                settings?.fontSize === option.value && styles.optionItemActive,
              ]}
              onPress={() => saveSetting('fontSize', option.value)}
              disabled={isSaving}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionTitle,
                  settings?.fontSize === option.value && styles.optionTitleActive,
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.optionDescription,
                  settings?.fontSize === option.value && styles.optionDescriptionActive,
                ]}>
                  {option.description}
                </Text>
              </View>
              {settings?.fontSize === option.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Display Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Options</Text>
          
          <View style={styles.switchItem}>
            <View style={styles.switchContent}>
              <Text style={styles.switchTitle}>Compact Mode</Text>
              <Text style={styles.switchDescription}>
                Reduce spacing and padding for more content
              </Text>
            </View>
            <Switch
              value={settings?.compactMode || false}
              onValueChange={(value) => saveSetting('compactMode', value)}
              disabled={isSaving}
              trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
              thumbColor="#FFFFFF"
            />
          </View>
          
          <View style={styles.switchItem}>
            <View style={styles.switchContent}>
              <Text style={styles.switchTitle}>Show Timestamps</Text>
              <Text style={styles.switchDescription}>
                Display message timestamps in conversations
              </Text>
            </View>
            <Switch
              value={settings?.showTimestamps || false}
              onValueChange={(value) => saveSetting('showTimestamps', value)}
              disabled={isSaving}
              trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
              thumbColor="#FFFFFF"
            />
          </View>
          
          <View style={styles.switchItem}>
            <View style={styles.switchContent}>
              <Text style={styles.switchTitle}>Animations</Text>
              <Text style={styles.switchDescription}>
                Enable smooth animations and transitions
              </Text>
            </View>
            <Switch
              value={settings?.animationsEnabled || false}
              onValueChange={(value) => saveSetting('animationsEnabled', value)}
              disabled={isSaving}
              trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewContainer}>
            <View style={styles.previewMessage}>
              <Text style={styles.previewText}>
                This is how your messages will look with the current settings.
              </Text>
              {settings?.showTimestamps && (
                <Text style={styles.previewTimestamp}>
                  {new Date().toLocaleTimeString()}
                </Text>
              )}
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
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
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  optionItemActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  optionTitleActive: {
    color: '#007AFF',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666666',
  },
  optionDescriptionActive: {
    color: '#0066CC',
  },
  checkmark: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#000000',
  },
  colorCheckmark: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  colorLabels: {
    flexDirection: 'row',
    gap: 16,
  },
  colorLabel: {
    fontSize: 12,
    color: '#666666',
    width: 50,
    textAlign: 'center',
  },
  colorLabelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 14,
    color: '#666666',
  },
  previewContainer: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  previewMessage: {
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  previewText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  previewTimestamp: {
    fontSize: 12,
    color: '#E0E0E0',
    marginTop: 4,
    textAlign: 'right',
  },
});