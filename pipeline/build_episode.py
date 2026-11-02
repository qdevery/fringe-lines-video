#!/usr/bin/env python3
"""Build the full long-form episode (16:9) from the raw Descript multicam export.

  ~/.shorts-skill/bin/python pipeline/build_episode.py --ep 2026-10-30 [--stage all|plan|body|graphics|final]

Config: work/<ep>/episode.json (range, names, chapters, intro clips; all located by spoken phrase).
Body:   um/uh/stutter/long-pause removal (never during crosstalk), active-speaker camera with
        split-screen for quick back-and-forth, punch-in on jump cuts, screen shares placed at the
        Descript XML times with a picture-in-picture of the speaker.
Intro:  highlight cold open (Remotion "Intro"), name + chapter lower-thirds (Remotion "LowerThird").
Output: out/episode/<ep>-fringe-lines.mp4 and <ep>-chapters.txt (YouTube timestamps).
Scratch files go to ~/.cache/fringe-lines-video/work/<ep> (outside Google Drive).
"""
import argparse, json, os, re, subprocess, sys, wave
from concurrent.futures import ThreadPoolExecutor

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_short as bs  # noqa: E402

ROOT = bs.ROOT
FPS = 30
SR = 48000
FACE = {"Quinn": (0.48, 0.38), "Doom": (0.49, 0.36)}  # face centre in camera frame (x, y), for crops
SPLIT_X = {"Quinn": 0.48, "Doom": 0.49}
LONG_TURN = 3.5        # s; shorter turns (quick back-and-forth) go to split screen
PUNCH = [1.0, 1.12]
BG = "0x0E0E12"
ACCENT = "0xFF5A1F"
X264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "60", "-r", str(FPS)]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"{' '.join(cmd[:8])} ...\n{r.stderr[-2000:]}")
    return r


def norm(t):
    return re.sub(r"[^a-z0-9%']", "", t.lower())


class Script:
    """Find spoken phrases in the merged word list."""

    def __init__(self, words):
        self.W = words
        self.toks = [norm(w["word"]) for w in words]

    def find(self, phrase, after=0.0):
        p = [norm(x) for x in phrase.split() if norm(x)]
        for i in range(len(self.toks) - len(p) + 1):
            if self.W[i]["start"] >= after and self.toks[i:i + len(p)] == p:
                return i, i + len(p) - 1
        # retry ignoring the other speaker's interleaved words
        for spk in ("Quinn", "Doom"):
            idx = [i for i, w in enumerate(self.W) if w["speaker"] == spk and w["start"] >= after]
            t = [self.toks[i] for i in idx]
            for j in range(len(t) - len(p) + 1):
                if t[j:j + len(p)] == p:
                    return idx[j], idx[j + len(p) - 1]
        return None

    def span(self, say, until=None, after=0.0):
        a = self.find(say, after)
        if a is None:
            return None
        if until is None:
            return self.W[a[0]]["start"], self.W[a[1]]["end"], self.W[a[0]]["speaker"]
        b = self.find(until, self.W[a[0]]["start"])
        if b is None:
            return None
        return self.W[a[0]]["start"], self.W[b[1]]["end"], self.W[a[0]]["speaker"]


# ---------------------------------------------------------------- planning

