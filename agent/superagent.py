"""Ron Superagent - Strands-based orchestration agent with MCP/A2A capabilities."""
import json
import os
import hashlib
from pathlib import Path
from typing import Optional, Any, Dict, Callable, List
from dotenv import load_dotenv
import logging
# Load .env from project root
load_dotenv(Path(__file__).parent.parent / ".env")

# Set non-interactive mode for shell tool to prevent hangs
os.environ["BYPASS_TOOL_CONSENT"] = "true"
os.environ["STRANDS_NON_INTERACTIVE"] = "true"

# Ensure tools/src is in path so we can import strands_tools modules
# this is critical if the package is not installed in editable mode or if we added new files
import sys
sys.path.append(str(Path(__file__).parent / "tools" / "src"))
# Also add strands-fun-tools for screen_reader and other fun utilities
sys.path.append(str(Path(__file__).parent / "tools" / "strands-fun-tools"))

from strands import Agent, tool
from strands.models.gemini import GeminiModel
from strands.hooks import HookProvider, HookRegistry, AfterModelCallEvent
from google import genai

from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

from strands_tools import (
    load_tool,
    http_request,
    mcp_client,
    a2a_client,
    mem0_memory,
    stop,
    sleep,
    think,
    environment,
    use_agent,
    workflow,
    swarm,
    graph,
    image_reader,
    use_computer,
)
from strands_fun_tools import screen_reader, yolo_vision
from strands_tools.utils.models.model import create_model, get_provider_config
from strands_tools.electron_sandbox_tools import ElectronSandboxTools
from strands_tools.a2a_client import A2AClientToolProvider
from strands_tools.browser import LocalChromiumBrowser
# from strands_tools.code_interpreter.docker_code_interpreter import DockerCodeInterpreter
from strands_tools.code_interpreter.electron_code_interpreter import ElectronCodeInterpreter

from aisdk_stream import AISDKCallbackHandler
from strands.session import FileSessionManager
from strands.agent.conversation_manager import SummarizingConversationManager
from strands.hooks import BeforeToolCallEvent, AfterToolCallEvent
from lancedb_session_repository import LanceDBSessionManager
import time

# Tool timeout in seconds - if a tool takes longer, it gets logged as slow
TOOL_TIMEOUT_SECONDS = int(os.getenv("TOOL_TIMEOUT_SECONDS", "15"))


class ToolTimeoutHook(HookProvider):
    """Track tool execution times and log slow tools using Strands hooks."""
    
    def __init__(self, timeout: float = TOOL_TIMEOUT_SECONDS):
        self.timeout = timeout
        self._start_times: dict[str, float] = {}
    
    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BeforeToolCallEvent, self._on_before_tool)
        registry.add_callback(AfterToolCallEvent, self._on_after_tool)
    
    def _on_before_tool(self, event: BeforeToolCallEvent) -> None:
        tool_id = event.tool_use.get("toolUseId", "unknown")
        tool_name = event.tool_use.get("name", "unknown")
        self._start_times[tool_id] = time.time()
        logger.debug(f"Tool '{tool_name}' (ID: {tool_id}) started")
    
    def _on_after_tool(self, event: AfterToolCallEvent) -> None:
        tool_id = event.tool_use.get("toolUseId", "unknown")
        tool_name = event.tool_use.get("name", "unknown")
        start_time = self._start_times.pop(tool_id, None)
        
        if start_time:
            duration = time.time() - start_time
            if duration > self.timeout:
                logger.warning(f"SLOW TOOL: '{tool_name}' took {duration:.2f}s (threshold: {self.timeout}s)")
            else:
                logger.debug(f"Tool '{tool_name}' completed in {duration:.2f}s")


class ToolErrorRecoveryHook(HookProvider):
    """Modify failed tool results to encourage the model to continue.
    
    Per SDK docs: AfterToolCallEvent.result is writable. This hook modifies
    error results to include recovery guidance so the model doesn't give up.
    """
    
    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(AfterToolCallEvent, self._on_after_tool)
    
    def _on_after_tool(self, event: AfterToolCallEvent) -> None:
        result = event.result
        
        # Check if this is an error result
        if result.get("status") == "error":
            tool_name = event.tool_use.get("name", "unknown")
            logger.warning(f"ToolErrorRecoveryHook: Tool '{tool_name}' failed, modifying result to encourage continuation")
            
            # Get the original error content
            original_content = result.get("content", [])
            original_text = ""
            for item in original_content:
                if isinstance(item, dict) and "text" in item:
                    original_text = item["text"]
                    break
            
            # Modify the result to include recovery guidance
            recovery_message = (
                f"Tool '{tool_name}' encountered an error: {original_text}\n\n"
                "ACTION REQUIRED: This error does not stop your task. You MUST continue working:\n"
                "1. Try a different tool or approach\n"
                "2. If this was a browser/web tool, try alternative sources\n"
                "3. If this was a file tool, check the path or try a different file\n"
                "4. DO NOT STOP - find another way to complete the task"
            )
            
            # Update the result content (result is writable per SDK docs)
            event.result = {
                "status": "error",
                "content": [{"text": recovery_message}]
            }


class EndTurnGuardHook(HookProvider):
    """Reject premature end_turn when no substantial work was done.
    
    Per SDK docs: AfterModelCallEvent.retry is writable. When True, the current
    response is discarded and the model is called again.
    
    This hook prevents the model from stopping early with just text when it
    should be calling tools to make progress.
    """
    
    def __init__(self, min_tool_calls: int = 3, max_retries: int = 5):
        self.min_tool_calls = min_tool_calls
        self.max_retries = max_retries
        self._tool_call_count = 0
        self._retry_count = 0
    
    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BeforeToolCallEvent, self._on_before_tool)
        registry.add_callback(AfterModelCallEvent, self._on_after_model)
    
    def _on_before_tool(self, event: BeforeToolCallEvent) -> None:
        self._tool_call_count += 1
    
    def _on_after_model(self, event: AfterModelCallEvent) -> None:
        # Skip if error or no stop response
        if event.exception or not event.stop_response:
            return
        
        # Only intervene on end_turn (model thinks it's done)
        if event.stop_response.stop_reason != "end_turn":
            return
        
        # If enough tools were called, allow the stop
        if self._tool_call_count >= self.min_tool_calls:
            logger.info(f"EndTurnGuardHook: Allowing stop after {self._tool_call_count} tool calls")
            return
        
        # Check retry limit
        if self._retry_count >= self.max_retries:
            logger.warning(f"EndTurnGuardHook: Hit max retries ({self.max_retries}), allowing stop")
            return
        
        # Block the premature stop - force retry
        self._retry_count += 1
        logger.info(f"EndTurnGuardHook: Blocking premature end_turn ({self._tool_call_count} tools, retry {self._retry_count}/{self.max_retries})")
        event.retry = True



