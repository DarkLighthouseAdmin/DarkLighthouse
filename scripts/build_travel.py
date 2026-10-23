#!/usr/bin/env python3
"""Build the /travel/ section: hub, Scotland and Ireland guides, planners, tools index + 2 calculators. Run: python3 scripts/build_travel.py
Math lives in /travel/tools/travel-calc.js (tested by `node scripts/test_travel.js`). Partner links: /travel/affiliates.json.
Reuses the base CSS and helpers from build_tools.py; travel pages get their own header, section nav and accent colours."""
import sys, json, html, re
sys.dont_write_bytecode = True
from pathlib import Path
from add_analytics import inject
from build_tools import CSS as BASE_CSS, COMMON_JS, faq_html, faq_ld, URLS, SITE

ROOT = Path(__file__).resolve().parent.parent
e = html.escape
AFF = json.load(open(ROOT / "travel/affiliates.json"))["links"]

TP = {  # slug: (name, price, short, image dir)
 "trip-planner-travel-budget": ("Trip Planner & Travel Budget", 12, "Budget in any currency, how much to save each paycheck, a day-by-day itinerary, bookings and packing in one Google Sheet."),
 "family-travel-kids-planner": ("Family Travel with Kids Planner", 12, "Passport expiry checker, a gentle jet-lag plan, packing by age, day pacing and an emergency info page."),
 "scotland-trip-planner": ("Scotland Trip Planner", 14, "Pick where you sleep each night; it fills in drive times, flags long days and budgets in pounds. Sample 7, 10 and 14-night routes."),
 "travel-planner-bundle": ("Travel Planner Bundle (all 3)", 24, "Trip Planner, Family Travel with Kids and the Scotland Trip Planner. $38 bought separately."),
 "kids-travel-packing-checklist": ("Kids Travel Packing Checklist", 0, "Free 2-page printable: packing by age plus a plane & car bag page for travel day."),
}

TCSS = """
    :root { --sea:#1d5c6b; --sea-deep:#123f4a; --heather:#7b4f7a; --mist:#eaf2f1; }
    a { color:var(--sea); }
    .gbar { background:var(--navy); color:#e8eef6; font-size:.92rem; }
    .gbar .wrap { display:flex; justify-content:space-between; align-items:center; padding:.55rem 1.25rem; gap:1rem; flex-wrap:wrap; }
    .gbar a { color:#e8eef6; text-decoration:none; } .gbar .brand { font-family:Fraunces,serif; font-size:1.05rem; } .gbar .brand span { color:var(--beacon); }
    .gbar nav a { margin-left:1rem; opacity:.85; } .gbar nav a[aria-current] { opacity:1; border-bottom:2px solid var(--beacon); }
    .tnav { background:var(--sea); } .tnav .wrap { display:flex; gap:.3rem 1.3rem; flex-wrap:wrap; padding:.65rem 1.25rem; align-items:center; }
    .tnav a { color:#fff; text-decoration:none; font-weight:500; } .tnav a[aria-current] { text-decoration:underline; text-underline-offset:5px; text-decoration-color:var(--beacon); text-decoration-thickness:2px; }
    .tnav .sec { font-family:Fraunces,serif; font-size:1.1rem; margin-right:.6rem; }
    body { background:#f6f8f6; } .crumb a { color:var(--sea); }
    .btn-primary { background:var(--sea); } .btn-primary:hover { background:var(--sea-deep); }
    .stat.win { border-color:var(--sea); } .callout { background:var(--mist); border-color:var(--sea); color:var(--sea-deep); }
    .bar { background:var(--sea); } th { background:var(--mist); } .seg input:checked + span { background:var(--sea); border-color:var(--sea); }
    .tool:hover { border-color:var(--sea); } .tool .go { color:var(--sea); }
    .hub { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem; margin-top:1.2rem; }
    .hub a { display:block; background:var(--card); border:1px solid var(--line); border-top:4px solid var(--sea); border-radius:14px; padding:1.1rem; text-decoration:none; color:var(--ink); }
    .hub a:hover { border-top-color:var(--beacon); } .hub h2 { font-size:1.25rem; margin:0 0 .35rem; } .hub p { color:var(--muted); font-size:.95rem; }
    .disclose { font-size:.88rem; color:var(--muted); background:var(--mist); border-radius:10px; padding:.6rem .9rem; margin-top:1rem; max-width:46rem; }
    .est { display:inline-block; font-size:.72rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; background:#fff1d6; color:#7a4d06; border-radius:6px; padding:.05rem .4rem; vertical-align:middle; }
    .free { background:linear-gradient(135deg,var(--sea),var(--heather)); color:#fff; border-radius:16px; padding:1.3rem; margin-top:1.4rem; display:flex; gap:1rem; align-items:center; justify-content:space-between; flex-wrap:wrap; }
    .free h2 { color:#fff; margin:0 0 .3rem; font-size:1.35rem; } .free p { color:#e9f1f2; max-width:36rem; }
    .copy table { margin-top:.6rem; } .copy .tablewrap { max-height:none; }
    .src li { font-size:.9rem; color:var(--muted); }
    .related { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:.6rem; } .related a { background:var(--card); border:1px solid var(--line); border-radius:999px; padding:.4rem .9rem; text-decoration:none; font-weight:500; }
    .pcard ul { margin:.2rem 0 0 1.1rem; font-size:.92rem; color:var(--muted); }
    .packbox { background:var(--card); border:1px solid var(--line); border-left:4px solid var(--heather); border-radius:12px; padding:1rem 1.2rem; margin:1.2rem 0; }
    .packbox h3 { margin-top:0; } .packbox ul { margin-top:.4rem; }
    .prod { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:.9rem 1.1rem; margin:.8rem 0; }
    .prod h3 { margin:0 0 .3rem; font-size:1.1rem; } .prod .facts { font-size:.9rem; color:var(--muted); margin:.1rem 0 .4rem; }
    .hero .disclose { margin:0 0 .8rem; }
"""
# Travelpayouts "Drive" snippet (the owner's Travelpayouts account, id 589522). Emitted on /travel/ pages ONLY, never other sections.
TP_DRIVE = """  <script nowprocket data-noptimize="1" data-cfasync="false" data-wpfc-render="false" seraph-accel-crit="1" data-no-defer="1" data-cmp-ab="2">
    (function () {
        var script = document.createElement("script");
        script.async = 1;
        script.setAttribute("data-cmp-ab","2");
        script.src = 'https://emrldtp.cc/NTg5NTIy.js?t=589522';
        document.head.appendChild(script);
    })();
  </script>
"""
NAV = [("/travel/", "Travel home"), ("/travel/scotland/", "Scotland guide"), ("/travel/ireland/", "Ireland guide"), ("/travel/england/", "England guide"), ("/travel/wales/", "Wales guide"), ("/travel/gear/", "Packing & gear"), ("/travel/gifts/", "Gift guides"), ("/travel/planners/", "Planners"), ("/travel/tools/", "Travel tools")]

def crumbs(trail):
    """trail: [(name, path)], last item is the current page."""
    html_ = '<p class="crumb"><a href="/">Home</a> › ' + " › ".join(
        (f'<a href="{p}">{e(n)}</a>' if i < len(trail) - 1 else e(n)) for i, (n, p) in enumerate(trail)) + "</p>"
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement":
          [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"}] +
          [{"@type": "ListItem", "position": i + 2, "name": n, "item": SITE + p} for i, (n, p) in enumerate(trail)]}
    return html_, ld

def head(path, title, desc, og, ld, section):
    url = SITE + path
    lds = "".join(f'\n  <script type="application/ld+json">\n{json.dumps(x, indent=1, ensure_ascii=False)}\n  </script>' for x in ld)
    tnav = "".join(f'<a href="{p}"{" aria-current=\"page\"" if p == section else ""}>{n}</a>' for p, n in NAV)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
{TP_DRIVE if path.startswith("/travel/") else ""}  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}" />
  <meta name="author" content="Dark Lighthouse Solutions" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="{url}" />
  <meta property="og:site_name" content="Dark Lighthouse Solutions" />
  <meta property="og:title" content="{e(title.split(' | ')[0])}" />
  <meta property="og:description" content="{e(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{SITE}{og}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />{lds}
  <style>{BASE_CSS}{TCSS}  </style>
</head>
<body>
  <div class="gbar"><div class="wrap">
    <a class="brand" href="/">Dark Lighthouse <span>Solutions</span></a>
    <nav aria-label="Sections"><a href="/money/">Money</a><a href="/travel/" aria-current="true">Travel</a><a href="/data/">Data</a></nav>
  </div></div>
  <nav class="tnav" aria-label="Travel"><div class="wrap"><span class="sec">Travel</span>{tnav}</div></nav>
'''

def foot(aff=False):
    d = ('    <p style="margin-top:.4rem">Some links on this page may be affiliate links (booking links via Travelpayouts, and links to retailers): if you book or buy, we may earn a small commission at no extra cost to you. '
         'We only link to things we\'d use ourselves. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>\n') if aff else ""
    return f'''
  <footer class="wrap">
    <p><a href="/travel/">Travel</a> · <a href="/travel/scotland/">Scotland trip planning guide</a> · <a href="/travel/ireland/">Ireland with kids guide</a> · <a href="/travel/england/">London &amp; England with kids guide</a> · <a href="/travel/wales/">Wales with kids guide</a> · <a href="/travel/gear/">Packing &amp; gear guides</a> · <a href="/travel/gifts/">Holiday gift guides</a> · <a href="/travel/planners/">Travel planners</a> · <a href="/travel/tools/travel-budget-calculator/">Travel budget calculator</a> · <a href="/travel/tools/daily-travel-budget-calculator/">Daily travel budget calculator</a> · <a href="/templates/">Money templates</a> · <a href="/tools/">Money calculators</a></p>
{d}    <p style="margin-top:.4rem">Prices and rules change: check official sites before you book. Calculators are estimates for planning; nothing you type leaves your browser.</p>
    <p style="margin-top:.4rem"><strong>Dark Lighthouse Solutions</strong> · Planners sold via Polar (merchant of record). <a href="/privacy/">Privacy</a> · Questions? <a href="mailto:admin@darklighthousesolutions.com">admin@darklighthousesolutions.com</a></p>
  </footer>
''' + ('  <script src="/travel/affiliates.js" defer></script>\n' if aff else "")

AFF_SLOT = {"gyg-edinburgh": "tour", "gyg-edinburgh-day-trips": "tour", "viator-edinburgh": "tour",
            "discovercars-edinburgh": "car", "airalo-uk": "esim", "booking-edinburgh": "stay",
            "tiqets-edinburgh-castle": "tickets", "klook-edinburgh": "tour",
            "airalo-ireland": "esim", "tiqets-book-of-kells": "tickets", "klook-ireland": "tour", "gyg-dublin-day-trips": "tour",
            "viator-dublin": "tour", "discovercars-dublin": "car", "booking-dublin": "stay",
            "gocity-london": "tickets", "tiqets-tower-of-london": "tickets", "klook-london": "tour", "discovercars-london": "car", "booking-london": "stay",
            "tiqets-cardiff": "tickets", "klook-north-wales-rail": "tour", "gyg-wales": "tour", "discovercars-cardiff": "car", "booking-pembrokeshire": "stay"}

def slot(kind, where=""):
    """Marks a natural spot for a partner link. Invisible on the page; grep 'AFFILIATE:' to find them all."""
    return f"<!-- AFFILIATE: {kind}{' | ' + where if where else ''} -->"

def aff(key, text):
    return slot(AFF_SLOT[key], key) + f'<a href="{e(AFF[key]["plain_url"])}" data-affiliate="{key}" rel="sponsored nofollow noopener" target="_blank">{text}</a>'

def card(s, bullets=None, heading="h3"):
    name, price, short = TP[s]
    li = ("<ul>" + "".join(f"<li>{e(b)}</li>" for b in bullets) + "</ul>") if bullets else ""
    return f'''      <article class="pcard" id="{s}">
        <img src="/assets/travel/{s}/1.jpg" alt="{e(name)} preview" loading="lazy" width="1000" height="750" />
        <div class="b">
          <{heading}>{e(name)}</{heading}>
          <p>{e(short)}</p>{li}
          <div class="buy-row"><span class="price">{"Free" if price == 0 else "$" + str(price)}</span><a class="btn btn-primary" href="{URLS[s]}">{"Get it free" if price == 0 else "Buy now"}</a></div>
        </div>
      </article>'''

def cta(slugs, heading, sub):
    return f'''    <h2 id="planner">{e(heading)}</h2>
    <p class="muted">{e(sub)}</p>
    <div class="cta">
{chr(10).join(card(s) for s in slugs)}
    </div>
'''

FREE = f'''    <div class="free">
      <div><h2>Free: kids travel packing checklist</h2><p>Two printable pages: what to pack by age (baby, toddler, school-age) and a plane & car bag list for travel day.</p></div>
      <a class="btn btn-beacon" href="{URLS["kids-travel-packing-checklist"]}">Get the free checklist</a>
    </div>
'''

def write(path, page):
    d = ROOT / path.strip("/"); d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(inject(page), encoding="utf-8")

# ---------------------------------------------------------------- calculators
CUR_OPTS = '<option value="$">$ (USD, CAD, AUD…)</option><option value="£">£ (GBP)</option><option value="€">€ (EUR)</option>'
CJS = r"""
    var T = window.DLTravel;
    function sym() { var s = document.getElementById("cur"); return s ? s.value : "$"; }
    function m(x, cents, s) { s = s || sym(); return (x < 0 ? "-" + s : s) + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }); }
    function val(id) { return num(document.getElementById(id).value); }
    function flag(id, bad) { document.getElementById(id).setAttribute("aria-invalid", bad ? "true" : "false"); return bad; }
"""
BUD_FAQ = [
 ("How much should I budget for a family vacation?", "There's no single number: flights and where you sleep usually make up most of it, and both depend on dates and how far ahead you book. Price those two first with real quotes, then add food per person per day, activities and getting around. The calculator adds a buffer (10% is a sensible start) for the things you forget."),
 ("How do I work out how much to save per paycheck for a trip?", "Take what you still need (trip total minus what you've already saved) and divide it by the number of paydays left before you leave. The calculator counts your actual paydays (weekly, every 2 weeks, twice a month or monthly) up to the day before departure and rounds up so you reach the goal."),
 ("Does a payday on the day I leave count?", "No. Money that arrives the morning you fly is too late to pay for anything booked ahead, so the calculator only counts paydays up to the day before departure."),
 ("Can I use it for a trip abroad?", "Yes. Pick the currency symbol you want to see, enter every cost in that currency, and convert local prices first with today's rate. If you'd like each cost in the currency it was quoted in, the <a href=\"/travel/planners/#trip-planner-travel-budget\">Trip Planner &amp; Travel Budget</a> spreadsheet converts each line for you."),
 ("Is my information saved anywhere?", "No. The math runs in your browser and nothing you type is sent anywhere."),
]
BUD_BODY = """
  <header class="wrap hero">
    __CRUMB__
    <h1>Travel Budget Calculator: Trip Cost and How Much to Save Each Paycheck</h1>
    <p class="lede">Add up flights, lodging, food and activities for everyone going, then see exactly how much to put aside from each paycheck before you leave. Free, private, no sign-up.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <h3 style="margin-top:0">The trip</h3>
      <div class="fields">
        <div><label for="cur">Show amounts in</label><select id="cur">__CUR__</select></div>
        <div><label for="trav">Travelers</label><input id="trav" inputmode="numeric" value="4" /></div>
        <div><label for="nights">Nights</label><input id="nights" inputmode="numeric" value="7" /></div>
        <div><label for="flight">Flights, per person</label><input id="flight" inputmode="decimal" value="650" /></div>
        <div><label for="lodging">Lodging, per night (whole group)</label><input id="lodging" inputmode="decimal" value="180" /></div>
        <div><label for="food">Food, per person per day</label><input id="food" inputmode="decimal" value="40" /></div>
        <div><label for="act">Activities &amp; tickets (total)</label><input id="act" inputmode="decimal" value="300" /></div>
        <div><label for="trans">Car, trains, transfers (total)</label><input id="trans" inputmode="decimal" value="450" /></div>
        <div><label for="other">Other: insurance, eSIM, souvenirs (total)</label><input id="other" inputmode="decimal" value="100" /></div>
        <div><label for="buf">Buffer (%)</label><input id="buf" inputmode="decimal" value="10" /></div>
      </div>
      <p class="muted" style="margin-top:.6rem"><span class="est">Example</span> The numbers filled in are placeholders to show how it works, not real prices. Replace them with your own quotes.</p>
      <h3>Saving for it</h3>
      <div class="fields">
        <div><label for="saved">Already saved</label><input id="saved" inputmode="decimal" value="200" /></div>
        <div><label for="depart">Departure date</label><input id="depart" type="date" /></div>
        <div><label for="freq">How often you're paid</label><select id="freq"><option value="weekly">Every week</option><option value="biweekly" selected>Every 2 weeks</option><option value="semimonthly">Twice a month (1st &amp; 15th)</option><option value="monthly">Once a month</option></select></div>
        <div><label for="next">Next payday</label><input id="next" type="date" /></div>
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
BUD_COPY = """
    <section class="copy">
    <h2>How to budget for a trip (the short version)</h2>
    <ol>
      <li><strong>Price the two big things first.</strong> Flights and where you sleep are usually most of the bill, and they're the costs that move most with dates. Get real quotes for both before guessing anything else.<!-- AFFILIATE: stay | budget copy --></li>
      <li><strong>Food per person per day.</strong> Count every day you're away, including travel days, so 7 nights is 8 days of eating. Kids often eat less, but snacks and treats on the road add up; one number for everyone keeps it simple.</li>
      <li><strong>Everything else as one total each:</strong> tickets and tours, the rental car or train passes, and the small stuff (travel insurance, an eSIM, parking at the airport, souvenirs).<!-- AFFILIATE: tour | budget copy --><!-- AFFILIATE: insurance | budget copy --><!-- AFFILIATE: esim | budget copy --></li>
      <li><strong>Add a buffer.</strong> Something always costs more than planned. 10% is a reasonable start; go higher if you haven't booked the big things yet.</li>
    </ol>
    <h3>Turning the total into a paycheck amount</h3>
    <p>A trip total feels big. A per-paycheck number feels doable. The calculator counts the paydays between your next one and the day before you leave, takes off what you've already saved and divides the rest, rounding up so you don't fall a few dollars short. Set that amount to move into a separate savings account automatically on payday and it's one less thing to remember.</p>
    <p>If the number is too high, the levers are the same ones travel planners always mention: travel outside school holidays, fly midweek, stay somewhere with a kitchen for breakfasts, or push the trip back a few paydays.</p>
    </section>
"""
BUD_JS = r"""
    var err = document.getElementById("err"), out = document.getElementById("out"), now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    document.getElementById("depart").value = isoDate(T.addMonths(today, 8));
    document.getElementById("next").value = isoDate(T.addDays(today, 7));
    function calc(user) {
      var i = { travelers: val("trav"), nights: val("nights"), flight: val("flight"), lodging: val("lodging"), food: val("food"),
                activities: val("act"), transport: val("trans"), other: val("other"), buffer: val("buf") };
      var saved = val("saved"), depart = parseDate(document.getElementById("depart").value), next = parseDate(document.getElementById("next").value);
      var freq = document.getElementById("freq").value, errs = [];
      if (flag("trav", !(i.travelers >= 1 && i.travelers <= 30 && Math.floor(i.travelers) === i.travelers))) errs.push("Travelers: a whole number from 1 to 30.");
      if (flag("nights", !(i.nights >= 0 && i.nights <= 365 && Math.floor(i.nights) === i.nights))) errs.push("Nights: a whole number from 0 to 365.");
      [["flight", "Flights"], ["lodging", "Lodging"], ["food", "Food"], ["act", "Activities"], ["trans", "Getting around"], ["other", "Other"]].forEach(function (f) {
        var v = val(f[0]); if (isNaN(v)) { v = 0; } if (flag(f[0], v < 0 || v > 1e7)) errs.push(f[1] + ": enter an amount of 0 or more.");
      });
      ["flight", "lodging", "food", "act", "trans", "other"].forEach(function (k, j) { var key = ["flight", "lodging", "food", "activities", "transport", "other"][j]; if (isNaN(i[key])) i[key] = 0; });
      if (flag("buf", !(i.buffer >= 0 && i.buffer <= 100))) errs.push("Buffer: a percentage from 0 to 100.");
      if (isNaN(saved)) saved = 0; if (flag("saved", saved < 0)) errs.push("Already saved can't be negative.");
      if (flag("depart", isNaN(depart) || depart <= today)) errs.push("Pick a departure date in the future.");
      if (flag("next", isNaN(next) || next < today)) errs.push("Pick your next payday (today or later).");
      showErrors(err, errs); if (errs.length) { out.innerHTML = ""; return; }
      track("travel_budget", user);
      var t = T.tripCost(i), s = T.savePlan(t.total, saved, next, depart, freq), max = Math.max.apply(null, t.lines.map(function (l) { return l.amount; })) || 1;
      var h = '<h2>Your trip</h2><div class="stats">' +
        '<div class="stat win"><div class="k">Trip total</div><div class="v">' + m(t.total) + '</div><div class="s">' + i.travelers + ' traveler(s) · ' + i.nights + ' nights / ' + t.days + ' days</div></div>' +
        '<div class="stat"><div class="k">Per person</div><div class="v">' + m(t.perPerson) + '</div><div class="s">' + m(t.perDay) + ' per day for the group</div></div>';
      if (s.done) h += '<div class="stat"><div class="k">Save per paycheck</div><div class="v">' + m(0) + '</div><div class="s">You\'ve already saved enough. Nice.</div></div>';
      else if (!s.ok) h += '<div class="stat"><div class="k">Save per paycheck</div><div class="v">–</div><div class="s">No paydays before you leave. You need ' + m(s.left) + ' from savings.</div></div>';
      else h += '<div class="stat"><div class="k">Save per paycheck</div><div class="v">' + m(s.per) + '</div><div class="s">' + s.count + ' paydays left · ' + m(s.left) + ' still to save</div></div>';
      h += '</div><h3>Where the money goes</h3><div class="tablewrap"><table><thead><tr><th>Category</th><th>Amount</th><th style="text-align:left">Share</th></tr></thead><tbody>' +
        t.lines.map(function (l) { var pct = t.total ? l.amount / t.total * 100 : 0; return '<tr><td>' + esc(l.name) + '</td><td>' + m(l.amount) + '</td><td class="note"><span class="bar" style="width:' + Math.round(l.amount / max * 140) + 'px"></span>' + pct.toFixed(0) + '%</td></tr>'; }).join("") +
        '</tbody><tfoot><tr><td>Total</td><td>' + m(t.total) + '</td><td></td></tr></tfoot></table></div>';
      if (s.ok && !s.done) {
        var show = s.dates.slice(0, 6).map(dateLabel).join(", ") + (s.count > 6 ? " … " + dateLabel(s.dates[s.count - 1]) : "");
        h += '<div class="callout">Put aside <strong>' + m(s.per) + '</strong> on each of your ' + s.count + ' paydays (' + esc(show) + ') and you\'ll have ' + m(s.per * s.count + saved) + ' by ' + dateLabel(depart) + '.</div>';
      }
      out.innerHTML = h; if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    document.getElementById("cur").onchange = function () { calc(false); };
    calc(false);
"""
DAY_FAQ = [
 ("How do I work out a daily budget for a trip?", "Start with the total you're willing to spend, take off everything already paid (flights, rooms, tours booked ahead) and hold back a little for surprises. Divide what's left by the number of days. That's your day-to-day money for food, transport, tickets and treats."),
 ("How should I split a travel budget between adults and kids?", "Kids usually cost less per day than adults (smaller meals, child tickets), so the calculator lets you count each child as a share of an adult: 50% is a sensible start. Set it to 100% if your kids eat and pay like grown-ups, or 0% if they're babies."),
 ("Which exchange rate should I use?", "Use today's rate from your bank or a currency site as \"how much local money one unit of your home money buys\". Card and ATM rates are often a little worse, so rounding the rate down slightly gives you a safer number."),
 ("Is this a daily budget in pounds or dollars?", "Both. Every amount is shown in your home currency and in the local currency at the rate you enter, so you can check prices on the spot."),
 ("Is my information saved anywhere?", "No. The math runs in your browser and nothing you type is sent anywhere."),
]
DAY_BODY = """
  <header class="wrap hero">
    __CRUMB__
    <h1>Daily Travel Budget Calculator (in Any Currency)</h1>
    <p class="lede">How much can your family spend each day once the big bookings are paid? Get a daily number for the whole group, per adult and per child, in your money and the local currency.</p>
  </header>
  <main class="wrap">
    <form class="panel" id="f" novalidate>
      <div class="fields" style="margin-top:0">
        <div><label for="cur">Your home currency</label><select id="cur">__CUR__</select></div>
        <div><label for="total">Total trip budget</label><input id="total" inputmode="decimal" value="3000" /></div>
        <div><label for="pre">Already paid (flights, rooms, tours)</label><input id="pre" inputmode="decimal" value="1800" /></div>
        <div><label for="days">Days away</label><input id="days" inputmode="numeric" value="6" /></div>
        <div><label for="ad">Adults</label><input id="ad" inputmode="numeric" value="2" /></div>
        <div><label for="kids">Children</label><input id="kids" inputmode="numeric" value="2" /></div>
        <div><label for="share">Each child costs (% of an adult)</label><input id="share" inputmode="decimal" value="50" /></div>
        <div><label for="buf">Hold back for surprises (%)</label><input id="buf" inputmode="decimal" value="10" /></div>
        <div><label for="lsym">Local currency symbol or code</label><input id="lsym" value="£" maxlength="4" /></div>
        <div><label for="rate">1 of your currency buys (local)</label><input id="rate" inputmode="decimal" value="0.79" /></div>
      </div>
      <p class="muted" style="margin-top:.6rem"><span class="est">Example</span> The budget and the rate filled in are placeholders. Check today's rate before you use it.</p>
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
DAY_COPY = """
    <section class="copy">
    <h2>Why a daily number works better than a trip total</h2>
    <p>Once you're away, a trip total is hard to keep track of. A daily number is easy: if lunch and the museum come in under it, you've got a little extra for tomorrow. If one day runs over, you know to keep the next one simple.</p>
    <h3>What counts as "already paid"</h3>
    <p>Anything booked and paid before you go: flights, rooms, a rental car paid in advance, tickets you bought online.<!-- AFFILIATE: stay | daily copy --><!-- AFFILIATE: tour | daily copy --> Don't include deposits with a balance due on arrival; leave that balance in the daily money, or add it to "already paid" once you've set it aside.</p>
    <h3>Kids as a share of an adult</h3>
    <p>Families rarely spend the same on every person. Counting each child as half an adult is a common rule of thumb, but you know your kids: teenagers can out-eat their parents, and babies cost almost nothing on the ground (apart from the diapers you packed).</p>
    <h3>Exchange rates</h3>
    <p>Enter the rate as "1 of my currency buys this much local money". The rate your card actually gives you is usually a bit worse than the one you see online, and some cards add a foreign transaction fee, so it's worth rounding down a little. Planning a Scotland trip? The <a href="/travel/scotland/">Scotland guide</a> lists the costs people often forget, like the UK ETA and the Edinburgh visitor levy.</p>
    </section>
"""
DAY_JS = r"""
    var err = document.getElementById("err"), out = document.getElementById("out");
    function calc(user) {
      var i = { total: val("total"), prepaid: val("pre"), days: val("days"), adults: val("ad"), kids: val("kids"), kidShare: val("share"), rate: val("rate"), buffer: val("buf") }, errs = [];
      if (isNaN(i.prepaid)) i.prepaid = 0; if (isNaN(i.kids)) i.kids = 0; if (isNaN(i.buffer)) i.buffer = 0; if (isNaN(i.kidShare)) i.kidShare = 50;
      var ls = (document.getElementById("lsym").value || "").trim() || "local ";
      if (flag("total", !(i.total > 0 && i.total <= 1e7))) errs.push("Enter your total trip budget.");
      if (flag("pre", i.prepaid < 0)) errs.push("Already paid can't be negative.");
      if (flag("days", !(i.days >= 1 && i.days <= 365 && Math.floor(i.days) === i.days))) errs.push("Days away: a whole number from 1 to 365.");
      if (flag("ad", !(i.adults >= 1 && i.adults <= 20 && Math.floor(i.adults) === i.adults))) errs.push("Adults: a whole number from 1 to 20.");
      if (flag("kids", !(i.kids >= 0 && i.kids <= 20 && Math.floor(i.kids) === i.kids))) errs.push("Children: a whole number from 0 to 20.");
      if (flag("share", !(i.kidShare >= 0 && i.kidShare <= 200))) errs.push("Child share: a percentage from 0 to 200.");
      if (flag("buf", !(i.buffer >= 0 && i.buffer <= 90))) errs.push("Hold back: a percentage from 0 to 90.");
      if (flag("rate", !(i.rate > 0 && i.rate < 100000))) errs.push("Exchange rate: how much local money 1 of yours buys (e.g. 0.79).");
      showErrors(err, errs); if (errs.length) { out.innerHTML = ""; return; }
      track("daily_travel_budget", user);
      var r = T.dailyBudget(i);
      if (!r.ok) { out.innerHTML = '<div class="warn">After what you\'ve already paid' + (r.hold ? ' and the amount held back' : '') + ', there\'s nothing left for day-to-day spending (' + m(r.pot, true) + '). Raise the total, or lower the hold-back.</div>'; return; }
      function two(x) { return m(x.home, true) + '<div class="s">' + m(x.local, true, ls) + ' local</div>'; }
      var h = '<h2>Your daily budget</h2><div class="stats">' +
        '<div class="stat win"><div class="k">Per day, whole group</div><div class="v">' + two(r.perDay) + '</div></div>' +
        '<div class="stat"><div class="k">Per adult, per day</div><div class="v">' + two(r.perAdult) + '</div></div>' +
        (i.kids ? '<div class="stat"><div class="k">Per child, per day</div><div class="v">' + two(r.perKid) + '</div></div>' : '') + '</div>' +
        '<div class="callout">' + m(r.spend, true) + ' left after bookings' + (r.hold ? ', minus ' + m(r.hold, true) + ' held back for surprises,' : '') + ' gives you <strong>' + m(r.pot, true) + '</strong> to spend over ' + i.days + ' day(s).' +
        (i.kids ? ' Split evenly instead, it would be ' + m(r.perPersonEven.home, true) + ' (' + m(r.perPersonEven.local, true, ls) + ') per person per day.' : '') + '</div>';
      out.innerHTML = h; if (user) out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("f").onsubmit = function (ev) { ev.preventDefault(); calc(true); };
    document.getElementById("cur").onchange = function () { calc(false); };
    calc(false);
"""
CALCS = [
 ("travel-budget-calculator", "Travel budget calculator", "Travel Budget Calculator: Trip Cost & How Much to Save Per Paycheck | Dark Lighthouse Solutions",
  "Free travel budget calculator for families: add flights, lodging, food and activities, see the trip total and per person, then how much to save from each paycheck before you leave.",
  "Trip total, cost per person and how much to save from each paycheck before you leave.",
  BUD_BODY, BUD_JS, BUD_COPY, BUD_FAQ, ["trip-planner-travel-budget", "travel-planner-bundle"],
  ("Keep the whole trip in one sheet", "The Trip Planner does this math in Google Sheets, converts every cost from the currency it was quoted in, logs what you've saved and holds your itinerary and bookings.")),
 ("daily-travel-budget-calculator", "Daily travel budget calculator", "Daily Travel Budget Calculator (Any Currency) for Families | Dark Lighthouse Solutions",
  "Free daily travel budget calculator: enter your trip budget and what's already paid to get a daily spending number for the group, per adult and per child, in your currency and the local one.",
  "Spending money per day for the group, per adult and per child, in your money and the local currency.",
  DAY_BODY, DAY_JS, DAY_COPY, DAY_FAQ, ["family-travel-kids-planner", "scotland-trip-planner"],
  ("Planning a family trip?", "The Family Travel with Kids Planner tracks passports, jet lag, packing by age and the budget. Going to Scotland? The Scotland planner budgets in pounds and builds your route.")),
]

def app_ld(name, path, desc):
    return {"@context": "https://schema.org", "@type": "WebApplication", "name": name, "url": SITE + path, "description": desc,
            "applicationCategory": "TravelApplication", "operatingSystem": "Any (web browser)", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "publisher": {"@type": "Organization", "name": "Dark Lighthouse Solutions", "url": SITE + "/"}}

def related(slug):
    links = [(f"/travel/tools/{c[0]}/", c[1]) for c in CALCS if c[0] != slug] + [("/travel/scotland/", "Scotland trip planning guide"), ("/travel/ireland/", "Ireland with kids guide"), ("/travel/england/", "London & England with kids guide"), ("/travel/wales/", "Wales with kids guide"), ("/travel/tools/", "All travel tools"), ("/tools/", "Money calculators")]
    return '    <h2 id="related">Related</h2>\n    <div class="related">' + "".join(f'<a href="{p}">{e(n)}</a>' for p, n in links) + "</div>\n"

def build_calcs():
    for slug, short, title, desc, blurb, body, js, copy, faq, prods, (ch, cs) in CALCS:
        path = f"/travel/tools/{slug}/"
        cr, crld = crumbs([("Travel", "/travel/"), ("Travel tools", "/travel/tools/"), (short[0].upper() + short[1:], path)])
        page = head(path, title, desc, f"/assets/travel/{prods[0]}/1.jpg", [app_ld(title.split(" | ")[0].split(":")[0], path, desc), faq_ld(faq), crld], "/travel/tools/")
        page += (body.replace("__CRUMB__", cr).replace("__CUR__", CUR_OPTS).replace("__CTA__", cta(prods, ch, cs)).replace("__COPY__", copy)
                 .replace("__RELATED__", related(slug)).replace("__FAQ__", faq_html(faq)))
        page += foot() + '  <script src="/travel/tools/travel-calc.js"></script>\n  <script>\n  (function () {\n    "use strict";' + COMMON_JS + CJS + js + "  })();\n  </script>\n</body>\n</html>\n"
        write(path, page)
    cr, crld = crumbs([("Travel", "/travel/"), ("Travel tools", "/travel/tools/")])
    items = {"@context": "https://schema.org", "@type": "ItemList", "name": "Free travel calculators", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/travel/tools/{c[0]}/", "name": c[2].split(" | ")[0]} for i, c in enumerate(CALCS)]}
    page = head("/travel/tools/", "Free Travel Calculators: Trip Budget, Savings & Daily Spending | Dark Lighthouse Solutions",
                "Free, private travel calculators for families: trip budget and how much to save per paycheck, plus a daily spending budget in any currency.",
                "/assets/travel/trip-planner-travel-budget/1.jpg", [items, crld], "/travel/tools/")
    cards = "\n".join(f'      <a class="tool" href="/travel/tools/{c[0]}/"><h2>{e(c[2].split(" | ")[0].split(":")[0])}</h2><p>{e(c[4])}</p><span class="go">Open the calculator →</span></a>' for c in CALCS)
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>Free travel calculators</h1>
    <p class="lede">Two quick calculators for the money side of a trip. No sign-up, and nothing you type leaves your browser.</p>
  </header>
  <main class="wrap">
    <div class="tools">
{cards}
    </div>
{FREE}  </main>
''' + foot() + "</body>\n</html>\n"
    write("/travel/tools/", page)

