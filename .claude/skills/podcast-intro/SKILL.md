---
name: podcast-intro
description: Build the cold open for a long-form Fringe Lines episode — a 35–60 s highlight reel of the episode's best lines with explainer-graphic cutaways, keyword captions, whip transitions + SFX, ending on a title card with the topic list. Use when making or revising the intro of a full episode.
---

# Long-form podcast intro (cold open)

The look is modeled on Greg Isenberg's long-form intros. What makes it engaging:

- **Open on the strongest line**, with no logo first.
- **Cut every 3–6 s.**
- **Make roughly every other clip a cutaway:** the speaker slides into a card on the left while a graphic lands on the right.
- **Keep captions short:** 1–3 words, with orange keywords.
- **End on the title:** a card that shows what's coming.

The pipeline is `pipeline/build_episode.py`, driven by `work/<ep>/episode.json` → `intro`. Rendering uses the Remotion `IntroV2` composition (`pipeline/remotion/src/IntroV2.tsx`); graphics come from `Graphics.tsx`.

## 1. Mine the episode for clips (8–10 candidates, keep 7–9)
- Read the transcript (`work/<ep>/words-*.json`, or the Descript `.txt`) and list lines that stand alone in under 6 s.
- In order of preference:
  1. **A hard number:** "pay 27% of their employees to leave", "900% revenue retention".
  2. **A bold claim or prediction:** "tokens are going to seep into everything".
  3. **A confession or relatable pain:** "I'm so tired of paying subscriptions".
  4. **A funny or emotional reaction:** "I'd be token maxing".
  5. **A quotable closer:** "can't put a price on superintelligence".
- **Spread across topics:** about one clip per chapter, both hosts represented, at least one laugh.
- **Order the reel:**
  - Clip 1 is the single strongest hook, usually a number or a claim.
  - Alternate speakers and energy.
  - Put the most quotable line last, right before the title card.
- **Skip:**
  - lines needing context ("like I said", "that chart");
  - lines over ~6 s;
  - lines with crosstalk.
- **Swearing:** keep it only if the user is fine with an explicit intro, and say so in the report.

## 2. Configure `episode.json` → `intro`
```json
"title": "FRINGE LINES",
"subtitle": "October 30, 2026",
"intro": {
  "style": "v2",
  "title": "Fringe Lines",
  "title_seconds": 4.5,
  "topics": ["The Morning Loop", "Microsoft headcount", "Build vs. buy", "Token limits", "Google vs. AI mode", "Anthropic's S-1", "AI spend"],
  "emphasis": ["27%", "leave", "900%", "retention", "sql", "agents", "tokens", "everything", "maxing"],
  "clips": [
    {"say": "microsoft just offered", "until": "employees to leave", "tag": "AI & jobs", "replace": {"27": "27%"},
     "graphic_on": "27%", "graphic": {"type": "stat", "kicker": "Microsoft buyout offer", "value": 27, "suffix": "%", "label": "of employees offered a payout to *leave*"}},
    {"say": "tokens are going to seep", "until": "like the internet", "tag": "Tokens everywhere"}
  ]
}
```
- **`say` / `until`:** the first and last few spoken words of the clip, matched case- and punctuation-insensitively. The match is the first occurrence in the episode, so make `say` distinctive (3–5 words). If the other speaker talks over the line, the matcher retries using only one speaker's words.
- **`pre`:** optional seconds of lead-in before `say`.
- **`tag`:** the topic label shown top-left with its number. Use 1–3 words.
- **`replace`:** caption fixes, e.g. numbers, "sequel"→"SQL", or `"a": ""` to hide a word.
- **`graphic` + `graphic_on`:** the cutaway lands about 150 ms before the spoken word `graphic_on`.
  - Optional `graphic_off` (a later word) returns to full-frame.
  - Without `graphic_off`, the cutaway holds to the end of the clip.
- **Cutaway count:** add cutaways to 3–5 clips. Pick the ones with a number, a named company or product, or a quotable line. Leave reaction and laugh clips full-frame.
- **Graphic types** (same as the editorial shorts):
  - `stat`: a counting number with kicker and label;
  - `people`: an icon grid;
  - `lines`: schematic trend lines;
  - `quote`: an ink card;
  - `headline`: a news-style card with a highlight sweep;
  - `list`: numbered rows.
  - Use `*word*` for orange italics.
- **Honesty:** on-screen numbers must be what was said. Charts are schematic, never invented data.
- **`topics`:** 5–7 short chapter names for the title card, in episode order.
- **`emphasis`:** 12–25 keywords drawn orange in captions: numbers, names, punchline words.
- **`title_seconds`:** 4–5 s. The title card is "Fringe Lines" in serif with an orange italic last word, the date, and an "On this episode" list.

## 3. Check the plan before rendering
```
~/.shorts-skill/bin/python pipeline/build_episode.py --ep <ep> --stage plan
```
- It prints each intro clip's tag, length and caption text.
- Fix any `WARN intro clip not found`: adjust the `say`/`until` wording to match the transcript exactly.
- **Target total:** clips of 35–50 s plus a 4.5 s title. Drop or trim clips over 6 s.
- Read every caption line for misheard words and add `replace` fixes.

## 4. Render
```
~/.shorts-skill/bin/python pipeline/build_episode.py --ep <ep> --stage graphics   # intro clips + IntroV2 + lower-thirds
~/.shorts-skill/bin/python pipeline/build_episode.py --ep <ep> --stage final      # join intro + body, chapters, loudness
```
- Add `--blur` to both commands for the background-blurred version. It needs the blurred cameras in `~/.cache/fringe-lines-video/blur/` (see `pipeline/bg_blur.py`) and writes `<ep>-fringe-lines-blur.mp4` from a separate cache.
- The body doesn't need re-rendering for intro changes.
- The chapters file is regenerated, so all timestamps shift with the intro length.
- Sound effects (whoosh, pop, long whoosh into the title) are generated into the graphics folder and mixed by Remotion.

## 5. QA
```
F=out/episode/<ep>-fringe-lines.mp4
ffmpeg -v error -y -i $F -t 50 -vf "fps=1,scale=320:-1,tile=8x7" -frames:v 1 /tmp/intro.png
```
Check:
- Each cutaway's card is fully on screen, its numbers match what's said, and there's no stray `*`.
- Captions show orange keywords, and no caption overlaps the speaker card's bottom edge.
- The title card lists every topic in order.
- Video and audio durations match (`ffprobe -show_entries stream=codec_type,duration`).
- The episode sits at about −15.5 LUFS.
- The chapters file starts `00:00 Cold open`, then the intro length, then "Catching up".

Report to the user:
- the clip list (tag + line);
- which clips have cutaways;
- the intro length;
- any explicit language;
- any numbers to verify.
