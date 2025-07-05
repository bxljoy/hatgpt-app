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
import { AppSettings, VoiceType } from '@/types';
import { SettingsStorageService } from '@/services/settingsStorage';

interface VoiceOption {
  value: VoiceType;
  label: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  style: string;
}

export function VoiceSettingsScreen() {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState<VoiceType | null>(null);

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

  // Voice options
  const voiceOptions: VoiceOption[] = [
    {
      value: 'alloy',
      label: 'Alloy',
      description: 'Neutral, balanced voice',
      gender: 'neutral',
      style: 'Professional',
    },
    {
      value: 'echo',
      label: 'Echo',
      description: 'Male, friendly voice',
      gender: 'male',
      style: 'Conversational',
    },
    {
      value: 'fable',
      label: 'Fable',
      description: 'Female, expressive voice',
      gender: 'female',
      style: 'Storytelling',
    },
    {
      value: 'onyx',
      label: 'Onyx',
      description: 'Male, deep voice',
      gender: 'male',
      style: 'Authoritative',
    },
    {
      value: 'nova',
      label: 'Nova',
      description: 'Female, energetic voice',
      gender: 'female',
      style: 'Enthusiastic',
    },
    {
      value: 'shimmer',
      label: 'Shimmer',
      description: 'Female, calm voice',
      gender: 'female',
      style: 'Soothing',
    },
  ];

  // Test voice
  const testVoice = useCallback(async (voice: VoiceType) => {
    if (!settings?.openaiApiKey) {
      Alert.alert('Error', 'Please configure your OpenAI API key first');
      return;
    }

    try {
      setIsTestingVoice(voice);
      
      // Here you would implement voice testing with the TTS API
      // For now, we'll just show a success message
      Alert.alert('Voice Test', `Testing ${voice} voice...`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('Failed to test voice:', error);
      Alert.alert('Error', 'Failed to test voice');
    } finally {
      setIsTestingVoice(null);
    }
  }, [settings?.openaiApiKey]);

  // Render voice selection
  const renderVoiceSelection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Voice Type</Text>
      <Text style={styles.sectionDescription}>
        Choose the voice for AI responses
      </Text>
      
      <View style={styles.voiceGrid}>
        {voiceOptions.map((voice) => (
          <TouchableOpacity
            key={voice.value}
            style={[
              styles.voiceOption,
              settings?.voiceType === voice.value && styles.voiceOptionActive,
            ]}
            onPress={() => saveSetting('voiceType', voice.value)}
            disabled={isSaving}
          >
            <View style={styles.voiceHeader}>
              <Text style={[
                styles.voiceLabel,
                settings?.voiceType === voice.value && styles.voiceLabelActive,
              ]}>
                {voice.label}
              </Text>
              <View style={styles.voiceActions}>
                <TouchableOpacity
                  style={styles.testVoiceButton}
                  onPress={() => testVoice(voice.value)}
                  disabled={isTestingVoice !== null}
                >
                  {isTestingVoice === voice.value ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.testVoiceButtonText}>🔊</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            
            <Text style={[
              styles.voiceDescription,
              settings?.voiceType === voice.value && styles.voiceDescriptionActive,
            ]}>
              {voice.description}
            </Text>
            
            <View style={styles.voiceMetadata}>
              <View style={[styles.genderTag, styles[`gender${voice.gender}` as keyof typeof styles]]}>
                <Text style={styles.genderTagText}>
                  {voice.gender === 'male' ? '♂' : voice.gender === 'female' ? '♀' : '⚲'}
                </Text>
              </View>
              <Text style={styles.voiceStyle}>{voice.style}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Render speech controls
  const renderSpeechControls = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Speech Controls</Text>
      
      {/* Speech Rate */}
      <View style={styles.controlItem}>
        <View style={styles.controlHeader}>
          <Text style={styles.controlTitle}>Speech Rate</Text>
          <Text style={styles.controlValue}>
            {settings?.speechRate?.toFixed(1)}x
          </Text>
        </View>
        <Text style={styles.controlDescription}>
          How fast the AI speaks (0.5x - 2.0x)
        </Text>
        
        <View style={styles.sliderContainer}>
          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${((settings?.speechRate || 1) - 0.5) / 1.5 * 100}%`,
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.sliderThumb,
                {
                  left: `${((settings?.speechRate || 1) - 0.5) / 1.5 * 100}%`,
                },
              ]}
              disabled={isSaving}
            />
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0.5x</Text>
            <Text style={styles.sliderLabel}>1.0x</Text>
            <Text style={styles.sliderLabel}>2.0x</Text>
          </View>
        </View>
      </View>

      {/* Voice Pitch */}
      <View style={styles.controlItem}>
        <View style={styles.controlHeader}>
          <Text style={styles.controlTitle}>Voice Pitch</Text>
          <Text style={styles.controlValue}>
            {settings?.voicePitch?.toFixed(1)}x
          </Text>
        </View>
        <Text style={styles.controlDescription}>
          Pitch of the voice (0.5x - 2.0x)
        </Text>
        
        <View style={styles.sliderContainer}>
          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${((settings?.voicePitch || 1) - 0.5) / 1.5 * 100}%`,
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.sliderThumb,
                {
                  left: `${((settings?.voicePitch || 1) - 0.5) / 1.5 * 100}%`,
                },
              ]}
              disabled={isSaving}
            />
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0.5x</Text>
            <Text style={styles.sliderLabel}>1.0x</Text>
            <Text style={styles.sliderLabel}>2.0x</Text>
          </View>
        </View>
      </View>

      {/* Voice Volume */}
      <View style={styles.controlItem}>
        <View style={styles.controlHeader}>
          <Text style={styles.controlTitle}>Voice Volume</Text>
          <Text style={styles.controlValue}>
            {Math.round((settings?.voiceVolume || 1) * 100)}%
          </Text>
        </View>
        <Text style={styles.controlDescription}>
          Volume level for AI voice responses
        </Text>
        
        <View style={styles.sliderContainer}>
          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${(settings?.voiceVolume || 1) * 100}%`,
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.sliderThumb,
                {
                  left: `${(settings?.voiceVolume || 1) * 100}%`,
                },
              ]}
              disabled={isSaving}
            />
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0%</Text>
            <Text style={styles.sliderLabel}>50%</Text>
            <Text style={styles.sliderLabel}>100%</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Render auto-play settings
  const renderAutoPlaySettings = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Auto-Play Settings</Text>
      
      <View style={styles.switchItem}>
        <View style={styles.switchContent}>
          <Text style={styles.switchTitle}>Auto-Play Audio</Text>
          <Text style={styles.switchDescription}>
            Automatically play AI responses as audio
          </Text>
        </View>
        <Switch
          value={settings?.autoPlayAudio || false}
          onValueChange={(value) => saveSetting('autoPlayAudio', value)}
          disabled={isSaving}
          trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
          thumbColor="#FFFFFF"
        />
      </View>
      
      <View style={styles.switchItem}>
        <View style={styles.switchContent}>
          <Text style={styles.switchTitle}>Auto-Stop Audio</Text>
          <Text style={styles.switchDescription}>
            Stop previous audio when new response arrives
          </Text>
        </View>
        <Switch
          value={settings?.autoStopAudio || false}
          onValueChange={(value) => saveSetting('autoStopAudio', value)}
          disabled={isSaving}
          trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
          thumbColor="#FFFFFF"
        />
      </View>
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
          <Text style={styles.headerTitle}>Voice Settings</Text>
        </View>

        {/* Voice Selection */}
        {renderVoiceSelection()}

        {/* Speech Controls */}
        {renderSpeechControls()}

        {/* Auto-Play Settings */}
        {renderAutoPlaySettings()}

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <Text style={styles.infoText}>
            • Use the test button to preview each voice{'\n'}
            • Slower speech rates are better for learning{'\n'}
            • Auto-play saves time in conversations{'\n'}
            • Adjust volume based on your environment
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
  voiceGrid: {
    gap: 12,
  },
  voiceOption: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  voiceOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  voiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  voiceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  voiceLabelActive: {
    color: '#007AFF',
  },
  voiceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  testVoiceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testVoiceButtonText: {
    fontSize: 16,
  },
  voiceDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  voiceDescriptionActive: {
    color: '#0066CC',
  },
  voiceMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  genderTag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gendermale: {
    backgroundColor: '#E3F2FD',
  },
  genderfemale: {
    backgroundColor: '#FCE4EC',
  },
  genderneutral: {
    backgroundColor: '#F3E5F5',
  },
  genderTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  voiceStyle: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  controlItem: {
    marginBottom: 24,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  controlTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  controlValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  controlDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  sliderContainer: {
    paddingVertical: 8,
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
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});