import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AppState, AppStateStatus } from 'react-native';
import { ErrorHandlingService } from './errorHandling';
import { ErrorType } from '@/types/errors';

interface AudioConfig {
  quality: 'low' | 'medium' | 'high';
  maxDuration: number;
  maxFileSize: number;
  autoCleanup: boolean;
  memoryManagement: boolean;
}

interface AudioFile {
  uri: string;
  duration: number;
  size: number;
  quality: string;
  createdAt: Date;
  lastAccessed: Date;
}

interface MemoryStats {
  totalFiles: number;
  totalSize: number;
  cacheSize: number;
  activeRecordings: number;
  activePlayers: number;
}

export class AudioService {
  private static instance: AudioService;
  private errorHandler: ErrorHandlingService;
  private audioFiles: Map<string, AudioFile> = new Map();
  private activeRecordings: Map<string, any> = new Map();
  private activePlayers: Map<string, any> = new Map();
  private isInBackground = false;
  private memoryPressureLevel = 0; // 0-3, higher means more pressure
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private config: AudioConfig = {
    quality: 'medium',
    maxDuration: 300000, // 5 minutes
    maxFileSize: 10 * 1024 * 1024, // 10MB
    autoCleanup: true,
    memoryManagement: true,
  };

  private constructor() {
    this.errorHandler = ErrorHandlingService.getInstance();
    this.initializeAudioService();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  // Initialize audio service
  private async initializeAudioService(): Promise<void> {
    try {
      // Set up app state monitoring
      AppState.addEventListener('change', this.handleAppStateChange.bind(this));

      // Set up memory management
      if (this.config.memoryManagement) {
        this.startMemoryManagement();
      }

      // Set up auto cleanup
      if (this.config.autoCleanup) {
        this.startAutoCleanup();
      }

      // Load existing audio files
      await this.loadAudioFileIndex();

    } catch (error) {
      console.error('Failed to initialize audio service:', error);
    }
  }

  // Handle app state changes
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const wasInBackground = this.isInBackground;
    this.isInBackground = nextAppState !== 'active';

    if (this.isInBackground && !wasInBackground) {
      // App went to background
      this.handleAppBackgrounded();
    } else if (!this.isInBackground && wasInBackground) {
      // App came to foreground
      this.handleAppForegrounded();
    }
  }

  // Handle app backgrounded
  private async handleAppBackgrounded(): Promise<void> {
    try {
      // Pause all active recordings
      for (const [id, recording] of this.activeRecordings) {
        try {
          await recording.pauseAsync();
        } catch (error) {
          console.warn(`Failed to pause recording ${id}:`, error);
        }
      }

      // Pause all active players
      for (const [id, player] of this.activePlayers) {
        try {
          await player.pauseAsync();
        } catch (error) {
          console.warn(`Failed to pause player ${id}:`, error);
        }
      }

      // Clear cache to free memory
      await this.clearMemoryCache();

    } catch (error) {
      console.error('Error handling app backgrounded:', error);
    }
  }

  // Handle app foregrounded
  private async handleAppForegrounded(): Promise<void> {
    try {
      // Check audio permissions
      await this.checkAudioPermissions();

      // Resume audio session if needed
      await this.restoreAudioSession();

    } catch (error) {
      console.error('Error handling app foregrounded:', error);
    }
  }

  // Check and request audio permissions
  public async checkAudioPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      
      if (status !== 'granted') {
        const { status: newStatus } = await Audio.requestPermissionsAsync();
        
        if (newStatus !== 'granted') {
          throw this.errorHandler.createAudioError(
            ErrorType.AUDIO_PERMISSION_DENIED,
            { requestedPermission: 'microphone' }
          );
        }
      }

