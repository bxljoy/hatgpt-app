import * as Application from 'expo-application';
import * as Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ErrorHandlingService } from './errorHandling';
import { ErrorType } from '@/types/errors';

export enum FeatureType {
  // Audio Features
  AUDIO_RECORDING = 'AUDIO_RECORDING',
  AUDIO_PLAYBACK = 'AUDIO_PLAYBACK',
  VOICE_RECOGNITION = 'VOICE_RECOGNITION',
  TEXT_TO_SPEECH = 'TEXT_TO_SPEECH',
  
  // Network Features
  INTERNET_CONNECTION = 'INTERNET_CONNECTION',
  OPENAI_API = 'OPENAI_API',
  FILE_SHARING = 'FILE_SHARING',
  
  // Storage Features
  LOCAL_STORAGE = 'LOCAL_STORAGE',
  SECURE_STORAGE = 'SECURE_STORAGE',
  FILE_SYSTEM = 'FILE_SYSTEM',
  
  // UI Features
  HAPTIC_FEEDBACK = 'HAPTIC_FEEDBACK',
  BIOMETRIC_AUTH = 'BIOMETRIC_AUTH',
  PUSH_NOTIFICATIONS = 'PUSH_NOTIFICATIONS',
  
  // System Features
  BACKGROUND_APP_REFRESH = 'BACKGROUND_APP_REFRESH',
  CAMERA = 'CAMERA',
  LOCATION = 'LOCATION',
}

export enum FeatureStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  DEGRADED = 'DEGRADED',
  PERMISSION_REQUIRED = 'PERMISSION_REQUIRED',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
}

export interface FeatureInfo {
  type: FeatureType;
  status: FeatureStatus;
  isEnabled: boolean;
  isSupported: boolean;
  requiresPermission: boolean;
  fallbackAvailable: boolean;
  degradationReason?: string;
  fallbackFeature?: FeatureType;
  userMessage?: string;
  actionRequired?: string;
}

export interface DeviceCapabilities {
  platform: 'ios' | 'android' | 'web';
  platformVersion: string;
  deviceModel?: string;
  isEmulator: boolean;
  hasInternet: boolean;
  hasMicrophone: boolean;
  hasSpeakers: boolean;
  hasSecureStorage: boolean;
  hasHaptics: boolean;
  hasBiometrics: boolean;
  supportedAudioFormats: string[];
  memoryClass?: string;
}

export class FeatureAvailabilityService {
  private static instance: FeatureAvailabilityService;
  private errorHandler: ErrorHandlingService;
  private featureStatus: Map<FeatureType, FeatureInfo> = new Map();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private listeners: Array<(feature: FeatureType, status: FeatureInfo) => void> = [];

  private constructor() {
    this.errorHandler = ErrorHandlingService.getInstance();
    this.initializeFeatureDetection();
  }

  public static getInstance(): FeatureAvailabilityService {
    if (!FeatureAvailabilityService.instance) {
      FeatureAvailabilityService.instance = new FeatureAvailabilityService();
    }
    return FeatureAvailabilityService.instance;
  }

  // Initialize feature detection
  private async initializeFeatureDetection(): Promise<void> {
    try {
      // Detect device capabilities
      await this.detectDeviceCapabilities();

      // Check all features
      await this.checkAllFeatures();

      // Set up monitoring
      this.setupFeatureMonitoring();

    } catch (error) {
      console.error('Failed to initialize feature detection:', error);
    }
  }

