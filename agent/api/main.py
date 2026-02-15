"""
Ron Browser API - Thin Entry Point

Framework-compliant FastAPI application with:
- Modular endpoints in endpoints/ directory
- Strands SDK patterns for agent streaming
- Supabase for project/task persistence
- Browser session management via CDP
- Tool discovery via @tool decorator parsing
- MCP server registry
- OpenAPI spec registry

Usage:
    uvicorn agent.api.main:app --host 0.0.0.0 --port 8765 --reload
"""

import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Add project root to path so absolute imports (agent.api.*) work
# when running directly via `python agent/api/main.py`
_project_root = str(Path(__file__).resolve().parent.parent.parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# Add tools/src to path for strands_tools imports
_tools_src = Path(__file__).parent.parent / "tools" / "src"
if str(_tools_src) not in sys.path:
    sys.path.insert(0, str(_tools_src))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import endpoint routers
from agent.api.endpoints import agents, projects, tools, mcp_servers, openapi_specs, browser_sessions

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 60)
    logger.info("Ron Browser API Starting")
    logger.info("=" * 60)
    
    # Ensure session storage directory exists
    from agent.api.core.config import SESSION_STORAGE_DIR
    SESSION_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    # Ensure MCP discovery manifest exists with default Docker MCP Gateway entry.
    try:
        from agent.api.endpoints.mcp_servers import ensure_default_mcp_server_manifest

        ensure_default_mcp_server_manifest()
    except Exception as exc:
        logger.warning("Failed to seed default MCP server manifest: %s", exc)
    
    yield
    
    logger.info("=" * 60)
    logger.info("Ron Browser API Shutting Down")
    logger.info("=" * 60)


# Create FastAPI application
app = FastAPI(
    title="Ron Browser API",
    description="AI Agent Browser with Project Management",
    version="3.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include endpoint routers
app.include_router(agents.router, prefix="/agents", tags=["agents"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(tools.router, prefix="/tools", tags=["tools"])
app.include_router(mcp_servers.router, prefix="/mcp-servers", tags=["mcp-servers"])
app.include_router(openapi_specs.router, prefix="/openapi-specs", tags=["openapi-specs"])
app.include_router(browser_sessions.router, prefix="/browser-sessions", tags=["browser-sessions"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from datetime import datetime
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "3.0.0"
    }


@app.get("/config")
async def get_config():
    """Get API configuration."""
    from agent.api.core.config import NVIDIA_NIM_API_KEY, PERPLEXITY_API_KEY
    return {
        "cors_origins": CORS_ORIGINS,
        "features": {
            "agents": bool(NVIDIA_NIM_API_KEY),
            "search": bool(PERPLEXITY_API_KEY),
            "projects": True,
            "browser": True
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
