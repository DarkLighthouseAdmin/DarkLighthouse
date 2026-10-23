#!/usr/bin/env python3
"""Rebuild /templates/ (page + product images) and /pins/ from the local product kits.
Run from the repo root:  python3 scripts/build_templates.py
Sources (on the build box): /workspace/dls-products/listing-kits, /workspace/polar-push, /workspace/marketing."""
import json, shutil, html, sys
sys.dont_write_bytecode = True
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
KITS = Path("/workspace/dls-products/listing-kits")
URLS = json.load(open("/workspace/polar-push/checkout-urls.json"))
PINS_STAGE = Path("/workspace/polar-push/pins-stage/pins")
PINS_NEW = Path("/workspace/marketing/pins-new")
MKT = Path("/workspace/marketing")

# slug, name, price, was/compare, group, badge
PRODUCTS = [
  ("sheets-bundle-5", "Money Spreadsheet Bundle (all 5)", 29, "was $54", "bundle", "Best value"),
  ("planner-plus-sheets-bundle", "Debt-Free Bundle: Planner + 5 Spreadsheets", 34, "was $66", "bundle", "Best value"),
  ("wedding-planner-budget", "Wedding Planner & Budget", 14, None, "sheet", "New"),
  ("just-in-case-binder", "The Just-In-Case Binder", 12, "reg $17", "printable", "Launch price"),
  ("debt-payoff-dashboard", "Debt Payoff Dashboard", 14, None, "sheet", None),
  ("budget-by-paycheck", "Budget by Paycheck", 9, None, "sheet", None),
  ("sinking-funds", "Sinking Funds Tracker", 7, None, "sheet", None),
  ("seller-profit-tracker", "Etsy Seller Profit Tracker", 12, None, "sheet", None),
  ("business-expense-invoice-log", "Small Business Expense & Invoice Log", 12, None, "sheet", None),
  ("debt-free-2027-planner", "2027 Digital Budget Planner (GoodNotes)", 12, None, "planner", None),
]
# Newer products with no listing kit: short text here, images from /workspace/marketing/pins-new
# (cards/<slug>-cover.png = 4:3 card cover, <prefix>-pin-N.png = gallery photos, <slug>/pin-N.jpg = Pinterest pins).
EXTRA = {
  "monthly-budget-snapshot": ("snapshot", "A free one-page monthly budget: income, bills, spending and savings, with over-budget and unpaid bills flagged. About 10 minutes a month."),
  "meal-planner-grocery-list": ("meal", "Plan the week's meals and the grocery list writes itself: repeats merged, pantry staples skipped, sorted by aisle."),
  "moving-planner": ("moving", "Timeline, budget, box inventory, address changes and utilities for a move, in one spreadsheet."),
}
# Insert the new products into the singles list, right after the binder.
_i = [p[0] for p in PRODUCTS].index("just-in-case-binder") + 1
PRODUCTS[_i:_i] = [
  ("monthly-budget-snapshot", "Monthly Budget Snapshot", 0, None, "sheet", "Free"),
  ("meal-planner-grocery-list", "Meal Planner & Grocery List", 11, None, "sheet", "New"),
  ("moving-planner", "Moving Planner & Checklist", 12, None, "sheet", "New"),
]
# On Polar but no download attached yet -> shown as "coming soon", no buy button.
COMING_SOON = []

def img(src, dst, width):
    dst.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, "JPEG", quality=82, optimize=True, progressive=True)

def build_assets():
    for slug, *_ in PRODUCTS:
        if slug in EXTRA:
            pre = EXTRA[slug][0]
            gal = [PINS_NEW / "cards" / f"{slug}-cover.png"] + sorted(PINS_NEW.glob(f"{pre}-pin-*.png"))
            for i, m in enumerate(gal, 1):
                img(m, ROOT / "assets/money" / slug / f"{i}.jpg", 1000)
            for p in sorted((PINS_NEW / slug).glob("pin-*.jpg")):
                d = ROOT / "pins" / slug / p.name
                d.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, d)
            continue
        mocks = sorted((KITS / slug / "mockups").glob("*.jpg"))[:4]
        for i, m in enumerate(mocks, 1):
            img(m, ROOT / "assets/money" / slug / f"{i}.jpg", 1000)
        pin_dir = PINS_STAGE / slug if (PINS_STAGE / slug).exists() else KITS / slug / "pins"
        for p in sorted(pin_dir.glob("pin-*.jpg")):
            d = ROOT / "pins" / slug / p.name
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, d)
    # Seasonal + video pins (only ever copied in; nothing under pins/ is deleted on rebuild).
    for sub, pat in (("pins-seasonal", "*.png"), ("pins-video", "*.mp4")):
        for p in sorted((MKT / sub).glob(pat)):
            d = ROOT / "pins" / sub / p.name
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, d)
    for p in sorted(PINS_NEW.glob("*.png")):
        d = ROOT / "pins/new" / p.name
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, d)