# ---------------------------------------------------------------- Scotland guide
LEGS = [("Edinburgh", "Inverness", 157, 206), ("Edinburgh", "St Andrews", 53, 80), ("Edinburgh", "Glencoe", 119, 164), ("Edinburgh", "Oban", 124, 176),
        ("Glasgow", "Fort William", 102, 149), ("Inverness", "Portree (Skye)", 113, 157), ("Portree (Skye)", "Fort William", 108, 148),
        ("Inverness", "Wick", 103, 137), ("Wick", "Durness", 91, 139), ("Ullapool", "Applecross", 86, 113)]
def hm(m): return f"{m // 60}h {m % 60:02d}m"
DAYLIGHT = [("January", "7h 35m", "7h 20m"), ("April", "14h 10m", "14h 20m"), ("June", "17h 35m", "18h 00m"), ("August", "15h 05m", "15h 20m"),
            ("October", "10h 30m", "10h 25m"), ("December", "7h 00m", "6h 40m")]
SCOT_FAQ = [
 ("Do US citizens need anything to visit Scotland?", "Yes: an Electronic Travel Authorisation (ETA) for the UK, which includes Scotland. It costs £20 per person, every traveler needs their own, babies and children included, and the UK government says to apply at least 3 working days before you travel. Apply on GOV.UK or the official UK ETA app."),
 ("How many days do you need for Scotland with kids?", "Seven nights covers Edinburgh plus one loop through the Highlands and Skye if you keep most driving days under three hours. With ten nights you can add a rest day or two, and fourteen lets you take in part of the North Coast 500 without rushing."),
 ("Is driving in Scotland hard?", "You drive on the left, and many Highland and island roads are single-track with passing places, so you'll go slower than the sat nav expects. Plan on longer than the mapped time (we add 40%), avoid long drives after dark in winter and let locals overtake."),
 ("What is the Edinburgh visitor levy?", "A 5% charge on the room price for the first 5 nights of a stay in Edinburgh, for stays from 24 July 2026. It's usually collected by your hotel or host. Five nights at £200 a night would add £50, for example."),
 ("When are midges worst in Scotland?", "Roughly late May to September, worst on calm, damp days in the west Highlands and islands, especially at dawn and dusk. A breeze or sunshine keeps them away. Pack repellent and a head net if you're visiting in summer."),
 ("Do kids need car seats in Scotland?", "Yes. UK law says children must use a car seat until they're 12 years old or 135 cm tall, whichever comes first. Rental companies can add one, but numbers are limited, so request it when you book or bring your own."),
]
def build_scotland():
    path = "/travel/scotland/"
    cr, crld = crumbs([("Travel", "/travel/"), ("Scotland trip planning guide", path)])
    legs = "".join(f"<tr><td>{a} → {b}</td><td>{mi}</td><td>{hm(mn)}</td><td>{hm(round(mn * 1.4))}</td></tr>" for a, b, mi, mn in LEGS)
    day = "".join(f"<tr><td>{m}</td><td>{a}</td><td>{b}</td></tr>" for m, a, b in DAYLIGHT)
    art = {"@context": "https://schema.org", "@type": "Article", "headline": "Planning a Scotland trip with kids: routes, drive times, costs and what to book when",
           "datePublished": "2026-10-22", "dateModified": "2026-10-22", "author": {"@type": "Organization", "name": "Dark Lighthouse Solutions"},
           "publisher": {"@type": "Organization", "name": "Dark Lighthouse Solutions", "url": SITE + "/"}, "mainEntityOfPage": SITE + path,
           "image": SITE + "/assets/travel/scotland-trip-planner/1.jpg"}
    page = head(path, "Scotland Trip Planning Guide for Families: Routes, Drive Times & Costs (2026) | Dark Lighthouse Solutions",
                "A practical guide to planning a Scotland trip with kids: the UK ETA, realistic Highland drive times, sample 7, 10 and 14-night routes, the Edinburgh visitor levy, midges, car seats and what to book when.",
                "/assets/travel/scotland-trip-planner/1.jpg", [art, faq_ld(SCOT_FAQ), crld], "/travel/scotland/")
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>Planning a Scotland trip with kids: routes, drive times, costs and what to book when</h1>
    <p class="lede">The practical bits we wish someone had told us: how long the drives really take, which costs people forget, and what to book first. Facts checked October 2026, with sources at the end.</p>
  </header>
  <main class="wrap copy">
    <p class="disclose">Some links on this page are affiliate links. If you book or buy through them we may earn a commission at no extra cost to you. Booking links may be converted by Travelpayouts, an affiliate network, and product links go straight to the retailer. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>

    <h2 id="before">1. Before you book anything: the UK ETA</h2>
    <p>If you're visiting from the US, Canada or most other countries that don't need a visa, every person in your group needs a UK Electronic Travel Authorisation (ETA) before flying. That includes babies and children.</p>
    <ul>
      <li>It costs <strong>£20 per person</strong>, so a family of four pays £80.</li>
      <li>The UK government says to apply <strong>at least 3 working days</strong> before you travel. We'd do it as soon as the flights are booked.</li>
      <li>Apply only on <a href="https://www.gov.uk/eta">GOV.UK</a> or the official UK ETA app. Third-party sites charge extra for the same form.</li>
    </ul>
    <p>Check passports at the same time. US passports for children under 16 are only valid for 5 years, and both parents normally have to apply in person, so renewals take planning. If one parent is traveling alone with the kids, or your surnames differ, carry something that shows your relationship, like a birth certificate or a consent letter from the other parent.</p>

    <h2 id="when">2. When to go</h2>
    <p>There isn't a bad month, just different trade-offs. Summer gives you very long days but busier roads, peak prices and midges in the west. Spring and early autumn are quieter. Winter days are short, so plan one or two sights a day and finish driving before dark.</p>
    <div class="tablewrap"><table><thead><tr><th>Month</th><th>Daylight in Edinburgh</th><th>Daylight in Inverness</th></tr></thead><tbody>{day}</tbody></table></div>
    <p class="muted">Sunrise to sunset on the 15th of each month. The Scotland Trip Planner has all 12 months.</p>
    <ul>
      <li><strong>Midges</strong> are tiny biting flies, around from roughly late May to September and worst on calm, damp evenings in the west Highlands and islands. Pack repellent and a head net.</li>
      <li><strong>August</strong> is festival month in Edinburgh. Rooms in the city book up early and cost more.</li>
      <li><strong>July and August</strong> are also Scottish school holidays, so book rooms and cars early.</li>
    </ul>

    <h2 id="driving">3. How long the drives really take</h2>
    <p>This is where most Scotland itineraries go wrong. Highland roads are slower than they look: a lot of them are single-track with passing places, you'll stop for views (and toilets), and with kids you'll stop more. These are the mapped times with no stops, plus a "realistic" column with 40% added.</p>
    <div class="tablewrap"><table><thead><tr><th>Drive</th><th>Miles</th><th>Mapped time</th><th>Realistic (+40%)</th></tr></thead><tbody>{legs}</tbody></table></div>
    <p class="muted">Mapped times: OpenStreetMap road data via the OSRM router, by car, looked up October 2026.</p>
    <p>A good rule with kids: keep most driving days under three hours of mapped time, and never stack two long days back to back. Remember you drive on the left, and children need a car seat until they're 12 or 135 cm tall. If you're renting, automatics are less common than manuals in the UK, so book early and request the seats when you reserve. Planning to use your credit card's rental car cover? It generally works in Scotland (Visa's standard benefit excludes only Northern Ireland within the UK, and Amex's standard cover excludes Australia, Italy and New Zealand), but it's often secondary and you must decline the rental desk's collision damage waiver, so check your card's guide and carry proof of cover. Comparison sites like {aff("discovercars-edinburgh", "Discover Cars")} show what's available at Edinburgh and Glasgow airports.</p>

    <h2 id="routes">4. Three sample routes</h2>
    <h3>7 nights: Edinburgh, the Highlands and Skye</h3>
    <p>Edinburgh (2 nights) → Inverness via Pitlochry (2 nights) → Portree on Skye (1 night) → Fort William (1 night) → Glencoe and on to Glasgow for the flight home. The fullest of the three: it works best for older kids who are fine in the car.</p>
    {slot("stay", "7-night route: Edinburgh, Inverness, Portree, Fort William")}
    <h3>10 nights: add Perthshire and breathing room</h3>
    <p>Edinburgh (3 nights, with a day trip to St Andrews) → Pitlochry (1) → Inverness (2) → Skye (2) → Fort William (1) → Glasgow (1). Two nights on Skye means one day where you don't pack the car.</p>
    {slot("stay", "10-night route: Edinburgh, Pitlochry, Inverness, Skye, Fort William, Glasgow")}
    <h3>14 nights: a slice of the North Coast 500</h3>
    <p>Edinburgh (3) → Pitlochry (1) → Inverness (1) → Wick (1) → Durness (1) → Ullapool (1) → Applecross (1) → Skye (2) → Fort William (1) → Oban (1) → Glasgow (1). The full North Coast 500 is 516 miles from Inverness and VisitScotland suggests 5 to 7 days for it, so this route only does the northern half before cutting across to Skye.</p>
    {slot("stay", "14-night route: NC500 towns, Applecross, Skye, Oban")}
    <p>Prefer to leave the driving to someone else for a day? Highland day tours from Edinburgh (Loch Ness, Glencoe, St Andrews) are listed on {aff("gyg-edinburgh-day-trips", "GetYourGuide")}, {aff("viator-edinburgh", "Viator")} and {aff("klook-edinburgh", "Klook")}. Compare the pickup point and how long you're actually on the coach before you book with kids.</p>

    <h2 id="costs">5. The costs people forget</h2>
    <p>Flights, rooms and the car will be most of your budget, and they depend so much on dates that we won't guess at them. Get real quotes. These are the smaller things that catch people out:</p>
    <ul>
      <li><strong>UK ETA:</strong> £20 per person (fixed fee).</li>
      <li><strong>Edinburgh visitor levy:</strong> 5% of the room price for the first 5 nights, for stays from 24 July 2026. <span class="est">Example</span> 5 nights at £200 a night adds £50.</li>
      <li><strong>Car seats</strong> from the rental company, if you don't bring your own, usually charged per day.</li>
      <li><strong>Ferries</strong> if you head to islands other than Skye (Skye has a bridge). Book summer car spaces early.</li>
      <li><strong>Travel insurance:</strong> check the policy covers everyone, including medical cover outside your home country and the rental car's damage excess, which is often £1,000 or more.{slot("insurance", "costs list")}</li>
      <li><strong>Phone data:</strong> check your plan's roaming charges, or use a travel eSIM such as {aff("airalo-uk", "Airalo")}.</li>
      <li><strong>Castle and attraction tickets:</strong> many big sites sell timed tickets online, and summer slots sell out. Edinburgh tours and tickets are on {aff("gyg-edinburgh", "GetYourGuide")}, and {aff("tiqets-edinburgh-castle", "Tiqets has Edinburgh Castle tickets")}, including entry with a guided tour. The castle's own website sells plain entry too, so compare.</li>
    </ul>
    <p>Want to turn it into a number? The <a href="/travel/tools/travel-budget-calculator/">travel budget calculator</a> adds it up and tells you what to save per paycheck, and the <a href="/travel/tools/daily-travel-budget-calculator/">daily budget calculator</a> works out spending money per day in pounds and dollars.</p>

    <h2 id="packing">Packing for Scotland's weather</h2>
    <p>It can rain in any month, and the Highlands are windier and colder than Edinburgh. Bring layers and a waterproof for everyone, kids included, and midge repellent from late May to September.</p>
{packbox("Scotland", [("patagonia-torrentshell-kids", "Patagonia Kids' Torrentshell 3L Rain Jacket", "a packable, properly waterproof shell"), ("hunter-kids-first-classic", "Hunter Kids First Classic Rain Boots", "wellies for puddles and muddy paths"), ("smartwool-classic-thermal-crew", "Smartwool Classic Thermal Merino Base Layer", "for cold months, or anyone who feels the cold"), ("saxx-quest-boxer-brief", "SAXX Quest Quick-Dry Boxer Brief", "washes in the sink and dries overnight")], "Scotland's weather changes fast, so think layers, not one big coat.")}
    <h2 id="timeline">6. What to book when</h2>
    <p>Our rule of thumb for a summer trip, counting back from the day you land. Book earlier for July and August, and later is usually fine for the quieter months.</p>
    <ul>
      <li><strong>6 to 9 months out:</strong> rooms on Skye and other small places with few beds. Check {aff("booking-edinburgh", "Booking.com")} or local B&amp;Bs.</li>
      <li><strong>4 to 6 months out:</strong> flights, the rental car (especially an automatic) and Edinburgh rooms in August.</li>
      <li><strong>2 to 3 months out:</strong> ferries, castle tickets with timed entry, any tours.{slot("tour", "timeline: tours and tickets")}</li>
      <li><strong>Once flights are booked:</strong> the ETA for everyone, a passport check, and travel insurance.{slot("insurance", "timeline")}</li>
      <li><strong>The week before:</strong> download offline maps, print the emergency info, pack the midge net.</li>
    </ul>
{cta(["scotland-trip-planner", "travel-planner-bundle"], "Plan it in one sheet", "The Scotland Trip Planner does all of this for you: pick each night's base and it fills in drive times and flags long days, counts the booking timeline back from your arrival date, and budgets in pounds or your own currency.")}
{faq_html(SCOT_FAQ)}
    <h2 id="sources">Sources</h2>
    <ul class="src">
      <li><a href="https://www.gov.uk/eta">UK ETA: who needs one, £20 fee, apply 3 working days ahead (GOV.UK)</a></li>
      <li><a href="https://www.edinburgh.gov.uk/business/visitor-levy-edinburgh">Edinburgh Visitor Levy: 5%, first 5 nights, from 24 July 2026 (City of Edinburgh Council)</a></li>
      <li><a href="https://www.gov.uk/child-car-seats-the-rules">Child car seat rules: until 12 years or 135 cm (GOV.UK)</a></li>
      <li><a href="https://www.visitscotland.com/travel-planning/touring/north-coast-500">North Coast 500: 516 miles, allow 5 to 7 days (VisitScotland)</a></li>
      <li><a href="https://www.visitscotland.com/travel-planning/midges-ticks-scotland">Midges and ticks (VisitScotland)</a></li>
      <li><a href="https://www.scotlandtourism.org/scotland-weather-by-month/">Daylight by month (Scotland Tourism)</a></li>
      <li><a href="https://www.gov.uk/government/publications/children-travelling-to-the-uk/children-travelling-to-the-uk-accessible">Children travelling to the UK (GOV.UK)</a></li>
      <li><a href="https://travel.state.gov/en/passports/apply/child/under-16.html">US passports for children under 16 (U.S. Department of State)</a></li>
      <li><a href="https://usa.visa.com/dam/VCOM/regional/na/us/support-legal/documents/arcdw-secondary.pdf">Visa Auto Rental Collision Damage Waiver terms: country exclusions (Visa)</a></li>
      <li><a href="https://www.americanexpress.com/content/dam/amex/us/credit-cards/features-benefits/CRLDI_Benefit_Guide_371-397_EDT_2.20_REV_4.24_a11y3_04022026.pdf">Car Rental Loss and Damage Insurance: country exclusions, secondary cover (American Express)</a></li>
      <li><a href="https://project-osrm.org/">Drive distances and times: OpenStreetMap data via OSRM</a></li>
    </ul>
    <p class="muted">Rules and fees change. Check the official pages before you book. Last checked 22 October 2026.</p>
  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

