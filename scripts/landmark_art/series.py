import json, urllib.request, urllib.parse, re
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"
def api(**p):
    p.update(format="json", formatversion=2)
    r = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(r, timeout=60))
res = {}
for q in ['intitle:"World landmarks icons -"', 'intitle:"World landmarks blue icons -"', 'intitle:"Delapouite - game-icons" -intitle:white tower', 'intitle:"Delapouite - game-icons" -intitle:white castle', 'intitle:"Delapouite - game-icons" -intitle:white bridge','intitle:"Delapouite - game-icons" -intitle:white statue','intitle:"Delapouite - game-icons" -intitle:white gate','intitle:"Delapouite - game-icons" -intitle:white temple','intitle:"Delapouite - game-icons" -intitle:white opera','intitle:"Delapouite - game-icons" -intitle:white moai','intitle:"Delapouite - game-icons" -intitle:white stonehenge','intitle:"Delapouite - game-icons" -intitle:white palace','intitle:"Delapouite - game-icons" -intitle:white monument','intitle:"Delapouite - game-icons" -intitle:white mahal','intitle:"Delapouite - game-icons" -intitle:white wall','intitle:"Delapouite - game-icons" -intitle:white arch', 'intitle:"Delapouite - game-icons" -intitle:white lighthouse', 'intitle:"Delapouite - game-icons" -intitle:white windmill','intitle:"Delapouite - game-icons" -intitle:white rushmore','intitle:"Delapouite - game-icons" -intitle:white christ']:
    for off in (0, 50):
        j = api(action="query", list="search", srnamespace=6, srlimit=50, sroffset=off, srsearch=q)
        if "query" not in j: print("ERR", q, str(j)[:200]); break
        for s in j["query"]["search"]: res[s["title"]] = 1
        if len(j["query"]["search"]) < 50: break
print(len(res))
for t in sorted(res): print(t)
