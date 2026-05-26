"""History management for generated images."""

import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path


class HistoryManager:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.data_dir / "history.json"
        self.data = None
        self.load()

    def load(self):
        if self.history_file.exists():
            try:
                self.data = json.loads(self.history_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self.data = {"version": 1, "images": []}
        else:
            self.data = {"version": 1, "images": []}

    def save(self):
        tmp = self.history_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(str(tmp), str(self.history_file))

    def add(self, task, config):
        entry = {
            "id": task["id"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prompt": task["prompt"],
            "mode": task["mode"],
            "params": task["params"],
            "config_id": task["config_id"],
            "config_name": config.get("name", ""),
            "files": task["result_files"],
            "reference_images": [img.get("filename", "") for img in task.get("reference_images", [])],
            "custom_filename": task.get("custom_filename", ""),
        }
        self.data["images"].insert(0, entry)
        self.save()

    def get_all(self, query=None):
        images = self.data["images"]
        if query:
            q = query.lower()
            images = [e for e in images if q in (e.get("prompt", "").lower())]
        return images

    def get(self, entry_id):
        for e in self.data["images"]:
            if e["id"] == entry_id:
                return e
        return None

    def delete(self, entry_id):
        before = len(self.data["images"])
        self.data["images"] = [e for e in self.data["images"] if e["id"] != entry_id]
        if len(self.data["images"]) == before:
            return False
        img_dir = self.data_dir / entry_id
        if img_dir.is_dir():
            shutil.rmtree(img_dir)
        self.save()
        return True

    def get_image_path(self, entry_id, filename):
        fpath = self.data_dir / entry_id / filename
        if fpath.is_file():
            return fpath
        return None
