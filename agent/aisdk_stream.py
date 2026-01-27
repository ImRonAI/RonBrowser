"""
AI SDK v5 UIMessageStream SSE emitter for Strands Agents.

Emits Server-Sent Events in the exact format expected by Vercel AI SDK v5
useChat hook with UIMessageStream protocol.

Validated against:
- DeepWiki: vercel/ai repository - UIMessageStream SSE protocol
- DeepWiki: strands-agents/sdk-python - callback event format
- Reference: ron-ai-web/project/backend/ron_agents/claude/aisdk_stream.py

Protocol:
- All events are JSON objects sent as: data: {json}\n\n
- Requires header: x-vercel-ai-ui-message-stream: v1
- Text/reasoning blocks use start/delta/end lifecycle with unique IDs
- Tool calls use tool-input-start, tool-input-available, tool-output-available
- Steps delineate LLM turns: start-step → content → finish-step
"""

import base64
import json
import logging
import re
import uuid
from typing import Dict, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class AISDKStreamEmitter:
    """
    Emits AI SDK v5 compliant Server-Sent Events.

    Single source of truth for SSE emission - maps Strands callback events
    to AI SDK v5 UIMessageStream format.
    """

    @staticmethod
    def emit_start(message_id: Optional[str] = None) -> str:
        """Start of message stream."""
        event: Dict[str, Any] = {"type": "start"}
        if message_id is not None:
            event["messageId"] = message_id
        return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_start_step() -> str:
        """Start of processing step (one LLM turn)."""
        return f'data: {json.dumps({"type": "start-step"})}\n\n'

    @staticmethod
    def emit_text_start(text_id: str) -> str:
        """Start of text block."""
        return f'data: {json.dumps({"type": "text-start", "id": text_id})}\n\n'

    @staticmethod
    def emit_text_delta(text_id: str, delta: str) -> str:
        """Incremental text content delta."""
        return f'data: {json.dumps({"type": "text-delta", "id": text_id, "delta": delta})}\n\n'

    @staticmethod
    def emit_text_end(text_id: str) -> str:
        """End of text block."""
        return f'data: {json.dumps({"type": "text-end", "id": text_id})}\n\n'

    @staticmethod
    def emit_reasoning_start(reasoning_id: str) -> str:
        """Start of reasoning/thinking block."""
        return f'data: {json.dumps({"type": "reasoning-start", "id": reasoning_id})}\n\n'

    @staticmethod
    def emit_reasoning_delta(reasoning_id: str, delta: str) -> str:
        """Incremental reasoning content delta."""
        return f'data: {json.dumps({"type": "reasoning-delta", "id": reasoning_id, "delta": delta})}\n\n'

    @staticmethod
    def emit_reasoning_end(reasoning_id: str) -> str:
        """End of reasoning block."""
        return f'data: {json.dumps({"type": "reasoning-end", "id": reasoning_id})}\n\n'

    @staticmethod
    def emit_tool_input_start(tool_call_id: str, tool_name: str) -> str:
        """Start of tool call."""
        return f'data: {json.dumps({"type": "tool-input-start", "toolCallId": tool_call_id, "toolName": tool_name})}\n\n'

    @staticmethod
    def emit_tool_input_available(tool_call_id: str, tool_name: str, input_data: Any) -> str:
        """Complete tool input available. Handles serialization errors gracefully."""
        try:
            return f'data: {json.dumps({"type": "tool-input-available", "toolCallId": tool_call_id, "toolName": tool_name, "input": input_data})}\n\n'
        except (TypeError, ValueError) as e:
            logger.warning(f"Tool input serialization failed for {tool_call_id}: {e}")
            return f'data: {json.dumps({"type": "tool-input-available", "toolCallId": tool_call_id, "toolName": tool_name, "input": {"error": "input_not_serializable"}})}\n\n'

    @staticmethod
    def emit_tool_output_available(tool_call_id: str, output: Any, tool_name: Optional[str] = None) -> str:
        """Tool execution output/result. Handles serialization errors gracefully."""
        try:
            event: Dict[str, Any] = {"type": "tool-output-available", "toolCallId": tool_call_id, "output": output}
            if tool_name:
                event["toolName"] = tool_name
            return f'data: {json.dumps(event)}\n\n'
        except (TypeError, ValueError) as e:
            # Fallback for unserializable data (bytes, custom objects, etc.)
            logger.warning(f"Tool output serialization failed for {tool_call_id}: {e}")
            event: Dict[str, Any] = {
                "type": "tool-output-available",
                "toolCallId": tool_call_id,
                "output": {"error": "output_not_serializable", "type": str(type(output))},
            }
            if tool_name:
                event["toolName"] = tool_name
            return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_tool_output_error(tool_call_id: str, error_text: str, tool_name: Optional[str] = None) -> str:
        """Tool execution error."""
        event: Dict[str, Any] = {"type": "tool-output-error", "toolCallId": tool_call_id, "errorText": error_text}
        if tool_name:
            event["toolName"] = tool_name
        return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_finish_step() -> str:
        """End of processing step."""
        return f'data: {json.dumps({"type": "finish-step"})}\n\n'

    @staticmethod
    def emit_finish(finish_reason: Optional[str] = None) -> str:
        """End of message stream."""
        event: Dict[str, Any] = {"type": "finish"}
        if finish_reason is not None:
            event["finishReason"] = finish_reason
        return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_done() -> str:
        """Stream termination marker."""
        return 'data: [DONE]\n\n'

    @staticmethod
    def emit_error(error_text: str) -> str:
        """Error event."""
        return f'data: {json.dumps({"type": "error", "errorText": error_text})}\n\n'

    @staticmethod
    def emit_workflow_visualization(nodes: list, edges: list, active_agents: list = None, title: str = None) -> str:
        """Workflow visualization event for swarm/workflow/graph orchestration."""
        event = {
            "type": "workflow_visualization",
            "nodes": nodes,
            "edges": edges
        }
        if active_agents:
            event["activeAgents"] = active_agents
        if title:
            event["title"] = title
        return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_data_part(part_type: str, data: Any, part_id: Optional[str] = None, transient: bool = False) -> str:
        """Emit a custom data part (AI SDK UIMessageStream)."""
        event: Dict[str, Any] = {"type": f"data-{part_type}", "data": data}
        if part_id is not None:
            event["id"] = part_id
        if transient:
            event["transient"] = True
        return f'data: {json.dumps(event)}\n\n'

    @staticmethod
    def emit_ping() -> str:
        """SSE ping/keepalive comment."""
        return ': ping\n\n'


