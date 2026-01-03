"""Ron DSPy package.

Important: this package is intentionally **lazy-imported**.

Reason:
- The DSPy runtime (`dspy-ai`) and some optional integrations may not be installed
  in every environment (e.g. when you only want to inspect tools or run the UI).
- A hard import in `__init__` makes *any* submodule import fail (including tools),
  which is brittle and makes debugging worse.
"""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = [
    # Main agent
    "RonAgent",
    # LM configuration
    "configure_bedrock_lm",
    "configure_anthropic_lm",
    "get_default_lm",
    # Memory
    "Mem0Memory",
    "ConversationMemory",
    "MemoryTools",
    "MemoryConfig",
    # Tools
    "PlaywrightElectronMCP",
    "BrowserTools",
    "TaskTools",
    "SystemTools",
    "AgentTools",
    "StrandsToolsWrapper",
    "get_all_strands_tools",
    "get_core_tools",
    "get_agent_tools",
    "get_memory_tools",
    # Optimization
    "distill_to_open_weights",
    "optimize_agent",
    "evaluate_agent",
    "compare_agents",
    "load_training_data",
]


_EXPORTS: dict[str, tuple[str, str]] = {
    # Agent + LM config (requires dspy-ai)
    "RonAgent": (".agent", "RonAgent"),
    "configure_bedrock_lm": (".config", "configure_bedrock_lm"),
    "configure_anthropic_lm": (".config", "configure_anthropic_lm"),
    "get_default_lm": (".config", "get_default_lm"),
    # Memory (does not require dspy-ai)
    "Mem0Memory": (".memory", "Mem0Memory"),
    "ConversationMemory": (".memory", "ConversationMemory"),
    "MemoryTools": (".memory", "MemoryTools"),
    "MemoryConfig": (".memory", "MemoryConfig"),
    # Tools (should be importable without dspy-ai)
    "PlaywrightElectronMCP": (".tools", "PlaywrightElectronMCP"),
    "BrowserTools": (".tools", "BrowserTools"),
    "TaskTools": (".tools", "TaskTools"),
    "SystemTools": (".tools", "SystemTools"),
    "AgentTools": (".tools", "AgentTools"),
    "StrandsToolsWrapper": (".tools", "StrandsToolsWrapper"),
    "get_all_strands_tools": (".tools", "get_all_strands_tools"),
    "get_core_tools": (".tools", "get_core_tools"),
    "get_agent_tools": (".tools", "get_agent_tools"),
    "get_memory_tools": (".tools", "get_memory_tools"),
    # Optimization (may require optional deps depending on usage)
    "distill_to_open_weights": (".optimization.trainer", "distill_to_open_weights"),
    "optimize_agent": (".optimization.trainer", "optimize_agent"),
    "evaluate_agent": (".optimization.trainer", "evaluate_agent"),
    "compare_agents": (".optimization.trainer", "compare_agents"),
    "load_training_data": (".optimization.trainer", "load_training_data"),
}


def __getattr__(name: str) -> Any:
    """Lazy attribute loader for package exports."""
    if name not in _EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module_name, attr = _EXPORTS[name]
    try:
        module = import_module(module_name, package=__name__)
        return getattr(module, attr)
    except ModuleNotFoundError as e:
        # Improve the error message for common missing optional deps.
        if e.name in {"dspy", "dspy_ai", "dspy-ai"} or "dspy" in str(e):
            raise ModuleNotFoundError(
                "DSPy dependencies are not installed for `agents.Ron.ron_dspy`.\n"
                "Install them with:\n"
                "  pip install -r agents/Ron/requirements.txt\n"
            ) from e
        raise


def __dir__() -> list[str]:
    return sorted(set(__all__))
