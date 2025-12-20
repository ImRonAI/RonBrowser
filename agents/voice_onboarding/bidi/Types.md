strands.experimental.bidi.types ¶
Type definitions for bidirectional streaming.

strands.experimental.bidi.types.agent ¶
Agent-related type definitions for bidirectional streaming.

This module defines the types used for BidiAgent.

strands.experimental.bidi.types.model ¶
Model-related type definitions for bidirectional streaming.

Defines types and configurations that are central to model providers, including audio configuration that models use to specify their audio processing requirements.

AudioConfig ¶
Bases: TypedDict

Audio configuration for bidirectional streaming models.

Defines standard audio parameters that model providers use to specify their audio processing requirements. All fields are optional to support models that may not use audio or only need specific parameters.

Model providers build this configuration by merging user-provided values with their own defaults. The resulting configuration is then used by audio I/O implementations to configure hardware appropriately.

Attributes:

Name	Type	Description
input_rate	AudioSampleRate	Input sample rate in Hz (e.g., 16000, 24000, 48000)
output_rate	AudioSampleRate	Output sample rate in Hz (e.g., 16000, 24000, 48000)
channels	AudioChannel	Number of audio channels (1=mono, 2=stereo)
format	AudioFormat	Audio encoding format
voice	str	Voice identifier for text-to-speech (e.g., "alloy", "matthew")
Source code in strands/experimental/bidi/types/model.py

class AudioConfig(TypedDict, total=False):
    """Audio configuration for bidirectional streaming models.

    Defines standard audio parameters that model providers use to specify
    their audio processing requirements. All fields are optional to support
    models that may not use audio or only need specific parameters.

    Model providers build this configuration by merging user-provided values
    with their own defaults. The resulting configuration is then used by
    audio I/O implementations to configure hardware appropriately.

    Attributes:
        input_rate: Input sample rate in Hz (e.g., 16000, 24000, 48000)
        output_rate: Output sample rate in Hz (e.g., 16000, 24000, 48000)
        channels: Number of audio channels (1=mono, 2=stereo)
        format: Audio encoding format
        voice: Voice identifier for text-to-speech (e.g., "alloy", "matthew")
    """

    input_rate: AudioSampleRate
    output_rate: AudioSampleRate
    channels: AudioChannel
    format: AudioFormat
    voice: str
strands.experimental.bidi.types.events ¶
Bidirectional streaming types for real-time audio/text conversations.

Type definitions for bidirectional streaming that extends Strands' existing streaming capabilities with real-time audio and persistent connection support.

Key features:

Audio input/output events with standardized formats
Interruption detection and handling
Connection lifecycle management
Provider-agnostic event types
Type-safe discriminated unions with TypedEvent
JSON-serializable events (audio/images stored as base64 strings)
Audio format normalization:

Supports PCM, WAV, Opus, and MP3 formats
Standardizes sample rates (16kHz, 24kHz, 48kHz)
Normalizes channel configurations (mono/stereo)
Abstracts provider-specific encodings
Audio data stored as base64-encoded strings for JSON compatibility
AudioChannel = Literal[1, 2] module-attribute ¶
Number of audio channels.

Mono: 1
Stereo: 2
AudioFormat = Literal['pcm', 'wav', 'opus', 'mp3'] module-attribute ¶
Audio encoding format.

AudioSampleRate = Literal[16000, 24000, 48000] module-attribute ¶
Audio sample rate in Hz.

BidiInputEvent = BidiTextInputEvent | BidiAudioInputEvent | BidiImageInputEvent module-attribute ¶
Union of different bidi input event types.

BidiOutputEvent = BidiConnectionStartEvent | BidiConnectionRestartEvent | BidiResponseStartEvent | BidiAudioStreamEvent | BidiTranscriptStreamEvent | BidiInterruptionEvent | BidiResponseCompleteEvent | BidiUsageEvent | BidiConnectionCloseEvent | BidiErrorEvent | ToolUseStreamEvent module-attribute ¶
Union of different bidi output event types.

Role = Literal['user', 'assistant'] module-attribute ¶
Role of a message sender.

"user": Messages from the user to the assistant.
"assistant": Messages from the assistant to the user.
StopReason = Literal['complete', 'error', 'interrupted', 'tool_use'] module-attribute ¶
Reason for the model ending its response generation.

