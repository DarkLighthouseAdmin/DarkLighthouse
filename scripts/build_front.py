#!/usr/bin/env python3
"""Build the homepage (/) and the Money hub (/money/). Run: python3 scripts/build_front.py
The homepage is a front door to three sections: Money (/money/ -> /templates/ + /tools/), Travel (/travel/), Data (/data/).
Money product cards (name, price, blurb, image, checkout) are read from the built /templates/ page so prices and
Polar links stay in one place; travel cards come from build_travel.TP. The old kits storefront lives at /data/."""
import sys, json, html, re
sys.dont_write_bytecode = True
from pathlib import Path
from add_analytics import inject
from build_tools import CSS as BASE_CSS, URLS, SITE
from build_travel import TP

ROOT = Path(__file__).resolve().parent.parent
e = html.escape
SECTIONS = [("/money/", "Money"), ("/travel/", "Travel"), ("/data/", "Data")]

def money_cards():
    t = (ROOT / "templates/index.html").read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'<article class="card[^"]*" id="([^"]+)"[^>]*>(.*?)</article>', t, re.S):
        slug, a = m.group(1), m.group(2)
        txt = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()
        name = txt(re.search(r"<h3[^>]*>(.*?)</h3>", a, re.S).group(1))
        price = txt(re.search(r'class="price[^"]*"[^>]*>(.*?)<', a, re.S).group(1))
        blurb = txt(re.search(r"<p[^>]*>(.*?)</p>", a, re.S).group(1))
        out[slug] = dict(name=name, price=price, blurb=blurb, img=f"/assets/money/{slug}/1.jpg", url=URLS[slug])
    return out

def travel_card(slug):
    n, p, s = TP[slug]
    return dict(name=n, price="Free" if p == 0 else f"${p}", blurb=s, img=f"/assets/travel/{slug}/1.jpg", url=URLS[slug])

FCSS = """
    .gbar { background:var(--navy); color:#e8eef6; font-size:.95rem; }
    .gbar .wrap { display:flex; justify-content:space-between; align-items:center; padding:.6rem 1.25rem; gap:.6rem 1rem; flex-wrap:wrap; }
    .gbar a { color:#e8eef6; text-decoration:none; font-weight:500; } .gbar .brand { font-family:Fraunces,serif; font-size:1.05rem; } .gbar .brand span { color:var(--beacon); }
    .gbar nav a { margin-left:1.1rem; opacity:.85; } .gbar nav a:first-child { margin-left:0; } .gbar nav a[aria-current] { opacity:1; border-bottom:2px solid var(--beacon); }
    .wrap { max-width:1080px; }
    .hero { padding:2.4rem 1.25rem .6rem; } .hero .lede { font-size:1.12rem; }
    .credit { font-size:.88rem; color:var(--muted); margin-top:.8rem; }
    .doors { display:grid; grid-template-columns:1fr; gap:1rem; margin-top:1.6rem; }
    @media (min-width:760px) { .doors { grid-template-columns:repeat(3,1fr); } }
    .door { background:var(--card); border:1px solid var(--line); border-top:6px solid var(--c); border-radius:18px; padding:1.3rem 1.3rem 1.4rem; display:flex; flex-direction:column; gap:.6rem; box-shadow:0 2px 10px rgba(22,40,58,.05); }
    .door h2 { margin:0; font-size:1.7rem; } .door .k { font-size:.78rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--c); }
    .door p { color:var(--muted); } .door ul { list-style:none; display:flex; flex-direction:column; gap:.35rem; flex:1; }
    .door li a { color:var(--ink); font-weight:500; text-decoration:none; border-bottom:1px solid var(--line); } .door li a:hover { border-color:var(--c); }
    .door .btn { background:var(--c); color:#fff; text-align:center; margin-top:.4rem; } .door .btn:hover { filter:brightness(1.1); }
    .d-money { --c:#3f5f4c; } .d-travel { --c:#1d5c6b; } .d-data { --c:#16283a; }
    .pcard .tag { font-size:.75rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
    .soon { font-size:.85rem; font-weight:700; color:#7a4d06; background:#fff1d6; border-radius:999px; padding:.25rem .7rem; }
    .freebies { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem; margin-top:1rem; }
    .freebie { background:linear-gradient(135deg,var(--c),#7b4f7a); color:#fff; border-radius:16px; padding:1.2rem; display:flex; flex-direction:column; gap:.5rem; }
    .freebie h3 { color:#fff; margin:0; font-size:1.2rem; } .freebie p { color:#eef3f1; font-size:.95rem; flex:1; }
    .freebie .btn { align-self:flex-start; }
    .hub2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1rem; margin-top:1.2rem; }
    .hub2 a { display:block; background:var(--card); border:1px solid var(--line); border-top:5px solid var(--sage-deep); border-radius:16px; padding:1.2rem; text-decoration:none; color:var(--ink); }
    .hub2 a:hover { border-top-color:var(--beacon); } .hub2 h2 { margin:0 0 .35rem; font-size:1.35rem; } .hub2 p { color:var(--muted); } .hub2 .go { display:inline-block; margin-top:.6rem; font-weight:600; color:var(--sage-deep); }
    .fav { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
    .list2 { columns:2 240px; margin:.6rem 0 0 1.1rem; } .list2 li { margin:.25rem 0; break-inside:avoid; }
"""

