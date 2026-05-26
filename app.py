"""AI Image Studio - Local web tool for image generation APIs."""

import json
import threading
import time
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from helpers import find_port, json_response, error_response, serve_file, get_content_type, parse_multipart
from config_manager import ConfigManager

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

config_mgr = None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            serve_file(self, STATIC_DIR / "index.html")
        elif path.startswith("/static/"):
            rel = path[len("/static/"):]
            serve_file(self, STATIC_DIR / rel)
        elif path == "/api/config":
            self._handle_get_config()
        elif path == "/api/config/test":
            error_response(self, 405, "Use POST for test")
        elif path.startswith("/api/images/"):
            self._handle_serve_image(path)
        elif path.startswith("/api/history/") and "/images/" in path:
            self._handle_serve_history_image(path)
        elif path == "/api/queue":
            self._handle_get_queue()
        elif path == "/api/history":
            self._handle_get_history(parsed)
        else:
            error_response(self, 404, "Not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_type = self.headers.get("Content-Type", "")

        if path == "/api/config":
            self._handle_create_config()
        elif path == "/api/config/test":
            self._handle_test_config()
        elif path == "/api/config/first-run-done":
            config_mgr.mark_first_run_done()
            json_response(self, {"ok": True})
        elif path.startswith("/api/config/activate/"):
            config_id = path.split("/api/config/activate/")[1]
            self._handle_activate_config(config_id)
        elif path == "/api/generate":
            self._handle_generate(content_type)
        else:
            error_response(self, 404, "Not found")

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/config/"):
            config_id = path.split("/api/config/")[1]
            self._handle_update_config(config_id)
        else:
            error_response(self, 404, "Not found")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/config/"):
            config_id = path.split("/api/config/")[1]
            self._handle_delete_config(config_id)
        elif path.startswith("/api/queue/"):
            task_id = path.split("/api/queue/")[1]
            self._handle_cancel_task(task_id)
        elif path.startswith("/api/history/"):
            entry_id = path.split("/api/history/")[1]
            self._handle_delete_history(entry_id)
        else:
            error_response(self, 404, "Not found")

    # ── Config handlers ──

    def _handle_get_config(self):
        json_response(self, config_mgr.get_all())

    def _handle_create_config(self):
        body = self._read_json()
        if not body:
            return
        required = ("name", "url", "api_key", "model")
        for f in required:
            if not body.get(f):
                error_response(self, 400, f"Missing field: {f}")
                return
        cfg = config_mgr.create(
            name=body["name"],
            url=body["url"],
            api_key=body["api_key"],
            model=body["model"],
            default_output_dir=body.get("default_output_dir", ""),
            default_params=body.get("default_params"),
        )
        json_response(self, cfg, 201)

    def _handle_update_config(self, config_id):
        body = self._read_json()
        if not body:
            return
        cfg = config_mgr.update(config_id, body)
        if not cfg:
            error_response(self, 404, "Config not found")
            return
        json_response(self, cfg)

    def _handle_delete_config(self, config_id):
        if config_mgr.delete(config_id):
            json_response(self, {"ok": True})
        else:
            error_response(self, 404, "Config not found")

    def _handle_test_config(self):
        body = self._read_json()
        if not body:
            return
        url = body.get("url", "")
        api_key = body.get("api_key", "")
        model = body.get("model", "")
        if not url or not api_key:
            error_response(self, 400, "Missing url or api_key")
            return
        ok, msg = ConfigManager.test_connection(url, api_key, model)
        json_response(self, {"ok": ok, "message": msg})

    def _handle_activate_config(self, config_id):
        if config_mgr.set_active(config_id):
            json_response(self, {"ok": True})
        else:
            error_response(self, 404, "Config not found")

    # ── Generate handler (placeholder for Phase 3) ──

    def _handle_generate(self, content_type):
        error_response(self, 501, "Generation not implemented yet")

    # ── Queue handlers (placeholder for Phase 5) ──

    def _handle_get_queue(self):
        json_response(self, [])

    def _handle_cancel_task(self, task_id):
        error_response(self, 404, "Queue not implemented yet")

    # ── History handlers (placeholder for Phase 6) ──

    def _handle_get_history(self, parsed):
        json_response(self, [])

    def _handle_delete_history(self, entry_id):
        error_response(self, 404, "History not implemented yet")

    def _handle_serve_image(self, path):
        error_response(self, 404, "Not found")

    def _handle_serve_history_image(self, path):
        error_response(self, 404, "Not found")

    # ── Helpers ──

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            error_response(self, 400, "Empty request body")
            return None
        try:
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            error_response(self, 400, "Invalid JSON")
            return None


def main():
    global config_mgr
    config_mgr = ConfigManager()

    port = find_port()
    server = HTTPServer(("127.0.0.1", port), Handler)

    print(f"AI Image Studio")
    print(f"  http://127.0.0.1:{port}")
    print(f"  Press Ctrl+C to stop\n")

    threading.Timer(0.5, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
