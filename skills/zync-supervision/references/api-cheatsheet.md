# supervision API cheatsheet — verified against 0.30.0

Signatures below were read out of the installed `supervision-0.30.0` wheel, not from memory.
Re-verify with `python -c "import supervision as sv; help(sv.X)"` if the version differs.

## Install

```bash
pip install supervision            # requires Python >= 3.10
pip install opencv-python-headless # NOT a supervision dependency; you need it
pip install trackers               # ByteTrackTracker, replaces deprecated sv.ByteTrack
# one detector:
pip install inference              # Roboflow (rfdetr-*, hosted/local models)
# or
pip install ultralytics            # YOLO
```

`supervision` 0.30 hard deps: `av, defusedxml, matplotlib, numpy, pillow, pydeprecate, pyyaml,
requests, scipy, tqdm`. Extras: `[metrics]` (pandas), `[geotiff]` (rasterio).

## Detections — the universal container

```python
import supervision as sv

detections = sv.Detections.from_inference(result)        # roboflow inference
detections = sv.Detections.from_ultralytics(results)     # YOLO
detections = sv.Detections.from_transformers(...)        # HF
# also: from_yolov5, from_yolo_nas, from_mmdetection, from_detectron2, from_sam, from_sam3,
#       from_paddledet, from_easyocr, from_ncnn, from_tensorflow, from_deepsparse,
#       from_lmm, from_vlm, from_azure_analyze_image
```

Fields: `xyxy`, `mask`, `confidence`, `class_id`, `tracker_id`, `data` (dict of per-detection
arrays, e.g. `data["class_name"]`), `metadata`.

Filtering — boolean-mask indexing, this is the idiom used everywhere:

```python
detections = detections[detections.class_id == 0]              # person only
detections = detections[detections.confidence > 0.4]
detections = detections[np.isin(detections.class_id, [0, 2])]  # multi-class
detections = detections.with_nms(threshold=0.7)
```

## Tracking

`sv.ByteTrack` is **deprecated since 0.28.0, removed in 0.31.0**. Migrate:

```python
# OLD (works in 0.30, gone in 0.31)
tracker = sv.ByteTrack(minimum_matching_threshold=0.8)
detections = tracker.update_with_detections(detections)

# NEW
from trackers import ByteTrackTracker      # also SORTTracker, OCSORTTracker,
tracker = ByteTrackTracker()               # BoTSORTTracker, CBIoUTracker
detections = tracker.update(detections)    # note: update(), not update_with_detections()
```

`sv.ByteTrack.__init__` args (for reference while still on 0.30):
`track_activation_threshold=0.25, lost_track_buffer=30, minimum_matching_threshold=0.8,
frame_rate=30, minimum_consecutive_frames=1`.

Tracker choice for a shop (HOTA on MOT17): SORT 58.4 · ByteTrack 60.1 · OC-SORT 61.9 ·
C-BIoU 63.0 · **BoT-SORT 63.7** (camera-motion compensation — use it if the camera shakes or
is PTZ; otherwise ByteTrack is the cheaper default).

Stabilise jittery boxes: `sv.DetectionsSmoother().update_with_detections(detections)`.

## Zones

```python
zone = sv.PolygonZone(
    polygon=np.array([[x1,y1],[x2,y2],...], np.int32),
    triggering_anchors=(sv.Position.CENTER,),   # default is (Position.BOTTOM_CENTER,)
)
mask = zone.trigger(detections)        # bool array, also updates zone.current_count
in_zone = detections[mask]

annotator = sv.PolygonZoneAnnotator(
    zone=zone, color=sv.Color.WHITE, thickness=2, text_scale=0.5,
    display_in_zone_count=True, opacity=0.0,
)
frame = annotator.annotate(scene=frame, label="Bridal counter")
```

`sv.Position` values include `CENTER`, `TOP_LEFT`, `TOP_CENTER`, `TOP_RIGHT`, `BOTTOM_LEFT`,
`BOTTOM_CENTER`, `BOTTOM_RIGHT`, `CENTER_OF_MASS`.

**Overhead camera → `CENTER`. Corner/eye-level camera → `BOTTOM_CENTER`** (feet on floor).

## Lines (door counting)

