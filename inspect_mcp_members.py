
from strands.tools.mcp import MCPClient
import inspect

print("--- MCPClient Members ---")
for name, member in inspect.getmembers(MCPClient):
    if not name.startswith("__"):
        print(name)

