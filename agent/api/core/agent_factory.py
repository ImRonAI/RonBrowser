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
import ast
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
        attempt("strands_tools.load_tool", "load_tool", "load_tool")
        attempt("strands_tools.environment", "environment", "environment")
        attempt("strands_tools.mcp_client", "mcp_client", "mcp_client")
        attempt("strands_tools.use_agent", "use_agent", "use_agent")
        attempt("strands_tools.workflow", "workflow", "workflow")
        attempt("strands_tools.graph", "graph", "graph")
        attempt("strands_tools.swarm", "swarm", "swarm")
        attempt("strands_tools.batch", "batch", "batch")
        # keep tool_execute for catalog-driven execution without pre-loading
        attempt("strands_tools.tool_execute", "tool_execute", "tool_execute")

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
    def _has_tool_decorator(decorator: ast.AST) -> bool:
        if isinstance(decorator, ast.Name):
            return decorator.id == "tool"
        if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name):
            return decorator.func.id == "tool"
        return False

    @classmethod
    def _collect_decorated_tools_in_file(cls, file_path: Path) -> list[tuple[str, str]]:
        try:
            source = file_path.read_text(encoding="utf-8")
            tree = ast.parse(source)
        except Exception as exc:
            logger.debug("Skipping tool catalog seed for %s: %s", file_path, exc)
            return []

        tools: list[tuple[str, str]] = []
        seen_names: set[str] = set()
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if not any(cls._has_tool_decorator(decorator) for decorator in node.decorator_list):
                continue
            doc = ast.get_docstring(node) or ""
            summary = next((line.strip() for line in doc.splitlines() if line.strip()), "")
            if node.name in seen_names:
                continue
            seen_names.add(node.name)
            tools.append((node.name, summary))
        return tools

    @staticmethod
    def _escape_single_quotes(value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")

    @classmethod
    def _seed_external_tool_catalog(cls) -> None:
        if cls._external_catalog_seeded:
            return
        try:
            from strands_tools.tool_catalog_manager import get_tool_catalog_manager
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
            if "__pycache__" in file_path.parts:
                continue
            if file_path.name == "__init__.py" or file_path.name.startswith("test_"):
                continue

            decorated_tools = cls._collect_decorated_tools_in_file(file_path)
            if not decorated_tools:
                continue

            relative = file_path.relative_to(tool_root)
            category = relative.parts[0] if len(relative.parts) > 1 else relative.stem
            category = category.replace("-", "_").strip() or "strands_tools"

            escaped_path = cls._escape_single_quotes(str(file_path.resolve()))
            for tool_name, description in decorated_tools:
                escaped_name = cls._escape_single_quotes(tool_name)
                catalog.register_entry(
                    name=tool_name,
                    description=description or f"Tool from {file_path.name}",
                    input_schema={},
                    origin=f"{category}_pack",
                    category=category,
                    path=str(file_path.resolve()),
                    load_pathway=f"load_tool(path='{escaped_path}', name='{escaped_name}')",
                    execute_pathway=(
                        f"tool_execute(name='{escaped_name}', arguments={{...}}, "
                        f"load_path='{escaped_path}', load_if_missing=True)"
                    ),
                    unload_pathway=f"unload_tool(name='{escaped_name}')",
                )
                seeded_count += 1

        cls._external_catalog_seeded = True
        logger.info("Seeded external tool catalog entries: %d", seeded_count)

    @classmethod
    def _superagent_system_prompt(cls) -> str:
        """System prompt shared by standard and bidi superagent variants."""
        return """You are Ron SuperAgent, an advanced AI assistant with browser automation and tool use capabilities.

You have access to:
- Browser automation for web interaction
- File system operations
- Shell command execution
- HTTP requests
- Memory and journaling
- Tool catalog for discovery
- MCP client for external tools
- Multi-agent orchestration (swarm, graph, workflow)

Best practices:
- Use browser tools for web-based tasks
- Check memory for relevant context
- Log significant events to journal
- Use shell/editor for file operations
- Always cite sources when providing information
- Use multi-agent patterns for complex tasks
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

**CITATION PROTOCOL (MANDATORY):**
Every fact MUST have inline citations [1][2][3].
Example: "The study found 87% efficacy[1] with minimal side effects[2]."

**Optimal Workflow:**
1. Start with broad search to understand the topic
2. Deep dive into specific areas as needed
3. Synthesize all results with inline citations
4. Present final answer with complete source list

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

        tools.extend([cls._get_tool_by_name("think"), cls._get_tool_by_name("journal")])

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

## EXECUTION RULES
- Break complex tasks into manageable steps
- Track progress explicitly
- Report status regularly
- Complete all sub-tasks before finishing

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
