"""
AI SDK v5 UIMessageStream SSE emitter for Strands Agents.

Emits Server-Sent Events in the exact format expected by Vercel AI SDK v5
useChat hook with UIMessageStream protocol.

Validated against:
- DeepWiki: vercel/ai repository - UIMessageStream SSE protocol
- DeepWiki: strands-agents/sdk-python - callback event format
- Reference: ron-ai-web/project/backend/ron_agents/claude/aisdk_stream.py

Protocol:
- All events are JSON objects sent as: data: {json}\n\n
- Requires header: x-vercel-ai-ui-message-stream: v1
- Text/reasoning blocks use start/delta/end lifecycle with unique IDs
- Tool calls use tool-input-start, tool-input-available, tool-output-available
- Steps delineate LLM turns: start-step → content → finish-step
"""

import json
import uuid
from typing import Dict, Any, Optional


class AISDKStreamEmitter:
    """
    Emits AI SDK v5 compliant Server-Sent Events.

    Single source of truth for SSE emission - maps Strands callback events
    to AI SDK v5 UIMessageStream format.
    """

    @staticmethod
    def emit_start(message_id: Optional[str] = None) -> str:
        """Start of message stream."""
        event: Dict[str, Any] = {"type": "start"}
        if message_id is not None:
            event["messageId"] = message_id
        return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_start_step() -> str:
        """Start of processing step (one LLM turn)."""
        return f'data: {json.dumps({"type": "start-step"})}\n\n'

    @staticmethod
    def emit_text_start(text_id: str) -> str:
        """Start of text block."""
        return f'data: {json.dumps({"type": "text-start", "id": text_id})}\n\n'

    @staticmethod
    def emit_text_delta(text_id: str, delta: str) -> str:
        """Incremental text content delta."""
        return f'data: {json.dumps({"type": "text-delta", "id": text_id, "delta": delta})}\n\n'

    @staticmethod
    def emit_text_end(text_id: str) -> str:
        """End of text block."""
        return f'data: {json.dumps({"type": "text-end", "id": text_id})}\n\n'

    @staticmethod
    def emit_reasoning_start(reasoning_id: str) -> str:
        """Start of reasoning/thinking block."""
        return f'data: {json.dumps({"type": "reasoning-start", "id": reasoning_id})}\n\n'

    @staticmethod
    def emit_reasoning_delta(reasoning_id: str, delta: str) -> str:
        """Incremental reasoning content delta."""
        return f'data: {json.dumps({"type": "reasoning-delta", "id": reasoning_id, "delta": delta})}\n\n'

    @staticmethod
    def emit_reasoning_end(reasoning_id: str) -> str:
        """End of reasoning block."""
        return f'data: {json.dumps({"type": "reasoning-end", "id": reasoning_id})}\n\n'

    @staticmethod
    def emit_tool_input_start(tool_call_id: str, tool_name: str) -> str:
        """Start of tool call."""
        return f'data: {json.dumps({"type": "tool-input-start", "toolCallId": tool_call_id, "toolName": tool_name})}\n\n'

    @staticmethod
    def emit_tool_input_available(tool_call_id: str, tool_name: str, input_data: Any) -> str:
        """Complete tool input available."""
        return f'data: {json.dumps({"type": "tool-input-available", "toolCallId": tool_call_id, "toolName": tool_name, "input": input_data})}\n\n'

    @staticmethod
    def emit_tool_output_available(tool_call_id: str, output: Any) -> str:
        """Tool execution output/result."""
        return f'data: {json.dumps({"type": "tool-output-available", "toolCallId": tool_call_id, "output": output})}\n\n'

    @staticmethod
    def emit_tool_output_error(tool_call_id: str, error_text: str) -> str:
        """Tool execution error."""
        return f'data: {json.dumps({"type": "tool-output-error", "toolCallId": tool_call_id, "errorText": error_text})}\n\n'

    @staticmethod
    def emit_finish_step() -> str:
        """End of processing step."""
        return f'data: {json.dumps({"type": "finish-step"})}\n\n'

    @staticmethod
    def emit_finish(finish_reason: Optional[str] = None) -> str:
        """End of message stream."""
        event: Dict[str, Any] = {"type": "finish"}
        if finish_reason is not None:
            event["finishReason"] = finish_reason
        return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_done() -> str:
        """Stream termination marker."""
        return 'data: [DONE]\n\n'

    @staticmethod
    def emit_error(error_text: str) -> str:
        """Error event."""
        return f'data: {json.dumps({"type": "error", "errorText": error_text})}\n\n'

    @staticmethod
    def emit_ping() -> str:
        """SSE ping/keepalive comment."""
        return ': ping\n\n'


