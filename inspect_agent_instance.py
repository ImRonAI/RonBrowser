
from strands import Agent
from strands.models import BedrockModel

# Dummy model
class DummyModel:
    def __init__(self):
        self.id = "dummy"

# Create agent
agent = Agent(
    name="Test",
    model=DummyModel(),
    tools=[],
    system_prompt="sys",
    description="desc"
)

print("--- Agent Vars ---")
try:
    print(vars(agent))
except:
    print("No vars")

print("\n--- Agent Dir ---")
print(dir(agent))