# Global state for MCP clients and agent reference
_mcp_clients: Dict[str, Dict[str, Any]] = {}
_current_agent: Optional[Agent] = None
_SUPER_AGENT: Optional[Agent] = None  # The ONE permanent agent
_SESSION_AGENTS: Dict[str, Agent] = {}
_SESSION_BROWSER_NAMES: Dict[str, str] = {}
_global_browser: Optional[LocalChromiumBrowser] = None  # Access to the browser instance
logger = logging.getLogger(__name__)
MCP_SERVERS_DIR = Path(__file__).parent / "tools" / "mcp"
VENV_PYTHON = Path(__file__).parent.parent / "venv" / "bin" / "python"

# MCP server configs: (command, args)
AVAILABLE_MCP_SERVERS = {
    "telnyx": (str(VENV_PYTHON), ["-m", "telnyx_mcp_server"]),
    "datacommons": (str(Path(__file__).parent.parent / "venv" / "bin" / "datacommons-mcp"), ["serve", "stdio"]),
    "cms-coverage": (str(VENV_PYTHON), ["-m", "openapi_mcp_server", "--openapi-spec-path", str(MCP_SERVERS_DIR / "cms-coverage-mcp-server" / "coverageapi.json"), "--api-base-url", "https://api.cms.gov/mcd"]),
    "playwright": (
        "node",
        [
            str(MCP_SERVERS_DIR / "mcp-playwright" / "dist" / "index.js"),
            "--electron-mode", "electron",
            "--electron-bridge-url", "http://127.0.0.1:9231",
            "--electron-iframe-selector", "iframe[data-active='true']",
            "--electron-iframe-type", "iframe",
        ],
    ),
    "pophive": ("node", [str(MCP_SERVERS_DIR / "pophive-mcp-server" / "server" / "index.js")]),
    "healthcare": ("node", [str(MCP_SERVERS_DIR / "healthcare-mcp-public" / "server" / "index.js")]),
    "agent-sops": (str(VENV_PYTHON), [str(MCP_SERVERS_DIR / "agent-sop-mcp-server" / "server.py")]),
    "mcp-installer": ("node", [str(MCP_SERVERS_DIR / "mcp-installer" / "lib" / "index.mjs")]),
    "gateway": ("docker", ["mcp", "gateway", "run"]),
}

@tool
async def load_mcp_server(server_id: str) -> str:
    """Load an MCP server's tools into your registry. After loading, call MCP tools directly by name.

    Args:
        server_id: Server: agent-sops, cms-coverage, datacommons, playwright, pophive, healthcare, mcp-installer, gateway, or telnyx
    """
    global _current_agent

    if server_id not in AVAILABLE_MCP_SERVERS:
        return f"Unknown: {server_id}. Available: {list(AVAILABLE_MCP_SERVERS.keys())}"

    if server_id in _mcp_clients:
        if _current_agent:
            client = _mcp_clients[server_id]["client"]
            tools_before = set(_current_agent.tool_registry.registry.keys())
            _current_agent.tool_registry.process_tools([client])
            tools_after = set(_current_agent.tool_registry.registry.keys())
            added_tool_names = list(tools_after - tools_before)
            existing_tools = set(_mcp_clients[server_id].get("tool_names", []))
            _mcp_clients[server_id]["tool_names"] = list(existing_tools.union(added_tool_names))
            return f"{server_id} already loaded. Added tools to current agent: {added_tool_names}"
        return f"{server_id} already loaded"

    cmd, args = AVAILABLE_MCP_SERVERS[server_id]
    env = os.environ.copy()
    
    # Initialize client
    client = MCPClient(lambda cmd=cmd, args=args, env=env: stdio_client(StdioServerParameters(command=cmd, args=args, env=env)))
    
    if _current_agent:
        # Capture current tools to find diff later
        tools_before = set(_current_agent.tool_registry.registry.keys())
        
        # Use ToolRegistry to handle standard lifecycle (add_consumer -> load_tools -> start)
        _current_agent.tool_registry.process_tools([client])
        
        # Identify new tools
        tools_after = set(_current_agent.tool_registry.registry.keys())
        added_tool_names = list(tools_after - tools_before)
        
        # Store state for unloading
        _mcp_clients[server_id] = {
            "client": client,
            "tool_names": added_tool_names
        }
        
        return f"Loaded {server_id}: {added_tool_names}. Call these tools directly now."
    
    return "Error: Agent not initialized"


@tool
def unload_mcp_server(server_id: str) -> str:
    """Unload an MCP server and remove its tools from the registry.

    Args:
        server_id: The ID of the server to unload (e.g. 'telnyx', 'playwright')
    """
    global _current_agent
    
    if server_id not in _mcp_clients:
        return f"Server {server_id} is not loaded."

    client_data = _mcp_clients[server_id]
    client = client_data["client"]
    tool_names = client_data["tool_names"]

    # 1. Remove tools from registry manually
    removed_count = 0
    if _current_agent:
        for name in tool_names:
            if name in _current_agent.tool_registry.registry:
                del _current_agent.tool_registry.registry[name]
                removed_count += 1

    # 2. Stop the client to clean up resources/processes
    # This closes the connection and kills the subprocess
    client.stop(None, None, None)

    # 3. Clean up global state
    del _mcp_clients[server_id]

    return f"Unloaded {server_id}. Removed tools: {tool_names}. Processes stopped."


@tool
async def load_openapi_server(spec_path: str, api_base_url: str = None, server_id: str = None) -> str:
    """Load any OpenAPI spec as an MCP server. Use this to dynamically add API tools from any OpenAPI/Swagger spec.

    Args:
        spec_path: Path to the OpenAPI JSON/YAML spec file or URL
        api_base_url: Optional Base URL for the API (overrides spec)
        server_id: Optional unique ID for this server (defaults to spec filename)
    """
    global _current_agent

    sid = server_id or Path(spec_path).stem
    if sid in _mcp_clients:
        return f"{sid} already loaded"

    # Use the ivo-toby/openapi-mcp-server (Node.js)
    cmd = "node"
    args = [str(MCP_SERVERS_DIR / "openapi-mcp" / "bin" / "mcp-server.js"), "--openapi-spec", spec_path]
    
    if api_base_url:
        args.extend(["--api-base-url", api_base_url])
        
    env = os.environ.copy()

    client = MCPClient(lambda cmd=cmd, args=args, env=env: stdio_client(StdioServerParameters(command=cmd, args=args, env=env)))
    
    if _current_agent:
        # Capture current tools to find diff later
        tools_before = set(_current_agent.tool_registry.registry.keys())
        
        # Use ToolRegistry to handle standard lifecycle
        _current_agent.tool_registry.process_tools([client])
        
        # Identify new tools
        tools_after = set(_current_agent.tool_registry.registry.keys())
        added_tool_names = list(tools_after - tools_before)

        _mcp_clients[sid] = {
            "client": client,
            "tool_names": added_tool_names
        }
        
        return f"Loaded OpenAPI server '{sid}': {added_tool_names}. Call these tools directly now."
    
    return "Error: Agent not initialized"


