#!/usr/bin/env python3
"""Famstamp dark mode: writes travel-log/app/dark.css from the light stylesheets.

Every rule that paints a light background (or dark text, or a dark line) gets a dark-mode twin under
html[data-theme="dark"]. Light surfaces become dark surfaces of the same hue, dark ink becomes light ink,
mid-tone accents (beacon orange, sage, kid colors) stay as they are. "Paper" things (the passport, stamps,
certificates, postcards, journal and book pages, state signs) stay light, like printed paper, so their art
reads the same. Hand-tuned fixes live in dark-extra.css (appended as-is). Re-run after changing the CSS:
    python3 scripts/build_dark_css.py
The palette here is a placeholder until the new designs arrive: change SURF/INK below or the variables in dark-extra.css.
"""
import colorsys, os, re

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "travel-log", "app")
SRC = ["app.css", "sync.css", "import.css", "map.css"]
PRE = 'html[data-theme="dark"]'
PAPER = re.compile(r"\.(pbook|ppage|idpage|cover|cert|certview|pcpage|pccard|pcpages|signcard|signsvg|signbook|bigsign|fxsign|jpage|bjpage|bpage|bookpages|bcover|bookpdf|book|stamp[a-z-]*|fstamps|pkstamp|kastamp|qstamp|newstamp|nt-stamp|bcstamps|btstamps|stposter[a-z]*|stampfx|fxstamp|sharecard|postcard)\b")
PROPS = re.compile(r"^(background|background-color|background-image|color|border|border-top|border-bottom|border-left|border-right|border-color|outline|outline-color|box-shadow|fill|stroke|caret-color|text-decoration-color|accent-color)$")
COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b")
SURF = (0.10, 0.20)   # lightness range dark surfaces land in
INK = (0.80, 0.94)    # lightness range light ink lands in

def parse(c):
    c = c.strip().lower()
    if c == "white": return (255, 255, 255, 1.0)
    if c == "black": return (0, 0, 0, 1.0)
    if c.startswith("#"):
        h = c[1:]
        if len(h) in (3, 4): h = "".join(x * 2 for x in h)
        if len(h) not in (6, 8): return None
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
    m = re.match(r"rgba?\(([^)]*)\)", c)
    if not m: return None
    p = [x.strip() for x in re.split(r"[,\s/]+", m.group(1)) if x.strip()]
    if len(p) < 3 or any("%" in x or "var" in x for x in p[:3]): return None
    try: return (float(p[0]), float(p[1]), float(p[2]), float(p[3]) if len(p) > 3 else 1.0)
    except ValueError: return None

def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(x))) for x in (r, g, b))
    return "#%02x%02x%02x" % (r, g, b) if a >= 0.999 else "rgba(%d,%d,%d,%s)" % (r, g, b, ("%.3f" % a).rstrip("0").rstrip("."))

def hls(c): return colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)

def remap(c, lo, hi, light_in):
    h, l, s = hls(c)
    t = (1 - l) / 0.5 if light_in else l / 0.5            # 0..1: how far into the light (or dark) end it was
    t = max(0.0, min(1.0, t))
    nl = lo + (hi - lo) * t if light_in else hi - (hi - lo) * t
    if s < 0.08: h, s = 0.58, 0.30                          # plain whites and grays pick up the night-blue of the header
    r, g, b = colorsys.hls_to_rgb(h, nl, min(s, 0.35))
    return fmt(r * 255, g * 255, b * 255, c[3])

