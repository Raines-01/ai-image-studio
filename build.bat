@echo off
setlocal

echo === AI Image Studio - Build ===

REM Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: python not found
    exit /b 1
)

REM Install PyInstaller if needed
python -c "import PyInstaller" >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

REM Install project dependencies
echo Installing dependencies...
pip install requests

REM Build
echo Building with PyInstaller...
pyinstaller --clean ai-image-studio.spec

echo.
echo === Build complete ===
echo Output: dist\ai-image-studio.exe
echo Run: dist\ai-image-studio.exe
pause
