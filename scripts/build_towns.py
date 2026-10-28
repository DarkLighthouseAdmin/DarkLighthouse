#!/usr/bin/env python3
"""Famstamp v78: every town worldwide for place search, split into small files by the first letters of each name,
so a search loads only the one file it needs (data/towns/<key>.json, a few KB to ~100 KB).

Source: GeoNames (geonames.org, CC BY 4.0): cities500 (every populated place of 500+ people, plus admin seats),
alternateNamesV2 (English names and names in the country's own languages: Ghent/Gent, Bruges/Brugge, Cologne/Koln),
admin1CodesASCII, countryInfo. data/places.json is NOT changed: this is an extra layer on top of it.

Usage: python3 scripts/build_towns.py /path/to/geonames-dir   (the dir holds the 4 unzipped GeoNames files)
The folding (accents, St/Saint, Mt/Mount, Ft/Fort) must match fold() in travel-log/app/towns-core.js.
"""
import sys, os, json, re, unicodedata, collections

SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/geonames"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "travel-log", "app", "data", "towns")
SPLIT_AT = 2500      # a 2-letter file with more rows than this is split into 3-letter files
MAX_ALT = 6

SPECIAL = {"ß": "ss", "ẞ": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŀ": "l", "ŧ": "t", "ŋ": "n", "ĸ": "k", "ſ": "s"}

def fold(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = "".join(SPECIAL.get(c, c) for c in s)
    s = re.sub(r"['’`ʻ]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"\b(st|ste|saint) ", "saint ", s + " ")
    s = re.sub(r"\bmt ", "mount ", s)
    s = re.sub(r"\bft ", "fort ", s)
    return s.strip()

def latin(s):
    t = unicodedata.normalize("NFD", s)
    return all(unicodedata.category(c) == "Mn" or ord(c) < 0x250 or 0x1E00 <= ord(c) <= 0x1EFF or c in "’ʻ" for c in t) and re.search(r"[A-Za-z]", s)

def key_of(f, n): return f.replace(" ", "")[:n]

# countries: ISO2 -> ISO3, name, languages
iso3, cname, langs = {}, {}, {}
for line in open(os.path.join(SRC, "countryInfo.txt"), encoding="utf-8"):
    if line.startswith("#"): continue
    c = line.rstrip("\n").split("\t")
    if len(c) < 16: continue
    iso3[c[0]] = c[1]; cname[c[1]] = c[4]
    langs[c[0]] = set(x.split("-")[0] for x in c[15].split(",") if x)
admin = {}
for line in open(os.path.join(SRC, "admin1CodesASCII.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t"); cc, a1 = c[0].split(".", 1)
    if cc in iso3: admin[iso3[cc] + "." + a1] = c[1]

towns = {}
for line in open(os.path.join(SRC, "cities500.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t")
    if c[6] != "P" or c[8] not in iso3: continue
    if c[7] in ("PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"): continue   # city sections, historical / abandoned / destroyed places
    towns[c[0]] = {"name": c[1], "ascii": c[2], "lat": round(float(c[4]), 3), "lon": round(float(c[5]), 3), "cc": c[8],
                   "a1": c[10], "pop": int(c[14] or 0), "alt": []}
print("towns", len(towns))
alt = collections.defaultdict(list)
with open(os.path.join(SRC, "alternateNamesV2.txt"), encoding="utf-8") as f:
    for line in f:
        c = line.rstrip("\n").split("\t")
        gid = c[1]
        if gid not in towns: continue
        lang = c[2]
        if len(c) > 7 and (c[6] == "1" or c[7] == "1"): continue          # colloquial / historic
        t = towns[gid]
        if lang == "en" or lang in langs.get(t["cc"], ()) or lang == "":
            if lang == "" : continue
            nm = c[3].strip()
            if nm and latin(nm) and len(nm) <= 60: alt[gid].append((0 if c[4] == "1" else 1, 0 if lang == "en" else 1, nm))
for gid, lst in alt.items():
    t = towns[gid]; seen = {fold(t["name"]), fold(t["ascii"])}
    for _, _, nm in sorted(lst):
        f = fold(nm)
        if f and f not in seen and len(t["alt"]) < MAX_ALT: seen.add(f); t["alt"].append(nm)

# index every town under every name's first 2 letters (and 3 for big files)
by2 = collections.defaultdict(list)
for gid, t in towns.items():
    names = [t["name"]] + ([t["ascii"]] if t["ascii"] and fold(t["ascii"]) != fold(t["name"]) and latin(t["ascii"]) else []) + t["alt"]
    keys = set()
    for nm in names:
        f = fold(nm)
        if len(f.replace(" ", "")) >= 2: keys.add(key_of(f, 2))
    for k in keys: by2[k].append((gid, names))
os.makedirs(OUT, exist_ok=True)
for fn in os.listdir(OUT):
    if fn.endswith(".json"): os.remove(os.path.join(OUT, fn))   # generated files only (this folder is built by this script)
split, files, total = [], {}, 0
def write(key, items):
    global total
    items = sorted(items, key=lambda x: -towns[x[0]]["pop"])
    rows, adm, cn = [], {}, {}
    for gid, names in items:
        t = towns[gid]; c3 = iso3[t["cc"]]
        ak = c3 + "." + t["a1"]
        if ak in admin: adm[ak] = admin[ak]
        cn[c3] = cname.get(c3, c3)
        rows.append("\t".join(["|".join(n.replace("|", " ").replace("\t", " ") for n in names), str(t["lat"]), str(t["lon"]), c3, t["a1"], str(t["pop"])]))
    body = json.dumps({"v": 1, "key": key, "admin": adm, "countries": cn, "rows": "\n".join(rows)}, ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8").write(body); files[key] = len(body); total += len(body)
for k2, items in by2.items():
    if len(items) <= SPLIT_AT: write(k2, items); continue
    split.append(k2)
    by3 = collections.defaultdict(list)
    for gid, names in items:
        ks = set()
        for nm in names:
            f = fold(nm).replace(" ", "")
            if f[:2] == k2: ks.add(f[:3] if len(f) >= 3 else f[:2] + "_")
        for k in ks: by3[k].append((gid, names))
    for k3, it in by3.items(): write(k3, it)
json.dump({"v": 1, "source": "GeoNames (geonames.org), CC BY 4.0: cities500 + alternate names", "split": sorted(split), "towns": len(towns)},
          open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
big = sorted(files.items(), key=lambda x: -x[1])[:5]
print("files", len(files), "total MB", round(total / 1e6, 1), "biggest", big)
