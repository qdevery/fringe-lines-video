---
name: how-to-screen-share
description: Make a 16:9 FringeLines how-to / walkthrough video from a camera take plus a screen recording — full-frame speaker with white pills stacking as points are made, the screen recording on a paper canvas with zoom/pan to what's being explained, drawn-on highlight boxes, blurred private details and app tiles, plus flow diagrams, check tables, numbered lists, serif chapter cards and a green end card. Use when someone explains how they did something while screen sharing (a process, a tool setup, a demo, a slide walkthrough), from a Descript timeline export or a separate take + screen file.
---

# How-to screen share (16:9)

Reference: Elisa, "STOP Using Grok Bot Like ChatGPT" (youtube.com/watch?v=wC7kViCM6D4, 14.6 min, 1080p30).
The motion language is copied from that video. The look is the **FringeLines v2.1 kit**, the same one the engaging-monologue skill uses:
`My Drive/FringeLines Design System files/Fringe Lines Design system v2_1/` and the tokens in `…/handoff/fringelines-tokens.css`.

## What makes the reference work
- **Camera about 70% of the time, screen and diagrams about 30%.** Measured: 31 paper/screen runs, median 7 s, longest 32 s. Camera runs have a median of 13 s. Cuts every ~7 s, alternating wide and punched-in.
- **The speaker never shrinks while explaining a point on camera.** Points become **white pills stacking top-left** (icon in a coloured circle + bold sans label). Earlier pills stay; the whole stack blurs out together. ✗ pills for problems, ✓ pills for fixes.
- **When the screen matters, the camera dissolves to a warm paper canvas.** The screen recording sits in a rounded white card with the app's icon tile in the corner. The "camera" then **zooms and pans** to the part being talked about (often so far the card runs off-frame), and an **outlined box draws on** around the exact button or row. Private details are **blurred**.
- **Concepts get a quick diagram on the same canvas:** nodes with arrows that draw in (and branch), a two-column check table with the winning column outlined, numbered cards for "the 4 mistakes".
- **Chapter cards:** big serif caps title rising from behind a short rule, with a small tag ("MISTAKE 4") under it.
- **Small floating UI cards** over the camera: a prompt being typed, a terminal, a big number ("10 *minutes*", "1 job *4 fixes*").
- No running captions. Soft whooshes into and out of the canvas, pops as items land.

## How it maps to FringeLines v2.1
| Reference | FringeLines version |
|---|---|
| Orange icon circles on white pills | ✓ green `#3D8A63`, ✗ blue `#1A4F6B`, numbers green; Archivo 600 labels; hairline `#E3E5DF` border, no shadow |
| Cream canvas with a peach glow | Flat paper `#F7F7F5` |
| Orange outline around the UI element | Green outline (drawn on) with a soft green fill; optional green label pill; or an underline |
| App logo tile | White 92 px tile with a hairline; a PNG/SVG logo or 2–4 mono letters; mono label chip beside it |
| Serif caps chapter title in orange + orange tag | Instrument Serif in ink, one *italic blue* word, green rule, green mono tag |
| Big number in the corner | Instrument Serif, the number in **orange** (the one number that matters), unit in italic |
| Highlighted table column | Soft green panel `#E8F0EA` with a green outline; ✓ green, ✗ hairline circles |
| End | Green Clip Slides end card with `● fringelines.co` |

Orange stays for numbers only. Green is the "do this / this is the fix" colour; blue is the "before / problem" side.

## Pieces
- Template: `pipeline/remotion/src/Walkthrough.tsx` (Remotion `Walkthrough` composition, 1920×1080, 30 fps). It reuses the kit, fonts, word reveal, title, name, CTA and end card from `Monologue.tsx`.
- Build: `pipeline/build_walkthrough.py` with `prep`, `cut`, `frames`, `render`. The cut step is shared with `build_monologue.py`.
- Folders: inputs in `inbox/walkthrough/<slug>/`; work in `work/walkthrough/<slug>/`; output `out/walkthrough/<slug>.mp4`.

