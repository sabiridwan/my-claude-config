"""Detector adapters. supervision is not a model — this is where the model plugs in.

Every adapter returns sv.Detections so the rest of the pipeline never knows which model ran.
"""

from __future__ import annotations

from typing import Any, Protocol

import numpy as np
import supervision as sv


class Detector(Protocol):
    def __call__(self, frame: np.ndarray) -> sv.Detections: ...


class UltralyticsDetector:
    def __init__(self, weights: str = "yolov8n.pt", device: str = "cpu",
                 confidence: float = 0.35, iou: float = 0.7) -> None:
        from ultralytics import YOLO

        self.model = YOLO(weights)
        self.device, self.confidence, self.iou = device, confidence, iou

    def __call__(self, frame: np.ndarray) -> sv.Detections:
        result = self.model(frame, verbose=False, conf=self.confidence, device=self.device)[0]
        return sv.Detections.from_ultralytics(result).with_nms(threshold=self.iou)


class InferenceDetector:
    """Roboflow `inference` — RF-DETR and any model trained in Roboflow (e.g. the custom
    `tray` model for recipe 6). Runs locally; api_key only needed for private weights."""

    def __init__(self, model_id: str = "rfdetr-medium", api_key: str | None = None,
                 confidence: float = 0.35) -> None:
        from inference import get_model

        self.model = get_model(model_id=model_id, api_key=api_key)
        self.confidence = confidence

    def __call__(self, frame: np.ndarray) -> sv.Detections:
        result = self.model.infer(frame, confidence=self.confidence)[0]
        return sv.Detections.from_inference(result)


class StubDetector:
    """Returns whatever it is fed. For unit-testing the analytics/rules layer without a GPU."""

    def __init__(self, scripted: list[sv.Detections] | None = None) -> None:
        self.scripted = scripted or []
        self.index = 0

    def __call__(self, frame: np.ndarray) -> sv.Detections:
        if self.index >= len(self.scripted):
            return sv.Detections.empty()
        detections = self.scripted[self.index]
        self.index += 1
        return detections


def build_detector(cfg: dict[str, Any]) -> Detector:
    kind = cfg.get("kind", "inference")
    options = {k: v for k, v in cfg.items() if k != "kind"}
    if kind == "ultralytics":
        return UltralyticsDetector(**options)
    if kind == "inference":
        return InferenceDetector(**options)
    if kind == "stub":
        return StubDetector()
    raise ValueError(f"unknown detector kind: {kind}")


def build_tracker(cfg: dict[str, Any] | None = None):
    """`sv.ByteTrack` is removed in supervision 0.31 — use the `trackers` package.
    Falls back to sv.ByteTrack only if `trackers` is not installed."""
    cfg = cfg or {}
    kind = cfg.get("kind", "bytetrack")
    options = {k: v for k, v in cfg.items() if k != "kind"}
    try:
        import trackers as tr

        mapping = {
            "sort": "SORTTracker",
            "bytetrack": "ByteTrackTracker",
            "ocsort": "OCSORTTracker",
            "botsort": "BoTSORTTracker",     # camera-motion compensation: shaky/PTZ cameras
            "cbiou": "CBIoUTracker",
        }
        tracker = getattr(tr, mapping[kind])(**options)
        return _TrackerAdapter(tracker.update)
    except ImportError:
        legacy = sv.ByteTrack(**options)
        return _TrackerAdapter(legacy.update_with_detections)


class _TrackerAdapter:
    """`trackers` renamed update_with_detections() -> update(). One call site either way."""

    def __init__(self, update_fn) -> None:
        self._update = update_fn

    def update(self, detections: sv.Detections) -> sv.Detections:
        return self._update(detections)
