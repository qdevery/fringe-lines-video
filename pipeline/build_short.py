#!/usr/bin/env python3
"""Build one vertical short from the raw Descript multicam export.

  python3 pipeline/build_short.py --ep 2026-10-30 --name short-02 --range 1062.5:1101.0 [--range a:b ...] \
      [--replace "27=>27%" --replace "000=>"]   # caption text fixes; empty = hide word

Times are on the Descript *sequence* timeline (same clock as the .txt/.srt
transcript and work/<ep>/words-*.json). Steps:
  1. pick words in range; mark fillers (um/uh/...), stutter repeats and long pauses for removal
     (never cut while the other speaker is talking)
  2. assign each kept piece to the active speaker's camera (short interjections don't steal the shot)
  3. ffmpeg: extract a 9:16 crop of each camera + mixed/normalized studio-sound audio, then splice pieces
  4. remap word timings to the edited clip, write props.json, render captions/punch-ins with Remotion
"""
import argparse, json, os, re, subprocess, sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILLERS = {"um", "uh", "umm", "uhh", "uhm", "hmm", "mm", "mhm", "er", "erm", "ah"}
CAMS = {  # speaker -> (video file, studio audio file, crop x for 608px-wide 9:16 window of 1920)
    "Quinn": ("Quinn.mp4", "studio-sound-Quinn.m4a", 615),
    "Doom": ("Doom-1.mp4", "studio-sound-Doom-1.m4a", 635),
}
MAX_GAP, KEEP_GAP = 0.55, 0.18   # pauses longer than MAX_GAP shrink to 2*KEEP_GAP
MIN_SHOT = 1.2                   # seconds; shorter speaker turns don't switch camera
PUNCH = [1.0, 1.14]


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"command failed: {' '.join(cmd[:6])}...\n{r.stderr[-1500:]}")
    return r.stdout


def xml_offsets(xml_path):
    seq = ET.parse(xml_path).getroot().find("sequence")
    tb = int(seq.find("rate/timebase").text)
    return {c.find("name").text: int(c.find("start").text) / tb for c in seq.iter("clipitem")}


def merge(iv):
    out = []
    for a, b in sorted(iv):
        if out and a <= out[-1][1] + 1e-3:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def plan(words, t0, t1):
    W = sorted((w for w in words if w["end"] > t0 and w["start"] < t1), key=lambda w: w["start"])
    cuts = []
    for i, w in enumerate(W):
        near = W[max(0, i - 40): i + 40]  # sorted by start; overlapping words are always close by
        others = [o for o in near if o["speaker"] != w["speaker"] and o["end"] > w["start"] - 0.1 and o["start"] < w["end"] + 0.1]
        if others:
            continue
        nxt = next((x for x in W[i + 1:] if x["speaker"] == w["speaker"]), None)
        n = norm(w["word"])
        is_filler = n in FILLERS
        is_stutter = nxt is not None and n and norm(nxt["word"]) == n and nxt["start"] - w["end"] < 0.4 and len(n) <= 6
        if is_filler or is_stutter:
            end = min(nxt["start"], w["end"] + 0.3) if nxt else w["end"]
            cuts.append([w["start"], end])
            w["cut"] = True
    # long pauses (no one speaking)
    spans = merge([[max(w["start"], t0), min(w["end"], t1)] for w in W if not w.get("cut")])
    prev = t0
    for a, b in spans + [[t1, t1]]:
        if a - prev > MAX_GAP:
            cuts.append([prev + KEEP_GAP, a - KEEP_GAP])
        prev = max(prev, b)
    cuts = merge(cuts)
    keep, cur = [], t0
    for a, b in cuts:
        if a > cur + 0.08:
            keep.append([cur, a])
        cur = max(cur, b)
    if t1 > cur + 0.08:
        keep.append([cur, t1])
    return W, keep


