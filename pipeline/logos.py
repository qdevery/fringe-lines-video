#!/usr/bin/env python3
"""Shared company-logo library for the video templates (walkthrough, monologue).

Logos live once in assets/logos/ (synced on Drive, reused across videos) with a registry, assets/logos/logos.json:
  {"apollo": {"name": "Apollo", "domain": "apollo.io", "file": "apollo.png", "bleed": true, "aliases": ["apollo.io"], "source": "..."}}

  # fetch from the company's own site (its declared icons: largest PNG >= 128 px, else SVG, else Google's favicon service)
  python pipeline/logos.py fetch apollo --domain apollo.io [--name Apollo] [--alias "apollo.io"]
  # or import a logo you downloaded yourself (a brand-kit PNG/SVG is better than any favicon)
  python pipeline/logos.py fetch clay --domain clay.com --file ~/Downloads/clay-mark.png
  python pipeline/logos.py list
  python pipeline/logos.py scan --transcript work/walkthrough/<slug>/transcript.txt   # library logos the speaker mentions
  python pipeline/logos.py sheet [-o /tmp/logos.png]                                  # QA: every logo in a pill tile

Builders call resolve() to copy a logo into the render's work folder: a beat field "logo": "apollo" becomes
"logos/apollo.png" plus "bleed" (true = an opaque square app icon that fills the round tile; false = a transparent
mark that sits inside it with padding).
"""
import argparse, html, io, json, os, re, shutil, subprocess, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "assets", "logos")
REG = os.path.join(LIB, "logos.json")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
MIN_PX = 96


def load():
    return json.load(open(REG)) if os.path.exists(REG) else {}


def save(reg):
    os.makedirs(LIB, exist_ok=True)
    json.dump(dict(sorted(reg.items())), open(REG, "w"), indent=1)


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def lookup(key, reg=None):
    reg = reg if reg is not None else load()
    k = norm(key)
    for rk, v in reg.items():
        if k in {norm(rk), norm(v.get("name", "")), norm(v.get("domain", ""))} | {norm(a) for a in v.get("aliases", [])}:
            return rk, v
    return None, None


def get(url, timeout=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read(), r.headers.get("Content-Type", ""), r.geturl()


# ---------------------------------------------------------------- fetch

def candidates(domain):
    """Icons the site declares in its <head>, best first."""
    out = []
    try:
        body, _, final = get(f"https://{domain}")
        page = body.decode("utf-8", "ignore")
        for tag in re.findall(r"<link\b[^>]*>", page, re.I):
            rel = (re.search(r'rel=["\']?([^"\'>]+)', tag, re.I) or [None, ""])[1].lower()
            href = re.search(r'href=["\']?([^"\'\s>]+)', tag, re.I)
            if not href or "mask-icon" in rel or not re.search(r"\b(icon|apple-touch-icon)\b", rel): continue
            url = urllib.parse.urljoin(final, html.unescape(href[1]))
            sizes = re.search(r'sizes=["\']?(\d+)x\d+', tag, re.I)
            px = int(sizes[1]) if sizes else (180 if "apple" in rel else 0)
            m = re.search(r"(\d{3,4})(?:x\d+)?[._-]", url)  # "favicon_512.png", "1000x1000.png": sizes attrs often lie low
            if m: px = max(px, int(m[1]))
            svg = ".svg" in url.lower() or "svg" in tag.lower()
            out.append({"url": url, "px": 10_000 if svg else px, "svg": svg, "rel": rel})
    except Exception as e:  # noqa: BLE001
        print(f"  (homepage not readable: {e})")
    # the site's rasters >= 128 px (largest first), then common fallbacks, then SVGs (some favicon SVGs are tiny or
    # switch colour with dark mode), then whatever is left; to_png() rejects anything under MIN_PX
    big = sorted([c for c in out if not c["svg"] and c["px"] >= 128], key=lambda c: -c["px"])
    fall = [{"url": u, "px": 0, "svg": False, "rel": r} for u, r in [
        (f"https://{domain}/apple-touch-icon.png", "apple-touch-icon"),
        (f"https://www.google.com/s2/favicons?domain={domain}&sz=256", "google-s2"),
        (f"https://icons.duckduckgo.com/ip3/{domain}.ico", "duckduckgo")]]
    return big + fall + [c for c in out if c["svg"]] + [c for c in out if not c["svg"] and c["px"] < 128]


def to_png(data):
    """bytes -> (PNG bytes, size px, bleed) or None if too small / not an image."""
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    if im.format == "ICO":  # take the largest icon in the file
        im.size = max(im.info.get("sizes", {im.size}), key=lambda s: s[0])
    im = im.convert("RGBA")
    w, h = im.size
    if min(w, h) < MIN_PX: return None
    a = im.getchannel("A")
    corners = [a.getpixel((x, y)) for x, y in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]]
    bleed = min(corners) > 200 and abs(w - h) <= 2  # opaque square app icon
    if not bleed and a.getbbox():  # trim transparent margins so the mark fills its inset
        im = im.crop(a.getbbox())
    buf = io.BytesIO(); im.save(buf, "PNG")
    return buf.getvalue(), min(w, h), bleed


