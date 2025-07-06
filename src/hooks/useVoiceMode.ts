import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceModeConfig {
  enableHaptics?: boolean;
  maxRecordingDuration?: number;
  whisperApiKey?: string;
  ttsApiKey?: string;
  onTranscriptionComplete?: (text: string) => void;
  onAIResponseComplete?: (text: string) => void;
  onError?: (error: string) => void;
}

interface VoiceModeState {
  isVoiceModeActive: boolean;
  voiceState: VoiceState;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentTranscription: string;
  currentResponse: string;
  error: string | null;
  recordingUri: string | null;
  audioPermission: boolean;
}

interface VoiceModeActions {
  enterVoiceMode: () => void;
  exitVoiceMode: () => void;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  toggleListening: () => Promise<void>;
  processVoiceInput: (audioUri: string) => Promise<string>;
  speakResponse: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  clearError: () => void;
  setVoiceState: (state: VoiceState) => void;
}

export const useVoiceMode = (config: VoiceModeConfig = {}): [VoiceModeState, VoiceModeActions] => {
  const {
    enableHaptics = true,
    maxRecordingDuration = 60000,
    whisperApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    ttsApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    onTranscriptionComplete,
    onAIResponseComplete,
    onError,
  } = config;

  const [state, setState] = useState<VoiceModeState>({
    isVoiceModeActive: false,
    voiceState: 'idle',
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    currentTranscription: '',
    currentResponse: '',
    error: null,
    recordingUri: null,
    audioPermission: false,
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Request audio permissions
  const requestAudioPermission = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setState(prev => ({ ...prev, audioPermission: status === 'granted' }));
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permission:', error);
      setState(prev => ({ ...prev, error: 'Failed to request audio permission' }));
      return false;
    }
  }, []);

  // Initialize audio session
  const initializeAudioSession = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error initializing audio session:', error);
    }
  }, []);

  // Enter voice mode
  const enterVoiceMode = useCallback(async () => {
    if (!state.audioPermission) {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        setState(prev => ({ ...prev, error: 'Audio permission is required for voice mode' }));
        return;
      }
    }

    await initializeAudioSession();
    setState(prev => ({
      ...prev,
      isVoiceModeActive: true,
      voiceState: 'idle',
      error: null,
    }));

    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [state.audioPermission, requestAudioPermission, initializeAudioSession, enableHaptics]);

  // Exit voice mode
  const exitVoiceMode = useCallback(async () => {
    // Stop any ongoing recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }

    // Stop any ongoing playback
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
    }

    // Clear timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isVoiceModeActive: false,
      voiceState: 'idle',
      isListening: false,
      isProcessing: false,
      isSpeaking: false,
      currentTranscription: '',
      currentResponse: '',
      recordingUri: null,
      error: null,
    }));

    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [enableHaptics]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!state.audioPermission) {
      setState(prev => ({ ...prev, error: 'Audio permission is required' }));
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isListening: true,
        voiceState: 'listening',
        currentTranscription: '',
        error: null,
      }));

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;

      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Set maximum recording duration
      recordingTimeoutRef.current = setTimeout(() => {
        stopListening();
      }, maxRecordingDuration);

    } catch (error) {
      console.error('Error starting recording:', error);
      setState(prev => ({
        ...prev,
        isListening: false,
        voiceState: 'idle',
        error: 'Failed to start recording',
      }));
    }
  }, [state.audioPermission, enableHaptics, maxRecordingDuration]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      setState(prev => ({
        ...prev,
        isListening: false,
        voiceState: 'processing',
        isProcessing: true,
      }));

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        setState(prev => ({ ...prev, recordingUri: uri }));
        
        // Process the recording
        const transcription = await processVoiceInput(uri);
        if (transcription) {
          setState(prev => ({
            ...prev,
            currentTranscription: transcription,
            isProcessing: false,
            // Keep in processing state - will transition to speaking when AI responds
            voiceState: 'processing',
          }));
          
          if (onTranscriptionComplete) {
            onTranscriptionComplete(transcription);
          }
        }
      }

      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

    } catch (error) {
      console.error('Error stopping recording:', error);
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false,
        voiceState: 'idle',
        error: 'Failed to stop recording',
      }));
    }
  }, [enableHaptics, onTranscriptionComplete]);

  // Toggle listening
  const toggleListening = useCallback(async () => {
    if (state.isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Process voice input using OpenAI Whisper
  const processVoiceInput = useCallback(async (audioUri: string): Promise<string> => {
    if (!whisperApiKey) {
      const error = 'OpenAI API key not configured';
      setState(prev => ({ ...prev, error }));
      if (onError) onError(error);
      return '';
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'text');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whisperApiKey}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const transcription = await response.text();
      
      // Clean up the audio file
      try {
        await FileSystem.deleteAsync(audioUri, { idempotent: true });
      } catch (error) {
        console.warn('Failed to delete audio file:', error);
      }

      return transcription.trim();

    } catch (error) {
      console.error('Error processing voice input:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process voice input';
      setState(prev => ({ ...prev, error: errorMessage }));
      if (onError) onError(errorMessage);
      return '';
    }
  }, [whisperApiKey, onError]);

  // Speak response using OpenAI TTS
  const speakResponse = useCallback(async (text: string): Promise<void> => {
    if (!ttsApiKey) {
      const error = 'OpenAI API key not configured';
      setState(prev => ({ ...prev, error }));
      if (onError) onError(error);
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isSpeaking: true,
        voiceState: 'speaking',
        currentResponse: text,
      }));

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ttsApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
      
      // Save audio to file
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      await FileSystem.writeAsStringAsync(audioUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      
      soundRef.current = sound;

      // Set up playback status listener
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setState(prev => ({
            ...prev,
            isSpeaking: false,
            voiceState: 'idle',
            currentResponse: '',
          }));
          
          // Clean up
          sound.unloadAsync();
          FileSystem.deleteAsync(audioUri, { idempotent: true });
          soundRef.current = null;
        }
      });

    } catch (error) {
      console.error('Error speaking response:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to speak response';
      setState(prev => ({
        ...prev,
        isSpeaking: false,
        voiceState: 'idle',
        currentResponse: '',
        error: errorMessage,
      }));
      if (onError) onError(errorMessage);
    }
  }, [ttsApiKey, onError]);

  // Stop speaking
  const stopSpeaking = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (error) {
        console.error('Error stopping speech:', error);
      }
    }

    setState(prev => ({
      ...prev,
      isSpeaking: false,
      voiceState: 'idle',
      currentResponse: '',
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Set voice state (for external control)
  const setVoiceState = useCallback((newState: VoiceState) => {
    setState(prev => ({ ...prev, voiceState: newState }));
  }, []);

  // Initialize permissions on mount
  useEffect(() => {
    requestAudioPermission();
  }, [requestAudioPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, []);

  const actions: VoiceModeActions = {
    enterVoiceMode,
    exitVoiceMode,
    startListening,
    stopListening,
    toggleListening,
    processVoiceInput,
    speakResponse,
    stopSpeaking,
    clearError,
    setVoiceState,
  };

  return [state, actions];
};