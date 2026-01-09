"""Robust tool registry for Ron's Strands tools.

Why this exists:
- `strands_tools` contains many tools with *optional* dependencies (graphviz,
  opensearch, playwright, etc).
- Importing every tool unconditionally will crash the entire tool registry on
  the first missing optional dependency, leaving the agent with zero tools.

This module:
- Adds the local `agents/tools/src` to `sys.path`
- Imports each tool defensively (skip-on-failure)
- Exposes the same public surface as the previous eager `agents.Ron.tools` init:
  FUNCTION_TOOLS, DICT_TOOLS, TOOL_SPECS, CORE_TOOLS, ALL_TOOLS, plus helpers.
"""

from __future__ import annotations

import sys
from importlib import import_module
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

# ---------------------------------------------------------------------------
# Ensure local `agents/tools/src` is importable as `strands_tools`
# ---------------------------------------------------------------------------

_TOOLS_SRC = Path(__file__).resolve().parent.parent.parent / "tools" / "src"
if _TOOLS_SRC.exists():
    sys.path.insert(0, str(_TOOLS_SRC))

# ---------------------------------------------------------------------------
# Defensive import helpers
# ---------------------------------------------------------------------------

IMPORT_ERRORS: Dict[str, str] = {}


def _try_import_attr(module: str, attr: str) -> Optional[Any]:
    """Import module.attr, recording failures instead of raising."""
    try:
        return getattr(import_module(module), attr)
    except Exception as e:
        IMPORT_ERRORS[f"{module}.{attr}"] = f"{type(e).__name__}: {e}"
        return None


def _try_import_tool(module: str, name: str, tool_spec: bool = False) -> tuple[Optional[Callable], Optional[Dict[str, Any]]]:
    """Import a tool callable, optionally capturing TOOL_SPEC."""
    tool = _try_import_attr(module, name)
    spec = _try_import_attr(module, "TOOL_SPEC") if tool_spec else None
    if tool_spec and spec is None:
        # Keep a clearer error key if TOOL_SPEC is missing.
        if f"{module}.TOOL_SPEC" not in IMPORT_ERRORS:
            IMPORT_ERRORS[f"{module}.TOOL_SPEC"] = "Missing TOOL_SPEC"
    return tool, spec if isinstance(spec, dict) else None


# ---------------------------------------------------------------------------
# Collect tools
# ---------------------------------------------------------------------------

FUNCTION_TOOLS: List[Callable] = []
DICT_TOOLS: List[Callable] = []
TOOL_SPECS: Dict[str, Dict[str, Any]] = {}


def _add_function_tool(tool: Optional[Callable]) -> None:
    if callable(tool):
        FUNCTION_TOOLS.append(tool)


def _add_dict_tool(tool: Optional[Callable], spec: Optional[Dict[str, Any]]) -> None:
    if callable(tool):
        DICT_TOOLS.append(tool)
        if spec:
            TOOL_SPECS[tool.__name__] = spec


# ---------------------------
# Core tools (should be available in a minimal install)
# ---------------------------

_add_function_tool(_try_import_attr("strands_tools.calculator", "calculator"))
_add_function_tool(_try_import_attr("strands_tools.cron", "cron"))
_add_function_tool(_try_import_attr("strands_tools.current_time", "current_time"))
_add_function_tool(_try_import_attr("strands_tools.editor", "editor"))
_add_function_tool(_try_import_attr("strands_tools.memory", "memory"))
_add_function_tool(_try_import_attr("strands_tools.mcp_client", "mcp_client"))
_add_function_tool(_try_import_attr("strands_tools.rss", "rss"))
_add_function_tool(_try_import_attr("strands_tools.shell", "shell"))
_add_function_tool(_try_import_attr("strands_tools.sleep", "sleep"))
_add_function_tool(_try_import_attr("strands_tools.swarm", "swarm"))
_add_function_tool(_try_import_attr("strands_tools.think", "think"))
_add_function_tool(_try_import_attr("strands_tools.use_agent", "use_agent"))
_add_function_tool(_try_import_attr("strands_tools.workflow", "workflow"))

