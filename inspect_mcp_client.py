
from strands.tools.mcp import MCPClient
import inspect

print("--- MCPClient Attributes ---")
print(dir(MCPClient))

print("\n--- MCPClient Init Sig ---")
print(inspect.signature(MCPClient.__init__))
