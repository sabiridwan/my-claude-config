"""Zones, lines and dwell — the measurement layer.

Everything here needs `detections.tracker_id`. Run the tracker first.
"""

from __future__ import annotations

import numpy as np
import supervision as sv

from .events import VisionEvent, utc_now
from .timers import ClockBasedTimer, FPSBasedTimer

ANCHORS = {
    "center": sv.Position.CENTER,
    "bottom_center": sv.Position.BOTTOM_CENTER,
    "top_center": sv.Position.TOP_CENTER,
}


class ZoneMonitor:
    """One polygon zone: occupancy, per-class counts, dwell per tracker_id.

    Emits ZONE_DWELL when a tracker leaves the zone having stayed >= min_dwell_s.
    """

    def __init__(
        self,
        key: str,
        polygon: np.ndarray,
        camera_id: str,
        anchor: str = "center",
        min_dwell_s: float = 5.0,
        fps: float | None = None,
        emit_dwell: bool = True,
    ) -> None:
        self.key = key
        self.camera_id = camera_id
        self.min_dwell_s = min_dwell_s
        self.emit_dwell = emit_dwell
        self.zone = sv.PolygonZone(
            polygon=polygon,
            triggering_anchors=(ANCHORS.get(anchor, sv.Position.CENTER),),
        )
        self.timer = FPSBasedTimer(fps=fps) if fps else ClockBasedTimer()
        self._present: set[int] = set()
        self.occupancy: int = 0
        self.class_counts: dict[int, int] = {}

    def update(self, detections: sv.Detections) -> tuple[sv.Detections, list[VisionEvent]]:
        mask = self.zone.trigger(detections)
        inside = detections[mask]
        self.timer.tick(inside)

        self.occupancy = len(inside)
        self.class_counts = {}
        if inside.class_id is not None:
            for class_id in inside.class_id:
                self.class_counts[int(class_id)] = self.class_counts.get(int(class_id), 0) + 1

        now_ids = {int(t) for t in inside.tracker_id} if inside.tracker_id is not None else set()
        events: list[VisionEvent] = []
        if self.emit_dwell:
            for tracker_id in self._present - now_ids:          # left the zone
                duration = self.timer.duration(tracker_id)
                if duration >= self.min_dwell_s:
                    events.append(
                        VisionEvent(
                            type="ZONE_DWELL",
                            camera_id=self.camera_id,
                            zone_key=self.key,
                            occurred_at=utc_now(),
                            ended_at=utc_now(),
                            duration_seconds=round(duration, 1),
                            count=1,
                        )
                    )
        self._present = now_ids
        return inside, events

    def count_of(self, class_id: int) -> int:
        return self.class_counts.get(class_id, 0)


class LineMonitor:
    """Door / doorway counting. Emits LINE_CROSS deltas on flush, not per crossing,
    so a busy hour is a handful of rows instead of thousands."""

    def __init__(
        self,
        key: str,
        start: tuple[int, int],
        end: tuple[int, int],
        camera_id: str,
        anchor: str = "bottom_center",
        minimum_crossing_threshold: int = 2,
    ) -> None:
        self.key = key
        self.camera_id = camera_id
        self.line = sv.LineZone(
            start=sv.Point(*start),
            end=sv.Point(*end),
            triggering_anchors=(ANCHORS.get(anchor, sv.Position.BOTTOM_CENTER),),
            minimum_crossing_threshold=minimum_crossing_threshold,
        )
        self._flushed_in = 0
        self._flushed_out = 0

    def update(self, detections: sv.Detections) -> None:
        if detections.tracker_id is None:
            raise ValueError("LineZone needs tracker_id — run the tracker before the line")
        self.line.trigger(detections)

    def flush(self) -> VisionEvent | None:
        delta_in = self.line.in_count - self._flushed_in
        delta_out = self.line.out_count - self._flushed_out
        if delta_in == 0 and delta_out == 0:
            return None
        self._flushed_in, self._flushed_out = self.line.in_count, self.line.out_count
        return VisionEvent(
            type="LINE_CROSS",
            camera_id=self.camera_id,
            zone_key=self.key,
            count=delta_in,
            meta={"in": delta_in, "out": delta_out,
                  "cumulativeIn": self.line.in_count, "cumulativeOut": self.line.out_count},
        )