# Dict/TOOL_SPEC core-ish
for _module, _name in [
    ("strands_tools.batch", "batch"),
    ("strands_tools.environment", "environment"),
    ("strands_tools.file_read", "file_read"),
    ("strands_tools.file_write", "file_write"),
    ("strands_tools.http_request", "http_request"),
    ("strands_tools.journal", "journal"),
    ("strands_tools.python_repl", "python_repl"),
    ("strands_tools.retrieve", "retrieve"),
    ("strands_tools.stop", "stop"),
]:
    t, s = _try_import_tool(_module, _name, tool_spec=True)
    _add_dict_tool(t, s)

# ---------------------------
# Optional tools (skip if deps missing)
# ---------------------------

# Slack (function tools)
_slack = _try_import_attr("strands_tools.slack", "slack")
_slack_send_message = _try_import_attr("strands_tools.slack", "slack_send_message")
_add_function_tool(_slack)
_add_function_tool(_slack_send_message)

# Tavily (function tools)
for _name in ("tavily_search", "tavily_extract", "tavily_crawl", "tavily_search_qna"):
    _add_function_tool(_try_import_attr("strands_tools.tavily", _name))

# Other function tools that may depend on optional deps / credentials
for _module, _name in [
    ("strands_tools.bright_data", "bright_data"),
    ("strands_tools.elasticsearch_memory", "elasticsearch_memory"),
    ("strands_tools.exa", "exa"),
    ("strands_tools.graph", "graph"),
    ("strands_tools.mongodb_memory", "mongodb_memory"),
    ("strands_tools.nova_reels", "nova_reels"),
    ("strands_tools.load_tool", "load_tool"),
    ("strands_tools.use_computer", "use_computer"),
]:
    _add_function_tool(_try_import_attr(_module, _name))

# TOOL_SPEC tools (optional deps / credentials)
for _module, _name in [
    ("strands_tools.agent_graph", "agent_graph"),
    ("strands_tools.chat_video", "chat_video"),
    ("strands_tools.generate_image", "generate_image"),
    ("strands_tools.generate_image_stability", "generate_image_stability"),
    ("strands_tools.handoff_to_user", "handoff_to_user"),
    ("strands_tools.image_reader", "image_reader"),
    ("strands_tools.mem0_memory", "mem0_memory"),
    ("strands_tools.search_video", "search_video"),
    ("strands_tools.speak", "speak"),
    ("strands_tools.use_aws", "use_aws"),
    ("strands_tools.use_llm", "use_llm"),
]:
    t, s = _try_import_tool(_module, _name, tool_spec=True)
    _add_dict_tool(t, s)

# ---------------------------------------------------------------------------
# Class-based providers (optional)
# ---------------------------------------------------------------------------

A2AClientToolProvider = _try_import_attr("strands_tools.a2a_client", "A2AClientToolProvider")
AgentCoreMemoryToolProvider = _try_import_attr("strands_tools.agent_core_memory", "AgentCoreMemoryToolProvider")

# Browser tools (optional)
Browser = None
LocalChromiumBrowser = None
AgentCoreBrowser = None
BROWSER_AVAILABLE = False
try:
    Browser = import_module("strands_tools.browser").Browser
    LocalChromiumBrowser = import_module("strands_tools.browser").LocalChromiumBrowser
    AgentCoreBrowser = import_module("strands_tools.browser").AgentCoreBrowser
    BROWSER_AVAILABLE = True
except Exception as e:
    IMPORT_ERRORS["strands_tools.browser"] = f"{type(e).__name__}: {e}"

