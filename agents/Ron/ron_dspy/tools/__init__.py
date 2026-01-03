"""Tool wrappers for DSPy Agent.

Provides:
- StrandsToolsWrapper: Dynamic wrapper for ALL 50+ Strands tools
- PlaywrightElectronMCP: Browser automation for Electron apps
- TaskTools: Supabase task CRUD
- SystemTools: Shell, file, HTTP operations
- AgentTools: Sub-agent spawning (use_agent, swarm)

Quick Start:
    # Get all Strands tools
    from agents.Ron.dspy.tools import get_all_strands_tools
    all_tools = get_all_strands_tools()

    # Get specific categories
    from agents.Ron.dspy.tools import get_core_tools, get_agent_tools
    core = get_core_tools()
    agent = get_agent_tools()
"""

from .browser import BrowserTools, PlaywrightElectronMCP
from .tasks import TaskTools
from .system import SystemTools
from .agents import AgentTools
from .strands_wrapper import (
    StrandsToolsWrapper,
    get_all_strands_tools,
    get_core_tools,
    get_agent_tools,
    get_memory_tools,
    get_default_wrapper,
)

__all__ = [
    # Main tool providers
    "BrowserTools",
    "PlaywrightElectronMCP",
    "TaskTools",
    "SystemTools",
    "AgentTools",
    # Strands wrapper
    "StrandsToolsWrapper",
    "get_all_strands_tools",
    "get_core_tools",
    "get_agent_tools",
    "get_memory_tools",
    "get_default_wrapper",
]
