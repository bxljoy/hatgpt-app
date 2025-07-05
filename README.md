I want to build a voice-enabled ChatGPT-like app by breaking down the key components and workflows involved.

Core Architecture

The app consists of several key components working together:

Frontend (Mobile/Desktop App)

Voice input capture using device microphone
Audio playback for AI responses
Chat interface for text display
Real-time audio visualization during recording
Backend Services

Speech-to-Text (STT) service
Large Language Model API
Text-to-Speech (TTS) service
User session management
Audio processing pipeline
Third-Party APIs

OpenAI API (for GPT models)
Speech services (OpenAI Whisper, Google Speech-to-Text, or Azure Speech)
Voice synthesis services (OpenAI TTS, ElevenLabs, or cloud providers)

Just a prototype app

I'll create a detailed step-by-step development plan with specific prompts for Claude Code/Cursor to help you build a React Native ChatGPT-like app with voice capabilities.

## Complete Development Plan with Claude Code Prompts

### Phase 1: Project Setup & Basic Structure (Days 1-2)

**Step 1.1: Initialize Project** done
```
Prompt for Claude Code:
"Create a new React Native project with Expo and TypeScript for a ChatGPT-like voice chat app. Include:
- Basic folder structure with components, screens, services, and types directories
- TypeScript configuration optimized for React Native
- Essential dependencies: expo-av, axios, @react-native-async-storage/async-storage
- Environment variable setup for OpenAI API key
- Basic navigation setup with React Navigation
- Show me the complete package.json and project structure"
```

**Step 1.2: Create Base Types and Interfaces** done
```
Prompt for Claude Code:
"Create TypeScript interfaces for a ChatGPT-like app including:
- Message interface (id, content, role, timestamp, audioUrl?)
- Conversation interface (id, messages, title, createdAt)
- OpenAI API request/response types for chat completions
- Audio recording state types
- App state management types
- Export all types from a central types/index.ts file"
```

### Phase 2: Basic Chat Interface (Days 3-4)

**Step 2.1: Create Chat UI Components** done
```
Prompt for Claude Code:
"Create React Native components for a chat interface:
- MessageBubble component with user/assistant styling
- ChatInput component with text input and send button
- ChatScreen component with FlatList for messages
- Use modern React Native styling with proper iOS design guidelines
- Include loading states and error handling
- Make it responsive for both iPhone and iPad
- Add proper keyboard avoiding behavior"
```

**Step 2.2: Implement OpenAI Text Chat** done
```
Prompt for Claude Code:
"Create an OpenAI service class for React Native that:
- Handles chat completions API calls using axios
- Manages conversation context and message history
- Includes proper error handling and retry logic
- Implements rate limiting and request queuing
- Uses environment variables for API key
- Returns properly typed responses
- Includes methods for both single messages and conversation context"
```

### Phase 3: Audio Recording Implementation (Days 5-6)

**Step 3.1: Audio Recording Setup** done
```
Prompt for Claude Code:
"Implement audio recording functionality in React Native using expo-av:
- Create AudioRecorder hook with start/stop recording
- Handle audio permissions properly for iOS
- Implement audio file management (create, cleanup temp files)
- Add recording state management (idle, recording, processing)
- Create visual feedback component for recording state
- Include proper error handling for permission denials
- Add recording duration timer and file size management"
```

**Step 3.2: Voice Input UI Components** done
```
Prompt for Claude Code:
"Create React Native voice input components:
- VoiceRecordButton with animated recording states
- Audio waveform visualization during recording
- Recording timer display component
- Voice input modal/overlay with modern iOS design
- Proper haptic feedback for recording start/stop
- Loading states for audio processing
- Error states with retry functionality"
```

### Phase 4: Speech-to-Text Integration (Days 7-8)

**Step 4.1: OpenAI Whisper Integration** done
```
Prompt for Claude Code:
"Implement OpenAI Whisper API integration for React Native:
- Create service function to upload audio files to Whisper API
- Handle multipart form data for audio file uploads
- Implement proper error handling for API failures
- Add retry logic for network issues
- Create progress tracking for upload/processing
- Handle different audio formats and file size limits
- Include transcription confidence handling"
```