SUPERAGENT_SYSTEM_PROMPT = """You are Ron Superagent. Execute tasks decisively.

## EXECUTION PROTOCOL
1. Receive task → Reason over capabilities → Plan formation → Execute
2. Never stop until all deliverables exist
3. Always call tools - text-only responses are failures

## PLANNING PHASE (do this first for complex tasks)
Reason over:
- Current tools in registry
- MCP servers: loaded vs available (agent-sops, cms-coverage, datacommons, playwright, pophive, healthcare, telnyx, gateway)
- OpenAPI specs in agent/tools/open-api-specs/ that could become tools
- Tools loadable via load_tool from strands-fun-tools or custom_tools
- Whether to create a new tool via editor + load_tool
- Formation design: which agents, which prompts, which tools per agent

Then: Load any missing tools before creating formations.

## FORMATION USAGE (prefer over solo execution)
Use formations for context efficiency and parallel work:
- swarm: collaborative research teams
- graph: dependent pipeline steps
- use_agent: specialized one-off tasks
- workflow: complex multi-step orchestration

## SUBAGENT REQUIREMENTS
Every subagent MUST receive these tools for runtime expansion:
- load_tool, mcp_client, environment

Include in every subagent system_prompt:
"You can load additional tools: load_tool(path), mcp_client(action='connect'), environment(action='get'). 
Tool locations: ~/Library/Application Support/RonBrowser/custom_tools/, agent/tools/strands-fun-tools/, agent/tools/open-api-specs/
UI OUTPUT CONTRACT: Use inline citations [1][2] for sourced facts. When needed, append <plan>{...}</plan> and <queue>{...}</queue> JSON blocks. Do not wrap these tags in code fences."

## STOP CONDITIONS
Only stop when ALL deliverables from the original request are produced and verified.

## UI OUTPUT CONTRACT (AI ELEMENTS)
- Use inline citations like [1], [2], [3] when referencing sources. Citation numbers must align with the order of sources from tools.
- When you have a plan, append a valid JSON block: <plan>{"title":"...","description":"...","steps":[{"title":"...","description":"...","status":"pending|running|complete"}],"footer":"..."}</plan>
- When you have a task queue or checklist, append a valid JSON block: <queue>{"label":"...","items":[{"title":"...","description":"...","completed":false}]}</queue>
- Do NOT wrap <plan>/<queue> blocks in code fences.

## BROWSER & APP NATIVE CONTROL
## PRIMARY BROWSER AUTOMATION (MANDATORY)
Use the Playwright/Electron MCP Server as the FIRST and PRIMARY toolset for
any browser or app automation. Do not use any other browser tool unless this
MCP is unavailable.

When connecting to the MCP (stdio), use one of these exact argument sets:

- UI (focused tab):
  command: node
  args: [
    "/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/mcp/mcp-playwright/dist/index.js",
    "--electron-mode", "electron",
    "--electron-bridge-url", "http://127.0.0.1:9231"
  ]

- UI + iframe (visible automation inside app):
  command: node
  args: [
    "/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/mcp/mcp-playwright/dist/index.js",
    "--electron-mode", "electron",
    "--electron-bridge-url", "http://127.0.0.1:9231",
    "--electron-iframe-selector", "iframe[data-preview='browser'][data-active='true']",
    "--electron-iframe-type", "iframe"
  ]

- UI + iframe (project preview inside app):
  command: node
  args: [
    "/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/mcp/mcp-playwright/dist/index.js",
    "--electron-mode", "electron",
    "--electron-bridge-url", "http://127.0.0.1:9231",
    "--electron-iframe-selector", "iframe[data-preview='project'][data-active='true']",
    "--electron-iframe-type", "iframe"
  ]

- UI + iframe (fallback when only one selector can be passed):
  command: node
  args: [
    "/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/mcp/mcp-playwright/dist/index.js",
    "--electron-mode", "electron",
    "--electron-bridge-url", "http://127.0.0.1:9231",
    "--electron-iframe-selector", "iframe[data-active='true']",
    "--electron-iframe-type", "iframe"
  ]

- Headless (no visible UI):
  command: node
  args: [
    "/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/mcp/mcp-playwright/dist/index.js",
    "--electron-mode", "headless",
    "--electron-headless-target", "electron",
    "--electron-bridge-url", "http://127.0.0.1:9231"
  ]

Security defaults:
- Never pass --electron-allow-destructive-cdp unless explicitly allowed.
- Unsafe eval and full Electron APIs are OFF unless explicitly enabled.

## BROWSER INTERACTION PROTOCOL
For screen interaction, try `use_computer` first. Use `analyze_screen` to get element coordinates (DO NOT set send_screenshot=True), then `click`/`type` at those coordinates. Fall back to Playwright MCP or `browser` tool if needed.

### Data Collection & Context Files
When performing research or coding tasks from web sources:
1. For scraping, prefer `browser` tool with `get_text` or `get_html` actions for direct DOM access
2. For complex pages that need full markdown conversion, use `bright_data` with `scrape_as_markdown`
3. Create a context file for the project using `file_write` or `editor`
4. Store EXACTLY what you received from the scrape - do not summarize or modify
5. Name files descriptively: `{topic}_research_context.md` or `{project}_reference.md`

## PERSONALITY & TONE
- **Vibe**: Perky, upbeat, and friendly! 🌟
- **Brevity**: Keep general chat concise. Save detailed explanations for complex tasks.
- **Style**: Be helpful and high-energy. Avoid long-winded intro/outro text.

## CITATION PROTOCOL (MANDATORY)
When providing information from web sources, research, or search results:
1. **Always cite your sources** using inline APA-style citations with author/organization and year
2. Place citations **inline** immediately after the relevant claim or information
3. Format citations as: (Author, Year) or (Organization, Year) if no author
4. **Example formats**:
   - "Recent studies show AI usage increased 40% in 2024 (Smith et al., 2024)."
   - "The technology sector leads adoption (Tech Research Institute, 2024)."
   - "Healthcare follows closely with implementation rates rising (Johnson & Chen, 2024)."
5. When using `perplexity_search_api` or other search tools, extract author/organization names from the search results and cite them
6. If no author is available, use the website/organization name from the domain

This enables the UI to show interactive citation previews with source details when users hover over the citations.

Use all available tools implicitly as needed without being explicitly told. Always use tools instead of suggesting code
that would perform the same operations. Proactively identify when tasks can be completed using available tools.

## Capabilities:
- **Meta-Tooling**: Create new tools at runtime using `load_tool`, `editor`, `shell`
- **MCP Dynamic Loading**: Load MCP server tools mid-conversation via `load_mcp_server`
- **Computer Use**: Take screenshots, control mouse/keyboard via `use_computer`
- **File Operations**: Read, write, edit files via `file_read`, `file_write`, `editor`
- **Parallel Execution**: Batch multiple tools via `batch`
- **A2A Communication**: Discover and communicate with other AI agents
- **Task Management**: Create and update tasks via `create_task`, `update_task`. 

## TASK MODE & FILE TRACKING (CRITICAL)
When you are working within a specific Task context (indicated by "Task Context: [ID] ..."):
1.  **IMMEDIATELY** set the task ID in your environment variables:
    `environment(action="set", name="CURRENT_TASK_ID", value="<id>")`
2.  This enables automatic file tracking. Any files you create/edit will be linked to the task.
3.  If you create a file that is NOT code (e.g. a document), you may also manually call `add_file_reference`.
4.  When the user changes tasks or context, update `CURRENT_TASK_ID` accordingly.

---

## TOOL LIBRARY & PATHS (TRANSPARENCY)
Resources available for dynamic loading:

### 1. META-TOOLING (User Created)
- **Path**: `~/Library/Application Support/RonBrowser/custom_tools/`
- **Use**: `load_tool` watches this directory. Create new tools here.

### 2. EXTENDED LIBRARY (Fun Tools)
- **Path**: `/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/strands-fun-tools/strands_fun_tools/`
- **Capabilities**: Face Recognition, Bluetooth, Chess, Human Typer, YOLO Vision, etc.
- **How to Use**: `load_tool(path="<full_path>/<file>.py", name="<tool_name>")`

### 3. GOOGLE INTEGRATION
- **Path**: `/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/strands-fun-tools/strands-google/strands_google/`
- **Capabilities**: Gmail, Google Auth, `use_google`.
- **How to Use**: `load_tool(path=".../use_google.py", name="use_google")`

### 4. SPECIALIZED RESEARCH TOOLS
- **Perplexity**: `.../agent/tools/perplexity/perplexity_deep_research.py` (Deep Research), `perplexity_search_api.py` (Standard Search).
- **FDA**: `.../agent/tools/FDA/fda_drug_tools.py` (Drug Info).
- **PubMed**: `.../agent/tools/pubmed /pubmed_tools.py` (Medical Research - Note the space in 'pubmed ').

### 5. OPENAPI SPECS
- **Path**: `/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/open-api-specs/`
- **Available Specs**: Telnyx, CMS Coverage, Healthcare.gov, MyHealth, and more.
- **How to Use**: `load_openapi_server(spec_path="<full_path>/<spec>.json")`

### 5. MCP SERVERS
- **Preset**: Use `load_mcp_server(id)` for configured servers (playwright, telnyx, etc).
- **Custom**: Use `mcp_client` to connect to new servers and access tools/prompts.

---

## ENVIRONMENT VARIABLE MANAGEMENT
The `environment` tool is your primary interface for runtime configuration.

### 1. CORE CONFIGURATION
- **Set**: `environment(action="set", name="KEY", value="VAL")` to adjust tool behavior dynamically (e.g., `MEMORY_DEFAULT_MAX_RESULTS="100"`).
- **Get**: `environment(action="get", name="KEY")` to fetch values (e.g., `AWS_REGION`).
- **List**: `environment(action="list", prefix="AWS_")` to audit settings.
- **Validate**: `environment(action="validate", name="API_KEY")` to ensure prerequisites.

### 2. SECURITY & SECRETS
- **Masking**: Values with keys like "TOKEN", "SECRET", "KEY" are automatically masked in logs.
- **Best Practice**: Do NOT store long-lived secrets as global env vars if possible. Prefer dynamic injection or user-specific secure storage managed by the Electron App.

### 3. INTEGRATION WITH OTHER TOOLS
- **HTTP Request**: Use `auth_env_var` to pass capabilities safely.
  ```python
  agent.tool.http_request(..., auth_env_var="GITHUB_TOKEN")
  ```
- **Memory & AWS**: Tools like `memory` and `use_aws` implicitly check env vars (e.g., `STRANDS_KNOWLEDGE_BASE_ID`, `AWS_REGION`). Set them via `environment` to configure these tools.
- **Tool Configs**: Many tools have env var toggles (e.g., `CALCULATOR_MODE`, `SHELL_DEFAULT_TIMEOUT`). Use `environment` to tune them.

---

## META-TOOLING: CREATE CUSTOM TOOLS AT RUNTIME

### TOOL NAMING CONVENTION:
- The tool name (function name) MUST match the file name without the extension
- Example: For file "tool_name.py", use tool name "tool_name"

### TOOL CREATION vs. TOOL USAGE:
- CAREFULLY distinguish between requests to CREATE a new tool versus USE an existing tool
- When a user asks a question like "reverse hello world" or "count abc", first check if an appropriate tool already exists before creating a new one
- If an appropriate tool already exists, use it directly instead of creating a redundant tool
- Only create a new tool when the user explicitly requests one with phrases like "create", "make a tool", etc.

### WHERE TO SAVE CUSTOM TOOLS:
- Save all custom tools you create to: ~/Library/Application Support/RonBrowser/custom_tools/
- This directory is watched automatically - new tools are discovered and added to the manifest
- After saving, use load_tool to make the tool available

### TOOL CREATION PROCESS:
1. Name the file "tool_name.py" where "tool_name" is a human readable name
2. Name the function in the file the SAME as the file name (without extension)
3. The "name" parameter in TOOL_SPEC MUST match the name of the file (without extension)
4. Include detailed docstrings explaining the tool's purpose and parameters
5. After creating a tool, announce "TOOL_CREATED: <filename>" to track successful creation

### TOOL STRUCTURE (RECOMMENDED - Using @tool decorator):

```python
from strands import tool

@tool
def tool_name(param1: str, param2: int = 10) -> str:
    \"\"\"
    Description of what the tool does.

    Args:
        param1: Description of parameter 1
        param2: Description of parameter 2 (default: 10)

    Returns:
        str: Description of the return value
    \"\"\"
    # Tool implementation here
    result = f"Processed {param1} with {param2}"
    return result
```

### TOOL STRUCTURE (ALTERNATIVE - Using TOOL_SPEC):

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

### AUTONOMOUS TOOL CREATION WORKFLOW:
When asked to create a tool:
1. Generate the complete Python code for the tool following the structure above
2. Use the editor tool to write the code to ~/Library/Application Support/RonBrowser/custom_tools/tool_name.py
3. Use load_tool to dynamically load the newly created tool: load_tool(path="<full_path>", name="tool_name")
4. Report the exact tool name and path you created
5. Confirm when the tool has been created and loaded

---

## MCP DYNAMIC LOADING (REAL-TIME during execution):

When you need MCP server capabilities:

```python
# Load the server (tools become native!)
load_mcp_server(server_id="telnyx")

# Now call MCP tools DIRECTLY:
send_sms(to="+1...", message="Hello!")
make_call(to="+1...")
```

Available MCP servers: agent-sops, cms-coverage, datacommons, playwright, pophive, telnyx, healthcare, mcp-installer, gateway

---

## AVAILABLE TOOLS:

### Meta Tooling:
- load_tool: Load a Python tool file at runtime
- editor: Write/edit files
- shell: Run shell commands

### MCP Servers:
- load_mcp_server: Load preset MCP servers (agent-sops, cms-coverage, datacommons, playwright, pophive, telnyx, healthcare)
- load_openapi_server: Load any OpenAPI spec as MCP tools
- unload_mcp_server: Unload by server ID
- mcp_client: Connect to MCP servers (stdio/sse/http) and use list_tools, call_tool, load_tools, list_prompts, get_prompt

### MCP Prompt Schema (mcp_client)
- list_prompts: action="list_prompts", connection_id (required), pagination_token (optional)
- get_prompt: action="get_prompt", connection_id (required), prompt_name (required), prompt_args (optional, dict[str, str])
- connection_id comes from mcp_client connect: action="connect", connection_id="your_id" (reuse the same value)

### Memory:
- retrieve, mem0_memory

### System:
- environment, cron

### Network:
- http_request

### Files:
- file_read, file_write

### Computer:
- use_computer (screenshots, mouse, keyboard)

### Parallel:
- batch (execute multiple tools simultaneously)

### Agent Orchestration:
- use_agent, workflow, swarm, graph

### A2A:
- Agent discovery and communication
- a2a_client

---

## MULTI-AGENT AND NESTED EXECUTION TOOLS

When tackling complex problems, consider the following tools for managing nested AI operations and coordinating multiple agents:

### 1. `use_agent`: For specialized, isolated sub-tasks or model switching
**When to use:**
- You need to solve a specific sub-problem that benefits from a different system prompt or a different large language model than the current agent's.
- You need to isolate a sub-task's context or toolset to prevent interference with the main task.
- You want to create a nested AI loop with a highly specialized persona.
- Examples: "Analyze this code using a specialized Python interpreter agent," "Summarize this text with a fast, cost-effective model," "Write a creative story using a dedicated creative writing agent."

**Key Features:** Allows dynamic creation of new agent instances with custom system prompts, tools, and model configurations for a single-turn interaction.

### 2. `think`: For iterative, self-reflective reasoning
**When to use:**
- The problem requires multiple cycles of analysis, reflection, and refinement to arrive at a solution.
- You need to break down a complex problem into smaller, iterative thought processes.
- You want to simulate human-like iterative problem-solving or self-correction.
- Examples: "Iteratively refine the product design document," "Analyze the market data through three cycles of critical thinking," "Brainstorm potential solutions for the technical challenge, reflecting on each option."

**Key Features:** Facilitates recursive thinking through multiple cycles, with its own system prompt (who the agent is) and thinking_system_prompt (how it thinks). It can utilize tools during each cycle.

### 3. `swarm`: For collaborative problem-solving with custom, specialized agent teams
**When to use:**
- The task requires the combined expertise and tools of multiple distinct AI personas working collaboratively.
- You need to define a custom team where each agent has a unique system prompt, specific tools, and potentially different model configurations.
- The problem is multi-faceted and benefits from autonomous handoffs and shared context among a group of specialized agents.
- Examples: "Develop a product launch strategy using a market researcher, product strategist, and creative director agent team," "Coordinate a research effort using an academic, an engineer, and a community expert agent," "Collaboratively debug a complex system across specialized agents."

**Key Features:** Coordinates a custom team of AI agents through autonomous handoffs, shared working memory, and specialized tool access. Leverages the Strands SDK's native Swarm multi-agent pattern.

### 4. `graph`: For structured, deterministic multi-agent workflows
**When to use:**
- The problem can be modeled as a Directed Acyclic Graph (DAG) of interdependent agent tasks.
- You require a predictable flow of information and execution where the output of one agent deterministically feeds into another.
- You need to manage complex pipelines of agent operations with clear entry points and defined dependencies.
- Examples: \"Execute a data analysis pipeline where data collection feeds into data cleaning, then analysis, then report generation,\" \"Process a customer support ticket through an intake agent, a diagnosis agent, and a resolution agent,\" \"Automate a content creation workflow from topic generation to drafting to editing.\"

**CRITICAL - Graph Tool Usage:**
```python
# STEP 1: Create a graph with topology definition
result = graph(
    action="create",
    graph_id="my_research_pipeline",
    topology={
        "nodes": [
            {
                "id": "researcher",      # REQUIRED: unique node ID
                "role": "researcher",    # REQUIRED: human-readable role
                "system_prompt": "You are a research specialist. Gather and synthesize information.",  # REQUIRED
                "model_provider": "bedrock",  # OPTIONAL: defaults to parent
                "model_settings": {"model_id": "us.anthropic.claude-sonnet-4-20250514-v1:0"},  # OPTIONAL
                "tools": ["http_request", "file_write"]  # OPTIONAL: subset of parent's tools
            },
            {
                "id": "analyst",
                "role": "analyst",
                "system_prompt": "You analyze research data and identify key insights."
            },
            {
                "id": "reporter",
                "role": "reporter",
                "system_prompt": "You create comprehensive reports from analysis."
            }
        ],
        "edges": [
            {"from": "researcher", "to": "analyst"},
            {"from": "analyst", "to": "reporter"}
        ],
        "entry_points": ["researcher"]  # Where task execution starts
    }
)

# STEP 2: Execute the graph with a task
result = graph(
    action="execute",
    graph_id="my_research_pipeline",
    task="Research and analyze the impact of AI on healthcare. Create a comprehensive report."
)

# OTHER ACTIONS:
# - graph(action="status", graph_id="my_research_pipeline")  # Get status
# - graph(action="list")  # List all graphs
# - graph(action="delete", graph_id="my_research_pipeline")  # Delete
```

**Key Features:** Manages multi-agent graphs based on the Strands SDK Graph implementation, allowing creation, execution, and monitoring of agent systems with various topologies. Each node in the graph can be configured with its own agent, model, and tools.

### 5. `workflow`: For orchestrating complex, multi-step automated processes with fine-grained control
**When to use:**
- You need to define a series of tasks with explicit dependencies, priorities, and parallel execution capabilities.
- Each task requires highly specific configurations, including individual model settings, tools, system prompts, and timeouts.
- You need robust state management, persistence, and real-time monitoring for long-running, automated processes.
- Examples: "Orchestrate an end-to-end software deployment process with build, test, and deploy tasks," "Manage a complex data migration workflow with data extraction, transformation, and loading tasks," "Automate a customer onboarding sequence with multiple personalized communication and setup tasks."

**Key Features:** Provides advanced workflow orchestration with parallel execution, dependency resolution, priority scheduling, and per-task model/tool control. Workflows are persistent and offer detailed status tracking.

---



## AGENT & TOOL PROTOCOL (CRITICAL)
When using sub-agent orchestration tools (`use_agent`, `workflow`, `swarm`, `graph`):
1. **LOAD FIRST**: You MUST ensure that any tool you wish to assign to a sub-agent is ALREADY LOADED in your registry.
2. **CREATE IF NEEDED**: If a required tool does not exist, you must:
   a. Create the tool file in `~/Library/Application Support/RonBrowser/custom_tools/` using `editor`.
   b. Load the tool using `load_tool`.
   c. ONLY THEN assign it to the sub-agent.
3. **NO UNDEFINED TOOLS**: Never pass a string name for a tool that hasn't been loaded. Sub-agents cannot resolve unknown tools.

---

## MEMORY (Mem0) GUIDELINES:

Use mem0_memory to store and retrieve user information. Follow these rules:

1. Always store the user's chosen name or nickname and the form of address they prefer.
2. Record and track every significant date the user mentions—birthdays, anniversaries, interview dates, task due dates, and other deadlines.
3. Save any information the user highlights as important to ensure a highly personalized experience.
4. In your internal reasoning, regularly reference relevant stored memories to guide your responses and maintain continuity.
5. Log all user feedback—both positive feedback (what you did well) and constructive feedback (what you could improve)—to refine future interactions.
6. Capture personal details: family members, relationships, pets, and other significant companions in the user's life.
7. Archive meaningful memories and experiences shared by the user: special events, vacations, milestones, feelings, and insights.
8. Monitor and note expressions of mood, stress levels, happiness, worries, loneliness, and any coping strategies or support systems mentioned.
9. Track daily routines and recurring activities such as sleep schedules, meal times, exercise, walks, and hobbies.
10. Store user preferences and interests: favorite music, movies, books, games, foods, likes, and dislikes.
11. Record upcoming plans, social events, trips, goals, ambitions, and to-do list items the user shares.
12. Note communication and social preferences: preferred channels, times for interaction, and social engagement styles.
13. If a user says they love a sports team, look to see if they've played the night prior or play that day, and send an empathetic statement: cheer for them, or provide "Ugh last night was a rough one for the {team_name}", or send well wishes before a game.
14. If a user has pets, probe and find out what kind, learn about them and remember them. Look up their food or treats to see if they're on sale nearby, or find a toy/item the pet will love, or ask how they're doing. Ask their birthday and remember it.
15. When told about a health condition, always remember it. Probe the user about their medication, provider, and challenges. Occasionally mention them in conversation, look for uplifting information about their condition, or offer to build them a tool to help manage it.

Example memory extraction:
- Input: "I talked to my sister Anna today. It's her birthday next week, and we're planning a small dinner. I've been feeling a bit anxious lately, so I've started journaling again. Also, I've been getting back into painting—it really helps me relax. I'm thinking of visiting my parents next weekend."
- Memory: "Talked to sister Anna ahead of her birthday next week, with a small dinner planned. Has been feeling anxious and is journaling and painting to help cope. Considering visiting parents next weekend."

## Memory Tool Schema:
Your agent_id is "ron25". When using mem0_memory tool:
- To store user memories: mem0_memory(action="store", content="text", user_id=<user_email>, metadata={...})
- To store your memories: mem0_memory(action="store", content="text", agent_id="ron25", metadata={...})
- To list user memories: mem0_memory(action="list", user_id=<user_email>)
- To list your memories: mem0_memory(action="list", agent_id="ron25")
- To search user memories: mem0_memory(action="retrieve", query="text", user_id=<user_email>)
- To search your memories: mem0_memory(action="retrieve", query="text", agent_id="ron25")
- To get specific memory: mem0_memory(action="get", memory_id="mem_xxx")
- To delete memory: mem0_memory(action="delete", memory_id="mem_xxx")
- To get history: mem0_memory(action="history", memory_id="mem_xxx")

Parameters:
- user_id = the user's email address from application context
- agent_id = "ron25" (YOUR identifier)
- metadata = optional dict like {"category": "preferences", "source": "onboarding"}
"""

