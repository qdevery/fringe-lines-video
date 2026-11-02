#!/usr/bin/env python3
"""Track the main face in a video so graphics can frame it (round PiP, cards, split layouts).

  python pipeline/face_track.py <video.mp4> <out.json> [--step 0.2]

Output: [{"ms": 0, "cx": .5, "cy": .33, "s": .19}, ...] normalised to the frame (cx, cy = face-box centre,
s = face-box height / frame height). Gaps are filled from neighbours; samples are median-smoothed but never
across a camera cut (a jump of more than 12% of the frame), so the framing snaps on cuts instead of drifting.
Uses OpenCV's YuNet detector (model cached in ~/.cache/fringe-lines-video/models/yunet.onnx; setup.sh fetches it).
"""
import json, os, subprocess, sys
import cv2
import numpy as np

MODEL = os.path.expanduser("~/.cache/fringe-lines-video/models/yunet.onnx")
MODEL_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
CUT = 0.12


def track(path, step=0.2):
    if not os.path.exists(MODEL):
        os.makedirs(os.path.dirname(MODEL), exist_ok=True)
        subprocess.run(["curl", "-sfL", "-o", MODEL, MODEL_URL], check=True)
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    scale = 480 / max(W, H)
    w, h = int(W * scale), int(H * scale)
    det = cv2.FaceDetectorYN.create(MODEL, "", (w, h), 0.6, 0.3, 5000)
    every = max(1, round(step * fps))
    raw, i = [], 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        if i % every == 0:
            _, frame = cap.retrieve()
            _, faces = det.detect(cv2.resize(frame, (w, h)))
            hit = None
            if faces is not None and len(faces):
                # prefer big, confident, central faces (the active speaker's camera)
                best = max(faces, key=lambda f: f[2] * f[3] * f[14] * (1.2 - abs((f[0] + f[2] / 2) / w - 0.5)))
                x, y, bw, bh = best[:4]
                hit = ((x + bw / 2) / w, (y + bh / 2) / h, bh / h)
            raw.append((round(i / fps * 1000), hit))
        i += 1
    cap.release()
    return raw


def clean(raw):
    # fill gaps with the nearest detection
    known = [k for k, (_, v) in enumerate(raw) if v]
    if not known:
        return [{"ms": m, "cx": 0.5, "cy": 0.35, "s": 0.2} for m, _ in raw]
    vals = []
    for k, (m, v) in enumerate(raw):
        if v is None:
            v = raw[min(known, key=lambda j: abs(j - k))][1]
        vals.append([m, *v])
    a = np.array(vals, dtype=float)
    # split into shots at jumps, median-smooth each
    out, start = [], 0
    for k in range(1, len(a) + 1):
        if k == len(a) or np.hypot(a[k, 1] - a[k - 1, 1], a[k, 2] - a[k - 1, 2]) > CUT:
            seg = a[start:k].copy()
            for c in (1, 2, 3):
                col = seg[:, c].copy()
                for j in range(len(seg)):
                    seg[j, c] = np.median(col[max(0, j - 3): j + 4])
            for j, r in enumerate(seg):
                out.append({"ms": int(r[0]), "cx": round(r[1], 4), "cy": round(r[2], 4), "s": round(r[3], 4), **({"cut": True} if j == 0 and start else {})})
            start = k
    return out


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    step = float(sys.argv[sys.argv.index("--step") + 1]) if "--step" in sys.argv else 0.2
    data = clean(track(src, step))
    json.dump(data, open(dst, "w"))
    print(f"{len(data)} samples, {sum(1 for d in data if d.get('cut'))} cuts -> {dst}")