"complete": Model completed its response.
"error": Model encountered an error.
"interrupted": Model was interrupted by the user.
"tool_use": Model is requesting a tool use.
BidiAudioInputEvent ¶
Bases: TypedEvent

Audio input event for sending audio to the model.

Used for sending audio data through the send() method.

Parameters:

Name	Type	Description	Default
audio	str	Base64-encoded audio string to send to model.	required
format	AudioFormat | str	Audio format from SUPPORTED_AUDIO_FORMATS.	required
sample_rate	AudioSampleRate	Sample rate from SUPPORTED_SAMPLE_RATES.	required
channels	AudioChannel	Channel count from SUPPORTED_CHANNELS.	required
Source code in strands/experimental/bidi/types/events.py

class BidiAudioInputEvent(TypedEvent):
    """Audio input event for sending audio to the model.

    Used for sending audio data through the send() method.

    Parameters:
        audio: Base64-encoded audio string to send to model.
        format: Audio format from SUPPORTED_AUDIO_FORMATS.
        sample_rate: Sample rate from SUPPORTED_SAMPLE_RATES.
        channels: Channel count from SUPPORTED_CHANNELS.
    """

    def __init__(
        self,
        audio: str,
        format: AudioFormat | str,
        sample_rate: AudioSampleRate,
        channels: AudioChannel,
    ):
        """Initialize audio input event."""
        super().__init__(
            {
                "type": "bidi_audio_input",
                "audio": audio,
                "format": format,
                "sample_rate": sample_rate,
                "channels": channels,
            }
        )

    @property
    def audio(self) -> str:
        """Base64-encoded audio string."""
        return cast(str, self["audio"])

    @property
    def format(self) -> AudioFormat:
        """Audio encoding format."""
        return cast(AudioFormat, self["format"])

    @property
    def sample_rate(self) -> AudioSampleRate:
        """Number of audio samples per second in Hz."""
        return cast(AudioSampleRate, self["sample_rate"])

    @property
    def channels(self) -> AudioChannel:
        """Number of audio channels (1=mono, 2=stereo)."""
        return cast(AudioChannel, self["channels"])
audio property ¶
Base64-encoded audio string.

channels property ¶
Number of audio channels (1=mono, 2=stereo).

format property ¶
Audio encoding format.

sample_rate property ¶
Number of audio samples per second in Hz.

__init__(audio, format, sample_rate, channels) ¶
Initialize audio input event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    audio: str,
    format: AudioFormat | str,
    sample_rate: AudioSampleRate,
    channels: AudioChannel,
):
    """Initialize audio input event."""
    super().__init__(
        {
            "type": "bidi_audio_input",
            "audio": audio,
            "format": format,
            "sample_rate": sample_rate,
            "channels": channels,
        }
    )
BidiAudioStreamEvent ¶
Bases: TypedEvent

Streaming audio output from the model.

Parameters:

Name	Type	Description	Default
audio	str	Base64-encoded audio string.	required
format	AudioFormat	Audio encoding format.	required
sample_rate	AudioSampleRate	Number of audio samples per second in Hz.	required
channels	AudioChannel	Number of audio channels (1=mono, 2=stereo).	required
Source code in strands/experimental/bidi/types/events.py

class BidiAudioStreamEvent(TypedEvent):
    """Streaming audio output from the model.

    Parameters:
        audio: Base64-encoded audio string.
        format: Audio encoding format.
        sample_rate: Number of audio samples per second in Hz.
        channels: Number of audio channels (1=mono, 2=stereo).
    """

    def __init__(
        self,
        audio: str,
        format: AudioFormat,
        sample_rate: AudioSampleRate,
        channels: AudioChannel,
    ):
        """Initialize audio stream event."""
        super().__init__(
            {
                "type": "bidi_audio_stream",
                "audio": audio,
                "format": format,
                "sample_rate": sample_rate,
                "channels": channels,
            }
        )

    @property
    def audio(self) -> str:
        """Base64-encoded audio string."""
        return cast(str, self["audio"])

    @property
    def format(self) -> AudioFormat:
        """Audio encoding format."""
        return cast(AudioFormat, self["format"])

    @property
    def sample_rate(self) -> AudioSampleRate:
        """Number of audio samples per second in Hz."""
        return cast(AudioSampleRate, self["sample_rate"])

    @property
    def channels(self) -> AudioChannel:
        """Number of audio channels (1=mono, 2=stereo)."""
        return cast(AudioChannel, self["channels"])
