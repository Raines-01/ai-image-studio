# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AI Image Studio — a local web UI for generating images via OpenAI-compatible APIs (default: gpt-image-2). No framework, no build step for the frontend, minimal dependencies.

## Running

```bash
pip install requests
python3 app.py
# Opens browser at http://127.0.0.1:7860
```

## Building Release Binaries

```bash
# Linux AppImage
bash build.sh

# Windows .exe
build.bat

# Or push a tag to trigger CI (builds all 3 platforms + GitHub Release)
git tag v1.0.0 && git push origin v1.0.0
```

Dependencies: `pyinstaller`, `requests`. No other build tools needed.

## Architecture

**Backend** — Python stdlib `http.server` only, no frameworks. `app.py` is the entry point and router. Global singletons: `config_mgr`, `history_mgr`, `queue_mgr`.

**Frontend** — Vanilla JS, no build step. Files in `static/` loaded directly. JS "modules" are global objects (`API`, `App`, `Wizard`, `Settings`, `Queue`, `History`, `Viewer`).

**Data flow:**
1. Frontend POSTs FormData to `/api/generate`
2. `Handler` parses multipart via hand-rolled `helpers.parse_multipart()` (not `cgi.FieldStorage`)
3. Task goes into `QueueManager` (in-memory, single daemon worker thread, sequential FIFO)
4. Worker calls `api_client.generate_text()` or `generate_edit()` → saves images to disk → records in history
5. Frontend polls `/api/queue` every 1s, renders results when task completes

**Config** — `~/.ai-image-studio/config.json`. Atomic writes (`.tmp` + `os.replace()`). Schema: `{ version, first_run_done, active_config_id, configs: [...] }`.

**Edit mode** — Auto-detected by presence of reference images, not a user toggle. `input_fidelity` only sent in edit mode.

## Key Gotchas

- **Custom multipart parser** (`helpers.parse_multipart`) — not stdlib, not a library. Handles multiple files under the same field name.
- **Directory browser** uses tkinter subprocess — requires a display server, won't work headless.
- **In-memory queue** — queued tasks are lost on restart. History is persisted.
- **Port range** is 7860–7870; fails to start if all are busy.
- **No auth** — server binds to localhost only, API keys stored in plaintext.

## Project Layout

```
app.py                 # HTTP server, routing, static file serving
config_manager.py      # API config CRUD, atomic persistence
api_client.py          # HTTP calls to OpenAI-compatible endpoints
queue_manager.py       # In-memory task queue with worker thread
history_manager.py     # History persistence
helpers.py             # Port finding, responses, multipart parser
ai-image-studio.spec   # PyInstaller spec (shared by all platforms)
build.sh / build.bat   # Platform build scripts
static/
  index.html           # SPA shell
  app.js               # Main controller, state, generation logic
  api.js               # Fetch wrappers for all /api/* endpoints
  wizard.js            # First-run setup wizard
  settings.js          # Config management modal
  queue.js             # Task queue panel
  history.js           # History grid, search, context menus
  viewer.js            # Image lightbox with navigation
```