def layout_track(W, t0, t1):
    """[a, b, layout] where layout is 'Quinn' | 'Doom' | 'split'."""
    turns = []
    for w in (w for w in W if not w.get("cut")):
        if turns and turns[-1][2] == w["speaker"] and w["start"] - turns[-1][1] < 1.5:
            turns[-1][1] = max(turns[-1][1], w["end"])
        else:
            turns.append([w["start"], w["end"], w["speaker"]])
    lay = []
    for i, (a, b, s) in enumerate(turns):
        if b - a >= LONG_TURN:
            L = s
        else:
            prev_long = next((t for t in reversed(turns[:i]) if t[1] - t[0] >= LONG_TURN), None)
            nxt_long = next((t for t in turns[i + 1:] if t[1] - t[0] >= LONG_TURN), None)
            # a quick "yeah" inside someone's monologue doesn't change the shot
            if prev_long and nxt_long and prev_long[2] == nxt_long[2] != s and nxt_long[0] - prev_long[1] < 4:
                L = prev_long[2]
            else:
                L = "split"
        start = max(t0, a - 0.15)
        if lay and lay[-1][2] == L:
            continue
        if lay:
            lay[-1][1] = start
        lay.append([start, t1, L])
    if lay:
        lay[0][0] = t0
    # very short shots look like glitches: merge into previous
    out = []
    for s in lay:
        if out and s[1] - s[0] < 1.0:
            out[-1][1] = s[1]
        else:
            out.append(s)
    return out


def dominant_speaker(W, a, b):
    tally = {}
    for w in W:
        if w["end"] > a and w["start"] < b and not w.get("cut"):
            tally[w["speaker"]] = tally.get(w["speaker"], 0) + min(b, w["end"]) - max(a, w["start"])
    return max(tally, key=tally.get) if tally else "Quinn"


def make_pieces(W, keep, track, screens):
    """Intersect keep-intervals x layout shots x screen ranges; quantize to whole frames."""
    bounds = []
    for ka, kb in keep:
        cuts = {ka, kb}
        for a, b, _ in track:
            if ka < a < kb:
                cuts.add(a)
        for s in screens:
            for t in (s["start"], s["end"]):
                if ka < t < kb:
                    cuts.add(t)
        c = sorted(cuts)
        bounds += [(c[i], c[i + 1]) for i in range(len(c) - 1)]
    pieces, prev_end, k, prev_lay = [], None, 0, None
    for a, b in bounds:
        n = round((b - a) * FPS)
        if n < 2:
            continue
        b = a + n / FPS
        mid = (a + b) / 2
        lay = next((L for x, y, L in track if x <= mid < y), track[-1][2])
        scr = next((s for s in screens if s["start"] <= mid < s["end"]), None)
        p = {"a": a, "b": b, "frames": n, "layout": lay}
        if scr:
            p["layout"] = "screen"
            p["screen"] = scr
            p["pip"] = lay if lay != "split" else dominant_speaker(W, a, b)
        if p["layout"] in ("Quinn", "Doom"):
            jump = prev_end is not None and abs(prev_end - a) > 1e-3
            if p["layout"] != prev_lay:
                k = 0
            elif jump:
                k += 1
            p["scale"] = PUNCH[k % 2]
        prev_end, prev_lay = b, p["layout"]
        pieces.append(p)
    return pieces


def to_out(pieces, t):
    acc = 0
    for p in pieces:
        if t < p["a"]:
            return acc / FPS
        if t <= p["b"]:
            return acc / FPS + (t - p["a"])
        acc += p["frames"]
    return acc / FPS


# ---------------------------------------------------------------- rendering

def cam_crop(spk, scale):
    w, h = 1920 / scale, 1080 / scale
    fx, fy = FACE[spk]
    x = min(max(fx * 1920 - w / 2, 0), 1920 - w)
    y = min(max(fy * 1080 - h / 2, 0), 1080 - h)
    return f"crop={w:.0f}:{h:.0f}:{x:.0f}:{y:.0f},scale=1920:1080:flags=lanczos,setsar=1"


VIDEO_OVERRIDE = {}  # camera file name -> replacement path (e.g. background-blurred copy)
SEG = "seg"


def src(raw, name):
    return VIDEO_OVERRIDE.get(name) or os.path.join(raw, name)


