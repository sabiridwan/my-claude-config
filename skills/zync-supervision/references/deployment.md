# Deployment — cameras, box, models, streams

## Camera placement decides what is measurable

| Recipe | Mount | Why |
|---|---|---|
| Door counting (1) | corner, 2.5–3 m, looking **into** the shop along the entry path | needs to see a person cross a line inside, not a doorway blob |
| Counter dwell (2,3,5) | overhead or high corner over the counter run | overhead separates customer side from staff side cleanly |
| Queue (4) | high corner facing the queueing floor | full bodies, minimal occlusion |
| Tray (6) | over-counter, tight on the counter top | trays are small; wide angles make them <30 px |
| Strongroom (7) | above the safe approach | tight framing, no walkway |
| Helmet (9), loitering (10) | entrance / frontage, face height | needs head detail |
| Weighing clip (11) | over the scale, 60–80 cm | must read the pan and the hands |

A camera at eye level in a corner, pointed across the shop, is the worst case for everything:
occlusion, perspective, tiny far-field people. If that is all that exists, do recipe 1 and 8
only and be honest that dwell time is not reliable from it.

**Freeze the cameras.** Any physical adjustment invalidates the zone JSON and every trend
line built on it. Re-draw zones after a knock; store zone configs in git per camera.

## Streams

Pull the **substream**, not the main stream.

```
Hikvision : rtsp://user:pass@IP:554/Streaming/Channels/102     # 1=main, 2=sub → 101 / 102
Dahua     : rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=1
Generic   : check the NVR's RTSP page; ONVIF Device Manager will enumerate them
```

Target substream config: **640×480 (or 704×576), 10–15 fps, H.264, CBR**. That is enough for
person detection and cuts decode cost ~10× versus 4 MP main stream. Keep the main stream for
clip extraction only (recipe 11).

Give the analytics box its **own NVR/camera account** with view-only rights, and read from the
NVR rather than the cameras where possible — cameras usually cap concurrent RTSP sessions at
2–4 and you do not want to knock out the guard's monitor.

Handle drops: `cv2.VideoCapture` returns `ret=False` forever after a stall. The starter agent
reconnects with backoff. Alternative: `InferencePipeline` from the `inference` package, which
does reconnect/frame-drop handling for you.

## Box sizing

Rough capacity per stream at 640×640 input, person detection, 10 fps analysis rate (measure
on the actual footage; treat as an order of magnitude, not a spec):

| Box | Realistic streams | Notes |
|---|---|---|
| Mini PC, i5/Ryzen 5, no GPU, YOLOv8n / RF-DETR-nano ONNX | 1–2 | fine for a single-camera pilot |
| Same + Intel iGPU via OpenVINO | 3–4 | best value for a small shop |
| Jetson Orin Nano 8 GB | 4–6 | fanless, purpose-built, good for a shop rack |
| Desktop + RTX 3060/4060 | 8–12 | one box per branch, headroom for custom models |
| Mac mini M-series (dev only) | 2–3 (`device="mps"`) | good for building and tuning, not for 24/7 shop duty |

Analysis rate ≠ stream rate. Detect every 2nd or 3rd frame and let the tracker interpolate —
dwell and counting survive it, and throughput roughly doubles. Do not drop below ~5 analysed
fps or ByteTrack starts losing IDs on people walking briskly.

## Model choice

| Need | Model |
|---|---|
| People (recipes 1–5, 7, 8, 10) | stock COCO class 0 — `rfdetr-medium` via `inference`, or `yolov8n/s` |
| Trays, open showcase (6, 13) | **custom** — 200–500 labelled frames from the shop's own cameras, Roboflow train |
| Helmet / face covering (9) | Roboflow Universe helmet model fine-tuned on the door camera |
| Scale display (11, optional) | `sv.Detections.from_easyocr` on a cropped scale ROI |

Custom classes are the difference between generic retail analytics and something a gold shop
actually cares about. Budget a day of labelling per class; it is the highest-return work in
the project.

## Running it

- One process per camera. A crash on cam-03 must not stop cam-01.
- Supervise with `systemd` (Linux box) or `pm2`. Restart always, log rotate.
- Health beat to the ERP every 60 s per camera: fps, last frame time, dropped-frame count. A
  camera that has been silently down for a week is the classic failure of these systems —
  and the one that gets noticed only when footage is needed.
- Local disk buffer for events (SQLite or JSONL) with replay on reconnect. Shop internet drops.
- Alert transport: push through the existing `notification` module in zyncg-server, not a
  separate Telegram bot, so alerting rules, recipients and audit live in one place.

## Privacy and law — decide before the first camera

- Malaysia **PDPA 2010** / Nigeria **NDPA 2023**: CCTV of identifiable customers is personal
  data. Signage at the entrance stating recording and purpose is the baseline.
- Store **counts and durations**, not identities. `tracker_id` is per-session and must never
  be persisted as an identity or joined across days.
- Blur people in any clip retained past incident review (`sv.BlurAnnotator`).
- Set retention explicitly (e.g. 30 days events, 90 days incident clips) and enforce it with a
  cron job, not a promise.
- No face recognition, no staff productivity scoring, no per-employee "performance" dashboard
  out of camera data without written sign-off — that changes the legal and employment-relations
  picture entirely, and it is not what these recipes are for.
