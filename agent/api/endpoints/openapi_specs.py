"""
OpenAPI Spec registry endpoints.

Manages OpenAPI specifications with:
- name: Spec identifier
- path: Path to spec file
- description: What the API does
- For use with OpenAPI-to-MCP converter
"""

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

class OpenAPISpecCreate(BaseModel):
    name: str = Field(..., description="Unique spec identifier")
    file: str = Field(..., description="Filename of the spec")
    path: str = Field(..., description="Full path to spec file")
    description: Optional[str] = Field(default=None, description="What the API does")
    mcp_command: Optional[str] = Field(default=None, description="Command to convert to MCP")


class OpenAPISpecUpdate(BaseModel):
    name: Optional[str] = None
    file: Optional[str] = None
    path: Optional[str] = None
    description: Optional[str] = None
    mcp_command: Optional[str] = None


class OpenAPISpec(BaseModel):
    name: str
    file: str
    path: str
    description: Optional[str]
    mcp_command: Optional[str]
    created_at: str
    updated_at: str


# -----------------------------------------------------------------------------
# Storage
# -----------------------------------------------------------------------------

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
    DISCOVERY_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DISCOVERY_MANIFEST_PATH, 'w') as f:
        json.dump(manifest, f, indent=2)


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/", response_model=List[OpenAPISpec])
async def list_openapi_specs():
    """List all registered OpenAPI specs."""
    manifest = _load_manifest()
    specs = manifest.get("openapi_specs", [])
    return [OpenAPISpec(**s) for s in specs]


@router.post("/", response_model=OpenAPISpec, status_code=201)
async def create_openapi_spec(spec: OpenAPISpecCreate):
    """Register a new OpenAPI spec."""
    manifest = _load_manifest()
    specs = manifest.get("openapi_specs", [])
    
    # Check for duplicate name
    if any(s["name"] == spec.name for s in specs):
        raise HTTPException(status_code=400, detail=f"Spec with name '{spec.name}' already exists")
    
    now = datetime.utcnow().isoformat()
    spec_data = {
        "name": spec.name,
        "file": spec.file,
        "path": spec.path,
        "description": spec.description,
        "mcp_command": spec.mcp_command,
        "created_at": now,
        "updated_at": now
    }
    
    specs.append(spec_data)
    manifest["openapi_specs"] = specs
    _save_manifest(manifest)
    
    return OpenAPISpec(**spec_data)


@router.get("/{spec_name}", response_model=OpenAPISpec)
async def get_openapi_spec(spec_name: str = PathParam(..., description="Spec name")):
    """Get a specific OpenAPI spec."""
    manifest = _load_manifest()
    specs = manifest.get("openapi_specs", [])
    
    for spec in specs:
        if spec["name"] == spec_name:
            return OpenAPISpec(**spec)
    
    raise HTTPException(status_code=404, detail=f"OpenAPI spec not found: {spec_name}")


@router.get("/{spec_name}/content")
async def get_openapi_spec_content(spec_name: str = PathParam(..., description="Spec name")):
    """Get the raw content of an OpenAPI spec."""
    manifest = _load_manifest()
    specs = manifest.get("openapi_specs", [])
    
    for spec in specs:
        if spec["name"] == spec_name:
            try:
                spec_path = Path(spec["path"])
                with open(spec_path, 'r') as f:
                    content = f.read()
                
                # Try to parse as JSON
                try:
                    parsed = json.loads(content)
                    return {
                        "name": spec_name,
                        "format": "json",
                        "content": parsed
                    }
                except json.JSONDecodeError:
                    # Return as YAML string
                    return {
                        "name": spec_name,
                        "format": "yaml",
                        "content": content
                    }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to read spec: {e}")
    
    raise HTTPException(status_code=404, detail=f"OpenAPI spec not found: {spec_name}")


@router.put("/{spec_name}", response_model=OpenAPISpec)
async def update_openapi_spec(
    spec_update: OpenAPISpecUpdate,
    spec_name: str = PathParam(..., description="Spec name")
):
    """Update an OpenAPI spec."""
    manifest = _load_manifest()
    specs = manifest.get("openapi_specs", [])
    
    for i, spec in enumerate(specs):
        if spec["name"] == spec_name:
            # Update fields
            if spec_update.name is not None:
                spec["name"] = spec_update.name
            if spec_update.file is not None:
                spec["file"] = spec_update.file
            if spec_update.path is not None:
                spec["path"] = spec_update.path
            if spec_update.description is not None:
                spec["description"] = spec_update.description
            if spec_update.mcp_command is not None:
                spec["mcp_command"] = spec_update.mcp_command
            
            spec["updated_at"] = datetime.utcnow().isoformat()
            
            manifest["openapi_specs"] = specs
            _save_manifest(manifest)
            
            return OpenAPISpec(**spec)
    
    raise HTTPException(status_code=404, detail=f"OpenAPI spec not found: {spec_name}")


@router.delete("/{spec_name}")
async def delete_openapi_spec(spec_name: str = PathParam(..., description="Spec name")):
    """Delete an OpenAPI spec."""
    manifest = _load_manifest()
    specs = manifest.get("openapi_specs", [])
    
    for i, spec in enumerate(specs):
        if spec["name"] == spec_name:
            del specs[i]
            manifest["openapi_specs"] = specs
            _save_manifest(manifest)
            return {"status": "deleted", "spec_name": spec_name}
    
    raise HTTPException(status_code=404, detail=f"OpenAPI spec not found: {spec_name}")


@router.post("/{spec_name}/convert-to-mcp")
async def convert_to_mcp(spec_name: str = PathParam(..., description="Spec name")):
    """
    Convert an OpenAPI spec to MCP server.
    
    Uses the openapi-mcp tool to generate MCP server from spec.
    """
    manifest = _load_manifest()
    specs = manifest.get("openapi_specs", [])
    
    spec = None
    for s in specs:
        if s["name"] == spec_name:
            spec = s
            break
    
    if not spec:
        raise HTTPException(status_code=404, detail=f"OpenAPI spec not found: {spec_name}")
    
    # This would integrate with the openapi-mcp tool
    # For now, return the command that would be used
    mcp_command = spec.get("mcp_command") or f"npx openapi-mcp-server {spec['path']}"
    
    return {
        "spec_name": spec_name,
        "mcp_command": mcp_command,
        "status": "ready_to_convert",
        "note": "Use this command with mcp_client tool to convert and connect"
    }
