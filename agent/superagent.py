"""Ron Superagent - Strands-based orchestration agent with MCP/A2A capabilities."""
import json
import os
from pathlib import Path
from typing import Optional, Any, Dict, Callable
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parent.parent / ".env")

from strands import Agent, tool
from strands.models import BedrockModel

from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

from strands_tools import (
    load_tool,
    editor,
    shell,
    retrieve,
    mem0_memory,
    environment,
    cron,
    http_request,
    file_read,
    file_write,
    use_computer,
    batch,
    use_agent,
    workflow,
    swarm,
    graph,
)
from strands_tools.a2a_client import A2AClientToolProvider

from aisdk_stream import AISDKCallbackHandler


# Global state for MCP clients and agent reference
_mcp_clients: Dict[str, Dict[str, Any]] = {}
_current_agent: Optional[Agent] = None
MCP_SERVERS_DIR = Path(__file__).parent / "tools" / "mcp"
VENV_PYTHON = Path(__file__).parent.parent / "venv" / "bin" / "python"

# MCP server configs: (command, args)
AVAILABLE_MCP_SERVERS = {
    "telnyx": (str(VENV_PYTHON), ["-m", "telnyx_mcp_server"]),
    "datacommons": (str(Path(__file__).parent.parent / "venv" / "bin" / "datacommons-mcp"), ["serve", "stdio"]),
    "cms-coverage": (str(VENV_PYTHON), ["-m", "openapi_mcp_server", "--openapi-spec-path", str(MCP_SERVERS_DIR / "cms-coverage-mcp-server" / "coverageapi.json"), "--api-base-url", "https://api.cms.gov/mcd"]),
    "playwright": ("node", [str(MCP_SERVERS_DIR / "playwright-electron-mcp" / "dist" / "index.js")]),
    "pophive": ("node", [str(MCP_SERVERS_DIR / "pophive-mcp-server" / "server" / "index.js")]),
    "healthcare": ("node", [str(MCP_SERVERS_DIR / "healthcare-mcp-public" / "server" / "index.js")]),
    "mcp-installer": ("node", [str(MCP_SERVERS_DIR / "mcp-installer" / "lib" / "index.mjs")]),
    "gateway": ("docker", ["mcp", "gateway", "run"]),
}

@tool
async def load_mcp_server(server_id: str) -> str:
    """Load an MCP server's tools into your registry. After loading, call MCP tools directly by name.

    Args:
        server_id: Server: cms-coverage, datacommons, playwright, pophive, healthcare, mcp-installer, gateway, or telnyx
    """
    global _current_agent

    if server_id not in AVAILABLE_MCP_SERVERS:
        return f"Unknown: {server_id}. Available: {list(AVAILABLE_MCP_SERVERS.keys())}"

    if server_id in _mcp_clients:
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


SUPERAGENT_SYSTEM_PROMPT = """You are Ron Superagent, a powerful orchestration agent built on Strands.

## Capabilities:
- **Meta-Tooling**: Create new tools at runtime using `load_tool`, `editor`, `shell`
- **MCP Dynamic Loading**: Load MCP server tools mid-conversation via `load_mcp_server`
- **Computer Use**: Take screenshots, control mouse/keyboard via `use_computer`
- **File Operations**: Read, write, edit files via `file_read`, `file_write`, `editor`
- **Parallel Execution**: Batch multiple tools via `batch`
- **A2A Communication**: Discover and communicate with other AI agents

## MCP Dynamic Loading (REAL-TIME during execution):
When you need MCP server capabilities:

```python
# Load the server (tools become native!)
load_mcp_server(server_id="telnyx")

# Now call MCP tools DIRECTLY:
send_sms(to="+1...", message="Hello!")
make_call(to="+1...")
```

Available MCP servers: cms-coverage, datacommons, playwright, pophive, telnyx

## Available Tools:
- Meta: load_tool, editor, shell
- MCP: load_mcp_server (preset servers), load_openapi_server (any OpenAPI spec), unload_mcp_server (unload by ID)
- Memory: retrieve, mem0_memory
- System: environment, cron
- Network: http_request
- Files: file_read, file_write
- Computer: use_computer
- Parallel: batch
- Agent Orchestration: use_agent, workflow, swarm, graph
- A2A: Agent discovery and communication
"""


class UICallbackHandler:
    """
    AI SDK v5 UIMessageStream callback handler for ronbrowser UI.

    Wraps AISDKCallbackHandler to provide emit_fn interface.
    """

    def __init__(self, emit_fn: Callable[[str], None]):
        self._handler = AISDKCallbackHandler(emit_fn)

    def __call__(self, **kwargs: Any) -> None:
        self._handler(**kwargs)


class CLICallbackHandler:
    """Simple CLI callback handler for terminal use."""

    def __call__(self, **kwargs: Any) -> None:
        reasoningText = kwargs.get("reasoningText", False)
        data = kwargs.get("data", "")

        if reasoningText:
            print(reasoningText, end="", flush=True)
        if data:
            print(data, end="", flush=True)


def create_bedrock_model() -> BedrockModel:
    """Create Bedrock model with Opus 4.5, extended thinking, and interleaved thinking."""
    return BedrockModel(
        model_id="us.anthropic.claude-opus-4-5-20251101-v1:0",
        temperature=1,
        additional_request_fields={
            "thinking": {
                "type": "enabled",
                "budget_tokens": 32768
            },
            "anthropic_beta": ["interleaved-thinking-2025-05-14"]
        }
    )


def create_superagent(
    callback_handler: Optional[CallbackHandler] = None,
    a2a_urls: Optional[list[str]] = None,
    additional_tools: Optional[list] = None,
    history: Optional[List[Dict[str, Any]]] = None
) -> Agent:
    """Create and configure the Ron Superagent."""
    model = create_bedrock_model()
    a2a_provider = A2AClientToolProvider(known_agent_urls=a2a_urls or [])

    tools = [
        load_tool, editor, shell,
        load_mcp_server, load_openapi_server, unload_mcp_server,
        retrieve, mem0_memory,
        environment, cron,
        http_request,
        file_read, file_write,
        use_computer,
        batch,
        use_agent, workflow, swarm, graph,
        *a2a_provider.tools,
    ]

    if additional_tools:
        tools.extend(additional_tools)

    global _current_agent
    agent = Agent(
        name="Ron Superagent",
        description="Powerful orchestration agent with meta-tooling, memory, MCP dynamic loading, and A2A capabilities",
        model=model,
        tools=tools,
        callback_handler=callback_handler or CLICallbackHandler(),
        system_prompt=SUPERAGENT_SYSTEM_PROMPT,
    )
    _current_agent = agent
    
    if history:
        agent.messages = history
        
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