**Step 4.2: Voice-to-Text Workflow** done
```
Prompt for Claude Code:
"Create complete voice-to-text workflow:
- Integrate audio recording with Whisper API
- Create unified hook for record -> transcribe -> display flow
- Add loading states during transcription
- Implement fallback error handling
- Create smooth user experience with proper feedback
- Add ability to edit transcribed text before sending
- Include voice input cancellation functionality"
```

### Phase 5: Text-to-Speech Implementation (Days 9-10)

**Step 5.1: OpenAI TTS Integration** done
```
Prompt for Claude Code:
"Implement OpenAI Text-to-Speech API integration:
- Create service for generating speech from text
- Handle audio file download and caching
- Implement different voice options (alloy, echo, nova, etc.)
- Add audio playback controls (play, pause, stop)
- Create audio queue management for long responses
- Include proper error handling and fallbacks
- Add speech rate and voice selection settings"
```

**Step 5.2: Voice Output UI** done
```
Prompt for Claude Code: 
"Create voice output components for React Native:
- Audio playback controls component
- Speaking indicator with animation
- Voice selection settings screen
- Audio progress indicator
- Interrupt/stop speaking functionality
- Volume control integration
- Visual feedback for audio playback states"
```

### Phase 6: Advanced Features (Days 11-12)

**Step 6.1: Conversation Management** done
```
Prompt for Claude Code:
"Implement conversation history and management:
- Create conversation storage using AsyncStorage
- Add conversation list screen with search functionality
- Implement conversation deletion and editing
- Create conversation export/sharing features
- Add conversation titles generation using OpenAI
- Include conversation backup/restore functionality
- Add conversation statistics and usage tracking"
```

**Step 6.2: App Settings and Configuration** done
```
Prompt for Claude Code:
"Create app settings and configuration system:
- Settings screen with sections for API, Voice, and App preferences
- API key management with secure storage
- Voice settings (speed, voice type, auto-play)
- App theme and appearance settings
- Audio quality and recording settings
- Privacy and data management settings
- About screen with app information"
```

### Phase 7: Polish and Testing (Days 13-14)

**Step 7.1: Error Handling and Edge Cases** done
```
Prompt for Claude Code:
"Implement comprehensive error handling:
- Network connectivity error handling
- API rate limit handling with user feedback
- Audio permission denied scenarios
- Low storage space handling
- Background app state management
- Memory management for audio files
- Graceful degradation for missing features
- User-friendly error messages and recovery options"
```

**Step 7.2: Performance Optimization** done
```
Prompt for Claude Code:
"Optimize React Native app performance:
- Implement proper component memoization
- Add lazy loading for conversation history
- Optimize audio file handling and cleanup
- Add proper loading states and skeleton screens
- Implement efficient re-rendering strategies
- Add performance monitoring and debugging tools
- Optimize bundle size and startup time
- Add proper memory leak prevention"
```

### Phase 8: Final Integration and Testing (Days 15-16)

**Step 8.1: Complete App Integration**
```
Prompt for Claude Code:
"Create final app integration and testing:
- Integrate all components into complete app flow
- Add proper navigation between all screens
- Implement deep linking for conversations
- Add app state persistence and restoration
- Create comprehensive testing scenarios
- Add debugging tools and logging
- Implement proper app lifecycle management
- Add accessibility features for VoiceOver"
```

**Step 8.2: Deployment Preparation**
```
Prompt for Claude Code:
"Prepare React Native app for deployment:
- Configure app icons and splash screens
- Set up proper build configurations
- Add App Store metadata and descriptions
- Create deployment scripts and documentation
- Add privacy policy and terms of service
- Configure analytics and crash reporting
- Add proper certificate and provisioning setup
- Create testing and beta distribution setup"
```

## Usage Instructions for Claude Code

1. **Start each session** by providing context: "I'm building a React Native ChatGPT-like app with voice capabilities using OpenAI APIs"

2. **Use the prompts sequentially** - each builds on the previous work

3. **After each prompt**, ask Claude Code to explain the implementation and suggest improvements

4. **Request specific file structures** when needed: "Show me the complete file structure for this component"

5. **Ask for debugging help**: "Help me debug this audio recording issue" with specific error messages

6. **Request code reviews**: "Review this OpenAI integration code for best practices and security"

This plan will give you a fully functional prototype in about 2-3 weeks of focused development, with each step building logically on the previous one.
