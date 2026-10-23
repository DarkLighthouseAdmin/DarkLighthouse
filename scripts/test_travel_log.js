// Tests for the My Lifetime Travel Log app (/travel-log/app/). Run: node scripts/test_travel_log.js
const fs = require("fs"), path = require("path");
const APP = path.join(__dirname, "..", "travel-log", "app");
const M = require("../travel-log/app/log-core.js");
global.self = global.self || {}; require("../travel-log/app/maps.js"); const MAPS = global.self.MLTL_MAPS;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL:", m); } }
function throws(fn, re, m) { try { fn(); ok(false, m + " (didn't throw)"); } catch (e) { ok(re.test(e.message), m + ": " + e.message); } }
const read = f => fs.readFileSync(path.join(APP, f), "utf8");

// ---- map data ----
ok(MAPS && MAPS.us && MAPS.world, "maps.js sets self.MLTL_MAPS");
ok(MAPS.us.shapes.length === 51, "51 US shapes (50 states + DC), got " + MAPS.us.shapes.length);
ok(new Set(MAPS.us.shapes.map(s => s.id)).size === 51, "US ids unique");
["AK", "HI", "DC", "RI", "TX"].forEach(id => ok(MAPS.us.shapes.some(s => s.id === id), "US has " + id));
ok(MAPS.world.countries.length === 195, "195 countries on the list");
ok(new Set(MAPS.world.countries.map(c => c.id)).size === 195, "country ids unique");
ok(MAPS.world.uk.map(u => u.id).join() === "ENG,SCT,WLS,NIR", "UK nations: England, Scotland, Wales, Northern Ireland");
const wids = new Set(MAPS.world.shapes.map(s => s.id));
["ENG", "SCT", "WLS", "NIR"].forEach(id => ok(wids.has(id) && MAPS.world.shapes.find(s => s.id === id).uk, id + " is its own shape, flagged uk"));
ok(!wids.has("GBR"), "no single United Kingdom shape (it's split into 4)");
MAPS.world.countries.forEach(c => { if (c.id !== "GBR") ok(wids.has(c.id), "map shape for " + c.name); });
ok(MAPS.world.countries.some(c => c.name === "Vatican City") && MAPS.world.countries.some(c => c.name === "Palestine"), "195 includes Vatican City and Palestine");
const conts = new Set(MAPS.world.countries.map(c => c.cont)); ok(conts.size === 6, "countries across 6 inhabited continents, got " + [...conts]);
const pts = s => s.d.split(/[MLZ]/).filter(Boolean).length;
MAPS.us.shapes.forEach(s => ok(pts(s) >= 4 && /^M[\d.,L\-MZ]+$/.test(s.d), "US path looks real: " + s.id));
MAPS.world.shapes.filter(s => !s.other && pts(s) < 4).forEach(s => ok(s.dot, "tiny country " + s.id + " gets a tap dot"));
ok(MAPS.world.shapes.filter(s => pts(s) >= 4).length > 190, "world paths aren't collapsed to points");
ok(MAPS.world.shapes.filter(s => !s.other).every(s => Array.isArray(s.c) && s.c.length === 2), "every country shape has a center for its tap dot");
ok(/Natural Earth/.test(MAPS.source || ""), "map source credited");

// ---- parks ----
ok(M.PARKS.length === 64, "64 national parks, got " + M.PARKS.length);
ok(new Set(M.PARKS.map(p => p.id)).size === 64, "park ids unique");
["zion", "yellowstone", "new-river-gorge", "american-samoa", "gateway-arch", "haleakala", "white-sands"].forEach(id => ok(M.PARKS.some(p => p.id === id), "park " + id));

