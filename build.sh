#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== AI Image Studio - Build ==="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found"
    exit 1
fi

# Install PyInstaller if needed
if ! python3 -c "import PyInstaller" &> /dev/null; then
    echo "Installing PyInstaller..."
    pip install pyinstaller
fi

# Install project dependencies
echo "Installing dependencies..."
pip install requests

# Build
echo "Building with PyInstaller..."
python3 -m PyInstaller --clean ai-image-studio.spec

echo ""
echo "=== Build complete ==="
echo "Output: dist/ai-image-studio"
echo "Run: ./dist/ai-image-studio"