audio property ¶
Base64-encoded audio string.

channels property ¶
Number of audio channels (1=mono, 2=stereo).

format property ¶
Audio encoding format.

sample_rate property ¶
Number of audio samples per second in Hz.

__init__(audio, format, sample_rate, channels) ¶
Initialize audio stream event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    audio: str,
    format: AudioFormat,
    sample_rate: AudioSampleRate,
    channels: AudioChannel,
):
    """Initialize audio stream event."""
    super().__init__(
        {
            "type": "bidi_audio_stream",
            "audio": audio,
            "format": format,
            "sample_rate": sample_rate,
            "channels": channels,
        }
    )
BidiConnectionCloseEvent ¶
Bases: TypedEvent

Streaming connection closed.

Parameters:

Name	Type	Description	Default
connection_id	str	Unique identifier for this streaming connection (matches BidiConnectionStartEvent).	required
reason	Literal['client_disconnect', 'timeout', 'error', 'complete', 'user_request']	Why the connection was closed.	required
Source code in strands/experimental/bidi/types/events.py

class BidiConnectionCloseEvent(TypedEvent):
    """Streaming connection closed.

    Parameters:
        connection_id: Unique identifier for this streaming connection (matches BidiConnectionStartEvent).
        reason: Why the connection was closed.
    """

    def __init__(
        self,
        connection_id: str,
        reason: Literal["client_disconnect", "timeout", "error", "complete", "user_request"],
    ):
        """Initialize connection close event."""
        super().__init__(
            {
                "type": "bidi_connection_close",
                "connection_id": connection_id,
                "reason": reason,
            }
        )

    @property
    def connection_id(self) -> str:
        """Unique identifier for this streaming connection."""
        return cast(str, self["connection_id"])

    @property
    def reason(self) -> str:
        """Why the interruption occurred."""
        return cast(str, self["reason"])
connection_id property ¶
Unique identifier for this streaming connection.

reason property ¶
Why the interruption occurred.

__init__(connection_id, reason) ¶
Initialize connection close event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    connection_id: str,
    reason: Literal["client_disconnect", "timeout", "error", "complete", "user_request"],
):
    """Initialize connection close event."""
    super().__init__(
        {
            "type": "bidi_connection_close",
            "connection_id": connection_id,
            "reason": reason,
        }
    )
BidiConnectionRestartEvent ¶
Bases: TypedEvent

Agent is restarting the model connection after timeout.

Source code in strands/experimental/bidi/types/events.py

class BidiConnectionRestartEvent(TypedEvent):
    """Agent is restarting the model connection after timeout."""

    def __init__(self, timeout_error: "BidiModelTimeoutError"):
        """Initialize.

        Args:
            timeout_error: Timeout error reported by the model.
        """
        super().__init__(
            {
                "type": "bidi_connection_restart",
                "timeout_error": timeout_error,
            }
        )

    @property
    def timeout_error(self) -> "BidiModelTimeoutError":
        """Model timeout error."""
        return cast("BidiModelTimeoutError", self["timeout_error"])
timeout_error property ¶
Model timeout error.

__init__(timeout_error) ¶
Initialize.

Parameters:

Name	Type	Description	Default
timeout_error	BidiModelTimeoutError	Timeout error reported by the model.	required
Source code in strands/experimental/bidi/types/events.py

def __init__(self, timeout_error: "BidiModelTimeoutError"):
    """Initialize.

    Args:
        timeout_error: Timeout error reported by the model.
    """
    super().__init__(
        {
            "type": "bidi_connection_restart",
            "timeout_error": timeout_error,
        }
    )
BidiConnectionStartEvent ¶
Bases: TypedEvent

Streaming connection established and ready for interaction.

Parameters:

Name	Type	Description	Default
connection_id	str	Unique identifier for this streaming connection.	required
model	str	Model identifier (e.g., "gpt-realtime", "gemini-2.0-flash-live").	required
Source code in strands/experimental/bidi/types/events.py

