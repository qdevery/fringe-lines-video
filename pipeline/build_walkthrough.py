#!/usr/bin/env python3
"""How-to screen share: a 16:9 walkthrough — camera with stacking pills, screen recording on a paper canvas with
zoom/pan, highlight boxes and blur, flow / table / list diagrams and chapter cards, in the FringeLines v2.1 kit.
See .claude/skills/how-to-screen-share/SKILL.md.

  # 0) (Descript export only) pull one speaker's camera + studio audio and the screen clips onto one clock
  python pipeline/build_walkthrough.py prep --slug list-building --descript "inbox/walkthrough/list-building/<export folder>" \
      [--speaker Quinn] [--from 120 --to 780]
  -> work/walkthrough/<slug>/src/{take.mp4, screen.mp4, screen.json}

  # 1) cut: transcribe, remove fillers / pauses, cut camera AND screen identically (frame-exact)
  python pipeline/build_walkthrough.py cut --slug list-building [--src take.mp4] [--screen screen.mp4] [--screen-offset 0]
      [--range 0:62 --range 70:400] [--replace "clay=>Clay"]
  -> work/walkthrough/<slug>/{clip.mp4, screen.mp4, props.json, transcript.txt}

  # 2) frames: stills of the cut screen track with a 10% grid, for picking focus / mark / blur boxes
  python pipeline/build_walkthrough.py frames --slug list-building --at 31.5 --at 48

  # 3) render: beats.json -> out/walkthrough/<slug>.mp4
  python pipeline/build_walkthrough.py render --slug list-building [--spec beats.json] [--sfx-db -22]
"""
import argparse, json, os, subprocess, sys, wave
import xml.etree.ElementTree as ET
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_monologue as bm  # noqa: E402  cut step, tokenize / align shared with the monologue
from build_short import run  # noqa: E402
from style_short import sfx_whoosh, sfx_pop, SR  # noqa: E402
import logos  # noqa: E402  company logo library (assets/logos)

FPS = 30
PAPER = {"screen", "flow", "table", "list", "chapter"}
TEXT_BEATS = {"title", "name", "cta", "end", "big"}
ITEM_BEATS = {"pills", "flow", "list", "logos"}
PAPER_BG = "0xF7F7F5"


def wdir(slug):
    return os.path.join(ROOT, "work", "walkthrough", slug)


def idir(slug):
    return os.path.join(ROOT, "inbox", "walkthrough", slug)


def sdir(slug):
    """prep output (take.mp4, screen.mp4, screen.json): intermediates, kept out of the inbox."""
    return os.path.join(wdir(slug), "src")


def src_file(slug, name):
    """prep output if present, else a file the user dropped in the inbox (option B)."""
    p = os.path.join(sdir(slug), name)
    return p if os.path.exists(p) else os.path.join(idir(slug), name)


def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-show_entries",
               "format=duration", "-of", "csv=p=0", path]).split()
    w, h = map(int, out[0].split(",")[:2])
    return w, h, float(out[-1])


# ---------------------------------------------------------------- prep (Descript timeline export)

def clips_from_xml(xml):
    seq = ET.parse(xml).getroot().find("sequence")
    tb = int(seq.find("rate/timebase").text)
    seen, out = set(), []
    for c in seq.iter("clipitem"):
        g = lambda k: c.find(k).text  # noqa: E731
        key = (g("name"), g("start"))
        if key in seen or g("enabled") != "TRUE": continue
        seen.add(key)
        out.append({"file": g("name"), "start": int(g("start")) / tb, "end": int(g("end")) / tb, "in": int(g("in")) / tb})
    return out


