import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Slider,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

import { SpeakingIndicator } from './SpeakingIndicator';
import { AudioPlaybackControls } from './AudioPlaybackControls';

const { width: screenWidth } = Dimensions.get('window');

export interface VoiceSettings {
  voiceId: string;
  speed: number; // 0.5 - 2.0
  pitch: number; // 0.5 - 2.0
  volume: number; // 0.0 - 1.0
  language: string;
  quality: 'standard' | 'premium';
  autoPlay: boolean;
  useSystemVolume: boolean;
}

export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  quality: 'standard' | 'premium';
  description?: string;
  sampleText: string;
  isPremium: boolean;
}

const DEFAULT_VOICES: VoiceOption[] = [
  {
    id: 'alloy',
    name: 'Alloy',
    language: 'English',
    languageCode: 'en',
    gender: 'neutral',
    quality: 'premium',
    description: 'Balanced and clear voice',
    sampleText: 'Hello! This is Alloy speaking. I have a clear and balanced tone.',
    isPremium: false,
  },
  {
    id: 'echo',
    name: 'Echo',
    language: 'English',
    languageCode: 'en',
    gender: 'male',
    quality: 'premium',
    description: 'Deep and resonant voice',
    sampleText: 'Hello! This is Echo speaking. I have a deep and resonant voice.',
    isPremium: false,
  },
  {
    id: 'fable',
    name: 'Fable',
    language: 'English',
    languageCode: 'en',
    gender: 'female',
    quality: 'premium',
    description: 'Warm and expressive voice',
    sampleText: 'Hello! This is Fable speaking. I have a warm and expressive tone.',
    isPremium: false,
  },
  {
    id: 'onyx',
    name: 'Onyx',
    language: 'English',
    languageCode: 'en',
    gender: 'male',
    quality: 'premium',
    description: 'Strong and confident voice',
    sampleText: 'Hello! This is Onyx speaking. I have a strong and confident voice.',
    isPremium: false,
  },
  {
    id: 'nova',
    name: 'Nova',
    language: 'English',
    languageCode: 'en',
    gender: 'female',
    quality: 'premium',
    description: 'Bright and energetic voice',
    sampleText: 'Hello! This is Nova speaking. I have a bright and energetic voice.',
    isPremium: false,
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    language: 'English',
    languageCode: 'en',
    gender: 'female',
    quality: 'premium',
    description: 'Soft and gentle voice',
    sampleText: 'Hello! This is Shimmer speaking. I have a soft and gentle voice.',
    isPremium: false,
  },
];

interface VoiceSelectionSettingsProps {
  currentSettings: VoiceSettings;
  onSettingsChange: (settings: VoiceSettings) => void;
  onVoicePreview?: (voiceId: string, text: string) => void;
  availableVoices?: VoiceOption[];
  isPlaying?: boolean;
  theme?: 'light' | 'dark';
}

