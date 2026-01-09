"""Mem0 Memory Integration for DSPy Agent.

This module provides Mem0-based memory for RonBrowser's DSPy-powered agent.
Mem0 provides long-term memory with semantic search capabilities.

Features:
- Persistent memory across sessions
- Semantic similarity search
- Memory metadata and filtering
- Automatic categorization
- Integration with Strands mem0_memory tool
"""

import os
from typing import Optional, Dict, Any, List
from datetime import datetime

# Try to import mem0 directly
try:
    from mem0 import Memory as Mem0Client
    MEM0_DIRECT = True
except ImportError:
    MEM0_DIRECT = False
    Mem0Client = None

# Try to import Strands mem0_memory tool (if available in PYTHONPATH)
try:
    from strands_tools.mem0_memory import mem0_memory
    MEM0_STRANDS = True
except ImportError:
    # This is fine - Strands tools are optional
    MEM0_STRANDS = False
    mem0_memory = None


class MemoryConfig:
    """Configuration for Mem0 memory backend."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        user_id: str = "ron_agent",
        agent_id: str = "ron_dspy_agent",
        run_id: Optional[str] = None,
        enable_graph: bool = False,
    ):
        """Initialize Mem0 configuration.

        Args:
            api_key: Mem0 API key (or MEM0_API_KEY env var)
            org_id: Mem0 organization ID
            project_id: Mem0 project ID
            user_id: User identifier for memory scoping
            agent_id: Agent identifier for memory scoping
            run_id: Run/session identifier
            enable_graph: Enable graph memory for relationships
        """
        self.api_key = api_key or os.getenv("MEM0_API_KEY")
        self.org_id = org_id or os.getenv("MEM0_ORG_ID")
        self.project_id = project_id or os.getenv("MEM0_PROJECT_ID")
        self.user_id = user_id
        self.agent_id = agent_id
        self.run_id = run_id or datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        self.enable_graph = enable_graph


class Mem0Memory:
    """Mem0-based memory for DSPy agents.

    Implements the DSPy MemoryTools pattern with:
    - store_memory: Add new memories
    - search_memories: Semantic similarity search
    - get_all_memories: List all memories
    - update_memory: Modify existing memories
    - delete_memory: Remove memories

    Supports both direct Mem0 client and Strands mem0_memory tool.
    """

    def __init__(self, config: Optional[MemoryConfig] = None):
        """Initialize Mem0 memory.

        Args:
            config: Memory configuration (uses defaults if not provided)
        """
        self.config = config or MemoryConfig()
        self._client = None
        self._use_strands = False

        # Initialize appropriate backend
        if MEM0_DIRECT and self.config.api_key:
            self._init_direct_client()
        elif MEM0_STRANDS:
            self._use_strands = True
        else:
            raise ImportError(
                "Neither mem0 nor strands_tools.mem0_memory available. "
                "Install mem0: pip install mem0ai"
            )

    def _init_direct_client(self):
        """Initialize direct Mem0 client."""
        config = {
            "version": "v1.1",
        }

        if self.config.enable_graph:
            config["graph_store"] = {
                "provider": "neo4j",
                "config": {
                    "url": os.getenv("NEO4J_URL", "bolt://localhost:7687"),
                    "username": os.getenv("NEO4J_USER", "neo4j"),
                    "password": os.getenv("NEO4J_PASSWORD", ""),
                },
            }

        self._client = Mem0Client.from_config(config)

    def _get_metadata(self) -> Dict[str, str]:
        """Get default metadata for memory operations."""
        return {
            "user_id": self.config.user_id,
            "agent_id": self.config.agent_id,
            "run_id": self.config.run_id,
        }

    def store_memory(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        categories: Optional[List[str]] = None,
    ) -> str:
        """Store a new memory.

        Args:
            content: Memory content to store
            metadata: Optional metadata dict
            categories: Optional category tags

        Returns:
            Memory ID or confirmation message
        """
        full_metadata = self._get_metadata()
        if metadata:
            full_metadata.update(metadata)
        if categories:
            full_metadata["categories"] = categories

        if self._use_strands:
            result = mem0_memory(
                action="add",
                content=content,
                metadata=full_metadata,
            )
            return str(result)
        else:
            result = self._client.add(
                content,
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
                run_id=self.config.run_id,
                metadata=full_metadata,
            )
            return result.get("id", str(result))

    def search_memories(
        self,
        query: str,
        limit: int = 10,
        threshold: float = 0.0,
        categories: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Search memories using semantic similarity.

        Args:
            query: Search query
            limit: Maximum results to return
            threshold: Minimum similarity threshold (0-1)
            categories: Filter by categories

        Returns:
            List of matching memories with scores
        """
        filters = {}
        if categories:
            filters["categories"] = {"$in": categories}

        if self._use_strands:
            result = mem0_memory(
                action="search",
                query=query,
                limit=limit,
                filters=filters if filters else None,
            )
            if isinstance(result, list):
                return result
            return [{"content": str(result)}]
        else:
            results = self._client.search(
                query,
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
                limit=limit,
                filters=filters if filters else None,
            )

            # Filter by threshold
            if threshold > 0:
                results = [r for r in results if r.get("score", 0) >= threshold]

            return results

    def get_all_memories(
        self,
        limit: int = 100,
        categories: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Get all memories for this agent/user.

        Args:
            limit: Maximum memories to return
            categories: Filter by categories

        Returns:
            List of all memories
        """
        if self._use_strands:
            result = mem0_memory(
                action="get_all",
                limit=limit,
            )
            if isinstance(result, list):
                return result
            return []
        else:
            return self._client.get_all(
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
                limit=limit,
            )

    def update_memory(
        self,
        memory_id: str,
        content: str,
    ) -> str:
        """Update an existing memory.

        Args:
            memory_id: ID of memory to update
            content: New content

        Returns:
            Update confirmation
        """
        if self._use_strands:
            result = mem0_memory(
                action="update",
                memory_id=memory_id,
                content=content,
            )
            return str(result)
        else:
            result = self._client.update(memory_id, content)
            return str(result)

    def delete_memory(self, memory_id: str) -> str:
        """Delete a memory.

        Args:
            memory_id: ID of memory to delete

        Returns:
            Deletion confirmation
        """
        if self._use_strands:
            result = mem0_memory(
                action="delete",
                memory_id=memory_id,
            )
            return str(result)
        else:
            self._client.delete(memory_id)
            return f"Deleted memory {memory_id}"

    def delete_all_memories(self) -> str:
        """Delete all memories for this agent/user.

        Returns:
            Deletion confirmation
        """
        if self._use_strands:
            result = mem0_memory(
                action="delete_all",
            )
            return str(result)
        else:
            self._client.delete_all(
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
            )
            return "Deleted all memories"

    def get_context(self, query: Optional[str] = None, limit: int = 5) -> str:
        """Get relevant context for agent reasoning.

        If query provided, searches for relevant memories.
        Otherwise returns recent memories.

        Args:
            query: Optional search query for relevance
            limit: Maximum memories to include

        Returns:
            Formatted context string
        """
        if query:
            memories = self.search_memories(query, limit=limit)
        else:
            memories = self.get_all_memories(limit=limit)

        if not memories:
            return "No relevant memories found."

        lines = ["## Relevant Memories:"]
        for i, mem in enumerate(memories, 1):
            content = mem.get("memory") or mem.get("content", str(mem))
            score = mem.get("score", "")
            score_str = f" (relevance: {score:.2f})" if score else ""
            lines.append(f"{i}. {content}{score_str}")

        return "\n".join(lines)


class ConversationMemory:
    """Conversation memory using Mem0 for persistence.

    Combines short-term sliding window with long-term Mem0 storage.
    Messages are stored in Mem0 for cross-session retrieval.
    """

    def __init__(
        self,
        window_size: int = 20,
        mem0_config: Optional[MemoryConfig] = None,
        persist_all: bool = True,
    ):
        """Initialize conversation memory.

        Args:
            window_size: Number of recent messages to keep in context
            mem0_config: Mem0 configuration
            persist_all: Whether to persist all messages to Mem0
        """
        self.window_size = window_size
        self.persist_all = persist_all
        self.messages: List[Dict[str, Any]] = []

        # Initialize Mem0 for long-term storage
        try:
            self.mem0 = Mem0Memory(mem0_config)
            self._has_mem0 = True
        except ImportError:
            self._has_mem0 = False
            print("Warning: Mem0 not available, using in-memory only")

    def add_user(self, content: str) -> None:
        """Add user message."""
        msg = {
            "role": "user",
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.messages.append(msg)

        if self._has_mem0 and self.persist_all:
            self.mem0.store_memory(
                f"[USER] {content}",
                categories=["conversation", "user_message"],
            )

    def add_assistant(
        self,
        content: str,
        tool_calls: Optional[List[Dict]] = None,
    ) -> None:
        """Add assistant message."""
        msg = {
            "role": "assistant",
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "tool_calls": tool_calls,
        }
        self.messages.append(msg)

        if self._has_mem0 and self.persist_all:
            # Store response
            self.mem0.store_memory(
                f"[ASSISTANT] {content}",
                categories=["conversation", "assistant_response"],
            )

            # Store tool usage patterns if any
            if tool_calls:
                tools_used = ", ".join(tc.get("tool", "") for tc in tool_calls)
                self.mem0.store_memory(
                    f"Used tools: {tools_used}",
                    categories=["tool_usage"],
                )

    def add_tool(self, tool_name: str, result: str) -> None:
        """Add tool result."""
        msg = {
            "role": "tool",
            "tool_name": tool_name,
            "content": result,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.messages.append(msg)

    def get_context(self, query: Optional[str] = None) -> str:
        """Get context for agent reasoning.

        Combines recent messages with relevant Mem0 memories.

        Args:
            query: Optional query to find relevant memories

        Returns:
            Formatted context string
        """
        lines = []

        # Add relevant long-term memories if available
        if self._has_mem0 and query:
            mem_context = self.mem0.get_context(query, limit=3)
            if "No relevant memories" not in mem_context:
                lines.append(mem_context)
                lines.append("")

        # Add recent conversation (sliding window)
        recent = self.messages[-self.window_size:]
        lines.append("## Recent Conversation:")

        for msg in recent:
            role = msg["role"]
            content = msg["content"]

            if role == "user":
                lines.append(f"User: {content}")
            elif role == "assistant":
                lines.append(f"Assistant: {content}")
            elif role == "tool":
                tool_name = msg.get("tool_name", "tool")
                lines.append(f"Tool[{tool_name}]: {content[:200]}...")

        return "\n".join(lines)

    def clear(self) -> None:
        """Clear short-term memory (keeps Mem0 long-term)."""
        self.messages = []

    def clear_all(self) -> None:
        """Clear both short-term and long-term memory."""
        self.messages = []
        if self._has_mem0:
            self.mem0.delete_all_memories()

    def store_insight(self, insight: str, categories: Optional[List[str]] = None) -> str:
        """Store a learned insight to long-term memory.

        Use this for storing important patterns, preferences, or facts
        that should be remembered across sessions.

        Args:
            insight: The insight to store
            categories: Optional categories for filtering

        Returns:
            Storage confirmation
        """
        if self._has_mem0:
            return self.mem0.store_memory(
                insight,
                categories=categories or ["insight"],
            )
        return "Mem0 not available"

    def recall(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Recall relevant memories for a query.

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of relevant memories
        """
        if self._has_mem0:
            return self.mem0.search_memories(query, limit=limit)
        return []


# DSPy-style MemoryTools for tool-based access
class MemoryTools:
    """Memory tools for DSPy agent.

    Provides tool functions that can be registered with the agent
    for explicit memory operations.
    """

    def __init__(self, config: Optional[MemoryConfig] = None):
        """Initialize memory tools.

        Args:
            config: Mem0 configuration
        """
        self.mem0 = Mem0Memory(config)

    def store_memory(
        self,
        content: str,
        categories: Optional[str] = None,
    ) -> str:
        """Store information to long-term memory.

        Use this to remember important facts, user preferences,
        or learned patterns that should persist across sessions.

        Args:
            content: Information to store
            categories: Comma-separated category tags

        Returns:
            Storage confirmation with memory ID
        """
        cat_list = categories.split(",") if categories else None
        return self.mem0.store_memory(content, categories=cat_list)

    def search_memories(
        self,
        query: str,
        limit: int = 10,
    ) -> str:
        """Search long-term memory for relevant information.

        Args:
            query: What to search for
            limit: Maximum results

        Returns:
            Formatted search results
        """
        results = self.mem0.search_memories(query, limit=limit)

        if not results:
            return "No relevant memories found."

        lines = []
        for i, mem in enumerate(results, 1):
            content = mem.get("memory") or mem.get("content", str(mem))
            score = mem.get("score", "")
            score_str = f" (score: {score:.2f})" if score else ""
            lines.append(f"{i}. {content}{score_str}")

        return "\n".join(lines)

    def get_all_memories(self, limit: int = 50) -> str:
        """Get all stored memories.

        Args:
            limit: Maximum memories to return

        Returns:
            Formatted list of all memories
        """
        memories = self.mem0.get_all_memories(limit=limit)

        if not memories:
            return "No memories stored yet."

        lines = []
        for i, mem in enumerate(memories, 1):
            content = mem.get("memory") or mem.get("content", str(mem))
            mem_id = mem.get("id", "unknown")
            lines.append(f"{i}. [{mem_id}] {content[:100]}...")

        return "\n".join(lines)

    def update_memory(self, memory_id: str, content: str) -> str:
        """Update an existing memory.

        Args:
            memory_id: ID of memory to update
            content: New content

        Returns:
            Update confirmation
        """
        return self.mem0.update_memory(memory_id, content)

    def delete_memory(self, memory_id: str) -> str:
        """Delete a memory.

        Args:
            memory_id: ID of memory to delete

        Returns:
            Deletion confirmation
        """
        return self.mem0.delete_memory(memory_id)
