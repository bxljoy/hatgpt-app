import axios, { AxiosInstance, AxiosError, AxiosProgressEvent } from 'axios';
import * as FileSystem from 'expo-file-system';
import {
  OpenAIWhisperRequest,
  OpenAIWhisperResponse,
  OpenAIError,
} from '@/types';

interface WhisperServiceConfig {
  apiKey: string;
  baseURL?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  maxFileSize?: number; // in bytes
  supportedFormats?: string[];
}

interface TranscriptionProgress {
  phase: 'validating' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  bytesUploaded?: number;
  totalBytes?: number;
  estimatedTimeRemaining?: number;
}

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  processing_time?: number;
}

interface TranscriptionOptions {
  model?: 'whisper-1';
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  onProgress?: (progress: TranscriptionProgress) => void;
  signal?: AbortSignal;
}

export class WhisperService {
  private axios: AxiosInstance;
  private config: Required<WhisperServiceConfig>;

  constructor(config: WhisperServiceConfig) {
    this.config = {
      baseURL: 'https://api.openai.com/v1',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 120000, // 2 minutes
      maxFileSize: 25 * 1024 * 1024, // 25MB (OpenAI limit)
      supportedFormats: ['.m4a', '.mp3', '.wav', '.webm', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg'],
      ...config,
    };

    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'User-Agent': 'HatGPT-App/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axios.interceptors.request.use(
      (config) => {
        console.log(`[Whisper] Making request to ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Whisper] Request error:', error);
        return Promise.reject(error);
      }
    );

    this.axios.interceptors.response.use(
      (response) => {
        console.log(`[Whisper] Response received with status ${response.status}`);
        return response;
      },
      (error: AxiosError) => {
        console.error('[Whisper] Response error:', error.response?.status, error.message);
        return Promise.reject(this.handleAxiosError(error));
      }
    );
  }

  private handleAxiosError(error: AxiosError): OpenAIError {
    const response = error.response;
    
    if (response?.data && typeof response.data === 'object' && 'error' in response.data) {
      return response.data as OpenAIError;
    }

    // Map common HTTP errors to OpenAI-style errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        error: {
          message: 'Request timeout. The audio file may be too large or the connection is slow.',
          type: 'timeout_error',
          param: null,
          code: 'timeout',
        },
      };
    }

    if (error.code === 'NETWORK_ERROR' || !response) {
      return {
        error: {
          message: 'Network error. Please check your internet connection.',
          type: 'network_error',
          param: null,
          code: 'network_error',
        },
      };
    }

    return {
      error: {
        message: error.message || 'An unexpected error occurred',
        type: 'unknown_error',
        param: null,
        code: error.code || null,
      },
    };
  }

  private async validateAudioFile(fileUri: string): Promise<{
    isValid: boolean;
    error?: string;
    fileInfo?: FileSystem.FileInfo;
  }> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (!fileInfo.exists) {
        return {
          isValid: false,
          error: 'Audio file not found',
        };
      }

      // Check file size
      if (fileInfo.size && fileInfo.size > this.config.maxFileSize) {
        const maxSizeMB = Math.round(this.config.maxFileSize / (1024 * 1024));
        const fileSizeMB = Math.round(fileInfo.size / (1024 * 1024));
        return {
          isValid: false,
          error: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
        };
      }

      // Check file format
      const fileExtension = fileUri.toLowerCase().substring(fileUri.lastIndexOf('.'));
      if (!this.config.supportedFormats.includes(fileExtension)) {
        return {
          isValid: false,
          error: `Unsupported audio format: ${fileExtension}. Supported formats: ${this.config.supportedFormats.join(', ')}`,
        };
      }

      return {
        isValid: true,
        fileInfo,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to validate audio file: ${error}`,
      };
    }
  }

  private createFormData(fileUri: string, options: TranscriptionOptions): FormData {
    const formData = new FormData();
    
    // Add the audio file
    const filename = fileUri.split('/').pop() || 'audio.m4a';
    const fileType = this.getMimeType(filename);
    
    formData.append('file', {
      uri: fileUri,
      type: fileType,
      name: filename,
    } as any);

    // Add required parameters
    formData.append('model', options.model || 'whisper-1');

    // Add optional parameters
    if (options.language) {
      formData.append('language', options.language);
    }
    
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    
    if (options.response_format) {
      formData.append('response_format', options.response_format);
    }
    
    if (options.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    return formData;
  }

  private getMimeType(filename: string): string {
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    const mimeTypes: Record<string, string> = {
      '.m4a': 'audio/m4a',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.webm': 'audio/webm',
      '.mp4': 'audio/mp4',
      '.mpeg': 'audio/mpeg',
      '.mpga': 'audio/mpeg',
      '.oga': 'audio/ogg',
      '.ogg': 'audio/ogg',
    };

    return mimeTypes[extension] || 'audio/m4a';
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount: number = 0,
    onProgress?: (progress: TranscriptionProgress) => void
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const shouldRetry = this.shouldRetryError(error, retryCount);
      
      if (!shouldRetry) {
        throw error;
      }

      const delay = this.calculateRetryDelay(retryCount);
      console.log(`[Whisper] Retrying request in ${delay}ms (attempt ${retryCount + 1})`);
      
      // Notify progress of retry
      onProgress?.({
        phase: 'uploading',
        progress: 0,
        estimatedTimeRemaining: delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.retryWithBackoff(operation, retryCount + 1, onProgress);
    }
  }

  private shouldRetryError(error: any, retryCount: number): boolean {
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    // Don't retry client errors (4xx) except for rate limits
    if (error.error?.type === 'invalid_request_error' || 
        error.error?.type === 'authentication_error') {
      return false;
    }

    // Retry network errors, timeouts, and server errors
    return error.error?.type === 'network_error' ||
           error.error?.type === 'timeout_error' ||
           error.error?.code === 'rate_limit_exceeded' ||
           (error.response?.status >= 500);
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    const maxDelay = 30000; // Cap at 30 seconds
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private parseTranscriptionResponse(
    response: any,
    processingStartTime: number
  ): TranscriptionResult {
    const processingTime = Date.now() - processingStartTime;
    
    if (typeof response === 'string') {
      // Simple text response
      return {
        text: response,
        processing_time: processingTime,
      };
    }

    // JSON response
    const result: TranscriptionResult = {
      text: response.text || '',
      language: response.language,
      duration: response.duration,
      processing_time: processingTime,
    };

    // Handle verbose JSON response with segments
    if (response.segments && Array.isArray(response.segments)) {
      result.segments = response.segments.map((segment: any) => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : 0,
      }));

      // Calculate overall confidence from segments
      if (result.segments.length > 0) {
        result.confidence = result.segments.reduce((sum, seg) => sum + seg.confidence, 0) / result.segments.length;
      }
    }

    return result;
  }

  /**
   * Transcribe an audio file using OpenAI Whisper API
   */
  public async transcribeAudio(
    fileUri: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const { onProgress, signal, ...requestOptions } = options;

    try {
      // Phase 1: Validation
      onProgress?.({
        phase: 'validating',
        progress: 0,
      });

      const validation = await this.validateAudioFile(fileUri);
      if (!validation.isValid) {
        throw {
          error: {
            message: validation.error,
            type: 'invalid_request_error',
            param: 'file',
            code: 'invalid_file',
          },
        };
      }

      onProgress?.({
        phase: 'validating',
        progress: 100,
      });

      // Phase 2: Prepare upload
      onProgress?.({
        phase: 'uploading',
        progress: 0,
        totalBytes: validation.fileInfo?.size,
      });

      const formData = this.createFormData(fileUri, requestOptions);

      // Phase 3: Upload and process
      const uploadOperation = async () => {
        return await this.axios.post<OpenAIWhisperResponse>('/audio/transcriptions', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          signal,
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              const uploadProgress = Math.round((progressEvent.loaded / progressEvent.total) * 80); // 80% for upload
              onProgress?.({
                phase: 'uploading',
                progress: uploadProgress,
                bytesUploaded: progressEvent.loaded,
                totalBytes: progressEvent.total,
              });
            }
          },
        });
      };

      // Execute with retry logic
      const response = await this.retryWithBackoff(uploadOperation, 0, onProgress);

      // Phase 4: Processing complete
      onProgress?.({
        phase: 'processing',
        progress: 90,
      });

      const result = this.parseTranscriptionResponse(response.data, startTime);

      onProgress?.({
        phase: 'completed',
        progress: 100,
      });

      return result;

    } catch (error) {
      onProgress?.({
        phase: 'error',
        progress: 0,
      });

      if (signal?.aborted) {
        throw {
          error: {
            message: 'Transcription was cancelled',
            type: 'cancelled_error',
            param: null,
            code: 'cancelled',
          },
        };
      }

      throw error;
    }
  }

  /**
   * Get estimated transcription time based on audio duration
   */
  public estimateTranscriptionTime(audioDurationMs: number): number {
    // Whisper typically processes audio faster than real-time
    // Estimate: 1 minute of audio ≈ 5-15 seconds processing time
    const baseTime = Math.max(audioDurationMs * 0.1, 2000); // Minimum 2 seconds
    const uploadTime = 3000; // Estimate 3 seconds for upload
    
    return baseTime + uploadTime;
  }

  /**
   * Check if a file format is supported
   */
  public isSupportedFormat(filename: string): boolean {
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return this.config.supportedFormats.includes(extension);
  }

  /**
   * Get maximum file size limit
   */
  public getMaxFileSize(): number {
    return this.config.maxFileSize;
  }

  /**
   * Format file size for display
   */
  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Update API key
   */
  public updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.axios.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  /**
   * Test the connection to Whisper API
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Note: We can't test Whisper without an actual audio file
      // So we'll test the general OpenAI API endpoint
      const response = await this.axios.get('/models', {
        timeout: 10000,
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('[Whisper] Connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let whisperServiceInstance: WhisperService | null = null;

export function getWhisperService(): WhisperService {
  if (!whisperServiceInstance) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set EXPO_PUBLIC_OPENAI_API_KEY in your environment variables.');
    }

    whisperServiceInstance = new WhisperService({
      apiKey,
    });
  }

  return whisperServiceInstance;
}

export function createWhisperService(config: WhisperServiceConfig): WhisperService {
  return new WhisperService(config);
}