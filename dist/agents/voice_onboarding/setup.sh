#!/bin/bash

# Voice Onboarding Agent Setup Script

set -e

echo "🎤 Setting up Voice Onboarding Agent..."
echo ""

# Check Python version
echo "Checking Python version..."
python_version=$(python --version 2>&1 | awk '{print $2}')
required_version="3.12"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Error: Python $required_version or higher is required (found $python_version)"
    exit 1
fi
echo "✅ Python $python_version detected"
echo ""

# Install system dependencies (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Installing PortAudio (required for audio I/O)..."
    if command -v brew &> /dev/null; then
        brew install portaudio || true
        echo "✅ PortAudio installed"
    else
        echo "⚠️  Homebrew not found. Please install PortAudio manually:"
        echo "   brew install portaudio"
    fi
    echo ""
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt
echo "✅ Dependencies installed"
echo ""

# Check for API key
if [ -z "$GOOGLE_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  API key not found in environment"
    echo ""
    echo "To get an API key:"
    echo "  1. Visit https://aistudio.google.com/app/apikey"
    echo "  2. Create a new API key"
    echo "  3. Set it in your environment:"
    echo "     export GOOGLE_API_KEY=your_api_key_here"
    echo "     # or"
    echo "     export GEMINI_API_KEY=your_api_key_here"
    echo ""
    echo "Or create a .env file (see .env.example)"
else
    if [ -n "$GOOGLE_API_KEY" ]; then
        echo "✅ GOOGLE_API_KEY found"
    fi
    if [ -n "$GEMINI_API_KEY" ]; then
        echo "✅ GEMINI_API_KEY found"
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the voice agent:"
echo "  python agent.py"
echo ""
echo "To test audio devices:"
echo "  python -c 'import pyaudio; p = pyaudio.PyAudio(); [print(f\"{i}: {p.get_device_info_by_index(i)[\'name\']}\") for i in range(p.get_device_count())]'"
echo ""
