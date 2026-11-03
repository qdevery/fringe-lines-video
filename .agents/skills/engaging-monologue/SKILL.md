---
name: engaging-monologue
description: Make a 16:9 FringeLines "engaging monologue" video from a solo talking-head take — jump cuts with punch-ins, the speaker shrinking into a portrait picture-in-picture while serif kinetic text, diagrams (pyramid stack, compare, roadmap, steps, big stat) and b-roll cards build on a paper canvas, plus callout cards, lower thirds, chips, a CTA pill and a green end card, all synced word by word to the speech. Use for YouTube explainers, solo commentary, newsletter-to-video and "one idea, told well" pieces.
---

# Engaging monologue (16:9)

Reference: Ali Abdaal, "How I'd Create Content in 2026 (If I Had To Start Over)" (youtu.be/A8PxRHQrLJ8, 16 min, 1080p).
The motion language is copied from that video. The look is the **FringeLines v2.1 kit**:
`My Drive/FringeLines Design System files/Fringe Lines Design system v2_1/` and the tokens in `…/handoff/fringelines-tokens.css`.

## What makes the reference work
Measured from the video at 1 frame per 2 s, plus dense samples around transitions.

- **About 55% plain talking head.** One locked-off camera, mid-shot. Jump cuts every ~5 s (median): about 122 cuts in 16 min. Each cut alternates wide and punched-in, so the cuts read as intentional.
- **Two layouts, never more:**
  1. **Full-frame speaker** with things laid over it: name lower thirds, a coloured callout card top-left with a tiny label pill, white serif sentences at the bottom, small coloured chips near the head, and a sponsor/CTA pill at the bottom centre.
  2. **Paper canvas.** The speaker shrinks into a **portrait PiP** (rounded corners, white frame, right side, about 400×560) while a graphic builds on a warm off-white page with one faint swoosh. The canvas carries kinetic sentences, numbered roadmap cards, pill diagrams, pyramids, and screenshots or b-roll in rounded cards with a caption underneath.
- **No running captions.** On-screen text is *chosen*. One sentence at a time, revealed **word by word in time with the speech**. Each word starts faint and blurred, then sharpens. The key phrase changes colour.
- **Diagrams build piece by piece as each item is said.** Pills pop in with a little overshoot. Pyramid layers drop in from above.
- **The camera moves inside graphics.** The 5-card roadmap returns at each chapter, zooms into the active card and blurs the others.
- **Exits blur out** rather than cut. The full↔PiP change is a quick eased morph of about 0.4 s.
- **Rhythm:** a new visual idea every 10–20 s, one emphasis moment (black-and-white) per section, and a lower third the first time each person appears.
- **Sound:** soft whooshes on layout changes and light pops when items land, kept well under the voice.

## How it maps onto FringeLines (don't drift from this)
| Reference | FringeLines version |
|---|---|
| Warm serif with coral highlights | **Instrument Serif** for all display text. The highlight is an *italic* phrase, ink-blue `#1A4F6B` on paper or white on video. **Orange `#D4622A` only for the one number that matters** (`[7 AM]`, the stat). |
| Rounded sans in pills | **Archivo** 500–600 for pills, chips, list items, stack labels |
| Small caps labels | **IBM Plex Mono** 600, uppercase, +0.14em, ≥ 22 px: eyebrows, label pills, sources, meta |
| Coral/red gradient callouts | Kit gradients: **green** (default), **blue** (second idea), **orange** (warning or "mistake") |
| Pastel roadmap cards | Green, blue and orange *washes*, a mono number badge and a dashed orange connector |
| Cream paper + swoosh | Paper `#F7F7F5` with one faint green-wash swoosh |
| Drop shadows | **None.** Flat surfaces, 2 px hairlines `#E3E5DF`, a white frame on the PiP, radius 16–18 |
| Sponsor pill | White CTA pill (fringelines.co / newsletter) with an orange mono "Link in description" tab |
| Channel outro | **Green end card**, the Clip Slides cover: mono eyebrow, orange rule, serif headline with one italic phrase, Archivo sub, `● fringelines.co` |

The kit rules still apply:
- one idea per screen;
- one orange per screen;
- green is the default, blue the comparison;
- every stat has a `source`;
- nothing below 22 px.

