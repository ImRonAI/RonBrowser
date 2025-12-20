# Voice Onboarding Agent

A bidirectional streaming voice agent using **Strands Agents SDK** and **Gemini Live** for conducting personalized browser onboarding interviews.

## Overview

This agent uses Google's Gemini Live API to conduct natural voice conversations with users during Ron Browser's onboarding flow. It collects user preferences, interests, and browsing habits to create a personalized browser experience.

## Architecture

Built with **Strands Agents SDK** following the official [Bidirectional Streaming Quickstart](https://docs.strands.dev/experimental/bidi/quickstart/).

### Key Components

- **Model**: `BidiGeminiLiveModel` - Gemini 2.0 Flash with native audio streaming
- **I/O**: `BidiAudioIO` + `BidiTextIO` - Microphone/speaker audio + console text output
- **Tools**:
  - `record_answer` - Saves user responses and advances to next question
  - `get_onboarding_summary` - Returns collected data as JSON
  - `stop_conversation` - Allows graceful conversation exit

### State Management

The `OnboardingState` class manages:
- Current question index
- Collected answers (question, answer, timestamp)
- Completion status

Data structure aligns with `/src/stores/onboardingStore.ts` schema.

## Prerequisites

1. **Python 3.12+**
2. **Audio hardware** (microphone and speakers)
3. **Google AI API Key** - Get one from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Installation

### 1. Install Dependencies

For macOS:
```bash
brew install portaudio
pip install -r requirements.txt
```

For Linux (Ubuntu/Debian):
```bash
sudo apt-get install portaudio19-dev
pip install -r requirements.txt
```

For Windows:
```bash
pip install -r requirements.txt
```

### 2. Configure API Key

Set your Google AI API key:
```bash
export GOOGLE_API_KEY=your_api_key_here
```

Or create a `.env` file:
```
GOOGLE_API_KEY=your_api_key_here
```

## Usage

### Basic Usage

Run the voice onboarding agent:

```bash
python agent.py
```

The agent will:
1. Welcome the user
2. Ask 8 onboarding questions sequentially
3. Collect and save each response
4. Generate a summary when complete

### Conversation Flow

1. Agent asks: "What brings you to Ron Browser today?"
2. User responds via microphone
3. Agent uses `record_answer` tool to save response
4. Agent asks next question automatically
5. Repeat for all 8 questions
6. Agent thanks user and completes onboarding

### Early Exit

Say **"stop conversation"** at any time to end the interview early.

Press **Ctrl+C** to force quit.

## Configuration

### Modify Interview Questions

Edit the `INTERVIEW_QUESTIONS` list in `agent.py`:

```python
INTERVIEW_QUESTIONS = [
    "What brings you to Ron Browser today?",
    "What topics are you most interested in?",
    # Add or modify questions here
]
```

**Important**: Keep questions in sync with `/src/stores/onboardingStore.ts`.

### Change Voice

Modify the `voice` parameter in the model config:

```python
model = BidiGeminiLiveModel(
    provider_config={
        "audio": {
            "voice": "Aoede",  # Options: Kore, Aoede, Charon, Fenrir, Puck
        },
    },
)
```

See [Gemini Live Voices](https://ai.google.dev/gemini-api/docs/models/gemini#available-voices) for full list.

### Adjust Audio Settings

Configure audio buffer and quality:

```python
audio_io = BidiAudioIO(
    input_buffer_size=10,           # Max input queue size
    output_buffer_size=20,          # Max output queue size
    input_frames_per_buffer=512,    # Input chunk size
    output_frames_per_buffer=512    # Output chunk size
)
```

## Output Format

The agent produces JSON output compatible with the Electron store:

```json
{
  "current_question_index": 8,
  "answers": [
    {
      "question": "What brings you to Ron Browser today?",
      "answer": "I'm looking for a more personalized browsing experience",
      "timestamp": 1234567890.123
    },
    // ... more answers
  ],
  "is_complete": true
}
```

## Integration with Electron

The voice onboarding agent runs as an HTTP server with CORS enabled, making it easy to integrate with the Electron app.

### Automatic Startup

The agent server **automatically starts** when you run `npm run dev`:

```bash
npm run dev
```

This runs both:
- **Electron app** (Vite dev server on port 5173)
- **Voice Agent Server** (FastAPI on port 8765)

### HTTP API Endpoints

Base URL: `http://127.0.0.1:8765`

**Health Check:**
```bash
GET /health
```

**Start Voice Agent:**
```bash
POST /agent/start
Body: { "api_key": "optional_if_in_env" }
```

**Stop Voice Agent:**
```bash
POST /agent/stop
Returns: { "status": "stopped", "onboarding_data": {...} }
```

**Get Agent Status:**
```bash
GET /agent/status
```

**Get Onboarding Data:**
```bash
GET /onboarding/data
```

**Clear Data:**
```bash
DELETE /onboarding/data
```

### TypeScript Client

Use the provided TypeScript client in your React components:

```typescript
import { voiceAgentClient } from '@/agents/voice_onboarding/agent_client'

// Check if server is running
const health = await voiceAgentClient.health()

// Start voice agent
await voiceAgentClient.startAgent()

// Get status
const status = await voiceAgentClient.getStatus()

// Stop and get results
const result = await voiceAgentClient.stopAgent()
```

### WebSocket Support

For real-time updates:

```typescript
const ws = voiceAgentClient.connectWebSocket({
  onOpen: () => console.log('Connected'),
  onMessage: (data) => console.log('Received:', data),
  onError: (error) => console.error('Error:', error),
  onClose: () => console.log('Disconnected')
})

// Send commands
ws.send(JSON.stringify({ type: 'start' }))
```

### Alternative: Subprocess Integration

For direct subprocess management (see `/agents/voice_onboarding/electron_bridge.ts`):

```typescript
import { VoiceOnboardingAgent } from '@/agents/voice_onboarding/electron_bridge'

const agent = new VoiceOnboardingAgent()
agent.on('completed', (result) => {
  // Handle onboarding completion
})
agent.start()
```

## Troubleshooting

### No Audio Output

List available audio devices:
```python
import pyaudio
p = pyaudio.PyAudio()
for i in range(p.get_device_count()):
    info = p.get_device_info_by_index(i)
    print(f"{i}: {info['name']}")
```

Specify device explicitly:
```python
audio_io = BidiAudioIO(output_device_index=2)
```

### Microphone Not Working

Check system permissions:
- **macOS**: System Preferences → Security & Privacy → Microphone
- **Linux**: Ensure user has audio group access
- **Windows**: Settings → Privacy → Microphone

Specify input device:
```python
audio_io = BidiAudioIO(input_device_index=1)
```

### API Key Errors

Verify your API key:
```bash
echo $GOOGLE_API_KEY
```

Get a new key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Module Not Found

Ensure Strands with Gemini support is installed:
```bash
pip install 'strands-agents[bidi-gemini]'
```

## Development

### Enable Debug Logs

Add to `agent.py`:
```python
import logging
logging.getLogger("strands").setLevel(logging.DEBUG)
logging.basicConfig(
    format="%(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler()]
)
```

### Add Custom Tools

Define new tools using the `@tool` decorator:

```python
@tool
def save_preference(preference: str, value: str) -> str:
    """Save a user preference."""
    # Implementation
    return f"Saved {preference} = {value}"

agent = BidiAgent(
    model=model,
    tools=[record_answer, save_preference, stop_conversation]
)
```

## References

- [Strands Bidirectional Streaming Quickstart](https://docs.strands.dev/experimental/bidi/quickstart/)
- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live)
- [BidiAgent API Reference](https://docs.strands.dev/api-reference/experimental/bidi/agent/)
- [Strands Tools Documentation](https://docs.strands.dev/core-concepts/tools/)

## License

Same as parent Ron Browser project.
