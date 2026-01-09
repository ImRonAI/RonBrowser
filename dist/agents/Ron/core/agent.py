"""Ron Strands Agent definition with ConcurrentToolExecutor."""

from strands import Agent
from strands.tools.executors import ConcurrentToolExecutor

from .configuration import create_model
from ..tools import CORE_TOOLS


SYSTEM_PROMPT = """You are Ron, an AI assistant with access to file operations,
shell commands, computer control, and web requests. Think step-by-step before
acting. Use tools to accomplish tasks."""


def create_agent(system_prompt: str = None) -> Agent:
    """Create Ron Agent with configured model and tools.

    Args:
        system_prompt: Optional custom system prompt. Defaults to SYSTEM_PROMPT.

    Returns:
        Agent: Configured Strands Agent instance.
    """
    return Agent(
        model=create_model(),
        tools=CORE_TOOLS,
        tool_executor=ConcurrentToolExecutor(),
        system_prompt=system_prompt or SYSTEM_PROMPT,
    )
