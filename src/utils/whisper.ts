import * as FileSystem from 'expo-file-system';

// Audio format validation
export const SUPPORTED_AUDIO_FORMATS = [
  '.m4a', '.mp3', '.wav', '.webm', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg'
] as const;

export const AUDIO_FORMAT_DESCRIPTIONS = {
  '.m4a': 'AAC Audio (recommended)',
  '.mp3': 'MP3 Audio',
  '.wav': 'WAV Audio (uncompressed)',
  '.webm': 'WebM Audio',
  '.mp4': 'MP4 Audio',
  '.mpeg': 'MPEG Audio',
  '.mpga': 'MPEG Audio',
  '.oga': 'OGG Audio',
  '.ogg': 'OGG Audio',
} as const;

// File size limits
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (OpenAI limit)
export const RECOMMENDED_MAX_SIZE = 10 * 1024 * 1024; // 10MB (recommended for better performance)

// Language codes supported by Whisper
export const WHISPER_LANGUAGES = {
  'af': 'Afrikaans',
  'ar': 'Arabic',
  'hy': 'Armenian',
  'az': 'Azerbaijani',
  'be': 'Belarusian',
  'bs': 'Bosnian',
  'bg': 'Bulgarian',
  'ca': 'Catalan',
  'zh': 'Chinese',
  'hr': 'Croatian',
  'cs': 'Czech',
  'da': 'Danish',
  'nl': 'Dutch',
  'en': 'English',
  'et': 'Estonian',
  'fi': 'Finnish',
  'fr': 'French',
  'gl': 'Galician',
  'de': 'German',
  'el': 'Greek',
  'he': 'Hebrew',
  'hi': 'Hindi',
  'hu': 'Hungarian',
  'is': 'Icelandic',
  'id': 'Indonesian',
  'it': 'Italian',
  'ja': 'Japanese',
  'kn': 'Kannada',
  'kk': 'Kazakh',
  'ko': 'Korean',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'mk': 'Macedonian',
  'ms': 'Malay',
  'mr': 'Marathi',
  'mi': 'Maori',
  'ne': 'Nepali',
  'no': 'Norwegian',
  'fa': 'Persian',
  'pl': 'Polish',
  'pt': 'Portuguese',
  'ro': 'Romanian',
  'ru': 'Russian',
  'sr': 'Serbian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'es': 'Spanish',
  'sw': 'Swahili',
  'sv': 'Swedish',
  'tl': 'Tagalog',
  'ta': 'Tamil',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
  'ur': 'Urdu',
  'vi': 'Vietnamese',
  'cy': 'Welsh',
} as const;

export type WhisperLanguageCode = keyof typeof WHISPER_LANGUAGES;

// Validation functions
export function validateAudioFile(fileUri: string): Promise<{
  isValid: boolean;
  error?: string;
  warnings?: string[];
  fileInfo?: {
    size: number;
    format: string;
    sizeFormatted: string;
  };
}> {
  return new Promise(async (resolve) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (!fileInfo.exists) {
        return resolve({
          isValid: false,
          error: 'File does not exist',
        });
      }

      const fileSize = fileInfo.size || 0;
      const filename = fileUri.split('/').pop() || '';
      const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      
      const warnings: string[] = [];
      
      // Check file format
      if (!SUPPORTED_AUDIO_FORMATS.includes(fileExtension as any)) {
        return resolve({
          isValid: false,
          error: `Unsupported audio format: ${fileExtension}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`,
        });
      }

      // Check file size
      if (fileSize > MAX_FILE_SIZE) {
        return resolve({
          isValid: false,
          error: `File size (${formatFileSize(fileSize)}) exceeds maximum allowed size (${formatFileSize(MAX_FILE_SIZE)})`,
        });
      }

      // Add warnings for large files
      if (fileSize > RECOMMENDED_MAX_SIZE) {
        warnings.push(`Large file size (${formatFileSize(fileSize)}) may take longer to process`);
      }

      // Add warning for uncompressed formats
      if (['.wav'].includes(fileExtension)) {
        warnings.push('Uncompressed audio format detected. Consider using .m4a for smaller file sizes');
      }

      resolve({
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
        fileInfo: {
          size: fileSize,
          format: fileExtension,
          sizeFormatted: formatFileSize(fileSize),
        },
      });
    } catch (error) {
      resolve({
        isValid: false,
        error: `Failed to validate file: ${error}`,
      });
    }
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function isValidLanguageCode(code: string): code is WhisperLanguageCode {
  return code in WHISPER_LANGUAGES;
}

export function getLanguageName(code: string): string {
  if (isValidLanguageCode(code)) {
    return WHISPER_LANGUAGES[code];
  }
  return 'Unknown';
}

export function detectLanguageFromText(text: string): WhisperLanguageCode | null {
  // Simple language detection based on character patterns
  // This is a basic implementation - for production, use a proper language detection library
  
  if (!text || text.length < 10) return null;
  
  // Check for common language patterns
  const patterns: Array<[RegExp, WhisperLanguageCode]> = [
    [/[\u4e00-\u9fff]/, 'zh'], // Chinese characters
    [/[\u3040-\u309f\u30a0-\u30ff]/, 'ja'], // Japanese hiragana/katakana
    [/[\u0600-\u06ff]/, 'ar'], // Arabic
    [/[\u0400-\u04ff]/, 'ru'], // Cyrillic (Russian)
    [/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i, 'fr'], // French accents
    [/[äöüß]/i, 'de'], // German umlauts
    [/[ñáéíóúü]/i, 'es'], // Spanish accents
    [/[àáâãçéêíóôõú]/i, 'pt'], // Portuguese accents
  ];

  for (const [pattern, language] of patterns) {
    if (pattern.test(text)) {
      return language;
    }
  }

  // Default to English if no patterns match
  return 'en';
}

export function estimateTranscriptionCost(fileSizeBytes: number, durationSeconds?: number): {
  estimatedCost: number;
  costPerMinute: number;
  explanation: string;
} {
  // OpenAI Whisper pricing: $0.006 per minute
  const costPerMinute = 0.006;
  
  // Estimate duration if not provided (rough estimate based on file size and format)
  let estimatedDurationMinutes: number;
  
  if (durationSeconds) {
    estimatedDurationMinutes = durationSeconds / 60;
  } else {
    // Rough estimate: 1MB ≈ 1-2 minutes for compressed audio
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    estimatedDurationMinutes = fileSizeMB * 1.5; // Conservative estimate
  }
  
  const estimatedCost = estimatedDurationMinutes * costPerMinute;
  
  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100, // Round to 2 decimal places
    costPerMinute,
    explanation: `Estimated ${estimatedDurationMinutes.toFixed(1)} minutes at $${costPerMinute}/minute`,
  };
}

