#!/usr/bin/env python3
"""Run one camera pipeline.

    python run.py --config config.yaml                 # live RTSP, sinks on
    python run.py --config config.yaml --annotate      # + preview window (tuning)
    python run.py --config config.yaml --dry-run       # local buffer only, no ERP

One process per camera. A crash on cam-03 must not stop cam-01 — supervise with systemd.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

import yaml

from zync_vision.pipeline import CameraPipeline
from zync_vision.sinks import ErpSink, EventBuffer
from zync_vision.sources import rtsp_frames, video_frames

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("zync-vision")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--annotate", action="store_true", help="show annotated preview")
    parser.add_argument("--dry-run", action="store_true", help="buffer locally, never POST")
    args = parser.parse_args()

    with open(args.config) as handle:
        config = yaml.safe_load(handle)

    erp_cfg = config.get("erp", {})
    buffer = EventBuffer(erp_cfg.get("buffer_path", "./data/events.jsonl"))

    erp = None
    if not args.dry_run and erp_cfg.get("base_url"):
        device_key = os.environ.get(erp_cfg.get("device_key_env", "ZYNC_VISION_DEVICE_KEY"), "")
        if not device_key:
            log.error("device key env var is empty — refusing to start without it")
            return 2
        erp = ErpSink(erp_cfg["base_url"], device_key, buffer)
        # Zones/hours/thresholds are ERP config: a manager edits them in the admin app.
        remote = erp.fetch_config()
        if remote:
            config.update(remote)
        erp.start()

    pipeline = CameraPipeline(config, buffer=buffer, erp=erp, annotate=args.annotate)

    source = config.get("source", {})
    frames = (
        video_frames(source["path"]) if source.get("kind") == "video"
        else rtsp_frames(source["url"])
    )

    if args.annotate:
        import cv2

        try:
            for frame in frames:
                annotated, events = pipeline.process_frame(frame)
                for event in events:
                    log.info("event %s %s", event.type, event.zone_key or "")
                    buffer.append(event)
                cv2.imshow(pipeline.camera_id, annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
        finally:
            cv2.destroyAllWindows()
    else:
        pipeline.run(frames)

    if erp:
        erp.flush_once()
        erp.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
