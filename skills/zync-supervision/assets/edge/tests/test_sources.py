"""Smoke test webcam_frames' fail-fast contract — no real camera needed.

Mocks cv2.VideoCapture so this runs on any machine/CI box, camera or not.
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import cv2
from zync_vision import sources


class FakeCapture:
    def __init__(self, opened: bool, frames: list) -> None:
        self._opened = opened
        self._frames = list(frames)
        self.released = False

    def isOpened(self) -> bool:
        return self._opened

    def read(self):
        if self._frames:
            return True, self._frames.pop(0)
        return False, None

    def release(self) -> None:
        self.released = True


# 1. a webcam that never opens raises immediately, no silent retry loop
original_capture = cv2.VideoCapture
cv2.VideoCapture = lambda *_a, **_k: FakeCapture(opened=False, frames=[])
try:
    raised = False
    try:
        next(sources.webcam_frames(device_index=9))
    except RuntimeError as exc:
        raised = True
        assert "device index 9" in str(exc), exc
    assert raised, "webcam_frames must raise, not retry, when the device won't open"
finally:
    cv2.VideoCapture = original_capture

# 2. a webcam that opens yields frames, then stops cleanly (no exception) when reads fail
fake = FakeCapture(opened=True, frames=["frame-1", "frame-2"])
cv2.VideoCapture = lambda *_a, **_k: fake
try:
    frames = list(sources.webcam_frames(device_index=0))
    assert frames == ["frame-1", "frame-2"], frames
    assert fake.released, "capture must be released when the generator stops"
finally:
    cv2.VideoCapture = original_capture

print("ALL ASSERTIONS PASSED")