```python
line = sv.LineZone(
    start=sv.Point(300, 700), end=sv.Point(1000, 700),
    triggering_anchors=(sv.Position.BOTTOM_CENTER,),
    minimum_crossing_threshold=2,     # frames on the far side before it counts — raise to 2-3
)                                     # to kill doorway loitering double-counts
crossed_in, crossed_out = line.trigger(detections)   # REQUIRES detections.tracker_id
line.in_count, line.out_count                        # cumulative
line.in_count_per_class, line.out_count_per_class    # dict class_id -> count

sv.LineZoneAnnotator(custom_in_text="IN", custom_out_text="OUT").annotate(frame, line)
sv.LineZoneAnnotatorMulticlass()   # when you count staff vs customer separately
```

## Dwell time — not built in, copy this

`supervision` ships no timer class. The official example (`examples/time_in_zone`) defines two;
both are reproduced in `assets/edge/zync_vision/timers.py`:

- `FPSBasedTimer(fps)` — for **recorded video** (frame count ÷ fps). Deterministic.
- `ClockBasedTimer()` — for **live RTSP** (wall clock). Correct when frames are dropped.

```python
timer = ClockBasedTimer()
in_zone = detections[zone.trigger(detections)]
seconds = timer.tick(in_zone)          # np.ndarray, aligned with in_zone.tracker_id
```

Both keep a `tracker_id -> start` dict, so they leak memory on long-running streams unless
you evict stale IDs. The starter agent evicts.

## Annotators (all take `scene=`, `detections=`, return the frame)

`BoxAnnotator, RoundBoxAnnotator, BoxCornerAnnotator, ColorAnnotator, MaskAnnotator,
PolygonAnnotator, EllipseAnnotator, CircleAnnotator, DotAnnotator, TriangleAnnotator,
LabelAnnotator, RichLabelAnnotator, IconAnnotator, TraceAnnotator, HeatMapAnnotator,
BlurAnnotator, PixelateAnnotator, CropAnnotator, HaloAnnotator, PercentageBarAnnotator,
BackgroundOverlayAnnotator, ComparisonAnnotator, OrientedBoxAnnotator`, plus keypoint/vertex
annotators.

Two that matter here:

```python
sv.HeatMapAnnotator(position=sv.Position.BOTTOM_CENTER, opacity=0.4, radius=25)  # recipe 12
sv.BlurAnnotator(kernel_size=25)     # privacy — blur people/faces in retained clips
```

Sizing helpers so text stays readable at any resolution:
`sv.calculate_optimal_line_thickness(resolution_wh=...)`, `sv.calculate_optimal_text_scale(...)`.

## Video I/O

```python
sv.VideoInfo.from_video_path("clip.mp4")            # .width .height .fps .total_frames
sv.get_video_frames_generator(source_path=..., stride=1, start=0, end=None)
sv.process_video(source_path=..., target_path=..., callback=fn)   # fn(frame, index) -> frame
with sv.VideoSink(target_path="out.mp4", video_info=info) as sink: sink.write_frame(frame)
sv.ImageSink(target_dir_path=...)                   # dump frames/clip thumbnails
```

RTSP is **not** handled by `sv.get_video_frames_generator` — use `cv2.VideoCapture(rtsp_url)`
in a generator (see `assets/edge/zync_vision/sources.py`), or `InferencePipeline` from the
`inference` package which handles reconnects, buffering and FPS matching for you.

## Sinks

```python
with sv.CSVSink("events.csv") as sink:
    sink.append(detections, custom_data={"zone": "bridal", "camera": "cam-03"})
with sv.JSONSink("events.json") as sink:
    sink.append(detections, custom_data={...})
```

`custom_data` scalars broadcast to every row; arrays/lists of `len(detections)` are sliced
per detection.

## Small / far objects

```python
slicer = sv.InferenceSlicer(callback=fn, slice_wh=640, overlap_wh=100,
                            overlap_filter=sv.OverlapFilter.NON_MAX_SUPPRESSION,
                            iou_threshold=0.5, thread_workers=1, batch_size=1)
detections = slicer(image)
```

Use for a wide-angle camera where people at the back of the shop are <40 px tall. Costs
several× the inference time — never on a live stream without measuring first.

## Perf monitor

```python
fps_monitor = sv.FPSMonitor(); fps_monitor.tick(); fps_monitor.fps
```

## Sources

- <https://github.com/roboflow/supervision>
- <https://supervision.roboflow.com/latest/detection/tools/polygon_zone/>
- <https://supervision.roboflow.com/latest/detection/tools/line_zone/>
- <https://github.com/roboflow/supervision/tree/develop/examples/time_in_zone>
- <https://trackers.roboflow.com/>
