"""Streaming utilities for Strands Agent/BidiAgent -> Vercel AI SDK UIMessageStream SSE."""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Type

from pydantic import BaseModel

logger = logging.getLogger(__name__)

STOP_REASON_TO_FINISH_REASON: dict[str, str] = {
    "end_turn": "stop",
    "max_tokens": "length",
    "tool_use": "tool-calls",
    "content_filtered": "content-filter",
    "stop_sequence": "stop",
    "guardrail_intervened": "content-filter",
    "interrupt": "other",
}

BIDI_STOP_REASON_TO_FINISH_REASON: dict[str, str] = {
    "complete": "stop",
    "tool_use": "tool-calls",
    "interrupted": "other",
    "error": "error",
}

BIDI_CONNECTION_CLOSE_REASON_TO_FINISH_REASON: dict[str, str] = {
    "complete": "stop",
    "user_request": "stop",
    "client_disconnect": "other",
    "timeout": "other",
    "error": "error",
}

SKIPPED_EVENT_KEYS = {
    "init_event_loop",
    "start",
    "event_loop_throttled_delay",
    "tool_stream_event",
    "tool_cancel_event",
    "tool_interrupt_event",
}

SKIPPED_EVENT_TYPES = {"tool_stream"}


@dataclass
class StreamState:
    message_id: str
    finish_reason: str = "stop"
    active_text_id: str | None = None
    active_text_last_transcript: str = ""
    active_reasoning_id: str | None = None
    tool_inputs_started: set[str] = field(default_factory=set)
    tool_inputs_available: set[str] = field(default_factory=set)


def _json_default(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, uuid.UUID):
        return str(value)
    return str(value)


def sse(event_type: str, data: dict[str, Any] | None = None) -> str:
    payload = {"type": event_type}
    if data:
        payload.update(data)
    return f"data: {json.dumps(payload, default=_json_default)}\n\n"


