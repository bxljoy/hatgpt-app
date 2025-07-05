import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppSettings } from '@/types';

// Storage keys
const SETTINGS_KEY = '@app_settings';
const SECURE_API_KEY = 'openai_api_key';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  // API Settings
  openaiApiKey: '',
  model: 'gpt-4o',
  maxTokens: 1000,
  temperature: 0.7,
  systemPrompt: undefined,
  apiTimeout: 30000,
  
  // Voice Settings
  voiceType: 'alloy',
  speechRate: 1.0,
  voicePitch: 1.0,
  voiceVolume: 1.0,
  autoPlayAudio: true,
  autoStopAudio: true,
  
  // Audio Settings
  audioQuality: 'standard',
  recordingQuality: 'medium',
  saveAudioFiles: true,
  autoDeleteAudio: false,
  audioFileRetentionDays: 30,
  maxRecordingDuration: 300000, // 5 minutes
  backgroundAudioEnabled: false,
  
  // App Appearance
  theme: 'system',
  fontSize: 'medium',
  colorScheme: 'blue',
  compactMode: false,
  showTimestamps: true,
  animationsEnabled: true,
  
  // Interaction Settings
  hapticFeedback: true,
  soundEffects: true,
  confirmDeletions: true,
  autoSaveConversations: true,
  swipeActions: true,
  
  // Privacy Settings
  analytics: true,
  crashReporting: true,
  dataCollection: true,
  biometricLock: false,
  autoLockTimeout: 300000, // 5 minutes
  
  // Backup Settings
  autoBackup: false,
  backupFrequency: 'weekly',
  cloudBackupEnabled: false,
  backupIncludeAudio: false,
  
  // Accessibility
  voiceOverEnabled: false,
  highContrast: false,
  reduceMotion: false,
  largeText: false,
  
  // Developer Settings
  debugMode: false,
  showPerformanceMetrics: false,
  logLevel: 'warn',
};

export class SettingsStorageService {
  // Load all settings
  static async loadSettings(): Promise<AppSettings> {
    try {
      // Load non-secure settings from AsyncStorage
      const settingsData = await AsyncStorage.getItem(SETTINGS_KEY);
      let settings = settingsData ? JSON.parse(settingsData) : {};
      
      // Load secure API key from SecureStore
      const apiKey = await SecureStore.getItemAsync(SECURE_API_KEY);
      if (apiKey) {
        settings.openaiApiKey = apiKey;
      }
      
      // Merge with defaults to ensure all settings exist
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  // Save all settings
  static async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      // Extract API key for secure storage
      const { openaiApiKey, ...nonSecureSettings } = settings;
      
      // Save non-secure settings to AsyncStorage
      const currentSettings = await this.loadSettings();
      const updatedSettings = { ...currentSettings, ...nonSecureSettings };
      
      // Remove API key from settings object before storing
      const { openaiApiKey: _, ...settingsToStore } = updatedSettings;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToStore));
      
