#!/usr/bin/env python3
"""Builds the offline place data for Wanderkin's trip builder (travel-log/app/data/).

Sources (downloaded to $GEO_DIR, default /workspace/new-streams/_src/geo):
  - GeoNames cities15000.txt + cities1000.txt, countryInfo.txt, admin1CodesASCII.txt  (CC BY 4.0, https://www.geonames.org/)
      every city with population >= 15,000 worldwide, plus towns >= 1,000 in the US, UK and Ireland
  - OurAirports airports.csv (public domain, https://ourairports.com/data/): large + medium airports with an IATA code
  - Wikidata (CC0): coordinates for the 64 US national parks (query: instance of Q34918903)
Output is compact tab-separated text inside JSON so phones parse it fast. The app loads it only when the trip builder opens.
"""
import csv, json, os, re, sys, unicodedata
from pathlib import Path
GEO = Path(os.environ.get("GEO_DIR", "/workspace/new-streams/_src/geo"))
OUT = Path(__file__).resolve().parent.parent / "travel-log" / "app" / "data"
SMALL_TOWNS = {"US", "GB", "IE"}
# GeoNames ISO3 -> the ids the app's world map uses (Natural Earth ADM0_A3). Overseas departments count as their country.
ISO_FIX = {"SSD": "SDS", "PSE": "PSX", "XKX": "KOS", "ESH": "SAH", "ALA": "ALD", "GUF": "FRA", "GLP": "FRA", "MTQ": "FRA",
           "REU": "FRA", "MYT": "FRA", "BES": "NLD", "SJM": "NOR"}

def slug(s):
    s = unicodedata.normalize("NFD", s); s = re.sub(r"[\u0300-\u036f\u02bb]", "", s).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

iso3 = {}; cname = {}
for line in open(GEO / "countryInfo.txt", encoding="utf8"):
    if line.startswith("#") or not line.strip(): continue
    p = line.rstrip("\n").split("\t"); iso3[p[0]] = ISO_FIX.get(p[1], p[1]); cname[iso3[p[0]]] = p[4]
cname["GBR"] = "UK"; cname["USA"] = "USA"
admin = {}
for line in open(GEO / "admin1CodesASCII.txt", encoding="utf8"):
    p = line.rstrip("\n").split("\t"); admin[p[0]] = p[1]

def cities():
    seen = {}
    for fn, keep in (("cities15000.txt", lambda cc, pop: True), ("cities1000.txt", lambda cc, pop: cc in SMALL_TOWNS)):
        for line in open(GEO / fn, encoding="utf8"):
            p = line.rstrip("\n").split("\t")
            gid, name, ascii_, lat, lon, fclass, fcode, cc, a1, pop = p[0], p[1], p[2], p[4], p[5], p[6], p[7], p[8], p[10], int(p[14] or 0)
            if gid in seen or cc not in iso3 or not keep(cc, pop): continue
            if fcode in ("PPLH", "PPLQ", "PPLW", "PPLCH"): continue   # historical / abandoned / destroyed places
            seen[gid] = (name, ascii_ if ascii_ != name else "", round(float(lat), 3), round(float(lon), 3), iso3[cc], a1, pop, gid)
    return list(seen.values())

def airports():
    out = []
    for r in csv.DictReader(open(GEO / "airports.csv", encoding="utf8")):
        if r["type"] not in ("large_airport", "medium_airport") or not re.fullmatch(r"[A-Z]{3}", r["iata_code"] or ""): continue
        if r["scheduled_service"] != "yes" and r["type"] != "large_airport": continue
        cc = iso3.get(r["iso_country"]); 
        if not cc: continue
        reg = r["iso_region"].split("-", 1)[1] if "-" in r["iso_region"] else ""
        if cc == "GBR": reg = {"ENG": "ENG", "SCT": "SCT", "WLS": "WLS", "NIR": "NIR"}.get(reg, "")
        out.append((r["iata_code"], r["name"], r["municipality"] or "", cc, reg, round(float(r["latitude_deg"]), 3), round(float(r["longitude_deg"]), 3), "L" if r["type"] == "large_airport" else "M"))
    out.sort(key=lambda a: (a[7], a[0]))
    return out

def parks():
    sys.path.insert(0, str(Path(__file__).parent))
    src = (Path(__file__).resolve().parent.parent / "travel-log" / "app" / "log-core.js").read_text()
    names = re.findall(r'\["([^"]+)", "[A-Z, ]+"\]', src[src.index("PARK_LIST"):src.index("function slug")])
    want = {slug(n): n for n in names}
    got = {}
    for r in csv.DictReader(open(GEO / "parks_wd.csv", encoding="utf8")):
        lab = re.sub(r"\s+National Park( and Preserve)?$", "", r["itemLabel"]).replace("–", "-")
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", r["coord"])
        if not m: continue
        s = slug(lab)
        if s in want and s not in got: got[s] = [round(float(m.group(2)), 3), round(float(m.group(1)), 3)]
    # Kings Canyon shares Wikidata's item with Sequoia on some mirrors; and a few labels differ. Fill those by hand (public facts).
    fill = {"kings-canyon": [36.887, -118.555], "american-samoa": [-14.258, -170.686], "wrangell-st-elias": [61.71, -142.986],
            "chiricahua": [32.012, -109.356], "great-smoky-mountains": [35.611, -83.49], "haleakala": [20.72, -156.155],
            "hawaii-volcanoes": [19.419, -155.288], "virgin-islands": [18.343, -64.749],
            "lake-clark": [60.97, -153.42], "new-river-gorge": [37.931, -81.075]}
    for k, v in fill.items():
        if k in want and k not in got: got[k] = v
    missing = [k for k in want if k not in got]
    assert not missing, missing
    return {k: got[k] for k in want}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    cs = cities(); cs.sort(key=lambda c: -c[6])
    used_admin = {}
    rows = []
    for name, ascii_, lat, lon, cc, a1, pop, gid in cs:
        rows.append("\t".join([name, ascii_, f"{lat:g}", f"{lon:g}", cc, a1, str(max(1, round(pop / 1000)))]))
    # admin1 names for every (country, code) used, so results can say "Portree, Scotland" or "Springfield, Illinois"
    for name, ascii_, lat, lon, cc, a1, pop, gid in cs:
        two = next((k for k, v in iso3.items() if v == cc and k not in ("CS", "AN") and (k + "." + a1) in admin), None)
        if two: used_admin[cc + "." + a1] = admin[two + "." + a1]
    places = {"v": 1, "source": "GeoNames (geonames.org), CC BY 4.0; park locations: Wikidata (CC0)",
              "cols": ["name", "ascii", "lat", "lon", "country", "admin1", "popK"],
              "countries": cname, "admin": used_admin, "parks": parks(), "rows": "\n".join(rows)}
    (OUT / "places.json").write_text(json.dumps(places, separators=(",", ":"), ensure_ascii=False))
    ap = airports()
    air = {"v": 1, "source": "OurAirports (ourairports.com), public domain", "cols": ["iata", "name", "city", "country", "region", "lat", "lon", "size"],
           "rows": "\n".join("\t".join(str(x) for x in a) for a in ap)}
    (OUT / "airports.json").write_text(json.dumps(air, separators=(",", ":"), ensure_ascii=False))
    for f in ("places.json", "airports.json"):
        print(f, round((OUT / f).stat().st_size / 1024), "KB")
    print(len(cs), "places,", len(ap), "airports,", len(places["parks"]), "parks")
