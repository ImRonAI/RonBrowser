"""Mem0 Memory Integration for DSPy Agent - FIXED VERSION.

This module provides Mem0-based memory for RonBrowser's DSPy-powered agent.
Mem0 provides long-term memory with semantic search capabilities.

FIXED ISSUES:
1. Removed sys.path manipulation (anti-pattern)
2. Fixed import error handling (proper fallback)
3. Fixed Mem0Client initialization (API key passing)
4. Added proper type hints for DSPy compatibility
5. Fixed metadata handling in store_memory
6. Improved error messages and validation
"""

import os
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Try to import mem0 directly
try:
    from mem0 import Memory as Mem0Client
    MEM0_DIRECT = True
except ImportError:
    MEM0_DIRECT = False
    Mem0Client = None
    logger.warning("mem0 package not found. Install with: pip install mem0ai")


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
        use_cloud: bool = True,  # FIXED: Added cloud vs local option
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
            use_cloud: Use Mem0 cloud (True) or local (False)
        """
        self.api_key = api_key or os.getenv("MEM0_API_KEY")
        self.org_id = org_id or os.getenv("MEM0_ORG_ID")
        self.project_id = project_id or os.getenv("MEM0_PROJECT_ID")
        self.user_id = user_id
        self.agent_id = agent_id
        self.run_id = run_id or datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        self.enable_graph = enable_graph
        self.use_cloud = use_cloud


class Mem0Memory:
    """Mem0-based memory for DSPy agents.

    Implements the DSPy MemoryTools pattern with:
    - store_memory: Add new memories
    - search_memories: Semantic similarity search
    - get_all_memories: List all memories
    - update_memory: Modify existing memories
    - delete_memory: Remove memories

    FIXED: Proper initialization and error handling
    """

    def __init__(self, config: Optional[MemoryConfig] = None):
        """Initialize Mem0 memory.

        Args:
            config: Memory configuration (uses defaults if not provided)
        """
        self.config = config or MemoryConfig()
        self._client = None

        # Initialize appropriate backend
        if not MEM0_DIRECT:
            raise ImportError(
                "mem0 package not installed. Install with: pip install mem0ai"
            )

        self._init_client()

    def _init_client(self):
        """Initialize Mem0 client with proper configuration."""
        if self.config.use_cloud:
            # Cloud mode - requires API key
            if not self.config.api_key:
                raise ValueError(
                    "Mem0 API key required for cloud mode. "
                    "Set MEM0_API_KEY environment variable or pass api_key parameter."
                )

            # FIXED: Proper cloud initialization
            self._client = Mem0Client(
                api_key=self.config.api_key,
                org_id=self.config.org_id,
                project_id=self.config.project_id,
            )
        else:
            # Local mode configuration
            config = {
                "version": "v1.1",
                "llm": {
                    "provider": "openai",
                    "config": {
                        "model": "gpt-4",
                        "temperature": 0.2,
                        "max_tokens": 1500,
                    }
                },
                "embedder": {
                    "provider": "openai",
                    "config": {
                        "model": "text-embedding-3-small"
                    }
                },
                "vector_store": {
                    "provider": "qdrant",
                    "config": {
                        "collection_name": "ron_memories",
                        "path": "./qdrant_db",  # Local storage
                    }
                }
            }

            # Add graph store if enabled
            if self.config.enable_graph:
                config["graph_store"] = {
                    "provider": "neo4j",
                    "config": {
                        "url": os.getenv("NEO4J_URL", "bolt://localhost:7687"),
                        "username": os.getenv("NEO4J_USER", "neo4j"),
                        "password": os.getenv("NEO4J_PASSWORD", ""),
                    },
                }

            # FIXED: Use from_config for local mode
            self._client = Mem0Client.from_config(config)

    def _get_metadata(self) -> Dict[str, str]:
        """Get default metadata for memory operations."""
        return {
            "user_id": self.config.user_id,
            "agent_id": self.config.agent_id,
            "run_id": self.config.run_id,
            "timestamp": datetime.utcnow().isoformat(),  # FIXED: Added timestamp
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
        if not content or not content.strip():
            raise ValueError("Cannot store empty memory content")

        full_metadata = self._get_metadata()
        if metadata:
            full_metadata.update(metadata)
        if categories:
            full_metadata["categories"] = categories

        try:
            result = self._client.add(
                content,
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
                run_id=self.config.run_id,
                metadata=full_metadata,
            )

            # FIXED: Handle different response formats
            if isinstance(result, dict):
                return result.get("id", str(result))
            elif isinstance(result, list) and result:
                return result[0].get("id", str(result[0]))
            else:
                return str(result)

        except Exception as e:
            logger.error(f"Failed to store memory: {e}")
            raise

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
        if not query or not query.strip():
            return []

        filters = {}
        if categories:
            filters["categories"] = {"$in": categories}

        try:
            results = self._client.search(
                query,
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
                limit=limit,
                filters=filters if filters else None,
            )

            # Filter by threshold
            if threshold > 0 and isinstance(results, list):
                results = [r for r in results if r.get("score", 0) >= threshold]

            return results if isinstance(results, list) else []

        except Exception as e:
            logger.error(f"Failed to search memories: {e}")
            return []

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
        try:
            memories = self._client.get_all(
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
                limit=limit,
            )

            # FIXED: Filter by categories if provided
            if categories and isinstance(memories, list):
                memories = [
                    m for m in memories
                    if any(cat in m.get("metadata", {}).get("categories", [])
                           for cat in categories)
                ]

            return memories if isinstance(memories, list) else []

        except Exception as e:
            logger.error(f"Failed to get all memories: {e}")
            return []

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
        if not memory_id:
            raise ValueError("Memory ID is required for update")
        if not content or not content.strip():
            raise ValueError("Cannot update memory with empty content")

        try:
            result = self._client.update(memory_id, content)
            return f"Updated memory {memory_id}"
        except Exception as e:
            logger.error(f"Failed to update memory {memory_id}: {e}")
            raise

    def delete_memory(self, memory_id: str) -> str:
        """Delete a memory.

        Args:
            memory_id: ID of memory to delete

        Returns:
            Deletion confirmation
        """
        if not memory_id:
            raise ValueError("Memory ID is required for deletion")

        try:
            self._client.delete(memory_id)
            return f"Deleted memory {memory_id}"
        except Exception as e:
            logger.error(f"Failed to delete memory {memory_id}: {e}")
            raise

    def delete_all_memories(self) -> str:
        """Delete all memories for this agent/user.

        Returns:
            Deletion confirmation
        """
        try:
            self._client.delete_all(
                user_id=self.config.user_id,
                agent_id=self.config.agent_id,
            )
            return "Deleted all memories"
        except Exception as e:
            logger.error(f"Failed to delete all memories: {e}")
            raise

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
            # FIXED: Better content extraction
            content = (
                mem.get("memory") or
                mem.get("content") or
                mem.get("text") or
                str(mem)
            )
            score = mem.get("score", "")
            score_str = f" (relevance: {score:.2f})" if score else ""
            lines.append(f"{i}. {content}{score_str}")

        return "\n".join(lines)


class ConversationMemory:
    """Conversation memory using Mem0 for persistence.

    Combines short-term sliding window with long-term Mem0 storage.
    Messages are stored in Mem0 for cross-session retrieval.

    FIXED: Better integration between short-term and long-term memory
    """

    def __init__(
        self,
        window_size: int = 20,
        mem0_config: Optional[MemoryConfig] = None,
        persist_all: bool = True,
        persist_insights_only: bool = False,  # FIXED: Added option
    ):
        """Initialize conversation memory.

        Args:
            window_size: Number of recent messages to keep in context
            mem0_config: Mem0 configuration
            persist_all: Whether to persist all messages to Mem0
            persist_insights_only: Only persist important insights (not all messages)
        """
        self.window_size = window_size
        self.persist_all = persist_all and not persist_insights_only
        self.persist_insights_only = persist_insights_only
        self.messages: List[Dict[str, Any]] = []

        # Initialize Mem0 for long-term storage
        try:
            self.mem0 = Mem0Memory(mem0_config)
            self._has_mem0 = True
        except ImportError as e:
            self._has_mem0 = False
            logger.warning(f"Mem0 not available: {e}. Using in-memory only.")

    def add_user(self, content: str) -> None:
        """Add user message."""
        msg = {
            "role": "user",
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.messages.append(msg)

        # FIXED: Trim messages AFTER adding
        self._trim_to_window()

        if self._has_mem0 and self.persist_all:
            try:
                self.mem0.store_memory(
                    f"[USER] {content}",
                    categories=["conversation", "user_message"],
                )
            except Exception as e:
                logger.error(f"Failed to persist user message: {e}")

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
        self._trim_to_window()

        if self._has_mem0 and self.persist_all:
            try:
                # Store response
                self.mem0.store_memory(
                    f"[ASSISTANT] {content}",
                    categories=["conversation", "assistant_response"],
                )

                # Store tool usage patterns if any
                if tool_calls and isinstance(tool_calls, list):
                    tools_used = ", ".join(
                        tc.get("tool", "unknown")
                        for tc in tool_calls
                        if isinstance(tc, dict)
                    )
                    if tools_used:
                        self.mem0.store_memory(
                            f"Used tools: {tools_used}",
                            categories=["tool_usage"],
                        )
            except Exception as e:
                logger.error(f"Failed to persist assistant message: {e}")

    def add_tool(self, tool_name: str, result: str) -> None:
        """Add tool result."""
        msg = {
            "role": "tool",
            "tool_name": tool_name,
            "content": result,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.messages.append(msg)
        self._trim_to_window()

    def _trim_to_window(self) -> None:
        """Trim messages to window size."""
        if len(self.messages) > self.window_size:
            self.messages = self.messages[-self.window_size:]

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
            try:
                mem_context = self.mem0.get_context(query, limit=3)
                if "No relevant memories" not in mem_context:
                    lines.append(mem_context)
                    lines.append("")
            except Exception as e:
                logger.error(f"Failed to get memory context: {e}")

        # Add recent conversation (sliding window)
        lines.append("## Recent Conversation:")

        for msg in self.messages:
            role = msg["role"]
            content = msg["content"]

            if role == "user":
                lines.append(f"User: {content}")
            elif role == "assistant":
                lines.append(f"Assistant: {content}")
            elif role == "tool":
                tool_name = msg.get("tool_name", "tool")
                # FIXED: Better truncation for tool results
                content_preview = content[:200] + "..." if len(content) > 200 else content
                lines.append(f"Tool[{tool_name}]: {content_preview}")

        return "\n".join(lines)

    def clear(self) -> None:
        """Clear short-term memory (keeps Mem0 long-term)."""
        self.messages = []

    def clear_all(self) -> None:
        """Clear both short-term and long-term memory."""
        self.messages = []
        if self._has_mem0:
            try:
                self.mem0.delete_all_memories()
            except Exception as e:
                logger.error(f"Failed to clear long-term memory: {e}")

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
        if not self._has_mem0:
            return "Mem0 not available for insight storage"

        try:
            return self.mem0.store_memory(
                insight,
                categories=categories or ["insight"],
            )
        except Exception as e:
            logger.error(f"Failed to store insight: {e}")
            return f"Failed to store insight: {str(e)}"

    def recall(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Recall relevant memories for a query.

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of relevant memories
        """
        if not self._has_mem0:
            return []

        try:
            return self.mem0.search_memories(query, limit=limit)
        except Exception as e:
            logger.error(f"Failed to recall memories: {e}")
            return []