class BidiConnectionStartEvent(TypedEvent):
    """Streaming connection established and ready for interaction.

    Parameters:
        connection_id: Unique identifier for this streaming connection.
        model: Model identifier (e.g., "gpt-realtime", "gemini-2.0-flash-live").
    """

    def __init__(self, connection_id: str, model: str):
        """Initialize connection start event."""
        super().__init__(
            {
                "type": "bidi_connection_start",
                "connection_id": connection_id,
                "model": model,
            }
        )

    @property
    def connection_id(self) -> str:
        """Unique identifier for this streaming connection."""
        return cast(str, self["connection_id"])

    @property
    def model(self) -> str:
        """Model identifier (e.g., 'gpt-realtime', 'gemini-2.0-flash-live')."""
        return cast(str, self["model"])
connection_id property ¶
Unique identifier for this streaming connection.

model property ¶
Model identifier (e.g., 'gpt-realtime', 'gemini-2.0-flash-live').

__init__(connection_id, model) ¶
Initialize connection start event.

Source code in strands/experimental/bidi/types/events.py

def __init__(self, connection_id: str, model: str):
    """Initialize connection start event."""
    super().__init__(
        {
            "type": "bidi_connection_start",
            "connection_id": connection_id,
            "model": model,
        }
    )
BidiErrorEvent ¶
Bases: TypedEvent

Error occurred during the session.

Stores the full Exception object as an instance attribute for debugging while keeping the event dict JSON-serializable. The exception can be accessed via the error property for re-raising or type-based error handling.

Parameters:

Name	Type	Description	Default
error	Exception	The exception that occurred.	required
details	dict[str, Any] | None	Optional additional error information.	None
Source code in strands/experimental/bidi/types/events.py

class BidiErrorEvent(TypedEvent):
    """Error occurred during the session.

    Stores the full Exception object as an instance attribute for debugging while
    keeping the event dict JSON-serializable. The exception can be accessed via
    the `error` property for re-raising or type-based error handling.

    Parameters:
        error: The exception that occurred.
        details: Optional additional error information.
    """

    def __init__(
        self,
        error: Exception,
        details: dict[str, Any] | None = None,
    ):
        """Initialize error event."""
        # Store serializable data in dict (for JSON serialization)
        super().__init__(
            {
                "type": "bidi_error",
                "message": str(error),
                "code": type(error).__name__,
                "details": details,
            }
        )
        # Store exception as instance attribute (not serialized)
        self._error = error

    @property
    def error(self) -> Exception:
        """The original exception that occurred.

        Can be used for re-raising or type-based error handling.
        """
        return self._error

    @property
    def code(self) -> str:
        """Error code derived from exception class name."""
        return cast(str, self["code"])

    @property
    def message(self) -> str:
        """Human-readable error message from the exception."""
        return cast(str, self["message"])

    @property
    def details(self) -> dict[str, Any] | None:
        """Additional error context beyond the exception itself."""
        return cast(dict[str, Any] | None, self.get("details"))
code property ¶
Error code derived from exception class name.

details property ¶
Additional error context beyond the exception itself.

error property ¶
The original exception that occurred.

Can be used for re-raising or type-based error handling.

message property ¶
Human-readable error message from the exception.

__init__(error, details=None) ¶
Initialize error event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    error: Exception,
    details: dict[str, Any] | None = None,
):
    """Initialize error event."""
    # Store serializable data in dict (for JSON serialization)
    super().__init__(
        {
            "type": "bidi_error",
            "message": str(error),
            "code": type(error).__name__,
            "details": details,
        }
    )
    # Store exception as instance attribute (not serialized)
    self._error = error
BidiImageInputEvent ¶
Bases: TypedEvent

Image input event for sending images/video frames to the model.

Used for sending image data through the send() method.

Parameters:

Name	Type	Description	Default
image	str	Base64-encoded image string.	required
mime_type	str	MIME type (e.g., "image/jpeg", "image/png").	required
Source code in strands/experimental/bidi/types/events.py

