"""Tool Registry for Ron Agent - Complete Strands Tools Import.

This module imports ALL tools from the local strands-tools repository.
Tools are categorized by their export pattern for proper organization.
"""

import sys
from pathlib import Path
from typing import List, Any, Dict, Optional

# Add strands-tools to path
tools_path = Path(__file__).parent.parent.parent / "tools" / "src"
sys.path.insert(0, str(tools_path))

# ===========================
# @tool decorator exports (function-based tools)
# ===========================
from strands_tools.calculator import calculator
from strands_tools.cron import cron
from strands_tools.current_time import current_time
from strands_tools.editor import editor
from strands_tools.load_tool import load_tool
from strands_tools.mcp_client import mcp_client
from strands_tools.memory import memory
try:
    from strands_tools.rss import rss
except Exception:
    rss = None
from strands_tools.shell import shell
from strands_tools.slack import slack, slack_send_message
from strands_tools.sleep import sleep
from strands_tools.swarm import swarm
from strands_tools.think import think
from strands_tools.use_agent import use_agent
from strands_tools.workflow import workflow

# Optional function-tools (may require extra dependencies / credentials).
try:
    from strands_tools.bright_data import bright_data
except Exception:
    bright_data = None

try:
    from strands_tools.diagram import diagram
except Exception:
    diagram = None

try:
    from strands_tools.elasticsearch_memory import elasticsearch_memory
except Exception:
    elasticsearch_memory = None

try:
    from strands_tools.exa import exa
except Exception:
    exa = None

try:
    from strands_tools.graph import graph
except Exception:
    graph = None

try:
    from strands_tools.mongodb_memory import mongodb_memory
except Exception:
    mongodb_memory = None

try:
    from strands_tools.nova_reels import nova_reels
except Exception:
    nova_reels = None

try:
    from strands_tools.tavily import tavily_search, tavily_extract, tavily_crawl, tavily_search_qna
except Exception:
    tavily_search = None
    tavily_extract = None
    tavily_crawl = None
    tavily_search_qna = None

try:
    from strands_tools.use_computer import use_computer
except Exception:
    use_computer = None

# ===========================
# TOOL_SPEC exports (dict-based tools requiring special handling)
# ===========================
from strands_tools.agent_graph import agent_graph, TOOL_SPEC as agent_graph_spec
from strands_tools.batch import batch, TOOL_SPEC as batch_spec
try:
    from strands_tools.chat_video import chat_video, TOOL_SPEC as chat_video_spec
except Exception:
    chat_video = None
    chat_video_spec = None
from strands_tools.environment import environment, TOOL_SPEC as environment_spec
from strands_tools.file_read import file_read, TOOL_SPEC as file_read_spec
from strands_tools.file_write import file_write, TOOL_SPEC as file_write_spec
from strands_tools.generate_image import generate_image, TOOL_SPEC as generate_image_spec
from strands_tools.generate_image_stability import (
    generate_image_stability,
    TOOL_SPEC as generate_image_stability_spec,
)
from strands_tools.handoff_to_user import handoff_to_user, TOOL_SPEC as handoff_to_user_spec
from strands_tools.http_request import http_request, TOOL_SPEC as http_request_spec
from strands_tools.image_reader import image_reader, TOOL_SPEC as image_reader_spec
from strands_tools.journal import journal, TOOL_SPEC as journal_spec
try:
    from strands_tools.mem0_memory import mem0_memory, TOOL_SPEC as mem0_memory_spec
except Exception:
    mem0_memory = None
    mem0_memory_spec = None
from strands_tools.python_repl import python_repl, TOOL_SPEC as python_repl_spec
from strands_tools.retrieve import retrieve, TOOL_SPEC as retrieve_spec
try:
    from strands_tools.search_video import search_video, TOOL_SPEC as search_video_spec
except Exception:
    search_video = None
    search_video_spec = None