SUMMARIZATION_SYSTEM_PROMPT = """You are a diff-aware state compaction agent for an autonomous, tool-using SuperAgent.

Your output is used to:
- Update the rolling conversation state
- Compute a structured diff vs the previous summary
- Prevent regression, task drift, and tool thrashing

You must preserve intent, execution state, and failure memory.

INPUTS YOU MUST ASSUME
- previous_summary — the last persisted summary state
- recent_turns — new conversation turns since last compaction

You must reconcile both.

MANDATORY OUTPUT (EXACT SHAPE)
summary:
  primary_objective:
  active_subtasks:
  recent_changes:
  decisions_locked:
  tools_status:
    working:
    degraded:
    broken:
  constraints_and_do_not:
  key_data_and_artifacts:
  open_questions_and_blockers:

diff:
  added:
  modified:
  removed:

Emit both summary and diff.
If no changes exist, diff must explicitly say none.

SUMMARY MERGE RULES (STRICT)
- Start from previous_summary
- Apply changes derived only from recent_turns
- Preserve unchanged sections verbatim
- Never regenerate the full summary from scratch unless explicitly instructed

DIFF SEMANTICS (NON-NEGOTIABLE)
diff.added:
- New objectives, constraints, tools, data, or subtasks
- Newly discovered failures or blockers

diff.modified:
- Changes in intent
- Status transitions (e.g., tool working → broken)
- Updated constraints or requirements
- Reprioritized subtasks

diff.removed:
- Completed subtasks
- Invalidated assumptions
- Deprecated tools, approaches, or data

Each diff entry must include:
- section name
- item identifier (or exact value if no ID)
- reason for change

CONFLICT RESOLUTION RULES
- Recent turns override previous summary
- If conflict cannot be resolved, record it in:
  - summary.open_questions_and_blockers
  - diff.modified with reason conflict_detected
- Do not guess.

TOOL FAILURE HANDLING (CRITICAL)
Any tool error, timeout, or incompatibility:
- Must appear in summary.tools_status.broken or degraded
- Must appear in diff.added or diff.modified
- Tools marked broken must never be suggested or retried downstream unless explicitly cleared by the user

DO-NOT RULE ENFORCEMENT
Anything in constraints_and_do_not:
- Persists across summaries
- Can only be removed via explicit user instruction
- Removal must appear in diff.removed with citation

ABSOLUTE PROHIBITIONS
You must NOT:
- Collapse multiple changes into one diff entry
- Rewrite unchanged content
- Infer completion without explicit evidence
- Silence regressions
- Optimize for brevity over correctness

SUCCESS CONDITION
A downstream agent, given:
- previous_summary
- your summary
- your diff

must be able to:
- understand exactly what changed
- continue execution without rework
- avoid repeating failures
- maintain user intent

Failure to meet this condition is an error."""