def cmd_prep(a):
    src = os.path.abspath(a.descript)
    xml = next(os.path.join(src, f) for f in os.listdir(src) if f.endswith(".xml"))
    clips = [c for c in clips_from_xml(xml) if os.path.exists(os.path.join(src, c["file"]))]
    cams = [c for c in clips if c["file"].endswith(".mp4") and "screen" not in c["file"].lower() and c["file"].startswith(a.speaker)]
    if not cams: sys.exit(f"no camera clip for speaker {a.speaker!r} in {xml}")
    t0 = a.__dict__["from"] if a.__dict__["from"] is not None else min(c["start"] for c in cams)
    t1 = a.to if a.to is not None else max(c["end"] for c in cams)
    cam = max(cams, key=lambda c: min(t1, c["end"]) - max(t0, c["start"]))
    t0, t1 = max(t0, cam["start"]), min(t1, cam["end"])
    dur = t1 - t0
    vt = t0 - cam["start"] + cam["in"]
    stem = os.path.splitext(cam["file"])[0]
    audio = os.path.join(src, f"studio-sound-{stem}.m4a")
    d = sdir(a.slug); os.makedirs(d, exist_ok=True)
    take = os.path.join(d, "take.mp4")
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{vt:.3f}", "-t", f"{dur:.3f}", "-i", os.path.join(src, cam["file"])]
    if os.path.exists(audio): cmd += ["-ss", f"{vt:.3f}", "-t", f"{dur:.3f}", "-i", audio, "-map", "0:v", "-map", "1:a"]
    run(cmd + ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", take])

    scr = [c for c in clips if "screen" in c["file"].lower() and c["end"] > t0 and c["start"] < t1]
    spans = []
    if scr:
        sw, sh, _ = probe(os.path.join(src, scr[0]["file"]))
        ow = min(1920, sw) // 2 * 2; oh = round(ow * sh / sw / 2) * 2
        # paper gaps + screen clips concatenated onto the take's clock (overlay on VFR screen captures can crash ffmpeg)
        cmd, fc, segs, cur = ["ffmpeg", "-y", "-v", "error"], [], [], 0.0
        for i, c in enumerate(sorted(scr, key=lambda c: c["start"])):
            s0, s1 = max(c["start"], t0) - t0, min(c["end"], t1) - t0
            if s0 > cur + 1e-3:
                fc.append(f"color=c={PAPER_BG}:s={ow}x{oh}:r={FPS}:d={s0 - cur:.3f},setsar=1[g{i}]"); segs.append(f"[g{i}]")
            cmd += ["-ss", f"{c['in'] + max(0.0, t0 - c['start']):.3f}", "-t", f"{s1 - s0:.3f}", "-i", os.path.join(src, c["file"])]
            k = len(cmd) and sum(1 for x in cmd if x == "-i") - 1
            fc.append(f"[{k}:v]fps={FPS},scale={ow}:{oh}:force_original_aspect_ratio=decrease,pad={ow}:{oh}:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,"
                      f"trim=duration={s1 - s0:.3f},tpad=stop_mode=clone:stop_duration=1,trim=duration={s1 - s0:.3f},setpts=PTS-STARTPTS[c{i}]")
            segs.append(f"[c{i}]"); spans.append([round(s0, 2), round(s1, 2)]); cur = s1
        if dur > cur + 1e-3:
            fc.append(f"color=c={PAPER_BG}:s={ow}x{oh}:r={FPS}:d={dur - cur:.3f},setsar=1[gend]"); segs.append("[gend]")
        fc.append("".join(segs) + f"concat=n={len(segs)}:v=1:a=0[v]")
        run(cmd + ["-filter_complex", ";".join(fc), "-map", "[v]", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-g", "30",
                   os.path.join(d, "screen.mp4")])
    json.dump({"source": os.path.relpath(xml, ROOT), "speaker": a.speaker, "from": round(t0, 3), "to": round(t1, 3), "spans": spans,
               "screens": [c["file"] for c in scr]}, open(os.path.join(d, "screen.json"), "w"), indent=1)
    print(json.dumps({"take": take, "duration": round(dur, 2), "camera": cam["file"], "studio_audio": os.path.exists(audio),
                      "screens": [c["file"] for c in scr], "screen_spans": spans}))


# ---------------------------------------------------------------- cut

def align_screen(screen, offset, dur, d):
    """screen time = take time + offset. Returns a screen file on the take's clock."""
    if not offset: return screen
    out = os.path.join(d, "screen-aligned.mp4")
    w, h, _ = probe(screen)
    if offset > 0:
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{offset:.3f}", "-i", screen, "-an", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", out])
    else:
        run(["ffmpeg", "-y", "-v", "error", "-i", screen, "-an", "-vf", f"tpad=start_duration={-offset:.3f}:color={PAPER_BG}",
             "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", out])
    return out


def cmd_cut(a):
    d = wdir(a.slug); os.makedirs(d, exist_ok=True)
    a.src = a.src or src_file(a.slug, "take.mp4")
    if not a.screen and os.path.exists(src_file(a.slug, "screen.mp4")): a.screen = src_file(a.slug, "screen.mp4")
    sj = os.path.join(os.path.dirname(os.path.abspath(a.screen)) if a.screen else sdir(a.slug), "screen.json")
    a.screen_spans = json.load(open(sj))["spans"] if a.screen and os.path.exists(sj) else None
    if a.screen:
        _, _, dur = probe(a.src)
        a.screen = align_screen(os.path.abspath(a.screen), a.screen_offset, dur, d)
        if a.screen_spans is None:
            a.screen_spans = [[max(0.0, -a.screen_offset), dur]]
    bm.cmd_cut(a, d=d)
    p = json.load(open(os.path.join(d, "props.json")))
    if p.get("screenSpans"): print("screen on (cut clock):", p["screenSpans"])


