"""Frame sources. RTSP with reconnect, or a recorded clip for tuning."""

from __future__ import annotations

import logging
import time
from collections import deque
from collections.abc import Generator

import cv2
import numpy as np

log = logging.getLogger(__name__)


def rtsp_frames(
    url: str, reconnect_delay: float = 5.0, max_delay: float = 60.0
) -> Generator[np.ndarray, None, None]:
    """cv2.VideoCapture returns ret=False forever after a stall — reopen with backoff.

    Always point this at the camera's SUBSTREAM (640x480 @ 10-15fps), never the main stream.
    """
    delay = reconnect_delay
    while True:
        capture = cv2.VideoCapture(url)
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)   # analytics wants the newest frame, not a queue
        if not capture.isOpened():
            log.warning("cannot open stream, retrying in %.0fs", delay)
            time.sleep(delay)
            delay = min(delay * 2, max_delay)
            continue

        delay = reconnect_delay
        try:
            while True:
                ret, frame = capture.read()
                if not ret:
                    log.warning("stream stalled, reconnecting")
                    break
                yield frame
        finally:
            capture.release()
        time.sleep(reconnect_delay)


def video_frames(path: str) -> Generator[np.ndarray, None, None]:
    """Recorded clip — use this for tuning. Never tune on a demo video, use the shop's own."""
    capture = cv2.VideoCapture(path)
    try:
        while True:
            ret, frame = capture.read()
            if not ret:
                return
            yield frame
    finally:
        capture.release()


class ClipBuffer:
    """Rolling frame ring so a clip exists at the moment an event fires (recipes 8, 11).

    seconds * fps frames in RAM: 300s * 10fps * 640*480*3 bytes ~= 2.6 GB — size it, or
    write to a short-lived mp4 segment on disk instead for long windows.
    """

    def __init__(self, seconds: float = 60.0, fps: float = 10.0) -> None:
        self.frames: deque[tuple[float, np.ndarray]] = deque(maxlen=int(seconds * fps))

    def push(self, frame: np.ndarray) -> None:
        self.frames.append((time.time(), frame))

    def cut(self, path: str, since: float, until: float | None = None, fps: float = 10.0) -> str | None:
        selected = [f for ts, f in self.frames if ts >= since and (until is None or ts <= until)]
        if not selected:
            return None
        height, width = selected[0].shape[:2]
        writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
        for frame in selected:
            writer.write(frame)
        writer.release()
        return path
