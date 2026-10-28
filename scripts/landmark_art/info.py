import json, urllib.request, urllib.parse, re, time
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"
def get(url, data=None):
    r = urllib.request.Request(url, headers={"User-Agent": UA}); return json.load(urllib.request.urlopen(r, timeout=60))
P = json.load(open("pick.json")); out = []
titles = "|".join("File:" + f for _, f in P)
j = get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "titles": titles, "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 400, "format": "json", "formatversion": 2}))
norm = {n["from"]: n["to"] for n in j["query"].get("normalized", [])}
pages = {p["title"]: p for p in j["query"]["pages"]}
ens = "|".join(n for n, _ in P if n != "Roman Colosseum")
w = get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "prop": "pageprops", "ppprop": "wikibase_item", "redirects": 1, "titles": ens, "format": "json", "formatversion": 2}))
wn = {n["from"]: n["to"] for n in w["query"].get("normalized", [])}; wr = {r["from"]: r["to"] for r in w["query"].get("redirects", [])}
wq = {p["title"]: (p.get("pageprops") or {}).get("wikibase_item") for p in w["query"]["pages"]}
for name, f in P:
    t = "File:" + f; t = norm.get(t, t); p = pages.get(t, {}); ii = (p.get("imageinfo") or [{}])[0]; em = ii.get("extmetadata") or {}
    nn = wn.get(name, name); nn = wr.get(nn, nn)
    rec = {"name": name, "qid": wq.get(nn) if name != "Roman Colosseum" else "Q10285", "file": f, "lic": (em.get("LicenseShortName") or {}).get("value"), "licurl": (em.get("LicenseUrl") or {}).get("value", ""),
           "artist": re.sub(r"\s+", " ", re.sub("<[^>]+>", "", (em.get("Artist") or {}).get("value", ""))).strip()[:100], "page": ii.get("descriptionurl"), "thumb": ii.get("thumburl")}
    out.append(rec); print(rec["qid"], name, "|", rec["lic"], "|", rec["artist"], "|", (rec["thumb"] or "")[-50:])
json.dump(out, open("picked.json", "w"), indent=1)