from build_travel import TP_DRIVE  # homepage needs it for Travelpayouts verification

def head(path, title, desc, ld, cur, extra_head=""):
    url = SITE + path
    lds = "".join(f'\n  <script type="application/ld+json">\n{json.dumps(x, indent=1, ensure_ascii=False)}\n  </script>' for x in ld)
    nav = "".join(f'<a href="{p}"{" aria-current=\"true\"" if p == cur else ""}>{n}</a>' for p, n in SECTIONS)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}" />
  <meta name="author" content="Dark Lighthouse Solutions" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="{url}" />{extra_head}
  <meta property="og:site_name" content="Dark Lighthouse Solutions" />
  <meta property="og:title" content="{e(title.split(' | ')[0] if path != '/' else title)}" />
  <meta property="og:description" content="{e(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{SITE}/og-default.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />{lds}
  <style>{BASE_CSS}{FCSS}  </style>
{TP_DRIVE if path == "/" else ""}</head>
<body>
  <div class="gbar"><div class="wrap">
    <a class="brand" href="/">Dark Lighthouse <span>Solutions</span></a>
    <nav aria-label="Sections">{nav}</nav>
  </div></div>
'''

FOOT = '''
  <footer class="wrap">
    <p><strong>Money:</strong> <a href="/money/">Money home</a> · <a href="/templates/">Templates &amp; planners</a> · <a href="/tools/">Free calculators</a> · <a href="/renewal-radar/">Renewal Radar</a></p>
    <p style="margin-top:.4rem"><strong>Travel:</strong> <a href="/travel/">Travel home</a> · <a href="/travel/scotland/">Scotland trip planning guide</a> · <a href="/travel/planners/">Travel planners</a> · <a href="/travel/tools/">Travel calculators</a></p>
    <p style="margin-top:.4rem"><strong>Data:</strong> <a href="/data/">Data engineering kits</a> · <a href="/kits/">Kit guides</a></p>
    <p style="margin-top:.8rem">Made by <strong>Dark Lighthouse Solutions</strong> · Sold via Polar (merchant of record), which handles checkout and tax. <a href="/privacy/">Privacy</a> · Questions? <a href="mailto:admin@darklighthousesolutions.com">admin@darklighthousesolutions.com</a></p>
  </footer>
