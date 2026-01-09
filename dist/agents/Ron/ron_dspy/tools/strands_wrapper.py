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
import asyncio
import importlib.util
from strands.types.tools import ToolContext


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
                    # LocalChromiumBrowser might need config
                    self._tools["local_browser"] = self._wrap_class_tool(
                        LocalChromiumBrowser, "local_browser", init_kwargs={}
                    )
                if "AgentCoreBrowser" not in self._exclude_tools:
                    # AgentCoreBrowser might need connection string or config
                    self._tools["agent_browser"] = self._wrap_class_tool(
                        AgentCoreBrowser, "agent_browser", init_kwargs={}
                    )

            # Add code interpreter if available
            if CODE_INTERPRETER_AVAILABLE:
                if "AgentCoreCodeInterpreter" not in self._exclude_tools:
                    # Code interpreter might need config
                    self._tools["code_interpreter"] = self._wrap_class_tool(
                        AgentCoreCodeInterpreter, "code_interpreter", init_kwargs={}
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

    def _load_module_tool(self, module_path: str) -> Optional[Callable]:
        """Load a module-based tool from a Python file.

        Module tools must have:
        1. TOOL_SPEC variable defining the tool
        2. Function with name matching TOOL_SPEC['name']

        Args:
            module_path: Path to the Python module

        Returns:
            Wrapped tool function or None
        """
        try:
            # Import the module
            spec = importlib.util.spec_from_file_location("tool_module", module_path)
            if not spec or not spec.loader:
                return None

            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Check for TOOL_SPEC
            if not hasattr(module, 'TOOL_SPEC'):
                return None

            tool_spec = module.TOOL_SPEC
            if 'name' not in tool_spec:
                return None

            tool_name = tool_spec['name']

            # Get the tool function
            if not hasattr(module, tool_name):
                return None

            tool_func = getattr(module, tool_name)

            # Create a wrapper that handles the Strands module tool signature
            def module_tool_wrapper(**kwargs):
                """Module tool wrapper that handles TOOL_SPEC format."""
                # Module tools receive a 'tool' dict as first arg
                tool_use = {
                    "toolUseId": f"tool-{tool_name}-{id(kwargs)}",
                    "input": kwargs
                }

                # Call the module tool
                result = tool_func(tool_use)

                # Handle the ToolResult format
                if isinstance(result, dict):
                    if result.get("status") == "error":
                        content = result.get("content", [])
                        if content and isinstance(content, list):
                            return content[0].get("text", "Error occurred")
                        return "Error occurred"
                    elif result.get("status") == "success":
                        content = result.get("content", [])
                        if content and isinstance(content, list):
                            for item in content:
                                if "text" in item:
                                    return item["text"]
                                elif "json" in item:
                                    return str(item["json"])
                        return f"{tool_name} completed"

                return str(result) if result else f"{tool_name} completed"

            # Set metadata
            module_tool_wrapper.__name__ = tool_name
            module_tool_wrapper.__doc__ = tool_spec.get('description', f"Execute {tool_name}")

            # Store the spec
            self._tool_specs[tool_name] = tool_spec

            return module_tool_wrapper

        except Exception as e:
            print(f"Error loading module tool from {module_path}: {e}")
            return None

    def load_tool_from_file(self, file_path: str) -> bool:
        """Load a tool from a Python file.

        Args:
            file_path: Path to the tool module

        Returns:
            True if tool was loaded successfully
        """
        tool = self._load_module_tool(file_path)
        if tool and hasattr(tool, '__name__'):
            name = tool.__name__
            if name not in self._exclude_tools:
                self._tools[name] = tool
                return True
        return False

    def _wrap_tool(self, tool: Callable, name: str) -> Callable:
        """Wrap a Strands tool for DSPy compatibility.

        Preserves docstring, signature, and handles errors gracefully.
        Properly includes toolUseId in responses.

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
                # Generate a unique tool use ID
                tool_use_id = f"tool-{name}-{id(kwargs)}"

                # Check if tool expects ToolContext
                sig = inspect.signature(tool)
                expects_context = any(
                    param.annotation.__name__ == 'ToolContext'
                    if hasattr(param.annotation, '__name__') else False
                    for param in sig.parameters.values()
                )

                if expects_context:
                    # Create minimal ToolContext for tools that need it
                    tool_context = ToolContext(
                        tool_use={"toolUseId": tool_use_id, "name": name, "input": kwargs},
                        messages=[],
                        system_prompt="",
                        model=None,
                        callback_handler=None,
                        agent=None,
                        invocation_state={}
                    )
                    # Find the context parameter name
                    context_param = None
                    for param_name, param in sig.parameters.items():
                        if hasattr(param.annotation, '__name__') and param.annotation.__name__ == 'ToolContext':
                            context_param = param_name
                            break

                    if context_param:
                        kwargs[context_param] = tool_context

                # Validate callable
                if not callable(tool):
                    return f"Error: {name} is not callable"

                # Check if tool is async
                if asyncio.iscoroutinefunction(tool):
                    # Run async tool in event loop
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    result = loop.run_until_complete(tool(**kwargs))
                else:
                    # Call sync tool normally
                    result = tool(**kwargs)

                # Handle ToolResult format with proper toolUseId
                if isinstance(result, dict):
                    # Check if it's already a ToolResult
                    if "toolUseId" in result and "status" in result:
                        # Properly formatted ToolResult
                        if result["status"] == "error":
                            content = result.get("content", [])
                            if content and isinstance(content, list):
                                for item in content:
                                    if "text" in item:
                                        return f"Error in {name}: {item['text']}"
                            return f"Error in {name}: Unknown error"
                        else:
                            # Success case
                            content = result.get("content", [])
                            if content and isinstance(content, list):
                                for item in content:
                                    if "text" in item:
                                        return item["text"]
                                    elif "json" in item:
                                        return str(item["json"])
                            return f"{name} completed successfully"
                    # Legacy format handling
                    elif "error" in result:
                        return f"Error in {name}: {result['error']}"
                    elif "status" in result and result["status"] == "error":
                        return f"Error in {name}: {result.get('message', 'Unknown error')}"
                    elif "result" in result:
                        return str(result["result"])
                    return str(result)
                elif result is None:
                    return f"{name} completed successfully"
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

    async def _wrap_async_tool(self, tool: Callable, name: str) -> Callable:
        """Wrap an async Strands tool for DSPy compatibility with streaming support.

        Handles async generators that yield intermediate results.
        """
        @wraps(tool)
        async def wrapped_async_tool(**kwargs):
            """DSPy-compatible async tool wrapper."""
            try:
                result = tool(**kwargs)

                # Check if it's an async generator (streaming tool)
                if hasattr(result, '__aiter__'):
                    # Collect all yielded values
                    streamed_values = []
                    async for value in result:
                        streamed_values.append(str(value))

                    # Return the final collected result
                    if streamed_values:
                        return " | ".join(streamed_values)
                    return f"{name} completed"

                # Regular async function
                elif asyncio.iscoroutine(result):
                    final_result = await result
                    if final_result is None:
                        return f"{name} completed successfully"
                    elif isinstance(final_result, dict):
                        if "error" in final_result:
                            return f"Error in {name}: {final_result['error']}"
                        elif "status" in final_result and final_result["status"] == "error":
                            return f"Error in {name}: {final_result.get('message', 'Unknown error')}"
                        elif "result" in final_result:
                            return str(final_result["result"])
                        return str(final_result)
                    else:
                        return str(final_result)

                # Fallback for non-async
                return str(result) if result else f"{name} completed"

            except Exception as e:
                return f"Error in {name}: {type(e).__name__}: {str(e)}"

        # Preserve metadata
        if hasattr(tool, '__doc__') and tool.__doc__:
            wrapped_async_tool.__doc__ = tool.__doc__
        else:
            wrapped_async_tool.__doc__ = f"Execute async {name} tool"

        try:
            wrapped_async_tool.__signature__ = inspect.signature(tool)
        except (ValueError, TypeError):
            pass

        return wrapped_async_tool

    def _wrap_class_tool(self, tool_class: type, name: str, init_args: tuple = (), init_kwargs: dict = None) -> Callable:
        """Wrap a class-based tool provider.

        Args:
            tool_class: Tool provider class
            name: Tool name
            init_args: Positional arguments for class constructor
            init_kwargs: Keyword arguments for class constructor

        Returns:
            Factory function that creates and uses the tool
        """
        _instance = None
        if init_kwargs is None:
            init_kwargs = {}

        def class_tool_wrapper(action: str = "default", **kwargs) -> str:
            """Class-based tool wrapper."""
            nonlocal _instance
            try:
                if _instance is None:
                    _instance = tool_class(*init_args, **init_kwargs)

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

    def _wrap_mcp_client(self, mcp_client, name: str = "mcp") -> Callable:
        """Wrap an MCP client for proper context management.

        MCP clients MUST be used within context managers per Strands docs.

        Args:
            mcp_client: MCPClient instance
            name: Tool name prefix

        Returns:
            Wrapper that enforces context management
        """
        def mcp_tool_wrapper(tool_name: str, **kwargs) -> str:
            """MCP tool wrapper with enforced context management."""
            try:
                # Ensure we're within the MCP client context
                with mcp_client:
                    # List available tools
                    tools = mcp_client.list_tools_sync()

                    # Find the requested tool
                    target_tool = None
                    for tool in tools:
                        if tool.name == tool_name or tool.name == f"{name}_{tool_name}":
                            target_tool = tool
                            break

                    if not target_tool:
                        return f"Error: Tool '{tool_name}' not found in MCP server"

                    # Execute the tool
                    tool_use_id = f"mcp-{name}-{tool_name}-{id(kwargs)}"
                    result = mcp_client.call_tool_sync(
                        tool_use_id=tool_use_id,
                        name=target_tool.name,
                        arguments=kwargs
                    )

                    # Parse result
                    if isinstance(result, dict):
                        content = result.get('content', [])
                        if content and isinstance(content, list):
                            for item in content:
                                if 'text' in item:
                                    return item['text']
                                elif 'json' in item:
                                    return str(item['json'])

                    return str(result) if result else f"{tool_name} completed"

            except Exception as e:
                return f"Error in MCP tool {tool_name}: {e}"

        mcp_tool_wrapper.__doc__ = f"Execute tools from {name} MCP server"
        return mcp_tool_wrapper

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
