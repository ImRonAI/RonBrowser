"""Ron Superagent - Runs inside Docker container with virtual desktop."""
import json
from pathlib import Path
from typing import Optional, Any, Dict, Callable

from strands import Agent
from strands.models import BedrockModel
from strands.types.tools import ToolResult, ToolUse

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


# Global state for MCP clients
_mcp_clients: Dict[str, MCPClient] = {}
MCP_SERVERS_DIR = Path("/app/mcp-servers")

AVAILABLE_MCP_SERVERS = {
    "cms-coverage": "cms-coverage-mcp-server/server.py",
    "datacommons": "datacommons/server.py",
    "openapi": "openapi-mcp/server.py",
    "playwright": "playwright-electron-mcp/server.py",
    "pophive": "pophive-mcp-server/server.py",
    "telnyx": "telnyx-mcp-server/server.py",
}

LOAD_MCP_SERVER_SPEC = {
    "name": "load_mcp_server",
    "description": "Load an MCP server's tools into your registry. After loading, call MCP tools directly by name.",
    "inputSchema": {
        "json": {
            "type": "object",
            "properties": {
                "server_id": {
                    "type": "string",
                    "description": "Server: cms-coverage, datacommons, openapi, playwright, pophive, or telnyx"
                }
            },
            "required": ["server_id"]
        }
    }
}


def load_mcp_server(tool_use: ToolUse, agent: Agent, **kwargs: Any) -> ToolResult:
    """Load MCP server tools into agent's registry. Agent can then call them directly."""
    tool_use_id = tool_use["toolUseId"]
    server_id = tool_use["input"]["server_id"]

    if server_id not in AVAILABLE_MCP_SERVERS:
        return {"toolUseId": tool_use_id, "status": "error",
                "content": [{"text": f"Unknown: {server_id}. Available: {list(AVAILABLE_MCP_SERVERS.keys())}"}]}

    if server_id in _mcp_clients:
        return {"toolUseId": tool_use_id, "status": "success",
                "content": [{"text": f"{server_id} already loaded"}]}

    server_path = MCP_SERVERS_DIR / AVAILABLE_MCP_SERVERS[server_id]

    client = MCPClient(lambda: stdio_client(StdioServerParameters(command="python", args=[str(server_path)])))
    client.start()
    tools = client.load_tools()

    for tool in tools:
        agent.tool_registry.register_tool(tool)

    _mcp_clients[server_id] = client
    tool_names = [t.tool_name for t in tools]

    return {"toolUseId": tool_use_id, "status": "success",
            "content": [{"text": f"Loaded {server_id}: {tool_names}. Call these tools directly now."}]}


SUPERAGENT_SYSTEM_PROMPT = """You are Ron Superagent running inside an isolated Docker container with a virtual desktop.

## Your Environment:
- You have a full Linux desktop (1024x768) you can control
- Firefox and Chromium browsers are installed
- You can take screenshots, click, type, and control the mouse/keyboard
- All actions happen inside this sandbox - safe and isolated

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

Available MCP servers: cms-coverage, datacommons, openapi, playwright, pophive, telnyx

## Computer Use:
- Take screenshots: use_computer(action="screenshot")
- Click: use_computer(action="click", x=100, y=200)
- Type: use_computer(action="type", text="hello")
- Keys: use_computer(action="key", key="enter")
- Hotkeys: use_computer(action="hotkey", key="ctrl+c")

## Available Tools:
- Meta: load_tool, editor, shell
- MCP: load_mcp_server (loads tools as native)
- Memory: retrieve, mem0_memory
- System: environment, cron
- Network: http_request
- Files: file_read, file_write
- Computer: use_computer
- Parallel: batch
- Agent Orchestration: use_agent, workflow, swarm, graph
- A2A: Agent discovery and communication

Always take screenshots to see what's happening before and after actions.
"""


class CallbackHandler:
    """Simple callback handler."""

    def __call__(self, **kwargs: Any) -> None:
        pass


def create_bedrock_model() -> BedrockModel:
    """Create Bedrock model with Claude Opus 4.5."""
    return BedrockModel(
        model_id="us.anthropic.claude-opus-4-5-20250101-v1:0",
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
    callback_handler: Optional[Callable] = None,
    a2a_urls: Optional[list[str]] = None,
    additional_tools: Optional[list] = None
) -> Agent:
    """Create and configure the Ron Superagent."""
    model = create_bedrock_model()
    a2a_provider = A2AClientToolProvider(known_agent_urls=a2a_urls or [])

    tools = [
        load_tool, editor, shell,
        (LOAD_MCP_SERVER_SPEC, load_mcp_server),
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

    return Agent(
        name="Ron Superagent",
        description="Powerful orchestration agent with meta-tooling, memory, MCP dynamic loading, and A2A capabilities",
        model=model,
        tools=tools,
        callback_handler=callback_handler or CallbackHandler(),
        system_prompt=SUPERAGENT_SYSTEM_PROMPT,
    )