class AISDKCallbackHandler:
    """
    Strands callback handler that emits AI SDK v5 UIMessageStream events.

    Maps Strands callback events to AI SDK v5 format:
    - init_event_loop → start
    - start_event_loop → start-step
    - reasoningText → reasoning-start/delta/end
    - data → text-start/delta/end
    - current_tool_use → tool-input-start + tool-input-available
    - tool_stream_event → tool-output-available
    - complete → finish-step + finish + [DONE]
    
    CRITICAL: Per AGENTS.md UIMessageStream contract, every stream MUST emit
    terminal events (finish + [DONE]) even on errors or early exits.
    Use finalize() to ensure terminal events are emitted if result= callback
    was never received.
    """

    def __init__(self, emit_fn):
        """
        Args:
            emit_fn: Callable that receives SSE string to emit (e.g., queue.put_nowait)
        """
        self.emit = emit_fn
        self.emitter = AISDKStreamEmitter()

        # State tracking
        self.started = False
        self.in_step = False
        self.in_reasoning = False
        self.in_text = False
        self.reasoning_id: Optional[str] = None
        self.text_id: Optional[str] = None
        self.pending_tool_ids: set = set()  # Track tools awaiting output
        self._last_tool_id: Optional[str] = None
        self._last_tool_name: Optional[str] = None
        # Streaming <think> handling
        self._in_think_tag = False
        # Terminal event tracking
        self._finished = False  # True once finish + [DONE] have been emitted

    def _new_id(self, prefix: str = "") -> str:
        """Generate unique ID for blocks."""
        return f"{prefix}{uuid.uuid4().hex[:8]}"

    def _is_orchestration_tool(self, tool_name: Optional[str]) -> bool:
        return bool(self._canonical_tool_name(tool_name))

    def _normalize_tool_name(self, tool_name: Optional[str]) -> str:
        normalized = (tool_name or "").lower().strip()
        if not normalized:
            return ""
        parts = re.split(r"[./:\\\s|-]+", normalized)
        return parts[-1] if parts else normalized

    def _canonical_tool_name(self, tool_name: Optional[str]) -> str:
        normalized = (tool_name or "").lower().strip()
        if not normalized:
            return ""
        parts = re.split(r"[./:\\\s|-]+", normalized)
        for part in parts:
            if part in ("swarm", "workflow", "graph"):
                return part
        return ""

    def _emit_reasoning_chunk(self, chunk: str):
        """Emit reasoning chunk, opening block if needed."""
        if not chunk:
            return
        self._ensure_started()
        self._close_text()
        if not self.in_reasoning:
            self.reasoning_id = self._new_id("r-")
            self.emit(self.emitter.emit_reasoning_start(self.reasoning_id))
            self.in_reasoning = True
        self.emit(self.emitter.emit_reasoning_delta(self.reasoning_id, chunk))

    def _emit_text_chunk(self, chunk: str):
        """Emit text chunk, opening block if needed."""
        if not chunk:
            return
        self._ensure_started()
        self._close_reasoning()
        if not self.in_text:
            self.text_id = self._new_id("t-")
            self.emit(self.emitter.emit_text_start(self.text_id))
            self.in_text = True
        self.emit(self.emitter.emit_text_delta(self.text_id, chunk))

    def _emit_text_with_think(self, data: str):
        """Parse <think> tags from text and emit reasoning blocks."""
        if not data:
            return

        while data:
            if self._in_think_tag:
                end_idx = data.find("</think>")
                if end_idx == -1:
                    self._emit_reasoning_chunk(data)
                    return
                self._emit_reasoning_chunk(data[:end_idx])
                data = data[end_idx + len("</think>"):]
                self._in_think_tag = False
                continue

            start_idx = data.find("<think>")
            if start_idx == -1:
                self._emit_text_chunk(data)
                return
            if start_idx > 0:
                self._emit_text_chunk(data[:start_idx])
            data = data[start_idx + len("<think>"):]
            self._in_think_tag = True

    def _close_reasoning(self):
        """Close reasoning block if open."""
        if self.in_reasoning and self.reasoning_id:
            self.emit(self.emitter.emit_reasoning_end(self.reasoning_id))
            self.in_reasoning = False
            self.reasoning_id = None

    def _close_text(self):
        """Close text block if open."""
        if self.in_text and self.text_id:
            self.emit(self.emitter.emit_text_end(self.text_id))
            self.in_text = False
            self.text_id = None

    def _ensure_started(self):
        """Ensure stream and step have started."""
        if not self.started:
            self.emit(self.emitter.emit_start())
            self.started = True
        if not self.in_step:
            self.emit(self.emitter.emit_start_step())
            self.in_step = True

    def _emit_workflow_visualization(self, tool_name: str, output: Any, tool_id: str):
        """
        Transform swarm/workflow/graph tool output into workflow_visualization event.

        Based on strands-agents/tools data structures:
        - Swarm: SwarmResult with node_history, results, status
        - Workflow: workflow state with tasks, task_results, status
        - Graph: parallel execution results
        """
        try:
            # Parse output if it's a dict with 'text' field containing JSON string
            if isinstance(output, dict) and "text" in output:
                try:
                    data = json.loads(output["text"])
                except (json.JSONDecodeError, TypeError):
                    data = output
            else:
                data = output

            nodes = []
            edges = []
            active_agents = []

            base_name = self._canonical_tool_name(tool_name)
            if not base_name:
                return

            if base_name == "swarm":
                # Transform SwarmResult
                node_history = data.get("node_history", [])
                results = data.get("results", {})

                # Create nodes from agents
                for idx, agent_id in enumerate(node_history):
                    node_id = str(agent_id) if hasattr(agent_id, 'node_id') else agent_id

                    nodes.append({
                        "id": node_id,
                        "type": "agentNode",
                        "position": {"x": idx * 250, "y": 100},
                        "data": {
                            "label": node_id,
                            "status": "complete" if node_id in results else "pending",
                            "isAgentActive": False
                        }
                    })

                # Create edges between sequential agents
                for i in range(len(node_history) - 1):
                    source = str(node_history[i]) if hasattr(node_history[i], 'node_id') else node_history[i]
                    target = str(node_history[i + 1]) if hasattr(node_history[i + 1], 'node_id') else node_history[i + 1]
                    edges.append({
                        "id": f"{source}-{target}",
                        "source": source,
                        "target": target,
                        "animated": False
                    })

                # Add active agents with their results
                for agent_id, result in results.items():
                    result_content = result.get("result", {}).get("content", [])
                    result_text = ""
                    if result_content:
                        result_text = result_content[0].get("text", "") if isinstance(result_content[0], dict) else str(result_content[0])

                    active_agents.append({
                        "id": agent_id,
                        "name": agent_id,
                        "chainOfThought": {
                            "steps": [{
                                "label": "Agent Output",
                                "description": result_text[:500],
                                "status": "complete"
                            }]
                        }
                    })

            elif base_name == "workflow":
                # Transform workflow state
                tasks = data.get("tasks", [])
                task_results = data.get("task_results", {})

                # Create nodes from tasks
                for idx, task in enumerate(tasks):
                    task_id = task.get("task_id", f"task-{idx}")
                    task_status = task_results.get(task_id, {}).get("status", "pending")

                    # Map workflow status to UI status
                    ui_status = "complete" if task_status == "completed" else task_status

                    nodes.append({
                        "id": task_id,
                        "type": "agentNode",
                        "position": {"x": idx * 250, "y": 100},
                        "data": {
                            "label": task_id,
                            "description": task.get("description", "")[:100],
                            "status": ui_status,
                            "isAgentActive": task_status == "running"
                        }
                    })

                # Create edges from dependencies
                for task in tasks:
                    task_id = task.get("task_id")
                    dependencies = task.get("dependencies", [])
                    for dep_id in dependencies:
                        edges.append({
                            "id": f"{dep_id}-{task_id}",
                            "source": dep_id,
                            "target": task_id,
                            "animated": task_results.get(task_id, {}).get("status") == "running"
                        })

                # Add active agents for running tasks
                for task_id, result in task_results.items():
                    if result.get("status") == "running":
                        task_info = next((t for t in tasks if t.get("task_id") == task_id), None)
                        if task_info:
                            active_agents.append({
                                "id": task_id,
                                "name": task_id,
                                "chainOfThought": {
                                    "steps": [{
                                        "label": "Task Execution",
                                        "description": task_info.get("description", ""),
                                        "status": "running"
                                    }]
                                }
                            })

            elif base_name == "graph":
                # Transform graph results (parallel execution)
                # Graph structure depends on implementation - use generic structure
                if isinstance(data, dict):
                    for idx, (node_id, result) in enumerate(data.items()):
                        nodes.append({
                            "id": node_id,
                            "type": "agentNode",
                            "position": {"x": idx * 250, "y": 100},
                            "data": {
                                "label": node_id,
                                "status": "complete",
                                "isAgentActive": False
                            }
                        })

            # Emit workflow visualization as AI SDK data part
            if nodes:
                self.emit(self.emitter.emit_data_part(
                    "orchestration",
                    {
                        "eventType": "workflow_visualization",
                        "toolName": base_name,
                        "toolCallId": tool_id,
                        "nodes": nodes,
                        "edges": edges,
                        "activeAgents": active_agents if active_agents else None,
                        "title": f"{base_name.capitalize()} Orchestration",
                    },
                    transient=True,
                ))

        except Exception as e:
            # Log error but don't fail the stream
            import logging
            logging.error(f"Failed to emit workflow visualization for {tool_name}: {e}")

    def _json_safe(self, payload: Any) -> Any:
        """
        Best-effort JSON-safe conversion for SSE payloads.
        
        CRITICAL: Handles binary data (bytes) which breaks json.dumps.
        Tools like image_reader and browser.screenshot return raw bytes
        that must be base64-encoded or replaced with placeholders.
        """
        def sanitize_recursive(obj: Any) -> Any:
            """Recursively sanitize an object for JSON serialization."""
            if obj is None:
                return None
            if isinstance(obj, bytes):
                # Binary data - encode to base64 or return placeholder for large data
                if len(obj) > 100_000:  # >100KB - too large for SSE
                    return f"[binary data: {len(obj)} bytes, base64 truncated]"
                try:
                    return f"data:application/octet-stream;base64,{base64.b64encode(obj).decode('ascii')}"
                except Exception:
                    return f"[binary data: {len(obj)} bytes]"
            if isinstance(obj, (str, int, float, bool)):
                return obj
            if isinstance(obj, Enum):
                return obj.value
            if isinstance(obj, set):
                return [sanitize_recursive(x) for x in obj]
            if isinstance(obj, (list, tuple)):
                return [sanitize_recursive(x) for x in obj]
            if isinstance(obj, dict):
                result = {}
                for k, v in obj.items():
                    # Special handling for image content blocks from tools
                    if k == "image" and isinstance(v, dict):
                        source = v.get("source", {})
                        if isinstance(source.get("bytes"), bytes):
                            img_bytes = source["bytes"]
                            img_format = v.get("format", "png")
                            if len(img_bytes) > 500_000:  # >500KB image
                                result[k] = {"format": img_format, "note": f"[image: {len(img_bytes)} bytes - too large for SSE]"}
                            else:
                                try:
                                    b64 = base64.b64encode(img_bytes).decode('ascii')
                                    result[k] = {"format": img_format, "base64": b64}
                                except Exception:
                                    result[k] = {"format": img_format, "note": f"[image: {len(img_bytes)} bytes]"}
                            continue
                    result[str(k)] = sanitize_recursive(v)
                return result
            # Handle objects with to_dict method
            if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
                try:
                    return sanitize_recursive(obj.to_dict())
                except Exception:
                    pass
            # Fallback to string representation
            try:
                return str(obj)
            except Exception:
                return "[unserializable object]"

        try:
            sanitized = sanitize_recursive(payload)
            # Validate it's actually JSON-serializable
            json.dumps(sanitized)
            return sanitized
        except Exception as e:
            logger.warning(f"JSON sanitization failed: {e}")
            return {"error": "payload_not_serializable", "type": str(type(payload))}

    def __call__(self, **kwargs: Any) -> None:
        """
        Process Strands callback event and emit AI SDK v5 SSE events.

        Strands event keys:
        - init_event_loop: bool - Event loop initializing
        - start_event_loop: bool - Event loop starting
        - reasoningText: str - Reasoning/thinking content (with reasoning=True)
        - data: str - Text content
        - current_tool_use: dict - Tool being called {toolUseId, name, input}
        - tool_stream_event: dict - Streaming output from tool {data, tool_use}
        - complete: bool - Stream complete
        - result: AgentResult - Final result
        """
        # Handle lifecycle events
        if kwargs.get("init_event_loop"):
            self._ensure_started()
            return

        if kwargs.get("start_event_loop"):
            self._ensure_started()
            return

        # Handle multiagent orchestration events (graph/swarm)
        event_type = kwargs.get("type")
        if isinstance(event_type, str) and event_type.startswith("multiagent_"):
            self._ensure_started()
            payload = {k: v for k, v in kwargs.items() if k != "type"}
            payload["eventType"] = event_type
            self.emit(self.emitter.emit_data_part("orchestration", self._json_safe(payload), transient=True))
            return

        # Handle reasoning content
        reasoning_text = kwargs.get("reasoningText")
        if reasoning_text:
            self._emit_reasoning_chunk(reasoning_text)
            return

        # Handle text content
        data = kwargs.get("data")
        if data:
            self._emit_text_with_think(data)
            return

        # Handle tool use
        current_tool_use = kwargs.get("current_tool_use")
        if current_tool_use and current_tool_use.get("name"):
            self._ensure_started()
            self._close_reasoning()
            self._close_text()

            tool_id = current_tool_use.get("toolUseId", self._new_id("tool-"))
            tool_name = current_tool_use.get("name")
            tool_input = current_tool_use.get("input", {})
            self._last_tool_id = tool_id
            self._last_tool_name = tool_name

            # Parse input if it's a string (Strands accumulates JSON string)
            if isinstance(tool_input, str):
                try:
                    tool_input = json.loads(tool_input)
                except json.JSONDecodeError:
                    tool_input = {"raw": tool_input}

            # Emit start only if we haven't seen this tool yet
            if tool_id not in self.pending_tool_ids:
                self.emit(self.emitter.emit_tool_input_start(tool_id, tool_name))
                self.pending_tool_ids.add(tool_id)

            # Always emit the latest input availability to support streaming arguments
            # This ensures we don't get stuck with the initial empty/partial input
            self.emit(self.emitter.emit_tool_input_available(tool_id, tool_name, tool_input))
            return

        # Handle tool streaming output
        tool_stream_event = kwargs.get("tool_stream_event")
        if tool_stream_event:
            tool_use = tool_stream_event.get("tool_use", {})
            tool_id = tool_use.get("toolUseId") or "unknown"
            tool_name = tool_use.get("name") or self._last_tool_name
            if tool_id == "unknown" and self._last_tool_id:
                tool_id = self._last_tool_id
            output_data = tool_stream_event.get("data")

            if (
                isinstance(output_data, dict)
                and isinstance(output_data.get("type"), str)
                and output_data["type"].startswith("multiagent_")
            ):
                self.emit(self.emitter.emit_data_part("orchestration", self._json_safe(output_data), transient=True))
                return

            # CRITICAL: Sanitize output for JSON serialization (handles bytes from image tools)
            safe_output = self._json_safe(output_data)
            self.emit(self.emitter.emit_tool_output_available(tool_id, safe_output, tool_name))
            self.pending_tool_ids.discard(tool_id)
            return

        # Handle tool result (from result message content)
        tool_result = kwargs.get("tool_result")
        if tool_result:
            tool_id = tool_result.get("toolUseId") or "unknown"
            tool_name = tool_result.get("name") or self._last_tool_name or "unknown"
            if tool_id == "unknown" and self._last_tool_id:
                tool_id = self._last_tool_id
            status = tool_result.get("status", "success")
            content = tool_result.get("content", [])
            self._last_tool_id = tool_id
            self._last_tool_name = tool_name

            if status == "error":
                error_text = content[0].get("text", "Tool execution failed") if content else "Tool execution failed"
                self.emit(self.emitter.emit_tool_output_error(tool_id, error_text, tool_name))
            else:
                output = content[0] if len(content) == 1 else content

            # Check if this is an orchestration tool (swarm/workflow/graph)
            if self._is_orchestration_tool(tool_name):
                self._emit_workflow_visualization(tool_name, output, tool_id)

            # CRITICAL: Sanitize output for JSON serialization (handles bytes from image_reader, screenshots, etc.)
            safe_output = self._json_safe(output)
            self.emit(self.emitter.emit_tool_output_available(tool_id, safe_output, tool_name))

            self.pending_tool_ids.discard(tool_id)
            return

        # Handle complete event (final chunk of streaming response)
        # This indicates the current streaming content is complete
        complete = kwargs.get("complete")
        if complete:
            # Close any open content blocks
            self._close_reasoning()
            self._close_text()
            return

        # Handle result event (AgentResult - final event from agent execution)
        # This is the definitive end of the agent's invocation
        result = kwargs.get("result")
        if result:
            self._emit_terminal_events(result=result)
            return

    def _emit_terminal_events(self, result=None, finish_reason: str = "stop"):
        """
        Emit terminal events (finish + [DONE]) in correct order.
        
        CRITICAL: Per UIMessageStream protocol, these events MUST be emitted
        to signal completion. Without them, the UI stays in non-ready state.
        
        Args:
            result: Optional AgentResult to extract stop_reason from
            finish_reason: Fallback finish reason if no result provided
        """
        if self._finished:
            return  # Already emitted terminal events
        
        self._ensure_started()
        # Close any remaining open blocks
        self._close_reasoning()
        self._close_text()

        # Extract stop reason from AgentResult if provided
        stop_reason = finish_reason
        if result and hasattr(result, "stop_reason"):
            sr = result.stop_reason
            if sr:
                # Map Strands stop reasons to AI SDK finish reasons
                stop_reason_str = str(sr).lower()
                if "end_turn" in stop_reason_str:
                    stop_reason = "stop"
                elif "tool_use" in stop_reason_str:
                    stop_reason = "tool-calls"
                elif "max" in stop_reason_str:
                    stop_reason = "length"
                elif "error" in stop_reason_str:
                    stop_reason = "error"
                else:
                    stop_reason = "stop"

        # Emit terminal events in correct order per UIMessageStream protocol
        if self.in_step:
            self.emit(self.emitter.emit_finish_step())
            self.in_step = False

        self.emit(self.emitter.emit_finish(stop_reason))
        self.emit(self.emitter.emit_done())
        self._finished = True

    def finalize(self, finish_reason: str = "stop"):
        """
        Force emit terminal events if they haven't been emitted yet.
        
        Call this method when:
        - Agent execution completes but result= callback was never received
        - Agent times out or is cancelled
        - An unhandled exception occurs
        
        This ensures the UI receives the required terminal events per AGENTS.md.
        
        Args:
            finish_reason: One of "stop", "error", "timeout", "length", "tool-calls"
        """
        if not self._finished:
            self._emit_terminal_events(finish_reason=finish_reason)

    @property
    def is_finished(self) -> bool:
        """Check if terminal events have already been emitted."""
        return self._finished
