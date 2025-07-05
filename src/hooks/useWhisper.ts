import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { getWhisperService, WhisperService } from '@/services/WhisperService';
import { OpenAIError } from '@/types';

interface TranscriptionProgress {
  phase: 'validating' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  bytesUploaded?: number;
  totalBytes?: number;
  estimatedTimeRemaining?: number;
}

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  processing_time?: number;
}

interface TranscriptionOptions {
  model?: 'whisper-1';
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

interface UseWhisperOptions {
  onSuccess?: (result: TranscriptionResult) => void;
  onError?: (error: OpenAIError | Error) => void;
  onProgress?: (progress: TranscriptionProgress) => void;
  autoRetry?: boolean;
  language?: string;
  includeSegments?: boolean;
}

interface UseWhisperState {
  isTranscribing: boolean;
  progress: TranscriptionProgress | null;
  error: string | null;
  lastResult: TranscriptionResult | null;
  canCancel: boolean;
}

export function useWhisper(options: UseWhisperOptions = {}) {
  const [state, setState] = useState<UseWhisperState>({
    isTranscribing: false,
    progress: null,
    error: null,
    lastResult: null,
    canCancel: false,
  });

  const serviceRef = useRef<WhisperService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize service
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      try {
        serviceRef.current = getWhisperService();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Whisper service';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw error;
      }
    }
    return serviceRef.current;
  }, []);

  // Transcribe audio file
  const transcribeAudio = useCallback(async (
    fileUri: string,
    customOptions?: Partial<TranscriptionOptions & UseWhisperOptions>
  ): Promise<TranscriptionResult | null> => {
    try {
      // Prevent multiple simultaneous transcriptions
      if (state.isTranscribing) {
        console.warn('Transcription already in progress, ignoring new request');
        return null;
      }

      // Cancel any existing transcription
      if (abortControllerRef.current) {
        console.log('Cancelling previous transcription');
        abortControllerRef.current.abort();
        // Wait a bit for the cancellation to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setState(prev => ({
        ...prev,
        isTranscribing: true,
        error: null,
        progress: { phase: 'validating', progress: 0 },
        canCancel: true,
      }));

      const service = getService();
      
      // Prepare transcription options
      const transcriptionOptions: TranscriptionOptions & { signal: AbortSignal; onProgress: (progress: TranscriptionProgress) => void } = {
        model: 'whisper-1',
        language: options.language || customOptions?.language,
        response_format: options.includeSegments || customOptions?.includeSegments ? 'verbose_json' : 'json',
        temperature: 0, // Use deterministic transcription
        signal: abortControllerRef.current.signal,
        onProgress: (progress) => {
          setState(prev => ({ ...prev, progress }));
          options.onProgress?.(progress);
          customOptions?.onProgress?.(progress);
        },
        ...customOptions,
      };

      const result = await service.transcribeAudio(fileUri, transcriptionOptions);

      setState(prev => ({
        ...prev,
        isTranscribing: false,
        lastResult: result,
        progress: { phase: 'completed', progress: 100 },
        canCancel: false,
      }));

      options.onSuccess?.(result);
      customOptions?.onSuccess?.(result);

      return result;
    } catch (error) {
      const isAborted = abortControllerRef.current?.signal.aborted;
      
      setState(prev => ({
        ...prev,
        isTranscribing: false,
        canCancel: false,
        progress: isAborted ? null : { phase: 'error', progress: 0 },
        error: isAborted ? null : (error instanceof Error ? error.message : 'Transcription failed'),
      }));

      if (!isAborted) {
        options.onError?.(error as OpenAIError | Error);
        customOptions?.onError?.(error as OpenAIError | Error);

        if (options.autoRetry !== false && customOptions?.autoRetry !== false) {
          Alert.alert(
            'Transcription Failed',
            'Would you like to try again?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => transcribeAudio(fileUri, customOptions) },
            ]
          );
        }
      }

      return null;
    }
  }, [options, getService]);

  // Cancel transcription
  const cancelTranscription = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      setState(prev => ({
        ...prev,
        isTranscribing: false,
        canCancel: false,
        progress: null,
      }));
    }
  }, []);

  // Check if file is supported
  const isSupportedFile = useCallback((filename: string): boolean => {
    try {
      const service = getService();
      return service.isSupportedFormat(filename);
    } catch (error) {
      return false;
    }
  }, [getService]);

  // Get file size limit
  const getMaxFileSize = useCallback((): number => {
    try {
      const service = getService();
      return service.getMaxFileSize();
    } catch (error) {
      return 25 * 1024 * 1024; // Default 25MB
    }
  }, [getService]);

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    try {
      const service = getService();
      return service.formatFileSize(bytes);
    } catch (error) {
      return `${Math.round(bytes / 1024)}KB`;
    }
  }, [getService]);

  // Estimate transcription time
  const estimateTranscriptionTime = useCallback((audioDurationMs: number): number => {
    try {
      const service = getService();
      return service.estimateTranscriptionTime(audioDurationMs);
    } catch (error) {
      return audioDurationMs * 0.1 + 3000; // Fallback estimate
    }
  }, [getService]);

  // Test connection
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      const service = getService();
      const isConnected = await service.testConnection();
      
      if (!isConnected) {
        setState(prev => ({ ...prev, error: 'Connection test failed' }));
      }
      
      return isConnected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [getService]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Get transcription confidence level description
  const getConfidenceDescription = useCallback((confidence?: number): string => {
    if (!confidence) return 'Unknown';
    
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Good';
    if (confidence >= 0.6) return 'Fair';
    if (confidence >= 0.5) return 'Low';
    return 'Very Low';
  }, []);

  // Format transcription duration
  const formatDuration = useCallback((durationSeconds?: number): string => {
    if (!durationSeconds) return 'Unknown';
    
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.round(durationSeconds % 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, []);

  // Extract text from segments with timestamps
  const getSegmentedText = useCallback((
    result: TranscriptionResult,
    includeTimestamps: boolean = false
  ): string => {
    if (!result.segments || result.segments.length === 0) {
      return result.text;
    }

    return result.segments
      .map(segment => {
        if (includeTimestamps) {
          const start = Math.round(segment.start);
          const end = Math.round(segment.end);
          return `[${start}s-${end}s] ${segment.text}`;
        }
        return segment.text;
      })
      .join(' ');
  }, []);

  return {
    // State
    isTranscribing: state.isTranscribing,
    progress: state.progress,
    error: state.error,
    lastResult: state.lastResult,
    canCancel: state.canCancel,

    // Actions
    transcribeAudio,
    cancelTranscription,
    clearError,
    testConnection,

    // Utilities
    isSupportedFile,
    getMaxFileSize,
    formatFileSize,
    estimateTranscriptionTime,
    getConfidenceDescription,
    formatDuration,
    getSegmentedText,

    // Progress info
    currentPhase: state.progress?.phase,
    uploadProgress: state.progress?.progress || 0,
    bytesUploaded: state.progress?.bytesUploaded,
    totalBytes: state.progress?.totalBytes,
    estimatedTimeRemaining: state.progress?.estimatedTimeRemaining,
  };
}