from strands_tools.speak import speak, TOOL_SPEC as speak_spec
from strands_tools.stop import stop, TOOL_SPEC as stop_spec
from strands_tools.use_aws import use_aws, TOOL_SPEC as use_aws_spec
from strands_tools.use_llm import use_llm, TOOL_SPEC as use_llm_spec

# ===========================
# Class-based Tool Providers
# ===========================
try:
    from strands_tools.a2a_client import A2AClientToolProvider
except Exception:
    A2AClientToolProvider = None

try:
    from strands_tools.agent_core_memory import AgentCoreMemoryToolProvider
except Exception:
    AgentCoreMemoryToolProvider = None

# ===========================
# Browser Tools (inheritance-based)
# ===========================
try:
    from strands_tools.browser import (
        Browser,
        LocalChromiumBrowser,
        AgentCoreBrowser,
    )
    BROWSER_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Browser tools not available - {e}")
    BROWSER_AVAILABLE = False
    Browser = None
    LocalChromiumBrowser = None
    AgentCoreBrowser = None

# ===========================
# Code Interpreter Tools (inheritance-based)
# ===========================
try:
    from strands_tools.code_interpreter import (
        CodeInterpreter,
        AgentCoreCodeInterpreter,
    )
    CODE_INTERPRETER_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Code interpreter tools not available - {e}")
    CODE_INTERPRETER_AVAILABLE = False
    CodeInterpreter = None
    AgentCoreCodeInterpreter = None

# ===========================
# Tool Collections
# ===========================

# Core tools that should always be available
CORE_TOOLS = [t for t in (editor, shell, file_read, file_write, http_request, current_time, think) if t is not None]

# Function-based tools (use @tool decorator)
FUNCTION_TOOLS = [
    t
    for t in (
        bright_data,
        calculator,
        cron,
        current_time,
        diagram,
        editor,
        elasticsearch_memory,
        exa,
        graph,
        load_tool,
        mcp_client,
        memory,
        mongodb_memory,
        nova_reels,
        rss,
        shell,
        slack,
        slack_send_message,
        sleep,
        swarm,
        tavily_search,
        tavily_extract,
        tavily_crawl,
        tavily_search_qna,
        think,
        use_agent,
        use_computer,
        workflow,
    )
    if t is not None
]

# Dict-based tools (use TOOL_SPEC pattern)
DICT_TOOLS = [
    t
    for t in (
        agent_graph,
        batch,
        chat_video,
        environment,
        file_read,
        file_write,
        generate_image,
        generate_image_stability,
        handoff_to_user,
        http_request,
        image_reader,
        journal,
        mem0_memory,
        python_repl,
        retrieve,
        search_video,
        speak,
        stop,
        use_aws,
        use_llm,
    )
    if t is not None
]

# All tools combined
ALL_TOOLS = list(set(FUNCTION_TOOLS + DICT_TOOLS))

# Tool specs for dict-based tools
TOOL_SPECS = {
    "agent_graph": agent_graph_spec,
    "batch": batch_spec,
    "environment": environment_spec,
    "file_read": file_read_spec,
    "file_write": file_write_spec,
    "generate_image": generate_image_spec,
    "generate_image_stability": generate_image_stability_spec,
    "handoff_to_user": handoff_to_user_spec,
    "http_request": http_request_spec,
    "image_reader": image_reader_spec,
    "journal": journal_spec,
    **({"mem0_memory": mem0_memory_spec} if mem0_memory_spec is not None else {}),
    "python_repl": python_repl_spec,
    "retrieve": retrieve_spec,
    **({"chat_video": chat_video_spec} if chat_video_spec is not None else {}),
    **({"search_video": search_video_spec} if search_video_spec is not None else {}),
    "speak": speak_spec,
    "stop": stop_spec,
    "use_aws": use_aws_spec,
    "use_llm": use_llm_spec,
}


