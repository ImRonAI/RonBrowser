"""
Agent streaming endpoints using Strands SDK with Vercel AI SDK UIMessageStream.

Framework-compliant implementation:
- Uses Agent.stream_async() or BidiAgent start/send/receive/stop
- Converts Strands typed events to UIMessageStream events
- Supports structured output via Strands native structured_output_model on standard Agent paths
- Emits structured output as Vercel AI SDK V6 data-* parts
"""

import importlib
import logging
import uuid
from typing import Any, Dict, List, Optional, Type

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from agent.api.core.agent_factory import AgentFactory
from agent.api.core.streaming import stream_agent_response, parse_ai_sdk_message

router = APIRouter()
logger = logging.getLogger(__name__)

_schema_registry: Dict[str, Type[BaseModel]] = {}


def register_schema(name: str, model: Type[BaseModel]) -> None:
    _schema_registry[name] = model


def resolve_schema(name: Optional[str]) -> Optional[Type[BaseModel]]:
    if not name:
        return None
    if name in _schema_registry:
        return _schema_registry[name]
    if "." in name:
        try:
            module_path, class_name = name.rsplit(".", 1)
            module = importlib.import_module(module_path)
            cls = getattr(module, class_name)
            if isinstance(cls, type) and issubclass(cls, BaseModel):
                _schema_registry[name] = cls
                return cls
        except Exception as e:
            logger.warning(f"Failed to resolve schema '{name}': {e}")
    return None


class ChatMessagePart(BaseModel):
    type: str = "text"
    text: str = ""


class ChatMessage(BaseModel):
    role: str = "user"
    parts: List[ChatMessagePart] = []
    content: str = ""


class StreamRequest(BaseModel):
    session_id: str = "default"
    messages: List[ChatMessage] = []
    message: str = ""
    structured_output: Optional[str] = None
    invocation_state: Optional[Dict[str, Any]] = None
    interaction_mode: Optional[str] = None


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "x-vercel-ai-ui-message-stream": "v1",
}


def _parse_request(body: dict):
    session_id = body.get("session_id", "default")
    messages = body.get("messages", [])
    message = body.get("message", "")
    if messages and not message:
        message = parse_ai_sdk_message(messages)
    schema = resolve_schema(body.get("structured_output"))
    invocation_state = body.get("invocation_state")
    if not isinstance(invocation_state, dict):
        invocation_state = {}
    return session_id, message, schema, invocation_state


def _build_invocation_state(
    request: Request,
    session_id: str,
    agent_type: str,
    request_state: dict[str, Any],
) -> dict[str, Any]:
    state = dict(request_state)
    state.setdefault("request_id", str(uuid.uuid4()))
    state.setdefault("session_id", session_id)
    state.setdefault("agent_type", agent_type)
    state.setdefault("path", request.url.path)
    state.setdefault("method", request.method)

    if request.client is not None:
        state.setdefault("client_host", request.client.host)
    user_agent = request.headers.get("user-agent")
    if user_agent:
        state.setdefault("user_agent", user_agent)

    return state


