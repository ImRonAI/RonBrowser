"""Strands-native hook providers used by Ron Browser agents."""

from __future__ import annotations

import logging
import time
import warnings
from threading import Lock
from typing import Any

from strands.hooks import (
    AfterInvocationEvent,
    AfterToolCallEvent,
    BeforeInvocationEvent,
    BeforeToolCallEvent,
    HookProvider,
    HookRegistry,
)

from agent.api.core.config import (
    ENABLE_AGENT_LOOP_OBSERVER_HOOK,
    ENABLE_EXPERIMENTAL_HOOK_ALIASES,
    ENABLE_EXPERIMENTAL_STEERING,
    ENABLE_TOOL_HEALTH_QUARANTINE,
    HOOKS_VERBOSE_LOGGING,
    MAX_TOOL_CALLS_PER_INVOCATION,
    STEERING_SYSTEM_PROMPT,
    TOOL_HEALTH_FAILURE_THRESHOLD,
    TOOL_HEALTH_MAX_ERROR_MESSAGE_CHARS,
)

logger = logging.getLogger(__name__)

try:
    from strands.experimental.hooks.events import (
        BidiAfterInvocationEvent,
        BidiAfterToolCallEvent,
        BidiBeforeInvocationEvent,
        BidiBeforeToolCallEvent,
    )
except Exception:
    BidiAfterInvocationEvent = None
    BidiAfterToolCallEvent = None
    BidiBeforeInvocationEvent = None
    BidiBeforeToolCallEvent = None


