"""Voice Onboarding Agent (Gemini Live via Strands BidiAgent).

Goal: a minimal, reliable voice onboarding interview that works on speakers
(no headphones) by default.

Core approach:
- Use Strands `BidiAgent` + `BidiAudioIO` for mic/speaker.
- Run the interview as a deterministic loop (ask question -> wait for final user transcript).
- Mitigate speaker→mic feedback by running **half-duplex**:
  - While the assistant is responding, do NOT stream microphone audio to the model.
  - After the assistant finishes, wait a short cooldown before resuming mic.

The process emits **newline-delimited JSON events** on stdout for Electron to consume.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Optional

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None  # type: ignore[assignment]
from strands.experimental.bidi import BidiAgent
from strands.experimental.bidi.io import BidiAudioIO
from strands.experimental.bidi.models import BidiGeminiLiveModel
from strands.experimental.bidi.tools import stop_conversation
from strands.experimental.bidi.types.events import (
    BidiAudioStreamEvent,
    BidiConnectionStartEvent,
    BidiInterruptionEvent,
    BidiResponseCompleteEvent,
    BidiResponseStartEvent,
    BidiTextInputEvent,
    BidiTranscriptStreamEvent,
)
from strands.experimental.bidi.types.io import BidiInput, BidiOutput


_dotenv_path = Path(__file__).parent.parent.parent / ".env"
if load_dotenv is not None:
    load_dotenv(_dotenv_path)


# Keep in sync with `src/stores/onboardingStore.ts`.
INTERVIEW_QUESTIONS: list[str] = [
    "What brings you to Ron Browser today?",
    "What topics are you most interested in?",
    "How do you prefer to consume information?",
    "What's your primary goal when browsing?",
    "How important is privacy to you?",
    "Do you prefer summaries or detailed articles?",
    "What time of day do you usually browse?",
    "What frustrates you about current browsers?",
]


SYSTEM_PROMPT = """You are Ron, a friendly voice onboarding assistant.

