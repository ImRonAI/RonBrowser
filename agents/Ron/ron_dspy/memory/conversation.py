"""Conversation memory with sliding window and semantic retrieval."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class Message(BaseModel):
    """Single conversation message."""

    role: str = Field(description="Message role: user, assistant, tool, or system")
    content: str = Field(description="Message content")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    tool_calls: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Tool calls made in this message (for assistant messages)"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata"
    )


class ConversationMemory:
    """Conversation memory with sliding window.

    Maintains recent conversation history for context injection into prompts.
    Supports:
    - Sliding window of recent messages
    - Role-based formatting
    - Tool call tracking
    - Memory persistence (optional)
    """

    def __init__(
        self,
        window_size: int = 20,
        max_tokens_estimate: int = 8000,
    ):
        """Initialize conversation memory.

        Args:
            window_size: Maximum number of messages to retain
            max_tokens_estimate: Rough token limit for context (for truncation)
        """
        self.window_size = window_size
        self.max_tokens_estimate = max_tokens_estimate
        self.messages: List[Message] = []
        self._session_id: Optional[str] = None

    def add(
        self,
        role: str,
        content: str,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Message:
        """Add a message to memory.

        Args:
            role: Message role (user, assistant, tool, system)
            content: Message content
            tool_calls: Tool calls made (for assistant messages)
            metadata: Additional metadata

        Returns:
            The created Message object
        """
        message = Message(
            role=role,
            content=content,
            tool_calls=tool_calls,
            metadata=metadata,
        )
        self.messages.append(message)

        # Trim to window size
        if len(self.messages) > self.window_size:
            self.messages = self.messages[-self.window_size:]

        return message

    def add_user(self, content: str) -> Message:
        """Convenience method to add user message."""
        return self.add("user", content)

    def add_assistant(
        self,
        content: str,
        tool_calls: Optional[List[Dict[str, Any]]] = None
    ) -> Message:
        """Convenience method to add assistant message."""
        return self.add("assistant", content, tool_calls=tool_calls)

    def add_tool(self, tool_name: str, result: str) -> Message:
        """Convenience method to add tool result."""
        return self.add("tool", f"[{tool_name}]: {result}")

    def get_context(
        self,
        max_messages: Optional[int] = None,
        include_system: bool = False,
    ) -> str:
        """Get formatted context string for prompt injection.

        Args:
            max_messages: Override window size for this call
            include_system: Include system messages in context

        Returns:
            Formatted conversation history string
        """
        n = max_messages or self.window_size
        recent = self.messages[-n:]

        lines = []
        for msg in recent:
            if msg.role == "system" and not include_system:
                continue

            prefix = {
                "user": "User",
                "assistant": "Assistant",
                "tool": "Tool",
                "system": "System",
            }.get(msg.role, msg.role.capitalize())

            lines.append(f"{prefix}: {msg.content}")

            # Include tool calls if present
            if msg.tool_calls:
                for tc in msg.tool_calls:
                    lines.append(f"  → Called {tc.get('tool', 'unknown')}")

        return "\n".join(lines)

    def get_messages(
        self,
        n: Optional[int] = None,
        role_filter: Optional[str] = None,
    ) -> List[Message]:
        """Get recent messages, optionally filtered.

        Args:
            n: Number of messages to return (default: all in window)
            role_filter: Only return messages with this role

        Returns:
            List of Message objects
        """
        messages = self.messages[-n:] if n else self.messages

        if role_filter:
            messages = [m for m in messages if m.role == role_filter]

        return messages

    def get_tool_calls(self) -> List[Dict[str, Any]]:
        """Get all tool calls from conversation."""
        calls = []
        for msg in self.messages:
            if msg.tool_calls:
                calls.extend(msg.tool_calls)
        return calls

    def get_last_user_message(self) -> Optional[Message]:
        """Get the most recent user message."""
        for msg in reversed(self.messages):
            if msg.role == "user":
                return msg
        return None

    def clear(self) -> None:
        """Clear all messages."""
        self.messages = []

    def to_dict(self) -> Dict[str, Any]:
        """Serialize memory to dict for persistence."""
        return {
            "session_id": self._session_id,
            "window_size": self.window_size,
            "messages": [m.model_dump() for m in self.messages],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationMemory":
        """Deserialize memory from dict."""
        memory = cls(window_size=data.get("window_size", 20))
        memory._session_id = data.get("session_id")
        memory.messages = [Message(**m) for m in data.get("messages", [])]
        return memory

    def __len__(self) -> int:
        """Return number of messages in memory."""
        return len(self.messages)

    def __repr__(self) -> str:
        return f"ConversationMemory(messages={len(self.messages)}, window={self.window_size})"