class BidiImageInputEvent(TypedEvent):
    """Image input event for sending images/video frames to the model.

    Used for sending image data through the send() method.

    Parameters:
        image: Base64-encoded image string.
        mime_type: MIME type (e.g., "image/jpeg", "image/png").
    """

    def __init__(
        self,
        image: str,
        mime_type: str,
    ):
        """Initialize image input event."""
        super().__init__(
            {
                "type": "bidi_image_input",
                "image": image,
                "mime_type": mime_type,
            }
        )

    @property
    def image(self) -> str:
        """Base64-encoded image string."""
        return cast(str, self["image"])

    @property
    def mime_type(self) -> str:
        """MIME type of the image (e.g., "image/jpeg", "image/png")."""
        return cast(str, self["mime_type"])
image property ¶
Base64-encoded image string.

mime_type property ¶
MIME type of the image (e.g., "image/jpeg", "image/png").

__init__(image, mime_type) ¶
Initialize image input event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    image: str,
    mime_type: str,
):
    """Initialize image input event."""
    super().__init__(
        {
            "type": "bidi_image_input",
            "image": image,
            "mime_type": mime_type,
        }
    )
BidiInterruptionEvent ¶
Bases: TypedEvent

Model generation was interrupted.

Parameters:

Name	Type	Description	Default
reason	Literal['user_speech', 'error']	Why the interruption occurred.	required
Source code in strands/experimental/bidi/types/events.py

class BidiInterruptionEvent(TypedEvent):
    """Model generation was interrupted.

    Parameters:
        reason: Why the interruption occurred.
    """

    def __init__(self, reason: Literal["user_speech", "error"]):
        """Initialize interruption event."""
        super().__init__(
            {
                "type": "bidi_interruption",
                "reason": reason,
            }
        )

    @property
    def reason(self) -> str:
        """Why the interruption occurred."""
        return cast(str, self["reason"])
reason property ¶
Why the interruption occurred.

__init__(reason) ¶
Initialize interruption event.

Source code in strands/experimental/bidi/types/events.py

def __init__(self, reason: Literal["user_speech", "error"]):
    """Initialize interruption event."""
    super().__init__(
        {
            "type": "bidi_interruption",
            "reason": reason,
        }
    )
BidiResponseCompleteEvent ¶
Bases: TypedEvent

Model finished generating response.

Parameters:

Name	Type	Description	Default
response_id	str	ID of the response that completed (matches response.start).	required
stop_reason	StopReason	Why the response ended.	required
Source code in strands/experimental/bidi/types/events.py

class BidiResponseCompleteEvent(TypedEvent):
    """Model finished generating response.

    Parameters:
        response_id: ID of the response that completed (matches response.start).
        stop_reason: Why the response ended.
    """

    def __init__(
        self,
        response_id: str,
        stop_reason: StopReason,
    ):
        """Initialize response complete event."""
        super().__init__(
            {
                "type": "bidi_response_complete",
                "response_id": response_id,
                "stop_reason": stop_reason,
            }
        )

    @property
    def response_id(self) -> str:
        """Unique identifier for this response."""
        return cast(str, self["response_id"])

    @property
    def stop_reason(self) -> StopReason:
        """Why the response ended."""
        return cast(StopReason, self["stop_reason"])
response_id property ¶
Unique identifier for this response.

stop_reason property ¶
Why the response ended.

__init__(response_id, stop_reason) ¶
Initialize response complete event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    response_id: str,
    stop_reason: StopReason,
):
    """Initialize response complete event."""
    super().__init__(
        {
            "type": "bidi_response_complete",
            "response_id": response_id,
            "stop_reason": stop_reason,
        }
    )
BidiResponseStartEvent ¶
Bases: TypedEvent

Model starts generating a response.

Parameters:

Name	Type	Description	Default
response_id	str	Unique identifier for this response (used in response.complete).	required
Source code in strands/experimental/bidi/types/events.py

class BidiResponseStartEvent(TypedEvent):
    """Model starts generating a response.

    Parameters:
        response_id: Unique identifier for this response (used in response.complete).
    """

    def __init__(self, response_id: str):
        """Initialize response start event."""
        super().__init__({"type": "bidi_response_start", "response_id": response_id})

    @property
    def response_id(self) -> str:
        """Unique identifier for this response."""
        return cast(str, self["response_id"])