def render_piece(job):
    p, raw, off, out, cams = job
    if os.path.exists(out):
        return out
    n = p["frames"]
    if p["layout"] in ("Quinn", "Doom"):
        vid = cams[p["layout"]]
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{p['a'] - off[vid]:.3f}", "-i", src(raw, vid),
               "-vf", f"{cam_crop(p['layout'], p.get('scale', 1.0))},fps={FPS}"]
    elif p["layout"] == "split":
        q, d = cams["Quinn"], cams["Doom"]
        xq = min(max(SPLIT_X["Quinn"] * 1920 - 477, 0), 1920 - 954)
        xd = min(max(SPLIT_X["Doom"] * 1920 - 477, 0), 1920 - 954)
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{p['a'] - off[q]:.3f}", "-i", src(raw, q),
               "-ss", f"{p['a'] - off[d]:.3f}", "-i", src(raw, d), "-filter_complex",
               f"[0:v]fps={FPS},crop=954:1080:{xq:.0f}:0[l];[1:v]fps={FPS},crop=954:1080:{xd:.0f}:0,pad=966:1080:12:0:color={BG}[r];"
               f"[l][r]hstack,setsar=1"]
    else:  # screen + pip
        s = p["screen"]
        sw, sh = s["w"], s["h"]
        k = min(1880 / sw, 1040 / sh)
        w, h = int(sw * k) // 2 * 2, int(sh * k) // 2 * 2
        if 1920 - 20 - w >= 520:   # room on the right: screen left, pip right
            sx, sy = 20, (1080 - h) // 2
            pw, ph = 1920 - w - 60, int((1920 - w - 60) * 9 / 16)
            px, py = w + 40, 1080 - ph - 40 - 12
        else:
            sx, sy = (1920 - w) // 2, (1080 - h) // 2
            pw, ph = 448, 252
            px, py = 1920 - pw - 12 - 30, 1080 - ph - 12 - 30
        pip = cams[p["pip"]]
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={BG}:s=1920x1080:r={FPS}",
               "-ss", f"{p['a'] - s['start']:.3f}", "-i", os.path.join(raw, s["file"]),
               "-ss", f"{p['a'] - off[pip]:.3f}", "-i", src(raw, pip), "-filter_complex",
               f"[1:v]fps={FPS},scale={w}:{h}:flags=lanczos,setsar=1[s];"
               f"[2:v]fps={FPS},scale={pw}:{ph},pad={pw + 12}:{ph + 12}:6:6:color={ACCENT},setsar=1[p];"
               f"[0:v][s]overlay={sx}:{sy}:shortest=0[b];[b][p]overlay={px}:{py},setsar=1"]
    cmd += ["-an", "-frames:v", str(n), *X264, out + ".tmp.mp4"]
    run(cmd)
    os.replace(out + ".tmp.mp4", out)
    return out


def build_mix(raw, off, cams_audio, dest):
    """Both studio-sound tracks on the sequence clock, 2-pass loudnorm to -16 LUFS, 48k stereo wav."""
    if os.path.exists(dest):
        return
    ins, fl = [], []
    for i, (spk, f) in enumerate(cams_audio.items()):
        ins += ["-i", os.path.join(raw, f)]
        fl.append(f"[{i}:a]aresample={SR},adelay={off[f] * 1000:.0f}:all=1[a{i}]")
    graph = ";".join(fl) + f";{''.join(f'[a{i}]' for i in range(len(ins) // 2))}amix=inputs={len(ins) // 2}:normalize=0"
    r = run(["ffmpeg", "-v", "info", *ins, "-filter_complex", graph + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[o]",
             "-map", "[o]", "-f", "null", "-"])
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    ln = (f"loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    run(["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", graph + f",{ln},aresample={SR}[o]", "-map", "[o]",
         "-ac", "2", "-c:a", "pcm_s16le", dest])


def load_wav(path):
    with wave.open(path) as f:
        return np.frombuffer(f.readframes(f.getnframes()), np.int16).reshape(-1, f.getnchannels())


def save_wav(path, data):
    with wave.open(path, "wb") as f:
        f.setnchannels(data.shape[1]); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(data.astype(np.int16).tobytes())


