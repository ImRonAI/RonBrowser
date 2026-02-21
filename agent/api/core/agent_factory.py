"""
Agent factory using Strands-native runtime features.

Uses:
- Agent.stream_async() and the built-in agent loop
- BidiAgent start/send/receive/stop for superagent real-time loop
- FileSessionManager for persistence
- ConversationManager variants (sliding/summarizing/null)
- HookProvider pipeline for lifecycle telemetry and guardrails
- Optional experimental steering via LLMSteeringHandler
- ModelRetryStrategy for transient provider failures
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
import time
from typing import TYPE_CHECKING, Any, Dict, Optional

os.environ.setdefault("BYPASS_TOOL_CONSENT", "true")

from strands import Agent
from strands.agent.conversation_manager import (
    NullConversationManager,
    SlidingWindowConversationManager,
    SummarizingConversationManager,
)
from strands.event_loop._retry import ModelRetryStrategy
from strands.models.litellm import LiteLLMModel
from strands.session import FileSessionManager

try:
    from strands.experimental.bidi.agent.agent import BidiAgent as _RuntimeBidiAgent
except Exception as _bidi_import_error:  # pragma: no cover - runtime optional dependency
    _RuntimeBidiAgent = None
else:
    _bidi_import_error = None

from agent.api.core.config import (
    AGENT_TIMEOUT_SECONDS,
    ALLOW_SUPERAGENT_BIDI_PROVIDER_FALLBACK,
    AWS_REGION,
    CONVERSATION_MANAGER_TYPE,
    ENABLE_SUPERAGENT_BIDI,
    GOOGLE_API_KEY,
    NVIDIA_NIM_ENABLE_THINKING,
    NVIDIA_NIM_API_KEY,
    NVIDIA_NIM_MODEL_ID,
    OPENAI_API_KEY,
    OPENAI_ORGANIZATION,
    OPENAI_PROJECT,
    PRESERVE_RECENT_MESSAGES,
    SESSION_STORAGE_DIR,
    SLIDING_PER_TURN,
    SLIDING_TRUNCATE_TOOL_RESULTS,
    SLIDING_WINDOW_SIZE,
    SEARCH_CONVERSATION_MANAGER_TYPE,
    SUPERAGENT_BIDI_GEMINI_VOICE,
    SUPERAGENT_BIDI_MODEL_ID,
    SUPERAGENT_BIDI_NOVA_VOICE,
    SUPERAGENT_BIDI_OPENAI_TIMEOUT_SECONDS,
    SUPERAGENT_BIDI_OPENAI_VOICE,
    SUPERAGENT_BIDI_PROVIDER,
    SUPERAGENT_BIDI_REQUIRE_PROVIDER,
    SUPER_CONVERSATION_MANAGER_TYPE,
    SUMMARY_RATIO,
    TASK_CONVERSATION_MANAGER_TYPE,
    TOOLS_SRC_DIR,
)
from agent.api.core.hooks import build_agent_hooks

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from strands.experimental.bidi.agent.agent import BidiAgent

    AgentLike = Agent | BidiAgent
else:
    AgentLike = Agent


class AgentFactory:
    """Session-scoped factory for all Ron agent types."""

    _agents: Dict[str, AgentLike] = {}
    _locks: Dict[str, asyncio.Lock] = {}
    _SUPER_AGENT_TYPE = "super"
    _SUPER_BIDI_AGENT_TYPE = "super_bidi"
    _external_catalog_seeded = False

    _SEED_SKIP_FILENAMES: set[str] = {
        "__init__.py", "__main__.py", "setup.py", "conftest.py",
        "__version__.py", "models.py",
    }

    @classmethod
    def _get_lock(cls, session_id: str) -> asyncio.Lock:
        """Get or create a lock for a session."""
        if session_id not in cls._locks:
            cls._locks[session_id] = asyncio.Lock()
        return cls._locks[session_id]

    @classmethod
    def _create_model(cls) -> LiteLLMModel:
        """Create the standard model configuration."""
        if not NVIDIA_NIM_API_KEY:
            raise ValueError("NVIDIA_NIM_API_KEY not configured")

        client_args: dict[str, Any] = {
            "api_key": NVIDIA_NIM_API_KEY,
            "timeout": AGENT_TIMEOUT_SECONDS,
            "stream_timeout": AGENT_TIMEOUT_SECONDS,
        }
        if NVIDIA_NIM_ENABLE_THINKING:
            # Optional advanced reasoning mode. This can increase first-token latency significantly.
            client_args["extra_body"] = {"thinking": {"type": "enabled"}}

        return LiteLLMModel(
            model_id=NVIDIA_NIM_MODEL_ID,
            client_args=client_args,
            params={
                "temperature": 1.0,
                "max_tokens": 200000,
            },
        )

    @classmethod
    def _create_session_manager(cls, session_id: str) -> FileSessionManager:
        """Create file-based session manager."""
        SESSION_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        return FileSessionManager(
            session_id=session_id,
            storage_dir=str(SESSION_STORAGE_DIR),
        )

    @classmethod
    def _conversation_manager_type_for_agent(cls, agent_type: str) -> str:
        if agent_type == "super":
            return SUPER_CONVERSATION_MANAGER_TYPE or CONVERSATION_MANAGER_TYPE
        if agent_type == "search":
            return SEARCH_CONVERSATION_MANAGER_TYPE or CONVERSATION_MANAGER_TYPE
        if agent_type == "task":
            return TASK_CONVERSATION_MANAGER_TYPE or CONVERSATION_MANAGER_TYPE
        return CONVERSATION_MANAGER_TYPE

    @classmethod
    def _create_conversation_manager(cls, agent_type: str) -> Any:
        """Create the configured Strands conversation manager."""
        manager_type = cls._conversation_manager_type_for_agent(agent_type)

        if manager_type == "null":
            return NullConversationManager()

        if manager_type == "summarizing":
            return SummarizingConversationManager(
                summary_ratio=SUMMARY_RATIO,
                preserve_recent_messages=PRESERVE_RECENT_MESSAGES,
            )

        if manager_type != "sliding":
            logger.warning(
                "Unknown conversation manager type=%s for agent_type=%s, falling back to sliding window",
                manager_type,
                agent_type,
            )

        return SlidingWindowConversationManager(
            window_size=SLIDING_WINDOW_SIZE,
            should_truncate_results=SLIDING_TRUNCATE_TOOL_RESULTS,
            per_turn=SLIDING_PER_TURN,
        )

    @classmethod
    def _create_retry_strategy(cls) -> ModelRetryStrategy:
        """Create retry strategy for resilience."""
        return ModelRetryStrategy(
            max_attempts=6,
            initial_delay=4,
            max_delay=240,
        )

    @classmethod
    def _create_hooks(cls, model: Any) -> list[Any]:
        """Create hook providers from config."""
        hooks = build_agent_hooks(model=model)
        hook_names = [hook.__class__.__name__ for hook in hooks]
        logger.info("Configured hooks: %s", hook_names if hook_names else "none")
        return hooks

    @classmethod
    def _build_agent(
        cls,
        *,
        session_id: str,
        agent_type: str,
        system_prompt: str,
        tools: list[Any],
        name: str,
        description: str,
        agent_id_prefix: str,
    ) -> Agent:
        """Create an agent with consistent Strands-native configuration."""
        model = cls._create_model()
        hooks = cls._create_hooks(model)

        return Agent(
            model=model,
            system_prompt=system_prompt,
            tools=tools,
            callback_handler=None,
            conversation_manager=cls._create_conversation_manager(agent_type),
            session_manager=cls._create_session_manager(session_id),
            retry_strategy=cls._create_retry_strategy(),
            hooks=hooks,
            state={
                "session_id": session_id,
                "agent_type": agent_type,
                "created_at_epoch": time.time(),
            },
            agent_id=f"{agent_id_prefix}-{session_id}",
            name=name,
            description=description,
        )

    @classmethod
    def _get_tools(cls) -> list[Any]:
        """Get available tools for agents."""
        tools: list[Any] = []

        def attempt(module_path: str, attr_name: str, label: str | None = None):
            try:
                module = __import__(module_path, fromlist=[attr_name])
                tools.append(getattr(module, attr_name))
            except Exception as exc:
                logger.warning("Failed to load %s: %s", label or attr_name, exc)

        attempt("strands_tools.tool_catalog", "tool_catalog", "tool_catalog")
        attempt("strands_tools.mem0_memory", "mem0_memory", "mem0_memory")
        attempt("strands_tools.editor", "editor", "editor")
        attempt("strands_tools.shell", "shell", "shell")
        attempt("strands_tools.environment", "environment", "environment")
        attempt("strands_tools.mcp_client", "mcp_client", "mcp_client")
        attempt("strands_tools.use_agent", "use_agent", "use_agent")
        attempt("strands_tools.workflow", "workflow", "workflow")
        attempt("strands_tools.graph", "graph", "graph")
        attempt("strands_tools.swarm", "swarm", "swarm")
        attempt("strands_tools.batch", "batch", "batch")

        # Class-based tools: these require instantiation, can't be loaded
        # dynamically from the catalog via process_tools(). They use relative
        # imports and @tool on instance methods, so they must be created here.
        try:
            from strands_tools.browser import LocalChromiumBrowser
            browser_instance = LocalChromiumBrowser()
            tools.append(browser_instance.browser)
        except Exception as exc:
            logger.warning("Failed to load browser tool: %s", exc)

        try:
            from strands_tools.code_interpreter import LocalCodeInterpreter
            sandbox_root = os.getenv("RON_AGENT_SANDBOX_ROOT", "")
            workspace = os.path.join(sandbox_root, "code_workspace") if sandbox_root else None
            interp_instance = LocalCodeInterpreter(workspace_dir=workspace)
            tools.append(interp_instance.code_interpreter)
        except Exception as exc:
            logger.warning("Failed to load code_interpreter tool: %s", exc)

        cls._sync_tools_with_catalog(tools)
        cls._seed_external_tool_catalog()
        return tools

    @classmethod
    def _sync_tools_with_catalog(cls, tools: list[Any]) -> None:
        """Register currently available tools in the shared tool catalog."""
        if not tools:
            return
        try:
            from strands_tools.tool_catalog_manager import get_tool_catalog_manager

            catalog = get_tool_catalog_manager()
            catalog.register_tools(
                tools,
                origin="built-in",
                category="built_in",
            )

            # Class-based tools (browser, code_interpreter) have wrong path
            # from _extract_tool_path (returns decorator.py).  Fix them with
            # explicit entries so the catalog has the real source paths and
            # module paths for correct loading.
            tool_root = TOOLS_SRC_DIR
            _class_tool_overrides = {
                "browser": {
                    "path": str(tool_root / "browser" / "browser.py"),
                    "module_path": "strands_tools.browser.browser",
                    "note": "class-based; already loaded as built-in",
                },
                "code_interpreter": {
                    "path": str(tool_root / "code_interpreter" / "code_interpreter.py"),
                    "module_path": "strands_tools.code_interpreter.code_interpreter",
                    "note": "class-based; already loaded as built-in",
                },
            }
            for tool_obj in tools:
                tool_name = getattr(tool_obj, "tool_name", None)
                if tool_name in _class_tool_overrides:
                    override = _class_tool_overrides[tool_name]
                    catalog.register_entry(
                        name=tool_name,
                        description=catalog.get_tool_details(tool_name).get("description", "") if catalog.get_tool_details(tool_name) else "",
                        input_schema=None,  # preserve existing from register_tools
                        origin="built-in",
                        category="built_in",
                        path=override["path"],
                        module_path=override["module_path"],
                        load_pathway="already_loaded (built-in)",
                        execute_pathway=f"Direct call: agent.tool.{tool_name}(...)",
                        unload_pathway=f"tool_catalog(action='unload', name='{tool_name}')",
                    )
        except Exception as exc:
            logger.debug("Failed to sync tools with tool catalog: %s", exc)

    @classmethod
    def _seed_external_tool_catalog(cls) -> None:
        """Import each tool module and register DecoratedFunctionTool instances.

        The @tool decorator already has everything — name, description, full
        inputSchema.  We just import the module, find the decorated tools, and
        hand them to catalog.register_tool() which reads .tool_spec directly.
        """
        if cls._external_catalog_seeded:
            return
        try:
            from strands_tools.tool_catalog_manager import get_tool_catalog_manager
            from strands.tools.decorator import DecoratedFunctionTool
        except Exception as exc:
            logger.debug("Tool catalog manager unavailable for external seeding: %s", exc)
            return

        import importlib

        catalog = get_tool_catalog_manager()
        seeded_count = 0
        tool_root = TOOLS_SRC_DIR

        if not tool_root.exists():
            cls._external_catalog_seeded = True
            return

        for file_path in sorted(tool_root.glob("*.py")):
            if file_path.name in cls._SEED_SKIP_FILENAMES or file_path.name.startswith("test_"):
                continue
            try:
                source = file_path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if "@tool" not in source and "TOOL_SPEC" not in source:
                continue

            module_path = "strands_tools." + file_path.stem
            try:
                module = importlib.import_module(module_path)
            except Exception as exc:
                logger.debug("Skipping catalog seed for %s: %s", module_path, exc)
                continue

            for attr_name in dir(module):
                attr = getattr(module, attr_name, None)
                if not isinstance(attr, DecoratedFunctionTool):
                    continue
                catalog.register_tool(
                    tool_obj=attr,
                    origin="strands_tools",
                    category=file_path.stem,
                )
                seeded_count += 1

        cls._external_catalog_seeded = True
        logger.info("Seeded external tool catalog entries: %d", seeded_count)

    @classmethod
    def _superagent_system_prompt(cls) -> str:
        """System prompt shared by standard and bidi superagent variants."""
        return """You are Ron SuperAgent, an advanced AI assistant with browser automation and tool use capabilities.