def conv(prop, val, rule_has_accent_bg):
    changed = [False]
    def sub(m):
        c = parse(m.group(0))
        if not c: return m.group(0)
        h, l, s = hls(c)
        if prop.startswith("background") or prop in ("fill",):
            if l >= 0.80 and c[3] > 0.02:
                changed[0] = True
                if c[3] < 0.999 and l > 0.97: return fmt(255, 255, 255, min(1, c[3] * 0.10))   # white veils: a faint light veil in the dark
                return remap(c, SURF[0], SURF[1], True)
            return m.group(0)
        if prop in ("color", "caret-color", "text-decoration-color", "stroke"):
            if rule_has_accent_bg: return m.group(0)
            if l <= 0.48:
                changed[0] = True
                return remap(c, INK[0], INK[1], False)
            return m.group(0)
        # borders, outlines, shadows: dark lines become light lines, light lines become dark ones
        if l <= 0.30 and c[3] < 0.999 and prop != "box-shadow":
            changed[0] = True; return fmt(230, 236, 242, c[3])
        if prop == "box-shadow" and l <= 0.30:
            changed[0] = True; return fmt(0, 0, 0, min(1, c[3] * 1.8))
        if l >= 0.85 and prop != "box-shadow" and c[3] > 0.2:
            changed[0] = True; return remap(c, 0.24, 0.32, True)
        return m.group(0)
    out = COLOR.sub(sub, val)
    if prop in ("color", "fill", "stroke", "caret-color") and not rule_has_accent_bg and prop != "fill":
        o2 = re.sub(r"var\(--(navy|sage-deep)\)", lambda m: "var(--" + {"navy": "navy-ink", "sage-deep": "sage-ink"}[m.group(1)] + ")", out)
        if o2 != out: changed[0] = True; out = o2
    return out if changed[0] else None

def split_blocks(css):
    """Yields (prelude, body) for top-level blocks."""
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0: return
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{": depth += 1
            elif css[k] == "}": depth -= 1
            k += 1
        yield css[i:j].strip(), css[j + 1:k - 1]
        i = k

def decls(body):
    out = []
    for d in re.split(r";(?![^(]*\))", body):
        if ":" not in d: continue
        p, v = d.split(":", 1)
        out.append((p.strip().lower(), v.strip()))
    return out

def accent_bg(ds):
    for p, v in ds:
        if p.startswith("background"):
            for m in COLOR.finditer(v):
                c = parse(m.group(0))
                if c and c[3] > 0.5 and 0.3 < hls(c)[1] < 0.80: return True
            if re.search(r"var\(--(beacon|sage|sage-deep|kid|ok|bad|beacon-hot)\)", v): return True
            if re.search(r"var\(--navy\)", v): return True
    return False

def prefix(sel):
    parts = []
    for s in re.split(r",(?![^(]*\))", sel):
        s = s.strip()
        if not s: continue
        if PAPER.search(s): continue
        if s.startswith(":root") or s.startswith("html"): s = s.replace(":root", "", 1).replace("html", "", 1)
        if s.startswith("body"): parts.append(PRE + " " + s); continue
        parts.append(PRE + " " + s)
    return ", ".join(parts)

def walk(css):
    out = []
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for pre, body in split_blocks(css):
        if pre.startswith("@media"):
            if "print" in pre: continue
            inner = walk(body)
            if inner: out.append(pre + " {\n" + "\n".join("  " + x for x in inner) + "\n}")
            continue
        if pre.startswith("@"): continue   # keyframes, font-face, supports
        ds = decls(body); acc = accent_bg(ds); new = []
        for p, v in ds:
            if not PROPS.match(p) or "var(" in v and not COLOR.search(v) and not re.search(r"var\(--(navy|sage-deep)\)", v): continue
            c = conv(p, v, acc)
            if c is not None: new.append("%s:%s" % (p, c))
        sel = prefix(pre)
        if new and sel: out.append(sel + " { " + "; ".join(new) + "; }")
    return out

def main():
    rules = []
    for f in SRC:
        with open(os.path.join(APP, f), encoding="utf-8") as fh: rules += ["/* " + f + " */"] + walk(fh.read())
    with open(os.path.join(APP, "dark-extra.css"), encoding="utf-8") as fh: extra = fh.read()
    body = "/* Famstamp dark mode. GENERATED by scripts/build_dark_css.py from " + ", ".join(SRC) + " + dark-extra.css: edit those, not this file. */\n" + "\n".join(rules) + "\n/* dark-extra.css */\n" + extra
    out = os.path.join(APP, "dark.css")
    if "--check" in __import__("sys").argv:
        with open(out, encoding="utf-8") as fh: same = fh.read() == body
        print("dark.css up to date" if same else "dark.css is STALE: run python3 scripts/build_dark_css.py"); return
    with open(out, "w", encoding="utf-8") as fh: fh.write(body)
    print("dark.css: %d rules, %d KB" % (len([r for r in rules if not r.startswith("/*")]), len(body) // 1024))

if __name__ == "__main__": main()
