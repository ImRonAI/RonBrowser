"""Desktop Sandbox Agent - Strands agent with use_computer exposed via A2A."""
import json
import logging
from typing import Any, Callable

from strands import Agent
from strands.models import BedrockModel
from strands.multiagent.a2a import A2AServer
from strands.multiagent.a2a.executor import StrandsA2AExecutor
from a2a.server.tasks import TaskUpdater, InMemoryTaskStore
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.types import TaskState
from a2a.utils import new_agent_text_message

from aisdk_stream import AISDKStreamEmitter
from strands_tools import (
    use_computer,
    shell,
    file_read,
    file_write,
    editor,
    load_tool,
    retrieve,
    mem0_memory,
    environment,
    http_request,
    batch,
    use_agent,
    workflow,
    swarm,
    graph,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SANDBOX_SYSTEM_PROMPT = """You are a Desktop Sandbox Agent running inside an isolated Docker container with a virtual desktop.

## Your Environment:
- Full Linux desktop (1024x768) you can control
- Firefox and Chromium browsers installed
- Safe, isolated sandbox - actions only affect this container

## Your Tools:
- use_computer: Control the virtual desktop
  - action="screenshot" - see current screen
  - action="click", x=100, y=200 - click at coordinates
  - action="type", text="hello" - type text
  - action="key", key="enter" - press key
  - action="hotkey", key="ctrl+c" - key combo
  - action="scroll", dy=-3 - scroll
- shell: Run commands
- file_read/file_write: File operations

## Workflow:
1. Take screenshot to see current state
2. Perform action
3. Take screenshot to verify result

## Available Tools:
- Computer: use_computer (screenshot, click, type, scroll, hotkey)
- Files: file_read, file_write, editor
- Shell: shell (run commands)
- Meta: load_tool (create new tools at runtime)
- Memory: retrieve, mem0_memory
- System: environment
- Network: http_request
- Orchestration: batch, use_agent, workflow, swarm, graph
"""


class A2ACallbackHandler:
    """Captures reasoning and outputs for A2A response streaming."""

    def __init__(self):
        self.reasoning_chunks = []
        self.content_chunks = []
        self.tool_uses = []

    def __call__(self, **kwargs: Any) -> None:
        reasoning = kwargs.get("reasoningText")
        data = kwargs.get("data", "")
        tool_use = kwargs.get("current_tool_use", {})

        if reasoning:
            self.reasoning_chunks.append(reasoning)
            logger.info(f"[thinking] {reasoning[:100]}...")

        if data:
            self.content_chunks.append(data)
            print(data, end="", flush=True)

        if tool_use.get("name"):
            self.tool_uses.append({
                "tool": tool_use.get("name"),
                "input": tool_use.get("input", {})
            })
            logger.info(f"[tool] {tool_use.get('name')}")

    def get_full_response(self) -> dict:
        """Return structured response with reasoning and content."""
        return {
            "reasoning": "".join(self.reasoning_chunks),
            "content": "".join(self.content_chunks),
            "tool_uses": self.tool_uses
        }


class ReasoningA2AExecutor(StrandsA2AExecutor):
    """Extended A2A executor that streams AI SDK v5 formatted events back to client."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.emitter = AISDKStreamEmitter()
        self._text_id = None
        self._reasoning_id = None
        self._pending_tools = set()

    def _new_id(self, prefix: str = "") -> str:
        import uuid
        return f"{prefix}{uuid.uuid4().hex[:8]}"

    async def _handle_streaming_event(self, event: dict[str, Any], updater: TaskUpdater) -> None:
        if "data" in event:
            if text_content := event["data"]:
                # Close reasoning if transitioning to text
                if self._reasoning_id:
                    await updater.update_status(
                        TaskState.working,
                        new_agent_text_message(self.emitter.emit_reasoning_end(self._reasoning_id).strip(), updater.context_id, updater.task_id),
                    )
                    self._reasoning_id = None

                if not self._text_id:
                    self._text_id = self._new_id("t-")
                    await updater.update_status(
                        TaskState.working,
                        new_agent_text_message(self.emitter.emit_text_start(self._text_id).strip(), updater.context_id, updater.task_id),
                    )

                await updater.update_status(
                    TaskState.working,
                    new_agent_text_message(self.emitter.emit_text_delta(self._text_id, text_content).strip(), updater.context_id, updater.task_id),
                )

        elif "reasoningText" in event:
            if reasoning_text := event["reasoningText"]:
                # Close text if transitioning to reasoning
                if self._text_id:
                    await updater.update_status(
                        TaskState.working,
                        new_agent_text_message(self.emitter.emit_text_end(self._text_id).strip(), updater.context_id, updater.task_id),
                    )
                    self._text_id = None

                if not self._reasoning_id:
                    self._reasoning_id = self._new_id("r-")
                    await updater.update_status(
                        TaskState.working,
                        new_agent_text_message(self.emitter.emit_reasoning_start(self._reasoning_id).strip(), updater.context_id, updater.task_id),
                    )

                await updater.update_status(
                    TaskState.working,
                    new_agent_text_message(self.emitter.emit_reasoning_delta(self._reasoning_id, reasoning_text).strip(), updater.context_id, updater.task_id),
                )

        elif "current_tool_use" in event:
            tool_use = event["current_tool_use"]
            if tool_use.get("name"):
                tool_id = tool_use.get("toolUseId", self._new_id("tool-"))
                tool_name = tool_use["name"]
                tool_input = tool_use.get("input", {})

                if isinstance(tool_input, str):
                    try:
                        tool_input = json.loads(tool_input)
                    except json.JSONDecodeError:
                        tool_input = {"raw": tool_input}

                if tool_id not in self._pending_tools:
                    await updater.update_status(
                        TaskState.working,
                        new_agent_text_message(self.emitter.emit_tool_input_start(tool_id, tool_name).strip(), updater.context_id, updater.task_id),
                    )
                    await updater.update_status(
                        TaskState.working,
                        new_agent_text_message(self.emitter.emit_tool_input_available(tool_id, tool_name, tool_input).strip(), updater.context_id, updater.task_id),
                    )
                    self._pending_tools.add(tool_id)

        elif "tool_result" in event:
            tool_result = event["tool_result"]
            tool_id = tool_result.get("toolUseId", "unknown")
            status = tool_result.get("status", "success")
            content = tool_result.get("content", [])

            if status == "error":
                error_text = content[0].get("text", "Tool execution failed") if content else "Tool execution failed"
                await updater.update_status(
                    TaskState.working,
                    new_agent_text_message(self.emitter.emit_tool_output_error(tool_id, error_text).strip(), updater.context_id, updater.task_id),
                )
            else:
                output = content[0] if len(content) == 1 else content
                await updater.update_status(
                    TaskState.working,
                    new_agent_text_message(self.emitter.emit_tool_output_available(tool_id, output).strip(), updater.context_id, updater.task_id),
                )
            self._pending_tools.discard(tool_id)

        elif "result" in event:
            # Close any open blocks
            if self._text_id:
                await updater.update_status(
                    TaskState.working,
                    new_agent_text_message(self.emitter.emit_text_end(self._text_id).strip(), updater.context_id, updater.task_id),
                )
                self._text_id = None
            if self._reasoning_id:
                await updater.update_status(
                    TaskState.working,
                    new_agent_text_message(self.emitter.emit_reasoning_end(self._reasoning_id).strip(), updater.context_id, updater.task_id),
                )
                self._reasoning_id = None

            await self._handle_agent_result(event["result"], updater)


class ReasoningA2AServer(A2AServer):
    """A2AServer that streams reasoning/thinking events back to client."""

    def __init__(self, agent: Agent, **kwargs):
        super().__init__(agent, **kwargs)
        # Replace the request handler with one using our custom executor
        self.request_handler = DefaultRequestHandler(
            agent_executor=ReasoningA2AExecutor(self.strands_agent),
            task_store=kwargs.get("task_store") or InMemoryTaskStore(),
            queue_manager=kwargs.get("queue_manager"),
            push_config_store=kwargs.get("push_config_store"),
            push_sender=kwargs.get("push_sender"),
        )


def create_sandbox_agent() -> Agent:
    """Create the sandbox agent with use_computer."""
    model = BedrockModel(
        model_id="us.anthropic.claude-opus-4-5-20250101-v1:0",
        temperature=1,
        additional_request_fields={
            "thinking": {
                "type": "enabled",
                "budget_tokens": 32768
            },
            "anthropic_beta": ["interleaved-thinking-2025-05-14", "computer-use-2025-01-24"]
        }
    )

    tools = [
        use_computer,
        shell,
        file_read,
        file_write,
        editor,
        load_tool,
        retrieve,
        mem0_memory,
        environment,
        http_request,
        batch,
        use_agent,
        workflow,
        swarm,
        graph,
    ]

    return Agent(
        name="Desktop Sandbox",
        description="Isolated virtual desktop agent for safe web browsing, coding, and desktop automation",
        model=model,
        tools=tools,
        callback_handler=A2ACallbackHandler(),
        system_prompt=SANDBOX_SYSTEM_PROMPT,
    )


if __name__ == "__main__":
    agent = create_sandbox_agent()

    server = ReasoningA2AServer(
        agent=agent,
        host="0.0.0.0",
        port=9000,
    )

    print("Desktop Sandbox A2A Server starting on port 9000")
    print("Reasoning events will stream back to client")
    server.serve()