## Pieces
- **Template:** `pipeline/remotion/src/Monologue.tsx`, the `Monologue` composition at 1920×1080 / 30 fps. It reuses the face tracking from `ShortV2.tsx`.
- **Build:** `pipeline/build_monologue.py`, which has two steps, `cut` and `render`.
- **Work folder:** `work/monologue/<slug>/` holds `clip.mp4`, `props.json`, `transcript.txt`, `beats.json` and `faces.json`.
- **Output:** `out/monologue/<slug>.mp4`, normalised to −14 LUFS.
- **Worked example:** `work/monologue/morning-loop-test/beats.json`, a 62 s clip of Quinn from the Oct 30 episode.

## 1. Get a take
A single-camera 16:9 recording with good audio, one person, roughly 1–15 min. Put it in `inbox/monologue/<slug>/take.mp4`.

To pull a solo stretch from an episode, mux the camera with its studio-sound track. Take the offsets from the Descript XML with `build_short.xml_offsets`; see how `morning-loop-test` was made:
```
ffmpeg -ss <t0-videoOffset> -t <dur> -i Quinn.mp4 -ss <t0-audioOffset> -t <dur> -i studio-sound-Quinn.m4a -map 0:v -map 1:a … take.mp4
```

## 2. Cut
```
~/.shorts-skill/bin/python pipeline/build_monologue.py cut --slug <slug> --src inbox/monologue/<slug>/take.mp4 \
    [--range 12.0:95.5 --range 120:180] [--replace "gtm=>GTM" --replace "quick=>Quick"]
```
What the cut step does:
1. Transcribes the take with Whisper (cached in `words-src.json`).
2. Removes fillers, stutters and long pauses, using the same planner as the shorts.
3. Alternates the punch-in (1.0 / 1.12, centred on the face) at each jump cut.
4. Writes `transcript.txt`, with `word@seconds` on the **cut** clock.

`--replace` only fixes the words used to time the reveals; nothing is captioned automatically.

## 3. Write `work/monologue/<slug>/beats.json`
Read `transcript.txt` and plan the beats against it.

```json
{"brand": "FringeLines", "beats": [
  {"type": "title",   "at": 0.2,  "end": 2.0,  "eyebrow": "FringeLines · Monologue", "text": "The *morning loop*"},
  {"type": "name",    "at": 2.1,  "end": 5.4,  "text": "Quinn", "role": "Host · Fringe Lines"},
  {"type": "chips",   "at": 3.0,  "end": 7.4,  "items": [{"text": "GTM loops", "at": 3.1}, {"text": "Coding loops", "at": 5.1, "tone": "blue"}]},
  {"type": "text",    "at": 7.6,  "end": 11.3, "eyebrow": "What's a loop?", "text": "Loop's just a *stated goal* and then it works *autonomously*"},
  {"type": "callout", "at": 11.5, "end": 16.2, "label": "The setup", "tone": "green", "text": "I use Quick Desktop with routines that execute at any time"},
  {"type": "overlay", "at": 16.4, "end": 18.3, "text": "I usually run it at [7 AM]"},
  {"type": "stack",   "at": 22.4, "end": 36.4, "title": "My core team · 4 people", "items": [{"text": "Account executive", "at": 25.6}, "…"]},
  {"type": "stat",    "at": 51.2, "end": 55.1, "kicker": "My regular account team", "value": 14, "text": "people I'm interacting with on a regular basis", "source": "Quinn's own count · Fringe Lines, Oct 30 2026"},
  {"type": "end",     "at": 58.4, "end": 61.4, "text": "Building the *morning loop*", "sub": "The full walkthrough is in this week's episode."}
]}
```

**Times**
- Times are seconds on the cut clip. `end` (or `hold`) closes a beat, and its exit blurs out over 0.3 s.
- Text is revealed **word by word in sync with the speech**. Every word in `text` is matched to the transcript inside the beat's window.
  - Quote the speaker verbatim (light trims are fine) so the sync works.
  - If the text is a paraphrase, the reveal falls back to an even spread. Force that with `"reveal": "even"`.
- Item `at` times default to an even stagger. Set them to the moment each item is *said*, about 0.1 s before the word.

**Markup**
- `*italic highlight*`: one phrase per screen.
- `[accent number]`: orange, one per screen, numbers only.

### Beat types
**Speaker full-frame (overlays):**
| type | fields | use |
|---|---|---|
| `title` | `text, eyebrow?` | Cold-open title over a dimmed frame (first 2–3 s) |
| `name` | `text, role?` | Lower third the first time a person appears |
| `overlay` | `text` | One spoken sentence in white serif at the bottom: the line you want remembered |
| `callout` | `text, label?, tone?, side?` | Coloured card top-left (or right) with a mono label pill: "Mistake #1", "The setup", "Rule" |
| `chips` | `items[{text, at, tone?}], side?, tone?` | 2–3 short tags popping in beside the head: inner voice, names, options |
| `cta` | `text, sub?` | Bottom pill: the newsletter, the episode or the offer. Once, usually mid-video |
| `bw` | (none) | Black-and-white emphasis on the speaker; pair it with an `overlay` |
| `media` + `"full": true` | `src, video?, from?` | Full-bleed b-roll with the speaker in the PiP |