// ---- kids, map coloring, trips ----
throws(() => M.newKid({ name: "  " }), /name/i, "kid needs a name");
const a = M.newKid({ name: "Ellie", birthYear: 2016, color: M.COLORS[1] }), b = M.newKid({ name: "<b>Sam</b>", birthYear: 1850, color: "red" });
ok(/^person_[0-9a-f]{16}$/.test(a.id) && a.id !== b.id, "profile ids are random and distinct");
ok(a.birthYear === 2016 && b.birthYear === null, "silly birth years are dropped");
ok(b.color === M.COLORS[0], "unknown color falls back to the first");
ok(M.toggleArea(a, "state", "UT", null) === true && a.states.UT, "tap colors a state");
ok(M.toggleArea(a, "state", "UT", null) === false && !a.states.UT, "tap again un-colors it");
["UT", "AZ", "CA", "NV", "CO", "DC"].forEach(s => M.toggleArea(a, "state", s, true));
let s = M.stats(a, [], MAPS.world);
ok(s.states === 5, "DC is a bonus, not a 51st state: " + s.states);
ok(s.countries === 1 && s.abroad === 0, "any state counts as the USA");
M.toggleArea(a, "place", "SCT", true);
s = M.stats(a, [], MAPS.world);
ok(s.countries === 2 && s.ukNations === 1 && s.scotland, "Scotland counts as the UK once");
["ENG", "WLS", "NIR"].forEach(id => M.toggleArea(a, "place", id, true));
s = M.stats(a, [], MAPS.world);
ok(s.countries === 2 && s.ukNations === 4, "four UK nations still = 1 country");
M.toggleArea(a, "place", "PRI", true); M.toggleArea(a, "place", "JPN", true);
s = M.stats(a, [], MAPS.world);
ok(s.countries === 3 && s.otherPlaces === 1, "Puerto Rico shows on the map but isn't one of the 195");
ok(s.continents === 3, "N. America + Europe + Asia = 3 continents, got " + s.continents);
M.togglePark(a, "zion", undefined, true); M.togglePark(a, "acadia", "jr", true);
s = M.stats(a, [], MAPS.world);
ok(s.parks === 2 && s.juniorRanger === 1, "parks + Junior Ranger counted");
M.togglePark(a, "acadia", undefined, false); s = M.stats(a, [], MAPS.world);
ok(s.parks === 1 && s.juniorRanger === 0, "un-visiting a park clears its ranger badge");

throws(() => M.newTrip({ kidIds: [a.id] }), /place/i, "trip needs a place");
throws(() => M.newTrip({ place: "Zion" }), /person/i, "trip needs a person");
const t1 = M.newTrip({ kidIds: [a.id, b.id], place: "  Isle of Skye ", date: "2026-07-14", who: "Mom, Dad", memory: "A hairy coo in the road", mark: { kind: "place", id: "SCT" }, photoId: "photo_0123456789abcdef" });
ok(t1.place === "Isle of Skye" && t1.date === "2026-07-14", "trip fields cleaned");
ok(M.newTrip({ kidIds: [a.id], place: "x", date: "2026-13-45" }).date === "", "bad dates are dropped");
M.applyTripMark(t1, [a, b]);
ok(b.places.SCT && b.places.SCT.at === "2026-07-14", "trip colors the map for every kid on it, dated by the trip");
const t2 = M.newTrip({ kidIds: [b.id], place: "Zion", date: "2025-10-11", mark: { kind: "park", id: "zion" } }); M.applyTripMark(t2, [a, b]);
ok(b.parks.zion && !b.places.zion, "park trip ticks the park");
s = M.stats(b, [t1, t2], MAPS.world);
ok(s.trips === 2 && s.photos === 1 && s.years === 2 && s.firstTrip === "2025-10-11", "trip stats for Sam: " + JSON.stringify([s.trips, s.photos, s.years, s.firstTrip]));
ok(M.ageOn(2016, "2026-07-14") === 10 && M.ageOn(null, "2026-07-14") === null, "age on the trip");

