"""Ron Task Agent - Project Manager flavor of SuperAgent."""

import hashlib
import os
from typing import Any, Callable, Dict, List, Optional

from strands.models.litellm import LiteLLMModel
import superagent as sa
from superagent import create_superagent

TASK_AGENT_SYSTEM_PROMPT = (
    """You are Ron Task Agent - the Project Manager. Execute tasks decisively and keep work on-scope, on-time, and complete.

## PROJECT MANAGER ROLE (CRITICAL)
You are responsible for:
- Translating requests into clear tasks, milestones, and deliverables
- Keeping a live execution plan with statuses
- Proactively identifying blockers, dependencies, and risks
- Ensuring all tasks are completed before stopping
- Using project/task tools (create_task, update_task, add_file_reference) to track real progress
- Escalating missing info immediately (ask targeted questions, then proceed once answered)

You must still follow the exact same execution/tooling rules as SuperAgent.
"""
    + sa.SUPERAGENT_SYSTEM_PROMPT.split("\n", 1)[1]
)

_TASK_SESSION_AGENTS: Dict[str, Any] = {}
_TASK_SESSION_BROWSER_NAMES: Dict[str, str] = {}


def _make_browser_session_name(session_id: str) -> str:
    digest = hashlib.sha1(session_id.encode("utf-8")).hexdigest()[:8]
    return f"task-{digest}"


def get_browser_session_name(session_id: str) -> str:
    if session_id in _TASK_SESSION_BROWSER_NAMES:
        return _TASK_SESSION_BROWSER_NAMES[session_id]
    name = _make_browser_session_name(session_id)
    _TASK_SESSION_BROWSER_NAMES[session_id] = name
    return name


def create_task_agent(
    session_id: Optional[str] = None,
    history: Optional[List[Dict[str, Any]]] = None,
    callback_handler: Optional[Callable[..., Any]] = None,
    memory: Any = None,
    browser_session_name: Optional[str] = None,
) -> Any:
    return create_superagent(
        session_id=session_id,
        history=history,
        callback_handler=callback_handler,
        memory=memory,
        browser_session_name=browser_session_name,
        system_prompt_override=TASK_AGENT_SYSTEM_PROMPT,
        agent_id_override="ron-task-agent",
        name_override="Ron Task Agent",
        description_override="Project Manager",
    )


def get_or_create_task_agent(
    session_id: str,
    callback_handler: Optional[Callable[..., Any]] = None,
    memory: Any = None,
    browser_session_name: Optional[str] = None,
) -> tuple[Any, bool, str]:
    global _TASK_SESSION_AGENTS

    if browser_session_name:
        _TASK_SESSION_BROWSER_NAMES[session_id] = browser_session_name
    browser_session_name = get_browser_session_name(session_id)

    if session_id not in _TASK_SESSION_AGENTS:
        agent = create_task_agent(
            session_id=session_id,
            callback_handler=callback_handler,
            memory=memory,
            browser_session_name=browser_session_name,
        )
        _TASK_SESSION_AGENTS[session_id] = agent
        created = True
    else:
        agent = _TASK_SESSION_AGENTS[session_id]
        if callback_handler:
            agent.callback_handler = callback_handler
        created = False

    sa._current_agent = agent
    return agent, created, browser_session_name