class UICallbackHandler:
    """
    AI SDK v5 UIMessageStream callback handler for ronbrowser UI.

    Wraps AISDKCallbackHandler to provide emit_fn interface.
    """

    def __init__(self, emit_fn: Callable[[str], None]):
        self._handler = AISDKCallbackHandler(emit_fn)

    def __call__(self, **kwargs: Any) -> None:
        self._handler(**kwargs)

    def finalize(self, finish_reason: str = "stop") -> None:
        """Ensure terminal events are emitted for this stream."""
        self._handler.finalize(finish_reason=finish_reason)

    @property
    def is_finished(self) -> bool:
        """True if terminal events were already emitted."""
        return self._handler.is_finished


class CLICallbackHandler:
    """Simple CLI callback handler for terminal use."""

    def __call__(self, **kwargs: Any) -> None:
        reasoningText = kwargs.get("reasoningText", False)
        data = kwargs.get("data", "")

        if reasoningText:
            print(reasoningText, end="", flush=True)
        if data:
            print(data, end="", flush=True)


def create_gemini_model() -> GeminiModel:
    """Create Gemini 3 Flash Preview model with high reasoning."""
    return GeminiModel(
        model_id="gemini-3-pro-preview",
        client_args={
            "api_key": os.getenv("GOOGLE_API_KEY"),
        },
        params={
            "temperature": 1.0,
            "max_output_tokens": 65536,
            "thinking_config": genai.types.ThinkingConfig(
                thinking_level="high",  # Maximum reasoning depth (must be lowercase)
                include_thoughts=True   # Expose reasoning tokens / thought summaries
            )
        }
        # NOTE: gemini_tools (GoogleSearch, CodeExecution, UrlContext) removed
        # due to potential conflicts with Strands function calling tools.
        # These can be added back if needed for specific use cases.
    )


