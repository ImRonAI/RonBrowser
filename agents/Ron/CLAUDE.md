# Ron Agent Rebuild: "The Strands Evolution"
## 1. Introduction & Vision
**Goal:** Rebuild the "Ron" Super Agent (currently `ron_agents/claude`) into a pure **Strands Agent**.
**Objective:** Higher performance, lower latency, cleaner architecture, and enhanced scalability.
**Philosophy:** "Everything is a Strand." Eliminate ad-hoc wrappers, monolithic tool files, and hardcoded dependency checks in favor of a dynamic, graph-based agent architecture.
The current implementation interacts with `aiobotocore` directly and manages tools through a 2700+ line `tools.py` file with dozens of `try/except` import guards. This is brittle and slow to load. The new design will leverage the Strands framework's native capabilities for tool discovery, lifecycle management, and efficient execution.
## 2. Current Implementation Analysis (Critique)
### 2.1. `completions.py` (The Brain)
*   **Current State:** "By the book" `aiobotocore` implementation. Handles streaming, tool interleaving, and Bedrock headers manually.
*   **Inefficiencies:**
    *   **Complexity:** Manual handling of event stream parsing (SSE events) and reconstruction of message blocks.
    *   **Coupling:** Tightly coupled to specific tool implementations (`native_tool_executor`, `computer_handler`).
    *   **Boilerplate:** Excessive boilerplate for connection management and beta header construction.
*   **Strands Solution:** Use `strands.Agent` which abstracts the model interaction loop while preserving async streaming capabilities.
### 2.2. `tools/tools.py` (The Toolbox)
*   **Current State:** A monolithic file (~2.7k lines) acting as a registry for *every* possible tool.
*   **Inefficiencies:**
    *   **Import Hell:** Dozens of `try/except ImportError` blocks. This slows down startup and makes debugging import failures difficult (failures are swallowed).
    *   **Global State:** Relies on global variables (`VISION_STREAMING_AVAILABLE`, `computer_handler`) to check feature availability.
    *   **Mixed Metaphors:** Mixes direct function calls, HTTP requests, and complex agent delegations (e.g., `ask_clinical_ops`).
*   **Strands Solution:** A decentralized **Tool Registry**. Tools should be standalone modules loaded dynamically by the Strands framework based on the agent's active profile.
### 2.3. Tool Execution
*   **Current State:** `_execute_tool` in `completions.py` is a giant `if/elif/else` switch statement.
*   **Inefficiencies:**
    *   **Maintenance Nightmare:** Adding a new tool requires modifying the core execution loop.
    *   **Latency:** All tools are loaded into memory at startup, even if unused.
