---
name: zync-supervision
description: Use when building, deploying, tuning or debugging CCTV / camera video analytics for a ZyncGold gold-and-jewellery shop with the Roboflow supervision library — RTSP feeds, footfall and door counting, showcase dwell time, queue and wait time, heatmaps, zone occupancy, tray-out and unattended-counter alerts, strongroom two-person rule, after-hours intrusion, helmet-in-store alerts, staff coverage, or piping any of those events into zyncg-server. Trigger on "supervision", "sv.Detections", "ByteTrack", "PolygonZone", "LineZone", "RTSP", "NVR", "CCTV analytics", "people counting", "dwell time", "heatmap", "footfall", "camera analytics", "video analytics", "YOLO/RF-DETR on our cameras", or any request to turn shop camera feeds into numbers, alerts or ERP data.
---

# zync-supervision — CCTV analytics for a gold shop

Turn shop camera feeds into two things the business can act on: **numbers that join to ERP
data** (footfall, dwell, queue, conversion) and **alerts that fire while there is still time
to react** (tray out unattended, strongroom alone, helmet at door, after-hours motion).

`supervision` is **not a model**. It is the post-processing layer: detections in, tracking,
zones, lines, timers, annotators, sinks out. You still bring a detector (RF-DETR, YOLO, or a
Roboflow-hosted model) and the deployment box.

## Pipeline shape — every recipe is this same spine

```
RTSP substream → detector → sv.Detections → tracker (tracker_id)
    → zones / lines / timers   (PolygonZone, LineZone, ClockBasedTimer)
    → rules engine             (thresholds + debounce + business hours)
    → sinks                    (CSV/JSON local, HTTP → zyncg-server, clip grab, alert)
```

If a step is missing, the output is noise. Specifically: **no tracker_id → no dwell, no line
counting, no de-duplicated alerts.** Every metric below depends on stable IDs.

## Workflow

1. **Ask what decision the number changes.** "Footfall" is not a requirement. "Do I keep the
   3rd counter staffed after 6pm" is. Pick the recipe from `references/gold-shop-recipes.md`
   that answers it. One camera, one question, first deployment.
2. **Confirm the camera can carry it.** Read `references/deployment.md` before promising
   anything — overhead vs corner mounting decides whether dwell time is even measurable.
3. **Pull a real clip** from the NVR (10–20 min, peak hour). Never tune on a demo video.
4. **Draw zones on a frame from that clip** — `assets/edge/draw_zones.py`, saves JSON.
5. **Run the pipeline on the clip offline**, annotated output on. Watch it. Count by hand
   against it for 5 minutes. If hand count and machine count disagree by >10%, fix before
   going live.
6. **Only then point it at RTSP** and enable sinks.
7. **Wire the ERP side** per `references/erp-integration.md` — new `vision` module in
   zyncg-server, zync-nestjs standard, device API key, multi-tenant `companyId`/`branchId`.
   Hand actual module scaffolding to the `zync-be-standard` skill.
8. **Verify with the business, not the logs.** Footfall vs invoice count for the same hour.
   If conversion comes out at 300%, the line is in the wrong place.

## Version reality (verified against supervision 0.30.0)

| Fact | Consequence |
|---|---|
| Python ≥ 3.10 | Edge box needs 3.10+; 3.14 is fine |
| `pip install supervision` pulls **no** model and **no** opencv | install `opencv-python-headless` + detector separately |
| `sv.ByteTrack` deprecated in 0.28, **removed in 0.31** | use `pip install trackers` → `from trackers import ByteTrackTracker`; method renamed `update_with_detections()` → `update()` |
| `sv.LineZone` requires `tracker_id` | tracker must run before the line |
| `PolygonZone` default anchor is `BOTTOM_CENTER` | overhead cameras must pass `triggering_anchors=(sv.Position.CENTER,)` |
| No built-in dwell timer in `sv` | copy `FPSBasedTimer` / `ClockBasedTimer` (in `assets/edge/zync_vision/timers.py`) |
| `sv.CSVSink` / `sv.JSONSink` exist | use for local buffer; never make the ERP the only sink |