response_id property ¶
Unique identifier for this response.

__init__(response_id) ¶
Initialize response start event.

Source code in strands/experimental/bidi/types/events.py

def __init__(self, response_id: str):
    """Initialize response start event."""
    super().__init__({"type": "bidi_response_start", "response_id": response_id})
BidiTextInputEvent ¶
Bases: TypedEvent

Text input event for sending text to the model.

Used for sending text content through the send() method.

Parameters:

Name	Type	Description	Default
text	str	The text content to send to the model.	required
role	Role	The role of the message sender (default: "user").	'user'
Source code in strands/experimental/bidi/types/events.py

class BidiTextInputEvent(TypedEvent):
    """Text input event for sending text to the model.

    Used for sending text content through the send() method.

    Parameters:
        text: The text content to send to the model.
        role: The role of the message sender (default: "user").
    """

    def __init__(self, text: str, role: Role = "user"):
        """Initialize text input event."""
        super().__init__(
            {
                "type": "bidi_text_input",
                "text": text,
                "role": role,
            }
        )

    @property
    def text(self) -> str:
        """The text content to send to the model."""
        return cast(str, self["text"])

    @property
    def role(self) -> Role:
        """The role of the message sender."""
        return cast(Role, self["role"])
role property ¶
The role of the message sender.

text property ¶
The text content to send to the model.

__init__(text, role='user') ¶
Initialize text input event.

Source code in strands/experimental/bidi/types/events.py

def __init__(self, text: str, role: Role = "user"):
    """Initialize text input event."""
    super().__init__(
        {
            "type": "bidi_text_input",
            "text": text,
            "role": role,
        }
    )
BidiTranscriptStreamEvent ¶
Bases: ModelStreamEvent

Audio transcription streaming (user or assistant speech).

Supports incremental transcript updates for providers that send partial transcripts before the final version.

Parameters:

Name	Type	Description	Default
delta	ContentBlockDelta	The incremental transcript change (ContentBlockDelta).	required
text	str	The delta text (same as delta content for convenience).	required
role	Role	Who is speaking ("user" or "assistant").	required
is_final	bool	Whether this is the final/complete transcript.	required
current_transcript	str | None	The accumulated transcript text so far (None for first delta).	None
Source code in strands/experimental/bidi/types/events.py

class BidiTranscriptStreamEvent(ModelStreamEvent):
    """Audio transcription streaming (user or assistant speech).

    Supports incremental transcript updates for providers that send partial
    transcripts before the final version.

    Parameters:
        delta: The incremental transcript change (ContentBlockDelta).
        text: The delta text (same as delta content for convenience).
        role: Who is speaking ("user" or "assistant").
        is_final: Whether this is the final/complete transcript.
        current_transcript: The accumulated transcript text so far (None for first delta).
    """

    def __init__(
        self,
        delta: ContentBlockDelta,
        text: str,
        role: Role,
        is_final: bool,
        current_transcript: str | None = None,
    ):
        """Initialize transcript stream event."""
        super().__init__(
            {
                "type": "bidi_transcript_stream",
                "delta": delta,
                "text": text,
                "role": role,
                "is_final": is_final,
                "current_transcript": current_transcript,
            }
        )

    @property
    def delta(self) -> ContentBlockDelta:
        """The incremental transcript change."""
        return cast(ContentBlockDelta, self["delta"])

    @property
    def text(self) -> str:
        """The text content to send to the model."""
        return cast(str, self["text"])

    @property
    def role(self) -> Role:
        """The role of the message sender."""
        return cast(Role, self["role"])

    @property
    def is_final(self) -> bool:
        """Whether this is the final/complete transcript."""
        return cast(bool, self["is_final"])

    @property
    def current_transcript(self) -> str | None:
        """The accumulated transcript text so far."""
        return cast(str | None, self.get("current_transcript"))
current_transcript property ¶
The accumulated transcript text so far.

delta property ¶
The incremental transcript change.

is_final property ¶
Whether this is the final/complete transcript.

role property ¶
The role of the message sender.

text property ¶
The text content to send to the model.