You will receive short operator instructions telling you what to say next.
Follow them literally.
- Keep spoken responses brief and clear.
- Do not call tools unless explicitly instructed.
"""


DEFAULT_VOICE = os.getenv("VOICE_AGENT_VOICE", "Aoede")
DEFAULT_MIC_RESUME_DELAY_MS = int(os.getenv("VOICE_AGENT_MIC_RESUME_DELAY_MS", "650"))
# Gemini Live transcript `is_final` can be unreliable depending on google-genai behavior.
# Use a small debounce as a fallback to decide when the user is "done speaking".
DEFAULT_USER_FINAL_DEBOUNCE_MS = int(os.getenv("VOICE_AGENT_USER_FINAL_DEBOUNCE_MS", "900"))


def _emit(event: dict[str, Any]) -> None:
    """Emit newline-delimited JSON for Electron to parse safely."""
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _emit_state(state: str) -> None:
    _emit({"type": "state_change", "data": {"state": state}})


@dataclass
class OnboardingState:
    current_question_index: int = 0
    answers: list[dict[str, Any]] = field(default_factory=list)
    is_complete: bool = False

    def record(self, question: str, answer: str) -> dict[str, Any]:
        item = {
            "question": question,
            "answer": answer,
            "timestamp": int(time.time() * 1000),
        }
        self.answers.append(item)
        return item

    def summary(self) -> dict[str, Any]:
        return {
            "current_question_index": self.current_question_index,
            "answers": self.answers,
            "is_complete": self.is_complete,
        }


class HalfDuplexGate:
    """Coordinates half-duplex behavior between output events and mic input."""

    def __init__(self, resume_delay_ms: int):
        self._resume_delay_s = max(resume_delay_ms, 0) / 1000.0
        self._assistant_busy = asyncio.Event()
        self._resume_mic_at_s: float = 0.0

    def mark_assistant_busy(self) -> None:
        self._assistant_busy.set()

    def mark_assistant_idle(self) -> None:
        if self._assistant_busy.is_set():
            self._assistant_busy.clear()
        loop = asyncio.get_running_loop()
        self._resume_mic_at_s = loop.time() + self._resume_delay_s

    async def wait_until_mic_allowed(self) -> None:
        # Block mic while assistant is responding.
        while self._assistant_busy.is_set():
            await asyncio.sleep(0.02)

        # After assistant finishes, wait a short cooldown to avoid speaker tail echo.
        loop = asyncio.get_running_loop()
        delay = self._resume_mic_at_s - loop.time()
        if delay > 0:
            await asyncio.sleep(delay)


class HalfDuplexAudioInput:
    """Wraps an underlying audio input and pauses mic streaming while assistant is busy."""

    def __init__(self, inner: BidiInput, gate: HalfDuplexGate):
        self._inner_input = inner
        self._gate = gate

    async def start(self, agent: BidiAgent) -> None:
        if hasattr(self._inner_input, "start"):
            await self._inner_input.start(agent)  # type: ignore[attr-defined]

    async def stop(self) -> None:
        if hasattr(self._inner_input, "stop"):
            await self._inner_input.stop()  # type: ignore[attr-defined]

    def __call__(self) -> Awaitable[Any]:
        async def _inner() -> Any:
            await self._gate.wait_until_mic_allowed()
            return await self._inner_input()

        return _inner()


class MonitoringOutput:
    """Forwards events to audio output, emits UI events, and drives half-duplex gate."""

    def __init__(
        self,
        inner: BidiOutput,
        gate: HalfDuplexGate,
        user_final_transcripts: "asyncio.Queue[str]",
        user_final_debounce_ms: int = DEFAULT_USER_FINAL_DEBOUNCE_MS,
    ):
        self._inner_output = inner
        self._gate = gate
        self._user_final_transcripts = user_final_transcripts

        self.connected = asyncio.Event()
        self._response_complete_events: asyncio.Queue[None] = asyncio.Queue()

        self._speaking_announced = False
        self._last_assistant_transcript: Optional[str] = None

        # Debounce fallback for user transcripts.
        self._user_final_debounce_s = max(user_final_debounce_ms, 0) / 1000.0
        self._pending_user_text: Optional[str] = None
        self._user_finalize_task: Optional[asyncio.Task[None]] = None

    @property
    def last_assistant_transcript(self) -> Optional[str]:
        return self._last_assistant_transcript

    def _cancel_user_finalize_task(self) -> None:
        task = self._user_finalize_task
        if task is not None:
            task.cancel()
        self._user_finalize_task = None

    def reset_user_debounce(self) -> None:
        """Clear any pending user transcript debounce state."""
        self._cancel_user_finalize_task()
        self._pending_user_text = None

    def drain_response_complete_events(self) -> None:
        while True:
            try:
                self._response_complete_events.get_nowait()
            except asyncio.QueueEmpty:
                return

    def drain_user_transcripts(self) -> None:
        self.reset_user_debounce()
        while True:
            try:
                self._user_final_transcripts.get_nowait()
            except asyncio.QueueEmpty:
                return

    async def wait_for_response_complete(self) -> None:
        await self._response_complete_events.get()

    async def _finalize_user_after_debounce(self) -> None:
        try:
            await asyncio.sleep(self._user_final_debounce_s)
            text = self._pending_user_text
            if text:
                await self._user_final_transcripts.put(text)
                self._pending_user_text = None
        except asyncio.CancelledError:
            return

    def _schedule_user_finalize(self) -> None:
        self._cancel_user_finalize_task()
        self._user_finalize_task = asyncio.create_task(
            self._finalize_user_after_debounce(),
            name="voice_onboarding:user_finalize",
        )

    async def start(self, agent: BidiAgent) -> None:
        if hasattr(self._inner_output, "start"):
            await self._inner_output.start(agent)  # type: ignore[attr-defined]

    async def stop(self) -> None:
        if hasattr(self._inner_output, "stop"):
            await self._inner_output.stop()  # type: ignore[attr-defined]

    def __call__(self, event: Any) -> Awaitable[None]:
        async def _inner() -> None:
            # Always forward to speaker output first (best-effort).
            try:
                await self._inner_output(event)
            except Exception:
                # Never let audio output issues crash the agent.
                pass

            if isinstance(event, BidiConnectionStartEvent):
                self.connected.set()

            if isinstance(event, BidiResponseStartEvent):
                self._gate.mark_assistant_busy()
                self._speaking_announced = False
                _emit_state("thinking")

            if isinstance(event, BidiAudioStreamEvent):
                # Some providers may not emit BidiResponseStartEvent; ensure we gate mic on first audio.
                self._gate.mark_assistant_busy()
                if not self._speaking_announced:
                    _emit_state("speaking")
                    self._speaking_announced = True

            if isinstance(event, BidiInterruptionEvent):
                self._gate.mark_assistant_idle()
                _emit_state("listening")

            if isinstance(event, BidiResponseCompleteEvent):
                self._gate.mark_assistant_idle()
                _emit_state("listening")
                try:
                    self._response_complete_events.put_nowait(None)
                except Exception:
                    pass

            if isinstance(event, BidiTranscriptStreamEvent):
                text = getattr(event, "text", "") or ""
                role = getattr(event, "role", "") or ""
                is_final = bool(getattr(event, "is_final", False))

                if text and role in ("user", "assistant"):
                    _emit({"type": "transcript", "data": {"role": role, "text": text, "is_final": is_final}})

                if role == "assistant" and text:
                    self._last_assistant_transcript = text

                if role == "user" and text:
                    # If is_final is reliable, use it.
                    if is_final:
                        self.reset_user_debounce()
                        await self._user_final_transcripts.put(text)
                    else:
                        # Fallback: debounce user transcript updates and treat last text as final.
                        self._pending_user_text = text
                        self._schedule_user_finalize()

        return _inner()


def _norm_text(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    # remove basic punctuation for echo checks
    s = re.sub(r"[^a-z0-9 ]+", "", s)
    return s.strip()


def _is_probable_echo(user_text: str, assistant_text: Optional[str]) -> bool:
    if not assistant_text:
        return False

    u = _norm_text(user_text)
    a = _norm_text(assistant_text)
    if not u or not a:
        return False

    if u == a:
        return True

    if (u in a or a in u) and len(u) >= int(0.7 * len(a)):
        return True

    return False


async def _speak(agent: BidiAgent, instruction: str) -> None:
    await agent.send(BidiTextInputEvent(text=instruction))


async def _ask_question(agent: BidiAgent, question: str, index: int) -> None:
    _emit({"type": "question", "data": {"question": question, "index": index}})

    instruction = (
        "Speak the following onboarding question clearly. "
        "Do not add extra words before or after. After speaking, wait silently.\n\n"
        f"QUESTION: {question}"
    )
    await _speak(agent, instruction)


async def main() -> None:
    api_key = os.getenv("GOOGLE_AI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        _emit_state("error")
        print("Voice onboarding: missing GOOGLE_API_KEY / GEMINI_API_KEY", file=sys.stderr)
        raise SystemExit(1)

    # Gemini Live model (AUDIO + input/output transcription enabled).
    model = BidiGeminiLiveModel(
        client_config={"api_key": api_key},
        provider_config={
            "audio": {"voice": DEFAULT_VOICE},
            "inference": {
                "response_modalities": ["AUDIO"],
                "outputAudioTranscription": {},
                "inputAudioTranscription": {},
            },
        },
    )

    tools: list[Any] = [stop_conversation]

    # Optional: include A2A client tools if available.
    # (This agent does not *need* tools for onboarding; it only needs them for future handoff.)
    try:
        tools_src = (Path(__file__).resolve().parents[1] / "tools" / "src")
        if tools_src.exists():
            sys.path.insert(0, str(tools_src))

        from strands_tools.a2a_client import A2AClientToolProvider  # type: ignore

        known_urls_raw = os.getenv("A2A_KNOWN_AGENT_URLS", "").strip()
        known_urls = [u.strip() for u in known_urls_raw.split(",") if u.strip()]
        provider = A2AClientToolProvider(known_agent_urls=known_urls)  # no-op if empty
        tools.extend(provider.tools)
    except Exception:
        # If A2A deps aren't installed, continue without.
        pass

    agent = BidiAgent(model=model, system_prompt=SYSTEM_PROMPT, tools=tools)

    audio_io = BidiAudioIO()
    gate = HalfDuplexGate(resume_delay_ms=DEFAULT_MIC_RESUME_DELAY_MS)
    user_final_transcripts: asyncio.Queue[str] = asyncio.Queue()

    mic_input: BidiInput = HalfDuplexAudioInput(audio_io.input(), gate)
    monitor = MonitoringOutput(audio_io.output(), gate, user_final_transcripts)

    _emit_state("starting")

    run_task = asyncio.create_task(agent.run(inputs=[mic_input], outputs=[monitor]), name="voice_onboarding:run")

    state = OnboardingState()

    try:
        # Wait until the streaming connection is ready.
        await asyncio.wait_for(monitor.connected.wait(), timeout=20)
        _emit_state("listening")

        # Greet once.
        monitor.drain_response_complete_events()
        monitor.drain_user_transcripts()
        await _speak(
            agent,
            "You are Ron. Greet the user warmly in one short sentence, then wait silently. Do not ask a question.",
        )
        # Best-effort: wait for the greeting turn to finish so we don't start the first question mid-speech.
        try:
            await asyncio.wait_for(monitor.wait_for_response_complete(), timeout=30)
        except asyncio.TimeoutError:
            gate.mark_assistant_idle()
            _emit_state("listening")

        # Interview loop.
        for idx, question in enumerate(INTERVIEW_QUESTIONS):
            state.current_question_index = idx

            monitor.drain_response_complete_events()
            monitor.drain_user_transcripts()

            await _ask_question(agent, question, idx)

            # Best-effort: wait for the question to finish speaking.
            try:
                await asyncio.wait_for(monitor.wait_for_response_complete(), timeout=60)
            except asyncio.TimeoutError:
                gate.mark_assistant_idle()
                _emit_state("listening")

            while True:
                answer_text = await user_final_transcripts.get()
                if _is_probable_echo(answer_text, monitor.last_assistant_transcript):
                    continue

                if answer_text.strip().lower() == "stop conversation":
                    state.is_complete = True
                    _emit_state("stopped")
                    _emit({"type": "complete", "data": state.summary()})
                    return

                recorded = state.record(question, answer_text)
                _emit({"type": "answer_recorded", "data": recorded})
                break

        state.is_complete = True
        _emit_state("complete")
        _emit({"type": "complete", "data": state.summary()})

    except asyncio.TimeoutError:
        _emit_state("error")
        print("Voice onboarding: timed out waiting for Gemini Live connection", file=sys.stderr)
        raise SystemExit(1)

    finally:
        run_task.cancel()
        try:
            await run_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
