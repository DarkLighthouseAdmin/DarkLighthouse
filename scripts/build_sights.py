#!/usr/bin/env python3
"""Famstamp v79+: sights and other places to visit in place search (castles, ruins, viewpoints, waterfalls, beaches, zoos,
lighthouses, distilleries...), split into small files by the first letters of each name: data/sights/<key>.json.

Each sight is tied to its nearest town (same country, cities500) so it still counts for that country / state stamp,
and carries a type (its own stamp) and a fame rank (Wikipedia language editions, from Wikidata sitelinks).

Sources (all free and open): GeoNames allCountries + alternateNamesV2 (geonames.org, CC BY 4.0);
Wikidata (CC0) for fame ranks and for types GeoNames lacks (distilleries, breweries, wineries, pubs);
a short hand list for scenic drives and film locations (scripts/sights_extra.tsv).

Usage: python3 scripts/build_sights.py /path/to/geonames-dir [phase]   phase 3 = sights only, 5 = every type (default)
Wikidata answers are cached in <geonames-dir>/wd/ so a rebuild doesn't ask again.
"""
import sys, os, json, re, collections, math, time, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/geonames"
PHASE = int(sys.argv[2]) if len(sys.argv) > 2 else 5
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "travel-log", "app", "data", "sights")
SPLIT_AT = 2500
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"

