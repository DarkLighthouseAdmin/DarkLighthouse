import json, sys, urllib.request, urllib.parse, re, time
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"
def api(**p):
    p.update(format="json", formatversion=2)
    r = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(r, timeout=60))
def ok_lic(l):
    l = (l or "").lower()
    if "sa" in re.split(r"[\s\-]", l) or "nc" in re.split(r"[\s\-]", l) or "nd" in re.split(r"[\s\-]", l): return False
    return l.startswith("cc0") or l.startswith("public domain") or l.startswith("pd") or re.match(r"cc by \d", l) is not None or l == "cc by"
LM = json.load(open("landmarks.json"))
out = {}
for qid, name, terms in LM:
    cands = []
    for t in terms:
        try: j = api(action="query", generator="search", gsrnamespace=6, gsrlimit=30, gsrsearch="filemime:image/svg+xml " + t, prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=600)
        except Exception as e: print("err", t, e); continue
        for pg in (j.get("query") or {}).get("pages", []):
            ii = (pg.get("imageinfo") or [{}])[0]; em = ii.get("extmetadata") or {}
            lic = (em.get("LicenseShortName") or {}).get("value", "")
            if not ok_lic(lic): continue
            if any(c["title"] == pg["title"] for c in cands): continue
            cands.append({"title": pg["title"], "lic": lic, "artist": re.sub("<[^>]+>", "", (em.get("Artist") or {}).get("value", ""))[:120], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "w": ii.get("width"), "h": ii.get("height")})
        time.sleep(0.5)
    out[qid] = {"name": name, "cands": cands}
    print(qid, name, len(cands), [c["title"][5:60] for c in cands[:8]])
json.dump(out, open("cands.json", "w"), indent=1)
