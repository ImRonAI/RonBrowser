#!/usr/bin/env python3
"""
Comprehensive Tool Discovery Manifest Generator

Scans ALL tool sources and generates a unified manifest for the agent:
- strands_tools (excluding baseline)
- strands-fun-tools
- strands-google  
- Custom tools (FDA, PubMed, Perplexity)
- MCP servers (connection info)
- OpenAPI specs (for openapi-mcp)
"""

import ast
import json
import os
import sys
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)

# Baseline tools - these are always loaded, not discoverable for load_tool
BASELINE_TOOLS = {
    'editor', 'shell', 'load_tool', 'mcp_client', 'a2a_client',
    'http_request', 'mem0_memory', 'stop', 'sleep', 'think', 
    'environment', 'file_read', 'file_write'
}

# Tool directories to scan
TOOL_SOURCES = {
    'strands_tools': 'agent/tools/src/strands_tools',
    'strands_fun_tools': 'agent/tools/strands-fun-tools/strands_fun_tools',
    'strands_google': 'agent/tools/strands-fun-tools/strands-google/strands_google',
    'fda': 'agent/tools/FDA',
    'pubmed': 'agent/tools/pubmed ',
    'perplexity': 'agent/tools/perplexity',
}

# MCP servers
MCP_SERVERS = {
    'healthcare-mcp': {
        'path': 'agent/tools/src/strands_tools/mcp/healthcare-mcp-public',
        'command': 'node',
        'args': ['server/index.js'],
        'description': 'Healthcare MCP Server for FDA, PubMed, clinical trials, ICD-10'
    },
    'pophive-mcp': {
        'path': 'agent/tools/src/strands_tools/mcp/pophive-mcp-server',
        'command': 'node', 
        'args': ['server/index.js'],
        'description': 'PopHIVE public health data - CDC, immunizations, respiratory, chronic disease'
    },
    'openapi-mcp': {
        'path': 'agent/tools/src/strands_tools/mcp/openapi-mcp',
        'command': 'npx',
        'args': ['@ivotoby/openapi-mcp-server'],
        'description': 'Converts OpenAPI specs to MCP tools dynamically'
    },
    'datacommons': {
        'path': 'agent/tools/src/strands_tools/mcp/datacommons',
        'command': 'node',
        'args': ['dist/index.js'],
        'description': 'Google Data Commons statistical data'
    },
    'playwright-electron-mcp': {
        'path': 'agent/tools/src/strands_tools/mcp/mcp-playwright',
        'command': 'node',
        'args': [
            'dist/index.js',
            '--electron-mode', 'electron',
            '--electron-bridge-url', 'http://127.0.0.1:9231',
            '--electron-iframe-selector', 'iframe[data-active="true"]',
            '--electron-iframe-type', 'iframe'
        ],
        'description': 'Playwright/Electron MCP Server (Electron UI only)'
    }
}


def extract_tool_metadata(py_file: Path) -> Optional[Dict[str, Any]]:
    """Extract tool metadata from a Python file using AST parsing."""
    try:
        source = py_file.read_text(encoding='utf-8')
        tree = ast.parse(source)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                has_tool_decorator = any(
                    (isinstance(d, ast.Name) and d.id == 'tool') or
                    (isinstance(d, ast.Call) and isinstance(d.func, ast.Name) and d.func.id == 'tool')
                    for d in node.decorator_list
                )
                
                if has_tool_decorator:
                    docstring = ast.get_docstring(node) or f"Tool: {node.name}"
                    description = docstring.split('\n')[0].strip()
                    
                    return {
                        "name": node.name,
                        "description": description,
                        "file": py_file.name,
                        "path": str(py_file.absolute())
                    }
        return None
    except Exception as e:
        logger.debug(f"Could not parse {py_file}: {e}")
        return None


def scan_tool_directory(base_path: Path, tool_dir: str, category: str) -> List[Dict[str, Any]]:
    """Scan a directory for Python tools."""
    tools = []
    full_path = base_path / tool_dir
    
    if not full_path.exists():
        logger.warning(f"Directory not found: {full_path}")
        return tools
    
    for item in full_path.iterdir():
        if item.name.startswith('_') or item.name == 'utils':
            continue
        if item.is_dir():
            continue
        if not item.suffix == '.py':
            continue
            
        metadata = extract_tool_metadata(item)
        if metadata:
            # Skip baseline tools
            if metadata['name'] in BASELINE_TOOLS:
                continue
            metadata['category'] = category
            metadata['load_command'] = f"load_tool(path='{metadata['path']}', name='{metadata['name']}')"
            tools.append(metadata)
            
    return tools