def _next_part_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _extract_structured_output(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    return value


def _map_finish_reason(stop_reason: str | None) -> str:
    if not stop_reason:
        return "stop"
    return STOP_REASON_TO_FINISH_REASON.get(stop_reason, "other")


def _map_bidi_stop_reason(stop_reason: str | None) -> str:
    if not stop_reason:
        return "stop"
    return BIDI_STOP_REASON_TO_FINISH_REASON.get(stop_reason, "other")


def _map_bidi_close_reason(close_reason: str | None) -> str:
    if not close_reason:
        return "other"
    return BIDI_CONNECTION_CLOSE_REASON_TO_FINISH_REASON.get(close_reason, "other")


def _close_active_text_stream(state: StreamState) -> list[str]:
    if state.active_text_id is None:
        return []
    closed_id = state.active_text_id
    state.active_text_id = None
    state.active_text_last_transcript = ""
    return [sse("text-end", {"id": closed_id})]


def _emit_tool_input_available(tool_use: dict[str, Any], state: StreamState) -> list[str]:
    tool_call_id = tool_use.get("toolUseId")
    tool_name = tool_use.get("name")
    if not isinstance(tool_call_id, str) or not isinstance(tool_name, str):
        return []

    output: list[str] = []
    if tool_call_id not in state.tool_inputs_started:
        state.tool_inputs_started.add(tool_call_id)
        output.append(sse("tool-input-start", {"toolCallId": tool_call_id, "toolName": tool_name}))

    if tool_call_id not in state.tool_inputs_available:
        state.tool_inputs_available.add(tool_call_id)
        output.append(
            sse(
                "tool-input-available",
                {
                    "toolCallId": tool_call_id,
                    "toolName": tool_name,
                    "input": tool_use.get("input"),
                },
            )
        )

    return output


def _handle_bidi_transcript_event(event: dict[str, Any], state: StreamState) -> list[str]:
    if event.get("role") != "assistant":
        return []

    text = event.get("text")
    if not isinstance(text, str) or not text:
        return []

    output: list[str] = []
    if state.active_text_id is None:
        state.active_text_id = _next_part_id("text")
        state.active_text_last_transcript = ""
        output.append(sse("text-start", {"id": state.active_text_id}))

    current_transcript = event.get("current_transcript")
    delta_text = text
    if isinstance(current_transcript, str) and current_transcript:
        if current_transcript.startswith(state.active_text_last_transcript):
            delta_text = current_transcript[len(state.active_text_last_transcript) :]
        state.active_text_last_transcript = current_transcript
    elif text:
        state.active_text_last_transcript += text

    if delta_text:
        output.append(sse("text-delta", {"id": state.active_text_id, "delta": delta_text}))

    if event.get("is_final") is True:
        output.extend(_close_active_text_stream(state))

    return output


def _handle_bidi_event(event: dict[str, Any], state: StreamState) -> tuple[list[str], bool]:
    event_type = event.get("type")

    if event_type == "bidi_transcript_stream":
        return _handle_bidi_transcript_event(event, state), False

    if event_type == "tool_use_stream":
        current_tool_use = event.get("current_tool_use")
        if not isinstance(current_tool_use, dict):
            return [], False
        return _emit_tool_input_available(current_tool_use, state), False

    if "message" in event:
        message = event.get("message")
        if isinstance(message, dict) and message.get("role") == "user":
            return _handle_tool_result_message_event(message), False
        return [], False

    if event_type == "bidi_response_complete":
        stop_reason = event.get("stop_reason")
        if isinstance(stop_reason, str):
            state.finish_reason = _map_bidi_stop_reason(stop_reason)
            # tool_use indicates the model is waiting for tool execution and will continue.
            if stop_reason == "tool_use":
                return [], False
        return [], True

    if event_type == "bidi_connection_close":
        reason = event.get("reason")
        if isinstance(reason, str):
            state.finish_reason = _map_bidi_close_reason(reason)
        return [], True

    if event_type == "bidi_error":
        error_text = event.get("message")
        state.finish_reason = "error"
        return [sse("error", {"errorText": str(error_text or "Bidi agent error")})], True

    if event_type == "bidi_interruption":
        return [sse("data-bidi-interruption", {"data": {"reason": event.get("reason")}})], False

    if event_type == "bidi_connection_restart":
        return [sse("data-bidi-connection-restart", {"data": {"event": event_type}})], False

    if event_type == "bidi_usage":
        return [sse("data-bidi-usage", {"data": event})], False

    if event_type == "bidi_audio_stream":
        return [sse("data-bidi-audio", {"data": event})], False

    if event_type in {"bidi_connection_start", "bidi_response_start", "tool_result"}:
        logger.debug("Skipping bidi lifecycle event type=%s", event_type)
        return [], False

    logger.debug("Unmapped bidi event keys=%s", list(event.keys()))
    return [], False


def _is_standard_agent(agent: Any) -> bool:
    return callable(getattr(agent, "stream_async", None))


def _is_bidi_agent(agent: Any) -> bool:
    return (
        callable(getattr(agent, "start", None))
        and callable(getattr(agent, "send", None))
        and callable(getattr(agent, "receive", None))
        and callable(getattr(agent, "stop", None))
        and not _is_standard_agent(agent)
    )


def _handle_model_stream_chunk(event: dict[str, Any], state: StreamState) -> list[str]:
    chunk = event.get("event")
    if not isinstance(chunk, dict):
        logger.debug("Skipping ModelStreamChunkEvent with non-dict chunk: %r", chunk)
        return []

    output: list[str] = []

    # ModelStreamChunkEvent {"event": {"contentBlockStart": {"start": {"toolUse": ...}}}}
    if "contentBlockStart" in chunk:
        start_event = chunk.get("contentBlockStart")
        if isinstance(start_event, dict):
            start = start_event.get("start")
            if isinstance(start, dict):
                tool_use = start.get("toolUse")
                if isinstance(tool_use, dict):
                    tool_call_id = tool_use.get("toolUseId")
                    tool_name = tool_use.get("name")
                    if isinstance(tool_call_id, str) and isinstance(tool_name, str):
                        output.append(
                            sse(
                                "tool-input-start",
                                {"toolCallId": tool_call_id, "toolName": tool_name},
                            )
                        )

    # ModelStreamChunkEvent {"event": {"contentBlockStop": {...}}}
    if "contentBlockStop" in chunk:
        if state.active_text_id is not None:
            output.append(sse("text-end", {"id": state.active_text_id}))
            state.active_text_id = None
            state.active_text_last_transcript = ""
        elif state.active_reasoning_id is not None:
            output.append(sse("reasoning-end", {"id": state.active_reasoning_id}))
            state.active_reasoning_id = None

    return output


def _handle_assistant_message_event(message: dict[str, Any]) -> list[str]:
    # ModelMessageEvent {"message": {"role": "assistant", "content": [{"toolUse": ...}, ...]}}
    content = message.get("content")
    if not isinstance(content, list):
        return []

    output: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        tool_use = block.get("toolUse")
        if not isinstance(tool_use, dict):
            continue

        tool_call_id = tool_use.get("toolUseId")
        tool_name = tool_use.get("name")
        tool_input = tool_use.get("input")
        if isinstance(tool_call_id, str) and isinstance(tool_name, str):
            output.append(
                sse(
                    "tool-input-available",
                    {
                        "toolCallId": tool_call_id,
                        "toolName": tool_name,
                        "input": tool_input,
                    },
                )
            )
    return output


def _handle_tool_result_message_event(message: dict[str, Any]) -> list[str]:
    # ToolResultMessageEvent {"message": {"role": "user", "content": [{"toolResult": ...}, ...]}}
    content = message.get("content")
    if not isinstance(content, list):
        return []

    output: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        tool_result = block.get("toolResult")
        if not isinstance(tool_result, dict):
            continue

        tool_call_id = tool_result.get("toolUseId")
        if not isinstance(tool_call_id, str):
            continue

        tool_output = tool_result.get("content")
        output.append(
            sse(
                "tool-output-available",
                {
                    "toolCallId": tool_call_id,
                    "output": tool_output,
                },
            )
        )
    return output


def convert_event(event: dict[str, Any], state: StreamState) -> list[str]:
    if not isinstance(event, dict):
        logger.debug("Skipping non-dict stream event: %r", event)
        return []

    # ForceStopEvent {"force_stop": True, "force_stop_reason": "..."}
    if "force_stop" in event:
        reason = event.get("force_stop_reason")
        state.finish_reason = "error"
        return [sse("error", {"errorText": str(reason) if reason else "Agent force-stopped"})]

    # StartEventLoopEvent {"start_event_loop": True}
    if "start_event_loop" in event:
        return [sse("start-step")]

    # ModelStreamChunkEvent {"event": StreamEvent}
    if "event" in event:
        return _handle_model_stream_chunk(event, state)

    # TextStreamEvent {"data": text, "delta": delta}
    if "data" in event and "delta" in event and "reasoning" not in event:
        text = event.get("data")
        if not isinstance(text, str) or not text:
            return []
        if state.active_text_id is None:
            state.active_text_id = _next_part_id("text")
            return [
                sse("text-start", {"id": state.active_text_id}),
                sse("text-delta", {"id": state.active_text_id, "delta": text}),
            ]
        return [sse("text-delta", {"id": state.active_text_id, "delta": text})]

    # ReasoningTextStreamEvent {"reasoningText": text, "delta": delta, "reasoning": True}
    if "reasoningText" in event and "reasoning" in event:
        reasoning_text = event.get("reasoningText")
        if not isinstance(reasoning_text, str) or not reasoning_text:
            return []
        if state.active_reasoning_id is None:
            state.active_reasoning_id = _next_part_id("reasoning")
            return [
                sse("reasoning-start", {"id": state.active_reasoning_id}),
                sse("reasoning-delta", {"id": state.active_reasoning_id, "delta": reasoning_text}),
            ]
        return [sse("reasoning-delta", {"id": state.active_reasoning_id, "delta": reasoning_text})]

    # ToolUseStreamEvent {"type": "tool_use_stream", "delta": ..., "current_tool_use": ...}
    if event.get("type") == "tool_use_stream":
        current_tool_use = event.get("current_tool_use")
        delta = event.get("delta")
        if not isinstance(current_tool_use, dict) or not isinstance(delta, dict):
            return []
        tool_call_id = current_tool_use.get("toolUseId")
        tool_use_delta = delta.get("toolUse")
        if not isinstance(tool_call_id, str) or not isinstance(tool_use_delta, dict):
            return []
        input_delta = tool_use_delta.get("input")
        if not isinstance(input_delta, str):
            return []
        return [sse("tool-input-delta", {"toolCallId": tool_call_id, "inputTextDelta": input_delta})]

    # ModelMessageEvent / ToolResultMessageEvent: both are {"message": ...}
    if "message" in event:
        message = event.get("message")
        if not isinstance(message, dict):
            return []
        role = message.get("role")
        if role == "assistant":
            return _handle_assistant_message_event(message)
        if role == "user":
            return _handle_tool_result_message_event(message)
        return []

    # StructuredOutputEvent {"structured_output": BaseModel}
    if "structured_output" in event:
        return [sse("data-structured-output", {"data": _extract_structured_output(event.get("structured_output"))})]

    # AgentResultEvent {"result": AgentResult}
    if "result" in event:
        result = event.get("result")
        output: list[str] = []
        stop_reason = getattr(result, "stop_reason", None)
        if isinstance(stop_reason, str):
            state.finish_reason = _map_finish_reason(stop_reason)

        structured_output = getattr(result, "structured_output", None)
        if structured_output is not None:
            output.append(sse("data-structured-output", {"data": _extract_structured_output(structured_output)}))
        return output

    if any(key in event for key in SKIPPED_EVENT_KEYS) or event.get("type") in SKIPPED_EVENT_TYPES:
        logger.debug("Skipping internal stream event keys=%s", list(event.keys()))
    else:
        logger.debug("Unmapped stream event keys=%s", list(event.keys()))
    return []


async def stream_agent_response(
    agent: Any,
    message: str,
    structured_output_model: Type[BaseModel] | None = None,
    invocation_state: dict[str, Any] | None = None,
) -> AsyncIterator[str]:
    """Stream Strands output as Vercel AI SDK v6 UIMessageStream SSE."""
    if _is_standard_agent(agent):
        async for chunk in _stream_standard_agent_response(
            agent=agent,
            message=message,
            structured_output_model=structured_output_model,
            invocation_state=invocation_state,
        ):
            yield chunk
        return

    if _is_bidi_agent(agent):
        async for chunk in _stream_bidi_agent_response(
            agent=agent,
            message=message,
            structured_output_model=structured_output_model,
            invocation_state=invocation_state,
        ):
            yield chunk
        return

    raise TypeError("Unsupported agent type for streaming: expected Agent or BidiAgent")


async def _stream_standard_agent_response(
    *,
    agent: Any,
    message: str,
    structured_output_model: Type[BaseModel] | None,
    invocation_state: dict[str, Any] | None,
) -> AsyncIterator[str]:
    state = StreamState(message_id=str(uuid.uuid4()))

    yield sse("start", {"messageId": state.message_id})

    try:
        async for event in agent.stream_async(
            message,
            invocation_state=invocation_state,
            structured_output_model=structured_output_model,
        ):
            for chunk in convert_event(event, state):
                yield chunk
    except Exception as exc:
        logger.error("Agent stream error: %s", exc, exc_info=True)
        state.finish_reason = "error"
        yield sse("error", {"errorText": str(exc)})
    finally:
        if state.active_text_id is not None:
            yield sse("text-end", {"id": state.active_text_id})
            state.active_text_id = None
            state.active_text_last_transcript = ""
        if state.active_reasoning_id is not None:
            yield sse("reasoning-end", {"id": state.active_reasoning_id})
            state.active_reasoning_id = None

        yield sse("finish-step")
        yield sse("finish", {"finishReason": state.finish_reason})
        yield "data: [DONE]\n\n"


async def _stream_bidi_agent_response(
    *,
    agent: Any,
    message: str,
    structured_output_model: Type[BaseModel] | None,
    invocation_state: dict[str, Any] | None,
) -> AsyncIterator[str]:
    state = StreamState(message_id=str(uuid.uuid4()))
    started = False

    yield sse("start", {"messageId": state.message_id})
    yield sse("start-step")

    if structured_output_model is not None:
        logger.warning("BidiAgent does not support structured_output_model; ignoring for this request")

    try:
        await agent.start(invocation_state=invocation_state)
        started = True
        await agent.send(message)

        async for raw_event in agent.receive():
            if not isinstance(raw_event, dict):
                logger.debug("Skipping non-dict bidi event: %r", raw_event)
                continue

            chunks, should_stop = _handle_bidi_event(raw_event, state)
            for chunk in chunks:
                yield chunk

            if should_stop:
                break
    except Exception as exc:
        logger.error("Bidi agent stream error: %s", exc, exc_info=True)
        state.finish_reason = "error"
        yield sse("error", {"errorText": str(exc)})
    finally:
        if started:
            try:
                await agent.stop()
            except Exception as stop_exc:
                logger.error("Bidi agent stop error: %s", stop_exc, exc_info=True)
                if state.finish_reason != "error":
                    state.finish_reason = "error"
                    yield sse("error", {"errorText": str(stop_exc)})

        if state.active_text_id is not None:
            yield sse("text-end", {"id": state.active_text_id})
            state.active_text_id = None
            state.active_text_last_transcript = ""
        if state.active_reasoning_id is not None:
            yield sse("reasoning-end", {"id": state.active_reasoning_id})
            state.active_reasoning_id = None

        yield sse("finish-step")
        yield sse("finish", {"finishReason": state.finish_reason})
        yield "data: [DONE]\n\n"


def parse_ai_sdk_message(messages: list[dict[str, Any]]) -> str:
    if not messages:
        return ""

    last = messages[-1]
    parts = last.get("parts")
    if isinstance(parts, list):
        for part in parts:
            if isinstance(part, dict) and part.get("type") == "text":
                text = part.get("text")
                if isinstance(text, str):
                    return text

    content = last.get("content")
    return content if isinstance(content, str) else ""
