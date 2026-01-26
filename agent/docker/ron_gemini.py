"""Gemini model wrapper that preserves thought signatures for tool calls.

Gemini 3 models require thought_signature on function_call parts to maintain
reasoning context across multi-turn tool use. This wrapper ensures signatures
are properly preserved and passed back to the API.

Reference: https://ai.google.dev/gemini-api/docs/thought-signatures
"""
from __future__ import annotations

import logging
import secrets
from collections.abc import AsyncGenerator
from typing import Any, Optional

from google import genai
from strands.models.gemini import GeminiModel
from strands.types.content import ContentBlock, Messages
from strands.types.streaming import StreamEvent
from strands.types.tools import ToolSpec, ToolChoice

logger = logging.getLogger(__name__)

# Fallback signature for tool calls without signatures (Google-approved workaround)
# See: https://ai.google.dev/gemini-api/docs/thought-signatures
FALLBACK_THOUGHT_SIGNATURE = b"context_engineering_is_the_way_to_go"


class RonGeminiModel(GeminiModel):
    """Gemini model with proper thought signature handling for Gemini 3.
    
    Key features:
    1. Captures thought_signature from function_call responses (stream override)
    2. Stores signatures in toolUse content blocks for persistence
    3. Passes signatures back on function_call Parts (format override)
    4. Uses fallback signature when none available (NEVER skips tool calls)
    
    This ensures the agent loop continues even when signatures are missing,
    while properly preserving them when available for optimal reasoning quality.
    """

    def _format_request_content_part(
        self, content: ContentBlock, tool_use_id_to_name: dict[str, str]
    ) -> genai.types.Part:
        """Format content block, handling toolUse with thought signatures.
        
        For toolUse blocks:
        - Check for stored thoughtSignature in the content block
        - Use fallback signature if none found (NEVER skip tool calls)
        - This ensures agent loop continuity while preserving reasoning context
        """
        if "toolUse" in content:
            tool_use = content["toolUse"]
            tool_use_id = tool_use.get("toolUseId")
            tool_name = tool_use.get("name")
            
            # Track mapping for tool results
            if tool_use_id and tool_name:
                tool_use_id_to_name[tool_use_id] = tool_name
            
            # Get signature from toolUse block (captured during stream) or use fallback
            # CRITICAL: Never skip tool calls - use fallback if no signature
            raw_signature = tool_use.get("thoughtSignature")
            if raw_signature:
                if isinstance(raw_signature, bytes):
                    thought_signature = raw_signature
                else:
                    thought_signature = raw_signature.encode("utf-8")
            else:
                # Use fallback - this allows agent to continue while maintaining
                # compatibility with Gemini 3's strict validation
                thought_signature = FALLBACK_THOUGHT_SIGNATURE
                logger.debug(
                    "tool_use_id=%s tool_name=%s | using fallback thought signature",
                    tool_use_id, tool_name
                )
            
            return genai.types.Part(
                function_call=genai.types.FunctionCall(
                    args=tool_use.get("input"),
                    id=tool_use_id,
                    name=tool_name,
                ),
                thought_signature=thought_signature,
            )
        
        # For all other content types, use base implementation
        return super()._format_request_content_part(content, tool_use_id_to_name)

    def _format_chunk(self, event: dict[str, Any]) -> StreamEvent:
        """Format response events, capturing thought_signature from function_calls.
        
        Gemini 3 returns thought_signature on function_call Parts. We capture
        this and include it in the toolUse content block so it persists in
        message history and can be passed back on subsequent requests.
        """
        match event["chunk_type"]:
            case "content_start":
                match event["data_type"]:
                    case "tool":
                        part = event["data"]
                        function_call = part.function_call
                        # Use Gemini's provided ID or generate one if missing
                        tool_use_id = function_call.id or f"tooluse_{secrets.token_urlsafe(16)}"
                        
                        # Capture thought_signature from the Part if present
                        thought_signature = None
                        if hasattr(part, "thought_signature") and part.thought_signature:
                            # Decode to string for JSON serialization in message history
                            if isinstance(part.thought_signature, bytes):
                                thought_signature = part.thought_signature.decode("utf-8")
                            else:
                                thought_signature = part.thought_signature
                        
                        tool_use_start: dict[str, Any] = {
                            "name": function_call.name,
                            "toolUseId": tool_use_id,
                        }
                        # Store signature in toolUse block for persistence
                        if thought_signature:
                            tool_use_start["thoughtSignature"] = thought_signature
                        
                        return {
                            "contentBlockStart": {
                                "start": {
                                    "toolUse": tool_use_start,
                                },
                            },
                        }
                    case _:
                        return {"contentBlockStart": {"start": {}}}
            case _:
                # All other chunk types handled by base implementation
                return super()._format_chunk(event)

    async def stream(
        self,
        messages: Messages,
        tool_specs: list[ToolSpec] | None = None,
        system_prompt: str | None = None,
        tool_choice: ToolChoice | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream conversation, capturing thought signatures from tool calls.
        
        This override ensures thought_signature is captured from Gemini's
        function_call responses and included in the toolUse content blocks,
        enabling proper signature passback on subsequent requests.
        """
        request = self._format_request(messages, tool_specs, system_prompt, self.config.get("params"))
        
        client = self._get_client().aio
        
        try:
            from strands.types.exceptions import ContextWindowOverflowException, ModelThrottledException
            import json
            
            response = await client.models.generate_content_stream(**request)
            
            yield self._format_chunk({"chunk_type": "message_start"})
            yield self._format_chunk({"chunk_type": "content_start", "data_type": "text"})
            
            tool_used = False
            candidate = None
            event = None
            async for event in response:
                candidates = event.candidates
                candidate = candidates[0] if candidates else None
                content = candidate.content if candidate else None
                parts = content.parts if content and content.parts else []
                
                for part in parts:
                    if part.function_call:
                        # Use our overridden _format_chunk to capture thought_signature
                        yield self._format_chunk({"chunk_type": "content_start", "data_type": "tool", "data": part})
                        yield self._format_chunk({"chunk_type": "content_delta", "data_type": "tool", "data": part})
                        yield self._format_chunk({"chunk_type": "content_stop", "data_type": "tool", "data": part})
                        tool_used = True
                    
                    if part.text:
                        yield self._format_chunk(
                            {
                                "chunk_type": "content_delta",
                                "data_type": "reasoning_content" if part.thought else "text",
                                "data": part,
                            },
                        )
            
            yield self._format_chunk({"chunk_type": "content_stop", "data_type": "text"})
            yield self._format_chunk(
                {
                    "chunk_type": "message_stop",
                    "data": "TOOL_USE" if tool_used else (candidate.finish_reason if candidate else "STOP"),
                }
            )
            if event:
                yield self._format_chunk({"chunk_type": "metadata", "data": event.usage_metadata})
        
        except genai.errors.ClientError as error:
            if not error.message:
                raise
            
            try:
                message = json.loads(error.message) if error.message else {}
            except json.JSONDecodeError as e:
                logger.warning("error_message=<%s> | Gemini API returned non-JSON error", error.message)
                raise error from e
            
            match message["error"]["status"]:
                case "RESOURCE_EXHAUSTED" | "UNAVAILABLE":
                    raise ModelThrottledException(error.message) from error
                case "INVALID_ARGUMENT":
                    if "exceeds the maximum number of tokens" in message["error"]["message"]:
                        raise ContextWindowOverflowException(error.message) from error
                    # Log the full error for debugging thought signature issues
                    logger.error(
                        "Gemini INVALID_ARGUMENT error - may be thought signature related: %s",
                        message["error"]["message"]
                    )
                    raise error
                case _:
                    raise error
