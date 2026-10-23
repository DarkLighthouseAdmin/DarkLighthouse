#!/usr/bin/env python3
"""Build the map + list data for the My Lifetime Travel Log app (/travel-log/app/maps.js).
Run: python3 scripts/build_travel_log_data.py   (needs the Natural Earth geojson in NE_DIR)

Map data: Natural Earth (public domain), https://www.naturalearthdata.com/about/terms-of-use/
  - US states: ne_50m_admin_1_states_provinces_lakes   (Albers equal-area; Alaska + Hawaii insets, not to scale)
  - World:     ne_50m_admin_0_countries, with the United Kingdom swapped for England, Scotland, Wales and
               Northern Ireland from ne_50m_admin_0_map_units (Equal Earth projection)
Same sources and projections as the paperback (My Lifetime Travel Log). Output is SVG path data, simplified and
rounded so the whole file stays small enough to cache offline."""
import json, math, os, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NE_DIR = Path(os.environ.get("NE_DIR", "/workspace/new-streams/_src/data"))
OUT = ROOT / "travel-log" / "app" / "maps.js"

def load(name): return json.load(open(NE_DIR / f"{name}.geojson"))["features"]
def polys(g): return [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]

def albers(lat1, lat2, lat0, lon0):
    r = math.radians; n = (math.sin(r(lat1)) + math.sin(r(lat2))) / 2; C = math.cos(r(lat1)) ** 2 + 2 * n * math.sin(r(lat1))
    rho0 = math.sqrt(C - 2 * n * math.sin(r(lat0))) / n
    def f(lon, lat):
        rho = math.sqrt(max(C - 2 * n * math.sin(r(lat)), 0)) / n; th = n * r(lon - lon0)
        return rho * math.sin(th), rho0 - rho * math.cos(th)
    return f
def equal_earth(lon, lat):
    A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796; M = math.sqrt(3) / 2
    th = math.asin(M * math.sin(math.radians(lat))); t2 = th * th; t6 = t2 ** 3
    return (math.radians(lon) * math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))),
            th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)))
def fix_dateline(ring):
    lons = [q[0] for q in ring]
    if max(lons) - min(lons) <= 180: return ring
    east = sum(1 for l in lons if l > 0) >= len(lons) / 2
    return [((l if (l > 0) == east else (179.99 if east else -179.99)), la) for l, la in ring]

def bbox(rings):
    xs = [x for r in rings for x, _ in r]; ys = [y for r in rings for _, y in r]
    return min(xs), min(ys), max(xs), max(ys)
def fitter(bb, x, y, w, h):
    """Map projected units (y up) into an SVG box (y down)."""
    minx, miny, maxx, maxy = bb; s = min(w / (maxx - minx), h / (maxy - miny))
    ox = x + (w - (maxx - minx) * s) / 2; oy = y + (h - (maxy - miny) * s) / 2
    return lambda X, Y: (ox + (X - minx) * s, oy + (maxy - Y) * s)

def dp(pts, tol):
    """Douglas-Peucker simplification (iterative)."""
    if len(pts) < 4: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy)
        best, bi = 0, -1
        for i in range(a + 1, b):
            # closed rings start and end on the same point, so fall back to plain distance there
            d = abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / L if L > 1e-6 else math.hypot(pts[i][0] - ax, pts[i][1] - ay)
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]
def area(r): return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2
def path(rings, tol, min_area):
    rings = [dp(r, tol) for r in rings]
    big = [r for r in rings if len(r) >= 3 and area(r) >= min_area]
    if not big: big = [max(rings, key=area)]
    out = []
    for r in big:
        pts = [(round(x, 1), round(y, 1)) for x, y in r]
        dedup = [pts[0]] + [p for i, p in enumerate(pts[1:], 1) if p != pts[i - 1]]
        out.append("M" + "L".join(f"{x:g},{y:g}" for x, y in dedup) + "Z")
    return "".join(out)
def centroid(rings):
    r = max(rings, key=area); A = cx = cy = 0
    for i in range(len(r)):
        x0, y0 = r[i - 1]; x1, y1 = r[i]; c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    return (round(cx / (3 * A), 1), round(cy / (3 * A), 1)) if A else (round(r[0][0], 1), round(r[0][1], 1))

