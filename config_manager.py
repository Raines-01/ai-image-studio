"""Configuration management for AI Image Studio."""

import json
import os
import uuid
from pathlib import Path

import requests


DEFAULT_CONFIG = {
    "version": 1,
    "first_run_done": False,
    "active_config_id": "",
    "configs": [],
}


class ConfigManager:
    def __init__(self, config_dir=None):
        self.config_dir = Path(config_dir) if config_dir else Path.home() / ".ai-image-studio"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "config.json"
        self.data = None
        self.load()

    def load(self):
        if self.config_file.exists():
            try:
                self.data = json.loads(self.config_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self.data = DEFAULT_CONFIG.copy()
        else:
            self.data = DEFAULT_CONFIG.copy()

    def save(self):
        tmp = self.config_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(str(tmp), str(self.config_file))

    def get_all(self):
        return {
            "first_run_done": self.data["first_run_done"],
            "active_config_id": self.data["active_config_id"],
            "configs": self.data["configs"],
        }

    def get(self, config_id):
        for c in self.data["configs"]:
            if c["id"] == config_id:
                return c
        return None

    def get_active(self):
        aid = self.data["active_config_id"]
        if aid:
            cfg = self.get(aid)
            if cfg:
                return cfg
        if self.data["configs"]:
            return self.data["configs"][0]
        return None

    def create(self, name, url, api_key, model, default_output_dir="", default_params=None):
        if default_params is None:
            default_params = {
                "size": "1024x1024",
                "quality": "auto",
                "output_format": "png",
                "output_compression": None,
                "moderation": "auto",
            }
        cfg = {
            "id": uuid.uuid4().hex[:12],
            "name": name,
            "url": url.rstrip("/"),
            "api_key": api_key,
            "model": model,
            "default_output_dir": default_output_dir,
            "default_params": default_params,
        }
        self.data["configs"].append(cfg)
        if not self.data["active_config_id"]:
            self.data["active_config_id"] = cfg["id"]
        self.save()
        return cfg

    def update(self, config_id, fields):
        cfg = self.get(config_id)
        if not cfg:
            return None
        for k, v in fields.items():
            if k in ("name", "url", "api_key", "model", "default_output_dir", "default_params"):
                cfg[k] = v
        if "url" in fields:
            cfg["url"] = cfg["url"].rstrip("/")
        self.save()
        return cfg

    def delete(self, config_id):
        before = len(self.data["configs"])
        self.data["configs"] = [c for c in self.data["configs"] if c["id"] != config_id]
        if len(self.data["configs"]) == before:
            return False
        if self.data["active_config_id"] == config_id:
            self.data["active_config_id"] = self.data["configs"][0]["id"] if self.data["configs"] else ""
        self.save()
        return True

    def set_active(self, config_id):
        if not self.get(config_id):
            return False
        self.data["active_config_id"] = config_id
        self.save()
        return True

    def mark_first_run_done(self):
        self.data["first_run_done"] = True
        self.save()

    @staticmethod
    def test_connection(url, api_key, model=None):
        url = url.rstrip("/")
        headers = {"Authorization": f"Bearer {api_key}"}
        # Try /models first
        try:
            resp = requests.get(f"{url}/models", headers=headers, timeout=10)
            if resp.status_code == 200:
                return True, "Connected successfully (via /models)"
            # 401 = bad key; other errors = endpoint might not exist but API is reachable
            if resp.status_code == 401:
                return False, "Invalid API Key / API Key 无效"
            # For other errors, try a minimal image generation request
        except requests.RequestException:
            pass
        # Fallback: try image generation endpoint with a minimal request
        try:
            payload = {
                "model": model or "gpt-image-2",
                "prompt": "test",
                "n": 1,
                "size": "auto",
                "quality": "low",
            }
            resp = requests.post(
                f"{url}/images/generations",
                json=payload,
                headers=headers,
                timeout=30,
            )
            if resp.status_code == 200:
                return True, "Connected successfully (via /images/generations)"
            if resp.status_code == 401:
                return False, "Invalid API Key / API Key 无效"
            # Any non-401 response means the endpoint is reachable
            return True, f"API reachable (HTTP {resp.status_code}), key may be valid"
        except requests.Timeout:
            return False, "Connection timed out / 连接超时"
        except requests.RequestException as e:
            return False, str(e)
