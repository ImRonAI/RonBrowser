Quickstart [Experimental]¶
Experimental Feature

This feature is experimental and may change in future versions. Use with caution in production environments.

This quickstart guide shows you how to create your first bidirectional streaming agent for real-time audio and text conversations. You'll learn how to set up audio I/O, handle streaming events, use tools during conversations, and work with different model providers.

After completing this guide, you can build voice assistants, interactive chatbots, multi-modal applications, and integrate bidirectional streaming with web servers or custom I/O channels.

Prerequisites¶
Before starting, ensure you have:

Python 3.12+ installed
Audio hardware (microphone and speakers) for voice conversations
Model provider credentials configured (AWS, OpenAI, or Google)
Install the SDK¶
Bidirectional streaming is included in the Strands Agents SDK as an experimental feature. Install the SDK with bidirectional streaming support:

For All Providers¶
To install with support for all bidirectional streaming providers:


pip install "strands-agents[bidi-all]"
This will install PyAudio for audio I/O and all 3 supported providers (Nova Sonic, OpenAI, and Gemini Live).

For Specific Providers¶
You can also install support for specific providers only:


Amazon Bedrock Nova Sonic
OpenAI Realtime API
Google Gemini Live

pip install "strands-agents[bidi]"

Platform-Specific Audio Setup¶

macOS
Linux (Ubuntu/Debian)
Windows

brew install portaudio
pip install "strands-agents[bidi-all]"

Configuring Credentials¶
Bidirectional streaming supports multiple model providers. Choose one based on your needs:


Amazon Bedrock Nova Sonic
OpenAI Realtime API
Google Gemini Live
Nova Sonic is Amazon's bidirectional streaming model. Configure AWS credentials:


export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
Enable Nova Sonic model access in the Amazon Bedrock console.


Your First Voice Conversation¶
Now let's create a simple voice-enabled agent that can have real-time conversations:


import asyncio
from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.models import BidiNovaSonicModel

# Create a bidirectional streaming model
model = BidiNovaSonicModel()

# Create the agent
agent = BidiAgent(
    model=model,
    system_prompt="You are a helpful voice assistant. Keep responses concise and natural."
)

# Setup audio I/O for microphone and speakers
audio_io = BidiAudioIO()

# Run the conversation
async def main():
    await agent.run(
        inputs=[audio_io.input()],
        outputs=[audio_io.output()]
    )

asyncio.run(main())
And that's it! We now have a voice-enabled agent that can:

Listen to your voice through the microphone
Process speech in real-time
Respond with natural voice output
Handle interruptions when you start speaking
Stopping the Conversation

The run() method runs indefinitely. See Controlling Conversation Lifecycle for proper ways to stop conversations.

Adding Text I/O¶
Combine audio with text input/output for debugging or multi-modal interactions:


import asyncio
from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.io import BidiTextIO
from strands.experimental.bidi.models import BidiNovaSonicModel

model = BidiNovaSonicModel()
agent = BidiAgent(
    model=model,
    system_prompt="You are a helpful assistant."
)

# Setup both audio and text I/O
audio_io = BidiAudioIO()
text_io = BidiTextIO()

async def main():
    await agent.run(
        inputs=[audio_io.input()],
        outputs=[audio_io.output(), text_io.output()]  # Both audio and text
    )

asyncio.run(main())
Now you'll see transcripts printed to the console while audio plays through your speakers.

Controlling Conversation Lifecycle¶
The run() method runs indefinitely by default. The simplest way to stop conversations is using Ctrl+C:


import asyncio
from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.models import BidiNovaSonicModel

async def main():
    model = BidiNovaSonicModel()
    agent = BidiAgent(model=model)
    audio_io = BidiAudioIO()

    try:
        # Runs indefinitely until interrupted
        await agent.run(
            inputs=[audio_io.input()],
            outputs=[audio_io.output()]
        )
    except asyncio.CancelledError:
        print("\nConversation cancelled by user")
    finally:
        # stop() should only be called after run() exits
        await agent.stop()

asyncio.run(main())
Important: Call stop() After Exiting Loops

Always call agent.stop() after exiting the run() or receive() loop, never during. Calling stop() while still receiving events can cause errors.

Adding Tools to Your Agent¶
Just like standard Strands agents, bidirectional agents can use tools during conversations:


import asyncio
from strands import tool
from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.models import BidiNovaSonicModel
from strands_tools import calculator, current_time

# Define a custom tool
@tool
def get_weather(location: str) -> str:
    """
    Get the current weather for a location.

    Args:
        location: City name or location

    Returns:
        Weather information
    """
    # In a real application, call a weather API
    return f"The weather in {location} is sunny and 72°F"

# Create agent with tools
model = BidiNovaSonicModel()
agent = BidiAgent(
    model=model,
    tools=[calculator, current_time, get_weather],
    system_prompt="You are a helpful assistant with access to tools."
)

audio_io = BidiAudioIO()

async def main():
    await agent.run(
        inputs=[audio_io.input()],
        outputs=[audio_io.output()]
    )

asyncio.run(main())
You can now ask questions like:

"What time is it?"
"Calculate 25 times 48"
"What's the weather in San Francisco?"
The agent automatically determines when to use tools and executes them concurrently without blocking the conversation.

Model Providers¶
Strands supports three bidirectional streaming providers:

Nova Sonic - Amazon's bidirectional streaming model via AWS Bedrock
OpenAI Realtime - OpenAI's Realtime API for voice conversations
Gemini Live - Google's multimodal streaming API
Each provider has different features, timeout limits, and audio quality. See the individual provider documentation for detailed configuration options.

