
from strands import Agent
import inspect

print("--- Agent Init Sig ---")
print(inspect.signature(Agent.__init__))

print("\n--- Agent Attributes ---")
# Create a dummy agent to inspect instance attributes if possible, or just dir the class
print(dir(Agent))
