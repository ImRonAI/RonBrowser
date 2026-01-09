#!/bin/bash
set -e

# Start virtual display
Xvfb :${DISPLAY_NUM} -screen 0 ${WIDTH}x${HEIGHT}x24 &
sleep 2

# Start window manager
DISPLAY=:${DISPLAY_NUM} mutter --replace 2>/dev/null &
sleep 1

# Start VNC server
x11vnc -display :${DISPLAY_NUM} -forever -shared -rfbport 5900 -nopw 2>/dev/null &

# Start noVNC web interface
/opt/noVNC/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &

echo "Desktop sandbox ready"
echo "  A2A: http://localhost:9000"
echo "  VNC: http://localhost:6080/vnc.html"

# Start the sandbox A2A agent
exec python3 sandbox_agent.py
