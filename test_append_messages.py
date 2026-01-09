
from strands import Agent
from strands.models import BedrockModel

class DummyModel:
    def __init__(self):
        self.id = "dummy"

agent = Agent(name="Test", model=DummyModel(), tools=[])

# Try appending dict
try:
    print("Appending dict...")
    agent.messages.append({"role": "user", "content": "hello"})
    print("Success append dict")
except Exception as e:
    print(f"Failed append dict: {e}")

print(f"Messages: {agent.messages}")
