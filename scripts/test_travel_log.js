// Tests for Famstamp, the My Lifetime Travel Log app (/travel-log/app/). Run: node scripts/test_travel_log.js
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
ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, "").replace(/connect-src 'self' https:\/\/ercowufdbmvqagshduxh\.supabase\.co wss:\/\/ercowufdbmvqagshduxh\.supabase\.co https:\/\/api\.open-meteo\.com https:\/\/archive-api\.open-meteo\.com;/, "").replace(/img-src 'self' data: blob: https:\/\/lh3\.googleusercontent\.com;/, "")), "index.html loads nothing from other sites (only Family Sync may connect to the family database; Google profile photos only)");
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
const list = files.match(/"([^"]+)"/g).map(x => x.slice(1, -1));
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
  ok(/"stamp-who-core\.js", "stamp-who\.js"/.test(fs.readFileSync(path.join(APP, "sw.js"), "utf8")), "the who-picker files are cached for offline");
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
    else if (/\.(html|xml|txt)$/.test(e.name) && /travel-log\/app/.test(fs.readFileSync(p, "utf8"))) linked.push(path.relative(path.join(__dirname, ".."), p));
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
  ok(read("stamp-art.js").length < 170000 && read("state-symbols.js").length < 12000, "stamp art stays lightweight");
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
