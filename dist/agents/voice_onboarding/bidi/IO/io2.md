strands.experimental.bidi.io ¶
IO channel implementations for bidirectional streaming.

strands.experimental.bidi.io.audio ¶
Send and receive audio data from devices.

Reads user audio from input device and sends agent audio to output device using PyAudio. If a user interrupts the agent, the output buffer is cleared to stop playback.

Audio configuration is provided by the model via agent.model.config["audio"].

BidiAudioIO ¶
Send and receive audio data from devices.

Source code in strands/experimental/bidi/io/audio.py

class BidiAudioIO:
    """Send and receive audio data from devices."""

    def __init__(self, **config: Any) -> None:
        """Initialize audio devices.

        Args:
            **config: Optional device configuration:

                - input_buffer_size (int): Maximum input buffer size (default: None)
                - input_device_index (int): Specific input device (default: None = system default)
                - input_frames_per_buffer (int): Input buffer size (default: 512)
                - output_buffer_size (int): Maximum output buffer size (default: None)
                - output_device_index (int): Specific output device (default: None = system default)
                - output_frames_per_buffer (int): Output buffer size (default: 512)
        """
        self._config = config

    def input(self) -> _BidiAudioInput:
        """Return audio processing BidiInput."""
        return _BidiAudioInput(self._config)

    def output(self) -> _BidiAudioOutput:
        """Return audio processing BidiOutput."""
        return _BidiAudioOutput(self._config)
__init__(**config) ¶
Initialize audio devices.

Parameters:

Name	Type	Description	Default
**config	Any	Optional device configuration:
input_buffer_size (int): Maximum input buffer size (default: None)
input_device_index (int): Specific input device (default: None = system default)
input_frames_per_buffer (int): Input buffer size (default: 512)
output_buffer_size (int): Maximum output buffer size (default: None)
output_device_index (int): Specific output device (default: None = system default)
output_frames_per_buffer (int): Output buffer size (default: 512)
{}
Source code in strands/experimental/bidi/io/audio.py

def __init__(self, **config: Any) -> None:
    """Initialize audio devices.

    Args:
        **config: Optional device configuration:

            - input_buffer_size (int): Maximum input buffer size (default: None)
            - input_device_index (int): Specific input device (default: None = system default)
            - input_frames_per_buffer (int): Input buffer size (default: 512)
            - output_buffer_size (int): Maximum output buffer size (default: None)
            - output_device_index (int): Specific output device (default: None = system default)
            - output_frames_per_buffer (int): Output buffer size (default: 512)
    """
    self._config = config
input() ¶
Return audio processing BidiInput.

Source code in strands/experimental/bidi/io/audio.py

def input(self) -> _BidiAudioInput:
    """Return audio processing BidiInput."""
    return _BidiAudioInput(self._config)
output() ¶
Return audio processing BidiOutput.

Source code in strands/experimental/bidi/io/audio.py

def output(self) -> _BidiAudioOutput:
    """Return audio processing BidiOutput."""
    return _BidiAudioOutput(self._config)
strands.experimental.bidi.io.text ¶
Handle text input and output to and from bidi agent.

BidiTextIO ¶
Handle text input and output to and from bidi agent.

Accepts input from stdin and outputs to stdout.

Source code in strands/experimental/bidi/io/text.py

class BidiTextIO:
    """Handle text input and output to and from bidi agent.

    Accepts input from stdin and outputs to stdout.
    """

    def __init__(self, **config: Any) -> None:
        """Initialize I/O.

        Args:
            **config: Optional I/O configurations.

                - input_prompt (str): Input prompt to display on screen (default: blank)
        """
        self._config = config

    def input(self) -> _BidiTextInput:
        """Return text processing BidiInput."""
        return _BidiTextInput(self._config)

    def output(self) -> _BidiTextOutput:
        """Return text processing BidiOutput."""
        return _BidiTextOutput()
__init__(**config) ¶
Initialize I/O.

Parameters:

Name	Type	Description	Default
**config	Any	Optional I/O configurations.
input_prompt (str): Input prompt to display on screen (default: blank)
{}
Source code in strands/experimental/bidi/io/text.py

def __init__(self, **config: Any) -> None:
    """Initialize I/O.

    Args:
        **config: Optional I/O configurations.

            - input_prompt (str): Input prompt to display on screen (default: blank)
    """
    self._config = config
input() ¶
Return text processing BidiInput.

Source code in strands/experimental/bidi/io/text.py

def input(self) -> _BidiTextInput:
    """Return text processing BidiInput."""
    return _BidiTextInput(self._config)
output() ¶
Return text processing BidiOutput.

Source code in strands/experimental/bidi/io/text.py

def output(self) -> _BidiTextOutput:
    """Return text processing BidiOutput."""
    return _BidiTextOutput()