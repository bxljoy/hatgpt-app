import NetInfo from '@react-native-community/netinfo';
import { ErrorHandlingService } from './errorHandling';
import { ErrorType } from '@/types/errors';

interface NetworkRequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  requiresNetwork?: boolean;
  fallbackOffline?: boolean;
}

interface NetworkResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  fromCache?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class NetworkService {
  private static instance: NetworkService;
  private errorHandler: ErrorHandlingService;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private ongoingRequests: Map<string, Promise<any>> = new Map();

  private constructor() {
    this.errorHandler = ErrorHandlingService.getInstance();
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  // Main request method with comprehensive error handling
  public async request<T>(
    url: string,
    options: RequestInit & NetworkRequestConfig = {}
  ): Promise<NetworkResponse<T>> {
    const {
      timeout = 30000,
      retries = 3,
      retryDelay = 1000,
      requiresNetwork = true,
      fallbackOffline = false,
      ...fetchOptions
    } = options;

    // Check network connectivity
    if (requiresNetwork) {
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        if (fallbackOffline) {
          const cachedData = this.getFromCache<T>(url);
          if (cachedData) {
            return {
              data: cachedData,
              status: 200,
              headers: {},
              fromCache: true,
            };
          }
        }
        throw this.errorHandler.createNetworkError(ErrorType.NETWORK_OFFLINE);
      }
    }

    // Check for ongoing request to prevent duplicates
    const requestKey = this.generateRequestKey(url, fetchOptions);
    const ongoingRequest = this.ongoingRequests.get(requestKey);
    if (ongoingRequest) {
      return ongoingRequest;
    }

    // Create the request promise
    const requestPromise = this.executeRequest<T>(
      url,
      fetchOptions,
      timeout,
      retries,
      retryDelay
    );

    // Store ongoing request
    this.ongoingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove completed request
      this.ongoingRequests.delete(requestKey);
    }
  }

  // Execute request with retries and timeout
  private async executeRequest<T>(
    url: string,
    options: RequestInit,
    timeout: number,
    retries: number,
    retryDelay: number
  ): Promise<NetworkResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const error = await this.handleHttpError(response, url);
          throw error;
        }

        // Parse response
        const data = await this.parseResponse<T>(response);

        // Cache successful responses
        this.cacheResponse(url, data);

        return {
          data,
          status: response.status,
          headers: this.parseHeaders(response.headers),
        };

      } catch (error) {
        lastError = error as Error;

        // Handle specific error types
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw this.errorHandler.createNetworkError(
              ErrorType.NETWORK_TIMEOUT,
              { url, attempt: attempt + 1, timeout }
            );
          }

          // Network connectivity issues
          if (error.message.includes('Network request failed')) {
            const networkState = await NetInfo.fetch();
            if (!networkState.isConnected) {
              throw this.errorHandler.createNetworkError(ErrorType.NETWORK_OFFLINE);
            }
          }
        }

        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    throw lastError || new Error('Request failed after all retries');
  }

  // Handle HTTP errors and convert to AppErrors
  private async handleHttpError(response: Response, url: string): Promise<never> {
    const status = response.status;
    let errorData: any = {};

    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { message: await response.text() };
      }
    } catch (e) {
      errorData = { message: 'Unknown error' };
    }

    // OpenAI API specific errors
    if (url.includes('api.openai.com')) {
      switch (status) {
        case 401:
          throw this.errorHandler.createAPIError(ErrorType.API_INVALID_KEY, {
            url,
            status,
            error: errorData,
          });
        case 429:
          throw this.errorHandler.createAPIError(ErrorType.API_RATE_LIMIT, {
            url,
            status,
            error: errorData,
            retryAfter: response.headers.get('retry-after'),
          });
        case 402:
          throw this.errorHandler.createAPIError(ErrorType.API_INSUFFICIENT_FUNDS, {
            url,
            status,
            error: errorData,
          });
        case 503:
          throw this.errorHandler.createAPIError(ErrorType.API_MODEL_OVERLOADED, {
            url,
            status,
            error: errorData,
          });
        case 500:
        case 502:
        case 504:
          throw this.errorHandler.createAPIError(ErrorType.API_SERVER_ERROR, {
            url,
            status,
            error: errorData,
          });
      }
    }

    // Generic HTTP errors
    throw new Error(`HTTP ${status}: ${errorData.message || 'Request failed'}`);
  }

  // Parse response based on content type
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    if (contentType?.includes('text/')) {
      return response.text() as unknown as T;
    }

    if (contentType?.includes('application/octet-stream') || 
        contentType?.includes('audio/')) {
      return response.blob() as unknown as T;
    }

    // Default to JSON
    return response.json();
  }

  // Parse response headers
  private parseHeaders(headers: Headers): Record<string, string> {
    const headerObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    return headerObj;
  }

  // Check if error should not be retried
  private shouldNotRetry(error: any): boolean {
    // Don't retry authentication errors
    if (error.type === ErrorType.API_INVALID_KEY) {
      return true;
    }

    // Don't retry quota/billing errors
    if (error.type === ErrorType.API_QUOTA_EXCEEDED || 
        error.type === ErrorType.API_INSUFFICIENT_FUNDS) {
      return true;
    }

    // Don't retry validation errors
    if (error.type === ErrorType.VALIDATION_ERROR) {
      return true;
    }

    return false;
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  // Cache management
  private cacheResponse<T>(url: string, data: T, ttl: number = 300000): void {
    // Only cache GET requests
    const now = Date.now();
    this.cache.set(url, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });

    // Clean up expired cache entries
    this.cleanupCache();
  }

  private getFromCache<T>(url: string): T | null {
    const entry = this.cache.get(url);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(url);
      return null;
    }

    return entry.data;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Specialized request methods
  public async get<T>(url: string, config?: NetworkRequestConfig): Promise<NetworkResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  public async post<T>(
    url: string, 
    data?: any, 
    config?: NetworkRequestConfig
  ): Promise<NetworkResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: typeof data === 'string' ? data : JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
    });
  }

  public async uploadFile<T>(
    url: string,
    file: Blob | FormData,
    config?: NetworkRequestConfig
  ): Promise<NetworkResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: file,
      // Don't set Content-Type for FormData, let the browser set it
    });
  }

  // Network monitoring
  public async checkConnectivity(): Promise<boolean> {
    try {
      const networkState = await NetInfo.fetch();
      return networkState.isConnected || false;
    } catch (error) {
      return false;
    }
  }

  public async getNetworkInfo(): Promise<any> {
    try {
      return await NetInfo.fetch();
    } catch (error) {
      return null;
    }
  }

  // Cache management
  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public getCacheInfo(): Array<{key: string, size: number, age: number}> {
    const now = Date.now();
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: JSON.stringify(entry.data).length,
      age: now - entry.timestamp,
    }));
  }
}