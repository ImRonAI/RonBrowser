Gemini Live [Experimental]¶
Experimental Feature

This feature is experimental and may change in future versions. Use with caution in production environments.

The Gemini Live API lets developers create natural conversations by enabling a two-way WebSocket connection with the Gemini models. The Live API processes data streams in real time. Users can interrupt the AI's responses with new input, similar to a real conversation. Key features include:

Multimodal Streaming: The API supports streaming of text, audio, and video data.
Bidirectional Interaction: The user and the model can provide input and output at the same time.
Interruptibility: Users can interrupt the model's response, and the model adjusts its response.
Tool Use and Function Calling: The API can use external tools to perform actions and get context while maintaining a real-time connection.
Session Management: Supports managing long conversations through sessions, providing context and continuity.
Secure Authentication: Uses tokens for secure client-side authentication.
Installation¶
Gemini Live is configured as an optional dependency in Strands Agents.

To install it, run:


pip install 'strands-agents[bidi-gemini]'
Or to install all bidirectional streaming providers at once:


pip install 'strands-agents[bidi-all]'
Usage¶
After installing strands-agents[bidi-gemini], you can import and initialize the Strands Agents' Gemini Live provider as follows:


import asyncio

from strands.experimental.bidi import BidiAgent
from strands.experimental.bidi.io import BidiAudioIO, BidiTextIO
from strands.experimental.bidi.models import BidiGeminiLiveModel
from strands.experimental.bidi.tools import stop_conversation

from strands_tools import calculator


async def main() -> None:
    model = BidiGeminiLiveModel(
        model_id="gemini-2.5-flash-native-audio-preview-09-2025",
        provider_config={
            "audio": {
                "voice": "Kore",
            },
        },
        client_config={"api_key": "<GOOGLE_AI_API_KEY>"},
    )
    # stop_conversation tool allows user to verbally stop agent execution.
    agent = BidiAgent(model=model, tools=[calculator, stop_conversation])

    audio_io = BidiAudioIO()
    text_io = BidiTextIO()
    await agent.run(inputs=[audio_io.input()], outputs=[audio_io.output(), text_io.output()])


if __name__ == "__main__":
    asyncio.run(main())
Configuration¶
Client Configs¶
For details on the supported client configs, see here.

Provider Configs¶
Parameter	Description	Example	Options
audio	AudioConfig instance.	{"voice": "Kore"}	reference
inference	Dict of inference fields specified in the Gemini LiveConnectConfig.	{"temperature": 0.7}	reference
For the list of supported voices and languages, see here.

Session Management¶
Currently, BidiGeminiLiveModel does not produce a message history and so has limited compatability with the Strands session manager. However, the provider does utilize Gemini's Session Resumption as part of the connection restart workflow. This allows Gemini Live connections to persist up to 24 hours. After this time limit, a new BidiGeminiLiveModel instance must be created to continue conversations.

Troubleshooting¶
Module Not Found¶
If you encounter the error ModuleNotFoundError: No module named 'google.genai', this means the google-genai dependency hasn't been properly installed in your environment. To fix this, run pip install 'strands-agents[bidi-gemini]'.

API Key Issues¶
Make sure your Google AI API key is properly set in client_config or as the GOOGLE_API_KEY environment variable. You can obtain an API key from the Google AI Studio.

References¶
Gemini Live API
Gemini API Reference
Provider API Reference
 Back to top
Privacy | Site Terms | Cookie preferences | © 2025, Amazon Web Services, Inc. or its affiliates. All rights reserved.