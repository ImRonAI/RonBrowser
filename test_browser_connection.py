
import asyncio
import sys
import os
import logging
from pathlib import Path

# Setup paths
current_dir = os.getcwd()
tools_src = os.path.join(current_dir, "agent", "tools", "src")
sys.path.append(tools_src)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_connection():
    print("--- Starting Browser Connection Test ---")
    try:
        from strands_tools.browser import LocalChromiumBrowser
        from strands_tools.browser.models import InitSessionAction, ListTabsAction
        
        # 1. Instantiate
        print("Instantiating LocalChromiumBrowser...")
        browser_tool = LocalChromiumBrowser(launch_options={"cdp_url": "http://localhost:9222"})
        
        # 2. Start (this launches playwright and connects)
        print("Starting platform...")
        await browser_tool._start()
        print("Platform started.")

        # 3. Initialize Session
        print("Initializing session 'test-session'...")
        init_action = InitSessionAction(
            type="init_session",
            session_name="test-session",
            description="Test connection"
        )
        result = await browser_tool.init_session(init_action)
        print(f"Init Result: {result}")
        
        if result.get("status") == "error":
            print("FAILED to initialize session.")
            return

        # 4. List Tabs (Action valid check)
        print("Listing tabs...")
        list_tabs_action = ListTabsAction(
            type="list_tabs",
            session_name="test-session"
        )
        tabs = await browser_tool.list_tabs(list_tabs_action)
        print(f"Tabs: {tabs}")

        # 5. Cleanup
        print("Cleaning up...")
        await browser_tool._cleanup()
        print("--- Test Complete: SUCCESS ---")

    except ImportError as e:
        print(f"--- Test Failed: ImportError: {e} ---")
    except Exception as e:
        print(f"--- Test Failed: Exception: {e} ---")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())