## 1. Get the footage in
The camera and the screen must be **on the same clock**. Two ways:

**A. Descript timeline export (what Fringe Lines records).** Put the whole export folder (the `.xml`, the `<Speaker>.mp4` camera files, `studio-sound-*.m4a` and the `*screen*.mp4` files) in `inbox/walkthrough/<slug>/`, then:
```
~/.shorts-skill/bin/python pipeline/build_walkthrough.py prep --slug <slug> \
    --descript "inbox/walkthrough/<slug>/<export folder>" --speaker Quinn [--from 120 --to 780]
```
`--from/--to` are seconds on the Descript sequence clock (default: the speaker's whole clip). It writes `take.mp4` (camera + studio sound), `screen.mp4` (every screen clip placed at its timeline position, paper-coloured where there's no screen) and `screen.json` (where the screen exists). These go in `work/walkthrough/<slug>/src/`, not the inbox: the inbox only holds what you dropped in.

**B. Separate files.** `take.mp4` (camera with good audio) and `screen.mp4` (screen recording) in `inbox/walkthrough/<slug>/`. If they didn't start together, pass `--screen-offset S` to `cut`, where screen time = take time + S (clap or click on camera to find it).

A single file with the screen and face already composited won't work well: zooms would zoom the face too, and the camera can't punch in.

## 2. Cut
```
~/.shorts-skill/bin/python pipeline/build_walkthrough.py cut --slug <slug> \
    [--range 0:62 --range 70:400] [--replace "clay=>Clay" --replace "cloud=>Claude"] [--screen-offset 0]
```
- Transcribes the take (cached in `words-src.json`), removes fillers, stutters and long pauses, and cuts the **camera and the screen track identically, frame-exact** (no drift however many cuts).
- Writes `clip.mp4`, `screen.mp4` (cut), `props.json`, and `transcript.txt` (`word@seconds` on the cut clock). Prints where the screen exists on the cut clock.
- Jump cuts alternate wide / punched-in automatically.

## 3. Pick the boxes
Zooms, marks and blurs use boxes `[x, y, w, h]` as **0–1 fractions of the screen recording**. Get stills with a 10% grid:
```
~/.shorts-skill/bin/python pipeline/build_walkthrough.py frames --slug <slug> --at 31.5 --at 48 --at 120
```
→ `work/walkthrough/<slug>/frames/screen-<t>.png` (orange lines every 0.1; the 0.5 lines are thicker). Read them and estimate boxes. Check a still at every focus change: the screen may have scrolled or switched apps.

## 4. Write `work/walkthrough/<slug>/beats.json`
Times are seconds on the cut clock (`transcript.txt`). Every beat has `at` and `end` (or `hold`). Text markup: `*italic*` (blue on paper, white on camera), `[number]` (orange; one per screen, numbers only). Words reveal in sync with speech where the text matches what's said.

```json
{"brand": "FringeLines", "beats": [
  {"type": "title", "at": 0.2, "end": 2.7, "eyebrow": "FringeLines · How-to", "text": "How I built an AI *morning brief*"},
  {"type": "pills", "at": 3.2, "end": 12.2, "items": [
    {"text": "Missed meeting recordings", "icon": "x", "at": 3.3},
    {"text": "A loop that runs *every morning*", "icon": "check", "at": 8.0}]},
  {"type": "chapter", "at": 19.5, "end": 21.1, "eyebrow": "Step 1", "text": "The *architecture*"},
  {"type": "screen", "at": 21.2, "end": 78.4, "apps": ["PPT"], "eyebrow": "The Morning Loop · architecture",
   "focus": [{"at": 21.2, "box": [0.08, 0.12, 0.85, 0.85]}, {"at": 24.1, "box": [0.11, 0.34, 0.21, 0.56]}],
   "marks": [{"at": 31.1, "end": 36.7, "box": [0.135, 0.625, 0.075, 0.05], "label": "Any comms channel"}],
   "blur": [{"box": [0.42, 0.0, 0.16, 0.035]}]},
  {"type": "end", "at": 82.8, "end": 86.4, "text": "Build your own *morning brief*", "sub": "The full episode is at fringelines.co"}
]}
```

