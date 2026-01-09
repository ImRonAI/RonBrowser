"""FastAPI server exposing the superagent inside the Docker container."""
import json
import asyncio
from typing import Optional, AsyncGenerator
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from superagent import create_superagent

app = FastAPI(title="Ron Superagent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Agent instance per session (simple approach)
agents = {}


class ChatRequest(BaseModel):
    session_id: str
    message: str


class StreamCallbackHandler:
    """Callback that yields SSE events."""

    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.in_reasoning = False

    def __call__(self, **kwargs):
        reasoningText = kwargs.get("reasoningText", False)
        data = kwargs.get("data", "")
        complete = kwargs.get("complete", False)
        current_tool_use = kwargs.get("current_tool_use", {})

        if reasoningText:
            if not self.in_reasoning:
                self.queue.put_nowait({"type": "reasoning_start"})
                self.in_reasoning = True
            self.queue.put_nowait({"type": "reasoning", "content": reasoningText})

        if data:
            if self.in_reasoning:
                self.queue.put_nowait({"type": "reasoning_end"})
                self.in_reasoning = False
            self.queue.put_nowait({"type": "content", "content": data})

        if current_tool_use.get("name"):
            self.queue.put_nowait({
                "type": "tool_use",
                "tool": current_tool_use.get("name"),
                "input": current_tool_use.get("input", {})
            })

        if complete:
            if self.in_reasoning:
                self.queue.put_nowait({"type": "reasoning_end"})
                self.in_reasoning = False
            self.queue.put_nowait({"type": "done"})


def get_or_create_agent(session_id: str, callback_handler=None):
    """Get existing agent or create new one for session."""
    if session_id not in agents:
        agents[session_id] = create_superagent(callback_handler=callback_handler)
    return agents[session_id]


@app.post("/chat")
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint."""
    agent = get_or_create_agent(request.session_id)
    result = agent(request.message)
    return {"response": str(result)}


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat endpoint with SSE."""
    callback = StreamCallbackHandler()
    agent = get_or_create_agent(request.session_id, callback_handler=callback)

    async def generate() -> AsyncGenerator[str, None]:
        # Run agent in background
        loop = asyncio.get_event_loop()
        task = loop.run_in_executor(None, agent, request.message)

        # Stream events from callback queue
        while True:
            try:
                event = await asyncio.wait_for(callback.queue.get(), timeout=0.1)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") == "done":
                    break
            except asyncio.TimeoutError:
                # Check if agent task is done
                if task.done():
                    break
                continue

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear agent session."""
    if session_id in agents:
        del agents[session_id]
    return {"status": "cleared"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
