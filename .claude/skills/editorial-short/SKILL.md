---
name: editorial-short
description: Make a Fringe Lines vertical short in the "editorial" style (paper background, speaker that morphs between full-bleed / card / round PiP, explainer graphics, word-by-word serif captions, hook + end card, SFX). Use when asked to make, restyle or fix a short from an episode.
---

# Editorial short (Fringe Lines)

The look is modeled on Greg Isenberg's shorts. Hold every short to it:

- Never sit on a talking head for more than ~6 s.
- A graphic or layout change lands every 3–5 s.
- Captions appear word by word, with a few orange italic keywords.
- Graphics follow what is being said, so a graphic lands on the word it illustrates.

## 0. Prerequisites (per machine)
- `pipeline/setup.sh` installs the venv `~/.shorts-skill` and the Remotion node_modules in `~/.cache/fringe-lines-video`.
- The episode transcripts must exist: `work/<ep>/words-quinn.json` and `words-doom.json` (from `pipeline/transcribe_verbatim.py`).
- Remotion source: `pipeline/remotion/src/ShortV2.tsx` (layout) and `Graphics.tsx` (graphic types).

## 1. Pick the moment (30–50 s)
- Search the word files for a self-contained take that has:
  - a strong opening line (claim, number, or confession);
  - one idea;
  - a payoff or punchline near the end.
- Good signals:
  - concrete numbers (percentages, dollar amounts, headcount);
  - named companies or products;
  - a contrarian take;
  - a personal experiment ("I let Codex…").
- Avoid clips that depend on earlier context ("like I said", "that thing").
- Several `--range`s may be stitched together. Cut at sentence ends, and check the seam doesn't repeat words.

## 2. Cut it
Add a line to `work/<ep>/shorts.sh` and run it:
```
b --name short-NN --range START:END [--range ...] --replace "27=>27%" --replace "claude=>Claude"
```
- `build_short.py` does the following:
  - removes fillers, stutters and long pauses;
  - picks the active camera;
  - writes `work/<ep>/short-NN/clip.mp4` and `props.json`;
  - renders the plain v1 short.
- `--replace` fixes caption text. An empty right-hand side hides that word.
  - Always fix: numbers ("27"→"27%"), product names (Claude, Codex, Descript, GTM, SQL), and Whisper mishearings.
- To get the exact output timings for writing the spec, print them:
  `python3 -c "import json;p=json.load(open('work/<ep>/short-NN/props.json'));print(' '.join(f\"{w['text']}@{w['startMs']/1000:.1f}\" for w in p['words']))"`

## 3. Write the style spec: `work/<ep>/short-NN/style.json`
```json
{
  "hook":  {"text": "Microsoft wants *27%* of its staff to quit", "end": 2.8},
  "outro": {"text": "Grow *without* growing *headcount*", "hold": 2.0},
  "emphasis": ["microsoft", "27%", "leave"],
  "scenes": [
    {"at": 0.0,  "mode": "full"},
    {"at": 3.0,  "mode": "graphic", "graphic": {"type": "stat", "kicker": "Microsoft buyout offer", "value": 27, "suffix": "%", "label": "of employees offered a payout to *leave*"}},
    {"at": 6.2,  "mode": "card"}
  ]
}
```
Times are seconds in the cut clip, taken from the word timings in step 2.

**Rules that keep it consistent:**
- **Structure:**
  - Scene 0 is always `full`, with a `hook` of 4–8 words that ends at ~2.5–3 s.
  - Say the claim; don't summarize the clip.
- **Rhythm:**
  - Alternate modes as `full` → `graphic` → `card` → `graphic` → `card` … with 3–6 graphics in a 40 s short.
  - Use `full` again for one punchy reaction or laugh in the second half.
- **Timing:**
  - Start each graphic 0.1–0.3 s **before** the word it illustrates, and keep it up 2.5–5 s.
  - Two graphics can follow each other directly, e.g. a $20 card then a $100 card.
- **Emphasis:** pick 10–18 keywords: numbers, names, and the punchline words. Matching is lower-case, ignoring punctuation.
- **Accents:** in any text field, `*word*` renders italic orange. Use one or two per string.
- **Outro:** a 2 s end card with a short line that restates the takeaway, or a question to the viewer.
- **Honesty:**
  - Numbers on screen must be what was said on the show.
  - Charts are schematic: use `lines` with shapes, never invented axes or values.
  - Hedge with "roughly" or "~" when the speaker did.

**Graphic types** (`Graphics.tsx`):

| type | fields | use for |
|---|---|---|
| `stat` | `kicker, prefix, value (number, counts up), decimals, suffix, label` | one headline number |
| `people` | `kicker, value (string), label, filled (0–1)` | headcount / share of people |
| `lines` | `kicker, series: [{label, shape: up\|flat\|down}], caption` | trend vs trend |
| `quote` | `text, by?` | the punchline, said on screen |
| `headline` | `source, title, highlight` | news, announcements, a "verdict" |
| `list` | `title, items[]` | steps, products, what went wrong |

If a new graphic type is needed, add it to `Graphics.tsx` and its union type. Keep the card style: white or ink card, 36px radius, a spring entrance, and an animation that runs off its local frame `f`.

## 4. Render
```
~/.shorts-skill/bin/python pipeline/style_short.py --ep <ep> --name short-NN --spec work/<ep>/short-NN/style.json
```
- The face track (`pipeline/face_track.py`, YuNet) is computed once and cached in `short-NN/faces.json`. It keeps the round PiP and card centred on the face; delete the file if the clip is re-cut.
- Sound effects are synthesized: a whoosh on each scene change and a pop when a graphic lands. They are mixed at `--sfx-db -20`.
- Loudness: −14 LUFS.
- Output: `out/shorts/<ep>-short-NN-v2.mp4`.

## 5. QA (always, before reporting)
Pull frames and look at them:
```
for t in 1.5 5 10 15 20 25 30 35 40; do ffmpeg -v error -y -ss $t -i out/shorts/<ep>-short-NN-v2.mp4 -frames:v 1 -vf scale=270:-1 /tmp/q_$t.png; done
```
Check each of these:
- **Hook:** readable, and not covering the face.
- **Graphics:** they don't overlap the caption block, which sits at y≈1340–1600. No text overflows a card. Long stat values like "+$500K" shrink automatically.
- **PiP:** the face is centred in the circle.
- **Captions:** no stray `*`; keywords render orange.
- **Loudness:** `ffmpeg -i out.mp4 -af ebur128 -f null - 2>&1 | grep " I:"` reads about −14.

Report to the user:
- What the short is about and its length.
- Any numbers to verify.
- Any explicit language left in.
