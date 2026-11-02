#!/usr/bin/env bash
# Cut list for episode 2026-10-30 shorts. Re-run any line to rebuild that short.
set -euo pipefail
cd "$(dirname "$0")/../.."
b() { "$HOME/.shorts-skill/bin/python" pipeline/build_short.py --ep 2026-10-30 "$@" 2>&1 | grep -Ev 'objc|^render [0-9]'; }
b --name short-02 --range 782.40:799.10 --range 802.62:833.80 --replace "27=>27%" --replace "60=>60,000" --replace "000=>"
b --name short-03 --range 1071.15:1108.75 --replace "gtm=>GTM" --replace "50=>50K" --replace ",000=>"
b --name short-04 --range 1386.15:1394.70 --range 1424.30:1438.40 --range 1465.65:1474.70 --replace "clot,=>Claude," --replace "claude=>Claude" --replace "twenty=>\$20" --replace "hundred=>\$100" --replace "dollar=>"
b --name short-05 --range 1477.25:1523.80 --replace "descript=>Descript" --replace "codex=>Codex"