def short(slug):
    if slug in EXTRA:
        return EXTRA[slug][1]
    return json.load(open(KITS / slug / "listing.json"))["short"]

def card(slug, name, price, was, group, badge):
    e = html.escape
    n = len(list((ROOT / "assets/money" / slug).glob("*.jpg")))
    gallery = " ".join(f"/assets/money/{slug}/{i}.jpg" for i in range(1, n + 1))
    price_html = ("Free" if price == 0 else f"${price}") + (f' <s>{e(was)}</s>' if was else "")
    badge_html = f'<span class="badge">{e(badge)}</span>' if badge else ""
    return f'''      <article class="card{' card-bundle' if group == 'bundle' else ''}" id="{slug}" data-group="{group}">
        <button class="thumb" type="button" data-gallery="{gallery}" aria-label="See photos of {e(name)}">
          <img src="/assets/money/{slug}/1.jpg" alt="{e(name)} preview" loading="lazy" width="1000" height="750" />{badge_html}
        </button>
        <div class="card-body">
          <h3>{e(name)}</h3>
          <p>{e(short(slug))}</p>
          <div class="buy-row"><span class="price">{price_html}</span>
            <a class="btn btn-primary" href="{URLS[slug]['checkout_url']}">{'Get it free' if price == 0 else 'Buy now'}</a></div>
        </div>
      </article>'''

def soon(slug, name, price, blurb):
    e = html.escape
    return f'''      <article class="card card-soon" id="{slug}">
        <div class="card-body">
          <h3>{e(name)}</h3>
          <p>{e(blurb)}</p>
          <div class="buy-row"><span class="price">{'Free' if price == 0 else f'${price}'}</span><span class="soon">Coming soon</span></div>
        </div>
      </article>'''

def page():
    bundles = "\n".join(card(*p) for p in PRODUCTS if p[4] == "bundle")
    singles = "\n".join(card(*p) for p in PRODUCTS if p[4] != "bundle")
    soons = "\n".join(soon(*p) for p in COMING_SOON)
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": "Money templates & planners",
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": {"@type": "Product", "name": p[1],
            "image": f"https://darklighthousesolutions.com/assets/money/{p[0]}/1.jpg",
            "url": f"https://darklighthousesolutions.com/templates/#{p[0]}",
            "brand": {"@type": "Brand", "name": "Dark Lighthouse Solutions"},
            "offers": {"@type": "Offer", "price": f"{p[2]}.00", "priceCurrency": "USD", "url": URLS[p[0]]["checkout_url"], "availability": "https://schema.org/InStock"}}}
            for i, p in enumerate(PRODUCTS)]}
    tpl = (ROOT / "scripts/templates_page.html").read_text()
    if not COMING_SOON:  # drop the whole "Coming soon" section
        a = tpl.index('    <h2 id="coming-soon">'); b = tpl.index("{{SOON}}")
        b = tpl.index("</div>", b) + len("</div>\n")
        tpl = tpl[:a].rstrip("\n") + "\n" + tpl[b:]
    out = (tpl.replace("{{BUNDLES}}", bundles).replace("{{SINGLES}}", singles)
              .replace("{{SOON}}", soons).replace("{{JSONLD}}", json.dumps(ld, indent=1)))
    (ROOT / "templates").mkdir(exist_ok=True)
    from add_analytics import inject  # GA4 snippet + checkout/thanks events (no-op if already present)
    (ROOT / "templates/index.html").write_text(inject(out, is_templates=True))

if __name__ == "__main__":
    build_assets()
    page()
    print("built templates/ and pins/")