Full API surface: `references/api-cheatsheet.md`.

## Gold-shop recipe index

Detail, zone geometry and thresholds for each in `references/gold-shop-recipes.md`.

| # | Recipe | Answers |
|---|---|---|
| 1 | Door line count (in/out) | footfall, and **walk-in → invoice conversion** joined to ERP |
| 2 | Showcase dwell time per counter | which counter earns its floor space |
| 3 | Counter → till funnel | which counters generate bills vs browsing |
| 4 | Queue length + wait at billing/cashier | staffing, SLA alert |
| 5 | Staff coverage per counter | unmanned counter during trading hours |
| 6 | **Tray-out count / unattended tray** | shrinkage control — trays out with no staff in zone |
| 7 | **Strongroom two-person rule** | dual control on the safe |
| 8 | After-hours intrusion | instant alert + clip |
| 9 | **Helmet / full-face at entrance** | grab-and-run precursor |
| 10 | Loitering / casing outside entrance | pre-incident warning |
| 11 | Old-gold weighing clip capture | dispute evidence, auto-linked to the purchase voucher |
| 12 | Showcase heatmap | merchandising layout |
| 13 | Workshop / karigar door | material movement without an open job order |

Start with 1, 2, 6, 8. They are the cheapest to get right and cover both the money question
and the loss question.

## Non-negotiables

- **Substream for analytics, main stream for clips.** 640×480 @ 10–15 fps is enough for
  people; running analytics on 4K main streams is why edge boxes die.
- **Debounce every alert.** Raw per-frame conditions fire hundreds of times. Rules need
  `min_duration` + `cooldown`, both in `assets/edge/zync_vision/rules.py`.
- **Local buffer first, ERP second.** Shop internet drops. Events queue on disk and replay.
- **Never treat a detection as proof.** A vision event is a *signal for a human to check* —
  it does not post journal entries, does not block a transaction, does not accuse staff.
- **Faces are personal data.** Malaysia PDPA / Nigeria NDPR. Store counts, not identities;
  blur faces (`sv.BlurAnnotator`) in any clip retained beyond incident review; set retention.
  No face recognition or staff-productivity scoring without explicit sign-off.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Line drawn across the doorway plane | one walk-in counts 3–4 times as person hovers | move line inside, past the mat; raise `minimum_crossing_threshold` |
| No tracker | dwell time is 0, counts explode | tracker before zone/line, always |
| `BOTTOM_CENTER` anchor on overhead cam | people "in zone" while standing outside it | `triggering_anchors=(sv.Position.CENTER,)` |
| Counting all classes | shelves, bags, reflections counted as customers | filter `class_id` to person before tracking |
| Staff counted as customers | footfall inflated ~30% | staff-zone exclusion or uniform/badge class — recipe 5 |
| Tuning on a clean demo clip | works in demo, 40% off in the shop | always tune on the shop's own peak-hour footage |
| Alerting on every frame | 900 Telegram messages, everyone mutes it | debounce + cooldown |

## Red flags — stop

- About to promise "AI detects theft" → detect **conditions** (tray out + nobody there), never intent.
- About to point it at a 4K main stream → substream.
- About to skip the hand-count check → the number will be wrong and someone will make a staffing decision on it.
- About to store faces/identity → stop, that is a different (legal) conversation.

## References

| File | Read when |
|---|---|
| `references/api-cheatsheet.md` | writing supervision code — verified 0.30 API + signatures |
| `references/gold-shop-recipes.md` | choosing/implementing a recipe — geometry, thresholds, rules |
| `references/deployment.md` | camera, mounting, hardware, model choice, RTSP, sizing |
| `references/erp-integration.md` | pushing events to zyncg-server, event schema, ERP joins |
| `assets/edge/` | starter edge agent — config, zones tool, pipeline, rules, sinks |
