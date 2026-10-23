#!/usr/bin/env python3
"""Build the offline place lookup Famstamp's importer uses (travel-log/app/import-geo.js).
Run: python3 scripts/build_import_geo.py   (needs the Natural Earth geojson in NE_DIR and GeoNames files in GEO_DIR)

It answers "which country / US state / UK nation / national park is this point in, and what's the nearest town?"
on the phone, with no network. Nothing is uploaded: the importer loads this file only while an import runs.

Sources:
  - Natural Earth (public domain): ne_50m_admin_0_countries, ne_50m_admin_0_map_units (UK nations),
    ne_50m_admin_1_states_provinces_lakes (US states). Outlines simplified to ~1-2 km, coordinates in 1/100 degree.
  - GeoNames cities15000 (CC BY 4.0, geonames.org): towns of 100k+ worldwide and 15k+ in the US, UK and Ireland,
    with their time zone so dates come out in local time.
  - Wikidata (CC0): national park locations (parks_wd.csv), with a rough radius per park.
"""
import csv, json, math, os, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NE = Path(os.environ.get("NE_DIR", "/workspace/new-streams/_src/data"))
GEO = Path(os.environ.get("GEO_DIR", "/workspace/new-streams/_src/geo"))
OUT = ROOT / "travel-log" / "app" / "import-geo.js"
ISO_FIX = {"SSD": "SDS", "PSE": "PSX", "XKX": "KOS", "ESH": "SAH", "ALA": "ALD", "GUF": "FRA", "GLP": "FRA", "MTQ": "FRA",
           "REU": "FRA", "MYT": "FRA", "BES": "NLD", "SJM": "NOR"}
UK = {"ENG", "SCT", "WLS", "NIR"}

def load(n): return json.load(open(NE / f"{n}.geojson"))["features"]
def polys(g): return [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
def fix_dateline(ring):
    lons = [q[0] for q in ring]
    if max(lons) - min(lons) <= 180: return ring
    east = sum(1 for l in lons if l > 0) >= len(lons) / 2
    return [((l if (l > 0) == east else (179.99 if east else -179.99)), la) for l, la in ring]
def dp(pts, tol):
    if len(pts) < 5: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; st = [(0, len(pts) - 1)]
    while st:
        a, b = st.pop(); ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy); best, bi = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / L if L > 1e-9 else math.hypot(pts[i][0] - ax, pts[i][1] - ay)
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; st += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]
def ring_out(r, tol):
    r = dp(fix_dateline(r), tol)
    q = [(round(x * 100), round(y * 100)) for x, y in r]
    q = [q[0]] + [p for i, p in enumerate(q[1:], 1) if p != q[i - 1]]
    if len(q) < 3: return None
    flat = []; px = py = 0
    for x, y in q: flat += [x - px, y - py]; px, py = x, y     # delta-encoded: smaller file
    return flat
def shapes(feats, tol):
    out = []
    for sid, g in feats:
        rings = []
        for poly in polys(g):
            fr = ring_out(poly[0], tol)
            if fr: rings.append(fr)
        if not rings:  # tiny island country: keep its biggest ring unsimplified
            fr = ring_out(max((p[0] for p in polys(g)), key=len), 0)
            if fr: rings.append(fr)
        out.append([sid, rings])
    return out

countries = []
for f in load("ne_50m_admin_0_countries"):
    a3 = f["properties"]["ADM0_A3"]
    if a3 == "GBR": continue
    countries.append((a3, f["geometry"]))
mu = {f["properties"]["GU_A3"]: f for f in load("mu50")}
for c in sorted(UK): countries.append((c, mu[c]["geometry"]))
states = [(f["properties"]["postal"], f["geometry"]) for f in load("ne_50m_admin_1_states_provinces_lakes") if f["properties"]["adm0_a3"] == "USA"]
assert len(states) == 51

# towns
iso3 = {}
for line in open(GEO / "countryInfo.txt", encoding="utf8"):
    if line.startswith("#") or not line.strip(): continue
    p = line.rstrip("\n").split("\t"); iso3[p[0]] = ISO_FIX.get(p[1], p[1])
tzs = []; tzi = {}; towns = []; small = []; seen = set()
def town_row(p, cc, pop, tz, dp):
    if tz not in tzi: tzi[tz] = len(tzs); tzs.append(tz)
    a1 = p[10] if cc in ("US", "GB") else ""
    if cc == "GB": a1 = {"ENG": "ENG", "SCT": "SCT", "WLS": "WLS", "NIR": "NIR"}.get(a1, "")
    return "\t".join([p[1].replace("\t", " "), f"{float(p[4]):.{dp}f}", f"{float(p[5]):.{dp}f}", iso3.get(cc, ""), a1, str(tzi[tz]), str(round(pop / 1000))])