  // Detect device capabilities
  private async detectDeviceCapabilities(): Promise<void> {
    try {
      this.deviceCapabilities = {
        platform: Platform.OS as 'ios' | 'android' | 'web',
        platformVersion: Platform.Version.toString(),
        deviceModel: await this.getDeviceModel(),
        isEmulator: await this.isRunningOnEmulator(),
        hasInternet: await this.checkInternetCapability(),
        hasMicrophone: await this.checkMicrophoneCapability(),
        hasSpeakers: await this.checkSpeakerCapability(),
        hasSecureStorage: await this.checkSecureStorageCapability(),
        hasHaptics: await this.checkHapticsCapability(),
        hasBiometrics: await this.checkBiometricsCapability(),
        supportedAudioFormats: await this.getSupportedAudioFormats(),
        memoryClass: await this.getMemoryClass(),
      };
    } catch (error) {
      console.error('Failed to detect device capabilities:', error);
    }
  }

  // Device capability detection methods
  private async getDeviceModel(): Promise<string | undefined> {
    try {
      if (Platform.OS === 'ios') {
        return await Application.getIosIdForVendorAsync() ? 'iOS Device' : undefined;
      } else if (Platform.OS === 'android') {
        return Constants.deviceName || 'Android Device';
      }
      return 'Web Browser';
    } catch (error) {
      return undefined;
    }
  }

  private async isRunningOnEmulator(): Promise<boolean> {
    try {
      return Constants.isDevice === false;
    } catch (error) {
      return false;
    }
  }

  private async checkInternetCapability(): Promise<boolean> {
    // This would be checked by network service
    return true; // Assume internet capability exists
  }

  private async checkMicrophoneCapability(): Promise<boolean> {
    try {
      // Check if microphone is available on the device
      return Platform.OS !== 'web' || (navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices);
    } catch (error) {
      return false;
    }
  }

