"""
FastAPI server wrapper for the Voice Onboarding Agent.
Provides REST endpoints with CORS for Electron app integration.
"""
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Voice Onboarding Agent Server",
    description="HTTP/WebSocket server for Ron Browser voice onboarding",
    version="1.0.0"
)

# Configure CORS - allow Electron app to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "http://localhost:*",     # Any localhost port
        "file://*",               # Electron file protocol
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OnboardingState(BaseModel):
    """Current state of onboarding"""
    current_question_index: int
    answers: list[dict]
    is_complete: bool


class StartAgentRequest(BaseModel):
    """Request to start voice agent"""
    api_key: Optional[str] = None


# Global state
agent_running = False
onboarding_data: Optional[dict] = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Voice Onboarding Agent",
        "status": "running",
        "agent_active": agent_running
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    api_key = os.getenv("GOOGLE_AI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

    return {
        "status": "healthy",
        "agent_running": agent_running,
        "api_key_configured": bool(api_key),
        "environment": "development" if os.getenv("NODE_ENV") != "production" else "production"
    }


@app.post("/agent/start")
async def start_agent(request: StartAgentRequest):
    """Start the voice onboarding agent"""
    global agent_running, onboarding_data

    if agent_running:
        raise HTTPException(status_code=400, detail="Agent is already running")

    # Get API key
    api_key = request.api_key or os.getenv("GOOGLE_AI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="API key not provided and not found in environment"
        )

    agent_running = True
    onboarding_data = None

    logger.info("Voice agent started")

    return {
        "status": "started",
        "message": "Voice agent is now running. Speak into your microphone."
    }


@app.post("/agent/stop")
async def stop_agent():
    """Stop the voice onboarding agent"""
    global agent_running

    if not agent_running:
        raise HTTPException(status_code=400, detail="Agent is not running")

    agent_running = False
    logger.info("Voice agent stopped")

    return {
        "status": "stopped",
        "onboarding_data": onboarding_data
    }


@app.get("/agent/status")
async def agent_status():
    """Get current agent status"""
    return {
        "running": agent_running,
        "has_data": onboarding_data is not None
    }


@app.get("/onboarding/data")
async def get_onboarding_data():
    """Get collected onboarding data"""
    if not onboarding_data:
        raise HTTPException(status_code=404, detail="No onboarding data available")

    return onboarding_data


@app.delete("/onboarding/data")
async def clear_onboarding_data():
    """Clear onboarding data"""
    global onboarding_data
    onboarding_data = None
    return {"status": "cleared"}


@app.websocket("/ws/agent")
async def websocket_agent(websocket: WebSocket):
    """WebSocket endpoint for real-time agent communication"""
    await websocket.accept()
    logger.info("WebSocket client connected")

    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message["type"] == "start":
                await websocket.send_json({
                    "type": "status",
                    "status": "started"
                })

            elif message["type"] == "stop":
                await websocket.send_json({
                    "type": "status",
                    "status": "stopped",
                    "data": onboarding_data
                })

            elif message["type"] == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AGENT_PORT", "8765"))

    logger.info(f"Starting Voice Onboarding Agent Server on port {port}")
    logger.info(f"CORS enabled for Electron app integration")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info"
    )