// ---- badges ----
const bs = M.badges(M.stats(a, [t1], MAPS.world)), got = id => bs.find(x => x.id === id).earned;
ok(bs.length === 16, "16 badges for kids");
ok(got("first-trip") && got("photo") && got("states-5") && !got("states-10"), "trip/photo/state badges");
ok(got("scotland") && got("uk-4") && got("abroad") && got("continents-3") && !got("countries-5"), "Wee explorer, All four nations, Passport power");
ok(got("park-1") && !got("junior-ranger"), "park badge, no ranger yet");
ok(bs.find(x => x.id === "states-10").have === 5 && bs.find(x => x.id === "states-10").need === 10, "locked badge shows progress");
ok(M.badges(M.stats(M.newKid({ name: "New" }), [], MAPS.world)).every(x => !x.earned), "new kid has no badges");

// ---- roles: the whole family, kids first ----
ok(M.ROLES.map(r => r.label).join() === "Kid,Parent/Adult,Grandparent/Other", "three roles");
ok(a.role === "kid" && M.newPerson({ name: "x" }).role === "kid", "role defaults to Kid");
ok(M.newPerson({ name: "x", role: "boss" }).role === "kid", "unknown role becomes Kid");
const mom = M.newPerson({ name: "Mom", role: "adult", birthYear: 1985, color: M.COLORS[2] });
const gran = M.newPerson({ name: "Grandma", role: "grand", birthYear: 1952 });
ok(mom.role === "adult" && mom.birthYear === 1985 && gran.role === "grand" && gran.birthYear === 1952, "adult birth years are kept");
ok(M.newPerson({ name: "Pop", role: "grand" }).birthYear === null, "birth year stays optional");
ok(M.isKid(a) && !M.isKid(mom) && !M.isKid(gran) && M.isKid({}), "isKid (old profiles with no role count as kids)");
["SCT", "ENG", "FRA"].forEach(id => M.toggleArea(mom, "place", id, true)); ["UT", "AZ", "FL"].forEach(id => M.toggleArea(mom, "state", id, true));
M.togglePark(mom, "zion", undefined, true);
const tFam = M.newTrip({ kidIds: [a.id, mom.id], place: "Edinburgh", date: "2026-07-10", mark: { kind: "place", id: "SCT" } });
const tCouple = M.newTrip({ kidIds: [mom.id, gran.id], place: "Paris", date: "2019-05-01" });
const ms = M.stats(mom, [tFam, tCouple, t1], MAPS.world);
ok(ms.kid === false && ms.role === "adult", "adult stats know the role");
ok(ms.states === 3 && ms.countries === 3 && ms.ukNations === 2 && ms.parks === 1, "adults get the same map stats");
ok(ms.firstTripAge === null, "no 'age on first trip' for adults");
ok(M.stats(a, [tFam], MAPS.world).firstTripAge === 10, "kids still get age on first trip");
ok(ms.together === 2 && ms.trips === 2, "trips together counted per person");
const mb = M.badges(ms), mg = id => mb.find(x => x.id === id);
ok(mb.length === 15 && !mg("junior-ranger"), "adults skip the Junior Ranger badge");
ok(mg("scotland").name === "Scotland calling" && mg("scotland").earned, "adults get 'Scotland calling', not 'Wee explorer'");
ok(M.badges(M.stats(a, [], MAPS.world)).find(x => x.id === "scotland").name === "Wee explorer", "kids keep 'Wee explorer'");
ok(mg("park-1").earned && mg("abroad").earned && !mg("together").earned, "adults earn the same badges");
ok(M.badges(M.stats(mom, [tFam, tCouple, M.newTrip({ kidIds: [mom.id, a.id], place: "Lake" })], MAPS.world)).find(x => x.id === "together").earned, "Better together after 3 shared trips");
ok(M.BADGES.every(b => !/\bkid|child/i.test(b.name + b.desc)), "badge wording reads naturally for anyone");

