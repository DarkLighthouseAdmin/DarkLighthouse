#!/usr/bin/env python3
"""Build the free calculator pages under /tools/ (index + 6 calculators). Run from anywhere:
    python3 scripts/build_tools.py
Math lives in /tools/calc.js (tested by `node scripts/test_tools.js`). GA4 + checkout tracking come from add_analytics.inject()."""
import sys, json, html
sys.dont_write_bytecode = True
from pathlib import Path
from add_analytics import inject

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://darklighthousesolutions.com"
URLS = {k: (v if isinstance(v, str) else v["checkout_url"]) for k, v in json.load(open("/workspace/polar-push/checkout-urls.json")).items()}
PRODUCTS = {
  "debt-payoff-dashboard": ("Debt Payoff Dashboard", 14, "Type in your cards. Get your payoff order, monthly plan, debt-free date and interest saved, automatically."),
  "sheets-bundle-5": ("Money Spreadsheet Bundle (all 5)", 29, "Debt Payoff Dashboard, Budget by Paycheck, Sinking Funds, Seller Profit Tracker and Expense & Invoice Log. $54 bought separately."),
  "wedding-planner-budget": ("Wedding Planner & Budget", 14, "Budget vs actual vs paid, payments due, guest list and RSVPs, seating, vendors and a 12-month checklist in one Google Sheet."),
  "sinking-funds": ("Sinking Funds Tracker", 7, "Set goals and due dates. It works out the monthly amount and tracks progress for up to 15 funds."),
  "budget-by-paycheck": ("Budget by Paycheck", 9, "Add your paychecks and bills. It assigns each bill to the right paycheck and shows what's left from each one."),
  "meal-planner-grocery-list": ("Meal Planner & Grocery List", 11, "Plan the week's meals and the grocery list writes itself: repeats merged, pantry staples skipped, sorted by aisle."),
  "monthly-budget-snapshot": ("Monthly Budget Snapshot", 0, "A free one-page monthly budget: income, bills, spending and savings, with over-budget and unpaid bills flagged."),
  "moving-planner": ("Moving Planner & Checklist", 12, "Timeline, budget, box inventory, address changes and utilities for a move, in one spreadsheet."),
}
e = html.escape

CSS = """
    :root { --ink:#1f2a33; --muted:#5b6b73; --cream:#f7f3ea; --card:#fffdf8; --sage:#6f8f7a; --sage-deep:#3f5f4c;
            --navy:#16283a; --beacon:#e8a54b; --beacon-hot:#d98b25; --line:rgba(31,42,51,.12); --ok:#2f8f5f; --bad:#b4442f; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:"IBM Plex Sans",system-ui,sans-serif; color:var(--ink); background:var(--cream); line-height:1.55; }
    a { color:var(--sage-deep); }
    .wrap { max-width:1000px; margin:0 auto; padding:0 1.25rem; }
    .topbar { background:var(--navy); color:#e8eef6; }
    .topbar .wrap { display:flex; justify-content:space-between; align-items:center; padding:.8rem 1.25rem; gap:1rem; flex-wrap:wrap; }
    .topbar a { color:#e8eef6; text-decoration:none; font-weight:500; }
    .topbar .brand { font-family:Fraunces,serif; font-size:1.15rem; }
    .topbar .brand span { color:var(--beacon); }
    .hero { padding:2.5rem 0 1rem; }
    .crumb { font-size:.9rem; color:var(--muted); margin-bottom:.6rem; }
    h1 { font-family:Fraunces,serif; font-size:clamp(1.9rem,4.5vw,2.7rem); line-height:1.12; color:var(--navy); }
    .lede { font-size:1.1rem; color:var(--muted); max-width:46rem; margin-top:.7rem; }
    h2 { font-family:Fraunces,serif; font-size:1.55rem; color:var(--navy); margin:2.2rem 0 .5rem; }
    h3 { font-size:1.08rem; color:var(--navy); margin:1.2rem 0 .3rem; }
    .panel { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(22,40,58,.05); margin-top:1.2rem; }
    label { font-size:.85rem; font-weight:600; color:var(--muted); display:block; margin-bottom:.2rem; }
    input, select { font:inherit; width:100%; padding:.55rem .65rem; border:1px solid rgba(31,42,51,.25); border-radius:9px; background:#fff; color:var(--ink); min-width:0; }
    input:focus, select:focus { outline:2px solid var(--beacon); outline-offset:1px; }
    input[aria-invalid="true"] { border-color:var(--bad); background:#fff5f2; }
    .rows { display:flex; flex-direction:column; gap:.7rem; }
    .row { display:grid; gap:.6rem; align-items:end; padding:.7rem; border:1px solid var(--line); border-radius:12px; background:#fff; }
    .row.debt { grid-template-columns:1.6fr 1fr .8fr 1fr auto; }
    .row.goal { grid-template-columns:1.6fr 1fr 1fr 1.2fr auto; }
    .row.person { grid-template-columns:1fr auto; }
    .row.cost { grid-template-columns:2fr 1fr 1.2fr auto; }
    .row.bill { grid-template-columns:1.6fr 1fr 1.4fr auto; }
    .stat.over { border:2px solid var(--bad); background:#fff8f5; }
    .stat ul.bl { list-style:none; margin:.5rem 0 0; font-size:.92rem; }
    .stat ul.bl li { display:flex; justify-content:space-between; gap:.6rem; padding:.2rem 0; border-top:1px dashed var(--line); }
    .related { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:.6rem; }
    .related a { display:inline-block; padding:.5rem .9rem; border:1px solid var(--line); border-radius:999px; background:var(--card); text-decoration:none; font-weight:600; }
    .related a:hover { border-color:var(--sage); }
    .fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:.8rem; margin-top:1rem; }
    .rm { border:0; background:transparent; color:var(--muted); font-size:1.4rem; line-height:1; padding:.45rem .5rem; cursor:pointer; border-radius:8px; }
    .rm:hover { background:#f1ece2; color:var(--bad); }
    .actions { display:flex; gap:.7rem; flex-wrap:wrap; margin-top:1rem; }
    .btn { display:inline-block; padding:.65rem 1.15rem; border-radius:10px; font-weight:600; text-decoration:none; border:0; cursor:pointer; font:inherit; font-weight:600; }
    .btn-primary { background:var(--sage-deep); color:#fff; } .btn-primary:hover { background:var(--sage); }
    .btn-ghost { background:transparent; border:1px solid var(--line); color:var(--sage-deep); }
    .btn-beacon { background:var(--beacon); color:var(--navy); } .btn-beacon:hover { background:var(--beacon-hot); }
    .seg { display:flex; flex-wrap:wrap; gap:.4rem; } .seg label { margin:0; }
    .seg input { position:absolute; opacity:0; width:1px; }
    .seg span { display:inline-block; padding:.45rem .85rem; border:1px solid rgba(31,42,51,.25); border-radius:999px; background:#fff; font-weight:600; color:var(--ink); cursor:pointer; font-size:.9rem; }
    .seg input:checked + span { background:var(--navy); color:#fff; border-color:var(--navy); }
    .seg input:focus-visible + span { outline:2px solid var(--beacon); }
    .errors { display:none; background:#fff3ef; border:1px solid #e9b8a9; color:#7a2a17; border-radius:12px; padding:.8rem 1rem; margin-top:1rem; }
    .errors.show { display:block; } .errors ul { margin-left:1.1rem; }
    .results { margin-top:1.2rem; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:.8rem; }
    .stat { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:1rem; }
    .stat.win { border:2px solid var(--ok); }
    .stat .k { font-size:.8rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:600; }
    .stat .v { font-family:Fraunces,serif; font-size:1.7rem; color:var(--navy); line-height:1.2; }
    .stat .s { font-size:.9rem; color:var(--muted); }
    .stat ol { margin:.4rem 0 0 1.2rem; font-size:.92rem; }
    .callout { background:#e6f4ec; border:1px solid var(--ok); color:#174d33; border-radius:12px; padding:.8rem 1rem; margin-top:1rem; }
    .warn { background:#fff7e8; border:1px solid var(--beacon); color:#6b4a12; border-radius:12px; padding:.8rem 1rem; margin-top:1rem; }
    .tablewrap { overflow:auto; max-height:420px; border:1px solid var(--line); border-radius:12px; margin-top:.7rem; background:#fff; }
    table { border-collapse:collapse; width:100%; font-size:.92rem; }
    th, td { padding:.45rem .65rem; text-align:right; border-bottom:1px solid var(--line); white-space:nowrap; }
    th:first-child, td:first-child { text-align:left; }
    th { background:#f1ece2; color:var(--navy); position:sticky; top:0; font-weight:600; }
    tfoot td { font-weight:700; background:#faf7f0; }
    td.note { text-align:left; white-space:normal; color:var(--muted); }
    .bar { display:inline-block; height:.55rem; background:var(--sage); border-radius:4px; vertical-align:middle; margin-right:.4rem; }
    .muted { color:var(--muted); font-size:.92rem; }
    .copy p, .copy li { max-width:46rem; margin-top:.7rem; } .copy ul, .copy ol { margin-left:1.2rem; }
    .faq details { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:.8rem 1rem; margin-top:.6rem; max-width:46rem; }
    .faq summary { font-weight:600; cursor:pointer; color:var(--navy); } .faq details p { margin-top:.5rem; }
    .cta { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1rem; margin-top:1rem; }
    .pcard { background:var(--card); border:1px solid var(--line); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; }
    .pcard img { width:100%; height:auto; aspect-ratio:4/3; object-fit:cover; display:block; background:#eee; }
    .pcard .b { padding:1rem 1.1rem 1.2rem; display:flex; flex-direction:column; gap:.45rem; flex:1; }
    .pcard h3 { margin:0; } .pcard p { color:var(--muted); font-size:.95rem; flex:1; }
    .buy-row { display:flex; align-items:center; justify-content:space-between; gap:.8rem; }
    .price { font-size:1.3rem; font-weight:600; color:var(--navy); }
    .tools { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1rem; margin-top:1rem; }
    .tool { display:block; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:1.2rem; text-decoration:none; color:var(--ink); }
    .tool:hover { border-color:var(--sage); } .tool h2 { font-size:1.3rem; margin:0 0 .4rem; } .tool p { color:var(--muted); }
    .tool .go { display:inline-block; margin-top:.7rem; font-weight:600; color:var(--sage-deep); }
    footer { margin:3.5rem 0 2rem; color:var(--muted); font-size:.92rem; border-top:1px solid var(--line); padding-top:1.2rem; }
    @media (max-width:720px) {
      .row.debt, .row.goal, .row.cost, .row.bill { grid-template-columns:1fr 1fr; }
      .row .name { grid-column:1 / -1; }
      .row .rm { grid-column:2; justify-self:end; }
      th, td { padding:.4rem .5rem; font-size:.86rem; }
    }
"""

def head(path, title, desc, og_image, ld):
    url = SITE + path
    lds = "".join(f'\n  <script type="application/ld+json">\n{json.dumps(x, indent=1, ensure_ascii=False)}\n  </script>' for x in ld)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}" />
  <meta name="author" content="Dark Lighthouse Solutions" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="{url}" />
  <meta property="og:site_name" content="Dark Lighthouse Solutions" />
  <meta property="og:title" content="{e(title.split(' | ')[0])}" />
  <meta property="og:description" content="{e(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{SITE}{og_image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />{lds}
  <style>{CSS}  </style>
