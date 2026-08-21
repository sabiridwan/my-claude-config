# zync-vision edge agent

Starter CCTV analytics agent for a gold shop. One process per camera.
Spine: `frames → detect → track → zones/lines/timers → rules → buffer → zyncg-server`.

```
run.py                 entry point (one camera)
draw_zones.py          click zone polygons on a real frame, save JSON
config.example.yaml    per-camera config: source, zones, lines, rules, hours
zync_vision/
  sources.py           RTSP with reconnect, recorded video, rolling clip buffer
  detectors.py         model adapters (inference / ultralytics / stub) + tracker adapter
  analytics.py         ZoneMonitor (occupancy + dwell), LineMonitor (in/out counting)
  timers.py            FPSBasedTimer / ClockBasedTimer with eviction
  rules.py             condition → min_duration → cooldown → event, business hours
  events.py            VisionEvent + idempotency key
  sinks.py             JSONL spool, ERP batch POST, heartbeat, remote config
tests/test_pipeline.py smoke test — synthetic detections, no model, no camera
```

## Setup

```bash
python -m venv venv && source venv/bin/activate     # Python >= 3.10
pip install -r requirements.txt
pip install inference          # or: pip install ultralytics
```

## Order of work — do not skip

```bash
# 1. pull a real peak-hour clip off the NVR, then draw zones on ITS frames
python draw_zones.py --source footage/peak-hour.mp4 --out zones.json

# 2. copy config, paste polygons under `zones:`, give each a key
cp config.example.yaml config.yaml

# 3. run OFFLINE on the clip, watch it, hand-count 5 minutes against it
python run.py --config config.yaml --annotate --dry-run

# 4. tune min_duration / cooldown until noise < ~1 event/day/camera, then go live
export ZYNC_VISION_DEVICE_KEY=...
python run.py --config config.yaml
```

Hand count and machine count more than ~10% apart → fix before anyone sees a dashboard.

## Verify the logic without a camera

```bash
python tests/test_pipeline.py     # dwell, unattended rule, line count, buffer, idempotency
```

## Production

- `systemd` unit per camera, `Restart=always`, log rotation.
- Events spool to `data/events.jsonl` and replay when the link comes back — the shop's
  internet will drop.
- Heartbeat every 60 s. A camera silently down for a week is the classic failure mode.
- Zones, hours and thresholds come from `GET /vision/config` when the ERP is reachable, so a
  branch manager changes a threshold in the admin app instead of SSHing into the shop box.

## Extending

New recipe = new zone/line in config + a rule expression. Rule context keys are
`<zone_key>`, `<zone_key>_occupancy`, `<zone_key>_<class_alias>` — all valid Python
identifiers, because rules are evaluated as expressions.

Custom classes (`tray`, `helmet`) need a Roboflow-trained model — 200–500 labelled frames
from these cameras. Add the class id to `classes` and name it in `class_aliases`.