# ---------------------------------------------------------------- frames (box picking)

def cmd_frames(a):
    from PIL import Image, ImageDraw
    d = wdir(a.slug); out = os.path.join(d, "frames"); os.makedirs(out, exist_ok=True)
    for t in a.at:
        p = os.path.join(out, f"screen-{t:07.2f}.png")
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", os.path.join(d, "screen.mp4"), "-frames:v", "1", p])
        im = Image.open(p).convert("RGB"); w, h = im.size
        dr = ImageDraw.Draw(im)
        for k in range(1, 10):
            x, y = w * k / 10, h * k / 10
            dr.line([(x, 0), (x, h)], fill=(212, 98, 42), width=2 if k != 5 else 4)
            dr.line([(0, y), (w, y)], fill=(212, 98, 42), width=2 if k != 5 else 4)
            dr.rectangle([x + 3, 3, x + 40, 26], fill=(255, 255, 255)); dr.text((x + 6, 6), f".{k}", fill=(20, 23, 15))
            dr.rectangle([3, y + 3, 40, y + 26], fill=(255, 255, 255)); dr.text((6, y + 6), f".{k}", fill=(20, 23, 15))
        im.save(p); print(p)


# ---------------------------------------------------------------- render

def cmd_render(a):
    d = wdir(a.slug)
    props = json.load(open(os.path.join(d, "props.json")))
    spec = json.load(open(a.spec or os.path.join(d, "beats.json")))
    words = props["words"]
    base_ms = props["durationInFrames"] / FPS * 1000
    ms = lambda s: round(s * 1000)  # noqa: E731
    beats = []
    for b in spec["beats"]:
        b = dict(b)
        t0 = ms(b.pop("at"))
        t1 = ms(b.pop("end")) if "end" in b else t0 + ms(b.pop("hold", 3))
        even = b.pop("reveal", "") == "even"
        out = {**b, "startMs": t0, "endMs": t1}
        if b["type"] in TEXT_BEATS and "text" in b:
            toks = bm.tokenize(out.pop("text"))
            ts = bm.align(toks, words, t0, t1, even or b["type"] in {"end", "cta"})
            out["tokens"] = [{"t": w, "s": s, "ms": t} for (w, s), t in zip(toks, ts)]

        def items(lst):
            res, n = [], len(lst)
            for i, it in enumerate(lst):
                it = {"text": it} if isinstance(it, str) else dict(it)
                it["ms"] = ms(it.pop("at")) if "at" in it else round(t0 + 250 + (t1 - t0) * 0.6 * i / max(1, n))
                res.append(it)
            return res
        if b["type"] in ITEM_BEATS: out["items"] = items(b["items"])
        if b["type"] == "table": out["rows"] = items(b["rows"])
        if b["type"] == "screen":
            if not props.get("screen"): sys.exit("screen beat but no screen track: re-run cut with --screen")
            out["focus"] = [{"ms": ms(f["at"]), "box": f["box"]} for f in b.get("focus", [])]
            out["marks"] = [{**{k: v for k, v in m.items() if k not in ("at", "end")}, "ms": ms(m["at"]), **({"endMs": ms(m["end"])} if "end" in m else {})}
                            for m in b.get("marks", [])]
            out["blur"] = [{"box": r["box"], **({"ms": ms(r["at"])} if "at" in r else {}), **({"endMs": ms(r["end"])} if "end" in r else {})}
                           for r in b.get("blur", [])]
            for app in b.get("apps", []):
                if "." in app and not os.path.exists(os.path.join(d, app)): sys.exit(f"app icon not found: {os.path.join(d, app)}")
            for box in [f["box"] for f in b.get("focus", [])] + [m["box"] for m in b.get("marks", [])] + [r["box"] for r in b.get("blur", [])]:
                if len(box) != 4 or box[0] < 0 or box[1] < 0 or box[0] + box[2] > 1.001 or box[1] + box[3] > 1.001:
                    sys.exit(f"bad box {box}: [x, y, w, h] as 0..1 fractions of the screen, inside the frame")
        beats.append(logos.attach(out, d))
    end_ms = max([base_ms] + [b["endMs"] for b in beats])
    total = int(round(end_ms / 1000 * FPS)) + 10

    fj = os.path.join(d, "faces.json")
    if not os.path.exists(fj):
        subprocess.run([sys.executable, os.path.join(HERE, "face_track.py"), os.path.join(d, props["src"]), fj], check=True)
    rp = {k: props[k] for k in ("src", "srcW", "srcH", "shots", "screen", "screenW", "screenH") if k in props}
    rp.update({"durationInFrames": total, "faces": json.load(open(fj)), "beats": beats, "brand": spec.get("brand", "FringeLines")})
    pj = os.path.join(d, "props-render.json"); json.dump(rp, open(pj, "w"))
    if a.stills:  # QA: PNG stills at these seconds instead of the video
        sd = os.path.join(d, "stills"); os.makedirs(sd, exist_ok=True)
        batch = [{"id": "Walkthrough", "props": rp, "out": f"stills/{t:06.2f}.png", "still": int(round(t * FPS))} for t in a.stills]
        bj = os.path.join(d, "stills.json"); json.dump({"batch": batch}, open(bj, "w"))
        subprocess.run(["node", os.path.join(HERE, "remotion/render.mjs"), bj, os.path.join(d, "stills")], check=True)
        return
    tmp = os.path.join(d, "render.mp4")
    subprocess.run(["node", os.path.join(HERE, "remotion/render.mjs"), pj, tmp, "Walkthrough"], check=True)

    # sound: whoosh in/out of the paper canvas, a soft whoosh on each zoom move, pops as items / marks land, riser on cards
    dur = total / FPS
    fx = np.zeros(int(SR * (dur + 1)))
    def place(sig, t, gain=1.0):
        i = int(max(0, t) * SR); j = min(len(fx), i + len(sig)); fx[i:j] += sig[: j - i] * gain
    spans = []
    for b in sorted((b for b in beats if b["type"] in PAPER), key=lambda b: b["startMs"]):
        if spans and b["startMs"] - spans[-1][1] < 700: spans[-1][1] = max(spans[-1][1], b["endMs"])
        else: spans.append([b["startMs"], b["endMs"]])
    for k, (s, e) in enumerate(spans):
        place(sfx_whoosh(seed=k), s / 1000 - 0.1, 0.7); place(sfx_whoosh(seed=50 + k), e / 1000 - 0.1, 0.5)
    for k, b in enumerate(beats):
        t = b["startMs"] / 1000
        if b["type"] in {"title", "end", "chapter"}: place(sfx_whoosh(0.7, seed=90 + k), t - 0.2, 1.0)
        if b["type"] in {"cta", "big", "card"}: place(sfx_pop(), t + 0.15, 0.6)
        for f in b.get("focus", []): place(sfx_whoosh(0.35, seed=200 + k), f["ms"] / 1000 - 0.05, 0.3)
        for it in b.get("items", []) + b.get("rows", []) + b.get("marks", []):
            place(sfx_pop(), it["ms"] / 1000 + 0.05, 0.45)
    fx *= 10 ** (a.sfx_db / 20)
    fxp = os.path.join(d, "sfx.wav")
    with wave.open(fxp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(fx, -1, 1) * 32767).astype(np.int16).tobytes())
    os.makedirs(os.path.join(ROOT, "out/walkthrough"), exist_ok=True)
    out = os.path.join(ROOT, "out/walkthrough", f"{a.slug}.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-i", fxp, "-filter_complex",
         f"[0:a]apad[v];[v][1:a]amix=inputs=2:normalize=0:duration=first,atrim=0:{dur:.3f},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
    os.remove(tmp)
    print("wrote", out, f"({dur:.1f}s)")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("prep")
    p.add_argument("--slug", required=True); p.add_argument("--descript", required=True); p.add_argument("--speaker", default="Quinn")
    p.add_argument("--from", type=float, default=None); p.add_argument("--to", type=float, default=None)
    c = sub.add_parser("cut")
    c.add_argument("--slug", required=True); c.add_argument("--src"); c.add_argument("--screen"); c.add_argument("--screen-offset", type=float, default=0.0)
    c.add_argument("--range", action="append", default=[]); c.add_argument("--replace", action="append", default=[])
    c.add_argument("--retranscribe", action="store_true")
    f = sub.add_parser("frames")
    f.add_argument("--slug", required=True); f.add_argument("--at", type=float, action="append", required=True)
    r = sub.add_parser("render")
    r.add_argument("--slug", required=True); r.add_argument("--spec"); r.add_argument("--sfx-db", type=float, default=-22.0)
    r.add_argument("--stills", type=lambda v: [float(x) for x in v.split(",")], help="QA: comma-separated seconds -> PNG stills only")
    a = ap.parse_args()
    {"prep": cmd_prep, "cut": cmd_cut, "frames": cmd_frames, "render": cmd_render}[a.cmd](a)


if __name__ == "__main__":
    main()
