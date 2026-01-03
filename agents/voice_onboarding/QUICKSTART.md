# Quick Start Guide

Get the voice onboarding agent running in 3 minutes.

## Prerequisites

- Python 3.12+
- Microphone and speakers
- Google AI API key

## Setup

### 1. Run Setup Script

```bash
cd agents/voice_onboarding
./setup.sh
```

This will:
- Check Python version
- Install PortAudio (macOS)
- Install Strands Agents SDK
- Verify dependencies

### 2. Configure API Key

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey), then:

```bash
export GOOGLE_API_KEY=your_api_key_here
# or
export GEMINI_API_KEY=your_api_key_here
```

Or create `.env` file:
```
GOOGLE_API_KEY=your_api_key_here
```

**Note**: The agent supports both `GOOGLE_API_KEY` and `GEMINI_API_KEY` variable names.

### 3. Run the Agent

```bash
python agent.py
```

## What to Expect

1. Agent welcomes you: *"Hello! I'm Ron..."*
2. Agent asks first question: *"What brings you to Ron Browser today?"*
3. You speak your answer into the microphone
4. Agent acknowledges and asks next question
5. Repeat for 8 questions total
6. Agent thanks you and displays summary

## Controls

- **Speak naturally** - the agent listens continuously
- **Say "stop conversation"** - end interview early
- **Press Ctrl+C** - force quit

## Testing Audio

### List Audio Devices

```bash
python -c "import pyaudio; p = pyaudio.PyAudio(); [print(f'{i}: {p.get_device_info_by_index(i)[\"name\"]}') for i in range(p.get_device_count())]"
```

### Specify Device

Edit `agent.py` line ~180:

```python
audio_io = BidiAudioIO(
    input_device_index=1,   # Your microphone
    output_device_index=2   # Your speakers
)
```

## Troubleshooting

### No Audio Output

Check volume settings and try specifying device index (see above).

### Microphone Not Working

**macOS**: System Preferences → Security & Privacy → Microphone → Terminal

**Linux**: Add user to audio group: `sudo usermod -a -G audio $USER`

### API Key Error

```bash
echo $GOOGLE_API_KEY  # Should show your key
echo $GEMINI_API_KEY  # Or this one
```

If empty, set it:
```bash
export GOOGLE_API_KEY=your_api_key_here
# or
export GEMINI_API_KEY=your_api_key_here
```

### Module Not Found

```bash
pip install 'strands-agents[bidi-gemini]'
```

## Next Steps

- **See full README**: `cat README.md`
- **Customize questions**: Edit `INTERVIEW_QUESTIONS` in `agent.py`
- **Change voice**: Set `VOICE_AGENT_VOICE` (or update `agent.py`)

## Output Format

The agent outputs JSON compatible with the Electron store:

```json
{
  "answers": [
    {
      "question": "What brings you to Ron Browser today?",
      "answer": "Looking for a personalized experience",
      "timestamp": 1234567890.123
    }
  ],
  "is_complete": true
}
```

## Getting Help

- **Strands Docs**: https://docs.strands.dev/experimental/bidi/quickstart/
- **Gemini Live**: https://ai.google.dev/gemini-api/docs/live
- **Issues**: Create issue in Ron Browser repo
