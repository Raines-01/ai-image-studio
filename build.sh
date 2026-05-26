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

# Build with PyInstaller
echo "Building with PyInstaller..."
python3 -m PyInstaller --clean ai-image-studio.spec

# Create AppImage
echo "Creating AppImage..."

APPDIR="dist/AppDir"
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$APPDIR/usr/share/applications"

# Copy executable
cp dist/ai-image-studio "$APPDIR/usr/bin/"

# Copy icon
cp static/logo.png "$APPDIR/usr/share/icons/hicolor/256x256/apps/ai-image-studio.png"
cp static/logo.png "$APPDIR/ai-image-studio.png"

# Create .desktop file
cat > "$APPDIR/ai-image-studio.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=AI Image Studio
Comment=Local web tool for image generation APIs
Exec=ai-image-studio
Icon=ai-image-studio
Categories=Graphics;
Terminal=true
EOF

# Create AppRun
cat > "$APPDIR/AppRun" << 'EOF'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="${HERE}/usr/bin/:${PATH}"
export LD_LIBRARY_PATH="${HERE}/usr/lib/:${LD_LIBRARY_PATH}"
exec "${HERE}/usr/bin/ai-image-studio" "$@"
EOF
chmod +x "$APPDIR/AppRun"

# Download appimagetool if needed
if ! command -v appimagetool &> /dev/null && [ ! -f /tmp/appimagetool ]; then
    echo "Downloading appimagetool..."
    curl -L -o /tmp/appimagetool https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x /tmp/appimagetool
fi

APPIMAGETOOL=$(command -v appimagetool || echo "/tmp/appimagetool")

# Build AppImage
ARCH=x86_64 "$APPIMAGETOOL" "$APPDIR" dist/ai-image-studio-linux.AppImage 2>&1

echo ""
echo "=== Build complete ==="
echo "Output: dist/ai-image-studio-linux.AppImage"
echo "Run: ./dist/ai-image-studio-linux.AppImage"
