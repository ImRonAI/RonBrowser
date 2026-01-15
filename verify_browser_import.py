
import sys
from pathlib import Path
import os
# Mimic superagent.py path setup
# We are running from project root usually, but let's be safe
current_dir = os.getcwd()
tools_src = os.path.join(current_dir, "agent", "tools", "src")
sys.path.append(tools_src)

print(f"Added to path: {tools_src}")

try:
    from strands_tools.browser import LocalChromiumBrowser
    print("SUCCESS: Imported LocalChromiumBrowser")
except ImportError as e:
    print(f"FAILURE: ImportError: {e}")
except Exception as e:
    print(f"FAILURE: Exception: {e}")
