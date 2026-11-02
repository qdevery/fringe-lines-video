---
name: infographic
description: Make a single-image editorial infographic (1080x1350) that explains one idea at a glance — two-tone headline, one-sentence dek, a hero visual with 2–4 numbered callouts and leader lines, an optional side note, a three-column "why it matters" row with icons, byline and sources. Use for "explain X in one graphic" posts about a company move, a framework, an architecture or a trend; the PNG can also be a carousel slide.
---

# Editorial infographic

Reference style: the "Anthropic enters consulting." post. That post has:

- a heavy two-line headline, with the second line in the accent color;
- a dek: one plain sentence saying what happened;
- a big hero object made of parts, with numbered labels pointing at them;
- a side fact;
- a "Why it's happening" row of three icon columns;
- an author line and a sources line.

The point is to explain **one idea in about 10 seconds**.

## Format
- **Default: one standalone image**, 1080×1350 (4:5). It suits LinkedIn and Instagram feeds and is highly saveable.
- **As a carousel slide:** the size matches the carousels, so the PNG can be dropped in as `{"type": "photo", "image": "images/x.png", "fit": "contain"}`, or copied in as the cover.
- **As a deck slide:** the 4:5 layout doesn't fit 16:9. Build a separate 16:9 layout if the user needs one.

Pieces:
- Template: `pipeline/remotion/src/Infographic.tsx`.
- Build: `pipeline/build_infographic.py`.
- Each infographic lives in its own folder `infographics/<slug>/` with an `infographic.json` and an optional `images/` subfolder.
- Output: `out/infographics/<slug>.png`.

## 1. Pick an idea that has parts
Good fits:
- a move with **2–4 components**: "Anthropic enters consulting" with strategy, operations and technology;
- an **architecture**: the Morning Loop's sources, connectors, schedule and outputs;
- a **framework** or a **before → after**.

If the idea is one number, use a carousel `graphic` slide or a short instead. If it needs more than 4 parts, make a carousel.

## 2. Write the copy (tight)
- **headline:** two lines, 2–4 words each, with a period at the end of line 2. Line 2 is the payoff.
  - Examples: `["Anthropic enters", "consulting."]`, `["Your AI chief", "of staff."]`.
- **dek:** one sentence, at most 25 words: who did what, and why it matters.
- **callouts:** 2–4 items. Each has a `title` of 1–2 words and `text` of at most 12 words.
  - They read top to bottom, so order them as a sequence or as layers (top = most strategic).
- **side:** optional. One striking fact, at most 22 words, e.g. "training 10,000 engineers by 2027…".
- **why:** a title such as "Why they're doing it" or "Why build one", plus exactly 3 items. Each item has a 2–3 word `title` and `text` of at most 7 words.
- **byline:** `{"name", "org"}`. **sources:** the publications, the episode, or "Fringe Lines podcast, <date>".

**Honesty:**
- Every fact needs a source you can name in `sources`.
- Don't add numbers the source doesn't state.
- Hedge ("reportedly", "per the S-1") when only one outlet reported it.

## 3. Hero visual
- **Default: the built-in block stack** (`"hero": {"label": "Anthropic"}`). It draws one isometric accent-colored block per callout, alternately offset, with leader lines landing on each block, and the label on the top block. It needs no image file.
- **Image hero:** `"hero": {"image": "images/hero.png", "fit": "contain"}`. Use a product screenshot, a chart or slide from the episode's screen share, or a supplied object/place image. **Never the hosts or any real person:** no camera frames or headshots.
- **AI-generated images** (like the reference's concrete render): only when the user asks, e.g. through the Canva connector. No real people, and no fake "photos" of real events.

## 4. `infographics/<slug>/infographic.json`
```json
{
  "headline": ["Your AI chief", "of staff."],
  "dek": "Quinn's \"Morning Loop\" agent reads his work tools every weekday at 8 AM and hands him a brief before he opens his laptop.",
  "hero": {"label": "Morning Loop"},
  "callouts": [
    {"title": "Sources", "text": "Outlook mail, calendar and To-Do, Slack, Asana, SharePoint."},
    {"title": "Connectors", "text": "Approved enterprise connectors reach into each source."}
  ],
  "side": {"title": "Closing the loop", "text": "At the end of the day he replies to the brief…"},
  "why": {"title": "Why build one", "items": [
    {"icon": "clock", "title": "Start ahead", "text": "The triage is done before 9."},
    {"icon": "check", "title": "Nothing slips", "text": "It flags what you missed."},
    {"icon": "plug", "title": "No new tools", "text": "Uses the stack you already pay for."}
  ]},
  "byline": {"name": "Fringe Lines", "org": "Episode of Oct 30, 2026"},
  "sources": "Fringe Lines podcast, Oct 30, 2026.",
  "accent": "#FF5A1F"
}
```
- **Icons:** `chart rings target users bolt shield dollar clock globe check mail calendar plug brain`. Add a new one to the `Icon` map in `Infographic.tsx` if needed: a 36×36 stroke path.
- **Accent:** defaults to Fringe Lines orange. The reference's red is `#C8231B`.

## 5. Render and QA
```
~/.shorts-skill/bin/python pipeline/build_infographic.py infographics/<slug>
```
Rendering takes about 20 s. Open the PNG and check:
- The headline fits in 2 lines. If not, shorten it; don't shrink it.
- The dek fits in 3 lines or fewer.
- Callout texts don't collide. With 4 callouts, each text must stay at 2 lines or fewer, so cut words.
- Each leader line ends on its block.
- The side note doesn't run into the "why" box.
- The three "why" columns are balanced (similar text lengths).
- The sources line fits on 2 lines.

- No host, guest or real person appears anywhere.

Report the PNG path, the sources used, and anything that needs fact-checking.
