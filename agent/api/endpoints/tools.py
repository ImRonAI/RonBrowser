"""
Tool catalog endpoints with @tool decorator discovery.

Discovers tools by:
1. Parsing Python files for @tool decorator
2. Reading TOOL_SPEC attributes
3. Building catalog with name, description, path, schema
"""

import os
import ast
import inspect
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from agent.api.core.config import TOOLS_SRC_DIR

router = APIRouter()


# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------

class ToolInfo(BaseModel):
    name: str
    description: str
    path: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = None
    category: str = "strands_tools"
    has_tool_decorator: bool = True


class ToolCategory(BaseModel):
    id: str
    label: str
    tools: List[str]
    count: int


class ToolCatalog(BaseModel):
    generated_at: str
    categories: List[ToolCategory]


# -----------------------------------------------------------------------------
# Tool Discovery
# -----------------------------------------------------------------------------

def extract_tool_decorator_info(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse a Python file to find @tool decorated functions.
    
    Args:
        file_path: Path to Python file
        
    Returns:
        List of tool information dicts
    """
    tools = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                # Check for @tool decorator
                has_tool_decorator = False
                decorator_names = []
                
                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Name):
                        decorator_names.append(decorator.id)
                        if decorator.id == 'tool':
                            has_tool_decorator = True
                    elif isinstance(decorator, ast.Call):
                        if isinstance(decorator.func, ast.Name) and decorator.func.id == 'tool':
                            has_tool_decorator = True
                            decorator_names.append('tool')
                
                if has_tool_decorator:
                    # Get docstring
                    docstring = ast.get_docstring(node) or ""
                    
                    # Look for TOOL_SPEC assignment in function body
                    tool_spec = None
                    for item in node.body:
                        if isinstance(item, ast.Assign):
                            for target in item.targets:
                                if isinstance(target, ast.Name) and target.id == 'TOOL_SPEC':
                                    try:
                                        # Try to evaluate the TOOL_SPEC dict
                                        tool_spec = ast.literal_eval(item.value)
                                    except:
                                        pass
                    
                    tool_info = {
                        "name": node.name,
                        "description": docstring.split('\n')[0] if docstring else "",
                        "full_docstring": docstring,
                        "path": str(file_path.relative_to(Path(__file__).parent.parent.parent)),
                        "has_tool_decorator": True,
                        "decorators": decorator_names,
                        "tool_spec": tool_spec,
                        "input_schema": tool_spec.get('inputSchema') if tool_spec else None,
                        "line_number": node.lineno
                    }
                    
                    tools.append(tool_info)
    
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    
    return tools


def discover_tools_by_decorator(directory: Path) -> List[Dict[str, Any]]:
    """
    Recursively discover all @tool decorated functions in a directory.
    
    Args:
        directory: Root directory to search
        
    Returns:
        List of tool information dicts
    """
    all_tools = []
    
    if not directory.exists():
        return all_tools
    
    for py_file in directory.rglob("*.py"):
        # Skip __pycache__ and test files
        if "__pycache__" in str(py_file) or py_file.name.startswith("test_"):
            continue
        
        tools = extract_tool_decorator_info(py_file)
        all_tools.extend(tools)
    
    return all_tools


def get_category_for_tool(tool: Dict[str, Any]) -> str:
    """Determine category for a tool based on its path."""
    path = tool.get("path", "")
    
    if "browser" in path.lower():
        return "browser"
    elif "memory" in path.lower():
        return "memory"
    elif "mcp" in path.lower():
        return "mcp"
    elif "sandbox" in path.lower():
        return "sandbox"
    else:
        return "strands_tools"


# Cache for discovered tools
_discovered_tools_cache: Optional[List[Dict[str, Any]]] = None


def get_discovered_tools() -> List[Dict[str, Any]]:
    """Get discovered tools (with caching)."""
    global _discovered_tools_cache
    
    if _discovered_tools_cache is None:
        _discovered_tools_cache = discover_tools_by_decorator(TOOLS_SRC_DIR)
    
    return _discovered_tools_cache


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/catalog", response_model=ToolCatalog)
async def get_tool_catalog():
    """
    Get the full tool catalog organized by categories.
    
    Discovers tools by parsing @tool decorator from source files.
    """
    from datetime import datetime
    
    tools = get_discovered_tools()
    
    # Organize by category
    categories = {}
    
    for tool in tools:
        category = get_category_for_tool(tool)
        
        if category not in categories:
            categories[category] = {
                "id": category,
                "label": category.replace("_", " ").title(),
                "tools": []
            }
        
        categories[category]["tools"].append(tool["name"])
    
    # Convert to list format
    category_list = []
    for cat_id, cat_data in categories.items():
        category_list.append(ToolCategory(
            id=cat_data["id"],
            label=cat_data["label"],
            tools=cat_data["tools"],
            count=len(cat_data["tools"])
        ))
    
    return ToolCatalog(
        generated_at=datetime.utcnow().isoformat(),
        categories=category_list
    )


@router.get("/list", response_model=List[ToolInfo])
async def list_tools(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in name/description")
):
    """
    List all discovered tools.
    
    Args:
        category: Filter by tool category
        search: Search term for name or description
    """
    tools = get_discovered_tools()
    
    result = []
    for tool in tools:
        # Apply category filter
        if category:
            tool_category = get_category_for_tool(tool)
            if tool_category != category:
                continue
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            if (search_lower not in tool["name"].lower() and 
                search_lower not in tool.get("description", "").lower()):
                continue
        
        result.append(ToolInfo(
            name=tool["name"],
            description=tool.get("description", ""),
            path=tool.get("path"),
            input_schema=tool.get("input_schema"),
            category=get_category_for_tool(tool),
            has_tool_decorator=tool.get("has_tool_decorator", True)
        ))
    
    return result


@router.get("/{tool_name}", response_model=Dict[str, Any])
async def get_tool_details(tool_name: str):
    """
    Get detailed information about a specific tool.
    
    Args:
        tool_name: Name of the tool
    """
    tools = get_discovered_tools()
    
    for tool in tools:
        if tool["name"] == tool_name:
            return {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "full_docstring": tool.get("full_docstring", ""),
                "path": tool.get("path"),
                "line_number": tool.get("line_number"),
                "has_tool_decorator": tool.get("has_tool_decorator"),
                "decorators": tool.get("decorators", []),
                "tool_spec": tool.get("tool_spec"),
                "input_schema": tool.get("input_schema"),
                "category": get_category_for_tool(tool)
            }
    
    raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")


@router.post("/refresh")
async def refresh_tool_cache():
    """Refresh the tool discovery cache."""
    global _discovered_tools_cache
    _discovered_tools_cache = None
    
    # Force re-discovery
    tools = get_discovered_tools()
    
    return {
        "status": "refreshed",
        "tool_count": len(tools)
    }


@router.get("/{tool_name}/source")
async def get_tool_source(tool_name: str):
    """
    Get the source code for a specific tool.
    
    Args:
        tool_name: Name of the tool
    """
    tools = get_discovered_tools()
    
    for tool in tools:
        if tool["name"] == tool_name:
            path = Path(__file__).parent.parent.parent / tool["path"]
            
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                return {
                    "name": tool_name,
                    "path": str(path),
                    "line_number": tool.get("line_number"),
                    "source_file": content
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to read source: {e}")
    
    raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")
