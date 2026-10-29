#!/usr/bin/env python3
"""v102: "Ideas near this stop" for Plan a trip. Reads data/sights/*.json (our own GeoNames + Wikidata sights) and writes
data/near/<lat>_<lon>.json, one file per 10x10 degree block, holding the best sights of each 2x2 degree cell inside it
(famous first, kid-friendly types and parks lifted), in the same row format as the sights shards. Deterministic: same input -> byte-identical output. Only adds/overwrites data/near/."""
import json, os, glob, math
ROOT = os.path.join(os.path.dirname(__file__), "..", "travel-log", "app", "data")
SRC, OUT = os.path.join(ROOT, "sights"), os.path.join(ROOT, "near")
CELL, CAP, BLOCK = 2, 40, 10
KID = {"zoo": 30, "aquarium": 30, "themepark": 30, "waterpark": 25, "beach": 15, "park": 15, "cave": 12, "waterfall": 12, "castle": 10,
       "lighthouse": 8, "geyser": 12, "glacier": 8, "canyon": 12, "volcano": 12, "ski": 8, "campground": 6}
SKIP = {"pub", "station", "brewery", "winery", "distillery", "ferry", "street", "drive", "film", "university", "airport", "cruise"}
def key(lat, lon): return "%d_%d" % (math.floor(lat / CELL) * CELL, math.floor(lon / CELL) * CELL)
cells, admin, countries, seen = {}, {}, {}, set()
for f in sorted(glob.glob(os.path.join(SRC, "*.json"))):
    if f.endswith("index.json"): continue
    j = json.load(open(f)); admin.update(j.get("admin") or {}); countries.update(j.get("countries") or {})
    for l in (j.get("rows") or "").split("\n"):
        c = l.split("\t")
        if len(c) < 9 or not c[1] or not c[2]: continue
        ty = c[6] or "landmark"
        if ty in SKIP: continue
        lat, lon = float(c[1]), float(c[2])
        dk = c[9] if len(c) > 9 and c[9] else (c[0].split("|")[0].lower(), round(lat, 3), round(lon, 3))
        if dk in seen: continue   # a sight listed under two spellings lives in two shards: keep one
        seen.add(dk)
        rank = int(c[8] or 0) if c[8].isdigit() else 0
        cells.setdefault(key(lat, lon), []).append((-(rank + KID.get(ty, 0)), c[0], l))
os.makedirs(OUT, exist_ok=True)
blocks = {}
for k in sorted(cells):
    la, lo = map(int, k.split("_"))
    blocks.setdefault("%d_%d" % (la // BLOCK * BLOCK, lo // BLOCK * BLOCK), []).extend(r[2] for r in sorted(cells[k])[:CAP])
index = {}
for k in sorted(blocks):
    lines = blocks[k]
    used_c = sorted({l.split("\t")[3] for l in lines}); used_a = sorted({l.split("\t")[3] + "." + l.split("\t")[4] for l in lines})
    doc = {"v": 1, "key": k, "admin": {a: admin[a] for a in used_a if a in admin}, "countries": {c: countries[c] for c in used_c if c in countries}, "rows": "\n".join(lines)}
    s = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    p = os.path.join(OUT, k + ".json")
    if not os.path.exists(p) or open(p).read() != s: open(p, "w").write(s)
    index[k] = len(lines)
json.dump({"v": 1, "cell": CELL, "cap": CAP, "block": BLOCK, "source": "GeoNames (CC BY 4.0) + Wikidata (CC0), via data/sights", "cells": index}, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"), sort_keys=True)
print("blocks", len(index), "rows", sum(index.values()))
