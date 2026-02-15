"""
Default Pydantic schemas for structured output.

These schemas can be used with Strands' native structured_output_model feature
to extract typed responses from the agent.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AgentResponse(BaseModel):
    """Default schema for agent structured output."""
    content: str = Field(description="The main content of the response")
    reasoning: Optional[str] = Field(default=None, description="Chain of thought or reasoning")
    tools_used: Optional[List[str]] = Field(default=None, description="List of tools that were invoked")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")


class ExtractionResult(BaseModel):
    """Schema for information extraction tasks."""
    entities: Optional[Dict[str, List[str]]] = Field(default=None, description="Extracted entities by type")
    summary: Optional[str] = Field(default=None, description="Summary of the content")
    sentiment: Optional[str] = Field(default=None, description="Sentiment analysis result")


class TaskResult(BaseModel):
    """Schema for task completion results."""
    task_id: str = Field(description="Unique task identifier")
    status: str = Field(description="Task status: success, failed, or in_progress")
    result: Optional[Any] = Field(default=None, description="Task result data")
    error: Optional[str] = Field(default=None, description="Error message if failed")


# Registry of available schemas
SCHEMA_REGISTRY = {
    "AgentResponse": AgentResponse,
    "ExtractionResult": ExtractionResult,
    "TaskResult": TaskResult,
}


def get_schema(name: str) -> type[BaseModel] | None:
    """Get a schema by name from the registry."""
    return SCHEMA_REGISTRY.get(name)
