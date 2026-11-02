# Carousels

Each carousel lives in its own folder:

```
carousels/<slug>/
  carousel.json      # the slides: cover / photo / text / graphic / cta
  images/            # photos, episode frames, chart screenshots, logos
```

Render it with:

```
~/.shorts-skill/bin/python pipeline/build_carousel.py carousels/<slug>
```

Output goes to `out/carousels/<slug>/`: `01.png`, `02.png`, … (1080×1350) plus `<slug>.pdf` for LinkedIn document posts.

The full recipe (story structure, image sources, field reference, QA) is in `.claude/skills/carousel/SKILL.md`. The example `2026-10-30-takeaways/` was built from the Oct 30 episode.
