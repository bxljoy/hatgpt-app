import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ErrorHandlingService } from '@/services/errorHandling';
import { NetworkService } from '@/services/networkService';
import { AudioService } from '@/services/audioService';
import { FeatureAvailabilityService, FeatureType } from '@/services/featureAvailability';
import { ErrorNotification } from '@/components/ErrorNotification';
import { AppError, ErrorSeverity, ErrorType } from '@/types/errors';

interface ErrorContextType {
  // Current error state
  currentError: AppError | null;
  hasNetworkError: boolean;
  hasStorageError: boolean;
  hasAudioError: boolean;
  
  // Error handling methods
  reportError: (error: AppError | Error) => void;
  dismissError: () => void;
  executeRecoveryAction: (actionId: string) => Promise<void>;
  
  // Feature availability
  isFeatureAvailable: (feature: FeatureType) => boolean;
  enableFeature: (feature: FeatureType) => Promise<boolean>;
  
  // System status
  isOnline: boolean;
  storageStatus: 'ok' | 'low' | 'critical';
  memoryStatus: 'ok' | 'low' | 'critical';
}

const ErrorContext = createContext<ErrorContextType | null>(null);

interface ErrorProviderProps {
  children: ReactNode;
  enableErrorReporting?: boolean;
  enableFeatureMonitoring?: boolean;
  enableSystemMonitoring?: boolean;
}

export function ErrorProvider({
  children,
  enableErrorReporting = true,
  enableFeatureMonitoring = true,
  enableSystemMonitoring = true,
}: ErrorProviderProps) {
  // Services
  const errorHandler = ErrorHandlingService.getInstance();
  const networkService = NetworkService.getInstance();
  const audioService = AudioService.getInstance();
  const featureService = FeatureAvailabilityService.getInstance();

  // State
  const [currentError, setCurrentError] = useState<AppError | null>(null);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [hasStorageError, setHasStorageError] = useState(false);
  const [hasAudioError, setHasAudioError] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [storageStatus, setStorageStatus] = useState<'ok' | 'low' | 'critical'>('ok');
  const [memoryStatus, setMemoryStatus] = useState<'ok' | 'low' | 'critical'>('ok');

  // Initialize error handling
  useEffect(() => {
    if (enableErrorReporting) {
      setupErrorHandling();
    }
    
    if (enableFeatureMonitoring) {
      setupFeatureMonitoring();
    }
    
    if (enableSystemMonitoring) {
      setupSystemMonitoring();
    }

    return () => {
      cleanup();
    };
  }, [enableErrorReporting, enableFeatureMonitoring, enableSystemMonitoring]);

  // Setup error handling
  const setupErrorHandling = () => {
    // Listen to error events
    errorHandler.addErrorListener(handleError);

    // Setup global error handlers
    setupGlobalErrorHandlers();
  };

  // Setup feature monitoring
  const setupFeatureMonitoring = () => {
    featureService.addFeatureListener((feature, status) => {
      // Handle feature availability changes
      if (!status.isAvailable && status.isSupported) {
        handleFeatureUnavailable(feature, status);
      }
    });
  };

  // Setup system monitoring
  const setupSystemMonitoring = () => {
    // Monitor app state changes
    AppState.addEventListener('change', handleAppStateChange);

    // Monitor network status
    const checkNetworkStatus = async () => {
      const isConnected = await networkService.checkConnectivity();
      setIsOnline(isConnected);
      setHasNetworkError(!isConnected);
    };

    // Monitor storage status
    const checkStorageStatus = async () => {
      try {
        const storageState = await errorHandler.checkStorageState();
        if (storageState.isCriticallyLow) {
          setStorageStatus('critical');
          setHasStorageError(true);
        } else if (storageState.isLowSpace) {
          setStorageStatus('low');
        } else {
          setStorageStatus('ok');
          setHasStorageError(false);
        }
      } catch (error) {
        setHasStorageError(true);
      }
    };

    // Monitor memory status
    const checkMemoryStatus = () => {
      const memoryState = errorHandler.getMemoryState();
      if (memoryState) {
        if (memoryState.isCriticallyLow) {
          setMemoryStatus('critical');
        } else if (memoryState.isLowMemory) {
          setMemoryStatus('low');
        } else {
          setMemoryStatus('ok');
        }
      }
    };

    // Initial checks
    checkNetworkStatus();
    checkStorageStatus();
    checkMemoryStatus();

    // Periodic monitoring
    const interval = setInterval(() => {
      checkNetworkStatus();
      checkStorageStatus();
      checkMemoryStatus();
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
    };
  };

  // Setup global error handlers
  const setupGlobalErrorHandlers = () => {
    // Handle unhandled promise rejections
    const originalHandler = ErrorUtils?.getGlobalHandler?.();
    
    ErrorUtils?.setGlobalHandler?.((error: Error) => {
      handleError(errorHandler.convertGenericError?.(error) || createFallbackError(error));
      originalHandler?.(error);
    });

    // Console error override
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Only report actual errors, not warnings
      if (args[0] instanceof Error) {
        handleError(createFallbackError(args[0]));
      }
      originalConsoleError.apply(console, args);
    };
  };

  // Handle errors
  const handleError = (error: AppError) => {
    // Update error state
    setCurrentError(error);

    // Update specific error flags
    switch (error.type) {
      case ErrorType.NETWORK_OFFLINE:
      case ErrorType.NETWORK_TIMEOUT:
        setHasNetworkError(true);
        setIsOnline(false);
        break;
      case ErrorType.STORAGE_FULL:
      case ErrorType.STORAGE_CORRUPTED:
        setHasStorageError(true);
        break;
      case ErrorType.AUDIO_PERMISSION_DENIED:
      case ErrorType.AUDIO_DEVICE_BUSY:
      case ErrorType.AUDIO_RECORDING_FAILED:
      case ErrorType.AUDIO_PLAYBACK_FAILED:
        setHasAudioError(true);
        break;
    }

    // Auto-dismiss low severity errors
    if (error.severity === ErrorSeverity.LOW) {
      setTimeout(() => {
        setCurrentError(null);
      }, 3000);
    }
  };

  // Handle feature unavailable
  const handleFeatureUnavailable = (feature: FeatureType, status: any) => {
    const error: AppError = {
      type: ErrorType.FEATURE_NOT_SUPPORTED,
      code: `FEATURE_${feature}_001`,
      message: `Feature ${feature} is not available`,
      userMessage: status.userMessage || `${feature} is currently unavailable`,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: 'FALLBACK' as any,
      timestamp: new Date(),
      context: {
        component: 'FeatureMonitoring',
        operation: 'availability_check',
        metadata: { feature, status },
      },
    };

    handleError(error);
  };

  // Handle app state changes
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      // Clear non-critical errors when app goes to background
      if (currentError && currentError.severity === ErrorSeverity.LOW) {
        setCurrentError(null);
      }
    }
  };

  // Create fallback error
  const createFallbackError = (error: Error): AppError => {
    return {
      type: ErrorType.UNKNOWN_ERROR,
      code: 'FALLBACK_001',
      message: error.message,
      userMessage: 'An unexpected error occurred',
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: 'RETRY' as any,
      timestamp: new Date(),
      originalError: error,
    };
  };

  // Error handling methods
  const reportError = (error: AppError | Error) => {
    if (error instanceof Error) {
      handleError(createFallbackError(error));
    } else {
      handleError(error);
    }
  };

  const dismissError = () => {
    setCurrentError(null);
    
    // Reset specific error flags if no current error
    setHasNetworkError(false);
    setHasStorageError(false);
    setHasAudioError(false);
  };

  const executeRecoveryAction = async (actionId: string) => {
    if (!currentError?.recoveryActions) return;

    const action = currentError.recoveryActions.find(a => a.id === actionId);
    if (action) {
      try {
        await action.action();
        
        // If successful, dismiss the error
        dismissError();
      } catch (error) {
        // If recovery action fails, report it
        reportError(error as Error);
      }
    }
  };

  // Feature availability methods
  const isFeatureAvailable = (feature: FeatureType): boolean => {
    return featureService.isFeatureAvailable(feature);
  };

  const enableFeature = async (feature: FeatureType): Promise<boolean> => {
    try {
      return await featureService.enableFeature(feature);
    } catch (error) {
      reportError(error as Error);
      return false;
    }
  };

  // Cleanup
  const cleanup = () => {
    errorHandler.removeErrorListener(handleError);
    // Reset console.error
    // Remove app state listener
  };

  // Context value
  const contextValue: ErrorContextType = {
    currentError,
    hasNetworkError,
    hasStorageError,
    hasAudioError,
    reportError,
    dismissError,
    executeRecoveryAction,
    isFeatureAvailable,
    enableFeature,
    isOnline,
    storageStatus,
    memoryStatus,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      
      {/* Error Notification Overlay */}
      <ErrorNotification
        error={currentError}
        onDismiss={dismissError}
        onActionPress={executeRecoveryAction}
        position="top"
        autoHideDelay={currentError?.severity === ErrorSeverity.LOW ? 3000 : 0}
      />
    </ErrorContext.Provider>
  );
}

