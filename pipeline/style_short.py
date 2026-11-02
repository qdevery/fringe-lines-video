#!/usr/bin/env python3
"""Re-render an already-cut short in the "editorial" ShortV2 style.

Takes work/<ep>/<name>/props.json (from build_short.py) plus a style spec JSON:
  {
    "hook":   {"text": "Microsoft wants *27%* of its staff to quit", "end": 2.8},
    "outro":  {"text": "New episodes *every week*", "hold": 1.6},       # optional end card, extends the video
    "emphasis": ["microsoft", "27%"],                                     # words drawn italic + accent
    "scenes": [ {"at": 0, "mode": "full"},
                {"at": 3.0, "mode": "graphic", "graphic": {"type": "stat", ...}},
                {"at": 6.2, "mode": "card"} ]
  }
and writes out/shorts/<name>-v2.mp4 with whoosh/pop sound effects on every scene change.

  python pipeline/style_short.py --ep 2026-10-30 --name short-02 --spec work/2026-10-30/short-02/style.json
"""
import argparse, json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000


def sfx_whoosh(dur=0.45, seed=1):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    x = rng.standard_normal(n)
    # sweep a one-pole lowpass from dark to bright and back: cheap "whoosh"
    t = np.linspace(0, 1, n)
    cut = 0.02 + 0.25 * np.sin(np.pi * t) ** 2
    y = np.zeros(n); acc = 0.0
    for i in range(n):
        acc += cut[i] * (x[i] - acc); y[i] = acc
    env = np.sin(np.pi * t) ** 1.5
    return y * env / (np.abs(y).max() + 1e-9)


def sfx_pop(dur=0.12):
    n = int(SR * dur); t = np.arange(n) / SR
    f = 900 * np.exp(-t * 18) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ep", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--spec", required=True)
    ap.add_argument("--sfx-db", type=float, default=-20.0)
    a = ap.parse_args()

    d = os.path.join(ROOT, "work", a.ep, a.name)
    props = json.load(open(os.path.join(d, "props.json")))
    spec = json.load(open(a.spec))
    fps = 30
    hold = spec.get("outro", {}).get("hold", 0)
    base_frames = props["durationInFrames"]
    total = base_frames + int(round(hold * fps))

    v2 = {
        "src": props["src"], "durationInFrames": total, "words": props["words"], "shots": props["shots"],
        "emphasis": spec.get("emphasis", []),
        "scenes": [{"startMs": int(s["at"] * 1000), "mode": s["mode"], **({"graphic": s["graphic"]} if "graphic" in s else {})} for s in spec["scenes"]],
    }
    fj = os.path.join(d, "faces.json")
    if not os.path.exists(fj):
        subprocess.run([sys.executable, os.path.join(ROOT, "pipeline/face_track.py"), os.path.join(d, props["src"]), fj], check=True)
    v2["faces"] = json.load(open(fj))
    if "hook" in spec:
        v2["hook"] = {"text": spec["hook"]["text"], "endMs": int(spec["hook"]["end"] * 1000)}
    if "outro" in spec:
        v2["outro"] = {"text": spec["outro"]["text"], "startMs": int(base_frames / fps * 1000)}
    pj = os.path.join(d, "props-v2.json")
    json.dump(v2, open(pj, "w"))

    tmp = os.path.join(d, "render-v2.mp4")
    subprocess.run(["node", os.path.join(ROOT, "pipeline/remotion/render.mjs"), pj, tmp, "ShortV2"], check=True)

    # sound design: whoosh on every scene change, pop when a graphic lands, whoosh into the end card
    dur = total / fps
    fx = np.zeros(int(SR * (dur + 1)))
    def place(sig, t, gain=1.0):
        i = int(t * SR); j = min(len(fx), i + len(sig)); fx[i:j] += sig[: j - i] * gain
    for k, s in enumerate(spec["scenes"][1:]):
        place(sfx_whoosh(seed=k), max(0, s["at"] - 0.12), 0.8)
        if s["mode"] == "graphic":
            place(sfx_pop(), s["at"] + 0.28, 0.6)
    if hold:
        place(sfx_whoosh(0.7, seed=99), base_frames / fps - 0.2, 1.0)
    fx *= 10 ** (a.sfx_db / 20)
    fxp = os.path.join(d, "sfx.wav")
    with wave.open(fxp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(fx, -1, 1) * 32767).astype(np.int16).tobytes())

    out = os.path.join(ROOT, "out/shorts", f"{a.ep}-{a.name}-v2.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-i", fxp, "-filter_complex",
                    f"[0:a]apad[v];[v][1:a]amix=inputs=2:normalize=0:duration=first,atrim=0:{dur:.3f},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], check=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