# ---------------------------------------------------------------- Ireland guide
IE_LEGS = [("Dublin", "Galway", 209, 150), ("Galway", "Cliffs of Moher", 77, 79), ("Cliffs of Moher", "Dingle (via Limerick)", 227, 198),
           ("Dingle", "Killarney", 66, 68), ("Dublin", "Kilkenny", 124, 94), ("Kilkenny", "Killarney", 196, 163),
           ("Galway", "Westport", 80, 79), ("Killarney", "Shannon Airport", 135, 117), ("Killarney", "Dublin", 303, 226),
           ("Dublin", "Giant's Causeway (Northern Ireland)", 263, 188)]
IE_SEASONS = [("Winter (Dec to Feb)", "5.4°C (about 42°F)", "Wettest time of year: December averages about 142 mm", "7h 32m"),
              ("Spring (Mar to May)", "8.8°C (about 48°F)", "Driest season: April and May average 79 mm and 82 mm", "13h 58m"),
              ("Summer (Jun to Aug)", "14.6°C (about 58°F); July is warmest at 15.2°C", "June is the driest summer month (85 mm), August the wettest (103 mm)", "16h 58m"),
              ("Autumn (Sep to Nov)", "10.3°C (about 51°F)", "October and November average about 130 mm or more", "10h 38m")]
