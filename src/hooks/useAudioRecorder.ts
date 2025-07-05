import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AudioRecordingState, RecordingStatus } from '@/types';

// Track recording state globally to prevent conflicts
let globalRecordingInProgress = false;

// Function to force unload any audio recordings
const forceUnloadAudio = async (): Promise<void> => {
  try {
    // Reset audio mode completely
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.warn('Error forcing audio unload:', error);
  }
};

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
    // Try the simplest possible configuration that's known to work
    return Audio.RecordingOptionsPresets.HIGH_QUALITY;
  }, []);

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
      console.log('Requesting audio permissions...');
      const permissionResponse = await Audio.requestPermissionsAsync();
      console.log('Permission response:', permissionResponse);
      
      if (permissionResponse.status !== 'granted') {
        throw new Error('Audio recording permission not granted');
      }
      
      console.log('Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('Audio mode set successfully');
    } catch (error) {
      console.error('Failed to set audio mode:', error);
      throw error;
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

  // Start file size monitoring (disabled during recording since we don't have URI yet)
  const startFileSizeMonitoring = useCallback((uri: string) => {
    if (!uri) return; // Skip if no URI available
    
    fileSizeTimerRef.current = setInterval(async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        const size = (fileInfo as any).size || 0;
        
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
      // Prevent multiple simultaneous recordings
      if (globalRecordingInProgress) {
        throw new Error('Recording already in progress');
      }
      
      setState(prev => ({ ...prev, isProcessing: true, error: null, recordingStatus: 'processing' }));
      globalRecordingInProgress = true;
      
      // Force complete audio cleanup
      await forceUnloadAudio();
      
      // Ensure any existing recording is cleaned up
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.warn('Error cleaning up existing recording:', cleanupError);
        }
        recordingRef.current = null;
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Setup audio mode fresh
      await setupAudioMode();
      
      // Create new recording instance
      const recording = new Audio.Recording();
      
      try {
        // Let Expo choose the location - don't specify custom URI
        const recordingOptions = getRecordingOptions();
        console.log('Preparing recording without custom URI:', recordingOptions);
        await recording.prepareToRecordAsync(recordingOptions);
        recordingRef.current = recording;
        
        console.log('Starting recording...');
        const startStatus = await recording.startAsync();
        console.log('Recording start status:', JSON.stringify(startStatus, null, 2));
        
        // Update state without URI (will be set when recording stops)
        setState(prev => ({
          ...prev,
          isRecording: true,
          isProcessing: false,
          recordingUri: null, // Will be set when recording stops
          duration: 0,
          isPaused: false,
          recordingStatus: 'recording',
          error: null,
        }));
        
        // Start timers
        startDurationTimer();
        // Don't monitor file size since we don't have URI yet
        
        return true;
      } catch (error) {
        // Clean up on any error
        console.error('Failed to start recording:', error);
        recordingRef.current = null;
        throw error;
      }
    } catch (error) {
      globalRecordingInProgress = false;
      
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
      recordingRef.current = null;
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
      
      // Check recording status before stopping
      const statusBeforeStop = await recordingRef.current.getStatusAsync();
      console.log('Status before stopping:', JSON.stringify(statusBeforeStop, null, 2));
      
      // Check minimum recording duration (at least 1000ms)
      if (state.duration < 1000) {
        console.warn(`Recording too short: ${state.duration}ms. Waiting a bit longer...`);
        await new Promise(resolve => setTimeout(resolve, 1500 - state.duration));
      }
      
      // Get the URI BEFORE stopping (expo-av bug workaround)
      let recordingUri: string | null = null;
      try {
        const recording = recordingRef.current;
        // Try to get the URI from the recording object directly
        recordingUri = (recording as any)._uri || (recording as any).uri;
        console.log('URI from recording object:', recordingUri);
      } catch (error) {
        console.warn('Could not get URI from recording object:', error);
      }
      
      // Stop recording
      console.log('Stopping recording...');
      const status = await recordingRef.current.stopAndUnloadAsync();
      console.log('Recording stop status:', JSON.stringify(status, null, 2));
      
      recordingRef.current = null;
      globalRecordingInProgress = false;
      
      // Clear timers
      clearTimers();
      
      // Determine final URI (prefer status.uri, fall back to extracted URI)
      let finalUri = status.uri || recordingUri;
      
      if (!finalUri) {
        // Last resort: try to find the recording file in possible locations
        const searchPaths = [
          `${FileSystem.documentDirectory}AV/`,
          `${FileSystem.cacheDirectory}AV/`,
          FileSystem.documentDirectory!,
          FileSystem.cacheDirectory!,
        ];
        
        for (const searchPath of searchPaths) {
          try {
            console.log(`Searching in: ${searchPath}`);
            const files = await FileSystem.readDirectoryAsync(searchPath);
            console.log(`Files found: ${files.join(', ')}`);
            
            // Find .m4a files
            const audioFiles = files.filter(f => f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.wav'));
            if (audioFiles.length > 0) {
              // Get the most recent audio file
              finalUri = `${searchPath}${audioFiles[audioFiles.length - 1]}`;
              console.log(`Found recording file: ${finalUri}`);
              break;
            }
          } catch (searchError) {
            console.warn(`Could not search in ${searchPath}:`, searchError);
          }
        }
      }
      
      if (!finalUri) {
        throw new Error('No recording URI found. Recording may have failed to save.');
      }
      
      console.log(`Using final URI: ${finalUri}`);
      
      // Helper to wait for file to be written with exponential backoff
      const waitForFile = async (uri: string, maxAttempts = 5, initialDelay = 200): Promise<boolean> => {
        let delay = initialDelay;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            console.log(`Attempt ${attempt + 1}: File exists: ${fileInfo.exists}, Size: ${(fileInfo as any).size || 0}, URI: ${uri}`);
            if (fileInfo.exists && (fileInfo as any).size && (fileInfo as any).size > 0) {
              return true;
            }
          } catch (error) {
            console.warn(`Error checking file on attempt ${attempt + 1}:`, error);
          }
          // Wait with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // Increase delay each attempt
        }
        return false;
      };

      // Wait for file to be written
      const fileIsValid = await waitForFile(finalUri);
      if (!fileIsValid) {
        // Try to get file info one more time for debugging
        try {
          const debugInfo = await FileSystem.getInfoAsync(finalUri);
          console.warn(`Final file check - exists: ${debugInfo.exists}, size: ${(debugInfo as any).size || 0}`);
        } catch (debugError) {
          console.warn('Error getting debug file info:', debugError);
        }
        
        // Don't throw error immediately, try to proceed anyway
        console.warn(`Recording file not immediately available: ${finalUri}`);
      }
      
      // Get final file info
      const fileInfo = await getFileInfo(finalUri);
      
      if (fileInfo && fileInfo.exists && fileInfo.size > 0) {
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
        // File doesn't exist or is empty, but still try to return URI for debugging
        console.warn(`Recording file not found or empty, but returning URI anyway: ${finalUri}`);
        
        // Call completion callback with minimal data
        fullConfig.onRecordingComplete(finalUri, state.duration, 0);
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          recordingStatus: 'error',
          recordingUri: finalUri,
          error: 'Recording file not saved properly',
        }));
        
        // Return URI anyway so the caller can handle the error
        return finalUri;
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
      globalRecordingInProgress = false;
      
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
        recordingRef.current = null;
      }
      globalRecordingInProgress = false;
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
