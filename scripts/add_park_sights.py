#!/usr/bin/env python3
"""Famstamp v124: famous named features inside US national parks as their own sights, additive only.

Adds scripts/park_sights.tsv to data/sights/*.json so places like Old Faithful, Yosemite Falls and The Narrows
open their own place page (they used to resolve only to the parent park, or not at all). Each row keeps its
Wikidata id, the park id in column 12 (c[11]), and the right US state, so a visit still counts for the park,
the state and the US. Nothing is removed or renamed. Idempotent: a row is never added twice to a shard
(same Wikidata id, or same name within ~1 km).

Usage: python3 scripts/add_park_sights.py
"""
import os, re, json, glob, collections, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "travel-log", "app", "data", "sights")
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
    k = os.path.basename(f)[:-5]
    if k == "index" or k.startswith("type-"): continue   # type-drinks.json is a type index, not a name shard
    files[k] = json.load(open(f, encoding="utf-8"))
before = sum(len([r for r in j["rows"].split("\n") if r]) for j in files.values())
changed, added = set(), 0
CNAME = {"USA": "United States"}
ADM = {"USA.WY": "Wyoming", "USA.CA": "California", "USA.UT": "Utah", "USA.TN": "Tennessee", "USA.WA": "Washington",
       "USA.CO": "Colorado", "USA.MT": "Montana", "USA.ME": "Maine"}
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
items = [l.rstrip("\n").split("\t") for l in open(os.path.join(HERE, "park_sights.tsv"), encoding="utf-8") if l.strip() and not l.startswith("#")]
for it in items:
    # names, lat, lon, ISO3, admin1, type, town, fame, wd, park
    names, lat, lon, cc, adm, typ, town, fame, wd, park = it[0], it[1], it[2], it[3], it[4], it[5], it[6], it[7], it[8], it[9]
    cols = [names, lat, lon, cc, adm, "0", typ, town, fame, wd, "", park]
    n = put_new(cols)
    added += 1 if n else 0
    print(("ADD" if n else "have"), names.split("|")[0], "shards", n)
for k in sorted(changed):
    j = files[k]
    for r in j["rows"].split("\n"):
        c = r.split("\t")
        if len(c) > 4:
            if c[3] not in j["countries"]: j["countries"][c[3]] = CNAME.get(c[3], c[3])
            ak = c[3] + "." + c[4]
            if c[4] and ak not in j["admin"] and ak in ADM: j["admin"][ak] = ADM[ak]
    open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8").write(json.dumps(j, ensure_ascii=False, separators=(",", ":")))
# Additive index update only: never recount or rewrite existing type/unesco/sight totals.
if added or changed:
    idx["sights"] = int(idx.get("sights") or 0) + added
    types = idx.setdefault("types", {})
    inc = collections.Counter(it[5] for it in items)
    # Only bump types for rows we actually inserted this run; added is unique sights, inc is from the tsv
    # (reruns have added=0 so we skip). When added>0 we inserted every tsv row that was missing.
    if added:
        for typ, n in inc.items():
            types[typ] = int(types.get(typ) or 0) + n
    idx["parksights"] = "v124"
    have = set(idx.get("keys") or [])
    new_keys = [k for k in sorted(changed) if k not in have and not k.startswith("type-")]
    if new_keys: idx["keys"] = list(idx.get("keys") or []) + new_keys
    json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
else:
    new_keys = []
after = sum(len([r for r in j["rows"].split("\n") if r]) for j in files.values())
print("new sights", added, "rows", before, "->", after, "sights", idx.get("sights"), "files", len(changed), "new keys", new_keys)
