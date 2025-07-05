// Error Types and Classifications
export enum ErrorType {
  // Network Errors
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_SLOW = 'NETWORK_SLOW',
  
  // API Errors
  API_INVALID_KEY = 'API_INVALID_KEY',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  API_INSUFFICIENT_FUNDS = 'API_INSUFFICIENT_FUNDS',
  API_MODEL_OVERLOADED = 'API_MODEL_OVERLOADED',
  
  // Audio Errors
  AUDIO_PERMISSION_DENIED = 'AUDIO_PERMISSION_DENIED',
  AUDIO_DEVICE_BUSY = 'AUDIO_DEVICE_BUSY',
  AUDIO_FORMAT_UNSUPPORTED = 'AUDIO_FORMAT_UNSUPPORTED',
  AUDIO_PLAYBACK_FAILED = 'AUDIO_PLAYBACK_FAILED',
  AUDIO_RECORDING_FAILED = 'AUDIO_RECORDING_FAILED',
  
  // Storage Errors
  STORAGE_FULL = 'STORAGE_FULL',
  STORAGE_PERMISSION_DENIED = 'STORAGE_PERMISSION_DENIED',
  STORAGE_CORRUPTED = 'STORAGE_CORRUPTED',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  
  // App State Errors
  APP_BACKGROUNDED = 'APP_BACKGROUNDED',
  APP_MEMORY_WARNING = 'APP_MEMORY_WARNING',
  APP_UPDATE_REQUIRED = 'APP_UPDATE_REQUIRED',
  
  // Feature Errors
  FEATURE_NOT_SUPPORTED = 'FEATURE_NOT_SUPPORTED',
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  
  // Generic Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export enum ErrorSeverity {
  LOW = 'LOW',           // Minor issues, app continues normally
  MEDIUM = 'MEDIUM',     // Noticeable issues, some features affected
  HIGH = 'HIGH',         // Major issues, core features affected
  CRITICAL = 'CRITICAL', // App unusable, immediate action required
}

export enum RecoveryStrategy {
  RETRY = 'RETRY',                    // Retry the operation
  FALLBACK = 'FALLBACK',             // Use alternative approach
  DEGRADE = 'DEGRADE',               // Reduce functionality
  USER_ACTION = 'USER_ACTION',       // Requires user intervention
  RESTART = 'RESTART',               // Restart app/component
  IGNORE = 'IGNORE',                 // Can be safely ignored
}

export interface AppError {
  type: ErrorType;
  code: string;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  timestamp: Date;
  context?: {
    component?: string;
    operation?: string;
    metadata?: Record<string, any>;
  };
  originalError?: Error;
  retryCount?: number;
  recoveryActions?: RecoveryAction[];
}

export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  action: () => Promise<void> | void;
  isPrimary?: boolean;
  isDestructive?: boolean;
}

export interface ErrorMetrics {
  errorType: ErrorType;
  count: number;
  lastOccurrence: Date;
  averageRecoveryTime: number;
  userDismissalRate: number;
}

// Network State
export interface NetworkState {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean | null;
  details: {
    strength?: number;
    ssid?: string;
    frequency?: number;
    subnet?: string;
    ipAddress?: string;
  };
}

// Storage State
export interface StorageState {
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  appUsage: number;
  isLowSpace: boolean;
  isCriticallyLow: boolean;
}

// Memory State
export interface MemoryState {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  appMemory: number;
  isLowMemory: boolean;
  isCriticallyLow: boolean;
}

// App State
export interface AppStateInfo {
  state: 'active' | 'background' | 'inactive';
  isInForeground: boolean;
  backgroundTime: number;
  memoryWarnings: number;
  lastMemoryWarning?: Date;
}

// Error Context for specific scenarios
export interface NetworkErrorContext {
  url?: string;
  method?: string;
  timeout?: number;
  retryAttempt?: number;
  networkState?: NetworkState;
}

export interface APIErrorContext {
  endpoint?: string;
  model?: string;
  tokenCount?: number;
  rateLimitReset?: number;
  quotaUsage?: number;
}

export interface AudioErrorContext {
  operation?: 'record' | 'play' | 'stop' | 'pause';
  duration?: number;
  format?: string;
  quality?: string;
  deviceInfo?: string;
}

export interface StorageErrorContext {
  operation?: 'read' | 'write' | 'delete';
  path?: string;
  size?: number;
  storageState?: StorageState;
}

// Error reporting configuration
export interface ErrorReportingConfig {
  enableCrashReporting: boolean;
  enableErrorMetrics: boolean;
  enableUserFeedback: boolean;
  maxErrorsPerSession: number;
  errorRetentionDays: number;
  sensitiveDataFilter: string[];
}

// User feedback for errors
export interface ErrorFeedback {
  errorId: string;
  userRating: 1 | 2 | 3 | 4 | 5;
  userComment?: string;
  wasHelpful: boolean;
  recoveryActionTaken?: string;
  timestamp: Date;
}