class AgentLoopObserverHook(HookProvider):
    """Lightweight lifecycle telemetry using Strands hook events."""

    def __init__(self, verbose: bool = False):
        self._verbose = verbose
        self._lock = Lock()
        self._invocation_count = 0
        self._tool_calls = 0
        self._started_at = 0.0

    def register_hooks(self, registry: HookRegistry, **kwargs: Any) -> None:
        _ = kwargs
        registry.add_callback(BeforeInvocationEvent, self._on_before_invocation)
        registry.add_callback(BeforeToolCallEvent, self._on_before_tool_call)
        registry.add_callback(AfterToolCallEvent, self._on_after_tool_call)
        registry.add_callback(AfterInvocationEvent, self._on_after_invocation)
        if BidiBeforeInvocationEvent is not None:
            registry.add_callback(BidiBeforeInvocationEvent, self._on_before_bidi_invocation)
        if BidiBeforeToolCallEvent is not None:
            registry.add_callback(BidiBeforeToolCallEvent, self._on_before_tool_call)
        if BidiAfterToolCallEvent is not None:
            registry.add_callback(BidiAfterToolCallEvent, self._on_after_tool_call)
        if BidiAfterInvocationEvent is not None:
            registry.add_callback(BidiAfterInvocationEvent, self._on_after_bidi_invocation)

    def _on_before_invocation(self, event: BeforeInvocationEvent) -> None:
        with self._lock:
            self._invocation_count += 1
            self._tool_calls = 0
            self._started_at = time.time()

        event.agent.state.set(
            "agent_loop",
            {
                "invocation_count": self._invocation_count,
                "started_at_epoch": self._started_at,
                "tool_calls": 0,
                "status": "running",
            },
        )

        if self._verbose:
            logger.info(
                "agent_id=%s invocation=%d | started",
                event.agent.agent_id,
                self._invocation_count,
            )

    def _on_before_bidi_invocation(self, event: Any) -> None:
        with self._lock:
            self._invocation_count += 1
            self._tool_calls = 0
            self._started_at = time.time()

        event.agent.state.set(
            "agent_loop",
            {
                "invocation_count": self._invocation_count,
                "started_at_epoch": self._started_at,
                "tool_calls": 0,
                "status": "running",
                "loop_type": "bidi",
            },
        )

        if self._verbose:
            logger.info(
                "agent_id=%s invocation=%d loop_type=bidi | started",
                event.agent.agent_id,
                self._invocation_count,
            )

    def _on_before_tool_call(self, event: BeforeToolCallEvent) -> None:
        with self._lock:
            self._tool_calls += 1
            tool_calls = self._tool_calls

        loop_state = event.agent.state.get("agent_loop") or {}
        if isinstance(loop_state, dict):
            loop_state["tool_calls"] = tool_calls
            event.agent.state.set("agent_loop", loop_state)

        if self._verbose:
            request_id = event.invocation_state.get("request_id")
            logger.info(
                "agent_id=%s request_id=%s tool=%s count=%d | before_tool_call",
                event.agent.agent_id,
                request_id,
                event.tool_use.get("name"),
                tool_calls,
            )

    def _on_after_tool_call(self, event: AfterToolCallEvent) -> None:
        if not self._verbose:
            return
        request_id = event.invocation_state.get("request_id")
        logger.info(
            "agent_id=%s request_id=%s tool=%s status=%s",
            event.agent.agent_id,
            request_id,
            event.tool_use.get("name"),
            event.result.get("status"),
        )

    def _on_after_invocation(self, event: AfterInvocationEvent) -> None:
        with self._lock:
            elapsed = max(0.0, time.time() - self._started_at) if self._started_at else 0.0
            tool_calls = self._tool_calls

        stop_reason = event.result.stop_reason if event.result is not None else None
        event.agent.state.set(
            "agent_loop",
            {
                "invocation_count": self._invocation_count,
                "tool_calls": tool_calls,
                "last_duration_seconds": round(elapsed, 3),
                "last_stop_reason": stop_reason,
                "status": "idle",
            },
        )

        if self._verbose:
            logger.info(
                "agent_id=%s stop_reason=%s tool_calls=%d duration=%.3fs",
                event.agent.agent_id,
                stop_reason,
                tool_calls,
                elapsed,
            )

    def _on_after_bidi_invocation(self, event: Any) -> None:
        with self._lock:
            elapsed = max(0.0, time.time() - self._started_at) if self._started_at else 0.0
            tool_calls = self._tool_calls

        event.agent.state.set(
            "agent_loop",
            {
                "invocation_count": self._invocation_count,
                "tool_calls": tool_calls,
                "last_duration_seconds": round(elapsed, 3),
                "last_stop_reason": "bidi_session_end",
                "status": "idle",
                "loop_type": "bidi",
            },
        )

        if self._verbose:
            logger.info(
                "agent_id=%s loop_type=bidi tool_calls=%d duration=%.3fs",
                event.agent.agent_id,
                tool_calls,
                elapsed,
            )


class MaxToolCallsHook(HookProvider):
    """Per-invocation tool-call guardrail."""

    def __init__(self, max_tool_calls: int):
        self.max_tool_calls = max_tool_calls
        self._lock = Lock()
        self._tool_calls = 0

    def register_hooks(self, registry: HookRegistry, **kwargs: Any) -> None:
        _ = kwargs
        registry.add_callback(BeforeInvocationEvent, self._reset_count)
        registry.add_callback(BeforeToolCallEvent, self._enforce_limit)
        if BidiBeforeInvocationEvent is not None:
            registry.add_callback(BidiBeforeInvocationEvent, self._reset_count)
        if BidiBeforeToolCallEvent is not None:
            registry.add_callback(BidiBeforeToolCallEvent, self._enforce_limit)

    def _reset_count(self, event: Any) -> None:
        _ = event
        with self._lock:
            self._tool_calls = 0

    def _enforce_limit(self, event: Any) -> None:
        if self.max_tool_calls <= 0:
            return

        with self._lock:
            self._tool_calls += 1
            current = self._tool_calls

        if current <= self.max_tool_calls:
            return

        tool_name = event.tool_use.get("name", "unknown_tool")
        event.cancel_tool = (
            f"Tool call limit exceeded ({self.max_tool_calls} per invocation). "
            f"Do not call '{tool_name}' again in this invocation."
        )
        logger.warning(
            "agent_id=%s tool=%s count=%d limit=%d | tool call cancelled",
            event.agent.agent_id,
            tool_name,
            current,
            self.max_tool_calls,
        )