def scan_openapi_specs(base_path: Path) -> List[Dict[str, Any]]:
    """Scan OpenAPI specs directory."""
    specs = []
    specs_dir = base_path / 'agent/tools/open-api-specs'
    
    if not specs_dir.exists():
        return specs
        
    for item in specs_dir.iterdir():
        if item.suffix in ['.json', '.yaml', '.yml']:
            specs.append({
                "name": item.stem,
                "file": item.name,
                "path": str(item.absolute()),
                "type": "openapi_spec",
                "mcp_command": f"mcp_client(action='connect', connection_id='{item.stem}', transport='stdio', command='npx', args=['@ivotoby/openapi-mcp-server', '--openapi-spec', '{item.absolute()}', '--api-base-url', 'API_BASE_URL_HERE'])"
            })
    return specs


def generate_manifest(base_path: Path, output_path: Path, custom_tools_dir: Optional[Path] = None) -> Dict[str, Any]:
    """Generate the complete tools manifest."""
    
    manifest = {
        "generated_at": __import__('datetime').datetime.now().isoformat(),
        "loadable_tools": [],
        "mcp_servers": [],
        "openapi_specs": [],
        "custom_tools_dir": str(custom_tools_dir) if custom_tools_dir else None
    }
    
    # Scan all Python tool directories
    for category, tool_dir in TOOL_SOURCES.items():
        logger.info(f"Scanning {category}...")
        tools = scan_tool_directory(base_path, tool_dir, category)
        manifest["loadable_tools"].extend(tools)
        logger.info(f"  Found {len(tools)} tools")
    
    # Scan custom tools directory if provided
    if custom_tools_dir and custom_tools_dir.exists():
        logger.info("Scanning custom_tools...")
        for item in custom_tools_dir.iterdir():
            if item.suffix == '.py' and not item.name.startswith('_'):
                metadata = extract_tool_metadata(item)
                if metadata:
                    metadata['category'] = 'custom'
                    metadata['load_command'] = f"load_tool(path='{metadata['path']}', name='{metadata['name']}')"
                    manifest["loadable_tools"].append(metadata)
        logger.info(f"  Found {len([t for t in manifest['loadable_tools'] if t.get('category') == 'custom'])} custom tools")
    
    # Add MCP servers
    for server_id, config in MCP_SERVERS.items():
        server_path = base_path / config['path']
        env_arg = f", env={config['env']}" if config.get('env') else ""
        manifest["mcp_servers"].append({
            "id": server_id,
            "description": config['description'],
            "path": str(server_path.absolute()),
            "exists": server_path.exists(),
            "connect_command": f"mcp_client(action='connect', connection_id='{server_id}', transport='stdio', command='{config['command']}', args={config['args']}{env_arg})"
        })
    
    # Scan OpenAPI specs
    manifest["openapi_specs"] = scan_openapi_specs(base_path)
    
    # Write manifest
    output_path.mkdir(parents=True, exist_ok=True)
    manifest_file = output_path / "tools_discovery_manifest.json"
    with open(manifest_file, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    # Summary
    summary = {
        "success": True,
        "loadable_tools_count": len(manifest["loadable_tools"]),
        "mcp_servers_count": len(manifest["mcp_servers"]),
        "openapi_specs_count": len(manifest["openapi_specs"]),
        "manifest_path": str(manifest_file)
    }
    
    logger.info(f"Generated manifest: {len(manifest['loadable_tools'])} tools, {len(manifest['mcp_servers'])} MCP servers, {len(manifest['openapi_specs'])} OpenAPI specs")
    
    return summary


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: manifest_updater.py <project_root> <output_dir> [custom_tools_dir]"}))
        sys.exit(1)
    
    base_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    custom_tools_dir = Path(sys.argv[3]) if len(sys.argv) > 3 else None
    
    if not base_path.exists():
        print(json.dumps({"success": False, "error": f"Project root not found: {base_path}"}))
        sys.exit(1)
    
    result = generate_manifest(base_path, output_path, custom_tools_dir)
    print(json.dumps(result))
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