def get_tool_by_name(name: str) -> Optional[Any]:
    """Get a tool by its name.

    Args:
        name: The name of the tool to retrieve

    Returns:
        The tool function/class or None if not found
    """
    # Check function tools
    for tool in FUNCTION_TOOLS:
        if hasattr(tool, "__name__") and tool.__name__ == name:
            return tool

    # Check dict tools
    if name in TOOL_SPECS:
        for tool in DICT_TOOLS:
            if hasattr(tool, "__name__") and tool.__name__ == name:
                return tool

    # Check class-based providers
    if name == "A2AClientToolProvider":
        return A2AClientToolProvider
    elif name == "AgentCoreMemoryToolProvider":
        return AgentCoreMemoryToolProvider

    # Check browser tools
    if BROWSER_AVAILABLE:
        if name == "LocalChromiumBrowser":
            return LocalChromiumBrowser
        elif name == "AgentCoreBrowser":
            return AgentCoreBrowser

    # Check code interpreter tools
    if CODE_INTERPRETER_AVAILABLE:
        if name == "AgentCoreCodeInterpreter":
            return AgentCoreCodeInterpreter

    return None


def get_tool_spec(name: str) -> Optional[Dict]:
    """Get the TOOL_SPEC for a dict-based tool.

    Args:
        name: The name of the tool

    Returns:
        The TOOL_SPEC dict or None if not found
    """
    return TOOL_SPECS.get(name)


def list_available_tools() -> List[str]:
    """List all available tool names.

    Returns:
        List of tool names
    """
    tools = []

    # Add function tool names
    for tool in FUNCTION_TOOLS:
        if hasattr(tool, "__name__"):
            tools.append(tool.__name__)

    # Add dict tool names
    tools.extend(TOOL_SPECS.keys())

    # Add class-based providers
    if A2AClientToolProvider is not None:
        tools.append("A2AClientToolProvider")
    if AgentCoreMemoryToolProvider is not None:
        tools.append("AgentCoreMemoryToolProvider")

    # Add browser tools if available
    if BROWSER_AVAILABLE:
        tools.extend(["LocalChromiumBrowser", "AgentCoreBrowser"])

    # Add code interpreter tools if available
    if CODE_INTERPRETER_AVAILABLE:
        tools.extend(["AgentCoreCodeInterpreter"])

    return sorted(tools)


# Export all symbols
__all__ = [
    # Core tools
    "CORE_TOOLS",
    "FUNCTION_TOOLS",
    "DICT_TOOLS",
    "ALL_TOOLS",
    "TOOL_SPECS",
    # Utility functions
    "get_tool_by_name",
    "get_tool_spec",
    "list_available_tools",
    # Function-based tools
    "bright_data",
    "calculator",
    "cron",
    "current_time",
    "diagram",
    "editor",
    "elasticsearch_memory",
    "exa",
    "graph",
    "load_tool",
    "mcp_client",
    "memory",
    "mongodb_memory",
    "nova_reels",
    "rss",
    "shell",
    "slack",
    "slack_send_message",
    "sleep",
    "swarm",
    "tavily_search",
    "tavily_extract",
    "tavily_crawl",
    "tavily_search_qna",
    "think",
    "use_agent",
    "use_computer",
    "workflow",
    # Dict-based tools
    "agent_graph",
    "batch",
    "chat_video",
    "environment",
    "file_read",
    "file_write",
    "generate_image",
    "generate_image_stability",
    "handoff_to_user",
    "http_request",
    "image_reader",
    "journal",
    "mem0_memory",
    "python_repl",
    "retrieve",
    "search_video",
    "speak",
    "stop",
    "use_aws",
    "use_llm",
    # Class-based providers
    "A2AClientToolProvider",
    "AgentCoreMemoryToolProvider",
    # Browser tools
    "Browser",
    "LocalChromiumBrowser",
    "AgentCoreBrowser",
    "BROWSER_AVAILABLE",
    # Code interpreter tools
    "CodeInterpreter",
    "AgentCoreCodeInterpreter",
    "CODE_INTERPRETER_AVAILABLE",
]