import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoiceConversationOverlay } from './VoiceConversationOverlay';
import { useVoiceMode } from '@/hooks/useVoiceMode';

export const VoiceModeExample: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);

  const [voiceModeState, voiceModeActions] = useVoiceMode({
    enableHaptics: true,
    maxRecordingDuration: 60000,
    onTranscriptionComplete: (text) => {
      setMessages(prev => [...prev, `User: ${text}`]);
      
      // Simulate AI response after a delay
      setTimeout(() => {
        const response = `AI Response to: "${text}"`;
        setMessages(prev => [...prev, `Assistant: ${response}`]);
        // Transition to speaking state before calling speakResponse
        voiceModeActions.setVoiceState('speaking');
        voiceModeActions.speakResponse(response);
      }, 1500);
    },
    onError: (error) => {
      console.error('Voice mode error:', error);
      Alert.alert('Voice Error', error);
    },
  });

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Mode Demo</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearMessages}
          activeOpacity={0.7}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.messagesContainer}>
        {messages.map((message, index) => (
          <View key={index} style={styles.messageItem}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ))}
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Tap the voice button to start a conversation
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.voiceButton,
            voiceModeState.isVoiceModeActive && styles.voiceButtonActive,
          ]}
          onPress={voiceModeActions.enterVoiceMode}
          activeOpacity={0.8}
        >
          <Text style={styles.voiceButtonText}>
            {voiceModeState.isVoiceModeActive ? '🎙️ Active' : '🎙️ Voice Mode'}
          </Text>
        </TouchableOpacity>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Status: {voiceModeState.voiceState}
          </Text>
          {voiceModeState.error && (
            <Text style={styles.errorText}>
              Error: {voiceModeState.error}
            </Text>
          )}
        </View>
      </View>

      <VoiceConversationOverlay
        isVisible={voiceModeState.isVoiceModeActive}
        voiceState={voiceModeState.voiceState}
        onClose={voiceModeActions.exitVoiceMode}
        onStartListening={voiceModeActions.startListening}
        onStopListening={voiceModeActions.stopListening}
        onToggleListening={voiceModeActions.toggleListening}
        isListening={voiceModeState.isListening}
        currentText={voiceModeState.currentTranscription}
        responseText={voiceModeState.currentResponse}
        enableHaptics={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  messageItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  controls: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  voiceButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  voiceButtonActive: {
    backgroundColor: '#34C759',
  },
  voiceButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    textAlign: 'center',
  },
});