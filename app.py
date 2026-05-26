"""AI Image Studio - Local web tool for image generation APIs."""

import json
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from helpers import find_port, json_response, error_response, serve_file, get_content_type, parse_multipart
from config_manager import ConfigManager
from history_manager import HistoryManager
from queue_manager import QueueManager

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

config_mgr = None
history_mgr = None
queue_mgr = None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            serve_file(self, STATIC_DIR / "index.html")
        elif path.startswith("/static/"):
            serve_file(self, STATIC_DIR / path[len("/static/"):])
        elif path == "/api/config":
            json_response(self, config_mgr.get_all())
        elif path == "/api/queue":
            json_response(self, queue_mgr.get_all())
        elif path == "/api/history":
            qs = parse_qs(parsed.query)
            q = qs.get("q", [""])[0]
            json_response(self, history_mgr.get_all(query=q or None))
        elif path.startswith("/api/images/"):
            self._serve_queue_image(path)
        elif path.startswith("/api/history/") and "/images/" in path:
            self._serve_history_image(path)
        else:
            error_response(self, 404, "Not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_type = self.headers.get("Content-Type", "")

        if path == "/api/config":
            self._create_config()
        elif path == "/api/config/test":
            self._test_config()
        elif path == "/api/config/first-run-done":
            config_mgr.mark_first_run_done()
            json_response(self, {"ok": True})
        elif path.startswith("/api/config/activate/"):
            cid = path.split("/api/config/activate/")[1]
            if config_mgr.set_active(cid):
                json_response(self, {"ok": True})
            else:
                error_response(self, 404, "Config not found")
        elif path == "/api/generate":
            self._handle_generate(content_type)
        else:
            error_response(self, 404, "Not found")

    def do_PUT(self):
        path = urlparse(self.path).path
        if path.startswith("/api/config/"):
            cid = path.split("/api/config/")[1]
            body = self._read_json()
            if body is None:
                return
            cfg = config_mgr.update(cid, body)
            if cfg:
                json_response(self, cfg)
            else:
                error_response(self, 404, "Config not found")
        else:
            error_response(self, 404, "Not found")

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith("/api/config/"):
            cid = path.split("/api/config/")[1]
            if config_mgr.delete(cid):
                json_response(self, {"ok": True})
            else:
                error_response(self, 404, "Config not found")
        elif path.startswith("/api/queue/"):
            tid = path.split("/api/queue/")[1]
            if queue_mgr.cancel(tid):
                json_response(self, {"ok": True})
            else:
                error_response(self, 404, "Task not found or not cancellable")
        elif path.startswith("/api/history/"):
            eid = path.split("/api/history/")[1]
            if history_mgr.delete(eid):
                json_response(self, {"ok": True})
            else:
                error_response(self, 404, "Entry not found")
        else:
            error_response(self, 404, "Not found")

    # ── Config ──

    def _create_config(self):
        body = self._read_json()
        if body is None:
            return
        for f in ("name", "url", "api_key", "model"):
            if not body.get(f):
                error_response(self, 400, f"Missing field: {f}")
                return
        cfg = config_mgr.create(
            name=body["name"], url=body["url"],
            api_key=body["api_key"], model=body["model"],
            default_output_dir=body.get("default_output_dir", ""),
            default_params=body.get("default_params"),
        )
        json_response(self, cfg, 201)

    def _test_config(self):
        body = self._read_json()
        if body is None:
            return
        url = body.get("url", "")
        api_key = body.get("api_key", "")
        if not url or not api_key:
            error_response(self, 400, "Missing url or api_key")
            return
        ok, msg = ConfigManager.test_connection(url, api_key, body.get("model", ""))
        json_response(self, {"ok": ok, "message": msg})

    # ── Generate ──

    def _handle_generate(self, content_type):
        if "multipart/form-data" in content_type:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            parts = parse_multipart(content_type, body)
        else:
            error_response(self, 400, "Expected multipart form data")
            return

        prompt = parts.get("prompt", {}).get("text", "")
        if not prompt:
            error_response(self, 400, "Missing prompt")
            return

        config_id = parts.get("config_id", {}).get("text", "")
        if not config_id:
            config_id = config_mgr.data["active_config_id"]

        params = {}
        for key in ("size", "quality", "output_format", "output_compression", "input_fidelity", "moderation"):
            val = parts.get(key, {}).get("text", "")
            if val:
                if key == "output_compression":
                    try:
                        params[key] = int(val)
                    except ValueError:
                        pass
                else:
                    params[key] = val

        n = 1
        n_text = parts.get("n", {}).get("text", "")
        if n_text:
            try:
                n = max(1, min(10, int(n_text)))
            except ValueError:
                pass

        custom_filename = parts.get("custom_filename", {}).get("text", "")

        ref_images_raw = parts.get("image", [])
        if isinstance(ref_images_raw, dict):
            ref_images_raw = [ref_images_raw]
        ref_images = [p for p in ref_images_raw if p.get("data")]

        mode = "image-editing" if ref_images else "text-to-image"

        task = queue_mgr.enqueue(
            prompt=prompt, mode=mode, params=params,
            reference_images=ref_images, n=n,
            config_id=config_id, custom_filename=custom_filename,
        )
        json_response(self, task, 201)

    # ── Queue ──

    def _serve_queue_image(self, path):
        parts = path.split("/api/images/")[1].split("/", 1)
        if len(parts) != 2:
            error_response(self, 400, "Invalid path")
            return
        task_id, filename = parts
        fpath = queue_mgr.data_dir / task_id / filename
        if fpath.is_file():
            serve_file(self, fpath)
        else:
            error_response(self, 404, "Image not found")

    # ── History ──

    def _serve_history_image(self, path):
        parts = path.split("/api/history/")[1]
        segs = parts.split("/images/")
        if len(segs) != 2:
            error_response(self, 400, "Invalid path")
            return
        entry_id, filename = segs
        fpath = history_mgr.get_image_path(entry_id, filename)
        if fpath:
            serve_file(self, fpath)
        else:
            error_response(self, 404, "Image not found")

    # ── Helpers ──

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            error_response(self, 400, "Empty request body")
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            error_response(self, 400, "Invalid JSON")
            return None


def main():
    global config_mgr, history_mgr, queue_mgr

    data_dir = Path.home() / ".ai-image-studio" / "data"
    config_mgr = ConfigManager()
    history_mgr = HistoryManager(data_dir)
    queue_mgr = QueueManager(config_mgr, history_mgr, data_dir)

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
