import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AudioRecordingState, RecordingStatus } from '@/types';

interface AudioRecorderConfig {
  maxDuration?: number; // in milliseconds
  maxFileSize?: number; // in bytes (default 10MB)
  quality?: 'low' | 'medium' | 'high';
  onDurationUpdate?: (duration: number) => void;
  onFileSizeUpdate?: (size: number) => void;
  onRecordingComplete?: (uri: string, duration: number, size: number) => void;
  onError?: (error: string) => void;
}

interface AudioFileInfo {
  uri: string;
  duration: number;
  size: number;
  exists: boolean;
}

const DEFAULT_CONFIG: Required<AudioRecorderConfig> = {
  maxDuration: 300000, // 5 minutes
  maxFileSize: 10 * 1024 * 1024, // 10MB
  quality: 'medium',
  onDurationUpdate: () => {},
  onFileSizeUpdate: () => {},
  onRecordingComplete: () => {},
  onError: () => {},
};

export function useAudioRecorder(config: AudioRecorderConfig = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    isProcessing: false,
    recordingUri: null,
    duration: 0,
    error: null,
    isPaused: false,
    recordingStatus: 'idle',
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileSizeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Audio recording configuration
  const getRecordingOptions = useCallback(() => {
    const baseOptions = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: fullConfig.quality === 'high' ? 256000 : fullConfig.quality === 'low' ? 64000 : 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.MAX,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: fullConfig.quality === 'high' ? 256000 : fullConfig.quality === 'low' ? 64000 : 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {},
    };

    return baseOptions;
  }, [fullConfig.quality]);

  // Handle permission errors
  const handlePermissionError = useCallback((error: any) => {
    const errorMessage = 'Audio recording permission is required to use voice features.';
    setState(prev => ({ ...prev, error: errorMessage, recordingStatus: 'error' }));
    fullConfig.onError(errorMessage);
    
    Alert.alert(
      'Permission Required',
      'Please grant microphone access in Settings to use voice recording.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => {
          if (Platform.OS === 'ios') {
            // On iOS, we can't directly open settings, but we can show instructions
            Alert.alert(
              'Enable Microphone Access',
              'Go to Settings > Privacy & Security > Microphone > HatGPT App and enable microphone access.',
            );
          }
        }},
      ]
    );
  }, [fullConfig]);

  // Set up audio mode for recording
  const setupAudioMode = useCallback(async (): Promise<void> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.warn('Failed to set audio mode:', error);
    }
  }, []);

  // Generate unique filename for recording
  const generateRecordingFilename = useCallback((): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `recording_${timestamp}_${random}.m4a`;
  }, []);

  // Get file info
  const getFileInfo = useCallback(async (uri: string): Promise<AudioFileInfo | null> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        return { uri, duration: 0, size: 0, exists: false };
      }
      
      return {
        uri,
        duration: state.duration,
        size: fileInfo.size || 0,
        exists: true,
      };
    } catch (error) {
      console.error('Failed to get file info:', error);
      return null;
    }
  }, [state.duration]);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    
    durationTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setState(prev => ({ ...prev, duration: elapsed }));
      fullConfig.onDurationUpdate(elapsed);
      
      // Check max duration
      if (elapsed >= fullConfig.maxDuration) {
        stopRecording();
      }
    }, 100);
  }, [fullConfig]);

  // Start file size monitoring
  const startFileSizeMonitoring = useCallback((uri: string) => {
    fileSizeTimerRef.current = setInterval(async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        const size = 'size' in fileInfo ? fileInfo.size : 0;
        
        fullConfig.onFileSizeUpdate(size);
        
        // Check max file size
        if (size >= fullConfig.maxFileSize) {
          stopRecording();
        }
      } catch (error) {
        console.warn('Failed to check file size:', error);
      }
    }, 1000);
  }, [fullConfig]);

  // Clear timers
  const clearTimers = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    
    if (fileSizeTimerRef.current) {
      clearInterval(fileSizeTimerRef.current);
      fileSizeTimerRef.current = null;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null, recordingStatus: 'processing' }));
      
      // Setup audio mode
      await setupAudioMode();
      
      // Stop any existing recording
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      
      // Generate filename
      const filename = generateRecordingFilename();
      const uri = `${FileSystem.documentDirectory}${filename}`;
      
      // Create new recording - this will request permissions if needed
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(getRecordingOptions());
      recordingRef.current = recording;
      
      // Start recording
      await recording.startAsync();
      
      // Update state
      setState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        recordingUri: uri,
        duration: 0,
        isPaused: false,
        recordingStatus: 'recording',
        error: null,
      }));
      
      // Start timers
      startDurationTimer();
      startFileSizeMonitoring(uri);
      
      return true;
    } catch (error) {
      // Check if this is a permission error
      const errorString = error?.toString() || '';
      if (errorString.includes('permission') || errorString.includes('denied') || errorString.includes('authorized')) {
        handlePermissionError(error);
      } else {
        const errorMessage = `Failed to start recording: ${error}`;
        setState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          recordingStatus: 'error',
          error: errorMessage,
        }));
        fullConfig.onError(errorMessage);
      }
      clearTimers();
      return false;
    }
  }, [setupAudioMode, getRecordingOptions, generateRecordingFilename, startDurationTimer, startFileSizeMonitoring, clearTimers, fullConfig, handlePermissionError]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, recordingStatus: 'processing' }));
      
      if (!recordingRef.current) {
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          isProcessing: false, 
          recordingStatus: 'idle' 
        }));
        return null;
      }
      
      // Stop recording
      const status = await recordingRef.current.stopAndUnloadAsync();
      const finalUri = status.uri || state.recordingUri || '';
      recordingRef.current = null;
      
      // Clear timers
      clearTimers();
      
      // Get final file info
      const fileInfo = finalUri ? await getFileInfo(finalUri) : null;
      
      if (fileInfo && fileInfo.exists) {
        fullConfig.onRecordingComplete(finalUri, state.duration, fileInfo.size);
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          recordingStatus: 'completed',
          recordingUri: finalUri,
        }));
        
        return finalUri;
      } else {
        throw new Error('Recording file not found');
      }
    } catch (error) {
      const errorMessage = `Failed to stop recording: ${error}`;
      setState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        recordingStatus: 'error',
        error: errorMessage,
      }));
      fullConfig.onError(errorMessage);
      clearTimers();
      return null;
    }
  }, [clearTimers, state.recordingUri, state.duration, getFileInfo, fullConfig]);

  // Pause recording
  const pauseRecording = useCallback(async (): Promise<boolean> => {
    try {
      if (!recordingRef.current || !state.isRecording) {
        return false;
      }
      
      await recordingRef.current.pauseAsync();
      clearTimers();
      
      setState(prev => ({
        ...prev,
        isPaused: true,
        recordingStatus: 'paused',
      }));
      
      return true;
    } catch (error) {
      const errorMessage = `Failed to pause recording: ${error}`;
      setState(prev => ({ ...prev, error: errorMessage }));
      fullConfig.onError(errorMessage);
      return false;
    }
  }, [state.isRecording, clearTimers, fullConfig]);

  // Resume recording
  const resumeRecording = useCallback(async (): Promise<boolean> => {
    try {
      if (!recordingRef.current || !state.isPaused) {
        return false;
      }
      
      await recordingRef.current.startAsync();
      
      setState(prev => ({
        ...prev,
        isPaused: false,
        recordingStatus: 'recording',
      }));
      
      // Restart timers
      startDurationTimer();
      if (state.recordingUri) {
        startFileSizeMonitoring(state.recordingUri);
      }
      
      return true;
    } catch (error) {
      const errorMessage = `Failed to resume recording: ${error}`;
      setState(prev => ({ ...prev, error: errorMessage }));
      fullConfig.onError(errorMessage);
      return false;
    }
  }, [state.isPaused, state.recordingUri, startDurationTimer, startFileSizeMonitoring, fullConfig]);

  // Cancel recording
  const cancelRecording = useCallback(async (): Promise<void> => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      
      clearTimers();
      
      // Delete the recording file if it exists
      if (state.recordingUri) {
        try {
          await FileSystem.deleteAsync(state.recordingUri, { idempotent: true });
        } catch (deleteError) {
          console.warn('Failed to delete recording file:', deleteError);
        }
      }
      
      setState({
        isRecording: false,
        isProcessing: false,
        recordingUri: null,
        duration: 0,
        error: null,
        isPaused: false,
        recordingStatus: 'idle',
      });
    } catch (error) {
      const errorMessage = `Failed to cancel recording: ${error}`;
      setState(prev => ({ ...prev, error: errorMessage, recordingStatus: 'error' }));
      fullConfig.onError(errorMessage);
    }
  }, [state.recordingUri, clearTimers, fullConfig]);

  // Delete recording file
  const deleteRecording = useCallback(async (uri?: string): Promise<boolean> => {
    try {
      const fileUri = uri || state.recordingUri;
      if (!fileUri) {
        return false;
      }
      
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      
      if (fileUri === state.recordingUri) {
        setState(prev => ({ ...prev, recordingUri: null }));
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to delete recording:', error);
      return false;
    }
  }, [state.recordingUri]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.warn);
      }
    };
  }, [clearTimers]);

  // Format duration for display
  const formatDuration = useCallback((duration: number): string => {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const milliseconds = Math.floor((duration % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }, []);

  // Format file size for display
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    deleteRecording,
    
    // Utilities
    formatDuration,
    formatFileSize,
    getFileInfo,
    
    // Info
    canRecord: !state.isRecording && !state.isProcessing,
    canStop: state.isRecording || state.isPaused,
    canPause: state.isRecording && !state.isPaused,
    canResume: state.isPaused,
    
    // Progress
    durationFormatted: formatDuration(state.duration),
    maxDurationFormatted: formatDuration(fullConfig.maxDuration),
    progressPercentage: (state.duration / fullConfig.maxDuration) * 100,
  };
}