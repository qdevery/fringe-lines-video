#!/usr/bin/env python3
"""Engaging monologue: a 16:9 talking-head video with FringeLines-styled kinetic text, diagrams and PiP layouts.

Two steps (see .claude/skills/engaging-monologue/SKILL.md):

  # 1) cut: transcribe the take, remove fillers / stutters / long pauses, jump-cut with alternating punch-ins
  python pipeline/build_monologue.py cut --slug morning-loop --src inbox/monologue/morning-loop/take.mp4 \
      [--range 0:62.3 --range 70:95] [--replace "gtm=>GTM"] [--replace "quick=>Quick"]
  -> work/monologue/<slug>/{clip.mp4, props.json, transcript.txt}

  # 2) render: beats.json (times in seconds on the cut clip) -> out/monologue/<slug>.mp4
  python pipeline/build_monologue.py render --slug morning-loop [--spec work/monologue/<slug>/beats.json] [--sfx-db -22]

beats.json: {"brand": "FringeLines", "beats": [{"type": "title", "at": 0.2, "end": 2.6, "text": "The *morning* loop"}, ...]}
Text fields use *italic highlight* (ink-blue on paper, white on video) and [accent number] (orange). Words are revealed
in sync with the speech: each word is matched to the transcript inside the beat's window; text that isn't spoken
verbatim falls back to an even reveal. Per-item times ("at") in chips/compare/stack/steps/roadmap default to a stagger.
"""
import argparse, json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from build_short import plan, norm, run  # noqa: E402  filler / stutter / pause planner shared with the shorts
from style_short import sfx_whoosh, sfx_pop, SR  # noqa: E402
import logos  # noqa: E402  company logo library (assets/logos)

FPS = 30
PUNCH = [1.0, 1.12]
PAPER = {"text", "roadmap", "compare", "stack", "stat", "steps", "media"}
TEXT_BEATS = {"title", "text", "overlay", "callout", "name", "cta", "stat", "end"}
ITEM_BEATS = {"chips", "stack", "steps", "roadmap"}


def wdir(slug):
    return os.path.join(ROOT, "work", "monologue", slug)


# ---------------------------------------------------------------- cut

