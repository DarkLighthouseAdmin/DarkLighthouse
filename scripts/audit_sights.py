#!/usr/bin/env python3
"""Famstamp v94: offline audit of sights search. For a compiled list of world top sights (scripts/top_sights.tsv) and
for the most famous rows in data/sights, check: findable by its English name and by its local name, the right type,
a Wikidata id, a fame rank, the right town. Prints totals and per-region counts; --json writes them out.
Usage: python3 scripts/audit_sights.py [/workspace/geonames] [--json out.json] [--label before]"""
import sys, os, json, re, glob, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = [a for a in sys.argv]
SRC = next((a for a in sys.argv[1:] if not a.startswith("--") and os.path.isdir(a)), "/workspace/geonames")
OUTJ = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
DATA = os.path.join(HERE, "..", "travel-log", "app", "data", "sights")
import unicodedata
SPECIAL = {"ß": "ss", "ẞ": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h"}
def fold(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = "".join(SPECIAL.get(c, c) for c in s)
    s = re.sub(r"['’`ʻ]", "", s); s = re.sub(r"[^\w]+", " ", s).strip()
    s = re.sub(r"\b(st|ste|saint) ", "saint ", s + " "); s = re.sub(r"\bmt ", "mount ", s)
    return s.strip()
cont = {}
for line in open(os.path.join(SRC, "countryInfo.txt"), encoding="utf-8"):
    if line.startswith("#"): continue
    c = line.rstrip("\n").split("\t")
    if len(c) > 8: cont[c[1]] = {"EU": "Europe", "AS": "Asia", "AF": "Africa", "NA": "North America", "SA": "South America", "OC": "Oceania", "AN": "Antarctica"}.get(c[8], c[8])
cont["XKX"] = "Europe"
rows, byname = [], collections.defaultdict(list)
for f in glob.glob(os.path.join(DATA, "*.json")):
    if f.endswith("index.json"): continue
    for r in json.load(open(f, encoding="utf-8"))["rows"].split("\n"):
        c = r.split("\t")
        if len(c) < 10: continue
        o = {"names": c[0].split("|"), "cc": c[3], "type": c[6], "town": c[7], "rank": int(c[8] or 0), "wd": c[9]}
        rows.append(o)
        for n in o["names"]:
            byname[fold(n)].append(o)
def find(q, cc):
    fq = fold(q); best = None
    if not fq: return None
    cands = byname.get(fq, [])
    hit = [o for o in cands if o["cc"] == cc] or None
    if not hit:  # word-start match, like the app's prefix search
        hit = [o for k, L in byname.items() if (k.startswith(fq + " ") or (" " + fq) in (" " + k)) for o in L if o["cc"] == cc] if len(fq) > 3 else []
    for o in hit or []:
        if not best or o["rank"] > best["rank"]: best = o
    return best
SYN = {"basilica": {"basilica", "church", "cathedral"}, "cathedral": {"cathedral", "basilica"}, "church": {"church", "basilica", "chapel"},
       "temple": {"temple", "pagoda", "shrine", "stupa"}, "abbey": {"abbey", "monastery"}, "monastery": {"monastery", "abbey"},
       "ancient": {"ancient", "ruin", "archaeological"}, "historic": {"historic", "ruin", "fort"}, "fort": {"fort", "castle"},
       "castle": {"castle", "fort", "palace"}, "landmark": None}
def type_ok(got, want):
    s = SYN.get(want, {want}); return True if s is None else got in s
top = [l.rstrip("\n").split("\t") for l in open(os.path.join(HERE, "top_sights.tsv"), encoding="utf-8") if l.strip() and not l.startswith("#")]
reg = collections.defaultdict(lambda: collections.Counter()); misses = collections.defaultdict(list); wrong = []
for t in top:
    en, local, cc, want, town = t[0].split("|"), t[1], t[2], t[3], t[4]
    R = cont.get(cc, "?"); C = reg[R]; C["sights"] += 1
    he = next((x for x in (find(n, cc) for n in en) if x), None)
    hl = find(local, cc)
    if he: C["en"] += 1
    else: misses["english"].append(en[0] + " (" + cc + ")")
    if hl: C["local"] += 1
    else: misses["local"].append(local + " (" + cc + ")")
    h = he or hl
    if not h: continue
    if type_ok(h["type"], want): C["type"] += 1
    else: wrong.append("%s: %s, want %s" % (en[0], h["type"], want))
    if h["wd"]: C["qid"] += 1
    if h["rank"] >= 40: C["famous"] += 1
    if fold(h["town"]) == fold(town) or fold(town) in fold(h["town"]) or fold(h["town"]) in fold(town): C["town"] += 1
tot = collections.Counter()
for C in reg.values(): tot.update(C)
fam = [o for o in rows if o["rank"] >= 40]
fc = collections.Counter(); fr = collections.defaultdict(collections.Counter)
for o in fam: fr[cont.get(o["cc"], "?")]["famous rows"] += 1; fr[cont.get(o["cc"], "?")]["famous with Q id"] += bool(o["wd"])
out = {"rows": len(rows), "top": dict(tot), "regions": {k: dict(v) for k, v in sorted(reg.items())}, "famousRows": len(fam),
       "famousByRegion": {k: dict(v) for k, v in sorted(fr.items())}, "types": dict(collections.Counter(o["type"] for o in rows)),
       "misses": {k: v for k, v in misses.items()}, "wrongType": wrong}
print("rows", len(rows), "| top list", tot["sights"], "| English found", tot["en"], "| local found", tot["local"], "| right type", tot["type"], "| Q id", tot["qid"], "| famous", tot["famous"], "| right town", tot["town"])
for k, v in sorted(reg.items()): print("  %-14s %3d sights · en %3d · local %3d · type %3d · Q %3d · town %3d" % (k, v["sights"], v["en"], v["local"], v["type"], v["qid"], v["town"]))
print("missing in English (%d):" % len(misses["english"]), ", ".join(misses["english"]))
print("wrong type (%d):" % len(wrong), "; ".join(wrong))
if OUTJ: json.dump(out, open(OUTJ, "w"), ensure_ascii=False, indent=1)
