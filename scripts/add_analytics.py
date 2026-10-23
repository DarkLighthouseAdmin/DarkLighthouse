#!/usr/bin/env python3
"""Add Google Analytics 4 (G-TVG78TY2JC) to every site HTML page. Idempotent: safe to re-run.
Run from anywhere:  python3 scripts/add_analytics.py   (build_templates.py also calls inject() on its output)
- gtag snippet goes right after the viewport meta (or charset meta, or <head>).
- Pages that link to buy.polar.sh get a click listener -> gtag('event','begin_checkout', {...}) via beacon.
- /templates/ also sends gtag('event','purchase_thanks') when ?thanks=1 is in the URL.
Skips Google's site-verification file (google*.html) and scripts/ sources other than templates_page.html."""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GA_ID = "G-TVG78TY2JC"
GTAG = (f'  <script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>\n'
        f"  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','{GA_ID}');</script>\n")
CLICK_MARK = "<!-- ga4-checkout-click -->"
CLICK = CLICK_MARK + """
  <script>
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href*="buy.polar.sh"]') : null;
      if (!a || typeof gtag !== "function") return;
      var box = a.closest("article, .card, section, li"), h = box && box.querySelector("h1, h2, h3");
      var name = (h ? h.textContent : a.textContent || "").replace(/\\s+/g, " ").trim();
      gtag("event", "begin_checkout", { item_name: name, link_url: a.href, transport_type: "beacon" });
    }, true);
  </script>
"""
THANKS_MARK = "<!-- ga4-purchase-thanks -->"
THANKS = THANKS_MARK + """
  <script>if (/[?&]thanks=1\\b/.test(location.search) && typeof gtag === "function") gtag("event", "purchase_thanks");</script>
"""

def inject(text, is_templates=False):
    if GA_ID not in text:
        m = (re.search(r'<meta name="viewport"[^>]*>\n?', text) or re.search(r'<meta charset[^>]*>\n?', text, re.I)
             or re.search(r"<head[^>]*>\n?", text, re.I))
        if not m:
            return text
        ins = GTAG if m.group(0).endswith("\n") else "\n" + GTAG
        text = text[:m.end()] + ins + text[m.end():]
    extra = ""
    if "buy.polar.sh" in text and CLICK_MARK not in text:
        extra += "  " + CLICK
    if is_templates and THANKS_MARK not in text:
        extra += "  " + THANKS
    if extra:
        i = text.lower().rfind("</body>")
        text = text[:i] + extra + text[i:] if i >= 0 else text + extra
    from add_head_meta import apply  # favicon/manifest/theme-color + missing social meta (idempotent)
    return apply(text)

def pages():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(".git/") or re.fullmatch(r"google[0-9a-f]+\.html", rel):
            continue
        if rel.startswith("scripts/") and rel != "scripts/templates_page.html":
            continue
        yield rel, p

if __name__ == "__main__":
    changed = 0
    for rel, p in pages():
        s = p.read_text(encoding="utf-8")
        is_t = rel in ("templates/index.html", "scripts/templates_page.html")
        t = inject(s, is_t)
        # templates_page.html only has {{BUNDLES}} placeholders (no buy links yet); give it the listener too.
        if is_t and CLICK_MARK not in t:
            i = t.lower().rfind("</body>"); t = t[:i] + "  " + CLICK + t[i:]
        if t != s:
            p.write_text(t, encoding="utf-8"); changed += 1; print("updated", rel)
    print(f"{changed} file(s) changed")
