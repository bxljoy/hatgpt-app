import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import { Alert, AppState, AppStateStatus } from 'react-native';
import {
  AppError,
  ErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  RecoveryAction,
  NetworkState,
  StorageState,
  MemoryState,
  AppStateInfo,
  ErrorMetrics,
  ErrorFeedback,
} from '@/types/errors';

// Storage keys
const ERROR_METRICS_KEY = '@error_metrics';
const ERROR_FEEDBACK_KEY = '@error_feedback';
const ERROR_LOG_KEY = '@error_log';

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private networkState: NetworkState | null = null;
  private storageState: StorageState | null = null;
  private memoryState: MemoryState | null = null;
  private appStateInfo: AppStateInfo = {
    state: 'active',
    isInForeground: true,
    backgroundTime: 0,
    memoryWarnings: 0,
  };
  private errorMetrics: Map<ErrorType, ErrorMetrics> = new Map();
  private listeners: Array<(error: AppError) => void> = [];

  private constructor() {
    this.initializeMonitoring();
  }

  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  // Initialize system monitoring
  private initializeMonitoring() {
    this.setupNetworkMonitoring();
    this.setupAppStateMonitoring();
    this.setupMemoryMonitoring();
    this.loadErrorMetrics();
  }

  // Network monitoring
  private setupNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      this.networkState = {
        isConnected: state.isConnected || false,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
        details: state.details || {},
      };

      // Handle network disconnection
      if (!state.isConnected) {
        this.handleError(this.createNetworkError(ErrorType.NETWORK_OFFLINE));
      }
    });
  }

  // App state monitoring
  private setupAppStateMonitoring() {
    let backgroundStartTime: number | null = null;

    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previousState = this.appStateInfo.state;
      
      this.appStateInfo = {
        ...this.appStateInfo,
        state: nextAppState,
        isInForeground: nextAppState === 'active',
      };

      if (nextAppState === 'background' && previousState === 'active') {
        backgroundStartTime = Date.now();
        this.handleAppBackgrounded();
      } else if (nextAppState === 'active' && backgroundStartTime) {
        this.appStateInfo.backgroundTime = Date.now() - backgroundStartTime;
        this.handleAppForegrounded();
        backgroundStartTime = null;
      }
    });
  }

  // Memory monitoring
  private setupMemoryMonitoring() {
    // This would need a native module for real memory monitoring
    // For now, we'll simulate based on usage patterns
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }

  // Check storage state
  public async checkStorageState(): Promise<StorageState> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      const usedSpace = totalSpace - freeSpace;
      
      // Estimate app usage (this is simplified)
      const appUsage = await this.estimateAppStorageUsage();
      
      const storageState: StorageState = {
        totalSpace,
        freeSpace,
        usedSpace,
        appUsage,
        isLowSpace: freeSpace < 100 * 1024 * 1024, // Less than 100MB
        isCriticallyLow: freeSpace < 50 * 1024 * 1024, // Less than 50MB
      };

      this.storageState = storageState;

      if (storageState.isCriticallyLow) {
        this.handleError(this.createStorageError(ErrorType.STORAGE_FULL));
      }

      return storageState;
    } catch (error) {
      console.error('Failed to check storage:', error);
      throw this.createStorageError(ErrorType.STORAGE_CORRUPTED);
    }
  }

  // Estimate app storage usage
  private async estimateAppStorageUsage(): Promise<number> {
    try {
      let totalSize = 0;
      
      // Check document directory
      const docInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
      if (docInfo.exists && docInfo.size) {
        totalSize += docInfo.size;
      }

      // Check cache directory
      const cacheInfo = await FileSystem.getInfoAsync(FileSystem.cacheDirectory!);
      if (cacheInfo.exists && cacheInfo.size) {
        totalSize += cacheInfo.size;
      }

      return totalSize;
    } catch (error) {
      console.warn('Failed to estimate app storage usage:', error);
      return 0;
    }
  }

  // Check memory usage (simplified simulation)
  private checkMemoryUsage() {
    // In a real app, you'd use a native module to get actual memory info
    // For now, we'll simulate based on app usage patterns
    const estimatedMemory = this.estimateMemoryUsage();
    
    this.memoryState = estimatedMemory;

    if (estimatedMemory.isCriticallyLow) {
      this.appStateInfo.memoryWarnings++;
      this.appStateInfo.lastMemoryWarning = new Date();
      this.handleError(this.createMemoryError());
    }
  }

  // Estimate memory usage (simulation)
  private estimateMemoryUsage(): MemoryState {
    // This is a simplified simulation
    const totalMemory = 4 * 1024 * 1024 * 1024; // 4GB assumption
    const baseUsage = 1.5 * 1024 * 1024 * 1024; // 1.5GB base usage
    const appMemory = 150 * 1024 * 1024; // 150MB app usage
    const usedMemory = baseUsage + appMemory;
    const freeMemory = totalMemory - usedMemory;

    return {
      totalMemory,
      usedMemory,
      freeMemory,
      appMemory,
      isLowMemory: freeMemory < 500 * 1024 * 1024, // Less than 500MB
      isCriticallyLow: freeMemory < 200 * 1024 * 1024, // Less than 200MB
    };
  }

  // Handle app backgrounded
  private handleAppBackgrounded() {
    this.handleError({
      type: ErrorType.APP_BACKGROUNDED,
      code: 'APP_001',
      message: 'App moved to background',
      userMessage: 'App is running in the background',
      severity: ErrorSeverity.LOW,
      recoveryStrategy: RecoveryStrategy.IGNORE,
      timestamp: new Date(),
      context: {
        component: 'AppState',
        operation: 'background',
      },
    });
  }

  // Handle app foregrounded
  private handleAppForegrounded() {
    // Check if we need to refresh data after being backgrounded
    if (this.appStateInfo.backgroundTime > 60000) { // More than 1 minute
      // Refresh network state
      NetInfo.refresh();
      
      // Check storage state
      this.checkStorageState();
    }
  }

  // Create specific error types
  public createNetworkError(type: ErrorType, context?: any): AppError {
    const errorMessages = {
      [ErrorType.NETWORK_OFFLINE]: {
        message: 'No internet connection available',
        userMessage: 'Please check your internet connection and try again.',
        recovery: RecoveryStrategy.USER_ACTION,
      },
      [ErrorType.NETWORK_TIMEOUT]: {
        message: 'Network request timed out',
        userMessage: 'The request is taking longer than expected. Please try again.',
        recovery: RecoveryStrategy.RETRY,
      },
      [ErrorType.NETWORK_SLOW]: {
        message: 'Slow network connection detected',
        userMessage: 'Your connection is slow. Some features may be limited.',
        recovery: RecoveryStrategy.DEGRADE,
      },
    };

    const config = errorMessages[type];
    
    return {
      type,
      code: `NET_${type.split('_')[1]}_001`,
      message: config.message,
      userMessage: config.userMessage,
      severity: type === ErrorType.NETWORK_OFFLINE ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      recoveryStrategy: config.recovery,
      timestamp: new Date(),
      context: {
        component: 'Network',
        operation: 'connection',
        metadata: { networkState: this.networkState, ...context },
      },
      recoveryActions: this.getNetworkRecoveryActions(type),
    };
  }

  public createAPIError(type: ErrorType, context?: any): AppError {
    const errorMessages = {
      [ErrorType.API_RATE_LIMIT]: {
        message: 'API rate limit exceeded',
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        recovery: RecoveryStrategy.RETRY,
        severity: ErrorSeverity.MEDIUM,
      },
      [ErrorType.API_QUOTA_EXCEEDED]: {
        message: 'API quota exceeded',
        userMessage: 'Your API usage limit has been reached. Please check your OpenAI account.',
        recovery: RecoveryStrategy.USER_ACTION,
        severity: ErrorSeverity.HIGH,
      },
      [ErrorType.API_INVALID_KEY]: {
        message: 'Invalid API key',
        userMessage: 'Your API key is invalid. Please check your settings.',
        recovery: RecoveryStrategy.USER_ACTION,
        severity: ErrorSeverity.CRITICAL,
      },
      [ErrorType.API_INSUFFICIENT_FUNDS]: {
        message: 'Insufficient API credits',
        userMessage: 'Your OpenAI account has insufficient credits. Please add funds.',
        recovery: RecoveryStrategy.USER_ACTION,
        severity: ErrorSeverity.HIGH,
      },
      [ErrorType.API_MODEL_OVERLOADED]: {
        message: 'API model overloaded',
        userMessage: 'The AI model is currently overloaded. Please try again in a moment.',
        recovery: RecoveryStrategy.RETRY,
        severity: ErrorSeverity.MEDIUM,
      },
    };

    const config = errorMessages[type] || {
      message: 'API error occurred',
      userMessage: 'An error occurred while communicating with the AI service.',
      recovery: RecoveryStrategy.RETRY,
      severity: ErrorSeverity.MEDIUM,
    };

    return {
      type,
      code: `API_${type.split('_')[1]}_001`,
      message: config.message,
      userMessage: config.userMessage,
      severity: config.severity,
      recoveryStrategy: config.recovery,
      timestamp: new Date(),
      context: {
        component: 'OpenAI',
        operation: 'api_call',
        metadata: context,
      },
      recoveryActions: this.getAPIRecoveryActions(type),
    };
  }

  public createAudioError(type: ErrorType, context?: any): AppError {
    const errorMessages = {
      [ErrorType.AUDIO_PERMISSION_DENIED]: {
        message: 'Audio permission denied',
        userMessage: 'Microphone access is required for voice features. Please enable it in Settings.',
        recovery: RecoveryStrategy.USER_ACTION,
        severity: ErrorSeverity.HIGH,
      },
      [ErrorType.AUDIO_DEVICE_BUSY]: {
        message: 'Audio device busy',
        userMessage: 'Another app is using the microphone. Please close other audio apps and try again.',
        recovery: RecoveryStrategy.RETRY,
        severity: ErrorSeverity.MEDIUM,
      },
      [ErrorType.AUDIO_RECORDING_FAILED]: {
        message: 'Audio recording failed',
        userMessage: 'Failed to record audio. Please try again.',
        recovery: RecoveryStrategy.RETRY,
        severity: ErrorSeverity.MEDIUM,
      },
      [ErrorType.AUDIO_PLAYBACK_FAILED]: {
        message: 'Audio playback failed',
        userMessage: 'Failed to play audio. Please try again.',
        recovery: RecoveryStrategy.RETRY,
        severity: ErrorSeverity.MEDIUM,
      },
    };

    const config = errorMessages[type] || {
      message: 'Audio error occurred',
      userMessage: 'An audio error occurred. Please try again.',
      recovery: RecoveryStrategy.RETRY,
      severity: ErrorSeverity.MEDIUM,
    };

    return {
      type,
      code: `AUD_${type.split('_')[1]}_001`,
      message: config.message,
      userMessage: config.userMessage,
      severity: config.severity,
      recoveryStrategy: config.recovery,
      timestamp: new Date(),
      context: {
        component: 'Audio',
        operation: context?.operation || 'unknown',
        metadata: context,
      },
      recoveryActions: this.getAudioRecoveryActions(type),
    };
  }

  public createStorageError(type: ErrorType, context?: any): AppError {
    const errorMessages = {
      [ErrorType.STORAGE_FULL]: {
        message: 'Storage space full',
        userMessage: 'Your device is running low on storage space. Please free up some space.',
        recovery: RecoveryStrategy.USER_ACTION,
        severity: ErrorSeverity.HIGH,
      },
      [ErrorType.STORAGE_QUOTA_EXCEEDED]: {
        message: 'Storage quota exceeded',
        userMessage: 'App storage limit reached. Some older conversations may be archived.',
        recovery: RecoveryStrategy.DEGRADE,
        severity: ErrorSeverity.MEDIUM,
      },
      [ErrorType.STORAGE_CORRUPTED]: {
        message: 'Storage corrupted',
        userMessage: 'Storage error detected. Some data may be lost.',
        recovery: RecoveryStrategy.USER_ACTION,
        severity: ErrorSeverity.HIGH,
      },
    };

    const config = errorMessages[type] || {
      message: 'Storage error occurred',
      userMessage: 'A storage error occurred.',
      recovery: RecoveryStrategy.RETRY,
      severity: ErrorSeverity.MEDIUM,
    };

    return {
      type,
      code: `STO_${type.split('_')[1]}_001`,
      message: config.message,
      userMessage: config.userMessage,
      severity: config.severity,
      recoveryStrategy: config.recovery,
      timestamp: new Date(),
      context: {
        component: 'Storage',
        operation: context?.operation || 'unknown',
        metadata: { storageState: this.storageState, ...context },
      },
      recoveryActions: this.getStorageRecoveryActions(type),
    };
  }

  public createMemoryError(): AppError {
    return {
      type: ErrorType.APP_MEMORY_WARNING,
      code: 'MEM_WARNING_001',
      message: 'Low memory warning',
      userMessage: 'Your device is running low on memory. Some features may be limited.',
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.DEGRADE,
      timestamp: new Date(),
      context: {
        component: 'Memory',
        operation: 'monitoring',
        metadata: { memoryState: this.memoryState },
      },
      recoveryActions: this.getMemoryRecoveryActions(),
    };
  }

  // Recovery action generators
  private getNetworkRecoveryActions(type: ErrorType): RecoveryAction[] {
    switch (type) {
      case ErrorType.NETWORK_OFFLINE:
        return [
          {
            id: 'check_connection',
            label: 'Check Connection',
            description: 'Verify your internet connection',
            action: () => NetInfo.refresh(),
            isPrimary: true,
          },
          {
            id: 'retry',
            label: 'Retry',
            description: 'Try the operation again',
            action: () => Promise.resolve(),
          },
        ];
      case ErrorType.NETWORK_TIMEOUT:
        return [
          {
            id: 'retry',
            label: 'Retry',
            description: 'Try again with a longer timeout',
            action: () => Promise.resolve(),
            isPrimary: true,
          },
        ];
      default:
        return [];
    }
  }

  private getAPIRecoveryActions(type: ErrorType): RecoveryAction[] {
    switch (type) {
      case ErrorType.API_RATE_LIMIT:
        return [
          {
            id: 'wait_retry',
            label: 'Wait & Retry',
            description: 'Wait for rate limit to reset',
            action: () => new Promise(resolve => setTimeout(resolve, 60000)),
            isPrimary: true,
          },
        ];
      case ErrorType.API_INVALID_KEY:
        return [
          {
            id: 'update_key',
            label: 'Update API Key',
            description: 'Go to settings to update your API key',
            action: () => Promise.resolve(), // Navigate to settings
            isPrimary: true,
          },
        ];
      case ErrorType.API_QUOTA_EXCEEDED:
      case ErrorType.API_INSUFFICIENT_FUNDS:
        return [
          {
            id: 'check_account',
            label: 'Check Account',
            description: 'Visit OpenAI dashboard to check your account',
            action: () => Promise.resolve(), // Open OpenAI dashboard
            isPrimary: true,
          },
        ];
      default:
        return [
          {
            id: 'retry',
            label: 'Retry',
            description: 'Try the operation again',
            action: () => Promise.resolve(),
            isPrimary: true,
          },
        ];
    }
  }

  private getAudioRecoveryActions(type: ErrorType): RecoveryAction[] {
    switch (type) {
      case ErrorType.AUDIO_PERMISSION_DENIED:
        return [
          {
            id: 'open_settings',
            label: 'Open Settings',
            description: 'Open device settings to grant microphone permission',
            action: () => Promise.resolve(), // Open device settings
            isPrimary: true,
          },
        ];
      case ErrorType.AUDIO_DEVICE_BUSY:
        return [
          {
            id: 'close_apps',
            label: 'Close Other Apps',
            description: 'Close other apps using audio and try again',
            action: () => Promise.resolve(),
            isPrimary: true,
          },
        ];
      default:
        return [
          {
            id: 'retry',
            label: 'Retry',
            description: 'Try the audio operation again',
            action: () => Promise.resolve(),
            isPrimary: true,
          },
        ];
    }
  }

  private getStorageRecoveryActions(type: ErrorType): RecoveryAction[] {
    switch (type) {
      case ErrorType.STORAGE_FULL:
        return [
          {
            id: 'free_space',
            label: 'Free Up Space',
            description: 'Delete unused files to free up storage',
            action: () => Promise.resolve(),
            isPrimary: true,
          },
          {
            id: 'clear_cache',
            label: 'Clear App Cache',
            description: 'Clear temporary files to free up space',
            action: () => this.clearAppCache(),
          },
        ];
      case ErrorType.STORAGE_QUOTA_EXCEEDED:
        return [
          {
            id: 'archive_old',
            label: 'Archive Old Data',
            description: 'Archive older conversations to free up space',
            action: () => this.archiveOldConversations(),
            isPrimary: true,
          },
        ];
      default:
        return [];
    }
  }

  private getMemoryRecoveryActions(): RecoveryAction[] {
    return [
      {
        id: 'clear_cache',
        label: 'Clear Cache',
        description: 'Clear temporary data to free up memory',
        action: () => this.clearMemoryCache(),
        isPrimary: true,
      },
      {
        id: 'restart_app',
        label: 'Restart App',
        description: 'Restart the app to free up memory',
        action: () => Promise.resolve(), // Restart app
      },
    ];
  }

  // Recovery action implementations
  private async clearAppCache(): Promise<void> {
    try {
      // Clear cache directory
      const cacheDir = FileSystem.cacheDirectory!;
      const cacheContents = await FileSystem.readDirectoryAsync(cacheDir);
      
      for (const item of cacheContents) {
        await FileSystem.deleteAsync(`${cacheDir}${item}`, { idempotent: true });
      }
    } catch (error) {
      console.warn('Failed to clear app cache:', error);
    }
  }

  private async clearMemoryCache(): Promise<void> {
    // Clear in-memory caches
    // This would involve clearing various app caches
    console.log('Clearing memory cache...');
  }

  private async archiveOldConversations(): Promise<void> {
    // Archive old conversations
    console.log('Archiving old conversations...');
  }

  // Error handling
  public handleError(error: AppError | Error): void {
    let appError: AppError;

    if (error instanceof Error) {
      appError = this.convertGenericError(error);
    } else {
      appError = error;
    }

    // Update metrics
    this.updateErrorMetrics(appError);

    // Log error
    this.logError(appError);

    // Notify listeners
    this.notifyListeners(appError);

    // Handle based on severity
    this.handleBySeverity(appError);
  }

  private convertGenericError(error: Error): AppError {
    return {
      type: ErrorType.UNKNOWN_ERROR,
      code: 'GEN_001',
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again.',
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      timestamp: new Date(),
      originalError: error,
      recoveryActions: [
        {
          id: 'retry',
          label: 'Retry',
          description: 'Try the operation again',
          action: () => Promise.resolve(),
          isPrimary: true,
        },
      ],
    };
  }

  private handleBySeverity(error: AppError): void {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.showCriticalErrorDialog(error);
        break;
      case ErrorSeverity.HIGH:
        this.showErrorDialog(error);
        break;
      case ErrorSeverity.MEDIUM:
        this.showErrorNotification(error);
        break;
      case ErrorSeverity.LOW:
        // Log only, no user notification
        break;
    }
  }

  private showCriticalErrorDialog(error: AppError): void {
    Alert.alert(
      'Critical Error',
      error.userMessage,
      [
        {
          text: 'Restart App',
          onPress: () => {
            // Restart app logic
          },
          style: 'default',
        },
        ...(error.recoveryActions?.map(action => ({
          text: action.label,
          onPress: () => action.action(),
          style: action.isDestructive ? 'destructive' : 'default',
        })) || []),
      ],
      { cancelable: false }
    );
  }

  private showErrorDialog(error: AppError): void {
    const actions = error.recoveryActions || [];
    const primaryAction = actions.find(a => a.isPrimary) || actions[0];

    Alert.alert(
      'Error',
      error.userMessage,
      [
        { text: 'Dismiss', style: 'cancel' },
        ...(primaryAction ? [{
          text: primaryAction.label,
          onPress: () => primaryAction.action(),
          style: 'default',
        }] : []),
      ]
    );
  }

  private showErrorNotification(error: AppError): void {
    // This would show a toast/snackbar notification
    console.warn('Error notification:', error.userMessage);
  }

  // Error metrics and logging
  private updateErrorMetrics(error: AppError): void {
    const existing = this.errorMetrics.get(error.type);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = error.timestamp;
    } else {
      this.errorMetrics.set(error.type, {
        errorType: error.type,
        count: 1,
        lastOccurrence: error.timestamp,
        averageRecoveryTime: 0,
        userDismissalRate: 0,
      });
    }

    this.saveErrorMetrics();
  }

  private async logError(error: AppError): Promise<void> {
    try {
      const logs = await this.getErrorLogs();
      logs.push({
        ...error,
        timestamp: error.timestamp.toISOString(),
      });

      // Keep only last 100 errors
      const trimmedLogs = logs.slice(-100);
      
      await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(trimmedLogs));
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  private async getErrorLogs(): Promise<any[]> {
    try {
      const logs = await AsyncStorage.getItem(ERROR_LOG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      return [];
    }
  }

  private async loadErrorMetrics(): Promise<void> {
    try {
      const metrics = await AsyncStorage.getItem(ERROR_METRICS_KEY);
      if (metrics) {
        const parsed = JSON.parse(metrics);
        this.errorMetrics = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.warn('Failed to load error metrics:', error);
    }
  }

  private async saveErrorMetrics(): Promise<void> {
    try {
      const metricsObj = Object.fromEntries(this.errorMetrics);
      await AsyncStorage.setItem(ERROR_METRICS_KEY, JSON.stringify(metricsObj));
    } catch (error) {
      console.warn('Failed to save error metrics:', error);
    }
  }

  // Event listeners
  public addErrorListener(listener: (error: AppError) => void): void {
    this.listeners.push(listener);
  }

  public removeErrorListener(listener: (error: AppError) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  // Utility methods
  public getNetworkState(): NetworkState | null {
    return this.networkState;
  }

  public getStorageState(): StorageState | null {
    return this.storageState;
  }

  public getMemoryState(): MemoryState | null {
    return this.memoryState;
  }

  public getAppStateInfo(): AppStateInfo {
    return this.appStateInfo;
  }

  public async getErrorMetrics(): Promise<ErrorMetrics[]> {
    return Array.from(this.errorMetrics.values());
  }

  public async clearErrorLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ERROR_LOG_KEY);
      await AsyncStorage.removeItem(ERROR_METRICS_KEY);
      this.errorMetrics.clear();
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  }
}