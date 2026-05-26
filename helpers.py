"""Utility functions for AI Image Studio."""

import json
import socket
from pathlib import Path


def find_port(start=7860, end=7870):
    for port in range(start, end + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"No available port in range {start}-{end}")


CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}


def get_content_type(path):
    ext = Path(path).suffix.lower()
    return CONTENT_TYPES.get(ext, "application/octet-stream")


def json_response(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def error_response(handler, status, message):
    json_response(handler, {"error": message}, status)


def serve_file(handler, file_path, content_type=None):
    if not file_path.is_file():
        error_response(handler, 404, "File not found")
        return
    ct = content_type or get_content_type(str(file_path))
    data = file_path.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", ct)
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def parse_multipart(content_type, body):
    boundary = None
    for part in content_type.split(";"):
        part = part.strip()
        if part.startswith("boundary="):
            boundary = part[len("boundary="):]
            break
    if not boundary:
        return {}

    sep = b"--" + boundary.encode()
    parts = {}
    segments = body.split(sep)
    for seg in segments:
        if seg == b"" or seg == b"--\r\n" or seg == b"--":
            continue
        if b"\r\n\r\n" not in seg:
            continue
        raw_header, raw_body = seg.split(b"\r\n\r\n", 1)
        if raw_body.endswith(b"\r\n"):
            raw_body = raw_body[:-2]

        header_str = raw_header.decode("utf-8", errors="replace")
        name = None
        filename = None
        for hline in header_str.split("\r\n"):
            if "Content-Disposition:" in hline:
                for token in hline.split(";"):
                    token = token.strip()
                    if token.startswith("name="):
                        name = token.split("=", 1)[1].strip('"')
                    elif token.startswith("filename="):
                        filename = token.split("=", 1)[1].strip('"')

        if not name:
            continue

        entry = {"data": raw_body}
        if filename:
            entry["filename"] = filename
            entry["content_type"] = ""
            for hline in header_str.split("\r\n"):
                if "Content-Type:" in hline:
                    entry["content_type"] = hline.split(":", 1)[1].strip()
        else:
            entry["text"] = raw_body.decode("utf-8", errors="replace")

        if name in parts:
            existing = parts[name]
            if isinstance(existing, list):
                existing.append(entry)
            else:
                parts[name] = [existing, entry]
        else:
            parts[name] = entry

    return parts
