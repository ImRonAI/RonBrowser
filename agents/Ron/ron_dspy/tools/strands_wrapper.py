"""Dynamic Strands Tools Wrapper for DSPy Agent.

This module automatically wraps ALL 50+ Strands tools for use with DSPy agents.
Instead of manually defining each tool, it dynamically imports and wraps them.

Features:
- Automatic discovery of all Strands tools
- Proper docstring extraction for tool descriptions
- Type hint preservation for argument validation
- Support for @tool decorator tools, TOOL_SPEC tools, and class-based tools
- Lazy loading to reduce startup time
"""

import inspect
from pathlib import Path
from typing import Dict, Callable, Any, List, Optional, Set
from functools import wraps
from importlib import import_module


class StrandsToolsWrapper:
    """Dynamically wraps all Strands tools for DSPy agent use.

    Usage:
        wrapper = StrandsToolsWrapper()

        # Get all tools as dict
        all_tools = wrapper.get_all_tools()

        # Get specific tool
        shell_tool = wrapper.get_tool("shell")

        # Get tools by category
        browser_tools = wrapper.get_tools_by_category("browser")

        # Register with DSPy agent
        agent.tools.update(wrapper.get_all_tools())
    """

    # Tool categories for organization
    CATEGORIES = {
        "core": [
            "shell", "editor", "file_read", "file_write",
            "http_request", "current_time", "think",
        ],
        "browser": [
            # Note: the wrapper registers browser providers under these keys.
            "local_browser", "agent_browser",
            # Also include the functional “computer control” tool if available.
            "use_computer",
        ],
        "memory": [
            "memory", "mem0_memory", "elasticsearch_memory",
            "mongodb_memory", "retrieve",
        ],
        "agents": [
            "use_agent", "swarm", "agent_graph", "workflow",
        ],
        "ai": [
            "use_llm", "generate_image", "generate_image_stability",
            "chat_video", "search_video", "image_reader",
        ],
        "search": [
            "tavily_search", "tavily_extract", "tavily_crawl",
            "tavily_search_qna", "exa", "bright_data",
        ],
        "communication": [
            "slack", "slack_send_message", "speak", "handoff_to_user",
        ],
        "system": [
            "environment", "python_repl", "calculator", "sleep",
            "cron", "batch", "stop",
        ],
        "visualization": [
            "diagram", "graph", "nova_reels",
        ],
        "data": [
            "rss", "journal", "use_aws", "load_tool", "mcp_client",
        ],
    }

    def __init__(self, lazy_load: bool = True, exclude_tools: Optional[Set[str]] = None):
        """Initialize Strands tools wrapper.

        Args:
            lazy_load: If True, only load tools when accessed
            exclude_tools: Set of tool names to exclude
        """
        self._tools: Dict[str, Callable] = {}
        self._tool_specs: Dict[str, Dict] = {}
        self._loaded = False
        self._lazy_load = lazy_load
        self._exclude_tools = exclude_tools or set()

        if not lazy_load:
            self._load_all_tools()

    def _load_all_tools(self) -> None:
        """Load and wrap all Strands tools."""
        if self._loaded:
            return

        try:
            # Import the main tools module
            from agents.Ron.tools import (
                FUNCTION_TOOLS,
                DICT_TOOLS,
                TOOL_SPECS,
                BROWSER_AVAILABLE,
                CODE_INTERPRETER_AVAILABLE,
                LocalChromiumBrowser,
                AgentCoreBrowser,
                AgentCoreCodeInterpreter,
                A2AClientToolProvider,
                AgentCoreMemoryToolProvider,
            )

            # Wrap function-based tools (@tool decorator)
            for tool in FUNCTION_TOOLS:
                if hasattr(tool, "__name__"):
                    name = tool.__name__
                    if name not in self._exclude_tools:
                        self._tools[name] = self._wrap_tool(tool, name)

            # Wrap dict-based tools (TOOL_SPEC pattern)
            for tool in DICT_TOOLS:
                if hasattr(tool, "__name__"):
                    name = tool.__name__
                    if name not in self._exclude_tools and name in TOOL_SPECS:
                        self._tools[name] = self._wrap_tool(tool, name)
                        self._tool_specs[name] = TOOL_SPECS[name]

            # Add browser tools if available
            if BROWSER_AVAILABLE:
                if "LocalChromiumBrowser" not in self._exclude_tools:
                    self._tools["local_browser"] = self._wrap_class_tool(
                        LocalChromiumBrowser, "local_browser"
                    )
                if "AgentCoreBrowser" not in self._exclude_tools:
                    self._tools["agent_browser"] = self._wrap_class_tool(
                        AgentCoreBrowser, "agent_browser"
                    )

            # Add code interpreter if available
            if CODE_INTERPRETER_AVAILABLE:
                if "AgentCoreCodeInterpreter" not in self._exclude_tools:
                    self._tools["code_interpreter"] = self._wrap_class_tool(
                        AgentCoreCodeInterpreter, "code_interpreter"
                    )

            self._loaded = True

        except ImportError as e:
            print(f"Warning: Could not load Strands tools: {e}")
            self._load_fallback_tools()

    def _load_fallback_tools(self) -> None:
        """Load tools directly from strands_tools if main import fails."""
        # Best-effort minimal toolset that should work in most environments.
        # Import tools individually so one missing optional dependency doesn't
        # nuke the entire registry.
        minimal_tools: list[Callable] = []
        for module, attr in [
            ("strands_tools.shell", "shell"),
            ("strands_tools.file_read", "file_read"),
            ("strands_tools.file_write", "file_write"),
            ("strands_tools.http_request", "http_request"),
            ("strands_tools.current_time", "current_time"),
            ("strands_tools.think", "think"),
            ("strands_tools.editor", "editor"),
            ("strands_tools.memory", "memory"),
            ("strands_tools.use_agent", "use_agent"),
            ("strands_tools.swarm", "swarm"),
            ("strands_tools.mcp_client", "mcp_client"),
            ("strands_tools.cron", "cron"),
            ("strands_tools.workflow", "workflow"),
        ]:
            try:
                tool = getattr(import_module(module), attr)
                if callable(tool):
                    minimal_tools.append(tool)
            except Exception:
                continue

        for tool in minimal_tools:
            if hasattr(tool, "__name__"):
                name = tool.__name__
                if name not in self._exclude_tools:
                    self._tools[name] = self._wrap_tool(tool, name)

        if self._tools:
            self._loaded = True
        else:
            print("Warning: Fallback tool loading failed: no tools could be imported")

    def _wrap_tool(self, tool: Callable, name: str) -> Callable:
        """Wrap a Strands tool for DSPy compatibility.

        Preserves docstring, signature, and handles errors gracefully.

        Args:
            tool: Original tool function
            name: Tool name

        Returns:
            Wrapped tool function
        """
        @wraps(tool)
        def wrapped_tool(**kwargs) -> str:
            """DSPy-compatible tool wrapper."""
            try:
                # Validate callable
                if not callable(tool):
                    return f"Error: {name} is not callable"

                # Call tool with error handling
                result = tool(**kwargs)

                # Ensure string output for DSPy
                if result is None:
                    return f"{name} completed successfully"
                elif isinstance(result, dict):
                    # Format dict results
                    if "error" in result:
                        return f"Error in {name}: {result['error']}"
                    elif "status" in result and result["status"] == "error":
                        return f"Error in {name}: {result.get('message', 'Unknown error')}"
                    elif "result" in result:
                        return str(result["result"])
                    return str(result)
                else:
                    return str(result)
            except TypeError as e:
                return f"Error in {name}: Invalid arguments - {str(e)}"
            except ValueError as e:
                return f"Error in {name}: Invalid value - {str(e)}"
            except Exception as e:
                return f"Error in {name}: {type(e).__name__}: {str(e)}"

        # Preserve docstring for tool description
        if hasattr(tool, '__doc__') and tool.__doc__:
            wrapped_tool.__doc__ = tool.__doc__
        else:
            wrapped_tool.__doc__ = f"Execute {name} tool"

        # Preserve function signature for introspection
        try:
            wrapped_tool.__signature__ = inspect.signature(tool)
        except (ValueError, TypeError):
            pass  # Some tools might not have inspectable signatures

        return wrapped_tool

    def _wrap_class_tool(self, tool_class: type, name: str) -> Callable:
        """Wrap a class-based tool provider.

        Args:
            tool_class: Tool provider class
            name: Tool name

        Returns:
            Factory function that creates and uses the tool
        """
        _instance = None

        def class_tool_wrapper(action: str = "default", **kwargs) -> str:
            """Class-based tool wrapper."""
            nonlocal _instance
            try:
                if _instance is None:
                    _instance = tool_class()

                # Try to call the action method
                if hasattr(_instance, action):
                    method = getattr(_instance, action)
                    result = method(**kwargs)
                elif hasattr(_instance, "__call__"):
                    result = _instance(action=action, **kwargs)
                else:
                    return f"Unknown action: {action}"

                return str(result) if result else f"{name}.{action} completed"
            except Exception as e:
                return f"Error in {name}: {str(e)}"

        class_tool_wrapper.__doc__ = (
            tool_class.__doc__ or f"Execute {name} tool operations"
        )
        return class_tool_wrapper

    def get_tool(self, name: str) -> Optional[Callable]:
        """Get a specific tool by name.

        Args:
            name: Tool name

        Returns:
            Wrapped tool function or None
        """
        if self._lazy_load and not self._loaded:
            self._load_all_tools()

        return self._tools.get(name)

    def get_all_tools(self) -> Dict[str, Callable]:
        """Get all wrapped tools.

        Returns:
            Dict mapping tool names to wrapped functions
        """
        if self._lazy_load and not self._loaded:
            self._load_all_tools()

        return self._tools.copy()

    def get_tools_by_category(self, category: str) -> Dict[str, Callable]:
        """Get tools by category.

        Args:
            category: Category name (core, browser, memory, agents, etc.)

        Returns:
            Dict of tools in that category
        """
        if self._lazy_load and not self._loaded:
            self._load_all_tools()

        if category not in self.CATEGORIES:
            return {}

        category_tools = {}
        for tool_name in self.CATEGORIES[category]:
            if tool_name in self._tools:
                category_tools[tool_name] = self._tools[tool_name]

        return category_tools

    def get_tool_names(self) -> List[str]:
        """Get list of all tool names.

        Returns:
            List of tool names
        """
        if self._lazy_load and not self._loaded:
            self._load_all_tools()

        return list(self._tools.keys())

    def get_tool_spec(self, name: str) -> Optional[Dict]:
        """Get TOOL_SPEC for a tool if available.

        Args:
            name: Tool name

        Returns:
            TOOL_SPEC dict or None
        """
        return self._tool_specs.get(name)

    def get_tool_description(self, name: str) -> str:
        """Get tool description from docstring.

        Args:
            name: Tool name

        Returns:
            Tool description string
        """
        tool = self.get_tool(name)
        if tool and tool.__doc__:
            # Get first line of docstring
            return tool.__doc__.split("\n")[0].strip()
        return f"Execute {name}"

    def get_tool_descriptions(self) -> Dict[str, str]:
        """Get descriptions for all tools.

        Returns:
            Dict mapping tool names to descriptions
        """
        return {name: self.get_tool_description(name) for name in self.get_tool_names()}


