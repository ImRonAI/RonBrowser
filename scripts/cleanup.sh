#!/bin/bash

# Define ports to clean
# 8765: Python Backend
# 9222: Chrome DevTools Protocol (CDP) for Electron
# 3001: Playwright MCP Monitoring
PORTS="8765,9222,3001"

echo "🧹 Cleaning up processes on ports: $PORTS..."

# Find and kill processes
# lsof -ti returns only PIDs
# 2>/dev/null suppresses output if no processes found
# || true ensures script uses exit code 0 even if nothing killed
lsof -ti:$PORTS | xargs -r kill -9 2>/dev/null || true

echo "✅  Ports freed."
