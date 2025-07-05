import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { AudioPlaybackControls, PlaybackState } from './AudioPlaybackControls';
import { SpeakingIndicator, SpeakingState } from './SpeakingIndicator';
import { VoiceSelectionSettings, VoiceSettings } from './VoiceSelectionSettings';
import { AudioProgressIndicator, AudioProgressData } from './AudioProgressIndicator';
import { SpeechController, SpeechQueueItem } from './SpeechController';
import { VolumeControl } from './VolumeControl';
import { AudioVisualFeedback, AudioVisualizationData } from './AudioVisualFeedback';

const { width: screenWidth } = Dimensions.get('window');

interface TestMessage {
  id: string;
  text: string;
  timestamp: Date;
  duration?: number;
  audioUri?: string;
}

export function VoiceOutputTestScreen() {
  // State management
  const [currentSection, setCurrentSection] = useState<string>('overview');
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [useSystemVolume, setUseSystemVolume] = useState(false);

  // Audio states for testing
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [speakingState, setSpeakingState] = useState<SpeakingState>('idle');
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);

  // Mock audio data
  const [audioProgress, setAudioProgress] = useState<AudioProgressData>({
    position: 0,
    duration: 30000,
    buffered: 15000,
    isLoaded: true,
    isPlaying: false,
    playbackRate: 1.0,
  });

  const [visualizationData, setVisualizationData] = useState<AudioVisualizationData>({
    state: 'idle',
    volume: 0.8,
    position: 0,
    duration: 30000,
    buffered: 15000,
    frequency: Array.from({ length: 32 }, () => Math.random() * 255),
    waveform: Array.from({ length: 20 }, () => Math.random() * 2 - 1),
    bitrate: 320000,
    isLive: false,
  });

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceId: 'alloy',
    speed: 1.0,
    pitch: 1.0,
    volume: 0.8,
    language: 'en',
    quality: 'premium',
    autoPlay: true,
    useSystemVolume: false,
  });

  // Test scenarios
  const testScenarios = [
    {
      name: 'Short Message',
      text: 'Hello! This is a short test message.',
    },
    {
      name: 'Medium Message',
      text: 'This is a medium-length message that demonstrates how the voice output components handle regular conversation.',
    },
    {
      name: 'Long Message',
      text: 'This is a much longer message that contains multiple sentences and demonstrates how the voice output components handle extended speech synthesis. It includes various punctuation marks, pauses, and different sentence structures to test the full range of capabilities.',
    },
    {
      name: 'Technical Content',
      text: 'The AudioPlaybackControls component uses React Native\'s Audio API from Expo to manage audio playback, including features like speed control, volume adjustment, and progress tracking.',
    },
  ];

  // Mock functions
  const mockSpeechRequest = async (text: string, options?: any): Promise<string> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock audio URI
    return 'mock://audio/speech.mp3';
  };

  const handlePlaybackStateChange = (state: PlaybackState) => {
    setPlaybackState(state);
    setIsPlaying(state === 'playing');
    
    // Update visualization data
    setVisualizationData(prev => ({
      ...prev,
      state: state === 'playing' ? 'playing' : 
             state === 'loading' ? 'loading' :
             state === 'error' ? 'error' : 'idle',
    }));
  };

  const handleProgressUpdate = (position: number, duration: number) => {
    setAudioProgress(prev => ({
      ...prev,
      position,
      duration,
      isPlaying: isPlaying,
    }));
  };

  const handleVolumeChange = (volume: number) => {
    setCurrentVolume(volume);
    setVisualizationData(prev => ({ ...prev, volume }));
  };

  const handleTestScenario = (scenario: any) => {
    const message: TestMessage = {
      id: `test_${Date.now()}`,
      text: scenario.text,
      timestamp: new Date(),
      duration: scenario.text.length * 50, // Rough estimate
    };

    setTestMessages(prev => [message, ...prev.slice(0, 4)]); // Keep last 5
    
    // Simulate speech synthesis
    setSpeakingState('preparing');
    setTimeout(() => {
      setSpeakingState('speaking');
      setTimeout(() => {
        setSpeakingState('idle');
      }, message.duration);
    }, 1000);

    Alert.alert('Test Started', `Playing: "${scenario.name}"`);
  };

  const sections = [
    { id: 'overview', title: '📊 Overview', icon: '📊' },
    { id: 'playback', title: '🎵 Playback Controls', icon: '🎵' },
    { id: 'speaking', title: '🗣 Speaking Indicator', icon: '🗣' },
    { id: 'progress', title: '📈 Progress Indicator', icon: '📈' },
    { id: 'volume', title: '🔊 Volume Control', icon: '🔊' },
    { id: 'visualization', title: '🎨 Visual Feedback', icon: '🎨' },
    { id: 'speech', title: '🤖 Speech Controller', icon: '🤖' },
    { id: 'settings', title: '⚙️ Voice Settings', icon: '⚙️' },
  ];

  const theme = isDarkTheme ? 'dark' : 'light';
  const colors = {
    background: isDarkTheme ? '#000000' : '#F2F2F7',
    surface: isDarkTheme ? '#1C1C1E' : '#FFFFFF',
    card: isDarkTheme ? '#2C2C2E' : '#FFFFFF',
    primary: '#007AFF',
    text: isDarkTheme ? '#FFFFFF' : '#000000',
    textSecondary: isDarkTheme ? '#8E8E93' : '#8E8E93',
    border: isDarkTheme ? '#38383A' : '#E5E5EA',
  };

  const renderNavigation = () => (
    <ScrollView 
      horizontal 
      style={styles.navigation}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.navigationContent}
    >
      {sections.map((section) => (
        <TouchableOpacity
          key={section.id}
          style={[
            styles.navItem,
            {
              backgroundColor: currentSection === section.id ? colors.primary : colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setCurrentSection(section.id)}
        >
          <Text style={styles.navIcon}>{section.icon}</Text>
          <Text
            style={[
              styles.navText,
              {
                color: currentSection === section.id ? '#FFFFFF' : colors.text,
              },
            ]}
          >
            {section.title.split(' ').slice(1).join(' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderOverview = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Voice Output Components Overview
      </Text>
      
      <View style={[styles.overviewGrid, { backgroundColor: colors.card }]}>
        <View style={styles.overviewItem}>
          <AudioVisualFeedback
            data={visualizationData}
            size="small"
            theme={theme}
            visualizationType="circle"
          />
          <Text style={[styles.overviewLabel, { color: colors.text }]}>
            Visual Feedback
          </Text>
        </View>

        <View style={styles.overviewItem}>
          <SpeakingIndicator
            isActive={speakingState === 'speaking'}
            state={speakingState}
            size="small"
            theme={theme}
            showText={false}
            animationType="waves"
          />
          <Text style={[styles.overviewLabel, { color: colors.text }]}>
            Speaking Indicator
          </Text>
        </View>

        <View style={styles.overviewItem}>
          <VolumeControl
            volume={currentVolume}
            onVolumeChange={handleVolumeChange}
            size="small"
            theme={theme}
            orientation="vertical"
            showMuteButton={false}
          />
          <Text style={[styles.overviewLabel, { color: colors.text }]}>
            Volume Control
          </Text>
        </View>
      </View>

      <View style={[styles.statsGrid, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {testMessages.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Test Messages
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {Math.round(currentVolume * 100)}%
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Current Volume
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {voiceSettings.voiceId}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Voice Model
          </Text>
        </View>
      </View>

      <View style={styles.testScenarios}>
        <Text style={[styles.subsectionTitle, { color: colors.text }]}>
          Test Scenarios
        </Text>
        {testScenarios.map((scenario, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.scenarioButton, { backgroundColor: colors.card }]}
            onPress={() => handleTestScenario(scenario)}
          >
            <Text style={[styles.scenarioName, { color: colors.text }]}>
              {scenario.name}
            </Text>
            <Text style={[styles.scenarioText, { color: colors.textSecondary }]}>
              {scenario.text.substring(0, 60)}...
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPlaybackControls = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Audio Playback Controls
      </Text>
      
      <AudioPlaybackControls
        audioUri="mock://audio/test.mp3"
        autoPlay={false}
        showProgress={true}
        showSpeed={true}
        showVolume={true}
        onStateChange={handlePlaybackStateChange}
        onProgress={handleProgressUpdate}
        style={[styles.component, { backgroundColor: colors.card }]}
        size="large"
        theme={theme}
      />

      <Text style={[styles.componentDescription, { color: colors.textSecondary }]}>
        Full-featured audio player with play/pause/stop controls, speed adjustment, 
        volume control, and progress tracking with visual waveform animation.
      </Text>
    </View>
  );

  const renderSpeakingIndicator = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Speaking Indicator Animations
      </Text>
      
      <View style={styles.indicatorGrid}>
        {(['waves', 'dots', 'pulse', 'bars'] as const).map((type) => (
          <View key={type} style={[styles.indicatorItem, { backgroundColor: colors.card }]}>
            <SpeakingIndicator
              isActive={speakingState === 'speaking'}
              state={speakingState}
              size="medium"
              theme={theme}
              showText={false}
              animationType={type}
            />
            <Text style={[styles.indicatorLabel, { color: colors.text }]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          setSpeakingState('preparing');
          setTimeout(() => {
            setSpeakingState('speaking');
            setTimeout(() => setSpeakingState('idle'), 3000);
          }, 1000);
        }}
      >
        <Text style={styles.testButtonText}>Test Speaking Animation</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProgressIndicator = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Audio Progress Indicator
      </Text>
      
      <AudioProgressIndicator
        progress={audioProgress}
        onSeek={(position) => {
          setAudioProgress(prev => ({ ...prev, position }));
        }}
        style={[styles.component, { backgroundColor: colors.card }]}
        theme={theme}
        size="large"
        showTime={true}
        showBuffer={true}
        allowScrubbing={true}
      />

      <View style={styles.progressControls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            const newPosition = Math.random() * audioProgress.duration;
            setAudioProgress(prev => ({ ...prev, position: newPosition }));
          }}
        >
          <Text style={styles.controlButtonText}>Random Seek</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            setAudioProgress(prev => ({ 
              ...prev, 
              isPlaying: !prev.isPlaying,
              position: prev.isPlaying ? prev.position : Math.min(prev.position + 1000, prev.duration)
            }));
          }}
        >
          <Text style={styles.controlButtonText}>
            {audioProgress.isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVolumeControl = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Volume Control
      </Text>
      
      <View style={styles.volumeGrid}>
        <VolumeControl
          volume={currentVolume}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={setIsMuted}
          onSystemVolumeToggle={setUseSystemVolume}
          isMuted={isMuted}
          useSystemVolume={useSystemVolume}
          style={[styles.volumeItem, { backgroundColor: colors.card }]}
          orientation="horizontal"
          size="large"
          theme={theme}
        />

        <VolumeControl
          volume={currentVolume}
          onVolumeChange={handleVolumeChange}
          style={[styles.volumeItem, { backgroundColor: colors.card }]}
          orientation="vertical"
          size="medium"
          theme={theme}
          showSystemVolume={false}
        />
      </View>
    </View>
  );

  const renderVisualization = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Audio Visual Feedback
      </Text>
      
      <View style={styles.visualGrid}>
        {(['waveform', 'spectrum', 'circle', 'bars', 'minimal'] as const).map((type) => (
          <View key={type} style={[styles.visualItem, { backgroundColor: colors.card }]}>
            <AudioVisualFeedback
              data={visualizationData}
              size="medium"
              theme={theme}
              visualizationType={type}
              showStateText={false}
              animationIntensity="high"
            />
            <Text style={[styles.visualLabel, { color: colors.text }]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderSpeechController = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Speech Controller
      </Text>
      
      <SpeechController
        onSpeechRequest={mockSpeechRequest}
        style={[styles.component, { backgroundColor: colors.card }]}
        size="large"
        theme={theme}
        showQueue={true}
        showProgress={true}
      />
    </View>
  );

  const renderVoiceSettings = () => (
    <View style={styles.section}>
      <VoiceSelectionSettings
        currentSettings={voiceSettings}
        onSettingsChange={setVoiceSettings}
        theme={theme}
      />
    </View>
  );

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'playback': return renderPlaybackControls();
      case 'speaking': return renderSpeakingIndicator();
      case 'progress': return renderProgressIndicator();
      case 'volume': return renderVolumeControl();
      case 'visualization': return renderVisualization();
      case 'speech': return renderSpeechController();
      case 'settings': return renderVoiceSettings();
      default: return renderOverview();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDarkTheme ? ['#000000', '#1C1C1E'] : ['#F2F2F7', '#FFFFFF']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Voice Output Components
          </Text>
          <View style={styles.headerControls}>
            <Text style={[styles.themeLabel, { color: colors.textSecondary }]}>
              Dark Mode
            </Text>
            <Switch
              value={isDarkTheme}
              onValueChange={setIsDarkTheme}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={isDarkTheme ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        {/* Navigation */}
        {renderNavigation()}

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderCurrentSection()}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  navigation: {
    maxHeight: 60,
  },
  navigationContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  navIcon: {
    fontSize: 16,
  },
  navText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  component: {
    borderRadius: 12,
    marginBottom: 16,
  },
  componentDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  overviewItem: {
    alignItems: 'center',
    gap: 8,
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  testScenarios: {
    gap: 12,
  },
  scenarioButton: {
    padding: 16,
    borderRadius: 12,
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scenarioText: {
    fontSize: 14,
  },
  indicatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  indicatorItem: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    width: (screenWidth - 60) / 2,
  },
  indicatorLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  testButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressControls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  volumeGrid: {
    gap: 20,
  },
  volumeItem: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  visualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  visualItem: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    width: (screenWidth - 60) / 2,
  },
  visualLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
});