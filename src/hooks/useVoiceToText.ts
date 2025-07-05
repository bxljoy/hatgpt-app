import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAudioRecorder } from './useAudioRecorder';
import { useWhisper } from './useWhisper';
import { OpenAIError } from '@/types';

export type VoiceToTextState = 
  | 'idle'
  | 'recording'
  | 'processing'
  | 'transcribing'
  | 'editing'
  | 'completed'
  | 'error'
  | 'cancelled';

interface VoiceToTextProgress {
  state: VoiceToTextState;
  recordingDuration?: number;
  transcriptionProgress?: number;
  transcriptionPhase?: 'validating' | 'uploading' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface VoiceToTextResult {
  text: string;
  originalText: string;
  confidence?: number;
  language?: string;
  duration?: number;
  recordingUri?: string;
}

interface VoiceToTextOptions {
  maxRecordingDuration?: number;
  recordingQuality?: 'low' | 'medium' | 'high';
  language?: string;
  autoStartTranscription?: boolean;
  autoCompleteOnTranscription?: boolean;
  enableTextEditing?: boolean;
  onStateChange?: (progress: VoiceToTextProgress) => void;
  onResult?: (result: VoiceToTextResult) => void;
  onError?: (error: string, state: VoiceToTextState) => void;
  onCancel?: (state: VoiceToTextState) => void;
}

interface UseVoiceToTextReturn {
  // State
  state: VoiceToTextState;
  progress: VoiceToTextProgress;
  result: VoiceToTextResult | null;
  error: string | null;
  canCancel: boolean;
  canRetry: boolean;
  
  // Recording controls
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  
  // Transcription controls
  startTranscription: () => Promise<void>;
  retryTranscription: () => Promise<void>;
  
  // Text editing
  updateText: (text: string) => void;
  confirmText: () => void;
  
  // General controls
  cancel: () => void;
  reset: () => void;
  
  // Utility functions
  formatDuration: (ms: number) => string;
  getStateMessage: () => string;
  isProcessing: boolean;
}

export function useVoiceToText(options: VoiceToTextOptions = {}): UseVoiceToTextReturn {
  const {
    maxRecordingDuration = 300000, // 5 minutes
    recordingQuality = 'medium',
    language,
    autoStartTranscription = true,
    autoCompleteOnTranscription = false,
    enableTextEditing = true,
    onStateChange,
    onResult,
    onError,
    onCancel,
  } = options;

  // State management
  const [state, setState] = useState<VoiceToTextState>('idle');
  const [result, setResult] = useState<VoiceToTextResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editableText, setEditableText] = useState<string>('');
  
  const recordingUriRef = useRef<string | null>(null);
  const recordingDurationRef = useRef<number>(0);

  // Audio recording hook
  const {
    isRecording,
    isProcessing: isRecordingProcessing,
    duration: recordingDuration,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    formatDuration,
  } = useAudioRecorder({
    maxDuration: maxRecordingDuration,
    quality: recordingQuality,
    onRecordingComplete: (uri, duration) => {
      recordingUriRef.current = uri;
      recordingDurationRef.current = duration;
      handleRecordingComplete(uri, duration);
    },
    onError: (errorMessage) => {
      handleError(errorMessage, 'recording');
    },
  });

  // Whisper transcription hook
  const {
    isTranscribing,
    progress: whisperProgress,
    error: whisperError,
    transcribeAudio,
    cancelTranscription,
    clearError: clearWhisperError,
  } = useWhisper({
    language,
    includeSegments: true,
    autoRetry: false, // We'll handle retries manually
    onSuccess: (transcriptionResult) => {
      handleTranscriptionComplete(transcriptionResult);
    },
    onError: (transcriptionError) => {
      const errorMessage = transcriptionError instanceof Error 
        ? transcriptionError.message 
        : 'Transcription failed';
      handleError(errorMessage, 'transcribing');
    },
  });

  // Create progress object
  const progress: VoiceToTextProgress = {
    state,
    recordingDuration: isRecording ? recordingDuration : recordingDurationRef.current,
    transcriptionProgress: whisperProgress?.progress,
    transcriptionPhase: whisperProgress?.phase,
    message: getStateMessage(),
  };

  // Notify state changes
  useEffect(() => {
    onStateChange?.(progress);
  }, [state, recordingDuration, whisperProgress?.progress, whisperProgress?.phase]);

  // Handle recording completion
  const handleRecordingComplete = useCallback(async (uri: string, duration: number) => {
    setState('processing');
    
    if (autoStartTranscription) {
      setTimeout(() => {
        handleStartTranscription();
      }, 500); // Small delay for UI feedback
    } else {
      setState('completed');
    }
  }, [autoStartTranscription]);

