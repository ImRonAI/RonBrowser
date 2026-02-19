"""
Chat session management endpoints.

Allows listing and deleting persistent chat sessions stored in the file system.
"""

import os
import json
import shutil
import logging
from typing import List, Optional
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, Path as PathParam
from pydantic import BaseModel

from agent.api.core.config import SESSION_STORAGE_DIR

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatSessionSummary(BaseModel):
    session_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
    agent_type: str

def _get_session_title(session_path: Path) -> str:
    """Extract a title from the first user message in the session."""
    try:
        agents_dir = session_path / "agents"
        if not agents_dir.exists():
            return "Empty Session"
            
        # Check first agent dir
        for agent_dir in agents_dir.iterdir():
            messages_dir = agent_dir / "messages"
            if not messages_dir.exists():
                continue
                
            # Try to find the first few messages
            for i in range(5):
                msg_file = messages_dir / f"message_{i}.json"
                if msg_file.exists():
                    try:
                        with open(msg_file, "r") as f:
                            msg = json.load(f)
                            if msg.get("role") == "user":
                                content = msg.get("content", "")
                                if isinstance(content, list):
                                    # Handle content blocks
                                    text = ""
                                    for block in content:
                                        if isinstance(block, dict) and "text" in block:
                                            text += block["text"]
                                        elif isinstance(block, str):
                                            text += block
                                    content = text
                                
                                return (content[:50] + "...") if len(content) > 50 else content
                    except Exception:
                        continue
    except Exception as e:
        logger.warning(f"Error extracting title for {session_path}: {e}")
        
    return "New Chat"

def _get_message_count(session_path: Path) -> int:
    """Count total messages in the session."""
    count = 0
    try:
        agents_dir = session_path / "agents"
        if agents_dir.exists():
            for agent_dir in agents_dir.iterdir():
                messages_dir = agent_dir / "messages"
                if messages_dir.exists():
                    count += len(list(messages_dir.glob("message_*.json")))
    except Exception:
        pass
    return count

@router.get("/", response_model=List[ChatSessionSummary])
async def list_chat_sessions():
    """List all persistent chat sessions."""
    sessions = []
    
    if not SESSION_STORAGE_DIR.exists():
        return []
        
    for item in SESSION_STORAGE_DIR.iterdir():
        if item.is_dir() and item.name.startswith("session_"):
            try:
                # Parse session metadata
                session_json = item / "session.json"
                if session_json.exists():
                    with open(session_json, "r") as f:
                        meta = json.load(f)
                        
                    # Extract pure ID from directory name if needed, 
                    # but session.json usually has the clean session_id
                    session_id = meta.get("session_id", item.name.replace("session_", ""))
                    
                    # Determine agent type from directory structure
                    agent_type = "unknown"
                    agents_dir = item / "agents"
                    if agents_dir.exists():
                        for ad in agents_dir.iterdir():
                            if ad.name.startswith("agent_"):
                                agent_type = ad.name.replace("agent_", "")
                                break
                    
                    sessions.append(ChatSessionSummary(
                        session_id=session_id,
                        title=_get_session_title(item),
                        created_at=meta.get("created_at", datetime.now().isoformat()),
                        updated_at=meta.get("updated_at", datetime.now().isoformat()),
                        message_count=_get_message_count(item),
                        agent_type=agent_type
                    ))
            except Exception as e:
                logger.warning(f"Skipping malformed session {item.name}: {e}")
                continue
                
    # Sort by updated_at desc
    sessions.sort(key=lambda x: x.updated_at, reverse=True)
    return sessions

@router.get("/{session_id}")
async def get_chat_session(session_id: str = PathParam(..., description="Session ID")):
    """Get full chat history for a session."""
    # Logic to find the session directory considering rollover suffixes
    candidates = [
        SESSION_STORAGE_DIR / f"session_{session_id}",
        SESSION_STORAGE_DIR / f"session_{session_id}-1"
    ]
    
    target_dir = None
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            target_dir = candidate
            break
            
    if not target_dir:
        # Fallback: scan for any directory starting with session_{session_id}
        prefix = f"session_{session_id}"
        if SESSION_STORAGE_DIR.exists():
            for item in SESSION_STORAGE_DIR.iterdir():
                if item.is_dir() and item.name.startswith(prefix):
                    target_dir = item
                    break
    
    if not target_dir:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = []
    try:
        agents_dir = target_dir / "agents"
        if agents_dir.exists():
            for agent_dir in agents_dir.iterdir():
                messages_dir = agent_dir / "messages"
                if messages_dir.exists():
                    # Read all message files
                    for msg_file in sorted(messages_dir.glob("message_*.json"), key=lambda f: int(f.stem.split('_')[1])):
                        with open(msg_file, "r") as f:
                            messages.append(json.load(f))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read session messages: {e}")
        
    return {"session_id": session_id, "messages": messages}

@router.delete("/{session_id}")
async def delete_chat_session(session_id: str = PathParam(..., description="Session ID")):
    """Delete a chat session."""
    # Logic to find the session directory considering rollover suffixes
    candidates = [
        SESSION_STORAGE_DIR / f"session_{session_id}",
        SESSION_STORAGE_DIR / f"session_{session_id}-1"
    ]
    
    target_dir = None
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            target_dir = candidate
            break
            
    if not target_dir:
        # Fallback: scan for any directory starting with session_{session_id}
        prefix = f"session_{session_id}"
        if SESSION_STORAGE_DIR.exists():
            for item in SESSION_STORAGE_DIR.iterdir():
                if item.is_dir() and item.name.startswith(prefix):
                    target_dir = item
                    break
        
    if not target_dir:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        shutil.rmtree(target_dir)
        return {"status": "success", "message": f"Session {session_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {e}")
