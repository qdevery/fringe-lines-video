#!/usr/bin/env python3
"""Build a "how-to" short: screen share on top (pan/zoom to what's being explained), speaker below.

  python pipeline/build_howto.py --ep 2026-10-30 --spec work/2026-10-30/howto-01/howto.json

Spec:
  {
    "name": "howto-01",
    "ranges": [[262.0, 272.95], [285.6, 348.0]],          # Descript sequence clock, stitched in order
    "replace": {"8": "8 AM"},                               # caption fixes ("" hides the word)
    "title": "How I built an AI *morning briefing*", "kicker": "Fringe Lines · How-to", "title_end": 3.2,
    "focus": [                                              # where the top half looks; box = [x, y, w, h] of the screen, 0..1
      {"at": 0, "box": [0.09, 0.13, 0.83, 0.83]},
      {"on": "outlook", "box": [0.12, 0.35, 0.2, 0.53], "label": "1 · Sources", "mark": [...]},   # "on" = first match after the previous key
    ],
    "screen": "Quinn's screenQuinn's screen-4.mp4"         # optional; default = the screen clip overlapping the ranges
  }
Filler/stutter/pause removal and camera choice are the same as build_short.py. Output: out/shorts/<ep>-<name>.mp4
"""
import argparse, json, os, subprocess, sys
import xml.etree.ElementTree as ET
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_short as bs  # noqa: E402
import style_short as ss  # noqa: E402

ROOT = bs.ROOT
CAM_W, CAM_H = 1280, 720
SCR_W = 1600


