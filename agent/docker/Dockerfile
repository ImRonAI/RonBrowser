FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# System deps for virtual desktop
RUN apt-get update && apt-get -y install \
    xvfb xterm xdotool scrot imagemagick mutter x11vnc \
    python3 python3-pip git \
    tesseract-ocr \
    firefox-esr chromium-browser gedit pcmanfm \
    && rm -rf /var/lib/apt/lists/*

# noVNC for viewing the desktop
RUN git clone --branch v1.5.0 https://github.com/novnc/noVNC.git /opt/noVNC && \
    git clone --branch v0.12.0 https://github.com/novnc/websockify /opt/noVNC/utils/websockify && \
    ln -s /opt/noVNC/vnc.html /opt/noVNC/index.html

WORKDIR /app

# Python deps - just what's needed for the sandbox API
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Sandbox A2A agent
COPY sandbox_agent.py .

# Display config
ENV DISPLAY_NUM=1
ENV WIDTH=1024
ENV HEIGHT=768
ENV DISPLAY=:1

EXPOSE 9000 5900 6080

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
