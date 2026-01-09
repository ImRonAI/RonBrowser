
import inspect
from strands.agent import Agent
from strands.tools.registry import ToolRegistry
from strands.tools.mcp import MCPClient

print("--- ToolRegistry Methods ---")
for name, _ in inspect.getmembers(ToolRegistry, predicate=inspect.isfunction):
    print(name)

print("\n--- Agent Methods ---")
for name, _ in inspect.getmembers(Agent, predicate=inspect.isfunction):
    print(name)
