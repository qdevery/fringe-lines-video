#!/usr/bin/env python3
"""Render an image carousel (1080x1350 PNG slides + a PDF for LinkedIn) from carousels/<slug>/carousel.json.

  ~/.shorts-skill/bin/python pipeline/build_carousel.py carousels/<slug> [--youtube]   # --youtube: 1080x1080 square

carousel.json:
  {
    "brand": "Fringe Lines",
    "accent": "#FF5A1F",                 # optional; e.g. "#E2A85A" for the gold look
    "slides": [
      {"type": "cover",   "image": "images/cover.jpg", "focus": [0.5, 0.3], "kicker": "Fringe Lines", "headline": "*Good news* that no one is talking about"},
      {"type": "photo",   "image": "images/horses.jpg", "headline": "*Przewalski's horses* have returned to the wild", "credit": "Photo: ..."},
      {"type": "text",    "number": "04", "title": "Run an After-Action Review", "subtitle": "The US Army ends every exercise with four questions:", "body": "..."},
      {"type": "graphic", "headline": "Spend per employee", "graphic": {"type": "stat", "prefix": "$", "value": 1024, "label": "per employee on AI"}},
      {"type": "cta",     "headline": "Follow *Fringe Lines*", "sub": "New episodes every week"}
    ]
  }
Images are paths relative to the carousel folder. Output: out/carousels/<slug>/01.png ... and <slug>.pdf
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    args = sys.argv[1:]
    square = "--youtube" in args          # 1080x1080 square slides for YouTube posts -> out/carousels/<slug>-youtube/
    folder = os.path.abspath([a for a in args if not a.startswith("--")][0])
    slug = os.path.basename(folder.rstrip("/"))
    spec = json.load(open(os.path.join(folder, "carousel.json")))
    slides = spec["slides"]
    for s in slides:
        if "image" in s and not os.path.exists(os.path.join(folder, s["image"])):
            sys.exit(f"missing image: {s['image']}")
    v2 = spec.get("template") == "v2"   # FringeLines design kit v2 (CarouselV2.tsx); see the carousel skill
    out = os.path.join(ROOT, "out/carousels", slug + ("-youtube" if square else ""))
    os.makedirs(out, exist_ok=True)
    batch = [{"id": "CarouselV2" if v2 else "Carousel", "still": 0 if v2 else 60, "out": os.path.join(out, f"{i + 1:02d}.png"),
              "props": {"slide": s, "index": i, "total": len(slides), "brand": spec.get("brand", "Fringe Lines"),
                        **({"accent": spec["accent"]} if "accent" in spec else {}), "durationInFrames": 1 if v2 else 61,
                        **({"width": 1080, "height": 1080} if square else {})}}
             for i, s in enumerate(slides)]
    bj = os.path.join(folder, ".render.json")  # lives here so the folder is Remotion's publicDir (images resolve)
    json.dump({"batch": batch}, open(bj, "w"))
    try:
        subprocess.run(["node", os.path.join(ROOT, "pipeline/remotion/render.mjs"), bj], check=True, stdout=subprocess.DEVNULL)
    finally:
        os.remove(bj)
    from PIL import Image
    pngs = [b["out"] for b in batch]
    imgs = [Image.open(p).convert("RGB") for p in pngs]
    pdf = os.path.join(out, f"{slug}{'-youtube' if square else ''}.pdf")
    imgs[0].save(pdf, save_all=True, append_images=imgs[1:], resolution=144)
    print(f"wrote {len(pngs)} slides + {pdf}")


if __name__ == "__main__":
    main()