**Paper canvas (the speaker moves to the PiP):**
| type | fields | use |
|---|---|---|
| `text` | `text, eyebrow?, align?` | A kinetic sentence: definitions, the thesis, the "single most important…" line |
| `stack` | `items[{text, at, tone?}]` (bottom→top), `title?` | Pyramid or layers: foundations → strategy → payoff, team layers |
| `compare` | `title?, left{label, items}, right{label, items}, winner?` | A vs B: hobby vs revenue, before vs after. The loser greys out near the end |
| `roadmap` | `items[{text}]` (≤6), `active?, zoom?` | The video's chapters. Show once at the start, then reuse it per chapter with `active` = the chapter index and `zoom` = when to zoom in |
| `steps` | `items[{text, at}], title?` | A numbered list with hairline rules: specialists, tools, steps |
| `stat` | `value, prefix?, suffix?, decimals?, kicker?, text, source` | One number counting up in orange; **source required** |
| `media` | `src, title?, meta?, video?, from?` | A screenshot or b-roll in a rounded card with a caption (title + mono meta line). Files go in the work folder |
| `end` | `text, eyebrow?, sub?, url?, tone?` | The green end card (2–4 s) |

Paper beats less than 0.7 s apart stay in the PiP layout, so the speaker doesn't bounce.

### Pacing rules (from the reference)
- Open with a `title` and a `name`, both inside the first 5 s.
- **Paper beats take 35–45% of the runtime.** Never go more than ~20 s without a visual change, and never stay on paper longer than ~15 s.
- Alternate the two layouts. Don't run two `callout`s back to back; put a `text` or a diagram between them.
- **One idea per beat.** Keep `text` beats to ≤ 14 words and callouts to ≤ 16.
- Diagram items land **on the word**, never all at once. A diagram's first item should land within ~1 s of the beat starting; otherwise the beat starts later.
- Sections:
  - Show a `roadmap` at the end of the intro.
  - Reuse it at each section start with `active` set.
  - Close each section with an `overlay` of its key line, with `bw` for the biggest one.
- One `cta` per 5 min at most, never in the first 30 s.
- End on the `end` card. It can run past the last word.

### Honesty
- Numbers on screen must be what was said, or come from a named source in `source`.
- Screenshots of other people's content need credit in `meta`.
- Don't put words in the speaker's mouth: an `overlay` or `text` beat that isn't a quote should read as a label, not as speech.

## 4. Render
```
~/.shorts-skill/bin/python pipeline/build_monologue.py render --slug <slug> [--sfx-db -22]
```
- It tracks the face once (`faces.json`; delete it if you re-cut).
- Rendering time grows with the video length; a 1-min test took a few minutes on the Mac mini.
- Sound effects: a whoosh on each layout change, a pop when an item lands, a riser into the title and end cards. Raise `--sfx-db` toward −18 for more energy.

## 5. QA (always)
```
for t in 1.5 5 10 20 30 40 50 60; do ffmpeg -v error -y -ss $t -i out/monologue/<slug>.mp4 -frames:v 1 -vf scale=640:-1 /tmp/m_$t.png; done
```
Check each of these:
- **Text:** no text runs under the PiP (the paper area ends at x = 1320). Stack labels fit on one line.
- **Highlights:** no stray `*` or `[`. There is at most one orange per screen.
- **Face framing:** the face is centred in the PiP, and the punch-ins don't cut off the head.
- **Reveal timing:** reveals land on the spoken word. If a beat shows faint words for a long time, its `at` is too early.
- **Loudness:** `ffmpeg -i out.mp4 -af ebur128 -f null - 2>&1 | grep " I:"` reads about −14.

Report to the user:
- the runtime and the beat list (time → type → text);
- what still needs checking: numbers, names and screenshot credits;
- any beat that fell back to an even reveal, because its text wasn't verbatim.

## Not built yet
- A **9:16 version**: the composition is 16:9 only. For vertical, cut a short with the `editorial-short` skill.
- **Auto-planning:** writing `beats.json` is a judgment call, so it's done by hand or by Claude from `transcript.txt`.
