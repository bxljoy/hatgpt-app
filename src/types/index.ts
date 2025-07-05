// Message Types
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  audioUrl?: string;
  isLoading?: boolean;
  error?: string;
  tokenCount?: number;
}

export interface Conversation {
  id: string;
  messages: Message[];
  title: string;
  createdAt: Date;
  updatedAt: Date;
  isArchived?: boolean;
  totalTokens?: number;
  lastActivity: Date;
}

// OpenAI API Types
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  stream?: boolean;
  user?: string;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIWhisperRequest {
  file: File | Blob;
  model: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  language?: string;
}

export interface OpenAIWhisperResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: {
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }[];
}

export interface OpenAITTSRequest {
  model: 'tts-1' | 'tts-1-hd';
  input: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac';
  speed?: number;
}

export interface OpenAIError {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}

// Audio Recording Types
export interface AudioRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  recordingUri: string | null;
  duration: number;
  error: string | null;
  isPaused: boolean;
  recordingStatus: 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'error';
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  playbackStatus: 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';
}

// App State Management Types
export interface AppState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  settings: AppSettings;
  audioRecording: AudioRecordingState;
  audioPlayback: AudioPlaybackState;
  isLoading: boolean;
  error: string | null;
  networkStatus: 'online' | 'offline';
}

export interface AppSettings {
  openaiApiKey: string;
  voiceType: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  autoPlayAudio: boolean;
  speechRate: number;
  model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-4o';
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  theme: 'light' | 'dark' | 'system';
  hapticFeedback: boolean;
  saveAudioFiles: boolean;
  audioQuality: 'standard' | 'hd';
}

// Action Types for State Management
export type AppAction =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: Conversation | null }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageId: string; updates: Partial<Message> } }
  | { type: 'DELETE_MESSAGE'; payload: { conversationId: string; messageId: string } }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_AUDIO_RECORDING'; payload: Partial<AudioRecordingState> }
  | { type: 'SET_AUDIO_PLAYBACK'; payload: Partial<AudioPlaybackState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_NETWORK_STATUS'; payload: 'online' | 'offline' }
  | { type: 'RESET_APP_STATE' };

// Storage Types
export interface StorageConversation {
  id: string;
  messages: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    audioUrl?: string;
    tokenCount?: number;
  }[];
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  totalTokens?: number;
  lastActivity: string;
}

export interface StorageSettings {
  openaiApiKey: string;
  voiceType: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  autoPlayAudio: boolean;
  speechRate: number;
  model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-4o';
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  theme: 'light' | 'dark' | 'system';
  hapticFeedback: boolean;
  saveAudioFiles: boolean;
  audioQuality: 'standard' | 'hd';
}

// Navigation Types
export type RootStackParamList = {
  ConversationList: undefined;
  Chat: { conversationId?: string };
  Settings: undefined;
  ConversationDetail: { conversationId: string };
};

// Utility Types
export type MessageRole = 'user' | 'assistant' | 'system';
export type VoiceType = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type ModelType = 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-4o';
export type ThemeType = 'light' | 'dark' | 'system';
export type AudioQualityType = 'standard' | 'hd';
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'error';
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';
export type NetworkStatus = 'online' | 'offline';