"""Simplified Browser Agent for Ron - ELECTRON ONLY.

This agent:
1. Connects to Electron via CDP (Chrome DevTools Protocol) - NEVER launches a browser
2. Uses vision (screenshots) for understanding the page
3. Has thinking/chain-of-thought that streams to UI
4. Has MCP client for tool access
5. Streams all outputs to the side panel UI

CRITICAL: This agent MUST use the running Electron app via CDP.
It will REFUSE to launch any browser.
"""

import asyncio
import base64
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

# Add tools to path
tools_path = Path(__file__).parent.parent / "tools" / "src"
sys.path.insert(0, str(tools_path))

try:
    from playwright.async_api import async_playwright, Page, Browser
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright")
    sys.exit(1)

try:
    from anthropic import Anthropic
except ImportError:
    print("ERROR: anthropic not installed. Run: pip install anthropic")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# STREAMING EVENT TYPES
# ============================================================================

class EventType(str, Enum):
    """Event types for streaming to UI."""
    THINKING = "thinking"           # Chain of thought
    REASONING = "reasoning"         # Reasoning steps
    TOOL_CALL = "tool_call"         # Tool being called
    TOOL_RESULT = "tool_result"     # Tool result
    TASK_START = "task_start"       # Task starting
    TASK_COMPLETE = "task_complete" # Task completed
    VISION = "vision"               # Screenshot/vision data
    OUTPUT = "output"               # Final output text
    ERROR = "error"                 # Error occurred


@dataclass
class StreamEvent:
    """Event to stream to UI."""
    type: EventType
    content: str
    data: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_json(self) -> str:
        return json.dumps({
            "type": self.type.value,
            "content": self.content,
            "data": self.data,
            "timestamp": self.timestamp
        })


# ============================================================================
# ELECTRON BROWSER CONNECTION (CDP)
# ============================================================================

