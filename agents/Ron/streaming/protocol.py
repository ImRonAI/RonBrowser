"""
Vercel AI SDK Data Stream Protocol implementation.

This module provides utilities to convert Strands Agent streaming events
into the Vercel AI SDK Data Stream Protocol format (SSE).

Protocol Reference: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol

Event Types:
- start: Message start
- text-start/delta/end: Text content streaming
- reasoning-start/delta/end: Extended thinking content
- tool-input-start/delta/available: Tool input streaming
- tool-output-available: Tool execution result
- data-{type}: Custom data events
- error: Error events
- finish: Message completion
- [DONE]: Stream termination
"""

import json
from typing import Any, Optional, Generator
from dataclasses import dataclass, field


def format_sse(event_type: str, data: dict[str, Any]) -> str:
    """Format data as AI SDK compatible Server-Sent Event.

    Args:
        event_type: The event type (e.g., 'text-delta', 'tool-input-available')
        data: Additional data to include in the event

    Returns:
        Formatted SSE string with data prefix
    """
    payload = {"type": event_type, **data}
    return f"data: {json.dumps(payload)}\n\n"


def format_done() -> str:
    """Format the stream termination event."""
    return "data: [DONE]\n\n"


@dataclass
class AISDKStreamBuilder:
    """Builder for constructing Vercel AI SDK compatible SSE streams.

    Converts Strands Agent stream events into the AI SDK Data Stream Protocol.
    Maintains state for proper event sequencing.

    Example usage:
        builder = AISDKStreamBuilder(message_id="msg_123")

        # Start the message
        yield builder.start()
        yield builder.text_start()

        # Stream text deltas
        for chunk in text_chunks:
            yield builder.text_delta(chunk)

        # Complete
        yield builder.text_end()
        yield builder.finish()
        yield builder.done()
    """

    message_id: str
    text_id: str = field(default="text_001")
    reasoning_id: str = field(default="reasoning_001")
    _text_started: bool = field(default=False, init=False)
    _reasoning_started: bool = field(default=False, init=False)
    _tool_calls: dict[str, dict] = field(default_factory=dict, init=False)

    def start(self) -> str:
        """Emit message start event."""
        return format_sse("start", {"messageId": self.message_id})

    def text_start(self, text_id: Optional[str] = None) -> str:
        """Emit text content start event."""
        self._text_started = True
        return format_sse("text-start", {"id": text_id or self.text_id})

    def text_delta(self, delta: str, text_id: Optional[str] = None) -> str:
        """Emit text content delta event."""
        if not self._text_started:
            # Auto-start text if not already started
            return self.text_start(text_id) + format_sse(
                "text-delta", {"id": text_id or self.text_id, "delta": delta}
            )
        return format_sse("text-delta", {"id": text_id or self.text_id, "delta": delta})

    def text_end(self, text_id: Optional[str] = None) -> str:
        """Emit text content end event."""
        self._text_started = False
        return format_sse("text-end", {"id": text_id or self.text_id})

    def reasoning_start(self, reasoning_id: Optional[str] = None) -> str:
        """Emit reasoning/thinking content start event."""
        self._reasoning_started = True
        return format_sse("reasoning-start", {"id": reasoning_id or self.reasoning_id})

    def reasoning_delta(self, delta: str, reasoning_id: Optional[str] = None) -> str:
        """Emit reasoning/thinking content delta event."""
        if not self._reasoning_started:
            return self.reasoning_start(reasoning_id) + format_sse(
                "reasoning-delta",
                {"id": reasoning_id or self.reasoning_id, "delta": delta},
            )
        return format_sse(
            "reasoning-delta", {"id": reasoning_id or self.reasoning_id, "delta": delta}
        )

    def reasoning_end(self, reasoning_id: Optional[str] = None) -> str:
        """Emit reasoning/thinking content end event."""
        self._reasoning_started = False
        return format_sse("reasoning-end", {"id": reasoning_id or self.reasoning_id})

    def tool_input_start(self, tool_call_id: str, tool_name: str) -> str:
        """Emit tool input start event."""
        self._tool_calls[tool_call_id] = {"name": tool_name, "input": ""}
        return format_sse(
            "tool-input-start", {"toolCallId": tool_call_id, "toolName": tool_name}
        )

    def tool_input_delta(self, tool_call_id: str, input_delta: str) -> str:
        """Emit tool input delta event (streaming tool arguments)."""
        if tool_call_id in self._tool_calls:
            self._tool_calls[tool_call_id]["input"] += input_delta
        return format_sse(
            "tool-input-delta", {"toolCallId": tool_call_id, "inputTextDelta": input_delta}
        )

    def tool_input_available(
        self, tool_call_id: str, tool_name: str, tool_input: dict[str, Any]
    ) -> str:
        """Emit tool input available event (complete tool arguments)."""
        return format_sse(
            "tool-input-available",
            {"toolCallId": tool_call_id, "toolName": tool_name, "input": tool_input},
        )

    def tool_output_available(
        self, tool_call_id: str, output: Any, error: Optional[str] = None
    ) -> str:
        """Emit tool output available event."""
        data: dict[str, Any] = {"toolCallId": tool_call_id}
        if error:
            data["error"] = error
        else:
            data["output"] = output
        return format_sse("tool-output-available", data)

    def data(self, data_type: str, data: Any) -> str:
        """Emit custom data event.

        Args:
            data_type: The data type suffix (e.g., 'weather' -> 'data-weather')
            data: The data payload

        Returns:
            Formatted SSE event
        """
        return format_sse(f"data-{data_type}", {"data": data})

    def source_url(self, source_id: str, url: str, title: Optional[str] = None) -> str:
        """Emit source URL reference event."""
        event_data: dict[str, Any] = {"sourceId": source_id, "url": url}
        if title:
            event_data["title"] = title
        return format_sse("source-url", event_data)

    def error(self, error_text: str) -> str:
        """Emit error event."""
        return format_sse("error", {"errorText": error_text})

    def start_step(self) -> str:
        """Emit step start event (for multi-step responses)."""
        return format_sse("start-step", {})

    def finish_step(self) -> str:
        """Emit step finish event."""
        return format_sse("finish-step", {})

    def finish(self, finish_reason: str = "stop") -> str:
        """Emit message finish event."""
        return format_sse("finish", {"finishReason": finish_reason})

    def done(self) -> str:
        """Emit stream termination."""
        return format_done()


