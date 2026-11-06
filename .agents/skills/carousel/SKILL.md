---
name: carousel
description: Make a Fringe Lines image carousel (Instagram/LinkedIn, 1080x1350 PNG slides + PDF) — photo slides with big condensed caps headlines and accent words, large-type text-only slides, chart/screenshot slides, explainer-graphic slides and a follow CTA. Use when asked for a carousel, slide post, or "swipe" post from an episode or a topic.
---

# Image carousel

The style comes from the reference carousels:

- **No speakers:** carousels never use footage or photos of the hosts. They use only text, graphics we build, and non-person images such as charts and screenshots.
- **Photo slides:** a full-bleed image darkened at the bottom, with a heavy condensed ALL-CAPS headline. The key words are in the accent color.
- **Cover:** a thin rule with a brand kicker.
- **Text-only slides:** dark gradient, accent-colored title, bold white subtitle, regular body. The type is deliberately **larger** than the reference (title 92, subtitle 60, body 52 px at 1080 wide).

Pieces:
- Template: `pipeline/remotion/src/Carousel.tsx`, the Remotion `Carousel` composition, rendered as stills.
- Build: `pipeline/build_carousel.py`.
- Each carousel lives in its own folder `carousels/<slug>/` with a `carousel.json` and an `images/` subfolder.
- Output: `out/carousels/<slug>/01.png …` plus `<slug>.pdf`, which is ready to upload as a LinkedIn document post.

## 1. Plan the story (7–10 slides)
1. **Cover:** a promise or a curiosity gap, e.g. "*5 AI signals* from this week that most teams are missing" or "*Good news* from around the world no one is talking about". Write it in 8–14 words.
2. **One idea per slide:** a fact, a takeaway or a step. The headline must make sense without a caption.
3. **Mix the slide types.** Don't run three photos or three text slides in a row. Typical pattern: cover → photo → photo/chart → graphic → text → photo → text → CTA.
4. **CTA last:** "Follow *Fringe Lines*", "Save this for your next planning meeting".

Accents: wrap 1–4 words per headline in `*…*`, usually the subject or the number. Use at most two accent groups per slide.

## 2. Visuals: no speakers, ever
Carousels never show the hosts or guests. That means no camera frames, no headshots, and no "photo of the person talking," even blurred.
Every slide is built from **text, graphics we create, and non-person images**.

Images go in `carousels/<slug>/images/`. Sources, in order of preference:
- **Graphics we build:**
  - `graphic` slides (stat / people / lines / quote / headline / list from `Graphics.tsx`);
  - a typographic `cover`, which needs no image;
  - a `cover` with a `graphic` card;
  - a finished infographic PNG dropped in as an `image` slide (see the infographic skill).
- **Episode screen shares:** charts, slides and product screens, never the camera.
  - Grab with `ffmpeg -ss <sec> -i "<raw>/Quinn's screen-3.mp4" -frames:v 1 -vf "crop=iw:ih*0.895:0:ih*0.105" images/chart.png`; the crop removes the browser chrome.
  - Crop to the relevant part, show it with `fit: "contain"`, and credit the chart's original publisher.
  - For a commercial post, consider redrawing third-party charts as our own `lines` or `stat` graphics from the underlying numbers.
- **The user's own non-person images:** product screenshots, logos, place or object photos they supply.
- **AI-generated or stock images:** only when the user asks.
  - No real people (including the hosts) and no fake "photos" of real events.
  - Credit stock photos and only use licensed ones.

Quotes are fine as **text** (`quote` graphic, attributed by name). Just don't pair them with the speaker's image.

