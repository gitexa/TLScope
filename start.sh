#!/bin/bash
# Quick start script for the Slide Viewer

echo "================================================"
echo "🔬 TLScope - Quick Start"
echo "================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "server.py" ]; then
    echo "Error: Please run this script from the slide-viewer directory"
    exit 1
fi

# Default port
PORT=8080

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -p, --port PORT    Port to run server on (default: 8080)"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "Example:"
            echo "  ./start.sh --port 9000"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Warning: Port $PORT is already in use"
    echo "Please use a different port with: ./start.sh --port <PORT>"
    exit 1
fi

echo "Starting server on port $PORT..."
echo ""
echo "📍 Access the viewer at: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "================================================"
echo ""

# Check if OpenSlide is available
if python3 -c "import openslide" 2>/dev/null; then
    echo "✅ OpenSlide detected - using enhanced server with WSI support"
    python3 server_enhanced.py --port $PORT --dir .
else
    echo "⚠️  OpenSlide not found - using basic server (no WSI viewing)"
    echo "   Install OpenSlide for whole slide image viewing:"
    echo "   pip install openslide-python"
    echo ""
    python3 server.py --port $PORT --dir .
fi
