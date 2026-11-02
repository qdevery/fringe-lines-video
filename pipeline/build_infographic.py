#!/usr/bin/env python3
"""Render an editorial infographic (1080x1350 PNG) from infographics/<slug>/infographic.json.

  ~/.shorts-skill/bin/python pipeline/build_infographic.py infographics/<slug>

See .claude/skills/infographic/SKILL.md for the fields. Images (optional hero) are relative to the folder.
Output: out/infographics/<slug>.png  (drop it into a carousel as {"type": "photo", "fit": "contain"} if needed)
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

folder = os.path.abspath(sys.argv[1])
slug = os.path.basename(folder.rstrip("/"))
spec = json.load(open(os.path.join(folder, "infographic.json")))
img = spec.get("hero", {}).get("image")
if img and not os.path.exists(os.path.join(folder, img)):
    sys.exit(f"missing image: {img}")
out = os.path.join(ROOT, "out/infographics", f"{slug}.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
bj = os.path.join(folder, ".render.json")
json.dump({"batch": [{"id": "Infographic", "still": 0, "out": out, "props": {**spec, "durationInFrames": 1}}]}, open(bj, "w"))
try:
    subprocess.run(["node", os.path.join(ROOT, "pipeline/remotion/render.mjs"), bj], check=True, stdout=subprocess.DEVNULL)
finally:
    os.remove(bj)
print("wrote", out)
