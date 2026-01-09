"""ReAct module with integrated memory, implemented using official DSPy ReAct.

This file intentionally avoids deprecated/nonexistent DSPy APIs like:
- dspy.TypedChainOfThought
- dspy.Assert / dspy.Suggest

Instead, it delegates tool selection + execution to `dspy.ReAct` and converts
the returned `trajectory` into the RonBrowser-friendly `tool_calls` structure.
"""

from __future__ import annotations

import dspy
from typing import Any, Callable, Dict, List, Optional, Tuple
import json

from ..memory import ConversationMemory
from ..signatures.react_signature import ReActSignature


def _build_dspy_tools(tools: Dict[str, Callable]) -> List[dspy.Tool]:
    """Build a stable list of DSPy Tool objects from a {name: callable} mapping.

    We explicitly pass `name=` so tool names match the registry keys even for
    wrappers whose `__name__` would otherwise differ.
    """
    dspy_tools: List[dspy.Tool] = []
    for name, func in tools.items():
        desc = None
        if getattr(func, "__doc__", None):
            desc = func.__doc__.strip().splitlines()[0].strip() if func.__doc__ else None
        dspy_tools.append(dspy.Tool(func, name=name, desc=desc))
    return dspy_tools


def _extract_tool_calls_from_prediction(pred: dspy.Prediction) -> Tuple[List[Dict[str, Any]], int, str]:
    """Extract tool calls from DSPy ReAct prediction in a robust way.

    Uses the prediction object's attributes directly instead of parsing
    trajectory keys, making it more resilient to DSPy internal changes.
    """
    tool_calls: List[Dict[str, Any]] = []
    iterations = 0
    last_thought = ""

    # Try to get trajectory or actions from prediction
    trajectory = getattr(pred, "trajectory", None)
    actions = getattr(pred, "actions", None)

    if trajectory and isinstance(trajectory, dict):
        # Parse trajectory dict safely
        idx = 0
        while idx < 50:  # Safety limit
            thought_key = f"thought_{idx}"
            tool_key = f"tool_name_{idx}"
            args_key = f"tool_args_{idx}"
            obs_key = f"observation_{idx}"

            # Check if this iteration exists
            if tool_key not in trajectory:
                break

            thought = trajectory.get(thought_key, "")
            tool_name = trajectory.get(tool_key, "")
            tool_args = trajectory.get(args_key, {})
            observation = trajectory.get(obs_key, "")

            if thought:
                last_thought = thought

            # Skip the synthetic 'finish' tool
            if tool_name and tool_name != "finish":
                tool_call = {
                    "tool": tool_name,
                    "args": tool_args if isinstance(tool_args, dict) else {},
                    "iteration": idx + 1,
                    "thought": thought,
                }

                # Detect errors in observation
                if observation and "error" in str(observation).lower():
                    tool_call["error"] = str(observation)
                else:
                    tool_call["result"] = observation

                tool_calls.append(tool_call)

            iterations = idx + 1
            idx += 1

    elif actions and isinstance(actions, list):
        # Alternative: use actions list if available
        for i, action in enumerate(actions):
            if isinstance(action, dict):
                tool_calls.append({
                    "tool": action.get("tool", "unknown"),
                    "args": action.get("args", {}),
                    "iteration": i + 1,
                    "thought": action.get("thought", ""),
                    "result": action.get("result", ""),
                })
                iterations = i + 1

    # Extract final thought if available
    if not last_thought:
        last_thought = getattr(pred, "reasoning", "") or getattr(pred, "thought", "")

    return tool_calls, iterations, last_thought


class ReActWithMemory(dspy.Module):
    """RonBrowser ReAct agent with conversation memory.

    Public contract (kept stable for RonAgent):
    - input: `request: str`
    - outputs: `response`, `reasoning`, `tool_calls`, `iterations`
    """

    def __init__(
        self,
        tools: Dict[str, Callable],
        max_iters: int = 10,
        memory: Optional[ConversationMemory] = None,
    ):
        super().__init__()
        self.max_iters = max_iters
        self.memory = memory or ConversationMemory()
        self.tools: Dict[str, Callable] = tools
        self.tool_names: List[str] = list(tools.keys())

        # Build DSPy tools once during initialization
        self._dspy_tools = _build_dspy_tools(tools)

        # Use typed signature instead of string
        self._react = dspy.ReAct(
            signature=ReActSignature,
            tools=self._dspy_tools,
            max_iters=self.max_iters,
        )

        # Track if module has been optimized
        self._optimized = False
        self._optimization_state = None

    def set_tools(self, tools: Dict[str, Callable]) -> None:
        """Update tool registry WITHOUT rebuilding the ReAct module.

        This preserves optimization state while allowing tool updates.
        For complete rebuild, create a new ReActWithMemory instance.
        """
        # Update tool registry
        self.tools = tools
        self.tool_names = list(tools.keys())

        # Update DSPy tools list
        self._dspy_tools = _build_dspy_tools(tools)

        # WARNING: Updating tools after optimization may affect performance
        # The optimized prompts/examples may reference old tool names
        if self._optimized:
            import warnings
            warnings.warn(
                "Updating tools after optimization may degrade performance. "
                "Consider re-optimizing or creating a new module instance.",
                RuntimeWarning,
                stacklevel=2
            )

    def forward(self, request: str) -> dspy.Prediction:
        # Provide a context string that includes recent conversation + relevant memories.
        # Note: Adding to memory should happen AFTER successful processing
        context = self.memory.get_context(query=request)

        try:
            pred = self._react(request=request, context=context)
        except Exception as e:
            error_msg = f"Reasoning error: {str(e)}"
            # Don't pollute memory with error messages
            return dspy.Prediction(
                response=error_msg,
                reasoning="Error during reasoning",
                tool_calls=[],
                iterations=0,
            )

        # Add to memory AFTER successful processing
        self.memory.add_user(request)

        # Use the improved extraction function
        tool_calls, iterations, last_thought = _extract_tool_calls_from_prediction(pred)

        response = getattr(pred, "response", None)
        response_str = str(response) if response is not None else ""

        # Persist assistant response with tool call summary.
        self.memory.add_assistant(response_str, tool_calls)

        return dspy.Prediction(
            response=response_str,
            reasoning=last_thought,
            tool_calls=tool_calls,
            iterations=iterations,
            trajectory=trajectory,
        )

    def reset_memory(self) -> None:
        """Clear conversation memory."""
        self.memory.clear()

    def get_memory(self) -> ConversationMemory:
        """Get the conversation memory instance."""
        return self.memory
