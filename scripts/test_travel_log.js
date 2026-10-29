// Tests for Famstamp, the My Lifetime Travel Log app (/travel-log/app/). Run: node scripts/test_travel_log.js
const fs = require("fs"), path = require("path");
const APP = path.join(__dirname, "..", "travel-log", "app");
const M = require("../travel-log/app/log-core.js");
global.self = global.self || {}; require("../travel-log/app/maps.js"); const MAPS = global.self.MLTL_MAPS;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL:", m); } }
function throws(fn, re, m) { try { fn(); ok(false, m + " (didn't throw)"); } catch (e) { ok(re.test(e.message), m + ": " + e.message); } }
// v74: the app's scripts ship as app-bundle.js. For sw.js, "caches app-bundle.js" means it caches every bundled script,
// so the bundled names are listed for the older "is X cached offline" checks. index.html keeps them in its bundle block.
const BUNDLE = require("./build_app_bundle.js");
const read = f => { const t = fs.readFileSync(path.join(APP, f), "utf8"); return f === "sw.js" && /"app-bundle\.js"/.test(t) ? t + "\n/* bundled: " + BUNDLE.list().map(x => JSON.stringify(x)).join(", ") + " */" : t; };

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
ok(bs.length === 23, "23 badges for kids");
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
ok(mb.length === 22 && !mg("junior-ranger"), "adults skip the Junior Ranger badge");
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
ok(bk.app === "my-lifetime-travel-log" && bk.version === 4, "backup is labeled (version 4)");
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
{ const wk = JSON.parse(JSON.stringify(bk)); wk.note = "Wanderkin backup. Keep this file somewhere safe.";
  ok(M.readBackup(wk).kids.length === bk.kids.length, "a backup saved while the app was called Wanderkin still restores"); }
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


// ---- v1.2: who went, from / to, trips together, backup reminder ----
{
  const lily = M.newPerson({ name: "Lily", color: M.COLORS[0] }), mum = M.newPerson({ name: "Mom", role: "adult", color: M.COLORS[1] }),
        dad = M.newPerson({ name: "Dad", role: "adult", color: M.COLORS[2] }), nan = M.newPerson({ name: "Nana", role: "grand", color: M.COLORS[3] });
  const T = (ids, place, date, more) => M.newTrip(Object.assign({ kidIds: ids, place, date }, more || {}));
  const ed = T([lily.id, mum.id, dad.id], "Edinburgh", "2026-07-10", { from: " Orlando ", stops: ["London", "  ", "York"], mark: { kind: "place", id: "SCT" } });
  ok(ed.from === "Orlando" && ed.stops.join() === "London,York", "From is cleaned, blank stops dropped");
  ok(M.routeText(ed) === "Orlando to London to York to Edinburgh", "route reads in plain words: " + M.routeText(ed));
  ok(M.routeText(T([lily.id], "Zion", "")) === "Zion", "no From: just the destination");
  ok(M.routeText(T([lily.id], "Orlando", "", { from: "orlando" })) === "Orlando", "From = To isn't repeated");
  ok(M.routeText(T([lily.id], "Edinburgh", "", { from: "Orlando" })) === "Orlando to Edinburgh", "Orlando to Edinburgh");
  ok(!/→|->/.test(M.routeText(ed)), "no arrows, plain words");
  ok(T([lily.id], "x", "", { stops: ["a", "b", "c", "d", "e", "f", "g"] }).stops.length === M.MAX_STOPS && M.MAX_STOPS === 5, "stops capped at 5");
  ok(T([lily.id], "x", "", { stops: "London" }).stops.length === 0 && T([lily.id], "x", "").from === "", "stops/from default empty");
  ok(T([lily.id], "x", "", { from: "y".repeat(200) }).from.length === 80, "From capped at 80 chars");
  // a trip with several travelers counts for each of them
  M.applyTripMark(ed, [lily, mum, dad, nan]);
  ok(lily.places.SCT && mum.places.SCT && dad.places.SCT && !nan.places.SCT, "trip colors Scotland for everyone who went, not Nana");
  const beach = T([lily.id, nan.id], "Clearwater", "2025-06-01", { from: "Orlando", mark: { kind: "state", id: "FL" } });
  const lake = T([lily.id, mum.id], "Lake Lure", "2024-08-02", { from: "Orlando", mark: { kind: "state", id: "NC" } });
  const work = T([dad.id], "Atlanta", "2024-03-03");
  const smoky = T([lily.id, mum.id, dad.id, nan.id], "Great Smoky Mountains", "2023-10-01", { from: "Orlando", mark: { kind: "park", id: "great-smoky-mountains" } });
  const trips = [ed, beach, lake, work, smoky];
  [beach, lake, work, smoky].forEach(t => M.applyTripMark(t, [lily, mum, dad, nan]));
  ok(M.stats(lily, trips, MAPS.world).trips === 4 && M.stats(dad, trips, MAPS.world).trips === 3 && M.stats(nan, trips, MAPS.world).trips === 2, "each traveler's trip count includes shared trips");
  ok(M.stats(lily, trips, MAPS.world).together === 4 && M.stats(dad, trips, MAPS.world).together === 2, "shared trips count as 'together' for each person");
  ok(M.badges(M.stats(lily, trips, MAPS.world)).find(b => b.id === "together").earned, "Lily earns Better together from shared trips");
  ok(nan.parks["great-smoky-mountains"] && dad.parks["great-smoky-mountains"], "park trip ticks the park for all 4");
  // Family map: a shared trip counts once, places count once
  const F = M.familyStats([lily, mum, dad, nan], trips, MAPS.world);
  ok(F.trips === 5, "family trips logged = 5 (a 4-person trip isn't counted 4 times), got " + F.trips);
  ok(F.parks === 1 && F.togetherParks === 1 && F.togetherTrips === 1, "family: 1 park, been together by all 4, 1 trip with all 4");
  ok(M.whoBeen([lily, mum, dad, nan], "place", MAPS.world).SCT.length === 3, "Scotland: 3 people, one place on the family map");
  // trips together
  ok(M.tripsTogether(trips, [mum.id, lily.id]).map(t => t.place).join() === "Edinburgh,Lake Lure,Great Smoky Mountains", "Mom & Lily: 3 trips together, newest first");
  ok(M.tripsTogether(trips, [lily.id, mum.id, dad.id]).length === 2, "three people together: Edinburgh + Smokies");
  ok(M.tripsTogether(trips, [lily.id]).length === 0 && M.tripsTogether(trips, []).length === 0, "together needs two or more people");
  ok(M.tripsTogether(trips, [dad.id, nan.id]).length === 1, "Dad & Nana: 1 trip");
  const pc = M.pairCounts([lily, mum, dad, nan], trips);
  ok(pc[0].count === 3 && pc[0].ids.includes(lily.id) && pc[0].ids.includes(mum.id), "top pair is Lily & Mom with 3");
  ok(pc.length === 6 && pc.every((p, i) => !i || pc[i - 1].count >= p.count), "all 6 pairs listed, most first");
  ok(M.pairCounts([lily, mum], [work]).length === 0, "pairs with no shared trips are left out");
  ok(M.joinNames(["Mom", "Lily"]) === "Mom & Lily" && M.joinNames(["Lily", "Mom", "Dad"]) === "Lily, Mom & Dad" && M.joinNames(["Lily"]) === "Lily" && M.joinNames([]) === "", "names join in plain words");
  // migration: older trips with no travelers or From
  const old = M.migrateTrip({ id: "trip_aaaaaaaaaaaaaaaa", place: "Zion", kidId: lily.id }, null);
  ok(old.kidIds.join() === lily.id && old.from === "" && Array.isArray(old.stops) && !("kidId" in old), "old single-person trip: that person is the only traveler");
  ok(M.migrateTrip({ id: "trip_b", place: "x", kidIds: [] }, mum.id).kidIds.join() === mum.id, "trip with no travelers gets its owner");
  ok(M.migrateTrip({ id: "trip_c", place: "x", kidIds: [mum.id, mum.id, ""] }).kidIds.join() === mum.id, "duplicate / blank travelers dropped");
  const kept = M.migrateTrip({ id: "trip_d", place: "x", kidIds: [mum.id], from: "Orlando", stops: ["a"] });
  ok(kept.from === "Orlando" && kept.stops.join() === "a", "migration leaves new trips alone");
  // backup v3
  const b3 = JSON.parse(JSON.stringify(M.makeBackup([lily, mum, dad, nan], trips, [], "2026-10-23T12:00:00.000Z", { home: " Orlando, FL " })));
  ok(b3.version === 4 && b3.settings.home === "Orlando, FL", "v3 backup carries the home town");
  const r3 = M.readBackup(b3);
  ok(r3.settings.home === "Orlando, FL", "home town restores");
  const red = r3.trips.find(t => t.id === ed.id);
  ok(red.from === "Orlando" && red.stops.join() === "London,York" && red.kidIds.length === 3, "From, stops and all travelers survive a v3 round trip");
  ok(M.readBackup(Object.assign({}, b3, { settings: "junk" })).settings.home === "", "junk settings are ignored");
  ok(M.readBackup(Object.assign({}, b3, { settings: { home: "<script>" + "x".repeat(200) } })).settings.home.length === 80, "home town capped");
  const v2file = JSON.parse(JSON.stringify(Object.assign(M.makeBackup([lily, mum], [lake], []), { version: 2 })));
  delete v2file.settings; v2file.trips.forEach(t => { delete t.from; delete t.stops; });
  const r2 = M.readBackup(v2file);
  ok(r2.trips.length === 1 && r2.trips[0].from === "" && r2.trips[0].stops.length === 0 && r2.trips[0].kidIds.length === 2 && r2.settings.home === "", "v2 files still restore (shared trip keeps both travelers)");
  ok(r1.trips[0].from === "" && r1.trips[0].kidIds.join() === "kid_0123456789abcdef" && r1.settings.home === "", "v1 files still restore: the kid is the only traveler");
  const v1single = JSON.parse(JSON.stringify(v1)); v1single.trips[0] = Object.assign({}, v1single.trips[0], { kidId: "kid_0123456789abcdef" }); delete v1single.trips[0].kidIds;
  ok(M.readBackup(v1single).trips[0].kidIds.join() === "kid_0123456789abcdef", "a trip saved under one person (kidId) restores with them as the traveler");
  throws(() => M.readBackup(Object.assign({}, b3, { version: 5 })), /newer/i, "v5 files are refused politely");
  // backup reminder
  const now = "2026-10-23T12:00:00.000Z", t3 = [ed, beach, lake], day = 864e5, ago = d => new Date(Date.parse(now) - d * day).toISOString();
  ok(!M.backupDue({ now, trips: [ed, beach], people: [lily] }), "never backed up, 2 trips: no banner yet");
  ok(M.backupDue({ now, trips: t3, people: [lily] }), "never backed up, 3 trips: banner");
  const fresh = Object.assign({}, ed, { updatedAt: ago(1) });
  ok(!M.backupDue({ now, lastBackupAt: ago(3), trips: [fresh], people: [] }), "new data but backed up 3 days ago: no banner");
  ok(M.backupDue({ now, lastBackupAt: ago(15), trips: [fresh], people: [] }), "new data and 15 days since backup: banner");
  ok(M.backupDue({ now, lastBackupAt: ago(14), trips: [fresh], people: [] }), "exactly 14 days counts");
  ok(!M.backupDue({ now, lastBackupAt: ago(30), trips: [Object.assign({}, ed, { updatedAt: ago(40) })], people: [Object.assign({}, lily, { updatedAt: ago(40) })] }), "nothing new since the backup: no banner, however long ago");
  ok(M.backupDue({ now, lastBackupAt: ago(30), trips: [], people: [Object.assign({}, lily, { updatedAt: ago(2) })] }), "map changes (not just trips) count as new data");
  ok(!M.backupDue({ now, dismissedAt: ago(2), trips: t3, people: [] }), "Not now hides it for a week");
  ok(M.backupDue({ now, dismissedAt: ago(8), trips: t3, people: [] }), "it comes back after a week");
  ok(M.BACKUP_DAYS === 14 && M.SNOOZE_DAYS === 7, "14-day reminder, 7-day snooze");
}
{
  const js2 = read("app.js"), css2 = read("app.css");
  const ui = read("trips-ui.js");
  ok(/id="psearch"/.test(ui) && /Where did you go\?/.test(ui) && /Tap places in order/.test(ui), "trip builder: tap places in order");
  ok(/name="kids"/.test(ui) && /Who went\?/.test(ui) && /kidIds: opts\.all \? [^:]+: \[k\.id\]/.test(ui), "Who went checklist, defaulting to the current person");
  ok(/setMeta\("home"/.test(js2) && /state\.meta\.home/.test(js2), "home town saved on the device and prefilled");
  ok(/T\.MAX_POINTS/.test(ui) && /class="leg"/.test(ui), "up to 12 stops, with a leg between each");
  ok(/Object\.assign\(old \? copy\(old\) : \{\}/.test(ui), "editing a trip keeps fields this version doesn't know about");
  ok(/function viewTogether/.test(js2) && /#\/together/.test(js2) && /trips together/.test(js2) && /pairCounts/.test(js2), "Trips together view with pair counts");
  ok(/#\/together\/fam/.test(js2), "family map 'Trips together' links to the trips");
  ok(/class="travelers"/.test(js2) && /M\.routeText\(t\)/.test(js2), "trip cards show travelers and the route");
  ok(/function viewPrint[\s\S]*routeText[\s\S]*travelerNames/.test(js2), "print view includes route and travelers");
  ok(/Save a backup so your log is safe if this phone is lost or reset/.test(js2) && /Back up now/.test(js2) && /data-backup-dismiss/.test(js2), "backup banner text, button and dismiss");
  ok(/setMeta\("lastBackupAt"/.test(js2) && /setMeta\("backupDismissedAt"/.test(js2), "last backup and dismiss dates stored on the device");
  ok(/\.backupnag/.test(css2) && /\.travelers/.test(css2) && /\.pairrow/.test(css2), "styles for the new parts");
}

// ---- Android download page + Digital Asset Links ----
{
  const ROOT = path.join(__dirname, "..");
  const apk = path.join(APP, "download", "famstamp.apk"), oldApk = path.join(APP, "download", "my-lifetime-travel-log.apk");
  ok(fs.existsSync(oldApk) && fs.readFileSync(oldApk).equals(fs.readFileSync(apk)), "old APK link still works and serves the same Famstamp build");
  ok(fs.readFileSync(path.join(APP, "download", "wanderkin.apk")).equals(fs.readFileSync(apk)), "the short-lived wanderkin.apk link serves the newest Famstamp build too");
  ok(fs.existsSync(apk), "APK is in /travel-log/app/download/");
  const size = fs.statSync(apk).size, head = fs.readFileSync(apk).subarray(0, 4);
  ok(size > 100e3 && size < 25e6, "APK size is sane and well under GitHub limits: " + size);
  ok(head[0] === 0x50 && head[1] === 0x4b, "APK is a zip (PK header)");
  const dl = fs.readFileSync(path.join(APP, "download", "index.html"), "utf8");
  ok(/<meta name="robots" content="noindex/.test(dl), "download page is noindex");
  ok(/href="famstamp\.apk" download/.test(dl), "download button points at famstamp.apk");
  ok(/<title>Get Famstamp on Android<\/title>/.test(dl) && /Version 1\.3\.1/.test(dl) && !/Lifetime Travel Log/.test(dl), "download page says Famstamp 1.3.1");
  ok((dl.match(/<li>/g) || []).length === 3 && /Allow from this source/.test(dl), "3 install steps incl. allow from this source");
  ok(/iPhone/.test(dl) && /Add to Home Screen/.test(dl), "iPhone note");
  ok(!/https?:\/\//.test(dl) && !/<script/.test(dl), "download page loads nothing from other sites, no scripts");
  const al = JSON.parse(fs.readFileSync(path.join(ROOT, ".well-known", "assetlinks.json"), "utf8"));
  ok(al[0].target.package_name === "com.darklighthousesolutions.travellog" && /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(al[0].target.sha256_cert_fingerprints[0]), "assetlinks.json has the package and a SHA-256 fingerprint");
  ok(al[0].relation[0] === "delegate_permission/common.handle_all_urls", "assetlinks relation");
  ok(fs.existsSync(path.join(ROOT, ".nojekyll")), ".nojekyll so GitHub Pages serves /.well-known/");
  ok(/\/download\//.test(read("sw.js")), "service worker leaves the download page and APK alone");
}

// ---- the app shell: offline, private, no third parties ----
const html = read("index.html"), js = read("app.js"), css = read("app.css"), sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));
ok(/<meta name="robots" content="noindex/.test(html), "app stays noindex (hidden test link)");
ok(/<title>Famstamp: stamp every trip<\/title>/.test(html), "Famstamp title with the tagline");
ok(/<a class="brand" href="#\/" aria-label="Famstamp home"[^>]*><svg class="logomark"[\s\S]*?>FAMSTAMP<\/text>[\s\S]*?>STAMP EVERY TRIP<\/text>[\s\S]*?<\/svg><\/a>/.test(html) && /content="Famstamp"/.test(html), "header logo is the inline FAMSTAMP stamp mark, a link Home labelled 'Famstamp home'; iOS name says Famstamp");
{ const svg = (html.match(/<svg class="logomark"[\s\S]*?<\/svg>/) || [""])[0];
  ok(svg.length < 3000 && /currentColor/.test(svg) && /aria-hidden="true"/.test(svg) && /rotate\(-4/.test(svg) && (svg.match(/<rect[^>]*fill="none"/g) || []).length === 2, "logo: small inline SVG, ink in currentColor, decorative, tilted, double border: " + svg.length + " bytes");
  const lj = fs.readFileSync(path.join(APP, "logo.js"), "utf8");
  ok(/preventDefault/.test(lj) && /\.sheetbg/.test(lj) && /#fammenu/.test(lj) && /scrollTo\(0, 0\)/.test(lj) && /location\.hash = "#\/"/.test(lj) && /MLTL_APP\.route\(\)/.test(lj), "logo click goes Home from anywhere, closes sheets and menus, scrolls to top");
  ok(/prefers-reduced-motion: reduce\) \{ \.brand\.thunk \.logomark \{ animation:none/.test(fs.readFileSync(path.join(APP, "app.css"), "utf8")), "logo thunk respects reduced motion");
  ok(/<link rel="icon" href="icon\.svg" type="image\/svg\+xml"/.test(html) && /FAMSTAMP/.test(fs.readFileSync(path.join(APP, "icon.svg"), "utf8")), "SVG favicon is the stamp roundel");
  ok(manifest.icons.some(i => i.src === "icon.svg"), "manifest lists the SVG icon"); }
ok(!/Lifetime Travel Log|Travel Log</.test(html), "index.html no longer shows the old app name");
ok(/a\.download = "famstamp-backup-"/.test(js) && /Famstamp · Map data/.test(js) && /" · Famstamp"/.test(js), "backup file name, print view and page titles say Famstamp");
ok((js.match(/My Lifetime Travel Log/g) || []).length === 4 && /matching paperback, My Lifetime Travel Log/.test(js), "only the book keeps the My Lifetime Travel Log name");
ok(M.APP_ID === "my-lifetime-travel-log", "backup id unchanged so old backups still restore");
ok(/name="description" content="[^"]*family[^"]*kids/i.test(html), "meta description is family-wide and mentions kids");
ok(/"description": "[^"]*family/.test(read("manifest.webmanifest")), "manifest description is family-wide");
ok(+((sw.match(/var CACHE = "mltl-v(\d+)"/) || [])[1]) >= 10, "service worker cache bumped past v9 (new logo) so phones update");
ok(/"logo\.js"/.test(sw) && /"icon\.svg"/.test(sw), "service worker caches logo.js and icon.svg");
ok(["trips-core.js", "state-signs.js", "passport-core.js", "trips-ui.js"].every(f => sw.indexOf('"' + f + '"') >= 0), "service worker caches the new trip and passport scripts");
ok(/Color in every place your family goes, from the first road trip on\./.test(js), "onboarding leads with family, from the first road trip");
ok(/#\/family/.test(js) && /function viewFamily/.test(js) && /Been together/.test(js) && /places you\\'ve been together/.test(js), "family map with a together view");
ok(/Parent\/Adult/.test(read("log-core.js")) && /data-role/.test(js), "add-someone form has roles");
ok(!/Add a kid|All kids|Which kids went/.test(js), "no kids-only wording in the people flow");
ok(/Content-Security-Policy[^>]*default-src 'self'[^>]*script-src 'self'/.test(html), "CSP locks scripts to this site");
ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, "").replace(/connect-src 'self' https:\/\/ercowufdbmvqagshduxh\.supabase\.co wss:\/\/ercowufdbmvqagshduxh\.supabase\.co https:\/\/nominatim\.openstreetmap\.org https:\/\/api\.open-meteo\.com https:\/\/archive-api\.open-meteo\.com;/, "").replace(/img-src 'self' data: blob: https:\/\/lh3\.googleusercontent\.com https:\/\/tile\.openstreetmap\.org;/, "")), "index.html loads nothing from other sites (only Family Sync may connect to the family database; Google profile photos only)");
ok(/function okAvatar\(u\) \{ return \/\^https:\\\/\\\/lh3\\\.googleusercontent\\\.com/.test(read("sync.js")), "only Google profile photo URLs are shown");
ok(/that\\'s me \(on another device\)/.test(read("sync.js")) && /This will link this device to/.test(read("sync.js")), "already-joined people are selectable, with a confirm");
ok(/function identityJoin/.test(read("sync.js")) && /mltl-join-for/.test(read("sync.js")), "login = identity: members skip the picker; invites can name who they're for");
ok(!/googletagmanager|gtag\(|google-analytics|emrldtp|fonts\.googleapis|<script[^>]+src="(?!\.?\/?[\w-]+\.js")/.test(html), "no analytics, fonts or outside scripts in index.html");
(html.match(/<script[^>]*src="([^"]+)"/g) || []).forEach(t => { const f = t.match(/src="([^"]+)"/)[1]; ok(fs.existsSync(path.join(APP, f)), "script exists: " + f); });
ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage\.setItem\(["']_ga/.test(js), "app.js makes no network calls");
ok(!/https?:\/\//.test(js.replace(/\/\/[^\n]*\n/g, "\n")), "app.js has no outside URLs");
ok(!/@import|url\(\s*["']?https?:/.test(css), "app.css pulls nothing from other sites");
ok(/Dark Lighthouse Solutions/.test(html) && (html.match(/Dark Lighthouse Solutions/g) || []).length === 1, "Dark Lighthouse Solutions appears once, as the credit");
ok(/class="credit"[^>]*>[^<]*Dark Lighthouse Solutions/.test(html), "the credit is the small footer line");
ok(/BOOK_URL/.test(js) && /coming soon|on its way to Amazon/i.test(js), "book link has a coming-soon placeholder");
const files = (sw.match(/FILES\s*=\s*\[([\s\S]*?)\]/) || [])[1] || "";
const list0 = files.match(/"([^"]+)"/g).map(x => x.slice(1, -1));
const list = list0.includes("app-bundle.js") ? list0.concat(BUNDLE.list()) : list0;   // v74: the bundle carries the app's scripts
ok(list.length >= 8, "service worker pre-caches the app files");
list.forEach(f => ok(f === "./" || fs.existsSync(path.join(APP, f)), "pre-cached file exists: " + f));
["index.html", "app.js", "app.css", "log-core.js", "maps.js", "manifest.webmanifest"].forEach(f => ok(list.includes(f), "sw caches " + f));
ok(/self\.location\.origin|url\.origin\s*!==?\s*location\.origin|origin/.test(sw), "service worker only handles this site's requests");
ok(manifest.short_name === "Famstamp" && /^Stamp every trip\./.test(manifest.description), "manifest short name and tagline");
ok(manifest.name === "Famstamp" && manifest.start_url === "/travel-log/app/" && manifest.scope === "/travel-log/app/" && manifest.display === "standalone", "manifest basics");
manifest.icons.forEach(i => ok(fs.existsSync(path.join(APP, i.src.replace(/^\/travel-log\/app\//, ""))), "icon exists: " + i.src));
ok(manifest.icons.some(i => i.sizes === "512x512" && /maskable/.test(i.purpose || "")), "has a maskable icon");
ok(/indexedDB\.open/.test(js) && /toDataURL\("image\/jpeg"/.test(js) && /fitDims/.test(js), "photos are shrunk and kept in IndexedDB");
ok(/makeBackup/.test(js) && /readBackup/.test(js), "back up / restore wired up");
ok(/window\.print\(\)/.test(js) && /@media print/.test(css), "printable map view");


// ---- v85: 401-479px phones with Back + family chip: Search keeps only its icon so nothing sits off the right edge ----
ok(/@media \(max-width:479px\) \{\s*\.topbar:has\(\.navback:not\(\[hidden\]\)\):has\(\.famchip:not\(\[hidden\]\)\) \.navsearch \.tl \{ position:absolute/.test(read("app.css")), "v85: 412px phones with Back and the family chip hide the Search label (icon stays)");
// ---- v84: paste a flight or hotel booking into a new trip (read on the phone; names, codes and prices left out) ----
{
  const BK = require("../travel-log/app/booking-core.js");
  const AIR = { EDI: { code: "EDI", name: "Edinburgh", city: "Edinburgh", country: "GBR", lat: 55.95, lon: -3.37 }, LHR: { code: "LHR", name: "Heathrow", city: "London", country: "GBR", lat: 51.47, lon: -0.45 },
                JFK: { code: "JFK", name: "JFK", city: "New York", country: "USA", lat: 40.64, lon: -73.78 }, SFO: { code: "SFO", name: "SFO", city: "San Francisco", country: "USA", lat: 37.62, lon: -122.38 } };
  const air = c => AIR[c] || null;
  const fl = "Your flight is confirmed\nBooking reference: ZZ9QX1\nPassenger: Zz Test Dad\nOutbound  Fri 3 July 2026\nBA 1442  Edinburgh (EDI) to London Heathrow (LHR)\nReturn  Sun 12 July 2026\nBA 1449  LHR → EDI\nTotal: GBP 245.20";
  const r1 = BK.parse(fl, "2026-05-01");
  ok(r1.flights.length === 2 && r1.flights[0].dep === "EDI" && r1.flights[0].arr === "LHR" && r1.flights[0].date === "2026-07-03" && r1.flights[1].date === "2026-07-12", "v84: a pasted flight email gives both legs with their dates");
  ok(!/ZZ9QX1|Zz Test Dad|245/.test(JSON.stringify(r1)), "v84: confirmation code, passenger name and price are never kept");
  const t1 = BK.toTrip(r1, air, "2026-05-01");
  ok(t1.route.length === 3 && t1.route[0].name === "Edinburgh" && !t1.route[0].mode && t1.route[1].mode === "plane" && t1.route[1].dep.code === "EDI" && t1.route[1].arr.code === "LHR" && t1.route[2].name === "Edinburgh", "v84: flights become a route with plane legs and airports");
  ok(t1.roundTrip && t1.date === "2026-07-03" && t1.endDate === "2026-07-12" && t1.title === "Trip to London" && !t1.done && t1.fly === "yes", "v84: round trip, dates, title; a future trip isn't marked done");
  const ho = "Thanks for booking with Zz Travel!\nHotel: The Zz Harbour Inn, Portree\nCheck-in: Monday, August 10, 2026 from 3 PM\nCheck-out: Thursday, August 13, 2026 by 11 AM\nConfirmation #123456789";
  const r2 = BK.parse(ho, "2026-05-01"), t2 = BK.toTrip(r2, air, "2026-09-01");
  ok(r2.hotels.length === 1 && r2.hotels[0].name === "The Zz Harbour Inn" && r2.hotels[0].city === "Portree" && r2.hotels[0].nights === 3, "v84: a hotel email gives the hotel, its town and the nights");
  ok(t2.stays[0].name === "The Zz Harbour Inn" && t2.stays[0].type === "hotel" && t2.stays[0].nights === 3 && t2.date === "2026-08-10" && t2.endDate === "2026-08-13" && t2.done && t2.route[0].name === "Portree" && t2.route[0].mode === "car", "v84: a hotel-only booking fills the stay, the dates and the town as a stop");
  const r3 = BK.parse("Depart\nEdinburgh (EDI)\nJul 3, 10:05\nArrive\nNew York (JFK)\nJul 3, 13:20", "2026-05-01");
  ok(r3.flights.length === 1 && r3.flights[0].dep === "EDI" && r3.flights[0].arr === "JFK" && r3.flights[0].date === "2026-07-03", "v84: depart and arrive on separate lines, date with no year");
  const ld = '<script type="application/ld+json">{"@context":"http://schema.org","@type":"FlightReservation","reservationNumber":"RXJ34P","underName":{"@type":"Person","name":"Zz Test"},"reservationFor":{"@type":"Flight","departureAirport":{"@type":"Airport","iataCode":"SFO"},"departureTime":"2027-03-04T20:15:00-08:00","arrivalAirport":{"@type":"Airport","iataCode":"JFK"}}}</script>';
  const r4 = BK.parse(ld);
  ok(r4.flights.length === 1 && r4.flights[0].dep === "SFO" && r4.flights[0].date === "2027-03-04" && !/RXJ34P|Zz Test/.test(JSON.stringify(r4)), "v84: schema.org FlightReservation (JSON-LD) read, its code and name left out");
  ok(BK.parse("Total USD 300 THE END GBP-EUR").flights.length === 0 && BK.toTrip(BK.parse("nothing here"), air) === null, "v84: currency codes aren't airports; nothing found gives null");
  ok(BK.toTrip({ flights: [{ dep: "EDI", arr: "ZZZ", date: "" }], hotels: [] }, air) === null, "v84: unknown airport codes are dropped");
  ok(BK.datesIn("2026-02-30 and 31 June 2026").length === 0 && BK.datesIn("Feb 29, 2028")[0] === "2028-02-29", "v84: only real dates");
  const tui = fs.readFileSync(path.join(__dirname, "../travel-log/app/trips-ui.js"), "utf8"), ix = read("index.html");
  ok(/id="tpaste"/.test(tui) && /function bookingSheet/.test(tui) && /pendingBooking = found/.test(tui) && /!fromWish && !fromBooking && RB/.test(tui), "v84: Add a trip has Paste a booking; it fills the form and skips the unfinished-trip resume");
  ok(/<script src="booking-core\.js"><\/script>/.test(ix) && !/fetch\(|XMLHttpRequest|localStorage|indexedDB/.test(fs.readFileSync(path.join(__dirname, "../travel-log/app/booking-core.js"), "utf8")), "v84: booking reader is bundled and never sends or stores the pasted text");
}
// ---- v83: family menu links go where they say (no bounce back to Home) ----
{
  const sy = fs.readFileSync(path.join(__dirname, "../travel-log/app/sync.js"), "utf8");
  ok(/function spendOverlay\(\) \{ if \(history\.state && history\.state\.fsovl === 1\) history\.replaceState\(\{ fsovl: 2 \}, ""\); ovlOpen = false; \}/.test(sy), "v83: a menu link marks the menu's Back entry spent instead of calling history.back()");
  ok(/else if \(e\.target\.closest\("a"\)\) \{ spendOverlay\(\); closeMenu\(\); \}/.test(sy), "v83: tapping a menu link spends the entry before closing");
}
// ---- v82: passport "about me" page: favorites + birthday month/day only (never the year), no real ID details ----
{
  const P = require("../travel-log/app/passport-core.js");
  const c = P.cleanIdPage({ snack: "Zz Pretzels", dream: "  Zz   Japan ", pack: "A12345678", animal: "passport no 4", best: "x".repeat(90), bday: "6-14", year: "2015", birthYear: 2015, idNumber: "123" });
  ok(c.snack === "Zz Pretzels" && c.dream === "Zz Japan" && c.best.length === 40 && c.bday === "06-14", "v82: about-me fields cleaned, birthday kept as month-day");
  ok(!("pack" in c) && !("animal" in c), "v82: anything that looks like a passport / ID number is left out");
  ok(!("year" in c) && !("birthYear" in c) && !("idNumber" in c) && Object.keys(c).every(k => P.ID_FIELDS.some(f => f[0] === k) || k === "bday"), "v82: only the known fields are kept (no year, no ID fields)");
  ok(P.cleanBday("02-30") === "" && P.cleanBday("13-01") === "" && P.cleanBday("2015-06-14") === "" && P.cleanBday("02-29") === "02-29", "v82: birthday must be a real month + day, never a full date with a year");
  ok(P.bdayText("06-14") === "June 14" && P.bdayText("") === "", "v82: birthday shown as 'June 14'");
  ok(P.isBirthday("06-14", new Date(2026, 5, 14)) && !P.isBirthday("06-14", new Date(2026, 5, 15)) && P.isBirthday("02-29", new Date(2027, 1, 28)) && !P.isBirthday("02-29", new Date(2028, 1, 28)), "v82: birthday today (Feb 29 birthdays get Feb 28 in other years)");
  const tui = fs.readFileSync(path.join(__dirname, "../travel-log/app/trips-ui.js"), "utf8");
  ok(/function idPageHTML/.test(tui) && /idPageHTML\(A\(\)\.kidById\(pid\)\)/.test(tui) && /Never put real passport or ID numbers here/.test(tui) && /no year/.test(tui), "v82: the page sits after the cover and says it's a pretend passport");
  ok(!/id="id-(year|by|passport|num)/.test(tui), "v82: the edit sheet has no birth-year or ID-number field");
}
// ---- v81 (item 6): famous landmarks get their own drawn stamps (Wikimedia Commons CC0 / PD / CC BY, credited); earned stamps upgrade, nothing removed ----
{
  const SA = require("../travel-log/app/stamp-art.js"), P = require("../travel-log/app/passport-core.js");
  globalThis.WK_STAMPART = SA; delete globalThis.FS_LANDMARKS;
  require("../travel-log/app/landmark-art.js");
  const LM = globalThis.FS_LANDMARKS;
  ok(LM && LM.ids.length >= 20, "landmarks: drawings registered (" + (LM ? LM.ids.length : 0) + ")");
  ok(LM.ids.every(q => /^Q\d+$/.test(q) && typeof SA.GLYPHS["lm_" + q] === "function" && /<path fill-rule="evenodd" d="M/.test(SA.GLYPHS["lm_" + q]())), "landmarks: every drawing is one ink shape keyed by its Wikidata id");
  ok(LM.ids.every(q => { const c = LM.credit(q); return c && c.name && c.artist && /^(CC0|Public domain|CC BY( \d\.\d)?( us)?)$/.test(c.license) && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.page); }), "landmarks: every drawing has a free license (CC0 / PD / CC BY) and its credit");
  ["Q243", "Q9202", "Q41225", "Q10285", "Q37200", "Q45178"].forEach(q => ok(LM.has(q), "landmarks: has a drawing for " + q + " (" + LM.credit(q).name + ")"));
  const pt = (ref) => ({ kind: "sight", name: "Zz Eiffel Tower", type: "tower", country: "FRA", lat: 48.8583, lon: 2.2945, ref: ref });
  const L = require("../travel-log/app/log-core.js"), T = require("../travel-log/app/trips-core.js");
  const mom = L.newPerson({ name: "Zz Test Mom", role: "adult" });
  const trips = [L.newTrip({ kidIds: [mom.id], place: "Zz Test Paris", date: "2026-05-01", route: T.cleanRoute([{ name: "Zz Home", kind: "city", lat: 48.85, lon: 2.35, country: "FRA" }, pt("Q243"), Object.assign(pt(""), { name: "Zz Corner Cafe Tower", lat: 48.86 })]) })];
  const ss = P.stampsFor(mom, trips, {}).filter(s => s.kind === "sight");
  const lmS = ss.find(s => s.ref === "Q243"), plain = ss.find(s => !s.ref);
  const d1 = SA.design("sight", lmS.area, lmS.name, null, lmS), d2 = SA.design("sight", plain.area, plain.name, null, plain);
  ok(d1.landmark === true && d1.motif === "lm_Q243" && d1.border === "double", "landmarks: Eiffel Tower stop gets its drawn stamp (double ring)");
  ok(d2.landmark === false && d2.motif === SA.typeOf("tower").motif, "landmarks: a sight with no drawing keeps its type's stamp, with its own name");
  const before = P.stampsFor(mom, trips, {}).map(s => s.kind + ":" + s.area).join(",");
  const g = SA.GLYPHS.lm_Q243; delete SA.GLYPHS.lm_Q243;
  const d0 = SA.design("sight", lmS.area, lmS.name, null, lmS);
  const after = P.stampsFor(mom, trips, {}).map(s => s.kind + ":" + s.area).join(",");
  SA.GLYPHS.lm_Q243 = g;
  ok(d0.landmark === false && before === after, "landmarks: without the drawing the same stamp shows the type picture; adding one upgrades it (same stamp id, nothing removed)");
  ok(/lm_Q243|<path fill-rule="evenodd"/.test(SA.stampSVG(lmS, { name: lmS.name })), "landmarks: the landmark stamp draws its picture");
  const html = fs.readFileSync(path.join(__dirname, "../travel-log/app/index.html"), "utf8"), tui = fs.readFileSync(path.join(__dirname, "../travel-log/app/trips-ui.js"), "utf8");
  ok(/<script src="stamp-art\.js"><\/script>\s*<script src="landmark-art\.js"><\/script>/.test(html), "landmarks: drawings load right after the stamp art (in the bundle)");
  ok(/class="small muted lmcredit">Landmark drawings from Wikimedia Commons/.test(tui) && /LM\.credit\(s\.ref\)/.test(tui), "landmarks: Sights pages credit each drawing's artist and license");
  const credits = fs.readFileSync(path.join(__dirname, "../travel-log/LANDMARK-CREDITS.md"), "utf8");
  ok(LM.ids.every(q => credits.includes(q)), "landmarks: LANDMARK-CREDITS.md lists every drawing");
  delete globalThis.WK_STAMPART;
}
// ---- v81: every kind of place gets its own stamp; OpenStreetMap lookup (on tap, 1/s, cached, credited); drop a pin; drink stamps grown-ups only ----
{
  const O = require("../travel-log/app/osm-core.js"), P = require("../travel-log/app/passport-core.js"), SA = require("../travel-log/app/stamp-art.js"), L = require("../travel-log/app/log-core.js"), T = require("../travel-log/app/trips-core.js");
  const I = {}; Object.keys(P.ISO32).forEach(k => { I[P.ISO32[k].toLowerCase()] = k; });
  const lb = t => SA.typeOf(t).label;
  // 1. Nominatim usage policy
  const u = O.searchURL("Neist Point Lighthouse");
  ok(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/.test(u) && /format=jsonv2/.test(u) && /limit=8/.test(u) && /q=Neist%20Point%20Lighthouse$/.test(u), "v81: OSM search URL is the public Nominatim search, small result count");
  ok(O.GAP_MS >= 1000 && O.waitFor(Date.now(), Date.now()) >= 1000 && O.waitFor(0, Date.now()) === 0, "v81: never more than one OpenStreetMap request a second");
  ok(O.ATTR === "© OpenStreetMap contributors", "v81: OpenStreetMap credit text");
  const pin = read("pin.js"), tui = read("trips-ui.js");
  ok(/OpenStreetMap contributors/.test(pin) && /openstreetmap\.org\/copyright/.test(pin) && /OpenStreetMap contributors/.test(tui), "v81: map and results credit OpenStreetMap");
  ok(/cacheGet\(window\.localStorage/.test(pin) && /cachePut\(window\.localStorage/.test(pin), "v81: OpenStreetMap answers are cached on the phone");
  ok(/data-pick="osm"/.test(tui) && !/FS_PIN\.search\([^)]*\)[^;]*addEventListener\("input"/.test(tui) && (tui.match(/FS_PIN\.search\(/g) || []).length === 1 && /function osmSearch/.test(tui), "v81: OpenStreetMap is only searched when someone taps (no search-as-you-type)");
  const st = { m: {}, getItem(k) { return this.m[k] || null; }, setItem(k, v) { this.m[k] = v; } };
  O.cachePut(st, "a", [1]); ok(JSON.stringify(O.cacheGet(st, "a")) === "[1]" && O.cacheGet(st, "b") === null, "v81: cache round-trips");
  for (let i = 0; i < 200; i++) O.cachePut(st, "k" + i, i);
  ok(Object.keys(JSON.parse(st.m["fs-osm"])).length <= 150, "v81: cache stays small (oldest dropped)");
  const html = read("index.html");
  ok(/connect-src [^;]*https:\/\/nominatim\.openstreetmap\.org/.test(html) && /img-src [^;]*https:\/\/tile\.openstreetmap\.org/.test(html), "v81: CSP allows only Nominatim and the OSM map tiles for this");
  ok(/<script src="towns-core\.js"><\/script>\s*<script src="osm-core\.js"><\/script>\s*<script src="pin\.js"><\/script>/.test(html), "v81: OSM + pin scripts load (in the bundle)");
  // 2. OSM results -> stops with the right type
  const A = (cc, st2, l4, extra) => Object.assign({ country_code: cc, country: st2 }, l4 ? { "ISO3166-2-lvl4": l4 } : {}, extra || {});
  const R = [
    [{ name: "Neist Point Lighthouse", category: "man_made", type: "lighthouse", lat: "57.42", lon: "-6.79", address: A("gb", "United Kingdom", "GB-SCT", { village: "Glendale", state: "Scotland" }) }, "lighthouse", "GBR", "SCT"],
    [{ name: "Ullapool Ferry Terminal", category: "amenity", type: "ferry_terminal", lat: "57.89", lon: "-5.16", address: A("gb", "United Kingdom", "GB-SCT") }, "ferry", "GBR", "SCT"],
    [{ name: "Talisker Distillery", category: "craft", type: "distillery", lat: "57.30", lon: "-6.36", address: A("gb", "United Kingdom", "GB-SCT") }, "distillery", "GBR", "SCT"],
    [{ name: "Shell Beach", category: "natural", type: "beach", lat: "-26.2", lon: "113.8", address: A("au", "Australia", "AU-WA") }, "beach", "AUS", "WA"],
    [{ name: "Zz Test Falls", category: "waterway", type: "waterfall", lat: "35.1", lon: "-83.1", address: A("us", "United States", "US-NC") }, "waterfall", "USA", "NC"],
    [{ name: "Henry Doorly Zoo", category: "tourism", type: "zoo", lat: "41.22", lon: "-95.93", address: A("us", "United States", "US-NE") }, "zoo", "USA", "NE"],
    [{ name: "Camp Nou", category: "leisure", type: "stadium", lat: "41.38", lon: "2.12", address: A("es", "Spain") }, "stadium", "ESP", ""],
    [{ name: "Forth Bridge", category: "man_made", type: "bridge", lat: "56.0", lon: "-3.39", address: A("gb", "United Kingdom", "GB-SCT") }, "bridge", "GBR", "SCT"],
    [{ name: "Old Faithful", category: "natural", type: "geyser", lat: "44.46", lon: "-110.83", address: A("us", "United States", "US-WY"), extratags: { wikidata: "Q1129397" } }, "geyser", "USA", "WY"],
    [{ name: "Zz Test Playground", category: "leisure", type: "playground", lat: "43.07", lon: "-89.4", address: A("us", "United States", "US-WI") }, "playground", "USA", "WI"],
    [{ name: "Zz Odd Thing", category: "shop", type: "bakery", lat: "1", lon: "1", address: A("fr", "France") }, "pin", "FRA", ""]
  ];
  R.forEach(([r, ty, c3, reg]) => {
    const p = O.toPoint(r, I, lb), c = T.cleanPoint(p, false);
    ok(p && p.kind === "sight" && p.type === ty && p.country === c3 && (p.region || "") === reg && c.kind === "sight" && c.type === ty && new RegExp("^" + lb(ty)).test(c.sub || ""), "v81: OSM " + r.name + " -> " + ty + " stop in " + c3 + (reg ? "/" + reg : ""));
  });
  ok(O.toPoint(R[8][0], I, lb).ref === "Q1129397", "v81: OSM Wikidata id kept, so it's the same stamp as our own list's");
  const town = O.toPoint({ name: "Ullapool", category: "place", type: "village", lat: "57.9", lon: "-5.16", address: A("gb", "United Kingdom", "GB-SCT", { state: "Scotland" }) }, I, lb);
  ok(town.kind === "city" && town.country === "GBR" && town.region === "SCT" && /Scotland/.test(town.sub), "v81: an OSM town becomes a town stop");
  ok(O.toPoint({ name: "x", lat: "nope", lon: "1" }, I, lb) === null && O.toPoint(null, I, lb) === null, "v81: bad OSM rows are skipped");
  // tiles
  const t1 = O.tileXY(55.95, -3.19, 12), b1 = O.latLon(t1.x, t1.y, 12);
  ok(Math.abs(b1.lat - 55.95) < 1e-6 && Math.abs(b1.lon + 3.19) < 1e-6 && /^https:\/\/tile\.openstreetmap\.org\/12\/\d+\/\d+\.png$/.test(O.tileURL(Math.floor(t1.x), Math.floor(t1.y), 12)), "v81: map tile math round-trips");
  // 3. every type has its own stamp
  const kid = L.newPerson({ name: "Zz Test Kid", role: "kid" }), mom = L.newPerson({ name: "Zz Test Mom", role: "adult" });
  const types = Object.keys(SA.TYPES);
  ok(types.length >= 40 && ["lighthouse", "ferry", "station", "drive", "stadium", "film", "bridge", "pin", "distillery", "brewery", "winery", "pub", "zoo", "aquarium", "themepark", "waterpark", "playground", "beach", "waterfall", "lake", "island", "peak", "cave", "glacier", "geyser"].every(k => types.includes(k)), "v81: all place types exist (" + types.length + ")");
  const trips = []; for (let i = 0; i < types.length; i += 10) trips.push(L.newTrip({ kidIds: [kid.id, mom.id], place: "Zz Test Everything " + i, date: "2026-08-01",
    route: T.cleanRoute([{ name: "Zz Home", kind: "city", lat: 40.7, lon: -74, country: "USA", region: "NY" }].concat(types.slice(i, i + 10).map((ty, j) => ({ name: "Zz " + ty + " place", kind: "sight", type: ty, lat: 10 + (i + j) / 10, lon: 10, country: "FRA", mode: "car" })))) }));
  const trip = trips;
  const ks = P.stampsFor(kid, trips, {}).filter(s => s.kind === "sight"), ms = P.stampsFor(mom, trips, {}).filter(s => s.kind === "sight");
  ok(ms.length === types.length, "v81: a grown-up gets one stamp per place type (" + ms.length + ")");
  const sv = ms.map(s => P.stampSVG(s));
  ok(sv.every(x => /<svg/.test(x)) && new Set(ms.map(s => SA.typeOf(s.type).motif)).size >= 20, "v81: each type draws its own stamp (motifs differ)");
  ok(ks.length === types.length - 4 && !ks.some(s => SA.typeOf(s.type).group === "drinks"), "v81: a kid's passport skips distillery / brewery / winery / pub stamps");
  ok(P.stampsFor(kid, trips, { adultInKid: true }).filter(s => s.kind === "sight").length === types.length, "v81: ...unless grown-up bits are turned on for kids' pages");
  ok(P.stampsFor(kid, trips, {}).some(s => s.kind === "place" && s.area === "FRA"), "v81: the kid still gets the country stamp from a distillery stop");
  ok(/function sctx\(\)/.test(tui) && /P\.stampsFor\(p, S\(\)\.trips, sctx\(\)\)/.test(tui), "v81: the passport passes the family's grown-up setting");
  // 4. famous drives / film locations / stations are in the search data
  const SD = path.join(APP, "data", "sights");
  const findS = (nm) => { const f = fs.readdirSync(SD).filter(x => /\.json$/.test(x) && x !== "index.json"); for (const x of f) { const j = JSON.parse(fs.readFileSync(path.join(SD, x), "utf8")); const rows = String(j.rows || "").split("\n"); for (const r of rows) { if (r.split("\t")[0].split("|")[0] === nm) return r; } } return null; };
  ["North Coast 500", "Glenfinnan Viaduct", "Hobbiton Movie Set", "Eiffel Tower", "Colosseum", "Machu Picchu"].forEach(nm => ok(!!findS(nm), "v81: search data has " + nm));
  // 5. drop a pin
  ok(/Drop a pin/.test(pin) && /Use where I am now/.test(pin) && /kind: "sight", type: type/.test(pin) && /data-pick="pin"/.test(tui), "v81: drop a pin: name, type, tap the map or use where you are");
  ok(/optgroup label="' \+ groups\[g\]/.test(pin) && /Drinks \(grown-ups\)/.test(pin), "v81: pin types grouped (drinks marked grown-ups)");
  const pinStop = T.cleanPoint({ name: "Zz Grandpa's Cabin", kind: "sight", type: "pin", lat: 45.12345, lon: -89.5, country: "USA", region: "WI", sub: "Pinned place · Wisconsin" }, false);
  const pt = L.newTrip({ kidIds: [kid.id], place: "Zz Cabin", date: "2026-09-01", route: [{ name: "Zz Home", kind: "city", lat: 43, lon: -89.4, country: "USA", region: "WI" }, pinStop] });
  const pss = P.stampsFor(kid, [pt], {});
  ok(pss.some(s => s.kind === "sight" && s.name === "Zz Grandpa's Cabin") && pss.some(s => s.kind === "state" && s.area === "WI"), "v81: a dropped pin is its own stamp and counts for its state");
}

// ---- v80: reorder a trip's stops and add a forgotten stop in the middle; stops, nights, stamps and photos stay ----
{
  const T = require("../travel-log/app/trips-core.js"), P = require("../travel-log/app/passport-core.js"), L = require("../travel-log/app/log-core.js");
  const kid = L.newPerson({ name: "Zz Test Kid", role: "kid" });
  const mk = () => L.newTrip({ kidIds: [kid.id], place: "Zz Test Loop", date: "2026-07-01", endDate: "2026-07-09", photoId: "zz-photo-1",
    route: [{ name: "Zz Home", kind: "city", lat: 40.7, lon: -74, country: "USA", region: "NY" },
            { name: "London", kind: "city", lat: 51.5, lon: -0.12, country: "GBR", region: "ENG", nights: 2, mode: "plane", dep: { code: "JFK", name: "JFK", lat: 40.6, lon: -73.8 }, arr: { code: "LHR", name: "Heathrow", lat: 51.47, lon: -0.45 } },
            { name: "Edinburgh", kind: "city", lat: 55.95, lon: -3.19, country: "GBR", region: "SCT", nights: 3, mode: "train", miles: 400 },
            { name: "Cardiff", kind: "city", lat: 51.48, lon: -3.18, country: "GBR", region: "WLS", nights: 2, mode: "car", sub: "Zz castle day" }] });
  const t = mk(), ids0 = P.stampsFor(kid, [t], {}).map(s => s.id).sort();
  const objs = t.route.slice();
  let m = T.moveStop(t.route, 3, 1);   // Cardiff before London
  ok(m.route.map(p => p.name).join(",") === "Zz Home,Cardiff,London,Edinburgh", "move: Cardiff now comes first");
  ok(m.route.every(p => objs.indexOf(p) >= 0) && m.route.length === 4, "move keeps the very same stops (nothing lost or copied)");
  ok(m.route[1].nights === 2 && m.route[1].sub === "Zz castle day" && m.route[1].lat === 51.48, "a moved stop keeps its nights and details");
  ok(m.changed.join() === "1,2" && !m.route[2].dep && m.route[3].miles === 400, "only legs that now start somewhere else drop old typed miles / airports (London->Edinburgh keeps 400 mi)");
  ok(T.moveStop(t.route, 0, 2).route[0].name === "Zz Home" && T.moveStop(t.route, 2, 0).changed.length === 0, "the start can't be moved");
  const t2 = Object.assign({}, t, { route: m.route });
  const v = P.tripVisits(t2).map(x => x.area + "@" + x.date);
  ok(v.join() === "WLS@2026-07-01,ENG@2026-07-03,SCT@2026-07-05", "dates follow the new order: " + v.join());
  ok(JSON.stringify(P.stampsFor(kid, [t2], {}).map(s => s.id).sort()) === JSON.stringify(ids0), "same stamps after reordering (ids don't depend on order)");
  const t3 = mk(), keep = t3.route[2];
  const ins = T.insertStop(t3.route, 2, { name: "York", kind: "city", lat: 53.96, lon: -1.08, country: "GBR", region: "ENG", nights: 1, mode: "train" });
  ok(ins.route.map(p => p.name).join(",") === "Zz Home,London,York,Edinburgh,Cardiff" && ins.at === 2, "insert: York goes between London and Edinburgh");
  ok(ins.route[3] === keep && keep.nights === 3 && keep.miles === undefined && ins.route[1].dep && ins.route[1].dep.code === "JFK", "the stop after it keeps its nights; only its old leg miles go; other legs untouched");
  const v3 = P.tripVisits(Object.assign({}, t3, { route: ins.route })).map(x => x.area + "@" + x.date);
  ok(v3.join() === "ENG@2026-07-01,SCT@2026-07-04,WLS@2026-07-07", "dates shift for the stops after the new one: " + v3.join());
  ok(T.insertStop([], 5, { name: "Zz" }).route.length === 1 && T.insertStop(t3.route, 0, { name: "Zz" }).at === 1, "insert never goes before the start");
  const clean = T.cleanRoute(ins.route); ok(clean.length === 5 && clean[2].name === "York", "reordered route survives cleaning / sync");
  ok(t.photoId === "zz-photo-1" && t2.photoId === "zz-photo-1", "the trip photo stays");
  const ui = read("trips-ui.js");
  ok(/data-addat=/.test(ui) && /Add a stop here/.test(ui) && /data-grip=/.test(ui) && /data-mv=/.test(ui) && /T\.moveStop\(/.test(ui) && /T\.insertStop\(/.test(ui), "builder has drag, arrows and Add a stop here");
  ok(/\.rp \.addhere/.test(read("app.css")) && /touch-action:none/.test(read("app.css")), "drag grip styled for touch");
}
// ---- v79: sights in place search (castles, ruins, viewpoints...), each with its own stamp, counted for its town and country ----
{
  const TW = require("../travel-log/app/towns-core.js"), T = require("../travel-log/app/trips-core.js"), P = require("../travel-log/app/passport-core.js"), SA = require("../travel-log/app/stamp-art.js"), L = require("../travel-log/app/log-core.js");
  const dir = __dirname + "/../travel-log/app/data/sights/";
  const idx = JSON.parse(fs.readFileSync(dir + "index.json", "utf8"));
  const find = (q, cc, type) => { const k = TW.keyFor(q, idx); if (!k || !fs.existsSync(dir + k + ".json")) return null; const f = TW.parse(JSON.parse(fs.readFileSync(dir + k + ".json", "utf8"))); return TW.match(q, f, { words: true, limit: 30 }).map(h => h.row).find(r => (!cc || r.country === cc) && (!type || r.type === type)) || null; };
  ok(idx.sights > 50000, "lots of sights worldwide: " + idx.sights);
  const ec = find("Edinburgh Castle", "GBR");
  ok(ec && ec.type === "castle" && ec.town === "Edinburgh" && ec.rank >= 40 && /^Q\d+$/.test(ec.wd), "Edinburgh Castle: a famous castle in Edinburgh: " + JSON.stringify(ec));
  const SIGHT_CASES = [["Tintern Abbey", "GBR", "ruin"], ["Urquhart Castle", "GBR", "ruin"], ["Tunnel View", "USA", "viewpoint"], ["Ladies View", "IRL", "viewpoint"], ["Niagara Falls", "CAN", "waterfall"], ["Notre Dame de Paris", "FRA", "cathedral"], ["Tikal", "GTM", "ancient"], ["Ben Nevis", "GBR", "peak"]];
  for (const [q, cc, type] of SIGHT_CASES) ok(find(q, cc, type), q + " is a " + type + (cc ? " in " + cc : ""));
  const big = fs.readdirSync(dir).map(f => fs.statSync(dir + f).size).sort((a, b) => b - a)[0];
  ok(big < 500000, "every sights file is small enough to load on a phone: biggest " + big);
  // a sight stop keeps its type and town, and counts toward its town and country
  const stop = T.cleanPoint ? T.cleanPoint({ name: "Edinburgh Castle", kind: "sight", type: "castle", town: "Edinburgh", fame: 140, ref: "Q212065", lat: 55.9486, lon: -3.1999, country: "GBR", region: "SCT", sub: "Castle · Edinburgh, Scotland, UK" }) : null;
  ok(stop && stop.kind === "sight" && stop.type === "castle" && stop.town === "Edinburgh" && stop.fame === 140 && stop.ref === "Q212065", "trip stop keeps sight type, town and fame");
  ok(T.cleanPoint({ name: "Zz", kind: "sight", type: "<script>", lat: 1, lon: 1 }).type === "landmark", "an odd sight type falls back to landmark");
  const kid = L.newPerson({ name: "Zz Test Kid", role: "kid" });
  const trip = L.newTrip({ kidIds: [kid.id], place: "Zz Test Scotland", date: "2026-07-01", endDate: "2026-07-05",
    route: [{ name: "Zz Home", kind: "city", lat: 40.7, lon: -74, country: "USA", region: "NY" }, { name: "Edinburgh", kind: "city", lat: 55.95, lon: -3.19, country: "GBR", region: "SCT" }, stop] });
  const st = T.summary(trip);
  ok(st.sights && st.sights.length === 1 && st.sights[0] === "Edinburgh Castle" && st.cities.indexOf("Edinburgh") >= 0, "trip stats list the sight");
  const ps = P.stampsFor(kid, [trip], {});
  const sx = ps.find(x => x.kind === "sight");
  ok(sx && sx.area === "Q212065" && sx.name === "Edinburgh Castle" && sx.type === "castle" && P.section(sx.kind, sx.area) === "sights", "the sight earns its own stamp in the Sights section");
  ok(ps.some(x => x.kind === "place" && x.area === "SCT"), "...and Scotland's stamp still counts");
  ok(sx && P.sightSub(sx) === "Castle · Edinburgh", "stamp says what and where: " + (sx && P.sightSub(sx)));
  const svg = P.stampSVG && sx ? P.stampSVG(sx) : "";
  ok(/<svg/.test(svg) && /EDINBURGH CASTLE|Edinburgh Castle/i.test(svg), "the sight stamp draws with its name");
  for (const t of ["castle", "ruin", "cathedral", "abbey", "monument", "museum", "landmark", "viewpoint", "waterfall"]) ok(SA.TYPES[t] && SA.typeOf(t).emoji, "stamp type for " + t);
  const ui = read("trips-ui.js");
  ok(/ensureLayer\(SIGHTS/.test(ui) && /fambadge/.test(ui) && /Famous landmark/.test(ui), "trip search shows sights with a Famous landmark badge");
  ok(/fambadge/.test(read("app.css")), "the badge is styled");
}
// ---- v78: every town worldwide in place search (data/towns, towns-core.js) ----
{
  const TW = require("../travel-log/app/towns-core.js"), dir = __dirname + "/../travel-log/app/data/towns/";
  const idx = JSON.parse(fs.readFileSync(dir + "index.json", "utf8"));
  const find = (q, cc) => { const k = TW.keyFor(q, idx); if (!k || !fs.existsSync(dir + k + ".json")) return null; const f = TW.parse(JSON.parse(fs.readFileSync(dir + k + ".json", "utf8"))); const h = TW.match(q, f).filter(x => !cc || x.row.country === cc); return h[0] || null; };
  ok(idx.towns > 200000, "over 200,000 towns worldwide: " + idx.towns);
  ok(TW.fold("Köln") === "koln" && TW.fold("Liège") === "liege" && TW.fold("St. Andrews") === TW.fold("Saint Andrews") && TW.fold("Łódź") === "lodz" && TW.fold("Straße") === "strasse", "accents and St/Saint fold the same way");
  for (const [q, cc, own] of [["Ghent", "BEL", "Gent"], ["Gent", "BEL", "Gent"], ["Bruges", "BEL", "Brugge"], ["Brugge", "BEL", "Brugge"], ["Cologne", "DEU", "Köln"], ["Köln", "DEU", "Köln"], ["Koln", "DEU", "Köln"], ["Munich", "DEU", ""], ["Florence", "ITA", ""], ["Lisbon", "PRT", ""]]) {
    const h = find(q, cc); ok(h && (!own || h.row.names[0] === own), q + " finds the " + cc + " town" + (own ? " (" + own + ")" : "") + ": " + (h && h.row.names.join("/")));
  }
  ok(find("ghent").row.country === "BEL", "Ghent, Belgium comes before smaller Ghents");
  for (const [q, cc] of [["Hallstatt", "AUT"], ["Giethoorn", "NLD"], ["Dingle", "IRL"], ["Portree", "GBR"], ["Rothenburg ob der Tauber", "DEU"], ["Alberobello", "ITA"], ["Bled", "SVN"], ["Colmar", "FRA"], ["Cesky Krumlov", "CZE"], ["Akaroa", "NZL"], ["Tofino", "CAN"], ["Byron Bay", "AUS"], ["Nelsonville", "USA"], ["Swan Hill", "AUS"]])
    ok(find(q, cc), "small town found: " + q + (cc ? ", " + cc : ""));
  const big = fs.readdirSync(dir).map(f => fs.statSync(dir + f).size).sort((a, b) => b - a)[0];
  ok(big < 500000, "every towns file is small enough to load on a phone: biggest " + big);
  const pl = JSON.parse(read("data/places.json")); ok(pl.rows.split("\n").length === 52188 && /^Gent\t/m.test(pl.rows), "places.json is untouched (52,188 places)");
  const ui = read("trips-ui.js"); ok(/ensureTowns\(q\)/.test(ui) && /TW\.match\(head, file/.test(ui), "trip search uses the worldwide towns");
}
// ---- v77: big people sync without "people_data_check" (kid-drawn stamps, long lists go to people.data_more) ----
{
  const S = require("../travel-log/app/sync-core.js");
  const FID = "fam-zz";
  const art = n => "data:image/jpeg;base64," + "A".repeat(n);
  const cloudOk = r => S.utf8Len(JSON.stringify(r.data)) < 8000;   // what the server's check allows (pg_column_size(data) < 8000)
  const kid = M.newPerson({ name: "Zz Test Kid", role: "kid", now: "2026-10-01T10:00:00.000Z" }), grown = M.newPerson({ name: "Zz Test Parent", role: "adult", now: "2026-10-01T10:00:00.000Z" });
  kid.stampArt = { "place:SCT": art(40000), "state:FL": art(30000), "park:zion": art(25000) };
  kid.firsts = Array.from({ length: 120 }, (_, i) => ({ id: "f" + i, what: "Zz Test first number " + i + " with a long note about the day", at: "2026-07-10" }));
  kid.updatedAt = "2026-10-02T10:00:00.000Z";
  const old = { data: Object.assign({}, kid) }; delete old.data.states; delete old.data.places; delete old.data.parks;
  ok(!cloudOk(old), "the old one-column row really was too big for people_data_check (the Oct 27 'Sync paused')");
  let local = { people: [kid, grown], trips: [], photoIds: [] }, sh = { people: {}, visits: {}, trips: {}, photos: {} };   // a shadow saved by v76 (no .more)
  let plan = S.planPush(local, sh, FID, "2026-10-03T00:00:00Z");
  const kr = plan.people.find(r => r.id === kid.id), gr = plan.people.find(r => r.id === grown.id);
  ok(plan.people.every(cloudOk), "every person row now fits the cloud's data limit");
  ok(kr.data.name === "Zz Test Kid" && kr.data.role === "kid" && !kr.data.stampArt, "name and role stay in data; drawings move out");
  ok(Object.keys(kr.data_more.stampArt).length === 3 && kr.data_more.stampArt["place:SCT"] === kid.stampArt["place:SCT"], "all 3 drawings go up whole in data_more");
  ok(kr.data_more.firsts && kr.data_more.firsts.length === 120 && !kr.data.firsts, "an oversized list moves to data_more, nothing cut");
  ok(!("data_more" in gr), "a small person doesn't send data_more (keeps any the cloud already has)");
  const batches = S.peopleBatches(plan.people);
  ok(batches.every(b => b.every(r => !("_moreHash" in r))) && batches.every(b => b.every(r => ("data_more" in r) === ("data_more" in b[0]))), "each upsert call has the same columns, helper fields stripped");
  ok(batches.filter(b => "data_more" in b[0]).every(b => b.length === 1), "big rows go one per request");
  ok(S.pendingCount(plan) >= 2, "the waiting changes are counted");
  S.afterPush(sh, plan);
  ok(S.pendingCount(S.planPush(local, sh, FID)) === 0, "after the push nothing is waiting (banner clears)");
  kid.nickname = "Zz"; kid.updatedAt = "2026-10-04T10:00:00.000Z";
  plan = S.planPush(local, sh, FID);
  ok(plan.people.length === 1 && !("data_more" in plan.people[0]) && plan.people[0].data.nickname === "Zz", "a small edit doesn't resend the drawings");
  S.afterPush(sh, plan);
  kid.stampArt["state:WI"] = art(20000); kid.updatedAt = "2026-10-05T10:00:00.000Z";
  plan = S.planPush(local, sh, FID);
  ok(plan.people.length === 1 && Object.keys(plan.people[0].data_more.stampArt).length === 4, "a new drawing sends data_more again");
  S.afterPush(sh, plan);
  // a second phone pulls it back together
  const row = Object.assign({}, S.peopleBatches(plan.people).flat()[0], { server_at: "2026-10-05T10:00:01Z" });
  const phone2 = { people: [], trips: [], photoIds: [] }, sh2 = S.emptyShadow();
  S.applyPull(phone2, sh2, { people: [row], visits: [], trips: [], photos: [] });
  const k2 = phone2.people[0];
  ok(k2 && k2.name === "Zz Test Kid" && Object.keys(k2.stampArt).length === 4 && k2.firsts.length === 120, "another phone gets the drawings and the list back");
  ok(S.planPush(phone2, sh2, FID).people.length === 0, "pulled people don't echo back up");
  // an older cloud row (no data_more) never wipes what this phone has
  const onlyData = { family_id: FID, id: kid.id, data: { name: "Zz Test Kid", role: "kid" }, updated_at: "2026-10-06T10:00:00.000Z", deleted: false, server_at: "2026-10-06T10:00:01Z" };
  S.applyPull(phone2, sh2, { people: [onlyData], visits: [], trips: [], photos: [] });
  ok(Object.keys(phone2.people[0].stampArt).length === 4, "a row from an older app version keeps this phone's drawings");
  // two phones, different drawings: both kept
  const a = { stampArt: { "place:SCT": art(10) } }, b = { stampArt: { "place:IRL": art(12), "place:SCT": art(11) } };
  ok(S.mergePersonPieces(a, b) && Object.keys(a.stampArt).length === 2 && a.stampArt["place:SCT"] === art(10), "merging keeps both phones' drawings, ours wins on the same place");
  ok(S.rowData({ data: { name: "x" }, data_more: { stampArt: { k: "v" } } }).stampArt.k === "v", "rowData overlays data_more");
  ok(/peopleBatches\(plan\.people\)/.test(read("sync.js")) && /people_data|data_more/.test(read("sync-core.js")), "sync.js sends people through peopleBatches");
}
// ---- Family Sync (sync-core.js: invite codes, push/pull, conflicts, merge, plan) ----
{
  const S = require("../travel-log/app/sync-core.js");
  const ssrc = read("sync.js"), score = read("sync-core.js"), scfg = read("sync-config.js"), scss = read("sync.css");
  ok(S.WORDS.length === 64 && new Set(S.WORDS).size === 64 && S.WORDS.every(w => /^[A-Z]+$/.test(w)), "64 unique invite words");
  const sqlPath = "/workspace/new-streams/travel-app/supabase/migrations/20261023120000_family_sync.sql";
  if (fs.existsSync(sqlPath)) {
    const sql = fs.readFileSync(sqlPath, "utf8"), m = /invite_words\(\)[\s\S]*?array\[([\s\S]*?)\];/.exec(sql);
    ok(m && m[1].match(/'([A-Z]+)'/g).map(x => x.slice(1, -1)).join() === S.WORDS.join(), "app and database use the same invite words");
    ok(/enable row level security/.test(sql) && (sql.match(/enable row level security/g) || []).length >= 8, "every sync table has row level security");
    ok(/security definer/.test(sql) && /function public\.redeem_invite/.test(sql), "redeem_invite is a security definer RPC");
    ok(/grant update \(name, home\) on public\.families/.test(sql) && !/grant update on public\.families/.test(sql), "clients can't change the plan column");
    ok(/'trip-photos', 'trip-photos', false/.test(sql), "photo bucket is private");
    ok(/function public\.ping\(\)/.test(sql) && /grant execute on function public\.ping\(\) to anon/.test(sql), "keep-alive ping is callable with the publishable key");
  }
  // codes
  ok(S.normCode("  maple compass 4821 ") === "MAPLE-COMPASS-4821", "codes tidy up spaces and case");
  ok(S.normCode("maple_compass4821") === "MAPLE-COMPASS-4821", "codes tidy up underscores and a missing dash");
  ok(S.isCode("Maple-Compass-4821") && !S.isCode("MAPLE-NOPE-4821") && !S.isCode("MAPLE-COMPASS-482") && !S.isCode(""), "code check");
  for (let i = 0; i < 300; i++) { const b = [0, 0, 0, 0].map(() => Math.floor(Math.random() * 256)); ok(S.isCode(S.makeCode(b)), "random code is valid: " + S.makeCode(b)); }
  ok(S.makeCode([0, 0, 0, 0]) === "ACORN-ACORN-1000" && S.makeCode([63, 63, 255, 255]) === "ZEPHYR-ZEPHYR-" + (1000 + 65535 % 9000), "code edges");
  ok(S.codeFromLink("https://darklighthousesolutions.com/travel-log/app/?join=wave-tide-1234#/") === "WAVE-TIDE-1234", "code from an invite link");
  ok(S.codeFromLink("wave tide 1234") === "WAVE-TIDE-1234" && S.codeFromLink("hello") === "", "bare codes work, junk doesn't");
  ok(S.inviteLink("https://x.test/travel-log/app/#/sync/invite", "wave tide 1234") === "https://x.test/travel-log/app/?join=WAVE-TIDE-1234", "invite link format");
  ok(S.familyTitle("Rivera") === "the Rivera family log" && S.familyTitle("The Rivera family") === "The Rivera family log" && S.familyTitle("The Riveras") === "The Riveras' log" && S.familyTitle("") === "your family's log", "family titles read naturally");
  // push plan from nothing
  const FID = "fam-1";
  const lily = M.newPerson({ name: "Lily", role: "kid", now: "2026-10-01T10:00:00.000Z" }), mom = M.newPerson({ name: "Mom", role: "adult", now: "2026-10-01T10:00:00.000Z" });
  M.toggleArea(lily, "state", "FL", true, "2026-06-14"); M.toggleArea(lily, "place", "SCT", true, "2026-07-10"); M.togglePark(lily, "zion", "visit", true); M.togglePark(lily, "zion", "jr", true);
  lily.updatedAt = "2026-10-02T10:00:00.000Z";
  const t1 = M.newTrip({ kidIds: [lily.id, mom.id], place: "Edinburgh", from: "Orlando", stops: ["London"], date: "2026-07-10", photoId: "photo_aaaa1111", now: "2026-10-02T11:00:00.000Z" });
  let local = { people: [lily, mom], trips: [t1], photoIds: ["photo_aaaa1111"] };
  let sh = S.emptyShadow(), plan = S.planPush(local, sh, FID, "2026-10-03T00:00:00Z");
  ok(plan.people.length === 2 && plan.trips.length === 1 && plan.visits.length === 3, "first push sends everyone, every trip and every colored place: " + plan.visits.length);
  ok(plan.uploads.length === 1 && plan.uploads[0].id === "photo_aaaa1111", "first push uploads the trip photo");
  ok(!("states" in plan.people[0].data) && plan.people[0].data.name === "Lily", "person rows carry the profile, not the map");
  const tr = plan.trips[0];
  ok(tr.traveler_ids.join() === [lily.id, mom.id].join() && tr.from_place === "Orlando" && tr.to_place === "Edinburgh" && tr.trip_date === "2026-07-10", "trip rows carry travelers, from and to");
  ok(plan.visits.some(v => v.kind === "park" && v.place_id === "zion" && v.jr), "Junior Ranger syncs with the park");
  S.afterPush(sh, plan); sh.photos.photo_aaaa1111 = "image/webp";   // sync.js records the upload
  ok(S.planPush(local, sh, FID).people.length === 0 && S.planPush(local, sh, FID).visits.length === 0 && S.planPush(local, sh, FID).trips.length === 0, "nothing to send after a clean push");
  // local edits -> only the change goes up
  M.toggleArea(lily, "state", "NC", true, "2026-08-01"); lily.updatedAt = "2026-10-04T09:00:00.000Z";
  M.toggleArea(lily, "state", "FL", false);  lily.updatedAt = "2026-10-04T09:01:00.000Z";
  plan = S.planPush(local, sh, FID, "2026-10-04T10:00:00Z");
  ok(plan.visits.length === 2 && plan.visits.some(v => v.place_id === "NC" && !v.deleted) && plan.visits.some(v => v.place_id === "FL" && v.deleted), "coloring and un-coloring send one row each (un-color is a soft delete)");
  ok(plan.people.length === 1, "the person's timestamp changed so their profile goes too");
  S.afterPush(sh, plan);
  // deleting a trip / person = tombstones
  local.trips = []; plan = S.planPush(local, sh, FID, "2026-10-05T00:00:00Z");
  ok(plan.trips.length === 1 && plan.trips[0].deleted && plan.photos.length === 1 && plan.photos[0].deleted && plan.removes.length === 1, "deleted trip sends a soft delete and removes its shared photo");
  S.afterPush(sh, plan); ok(!sh.trips[t1.id] && !sh.photos.photo_aaaa1111, "tombstones clear the shadow");
  local.trips = [t1]; S.afterPush(sh, S.planPush(local, sh, FID)); sh.photos.photo_aaaa1111 = "image/webp";
  // pull: a new trip from Grandma's phone, a new person, visits
  const nana = { family_id: FID, id: "person_nana0001", data: { name: "Nana", role: "grand", color: M.COLORS[4], createdAt: "2026-10-05T00:00:00.000Z" }, updated_at: "2026-10-05T12:00:00+00:00", deleted: false, server_at: "2026-10-05T12:00:01+00:00" };
  const gt = M.newTrip({ id: "trip_gatl0001", kidIds: [lily.id, "person_nana0001"], place: "Gatlinburg", stops: ["Asheville"], date: "2023-10-01", now: "2026-10-05T12:00:00.000Z" });
  let ch = S.applyPull(local, sh, {
    people: [nana],
    visits: [{ person_id: "person_nana0001", kind: "park", place_id: "great-smoky-mountains", at: "2023-10-01", jr: false, updated_at: "2026-10-05T12:00:00+00:00", deleted: false, server_at: "2026-10-05T12:00:02+00:00" },
             { person_id: lily.id, kind: "state", place_id: "TN", at: "2023-10-01", jr: false, updated_at: "2026-10-05T12:00:00+00:00", deleted: false, server_at: "2026-10-05T12:00:02+00:00" }],
    trips: [Object.assign(S.tripRow(gt, FID), { server_at: "2026-10-05T12:00:03+00:00", updated_by: "user-nana" })],
    photos: [{ id: "photo_gatl0001", path: FID + "/photo_gatl0001.webp", mime: "image/webp", deleted: false }]
  });
  ok(local.people.length === 3 && local.people.find(p => p.id === "person_nana0001").name === "Nana", "pulled a new person");
  ok(local.people.find(p => p.id === "person_nana0001").parks["great-smoky-mountains"], "pulled their park");
  ok(lily.states.TN && lily.states.NC && !lily.states.FL, "pulled a state onto Lily's map without losing her own edits");
  ok(local.trips.some(t => t.id === "trip_gatl0001" && t.kidIds.length === 2 && t.stops[0] === "Asheville") && ch.newTrips[0] === "trip_gatl0001", "pulled a shared trip with travelers and stops");
  ok(ch.downloads.length === 1 && ch.downloads[0].path.endsWith(".webp"), "missing shared photo is queued to download");
  ok(S.planPush(local, sh, FID).trips.length === 0 && S.planPush(local, sh, FID).people.length === 0, "pulled rows don't echo back up");
  ok(S.planPush(local, sh, FID).visits.length === 0, "pulled visits don't echo back up");
  {   // the cursor overlaps by 10s, so the same rows come back on the next pull: that must not count as a change (no redraw, no scroll jump)
    const again = S.applyPull(local, sh, { people: [nana], visits: [{ person_id: lily.id, kind: "state", place_id: "TN", at: "2023-10-01", jr: false, updated_at: "2026-10-05T12:00:00+00:00", deleted: false }],
      trips: [Object.assign(S.tripRow(gt, FID), { server_at: "2026-10-05T12:00:03+00:00" })] });
    ok(again.people === 0 && again.visits === 0 && again.trips === 0 && !Object.keys(again.touched).length, "re-pulling rows we already have changes nothing");
  }
  // conflicts: last write wins per record
  const gl = local.trips.find(t => t.id === "trip_gatl0001");
  gl.memory = "Matching hats (edited on this phone)"; gl.updatedAt = "2026-10-06T09:00:00.000Z";
  S.applyPull(local, sh, { trips: [Object.assign(S.tripRow(Object.assign({}, gt, { memory: "older remote edit" }), FID), { updated_at: "2026-10-06T08:00:00+00:00" })] });
  ok(local.trips.find(t => t.id === "trip_gatl0001").memory === "Matching hats (edited on this phone)", "newer local edit beats an older remote one");
  ok(S.planPush(local, sh, FID).trips.length === 1, "...and still gets pushed");
  S.applyPull(local, sh, { trips: [Object.assign(S.tripRow(Object.assign({}, gt, { memory: "newest remote edit" }), FID), { updated_at: "2026-10-06T10:00:00+00:00" })] });
  ok(local.trips.find(t => t.id === "trip_gatl0001").memory === "newest remote edit", "newer remote edit beats an older local one");
  ok(S.planPush(local, sh, FID).trips.length === 0, "...and the phone agrees with the cloud afterwards");
  // remote soft deletes
  S.applyPull(local, sh, { trips: [{ id: "trip_gatl0001", deleted: true, updated_at: "2026-10-07T00:00:00Z" }] });
  ok(!local.trips.some(t => t.id === "trip_gatl0001"), "a trip deleted on another phone goes away here");
  S.applyPull(local, sh, { visits: [{ person_id: lily.id, kind: "state", place_id: "TN", deleted: true, updated_at: "2026-10-07T00:00:00Z" }] });
  ok(!lily.states.TN && lily.states.NC, "a state un-colored on another phone is un-colored here, others stay");
  // a local un-synced color beats an older remote delete
  M.toggleArea(lily, "state", "GA", true, "2026-10-08"); lily.updatedAt = "2026-10-08T00:00:00.000Z";
  S.applyPull(local, sh, { visits: [{ person_id: lily.id, kind: "state", place_id: "GA", deleted: true, updated_at: "2026-10-07T00:00:00Z" }] });
  ok(lily.states.GA, "newer local color survives an older remote un-color");
  S.applyPull(local, sh, { people: [{ id: "person_nana0001", deleted: true, updated_at: "2026-10-09T00:00:00Z" }] });
  ok(!local.people.some(p => p.id === "person_nana0001") && !Object.keys(sh.visits).some(k => k.startsWith("person_nana0001|")), "a person removed elsewhere is removed here with their map");
  // cursor
  ok(S.nextCursor("", [{ server_at: "2026-10-05T12:00:03+00:00" }, { server_at: "2026-10-05T12:00:01+00:00" }], 10000) === "2026-10-05T11:59:53.000Z", "pull cursor = newest row minus a 10 second overlap");
  ok(S.nextCursor("2026-10-05T12:00:00.000Z", [], 0) === "2026-10-05T12:00:00.000Z" && S.nextCursor("", []) === "", "cursor holds when nothing new");
  // joining a family that already has data
  const famPeople = [{ id: "person_fam00001", name: "Lily" }, { id: "person_fam00002", name: "Dad" }];
  const l2 = M.newPerson({ name: "lily " }), l3 = M.newPerson({ name: "Sam" });
  l2.states.UT = { at: "2026-01-01" };
  const tripJ = M.newTrip({ kidIds: [l2.id, l3.id], place: "Zion" });
  const loc2 = { people: [l2, l3], trips: [tripJ] }, map2 = S.matchPeople(loc2.people, famPeople);
  ok(map2[l2.id] === "person_fam00001" && !map2[l3.id], "same name (any case/spacing) is matched to the family's person");
  S.remapPeople(loc2, map2);
  ok(l2.id === "person_fam00001" && tripJ.kidIds[0] === "person_fam00001" && tripJ.kidIds[1] === l3.id, "matched person takes the family's id, trips follow");
  ok(Date.parse(l2.updatedAt) < Date.parse("2000-01-01"), "a person matched to the family keeps the family's name and color (local profile marked oldest)");
  const pp = S.planPush({ people: [l2], trips: [], photoIds: [] }, S.emptyShadow(), FID, "2026-10-23T00:00:00Z");
  ok(pp.visits.some(v => v.place_id === "UT"), "...but their map colors still go up");
  const dupA = M.newPerson({ name: "Mo" }), dupB = M.newPerson({ name: "Mo" }); dupA.states.FL = { at: "" }; dupB.states.GA = { at: "" }; dupB.parks.zion = { at: "", jr: true };
  const tripD = M.newTrip({ kidIds: [dupA.id, dupB.id], place: "Beach" });
  const loc3 = { people: [dupA, dupB], trips: [tripD] }; S.remapPeople(loc3, { [dupB.id]: dupA.id });
  ok(loc3.people.length === 1 && dupA.states.FL && dupA.states.GA && dupA.parks.zion.jr && tripD.kidIds.length === 1, "merging two of the same person adds their maps together and de-dupes trips");
  // flexible JSONB: fields this version doesn't know about (from the Trips worker or later versions) still sync
  {
    const pa = M.newPerson({ name: "Pat", role: "adult", now: "2026-10-10T00:00:00.000Z" }); pa.badges = ["first-flight"]; pa.favorites = { pub: "The Sheep Heid Inn", pint: "Tennent's" };
    const ta = M.newTrip({ kidIds: [pa.id], place: "Edinburgh", date: "2026-07-10", now: "2026-10-10T00:00:00.000Z" });
    ta.stops2 = [{ place: "London", nights: 2, stayedAt: "Hotel" }]; ta.legs = [{ mode: "plane", miles: 4100, from: "MCO", to: "LHR" }];
    const pushA = S.planPush({ people: [pa], trips: [ta], photoIds: [] }, S.emptyShadow(), FID, "2026-10-10T01:00:00Z");
    ok(pushA.people[0].data.badges[0] === "first-flight" && pushA.people[0].data.favorites.pub === "The Sheep Heid Inn" && !("states" in pushA.people[0].data), "new person fields go into the data blob");
    ok(pushA.trips[0].data.legs[0].miles === 4100 && pushA.trips[0].data.stops2[0].nights === 2, "new trip fields go into the data blob");
    const other = { people: [], trips: [], photoIds: [] }, shB = S.emptyShadow();
    S.applyPull(other, shB, { people: pushA.people, trips: pushA.trips });
    ok(other.people[0].favorites.pint === "Tennent's" && other.people[0].badges.length === 1, "unknown person fields arrive on the other phone");
    ok(other.trips[0].legs[0].to === "LHR" && other.trips[0].stops2[0].stayedAt === "Hotel", "unknown trip fields arrive on the other phone");
    ok(S.planPush(other, shB, FID).people.length === 0 && S.planPush(other, shB, FID).trips.length === 0, "...without echoing back");
  }
  // plan / entitlement
  ok(S.access(null, { testing: true }).unlocked && S.access(null, { testing: true }).tier === "testing", "family testing flag unlocks everything");
  const now = "2026-10-23T12:00:00Z";
  ok(S.access({ plan: "free", trial_ends_at: "2026-11-01T00:00:00Z" }, {}, now).tier === "trial" && /9 days left/.test(S.access({ plan: "free", trial_ends_at: "2026-11-01T00:00:00Z" }, {}, now).label), "trial shows days left");
  ok(S.access({ plan: "keeper", keeper_until: "2027-10-23T00:00:00Z", trial_ends_at: "2026-01-01T00:00:00Z" }, {}, now).tier === "keeper", "Family Keeper unlocks");
  ok(S.access({ plan: "keeper", keeper_until: "2026-10-01T00:00:00Z", trial_ends_at: "2026-01-01T00:00:00Z" }, {}, now).tier === "free", "lapsed Family Keeper falls back to free");
  const free = S.access({ plan: "free", trial_ends_at: "2026-01-01T00:00:00Z" }, {}, now);
  ok(!S.allows(free, "photos") && S.allows(free, "members", 1) && !S.allows(free, "members", 2), "free plan: no photo sync, 2 members");
  // fun + feed
  ok(S.joinLine("Grandma", "u1") === S.joinLine("Grandma", "u1") && /Grandma/.test(S.joinLine("Grandma", "u1")), "join cheer is stable and names the person");
  ok(S.newMembers([{ user_id: "me" }, { user_id: "a" }, { user_id: "b" }], { a: 1 }, "me").map(m => m.user_id).join() === "b", "only brand-new members get cheered");
  ok(S.ago("2026-10-23T11:59:30Z", now) === "just now" && S.ago("2026-10-23T11:00:00Z", now) === "1 hour ago" && S.ago("2026-10-22T10:00:00Z", now) === "yesterday" && S.ago("2026-10-19T12:00:00Z", now) === "4 days ago", "friendly times");
  const fd = S.feed([{ id: "a", createdAt: "2026-10-01T00:00:00Z", kidIds: [] }, { id: "b", createdAt: "2026-10-05T00:00:00Z", kidIds: [] }], { b: "Nana" }, 5);
  ok(fd[0].trip.id === "b" && fd[0].by === "Nana" && fd[1].by === "", "feed is newest first with who added it");
  ok(S.thumbDims(4032, 3024).w === 1024 && S.thumbDims(3024, 4032).h === 1024 && S.thumbDims(800, 600).w === 800, "shared photo copies are 1024px on the long edge, never upscaled");
  // wiring + privacy
  ok(/<script src="sync-core\.js"><\/script>\s*<script src="sync-config\.js"><\/script>\s*<script src="stamp-who-core\.js"><\/script>\s*<script src="trips-ui\.js"><\/script>\s*<script src="stamp-who\.js"><\/script>\s*<script src="ranger-badge\.js"><\/script>\s*<script src="spots-data\.js"><\/script>\s*<script src="spots\.js"><\/script>\s*<script src="logo\.js"><\/script>\s*<script src="app\.js"><\/script>\s*<script src="sync\.js"><\/script>/.test(html), "sync scripts load around app.js in order");
  ok(/"stamp-who-core\.js", "stamp-who\.js"/.test(fs.readFileSync(path.join(APP, "sw.js"), "utf8")) || (BUNDLE.list().indexOf("stamp-who-core.js") >= 0 && BUNDLE.list().indexOf("stamp-who.js") > BUNDLE.list().indexOf("stamp-who-core.js") && /"app-bundle\.js"/.test(fs.readFileSync(path.join(APP, "sw.js"), "utf8"))), "the who-picker files are cached for offline");
  { // "Who's been there?": who's ticked to start, shared visits, no duplicates, undo
    const W = require(path.join(APP, "stamp-who-core.js"));
    const pa = M.newPerson({ name: "Zz A", role: "adult" }), pb = M.newPerson({ name: "Zz B", role: "adult" }), pk = M.newPerson({ name: "Zz K", role: "kid" }), ppl = [pa, pb, pk];
    ok(JSON.stringify(W.startWith(ppl, {}, { mode: "add", synced: true, me: pb.id, page: pa.id })) === JSON.stringify([pb.id]), "synced: the signed-in person starts ticked, not the page's");
    ok(W.startWith(ppl, {}, { mode: "add", synced: true, me: null, page: pa.id }).length === 0, "synced but not linked: nobody, we ask");
    ok(JSON.stringify(W.startWith(ppl, {}, { mode: "add", synced: false, page: pa.id })) === JSON.stringify([pa.id]), "no sync: the page's person");
    const r1 = W.apply(ppl, [], "park", "zion", [pa.id, pk.id], { date: "2026-05-02" });
    ok(r1.added.length === 2 && pa.parks.zion && pk.parks.zion && !pb.parks.zion, "stamps only the people ticked");
    ok(pa.stamps.length === 1 && pa.stamps[0].with.length === 2 && pk.stamps[0].date === "2026-05-02", "a shared visit: same date, with each other");
    W.apply(ppl, [], "park", "zion", [pa.id, pk.id], { date: "2026-05-02" });
    ok(pa.stamps.length === 1, "no duplicate stamps");
    const r2 = W.apply(ppl, [], "park", "zion", [pa.id], { date: "2026-05-02", visitDate: "2026-05-02" });
    ok(!pk.parks.zion && r2.removed.length === 1 && !(pa.stamps[0].with || []).length, "unticking takes it off, and the visit isn't shared any more");
    W.restore(ppl, r2.undo);
    ok(ppl.find(p => p.id === pk.id).parks.zion, "undo puts it back");
  }
  ok(/connect-src 'self' https:\/\/ercowufdbmvqagshduxh\.supabase\.co/.test(html), "CSP allows only the family database");
  ok(!/service_role|sb_secret_/.test(scfg + ssrc + score), "no secret keys in the app");
  ok(/key: "sb_publishable_[A-Za-z0-9_-]+"/.test(scfg), "sync uses the publishable key");
  ok(/showEntry: false/.test(scfg) || /showEntry: true/.test(scfg), "sync entry has an on/off flag");
  ok(/testing: true/.test(scfg), "family testing unlocks everything for now");
  ok(/loadScript\("vendor\/supabase\.js"\)/.test(ssrc) && !/<script src="vendor/.test(html), "Supabase's library is only loaded once sync is used");
  ok(fs.existsSync(path.join(APP, "vendor", "supabase.js")) && fs.existsSync(path.join(APP, "vendor", "qrcode.js")), "vendored libraries are here (no CDN)");
  ok(/MIT/.test(read("vendor/supabase.js").slice(0, 300)) && /MIT/.test(read("vendor/qrcode.js").slice(0, 600)), "vendored libraries keep their licenses");
  ok(/navigator\.share/.test(ssrc) && /clipboard/.test(ssrc), "Share invite with a copy fallback");
  ok(/function qrSVG/.test(ssrc) && !/api\.qrserver|chart\.googleapis|quickchart/.test(ssrc), "QR code is drawn on the phone");
  ok(/You\\'re joining /.test(ssrc), "friendly join screen");
  ok(/leave_family/.test(ssrc) && /delete_my_account/.test(ssrc) && /Delete my cloud account/.test(ssrc), "leave family and delete my cloud data");
  ok(/prefers-reduced-motion/.test(ssrc) && /prefers-reduced-motion/.test(scss), "confetti and spinners respect reduced motion");
  ok(/unless you turn on Family Sync/.test(html) && !/No accounts, no ads/.test(html), "footer describes sync honestly");
  ok(/Supabase, in the US/.test(ssrc) && /Full-size photos never leave/.test(ssrc), "in-app privacy note explains what's shared");
  ok(/window\.MLTL_onChange/.test(js) && /window\.MLTL_SYNC\.route\(h\)/.test(js), "app tells sync about saves and lets it add screens");
  ["sync-core.js", "sync-config.js", "sync.js", "sync.css"].forEach(f => ok(list.includes(f), "sw caches " + f));
}

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
    else if (/\.(html|xml|txt)$/.test(e.name) && /travel-log\/app/.test(fs.readFileSync(p, "utf8").replace(/<script src="\/travel-log\/app\/brand\.js"><\/script>/g, ""))) linked.push(path.relative(path.join(__dirname, ".."), p));
  }
})(path.join(__dirname, ".."));
ok(linked.length === 0, "no site page links to the app yet: " + linked.join(", "));


// ---- v1.4: several family logs on one phone ----
{
  const S = require("../travel-log/app/sync-core.js");
  const mem = { v: {}, getItem(k) { return k in this.v ? this.v[k] : null; }, setItem(k, x) { this.v[k] = String(x); } };
  let r = S.readLogs(mem);
  ok(r.active === "mltl" && r.logs.length === 1 && r.logs[0].db === "mltl", "no list yet: just the phone's original log, open");
  ok(S.logLabel(r.logs[0]) === "This phone only", "an unshared original log is labeled This phone only");
  mem.setItem(S.LOGS_KEY, "{not json"); ok(S.readLogs(mem).logs.length === 1, "a broken list falls back to the original log");
  mem.setItem(S.LOGS_KEY, JSON.stringify({ active: "mltl-evil/../x", logs: [{ db: "other" }, { db: "mltl-abcd1234", name: "<b>Rivera</b>", familyId: "f1" }] }));
  r = S.readLogs(mem);
  ok(r.active === "mltl" && r.logs.map(l => l.db).join() === "mltl,mltl-abcd1234", "odd database names are dropped and the original log is always kept");
  S.updateLog(r, "mltl", { familyId: "f0", name: "Rivera Family", myPerson: "person_aaaa1111" });
  const n2 = S.addLog(r, "Grandma & Grandpa's", () => "zz99yy88");
  ok(n2 === "mltl-zz99yy88" && S.findLog(r, n2).familyId === null, "a new log gets its own database name and starts unlinked");
  ok(S.linkedCount(r) === 2 && S.logForFamily(r, "f1").db === "mltl-abcd1234", "count linked families; find a family's log");
  const n3 = S.addLog(r, "", () => "zz99yy88");
  ok(n3 !== n2 && /^mltl-[a-z0-9]{4,24}$/.test(n3), "a clashing random name gets a fresh one");
  S.updateLog(r, n2, { familyId: "f2", name: "Grandma & Grandpa's", myPerson: "person_gma11111" });
  ok(S.copyTargets(r, "mltl").map(l => l.db).join() === n2, "only other linked logs where I picked myself can take a copy");
  r.active = n2; S.writeLogs(mem, r); ok(S.readLogs(mem).active === n2, "the open log is remembered");
  ok(S.removeLog(r, n2) && r.active === "mltl" && !S.findLog(r, n2), "removing the open log falls back to the original");
  ok(!S.removeLog(r, "mltl") && S.findLog(r, "mltl"), "the original log can't be removed");
  ok(S.MAX_FAMILIES === 3, "up to 3 families, same as the server");
  const trip = { id: "trip_src12345", kidIds: ["person_aaaa1111", "person_kid22222"], place: "Yellowstone", date: "2026-07-04", mark: { kind: "park", id: "yell" }, memory: "Old Faithful!", stops: [{ place: "Cody" }], photoId: "photo_x1234", createdAt: "2026-07-05T00:00:00Z", updatedAt: "2026-07-05T00:00:00Z" };
  const cp = S.copyTrip(trip, "person_gma11111", { familyName: "Rivera Family", familyId: "f0" }, "trip_new12345", "2026-10-23T16:00:00.000Z");
  ok(cp.id === "trip_new12345" && cp.kidIds.join() === "person_gma11111" && cp.place === "Yellowstone" && cp.stops[0].place === "Cody" && cp.memory === "Old Faithful!", "a copied trip keeps the details (new fields too) with just me on it");
  ok(cp.copiedFrom.familyName === "Rivera Family" && cp.copiedFrom.tripId === "trip_src12345" && cp.createdAt === "2026-10-23T16:00:00.000Z", "and notes where it came from");
  ok(trip.kidIds.length === 2 && !trip.copiedFrom, "the original trip is untouched");
  const row = S.tripRow(cp, "f2"); ok(row.data.copiedFrom.tripId === "trip_src12345" && row.id !== trip.id, "the copy syncs as its own record in the other family");
  ok(S.slug("Grandma & Grandpa's") === "grandma-grandpa-s", "backup file tag");
  const app = fs.readFileSync(path.join(APP, "app.js"), "utf8"), sj = fs.readFileSync(path.join(APP, "sync.js"), "utf8");
  ok(/readLogs\(localStorage\)\.active/.test(app) && /var DB_NAME = "mltl"/.test(app), "the app opens the chosen log, and the original one by default");
  ok(/famstamp-backup-" \+ \(\(window\.MLTL_SYNC/.test(app), "each log's backup file is named for its family");
  ok(/signInWithOAuth\(opts\)/.test(sj) && /linkIdentity\(opts\)/.test(sj) && /flowType: "pkce"/.test(sj) && /redirectTo: location\.origin \+ location\.pathname/.test(sj), "Google: link for anonymous members, sign in otherwise, back to the app's own URL");
  const cfgSrc = fs.readFileSync(path.join(APP, "sync-config.js"), "utf8");
  ok(/google: true/.test(cfgSrc) && /email: false/.test(cfgSrc), "Google sign-in on, email codes off until SMTP");
}

// ---------- v1.4: trips, miles, stories, passport, State Signs ----------
{
  const T = require("../travel-log/app/trips-core.js"), P = require("../travel-log/app/passport-core.js"), L = require("../travel-log/app/log-core.js");
  const pt = (name, lat, lon, country, region, mode) => ({ name, lat, lon, country, region, mode, kind: "city" });
  const rv = { id: "t1", kidIds: ["a", "b"], date: "2026-04-03", endDate: "2026-04-10", place: "Asheville",
    route: [pt("Orlando", 28.54, -81.38, "USA", "FL"), pt("Savannah", 32.08, -81.09, "USA", "GA", "car"), pt("Asheville", 35.6, -82.55, "USA", "NC", "car")],
    favs: [{ cat: "pub", name: "The Wee Pub" }, { cat: "drink", name: "Hazy IPA" }, { cat: "restaurant", name: "Crab Shack" }] };
  const people = [{ id: "a", name: "Rosie", role: "kid" }, { id: "b", name: "Jen", role: "adult" }];
  const lhrJfk = T.gcMiles({ lat: 51.47, lon: -0.45 }, { lat: 40.64, lon: -73.78 });
  ok(Math.abs(lhrJfk - 3443) < 15, "great-circle LHR-JFK is about 3,443 mi: " + Math.round(lhrJfk));
  const sm = T.summary(rv);
  ok(sm.legs.length === 2 && sm.legs.every(l => l.how === "about"), "ground legs are labelled 'about'");
  ok(Math.abs(sm.legs[0].miles - 1.2 * T.gcMiles(rv.route[0], rv.route[1])) < 0.01, "car leg = great-circle x 1.2");
  ok(sm.miles === 603 && sm.roadMiles === 603 && sm.nights === 7, "trip total 603 mi road, 7 nights");
  ok(sm.states.join() === "GA,NC" && sm.countries.join() === "USA", "seen: states GA, NC; country USA (start point not counted)");
  const fly = Object.assign({}, rv, { route: [pt("Orlando", 28.43, -81.31, "USA", "FL"), pt("Edinburgh", 55.95, -3.37, "GBR", "SCT", "plane")] });
  ok(T.summary(fly).legs[0].how === "flight" && T.summary(fly).flights === 1, "plane legs are flights (great circle)");
  ok(T.cleanPoint({ name: "X", nights: null, mode: "car" }).nights === undefined, "nights: null stays empty, not 0");
  ok(T.cleanPoint({ name: "X", nights: "" }).nights === undefined && T.cleanPoint({ name: "X", nights: true }).nights === undefined, "blank/boolean nights ignored");
  ok(T.fmtDist(1609.344 / 1000 * 10 / 1.609344, "km").indexOf("km") >= 0, "km formatting");
  // stories
  const s1 = T.makeStory(rv, { travelers: people }, { style: "storybook" }), s2 = T.makeStory(rv, { travelers: people }, { style: "storybook" }), s3 = T.makeStory(rv, { travelers: people }, { style: "storybook", seed: 3 });
  ok(s1.text === s2.text, "story is deterministic for the same trip and seed");
  ok(s1.text !== s3.text, "Shuffle (new seed) changes the story");
  ok(!/Wee Pub|Hazy IPA/.test(s1.text), "storybook never mentions adult picks");
  const rich = Object.assign({}, rv, { memory: "Rosie found a shark tooth on the beach", moments: { a: "the ghost tour", b: "sunrise on the porch" },
    stays: [{ name: "Oak Cabin", type: "rental", nights: 4, rating: 5, where: "Asheville" }, { name: "River Camp", type: "camp", nights: 3, where: "Savannah" }],
    favs: rv.favs.concat([{ cat: "activity", name: "Tubing on the river" }, { cat: "treat", name: "Peach ice cream" }]),
    route: rv.route.map((p, i) => Object.assign({}, p, i ? { nights: i === 1 ? 3 : 4 } : {})) });
  const wc = T.wordCount(T.makeStory(rich, { travelers: people }, { style: "storybook" }).text), wj = T.wordCount(T.makeStory(rich, { travelers: people }, { style: "journal" }).text);
  ok(wc >= 150 && wc <= 400 && wj >= 150 && wj <= 400, "a filled-in trip gives a 150-400 word story: " + wc + "/" + wj);
  ok(T.wordCount(s1.text) <= 400, "a sparse trip gives a short story, never padded past 400");
  const bare = T.makeStory({ id: "x", kidIds: [], place: "Somewhere" }, {}, { style: "journal" });
  ok(typeof bare.text === "string" && bare.text.length > 40 && !/undefined|null|NaN/.test(bare.text), "story copes with missing fields");
  ok(T.splitSentences("One. Two! Three?").length === 3, "sentence split for read-aloud highlight");
  ok(!T.showAdult(rv, people, people[0], false) && T.showAdult(rv, people, people[0], true) && T.showAdult(rv, people, people[1], false), "adult picks hidden on kid views unless toggled");
  // lifetime: no double counting across people
  const lf = T.lifetime(null, [rv, rv]), la = T.lifetime("a", [rv]);
  ok(la.miles === 603, "lifetime miles for a person");
  ok(typeof lf === "object", "family lifetime computes");
  // passport
  const again = Object.assign({}, rv, { id: "t2", date: "2026-08-01", endDate: "2026-08-03" });
  const ps = P.stampsFor(people[0], [rv, again], {});
  ok(ps.filter(x => x.area === "GA").length === 2, "repeat visit adds a new stamp");
  ok(ps.every(x => /^t-t[12]-state-/.test(x.id) && x.source === "trip"), "trip stamps are derived with stable ids");
  ok(P.familyStamps(people, [rv], {}).length === 2 && P.familyStamps(people, [rv], {})[0].who.length === 2, "family passport: one stamp per trip area, with who was there");
  ok(P.cleanStamps(Array.from({ length: 99 }, (_, i) => P.newStamp ? P.newStamp({ kind: "place", area: "FRA", date: "2026-01-0" + (i % 9 + 1) }) : null).filter(Boolean)).length <= P.MAX_STAMPS, "hand stamps capped at MAX_STAMPS");
  // sync size limits: 16 KB per trip row, 8 KB per person row
  { const X = n => "x".repeat(n), ap = { code: "EDI", name: X(60), lat: 55.9, lon: -3.3 }, pid = c => "person_" + c.repeat(16);
    const big = L.newTrip({ kidIds: ["a", "b", "c", "d"].map(pid), place: X(80), date: "2026-01-01", endDate: "2026-02-01", who: X(200), memory: X(900), title: X(80),
      route: Array.from({ length: 12 }, () => ({ name: X(80), kind: "city", lat: 10.1, lon: 20.4, country: "GBR", region: "SCT", sub: X(80), near: X(60), nights: 3, mode: "plane", miles: 1234.5, dep: ap, arr: ap, ref: X(40) })),
      stays: Array.from({ length: 8 }, () => ({ name: X(80), type: "hotel", nights: 3, rating: 5, note: X(300), where: X(80) })),
      favs: Array.from({ length: 12 }, () => ({ cat: "restaurant", name: X(80), note: X(200), where: X(80) })),
      moments: Object.fromEntries(["a", "b", "c", "d"].map(c => [pid(c), X(300)])), story: { text: X(3000), style: "journal", seed: 5, at: "2026-01-01T00:00:00Z" } });
    const n = Buffer.byteLength(JSON.stringify(big));
    ok(n <= 16384 && n <= T.TRIP_BUDGET, "a maxed-out trip still fits the 16 KB sync row: " + n);
    ok(big.route.length === 12 && big.stays.length === 8 && big.favs.length === 12 && big.route.every(p => p.lat != null), "trimming keeps every stop, stay and favorite");
    const small = L.newTrip({ kidIds: [pid("a")], place: "Paris", date: "2026-01-01", memory: "Crepes " + X(500) });
    ok(small.memory.length > 500, "small trips are never trimmed");
    const st = P.cleanStamps(Array.from({ length: 70 }, (_, i) => ({ kind: "place", area: "FRA", date: "2026-01-0" + (i % 9 + 1), end: "2026-02-01", via: X(40), note: X(140) })));
    ok(st.length === 60 && JSON.stringify(st).length <= 6000, "60 stamps with notes fit a person's 8 KB row: " + JSON.stringify(st).length);
  }
  // State Signs
  const sg = P.signsFor(people, [rv], {});
  ok(Object.keys(sg).join() === "GA,NC" && sg.GA.first === "2026-04-03" && sg.GA.who.length === 2, "signs fill in from US trip stops");
  ok(P.signCount(Object.assign({ DC: { id: "DC" } }, sg)).have === 2 && P.signCount({ DC: { id: "DC" } }).dc === true, "DC is a bonus, not counted in 50");
  ok(P.STATES50.length === 50 && P.STATES50.indexOf("DC") < 0, "50 states, no DC");
  const on = P.signSVG("GA", "Georgia", sg.GA), off = P.signSVG("GA", "Georgia", null);
  ok(/WELCOME TO/.test(on) && /GEORGIA/i.test(on) && /FIRST VISIT/.test(on), "collected sign shows name and first visit");
  ok(/NOT YET/.test(off) && off !== on, "uncollected sign is the faded version");
  // v1.5 fancier State Signs: every state + DC has its own original design, tiers by visit count, readable panels
  {
    const SG = require("../travel-log/app/state-signs.js"), all = P.STATES50.concat(["DC"]);
    ok(all.every(id => SG.look(id)) && Object.keys(SG.TABLE).length === 51, "all 50 states + DC have a sign design");
    ok(new Set(all.map(id => SG.look(id).motif)).size === 51, "every sign has its own motif");
    ok(all.every(id => SG.MOTIFS[SG.look(id).motif] && SG.SHAPES[SG.look(id).shape]), "every motif and shape exists");
    ok(all.every(id => SG.contrast(SG.look(id).panel, SG.look(id).text) >= 4.5), "name panel text passes WCAG AA contrast on every sign");
    ok(SG.contrast(SG.MYSTERY.panel, SG.MYSTERY.text) >= 4.5, "mystery (not yet visited) text passes AA contrast");
    const svgs = all.map(id => P.signSVG(id, id, { first: "2024-07-03", visits: 2 })), off51 = all.map(id => P.signSVG(id, id, null));
    ok(svgs.every(x => /^<svg[^>]+viewBox="0 0 200 168"[^>]+role="img" aria-label="Welcome to [^"]+Collected, silver: first visit 3 JUL 2024, 2 visits"/.test(x)), "collected signs have full alt text");
    ok(off51.every(x => /class="signsvg faded/.test(x) && /not collected yet"/.test(x) && /NOT YET VISITED/.test(x) && !/FIRST VISIT/.test(x)), "unvisited signs are mystery signs");
    ok(svgs.every(x => (x.match(/id="(sg[A-Z]{2}\d+)c"/) || [])[1]) && new Set(svgs.map(x => x.match(/id="(sg[A-Z]{2}\d+)c"/)[1])).size === 51, "each sign's SVG ids are unique on the page");
    ok(svgs.every(x => x.length < 9000) && off51.every(x => x.length < 7000), "signs stay small: biggest " + Math.max(...svgs.map(x => x.length)) + " bytes");
    ok(SG.tier(1) === "bronze" && SG.tier(2) === "silver" && SG.tier(3) === "silver" && SG.tier(4) === "gold" && SG.tier(9) === "gold", "frames: bronze 1, silver 2-3, gold 4+");
    ok(/s-gold/.test(P.signSVG("FL", "Florida", { first: "2024", visits: 5 })) && /5<\/text>/.test(P.signSVG("FL", "Florida", { first: "2024", visits: 5 })), "the plate shows the visit count");
    ok(/WASHINGTON, D\.C\./.test(P.signSVG("DC", "District of Columbia", { first: "2024", visits: 1 })), "DC sign says Washington, D.C.");
    ok(/textLength/.test(P.signSVG("NC", "North Carolina", { visits: 1 })) || /font-size="1[0-6]/.test(P.signSVG("NC", "North Carolina", { visits: 1 })), "long names shrink to fit");
    ok(!/<script|on\w+=/i.test(P.signSVG("GA", "<script>x</script>", { first: "2024", visits: 1 })), "names are escaped");
    // visits: one per trip (a trip together counts once), plus hand stamps; first date wins
    const kid = { id: "kid_a", stamps: [{ id: "s1", kind: "state", area: "GA", date: "2020-05" }] }, kid2 = { id: "kid_b" };
    const t1 = Object.assign({}, rv, { id: "tv1", kidIds: ["kid_a", "kid_b"] }), t2 = Object.assign({}, rv, { id: "tv2", date: "2026-08-01", endDate: "2026-08-03", kidIds: ["kid_a"] });
    const vs = P.signsFor([kid, kid2], [t1, t2], {});
    ok(vs.GA.visits === 3 && vs.GA.first === "2020-05" && vs.GA.list[0].source === "hand", "visits: hand stamp + 2 trips = 3, earliest first (" + (vs.GA && vs.GA.visits) + ")");
    ok(vs.GA.list.filter(v => v.tripId === "tv1")[0].who.length === 2, "a trip together is one visit with both people");
    ok(P.signTier(vs.GA) === "silver" && P.signTier(null) === "", "tier from visits");
    ok(P.signsFor([{ id: "kid_c", states: { TX: true } }], [], {}).TX.visits === 1, "a state colored on the map is 1 visit");
  }
  // backup v4 round trip, v3 still restores
  const ka = L.newKid({ name: "Rosie", role: "kid" }), kb = L.newKid({ name: "Jen", role: "adult" });
  const b4 = L.makeBackup([ka, kb], [Object.assign({ copiedFrom: { familyName: "Riveras" } }, rv, { id: "trip_abc12345", kidIds: [ka.id, kb.id] })], [], null, { home: "Orlando", units: "km" });
  ok(b4.version === 4, "backup is v4");
  const r4 = L.readBackup(JSON.parse(JSON.stringify(b4)));
  ok(r4 && r4.trips.length === 1 && r4.trips[0].route.length === 3 && r4.trips[0].favs.length === 3, "v4 backup keeps route and favorites");
  ok(r4.trips[0].copiedFrom && r4.trips[0].copiedFrom.familyName === "Riveras", "unknown trip fields (copiedFrom) survive backup");
  const r3 = L.readBackup({ app: "my-lifetime-travel-log", version: 3, kids: [Object.assign(L.newKid({ name: "Lily" }), { id: "person_k1234567" })], trips: [{ id: "trip_old12345", kidIds: ["person_k1234567"], place: "Paris", date: "2020-01-01" }], photos: [], settings: { home: "Orlando" } });
  ok(r3 && r3.trips.length === 1 && r3.kids.length === 1, "v3 backups still restore");
}

// ---- v1.5 stamp art: unique country stamps, state bird / flower / animal, never a "?" for a missing date ----
{
  const SA = require("../travel-log/app/stamp-art.js"), SYM = require("../travel-log/app/state-symbols.js"), P = require("../travel-log/app/passport-core.js");
  const SG = require("../travel-log/app/state-signs.js");
  const ids51 = P.STATES50.concat(["DC"]);
  ok(Object.keys(SYM.DATA).length === 51 && ids51.every(id => SYM.DATA[id]), "state symbols for all 50 states + DC");
  ok(/wikipedia\.org\/wiki\/List_of_U\.S\._state_birds/.test(read("state-symbols.js")) && /List_of_U\.S\._state_and_territory_flowers/.test(read("state-symbols.js")), "symbol data file names its sources");
  ids51.forEach(id => {
    const d = SYM.DATA[id];
    ok(["bird", "flower", "animal"].every(k => d[k] && d[k].name && SA.GLYPHS[d[k].glyph]), id + " has a bird, flower and animal with a drawing");
    if (d.animal.fallback) ok(d.animal.name === d.bird.name && /no official/i.test(d.note), id + " with no animal falls back to its bird, with a note");
  });
  ok(["IN", "IA", "MN"].every(id => SYM.DATA[id].animal.fallback), "IN, IA and MN fall back to the bird");
  ok(SYM.DATA.CA.bird.name === "California quail" && SYM.DATA.TX.flower.name === "Bluebonnet" && SYM.DATA.FL.bird.name === "Mockingbird", "spot-check symbol data");
  // every country gets a stamp; deterministic; UK nations differ
  const countries = MAPS.world.shapes.filter(x => !x.other).map(x => x.id);
  let bad = [];
  countries.forEach(c => { const svg = SA.stampSVG({ kind: "place", area: c, id: "stamp_x1" }, { name: c, date: "3 APR 2024" }, {}); if (!/^<svg[^]*<\/svg>$/.test(svg) || !/class="motif"/.test(svg) || svg.length > 9000) bad.push(c); });
  ok(countries.length > 190 && bad.length === 0, "every country (" + countries.length + ") gets a stamp with a motif, under 9 KB: " + bad.join(","));
  const one = (k, a, art) => SA.stampSVG({ kind: k, area: a, id: "stamp_aaaa11" }, { name: a, date: "" }, { art });
  ok(one("place", "FRA") === one("place", "FRA") && one("state", "TX", "bird") === one("state", "TX", "bird"), "stamps render the same every time");
  ok(SA.design("place", "JPN").shape === SA.design("place", "JPN").shape && JSON.stringify(SA.design("state", "OH", "", "bird")) === JSON.stringify(SA.design("state", "OH", "", "bird")), "design is seeded from the place");
  const uk = ["ENG", "SCT", "WLS", "NIR"].map(c => SA.design("place", c));
  ["shape", "motif", "ink", "border"].forEach(f => ok(new Set(uk.map(d => d[f])).size === 4, "UK nations all differ in " + f));
  const looks = countries.map(c => { const d = SA.design("place", c); return [d.shape, d.border, d.ink, d.motif, d.font, d.label].join("|"); });
  ok(new Set(looks).size >= countries.length * 0.97, "country stamps are (nearly all) one of a kind: " + new Set(looks).size + "/" + countries.length);
  ok(Object.keys(SA.COUNTRY).length >= 40, "40+ hand-tuned countries");
  ok(new Set(countries.map(c => SA.design("place", c).shape)).size === SA.SHAPES.length && SA.SHAPES.length >= 10, "all 10 shapes are used");
  ok(new Set(countries.map(c => SA.design("place", c).border)).size === 5, "all 5 border styles are used");
  ok(["red", "blue", "green", "violet", "black", "brown"].every(k => SA.INKS[k]), "curated inks: red, blue, green, violet, black, brown");
  // state modes and shared symbols
  ["bird", "flower", "animal"].forEach(m => ok(new RegExp(SYM.DATA.OH[m].name.toUpperCase()).test(one("state", "OH", m)), "OH stamp names its " + m));
  ok(one("state", "OH", "bird") !== one("state", "OH", "flower"), "bird and flower stamps differ");
  ok(P.stampArtMode("OH", "mix") === P.stampArtMode("OH", "mix") && new Set(ids51.map(id => P.stampArtMode(id, "mix"))).size === 3, "Mix varies per state and is stable");
  ["bird", "flower", "animal"].forEach(m => {
    const by = {}; ids51.forEach(id => { const g = SYM.DATA[id][m].glyph; (by[g] = by[g] || []).push(id); });
    Object.keys(by).filter(g => by[g].length > 1).forEach(g => {
      const sig = by[g].map(id => { const d = SA.design("state", id, "", m); return [d.shape, d.ink, d.flip, d.pose, d.border].join("|"); });
      ok(new Set(sig).size === sig.length, "shared " + m + " drawing '" + g + "' looks different in " + by[g].join(","));
    });
  });
  ok(Object.keys(SA.GLYPHS).length >= 30, "30+ reusable drawings");
  // no '?' / placeholder when there's no date
  const noQ = svg => !/\?|DATE|UNKNOWN|NOT SET/i.test(svg.replace(/<[^>]+>/g, " ").replace(/aria-label="[^"]*"/g, ""));
  const strip = svg => svg.replace(/<[^>]*>/g, " ");
  const und = { id: "stamp_nodate1", kind: "place", area: "FRA" };
  ["FRA", "ENG", "JPN", "ZZZ"].forEach(c => { const v = P.stampSVG({ id: "stamp_nodate1", kind: "place", area: c }, c); ok(!/\?|DATE|Unknown|not set/i.test(strip(v)) && !/\?|not set/i.test((v.match(/aria-label="([^"]*)"/) || [])[1]), c + " stamp with no date shows no placeholder"); });
  ids51.forEach(id => ["bird", "flower", "animal"].forEach(m => { const v = P.stampSVG({ id: "stamp_nd2", kind: "state", area: id }, id, { art: m }); if (/\?|DATE|not set/i.test(strip(v))) ok(false, id + " " + m + " state stamp has a date placeholder"); }));
  ok(true, "state stamps checked for placeholders");
  const pk = P.stampSVG({ id: "stamp_nd3", kind: "park", area: "yell" }, "Yellowstone", { sub: "WY · NATIONAL PARK" });
  ok(!/\?|DATE|not set/i.test(strip(pk)), "park stamp with no date shows no placeholder");
  const dated = P.stampSVG({ id: "stamp_d1", kind: "place", area: "FRA", date: "2024-04-03" }, "France"), nod = P.stampSVG(und, "France");
  ok(/3 APR 2024/.test(dated) && !/APR/.test(nod), "the date line is there only with a date");
  const mz = s => +(s.match(/class="motif" transform="translate\([\d.]+ [\d.]+\) scale\(([\d.]+)\)/) || [0, 0])[1];
  ok(mz(nod) >= mz(dated), "with no date the picture grows to keep the stamp balanced");
  ids51.forEach(id => { const v = P.signSVG(id, id, { first: "", visits: 1, who: ["a"], trips: [], list: [] }); if (/\?|DATE|not set|TAP TO ADD/i.test(v.replace(/<[^>]*>/g, " ")) || /not set/.test(v)) ok(false, id + " sign with no date shows a placeholder"); });
  ok(!/DATE\?|TAP TO ADD|date not set/.test(read("state-signs.js")) && !/Date not set|date not set|DATE \?/.test(read("trips-ui.js") + read("passport-core.js")), "no date placeholders left in the code");
  ok(/first visit/.test(P.signSVG("TX", "Texas", { first: "2020-05-01", visits: 2 })), "a dated sign still shows its first visit");
  ok(read("index.html").indexOf("state-symbols.js") < read("index.html").indexOf("stamp-art.js") && read("index.html").indexOf("stamp-art.js") < read("index.html").indexOf("passport-core.js"), "index.html loads symbols, then stamp art, then the passport");
  const sw2 = read("sw.js"); ok(["state-symbols.js", "stamp-art.js"].every(f => sw2.indexOf('"' + f + '"') >= 0), "service worker caches the stamp art files");
  ok(read("stamp-art.js").length < 185000 && read("state-symbols.js").length < 12000, "stamp art stays lightweight (v79: +21 place-type glyphs)");
  ok(/famstamp-stampart:/.test(read("trips-ui.js")) && /data-art=/.test(read("trips-ui.js")), "passport has the Bird / Flower / Animal / Mix toggle, saved per person");
}

// ---- national parks passport: a stamp per park, map dots ----
{
  const SA = require("../travel-log/app/stamp-art.js");
  ok(M.PARKS.length === 64 && M.PARKS.some(p => p.id === "chiricahua"), "64 national parks, Chiricahua included");
  ok(M.PARKS.every(p => typeof p.lat === "number" && typeof p.lon === "number"), "every park has a location for the map");
  ok(M.PARKS.every(p => p.set === "np") && M.PARK_SETS.some(x => x.id === "np"), "parks carry a set id so state parks can be added later");
  const looks = M.PARKS.map(p => { const d = SA.design("park", p.id, p.name); return [d.shape, d.border, d.ink, d.motif].join(); });
  ok(new Set(looks).size === 64, "every park stamp looks different (shape, border, ink, picture)");
  ok(M.PARKS.every(p => SA.parkLook(p.id) && SA.GLYPHS[SA.parkLook(p.id).motif]), "every park has a drawn picture");
  ok(SA.parkLook("saguaro").motif === "np_saguaro" && SA.parkLook("yellowstone").motif === "np_yellowstone" && SA.parkLook("arches").motif === "np_arches" && SA.parkLook("badlands").motif === "np_badlands", "every national park gets its own drawn scene");
  ok(M.PARKS.every(p => /^np_/.test(SA.parkLook(p.id).motif)) && !/data-look="(?!circle)/.test(SA.stampSVG({ kind: "park", area: "zion" }, { name: "Zion", date: "1 JUN 2026" })), "national park stamps share one round engraved layout");
  ok(/<textPath/.test(SA.stampSVG({ kind: "park", area: "denali" }, { name: "Denali", date: "1 JUN 2026", sub: "AK · NATIONAL PARK" })), "the park name runs around the top of the stamp");
  const und = SA.stampSVG({ kind: "park", area: "zion" }, { name: "Zion", date: "" });
  ok(!/\?/.test(und.replace(/<[^>]*>/g, " ")) && !/NATIONAL PARK SERVICE/.test(und + read("trips-ui.js") + read("stamp-art.js")), "an undated park stamp has no '?', and no agency name");
  ok(/parksMapSVG/.test(read("app.js")) && /pkstamp/.test(read("app.js")), "Parks tab shows the map dots and a stamp per park");
}
// ---- year in stamps ----
{
  const Y = require("../travel-log/app/year.js");
  const a = M.newKid({ name: "A", birthYear: 2016 }), b = M.newKid({ name: "B", birthYear: 2018 });
  a.parks = { zion: { at: "2026-06-02", jr: false }, acadia: { at: "2025-07-01", jr: false } };
  const trips = [{ id: "t1", kidIds: [a.id, b.id], place: "Sample", date: "2026-03-10", route: [{ kind: "state", ref: "UT", name: "Utah", country: "USA", region: "UT" }] },
                 { id: "t2", kidIds: [b.id], place: "Sample 2", date: "2025-08-01", route: [] }];
  const ys = Y.years([a, b], trips); ok(ys[0] === "2026" && ys.indexOf("2025") > 0, "years with data, newest first: " + ys);
  const s26 = Y.summary([a, b], trips, 2026);
  ok(s26.parks === 1 && s26.trips === 1, "2026: one park, one trip (" + JSON.stringify([s26.parks, s26.trips, s26.states]) + ")");
  ok(Y.summary([a, b], trips, 2025).parks === 1 && Y.summary([a], trips, 2025).trips === 0, "2025 counts its own park; a trip only counts for people on it");
  ok(s26.pick.length <= 9, "at most nine stamps on the card");
  ok(/year\.js/.test(read("index.html")) && /"year\.js"/.test(read("sw.js")) && /#\/year/.test(read("app.js")), "year card is loaded, cached offline and linked");
}
// ---- v1.6: home "+ Add a trip", "Did you fly? Which airports?", miles flown and time in the air ----
{
  const T = require("../travel-log/app/trips-core.js"), L = require("../travel-log/app/log-core.js");
  const MCO = { code: "MCO", name: "Orlando International Airport", city: "Orlando", country: "USA", lat: 28.429, lon: -81.309 };
  const EDI = { code: "EDI", name: "Edinburgh Airport", city: "Edinburgh", country: "GBR", lat: 55.95, lon: -3.373 };
  const ORL = { name: "Orlando", kind: "city", lat: 28.538, lon: -81.379, country: "USA", region: "FL" };
  const EDN = { name: "Edinburgh", kind: "city", lat: 55.953, lon: -3.189, country: "GBR", region: "SCT" };
  const g = T.gcMiles(MCO, EDI);
  ok(Math.abs(g - 4158) < 25, "MCO to EDI great circle is about 4,158 mi, got " + Math.round(g));
  ok(Math.abs(T.gcMiles({ lat: 40.64, lon: -73.779 }, { lat: 51.47, lon: -0.454 }) - 3451) < 25, "JFK to LHR about 3,451 mi");
  ok(T.airMinutes(g) > 7.5 * 60 && T.airMinutes(g) < 9 * 60, "MCO-EDI about 8 hours in the air: " + T.fmtAir(T.airMinutes(g)));
  ok(T.fmtAir(45) === "45m" && T.fmtAir(120) === "2h" && T.fmtAir(487) === "8h 5m" && T.fmtAir(0) === "" && T.fmtAir(null) === "", "fmtAir formats");
  ok(T.airMinutes(0) === null && T.airMinutes(null) === null, "no miles, no air time");
  ok(T.crossesBorder([ORL, EDN]) && !T.crossesBorder([ORL, { name: "Miami", country: "USA" }]), "crossesBorder: abroad vs domestic");
  ok(T.crossesBorder([{ name: "Home" }, EDN], "USA") && !T.crossesBorder([{ name: "Home" }, ORL], "USA"), "crossesBorder uses the saved home country when the start has none");
  ok(!T.crossesBorder([ORL]) && !T.crossesBorder([]), "one stop or none is never abroad");
  const fl = { route: [ORL, Object.assign({}, EDN, { mode: "plane", dep: MCO, arr: EDI })], roundTrip: true, kidIds: ["a"] };
  const s = T.summary(fl);
  ok(s.flights === 2 && Math.abs(s.flightMiles - 2 * g) < 2, "round trip: 2 flights, both ways flown");
  ok(s.airMin === 2 * T.airMinutes(g), "time in the air adds up both ways");
  ok(s.legs[1].home && s.legs[1].dep.code === "EDI" && s.legs[1].arr.code === "MCO", "flight home mirrors the way out");
  ok(!s.legs[0].toAp && !s.legs[0].fromAp, "a short airport run isn't counted as a drive");
  // a long drive to the airport counts as road miles
  const GNV = { name: "Gainesville", kind: "city", lat: 29.652, lon: -82.325, country: "USA", region: "FL" };
  const s2 = T.summary({ route: [GNV, Object.assign({}, EDN, { mode: "plane", dep: MCO, arr: EDI })], roundTrip: false });
  ok(s2.legs[0].toAp > 100 && s2.legs[0].toAp < 140 && s2.roadMiles === Math.round(s2.legs[0].toAp) && s2.miles === Math.round(s2.legs[0].miles + s2.legs[0].toAp), "drive from Gainesville to MCO counts as road miles: " + Math.round(s2.legs[0].toAp));
  ok(s2.flightMiles === Math.round(g), "flight miles stay airport to airport");
  // a flight later in the trip, with its own way home
  const MIA = { name: "Miami", kind: "city", lat: 25.774, lon: -80.194, country: "USA", region: "FL" };
  const MIAap = { code: "MIA", name: "Miami International Airport", city: "Miami", country: "USA", lat: 25.795, lon: -80.29 };
  const LON = { name: "London", kind: "city", lat: 51.507, lon: -0.128, country: "GBR", region: "ENG" };
  const LHR = { code: "LHR", name: "Heathrow Airport", city: "London", country: "GBR", lat: 51.47, lon: -0.454 };
  const t3 = { route: [ORL, Object.assign({}, MIA, { mode: "car" }), Object.assign({}, LON, { mode: "plane", dep: MIAap, arr: LHR })], roundTrip: true, back: { mode: "plane", dep: LHR, arr: MIAap } };
  const s3 = T.summary(t3);
  ok(s3.flights === 2 && s3.legs[2].mode === "plane" && s3.legs[2].dep.code === "LHR", "trip.back flies home from LHR instead of driving like the first leg");
  ok(s3.legs[2].fromAp > 150, "and drives the last bit home from Miami's airport: " + Math.round(s3.legs[2].fromAp || 0));
  ok(T.summary(Object.assign({}, t3, { back: null })).flights === 2, "without back, the way home copies the first leg, but London -> Orlando can't be a drive (plane)");
  ok(T.cleanBack({ mode: "plane", dep: LHR, arr: { code: "bad" } }).dep.code === "LHR" && !T.cleanBack({ mode: "plane", dep: LHR, arr: { code: "bad" } }).arr, "cleanBack keeps good airports only");
  ok(T.cleanBack({ mode: "rocket" }) === null && T.cleanBack(null) === null, "cleanBack drops nonsense");
  // the answer is kept on the trip, through backup
  const kid = L.newKid({ name: "Fake Kid" });
  const tr = L.newTrip({ kidIds: [kid.id], place: "Edinburgh", route: fl.route, roundTrip: true, fly: "yes", back: { mode: "plane", dep: EDI, arr: MCO } });
  ok(tr.fly === "yes" && tr.back && tr.back.dep.code === "EDI", "newTrip keeps fly + back");
  ok(L.newTrip({ kidIds: [kid.id], place: "X", fly: "maybe" }).fly === "" && L.newTrip({ kidIds: [kid.id], place: "X" }).back === null, "bad fly answers are dropped");
  const bk = L.readBackup(JSON.parse(JSON.stringify(L.makeBackup([kid], [tr], [], {}))));
  ok(bk.trips[0].fly === "yes" && bk.trips[0].back.arr.code === "MCO", "fly + back survive a backup round trip");
  // lifetime + badges
  const life = T.lifetime(kid.id, [tr, tr, tr].map((x, i) => Object.assign({}, x, { id: "t" + i })));
  ok(life.flights === 6 && Math.abs(life.flightMiles - 6 * g) < 5 && life.airMin === 6 * T.airMinutes(g), "lifetime flights, miles flown and time in the air");
  const st = L.stats(kid, [0, 1, 2].map(i => Object.assign({}, tr, { id: "t" + i })), MAPS.world), bs = L.badges(st);
  ok(st.flightMiles > 20000 && bs.find(b => b.id === "frequent-flyer").earned && bs.find(b => b.id === "sky-miles").earned, "Frequent flyer + Sky high earned");
  ok(!L.badges(L.stats(kid, [tr], MAPS.world)).find(b => b.id === "frequent-flyer").earned, "2 flights isn't Frequent flyer yet");
  // story mentions the time in the air, and the same trip still tells the same story
  const story = T.makeStory(Object.assign({ id: "trip_x", date: "2025-07-01", done: true }, tr), { travelers: [{ id: kid.id, name: "Fake Kid" }] }, { style: "journal" });
  ok(/in the air/.test(story.text), "story says how long they were in the air");
  ok(T.makeStory(Object.assign({ id: "trip_x", date: "2025-07-01" }, tr), { travelers: [{ id: kid.id, name: "Fake Kid" }] }, { style: "journal" }).text === story.text, "story stays the same for the same trip");
  // UI wiring
  const ui = read("trips-ui.js"), app = read("app.js"), css = read("app.css");
  ok(/Did you fly\?/.test(ui) && /Which airports\?/.test(ui) && /We didn\\'t fly/.test(ui) && /id="flyskip"/.test(ui), "builder asks Did you fly? with yes / didn't fly / skip");
  ok(/nearAirports\(/.test(ui) && /crossesBorder\(/.test(ui), "suggests nearby airports when the trip goes abroad");
  ok(/id="homeadd"/.test(app) && /whoWentSheet/.test(app) && /trips\/new" \+ \(all \? "\/all"/.test(ui) && /h\[4\] === "all"/.test(app), "home screen + Add a trip, with Who went? and Everyone went");
  ok(/\.homeadd \.btn-big \{[^}]*min-height:56px/.test(css) && /\.apchip \{[^}]*min-height:44px/.test(css), "big tap targets for the new buttons");
}

// ---- kid travel quests
{
  const Q = require("../travel-log/app/quests.js"), M = require("../travel-log/app/log-core.js");
  ok(Q.QUESTS.length >= 10 && new Set(Q.QUESTS.map(q => q.id)).size === Q.QUESTS.length, "quests: 10+ with unique ids");
  ok(["scotland", "ireland", "england", "florida", "park", "road-trip"].every(id => Q.byId[id]), "quests for Scotland, Ireland, England, Florida, parks and road trips");
  ok(Q.QUESTS.every(q => q.items.length >= 6 && q.items.every(i => i[0] && i[1] && i[1].length <= 48) && q.badge), "every quest has 6+ short kid-friendly items and a badge");
  ok(Q.QUESTS.every(q => !(q.match && q.match.parks) || q.match.parks.every(id => M.PARKS.some(p => p.id === id))), "park quests point at real park ids");
  const p = M.newPerson({ name: "Test kid", role: "kid" }); p.states.FL = { at: "2026-01-02" };
  ok(Q.list(p)[0].q.id === "florida" && Q.list(p)[0].mine, "a Florida trip puts the Florida quest first");
  const n = Q.byId.florida.items.length; let fin = false;
  for (let i = 0; i < n; i++) fin = Q.toggle(p, "florida", i, true, "2026-02-03");
  ok(fin && Q.progress(p, "florida").complete && p.quests.florida.at === "2026-02-03", "finishing every item earns the badge with a date");
  ok(Q.earned(p).length === 1, "earned badges listed");
  Q.toggle(p, "florida", 0, false); ok(!Q.progress(p, "florida").complete && !p.quests.florida.at, "unticking takes the badge back");
  ok(JSON.stringify(Q.clean({ florida: { done: { 0: "2026-01-01", 99: "2026-01-01", 1: "bad" } }, nope: { done: { 0: "2026-01-01" } } })) === '{"florida":{"done":{"0":"2026-01-01"}}}', "clean drops unknown quests, items and bad dates");
  const bk = M.readBackup(JSON.parse(JSON.stringify(M.makeBackup([p], [], [])))); ok(bk.kids[0].quests && bk.kids[0].quests.florida, "quests survive a backup round trip");
  Q.setParks(M.PARKS); const z = M.newPerson({ name: "Test kid 2", role: "kid" }); z.parks.zion = { at: "2026-06-01", jr: false };
  ok(Q.list(z)[0].q.id === "park-zion" && Q.list(z)[0].q.badge === "Zion Explorer", "every park in the log gets its own explorer quest, first in the list");
  ok(!/arrowhead|official|NPS logo/i.test(JSON.stringify(Q.PARK_ITEMS)) && Q.JR_URL === "https://www.nps.gov/kids/junior-rangers.htm", "park quest: plain text, links the official Junior Ranger page");
  Q.toggle(z, "park-zion", 0, true, "2026-06-02"); ok(z.parks.zion.jr === true, "ticking Junior Ranger in the quest marks it on the Parks tab too");
  z.parks.zion.jr = false; ok(Q.progress(z, "park-zion").have === 1 - 1 + (z.quests["park-zion"].done[0] ? 1 : 0), "progress follows the stored ticks");
  z.parks.zion.jr = true; delete z.quests["park-zion"]; ok(Q.progress(z, "park-zion").have === 1, "a Ranger tick from the Parks tab counts in the quest");
  ok(/quests\.js/.test(read("index.html")) && /"quests\.js"/.test(read("sw.js")) && /FS_QUESTS\.view/.test(read("app.js")), "quests loaded, cached offline and routed");
}

// ---- trip memories
{
  const M = require("../travel-log/app/log-core.js"), T = require("../travel-log/app/trips-core.js");
  ok(T.MEM_PROMPTS.map(p => p[1]).join("|") === "Best part|Favorite food|Most memorable moment|Funniest moment|Would go back for", "memory prompts: best part, food, moment, funniest, would go back for");
  const t = M.newTrip({ kidIds: ["kid_abcd1234"], place: "Sample Beach", date: "2026-05-01", memory: "Rainy but fun", memories: { best: "  The waves ", food: "", junk: "x", moment: "a".repeat(900) } });
  ok(t.memories.best === "The waves" && !("food" in t.memories) && !("junk" in t.memories) && t.memories.moment.length === 400 && t.memory === "Rainy but fun", "memories cleaned: trimmed, empty and unknown dropped, capped");
  const none = M.newTrip({ kidIds: ["kid_abcd1234"], place: "Sample Beach" }); ok(none.memories && !Object.keys(none.memories).length, "memories are optional");
  const bk = M.readBackup(JSON.parse(JSON.stringify(M.makeBackup([M.newPerson({ id: "kid_abcd1234", name: "Test kid" })], [t], []))));
  ok(bk.trips[0].memories && bk.trips[0].memories.best === "The waves", "memories survive a backup round trip");
  ok(/data-memf/.test(read("trips-ui.js")) && /Trip memories/.test(read("trips-ui.js")), "trip form and trip page show Trip memories");
}

{ // v1.6.1: airport city names people know; French cities aren't "Mayotte"
  const T = require("../travel-log/app/trips-core.js"), fs = require("fs");
  ok(T.airportCity("Ingliston, Edinburgh", "Edinburgh Airport", "EDI") === "Edinburgh", "EDI shows Edinburgh, not Ingliston");
  ok(T.airportCity("Paris (Roissy-en-France, Val-d'Oise)", "Charles de Gaulle International Airport", "CDG") === "Paris", "CDG shows Paris");
  ok(T.airportCity("Colombier-Saugnieu", "Lyon Saint-Exupéry Airport", "LYS") === "Lyon", "LYS shows Lyon");
  ok(T.airportCity("Orlando", "Orlando International Airport", "MCO") === "Orlando", "plain city unchanged");
  const pl = JSON.parse(fs.readFileSync(__dirname + "/../travel-log/app/data/places.json", "utf8"));
  ok(pl.countries.FRA === "France" && pl.countries.NOR === "Norway", "places data names France and Norway (not Mayotte / Svalbard)");
  const lyon = T.cleanPoint({ name: "Lyon", country: "FRA", sub: "Auvergne-Rhône-Alpes, Mayotte", lat: 45.76, lon: 4.84 });
  ok(lyon && lyon.sub === "Auvergne-Rhône-Alpes, France", "a trip saved with the old 'Mayotte' label reads France");
  const may = T.cleanPoint({ name: "Mamoudzou", country: "FRA", sub: "Mayotte", lat: -12.78, lon: 45.23 });
  ok(may && may.sub === "Mayotte", "a real Mayotte place keeps its name");
}
// ---- firsts
{
  const F = require("../travel-log/app/firsts.js"), M = require("../travel-log/app/log-core.js");
  const k = M.newPerson({ id: "kid_first001", name: "Test kid" });
  k.parks = { zion: { at: "2025-07-02", jr: false }, yell: { at: "2024-06-10", jr: false }, grca: { at: "2025-08-01", jr: true } };
  k.states = { MA: { at: "2020-01-01" }, ME: { at: "2023-08-15" }, NH: { at: "2024-01-03" } };
  k.places = { USA: { at: "2020-01-01" }, CAN: { at: "2024-09-09" } };
  const trips = [
    { id: "t1", kidIds: [k.id], date: "2023-08-15", route: [{ name: "Home", country: "USA" }, { name: "Portland", country: "USA", mode: "car" }] },
    { id: "t2", kidIds: [k.id], date: "2024-09-09", title: "Montreal weekend", route: [{ name: "Home", country: "USA" }, { name: "Montreal", country: "CAN", mode: "plane", dep: { code: "BOS" }, arr: { code: "YUL" } }] },
    { id: "t3", kidIds: ["someone_else"], date: "2019-01-01", route: [{ name: "Home", country: "USA" }, { name: "Paris", country: "FRA", mode: "plane" }] }];
  const ctx = { home: { country: "USA", region: "MA" }, park: id => ({ zion: "Zion", yell: "Yellowstone", grca: "Grand Canyon" })[id] };
  const f = F.found(k, trips, ctx);
  ok(f.park.place === "Yellowstone" && f.park.at === "2024-06-10", "first national park is the earliest dated park");
  ok(f.jr.place === "Grand Canyon" && /Earned a Junior Ranger badge at Grand Canyon/.test(f.jr.text), "first Junior Ranger badge from parks[].jr");
  ok(f.state.id === undefined && f.state.at === "2023-08-15", "first new state skips the home state");
  ok(f.country.at === "2024-09-09", "first new country skips home");
  ok(f.abroad.place === "Montreal weekend" && f.flight.place === "BOS → YUL", "first trip abroad + first flight from this person's trips only");
  ok(F.mark(k, "beach", { at: "2022-07-04", place: "  Sample Beach ", note: "Cold water!" }) === "beach", "mark a first by hand");
  ok(F.mark(k, "other", { at: "2025-01-02", place: "Sample Hill", label: "ski lesson" }) === "x1" && F.mark(k, "other", { label: "" }) === null, "custom firsts need a label");
  F.mark(k, "flight", { at: "2021-03-03", place: "Earlier trip" });
  const tl = F.timeline(k, trips, ctx);
  ok(tl[0].key === "flight" && !tl[0].auto && tl[1].key === "beach", "timeline is oldest first; hand-marked overrides found");
  ok(tl.filter(r => r.key === "flight").length === 1 && tl.some(r => r.title === "First ski lesson"), "no duplicate kinds; custom title");
  ok(F.clean({ bogus: { at: "x" }, road: { at: "nope", place: "<b>" + "a".repeat(200) } }).road.place.length === 80 && !F.clean({ bogus: {} }).bogus, "clean drops unknown kinds and bad dates");
  ok(F.forYear([k], trips, "2024", ctx).map(x => x.title).join("|") === "First national park|First new country|First trip abroad", "year card firsts for 2024 " + F.forYear([k], trips, "2024", ctx).map(x => x.title).join("|"));
  ok(F.unmark(k, "flight") && F.timeline(k, trips, ctx).find(r => r.key === "flight").auto, "removing the hand-marked one falls back to the found one");
  const bk = M.readBackup(JSON.parse(JSON.stringify(M.makeBackup([k], [], []))));
  ok(bk.kids[0].firsts && bk.kids[0].firsts.beach.place === "Sample Beach", "firsts survive a backup round trip");
}


{ // v1.6.2 QA: ocean legs fly, repeated stops aren't legs, story arcs aren't filled
  const T = require("../travel-log/app/trips-core.js"), fs = require("fs");
  const ORL = { name: "Orlando", kind: "city", lat: 28.538, lon: -81.379, country: "USA", region: "FL" };
  const LON = { name: "London", kind: "city", lat: 51.507, lon: -0.128, country: "GBR", region: "ENG", mode: "plane" };
  const PAR = { name: "Paris", kind: "city", lat: 48.857, lon: 2.352, country: "FRA", mode: "train" };
  const ROM = { name: "Rome", kind: "city", lat: 41.9, lon: 12.5, country: "ITA", mode: "car" };
  const s = T.summary({ route: [ORL, LON, PAR, ROM], roundTrip: true, back: null });
  const home = s.legs[s.legs.length - 1];
  ok(home.home && home.mode === "plane" && s.roadMiles < 1000 && !home.toAp, "Skip on a trip abroad: Rome -> Orlando flies, not ~6,141 road miles (" + home.mode + ", road " + s.roadMiles + ")");
  ok(T.summary({ route: [ORL, Object.assign({}, LON, { mode: "car" })] }).legs[0].mode === "plane", "Orlando -> London by car becomes a flight");
  ok(T.summary({ route: [ORL, { name: "Atlanta", lat: 33.75, lon: -84.39, country: "USA", region: "GA", mode: "car" }] }).legs[0].mode === "car", "Orlando -> Atlanta stays a drive");
  ok(T.summary({ route: [ORL, Object.assign({}, LON, { mode: "car", miles: 4300 })] }).legs[0].mode === "car", "typed real miles keep their mode");
  const dup = T.summary({ route: [ORL, Object.assign({}, ORL, { mode: "car" }), LON] });
  ok(dup.legs.length === 1 && dup.legs[0].to === "London" && dup.cities.join() === "London", "Orlando -> Orlando isn't a leg or a town: " + dup.legs.map(L => L.from + ">" + L.to).join());
  ok(T.sameStop(ORL, { name: "Orlando", lat: 28.5, lon: -81.4 }) && !T.sameStop(ORL, { name: "Kissimmee", lat: 28.29, lon: -81.41 }) && T.sameStop({ name: "Home" }, { name: "home" }), "same stop: within 5 miles, or same name with no location");
  const css = fs.readFileSync(__dirname + "/../travel-log/app/app.css", "utf8");
  ok(/svg path\.leg \{ fill:none/.test(css), "every route/story arc path.leg has fill:none");
  const ui = fs.readFileSync(__dirname + "/../travel-log/app/trips-ui.js", "utf8"), app = fs.readFileSync(__dirname + "/../travel-log/app/app.js", "utf8");
  ok(/if \(saving\) return/.test(ui) && /if \(ksaving\) return/.test(app), "double taps on Save trip / Add someone are ignored");
}

// ---- Park sets: national parks, state parks, national monuments & memorials ----
{
  ok(M.PARKS.length === 64, "64 national parks (Chiricahua is the 64th)");
  const sp = M.parksIn("sp"), nm = M.parksIn("nm"), np = M.parksIn("np");
  ok(np.length === 64 && sp.length >= 50 && nm.length >= 40, "set sizes " + [np.length, sp.length, nm.length]);
  const ids = M.ALL_PARKS.map(p => p.id);
  ok(new Set(ids).size === ids.length, "park ids are unique");
  ok(ids.every(id => /^[a-z0-9-]{2,40}$/.test(id)), "park ids fit the backup and sync id rules");
  ok(M.ALL_PARKS.every(p => typeof p.lat === "number" && typeof p.lon === "number" && p.lat > -15 && p.lat < 72 && p.lon < -60), "every park has US coordinates");
  ok(M.ALL_PARKS.every(p => p.states && p.full && p.label), "every park has states, full name and label");
  ok(!ids.includes("nm-gateway-arch") && !ids.some(id => /9-11|september/.test(id)), "Gateway Arch and the 9/11 Memorial aren't in the extra sets");
  ok(M.parkSub(M.parkById("sp-custer")) === "SD · STATE PARK", "state park label: " + M.parkSub(M.parkById("sp-custer")));
  ok(M.parkSub(M.parkById("mem-mount-rushmore")) === "SD · NATIONAL MEMORIAL", "memorial label");
  ok(/NATIONAL MONUMENT$/.test(M.parkSub(M.parkById("nm-devils-tower"))), "monument label");
  ok(/NATIONAL PARK$/.test(M.parkSub(M.parkById("zion"))), "national park label");
  ok(M.parkById("nope") === null || M.parkById("nope") === undefined, "unknown park id");
  const k = M.newKid({ name: "Sample", birthYear: 2016 });
  k.parks["sp-custer"] = { at: "2020-06-01", jr: true }; k.parks["mem-mount-rushmore"] = { at: "2020-06-02", jr: false }; k.parks.zion = { at: "2025-05-01", jr: false };
  const st = M.stats(k, [], MAPS.world);
  ok(st.parksTotal === 64, "parks badge total stays at 64 national parks");
  const F = require("../travel-log/app/firsts.js");
  const fz = F.found(k, [], { home: { country: "USA", region: "MA" }, park: id => (M.parkById(id) || {}).name });
  ok(fz.park && fz.park.place === "Zion" && fz.park.at === "2025-05-01", "first national park ignores earlier state park and memorial visits");
  ok(!fz.jr, "a state park ranger badge isn't a Junior Ranger first");
  const bk = M.readBackup(JSON.parse(JSON.stringify(M.makeBackup([k], []))));
  ok(bk.kids[0].parks["sp-custer"] && bk.kids[0].parks["mem-mount-rushmore"], "state park and memorial visits survive a backup round trip");
  const SA = require("../travel-log/app/stamp-art.js");
  ok(M.ALL_PARKS.slice(64).every(p => SA.GLYPHS[SA.design("park", p.id, p.name).motif]), "every extra park has a drawn picture");
}


{ // printed travel book: premium coming-soon page + sample PDF, no backend
  const bk = read("book.js"), sw = read("sw.js"), idx = read("index.html");
  ok(/"book\.js"/.test(sw) && /<script src="book\.js"><\/script>/.test(idx), "book.js is loaded and cached offline");
  ok(!/famstamp-sample-book\.pdf/.test(sw), "the sample PDF isn't in the offline cache");
  const pdf = fs.statSync(path.join(APP, "samples", "famstamp-sample-book.pdf"));
  ok(pdf.size > 50000 && pdf.size < 5e6, "sample book PDF is there and not huge: " + pdf.size);
  ok(/Premium · coming soon/.test(bk) && /nothing to sign up for yet/.test(bk) && !/fetch\(|supabase|waitlist\s*=/.test(bk), "book page is a coming-soon note with no waitlist backend");
}

{ // v1.6.3: main destination, nicknames, trip memories, one badge sentence
  const T = require("../travel-log/app/trips-core.js");
  const ORL = { name: "Orlando", lat: 28.538, lon: -81.379, country: "USA", region: "FL" };
  const sc = (n, lat, lon, nights) => ({ name: n, lat, lon, country: "GBR", region: "SCT", mode: "car", nights });
  const route = [ORL, Object.assign(sc("Edinburgh", 55.95, -3.19), { mode: "plane" }), sc("Stirling", 56.12, -3.94), sc("Inverness", 57.48, -4.22), sc("Glasgow", 55.86, -4.25)];
  ok(T.mainDest(route) === "Scotland", "a trip around Scotland is 'Scotland', not the last stop: " + T.mainDest(route));
  ok(T.mainDest([ORL, Object.assign({}, route[1])]) === "Edinburgh", "one stop abroad keeps its town");
  ok(T.mainDest([ORL, { name: "Atlanta", lat: 33.75, lon: -84.39, country: "USA", region: "GA" }, { name: "Nashville", lat: 36.16, lon: -86.78, country: "USA", region: "TN" }]) === "Nashville", "trips at home still name the last stop");
  ok(T.mainDest([ORL, { name: "London", lat: 51.5, lon: -0.12, country: "GBR", region: "ENG", nights: 2 }, { name: "Paris", lat: 48.86, lon: 2.35, country: "FRA", nights: 5 }, { name: "Rome", lat: 41.9, lon: 12.5, country: "ITA", nights: 1 }]) === "Paris", "across countries: the longest stay");
  ok(T.mainDest([ORL, { name: "London", lat: 51.5, lon: -0.12, country: "GBR", region: "ENG" }, { name: "Rome", lat: 41.9, lon: 12.5, country: "ITA" }]) === "London", "across countries, no nights: the first stop abroad");
  const t = T.syncLegacy({ route: route.slice() }); ok(t.place === "Scotland", "syncLegacy names the trip Scotland");
  ok(T.syncLegacy({ route: route.slice(), title: "Highland Fling" }).place === "Highland Fling", "a trip name they typed wins");
  const trip = { id: "trip_scot", place: "Scotland", route, roundTrip: true, date: "2026-07-10", memories: { best: "climbing up to Stirling Castle", food: "cranachan", funny: "Dad's kilt in the wind", again: "", moment: "" } };
  const ctx = { travelers: [{ id: "a", name: "Rosemary", nickname: "Rosie Roo", role: "kid" }, { id: "b", name: "Sam", role: "adult" }],
    badges: [{ who: "Rosie Roo", name: "First flight" }, { who: "Rosie Roo", name: "Big road trip" }, { who: "Rosie Roo", name: "1,000 miles" }] };
  for (const style of ["storybook", "journal"]) {
    for (let seed = 0; seed < 4; seed++) {
      const st = T.makeStory(trip, ctx, { style, seed }).text;
      ok(/Rosie Roo/.test(st) && !/Rosemary/.test(st), style + seed + ": story uses the nickname");
      ok(/Stirling Castle/.test(st) && /cranachan/i.test(st) && /kilt/.test(st), style + seed + ": filled memories are woven in");
      const bs = st.split(/(?<=[.!?])\s/).filter(x => /badge/i.test(x));
      ok(bs.length === 1 && /new badges/i.test(bs[0]) && /First flight, Big road trip and 1,000 miles/.test(bs[0]), style + seed + ": one badge sentence: " + bs.join(" | "));
      ok(/Scotland/.test(st.split(/(?<=[.!?])\s/).slice(0, 2).join(" ")), style + seed + ": opener names Scotland");
    }
  }
}


// ---- grandparent follow-along ----
{
  const C = require("../travel-log/app/follow-core.js");
  ok(C.validToken("abcDEF123_-abcDEF123_-xy") && !C.validToken("short") && !C.validToken("bad token with spaces 1234567890") && !C.validToken("<script>alert(1)</script>xxxxxx"), "follow: token check");
  const people = [
    { id: "k1", name: "Rosemary", nickname: "Rosie", role: "kid", states: { UT: { at: "2026-06-02" } }, parks: { zion: { at: "2026-06-02", jr: true } } },
    { id: "k2", name: "Max", role: "kid", states: { UT: { at: "2026-06-02" } } },
    { id: "a1", name: "Pat", role: "adult", states: { NV: { at: "2026-06-01" } } },
    { id: "g1", name: "June", role: "grand", relationship: "grandparent" }];
  ok(JSON.stringify(C.defaultShare(people)) === '["k1","k2"]', "follow: kids shared by default");
  ok(C.shareable(people).every(p => p.id !== "g1"), "follow: followers can't be shared");
  const trips = [{ id: "t1", kidIds: ["k1", "k2", "a1"], place: "Zion", date: "2026-06-02", memories: { best: "Angels Landing view" },
                   moments: { k1: "Rosie's moment", a1: "Pat's secret", k2: "" }, route: [{ name: "Springdale" }] },
                 { id: "t2", kidIds: ["a1"], place: "Work trip", date: "2026-07-01" }];
  const f = C.fromLocal(people, trips, ["k1", "k2", "g1"], { family: "Zz", label: "Grandma June" });
  ok(f.people.length === 2 && !f.people.some(p => p.id === "g1" || p.id === "a1"), "follow: only shared people (no followers, no unshared)");
  ok(f.trips.length === 1 && f.trips[0].to === "Springdale" && JSON.stringify(f.trips[0].kidIds) === '["k1","k2"]', "follow: only trips with shared people, unshared names stripped");
  ok(f.trips[0].moments.k1 && !f.trips[0].moments.a1 && !JSON.stringify(f).includes("Pat's secret") && !JSON.stringify(f).includes("NV"), "follow: an unshared person's moment and stamps never leave the device");
  ok(!("route" in f.trips[0]) && !JSON.stringify(f).includes("photo"), "follow: no route or photos in the feed");
  const c = C.clean(JSON.parse(JSON.stringify(Object.assign({}, f, { people: f.people.concat([{ id: "x", name: "<b>x</b>", color: "red;}" }]),
    visits: f.visits.concat([{ person: "nobody", kind: "state", id: "CA", at: "2026-01-01" }, { person: "k1", kind: "evil", id: "CA", at: "2026-01-01" }]) }))));
  ok(c.people.find(p => p.id === "x").color === "" && !c.visits.some(v => v.person === "nobody" || v.kind === "evil"), "follow: clean drops bad colours, unknown people and kinds");
  ok(C.clean(null) === null && C.clean({ paused: true, family: "Zz" }).paused === true, "follow: off and paused feeds");
  const u = C.updates(c);
  const tripItem = u.find(i => i.trip);
  ok(tripItem && tripItem.stamps.filter(s => s.kind === "state" && s.id === "UT").length === 1, "follow: a state both kids got shows once on the trip card");
  const zion = tripItem.stamps.find(s => s.id === "zion");
  ok(zion && zion.jr && !zion.everyone && zion.who.join() === "k1", "follow: a stamp only one kid got says who");
  ok(u.length <= 40, "follow: updates capped");
  ok(C.linkURL("https://x.test/app/", "abcDEF123_-abcDEF123_-xy") === "https://x.test/app/#/follow/abcDEF123_-abcDEF123_-xy", "follow: link format");
  const fj = read("follow.js"), idx = read("index.html"), sw = read("sw.js"), app = read("app.js");
  ok(/follow-core\.js/.test(idx) && /follow\.js/.test(idx) && /"follow-core\.js"/.test(sw) && /"follow\.js"/.test(sw) && /FS_FOLLOW/.test(app), "follow: loaded, cached offline and routed");
  ok(!/innerHTML\s*=\s*[^;]*\+\s*(f|feed)\.(family|label)\b/.test(fj), "follow: family and label are escaped");
}

{ // v1.7: weather day by day, the way home from another airport
  const X = require("../travel-log/app/weather-core.js"), T = require("../travel-log/app/trips-core.js"), L = require("../travel-log/app/log-core.js");
  ok(X.KINDS.map(k => k.label).join() === "Sunny,Partly cloudy,Cloudy,Rainy,Stormy,Snowy,Windy,Foggy,Hot,Cold", "weather picker has the 10 kinds");
  ok(X.codeKind(0) === "sunny" && X.codeKind(2) === "partly" && X.codeKind(3) === "cloudy" && X.codeKind(45) === "foggy" && X.codeKind(61) === "rainy" && X.codeKind(81) === "rainy" && X.codeKind(73) === "snowy" && X.codeKind(95) === "stormy", "WMO codes map to kinds");
  const sc = (n, lat, lon) => ({ name: n, lat, lon, country: "GBR", region: "SCT", mode: "car" });
  const t = { id: "trip_wx1", date: "2026-07-10", endDate: "2026-07-21", route: [{ name: "Orlando", lat: 28.5, lon: -81.4, country: "USA" }, Object.assign(sc("Edinburgh", 55.95, -3.19), { mode: "plane" }), sc("Stirling", 56.12, -3.94), sc("Glasgow", 55.86, -4.25)],
    stays: [{ name: "Zz", nights: 4, where: "Edinburgh" }] };
  const days = X.tripDays(t);
  ok(days.length === 12 && days[0].date === "2026-07-10" && days[11].date === "2026-07-21", "one weather row per trip day (11 nights = 12 days)");
  ok(days.slice(0, 4).every(d => d.stops[0].name === "Edinburgh") && days[4].stops[0].name === "Stirling" && days[11].stops[0].name === "Glasgow", "days follow the stops and the nights stayed");
  ok(X.tripDays({ date: "2026-07-10", route: [] }).length === 0 && X.tripDays({ route: t.route }).length === 0, "no dates or no places = no weather rows");
  ok(X.tripDays(Object.assign({}, t, { endDate: "2027-07-10" })).length === X.MAX_DAYS, "long trips are capped at " + X.MAX_DAYS + " days");
  const today = "2026-10-23";
  ok(X.sourceFor("2026-07-10", today) === "archive" && X.sourceFor("2026-10-20", today) === "forecast" && X.sourceFor("2026-11-05", today) === "forecast" && X.sourceFor("2026-11-20", today) === "typical", "past -> archive, next 2 weeks -> forecast, later -> typical");
  const pl = X.plan(days, today);
  ok(pl.length === 1 && /^https:\/\/archive-api\.open-meteo\.com\/v1\/archive\?/.test(pl[0].url) && /start_date=2026-07-10&end_date=2026-07-21/.test(pl[0].url) && pl[0].locs.length === 3, "a past trip is one archive request for every stop");
  ok(!/apikey|key=/i.test(pl[0].url) && /temperature_unit=fahrenheit/.test(pl[0].url) && /timezone=auto,auto,auto/.test(pl[0].url), "no key; °F; a timezone per stop");
  const fut = X.plan(X.tripDays(Object.assign({}, t, { date: "2026-10-20", endDate: "2026-11-20" })), today);
  ok(fut.filter(r => r.group === "forecast").length === 1 && fut.filter(r => r.group === "typical").length === X.TYPICAL_YEARS, "a trip from now: one forecast request + 5 years of archive for typical days");
  ok(/start_date=2025-/.test(fut.find(r => r.year === 1).url) && /start_date=2021-/.test(fut.find(r => r.year === 5).url), "typical years go back 1..5 years");
  ok(X.shiftYears("2028-02-29", 1) === "2027-02-28", "Feb 29 shifts to Feb 28");
  const one = { daily: { time: ["2026-07-10"], weather_code: [61], temperature_2m_max: [60.1], temperature_2m_min: [50], precipitation_sum: [4.2] } };
  const pr = X.parse(one, { locs: ["55.95,-3.19"] });
  ok(pr["55.95,-3.19|2026-07-10"].hi === 60.1 && pr["55.95,-3.19|2026-07-10"].mm === 4.2, "parse: one location (object)");
  const many = X.parse([one, one], { locs: ["a", "b"] }); ok(many["a|2026-07-10"] && many["b|2026-07-10"], "parse: several locations (array)");
  const shifted = X.parse({ daily: { time: ["2025-11-20"], weather_code: [3], temperature_2m_max: [50], temperature_2m_min: [40], precipitation_sum: [0] } }, { locs: ["a"], shift: 1 });
  ok(shifted["a|2026-11-20"], "typical rows land on the trip's own dates");
  const ty = X.typicalOf([{ hi: 50, lo: 40, code: 61, mm: 3 }, { hi: 54, lo: 42, code: 3, mm: 0 }, { hi: 52, lo: 41, code: 61, mm: 2 }, { hi: 56, lo: 44, code: 3, mm: 0 }]);
  ok(ty.hi === 53 && ty.lo === 41.75 && ty.pop === 50 && ty.kind === "rainy" && ty.years === 4, "typical = the average of the years, rain chance = wet years share");
  ok(X.fmtT(64, "F") === "64°" && X.fmtT(64, "C") === "18°" && X.fmtT(null, "F") === "", "°F / °C display");
  // manual picks
  const cw = X.cleanWx({ "2026-07-11": { k: "sunny", t: 64.4 }, "2026-07-12": { k: "lava" }, "bad": { k: "rainy" }, "2026-07-13": { k: "rainy", t: 999 } });
  ok(JSON.stringify(cw) === '{"2026-07-11":{"k":"sunny","t":64},"2026-07-13":{"k":"rainy"}}', "manual weather is cleaned: " + JSON.stringify(cw));
  const cache = { rows: { "55.95,-3.19|2026-07-10": { hi: 60, lo: 50, code: 61, mm: 4 }, "55.95,-3.19|2026-07-11": { hi: 58, lo: 49, code: 61, mm: 5 } }, typical: {} };
  const b1 = X.build(Object.assign({}, t, { wx: { "2026-07-11": { k: "sunny", t: 64 } } }), cache, today);
  ok(b1[0].stops[0].src === "past" && b1[0].stops[0].kind === "rainy" && b1[0].stops[0].ic === "🌧️", "past days show real weather");
  ok(b1[1].stops[0].src === "manual" && b1[1].stops[0].kind === "sunny" && b1[1].stops[0].hi === 64 && b1[1].stops[0].real.kind === "rainy" && b1[1].stops[0].pop == null, "a hand pick overrides the fetched day (real kept aside)");
  ok(b1[2].stops[0].src === "" && !b1[2].stops[0].kind, "no data yet = empty, not an error");
  const notes = X.storyNotes(b1);
  ok(notes.length === 2 && notes[0].src === "manual" && notes[0].kind === "sunny" && notes[1].kind === "rainy" && notes[1].place === "Edinburgh", "story weather: hand picks first, then real past weather");
  const fb = X.build(Object.assign({}, t, { date: "2026-10-24", endDate: "2026-10-26" }), { rows: { "55.95,-3.19|2026-10-24": { hi: 60, lo: 50, code: 61 } }, typical: {} }, today);
  ok(fb[0].stops[0].src === "forecast" && X.storyNotes(fb).length === 0, "forecasts never go in the story");
  // fetching: cache, offline, failures
  const mem = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } };
  let calls = 0; const okFetch = () => { calls++; return Promise.resolve({ ok: true, json: () => Promise.resolve([one, one, one]) }); };
  X.load(t, today, { store: mem, fetch: okFetch, now: 1e12 }).then(r => {
    ok(calls === 1 && r.fetched === 1 && Object.keys(r.rows).length >= 1 && mem.d["fs-wx:trip_wx1"], "load fetches once and caches per trip");
    return X.load(t, today, { store: mem, fetch: okFetch, now: 1e12 + 864e5 * 30 });
  }).then(r => {
    ok(calls === 1 && r.fetched === 0, "past weather is never fetched again");
    ok(Object.keys(X.cached(t, today, mem).rows).length >= 1, "cached() reads without the network");
    const ft = Object.assign({}, t, { id: "trip_wx2", date: "2026-10-24", endDate: "2026-10-25" }); let n2 = 0;
    const f2 = () => { n2++; return Promise.resolve({ ok: true, json: () => Promise.resolve([one, one, one]) }); };
    return X.load(ft, today, { store: mem, fetch: f2, now: 1e12 }).then(() => X.load(ft, today, { store: mem, fetch: f2, now: 1e12 + 3600e3 }))
      .then(() => { ok(n2 === 1, "a forecast isn't refetched within a few hours"); return X.load(ft, today, { store: mem, fetch: f2, now: 1e12 + 4 * 3600e3 }); })
      .then(() => { ok(n2 === 2, "a forecast refreshes after a few hours"); return X.load(ft, today, { store: mem, fetch: () => Promise.reject(new Error("offline")), now: 1e12 + 9 * 3600e3 }); })
      .then(r => { ok(r.failed === 1 && Object.keys(r.rows).length >= 1, "a failed refresh keeps the saved forecast, quietly"); return X.load(Object.assign({}, ft, { id: "trip_wx3" }), today, { store: mem, fetch: () => Promise.resolve({ ok: false, status: 500 }) }); })
      .then(r => ok(r.failed === 1 && !Object.keys(r.rows).length, "API down with nothing saved: empty, no throw"));
  }).catch(e => ok(false, "weather load threw: " + e.message));
  // trips keep the picks; the story uses them
  const trip = L.newTrip({ kidIds: ["k1"], place: "Scotland", route: t.route, date: t.date, endDate: t.endDate, wx: { "2026-07-11": { k: "rainy" }, x: 1 } });
  ok(JSON.stringify(trip.wx) === '{"2026-07-11":{"k":"rainy"}}', "a trip saves its weather picks");
  const st = T.makeStory(trip, { travelers: [{ name: "Rosie", nickname: "Rosie Roo" }], wx: [{ kind: "rainy", place: "Edinburgh", src: "manual" }] }, { style: "storybook" }).text;
  ok(/rain/i.test(st) && /Edinburgh/.test(st), "storybook mentions a rainy day in Edinburgh");
  const sj = T.makeStory(trip, { travelers: [], wx: [{ kind: "sunny", place: "Glasgow", src: "past" }] }, { style: "journal" }).text;
  ok(/sun/i.test(sj) && /Glasgow/.test(sj), "journal mentions the sunny day");
  const s0 = T.makeStory(trip, { travelers: [] }, { style: "storybook" }).text; ok(!/rain|sunny/i.test(s0.replace(/Rain every day/, "")), "no weather notes = no weather line");
  // the way home: a chosen airport
  const bk = T.cleanBack({ mode: "plane", dep: { code: "GLA", name: "Glasgow", lat: 55.87, lon: -4.43 }, arr: { code: "MCO", name: "Orlando", lat: 28.43, lon: -81.31 }, picked: true, junk: 1 });
  ok(bk.dep.code === "GLA" && bk.picked === true && !bk.junk, "the return airport (and that it was picked) is kept");
  const oj = { roundTrip: true, route: [{ name: "Orlando", lat: 28.5, lon: -81.4, country: "USA" }, Object.assign(sc("Edinburgh", 55.95, -3.19), { mode: "plane", dep: { code: "MCO", lat: 28.43, lon: -81.31 }, arr: { code: "EDI", lat: 55.95, lon: -3.37 } }), sc("Glasgow", 55.86, -4.25)], back: bk };
  const legs = T.summary(oj).legs.filter(x => x.mode === "plane");
  ok(legs.length === 2 && legs[1].dep.code === "GLA" && legs[1].arr.code === "MCO" && legs[1].home, "open-jaw: home from GLA to MCO");
  const ui = read("trips-ui.js");
  ok(/function autoBack\(\)/.test(ui) && /nearestAirport\(last, airports\)/.test(ui) && /Flew home from/.test(ui), "the form defaults the way home to the airport nearest the last stop, editable");
  ok(/far = pts\[0\]; xy = away;/.test(ui) && /homeflag/.test(ui), "trip maps zoom to the stops when home is far away");
  const html = read("index.html");
  ok(/<script src="weather-core\.js"><\/script>\s*<script src="trips-core\.js"><\/script>/.test(html) && /"weather-core\.js"/.test(read("sw.js")), "weather-core loads before trips-core and is cached offline");
  ok(/connect-src [^;]*https:\/\/api\.open-meteo\.com https:\/\/archive-api\.open-meteo\.com;/.test(html), "CSP allows only the two Open-Meteo hosts for weather");
}

{ // v1.8: Trips to plan (family wishlist)
  const WS = require("../travel-log/app/wish-core.js");
  const kid = { id: "p_kid", name: "Zz Test Kid", nickname: "Zz Roo", role: "kid", states: {}, places: {}, parks: {} };
  const mom = { id: "p_mom", name: "Zz Test Parent", role: "adult", states: { FL: { at: "2020-01-01" } }, places: {}, parks: { zion: { at: "2019-05-01" } } };
  const fam = [kid, mom];
  const edi = { name: "Edinburgh", kind: "city", lat: 55.953, lon: -3.189, country: "GBR", region: "SCT", sub: "Scotland, United Kingdom" };
  const w1 = WS.addWish(kid, edi, "  I want to see a real castle! ", [], fam, "2026-10-23T12:00:00.000Z");
  ok(/^wish_/.test(w1.id) && w1.note === "I want to see a real castle!" && w1.at === "2026-10-23", "wish: added with a clean note and date");
  ok(kid.wv[w1.id].v === 1, "wish: the person who adds a place votes for it");
  let L = WS.list(fam, [], "2026-10-23");
  ok(L.open.length === 1 && L.open[0].votes.length === 1 && L.open[0].owner === "p_kid", "wish: on the list with one vote");
  throws(() => WS.addWish(mom, { name: "Edinburgh", kind: "city", lat: 55.95, lon: -3.2, country: "GBR" }, "", L.open, fam), /already on the list/, "wish: no duplicates");
  throws(() => WS.addWish(mom, null, "", [], fam), /Pick a place/, "wish: needs a place");
  ok(WS.toggleVote(mom, w1.id) === true && WS.toggleVote(mom, w1.id) === false && WS.toggleVote(mom, w1.id) === true, "wish: vote toggles");
  ok(WS.cleanVotes({ [w1.id]: { v: 5, r: ["😍", "😍", "💩"] } })[w1.id].v === 1, "wish: a vote counts once");
  ok(WS.toggleReact(mom, w1.id, "😍") && WS.toggleReact(mom, w1.id, "🏔️") && !WS.toggleReact(mom, w1.id, "🏔️") && !WS.toggleReact(mom, w1.id, "💩"), "wish: reactions toggle, only the six");
  const zion = WS.addWish(mom, { name: "Zion National Park", kind: "park", ref: "zion", country: "USA", sub: "UT" }, "", WS.list(fam, [], "2026-10-23").open, fam, "2026-10-23T13:00:00.000Z");
  ok(zion.had && zion.had[0] === "p_mom", "wish: remembers who already had a park stamped");
  const fl = WS.addWish(mom, { name: "Florida", kind: "area", area: "state:FL", country: "USA", region: "FL" }, "", [], fam, "2026-10-23T14:00:00.000Z");
  const jp = WS.addWish(kid, { name: "Japan", kind: "area", area: "place:JPN", country: "JPN" }, "Sushi!", [], fam, "2026-10-23T15:00:00.000Z");
  L = WS.list(fam, [], "2026-10-23");
  ok(L.open[0].w.id === w1.id && L.open[0].votes.length === 2 && L.open[0].reacts["😍"].length === 1, "wish: most votes first, reactions counted");
  ok(L.made.length === 0, "wish: old stamps don't count as made it");
  const trip = { id: "trip_1", kidIds: ["p_kid", "p_mom"], date: "2027-06-01", endDate: "2027-06-10", done: true, createdAt: "2027-06-11T00:00:00Z",
    route: [{ name: "Orlando", lat: 28.5, lon: -81.4, country: "USA", region: "FL" }, { name: "Edinburgh", lat: 55.95, lon: -3.19, country: "GBR", region: "SCT" }] };
  L = WS.list(fam, [trip], "2027-06-12");
  ok(L.made.length === 1 && L.made[0].w.id === w1.id && L.made[0].made.how === "trip" && L.made[0].made.at === "2027-06-10", "wish: a finished trip there moves it to Made it");
  ok(!L.made.some(e => e.w.id === fl.id), "wish: home as the start of a trip isn't a visit");
  const planned = Object.assign({}, trip, { done: false, endDate: "2027-08-01" });
  ok(WS.list(fam, [planned], "2027-06-12").made.length === 0, "wish: a planned trip doesn't count yet");
  const oldTrip = Object.assign({}, trip, { date: "2025-06-01", endDate: "2025-06-10", createdAt: "2025-06-11T00:00:00Z" });
  ok(WS.list(fam, [oldTrip], "2027-06-12").made.length === 0, "wish: a trip from before it was added doesn't count");
  kid.places.JPN = { at: "2027-04-01" };
  L = WS.list(fam, [], "2027-06-12");
  ok(L.made.some(e => e.w.id === jp.id && e.made.how === "stamp" && e.made.who[0] === "p_kid"), "wish: stamping the country moves it to Made it");
  kid.parks.zion = { at: "" };
  ok(WS.list(fam, [], "2027-06-12").made.some(e => e.w.id === zion.id), "wish: a new person stamping the park counts");
  ok(WS.stopMatches({ kind: "area", area: "place:SCT" }, { country: "GBR", region: "SCT" }) && !WS.stopMatches({ kind: "area", area: "place:SCT" }, { country: "GBR", region: "ENG" }), "wish: UK nations match by region");
  const st = WS.tripStop(zion); ok(st.kind === "park" && st.ref === "zion" && st.name === "Zion National Park", "wish: Plan this trip stop");
  ok(WS.cleanWishes([{ name: "<x>", id: "bad id" }, { name: "" }, null]).length === 1, "wish: bad wishes are cleaned");
  ok(WS.cleanWish({ name: "X", kind: "area", area: "nope" }).kind === "city", "wish: an area needs an area id");
  const owner = WS.removeWish(fam, jp.id); ok(owner === kid && !kid.wishes.some(w => w.id === jp.id), "wish: remove from its owner");
  ok(WS.list(fam, [], "2027-06-12").open.every(e => e.w.id !== jp.id), "wish: removed wish and its votes are gone");
  ok(!/wishes|"wv"/.test(read("sync-core.js").match(/PERSON_SKIP = [^;]+/)[0]), "wish: wishes and votes sync with the person");
  const idx = read("index.html"), sw = read("sw.js");
  ok(idx.indexOf('src="wish-core.js"') > 0 && idx.indexOf('src="wish.js"') > idx.indexOf('src="wish-core.js"'), "wish: scripts in index.html");
  ok(/"wish-core\.js", "wish\.js"/.test(sw), "wish: scripts cached offline");
  ok(/family" && h\[1\] === "wishes"/.test(read("app.js")), "wish: #/family/wishes route");
}

setTimeout(() => {
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);

// ---------- cities / food & drink / pubs (spots.js) ----------
(function () {
  var SP = require("../travel-log/app/spots.js");
  ok(SP.LIST.cities.length >= 100 && SP.LIST.pubs.length >= 50 && SP.LIST.food.length >= 15, "spots: curated cities, pubs and food spots");
  var ids = {}; ["cities", "pubs", "food"].forEach(function (c) { SP.LIST[c].forEach(function (it) { ids[it.id] = (ids[it.id] || 0) + 1; }); });
  ok(Object.keys(ids).every(function (k) { return ids[k] === 1; }), "spots: ids are unique");
  var mom = { id: "kid_mom1", role: "adult", kid: false }, kid = { id: "kid_kid1", role: "kid", kid: true }, ppl = [mom, kid];
  var r = SP.applySpot(ppl, "c-edinburgh", ["kid_mom1", "kid_kid1"], { date: "2025-06-14" });
  ok(r.added.length === 2 && mom.spots["c-edinburgh"].with.length === 2 && kid.spots["c-edinburgh"].at === "2025-06-14", "spots: shared city stamp for both with the date");
  ok(SP.earned(kid, "cities").length === 1 && SP.counts(mom).cities === 1, "spots: counts and earned");
  SP.restore(ppl, r.undo); ok(!mom.spots["c-edinburgh"] && !kid.spots["c-edinburgh"], "spots: undo puts it back");
  SP.applySpot(ppl, "p-bow-bar", ["kid_mom1", "kid_kid1"], {}); kid.spots["p-bow-bar"] = { at: "" };
  ok(SP.earned(kid, "pubs").length === 0 && SP.earned(mom, "pubs").length === 1, "spots: pubs never show for kids");
  var e = SP.applyEntry(ppl, { name: "Stout", type: "beer", at: "2025-06-14", rating: 4, stamp: true }, ["kid_mom1", "kid_kid1"]);
  ok(SP.counts(kid).list === 0 && SP.counts(mom).list === 1 && SP.earned(mom, "pubs").length === 2, "spots: beer list entries hidden from kids, stamp made for grown-ups");
  SP.applyEntry(ppl, { name: "Beignets", type: "food", stamp: true }, ["kid_kid1"]);
  ok(SP.earned(kid, "food").length === 1 && SP.earned(kid, "food")[0].item.cat === "food", "spots: a food entry becomes a food stamp");
  SP.applyEntry(ppl, e.entry, []); ok(!mom.eats.some(function (x) { return x.name === "Stout"; }), "spots: removing an entry takes it off everyone");
  var trips = [{ id: "t1", kidIds: ["kid_mom1"], date: "2024-05-01", route: [{ lat: 55.95, lon: -3.2, date: "2024-05-02" }, { lat: 40, lon: -100 }] }];
  var sug = SP.fromTrips(mom, trips); ok(sug.length === 1 && sug[0].item.id === "c-edinburgh" && sug[0].date === "2024-05-02", "spots: trips offer the city stamp");
  var svg = SP.stampSVG(SP.BY["c-edinburgh"], "2025-06-14"); ok(/EDINBURGH/.test(svg) && /JUN 14, 2025/.test(svg) && !/undefined|NaN/.test(svg), "spots: stamp svg has name and date");
})();

// ---- Recently deleted trips (soft delete) + restore one trip from a backup. Zz Test data only. ----
(function () {
  const S = require("../travel-log/app/sync-core.js");
  const mom = M.newPerson({ name: "Zz Test Parent", role: "adult" }), kid = M.newPerson({ name: "Zz Test Kid", role: "kid" });
  const t1 = M.newTrip({ kidIds: [mom.id, kid.id], place: "Zz Testville", title: "Zz Test Beach Trip", date: "2024-06-08", favs: [{ cat: "pub", name: "Zz Test Pub" }] });
  const t2 = M.newTrip({ kidIds: [mom.id], place: "Zz Other Town", date: "2023-01-02" });
  const b = M.binTrip(t1, "2026-10-23T22:43:00.000Z");
  ok(b.deletedAt === "2026-10-23T22:43:00.000Z" && b.updatedAt === b.deletedAt && b.id === t1.id && b.favs[0].name === "Zz Test Pub" && !t1.deletedAt, "bin: soft delete keeps the whole trip, original untouched");
  let sp = M.splitTrips([b, t2], "2026-10-24T00:00:00Z");
  ok(sp.live.length === 1 && sp.live[0].id === t2.id && sp.bin.length === 1 && sp.purge.length === 0, "bin: deleted trip is hidden but kept");
  ok(M.binDaysLeft(b, "2026-10-24T00:00:00Z") === 30, "bin: 30 days left");
  sp = M.splitTrips([b, t2], "2026-11-23T00:00:00Z"); ok(sp.purge.length === 1 && !sp.bin.length, "bin: after 30 days it's purged");
  const u = M.unbinTrip(b, "2026-10-24T01:00:00.000Z"); ok(!("deletedAt" in u) && u.updatedAt === "2026-10-24T01:00:00.000Z", "bin: restore clears deletedAt with a fresh time");
  ok(M.tripLabel(t1) === "Zz Test Beach Trip" && M.tripLabel(t2) === "Zz Other Town", "bin: trip label is the name or the place");
  // sync: a soft delete is an ordinary edit (no tombstone, data kept), with no travelers so share links skip it
  const shadow = S.emptyShadow ? S.emptyShadow() : { people: {}, visits: {}, trips: {}, photos: {} };
  shadow.trips[t1.id] = t1.updatedAt; shadow.trips[t2.id] = t2.updatedAt;
  const plan = S.planPush({ people: [mom, kid], trips: [b, t2], photoIds: [] }, shadow, "fam");
  const row = plan.trips.filter(r => r.id === t1.id)[0];
  ok(row && row.deleted === false && row.data.deletedAt && row.data.favs[0].name === "Zz Test Pub" && row.traveler_ids.length === 0, "sync: soft delete pushes the full trip, not a blank tombstone");
  ok(plan.trips.length === 1, "sync: only the changed trip is pushed");
  // the v47 bug: a trip missing from the database (hard delete) became a blank tombstone
  const hard = S.planPush({ people: [mom, kid], trips: [t2], photoIds: [] }, shadow, "fam");
  ok(hard.trips.some(r => r.id === t1.id && r.deleted && JSON.stringify(r.data) === "{}"), "sync: (why v47 lost trips) a hard delete blanks the cloud copy");
  // other phones: pulling the soft-deleted row keeps the trip, just hidden
  const other = { people: [mom, kid], trips: [JSON.parse(JSON.stringify(t1))], photoIds: [] }, sh2 = { people: {}, visits: {}, trips: { [t1.id]: t1.updatedAt }, photos: {} };
  S.applyPull(other, sh2, { trips: [Object.assign({}, row, { server_at: "2026-10-23T22:43:01Z" })] });
  ok(other.trips.length === 1 && other.trips[0].deletedAt && other.trips[0].kidIds.length === 2, "sync: other phones keep the trip in their bin, travelers intact");
  // restore one trip from a backup: fresh time, only people still here, photo with it, people untouched
  const bk = M.readBackup(JSON.parse(JSON.stringify(M.makeBackup([mom, kid], [Object.assign({}, t1, { photoId: "photo_zzTest1" }), t2], [{ id: "photo_zzTest1", dataUrl: "data:image/jpeg;base64,AAAA" }], null, {}))));
  const r = M.tripFromBackup(bk, t1.id, [mom.id], "2026-10-24T02:00:00.000Z");
  ok(r.trip.updatedAt === "2026-10-24T02:00:00.000Z" && r.trip.kidIds.join() === mom.id && r.photo && r.photo.id === "photo_zzTest1" && !r.trip.deletedAt, "backup: one trip comes back with today's time, its photo, only people still here");
  ok(r.trip.favs && r.trip.favs[0].name === "Zz Test Pub", "backup: trip details come back");
  throws(() => M.tripFromBackup(bk, t1.id, ["kid_nobody1"]), /No one on/, "backup: refuses when none of its people are here");
  throws(() => M.tripFromBackup(bk, "trip_missing1", [mom.id]), /isn't in this backup/, "backup: unknown trip");
  // restored trip beats the cloud's newer tombstone (the server keeps the row with the later updated_at)
  ok(r.trip.updatedAt > "2026-10-23T22:43:00.000Z", "backup: restored trip is newer than the delete, so the cloud accepts it");
  const sh3 = { people: {}, visits: {}, trips: {}, photos: {} }, p3 = S.planPush({ people: [mom, kid], trips: [r.trip], photoIds: ["photo_zzTest1"] }, sh3, "fam");
  ok(p3.trips.length === 1 && !p3.trips[0].deleted && p3.trips[0].traveler_ids.join() === mom.id, "backup: restored trip is queued to sync with its traveler");
  // UI wiring: Delete trip is out of the pinned Save bar, the confirm names the trip, and it soft-deletes
  const tu = read("trips-ui.js");
  const bar = tu.slice(tu.indexOf('<div class="actions sticky">'), tu.indexOf('tdelzone'));
  ok(!/id="tdel"/.test(bar), "ui: Delete trip is not in the sticky Save bar");
  ok(/moved to Recently deleted/.test(tu) && /M\.tripLabel\(old\)/.test(tu) && /A_\.trashTrip\(old\)/.test(tu) && !/A_\.del\("trips", old\.id\)/.test(tu), "ui: confirm names the trip and the delete is a soft delete");
  const sj = read("spots.js"); ok(!/del\(\s*"trips"/.test(sj) && !/state\.trips\s*=/.test(sj), "ui: pubs/food code never touches trips");
  const aj = read("app.js"); ok(/viewDeleted/.test(aj) && /bindOneTrip/.test(aj) && /M\.splitTrips/.test(aj), "ui: Recently deleted page and restore-one-trip are wired");
})();

// ---- v49: Restore everything keeps every field (wish lists, newer features) and never loses fields already on the phone ----
(() => {
  const pz = { id: "person_zz0000000000test", name: "Zz Test", role: "adult", birthYear: null, color: M.COLORS[1], states: { WI: { at: "2020-01-01" } }, places: {}, parks: {},
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", wv: { n: 3 }, wishes: [{ id: "w1", place: "Zz Test Town" }] };
  const pk = { id: "person_zz0000000000kidd", name: "Zz Test Kid", role: "kid", relationship: "kid", birthYear: 2018, color: M.COLORS[2], states: {}, places: {}, parks: {},
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", nickname: "Zz" };
  const tz = Object.assign(M.newTrip({ id: "trip_zz0000000000test", kidIds: [pz.id], place: "Zz Test Town", date: "2026-02-02", now: "2026-02-02T00:00:00.000Z" }), { zzExtra: { big: "x".repeat(5000) } });
  const ph = { id: "photo_zz0000000000test", dataUrl: px, caption: "Zz Test" };
  const file = { app: M.APP_ID, version: 4, exportedAt: "2026-02-03T00:00:00.000Z", kids: [pz, pk], trips: [tz], photos: [ph], settings: {} };
  const d = M.readBackup(JSON.parse(JSON.stringify(file)));
  const P = d.kids.find(k => k.id === pz.id);
  ok(JSON.stringify(P.wishes) === JSON.stringify(pz.wishes) && P.wv.n === 3, "restore keeps wishes and wv on a person");
  ok(!("relationship" in P), "restore doesn't invent a relationship the file didn't have");
  ok(M.relOf(P) === "parent", "a person with no relationship still shows the default");
  ok(d.kids.find(k => k.id === pk.id).relationship === "kid" && d.kids.find(k => k.id === pk.id).nickname === "Zz", "a set relationship and nickname come back as they were");
  ok(d.trips[0].zzExtra && d.trips[0].zzExtra.big.length === 5000, "big unknown trip fields come back");
  ok(d.photos[0].caption === "Zz Test", "unknown photo fields come back");
  ok(d.present && d.present.kids[pz.id].indexOf("wishes") >= 0 && d.present.kids[pz.id].indexOf("relationship") < 0, "readBackup says which fields the file really had");
  // merge onto what's on the phone
  const local = Object.assign(JSON.parse(JSON.stringify(pz)), { relationship: "dad", localOnly: { keep: true } });
  const thin = { app: M.APP_ID, version: 4, kids: [{ id: pz.id, name: "Zz Test", role: "adult", states: { FL: { at: "2026-03-01" } } }], trips: [], photos: [] };
  const dt = M.readBackup(thin), m = M.mergeRestore(local, dt.kids[0], dt.present.kids[pz.id]);
  ok(m.relationship === "dad" && m.localOnly.keep && JSON.stringify(m.wishes) === JSON.stringify(pz.wishes) && m.wv.n === 3, "merge keeps local fields the file doesn't have");
  ok(m.states.FL && (!pz.states.WI || m.states.WI), "merge takes the file's stamps and (v62) keeps the phone's own");
  ok(M.mergeRestore(null, dt.kids[0], dt.present.kids[pz.id]) === dt.kids[0], "a new person comes in whole");
  const same = M.readBackup(JSON.parse(JSON.stringify(file)));
  const again = M.mergeRestore(pz, same.kids[0], same.present.kids[pz.id]);
  ok(JSON.stringify(Object.keys(again).sort().map(k => [k, again[k]])) === JSON.stringify(Object.keys(pz).sort().map(k => [k, pz[k]])), "restoring the same backup changes nothing about a person");
  const lt = Object.assign(JSON.parse(JSON.stringify(tz)), { kidIds: [pz.id, pk.id] });
  const mt = M.mergeRestore(lt, Object.assign({}, d.trips[0], { kidIds: [pz.id] }), d.present.trips[tz.id]);
  ok(mt.kidIds.join() === [pz.id, pk.id].join(), "merge never takes people off a trip");
  const aj = read("app.js"); ok(/M\.mergeRestore\(/.test(aj) && /data\.present/.test(aj), "ui: Restore everything merges instead of overwriting");

})();

// ---- v50: reviewing trips made from photos (drafts) ----
(() => {
  const zid = "person_zz0000000000test", now0 = "2026-10-24T13:00:00.000Z";
  const mk = (o) => Object.assign(M.newTrip({ id: o.id, kidIds: [zid], place: o.place || "Zz Test Town", title: o.title || "", date: "2020-05-01", now: now0 }), o.extra || {});
  const flag = mk({ id: "trip_zzdraft000000001", title: "Zz Test Beach", extra: { draft: true } });
  const named = mk({ id: "trip_zzdraft000000002", title: "Draft: Zz Test Lake" });
  const lower = mk({ id: "trip_zzdraft000000003", title: "  draft:Zz Test Hill" });
  const plain = mk({ id: "trip_zzdraft000000004", title: "Zz Test Drafty Cabin" });
  const gone = mk({ id: "trip_zzdraft000000005", title: "Draft: Zz Gone", extra: { deletedAt: now0 } });
  ok(M.isDraft(flag) && M.isDraft(named) && M.isDraft(lower), "draft:true or a 'Draft:' name is a draft");
  ok(!M.isDraft(plain) && !M.isDraft(gone) && !M.isDraft(null) && !M.isDraft(Object.assign({}, flag, { draft: false })), "plain, deleted and reviewed trips aren't drafts");
  ok(M.draftTrips([flag, named, lower, plain, gone]).length === 3, "draftTrips counts 3");
  const r = M.reviewTrip(named, "2026-10-25T10:00:00.000Z");
  ok(r.draft === false && r.title === "Zz Test Lake" && !M.isDraft(r), "Looks good clears draft and the 'Draft:' prefix");
  ok(r.updatedAt === "2026-10-25T10:00:00.000Z" && r.reviewedAt === r.updatedAt, "Looks good bumps updatedAt so it syncs");
  ok(named.title === "Draft: Zz Test Lake", "review returns a copy, original untouched");
  ok(M.reviewTrip(lower).title === "Zz Test Hill" && M.reviewTrip(flag).title === "Zz Test Beach", "prefix trimmed in any case; titles without one stay");
  const dp = M.reviewTrip(mk({ id: "trip_zzdraft000000006", place: "Draft: Zz Place", title: "Draft: Zz Place" }));
  ok(dp.place === "Zz Place" && dp.title === "Zz Place", "a 'Draft:' place is cleaned too");
  // the same photo file restored again must not undo a review
  const fileTrip = Object.assign({}, named, { draft: true });
  const file = { app: M.APP_ID, version: 4, kids: [{ id: zid, name: "Zz Test", role: "adult" }], trips: [fileTrip], photos: [] };
  const d = M.readBackup(JSON.parse(JSON.stringify(file)));
  const local = M.reviewTrip(Object.assign({}, named, { draft: true, memory: "Zz Test edit" }), "2026-10-25T10:00:00.000Z");
  const m = M.mergeRestore(local, d.trips[0], d.present.trips[named.id]);
  ok(!M.isDraft(m) && m.title === "Zz Test Lake" && m.memory === "Zz Test edit" && m.updatedAt === local.updatedAt, "restoring the draft file again keeps the reviewed trip");
  const local2 = Object.assign({}, local, { kidIds: [] });
  ok(M.mergeRestore(local2, d.trips[0], d.present.trips[named.id]).kidIds.join() === zid, "a newer local trip can still gain people from the file");
  const older = Object.assign({}, local, { updatedAt: "2026-01-01T00:00:00.000Z" });
  ok(M.isDraft(M.mergeRestore(older, d.trips[0], d.present.trips[named.id])), "a file newer than the phone's copy still wins (v49 behaviour)");
  // UI wiring
  const aj = read("app.js"), tu = read("trips-ui.js");
  ok(/Needs review/.test(tu) && /data-review=/.test(tu) && /Looks good/.test(tu), "ui: draft cards show Needs review and Looks good");
  ok(/id="treview"/.test(tu) && /Mark as reviewed/.test(tu) && /M\.reviewTrip\(trip\)/.test(tu), "ui: trip editor has Mark as reviewed");
  ok(/To review \(/.test(aj) && /\/trips\/review/.test(aj) && /sub === "review"/.test(aj), "ui: Trips list has a To review filter");
  ok(/from your photos to review/.test(aj) && /reviewNudge\(\)/.test(aj), "ui: Home nudges when there are drafts");
  ok(/\[data-review\]/.test(aj) && /M\.reviewTrip\(t\)/.test(aj) && /put\("trips", u\)/.test(aj), "ui: Looks good saves the reviewed trip");
  { const av = (aj.match(/var VERSION = "v(\d+)"/) || [])[1], sv = (read("sw.js").match(/mltl-v(\d+)/) || [])[1];
    ok(av && av === sv && +av >= 50, "app.js VERSION and sw.js cache match (v" + av + " / mltl-v" + sv + ")"); }
})();

// ---- v51: On this day ----
(() => {
  const zid = "person_zz0000000000test";
  const mk = (id, o) => Object.assign({ id, kidIds: [zid], place: "Zz Place", title: "", route: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, o);
  const trips = [mk("trip_zzotd000000001", { date: "2023-10-22", endDate: "2023-10-26", title: "Zz Rome" }),
    mk("trip_zzotd000000002", { date: "2019-10-20", nights: 4, place: "Zz Nights" }),
    mk("trip_zzotd000000003", { date: "2026-10-24", place: "Zz This Year" }),
    mk("trip_zzotd000000004", { date: "2024-10-24", place: "Zz Gone", deletedAt: "2026-01-01T00:00:00.000Z" }),
    mk("trip_zzotd000000005", { date: "2016-02-29", place: "Zz Leap" }),
    mk("trip_zzotd000000006", { date: "2020-12-30", endDate: "2021-01-02", place: "Zz NYE" }),
    mk("trip_zzotd000000007", { date: "2025-10-24", title: "Draft: Zz Lake", draft: true }),
    mk("trip_zzotd000000008", { date: "", place: "Zz Undated" })];
  const h = M.onThisDay(trips, "2026-10-24");
  ok(h.map(x => x.trip.id.slice(-1)).join() === "7,1,2", "on this day: past years only, most recent first, deleted/this-year/undated skipped (" + h.map(x => x.trip.id.slice(-1)).join() + ")");
  ok(M.onThisDayLine(h[1]) === "3 years ago today you were in Zz Rome", "on this day line: '3 years ago today you were in Zz Rome'");
  ok(M.onThisDayLine(h[0]) === "1 year ago today you were in Zz Lake", "one year, and a draft's name without 'Draft:'");
  ok(M.onThisDay(trips, "2026-10-27").length === 0, "nothing when no trip was on that date");
  ok(M.onThisDay(trips, "2026-02-28").length === 1 && M.onThisDay(trips, "2028-02-29").length === 1 && M.onThisDay(trips, "2028-02-28").length === 0, "Feb 29 trips show on Feb 28 in non-leap years");
  ok(M.onThisDay(trips, "2027-01-01").some(x => x.trip.place === "Zz NYE" && x.years === 6), "a trip over New Year counts in the year it was on that date");
  ok(M.onThisDay([], "2026-10-24").length === 0 && M.onThisDay(null).length === 0, "no trips, no card");
  const aj = read("app.js"); ok(/onThisDayCard\(\)/.test(aj) && /On this day/.test(aj) && /if \(!hits\.length\) return ""/.test(aj), "ui: Home shows On this day only when there's something");
})();

// ---- v52: year in review: miles, nights, flights, farthest trip, places new to us ----
{
  const Y = require("../travel-log/app/year.js");
  const z = M.newKid({ name: "Zz Test", birthYear: 2016 });
  z.states = { WI: { at: "2024-05-01" } };
  const city = (name, lat, lon, region) => ({ name, kind: "city", lat, lon, country: "USA", region });
  const MAD = city("Zz Madison", 43.07, -89.4, "WI"), CHI = city("Zz Chicago", 41.88, -87.63, "IL"), YEL = city("Zz Yellowstone", 44.6, -110.5, "WY");
  const trips = [M.newTrip({ id: "trip_zzyear00000001", kidIds: [z.id], place: "Zz Chicago", date: "2026-03-10", endDate: "2026-03-12", route: [MAD, CHI], roundTrip: true }),
                 M.newTrip({ id: "trip_zzyear00000002", kidIds: [z.id], place: "Zz West", title: "Draft: Zz West", date: "2026-07-01", nights: 5, route: [MAD, YEL] }),
                 Object.assign(M.newTrip({ id: "trip_zzyear00000003", kidIds: [z.id], place: "Zz Gone", date: "2026-08-01", route: [MAD, YEL] }), { deletedAt: "2026-09-01T00:00:00.000Z" })];
  const s = Y.summary([z], trips, 2026);
  ok(s.trips === 2, "year review skips trips in Recently deleted (" + s.trips + ")");
  ok(s.miles > 1000 && s.miles < 1600, "miles add up across the year's trips (" + s.miles + ")");
  ok(s.nights === 7, "nights add up: 2 + 5 (" + s.nights + ")");
  ok(s.farthest && s.farthest.id === "trip_zzyear00000002" && s.farthest.label === "Zz West", "farthest trip named without 'Draft:' (" + JSON.stringify(s.farthest) + ")");
  ok(s.newPlaces === s.stamps.filter(x => !(x.kind === "state" && x.area === "WI")).length && s.newPlaces >= 1, "WI colored in 2024 isn't new in 2026; the others are (" + s.newPlaces + ")");
  const e = Y.summary([z], [], 2026); ok(e.miles === 0 && e.nights === 0 && e.farthest === null, "an empty year has no miles or farthest trip");
  const yj = read("year.js"); ok(/extraLine\(sum\)/.test(yj) && /yr-facts/.test(yj) && /unitWord\(\)/.test(yj), "ui: card and page show miles and the extra facts");
}

// ---- v53: plan next trip: countdown on Home, Stamp a stop while you're on it ----
{
  const zid = "person_zz0000000000test";
  const mk = (id, o) => Object.assign({ id, kidIds: [zid], place: "Zz Place", title: "", route: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, o);
  const trips = [mk("trip_zzplan00000001", { date: "2026-11-05", title: "Trip to Zz Rome" }),
    mk("trip_zzplan00000002", { date: "2026-10-25", title: "Zz Tomorrow" }),
    mk("trip_zzplan00000003", { date: "2026-10-22", endDate: "2026-10-28", title: "Zz Now" }),
    mk("trip_zzplan00000004", { date: "2026-12-01", title: "Draft: Zz Draft", draft: true }),
    mk("trip_zzplan00000005", { date: "2026-12-02", title: "Zz Deleted", deletedAt: "2026-10-01T00:00:00.000Z" }),
    mk("trip_zzplan00000006", { date: "2026-10-20", nights: 2, title: "Zz Over" })];
  const up = M.upcoming(trips, "2026-10-24");
  ok(up.map(x => x.trip.id.slice(-1)).join() === "2,1", "upcoming: future trips soonest first, no drafts or deleted (" + up.map(x => x.trip.id.slice(-1)).join() + ")");
  ok(M.countdownLine(up[1]) === "Trip to Zz Rome in 12 days" && M.countdownLine(up[0]) === "Zz Tomorrow is tomorrow!", "countdown lines");
  const now = M.onTripNow(trips, "2026-10-24");
  ok(now.length === 1 && now[0].trip.id.endsWith("3") && now[0].day === 3 && now[0].of === 7, "on a trip now: day 3 of 7");
  ok(M.onTripNow(trips, "2026-10-22").map(x => x.trip.id.slice(-1)).sort().join() === "3,6", "a trip with nights counts until it ends");
  ok(M.onTripNow([], "2026-10-24").length === 0 && M.upcoming(null).length === 0, "no trips, no cards");
  const aj = read("app.js"), tu = read("trips-ui.js");
  ok(/tripsAheadCard\(\)/.test(aj) && /data-quickstamp/.test(aj) && /Stamp a stop/.test(aj) && /FS_FOCUS_STOP/.test(tu), "ui: Home countdown and Stamp a stop go to adding a stop");
  ok(/d\.date = ""; d\.plan = true/.test(tu) && /Home counts down/.test(tu), "ui: Plan this trip starts with no date and says Home counts down");
}

// ---- v54: kid milestones ----
{
  const F = require("../travel-log/app/firsts.js");
  const kid = M.newKid({ name: "Zz Kid", birthYear: 2018 });
  const st = ["WI", "IL", "MN", "IA", "MI", "OH", "IN"], dates = ["2019-06-01", "2020-07-01", "2021-07-01", "2022-07-01", "2022-08-01", "2023-07-01", "2026-07-01"];
  kid.states = {}; st.forEach((id, i) => kid.states[id] = { at: dates[i] });
  kid.parks = { yell: { at: "2022-07-04" }, "sp-zz": { at: "2021-01-01" } };
  const fl = [{ id: "trip_zzms000000001", kidIds: [kid.id], place: "Zz Flight", date: "2021-03-01", route: [{ name: "A" }, { name: "B", mode: "plane" }] }];
  const ms = F.milestones(kid, fl, { home: { country: "USA", region: "WI" } }, "2026-10-24");
  const t = ms.done.map(x => x.text);
  ok(t.indexOf("First national park at age 4") >= 0, "first national park at age 4 (" + t.join(" | ") + ")");
  ok(t.indexOf("First flight at age 3") >= 0, "first flight at age 3");
  ok(t.indexOf("5 states before 5!") >= 0 && ms.done.find(x => x.key === "state-5").at === "2022-08-01", "5 states before 5, reached on the 5th state's date");
  ok(ms.next[0] && ms.next[0].text === "10 states before 10" && ms.next[0].have === 7 && ms.next[0].yearsLeft === 2, "next up: 10 states before 10, 7 of 10, 2 years to go (" + JSON.stringify(ms.next[0]) + ")");
  ok(ms.next.some(x => x.text === "5 national parks before 5") === false && ms.next.some(x => x.text === "10 national parks before 10" && x.have === 1), "state parks don't count toward national parks; 5-before-5 is past");
  const q = F.milestones(kid, [], { quests: () => [{ at: "2024-05-01" }], stamps: () => [{ kind: "state", area: "CA", date: "2025-01-01" }] }, "2026-10-24");
  ok(q.done.some(x => x.text === "First quest finished at age 6") && q.next[0].have === 8, "quests and trip stamps count");
  ok(F.milestones(Object.assign({}, kid, { role: "adult" }), [], {}, "2026-10-24").done.length === 0 && F.milestones(M.newKid({ name: "Zz NoYear" }), [], {}, "2026-10-24").next.length === 0, "no milestones for grown-ups or without a birth year");
  const undated = Object.assign(M.newKid({ name: "Zz U", birthYear: 2020 }), { states: { WI: {}, IL: {}, MN: {}, IA: {}, MI: {} } });
  ok(F.milestones(undated, [], {}, "2024-06-01").done.some(x => x.text === "5 states before 5!"), "undated states count while the kid is still under the age");
  ok(/Milestones/.test(read("firsts.js")) && /msbar/.test(read("firsts.js")) && /Next: /.test(read("firsts.js")), "ui: milestones on the Firsts page and the badge card");
}

// ---- v55: What's near me (opt-in, foreground only, location never stored) ----
{
  const places = require("../travel-log/app/data/places.json");
  const d = { rows: places.rows.split("\n").map(l => { const c = l.split("\t"); return { name: c[0], lat: +c[2], lon: +c[3], country: c[4], admin1: c[5] }; }), countries: places.countries, admin: places.admin };
  const zz = Object.assign(M.newKid({ name: "Zz Test" }), { parks: { yellowstone: { at: "2020-01-01" } }, states: {} });
  const r = M.nearby({ lat: 44.43, lon: -110.59 }, d, [zz], 30, () => "WY");
  ok(r.items.some(x => x.kind === "park" && x.id === "yellowstone" && x.who.join() === zz.id && x.miles <= 30), "near Old Faithful: Yellowstone, already stamped by Zz Test");
  ok(r.items[0].kind === "state" && r.items[0].id === "WY" && r.items[0].who.length === 0, "the state comes from the map shape when known (WY, not the nearest town's MT)");
  ok(M.nearby({ lat: 44.43, lon: -110.59 }, d, [zz], 30).items[0].id === "MT", "without map shapes it falls back to the nearest town's state");
  const rome = M.nearby({ lat: 41.9, lon: 12.5 }, d, [], 30);
  ok(rome.items.length === 1 && rome.items[0].id === "ITA" && rome.items[0].name === "Italy", "abroad: the country");
  ok(M.nearby({ lat: 30, lon: -40 }, d, [zz]).items.length === 0 && M.nearby(null, d, []).items.length === 0, "mid-ocean or no point: nothing");
  ok(M.nearby({ lat: 44.43, lon: -110.59 }, null, [zz]).items.some(x => x.id === "yellowstone"), "parks work even before the place list loads");
  const nj = read("near.js");
  ok(/getCurrentPosition/.test(nj) && !/watchPosition/.test(nj) && !/setMeta\("near(Last|Point|Loc)/.test(nj) && !/localStorage|sessionStorage|fetch\(/.test(nj), "near.js asks once per tap, never watches, saves or sends the location");
  ok(/permissions\.query/.test(nj) && /p\.state !== "granted"/.test(nj) && /visibilityState !== "visible"/.test(nj) && /nearAuto/.test(nj), "auto check is opt-in, foreground, and never prompts on its own");
  ok(/isn\\'t saved in your log, isn\\'t synced and isn\\'t sent anywhere/.test(nj), "the permission explanation is on the page");
  ok(/near\.js/.test(read("index.html")) && /"near\.js"/.test(read("sw.js")) && /h\[0\] === "near"/.test(read("app.js")), "near.js is loaded, cached offline and routed");
}

// ---- v56: Family cup (friendly, on-device ranking) ----
{
  const W = { countries: [{ id: "USA", cont: "NA" }, { id: "ITA", cont: "EU" }, { id: "FRA", cont: "EU" }] };
  const mk = (name, extra) => Object.assign(M.newKid({ name }), { states: {}, places: {}, parks: {} }, extra);
  const a = mk("Zz Kid", { states: { WI: { at: "2026-06-01" }, IL: { at: "2026-06-02" }, MN: { at: "2020-01-01" } }, parks: { yellowstone: { at: "2026-07-04" } } });
  const b = mk("Zz Cousin", { states: { WI: { at: "2019-06-01" }, IL: { at: "2019-06-01" }, MN: { at: "2019-01-01" } }, places: { ITA: { at: "2018-05-01" } } });
  const c = mk("Zz Baby", {});
  const trips = [{ id: "trip_zz1", kidIds: [a.id, b.id], date: "2026-06-01", title: "Zz Trip", place: "Zz", route: [] },
                 { id: "trip_zz2", kidIds: [a.id], date: "2026-07-04", title: "Draft: Zz Photo trip", place: "Zz", route: [] }];
  const cup = M.familyCup([a, b, c], trips, W, "2026");
  const cat = id => cup.cats.find(x => x.id === id);
  ok(cat("states").rows[0].rank === 1 && cat("states").rows[1].rank === 1 && cat("states").rows[2].rank === 3, "ties share a place (3 and 3 states are both #1, next is #3)");
  ok(cat("year").rows[0].id === a.id && cat("year").rows[0].val === 3, "new stamps this year counts states and parks first stamped this year");
  ok(cat("trips").rows.find(r => r.id === a.id).val === 1, "draft trips don't count in the cup");
  ok(!cup.cats.some(x => x.id === "miles"), "a category nobody has yet is hidden");
  ok(cup.cheers[a.id] === "Leads in new stamps this year and national parks" && cup.cheers[b.id] === "Leads in countries" && cup.cheers[c.id] === "Ready for a first stamp", "everyone gets a cheer: " + JSON.stringify(Object.values(cup.cheers)));
  const app = read("app.js");
  ok(/h\[1\] === "cup"\) return viewCup\(\)/.test(app) && /cupCard\(\) \+/.test(app) && /isn\\'t compared with anyone else/.test(app), "the cup page is routed, linked from Family, and says it stays in the family");
}

// ---- v57: This month in past years (fallback when nothing matches today's date) ----
{
  const t = (id, date, title, endDate, extra) => Object.assign({ id: "trip_zz" + id, date, title, endDate: endDate || "", kidIds: ["person_zz1"], route: [], place: title }, extra || {});
  const trips = [t("1", "2025-10-03", "Zz Poynette"), t("2", "2026-10-15", "Zz Bay Lake", "2026-10-17"), t("3", "2013-10-05", "Draft: Zz Old", "", { draft: true }),
    t("4", "2021-09-28", "Zz Span", "2021-10-02"), t("5", "2022-11-01", "Zz Nov"), t("6", "2019-10-30", "Zz Gone", "", { deletedAt: "2026-01-01T00:00:00Z" }),
    t("7", "2019-10-01", "Zz Early"), t("8", "2019-10-20", "Zz Late"), t("9", "", "Zz Undated")];
  const m = M.onThisMonth(trips, "2026-10-24");
  ok(M.onThisDay(trips, "2026-10-24").length === 0, "fixture: nothing on Oct 24 itself");
  ok(m.map(M.onThisMonthLine).join("|") === "October 2025: Zz Poynette|October 2021: Zz Span|October 2019: Zz Late|October 2019: Zz Early|October 2013: Zz Old",
     "newest year first, later trip first within a year: " + m.map(M.onThisMonthLine).join("|"));
  ok(!m.some(x => x.trip.id === "trip_zz2"), "this year's October trip (Zz Bay Lake 2026) is not a past year");
  ok(m.some(x => x.trip.id === "trip_zz3" && x.label === "Zz Old"), "draft trips count, shown without 'Draft:'");
  ok(m.some(x => x.trip.id === "trip_zz4" && x.year === 2021), "a Sep 28 to Oct 2 trip counts for October");
  ok(!m.some(x => /Nov|Gone|Undated/.test(x.label)), "other months, deleted and undated trips are left out");
  const ny = M.onThisMonth([t("a", "2024-12-28", "Zz New Year", "2025-01-02")], "2026-01-10");
  ok(ny.length === 1 && ny[0].year === 2025 && M.onThisMonthLine(ny[0]) === "January 2025: Zz New Year", "a trip over New Year counts for January of the next year");
  ok(M.onThisMonth(trips, "2026-03-05").length === 0, "an empty month gives nothing (card hidden)");
  const app = read("app.js");
  ok(/if \(!hits\.length\) return onThisMonthCard\(\);/.test(app) && /hits\.slice\(0, 5\)/.test(app) && /This month in past years/.test(app), "Home falls back to the month card, capped at 5 with 'and N more'");
}

// ---- v58: food & drink tied to trips, travel hubs (airports + train stations) ----
{
  const SP = require("../travel-log/app/spots.js");
  ok(SP.LIST.hubs.length >= 50 && SP.LIST.hubs.every(x => /^h-/.test(x.id) && x.cat === "hubs"), "hubs catalog: " + SP.LIST.hubs.length + " airports and stations");
  ok(!SP.CATS.hubs.adult && SP.CATS.pubs.adult, "hubs are for everyone; pubs stay adults-only");
  ok(SP.airportId("ord") === "h-air-ord" && SP.airportItem({ code: "ORD", name: "x" }).name === "O'Hare", "a curated airport resolves by code");
  const dyn = SP.airportItem({ code: "BRU", name: "Brussels Airport", city: "Brussels" });
  ok(dyn.id === "h-air-bru" && dyn.dyn && dyn.name === "Brussels airport" && /^BRU · Brussels/.test(dyn.sub), "any other airport becomes its own stamp: " + dyn.name);
  const t = { id: "trip_zz58", date: "2026-03-10", kidIds: ["person_zz1"], route: [{ name: "Zz Madison", lat: 43.07, lon: -89.4, nights: 2 },
    { name: "Zz Chicago", lat: 41.88, lon: -87.63, mode: "plane", nights: 1, dep: { code: "MSN", name: "Zz Field" }, arr: { code: "ORD", name: "Zz" } },
    { name: "Zz Dublin", lat: 53.345, lon: -6.26, mode: "plane", dep: { code: "ORD" }, arr: { code: "BRU", name: "Brussels Airport" } }] };
  const g = SP.tripStamps(t, true), ids = [].concat(...g.map(x => x.items.map(i => i.id)));
  ok(["h-air-msn", "h-air-ord", "h-air-bru", "c-chicago", "c-dublin"].every(i => ids.includes(i)), "a trip offers its airports and cities as stamps");
  ok(ids.filter(i => i === "h-air-ord").length === 1, "an airport used twice is offered once");
  ok(ids.some(i => /^p-/.test(i)) && !SP.tripStamps(t, false).some(x => x.items.some(i => i.cat === "pubs")), "pubs offered on grown-up pages only");
  ok(g.find(x => x.stop === "Zz Dublin").date === "2026-03-13", "a stop's day = trip start + nights before it");
  ok(g.find(x => x.stop === "✈️ ORD → BRU").date === "2026-03-13" && g.find(x => x.stop === "✈️ MSN → ORD").date === "2026-03-12", "each flight is its own group on the day it lands");
  const e = SP.cleanEntry({ name: "Zz Pie", type: "food", tripId: "trip_zz58", link: "c-chicago" });
  ok(e.tripId === "trip_zz58" && e.link === "c-chicago", "an entry keeps its trip and its linked stamp");
  ok(!SP.cleanEntry({ name: "Zz", tripId: "bad id", link: "javascript:x" }).tripId && !SP.cleanEntry({ name: "Zz", link: "javascript:x" }).link, "bad trip/link values are dropped");
  const gr = SP.groupByTrip([{ id: "e_1", tripId: "trip_zz58" }, { id: "e_2" }, { id: "e_3", tripId: "trip_gone" }, { id: "e_4", tripId: "trip_zzold" }],
    [t, { id: "trip_zzold", date: "2020-01-01" }]);
  ok(gr.map(x => x.trip ? x.trip.id : "-").join() === "trip_zz58,trip_zzold,-" && gr[2].entries.length === 2, "list groups by trip, newest first; loose entries last");
  // mergeRestore unions eats and spots
  const mine = { id: "person_zz1", name: "Zz A", updatedAt: "2026-01-02", eats: [{ id: "e_aaaaaa", name: "Zz Mine" }, { id: "e_cccccc", name: "Zz Edited" }], spots: { "c-chicago": { at: "2026-03-12" } } };
  const file = { id: "person_zz1", name: "Zz A", updatedAt: "2026-01-01", eats: [{ id: "e_bbbbbb", name: "Zz File" }, { id: "e_cccccc", name: "Zz Old" }], spots: { "c-dublin": { at: "" }, "c-chicago": { at: "" } } };
  const r = M.mergeRestore(mine, file);
  ok(r.eats.length === 3 && r.eats.find(x => x.id === "e_cccccc").name === "Zz Edited", "restore keeps food & drink from both sides; newer phone edit wins");
  ok(r.spots["c-dublin"] && r.spots["c-chicago"].at === "2026-03-12", "restore keeps stamps from both sides");
  const r2 = M.mergeRestore(Object.assign({}, mine, { updatedAt: "2025-01-01" }), file);
  ok(r2.eats.find(x => x.id === "e_cccccc").name === "Zz Old" && r2.spots["c-chicago"].at === "", "when the file is newer, its version of the same entry wins");
  const sj = read("spots.js"), tu = read("trips-ui.js"), app = read("app.js");
  ok(/FS_SPOTS\.tripHTML\(k, t\)/.test(tu) && /FS_SPOTS\.bindTrip\(k, t,/.test(tu), "trip page shows its food & drink and stamps");
  ok(/id="etrip"/.test(sj) && /id="elink"/.test(sj) && /Goes with a stamp/.test(sj), "entry editor has Trip and Goes-with-stamp");
  ok(/\["hubs", "Travel hubs", "Hubs"\]/.test(app) && /c\.hubs, 0, "Travel hubs"/.test(app), "Parks tab has a Travel hubs segment and stat");
}

// ---- v59: every spot stamp has its own picture ----
{
  const SP = require("../travel-log/app/spots.js"), SAm = require("../travel-log/app/stamp-art.js");
  const all = [].concat(SP.LIST.cities, SP.LIST.hubs, SP.LIST.food, SP.LIST.pubs, [SP.airportItem({ code: "BRU", name: "Brussels Airport" }), SP.airportItem({ code: "YUL", name: "Montréal-Trudeau" })]);
  const seen = {}, dups = [];
  all.forEach(it => { const a = SP.artFor(it, 7); if (seen[a]) dups.push(it.id + "=" + seen[a]); seen[a] = it.id; });
  ok(dups.length === 0, "no two of the " + all.length + " city/hub/food/pub stamps share a picture: " + dups.slice(0, 5).join(", "));
  const clash = []; Object.keys(SAm.GLYPHS).forEach(k => [0, 1, 2].forEach(v => { if (seen[SAm.GLYPHS[k](v)]) clash.push(k); }));
  ok(clash.length === 0, "no spot stamp reuses a park, state or country picture: " + clash.join(","));
  const D = require("../travel-log/app/spots-data.js"), arts = [].concat(D.CITIES, D.PUBS, D.FOOD, D.HUBS).map(r => r[6]);
  ok(!arts.some(a => /^(x_|np_)|llama|giraffe|dragon|bison|bear|moose/.test(a)), "no park pictures or animal drawings on city/pub/food/hub stamps");
  ok(SP.artFor(SP.airportItem({ code: "ORD" }), 1).includes(">ORD<") && SP.artFor(SP.airportItem({ code: "BRU", name: "x" }), 1).includes(">BRU<"), "airport stamps carry their own code");
  const own = [0, 1, 2, 3].map(n => SP.artFor(SP.entryItem({ id: "e_zz" + n, name: "Zz", type: "food" }), 1000 + n * 7));
  ok(new Set(own).size === 4 && own.every(a => !seen[a]), "your own finds get their own variants, never a catalog picture");
  ok(/artFor\(it, h\)/.test(read("spots.js")), "stamps draw with artFor");
}

// ---------- v60: Highlights for grandparents + reactions ----------
{
  const H = require("../travel-log/app/highlights-core.js");
  const kid = { id: "person_zz00000000kid01", name: "Zz Kid", role: "kid", states: { CO: { at: "2026-07-02" } }, parks: { yell: { at: "2026-07-03", jr: true } },
    spots: { "p-zzpub": { at: "2026-07-03" }, e_zzbar: { at: "2026-07-03" }, den: { at: "2026-07-02" } } };
  const dad = { id: "person_zz0000000000test", name: "Zz Test", role: "adult", states: { NV: { at: "2026-07-09" } } };
  const gma = { id: "person_zz00000000gma01", name: "Zz Gma", role: "adult", relationship: "grandparent" };
  const trips = [{ id: "trip_zzhl0000000001", place: "Zz Yellowstone", date: "2026-07-04", kidIds: [kid.id, dad.id], photoId: "ph_zz1" },
    { id: "trip_zzhl0000000002", place: "Zz later", title: "Draft: Zz later", date: "2026-07-08", kidIds: [kid.id] }, { id: "trip_zzhl0000000003", place: "Zz gone", date: "2026-07-08", kidIds: [kid.id], deletedAt: "2026-07-09" },
    { id: "trip_zzhl0000000004", place: "Zz grown-ups", date: "2026-07-08", kidIds: [dad.id] }];
  const ctx = { name: (k, id) => "N:" + id, quests: () => [{ q: { id: "zzq", name: "Zz Quest", emoji: "🏅" }, at: "2026-07-04" }],
    firsts: () => [{ key: "flight", at: "2026-07-01", emoji: "✈️", title: "First flight" }], milestones: () => ({ done: [{ key: "first-flight", at: "2026-07-01", text: "dup" }, { key: "parks-1", at: "2026-07-03", emoji: "🏞️", text: "First park" }] }) };
  const f = H.feed([kid, dad, gma], trips, ctx);
  const refs = f.map(x => x.ref), all = JSON.stringify(f);
  ok(H.isGrand(gma) && H.isGrand({ role: "grand" }) && !H.isGrand(dad) && !H.isGrand(kid), "isGrand: relationship grandparent or role grand");
  ok(f.every(x => x.kidIds.every(id => id === kid.id)), "highlights: kids only, never grown-ups' stamps or trips");
  ok(!/p-zzpub|e_zzbar|N:p-|N:e_|NV/.test(all) && /N:den/.test(all), "highlights: pubs and your own finds never show; other stamps do");
  ok(refs.indexOf("t:trip_zzhl0000000001") >= 0 && !/zzhl0000000002|zzhl0000000003|zzhl0000000004/.test(refs.join()), "highlights: trips with kids, no drafts, deleted or adults-only");
  ok(f.find(x => x.ref === "t:trip_zzhl0000000001").photoId === "ph_zz1", "highlights: trip carries its cover photo");
  ok(refs.indexOf("jr:" + kid.id + ":yell") >= 0 && refs.indexOf("q:" + kid.id + ":zzq") >= 0 && refs.indexOf("f:" + kid.id + ":flight") >= 0 && refs.indexOf("m:" + kid.id + ":parks-1") >= 0 && !refs.some(r => /first-flight/.test(r)), "highlights: badges, quests, firsts, milestones (not duplicate firsts)");
  ok(f.every((x, i) => !i || f[i - 1].at >= x.at), "highlights: newest first");
  ok(H.feed([kid], trips, ctx, { since: "2026-07-04" }).every(x => x.at >= "2026-07-04"), "highlights: since filter");
  let rows = [], t = H.toggle(rows, "fam", "t:trip_zzhl0000000001", "heart", "u1", "2026-07-05T00:00:00Z");
  ok(t.on === true && t.rows.length === 1, "react: toggle on");
  rows = H.toggle(t.rows, "fam", "t:trip_zzhl0000000001", "clap", "u2").rows;
  rows = H.toggle(rows, "fam", "t:trip_zzhl0000000001", "heart", "u2").rows;
  const m = H.byItem(rows)["t:trip_zzhl0000000001"];
  ok(m.heart.length === 2 && m.clap.length === 1, "react: one per emoji per person, counts by emoji");
  ok(H.whoLine(m, u => ({ u1: "Grandma", u2: "Pop" })[u]) === "Grandma ❤️ · Pop ❤️👏", "react: who reacted with what");
  t = H.toggle(rows, "fam", "t:trip_zzhl0000000001", "heart", "u1");
  ok(t.on === false && !t.rows.some(r => r.user_id === "u1"), "react: toggle off removes only your own");
  ok(H.toggle(rows, "fam", "bad ref", "heart", "u1").on === null && H.toggle(rows, "fam", "t:trip_zz1", "poop", "u1").on === null, "react: bad ref/emoji refused");
  const sy = read("sync.js"), hj = read("highlights.js"), ix = read("index.html"), sw = read("sw.js");
  ok(/from\("reactions"\)\.delete\(\)\.eq\("family_id", fid\)\.eq\("user_id", uid\)/.test(sy), "reactions: delete is scoped to your own row");
  ok(/data-irole="grand"/.test(sy) && /&rel=grandparent/.test(sy) && /mltl-join-rel/.test(sy) && /role === "kid" \? "kid" : "adult"/.test(sy), "invite: grandparent option, sent as a grown-up invite + rel");
  ok(/href="#\/highlights">✨ Highlights/.test(sy), "family page links Highlights");
  ok(/highlights-core\.js[\s\S]*highlights\.js/.test(ix) && /"highlights-core\.js", "highlights\.js"/.test(sw), "highlights scripts loaded and cached");
  ok(/e\.missing\) status = "missing"/.test(hj) && !/innerHTML = [^;]*it\.title/.test(hj), "highlights: missing table hides reactions; text escaped");
}

// ---------- v61: push notifications (opt-in, per-type) ----------
{
  const P = require("../travel-log/app/push.js");
  ok(P.KINDS.map(k => k.id).join() === "reactions,grandkids,onthisday,countdown,nudge,recap", "push: the six types");
  ok(P.cleanKinds(["nudge", "bogus", "nudge", "recap"]).join() === "nudge,recap", "push: unknown/duplicate types dropped");
  ok(P.support({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", push: false, sw: true, notif: false, standalone: false }) === "ios-home", "push: iPhone not on Home Screen gets the Add to Home Screen note");
  ok(P.support({ ua: "Android Chrome", push: true, sw: true, notif: true }) === "ok" && P.support({ ua: "x", push: false, sw: false, notif: false }) === "no", "push: Android/Chrome supported, others not");
  const pv = P.previews({ next: { place: "Zz Rome", days: 5 }, past: { place: "Zz Canyon", years: 3 } });
  ok(pv.length === 6 && pv.find(x => x.kind === "countdown").title === "Zz Rome in 5 days 🧳 (preview)" && /Zz Canyon/.test(pv.find(x => x.kind === "onthisday").body), "push: previews use your own trips");
  const pj = read("push.js"), sw = read("sw.js"), sy = read("sync.js"), cf = read("sync-config.js"), ap = read("app.js");
  ok(/if \(!s\.on\) return h \+/.test(pj) && /kinds: \[\]/.test(pj) && !/requestPermission\(\)[\s\S]{0,40}load/.test(pj), "push: off until turned on, every type starts off");
  ok(/requestPermission/.test(pj) && /id="pushon"/.test(pj) && pj.indexOf("requestPermission") > pj.indexOf("function turnOn"), "push: permission only asked from the Turn on button");
  ok(/addEventListener\("push"/.test(sw) && /addEventListener\("notificationclick"/.test(sw) && /"push\.js"/.test(sw), "sw: shows pushes and opens the app on tap");
  ok(/pushKey: "B[A-Za-z0-9_-]{86}"/.test(cf) && !/private/i.test(cf.replace(/private half lives only in Supabase Vault/, "")), "config: only the public VAPID key ships");
  ok(/rpc\("push_save"/.test(sy) && /action: "test"/.test(sy), "sync: push_save + test call");
  ok(/FS_PUSH\.panel\(\)/.test(ap) && /FS_PUSH\.bind\(\)/.test(ap), "settings page has the Notifications panel");
}

// ---------- v62: "Where have you been?" + a visit from a photo ----------
{
  const W = require("../travel-log/app/where.js");
  const a = { id: "person_zz0000000000test", name: "Zz Test", role: "adult", states: { CO: { at: "2020-05-01" } }, places: {}, parks: {} };
  const k = { id: "person_zz00000000kid01", name: "Zz Kid", role: "kid", states: {}, places: {}, parks: {} };
  const s = {};
  let r = W.tap([a], "state", "FL", s);
  ok(r.on && a.states.FL && a.states.FL.at === "" && !k.states.FL, "quick stamp: only the chosen person, no date (a past visit)");
  r = W.tap([a, k], "state", "CO", s);
  ok(r.ids.join() === k.id && a.states.CO.at === "2020-05-01", "quick stamp: someone who already has it keeps their dated stamp");
  r = W.tap([a, k], "state", "CO", s);
  ok(!r.on && r.ids.join() === k.id && a.states.CO && !k.states.CO, "tap again: takes back only what this session added");
  W.tap([a], "park", "zion", s); W.tap([a], "place", "ITA", s);
  ok(a.parks.zion.jr === false && a.places.ITA && W.added(s) === 3, "parks and countries; running count");
  ok(W.tap([a], "state", "CO", {}).ids.length === 0, "an older stamp is never removed from the quick grid");
  const pop = W.order([{ id: "AL", name: "Alabama" }, { id: "FL", name: "Florida" }, { id: "CA", name: "California" }], "state", "");
  ok(pop.map(x => x.id).join() === "FL,CA,AL", "popular first, then A-Z");
  ok(W.order([{ id: "AL", name: "Alabama" }, { id: "FL", name: "Florida" }], "state", "flo").map(x => x.id).join() === "FL", "search filters");
  ok(W.POPULAR.park.every(id => M.parkById(id)), "every popular park is a real park id");
  ok(JSON.stringify(W.stampsFrom({ country: "USA", region: "UT", park: "zion" })) === JSON.stringify([{ kind: "state", id: "UT" }, { kind: "park", id: "zion" }]) &&
     JSON.stringify(W.stampsFrom({ country: "ITA", region: "" })) === JSON.stringify([{ kind: "place", id: "ITA" }]) && W.stampsFrom(null).length === 0, "photo GPS lookup -> stamps");
  ok(W.exifDay({ ms: Date.UTC(2019, 6, 4, 15), wall: "2019-07-04" }) === "2019-07-04" && W.exifDay(null) === "", "photo date");
  ok(W.total([a]) === 4, "stamp total (country USA not double counted)");
  // restore joins maps: a quick stamp made after the backup survives, the file's stamps come in, dates win over no date
  const phone = { id: a.id, name: "Zz Test", updatedAt: "2026-10-24T20:00:00Z", states: { FL: { at: "" }, CO: { at: "2020-05-01" } }, places: {}, parks: { zion: { at: "", jr: false } } };
  const file = { id: a.id, name: "Zz Test", updatedAt: "2026-10-01T00:00:00Z", states: { WI: { at: "2026-03-01" }, FL: { at: "2018-02-02" } }, places: { CAN: { at: "" } }, parks: { zion: { at: "2017-07-07", jr: true } } };
  const mg = M.mergeRestore(phone, file);
  ok(mg.states.FL.at === "2018-02-02" && mg.states.CO && mg.states.WI && mg.places.CAN && mg.parks.zion.jr && mg.parks.zion.at === "2017-07-07", "restore: maps join up, a date beats no date, badges kept");
  const wj = read("where.js"), aj = read("app.js"), ij = read("import.js"), ix = read("index.html"), sw = read("sw.js");
  ok(/h\[0\] === "where"/.test(aj) && /FS_WHERE\.homeCard\(\)/.test(aj) && /geo: mainThreadGeo/.test(ij) && /where\.js/.test(ix) && /"where\.js"/.test(sw), "wired: route, home card, offline geo, script, cache");
  ok(/I\.exif\(b\)/.test(wj) && /id="wpdate"/.test(wj) && /id="wpstate"/.test(wj) && /redacted/.test(wj), "photo: EXIF first, manual place/date otherwise");
}

// ---------- v63: rewards & certificates, road-trip games, kids' journal, weekly recap ----------
{
  const R = require("../travel-log/app/rewards.js"), G = require("../travel-log/app/games.js"), J = require("../travel-log/app/journal.js"), RC = require("../travel-log/app/recap.js");
  const HC = require("../travel-log/app/highlights-core.js"), SC = require("../travel-log/app/sync-core.js"), Y = require("../travel-log/app/year.js");
  const kid = { id: "person_zz00000000kid01", name: "Zz Kid", role: "kid", states: { FL: { at: "2026-06-01" }, CA: { at: "2026-06-03" } }, places: { USA: { at: "" }, ITA: { at: "2026-06-20" } }, parks: {}, spots: { "p-zzpub": { at: "2026-06-04" } } };
  const grand = { id: "person_zz0000000grand1", name: "Zz Test", role: "adult", relationship: "grandparent", states: {}, places: {}, parks: {} };
  // rewards
  ok(R.count(kid) === 3 && R.earned(kid).length === 1 && R.earned(kid)[0].name === "Explorer" && R.earned(kid)[0].at === "2026-06-20", "rewards: 3 stamps = Explorer, dated by the 3rd stamp (USA and pubs don't count)");
  ok(R.next(kid).n === 5 && R.LEVELS.map(l => l.n).join() === "3,5,10,20", "rewards: levels 3, 5, 10, 20");
  ok(R.fresh([kid], {}).length === 1 && R.fresh([kid], { [kid.id]: 3 }).length === 0, "rewards: a new level shows once per phone");
  const cert = R.certHTML({ name: "Zz Kid", n: 10, date: "Jun 20, 2026" });
  ok(/Certificate of Adventure/.test(cert) && /Zz Kid/.test(cert) && /Globetrotter/.test(cert) && !/National Park Service|NPS|Eastern National|bear|moose|eagle|wolf|deer|fox|owl|elk/i.test(cert), "certificate: original, no park-service marks, no animals");
  ok(/@media print[\s\S]*certview/.test(read("app.css")) && /window\.print\(\)/.test(read("rewards.js")), "certificate prints (or saves as PDF)");
  // games
  const t = { id: "trip_zzgames0000001", date: "2026-07-01", endDate: "2026-07-03", kidIds: [kid.id], place: "Zz Road Trip" }, d = "2026-07-02";
  G.STATES.slice(0, 9).forEach(s => G.tap(t, "plates", d, s, "2026-07-02T10:00:00Z"));
  ok(!G.board(t, "plates", d).done && G.award(t, "plates", d, [kid]).length === 0, "plates: 9 states isn't done yet");
  G.tap(t, "plates", d, "WY", "2026-07-02T11:00:00Z");
  ok(G.board(t, "plates", d).done && G.award(t, "plates", d, [kid], "Zz Road Trip").length === 1 && G.award(t, "plates", d, [kid]).length === 0, "plates: 10 states earns one stamp, once");
  ok(kid.games["plates:" + t.id + ":" + d].at === d && R.count(kid) === 4, "the game stamp is dated to the trip day and counts toward rewards");
  G.tap(t, "alpha", d, "C"); G.tap(t, "alpha", d, "A"); G.tap(t, "alpha", d, "B"); G.tap(t, "alpha", d, "A");
  ok(G.board(t, "alpha", d).found.join("") === "AB", "alphabet: in order only; only the last letter can be taken back");
  ok(G.huntList(t.id + ":" + d).length === 12 && JSON.stringify(G.huntList("a")) === JSON.stringify(G.huntList("a")) && JSON.stringify(G.huntList("a")) !== JSON.stringify(G.huntList("b")), "hunt: 12 things, same list on every phone, new list per day");
  ok(!/deer|cow|horse|bird|dog|eagle|bear/i.test(JSON.stringify(G.HUNT)), "hunt: no animals (the wildlife list isn't part of this)");
  ok(G.playDay(t, "2026-07-02", "2026-07-03") === "2026-07-02" && G.playDay(t, "2026-09-01", "2026-07-03") === "2026-07-01", "games: today on a trip, else its first day");
  ok(/games\/print/.test(read("games.js")) && /page:portrait/.test(read("app.css")), "printable game sheets");
  // journal
  const e = J.upsert(t, kid.id, d, { best: "  Zz saw the big bridge ", funny: "Zz said the car is a spaceship", said: "Zz Test" }, "2026-07-02T20:00:00Z", "jzz0001");
  ok(e && e.best === "Zz saw the big bridge" && J.entry(t, kid.id, d) === e && J.list(t).length === 1, "journal: one page per kid per day");
  J.upsert(t, kid.id, d, { best: "Zz bridge", photoId: "photo_zzdraw01" });
  ok(J.list(t).length === 1 && J.entry(t, kid.id, d).photoId === "photo_zzdraw01" && !J.entry(t, kid.id, d).funny, "journal: editing keeps one page");
  ok(SC.tripPhotos(Object.assign({ photoId: "photo_zzmain" }, t)).join() === "photo_zzmain,photo_zzdraw01" && M.extraPhotoIds(t).join() === "photo_zzdraw01", "journal drawings sync and are cleaned up with the trip");
  const plan = SC.planPush({ people: [], trips: [t], photoIds: ["photo_zzdraw01"] }, SC.emptyShadow(), "fam_zz");
  ok(plan.uploads.some(u => u.id === "photo_zzdraw01") && !plan.photos.some(p => p.deleted), "sync uploads a journal drawing and never deletes it");
  ok(J.yearBits([kid], [t], 2026).pages === 1 && J.yearBits([kid], [t], 2025).pages === 0, "journal feeds the year in review");
  J.upsert(t, kid.id, "2026-07-03", { funny: "Zz: are we there yet" }, "x", "jzz0002");
  ok(Y.summary([kid], [t], 2026).journal.pages === 2 && Y.summary([kid], [t], 2026).journal.quotes.length === 1, "year summary has the journal pages and quotes");
  ok(/journalBits\(k, t\)/.test(read("book.js")), "journal feeds the travel book");
  ok(J.days(t, M).join() === "2026-07-01,2026-07-02,2026-07-03", "journal: the trip's days");
  ok(J.upsert(t, kid.id, d, { best: "" }) === null && J.list(t).length === 1, "journal: clearing a page removes it");
  // weekly recap
  const rc = RC.build(HC, [kid, grand], [t], {}, "2026-07-03");
  ok(rc.since === "2026-06-27" && rc.kids.length === 1 && rc.items.some(x => x.kind === "journal") && rc.items.some(x => x.ref.indexOf("g:") === 0), "recap: the week's journal pages and game stamps");
  ok(!rc.items.some(x => x.at < "2026-06-27" || x.at > "2026-07-03") && !rc.items.some(x => /zzpub/.test(x.ref + x.title)), "recap: only that week, no pubs");
  const html = RC.renderHTML(rc, { appUrl: "https://example.test/app/", emoji: HC.EMOJI, who: p => p.name });
  ok(/This week with the grandkids/.test(html) && /#\/recap\/r\/heart\/j%3Atrip_zzgames0000001%3Ajzz0002/.test(html) && !/<script/i.test(html) && !/<style/i.test(html), "recap email HTML: inline styles, one-tap reaction links");
  ok(rc.items.every(x => HC.REF.test(x.ref) && x.ref.length <= 120), "recap items can take reactions (fits public.reactions)");
  ok(/emailPayload/.test(read("recap.js")) && !/fetch\(|sendmail|smtp|resend|sendgrid/i.test(read("recap.js")), "recap: ready for an email sender, sends nothing");
  // restore keeps game stamps made on this phone
  const ph = { id: kid.id, updatedAt: "2026-07-05T00:00:00Z", states: {}, places: {}, parks: {}, games: { "hunt:x:2026-07-04": { at: "2026-07-04", kind: "hunt" } } };
  const fl = { id: kid.id, updatedAt: "2026-07-01T00:00:00Z", states: {}, places: {}, parks: {}, games: { "alpha:x:2026-06-30": { at: "2026-06-30", kind: "alpha" } } };
  ok(Object.keys(M.mergeRestore(ph, fl).games).length === 2, "restore: game stamps join up");
  const aj = read("app.js"), tu = read("trips-ui.js"), ix = read("index.html"), sw = read("sw.js");
  ok(/FS_ROUTES/.test(aj) && /FS_HOME_TOP/.test(aj) && /FS_REWARDS\.card/.test(aj) && /FS_TRIPX/.test(tu) && ["rewards", "games", "journal", "recap"].every(f => ix.indexOf(f + ".js") > 0 && sw.indexOf('"' + f + '.js"') > 0), "wired: routes, home cards, trip page, scripts, offline cache");
}

// ---- v64: offline-first (pending count, nothing lost when a push fails, reactions outbox) ----
{
  const S = require("../travel-log/app/sync-core.js"), FID = "fam_zz";
  const zz = M.newPerson({ name: "Zz Kid" }); zz.states.TX = { at: "2026-10-24" };
  const tz = M.newTrip({ kidIds: [zz.id], place: "Zz Lake" }); tz.photoId = "ph_zz1"; tz.journal = [{ id: "jzz", kid: zz.id, day: "2026-10-24", best: "Zz rocks", photoId: "ph_zz2", at: "2026-10-24T10:00:00Z" }];
  const local = { people: [zz], trips: [tz], photoIds: ["ph_zz1", "ph_zz2"] };
  ok(typeof S.pendingCount === "function" && S.pendingCount(null) === 0, "pendingCount exported and safe");
  const sh = S.emptyShadow(), p1 = S.planPush(local, sh, FID, "2026-10-24T11:00:00Z");
  ok(S.pendingCount(p1) === 1 + 1 + 1 + 2, "offline edits counted: person + visit + trip + 2 photos (trip + journal drawing): " + S.pendingCount(p1));
  // a push that fails (no signal) never touches the shadow, so the same changes are still waiting next time
  const p2 = S.planPush(local, sh, FID, "2026-10-24T12:00:00Z");
  ok(S.pendingCount(p2) === S.pendingCount(p1) && JSON.stringify(sh) === JSON.stringify(S.emptyShadow()), "a failed push loses nothing: everything still pending");
  p1.uploads.forEach(u => { sh.photos[u.id] = "image/jpeg"; }); S.afterPush(sh, p1);   // as sync.js does once each upload lands
  ok(S.pendingCount(S.planPush(local, sh, FID, "2026-10-24T13:00:00Z")) === 0, "after the push lands, nothing is pending");
  zz.states.UT = { at: "2026-10-25" }; zz.updatedAt = "2026-10-25T00:00:00Z";
  ok(S.pendingCount(S.planPush(local, sh, FID, "2026-10-25T01:00:00Z")) === 2, "a new offline edit is pending again (person + new visit)");
  const ssrc = read("sync.js"), hsrc = read("highlights.js"), rsrc = read("recap.js");
  ok(/function countPending/.test(ssrc) && /pending: function \(\) \{ return pendingN; \}/.test(ssrc), "sync exposes the pending count");
  ok(/to sync/.test(ssrc) && /waiting to sync/.test(ssrc), "pill and sync page show what's waiting");
  ok(/id = "offlinechip"/.test(ssrc) && /navigator\.onLine === false/.test(ssrc), "offline banner when there's no signal");
  ok(/MLTL_onChange[^\n]*countPending\(\)/.test(ssrc), "every local edit recounts what's pending");
  ok(/addEventListener\("online"[^\n]*schedule\(500\)[^\n]*flush\(\)/.test(ssrc), "back online: sync and send queued reactions");
  ok(/mltl-rxq-/.test(hsrc) && /function flush\(\)/.test(hsrc) && /withQueue\(/.test(hsrc) && /enqueue\(ref, b\.dataset\.emo, t\.on\)/.test(hsrc), "reactions made offline are queued, kept on screen and sent later");
  ok(/H\.offlineErr\(e\)/.test(rsrc) && /H\.enqueue\(ref, emoji, true\)/.test(rsrc), "recap one-tap reactions queue offline too");
  ok(/\.offlinechip/.test(read("app.css")), "offline banner styled");
}

// ---- v65: brand config, kid-drawn stamps, share cards, postcards, stamp stations, Cousin Cup ----
{
  const app = f => fs.readFileSync(path.join(APP, f), "utf8");
  ok(/var VERSION = "(?:v6[5-9]|v[7-9][0-9])"/.test(read("app.js")) && /mltl-(?:v6[5-9]|v[7-9][0-9])/.test(read("sw.js")), "v65: version and cache bumped");
  ok(/var VERSION = "(?:v6[6-9]|v[7-9][0-9])"/.test(read("app.js")) && /mltl-(?:v6[6-9]|v[7-9][0-9])/.test(read("sw.js")), "v66: version and cache bumped");
  ok(/FS_BRAND/.test(read("book.js")) && !/"FAMSTAMP/.test(read("book.js")), "v66: book takes its brand name from FS_BRAND");
  ok(/FS_BRAND/.test(read("rewards.js")) && /FS_BRAND/.test(read("games.js")), "v66: certificate and game footer use FS_BRAND");
  ok(/bfamily/.test(read("book.js")) && /travel crew/.test(read("book.js")), "v66: book has a travel crew page");
  ok(/tripStampsHTML/.test(read("book.js")) && /bjpage/.test(read("book.js")) && /\.bjpage/.test(read("app.css")), "v66: trip stamps on trip pages and journal on its own page");
  ["brand.js", "stampx.js", "kidart.js", "sharecard.js", "postcard.js", "stations.js", "cup.js"].forEach(f => {
    ok(read("index.html").indexOf('src="' + f + '"') > 0 && read("sw.js").indexOf('"' + f + '"') > 0, f + " loaded and cached offline");
  });
  ok(read("index.html").indexOf('src="brand.js"') < read("index.html").indexOf('src="app.js"'), "brand config loads before the app");
  // brand: the app name lives in one place
  const brandSrc = read("brand.js");
  ok(/NAME: "Famstamp"/.test(brandSrc) && (brandSrc.match(/NAME:/g) || []).length === 1, "app name configured once in brand.js");
  ["sharecard.js", "postcard.js", "stations.js", "cup.js"].forEach(f => ok(/FS_BRAND|brand\(\)/.test(read(f)), f + " takes the name from the brand config"));
  ok(!/national park service|\bNPS\b|eastern national/i.test(["brand.js", "sharecard.js", "postcard.js", "stations.js", "kidart.js", "cup.js"].map(read).join("\n")), "no NPS / Eastern National branding in new files");

  // kid-drawn stamps
  const KA = require("../travel-log/app/kidart.js");
  const img = "data:image/jpeg;base64," + "A".repeat(400);
  const kid = { id: "person_zz00000000kid01", name: "Zz Kid" };
  ok(KA.key("state", "TX") === "state:TX" && KA.key("bogus", "TX") === "" && KA.key("park", "a b") === "", "kid art keys");
  ok(KA.set(kid, "state", "TX", img) && KA.get(kid, "state", "TX") === img && KA.count(kid) === 1, "kid art saved on the person (syncs with them)");
  ok(!KA.set(kid, "state", "UT", "javascript:alert(1)") && !KA.set(kid, "state", "UT", "data:image/svg+xml;base64,AAAA") && !KA.set(kid, "state", "UT", "data:image/jpeg;base64," + "A".repeat(KA.MAX_LEN)), "only small JPEG/PNG data is accepted");
  const ksvg = KA.svg(img, "Zz <Texas>", "Oct 24, 2026");
  ok(/<svg/.test(ksvg) && /clipPath/.test(ksvg) && ksvg.indexOf(img) > 0 && /Zz &lt;Texas&gt;/.test(ksvg) && !/<script/i.test(ksvg), "kid stamp svg: drawing clipped to the circle, text escaped");
  ok(KA.set(kid, "state", "TX", "") && KA.get(kid, "state", "TX") === "" && KA.count(kid) === 0, "removing kid art goes back to the regular stamp");
  const big = { id: "x" }; for (let i = 0; i < KA.MAX; i++) KA.set(big, "park", "p" + i, img);
  ok(KA.count(big) === KA.MAX && !KA.set(big, "park", "extra", img), "kid art capped per person");
  const cr = KA.cropRect(400, 200, 1, 0, 0); ok(cr && cr.s === 200 && cr.x === 100 && cr.y === 0, "crop is square and fits the photo");
  ok(/self\.FS_KIDART/.test(read("passport-core.js")) && /KA\.svgFor\(/.test(read("passport-core.js")) && /holder: personId \|\| s\.holder/.test(read("trips-ui.js")) && /FS_SX\.buttons\(s, holder\)/.test(read("trips-ui.js")), "passport (and printed book) uses the kid's stamp art");

  // share card: no name unless opted in
  const SC = require("../travel-log/app/sharecard.js");
  const l1 = SC.lines({ kind: "state", name: "Texas", date: "Oct 24, 2026", who: "Zz Kid" });
  ok(l1.who === "" && !/Zz/.test(JSON.stringify(l1)), "share card leaves the name off by default");
  ok(SC.lines({ kind: "state", name: "Texas", who: "Zz Kid", includeName: true }).who === "Zz's passport", "name only when the toggle is on (first name only)");
  ok(/Famstamp/.test(l1.footer) && SC.W === 1080 && SC.H === 1920, "story-size card with the brand footer");
  ok(SC.wrap("A very long national park name that goes on and on", 16).length <= 3, "share card title wraps to 3 lines");
  ok(/^famstamp-[a-z0-9-]+\.png$/.test(SC.fileName("Zz Test Park!")), "share card file name");
  ok(/type="checkbox" id="scname">/.test(read("sharecard.js")), "name toggle starts unchecked");
  ok(/navigator\.share/.test(read("stampx.js")) && /canShare/.test(read("stampx.js")), "Web Share with a download fallback");

  // postcards
  const PC = require("../travel-log/app/postcard.js");
  const addr = { name: "Zz Grandma", line1: "1 Zz Test Ln", city: "Zz Town", state: "tx", zip: "75001" };
  const r0 = PC.newRequest({ message: "", to: {} });
  ok(r0.errors && r0.errors.length >= 5 && /message/i.test(r0.errors[0]), "postcard needs a message and an address");
  ok(PC.newRequest({ message: "hi", to: Object.assign({}, addr, { zip: "7500" }) }).errors[0].indexOf("ZIP") >= 0, "bad ZIP caught");
  ok(PC.newRequest({ message: "hi", to: Object.assign({}, addr, { state: "ZZ" }) }).errors[0].indexOf("state") >= 0, "bad state caught");
  const r1 = PC.newRequest({ pid: "person_zz00000000kid01", kind: "state", area: "TX", place: "Texas", message: "We saw a huge rock!\nLove, Zz", from: "Zz Kid", to: addr }, "2026-10-24T12:00:00Z", "pc_zz000001");
  ok(r1.request && r1.request.to.state === "TX" && r1.request.status === "saved" && r1.request.front === "stamp", "postcard request saved (stamp front by default)");
  ok(PC.newRequest({ message: "x".repeat(900), to: addr }).request.message.length === PC.MSG_MAX, "message capped to fit the card");
  let lst = []; for (let i = 0; i < PC.KEEP + 5; i++) lst = PC.keep(lst, Object.assign({}, r1.request, { id: "pc_" + i }));
  ok(lst.length === PC.KEEP && lst[0].id === "pc_" + (PC.KEEP + 4), "saved postcards capped, newest first");
  ok(PC.addressBook([r1.request, r1.request]).length === 1, "address book de-duplicates grandparents");
  const back = PC.backSVG({ message: "<b>hi</b>", from: "Zz", to: r1.request.to, place: "Texas" });
  ok(/viewBox="0 0 600 400"/.test(back) && /&lt;b&gt;hi/.test(back) && /Zz Grandma/.test(back) && /75001/.test(back), "postcard back: message + address, escaped");
  ok(/viewBox="0 0 600 400"/.test(PC.frontSVG({ stampSVG: "<svg viewBox='0 0 10 10'><circle r='5'/></svg>", name: "Texas" })), "postcard front from the stamp");
  const pcs = read("postcard.js");
  ok(/Coming soon/.test(pcs) && /disabled/.test(pcs) && !/lob\.com|postgrid|click2mail|stripe|\$\d/i.test(pcs), "mail-it option is 'coming soon': no vendor, no price");
  ok(/@page fspc \{ size:6in 4in/.test(read("app.css")), "postcards print at 6x4 in");

  // stamp stations
  const ST = require("../travel-log/app/stations.js");
  const st = ST.make({ id: "zzst0001", name: "Zz Test Station", place: "Zz Town", lat: 30.1, lon: -97.2, r: 400 });
  const code = ST.encode(st), back2 = ST.decode(code);
  ok(code && back2 && back2.name === "Zz Test Station" && back2.lat === 30.1 && back2.r === 400, "station code round-trips");
  ok(ST.decode(code.replace(/.\./, m => (m[0] === "A" ? "B" : "A") + ".")) === null && ST.decode("junk") === null && ST.decode(code.slice(0, -1) + (code.slice(-1) === "a" ? "b" : "a")) === null, "tampered station codes are rejected");
  ok(ST.make({ id: "BAD", name: "x" }) === null && ST.make({ id: "zzst0001", name: "" }) === null, "station needs an id and name");
  ok(/#\/st\//.test(ST.link(st, "https://x.test/app/#/home")) && !/#\/home/.test(ST.link(st, "https://x.test/app/#/home")), "station link");
  ok(ST.near(st, { lat: 30.1001, lon: -97.2001, acc: 10 }) && !ST.near(st, { lat: 31, lon: -97.2, acc: 10 }) && !ST.near(st, null), "location check");
  ok(ST.near(ST.make({ id: "zzst0002", name: "Zz Anywhere" }), null), "stations without a spot skip the location check");
  const zp = { id: "person_zz0000000000test" };
  ok(ST.award(zp, st, "2026-10-24") === "new" && ST.award(zp, st, "2026-10-24") === "today" && ST.award(zp, st, "2026-10-25") === "again", "once per person per day");
  ok(ST.visits(zp, st) === 2 && zp.spots["c-st-zzst0001"].at === "2026-10-24" && ST.award(zp, st, "bad") === "", "visits counted");
  const SP = require("../travel-log/app/spots.js");
  ok(typeof SP.itemFor === "function" ? (SP.itemFor("c-st-zzst0001", [zp]) || {}).cat === "cities" : /stationItem/.test(read("spots.js")), "station stamp shows with city stamps");
  ok(/@page fsposter/.test(read("app.css")) && /stposterview/.test(read("stations.js")), "printable station poster");

  // Cousin Cup
  const CU = require("../travel-log/app/cup.js");
  ok(CU.normCode(" abcd-2345 ") === "ABCD2345" && CU.isCode("ABCD2345") && !CU.isCode("ABCD1234") && !CU.isCode("ABC"), "cup codes");
  const fam = [{ role: "kid", states: { TX: { at: "2026-10-24" }, UT: { at: "2026-01-01" } }, spots: { "c-st-zzst0001": { at: "2026-10-25" }, "p-x": { at: "2026-10-25" } } }, { role: "adult", states: { CA: { at: "2026-10-24" } } }];
  ok(CU.count(fam, "2026-10-01", "") === 2, "cup counts the kids' stamps since the cup started (stations count, pubs don't)");
  ok(CU.count(fam, "2026-10-01", "2026-10-24") === 1, "cup end date respected");
  ok(CU.count([{ states: { CA: { at: "2026-10-24" } } }], "2026-10-01", "") === 1, "no kids: everyone's stamps count");
  ok(CU.progress(37, 50).pct === 74 && CU.progress(60, 50).done && CU.progress(60, 50).pct === 100, "team progress");
  ok(CU.missing({ code: "PGRST202" }) && CU.missing({ message: "Could not find the function public.my_cups" }) && !CU.missing({ message: "network" }), "missing cup functions detected");
  const cus = read("cup.js");
  ok(/almost ready/i.test(cus) && /missing\(e\)/.test(cus), "cup page waits gracefully until the SQL is in");
  ok(!/rank|leader|winner|loser/i.test(cus.replace(/no rankings, no losers/gi, "")), "no rankings or losers");
  ok(/cupRpc/.test(read("sync.js")) && /PGRST202/.test(read("sync.js")) && /FS_CUP\.report/.test(read("sync.js")), "sync: cup calls + report after sync");
  // the SQL applied by hand is additive only
  const sqlPath = "/workspace/famstamp-v65/cousin-cup.sql";
  if (fs.existsSync(sqlPath)) {
    const sql = fs.readFileSync(sqlPath, "utf8").replace(/--[^\n]*/g, "");
    ok(!/\b(drop|truncate|delete\s+from|alter\s+table\s+public\.(families|family_members|people|trips))\b/i.test(sql), "cup SQL is additive only");
    ok(/create table if not exists public\.cups/.test(sql) && /enable row level security/.test(sql) && /security definer/.test(sql) && /revoke all/.test(sql), "cup SQL: RLS on, access only through functions");
    ok(!/\bjsonb_build_object\([^)]*'stamps'/.test(sql), "per-family counts never returned");
  }
}

// ---- v67: launch basics (help, export, deletion, policies, anonymous stats, accessibility) ----
{
  const ROOTDIR = path.join(__dirname, "..");
  const site = f => fs.readFileSync(path.join(ROOTDIR, "travel-log", f), "utf8");
  ok(/var VERSION = "v(6[7-9]|[7-9][0-9])"/.test(read("app.js")) && /mltl-v(6[7-9]|[7-9][0-9])/.test(read("sw.js")), "v67: version and cache bumped");
  const idx = read("index.html");
  ok(idx.indexOf('src="launch.js"') > idx.indexOf('src="brand.js"') && idx.indexOf('src="launch.js"') < idx.indexOf('src="app.js"') && /"launch\.js"/.test(read("sw.js")), "v67: launch.js loads right after brand.js and is cached");
  // one config spot for contacts and page links
  const bsrc = read("brand.js");
  const C = { support: "support@darklighthousesolutions.com", privacy: "privacy@darklighthousesolutions.com", partners: "partners@darklighthousesolutions.com", press: "press@darklighthousesolutions.com" };
  Object.keys(C).forEach(k => ok(bsrc.indexOf(k + ': "' + C[k] + '"') > 0, "v67: brand.js has the " + k + " address"));
  ["privacy", "terms", "delete-account", "support", "waitlist"].forEach(p => ok(bsrc.indexOf('"/travel-log/' + p + '/"') > 0, "v67: brand.js links the " + p + " page"));
  const L = require("../travel-log/app/launch.js");
  ok(!/@[a-z]+\.(com|org|net)/i.test(read("launch.js").replace(/@darklighthousesolutions\.com/g, "")) && !/darklighthousesolutions\.com/.test(read("launch.js")), "v67: launch.js reads addresses from FS_BRAND, none hardcoded");
  // site pages
  const pages = ["privacy", "terms", "delete-account", "support", "waitlist"];
  pages.forEach(p => {
    const h = site(p + "/index.html");
    ok(!/gtag|googletagmanager|google-analytics/.test(h), "v67: " + p + " page has no analytics");
    ok(/<script src="\.\.\/app\/brand\.js"><\/script>/.test(h) && !/<script>/.test(h), "v67: " + p + " page takes the brand from brand.js, no inline scripts");
    ok(/script-src 'self'/.test(h), "v67: " + p + " page has a strict CSP");
    // static fallbacks must match brand.js
    (h.match(/data-mail="([a-z]+)"[^>]*href="mailto:([^"?]+)/g) || []).forEach(m => { const x = /data-mail="([a-z]+)"[^>]*href="mailto:([^"?]+)/.exec(m); ok(C[x[1]] === x[2], "v67: " + p + " " + x[1] + " fallback matches brand.js"); });
    ok(Object.keys(C).every(k => h.indexOf('data-mail="' + k + '"') > 0), "v67: " + p + " page lists all four contacts");
    ok(/data-brand>Famstamp</.test(h), "v67: " + p + " page name fallback matches brand.js");
    ok(!/national park service|\bNPS\b|eastern national/i.test(h), "v67: " + p + " no NPS branding");
  });
  ["privacy", "terms", "delete-account"].forEach(p => ok(/Last updated \w+ \d+, 20\d\d/.test(site(p + "/index.html")), "v67/v73: " + p + " shows its last-updated date"));
  ok(/last updated/i.test(site("privacy/index.html")) && /last updated/i.test(site("terms/index.html")), "v67: policies show a last-updated date");
  const pp = site("privacy/index.html");
  ok(/don't sell/i.test(pp) && /EXIF/.test(pp) && /children/.test(pp) && /Supabase/.test(pp) && /push/.test(pp) && /delete-account/.test(pp), "v67: privacy policy covers kids, storage, push, photos, no selling, deletion");
  ok(!/COPPA[- ]compliant|fully compliant|guarantee/i.test(pp), "v67: privacy policy doesn't claim legal compliance");
  ok(!/noindex/.test(site("waitlist/index.html")) && /18 or older/.test(site("waitlist/index.html")), "v67/v73: waitlist is public (indexable) and adults only");
  const wl = site("waitlist.js");
  ok(/join_waitlist/.test(wl) && /p_adult: true/.test(wl) && !/localStorage|cookie/.test(wl), "v67: waitlist posts to the rate-limited function and stores nothing locally");
  ok(fs.readFileSync(path.join(ROOTDIR, "index.html"), "utf8").indexOf("partners@darklighthousesolutions.com") > 0, "v67: site footer lists the contacts");
  ok(/brand\(\)\.CONTACT\.partners/.test(read("stations.js")), "v67: stations page shows the partners address");
  ["add_analytics.py", "add_global_nav.py", "add_head_meta.py"].forEach(f => ok(/rel\.startswith\("travel-log\/"\)/.test(fs.readFileSync(path.join(__dirname, f), "utf8")), f + " leaves the Famstamp policy pages alone"));
  // scrubbing: nothing personal in error reports
  const s = L.scrub("TypeError at https://darklighthousesolutions.com/travel-log/app/app.js?v=1:12:3 zz@test.example person_zz00000000kid01 trip_abc12345 #/p/person_zz/passport 5551234567 123e4567-e89b-12d3-a456-426614174000 https://example.com/x");
  ok(/app\.js:12:3/.test(s) && !/@|zz00000000|abc12345|5551234567|426614174000|example\.com|darklighthouse/.test(s), "v67: error text is scrubbed: " + s);
  ok(L.scrub("x".repeat(900)).length === 300 && L.scrub("x".repeat(900), 800).length === 800, "v67: error text is capped");
  ok(L.routeKey("#/p/person_zz00000000kid01/passport") === "kid:passport" && L.routeKey("#/") === "home" && L.routeKey("") === "home" && L.routeKey("#/sync/leave") === "sync:leave" && L.routeKey("#/cup/ABCD2345") === "cup" && L.routeKey("#/trip/trip_123") === "trip", "v67: screen keys carry no ids");
  ok(L.platform("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36") === "Android Chrome" && L.platform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1") === "iOS Safari", "v67: coarse device type");
  let st = {}; for (let i = 0; i < 250; i++) st = L.bump(st, "2026-10-24", "home");
  st = L.bump(st, "2026-10-24", "Bad Key!"); for (let i = 0; i < 70; i++) st = L.bump(st, "2026-10-24", "k" + i);
  ok(st["2026-10-24"].home === 200 && !("Bad Key!" in st["2026-10-24"]) && Object.keys(st["2026-10-24"]).length === 60, "v67: usage counts are capped and keys checked");
  // export zip: a real zip with the backup, CSV, photos and README
  const jpg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]).toString("base64");
  const backup = { exportedAt: "2026-10-24T12:00:00Z", kids: [{ id: "person_zz00000000kid01", name: "Zz Kid" }], trips: [{ id: "trip_zz1", date: "2026-07-04", title: "Zz Test, \"beach\"", kidIds: ["person_zz00000000kid01"], photoId: "photo_zz1" }], photos: [{ id: "photo_zz1", dataUrl: jpg }] };
  const files = L.exportFiles(backup, "Famstamp", "v67"), names = files.map(f => f.name);
  ok(names.join(",") === "README.txt,backup.json,trips.csv,photos/photo_zz1.jpg", "v67: export has README, backup, CSV and photos: " + names.join(","));
  ok(/"Zz Test, ""beach"""/.test(files[2].data) && /Zz Kid/.test(files[2].data), "v67: CSV escapes quotes and commas");
  ok(Buffer.from(files[3].data).equals(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])), "v67: photo bytes exported as-is");
  const z = Buffer.from(L.zip(files.map(f => ({ name: f.name, data: f.data }))));
  ok(z.readUInt32LE(0) === 0x04034b50 && z.readUInt32LE(z.length - 22) === 0x06054b50 && z.readUInt16LE(z.length - 12) === 4, "v67: zip has headers and 4 entries");
  ok(L.crc32(Buffer.from("123456789")) === 0xCBF43926, "v67: zip CRC32 is standard");
  ok(JSON.parse(files[1].data).trips[0].id === "trip_zz1", "v67: backup.json inside the zip is the re-importable backup");
  // deletion and help
  const ss = read("sync.js");
  ok(/delete_my_account_and_data/.test(ss) && /Type DELETE to confirm/.test(ss) && /confirm\("Last check/.test(ss) && /owner \? '<div class="panel delall"/.test(ss), "v67: owner-only delete with two confirmations");
  ok(/res && res\.missing\) return r\.rpc\("delete_family"/.test(ss) && /wipeFiles\(r\)/.test(ss), "v67: delete removes photos first and falls back to the older functions");
  ok(/#\/help/.test(ss) && /#\/help/.test(read("app.js")) && /data-export-zip/.test(read("app.js")), "v67: help and export reachable from the family menu and Back up");
  const ls = read("launch.js");
  ok(/fs-telemetry/.test(ls) && /htele/.test(ls) && /No names, trips, photos/.test(ls), "v67: one opt-out switch for usage and errors, explained");
  ok(!/userId|familyId|email:|navigator\.userAgent\s*[,}]/.test(ls.replace(/platform\(navigator\.userAgent\)/g, "")), "v67: telemetry sends no user, family or raw user agent");
  ok(/data-size/.test(ls) && /fs-textsize/.test(ls), "v67: text size setting");
  ok(!/FS_BRAND/.test(read("app.js")) === false && /FS_BRAND && window\.FS_BRAND\.NAME/.test(read("app.js")), "v67: Back up version line uses the brand name");
  ok(/\.familycard \.synccta\.small:not\(\.muted\) \{ color: var\(--navy\); \}/.test(read("app.css")) && /prefers-reduced-motion/.test(read("app.css")), "v67: contrast and reduced-motion fixes");
  // SQL is additive only
  const sqlPath = "/workspace/famstamp-v67/launch-basics.sql";
  if (fs.existsSync(sqlPath)) {
    const sql = fs.readFileSync(sqlPath, "utf8").replace(/--.*$/gm, "");
    ok(!/\bdrop\s+(table|function|policy|schema|column)|\btruncate\b|alter\s+table\s+\S+\s+drop/i.test(sql), "v67: launch SQL has no DROP or TRUNCATE");
    ok(/security definer/.test(sql) && /member_role\(p_family\) is distinct from 'owner'|<> 'owner'|!= 'owner'/.test(sql), "v67: delete function is owner-only");
  }
}

// ---------- v68: Utah stamp, time zones, search, what's new, rating limits, undo, sound off, lazy photos, notify times ----------
{
  const ROOTDIR = path.join(__dirname, "..");
  const X = require(path.join(APP, "extras.js"));
  const site = f => fs.readFileSync(path.join(ROOTDIR, "travel-log", f), "utf8");
  ok(/var VERSION = "v(6[8-9]|[7-9][0-9])"/.test(read("app.js")) && /mltl-v(6[8-9]|[7-9][0-9])/.test(read("sw.js")), "v68: version and cache bumped");
  ok(/"extras\.js"/.test(read("sw.js")) && /<script src="extras\.js"><\/script>/.test(read("index.html")), "v68: extras.js cached and loaded");
  ok(read("index.html").indexOf("launch.js") < read("index.html").indexOf("extras.js"), "v68: extras loads after launch");
  // Utah: the gull now fills the glyph box like the other states, on the set's 1.6 ground line; no new animal art
  const SA = read("stamp-art.js"), gl = SA.slice(SA.indexOf("gull: function"), SA.indexOf("\n", SA.indexOf("gull: function")));
  ok(/scale\(1\.06 1\.5\)/.test(gl) && /, 1\.6\)/.test(gl) && !/, 1\.[45]\)/.test(gl), "v68: Utah gull drawn at the set's size and stroke");
  const ART = require(path.join(APP, "stamp-art.js"));
  const ut = ART.stampSVG ? ART.stampSVG("state", "UT", {}) : "";
  ok(typeof ut === "string" && /viewBox="0 0 160 160"/.test(ut), "v68: Utah renders in the same 160x160 frame as every state");
  // time zones: a valid date is valid everywhere (it was rejected east of UTC+12)
  const PC = require(path.join(APP, "passport-core.js"));
  if (PC.cleanDate) ok(PC.cleanDate("2026-07-10") === "2026-07-10" && PC.cleanDate("2026-02-30") === "" && PC.cleanDate("2026-12-31") === "2026-12-31", "v68: passport dates validate the same in every time zone (TZ=" + (process.env.TZ || "local") + ")");
  ok(!/toISOString\(\)\.slice\(0, 10\)/.test(read("firsts.js")) && !/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(read("recap.js")), "v68: firsts and recap use the phone's own date");
  // search
  const kids = [{ id: "zz_k1", name: "Zz Test Kid", states: { UT: { date: "2026-07-01" } }, places: {}, parks: {} }, { id: "zz_k2", name: "Zz Test Mom", states: { UT: {} }, places: {}, parks: {} }];
  const trips = [
    { id: "zz_t1", kidIds: ["zz_k1"], title: "Zz Test Desert Trip", place: "Moab", date: "2026-07-01", memory: "Arches at sunset", journal: [{ kid: "zz_k1", day: "2026-07-01", best: "Pancakes with Grandpa Zz", photoId: "zz_photo" }] },
    { id: "zz_t2", kidIds: ["zz_k2"], title: "Zz Test Beach", place: "Outer Banks", date: "2025-06-01" }
  ];
  const nm = { state: id => ({ UT: "Utah" })[id] || id };
  let r = X.search("pancakes", kids, trips, nm);
  ok(r.trips.length === 1 && r.trips[0].id === "zz_t1" && /Pancakes/.test(r.trips[0].snip), "v68: search finds journal text");
  ok(X.search("utah", kids, trips, nm).stamps.length === 1 && X.search("utah", kids, trips, nm).stamps[0].who.length === 2, "v68: search finds a stamp and who has it");
  ok(X.search("zz test", kids, trips, nm).people.length === 2 && X.search("moab arches", kids, trips, nm).trips.length === 1, "v68: search finds people and matches all words");
  ok(X.search("zz_photo", kids, trips, nm).trips.length === 0 && X.search("2026-07-01", kids, trips, nm).trips.length === 1, "v68: search skips ids but matches dates");
  ok(X.search("u", kids, trips, nm).trips.length === 0 && X.search("café", [{ id: "a", name: "Cafe Zz" }], [], nm).people.length === 1, "v68: short queries return nothing, accents ignored");
  ok(X.search("beach", kids, trips, nm).trips[0].kid === "zz_k2", "v68: trip result links to its traveler");
  // what's new
  ok(X.notesSince("v67").length === X.NOTES.length - 1 && X.notesSince("v66").length === X.NOTES.length && X.notesSince("v99").length === 0, "v68: what's new shows only newer notes");
  // rating prompt limits
  const D = 864e5, now = Date.parse("2026-10-24T20:00:00Z");
  ok(!X.shouldAsk({ first: now - 3 * D }, now) && X.shouldAsk({ first: now - 8 * D }, now), "v68: rating waits 7 days after first use");
  ok(!X.shouldAsk({ first: now - 200 * D, last: now - 30 * D, asks: 1 }, now) && X.shouldAsk({ first: now - 200 * D, last: now - 91 * D, asks: 1 }, now), "v68: rating at most once per 90 days");
  ok(!X.shouldAsk({ first: now - 900 * D, last: now - 300 * D, asks: 3 }, now) && !X.shouldAsk({ first: now - 90 * D, done: "yes" }, now) && !X.shouldAsk({ first: now - 90 * D, done: "no" }, now), "v68: rating stops after 3 asks or an answer");
  ok(X.fmtBytes(1500) === "2 KB" && X.fmtBytes(2.5e6) === "2.5 MB" && X.fmtBytes(3e9) === "3.0 GB", "v68: storage sizes read nicely");
  const EX = read("extras.js");
  ok(/fs:stamp/.test(EX) && /total >= 10/.test(EX) && /fs:stamp/.test(read("trips-ui.js")), "v68: rating is asked after a happy moment (10+ stamps)");
  // stamp moment: sound off by default, vibrate + animation kept
  const TU = read("trips-ui.js"), th = TU.slice(TU.indexOf("function thunk()"), TU.indexOf("function thunk()") + 200);
  ok(/FS_EXTRAS\.soundOn\(\)\) return/.test(th) && /ls\("fs-sound"\) === "on"/.test(EX), "v68: stamp sound is off unless switched on");
  ok(/navigator\.vibrate/.test(TU) && /stampfx/.test(TU), "v68: stamp animation and haptic kept");
  // undo bars instead of confirm dialogs
  ok(!/confirm\("Delete this postcard/.test(read("postcard.js")) && /undoToast\("Postcard deleted"/.test(read("postcard.js")), "v68: postcard delete has Undo, no confirm");
  ok(!/confirm\("Delete this station/.test(read("stations.js")) && /undoToast\("Station deleted/.test(read("stations.js")), "v68: station delete has Undo, no confirm");
  ok(!/confirm\("Delete the whole trip/.test(TU) && /restoreTrip\(old\.id\)/.test(TU), "v68: trip delete has Undo, no confirm");
  // lazy photos + print safety
  const AP = read("app.js");
  ok(/IntersectionObserver/.test(AP) && /beforeprint/.test(AP) && /bookpages, \.slide/.test(AP), "v68: photos load lazily, book/slideshow/print load all");
  // notifications: send hour + quiet hours
  const PU = read("push.js");
  ok(/p_hour: times\(\)\.hour/.test(PU) && !/p_hour: 9/.test(PU) && /push_set_quiet/.test(read("sync.js")), "v68: reminder hour and quiet hours reach the server");
  const PUSH = require(path.join(APP, "push.js"));
  ok(typeof PUSH.cleanKinds === "function", "v68: push.js still loads in node");
  // kids' privacy wording
  const PR = site("privacy/index.html");
  ok(/The parent owns the account/.test(PR) && /Kids can't create an account/.test(PR) && /never ask a child for an email/.test(PR), "v68: privacy page says the parent owns the account and kids never sign up");
  // SQL additive
  const q = "/workspace/famstamp-v68/notify-quiet.sql";
  if (fs.existsSync(q)) { const sql = fs.readFileSync(q, "utf8").replace(/--.*$/gm, ""); ok(!/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i.test(sql) && /add column if not exists/.test(sql), "v68: quiet-hours SQL is additive"); }
  ok(!/Zz/.test(JSON.stringify(X.NOTES)), "v68: release notes contain no test names");
}

// ---------- v69: sample family, field-trip log, time capsules, own login (13+), invite-a-family ----------
{
  const MO = require(path.join(APP, "more.js"));
  ok(/"more\.js"/.test(read("sw.js")) && /<script src="more\.js"><\/script>/.test(read("index.html")) && read("index.html").indexOf("extras.js") < read("index.html").indexOf("more.js"), "v69: more.js cached and loaded after extras");
  // demo
  const sd = MO.sampleData(new Date("2026-10-24T12:00:00"));
  ok(sd.kids.length === 3 && sd.trips.length === 3 && sd.kids.every(k => /sample/i.test(k.name) && k.sample) && sd.trips.every(t => t.sample && /^Sample:/.test(t.title)), "v69: sample family is clearly labeled sample");
  ok(!/Zz/.test(JSON.stringify(sd)) && !/@|\d{3}-\d{3}-\d{4}/.test(JSON.stringify(sd)), "v69: sample data has no Zz, emails or phone numbers");
  ok(sd.trips.every(t => t.kidIds.every(id => sd.kids.some(k => k.id === id))), "v69: sample trips point at sample people");
  ok(/sessionStorage\.getItem\("fs-demo"\) === "1"\) DB_NAME = "mltl-demo"/.test(read("app.js")), "v69: sample family uses its own throwaway database");
  ok(/demo = sessionStorage\.getItem\("fs-demo"\) === "1"/.test(read("launch.js")) && /return !demo &&/.test(read("launch.js")), "v69: no usage counts from the sample family");
  ok(/isDemo\(\) && \(h\[0\] === "sync"/.test(read("more.js")), "v69: Family Sync is blocked in the sample family");
  // field-trip log
  ok(MO.schoolYear("2026-09-03") === "2026-27" && MO.schoolYear("2026-07-31") === "2025-26" && MO.schoolYear("2026-08-01") === "2026-27", "v69: school year runs Aug to Jul");
  const cf = MO.cleanField({ on: 1, subjects: ["Science", "Hacking"], hours: "2.3", learned: "x".repeat(2000) });
  ok(cf.on === true && cf.subjects.join() === "Science" && cf.hours === 2.25 && cf.learned.length === 1000, "v69: field-trip details are cleaned");
  ok(MO.cleanField({ hours: 99 }).hours === 24 && MO.cleanField({ hours: -3 }).hours === 0, "v69: hours clamp 0-24");
  const ft = [
    { id: "zz1", kidIds: ["zzk"], date: "2026-09-10", title: "Zz Test Museum", field: { on: true, subjects: ["History"], hours: 2 } },
    { id: "zz2", kidIds: ["zzk"], date: "2026-10-01", title: "Zz Test Farm", field: { on: true, subjects: ["Science"], hours: 1.5 } },
    { id: "zz3", kidIds: ["zzk"], date: "2026-10-02", title: "Zz Test Not field" },
    { id: "zz4", kidIds: ["zzk"], date: "2026-06-01", title: "Zz Test Last year", field: { on: true, hours: 4 } },
    { id: "zz5", kidIds: ["zzk"], date: "2026-09-12", title: "Zz Test Deleted", field: { on: true, hours: 9 }, deletedAt: "2026-09-13" },
    { id: "zz6", kidIds: ["zzo"], date: "2026-09-12", title: "Zz Test Other kid", field: { on: true, hours: 9 } }
  ];
  const fl = MO.fieldLog(ft, "zzk", "2026-27");
  ok(fl.rows.map(r => r.id).join() === "zz1,zz2" && fl.hours === 3.5, "v69: field-trip log picks the kid's marked trips for the year, totals hours");
  ok(MO.fieldLog(ft, "zzk", "2025-26").hours === 4, "v69: earlier school year separate");
  ok(/window\.print\(\)/.test(read("more.js")) && /signature/.test(read("more.js")), "v69: field-trip log prints / saves as PDF with a signature line");
  // capsules
  const kidNo = { id: "zzk" }, kidYes = { id: "zzk", ownLogin: "2026-10-24" };
  ok(!MO.capsuleOpen({ unlock: "date", date: "2027-01-01" }, kidNo, "2026-12-31") && MO.capsuleOpen({ unlock: "date", date: "2027-01-01" }, kidNo, "2027-01-01"), "v69: date capsule opens on its day");
  ok(!MO.capsuleOpen({ unlock: "login" }, kidNo, "2099-01-01") && MO.capsuleOpen({ unlock: "login" }, kidYes, "2026-10-24"), "v69: login capsule opens when the kid has their own login");
  ok(!MO.capsuleOpen({ unlock: "date", date: "" }, kidNo, "2099-01-01"), "v69: capsule without a date stays shut");
  const cc = MO.cleanCapsule({ id: "cap_zz", text: "y".repeat(3000), unlock: "login", date: "2027-01-01" });
  ok(cc.text.length === 2000 && cc.date === "" && cc.unlock === "login", "v69: capsules are cleaned");
  ok(/capsules/.test(read("more.js")) && /a\.saveKid\(stamp\(k\)\)/.test(read("more.js")), "v69: capsules live on the person so they sync with the family");
  // own login
  ok(MO.canGraduate({ role: "kid", birthYear: 2013 }, 2026) && !MO.canGraduate({ role: "kid", birthYear: 2014 }, 2026) && !MO.canGraduate({ role: "kid" }, 2026) && !MO.canGraduate({ role: "adult", birthYear: 1990 }, 2026), "v69: own login only for kids 13+ with a birth year");
  ok(/I\\'m their parent or guardian/.test(read("more.js")) && /p_confirm13: true/.test(read("more.js")), "v69: a parent has to confirm");
  ok(/function viewGrad/.test(read("sync.js")) && /sess\.anon \|\| !sess\.email/.test(read("sync.js")) && /redeem_graduation/.test(read("sync.js")), "v69: teen redeems only with their own signed-in account");
  // SQL
  const q = "/workspace/famstamp-v69/v69-graduate-referrals.sql";
  if (fs.existsSync(q)) {
    const sql = fs.readFileSync(q, "utf8").replace(/--.*$/gm, "");
    ok(!/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i.test(sql), "v69: SQL is additive (no drop/truncate/delete)");
    ok(/p_birth_year < 13/.test(sql) && /p_confirm13/.test(sql) && /role in \('owner', 'adult'\)/.test(sql), "v69: SQL enforces 13+, parent confirm, parent role");
    ok((sql.match(/enable row level security/g) || []).length === 3 && /from public, anon/.test(sql), "v69: new tables locked down, functions not for anon");
  }
  ok(!/billing|charge\(|stripe|polar/i.test(read("more.js").replace(/Nothing is charged today|no billing/gi, "")), "v69: invite flow makes no billing calls");
}

// ---------- v70: new navigation, grandparent simple view, report a problem, persistent storage ----------
{
  const NV = require(path.join(APP, "nav.js")), RB = require(path.join(APP, "robust.js"));
  const ix = read("index.html");
  ok(/"nav\.js"/.test(read("sw.js")) && /"robust\.js"/.test(read("sw.js")) && ix.indexOf("robust.js") > ix.indexOf("cup.js") && ix.indexOf("nav.js") > ix.indexOf("robust.js"), "v70: nav.js and robust.js cached and loaded last");
  ok(NV.tabOf("#/") === "home" && NV.tabOf("#/p/zzk/us") === "map" && NV.tabOf("#/p/zzk/world") === "map" && NV.tabOf("#/family") === "map" && NV.tabOf("#/trips") === "trips" && NV.tabOf("#/p/zzk/trip/zz1") === "trips" && NV.tabOf("#/fieldtrips") === "trips" && NV.tabOf("#/p/zzk/stats") === "more" && NV.tabOf("#/sync") === "more", "v70: every screen belongs to one bottom tab");
  ok(NV.isRoot("#/") && NV.isRoot("#/trips") && NV.isRoot("#/more") && NV.isRoot("#/p/zzk/parks") && !NV.isRoot("#/p/zzk/trip/zz1") && !NV.isRoot("#/p/zzk/stats") && !NV.isRoot("#/help") && !NV.isRoot("#/trips/zzk"), "v70: back arrow on every inner screen, not on tab roots");
  ok(NV.isRoot("#/highlights", true) && NV.isRoot("#/news", true) && !NV.isRoot("#/help", true), "v70: grandparent roots");
  ok(NV.grandAllowed("#/highlights") && NV.grandAllowed("#/recap/2026-10-24") && NV.grandAllowed("#/news") && NV.grandAllowed("#/more") && !NV.grandAllowed("#/p/zzk/trips/new") && !NV.grandAllowed("#/p/zzk/edit") && !NV.grandAllowed("#/backup") && NV.grandAllowed("#/sync") && NV.grandAllowed("#/report"), "v70: grandparent view keeps editing screens out (v75: Family and sign-in and Report a problem allowed)");
  const tl = NV.tripList([{ id: "a", date: "2025-01-01", kidIds: ["zzk"] }, { id: "b", date: "2026-05-01", kidIds: ["zzo"] }, { id: "c", date: "2026-01-01", kidIds: ["zzk", "zzo"], deletedAt: "x" }, { id: "d", date: "2026-02-01", kidIds: ["zzk"] }]);
  ok(tl.map(t => t.id).join() === "b,d,a", "v70: trips newest first, deleted left out");
  ok(NV.tripList(tl, "zzk").map(t => t.id).join() === "d,a", "v70: trips filtered by person id");
  ok(NV.emojiOnly("🔎") && NV.emojiOnly(" ✨ ") && !NV.emojiOnly("🔎 Search") && !NV.emojiOnly("+") && !NV.emojiOnly(""), "v70: emoji-only detection");
  ok(NV.TOUR.length === 3, "v70: 3-step tour");
  const mg = NV.moreGroups({ who: "zzk", sync: true }), titles = mg.map(g => g[0]).join("|"), hrefs = [].concat(...mg.map(g => g[1].map(l => l[1])));
  ok(titles === "Our family|Earn|Play & make|Share & keep|Account", "v70: More is grouped");
  ["#/games", "#/postcards", "#/stations", "#/cup", "#/year", "#/recap", "#/follow", "#/capsules", "#/fieldtrips", "#/invite", "#/sync", "#/backup", "#/deleted", "#/help", "#/report", "#/p/zzk/stats", "#/p/zzk/quests", "#/p/zzk/rewards", "#/p/zzk/firsts", "#/p/zzk/print", "#/p/zzk/book", "#/family/passport", "#/family/wishes", "#/together/top", "#/near", "#/feed"].forEach(h => ok(hrefs.indexOf(h) >= 0, "v70: More reaches " + h));
  ok(mg.every(g => g[1].every(l => /[A-Za-z]/.test(l[0]))), "v70: every More item has words");
  const nav = read("nav.js");
  ok(/history\.back\(\)/.test(nav) && /fsd/.test(nav), "v70: back arrow uses the same history as the phone's Back");
  ok(/Report a problem/.test(nav) && /Kid mode/.test(nav) && /Switch to the full app/.test(nav) && /How to use this/.test(nav), "v70: kid mode, grandparent switch and tip present");
  ok(/body\.grandview main[^{]*\{[^}]*font-size:19px/.test(read("app.css")) && /body\.grandview main a, body\.grandview main button \{ min-height:48px/.test(read("app.css")), "v70: grandparent view: big text and 48px targets");
  ok(/rxl/.test(read("highlights.js")), "v70: reaction buttons have words");
  ok(!/"(?:Zz|zz)/.test(nav.replace(/\/\/.*$/gm, "")), "v70: no test data in the app code");
  // report a problem
  const dirty = "TypeError: cannot read 'Zz Rome' of person_zz00000000kid01 at https://x.example/travel-log/app/trips-ui.js?v=1:12 mail zz@example.com id 123456789";
  const cl = RB.clean(dirty);
  ok(!/Zz Rome|zz@example|kid01|123456789|https/.test(cl) && /trips-ui\.js/.test(cl) && /person_<id>/.test(cl), "v70: error log strips names, ids, emails and links");
  let lg = []; for (let i = 0; i < 20; i++) lg = RB.addLog(lg, "err " + i, "2026-10-24T20:00");
  ok(lg.length === RB.MAX_LOG && lg[lg.length - 1].m === "err 19", "v70: error log is capped");
  lg = RB.addLog(RB.addLog([], "same", "a"), "same", "b"); ok(lg.length === 1 && lg[0].n === 2, "v70: repeated errors counted once");
  const mail = RB.reportMail({ to: "support@darklighthousesolutions.com", what: "Zz test", version: "v70", platform: "Android Chrome", route: "home", log: lg });
  ok(mail.startsWith("mailto:support@darklighthousesolutions.com?subject=") && /v70/.test(decodeURIComponent(mail)) && /Zz test/.test(decodeURIComponent(mail)), "v70: report is a mailto with the version");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(read("robust.js")), "v70: report never sends anything by itself");
  ok(/navigator\.storage\.persist/.test(read("robust.js")), "v70: asks for persistent storage");
}

// ---------- v71: robustness (merge per-person pieces, failed uploads, drafts, duplicate trips, restore preview, weekly copy) ----------
{
  const S = require(path.join(APP, "sync-core.js")), RB = require(path.join(APP, "robust.js"));
  const K1 = "person_zz00000000kid01", K2 = "person_zz00000000kid02";
  // B4: two phones write different kids' journal pages on the same trip; both survive
  const base = { id: "trip_zzrome0001", kidIds: [K1, K2], place: "Zz Rome", date: "2026-07-01", updatedAt: "2026-07-02T10:00:00.000Z" };
  const sh = S.emptyShadow ? S.emptyShadow() : { people: {}, visits: {}, trips: {}, photos: {} };
  sh.trips[base.id] = base.updatedAt;
  const mine = Object.assign(JSON.parse(JSON.stringify(base)), { journal: [{ id: "ja", kid: K1, day: "2026-07-01", best: "Zz gelato", at: "2026-07-02T11:00:00.000Z" }], updatedAt: "2026-07-02T11:00:00.000Z" });
  const theirs = Object.assign(JSON.parse(JSON.stringify(base)), { journal: [{ id: "jb", kid: K2, day: "2026-07-01", best: "Zz colosseum", at: "2026-07-02T12:00:00.000Z" }] });
  // remote newer than our edit: remote wins the trip, our page is kept and the trip goes back up
  let local = { people: [], trips: [JSON.parse(JSON.stringify(mine))], photoIds: [] };
  let ch = S.applyPull(local, sh, { trips: [{ id: base.id, data: theirs, updated_at: "2026-07-02T12:00:00.000Z", deleted: false, traveler_ids: [K1, K2] }] });
  let t = local.trips[0];
  ok(t.journal.length === 2 && t.journal.some(j => j.kid === K1) && t.journal.some(j => j.kid === K2), "v71: newer remote trip keeps our kid's journal page too");
  ok(ch.merged === 1 && sh.trips[base.id] !== t.updatedAt && S.planPush(local, sh, "fam_zz").trips.length === 1, "v71: merged trip is pushed back up");
  // ours newer: we keep ours and add theirs
  const sh2 = { people: {}, visits: {}, trips: { [base.id]: base.updatedAt }, photos: {} };
  local = { people: [], trips: [Object.assign(JSON.parse(JSON.stringify(mine)), { updatedAt: "2026-07-02T13:00:00.000Z" })], photoIds: [] };
  S.applyPull(local, sh2, { trips: [{ id: base.id, data: theirs, updated_at: "2026-07-02T12:00:00.000Z", deleted: false }] });
  ok(local.trips[0].journal.length === 2, "v71: our newer trip also gets their journal page");
  // not dirty, nothing extra: plain replace, no ping-pong
  const sh3 = { people: {}, visits: {}, trips: { [base.id]: "2026-07-02T13:00:00.000Z" }, photos: {} };
  const same = Object.assign(JSON.parse(JSON.stringify(base)), { journal: t.journal, updatedAt: "2026-07-02T13:00:00.000Z" });
  local = { people: [], trips: [JSON.parse(JSON.stringify(same))], photoIds: [] };
  ch = S.applyPull(local, sh3, { trips: [{ id: base.id, data: Object.assign({}, same, { memory: "Zz new note" }), updated_at: "2026-07-02T14:00:00.000Z", deleted: false }] });
  ok(!ch.merged && local.trips[0].memory === "Zz new note" && S.planPush(local, sh3, "fam_zz").trips.length === 0, "v71: nothing extra = plain update, no echo push");
  // deleted page doesn't come back
  const J = require(path.join(APP, "journal.js"));
  if (J && J.upsert) {
    const tt = JSON.parse(JSON.stringify(mine)); J.upsert(tt, K1, "2026-07-01", { best: "" }, "2026-07-03T00:00:00.000Z");
    ok(tt.journal.length === 0 && tt.journalGone && tt.journalGone[K1 + "|2026-07-01"], "v71: clearing a page leaves a tombstone");
    const back = JSON.parse(JSON.stringify(tt)); S.mergeTripPieces(back, mine);
    ok(back.journal.length === 0, "v71: a merge can't bring a deleted page back");
    const later = JSON.parse(JSON.stringify(tt)); S.mergeTripPieces(later, { journal: [{ id: "jc", kid: K1, day: "2026-07-01", best: "Zz rewritten", at: "2026-07-04T00:00:00.000Z" }] });
    ok(later.journal.length === 1, "v71: a page written after the delete still arrives");
  } else ok(/journalGone/.test(read("journal.js")), "v71: journal tombstones");
  // game boards: found squares from both phones
  const g1 = { games: { "bingo|2026-07-01": { found: ["a", "b"], who: [K1], done: "" } } }, g2 = { games: { "bingo|2026-07-01": { found: ["c"], who: [K2], done: "2026-07-01" }, "hunt|2026-07-02": { found: ["x"], who: [K2], done: "" } } };
  ok(S.mergeTripPieces(g1, g2) && g1.games["bingo|2026-07-01"].found.length === 3 && g1.games["bingo|2026-07-01"].who.length === 2 && g1.games["bingo|2026-07-01"].done && g1.games["hunt|2026-07-02"], "v71: game boards merge square by square");
  ok(!S.mergeTripPieces(g1, g2), "v71: merging the same thing twice changes nothing");
  // person pieces: game stamps and capsules
  const sp = { people: { [K1]: "2026-07-01T00:00:00.000Z" }, visits: {}, trips: {}, photos: {} };
  const me = { id: K1, name: "Zz Kid", states: {}, places: {}, parks: {}, games: { g1: { at: "2026-07-01", kind: "bingo" } }, capsules: [{ id: "c1" }], updatedAt: "2026-07-01T00:00:00.000Z" };
  local = { people: [me], trips: [], photoIds: [] };
  ch = S.applyPull(local, sp, { people: [{ id: K1, data: { name: "Zz Kid", games: { g2: { at: "2026-07-02", kind: "hunt" } }, capsules: [{ id: "c2" }] }, updated_at: "2026-07-03T00:00:00.000Z", deleted: false }] });
  ok(Object.keys(me.games).length === 2 && me.capsules.length === 2 && ch.merged === 1, "v71: a person's game stamps and time capsules merge");
  const gone = { capsules: [{ id: "c2" }], capsGone: ["c1"] }; S.mergePersonPieces(gone, { capsules: [{ id: "c1" }, { id: "c2" }] });
  ok(gone.capsules.length === 1 && gone.capsules[0].id === "c2", "v71: a deleted time capsule stays deleted");
  ok(/capsGone/.test(read("more.js")), "v71: deleting a capsule leaves a tombstone");
  ok(/if \(mergedIn\) \{ mergedIn = 0; return push\(\); \}/.test(read("sync.js")), "v71: merged pieces go straight back up");
  // B3: failed uploads and stuck sync
  ok(/c\.failed\[u\.id\] = f/.test(read("sync.js")) && /if \(c\.failed\) delete c\.failed\[u\.id\]/.test(read("sync.js")) && /health: function/.test(read("sync.js")), "v71: failed photo uploads are recorded and cleared");
  const now = Date.parse("2026-10-24T20:00:00Z");
  ok(RB.stuckInfo({ on: true, lastSync: "2026-10-24T10:00:00Z", pending: 3, status: "synced" }, now).pending === 3, "v71: changes waiting 10 hours = stuck");
  ok(!RB.stuckInfo({ on: true, lastSync: "2026-10-24T18:00:00Z", pending: 3, status: "error" }, now), "v71: 2 hours isn't stuck yet");
  ok(!RB.stuckInfo({ on: true, lastSync: "2026-10-20T10:00:00Z", pending: 0, status: "synced" }, now), "v71: nothing waiting isn't stuck");
  ok(!RB.stuckInfo({ on: false, pending: 3 }, now) && RB.stuckInfo({ on: true, lastSync: "", pending: 1, status: "error", msg: "x" }, now).error === "x", "v71: off isn't stuck; never synced with an error is");
  ok(RB.failedList({ failed: { photo_zz1: { trip: "trip_zz1", n: 2, why: "too big" } } })[0].why === "too big", "v71: failed list");
  // B2: drafts
  ok(!RB.draftUseful({ route: [{ name: "Zz Home" }] }, true) && RB.draftUseful({ route: [{ name: "Zz Home" }, { name: "Zz Rome" }] }, true) && RB.draftUseful({ route: [{ name: "Zz Rome" }] }, false) && RB.draftUseful({ route: [], title: "Zz" }, true), "v71: a draft is kept once something is entered");
  ok(RB.draftFresh({ d: {}, at: new Date().toISOString() }) && !RB.draftFresh({ d: {}, at: "2020-01-01T00:00:00Z" }), "v71: drafts older than 30 days are dropped");
  const tu = read("trips-ui.js");
  ok(/RB\.resumeDraft\(k\.id\)/.test(tu) && /RB\.watchDraft\(k\.id/.test(tu) && /RB\.clearDraft\(\)/.test(tu), "v71: the builder saves, restores and clears the draft");
  // B10: duplicates
  const r1 = { id: "trip_zz1", kidIds: [K1], place: "Zz Rome", date: "2026-07-01", route: [{ name: "Zz Home" }, { name: "Zz Rome" }], memory: "Zz pizza", stays: [{ n: 1 }] };
  const r2 = { id: "trip_zz2", kidIds: [K2, K1], place: "Zz Rome", date: "2026-07-02", route: [{ name: "Zz Home" }, { name: "Zz Rome" }, { name: "Zz Florence" }], memory: "Zz trains", endDate: "2026-07-09", stays: [{ n: 1 }, { n: 2 }] };
  ok(RB.dupMatch(r2, [r1]) === r1, "v71: same people, same place, a day apart = duplicate");
  ok(!RB.dupMatch(Object.assign({}, r2, { date: "2026-07-05" }), [r1]) && !RB.dupMatch(Object.assign({}, r2, { kidIds: ["person_zzother"] }), [r1]) && !RB.dupMatch(Object.assign({}, r2, { place: "Zz Paris", route: [{ name: "Zz Home" }, { name: "Zz Paris" }] }), [r1]), "v71: different dates, people or places aren't duplicates");
  ok(!RB.dupMatch(r2, [Object.assign({}, r1, { deletedAt: "2026-07-03" })]), "v71: deleted trips aren't duplicates");
  const mg = RB.mergeDup(r1, r2, "2026-07-10T00:00:00Z");
  ok(mg.id === r1.id && mg.kidIds.length === 2 && mg.route.length === 3 && /Zz pizza/.test(mg.memory) && /Zz trains/.test(mg.memory) && mg.endDate === "2026-07-09" && mg.stays.length === 2 && mg.date === "2026-07-01", "v71: merge keeps everything and adds the new");
  ok(/RB\.dupMatch\(trip, st\.trips\)/.test(tu) && /dupOk === "merge"/.test(tu), "v71: the builder asks before saving a duplicate");
  // B9: restore preview
  const pv = RB.restorePreview({ exportedAt: "2026-10-01T00:00:00Z", kids: [{ id: K1, name: "Zz A" }, { id: "person_zzgone", name: "Zz B" }], trips: [r1, Object.assign({}, r2, { updatedAt: "2026-01-01" })], photos: [{ id: "photo_zz1" }] },
    [{ id: K1, name: "Zz A" }, { id: K2, name: "Zz C" }], [Object.assign({}, r2, { updatedAt: "2026-09-01" })], []);
  ok(pv.addPeople.length === 1 && pv.updPeople.length === 1 && pv.addTrips.length === 1 && pv.keepTrips.length === 1 && pv.updTrips.length === 0 && pv.newPhotos === 1 && pv.stayPeople === 1 && pv.stayTrips === 0, "v71: restore preview counts what comes back, what's replaced and what stays");
  ok(/function restoreBackup\(data(, mode)?\)/.test(read("app.js")) && /askRestore\(data\)/.test(read("app.js")) && !/if \(!confirm\("Restore " \+ data\.kids\.length/.test(read("app.js")), "v71: restore always previews first");
  // B5: weekly copy
  ok(RB.autoDue("", now) && RB.autoDue("2026-10-10T00:00:00Z", now) && !RB.autoDue("2026-10-20T00:00:00Z", now), "v71: a copy is due weekly");
  ok(/makeBackup\(st\.kids, st\.trips\.concat\(st\.bin \|\| \[\]\), \[\]/.test(read("robust.js")) && /KEEP = 4/.test(read("robust.js")), "v71: weekly copies skip photos and keep the last 4");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(read("robust.js")), "v71: nothing in robust.js goes over the network");
  ok(/FS_ROBUST\.decorate/.test(read("nav.js")), "v71: cards drawn after each screen");
  ok(/rbempty/.test(read("robust.js")), "v71: empty family map says what to do");
}

// ---- v73: waitlist published, policies self-reviewed (Play User Data / deletion / Families / Data safety, COPPA basics), referral reward ----
{
  const ROOTDIR = path.join(__dirname, "..");
  const site = f => fs.readFileSync(path.join(ROOTDIR, "travel-log", f), "utf8");
  const root = f => fs.readFileSync(path.join(ROOTDIR, f), "utf8");
  ok(/var VERSION = "v(7[3-9]|[89]\d)"/.test(read("app.js")) && /mltl-v(7[3-9]|[89]\d)/.test(read("sw.js")), "v73: version and cache bumped");
  const wl = site("waitlist/index.html");
  ok(!/DRAFT|Draft|not public/.test(wl) && /<title>Get notified when Famstamp launches<\/title>/.test(wl) && /<h1>Get notified when <span data-brand>Famstamp<\/span> launches<\/h1>/.test(wl), "v73: waitlist page is published with the brand name marked");
  ok(/data-mail="support" data-subject="\{name\} unsubscribe"/.test(wl) && /unsubscribe/i.test(wl) && /privacy\/#waitlist/.test(wl), "v73: waitlist says how to unsubscribe (support@) and links the policy");
  ok(/src=home/.test(root("index.html")) && /travel-log\/app\/brand\.js/.test(root("index.html")) && /src=travel/.test(root("travel/index.html")) && /travel-log\/waitlist\//.test(root("sitemap.xml")), "v73: waitlist linked from the home page and Travel home, and in the sitemap");
  ["privacy", "terms", "support", "delete-account", "waitlist"].forEach(p => ok(/href="\/travel-log\/waitlist\/">Get notified<\/a>/.test(site(p + "/index.html")), "v73: " + p + " links the waitlist"));
  ["privacy", "terms", "delete-account", "waitlist", "README.md"].forEach(p => ok(!/lawyer/i.test(site(p === "README.md" ? p : p + "/index.html")), "v73: no lawyer note in " + p));
  const pv = site("privacy/index.html");
  ["who", "kids", "device", "sync", "photos", "stats", "share", "email", "waitlist", "invites", "keep", "delete", "security", "changes"].forEach(id => ok(new RegExp('id="' + id + '"').test(pv), "v73: privacy has #" + id));
  ok(/COPPA/.test(pv) && /parent or guardian/.test(pv) && /journal pages/.test(pv) && /30 days/.test(pv) && /advertising id/i.test(pv), "v73: privacy gives parents a direct notice (what kids add, consent, review/delete, response time)");
  ok(/delete the whole waitlist within 3 months/.test(pv) && /Error reports<\/b>: up to 90 days/.test(pv) && /1 free month of Premium/.test(pv), "v73: privacy states waitlist and error retention and the referral record");
  const del = site("delete-account/index.html");
  ok(/Dark Lighthouse Solutions/.test(del.split("<footer")[0]) && /Delete only some data/.test(del) && /within 30 days/.test(del) && /referral/.test(del), "v73: deletion page names the developer, covers partial deletion, retention and referrals");
  ok(/1 free month of Premium/.test(site("terms/index.html")) && /no cash value/.test(site("terms/index.html")), "v73: terms state the referral reward");
  // referral config lives with the brand
  const BR = require(path.join(ROOTDIR, "travel-log/app/brand.js"));
  ok(BR.REFERRAL && BR.REFERRAL.REWARD === "1 free month of Premium" && BR.REFERRAL.BOTH === true && BR.REFERRAL.LIVE === false, "v73: FS_BRAND.REFERRAL = both families, 1 free month of Premium, not live until payments");
  const mo = read("more.js");
  ok(/function refPromise\(\)/.test(mo) && /esc\(refPromise\(\)\)/.test(mo) && !/both families get a free month once paid plans start/.test(mo), "v73: invite screen copy comes from FS_BRAND.REFERRAL");
  ok(/a\.querySelector\("\.logomark"\)/.test(read("brand.js")), "v73: brand.js leaves other sites' .brand header alone");
  // kid code needs a parent/guardian OK first
  const sy = read("sync.js");
  ok(/function kidGate\(go\)/.test(sy) && /if \(srole\(\) === "kid" && !kidOk\(\)\) \{ kidGate/.test(sy) && /parent or legal guardian/.test(sy) && /id="kidgo" disabled/.test(sy) && /privacy\/#kids/.test(sy), "v73: first kid code needs the parent notice and tick");
  ok(/v: "v73"/.test(read("extras.js")), "v73: what's new note");
}

// ---- v74: one minified script bundle for a fast first visit ----
{
  const ix = read("index.html"), live = ix.replace(/<!--[\s\S]*?-->/g, ""), bl = BUNDLE.list(), bun = read("app-bundle.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  ok(/var VERSION = "v(7[4-9]|[89]\d)"/.test(read("app.js")) && /mltl-v(7[4-9]|[89]\d)/.test(swr), "v74: version and cache bumped");
  ok((live.replace(/<script src="theme\.js"><\/script>/, "").match(/<script\b/g) || []).length === 1 && /<script src="app-bundle\.js"><\/script>/.test(live), "v74: the page loads only app-bundle.js (plus the tiny v86 theme.js in the head)");
  ok(bl.length >= 50 && bl[0] === "brand.js" && bl[1] === "launch.js" && bl[bl.length - 1] === "nav.js" && new Set(bl).size === bl.length && bl.every(f => fs.existsSync(path.join(APP, f))), "v74: bundle list in order, no repeats, every file exists");
  ok(bun.indexOf("/* Famstamp app bundle " + BUNDLE.hash(bl) + ":") === 0, "v74: app-bundle.js is up to date with its sources (rebuild: node scripts/build_app_bundle.js)");
  ok(/"app-bundle\.js"/.test(swr) && !/"app\.js"/.test(swr) && fs.existsSync(path.join(APP, "app-bundle.js.map")), "v74: the offline cache holds the bundle, not 54 separate files; source map shipped");
  ok(bun.length < bl.reduce((n, f) => n + fs.statSync(path.join(APP, f)).size, 0) * 0.8, "v74: the bundle is minified");
  ok(!/sourceMappingURL/.test(swr) && /sourceMappingURL=app-bundle\.js\.map/.test(bun), "v74: source map linked for debugging only");
}
ok(/keep whatever someone is typing/.test(read("more.js")) && /n\.value = keep\.v/.test(read("more.js")), "v74: the field-trip log keeps typed words when it redraws");
// ---- v75: small-phone top bar + grandparent view fixes ----
{
  const css = read("app.css"), nav = read("nav.js");
  ok(/var VERSION = "v(7[5-9]|[89]\d)"/.test(read("app.js")) && /mltl-v(7[5-9]|[89]\d)/.test(fs.readFileSync(path.join(APP, "sw.js"), "utf8")), "v75: version and cache bumped");
  ok(/@media \(max-width:400px\)[\s\S]*\.topbar:has\(\.navback:not\(\[hidden\]\)\) \.navsearch \.tl/.test(css), "v75: inner pages on small phones hide the search label so the top bar fits");
  ok(/@media \(max-width:340px\)[\s\S]*\.topbar:has\(\.famchip:not\(\[hidden\]\)\) \.navsearch \.tl/.test(css) && /\.topright \.famchip \{ max-width:4\.4rem !important; \}/.test(css), "v75: 320px with the family chip fits");
  ok(/GRAND_OK[^;]*report: 1/.test(nav) && /GRAND_OK[^;]*sync: 1/.test(nav) && /href="#\/sync">Family and sign-in/.test(nav), "v75: grandparent view can report a problem and reach Family and sign-in");
}

// ---- v86: dark mode (follows the phone, plus Auto/Light/Dark in More) ----
{
  const ix = read("index.html"), th = read("theme.js"), dk = read("dark.css"), ex = read("dark-extra.css"), nav = read("nav.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  ok(/var VERSION = "v(8[6-9]|9\d)"/.test(read("app.js")) && /mltl-v(8[6-9]|9\d)/.test(swr), "v86: version and cache bumped");
  ok(ix.indexOf('href="dark.css"') > ix.indexOf('href="map.css"') && ix.indexOf('src="theme.js"') < ix.indexOf("</head>"), "v86: dark.css after the light sheets; theme.js in the head (no white flash)");
  ok(/"dark\.css"/.test(swr) && /"theme\.js"/.test(swr), "v86: dark.css and theme.js cached for offline");
  ok(/prefers-color-scheme: dark/.test(th) && /fs-theme/.test(th) && /addEventListener\("change"/.test(th), "v86: Auto follows the phone setting, live");
  ok(/data-theme-set="' \+ v/.test(nav) && /b\("auto", "Auto"\) \+ b\("light"/.test(nav) && (nav.match(/themeHTML\(\)/g) || []).length >= 3, "v86: Auto/Light/Dark switch on More (full and grandparent views)");
  ok(/GENERATED by scripts\/build_dark_css\.py/.test(dk) && dk.indexOf(ex.trim().slice(0, 60)) > 0, "v86: dark.css is generated and includes dark-extra.css");
  ok(dk.split("\n").filter(l => /\{/.test(l) && !/^\s*@media|^\/\*/.test(l)).every(l => /html\[data-theme="dark"\]/.test(l)), "v86: every dark rule is scoped to dark mode");
  ok(!/\.pbook|\.ppage[^a-z-]/.test(dk.split("/* dark-extra.css */")[0].replace(/\/\*[\s\S]*?\*\//g, "")), "v86: passport pages and stamps are left as printed paper");
  ok(/:is\(\.ppage, \.signbook/.test(ex) && /--navy-ink:#16283a/.test(ex), "v86: paper restores light ink inside passport pages and signs");
  const gen = require("child_process").execFileSync("python3", [path.join(__dirname, "build_dark_css.py"), "--check"], { encoding: "utf8" });
  ok(/up to date/.test(gen), "v86: dark.css matches the light CSS (run scripts/build_dark_css.py after CSS changes)");
}

// ---- v87: placeholder avatars (swappable set in avatars.js) ----
{
  const AV = require(path.join(APP, "avatars.js")), ix = read("index.html"), app = read("app.js"), tu = read("trips-ui.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  ok(/var VERSION = "v(8[7-9]|9\d)"/.test(app) && /mltl-v(8[7-9]|9\d)/.test(swr), "v87: version and cache bumped");
  ok(AV.list.length >= 16 && AV.list.some(a => a.group === "kid") && AV.list.some(a => a.group === "adult"), "v87: kid and grown-up avatars");
  ok(new Set(AV.list.map(a => a.id)).size === AV.list.length && AV.list.every(a => /^[a-z]\d+$/.test(a.id) && a.label), "v87: ids are unique and each has a spoken label");
  ok(AV.list.every(a => /^<svg class="avimg" viewBox="0 0 64 64"[^>]*>[\s\S]+<\/svg>$/.test(AV.html(a.id)) && !/<script|on\w+=|href/i.test(AV.html(a.id))), "v87: every avatar is a plain drawing");
  ok(AV.html("nope") === "" && AV.html('"><img src=x>') === "" && !AV.has("__proto__") && !AV.has(undefined), "v87: unknown ids draw nothing (fall back to the initial)");
  ok(/class="avpick" data-av=""/.test(AV.pickerHTML("", "Z")) && (AV.pickerHTML("k2", "Z").match(/aria-pressed="true"/g) || []).length === 1, "v87: picker has a letter option and marks the current pick");
  ok(/AV && AV\.has\(x\.av\)\) return AV\.html\(x\.av\)/.test(app), "v87: a person's badge uses their avatar, else their initial");
  ok(/kidForm|viewKidForm/.test(app) && /FS_AVATARS\.pickerHTML\(av/.test(app) && /AV\.pickerHTML\(av/.test(tu), "v87: pickable on Add/Edit person and on About me");
  ok(ix.indexOf('src="avatars.js"') > 0 && ix.indexOf('src="avatars.js"') < ix.indexOf('src="app.js"') && BUNDLE.list().indexOf("avatars.js") >= 0, "v87: avatars.js is in the bundle before app.js");
  ok(/TO SWAP IN THE NEW SET/.test(read("avatars.js")), "v87: swap instructions at the top of avatars.js");
}

// ---- v88: bookings forwarded by email (trips+CODE@) ----
{
  const tu = read("trips-ui.js"), nav = read("nav.js"), app = read("app.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  const MAIL = path.join(APP, "..", "mail"), gs = fs.readFileSync(path.join(MAIL, "famstamp-mail.gs"), "utf8"), sql = fs.readFileSync(path.join(MAIL, "booking-inbox.sql"), "utf8");
  ok(/var VERSION = "v(8[8-9]|9\d)"/.test(app) && /mltl-v(8[8-9]|9\d)/.test(swr), "v88: version and cache bumped");
  ok(/mailInbox: mailInbox/.test(tu) && /UI\.mailInbox\(a\.main\)/.test(nav), "v88: Trips page shows the email inbox");
  ok(/"my_booking_address"/.test(tu) && /id="bkmail"[^>]*hidden/.test(tu), "v88: forward address only shows once the server has it");
  ok(/p_status: "used"/.test(tu) && /p_status: "dismissed"/.test(tu) && /var mailId = fromBooking \? pendingMail : null/.test(tu), "v88: marked used only after the trip is saved; Not ours dismisses");
  ok(!/\b(delete|drop|truncate)\b/i.test(sql.replace(/--.*$/gm, "").replace(/on delete cascade/gi, "")), "v88: booking SQL is additive (no delete/drop/truncate)");
  ok(/enable row level security/i.test(sql) && /revoke all on public\.family_mail_codes, public\.booking_inbox, public\.fs_private_settings from anon, authenticated/.test(sql), "v88: inbox tables locked down");
  ok(/__SECRET_SHA256__/.test(sql) && !/[0-9a-f]{64}/.test(sql), "v88: no secret hash in the repo copy");
  ok(/FS_INGEST_SECRET/.test(gs) && !/sb_secret|service_role|eyJ/.test(gs), "v88: mail script keeps its keys in Script Properties");
  ok(!/sendEmail|reply\(|forward\(|createDraft/.test(gs), "v88: mail script never sends or replies");
  ok(/moveToTrash/.test(gs) && /ingest_booking/.test(gs), "v88: mail is trashed after reading; only parsed fields are sent");
  ok(!/Matt|Hill|oraclinical/i.test(gs + sql), "v88: no personal names");
}

// ---- v89: bearded young-adult avatars ----
{
  const AV = require(path.join(APP, "avatars.js")), app = read("app.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  ok(/var VERSION = "v(89|9\d)"/.test(app) && /mltl-v(89|9\d)/.test(swr), "v89: version and cache bumped");
  const by = {}; AV.list.forEach(a => { by[a.id] = a; });
  ok(by.a9 && by.a9.label === "Beard" && by.a9.group === "adult", "v89: a9 'Beard' is a grown-up");
  ok(by.a10 && by.a11 && by.a10.group === "adult" && by.a11.group === "adult", "v89: two beard variations");
  ok(["a1","a2","a3","a4","a5","a6","a7","a8","k1","x1","x4"].every(id => AV.has(id)), "v89: earlier ids still there");
  ok(AV.html("a9") !== AV.html("a3") && /<ellipse/.test(AV.html("a9")), "v89: full beard drawn its own way");
}

// ---- v90: beard avatars get a full head of hair ----
{
  const AV = require(path.join(APP, "avatars.js")), app = read("app.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  ok(/var VERSION = "v(9\d)"/.test(app) && /mltl-v(9\d)/.test(swr), "v90: version and cache bumped");
  const by = {}; AV.list.forEach(a => { by[a.id] = a; });
  ok(by.a9.art.hair === "full" && by.a10.art.hair === "full" && by.a9.label === "Beard" && by.a10.label === "Short beard", "v90: a9 and a10 use the fuller hair, same labels");
  ok(by.a1.art.hair === "short" && by.a3.art.hair === "short" && by.a11.art.hair === "curly", "v90: other avatars unchanged");
  // hair reaches above the head (y < 18.5) and down to the temples (y >= 30)
  const ys = (AV.html("a9").match(/<path d="M14\.2[^"]*"/) || [""])[0].match(/-?\d+(\.\d+)?/g).map(Number).filter((v, i) => i % 2 === 1);
  ok(ys.length && Math.min(...ys) <= 12 && Math.max(...ys) >= 30, "v90: a9 hair covers the crown down to the temples");
}

// ---- v91: Download my Famstamp + add-only "Restore from a backup" ----
{
  const app = read("app.js"), nav = read("nav.js"), rb = read("robust.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  ok(/var VERSION = "v(9[1-9])"/.test(app) && /mltl-v(9[1-9])/.test(swr), "v91: version and cache bumped");
  const kidA = M.newPerson({ id: "kid_zzA1", name: "Zz Test Ava", role: "kid", color: "#2a6", now: "2026-10-01T00:00:00.000Z" });
  kidA.states = { CA: { at: "2026-07-04" } }; kidA.stamps = []; kidA.av = "k2";
  const kidB = M.newPerson({ id: "kid_zzB2", name: "Zz Test Ben", role: "adult", now: "2026-10-01T00:00:00.000Z" });
  const trip = M.newTrip({ id: "trp_zz01", kidIds: ["kid_zzA1", "kid_zzB2"], place: "San Diego, CA", date: "2026-07-04", memory: "Zz Test beach day", stops: [], now: "2026-10-01T00:00:00.000Z" });
  const photo = { id: "pho_zz01", dataUrl: "data:image/jpeg;base64,AAAA" };
  const settings = { home: "Rivera town", units: "km", prefs: { tempUnit: "C", postcards: [{ id: "pc1", to: "Zz Test Gran" }], theme: "dark", junk: "x", sync: { secret: 1 } } };
  const file = JSON.parse(JSON.stringify(M.makeBackup([kidA, kidB], [trip], [photo], "2026-10-28T12:00:00.000Z", settings)));
  ok(file.app === M.APP_ID && file.version === M.BACKUP_VERSION && typeof file.version === "number", "v91: file carries the format version");
  ok(file.settings.prefs && file.settings.prefs.tempUnit === "C" && file.settings.prefs.theme === "dark" && !("junk" in file.settings.prefs) && !("sync" in file.settings.prefs), "v91: settings travel, only the listed ones (never sync keys)");
  const back = M.readBackup(file);
  ok(back.kids.length === 2 && back.trips.length === 1 && back.photos.length === 1, "v91: round trip keeps people, trips and photos");
  const ka = back.kids.find(k => k.id === "kid_zzA1");
  ok(ka.name === "Zz Test Ava" && ka.states.CA && ka.av === "k2", "v91: round trip keeps a person's stamps and avatar");
  ok(back.trips[0].memory === "Zz Test beach day" && back.trips[0].kidIds.length === 2, "v91: round trip keeps the trip's notes and travelers");
  ok(back.settings.home === "Rivera town" && back.settings.units === "km" && back.settings.prefs.postcards[0].to === "Zz Test Gran", "v91: round trip keeps settings and lists");
  // add-only: what's already here is skipped by id, never changed
  const add = M.addOnlyRestore(back, { kids: { kid_zzA1: 1 }, trips: {}, photos: { pho_zz01: 1 } });
  ok(add.kids.length === 1 && add.kids[0].id === "kid_zzB2" && add.skipped.kids === 1, "v91: a person already here is skipped");
  ok(add.trips.length === 1 && add.photos.length === 0 && add.skipped.photos === 1, "v91: new trips come in, photos already here are skipped");
  const dup = M.addOnlyRestore({ kids: [kidB, kidB], trips: [], photos: [] }, {});
  ok(dup.kids.length === 1, "v91: duplicate ids inside one file come in once");
  const none = M.addOnlyRestore(back, { kids: { kid_zzA1: 1, kid_zzB2: 1 }, trips: { trp_zz01: 1 }, photos: { pho_zz01: 1 } });
  ok(!none.kids.length && !none.trips.length && !none.photos.length, "v91: restoring the same backup twice adds nothing");
  ok(/function restoreAdd\(data\)/.test(app) && /if \(!g\.result\) s\[x\[1\]\]\.add\(rec\)/.test(app), "v91: add-only restore writes only missing ids (checked again at write time)");
  ok(/restoreBackup\(data, upd && upd\.checked \? "merge" : "add"\)/.test(app), "v91: the restore picker adds by default");
  ok(/if \(state\.meta\[k\] == null\) jobs\.push\(setMeta\(k, pr\[k\]\)\)/.test(app), "v91: settings come back only where none are set");
  ok(/\["Download my Famstamp", "#\/backup\/download"/.test(nav) && /h\[1\] === "download"/.test(app), "v91: Download my Famstamp in More");
  ok(/askAddRestore/.test(rb) && /Nothing here is changed or deleted/.test(rb), "v91: add-only preview says nothing is changed");
}

// ---- v92: notes for forwarded emails that couldn't be read ----
{
  const tu = read("trips-ui.js"), app = read("app.js"), swr = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  const MAIL = path.join(APP, "..", "mail"), gs = fs.readFileSync(path.join(MAIL, "famstamp-mail.gs"), "utf8"), sql = fs.readFileSync(path.join(MAIL, "booking-notes.sql"), "utf8");
  ok(/var VERSION = "v(9[2-9])"/.test(app) && /mltl-v(9[2-9])/.test(swr), "v92: version and cache bumped");
  ok(/We got an email on " \+ day \+ " but couldn't read it\. Try Paste a booking instead\./.test(tu), "v92: the gentle note wording");
  ok(/"booking_notes_list"/.test(tu) && /"booking_note_seen"/.test(tu) && /id="bknote"/.test(tu), "v92: notes on Trips and under Paste a booking");
  const body = sql.replace(/--.*$/gm, "").replace(/on delete cascade/gi, "");
  ok(!/\b(delete|drop|truncate|alter\s+table\s+public\.(booking_inbox|families|family_members))\b/i.test(body) && !/function public\.ingest_booking\b/.test(body), "v92: notes SQL is additive and leaves ingest_booking alone");
  ok(/sender_domain/.test(sql) && /check \(char_length\(subject\) <= 60\)/.test(sql) && !/\b(body|raw|plain|html)\s+(text|jsonb)/i.test(sql), "v92: only time, domain, short subject and reason are stored");
  ok(/enable row level security/i.test(sql) && /revoke all on public\.booking_mail_notes from anon, authenticated/.test(sql), "v92: notes table locked down");
  ok(/note_booking_failed/.test(gs) && /slice\(0, 60\)/.test(gs) && !/getPlainBody\(\)[^;]*note_/.test(gs), "v92: mail script sends only the subject (cut) for a note");
  ok(!/sendEmail|reply\(|forward\(|createDraft/.test(gs) && !/Matt|Hill|oraclinical/i.test(gs + sql), "v92: never replies; no personal names");
}

// ---- v93: first-time welcome for brand-new families ----
{
  const W = require(path.join(APP, "welcome.js")), app = read("app.js"), nav = read("nav.js"), idx = fs.readFileSync(path.join(APP, "index.html"), "utf8");
  const fresh = { flag: null, step: null, kids: 0, trips: 0, bin: 0, home: "", backup: "", sync: false, tour: null };
  const o = (x) => Object.assign({}, fresh, x);
  ok(W.decide(fresh).step === 1 && W.decide(fresh).flag === "on", "v93: a brand-new family sees step 1");
  ok(W.decide(o({ kids: 2 })).step === 0 && W.decide(o({ kids: 2 })).flag === "done", "v93: an existing user with people never sees it");
  ok(W.decide(o({ trips: 1 })).flag === "done" && W.decide(o({ home: "Rivera town" })).flag === "done" && W.decide(o({ backup: "2026-01-01" })).flag === "done", "v93: trips, a home town or a backup mean an existing user");
  ok(W.decide(o({ sync: true })).flag === "done" && W.decide(o({ tour: "done" })).flag === "done", "v93: Family Sync or the tour done mean an existing user");
  ok(W.decide(o({ flag: "done" })).step === 0 && W.decide(o({ flag: "done", kids: 0 })).flag === undefined, "v93: once done it never comes back");
  ok(W.decide(o({ flag: "on", step: "2" })).step === 2 && W.decide(o({ flag: "on", step: "2", kids: 1 })).step === 3, "v93: adding the family moves on to the home town");
  ok(W.decide(o({ flag: "on", step: "3", kids: 1, trips: 1 })).flag === "done", "v93: once there's a trip, it's done");
  ok(W.decide(o({ flag: "on", step: "9" })).step === 3 && W.decide(o({ flag: "on", step: "x" })).step === 1, "v93: a bad step is kept in range");
  ok(JSON.stringify(W.homeStamp({ country: "USA", region: "WI" })) === '{"kind":"state","id":"WI"}', "v93: a US home town stamps its state");
  ok(JSON.stringify(W.homeStamp({ country: "CAN", region: "ON" })) === '{"kind":"place","id":"CAN"}' && W.homeStamp({ country: "USA" }) === null && W.homeStamp(null) === null, "v93: elsewhere the country; nothing when unsure");
  ok(/FS_WELCOME\.homeHTML\(\)/.test(app) && /FS_WELCOME\.bind\(\)/.test(app), "v93: welcome on Home");
  ok(/!\(window\.FS_WELCOME && window\.FS_WELCOME\.active\(\)\)/.test(nav), "v93: the tour waits for the welcome");
  ok(idx.indexOf('src="welcome.js"') > idx.indexOf('src="where.js"') && idx.indexOf('src="welcome.js"') < idx.indexOf('src="nav.js"'), "v93: welcome.js in the bundle");
  const wsrc = read("welcome.js");
  ok(/data-wl="skip"/.test(wsrc) && !/Matt|Hill/.test(wsrc), "v93: Skip on every step; no personal names");
}

// ---- v94: one stamp per place with its visit count; faster tab switches ----
{
  const P = require("../travel-log/app/passport-core.js");
  const zz = { id: "zz-rivera-1", name: "Zz Test", role: "kid", stamps: [], places: {}, states: {}, parks: {} };
  const codes = ["FL", "CA", "NY", "TX", "WI", "UT", "AZ", "CO", "ME", "OR"], trips = [];
  for (let i = 0; i < 202; i++) {
    const st = codes[i % codes.length], fmt = i % 3 === 0 ? st : i % 3 === 1 ? "US-" + st : ({ FL: "Florida", CA: "California", NY: "New York", TX: "Texas", WI: "Wisconsin", UT: "Utah", AZ: "Arizona", CO: "Colorado", ME: "Maine", OR: "Oregon" })[st];
    const d = new Date(Date.UTC(2010, 0, 1) + i * 9 * 864e5).toISOString().slice(0, 10);
    trips.push({ id: "zzt" + i, kidIds: [zz.id], place: "Zz Test trip " + i, date: d, route: [{ name: "Zz Home", country: "USA", region: "WI" }, { name: "Zz stop " + i, country: "USA", region: fmt, nights: 2 }] });
  }
  const raw = P.stampsFor(zz, trips, {}), states = raw.filter(s => s.kind === "state");
  ok(states.length === 202, "v94: 202 trips give 202 state visits (each visit kept), got " + states.length);
  const g = P.groupStamps(raw), gs = g.filter(s => s.kind === "state");
  ok(gs.length === 10 && gs.reduce((n, s) => n + s.count, 0) === 202, "v94: 202 visits across 10 states show 10 stamps and 202 visits");
  const fl = gs.find(s => s.area === "FL");
  ok(fl && fl.count === 21 && fl.first === trips[0].date && fl.last && fl.last > fl.first && fl.visits.length === 21, "v94: a state stamp knows its visits, first and latest dates");
  ok(raw.length === P.stampsFor(zz, trips, {}).length && trips.length === 202 && raw.length >= 202, "v94: grouping removes no records");
  ok(["FL", "fl", "US-FL", "Florida", " florida "].every(x => P.stateCode(x) === "FL") && P.stateCode("DC") === "DC" && P.stateCode("ON") === "" && P.stateCode("34") === "" && P.stateCode("SCT") === "", "v94: one state in any format; not a state otherwise");
  const c = P.passportCounts(raw);
  ok(c.states === 10 && c.stateVisits === 202 && !c.dc, "v94: counts say 10 of 50 states and 202 state visits");
  const mixed = [
    { id: "a", kind: "state", area: "DC", who: [zz.id], date: "2020-01-01", source: "hand" },
    { id: "b", kind: "place", area: "TUR", who: [zz.id], date: "2020-01-01", source: "hand" }, { id: "c", kind: "place", area: "TUR", who: [zz.id], date: "2021-01-01", source: "hand" },
    { id: "d", kind: "place", area: "SCT", who: [zz.id], date: "2020-01-01", source: "hand" }, { id: "e", kind: "place", area: "CAN", who: [zz.id], date: "", source: "map" }];
  const cm = P.passportCounts(mixed);
  ok(cm.states === 0 && cm.dc && cm.countries === 2 && cm.nations === 1 && cm.countryVisits === 4, "v94: DC noted on its own; UK nations, Turkey and Canada never count as states");
  ok(P.groupStamps(mixed).find(s => s.area === "TUR").count === 2 && P.groupStamps(mixed).find(s => s.area === "CAN").count === 1, "v94: a country visited twice is one stamp with 2 visits");
  const sights = [{ id: "s1", kind: "sight", area: "Q80541", who: [zz.id], date: "2019-03-01", source: "trip" }, { id: "s2", kind: "sight", area: "Q80541", who: [zz.id], date: "2024-03-01", source: "trip" }];
  ok(P.groupStamps(sights).length === 1 && P.groupStamps(sights)[0].count === 2 && P.groupStamps(sights)[0].id === "s1", "v94: sights group too, keeping the first visit's look");
  const tui = read("trips-ui.js"), yr = read("year.js"), mz = read("mapzoom.js");
  ok(/P\.groupStamps\(stamps\)/.test(tui) && /coverLine\(pc\)/.test(tui) && /" of 50 states"/.test(tui) && /Visited ' \+ vs\.length \+ ' times/.test(tui), "v94: passport shows one stamp per place, 'X of 50 states' and the visits list");
  ok(/STAMPMEMO/.test(tui) && /data-lazy/.test(tui) && /warmPlaces\(\)/.test(tui) && /setTimeout\(runSearch, 140\)/.test(tui), "v94: stamps worked out once per change, pages drawn as you swipe, search waits for a typing pause");
  ok(/cardKey === key && lastBlob/.test(yr), "v94: the year card is kept, not redrawn on every visit");
  ok(mz.indexOf("var cr = labels.length ? ctl.getBoundingClientRect()") < mz.indexOf("dotEls.forEach(function (c) {\n        c.setAttribute"), "v94: map labels read layout before writing");
  ok(P.addDays("2026-02-27", 3) === "2026-03-02" && P.addDays("2026-02-27", 3) === "2026-03-02" && P.addDays("x", 1) === "", "v94: remembered date sums still right");
}
