#!/usr/bin/env python3
"""Add favicon / manifest / theme-color links and fill missing social meta on every site HTML page.
Idempotent: safe to re-run.   python3 scripts/add_head_meta.py
- Icon block sits between <!-- dls-head-meta --> markers, right after the GA4 snippet (or viewport/charset).
  Pages that already ship their own rel="icon" (e.g. /renewal-radar/) keep it and only get apple/manifest/theme.
- Missing og:site_name / og:title / og:description / og:url / og:type / og:image / twitter:card are filled
  from the page's own <title>, meta description and canonical. Existing tags are never rewritten,
  except the old 1536x1024 /og.png which is swapped for the real 1200x630 /og-default.jpg.
- add_analytics.inject() calls apply() too, so build_templates.py / build_tools.py output stays covered.
Skips Google's site-verification file (google*.html) and scripts/ sources other than templates_page.html.
Never touches the Pinterest verify meta or the GA tag."""
import html, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://darklighthousesolutions.com"
SITE_NAME = "Dark Lighthouse Solutions"
THEME = "#0e1c2a"
DEFAULT_OG = f"{SITE}/og-default.jpg"
START, END = "<!-- dls-head-meta -->", "<!-- /dls-head-meta -->"
ICONS = ('  <link rel="icon" href="/favicon.ico" sizes="48x48" />\n'
         '  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />\n'
         '  <link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96" />\n')
REST = ('  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n'
        '  <link rel="manifest" href="/site.webmanifest" />\n'
        f'  <meta name="theme-color" content="{THEME}" />\n')

def _attr(text, pattern):
    m = re.search(pattern, text, re.S | re.I)
    return m.group(1).strip() if m else None

def apply(text):
    if "<head" not in text.lower():
        return text
    # 1) icon block (rebuilt each run so edits here propagate)
    text = re.sub(r"[ \t]*" + re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", text, flags=re.S)
    has_own_icon = re.search(r'<link rel="icon"', text) is not None
    block = f"  {START}\n" + ("" if has_own_icon else ICONS) + REST + f"  {END}\n"
    m = (re.search(r"gtag\('config'[^\n]*\n", text) or re.search(r'<meta name="viewport"[^>]*>\n?', text)
         or re.search(r"<meta charset[^>]*>\n?", text, re.I) or re.search(r"<head[^>]*>\n?", text, re.I))
    ins = block if m.group(0).endswith("\n") else "\n" + block
    text = text[:m.end()] + ins + text[m.end():]

    # 2) old og.png (wrong size) -> og-default.jpg
    text = text.replace(f'content="{SITE}/og.png"', f'content="{DEFAULT_OG}"')

    # 3) fill missing social meta
    title = _attr(text, r"<title>(.*?)</title>")
    desc = _attr(text, r'<meta name="description" content="([^"]*)"')
    canon = _attr(text, r'<link rel="canonical" href="([^"]*)"')
    adds = []
    def need(prop):
        return not re.search(rf'(property|name)="{re.escape(prop)}"', text)
    if need("og:site_name"): adds.append(f'<meta property="og:site_name" content="{SITE_NAME}" />')
    if need("og:type"): adds.append('<meta property="og:type" content="website" />')
    if need("og:title") and title: adds.append(f'<meta property="og:title" content="{title}" />')
    if need("og:description") and desc: adds.append(f'<meta property="og:description" content="{desc}" />')
    if need("og:url") and canon: adds.append(f'<meta property="og:url" content="{canon}" />')
    if need("og:image"):
        adds.append(f'<meta property="og:image" content="{DEFAULT_OG}" />')
    if f'property="og:image" content="{DEFAULT_OG}"' in text or any(DEFAULT_OG in a for a in adds):
        if need("og:image:width"):
            adds += ['<meta property="og:image:width" content="1200" />', '<meta property="og:image:height" content="630" />']
    if need("twitter:card"): adds.append('<meta name="twitter:card" content="summary_large_image" />')
    if adds:
        m = re.search(r"\n[ \t]*</head>", text, re.I)
        text = text[:m.start()] + "".join("\n  " + a for a in adds) + text[m.start():]
    return text

def pages():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith("travel-log/app/") or rel.startswith("travel-log/"):  # kids' app and its policy pages: no analytics, nav or meta injection
            continue
        if rel.startswith(".git/") or "node_modules" in rel or re.fullmatch(r"google[0-9a-f]+\.html", rel):
            continue
        if rel.startswith("scripts/") and rel != "scripts/templates_page.html":
            continue
        yield rel, p

if __name__ == "__main__":
    changed = 0
    for rel, p in pages():
        old = p.read_text(encoding="utf-8")
        new = apply(old)
        if new != old:
            p.write_text(new, encoding="utf-8"); changed += 1; print("updated", rel)
    print(f"{changed} file(s) changed")
