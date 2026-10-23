#!/usr/bin/env python3
"""Build the /travel/ section: hub, Scotland guide, planners, tools index + 2 calculators. Run: python3 scripts/build_travel.py
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
NAV = [("/travel/", "Travel home"), ("/travel/scotland/", "Scotland guide"), ("/travel/planners/", "Planners"), ("/travel/tools/", "Travel tools")]

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
    <p><a href="/travel/">Travel</a> · <a href="/travel/scotland/">Scotland trip planning guide</a> · <a href="/travel/planners/">Travel planners</a> · <a href="/travel/tools/travel-budget-calculator/">Travel budget calculator</a> · <a href="/travel/tools/daily-travel-budget-calculator/">Daily travel budget calculator</a> · <a href="/templates/">Money templates</a> · <a href="/tools/">Money calculators</a></p>
{d}    <p style="margin-top:.4rem">Prices and rules change: check official sites before you book. Calculators are estimates for planning; nothing you type leaves your browser.</p>
    <p style="margin-top:.4rem"><strong>Dark Lighthouse Solutions</strong> · Planners sold via Polar (merchant of record). <a href="/privacy/">Privacy</a> · Questions? <a href="mailto:admin@darklighthousesolutions.com">admin@darklighthousesolutions.com</a></p>
  </footer>
''' + ('  <script src="/travel/affiliates.js" defer></script>\n' if aff else "")

AFF_SLOT = {"gyg-edinburgh": "tour", "gyg-edinburgh-day-trips": "tour", "viator-edinburgh": "tour",
            "discovercars-edinburgh": "car", "airalo-uk": "esim", "booking-edinburgh": "stay"}

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
    links = [(f"/travel/tools/{c[0]}/", c[1]) for c in CALCS if c[0] != slug] + [("/travel/scotland/", "Scotland trip planning guide"), ("/travel/tools/", "All travel tools"), ("/tools/", "Money calculators")]
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
    <p>A good rule with kids: keep most driving days under three hours of mapped time, and never stack two long days back to back. Remember you drive on the left, and children need a car seat until they're 12 or 135 cm tall. If you're renting, automatics are less common than manuals in the UK, so book early and request the seats when you reserve. Comparison sites like {aff("discovercars-edinburgh", "Discover Cars")} show what's available at Edinburgh and Glasgow airports.</p>

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
    <p>Prefer to leave the driving to someone else for a day? Highland day tours from Edinburgh are listed on {aff("gyg-edinburgh-day-trips", "GetYourGuide")} and {aff("viator-edinburgh", "Viator")}.</p>

    <h2 id="costs">5. The costs people forget</h2>
    <p>Flights, rooms and the car will be most of your budget, and they depend so much on dates that we won't guess at them. Get real quotes. These are the smaller things that catch people out:</p>
    <ul>
      <li><strong>UK ETA:</strong> £20 per person (fixed fee).</li>
      <li><strong>Edinburgh visitor levy:</strong> 5% of the room price for the first 5 nights, for stays from 24 July 2026. <span class="est">Example</span> 5 nights at £200 a night adds £50.</li>
      <li><strong>Car seats</strong> from the rental company, if you don't bring your own, usually charged per day.</li>
      <li><strong>Ferries</strong> if you head to islands other than Skye (Skye has a bridge). Book summer car spaces early.</li>
      <li><strong>Travel insurance:</strong> check the policy covers everyone, including medical cover outside your home country and the rental car's damage excess, which is often £1,000 or more.{slot("insurance", "costs list")}</li>
      <li><strong>Phone data:</strong> check your plan's roaming charges, or use a travel eSIM such as {aff("airalo-uk", "Airalo")}.</li>
      <li><strong>Castle and attraction tickets:</strong> many big sites sell timed tickets online, and summer slots sell out. Edinburgh tours and tickets are on {aff("gyg-edinburgh", "GetYourGuide")}.</li>
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
      <li><a href="https://project-osrm.org/">Drive distances and times: OpenStreetMap data via OSRM</a></li>
    </ul>
    <p class="muted">Rules and fees change. Check the official pages before you book. Last checked 22 October 2026.</p>
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
    page = head(path, "Family Travel Planning: Budgets, Planners & a Scotland Guide | Dark Lighthouse Solutions",
                "Family travel planning without the spreadsheet headache: free travel budget calculators, a Scotland trip planning guide, a free kids packing checklist and Google Sheets trip planners.",
                "/assets/travel/travel-planner-bundle/1.jpg", [crld], "/travel/")
    page += f'''
  <header class="wrap hero">
    {cr}
    <h1>Family trips, planned on a budget</h1>
    <p class="lede">Practical tools for planning a trip with kids without blowing the budget: what it'll cost, how much to save each payday, and (if you're heading to Scotland) how long the drives really take.</p>
  </header>
  <main class="wrap">
    <div class="hub">
      <a href="/travel/scotland/"><h2>Scotland trip planning guide</h2><p>The UK ETA, realistic Highland drive times, three sample routes, the costs people forget and what to book when.</p></a>
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
    <p>Our travel pages (everything under <a href="/travel/">/travel/</a>) link to booking sites for tours, car hire, eSIMs and hotels. Those pages load a small script from Travelpayouts, an affiliate network, which may turn links to travel partners into affiliate links and set partner cookies so a booking can be credited to us. If you book through one, we may earn a small commission. It costs you nothing extra, it never changes the price you pay, and we only link to things we'd use ourselves.</p>
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
    build_hub(); build_scotland(); build_planners(); build_calcs(); build_privacy()
    print("built /travel/ (hub, scotland, planners, tools + %d calculators) and /privacy/" % len(CALCS))
