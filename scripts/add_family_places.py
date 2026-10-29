#!/usr/bin/env python3
"""Famstamp v103: places families go that search was missing, and six new kinds of stamp (additive only).
- New kinds: volcano, ski (ski resort), campground, university, airport (stamped from search by IATA code), cruise (cruise port).
- Existing mountains that Wikidata says are volcanoes become volcanoes (Vesuvius, Etna, Kilauea, Arenal...). The row keeps its
  Wikidata id, so an earned stamp keeps its id and only redraws with the volcano picture.
- New rows (Wikidata, CC0): national parks worldwide, ski resorts, campgrounds, universities and cruise terminals that aren't in
  the sights yet, plus a curated list of big family places (Banff, Peak District, Kennedy Space Center, Grand Central, theme parks,
  cruise ports...). A curated place that is already a sight only gets extra names (and its town fixed when it was wrong).
Rows are only added, renamed with more spellings, or retyped from a generic kind; nothing is removed. Idempotent: a second run gives byte-identical files (candidates are ranked including the ones already added, and a
row is never added twice to a shard: same Wikidata id, or same name within ~1 km).
Usage: python3 scripts/add_family_places.py [/workspace/geonames]"""
import os, re, sys, json, glob, math, time, hashlib, collections, unicodedata, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "travel-log", "app", "data", "sights")
SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/geonames"
CACHE = os.path.join(SRC, "wd", "family"); os.makedirs(CACHE, exist_ok=True)
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"
# english name: (Wikidata id, type, town or "", extra names)
ITEMS = {
  "Banff National Park": ("Q41858", "park", "Banff", ["Banff Park"]), "Jasper National Park": ("Q503429", "park", "Jasper", []),
  "Yoho National Park": ("Q828404", "park", "Field", []), "Peak District National Park": ("Q24641019", "park", "Bakewell", ["Peak District"]),
  "Eryri National Park": ("Q20888920", "park", "Betws-y-Coed", ["Snowdonia", "Snowdonia National Park", "Eryri"]),
  "Cairngorms National Park": ("Q1025953", "park", "Aviemore", ["Cairngorms"]), "Fiordland National Park": ("Q877719", "park", "Te Anau", ["Fiordland"]),
  "Torres del Paine National Park": ("Q901646", "park", "", ["Torres del Paine"]), "Plitvice Lakes National Park": ("Q189849", "park", "", ["Plitvice Lakes", "Plitvice"]),
  "Kennedy Space Center Visitor Complex": ("Q6389687", "museum", "Merritt Island", ["Kennedy Space Center", "KSC Visitor Complex"]),
  "Space Center Houston": ("Q2749172", "museum", "Houston", []), "Grand Central Terminal": ("Q11290", "station", "New York City", ["Grand Central", "Grand Central Station"]),
  "Whistler Blackcomb": ("Q1206060", "ski", "Whistler", ["Whistler ski resort"]), "Aspen Snowmass": ("Q4807795", "ski", "Aspen", ["Snowmass"]),
  "Park City Mountain": ("Q3821979", "ski", "Park City", ["Park City Mountain Resort"]), "Breckenridge Ski Resort": ("Q12053500", "ski", "Breckenridge", []),
  "Mammoth Mountain Ski Area": ("Q3285029", "ski", "Mammoth Lakes", []), "Jackson Hole Mountain Resort": ("Q10538901", "ski", "Teton Village", []),
  "Mont Tremblant Resort": ("Q3497349", "ski", "Mont-Tremblant", ["Mont-Tremblant", "Tremblant"]),
  "Napa Valley": ("Q1151105", "winery", "Napa", ["Napa Valley AVA", "Napa wine country"]),
  "Island of Hawaii": ("Q68740", "island", "Hilo", ["Big Island", "Hawaii Island", "Hawaiʻi Island"]),
  "Disney Springs": ("Q2125296", "landmark", "Lake Buena Vista", ["Downtown Disney"]), "SeaWorld Orlando": ("Q2449490", "themepark", "Orlando", ["SeaWorld"]),
  "Hersheypark": ("Q3107826", "themepark", "Hershey", ["Hershey Park"]), "Cedar Point": ("Q859230", "themepark", "Sandusky", []),
  "Busch Gardens Tampa Bay": ("Q2743812", "themepark", "Tampa", ["Busch Gardens"]), "Six Flags Magic Mountain": ("Q1515080", "themepark", "Valencia", []),
  "Knott's Berry Farm": ("Q1207585", "themepark", "Buena Park", ["Knotts Berry Farm"]), "Kings Island": ("Q953752", "themepark", "Mason", []),
  "Silver Dollar City": ("Q3483991", "themepark", "Branson", []), "Universal Studios Florida": ("Q1880820", "themepark", "Orlando", ["Universal Studios Orlando"]),
  "Universal Orlando Resort": ("Q778011", "themepark", "Orlando", ["Universal Orlando"]), "Walt Disney World Resort": ("Q206859", "themepark", "Lake Buena Vista", ["Walt Disney World", "Disney World"]),
  "Disneyland Resort": ("Q1229066", "themepark", "Anaheim", []), "Legoland Florida": ("Q646122", "themepark", "Winter Haven", []),
  "Disney's Fort Wilderness Resort": ("Q7888589", "campground", "Lake Buena Vista", ["Fort Wilderness", "Fort Wilderness Campground"]),
  "Mall of America": ("Q659219", "landmark", "Bloomington", []), "Pearl Harbor": ("Q127091", "historic", "Honolulu", []),
  "Port Canaveral": ("Q1233873", "cruise", "Cape Canaveral", ["Port Canaveral cruise port"]), "PortMiami": ("Q75646", "cruise", "Miami", ["Port of Miami", "Miami cruise port"]),
  "Port Everglades": ("Q2104689", "cruise", "Fort Lauderdale", []), "Port of Galveston": ("Q7231142", "cruise", "Galveston", ["Galveston cruise port"]),
  "Port of Barcelona": ("Q1349796", "cruise", "Barcelona", []), "Port of Southampton": ("Q7231265", "cruise", "Southampton", ["Southampton cruise port"]),
  "Nassau Cruise Port": ("Q136697785", "cruise", "Nassau", []), "Port of Civitavecchia": ("Q3909229", "cruise", "Civitavecchia", ["Civitavecchia cruise port"]),
  "Port of Piraeus": ("Q82310", "cruise", "Piraeus", ["Piraeus"]), "Canada Place": ("Q1032014", "cruise", "Vancouver", ["Vancouver cruise terminal"]),
  "Brooklyn Cruise Terminal": ("Q4974810", "cruise", "New York City", []), "Manhattan Cruise Terminal": ("Q7013825", "cruise", "New York City", []),
  "Port of San Juan": ("Q3909281", "cruise", "San Juan", ["San Juan cruise port"]), "Port of Long Beach": ("Q2244441", "cruise", "Long Beach", []),
  "Port of New Orleans": ("Q773908", "cruise", "New Orleans", []), "Port of Tampa": ("Q3398571", "cruise", "Tampa", []),
  "Port of Copenhagen": ("Q1252907", "cruise", "Copenhagen", []), "Port of Venice": ("Q610148", "cruise", "Venice", []),
  "Port of Dover": ("Q739207", "ferry", "Dover", []), "Overseas Passenger Terminal": ("Q21079877", "cruise", "Sydney", ["Sydney cruise terminal"]),
  "Kai Tak Cruise Terminal": ("Q3531700", "cruise", "Hong Kong", []), "Marina Bay Cruise Centre Singapore": ("Q6763789", "cruise", "Singapore", ["Marina Bay Cruise Centre"]),
  "Haleakalā": ("Q515719", "volcano", "", ["Haleakala"]), "Mount St. Helens": ("Q4675", "volcano", "", []), "Teide": ("Q38954", "volcano", "", ["Mount Teide"]),
  "Mount Bromo": ("Q679590", "volcano", "", ["Bromo"]), "Arenal Volcano": ("Q641588", "volcano", "La Fortuna", ["Volcán Arenal"]),
}
VOLCANO = "Q8072 Q169358 Q159954 Q212057 Q1197120 Q29028649 Q1172599"   # volcano, stratovolcano, shield, cinder cone, complex, active, submarine...
# bulk pulls: (type, classes, min sitelinks worldwide, min sitelinks to be one of a country's top N, N)
PULL = [("park", "Q46169", 6, 2, 25), ("ski", "Q130003", 4, 1, 25), ("campground", "Q832778 Q27108230", 3, 1, 15),
        ("university", "Q3918 Q875538 Q902104 Q62078547", 15, 4, 15), ("cruise", "Q106574351", 1, 0, 50), ("volcano", VOLCANO, 8, 2, 15)]
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
def sparql(q, tag):
    p = os.path.join(CACHE, tag + "-" + hashlib.sha1(q.encode()).hexdigest()[:12] + ".json")
    if os.path.exists(p): return json.load(open(p))
    for attempt in range(6):
        try:
            req = urllib.request.Request("https://query.wikidata.org/sparql", data=urllib.parse.urlencode({"query": q, "format": "json"}).encode(),
                                         headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            j = json.load(urllib.request.urlopen(req, timeout=180))["results"]["bindings"]; json.dump(j, open(p, "w")); time.sleep(0.5); return j
        except Exception as e:
            print("wikidata retry", tag, e, flush=True); time.sleep(10 * (attempt + 1))
    raise SystemExit("wikidata failed: " + tag)
def qid(b, k): return b[k]["value"].rsplit("/", 1)[1] if k in b else ""
def val(b, k): return b[k]["value"] if k in b else ""
# ---- the shipped shards
files = {}
for f in glob.glob(os.path.join(OUT, "*.json")):
    if not f.endswith("index.json"): files[os.path.basename(f)[:-5]] = json.load(open(f, encoding="utf-8"))
before = sum(len([r for r in j["rows"].split("\n") if r]) for j in files.values())
byq = collections.defaultdict(list)
for k, j in files.items():
    for r in j["rows"].split("\n"):
        c = r.split("\t")
        if len(c) > 9 and c[9]: byq[c[9]].append(k)
changed = set()
def edit_rows(q, fn):   # rewrite every copy of the row for Wikidata id q with fn(cols) -> cols (or None to leave it)
    n = 0
    for k in set(byq.get(q, [])):
        j = files[k]; L = j["rows"].split("\n")
        for i, r in enumerate(L):
            c = r.split("\t")
            if len(c) > 9 and c[9] == q:
                c2 = fn(list(c))
                if c2 and c2 != c: L[i] = "\t".join(c2); n += 1; changed.add(k)
        j["rows"] = "\n".join(L)
    return n
def first_row(q):
    for k in byq.get(q, []):
        for r in files[k]["rows"].split("\n"):
            c = r.split("\t")
            if len(c) > 9 and c[9] == q: return c
    return None
def same_place(c, cols):   # same Wikidata id, or the same name within ~1 km
    if len(c) > 9 and c[9] and c[9] == cols[9]: return True
    try: return fold(c[0].split("|")[0]) == fold(cols[0].split("|")[0]) and abs(float(c[1]) - float(cols[1])) < 0.01 and abs(float(c[2]) - float(cols[2])) < 0.01
    except ValueError: return False
def put_new(cols):
    names = cols[0].split("|")
    for k in sorted(keys(names)):
        j = files.setdefault(k, {"v": 1, "key": k, "admin": {}, "countries": {}, "rows": ""})
        L = [x for x in j["rows"].split("\n") if x]
        if any(same_place(x.split("\t"), cols) for x in L): continue   # idempotent: never a second copy in a shard
        L.append("\t".join(cols)); j["rows"] = "\n".join(L); changed.add(k); byq[cols[9]].append(k)
# ---- nearest town (same country) from cities500, with its admin1 code
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
    lat, lon = float(c[4]), float(c[5]); towns[(iso3.get(c[8], ""), int(lat * 4), int(lon * 4))].append((lat, lon, c[1], int(c[14] or 0), c[10]))
def near(cc, lat, lon, want=""):
    best = None
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            for t in towns.get((cc, int(lat * 4) + dy, int(lon * 4) + dx), ()):
                d = math.hypot(t[0] - lat, (t[1] - lon) * math.cos(math.radians(lat)))
                score = d - min(0.08, math.log10(max(t[3], 500)) * 0.012) - (1 if want and fold(t[2]) == fold(want) else 0)
                if d < 0.6 and (best is None or score < best[0]): best = (score, t)
    return best[1] if best else None
# ---- details for a list of items (deterministic: MIN/MAX, never SAMPLE, and only countries that still exist - no USSR)
DET = {}
def details(ids, tag):
    ids = sorted(set(i for i in ids if i and i not in DET))
    for k in range(0, len(ids), 300):
        q = """SELECT ?i (MIN(STR(?c0)) AS ?c) (MIN(?cc0) AS ?cc) (MAX(?n0) AS ?n) (MIN(STR(?en0)) AS ?en) (SAMPLE(?u0) AS ?u) WHERE { VALUES ?i { %s } ?i wdt:P625 ?c0; wdt:P17 ?k. ?k wdt:P298 ?cc0. FILTER NOT EXISTS { ?k wdt:P576 ?gone }
          OPTIONAL { ?i wikibase:sitelinks ?n0 } OPTIONAL { ?i rdfs:label ?en0 FILTER(lang(?en0) = "en") } OPTIONAL { ?i wdt:P1435 ?u0 FILTER(?u0 = wd:Q9259) } } GROUP BY ?i""" % " ".join("wd:" + i for i in ids[k:k + 300])
        for b in sparql(q, "det-" + tag): DET[qid(b, "i")] = b
def newrow(q, names, typ, town_hint=""):
    b = DET.get(q)
    if not b: return None
    m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", val(b, "c")); cc = val(b, "cc")
    if not m or not cc: return None
    lat, lon = round(float(m.group(2)), 4), round(float(m.group(1)), 4)
    t = near(cc, lat, lon, town_hint); town = town_hint or (t[2] if t else ""); a1 = t[4] if t else ""
    return ["|".join(names), str(lat), str(lon), cc, a1, "0", typ, town, str(int(val(b, "n") or 0)), q] + (["U"] if val(b, "u") else [])
stats = collections.Counter(); retyped = []
# 1) volcanoes: mountains whose Wikidata class is a kind of volcano
peaks = sorted(q for q, ks in byq.items() if (first_row(q) or [""] * 7)[6] in ("peak", "landmark"))
vol = set()
for k in range(0, len(peaks), 300):
    q = "SELECT DISTINCT ?i WHERE { VALUES ?i { %s } VALUES ?v { %s } ?i wdt:P31 ?v. }" % (" ".join("wd:" + i for i in peaks[k:k + 300]), " ".join("wd:" + x for x in VOLCANO.split()))
    vol.update(qid(b, "i") for b in sparql(q, "vol"))
for q in sorted(vol):
    def f(c):
        if c[6] in ("peak", "landmark"): c[6] = "volcano"; return c
    if edit_rows(q, f): stats["retyped volcano"] += 1; retyped.append(q)
# 2) curated family places
details([v[0] for v in ITEMS.values()], "curated")
for en, (q, typ, town, extra) in ITEMS.items():
    names = [en] + extra
    if q in byq:
        def f(c, names=names, typ=typ, town=town):
            have = [fold(n) for n in c[0].split("|")]
            add = [n for n in names if fold(n) not in have]
            if add: c[0] = "|".join(c[0].split("|") + add)
            if town and c[7] != town and typ in ("themepark", "cruise", "ski", "museum", "station"): c[7] = town
            if c[6] in ("landmark", "peak", "historic", "park", "stadium") and typ != c[6] and not (c[6] == "park" and typ == "park"): c[6] = typ
            return c
        row = first_row(q); edit_rows(q, f); row2 = first_row(q)
        for k in keys(row2[0].split("|")) - set(byq[q]): put_new(row2)   # findable under its new names too
        stats["curated updated"] += 1
    else:
        b = DET.get(q); label = val(b, "en") if b else ""
        if label and fold(label) not in [fold(n) for n in names]: names.append(label)
        r = newrow(q, names, typ, town)
        if r: put_new(r); stats["curated new"] += 1; stats["new " + typ] += 1
        else: print("no position, left out:", en, q)
# 3) bulk pulls (only items not already in the sights)
for typ, qs, gmin, cmin, topn in PULL:
    q = "SELECT ?i ?n WHERE { VALUES ?cls { %s } ?i wdt:P31 ?cls; wikibase:sitelinks ?n. FILTER(?n >= %d) }" % (" ".join("wd:" + x for x in qs.split()), cmin)
    rows = sparql(q, "ids-" + typ)
    # Idempotent: rank every candidate, including ones already in the sights (their country from their row), so a
    # second run picks exactly the same top N per country and adds nothing new.
    nl = {}
    for b in rows: nl[qid(b, "i")] = max(nl.get(qid(b, "i"), 0), int(val(b, "n") or 0))
    details([i for i in nl if i not in byq], typ); byc = collections.defaultdict(list)
    for i in sorted(nl):
        if i in byq: cc = (first_row(i) or [""] * 4)[3]
        elif i in DET: cc = val(DET[i], "cc")
        else: continue
        byc[cc].append(i)
    for cc in sorted(byc):
        bl = sorted(byc[cc], key=lambda i: (-nl[i], int(i[1:])))
        for r, i in enumerate(bl):
            if i in byq or not (nl[i] >= gmin or r < topn): continue
            b = DET.get(i); en = val(b, "en") if b else ""
            if en and not re.match(r"^Q\d+$", en):
                row = newrow(i, [en], typ)
                if row: put_new(row); stats["new " + typ] += 1
    print("pull", typ, len(rows), "new so far", stats["new " + typ], flush=True)
# ---- write
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
idx["sights"] = len(seen); idx["types"] = dict(types); idx["unesco"] = unesco; idx["family"] = "v103"
json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
after = sum(len([r for r in j["rows"].split("\n") if r]) for j in files.values())
print(dict(stats)); print("rows", before, "->", after, "sights", idx["sights"], "files touched", len(changed)); print("volcano sample", retyped[:12])