*   **Strands Solution:** The **Graph** execution model. Tools are nodes or edges in an execution graph. The agent resolves the tool from its registry and executes it without a central switch statement.
## 3. The New Architecture: "Ron" (Strands Edition)
### 3.1. Directory Structure
We will move away from the flat, cluttered structure to a modular, domain-driven design.
```text
backend/ron_agents/ron/
├── core/
│   ├── __init__.py
│   ├── agent.py               # Main Strands Agent definition (The "Ron" class)
│   ├── configuration.py       # Configuration and Environment handling
│   └── streaming.py           # Optimized SSE streaming adapter for AI SDK v5
├── memory/
│   ├── __init__.py
│   ├── short_term.py          # Session context
│   └── long_term.py           # Vector/Database integration
├── tools/
│   ├── __init__.py            # Dynamic Tool Registry (Auto-discovery)
│   ├── core/                  # Essential tools (File, Shell, REPL)
│   │   ├── system.py
│   │   └── coding.py
│   ├── integrations/          # External services (Browser, AWS, GitHub)
│   │   ├── browser_use_v2.py
│   │   └── mcp_client.py
│   └── specialized/           # Domain specific (Clinical, Legal)
│       ├── fda.py
│       └── cpt.py
├── profiles/                  # Agent Personas/Configurations
│   ├── __init__.py
│   ├── coder.yaml
│   ├── researcher.yaml
│   └── clinical.yaml
└── main.py                    # Entry point
3.2. Core Features & Improvements
Feature	Current "Claude"	New "Ron" (Strands)	Improvement
Model Client	Raw aiobotocore	strands.models.BedrockModel	Simpler Code. Removes ~500 lines of boilerplate while keeping performance.
Tool Loading	Static tools.py with try/except	Dynamic Registry. Lazy loading.	Faster Startup. Only load what's needed. Resilience. Broken tools don't crash the agent.
Streaming	Manual SSE construction	strands.streaming.AISDKAdapter	Stability. Standardized stream format. Easier to maintain.
Sub-Agents	Hardcoded ask_xyz functions	Ephemerality. agent.spawn(task)	Scalability. Agents spawn sub-agents natively without special-cased logic.
Computer Use	Hardcoded computer_handler	ComputerTool (Strands Interface)	Modularity. Computer use becomes just another tool in the registry.
MCP Support	Custom aggregation logic	strands.mcp.Client	Standards. Uses the official/standard Strands MCP integration.
4. Implementation Roadmap
Phase 1: Foundation (The Skeleton)
Goal: Create the basic Ron agent that can "think" and stream text using Strands.
Steps:
Initialize backend/ron_agents/ron/core/agent.py.
Implement BedrockModel configuration with correct headers (Computer Use, Thinking).
Create streaming.py to adapt Strands events to the existing frontend SSE format.
Verification: Echo test. User says "Hello", Ron streams "Hello" back via the new pipeline.
Phase 2: The Tool System (The Hands)
Goal: Replace tools.py with the Dynamic Registry.
Steps:
Create backend/ron_agents/ron/tools/registry.py.
Port "Core" tools (Bash, Edit, Read) to the Strands Tool interface.
Implement Lazy Loading: Tools are imported only when requested by the LLM (or pre-warmed for core tools).
Verification: "Write a file" test. Ron can read/write files using the new tool system.
Phase 3: Integration Migration (The Reach)
Goal: Port complex integrations (Browser, MCP, Specialized Agents).
Steps:
Browser: Wrap browser_use_service in a clean Strands Tool class. Remove global state.
MCP: Implement the generic MCPClientTool that connects to the Docker Gateway.
Specialized: Convert FDA, CPT, etc., into standalone Tool modules.
Phase 4: Sub-Agent Architecture (The Team)
Goal: Enable "Ron" to spawn ephemeral help.
Steps:
Implement Ron.spawn(task, profile).
Create profiles/ configurations (YAML/JSON) defining default tools for different modes (Coder, Researcher).
Verification: "Research this topic". Ron spawns a researcher sub-agent and reports back.
Phase 5: Optimization & Cleanup (The Polish)
Goal: Optimization and legacy removal.
Steps:
Profile startup time and memory usage.
Remove backend/ron_agents/claude (Legacy).
Update documentation.
5. Key Technical Implementations to Watch
Dynamic Tool Loading
Stop doing this:

try:
    import complex_tool
except ImportError:
    pass
Do this (in registry.py):

def get_tool(name: str):
    if name in _tool_cache: return _tool_cache[name]
    # Dynamic import
    module = importlib.import_module(f"ron.tools.{name}")
    tool = module.load()
    _tool_cache[name] = tool
    return tool
The Stream Adapter
We must ensure the frontend receives the exact same SSE format.

async for event in strands_agent.stream(message):
    sse_event = adapter.convert(event)
    yield sse_event
This isolates the internal agent changes from the frontend interface.

6. Conclusion
This rebuild moves "Ron" from a "script with tools" to a true Agentic Platform. By adopting the Strands framework conventions, we reduce maintenance burden, improve error boundaries, and create a system that can evolve (e.g., swapping models, adding new capabilities) without rewriting the core loop.

