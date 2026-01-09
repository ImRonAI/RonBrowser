"""Supabase persistence layer for tasks and agent sessions."""

from typing import Optional, Dict, Any, List
import os


class SupabaseClient:
    """Supabase client wrapper for agent persistence.

    Handles:
    - Task storage and retrieval
    - Agent session persistence
    - Memory/context storage
    """

    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
    ):
        """Initialize Supabase client.

        Args:
            url: Supabase project URL (or from env SUPABASE_URL)
            key: Supabase anon key (or from env SUPABASE_KEY)
        """
        self.url = url or os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        self.key = key or os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
        self._client = None

    @property
    def client(self):
        """Get or create Supabase client."""
        if self._client is None:
            if not self.url or not self.key:
                raise ValueError(
                    "Supabase credentials not found. Set SUPABASE_URL and SUPABASE_KEY."
                )
            try:
                from supabase import create_client
                self._client = create_client(self.url, self.key)
            except ImportError:
                raise ImportError("supabase-py not installed. Run: pip install supabase")
        return self._client

    def is_available(self) -> bool:
        """Check if Supabase is configured and available."""
        try:
            _ = self.client
            return True
        except (ValueError, ImportError):
            return False

    # Task operations
    def create_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new task."""
        result = self.client.table("tasks").insert(task_data).execute()
        return result.data[0] if result.data else {}

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get a task by ID."""
        result = self.client.table("tasks").select("*").eq("id", task_id).single().execute()
        return result.data

    def update_task(self, task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update a task."""
        result = self.client.table("tasks").update(updates).eq("id", task_id).execute()
        return result.data[0] if result.data else {}

    def delete_task(self, task_id: str) -> bool:
        """Delete a task."""
        result = self.client.table("tasks").delete().eq("id", task_id).execute()
        return len(result.data) > 0

    def list_tasks(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """List tasks with optional filtering."""
        query = self.client.table("tasks").select("*")
        if status:
            query = query.eq("status", status)
        if priority:
            query = query.eq("priority", priority)
        result = query.order("updated_at", desc=True).limit(limit).execute()
        return result.data or []

    # Session operations
    def save_session(self, session_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save or update agent session."""
        session_data["id"] = session_id
        result = self.client.table("agent_sessions").upsert(session_data).execute()
        return result.data[0] if result.data else {}

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get agent session by ID."""
        result = (
            self.client.table("agent_sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
        return result.data

    def delete_session(self, session_id: str) -> bool:
        """Delete agent session."""
        result = self.client.table("agent_sessions").delete().eq("id", session_id).execute()
        return len(result.data) > 0

    # Memory operations
    def save_memory(self, session_id: str, messages: List[Dict[str, Any]]) -> None:
        """Save conversation memory for a session."""
        self.save_session(
            session_id,
            {"messages": messages, "last_active_at": "now()"},
        )

    def load_memory(self, session_id: str) -> List[Dict[str, Any]]:
        """Load conversation memory for a session."""
        session = self.get_session(session_id)
        return session.get("messages", []) if session else []