class ElectronConnection:
    """Connects to Electron app via Chrome DevTools Protocol.

    CRITICAL: This ONLY connects to an existing Electron app.
    It NEVER launches a browser.
    """

    def __init__(self, cdp_port: int = 9222):
        self.cdp_port = cdp_port
        self.cdp_url = f"http://localhost:{cdp_port}"
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._page: Optional[Page] = None
        self._connected = False

    async def connect(self) -> bool:
        """Connect to Electron via CDP.

        Returns:
            True if connected, False otherwise
        """
        if self._connected:
            return True

        try:
            self._playwright = await async_playwright().start()

            # Connect via CDP - this connects to EXISTING browser, not launch new one
            self._browser = await self._playwright.chromium.connect_over_cdp(self.cdp_url)

            # Get the first context and page (Electron's main window)
            contexts = self._browser.contexts
            if contexts:
                pages = contexts[0].pages
                if pages:
                    self._page = pages[0]
                else:
                    self._page = await contexts[0].new_page()
            else:
                # Create context if none exists
                context = await self._browser.new_context()
                self._page = await context.new_page()

            self._connected = True
            logger.info(f"Connected to Electron via CDP at {self.cdp_url}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Electron CDP: {e}")
            logger.error("Make sure Electron is running with --remote-debugging-port=9222")
            return False

    async def disconnect(self):
        """Disconnect from Electron."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._connected = False
        self._page = None
        self._browser = None

    @property
    def page(self) -> Optional[Page]:
        return self._page

    @property
    def is_connected(self) -> bool:
        return self._connected

    # ========================================
    # Browser Actions
    # ========================================

    async def navigate(self, url: str) -> Dict[str, Any]:
        """Navigate to URL."""
        if not self._page:
            return {"error": "Not connected"}
        try:
            await self._page.goto(url, wait_until="networkidle")
            return {"success": True, "url": url}
        except Exception as e:
            return {"error": str(e)}

    async def click(self, selector: str) -> Dict[str, Any]:
        """Click element by selector."""
        if not self._page:
            return {"error": "Not connected"}
        try:
            await self._page.click(selector)
            return {"success": True, "selector": selector}
        except Exception as e:
            return {"error": str(e)}

    async def type_text(self, selector: str, text: str) -> Dict[str, Any]:
        """Type text into element."""
        if not self._page:
            return {"error": "Not connected"}
        try:
            await self._page.fill(selector, text)
            return {"success": True, "selector": selector, "text": text}
        except Exception as e:
            return {"error": str(e)}

    async def screenshot(self, full_page: bool = False) -> Optional[str]:
        """Take screenshot and return as base64.

        Returns:
            Base64 encoded PNG image or None on error
        """
        if not self._page:
            return None
        try:
            screenshot_bytes = await self._page.screenshot(full_page=full_page)
            return base64.b64encode(screenshot_bytes).decode("utf-8")
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            return None

    async def get_page_content(self) -> Dict[str, Any]:
        """Get page content for analysis."""
        if not self._page:
            return {"error": "Not connected"}
        try:
            return {
                "url": self._page.url,
                "title": await self._page.title(),
                "text": await self._page.inner_text("body"),
            }
        except Exception as e:
            return {"error": str(e)}

    async def evaluate(self, script: str) -> Any:
        """Evaluate JavaScript in page context."""
        if not self._page:
            return {"error": "Not connected"}
        try:
            return await self._page.evaluate(script)
        except Exception as e:
            return {"error": str(e)}

    async def wait_for_selector(self, selector: str, timeout: int = 5000) -> bool:
        """Wait for element to appear."""
        if not self._page:
            return False
        try:
            await self._page.wait_for_selector(selector, timeout=timeout)
            return True
        except:
            return False


# ============================================================================
# MCP CLIENT (Simplified)
# ============================================================================

class MCPClientSimple:
    """Simplified MCP client for tool access."""

    def __init__(self):
        self._connections: Dict[str, Any] = {}

    async def connect(self, server_name: str, command: str, args: List[str] = None) -> bool:
        """Connect to an MCP server."""
        # TODO: Implement actual MCP connection
        # For now, just track the connection intent
        self._connections[server_name] = {
            "command": command,
            "args": args or [],
            "connected": True
        }
        return True

    async def call_tool(self, server_name: str, tool_name: str, tool_args: Dict) -> Dict[str, Any]:
        """Call a tool on an MCP server."""
        if server_name not in self._connections:
            return {"error": f"Not connected to {server_name}"}

        # TODO: Implement actual MCP tool call
        return {"result": f"Called {tool_name} with {tool_args}"}

    async def disconnect(self, server_name: str):
        """Disconnect from MCP server."""
        if server_name in self._connections:
            del self._connections[server_name]


# ============================================================================
# BROWSER USE AGENT
# ============================================================================

class ElectronBrowserAgent:
    """Simplified Browser Agent that uses Electron via CDP.

    Features:
    - Vision: Takes screenshots and uses Claude's vision
    - Thinking: Chain of thought reasoning
    - Streaming: All events stream to UI
    - MCP: Access to MCP tools
    - ELECTRON ONLY: Never launches its own browser
    """

    SYSTEM_PROMPT = """You are Ron, an AI browser assistant embedded in an Electron app.

You can see the browser through screenshots and control it through browser actions.

IMPORTANT RULES:
1. ALWAYS take a screenshot first to see the current state
2. THINK step by step before acting
3. Use precise selectors when clicking
4. Wait for pages to load before interacting
5. Report what you see and what you're doing

Available actions:
- navigate(url): Go to a URL
- click(selector): Click an element
- type(selector, text): Type into an input
- screenshot(): Take a screenshot to see the page
- evaluate(script): Run JavaScript
- wait(selector): Wait for element

