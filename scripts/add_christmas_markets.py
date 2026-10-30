#!/usr/bin/env python3
"""Famstamp v120: Christmas markets as their own kind of stamp (type "xmas"), additive only.
Adds a curated list of well-known Christmas markets (scripts/christmas_markets.tsv) to data/sights/*.json. Each row gets its
English name, its local names (Weihnachtsmarkt, Christkindlmarkt, marché de Noël, julmarknad...), plus "Christmas Market <town>"
and "<town> Christmas Market", so "christmas market", "weihnachtsmarkt" or "christkindlmarkt" with or without a town finds it.
Nothing is removed or renamed. Idempotent: a row is never added twice to a shard (same Wikidata id, or same name within ~1 km).
Fame (column 9) is the market's Wikidata sitelinks, or the curated floor when that is higher (most markets have few sitelinks).
Usage: python3 scripts/add_christmas_markets.py [/workspace/geonames]"""
import os, re, sys, json, glob, math, hashlib, collections, unicodedata, urllib.request, urllib.parse, time
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "travel-log", "app", "data", "sights")
SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/geonames"
CACHE = os.path.join(SRC, "wd", "xmas"); os.makedirs(CACHE, exist_ok=True)
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"
SPECIAL = {"ß": "ss", "ẞ": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŀ": "l", "ŧ": "t", "ŋ": "n", "ĸ": "k", "ſ": "s"}
def fold(s):
    s = unicodedata.normalize("NFD", str(s or "").lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn"); s = "".join(SPECIAL.get(c, c) for c in s)
    s = re.sub(r"['’`ʻ]", "", s); s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"\b(st|ste|saint) ", "saint ", s + " "); s = re.sub(r"\bmt ", "mount ", s); s = re.sub(r"\bft ", "fort ", s); return s.strip()
ARTICLE = re.compile(r"^(the|la|le|les|el|il|lo|der|die|das|de|het|l) ")
idx = json.load(open(os.path.join(OUT, "index.json"))); split = set(idx.get("split", []))
def keyfor(f):
    f = f.replace(" ", ""); k2 = f[:2]
    return k2 if k2 not in split else (f[:3] if len(f) >= 3 else k2 + "_")
def keys(names):
    out = set()
    for n in names:
        for g in (fold(n), ARTICLE.sub("", fold(n))):
            if len(g.replace(" ", "")) >= 2: out.add(keyfor(g))
    return out
files = {}
for f in glob.glob(os.path.join(OUT, "*.json")):
    if not f.endswith("index.json"): files[os.path.basename(f)[:-5]] = json.load(open(f, encoding="utf-8"))
before = sum(len([r for r in j["rows"].split("\n") if r]) for j in files.values())
changed = set()
def same_place(c, cols):
    if len(c) > 9 and c[9] and c[9] == cols[9]: return True
    try: return fold(c[0].split("|")[0]) == fold(cols[0].split("|")[0]) and abs(float(c[1]) - float(cols[1])) < 0.01 and abs(float(c[2]) - float(cols[2])) < 0.01
    except ValueError: return False
def put_new(cols):
    n = 0
    for k in sorted(keys(cols[0].split("|"))):
        j = files.setdefault(k, {"v": 1, "key": k, "admin": {}, "countries": {}, "rows": ""})
        L = [x for x in j["rows"].split("\n") if x]
        if any(same_place(x.split("\t"), cols) for x in L): continue
        L.append("\t".join(cols)); j["rows"] = "\n".join(L); changed.add(k); n += 1
    return n
iso3 = {}; cname = {}
for line in open(os.path.join(SRC, "countryInfo.txt"), encoding="utf-8"):
    if line.startswith("#"): continue
    c = line.rstrip("\n").split("\t")
    if len(c) >= 16: iso3[c[0]] = c[1]; cname[c[1]] = c[4]
adm_all = {}
for line in open(os.path.join(SRC, "admin1CodesASCII.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t"); a, b = c[0].split(".", 1)
    if a in iso3: adm_all[iso3[a] + "." + b] = c[1]
towns = collections.defaultdict(list)
for line in open(os.path.join(SRC, "cities500.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t")
    if c[6] != "P" or c[7] in ("PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"): continue
    lat, lon = float(c[4]), float(c[5]); towns[(iso3.get(c[8], ""), int(lat * 4), int(lon * 4))].append((lat, lon, c[1], int(c[14] or 0), c[10], c[2], c[3]))
def near(cc, lat, lon, want=""):
    best = None
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            for t in towns.get((cc, int(lat * 4) + dy, int(lon * 4) + dx), ()):
                d = math.hypot(t[0] - lat, (t[1] - lon) * math.cos(math.radians(lat)))
                named = want and (fold(t[2]) == fold(want) or fold(t[5]) == fold(want) or fold(want) in [fold(a) for a in t[6].split(",")])
                score = d - min(0.08, math.log10(max(t[3], 500)) * 0.012) - (1 if named else 0)
                if d < 0.6 and (best is None or score < best[0]): best = (score, t, named)
    return best
def sitelinks(ids):
    ids = sorted(set(ids)); p = os.path.join(CACHE, "sl-" + hashlib.sha1(" ".join(ids).encode()).hexdigest()[:12] + ".json")
    if os.path.exists(p): return json.load(open(p))
    q = "SELECT ?i ?n WHERE { VALUES ?i { %s } ?i wikibase:sitelinks ?n }" % " ".join("wd:" + i for i in ids)
    req = urllib.request.Request("https://query.wikidata.org/sparql", data=urllib.parse.urlencode({"query": q, "format": "json"}).encode(), headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    out = {b["i"]["value"].rsplit("/", 1)[1]: int(b["n"]["value"]) for b in json.load(urllib.request.urlopen(req, timeout=120))["results"]["bindings"]}
    json.dump(out, open(p, "w")); return out
items = [l.rstrip("\n").split("\t") for l in open(os.path.join(HERE, "christmas_markets.tsv"), encoding="utf-8") if l.strip() and not l.startswith("#")]
SL = sitelinks([c[1] for c in items if c[1] != "-"])
stats = collections.Counter(); seenq = set()
for en, q, lat, lon, cc, town, other, floor in items:
    q = "" if q == "-" else q
    assert not q or q not in seenq, q; seenq.add(q)
    names = [en] + [n for n in other.split(";") if n]
    for g in ("Christmas Market " + town, town + " Christmas Market"):
        if fold(g) not in [fold(n) for n in names]: names.append(g)
    b = near(cc, float(lat), float(lon), town); a1 = b[1][4] if b else ""
    if not b or not b[2]: print("town check:", en, "->", b[1][2] if b else None)
    fame = max(SL.get(q, 0), int(floor))
    row = ["|".join(names), lat, lon, cc, a1, "0", "xmas", town, str(fame), q]
    stats["shard rows"] += put_new(row); stats["markets"] += 1; stats[cc] += 1
for k in sorted(changed):
    j = files[k]; j["countries"] = dict(j.get("countries", {})); j["admin"] = dict(j.get("admin", {}))
    for r in j["rows"].split("\n"):
        c = r.split("\t")
        if len(c) > 4:
            if c[3] not in j["countries"]: j["countries"][c[3]] = cname.get(c[3], c[3])
            if c[4] and c[3] + "." + c[4] not in j["admin"] and c[3] + "." + c[4] in adm_all: j["admin"][c[3] + "." + c[4]] = adm_all[c[3] + "." + c[4]]
    open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8").write(json.dumps(j, ensure_ascii=False, separators=(",", ":")))
types = collections.Counter(); seen = set(); unesco = 0
for j in files.values():
    for r in j["rows"].split("\n"):
        c = r.split("\t")
        if len(c) > 9:
            key = c[9] or (c[0].split("|")[0] + c[3] + c[1])
            if key in seen: continue
            seen.add(key); types[c[6]] += 1; unesco += len(c) > 10 and c[10] == "U"
idx["sights"] = len(seen); idx["types"] = dict(types); idx["unesco"] = unesco; idx["xmas"] = "v120"
json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
after = sum(len([r for r in j["rows"].split("\n") if r]) for j in files.values())
print(dict(stats)); print("rows", before, "->", after, "sights", idx["sights"], "xmas", types["xmas"], "files touched", len(changed))