# Convenience functions for quick access

def get_all_strands_tools(exclude: Optional[Set[str]] = None) -> Dict[str, Callable]:
    """Get all Strands tools wrapped for DSPy.

    Args:
        exclude: Tool names to exclude

    Returns:
        Dict of all wrapped tools
    """
    wrapper = StrandsToolsWrapper(lazy_load=False, exclude_tools=exclude)
    return wrapper.get_all_tools()


def get_core_tools() -> Dict[str, Callable]:
    """Get core Strands tools (shell, file, http, etc.).

    Returns:
        Dict of core tools
    """
    wrapper = StrandsToolsWrapper()
    return wrapper.get_tools_by_category("core")


def get_agent_tools() -> Dict[str, Callable]:
    """Get agent-related tools (use_agent, swarm, workflow).

    Returns:
        Dict of agent tools
    """
    wrapper = StrandsToolsWrapper()
    return wrapper.get_tools_by_category("agents")


def get_memory_tools() -> Dict[str, Callable]:
    """Get memory-related tools (mem0, elasticsearch, etc.).

    Returns:
        Dict of memory tools
    """
    wrapper = StrandsToolsWrapper()
    return wrapper.get_tools_by_category("memory")


# Default instance for easy imports
_default_wrapper = None


def get_default_wrapper() -> StrandsToolsWrapper:
    """Get or create default wrapper instance.

    Returns:
        StrandsToolsWrapper singleton
    """
    global _default_wrapper
    if _default_wrapper is None:
        _default_wrapper = StrandsToolsWrapper()
    return _default_wrapper
