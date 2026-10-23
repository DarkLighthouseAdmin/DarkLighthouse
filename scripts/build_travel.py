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
"""
# Travelpayouts "Drive" snippet (Matt's account, id 589522). Emitted on /travel/ pages ONLY, never other sections.
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
NAV = [("/travel/", "Travel home"), ("/travel/scotland/", "Scotland guide"), ("/travel/ireland/", "Ireland guide"), ("/travel/england/", "England guide"), ("/travel/wales/", "Wales guide"), ("/travel/planners/", "Planners"), ("/travel/tools/", "Travel tools")]

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
    d = ('    <p style="margin-top:.4rem">Some links on this page may be affiliate links (via Travelpayouts): if you book, we may earn a small commission at no extra cost to you. '
         'We only link to things we\'d use ourselves. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>\n') if aff else ""
    return f'''
  <footer class="wrap">
    <p><a href="/travel/">Travel</a> · <a href="/travel/scotland/">Scotland trip planning guide</a> · <a href="/travel/ireland/">Ireland with kids guide</a> · <a href="/travel/england/">London &amp; England with kids guide</a> · <a href="/travel/wales/">Wales with kids guide</a> · <a href="/travel/planners/">Travel planners</a> · <a href="/travel/tools/travel-budget-calculator/">Travel budget calculator</a> · <a href="/travel/tools/daily-travel-budget-calculator/">Daily travel budget calculator</a> · <a href="/templates/">Money templates</a> · <a href="/tools/">Money calculators</a></p>
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
    <p class="disclose">A few links below go to booking sites. Our travel pages use Travelpayouts, which may turn some of them into affiliate links: if you book, we may earn a small commission at no extra cost to you. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>

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
    <p class="disclose">A few links below go to booking sites. Our travel pages use Travelpayouts, which may turn some of them into affiliate links: if you book, we may earn a small commission at no extra cost to you. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>

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
DISCLOSE = '    <p class="disclose">A few links below go to booking sites. Our travel pages use Travelpayouts, which may turn some of them into affiliate links: if you book, we may earn a small commission at no extra cost to you. <a href="/privacy/#affiliate-links">How partner links work</a>.</p>\n'

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
    <p>The script only runs on travel pages, not on the money templates, calculators or data kits.</p>
    <p>Official information (like GOV.UK and VisitScotland) is never a partner link.</p>
    <h2 id="extension">Renewal Radar</h2>
    <p>The Renewal Radar browser extension has its own <a href="/renewal-radar/privacy/">privacy policy</a>.</p>
    <h2 id="contact">Questions</h2>
    <p>Email <a href="mailto:admin@darklighthousesolutions.com">admin@darklighthousesolutions.com</a>.</p>
  </main>
''' + foot() + "</body>\n</html>\n"
    write(path, page)

if __name__ == "__main__":
    build_hub(); build_scotland(); build_ireland(); build_england(); build_wales(); build_planners(); build_calcs(); build_privacy()
    print("built /travel/ (hub, scotland, ireland, planners, tools + %d calculators) and /privacy/" % len(CALCS))
