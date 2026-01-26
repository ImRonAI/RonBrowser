"""LanceDB-based session manager for Strands Agent SDK."""

import logging
from typing import Any, Optional
from datetime import datetime

from strands.session import SessionRepository, RepositorySessionManager
from strands.types.session import Session, SessionAgent, SessionMessage

logger = logging.getLogger(__name__)


class LanceDBSessionManager(RepositorySessionManager, SessionRepository):
    """LanceDB-backed SessionRepository for Strands Agent SDK.

    Implements the SessionRepository interface to integrate LanceDB storage
    with Strands SDK's session management system.
    """

    def __init__(self, session_id: str, memory, **kwargs: Any):
        """Initialize LanceDBSessionManager.

        Args:
            session_id: ID for the session
            memory: ConversationMemory instance from main.py
            **kwargs: Additional keyword arguments for future extensibility
        """
        self.memory = memory
        super().__init__(session_id=session_id, session_repository=self, **kwargs)

    def create_session(self, session: Session, **kwargs: Any) -> Session:
        """Create a new session in LanceDB."""
        # LanceDB doesn't have explicit session objects currently
        # Sessions are implicitly created when messages are added
        logger.info(f"Session {session.session_id} created (implicit in LanceDB)")
        return session

    def read_session(self, session_id: str, **kwargs: Any) -> Optional[Session]:
        """Read session metadata from LanceDB."""
        from strands.types.session import SessionType
        # Check if session exists by querying for messages
        messages = self.memory.get_messages(session_id, limit=1)
        if messages:
            # Session exists - return minimal Session object
            return Session(
                session_id=session_id,
                session_type=SessionType.AGENT,
                created_at=datetime.now().isoformat()
            )
        return None

    def create_agent(self, session_id: str, session_agent: SessionAgent, **kwargs: Any) -> None:
        """Create agent metadata in session."""
        # LanceDB doesn't store agent metadata separately
        # Agent context is tracked through messages
        logger.debug(f"Agent {session_agent.agent_id} created in session {session_id}")

    def read_agent(self, session_id: str, agent_id: str, **kwargs: Any) -> Optional[SessionAgent]:
        """Read agent metadata from session."""
        # Return a default agent if session exists
        session = self.read_session(session_id)
        if session:
            return SessionAgent(
                agent_id=agent_id,
                created_at=datetime.now().isoformat()
            )
        return None

    def update_agent(self, session_id: str, session_agent: SessionAgent, **kwargs: Any) -> None:
        """Update agent metadata."""
        # No-op for LanceDB (no agent metadata stored separately)
        logger.debug(f"Agent {session_agent.agent_id} updated in session {session_id}")

    def create_message(self, session_id: str, agent_id: str, session_message: SessionMessage, **kwargs: Any) -> None:
        """Create a new message in LanceDB."""
        # Convert SessionMessage to LanceDB format
        # SessionMessage.message is a Message TypedDict with 'role' and 'content'
        message = session_message.message
        role = message["role"]
        content_blocks = message.get("content", [])

        # Extract text content from message content blocks
        content_text = ""
        if isinstance(content_blocks, list):
            for block in content_blocks:
                if isinstance(block, dict) and "text" in block:
                    content_text += block["text"]
        elif isinstance(content_blocks, str):
            content_text = content_blocks

        # Add message to LanceDB
        self.memory.add_message(session_id, role, content_text)
        logger.debug(f"Message {session_message.message_id} created in session {session_id}")

    def read_message(self, session_id: str, agent_id: str, message_id: int, **kwargs: Any) -> Optional[SessionMessage]:
        """Read a specific message from LanceDB."""
        # Get all messages and find the one at this index
        messages = self.memory.get_messages(session_id, limit=message_id + 1)
        if message_id < len(messages):
            msg = messages[message_id]
            return SessionMessage(
                message_id=message_id,
                role=msg["role"],
                content=msg["content"],
                created_at=msg.get("timestamp", datetime.now().isoformat())
            )
        return None

    def update_message(self, session_id: str, agent_id: str, session_message: SessionMessage, **kwargs: Any) -> None:
        """Update a message (used for redaction by guardrails)."""
        # LanceDB doesn't support in-place updates easily
        # For now, this is a no-op (messages are immutable)
        logger.warning(f"Message update requested but not supported in LanceDB (session={session_id}, message_id={session_message.message_id})")

    def list_messages(
        self, session_id: str, agent_id: str, limit: Optional[int] = None, offset: int = 0, **kwargs: Any
    ) -> list[SessionMessage]:
        """List messages from LanceDB with pagination."""
        # Get messages from LanceDB
        db_messages = self.memory.get_messages(session_id, limit=limit or 1000)

        # Apply offset
        if offset > 0:
            db_messages = db_messages[offset:]

        # Convert to SessionMessage objects
        session_messages = []
        for idx, msg in enumerate(db_messages, start=offset):
            content = msg["content"]
            # Convert to content blocks format if needed
            if isinstance(content, str):
                content = [{"text": content}]

            session_messages.append(SessionMessage(
                message_id=idx,
                role=msg["role"],
                content=content,
                created_at=msg.get("timestamp", datetime.now().isoformat())
            ))

        return session_messages