class ToolHealthQuarantineHook(HookProvider):
    """Quarantine repeatedly failing tools to prevent repeated hangs/fail loops."""

    def __init__(self, failure_threshold: int, max_error_message_chars: int = 240):
        self.failure_threshold = max(1, failure_threshold)
        self.max_error_message_chars = max(64, max_error_message_chars)
        self._lock = Lock()
        self._failure_streaks: dict[str, int] = {}
        self._quarantined: dict[str, str] = {}

    def register_hooks(self, registry: HookRegistry, **kwargs: Any) -> None:
        _ = kwargs
        registry.add_callback(BeforeToolCallEvent, self._on_before_tool_call)
        registry.add_callback(AfterToolCallEvent, self._on_after_tool_call)
        if BidiBeforeToolCallEvent is not None:
            registry.add_callback(BidiBeforeToolCallEvent, self._on_before_tool_call)
        if BidiAfterToolCallEvent is not None:
            registry.add_callback(BidiAfterToolCallEvent, self._on_after_tool_call)

    @staticmethod
    def _tool_name_from_event(event: Any) -> str:
        tool_use = getattr(event, "tool_use", None)
        if isinstance(tool_use, dict):
            name = tool_use.get("name")
            if isinstance(name, str):
                return name
        return "unknown_tool"

    @staticmethod
    def _result_status(event: Any) -> str:
        result = getattr(event, "result", None)
        if isinstance(result, dict):
            status = result.get("status")
            if isinstance(status, str):
                return status
        return "error"

    def _extract_error_reason(self, event: Any) -> str:
        result = getattr(event, "result", None)
        if isinstance(result, dict):
            content = result.get("content")
            if isinstance(content, list):
                for item in content:
                    if not isinstance(item, dict):
                        continue
                    text = item.get("text")
                    if isinstance(text, str) and text.strip():
                        return text.strip()[: self.max_error_message_chars]
        exception = getattr(event, "exception", None)
        if exception is not None:
            return str(exception)[: self.max_error_message_chars]
        cancel_message = getattr(event, "cancel_message", None)
        if isinstance(cancel_message, str) and cancel_message.strip():
            return cancel_message.strip()[: self.max_error_message_chars]
        return "tool returned an error status repeatedly"

    def _sync_agent_state(self, event: Any) -> None:
        try:
            event.agent.state.set(
                "tool_health",
                {
                    "failure_streaks": dict(self._failure_streaks),
                    "quarantined_tools": dict(self._quarantined),
                },
            )
        except Exception:
            logger.debug("Failed to persist tool_health state", exc_info=True)

    def _on_before_tool_call(self, event: Any) -> None:
        tool_name = self._tool_name_from_event(event)
        with self._lock:
            reason = self._quarantined.get(tool_name)
        if not reason:
            return
        event.cancel_tool = (
            f"Tool '{tool_name}' is temporarily quarantined due to repeated failures: {reason}. "
            "Do not call this tool again in this invocation."
        )
        logger.warning(
            "agent_id=%s tool=%s | quarantined tool invocation cancelled",
            event.agent.agent_id,
            tool_name,
        )
        self._sync_agent_state(event)

    def _on_after_tool_call(self, event: Any) -> None:
        tool_name = self._tool_name_from_event(event)
        status = self._result_status(event)
        cancel_message = getattr(event, "cancel_message", None)

        with self._lock:
            if status == "success":
                self._failure_streaks.pop(tool_name, None)
                self._quarantined.pop(tool_name, None)
            elif not isinstance(cancel_message, str) or "quarantined" not in cancel_message.lower():
                next_streak = self._failure_streaks.get(tool_name, 0) + 1
                self._failure_streaks[tool_name] = next_streak
                if next_streak >= self.failure_threshold:
                    reason = self._extract_error_reason(event)
                    self._quarantined[tool_name] = reason
                    logger.warning(
                        "agent_id=%s tool=%s streak=%d threshold=%d | tool quarantined",
                        event.agent.agent_id,
                        tool_name,
                        next_streak,
                        self.failure_threshold,
                    )

        self._sync_agent_state(event)