@router.post("/super/stream")
async def superagent_stream(request: Request):
    """
    Stream text SuperAgent responses.

    Request body:
        - session_id: str - Session identifier
        - messages: list - AI SDK format messages with parts
        - message: str - Direct message (alternative to messages)
        - structured_output: str | null - Registered schema name or
          fully-qualified ``module.ClassName`` path to a Pydantic model.
          When provided, standard (non-bidi) agents use Strands' native
          ``structured_output_model`` and the validated result is emitted
          as a ``data-structured-output`` part per the Vercel AI SDK V6
          UIMessageStream protocol. (Bidi superagent requests ignore this field.)
        - interaction_mode: accepted for compatibility, but this route is text-only.
          Use /agents/super-bidi/stream for voice/bidi streaming.
        - invocation_state: object | null - Additional Strands invocation
          state passed directly to ``Agent.stream_async(..., invocation_state=...)``
          for hook and tool context.

    Returns:
        SSE stream with UIMessageStream-formatted events
    """
    body = await request.json()
    session_id, message, schema, request_state = _parse_request(body)
    requested_mode = str(
        request_state.get("interaction_mode")
        or body.get("interaction_mode")
        or body.get("mode")
        or "text"
    ).strip().lower()

    if not message.strip():
        return JSONResponse(status_code=400, content={"error": "Message is required"})

    if requested_mode == "voice":
        return JSONResponse(
            status_code=400,
            content={
                "error": "Voice mode is not supported on /agents/super/stream. Use /agents/super-bidi/stream.",
                "expected_endpoint": "/agents/super-bidi/stream",
            },
        )

    agent = await AgentFactory.get_or_create_agent(
        session_id,
        "super",
    )
    invocation_state = _build_invocation_state(request, session_id, "super", request_state)
    invocation_state.setdefault("interaction_mode", "text")

    return StreamingResponse(
        stream_agent_response(
            agent,
            message,
            structured_output_model=schema,
            invocation_state=invocation_state,
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/super-bidi/stream")
async def superagent_bidi_stream(request: Request):
    """
    Stream dedicated SuperAgent Bidi responses (voice/multimodal path).
    """
    body = await request.json()
    session_id, message, _schema, request_state = _parse_request(body)

    if not message.strip():
        return JSONResponse(status_code=400, content={"error": "Message is required"})

    agent = await AgentFactory.get_or_create_agent(session_id, "super_bidi")
    invocation_state = _build_invocation_state(request, session_id, "super_bidi", request_state)
    invocation_state.setdefault("interaction_mode", "voice")

    return StreamingResponse(
        stream_agent_response(
            agent,
            message,
            structured_output_model=None,  # Bidi does not support structured output model.
            invocation_state=invocation_state,
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/search/stream")
async def search_agent_stream(request: Request):
    """
    Stream Search Agent responses.

    Specialized for web search and research tasks.
    Supports structured_output parameter (see superagent_stream docs).
    """
    body = await request.json()
    session_id, message, schema, request_state = _parse_request(body)

    if not session_id or session_id == "default":
        session_id = "search-default"

    if not message.strip():
        return JSONResponse(status_code=400, content={"error": "Message is required"})

    agent = await AgentFactory.get_or_create_agent(session_id, "search")
    invocation_state = _build_invocation_state(request, session_id, "search", request_state)

    return StreamingResponse(
        stream_agent_response(
            agent,
            message,
            structured_output_model=schema,
            invocation_state=invocation_state,
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/task/stream")
async def task_agent_stream(request: Request):
    """
    Stream Task Agent responses.

    Project Manager agent for task execution.
    Supports structured_output parameter (see superagent_stream docs).
    """
    body = await request.json()
    session_id, message, schema, request_state = _parse_request(body)

    if not session_id or session_id == "default":
        session_id = "task-default"

    if not message.strip():
        return JSONResponse(status_code=400, content={"error": "Message is required"})

    agent = await AgentFactory.get_or_create_agent(session_id, "task")
    invocation_state = _build_invocation_state(request, session_id, "task", request_state)

    return StreamingResponse(
        stream_agent_response(
            agent,
            message,
            structured_output_model=schema,
            invocation_state=invocation_state,
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/{session_id}/clear")
async def clear_session_agent(session_id: str, agent_type: str = None):
    """Clear agent cache for a session."""
    AgentFactory.clear_agent(session_id, agent_type)
    return {"status": "cleared", "session_id": session_id, "agent_type": agent_type}


@router.get("/sessions")
async def list_agent_sessions():
    """List active agent sessions."""
    sessions = {}
    for cache_key in AgentFactory._agents.keys():
        parts = cache_key.split(":", 1)
        if len(parts) == 2:
            agent_type, session_id = parts
            if agent_type in {"super", "super_bidi"}:
                agent_type = "super"
            if session_id not in sessions:
                sessions[session_id] = []
            if agent_type not in sessions[session_id]:
                sessions[session_id].append(agent_type)

    return {
        "sessions": [
            {"session_id": sid, "agent_types": types}
            for sid, types in sessions.items()
        ]
    }


@router.get("/schemas")
async def list_schemas():
    """List registered structured output schemas."""
    return {
        "schemas": {
            name: {
                "fields": {
                    field_name: str(field_info.annotation)
                    for field_name, field_info in model.model_fields.items()
                }
            }
            for name, model in _schema_registry.items()
        }
    }
