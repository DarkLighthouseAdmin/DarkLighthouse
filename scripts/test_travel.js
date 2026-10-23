// Math tests for /travel/tools/travel-calc.js. Run: node scripts/test_travel.js
const C = require("../travel/tools/travel-calc.js");
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL:", m); } }
function near(a, b, t, m) { ok(Math.abs(a - b) <= t, `${m}: got ${a}, want ${b}`); }
const D = (y, m, d) => new Date(y, m - 1, d), iso = d => d.toISOString().slice(0, 10);

// Trip cost: 4 people, 7 nights, $650 flights pp, $180/night, $40 food pp/day, 300 activities, 450 car, 100 other, 10% buffer
let t = C.tripCost({ travelers: 4, nights: 7, flight: 650, lodging: 180, food: 40, activities: 300, transport: 450, other: 100, buffer: 10 });
ok(t.days === 8, "7 nights = 8 days");
ok(t.subtotal === 2600 + 1260 + 1280 + 850, "subtotal by hand = 5990, got " + t.subtotal);
ok(t.total === 6589, "total incl 10% buffer = 6589, got " + t.total);
near(t.perPerson, 1647.25, 0.001, "per person");
ok(t.lines.reduce((s, l) => s + l.amount, 0) === t.total, "lines add up to total");
t = C.tripCost({ travelers: 1, nights: 0, flight: 0, lodging: 0, food: 25, buffer: 0 });
ok(t.total === 25 && t.days === 1, "day trip, food only");

// Paydays
let p = C.paydays(D(2026, 10, 23), D(2027, 6, 1), "biweekly");
ok(p.length === 16, "biweekly Oct 23 2026 -> Jun 1 2027 = 16 paydays, got " + p.length);
ok(iso(p[15]) === iso(D(2027, 5, 21)), "last biweekly payday May 21, got " + p[15]);
ok(C.paydays(D(2026, 10, 23), D(2026, 10, 23), "weekly").length === 0, "payday on departure day doesn't count");
ok(C.paydays(D(2026, 10, 23), D(2026, 10, 24), "weekly").length === 1, "payday the day before counts");
p = C.paydays(D(2026, 1, 31), D(2026, 6, 1), "monthly");
ok(p.map(d => d.getDate()).join() === "31,28,31,30,31", "monthly on the 31st clamps: " + p.map(d => d.getDate()));
p = C.paydays(D(2026, 10, 20), D(2026, 12, 20), "semimonthly");
ok(p.map(d => iso(d)).join() === [D(2026,11,1),D(2026,11,15),D(2026,12,1),D(2026,12,15)].map(iso).join(), "semimonthly 1st & 15th");
ok(C.paydays(D(2026, 10, 1), D(2026, 10, 2), "semimonthly").length === 1, "semimonthly starting on the 1st");
ok(C.paydays(D(2026, 10, 1), D(2027, 10, 1), "weekly").length === 53, "weekly for a year (365 days) = 53");

// Save plan
let s = C.savePlan(5037.40, 200, D(2026, 10, 23), D(2027, 6, 1), "biweekly");
ok(s.ok && s.count === 16 && s.per === 303, "4837.40 over 16 -> 303/payday (rounded up), got " + s.per);
ok(s.per * s.count >= s.left, "rounded amount reaches the goal");
ok(C.savePlan(1000, 1500, D(2026, 10, 23), D(2027, 1, 1), "weekly").done, "already saved enough");
ok(!C.savePlan(1000, 0, D(2027, 2, 1), D(2027, 1, 1), "weekly").ok, "no paydays before departure is flagged");