// Hook to use error context
export function useError(): ErrorContextType {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

// Hook for error reporting
export function useErrorReporting() {
  const { reportError } = useError();
  
  return {
    reportError,
    reportNetworkError: (error: Error, context?: any) => {
      const errorHandler = ErrorHandlingService.getInstance();
      reportError(errorHandler.createNetworkError(ErrorType.NETWORK_TIMEOUT, context));
    },
    reportAPIError: (error: Error, context?: any) => {
      const errorHandler = ErrorHandlingService.getInstance();
      reportError(errorHandler.createAPIError(ErrorType.API_SERVER_ERROR, context));
    },
    reportAudioError: (error: Error, context?: any) => {
      const errorHandler = ErrorHandlingService.getInstance();
      reportError(errorHandler.createAudioError(ErrorType.AUDIO_RECORDING_FAILED, context));
    },
    reportStorageError: (error: Error, context?: any) => {
      const errorHandler = ErrorHandlingService.getInstance();
      reportError(errorHandler.createStorageError(ErrorType.STORAGE_CORRUPTED, context));
    },
  };
}

// Hook for feature availability
export function useFeatureAvailability() {
  const { isFeatureAvailable, enableFeature } = useError();
  
  return {
    isFeatureAvailable,
    enableFeature,
    isVoiceRecordingAvailable: () => isFeatureAvailable(FeatureType.AUDIO_RECORDING),
    isVoicePlaybackAvailable: () => isFeatureAvailable(FeatureType.AUDIO_PLAYBACK),
    isInternetAvailable: () => isFeatureAvailable(FeatureType.INTERNET_CONNECTION),
    isHapticsAvailable: () => isFeatureAvailable(FeatureType.HAPTIC_FEEDBACK),
  };
}

// Hook for system status
export function useSystemStatus() {
  const { isOnline, storageStatus, memoryStatus } = useError();
  
  return {
    isOnline,
    storageStatus,
    memoryStatus,
    isStorageHealthy: storageStatus === 'ok',
    isMemoryHealthy: memoryStatus === 'ok',
    hasSystemIssues: !isOnline || storageStatus !== 'ok' || memoryStatus !== 'ok',
  };
}