# Code interpreter tools (optional)
CodeInterpreter = None
AgentCoreCodeInterpreter = None
CODE_INTERPRETER_AVAILABLE = False
try:
    CodeInterpreter = import_module("strands_tools.code_interpreter").CodeInterpreter
    AgentCoreCodeInterpreter = import_module("strands_tools.code_interpreter").AgentCoreCodeInterpreter
    CODE_INTERPRETER_AVAILABLE = True
except Exception as e:
    IMPORT_ERRORS["strands_tools.code_interpreter"] = f"{type(e).__name__}: {e}"

# ---------------------------------------------------------------------------
# Derived collections + helper functions (API compatible)
# ---------------------------------------------------------------------------

# Core tools that should always be available (best-effort)
CORE_TOOLS: List[Any] = []
for _maybe in (
    _try_import_attr("strands_tools.editor", "editor"),
    _try_import_attr("strands_tools.shell", "shell"),
    _try_import_attr("strands_tools.file_read", "file_read"),
    _try_import_attr("strands_tools.file_write", "file_write"),
    _try_import_attr("strands_tools.http_request", "http_request"),
    _try_import_attr("strands_tools.current_time", "current_time"),
    _try_import_attr("strands_tools.think", "think"),
):
    if callable(_maybe):
        CORE_TOOLS.append(_maybe)

ALL_TOOLS: List[Any] = list({*FUNCTION_TOOLS, *DICT_TOOLS})


def get_tool_by_name(name: str) -> Optional[Any]:
    """Get a tool by its name (function/dict/class-based providers)."""
    for tool in FUNCTION_TOOLS:
        if getattr(tool, "__name__", None) == name:
            return tool

    # Dict-based tools are keyed by TOOL_SPECS (their function name)
    if name in TOOL_SPECS:
        for tool in DICT_TOOLS:
            if getattr(tool, "__name__", None) == name:
                return tool

    # Class-based providers
    if name == "A2AClientToolProvider":
        return A2AClientToolProvider
    if name == "AgentCoreMemoryToolProvider":
        return AgentCoreMemoryToolProvider

    # Browser tools
    if name == "LocalChromiumBrowser":
        return LocalChromiumBrowser
    if name == "AgentCoreBrowser":
        return AgentCoreBrowser

    # Code interpreter
    if name == "AgentCoreCodeInterpreter":
        return AgentCoreCodeInterpreter

    return None


def get_tool_spec(name: str) -> Optional[Dict[str, Any]]:
    """Get TOOL_SPEC for a dict-based tool."""
    return TOOL_SPECS.get(name)


def list_available_tools() -> List[str]:
    """List all available tool names (best-effort, skips missing deps)."""
    names: List[str] = []
    for tool in FUNCTION_TOOLS:
        n = getattr(tool, "__name__", None)
        if n:
            names.append(n)
    names.extend(TOOL_SPECS.keys())

    if A2AClientToolProvider is not None:
        names.append("A2AClientToolProvider")
    if AgentCoreMemoryToolProvider is not None:
        names.append("AgentCoreMemoryToolProvider")
    if BROWSER_AVAILABLE:
        names.extend(["LocalChromiumBrowser", "AgentCoreBrowser"])
    if CODE_INTERPRETER_AVAILABLE:
        names.append("AgentCoreCodeInterpreter")

    return sorted(set(names))


__all__ = [
    # Collections
    "CORE_TOOLS",
    "FUNCTION_TOOLS",
    "DICT_TOOLS",
    "ALL_TOOLS",
    "TOOL_SPECS",
    # Diagnostics
    "IMPORT_ERRORS",
    # Flags + providers
    "BROWSER_AVAILABLE",
    "CODE_INTERPRETER_AVAILABLE",
    "Browser",
    "LocalChromiumBrowser",
    "AgentCoreBrowser",
    "CodeInterpreter",
    "AgentCoreCodeInterpreter",
    "A2AClientToolProvider",
    "AgentCoreMemoryToolProvider",
    # Helpers
    "get_tool_by_name",
    "get_tool_spec",
    "list_available_tools",
]