</head>
<body>
  <div class="topbar"><div class="wrap">
    <a class="brand" href="/">Dark Lighthouse <span>Solutions</span></a>
    <nav><a href="/templates/">Money templates</a> &nbsp;·&nbsp; <a href="/tools/">Free tools</a> &nbsp;·&nbsp; <a href="/#kits">Developer kits</a></nav>
  </div></div>
'''

FOOT = '''
  <footer class="wrap">
    <p><a href="/tools/">Free tools</a> · <a href="/tools/debt-payoff-calculator/">Debt payoff calculator</a> · <a href="/tools/wedding-budget-calculator/">Wedding budget calculator</a> · <a href="/tools/sinking-funds-calculator/">Sinking funds calculator</a> · <a href="/tools/grocery-budget-calculator/">Grocery budget calculator</a> · <a href="/tools/moving-cost-calculator/">Moving cost calculator</a> · <a href="/tools/budget-by-paycheck-calculator/">Budget by paycheck calculator</a> · <a href="/templates/">Money templates</a></p>
    <p style="margin-top:.4rem">These calculators are estimates for planning, not financial advice. Nothing you type leaves your browser.</p>
    <p style="margin-top:.4rem"><strong>Dark Lighthouse Solutions</strong> · Templates sold via Polar (merchant of record). Questions? <a href="mailto:admin@darklighthousesolutions.com">admin@darklighthousesolutions.com</a></p>
  </footer>
'''

def cta(slugs, heading, sub):
    cards = []
    for s in slugs:
        name, price, short = PRODUCTS[s]
        cards.append(f'''      <article class="pcard" id="get-{s}">
        <a href="/templates/#{s}"><img src="/assets/money/{s}/1.jpg" alt="{e(name)} preview" loading="lazy" width="1000" height="750" /></a>
        <div class="b">
          <h3>{e(name)}</h3>
          <p>{e(short)}</p>
          <div class="buy-row"><span class="price">{"Free" if price == 0 else "$" + str(price)}</span><a class="btn btn-primary" href="{URLS[s]}">{"Get it free" if price == 0 else "Buy now"}</a></div>
        </div>
      </article>''')
    return f'''    <h2 id="template">{e(heading)}</h2>
    <p class="muted">{e(sub)}</p>
    <div class="cta">
{chr(10).join(cards)}
    </div>