__init__(delta, text, role, is_final, current_transcript=None) ¶
Initialize transcript stream event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    delta: ContentBlockDelta,
    text: str,
    role: Role,
    is_final: bool,
    current_transcript: str | None = None,
):
    """Initialize transcript stream event."""
    super().__init__(
        {
            "type": "bidi_transcript_stream",
            "delta": delta,
            "text": text,
            "role": role,
            "is_final": is_final,
            "current_transcript": current_transcript,
        }
    )
BidiUsageEvent ¶
Bases: TypedEvent

Token usage event with modality breakdown for bidirectional streaming.

Tracks token consumption across different modalities (audio, text, images) during bidirectional streaming sessions.

Parameters:

Name	Type	Description	Default
input_tokens	int	Total tokens used for all input modalities.	required
output_tokens	int	Total tokens used for all output modalities.	required
total_tokens	int	Sum of input and output tokens.	required
modality_details	list[ModalityUsage] | None	Optional list of token usage per modality.	None
cache_read_input_tokens	int | None	Optional tokens read from cache.	None
cache_write_input_tokens	int | None	Optional tokens written to cache.	None
Source code in strands/experimental/bidi/types/events.py

class BidiUsageEvent(TypedEvent):
    """Token usage event with modality breakdown for bidirectional streaming.

    Tracks token consumption across different modalities (audio, text, images)
    during bidirectional streaming sessions.

    Parameters:
        input_tokens: Total tokens used for all input modalities.
        output_tokens: Total tokens used for all output modalities.
        total_tokens: Sum of input and output tokens.
        modality_details: Optional list of token usage per modality.
        cache_read_input_tokens: Optional tokens read from cache.
        cache_write_input_tokens: Optional tokens written to cache.
    """

    def __init__(
        self,
        input_tokens: int,
        output_tokens: int,
        total_tokens: int,
        modality_details: list[ModalityUsage] | None = None,
        cache_read_input_tokens: int | None = None,
        cache_write_input_tokens: int | None = None,
    ):
        """Initialize usage event."""
        data: dict[str, Any] = {
            "type": "bidi_usage",
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "totalTokens": total_tokens,
        }
        if modality_details is not None:
            data["modality_details"] = modality_details
        if cache_read_input_tokens is not None:
            data["cacheReadInputTokens"] = cache_read_input_tokens
        if cache_write_input_tokens is not None:
            data["cacheWriteInputTokens"] = cache_write_input_tokens
        super().__init__(data)

    @property
    def input_tokens(self) -> int:
        """Total tokens used for all input modalities."""
        return cast(int, self["inputTokens"])

    @property
    def output_tokens(self) -> int:
        """Total tokens used for all output modalities."""
        return cast(int, self["outputTokens"])

    @property
    def total_tokens(self) -> int:
        """Sum of input and output tokens."""
        return cast(int, self["totalTokens"])

    @property
    def modality_details(self) -> list[ModalityUsage]:
        """Optional list of token usage per modality."""
        return cast(list[ModalityUsage], self.get("modality_details", []))

    @property
    def cache_read_input_tokens(self) -> int | None:
        """Optional tokens read from cache."""
        return cast(int | None, self.get("cacheReadInputTokens"))

    @property
    def cache_write_input_tokens(self) -> int | None:
        """Optional tokens written to cache."""
        return cast(int | None, self.get("cacheWriteInputTokens"))
cache_read_input_tokens property ¶
Optional tokens read from cache.

cache_write_input_tokens property ¶
Optional tokens written to cache.

input_tokens property ¶
Total tokens used for all input modalities.

modality_details property ¶
Optional list of token usage per modality.

output_tokens property ¶
Total tokens used for all output modalities.

total_tokens property ¶
Sum of input and output tokens.

__init__(input_tokens, output_tokens, total_tokens, modality_details=None, cache_read_input_tokens=None, cache_write_input_tokens=None) ¶
Initialize usage event.

Source code in strands/experimental/bidi/types/events.py

def __init__(
    self,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    modality_details: list[ModalityUsage] | None = None,
    cache_read_input_tokens: int | None = None,
    cache_write_input_tokens: int | None = None,
):
    """Initialize usage event."""
    data: dict[str, Any] = {
        "type": "bidi_usage",
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "totalTokens": total_tokens,
    }
    if modality_details is not None:
        data["modality_details"] = modality_details
    if cache_read_input_tokens is not None:
        data["cacheReadInputTokens"] = cache_read_input_tokens
    if cache_write_input_tokens is not None:
        data["cacheWriteInputTokens"] = cache_write_input_tokens
    super().__init__(data)
