import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppSettings } from '@/types';
import { SettingsStorageService } from '@/services/settingsStorage';

interface SettingItem {
  key: keyof AppSettings;
  title: string;
  description: string;
  type: 'text' | 'number' | 'select' | 'slider' | 'boolean';
  options?: Array<{ label: string; value: any }>;
  min?: number;
  max?: number;
  step?: number;
  secure?: boolean;
  placeholder?: string;
  validation?: (value: any) => string | null;
}

export function APISettingsScreen() {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedSettings = await SettingsStorageService.loadSettings();
      setSettings(loadedSettings);
      setTempApiKey(loadedSettings.openaiApiKey);
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

  // Test API key
  const testApiKey = useCallback(async () => {
    if (!tempApiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    if (!SettingsStorageService.validateApiKey(tempApiKey)) {
      Alert.alert('Error', 'Invalid API key format. OpenAI API keys should start with "sk-" and be 51 characters long.');
      return;
    }

    try {
      setIsSaving(true);
      
      // Test the API key with a simple request
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${tempApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await saveSetting('openaiApiKey', tempApiKey);
        Alert.alert('Success', 'API key is valid and has been saved securely');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', `API key validation failed: ${errorData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to test API key:', error);
      Alert.alert('Error', 'Failed to test API key. Please check your internet connection.');
    } finally {
      setIsSaving(false);
    }
  }, [tempApiKey, saveSetting]);

  // API Settings configuration
  const apiSettings: SettingItem[] = [
    {
      key: 'maxTokens',
      title: 'Max Tokens',
      description: 'Maximum number of tokens for AI responses (1-4000)',
      type: 'number',
      min: 1,
      max: 4000,
      validation: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 4000) {
          return 'Must be a number between 1 and 4000';
        }
        return null;
      },
    },
    {
      key: 'temperature',
      title: 'Temperature',
      description: 'Creativity level (0.0 = focused, 2.0 = creative)',
      type: 'slider',
      min: 0,
      max: 2,
      step: 0.1,
    },
    {
      key: 'apiTimeout',
      title: 'API Timeout (seconds)',
      description: 'Request timeout in seconds (5-120)',
      type: 'number',
      min: 5,
      max: 120,
      validation: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 5 || num > 120) {
          return 'Must be a number between 5 and 120';
        }
        return null;
      },
    },
  ];

  // Render API key section
  const renderApiKeySection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>API Key</Text>
      <Text style={styles.sectionDescription}>
        Your OpenAI API key is stored securely on your device and never shared.
      </Text>
      
      <View style={styles.apiKeyContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.apiKeyInput}
            value={tempApiKey}
            onChangeText={setTempApiKey}
            placeholder="sk-..."
            secureTextEntry={!apiKeyVisible}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSaving}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setApiKeyVisible(!apiKeyVisible)}
          >
            <Text style={styles.eyeButtonText}>{apiKeyVisible ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.testButton, isSaving && styles.testButtonDisabled]}
          onPress={testApiKey}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.testButtonText}>Test & Save</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <Text style={styles.helpText}>
        Get your API key from{' '}
        <Text style={styles.linkText}>platform.openai.com/api-keys</Text>
      </Text>
    </View>
  );

  // Render setting item
  const renderSetting = (setting: SettingItem) => {
    if (!settings) return null;

    const value = settings[setting.key];

    return (
      <View key={setting.key} style={styles.settingItem}>
        <View style={styles.settingHeader}>
          <Text style={styles.settingTitle}>{setting.title}</Text>
          <Text style={styles.settingDescription}>{setting.description}</Text>
        </View>

        {setting.type === 'select' && (
          <View style={styles.selectContainer}>
            {setting.options?.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.selectOption,
                  value === option.value && styles.selectOptionActive,
                ]}
                onPress={() => saveSetting(setting.key, option.value)}
                disabled={isSaving}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    value === option.value && styles.selectOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {setting.type === 'number' && (
          <View style={styles.numberContainer}>
            <TextInput
              style={styles.numberInput}
              value={value?.toString() || ''}
              onChangeText={(text) => {
                const numValue = setting.key === 'apiTimeout' ? parseInt(text) * 1000 : parseInt(text);
                if (!isNaN(numValue)) {
                  saveSetting(setting.key, numValue);
                }
              }}
              keyboardType="numeric"
              editable={!isSaving}
            />
            <Text style={styles.numberUnit}>
              {setting.key === 'apiTimeout' ? 'seconds' : 'tokens'}
            </Text>
          </View>
        )}

        {setting.type === 'slider' && (
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>
              {(value as number)?.toFixed(1)}
            </Text>
            <View style={styles.sliderTrack}>
              <View
                style={[
                  styles.sliderFill,
                  {
                    width: `${((value as number - (setting.min || 0)) / ((setting.max || 1) - (setting.min || 0))) * 100}%`,
                  },
                ]}
              />
              <TouchableOpacity
                style={[
                  styles.sliderThumb,
                  {
                    left: `${((value as number - (setting.min || 0)) / ((setting.max || 1) - (setting.min || 0))) * 100}%`,
                  },
                ]}
                disabled={isSaving}
              />
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>{setting.min}</Text>
              <Text style={styles.sliderLabel}>{setting.max}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Render system prompt section
  const renderSystemPromptSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>System Prompt</Text>
      <Text style={styles.sectionDescription}>
        Custom instructions for the AI assistant (optional)
      </Text>
      
      <TextInput
        style={styles.systemPromptInput}
        value={settings?.systemPrompt || ''}
        onChangeText={(text) => saveSetting('systemPrompt', text)}
        placeholder="Enter custom system prompt..."
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!isSaving}
      />
      
      <Text style={styles.helpText}>
        Leave empty to use the default system prompt optimized for voice conversations.
      </Text>
    </View>
  );

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
          <Text style={styles.headerTitle}>API Settings</Text>
        </View>

        {/* API Key Section */}
        {renderApiKeySection()}

        {/* Model Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Model</Text>
          <View style={styles.modelInfo}>
            <Text style={styles.modelName}>GPT-4o</Text>
            <Text style={styles.modelDescription}>
              OpenAI's most advanced multimodal model with excellent performance across text and voice interactions.
            </Text>
          </View>
        </View>

        {/* Model Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Configuration</Text>
          {apiSettings.map(renderSetting)}
        </View>

        {/* System Prompt */}
        {renderSystemPromptSection()}

        {/* Usage Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage Information</Text>
          <Text style={styles.infoText}>
            • Higher token limits allow longer responses but cost more{'\n'}
            • Higher temperature makes responses more creative but less focused{'\n'}
            • GPT-4o is OpenAI's most advanced model with great speed and accuracy{'\n'}
            • API usage is billed directly by OpenAI
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
  apiKeyContainer: {
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    marginBottom: 12,
  },
  apiKeyInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
  },
  eyeButton: {
    padding: 12,
  },
  eyeButtonText: {
    fontSize: 16,
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
  },
  linkText: {
    color: '#007AFF',
  },
  settingItem: {
    marginBottom: 24,
  },
  settingHeader: {
    marginBottom: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
  },
  selectContainer: {
    gap: 8,
  },
  selectOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  selectOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#000000',
  },
  selectOptionTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#000000',
    minWidth: 80,
  },
  numberUnit: {
    fontSize: 14,
    color: '#666666',
  },
  sliderContainer: {
    paddingVertical: 8,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    marginLeft: -10,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  systemPromptInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    minHeight: 100,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  modelInfo: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modelName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  modelDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});