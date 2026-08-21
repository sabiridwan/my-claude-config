#!/usr/bin/env python3
"""Draw zone polygons on a real frame from the shop's own camera.

    python draw_zones.py --source footage/peak-hour.mp4 --out zones.json
    python draw_zones.py --source frame.jpg --out zones.json

Click to add points · ENTER closes the polygon · s saves · q quits.
The saved JSON is a list of polygons; paste them under `zones:` in the camera config with a
`key` each. Re-draw after ANY physical camera adjustment — a knocked camera invalidates every
zone and every trend built on it.
"""

from __future__ import annotations

import argparse
import json
import os

import cv2
import numpy as np
import supervision as sv

COLORS = sv.ColorPalette.DEFAULT
THICKNESS = 2
WINDOW = "draw zones — click: point · ENTER: close · s: save · q: quit"

polygons: list[list[tuple[int, int]]] = [[]]
cursor: tuple[int, int] | None = None


def load_frame(source: str) -> np.ndarray:
    if not os.path.exists(source):
        raise SystemExit(f"no such file: {source}")
    image = cv2.imread(source)
    if image is not None:
        return image
    return next(sv.get_video_frames_generator(source_path=source))


def on_mouse(event, x, y, flags, _param) -> None:
    global cursor
    if event == cv2.EVENT_MOUSEMOVE:
        cursor = (x, y)
    elif event == cv2.EVENT_LBUTTONDOWN:
        polygons[-1].append((x, y))


def render(base: np.ndarray) -> np.ndarray:
    canvas = base.copy()
    for index, polygon in enumerate(polygons):
        closed = index < len(polygons) - 1
        color = COLORS.by_idx(index).as_bgr() if closed else (255, 255, 255)
        for i in range(1, len(polygon)):
            cv2.line(canvas, polygon[i - 1], polygon[i], color, THICKNESS)
        if closed and len(polygon) > 2:
            cv2.line(canvas, polygon[-1], polygon[0], color, THICKNESS)
        for point in polygon:
            cv2.circle(canvas, point, 4, color, -1)
    if polygons[-1] and cursor:
        cv2.line(canvas, polygons[-1][-1], cursor, (255, 255, 255), 1)
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="video or image from THIS camera")
    parser.add_argument("--out", default="zones.json")
    args = parser.parse_args()

    frame = load_frame(args.source)
    cv2.namedWindow(WINDOW)
    cv2.setMouseCallback(WINDOW, on_mouse)

    while True:
        cv2.imshow(WINDOW, render(frame))
        key = cv2.waitKey(20) & 0xFF
        if key in (13, 10):                       # ENTER — close current polygon
            if len(polygons[-1]) > 2:
                polygons.append([])
        elif key == ord("s"):
            saved = [p for p in polygons if len(p) > 2]
            with open(args.out, "w") as handle:
                json.dump(saved, handle, indent=2)
            print(f"saved {len(saved)} polygons -> {args.out}")
        elif key in (ord("q"), 27):
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