// ---- family map ----
const fam = [a, mom, gran];
let w = M.whoBeen(fam, "place", MAPS.world);
ok(w.SCT && w.SCT.length === 2 && w.SCT.indexOf(mom.id) >= 0, "who's been to Scotland: Ellie and Mom");
ok(!w.WLS || w.WLS.join() === a.id, "Wales: only Ellie");
w = M.whoBeen(fam, "country", MAPS.world);
ok(w.USA.length === 2 && w.GBR.length === 2, "family countries: a state counts as USA, a UK nation as GBR");
ok(M.whoBeen(fam, "park", MAPS.world).zion.length === 2, "parks: who's been");
let F = M.familyStats(fam, [tFam, tCouple, t1, t2], MAPS.world);
ok(F.people === 3 && F.states === 6 && F.togetherStates === 0, "family states: any 6 (DC not counted), all three 0 (" + F.states + "/" + F.togetherStates + ")");
ok(F.countries === 4 && F.togetherCountries === 0, "family countries: USA, UK, Japan, France");
const couple = M.familyStats([a, mom], [tFam, tCouple, t1], MAPS.world);
ok(couple.togetherStates === 2 && couple.togetherCountries === 2 && couple.togetherParks === 1, "places we've been together: 2 states, 2 countries, 1 park (" + [couple.togetherStates, couple.togetherCountries, couple.togetherParks] + ")");
ok(couple.togetherTrips === 1 && couple.trips === 3, "trips together = trips with both of us");
ok(M.familyStats([mom, gran], [tCouple], MAPS.world).togetherTrips === 1, "couples and grandparents get 'together' too");
ok(M.familyStats([a], [t1], MAPS.world).togetherTrips === 0 && M.familyStats([a], [], MAPS.world).togetherStates === 0, "one person: nothing 'together'");
ok(M.familyStats([], [], MAPS.world).states === 0, "empty family is fine");

// ---- backup / restore ----
const px = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const bk = M.makeBackup([a, b], [t1, t2], [{ id: "photo_0123456789abcdef", dataUrl: px }], "2026-10-23T12:00:00.000Z");
ok(bk.app === "my-lifetime-travel-log" && bk.version === 2, "backup is labeled (version 2)");
const bk2 = M.readBackup(JSON.parse(JSON.stringify(M.makeBackup([a, mom, gran], [tCouple], []))));
ok(bk2.kids.map(p => p.role).join() === "kid,adult,grand", "v2 backups keep roles");
ok(bk2.kids[2].birthYear === 1952, "grandparent birth year survives");
// a real v1 file, exactly as v1 wrote it (no role, kid_ ids)
const v1 = { app: "my-lifetime-travel-log", version: 1, exportedAt: "2026-10-23T14:00:00.000Z", note: "My Lifetime Travel Log backup.",
  kids: [{ id: "kid_0123456789abcdef", name: "Ellie", birthYear: 2016, color: "#e8a54b", states: { UT: { at: "2026-06-01" } }, places: { SCT: { at: "2026-07-14" } }, parks: { zion: { at: "2025-10-11", jr: true } }, createdAt: "2026-10-23T13:00:00.000Z", updatedAt: "2026-10-23T13:30:00.000Z" }],
  trips: [{ id: "trip_0123456789abcdef", kidIds: ["kid_0123456789abcdef"], place: "Isle of Skye", date: "2026-07-14", who: "Mom, Dad", memory: "Hairy coo", photoId: "photo_0123456789abcdef", mark: { kind: "place", id: "SCT" }, createdAt: "2026-10-23T13:10:00.000Z", updatedAt: "2026-10-23T13:10:00.000Z" }],
  photos: [{ id: "photo_0123456789abcdef", dataUrl: px }] };