'''

def pcard(c, tag=""):
    free = c["price"].lower() == "free"
    t = f'<span class="tag">{e(tag)}</span>' if tag else ""
    return f'''      <article class="pcard">
        <img src="{c["img"]}" alt="{e(c["name"])} preview" loading="lazy" width="1000" height="750" />
        <div class="b">{t}
          <h3>{e(c["name"])}</h3>
          <p>{e(c["blurb"])}</p>
          <div class="buy-row"><span class="price">{e(c["price"])}</span><a class="btn btn-primary" href="{c["url"]}">{"Get it free" if free else "Buy now"}</a></div>
        </div>
      </article>'''

def breadcrumbs(name, path):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": name, "item": SITE + path}]}

def home(M):
    org_ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Organization", "@id": SITE + "/#organization", "name": "Dark Lighthouse Solutions", "url": SITE + "/",
         "logo": {"@type": "ImageObject", "url": SITE + "/icon-512.png", "width": 512, "height": 512},
         "image": SITE + "/og-default.jpg", "email": "admin@darklighthousesolutions.com",
         "description": "Budget templates, free money and travel calculators, family travel planners and data engineering starter kits, sold as one-time downloads."},
        {"@type": "WebSite", "@id": SITE + "/#website", "name": "Dark Lighthouse Solutions",
         "alternateName": ["Dark Lighthouse", "darklighthousesolutions.com"], "url": SITE + "/",
         "publisher": {"@id": SITE + "/#organization"}},
        {"@type": "SiteNavigationElement", "name": ["Money", "Travel", "Data"],
         "url": [SITE + "/money/", SITE + "/travel/", SITE + "/data/"]}]}
    pin = '\n  <meta name="p:domain_verify" content="9e8405d0aec5d6db291fbf7ce8654c37"/>'
    # old homepage anchors (/#kits, /#bundles, /#details, /#kit-…) now live on /data/
    redirect = '''
  <script>(function(h){if(/^#(kits|bundles|details|kit-[\\w-]+)$/.test(h))location.replace("/data/"+h);})(location.hash);</script>'''
    page = head("/", "Dark Lighthouse Solutions | Budget Templates, Family Travel Planners & Data Kits",
                "Practical planners and tools from a small family business: budget templates and free money calculators, family travel planners with a Scotland guide, and data engineering starter kits.",
                [org_ld], None, pin + redirect)
    tr = {s: travel_card(s) for s in TP}
    rr = dict(name="Renewal Radar", blurb="A small browser extension that keeps an eye on your subscriptions and free trials, and reminds you before each charge.",
              img="/renewal-radar/img/shot-1.jpg")
    page += f'''
  <header class="wrap hero">
    <h1>Practical planners and tools, made by a family that uses them</h1>
    <p class="lede">We're a family who got tired of guessing: how much the trip will really cost, which bill comes out of which paycheck, how long that Highland drive actually takes. So we build the spreadsheets, calculators and checklists we wanted, and share them here. Some are free; the rest are a small one-time price.</p>
    <p class="credit">Made by Dark Lighthouse Solutions.</p>
  </header>
  <main class="wrap">
    <div class="doors">
      <section class="door d-money" aria-labelledby="d-money">
        <span class="k">Budgets &amp; life admin</span>
        <h2 id="d-money">Money</h2>
        <p>Google Sheets templates and printable planners for budgeting, debt, saving and life admin, plus free calculators.</p>
        <ul>
          <li><a href="/tools/budget-by-paycheck-calculator/">Budget by paycheck calculator</a></li>
          <li><a href="/tools/debt-payoff-calculator/">Debt payoff calculator</a></li>
          <li><a href="/templates/">Budget templates &amp; planners</a></li>
        </ul>
        <a class="btn" href="/money/">Go to Money</a>
      </section>
      <section class="door d-travel" aria-labelledby="d-travel">
        <span class="k">Family trips on a budget</span>
        <h2 id="d-travel">Travel</h2>
        <p>Planning a trip with kids: what it'll cost, what to save each payday, and an honest guide to a Scotland road trip.</p>
        <ul>
          <li><a href="/travel/scotland/">Scotland trip planning guide</a></li>
          <li><a href="/travel/tools/travel-budget-calculator/">Travel budget calculator</a></li>
          <li><a href="/travel/planners/">Family travel planners</a></li>
        </ul>
        <a class="btn" href="/travel/">Go to Travel</a>
      </section>
      <section class="door d-data" aria-labelledby="d-data">
        <span class="k">For engineers</span>
        <h2 id="d-data">Data</h2>
        <p>Starter kits for data and backend work: pipelines, integrations and APIs you can run on day one and own outright.</p>
        <ul>
          <li><a href="/netsuite-adf/">NetSuite to Azure Data Factory bridge</a></li>
          <li><a href="/kits/clickhouse-log-analytics/">ClickHouse log analytics kit</a></li>
          <li><a href="/kits/">All kit guides</a></li>
        </ul>
        <a class="btn" href="/data/">Go to Data</a>
      </section>
    </div>

    <h2>A few favourites</h2>
    <p class="muted">One-time purchase, delivered by Polar. Google Sheets or Excel.</p>
    <div class="cta fav">
{pcard(dict(M["life-admin-bundle"], blurb="Every money planner and template we make, in one download: budgets, debt payoff, sinking funds, meals, moving, the wedding planner and more."), "Money")}
{pcard(tr["travel-planner-bundle"], "Travel")}
{pcard(tr["scotland-trip-planner"], "Travel")}
      <article class="pcard">
        <img src="{rr["img"]}" alt="Renewal Radar preview" loading="lazy" />
        <div class="b"><span class="tag">Money</span>
          <h3>{rr["name"]}</h3>
          <p>{e(rr["blurb"])}</p>
          <div class="buy-row"><span class="soon">Coming soon</span><a class="btn btn-ghost" href="/renewal-radar/">Take a look</a></div>
        </div>
      </article>
    </div>

    <h2>Free to grab</h2>
    <div class="freebies">
      <div class="freebie" style="--c:#3f5f4c"><h3>Monthly Budget Snapshot</h3><p>{e(M["monthly-budget-snapshot"]["blurb"])}</p><a class="btn btn-beacon" href="{M["monthly-budget-snapshot"]["url"]}">Get it free</a></div>
      <div class="freebie" style="--c:#1d5c6b"><h3>Kids Travel Packing Checklist</h3><p>{e(tr["kids-travel-packing-checklist"]["blurb"])}</p><a class="btn btn-beacon" href="{tr["kids-travel-packing-checklist"]["url"]}">Get it free</a></div>
      <div class="freebie" style="--c:#16283a"><h3>Free calculators</h3><p>Sinking funds, budget by paycheck, debt payoff, wedding, moving and grocery budgets, plus two for travel. No sign-up, nothing leaves your browser.</p><a class="btn btn-beacon" href="/tools/sinking-funds-calculator/">Try the sinking funds calculator</a></div>
    </div>
  </main>
''' + FOOT + "</body>\n</html>\n"
    (ROOT / "index.html").write_text(inject(page), encoding="utf-8")

MONEY_ORDER = ["life-admin-bundle", "sheets-bundle-5", "planner-plus-sheets-bundle", "monthly-budget-snapshot", "budget-by-paycheck",
               "debt-payoff-dashboard", "sinking-funds", "holiday-gift-budget-planner", "meal-planner-grocery-list", "moving-planner",
               "wedding-planner-budget", "just-in-case-binder", "debt-free-2027-planner", "seller-profit-tracker", "business-expense-invoice-log"]
CALCS = [("/tools/budget-by-paycheck-calculator/", "Budget by paycheck calculator"), ("/tools/debt-payoff-calculator/", "Debt payoff calculator"),
         ("/tools/sinking-funds-calculator/", "Sinking funds calculator"), ("/tools/grocery-budget-calculator/", "Grocery budget calculator"),
         ("/tools/moving-cost-calculator/", "Moving cost calculator"), ("/tools/wedding-budget-calculator/", "Wedding budget calculator")]

def money(M):
    order = MONEY_ORDER + [s for s in M if s not in MONEY_ORDER]
    item_ld = {"@context": "https://schema.org", "@type": "ItemList", "name": "Money templates and planners", "url": SITE + "/money/",
               "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/templates/#{s}", "name": M[s]["name"]} for i, s in enumerate(order)]}
    calc_ld = {"@context": "https://schema.org", "@type": "ItemList", "name": "Free money calculators",
               "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": SITE + p, "name": n} for i, (p, n) in enumerate(CALCS)]}
    page = head("/money/", "Money: Budget Templates, Planners & Free Calculators | Dark Lighthouse Solutions",
                "Google Sheets budget templates, printable planners and free money calculators: budget by paycheck, debt payoff, sinking funds and more. One-time purchase, no subscription.",
                [item_ld, calc_ld, breadcrumbs("Money", "/money/")], "/money/")
    calcs = "".join(f'<li><a href="{p}">{e(n)}</a></li>' for p, n in CALCS)
    page += f'''
  <header class="wrap hero">
    <p class="crumb"><a href="/">Home</a> › Money</p>
    <h1>Money templates, planners and free calculators</h1>
    <p class="lede">Simple Google Sheets and printables for budgeting by paycheck, paying off debt, saving for the big stuff and keeping life admin in one place. The calculators are free and nothing you type leaves your browser.</p>
  </header>
  <main class="wrap">
    <div class="hub2">
      <a href="/templates/"><h2>Templates &amp; planners</h2><p>{len(M)} spreadsheets, printables and bundles, with previews and what's inside each one.</p><span class="go">Browse templates →</span></a>
      <a href="/tools/"><h2>Free calculators</h2><p>Budget by paycheck, debt payoff, sinking funds, grocery, moving and wedding budgets.</p><span class="go">Open the calculators →</span></a>
      <a href="/renewal-radar/"><h2>Renewal Radar</h2><p>A small browser extension for subscriptions and free trials. <strong>Coming soon.</strong></p><span class="go">Take a look →</span></a>
    </div>

    <h2>Free calculators</h2>
    <ul class="list2">{calcs}</ul>

    <h2 id="templates">Everything in the Money shop</h2>
    <p class="muted">One-time purchase via Polar. Full details and previews for each are on the <a href="/templates/">templates page</a>.</p>
    <div class="cta">
{chr(10).join(pcard(M[s]) for s in order)}
    </div>
  </main>
''' + FOOT + "</body>\n</html>\n"
    d = ROOT / "money"; d.mkdir(exist_ok=True)
    (d / "index.html").write_text(inject(page), encoding="utf-8")

if __name__ == "__main__":
    M = money_cards()
    home(M); money(M)
    print(f"built / and /money/ ({len(M)} money products)")
