# AI Image Studio

A local web tool for calling image generation APIs (OpenAI compatible format) with a visual UI.

## Features

- Configure your own API URL, API Key, and Model
- Visual UI for text-to-image and image-to-image generation
- Batch generation with queue management
- History browsing and search
- Cross-platform (Linux, macOS, Windows)

## Quick Start

```bash
# Install dependency
pip install requests

# Run
python3 app.py
```

The browser will open automatically at `http://127.0.0.1:7860`.

## Supported Models

Currently supports **gpt-image-2** (OpenAI compatible API). More models planned.

## Configuration

On first launch, a wizard will guide you through API configuration. You can modify settings anytime via the gear icon.

Config is stored at `~/.ai-image-studio/config.json`.

## License

MIT