const r1 = M.readBackup(v1);
ok(r1.kids.length === 1 && r1.kids[0].role === "kid", "v1 profiles restore as Kid");
ok(r1.kids[0].id === "kid_0123456789abcdef" && r1.kids[0].states.UT && r1.kids[0].parks.zion.jr, "v1 maps and ids restore unchanged");
ok(r1.trips.length === 1 && r1.photos.length === 1 && r1.trips[0].photoId === "photo_0123456789abcdef", "v1 trips and photos restore");
ok(M.readBackup(Object.assign({}, v1, { kids: [Object.assign({}, v1.kids[0], { role: "adult" })] })).kids[0].role === "kid", "a v1 file is always kids");
throws(() => M.readBackup(Object.assign({}, v1, { version: 0 })), /newer|version|backup/i, "version 0 refused");
const back = M.readBackup(JSON.parse(JSON.stringify(bk)));
ok(back.kids.length === 2 && back.trips.length === 2 && back.photos.length === 1, "round trip keeps kids, trips and photos");
ok(JSON.stringify(back.kids[0].places) === JSON.stringify(a.places) && back.kids[0].parks.zion, "maps survive the round trip");
ok(back.photos[0].dataUrl === px && back.trips[0].photoId === "photo_0123456789abcdef", "photo survives the round trip");
throws(() => M.readBackup({ hello: 1 }), /backup/i, "random JSON is refused");
throws(() => M.readBackup(null), /backup/i, "empty file is refused");
throws(() => M.readBackup(Object.assign({}, bk, { version: 99 })), /newer|version/i, "future versions are refused politely");
const evil = JSON.parse(JSON.stringify(bk));
evil.photos.push({ id: "photo_aaaaaaaaaaaaaaaa", dataUrl: "javascript:alert(1)" }, { id: "photo_bbbbbbbbbbbbbbbb", dataUrl: "data:text/html;base64,PHNjcmlwdD4=" });
evil.kids.push({ id: "../../etc", name: "x" }); evil.kids[0].states["<img>"] = { at: "2026-01-01" };
evil.trips[0].kidIds.push("kid_ffffffffffffffff");
const clean = M.readBackup(evil);
ok(clean.photos.length === 1, "only real image data URLs are restored");
ok(clean.kids.length === 2 && !clean.kids[0].states["<img>"], "bad ids and map keys are dropped");
ok(clean.trips[0].kidIds.length === 2, "trips only point at kids in the file");
ok(M.esc('<a href="x">\'') === "&lt;a href=&quot;x&quot;&gt;&#39;", "esc escapes HTML");
ok(JSON.stringify(M.fitDims(4032, 3024)) === '{"w":1280,"h":960}' && JSON.stringify(M.fitDims(800, 600)) === '{"w":800,"h":600}', "photos shrink to 1280px, small ones stay");
ok(M.backupNudge(null, [t1, t2]) === 0 && M.backupNudge(null, [t1, t2, t1]) === 3, "backup nudge after 3 trips");
ok(M.backupNudge("2999-01-01T00:00:00Z", [t1, t2, t1]) === 0, "no nudge right after a backup");