class AISDKCallbackHandler:
    """
    Strands callback handler that emits AI SDK v5 UIMessageStream events.

    Maps Strands callback events to AI SDK v5 format:
    - init_event_loop → start
    - start_event_loop → start-step
    - reasoningText → reasoning-start/delta/end
    - data → text-start/delta/end
    - current_tool_use → tool-input-start + tool-input-available
    - tool_stream_event → tool-output-available
    - complete → finish-step + finish + [DONE]
    """

    def __init__(self, emit_fn):
        """
        Args:
            emit_fn: Callable that receives SSE string to emit (e.g., queue.put_nowait)
        """
        self.emit = emit_fn
        self.emitter = AISDKStreamEmitter()

        # State tracking
        self.started = False
        self.in_step = False
        self.in_reasoning = False
        self.in_text = False
        self.reasoning_id: Optional[str] = None
        self.text_id: Optional[str] = None
        self.pending_tool_ids: set = set()  # Track tools awaiting output

    def _new_id(self, prefix: str = "") -> str:
        """Generate unique ID for blocks."""
        return f"{prefix}{uuid.uuid4().hex[:8]}"

    def _close_reasoning(self):
        """Close reasoning block if open."""
        if self.in_reasoning and self.reasoning_id:
            self.emit(self.emitter.emit_reasoning_end(self.reasoning_id))
            self.in_reasoning = False
            self.reasoning_id = None

    def _close_text(self):
        """Close text block if open."""
        if self.in_text and self.text_id:
            self.emit(self.emitter.emit_text_end(self.text_id))
            self.in_text = False
            self.text_id = None

    def _ensure_started(self):
        """Ensure stream and step have started."""
        if not self.started:
            self.emit(self.emitter.emit_start())
            self.started = True
        if not self.in_step:
            self.emit(self.emitter.emit_start_step())
            self.in_step = True

    def __call__(self, **kwargs: Any) -> None:
        """
        Process Strands callback event and emit AI SDK v5 SSE events.

        Strands event keys:
        - init_event_loop: bool - Event loop initializing
        - start_event_loop: bool - Event loop starting
        - reasoningText: str - Reasoning/thinking content (with reasoning=True)
        - data: str - Text content
        - current_tool_use: dict - Tool being called {toolUseId, name, input}
        - tool_stream_event: dict - Streaming output from tool {data, tool_use}
        - complete: bool - Stream complete
        - result: AgentResult - Final result
        """
        # Handle lifecycle events
        if kwargs.get("init_event_loop"):
            self._ensure_started()
            return

        if kwargs.get("start_event_loop"):
            self._ensure_started()
            return

        # Handle reasoning content
        reasoning_text = kwargs.get("reasoningText")
        if reasoning_text and kwargs.get("reasoning"):
            self._ensure_started()
            self._close_text()  # Close text if transitioning from text to reasoning

            if not self.in_reasoning:
                self.reasoning_id = self._new_id("r-")
                self.emit(self.emitter.emit_reasoning_start(self.reasoning_id))
                self.in_reasoning = True

            self.emit(self.emitter.emit_reasoning_delta(self.reasoning_id, reasoning_text))
            return

        # Handle text content
        data = kwargs.get("data")
        if data:
            self._ensure_started()
            self._close_reasoning()  # Close reasoning if transitioning from reasoning to text

            if not self.in_text:
                self.text_id = self._new_id("t-")
                self.emit(self.emitter.emit_text_start(self.text_id))
                self.in_text = True

            self.emit(self.emitter.emit_text_delta(self.text_id, data))
            return

        # Handle tool use
        current_tool_use = kwargs.get("current_tool_use")
        if current_tool_use and current_tool_use.get("name"):
            self._ensure_started()
            self._close_reasoning()
            self._close_text()

            tool_id = current_tool_use.get("toolUseId", self._new_id("tool-"))
            tool_name = current_tool_use.get("name")
            tool_input = current_tool_use.get("input", {})

            # Parse input if it's a string (Strands accumulates JSON string)
            if isinstance(tool_input, str):
                try:
                    tool_input = json.loads(tool_input)
                except json.JSONDecodeError:
                    tool_input = {"raw": tool_input}

            # Only emit if we haven't seen this tool yet or input changed significantly
            if tool_id not in self.pending_tool_ids:
                self.emit(self.emitter.emit_tool_input_start(tool_id, tool_name))
                self.emit(self.emitter.emit_tool_input_available(tool_id, tool_name, tool_input))
                self.pending_tool_ids.add(tool_id)
            return

        # Handle tool streaming output
        tool_stream_event = kwargs.get("tool_stream_event")
        if tool_stream_event:
            tool_use = tool_stream_event.get("tool_use", {})
            tool_id = tool_use.get("toolUseId", "unknown")
            output_data = tool_stream_event.get("data")

            self.emit(self.emitter.emit_tool_output_available(tool_id, output_data))
            self.pending_tool_ids.discard(tool_id)
            return

        # Handle tool result (from result message content)
        tool_result = kwargs.get("tool_result")
        if tool_result:
            tool_id = tool_result.get("toolUseId", "unknown")
            status = tool_result.get("status", "success")
            content = tool_result.get("content", [])

            if status == "error":
                error_text = content[0].get("text", "Tool execution failed") if content else "Tool execution failed"
                self.emit(self.emitter.emit_tool_output_error(tool_id, error_text))
            else:
                output = content[0] if len(content) == 1 else content
                self.emit(self.emitter.emit_tool_output_available(tool_id, output))

            self.pending_tool_ids.discard(tool_id)
            return

        # Handle completion
        if kwargs.get("complete"):
            self._close_reasoning()
            self._close_text()

            if self.in_step:
                self.emit(self.emitter.emit_finish_step())
                self.in_step = False

            self.emit(self.emitter.emit_finish("stop"))
            self.emit(self.emitter.emit_done())
            return

        # Handle final result
        result = kwargs.get("result")
        if result:
            self._close_reasoning()
            self._close_text()

            if self.in_step:
                self.emit(self.emitter.emit_finish_step())
                self.in_step = False

            # Map provider stop reasons to AI SDK valid values
            # AI SDK accepts: stop, length, content-filter, tool-calls, error, other
            raw_reason = getattr(result, 'stop_reason', 'stop') if hasattr(result, 'stop_reason') else 'stop'
            reason_map = {
                'end_turn': 'stop',
                'stop_sequence': 'stop',
                'max_tokens': 'length',
                'tool_use': 'tool-calls',
            }
            finish_reason = reason_map.get(raw_reason, 'stop')
            self.emit(self.emitter.emit_finish(finish_reason))
            self.emit(self.emitter.emit_done())
            return