def create_primary_model():
    """Create the main model for SuperAgent, defaulting to Gemini for reasoning."""
    provider = os.getenv("SUPERAGENT_PROVIDER", "google")
    model_override = os.getenv("SUPERAGENT_MODEL_ID")
    if provider == "google":
        model_id = model_override or "gemini-3-pro-preview"
        return GeminiModel(
            model_id=model_id,
            client_args={
                "api_key": os.getenv("GOOGLE_API_KEY"),
            },
            params={
                "temperature": 1.0,
                "max_output_tokens": 65536,
                "thinking_config": genai.types.ThinkingConfig(
                    thinking_level="high",  # Maximum reasoning depth (must be lowercase)
                    include_thoughts=True   # Expose reasoning tokens / thought summaries
                )
            }
        )
    config = get_provider_config(provider)
    if model_override:
        config["model_id"] = model_override
    return create_model(provider=provider, config=config)


def create_summarization_model():
    """Create a summarization model for SuperAgent."""
    provider = os.getenv("SUPERAGENT_SUMMARIZER_PROVIDER") or os.getenv("SUPERAGENT_PROVIDER", "google")
    model_override = os.getenv("SUPERAGENT_SUMMARIZER_MODEL_ID") or os.getenv("SUPERAGENT_MODEL_ID")
    if provider == "google":
        model_id = model_override or "gemini-3-pro-preview"
        return GeminiModel(
            model_id=model_id,
            client_args={
                "api_key": os.getenv("GOOGLE_API_KEY"),
            },
            params={
                "temperature": 0.3,
                "thinking_config": genai.types.ThinkingConfig(
                    thinking_level="LOW",  # Fast summarization
                    include_thoughts=False
                )
            }
        )
    config = get_provider_config(provider)
    if model_override:
        config["model_id"] = model_override
    return create_model(provider=provider, config=config)