Use all available tools implicitly as needed without being explicitly told. Always use tools instead of suggesting code that would perform the same operations. Proactively identify when tasks can be completed using available tools.

You have access to:
- Browser automation (browser) — already loaded as a built-in tool, use directly via agent.tool.browser(...)
- Code execution (code_interpreter) — already loaded as a built-in tool, runs in sandbox workspace
- File system operations (editor, shell) — ALL operate inside the agent sandbox at ~/Library/Application Support/RonBrowser/agent-sandbox/. Paths are relative to the sandbox root. These tools NEVER touch the host project files.
- Memory (mem0_memory) for persistent context across conversations
- MCP client for external tool servers
- Multi-agent orchestration (use_agent, swarm, graph, workflow, batch)
- Tool catalog (tool_catalog) for discovering, loading, executing, and unloading additional tools from the catalog

## Tool Catalog

tool_catalog is your single interface for the full tool lifecycle:

| Action | When to use | Example |
|--------|-------------|---------|
| list_categories | See all available tools with descriptions | tool_catalog(action='list_categories') |
| get_tool | Inspect a tool's full schema and details | tool_catalog(action='get_tool', name='perplexity_search_api') |
| execute | One-shot: load, run, unload automatically | tool_catalog(action='execute', name='perplexity_search_api', arguments={...}) |
| execute (parallel) | Run multiple tools concurrently | tool_catalog(action='execute', tools=[{name, arguments}, ...]) |
| load | Keep a tool available for repeated use | tool_catalog(action='load', name='perplexity_search_api') |
| unload | Remove a loaded tool when done | tool_catalog(action='unload', name='perplexity_search_api') |

