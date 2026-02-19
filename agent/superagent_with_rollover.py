"""Ron Superagent with Context Rollover - Auto-spawns new agent when context exhausted."""
import json
import os
import hashlib
from pathlib import Path
from typing import Optional, Any, Dict, Callable, List
from dataclasses import dataclass, field
from dotenv import load_dotenv
import logging
import time

load_dotenv(Path(__file__).parent.parent / ".env")
# os.environ["BYPASS_TOOL_CONSENT"] = "true"  # Safety: Do not bypass tool consent in production
# os.environ["STRANDS_NON_INTERACTIVE"] = "true"  # Safety: Allow interaction if needed

import sys
sys.path.append(str(Path(__file__).parent / "tools" / "src"))

from strands import Agent, tool
from strands.models.litellm import LiteLLMModel
from strands.agent.conversation_manager import SlidingWindowConversationManager
from strands.session import FileSessionManager
from strands.hooks import HookProvider, HookRegistry, AfterModelCallEvent, AfterInvocationEvent
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

from strands_tools.tool_catalog import tool_catalog
from strands_tools import mcp_client, mem0_memory, use_agent, batch, swarm, graph, workflow
from strands_tools.utils.models.model import create_model, get_provider_config

logger = logging.getLogger(__name__)

# Configuration
MAX_CONTEXT_TOKENS = int(os.getenv("SUPERAGENT_MAX_CONTEXT_TOKENS", "120000"))  # ~80% of 200k
ROLLOVER_THRESHOLD = int(os.getenv("SUPERAGENT_ROLLOVER_THRESHOLD", "100000"))
MCP_SERVERS_DIR = Path(__file__).parent / "tools" / "mcp"
VENV_PYTHON = Path(__file__).parent.parent / "venv" / "bin" / "python"


@dataclass
class AgentState:
    """State that persists across agent rollovers."""
    original_task: str = ""
    accumulated_findings: List[str] = field(default_factory=list)
    completed_subtasks: List[str] = field(default_factory=list)
    key_decisions: List[str] = field(default_factory=list)
    open_blockers: List[str] = field(default_factory=list)
    tool_registry_state: Dict[str, Any] = field(default_factory=dict)
    mcp_servers_loaded: List[str] = field(default_factory=list)
    rollover_count: int = 0
    
    def to_summary(self) -> str:
        """Generate concise summary for new agent's system prompt."""
        sections = []
        
        if self.original_task:
            sections.append(f"## ORIGINAL TASK\n{self.original_task}")
        
        if self.accumulated_findings:
            sections.append(f"## KEY FINDINGS ({len(self.accumulated_findings)} items)\n" + 
                          "\n".join(f"- {f}" for f in self.accumulated_findings[-10:]))  # Last 10
        
        if self.completed_subtasks:
            sections.append(f"## COMPLETED ({len(self.completed_subtasks)} items)\n" +
                          "\n".join(f"✓ {s}" for s in self.completed_subtasks[-5:]))
        
        if self.key_decisions:
            sections.append(f"## DECISIONS MADE\n" +
                          "\n".join(f"→ {d}" for d in self.key_decisions[-5:]))
        
        if self.open_blockers:
            sections.append(f"## OPEN BLOCKERS\n" +
                          "\n".join(f"⚠ {b}" for b in self.open_blockers))
        
        sections.append(f"## CONTEXT INFO\n"
                       f"- This is ROLLOVER #{self.rollover_count}\n"
                       f"- Previous context was summarized above\n"
                       f"- Continue from where the previous agent left off")
        
        return "\n\n".join(sections)


class ContextRolloverHook(HookProvider):
    """
    Monitors context usage and triggers rollover when approaching limits.
    
    Uses token estimation based on message content to detect when
    context window is near exhaustion.
    """
    
    def __init__(self, threshold_tokens: int = ROLLOVER_THRESHOLD, max_tokens: int = MAX_CONTEXT_TOKENS):
        self.threshold_tokens = threshold_tokens
        self.max_tokens = max_tokens
        self.should_rollover = False
        self.estimated_tokens = 0
        
    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(AfterModelCallEvent, self._check_context_size)
        
    def _estimate_tokens(self, messages: List[Dict]) -> int:
        """Rough token estimation (4 chars ≈ 1 token)."""
        total = 0
        for msg in messages:
            content = msg.get("content", [])
            if isinstance(content, str):
                total += len(content) // 4
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and "text" in item:
                        total += len(item["text"]) // 4
        return total
    
    def _check_context_size(self, event: AfterModelCallEvent) -> None:
        """Check if we're approaching context limits."""
        if not event.agent or not event.agent.messages:
            return
            
        self.estimated_tokens = self._estimate_tokens(event.agent.messages)
        
        if self.estimated_tokens > self.threshold_tokens:
            logger.warning(f"Context threshold reached: ~{self.estimated_tokens} tokens. Triggering rollover.")
            self.should_rollover = True


