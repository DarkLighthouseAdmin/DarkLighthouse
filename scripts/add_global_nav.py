#!/usr/bin/env python3
"""Money / Travel / Data section links on every page. Idempotent: python3 scripts/add_global_nav.py
- Pages with the money-style topbar (/templates/, /tools/, /renewal-radar/): the topbar <nav> is rewritten.
- Pages with the travel-style gbar (/travel/, /privacy/): the Sections <nav> is rewritten.
- Everything else (/data/, /kits/*, /netsuite-adf/): a small self-styled bar is inserted after <body>,
  between <!-- dls-gbar --> markers, with its CSS in <head> (<!-- dls-gbar-css -->).
The homepage (index.html, built by build_front.py) and /money/ already ship the bar and are skipped.
Generators (build_tools.py, templates_page.html, build_travel.py, build_front.py) emit the same links."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTIONS = [("/money/", "Money"), ("/travel/", "Travel"), ("/data/", "Data")]
MONEY = ("money/", "templates/", "tools/", "renewal-radar/")
DATA = ("data/", "kits/", "netsuite-adf/")

def section(rel):
    if rel.startswith(MONEY): return "/money/"
    if rel.startswith("travel/"): return "/travel/"
    if rel.startswith(DATA): return "/data/"
    return None

def links(cur, sep=""):
    return sep.join(f'<a href="{p}"{" aria-current=\"true\"" if p == cur else ""}>{n}</a>' for p, n in SECTIONS)

def topbar_nav(cur):
    return f'<nav aria-label="Sections">{links(cur, " &nbsp;·&nbsp; ")}</nav>'

def gbar_nav(cur):
    return f'<nav aria-label="Sections">{links(cur)}</nav>'

CSS = """<!-- dls-gbar-css --><style>
    .dls-gbar { background:#0e1c2a; color:#e8eef6; font:500 .95rem/1.3 "IBM Plex Sans",system-ui,sans-serif; position:relative; z-index:5; }
    .dls-gbar .w { max-width:1120px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; gap:.6rem 1rem; flex-wrap:wrap; padding:.6rem 1.25rem; }
    .dls-gbar a { color:#e8eef6; text-decoration:none; } .dls-gbar .brand { font-family:Fraunces,Georgia,serif; font-size:1.05rem; font-weight:500; letter-spacing:0; line-height:1.3; max-width:none; margin:0; animation:none; } .dls-gbar .brand span { color:#e8a54b; }
    .dls-gbar nav a { margin-left:1.1rem; opacity:.85; } .dls-gbar nav a:first-child { margin-left:0; } .dls-gbar nav a[aria-current] { opacity:1; border-bottom:2px solid #e8a54b; }
  </style><!-- /dls-gbar-css -->
"""

def bar(cur):
    return (f'<!-- dls-gbar --><div class="dls-gbar"><div class="w"><a class="brand" href="/">Dark Lighthouse <span>Solutions</span></a>'
            f'{gbar_nav(cur)}</div></div><!-- /dls-gbar -->\n')

def apply(text, rel):
    cur = section(rel)
    if '<div class="topbar">' in text:
        return re.sub(r'(<div class="topbar"><div class="wrap">\s*<a class="brand" href="/">.*?</a>\s*)<nav[^>]*>.*?</nav>',
                      lambda m: m.group(1) + topbar_nav(cur), text, count=1, flags=re.S)
    if '<div class="gbar">' in text:
        return re.sub(r'(<div class="gbar"><div class="wrap">.*?)<nav aria-label="Sections">.*?</nav>',
                      lambda m: m.group(1) + gbar_nav(cur), text, count=1, flags=re.S)
    text = re.sub(r"[ \t]*<!-- dls-gbar-css -->.*?<!-- /dls-gbar-css -->\n?", "", text, flags=re.S)
    text = re.sub(r"[ \t]*<!-- dls-gbar -->.*?<!-- /dls-gbar -->\n?", "", text, flags=re.S)
    i = text.lower().find("</head>")
    text = text[:i] + "  " + CSS + text[i:]
    m = re.search(r"<body[^>]*>\n?", text, re.I)
    return text[:m.end()] + "  " + bar(cur) + text[m.end():]

def pages():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith("travel-log/app/"):  # kids' app: no analytics, nav or meta injection
            continue
        if rel.startswith((".git/", "scripts/")) or re.fullmatch(r"google[0-9a-f]+\.html", rel) or rel in ("index.html", "money/index.html"):
            continue
        yield rel, p

if __name__ == "__main__":
    n = 0
    for rel, p in pages():
        t = p.read_text(encoding="utf-8"); t2 = apply(t, rel)
        if t2 != t:
            p.write_text(t2, encoding="utf-8"); n += 1
    print(f"global nav: updated {n} page(s)")
