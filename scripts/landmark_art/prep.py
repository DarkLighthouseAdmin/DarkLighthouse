import json, urllib.request, os, time
from PIL import Image
UA = "FamstampBuild/1.0 (https://darklighthousesolutions.com; admin@darklighthousesolutions.com)"
P = json.load(open("picked.json"))
for r in P:
    fn = "raw/" + r["name"].replace(" ", "_").replace("'", "") + ".png"
    if not os.path.exists(fn):
        req = urllib.request.Request(r["thumb"], headers={"User-Agent": UA}); open(fn, "wb").write(urllib.request.urlopen(req, timeout=60).read()); time.sleep(0.5)
    im = Image.open(fn).convert("RGBA"); W, H = im.size; px = im.load()
    m = Image.new("L", im.size, 255); mp = m.load()
    for y in range(H):
        for x in range(W):
            R, G, B, A = px[x, y]; lum = (R * 299 + G * 587 + B * 114) / 1000
            if A > 128 and lum < 225: mp[x, y] = 0
    bb = Image.eval(m, lambda v: 255 - v).getbbox()
    if not bb: print("EMPTY", r["name"]); continue
    m = m.crop(bb); w, h = m.size; s = max(w, h); pad = int(s * 0.04); S = s + 2 * pad
    c = Image.new("L", (S, S), 255); c.paste(m, ((S - w) // 2, S - h - pad))
    c = c.resize((200, 200), Image.LANCZOS)
    c.save("bw/" + os.path.basename(fn)); r["bw"] = "bw/" + os.path.basename(fn)
json.dump(P, open("picked.json", "w"), indent=1)
# contact sheet
ims = [Image.open(r["bw"]) for r in P if r.get("bw")]
sheet = Image.new("L", (200 * 6, 230 * ((len(ims) + 5) // 6)), 255)
for i, im in enumerate(ims): sheet.paste(im, ((i % 6) * 200, (i // 6) * 230))
sheet.save("sheet.png"); print("ok", len(ims))