// ---- the app shell: offline, private, no third parties ----
const html = read("index.html"), js = read("app.js"), css = read("app.css"), sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));
ok(/<meta name="robots" content="noindex/.test(html), "app stays noindex (hidden test link)");
ok(/<title>My Lifetime Travel Log: color in every place your family goes<\/title>/.test(html), "family title");
ok(/name="description" content="[^"]*family[^"]*kids/i.test(html), "meta description is family-wide and mentions kids");
ok(/"description": "[^"]*family/.test(read("manifest.webmanifest")), "manifest description is family-wide");
ok(/var CACHE = "mltl-v2"/.test(sw), "service worker cache bumped to v2 so phones update");
ok(/Color in every place your family goes, from the first road trip on\./.test(js), "onboarding leads with family, from the first road trip");
ok(/#\/family/.test(js) && /function viewFamily/.test(js) && /Been together/.test(js) && /places you\\'ve been together/.test(js), "family map with a together view");
ok(/Parent\/Adult/.test(read("log-core.js")) && /data-role/.test(js), "add-someone form has roles");
ok(!/Add a kid|All kids|Which kids went/.test(js), "no kids-only wording in the people flow");
ok(/Content-Security-Policy[^>]*default-src 'self'[^>]*script-src 'self'/.test(html), "CSP locks scripts to this site");
ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, "")), "index.html loads nothing from other sites");
ok(!/googletagmanager|gtag\(|google-analytics|emrldtp|fonts\.googleapis|<script[^>]+src="(?!\.?\/?[\w-]+\.js")/.test(html), "no analytics, fonts or outside scripts in index.html");
(html.match(/<script[^>]*src="([^"]+)"/g) || []).forEach(t => { const f = t.match(/src="([^"]+)"/)[1]; ok(fs.existsSync(path.join(APP, f)), "script exists: " + f); });
ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage\.setItem\(["']_ga/.test(js), "app.js makes no network calls");
ok(!/https?:\/\//.test(js.replace(/\/\/[^\n]*\n/g, "\n")), "app.js has no outside URLs");
ok(!/@import|url\(\s*["']?https?:/.test(css), "app.css pulls nothing from other sites");
ok(/Dark Lighthouse Solutions/.test(html) && (html.match(/Dark Lighthouse Solutions/g) || []).length === 1, "Dark Lighthouse Solutions appears once, as the credit");
ok(/class="credit"[^>]*>[^<]*Dark Lighthouse Solutions/.test(html), "the credit is the small footer line");
ok(/BOOK_URL/.test(js) && /coming soon|on its way to Amazon/i.test(js), "book link has a coming-soon placeholder");
const files = (sw.match(/FILES\s*=\s*\[([\s\S]*?)\]/) || [])[1] || "";
const list = files.match(/"([^"]+)"/g).map(x => x.slice(1, -1));
ok(list.length >= 8, "service worker pre-caches the app files");
list.forEach(f => ok(f === "./" || fs.existsSync(path.join(APP, f)), "pre-cached file exists: " + f));
["index.html", "app.js", "app.css", "log-core.js", "maps.js", "manifest.webmanifest"].forEach(f => ok(list.includes(f), "sw caches " + f));
ok(/self\.location\.origin|url\.origin\s*!==?\s*location\.origin|origin/.test(sw), "service worker only handles this site's requests");
ok(manifest.name === "My Lifetime Travel Log" && manifest.start_url === "/travel-log/app/" && manifest.scope === "/travel-log/app/" && manifest.display === "standalone", "manifest basics");
manifest.icons.forEach(i => ok(fs.existsSync(path.join(APP, i.src.replace(/^\/travel-log\/app\//, ""))), "icon exists: " + i.src));
ok(manifest.icons.some(i => i.sizes === "512x512" && /maskable/.test(i.purpose || "")), "has a maskable icon");
ok(/indexedDB\.open/.test(js) && /toDataURL\("image\/jpeg"/.test(js) && /fitDims/.test(js), "photos are shrunk and kept in IndexedDB");
ok(/makeBackup/.test(js) && /readBackup/.test(js), "back up / restore wired up");
ok(/window\.print\(\)/.test(js) && /@media print/.test(css), "printable map view");

// ---- site scripts leave the app alone (no analytics, nav or meta injected) ----
["add_analytics.py", "add_global_nav.py", "add_head_meta.py"].forEach(f => {
  const src = fs.readFileSync(path.join(__dirname, f), "utf8");
  ok(/rel\.startswith\("travel-log\/app\/"\)/.test(src), f + " skips /travel-log/app/");
});
// ...and nothing on the live site links to the app yet
const linked = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (![".git", "node_modules", "app"].includes(e.name) || (e.name === "app" && !p.endsWith(path.join("travel-log", "app")))) walk(p); }
    else if (/\.(html|xml|txt)$/.test(e.name) && /travel-log\/app/.test(fs.readFileSync(p, "utf8"))) linked.push(path.relative(path.join(__dirname, ".."), p));
  }
})(path.join(__dirname, ".."));
ok(linked.length === 0, "no site page links to the app yet: " + linked.join(", "));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