def speaker_track(W, t0, t1):
    """List of [a, b, speaker] covering t0..t1, smoothing out short interjections."""
    turns = []
    for w in sorted((w for w in W if not w.get("cut")), key=lambda w: w["start"]):
        if turns and turns[-1][2] == w["speaker"]:
            turns[-1][1] = w["end"]
        else:
            turns.append([w["start"], w["end"], w["speaker"]])
    # drop short turns (absorbed by surrounding speaker)
    turns = [t for t in turns if t[1] - t[0] >= MIN_SHOT] or turns[:1]
    seg = []
    for i, (a, b, s) in enumerate(turns):
        start = t0 if i == 0 else a
        if seg and seg[-1][2] == s:
            continue
        if seg:
            seg[-1][1] = start
        seg.append([start, t1, s])
    return seg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ep", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--range", action="append", required=True, help="a:b sequence seconds; repeat to stitch")
    ap.add_argument("--replace", action="append", default=[], help="old=>new caption word fix (match ignores punctuation/case)")
    ap.add_argument("--raw", default=None, help="raw export folder (default: the one folder in inbox/raw/descript)")
    ap.add_argument("--no-render", action="store_true")
    a = ap.parse_args()

    raw = a.raw or next(os.path.join(ROOT, "inbox/raw/descript", d) for d in sorted(os.listdir(os.path.join(ROOT, "inbox/raw/descript")))
                        if os.path.isdir(os.path.join(ROOT, "inbox/raw/descript", d)))
    xml = next(os.path.join(raw, f) for f in os.listdir(raw) if f.endswith(".xml"))
    off = xml_offsets(xml)
    work = os.path.join(ROOT, "work", a.ep)
    out_dir = os.path.join(work, a.name)
    os.makedirs(out_dir, exist_ok=True)

    words = []
    for s in CAMS:
        words += json.load(open(os.path.join(work, f"words-{s.lower()}.json")))["words"]
    words.sort(key=lambda w: w["start"])

    ranges = [tuple(map(float, r.split(":"))) for r in a.range]
    t0, t1 = min(r[0] for r in ranges), max(r[1] for r in ranges)
    W, pieces = [], []  # pieces: [a, b, speaker]
    for ra, rb in ranges:
        Wr, keep = plan(words, ra, rb)
        W += [w for w in Wr if w not in W]
        track = speaker_track(Wr, ra, rb)
        for ka, kb in keep:
            for sa, sb, s in track:
                x, y = max(ka, sa), min(kb, sb)
                if y - x > 0.04:
                    pieces.append([x, y, s])
    W.sort(key=lambda w: w["start"])
    fixes = {norm(k): v for k, v in (r.split("=>", 1) for r in a.replace)}

    # 1) per-camera 9:16 window + mixed audio for [t0-pad, t1+pad]
    pad = 0.5
    w0, dur = t0 - pad, (t1 - t0) + 2 * pad
    for s, (vid, aud, cx) in CAMS.items():
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{w0 - off[vid]:.3f}", "-t", f"{dur:.3f}", "-i", os.path.join(raw, vid),
             "-an", "-vf", f"crop=608:1080:{cx}:0,scale=1080:1920:flags=lanczos,fps=30", "-c:v", "libx264", "-crf", "16",
             "-preset", "veryfast", os.path.join(out_dir, f"cam-{s}.mp4")])
    ain = []
    for s, (vid, aud, cx) in CAMS.items():
        ain += ["-ss", f"{w0 - off[aud]:.3f}", "-t", f"{dur:.3f}", "-i", os.path.join(raw, aud)]
    run(["ffmpeg", "-y", "-v", "error", *ain, "-filter_complex",
         "[0:a][1:a]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]", "-map", "[a]",
         "-c:a", "pcm_s16le", os.path.join(out_dir, "mix.wav")])

    # 2) splice
    names = list(CAMS)
    fc, labels = [], []
    for i, (pa, pb, s) in enumerate(pieces):
        x, y = pa - w0, pb - w0
        vi = names.index(s)
        fc.append(f"[{vi}:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS[v{i}]")
        fc.append(f"[{len(names)}:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,"
                  f"afade=t=out:st={max(0, y - x - 0.012):.3f}:d=0.012[a{i}]")
        labels.append(f"[v{i}][a{i}]")
    fc.append("".join(labels) + f"concat=n={len(pieces)}:v=1:a=1[v][a]")
    clip = os.path.join(out_dir, "clip.mp4")
    run(["ffmpeg", "-y", "-v", "error", *sum([["-i", os.path.join(out_dir, f"cam-{s}.mp4")] for s in names], []),
         "-i", os.path.join(out_dir, "mix.wav"), "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-c:a", "aac", "-b:a", "192k", clip])

    # 3) remap words + shots to output clock
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
    def on_cam(t):
        return next((s for pa, pb, s in pieces if pa <= t <= pb), None)
    cap = []
    for w in W:
        if w.get("cut") or not any(ra - 0.05 <= w["start"] and w["end"] <= rb + 0.3 for ra, rb in ranges):
            continue
        cam = on_cam((w["start"] + w["end"]) / 2)
        if cam and cam != w["speaker"] and any(o["speaker"] == cam and o["end"] > w["start"] - 0.15 and o["start"] < w["end"] + 0.15 for o in W):
            continue  # off-camera crosstalk: keep in audio, not in captions
        s, e = to_out(w["start"]), to_out(w["end"])
        if e - s < 0.03:
            continue
        text = fixes.get(norm(w["word"]), w["word"])
        if not text:
            continue
        cap.append({"text": text, "startMs": round(s * 1000), "endMs": round(e * 1000), "speaker": w["speaker"]})
    shots, acc, k = [], 0.0, 0
    for i, (pa, pb, s) in enumerate(pieces):
        # new shot (alternate punch-in) at every cut: speaker change or a jump cut
        if i == 0 or abs(pieces[i - 1][1] - pa) > 1e-3 or pieces[i - 1][2] != s:
            k += 1 if i else 0
            shots.append({"startMs": round(acc * 1000), "endMs": 0, "scale": PUNCH[k % 2]})
        acc += pb - pa
        shots[-1]["endMs"] = round(acc * 1000) + 1
    props = {"src": "clip.mp4", "durationInFrames": int(total * 30), "words": cap, "shots": shots}
    json.dump(props, open(os.path.join(out_dir, "props.json"), "w"), indent=1)
    for s in names:
        os.remove(os.path.join(out_dir, f"cam-{s}.mp4"))
    os.remove(os.path.join(out_dir, "mix.wav"))
    print(json.dumps({"name": a.name, "source": ranges, "duration": round(total, 2), "pieces": len(pieces),
                      "cuts_removed_s": round(sum(rb - ra for ra, rb in ranges) - total, 2), "words": len(cap),
                      "text": " ".join(c["text"] for c in cap)}))

    if not a.no_render:
        dest = os.path.join(ROOT, "out/shorts", f"{a.ep}-{a.name}.mp4")
        tmp = os.path.join(out_dir, "render.mp4")
        subprocess.run(["node", os.path.join(ROOT, "pipeline/remotion/render.mjs"), os.path.join(out_dir, "props.json"), tmp], check=True)
        # final loudness pass: -14 LUFS / -1.5 dBTP (platform target for shorts)
        run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
             "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dest])
        os.remove(tmp)
        print("wrote", dest)


if __name__ == "__main__":
    main()