# ---------------- US ----------------
def build_us():
    W, H = 1000, 620
    P48 = albers(29.5, 45.5, 37.5, -96); PAK = albers(55, 65, 50, -154); PHI = albers(8, 18, 13, -157)
    st = {}
    for f in load("ne_50m_admin_1_states_provinces_lakes"):
        p = f["properties"]
        if p["adm0_a3"] == "USA": st[p["postal"]] = (p["name"], [poly[0] for poly in polys(f["geometry"])])
    assert len(st) == 51, len(st)
    proj = {}
    for k, (nm, rings) in st.items():
        if k == "AK": proj[k] = [[PAK(lon - 360 if lon > 0 else lon, lat) for lon, lat in r] for r in rings]
        elif k == "HI": proj[k] = [[PHI(*q) for q in r] for r in rings]
        else: proj[k] = [[P48(*q) for q in r] for r in rings]
    lower = [r for k, rs in proj.items() if k not in ("AK", "HI") for r in rs]
    tf = fitter(bbox(lower), 20, 10, W - 40, H - 20)
    boxes = {"AK": (10, H - 190, 230, 175), "HI": (250, H - 100, 150, 85)}
    shapes = []
    for k in sorted(st, key=lambda k: st[k][0]):
        t = fitter(bbox(proj[k]), *boxes[k]) if k in boxes else tf
        rings = [[t(*q) for q in r] for r in proj[k]]
        shapes.append({"id": k, "name": st[k][0], "d": path(rings, 0.45, 1.5), "c": centroid(rings)})
    return {"w": W, "h": H, "insets": [list(b) for b in boxes.values()], "shapes": shapes}

# ---------------- World ----------------
def book_countries():
    """The 195 countries (193 UN members + Vatican City + Palestine) by continent, exactly as printed in the book."""
    src = (Path(os.environ.get("BOOK_SRC", "/workspace/new-streams/_src/book_travellog.py"))).read_text()
    i = src.index("CONT = {"); j = src.index("NC = sum"); ns = {}; exec(src[i:j], ns); return ns["CONT"]

UK = {"ENG": "England", "SCT": "Scotland", "WLS": "Wales", "NIR": "Northern Ireland"}
def build_world():
    W, H = 1000, 500
    feats = []
    for f in load("ne_50m_admin_0_countries"):
        p = f["properties"]
        if p["ADM0_A3"] == "GBR": continue
        feats.append((p["ADM0_A3"], p["NAME"], p, f["geometry"]))
    mu = {f["properties"]["GU_A3"]: f for f in load("ne_50m_admin_0_map_units")} if (NE_DIR / "ne_50m_admin_0_map_units.geojson").exists() \
        else {f["properties"]["GU_A3"]: f for f in load("mu50")}
    for code, nm in UK.items():
        feats.append((code, nm, mu[code]["properties"], mu[code]["geometry"]))
    by_name = {}
    for a3, nm, p, _ in feats:
        for k in ("NAME", "ADMIN", "NAME_LONG", "NAME_EN", "FORMAL_EN", "NAME_SORT"):
            if p.get(k): by_name.setdefault(p[k].lower(), a3)
    by_name["congo (dr)"] = "COD"; by_name["united kingdom"] = "GBR"
    cont = book_countries(); countries = []
    for continent, names in cont.items():
        for n in names:
            countries.append({"id": by_name[n.lower()], "name": n, "cont": continent})
    ids = [c["id"] for c in countries]
    assert len(ids) == 195 and len(set(ids)) == 195, (len(ids), len(set(ids)))
    country_ids = set(ids)
    all_rings = []
    projected = []
    for a3, nm, p, g in feats:
        rings = [[equal_earth(*q) for q in fix_dateline(poly[0])] for poly in polys(g)]
        projected.append((a3, nm, rings)); all_rings += rings
    tf = fitter(bbox(all_rings), 4, 4, W - 8, H - 8)
    shapes = []
    for a3, nm, rings in sorted(projected, key=lambda t: t[1]):
        rr = [[tf(*q) for q in r] for r in rings]
        part = "GBR" if a3 in UK else (a3 if a3 in country_ids else None)
        s = {"id": a3, "name": nm, "d": path(rr, 0.3, 0.6), "c": centroid(rr)}
        if part is None: s["other"] = 1
        if a3 in UK: s["uk"] = 1
        # tiny places get a tap dot so a finger can hit them
        if max(area(r) for r in rr) < 6: s["dot"] = 1
        shapes.append(s)
    have = {s["id"] for s in shapes} | {"GBR"}
    missing = [c for c in countries if c["id"] not in have]
    assert not missing, missing
    # globe outline + graticule
    outline = [tf(*equal_earth(-180, la)) for la in range(-90, 91, 3)] + [tf(*equal_earth(180, la)) for la in range(90, -91, -3)]
    grat = ["M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in (tf(*equal_earth(lon, lat)) for lon in range(-180, 181, 5))) for lat in range(-60, 61, 30)]
    return {"w": W, "h": H, "outline": "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in outline) + "Z", "grat": "".join(grat),
            "shapes": shapes, "countries": countries, "uk": [{"id": k, "name": v} for k, v in UK.items()]}

if __name__ == "__main__":
    data = {"source": "Natural Earth (public domain)", "us": build_us(), "world": build_world()}
    js = ("/* Generated by scripts/build_travel_log_data.py. Map data: Natural Earth (public domain). Do not edit by hand. */\n"
          "(function (g) { g.MLTL_MAPS = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "; })(typeof self !== 'undefined' ? self : this);\n")
    if not OUT.parent.exists(): OUT.parent.mkdir(parents=True)
    OUT.write_text(js, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(js)/1024:.0f} KB, {len(data['us']['shapes'])} US shapes, {len(data['world']['shapes'])} world shapes")