def splice_audio(mix, pieces):
    fade = int(0.005 * SR)
    ramp = np.linspace(0, 1, fade)[:, None]
    out = []
    for p in pieces:
        a = int(round(p["a"] * SR))
        n = p["frames"] * SR // FPS
        seg = mix[a:a + n].astype(np.float32)
        if len(seg) < n:
            seg = np.vstack([seg, np.zeros((n - len(seg), mix.shape[1]), np.float32)])
        seg[:fade] *= ramp
        seg[-fade:] *= ramp[::-1]
        out.append(seg)
    return np.clip(np.vstack(out), -32768, 32767)


def concat_video(segs, dest):
    lst = dest + ".txt"
    with open(lst, "w") as f:
        f.writelines(f"file '{s}'\n" for s in segs)
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", dest])


def render_all(jobs, label):
    done = 0
    with ThreadPoolExecutor(max_workers=max(2, (os.cpu_count() or 8) // 2)) as ex:
        for _ in ex.map(render_piece, jobs):
            done += 1
            if done % 50 == 0 or done == len(jobs):
                print(f"{label}: {done}/{len(jobs)} segments", flush=True)


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ep", required=True)
    ap.add_argument("--stage", default="all", choices=["all", "plan", "body", "graphics", "final"])
    ap.add_argument("--blur", action="store_true", help="background-blurred version (separate cache + -blur output)")
    a = ap.parse_args()

    raw = next(os.path.join(ROOT, "inbox/raw/descript", d) for d in sorted(os.listdir(os.path.join(ROOT, "inbox/raw/descript")))
               if os.path.isdir(os.path.join(ROOT, "inbox/raw/descript", d)))
    xml = next(os.path.join(raw, f) for f in os.listdir(raw) if f.endswith(".xml"))
    off = bs.xml_offsets(xml)
    work = os.path.join(ROOT, "work", a.ep)
    cfg = json.load(open(os.path.join(work, "episode.json")))
    blur = a.blur or cfg.get("blur_background")
    cache = os.path.expanduser(f"~/.cache/fringe-lines-video/work/{a.ep}" + ("-blur" if blur else ""))
    os.makedirs(cache, exist_ok=True)
    global SEG
    if blur:
        # Zoom-style blur: pipeline/bg_blur.py writes full-length blurred copies of each camera here
        bdir = os.path.expanduser("~/.cache/fringe-lines-video/blur")
        for vid in (v[0] for v in bs.CAMS.values()):
            pth = os.path.join(bdir, vid)
            if not os.path.exists(pth):
                sys.exit(f"missing {pth}: run  pipeline/bg_blur.py '<raw>/{vid}' '{pth}'")
            VIDEO_OVERRIDE[vid] = pth
        SEG = "seg-blur"
    os.makedirs(os.path.join(cache, SEG), exist_ok=True)
    os.makedirs(os.path.join(cache, "gfx"), exist_ok=True)
    cams = {s: v[0] for s, v in bs.CAMS.items()}
    cams_audio = {s: v[1] for s, v in bs.CAMS.items()}

    words = []
    for s in bs.CAMS:
        words += json.load(open(os.path.join(work, f"words-{s.lower()}.json")))["words"]
    words.sort(key=lambda w: w["start"])
    sc = Script(words)

    # screen shares straight from the Descript timeline
    seq = __import__("xml.etree.ElementTree", fromlist=["x"]).parse(xml).getroot().find("sequence")
    tb = int(seq.find("rate/timebase").text)
    screens = []
    for c in seq.find("media/video").iter("clipitem"):
        name = c.find("name").text
        if "screen" in name.lower() and c.find("enabled").text == "TRUE":
            dims = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", os.path.join(raw, name)]).stdout.strip().split(",")
            screens.append({"file": name, "start": int(c.find("start").text) / tb, "end": int(c.find("end").text) / tb,
                            "w": int(dims[0]), "h": int(dims[1])})
    screens.sort(key=lambda s: s["start"])

    # ---- plan body
    r0 = sc.span(cfg["range"][0]); r1 = sc.span(cfg["range"][1])
    t0, t1 = r0[0] - 0.25, r1[1] + 0.6
    W, keep = bs.plan(words, t0, t1)
    track = layout_track(W, t0, t1)
    pieces = make_pieces(W, keep, track, screens)
    body_s = sum(p["frames"] for p in pieces) / FPS
    lay_s = {}
    for p in pieces:
        lay_s[p["layout"]] = lay_s.get(p["layout"], 0) + p["frames"] / FPS
    n_fill = sum(1 for w in W if w.get("cut"))
    print(json.dumps({"source_s": round(t1 - t0, 1), "body_s": round(body_s, 1), "removed_s": round(t1 - t0 - body_s, 1),
                      "words_cut": n_fill, "pieces": len(pieces), "layout_s": {k: round(v) for k, v in lay_s.items()},
                      "screens": [(s["file"], round(s["start"], 1), round(s["end"], 1)) for s in screens]}))
    json.dump({"pieces": pieces, "t0": t0, "t1": t1}, open(os.path.join(cache, "plan.json"), "w"))

    # ---- intro clips
    intro_clips = []
    for i, c in enumerate(cfg["intro"]["clips"]):
        sp = sc.span(c["say"], c["until"])
        if not sp:
            print(f"WARN intro clip not found: {c['say']!r} .. {c['until']!r}")
            continue
        ca, cb, spk = sp[0] - 0.12 - c.get("pre", 0), sp[1] + 0.2, sp[2]
        Wc, keepc = bs.plan(words, ca, cb)
        pcs = []
        for ka, kb in keepc:
            n = round((kb - ka) * FPS)
            if n >= 2:
                pcs.append({"a": ka, "b": ka + n / FPS, "frames": n, "layout": spk, "scale": 1.0})
        fixes = {norm(k): v for k, v in c.get("replace", {}).items()}
        wl = []
        for w in Wc:
            if w.get("cut") or w["speaker"] != spk or w["start"] < ca or w["end"] > cb + 0.1:
                continue
            txt = fixes.get(norm(w["word"]), w["word"])
            wl.append({"text": txt, "startMs": round(to_out(pcs, w["start"]) * 1000), "endMs": round(to_out(pcs, w["end"]) * 1000)})
        intro_clips.append({"i": i, "pieces": pcs, "words": wl, "tag": c["tag"], "speaker": spk, "text": " ".join(x["text"] for x in wl)})
    print(json.dumps([{"tag": c["tag"], "s": round(sum(p["frames"] for p in c["pieces"]) / FPS, 1), "text": c["text"]} for c in intro_clips], indent=0))
    if a.stage == "plan":
        return

    mix_path = os.path.join(cache, "mix.wav")
    gfx = os.path.join(cache, "gfx")

    # ---- body video + audio
    if a.stage in ("all", "body"):
        build_mix(raw, off, cams_audio, mix_path)
        jobs = [(p, raw, off, os.path.join(cache, SEG, f"b{i:05d}-{p['frames']}-{p['layout']}.mp4"), cams) for i, p in enumerate(pieces)]
        render_all(jobs, "body")
        concat_video([j[3] for j in jobs], os.path.join(cache, "body.mp4"))
        mix = load_wav(mix_path)
        save_wav(os.path.join(cache, "body.wav"), splice_audio(mix, pieces))

    # ---- graphics: intro clips + Remotion intro + lower-thirds
    if a.stage in ("all", "graphics"):
        build_mix(raw, off, cams_audio, mix_path)
        mix = load_wav(mix_path)
        batch, total = [], 0
        for c in intro_clips:
            jobs = [(p, raw, off, os.path.join(cache, SEG, f"i{c['i']:02d}-{j:03d}-{p['frames']}.mp4"), cams) for j, p in enumerate(c["pieces"])]
            render_all(jobs, f"intro clip {c['i']}")
            v = os.path.join(gfx, f"clipv-{c['i']}.mp4")
            concat_video([j[3] for j in jobs], v)
            wv = os.path.join(gfx, f"clipa-{c['i']}.wav")
            save_wav(wv, splice_audio(mix, c["pieces"]))
            run(["ffmpeg", "-y", "-v", "error", "-i", v, "-i", wv, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
                 os.path.join(gfx, f"clip-{c['i']}.mp4")])
            c["frames"] = sum(p["frames"] for p in c["pieces"])
            total += c["frames"]
        title_frames = 4 * FPS
        intro_props = {"clips": [{"src": f"clip-{c['i']}.mp4", "durationInFrames": c["frames"], "words": c["words"], "tag": c["tag"]}
                                 for c in intro_clips],
                       "title": cfg["title"], "subtitle": cfg["subtitle"], "topics": cfg["intro"]["topics"],
                       "titleFrames": title_frames, "durationInFrames": total + title_frames}
        intro_id = "Intro"
        if cfg["intro"].get("style") == "v2":
            # editorial cold open: per-clip explainer graphics keyed to a spoken word, keyword captions, SFX
            intro_id = "IntroV2"
            import style_short as ss
            for name, sig in (("whoosh.wav", ss.sfx_whoosh()), ("whoosh-long.wav", ss.sfx_whoosh(0.8, seed=7)), ("pop.wav", ss.sfx_pop())):
                save_wav(os.path.join(gfx, name), np.repeat((sig * 0.9 * 32767)[:, None], 2, axis=1))
            title_frames = int(cfg["intro"].get("title_seconds", 4.5) * FPS)
            intro_props.update({"title": cfg["intro"].get("title", cfg["title"]), "emphasis": cfg["intro"].get("emphasis", []),
                                "titleFrames": title_frames, "durationInFrames": total + title_frames})
            for c, pc in zip(intro_clips, intro_props["clips"]):
                spec = cfg["intro"]["clips"][c["i"]]
                if "graphic" not in spec:
                    continue
                def word_ms(key, default):
                    if key not in spec:
                        return default
                    hit = [w for w in c["words"] if norm(w["text"]) == norm(spec[key])]
                    return hit[0]["startMs"] if hit else default
                pc["graphic"] = spec["graphic"]
                pc["graphicAtMs"] = max(300, word_ms("graphic_on", 900) - 150)
                if "graphic_off" in spec:
                    pc["graphicUntilMs"] = word_ms("graphic_off", None)
        batch.append({"id": intro_id, "props": intro_props, "out": "intro.mp4"})
        lts = [{"say": n["say"], "kicker": n["kicker"], "title": n["title"]} for n in cfg["names"]] + \
              [{"say": c["say"], "kicker": "Topic", "title": c["title"]} for c in cfg["chapters"]]
        for i, lt in enumerate(lts):
            batch.append({"id": "LowerThird", "props": {"kicker": lt["kicker"], "title": lt["title"], "durationInFrames": 6 * FPS},
                          "out": f"lt-{i:02d}.mov", "alpha": True})
        json.dump({"batch": batch}, open(os.path.join(gfx, "batch.json"), "w"))
        subprocess.run(["node", os.path.join(ROOT, "pipeline/remotion/render.mjs"), os.path.join(gfx, "batch.json")], check=True,
                       stdout=subprocess.DEVNULL)

    # ---- final assembly
    if a.stage in ("all", "final"):
        intro = os.path.join(gfx, "intro.mp4")
        # Join intro + body at the container level (identical x264 params), frame-exact; the concat
        # *filter* misplaced the body under the intro.
        ix = os.path.join(cache, "intro-x264.mp4")
        run(["ffmpeg", "-y", "-v", "error", "-i", intro, "-an", "-vf", "fps=30,format=yuv420p,setsar=1", *X264,
             "-video_track_timescale", "15360", ix])
        intro_frames = int(run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                                "stream=nb_read_frames", "-of", "csv=p=0", ix]).stdout.strip())
        intro_s = intro_frames / FPS
        segs = [os.path.join(cache, SEG, f"b{i:05d}-{p['frames']}-{p['layout']}.mp4") for i, p in enumerate(pieces)]
        overlays, chapters = [], [("00:00", "Cold open")]
        lts = [(n["say"], n["title"], False) for n in cfg["names"]] + [(c["say"], c["title"], True) for c in cfg["chapters"]]
        for i, (say, title, is_ch) in enumerate(lts):
            sp = sc.span(say, after=t0)
            if not sp:
                print(f"WARN lower-third phrase not found: {say!r}")
                continue
            t = intro_s + to_out(pieces, sp[0]) + (0.4 if not is_ch else 0.0)
            overlays.append((os.path.join(gfx, f"lt-{i:02d}.mov"), round(t * FPS)))
            if is_ch:
                chapters.append((f"{int(t // 60):02d}:{int(t % 60):02d}" if t < 3600 else f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{int(t % 60):02d}", title))
        chapters.insert(1, (f"{int(intro_s // 60):02d}:{int(intro_s % 60):02d}", "Catching up"))
        chapters.sort(key=lambda c: [int(x) for x in c[0].split(":")])

        # Burn each lower-third into just the body segments it overlaps (one overlay per ffmpeg call).
        # A single long pass chaining 14 overlay inputs silently dropped most of them.
        LT = 6 * FPS
        starts, acc = [], intro_frames
        for p in pieces:
            starts.append(acc)
            acc += p["frames"]
        os.makedirs(os.path.join(cache, "seg-lt"), exist_ok=True)
        jobs = []
        for mov, T in overlays:
            for i, p in enumerate(pieces):
                S, n = starts[i], p["frames"]
                if S < T + LT and S + n > T:
                    jobs.append((i, mov, T))
        burned = {}
        for i, mov, T in jobs:
            S, n = starts[i], pieces[i]["frames"]
            src = burned.get(i, segs[i])
            out = os.path.join(cache, "seg-lt", f"b{i:05d}-{os.path.basename(mov)}.mp4")
            run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ss", f"{max(0, S - T) / FPS:.4f}", "-i", mov, "-filter_complex",
                 f"[1:v]setpts=PTS-STARTPTS+{max(0, T - S)}/{FPS}/TB[o];[0:v][o]overlay=0:0:eof_action=pass,format=yuv420p",
                 "-an", "-frames:v", str(n), *X264, "-video_track_timescale", "15360", out])
            burned[i] = out
        segs = [burned.get(i, s_) for i, s_ in enumerate(segs)]
        print(f"lower-thirds: {len(overlays)} cards burned into {len(burned)} segments")

        full_v = os.path.join(cache, "full.mp4")
        concat_video([ix] + segs, full_v)
        iw = os.path.join(cache, "intro.wav")
        run(["ffmpeg", "-y", "-v", "error", "-i", intro, "-vn", "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", iw])
        ia = load_wav(iw)
        need = intro_frames * SR // FPS
        ia = ia[:need] if len(ia) >= need else np.vstack([ia, np.zeros((need - len(ia), 2), np.int16)])
        full_a = os.path.join(cache, "full.wav")
        save_wav(full_a, np.vstack([ia, load_wav(os.path.join(cache, "body.wav"))]))
        dest = os.path.join(ROOT, "out/episode", f"{a.ep}-fringe-lines{'-blur' if blur else ''}.mp4")
        run(["ffmpeg", "-y", "-v", "error", "-i", full_v, "-i", full_a, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
             "-af", "volume=1.5dB,alimiter=limit=0.89:level=false", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dest + ".tmp.mp4"])
        os.replace(dest + ".tmp.mp4", dest)
        with open(os.path.join(ROOT, "out/episode", f"{a.ep}-chapters.txt"), "w") as f:
            f.write("\n".join(f"{t} {title}" for t, title in chapters) + "\n")
        print("wrote", dest)
        print("\n".join(f"{t} {title}" for t, title in chapters))


if __name__ == "__main__":
    main()
