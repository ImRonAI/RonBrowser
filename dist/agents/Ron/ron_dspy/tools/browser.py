"""Browser automation tools via Playwright-Electron MCP.

This module connects to the Electron app's browser window for automation,
NOT a separate Chromium instance. This enables automation of the Ron Browser
Electron app itself.
"""

from typing import Optional, Dict, Any, List
import os
from pathlib import Path

try:
    from agents.Ron.tools.src.strands_tools.mcp_client import mcp_client
except ImportError:
    try:
        from strands_tools.mcp_client import mcp_client
    except ImportError:
        mcp_client = None


class PlaywrightElectronMCP:
    """Playwright-Electron MCP for automating Electron apps.

    Unlike regular Playwright MCP that launches Chromium, this connects
    to an existing Electron BrowserWindow. Designed for Ron Browser's
    Electron environment.

    Features:
    - Connects to Electron's main window via CDP
    - Supports page snapshots, clicks, typing, screenshots
    - Handles Electron-specific window management
    - Integrates with Ron Browser's IPC system
    """

    def __init__(
        self,
        connection_id: str = "playwright-electron",
        cdp_port: int = 9222,
        electron_path: Optional[str] = None,
    ):
        """Initialize Playwright-Electron MCP.

        Args:
            connection_id: MCP connection identifier
            cdp_port: Chrome DevTools Protocol port for Electron
            electron_path: Path to Electron executable (auto-detected if None)
        """
        self.connection_id = connection_id
        self.cdp_port = cdp_port
        self.electron_path = electron_path or self._detect_electron_path()
        self._connected = False

        if mcp_client is None:
            raise ImportError(
                "mcp_client not available. Install strands-tools."
            )

    def _detect_electron_path(self) -> str:
        """Detect Electron executable path."""
        # Common Electron paths
        possible_paths = [
            # Development
            "node_modules/.bin/electron",
            "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
            # Built app (macOS)
            "dist/mac/Ron Browser.app/Contents/MacOS/Ron Browser",
            "dist/mac-arm64/Ron Browser.app/Contents/MacOS/Ron Browser",
            # Built app (Windows)
            "dist/win-unpacked/Ron Browser.exe",
            # Built app (Linux)
            "dist/linux-unpacked/ron-browser",
        ]

        project_root = Path(__file__).parent.parent.parent.parent.parent
        for path in possible_paths:
            full_path = project_root / path
            if full_path.exists():
                return str(full_path)

        return "electron"  # Fallback to system electron

    def connect(self, use_cdp: bool = True) -> Dict[str, Any]:
        """Connect to Electron app via CDP or direct connection.

        For an existing Electron app, connect via Chrome DevTools Protocol.
        The Electron app must be started with --remote-debugging-port=9222

        Args:
            use_cdp: Use CDP connection (recommended for existing apps)

        Returns:
            Connection result
        """
        if self._connected:
            return {"status": "already_connected", "connection_id": self.connection_id}

        if use_cdp:
            # Connect to existing Electron via CDP
            result = mcp_client(
                action="connect",
                connection_id=self.connection_id,
                transport="stdio",
                command="npx",
                args=[
                    "@anthropic-ai/mcp-server-playwright",
                    "--cdp-url",
                    f"http://localhost:{self.cdp_port}",
                ],
            )
        else:
            # Launch Playwright with Electron executable
            result = mcp_client(
                action="connect",
                connection_id=self.connection_id,
                transport="stdio",
                command="npx",
                args=[
                    "@anthropic-ai/mcp-server-playwright",
                    "--browser",
                    "chromium",
                    "--executable-path",
                    self.electron_path,
                ],
            )

        if result and result.get("status") == "success":
            self._connected = True

        return result or {"status": "error", "message": "Connection failed"}

    def connect_to_window(self, window_id: Optional[int] = None) -> Dict[str, Any]:
        """Connect to a specific Electron BrowserWindow.

        In Electron, you may have multiple BrowserWindows. This connects
        to a specific one by ID, or the focused window if no ID provided.

        Args:
            window_id: Electron BrowserWindow ID (None = focused window)

        Returns:
            Connection result with page info
        """
        if not self._connected:
            self.connect()

        # Use CDP to get pages and select the right one
        result = mcp_client(
            action="call_tool",
            connection_id=self.connection_id,
            tool_name="browser_tabs",
            tool_args={"action": "list"},
        )

        if window_id is not None and result and "tabs" in result:
            # Select specific tab/window
            for i, tab in enumerate(result.get("tabs", [])):
                if tab.get("id") == window_id:
                    mcp_client(
                        action="call_tool",
                        connection_id=self.connection_id,
                        tool_name="browser_tabs",
                        tool_args={"action": "select", "index": i},
                    )
                    break

        return result or {"status": "connected"}

    def disconnect(self) -> Dict[str, Any]:
        """Disconnect from Electron app."""
        if not self._connected:
            return {"status": "not_connected"}

        result = mcp_client(
            action="disconnect",
            connection_id=self.connection_id,
        )

        if result and result.get("status") == "success":
            self._connected = False

        return result or {"status": "disconnected"}

    def _call_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Any:
        """Call a Playwright MCP tool.

        Args:
            tool_name: Name of the Playwright tool
            tool_args: Arguments for the tool

        Returns:
            Tool result
        """
        if not self._connected:
            self.connect()

        result = mcp_client(
            action="call_tool",
            connection_id=self.connection_id,
            tool_name=tool_name,
            tool_args=tool_args,
        )

        return result

    # Navigation Tools

    def navigate(self, url: str) -> str:
        """Navigate Electron window to URL.

        Args:
            url: URL to navigate to (can be file:// for local HTML)

        Returns:
            Navigation result
        """
        result = self._call_tool("browser_navigate", {"url": url})
        return f"Navigated to {url}"

    def go_back(self) -> str:
        """Navigate back in history."""
        self._call_tool("browser_navigate_back", {})
        return "Navigated back"

    def reload(self) -> str:
        """Reload current page."""
        self._call_tool("browser_evaluate", {
            "function": "() => window.location.reload()"
        })
        return "Page reloaded"

    # Interaction Tools

    def click(self, element: str, ref: str, button: str = "left") -> str:
        """Click an element.

        Args:
            element: Human-readable element description
            ref: Element reference from snapshot
            button: Mouse button ('left', 'right', 'middle')

        Returns:
            Click result
        """
        self._call_tool("browser_click", {
            "element": element,
            "ref": ref,
            "button": button,
        })
        return f"Clicked '{element}'"

    def type_text(
        self,
        element: str,
        ref: str,
        text: str,
        submit: bool = False,
        slowly: bool = False,
    ) -> str:
        """Type text into an element.

        Args:
            element: Human-readable element description
            ref: Element reference from snapshot
            text: Text to type
            submit: Press Enter after typing
            slowly: Type character by character

        Returns:
            Type result
        """
        args = {"element": element, "ref": ref, "text": text}
        if submit:
            args["submit"] = True
        if slowly:
            args["slowly"] = True

        self._call_tool("browser_type", args)
        return f"Typed '{text}' into '{element}'"

    def press_key(self, key: str) -> str:
        """Press a keyboard key.

        Args:
            key: Key to press (e.g., 'Enter', 'Escape', 'ArrowDown')

        Returns:
            Key press result
        """
        self._call_tool("browser_press_key", {"key": key})
        return f"Pressed '{key}'"

    def fill_form(self, fields: List[Dict[str, Any]]) -> str:
        """Fill multiple form fields.

        Args:
            fields: List of field dicts with name, type, ref, value

        Returns:
            Form fill result
        """
        self._call_tool("browser_fill_form", {"fields": fields})
        return f"Filled {len(fields)} form fields"

    def select_option(self, element: str, ref: str, values: List[str]) -> str:
        """Select options in a dropdown.

        Args:
            element: Element description
            ref: Element reference
            values: Values to select

        Returns:
            Selection result
        """
        self._call_tool("browser_select_option", {
            "element": element,
            "ref": ref,
            "values": values,
        })
        return f"Selected {values} in '{element}'"

    def hover(self, element: str, ref: str) -> str:
        """Hover over an element.

        Args:
            element: Element description
            ref: Element reference

        Returns:
            Hover result
        """
        self._call_tool("browser_hover", {"element": element, "ref": ref})
        return f"Hovered over '{element}'"

    def drag(
        self,
        start_element: str,
        start_ref: str,
        end_element: str,
        end_ref: str,
    ) -> str:
        """Drag from one element to another.

        Args:
            start_element: Source element description
            start_ref: Source reference
            end_element: Target element description
            end_ref: Target reference

        Returns:
            Drag result
        """
        self._call_tool("browser_drag", {
            "startElement": start_element,
            "startRef": start_ref,
            "endElement": end_element,
            "endRef": end_ref,
        })
        return f"Dragged from '{start_element}' to '{end_element}'"

    # Vision/Snapshot Tools

    def get_snapshot(self) -> str:
        """Get accessibility snapshot of current page.

        Returns structured representation with element refs for interaction.

        Returns:
            Page accessibility tree as text
        """
        result = self._call_tool("browser_snapshot", {})
        if isinstance(result, dict) and "content" in result:
            content = result["content"]
            if isinstance(content, list) and len(content) > 0:
                return content[0].get("text", str(result))
        return str(result)

    def screenshot(
        self,
        filename: Optional[str] = None,
        full_page: bool = False,
        element: Optional[str] = None,
        ref: Optional[str] = None,
    ) -> str:
        """Take a screenshot.

        Args:
            filename: Output filename
            full_page: Capture full scrollable page
            element: Element to screenshot (optional)
            ref: Element reference (required if element provided)

        Returns:
            Screenshot result
        """
        args = {}
        if filename:
            args["filename"] = filename
        if full_page:
            args["fullPage"] = True
        if element and ref:
            args["element"] = element
            args["ref"] = ref

        result = self._call_tool("browser_take_screenshot", args)
        return f"Screenshot saved: {filename or 'screenshot.png'}"

    # Wait Tools

    def wait_for(
        self,
        text: Optional[str] = None,
        text_gone: Optional[str] = None,
        time_seconds: Optional[float] = None,
    ) -> str:
        """Wait for a condition.

        Args:
            text: Text to wait for to appear
            text_gone: Text to wait for to disappear
            time_seconds: Time to wait

        Returns:
            Wait result
        """
        args = {}
        if text:
            args["text"] = text
        if text_gone:
            args["textGone"] = text_gone
        if time_seconds:
            args["time"] = time_seconds

        self._call_tool("browser_wait_for", args)
        return "Wait condition met"

    # Electron-Specific Tools

    def evaluate(
        self,
        js_code: str,
        element: Optional[str] = None,
        ref: Optional[str] = None,
    ) -> Any:
        """Evaluate JavaScript in Electron renderer.

        Args:
            js_code: JavaScript code (function format)
            element: Optional element description
            ref: Optional element reference

        Returns:
            Evaluation result
        """
        args = {"function": js_code}
        if element:
            args["element"] = element
        if ref:
            args["ref"] = ref

        return self._call_tool("browser_evaluate", args)

    def call_electron_api(self, api_call: str) -> Any:
        """Call Electron API via window.electron preload bridge.

        Ron Browser exposes APIs via window.electron:
        - window.electron.theme
        - window.electron.auth
        - window.electron.window

        Args:
            api_call: JavaScript to call (e.g., "window.electron.theme.getTheme()")

        Returns:
            API result
        """
        return self.evaluate(f"async () => {{ return await {api_call}; }}")

    def get_electron_window_state(self) -> Dict[str, Any]:
        """Get Electron window state (maximized, fullscreen, etc.)."""
        return self.evaluate("""
            () => ({
                url: window.location.href,
                title: document.title,
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio,
            })
        """)

    # Tab/Window Management

    def list_tabs(self) -> List[Dict[str, Any]]:
        """List all open tabs/windows."""
        result = self._call_tool("browser_tabs", {"action": "list"})
        return result.get("tabs", []) if isinstance(result, dict) else []

    def new_tab(self) -> str:
        """Open a new tab."""
        self._call_tool("browser_tabs", {"action": "new"})
        return "New tab opened"

    def close_tab(self, index: Optional[int] = None) -> str:
        """Close a tab.

        Args:
            index: Tab index to close (None = current tab)
        """
        args = {"action": "close"}
        if index is not None:
            args["index"] = index
        self._call_tool("browser_tabs", args)
        return "Tab closed"

    def select_tab(self, index: int) -> str:
        """Select a tab by index.

        Args:
            index: Tab index to select
        """
        self._call_tool("browser_tabs", {"action": "select", "index": index})
        return f"Selected tab {index}"

    def close(self) -> str:
        """Close the browser page."""
        self._call_tool("browser_close", {})
        return "Browser closed"

    # Console/Debug

    def get_console_messages(self, level: str = "info") -> List[Dict[str, Any]]:
        """Get console messages.

        Args:
            level: Minimum level ('error', 'warning', 'info', 'debug')

        Returns:
            List of console messages
        """
        result = self._call_tool("browser_console_messages", {"level": level})
        return result.get("messages", []) if isinstance(result, dict) else []

    def get_network_requests(self, include_static: bool = False) -> List[Dict[str, Any]]:
        """Get network requests made by the page.

        Args:
            include_static: Include static resources (images, fonts, etc.)

        Returns:
            List of network requests
        """
        result = self._call_tool("browser_network_requests", {
            "includeStatic": include_static
        })
        return result.get("requests", []) if isinstance(result, dict) else []

    # File Operations

    def upload_file(self, paths: List[str]) -> str:
        """Upload files via file input.

        Args:
            paths: Absolute paths to files to upload

        Returns:
            Upload result
        """
        self._call_tool("browser_file_upload", {"paths": paths})
        return f"Uploaded {len(paths)} file(s)"

    # Dialog Handling

    def handle_dialog(self, accept: bool, prompt_text: Optional[str] = None) -> str:
        """Handle a dialog (alert, confirm, prompt).

        Args:
            accept: Whether to accept the dialog
            prompt_text: Text to enter for prompt dialogs

        Returns:
            Dialog result
        """
        args = {"accept": accept}
        if prompt_text:
            args["promptText"] = prompt_text

        self._call_tool("browser_handle_dialog", args)
        return f"Dialog {'accepted' if accept else 'dismissed'}"


# Convenience alias
BrowserTools = PlaywrightElectronMCP
