"""Sinks: local JSONL buffer first, ERP second. Shop internet drops; events must survive it."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

import requests

from .events import VisionEvent

log = logging.getLogger(__name__)


class EventBuffer:
    """Append-only JSONL spool. Events are removed only after the ERP accepts them."""

    def __init__(self, path: str | Path, max_batch: int = 200) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.max_batch = max_batch
        self._lock = threading.Lock()

    def append(self, event: VisionEvent) -> None:
        with self._lock, self.path.open("a") as handle:
            handle.write(json.dumps(event.to_payload()) + "\n")

    def read_batch(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        with self._lock:
            lines = self.path.read_text().splitlines()
        batch = []
        for line in lines[: self.max_batch]:
            try:
                batch.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return batch

    def drop(self, count: int) -> None:
        with self._lock:
            if not self.path.exists():
                return
            lines = self.path.read_text().splitlines()
            remaining = lines[count:]
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text("\n".join(remaining) + ("\n" if remaining else ""))
            os.replace(tmp, self.path)


class ErpSink:
    """POSTs batches to zyncg-server. Idempotent — the server upserts on eventKey."""

    def __init__(self, base_url: str, device_key: str, buffer: EventBuffer,
                 flush_interval: float = 15.0, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.device_key = device_key
        self.buffer = buffer
        self.flush_interval = flush_interval
        self.timeout = timeout
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        backoff = self.flush_interval
        while not self._stop.is_set():
            sent = self.flush_once()
            backoff = self.flush_interval if sent else min(backoff * 2, 300)
            self._stop.wait(backoff)

    def flush_once(self) -> bool:
        batch = self.buffer.read_batch()
        if not batch:
            return True
        try:
            response = requests.post(
                f"{self.base_url}/vision/events",
                json={"events": batch},
                headers={"x-device-key": self.device_key},
                timeout=self.timeout,
            )
            response.raise_for_status()
        except Exception as exc:                       # offline, 5xx, DNS — keep the spool
            log.warning("vision event flush failed, will retry: %s", exc)
            return False
        self.buffer.drop(len(batch))
        return True

    def heartbeat(self, camera_id: str, fps: float, dropped: int) -> None:
        """A camera silently down for a week is the classic failure of these systems."""
        try:
            requests.post(
                f"{self.base_url}/vision/heartbeat",
                json={"cameraId": camera_id, "fps": round(fps, 2),
                      "lastFrameAt": time.time(), "dropped": dropped},
                headers={"x-device-key": self.device_key},
                timeout=self.timeout,
            )
        except Exception as exc:
            log.debug("heartbeat failed: %s", exc)

    def fetch_config(self) -> dict[str, Any] | None:
        """Zones, hours and thresholds live in the ERP so a manager can change them
        without SSHing into the shop box."""
        try:
            response = requests.get(
                f"{self.base_url}/vision/config",
                headers={"x-device-key": self.device_key},
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            log.warning("config fetch failed, keeping local config: %s", exc)
            return None
