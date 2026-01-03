"""Proper DSPy signature for ReAct agent.

This replaces the string-based signature with a typed DSPy Signature class
for better control, type safety, and semantic guidance.
"""

import dspy
from typing import Optional


class ReActSignature(dspy.Signature):
    """Signature for ReAct agent with memory context.

    Process user requests by reasoning step-by-step and using available tools
    when needed. Consider the conversation context and any relevant memories
    to provide helpful, accurate responses.
    """

    request: str = dspy.InputField(
        desc="The user's request or question to process"
    )

    context: Optional[str] = dspy.InputField(
        desc="Conversation history and relevant memories from previous interactions",
        default=""
    )

    response: str = dspy.OutputField(
        desc="Final response to the user after completing all necessary reasoning and tool usage"
    )


class ReActThought(dspy.Signature):
    """Signature for individual ReAct reasoning steps.

    Given the current state and observations, decide what to do next.
    Either use a tool to gather information or provide the final answer.
    """

    request: str = dspy.InputField(
        desc="The original user request"
    )

    context: str = dspy.InputField(
        desc="Current context including memories and observations"
    )

    observation: Optional[str] = dspy.InputField(
        desc="Result from the last tool call, if any",
        default=None
    )

    thought: str = dspy.OutputField(
        desc="Current reasoning about what to do next and why"
    )

    needs_tool: bool = dspy.OutputField(
        desc="Whether a tool is needed for the next step"
    )

    final_answer: Optional[str] = dspy.OutputField(
        desc="Final answer if ready to respond (when needs_tool is False)",
        default=None
    )