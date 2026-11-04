#!/usr/bin/env python3
"""v121: one small file of grown-up drink stops (breweries, wineries, distilleries) from the sights files, so a search like
"brewery Asheville" or "Napa winery" can list the ones near a town (the sights files are split by name, not by place).
Reads travel-log/app/data/sights/*.json, writes data/sights/type-drinks.json (same row format). Deterministic and additive:
no sight file changes. Re-run after build_sights.py / enrich_sights.py."""
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "travel-log", "app", "data", "sights")
TYPES = {"brewery", "winery", "distillery"}
rows, admin, countries, seen = [], {}, {}, set()
for f in sorted(os.listdir(D)):
    if not f.endswith(".json") or f == "index.json" or f.startswith("type-"): continue
    j = json.load(open(os.path.join(D, f), encoding="utf-8"))
    for line in str(j.get("rows", "")).split("\n"):
        c = line.split("\t")
        if len(c) < 7 or c[6] not in TYPES: continue
        key = (c[0].split("|")[0], c[1], c[2])
        if key in seen: continue
        seen.add(key); rows.append(line)
        a = c[3] + "." + c[4]
        if a in j.get("admin", {}): admin[a] = j["admin"][a]
        if c[3] in j.get("countries", {}): countries[c[3]] = j["countries"][c[3]]
rows.sort()
out = {"v": 1, "key": "type-drinks", "types": sorted(TYPES), "admin": dict(sorted(admin.items())), "countries": dict(sorted(countries.items())), "rows": "\n".join(rows)}
with open(os.path.join(D, "type-drinks.json"), "w", encoding="utf-8") as fh: json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print(len(rows), "rows,", os.path.getsize(os.path.join(D, "type-drinks.json")), "bytes")