**Camera beats** (speaker full-frame)
| type | fields | notes |
|---|---|---|
| `title` | `text, eyebrow?` | Serif title over a darkened frame, first 2–3 s |
| `name` | `text, role?` | Lower third, bottom-left |
| `pills` | `items[{text, icon?, logo?, tone?, at?}], side?` | Stack top-left (or `side: "right"`). `icon`: `check` (green), `x` (blue), `arrow`, `dot`, or a number. `logo`: the company's logo tile (with `icon` it sits beside the ✓/✗). 2–4 pills, 2–6 words each |
| `logos` | `items[{text, logo?, at?}], label?, side?` | A row of logo tiles (logo + name), each landing on its name: "Instantly, Apollo, Clay…". Tiles keep their slots, so the row reads in spoken order on either side. A mono `label` chip above names the group. 2–6 tiles |
| `big` | `text, sub?, side?` | Corner figure: `"[10] *minutes*"`, mono `sub` under it. A dark corner gradient keeps it readable |
| `card` | `text, label?, logo?, side?, typing?` | Floating white UI card; the text types itself (a prompt, a command). Use `side: "right"` when pills are up |
| `cta` | `text, sub?` | Bottom pill |
| `end` | `text, eyebrow?, sub?, url?` | Green end card |

**Paper beats** (camera dissolves to the canvas; back-to-back paper beats share it without flicker)
| type | fields | notes |
|---|---|---|
| `screen` | `focus?, marks?, blur?, apps?, eyebrow?, pip?, from?` | The screen card. `focus[{at, box}]`: the camera eases to fit the box (max 3× zoom), and the first one usually shows the whole useful area. `marks[{at, end?, box, label?, kind?}]`: green outline draws on (`kind: "underline"` for a line under text). `blur[{box, at?, end?}]`: frosted box over emails, names, keys. `apps`: tile labels or logo files in the work folder (`"apps": ["logos/clay.png"]`). `pip: true` keeps the speaker in a round bubble bottom-right. `from`: play the screen track from this second instead of in sync (rarely needed) |
| `flow` | `items[{text, sub?, icon?, logo?, at?}], title?` | 2–4 nodes left to right; arrows draw before each node; the newest is outlined green |
| `table` | `columns[2], rows[{text, values[bool, bool], at?}], highlight?, title?` | Check table; `highlight` (default 1) is the outlined column |
| `list` | `items[{text, sub?, icon?, logo?, at?}], title?` | Numbered cards stacked vertically |
| `chapter` | `text, eyebrow?` | Chapter card between sections; 1.5–2.5 s |

Item `at` times default to an even stagger across the beat.

### Company logos (camera overlays)
When the speaker names a company or tool while on camera, show its logo. Logos go on the **talking-head overlays and paper diagrams only, never on the screen recording**: the screen already shows the real product.

1. List the companies said on camera from `transcript.txt` (tools, vendors, data sources, platforms).
2. Get each into the shared library (`assets/logos/`, reused across videos), once:
   ```
   ~/.shorts-skill/bin/python pipeline/logos.py list
   ~/.shorts-skill/bin/python pipeline/logos.py fetch apollo --domain apollo.io --name Apollo [--alias "apollo.io"]
   ~/.shorts-skill/bin/python pipeline/logos.py scan --transcript work/walkthrough/<slug>/transcript.txt   # library logos said, with times
   ~/.shorts-skill/bin/python pipeline/logos.py sheet                                                  # QA every logo in its tile
   ```
   `fetch` takes the icon the company's own site declares: its biggest PNG of at least 128 px, else Google's favicon service, else an SVG. Add `--alias` for how the transcript spells it (`--alias hayreach`). When a site only has a small favicon (Lemlist) or blocks the request (LinkedIn), download the mark from their brand or press page and pass `--file <path or url>`. If you can't get one, leave `logo` off: the logo row shows the company's initial, and pills keep their icon.
