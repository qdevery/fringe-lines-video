---
name: howto-short
description: Make a Fringe Lines "how-to" vertical short from a screen-share moment (screen on top that pans/zooms to what's being explained, speaker face-tracked below, captions on the seam, typed title, follow-for-more end). Use when a moment in an episode walks through a slide, chart, app or demo.
---

# How-to short (screen on top, speaker below)

The look is modeled on the "How to automate Google Sheets with AI" short. The rules:

- The screen is always readable, so zoom into the part being discussed.
- The camera move happens **on the word** that names it.
- An orange box marks the exact thing, and a numbered chip says where we are ("1 · Sources").

## 1. Find a moment
- Screen shares are the `Quinn's screen*.mp4` clipitems in the Descript XML. `build_howto.py` picks the one that overlaps your range automatically.
- Good how-tos:
  - a walkthrough of a system or slide ("here's the architecture");
  - a chart read-through ("headcount flat, revenue up");
  - a demo.
- Aim for 30–75 s.
- You may stitch a lead-in from just before the share, e.g. "what if I just set up this loop…", as the hook. The first screen frame stays on screen during it.
- Drop "let me pull this up", "sorry, asking Codex", and dead air: list several `ranges`, cut at sentence ends.
- Get exact word times from `work/<ep>/words-*.json`.

## 2. Map the screen
Make a contact sheet of the screen file. Then read the coordinates of each region you will talk about as normalized `[x, y, w, h]` (0–1 of the screen frame):
```
ffmpeg -i "<raw>/Quinn's screen-3.mp4" -vf "fps=1/10,scale=480:-1,tile=4x2" -frames:v 1 /tmp/sheet.png
```
- Tile pixel ÷ tile width (or height) gives the normalized value.
- Then check a full-resolution frame.
- `clip` hides browser chrome or app toolbars, e.g. `[0, 0.105, 1, 0.895]` for a Chrome window or the slide rectangle for PowerPoint.

## 3. Spec: `work/<ep>/howto-NN/howto.json`
```json
{
  "name": "howto-02",
  "ranges": [[2158.6, 2192.2]],
  "replace": {"capex": "CapEx"},
  "title": "Microsoft is doing *more with less*",
  "kicker": "Fringe Lines · Chart breakdown",
  "clip": [0, 0.105, 1, 0.895],
  "focus": [
    {"at": 0, "box": [0.04, 0.21, 0.92, 0.68]},
    {"on": "headcount", "box": [0.42, 0.28, 0.5, 0.58], "label": "Headcount: flat", "mark": [0.63, 0.36, 0.21, 0.45]},
    {"on": "doing", "box": [0.04, 0.21, 0.92, 0.68], "label": "More with less"}
  ]
}
```
- **`focus` keys:**
  - The first key is `{"at": 0}` with the whole slide or chart.
  - `on` = the first caption word matching it after the previous key. The pan starts 0.25 s before that word and takes 0.7 s.
- **`box`:** the region to fill the top panel (1080×~860).
  - Boxes with an aspect ratio near 1.25 fill best.
  - Use boxes of about 35–55% of the screen width for detail. Smaller boxes look blurry, because screen recordings are only ~1600 px wide.
- **`mark`:** an orange outline around the thing being named. Keep it inside the box.
- **`label`:** a short chip. Number the steps in walkthroughs ("1 · Sources") and state the finding in chart breakdowns ("Headcount: flat").
- **Pacing:** a new key every 4–10 s. Return to the full view for the closing line.
- **`title`:** 5–9 words, with the payoff in `*italics*`. It is typed on screen over the first 3.2 s (`title_end` changes that).
- **`replace`:** fixes caption text: money (`"1000": "$1,000"`), product names, "two X" → "2x".

## 4. Build
```
~/.shorts-skill/bin/python pipeline/build_howto.py --ep <ep> --spec work/<ep>/howto-NN/howto.json
```
- What it does:
  - removes fillers and pauses;
  - follows the active speaker's camera, full 16:9 frame, face-tracked into the bottom panel;
  - splices the screen recording with the same cuts, so it stays in sync;
  - adds a pop on the title and a whoosh on each pan;
  - normalizes loudness to −14 LUFS.
- The final 2.6 s shows "Follow for *more*" with a drawn arrow.
- Output: `out/shorts/<ep>-howto-NN.mp4`.

## 5. QA
Pull a frame at the title (1 s) and at each focus key (+1 s), then check:
- Each mark sits on the right row, bar or column. Fix the coordinates and rebuild if not; the build takes about 1–2 min.
- No browser or app chrome shows (adjust `clip`).
- The face sits upper-centre in the bottom half.
- The seam captions are readable.

Report to the user:
- the length and topic;
- any number in the captions that came from speech (it may be misheard);
- any profanity left in.
