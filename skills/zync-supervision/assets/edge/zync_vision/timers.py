"""Dwell timers. supervision ships none; these mirror examples/time_in_zone with eviction.

FPSBasedTimer  -> recorded video (deterministic, frame count / fps)
ClockBasedTimer -> live RTSP (wall clock, correct when frames are dropped)
"""

from __future__ import annotations

import time

import numpy as np
import supervision as sv


class _BaseTimer:
    """Shared eviction. Long-running streams leak without it: every tracker_id ever seen
    stays in the dict. We drop ids not seen for `evict_after_s`."""

    def __init__(self, evict_after_s: float = 300.0) -> None:
        self.evict_after_s = evict_after_s
        self._last_seen: dict[int, float] = {}

    def _touch(self, tracker_ids: np.ndarray) -> None:
        now = time.monotonic()
        for tracker_id in tracker_ids:
            self._last_seen[int(tracker_id)] = now

    def _evict(self, store: dict) -> None:
        now = time.monotonic()
        stale = [t for t, seen in self._last_seen.items() if now - seen > self.evict_after_s]
        for tracker_id in stale:
            self._last_seen.pop(tracker_id, None)
            store.pop(tracker_id, None)


class FPSBasedTimer(_BaseTimer):
    def __init__(self, fps: float = 30, evict_after_s: float = 300.0) -> None:
        super().__init__(evict_after_s)
        self.fps = fps
        self.frame_id = 0
        self.tracker_id2frame_id: dict[int, int] = {}

    def tick(self, detections: sv.Detections) -> np.ndarray:
        self.frame_id += 1
        times = []
        for tracker_id in detections.tracker_id:
            tracker_id = int(tracker_id)
            self.tracker_id2frame_id.setdefault(tracker_id, self.frame_id)
            times.append((self.frame_id - self.tracker_id2frame_id[tracker_id]) / self.fps)
        self._touch(detections.tracker_id)
        self._evict(self.tracker_id2frame_id)
        return np.array(times, dtype=float)

    def duration(self, tracker_id: int) -> float:
        start = self.tracker_id2frame_id.get(int(tracker_id))
        return 0.0 if start is None else (self.frame_id - start) / self.fps


class ClockBasedTimer(_BaseTimer):
    def __init__(self, evict_after_s: float = 300.0) -> None:
        super().__init__(evict_after_s)
        self.tracker_id2start: dict[int, float] = {}

    def tick(self, detections: sv.Detections) -> np.ndarray:
        now = time.time()
        times = []
        for tracker_id in detections.tracker_id:
            tracker_id = int(tracker_id)
            self.tracker_id2start.setdefault(tracker_id, now)
            times.append(now - self.tracker_id2start[tracker_id])
        self._touch(detections.tracker_id)
        self._evict(self.tracker_id2start)
        return np.array(times, dtype=float)

    def duration(self, tracker_id: int) -> float:
        start = self.tracker_id2start.get(int(tracker_id))
        return 0.0 if start is None else time.time() - start
