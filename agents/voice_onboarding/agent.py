"""Voice Onboarding Agent using Strands BidiAgent with Gemini Live.

Uses the simple, documented pattern from strands with BidiAudioIO.
"""
# Suppress all logging before any imports
import logging
import warnings
import os

warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)
os.environ["GRPC_VERBOSITY"] = "ERROR"
os.environ["GLOG_minloglevel"] = "2"

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
from strands.experimental.bidi import BidiAgent
from strands.experimental.bidi.models import BidiGeminiLiveModel
from strands.experimental.bidi.tools import stop_conversation
from strands.experimental.bidi.io import BidiAudioIO

load_dotenv(Path(__file__).parent.parent.parent / ".env")

SYSTEM_PROMPT = """You are Ron, a friendly voice assistant helping with onboarding. 

Start by warmly greeting the user and introducing yourself. Then ask these questions one at a time, waiting for the user to respond before moving to the next:

1. What's your name?
2. What do you do for work?
3. What are your hobbies?
4. What kind of web content do you like?
5. What websites do you use daily?
6. Do you prefer reading, videos, or podcasts?
7. What are you trying to learn?
8. Anything specific you want help with?

Keep responses brief and conversational. After all questions, thank them and summarize what you learned.

IMPORTANT: Wait for the user to respond before asking the next question."""


async def main():
    api_key = (
        os.getenv("GOOGLE_AI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
    )
    if not api_key:
        print('{"type": "error", "message": "API key required"}', file=sys.stderr)
        sys.exit(1)

    # Create model with Gemini Live
    model = BidiGeminiLiveModel(
        client_config={"api_key": api_key},
        provider_config={
            "audio": {"voice": "Aoede"},
            "inference": {
                "response_modalities": ["AUDIO"],
                "outputAudioTranscription": {},
                "inputAudioTranscription": {},
            },
        },
    )

    # Create agent with stop_conversation tool
    agent = BidiAgent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[stop_conversation],
    )

    # Use the simple built-in BidiAudioIO - no custom echo suppression
    audio_io = BidiAudioIO()

    # Signal to Electron that we're ready
    print('{"type": "ready", "status": "started"}', flush=True)

    try:
        # Use the simple documented pattern: agent.run() handles everything
        await agent.run(
            inputs=[audio_io.input()],
            outputs=[audio_io.output()],
        )
    except asyncio.CancelledError:
        pass
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f'{{"type": "error", "message": "{str(e)}"}}', file=sys.stderr)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f'{{"type": "error", "message": "{str(e)}"}}', file=sys.stderr)
        sys.exit(1)