class ExperimentalHookAliasObserver(HookProvider):
    """Optional registration on deprecated experimental hook aliases."""

    def register_hooks(self, registry: HookRegistry, **kwargs: Any) -> None:
        _ = kwargs
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", DeprecationWarning)
                from strands.experimental import hooks as experimental_hooks

                before_tool_alias = getattr(experimental_hooks, "BeforeToolInvocationEvent")
                after_tool_alias = getattr(experimental_hooks, "AfterToolInvocationEvent")
                before_model_alias = getattr(experimental_hooks, "BeforeModelInvocationEvent")
                after_model_alias = getattr(experimental_hooks, "AfterModelInvocationEvent")

            registry.add_callback(before_tool_alias, self._on_before_tool_alias)
            registry.add_callback(after_tool_alias, self._on_after_tool_alias)
            registry.add_callback(before_model_alias, self._on_before_model_alias)
            registry.add_callback(after_model_alias, self._on_after_model_alias)
            logger.info("Registered experimental hook alias observers")
        except Exception as exc:
            logger.warning("Failed to register experimental hook aliases: %s", exc)

    def _on_before_tool_alias(self, event: Any) -> None:
        if HOOKS_VERBOSE_LOGGING:
            logger.info("experimental.before_tool name=%s", event.tool_use.get("name"))

    def _on_after_tool_alias(self, event: Any) -> None:
        if HOOKS_VERBOSE_LOGGING:
            logger.info("experimental.after_tool name=%s status=%s", event.tool_use.get("name"), event.result.get("status"))

    def _on_before_model_alias(self, event: Any) -> None:
        if HOOKS_VERBOSE_LOGGING:
            logger.info("experimental.before_model agent_id=%s", event.agent.agent_id)

    def _on_after_model_alias(self, event: Any) -> None:
        if HOOKS_VERBOSE_LOGGING and event.stop_response is not None:
            logger.info("experimental.after_model stop_reason=%s", event.stop_response.stop_reason)


def build_agent_hooks(model: Any) -> list[HookProvider]:
    """Build hook providers from runtime configuration."""
    hooks: list[HookProvider] = []

    if ENABLE_AGENT_LOOP_OBSERVER_HOOK:
        hooks.append(AgentLoopObserverHook(verbose=HOOKS_VERBOSE_LOGGING))

    if MAX_TOOL_CALLS_PER_INVOCATION > 0:
        hooks.append(MaxToolCallsHook(max_tool_calls=MAX_TOOL_CALLS_PER_INVOCATION))

    if ENABLE_TOOL_HEALTH_QUARANTINE and TOOL_HEALTH_FAILURE_THRESHOLD > 0:
        hooks.append(
            ToolHealthQuarantineHook(
                failure_threshold=TOOL_HEALTH_FAILURE_THRESHOLD,
                max_error_message_chars=TOOL_HEALTH_MAX_ERROR_MESSAGE_CHARS,
            )
        )

    if ENABLE_EXPERIMENTAL_HOOK_ALIASES:
        hooks.append(ExperimentalHookAliasObserver())

    if ENABLE_EXPERIMENTAL_STEERING:
        try:
            from strands.experimental.steering import LLMSteeringHandler, LedgerProvider

            hooks.append(
                LLMSteeringHandler(
                    system_prompt=STEERING_SYSTEM_PROMPT,
                    model=model,
                    context_providers=[LedgerProvider()],
                )
            )
        except Exception as exc:
            logger.warning("Experimental steering requested but unavailable: %s", exc)

    return hooks
