# Voice Onboarding Agent

Bidirectional streaming voice onboarding using **Strands Agents SDK** + **Gemini Live**.

This agent is intentionally simple:
- asks the onboarding questions (voice)
- captures the user's answers via **transcription**
- emits **newline-delimited JSON** events on stdout for Electron to consume
- runs **half-duplex** by default so it works on speakers (no headphones)

## How it integrates
Ron Browser starts `agents/voice_onboarding/agent.py` as a **Python subprocess** from the Electron main process (`electron/main.ts`).
The renderer subscribes to events via `window.electron.voiceAgent` (`electron/preload.ts`) and updates UI/state via `src/hooks/useVoiceAgent.ts`.

There is **no HTTP/FastAPI server** in the supported path.

## Prerequisites
- Python 3.12+
- Microphone + speakers
- PortAudio (macOS/Linux)
- Google AI API key (Gemini Live)

## Installation
macOS:
```bash
brew install portaudio
pip install -r requirements.txt
```

Linux (Ubuntu/Debian):
```bash
sudo apt-get install portaudio19-dev
pip install -r requirements.txt
```

## Configure API key
```bash
export GOOGLE_API_KEY=your_api_key_here
# or GEMINI_API_KEY=...
# or GOOGLE_AI_API_KEY=...
```

You can also place it in a project `.env`.

## Run standalone
```bash
python agent.py
```

## Configuration
Environment variables:
- `VOICE_AGENT_VOICE` (default: `Aoede`)
- `VOICE_AGENT_MIC_RESUME_DELAY_MS` (default: `650`) — cooldown after assistant finishes speaking before mic resumes
- `VOICE_AGENT_USER_FINAL_DEBOUNCE_MS` (default: `900`) — fallback: treat user transcript as final after this much silence
- `A2A_KNOWN_AGENT_URLS` (optional) — comma-separated URLs for A2A discovery (only used if A2A deps are installed)

## Output events
Events are newline-delimited JSON with the following shapes:
- `state_change`: `{ "type": "state_change", "data": { "state": "listening|thinking|speaking|complete|error|stopped" } }`
- `question`: `{ "type": "question", "data": { "question": string, "index": number } }`
- `transcript`: `{ "type": "transcript", "data": { "role": "user|assistant", "text": string, "is_final": boolean } }`
- `answer_recorded`: `{ "type": "answer_recorded", "data": { "question": string, "answer": string, "timestamp": number } }`
- `complete`: `{ "type": "complete", "data": { "current_question_index": number, "answers": [...], "is_complete": boolean } }`

## Notes on feedback/noise
This agent defaults to **half-duplex mic gating** plus a short cooldown to prevent speaker-to-mic echo from causing Gemini Live self-interruptions.

## Troubleshooting
- If you get no mic input: confirm macOS microphone permissions for Terminal/Electron.
- If you get API key errors: ensure `GOOGLE_API_KEY` (or equivalent) is set.
- If PyAudio fails to install: ensure PortAudio is installed (macOS/Linux).