      // Save API key to SecureStore if provided
      if (openaiApiKey !== undefined) {
        if (openaiApiKey.trim() === '') {
          await SecureStore.deleteItemAsync(SECURE_API_KEY);
        } else {
          await SecureStore.setItemAsync(SECURE_API_KEY, openaiApiKey);
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  // Update specific setting
  static async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> {
    try {
      const settings = { [key]: value } as Partial<AppSettings>;
      await this.saveSettings(settings);
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
      throw new Error(`Failed to update setting ${key}`);
    }
  }

  // Get specific setting
  static async getSetting<K extends keyof AppSettings>(
    key: K
  ): Promise<AppSettings[K]> {
    try {
      const settings = await this.loadSettings();
      return settings[key];
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return DEFAULT_SETTINGS[key];
    }
  }

  // Reset all settings to defaults
  static async resetSettings(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      await SecureStore.deleteItemAsync(SECURE_API_KEY);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw new Error('Failed to reset settings');
    }
  }

  // Export settings (excluding secure data)
  static async exportSettings(): Promise<Partial<AppSettings>> {
    try {
      const settings = await this.loadSettings();
      // Remove sensitive data from export
      const { openaiApiKey, ...exportableSettings } = settings;
      return exportableSettings;
    } catch (error) {
      console.error('Failed to export settings:', error);
      throw new Error('Failed to export settings');
    }
  }

  // Import settings
  static async importSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      // Remove any sensitive data that shouldn't be imported
      const { openaiApiKey, ...importableSettings } = settings;
      await this.saveSettings(importableSettings);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Failed to import settings');
    }
  }

  // Check if API key is configured
  static async hasApiKey(): Promise<boolean> {
    try {
      const apiKey = await SecureStore.getItemAsync(SECURE_API_KEY);
      return apiKey !== null && apiKey.trim().length > 0;
    } catch (error) {
      console.error('Failed to check API key:', error);
      return false;
    }
  }

  // Validate API key format
  static validateApiKey(apiKey: string): boolean {
    // OpenAI API keys start with 'sk-' and are followed by 48 characters
    const apiKeyRegex = /^sk-[a-zA-Z0-9]{48}$/;
    return apiKeyRegex.test(apiKey.trim());
  }

  // Get theme colors based on color scheme
  static getThemeColors(colorScheme: AppSettings['colorScheme']) {
    const colors = {
      blue: {
        primary: '#007AFF',
        primaryDark: '#0056CC',
        secondary: '#5AC8FA',
        accent: '#E3F2FD',
      },
      green: {
        primary: '#34C759',
        primaryDark: '#248A3D',
        secondary: '#7ED321',
        accent: '#E8F5E8',
      },
      purple: {
        primary: '#AF52DE',
        primaryDark: '#8E44AD',
        secondary: '#BF5AF2',
        accent: '#F3E5F5',
      },
      orange: {
        primary: '#FF9500',
        primaryDark: '#CC7700',
        secondary: '#FFCC02',
        accent: '#FFF3E0',
      },
      red: {
        primary: '#FF3B30',
        primaryDark: '#CC2E24',
        secondary: '#FF6B6B',
        accent: '#FFEBEE',
      },
    };
    
    return colors[colorScheme] || colors.blue;
  }

  // Get font sizes based on fontSize setting
  static getFontSizes(fontSize: AppSettings['fontSize']) {
    const sizes = {
      'small': {
        tiny: 10,
        small: 12,
        medium: 14,
        large: 16,
        xlarge: 18,
        xxlarge: 20,
      },
      'medium': {
        tiny: 12,
        small: 14,
        medium: 16,
        large: 18,
        xlarge: 20,
        xxlarge: 24,
      },
      'large': {
        tiny: 14,
        small: 16,
        medium: 18,
        large: 20,
        xlarge: 24,
        xxlarge: 28,
      },
      'extra-large': {
        tiny: 16,
        small: 18,
        medium: 20,
        large: 24,
        xlarge: 28,
        xxlarge: 32,
      },
    };
    
    return sizes[fontSize] || sizes.medium;
  }

  // Get default settings for specific category
  static getDefaultSettingsForCategory(category: string): Partial<AppSettings> {
    switch (category) {
      case 'api':
        return {
          model: DEFAULT_SETTINGS.model,
          maxTokens: DEFAULT_SETTINGS.maxTokens,
          temperature: DEFAULT_SETTINGS.temperature,
          apiTimeout: DEFAULT_SETTINGS.apiTimeout,
        };
      case 'voice':
        return {
          voiceType: DEFAULT_SETTINGS.voiceType,
          speechRate: DEFAULT_SETTINGS.speechRate,
          voicePitch: DEFAULT_SETTINGS.voicePitch,
          voiceVolume: DEFAULT_SETTINGS.voiceVolume,
          autoPlayAudio: DEFAULT_SETTINGS.autoPlayAudio,
          autoStopAudio: DEFAULT_SETTINGS.autoStopAudio,
        };
      case 'audio':
        return {
          audioQuality: DEFAULT_SETTINGS.audioQuality,
          recordingQuality: DEFAULT_SETTINGS.recordingQuality,
          saveAudioFiles: DEFAULT_SETTINGS.saveAudioFiles,
          autoDeleteAudio: DEFAULT_SETTINGS.autoDeleteAudio,
          audioFileRetentionDays: DEFAULT_SETTINGS.audioFileRetentionDays,
          maxRecordingDuration: DEFAULT_SETTINGS.maxRecordingDuration,
          backgroundAudioEnabled: DEFAULT_SETTINGS.backgroundAudioEnabled,
        };
      case 'appearance':
        return {
          theme: DEFAULT_SETTINGS.theme,
          fontSize: DEFAULT_SETTINGS.fontSize,
          colorScheme: DEFAULT_SETTINGS.colorScheme,
          compactMode: DEFAULT_SETTINGS.compactMode,
          showTimestamps: DEFAULT_SETTINGS.showTimestamps,
          animationsEnabled: DEFAULT_SETTINGS.animationsEnabled,
        };
      case 'privacy':
        return {
          analytics: DEFAULT_SETTINGS.analytics,
          crashReporting: DEFAULT_SETTINGS.crashReporting,
          dataCollection: DEFAULT_SETTINGS.dataCollection,
          biometricLock: DEFAULT_SETTINGS.biometricLock,
          autoLockTimeout: DEFAULT_SETTINGS.autoLockTimeout,
        };
      default:
        return {};
    }
  }

  // Validate settings values
  static validateSettings(settings: Partial<AppSettings>): string[] {
    const errors: string[] = [];
    
    if (settings.maxTokens !== undefined) {
      if (settings.maxTokens < 1 || settings.maxTokens > 4000) {
        errors.push('Max tokens must be between 1 and 4000');
      }
    }
    
    if (settings.temperature !== undefined) {
      if (settings.temperature < 0 || settings.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }
    
    if (settings.speechRate !== undefined) {
      if (settings.speechRate < 0.5 || settings.speechRate > 2.0) {
        errors.push('Speech rate must be between 0.5 and 2.0');
      }
    }
    
    if (settings.voicePitch !== undefined) {
      if (settings.voicePitch < 0.5 || settings.voicePitch > 2.0) {
        errors.push('Voice pitch must be between 0.5 and 2.0');
      }
    }
    
    if (settings.voiceVolume !== undefined) {
      if (settings.voiceVolume < 0.0 || settings.voiceVolume > 1.0) {
        errors.push('Voice volume must be between 0.0 and 1.0');
      }
    }
    
    if (settings.audioFileRetentionDays !== undefined) {
      if (settings.audioFileRetentionDays < 1 || settings.audioFileRetentionDays > 365) {
        errors.push('Audio file retention must be between 1 and 365 days');
      }
    }
    
    if (settings.apiTimeout !== undefined) {
      if (settings.apiTimeout < 5000 || settings.apiTimeout > 120000) {
        errors.push('API timeout must be between 5 and 120 seconds');
      }
    }
    
    return errors;
  }
}