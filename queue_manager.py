"""Background task queue for image generation."""

import threading
import time
import uuid
from pathlib import Path

import api_client


class QueueManager:
    def __init__(self, config_mgr, history_mgr, data_dir):
        self.config_mgr = config_mgr
        self.history_mgr = history_mgr
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.tasks = []
        self.lock = threading.Lock()
        self.worker = threading.Thread(target=self._worker, daemon=True)
        self.worker.start()

    def enqueue(self, prompt, mode, params, reference_images, n, config_id, custom_filename="", output_dir=""):
        task = {
            "id": uuid.uuid4().hex[:12],
            "status": "waiting",
            "prompt": prompt,
            "mode": mode,
            "params": params,
            "reference_images": reference_images,
            "n": n,
            "config_id": config_id,
            "custom_filename": custom_filename,
            "output_dir_override": output_dir,
            "result_files": [],
            "error": None,
            "created_at": time.time(),
            "started_at": None,
            "finished_at": None,
        }
        with self.lock:
            self.tasks.append(task)
        return self._task_view(task)

    def get_all(self):
        with self.lock:
            return [self._task_view(t) for t in self.tasks]

    def get(self, task_id):
        with self.lock:
            for t in self.tasks:
                if t["id"] == task_id:
                    return self._task_view(t)
        return None

    def cancel(self, task_id):
        with self.lock:
            for t in self.tasks:
                if t["id"] == task_id and t["status"] in ("waiting", "generating"):
                    t["cancelled"] = True
                    if t["status"] == "waiting":
                        t["status"] = "failed"
                        t["error"] = "Cancelled by user"
                        t["finished_at"] = time.time()
                    return True
        return False

    def _task_view(self, t):
        return {
            "id": t["id"],
            "status": t["status"],
            "prompt": t["prompt"],
            "mode": t["mode"],
            "params": t["params"],
            "n": t["n"],
            "config_id": t["config_id"],
            "custom_filename": t["custom_filename"],
            "result_files": t["result_files"],
            "result_dir": t.get("result_dir", ""),
            "error": t["error"],
            "created_at": t["created_at"],
            "started_at": t["started_at"],
            "finished_at": t["finished_at"],
        }

    def _worker(self):
        while True:
            task = None
            with self.lock:
                for t in self.tasks:
                    if t["status"] == "waiting":
                        task = t
                        break
            if task is None:
                time.sleep(0.5)
                continue

            task["status"] = "generating"
            task["started_at"] = time.time()

            try:
                config = self.config_mgr.get(task["config_id"])
                if not config:
                    raise api_client.APIError("Config not found")

                if task["mode"] == "image-editing":
                    images = api_client.generate_edit(
                        task["prompt"], task["reference_images"],
                        task["params"], config
                    )
                else:
                    images = api_client.generate_text(
                        task["prompt"], task["params"], config
                    )

                if task.get("cancelled"):
                    task["status"] = "failed"
                    task["error"] = "Cancelled by user"
                    continue

                # Determine output directory
                out_dir = task.get("output_dir_override", "").strip()
                if not out_dir:
                    out_dir = config.get("default_output_dir", "").strip()
                if not out_dir:
                    out_dir = str(self.data_dir)
                out_dir = Path(out_dir)
                out_dir.mkdir(parents=True, exist_ok=True)

                fmt = task["params"].get("output_format", "png")
                ext = f".{fmt}" if fmt else ".png"
                files = self._save_images(task, images, ext, out_dir)
                task["result_files"] = files
                task["result_dir"] = str(out_dir)
                task["status"] = "done"

                self.history_mgr.add(task, config)

            except Exception as e:
                if task.get("cancelled"):
                    task["status"] = "failed"
                    task["error"] = "Cancelled by user"
                else:
                    task["status"] = "failed"
                    task["error"] = str(e)

            task["finished_at"] = time.time()

    def _save_images(self, task, images, ext, out_dir):
        custom = task.get("custom_filename", "").strip()
        files = []
        for i, img_data in enumerate(images):
            if custom and len(images) == 1:
                name = custom if custom.endswith(ext) else custom + ext
            else:
                ts = int(task["created_at"] * 1000)
                name = f"img_{ts}_{i}{ext}" if len(images) > 1 else f"img_{ts}{ext}"
            (out_dir / name).write_bytes(img_data)
            files.append(name)
        return files
