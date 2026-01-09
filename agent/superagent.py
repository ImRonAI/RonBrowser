"""Ron Superagent - Strands-based orchestration agent with MCP/A2A capabilities."""
import json
from pathlib import Path
from typing import Optional, Any, Dict, Callable

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
_mcp_clients: Dict[str, MCPClient] = {}
_current_agent: Optional[Agent] = None
MCP_SERVERS_DIR = Path(__file__).parent / "tools" / "mcp-servers "

AVAILABLE_MCP_SERVERS = {
    "cms-coverage": "cms-coverage-mcp-server/server.py",
    "datacommons": "datacommons/server.py",
    "openapi": "openapi-mcp/server.py",
    "playwright": "playwright-electron-mcp/server.py",
    "pophive": "pophive-mcp-server/server.py",
    "telnyx": "telnyx-mcp-server/server.py",
}

@tool
def load_mcp_server(server_id: str) -> str:
    """Load an MCP server's tools into your registry. After loading, call MCP tools directly by name.

    Args:
        server_id: Server: cms-coverage, datacommons, openapi, playwright, pophive, or telnyx
    """
    global _current_agent

    if server_id not in AVAILABLE_MCP_SERVERS:
        return f"Unknown: {server_id}. Available: {list(AVAILABLE_MCP_SERVERS.keys())}"

    if server_id in _mcp_clients:
        return f"{server_id} already loaded"

    server_path = MCP_SERVERS_DIR / AVAILABLE_MCP_SERVERS[server_id]

    client = MCPClient(lambda: stdio_client(StdioServerParameters(command="python", args=[str(server_path)])))
    client.start()
    tools = client.load_tools()

    if _current_agent:
        for t in tools:
            _current_agent.tool_registry.register_tool(t)

    _mcp_clients[server_id] = client
    tool_names = [t.tool_name for t in tools]

    return f"Loaded {server_id}: {tool_names}. Call these tools directly now."


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

Available MCP servers: cms-coverage, datacommons, openapi, playwright, pophive, telnyx

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
    additional_tools: Optional[list] = None
) -> Agent:
    """Create and configure the Ron Superagent."""
    model = create_bedrock_model()
    a2a_provider = A2AClientToolProvider(known_agent_urls=a2a_urls or [])

    tools = [
        load_tool, editor, shell,
        load_mcp_server,
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