export function formatTranscriptionResult(result: {
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
}): {
  plainText: string;
  formattedText: string;
  summary: string;
  segments?: string;
} {
  const { text, language, duration, confidence, segments } = result;
  
  let summary = `Transcription completed`;
  if (language) {
    summary += ` (${getLanguageName(language)})`;
  }
  if (duration) {
    summary += ` - ${Math.round(duration)}s audio`;
  }
  if (confidence) {
    summary += ` - ${Math.round(confidence * 100)}% confidence`;
  }

  let formattedText = text;
  let segmentsText: string | undefined;

  if (segments && segments.length > 0) {
    // Create formatted text with timestamps
    formattedText = segments
      .map(segment => {
        const startTime = formatTimestamp(segment.start);
        const endTime = formatTimestamp(segment.end);
        const confidencePercent = Math.round(segment.confidence * 100);
        return `[${startTime}-${endTime}] (${confidencePercent}%) ${segment.text}`;
      })
      .join('\n');

    // Create segments summary
    segmentsText = `${segments.length} segments found:\n` + 
      segments
        .map((segment, index) => 
          `${index + 1}. ${formatTimestamp(segment.start)} - ${formatTimestamp(segment.end)}: "${segment.text.substring(0, 50)}${segment.text.length > 50 ? '...' : ''}"`
        )
        .join('\n');
  }

  return {
    plainText: text,
    formattedText,
    summary,
    segments: segmentsText,
  };
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function getOptimalTranscriptionSettings(
  fileSize: number,
  estimatedDuration?: number
): {
  responseFormat: 'json' | 'verbose_json';
  temperature: number;
  prompt?: string;
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let responseFormat: 'json' | 'verbose_json' = 'json';
  let temperature = 0; // Deterministic by default

  // For longer audio files, use verbose JSON to get segments
  if (estimatedDuration && estimatedDuration > 60) { // > 1 minute
    responseFormat = 'verbose_json';
    recommendations.push('Using verbose format for detailed timestamps on longer audio');
  }

  // For large files, add specific recommendations
  if (fileSize > RECOMMENDED_MAX_SIZE) {
    recommendations.push('Large file detected - consider splitting into smaller segments for faster processing');
  }

  // For very short audio (< 5 seconds), increase temperature slightly for better results
  if (estimatedDuration && estimatedDuration < 5) {
    temperature = 0.2;
    recommendations.push('Short audio detected - using slightly higher temperature for better transcription');
  }

  return {
    responseFormat,
    temperature,
    recommendations,
  };
}

// Error classification helpers
export function classifyWhisperError(error: any): {
  type: 'file_error' | 'network_error' | 'api_error' | 'quota_error' | 'unknown_error';
  message: string;
  isRetriable: boolean;
  suggestion: string;
} {
  const errorMessage = error?.error?.message || error?.message || 'Unknown error';
  const errorType = error?.error?.type || 'unknown_error';
  const errorCode = error?.error?.code;

  if (errorType === 'invalid_request_error') {
    if (errorMessage.includes('file') || errorMessage.includes('format')) {
      return {
        type: 'file_error',
        message: errorMessage,
        isRetriable: false,
        suggestion: 'Please check your audio file format and size. Supported formats: ' + SUPPORTED_AUDIO_FORMATS.join(', '),
      };
    }
  }

  if (errorType === 'rate_limit_exceeded' || errorCode === 'rate_limit_exceeded') {
    return {
      type: 'quota_error',
      message: 'Rate limit exceeded',
      isRetriable: true,
      suggestion: 'Please wait a moment before trying again. Consider upgrading your OpenAI plan for higher limits.',
    };
  }

  if (errorType === 'insufficient_quota') {
    return {
      type: 'quota_error',
      message: 'Insufficient quota',
      isRetriable: false,
      suggestion: 'Please check your OpenAI account balance and billing settings.',
    };
  }

  if (errorType === 'network_error' || errorCode === 'network_error') {
    return {
      type: 'network_error',
      message: 'Network connection error',
      isRetriable: true,
      suggestion: 'Please check your internet connection and try again.',
    };
  }

  if (errorType === 'timeout_error' || errorCode === 'timeout') {
    return {
      type: 'network_error',
      message: 'Request timeout',
      isRetriable: true,
      suggestion: 'The request timed out. Try with a smaller audio file or check your connection.',
    };
  }

  return {
    type: 'unknown_error',
    message: errorMessage,
    isRetriable: true,
    suggestion: 'An unexpected error occurred. Please try again.',
  };
}