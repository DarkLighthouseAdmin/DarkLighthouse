#!/usr/bin/env python3
"""Famstamp v98: additive fix for top sights the audit could not find by English name (scripts/top_sights.tsv).
Each is matched to its Wikidata item. If that item is already a sight, the English name is added as another spelling;
otherwise a new sight row is added (position, fame and UNESCO flag from Wikidata (CC0), type and town from top_sights.tsv).
Rows are only added or given extra names; nothing is removed. Safe to rerun. Usage: python3 scripts/add_top_names.py"""
import os, re, json, glob, sys, unicodedata, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "travel-log", "app", "data", "sights")
sys.argv = sys.argv[:1]
ITEMS = {"Real Alcázar of Seville": "Q498261", "Champs-Élysées": "Q550", "Sainte-Chapelle": "Q193193", "Reichstag building": "Q151897",
         "Hungarian Parliament Building": "Q11819", "Main Market Square": "Q770631", "Moscow Kremlin": "Q133274", "Peterhof Palace": "Q2463835",
         "Royal Mile": "Q852908", "Trinity College Dublin": "Q258464", "Dubrovnik Old Town": "Q910661", "Kotor Old Town": "Q3511938",
         "Geirangerfjord": "Q193989", "Khan el-Khalili": "Q1061621", "Dome of the Rock": "Q172077", "Al-Aqsa Mosque": "Q12192963",
         "Marina Bay Sands": "Q548679", "Gardens by the Bay": "Q630135", "The Bund": "Q125474", "N Seoul Tower": "Q69134",
         "Arashiyama Bamboo Grove": "Q23579173", "Milford Sound": "Q187197", "Notre-Dame Basilica of Montreal": "Q887686",
         "Château Frontenac": "Q745964", "Zócalo": "Q1348507", "Salar de Uyuni": "Q76122", "Rock-Hewn Churches of Lalibela": "Q642979"}
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
top = {l.split("\t")[0].split("|")[0]: l.rstrip("\n").split("\t") for l in open(os.path.join(HERE, "top_sights.tsv"), encoding="utf-8") if l.strip() and not l.startswith("#")}
files = {}
def shard(k):
    if k not in files:
        p = os.path.join(OUT, k + ".json")
        files[k] = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"v": 1, "key": k, "admin": {}, "countries": {}, "rows": ""}
    return files[k]
for f in glob.glob(os.path.join(OUT, "*.json")):
    if not f.endswith("index.json"): shard(os.path.basename(f)[:-5])
byq = {}
for k, j in files.items():
    for r in j["rows"].split("\n"):
        c = r.split("\t")
        if len(c) > 9 and c[9] in ITEMS.values(): byq.setdefault(c[9], []).append((k, r))
UA = {"User-Agent": "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"}
ent = json.load(urllib.request.urlopen(urllib.request.Request("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(ITEMS.values()), "props": "labels|claims|sitelinks", "languages": "en", "format": "json"}), headers=UA)))["entities"]
added, aliased, changed = [], [], set()
def put(k, row, old=None):
    j = shard(k); L = [x for x in j["rows"].split("\n") if x]
    if old and old in L: L[L.index(old)] = row
    elif row not in L: L.append(row)
    j["rows"] = "\n".join(L); changed.add(k)
for en, q in ITEMS.items():
    t = top[en]; cc = t[2]
    if q in byq:
        for k, r in byq[q]:
            c = r.split("\t"); names = c[0].split("|")
            if fold(en) in [fold(n) for n in names]: continue
            c[0] = "|".join(names + [en]); new = "\t".join(c); put(k, new, r)
            for k2 in keys([en]) - {k}: put(k2, new)
        aliased.append(en); continue
    e = ent[q]; cl = e.get("claims", {})
    try: v = cl["P625"][0]["mainsnak"]["datavalue"]["value"]
    except Exception: print("no position, left out:", en, q); continue
    label = e.get("labels", {}).get("en", {}).get("value", "")
    names = [en] + ([label] if label and fold(label) != fold(en) else []) + ([t[1]] if t[1] and re.search(r"[A-Za-z]", t[1]) and fold(t[1]) not in (fold(en), fold(label)) else [])
    unesco = any(s.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id") == "Q9259" for s in cl.get("P1435", []))
    row = "\t".join(["|".join(names), str(round(v["latitude"], 4)), str(round(v["longitude"], 4)), cc, "", "0", t[3], t[4], str(len(e.get("sitelinks", {}))), q] + (["U"] if unesco else []))
    for k in keys(names): put(k, row)
    idx["sights"] = idx.get("sights", 0) + 1; idx.setdefault("types", {})[t[3]] = idx["types"].get(t[3], 0) + 1; idx["unesco"] = idx.get("unesco", 0) + unesco
    added.append(en)
cname = {}
for j in files.values(): cname.update(j.get("countries", {}))
for k in changed:
    j = files[k]; j["countries"] = dict(j.get("countries", {}))
    for r in j["rows"].split("\n"):
        c = r.split("\t")
        if len(c) > 3 and c[3] not in j["countries"]: j["countries"][c[3]] = cname.get(c[3], c[3])
    open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8").write(json.dumps(j, ensure_ascii=False, separators=(",", ":")))
json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
print("new rows", len(added), added); print("extra names", len(aliased), aliased); print("files touched", len(changed))
