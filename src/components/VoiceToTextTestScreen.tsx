import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { VoiceInputModal } from './VoiceInputModal';

const { width: screenWidth } = Dimensions.get('window');

interface MessageItem {
  id: string;
  text: string;
  timestamp: Date;
  type: 'voice' | 'text';
  confidence?: number;
  language?: string;
  duration?: number;
}

export function VoiceToTextTestScreen() {
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>('auto');
  const [enableTextEditing, setEnableTextEditing] = useState(true);
  const [autoCompleteOnTranscription, setAutoCompleteOnTranscription] = useState(false);

  const handleVoiceInput = () => {
    setShowVoiceModal(true);
  };

  const handleTextConfirmed = (text: string) => {
    const newMessage: MessageItem = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: new Date(),
      type: 'voice',
    };

    setMessages(prev => [newMessage, ...prev]);
    Alert.alert('Message Added!', `Text: "${text}"`);
  };

  const handleVoiceCancel = () => {
    console.log('Voice input cancelled');
  };

  const clearMessages = () => {
    Alert.alert(
      'Clear Messages',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
      ]
    );
  };

  const toggleLanguage = () => {
    const languages = ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'zh'];
    const currentIndex = languages.indexOf(currentLanguage);
    const nextIndex = (currentIndex + 1) % languages.length;
    setCurrentLanguage(languages[nextIndex]);
  };

  const getLanguageDisplayName = (code: string) => {
    const languageNames: Record<string, string> = {
      'auto': 'Auto-detect',
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'zh': 'Chinese',
    };
    return languageNames[code] || code;
  };

  const renderSettingsSection = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>Voice Input Settings</Text>
      
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Language:</Text>
        <TouchableOpacity style={styles.settingButton} onPress={toggleLanguage}>
          <Text style={styles.settingButtonText}>
            {getLanguageDisplayName(currentLanguage)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Text Editing:</Text>
        <TouchableOpacity 
          style={[styles.settingButton, enableTextEditing && styles.settingButtonActive]} 
          onPress={() => setEnableTextEditing(!enableTextEditing)}
        >
          <Text style={[styles.settingButtonText, enableTextEditing && styles.settingButtonTextActive]}>
            {enableTextEditing ? 'Enabled' : 'Disabled'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Auto Complete:</Text>
        <TouchableOpacity 
          style={[styles.settingButton, autoCompleteOnTranscription && styles.settingButtonActive]} 
          onPress={() => setAutoCompleteOnTranscription(!autoCompleteOnTranscription)}
        >
          <Text style={[styles.settingButtonText, autoCompleteOnTranscription && styles.settingButtonTextActive]}>
            {autoCompleteOnTranscription ? 'Enabled' : 'Disabled'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderControlsSection = () => (
    <View style={styles.controlsSection}>
      <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceInput}>
        <Text style={styles.voiceButtonIcon}>🎤</Text>
        <Text style={styles.voiceButtonText}>Start Voice Input</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, styles.clearButton]} 
        onPress={clearMessages}
        disabled={messages.length === 0}
      >
        <Text style={styles.clearButtonText}>Clear Messages</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMessagesSection = () => (
    <View style={styles.messagesSection}>
      <View style={styles.messagesHeader}>
        <Text style={styles.sectionTitle}>Voice Messages</Text>
        <Text style={styles.messageCount}>({messages.length})</Text>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>💬</Text>
          <Text style={styles.emptyStateText}>No voice messages yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap "Start Voice Input" to record your first message
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <View key={message.id} style={styles.messageItem}>
              <View style={styles.messageHeader}>
                <Text style={styles.messageType}>
                  {message.type === 'voice' ? '🎤' : '💭'} Voice Message
                </Text>
                <Text style={styles.messageTime}>
                  {message.timestamp.toLocaleTimeString()}
                </Text>
              </View>
              
              <Text style={styles.messageText}>{message.text}</Text>
              
              {(message.confidence || message.language || message.duration) && (
                <View style={styles.messageMetadata}>
                  {message.confidence && (
                    <Text style={styles.metadataItem}>
                      Confidence: {Math.round(message.confidence * 100)}%
                    </Text>
                  )}
                  {message.language && (
                    <Text style={styles.metadataItem}>
                      Language: {message.language.toUpperCase()}
                    </Text>
                  )}
                  {message.duration && (
                    <Text style={styles.metadataItem}>
                      Duration: {Math.round(message.duration)}s
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderFeaturesList = () => (
    <View style={styles.featuresSection}>
      <Text style={styles.sectionTitle}>Voice-to-Text Features</Text>
      <View style={styles.featuresList}>
        <Text style={styles.featureItem}>🎯 Complete record → transcribe → edit workflow</Text>
        <Text style={styles.featureItem}>⚡ Real-time progress tracking during transcription</Text>
        <Text style={styles.featureItem}>✏️ Edit transcription before sending</Text>
        <Text style={styles.featureItem}>🔄 Retry on errors with smart fallback handling</Text>
        <Text style={styles.featureItem}>🌍 Auto language detection & manual selection</Text>
        <Text style={styles.featureItem}>📊 Confidence scoring for transcription quality</Text>
        <Text style={styles.featureItem}>⏹️ Cancel at any stage of the workflow</Text>
        <Text style={styles.featureItem}>🎭 Smooth animations and haptic feedback</Text>
        <Text style={styles.featureItem}>🔧 Configurable settings for different use cases</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8F9FA', '#FFFFFF']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Voice-to-Text Workflow</Text>
            <Text style={styles.subtitle}>
              Complete integration test for record → transcribe → edit flow
            </Text>
          </View>

          {/* Settings */}
          {renderSettingsSection()}

          {/* Controls */}
          {renderControlsSection()}

          {/* Messages */}
          {renderMessagesSection()}

          {/* Features */}
          {renderFeaturesList()}
        </ScrollView>

        {/* Voice Input Modal */}
        <VoiceInputModal
          isVisible={showVoiceModal}
          onClose={() => setShowVoiceModal(false)}
          onTextConfirmed={handleTextConfirmed}
          onCancel={handleVoiceCancel}
          maxRecordingDuration={300000} // 5 minutes
          language={currentLanguage === 'auto' ? undefined : currentLanguage}
          enableTextEditing={enableTextEditing}
          autoCompleteOnTranscription={autoCompleteOnTranscription}
          placeholder="Tap the microphone to start recording your voice message"
        />
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
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  settingsSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  settingButton: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  settingButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  settingButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  settingButtonTextActive: {
    color: '#FFFFFF',
  },
  controlsSection: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
  },
  voiceButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  voiceButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  voiceButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  messagesSection: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  messageCount: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  messagesList: {
    maxHeight: 300,
  },
  messageItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  messageTime: {
    fontSize: 12,
    color: '#999999',
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
    marginBottom: 8,
  },
  messageMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metadataItem: {
    fontSize: 12,
    color: '#666666',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuresSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 12,
    padding: 16,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});