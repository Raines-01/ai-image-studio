"""Image generation API client (OpenAI compatible)."""

import base64
import json

import requests


class APIError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


def generate_text(prompt, params, config, timeout=300):
    url = f"{config['url']}/images/generations"
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }
    payload = {"model": config["model"], "prompt": prompt}
    for key in ("size", "quality", "output_format", "output_compression", "moderation", "n"):
        val = params.get(key)
        if val is not None and val != "":
            payload[key] = val

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.Timeout:
        raise APIError("Request timed out (300s)")
    except requests.RequestException as e:
        raise APIError(str(e))

    if resp.status_code != 200:
        try:
            err = resp.json()
            msg = err.get("error", {}).get("message", "") if isinstance(err.get("error"), dict) else str(err.get("error", ""))
        except Exception:
            msg = resp.text[:300]
        raise APIError(f"API error {resp.status_code}: {msg}", resp.status_code)

    return _extract_images(resp.json())


def generate_edit(prompt, ref_images, params, config, timeout=300):
    url = f"{config['url']}/images/edits"
    headers = {"Authorization": f"Bearer {config['api_key']}"}

    data = {"model": config["model"], "prompt": prompt}
    for key in ("size", "quality", "output_format", "output_compression", "input_fidelity", "moderation", "n"):
        val = params.get(key)
        if val is not None and val != "":
            data[key] = str(val)

    files = []
    for img in ref_images:
        fname = img.get("filename", "image.png")
        ct = img.get("content_type", "image/png")
        files.append(("image", (fname, img["data"], ct)))

    try:
        resp = requests.post(url, data=data, files=files, headers=headers, timeout=timeout)
    except requests.Timeout:
        raise APIError("Request timed out (300s)")
    except requests.RequestException as e:
        raise APIError(str(e))

    if resp.status_code != 200:
        try:
            err = resp.json()
            msg = err.get("error", {}).get("message", "") if isinstance(err.get("error"), dict) else str(err.get("error", ""))
        except Exception:
            msg = resp.text[:300]
        raise APIError(f"API error {resp.status_code}: {msg}", resp.status_code)

    return _extract_images(resp.json())


def _extract_images(response_data):
    images = response_data.get("data", [])
    if not images:
        raise APIError("No image in API response")

    result = []
    for img in images:
        if "b64_json" in img:
            result.append(base64.b64decode(img["b64_json"]))
        elif "url" in img:
            try:
                r = requests.get(img["url"], timeout=60)
                r.raise_for_status()
                result.append(r.content)
            except requests.RequestException as e:
                raise APIError(f"Failed to download image: {e}")
        else:
            raise APIError("Unknown image format in response")
    return result