      return true;
    } catch (error: any) {
      if (error.type === ErrorType.AUDIO_PERMISSION_DENIED) {
        throw error;
      }
      throw this.errorHandler.createAudioError(
        ErrorType.AUDIO_PERMISSION_DENIED,
        { originalError: error }
      );
    }
  }

  // Start audio recording with comprehensive error handling
  public async startRecording(
    filename?: string,
    options: any = {}
  ): Promise<{id: string, uri: string}> {
    try {
      // Check permissions
      await this.checkAudioPermissions();

      // Check memory pressure
      if (this.memoryPressureLevel > 2) {
        await this.freeMemory();
      }

      // Check storage space
      await this.checkStorageSpace();

      // Check if audio device is available
      await this.checkAudioDeviceAvailability();

      // Generate unique ID and filename
      const id = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const actualFilename = filename || `${id}.m4a`;
      const uri = `${FileSystem.documentDirectory}${actualFilename}`;

      // Set up recording options
      const recordingOptions = {
        extension: '.m4a',
        sampleRate: this.getSampleRate(),
        numberOfChannels: 2,
        bitRate: this.getBitRate(),
        ...options,
      };

      // Create and start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();

      // Track the recording
      this.activeRecordings.set(id, recording);

      // Create audio file entry
      const audioFile: AudioFile = {
        uri,
        duration: 0,
        size: 0,
        quality: this.config.quality,
        createdAt: new Date(),
        lastAccessed: new Date(),
      };
      this.audioFiles.set(id, audioFile);

      return { id, uri };

    } catch (error: any) {
      if (error.type) {
        throw error; // Already an AppError
      }

      // Convert generic errors to audio errors
      if (error.message?.includes('busy')) {
        throw this.errorHandler.createAudioError(
          ErrorType.AUDIO_DEVICE_BUSY,
          { operation: 'record', originalError: error }
        );
      }

      throw this.errorHandler.createAudioError(
        ErrorType.AUDIO_RECORDING_FAILED,
        { operation: 'start', originalError: error }
      );
    }
  }

  // Stop audio recording
  public async stopRecording(id: string): Promise<AudioFile> {
    try {
      const recording = this.activeRecordings.get(id);
      if (!recording) {
        throw new Error(`Recording ${id} not found`);
      }

      // Stop the recording
      await recording.stopAndUnloadAsync();
      this.activeRecordings.delete(id);

      // Get file info
      const audioFile = this.audioFiles.get(id);
      if (!audioFile) {
        throw new Error(`Audio file ${id} not found`);
      }

      // Update file information
      const fileInfo = await FileSystem.getInfoAsync(audioFile.uri);
      if (fileInfo.exists) {
        audioFile.size = (fileInfo as any).size || 0;
        audioFile.lastAccessed = new Date();
        
        // Get duration (this would require audio analysis)
        // For now, we'll estimate based on time
        const recordingDuration = Date.now() - audioFile.createdAt.getTime();
        audioFile.duration = recordingDuration;

        this.audioFiles.set(id, audioFile);
        await this.saveAudioFileIndex();

        return audioFile;
      } else {
        throw new Error('Recording file not found');
      }

    } catch (error) {
      throw this.errorHandler.createAudioError(
        ErrorType.AUDIO_RECORDING_FAILED,
        { operation: 'stop', recordingId: id, originalError: error }
      );
    }
  }

  // Play audio file
  public async playAudio(
    uri: string,
    options: any = {}
  ): Promise<{id: string, player: any}> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }

      // Check memory pressure
      if (this.memoryPressureLevel > 2) {
        await this.freeMemory();
      }

      // Generate player ID
      const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create and start player
      const { sound: player } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, ...options }
      );

      // Track the player
      this.activePlayers.set(id, player);

      // Update last accessed time
      for (const [fileId, audioFile] of this.audioFiles) {
        if (audioFile.uri === uri) {
          audioFile.lastAccessed = new Date();
          this.audioFiles.set(fileId, audioFile);
          break;
        }
      }

      return { id, player };

    } catch (error: any) {
      if (error.message?.includes('not found')) {
        throw this.errorHandler.createAudioError(
          ErrorType.AUDIO_PLAYBACK_FAILED,
          { operation: 'play', uri, reason: 'file_not_found', originalError: error }
        );
      }

      throw this.errorHandler.createAudioError(
        ErrorType.AUDIO_PLAYBACK_FAILED,
        { operation: 'play', uri, originalError: error }
      );
    }
  }

  // Stop audio playback
  public async stopAudio(id: string): Promise<void> {
    try {
      const player = this.activePlayers.get(id);
      if (player) {
        await player.stopAsync();
        await player.unloadAsync();
        this.activePlayers.delete(id);
      }
    } catch (error) {
      console.warn(`Failed to stop audio player ${id}:`, error);
    }
  }

  // Memory management
  private startMemoryManagement(): void {
    // Monitor memory usage every 30 seconds
    setInterval(() => {
      this.checkMemoryPressure();
    }, 30000);
  }

  private async checkMemoryPressure(): Promise<void> {
    const memoryStats = this.getMemoryStats();
    
    // Simple heuristic for memory pressure
    if (memoryStats.totalSize > 50 * 1024 * 1024) { // 50MB
      this.memoryPressureLevel = 3;
    } else if (memoryStats.totalSize > 20 * 1024 * 1024) { // 20MB
      this.memoryPressureLevel = 2;
    } else if (memoryStats.totalSize > 10 * 1024 * 1024) { // 10MB
      this.memoryPressureLevel = 1;
    } else {
      this.memoryPressureLevel = 0;
    }

    // Handle high memory pressure
    if (this.memoryPressureLevel > 2) {
      this.errorHandler.handleError(this.errorHandler.createMemoryError());
      await this.freeMemory();
    }
  }

  private async freeMemory(): Promise<void> {
    try {
      // Stop inactive players
      for (const [id, player] of this.activePlayers) {
        try {
          const status = await player.getStatusAsync();
          if (!status.isPlaying) {
            await this.stopAudio(id);
          }
        } catch (error) {
          console.warn(`Failed to check player status ${id}:`, error);
        }
      }

      // Clear old cache files
      await this.clearOldCacheFiles();

      // Reduce memory pressure level
      this.memoryPressureLevel = Math.max(0, this.memoryPressureLevel - 1);

    } catch (error) {
      console.error('Failed to free memory:', error);
    }
  }

  // Storage management
  private async checkStorageSpace(): Promise<void> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const requiredSpace = this.config.maxFileSize;

      if (freeSpace < requiredSpace) {
        // Try to free up space
        await this.clearOldCacheFiles();
        
        // Check again
        const newFreeSpace = await FileSystem.getFreeDiskStorageAsync();
        if (newFreeSpace < requiredSpace) {
          throw this.errorHandler.createStorageError(
            ErrorType.STORAGE_FULL,
            { freeSpace: newFreeSpace, requiredSpace }
          );
        }
      }
    } catch (error: any) {
      if (error.type) {
        throw error; // Already an AppError
      }
      throw this.errorHandler.createStorageError(
        ErrorType.STORAGE_CORRUPTED,
        { operation: 'check_space', originalError: error }
      );
    }
  }

  // Auto cleanup
  private startAutoCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.performAutoCleanup();
    }, 5 * 60 * 1000);
  }

  private async performAutoCleanup(): Promise<void> {
    try {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [id, audioFile] of this.audioFiles) {
        const age = now - audioFile.lastAccessed.getTime();
        
        if (age > maxAge) {
          await this.deleteAudioFile(id);
        }
      }

      await this.saveAudioFileIndex();
    } catch (error) {
      console.error('Auto cleanup failed:', error);
    }
  }

  private async clearOldCacheFiles(): Promise<void> {
    try {
      const cacheDir = FileSystem.cacheDirectory!;
      const cacheContents = await FileSystem.readDirectoryAsync(cacheDir);
      
      for (const item of cacheContents) {
        if (item.endsWith('.m4a') || item.endsWith('.mp3')) {
          const filePath = `${cacheDir}${item}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists && fileInfo.modificationTime) {
            const age = Date.now() - fileInfo.modificationTime;
            const maxAge = 60 * 60 * 1000; // 1 hour
            
            if (age > maxAge) {
              await FileSystem.deleteAsync(filePath, { idempotent: true });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clear old cache files:', error);
    }
  }

  private async clearMemoryCache(): Promise<void> {
    try {
      // Stop all inactive players
      for (const [id, player] of this.activePlayers) {
        try {
          const status = await player.getStatusAsync();
          if (!status.isPlaying) {
            await this.stopAudio(id);
          }
        } catch (error) {
          console.warn(`Failed to stop player ${id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to clear memory cache:', error);
    }
  }

  // Utility methods
  private async checkAudioDeviceAvailability(): Promise<void> {
    try {
      // This is a simplified check
      // In a real implementation, you'd check for audio session conflicts
      if (this.activeRecordings.size > 0) {
        throw this.errorHandler.createAudioError(
          ErrorType.AUDIO_DEVICE_BUSY,
          { activeRecordings: this.activeRecordings.size }
        );
      }
    } catch (error: any) {
      if (error.type) {
        throw error;
      }
      throw this.errorHandler.createAudioError(
        ErrorType.AUDIO_DEVICE_BUSY,
        { originalError: error }
      );
    }
  }

  private async restoreAudioSession(): Promise<void> {
    try {
      // Restore audio session after app comes to foreground
      // This would involve re-initializing audio context
      console.log('Restoring audio session...');
    } catch (error) {
      console.warn('Failed to restore audio session:', error);
    }
  }

  private getSampleRate(): number {
    switch (this.config.quality) {
      case 'high': return 44100;
      case 'medium': return 22050;
      case 'low': return 16000;
      default: return 22050;
    }
  }

  private getBitRate(): number {
    switch (this.config.quality) {
      case 'high': return 256000;
      case 'medium': return 128000;
      case 'low': return 64000;
      default: return 128000;
    }
  }

  // Audio file management
  public async deleteAudioFile(id: string): Promise<void> {
    try {
      const audioFile = this.audioFiles.get(id);
      if (audioFile) {
        await FileSystem.deleteAsync(audioFile.uri, { idempotent: true });
        this.audioFiles.delete(id);
        await this.saveAudioFileIndex();
      }
    } catch (error) {
      console.warn(`Failed to delete audio file ${id}:`, error);
    }
  }

  public async deleteAllAudioFiles(): Promise<void> {
    try {
      for (const [id] of this.audioFiles) {
        await this.deleteAudioFile(id);
      }
    } catch (error) {
      console.error('Failed to delete all audio files:', error);
    }
  }

  // Index management
  private async loadAudioFileIndex(): Promise<void> {
    try {
      const indexPath = `${FileSystem.documentDirectory}audio_index.json`;
      const indexInfo = await FileSystem.getInfoAsync(indexPath);
      
      if (indexInfo.exists) {
        const indexData = await FileSystem.readAsStringAsync(indexPath);
        const parsed = JSON.parse(indexData);
        
        for (const [id, data] of Object.entries(parsed)) {
          this.audioFiles.set(id, {
            ...data as any,
            createdAt: new Date((data as any).createdAt),
            lastAccessed: new Date((data as any).lastAccessed),
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load audio file index:', error);
    }
  }

  private async saveAudioFileIndex(): Promise<void> {
    try {
      const indexPath = `${FileSystem.documentDirectory}audio_index.json`;
      const indexData = Object.fromEntries(this.audioFiles);
      await FileSystem.writeAsStringAsync(indexPath, JSON.stringify(indexData));
    } catch (error) {
      console.warn('Failed to save audio file index:', error);
    }
  }

  // Public API
  public getMemoryStats(): MemoryStats {
    let totalSize = 0;
    for (const audioFile of this.audioFiles.values()) {
      totalSize += audioFile.size;
    }

    return {
      totalFiles: this.audioFiles.size,
      totalSize,
      cacheSize: 0, // Would need to calculate cache size
      activeRecordings: this.activeRecordings.size,
      activePlayers: this.activePlayers.size,
    };
  }

  public async getAllAudioFiles(): Promise<AudioFile[]> {
    return Array.from(this.audioFiles.values());
  }

  public updateConfig(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): AudioConfig {
    return { ...this.config };
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    try {
      // Stop all active recordings
      for (const [id] of this.activeRecordings) {
        await this.stopRecording(id);
      }

      // Stop all active players
      for (const [id] of this.activePlayers) {
        await this.stopAudio(id);
      }

      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Save index
      await this.saveAudioFileIndex();

    } catch (error) {
      console.error('Failed to cleanup audio service:', error);
    }
  }
}