SKIP_CODES = {"PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"}
DISTRICT = re.compile(r"^\S+ \d{1,2}(\s|$)")   # "Paris 16 Passy", "Lyon 03": city districts, not towns
US_LIKE = {"US", "PR", "GU", "VI", "AS", "MP"}   # territories get small towns too (and their own time zone)
for line in open(GEO / "cities15000.txt", encoding="utf8"):
    p = line.rstrip("\n").split("\t")
    cc, pop, tz = p[8], int(p[14] or 0), p[17]
    if p[7] in SKIP_CODES or DISTRICT.match(p[1]): continue   # neighbourhoods ("Chicago Loop") and places that are gone
    if pop < (20000 if cc in ("US", "GB", "IE") else 150000): continue
    seen.add(p[0]); towns.append(town_row(p, cc, pop, tz, 2))
# Small towns (import-towns.js, loaded only while importing): every US town of 1,000+, 5,000+ in Canada, the UK, Ireland,
# Australia and New Zealand, 40,000+ elsewhere. So a photo in Mineral Point, WI says Mineral Point, not just Wisconsin.
for line in open(GEO / "cities1000.txt", encoding="utf8"):
    p = line.rstrip("\n").split("\t")
    if p[0] in seen or p[6] != "P" or p[7] in SKIP_CODES or DISTRICT.match(p[1]): continue
    cc, pop, tz = p[8], int(p[14] or 0), p[17]
    if pop < (1000 if cc in US_LIKE else 5000 if cc in ("CA", "GB", "IE", "AU", "NZ") else 40000): continue
    small.append(town_row(p, cc, pop, tz, 2))

# parks: Wikidata point + a rough radius (km) that covers most of the park
parks = {}
pj = None
for cand in [ROOT / "travel-log" / "app" / "data" / "places.json", Path("/workspace/dls-site-trips/travel-log/app/data/places.json")]:
    if cand.exists(): pj = json.load(open(cand))["parks"]; break
if pj is None:
    for r in csv.DictReader(open(GEO / "parks_wd.csv", encoding="utf8")): pass
    raise SystemExit("need park locations")
BIG = {"wrangell-st-elias": 130, "gates-of-the-arctic": 110, "denali": 90, "katmai": 80, "death-valley": 80, "yellowstone": 55, "glacier-bay": 70,
       "lake-clark": 70, "kobuk-valley": 40, "everglades": 45, "grand-canyon": 60, "glacier": 40, "olympic": 40, "big-bend": 45, "joshua-tree": 40,
       "yosemite": 35, "kenai-fjords": 35, "isle-royale": 35, "canyonlands": 35, "sequoia": 30, "kings-canyon": 30, "channel-islands": 40,
       "capitol-reef": 35, "theodore-roosevelt": 30, "great-smoky-mountains": 35, "north-cascades": 35, "mount-rainier": 20, "badlands": 30,
       "rocky-mountain": 25, "grand-teton": 30, "dry-tortugas": 20, "voyageurs": 25, "zion": 20, "petrified-forest": 25}
for k, (la, lo) in pj.items(): parks[k] = [round(la, 3), round(lo, 3), BIG.get(k, 15)]
assert len(parks) == 64

data = {"v": 1, "source": "Natural Earth (public domain); GeoNames (geonames.org, CC BY 4.0); park locations: Wikidata (CC0)",
        "countries": shapes(countries, 0.025), "states": shapes(states, 0.015), "parks": parks, "tz": tzs, "towns": "\n".join(towns)}
js = ("/* Generated by scripts/build_import_geo.py. Do not edit by hand. " + data["source"] + ".\n"
      "   Offline place lookup for the importer: outlines are [id, [delta-encoded rings in 1/100 degree]]. */\n"
      "(function (g) { g.FS_IMPORT_GEO = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "; })(typeof self !== 'undefined' ? self : this);\n")
OUT.write_text(js, encoding="utf-8")
js2 = ("/* Generated by scripts/build_import_geo.py. Do not edit by hand. GeoNames (geonames.org, CC BY 4.0).\n"
       "   Small towns for the importer, loaded only while an import runs. Rows: name, lat, lon, country, state, time zone (index into FS_IMPORT_GEO.tz), population in thousands. */\n"
       "(function (g) { g.FS_IMPORT_TOWNS = " + json.dumps("\n".join(small), ensure_ascii=False) + "; })(typeof self !== 'undefined' ? self : this);\n")
(OUT.parent / "import-towns.js").write_text(js2, encoding="utf-8")
print("small towns", len(small), len(js2.encode()) // 1024, "KB")
print(f"wrote {OUT.relative_to(ROOT)}: {len(js)/1024:.0f} KB, {len(countries)} countries, {len(states)} states, {len(towns)} towns, {len(tzs)} time zones")