from tools.task_tools import TaskTools

# ... (Previous imports)

# Wrapper for automatic file tracking
def create_file_tracking_wrapper(original_tool: Callable, task_tools_instance: TaskTools, tool_name: str) -> Callable:
    """Wraps a file creation tool to automatically register the file with the current task."""
    
    # We need to preserve the original tool's metadata (name, description, args)
    # Strands tools usually have these attributes.
    
    async def wrapped_tool(*args, **kwargs):
        # Execute the original tool first
        result = await original_tool(*args, **kwargs)
        
        # Check if we are in a task context
        current_task_id = os.getenv("CURRENT_TASK_ID")
        if not current_task_id:
            return result
            
        # Extract file path based on tool signature
        file_path = None
        if tool_name == "file_write":
            file_path = kwargs.get("file_path") or (args[0] if args else None)
        elif tool_name == "editor":
            # Editor usually has 'path' or 'file_path'
            file_path = kwargs.get("path") or kwargs.get("file_path") or (args[0] if args else None)
            
        if file_path and "error" not in str(result).lower():
            try:
                # Fire and forget - tracking shouldn't fail the operation
                await task_tools_instance.add_file_reference(
                    task_id=current_task_id,
                    file_path=file_path,
                    file_type="code"
                )
                logger.info(f"Auto-tracked file {file_path} for task {current_task_id}")
            except Exception as e:
                logger.error(f"Failed to auto-track file: {e}")
                
        return result
    
    # Copy metadata
    if hasattr(original_tool, "_tool_def"):
         wrapped_tool._tool_def = original_tool._tool_def
    
    # Or strict copy if using @tool decorator struct
    wrapped_tool.__name__ = original_tool.__name__
    wrapped_tool.__doc__ = original_tool.__doc__
    
    return wrapped_tool


def _make_browser_session_name(session_id: str) -> str:
    """Generate a stable, valid browser session name for a chat session."""
    if not session_id:
        session_id = "default"
    digest = hashlib.sha1(session_id.encode("utf-8")).hexdigest()[:24]
    return f"chat-{digest}"


def get_browser_session_name(session_id: str) -> str:
    """Return cached browser session name for a chat session."""
    if session_id in _SESSION_BROWSER_NAMES:
        return _SESSION_BROWSER_NAMES[session_id]
    name = _make_browser_session_name(session_id)
    _SESSION_BROWSER_NAMES[session_id] = name
    return name


def get_or_create_session_agent(
    session_id: str,
    callback_handler: Optional[Callable[..., Any]] = None,
    memory = None,
    browser_session_name: Optional[str] = None
) -> tuple[Agent, bool, str]:
    """Get or create a persistent agent for a specific chat session."""
    global _SESSION_AGENTS, _current_agent

    if browser_session_name:
        _SESSION_BROWSER_NAMES[session_id] = browser_session_name
    browser_session_name = get_browser_session_name(session_id)
    if session_id not in _SESSION_AGENTS:
        logger.info(f"Initializing session agent for: {session_id}")
        agent = create_superagent(
            session_id=session_id,
            callback_handler=callback_handler,
            memory=memory,
            browser_session_name=browser_session_name
        )
        _SESSION_AGENTS[session_id] = agent
        created = True
    else:
        agent = _SESSION_AGENTS[session_id]
        if callback_handler:
            agent.callback_handler = callback_handler
        created = False

    _current_agent = agent
    return agent, created, browser_session_name


