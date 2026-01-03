"""Memory modules for DSPy agent.

Primary: Mem0-based memory (semantic search, persistence)
Legacy: Simple conversation memory (sliding window only)

DSPy Pattern - use MemoryTools for tool-based access:
    memory_tools = MemoryTools()
    agent.tools["store_memory"] = memory_tools.store_memory
    agent.tools["search_memories"] = memory_tools.search_memories
"""

from .mem0 import (
    Mem0Memory,
    ConversationMemory,
    MemoryTools,
    MemoryConfig,
)

# Legacy import (simple sliding window, no persistence)
from .conversation import ConversationMemory as LegacyConversationMemory
from .conversation import Message

__all__ = [
    # Primary (Mem0-based)
    "Mem0Memory",
    "ConversationMemory",
    "MemoryTools",
    "MemoryConfig",
    # Legacy
    "LegacyConversationMemory",
    "Message",
]
