"""
MCP Server registry endpoints.

Manages MCP server configurations with:
- name: Server identifier
- description: What the server does
- connection_command: How to connect (e.g., npx command, uvx command, etc.)
- configuration: Additional config (env vars, etc.)
"""

import os
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Path as PathParam
from pydantic import BaseModel, Field

from agent.api.core.config import DISCOVERY_MANIFEST_PATH

router = APIRouter()


# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------

class MCPServerCreate(BaseModel):
    id: str = Field(..., description="Unique server identifier")
    name: str = Field(..., description="Human-readable name")
    description: str = Field(..., description="What the server does")
    connection_command: str = Field(..., description="Command to start/connect to server")
    transport: str = Field(default="stdio", description="Transport type: stdio, sse, http")
    configuration: Optional[Dict[str, Any]] = Field(default=None, description="Additional config")
    env_vars: Optional[Dict[str, str]] = Field(default=None, description="Environment variables")


class MCPServerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    connection_command: Optional[str] = None
    transport: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    env_vars: Optional[Dict[str, str]] = None


class MCPServer(BaseModel):
    id: str
    name: str
    description: str
    connection_command: str
    transport: str
    configuration: Optional[Dict[str, Any]]
    env_vars: Optional[Dict[str, str]]
    created_at: str
    updated_at: str


# -----------------------------------------------------------------------------
# Storage
# -----------------------------------------------------------------------------

def _ensure_manifest_dir():
    """Ensure the manifest directory exists."""
    DISCOVERY_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)


def _load_manifest() -> Dict[str, Any]:
    """Load the discovery manifest."""
    if not DISCOVERY_MANIFEST_PATH.exists():
        return {
            "mcp_servers": [],
            "openapi_specs": [],
            "loadable_tools": []
        }
    
    try:
        with open(DISCOVERY_MANIFEST_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return {
            "mcp_servers": [],
            "openapi_specs": [],
            "loadable_tools": []
        }


def _save_manifest(manifest: Dict[str, Any]):
    """Save the discovery manifest."""
    _ensure_manifest_dir()
    with open(DISCOVERY_MANIFEST_PATH, 'w') as f:
        json.dump(manifest, f, indent=2)


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/", response_model=List[MCPServer])
async def list_mcp_servers():
    """List all registered MCP servers."""
    manifest = _load_manifest()
    servers = manifest.get("mcp_servers", [])
    return [MCPServer(**s) for s in servers]


@router.post("/", response_model=MCPServer, status_code=201)
async def create_mcp_server(server: MCPServerCreate):
    """Register a new MCP server."""
    manifest = _load_manifest()
    servers = manifest.get("mcp_servers", [])
    
    # Check for duplicate ID
    if any(s["id"] == server.id for s in servers):
        raise HTTPException(status_code=400, detail=f"Server with ID '{server.id}' already exists")
    
    now = datetime.utcnow().isoformat()
    server_data = {
        "id": server.id,
        "name": server.name,
        "description": server.description,
        "connection_command": server.connection_command,
        "transport": server.transport,
        "configuration": server.configuration or {},
        "env_vars": server.env_vars or {},
        "created_at": now,
        "updated_at": now
    }
    
    servers.append(server_data)
    manifest["mcp_servers"] = servers
    _save_manifest(manifest)
    
    return MCPServer(**server_data)


@router.get("/{server_id}", response_model=MCPServer)
async def get_mcp_server(server_id: str = PathParam(..., description="Server ID")):
    """Get a specific MCP server."""
    manifest = _load_manifest()
    servers = manifest.get("mcp_servers", [])
    
    for server in servers:
        if server["id"] == server_id:
            return MCPServer(**server)
    
    raise HTTPException(status_code=404, detail=f"MCP server not found: {server_id}")


@router.put("/{server_id}", response_model=MCPServer)
async def update_mcp_server(
    server_update: MCPServerUpdate,
    server_id: str = PathParam(..., description="Server ID")
):
    """Update an MCP server."""
    manifest = _load_manifest()
    servers = manifest.get("mcp_servers", [])
    
    for i, server in enumerate(servers):
        if server["id"] == server_id:
            # Update fields
            if server_update.name is not None:
                server["name"] = server_update.name
            if server_update.description is not None:
                server["description"] = server_update.description
            if server_update.connection_command is not None:
                server["connection_command"] = server_update.connection_command
            if server_update.transport is not None:
                server["transport"] = server_update.transport
            if server_update.configuration is not None:
                server["configuration"] = server_update.configuration
            if server_update.env_vars is not None:
                server["env_vars"] = server_update.env_vars
            
            server["updated_at"] = datetime.utcnow().isoformat()
            
            manifest["mcp_servers"] = servers
            _save_manifest(manifest)
            
            return MCPServer(**server)
    
    raise HTTPException(status_code=404, detail=f"MCP server not found: {server_id}")


@router.delete("/{server_id}")
async def delete_mcp_server(server_id: str = PathParam(..., description="Server ID")):
    """Delete an MCP server."""
    manifest = _load_manifest()
    servers = manifest.get("mcp_servers", [])
    
    for i, server in enumerate(servers):
        if server["id"] == server_id:
            del servers[i]
            manifest["mcp_servers"] = servers
            _save_manifest(manifest)
            return {"status": "deleted", "server_id": server_id}
    
    raise HTTPException(status_code=404, detail=f"MCP server not found: {server_id}")


@router.post("/{server_id}/test")
async def test_mcp_server(server_id: str = PathParam(..., description="Server ID")):
    """
    Test connection to an MCP server.
    
    Returns connection status and available tools.
    """
    manifest = _load_manifest()
    servers = manifest.get("mcp_servers", [])
    
    server = None
    for s in servers:
        if s["id"] == server_id:
            server = s
            break
    
    if not server:
        raise HTTPException(status_code=404, detail=f"MCP server not found: {server_id}")
    
    # Attempt to connect and list tools
    try:
        from strands_tools.mcp_client import mcp_client
        
        result = mcp_client(
            action="connect",
            server_id=server_id,
            command=server["connection_command"],
            transport=server.get("transport", "stdio")
        )
        
        return {
            "server_id": server_id,
            "status": "connected",
            "result": result
        }
    except Exception as e:
        return {
            "server_id": server_id,
            "status": "failed",
            "error": str(e)
        }
