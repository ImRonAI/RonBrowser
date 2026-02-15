"""
Browser session management endpoints with CDP integration.

Manages browser sessions for agents with:
- Session creation tied to agent sessions
- CDP connection to Electron browser
- Screenshot capture
- Navigation control
"""

import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Path as PathParam
from pydantic import BaseModel, Field

router = APIRouter()


# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------

class BrowserSessionCreate(BaseModel):
    session_name: str = Field(..., description="Unique session identifier")
    description: Optional[str] = Field(default=None, description="Session description")
    agent_session_id: Optional[str] = Field(default=None, description="Associated agent session")
    cdp_endpoint: Optional[str] = Field(default=None, description="CDP WebSocket endpoint")


class BrowserSessionUpdate(BaseModel):
    description: Optional[str] = None
    cdp_endpoint: Optional[str] = None
    current_url: Optional[str] = None


class BrowserSession(BaseModel):
    session_name: str
    description: Optional[str]
    agent_session_id: Optional[str]
    cdp_endpoint: Optional[str]
    current_url: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str


class ScreenshotRequest(BaseModel):
    full_page: bool = Field(default=False, description="Capture full page")
    selector: Optional[str] = Field(default=None, description="Element selector to capture")


class NavigateRequest(BaseModel):
    url: str = Field(..., description="URL to navigate to")
    wait_until: str = Field(default="networkidle", description="When to consider navigation complete")


class ClickRequest(BaseModel):
    selector: str = Field(..., description="CSS selector to click")


class TypeRequest(BaseModel):
    selector: str = Field(..., description="CSS selector for input")
    text: str = Field(..., description="Text to type")


# -----------------------------------------------------------------------------
# Session Storage
# -----------------------------------------------------------------------------

# In-memory session storage (replace with database in production)
_browser_sessions: Dict[str, Dict[str, Any]] = {}


# -----------------------------------------------------------------------------
# Browser Tool Integration
# -----------------------------------------------------------------------------

def _get_browser_tool():
    """Get the browser tool instance."""
    try:
        from strands_tools.browser import LocalChromiumBrowser
        return LocalChromiumBrowser()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Browser tool not available: {e}")


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/", response_model=List[BrowserSession])
async def list_browser_sessions(
    agent_session_id: Optional[str] = None
):
    """List all browser sessions."""
    sessions = list(_browser_sessions.values())
    
    if agent_session_id:
        sessions = [
            s for s in sessions 
            if s.get("agent_session_id") == agent_session_id
        ]
    
    return [BrowserSession(**s) for s in sessions]