Use **execute** for one-off tool calls. Use **load/unload** when calling a tool multiple times or when assigning tools to subagents.

## Meta-Tooling

### TOOL NAMING CONVENTION:
- The tool name (function name) MUST match the file name without the extension
- Example: For file "tool_name.py", use tool name "tool_name"

### TOOL CREATION vs. TOOL USAGE:
- CAREFULLY distinguish between requests to CREATE a new tool versus USE an existing tool
- When a user asks a question like "reverse hello world" or "count abc", first check if an appropriate tool already exists before creating a new one
- If an appropriate tool already exists, use it directly instead of creating a redundant tool
- Only create a new tool when the user explicitly requests one with phrases like "create", "make a tool", etc.

### TOOL CREATION PROCESS:
- Name the file "tool_name.py" where "tool_name" is a human readable name
- Name the function in the file the SAME as the file name (without extension)
- The "name" parameter in the TOOL_SPEC MUST match the name of the file (without extension)
- Include detailed docstrings explaining the tool's purpose and parameters
- After creating a tool, announce "TOOL_CREATED: <filename>" to track successful creation

### TOOL USAGE:
- Use existing tools with appropriate parameters
- Provide a clear explanation of the result

### TOOL STRUCTURE
When creating a tool, follow this exact structure:

```python
from typing import Any
from strands.types.tools import ToolUse, ToolResult

TOOL_SPEC = {
    "name": "tool_name",  # Must match function name
    "description": "What the tool does",
    "inputSchema": {  # Exact capitalization required
        "json": {
            "type": "object",
            "properties": {
                "param_name": {
                    "type": "string",
                    "description": "Parameter description"
                }
            },
            "required": ["param_name"]
        }
    }
}

def tool_name(tool_use: ToolUse, **kwargs: Any) -> ToolResult:
    tool_use_id = tool_use["toolUseId"]
    param_value = tool_use["input"]["param_name"]

    result = param_value  # Replace with actual processing

    return {
        "toolUseId": tool_use_id,
        "status": "success",
        "content": [{"text": f"Result: {result}"}]
    }
```

