"""Gemini model wrapper that preserves thought signatures for tool calls."""
from __future__ import annotations

from typing import Optional

from google import genai
from strands.models.gemini import GeminiModel
from strands.types.content import Messages


class RonGeminiModel(GeminiModel):
    """Ensure function_call parts include thought_signature when available."""

    def _format_request_content(self, messages: Messages) -> list[genai.types.Content]:
        contents: list[genai.types.Content] = []

        for message in messages:
            signature: Optional[str | bytes] = None
            for content in message["content"]:
                reasoning = content.get("reasoningContent")
                if reasoning:
                    reasoning_text = reasoning.get("reasoningText", {})
                    signature = reasoning_text.get("signature") or signature

            parts: list[genai.types.Part] = []
            for content in message["content"]:
                if "toolUse" in content:
                    if not signature:
                        # Skip toolUse blocks without signatures to avoid Gemini API errors.
                        continue
                    if isinstance(signature, bytes):
                        thought_signature = signature
                    else:
                        thought_signature = signature.encode("utf-8")
                    tool_use = content["toolUse"]
                    parts.append(
                        genai.types.Part(
                            function_call=genai.types.FunctionCall(
                                args=tool_use.get("input"),
                                id=tool_use.get("toolUseId"),
                                name=tool_use.get("name"),
                            ),
                            thought_signature=thought_signature,
                        )
                    )
                else:
                    parts.append(self._format_request_content_part(content))

            contents.append(
                genai.types.Content(
                    parts=parts,
                    role="user" if message["role"] == "user" else "model",
                )
            )

        return contents