  private async checkSpeakerCapability(): Promise<boolean> {
    try {
      // Most devices have speakers
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkSecureStorageCapability(): Promise<boolean> {
    try {
      // Check if secure storage is available
      return Platform.OS !== 'web';
    } catch (error) {
      return false;
    }
  }

  private async checkHapticsCapability(): Promise<boolean> {
    try {
      // Check if haptics are available
      return Platform.OS === 'ios' || Platform.OS === 'android';
    } catch (error) {
      return false;
    }
  }

  private async checkBiometricsCapability(): Promise<boolean> {
    try {
      // This would require checking for biometric hardware
      return Platform.OS === 'ios' || Platform.OS === 'android';
    } catch (error) {
      return false;
    }
  }

  private async getSupportedAudioFormats(): Promise<string[]> {
    const formats = ['m4a', 'mp3'];
    
    if (Platform.OS === 'ios') {
      formats.push('aac', 'wav');
    } else if (Platform.OS === 'android') {
      formats.push('ogg', 'webm');
    } else {
      formats.push('ogg', 'webm', 'wav');
    }
    
    return formats;
  }

  private async getMemoryClass(): Promise<string | undefined> {
    try {
      // This would require native modules to get actual memory info
      // For now, we'll make educated guesses based on platform
      if (Platform.OS === 'ios') {
        return 'high'; // iOS devices generally have good memory management
      } else if (Platform.OS === 'android') {
        return 'medium'; // Android varies widely
      }
      return 'unknown';
    } catch (error) {
      return undefined;
    }
  }

  // Check all features
  private async checkAllFeatures(): Promise<void> {
    const features = Object.values(FeatureType);
    
    for (const feature of features) {
      try {
        const featureInfo = await this.checkFeature(feature);
        this.featureStatus.set(feature, featureInfo);
      } catch (error) {
        console.warn(`Failed to check feature ${feature}:`, error);
      }
    }
  }

  // Check individual feature
  public async checkFeature(feature: FeatureType): Promise<FeatureInfo> {
    try {
      switch (feature) {
        case FeatureType.AUDIO_RECORDING:
          return this.checkAudioRecording();
        case FeatureType.AUDIO_PLAYBACK:
          return this.checkAudioPlayback();
        case FeatureType.VOICE_RECOGNITION:
          return this.checkVoiceRecognition();
        case FeatureType.TEXT_TO_SPEECH:
          return this.checkTextToSpeech();
        case FeatureType.INTERNET_CONNECTION:
          return this.checkInternetConnection();
        case FeatureType.OPENAI_API:
          return this.checkOpenAIAPI();
        case FeatureType.FILE_SHARING:
          return this.checkFileSharing();
        case FeatureType.LOCAL_STORAGE:
          return this.checkLocalStorage();
        case FeatureType.SECURE_STORAGE:
          return this.checkSecureStorage();
        case FeatureType.FILE_SYSTEM:
          return this.checkFileSystem();
        case FeatureType.HAPTIC_FEEDBACK:
          return this.checkHapticFeedback();
        case FeatureType.BIOMETRIC_AUTH:
          return this.checkBiometricAuth();
        case FeatureType.PUSH_NOTIFICATIONS:
          return this.checkPushNotifications();
        case FeatureType.BACKGROUND_APP_REFRESH:
          return this.checkBackgroundAppRefresh();
        case FeatureType.CAMERA:
          return this.checkCamera();
        case FeatureType.LOCATION:
          return this.checkLocation();
        default:
          return this.createUnsupportedFeature(feature);
      }
    } catch (error) {
      return this.createErrorFeature(feature, error);
    }
  }

  // Feature check implementations
  private checkAudioRecording(): FeatureInfo {
    const hasMicrophone = this.deviceCapabilities?.hasMicrophone || false;
    const isSupported = Platform.OS !== 'web' || hasMicrophone;

    if (!isSupported) {
      return {
        type: FeatureType.AUDIO_RECORDING,
        status: FeatureStatus.NOT_SUPPORTED,
        isEnabled: false,
        isSupported: false,
        requiresPermission: false,
        fallbackAvailable: true,
        fallbackFeature: FeatureType.LOCAL_STORAGE,
        userMessage: 'Voice recording is not supported on this device. You can still type messages.',
        actionRequired: 'Use text input instead',
      };
    }

    return {
      type: FeatureType.AUDIO_RECORDING,
      status: FeatureStatus.PERMISSION_REQUIRED,
      isEnabled: false,
      isSupported: true,
      requiresPermission: true,
      fallbackAvailable: true,
      fallbackFeature: FeatureType.LOCAL_STORAGE,
      userMessage: 'Microphone permission required for voice recording.',
      actionRequired: 'Grant microphone permission in settings',
    };
  }

  private checkAudioPlayback(): FeatureInfo {
    const hasSpeakers = this.deviceCapabilities?.hasSpeakers || false;

    return {
      type: FeatureType.AUDIO_PLAYBACK,
      status: hasSpeakers ? FeatureStatus.AVAILABLE : FeatureStatus.DEGRADED,
      isEnabled: hasSpeakers,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: true,
      degradationReason: hasSpeakers ? undefined : 'No audio output detected',
      userMessage: hasSpeakers ? undefined : 'Audio playback may not work properly. Check your audio settings.',
    };
  }

  private checkVoiceRecognition(): FeatureInfo {
    const hasInternet = this.deviceCapabilities?.hasInternet || false;
    const hasMicrophone = this.deviceCapabilities?.hasMicrophone || false;

    if (!hasMicrophone) {
      return {
        type: FeatureType.VOICE_RECOGNITION,
        status: FeatureStatus.NOT_SUPPORTED,
        isEnabled: false,
        isSupported: false,
        requiresPermission: false,
        fallbackAvailable: true,
        userMessage: 'Voice recognition requires a microphone.',
      };
    }

    if (!hasInternet) {
      return {
        type: FeatureType.VOICE_RECOGNITION,
        status: FeatureStatus.UNAVAILABLE,
        isEnabled: false,
        isSupported: true,
        requiresPermission: true,
        fallbackAvailable: true,
        userMessage: 'Voice recognition requires internet connection.',
        actionRequired: 'Connect to internet',
      };
    }

    return {
      type: FeatureType.VOICE_RECOGNITION,
      status: FeatureStatus.PERMISSION_REQUIRED,
      isEnabled: false,
      isSupported: true,
      requiresPermission: true,
      fallbackAvailable: true,
      userMessage: 'Microphone permission required for voice recognition.',
    };
  }

  private checkTextToSpeech(): FeatureInfo {
    const hasInternet = this.deviceCapabilities?.hasInternet || false;
    const hasSpeakers = this.deviceCapabilities?.hasSpeakers || false;

    if (!hasInternet) {
      return {
        type: FeatureType.TEXT_TO_SPEECH,
        status: FeatureStatus.UNAVAILABLE,
        isEnabled: false,
        isSupported: true,
        requiresPermission: false,
        fallbackAvailable: true,
        userMessage: 'Text-to-speech requires internet connection.',
        actionRequired: 'Connect to internet',
      };
    }

    return {
      type: FeatureType.TEXT_TO_SPEECH,
      status: hasSpeakers ? FeatureStatus.AVAILABLE : FeatureStatus.DEGRADED,
      isEnabled: true,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: true,
      degradationReason: hasSpeakers ? undefined : 'No audio output detected',
    };
  }

  private checkInternetConnection(): FeatureInfo {
    const hasInternet = this.deviceCapabilities?.hasInternet || false;

    return {
      type: FeatureType.INTERNET_CONNECTION,
      status: hasInternet ? FeatureStatus.AVAILABLE : FeatureStatus.UNAVAILABLE,
      isEnabled: hasInternet,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: true,
      userMessage: hasInternet ? undefined : 'No internet connection. Some features will be limited.',
      actionRequired: hasInternet ? undefined : 'Connect to WiFi or cellular data',
    };
  }

  private checkOpenAIAPI(): FeatureInfo {
    const hasInternet = this.deviceCapabilities?.hasInternet || false;
    // Would also check for API key configuration

    return {
      type: FeatureType.OPENAI_API,
      status: hasInternet ? FeatureStatus.AVAILABLE : FeatureStatus.UNAVAILABLE,
      isEnabled: hasInternet,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: false,
      userMessage: hasInternet ? undefined : 'OpenAI API requires internet connection.',
      actionRequired: hasInternet ? undefined : 'Connect to internet',
    };
  }

  private checkFileSharing(): FeatureInfo {
    const isSupported = Platform.OS !== 'web';

    return {
      type: FeatureType.FILE_SHARING,
      status: isSupported ? FeatureStatus.AVAILABLE : FeatureStatus.NOT_SUPPORTED,
      isEnabled: isSupported,
      isSupported,
      requiresPermission: false,
      fallbackAvailable: true,
      userMessage: isSupported ? undefined : 'File sharing is not supported in web browsers.',
    };
  }

  private checkLocalStorage(): FeatureInfo {
    return {
      type: FeatureType.LOCAL_STORAGE,
      status: FeatureStatus.AVAILABLE,
      isEnabled: true,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: false,
    };
  }

  private checkSecureStorage(): FeatureInfo {
    const hasSecureStorage = this.deviceCapabilities?.hasSecureStorage || false;

    return {
      type: FeatureType.SECURE_STORAGE,
      status: hasSecureStorage ? FeatureStatus.AVAILABLE : FeatureStatus.DEGRADED,
      isEnabled: true,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: true,
      fallbackFeature: FeatureType.LOCAL_STORAGE,
      degradationReason: hasSecureStorage ? undefined : 'Using less secure storage fallback',
      userMessage: hasSecureStorage ? undefined : 'Secure storage not available. Using fallback storage.',
    };
  }

  private checkFileSystem(): FeatureInfo {
    return {
      type: FeatureType.FILE_SYSTEM,
      status: FeatureStatus.AVAILABLE,
      isEnabled: true,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: false,
    };
  }

  private checkHapticFeedback(): FeatureInfo {
    const hasHaptics = this.deviceCapabilities?.hasHaptics || false;

    return {
      type: FeatureType.HAPTIC_FEEDBACK,
      status: hasHaptics ? FeatureStatus.AVAILABLE : FeatureStatus.NOT_SUPPORTED,
      isEnabled: hasHaptics,
      isSupported: hasHaptics,
      requiresPermission: false,
      fallbackAvailable: true,
      userMessage: hasHaptics ? undefined : 'Haptic feedback not supported on this device.',
    };
  }

  private checkBiometricAuth(): FeatureInfo {
    const hasBiometrics = this.deviceCapabilities?.hasBiometrics || false;

    return {
      type: FeatureType.BIOMETRIC_AUTH,
      status: hasBiometrics ? FeatureStatus.PERMISSION_REQUIRED : FeatureStatus.NOT_SUPPORTED,
      isEnabled: false,
      isSupported: hasBiometrics,
      requiresPermission: hasBiometrics,
      fallbackAvailable: true,
      userMessage: hasBiometrics ? 
        'Biometric authentication available but not configured.' : 
        'Biometric authentication not supported.',
    };
  }

  private checkPushNotifications(): FeatureInfo {
    const isSupported = Platform.OS !== 'web';

    return {
      type: FeatureType.PUSH_NOTIFICATIONS,
      status: isSupported ? FeatureStatus.PERMISSION_REQUIRED : FeatureStatus.NOT_SUPPORTED,
      isEnabled: false,
      isSupported,
      requiresPermission: isSupported,
      fallbackAvailable: true,
      userMessage: isSupported ? 
        'Push notifications require permission.' : 
        'Push notifications not supported in web browsers.',
    };
  }

  private checkBackgroundAppRefresh(): FeatureInfo {
    const isSupported = Platform.OS !== 'web';

    return {
      type: FeatureType.BACKGROUND_APP_REFRESH,
      status: isSupported ? FeatureStatus.AVAILABLE : FeatureStatus.NOT_SUPPORTED,
      isEnabled: isSupported,
      isSupported,
      requiresPermission: false,
      fallbackAvailable: true,
      userMessage: isSupported ? undefined : 'Background refresh not supported in web browsers.',
    };
  }

  private checkCamera(): FeatureInfo {
    // Camera is not used in this app, but included for completeness
    return {
      type: FeatureType.CAMERA,
      status: FeatureStatus.NOT_SUPPORTED,
      isEnabled: false,
      isSupported: false,
      requiresPermission: false,
      fallbackAvailable: false,
      userMessage: 'Camera not used in this application.',
    };
  }

  private checkLocation(): FeatureInfo {
    // Location is not used in this app, but included for completeness
    return {
      type: FeatureType.LOCATION,
      status: FeatureStatus.NOT_SUPPORTED,
      isEnabled: false,
      isSupported: false,
      requiresPermission: false,
      fallbackAvailable: false,
      userMessage: 'Location not used in this application.',
    };
  }

  // Helper methods for error cases
  private createUnsupportedFeature(feature: FeatureType): FeatureInfo {
    return {
      type: feature,
      status: FeatureStatus.NOT_SUPPORTED,
      isEnabled: false,
      isSupported: false,
      requiresPermission: false,
      fallbackAvailable: false,
      userMessage: `${feature} is not supported.`,
    };
  }

  private createErrorFeature(feature: FeatureType, error: any): FeatureInfo {
    return {
      type: feature,
      status: FeatureStatus.UNAVAILABLE,
      isEnabled: false,
      isSupported: true,
      requiresPermission: false,
      fallbackAvailable: true,
      degradationReason: `Error checking feature: ${error.message}`,
      userMessage: `Unable to check ${feature} availability.`,
    };
  }

  // Setup monitoring
  private setupFeatureMonitoring(): void {
    // Monitor network changes
    // Monitor permission changes
    // Monitor app state changes
    
    // Re-check features periodically
    setInterval(() => {
      this.recheckCriticalFeatures();
    }, 60000); // Every minute
  }

  private async recheckCriticalFeatures(): Promise<void> {
    const criticalFeatures = [
      FeatureType.INTERNET_CONNECTION,
      FeatureType.AUDIO_RECORDING,
      FeatureType.AUDIO_PLAYBACK,
    ];

    for (const feature of criticalFeatures) {
      try {
        const newStatus = await this.checkFeature(feature);
        const oldStatus = this.featureStatus.get(feature);

        if (!oldStatus || oldStatus.status !== newStatus.status) {
          this.featureStatus.set(feature, newStatus);
          this.notifyListeners(feature, newStatus);
        }
      } catch (error) {
        console.warn(`Failed to recheck feature ${feature}:`, error);
      }
    }
  }

  // Public API
  public isFeatureAvailable(feature: FeatureType): boolean {
    const featureInfo = this.featureStatus.get(feature);
    return featureInfo?.status === FeatureStatus.AVAILABLE || false;
  }

  public isFeatureEnabled(feature: FeatureType): boolean {
    const featureInfo = this.featureStatus.get(feature);
    return featureInfo?.isEnabled || false;
  }

  public getFeatureStatus(feature: FeatureType): FeatureInfo | null {
    return this.featureStatus.get(feature) || null;
  }

  public getAllFeatureStatuses(): Map<FeatureType, FeatureInfo> {
    return new Map(this.featureStatus);
  }

  public getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities;
  }

  public async enableFeature(feature: FeatureType): Promise<boolean> {
    const featureInfo = this.featureStatus.get(feature);
    
    if (!featureInfo || !featureInfo.isSupported) {
      this.errorHandler.handleError(
        this.errorHandler.createNetworkError(ErrorType.FEATURE_NOT_SUPPORTED, { feature })
      );
      return false;
    }

    if (featureInfo.requiresPermission) {
      // Handle permission request
      // This would integrate with permission services
      console.log(`Requesting permission for ${feature}`);
    }

    // Re-check feature after attempting to enable
    const newStatus = await this.checkFeature(feature);
    this.featureStatus.set(feature, newStatus);
    this.notifyListeners(feature, newStatus);

    return newStatus.isEnabled;
  }

  public getFallbackFeature(feature: FeatureType): FeatureType | null {
    const featureInfo = this.featureStatus.get(feature);
    return featureInfo?.fallbackFeature || null;
  }

  public getCompatibilityReport(): {
    supportedFeatures: FeatureType[];
    unsupportedFeatures: FeatureType[];
    degradedFeatures: FeatureType[];
    permissionRequired: FeatureType[];
  } {
    const supported: FeatureType[] = [];
    const unsupported: FeatureType[] = [];
    const degraded: FeatureType[] = [];
    const permissionRequired: FeatureType[] = [];

    for (const [feature, info] of this.featureStatus) {
      switch (info.status) {
        case FeatureStatus.AVAILABLE:
          supported.push(feature);
          break;
        case FeatureStatus.NOT_SUPPORTED:
          unsupported.push(feature);
          break;
        case FeatureStatus.DEGRADED:
          degraded.push(feature);
          break;
        case FeatureStatus.PERMISSION_REQUIRED:
          permissionRequired.push(feature);
          break;
      }
    }

    return {
      supportedFeatures: supported,
      unsupportedFeatures: unsupported,
      degradedFeatures: degraded,
      permissionRequired,
    };
  }

  // Event listeners
  public addFeatureListener(
    listener: (feature: FeatureType, status: FeatureInfo) => void
  ): void {
    this.listeners.push(listener);
  }

  public removeFeatureListener(
    listener: (feature: FeatureType, status: FeatureInfo) => void
  ): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(feature: FeatureType, status: FeatureInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener(feature, status);
      } catch (error) {
        console.error('Error in feature listener:', error);
      }
    });
  }
}