# Voice Mode Implementation Guide

This document explains the ChatGPT-style blue-orb voice conversation mode implementation.

## Overview

The voice mode system provides a ChatGPT-like experience with:
- **Visual Overlay**: A blue orb interface that covers the chat screen
- **Voice States**: Idle, listening, processing, and speaking animations
- **Traditional API Flow**: Whisper STT → GPT-4 → TTS pipeline
- **Conversation Integration**: All voice messages save to normal chat history

## Components

### 1. VoiceConversationOverlay
The main overlay component that displays the animated blue orb interface.

**Key Features:**
- Animated blue orb with state-based colors
- Pulse animations for different states
- Smooth enter/exit transitions
- Swipe-to-close gesture support
- Text display for transcriptions and responses

**Usage:**
```tsx
<VoiceConversationOverlay
  isVisible={voiceModeState.isVoiceModeActive}
  voiceState={voiceModeState.voiceState}
  onClose={voiceModeActions.exitVoiceMode}
  onToggleListening={voiceModeActions.toggleListening}
  isListening={voiceModeState.isListening}
  currentText={voiceModeState.currentTranscription}
  responseText={voiceModeState.currentResponse}
/>
```

### 2. useVoiceMode Hook
Manages all voice mode state and functionality.

**Features:**
- Audio recording with expo-av
- OpenAI Whisper transcription
- OpenAI TTS speech synthesis
- State management for voice flow
- Error handling and permissions

**Usage:**
```tsx
const [voiceModeState, voiceModeActions] = useVoiceMode({
  enableHaptics: true,
  maxRecordingDuration: 60000,
  onTranscriptionComplete: (text) => {
    // Handle transcribed text
  },
  onError: (error) => {
    // Handle errors
  },
});
```

## Voice States

The system has four main states with corresponding animations:

1. **Idle**: Slow pulse, blue gradient - "Tap to speak"
2. **Listening**: Fast pulse, red gradient - "Listening..."
3. **Processing**: Ripple animation, orange gradient - "Thinking..."
4. **Speaking**: Variable pulse, green gradient - "Speaking..."

## API Integration

### Speech-to-Text (Whisper)
- Uses OpenAI Whisper API
- Records audio with expo-av
- Sends m4a files to `/audio/transcriptions`
- Returns plain text transcription

### Text-to-Speech
- Uses OpenAI TTS API
- Sends text to `/audio/speech`
- Plays MP3 response through expo-av
- Automatic cleanup of audio files

### Chat Completion
- Standard OpenAI Chat API
- Maintains conversation context
- Stores messages in normal format

## ChatScreen Integration

The ChatScreen has been enhanced with voice mode support:

1. **Voice Mode Button**: Green microphone button in header
2. **Automatic Integration**: Voice messages appear in chat history
3. **Response Playback**: AI responses are spoken when in voice mode
4. **State Synchronization**: Voice mode state syncs with chat state

## File Structure

```
src/
├── components/
│   ├── VoiceConversationOverlay.tsx  # Main overlay UI
│   └── VoiceModeExample.tsx          # Example usage
├── hooks/
│   └── useVoiceMode.ts               # Voice mode logic
└── screens/
    └── ChatScreen.tsx                # Updated with voice mode
```

## Configuration

### Environment Variables
Ensure these are set in your `.env`:
```
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key
```

### Permissions
The system automatically requests:
- Microphone access for recording
- Audio session permissions for playback

### Audio Settings
Default configuration:
- Recording quality: HIGH_QUALITY preset
- TTS voice: 'alloy'
- TTS format: MP3
- Max recording duration: 60 seconds

## Usage Examples

### Basic Integration
```tsx
// Add to any screen
const [voiceModeState, voiceModeActions] = useVoiceMode();

// Trigger voice mode
<TouchableOpacity onPress={voiceModeActions.enterVoiceMode}>
  <Text>Start Voice Mode</Text>
</TouchableOpacity>

// Add overlay
<VoiceConversationOverlay
  isVisible={voiceModeState.isVoiceModeActive}
  voiceState={voiceModeState.voiceState}
  onClose={voiceModeActions.exitVoiceMode}
  onToggleListening={voiceModeActions.toggleListening}
  isListening={voiceModeState.isListening}
/>
```

### Custom Configuration
```tsx
const [voiceModeState, voiceModeActions] = useVoiceMode({
  enableHaptics: true,
  maxRecordingDuration: 30000,
  onTranscriptionComplete: (text) => {
    console.log('Transcribed:', text);
    // Send to your chat system
  },
  onError: (error) => {
    Alert.alert('Voice Error', error);
  },
});
```

## Animations

The orb animations are implemented using React Native's Animated API:

- **Pulse**: Scale animation for breathing effect
- **Ripple**: Expanding circle for processing state
- **Color Transitions**: Gradient colors change based on state
- **Enter/Exit**: Smooth slide and fade animations

## Error Handling

Common error scenarios:
1. **Permission Denied**: Audio recording permission not granted
2. **API Errors**: OpenAI API failures (rate limits, invalid keys)
3. **Network Issues**: Connection problems during API calls
4. **Audio Playback**: Device audio session conflicts

## Performance Considerations

- Audio files are automatically cleaned up after use
- Recording timeout prevents excessively long recordings
- TTS audio is cached temporarily and deleted after playback
- Animations use native driver for smooth performance

## Customization

### Orb Colors
Modify `getOrbColor()` in VoiceConversationOverlay.tsx:
```tsx
const getOrbColor = (): string[] => {
  switch (voiceState) {
    case 'idle': return ['#007AFF', '#0056CC'];
    case 'listening': return ['#FF3B30', '#CC0000'];
    // Add custom colors
  }
};
```

### Animation Timing
Adjust animation durations in the component:
```tsx
Animated.timing(pulseAnim, {
  toValue: 1.2,
  duration: 800, // Customize duration
  useNativeDriver: true,
})
```

### Voice Settings
Configure TTS options in useVoiceMode.ts:
```tsx
body: JSON.stringify({
  model: 'tts-1-hd', // Higher quality
  voice: 'nova',     // Different voice
  speed: 1.2,        // Faster speech
})
```

This implementation provides a complete ChatGPT-style voice conversation experience that integrates seamlessly with your existing chat application.