def cmd_cut(a, d=None):
    """Also used by build_walkthrough.py: pass d (work dir) and a.screen (a screen track in sync with a.src) to cut both."""
    d = d or wdir(a.slug); os.makedirs(d, exist_ok=True)
    src = os.path.abspath(a.src)
    wj = os.path.join(d, "words-src.json")
    if not os.path.exists(wj) or a.retranscribe:
        subprocess.run([sys.executable, os.path.join(HERE, "transcribe_verbatim.py"), src, "--speaker", "Host", "--output", wj], check=True)
    words = json.load(open(wj))["words"]
    dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).strip())
    ranges = [tuple(map(float, r.split(":"))) for r in a.range] if a.range else [(0.0, dur)]
    pieces, W = [], []
    for ra, rb in ranges:
        Wr, keep = plan([dict(w) for w in words], ra, rb)
        W += Wr; pieces += keep
    fixes = {norm(k): v for k, v in (r.split("=>", 1) for r in a.replace)}
    # snap every piece to the 30 fps frame grid so audio and video stay in sync however many cuts there are
    pieces = [(round(pa * FPS) / FPS, round(pb * FPS) / FPS) for pa, pb in pieces]
    pieces = [(pa, pb) for pa, pb in pieces if pb > pa]

    # splice video+audio pieces, normalise to 1920x1080 / 30 fps / -14 LUFS
    n = len(pieces)
    fc, labels = [f"[0:v]fps={FPS},split={n}" + "".join(f"[s{i}]" for i in range(n))], []
    for i, (pa, pb) in enumerate(pieces):
        fa, fb = round(pa * FPS), round(pb * FPS)
        fc.append(f"[s{i}]trim=start_frame={fa}:end_frame={fb},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080[v{i}]")
        fc.append(f"[0:a]atrim={pa:.6f}:{pb:.6f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0, pb - pa - 0.012):.3f}:d=0.012[a{i}]")
        labels.append(f"[v{i}][a{i}]")
    fc.append("".join(labels) + f"concat=n={n}:v=1:a=1[v][ac];[ac]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]")
    script = os.path.join(d, "cut.ffscript"); open(script, "w").write(";".join(fc))
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-/filter_complex", script, "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-c:a", "aac", "-b:a", "192k", os.path.join(d, "clip.mp4")])
    screen = None
    if getattr(a, "screen", None):
        # the same frame-exact pieces from the screen track (kept at its own aspect, max 1920 wide)
        sw, sh = map(int, run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", a.screen]).strip().split(","))
        ow = min(1920, sw) // 2 * 2; oh = round(ow * sh / sw / 2) * 2
        sfc = [f"[0:v]fps={FPS},scale={ow}:{oh},setsar=1,tpad=stop_mode=clone:stop_duration={dur + 5:.0f},split={n}" + "".join(f"[s{i}]" for i in range(n))]
        for i, (pa, pb) in enumerate(pieces):
            sfc.append(f"[s{i}]trim=start_frame={round(pa * FPS)}:end_frame={round(pb * FPS)},setpts=PTS-STARTPTS[v{i}]")
        sfc.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]")
        sscript = os.path.join(d, "cut-screen.ffscript"); open(sscript, "w").write(";".join(sfc))
        run(["ffmpeg", "-y", "-v", "error", "-i", os.path.abspath(a.screen), "-/filter_complex", sscript, "-map", "[v]", "-an",
             "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-g", "30", os.path.join(d, "screen.mp4")])
        screen = {"screen": "screen.mp4", "screenW": ow, "screenH": oh}

    def to_out(t):
        acc = 0.0
        for pa, pb in pieces:
            if t < pa: return acc
            if t <= pb: return acc + (t - pa)
            acc += pb - pa
        return acc
    total = sum(pb - pa for pa, pb in pieces)
    cap = []
    for w in sorted(W, key=lambda w: w["start"]):
        if w.get("cut"): continue
        s, e = to_out(w["start"]), to_out(w["end"])
        if e - s < 0.03: continue
        text = fixes.get(norm(w["word"]), w["word"])
        if text: cap.append({"text": text, "startMs": round(s * 1000), "endMs": round(e * 1000)})
    # a new shot at every jump cut, alternating wide / punched-in so cuts read as intentional
    shots, acc = [], 0.0
    for i, (pa, pb) in enumerate(pieces):
        if i == 0 or (pa - pieces[i - 1][1] > 0.25 and len(shots) and acc * 1000 - shots[-1]["startMs"] > 1500):
            shots.append({"startMs": round(acc * 1000), "endMs": 0, "scale": PUNCH[len(shots) % 2]})
        acc += pb - pa
        shots[-1]["endMs"] = round(acc * 1000) + 1
    props = {"src": "clip.mp4", "srcW": 1920, "srcH": 1080, "durationInFrames": int(round(total * FPS)), "words": cap, "shots": shots, **(screen or {})}
    if screen and getattr(a, "screen_spans", None):  # where the screen track has real content, on the cut clock
        props["screenSpans"] = [[round(to_out(s0), 2), round(to_out(s1), 2)] for s0, s1 in a.screen_spans if to_out(s1) - to_out(s0) > 0.5]
    json.dump(props, open(os.path.join(d, "props.json"), "w"), indent=1)
    # transcript with times, for writing beats.json
    lines, cur = [], []
    for w in cap:
        cur.append(f"{w['text']}@{w['startMs'] / 1000:.1f}")
        if re.search(r"[.?!]$", w["text"]) or len(cur) >= 14:
            lines.append(" ".join(cur)); cur = []
    if cur: lines.append(" ".join(cur))
    open(os.path.join(d, "transcript.txt"), "w").write("\n".join(lines) + "\n")
    for f in ("faces.json",):
        p = os.path.join(d, f)
        if os.path.exists(p): os.remove(p)  # re-cut invalidates the face track
    print(json.dumps({"slug": a.slug, "duration": round(total, 2), "removed_s": round(sum(b - a for a, b in ranges) - total, 2),
                      "jump_cuts": len(pieces) - 1, "shots": len(shots), "words": len(cap)}))
    print("transcript:", os.path.join(d, "transcript.txt"))


# ---------------------------------------------------------------- render

def tokenize(text):
    """'The *morning loop* runs at [7 AM]' -> [(word, style)], style n / i / a; markers may span words."""
    out, mode = [], "n"
    for raw in text.split():
        w = raw
        start_i, start_a = w.startswith("*"), w.startswith("[")
        if start_i: mode = "i"; w = w[1:]
        if start_a: mode = "a"; w = w[1:]
        end = mode != "n" and (w.endswith("*") or w.endswith("]") or re.search(r"[*\]][.,!?;:]$", w))
        w = re.sub(r"[*\]]([.,!?;:]?)$", r"\1", w) if end else w
        out.append((w, mode))
        if end: mode = "n"
    return out


def align(tokens, words, t0, t1, even=False):
    """Give each token a reveal time (ms): match it to the next spoken word in the window; unmatched tokens follow."""
    n = len(tokens)
    win = [w for w in words if t0 - 400 <= w["startMs"] <= t1]
    times, j, hits = [], 0, 0
    if not even:
        for tok, _ in tokens:
            t = norm(tok)
            k = next((k for k in range(j, min(len(win), j + 8)) if t and norm(win[k]["text"]) == t), None)
            if k is not None:
                times.append(max(t0, win[k]["startMs"] - 60)); j = k + 1; hits += 1
            else:
                times.append(None)
    if even or hits < max(1, n * 0.4):
        span = min((t1 - t0) * 0.7, n * 260)
        return [round(t0 + 120 + span * i / max(1, n)) for i in range(n)]
    last = t0
    for i, t in enumerate(times):
        if t is None: times[i] = last + 90
        last = times[i] = max(times[i], last)
    return [round(t) for t in times]


