# Fringe Lines video pipeline

Turns one raw podcast recording (Descript multicam export) into a full edited episode, a cold open,
vertical shorts, image carousels and infographics, using Claude Code skills, Python, ffmpeg and Remotion.

**Start here:** open [`docs/index.html`](docs/index.html) for an interactive walkthrough
(or the GitHub Pages version, if enabled).

- `pipeline/`: builders (`build_short.py`, `style_short.py`, `build_howto.py`, `build_episode.py`, `build_carousel.py`, `build_infographic.py`) and the Remotion templates
- `.claude/skills/`: the recipes Claude Code follows for each format (mirrored in `.agents/skills/`)
- `work/<ep>/`, `carousels/`, `infographics/`: example specs from the Oct 30, 2026 episode
- `STATUS.md`: setup, commands and known issues

Setup (macOS): `brew install ffmpeg node jq`, then `bash pipeline/setup.sh`.

Raw media, renders and transcripts are not in the repo.
