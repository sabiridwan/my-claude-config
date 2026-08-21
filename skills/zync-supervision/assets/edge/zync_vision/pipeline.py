"""The spine: frames -> detect -> track -> zones/lines -> rules -> sinks."""

from __future__ import annotations

import logging
import time
from collections.abc import Iterable
from typing import Any

import numpy as np
import supervision as sv

from .analytics import LineMonitor, ZoneMonitor
from .detectors import build_detector, build_tracker
from .events import VisionEvent
from .rules import RuleEngine
from .sinks import EventBuffer, ErpSink

log = logging.getLogger(__name__)

COLORS = sv.ColorPalette.DEFAULT


class CameraPipeline:
    def __init__(self, config: dict[str, Any], buffer: EventBuffer,
                 erp: ErpSink | None = None, annotate: bool = False) -> None:
        self.config = config
        self.camera_id = config["camera_id"]
        self.buffer = buffer
        self.erp = erp
        self.annotate = annotate

        self.detector = build_detector(config.get("detector", {}))
        self.tracker = build_tracker(config.get("tracker"))
        self.classes: list[int] = config.get("classes", [])
        self.class_aliases: dict[str, int] = config.get("class_aliases", {"person": 0})
        self.analyse_every: int = max(1, int(config.get("analyse_every", 1)))

        fps = config.get("source_fps") if config.get("source", {}).get("kind") == "video" else None
        self.zones = [
            ZoneMonitor(
                key=zone["key"], polygon=np.array(zone["polygon"], np.int32),
                camera_id=self.camera_id, anchor=zone.get("anchor", "center"),
                min_dwell_s=zone.get("min_dwell_s", 5.0),
                emit_dwell=zone.get("emit_dwell", True), fps=fps,
            )
            for zone in config.get("zones", [])
        ]
        self.lines = [
            LineMonitor(
                key=line["key"], start=tuple(line["start"]), end=tuple(line["end"]),
                camera_id=self.camera_id, anchor=line.get("anchor", "bottom_center"),
                minimum_crossing_threshold=line.get("minimum_crossing_threshold", 2),
            )
            for line in config.get("lines", [])
        ]
        self.rules = RuleEngine.from_config(config)

        self.fps_monitor = sv.FPSMonitor()
        self.line_flush_interval = float(config.get("line_flush_interval", 900))
        self._last_line_flush = time.monotonic()
        self._last_heartbeat = 0.0
        self._frame_index = 0
        self._detections = sv.Detections.empty()

        self.box_annotator = sv.BoxAnnotator(color=COLORS)
        self.label_annotator = sv.LabelAnnotator(color=COLORS)

    # ---------------------------------------------------------------- per frame

    def process_frame(self, frame: np.ndarray) -> tuple[np.ndarray, list[VisionEvent]]:
        self._frame_index += 1
        self.fps_monitor.tick()
        events: list[VisionEvent] = []

        # Detect every Nth frame; the tracker carries IDs across the gaps. Roughly doubles
        # throughput. Do not go below ~5 analysed fps or IDs start breaking on brisk walkers.
        if self._frame_index % self.analyse_every == 0:
            detections = self.detector(frame)
            if self.classes and detections.class_id is not None:
                detections = detections[np.isin(detections.class_id, self.classes)]
            self._detections = self.tracker.update(detections)

        detections = self._detections
        context: dict[str, Any] = {"camera_id": self.camera_id, "frame": self._frame_index}

        for zone in self.zones:
            inside, dwell_events = zone.update(detections)
            events.extend(dwell_events)
            # Rule expressions are evaluated as Python, so context keys must be valid
            # identifiers: `counter_bridal`, `counter_bridal_occupancy`, `counter_bridal_tray`.
            context[zone.key] = zone.occupancy
            context[f"{zone.key}_occupancy"] = zone.occupancy
            for alias, class_id in self.class_aliases.items():
                context[f"{zone.key}_{alias}"] = zone.count_of(class_id)

        for line in self.lines:
            line.update(detections)

        events.extend(self.rules.evaluate(context))

        now = time.monotonic()
        if now - self._last_line_flush >= self.line_flush_interval:
            self._last_line_flush = now
            events.extend(e for e in (line.flush() for line in self.lines) if e)

        annotated = self._annotate(frame, detections) if self.annotate else frame
        return annotated, events

    def _annotate(self, frame: np.ndarray, detections: sv.Detections) -> np.ndarray:
        annotated = frame.copy()
        for index, zone in enumerate(self.zones):
            annotated = sv.draw_polygon(
                scene=annotated, polygon=zone.zone.polygon, color=COLORS.by_idx(index)
            )
        for line in self.lines:
            annotated = sv.LineZoneAnnotator().annotate(annotated, line.line)
        annotated = self.box_annotator.annotate(annotated, detections)
        if detections.tracker_id is not None and len(detections):
            labels = [f"#{int(t)}" for t in detections.tracker_id]
            annotated = self.label_annotator.annotate(annotated, detections, labels=labels)
        return sv.draw_text(
            scene=annotated, text=f"{self.fps_monitor.fps:.1f} fps",
            text_anchor=sv.Point(60, 24), background_color=sv.Color.BLACK,
            text_color=sv.Color.WHITE,
        )

    # ------------------------------------------------------------------- driver

    def run(self, frames: Iterable[np.ndarray]) -> None:
        for frame in frames:
            _, events = self.process_frame(frame)
            for event in events:
                log.info("event %s %s", event.type, event.zone_key or "")
                self.buffer.append(event)

            now = time.monotonic()
            if self.erp and now - self._last_heartbeat > 60:
                self._last_heartbeat = now
                self.erp.heartbeat(self.camera_id, self.fps_monitor.fps, dropped=0)

        for event in (line.flush() for line in self.lines):   # don't lose the last counts
            if event:
                self.buffer.append(event)