# DSPy-style MemoryTools for tool-based access
class MemoryTools:
    """Memory tools for DSPy agent.

    Provides tool functions that can be registered with the agent
    for explicit memory operations.

    FIXED: Better error handling and validation
    """

    def __init__(self, config: Optional[MemoryConfig] = None):
        """Initialize memory tools.

        Args:
            config: Mem0 configuration
        """
        try:
            self.mem0 = Mem0Memory(config)
            self._available = True
        except Exception as e:
            logger.error(f"Failed to initialize MemoryTools: {e}")
            self._available = False
            raise

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
        if not self._available:
            return "Memory tools not available"

        # FIXED: Better category parsing
        cat_list = None
        if categories:
            cat_list = [c.strip() for c in categories.split(",") if c.strip()]

        try:
            return self.mem0.store_memory(content, categories=cat_list)
        except Exception as e:
            return f"Failed to store memory: {str(e)}"

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
        if not self._available:
            return "Memory tools not available"

        try:
            results = self.mem0.search_memories(query, limit=limit)

            if not results:
                return "No relevant memories found."

            lines = []
            for i, mem in enumerate(results, 1):
                content = (
                    mem.get("memory") or
                    mem.get("content") or
                    mem.get("text") or
                    str(mem)
                )
                score = mem.get("score", "")
                score_str = f" (score: {score:.2f})" if score else ""
                lines.append(f"{i}. {content}{score_str}")

            return "\n".join(lines)
        except Exception as e:
            return f"Failed to search memories: {str(e)}"

    def get_all_memories(self, limit: int = 50) -> str:
        """Get all stored memories.

        Args:
            limit: Maximum memories to return

        Returns:
            Formatted list of all memories
        """
        if not self._available:
            return "Memory tools not available"

        try:
            memories = self.mem0.get_all_memories(limit=limit)

            if not memories:
                return "No memories stored yet."

            lines = []
            for i, mem in enumerate(memories, 1):
                content = (
                    mem.get("memory") or
                    mem.get("content") or
                    mem.get("text") or
                    str(mem)
                )
                mem_id = mem.get("id", "unknown")
                # FIXED: Better truncation
                content_preview = content[:100] + "..." if len(content) > 100 else content
                lines.append(f"{i}. [{mem_id}] {content_preview}")

            return "\n".join(lines)
        except Exception as e:
            return f"Failed to get memories: {str(e)}"

    def update_memory(self, memory_id: str, content: str) -> str:
        """Update an existing memory.

        Args:
            memory_id: ID of memory to update
            content: New content

        Returns:
            Update confirmation
        """
        if not self._available:
            return "Memory tools not available"

        try:
            return self.mem0.update_memory(memory_id, content)
        except Exception as e:
            return f"Failed to update memory: {str(e)}"

    def delete_memory(self, memory_id: str) -> str:
        """Delete a memory.

        Args:
            memory_id: ID of memory to delete

        Returns:
            Deletion confirmation
        """
        if not self._available:
            return "Memory tools not available"

        try:
            return self.mem0.delete_memory(memory_id)
        except Exception as e:
            return f"Failed to delete memory: {str(e)}"