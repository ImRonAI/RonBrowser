"""Ron Superagent - Strands-based orchestration agent with MCP/A2A capabilities."""
import json
import os
from pathlib import Path
from typing import Optional, Any, Dict, Callable, List
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
from strands.session import FileSessionManager


# Global state for MCP clients and agent reference
_mcp_clients: Dict[str, Dict[str, Any]] = {}
_current_agent: Optional[Agent] = None
_SUPER_AGENT: Optional[Agent] = None  # The ONE permanent agent
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

## Memory (Mem0) Guidelines:
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


def get_or_create_superagent(
    callback_handler: Optional[Callable[..., Any]] = None,
    session_id: str = "default"
) -> Agent:
    """Get or create the PERMANENT super agent.

    The agent is created ONCE and persists for the app's lifetime.
    Sessions are managed through Strands FileSessionManager.

    Args:
        callback_handler: Optional callback handler for streaming
        session_id: Session ID for persistence

    Returns:
        The permanent Agent instance
    """
    global _SUPER_AGENT, _current_agent

    if _SUPER_AGENT is None:
        model = create_bedrock_model()
        a2a_provider = A2AClientToolProvider(known_agent_urls=[])

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

        _SUPER_AGENT = Agent(
            model=model,
            tools=tools,
            callback_handler=callback_handler or CLICallbackHandler(),
            system_prompt=SUPERAGENT_SYSTEM_PROMPT,
            agent_id="ron-superagent",
            name="Ron Superagent",
            description="Powerful orchestration agent with meta-tooling, memory, MCP dynamic loading, and A2A capabilities",
            session_manager=FileSessionManager(
                session_id=session_id,
                storage_dir=str(Path(__file__).parent.parent / ".sessions")
            )
        )
        _current_agent = _SUPER_AGENT

    return _SUPER_AGENT


def create_superagent(
    callback_handler: Optional[Callable[..., Any]] = None,
    a2a_urls: Optional[list[str]] = None,
    additional_tools: Optional[list] = None,
    history: Optional[List[Dict[str, Any]]] = None
) -> Agent:
    """Create and configure the Ron Superagent.

    DEPRECATED: This now returns the permanent singleton.
    Use get_or_create_superagent() for explicit session management.
    """
    # Get the permanent agent
    agent = get_or_create_superagent(callback_handler=callback_handler)

    # Restore history if provided (backward compatibility)
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
