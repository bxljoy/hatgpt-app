# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a prototype voice-enabled ChatGPT-like application that integrates speech-to-text, AI conversation, and text-to-speech capabilities.

## Architecture

The application follows a multi-tier architecture:

### Frontend (Mobile/Desktop App)
- Voice input capture using device microphone
- Audio playback for AI responses  
- Chat interface for text display
- Real-time audio visualization during recording

### Backend Services
- Speech-to-Text (STT) service
- Large Language Model API integration
- Text-to-Speech (TTS) service
- User session management
- Audio processing pipeline

### Third-Party APIs
- OpenAI API (for GPT models)
- Speech services (OpenAI Whisper, Google Speech-to-Text, or Azure Speech)
- Voice synthesis services (OpenAI TTS, ElevenLabs, or cloud providers)

## Development Notes

This is currently a prototype application without established build commands or testing frameworks. The codebase structure is minimal and focused on exploring the core voice-AI interaction concept.

When implementing features, consider the real-time nature of voice interactions and the need to handle audio processing, API latency, and user experience smoothly across the entire voice-to-response pipeline.

## Dependencies

The project uses modern Expo audio APIs:
- `expo-audio` for audio recording (replaces deprecated `expo-av`)
- `expo-haptics` for haptic feedback
- `expo-blur` for UI blur effects
- `expo-linear-gradient` for visual gradients

## Audio Recording

Audio recording functionality is implemented using the new `expo-audio` package with proper iOS permission handling and modern audio session configuration. The recording system includes:

- Real-time duration tracking
- File size monitoring
- State management (idle, recording, processing, error)
- Automatic cleanup of temporary files
- Cross-platform permission handling

## Common Commands

Since this is a prototype, there are no established build or test commands yet. Use standard Expo commands:
- `npm start` - Start the development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator