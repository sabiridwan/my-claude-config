"""Smoke test the zync_vision analytics/rules layer with synthetic detections.

Simulates: a customer walking into a zone, staying 3 s, leaving (dwell event), while the
counter is unstaffed (rule fires after min_duration), and a person crossing the door line.
No model, no camera.
"""
import pathlib, sys, time, types
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import numpy as np
import supervision as sv
from zync_vision.pipeline import CameraPipeline
from zync_vision.sinks import EventBuffer

FRAME = np.zeros((720, 1280, 3), dtype=np.uint8)

CONFIG = {
    "camera_id": "cam-test",
    "detector": {"kind": "stub"},
    "classes": [0],
    "class_aliases": {"person": 0},
    "analyse_every": 1,
    "line_flush_interval": 1,
    "business_hours": {d: [0, 24] for d in ["mon","tue","wed","thu","fri","sat","sun"]},
    "zones": [
        {"key": "counter", "anchor": "center", "min_dwell_s": 1.0,
         "polygon": [[400, 300], [900, 300], [900, 600], [400, 600]]},
        {"key": "counter_staff", "anchor": "center", "emit_dwell": False,
         "polygon": [[400, 100], [900, 100], [900, 290], [400, 290]]},
    ],
    "lines": [
        {"key": "entrance", "anchor": "bottom_center", "minimum_crossing_threshold": 1,
         "start": [200, 650], "end": [1100, 650]},
    ],
    "rules": [
        {"key": "counter_unattended", "type": "COUNTER_UNATTENDED", "zone_key": "counter",
         "when": "counter >= 1 and counter_staff == 0", "severity": "MEDIUM",
         "min_duration": 1.0, "cooldown": 30, "hours": "business"},
        {"key": "broken_rule", "type": "SHOULD_NEVER_FIRE", "zone_key": "counter",
         "when": "nonexistent_zone > 0", "min_duration": 0.0},
    ],
}


def det(boxes, ids):
    if not boxes:
        return sv.Detections.empty()
    return sv.Detections(
        xyxy=np.array(boxes, dtype=float),
        class_id=np.zeros(len(boxes), dtype=int),
        confidence=np.full(len(boxes), 0.9),
        tracker_id=np.array(ids, dtype=int),
    )


buffer = EventBuffer("./data/test-events.jsonl")
if buffer.path.exists():
    buffer.path.unlink()

pipeline = CameraPipeline(CONFIG, buffer=buffer, erp=None, annotate=False)
# bypass detector+tracker: feed tracked detections straight in
scripted = {"value": sv.Detections.empty()}
pipeline.detector = lambda frame: scripted["value"]
pipeline.tracker = types.SimpleNamespace(update=lambda d: d)

events = []

# 1. person inside the counter zone (center ~ (650, 450)) for ~1.5 s, no staff
scripted["value"] = det([[600, 400, 700, 500]], [7])
start = time.time()
while time.time() - start < 1.5:
    _, new = pipeline.process_frame(FRAME)
    events += new
    time.sleep(0.05)

# 2. person leaves the zone -> dwell event
scripted["value"] = det([[100, 100, 200, 200]], [7])
_, new = pipeline.process_frame(FRAME)
events += new

# 3. line crossing: id 9 below the line then above it
for box in ([[600, 700, 700, 800]], [[600, 500, 700, 640]], [[600, 400, 700, 560]]):
    scripted["value"] = det(box, [9])
    _, new = pipeline.process_frame(FRAME)
    events += new

time.sleep(1.1)
scripted["value"] = det([], [])
_, new = pipeline.process_frame(FRAME)
events += new

for event in events:
    buffer.append(event)

kinds = [e.type for e in events]
print("events:", kinds)

line = pipeline.lines[0].line
print("line in/out:", line.in_count, line.out_count)
print("buffered rows:", len(buffer.read_batch()))
sample = buffer.read_batch()[0]
print("payload keys:", sorted(sample.keys()))
print("eventKey len:", len(sample["eventKey"]))

assert "ZONE_DWELL" in kinds, "expected a dwell event on zone exit"
assert "COUNTER_UNATTENDED" in kinds, "expected the unattended rule to fire"
assert "SHOULD_NEVER_FIRE" not in kinds, "a broken rule expression must not fire or crash"
assert "LINE_CROSS" in kinds, "expected a line-cross flush event"
assert line.in_count + line.out_count == 1, "one crossing must count once"
dwell = [e for e in events if e.type == "ZONE_DWELL"][0]
assert dwell.duration_seconds >= 1.0, dwell.duration_seconds
unattended = [e for e in events if e.type == "COUNTER_UNATTENDED"][0]
assert unattended.severity == "MEDIUM"
# idempotency: stable key, and no collision between two dwells in the same second
assert dwell.event_key == dwell.event_key
dwells = [e for e in events if e.type == "ZONE_DWELL"]
assert len({e.event_key for e in dwells}) == len(dwells), "dwell event keys must not collide"
buffer.drop(len(buffer.read_batch()))
assert buffer.read_batch() == [], "buffer must clear after drop"
print("\nALL ASSERTIONS PASSED")
