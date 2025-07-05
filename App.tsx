import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { performanceMonitor } from './src/utils/performanceMonitor';
import { getAudioCleanupManager, setupAudioCleanupLifecycle } from './src/services/audioCleanup';

export default function App() {
  useEffect(() => {
    // Initialize performance monitoring
    performanceMonitor.markEvent('app_start', {
      platform: Platform.OS,
      version: Platform.Version,
    });

    // Setup audio cleanup lifecycle
    setupAudioCleanupLifecycle();

    // Handle app state changes for memory management
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        performanceMonitor.markEvent('app_background');
        // Trigger cleanup when app goes to background
        getAudioCleanupManager().performCleanup();
      } else if (nextAppState === 'active') {
        performanceMonitor.markEvent('app_foreground');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
      // Stop cleanup manager when app is unmounted
      getAudioCleanupManager().stopPeriodicCleanup();
    };
  }, []);

  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}
