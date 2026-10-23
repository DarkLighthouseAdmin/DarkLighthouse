#!/usr/bin/env python3
"""Build the free calculator pages under /tools/ (index + 3 calculators). Run from anywhere:
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
      .row.debt, .row.goal { grid-template-columns:1fr 1fr; }
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
    <p><a href="/tools/">Free tools</a> · <a href="/tools/debt-payoff-calculator/">Debt payoff calculator</a> · <a href="/tools/wedding-budget-calculator/">Wedding budget calculator</a> · <a href="/tools/sinking-funds-calculator/">Sinking funds calculator</a> · <a href="/templates/">Money templates</a></p>
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
          <div class="buy-row"><span class="price">${price}</span><a class="btn btn-primary" href="{URLS[s]}">Buy now</a></div>
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
]
OG = {"debt-payoff-calculator": "/assets/money/debt-payoff-dashboard/1.jpg", "wedding-budget-calculator": "/assets/money/wedding-planner-budget/1.jpg",
      "sinking-funds-calculator": "/assets/money/sinking-funds/1.jpg"}

def build():
    for slug, h1, title, desc, blurb, body, js, copy, faq, prods, (ch, cs) in TOOLS:
        path = f"/tools/{slug}/"
        page = head(path, title, desc, OG[slug], [app_ld(h1.split(":")[0], path, desc), faq_ld(faq), crumbs_ld(path, h1.split(":")[0])])
        page += (body.replace("__CTA__", cta(prods, ch, cs)).replace("__COPY__", copy).replace("__FAQ__", faq_html(faq)))
        page += FOOT + '  <script src="/tools/calc.js"></script>\n  <script>\n  (function () {\n    "use strict";' + COMMON_JS + js + "  })();\n  </script>\n</body>\n</html>\n"
        d = ROOT / "tools" / slug; d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(inject(page), encoding="utf-8")
    # index
    title = "Free Money Calculators: Debt Payoff, Wedding Budget & Sinking Funds | Dark Lighthouse Solutions"
    desc = "Free, private calculators for debt payoff (snowball vs avalanche), wedding budgets and sinking funds. No sign-up; nothing you type leaves your browser."
    items = {"@context": "https://schema.org", "@type": "ItemList", "name": "Free money calculators", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/tools/{t[0]}/", "name": t[1]} for i, t in enumerate(TOOLS)]}
    page = head("/tools/", title, desc, "/assets/money/sheets-bundle-5/1.jpg", [items])
    cards = "\n".join(f'''      <a class="tool" href="/tools/{t[0]}/"><h2>{e(t[1].split(":")[0])}</h2><p>{e(t[4])}</p><span class="go">Open the calculator →</span></a>''' for t in TOOLS)
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