@router.post("/", response_model=BrowserSession, status_code=201)
async def create_browser_session(session: BrowserSessionCreate):
    """
    Create a new browser session.
    
    Initializes a browser session that can be controlled via CDP.
    """
    if session.session_name in _browser_sessions:
        raise HTTPException(
            status_code=400, 
            detail=f"Session '{session.session_name}' already exists"
        )
    
    now = datetime.utcnow().isoformat()
    session_data = {
        "session_name": session.session_name,
        "description": session.description,
        "agent_session_id": session.agent_session_id,
        "cdp_endpoint": session.cdp_endpoint,
        "current_url": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    # Initialize browser session via tool
    try:
        from strands_tools.browser.models import InitSessionAction
        browser = _get_browser_tool()
        
        action = InitSessionAction(
            type="init_session",
            session_name=session.session_name,
            description=session.description or f"Browser session for {session.session_name}"
        )
        
        result = await browser.init_session(action)
        session_data["init_result"] = result
        
    except Exception as e:
        # Session creation failed
        raise HTTPException(status_code=500, detail=f"Failed to initialize browser: {e}")
    
    _browser_sessions[session.session_name] = session_data
    return BrowserSession(**session_data)


@router.get("/{session_name}", response_model=BrowserSession)
async def get_browser_session(
    session_name: str = PathParam(..., description="Session name")
):
    """Get a specific browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    return BrowserSession(**_browser_sessions[session_name])


@router.put("/{session_name}", response_model=BrowserSession)
async def update_browser_session(
    session_update: BrowserSessionUpdate,
    session_name: str = PathParam(..., description="Session name")
):
    """Update a browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    session = _browser_sessions[session_name]
    
    if session_update.description is not None:
        session["description"] = session_update.description
    if session_update.cdp_endpoint is not None:
        session["cdp_endpoint"] = session_update.cdp_endpoint
    if session_update.current_url is not None:
        session["current_url"] = session_update.current_url
    
    session["updated_at"] = datetime.utcnow().isoformat()
    
    return BrowserSession(**session)


@router.delete("/{session_name}")
async def delete_browser_session(
    session_name: str = PathParam(..., description="Session name")
):
    """Close and delete a browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    try:
        from strands_tools.browser.models import CloseAction
        browser = _get_browser_tool()
        
        action = CloseAction(
            type="close",
            session_name=session_name
        )
        
        await browser.close(action)
        
    except Exception as e:
        # Log but continue with deletion
        print(f"Warning: Failed to close browser gracefully: {e}")
    
    del _browser_sessions[session_name]
    return {"status": "deleted", "session_name": session_name}


# -----------------------------------------------------------------------------
# Browser Actions
# -----------------------------------------------------------------------------

@router.post("/{session_name}/navigate")
async def navigate(
    request: NavigateRequest,
    session_name: str = PathParam(..., description="Session name")
):
    """Navigate to a URL in the browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    try:
        from strands_tools.browser.models import NavigateAction
        browser = _get_browser_tool()
        
        action = NavigateAction(
            type="navigate",
            session_name=session_name,
            url=request.url,
            wait_until=request.wait_until
        )
        
        result = await browser.navigate(action)
        
        # Update session with current URL
        _browser_sessions[session_name]["current_url"] = request.url
        _browser_sessions[session_name]["updated_at"] = datetime.utcnow().isoformat()
        
        return {
            "session_name": session_name,
            "url": request.url,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Navigation failed: {e}")


@router.post("/{session_name}/click")
async def click(
    request: ClickRequest,
    session_name: str = PathParam(..., description="Session name")
):
    """Click an element in the browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    try:
        from strands_tools.browser.models import ClickAction
        browser = _get_browser_tool()
        
        action = ClickAction(
            type="click",
            session_name=session_name,
            selector=request.selector
        )
        
        result = await browser.click(action)
        
        return {
            "session_name": session_name,
            "selector": request.selector,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Click failed: {e}")


@router.post("/{session_name}/type")
async def type_text(
    request: TypeRequest,
    session_name: str = PathParam(..., description="Session name")
):
    """Type text into an element in the browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    try:
        from strands_tools.browser.models import TypeAction
        browser = _get_browser_tool()
        
        action = TypeAction(
            type="type",
            session_name=session_name,
            selector=request.selector,
            text=request.text
        )
        
        result = await browser.type(action)
        
        return {
            "session_name": session_name,
            "selector": request.selector,
            "text": request.text,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Type failed: {e}")


@router.post("/{session_name}/screenshot")
async def take_screenshot(
    request: ScreenshotRequest,
    session_name: str = PathParam(..., description="Session name")
):
    """Take a screenshot of the browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    try:
        from strands_tools.browser.models import ScreenshotAction
        browser = _get_browser_tool()
        
        action = ScreenshotAction(
            type="screenshot",
            session_name=session_name,
            full_page=request.full_page,
            selector=request.selector
        )
        
        result = await browser.screenshot(action)
        
        return {
            "session_name": session_name,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screenshot failed: {e}")


@router.get("/{session_name}/text")
async def get_text(
    session_name: str = PathParam(..., description="Session name")
):
    """Get text content of the current page."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    try:
        from strands_tools.browser.models import GetTextAction
        browser = _get_browser_tool()
        
        action = GetTextAction(
            type="get_text",
            session_name=session_name
        )
        
        result = await browser.get_text(action)
        
        return {
            "session_name": session_name,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Get text failed: {e}")


@router.get("/{session_name}/html")
async def get_html(
    session_name: str = PathParam(..., description="Session name")
):
    """Get HTML content of the current page."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    try:
        from strands_tools.browser.models import GetHtmlAction
        browser = _get_browser_tool()
        
        action = GetHtmlAction(
            type="get_html",
            session_name=session_name
        )
        
        result = await browser.get_html(action)
        
        return {
            "session_name": session_name,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Get HTML failed: {e}")


@router.get("/{session_name}/url")
async def get_current_url(
    session_name: str = PathParam(..., description="Session name")
):
    """Get the current URL of the browser session."""
    if session_name not in _browser_sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_name}")
    
    session = _browser_sessions[session_name]
    
    return {
        "session_name": session_name,
        "current_url": session.get("current_url"),
        "is_active": session.get("is_active", False)
    }