// Daily budget: $3,000 total, $1,800 prepaid, 6 days, 2 adults + 2 kids at 50%, rate 0.79 GBP per USD, 10% buffer
let b = C.dailyBudget({ total: 3000, prepaid: 1800, days: 6, adults: 2, kids: 2, kidShare: 50, rate: 0.79, buffer: 10 });
ok(b.ok && b.hold === 120 && b.pot === 1080, "pot 1080 after 120 buffer");
ok(b.perDay.home === 180 && b.perDay.local === 142.2, "180/day = 142.20 local, got " + JSON.stringify(b.perDay));
ok(b.perAdult.home === 60 && b.perKid.home === 30, "adult 60, kid 30 (3 adult-equivalents)");
near(b.perAdult.home * 2 + b.perKid.home * 2, b.perDay.home, 0.01, "shares add back to the day");
ok(b.perPersonEven.home === 45, "even split 45");
ok(!C.dailyBudget({ total: 1000, prepaid: 1000, days: 3, adults: 1 }).ok, "nothing left after prepaid is flagged");
b = C.dailyBudget({ total: 700, days: 7, adults: 1, kids: 0, rate: 1 });
ok(b.perDay.home === 100 && b.perAdult.home === 100, "defaults: no buffer, kids 0, rate 1");
// Randomised: shares always sum back to the daily pot
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let k = 0; k < 1000; k++) {
  const i = { total: 500 + rnd() * 20000, prepaid: rnd() * 400, days: 1 + Math.floor(rnd() * 30), adults: 1 + Math.floor(rnd() * 4),
              kids: Math.floor(rnd() * 5), kidShare: Math.floor(rnd() * 101), rate: 0.2 + rnd() * 150, buffer: Math.floor(rnd() * 30) };
  const r = C.dailyBudget(i);
  if (!r.ok) continue;
  const back = r.perAdult.home * i.adults + r.perKid.home * i.kids;
  if (Math.abs(back - r.perDay.home) > 0.02 * (i.adults + i.kids) + 0.01) { ok(false, "shares sum " + JSON.stringify(i)); break; }
}
ok(true, "random share check");