def _fold_mod():
    # build_towns.py runs its build at import time, so copy just its fold() here (must match towns-core.js)
    import unicodedata
    SPECIAL = {"ß": "ss", "ẞ": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŀ": "l", "ŧ": "t", "ŋ": "n", "ĸ": "k", "ſ": "s"}
    def fold(s):
        s = unicodedata.normalize("NFD", str(s or "").lower())
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        s = "".join(SPECIAL.get(c, c) for c in s)
        s = re.sub(r"['’`ʻ]", "", s); s = re.sub(r"[^a-z0-9]+", " ", s).strip()
        s = re.sub(r"\b(st|ste|saint) ", "saint ", s + " "); s = re.sub(r"\bmt ", "mount ", s); s = re.sub(r"\bft ", "fort ", s)
        return s.strip()
    def latin(s):
        t = unicodedata.normalize("NFD", s)
        return all(unicodedata.category(c) == "Mn" or ord(c) < 0x250 or 0x1E00 <= ord(c) <= 0x1EFF or c in "’ʻ" for c in t) and re.search(r"[A-Za-z]", s)
    return fold, latin
fold, latin = _fold_mod()

# GeoNames feature code -> (type, phase, keep: "all" | "link" = only places with a Wikipedia article)
CODES = {
  "S.CSTL": ("castle", 3, "all"), "S.PAL": ("palace", 3, "all"), "S.FT": ("castle", 3, "link"),
  "S.RUIN": ("ruin", 3, "all"), "S.AMTH": ("ruin", 3, "all"), "S.ANS": ("ancient", 3, "all"), "S.PYR": ("ancient", 3, "all"), "S.PYRS": ("ancient", 3, "all"),
  "S.HSTS": ("historic", 3, "all"), "S.WALL": ("historic", 3, "all"), "S.WALLA": ("historic", 3, "all"), "S.ESTT": ("historic", 3, "link"),
  "S.MSTY": ("abbey", 3, "link"), "S.CH": ("cathedral", 3, "link"), "S.TMPL": ("temple", 3, "link"), "S.SHRN": ("temple", 3, "link"), "S.PGDA": ("temple", 3, "link"),
  "S.MNMT": ("monument", 3, "all"), "S.ARCH": ("monument", 3, "all"), "S.TOWR": ("tower", 3, "link"), "S.SQR": ("landmark", 3, "link"), "S.OPRA": ("landmark", 3, "all"),
  "S.MUS": ("museum", 3, "all"), "S.OBPT": ("viewpoint", 3, "all"), "H.FLLS": ("waterfall", 3, "all"),
  # phase 5: more place types
  "T.BCH": ("beach", 5, "all"), "T.BCHS": ("beach", 5, "all"), "H.LK": ("lake", 5, "link"), "T.ISL": ("island", 5, "link"),
  "T.MT": ("peak", 5, "link"), "T.PK": ("peak", 5, "link"), "T.VLC": ("peak", 5, "link"), "S.CAVE": ("cave", 5, "all"), "H.CAVE": ("cave", 5, "all"),
  "S.GDN": ("garden", 5, "all"), "R.TRL": ("trail", 5, "all"), "L.PRK": ("park", 5, "link"), "T.CNYN": ("canyon", 5, "link"), "T.GRGE": ("canyon", 5, "link"),
  "T.PT": ("viewpoint", 5, "link"), "T.CLF": ("viewpoint", 5, "link"), "T.RK": ("landmark", 5, "link"), "T.HLL": ("peak", 5, "link"),
  "H.GLCR": ("glacier", 5, "link"), "H.GYSR": ("geyser", 5, "all"),
  "S.ZOO": ("zoo", 5, "all"), "L.AMUS": ("themepark", 5, "all"),
  "S.BRKW": ("brewery", 5, "all"), "V.VIN": ("winery", 5, "link"), "V.VINS": ("winery", 5, "all"),
  "S.LTHSE": ("lighthouse", 5, "all"), "S.FYT": ("ferry", 5, "all"), "S.FY": ("ferry", 5, "link"), "S.RSTN": ("station", 5, "link"),
  "S.STDM": ("stadium", 5, "all"), "S.BDG": ("bridge", 5, "link"),
}
CATHEDRAL = re.compile(r"cathedral|minster|basilica|abbey|priory|kathedr|\bdom\b|catedral|cath[ée]drale|cattedrale|duomo|katedr|notre[- ]dame|sagrada|\bsé\b", re.I)
ABBEY = re.compile(r"abbey|abbaye|abtei|priory|monaster|kloster|mosteiro|monast|abbazia|abadía|friary|\babdij", re.I)

iso3, cname = {}, {}
for line in open(os.path.join(SRC, "countryInfo.txt"), encoding="utf-8"):
    if line.startswith("#"): continue
    c = line.rstrip("\n").split("\t")
    if len(c) >= 16: iso3[c[0]] = c[1]; cname[c[1]] = c[4]
admin = {}
for line in open(os.path.join(SRC, "admin1CodesASCII.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t"); cc, a1 = c[0].split(".", 1)
    if cc in iso3: admin[iso3[cc] + "." + a1] = c[1]

# ---- candidates
cand = {}
for line in open(os.path.join(SRC, "allCountries.txt"), encoding="utf-8"):
    c = line.split("\t", 12)
    code = c[6] + "." + c[7]
    t = CODES.get(code)
    if not t or t[1] > PHASE or c[8] not in iso3: continue
    cand[c[0]] = {"name": c[1], "ascii": c[2], "lat": round(float(c[4]), 4), "lon": round(float(c[5]), 4), "cc": c[8], "a1": c[10], "code": code, "type": t[0], "keep": t[2], "links": 0, "wd": "", "alt": []}
print("candidates", len(cand))
with open(os.path.join(SRC, "alternateNamesV2.txt"), encoding="utf-8") as f:
    for line in f:
        c = line.rstrip("\n").split("\t")
        s = cand.get(c[1])
        if not s: continue
        lang = c[2]
        if lang == "link":
            if "wikipedia.org" in c[3]:
                s["links"] += 1
                if "//en.wikipedia.org/wiki/" in c[3] and not s.get("en"): s["en"] = c[3].split("/wiki/", 1)[1]
        elif lang == "wkdt": s["wd"] = c[3]
        elif lang in ("en", "") or len(lang) == 2:
            if len(c) > 7 and (c[6] == "1" or c[7] == "1"): continue
            nm = c[3].strip()
            if nm and latin(nm) and len(nm) <= 70 and lang in ("en", "", ) : s["alt"].append((0 if lang == "en" else 1, 0 if c[4] == "1" else 1, nm))
keep = {}
for gid, s in cand.items():
    if s["keep"] == "link" and not s["links"] and not s["wd"]: continue
    nm = s["name"] + " " + " ".join(a[2] for a in s["alt"])
    if s["code"] == "S.CH":
        if not CATHEDRAL.search(nm): continue
        if ABBEY.search(nm) and not re.search(r"cathedral|basilica|kathedr|catedral|cath[ée]drale|duomo", nm, re.I): s["type"] = "abbey"
    if s["type"] == "abbey" and not ABBEY.search(nm) and CATHEDRAL.search(nm): s["type"] = "cathedral"
    if s["type"] == "zoo" and re.search(r"aquarium|sea ?life|oceanari|aquarien", nm, re.I): s["type"] = "aquarium"
    if s["type"] == "themepark" and re.search(r"water ?park|aqua ?park|wet ?n|splash|aquapark|wasserpark", nm, re.I): s["type"] = "waterpark"
    if s["type"] == "ferry" and s["code"] == "S.FY" and not re.search(r"ferry|ferries|terminal|pier", nm, re.I): continue
    keep[gid] = s
print("kept", len(keep), collections.Counter(s["type"] for s in keep.values()).most_common())

# ---- extra places GeoNames lacks: Wikidata (distilleries, breweries, wineries, pubs) and the hand list (drives, film locations)
os.makedirs(os.path.join(SRC, "wd"), exist_ok=True)
def sparql(q, cache):
    p = os.path.join(SRC, "wd", cache)
    if os.path.exists(p): return json.load(open(p))
    for attempt in range(4):
        try:
            req = urllib.request.Request("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"}), headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            j = json.load(urllib.request.urlopen(req, timeout=120)); json.dump(j, open(p, "w")); time.sleep(1); return j
        except Exception as e:
            print("wikidata retry", cache, e); time.sleep(10 * (attempt + 1))
    raise SystemExit("wikidata failed: " + cache)
extra = {}
if PHASE >= 5:
    WD_TYPES = [("distillery", "wd:Q131734 wd:Q10373548 wd:Q1631629 wd:Q27106436", 0), ("brewery", "wd:Q131734 wd:Q15731356 wd:Q1062621", 1),
                ("winery", "wd:Q156362", 1), ("pub", "wd:Q212198", 1), ("aquarium", "wd:Q2281788", 0), ("themepark", "wd:Q2416723", 0), ("waterpark", "wd:Q740326", 0),
                ("lighthouse", "wd:Q39715", 1), ("bridge", "wd:Q12280", 8), ("stadium", "wd:Q483110", 3), ("zoo", "wd:Q43501", 0)]
    for typ, classes, minlinks in WD_TYPES:
        q = """SELECT ?i ?l ?en ?c ?cc ?n WHERE { VALUES ?cls { %s } ?i wdt:P31 ?cls; wdt:P625 ?c; wikibase:sitelinks ?n. FILTER(?n >= %d)
          OPTIONAL { ?i rdfs:label ?en FILTER(lang(?en)="en") } OPTIONAL { ?i wdt:P17/wdt:P298 ?cc } }""" % (classes, max(minlinks, 0))
        j = sparql(q, typ + ".json"); n0 = 0
        for b in j["results"]["bindings"]:
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", b["c"]["value"]); en = b.get("en", {}).get("value", "")
            if not m or not en or not latin(en) or not b.get("cc"): continue
            # distillery class Q131734 is "brewery"; only keep names that say distillery under that type
            if typ == "distillery" and not re.search(r"distill|whisk|brennerei|destiler|distiller", en, re.I): continue
            if typ == "brewery" and re.search(r"distill", en, re.I): continue
            wd = b["i"]["value"].rsplit("/", 1)[1]
            if wd in extra: continue
            extra[wd] = {"name": en, "lat": round(float(m.group(2)), 4), "lon": round(float(m.group(1)), 4), "cc3": b["cc"]["value"], "type": typ, "sl": int(b["n"]["value"]), "wd": wd, "alt": []}; n0 += 1
        print("wikidata", typ, n0)
hand = []
xp = os.path.join(HERE, "sights_extra.tsv")
if os.path.exists(xp):
    for line in open(xp, encoding="utf-8"):
        if not line.strip() or line.startswith("#"): continue
        c = line.rstrip("\n").split("\t")   # type, name|alt, lat, lon, ISO3, town, rank
        if (PHASE < 5 and c[0] not in ("castle", "landmark", "monument", "ruin", "viewpoint")): continue
        hand.append(c)

# ---- places GeoNames links to English Wikipedia but not to Wikidata (Stonehenge, the Eiffel Tower...): ask Wikipedia for the Wikidata id
encache = os.path.join(SRC, "wd", "enwiki.json")
enq = json.load(open(encache)) if os.path.exists(encache) else {}
need = sorted(set(urllib.parse.unquote(s["en"]).replace("_", " ") for s in keep.values() if not s["wd"] and s.get("en")))
need = [t for t in need if t not in enq and "|" not in t and len(t) < 250]
print("wikipedia titles to look up", len(need))
for k in range(0, len(need), 50):
    part = need[k:k + 50]
    for attempt in range(5):
        try:
            req = urllib.request.Request("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "prop": "pageprops", "ppprop": "wikibase_item", "redirects": 1, "titles": "|".join(part), "format": "json", "formatversion": 2}), headers={"User-Agent": UA})
            q = json.load(urllib.request.urlopen(req, timeout=60))["query"]; break
        except Exception as e:
            print("retry", k, e); time.sleep(5 * (attempt + 1))
    else: raise SystemExit("wikipedia lookup failed")
    m = {}
    for n in q.get("normalized", []): m[n["from"]] = n["to"]
    rd = {r["from"]: r["to"] for r in q.get("redirects", [])}
    byt = {pg["title"]: (pg.get("pageprops") or {}).get("wikibase_item", "") for pg in q.get("pages", [])}
    for t in part:
        u = m.get(t, t); u = rd.get(u, u); enq[t] = byt.get(u, "")
    if k % 5000 == 0: json.dump(enq, open(encache, "w")); print("wikipedia", k, len(need))
    time.sleep(0.2)
json.dump(enq, open(encache, "w"))
for s in keep.values():
    if not s["wd"] and s.get("en"): s["wd"] = enq.get(urllib.parse.unquote(s["en"]).replace("_", " "), "")

# ---- fame: Wikipedia language editions per place (Wikidata sitelinks), for GeoNames places that link to Wikidata
ids = sorted(set(s["wd"] for s in keep.values() if s["wd"]))
sl = {}
cache = os.path.join(SRC, "wd", "sitelinks.json")
if os.path.exists(cache): sl = json.load(open(cache))
todo = [i for i in ids if i not in sl]
print("sitelinks to fetch", len(todo))
for k in range(0, len(todo), 300):
    part = todo[k:k + 300]
    q = "SELECT ?i ?n WHERE { VALUES ?i { %s } ?i wikibase:sitelinks ?n }" % " ".join("wd:" + i for i in part)
    for attempt in range(5):
        try:
            req = urllib.request.Request("https://query.wikidata.org/sparql", data=urllib.parse.urlencode({"query": q, "format": "json"}).encode(), headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            j = json.load(urllib.request.urlopen(req, timeout=120)); break
        except Exception as e:
            print("retry", k, e); time.sleep(8 * (attempt + 1))
    else: raise SystemExit("sitelinks failed")
    for i in part: sl.setdefault(i, 0)
    for b in j["results"]["bindings"]: sl[b["i"]["value"].rsplit("/", 1)[1]] = int(b["n"]["value"])
    if k % 6000 == 0: json.dump(sl, open(cache, "w")); print("sitelinks", k, len(todo))
    time.sleep(0.4)
json.dump(sl, open(cache, "w"))

# ---- nearest town (same country) from cities500
towns = collections.defaultdict(list)
for line in open(os.path.join(SRC, "cities500.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t")
    if c[6] != "P" or c[7] in ("PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"): continue
    lat, lon = float(c[4]), float(c[5])
    towns[(c[8], int(lat * 4), int(lon * 4))].append((lat, lon, c[1], int(c[14] or 0), c[10]))
cc2 = {v: k for k, v in iso3.items()}
def near(cc, lat, lon):
    best = None
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for t in towns.get((cc, int(lat * 4) + dy, int(lon * 4) + dx), ()):
                d = math.hypot(t[0] - lat, (t[1] - lon) * math.cos(math.radians(lat)))
                # a big town a little further away beats a hamlet next door (Edinburgh Castle -> Edinburgh)
                score = d - min(0.08, math.log10(max(t[3], 500)) * 0.012)
                if d < 0.3 and (best is None or score < best[0]): best = (score, t)
    return best[1] if best else None

# the most numerous nature types need a few real Wikipedia articles (Wikidata sitelinks) to be listed
MINRANK = {"viewpoint": 0, "peak": 4, "island": 3, "lake": 2, "glacier": 2, "canyon": 2, "park": 2, "station": 3, "tower": 2}
CODEMIN = {"T.PT": 3, "T.CLF": 3, "T.RK": 3, "T.HLL": 6}
items = []
def add(names, lat, lon, cc3, a1, typ, town, rank, wd):
    names = [n.replace("|", " ").replace("\t", " ").strip() for n in names if n and n.strip()]
    seen, nn = set(), []
    for n in names:
        f = fold(n)
        if f and f not in seen: seen.add(f); nn.append(n)
    if nn: items.append((nn, lat, lon, cc3, a1, typ, town, rank, wd))
for gid, s in keep.items():
    alts = [a[2] for a in sorted(s["alt"])]
    en = [a[2] for a in sorted(s["alt"]) if a[0] == 0]
    names = ([en[0]] if en else []) + [s["name"]] + ([s["ascii"]] if s["ascii"] and latin(s["ascii"]) else []) + alts[:4]
    t = near(s["cc"], s["lat"], s["lon"])
    rank = sl.get(s["wd"], 0) if s["wd"] else 0
    if not rank and s["links"]: rank = 1
    if rank < MINRANK.get(s["type"], 0) or rank < CODEMIN.get(s["code"], 0): continue   # bot-made one-line articles (cebwiki/svwiki) don't make a peak or lake worth a stamp
    add(names, s["lat"], s["lon"], iso3[s["cc"]], t[4] if t else s["a1"], s["type"], t[2] if t else "", rank, s["wd"])
known = set(s["wd"] for s in keep.values() if s["wd"])
for wd, s in extra.items():
    if wd in known or s["cc3"] not in cc2: continue
    t = near(cc2[s["cc3"]], s["lat"], s["lon"])
    add([s["name"]], s["lat"], s["lon"], s["cc3"], t[4] if t else "", s["type"], t[2] if t else "", s["sl"], wd)
hw = set(c[7] for c in hand if len(c) > 7 and c[7])
if hw: items[:] = [it for it in items if it[8] not in hw]   # the hand list wins (e.g. Glenfinnan Viaduct is a film location, not just a bridge)
for c in hand:
    names = c[1].split("|"); t = near(cc2.get(c[4], ""), float(c[2]), float(c[3]))
    add(names, float(c[2]), float(c[3]), c[4], t[4] if t else "", c[0], c[5] or (t[2] if t else ""), int(c[6] or 0), c[7] if len(c) > 7 else "")
print("sights", len(items), collections.Counter(i[5] for i in items).most_common())

ARTICLE = re.compile(r"^(the|la|le|les|el|il|lo|der|die|das|de|het|l) ")
by2 = collections.defaultdict(list)
for ix, it in enumerate(items):
    keys = set()
    for nm in it[0]:
        f = fold(nm)
        for g in (f, ARTICLE.sub("", f)):
            if len(g.replace(" ", "")) >= 2: keys.add(g.replace(" ", "")[:2])
    for k in keys: by2[k].append(ix)
os.makedirs(OUT, exist_ok=True)
for fn in os.listdir(OUT):
    if fn.endswith(".json"): os.remove(os.path.join(OUT, fn))   # generated files only
files, total, split, dropped, MAXFILE = {}, 0, [], [], 480000
def write(key, ixs):
    global total
    ixs = sorted(set(ixs), key=lambda i: (-items[i][7], items[i][0][0]))
    while True:
        rows, adm, cn = [], {}, {}
        for i in ixs:
            nn, lat, lon, c3, a1, typ, town, rank, wd = items[i]
            ak = c3 + "." + a1
            if ak in admin: adm[ak] = admin[ak]
            cn[c3] = cname.get(c3, c3)
            rows.append("\t".join(["|".join(nn), str(lat), str(lon), c3, a1, "0", typ, town, str(rank), wd]))
        body = json.dumps({"v": 1, "key": key, "admin": adm, "countries": cn, "rows": "\n".join(rows)}, ensure_ascii=False, separators=(",", ":"))
        if len(body.encode("utf-8")) < MAXFILE: break
        cut = int(len(ixs) * 0.92); dropped.extend(ixs[cut:]); ixs = ixs[:cut]   # a phone-sized file: the least-known go first
    open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8").write(body); files[key] = len(body); total += len(body)
for k2, ixs in by2.items():
    if len(ixs) <= SPLIT_AT: write(k2, ixs); continue
    split.append(k2); by3 = collections.defaultdict(list)
    for i in ixs:
        for nm in items[i][0]:
            f = fold(nm)
            for g in (f, ARTICLE.sub("", f)):
                g = g.replace(" ", "")
                if g[:2] == k2: by3[g[:3] if len(g) >= 3 else g[:2] + "_"].append(i)
    for k3, it in by3.items(): write(k3, it)
json.dump({"v": 1, "phase": PHASE, "source": "GeoNames (geonames.org, CC BY 4.0) + Wikidata (CC0)", "split": sorted(split), "sights": len(items),
           "types": dict(collections.Counter(i[5] for i in items))}, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
print("left out to keep files small", len(set(dropped)))
print("files", len(files), "total MB", round(total / 1e6, 1), "biggest", sorted(files.items(), key=lambda x: -x[1])[:5])
