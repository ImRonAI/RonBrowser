"""Task management tools with Supabase persistence."""

from typing import Optional, List, Dict, Any
from datetime import datetime
import os


class TaskTools:
    """Task CRUD operations with Supabase persistence.

    Provides tools for creating, reading, updating, and deleting tasks.
    Persists to Supabase when configured, falls back to in-memory storage.
    """

    def __init__(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None):
        """Initialize task tools.

        Args:
            supabase_url: Supabase project URL (or SUPABASE_URL env var)
            supabase_key: Supabase anon key (or SUPABASE_KEY env var)
        """
        self.supabase_url = supabase_url or os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        self.supabase_key = supabase_key or os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
        self._client = None
        self._in_memory_tasks: Dict[str, Dict[str, Any]] = {}

    def _get_client(self):
        """Get or create Supabase client."""
        if self._client is not None:
            return self._client

        if not self.supabase_url or not self.supabase_key:
            return None  # Use in-memory fallback

        try:
            from supabase import create_client
            self._client = create_client(self.supabase_url, self.supabase_key)
            return self._client
        except ImportError:
            return None  # Supabase not installed, use in-memory

    def create_task(
        self,
        title: str,
        description: str = "",
        priority: str = "medium",
        status: str = "backlog",
        labels: Optional[List[str]] = None,
        due_date: Optional[str] = None,
    ) -> str:
        """Create a new task.

        Args:
            title: Task title
            description: Task description
            priority: Priority level (critical, high, medium, low)
            status: Initial status (backlog, in-progress, review, blocked, testing, done)
            labels: Optional list of labels
            due_date: Optional due date (ISO format)

        Returns:
            Created task ID and confirmation
        """
        import uuid
        task_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        task_data = {
            "id": task_id,
            "title": title,
            "description": description,
            "priority": priority,
            "status": status,
            "labels": labels or [],
            "created_at": now,
            "updated_at": now,
        }

        if due_date:
            task_data["due_date"] = due_date

        client = self._get_client()
        if client:
            try:
                result = client.table("tasks").insert(task_data).execute()
                if result.data:
                    return f"Created task '{title}' with ID: {result.data[0]['id']}"
            except Exception as e:
                # Fall back to in-memory
                pass

        # In-memory fallback
        self._in_memory_tasks[task_id] = task_data
        return f"Created task '{title}' with ID: {task_id}"

    def list_tasks(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 20,
    ) -> str:
        """List tasks with optional filtering.

        Args:
            status: Filter by status
            priority: Filter by priority
            limit: Maximum number of tasks to return

        Returns:
            Formatted list of tasks
        """
        client = self._get_client()
        tasks = []

        if client:
            try:
                query = client.table("tasks").select("*").limit(limit)
                if status:
                    query = query.eq("status", status)
                if priority:
                    query = query.eq("priority", priority)
                result = query.order("updated_at", desc=True).execute()
                tasks = result.data or []
            except Exception:
                # Fall back to in-memory
                tasks = list(self._in_memory_tasks.values())
        else:
            tasks = list(self._in_memory_tasks.values())

        # Apply filters to in-memory tasks
        if status:
            tasks = [t for t in tasks if t.get("status") == status]
        if priority:
            tasks = [t for t in tasks if t.get("priority") == priority]

        tasks = tasks[:limit]

        if not tasks:
            return "No tasks found"

        # Format output
        lines = [f"Found {len(tasks)} task(s):"]
        for task in tasks:
            status_str = task.get("status", "unknown")
            priority_str = task.get("priority", "")
            lines.append(
                f"- [{status_str}] {task['title']} "
                f"(ID: {task['id'][:8]}..., priority: {priority_str})"
            )

        return "\n".join(lines)

    def update_task(
        self,
        task_id: str,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> str:
        """Update a task.

        Args:
            task_id: Task ID to update
            status: New status
            priority: New priority
            title: New title
            description: New description

        Returns:
            Update confirmation
        """
        updates = {"updated_at": datetime.utcnow().isoformat()}

        if status:
            updates["status"] = status
            if status == "done":
                updates["completed_at"] = datetime.utcnow().isoformat()
        if priority:
            updates["priority"] = priority
        if title:
            updates["title"] = title
        if description:
            updates["description"] = description

        client = self._get_client()
        if client:
            try:
                result = client.table("tasks").update(updates).eq("id", task_id).execute()
                if result.data:
                    return f"Updated task {task_id[:8]}..."
            except Exception:
                pass

        # In-memory fallback
        if task_id in self._in_memory_tasks:
            self._in_memory_tasks[task_id].update(updates)
            return f"Updated task {task_id[:8]}..."

        return f"Task {task_id[:8]}... not found"

    def delete_task(self, task_id: str) -> str:
        """Delete a task.

        Args:
            task_id: Task ID to delete

        Returns:
            Deletion confirmation
        """
        client = self._get_client()
        if client:
            try:
                result = client.table("tasks").delete().eq("id", task_id).execute()
                if result.data:
                    return f"Deleted task {task_id[:8]}..."
            except Exception:
                pass

        # In-memory fallback
        if task_id in self._in_memory_tasks:
            del self._in_memory_tasks[task_id]
            return f"Deleted task {task_id[:8]}..."

        return f"Task {task_id[:8]}... not found"

    def get_task(self, task_id: str) -> str:
        """Get a single task by ID.

        Args:
            task_id: Task ID

        Returns:
            Task details
        """
        client = self._get_client()
        task = None

        if client:
            try:
                result = client.table("tasks").select("*").eq("id", task_id).single().execute()
                task = result.data
            except Exception:
                pass

        if not task:
            task = self._in_memory_tasks.get(task_id)

        if not task:
            return f"Task {task_id[:8]}... not found"

        # Format task details
        return (
            f"Task: {task['title']}\n"
            f"ID: {task['id']}\n"
            f"Status: {task.get('status', 'unknown')}\n"
            f"Priority: {task.get('priority', 'none')}\n"
            f"Description: {task.get('description', 'None')}\n"
            f"Created: {task.get('created_at', 'unknown')}"
        )
