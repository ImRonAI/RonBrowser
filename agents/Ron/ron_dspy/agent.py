"""Main RonAgent with full DSPy capabilities.

Complete DSPy ReAct agent with:
- Official `dspy.ReAct` for tool-using behavior
- Mem0 long-term memory with semantic search
 - Dataset export for fine-tuning open-weights models
- Playwright-Electron MCP browser automation
- Supabase task persistence
- Streaming support for SSE
- Dynamic Strands tools wrapping (50+ tools)
- Sub-agent spawning via use_agent/swarm

DISTILLATION WORKFLOW:
1. Run agent with Claude Opus 4.5 as teacher
2. Call agent.distill() to generate training traces
3. Finetune open-weights model (Llama, Mistral) on traces
4. Load finetuned model for cheaper inference
"""

import dspy
from pathlib import Path
from typing import Optional, Dict, Any, AsyncIterator, List
from .config import configure_bedrock_lm, configure_anthropic_lm, get_default_lm
from .modules.react_with_memory import ReActWithMemory
from .memory.mem0 import ConversationMemory, MemoryTools, MemoryConfig


class RonAgent:
    """DSPy ReAct agent with memory, optimization, and full tool suite.

    Features:
    - ReAct reasoning loop via official DSPy ReAct
    - Mem0 long-term memory (semantic search across sessions)
    - Playwright-Electron browser automation
    - Task management with Supabase persistence
    - 50+ Strands tools auto-wrapped
    - Sub-agent spawning
    - Distillation to open-weights models

    Example:
        >>> agent = RonAgent(enable_browser=True)
        >>> result = agent("Navigate to github.com and create a task to analyze repos")
        >>> print(result["response"])

        # Streaming
        >>> async for event in agent.stream("Take a screenshot"):
        ...     print(event)

        # Distillation
        >>> agent.distill(
        ...     training_data="training_data.json",
        ...     output_dir="distilled/",
        ...     student_model="meta-llama/Llama-3.1-8B-Instruct"
        ... )

        # Load distilled model
        >>> agent = RonAgent(optimized_path="distilled/teacher_traces.json")
    """

    def __init__(
        self,
        lm: Optional[dspy.LM] = None,
        optimized_path: Optional[str] = None,
        enable_browser: bool = True,
        enable_system: bool = True,
        enable_tasks: bool = True,
        enable_agents: bool = True,
        enable_memory_tools: bool = True,
        use_all_strands_tools: bool = True,
        max_iterations: int = 10,
        memory_config: Optional[MemoryConfig] = None,
    ):
        """Initialize RonAgent.

        Args:
            lm: Language model instance (default: auto-configured Bedrock)
            optimized_path: Path to load optimized/distilled weights from
            enable_browser: Enable Playwright-Electron browser tools
            enable_system: Enable shell/file/HTTP tools
            enable_tasks: Enable task management tools
            enable_agents: Enable sub-agent spawning tools
            enable_memory_tools: Enable explicit memory tools (store/search)
            use_all_strands_tools: Use dynamic Strands wrapper for all 50+ tools
            max_iterations: Max ReAct iterations per request
            memory_config: Mem0 configuration
        """
        # Configure DSPy LM
        self.lm = lm or get_default_lm()
        dspy.configure(lm=self.lm)

        # Initialize tool registry
        self.tools: Dict[str, callable] = {}

        # Load all Strands tools dynamically if enabled
        if use_all_strands_tools:
            self._init_strands_tools()
        else:
            # Manual tool initialization
            self._init_tools(enable_browser, enable_system, enable_tasks, enable_agents)

        # Initialize Mem0 memory
        self.memory_config = memory_config or MemoryConfig()
        self.memory = ConversationMemory(
            window_size=20,
            mem0_config=self.memory_config,
            persist_all=True,
        )

        # Add memory tools if enabled
        if enable_memory_tools:
            self._init_memory_tools()

        # Initialize ReAct module
        self.react = ReActWithMemory(
            tools=self.tools,
            max_iters=max_iterations,
            memory=self.memory,
        )

        # Load optimized/distilled weights if provided
        self._optimized = False
        if optimized_path and Path(optimized_path).exists():
            self.react.load(optimized_path)
            self._optimized = True

        # Browser connection state
        self._browser_connected = False
        self._browser_tools = None

    def _init_strands_tools(self) -> None:
        """Initialize all Strands tools via dynamic wrapper."""
        try:
            from .tools.strands_wrapper import get_all_strands_tools
            strands_tools = get_all_strands_tools()
            # If the wrapper loads but returns an empty registry, that usually means
            # missing Python deps (e.g. `strands-agents-tools` not installed) or a
            # broken import path. In that case, *force* fallback to manual tools.
            if not strands_tools:
                raise RuntimeError(
                    "Strands tools registry is empty (likely missing `strands-agents-tools` "
                    "and its dependencies)."
                )

            self.tools.update(strands_tools)
            print(f"Loaded {len(strands_tools)} Strands tools")
        except ImportError as e:
            print(f"Warning: Could not load Strands tools: {e}")
            # Fall back to manual initialization
            self._init_tools(True, True, True, True)
        except Exception as e:
            # Any other failure: fall back to manual initialization rather than
            # running the agent with a silently-empty toolset.
            print(f"Warning: Strands tool initialization failed: {e}")
            self._init_tools(True, True, True, True)

    def _init_memory_tools(self) -> None:
        """Initialize explicit memory tools for agent use."""
        try:
            memory_tools = MemoryTools(self.memory_config)
            self.tools.update({
                "store_memory": memory_tools.store_memory,
                "search_memories": memory_tools.search_memories,
                "get_all_memories": memory_tools.get_all_memories,
                "update_memory": memory_tools.update_memory,
                "delete_memory": memory_tools.delete_memory,
            })
        except Exception as e:
            print(f"Warning: Memory tools not available: {e}")

    def _init_tools(
        self,
        enable_browser: bool,
        enable_system: bool,
        enable_tasks: bool,
        enable_agents: bool,
    ) -> None:
        """Initialize tool registry manually (fallback mode)."""

        # System tools
        if enable_system:
            try:
                from .tools.system import SystemTools
                system = SystemTools()
                self.tools.update({
                    "run_shell": system.run_shell,
                    "read_file": system.read_file,
                    "write_file": system.write_file,
                    "fetch_url": system.fetch_url,
                    "list_directory": system.list_directory,
                    "search_files": system.search_files,
                })
            except ImportError as e:
                print(f"Warning: System tools not available: {e}")

        # Task tools
        if enable_tasks:
            try:
                from .tools.tasks import TaskTools
                tasks = TaskTools()
                self.tools.update({
                    "create_task": tasks.create_task,
                    "list_tasks": tasks.list_tasks,
                    "update_task": tasks.update_task,
                    "delete_task": tasks.delete_task,
                    "get_task": tasks.get_task,
                })
            except ImportError as e:
                print(f"Warning: Task tools not available: {e}")

        # Browser tools (Playwright-Electron MCP)
        if enable_browser:
            try:
                from .tools.browser import PlaywrightElectronMCP
                self._browser_tools = PlaywrightElectronMCP()
                self.tools.update({
                    "navigate": self._browser_tools.navigate,
                    "click": self._browser_tools.click,
                    "type_text": self._browser_tools.type_text,
                    "screenshot": self._browser_tools.screenshot,
                    "get_snapshot": self._browser_tools.get_snapshot,
                    "wait_for": self._browser_tools.wait_for,
                    "go_back": self._browser_tools.go_back,
                    "press_key": self._browser_tools.press_key,
                    "evaluate": self._browser_tools.evaluate,
                    "list_tabs": self._browser_tools.list_tabs,
                    "call_electron_api": self._browser_tools.call_electron_api,
                })
            except ImportError as e:
                print(f"Warning: Browser tools not available: {e}")

        # Agent tools
        if enable_agents:
            try:
                from .tools.agents import AgentTools
                agents = AgentTools()
                self.tools.update({
                    "spawn_agent": agents.spawn_agent,
                    "run_swarm": agents.run_swarm,
                    "delegate_research": agents.delegate_research,
                })
            except ImportError as e:
                print(f"Warning: Agent tools not available: {e}")

    def _ensure_browser(self) -> None:
        """Ensure Playwright-Electron MCP is connected."""
        if self._browser_tools and not self._browser_connected:
            self._browser_tools.connect()
            self._browser_connected = True

    def __call__(self, request: str) -> Dict[str, Any]:
        """Process a user request synchronously.

        Args:
            request: User's request/instruction

        Returns:
            Dict with:
                - response: Agent's response text
                - reasoning: Agent's thought process
                - tool_calls: List of tools called with results
                - iterations: Number of reasoning iterations
        """
        # Ensure browser connected if available
        self._ensure_browser()

        # Run ReAct
        result = self.react(request=request)

        return {
            "response": result.response,
            "reasoning": result.reasoning,
            "tool_calls": result.tool_calls,
            "iterations": result.iterations,
        }

    async def stream(self, request: str) -> AsyncIterator[Dict[str, Any]]:
        """Process request with streaming output.

        Note: DSPy `ReAct` runs the full trajectory internally, so this stream
        replays the trajectory after completion (preserving the public event
        schema without relying on deprecated/nonexistent DSPy APIs).

        Args:
            request: User's request

        Yields:
            Event dicts for streaming
        """
        self._ensure_browser()

        # Kick off the run (this will also update memory via ReActWithMemory).
        yield {"type": "thinking", "iteration": 1}
        try:
            result = self.react(request=request)
        except Exception as e:
            yield {"type": "error", "content": f"Reasoning error: {str(e)}"}
            return

        tool_calls_made: List[Dict[str, Any]] = getattr(result, "tool_calls", []) or []

        # Replay trajectory as streaming events.
        for tc in tool_calls_made:
            thought = tc.get("thought") or ""
            if thought:
                yield {"type": "thought", "content": thought}

            yield {
                "type": "tool_call",
                "tool": tc.get("tool", ""),
                "args": tc.get("args", {}),
                "reasoning": tc.get("thought", ""),
            }

            if "error" in tc:
                yield {"type": "tool_error", "tool": tc.get("tool", ""), "error": tc.get("error", "")}
            else:
                yield {"type": "tool_result", "tool": tc.get("tool", ""), "result": str(tc.get("result", ""))}

        yield {
            "type": "final_answer",
            "content": getattr(result, "response", ""),
            "tool_calls": tool_calls_made,
            "iterations": getattr(result, "iterations", 0),
        }

    # =========================================================================
    # DISTILLATION METHODS
    # =========================================================================

    def distill(
        self,
        training_data: str,
        output_dir: str,
        teacher_model: str = "claude-opus-4-5-20250929",
        student_model: str = "meta-llama/Llama-3.1-8B-Instruct",
    ) -> Dict[str, Any]:
        """Distill agent to smaller open-weights model.

        Exports an SFT dataset by running the agent with a teacher model and
        saving (request, response) pairs along with optional trajectory metadata.

        Args:
            training_data: Path to training examples JSON
            output_dir: Directory for output files
            teacher_model: Large model for generating traces
            student_model: Target model for distillation

        Returns:
            Dict with traces_path, dataset_path, recommendations
        """
        from .optimization.trainer import distill_to_open_weights

        return distill_to_open_weights(
            self.react,
            training_data,
            output_dir,
            teacher_model=teacher_model,
            student_model=student_model,
        )

    def optimize(
        self,
        training_data_path: str,
        output_path: str,
        method: str = "bootstrap_finetune",
    ) -> None:
        """Optimize agent using training examples.

        Args:
            training_data_path: Path to training examples JSON
            output_path: Path to save optimized module
            method: 'bootstrap_finetune', 'bootstrap', or 'bootstrap_random'
        """
        from .optimization.trainer import optimize_agent

        self.react = optimize_agent(
            self.react,
            training_data_path,
            output_path,
            method=method,
        )
        self._optimized = True

    def evaluate(self, test_data_path: str) -> Dict[str, Any]:
        """Evaluate agent on test set.

        Args:
            test_data_path: Path to test examples JSON

        Returns:
            Dict with score and details
        """
        from .optimization.trainer import evaluate_agent

        return evaluate_agent(self.react, test_data_path)

    # =========================================================================
    # MEMORY METHODS
    # =========================================================================

    def reset_memory(self) -> None:
        """Clear short-term conversation memory."""
        self.memory.clear()

    def clear_all_memory(self) -> None:
        """Clear both short-term and long-term Mem0 memory."""
        self.memory.clear_all()

    def store_insight(self, insight: str, categories: Optional[List[str]] = None) -> str:
        """Store an insight to long-term memory.

        Args:
            insight: Information to remember
            categories: Optional category tags

        Returns:
            Storage confirmation
        """
        return self.memory.store_insight(insight, categories)

    def recall(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Recall relevant memories.

        Args:
            query: What to recall
            limit: Max results

        Returns:
            List of relevant memories
        """
        return self.memory.recall(query, limit)

    # =========================================================================
    # TOOL METHODS
    # =========================================================================

    def get_tool_names(self) -> List[str]:
        """Get list of available tool names."""
        return list(self.tools.keys())

    def add_tool(self, name: str, func: callable) -> None:
        """Add a custom tool to the agent.

        WARNING: Adding tools after optimization may affect performance.
        Consider re-optimizing or creating a new agent instance.

        Args:
            name: Tool name
            func: Tool function (must have docstring)
        """
        if not func.__doc__:
            raise ValueError(f"Tool {name} must have a docstring")

        self.tools[name] = func
        # Update tools (will warn if optimized)
        self.react.set_tools(self.tools)

    def remove_tool(self, name: str) -> bool:
        """Remove a tool from the agent.

        WARNING: Removing tools after optimization may cause errors
        if the optimized prompts reference the removed tool.

        Args:
            name: Tool name to remove

        Returns:
            True if removed, False if not found
        """
        if name in self.tools:
            del self.tools[name]
            self.react.set_tools(self.tools)
            return True
        return False

    # =========================================================================
    # PROPERTIES
    # =========================================================================

    @property
    def is_optimized(self) -> bool:
        """Check if agent is using optimized/distilled weights."""
        return self._optimized

    @property
    def conversation_history(self) -> List[Dict[str, Any]]:
        """Get conversation history."""
        return self.memory.messages.copy()

    @property
    def tool_count(self) -> int:
        """Get number of available tools."""
        return len(self.tools)