def screens_from_xml(xml):
    seq = ET.parse(xml).getroot().find("sequence")
    tb = int(seq.find("rate/timebase").text)
    out = []
    for c in seq.iter("clipitem"):
        n = c.find("name").text
        if "screen" in n.lower() and c.find("enabled").text == "TRUE":
            out.append({"file": n, "start": int(c.find("start").text) / tb, "end": int(c.find("end").text) / tb})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ep", required=True)
    ap.add_argument("--spec", required=True)
    a = ap.parse_args()
    spec = json.load(open(a.spec))
    name = spec["name"]
    raw = next(os.path.join(ROOT, "inbox/raw/descript", d) for d in sorted(os.listdir(os.path.join(ROOT, "inbox/raw/descript")))
               if os.path.isdir(os.path.join(ROOT, "inbox/raw/descript", d)))
    xml = next(os.path.join(raw, f) for f in os.listdir(raw) if f.endswith(".xml"))
    off = bs.xml_offsets(xml)
    work = os.path.join(ROOT, "work", a.ep)
    d = os.path.join(work, name)
    os.makedirs(d, exist_ok=True)

    words = []
    for s in bs.CAMS:
        words += json.load(open(os.path.join(work, f"words-{s.lower()}.json")))["words"]
    words.sort(key=lambda w: w["start"])
    ranges = [tuple(r) for r in spec["ranges"]]
    t0, t1 = min(r[0] for r in ranges), max(r[1] for r in ranges)

    scr = None
    if spec.get("screen"):
        scr = next(s for s in screens_from_xml(xml) if s["file"] == spec["screen"])
    else:
        scr = max(screens_from_xml(xml), key=lambda s: min(t1, s["end"]) - max(t0, s["start"]))
    sdims = bs.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-show_entries",
                    "format=duration", "-of", "csv=p=0", os.path.join(raw, scr["file"])]).split()
    sw, sh = map(int, sdims[0].split(",")); sdur = float(sdims[1])
    out_sw, out_sh = SCR_W, int(SCR_W * sh / sw) // 2 * 2

    # pieces (same editing rules as build_short)
    W, pieces = [], []
    for ra, rb in ranges:
        Wr, keep = bs.plan(words, ra, rb)
        W += [w for w in Wr if w not in W]
        track = bs.speaker_track(Wr, ra, rb)
        for ka, kb in keep:
            for sa, sb, s in track:
                x, y = max(ka, sa), min(kb, sb)
                if y - x > 0.04:
                    pieces.append([x, y, s])
    pieces = [[round(pa * 30) / 30, round(pb * 30) / 30, s] for pa, pb, s in pieces]
    pieces = [p for p in pieces if p[1] - p[0] >= 2 / 30]
    W.sort(key=lambda w: w["start"])

    # 1) sources for the window: full-frame cameras, screen, mixed audio
    pad = 0.5
    w0, dur = t0 - pad, (t1 - t0) + 2 * pad
    for s, (vid, aud, _) in bs.CAMS.items():
        bs.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{w0 - off[vid]:.3f}", "-t", f"{dur:.3f}", "-i", os.path.join(raw, vid), "-an",
                "-vf", f"scale={CAM_W}:{CAM_H}:flags=lanczos,fps=30", "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", os.path.join(d, f"cam-{s}.mp4")])
    bs.run(["ffmpeg", "-y", "-v", "error", "-i", os.path.join(raw, scr["file"]), "-an",
            "-vf", f"fps=30,scale={out_sw}:{out_sh}:flags=lanczos,setsar=1", "-c:v", "libx264", "-crf", "16", "-preset", "veryfast",
            os.path.join(d, "screen-src.mp4")])
    ain = []
    for s, (vid, aud, _) in bs.CAMS.items():
        ain += ["-ss", f"{w0 - off[aud]:.3f}", "-t", f"{dur:.3f}", "-i", os.path.join(raw, aud)]
    bs.run(["ffmpeg", "-y", "-v", "error", *ain, "-filter_complex",
            "[0:a][1:a]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]", "-map", "[a]",
            "-c:a", "pcm_s16le", os.path.join(d, "mix.wav")])

    # 2) splice camera (+audio) and screen with the same pieces
    names = list(bs.CAMS)
    fc, labels, sfc = [], [], []
    for i, (pa, pb, s) in enumerate(pieces):
        x, y = pa - w0, pb - w0
        fc.append(f"[{names.index(s)}:v]trim={x:.4f}:{y:.4f},setpts=PTS-STARTPTS[v{i}]")
        fc.append(f"[{len(names)}:a]atrim={x:.4f}:{y:.4f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0, y - x - 0.012):.3f}:d=0.012[a{i}]")
        labels.append(f"[v{i}][a{i}]")
        st = min(max(pa - scr["start"], 0.0), max(0.0, sdur - (pb - pa) - 0.1))
        sfc.append(f"[0:v]trim={st:.4f}:{st + pb - pa:.4f},setpts=PTS-STARTPTS[s{i}]")
    fc.append("".join(labels) + f"concat=n={len(pieces)}:v=1:a=1[v][a]")
    sfc.append("".join(f"[s{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0[v]")
    bs.run(["ffmpeg", "-y", "-v", "error", *sum([["-i", os.path.join(d, f"cam-{s}.mp4")] for s in names], []),
            "-i", os.path.join(d, "mix.wav"), "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-c:a", "aac", "-b:a", "192k", os.path.join(d, "cam.mp4")])
    bs.run(["ffmpeg", "-y", "-v", "error", "-i", os.path.join(d, "screen-src.mp4"), "-filter_complex", ";".join(sfc), "-map", "[v]",
            "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", os.path.join(d, "screen.mp4")])
    for s in names:
        os.remove(os.path.join(d, f"cam-{s}.mp4"))
    os.remove(os.path.join(d, "mix.wav")); os.remove(os.path.join(d, "screen-src.mp4"))

    # 3) captions on the output clock
    def to_out(t):
        acc = 0.0
        for pa, pb, _ in pieces:
            if t < pa:
                return acc
            if t <= pb:
                return acc + (t - pa)
            acc += pb - pa
        return acc
    total = sum(pb - pa for pa, pb, _ in pieces)
    fixes = {bs.norm(k): v for k, v in spec.get("replace", {}).items()}
    cap = []
    for w in W:
        if w.get("cut") or not any(ra - 0.05 <= w["start"] and w["end"] <= rb + 0.3 for ra, rb in ranges):
            continue
        s_, e_ = to_out(w["start"]), to_out(w["end"])
        if e_ - s_ < 0.03:
            continue
        text = fixes.get(bs.norm(w["word"]), w["word"])
        if text:
            cap.append({"text": text, "startMs": round(s_ * 1000), "endMs": round(e_ * 1000), "speaker": w["speaker"]})

    # 4) focus keyframes: "on" = first caption word (after the previous key) matching, else "at" seconds
    focus, last = [], -1
    for f in spec["focus"]:
        if "on" in f:
            hit = next((c for c in cap if c["startMs"] > last and bs.norm(c["text"]) == bs.norm(f["on"])), None)
            if not hit:
                print(f"WARN focus word not found: {f['on']!r}"); continue
            ms = max(0, hit["startMs"] - 250)
        else:
            ms = int(f["at"] * 1000)
        last = ms
        focus.append({"startMs": ms, "box": f["box"], **{k: f[k] for k in ("label", "mark") if k in f}})

    fj = os.path.join(d, "faces.json")
    subprocess.run([sys.executable, os.path.join(ROOT, "pipeline/face_track.py"), os.path.join(d, "cam.mp4"), fj], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    frames = int(total * 30)
    props = {"screen": "screen.mp4", "screenW": out_sw, "screenH": out_sh, "cam": "cam.mp4", "camW": CAM_W, "camH": CAM_H,
             "durationInFrames": frames, "words": cap, "focus": focus, "faces": json.load(open(fj)),
             "title": spec["title"], "kicker": spec.get("kicker", "Fringe Lines · How-to"), "titleEndMs": int(spec.get("title_end", 3.2) * 1000),
             **({"screenClip": spec["clip"]} if "clip" in spec else {})}
    pj = os.path.join(d, "props.json")
    json.dump(props, open(pj, "w"))
    print(json.dumps({"name": name, "duration": round(total, 1), "pieces": len(pieces), "focus": [(f["startMs"], f.get("label")) for f in focus],
                      "text": " ".join(c["text"] for c in cap)}))

    tmp = os.path.join(d, "render.mp4")
    subprocess.run(["node", os.path.join(ROOT, "pipeline/remotion/render.mjs"), pj, tmp, "HowTo"], check=True, stdout=subprocess.DEVNULL)

    # SFX: soft whoosh on every focus move, pop on the title
    SR = ss.SR
    fx = np.zeros(int(SR * (total + 1)))
    def place(sig, t, g):
        i = int(t * SR); j = min(len(fx), i + len(sig)); fx[i:j] += sig[: j - i] * g
    place(ss.sfx_pop(), 0.15, 0.6)
    for k, f in enumerate(focus[1:]):
        place(ss.sfx_whoosh(seed=k), f["startMs"] / 1000, 0.6)
    fx *= 10 ** (-22 / 20)
    import wave
    fxp = os.path.join(d, "sfx.wav")
    with wave.open(fxp, "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR)
        wv.writeframes((np.clip(fx, -1, 1) * 32767).astype(np.int16).tobytes())
    out = os.path.join(ROOT, "out/shorts", f"{a.ep}-{name}.mp4")
    bs.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-i", fxp, "-filter_complex",
            f"[0:a][1:a]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
            "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
    os.remove(tmp)
    print("wrote", out)


if __name__ == "__main__":
    main()