  // Handle transcription completion
  const handleTranscriptionComplete = useCallback((transcriptionResult: any) => {
    const newResult: VoiceToTextResult = {
      text: transcriptionResult.text,
      originalText: transcriptionResult.text,
      confidence: transcriptionResult.confidence,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
      recordingUri: recordingUriRef.current || undefined,
    };

    setResult(newResult);
    setEditableText(transcriptionResult.text);
    clearError();

    if (autoCompleteOnTranscription || !enableTextEditing) {
      setState('completed');
      onResult?.(newResult);
    } else {
      setState('editing');
    }
  }, [autoCompleteOnTranscription, enableTextEditing, onResult]);

  // Handle errors
  const handleError = useCallback((errorMessage: string, errorState: VoiceToTextState) => {
    setError(errorMessage);
    setState('error');
    onError?.(errorMessage, errorState);
  }, [onError]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
    clearWhisperError();
  }, [clearWhisperError]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      clearError();
      setState('recording');
      await startAudioRecording();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      handleError(errorMessage, 'recording');
    }
  }, [startAudioRecording, clearError, handleError]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      setState('processing');
      const recordingUri = await stopAudioRecording();
      
      // If recording was successful and we have a URI, store it
      // Note: handleRecordingComplete will be called via onRecordingComplete callback
      // and will handle starting transcription, so we don't need to do it here
      if (recordingUri) {
        recordingUriRef.current = recordingUri;
        // Let handleRecordingComplete handle the next steps via onRecordingComplete callback
      } else {
        // If no URI returned, there was likely an issue with the recording
        throw new Error('Recording failed to save properly');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      handleError(errorMessage, 'recording');
      // Reset to idle state on error
      setState('idle');
    }
  }, [stopAudioRecording, handleError]);

  // Start transcription
  const handleStartTranscription = useCallback(async () => {
    if (!recordingUriRef.current) {
      handleError('No recording available for transcription', 'transcribing');
      return;
    }

    try {
      clearError();
      setState('transcribing');
      await transcribeAudio(recordingUriRef.current);
    } catch (error) {
      // Error handled by useWhisper hook
    }
  }, [transcribeAudio, clearError, handleError]);

  const startTranscription = useCallback(() => {
    return handleStartTranscription();
  }, [handleStartTranscription]);

  // Retry transcription
  const retryTranscription = useCallback(async () => {
    if (!recordingUriRef.current) {
      handleError('No recording available for retry', 'transcribing');
      return;
    }

    await handleStartTranscription();
  }, [handleStartTranscription, handleError]);

  // Update editable text
  const updateText = useCallback((text: string) => {
    setEditableText(text);
    if (result) {
      setResult({ ...result, text });
    }
  }, [result]);

  // Confirm edited text
  const confirmText = useCallback(() => {
    if (result) {
      const finalResult = { ...result, text: editableText };
      setResult(finalResult);
      setState('completed');
      onResult?.(finalResult);
    }
  }, [result, editableText, onResult]);

  // Cancel operation
  const cancel = useCallback(() => {
    const currentState = state;
    
    if (isRecording) {
      stopAudioRecording().catch(() => {
        // Ignore errors when cancelling
      });
    }
    
    if (isTranscribing) {
      cancelTranscription();
    }
    
    setState('cancelled');
    onCancel?.(currentState);
  }, [state, isRecording, isTranscribing, stopAudioRecording, cancelTranscription, onCancel]);

  // Reset to initial state
  const reset = useCallback(() => {
    if (isRecording || isTranscribing) {
      cancel();
    }
    
    setState('idle');
    setResult(null);
    setError(null);
    setEditableText('');
    recordingUriRef.current = null;
    recordingDurationRef.current = 0;
    clearError();
  }, [isRecording, isTranscribing, cancel, clearError]);

  // Get state message
  function getStateMessage(): string {
    switch (state) {
      case 'idle':
        return 'Tap to record';
      case 'recording':
        return 'Recording...';
      case 'processing':
        return 'Processing...';
      case 'transcribing':
        return 'Processing...';
      case 'editing':
        return 'Edit and confirm';
      case 'completed':
        return 'Complete';
      case 'error':
        return 'Error occurred';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  }

  // Computed properties
  const canCancel = state !== 'idle' && state !== 'completed' && state !== 'cancelled';
  const canRetry = state === 'error' && recordingUriRef.current !== null;
  const isProcessing = isRecording || isRecordingProcessing || isTranscribing || 
                      state === 'processing' || state === 'transcribing';

  return {
    // State
    state,
    progress,
    result,
    error,
    canCancel,
    canRetry,
    
    // Recording controls
    startRecording,
    stopRecording,
    
    // Transcription controls
    startTranscription,
    retryTranscription,
    
    // Text editing
    updateText,
    confirmText,
    
    // General controls
    cancel,
    reset,
    
    // Utility functions
    formatDuration,
    getStateMessage,
    isProcessing,
  };
}