"""DSPy signatures for structured reasoning.

Note:
- This file intentionally avoids dynamic runtime validation patterns that are
  brittle (e.g., global VALID_TOOLS mutated at runtime + field validators).
- Tool availability should be communicated to the model via inputs (e.g.,
  `available_tools`) or via DSPy modules like `dspy.ReAct`.
"""

import dspy
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ToolCall(BaseModel):
    """Validated tool call structure with Pydantic."""

    tool_name: str = Field(description="Name of the tool to call")
    arguments: dict = Field(default_factory=dict, description="Arguments for the tool")
    reasoning: str = Field(description="Why this tool is appropriate for the task")

    @field_validator("reasoning")
    @classmethod
    def validate_reasoning_not_empty(cls, v: str) -> str:
        """Ensure reasoning is provided."""
        if not v or len(v.strip()) < 10:
            raise ValueError("Reasoning must be at least 10 characters explaining why this tool is needed")
        return v


class ReActStep(dspy.Signature):
    """Single ReAct reasoning step with validation.

    Given the current context (conversation history, observations) and available tools,
    decide the next action. Must either:
    1. Call a tool to gather information or perform an action
    2. Provide a final answer if the task is complete

    Think step-by-step before deciding. Consider:
    - What information do I have?
    - What do I still need to accomplish?
    - Which tool (if any) will help most?
    """

    context: str = dspy.InputField(
        desc="Current context including conversation history and previous observations"
    )
    observation: Optional[str] = dspy.InputField(
        desc="Result of the previous tool call, if any"
    )
    available_tools: List[str] = dspy.InputField(
        desc="List of tools available for use"
    )

    thought: str = dspy.OutputField(
        desc="Step-by-step reasoning about the current situation and what to do next"
    )
    action_type: str = dspy.OutputField(
        desc="Either 'tool_call' to use a tool, or 'final_answer' to respond to user"
    )
    tool_call: Optional[ToolCall] = dspy.OutputField(
        desc="Tool call details when action_type='tool_call'. Must include tool_name, arguments, and reasoning."
    )
    final_answer: Optional[str] = dspy.OutputField(
        desc="Final response to user when action_type='final_answer'"
    )


class TaskDecomposition(dspy.Signature):
    """Break complex user request into actionable subtasks.

    Analyze the user's request and decompose it into a sequence of subtasks
    that can each be accomplished with the available tools. Consider:
    - Dependencies between subtasks
    - Optimal ordering for efficiency
    - Which tools are needed for each subtask
    """

    request: str = dspy.InputField(desc="The user's request to analyze")
    available_tools: List[str] = dspy.InputField(desc="Tools available for use")

    analysis: str = dspy.OutputField(
        desc="Analysis of the request's complexity and requirements"
    )
    subtasks: List[str] = dspy.OutputField(
        desc="Ordered list of subtasks to accomplish the request"
    )
    estimated_steps: int = dspy.OutputField(
        desc="Estimated number of tool calls needed"
    )
    potential_blockers: List[str] = dspy.OutputField(
        desc="Potential issues that might block completion",
        default_factory=list
    )


class TaskCreation(dspy.Signature):
    """Analyze user request to determine if task should be created.

    Evaluate if the user's request warrants creating a tracked task.
    Tasks should be created for:
    - Multi-step work that needs tracking
    - Work that will be done later
    - Collaborative work
    - Work with deadlines
    """

    request: str = dspy.InputField(desc="User's request")
    context: str = dspy.InputField(desc="Current conversation context")

    should_create_task: bool = dspy.OutputField(
        desc="Whether this request warrants task creation"
    )
    task_title: str = dspy.OutputField(
        desc="Concise title for the task (if created)"
    )
    task_description: str = dspy.OutputField(
        desc="Detailed description of what needs to be done"
    )
    suggested_priority: str = dspy.OutputField(
        desc="Suggested priority: critical, high, medium, or low"
    )
    suggested_labels: List[str] = dspy.OutputField(
        desc="Suggested labels/tags for the task",
        default_factory=list
    )


def update_valid_tools(_: object) -> None:
    """Deprecated no-op (kept for backward compatibility).

    Previous versions used a global `VALID_TOOLS` set + Pydantic validators.
    This pattern was removed because it is brittle and not an official DSPy
    mechanism for constraining tool selection.
    """
    return