def cmd_render(a):
    d = wdir(a.slug)
    props = json.load(open(os.path.join(d, "props.json")))
    spec = json.load(open(a.spec or os.path.join(d, "beats.json")))
    words = props["words"]
    base_ms = props["durationInFrames"] / FPS * 1000
    beats = []
    for b in spec["beats"]:
        b = dict(b)
        t0 = round(b.pop("at") * 1000)
        t1 = round(b.pop("end") * 1000) if "end" in b else round(t0 + b.pop("hold", 3) * 1000)
        even = b.pop("reveal", "") == "even"
        out = {**b, "startMs": t0, "endMs": t1}
        if b["type"] in TEXT_BEATS and "text" in b:
            toks = tokenize(out.pop("text"))
            ts = align(toks, words, t0, t1, even or b["type"] in {"end", "cta"})
            out["tokens"] = [{"t": w, "s": s, "ms": t} for (w, s), t in zip(toks, ts)]
        def items(lst):
            res = []
            n = len(lst)
            for i, it in enumerate(lst):
                it = {"text": it} if isinstance(it, str) else dict(it)
                if "at" in it: it["ms"] = round(it.pop("at") * 1000)
                else: it["ms"] = round(t0 + 250 + (t1 - t0) * 0.6 * i / max(1, n))
                res.append(it)
            return res
        if b["type"] in ITEM_BEATS: out["items"] = items(b["items"])
        if b["type"] == "compare":
            out["left"] = {**b["left"], "items": items(b["left"]["items"])}
            out["right"] = {**b["right"], "items": items(b["right"]["items"])}
        if b["type"] == "roadmap" and "zoom" in b:
            out["zoomMs"] = round(out.pop("zoom") * 1000)
        if b["type"] == "media":
            src = os.path.join(d, b["src"])
            if not os.path.exists(src): sys.exit(f"media not found: {src} (put b-roll/screenshots in work/monologue/{a.slug}/)")
            out["video"] = b.get("video", b["src"].lower().endswith((".mp4", ".mov", ".m4v")))
        beats.append(logos.attach(out, d))
    end_ms = max([base_ms] + [b["endMs"] for b in beats])
    total = int(round(end_ms / 1000 * FPS)) + 10

    fj = os.path.join(d, "faces.json")
    if not os.path.exists(fj):
        subprocess.run([sys.executable, os.path.join(HERE, "face_track.py"), os.path.join(d, props["src"]), fj], check=True)
    rp = {"src": props["src"], "srcW": props.get("srcW", 1920), "srcH": props.get("srcH", 1080), "durationInFrames": total,
          "shots": props["shots"], "faces": json.load(open(fj)), "beats": beats, "brand": spec.get("brand", "FringeLines")}
    pj = os.path.join(d, "props-render.json"); json.dump(rp, open(pj, "w"))
    tmp = os.path.join(d, "render.mp4")
    subprocess.run(["node", os.path.join(HERE, "remotion/render.mjs"), pj, tmp, "Monologue"], check=True)

    # sound design: soft whoosh when the layout changes (full <-> paper), pops when items land, a riser into the end card
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
        if b["type"] in {"title", "end"}: place(sfx_whoosh(0.7, seed=90 + k), t - 0.2, 1.0)
        if b["type"] in {"callout", "cta", "stat"}: place(sfx_pop(), t + 0.15, 0.6)
        for it in b.get("items", []) + b.get("left", {}).get("items", []) + b.get("right", {}).get("items", []):
            place(sfx_pop(), it["ms"] / 1000 + 0.05, 0.45)
    fx *= 10 ** (a.sfx_db / 20)
    fxp = os.path.join(d, "sfx.wav")
    with wave.open(fxp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(fx, -1, 1) * 32767).astype(np.int16).tobytes())
    os.makedirs(os.path.join(ROOT, "out/monologue"), exist_ok=True)
    out = os.path.join(ROOT, "out/monologue", f"{a.slug}.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-i", fxp, "-filter_complex",
         f"[0:a]apad[v];[v][1:a]amix=inputs=2:normalize=0:duration=first,atrim=0:{dur:.3f},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
    os.remove(tmp)
    print("wrote", out, f"({dur:.1f}s)")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cut")
    c.add_argument("--slug", required=True); c.add_argument("--src", required=True)
    c.add_argument("--range", action="append", default=[]); c.add_argument("--replace", action="append", default=[])
    c.add_argument("--retranscribe", action="store_true")
    r = sub.add_parser("render")
    r.add_argument("--slug", required=True); r.add_argument("--spec"); r.add_argument("--sfx-db", type=float, default=-22.0)
    a = ap.parse_args()
    (cmd_cut if a.cmd == "cut" else cmd_render)(a)


if __name__ == "__main__":
    main()