Configuring Audio Settings¶
Customize audio configuration for both the model and I/O:


import asyncio

from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.models.gemini_live import BidiGeminiLiveModel

# Configure model audio settings
model = BidiGeminiLiveModel(
    provider_config={
        "audio": {
            "input_rate": 48000,   # Higher quality input
            "output_rate": 24000,  # Standard output
            "voice": "Puck"
        }
    }
)

# Configure I/O buffer settings
audio_io = BidiAudioIO(
    input_buffer_size=10,           # Max input queue size
    output_buffer_size=20,          # Max output queue size
    input_frames_per_buffer=512,   # Input chunk size
    output_frames_per_buffer=512   # Output chunk size
)

agent = BidiAgent(model=model)

async def main():
    await agent.run(
        inputs=[audio_io.input()],
        outputs=[audio_io.output()]
    )

asyncio.run(main())
The I/O automatically configures hardware to match the model's audio requirements.

Handling Interruptions¶
Bidirectional agents automatically handle interruptions when users start speaking:


import asyncio
from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.models import BidiNovaSonicModel
from strands.experimental.bidi.types.events import BidiInterruptionEvent

model = BidiNovaSonicModel()
agent = BidiAgent(model=model)
audio_io = BidiAudioIO()

async def main():
    await agent.start()

    # Start receiving events
    async for event in agent.receive():
        if isinstance(event, BidiInterruptionEvent):
            print(f"User interrupted: {event.reason}")
            # Audio output automatically cleared
            # Model stops generating
            # Ready for new input

asyncio.run(main())
Interruptions are detected via voice activity detection (VAD) and handled automatically:

User starts speaking
Model stops generating
Audio output buffer cleared
Model ready for new input
Manual Start and Stop¶
If you need more control over the agent lifecycle, you can manually call start() and stop():


import asyncio
from strands.experimental.bidi import BidiAgent
from strands.experimental.bidi.models import BidiNovaSonicModel
from strands.experimental.bidi.types.events import BidiResponseCompleteEvent

async def main():
    model = BidiNovaSonicModel()
    agent = BidiAgent(model=model)

    # Manually start the agent
    await agent.start()

    try:
        await agent.send("What is Python?")

        async for event in agent.receive():
            if isinstance(event, BidiResponseCompleteEvent):
                break
    finally:
        # Always stop after exiting receive loop
        await agent.stop()

asyncio.run(main())
See Controlling Conversation Lifecycle for more patterns and best practices.

Graceful Shutdown¶
Use the experimental stop_conversation tool to allow users to end conversations naturally:


import asyncio
from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.models import BidiNovaSonicModel
from strands.experimental.bidi.tools import stop_conversation

model = BidiNovaSonicModel()
agent = BidiAgent(
    model=model,
    tools=[stop_conversation],
    system_prompt="You are a helpful assistant. When the user says 'stop conversation', use the stop_conversation tool."
)

audio_io = BidiAudioIO()

async def main():
    await agent.run(
        inputs=[audio_io.input()],
        outputs=[audio_io.output()]
    )
    # Conversation ends when user says "stop conversation"

asyncio.run(main())
The agent will gracefully close the connection when the user explicitly requests it.

Debug Logs¶
To enable debug logs in your agent, configure the strands logger:


import asyncio
import logging
from strands.experimental.bidi import BidiAgent, BidiAudioIO
from strands.experimental.bidi.models import BidiNovaSonicModel

# Enable debug logs
logging.getLogger("strands").setLevel(logging.DEBUG)
logging.basicConfig(
    format="%(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler()]
)

model = BidiNovaSonicModel()
agent = BidiAgent(model=model)
audio_io = BidiAudioIO()

async def main():
    await agent.run(
        inputs=[audio_io.input()],
        outputs=[audio_io.output()]
    )

asyncio.run(main())
Debug logs show:

Connection lifecycle events
Audio buffer operations
Tool execution details
Event processing flow
Common Issues¶
No Audio Output¶
If you don't hear audio:


# List available audio devices
import pyaudio
p = pyaudio.PyAudio()
for i in range(p.get_device_count()):
    info = p.get_device_info_by_index(i)
    print(f"{i}: {info['name']}")

# Specify output device explicitly
audio_io = BidiAudioIO(output_device_index=2)
Microphone Not Working¶
If the agent doesn't respond to speech:


# Specify input device explicitly
audio_io = BidiAudioIO(input_device_index=1)

# Check system permissions (macOS)
# System Preferences → Security & Privacy → Microphone
Connection Timeouts¶
If you experience frequent disconnections:


# Use OpenAI for longer timeout (60 min vs Nova's 8 min)
from strands.experimental.bidi.models import BidiOpenAIRealtimeModel
model = BidiOpenAIRealtimeModel()

# Or handle restarts gracefully
async for event in agent.receive():
    if isinstance(event, BidiConnectionRestartEvent):
        print("Reconnecting...")
        continue
Next Steps¶
Ready to learn more? Check out these resources:

Agent - Deep dive into BidiAgent configuration and lifecycle
Events - Complete guide to bidirectional streaming events
I/O Channels - Understanding and customizing input/output channels
Model Providers:
Nova Sonic - Amazon Bedrock's bidirectional streaming model
OpenAI Realtime - OpenAI's Realtime API
Gemini Live - Google's Gemini Live API
API Reference - Complete API documentation
 Back to top
Privacy | Site Terms | Cookie preferences | © 2025, Amazon Web Services, Inc. or its affiliates. All rights reserved.