'''

def faq_html(faq):
    return '    <h2 id="faq">Questions</h2>\n    <div class="faq">\n' + "\n".join(
        f'      <details><summary>{e(q)}</summary><p>{a}</p></details>' for q, a in faq) + "\n    </div>\n"

def faq_ld(faq):
    import re
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", a)}} for q, a in faq]}

def app_ld(name, path, desc):
    return {"@context": "https://schema.org", "@type": "WebApplication", "name": name, "url": SITE + path, "description": desc,
            "applicationCategory": "FinanceApplication", "operatingSystem": "Any (web browser)", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "publisher": {"@type": "Organization", "name": "Dark Lighthouse Solutions", "url": SITE + "/"}}

def crumbs_ld(path, name):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Free tools", "item": SITE + "/tools/"},
        {"@type": "ListItem", "position": 3, "name": name, "item": SITE + path}]}

COMMON_JS = r"""
    var DL = window.DLCalc, used = false;
    function num(v) { v = String(v == null ? "" : v).replace(/[$,\s%]/g, ""); return v === "" ? NaN : Number(v); }
    function money(x, cents) { return (x < 0 ? "-$" : "$") + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }); }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function monthLabel(d) { return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
    function dateLabel(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    function showErrors(box, errs) { box.innerHTML = errs.length ? "<strong>Please check:</strong><ul>" + errs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : ""; box.classList.toggle("show", errs.length > 0); }
    function track(tool, user) { if (user && !used && typeof gtag === "function") { used = true; gtag("event", "calculator_used", { tool: tool }); } }
    function parseDate(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN); }
    function isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
"""

# ---------------------------------------------------------------- debt payoff
DEBT_FAQ = [
  ("Is the avalanche or snowball method better?", "Avalanche (highest interest rate first) always costs the same or less in interest, so it's the better deal on paper. Snowball (smallest balance first) clears a whole debt sooner, and that early win keeps a lot of people going. If the interest difference this calculator shows is small, pick the one you'll stick with."),
  ("What does the extra monthly payment mean?", "It's anything you can pay on top of all your minimum payments combined. The calculator sends it to one focus debt at a time. When a debt is paid off, its minimum rolls into the next one too, so your total monthly payment stays the same until everything is gone."),
  ("Why does it say a debt will never be paid off?", "If a minimum payment is smaller than the interest that debt charges each month, the balance grows instead of shrinking. Raise the minimum or the extra payment until the calculator shows a payoff date."),
  ("How accurate is this?", "It compounds interest monthly at APR ÷ 12 and assumes your rates, minimums and extra payment stay the same and you add no new charges. Real statements calculate daily interest and minimums that shrink, so treat the dates as a close estimate, not a quote."),
]
DEBT_COPY = """
    <section class="copy">
    <h2>How the debt snowball and debt avalanche work</h2>
    <p>Both methods start the same way: list every debt, keep paying every minimum, and find one fixed extra amount you can add each month. The only difference is <strong>which debt gets the extra money first</strong>.</p>
    <ul>
      <li><strong>Debt avalanche:</strong> the extra goes to the debt with the highest APR. You pay less interest overall, because the most expensive balance disappears first.</li>
      <li><strong>Debt snowball:</strong> the extra goes to the smallest balance. You close accounts faster, which is motivating when you have several cards.</li>
    </ul>
    <p>In both, when a debt is paid off you don't get to keep its minimum payment. It rolls into the next debt on the list. That roll-over is why the payoff speeds up near the end: by the last debt, you're throwing every freed-up minimum at it.</p>
    <h3>How to use this calculator</h3>
    <ol>
      <li>Enter each debt with its current balance, APR and minimum payment. Your statement or banking app has all three.</li>
      <li>Add the extra amount you can pay every month. Even $50 makes a visible difference.</li>
      <li>Press <em>Calculate</em> to compare your debt-free date, months to payoff, total interest and payoff order side by side.</li>
    </ol>
    <p>The month-by-month table shows what you'd pay, how much of it is interest and how much you'd still owe after each month, plus the month each debt is gone.</p>
    <h3>Getting more out of the plan</h3>
    <p>The biggest lever is the extra payment, not the method. Try raising it by $25 or $50 and watch how many months drop off. If one card has a much higher APR than the rest, asking for a lower rate or using a 0% balance transfer (watch the transfer fee) can beat either method. Once you have a plan, write the debt-free month somewhere you'll see it, and check your balances once a month so the plan matches reality.</p>
    <p>A calculator gives you the plan once. If you want it to stay up to date as you pay (balances, interest saved, progress bars and next month's payments), the template below does that in Google Sheets.</p>
    </section>
"""
DEBT_BODY = """
  <header class="wrap hero">
    <p class="crumb"><a href="/tools/">Free tools</a> › Debt payoff calculator</p>
    <h1>Debt Payoff Calculator: Snowball vs Avalanche</h1>
    <p class="lede">Enter your debts and an extra monthly payment. See your debt-free date, total interest and payoff order for both methods, side by side. Free, no sign-up, and nothing leaves your browser.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <h2 style="margin-top:0">Your debts</h2>
      <p class="muted">Example numbers are filled in. Replace them with yours.</p>
      <div class="rows" id="rows"></div>
      <div class="actions"><button class="btn btn-ghost" type="button" id="add">+ Add a debt</button></div>
      <div class="fields">
        <div><label for="extra">Extra payment each month ($)</label><input id="extra" inputmode="decimal" value="200" /></div>
      </div>
      <div class="errors" id="err" role="alert"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Calculate</button></div>
    </form>
    <section class="results" id="out" aria-live="polite"></section>
__CTA__
__COPY__
__RELATED__
__FAQ__
  </main>
"""
DEBT_JS = r"""
    var rows = document.getElementById("rows"), err = document.getElementById("err"), out = document.getElementById("out");
    var EX = [["Credit card", 4200, 24.99, 120], ["Store card", 900, 19.99, 35], ["Car loan", 8500, 6.9, 260]];
    function addRow(d) {
      d = d || ["", "", "", ""];
      var n = rows.children.length + 1, r = document.createElement("div"); r.className = "row debt";
      r.innerHTML = '<div class="name"><label>Debt name</label><input data-k="name" maxlength="40" placeholder="e.g. Visa" /></div>' +
        '<div><label>Balance ($)</label><input data-k="balance" inputmode="decimal" placeholder="0" /></div>' +
        '<div><label>APR (%)</label><input data-k="apr" inputmode="decimal" placeholder="0" /></div>' +
        '<div><label>Min. payment ($)</label><input data-k="min" inputmode="decimal" placeholder="0" /></div>' +
        '<button class="rm" type="button" aria-label="Remove this debt">×</button>';
      var ins = r.querySelectorAll("input"); ins[0].value = d[0]; ins[1].value = d[1]; ins[2].value = d[2]; ins[3].value = d[3];
      r.querySelector(".rm").onclick = function () { if (rows.children.length > 1) r.remove(); else ins.forEach(function (i) { i.value = ""; }); };
      rows.appendChild(r);
    }
    EX.forEach(addRow);
    document.getElementById("add").onclick = function () { if (rows.children.length < 20) { addRow(); rows.lastChild.querySelector("input").focus(); } };
    function read() {
      return Array.prototype.map.call(rows.children, function (r, i) {
        var g = function (k) { return r.querySelector('[data-k="' + k + '"]'); };
        return { name: g("name").value.trim() || "Debt " + (i + 1), balance: num(g("balance").value), apr: num(g("apr").value), min: num(g("min").value), _r: r };
      }).filter(function (d) { var r = d._r.querySelectorAll("input"); return r[1].value.trim() || r[2].value.trim() || r[3].value.trim() || r[0].value.trim(); });
    }
    function mark(debts) {
      rows.querySelectorAll("input").forEach(function (i) { i.removeAttribute("aria-invalid"); });
      debts.forEach(function (d) { var g = function (k) { return d._r.querySelector('[data-k="' + k + '"]'); };
        if (!(d.balance > 0)) g("balance").setAttribute("aria-invalid", "true");
        if (!(d.apr >= 0 && d.apr <= 100)) g("apr").setAttribute("aria-invalid", "true");
        if (!(d.min > 0)) g("min").setAttribute("aria-invalid", "true"); });
    }
    function card(r, label, win, start) {
      if (!r.ok) return '<div class="stat"><div class="k">' + label + '</div><div class="v">Not paid off</div><div class="s">At these payments the balance never reaches $0. Raise a minimum or the extra payment.</div></div>';
      var end = DL.addMonths(start, r.months - 1);
      return '<div class="stat' + (win ? " win" : "") + '"><div class="k">' + label + (win ? " · less interest" : "") + '</div>' +
        '<div class="v">' + monthLabel(end) + '</div><div class="s">' + r.months + ' months · ' + money(r.totalInterest, true) + ' interest · ' + money(r.totalPaid, true) + ' total paid</div>' +
        '<ol>' + r.order.map(function (o) { return "<li>" + esc(o.name) + " <span class='muted'>(month " + o.month + ")</span></li>"; }).join("") + '</ol></div>';
    }
    function table(r, start) {
      if (!r.ok) return "";
      return '<div class="tablewrap"><table><thead><tr><th>Month</th><th>Paid</th><th>Interest</th><th>Still owed</th><th style="text-align:left">Paid off</th></tr></thead><tbody>' +
        r.rows.map(function (x) { return "<tr><td>" + x.month + " · " + monthLabel(DL.addMonths(start, x.month - 1)) + "</td><td>" + money(x.paid, true) + "</td><td>" + money(x.interest, true) + "</td><td>" + money(x.balance, true) + "</td><td class='note'>" + esc(x.closed.join(", ")) + "</td></tr>"; }).join("") +
        '</tbody></table></div>';
    }
    function calc(user) {
      var debts = read(), extra = num(document.getElementById("extra").value); if (isNaN(extra)) extra = 0;
      var errs = DL.validateDebts(debts, extra); mark(debts); showErrors(err, errs);
      if (errs.length) { out.innerHTML = ""; return; }
      track("debt_payoff", user);
      var now = new Date(), start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      var av = DL.payoff(debts, extra, "avalanche"), sn = DL.payoff(debts, extra, "snowball");
      var low = debts.filter(function (d) { return d.min <= d.balance * d.apr / 1200; }).map(function (d) { return esc(d.name); });
      var saved = av.ok && sn.ok ? sn.totalInterest - av.totalInterest : 0;
      var html = '<h2>Your results</h2><p class="muted">Assumes your first payment is next month and you pay ' + money(av.budget || sn.budget || 0, true) + ' every month in total (all minimums plus the extra).</p>';
      if (low.length) html += '<div class="warn">The minimum on <strong>' + low.join(", ") + '</strong> doesn\'t cover its monthly interest, so that balance grows until the extra money reaches it.</div>';
      html += '<div class="stats" style="margin-top:.8rem">' + card(av, "Avalanche (highest APR first)", av.ok && saved > 0.5, start) + card(sn, "Snowball (smallest balance first)", false, start) + '</div>';
      if (av.ok && sn.ok) html += '<div class="callout">' + (saved > 0.5 ? "Avalanche saves you <strong>" + money(saved, true) + "</strong> in interest" + (sn.months > av.months ? " and finishes " + (sn.months - av.months) + " month(s) sooner." : ".") + (sn.order[0].name !== av.order[0].name ? " Snowball clears <strong>" + esc(sn.order[0].name) + "</strong> first, in month " + sn.order[0].month + "." : "") : "Both methods cost about the same here, so choose the order that keeps you motivated.") + '</div>';
      if (av.ok || sn.ok) {
        html += '<h3>Month by month</h3><div class="seg" role="radiogroup" aria-label="Show table for"><label><input type="radio" name="tm" value="avalanche" checked /><span>Avalanche</span></label><label><input type="radio" name="tm" value="snowball" /><span>Snowball</span></label></div><div id="tbl"></div>';
      }
      out.innerHTML = html;
      var tbl = document.getElementById("tbl");
      if (tbl) {
        var show = function (m) { tbl.innerHTML = table(m === "snowball" ? sn : av, start) || '<p class="muted">This method doesn\'t pay the debts off at these payments.</p>'; };
        out.querySelectorAll('input[name="tm"]').forEach(function (i) { i.onchange = function () { show(i.value); }; });
        show("avalanche");
      }
      if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    calc(false);
"""

# ---------------------------------------------------------------- wedding
WED_FAQ = [
  ("What percentage of a wedding budget goes to the venue and catering?", "Venue and food together usually take the biggest share, often around 40–50% of the total. That's why guest count matters so much: catering is charged per person, so every extra guest adds to it."),
  ("Are these real prices?", "No. The splits are rough guidelines based on common planning advice, not quotes from vendors. Prices vary a lot by city, season and day of the week, so use this as a starting plan and replace each line with real quotes as they come in."),
  ("How much buffer should I keep?", "Most planners suggest 5–10% for surprises like overtime, extra rentals, tips and last-minute fixes. The calculator includes a buffer line so it isn't spent on day one."),
  ("When are wedding deposits due?", "Venues and photographers are usually booked first, often around a year out, with a deposit of roughly 25–50%. Caterers, music and attire follow, and most final balances are due about 2–4 weeks before the date. Always check each contract, because terms vary."),
]
WED_COPY = """
    <section class="copy">
    <h2>How to split a wedding budget</h2>
    <p>Start with the one number you're sure about: the total you can spend without borrowing. Everything else is a share of that total. This calculator splits it into the usual categories, using typical percentages that planners and budget guides use as a starting point.</p>
    <ul>
      <li><strong>Venue and catering</strong> usually take the biggest share. Catering is charged per guest, so the calculator shows your food budget per person. If it looks tight, the fastest fixes are a smaller guest list, a brunch or lunch reception, or an off-peak date.</li>
      <li><strong>Photography</strong> is the line people most often wish they'd spent more on, since it's what you keep.</li>
      <li><strong>Attire, flowers, music and stationery</strong> are flexible. Small changes here (rented suits, in-season flowers, a playlist for cocktail hour) add up.</li>
      <li><strong>A buffer</strong> of 5–10% covers overtime, tips, delivery fees and the things you forgot.</li>
    </ul>
    <h3>Simple, classic or formal</h3>
    <p>The style toggle changes the splits. <em>Simple</em> puts more into food and keeps a bigger buffer, with no videographer. <em>Classic</em> is a middle-of-the-road split. <em>Formal</em> moves money toward the venue, flowers, music and a planner. None of these is right or wrong: they're a sketch you then adjust.</p>
    <h3>The payment timeline</h3>
    <p>Most of the money doesn't leave your account on one day. The timeline estimates when the usual deposits fall based on your date: the venue and photographer first, caterer and music next, then attire, flowers and invitations, with final balances a couple of weeks before. If a date has already passed, it shows today, meaning that booking is due now. It's a preview of typical terms, so check every contract.</p>
    <p>Once you start getting quotes, a spreadsheet beats a calculator: you can track planned vs actual vs paid, see payments coming due and keep the guest list in the same place. The template below does exactly that.</p>
    </section>
"""
WED_BODY = """
  <header class="wrap hero">
    <p class="crumb"><a href="/tools/">Free tools</a> › Wedding budget calculator</p>
    <h1>Wedding Budget Calculator: Breakdown by Category</h1>
    <p class="lede">Enter your total budget and guest count. Get a rough category breakdown, your cost per guest and a preview of when deposits are usually due. Free, no sign-up.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <div class="fields" style="margin-top:0">
        <div><label for="total">Total budget ($)</label><input id="total" inputmode="decimal" value="30000" /></div>
        <div><label for="guests">Number of guests</label><input id="guests" inputmode="numeric" value="120" /></div>
        <div><label for="date">Wedding date</label><input id="date" type="date" /></div>
      </div>
      <div style="margin-top:1rem"><label id="stl">Style</label>
        <div class="seg" role="radiogroup" aria-labelledby="stl">
          <label><input type="radio" name="style" value="simple" /><span>Simple</span></label>
          <label><input type="radio" name="style" value="classic" checked /><span>Classic</span></label>
          <label><input type="radio" name="style" value="formal" /><span>Formal</span></label>
        </div></div>
      <div class="errors" id="err" role="alert"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Calculate</button></div>
    </form>
    <section class="results" id="out" aria-live="polite"></section>
__CTA__
__COPY__
__RELATED__
__FAQ__
  </main>
"""
WED_JS = r"""
    var err = document.getElementById("err"), out = document.getElementById("out"), dateIn = document.getElementById("date");
    var t = new Date(); dateIn.value = isoDate(DL.addMonths(new Date(t.getFullYear(), t.getMonth(), t.getDate()), 12));
    function calc(user) {
      var total = num(document.getElementById("total").value), guests = num(document.getElementById("guests").value), date = parseDate(dateIn.value);
      var style = (document.querySelector('input[name="style"]:checked') || {}).value || "classic", errs = [];
      var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (!(total >= 1000 && total <= 10000000)) errs.push("Enter a total budget between $1,000 and $10,000,000.");
      if (!(guests >= 1 && guests <= 2000 && Math.floor(guests) === guests)) errs.push("Enter a whole number of guests between 1 and 2,000.");
      if (isNaN(date)) errs.push("Pick your wedding date (an estimate is fine).");
      else if (date <= today) errs.push("The wedding date needs to be in the future.");
      document.getElementById("total").setAttribute("aria-invalid", !(total >= 1000 && total <= 10000000));
      document.getElementById("guests").setAttribute("aria-invalid", !(guests >= 1 && guests <= 2000));
      showErrors(err, errs); if (errs.length) { out.innerHTML = ""; return; }
      track("wedding_budget", user);
      var w = DL.wedding(total, guests, style, date, today), max = Math.max.apply(null, w.lines.map(function (l) { return l.pct; }));
      var html = '<h2>Your rough breakdown</h2><div class="stats">' +
        '<div class="stat"><div class="k">Cost per guest</div><div class="v">' + money(w.perGuest) + '</div><div class="s">total budget ÷ ' + guests + ' guests</div></div>' +
        '<div class="stat"><div class="k">Food & drink per guest</div><div class="v">' + money(w.cateringPerGuest) + '</div><div class="s">catering line ÷ guests</div></div>' +
        '<div class="stat"><div class="k">Time to plan</div><div class="v">' + DL.monthsUntil(date, today) + ' months</div><div class="s">until ' + dateLabel(date) + '</div></div></div>';
      if (w.cateringPerGuest < 30) html += '<div class="warn">' + money(w.cateringPerGuest) + ' per guest for food is tight in most areas. A smaller guest list, a brunch or lunch reception, or a buffet will stretch it further.</div>';
      html += '<div class="tablewrap" style="max-height:none"><table><thead><tr><th>Category</th><th>Typical share</th><th>Amount</th></tr></thead><tbody>' +
        w.lines.map(function (l) { return "<tr><td>" + esc(l.label) + "</td><td><span class='bar' style='width:" + Math.round(l.pct / max * 60) + "px'></span>" + l.pct + "%</td><td>" + money(l.amount) + "</td></tr>"; }).join("") +
        '</tbody><tfoot><tr><td>Total</td><td>100%</td><td>' + money(w.lines.reduce(function (s, l) { return s + l.amount; }, 0)) + '</td></tr></tfoot></table></div>' +
        '<p class="muted" style="margin-top:.5rem">These are rough guideline splits for a ' + style + ' wedding, not vendor quotes. Rounded to the nearest dollar.</p>' +
        '<h3>Deposits & payment timeline (preview)</h3><div class="tablewrap" style="max-height:none"><table><thead><tr><th>What</th><th>Usually due</th><th>About</th></tr></thead><tbody>' +
        w.schedule.map(function (x) { return "<tr><td class='note' style='color:inherit'>" + esc(x.label) + "</td><td>" + (x.due.getTime() === today.getTime() ? "Now" : monthLabel(x.due)) + "</td><td>" + money(x.amount) + "</td></tr>"; }).join("") +
        '</tbody></table></div><p class="muted" style="margin-top:.5rem">Typical deposit sizes and timing; your contracts set the real terms. The buffer isn\'t scheduled, since it\'s for surprises.</p>';
      out.innerHTML = html;
      if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    document.querySelectorAll('input[name="style"]').forEach(function (i) { i.onchange = function () { calc(true); }; });
    calc(false);
"""

# ---------------------------------------------------------------- sinking funds
SF_FAQ = [
  ("What is a sinking fund?", "It's money you set aside a little at a time for a cost you know is coming: Christmas, car insurance paid yearly, a vacation, new tires. Instead of one big hit, you save a smaller amount every month or paycheck."),
  ("How do I calculate how much to save each month?", "Take what you still need (goal minus what you've already saved) and divide it by the number of months until it's due. This calculator does that for every goal and rounds up to the cent so you don't fall short."),
  ("How is the per-paycheck amount worked out?", "It counts the paychecks you'll get before each due date (weekly, every two weeks, twice a month or monthly) and divides what you still need by that number. Because some months have three weekly or biweekly paychecks, the per-paycheck amount can be a little less than the monthly amount divided evenly."),
  ("Do I need a separate bank account for each fund?", "No. Most people keep all their sinking funds in one high-yield savings account and track how much belongs to each goal in a list or spreadsheet."),
]
SF_COPY = """
    <section class="copy">
    <h2>How sinking funds work</h2>
    <p>Most budget-breaking expenses aren't emergencies. They're things you knew were coming but didn't save for: holiday gifts, the yearly car registration, a wedding you're invited to, back-to-school shopping. A sinking fund turns each of those into a small, regular amount.</p>
    <p>The formula is simple: <strong>(goal − already saved) ÷ months left</strong>. If Christmas is $800, you've saved $240 and it's six months away, that's $93.34 a month. The calculator does it for every goal at once and adds them up, so you see the one number to move into savings each month.</p>
    <h3>Monthly or per paycheck?</h3>
    <p>If you're paid weekly or every two weeks, it's easier to save per paycheck. Pick your pay schedule and the calculator counts the actual paychecks before each due date. You'll see the amount to move from every check, plus what that adds up to in an average month.</p>
    <h3>Common sinking funds people forget</h3>
    <ul>
      <li>Car: registration, inspection, repairs, tires, insurance paid yearly</li>
      <li>Holidays, birthdays and back-to-school</li>
      <li>Vet bills, medical deductibles, glasses and dental</li>
      <li>Annual subscriptions and memberships, home repairs, clothing</li>
      <li>Travel, weddings and other people's celebrations</li>
    </ul>
    <h3>Tips that make it stick</h3>
    <p>Start with your three biggest goals; you can add the rest later. Automate the transfer for payday so it happens before you can spend it. When you take money out, recalculate, because the formula corrects itself. And if the total looks too big, push a due date back or lower a target instead of giving up on the whole plan.</p>
    <p>A calculator gives you the numbers once. To track balances and progress month after month, the spreadsheets below keep it going in Google Sheets.</p>
    </section>
"""
SF_BODY = """
  <header class="wrap hero">
    <p class="crumb"><a href="/tools/">Free tools</a> › Sinking funds calculator</p>
    <h1>Sinking Funds Calculator: How Much to Save Each Month</h1>
    <p class="lede">List what you're saving for, how much it costs and when it's due. See exactly how much to set aside each month and from each paycheck. Free, no sign-up.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <h2 style="margin-top:0">Your goals</h2>
      <p class="muted">Example goals are filled in. Replace them with yours.</p>
      <div class="rows" id="rows"></div>
      <div class="actions"><button class="btn btn-ghost" type="button" id="add">+ Add a goal</button></div>
      <div style="margin-top:1rem"><label id="pl">I get paid</label>
        <div class="seg" role="radiogroup" aria-labelledby="pl">
          <label><input type="radio" name="freq" value="weekly" /><span>Weekly</span></label>
          <label><input type="radio" name="freq" value="biweekly" checked /><span>Every 2 weeks</span></label>
          <label><input type="radio" name="freq" value="semimonthly" /><span>Twice a month</span></label>
          <label><input type="radio" name="freq" value="monthly" /><span>Monthly</span></label>
        </div></div>
      <div class="errors" id="err" role="alert"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Calculate</button></div>
    </form>
    <section class="results" id="out" aria-live="polite"></section>
__CTA__
__COPY__
__RELATED__
__FAQ__
  </main>
"""
SF_JS = r"""
    var rows = document.getElementById("rows"), err = document.getElementById("err"), out = document.getElementById("out");
    var FREQ = { weekly: "weekly", biweekly: "every 2 weeks", semimonthly: "twice a month", monthly: "monthly" };
    function nextDec(dd) { var t = new Date(), y = t.getMonth() === 11 && t.getDate() >= dd ? t.getFullYear() + 1 : t.getFullYear(); return isoDate(new Date(y, 11, dd)); }
    function inMonths(n) { var t = new Date(); return isoDate(DL.addMonths(new Date(t.getFullYear(), t.getMonth(), t.getDate()), n)); }
    var EX = [["Christmas gifts", 800, 240, nextDec(15)], ["Car insurance (yearly)", 1100, 0, inMonths(8)], ["Summer trip", 2000, 150, inMonths(10)]];
    function addRow(d) {
      d = d || ["", "", "", ""];
      var r = document.createElement("div"); r.className = "row goal";
      r.innerHTML = '<div class="name"><label>Saving for</label><input data-k="name" maxlength="40" placeholder="e.g. Vacation" /></div>' +
        '<div><label>Goal ($)</label><input data-k="target" inputmode="decimal" placeholder="0" /></div>' +
        '<div><label>Already saved ($)</label><input data-k="saved" inputmode="decimal" placeholder="0" /></div>' +
        '<div><label>Due date</label><input data-k="due" type="date" /></div>' +
        '<button class="rm" type="button" aria-label="Remove this goal">×</button>';
      var ins = r.querySelectorAll("input"); ins[0].value = d[0]; ins[1].value = d[1]; ins[2].value = d[2]; ins[3].value = d[3];
      r.querySelector(".rm").onclick = function () { if (rows.children.length > 1) r.remove(); else ins.forEach(function (i) { i.value = ""; }); };
      rows.appendChild(r);
    }
    EX.forEach(addRow);
    document.getElementById("add").onclick = function () { if (rows.children.length < 30) { addRow(); rows.lastChild.querySelector("input").focus(); } };
    function calc(user) {
      var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var goals = Array.prototype.map.call(rows.children, function (r, i) {
        var g = function (k) { return r.querySelector('[data-k="' + k + '"]'); }, sv = g("saved").value.trim();
        return { name: g("name").value.trim() || "Goal " + (i + 1), target: num(g("target").value), saved: sv === "" ? 0 : num(sv), due: parseDate(g("due").value), _r: r,
                 _blank: !g("name").value.trim() && !g("target").value.trim() && !sv && !g("due").value };
      }).filter(function (g) { return !g._blank; });
      var freq = (document.querySelector('input[name="freq"]:checked') || {}).value || "biweekly";
      var errs = DL.validateGoals(goals, today); showErrors(err, errs);
      rows.querySelectorAll("input").forEach(function (i) { i.removeAttribute("aria-invalid"); });
      goals.forEach(function (g) { var q = function (k) { return g._r.querySelector('[data-k="' + k + '"]'); };
        if (!(g.target > 0)) q("target").setAttribute("aria-invalid", "true");
        if (!(g.saved >= 0)) q("saved").setAttribute("aria-invalid", "true");
        if (isNaN(g.due) || g.due <= today) q("due").setAttribute("aria-invalid", "true"); });
      if (errs.length) { out.innerHTML = ""; return; }
      track("sinking_funds", user);
      var s = DL.sinking(goals, freq, today), fl = FREQ[freq];
      var html = '<h2>What to save</h2><div class="stats">' +
        '<div class="stat win"><div class="k">Save each month</div><div class="v">' + money(s.totalMonthly, true) + '</div><div class="s">all ' + s.goals.length + ' goals together</div></div>' +
        (freq === "monthly" ? "" : '<div class="stat"><div class="k">Save each paycheck (' + fl + ')</div><div class="v">' + money(s.totalPerPaycheck, true) + '</div><div class="s">about ' + money(s.perPaycheckAsMonthly, true) + ' in an average month</div></div>') +
        '</div><div class="tablewrap" style="max-height:none"><table><thead><tr><th>Goal</th><th>Still need</th><th>Due</th><th>Months</th><th>Per month</th>' + (freq === "monthly" ? "" : '<th>Paychecks</th><th>Per paycheck</th>') + '</tr></thead><tbody>' +
        s.goals.map(function (g, i) { return "<tr><td>" + esc(g.name) + (g.funded ? " <span class='muted'>(funded)</span>" : "") + "</td><td>" + money(g.need, true) + "</td><td>" + dateLabel(goals[i].due) + "</td><td>" + g.months + "</td><td>" + money(g.monthly, true) + "</td>" + (freq === "monthly" ? "" : "<td>" + g.paychecks + "</td><td>" + money(g.perPaycheck, true) + "</td>") + "</tr>"; }).join("") +
        '</tbody><tfoot><tr><td>Total</td><td>' + money(s.goals.reduce(function (a, g) { return a + g.need; }, 0), true) + '</td><td></td><td></td><td>' + money(s.totalMonthly, true) + '</td>' + (freq === "monthly" ? "" : '<td></td><td>' + money(s.totalPerPaycheck, true) + '</td>') + '</tr></tfoot></table></div>' +
        '<p class="muted" style="margin-top:.5rem">Months and paychecks are counted from today up to each due date, and amounts are rounded up to the cent so you don\'t fall short. Goals due sooner need more per month, which is why the total can drop once they\'re paid.</p>';
      out.innerHTML = html;
      if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    document.querySelectorAll('input[name="freq"]').forEach(function (i) { i.onchange = function () { calc(true); }; });
    calc(false);
"""

# ---------------------------------------------------------------- groceries
USDA_URL = "https://www.fns.usda.gov/cnpp/usda-food-plans-cost-food-monthly-reports"
GRO_FAQ = [
  ("How much should I spend on groceries a month?", "A fair benchmark is the USDA's food plans, which price a healthy diet made at home. For September 2026, the Thrifty plan for a woman aged 20–50 is about $254 a month and the Moderate-cost plan about $336, before the household-size adjustment. A single person adds 20% because buying for one costs more per serving. Enter your household above to get your own numbers."),
  ("How much should one person spend on groceries per week?", "Using the USDA's September 2026 numbers with the 20% single-person adjustment, a man aged 20–50 cooking every meal at home lands around $88 a week on the Thrifty plan and about $110 on the Moderate-cost plan. A woman of the same age lands around $70 and $93. Eating some meals out lowers your grocery number."),
  ("What's the difference between the Thrifty, Low-cost, Moderate-cost and Liberal plans?", "They're four USDA shopping lists that each meet nutrition guidelines at a different price. Thrifty is the cheapest. It's the one used to set SNAP benefits, and it takes a lot of cooking from scratch. Low-cost and Moderate-cost leave more room for convenience foods and brand names. Liberal is the most generous. None of them includes eating out."),
  ("Why is my real grocery bill higher or lower than this?", "These are U.S. averages. Prices are higher in big cities, Alaska and Hawaii, and lower in some regions. The USDA lists also cover food only, so they leave out paper towels, cleaning supplies, toiletries, pet food and alcohol, which many people buy on the same receipt. If you count those separately, the comparison is a lot fairer."),
  ("How does 'meals made at home' change the numbers?", "The USDA plans assume all 21 meals a week, plus snacks, come from your kitchen. If you eat 5 lunches at work or out, set this to 16 and the calculator scales the grocery estimate to 16/21 of the full amount. It's a straight-line estimate. Snacks and breakfasts tend to be cheaper than dinners, so treat it as a rough guide."),
]
GRO_COPY = f"""
    <section class="copy">
    <h2>Where these grocery numbers come from</h2>
    <p>Every month the U.S. Department of Agriculture publishes what it costs to eat a healthy diet at home at four price levels, called the <a href="{USDA_URL}" rel="noopener">USDA Food Plans</a>. The costs are broken out by age and sex, because a 16-year-old boy eats a lot more than a 4-year-old. This calculator uses the <strong>September 2026</strong> report. It adds up the cost for each person in your household, then applies USDA's own adjustment for household size: +20% for one person, +10% for two, +5% for three, none for four, −5% for five or six, and −10% for seven or more. Buying for one costs more per serving, and buying for a crowd costs less.</p>
    <p>The numbers are U.S. averages for food you cook yourself. They don't include eating out, household supplies or alcohol, and they don't account for where you live. Use them as a benchmark, not a rule.</p>
    <p><strong>A quick example:</strong> a couple, both aged 20–50, cooking every meal at home. USDA's Moderate-cost plan comes to $398.40 + $336.40 = $734.80 a month. Add 10% for a two-person household and you get about <strong>$808 a month, or $186 a week</strong>. The Thrifty plan for the same couple is about $630 a month. If they eat five dinners out a week, the grocery number drops to roughly 16/21 of that, but the restaurant bill moves to another line of the budget.</p>
    <h3>How to pick a grocery budget</h3>
    <ol>
      <li><strong>Find your baseline.</strong> Add up the last two or three months of grocery receipts or card transactions and divide by the number of weeks. That's your real number.</li>
      <li><strong>Compare it to the plans.</strong> If you're above the Liberal plan, there's usually easy money to find. If you're between Low-cost and Moderate-cost, you're in the range a lot of families aim for.</li>
      <li><strong>Set a target a step below where you are,</strong> not three steps. Going from $1,500 to $1,350 a month is very doable. Going to $900 overnight usually lasts about two weeks.</li>
      <li><strong>Split it by week.</strong> Most people shop weekly, so a weekly number is easier to stick to than a monthly one. The calculator shows both. Monthly = weekly × 4.333, the same way USDA does it.</li>
    </ol>
    <h3>What actually lowers the bill</h3>
    <ul>
      <li><strong>Plan dinners before you shop.</strong> Most overspending is the unplanned trip and the food that goes bad. Planning 4–5 dinners and shopping from a list does more than clipping coupons.</li>
      <li><strong>Cook once, eat twice.</strong> Doubling a recipe for lunches costs little more than the original.</li>
      <li><strong>Shop your pantry first.</strong> Build at least one meal a week around what's already in the cupboard and freezer.</li>
      <li><strong>Watch the add-ons.</strong> Snacks, drinks and the "while I'm here" items are where a $120 list turns into a $170 receipt.</li>
    </ul>
    <p>The meal planner below does the planning part for you: you pick the week's meals and it builds the grocery list, merges repeats and skips what you already have. If you want to see groceries next to the rest of your money, the free Monthly Budget Snapshot is a one-page budget you can start today.</p>
    </section>
"""
GRO_BODY = """
  <header class="wrap hero">
    <p class="crumb"><a href="/tools/">Free tools</a> › Grocery budget calculator</p>
    <h1>Grocery Budget Calculator: How Much Should You Spend on Food?</h1>
    <p class="lede">Add the people in your household and how many meals you make at home. See a realistic weekly and monthly grocery budget at four price levels, based on the USDA's latest food cost numbers. Free, no sign-up.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <h2 style="margin-top:0">Who are you shopping for?</h2>
      <div class="actions" style="margin-top:.3rem"><span class="muted" style="align-self:center">Quick start:</span>
        <button class="btn btn-ghost" type="button" data-preset="m20">Just me</button>
        <button class="btn btn-ghost" type="button" data-preset="m20,f20">Couple</button>
        <button class="btn btn-ghost" type="button" data-preset="m20,f20,c6,c9">Family of 4</button></div>
      <div class="rows" id="rows" style="margin-top:.8rem"></div>
      <div class="actions"><button class="btn btn-ghost" type="button" id="add">+ Add a person</button></div>
      <div class="fields">
        <div><label for="meals">Meals made at home each week (out of 21)</label><input id="meals" inputmode="numeric" value="21" /></div>
        <div><label for="spend">What you spend now or want to spend (optional, $)</label><input id="spend" inputmode="decimal" placeholder="e.g. 250" /></div>
        <div><label id="perl">That amount is per</label>
          <div class="seg" role="radiogroup" aria-labelledby="perl">
            <label><input type="radio" name="per" value="week" checked /><span>Week</span></label>
            <label><input type="radio" name="per" value="month" /><span>Month</span></label>
          </div></div>
      </div>
      <div class="errors" id="err" role="alert"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Calculate</button></div>
    </form>
    <section class="results" id="out" aria-live="polite"></section>
__CTA__
__COPY__
__RELATED__
__FAQ__
  </main>
"""
GRO_JS = r"""
    var rows = document.getElementById("rows"), err = document.getElementById("err"), out = document.getElementById("out");
    var OPTS = DL.FOOD_GROUPS.map(function (g) { return '<option value="' + g[0] + '">' + esc(g[1]) + '</option>'; }).join("");
    function addRow(key) {
      var r = document.createElement("div"); r.className = "row person";
      r.innerHTML = '<div><label>Person ' + (rows.children.length + 1) + ' (age and sex, for USDA\'s table)</label><select data-k="g">' + OPTS + '</select></div>' +
        '<button class="rm" type="button" aria-label="Remove this person">×</button>';
      r.querySelector("select").value = key || "f20";
      r.querySelector(".rm").onclick = function () { if (rows.children.length > 1) { r.remove(); relabel(); } };
      rows.appendChild(r);
    }
    function relabel() { Array.prototype.forEach.call(rows.children, function (r, i) { r.querySelector("label").firstChild.nodeValue = "Person " + (i + 1) + " (age and sex, for USDA's table)"; }); }
    function preset(keys) { rows.innerHTML = ""; keys.forEach(addRow); }
    preset(["m20", "f20", "c6", "c9"]);
    document.getElementById("add").onclick = function () { if (rows.children.length < 20) { addRow(); rows.lastChild.querySelector("select").focus(); } };
    document.querySelectorAll("[data-preset]").forEach(function (b) { b.onclick = function () { preset(b.getAttribute("data-preset").split(",")); calc(true); }; });
    var BAND = ["below USDA's Thrifty plan", "between the Thrifty and Low-cost plans", "between the Low-cost and Moderate-cost plans", "between the Moderate-cost and Liberal plans", "above USDA's Liberal plan"];
    function calc(user) {
      var members = Array.prototype.map.call(rows.querySelectorAll("select"), function (s) { return s.value; });
      var meals = num(document.getElementById("meals").value), sv = document.getElementById("spend").value.trim(), spend = sv === "" ? null : num(sv);
      var per = (document.querySelector('input[name="per"]:checked') || {}).value || "week";
      var errs = DL.validateGroceries(members, meals, spend); showErrors(err, errs);
      document.getElementById("meals").setAttribute("aria-invalid", !(meals >= 1 && meals <= 21 && Math.floor(meals) === meals));
      document.getElementById("spend").setAttribute("aria-invalid", spend !== null && !(spend >= 0 && spend < 100000));
      if (errs.length) { out.innerHTML = ""; return; }
      track("grocery_budget", user);
      var g = DL.groceries(members, meals), n = members.length, adjTxt = g.adjust === 0 ? "no size adjustment (4 people)" : (g.adjust > 0 ? "+" : "") + Math.round(g.adjust * 100) + "% for a " + n + "-person household";
      var html = '<h2>Your grocery budget range</h2><p class="muted">' + n + (n === 1 ? " person" : " people") + ", " + meals + " of 21 meals a week at home, " + adjTxt + ". USDA Food Plans, U.S. average, " + DL.USDA_MONTH + ".</p><div class=\"stats\">" +
        g.plans.map(function (p, k) { return '<div class="stat' + (k === 2 ? " win" : "") + '"><div class="k">' + p.label + (k === 2 ? " · a common target" : "") + '</div><div class="v">' + money(p.weekly, true) + '<span class="muted" style="font-family:inherit;font-size:1rem"> /week</span></div><div class="s">' + money(p.monthly, true) + ' a month · ' + money(p.weekly / n, true) + ' per person a week</div></div>'; }).join("") + '</div>';
      if (spend !== null) {
        var monthly = per === "week" ? spend * DL.WEEKS_PER_MONTH : spend, weekly = per === "week" ? spend : spend / DL.WEEKS_PER_MONTH, band = DL.groceryBand(monthly, g.plans);
        html += '<div class="callout">' + money(weekly, true) + ' a week (' + money(monthly, true) + ' a month) is <strong>' + BAND[band] + '</strong> for your household. That works out to about ' + money(weekly / (n * meals), true) + ' per person per meal at home.' +
          (band === 0 ? " That's tight but possible with lots of cooking from scratch, store brands and cheaper proteins like beans, eggs and chicken thighs, especially if your area has low prices." : band === 4 ? " Planning dinners before you shop and cutting the extra trips usually brings this down quickly." : "") + '</div>';
      }
      html += '<h3>Per person (USDA monthly cost, before the household adjustment)</h3><div class="tablewrap" style="max-height:none"><table><thead><tr><th>Person</th>' + DL.FOOD_PLANS.map(function (p) { return "<th>" + p[1] + "</th>"; }).join("") + '</tr></thead><tbody>' +
        members.map(function (key, i) { var row = DL.FOOD_GROUPS.filter(function (x) { return x[0] === key; })[0]; return "<tr><td>" + (i + 1) + ". " + esc(row[1]) + "</td>" + [3, 5, 7, 9].map(function (c) { return "<td>" + money(row[c], true) + "</td>"; }).join("") + "</tr>"; }).join("") +
        '</tbody><tfoot><tr><td>Your household, adjusted' + (meals < 21 ? " and scaled to " + meals + "/21 meals" : "") + '</td>' + g.plans.map(function (p) { return "<td>" + money(p.monthly, true) + "</td>"; }).join("") + '</tr></tfoot></table></div>' +
        '<p class="muted" style="margin-top:.5rem">Source: <a href="' + "__USDA__" + '" rel="noopener">USDA Food Plans: Monthly Cost of Food Reports</a>, ' + DL.USDA_MONTH + '. Food made at home only. It doesn\'t include eating out, household supplies, alcohol or your local prices. Scaling for meals eaten out is our estimate, not USDA\'s.</p>';
      out.innerHTML = html;
      if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    document.querySelectorAll('input[name="per"]').forEach(function (i) { i.onchange = function () { calc(true); }; });
    calc(false);
""".replace("__USDA__", USDA_URL)

# ---------------------------------------------------------------- moving
MOVE_FAQ = [
  ("How much does it cost to move?", "It depends mostly on distance, how much stuff you have and whether you hire movers. A local DIY move with a rental truck and friends can be a few hundred dollars. A long-distance move with full-service movers can cost thousands. The move itself is often the smaller part, though. Deposits, first month's rent and setting up the new place are what catch people out, so this calculator includes them."),
  ("Are the example amounts real prices?", "No. They're placeholders so you can see how the calculator works, and they're labeled as examples. Replace each one with a real quote. For movers, get at least two or three written estimates. Ask whether the price is binding and what's extra, like stairs, long carries, packing materials and fuel."),
  ("How much buffer should I add to a moving budget?", "10–15% is a good rule. Moves almost always come with something unplanned: an extra truck day, a cleaning fee, a part for the washer, or a week of takeout because the kitchen is still in boxes. The buffer is counted as money you need by move day."),
  ("When will I get my old security deposit back?", "It's set by state law and your lease. Many states give landlords somewhere between 14 and 30 days after you move out, and some allow more. Don't count on it to pay for the move. The calculator shows it as money coming back after the move and leaves it out of what you need to save."),
  ("How is the 'save per week' amount worked out?", "It finds the smallest steady weekly amount, starting now, that has enough cash ready by each cost's date, after counting what you've already set aside. Costs that land early (like a deposit four weeks out) can push it higher than simply dividing the total by the weeks until you move."),
]
MOVE_COPY = """
    <section class="copy">
    <h2>What goes into a moving budget</h2>
    <p>Most people budget for the truck or the movers and forget the rest. The bigger costs often come from the new place, and they land weeks before the move. A realistic moving budget has four parts:</p>
    <ul>
      <li><strong>Getting in:</strong> application fees, security deposit, first month's rent (sometimes last month's too), or closing costs if you're buying. These usually come due when you sign, often 2–6 weeks before you move.</li>
      <li><strong>The move itself:</strong> movers or a truck rental, fuel, mileage, a dolly, moving blankets, boxes and tape, and parking permits in some cities. Movers often take a deposit when you book.</li>
      <li><strong>Getting out:</strong> cleaning, small repairs, junk removal, and any overlap rent if the dates don't line up.</li>
      <li><strong>Setting up:</strong> utility and internet setup fees or deposits, new keys, curtains, a shower rod, groceries to restock the fridge, and the furniture that didn't fit or didn't survive.</li>
    </ul>
    <h3>Why the timeline matters</h3>
    <p>A $5,000 move is hard enough. A $5,000 move where $3,000 is due four weeks out is a different problem. This calculator puts every cost on a date based on your move day, adds a running total, and shows how much cash you need on hand by each point. If something is already due, it shows "now" so it doesn't fall off the plan.</p>
    <p><strong>A quick example:</strong> the sample costs above add up to $5,320, plus a 10% buffer, for $5,852. If the move is six weeks away, about $5,250 of that is due by move day, and $1,700 of it (the deposit and the movers' booking fee) is due in week two. That early chunk is why the weekly amount comes out higher than $5,852 ÷ 6.</p>
    <p>It also works out a steady amount to put aside every week from today. That's usually the easiest way to cover a move without putting it on a credit card. If the weekly number is too high, you have three levers: push the move date back, cut or delay the setup costs (most furniture can wait a month), or get a cheaper quote on the move itself.</p>
    <h3>Ways to keep moving costs down</h3>
    <ol>
      <li>Move mid-month and mid-week if you can. Movers and truck rentals are often cheaper outside weekends and the first and last days of the month.</li>
      <li>Get free boxes from grocery and liquor stores, local buy-nothing groups, or friends who just moved.</li>
      <li>Sell or donate what you don't want to pay to move. Movers often charge by weight or by the hour.</li>
      <li>Photograph your old place when you leave. It's the easiest way to protect your deposit.</li>
      <li>Ask the utility companies whether a deposit can be waived with a letter showing your payment history.</li>
    </ol>
    <p>The Moving Planner below keeps all of this in one Google Sheet: the week-by-week checklist, the budget, a box inventory, and every address and utility you need to change.</p>
    </section>
"""
MOVE_BODY = """
  <header class="wrap hero">
    <p class="crumb"><a href="/tools/">Free tools</a> › Moving cost calculator</p>
    <h1>Moving Cost Calculator: Budget and Timeline for Your Move</h1>
    <p class="lede">List what your move will cost and when each payment hits. Get your total, the cash you need by move day, and how much to set aside each week. Free, no sign-up, no email, and nothing leaves your browser.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <div class="fields" style="margin-top:0">
        <div><label for="date">Move date</label><input id="date" type="date" /></div>
        <div><label for="buffer">Buffer for surprises (%)</label><input id="buffer" inputmode="decimal" value="10" /></div>
        <div><label for="saved">Already set aside ($)</label><input id="saved" inputmode="decimal" value="0" /></div>
        <div><label for="refund">Deposit you'll get back from your old place ($)</label><input id="refund" inputmode="decimal" value="0" /></div>
      </div>
      <h2>Your moving costs</h2>
      <p class="muted"><strong>The amounts filled in are examples, not quotes.</strong> Replace them with your own numbers, set 0 for anything that doesn't apply, and pick when each one is due.</p>
      <div class="rows" id="rows"></div>
      <div class="actions"><button class="btn btn-ghost" type="button" id="add">+ Add a cost</button></div>
      <div class="errors" id="err" role="alert"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Calculate</button></div>
    </form>
    <section class="results" id="out" aria-live="polite"></section>
__CTA__
__COPY__
__RELATED__
__FAQ__
  </main>
"""
MOVE_JS = r"""
    var rows = document.getElementById("rows"), err = document.getElementById("err"), out = document.getElementById("out"), dateIn = document.getElementById("date");
    var WHEN = [[-56, "8 weeks before"], [-42, "6 weeks before"], [-28, "4 weeks before"], [-14, "2 weeks before"], [-7, "1 week before"], [0, "Move day"], [7, "1 week after"], [30, "1 month after"]];
    var WOPTS = WHEN.map(function (w) { return '<option value="' + w[0] + '">' + w[1] + '</option>'; }).join("");
    var EX = [["Security deposit (new place)", 1500, -28], ["First month's rent (new place)", 1500, -7], ["Movers or truck: booking deposit", 200, -28], ["Movers or truck: balance", 900, 0],
              ["Boxes, tape & packing supplies", 120, -14], ["Utility & internet setup", 150, -7], ["Cleaning the old place", 200, 0], ["Gas, food & travel on move day", 150, 0],
              ["Takeout & restocking the first week", 200, 7], ["Furniture & things for the new place", 400, 30]];
    var t0 = new Date(); dateIn.value = isoDate(DL.addDays(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()), 42));
    function addRow(d) {
      d = d || ["", "", 0];
      var r = document.createElement("div"); r.className = "row cost";
      r.innerHTML = '<div class="name"><label>Cost</label><input data-k="name" maxlength="50" placeholder="e.g. Truck rental" /></div>' +
        '<div><label>Amount ($)</label><input data-k="amount" inputmode="decimal" placeholder="0" /></div>' +
        '<div><label>When it\'s due</label><select data-k="when">' + WOPTS + '</select></div>' +
        '<button class="rm" type="button" aria-label="Remove this cost">×</button>';
      var ins = r.querySelectorAll("input"); ins[0].value = d[0]; ins[1].value = d[1]; r.querySelector("select").value = String(d[2]);
      r.querySelector(".rm").onclick = function () { if (rows.children.length > 1) r.remove(); else { ins[0].value = ""; ins[1].value = ""; } };
      rows.appendChild(r);
    }
    EX.forEach(addRow);
    document.getElementById("add").onclick = function () { if (rows.children.length < 40) { addRow(); rows.lastChild.querySelector("input").focus(); } };
    function whenLabel(o) { for (var i = 0; i < WHEN.length; i++) if (WHEN[i][0] === o) return WHEN[i][1]; return ""; }
    function calc(user) {
      var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var items = Array.prototype.map.call(rows.children, function (r, i) {
        var g = function (k) { return r.querySelector('[data-k="' + k + '"]'); }, a = g("amount").value.trim();
        return { name: g("name").value.trim() || "Cost " + (i + 1), amount: a === "" ? 0 : num(a), offset: +g("when").value, _r: r, _blank: !g("name").value.trim() && !a };
      }).filter(function (x) { return !x._blank; });
      var opts = { bufferPct: num(document.getElementById("buffer").value || 0), saved: num(document.getElementById("saved").value || 0), refund: num(document.getElementById("refund").value || 0), refundDays: 21 };
      var mv = parseDate(dateIn.value), errs = DL.validateMoving(items, mv, today, opts); showErrors(err, errs);
      rows.querySelectorAll("input").forEach(function (i) { i.removeAttribute("aria-invalid"); });
      items.forEach(function (x) { if (!(x.amount >= 0)) x._r.querySelector('[data-k="amount"]').setAttribute("aria-invalid", "true"); });
      ["buffer", "saved", "refund"].forEach(function (k) { document.getElementById(k).setAttribute("aria-invalid", !(opts[k === "buffer" ? "bufferPct" : k] >= 0)); });
      if (errs.length) { out.innerHTML = ""; return; }
      track("moving_cost", user);
      var m = DL.moving(items, mv, today, opts), weeks = m.weeksToMove;
      var html = '<h2>Your moving budget</h2><div class="stats">' +
        '<div class="stat"><div class="k">Total cost</div><div class="v">' + money(m.total) + '</div><div class="s">' + money(m.subtotal) + ' in costs + ' + money(m.buffer) + ' buffer</div></div>' +
        '<div class="stat"><div class="k">Cash needed by move day</div><div class="v">' + money(m.byMoveDay) + '</div><div class="s">' + money(m.afterMove) + ' more in the month after</div></div>' +
        '<div class="stat win"><div class="k">Set aside each week</div><div class="v">' + (m.weekly > 0 ? money(m.weekly, true) : "$0") + '</div><div class="s">' + (m.weekly > 0 ? "starting now, so each cost is covered when it's due" : "what you've set aside already covers it") + '</div></div>' +
        (m.refund ? '<div class="stat"><div class="k">After your old deposit comes back</div><div class="v">' + money(m.net) + '</div><div class="s">' + money(m.refund) + ' expected around ' + dateLabel(m.refundDate) + ' (depends on your state and lease)</div></div>' : "") + '</div>';
      if (m.shortNow > 0) html += '<div class="warn">' + money(m.shortNow, true) + ' is due within the next week, more than you\'ve set aside. That part has to come from your current balance or a later move date. The weekly amount covers everything after it.</div>';
      if (m.schedule.some(function (x) { return x.clamped; })) html += '<div class="warn">Some costs would normally be due before today, so they\'re shown as due <strong>now</strong>.</div>';
      if (weeks < 3) html += '<div class="warn">Your move is less than 3 weeks away, so there isn\'t much time to save. Look at which setup costs can wait until after the move.</div>';
      html += '<h3>When the money goes out</h3><div class="tablewrap" style="max-height:none"><table><thead><tr><th>Date</th><th style="text-align:left">What</th><th>Amount</th><th>Running total</th></tr></thead><tbody>' +
        m.schedule.map(function (x) { return "<tr><td>" + (x.clamped || x.due.getTime() === today.getTime() ? "Now" : dateLabel(x.due)) + "</td><td class='note' style='color:inherit'>" + esc(x.name) + (x.buffer ? "" : " <span class='muted'>(" + whenLabel(x.offset) + ")</span>") + "</td><td>" + money(x.amount) + "</td><td>" + money(x.cumulative) + "</td></tr>"; }).join("") +
        (m.refund ? "<tr><td>" + dateLabel(m.refundDate) + "</td><td class='note' style='color:inherit'>Old security deposit back (estimate)</td><td>+" + money(m.refund) + "</td><td>" + money(m.net) + "</td></tr>" : "") +
        '</tbody></table></div><p class="muted" style="margin-top:.5rem">Dates are counted from your move day. The buffer counts as money you need by move day. The returned deposit isn\'t counted toward what you need to save.</p>';
      out.innerHTML = html;
      if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    calc(false);
"""

# ---------------------------------------------------------------- budget by paycheck
PAY_FAQ = [
  ("What does budgeting by paycheck mean?", "Instead of one monthly budget, you plan each paycheck on its own: which bills it pays, what goes to savings, and what's left to spend until the next payday. It's the easiest way to stop the 'rent week' crunch, when one check has to cover almost everything."),
  ("Which paycheck should pay which bill?", "The usual rule, and the one this calculator uses, is that each bill is paid from the last paycheck that arrives on or before its due date. A bill due on the 1st is paid from the check you get at the end of the month before. If you want a cushion, set 'pay bills early' to 2 or 3 days."),
  ("What if one paycheck can't cover its bills?", "The calculator flags it and suggests moving one or more bills to an earlier paycheck that has room left. Paying early is always allowed, so that's often enough to balance it. If it isn't, many companies will change a due date if you call and ask, which is often the easiest permanent fix."),
  ("What about months with three paychecks?", "If you're paid every week or every two weeks, a few months a year have an extra paycheck. Set the plan to 2 or 3 months to see them. Because your monthly bills are already covered, an extra check is a great time to build savings or pay down debt."),
  ("Does it handle paydays that fall on a weekend?", "It uses the dates you enter. Many employers pay on the Friday before a weekend or holiday payday. If yours does, use that date. Paying a bill a day or two early never hurts."),
]
PAY_COPY = """
    <section class="copy">
    <h2>How to budget by paycheck</h2>
    <p>A monthly budget says you earn $3,200 and spend $2,900, so you're fine. Then rent, the car payment and insurance all land in the first week, and you're not fine. Budgeting by paycheck fixes that by planning money in the order it actually arrives.</p>
    <ol>
      <li><strong>List your paydays</strong> for the next month, using your take-home pay, not your salary.</li>
      <li><strong>List your bills with their due dates.</strong> Your bank or card app shows them. Put things you spend every pay period, like groceries, gas and savings, on <em>every paycheck</em>.</li>
      <li><strong>Assign each bill to the last paycheck before it's due.</strong> That's what the calculator does. Rent due on the 1st comes out of the check from the end of the previous month.</li>
      <li><strong>Look at what's left on each check.</strong> That's your spending money until the next payday. If one check goes negative, move a bill to an earlier check or ask the company to change the due date.</li>
    </ol>
    <h3>Reading your results</h3>
    <p>Each card is one paycheck: the date, which bills it pays and their due dates, and what's left over. A red card means that check can't cover its bills. When that happens, the calculator looks for bills it can pay <strong>earlier</strong> from a check that has room. It never moves a bill later, so nothing will be late. You'll see the suggested changes and a balanced version of the plan.</p>
    <p>If you're paid every week or every two weeks, switch the plan to 2 or 3 months. You'll see why some checks feel bigger than others, and you'll spot the months with an extra paycheck coming.</p>
    <h3>What to do with what's left</h3>
    <p>The "left" number on each card isn't extra money. It's what you have for everything that isn't a bill: eating out, gifts, the kids' school things, the random Target run. If one check leaves $600 and the next leaves $90, plan your bigger spending around the $600 week, and keep the $90 week quiet. When every check has a positive number, you can start pointing some of it at a <a href="/tools/sinking-funds-calculator/">sinking fund</a> or <a href="/tools/debt-payoff-calculator/">extra debt payments</a>.</p>
    <h3>Tips that make it work</h3>
    <ul>
      <li><strong>Leave a small cushion</strong> on every check, even $50, for the bill you forgot or the price that went up.</li>
      <li><strong>Pay savings first.</strong> Put it on every paycheck as a bill, so it isn't whatever's left at the end.</li>
      <li><strong>Move due dates once.</strong> One phone call to the car lender or the phone company can permanently balance your checks.</li>
      <li><strong>Use a separate bills account</strong> if you can. Move each check's bill total there on payday, and what stays in checking is yours to spend.</li>
    </ul>
    <p>Want this to run every month without re-entering anything? The Budget by Paycheck spreadsheet below does the same assignment in Google Sheets. It tracks what's paid and carries leftover money forward, so each check has a plan before it lands.</p>
    </section>
"""
PAY_BODY = """
  <header class="wrap hero">
    <p class="crumb"><a href="/tools/">Free tools</a> › Budget by paycheck calculator</p>
    <h1>Budget by Paycheck Calculator: Which Paycheck Pays Which Bill</h1>
    <p class="lede">Enter your paydays and your bills with their due dates. See which paycheck covers each bill, what's left from every check, and how to fix a paycheck that comes up short. Free, no sign-up.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <div class="fields" style="margin-top:0">
        <div><label for="amount">Take-home pay per paycheck ($)</label><input id="amount" inputmode="decimal" value="1750" /></div>
        <div id="firstBox"><label for="first">Next payday</label><input id="first" type="date" /></div>
        <div id="semiBox" hidden><label for="d1">Paydays each month (day numbers)</label><div style="display:flex;gap:.5rem"><input id="d1" inputmode="numeric" value="1" aria-label="First payday of the month" /><input id="d2" inputmode="numeric" value="15" aria-label="Second payday of the month" /></div></div>
        <div><label for="lead">Pay bills this many days early</label><input id="lead" inputmode="numeric" value="0" /></div>
      </div>
      <div class="fields">
        <div><label id="fl">I get paid</label>
          <div class="seg" role="radiogroup" aria-labelledby="fl">
            <label><input type="radio" name="freq" value="weekly" /><span>Weekly</span></label>
            <label><input type="radio" name="freq" value="biweekly" checked /><span>Every 2 weeks</span></label>
            <label><input type="radio" name="freq" value="semimonthly" /><span>Twice a month</span></label>
            <label><input type="radio" name="freq" value="monthly" /><span>Monthly</span></label>
          </div></div>
        <div><label id="ml">Plan for</label>
          <div class="seg" role="radiogroup" aria-labelledby="ml">
            <label><input type="radio" name="months" value="1" checked /><span>1 month</span></label>
            <label><input type="radio" name="months" value="2" /><span>2 months</span></label>
            <label><input type="radio" name="months" value="3" /><span>3 months</span></label>
          </div></div>
      </div>
      <h2>Your bills</h2>
      <p class="muted">Example bills are filled in. Replace them with yours. Use <em>Every paycheck</em> for things like groceries, gas and savings.</p>
      <div class="rows" id="rows"></div>
      <div class="actions"><button class="btn btn-ghost" type="button" id="add">+ Add a bill</button></div>
      <div class="errors" id="err" role="alert"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Calculate</button></div>
    </form>
    <section class="results" id="out" aria-live="polite"></section>
__CTA__
__COPY__
__RELATED__
__FAQ__
  </main>
"""
PAY_JS = r"""
    var rows = document.getElementById("rows"), err = document.getElementById("err"), out = document.getElementById("out"), firstIn = document.getElementById("first");
    function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
    var DOPTS = '<option value="check">Every paycheck</option>' + Array.apply(null, Array(31)).map(function (_, i) { return '<option value="' + (i + 1) + '">' + ord(i + 1) + (i === 30 ? " / last day" : "") + '</option>'; }).join("");
    var EX = [["Rent", 1250, 1], ["Phone", 65, 8], ["Car payment", 340, 12], ["Electric", 110, 17], ["Car insurance", 140, 20], ["Internet", 60, 25], ["Groceries", 200, "check"], ["Gas", 60, "check"], ["Savings", 100, "check"]];
    var t0 = new Date(), fri = (5 - t0.getDay() + 7) % 7; firstIn.value = isoDate(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + fri));
    function addRow(d) {
      d = d || ["", "", 1];
      var r = document.createElement("div"); r.className = "row bill";
      r.innerHTML = '<div class="name"><label>Bill</label><input data-k="name" maxlength="40" placeholder="e.g. Rent" /></div>' +
        '<div><label>Amount ($)</label><input data-k="amount" inputmode="decimal" placeholder="0" /></div>' +
        '<div><label>Due (day of month)</label><select data-k="due">' + DOPTS + '</select></div>' +
        '<button class="rm" type="button" aria-label="Remove this bill">×</button>';
      var ins = r.querySelectorAll("input"); ins[0].value = d[0]; ins[1].value = d[1]; r.querySelector("select").value = String(d[2]);
      r.querySelector(".rm").onclick = function () { if (rows.children.length > 1) r.remove(); else { ins[0].value = ""; ins[1].value = ""; } };
      rows.appendChild(r);
    }
    EX.forEach(addRow);
    document.getElementById("add").onclick = function () { if (rows.children.length < 40) { addRow(); rows.lastChild.querySelector("input").focus(); } };
    function freq() { return (document.querySelector('input[name="freq"]:checked') || {}).value || "biweekly"; }
    function syncFreq() { var s = freq() === "semimonthly"; document.getElementById("semiBox").hidden = !s; document.getElementById("firstBox").hidden = s; }
    function cardHtml(c, i) {
      var bad = c.left < -0.005;
      return '<div class="stat' + (bad ? " over" : "") + '"><div class="k">Paycheck ' + (i + 1) + ' · ' + dateLabel(c.date) + '</div><div class="v">' + money(c.left, true) + '<span class="muted" style="font-family:inherit;font-size:1rem"> left</span></div>' +
        '<div class="s">' + money(c.amount, true) + ' in, ' + money(c.total, true) + ' to bills</div><ul class="bl">' +
        (c.bills.length ? c.bills.map(function (b) { return "<li><span>" + esc(b.name) + " <span class='muted'>" + (b.perCheck ? "(every check)" : "(due " + dateLabel(b.due).replace(/, \d{4}$/, "") + ")") + "</span></span><span>" + money(b.amount, true) + "</span></li>"; }).join("") : "<li class='muted'>No bills from this check</li>") + '</ul></div>';
    }
    function calc(user) {
      var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var bills = Array.prototype.map.call(rows.children, function (r, i) {
        var g = function (k) { return r.querySelector('[data-k="' + k + '"]'); }, due = g("due").value;
        return { name: g("name").value.trim() || "Bill " + (i + 1), amount: num(g("amount").value), day: due === "check" ? null : +due, every: due === "check" ? "check" : "month", _r: r, _blank: !g("name").value.trim() && !g("amount").value.trim() };
      }).filter(function (b) { return !b._blank; });
      var p = { freq: freq(), first: parseDate(firstIn.value), days: [num(document.getElementById("d1").value), num(document.getElementById("d2").value)].sort(function (a, b) { return a - b; }),
                amount: num(document.getElementById("amount").value), lead: num(document.getElementById("lead").value || 0), bills: bills, today: today,
                months: +((document.querySelector('input[name="months"]:checked') || {}).value || 1) };
      var errs = DL.validatePaycheck(p); showErrors(err, errs);
      rows.querySelectorAll("input").forEach(function (i) { i.removeAttribute("aria-invalid"); });
      bills.forEach(function (b) { if (!(b.amount > 0)) b._r.querySelector('[data-k="amount"]').setAttribute("aria-invalid", "true"); });
      document.getElementById("amount").setAttribute("aria-invalid", !(p.amount > 0));
      if (errs.length) { out.innerHTML = ""; return; }
      track("budget_by_paycheck", user);
      var r = DL.paycheckPlan(p);
      var last = r.checks[r.checks.length - 1].date, html = '<h2>Your paycheck plan</h2><p class="muted">' + r.checks.length + (r.checks.length === 1 ? ' paycheck (' + dateLabel(r.windowStart) : ' paychecks (' + dateLabel(r.windowStart) + ' – ' + dateLabel(last)) + '), covering bills due ' + dateLabel(DL.addDays(r.windowStart, p.lead)) + ' through ' + dateLabel(DL.addDays(r.windowEnd, p.lead - 1)) + '. Each bill is paid from the last paycheck on or before its due date' + (p.lead ? " minus " + p.lead + " day(s)" : "") + '.</p>' +
        '<div class="stats" style="margin-bottom:.8rem"><div class="stat"><div class="k">Income</div><div class="v">' + money(r.income, true) + '</div></div><div class="stat"><div class="k">Bills & set-asides</div><div class="v">' + money(r.bills, true) + '</div></div>' +
        '<div class="stat' + (r.left >= 0 ? " win" : " over") + '"><div class="k">Left to spend</div><div class="v">' + money(r.left, true) + '</div><div class="s">across all ' + r.checks.length + ' checks</div></div></div>';
      if (r.left < -0.005) html += '<div class="warn">Your bills add up to more than your pay for this period, so moving due dates won\'t be enough. Something has to give: a lower bill, a smaller every-check amount, or more income.</div>';
      else if (r.overloaded && r.moves.length && !r.stillOverloaded) html += '<div class="callout"><strong>Fix:</strong> ' + r.moves.map(function (m) { return "pay <strong>" + esc(m.name) + "</strong> (" + money(m.amount, true) + ", due " + dateLabel(m.due) + ") from the " + dateLabel(m.to) + " paycheck instead of the " + dateLabel(m.from) + " one"; }).join("; ") + '. Paying early is always allowed, and it balances every check. The balanced plan is below.</div>';
      else if (r.overloaded) html += '<div class="warn">' + r.overloaded + ' paycheck(s) can\'t cover their bills' + (r.moves.length ? ", even after paying some bills early" : "") + '. Try calling the company to move a due date to later in the month, or set aside part of an earlier check.</div>';
      else html += '<div class="callout">Every paycheck covers its bills. Nice.</div>';
      var show = r.balanced && !r.stillOverloaded ? r.balanced : r.checks;
      html += '<div class="stats paychecks">' + show.map(cardHtml).join("") + '</div>';
      if (r.balanced && !r.stillOverloaded) html += '<details class="faq" style="margin-top:1rem"><summary>Show the plan before the fix</summary><div class="stats paychecks" style="margin-top:.6rem">' + r.checks.map(cardHtml).join("") + '</div></details>';
      out.innerHTML = html;
      if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    document.querySelectorAll('input[name="freq"]').forEach(function (i) { i.onchange = function () { syncFreq(); calc(true); }; });
    document.querySelectorAll('input[name="months"]').forEach(function (i) { i.onchange = function () { calc(true); }; });
    syncFreq(); calc(false);
"""

TOOLS = [
  ("debt-payoff-calculator", "Debt Payoff Calculator: Snowball vs Avalanche",
   "Debt Payoff Calculator: Snowball vs Avalanche (Free) | Dark Lighthouse Solutions",
   "Free debt payoff calculator. Enter your debts and an extra payment to compare the snowball and avalanche methods: debt-free date, total interest, payoff order and a month-by-month plan.",
   "Compare snowball vs avalanche: debt-free date, total interest, payoff order and a month-by-month table.",
   DEBT_BODY, DEBT_JS, DEBT_COPY, DEBT_FAQ, ["debt-payoff-dashboard", "sheets-bundle-5"],
   ("Keep the plan updated as you pay", "The Debt Payoff Dashboard does this math in Google Sheets and updates as your balances drop. The bundle adds Budget by Paycheck, Sinking Funds and two more.")),
  ("wedding-budget-calculator", "Wedding Budget Calculator: Breakdown by Category",
   "Wedding Budget Calculator: Category Breakdown & Cost per Guest | Dark Lighthouse Solutions",
   "Free wedding budget calculator. Enter your budget and guest count to get a rough breakdown by category, your cost per guest and a preview of when deposits are usually due.",
   "Split your total by category, see cost per guest and preview when deposits are usually due.",
   WED_BODY, WED_JS, WED_COPY, WED_FAQ, ["wedding-planner-budget"],
   ("Plan the real numbers in one sheet", "When the quotes come in, track planned vs actual vs paid, payment due dates, RSVPs and seating in one Google Sheet.")),
  ("sinking-funds-calculator", "Sinking Funds Calculator: How Much to Save Each Month",
   "Sinking Funds Calculator: Monthly & Per-Paycheck Savings | Dark Lighthouse Solutions",
   "Free sinking funds calculator. List your savings goals and due dates to see how much to save each month and per paycheck (weekly, biweekly, twice a month or monthly).",
   "See how much to save each month and per paycheck for every goal, with a total.",
   SF_BODY, SF_JS, SF_COPY, SF_FAQ, ["sinking-funds", "budget-by-paycheck"],
   ("Track your funds month after month", "The Sinking Funds Tracker does this for up to 15 goals and shows progress. Budget by Paycheck fits the savings into each paycheck alongside your bills.")),
  ("grocery-budget-calculator", "Grocery Budget Calculator: How Much Should You Spend on Food?",
   "Grocery Budget Calculator: How Much to Spend on Food a Week or Month | Dark Lighthouse Solutions",
   "Free grocery budget calculator based on the USDA's September 2026 food plan costs. Enter your household and meals at home to see a weekly and monthly grocery budget at four price levels.",
   "Weekly and monthly grocery budget for your household at four USDA price levels, and where your spending sits.",
   GRO_BODY, GRO_JS, GRO_COPY, GRO_FAQ, ["meal-planner-grocery-list", "monthly-budget-snapshot"],
   ("Make the grocery budget easy to hit", "The Meal Planner turns the week's meals into a grocery list sorted by aisle, so you buy what you planned. The Monthly Budget Snapshot is free and puts groceries next to the rest of your money.")),
  ("moving-cost-calculator", "Moving Cost Calculator: Budget and Timeline for Your Move",
   "Moving Cost Calculator: Moving Budget & Payment Timeline (Free, No Email) | Dark Lighthouse Solutions",
   "Free moving cost calculator, no email needed. List your moving costs and when each is due to get your total, the cash you need by move day, and how much to save each week.",
   "Total moving budget, a date-by-date timeline of when each cost hits, and a weekly amount to save.",
   MOVE_BODY, MOVE_JS, MOVE_COPY, MOVE_FAQ, ["moving-planner"],
   ("Run the whole move from one sheet", "The Moving Planner has the week-by-week checklist, this budget, a box inventory and every address and utility to change, in one Google Sheet.")),
  ("budget-by-paycheck-calculator", "Budget by Paycheck Calculator: Which Paycheck Pays Which Bill",
   "Budget by Paycheck Calculator: Which Paycheck Pays Which Bill | Dark Lighthouse Solutions",
   "Free budget by paycheck calculator. Enter your paydays (weekly, biweekly, twice a month or monthly) and bills with due dates to see which paycheck pays each bill and what's left from every check.",
   "See which paycheck pays each bill, what's left from every check, and how to fix a short one.",
   PAY_BODY, PAY_JS, PAY_COPY, PAY_FAQ, ["budget-by-paycheck", "sheets-bundle-5"],
   ("Do this every month without re-typing it", "Budget by Paycheck does the same assignment in Google Sheets, tracks what's paid and carries leftovers forward. The bundle adds Debt Payoff, Sinking Funds and two more.")),
]
RELATED = {
  "debt-payoff-calculator": ["budget-by-paycheck-calculator", "sinking-funds-calculator"],
  "wedding-budget-calculator": ["sinking-funds-calculator", "budget-by-paycheck-calculator"],
  "sinking-funds-calculator": ["budget-by-paycheck-calculator", "debt-payoff-calculator", "moving-cost-calculator"],
  "grocery-budget-calculator": ["budget-by-paycheck-calculator", "sinking-funds-calculator"],
  "moving-cost-calculator": ["sinking-funds-calculator", "budget-by-paycheck-calculator", "grocery-budget-calculator"],
  "budget-by-paycheck-calculator": ["sinking-funds-calculator", "debt-payoff-calculator", "grocery-budget-calculator"],
}
def related_html(slug):
    names = {t[0]: t[1].split(":")[0] for t in TOOLS}
    return ('    <h2 id="related">Related free calculators</h2>\n    <div class="related">' +
            "".join(f'<a href="/tools/{r}/">{e(names[r])}</a>' for r in RELATED[slug]) + '<a href="/tools/">All free tools</a></div>\n')
OG = {"debt-payoff-calculator": "/assets/money/debt-payoff-dashboard/1.jpg", "wedding-budget-calculator": "/assets/money/wedding-planner-budget/1.jpg",
      "sinking-funds-calculator": "/assets/money/sinking-funds/1.jpg", "grocery-budget-calculator": "/assets/money/meal-planner-grocery-list/1.jpg",
      "moving-cost-calculator": "/assets/money/moving-planner/1.jpg", "budget-by-paycheck-calculator": "/assets/money/budget-by-paycheck/1.jpg"}

def build():
    for slug, h1, title, desc, blurb, body, js, copy, faq, prods, (ch, cs) in TOOLS:
        path = f"/tools/{slug}/"
        page = head(path, title, desc, OG[slug], [app_ld(h1.split(":")[0], path, desc), faq_ld(faq), crumbs_ld(path, h1.split(":")[0])])
        page += (body.replace("__CTA__", cta(prods, ch, cs)).replace("__COPY__", copy).replace("__RELATED__", related_html(slug)).replace("__FAQ__", faq_html(faq)))
        page += FOOT + '  <script src="/tools/calc.js"></script>\n  <script>\n  (function () {\n    "use strict";' + COMMON_JS + js + "  })();\n  </script>\n</body>\n</html>\n"
        d = ROOT / "tools" / slug; d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(inject(page), encoding="utf-8")
    # index
    title = "Free Money Calculators: Budget by Paycheck, Debt Payoff, Grocery & Moving | Dark Lighthouse Solutions"
    desc = "Free, private money calculators: budget by paycheck, debt payoff (snowball vs avalanche), grocery budget, moving costs, sinking funds and wedding budget. No sign-up; nothing you type leaves your browser."
    items = {"@context": "https://schema.org", "@type": "ItemList", "name": "Free money calculators", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/tools/{t[0]}/", "name": t[1]} for i, t in enumerate(TOOLS)]}
    page = head("/tools/", title, desc, "/assets/money/sheets-bundle-5/1.jpg", [items])
    cards = "\n".join(f'''      <a class="tool" href="/tools/{t[0]}/"><h2>{e(t[1].split(":")[0])}</h2><p>{e(t[4])}</p><span class="go">Open the calculator →</span></a>''' for t in TOOLS)
    cards += '''\n      <a class="tool" href="/renewal-radar/"><h2>Renewal Radar (browser extension)</h2><p>Tracks your subscriptions and free trials and reminds you before each charge. Free for up to 10 items, and private.</p><span class="go">See the extension →</span></a>'''
    page += f'''
  <header class="wrap hero">
    <h1>Free money calculators</h1>
    <p class="lede">Quick, private calculators for the money questions people search most. No sign-up, no email, and nothing you type leaves your browser.</p>
  </header>
  <main class="wrap">
    <div class="tools">
{cards}
    </div>
    <section class="copy">
    <h2>Want it to keep going?</h2>
    <p>Each calculator gives you a plan once. If you'd like it to update as you go, the <a href="/templates/">money templates</a> do the same math in Google Sheets and track your progress month after month.</p>
    </section>
  </main>
''' + FOOT + "</body>\n</html>\n"
    (ROOT / "tools/index.html").write_text(inject(page), encoding="utf-8")
    print("built tools/ (index + %d calculators)" % len(TOOLS))

if __name__ == "__main__":
    build()
