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
import importlib.util
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
    NVIDIA_NIM_API_KEY,
    OPENAI_API_KEY,
    OPENAI_ORGANIZATION,
    OPENAI_PROJECT,
    PRESERVE_RECENT_MESSAGES,
    SESSION_STORAGE_DIR,
    SLIDING_PER_TURN,
    SLIDING_TRUNCATE_TOOL_RESULTS,
    SLIDING_WINDOW_SIZE,
    SUPERAGENT_BIDI_GEMINI_VOICE,
    SUPERAGENT_BIDI_MODEL_ID,
    SUPERAGENT_BIDI_NOVA_VOICE,
    SUPERAGENT_BIDI_OPENAI_TIMEOUT_SECONDS,
    SUPERAGENT_BIDI_OPENAI_VOICE,
    SUPERAGENT_BIDI_PROVIDER,
    SUPERAGENT_BIDI_REQUIRE_PROVIDER,
    SUMMARY_RATIO,
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
    _SUPER_TEXT_AGENT_TYPE = "super_text"
    _SUPER_VOICE_AGENT_TYPE = "super_voice"
    _external_catalog_seeded = False
    @classmethod
    def _get_lock(cls, session_id: str) -> asyncio.Lock:
        """Get or create a lock for a session."""
        if session_id not in cls._locks:
            cls._locks[session_id] = asyncio.Lock()
        return cls._locks[session_id]

    @staticmethod
    def _normalize_interaction_mode(interaction_mode: str | None) -> str:
        """Normalize interaction mode to text/voice."""
        normalized = (interaction_mode or "text").strip().lower()
        return "voice" if normalized == "voice" else "text"

    @classmethod
    def _create_model(cls) -> LiteLLMModel:
        """Create the standard model configuration."""
        if not NVIDIA_NIM_API_KEY:
            raise ValueError("NVIDIA_NIM_API_KEY not configured")

        return LiteLLMModel(
            model_id="nvidia_nim/moonshotai/kimi-k2.5",
            client_args={
                "api_key": NVIDIA_NIM_API_KEY,
                "timeout": AGENT_TIMEOUT_SECONDS,
                "stream_timeout": AGENT_TIMEOUT_SECONDS,
                "extra_body": {"thinking": {"type": "enabled"}},
            },
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
    def _create_conversation_manager(cls) -> Any:
        """Create the configured Strands conversation manager."""
        manager_type = CONVERSATION_MANAGER_TYPE

        if manager_type == "null":
            return NullConversationManager()

        if manager_type == "summarizing":
            return SummarizingConversationManager(
                summary_ratio=SUMMARY_RATIO,
                preserve_recent_messages=PRESERVE_RECENT_MESSAGES,
            )

        if manager_type != "sliding":
            logger.warning(
                "Unknown CONVERSATION_MANAGER_TYPE=%s, falling back to sliding window",
                manager_type,
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
            conversation_manager=cls._create_conversation_manager(),
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

            get_tool_catalog_manager().register_tools(
                tools,
                origin="built-in",
                category="built_in",
            )
        except Exception as exc:
            logger.debug("Failed to sync tools with tool catalog: %s", exc)

    @staticmethod
    def _resolve_existing_path(candidates: tuple[Path, ...]) -> Path | None:
        for candidate in candidates:
            if candidate.exists() and candidate.is_dir():
                return candidate
        return None

    @staticmethod
    def _escape_single_quotes(value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")

    # Directories that should NEVER be imported during catalog seeding.
    # These contain non-tool files (servers, utilities, packages, docs, MCP servers, specs).
    _SEED_SKIP_DIRS: set[str] = {
        "__pycache__",
        "utils",
        "mcp",
        "open-api-specs",
        "api-documents",
        ".github",
        "workflows",
        # Residual package scaffolding (tools already moved to top level)
        "strands_fun_tools",
        "strands_google",
        "FDA",
        "perplexity",
        "pubmed ",          # Note: trailing space — that's the actual directory name
        "pubmed",
        # Sub-package dirs with __init__.py that should be imported via
        # their specific entry-point files, not by globbing every .py
        "browser",
        "code_interpreter",
    }

    # Filenames that should never be imported regardless of location.
    _SEED_SKIP_FILENAMES: set[str] = {
        "__init__.py",
        "__main__.py",
        "setup.py",
        "conftest.py",
        "__version__.py",
        "models.py",
    }

    @classmethod
    def _seed_external_tool_catalog(cls) -> None:
        if cls._external_catalog_seeded:
            return
        try:
            from strands_tools.tool_catalog_manager import get_tool_catalog_manager
            from strands.tools.decorator import DecoratedFunctionTool
        except Exception as exc:
            logger.debug("Tool catalog manager unavailable for external seeding: %s", exc)
            return

        catalog = get_tool_catalog_manager()
        seeded_count = 0

        tool_root = TOOLS_SRC_DIR
        if not tool_root.exists():
            cls._external_catalog_seeded = True
            return

        for file_path in sorted(tool_root.rglob("*.py")):
            # ── Skip entire directory trees ──
            if any(part in cls._SEED_SKIP_DIRS for part in file_path.relative_to(tool_root).parts[:-1]):
                continue

            # ── Skip known non-tool filenames ──
            if file_path.name in cls._SEED_SKIP_FILENAMES:
                continue
            if file_path.name.startswith("test_"):
                continue

            # ── Pre-scan: only import files that actually define tools ──
            try:
                source = file_path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if "@tool" not in source and "TOOL_SPEC" not in source:
                continue

            # ── Import module and discover DecoratedFunctionTool instances ──
            try:
                module_name = f"_catalog_seed_{file_path.stem}_{id(file_path)}"
                spec = importlib.util.spec_from_file_location(module_name, file_path)
                if spec is None or spec.loader is None:
                    continue
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
            except BaseException as exc:
                logger.debug("Skipping tool catalog seed for %s: %s", file_path, exc)
                continue

            relative = file_path.relative_to(tool_root)
            category = relative.parts[0] if len(relative.parts) > 1 else relative.stem
            category = category.replace("-", "_").strip() or "strands_tools"

            for attr_name in dir(module):
                attr = getattr(module, attr_name, None)
                if not isinstance(attr, DecoratedFunctionTool):
                    continue

                tool_name = attr_name
                tool_spec = attr.tool_spec
                description = tool_spec.get("description", f"Tool from {file_path.name}") if isinstance(tool_spec, dict) else f"Tool from {file_path.name}"

                # Extract and unwrap input schema
                input_schema = {}
                if isinstance(tool_spec, dict):
                    raw_schema = tool_spec.get("inputSchema") or tool_spec.get("input_schema") or {}
                    if isinstance(raw_schema, dict) and "json" in raw_schema and isinstance(raw_schema["json"], dict):
                        input_schema = raw_schema["json"]
                    elif isinstance(raw_schema, dict):
                        input_schema = raw_schema

                escaped_path = cls._escape_single_quotes(str(file_path.resolve()))
                escaped_name = cls._escape_single_quotes(tool_name)
                catalog.register_entry(
                    name=tool_name,
                    description=description,
                    input_schema=input_schema,
                    origin=f"{category}_pack",
                    category=category,
                    path=str(file_path.resolve()),
                    load_pathway=f"tool_catalog(action='load', name='{escaped_name}')",
                    execute_pathway=f"tool_catalog(action='execute', name='{escaped_name}', arguments={{...}})",
                    unload_pathway=f"tool_catalog(action='unload', name='{escaped_name}')",
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
- Browser automation (load 'browser' from catalog — uses browser/browser.py)
- Code execution (load 'electron_code_interpreter' from catalog — runs in Electron sandbox)
- File system operations (editor, shell, journal) — ALL operate inside the agent sandbox at ~/Library/Application Support/RonBrowser/agent-sandbox/. Paths are relative to the sandbox root. These tools NEVER touch the host project files.
- Memory (mem0_memory) for persistent context across conversations
- MCP client for external tool servers
- Multi-agent orchestration (use_agent, swarm, graph, workflow, batch)
- Tool catalog (tool_catalog) for discovering, loading, executing, and unloading tools

## Tool Catalog

tool_catalog is your single interface for the full tool lifecycle:

| Action | When to use | Example |
|--------|-------------|---------|
| list_categories | See all available tools with descriptions | tool_catalog(action='list_categories') |
| get_tool | Inspect a tool's full schema and details | tool_catalog(action='get_tool', name='perplexity_search') |
| execute | One-shot: load, run, unload automatically | tool_catalog(action='execute', name='perplexity_search', arguments={...}) |
| execute (parallel) | Run multiple tools concurrently | tool_catalog(action='execute', tools=[{name, arguments}, ...]) |
| load | Keep a tool available for repeated use | tool_catalog(action='load', name='perplexity_search') |
| unload | Remove a loaded tool when done | tool_catalog(action='unload', name='perplexity_search') |

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
- tool_catalog: For loading custom and catalog tools
- shell: For running shell commands (operates in agent sandbox)
- journal: For daily notes and task tracking (stores in agent sandbox)

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

**Critical**: Subagents inherit tools from your registry. If a subagent needs a tool like perplexity_search, you must load it first:
```
tool_catalog(action='load', name='perplexity_search')
use_agent(system_prompt='...', prompt='...', tools=['perplexity_search'])
tool_catalog(action='unload', name='perplexity_search')
```

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

## Best Practices
- Always cite sources when providing information
- Unload tools you no longer need to keep your registry clean
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
                        "agent_type": "super",
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
        interaction_mode: str = "text",
        tools: Optional[list[Any]] = None,
    ) -> AgentLike:
        """Create a super agent with the full tool suite."""
        resolved_tools = tools or cls._get_tools()
        mode = cls._normalize_interaction_mode(interaction_mode)

        if mode == "voice":
            if ENABLE_SUPERAGENT_BIDI:
                bidi_agent = cls._create_superagent_bidi(session_id=session_id, tools=resolved_tools)
                if bidi_agent is not None:
                    return bidi_agent
            else:
                logger.warning(
                    "Voice mode requested for session %s but ENABLE_SUPERAGENT_BIDI is disabled; using standard Agent",
                    session_id,
                )

        agent = cls._build_agent(
            session_id=session_id,
            agent_type="super",
            system_prompt=cls._superagent_system_prompt(),
            tools=resolved_tools,
            name="Ron SuperAgent",
            description="Advanced AI assistant with browser automation",
            agent_id_prefix="superagent",
        )
        logger.info("Created SuperAgent for session %s mode=%s", session_id, mode)
        return agent

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
        interaction_mode: str | None = None,
    ) -> AgentLike:
        """Get existing agent or create one for the session and type."""
        async with cls._get_lock(session_id):
            cache_type = agent_type
            mode = None
            if agent_type == "super":
                mode = cls._normalize_interaction_mode(interaction_mode)
                cache_type = cls._SUPER_VOICE_AGENT_TYPE if mode == "voice" else cls._SUPER_TEXT_AGENT_TYPE

            cache_key = f"{cache_type}:{session_id}"
            if cache_key in cls._agents:
                logger.debug("Reusing %s agent for session %s", cache_type, session_id)
                return cls._agents[cache_key]

            if agent_type == "super":
                agent = cls.create_superagent(session_id=session_id, interaction_mode=mode or "text")
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
                cls._agents.pop(f"{cls._SUPER_TEXT_AGENT_TYPE}:{session_id}", None)
                cls._agents.pop(f"{cls._SUPER_VOICE_AGENT_TYPE}:{session_id}", None)
            else:
                cache_key = f"{agent_type}:{session_id}"
                cls._agents.pop(cache_key, None)
            return

        for known_type in [cls._SUPER_TEXT_AGENT_TYPE, cls._SUPER_VOICE_AGENT_TYPE, "search", "task"]:
            cache_key = f"{known_type}:{session_id}"
            cls._agents.pop(cache_key, None)
