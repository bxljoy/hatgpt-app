// Voice Input Components
export { VoiceRecordButton } from '../VoiceRecordButton';
export { VoiceRecordButtonAdvanced } from '../VoiceRecordButtonAdvanced';
export { VoiceInputModal } from '../VoiceInputModal';

// Audio Visualization Components
export { AudioWaveform, WaveformPresets } from '../AudioWaveform';
export { RecordingTimer, TimerPresets } from '../RecordingTimer';

// State Components
export { AudioProcessingLoader, LoaderPresets } from '../AudioProcessingLoader';
export { VoiceErrorState, ErrorPresets } from '../VoiceErrorState';

// Legacy Components (for backward compatibility)
export { VoiceRecorder } from '../VoiceRecorder';
export { MessageBubble } from '../MessageBubble';
export { ChatInput } from '../ChatInput';

// Hooks
export { useAudioRecorder } from '../../hooks/useAudioRecorder';

// Types
export type {
  AudioRecordingState,
  RecordingStatus,
  PlaybackStatus,
} from '../../types';