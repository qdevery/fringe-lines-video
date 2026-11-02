# Carousel design systems: v1 (editorial) vs. v2 (FringeLines kit)

There are two templates. You pick one per carousel in `carousel.json`:
- **v1, editorial:** the default. Template `pipeline/remotion/src/Carousel.tsx` plus `Graphics.tsx`.
- **v2, FringeLines design kit:** set `"template": "v2"`. Template `pipeline/remotion/src/CarouselV2.tsx`.
  - Source kit: `My Drive/FringeLines Design System files/v2/`, containing the Slide Master v2, Clip Slides and Chart Kit v2.

---

## v1, "Editorial": written down after the fact

v1 grew out of the restyled shorts, which were modelled on Greg Isenberg's videos, and out of the reference carousels. It was never written down as a system, so this section records it.

### Type: three families, each with one job
| Role | Font | Settings |
|---|---|---|
| Cover / CTA headline | **Anton** (condensed grotesk) | ALL CAPS, sized to fit 80–150px, line height 1.06, centred |
| Slide headline, big numbers, quotes, numerals | **Instrument Serif**, regular and *italic* | 84px headlines; stats at 230–300px; quotes at 108px; italic for emphasis |
| Body, labels, chart text, text-slide titles | **Inter** (variable) | Title 800 at 92px, subtitle 700 at 60px, body 400 at 52px; kickers 700 at 30px, uppercase, +5 tracking |

**Signature move:** `*word*` turns the word orange. In serif contexts it is also *italic*. This italic-serif accent is the most recognisable thing in v1.

### Color
- **Accent:** `#FF5A1F`, a hot orange. It is used freely: up to two accent groups per headline, plus chart bars, rules and numbers.
- **Ink:** `#0E0E12` / `#16161A`.
- **Paper:** `#F3F0EA`, warm off-white.
- **Muted:** `#6E6A64`.
- **Charts:**
  - non-highlighted bars are gray `#B9B2A8`;
  - negatives are blue `#3A6EA5`.
- **Alternative accent:** gold `#E2A85A`.

### Surfaces
- **Covers:** near-black with a radial orange glow and a faint 60px grid.
- **Data slides:** warm paper background, with graphics on **floating white cards**:
  - 36px radius;
  - deep soft shadow;
  - a slight tilt on covers.
- **Text slides:** dark gradient, with an oversized italic serif numeral as a watermark.

### Rules (implicit)
- One idea per slide.
- Headlines must work without a caption.
- Mix slide types; never three of the same in a row.
- Text slides use large type (body at 52px).
- Sources go in an optional `credit` line at 24px, sentence case.

**Personality:** a creator or magazine feed. Loud, warm and expressive; built to stop the scroll.

---

## v2, FringeLines kit: as specified

### Type: one family plus mono
| Role | Font | Settings |
|---|---|---|
| Everything readable | **Archivo** | Cover 104–120px / 800; slide title 76–88px / 800, tracking −0.03em; body 38–56px / 400–600 |
| Eyebrows, page numbers, sources, bar values | **IBM Plex Mono** | 24–30px, uppercase, +0.14em tracking |

**Emphasis:**
- No coloured words in headlines.
- Orange marks only "the number that matters".
- A second highlight, if needed, is blue.

### Color
**Green is the brand.** Colors have fixed meanings:
- **Series** (default):
  - forest `#1a5a41`;
  - `#1f6b4a`;
  - `#5c9b7c`;
  - `#b9d4c4`;
  - `#e8f0ea`.
- **Comparison series:** blue `#1a4f6b`, `#4d88a8`, `#8fb8cd`.
- **Accent:** orange `#d4622a`. One per slide, and never a series.
- **Ink:** `#14170f`, olive-black.
- **Paper:** `#F7F7F5`.
- **Covers and closings:** green, orange or blue gradient variants.
- **Quote slides:** soft tinted washes.

### Surfaces
- Flat: no shadows, no tilt and almost no radius.
- Washes at most two palette steps apart.
- Hairline rules.
- Bars are thick flat blocks, with values in mono inside the bar.

### Rules (explicit, from the kit)
1. One idea per slide.
2. One accent per slide. Orange is the number that matters and never a series.
3. Green is the default series; blue is comparison or a second highlight.
4. At most 5 series per chart.
5. **Always a source line, always an N-size.**
6. Nothing below 24px.
7. A list layout is only allowed for takeaways (3 items).

**Personality:** an analyst or research report, like a16z or McKinsey charts. Calm, credible and consistent with the podcast slides and Substack charts.

---

## Biggest differences

| | v1, Editorial | v2, Kit |
|---|---|---|
| **Voice** | Expressive: condensed caps, serif italics | Measured: one grotesk throughout |
| **Font count** | 3 (Anton, Instrument Serif, Inter) | 2 (Archivo plus Plex Mono) |
| **Brand color** | Orange on black | Green, with orange as the single accent |
| **Emphasis** | Coloured italic words in headlines, up to two per slide | No coloured words; orange is reserved for the key number |
| **Depth** | Cards, shadows, tilt (born in motion) | Flat, hairlines, data-first |
| **Data rigor** | Credit line optional | Source and N required on every data slide |
| **Covers** | Thumb-stopping, dense caps | Lots of air; calm and premium |
| **Consistency with other assets** | Matches the shorts and episode intro | Matches the slide master, Substack charts and clip slides |
| **Weakest point** | Can feel generic "creator template"; no chart discipline | Can feel corporate; covers and lists leave empty space at 4:5 |

## Recommendation: a hybrid ("v2 + editorial type")
Keep the kit's **structure, palette roles, flat charts and data rules**. They make the numbers credible and tie carousels to the slides and Substack charts. Bring back v1's **type**:

- **Headlines, cover titles, big numbers, quotes:** Instrument Serif.
  - Italic is used for emphasis in ink, or in blue.
  - Orange stays reserved for the key number, as the kit requires.
- **Body, labels, bar labels:** Archivo, or Inter. They are close; Archivo keeps continuity with the kit.
- **Sources, eyebrows, values:** IBM Plex Mono, kept as is.
- **Drop:** Anton, and the shadows and tilt.

If the kit is shared with other people (designers, the Substack, deck builders), the type change should go into the kit too, so there is one FringeLines system rather than two.