// Ireland guide page (built by scripts/build_travel.py)
const fs = require("fs"), path = require("path"), R = p => path.join(__dirname, "..", p);
const ie = fs.readFileSync(R("travel/ireland/index.html"), "utf8");
const affj = JSON.parse(fs.readFileSync(R("travel/affiliates.json"), "utf8")).links;
ok(/<title>Ireland with Kids[^<]*\| Dark Lighthouse Solutions<\/title>/.test(ie), "ireland: title");
ok(ie.includes('<link rel="canonical" href="https://darklighthousesolutions.com/travel/ireland/" />'), "ireland: canonical");
const lds = [...ie.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
ok(["Article", "FAQPage", "BreadcrumbList"].every(t => lds.some(x => x["@type"] === t)), "ireland: Article + FAQ + Breadcrumb JSON-LD parse");
["when", "driving", "car-insurance", "routes", "costs", "packing", "kids", "timeline", "faq", "sources"].forEach(id => ok(ie.includes(`id="${id}"`), "ireland: section #" + id));
ok(ie.includes('class="disclose"') && ie.includes("/privacy/#affiliate-links"), "ireland: affiliate disclosure");
ok(ie.includes("emrldtp.cc/NTg5NTIy.js") && ie.includes('/travel/affiliates.js'), "ireland: Travelpayouts Drive + affiliates.js");
// "What to pack" boxes hold 3-5 retail product links; the 2-6 booking-link cap applies outside the box.
const PACK_RE = /<aside class="packbox"[\s\S]*?<\/aside>/;
const packKeys = h => { const m = h.match(PACK_RE); return m ? [...m[0].matchAll(/data-affiliate="([^"]+)"/g)].map(x => x[1]) : []; };
const bookingKeys = h => [...h.replace(PACK_RE, "").matchAll(/data-affiliate="([^"]+)"/g)].map(m => m[1]);
const packChecks = (slug, h) => {
  const pk = packKeys(h);
  ok(pk.length >= 3 && pk.length <= 5, slug + ": What to pack box has 3-5 product links, got " + pk.length);
  ["what-to-wear-in-scotland", "best-travel-stroller-europe", "best-carry-on-luggage-family-travel"].forEach(g => ok((h.match(PACK_RE) || [""])[0].includes(`href="/travel/gear/${g}/"`), slug + ": pack box links to gear page " + g));
  ok(h.indexOf('class="disclose"') > -1 && h.indexOf('class="disclose"') < h.indexOf("data-affiliate="), slug + ": disclosure before first partner link");
  ok(h.includes("Some links on this page are affiliate links. If you book or buy through them we may earn a commission at no extra cost to you."), slug + ": FTC disclosure wording");
};
const keys = [...ie.matchAll(/data-affiliate="([^"]+)"/g)].map(m => m[1]);
const ieBook = bookingKeys(ie);
ok(ieBook.length >= 2 && ieBook.length <= 6, "ireland: 2-6 booking partner links, got " + ieBook.length);
packChecks("ireland", ie);
keys.forEach(k => ok(affj[k] && ie.includes(`href="${affj[k].plain_url.replace(/&/g, "&amp;")}"`), "ireland: partner link matches affiliates.json: " + k));
ok([...ie.matchAll(/<a [^>]*data-affiliate[^>]*>/g)].every(m => m[0].includes('rel="sponsored nofollow noopener"')), "ireland: partner links are rel=sponsored");
ok(/Republic of Ireland/.test(ie) && ie.includes("usa.visa.com") && ie.includes("americanexpress.com"), "ireland: card rental coverage note with sources");
ok(ie.includes("Heritage Card") && ie.includes("heritageireland.ie"), "ireland: Heritage Card sourced");
ok(/Giant's Causeway/.test(ie) && /UK ETA/.test(ie), "ireland: Northern Ireland / UK ETA note");
ok(ie.includes("#trip-planner-travel-budget") || ie.includes('id="trip-planner-travel-budget"'), "ireland: Trip Planner card");
ok(ie.includes('id="family-travel-kids-planner"'), "ireland: Family Travel planner card");
ok(!/work-account|work-account/i.test(ie), "ireland: no personal identities");
ok(fs.readFileSync(R("travel/index.html"), "utf8").includes('href="/travel/ireland/"'), "hub links to Ireland guide");
ok(fs.readFileSync(R("sitemap.xml"), "utf8").includes("<loc>https://darklighthousesolutions.com/travel/ireland/</loc>"), "sitemap has Ireland guide");
ok(/credit card's rental car cover/.test(fs.readFileSync(R("travel/scotland/index.html"), "utf8")), "scotland: card cover note");

// England and Wales guide pages
const guideChecks = (slug, titleRe, ids, extra) => {
  const h = fs.readFileSync(R(`travel/${slug}/index.html`), "utf8");
  ok(titleRe.test(h), slug + ": title");
  ok(h.includes(`<link rel="canonical" href="https://darklighthousesolutions.com/travel/${slug}/" />`), slug + ": canonical");
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  ok(["Article", "FAQPage", "BreadcrumbList"].every(t => ld.some(x => x["@type"] === t)), slug + ": Article + FAQ + Breadcrumb JSON-LD parse");
  ids.forEach(id => ok(h.includes(`id="${id}"`), slug + ": section #" + id));
  ok(h.includes('class="disclose"') && h.includes("/privacy/#affiliate-links"), slug + ": affiliate disclosure");
  ok(h.includes("emrldtp.cc/NTg5NTIy.js") && h.includes('/travel/affiliates.js'), slug + ": Travelpayouts Drive + affiliates.js");
  const ks = [...h.matchAll(/data-affiliate="([^"]+)"/g)].map(m => m[1]);
  const bk = bookingKeys(h);
  ok(bk.length >= 2 && bk.length <= 6, slug + ": 2-6 booking partner links, got " + bk.length);
  packChecks(slug, h);
  ok(new Set(ks).size === ks.length, slug + ": no duplicate partner links");
  ks.forEach(k => ok(affj[k] && h.includes(`href="${affj[k].plain_url.replace(/&/g, "&amp;")}"`), slug + ": partner link matches affiliates.json: " + k));
  ok([...h.matchAll(/<a [^>]*data-affiliate[^>]*>/g)].every(m => m[0].includes('rel="sponsored nofollow noopener"')), slug + ": partner links are rel=sponsored");
  ok(/UK ETA/.test(h) && h.includes("https://www.gov.uk/eta") && h.includes("£20 per person"), slug + ": UK ETA note");
  ok(/excludes only Northern Ireland within the UK/.test(h) && h.includes("usa.visa.com") && h.includes("americanexpress.com"), slug + ": card rental coverage note with sources");
  ok(h.includes('id="trip-planner-travel-budget"') && h.includes('id="family-travel-kids-planner"'), slug + ": planner cards");
  ok(!/work-account|work-account/i.test(h), slug + ": no personal identities");
  ok(fs.readFileSync(R("travel/index.html"), "utf8").includes(`href="/travel/${slug}/"`), "hub links to " + slug);
  ok(fs.readFileSync(R("sitemap.xml"), "utf8").includes(`<loc>https://darklighthousesolutions.com/travel/${slug}/</loc>`), "sitemap has " + slug);
  ok(fs.readFileSync(R("travel/scotland/index.html"), "utf8").includes(`href="/travel/${slug}/"`), "scotland footer links to " + slug);
  extra(h);
};
const common = ["before", "when", "driving", "car-insurance", "routes", "costs", "packing", "kids", "timeline", "planner", "faq", "sources"];
guideChecks("england", /<title>London &amp; England with Kids[^<]*\| Dark Lighthouse Solutions<\/title>/, common.concat(["london"]), h => {
  ok(h.includes("Overseas Visitor Pass") && h.includes("english-heritage.org.uk"), "england: English Heritage pass sourced");
  ok(h.includes("Historic Royal Palaces") && h.includes("hrp.org.uk"), "england: Historic Royal Palaces sourced");
  ok(h.includes('data-affiliate="gocity-london"'), "england: London Pass via Go City link");
  ok(h.includes("tfl.gov.uk") && /under 11/i.test(h), "england: TfL kids-free note sourced");
  ok(/Bath/.test(h) && /Cotswolds/.test(h) && /York/.test(h) && /Lake District/.test(h), "england: beyond-London options");
});
guideChecks("wales", /<title>Wales with Kids[^<]*\| Dark Lighthouse Solutions<\/title>/, common.concat(["places"]), h => {
  ok(h.includes("Cadw Explorer Pass") && h.includes("cadw.gov.wales"), "wales: Cadw pass sourced");
  ok(/Eryri/.test(h) && /Pembrokeshire/.test(h) && /Cardiff/.test(h) && /castle/i.test(h), "wales: Eryri, castles, Pembrokeshire, Cardiff");
  ok(/20 mph/.test(h) && h.includes("gov.wales"), "wales: 20 mph note sourced");
  ok(!h.includes("gocity"), "wales: no Go City link (no Wales pass)");
});

// Scotland "What to pack" box
const sc = fs.readFileSync(R("travel/scotland/index.html"), "utf8");
packChecks("scotland", sc);
[...sc.matchAll(/data-affiliate="([^"]+)"/g)].forEach(m => ok(affj[m[1]] && sc.includes(`href="${affj[m[1]].plain_url.replace(/&/g, "&amp;")}"`), "scotland: partner link matches affiliates.json: " + m[1]));
ok(sc.includes('/travel/affiliates.js'), "scotland: affiliates.js loaded");

// Packing & gear pages
const GEAR = ["what-to-wear-in-scotland", "best-travel-stroller-europe", "best-carry-on-luggage-family-travel"];
const FTC = "Some links on this page are affiliate links. If you book or buy through them we may earn a commission at no extra cost to you.";
const NETWORKS = ["Impact", "CJ", "Rakuten Advertising", "Awin", "AvantLink", "Partnerize", "FlexOffers"];
const sm = fs.readFileSync(R("sitemap.xml"), "utf8"), hub = fs.readFileSync(R("travel/index.html"), "utf8");
["", ...GEAR].forEach(g => {
  const p = "/travel/gear/" + (g ? g + "/" : ""), slug = "gear" + (g ? "/" + g : "");
  const h = fs.readFileSync(R(p.slice(1) + "index.html"), "utf8");
  ok(h.includes(`<link rel="canonical" href="https://darklighthousesolutions.com${p}" />`), slug + ": canonical");
  ok(/<title>[^<]+\| Dark Lighthouse Solutions<\/title>/.test(h), slug + ": title");
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const faq = ld.find(x => x["@type"] === "FAQPage");
  ok(faq && faq.mainEntity.length >= 2 && faq.mainEntity.every(q => q.name && q.acceptedAnswer && q.acceptedAnswer.text), slug + ": FAQPage JSON-LD");
  ok(["Article", "BreadcrumbList"].every(t => ld.some(x => x["@type"] === t)), slug + ": Article + Breadcrumb JSON-LD");
  const main = h.slice(h.indexOf('<header class="wrap hero">'));
  const di = main.indexOf(FTC), firstLink = main.indexOf("<a ");
  ok(di > -1 && di < firstLink, slug + ": FTC disclosure is before the first link in the page content");
  ok(main.slice(0, main.indexOf("</p>", di) + 4).includes('href="/privacy/#affiliate-links"'), slug + ": disclosure links to /privacy/#affiliate-links");
  ok(!/As an Amazon Associate/.test(h) && !/amazon\.com/.test(h), slug + ": no Amazon links or Amazon sentence yet");
  ok(!/\b(whisk(e)?y|beer|wine|gin|pubs?|distiller(y|ies)|alcohol|cocktails?|brewer(y|ies))\b/i.test(h.replace(/<script[\s\S]*?<\/script>/g, "")), slug + ": no alcohol content");
  ok(!/work-account|work-account/i.test(h), slug + ": no personal identities");
  ok(!/Dark Lighthouse Solutions/.test(h.slice(h.indexOf("<main"), h.indexOf("</main>"))), slug + ": brand name only in the credit, not the page copy");
  ok(h.includes('href="/travel/gear/"') && h.includes("Packing &amp; gear"), slug + ": section nav has Packing & gear");
  ok(h.includes('/travel/affiliates.js'), slug + ": affiliates.js loaded");
  ok(sm.includes(`<loc>https://darklighthousesolutions.com${p}</loc>`), "sitemap has " + p);
  const tags = [...h.matchAll(/<a [^>]*data-affiliate="([^"]+)"[^>]*>/g)];
  if (g) ok(tags.length >= 4, slug + ": has product links, got " + tags.length);
  tags.forEach(m => {
    const k = m[1], a = affj[k];
    ok(a && m[0].includes(`href="${a.plain_url.replace(/&/g, "&amp;")}"`), slug + ": link matches affiliates.json: " + k);
    ok(m[0].includes('rel="sponsored nofollow noopener"'), slug + ": rel=sponsored: " + k);
    ok(a && a.status === "not-joined" && a.tracked_url === "" && NETWORKS.includes(a.network) && a.program.includes(a.network), slug + ": not-joined with program and network named: " + k);
  });
  if (g) ok(new Set(tags.map(m => m[1])).size === tags.length, slug + ": no duplicate product links");
  if (g) ok(hub.includes(`href="/travel/gear/"`) && fs.readFileSync(R("travel/gear/index.html"), "utf8").includes(`href="${p}"`), "hubs link to " + slug);
  if (g) ok(sc.includes(`href="${p}"`), "scotland pack box links to " + slug);
});
const wear = fs.readFileSync(R("travel/gear/what-to-wear-in-scotland/index.html"), "utf8");
ok(wear.includes("metoffice.gov.uk") && /72 mm/.test(wear) && /Oct<\/td><td>13°C/.test(wear), "wear: Met Office monthly table");
ok(/<td>Jan<\/td>/.test(wear) && /<td>Dec<\/td>/.test(wear), "wear: all 12 months");
ok(wear.includes("orvis-barbour-bedale") && wear.includes("orvis-barbour-beadnell") && wear.includes("bespokepost-barbour-transport"), "wear: Barbour via retailers");
ok(/href="https:\/\/www\.sierra\.com[^"]*" rel="noopener"/.test(wear) && !/data-affiliate="sierra/.test(wear), "wear: Sierra is a plain, non-sponsored link");
const str = fs.readFileSync(R("travel/gear/best-travel-stroller-europe/index.html"), "utf8");
["Doona", "YOYO", "Minu", "Nuna", "Mockingbird"].forEach(n => ok(str.includes(n), "stroller page covers " + n));
ok(/cobble/i.test(str) && /train/i.test(str) && /ferr/i.test(str), "stroller page: cobbles, trains, ferries");
const lug = fs.readFileSync(R("travel/gear/best-carry-on-luggage-family-travel/index.html"), "utf8");
["United", "Delta", "American", "British Airways", "Aer Lingus", "Ryanair", "easyJet"].forEach(n => ok(lug.includes(n), "luggage page: " + n + " limit"));
ok(lug.includes("ridge-carry-on") && lug.includes("target-trunki") && lug.includes("peakdesign-packing-cube"), "luggage page: suitcase, ride-on, packing cubes");
ok(lug.includes("bespokepost-weekender") && lug.includes("bespokepost-sidecar-toiletry-kit"), "luggage page: Bespoke Post weekend bags");
ok(str.includes("mockingbird-travel-stroller") && str.includes("mockingbird-single-to-double") && /34 × 26 × 18 in/.test(str), "stroller page: Mockingbird travel + Single-to-Double with real size");
const priv = fs.readFileSync(R("privacy/index.html"), "utf8");
ok(priv.includes('id="affiliate-links"') && /retailers/.test(priv) && /\/travel\/gear\//.test(priv) && !/Amazon/.test(priv), "privacy: covers retail/product links, no Amazon sentence");
ok(fs.readFileSync(R("index.html"), "utf8").includes("impact-site-verification"), "homepage keeps Impact verification meta");
ok(fs.readFileSync(R("index.html"), "utf8").includes('href="/travel/gear/"'), "homepage footer links to gear");

// Holiday gift guides
const GIFTS = ["gifts-for-travelers", "gifts-for-him-outdoors", "gifts-for-new-parents"];
const giftHub = fs.readFileSync(R("travel/gifts/index.html"), "utf8");
["", ...GIFTS].forEach(g => {
  const p = "/travel/gifts/" + (g ? g + "/" : ""), slug = "gifts" + (g ? "/" + g : "");
  const h = fs.readFileSync(R(p.slice(1) + "index.html"), "utf8");
  ok(h.includes(`<link rel="canonical" href="https://darklighthousesolutions.com${p}" />`), slug + ": canonical");
  ok(/<title>[^<]+\| Dark Lighthouse Solutions<\/title>/.test(h), slug + ": title");
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const faq = ld.find(x => x["@type"] === "FAQPage");
  ok(faq && faq.mainEntity.length >= 2 && faq.mainEntity.every(q => q.name && q.acceptedAnswer && q.acceptedAnswer.text && !/</.test(q.acceptedAnswer.text)), slug + ": FAQPage JSON-LD");
  ok(["Article", "BreadcrumbList"].every(t => ld.some(x => x["@type"] === t)), slug + ": Article + Breadcrumb JSON-LD");
  ok(ld.some(x => x["@type"] === "Article" && x.datePublished === "2026-10-23"), slug + ": Article dated 2026-10-23");
  const main = h.slice(h.indexOf('<header class="wrap hero">'));
  const di = main.indexOf(FTC), firstLink = main.indexOf("<a ");
  ok(di > -1 && di < firstLink, slug + ": FTC disclosure is before the first link in the page content");
  ok(main.slice(0, main.indexOf("</p>", di) + 4).includes('href="/privacy/#affiliate-links"'), slug + ": disclosure links to /privacy/#affiliate-links");
  ok(!/As an Amazon Associate/.test(h) && !/amazon\.com/i.test(h), slug + ": no Amazon links or Amazon sentence yet");
  ok(!/\b(whisk(e)?y|beer|wine|gin|pubs?|distiller(y|ies)|alcohol|cocktails?|brewer(y|ies))\b/i.test(h.replace(/<script[\s\S]*?<\/script>/g, "")), slug + ": no alcohol content");
  ok(!/work-account|work-account/i.test(h), slug + ": no personal identities");
  ok(!/Dark Lighthouse Solutions/.test(h.slice(h.indexOf("<main"), h.indexOf("</main>"))), slug + ": brand name only in the credit, not the page copy");
  ok(h.includes('href="/travel/gifts/"') && h.includes(">Gift guides</a>"), slug + ": section nav has Gift guides");
  ok(h.includes('/travel/affiliates.js'), slug + ": affiliates.js loaded");
  ok(sm.includes(`<loc>https://darklighthousesolutions.com${p}</loc>`), "sitemap has " + p);
  ok(h.includes("/templates/#holiday-gift-budget-planner"), slug + ": links the Holiday Gift & Budget Planner");
  const tags = [...h.matchAll(/<a [^>]*data-affiliate="([^"]+)"[^>]*>/g)];
  tags.forEach(m => {
    const k = m[1], a = affj[k];
    ok(a && m[0].includes(`href="${a.plain_url.replace(/&/g, "&amp;")}"`), slug + ": link matches affiliates.json: " + k);
    ok(m[0].includes('rel="sponsored nofollow noopener"'), slug + ": rel=sponsored: " + k);
    ok(a && a.status === "not-joined" && a.tracked_url === "" && NETWORKS.includes(a.network) && a.program.includes(a.network), slug + ": not-joined with program and network named: " + k);
  });
  if (!g) { ok(tags.length === 0, "gifts hub: no product links"); return; }
  ok(tags.length >= 8 && tags.length <= 15, slug + ": 8-15 picks, got " + tags.length);
  ok(new Set(tags.map(m => m[1])).size === tags.length, slug + ": no duplicate product links");
  const cards = [...h.matchAll(/<div class="prod" id="p-([^"]+)">([\s\S]*?)<\/div>/g)];
  ok(cards.length === tags.length, slug + ": one card per pick");
  cards.forEach(c => ok(/<strong>\$[0-9][^<]*<\/strong> when we checked/.test(c[2]), slug + ": price shown for " + c[1]));
  const il = ld.find(x => x["@type"] === "ItemList");
  ok(il && il.numberOfItems === tags.length && il.itemListElement.length === tags.length, slug + ": ItemList matches picks");
  ok(/23 October 2026/.test(h) && h.includes('id="sources"'), slug + ": dated sources section");
  ok(giftHub.includes(`href="${p}"`) && hub.includes('href="/travel/gifts/"'), "hubs link to " + slug);
});
const giftPar = fs.readFileSync(R("travel/gifts/gifts-for-new-parents/index.html"), "utf8");
["mockingbird-travel-stroller", "babylist-", "doona-x", "babylist-ergobaby-omni-deluxe"].forEach(k => ok(giftPar.includes(`data-affiliate="${k}`), "parents gifts: " + k));
ok(giftPar.includes('id="family-travel-kids-planner"') && giftPar.includes("just-in-case-binder"), "parents gifts: Polar planner + binder mentions");
const giftHim = fs.readFileSync(R("travel/gifts/gifts-for-him-outdoors/index.html"), "utf8");
["bespokepost-barbour-transport", "llbean-bean-boots-8", "saxx-quest-boxer-brief", "darntough-mens-hiker-3-pack", "smartwool-classic-thermal-crew"].forEach(k => ok(giftHim.includes(`data-affiliate="${k}"`), "him gifts: " + k));
const giftTr = fs.readFileSync(R("travel/gifts/gifts-for-travelers/index.html"), "utf8");
["ridge-carry-on", "cotopaxi-allpa-35", "peakdesign-packing-cube", "bellroy-travel-wallet", "fjallraven-kanken-mini", "osprey-daylite-plus"].forEach(k => ok(giftTr.includes(`data-affiliate="${k}"`), "traveler gifts: " + k));
ok(/\/travel\/gifts\//.test(priv), "privacy: mentions gift guides");
ok(fs.readFileSync(R("index.html"), "utf8").includes('href="/travel/gifts/"'), "homepage footer links to gift guides");

// Kids' clothes lists (counts by trip length, no product links) on every family packing page
const KC_RE = /<section class="kidsclothes" id="kids-clothes">[\s\S]*?<\/section>/;
["travel/scotland/", "travel/ireland/", "travel/england/", "travel/wales/", "travel/gear/what-to-wear-in-scotland/", "travel/gear/best-travel-stroller-europe/", "travel/gear/best-carry-on-luggage-family-travel/"].forEach(p => {
  const h = fs.readFileSync(R(p + "index.html"), "utf8"), m = h.match(KC_RE), kc = m ? m[0] : "";
  ok(!!m, p + ": kids' clothes section");
  ["Base layers", "Fleece", "Waterproof jacket", "puddle suit", "Warm hat", "Sun hat", "Pyjamas", "Socks", "Underwear", "wellies", "trainers", "Swimwear", "nicer outfit", "Spare outfit in the carry-on", "sleep sack", "Extra changes", "Bibs"].forEach(w => ok(kc.toLowerCase().includes(w.toLowerCase()), p + ": kids' clothes list has " + w));
  ok(/<th>Weekend<\/th><th>1 week<\/th><th>2 weeks<\/th>/.test(kc), p + ": kids' clothes counts by trip length");
  ok(!kc.includes("data-affiliate"), p + ": kids' clothes list has no partner links");
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