def cmd_fetch(a):
    reg = load()
    key = norm(a.key) or sys.exit("bad key")
    os.makedirs(LIB, exist_ok=True)
    src, data, svg = None, None, False
    if a.file:
        src = a.file
        data = get(a.file)[0] if re.match(r"https?://", a.file) else open(os.path.expanduser(a.file), "rb").read()
        svg = a.file.lower().split("?")[0].endswith(".svg") or data.lstrip()[:200].lower().find(b"<svg") >= 0
    else:
        for c in candidates(a.domain):
            try:
                body, ctype, _ = get(c["url"])
            except Exception as e:  # noqa: BLE001
                print(f"  skip {c['url'][:90]}: {e}"); continue
            if c["svg"] or "svg" in ctype or body.lstrip()[:200].lower().find(b"<svg") >= 0:
                data, svg, src = body, True, c["url"]; break
            try:
                r = to_png(body)
            except Exception:  # noqa: BLE001
                r = None
            if r: data, src = body, c["url"]; break
            print(f"  skip {c['url'][:90]}: under {MIN_PX}px or not an image")
    if data is None: sys.exit(f"no usable logo for {a.domain}: download one from their brand/press page and pass --file")
    for old in [f for f in os.listdir(LIB) if os.path.splitext(f)[0] == key]: os.remove(os.path.join(LIB, old))
    if svg:
        fn, px, bleed = f"{key}.svg", None, False
        open(os.path.join(LIB, fn), "wb").write(data)
    else:
        r = to_png(data)
        if not r: sys.exit(f"logo under {MIN_PX}px: find a bigger one")
        png, px, bleed = r
        fn = f"{key}.png"; open(os.path.join(LIB, fn), "wb").write(png)
    if a.bleed is not None: bleed = a.bleed == "yes"
    prev = reg.get(key, {})
    reg[key] = {"name": a.name or prev.get("name") or a.key, "domain": a.domain, "file": fn, "bleed": bleed,
                "aliases": sorted(set(prev.get("aliases", []) + (a.alias or []))), "source": src, **({"px": px} if px else {})}
    save(reg)
    print(f"{key}: {fn} ({'svg' if svg else f'{px}px'}, {'fills the tile' if bleed else 'sits inside the tile'}) from {src}")


def cmd_list(a):
    for k, v in load().items():
        print(f"{k:16} {v['name']:20} {v['domain']:22} {v['file']:20} {'bleed' if v.get('bleed') else 'inset'}  aliases={','.join(v.get('aliases', []))}")


def cmd_scan(a):
    """Which library logos the speaker names, with the first time each is said (transcript.txt: word@seconds)."""
    reg = load()
    toks = [(w.rpartition("@")[0], float(w.rpartition("@")[2])) for w in open(a.transcript).read().split() if "@" in w]
    hits = {}
    for k, v in reg.items():
        names = [v.get("name", k), k, v.get("domain", "")] + v.get("aliases", [])
        for name in filter(None, names):
            parts = [norm(p) for p in name.split()] or [norm(name)]
            for i in range(len(toks) - len(parts) + 1):
                if [norm(t) for t, _ in toks[i:i + len(parts)]] == parts:
                    hits.setdefault(k, []).append(round(toks[i][1], 1))
    for k, ts in sorted(hits.items(), key=lambda kv: min(kv[1])):
        print(f"{k:16} said at {', '.join(map(str, sorted(set(ts))[:8]))}")
    if not hits: print("no library logos mentioned (fetch the companies the speaker names first)")