def strands_event_to_aisdk(
    event: dict[str, Any], builder: AISDKStreamBuilder
) -> Generator[str, None, None]:
    """Convert a Strands stream event to AI SDK SSE events.

    This is the main bridge function that transforms Strands Agent events
    into the Vercel AI SDK Data Stream Protocol.

    Strands event types handled:
    - data: Text content being streamed
    - delta: Incremental content chunk
    - reasoningText: Extended thinking content
    - current_tool_use: Tool invocation state
    - result: Final AgentResult with structured_output

    Args:
        event: Strands stream event dictionary
        builder: AISDKStreamBuilder instance for formatting

    Yields:
        Formatted SSE strings for the AI SDK
    """
    # Handle text streaming (data event)
    if "data" in event:
        text_data = event["data"]
        if isinstance(text_data, str) and text_data:
            yield builder.text_delta(text_data)

    # Handle delta events (incremental updates)
    if "delta" in event:
        delta = event["delta"]
        if isinstance(delta, dict):
            # Text delta
            if "text" in delta:
                yield builder.text_delta(delta["text"])
            # Tool use input delta
            elif "input" in delta and "toolUseId" in event:
                yield builder.tool_input_delta(
                    event["toolUseId"], json.dumps(delta["input"])
                )

    # Handle reasoning/thinking text
    if "reasoningText" in event:
        reasoning = event["reasoningText"]
        if isinstance(reasoning, str) and reasoning:
            yield builder.reasoning_delta(reasoning)

    # Handle tool use events
    if "current_tool_use" in event:
        tool_use = event["current_tool_use"]
        if isinstance(tool_use, dict) and tool_use.get("name"):
            tool_id = tool_use.get("toolUseId", tool_use.get("id", "tool_001"))
            tool_name = tool_use["name"]

            # Check if we have complete input
            if tool_use.get("input"):
                yield builder.tool_input_available(
                    tool_id, tool_name, tool_use["input"]
                )
            else:
                yield builder.tool_input_start(tool_id, tool_name)

    # Handle final result
    if "result" in event:
        result = event["result"]
        if hasattr(result, "structured_output") and result.structured_output:
            # Emit structured output as custom data
            output_data = (
                result.structured_output.model_dump()
                if hasattr(result.structured_output, "model_dump")
                else result.structured_output
            )
            yield builder.data("structured_output", output_data)

        # Check for tool results in the final result
        if hasattr(result, "message") and result.message:
            message = result.message
            if isinstance(message, dict) and message.get("tool_results"):
                for tool_result in message["tool_results"]:
                    yield builder.tool_output_available(
                        tool_result.get("toolUseId", ""),
                        tool_result.get("output"),
                        tool_result.get("error"),
                    )
