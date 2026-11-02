# Video Editing Pilot: status

Read this first when resuming on any machine. Update it at the end of each session.

## Setup (once per machine)
```bash
bash pipeline/setup.sh     # Python venv ~/.shorts-skill + Remotion node_modules in ~/.cache (outside Drive)
```
Needs ffmpeg, node, jq (`brew install ffmpeg node jq`).

## Pipeline
| Step | Command | Output |
|---|---|---|
| 1. Word-level transcripts (per speaker, keeps um/uh) | `~/.shorts-skill/bin/python pipeline/transcribe_verbatim.py <studio-sound.m4a> --speaker Quinn --offset <xml start s> --output work/<ep>/words-quinn.json` | `work/<ep>/words-*.json` |
| 2. Short | `~/.shorts-skill/bin/python pipeline/build_short.py --ep <ep> --name short-0N --range a:b [--range c:d] [--replace "old=>new"]` (cut list: `work/<ep>/shorts.sh`) | `out/shorts/<ep>-short-0N.mp4` |
| 3. Full episode | edit `work/<ep>/episode.json` (intro clips, chapters, names; located by spoken phrase), then `~/.shorts-skill/bin/python pipeline/build_episode.py --ep <ep>` (`--stage plan` to preview cuts) | `out/episode/<ep>-fringe-lines.mp4` + `<ep>-chapters.txt` |

`build_short.py`: active-speaker camera switching, punch-in on every cut, um/uh/stutter/long-pause removal
(never during crosstalk), both studio-sound tracks mixed, -14 LUFS, captions in Montserrat Bold
uppercase with the active word in orange #FF5A1F (Remotion 4.0.535, `pipeline/remotion`).
Times are on the Descript sequence clock (same as the .txt transcript).

Cameras: `Quinn.mp4` = Quinn (glasses, headphones). `Doom-1.mp4` = Doom.

## Episode 2026-10-30 (raw in `inbox/raw/descript/Fringe Lines Oct 30th Raw/`)
- [x] short-01: Anthropic 900% revenue retention (made on laptop, 2026-10-30)
- [x] short-02: Microsoft "grow without growing headcount" (782.4–833.8)
- [x] short-03: GTM subscription "death by paper cuts" (1071.2–1108.8)
- [x] short-04: "I'd be token maxing" (3 ranges, 1386–1475)
- [x] short-05: AI video editing burned Descript credits (1477.3–1523.8)
- [x] Full episode (2026-10-31): 45:20 = 42.5s highlight cold open + title card, then body with 174 filler/stutter words and 3.6 min dead air removed,
      active-speaker cameras + split screen, 5 screen shares at XML times with speaker PiP, name + 12 topic lower-thirds, -15.6 LUFS.
      YouTube chapters in out/episode/2026-10-30-chapters.txt. Scratch (7.7 GB) in ~/.cache/fringe-lines-video/work/ (safe to delete).
- Unused short ideas: Google search vs AI mode (~1690), butterbeer via ChatGPT (~1795), Databricks "more SQL from agents than humans" (~950), "father-in-law has no AWS app" (~2640)

## Known issues
- Remotion must run with cwd = pipeline/remotion (render.mjs chdirs itself); otherwise "root component" timeout.
- ffmpeg: don't use the concat *filter* or a long chained overlay pass for the episode. Join with the concat demuxer
  and burn lower-thirds per segment (both already in build_episode.py).
- PyAV 19 breaks faster-whisper's decoder; `transcribe_verbatim.py` decodes with ffmpeg instead.
- No brand assets (logo/colors/fonts) in the project yet; using short-01's look.

## v2 "editorial" style (2026-11-01), modeled on Greg Isenberg's shorts and intros
- **Shorts:** `pipeline/style_short.py --ep <ep> --name short-NN --spec work/<ep>/short-NN/style.json` re-renders an already-cut short (Remotion `ShortV2`).
  - Paper background. The speaker morphs between full-bleed, a framed card and a round PiP while a graphic is on screen.
  - Serif captions revealed word by word, with orange italic keywords.
  - Hook title, end card, and synthesized whoosh/pop sound effects.
  - Graphic types (`src/Graphics.tsx`): stat, people, lines, quote, headline, list. Mark keywords as `*word*`.
  - Output: `out/shorts/<ep>-short-NN-v2.mp4`.
- **Episode intro:** set `"style": "v2"` in `episode.json` → `intro` to use Remotion `IntroV2`.
  - Each clip can take `graphic` plus `graphic_on` (the spoken word where the cutaway lands; optional `graphic_off`).
  - Keyword captions, whip transitions with sound effects, and a serif title card with the topic list.
  - Rebuild with `--stage graphics`, then `--stage final`.
- Fonts: Instrument Serif and Inter (OFL), in `pipeline/remotion/fonts/`.

## 2026-11-01 (later)
- **Face tracking:** `pipeline/face_track.py` (OpenCV YuNet; the model downloads to `~/.cache/fringe-lines-video/models`). `style_short.py` caches the result in `short-NN/faces.json`, and the round picture-in-picture plus the cards now centre on the face.
- **Skills:** `.claude/skills/editorial-short/`, `howto-short/` and `podcast-intro/` (each has a `SKILL.md`) give step-by-step recipes for the two short styles and the episode cold open.
- **How-to shorts:** `pipeline/build_howto.py` with the Remotion `HowTo` composition. The screen share sits on top and pans/zooms on spoken words; the speaker sits below.
  - Built `howto-01` (Morning Loop architecture, 72s), `howto-02` (Microsoft chart, 33s) and `howto-03` (Atlanta Fed AI spend, 49s).
- **Background blur:** `pipeline/bg_blur.py` (MediaPipe selfie_multiclass, about 24 fps on the Mac mini).
  - Full-length blurred cameras are written to `~/.cache/fringe-lines-video/blur/`.
  - Set `"blur_background": true` in `episode.json`, then run `--stage body` and `--stage final`. Rendered pieces go to a separate `seg-blur/` folder.
  - `setup.sh` installs mediapipe and downloads both models.
- **Carousels:** each one is a folder `carousels/<slug>/` with a `carousel.json` and an `images/` subfolder. Render with `pipeline/build_carousel.py`, which uses the Remotion `Carousel` template and `render.mjs` in still mode.
  - Output: 1080×1350 PNGs plus a PDF in `out/carousels/<slug>/`.
  - Recipe: `.claude/skills/carousel/SKILL.md`.
  - Example: `carousels/2026-10-30-takeaways/` (8 slides).
  - Uses the Anton display font (OFL).
- **Infographics:** each one is a folder `infographics/<slug>/` with an `infographic.json`. Render with `pipeline/build_infographic.py`, which uses the Remotion `Infographic` template.
  - Output: a single 1080×1350 PNG in `out/infographics/`.
  - Recipe: `.claude/skills/infographic/SKILL.md`.
  - Example: `infographics/2026-10-30-morning-loop/` ("Your AI chief of staff.").
