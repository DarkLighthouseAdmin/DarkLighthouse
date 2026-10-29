#!/usr/bin/env python3
"""Famstamp v96: worldwide, culturally complete sights. Runs after build_sights.py on data/sights/*.json, and is safe to rerun.

1. Every sight with a Wikidata id and some fame gets its type re-derived from what Wikidata says it is (P31, "instance of"):
   the Blue Mosque is a mosque, the Basilica Cistern a cistern, the Taj Mahal a tomb, the Forbidden City a palace.
2. Searchable names: the English label, English aliases ("Blue Mosque" on the Sultan Ahmed Mosque), the English Wikipedia
   title and the local-language label (Latin script), on top of what GeoNames gave.
3. New places from Wikidata, by class: places of worship of every faith (mosques, churches, cathedrals, basilicas, synagogues,
   Hindu, Buddhist, Jain, Sikh, Taoist and Confucian temples, Shinto shrines, pagodas, stupas, monasteries) and the other cultural
   and tourist classes (castles, palaces, forts, tombs, cisterns, markets and bazaars, squares, old towns, amphitheatres, towers,
   monuments, archaeological sites, hot springs), plus every UNESCO World Heritage Site with a location. Notability cutoff:
   Wikipedia language editions (sitelinks); each country also keeps its own top 20 per group so smaller countries are covered.
4. A UNESCO World Heritage flag (column 11 = "U").
Rows are merged by Wikidata id, else by the same name within ~1.5 km; nothing is renamed away and ids are kept (stamps are keyed
by Wikidata id), so earned stamps may redraw with a new type but never vanish. Sources: Wikidata (CC0).
Usage: python3 scripts/enrich_sights.py [/workspace/geonames]      Wikidata answers are cached in <geonames>/wd/enrich/.
"""
import sys, os, json, re, glob, collections, math, time, hashlib, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/geonames"
OUT = os.path.join(HERE, "..", "travel-log", "app", "data", "sights")
CACHE = os.path.join(SRC, "wd", "enrich"); os.makedirs(CACHE, exist_ok=True)
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"
SPLIT_AT, MAXFILE = 2500, 480000
import unicodedata
SPECIAL = {"ß": "ss", "ẞ": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŀ": "l", "ŧ": "t", "ŋ": "n", "ĸ": "k", "ſ": "s"}
ARTICLE = re.compile(r"^(the|la|le|les|el|il|lo|der|die|das|de|het|l) ")
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

# ---- Wikidata class -> our type. Earlier in the list wins when a place is several things (Hagia Sophia: museum + mosque = mosque).
CLASSES = [
  ("mosque", "Q32815"), ("synagogue", "Q34627"), ("gurdwara", "Q337986"), ("pagoda", "Q199451"), ("stupa", "Q180987 Q1091037"),
  ("shrine", "Q845945"),
  ("temple", "Q842402 Q5393308 Q2613100 Q2680845 Q1151612 Q618618 Q427287 Q58621988 Q855747 Q867143 Q267596 Q44539"),
  ("cathedral", "Q2977 Q56242215 Q2577114"), ("basilica", "Q163687 Q120560"),
  ("church", "Q16970 Q1088552 Q2031836 Q317557 Q1571674 Q108325 Q1129743"),
  ("abbey", "Q160742"), ("monastery", "Q44613 Q1128397 Q54074585 Q844619"), ("shrine", "Q697295"),
  ("cistern", "Q838858 Q93429857"), ("tomb", "Q162875 Q381885 Q16190649 Q180927 Q200141"), ("amphitheater", "Q7362268 Q54831"),
  ("palace", "Q16560 Q53536964 Q4156067"), ("castle", "Q23413 Q751876 Q17715832"), ("fort", "Q1785071 Q57831 Q88291 Q677678 Q57821"),
  ("market", "Q219760 Q510177 Q2080521 Q330284 Q37654"), ("square", "Q174782 Q2997369"), ("oldtown", "Q676050"),
  ("onsen", "Q655311 Q177380 Q1004887"), ("tower", "Q1440300 Q853854 Q200334 Q11303 Q12518"),
  ("monument", "Q143912 Q4989906 Q5003624 Q179700 Q82117"), ("ancient", "Q839954 Q15661340"), ("ruin", "Q109607"),
  ("street", "Q62685721 Q21000333"), ("museum", "Q33506 Q207694 Q16735822"), ("deck", "Q177305"),   # a deck only when it is nothing else
]
PRI, Q2T = {}, {}
for n, (t, qs) in enumerate(CLASSES):
    for q in qs.split():
        if q not in Q2T: Q2T[q] = t; PRI[q] = n
# a name that says what the place is wins over Wikidata's class (Edinburgh Castle stays a castle, Westminster Abbey an abbey)
SAYS = {"castle": "castle schloss burg castillo chateau castello zamek hrad kasteel slot", "abbey": "abbey abbaye abtei abbazia abadia",
        "cathedral": "cathedral kathedrale cathedrale catedral cattedrale duomo dom katedrala", "basilica": "basilica basilika basilique bazilika",
        "tower": "tower turm tour torre", "fort": "fort fortress citadel fortaleza festung forte", "palace": "palace palais palazzo palacio palast",
        "temple": "temple", "museum": "museum musee museo muzeum", "mosque": "mosque camii masjid", "church": "church kirche eglise iglesia chiesa kerk kosciol", "monument": "statue monument memorial"}
SAYS = {k: set(v.split()) for k, v in SAYS.items()}
GENERIC = {"church": {"cathedral", "basilica", "abbey"}}   # never step down from a more exact kind of church
def retype_ok(it, t):
    w = set(fold(it["names"][0]).split())
    if it["type"] == "temple" and t in ("gurdwara", "pagoda", "stupa"): return True
    if it["type"] in SAYS and w & SAYS[it["type"]] and not (t in SAYS and w & SAYS[t]): return False
    if it["type"] in GENERIC.get(t, ()): return False
    if it["type"] == "temple" and t in ("gurdwara", "pagoda", "stupa"): return True   # the Golden Temple is a gurdwara
    return True
def type_from(p31):
    best = None
    for q in p31:
        if q in PRI and (best is None or PRI[q] < PRI[best]): best = q
    return Q2T[best] if best else None
# GeoNames knows these better than Wikidata classes do, so they keep their type
KEEP = {"peak", "lake", "island", "beach", "glacier", "canyon", "waterfall", "cave", "geyser", "trail", "park", "garden", "zoo", "aquarium", "themepark",
        "waterpark", "playground", "distillery", "brewery", "winery", "pub", "lighthouse", "ferry", "drive", "film", "bridge", "viewpoint"}
# pull groups for new places: (classes, min sitelinks worldwide, min sitelinks to be a country's top-20)
PULL = [("mosque", "Q32815", 6, 2), ("synagogue", "Q34627", 5, 2), ("gurdwara", "Q337986", 3, 2), ("pagoda", "Q199451", 4, 2), ("stupa", "Q180987 Q1091037", 3, 2),
        ("shrine", "Q845945 Q697295", 5, 2), ("temple", "Q842402 Q5393308 Q2613100 Q2680845 Q1151612 Q618618 Q427287 Q58621988 Q855747 Q867143 Q267596 Q44539", 5, 2),
        ("cathedral", "Q2977 Q56242215 Q2577114", 6, 2), ("basilica", "Q163687 Q120560", 6, 2), ("church", "Q16970 Q1088552 Q2031836", 12, 3),
        ("monastery", "Q44613 Q160742 Q1128397 Q54074585", 6, 2), ("cistern", "Q838858 Q93429857", 3, 2), ("tomb", "Q162875 Q381885 Q16190649", 5, 2),
        ("amphitheater", "Q7362268", 3, 2), ("palace", "Q16560 Q53536964", 6, 2), ("castle", "Q23413 Q751876", 8, 3), ("fort", "Q1785071 Q57831 Q88291 Q677678", 6, 2),
        ("market", "Q219760 Q510177 Q2080521 Q330284", 4, 2), ("square", "Q174782 Q2997369", 8, 3), ("oldtown", "Q676050", 4, 2),
        ("onsen", "Q655311 Q177380 Q1004887", 5, 2), ("deck", "Q177305", 6, 2), ("tower", "Q11303 Q853854 Q12518", 15, 4),
        ("monument", "Q143912 Q4989906 Q5003624", 10, 3), ("ancient", "Q839954 Q15661340", 8, 3), ("street", "Q62685721 Q21000333", 10, 3), ("museum", "Q33506 Q207694", 15, 4)]
TOPN = 20
# a country's language for the "local name" alias (Latin-script labels only)
LANG = {"TUR": "tr", "ESP": "es", "MEX": "es", "ARG": "es", "PER": "es", "CHL": "es", "COL": "es", "CUB": "es", "BOL": "es", "ECU": "es", "FRA": "fr", "BEL": "fr", "MAR": "fr",
        "DEU": "de", "AUT": "de", "CHE": "de", "ITA": "it", "VAT": "it", "PRT": "pt", "BRA": "pt", "NLD": "nl", "POL": "pl", "CZE": "cs", "SVK": "sk", "HUN": "hu", "ROU": "ro",
        "HRV": "hr", "SVN": "sl", "SWE": "sv", "NOR": "nb", "DNK": "da", "FIN": "fi", "ISL": "is", "IRL": "ga", "IDN": "id", "MYS": "ms", "VNM": "vi", "PHL": "tl",
        "TZA": "sw", "KEN": "sw", "LTU": "lt", "LVA": "lv", "EST": "et", "MLT": "mt", "ALB": "sq", "AZE": "az", "UZB": "uz", "TKM": "tk", "MNE": "sh", "BIH": "bs"}

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

# ---- current rows (one item can sit in several key files)
admin, cname, items, seen = {}, {}, [], {}
IN = os.environ.get("SIGHTS_IN", OUT)   # read from a clean copy of the shipped files so reruns never stack
bykey = {}
for f in sorted(glob.glob(os.path.join(IN, "*.json"))):
    if f.endswith("index.json"): continue
    j = json.load(open(f, encoding="utf-8")); admin.update(j.get("admin", {})); cname.update(j.get("countries", {}))
    for r in j["rows"].split("\n"):
        if not r: continue
        if r in seen: seen[r]["files"].add(j["key"]); continue
        c = r.split("\t")
        while len(c) < 11: c.append("")
        items.append({"names": c[0].split("|"), "lat": float(c[1]), "lon": float(c[2]), "cc": c[3], "a1": c[4], "type": c[6], "town": c[7], "rank": int(c[8] or 0), "wd": c[9], "u": c[10] == "U", "old": 1, "files": {j["key"]}})
        seen[r] = items[-1]
seen = None
print("rows before", len(items), flush=True)
byq = collections.defaultdict(list)
for it in items:
    if it["wd"]: byq[it["wd"]].append(it)

# ---- 1+2: what Wikidata says about each known sight with some fame
INFO = {}
def info(ids, tag):
    ids = [i for i in ids if i not in INFO]
    for k in range(0, len(ids), 250):
        part = ids[k:k + 250]
        q = """SELECT ?i ?n (GROUP_CONCAT(DISTINCT STRAFTER(STR(?c), "entity/"); separator=" ") AS ?p31) (GROUP_CONCAT(DISTINCT ?al; separator="|") AS ?als)
          (SAMPLE(?en) AS ?enl) (SAMPLE(?t) AS ?wt) (SAMPLE(?h) AS ?whs) WHERE { VALUES ?i { %s } OPTIONAL { ?i wikibase:sitelinks ?n }
          OPTIONAL { ?i wdt:P31 ?c } OPTIONAL { ?i skos:altLabel ?al FILTER(lang(?al) = "en") } OPTIONAL { ?i rdfs:label ?en FILTER(lang(?en) = "en") }
          OPTIONAL { ?a schema:about ?i; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?t } OPTIONAL { ?i wdt:P1435 wd:Q9259 BIND("1" AS ?h) } } GROUP BY ?i ?n""" % " ".join("wd:" + i for i in part)
        for b in sparql(q, tag):
            INFO[qid(b, "i")] = {"n": int(val(b, "n") or 0), "p31": val(b, "p31").split(), "al": [a for a in val(b, "als").split("|") if a], "en": val(b, "enl"), "wt": val(b, "wt"), "u": bool(val(b, "whs"))}
        if k % 10000 == 0: print(tag, k, len(ids), flush=True)
def local_labels(ids, langs_of):
    out = {}
    want = [(i, LANG[langs_of[i]]) for i in ids if langs_of.get(i) in LANG]
    bylang = collections.defaultdict(list)
    for i, l in want: bylang[l].append(i)
    for l, L in bylang.items():
        for k in range(0, len(L), 400):
            q = 'SELECT ?i ?l WHERE { VALUES ?i { %s } ?i rdfs:label ?l FILTER(lang(?l) = "%s") }' % (" ".join("wd:" + i for i in L[k:k + 400]), l)
            for b in sparql(q, "local-" + l): out[qid(b, "i")] = val(b, "l")
    return out
known = sorted(q for q, L in byq.items() if max(x["rank"] for x in L) >= 5)
print("known sights to check", len(known), flush=True)
info(known, "known")

# ---- 3: new places by class, and every UNESCO site
cand = {}
def take(b, typ):
    q = qid(b, "i"); m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", val(b, "c"))
    if not q or not m or not val(b, "cc"): return
    o = cand.get(q) or {"wd": q, "lat": round(float(m.group(2)), 4), "lon": round(float(m.group(1)), 4), "cc": val(b, "cc"), "n": int(val(b, "n") or 0), "en": val(b, "en"), "types": set()}
    if typ: o["types"].add(typ)
    cand[q] = o
DET = {}
def details(ids, tag):   # coords and country for a list of items, in small batches (one big join times out)
    ids = sorted(set(i for i in ids if i not in DET))
    for k in range(0, len(ids), 400):
        q = """SELECT ?i (SAMPLE(?c0) AS ?c) (SAMPLE(?cc0) AS ?cc) (SAMPLE(?n0) AS ?n) (SAMPLE(?en0) AS ?en) WHERE { VALUES ?i { %s } ?i wdt:P625 ?c0; wdt:P17 ?k. ?k wdt:P298 ?cc0.
          OPTIONAL { ?i wikibase:sitelinks ?n0 } OPTIONAL { ?i rdfs:label ?en0 FILTER(lang(?en0) = "en") } } GROUP BY ?i""" % " ".join("wd:" + i for i in ids[k:k + 400])
        for b in sparql(q, "det-" + tag): DET[qid(b, "i")] = b
for typ, qs, gmin, cmin in PULL:
    q = """SELECT ?i ?n WHERE { VALUES ?cls { %s } ?i wdt:P31 ?cls; wikibase:sitelinks ?n. FILTER(?n >= %d) }""" % (" ".join("wd:" + x for x in qs.split()), cmin)
    ids = [qid(b, "i") for b in sparql(q, "ids-" + typ)]
    details(ids, typ); L = [DET[i] for i in ids if i in DET]; byc = collections.defaultdict(list)
    for b in L: byc[val(b, "cc")].append(b)
    kept = 0
    for cc, bl in byc.items():
        bl.sort(key=lambda b: -int(val(b, "n") or 0))
        for r, b in enumerate(bl):
            if int(val(b, "n") or 0) >= gmin or r < TOPN: take(b, typ); kept += 1
    print("pull", typ, len(ids), "located", len(L), "kept", kept, flush=True)
uids = [qid(b, "i") for b in sparql("""SELECT DISTINCT ?i WHERE { ?i wdt:P1435 wd:Q9259 }""", "unesco-ids")]
details(uids, "unesco"); L = [DET[i] for i in uids if i in DET]
for b in L: take(b, None)
UNESCO = set(qid(b, "i") for b in L)
print("UNESCO sites with a location", len(UNESCO), flush=True)
info(sorted(q for q in cand if q not in INFO), "new")

# ---- nearest town (same country) from cities500, as in build_sights.py
iso3 = {}
for line in open(os.path.join(SRC, "countryInfo.txt"), encoding="utf-8"):
    if line.startswith("#"): continue
    c = line.rstrip("\n").split("\t")
    if len(c) >= 16: iso3[c[0]] = c[1]; cname.setdefault(c[1], c[4])
cc2 = {v: k for k, v in iso3.items()}
adm_all = {}
for line in open(os.path.join(SRC, "admin1CodesASCII.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t"); a, b = c[0].split(".", 1)
    if a in iso3: adm_all[iso3[a] + "." + b] = c[1]
towns = collections.defaultdict(list)
for line in open(os.path.join(SRC, "cities500.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t")
    if c[6] != "P" or c[7] in ("PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"): continue
    lat, lon = float(c[4]), float(c[5]); towns[(c[8], int(lat * 4), int(lon * 4))].append((lat, lon, c[1], int(c[14] or 0), c[10]))
def near(cc, lat, lon):
    best = None
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for t in towns.get((cc, int(lat * 4) + dy, int(lon * 4) + dx), ()):
                d = math.hypot(t[0] - lat, (t[1] - lon) * math.cos(math.radians(lat)))
                score = d - min(0.08, math.log10(max(t[3], 500)) * 0.012)
                if d < 0.3 and (best is None or score < best[0]): best = (score, t)
    return best[1] if best else None

def clean_title(t): return re.sub(r"\s*\([^)]*\)$", "", t or "").strip()
def add_names(it, names):
    have = set(fold(n) for n in it["names"]); added = 0
    for n in names:
        n = re.sub(r"^[Tt]he ", "", (n or "").replace("|", " ").replace("\t", " ").strip())   # "The Blue Mosque" is found as "Blue Mosque"; keeps the busy "the" file small
        if not n or len(n) > 70 or not latin(n): continue
        f = fold(n)
        if len(f) < 3 or f in have: continue
        if len(it["names"]) >= 12: break
        it["names"].append(n); have.add(f); added += 1
    return added

# ---- merge
stats = collections.Counter(); changes = []; byname = collections.defaultdict(list)
for it in items:
    for n in it["names"]: byname[fold(n)].append(it)
langs_of = {}
for q in set(list(INFO.keys())):
    L = byq.get(q)
    if L: langs_of[q] = L[0]["cc"]
for q, o in cand.items(): langs_of.setdefault(q, o["cc"])
loc = local_labels(sorted(langs_of), langs_of)
for q, inf in INFO.items():
    for it in byq.get(q, []):
        t = type_from(inf["p31"])
        if t and t != it["type"] and it["type"] not in KEEP and retype_ok(it, t):
            stats["retyped"] += 1; changes.append((it["rank"], it["names"][0], it["cc"], it["type"], t)); it["type"] = t
        names = []
        if inf["en"]: names.append(inf["en"])
        names += inf["al"][:6]
        if inf["wt"]: names.append(clean_title(inf["wt"]))
        if loc.get(q): names.append(loc[q])
        stats["aliases"] += add_names(it, names)
        if inf["n"] > it["rank"]: it["rank"] = inf["n"]
        if inf["u"] or q in UNESCO: it["u"] = True
newrows = 0
for q, o in cand.items():
    inf = INFO.get(q, {}); t = type_from(inf.get("p31", [])) or (sorted(o["types"])[0] if o["types"] else "landmark")
    if q in byq:
        for it in byq[q]:
            if q in UNESCO: it["u"] = True
        continue
    en = inf.get("en") or o["en"]
    if not en or not latin(en) or o["cc"] not in cc2: continue
    # the same place GeoNames already has, without a Wikidata id: same name within ~1.5 km
    dup = [it for it in byname.get(fold(en), []) if it["cc"] == o["cc"] and abs(it["lat"] - o["lat"]) < 0.014 and abs(it["lon"] - o["lon"]) < 0.02]
    if dup:
        for it in dup:
            if not it["wd"]: it["wd"] = q; stats["linked"] += 1
            if it["type"] not in KEEP and inf.get("p31") and type_from(inf["p31"]) and it["type"] != t and retype_ok(it, t): changes.append((it["rank"], it["names"][0], it["cc"], it["type"], t)); it["type"] = t; stats["retyped"] += 1
            it["rank"] = max(it["rank"], inf.get("n", o["n"])); it["u"] = it["u"] or q in UNESCO
            add_names(it, inf.get("al", [])[:6] + [clean_title(inf.get("wt", "")), loc.get(q, "")])
        continue
    tw = near(cc2[o["cc"]], o["lat"], o["lon"])
    it = {"names": [en], "lat": o["lat"], "lon": o["lon"], "cc": o["cc"], "a1": tw[4] if tw else "", "type": t, "town": tw[2] if tw else "", "rank": inf.get("n", o["n"]), "wd": q, "u": q in UNESCO}
    add_names(it, inf.get("al", [])[:6] + [clean_title(inf.get("wt", "")), loc.get(q, "")])
    items.append(it); byq[q].append(it); newrows += 1
    for n in it["names"]: byname[fold(n)].append(it)
    if it["a1"] and o["cc"] + "." + it["a1"] in adm_all: admin[o["cc"] + "." + it["a1"]] = adm_all[o["cc"] + "." + it["a1"]]
print("new rows", newrows, dict(stats), flush=True)

# ---- write (overwrite only: no file is ever deleted; a key that newly splits keeps its old file, unused)
by2 = collections.defaultdict(list)
for ix, it in enumerate(items):
    keys = set()
    for nm in it["names"]:
        f = fold(nm)
        for g in (f, ARTICLE.sub("", f)):
            if len(g.replace(" ", "")) >= 2: keys.add(g.replace(" ", "")[:2])
    for k in keys: by2[k].append(ix)
files, dropped, split = {}, set(), []
def shipped(it, key):   # this row was already in this file before (by one of its original names)
    if not it.get("old"): return False
    return key in it["files"] or any(key.startswith(f.rstrip("_")) or f.startswith(key.rstrip("_")) for f in it["files"])
def write(key, ixs):
    ixs = sorted(set(ixs), key=lambda i: (0 if shipped(items[i], key) else 1, -items[i]["rank"], items[i]["names"][0]))   # rows already shipped are never left out
    while True:
        rows, adm, cn = [], {}, {}
        for i in ixs:
            it = items[i]; ak = it["cc"] + "." + it["a1"]
            if ak in admin: adm[ak] = admin[ak]
            cn[it["cc"]] = cname.get(it["cc"], it["cc"])
            rows.append("\t".join(["|".join(it["names"]), str(it["lat"]), str(it["lon"]), it["cc"], it["a1"], "0", it["type"], it["town"], str(it["rank"]), it["wd"]] + (["U"] if it["u"] else [])))
        body = json.dumps({"v": 1, "key": key, "admin": adm, "countries": cn, "rows": "\n".join(rows)}, ensure_ascii=False, separators=(",", ":"))
        if len(body.encode("utf-8")) < MAXFILE: break
        nold = sum(1 for i in ixs if shipped(items[i], key))
        if nold == len(ixs): break
        cut = max(nold, int(len(ixs) * 0.95)); dropped.update(ixs[cut:]); ixs = ixs[:cut]
    open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8").write(body); files[key] = len(body)
for k2, ixs in by2.items():
    if len(ixs) <= SPLIT_AT: write(k2, ixs); continue
    split.append(k2); by3 = collections.defaultdict(list)
    for i in ixs:
        for nm in items[i]["names"]:
            f = fold(nm)
            for g in (f, ARTICLE.sub("", f)):
                g = g.replace(" ", "")
                if g[:2] == k2: by3[g[:3] if len(g) >= 3 else g[:2] + "_"].append(i)
    for k3, it in by3.items(): write(k3, it)
idx = json.load(open(os.path.join(OUT, "index.json")))
idx.update({"split": sorted(split), "sights": len(items), "types": dict(collections.Counter(i["type"] for i in items)), "unesco": sum(1 for i in items if i["u"]),
            "source": "GeoNames (geonames.org, CC BY 4.0) + Wikidata (CC0)", "enriched": "v97"})
json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
changes.sort(key=lambda x: -x[0])
json.dump({"stats": dict(stats), "new": newrows, "dropped": len(dropped), "changes": [list(c) for c in changes]}, open(os.path.join(SRC, "wd", "enrich-report.json"), "w"), ensure_ascii=False)
print("rows after", len(items), "files", len(files), "biggest", sorted(files.items(), key=lambda x: -x[1])[:3], "left out to keep files small", len(dropped))
print("type changes", len(changes), "examples", changes[:25])
