import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

interface AudioCleanupService {
  maxCacheSize: number; // in bytes
  maxCacheAge: number; // in milliseconds
  audioDirectory: string;
}

class AudioCleanupManager {
  private config: AudioCleanupService;
  private activeRecordings: Set<string> = new Set();
  private audioObjects: Map<string, Audio.Sound> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<AudioCleanupService> = {}) {
    this.config = {
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
      audioDirectory: `${FileSystem.documentDirectory}audio/`,
      ...config,
    };

    this.ensureAudioDirectory();
    this.startPeriodicCleanup();
  }

  private async ensureAudioDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.config.audioDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.config.audioDirectory, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to create audio directory:', error);
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000);
  }

  public stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  public async performCleanup(): Promise<void> {
    try {
      await this.cleanupOldFiles();
      await this.cleanupLargeCache();
      await this.unloadInactiveAudio();
    } catch (error) {
      console.error('Audio cleanup failed:', error);
    }
  }

  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.config.audioDirectory);
      const now = Date.now();

      for (const fileName of files) {
        const filePath = `${this.config.audioDirectory}${fileName}`;
        
        // Skip active recordings
        if (this.activeRecordings.has(filePath)) {
          continue;
        }

        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && fileInfo.modificationTime) {
          const age = now - fileInfo.modificationTime * 1000;
          
          if (age > this.config.maxCacheAge) {
            await this.deleteAudioFile(filePath);
            console.log(`Deleted old audio file: ${fileName}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
    }
  }

  private async cleanupLargeCache(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.config.audioDirectory);
      let totalSize = 0;
      const fileInfos: Array<{ path: string; size: number; modificationTime: number }> = [];

      // Calculate total size and collect file info
      for (const fileName of files) {
        const filePath = `${this.config.audioDirectory}${fileName}`;
        
        // Skip active recordings
        if (this.activeRecordings.has(filePath)) {
          continue;
        }

        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && fileInfo.size && fileInfo.modificationTime) {
          const info = {
            path: filePath,
            size: fileInfo.size,
            modificationTime: fileInfo.modificationTime * 1000,
          };
          fileInfos.push(info);
          totalSize += fileInfo.size;
        }
      }

      // If cache is too large, delete oldest files first
      if (totalSize > this.config.maxCacheSize) {
        fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);
        
        for (const fileInfo of fileInfos) {
          if (totalSize <= this.config.maxCacheSize) {
            break;
          }
          
          await this.deleteAudioFile(fileInfo.path);
          totalSize -= fileInfo.size;
          console.log(`Deleted large cache file: ${fileInfo.path}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup large cache:', error);
    }
  }

  private async unloadInactiveAudio(): Promise<void> {
    try {
      const activeKeys = Array.from(this.audioObjects.keys());
      
      for (const key of activeKeys) {
        const sound = this.audioObjects.get(key);
        if (sound) {
          try {
            const status = await sound.getStatusAsync();
            if (status.isLoaded && !status.isPlaying) {
              await sound.unloadAsync();
              this.audioObjects.delete(key);
              console.log(`Unloaded inactive audio: ${key}`);
            }
          } catch (error) {
            // Audio object might be corrupted, remove it
            this.audioObjects.delete(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to unload inactive audio:', error);
    }
  }

  private async deleteAudioFile(filePath: string): Promise<void> {
    try {
      // First, unload any associated audio object
      const sound = this.audioObjects.get(filePath);
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          // Ignore unload errors
        }
        this.audioObjects.delete(filePath);
      }

      // Delete the file
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    } catch (error) {
      console.error(`Failed to delete audio file ${filePath}:`, error);
    }
  }

  public registerActiveRecording(filePath: string): void {
    this.activeRecordings.add(filePath);
  }

  public unregisterActiveRecording(filePath: string): void {
    this.activeRecordings.delete(filePath);
  }

  public registerAudioObject(key: string, sound: Audio.Sound): void {
    this.audioObjects.set(key, sound);
  }

  public unregisterAudioObject(key: string): void {
    const sound = this.audioObjects.get(key);
    if (sound) {
      sound.unloadAsync().catch(() => {
        // Ignore unload errors
      });
      this.audioObjects.delete(key);
    }
  }

  public async getCacheSize(): Promise<number> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.config.audioDirectory);
      let totalSize = 0;

      for (const fileName of files) {
        const filePath = `${this.config.audioDirectory}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  public async clearAllCache(): Promise<void> {
    try {
      // Unload all audio objects first
      for (const [key, sound] of this.audioObjects) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          // Ignore unload errors
        }
      }
      this.audioObjects.clear();

      // Delete all files except active recordings
      const files = await FileSystem.readDirectoryAsync(this.config.audioDirectory);
      
      for (const fileName of files) {
        const filePath = `${this.config.audioDirectory}${fileName}`;
        
        if (!this.activeRecordings.has(filePath)) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      }

      console.log('Audio cache cleared');
    } catch (error) {
      console.error('Failed to clear audio cache:', error);
    }
  }

  public getStats(): {
    activeRecordings: number;
    audioObjects: number;
    maxCacheSize: number;
    maxCacheAge: number;
  } {
    return {
      activeRecordings: this.activeRecordings.size,
      audioObjects: this.audioObjects.size,
      maxCacheSize: this.config.maxCacheSize,
      maxCacheAge: this.config.maxCacheAge,
    };
  }
}

// Singleton instance
let audioCleanupManager: AudioCleanupManager | null = null;

export function getAudioCleanupManager(): AudioCleanupManager {
  if (!audioCleanupManager) {
    audioCleanupManager = new AudioCleanupManager();
  }
  return audioCleanupManager;
}

export function createAudioCleanupManager(config?: Partial<AudioCleanupService>): AudioCleanupManager {
  return new AudioCleanupManager(config);
}

// Cleanup on app background/foreground
export function setupAudioCleanupLifecycle(): void {
  const manager = getAudioCleanupManager();
  
  // Note: In a real app, you'd want to listen to app state changes
  // This is a placeholder for that functionality
  console.log('Audio cleanup lifecycle setup completed');
}