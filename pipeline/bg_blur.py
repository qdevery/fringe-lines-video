#!/usr/bin/env python3
"""Zoom-style background blur for a camera file (person stays sharp, room goes soft).

  python pipeline/bg_blur.py <in.mp4> <out.mp4> [--ss 120 --t 10] [--strength 25] [--model multiclass|selfie]

Per frame: MediaPipe selfie segmentation -> person mask, smoothed over time (no flicker) and feathered,
then composite the sharp frame over a heavily blurred copy. Video only (audio is handled by the pipeline).
Decode/encode go through ffmpeg pipes; output uses the same x264 settings as the episode pieces.
"""
import argparse, os, subprocess, time
import cv2
import numpy as np
import mediapipe as mp

MODELS = {
    "multiclass": os.path.expanduser("~/.cache/fringe-lines-video/models/selfie_multiclass.tflite"),
    "selfie": os.path.expanduser("~/.cache/fringe-lines-video/models/selfie_segmenter.tflite"),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("dst")
    ap.add_argument("--ss", type=float, default=0); ap.add_argument("--t", type=float, default=None)
    ap.add_argument("--strength", type=int, default=25, help="blur radius at 1/4 scale")
    ap.add_argument("--model", default="multiclass")
    ap.add_argument("--ema", type=float, default=0.5, help="mask smoothing: weight of the new frame")
    a = ap.parse_args()

    W, H = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                    "-of", "csv=p=0", a.src], capture_output=True, text=True).stdout.strip().split(","))
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(a.ss), *(["-t", str(a.t)] if a.t else []), "-i", a.src,
                            "-an", "-vf", "fps=30", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "30", "-i", "-",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-g", "60", a.dst], stdin=subprocess.PIPE)

    opts = mp.tasks.vision.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=MODELS[a.model]),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, output_confidence_masks=True)
    seg = mp.tasks.vision.ImageSegmenter.create_from_options(opts)

    n, mask_prev, t0 = 0, None, time.time()
    sw, sh = W // 4, H // 4
    k = a.strength | 1
    while True:
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        small = cv2.resize(frame, (640, 360), interpolation=cv2.INTER_AREA)
        res = seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(small)), int(n * 1000 / 30))
        cm = res.confidence_masks
        bgp = cm[0].numpy_view()  # class 0 = background in both models (selfie: single mask = person?)
        person = (1.0 - bgp) if len(cm) > 1 else bgp
        person = person.astype(np.float32)
        mask_prev = person if mask_prev is None else a.ema * person + (1 - a.ema) * mask_prev
        m = np.clip((mask_prev - 0.35) / 0.3, 0, 1)                    # firm up the edge
        m = cv2.GaussianBlur(cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR), (0, 0), 3)[..., None]
        bg = cv2.resize(cv2.GaussianBlur(cv2.resize(frame, (sw, sh), interpolation=cv2.INTER_AREA), (k, k), 0), (W, H), interpolation=cv2.INTER_LINEAR)
        out = (frame.astype(np.float32) * m + bg.astype(np.float32) * (1 - m)).astype(np.uint8)
        enc.stdin.write(out.tobytes())
        n += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    print(f"{n} frames in {time.time() - t0:.1f}s ({n / max(1e-6, time.time() - t0):.1f} fps)")


if __name__ == "__main__":
    main()