export function VoiceSelectionSettings({
  currentSettings,
  onSettingsChange,
  onVoicePreview,
  availableVoices = DEFAULT_VOICES,
  isPlaying = false,
  theme = 'light',
}: VoiceSelectionSettingsProps) {
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [systemVolume, setSystemVolume] = useState(1.0);

  // Theme colors
  const getThemeColors = () => {
    if (theme === 'dark') {
      return {
        primary: '#007AFF',
        secondary: '#FF9500',
        success: '#00C851',
        background: '#000000',
        surface: '#1C1C1E',
        card: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
      };
    }
    return {
      primary: '#007AFF',
      secondary: '#FF9500',
      success: '#00C851',
      background: '#F2F2F7',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
    };
  };

  const colors = getThemeColors();

  useEffect(() => {
    getSystemVolume();
  }, []);

  const getSystemVolume = async () => {
    try {
      // Note: Getting actual system volume requires native modules
      // This is a placeholder for demonstration
      setSystemVolume(0.8);
    } catch (error) {
      console.error('Failed to get system volume:', error);
    }
  };

  const updateSettings = (partial: Partial<VoiceSettings>) => {
    const newSettings = { ...currentSettings, ...partial };
    onSettingsChange(newSettings);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleVoiceSelect = (voiceId: string) => {
    updateSettings({ voiceId });
  };

  const handleVoicePreview = (voice: VoiceOption) => {
    setTestingVoice(voice.id);
    onVoicePreview?.(voice.id, voice.sampleText);
    
    // Simulate preview completion
    setTimeout(() => {
      setTestingVoice(null);
    }, 3000);
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all voice settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const defaultSettings: VoiceSettings = {
              voiceId: 'alloy',
              speed: 1.0,
              pitch: 1.0,
              volume: 0.8,
              language: 'en',
              quality: 'premium',
              autoPlay: true,
              useSystemVolume: false,
            };
            onSettingsChange(defaultSettings);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>Voice Settings</Text>
      <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
        <Text style={[styles.resetButtonText, { color: colors.primary }]}>
          Reset
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderVoiceSelection = () => (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Voice Selection
      </Text>
      
      <ScrollView style={styles.voiceList} showsVerticalScrollIndicator={false}>
        {availableVoices.map((voice) => (
          <TouchableOpacity
            key={voice.id}
            style={[
              styles.voiceItem,
              {
                backgroundColor: currentSettings.voiceId === voice.id 
                  ? colors.primary + '20' 
                  : colors.surface,
                borderColor: currentSettings.voiceId === voice.id 
                  ? colors.primary 
                  : colors.border,
              },
            ]}
            onPress={() => handleVoiceSelect(voice.id)}
          >
            <View style={styles.voiceInfo}>
              <View style={styles.voiceHeader}>
                <Text style={[styles.voiceName, { color: colors.text }]}>
                  {voice.name}
                </Text>
                {voice.isPremium && (
                  <View style={[styles.premiumBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={styles.premiumText}>Pro</Text>
                  </View>
                )}
              </View>
              
              <Text style={[styles.voiceDetails, { color: colors.textSecondary }]}>
                {voice.language} • {voice.gender} • {voice.quality}
              </Text>
              
              {voice.description && (
                <Text style={[styles.voiceDescription, { color: colors.textSecondary }]}>
                  {voice.description}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.previewButton, { backgroundColor: colors.primary }]}
              onPress={() => handleVoicePreview(voice)}
              disabled={testingVoice === voice.id}
            >
              {testingVoice === voice.id ? (
                <SpeakingIndicator
                  isActive={true}
                  state="speaking"
                  size="small"
                  theme={theme}
                  showText={false}
                  animationType="dots"
                />
              ) : (
                <Text style={styles.previewButtonText}>▶</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderVoiceControls = () => (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Voice Controls
      </Text>

      {/* Speed Control */}
      <View style={styles.controlGroup}>
        <View style={styles.controlHeader}>
          <Text style={[styles.controlLabel, { color: colors.text }]}>
            Speech Speed
          </Text>
          <Text style={[styles.controlValue, { color: colors.primary }]}>
            {currentSettings.speed.toFixed(1)}×
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={2.0}
          step={0.1}
          value={currentSettings.speed}
          onValueChange={(value) => updateSettings({ speed: value })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbStyle={{ backgroundColor: colors.primary }}
        />
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
            0.5× Slow
          </Text>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
            2.0× Fast
          </Text>
        </View>
      </View>

      {/* Pitch Control */}
      <View style={styles.controlGroup}>
        <View style={styles.controlHeader}>
          <Text style={[styles.controlLabel, { color: colors.text }]}>
            Voice Pitch
          </Text>
          <Text style={[styles.controlValue, { color: colors.primary }]}>
            {currentSettings.pitch.toFixed(1)}×
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={2.0}
          step={0.1}
          value={currentSettings.pitch}
          onValueChange={(value) => updateSettings({ pitch: value })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbStyle={{ backgroundColor: colors.primary }}
        />
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
            0.5× Low
          </Text>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
            2.0× High
          </Text>
        </View>
      </View>

      {/* Volume Control */}
      <View style={styles.controlGroup}>
        <View style={styles.controlHeader}>
          <Text style={[styles.controlLabel, { color: colors.text }]}>
            Volume
          </Text>
          <Text style={[styles.controlValue, { color: colors.primary }]}>
            {Math.round(currentSettings.volume * 100)}%
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0.0}
          maximumValue={1.0}
          step={0.05}
          value={currentSettings.volume}
          onValueChange={(value) => updateSettings({ volume: value })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbStyle={{ backgroundColor: colors.primary }}
        />
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
            🔇 0%
          </Text>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
            🔊 100%
          </Text>
        </View>
      </View>
    </View>
  );

  const renderAdvancedSettings = () => (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Advanced Settings
      </Text>

      {/* Quality Setting */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Audio Quality
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            Higher quality uses more bandwidth
          </Text>
        </View>
        <View style={styles.qualitySelector}>
          {(['standard', 'premium'] as const).map((quality) => (
            <TouchableOpacity
              key={quality}
              style={[
                styles.qualityOption,
                {
                  backgroundColor: currentSettings.quality === quality 
                    ? colors.primary 
                    : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => updateSettings({ quality })}
            >
              <Text
                style={[
                  styles.qualityText,
                  {
                    color: currentSettings.quality === quality 
                      ? '#FFFFFF' 
                      : colors.text,
                  },
                ]}
              >
                {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Auto Play Setting */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Auto Play
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            Automatically play speech when generated
          </Text>
        </View>
        <Switch
          value={currentSettings.autoPlay}
          onValueChange={(value) => updateSettings({ autoPlay: value })}
          trackColor={{ false: colors.border, true: colors.primary + '80' }}
          thumbColor={currentSettings.autoPlay ? colors.primary : colors.textSecondary}
        />
      </View>

      {/* System Volume Setting */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Use System Volume
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            Follow device volume instead of app setting
          </Text>
        </View>
        <Switch
          value={currentSettings.useSystemVolume}
          onValueChange={(value) => updateSettings({ useSystemVolume: value })}
          trackColor={{ false: colors.border, true: colors.primary + '80' }}
          thumbColor={currentSettings.useSystemVolume ? colors.primary : colors.textSecondary}
        />
      </View>

      {currentSettings.useSystemVolume && (
        <View style={styles.systemVolumeInfo}>
          <Text style={[styles.systemVolumeText, { color: colors.textSecondary }]}>
            System Volume: {Math.round(systemVolume * 100)}%
          </Text>
        </View>
      )}
    </View>
  );

  const renderTestSection = () => (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Test Current Settings
      </Text>
      
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          const selectedVoice = availableVoices.find(v => v.id === currentSettings.voiceId);
          if (selectedVoice) {
            handleVoicePreview(selectedVoice);
          }
        }}
        disabled={!!testingVoice}
      >
        {testingVoice ? (
          <SpeakingIndicator
            isActive={true}
            state="speaking"
            size="small"
            theme="dark"
            showText={false}
            animationType="waves"
          />
        ) : (
          <>
            <Text style={styles.testButtonIcon}>🔊</Text>
            <Text style={styles.testButtonText}>Test Voice</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={[styles.testDescription, { color: colors.textSecondary }]}>
        "Hello! This is a test of your current voice settings. How do I sound?"
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={theme === 'dark' ? ['#000000', '#1C1C1E'] : ['#F2F2F7', '#FFFFFF']}
        style={styles.gradient}
      >
        {renderHeader()}
        
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderVoiceSelection()}
          {renderVoiceControls()}
          {renderAdvancedSettings()}
          {renderTestSection()}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  voiceList: {
    maxHeight: 300,
  },
  voiceItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  voiceInfo: {
    flex: 1,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  premiumBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voiceDetails: {
    fontSize: 14,
    marginBottom: 4,
  },
  voiceDescription: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  previewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  controlGroup: {
    marginBottom: 24,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  controlValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
  },
  qualitySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  qualityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  systemVolumeInfo: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  systemVolumeText: {
    fontSize: 14,
    textAlign: 'center',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  testButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testDescription: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});