def cmd_sheet(a):
    """Every logo as it renders: a 104 px round tile on paper and on a dark frame."""
    from PIL import Image, ImageDraw
    reg = load()
    cell, n = 220, max(1, len(reg))
    sheet = Image.new("RGB", (cell * min(n, 6), cell * 2 * ((n + 5) // 6)), "#F7F7F5")
    dr = ImageDraw.Draw(sheet)
    tmp = os.path.join(LIB, ".sheet"); os.makedirs(tmp, exist_ok=True)
    for i, (k, v) in enumerate(reg.items()):
        p = os.path.join(LIB, v["file"])
        if p.endswith(".svg"):  # macOS Quick Look rasterises SVG
            subprocess.run(["qlmanage", "-t", "-s", "256", "-o", tmp, p], capture_output=True)
            p = os.path.join(tmp, os.path.basename(p) + ".png")
            if not os.path.exists(p): continue
        im = Image.open(p).convert("RGBA")
        for row, bg in enumerate(["#F7F7F5", "#2A2E27"]):
            x0, y0 = (i % 6) * cell, ((i // 6) * 2 + row) * cell
            dr.rectangle([x0, y0, x0 + cell, y0 + cell], fill=bg)
            d = 104; cx, cy = x0 + cell // 2, y0 + 90
            tile = Image.new("RGBA", (d, d), (0, 0, 0, 0)); mask = Image.new("L", (d, d), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, d - 1, d - 1], fill=255)
            ImageDraw.Draw(tile).ellipse([0, 0, d - 1, d - 1], fill="white", outline="#E3E5DF", width=3)
            inner = d if v.get("bleed") else int(d * 0.62)
            lg = im.copy(); lg.thumbnail((inner, inner))
            tile.alpha_composite(lg, ((d - lg.width) // 2, (d - lg.height) // 2))
            tile.putalpha(Image.composite(tile.getchannel("A"), mask, mask))
            sheet.paste(tile, (cx - d // 2, cy - d // 2), tile)
            dr.text((x0 + 12, y0 + cell - 34), f"{k} ({'bleed' if v.get('bleed') else 'inset'})", fill="#14170F" if row == 0 else "white")
    out = a.o or os.path.join(LIB, ".sheet", "sheet.png")
    sheet.save(out); print(out)


# ---------------------------------------------------------------- used by the builders

def resolve(ref, workdir):
    """'apollo' (library key / name / alias) or a file in the work folder -> {"logo": "logos/apollo.png", "bleed": bool}."""
    if os.path.exists(os.path.join(workdir, ref)) and "." in os.path.basename(ref):
        return {"logo": ref, "bleed": False}
    k, v = lookup(ref)
    if not v:
        sys.exit(f"logo {ref!r} not in the library: python pipeline/logos.py fetch {norm(ref)} --domain <their domain>")
    dst = os.path.join(workdir, "logos"); os.makedirs(dst, exist_ok=True)
    shutil.copyfile(os.path.join(LIB, v["file"]), os.path.join(dst, v["file"]))
    return {"logo": f"logos/{v['file']}", "bleed": bool(v.get("bleed"))}


def attach(beat, workdir):
    """Resolve every "logo" in a built beat (the beat itself and its items / rows / compare sides) in place."""
    def fix(o):
        if isinstance(o, dict) and isinstance(o.get("logo"), str) and not o["logo"].startswith("logos/"):
            o.update(resolve(o["logo"], workdir))
    fix(beat)
    for k in ("items", "rows"):
        for it in beat.get(k, []) or []: fix(it)
    for side in ("left", "right"):
        if isinstance(beat.get(side), dict):
            for it in beat[side].get("items", []): fix(it)
    return beat


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch"); f.add_argument("key"); f.add_argument("--domain", required=True); f.add_argument("--name")
    f.add_argument("--alias", action="append"); f.add_argument("--file"); f.add_argument("--bleed", choices=["yes", "no"])
    sub.add_parser("list")
    s = sub.add_parser("scan"); s.add_argument("--transcript", required=True)
    sh = sub.add_parser("sheet"); sh.add_argument("-o")
    a = ap.parse_args()
    {"fetch": cmd_fetch, "list": cmd_list, "scan": cmd_scan, "sheet": cmd_sheet}[a.cmd](a)


if __name__ == "__main__":
    main()