ModalityUsage ¶
Bases: dict

Token usage for a specific modality.

Attributes:

Name	Type	Description
modality	Literal['text', 'audio', 'image', 'cached']	Type of content.
input_tokens	int	Tokens used for this modality's input.
output_tokens	int	Tokens used for this modality's output.
Source code in strands/experimental/bidi/types/events.py

class ModalityUsage(dict):
    """Token usage for a specific modality.

    Attributes:
        modality: Type of content.
        input_tokens: Tokens used for this modality's input.
        output_tokens: Tokens used for this modality's output.
    """

    modality: Literal["text", "audio", "image", "cached"]
    input_tokens: int
    output_tokens: int
strands.experimental.bidi.types.io ¶
Protocol for bidirectional streaming IO channels.

Defines callable protocols for input and output channels that can be used with BidiAgent. This approach provides better typing and flexibility by separating input and output concerns into independent callables.

BidiInput ¶
Bases: Protocol

Protocol for bidirectional input callables.

Input callables read data from a source (microphone, camera, websocket, etc.) and return events to be sent to the agent.

Source code in strands/experimental/bidi/types/io.py

@runtime_checkable
class BidiInput(Protocol):
    """Protocol for bidirectional input callables.

    Input callables read data from a source (microphone, camera, websocket, etc.)
    and return events to be sent to the agent.
    """

    async def start(self, agent: "BidiAgent") -> None:
        """Start input."""
        return

    async def stop(self) -> None:
        """Stop input."""
        return

    def __call__(self) -> Awaitable[BidiInputEvent]:
        """Read input data from the source.

        Returns:
            Awaitable that resolves to an input event (audio, text, image, etc.)
        """
        ...
__call__() ¶
Read input data from the source.

Returns:

Type	Description
Awaitable[BidiInputEvent]	Awaitable that resolves to an input event (audio, text, image, etc.)
Source code in strands/experimental/bidi/types/io.py

def __call__(self) -> Awaitable[BidiInputEvent]:
    """Read input data from the source.

    Returns:
        Awaitable that resolves to an input event (audio, text, image, etc.)
    """
    ...
start(agent) async ¶
Start input.

Source code in strands/experimental/bidi/types/io.py

async def start(self, agent: "BidiAgent") -> None:
    """Start input."""
    return
stop() async ¶
Stop input.

Source code in strands/experimental/bidi/types/io.py

async def stop(self) -> None:
    """Stop input."""
    return
BidiOutput ¶
Bases: Protocol

Protocol for bidirectional output callables.

Output callables receive events from the agent and handle them appropriately (play audio, display text, send over websocket, etc.).

Source code in strands/experimental/bidi/types/io.py

@runtime_checkable
class BidiOutput(Protocol):
    """Protocol for bidirectional output callables.

    Output callables receive events from the agent and handle them appropriately
    (play audio, display text, send over websocket, etc.).
    """

    async def start(self, agent: "BidiAgent") -> None:
        """Start output."""
        return

    async def stop(self) -> None:
        """Stop output."""
        return

    def __call__(self, event: BidiOutputEvent) -> Awaitable[None]:
        """Process output events from the agent.

        Args:
            event: Output event from the agent (audio, text, tool calls, etc.)
        """
        ...
__call__(event) ¶
Process output events from the agent.

Parameters:

Name	Type	Description	Default
event	BidiOutputEvent	Output event from the agent (audio, text, tool calls, etc.)	required
Source code in strands/experimental/bidi/types/io.py

def __call__(self, event: BidiOutputEvent) -> Awaitable[None]:
    """Process output events from the agent.

    Args:
        event: Output event from the agent (audio, text, tool calls, etc.)
    """
    ...
start(agent) async ¶
Start output.

Source code in strands/experimental/bidi/types/io.py

async def start(self, agent: "BidiAgent") -> None:
    """Start output."""
    return
stop() async ¶
Stop output.

Source code in strands/experimental/bidi/types/io.py

async def stop(self) -> None:
    """Stop output."""
    return