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
  imageUrl?: string;
  imageBase64?: string;
  metadata?: {
    inputType?: 'voice' | 'text' | 'image';
    model?: string;
    processingTime?: number;
    audioSettings?: {
      voice?: VoiceType;
      speed?: number;
      quality?: AudioQualityType;
    };
    imageSettings?: {
      originalSize?: { width: number; height: number };
      compressedSize?: { width: number; height: number };
      fileSize?: number;
      format?: string;
    };
  };
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
  messageCount?: number;
  tags?: string[];
  isStarred?: boolean;
  summary?: string;
  statistics?: ConversationStatistics;
}

// OpenAI API Types
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
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
  // API Settings
  openaiApiKey: string;
  model: 'gpt-4o';
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  apiTimeout: number;
  
  // Voice Settings
  voiceType: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speechRate: number;
  voicePitch: number;
  voiceVolume: number;
  autoPlayAudio: boolean;
  autoStopAudio: boolean;
  
  // Audio Settings
  audioQuality: 'standard' | 'hd';
  recordingQuality: 'low' | 'medium' | 'high';
  saveAudioFiles: boolean;
  autoDeleteAudio: boolean;
  audioFileRetentionDays: number;
  maxRecordingDuration: number;
  backgroundAudioEnabled: boolean;
  
  // App Appearance
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  colorScheme: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  compactMode: boolean;
  showTimestamps: boolean;
  animationsEnabled: boolean;
  
  // Interaction Settings
  hapticFeedback: boolean;
  soundEffects: boolean;
  confirmDeletions: boolean;
  autoSaveConversations: boolean;
  swipeActions: boolean;
  
  // Privacy Settings
  analytics: boolean;
  crashReporting: boolean;
  dataCollection: boolean;
  biometricLock: boolean;
  autoLockTimeout: number;
  
  // Backup Settings
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  cloudBackupEnabled: boolean;
  backupIncludeAudio: boolean;
  
  // Accessibility
  voiceOverEnabled: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  
  // Developer Settings
  debugMode: boolean;
  showPerformanceMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
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
    imageUrl?: string;
    imageBase64?: string;
    tokenCount?: number;
    metadata?: {
      inputType?: 'voice' | 'text' | 'image';
      model?: string;
      processingTime?: number;
      audioSettings?: {
        voice?: VoiceType;
        speed?: number;
        quality?: AudioQualityType;
      };
      imageSettings?: {
        originalSize?: { width: number; height: number };
        compressedSize?: { width: number; height: number };
        fileSize?: number;
        format?: string;
      };
    };
  }[];
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  totalTokens?: number;
  lastActivity: string;
  messageCount?: number;
  tags?: string[];
  isStarred?: boolean;
  summary?: string;
  statistics?: ConversationStatistics;
}

export interface ConversationStatistics {
  totalCharacters: number;
  totalWords: number;
  voiceInputCount: number;
  textInputCount: number;
  averageResponseTime: number;
  modelsUsed: string[];
  voicesUsed: VoiceType[];
  totalDuration: number;
  audioFileCount: number;
  audioFileSizes: number;
}

export interface ConversationSearchFilters {
  query?: string;
  isArchived?: boolean;
  isStarred?: boolean;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  messageCountRange?: {
    min: number;
    max: number;
  };
  sortBy?: 'createdAt' | 'updatedAt' | 'lastActivity' | 'messageCount' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ConversationBackup {
  version: string;
  exportDate: string;
  conversations: StorageConversation[];
  settings: StorageSettings;
  metadata: {
    totalConversations: number;
    totalMessages: number;
    backupSize: number;
    appVersion: string;
  };
}

export interface StorageSettings {
  openaiApiKey: string;
  voiceType: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  autoPlayAudio: boolean;
  speechRate: number;
  model: 'gpt-4o';
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
export type ModelType = 'gpt-4o';
export type ThemeType = 'light' | 'dark' | 'system';
export type AudioQualityType = 'standard' | 'hd';
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'error';
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';
export type NetworkStatus = 'online' | 'offline';