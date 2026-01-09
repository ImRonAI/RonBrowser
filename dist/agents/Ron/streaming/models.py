"""
Pydantic models for Strands structured output.

These models define the structured output schemas that Strands will use
via the structured_output_model parameter in stream_async.

Reference: Strands SDK - stream_async with structured_output_model
Docs: https://strandsagents.com
"""

from typing import Optional
from pydantic import BaseModel, Field


class RonResponse(BaseModel):
    """Standard Ron agent response with optional structured data.

    This is the primary structured output model for general Ron responses.
    """

    content: str = Field(
        description="The main text response content"
    )

    reasoning: Optional[str] = Field(
        default=None,
        description="Extended thinking/reasoning content if available"
    )

    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Confidence score for the response (0.0 to 1.0)"
    )

    sources: Optional[list[dict]] = Field(
        default=None,
        description="List of sources used for the response"
    )

    suggested_followups: Optional[list[str]] = Field(
        default=None,
        description="Suggested follow-up questions or actions"
    )


class TaskAnalysis(BaseModel):
    """Structured task analysis output for planning and execution."""

    summary: str = Field(
        description="Brief summary of the task"
    )

    steps: list[str] = Field(
        description="List of steps to complete the task"
    )

    estimated_complexity: str = Field(
        description="Complexity level: trivial, easy, moderate, complex, very_complex"
    )

    tools_required: list[str] = Field(
        default_factory=list,
        description="List of tools needed to complete the task"
    )

    potential_issues: Optional[list[str]] = Field(
        default=None,
        description="Potential issues or blockers"
    )


class SearchResult(BaseModel):
    """Structured search result from web or document search."""

    query: str = Field(
        description="The search query that was executed"
    )

    results: list[dict] = Field(
        default_factory=list,
        description="List of search results with title, url, snippet"
    )

    summary: Optional[str] = Field(
        default=None,
        description="AI-generated summary of the search results"
    )

    total_results: Optional[int] = Field(
        default=None,
        description="Total number of results found"
    )


class CodeOutput(BaseModel):
    """Structured code output with metadata."""

    code: str = Field(
        description="The generated or modified code"
    )

    language: str = Field(
        description="Programming language of the code"
    )

    filename: Optional[str] = Field(
        default=None,
        description="Suggested filename for the code"
    )

    explanation: Optional[str] = Field(
        default=None,
        description="Explanation of what the code does"
    )

    dependencies: Optional[list[str]] = Field(
        default=None,
        description="Required dependencies or imports"
    )


class ToolExecutionResult(BaseModel):
    """Structured result from tool execution."""

    tool_name: str = Field(
        description="Name of the tool that was executed"
    )

    tool_id: str = Field(
        description="Unique identifier for this tool execution"
    )

    status: str = Field(
        description="Execution status: pending, running, success, error"
    )

    input: Optional[dict] = Field(
        default=None,
        description="Input parameters passed to the tool"
    )

    output: Optional[str] = Field(
        default=None,
        description="Output from the tool execution"
    )

    error: Optional[str] = Field(
        default=None,
        description="Error message if execution failed"
    )

    duration_ms: Optional[int] = Field(
        default=None,
        description="Execution duration in milliseconds"
    )


class AgentHandoff(BaseModel):
    """Structured data for agent-to-agent handoff."""

    from_agent: str = Field(
        description="Name of the agent handing off"
    )

    to_agent: str = Field(
        description="Name of the agent receiving the handoff"
    )

    reason: str = Field(
        description="Reason for the handoff"
    )

    context: Optional[dict] = Field(
        default=None,
        description="Context data being passed to the new agent"
    )