IE_FAQ = [
 ("Do US citizens need a visa for Ireland?", "No. US citizens can visit the Republic of Ireland as tourists for up to 90 days without a visa, and the passport needs to be valid for the whole stay. Northern Ireland is different: it's part of the UK, so you need a UK ETA (£20 per person) to visit, even if you just drive across the border."),
 ("Does my credit card cover a rental car in Ireland?", "It depends on the card, so check its guide to benefits before you book. The standard Visa benefit used by many Visa Signature cards excludes the Republic of Ireland and Northern Ireland. Chase's Visa Infinite guide covers rentals worldwide. American Express's standard car rental cover leaves out Australia, Italy and New Zealand but not Ireland, though it's secondary, and Amex's paid Premium Car Rental Protection does exclude Ireland. Even with cover, Irish rental desks can ask for proof, a big card hold, or an extra daily charge."),
 ("How many days do you need in Ireland with kids?", "Seven nights is enough for Dublin and one region of the west, like Galway and the Cliffs of Moher, or Kerry. With ten nights you can do Dublin, Kerry and the Galway area without long drives every day. Northern Ireland and the Giant's Causeway really need two extra nights."),
 ("Is the OPW Heritage Card worth it for a family?", "If you'll visit several state-run sites, often yes. The family card is €90 for two adults and up to five children aged 12 to 18, and children under 12 already get in free at OPW sites. With younger kids only, compare a couple of adult cards (€40 each) with the individual tickets you'd buy."),
 ("Do kids need car seats in Ireland?", "Yes. Irish law says children must use a suitable child seat or booster until they're 150 cm tall or weigh 36 kg. Request seats when you book the car, or bring your own."),
 ("Do I pay the M50 toll around Dublin?", "If you drive the stretch of the M50 between junctions 6 and 7, yes. There's no booth: cameras read the plate, and you pay online at eflow.ie by 8pm the next day. Ask the rental company first, because some add tolls to your bill."),
]
def build_ireland():
    path = "/travel/ireland/"
    cr, crld = crumbs([("Travel", "/travel/"), ("Ireland with kids guide", path)])
    legs = "".join(f"<tr><td>{a} → {b}</td><td>{km} km ({round(km * 0.621371)} mi)</td><td>{hm(mn)}</td><td>{hm(round(mn * 1.4))}</td></tr>" for a, b, km, mn in IE_LEGS)
    seasons = "".join(f"<tr><td>{s}</td><td>{t}</td><td>{r}</td><td>{d}</td></tr>" for s, t, r, d in IE_SEASONS)
    art = {"@context": "https://schema.org", "@type": "Article", "headline": "Ireland with kids: when to go, routes, costs and the car hire insurance catch",
           "datePublished": "2026-10-22", "dateModified": "2026-10-22", "author": {"@type": "Organization", "name": "Dark Lighthouse Solutions"},
           "publisher": {"@type": "Organization", "name": "Dark Lighthouse Solutions", "url": SITE + "/"}, "mainEntityOfPage": SITE + path,
           "image": SITE + "/assets/travel/family-travel-kids-planner/1.jpg"}
    page = head(path, "Ireland with Kids: Family Trip Planning Guide, Routes, Costs & Car Hire Tips (2026) | Dark Lighthouse Solutions",
                "Planning Ireland with kids? When to go, 7 and 10-night routes (Dublin, Galway, Cliffs of Moher, Dingle, Killarney), real drive times, the Heritage Card, and why your credit card may not cover the rental car.",
                "/assets/travel/family-travel-kids-planner/1.jpg", [art, faq_ld(IE_FAQ), crld], "/travel/ireland/")
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>Ireland with kids: when to go, routes, costs and the car hire insurance catch</h1>
    <p class="lede">The practical stuff for a family trip to Ireland: what the weather is really like, how long the drives take, what's worth booking ahead, and the rental car insurance surprise that catches a lot of Americans at the desk. Facts checked October 2026, with sources at the end.</p>
  </header>
  <main class="wrap copy">
    <p class="disclose">Some links on this page are affiliate links. If you book or buy through them we may earn a commission at no extra cost to you. Booking links may be converted by Travelpayouts, an affiliate network, and product links go straight to the retailer. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>

    <h2 id="before">1. Before you book: passports, and the Northern Ireland catch</h2>
    <ul>
      <li><strong>The Republic of Ireland:</strong> US citizens don't need a visa for a tourist trip of up to 90 days. Your passport has to be valid for the whole stay.</li>
      <li><strong>Northern Ireland</strong> (Belfast, the Giant's Causeway) is part of the UK, not the Republic of Ireland. There's no passport check on the land border, but you still need a <strong>UK ETA</strong>: £20 per person, babies included, applied for on <a href="https://www.gov.uk/eta">GOV.UK</a> or the official UK ETA app. Northern Ireland also uses pounds, not euros.</li>
      <li><strong>Kids' passports:</strong> US passports for children under 16 are only valid for 5 years, so check expiry dates against your return date now.</li>
    </ul>
    <p>A nice bonus on the way home: Dublin and Shannon airports have US preclearance, so you clear US immigration and customs before you board and land in the US like a domestic flight.</p>

    <h2 id="when">2. When to go</h2>
    <p>Ireland is mild all year, rarely very hot or very cold, and it can rain in any month. The west gets a lot more rain than Dublin. What changes most is daylight, crowds and prices.</p>
    <div class="tablewrap"><table><thead><tr><th>Season</th><th>Average temperature</th><th>Rain</th><th>Daylight in Dublin (mid-season)</th></tr></thead><tbody>{seasons}</tbody></table></div>
    <p class="muted">Temperatures and rainfall: Met Éireann 1991–2020 national averages. Daylight: sunrise to sunset on 15 December, April, June and October, calculated for Dublin.</p>
    <ul>
      <li><strong>May, June and September</strong> are our pick with kids: long days, drier weather than autumn, and fewer crowds than high summer.</li>
      <li><strong>July and August</strong> are the busiest and priciest months for rooms and cars, so book early.</li>
      <li><strong>Winter</strong> is usually cheaper and quiet, but days are short and some smaller attractions on the west coast keep reduced hours. Plan one or two things a day.</li>
    </ul>

    <h2 id="driving">3. Getting around: driving on the left and real drive times</h2>
    <p>A car is the easiest way to see the west with kids. In Ireland you drive on the left, distances are in kilometres and speed limits in km/h, and many rural roads are narrow and twisty with stone walls right at the edge. These are mapped times with no stops, plus a "realistic" column with 40% added for photo stops, toilets and slow tractors.</p>
    <div class="tablewrap"><table><thead><tr><th>Drive</th><th>Distance</th><th>Mapped time</th><th>Realistic (+40%)</th></tr></thead><tbody>{legs}</tbody></table></div>
    <p class="muted">Mapped times: OpenStreetMap road data via the OSRM router, by car, looked up October 2026.</p>
    <ul>
      <li><strong>Shortcut from Clare to Kerry:</strong> the Killimer–Tarbert car ferry across the Shannon estuary takes about 20 minutes and saves the long drive round through Limerick.</li>
      <li><strong>Car seats:</strong> children must use a child seat or booster until they're 150 cm tall or 36 kg. Request them when you book, or bring your own.</li>
      <li><strong>Automatics</strong> are less common than manuals, so book early if you need one.</li>
      <li><strong>M50 toll:</strong> the Dublin ring road has a camera toll between junctions 6 and 7. Pay at eflow.ie by 8pm the next day, unless your rental company handles it.</li>
      <li><strong>Going north?</strong> Tell the rental company you'll drive into Northern Ireland and ask if there's a cross-border fee.</li>
    </ul>
    <p>Comparison sites like {aff("discovercars-dublin", "Discover Cars")} show what's available at Dublin and Shannon airports, but read the next section before you pick the insurance.</p>

    <h2 id="car-insurance">4. The rental car insurance catch (read this before you book)</h2>
    <p>Lots of US credit cards include rental car damage cover, and plenty of people plan to rely on it. Ireland is one of the places where that often doesn't work, and where it does, the rental desk can still make it awkward:</p>
    <ul>
      <li><strong>Many Visa cards don't cover Ireland at all.</strong> Visa's standard Auto Rental Collision Damage Waiver, used by many Visa Signature cards, excludes the Republic of Ireland, Northern Ireland, Israel and Jamaica.</li>
      <li><strong>Some premium cards do.</strong> Chase's Visa Infinite guide to benefits (the one for cards like Sapphire Reserve) says coverage is available worldwide, and it's primary.</li>
      <li><strong>American Express:</strong> the standard Car Rental Loss and Damage Insurance on most Amex cards excludes Australia, Italy and New Zealand but not Ireland. It's secondary cover, and you have to pay for the whole rental with the card and decline the desk's collision damage waiver. Amex's paid add-on, Premium Car Rental Protection, <em>does</em> exclude Ireland.</li>
      <li><strong>At the desk:</strong> Hertz's Dublin terms, for example, say that if you rely on a credit card you need documents showing the cover applies in the Republic of Ireland. They also add a €10.22-a-day Supplementary Liability Waiver and put a €5,000 hold on your card if you decline their CDW.</li>
    </ul>
    <p><strong>What that means for you:</strong> call the number on your card, ask "does my rental car cover apply in the Republic of Ireland (and Northern Ireland, if you're going)?", and get a letter of coverage in writing. Check you have room on the card for a large hold. If your card doesn't cover Ireland, budget for the rental company's CDW (collision damage waiver), or for "excess" cover that lowers the amount you'd owe after damage. It can add a lot to the daily rate, so get the full quote before comparing cars on price.</p>

    <h2 id="routes">5. Two sample routes</h2>
    <h3>7 nights: Dublin and the west</h3>
    <p>Dublin (2 nights, no car needed) → pick up the car and drive to Galway (2 nights, with a day for the Burren and the Cliffs of Moher) → ferry across the Shannon to Killarney (2 nights, with a day on the Dingle Peninsula) → Shannon Airport (1 night nearby, or fly the same day). Flying home from Shannon saves the long drive back to Dublin.</p>
    {slot("stay", "7-night route: Dublin, Galway, Killarney, Shannon")}
    <h3>10 nights: Dublin, the south and the Wild Atlantic Way</h3>
    <p>Dublin (3 nights) → Kilkenny (1 night: a castle and an easy medieval town for little legs) → Killarney (2 nights, Ring of Kerry or Killarney National Park) → Dingle (1 night) → ferry to Clare and the Cliffs of Moher → Galway (2 nights) → Dublin (1 night before the flight). The Wild Atlantic Way is the signed coastal route along the whole west coast, and this trip follows one piece of it, from Dingle up to Galway.</p>
    {slot("stay", "10-night route: Dublin, Kilkenny, Killarney, Dingle, Galway")}
    <h3>Adding the Giant's Causeway</h3>
    <p>The Giant's Causeway is in Northern Ireland, about three hours' mapped drive from Dublin, so it's a long day trip with kids. It works better as two nights near Belfast or on the Causeway Coast. Remember it's the UK: everyone needs a UK ETA, prices are in pounds, and tell your rental company you're crossing the border.</p>
    <p>Rather skip the driving for a day? Coach day trips from Dublin to the Cliffs of Moher, Galway or the Giant's Causeway are listed on {aff("gyg-dublin-day-trips", "GetYourGuide")} and {aff("klook-ireland", "Klook")}. With young kids, check how many hours you're actually on the coach.</p>

    <h2 id="costs">6. What things cost (and the passes worth knowing)</h2>
    <p>Flights, rooms and the car will be most of your budget, and they depend so much on dates that we won't guess at them. Get real quotes. Some fixed costs worth knowing:</p>
    <ul>
      <li><strong>OPW Heritage Card:</strong> one year of free entry to all state-run OPW heritage sites (places like Dublin Castle, Kilkenny Castle and the Rock of Cashel). Adult €40, family €90 (two adults and up to five children aged 12 to 18). Children under 12 get in free at these sites anyway. It's valid for a year from first use, and you can buy it at the first site you visit.</li>
      <li><strong>Cliffs of Moher:</strong> 2026 gate prices are €15 per adult or €30 for a family, and online tickets are cheaper, especially before 11am or after 4pm. Children under 12 get in free with a parent (up to 4 per adult).</li>
      <li><strong>Book of Kells, Dublin:</strong> timed tickets often sell out in summer, so book ahead. {aff("tiqets-book-of-kells", "Tiqets sells Book of Kells tickets")}, and so does Trinity College's own site, so compare.</li>
      <li><strong>UK ETA</strong> if you're going to Northern Ireland: £20 per person.</li>
      <li><strong>Car rental insurance:</strong> see section 4. It's the cost people most often leave out.</li>
      <li><strong>Phone data:</strong> US plans can charge a lot to roam. A travel eSIM such as {aff("airalo-ireland", "Airalo's Ireland eSIM")} is an easy fix. If you're crossing into Northern Ireland, check that the plan covers the UK too, or pick a Europe-wide plan.</li>
    </ul>
    <p><span class="est">Estimate</span> To get your own number, plug real quotes into the free <a href="/travel/tools/travel-budget-calculator/">travel budget calculator</a> (it also tells you what to save per paycheck), and use the <a href="/travel/tools/daily-travel-budget-calculator/">daily budget calculator</a> for spending money per day in euros and dollars.</p>

    <h2 id="packing">7. Packing for Irish weather</h2>
    <ul>
      <li><strong>Layers, not a big coat.</strong> Even in summer, averages sit in the high 50s °F, and the weather changes fast on the coast.</li>
      <li><strong>A proper waterproof jacket for everyone</strong>, kids included, plus waterproof shoes or boots. The Cliffs of Moher and Dingle can be very windy.</li>
      <li><strong>A change of clothes in the car</strong> for wet or muddy kids.</li>
      <li><strong>Plug adapters:</strong> Ireland and Northern Ireland both use the UK-style three-pin plug (type G).</li>
    </ul>
{packbox("Ireland", [("llbean-discovery-rain-jacket", "L.L.Bean Infants' and Toddlers' Discovery Rain Jacket", "packable and reflective, sizes 2T–4T"), ("columbia-watertight-mens", "Columbia Watertight II Rain Jacket", "a good-value packable shell for adults"), ("darntough-kids-light-hiker", "Darn Tough Kids' Light Hiker Socks", "merino socks that stay warm when damp"), ("huckberry-proof-merino-tee", "Proof 72-Hour Merino T-Shirt (Huckberry)", "a travel tee you can wear for days")], "Ireland is mild but wet and windy, especially on the west coast.")}
    <h2 id="kids">8. Tips for traveling Ireland with kids</h2>
    <ul>
      <li><strong>Keep most driving days under two to three hours</strong> of mapped time, and don't stack long days back to back.</li>
      <li><strong>Base yourself for two nights or more</strong> where you can, so there are days when you don't pack the car.</li>
      <li><strong>Have a rain plan in each place:</strong> museums, castles, aquariums and caves are easy wins when the weather turns.</li>
      <li><strong>Cliff edges:</strong> stay on the marked paths at the Cliffs of Moher and other coastal spots, and keep small kids' hands held. Wind gusts are strong.</li>
      <li><strong>Jet lag:</strong> Ireland is usually 5 hours ahead of US Eastern time. Get outside in daylight on day one and keep the first day light.</li>
      <li><strong>Pubs:</strong> lots of pubs serve food and welcome families during the day and early evening. Policies on children later at night vary, so ask.</li>
    </ul>

    <h2 id="timeline">9. What to book when</h2>
    <ul>
      <li><strong>6 to 9 months out:</strong> rooms in Dingle, Killarney and Galway for July and August. Check {aff("booking-dublin", "Booking.com")} or local B&amp;Bs.</li>
      <li><strong>4 to 6 months out:</strong> flights and the rental car (especially an automatic), after you've confirmed your card's insurance situation.</li>
      <li><strong>1 to 2 months out:</strong> timed tickets for the Book of Kells and the Cliffs of Moher, and any tours.{slot("tour", "timeline: tours and tickets")}</li>
      <li><strong>Once flights are booked:</strong> passport check, a UK ETA if you're going north, and travel insurance.{slot("insurance", "timeline")}</li>
      <li><strong>The week before:</strong> your card's letter of coverage, offline maps, and the eSIM installed.</li>
    </ul>
{cta(["trip-planner-travel-budget", "family-travel-kids-planner"], "Plan it in one sheet", "The Trip Planner & Travel Budget handles costs in euros, pounds and dollars and works out what to save each paycheck. The Family Travel with Kids Planner checks passports against your return date and has a jet-lag plan and packing lists by age.")}
{FREE}
{faq_html(IE_FAQ)}
    <h2 id="sources">Sources</h2>
    <ul class="src">
      <li><a href="https://travel.state.gov/en/international-travel/travel-advisories/ireland.html">Ireland: entry requirements for US citizens (U.S. Department of State)</a></li>
      <li><a href="https://www.dfa.ie/irish-embassy/usa/passports/top-passport-questions/travel-between-the-usa-and-ireland/">Travel between the USA and Ireland (Irish Department of Foreign Affairs)</a></li>
      <li><a href="https://homeofficemedia.blog.gov.uk/electronic-travel-authorisation-eta-factsheet-april-2026/">UK ETA factsheet, April 2026: £20, and how ETAs apply in Northern Ireland (UK Home Office)</a></li>
      <li><a href="https://www.gov.uk/eta">Apply for a UK ETA (GOV.UK)</a></li>
      <li><a href="https://www.cbp.gov/travel/preclearance">US preclearance locations, including Dublin and Shannon (U.S. Customs and Border Protection)</a></li>
      <li><a href="https://www.met.ie/cms/assets/uploads/2023/07/Irelands-Climate-Averages-1991_2020.pdf">Ireland's Climate Averages 1991–2020 (Met Éireann)</a></li>
      <li><a href="https://usa.visa.com/dam/VCOM/regional/na/us/support-legal/documents/arcdw-secondary.pdf">Visa Auto Rental Collision Damage Waiver terms: excludes the Republic of Ireland and Northern Ireland (Visa)</a></li>
      <li><a href="https://www.chasebenefits.com/K113-005/pdf/BGC11580.pdf">Chase Visa Infinite Guide to Benefits, effective 06/11/26: auto rental coverage worldwide (Chase)</a></li>
      <li><a href="https://www.americanexpress.com/content/dam/amex/us/credit-cards/features-benefits/CRLDI_Benefit_Guide_371-397_EDT_2.20_REV_4.24_a11y3_04022026.pdf">Car Rental Loss and Damage Insurance: excludes Australia, Italy and New Zealand; secondary cover (American Express)</a></li>
      <li><a href="https://www.americanexpress.com/en-us/insurance/premium-car-rental-protection/faq/">Premium Car Rental Protection FAQ: excludes Ireland (American Express)</a></li>
      <li><a href="https://www.hertz.com/rentacar/reservation/reviewmodifycancel/templates/rentalTerms.jsp?EOAG=DUBC62&amp;KEYWORD=CDW">Hertz Dublin rental terms: credit card cover documents, €10.22/day SLW, €5,000 hold (Hertz)</a></li>
      <li><a href="https://www.rsa.ie/road-safety/road-users/passengers/children/faqs">Child car seats: until 150 cm or 36 kg (Road Safety Authority)</a></li>
      <li><a href="https://www.eflow.ie/tourist-and-rental-info">M50 toll for tourists and rental cars (eFlow)</a></li>
      <li><a href="https://heritageireland.ie/visit/heritage-card/">OPW Heritage Card prices (Heritage Ireland)</a></li>
      <li><a href="https://www.cliffsofmoher.ie/en/your-visit/visiting-the-cliffs/admission-rates/">Cliffs of Moher admission rates (Cliffs of Moher Experience)</a></li>
      <li><a href="https://www.shannonferries.com/">Killimer–Tarbert car ferry (Shannon Ferry Group)</a></li>
      <li><a href="https://www.wildatlanticway.com/">The Wild Atlantic Way (Fáilte Ireland)</a></li>
      <li><a href="https://travel.state.gov/en/passports/apply/child/under-16.html">US passports for children under 16 (U.S. Department of State)</a></li>
      <li><a href="https://project-osrm.org/">Drive distances and times: OpenStreetMap data via OSRM</a></li>
    </ul>
    <p class="muted">Rules, fees and card benefits change. Check the official pages and your own card's guide to benefits before you book. Last checked 22 October 2026.</p>
  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

# ---------------------------------------------------------------- England guide
CARD_UK = ('Planning to use your credit card\'s rental car cover? It generally works in {where} (Visa\'s standard benefit excludes only Northern Ireland within the UK, '
           'and Amex\'s standard cover excludes Australia, Italy and New Zealand), but it\'s often secondary and you must decline the rental desk\'s collision damage waiver, '
           'so check your card\'s guide and carry proof of cover.')
CARD_SRC = '''      <li><a href="https://usa.visa.com/dam/VCOM/regional/na/us/support-legal/documents/arcdw-secondary.pdf">Visa Auto Rental Collision Damage Waiver terms: country exclusions (Visa)</a></li>
      <li><a href="https://www.americanexpress.com/content/dam/amex/us/credit-cards/features-benefits/CRLDI_Benefit_Guide_371-397_EDT_2.20_REV_4.24_a11y3_04022026.pdf">Car Rental Loss and Damage Insurance: country exclusions, secondary cover (American Express)</a></li>
'''
ETA_HTML = '''    <p>If you're visiting from the US, Canada, Australia or most other countries that don't need a visa, every person in your group needs a UK Electronic Travel Authorisation (ETA) before you travel. That includes babies and children. British and Irish citizens don't need one.</p>
    <ul>
      <li>It costs <strong>£20 per person</strong>, so a family of four pays £80.</li>
      <li>The UK government says to apply <strong>at least 3 working days</strong> before you travel. We'd do it as soon as the flights are booked.</li>
      <li>Apply only on <a href="https://www.gov.uk/eta">GOV.UK</a> or the official UK ETA app. Third-party sites charge extra for the same form.</li>
    </ul>
    <p>Check passports at the same time. US passports for children under 16 are only valid for 5 years, so compare expiry dates with your return date now. If one parent is traveling alone with the kids, or your surnames differ, carry something that shows your relationship, like a birth certificate or a consent letter from the other parent.</p>
'''
def daylight_rows(rows): return "".join(f"<tr><td>{m}</td><td>{a}</td><td>{b}</td></tr>" for m, a, b in rows)
def leg_rows(legs): return "".join(f"<tr><td>{a} → {b}</td><td>{mi}</td><td>{hm(mn)}</td><td>{hm(round(mn * 1.4))}</td></tr>" for a, b, mi, mn in legs)
def article(headline, path, img):
    return {"@context": "https://schema.org", "@type": "Article", "headline": headline,
            "datePublished": "2026-10-22", "dateModified": "2026-10-22", "author": {"@type": "Organization", "name": "Dark Lighthouse Solutions"},
            "publisher": {"@type": "Organization", "name": "Dark Lighthouse Solutions", "url": SITE + "/"}, "mainEntityOfPage": SITE + path, "image": SITE + img}
DISCLOSE = '    <p class="disclose">Some links on this page are affiliate links. If you book or buy through them we may earn a commission at no extra cost to you. Booking links may be converted by Travelpayouts, an affiliate network, and product links go straight to the retailer. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>\n'

EN_LEGS = [("London", "Windsor", 22, 44), ("London", "Bath", 111, 150), ("Stonehenge", "Bath", 37, 54), ("Bath", "the Cotswolds (Bourton-on-the-Water)", 51, 82),
           ("the Cotswolds (Bourton-on-the-Water)", "London", 83, 124), ("the Cotswolds (Bourton-on-the-Water)", "York", 171, 204), ("London", "York", 209, 249),
           ("York", "Windermere (Lake District)", 97, 139), ("Windermere (Lake District)", "Manchester Airport", 92, 118)]
EN_DAY = [("January", "8h 20m", "8h 00m"), ("April", "13h 50m", "14h 00m"), ("June", "16h 35m", "17h 05m"), ("August", "14h 35m", "14h 50m"),
          ("October", "10h 40m", "10h 35m"), ("December", "7h 50m", "7h 25m")]
EN_FAQ = [
 ("Do US citizens need anything to visit England?", "Yes: a UK Electronic Travel Authorisation (ETA). It costs £20 per person, every traveler needs their own, babies and children included, and the UK government says to apply at least 3 working days before you travel. Apply on GOV.UK or the official UK ETA app. British and Irish citizens don't need one."),
 ("Do kids travel free on the London Underground?", "Children under 11 travel free on London buses and trams. On the Tube, DLR, London Overground and the Elizabeth line, up to four children aged 5 to 10 travel free with an adult who's paying, and under-5s are always free. Kids aged 11 to 15 pay a reduced fare if you add a Young Visitor discount to a Visitor Oyster card."),
 ("Is the London Pass worth it for a family?", "Only if you'll actually visit several of the paid attractions it covers. Write down the places you'd go anyway, add up their family ticket prices, and compare that with the pass for your number of days. Remember many of London's big museums are free, so they don't count towards the saving."),
 ("Is the English Heritage Overseas Visitor Pass worth it?", "If Stonehenge is on your list plus a castle or two, often yes. For visits from 25 March 2026 to 16 March 2027 the family pass is £116 for 9 days or £127 for 16 days (two adults and up to four children under 18 at the same address). English Heritage says it starts saving money after two or three sites."),
 ("Should we rent a car in London?", "We wouldn't. Public transport is good, parking is expensive, and driving into central London during charging hours costs £18 a day for the Congestion Charge on top of any ULEZ charge. Pick up a car on the way out of London, or at Heathrow, for the Bath, Cotswolds or York part of the trip."),
 ("Do kids need car seats in England?", "Yes. UK law says children must use a car seat until they're 12 years old or 135 cm tall, whichever comes first. Rental companies can add one, but numbers are limited, so request it when you book or bring your own."),
]
def build_england():
    path = "/travel/england/"
    cr, crld = crumbs([("Travel", "/travel/"), ("England & London with kids guide", path)])
    img = "/assets/travel/family-travel-kids-planner/1.jpg"
    page = head(path, "London & England with Kids: Family Trip Planning Guide, Routes & Costs (2026) | Dark Lighthouse Solutions",
                "Planning London and England with kids? The UK ETA, free Tube travel for under-11s, free museums, the London Pass, English Heritage and Historic Royal Palaces, plus Bath, the Cotswolds, York and the Lake District.",
                img, [article("London and England with kids: routes, costs, passes and what to book when", path, img), faq_ld(EN_FAQ), crld], "/travel/england/")
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>London and England with kids: routes, costs, passes and what to book when</h1>
    <p class="lede">A family trip built around London, with easy ways to add Bath, the Cotswolds, York or the Lake District. What the Tube costs with kids (often nothing), which passes are worth it, and what to book first. Facts checked October 2026, with sources at the end.</p>
  </header>
  <main class="wrap copy">
{DISCLOSE}
    <h2 id="before">1. Before you book anything: the UK ETA</h2>
{ETA_HTML}
    <h2 id="when">2. When to go</h2>
    <p>England is mild most of the year and it can rain in any month, so plan for it rather than around it. Late spring and early autumn are our pick with kids: long-ish days, fewer crowds and lower prices than high summer. July and August are the school summer holidays, so London's big attractions are at their busiest and rooms cost more. Winter days are short but London is still easy, because so much of it is indoors.</p>
    <div class="tablewrap"><table><thead><tr><th>Month</th><th>Daylight in London</th><th>Daylight in York</th></tr></thead><tbody>{daylight_rows(EN_DAY)}</tbody></table></div>
    <p class="muted">Sunrise to sunset on the 15th of each month, calculated for London and York and rounded to 5 minutes.</p>

    <h2 id="london">3. London with kids: getting around and what's free</h2>
    <ul>
      <li><strong>Kids under 11 ride free.</strong> Under-11s travel free on London buses and trams. On the Tube, DLR, London Overground and the Elizabeth line, up to four children aged 5 to 10 travel free with a paying adult, and under-5s are always free.</li>
      <li><strong>Adults just tap a contactless card or phone.</strong> Pay-as-you-go fares are capped each day: £8.90 for travel within zones 1 and 2 (most of central London). Use the same card or phone for every journey so the cap works.</li>
      <li><strong>Kids aged 11 to 15</strong> pay the adult fare unless you get them a Visitor Oyster card and ask staff at a Tube station to add a Young Visitor discount (half the adult pay-as-you-go rate, for up to 14 days). The child has to be there when it's added.</li>
      <li><strong>The big museums are free.</strong> The Natural History Museum and the Science Museum have free general admission. Book the free timed tickets online, especially for weekends and school holidays, or you may queue.</li>
      <li><strong>Don't drive in central London.</strong> The Congestion Charge is £18 a day (if paid on the day or in advance) from 7am to 6pm on weekdays and noon to 6pm at weekends and on bank holidays, and the ULEZ charge applies on top if a car doesn't meet the emission standards.</li>
    </ul>
    <p>Buses are the cheapest sightseeing tour going: sit upstairs at the front. And build in a park every day or two, because jet-lagged kids need somewhere to run.</p>

    <h2 id="driving">4. Beyond London: drive times and car hire</h2>
    <p>For Bath, the Cotswolds, York and the Lake District, a car gives you the most freedom, especially for Cotswold villages and the lakes. Trains are great for London to York or Bath. These are mapped times with no stops, plus a "realistic" column with 40% added for traffic, toilets and snack stops.</p>
    <div class="tablewrap"><table><thead><tr><th>Drive</th><th>Miles</th><th>Mapped time</th><th>Realistic (+40%)</th></tr></thead><tbody>{leg_rows(EN_LEGS)}</tbody></table></div>
    <p class="muted">Mapped times: OpenStreetMap road data via the OSRM router, by car, looked up October 2026. Motorways around London are often slower than this.</p>
    <p>You drive on the left, and children need a car seat until they're 12 or 135 cm tall. Automatics are less common than manuals in the UK, so book early and request the seats when you reserve. Pick the car up on your way out of London (Heathrow works well) rather than in the centre.</p>
    <p id="car-insurance">{CARD_UK.format(where="England")} Comparison sites like {aff("discovercars-london", "Discover Cars")} show what's available at Heathrow and the other London airports.</p>
    <p>Taking the train instead? A <strong>Family &amp; Friends Railcard</strong> costs £35 for a year and gives 1/3 off adult fares and 60% off kids' fares (ages 5 to 15) when at least one named adult travels with a child. Book long-distance trains early for the cheapest Advance fares.</p>

    <h2 id="routes">5. Sample routes</h2>
    <h3>7 nights: London, with one day out</h3>
    <p>London (7 nights in one place, no packing and unpacking). Spend most days in the city, and take one day trip by train or tour to Windsor, or Stonehenge and Bath. It's the easiest first trip with small kids.</p>
    {slot("stay", "7-night route: London")}
    <h3>10 nights: London, Bath and the Cotswolds</h3>
    <p>London (5 nights) → pick up a car at Heathrow and stop at Stonehenge on the way to Bath (2 nights: the Roman Baths and a walk by the river) → the Cotswolds (2 nights in a village like Bourton-on-the-Water) → back to Heathrow for the flight (1 night nearby if it's an early one).</p>
    {slot("stay", "10-night route: London, Bath, Cotswolds")}
    <h3>14 nights: add York and the Lake District</h3>
    <p>London (5) → Bath (2) → the Cotswolds (2) → York (2: the city walls, the Minster and the railway museum) → the Lake District (2, around Windermere) → fly home from Manchester (1 night nearby). The Cotswolds to York is the longest day, so stop on the way, or take the train from London to York and pick up a car there instead.</p>
    {slot("stay", "14-night route: London, Bath, Cotswolds, York, Lake District")}
    <p>Rather not drive at all? Day tours from London to Windsor, Stonehenge and Bath are listed on {aff("klook-london", "Klook")}. With young kids, check how many hours you're actually on the coach.</p>

    <h2 id="costs">6. What things cost (and which passes are worth it)</h2>
    <p>Flights, rooms and the car will be most of your budget, and they depend so much on dates that we won't guess at them. Get real quotes. Some fixed costs and passes worth knowing:</p>
    <ul>
      <li><strong>Tower of London (Historic Royal Palaces):</strong> £38 per adult and £19 per child aged 5 to 15 without the optional donation, and under-5s are free. Historic Royal Palaces membership (from £65 a year) gets you into the Tower and its other palaces, like Hampton Court and Kensington Palace, as often as you like, so it's worth pricing if you'll visit two or more. {aff("tiqets-tower-of-london", "Tiqets also sells Tower of London tickets")}, so compare with the official site.</li>
      <li><strong>The London Pass:</strong> one pass for a set number of days that covers many paid attractions and a hop-on hop-off bus. It's worth it only if you'll fit in several of the paid sights each day. List the ones you'd actually visit, add up their ticket prices and compare. You can check the current prices and what's included on {aff("gocity-london", "Go City's London Pass page")}.</li>
      <li><strong>English Heritage Overseas Visitor Pass:</strong> entry to over 100 English Heritage sites, including Stonehenge. For visits from 25 March 2026 to 16 March 2027 the family pass is £116 for 9 days or £127 for 16 days (two adults and up to four children under 18 living at the same address). Buy it online, then collect it at the first staffed site with your confirmation, passport and the card you paid with.</li>
      <li><strong>Roman Baths, Bath:</strong> prices change by season and day of the week. For September and October 2026, a family ticket (2 adults and 2 to 4 children) booked in advance is £69 on weekdays and £77 at weekends, and on-the-day tickets cost more.</li>
      <li><strong>UK ETA:</strong> £20 per person (fixed fee).</li>
      <li><strong>Congestion Charge:</strong> £18 a day if you drive into central London during charging hours. Easiest to avoid.</li>
      <li><strong>Phone data:</strong> check your plan's roaming charges, or use a travel eSIM such as {aff("airalo-uk", "Airalo's UK eSIM")}.</li>
    </ul>
    <p><span class="est">Estimate</span> To get your own number, plug real quotes into the free <a href="/travel/tools/travel-budget-calculator/">travel budget calculator</a> (it also tells you what to save per paycheck), and use the <a href="/travel/tools/daily-travel-budget-calculator/">daily budget calculator</a> for spending money per day in pounds and dollars.</p>

    <h2 id="packing">7. Packing for England</h2>
    <ul>
      <li><strong>Layers and a light waterproof jacket for everyone</strong>, even in summer. A small umbrella is handy in London.</li>
      <li><strong>Comfortable shoes.</strong> London days involve a lot more walking (and stairs at Tube stations) than you'd guess. A light, foldable stroller beats a big one on the Tube.</li>
      <li><strong>A contactless card or phone</strong> with no foreign transaction fees, for the Tube and buses.</li>
      <li><strong>Plug adapters:</strong> the UK uses the three-pin plug (type G).</li>
    </ul>
{packbox("London and England", [("babylist-stokke-yoyo3", "Stokke YOYO³ stroller", "a small fold for the Tube, buses and plane cabins"), ("target-trunki", "Trunki Ride-On Suitcase", "kids ride it through the airport"), ("peakdesign-packing-cube", "Peak Design Packing Cubes", "one per person keeps a shared case sane"), ("bellroy-travel-wallet", "Bellroy Travel Wallet", "all the family's passports in one place"), ("bespokepost-sidecar-toiletry-kit", "Halfday Sidecar Toiletry Kit (Bespoke Post)", "hangs up in small hotel bathrooms, with a liquids pouch for security")], "London means lots of walking, stairs and public transport, so pack light.")}
    <h2 id="kids">8. Tips for London and England with kids</h2>
    <ul>
      <li><strong>One big thing a day</strong> in London, plus a park or playground. The city wears little legs out fast.</li>
      <li><strong>Book timed tickets early</strong> for the busiest places in school holidays, including the free museums.</li>
      <li><strong>Stay near a Tube station</strong> on a line that reaches the places you'll go most. It saves more time than a slightly cheaper room further out.</li>
      <li><strong>Jet lag:</strong> London is usually 5 hours ahead of US Eastern time. Get outside in daylight on day one and keep the first day light.</li>
      <li><strong>Outside London,</strong> keep most driving days under two to three hours of mapped time, and stay two nights or more in each place.</li>
    </ul>

    <h2 id="timeline">9. What to book when</h2>
    <ul>
      <li><strong>6 to 9 months out:</strong> rooms in London for school holidays, and Cotswold cottages for summer. Check {aff("booking-london", "Booking.com")} or book direct.</li>
      <li><strong>4 to 6 months out:</strong> flights and the rental car (especially an automatic).</li>
      <li><strong>2 to 3 months out:</strong> long-distance train tickets as soon as Advance fares open, and timed tickets for the Tower of London and other paid sights.{slot("tour", "timeline: tours and tickets")}</li>
      <li><strong>2 to 4 weeks out:</strong> free museum tickets for your dates, and the English Heritage pass if you're getting one.</li>
      <li><strong>Once flights are booked:</strong> the ETA for everyone, a passport check, and travel insurance.{slot("insurance", "timeline")}</li>
      <li><strong>The week before:</strong> download the TfL Go app and offline maps, install the eSIM, and print the emergency info.</li>
    </ul>
{cta(["trip-planner-travel-budget", "family-travel-kids-planner"], "Plan it in one sheet", "The Trip Planner & Travel Budget handles costs in pounds and dollars and works out what to save each paycheck. The Family Travel with Kids Planner checks passports against your return date and has a jet-lag plan and packing lists by age.")}
{FREE}
{faq_html(EN_FAQ)}
    <h2 id="sources">Sources</h2>
    <ul class="src">
      <li><a href="https://www.gov.uk/eta">UK ETA: who needs one, £20 fee, apply 3 working days ahead (GOV.UK)</a></li>
      <li><a href="https://www.gov.uk/eta/when-not-need-eta">When you do not need an ETA: British and Irish citizens (GOV.UK)</a></li>
      <li><a href="https://tfl.gov.uk/travel-information/visiting-london/visitor-oyster-card">Visitor Oyster card and travelling with children (Transport for London)</a></li>
      <li><a href="https://tfl.gov.uk/fares/find-fares/caps-and-travelcard-prices">Children aged 5 to 10 travel free, up to four per adult (Transport for London)</a></li>
      <li><a href="https://content.tfl.gov.uk/adult-fares.pdf">Pay as you go daily caps: zones 1-2 £8.90 (Transport for London)</a></li>
      <li><a href="https://tfl.gov.uk/modes/driving/congestion-charge">Congestion Charge: £18 a day, charging hours, ULEZ (Transport for London)</a></li>
      <li><a href="https://www.nhm.ac.uk/visit.html">Natural History Museum: free entry, book a free ticket (Natural History Museum)</a></li>
      <li><a href="https://www.sciencemuseum.org.uk/visit">Science Museum: free entry, book a free ticket (Science Museum)</a></li>
      <li><a href="https://www.hrp.org.uk/tower-of-london/visit/tickets-and-prices/">Tower of London tickets and prices; membership from £65 (Historic Royal Palaces)</a></li>
      <li><a href="https://www.english-heritage.org.uk/visit/overseas-visitors">Overseas Visitor Pass prices, 25 March 2026 to 16 March 2027 (English Heritage)</a></li>
      <li><a href="https://www.romanbaths.co.uk/tickets/2026-09-september">Roman Baths tickets, September and October 2026 (Roman Baths)</a></li>
      <li><a href="https://www.railcard.co.uk/family-and-friends-railcard/">Family &amp; Friends Railcard: £35, 1/3 off adults, 60% off kids (Railcards)</a></li>
      <li><a href="https://www.gov.uk/child-car-seats-the-rules">Child car seat rules: until 12 years or 135 cm (GOV.UK)</a></li>
{CARD_SRC}      <li><a href="https://travel.state.gov/en/passports/apply/child/under-16.html">US passports for children under 16 (U.S. Department of State)</a></li>
      <li><a href="https://project-osrm.org/">Drive distances and times: OpenStreetMap data via OSRM</a></li>
    </ul>
    <p class="muted">Prices, rules and card benefits change. Check the official pages and your own card's guide to benefits before you book. Last checked 22 October 2026.</p>
  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

# ---------------------------------------------------------------- Wales guide
WA_LEGS = [("London", "Cardiff", 150, 187), ("Heathrow Airport", "Cardiff", 137, 158), ("Cardiff", "Brecon", 42, 61), ("Cardiff", "Tenby", 94, 117),
           ("Tenby", "St Davids", 35, 58), ("Tenby", "Brecon", 75, 108), ("St Davids", "Aberystwyth", 76, 115), ("Aberystwyth", "Betws-y-Coed", 68, 106), ("Betws-y-Coed", "Llanberis", 16, 28),
           ("Llanberis", "Caernarfon", 8, 17), ("Caernarfon", "Conwy", 24, 34), ("Conwy", "Manchester Airport", 79, 107)]
WA_DAY = [("January", "8h 20m", "8h 05m"), ("April", "13h 50m", "14h 00m"), ("June", "16h 35m", "16h 55m"), ("August", "14h 35m", "14h 45m"),
          ("October", "10h 40m", "10h 35m"), ("December", "7h 50m", "7h 35m")]
WA_FAQ = [
 ("Do US citizens need anything to visit Wales?", "Yes: a UK Electronic Travel Authorisation (ETA), because Wales is part of the UK. It costs £20 per person, every traveler needs their own, babies and children included, and the UK government says to apply at least 3 working days before you travel. Apply on GOV.UK or the official UK ETA app."),
 ("Is the speed limit really 20 mph in Wales?", "On most roads in towns and villages, yes. Since 17 September 2023 the default limit on 'restricted roads' (usually streets with street lights) has been 20 mph. Some main roads stay at 30 mph, so follow the signs, and if there's no sign on a lit street, assume 20."),
 ("Is the Cadw Explorer Pass worth it?", "If you'll visit three or more Cadw castles, usually yes. From 1 April 2026 the family pass (two adults and up to three children or grandchildren under 18) is £67.20 for 3 days of use within 7, or £78.50 for 7 days within 14. Caernarfon Castle alone is £14.90 per adult, for comparison."),
 ("Can kids get up Yr Wyddfa (Snowdon) without the hike?", "Yes, on the Snowdon Mountain Railway from Llanberis. For 2026, a return to the summit on the traditional diesel train is £45 off-peak or £48 peak for adults and £35 or £38 for children aged 3 to 15. Book ahead in summer, and know that bad weather can stop trains short of the summit."),
 ("Is there a tourist tax in Wales?", "Not yet. Welsh councils can charge a visitor levy on overnight stays from 1 April 2027: £1.30 per person per night in most accommodation, or 75p in campsites and hostel-style shared rooms. Cardiff has approved one. Other councils decide for themselves, and Pembrokeshire has ruled it out until at least its 2027 elections."),
 ("Do kids need car seats in Wales?", "Yes. UK law says children must use a car seat until they're 12 years old or 135 cm tall, whichever comes first. Request seats when you book the car, or bring your own."),
]
def build_wales():
    path = "/travel/wales/"
    cr, crld = crumbs([("Travel", "/travel/"), ("Wales with kids guide", path)])
    img = "/assets/travel/family-travel-kids-planner/1.jpg"
    page = head(path, "Wales with Kids: Family Trip Planning Guide to Eryri, Castles, Pembrokeshire & Cardiff (2026) | Dark Lighthouse Solutions",
                "Planning Wales with kids? The UK ETA, the 20 mph default speed limit, real drive times, 7 and 10-night routes through Cardiff, Pembrokeshire and Eryri (Snowdonia), the Cadw Explorer Pass and the Snowdon railway.",
                img, [article("Wales with kids: Eryri, castles, Pembrokeshire and Cardiff, with routes, costs and what to book when", path, img), faq_ld(WA_FAQ), crld], "/travel/wales/")
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>Wales with kids: Eryri, castles, Pembrokeshire and Cardiff</h1>
    <p class="lede">Castles you can actually climb, beaches, mountains with a train to the top, and drives that are shorter than they are in Scotland. Here's how to plan it with kids: routes, real drive times, the passes worth buying and what to book first. Facts checked October 2026, with sources at the end.</p>
  </header>
  <main class="wrap copy">
{DISCLOSE}
    <h2 id="before">1. Before you book anything: the UK ETA</h2>
{ETA_HTML}
    <h2 id="when">2. When to go</h2>
    <p>Wales is mild and can be wet in any month, and the mountains of Eryri make their own weather. Late May, June and September are our pick with kids: long days, warmer sea for paddling, and fewer people than in the school summer holidays in July and August. Winter is quiet and cheap, but days are short and some attractions close or cut their hours.</p>
    <div class="tablewrap"><table><thead><tr><th>Month</th><th>Daylight in Cardiff</th><th>Daylight in Caernarfon</th></tr></thead><tbody>{daylight_rows(WA_DAY)}</tbody></table></div>
    <p class="muted">Sunrise to sunset on the 15th of each month, calculated for Cardiff and Caernarfon and rounded to 5 minutes.</p>

    <h2 id="places">3. Where to go: the four big areas</h2>
    <ul>
      <li><strong>Eryri (Snowdonia):</strong> mountains, lakes and waterfalls in the north-west, around Betws-y-Coed and Llanberis. Yr Wyddfa (Snowdon) is the highest mountain in Wales, and the Snowdon Mountain Railway takes you to the top from Llanberis if little legs won't make the hike.</li>
      <li><strong>The castles of north Wales:</strong> Caernarfon, Conwy, Harlech and Beaumaris were built for Edward I and together are a UNESCO World Heritage Site. They're run by Cadw, the Welsh Government's historic environment service, and kids love the walls and towers.</li>
      <li><strong>Pembrokeshire:</strong> the coast national park in the south-west, with sandy beaches, rock pools, boat trips and the coast path. Tenby is a good family base, with St Davids a short drive away.</li>
      <li><strong>Cardiff:</strong> an easy first or last stop, with Cardiff Castle in the city centre and St Fagans National Museum of History (free entry, with old buildings from across Wales rebuilt in parkland) just outside it.</li>
    </ul>

    <h2 id="driving">4. Driving in Wales: 20 mph and real drive times</h2>
    <p>A car is the easiest way to see Wales with kids. You drive on the left, road signs are in Welsh and English, and many country lanes are narrow with high hedges. One thing catches visitors out: since 17 September 2023, the <strong>default speed limit on most roads in towns and villages is 20 mph</strong>. Some main roads stay at 30, so watch the signs. These are mapped times with no stops, plus a "realistic" column with 40% added for slow lanes, tractors and toilet stops.</p>
    <div class="tablewrap"><table><thead><tr><th>Drive</th><th>Miles</th><th>Mapped time</th><th>Realistic (+40%)</th></tr></thead><tbody>{leg_rows(WA_LEGS)}</tbody></table></div>
    <p class="muted">Mapped times: OpenStreetMap road data via the OSRM router, by car, looked up October 2026.</p>
    <p>Children need a car seat until they're 12 or 135 cm tall. Automatics are less common than manuals in the UK, so book early and request the seats when you reserve. Flying into London? Heathrow to Cardiff is under three hours' mapped drive, and Manchester Airport is the closest big airport to Eryri and the north Wales castles.</p>
    <p id="car-insurance">{CARD_UK.format(where="Wales")} Comparison sites like {aff("discovercars-cardiff", "Discover Cars")} show what's available in Cardiff and at the airports.</p>

    <h2 id="routes">5. Two sample routes</h2>
    <h3>7 nights: Cardiff, Pembrokeshire and the Brecon Beacons (Bannau Brycheiniog)</h3>
    <p>Cardiff (2 nights: the castle and St Fagans) → Tenby (3 nights: beaches, boat trips and a day out to St Davids) → Brecon (2 nights: waterfalls and easy walks in the Brecon Beacons) → back to Cardiff or on to Heathrow. All the drives are under two hours' mapped time.</p>
    {slot("stay", "7-night route: Cardiff, Tenby, Brecon")}
    <h3>10 nights: the whole country, south to north</h3>
    <p>Cardiff (2) → Tenby (3) → Aberystwyth (1, to break up the drive up the coast) → Betws-y-Coed or Llanberis in Eryri (2: the Snowdon railway and the lakes) → Conwy (2: Conwy and Caernarfon castles, and a day trip to Beaumaris on Anglesey) → fly home from Manchester. The St Davids to Aberystwyth and Aberystwyth to Eryri days are the longest, so plan a stop on each.</p>
    {slot("stay", "10-night route: Cardiff, Tenby, Aberystwyth, Eryri, Conwy")}
    <p>Short on time and based in London? Guided day trips from London to north Wales, including Caernarfon and Eryri, are on {aff("klook-north-wales-rail", "Klook")}, and guided tours around Wales are listed on {aff("gyg-wales", "GetYourGuide")}. Check how long the day really is before booking with young kids.</p>

    <h2 id="costs">6. What things cost (and the Cadw pass)</h2>
    <p>Flights, rooms and the car will be most of your budget, and they depend so much on dates that we won't guess at them. Get real quotes. Some fixed costs worth knowing:</p>
    <ul>
      <li><strong>Cadw Explorer Pass:</strong> entry to dozens of Cadw sites, including Caernarfon, Conwy, Harlech and Beaumaris. From 1 April 2026 the family pass (two adults and up to three children or grandchildren under 18) is £67.20 for any 3 days within 7, or £78.50 for any 7 days within 14. Single adult passes are £28 and £42. You buy it at Cadw sites.</li>
      <li><strong>Caernarfon Castle</strong> on its own: £14.90 per adult (1 September 2026 to 31 March 2027), so the pass pays off fast if you're doing several castles.</li>
      <li><strong>Cardiff Castle</strong> (run by the city, not Cadw, so not on the pass): £16.50 per adult, £11 per child aged 5 to 16, and £44 for a family ticket of 2 adults and 2 children. Under-5s are free.</li>
      <li><strong>Snowdon Mountain Railway:</strong> for 2026, a summit return on the traditional diesel train is £45 off-peak or £48 peak for adults, and £35 or £38 for children aged 3 to 15. The heritage steam train costs more.</li>
      <li><strong>St Fagans National Museum of History:</strong> free entry, with a parking charge.</li>
      <li><strong>Visitor levy:</strong> nothing yet. From 1 April 2027 Welsh councils can add £1.30 per person per night (75p in campsites and hostel-style shared rooms). Cardiff has approved it. Pembrokeshire has ruled it out until at least its 2027 elections.</li>
      <li><strong>UK ETA:</strong> £20 per person (fixed fee).</li>
      <li><strong>Phone data:</strong> check your plan's roaming charges, or use a travel eSIM such as {aff("airalo-uk", "Airalo's UK eSIM")}. Signal is patchy in the mountains, so download offline maps too.</li>
      <li><strong>Things to do in Cardiff:</strong> {aff("tiqets-cardiff", "Tiqets lists Cardiff-area attractions")} if you want to book ahead.</li>
    </ul>
    <p><span class="est">Estimate</span> To get your own number, plug real quotes into the free <a href="/travel/tools/travel-budget-calculator/">travel budget calculator</a> (it also tells you what to save per paycheck), and use the <a href="/travel/tools/daily-travel-budget-calculator/">daily budget calculator</a> for spending money per day in pounds and dollars.</p>

    <h2 id="packing">7. Packing for Wales</h2>
    <ul>
      <li><strong>Waterproof jackets and layers for everyone</strong>, even in summer. It's colder and windier at the top of Yr Wyddfa than in Llanberis.</li>
      <li><strong>Proper shoes:</strong> walking shoes or boots for paths and castle steps, plus water shoes or old trainers for rock pools.</li>
      <li><strong>Swimsuits and a towel in the car</strong> for Pembrokeshire beaches. The sea is cold, so a wetsuit helps if kids want to stay in.</li>
      <li><strong>Plug adapters:</strong> the UK uses the three-pin plug (type G).</li>
    </ul>
{packbox("Wales", [("patagonia-torrentshell-womens", "Patagonia Torrentshell 3L Rain Jacket", "packable waterproof with pit zips for mountain walks"), ("zappos-merrell-moab-3-wp", "Merrell Moab 3 Waterproof (Zappos)", "waterproof walking shoes for paths and castle steps"), ("llbean-discovery-rain-jacket", "L.L.Bean Infants' and Toddlers' Discovery Rain Jacket", "for the littlest walkers"), ("saxx-quest-boxer-brief", "SAXX Quest Quick-Dry Boxer Brief", "pack fewer pairs: it dries overnight")], "Wales can be wet in any month, and Eryri makes its own weather.")}
    <h2 id="kids">8. Tips for Wales with kids</h2>
    <ul>
      <li><strong>Castles are the stars.</strong> Let kids climb the towers and walk the walls, but hold small hands on the battlements and spiral stairs.</li>
      <li><strong>Check the summit forecast</strong> before the Snowdon railway or any mountain walk, and have a plan B (a waterfall walk or a castle) for cloudy days.</li>
      <li><strong>Learn a few Welsh words.</strong> You'll see them on every sign: <em>croeso</em> (welcome), <em>diolch</em> (thank you), <em>araf</em> (slow).</li>
      <li><strong>Base yourself for two nights or more</strong> so there are days when you don't pack the car.</li>
      <li><strong>Jet lag:</strong> Wales is usually 5 hours ahead of US Eastern time. Get outside in daylight on day one and keep the first day light.</li>
    </ul>

    <h2 id="timeline">9. What to book when</h2>
    <ul>
      <li><strong>6 to 9 months out:</strong> summer rooms and cottages in Tenby, Pembrokeshire and Eryri. Check {aff("booking-pembrokeshire", "Booking.com")} or local cottage sites.</li>
      <li><strong>4 to 6 months out:</strong> flights and the rental car (especially an automatic).</li>
      <li><strong>1 to 2 months out:</strong> Snowdon Mountain Railway tickets for summer, boat trips and any tours.{slot("tour", "timeline: tours and tickets")}</li>
      <li><strong>Once flights are booked:</strong> the ETA for everyone, a passport check, and travel insurance.{slot("insurance", "timeline")}</li>
      <li><strong>The week before:</strong> offline maps, the eSIM installed, and your card's proof of rental car cover.</li>
    </ul>
{cta(["trip-planner-travel-budget", "family-travel-kids-planner"], "Plan it in one sheet", "The Trip Planner & Travel Budget handles costs in pounds and dollars and works out what to save each paycheck. The Family Travel with Kids Planner checks passports against your return date and has a jet-lag plan and packing lists by age.")}
{FREE}
{faq_html(WA_FAQ)}
    <h2 id="sources">Sources</h2>
    <ul class="src">
      <li><a href="https://www.gov.uk/eta">UK ETA: who needs one, £20 fee, apply 3 working days ahead (GOV.UK)</a></li>
      <li><a href="https://www.gov.wales/introducing-default-20mph-speed-limits">Default 20 mph speed limits (Welsh Government)</a></li>
      <li><a href="https://www.gov.wales/introducing-20mph-speed-limits-frequently-asked-questions">20 mph: frequently asked questions (Welsh Government)</a></li>
      <li><a href="https://cadw.gov.wales/visit/places-to-visit/admissions/explorer-pass-3-7-day">Cadw Explorer Pass prices from 1 April 2026 (Cadw)</a></li>
      <li><a href="https://cadw.gov.wales/visit/places-to-visit/castell-caernarfon">Castell Caernarfon prices (Cadw)</a></li>
      <li><a href="https://whc.unesco.org/en/list/374/">Castles and Town Walls of King Edward in Gwynedd (UNESCO)</a></li>
      <li><a href="https://www.cardiffcastle.com/visit/tickets/">Cardiff Castle admission rates (Cardiff Castle)</a></li>
      <li><a href="https://snowdonrailway.co.uk/plan-your-visit/">Snowdon Mountain Railway 2026 fares (Snowdon Mountain Railway)</a></li>
      <li><a href="https://museum.wales/stfagans/visit/">St Fagans National Museum of History: free entry, parking (Museum Wales)</a></li>
      <li><a href="https://www.cardiffnewsroom.co.uk/releases/c25/37008.html">Cardiff visitor levy from April 2027: £1.30 and 75p rates (Cardiff Council)</a></li>
      <li><a href="https://pembrokeshire-herald.com/110238/pembrokeshire-rules-out-visitor-levy-for-next-two-years/">Pembrokeshire rules out a visitor levy for now (Pembrokeshire Herald)</a></li>
      <li><a href="https://www.gov.uk/child-car-seats-the-rules">Child car seat rules: until 12 years or 135 cm (GOV.UK)</a></li>
{CARD_SRC}      <li><a href="https://travel.state.gov/en/passports/apply/child/under-16.html">US passports for children under 16 (U.S. Department of State)</a></li>
      <li><a href="https://project-osrm.org/">Drive distances and times: OpenStreetMap data via OSRM</a></li>
    </ul>
    <p class="muted">Prices, rules and card benefits change. Check the official pages and your own card's guide to benefits before you book. Last checked 22 October 2026.</p>
  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

# ---------------------------------------------------------------- packing & gear (retail affiliate links)
# Product facts were checked on the brands' or retailers' own pages on 22 October 2026 (sources listed on each page).
# Every product link goes through aff(): plain URL + data-affiliate key + rel="sponsored nofollow noopener". Keys live in AFF_SLOT and travel/affiliates.json.
GEAR_DISCLOSE = '    <p class="disclose" id="affiliate-disclosure">Some links on this page are affiliate links. If you book or buy through them we may earn a commission at no extra cost to you. <a href="/privacy/#affiliate-links">How affiliate links work</a>.</p>\n'
GEAR_KEYS = ["patagonia-torrentshell-kids", "patagonia-torrentshell-womens", "columbia-glennaker-kids", "columbia-watertight-mens",
             "llbean-discovery-rain-jacket", "smartwool-classic-thermal-crew", "saxx-quest-boxer-brief", "huckberry-proof-merino-tee",
             "darntough-kids-light-hiker", "hunter-kids-first-classic", "zappos-merrell-moab-3-wp", "orvis-barbour-bedale",
             "orvis-barbour-beadnell", "doona-x", "babylist-stokke-yoyo3", "babylist-uppababy-minu-v3", "babylist-nuna-trvl-lx",
             "osprey-poco", "ridge-carry-on", "target-trunki", "peakdesign-packing-cube", "cotopaxi-allpa-35",
             "fjallraven-kanken-mini", "bellroy-travel-wallet",
             "mockingbird-travel-stroller", "mockingbird-single-to-double", "bespokepost-barbour-transport", "bespokepost-weekender",
             "bespokepost-weekender-xl", "bespokepost-sidecar-toiletry-kit"]
AFF_SLOT.update({k: "gear" for k in GEAR_KEYS})
SIERRA_URL = "https://www.sierra.com/s~kids-rain-coats/"  # no active affiliate program (checked 22 Oct 2026): plain link, not sponsored
GEAR_IMG = "/assets/travel/family-travel-kids-planner/1.jpg"
GEAR_PAGES = [("/travel/gear/what-to-wear-in-scotland/", "What to wear in Scotland, month by month", "Edinburgh's real monthly rain and temperatures, and what adults and kids actually need: waterproofs, layers, boots and socks."),
              ("/travel/gear/best-travel-stroller-europe/", "Best travel strollers for Europe", "Doona X, Stokke YOYO³, UPPAbaby Minu V3, Nuna TRVL lx and the new Mockingbird Travel Stroller compared for cobbles, trains, ferries and plane cabins, plus a carrier for the hills."),
              ("/travel/gear/best-carry-on-luggage-family-travel/", "Carry-on luggage for family travel", "Cabin bag limits for US airlines, Ryanair, easyJet, British Airways and Aer Lingus, then the suitcases, weekend bags, kids' ride-on cases and packing cubes that fit them.")]

def c2f(c): return round(c * 9 / 5 + 32)
def mm2in(mm): return f"{mm / 25.4:.1f}"
def gear_related(skip):
    return '    <h2 id="more-gear">More packing guides</h2>\n    <div class="related">' + "".join(
        f'<a href="{p}">{e(t)}</a>' for p, t, _ in GEAR_PAGES if p != skip) + '<a href="/travel/gear/">All packing &amp; gear</a><a href="/travel/scotland/">Scotland guide</a><a href="/travel/ireland/">Ireland guide</a></div>\n'
def prod(key, name, facts, why):
    return f'''      <div class="prod" id="p-{key}">
        <h3>{aff(key, e(name))}</h3>
        <p class="facts">{facts}</p>
        <p>{why}</p>
      </div>
'''
def gear_head(path, title, desc, headline, faq, crumb_name, extra_ld=()):
    cr, crld = crumbs([("Travel", "/travel/"), ("Packing & gear", "/travel/gear/"), (crumb_name, path)] if path != "/travel/gear/" else [("Travel", "/travel/"), ("Packing & gear", path)])
    page = head(path, title, desc, GEAR_IMG, [article(headline, path, GEAR_IMG), faq_ld(faq), crld, *extra_ld], "/travel/gear/")
    return page, cr

def packbox(where, keys_text, guide_note):
    """Short 'What to pack' box for the country guides: links to the gear pages and to 3-5 products."""
    items = "".join(f"<li>{aff(k, t)}{': ' + n if n else ''}</li>" for k, t, n in keys_text)
    return f'''    <aside class="packbox" id="what-to-pack">
      <h3>What to pack for {where}</h3>
      <p>{guide_note} Our packing guides go deeper: <a href="/travel/gear/what-to-wear-in-scotland/">what to wear, month by month</a>, <a href="/travel/gear/best-travel-stroller-europe/">travel strollers for cobbles and trains</a> and <a href="/travel/gear/best-carry-on-luggage-family-travel/">carry-on bags that fit the airlines' limits</a>.</p>
      <ul>{items}</ul>
      <p class="muted">Product links are affiliate links (see the note at the top of the page). Prices change, so check the retailer.</p>
    </aside>
'''

# Met Office 1991-2020 averages, Edinburgh Royal Botanic Garden No 2: (month, max °C, min °C, rain mm, days with >=1 mm rain, adults, kids)
SCOT_CLIMATE = [
 ("Jan", 7.29, 1.67, 64.66, 12.43, "Warm waterproof coat or shell over a fleece, hat and gloves, waterproof boots.", "Insulated waterproof jacket, thermal base layer, hat, mittens, wellies with warm socks."),
 ("Feb", 7.96, 1.72, 53.05, 9.83, "Same as January: frosty mornings are common.", "Base layer, fleece, waterproof shell; spare gloves, because they will get wet."),
 ("Mar", 9.71, 2.93, 48.48, 9.83, "Waterproof shell, a warm mid layer, hat for the wind.", "Waterproof jacket and trousers, fleece, wellies."),
 ("Apr", 12.15, 4.70, 40.76, 8.63, "Shell plus a light fleece; often the driest month in Edinburgh.", "Waterproof jacket, fleece, comfortable walking shoes plus wellies."),
 ("May", 14.91, 7.08, 47.60, 9.63, "Light waterproof, a fleece for evenings, sunglasses.", "Light waterproof, a warm layer, sun hat and suncream."),
 ("Jun", 17.43, 9.93, 66.21, 10.40, "T-shirt and light layers, packable rain jacket, midge repellent for the west.", "Layers, packable rain jacket, sun hat; midge repellent and a head net for the west."),
 ("Jul", 19.29, 11.60, 72.06, 11.47, "Warmest month but one of the wettest: packable waterproof every day.", "Packable waterproof, a fleece for evenings, quick-dry trousers rather than jeans."),
 ("Aug", 19.07, 11.51, 71.57, 10.37, "As July. Evenings cool off fast.", "As July. A spare outfit in the car for wet days."),
 ("Sep", 16.88, 9.65, 54.92, 9.93, "Light layers and a proper waterproof.", "Waterproof jacket, fleece, wellies for muddy walks."),
 ("Oct", 13.37, 6.72, 75.71, 11.73, "The wettest month in Edinburgh: waterproof jacket and waterproof shoes.", "Waterproof jacket and trousers, fleece, wellies, hat."),
 ("Nov", 9.86, 3.77, 65.25, 11.70, "Warm waterproof coat, hat, gloves.", "Thermal base layer, fleece, waterproof jacket and trousers, hat and gloves."),
 ("Dec", 7.34, 1.57, 67.43, 12.30, "Warm waterproof coat, layers, hat, gloves, waterproof boots.", "Insulated waterproof jacket, thermals, mittens, wellies; daylight is short."),
]
WEAR_FAQ = [
 ("Do I need a waterproof jacket in Scotland in summer?", "Yes. July and August are the warmest months in Edinburgh, with average highs around 19 °C (66 °F), but they're also among the wettest: about 72 mm of rain and 10 to 11 rainy days a month (1991–2020 Met Office averages). A light, packable waterproof for every person is the single most useful thing you can bring."),
 ("What should kids wear in Scotland?", "Layers. A thin base layer, a fleece and a waterproof jacket let you add or remove warmth as the day changes. Add waterproof trousers and wellies (rubber boots) for anything muddy, and pack a spare set of clothes in the car."),
 ("Is a waxed jacket like a Barbour good for Scotland?", "It's a classic for a reason: waxed cotton sheds rain and wind well. Retailers like Orvis describe most Barbour waxed jackets as weather-resistant rather than fully waterproof, and they're heavy to pack. For a heavy downpour or a hike, a modern waterproof shell is lighter and drier."),
 ("When is the driest time to visit Edinburgh?", "On the 1991–2020 Met Office averages, April is the driest month in Edinburgh (about 41 mm of rain over 8 to 9 rainy days), and October is the wettest (about 76 mm). It can rain in any month, so pack a waterproof whenever you go."),
 ("Should we bring wellies or hiking boots?", "For young kids, wellies: they're easy to get on and off and you can splash through anything. Adults doing real walks are better off in waterproof walking shoes or boots. For city days in Edinburgh, comfortable waterproof shoes are enough."),
]
def build_gear_wear():
    path = GEAR_PAGES[0][0]
    page, cr = gear_head(path, "What to Wear in Scotland, Month by Month, for Adults and Kids (2026) | Dark Lighthouse Solutions",
        "What to pack for Scotland in every month, using Met Office rain and temperature averages for Edinburgh: waterproofs, layers, wellies and socks for adults and kids.",
        "What to wear in Scotland, month by month, for adults and kids", WEAR_FAQ, "What to wear in Scotland")
    rows = "".join(f"<tr><td>{m}</td><td>{hi:.0f}°C / {c2f(hi)}°F</td><td>{lo:.0f}°C / {c2f(lo)}°F</td><td>{rain:.0f} mm ({mm2in(rain)} in)</td><td>{days:.0f}</td><td>{a}</td><td>{k}</td></tr>" for m, hi, lo, rain, days, a, k in SCOT_CLIMATE)
    page += f'''
  <header class="wrap hero">
{GEAR_DISCLOSE}    {cr}
    <h1>What to wear in Scotland, month by month</h1>
    <p class="lede">Scotland's weather changes fast, and it rains in every month. The trick isn't one big coat, it's layers you can add and peel off, and a waterproof for everyone. Here's what the numbers say and what we'd pack for adults and kids. Facts checked October 2026, with sources at the end.</p>
  </header>
  <main class="wrap copy">
    <h2 id="weather">Scotland's weather by month (Edinburgh)</h2>
    <p>These are the Met Office's 1991–2020 long-term averages for Edinburgh (Royal Botanic Garden). "Rainy days" means days with at least 1 mm of rain. Highlands and west-coast weather is often wetter and windier than Edinburgh, and the hills are colder, so if you're heading to Skye or Glencoe, pack for the wetter end.</p>
    <div class="tablewrap"><table><thead><tr><th>Month</th><th>Avg high</th><th>Avg low</th><th>Rain</th><th>Rainy days</th><th>Adults</th><th>Kids</th></tr></thead><tbody>{rows}</tbody></table></div>
    <p class="muted">Temperatures rounded to the nearest degree. Edinburgh averages about 9 to 10 days of air frost in each of December, January and February.</p>

    <h2 id="layers">The layering system that works</h2>
    <ul>
      <li><strong>Base layer:</strong> something that dries fast and doesn't smell after a day: merino wool or a synthetic. Skip cotton for walks; it stays wet.</li>
      <li><strong>Mid layer:</strong> a fleece or light insulated jacket.</li>
      <li><strong>Outer layer:</strong> a waterproof jacket with a hood. For kids, add waterproof trousers so they can sit on wet grass and splash in puddles.</li>
      <li><strong>Feet:</strong> waterproof shoes or boots, wool socks, and wellies for small kids.</li>
    </ul>

    <h2 id="kids">For the kids</h2>
{prod("patagonia-torrentshell-kids", "Patagonia Kids' Torrentshell 3L Rain Jacket", "Waterproof, breathable 3-layer shell, PFAS-free fabric and finish. Patagonia lists it at 230 g.", "A proper waterproof that packs small. Worth it if your kids will be outside a lot, and it lasts long enough to hand down.")}{prod("columbia-glennaker-kids", "Columbia Boys' Glennaker Rain Jacket", "Lightweight waterproof with a hood, elastic cuffs and reflective details; youth sizes XXS–XL.", "The budget pick for light rain and city days. Columbia makes a toddler version too.")}{prod("llbean-discovery-rain-jacket", "L.L.Bean Infants' and Toddlers' Discovery Rain Jacket", "Waterproof nylon with taped seams, reflective trim and underarm vents; sizes 2T–4T.", "For the littlest walkers: packable, and the reflective bits help on dark winter afternoons.")}{prod("hunter-kids-first-classic", "Hunter Kids First Classic Rain Boots", "Natural rubber, fully waterproof; US kids' sizes from 5C.", "Wellies are the one thing every Scottish kid owns. Easy on and off at the car, and puddles stop being a problem.")}{prod("darntough-kids-light-hiker", "Darn Tough Kids' Light Hiker Micro Crew Socks", "45% merino wool with cushioning underfoot; kids' shoe sizes 9–6.", "Wool socks stay warm when they get damp, which in wellies they will.")}
    <p>On a tighter budget? Sierra often has discounted kids' rain jackets from brands like Columbia: <a href="{SIERRA_URL}" rel="noopener" target="_blank">kids' rain coats at Sierra</a>. (That one isn't an affiliate link.)</p>

    <h2 id="adults">For the adults</h2>
{prod("patagonia-torrentshell-womens", "Patagonia Women's Torrentshell 3L Rain Jacket", "3-layer H2No waterproof shell with pit zips, PFAS-free; Patagonia lists it at 352 g. Men's version available.", "Our everyday pick: packs into its own pocket, and the pit zips stop you overheating on a climb up Arthur's Seat.")}{prod("columbia-watertight-mens", "Columbia Men's Watertight II Rain Jacket", "Packable 2-layer nylon shell with sealed seams and an adjustable hood.", "The good-value shell. Fine for city days and short walks.")}{prod("smartwool-classic-thermal-crew", "Smartwool Men's Classic Thermal Merino Base Layer Crew", "100% merino, 250 g/m² midweight. Women's version available.", "For November to March, or for anyone who feels the cold. Merino can be worn several days without smelling.")}{prod("saxx-quest-boxer-brief", "SAXX Quest Quick-Dry Mesh Boxer Brief", "Quick-dry micro-mesh designed for travel and sink washing.", "Wash it in the hotel sink at night and it's dry by morning, so you can pack fewer pairs.")}{prod("huckberry-proof-merino-tee", "Proof 72-Hour Merino T-Shirt (at Huckberry)", "Merino-nylon blend tee designed to be worn for days between washes.", "A travel tee that doesn't look like a hiking shirt, good under a fleece.")}{prod("zappos-merrell-moab-3-wp", "Merrell Moab 3 Waterproof (at Zappos)", "Waterproof walking shoe in men's and women's sizes.", "A comfortable waterproof walking shoe for castles, cobbles and wet trails. Zappos has free returns if the fit's wrong.")}
    <h3 id="barbour">The classic: a Barbour waxed jacket</h3>
    <p>If you want the jacket you'll see all over rural Scotland, it's a Barbour. Waxed cotton handles drizzle and wind well and looks better with age, though Orvis notes most Barbour waxed jackets are weather-resistant rather than fully waterproof, and they're heavier than a shell. It's more of a "buy once, wear for years" piece than packing gear. Barbour waxed jackets cost about $415 to $450 at US retailers when we checked on 22 October 2026.</p>
    <ul>
      <li>{aff("orvis-barbour-bedale", "Barbour Bedale Jacket (men's), at Orvis")}: the short, classic riding-style jacket in 6 oz waxed cotton, sizes 32–52; $415 when we checked. Orvis suggests ordering one size down from your sport coat size.</li>
      <li>{aff("orvis-barbour-beadnell", "Barbour Beadnell Waxed Cotton Jacket (women's), at Orvis")}: the women's classic.</li>
      <li>{aff("bespokepost-barbour-transport", "Barbour Transport Wax Jacket (men's), at Bespoke Post")}: 6 oz waxed cotton with a cord collar, tartan lining and an inner storm skirt, in a roomier, more modern cut; $425 when we checked. Bespoke Post calls it water-resistant, not waterproof.</li>
    </ul>

    <h2 id="checklist">A quick Scotland packing checklist</h2>
    <ul>
      <li>Waterproof jacket for every person (and waterproof trousers for kids)</li>
      <li>A fleece or warm mid layer each</li>
      <li>Quick-dry or merino base layers; fewer cotton T-shirts</li>
      <li>Waterproof shoes or boots, wellies for small kids, wool socks</li>
      <li>Hat and gloves outside summer; sun hat and suncream in summer</li>
      <li>Midge repellent and a head net (late May to September, west Highlands)</li>
      <li>UK plug adapters (type G)</li>
    </ul>
{FREE}
{faq_html(WEAR_FAQ)}
{gear_related(path)}
    <h2 id="sources">Sources</h2>
    <ul class="src">
      <li><a href="https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages/gcvwqumz6">Edinburgh Royal Botanic Garden No 2: 1991–2020 averages (Met Office)</a></li>
      <li><a href="https://www.patagonia.com/product/kids-torrentshell-3-layer-rain-jacket/64290.html">Kids' Torrentshell 3L: specs and weight (Patagonia)</a></li>
      <li><a href="https://www.patagonia.com/product/womens-torrentshell-3-layer-rain-jacket/85246.html">Women's Torrentshell 3L: specs and weight (Patagonia)</a></li>
      <li><a href="https://www.smartwool.com/en-us/products/mens-classic-thermal-merino-base-layer-crew-sw016349">Classic Thermal Merino Base Layer Crew (Smartwool)</a></li>
      <li><a href="https://darntough.com/products/kids-merino-wool-light-hiker-micro-crew-cushioned-lightweight-hiking-socks">Kids' Light Hiker Micro Crew (Darn Tough)</a></li>
      <li><a href="https://hunterboots.com/products/kids-first-classic-rain-boots-in-black-kft5094rma-hbl01">Kids First Classic Rain Boots (Hunter)</a></li>
      <li><a href="https://www.orvis.com/product/barbour-bedale-jacket/8977.html">Barbour Bedale Jacket: materials, sizes and price (Orvis)</a></li>
      <li><a href="https://www.orvis.com/barbour/barbour-for-men">Barbour waxed jackets: weather-resistant, care and re-waxing (Orvis)</a></li>
      <li><a href="https://www.bespokepost.com/store/barbour-transport-wax-jacket">Barbour Transport Wax Jacket: materials and price (Bespoke Post)</a></li>
    </ul>
    <p class="muted">Specs and prices change. Check the retailer before you buy. Last checked 22 October 2026.</p>
  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

STROLLERS = [  # name, key, weight, folded, child limit, note
 ("Doona X", "doona-x", "19.6 lb (8.9 kg)", "17.3 × 28.5 × 18 in (44 × 72.3 × 45.6 cm)", "Infant car seat: up to 30 lb and 17–32 in", "Car seat and stroller in one"),
 ("Stokke YOYO³ (6+)", "babylist-stokke-yoyo3", "13.7 lb (6.2 kg)", "20.5 × 17.3 × 7.1 in (52 × 44 × 18 cm)", "From 6 months to 48.5 lb (newborn pack sold separately)", "Smallest fold here"),
 ("UPPAbaby Minu V3", "babylist-uppababy-minu-v3", "16.7 lb (7.6 kg)", "21.5 × 18 × 10 in", "From birth to 50 lb", "Big basket, all-wheel suspension"),
 ("Nuna TRVL lx", "babylist-nuna-trvl-lx", "14.6 lb without canopy and armbar (about 17 lb with them)", "27 × 21 × 14.25 in", "From birth to 50 lb", "Near-flat recline"),
 ("Mockingbird Travel Stroller", "mockingbird-travel-stroller", "17.7 lb", "21.5 × 18 × 10 in", "From birth (infant nest mode or car seat adapter, both included) to 50 lb", "Car seat adapter included"),
]
STROLLER_FAQ = [
 ("Which travel stroller is best for cobblestones?", "None of the compact travel strollers love cobbles, because small wheels feel every bump. Look for suspension and the biggest wheels you can live with: the UPPAbaby Minu V3 has all-wheel suspension. On steep, cobbled old towns like Edinburgh's Royal Mile, a baby carrier is often easier than any stroller."),
 ("Will a travel stroller fit in the overhead bin?", "Some will. Stokke says the YOYO's folded size (52 × 44 × 18 cm) has been accepted as cabin luggage by most airlines since 2012, but each airline decides and it may count as your cabin bag. Bigger folds, like the Nuna TRVL lx at 27 × 21 × 14.25 in, are gate-check strollers. Check your airline before you fly."),
 ("Can I take a stroller free on Ryanair?", "Yes, with an infant. Ryanair's help centre says infants get a 5 kg baby bag (45 × 35 × 20 cm) and two items of baby equipment free, such as a stroller and a car seat. Rules differ by airline, so check yours."),
 ("Can I take a Mockingbird Single-to-Double stroller to Europe?", "You can, but it isn't a travel stroller. Mockingbird lists it at 28 lb as a single and 34 × 26 × 18 in folded, so it's a gate-check or checked-bag stroller and a lot to carry up station stairs. It's great for a road trip where it lives in the car. For flights, trains and cobbled old towns, Mockingbird's own Travel Stroller (17.7 lb, 21.5 × 18 × 10 in folded) is the better fit, and Mockingbird suggests many families use the two together."),
 ("Is the Doona worth it for a Europe trip?", "If your baby is under about a year and you'll be using taxis or rental cars, it's very handy, because the car seat is the stroller. It's the heaviest option here at 19.6 lb and it's outgrown at 30 lb or 32 in, so it's a baby-only buy."),
 ("Do I need a stroller in Europe at all?", "For toddlers, usually yes for long city days and naps. Many families bring a light stroller plus a carrier: the stroller for flat pavements and the airport, the carrier for castles, hills, ferries and steep stairs."),
]
def build_gear_stroller():
    path = GEAR_PAGES[1][0]
    page, cr = gear_head(path, "Best Travel Strollers for Europe: Cobbles, Trains, Ferries & Planes (2026) | Dark Lighthouse Solutions",
        "Doona X, Stokke YOYO³, UPPAbaby Minu V3, Nuna TRVL lx and the Mockingbird Travel Stroller compared for a family trip to Europe: weights, folded sizes, what fits in a plane cabin, and when a carrier beats a stroller.",
        "Best travel strollers for Europe: cobbles, trains, ferries and planes", STROLLER_FAQ, "Best travel strollers for Europe")
    rows = "".join(f"<tr><td><a href=\"#p-{k}\">{e(n)}</a></td><td>{w}</td><td>{f}</td><td>{c}</td><td>{note}</td></tr>" for n, k, w, f, c, note in STROLLERS)
    page += f'''
  <header class="wrap hero">
{GEAR_DISCLOSE}    {cr}
    <h1>Best travel strollers for Europe: cobbles, trains, ferries and planes</h1>
    <p class="lede">A European city trip is hard on a stroller: cobbled old towns, station stairs, narrow train aisles, ferry ramps and a plane at each end. Here's how five popular travel strollers compare, with the makers' own weights and folded sizes, plus when to leave the stroller behind. Facts checked October 2026, with sources at the end.</p>
  </header>
  <main class="wrap copy">
    <h2 id="compare">The five at a glance</h2>
    <div class="tablewrap"><table><thead><tr><th>Stroller</th><th>Weight</th><th>Folded size</th><th>Child</th><th>Stand-out</th></tr></thead><tbody>{rows}</tbody></table></div>
    <p class="muted">Weights and sizes from each maker's website (Babylist for the YOYO's weight), checked 22 October 2026. For comparison, the usual US carry-on limit is 22 × 14 × 9 in.</p>

    <h2 id="picks">Which one for which family</h2>
{prod("babylist-stokke-yoyo3", "Stokke YOYO³: best for flying and trains", "13.7 lb; folds to 52 × 44 × 18 cm (20.5 × 17.3 × 7.1 in); from 6 months to 48.5 lb with the 6+ seat.", "The smallest fold here, small enough that Stokke says most airlines accept it as cabin luggage. It tucks into a train luggage rack or under a café table. The trade-off is small wheels, so it's happiest on smooth pavements. (YOYO was made by Babyzen, now part of Stokke.)")}{prod("babylist-uppababy-minu-v3", "UPPAbaby Minu V3: best all-rounder for cobbles", "16.7 lb; folds to 21.5 × 18 × 10 in; from birth to 50 lb; basket holds up to 20 lb.", "All-wheel suspension makes it one of the smoothest here on rough streets, and the basket swallows a day's snacks and layers. It folds one-handed and stands on its own, but the fold is bigger than the YOYO's. (The Mockingbird Travel Stroller below also has all-wheel suspension and the same folded size.)")}{prod("babylist-nuna-trvl-lx", "Nuna TRVL lx: best for naps on the go", "14.6 lb without canopy and armbar; folds to 27 × 21 × 14.25 in; from birth to 50 lb.", "The near-flat recline is great for a baby who naps out and about. It clicks straight onto a Nuna PIPA infant car seat with no adapters. The fold is long, so plan to gate-check it.")}{prod("doona-x", "Doona X: best for babies and taxis", "19.6 lb; folds to 17.3 × 28.5 × 18 in; infant car seat for babies up to 30 lb and 17–32 in.", "The wheels fold away and it becomes the car seat, which is brilliant for airport transfers, taxis and rental cars. It's the heaviest here, the basket is tiny, and your baby will outgrow it, so it's a first-year buy.")}{prod("mockingbird-travel-stroller", "Mockingbird Travel Stroller: best value from birth", "17.7 lb; folds to 21.5 × 18 × 10 in; from birth to 50 lb; $399 when we checked, with the car seat adapter, cup holder and carry bag included.", "New for fall 2026 (it started shipping in mid-October), from the brand behind the popular Single-to-Double. It has a one-hand auto-fold, all-wheel suspension, a near lie-flat recline and a big basket, and it works from birth without buying extras: an infant nest mode plus an adapter for 50+ infant car seats come in the box. Mockingbird says the fold is IATA-compliant and fits the overhead bin on nearly all flights. The folded size matches the Minu V3, so it's not as tiny as the YOYO, and it's too new for long-term reviews yet.")}
    <h3 id="mockingbird-s2d">Got a Mockingbird Single-to-Double at home?</h3>
    <p>Lots of families already own (or love) the {aff("mockingbird-single-to-double", "Mockingbird Single-to-Double Stroller 3.0")}. It's a great everyday stroller, but it's a full-size one: Mockingbird lists it at 28 lb as a single (36 lb with the second seat) and 34 × 26 × 18 in folded, $549 when we checked. That's a gate-check stroller, heavy on station stairs and wide for narrow old-town pavements. It does make sense on a road trip, where it lives in the trunk, and its all-wheel suspension and never-flat tires handle rough paths well. For flights, trains and cobbled city centers, pair it with a travel stroller; Mockingbird itself suggests the Single-to-Double as the home-base stroller and the Travel Stroller for trips.</p>
    <h2 id="carrier">When a carrier beats a stroller</h2>
    <p>Castles, steep closes, ferry gangways and lots of stairs are easier with a carrier. For toddlers on walks and hills, a framed hiking carrier does the job:</p>
{prod("osprey-poco", "Osprey Poco Child Carrier", "7.69 lb (3.48 kg); 24 L of storage; maximum total load 48.5 lb (22 kg) including child and gear.", "A proper framed hiking carrier with 24 L of storage for the day's layers and snacks. Too big to be your everyday city option, but perfect for Arthur's Seat, the Lake District or the Cliffs of Moher paths.")}
    <h2 id="tips">Tips for strollers on European trains, ferries and planes</h2>
    <ul>
      <li><strong>Practise the fold at home</strong> until you can do it one-handed while holding a baby. You'll do it at every train door and security line.</li>
      <li><strong>Trains:</strong> fold the stroller and use the luggage racks at the ends of the carriage if the train is busy. Older stations may have stairs and no lift, so a light stroller wins.</li>
      <li><strong>Ferries:</strong> you'll usually leave the car on the car deck and walk up stairs to the lounges, so take the carrier for the crossing and leave the stroller in the car.</li>
      <li><strong>Planes:</strong> on Ryanair, infants get two items of baby equipment free (for example a stroller and a car seat) plus a 5 kg baby bag. Other airlines have their own rules, so check before you fly.</li>
      <li><strong>Cobbles:</strong> tip the stroller back onto its rear wheels on rough stretches. It's much smoother.</li>
      <li><strong>Get a stroller travel bag</strong> if you'll gate-check it; baggage handling is rough on frames.</li>
    </ul>
{FREE}
{faq_html(STROLLER_FAQ)}
{gear_related(path)}
    <h2 id="sources">Sources</h2>
    <ul class="src">
      <li><a href="https://www.doona.com/en-us/car-seat-stroller/collections/doona-x-nitro-black">Doona X specifications (Doona)</a></li>
      <li><a href="https://www.stokke.com/USA/en-us/customer-service/faq/faq-yoyo/faq-yoyo-24.html">YOYO folded size and cabin luggage note (Stokke)</a></li>
      <li><a href="https://www.babylist.com/gp/stokke-yoyo-stroller-from-6-months/55557/2073006">YOYO³ from 6 months: weight and child limit (Babylist)</a></li>
      <li><a href="https://uppababy.com/strollers/lightweight/minu-v3/">Minu V3 specifications (UPPAbaby)</a></li>
      <li><a href="https://nunababy.com/usa/trvl-lx-stroller">TRVL lx specifications (Nuna)</a></li>
      <li><a href="https://hellomockingbird.com/products/mockingbird-travel-stroller">Travel Stroller specifications, price and shipping date (Mockingbird)</a></li>
      <li><a href="https://hellomockingbird.com/products/mockingbird-double-stroller">Single-to-Double Stroller 3.0 dimensions, weight and price (Mockingbird)</a></li>
      <li><a href="https://www.osprey.com/pocotm-child-carrier">Poco Child Carrier specifications (Osprey)</a></li>
      <li><a href="https://help.ryanair.com/hc/en-us/articles/12888036565521">Infant baggage allowance (Ryanair help centre)</a></li>
    </ul>
    <p class="muted">Specs, prices and airline rules change. Check the maker and your airline before you buy or fly. Last checked 22 October 2026.</p>
  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

CARRYON = [  # airline, cabin bag, personal item, note
 ("United", "22 × 14 × 9 in", "17 × 10 × 9 in", "Basic Economy is generally a personal item only."),
 ("Delta", "22 × 14 × 9 in (56 × 35 × 23 cm)", "One personal item", "Total of 45 linear inches for the carry-on."),
 ("American", "22 × 14 × 9 in", "18 × 14 × 8 in", ""),
 ("British Airways", "56 × 45 × 25 cm, up to 23 kg", "40 × 30 × 15 cm, up to 23 kg", ""),
 ("Aer Lingus (to/from North America)", "55 × 40 × 24 cm, up to 10 kg", "40 × 30 × 20 cm", "Within Europe the 10 kg bag only comes on board if you've paid for it or it's included; otherwise drop it at check-in for free (Aer Lingus charges €35 if it's caught at the gate)."),
 ("Ryanair", "55 × 40 × 20 cm, 10 kg (paid: Priority &amp; 2 Cabin Bags)", "40 × 30 × 20 cm, free", "Infants: 5 kg baby bag (45 × 35 × 20 cm) plus two baby equipment items free."),
 ("easyJet", "56 × 45 × 25 cm (paid large cabin bag)", "45 × 36 × 20 cm, free, up to 15 kg", ""),
]
CARRY_FAQ = [
 ("What size carry-on fits every airline?", "There isn't one. US airlines use 22 × 14 × 9 in for the main cabin bag, but on Ryanair the free bag is only 40 × 30 × 20 cm and has to go under the seat. If you're flying a budget European airline, pack each person's essentials in a small under-seat bag and pay for one bigger cabin bag between you."),
 ("Can my child bring a Trunki on the plane?", "Usually as a cabin bag, yes: Trunki sells it as cabin-sized (46 × 20.5 × 31 cm) and publishes an airline checklist. It's bigger than the free under-seat bag on Ryanair (40 × 30 × 20 cm) and easyJet (45 × 36 × 20 cm), so on those airlines it needs a paid cabin bag allowance. Check your airline."),
 ("Are packing cubes worth it for families?", "Yes, especially with kids: one cube per person (or per day) means you can find the right pajamas in a dark hotel room without unpacking the whole case. Compression cubes like Peak Design's also squeeze soft clothes down."),
 ("Does the Ridge Carry-On meet US carry-on limits?", "Ridge lists its Carry-On's exterior at 22.5 × 14.5 × 9 in, which is half an inch over the common 22 × 14 × 9 in limit on two sides (and about 1 cm longer than British Airways' 56 cm). It's sold as a carry-on, but if your airline is strict about the sizer, measure it."),
 ("What's the best bag for a kid to carry?", "A small backpack they can manage on their own, like the 7 L Fjällräven Kånken Mini, which fits under the seat on budget airlines. Put a water bottle, a snack, a book and a spare layer in it and let them be in charge of it."),
]
def build_gear_luggage():
    path = GEAR_PAGES[2][0]
    page, cr = gear_head(path, "Best Carry-On Luggage for Family Travel: Airline Size Limits, Kids' Ride-On Cases & Packing Cubes (2026) | Dark Lighthouse Solutions",
        "Cabin bag size limits for United, Delta, American, British Airways, Aer Lingus, Ryanair and easyJet, then the carry-on suitcases, kids' ride-on luggage, backpacks and packing cubes that work for families.",
        "Carry-on luggage for family travel: airline limits, kids' ride-on cases and packing cubes", CARRY_FAQ, "Carry-on luggage for family travel")
    rows = "".join(f"<tr><td>{a}</td><td>{b}</td><td>{p}</td><td>{n}</td></tr>" for a, b, p, n in CARRYON)
    page += f'''
  <header class="wrap hero">
{GEAR_DISCLOSE}    {cr}
    <h1>Carry-on luggage for family travel: what fits, and what's worth buying</h1>
    <p class="lede">Flying carry-on with kids saves time at both ends and means nothing gets lost. The catch is that cabin bag limits change from airline to airline, and Europe's budget airlines are much stricter than US ones. Start with the limits, then pick bags that fit them. Facts checked October 2026, with sources at the end.</p>
  </header>
  <main class="wrap copy">
    <h2 id="limits">Cabin bag limits by airline</h2>
    <div class="tablewrap"><table><thead><tr><th>Airline</th><th>Cabin bag</th><th>Personal item</th><th>Notes</th></tr></thead><tbody>{rows}</tbody></table></div>
    <p class="muted">Economy allowances from each airline's website, checked 22 October 2026. Fare type matters (basic economy and budget fares often include only the personal item), and wheels and handles count toward the size.</p>

    <h2 id="suitcases">Carry-on suitcases and packs for the grown-ups</h2>
{prod("ridge-carry-on", "Ridge Carry-On", "German Makrolon polycarbonate shell; exterior 22.5 × 14.5 × 9 in, interior 20.5 × 14 in, per Ridge.", "A tough hard-shell case with a lifetime warranty. Note the listed size is half an inch over the 22 × 14 in US guideline on two sides, so measure it against your airline's sizer if you're worried.")}{prod("cotopaxi-allpa-35", "Cotopaxi Allpa 35L Travel Pack", "22 × 12 × 10 in; 2 lb 15 oz; water-resistant TPU-coated shell.", "A backpack that opens like a suitcase. Better than a roller when you've also got a stroller or a small hand to hold. It's 10 in deep, so don't overstuff it if the airline sizer is 9 in.")}{prod("peakdesign-packing-cube", "Peak Design Packing Cube", "Small: 4.5–9 L, 110 g; Medium: 8–18 L, 144 g; both compress to 8 cm deep.", "A zip squeezes each cube down to 8 cm deep, so soft clothes take up less room. One cube per family member makes it easy to find things in a shared case.")}{prod("bellroy-travel-wallet", "Bellroy Travel Wallet", "Leather, RFID-protected; holds a passport, 4 to 10+ cards, cash, tickets and a Micro Pen.", "Keeps everyone's passports and boarding passes in one place, with the pen for landing cards. Bellroy says it fits most passports, though not German or Irish ones.")}
    <h2 id="weekend-bags">Weekend bags and a toiletry kit</h2>
    <p>Not everyone wants a roller. These come from Bespoke Post, which sells its own Line of Trade bags alongside other brands:</p>
{prod("bespokepost-weekender", "Line of Trade Weekender Bag (Bespoke Post)", "Cotton canvas on a metal frame, leather handles, removable shoulder strap; 21 × 13 × 7 in; laptop pocket fits up to 15 in; $75 when we checked.", "A tough canvas duffel that stays open while you pack. At 21 × 13 × 7 in it's inside the 22 × 14 × 9 in US carry-on limit and Ryanair's paid 55 × 40 × 20 cm cabin bag. Good for a weekend away or as the one bag for a parent on a short trip.")}{prod("bespokepost-weekender-xl", "Line of Trade Weekender XL (Bespoke Post)", "40 L; 22 × 13.5 × 10 in (excluding handle); padded 15 in laptop sleeve, zip shoe compartment, trolley loop; $125 when we checked.", "The bigger version, with a separate shoe compartment and a loop that slides over a suitcase handle. It's 10 in deep, an inch over the US 9 in guideline, though it's soft-sided, so don't fill it to bursting if your airline is strict about the sizer.")}{prod("bespokepost-sidecar-toiletry-kit", "Halfday Sidecar Toiletry Kit (Bespoke Post)", "8.75 × 3.5 × 6.75 in; 0.68 lb; water-resistant polyester; hanging loop; reusable liquids pouch included; $48 when we checked.", "Hangs on the back of a hotel door, and the included clear liquids pouch sits in a back pocket so you can pull it out at security without unpacking.")}
    <h2 id="kids-luggage">Kids' luggage</h2>
{prod("target-trunki", "Trunki Ride-On Suitcase", "1.7 kg (3.8 lb); 18 L; 46 × 20.5 × 31 cm; ages 3–6; max ride-on weight 50 kg, per Trunki.", "Kids can sit on it and you tow them through the airport, which saves your back on long walks to the gate. It holds a few days of small-kid clothes plus toys. On Ryanair or easyJet it's bigger than the free under-seat bag.")}{prod("fjallraven-kanken-mini", "Fjällräven Kånken Mini", "7 L; about 29 × 20 × 13 cm; about 220 g.", "A small, tough backpack that's easy for a child to carry and small enough for any airline's free under-seat bag.")}
    <h2 id="tips">How to fly carry-on with kids</h2>
    <ul>
      <li><strong>Check each flight, not just the airline.</strong> A trip that flies United to London and then Ryanair to Dublin has two very different limits.</li>
      <li><strong>Pack one cube per person</strong> and roll soft clothes.</li>
      <li><strong>Liquids:</strong> security rules vary by airport, so keep liquids in a clear bag you can pull out quickly. Baby milk and food are usually allowed in larger amounts.</li>
      <li><strong>Wear the bulky stuff</strong> (boots and the waterproof jacket) on the plane.</li>
      <li><strong>Give each child a job:</strong> their own backpack with their own snacks and entertainment.</li>
    </ul>
{FREE}
{faq_html(CARRY_FAQ)}
{gear_related(path)}
    <h2 id="sources">Sources</h2>
    <ul class="src">
      <li><a href="https://www.united.com/en/us/fly/baggage/carry-on-bags.html">Carry-on bags (United)</a></li>
      <li><a href="https://www.delta.com/us/en/baggage/carry-on-baggage">Carry-on baggage (Delta)</a></li>
      <li><a href="https://www.aa.com/web/i18n/travel-info/baggage/carry-on-baggage.html">Carry-on baggage (American Airlines)</a></li>
      <li><a href="https://www.britishairways.com/content/information/baggage-essentials">Baggage essentials (British Airways)</a></li>
      <li><a href="https://www.aerlingus.com/localized/en/modals/baggage-information.html">Baggage information (Aer Lingus)</a></li>
      <li><a href="https://help.ryanair.com/hc/en-us/articles/12888036565521">Cabin bags and infant allowance (Ryanair help centre)</a></li>
      <li><a href="https://www.easyjet.com/en/help/baggage/cabin-bags">Cabin bags (easyJet)</a></li>
      <li><a href="https://ridge.com/products/carry-on-matte-black">Carry-On specs (Ridge)</a></li>
      <li><a href="https://www.trunki.co.uk/products/terrance">Ride-On Suitcase specifications (Trunki)</a></li>
      <li><a href="https://www.cotopaxi.com/products/allpa-35l-travel-pack">Allpa 35L dimensions and weight (Cotopaxi)</a></li>
      <li><a href="https://www.peakdesign.com/products/packing-cube">Packing Cube sizes and weights (Peak Design)</a></li>
      <li><a href="https://bellroy.com/products/travel-wallet-rfid">Travel Wallet (Bellroy)</a></li>
      <li><a href="https://www.bespokepost.com/store/line-of-trade-weekender-bag">Line of Trade Weekender Bag (Bespoke Post)</a></li>
      <li><a href="https://www.bespokepost.com/store/line-of-trade-weekender-bag-xl">Line of Trade Weekender XL (Bespoke Post)</a></li>
      <li><a href="https://www.bespokepost.com/store/halfday-sidecar-toiletry-kit">Halfday Sidecar Toiletry Kit (Bespoke Post)</a></li>
    </ul>
    <p class="muted">Airline rules change, sometimes by route and fare. Check your booking before you pack. Last checked 22 October 2026.</p>
  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

GEAR_HUB_FAQ = [
 ("Are these affiliate links?", "Some are. If you buy through a product link we may earn a commission, at no extra cost to you. It never changes which products we pick or the price you pay. Official sources, like the Met Office and airline baggage pages, are never affiliate links."),
 ("How do you choose the products?", "We start from what the trip actually needs (Scotland's rain, Europe's cobbles, budget airline size limits) and pick gear that solves that problem, using the maker's own specs. We'd rather list five useful things than fifty."),
]
def build_gear_hub():
    path = "/travel/gear/"
    page, cr = gear_head(path, "Family Travel Packing & Gear Guides: What to Wear, Strollers & Carry-On Luggage | Dark Lighthouse Solutions",
        "Family travel packing guides: what to wear in Scotland month by month, the best travel strollers for Europe, and carry-on luggage that fits US and European airline limits.",
        "Family travel packing and gear guides", GEAR_HUB_FAQ, "Packing & gear")
    cards = "".join(f'      <a href="{p}"><h2>{e(t)}</h2><p>{e(d)}</p></a>\n' for p, t, d in GEAR_PAGES)
    page += f'''
  <header class="wrap hero">
{GEAR_DISCLOSE}    {cr}
    <h1>Family travel packing &amp; gear</h1>
    <p class="lede">What to wear, what to push the baby in, and which bags actually fit the airlines' limits, with real weather data, real airline rules and the makers' own specs.</p>
  </header>
  <main class="wrap">
    <div class="hub">
{cards}      <a href="/travel/scotland/"><h2>Scotland trip planning guide</h2><p>Routes, drive times, costs and what to book when.</p></a>
    </div>
{FREE}{faq_html(GEAR_HUB_FAQ)}  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

def build_gear():
    build_gear_hub(); build_gear_wear(); build_gear_stroller(); build_gear_luggage()

# ---------------------------------------------------------------- holiday gift guides (retail affiliate links)
# Prices and product facts were checked on the brands' or retailers' own pages on 23 October 2026 (sources listed on each page).
# Same rules as the gear pages: every product link goes through aff() (plain URL + data-affiliate key + rel="sponsored nofollow noopener"),
# the FTC disclosure is the first thing in the hero, no Amazon, no alcohol. New keys live in AFF_SLOT and travel/affiliates.json as not-joined.
GIFT_NEW_KEYS = ["patagonia-black-hole-duffel-40", "patagonia-infant-micro-d-bunting", "peakdesign-tech-pouch", "fjallraven-kanken",
                 "osprey-daylite-plus", "bespokepost-grooming-tool-kit", "llbean-bean-boots-8", "darntough-mens-hiker-3-pack",
                 "ridge-wallet-royal-black", "babylist-ergobaby-omni-deluxe", "babylist-hatch-baby-sound-machine",
                 "babylist-skip-hop-forma", "babylist-frida-ultimate-baby-kit"]
AFF_SLOT.update({k: "gift" for k in GIFT_NEW_KEYS})
GIFT_CHECKED = "23 October 2026"
GIFT_IMG = "/assets/money/holiday-gift-budget-planner/1.jpg"
GIFT_PAGES = [("/travel/gifts/gifts-for-travelers/", "Gifts for travelers and families who travel", "Carry-on bags, packing cubes, a passport wallet and kids' backpacks, from $20 socks to a $295 suitcase, with real sizes and prices."),
              ("/travel/gifts/gifts-for-him-outdoors/", "Gifts for him: outdoorsy and heritage", "A Barbour wax jacket, Bean Boots, merino base layers, hiking socks, a canvas weekender and a metal wallet, with real prices."),
              ("/travel/gifts/gifts-for-new-parents/", "Gifts for new and expecting parents", "Travel strollers, a carrier, a sound machine, a diaper backpack and the small kit everyone ends up needing, with real prices.")]

# (tier heading, [(key, name, price, facts, why)])
GIFTS = {
 "gifts-for-travelers": [
  ("Under $100", [
   ("darntough-kids-light-hiker", "Darn Tough Kids' Light Hiker Micro Crew Socks", "$20", "45% merino wool with cushioning underfoot; kids' shoe sizes 9–6.", "A stocking stuffer that gets used. Warm, dry feet make a long day of sightseeing a lot less whiny."),
   ("bespokepost-sidecar-toiletry-kit", "Halfday Sidecar Toiletry Kit (Bespoke Post)", "$48", "8.75 × 3.5 × 6.75 in; 0.68 lb; water-resistant polyester; hanging loop; reusable liquids pouch included.", "Hangs on the back of a hotel door, and the clear liquids pouch pulls out at security without unpacking everything else."),
   ("peakdesign-tech-pouch", "Peak Design Tech Pouch", "$49.95 (Small) or $59.95 (Regular)", "Origami-style inner pockets, elastic loops, a clamshell opening and an outside zip pocket with a cable pass-through, per Peak Design.", "For the person whose chargers, cables and battery packs end up loose at the bottom of every bag. The Small fits brick-style chargers and is the easier one to tuck into a backpack."),
   ("peakdesign-packing-cube", "Peak Design Packing Cube", "$39.95 (Small) to $49.95 (Large)", "Small: 4.5–9 L, 110 g; Medium: 8–18 L, 144 g; both compress to 8 cm deep, per Peak Design.", "A zip squeezes soft clothes flat. One cube per family member keeps a shared suitcase from turning into a pile."),
   ("osprey-daylite-plus", "Osprey Daylite Plus Daypack", "$80", "20 L everyday pack with a large panel-loading main compartment, per Osprey.", "A plain, simple daypack for a day of walking around a city. Panel loading means it unzips wide, so nobody has to dig for the snacks."),
   ("fjallraven-kanken-mini", "Fjällräven Kånken Mini", "$85", "7 L; about 29 × 20 × 13 cm; about 220 g.", "A kid-sized version of the classic. Small enough for any airline's free under-seat bag and light enough for a five-year-old to carry their own stuff."),
   ("fjallraven-kanken", "Fjällräven Kånken (classic 16 L)", "$95", "16 L; 36 × 27.5 × 12 cm; 300 g; Vinylon F fabric; removable seat pad; reflective logo, per Fjällräven.", "The square Swedish backpack, in dozens of colors. It's light, the fabric shrugs off dirt and rain, and there's a foam seat pad tucked in the back for sitting on damp benches."),
  ]),
  ("$100 to $300", [
   ("bellroy-travel-wallet", "Bellroy Travel Wallet", "$145", "Leather, RFID-protected; holds a passport, 4 to 10+ cards, cash, tickets and a Micro Pen.", "Keeps passports, boarding passes and a pen for landing cards in one place. Bellroy says it fits most passports, though not German or Irish ones."),
   ("patagonia-black-hole-duffel-40", "Patagonia Black Hole Duffel 40L", "$165", "19.7 × 12.5 × 8.5 in; 1,045 g; Patagonia says it fits most airline carry-on requirements.", "A soft duffel that goes from the car trunk to the overhead bin. On Patagonia's listed size it's inside the 22 × 14 × 9 in US carry-on guideline."),
   ("cotopaxi-allpa-35", "Cotopaxi Allpa 35L Travel Pack", "$230", "22 × 12 × 10 in; 2 lb 15 oz; water-resistant TPU-coated shell.", "A backpack that opens like a suitcase. Handy for the parent who also has a stroller to push. It's 10 in deep, so don't overstuff it if the airline sizer is 9 in."),
   ("ridge-carry-on", "Ridge Carry-On", "$295", "German Makrolon polycarbonate shell; exterior 22.5 × 14.5 × 9 in, interior 20.5 × 14 in, per Ridge.", "A hard-shell case with a lifetime warranty. The listed size is half an inch over the 22 × 14 in US guideline on two sides, so it's worth measuring against the airline's sizer."),
  ]),
 ],
 "gifts-for-him-outdoors": [
  ("Under $100", [
   ("saxx-quest-boxer-brief", "SAXX Quest Quick-Dry Mesh Boxer Brief", "$36", "Quick-dry micro-mesh designed for travel and sink washing.", "Not exciting to unwrap, but the kind of gift that gets worn every week. Washes in a hotel sink and dries overnight."),
   ("bespokepost-sidecar-toiletry-kit", "Halfday Sidecar Toiletry Kit (Bespoke Post)", "$48", "8.75 × 3.5 × 6.75 in; 0.68 lb; water-resistant polyester; hanging loop; reusable liquids pouch included.", "Replaces the plastic grocery bag of toiletries. The hanging loop is the part that wins people over in small bathrooms."),
   ("bespokepost-grooming-tool-kit", "Men &amp; Nails Medium Grooming Tool Kit (Bespoke Post)", "$60", "12 stainless steel tools in a brown vegan leather case.", "Nail clippers, scissors and tweezers that live in one case instead of three drawers. A good add-on gift."),
   ("bespokepost-weekender", "Line of Trade Weekender Bag (Bespoke Post)", "$75", "Cotton canvas on a metal frame, leather handles, removable shoulder strap; 21 × 13 × 7 in; laptop pocket fits up to 15 in.", "A canvas duffel that stays open while you pack. It fits the US carry-on guideline, so it works for a weekend away or a short work trip."),
   ("darntough-mens-hiker-3-pack", "Darn Tough Men's Hiker Micro Crew 3-Pack", "$78", "Three pairs of Darn Tough's cushioned merino Hiker Micro Crew in classic colors; $26 a pair bought singly.", "Merino hiking socks are one of those things people don't buy for themselves. Three pairs means they're not saving them for best."),
   ("ridge-wallet-royal-black", "Ridge Wallet, Royal Black", "$76 on sale (regular $95)", "Anodized aluminum plates, a scratch-resistant finish and a track that expands for 1 to 12 cards, per Ridge.", "For the guy with a fat leather wallet he keeps meaning to replace. It forces you down to the cards you actually use."),
  ]),
  ("$100 and up", [
   ("smartwool-classic-thermal-crew", "Smartwool Men's Classic Thermal Merino Base Layer Crew", "$66–$125 depending on color and style", "100% merino, 250 g/m² midweight.", "A warm layer under a jacket for cold walks and early starts. Sale colors bring the price down a lot, so check a few."),
   ("llbean-bean-boots-8", "L.L.Bean Men's Bean Boots, 8\"", "$150", "Made in Maine; L.L.Bean says to order a full size down from your usual shoe size.", "The classic duck boot for slush, mud and walking the dog. Do read L.L.Bean's sizing note before ordering, because most people get it wrong the first time."),
   ("patagonia-black-hole-duffel-40", "Patagonia Black Hole Duffel 40L", "$165", "19.7 × 12.5 × 8.5 in; 1,045 g; Patagonia says it fits most airline carry-on requirements.", "The bag that ends up in the truck, at the gym and in the overhead bin. A safe pick if you don't know his clothing size."),
   ("bespokepost-barbour-transport", "Barbour Transport Wax Jacket (Bespoke Post)", "$425", "6 oz waxed cotton with a cord collar, tartan lining and an inner storm skirt, in a roomier, more modern cut.", "The big one. A Barbour gets better with age and can be re-waxed for years. Bespoke Post calls it water-resistant, not waterproof, so it's a jacket for drizzle and wind rather than a downpour."),
  ]),
 ],
 "gifts-for-new-parents": [
  ("Under $100", [
   ("patagonia-infant-micro-d-bunting", "Patagonia Infant Micro D Fleece Bunting", "$75", "164 g fleece one-piece with a hood, feet and convertible mitts, per Patagonia.", "A warm layer for stroller walks and winter errands. One of the few baby clothes that gets used all season."),
   ("babylist-skip-hop-forma", "Skip Hop Forma Diaper Backpack (at Babylist)", "$78.99", "16 × 8 × 14 in; insulated bottle pockets, a changing pad and stroller straps.", "A backpack keeps both hands free, and that matters more than any feature list. Neutral enough that either parent will carry it."),
   ("babylist-hatch-baby-sound-machine", "Hatch Baby Sound Machine (at Babylist)", "$79.99", "Sound machine and night light; includes 3 months of Hatch+; no backup battery, so it needs to stay plugged in.", "White noise and a dim light for the middle-of-the-night feeds."),
   ("babylist-frida-ultimate-baby-kit", "Frida Baby Ultimate Baby Kit (at Babylist)", "$99.99", "NoseFrida the SnotSucker, Windi gas passers, a medicine pacifier, a rectal thermometer, nail clippers, a hairbrush and comb, a finger toothbrush, a teether and a case.", "Not glamorous. Everyone ends up buying most of this at 2 a.m. anyway, so it's a kind gift."),
  ]),
  ("$100 to $450", [
   ("babylist-ergobaby-omni-deluxe", "Ergobaby Omni Deluxe Carrier (at Babylist)", "$219", "7 to 45 lb; four carry positions; machine washable.", "A carrier from the newborn weeks to toddlerhood. Great for airports, cobbled streets and anywhere a stroller is a pain."),
   ("babylist-stokke-yoyo3", "Stokke YOYO³ (at Babylist)", "$399.20 on sale (regular $499)", "13.7 lb; folds to 52 × 44 × 18 cm (20.5 × 17.3 × 7.1 in); from 6 months to 48.5 lb with the 6+ seat.", "A small-fold travel stroller built for planes, buses and trains. The 6+ version is for babies who can sit up, so it's a gift for a family that's past the newborn stage."),
   ("mockingbird-travel-stroller", "Mockingbird Travel Stroller", "$399", "17.7 lb; folds to 21.5 × 18 × 10 in; from birth to 50 lb; car seat adapter, cup holder and carry bag included.", "Good value from birth, with the adapter and bag already in the box rather than sold as extras."),
   ("osprey-poco", "Osprey Poco Child Carrier", "$400", "7.69 lb (3.48 kg); 24 L of storage; maximum total load 48.5 lb (22 kg) including child and gear.", "A framed hiking carrier for later on (Osprey lists a minimum total load of 23.7 lb, so it's not for newborns). A gift for outdoorsy parents who want to keep doing the trails."),
  ]),
  ("Big-ticket (go in on it together)", [
   ("mockingbird-single-to-double", "Mockingbird Single-to-Double Stroller 3.0", "$549", "28 lb as a single, 36 lb with the second seat; 34 × 26 × 18 in folded.", "An everyday stroller that grows into a double when a sibling arrives. It's full-size, so it lives in the car trunk rather than the plane."),
   ("babylist-nuna-trvl-lx", "Nuna TRVL lx (at Babylist)", "$600", "14.6 lb without canopy and armbar; folds to 27 × 21 × 14.25 in; from birth to 50 lb.", "Our stroller guide's pick for naps on the go, and suitable from birth. A nice one for parents who'll travel a lot."),
   ("doona-x", "Doona X", "$850", "19.6 lb; folds to 17.3 × 28.5 × 18 in; infant car seat for babies up to 30 lb and 17–32 in.", "An infant car seat with wheels that fold out. Brilliant for taxis and quick errands. Babies outgrow it at 30 lb or 32 in, so it's a splurge for the first year or so."),
  ]),
 ],
}
GIFT_SOURCES = {
 "gifts-for-travelers": [("darntough.com/products/kids-merino-wool-light-hiker-micro-crew-cushioned-lightweight-hiking-socks", "Kids Light Hiker (Darn Tough)"), ("www.bespokepost.com/store/halfday-sidecar-toiletry-kit", "Halfday Sidecar Toiletry Kit (Bespoke Post)"),
   ("www.peakdesign.com/products/tech-pouch", "Tech Pouch (Peak Design)"), ("www.peakdesign.com/products/packing-cube", "Packing Cube (Peak Design)"), ("www.osprey.com/daylite-plus-dayltpluss21-795", "Daylite Plus (Osprey)"),
   ("www.fjallraven.com/us/en-us/bags-gear/kanken/kanken-bags/kanken-mini/", "Kånken Mini (Fjällräven)"), ("www.fjallraven.com/us/en-us/bags-gear/kanken/kanken-bags/kanken/", "Kånken (Fjällräven)"),
   ("bellroy.com/products/travel-wallet-rfid", "Travel Wallet (Bellroy)"), ("www.patagonia.com/product/black-hole-duffel-bag-40-liters/49339.html", "Black Hole Duffel 40L (Patagonia)"),
   ("www.cotopaxi.com/products/allpa-35l-travel-pack", "Allpa 35L (Cotopaxi)"), ("ridge.com/products/carry-on-matte-black", "Carry-On (Ridge)")],
 "gifts-for-him-outdoors": [("www.saxxunderwear.com/products/sxbb65f_blk", "Quest Quick-Dry Mesh (SAXX)"), ("www.bespokepost.com/store/halfday-sidecar-toiletry-kit", "Halfday Sidecar Toiletry Kit (Bespoke Post)"),
   ("www.bespokepost.com/store/men-nails-medium-luxury-grooming-tool-kit-brown", "Medium Grooming Tool Kit (Bespoke Post)"), ("www.bespokepost.com/store/line-of-trade-weekender-bag", "Line of Trade Weekender (Bespoke Post)"),
   ("darntough.com/products/mens-hiker-micro-crew-3-pack", "Men's Hiker Micro Crew 3-Pack (Darn Tough)"), ("ridge.com/products/aluminum-black", "Ridge Wallet Royal Black (Ridge)"),
   ("www.smartwool.com/en-us/products/mens-classic-thermal-merino-base-layer-crew-sw016349", "Classic Thermal Crew (Smartwool)"), ("www.llbean.com/llb/shop/129628?page=mens-bean-boot-8in-mens", "Men's Bean Boots 8\" (L.L.Bean)"),
   ("www.patagonia.com/product/black-hole-duffel-bag-40-liters/49339.html", "Black Hole Duffel 40L (Patagonia)"), ("www.bespokepost.com/store/barbour-transport-wax-jacket", "Barbour Transport Wax Jacket (Bespoke Post)")],
 "gifts-for-new-parents": [("www.patagonia.com/product/infant-micro-d-fleece-bunting/60175.html", "Infant Micro D Fleece Bunting (Patagonia)"), ("www.babylist.com/gp/skip-hop-baby-forma-pack-and-go-diaper-bag-backpack/12512/1930410", "Skip Hop Forma (Babylist)"),
   ("www.babylist.com/gp/hatch-hatch-baby-sound-machine/75243/2583280", "Hatch Baby Sound Machine (Babylist)"), ("www.babylist.com/gp/fridababy-ultimate-baby-kit/36341/1388756", "Frida Baby Ultimate Baby Kit (Babylist)"),
   ("www.babylist.com/gp/ergobaby-omni-deluxe-carrier/71197/2363793", "Ergobaby Omni Deluxe (Babylist)"), ("www.babylist.com/gp/stokke-yoyo-stroller-from-6-months/55557/2073006", "Stokke YOYO³ 6+ (Babylist)"),
   ("hellomockingbird.com/products/mockingbird-travel-stroller", "Travel Stroller (Mockingbird)"), ("www.osprey.com/pocotm-child-carrier", "Poco Child Carrier (Osprey)"),
   ("hellomockingbird.com/products/mockingbird-double-stroller", "Single-to-Double 3.0 (Mockingbird)"), ("www.babylist.com/gp/nuna-trvl-lx/46284/1871701", "Nuna TRVL lx (Babylist)"),
   ("www.doona.com/en-us/car-seat-stroller/collections/doona-x-nitro-black", "Doona X (Doona)")],
}
GIFT_COMMON_FAQ = ("Are the prices current?", f"They're what each retailer's own page showed on {GIFT_CHECKED}. Holiday sales move prices up and down, sometimes daily, so the retailer's page is the final word. If something here looks wrong, it's probably changed since we checked.")
GIFT_AFF_FAQ = ("Are these affiliate links?", "Some are. If you buy through a product link we may earn a commission, at no extra cost to you. It doesn't change the price you pay or which products we pick, and nobody paid to be on these lists.")
GIFT_FAQ = {
 "gifts-for-travelers": [
  ("Which of these bags fit as a carry-on?", "On the makers' listed sizes, the Patagonia Black Hole 40L (19.7 × 12.5 × 8.5 in) and the Bespoke Post toiletry kit fit easily inside the 22 × 14 × 9 in guideline most US airlines use. The Ridge Carry-On is listed at 22.5 × 14.5 × 9 in and the Cotopaxi Allpa 35L is 10 in deep, so both are slightly over on paper. Europe's budget airlines are much stricter: check the airline before you fly."),
  ("What's a good travel gift under $50?", "Merino socks ($20 for kids' Darn Tough), a Peak Design packing cube (from $39.95), the Small Tech Pouch ($49.95) or the Halfday toiletry kit ($48). They're all things people use on every trip and rarely buy for themselves."),
  ("What do you get a kid who travels?", "Their own backpack. The Kånken Mini ($85) is small enough for any airline's free under-seat bag, and carrying their own snacks and toys gives kids a job on travel day."),
  GIFT_COMMON_FAQ, GIFT_AFF_FAQ],
 "gifts-for-him-outdoors": [
  ("Is a Barbour wax jacket waterproof?", "Not fully. Bespoke Post describes the Barbour Transport as water-resistant: waxed cotton sheds drizzle and wind well, and it can be re-waxed to keep it that way. For a real downpour, a modern waterproof shell is drier."),
  ("How do Bean Boots fit?", "Big. L.L.Bean's own product page says to order a full size down from your usual shoe size, and to go by the sizing advice there rather than guessing. If you're buying as a surprise, a gift receipt helps."),
  ("What's a good outdoorsy gift under $100?", "Merino hiking socks (the Darn Tough 3-pack is $78), a canvas weekender ($75), the Ridge Wallet ($76 on sale when we checked), the SAXX Quest ($36) or a grooming kit ($60)."),
  GIFT_COMMON_FAQ, GIFT_AFF_FAQ],
 "gifts-for-new-parents": [
  ("Should I buy off the registry?", "If there's a registry, use it first: the parents have often already picked a stroller and car seat, and two of the same is no fun to return. The smaller things here (a sound machine, a diaper backpack, the Frida kit) are safer picks when the registry is picked over."),
  ("Which stroller is best for travel?", "For flights and trains, a small-fold stroller like the Stokke YOYO³, Mockingbird Travel Stroller or Nuna TRVL lx. The Doona X is an infant car seat with wheels, which is handy for taxis but outgrown in about a year. Our <a href=\"/travel/gear/best-travel-stroller-europe/\">travel stroller guide</a> compares them for cobbles, trains and plane cabins."),
  ("What can a group chip in for?", "A stroller or the Ergobaby carrier ($219). The big-ticket picks here (the Single-to-Double, Nuna TRVL lx and Doona X) are $549 to $850, which is a lot for one person but reasonable split five ways."),
  GIFT_COMMON_FAQ, GIFT_AFF_FAQ],
}
GIFT_HUB_FAQ = [
 ("How did you pick these gifts?", "We started with things that are useful on a trip or in a busy first year with a baby, then checked every price and spec on the retailer's own page. We'd rather list ten good things than fifty."),
 GIFT_COMMON_FAQ, GIFT_AFF_FAQ,
]

def gift_article(headline, path):
    a = article(headline, path, GIFT_IMG); a["datePublished"] = a["dateModified"] = "2026-10-23"
    return a
def gift_head(path, title, desc, headline, faq, crumb_name, extra_ld=()):
    trail = [("Travel", "/travel/"), ("Gift guides", "/travel/gifts/")] + ([(crumb_name, path)] if path != "/travel/gifts/" else [])
    cr, crld = crumbs(trail)
    page = head(path, title, desc, GIFT_IMG, [gift_article(headline, path), faq_ld(faq), crld, *extra_ld], "/travel/gifts/")
    return page, cr
def gift_planner_box():
    return f'''    <aside class="packbox" id="holiday-planner">
      <h3>Keeping track of it all</h3>
      <p>If you're buying for a lot of people this year, our <a href="{URLS["holiday-gift-budget-planner"]}">Holiday Gift &amp; Budget Planner</a> ($9, Google Sheets or Excel) holds one budget for gifts, food, travel and decor, tracks every gift from idea to bought, shipped and wrapped, and counts down ship-by dates. <a href="/templates/#holiday-gift-budget-planner">See what's inside</a>.</p>
    </aside>
'''
def gift_table(slug):
    rows = "".join(f'<tr><td><a href="#p-{k}">{n}</a></td><td>{e(p)}</td><td>{e(t)}</td></tr>' for t, items in GIFTS[slug] for k, n, p, _, _ in items)
    return f'    <div class="tablewrap"><table><thead><tr><th>Gift</th><th>Price when we checked</th><th>Group</th></tr></thead><tbody>{rows}</tbody></table></div>\n'
def gift_picks(slug):
    out = ""
    for i, (tier, items) in enumerate(GIFTS[slug]):
        out += f'    <h2 id="tier-{i + 1}">{e(tier)}</h2>\n'
        out += "".join(prod(k, n.replace("&amp;", "&"), f"{f} <strong>{e(p)}</strong> when we checked.", w) for k, n, p, f, w in items)
    return out
def gift_sources(slug):
    li = "".join(f'      <li><a href="https://{u.replace("&", "&amp;")}">{e(t)}</a></li>\n' for u, t in GIFT_SOURCES[slug])
    return f'    <h2 id="sources">Sources</h2>\n    <ul class="src">\n{li}    </ul>\n    <p class="muted">Prices and stock checked on each retailer\'s own page on {GIFT_CHECKED}. Holiday prices change often; the retailer\'s page is the final word.</p>\n'
def gift_related(skip):
    return '    <h2 id="more-gifts">More gift guides</h2>\n    <div class="related">' + "".join(
        f'<a href="{p}">{e(t)}</a>' for p, t, _ in GIFT_PAGES if p != skip) + '<a href="/travel/gifts/">All gift guides</a><a href="/travel/gear/">Packing &amp; gear guides</a></div>\n'
def gift_count(slug): return sum(len(items) for _, items in GIFTS[slug])
def gift_itemlist(slug, path):
    items = [(k, n) for _, its in GIFTS[slug] for k, n, *_ in its]
    return {"@context": "https://schema.org", "@type": "ItemList", "name": dict((p, t) for p, t, _ in GIFT_PAGES)[path], "numberOfItems": len(items),
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": html.unescape(n), "url": f"{SITE}{path}#p-{k}"} for i, (k, n) in enumerate(items)]}

GIFT_COPY = {
 "gifts-for-travelers": dict(
   title="Gifts for Travelers & Families Who Travel: {n} Useful Picks for 2026 | Dark Lighthouse Solutions",
   desc="Holiday gift ideas for travelers and traveling families: carry-on bags, packing cubes, a passport wallet, kids' backpacks and merino socks, with real sizes and prices checked October 2026.",
   h1="Gifts for travelers and families who travel",
   lede="Good travel gifts are the things people use on every trip and never get round to buying for themselves. These are {n} we'd be happy to unwrap, from $20 socks to a $295 suitcase. Every size and price comes from the retailer's own page, checked October 23, 2026.",
   after='''    <h2 id="tips">A few buying tips</h2>
    <ul>
      <li><strong>Check the airline, not just the bag.</strong> A bag that fits United's limit can still be too big for Ryanair. Our <a href="/travel/gear/best-carry-on-luggage-family-travel/">carry-on guide</a> has the limits side by side.</li>
      <li><strong>Packing cubes make a good family gift.</strong> One per person, in different colors, and nobody has to dig through anyone else's clothes.</li>
      <li><strong>Don't leave kids' sizes and popular colors too late.</strong> They can sell out close to the holidays.</li>
    </ul>
''', planner="family-travel-kids-planner", planner_note="Planning a trip as part of the gift? The Family Travel with Kids Planner covers passports, a jet-lag plan, packing by age and the budget."),
 "gifts-for-him-outdoors": dict(
   title="Gifts for Him: {n} Outdoorsy & Heritage Picks, from Barbour to Bean Boots (2026) | Dark Lighthouse Solutions",
   desc="Holiday gift ideas for the outdoorsy man: a Barbour wax jacket, L.L.Bean Bean Boots, Smartwool merino, Darn Tough socks, a canvas weekender and the Ridge Wallet, with real prices checked October 2026.",
   h1="Gifts for him: outdoorsy and heritage",
   lede="For the man who already owns a good flashlight and three multitools. These {n} picks lean classic: waxed cotton, rubber boots, merino and canvas, things that get better with use. Prices come from each retailer's own page, checked October 23, 2026.",
   after='''    <h2 id="tips">A few buying tips</h2>
    <ul>
      <li><strong>Sizing:</strong> boots and jackets are the gifts most likely to go back. L.L.Bean's Bean Boots run big, and Barbour cuts vary by style, so check the size guide on the product page.</li>
      <li><strong>Socks and base layers are safe bets.</strong> Merino is easy to size and gets worn all winter.</li>
      <li><strong>Bespoke Post sells single items too.</strong> You don't need a subscription to buy from its store.</li>
    </ul>
''', planner=None, planner_note=""),
 "gifts-for-new-parents": dict(
   title="Gifts for New & Expecting Parents: {n} Picks from Strollers to the Small Stuff (2026) | Dark Lighthouse Solutions",
   desc="Holiday gift ideas for new and expecting parents: travel strollers, the Ergobaby Omni Deluxe carrier, a Hatch sound machine, a diaper backpack, the Frida Baby kit and more, with real prices checked October 2026.",
   h1="Gifts for new and expecting parents",
   lede="New parents need fewer cute outfits than people think, and more things that make the 3 a.m. feeds and the first trips out easier. Here are {n} picks, grouped by budget so a group can chip in for the big ones. Prices come from each retailer's own page, checked October 23, 2026.",
   after='''    <h2 id="tips">A few buying tips</h2>
    <ul>
      <li><strong>Check the registry first.</strong> Strollers, car seats and carriers are personal choices, and parents have often already picked one.</li>
      <li><strong>Car seats:</strong> if you're giving one, buy it new so its history is known, and let the parents pick the model if you're unsure.</li>
      <li><strong>Gift receipts help.</strong> Babies grow out of things on their own schedule.</li>
    </ul>
''', planner="family-travel-kids-planner", planner_note="Expecting parents planning a first trip with the baby? The Family Travel with Kids Planner has a passport check, a jet-lag plan and packing lists by age."),
}

def build_gift_page(i):
    path, short, _ = GIFT_PAGES[i]; slug = path.strip("/").split("/")[-1]; c = GIFT_COPY[slug]; n = gift_count(slug); faq = GIFT_FAQ[slug]
    page, cr = gift_head(path, c["title"].format(n=n), c["desc"], short, faq, short, [gift_itemlist(slug, path)])
    planner = (f'    <h2 id="planner">A planner to go with it</h2>\n    <p class="muted">{e(c["planner_note"])}</p>\n    <div class="cta">\n{card(c["planner"])}\n    </div>\n') if c["planner"] else ""
    binder = (f'    <p>One more for expecting parents: <a href="{URLS["just-in-case-binder"]}">The Just-In-Case Binder</a> ($12) is a 62-page fillable and printable binder for the important stuff (insurance, accounts, medical details, who to call), with a Google Sheets companion. Not a cuddly gift, but a useful one when a family is growing. <a href="/templates/#just-in-case-binder">See what\'s inside</a>.</p>\n') if slug == "gifts-for-new-parents" else ""
    page += f'''
  <header class="wrap hero">
{GEAR_DISCLOSE}    {cr}
    <h1>{e(c["h1"])}</h1>
    <p class="lede">{e(c["lede"].format(n=n))}</p>
  </header>
  <main class="wrap copy">
    <h2 id="at-a-glance">At a glance</h2>
{gift_table(slug)}{gift_planner_box()}{gift_picks(slug)}{c["after"]}{planner}{binder}{faq_html(faq)}{gift_related(path)}{gift_sources(slug)}  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

def build_gifts_hub():
    path = "/travel/gifts/"
    page, cr = gift_head(path, "Holiday Gift Guides 2026: Travelers, Outdoorsy Men & New Parents | Dark Lighthouse Solutions",
        "Three short holiday gift guides with real prices checked October 2026: gifts for travelers and families who travel, outdoorsy and heritage gifts for him, and gifts for new and expecting parents.",
        "Holiday gift guides 2026", GIFT_HUB_FAQ, "Gift guides")
    cards = "".join(f'      <a href="{p}"><h2>{e(t)}</h2><p>{e(d)} {gift_count(p.strip("/").split("/")[-1])} picks.</p></a>\n' for p, t, d in GIFT_PAGES)
    page += f'''
  <header class="wrap hero">
{GEAR_DISCLOSE}    {cr}
    <h1>Holiday gift guides</h1>
    <p class="lede">Three short lists of gifts people actually use, with every price checked on the retailer's own page on October 23, 2026.</p>
  </header>
  <main class="wrap">
    <div class="hub">
{cards}      <a href="/templates/#holiday-gift-budget-planner"><h2>Holiday Gift &amp; Budget Planner</h2><p>$9 Google Sheet: one budget for the season and a gift list from idea to wrapped.</p></a>
    </div>
{faq_html(GIFT_HUB_FAQ)}  </main>
''' + foot(aff=True) + "</body>\n</html>\n"
    write(path, page)

def build_gifts():
    build_gifts_hub()
    for i in range(len(GIFT_PAGES)): build_gift_page(i)

# ---------------------------------------------------------------- planners, hub, privacy
PL_FAQ = [
 ("What do I need to use the planners?", "A free Google account for the Google Sheets version, or Excel for the .xlsx file that comes with every order. No add-ons, scripts or subscriptions."),
 ("How do I get my planner after I buy?", "Right after checkout you get a private 'Make a copy' link that opens the planner straight into your own Google Drive. Your copy is private: we can't see it."),
 ("Can I use the Trip Planner for any country?", "Yes. Type each cost in the currency it was quoted in (your home currency or the local one) and set the exchange rate once: it converts everything into your home currency."),
 ("Are the example numbers real prices?", "No. Every example row is marked EXAMPLE and the amounts are placeholders to show how the formulas work. The Scotland planner's fixed fees (the UK ETA and the Edinburgh visitor levy) are the real published rules, with links on its Sources tab."),
 ("Can I print them?", "Yes. Each planner comes with a printable PDF version on US Letter (it also prints fine on A4 with 'fit to page'). The kids packing checklist is free to download on its own."),
]
PL_BULLETS = {
 "trip-planner-travel-budget": ["Costs in any currency, converted for you", "Paycheck-by-paycheck savings plan", "Itinerary, bookings & confirmations, packing list", "Dashboard + a phone tab"],
 "family-travel-kids-planner": ["Passport expiry check against your return date", "Bedtime shift plan for jet lag", "Kids packing list by age", "Day pacing, emergency info, budget & savings"],
 "scotland-trip-planner": ["Route Builder: 21 places, drive times, long-day flags", "Sample 7, 10 and 14-night routes", "Booking timeline from your arrival date", "Budget in £ with the ETA and Edinburgh levy built in"],
 "travel-planner-bundle": ["All three planners above", "All the printables and Excel files", "Save $14 vs buying separately"],
}
def build_planners():
    path = "/travel/planners/"
    cr, crld = crumbs([("Travel", "/travel/"), ("Travel planners", path)])
    items = {"@context": "https://schema.org", "@type": "ItemList", "name": "Travel planner spreadsheets", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}{path}#{s}", "name": TP[s][0]} for i, s in enumerate(PL_BULLETS)]}
    page = head(path, "Travel Planner Spreadsheets: Trip Budget, Family Travel & Scotland | Dark Lighthouse Solutions",
                "Google Sheets travel planners for families: a trip planner and travel budget in any currency, a family travel with kids planner, and a Scotland road trip planner. Plus a free kids packing checklist.",
                "/assets/travel/travel-planner-bundle/1.jpg", [items, faq_ld(PL_FAQ), crld], "/travel/planners/")
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>Travel planners for Google Sheets</h1>
    <p class="lede">Spreadsheets that do the boring parts of trip planning: the budget, the savings plan, the passport dates and, for Scotland, the drive times. Make a copy, type in the yellow cells, done.</p>
  </header>
  <main class="wrap">
    <div class="cta">
{chr(10).join(card(s, PL_BULLETS[s], "h2") for s in PL_BULLETS)}
    </div>
{FREE}    <section class="copy">
    <h2>Which one do I need?</h2>
    <ul>
      <li><strong>Any trip, any destination:</strong> the Trip Planner &amp; Travel Budget.</li>
      <li><strong>Traveling with babies, toddlers or school-age kids:</strong> the Family Travel with Kids Planner. It has its own budget and savings tabs too, so you don't need both.</li>
      <li><strong>Going to Scotland:</strong> the Scotland Trip Planner. It's built around a road trip: where you sleep each night and how long the drive is.</li>
      <li><strong>Doing a family trip to Scotland,</strong> or planning more than one trip this year: the bundle.</li>
    </ul>
    <p>Not ready to buy? Try the free <a href="/travel/tools/travel-budget-calculator/">travel budget calculator</a> or read the <a href="/travel/scotland/">Scotland planning guide</a>.</p>
    </section>
{faq_html(PL_FAQ)}  </main>
''' + foot() + "</body>\n</html>\n"
    write(path, page)

def build_hub():
    path = "/travel/"
    cr, crld = crumbs([("Travel", path)])
    page = head(path, "Family Travel Planning: Budgets, Planners, UK & Ireland Guides | Dark Lighthouse Solutions",
                "Family travel planning without the spreadsheet headache: free travel budget calculators, Scotland, Ireland, England and Wales trip planning guides, a free kids packing checklist and Google Sheets trip planners.",
                "/assets/travel/travel-planner-bundle/1.jpg", [crld], "/travel/")
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>Family trips, planned on a budget</h1>
    <p class="lede">Practical tools for planning a trip with kids without blowing the budget: what it'll cost, how much to save each payday, and (if you're heading to Scotland, Ireland, England or Wales) how long the drives really take.</p>
  </header>
  <main class="wrap">
    <div class="hub">
      <a href="/travel/scotland/"><h2>Scotland trip planning guide</h2><p>The UK ETA, realistic Highland drive times, three sample routes, the costs people forget and what to book when.</p></a>
      <a href="/travel/ireland/"><h2>Ireland with kids guide</h2><p>When to go, 7 and 10-night routes, real drive times, the Heritage Card and the rental car insurance catch.</p></a>
      <a href="/travel/england/"><h2>London &amp; England with kids guide</h2><p>Free Tube rides for under-11s, free museums, the London Pass and English Heritage, plus Bath, the Cotswolds, York and the Lake District.</p></a>
      <a href="/travel/wales/"><h2>Wales with kids guide</h2><p>Eryri and the Snowdon railway, castles and the Cadw pass, Pembrokeshire beaches, Cardiff and the 20 mph rule.</p></a>
      <a href="/travel/gear/"><h2>Packing &amp; gear</h2><p>What to wear in Scotland month by month, travel strollers for Europe, and carry-on bags that fit the airlines' limits.</p></a>
      <a href="/travel/gifts/"><h2>Holiday gift guides</h2><p>Gifts for travelers, outdoorsy and heritage gifts for him, and gifts for new and expecting parents, with real prices.</p></a>
      <a href="/travel/tools/travel-budget-calculator/"><h2>Travel budget calculator</h2><p>Trip total, cost per person and how much to save from each paycheck before you leave. Free.</p></a>
      <a href="/travel/tools/daily-travel-budget-calculator/"><h2>Daily travel budget</h2><p>Spending money per day for the group, per adult and per child, in your currency and the local one. Free.</p></a>
      <a href="/travel/planners/"><h2>Travel planners</h2><p>Google Sheets planners: Trip Planner &amp; Budget, Family Travel with Kids, and Scotland.</p></a>
    </div>
{FREE}{cta(["trip-planner-travel-budget", "family-travel-kids-planner", "scotland-trip-planner"], "The planners", "One-time purchase. Google Sheets or Excel, plus a printable version.")}
  </main>
''' + foot() + "</body>\n</html>\n"
    write(path, page)

def build_privacy():
    path = "/privacy/"
    page = head(path, "Privacy & Partner Links | Dark Lighthouse Solutions", "How darklighthousesolutions.com uses analytics, how checkout works, and how partner (affiliate) links work.",
                "/og-default.jpg", [], "")
    page = page.replace('<a href="/travel/" aria-current="true">Travel</a>', '<a href="/travel/">Travel</a>')
    page = re.sub(r'  <nav class="tnav".*?</nav>\n', "", page, flags=re.S)
    page += '''
  <header class="wrap hero">
    <p class="crumb"><a href="/">Home</a> › Privacy</p>
    <h1>Privacy &amp; partner links</h1>
    <p class="lede">Short version: the calculators run in your browser, we use Google Analytics to see which pages get used, and Polar handles checkout.</p>
  </header>
  <main class="wrap copy">
    <h2 id="analytics">Analytics</h2>
    <p>This site uses Google Analytics 4 to count page views and a few events (for example, that a calculator was used or a Buy button was clicked). It doesn't record what you type into the calculators: that math runs entirely in your browser and is never sent to us.</p>
    <h2 id="checkout">Checkout</h2>
    <p>Templates and planners are sold through <a href="https://polar.sh">Polar</a>, which acts as the merchant of record and handles payment, tax and your receipt. We receive your name, email and order details from Polar so we can deliver your purchase and answer questions.</p>
    <h2 id="affiliate-links">Partner (affiliate) links</h2>
    <p>Our travel pages (everything under <a href="/travel/">/travel/</a>) link to booking sites for tours, attraction tickets, car hire, eSIMs and hotels. Those pages, and the homepage, load a small script from Travelpayouts, an affiliate network, which may turn links to travel partners into affiliate links and set partner cookies so a booking can be credited to us. If you book through one, we may earn a small commission. It costs you nothing extra, it never changes the price you pay, and we only link to things we'd use ourselves.</p>
    <p>Our packing and gear guides (under <a href="/travel/gear/">/travel/gear/</a>), our holiday gift guides (under <a href="/travel/gifts/">/travel/gifts/</a>) and the "What to pack" boxes on the country guides also link to retailers and brands for clothing, luggage, strollers, baby gear and other products. Those are plain links to the retailer's own page; once a retailer's affiliate program approves us, the link may carry a tracking code so a purchase can be credited to us, and the retailer or its affiliate network (such as Impact, CJ, Rakuten Advertising, Awin, AvantLink, Partnerize or FlexOffers) may set a cookie when you click. If you buy through one, we may earn a commission. It costs you nothing extra and never changes the price you pay. Product links are marked as sponsored in the page code, and every page with them says so at the top.</p>
    <p>We pick products for what a trip actually needs, using the makers' own specifications. A commission never decides what we recommend, and we don't accept payment for placement.</p>
    <p>The Travelpayouts script only runs on travel pages and the homepage, not on the money templates, calculators or data kits.</p>
    <p>Official information (like GOV.UK, VisitScotland, the Met Office and airline baggage pages) is never a partner link.</p>
    <h2 id="extension">Renewal Radar</h2>
    <p>The Renewal Radar browser extension has its own <a href="/renewal-radar/privacy/">privacy policy</a>.</p>
    <h2 id="contact">Questions</h2>
    <p>Email <a href="mailto:admin@darklighthousesolutions.com">admin@darklighthousesolutions.com</a>.</p>
  </main>
''' + foot() + "</body>\n</html>\n"
    write(path, page)

if __name__ == "__main__":
    build_hub(); build_scotland(); build_ireland(); build_england(); build_wales(); build_gear(); build_gifts(); build_planners(); build_calcs(); build_privacy()
    print("built /travel/ (hub, scotland, ireland, england, wales, gear, gifts, planners, tools + %d calculators) and /privacy/" % len(CALCS))
