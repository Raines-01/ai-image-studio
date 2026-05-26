"""History management for generated images."""

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


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
            "result_dir": task.get("result_dir", ""),
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
        entry = self.get(entry_id)
        if not entry:
            return False
        self.data["images"] = [e for e in self.data["images"] if e["id"] != entry_id]
        # Try to delete from result_dir if it's under our data dir
        img_dir = self.data_dir / entry_id
        if img_dir.is_dir():
            shutil.rmtree(img_dir)
        self.save()
        return True

    def delete_all(self):
        # Delete all image files under data dir
        for entry in self.data["images"]:
            img_dir = self.data_dir / entry["id"]
            if img_dir.is_dir():
                shutil.rmtree(img_dir)
        self.data["images"] = []
        self.save()
        return True

    def delete_image(self, entry_id, filename):
        entry = self.get(entry_id)
        if not entry:
            return False
        # Delete the file
        fpath = self.get_image_path(entry_id, filename)
        if fpath and fpath.is_file():
            os.remove(fpath)
        # Remove from entry's files list
        if filename in entry.get("files", []):
            entry["files"].remove(filename)
        # If no files left, remove the entire entry
        if not entry.get("files"):
            self.data["images"] = [e for e in self.data["images"] if e["id"] != entry_id]
        self.save()
        return True

    def get_image_path(self, entry_id, filename):
        entry = self.get(entry_id)
        if entry:
            # Try result_dir first (user's output folder)
            rd = entry.get("result_dir", "")
            if rd:
                fpath = Path(rd) / filename
                if fpath.is_file():
                    return fpath
        # Fallback to data dir
        fpath = self.data_dir / entry_id / filename
        if fpath.is_file():
            return fpath
        return None

    def list_directory(self, dir_path):
        """List image files in a directory for browsing."""
        d = Path(dir_path)
        if not d.is_dir():
            return []
        files = []
        for f in sorted(d.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
                files.append({
                    "name": f.name,
                    "path": str(f),
                    "size": f.stat().st_size,
                    "mtime": f.stat().st_mtime,
                })
        return files