class RolloverSuperAgent:
    """
    Wrapper that manages agent instances with automatic rollover on context exhaustion.
    
    When context approaches limits, spawns a new agent with:
    - Fresh context window
    - State summary injected into system prompt
    - Same tools and configuration
    - Seamless continuation
    """
    
    def __init__(
        self,
        session_id: Optional[str] = None,
        callback_handler: Optional[Callable[..., Any]] = None,
        rollover_threshold: int = ROLLOVER_THRESHOLD,
    ):
        self.session_id = session_id or f"ron-{int(time.time())}"
        self.callback_handler = callback_handler
        self.rollover_threshold = rollover_threshold
        self.state = AgentState()
        
        # Track agent instances
        self._current_agent: Optional[Agent] = None
        self._rollover_hook: Optional[ContextRolloverHook] = None
        self._agent_instances: List[Agent] = []  # Keep refs for cleanup
        
        # MCP state
        self._mcp_clients: Dict[str, Dict[str, Any]] = {}
        
        # Initialize first agent
        self._spawn_new_agent()
    
    def _create_rollover_aware_prompt(self, base_prompt: str) -> str:
        """Inject state summary into system prompt for rollovers."""
        if self.state.rollover_count == 0:
            return base_prompt
        
        state_summary = self.state.to_summary()
        return f"""{base_prompt}

{'=' * 60}
## CONTINUATION CONTEXT (ROLLOVER #{self.state.rollover_count})
{'=' * 60}

{state_summary}

{'=' * 60}
## INSTRUCTIONS FOR CONTINUATION
{'=' * 60}

You are continuing work from a previous agent instance that ran out of context.
The summary above captures the essential state. Your job:

1. Review the ORIGINAL TASK, KEY FINDINGS, and COMPLETED items
2. Address any OPEN BLOCKERS
3. Continue execution WITHOUT repeating completed work
4. Use tools to verify state if needed (check files, etc.)
5. Mark new findings and completions as you go

Do NOT say "I see the previous agent..." - just continue the work seamlessly.
"""
    
    def _get_tools(self) -> List[Any]:
        """Get the standard tool set."""
        return [
            tool_catalog,
            mcp_client,
            mem0_memory,
            use_agent,
            batch,
            swarm,
            graph,
            workflow,
            self._create_load_mcp_server_tool(),
            self._create_unload_mcp_server_tool(),
        ]
    
    def _create_load_mcp_server_tool(self):
        """Create load_mcp_server tool with access to self."""
        available_servers = {
            "telnyx": (str(VENV_PYTHON), ["-m", "telnyx_mcp_server"]),
            "playwright": (
                "node",
                [str(MCP_SERVERS_DIR / "mcp-playwright" / "dist" / "index.js"),
                 "--electron-mode", "electron",
                 "--electron-bridge-url", "http://127.0.0.1:9231"],
            ),
        }
        
        @tool
        async def load_mcp_server(server_id: str) -> str:
            """Load an MCP server's tools into your registry."""
            if server_id not in available_servers:
                return f"Unknown server. Available: {list(available_servers.keys())}"
            
            if server_id in self._mcp_clients:
                self.state.mcp_servers_loaded.append(server_id)
                return f"{server_id} already loaded"
            
            cmd, args = available_servers[server_id]
            env = os.environ.copy()
            client = MCPClient(lambda cmd=cmd, args=args, env=env: 
                             stdio_client(StdioServerParameters(command=cmd, args=args, env=env)))
            
            if self._current_agent:
                tools_before = set(self._current_agent.tool_registry.registry.keys())
                self._current_agent.tool_registry.process_tools([client])
                tools_after = set(self._current_agent.tool_registry.registry.keys())
                added_tools = list(tools_after - tools_before)
                
                self._mcp_clients[server_id] = {"client": client, "tool_names": added_tools}
                self.state.mcp_servers_loaded.append(server_id)
                return f"Loaded {server_id}: {added_tools}"
            
            return "Error: No active agent"
        
        return load_mcp_server
    
    def _create_unload_mcp_server_tool(self):
        """Create unload_mcp_server tool."""
        @tool
        def unload_mcp_server(server_id: str) -> str:
            """Unload an MCP server and remove its tools."""
            if server_id not in self._mcp_clients:
                return f"Server {server_id} not loaded"
            
            client_data = self._mcp_clients[server_id]
            client = client_data["client"]
            tool_names = client_data["tool_names"]
            
            if self._current_agent:
                for name in tool_names:
                    if name in self._current_agent.tool_registry.registry:
                        del self._current_agent.tool_registry.registry[name]
            
            client.stop(None, None, None)
            del self._mcp_clients[server_id]
            
            if server_id in self.state.mcp_servers_loaded:
                self.state.mcp_servers_loaded.remove(server_id)
            
            return f"Unloaded {server_id}"
        
        return unload_mcp_server
    
    def _spawn_new_agent(self) -> Agent:
        """Create a new agent instance with current state."""
        if self._current_agent:
            logger.info(f"Rollover #{self.state.rollover_count}: Extracting state from previous agent")
            self._extract_state_from_agent(self._current_agent)
        
        self.state.rollover_count += 1
        logger.info(f"Spawning new agent instance #{self.state.rollover_count}")
        
        # Create rollover hook for this instance
        self._rollover_hook = ContextRolloverHook(
            threshold_tokens=self.rollover_threshold,
            max_tokens=MAX_CONTEXT_TOKENS
        )
        
        model = self._create_primary_model()
        system_prompt = self._create_rollover_aware_prompt(SUPERAGENT_SYSTEM_PROMPT)
        
        agent = Agent(
            model=model,
            tools=self._get_tools(),
            callback_handler=self.callback_handler,
            system_prompt=system_prompt,
            agent_id=f"ron-superagent-{self.state.rollover_count}",
            name=f"Ron Superagent (Instance {self.state.rollover_count})",
            description="Meta-tooling orchestrator with context rollover",
            session_manager=FileSessionManager(
                session_id=f"{self.session_id}-{self.state.rollover_count}",
                storage_dir=str(Path(__file__).parent.parent / ".sessions")
            ),
            conversation_manager=SlidingWindowConversationManager(
                window_size=20,
                should_truncate_results=True
            ),
            hooks=[self._rollover_hook],
        )
        
        self._current_agent = agent
        self._agent_instances.append(agent)
        
        # Restore MCP servers from previous state
        self._restore_mcp_servers()
        
        return agent
    
    def _extract_state_from_agent(self, agent: Agent):
        """Extract relevant state from agent before rollover."""
        # In a real implementation, you might parse the conversation history
        # or have tools that explicitly update state
        # For now, we keep the state that was tracked externally
        pass
    
    def _restore_mcp_servers(self):
        """Reload MCP servers that were active in previous instance."""
        # This would need to be implemented based on your MCP client needs
        pass
    
    def _create_primary_model(self):
        """Create the main model."""
        provider = os.getenv("SUPERAGENT_PROVIDER", "nvidia_nim")
        model_override = os.getenv("SUPERAGENT_MODEL_ID")
        
        if provider == "nvidia_nim":
            model_id = model_override or "nvidia_nim/moonshotai/kimi-k2.5"
            return LiteLLMModel(
                model_id=model_id,
                client_args={"api_key": os.getenv("NVIDIA_NIM_API_KEY")},
                params={"temperature": 1.0, "max_tokens": 200000}
            )
        
        config = get_provider_config(provider)
        if model_override:
            config["model_id"] = model_override
        return create_model(provider=provider, config=config)
    
    def invoke(self, message: str, **kwargs) -> Any:
        """
        Invoke the agent with automatic rollover handling.
        
        If context threshold is reached during execution, automatically:
        1. Spawns new agent with fresh context
        2. Injects state summary into system prompt
        3. Continues the task
        """
        # Track original task on first invocation
        if self.state.rollover_count == 1 and not self.state.original_task:
            self.state.original_task = message
        
        max_rollovers = kwargs.pop('max_rollovers', 3)
        full_response = []
        
        for attempt in range(max_rollovers):
            logger.info(f"Agent invocation attempt {attempt + 1}/{max_rollovers}")
            
            try:
                response = self._current_agent(message, **kwargs)
                full_response.append(str(response))
                
                # Check if rollover was triggered
                if self._rollover_hook and self._rollover_hook.should_rollover:
                    logger.info("Rollover triggered - spawning new agent instance")
                    self._spawn_new_agent()
                    message = "Continue from where you left off. Review the context summary in your system prompt."
                    continue
                
                # Normal completion
                return "\n".join(full_response) if full_response else response
                
            except Exception as e:
                if "max_tokens" in str(e).lower() or "context" in str(e).lower():
                    logger.warning(f"Context exhaustion detected: {e}")
                    if attempt < max_rollovers - 1:
                        self._spawn_new_agent()
                        message = "Continue from where you left off. Review the context summary in your system prompt."
                        continue
                raise
        
        return "\n".join(full_response)
    
    async def stream_async(self, message: str, **kwargs):
        """Stream with rollover awareness."""
        # Similar logic for streaming - simplified for example
        async for event in self._current_agent.stream_async(message, **kwargs):
            yield event
            
            # Check if rollover needed (would need more sophisticated handling in real impl)
            if self._rollover_hook and self._rollover_hook.should_rollover:
                # Signal rollover needed - actual implementation would be more complex
                break


# Base system prompt
SUPERAGENT_SYSTEM_PROMPT = """You are Ron, an autonomous meta-tooling agent...
"""  # (Same as before, truncated for brevity)


# Usage example
if __name__ == "__main__":
    # Create rollover-aware agent
    agent = RolloverSuperAgent()
    
    # This will automatically handle rollovers during long tasks
    result = agent.invoke("Do a very long analysis that might exhaust context...")
    print(result)