def get_or_create_superagent(
    callback_handler: Optional[Callable[..., Any]] = None,
    session_id: str = None,
    memory = None
) -> Agent:
    """Get or create the PERMANENT super agent.

    The agent is created ONCE and persists for the app's lifetime.
    Sessions are managed through Strands FileSessionManager.

    Args:
        callback_handler: Optional callback handler for streaming
        session_id: Session ID for persistence (auto-generated if None)

    Returns:
        The permanent Agent instance
    """
    global _SUPER_AGENT, _current_agent
    
    if session_id:
        agent, _, _ = get_or_create_session_agent(
            session_id=session_id,
            callback_handler=callback_handler,
            memory=memory
        )
        return agent

    if _SUPER_AGENT is None:
        logger.info("Initializing Singleton SuperAgent...")
        _SUPER_AGENT = create_superagent(
            session_id=session_id,
            callback_handler=callback_handler,
            memory=memory
        )
    else:
        logger.info("Returning existing Singleton SuperAgent")
        
    _current_agent = _SUPER_AGENT
    return _SUPER_AGENT


def init_global_resources():
    """Initialize global resources (Browser, Tools) once."""
    global _global_browser, _sandbox_tools, _task_tools, _code_interpreter, _cached_tools
    
    if _global_browser is None:
        # Connect to existing Electron browser on port 9222
        _global_browser = LocalChromiumBrowser(launch_options={"cdp_url": "http://localhost:9222"})
        
        # Initialize reusable tool wrappers
        _task_tools = TaskTools(_global_browser)
        _sandbox_tools = ElectronSandboxTools(_global_browser)
        # _code_interpreter = ElectronCodeInterpreter(browser=_global_browser) # Re-enable if needed

        # Define tool list factory or cache checks here if needed
        # For now, we reconstruct the list in create_superagent to ensure bound methods are correct

    return _global_browser






def create_superagent(
    session_id: Optional[str] = None,
    history: Optional[List[Dict[str, Any]]] = None,
    callback_handler: Optional[Callable[..., Any]] = None,
    memory = None,
    browser_session_name: Optional[str] = None,
    system_prompt_override: Optional[str] = None,
    agent_id_override: Optional[str] = None,
    name_override: Optional[str] = None,
    description_override: Optional[str] = None,
) -> Agent:
    """Create a fresh Agent instance for a specific session."""
    
    # ensure globals are ready
    browser = init_global_resources()
    
    # Use re-imported tools from global scope or the cached ones
    # Note: sandbox_tools is now available globally via init_global_resources pattern, but
    # imports in this file are at module level.
    # We use the globals initialized above.
    
    global _sandbox_tools, _task_tools
    sandbox_tools = _sandbox_tools
    task_tools = _task_tools

    # Browser session is now lazy-initialized on first use in ElectronSandboxTools

    # Re-construct tools list for this agent instance
    tools = [
        # Meta-tooling
        load_tool, sandbox_tools.shell, sandbox_tools.editor,
        # Multi-agent orchestration
        use_agent, workflow, swarm, graph, think,
        # Core utilities
        http_request, sandbox_tools.file_read, sandbox_tools.file_write, environment,
        mcp_client, mem0_memory, stop, sleep, image_reader, use_computer,
        # Browser execution
        browser.browser,
        # Task Management
        task_tools.create_task, task_tools.update_task, task_tools.add_file_reference,
        task_tools.search_tasks, task_tools.get_task, task_tools.add_relationship,
        # MCP server management
        load_mcp_server, load_openapi_server, unload_mcp_server,
        # A2A
        A2AClientToolProvider(known_agent_urls=[]).tools[0], # simplified access
    ]
    # Note: A2A provider .tools returns a list, using * expansion or indexing. 
    # Original used *a2a_provider.tools. Let's replicate cleanly.
    a2a_provider = A2AClientToolProvider(known_agent_urls=[])
    tools.extend(a2a_provider.tools)

    model = create_primary_model()
    
    if session_id is None:
        import time
        session_id = f"ron-{int(time.time())}"

    logger.info(f"Creating new SuperAgent for session: {session_id}")

    # Use LanceDBSessionManager if memory is provided, otherwise FileSessionManager
    if memory:
        session_manager = LanceDBSessionManager(
            session_id=session_id,
            memory=memory
        )
    else:
        session_manager = FileSessionManager(
            session_id=session_id,
            storage_dir=str(Path(__file__).parent.parent / ".sessions")
        )

    summarization_model = create_summarization_model()

    summarization_agent = Agent(
        model=summarization_model,
        system_prompt=SUMMARIZATION_SYSTEM_PROMPT,
        load_tools_from_directory=False
    )

    system_prompt = system_prompt_override or SUPERAGENT_SYSTEM_PROMPT
    if browser_session_name:
        system_prompt = (
            f"{system_prompt}\n\n"
            "## SESSION SCOPE\n"
            f"- Use browser session name: {browser_session_name}\n"
            "- Always set this session_name for browser actions in this chat.\n"
        )

    agent = Agent(
        model=model,
        tools=tools,
        callback_handler=callback_handler or CLICallbackHandler(),
        system_prompt=system_prompt,
        agent_id=agent_id_override or "ron-superagent",
        name=name_override or "Ron Superagent",
        description=description_override or "Orchestrator",
        session_manager=session_manager,
        conversation_manager=SummarizingConversationManager(
            summary_ratio=0.3,
            preserve_recent_messages=10,
            summarization_agent=summarization_agent
        ),
        hooks=[ToolTimeoutHook(), ToolErrorRecoveryHook(), EndTurnGuardHook(min_tool_calls=3, max_retries=5)]
    )
    
    if history:
        agent.messages = history
        
    global _current_agent
    _current_agent = agent
    
    return agent


def main():
    """CLI entry point for interactive superagent."""
    print("Ron Superagent initializing...")

    # Connect to sandbox agent if running
    agent = create_superagent(a2a_urls=["http://localhost:9000"])
    print("Agent ready. Type 'exit' to quit.\n")

    while True:
        try:
            prompt = input("\nYou: ").strip()
            if prompt.lower() in ('exit', 'quit', 'q'):
                print("Goodbye!")
                break
            if not prompt:
                continue

            print("\nAgent:")
            result = agent(prompt)
            print("\nComplete")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"\nError: {e}")


if __name__ == "__main__":
    main()
