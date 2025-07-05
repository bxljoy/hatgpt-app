import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorHandlingService } from '@/services/errorHandling';
import { AppError, ErrorSeverity, ErrorType } from '@/types/errors';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: any) => ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  appError: AppError | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private errorHandler: ErrorHandlingService;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      appError: null,
    };
    this.errorHandler = ErrorHandlingService.getInstance();
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Convert to AppError
    const appError = this.errorHandler.convertGenericError ? 
      this.errorHandler.convertGenericError(error) : 
      this.createFallbackAppError(error);

    this.setState({
      errorInfo,
      appError,
    });

    // Handle the error
    this.errorHandler.handleError(appError);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private createFallbackAppError(error: Error): AppError {
    return {
      type: ErrorType.UNKNOWN_ERROR,
      code: 'ERR_BOUNDARY_001',
      message: error.message,
      userMessage: 'Something went wrong. Please try again.',
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: 'RETRY' as any,
      timestamp: new Date(),
      context: {
        component: 'ErrorBoundary',
        operation: 'render',
      },
      originalError: error,
      recoveryActions: [
        {
          id: 'retry',
          label: 'Try Again',
          description: 'Retry the operation',
          action: () => this.handleRetry(),
          isPrimary: true,
        },
        {
          id: 'reload',
          label: 'Reload App',
          description: 'Reload the entire app',
          action: () => this.handleReload(),
        },
      ],
    };
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      appError: null,
    });
  };

  private handleReload = () => {
    // In a real app, this would restart the app
    Alert.alert(
      'Reload App',
      'This would restart the application.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reload', onPress: () => this.handleRetry() },
      ]
    );
  };

  private handleFeedback = () => {
    Alert.alert(
      'Send Feedback',
      'Would you like to send feedback about this error?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => {
          // Open feedback form
          console.log('Opening feedback form...');
        }},
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo);
      }

      // Default error UI
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.errorContainer}>
              {/* Error Icon */}
              <View style={styles.iconContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
              </View>

              {/* Error Title */}
              <Text style={styles.errorTitle}>Oops! Something went wrong</Text>

              {/* User-friendly message */}
              <Text style={styles.errorMessage}>
                {this.state.appError?.userMessage || 
                 'We encountered an unexpected error. Please try again.'}
              </Text>

              {/* Recovery Actions */}
              {this.state.appError?.recoveryActions && (
                <View style={styles.actionsContainer}>
                  {this.state.appError.recoveryActions.map((action) => (
                    <TouchableOpacity
                      key={action.id}
                      style={[
                        styles.actionButton,
                        action.isPrimary && styles.primaryButton,
                        action.isDestructive && styles.destructiveButton,
                      ]}
                      onPress={() => action.action()}
                    >
                      <Text
                        style={[
                          styles.actionButtonText,
                          action.isPrimary && styles.primaryButtonText,
                          action.isDestructive && styles.destructiveButtonText,
                        ]}
                      >
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Additional Actions */}
              <View style={styles.additionalActions}>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={this.handleFeedback}
                >
                  <Text style={styles.linkButtonText}>Send Feedback</Text>
                </TouchableOpacity>
              </View>

              {/* Error Details (for debugging) */}
              {__DEV__ && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>Debug Information:</Text>
                  <Text style={styles.debugText}>
                    {this.state.error?.message}
                  </Text>
                  {this.state.error?.stack && (
                    <Text style={styles.debugStack}>
                      {this.state.error.stack}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorIcon: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  destructiveButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
  },
  additionalActions: {
    alignItems: 'center',
  },
  linkButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  linkButtonText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
  debugContainer: {
    marginTop: 40,
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  debugStack: {
    fontSize: 10,
    color: '#CCCCCC',
    fontFamily: 'monospace',
  },
});