3. Reference logos by library key, name or alias: `"logo": "apollo"`. The build copies them into the work folder.

The `card` logo replaces its green dot. In `flow` and `list`, a logo replaces the number circle ("Apollo → Clay → Sheet").

### Pacing rules (from the reference)
- **Screen when it helps, not because it exists.** Show the screen when the words point at it ("here's the…", "click…", "you can see…"). Go back to camera for opinions, stories and "why".
- **One focus per idea.** A new `focus` when the speaker moves to a new part of the screen; hold it for at least 2.5 s. Start each screen beat on an overview, end on an overview if the next thing is camera.
- **Marks name the thing being said**, on the word. Labels are 2–4 words and say *why* it matters, not what the button says.
- Long screen stretches (40 s+) are fine if the focus moves every 5–10 s; otherwise break with a camera stretch or a diagram.
- Pills: one per point, on the word, max 4 in a stack. ✗ for the problem, ✓ for the fix.
- Chapters only for real sections (Step 1/2/3, Mistake 1–4). 3–6 per video.
- A diagram (flow/table/list) when the speaker summarises; keep it 4–10 s.

### Honesty and privacy
- Blur **every** email address, customer name, API key, phone number, private doc title and internal URL that appears on screen. Scrub through `frames` stills of every screen stretch to find them, including moments mid-scroll.
- Diagram and table claims must be things the speaker said. Numbers need a source.
- Third-party logos (`apps`, `logo`, `logos`) are fine as labels for tools the speaker names. Don't make them look like an endorsement or a partnership, and don't show a logo for a company the speaker didn't name.

## 5. Render
```
~/.shorts-skill/bin/python pipeline/build_walkthrough.py render --slug <slug> [--sfx-db -22]
```
Face-tracks the camera (cached `faces.json`), renders `Walkthrough`, adds sound effects (whoosh in/out of the canvas, a soft whoosh on each zoom, pops on items and marks, a riser on chapter and end cards) and normalises to −14 LUFS → `out/walkthrough/<slug>.mp4`. About 2 min of render per 1.5 min of video on the Mac mini.

**Check stills first** (much faster than a render):
```
~/.shorts-skill/bin/python pipeline/build_walkthrough.py render --slug <slug> --stills 22.5,40,57.5,70
```
→ `work/walkthrough/<slug>/stills/<t>.png`.

## 6. QA
Contact sheet of the output:
```
ffmpeg -v error -y -i out/walkthrough/<slug>.mp4 -vf "fps=1/4,scale=480:-1,tile=4x6" -frames:v 1 /tmp/sheet.png
```
Check:
- **The screen matches the words**: at each focus and mark, the thing named is in frame and the box sits on it (screens scroll; re-check with `frames`).
- Nothing private is readable anywhere, zoomed or not.
- Labels don't hide what they point at; move the box or drop the label.
- Pills and logo rows never cover the face (switch `side`; the face sits off-centre in punched-in shots).
- Every logo is the right company and reads at size (`logos.py sheet`); none sits over the screen recording.
- No stray `*` or `[`; at most one orange per screen.
- Loudness about −14 LUFS: `ffmpeg -nostats -i <out> -af ebur128 -f null - 2>&1 | grep " I:"`.

Report to the user: duration, the chapter list, each screen stretch and what it zooms to, what was blurred, and anything to double-check (numbers, names, private info).

## Test
`work/walkthrough/morning-brief-test/beats.json`: Quinn's Morning Loop architecture slide from the Oct 30 episode (sequence 255–348.5 s), made with `prep` from the Descript export. 86.7 s, −14.1 LUFS. It uses title, name, pills, card, table, chapter, screen (focus, marks, labels, underline, blur), flow and end. `big`, `list` and `pip: true` were checked as stills only; `cta` comes from the monologue template.

## Not built yet
- 9:16 (use the `howto-short` skill for vertical).
- Automatic beat planning and automatic box finding: boxes are picked by eye from `frames` stills.
- Cursor-following zoom: the zoom goes where `focus` says, not where the mouse is.