## 3. Write `carousels/<slug>/carousel.json`
```json
{
  "brand": "Fringe Lines",
  "accent": "#FF5A1F",
  "slides": [
    {"type": "cover", "kicker": "Fringe Lines · Oct 30",
     "headline": "*5 AI signals* from this week that most teams are missing"},
    {"type": "cover", "kicker": "Fringe Lines", "headline": "Revenue up. *Headcount flat.*",
     "graphic": {"type": "lines", "series": [{"label": "Revenue", "shape": "up"}, {"label": "Headcount", "shape": "flat"}]}},
    {"type": "photo", "image": "images/horses.jpg", "focus": [0.4, 0.4], "credit": "Photo: …",
     "headline": "*Przewalski's horses* have returned to the wild after decades of *conservation*"},
    {"type": "photo", "image": "images/chart.png", "fit": "contain", "credit": "Chart: …",
     "headline": "Microsoft's *revenue kept climbing* while headcount stayed flat"},
    {"type": "graphic", "headline": "Anthropic's S-1, *in one number*",
     "graphic": {"type": "stat", "kicker": "Net revenue retention", "value": 900, "suffix": "%", "label": "…"}},
    {"type": "text", "number": "04", "title": "Run an After-Action Review",
     "subtitle": "The US Army ends every exercise with four questions:",
     "body": "What was supposed to happen, what actually happened, why, and what to change next time."},
    {"type": "cta", "headline": "Follow *Fringe Lines*", "sub": "New episodes every week"}
  ]
}
```
| type | fields | notes |
|---|---|---|
| `cover` | `headline, kicker?, graphic?, image?, focus?` | Kicker sits between two rules; "SWIPE →" bottom-right. With no `image`: a dark accent-glow cover that's text only (larger headline) or has a `graphic` card above the headline. `image` is for non-person photos only |
| `photo` | `image, focus?, fit?, headline, credit?` | No people. `focus` = [x, y] 0–1, the part of the image to keep. Use `fit: "contain"` for charts and screenshots (whole image over a blurred copy of itself) |
| `text` | `title, subtitle?, body?, number?` | Large type. Body text should run 20–45 words; longer text shrinks slightly, so split it across slides instead |
| `graphic` | `graphic, headline?, credit?` | Any `Graphics.tsx` type, shown fully animated in; serif headline. For real numbers use `bars`: `{"type":"bars","kicker","signed":true,"suffix":"%","rows":[{"label","value","from?","note?","hi?"}]}` (negatives grow left in blue; `hi` rows in accent). Prefer redrawing third-party charts as `bars` over screenshots |
| `cta` | `headline, sub?` | Ink background, brand wordmark |
| `image` | `image` | A finished 4:5 image (e.g. an infographic PNG) shown as-is |

- **Accent color:** `accent` defaults to Fringe Lines orange. `"#E2A85A"` gives the gold look of the reference.
- **Slide numbers:** photo and text slides show `n/total` top-right automatically.

**Honesty:**
- Facts and numbers must come from the episode or a source you can name. Put the source in `credit`.
- Write "as cited on the show" when the hosts didn't name the source.
- Don't invent statistics. If a number needs checking, tell the user.

## 4. Render
```
~/.shorts-skill/bin/python pipeline/build_carousel.py carousels/<slug>
```
This takes about 30–60 s for 8–10 slides and writes PNGs plus a PDF to `out/carousels/<slug>/`.

**YouTube posts:** add `--youtube` to render 1080×1080 squares into `out/carousels/<slug>-youtube/`. YouTube shows post images square, so 4:5 slides get cropped. The same `carousel.json` works; both templates (v1 and `"template": "v2"`) tighten their layouts for the square. Check the square contact sheet too: long titles and 4+ list items are where it gets tight.

## 5. QA
Make a contact sheet and look at it:
```
ffmpeg -v error -y -pattern_type glob -i "out/carousels/<slug>/*.png" -vf "scale=360:-1,tile=4x3" -frames:v 1 /tmp/sheet.png
```
Check:
- No slide shows a host, guest or any real person.
- No headline runs over 5 lines or collides with the credit.
- Faces and subjects aren't cropped. Adjust `focus` if they are.
- Charts are readable. Use `fit: "contain"`, and crop the screenshot tighter if needed.
- Accents show as color, never as literal `*`.
- Text slides have no orphan word on the last line. Reword or split if they do.

Report to the user:
- the slide list;
- where each image came from (screen share, supplied, or built by us);
- any number that needs checking.