When you see a screenshot, describe what you observe and plan your next action."""

    def __init__(
        self,
        cdp_port: int = 9222,
        model: str = "claude-sonnet-4-20250514",
        api_key: Optional[str] = None,
    ):
        self.connection = ElectronConnection(cdp_port)
        self.mcp = MCPClientSimple()
        self.model = model
        self.client = Anthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))
        self._event_handlers: List[Callable[[StreamEvent], None]] = []
        self._messages: List[Dict] = []

    def on_event(self, handler: Callable[[StreamEvent], None]):
        """Register an event handler for streaming."""
        self._event_handlers.append(handler)

    def _emit(self, event: StreamEvent):
        """Emit event to all handlers."""
        for handler in self._event_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"Event handler error: {e}")

    async def connect(self) -> bool:
        """Connect to Electron browser."""
        self._emit(StreamEvent(
            type=EventType.TASK_START,
            content="Connecting to Electron browser..."
        ))

        connected = await self.connection.connect()

        if connected:
            self._emit(StreamEvent(
                type=EventType.TASK_COMPLETE,
                content="Connected to Electron browser",
                data={"cdp_url": self.connection.cdp_url}
            ))
        else:
            self._emit(StreamEvent(
                type=EventType.ERROR,
                content="Failed to connect to Electron. Is it running with --remote-debugging-port=9222?"
            ))

        return connected

    async def disconnect(self):
        """Disconnect from browser."""
        await self.connection.disconnect()
        self._emit(StreamEvent(
            type=EventType.TASK_COMPLETE,
            content="Disconnected from browser"
        ))

    async def _take_screenshot_for_vision(self) -> Optional[Dict]:
        """Take screenshot and format for Claude vision."""
        self._emit(StreamEvent(
            type=EventType.VISION,
            content="Taking screenshot..."
        ))

        screenshot_b64 = await self.connection.screenshot()
        if not screenshot_b64:
            return None

        self._emit(StreamEvent(
            type=EventType.VISION,
            content="Screenshot captured",
            data={"image": screenshot_b64[:100] + "..."}  # Truncated for log
        ))

        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": screenshot_b64
            }
        }

    async def _execute_action(self, action: str, params: Dict) -> Dict[str, Any]:
        """Execute a browser action."""
        self._emit(StreamEvent(
            type=EventType.TOOL_CALL,
            content=f"Executing: {action}",
            data={"action": action, "params": params}
        ))

        result = {}

        if action == "navigate":
            result = await self.connection.navigate(params.get("url", ""))
        elif action == "click":
            result = await self.connection.click(params.get("selector", ""))
        elif action == "type":
            result = await self.connection.type_text(
                params.get("selector", ""),
                params.get("text", "")
            )
        elif action == "screenshot":
            screenshot = await self.connection.screenshot(params.get("full_page", False))
            result = {"success": True, "screenshot": screenshot[:100] + "..." if screenshot else None}
        elif action == "evaluate":
            result = await self.connection.evaluate(params.get("script", ""))
        elif action == "wait":
            success = await self.connection.wait_for_selector(params.get("selector", ""))
            result = {"success": success}
        elif action == "get_content":
            result = await self.connection.get_page_content()
        else:
            result = {"error": f"Unknown action: {action}"}

        self._emit(StreamEvent(
            type=EventType.TOOL_RESULT,
            content=f"Result: {action}",
            data=result
        ))

        return result

    def _parse_action_from_response(self, text: str) -> Optional[tuple]:
        """Parse action from Claude's response.

        Looking for patterns like:
        - ACTION: navigate("https://...")
        - ACTION: click("#submit")
        - ACTION: type("#search", "query")
        """
        import re

        # Look for ACTION: pattern
        action_match = re.search(r'ACTION:\s*(\w+)\((.*?)\)', text, re.IGNORECASE)
        if action_match:
            action_name = action_match.group(1).lower()
            args_str = action_match.group(2)

            # Parse arguments
            args = []
            if args_str:
                # Simple parsing - split by comma, strip quotes
                for arg in args_str.split(","):
                    arg = arg.strip().strip('"').strip("'")
                    args.append(arg)

            # Convert to params dict based on action
            params = {}
            if action_name == "navigate" and args:
                params["url"] = args[0]
            elif action_name == "click" and args:
                params["selector"] = args[0]
            elif action_name == "type" and len(args) >= 2:
                params["selector"] = args[0]
                params["text"] = args[1]
            elif action_name == "screenshot":
                params["full_page"] = "full" in args_str.lower()
            elif action_name == "evaluate" and args:
                params["script"] = args[0]
            elif action_name == "wait" and args:
                params["selector"] = args[0]

            return (action_name, params)

        return None

    async def run(self, task: str, max_steps: int = 10) -> AsyncGenerator[StreamEvent, None]:
        """Run a task with the browser agent.

        Args:
            task: The task to accomplish
            max_steps: Maximum number of action steps

        Yields:
            StreamEvent objects for UI streaming
        """
        # Connect if not connected
        if not self.connection.is_connected:
            connected = await self.connect()
            if not connected:
                yield StreamEvent(
                    type=EventType.ERROR,
                    content="Cannot start - not connected to Electron"
                )
                return

        yield StreamEvent(
            type=EventType.TASK_START,
            content=f"Starting task: {task}"
        )

        # Initial screenshot
        screenshot = await self._take_screenshot_for_vision()

        # Build initial message
        content = [{"type": "text", "text": f"Task: {task}\n\nI'll take a screenshot to see the current state."}]
        if screenshot:
            content.append(screenshot)
            content.append({"type": "text", "text": "This is what I see. Let me analyze and plan my approach."})

        self._messages = [{"role": "user", "content": content}]

        for step in range(max_steps):
            yield StreamEvent(
                type=EventType.THINKING,
                content=f"Step {step + 1}/{max_steps}: Analyzing..."
            )

            # Call Claude with vision
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=self.SYSTEM_PROMPT,
                    messages=self._messages
                )
            except Exception as e:
                yield StreamEvent(
                    type=EventType.ERROR,
                    content=f"API error: {e}"
                )
                return

            # Get response text
            response_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text

            # Emit reasoning
            yield StreamEvent(
                type=EventType.REASONING,
                content=response_text
            )

            # Add to messages
            self._messages.append({"role": "assistant", "content": response_text})

            # Check if task is complete
            if "DONE" in response_text.upper() or "COMPLETE" in response_text.upper():
                yield StreamEvent(
                    type=EventType.TASK_COMPLETE,
                    content="Task completed!"
                )
                return

            # Parse and execute action
            action = self._parse_action_from_response(response_text)
            if action:
                action_name, params = action
                result = await self._execute_action(action_name, params)

                # Take new screenshot after action
                new_screenshot = await self._take_screenshot_for_vision()

                # Build follow-up message
                follow_up = [
                    {"type": "text", "text": f"Action result: {json.dumps(result)}\n\nHere's the updated screenshot:"}
                ]
                if new_screenshot:
                    follow_up.append(new_screenshot)
                follow_up.append({"type": "text", "text": "What should I do next? Say DONE if the task is complete."})

                self._messages.append({"role": "user", "content": follow_up})

                yield StreamEvent(
                    type=EventType.TOOL_RESULT,
                    content=f"Executed {action_name}",
                    data=result
                )
            else:
                # No action found - ask for clarification
                self._messages.append({
                    "role": "user",
                    "content": "I didn't see a clear action. Please respond with ACTION: <action>(<params>) or say DONE if complete."
                })

        yield StreamEvent(
            type=EventType.OUTPUT,
            content=f"Reached maximum steps ({max_steps})"
        )


# ============================================================================
# STDIO STREAMING SERVER (for Electron IPC)
# ============================================================================

async def run_agent_server():
    """Run agent as a server that reads from stdin and writes to stdout.

    This allows Electron to communicate via spawn/IPC.

    Protocol:
    - Input: JSON lines with {"task": "..."} or {"action": "connect"|"disconnect"}
    - Output: JSON lines with StreamEvents
    """
    agent = ElectronBrowserAgent()

    # Print ready message
    print(json.dumps({"type": "ready", "content": "Agent ready"}), flush=True)

    while True:
        try:
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break

            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
            except json.JSONDecodeError:
                print(json.dumps({"type": "error", "content": f"Invalid JSON: {line}"}), flush=True)
                continue

            action = request.get("action", "task")

            if action == "connect":
                connected = await agent.connect()
                print(json.dumps({
                    "type": "connected" if connected else "error",
                    "content": "Connected" if connected else "Failed to connect"
                }), flush=True)

            elif action == "disconnect":
                await agent.disconnect()
                print(json.dumps({"type": "disconnected", "content": "Disconnected"}), flush=True)

            elif action == "task":
                task = request.get("task", "")
                if not task:
                    print(json.dumps({"type": "error", "content": "No task provided"}), flush=True)
                    continue

                async for event in agent.run(task):
                    print(event.to_json(), flush=True)

            else:
                print(json.dumps({"type": "error", "content": f"Unknown action: {action}"}), flush=True)

        except Exception as e:
            print(json.dumps({"type": "error", "content": str(e)}), flush=True)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Electron Browser Agent")
    parser.add_argument("--server", action="store_true", help="Run as stdio server")
    parser.add_argument("--task", type=str, help="Task to run (one-shot mode)")
    parser.add_argument("--port", type=int, default=9222, help="CDP port")
    args = parser.parse_args()

    if args.server:
        asyncio.run(run_agent_server())
    elif args.task:
        async def run_task():
            agent = ElectronBrowserAgent(cdp_port=args.port)

            # Print events as they happen
            def print_event(event: StreamEvent):
                print(event.to_json())

            agent.on_event(print_event)

            connected = await agent.connect()
            if not connected:
                print("Failed to connect!")
                return

            async for event in agent.run(args.task):
                print(event.to_json())

            await agent.disconnect()

        asyncio.run(run_task())
    else:
        print("Usage: python electron_browser_agent.py --server")
        print("   or: python electron_browser_agent.py --task 'Navigate to google.com'")