Critical requirements:
1. Use "inputSchema" (not input_schema) with "json" wrapper
2. Function must access parameters via tool_use["input"]["param_name"]
3. Return dict must use "toolUseId" (not tool_use_id)
4. Content must be a list of objects: [{"text": "message"}]

### AUTONOMOUS TOOL CREATION WORKFLOW

When asked to create a tool:
1. Generate the complete Python code for the tool following the structure above
2. Use the editor tool to write the code directly to a file named "tool_name.py"
3. Use tool_catalog(action='load', name='tool_name') to dynamically load the newly created tool
4. After loading, report the exact tool name and path you created
5. Confirm when the tool has been created and loaded

Always extract your own code and write it to files without waiting for further instructions.

Always use the following tools when appropriate:
- editor: For writing code to files and file editing operations (operates in agent sandbox)
- tool_catalog: For loading additional catalog tools (list_categories first to see what's available)
- shell: For running shell commands (operates in agent sandbox)
- browser: For web browsing and automation (already loaded, use directly)
- code_interpreter: For executing code in sandbox (already loaded, use directly)

You should detect user intents to create tools from natural language (like "create a tool that...", "build a tool for...", etc.) and handle the creation process automatically.

## Multi-Agent Orchestration

Before creating subagents, always follow this reasoning process:

1. **Understand the task**: What is being asked? What are the requirements and constraints?
2. **Choose the formation**: If no specific formation was requested, decide which fits best:
   - **use_agent**: Single specialist subagent for a focused task
   - **swarm**: Multiple autonomous agents that coordinate dynamically
   - **graph**: Agents connected in a DAG with explicit data flow between nodes
   - **workflow**: Sequential pipeline where each stage feeds the next
   - **batch**: Same task run in parallel across multiple inputs
3. **Design each agent's role**: What specific purpose does each agent serve? What unique perspective or capability does it bring?
4. **Determine context**: What information does each agent need to succeed? Provide relevant context in the user prompt.
5. **Load required tools**: You MUST load any catalog tools into yourself BEFORE creating subagents. Subagents can only use tools that exist in your (the parent) tool registry. Call tool_catalog(action='load', name='...') for each tool a subagent will need.
6. **Craft prompts**: Write a precise system prompt defining the agent's role, constraints, and output format. Write a user prompt with the specific task and all necessary context.

**Critical**: Subagents inherit tools from your registry. If a subagent needs a catalog tool like perplexity_search_api, you must load it first:
```
tool_catalog(action='load', name='perplexity_search_api')
use_agent(system_prompt='...', prompt='...', tools=['perplexity_search_api'])
tool_catalog(action='unload', name='perplexity_search_api')
```

Built-in tools (browser, code_interpreter, editor, shell, mem0_memory, etc.) are already in your registry and do NOT need to be loaded from the catalog. Subagents can reference them by name directly.

## Memory (mem0_memory)

All agent types (SuperAgent, Search Agent, Task Agent) share the same memory pool. This ensures consistent context across the entire system regardless of which agent is active.

**REQUIRED: Always provide BOTH agent_id and user_id on every mem0_memory call.**
- agent_id="ron" — always. All agents share this identity so memories are unified across SuperAgent, Search Agent, and Task Agent.
- user_id=the actual user's identifier (username, email, or user ID from the application context). This system serves multiple users — memories must be scoped to the correct user.

Every mem0_memory call must include both parameters:
- Store: mem0_memory(action='store', content='...', agent_id='ron', user_id='<user_identifier>')
- Retrieve: mem0_memory(action='retrieve', query='...', agent_id='ron', user_id='<user_identifier>')
- List: mem0_memory(action='list', agent_id='ron', user_id='<user_identifier>')

Always check memory at the start of a conversation for relevant prior context.

## Browser Automation

Be decisive. Do not over-complicate browser interactions. When you take a screenshot, look at it and determine all the moves you can make before you need another screenshot. Then do those actions quickly and with confidence. Then take another screenshot, and again ask yourself: what can I do before the next screenshot? Repeat.

## Best Practices
- Always cite sources when providing information
- Unload tools you no longer need to keep your registry clean

## Planning and Todo Lists

When given a multi-step task, you should always use the emit_plan tool to create a plan that the user will approve or deny. The emit_plan tool displays a collapsible plan card in the UI.

Once your plan is approved, use the emit_queue tool to create a todo list that provides transparency on the steps you are going to take. As you complete todo items, update the todo list via emit_queue with action='update' to mark items as completed.

Available tools:
- emit_plan(title, description, steps, footer): Display a plan in the UI
- emit_queue(items, label, action, item_id, completed): Display or update a todo list
"""

    @classmethod
    def _bidi_superagent_system_prompt(cls) -> str:
        """Voice-specialized prompt that preserves superagent parity."""
        return (
            cls._superagent_system_prompt()
            + """

Voice/Bidi nuances:
- Operate as the same SuperAgent while optimizing for real-time, multimodal interaction.
- Keep responses interruption-friendly and concise when speaking.
- Confirm critical tool actions before execution when user intent is ambiguous.
"""
        )

    @classmethod
    def _bidi_provider_order(cls) -> list[str]:
        supported = ("openai", "gemini", "nova")
        configured = SUPERAGENT_BIDI_PROVIDER

        if configured == "auto":
            return list(supported)

        if configured not in supported:
            logger.warning(
                "Unsupported SUPERAGENT_BIDI_PROVIDER=%s; falling back to auto order",
                configured,
            )
            return list(supported)

        if not ALLOW_SUPERAGENT_BIDI_PROVIDER_FALLBACK:
            return [configured]

        return [configured, *[provider for provider in supported if provider != configured]]

    @classmethod
    def _create_bidi_model_for_provider(cls, provider: str) -> Any:
        model_id = SUPERAGENT_BIDI_MODEL_ID or None

        if provider == "openai":
            if not OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is required for SUPERAGENT_BIDI_PROVIDER=openai")

            from strands.experimental.bidi.models.openai_realtime import BidiOpenAIRealtimeModel

            client_config: dict[str, Any] = {
                "api_key": OPENAI_API_KEY,
                "timeout_s": SUPERAGENT_BIDI_OPENAI_TIMEOUT_SECONDS,
            }
            if OPENAI_ORGANIZATION:
                client_config["organization"] = OPENAI_ORGANIZATION
            if OPENAI_PROJECT:
                client_config["project"] = OPENAI_PROJECT

            kwargs: dict[str, Any] = {}
            if model_id:
                kwargs["model_id"] = model_id

            return BidiOpenAIRealtimeModel(
                provider_config={"audio": {"voice": SUPERAGENT_BIDI_OPENAI_VOICE}},
                client_config=client_config,
                **kwargs,
            )

        if provider == "gemini":
            if not GOOGLE_API_KEY:
                raise ValueError("GOOGLE_API_KEY is required for SUPERAGENT_BIDI_PROVIDER=gemini")

            from strands.experimental.bidi.models.gemini_live import BidiGeminiLiveModel

            kwargs = {}
            if model_id:
                kwargs["model_id"] = model_id

            return BidiGeminiLiveModel(
                provider_config={"audio": {"voice": SUPERAGENT_BIDI_GEMINI_VOICE}},
                client_config={"api_key": GOOGLE_API_KEY},
                **kwargs,
            )

        if provider == "nova":
            if not AWS_REGION:
                raise ValueError("AWS_REGION is required for SUPERAGENT_BIDI_PROVIDER=nova")

            from strands.experimental.bidi.models.nova_sonic import BidiNovaSonicModel

            kwargs = {}
            if model_id:
                kwargs["model_id"] = model_id

            return BidiNovaSonicModel(
                provider_config={"audio": {"voice": SUPERAGENT_BIDI_NOVA_VOICE}},
                client_config={"region": AWS_REGION},
                **kwargs,
            )

        raise ValueError(f"Unsupported bidi provider: {provider}")

    @classmethod
    def _create_superagent_bidi(
        cls,
        session_id: str,
        tools: list[Any],
    ) -> AgentLike | None:
        if _RuntimeBidiAgent is None:
            message = "BidiAgent runtime is unavailable"
            if _bidi_import_error is not None:
                message = f"{message}: {_bidi_import_error}"
            if SUPERAGENT_BIDI_REQUIRE_PROVIDER:
                raise RuntimeError(message)
            logger.warning("%s", message)
            return None

        errors: dict[str, str] = {}

        for provider in cls._bidi_provider_order():
            try:
                model = cls._create_bidi_model_for_provider(provider)
                hooks = cls._create_hooks(model=model)
                session_manager = cls._create_session_manager(session_id)

                bidi_tools = list(tools)
                try:
                    from strands.experimental.bidi.tools import stop_conversation

                    bidi_tools.append(stop_conversation)
                except Exception as exc:
                    logger.warning("Failed to load stop_conversation tool for bidi superagent: %s", exc)

                agent = _RuntimeBidiAgent(
                    model=model,
                    system_prompt=cls._bidi_superagent_system_prompt(),
                    tools=bidi_tools,
                    hooks=hooks,
                    session_manager=session_manager,
                    state={
                        "session_id": session_id,
                        "agent_type": "super_bidi",
                        "loop_type": "bidi",
                        "bidi_provider": provider,
                        "created_at_epoch": time.time(),
                    },
                    agent_id=f"superagent-{session_id}",
                    name="Ron SuperAgent",
                    description="Advanced AI assistant with browser automation",
                )
                logger.info("Created Bidi SuperAgent for session %s using provider=%s", session_id, provider)
                return agent
            except Exception as exc:
                errors[provider] = str(exc)
                logger.warning("Failed to initialize bidi superagent provider=%s: %s", provider, exc)

        if SUPERAGENT_BIDI_REQUIRE_PROVIDER:
            raise RuntimeError(f"Unable to initialize bidi superagent with providers={errors}")

        logger.warning("Falling back to standard Agent superagent after bidi failures=%s", errors)
        return None

    @classmethod
    def create_superagent(
        cls,
        session_id: str,
        tools: Optional[list[Any]] = None,
    ) -> Agent:
        """Create a text-first SuperAgent with the full tool suite."""
        resolved_tools = tools or cls._get_tools()
        agent = cls._build_agent(
            session_id=session_id,
            agent_type="super",
            system_prompt=cls._superagent_system_prompt(),
            tools=resolved_tools,
            name="Ron SuperAgent",
            description="Advanced AI assistant with browser automation",
            agent_id_prefix="superagent",
        )
        logger.info("Created SuperAgent for session %s", session_id)
        return agent

    @classmethod
    def create_super_bidi_agent(
        cls,
        session_id: str,
        tools: Optional[list[Any]] = None,
    ) -> AgentLike:
        """Create a dedicated Bidi SuperAgent that shares the SuperAgent toolkit/state."""
        resolved_tools = tools or cls._get_tools()
        if ENABLE_SUPERAGENT_BIDI:
            bidi_agent = cls._create_superagent_bidi(session_id=session_id, tools=resolved_tools)
            if bidi_agent is not None:
                logger.info("Created Super BidiAgent for session %s", session_id)
                return bidi_agent
        logger.warning(
            "Bidi requested for session %s but unavailable; falling back to standard SuperAgent",
            session_id,
        )
        return cls.create_superagent(session_id=session_id, tools=resolved_tools)

    @classmethod
    def create_search_agent(cls, session_id: str) -> Agent:
        """Create a search-specialized agent."""
        system_prompt = """You are Ron Search Agent. You coordinate comprehensive search using available tools.

**Primary Capabilities:**
- Web search via HTTP requests
- Deep research for comprehensive analysis
- Multi-source synthesis with citations

**Memory:**
Always provide BOTH agent_id="ron" AND user_id=<the actual user's identifier> on every mem0_memory call. This shared agent_id keeps you aligned with SuperAgent and Task Agent, and the user_id scopes memories to the correct user. Check memory before starting research for relevant prior context.

**CITATION PROTOCOL (MANDATORY):**
Every fact MUST have inline citations [1][2][3].
Example: "The study found 87% efficacy[1] with minimal side effects[2]."

**Optimal Workflow:**
1. Check memory for relevant prior context on the topic
2. Start with broad search to understand the topic
3. Deep dive into specific areas as needed
4. Synthesize all results with inline citations
5. Store key findings in memory for future reference
6. Present final answer with complete source list

Always prioritize accuracy and cite sources.
"""

        tools: list[Any] = []

        try:
            from strands_tools.http_request import http_request

            tools.append(http_request)
        except Exception:
            pass

        try:
            from strands_tools.tavily import tavily_search

            tools.append(tavily_search)
        except Exception:
            pass

        try:
            from strands_tools.mcp_client import mcp_client

            tools.append(mcp_client)
        except Exception:
            pass

        try:
            from strands_tools.mem0_memory import mem0_memory

            tools.append(mem0_memory)
        except Exception:
            pass

        tools.extend([cls._get_tool_by_name("think")])

        agent = cls._build_agent(
            session_id=session_id,
            agent_type="search",
            system_prompt=system_prompt,
            tools=[tool for tool in tools if tool is not None],
            name="Ron Search Agent",
            description="Specialized agent for web search and research",
            agent_id_prefix="search",
        )
        logger.info("Created SearchAgent for session %s", session_id)
        return agent

    @classmethod
    def create_task_agent(cls, session_id: str) -> Agent:
        """Create a project-manager task agent."""
        system_prompt = """You are Ron Task Agent - the Project Manager.

## PROJECT MANAGER ROLE
You are responsible for:
- Translating requests into clear tasks and deliverables
- Keeping a live execution plan with statuses
- Proactively identifying blockers and dependencies
- Ensuring all tasks are completed before stopping
- Escalating missing info immediately

## MEMORY
Always provide BOTH agent_id="ron" AND user_id=<the actual user's identifier> on every mem0_memory call. This shared agent_id keeps you aligned with SuperAgent and Search Agent, and the user_id scopes memories to the correct user. Check memory before starting any task for relevant prior context, user preferences, and previous work.

## EXECUTION RULES
- Break complex tasks into manageable steps
- Track progress explicitly
- Report status regularly
- Complete all sub-tasks before finishing
- Store important outcomes and decisions in memory for future reference

You have the same tool access as SuperAgent for execution.
"""

        agent = cls._build_agent(
            session_id=session_id,
            agent_type="task",
            system_prompt=system_prompt,
            tools=cls._get_tools(),
            name="Ron Task Agent",
            description="Project Manager agent for task execution",
            agent_id_prefix="task",
        )
        logger.info("Created TaskAgent for session %s", session_id)
        return agent

    @classmethod
    def _get_tool_by_name(cls, name: str) -> Any:
        """Get a tool by name."""
        try:
            if name == "think":
                from strands_tools.think import think

                return think
            if name == "journal":
                from strands_tools.journal import journal

                return journal
        except Exception:
            return None
        return None

    @classmethod
    async def get_or_create_agent(
        cls,
        session_id: str,
        agent_type: str = "super",
    ) -> AgentLike:
        """Get existing agent or create one for the session and type."""
        async with cls._get_lock(session_id):
            cache_key = f"{agent_type}:{session_id}"
            if cache_key in cls._agents:
                logger.debug("Reusing %s agent for session %s", agent_type, session_id)
                return cls._agents[cache_key]

            if agent_type == "super":
                agent = cls.create_superagent(session_id=session_id)
            elif agent_type == "super_bidi":
                agent = cls.create_super_bidi_agent(session_id=session_id)
            elif agent_type == "search":
                agent = cls.create_search_agent(session_id)
            elif agent_type == "task":
                agent = cls.create_task_agent(session_id)
            else:
                raise ValueError(f"Unknown agent type: {agent_type}")

            cls._agents[cache_key] = agent
            return agent

    @classmethod
    def clear_agent(cls, session_id: str, agent_type: Optional[str] = None) -> None:
        """Clear cached agent(s) for a session."""
        if agent_type:
            if agent_type == "super":
                cls._agents.pop(f"{cls._SUPER_AGENT_TYPE}:{session_id}", None)
                cls._agents.pop(f"{cls._SUPER_BIDI_AGENT_TYPE}:{session_id}", None)
            else:
                cache_key = f"{agent_type}:{session_id}"
                cls._agents.pop(cache_key, None)
            return

        for known_type in [cls._SUPER_AGENT_TYPE, cls._SUPER_BIDI_AGENT_TYPE, "search", "task"]:
            cache_key = f"{known_type}:{session_id}"
            cls._agents.pop(cache_key, None)
