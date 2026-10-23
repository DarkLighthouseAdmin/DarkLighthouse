/* Famstamp (My Lifetime Travel Log app): the app's logic with no browser parts, so it can be tested in Node
   (node scripts/test_travel_log.js). Everything here works on plain objects; storage lives in app.js. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trips-core.js"), require("./passport-core.js"));
  else root.MLTL = factory(root.WK_TRIPS, root.WK_PASSPORT);
})(typeof self !== "undefined" ? self : this, function (T, P) {
  "use strict";

  var APP_ID = "my-lifetime-travel-log";   // stays the same after the Wanderkin and Famstamp renames so every old backup still restores
  // v2 added roles (kid / adult / grandparent); v3 adds trip From / stops and the family's home town; v4 (Famstamp 1.4) adds trip routes with
  // miles, stays, favorites, moments and stories, plus hand-added passport stamps on each person. v1-v3 files still restore.
  var BACKUP_VERSION = 4;
  var MAX_STOPS = 5;

  // All 64 US national parks as of October 2026 (Chiricahua became #64 on Oct 20, 2026). Same list as the book.
  var PARK_LIST = [["Acadia", "ME"], ["American Samoa", "AS"], ["Arches", "UT"], ["Badlands", "SD"], ["Big Bend", "TX"], ["Biscayne", "FL"],
    ["Black Canyon of the Gunnison", "CO"], ["Bryce Canyon", "UT"], ["Canyonlands", "UT"], ["Capitol Reef", "UT"], ["Carlsbad Caverns", "NM"],
    ["Channel Islands", "CA"], ["Chiricahua", "AZ"], ["Congaree", "SC"], ["Crater Lake", "OR"], ["Cuyahoga Valley", "OH"], ["Death Valley", "CA, NV"],
    ["Denali", "AK"], ["Dry Tortugas", "FL"], ["Everglades", "FL"], ["Gates of the Arctic", "AK"], ["Gateway Arch", "MO"], ["Glacier", "MT"],
    ["Glacier Bay", "AK"], ["Grand Canyon", "AZ"], ["Grand Teton", "WY"], ["Great Basin", "NV"], ["Great Sand Dunes", "CO"],
    ["Great Smoky Mountains", "NC, TN"], ["Guadalupe Mountains", "TX"], ["Haleakalā", "HI"], ["Hawaiʻi Volcanoes", "HI"], ["Hot Springs", "AR"],
    ["Indiana Dunes", "IN"], ["Isle Royale", "MI"], ["Joshua Tree", "CA"], ["Katmai", "AK"], ["Kenai Fjords", "AK"], ["Kings Canyon", "CA"],
    ["Kobuk Valley", "AK"], ["Lake Clark", "AK"], ["Lassen Volcanic", "CA"], ["Mammoth Cave", "KY"], ["Mesa Verde", "CO"], ["Mount Rainier", "WA"],
    ["New River Gorge", "WV"], ["North Cascades", "WA"], ["Olympic", "WA"], ["Petrified Forest", "AZ"], ["Pinnacles", "CA"], ["Redwood", "CA"],
    ["Rocky Mountain", "CO"], ["Saguaro", "AZ"], ["Sequoia", "CA"], ["Shenandoah", "VA"], ["Theodore Roosevelt", "ND"], ["Virgin Islands", "VI"],
    ["Voyageurs", "MN"], ["White Sands", "NM"], ["Wind Cave", "SD"], ["Wrangell-St. Elias", "AK"], ["Yellowstone", "WY, MT, ID"],
    ["Yosemite", "CA"], ["Zion", "UT"]];

  function slug(s) {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f\u02bb]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  // Where each park is (Wikidata, CC0; same as data/places.json), for the dots on the Parks map.
  var PARK_LL = {"acadia":[44.35,-68.217],"american-samoa":[-14.258,-170.686],"arches":[38.728,-109.54],"badlands":[43.75,-102.5],"big-bend":[29.25,-103.25],"biscayne":[25.502,-80.181],"black-canyon-of-the-gunnison":[38.58,-107.728],"bryce-canyon":[37.64,-112.17],"canyonlands":[38.167,-109.76],"capitol-reef":[38.2,-111.167],"carlsbad-caverns":[32.175,-104.444],"channel-islands":[33.66,-119.64],"chiricahua":[32.006,-109.357],"congaree":[33.783,-80.783],"crater-lake":[42.912,-122.148],"cuyahoga-valley":[41.242,-81.55],"death-valley":[36.45,-116.85],"denali":[63.2,-150.3],"dry-tortugas":[24.629,-82.873],"everglades":[25.312,-80.688],"gates-of-the-arctic":[67.783,-153.3],"gateway-arch":[38.625,-90.185],"glacier":[48.755,-113.8],"glacier-bay":[58.7,-137.0],"grand-canyon":[36.055,-112.122],"grand-teton":[43.833,-110.701],"great-basin":[39.006,-114.22],"great-sand-dunes":[37.733,-105.512],"great-smoky-mountains":[35.611,-83.425],"guadalupe-mountains":[31.917,-104.867],"haleakala":[20.72,-156.155],"hawaii-volcanoes":[19.401,-155.124],"hot-springs":[34.514,-93.054],"indiana-dunes":[41.648,-87.108],"isle-royale":[47.996,-88.909],"joshua-tree":[33.748,-115.819],"katmai":[58.5,-155.0],"kenai-fjords":[59.918,-149.988],"kings-canyon":[36.789,-118.673],"kobuk-valley":[67.353,-159.199],"lake-clark":[60.97,-153.42],"lassen-volcanic":[40.498,-121.427],"mammoth-cave":[37.187,-86.101],"mesa-verde":[37.26,-108.494],"mount-rainier":[46.85,-121.75],"new-river-gorge":[37.931,-81.075],"north-cascades":[48.483,-120.911],"olympic":[47.7,-123.75],"petrified-forest":[35.088,-109.806],"pinnacles":[36.487,-121.167],"redwood":[41.529,-124.058],"rocky-mountain":[40.35,-105.683],"saguaro":[32.202,-110.611],"sequoia":[36.565,-118.773],"shenandoah":[38.533,-78.35],"theodore-roosevelt":[46.967,-103.45],"virgin-islands":[18.328,-64.933],"voyageurs":[48.5,-92.883],"white-sands":[32.78,-106.172],"wind-cave":[43.556,-103.479],"wrangell-st-elias":[61.435,-142.954],"yellowstone":[44.6,-110.5],"yosemite":[37.742,-119.537],"zion":[37.203,-112.988]};
  // set: which collection a park belongs to. Only "np" (national parks) today; state parks can be added as more rows with
  // their own set id (and their own stamps) without touching the screens, which group and count by set.
  var PARK_SETS = [{ id: "np", name: "National parks" }];
  var PARKS = PARK_LIST.map(function (p) { var id = slug(p[0]), l = PARK_LL[id] || []; return { id: id, name: p[0], states: p[1], set: "np", lat: l[0], lon: l[1] }; });

  var US_STATE_TOTAL = 50;      // DC can be colored too, but it's a bonus, not one of the 50
  var COUNTRY_TOTAL = 195;      // 193 UN members + Vatican City + Palestine, as in the book
  var UK_NATIONS = ["ENG", "SCT", "WLS", "NIR"];
  // Everyone in the family gets a profile. Kids come first, but grown-ups get the same maps, parks, stats and badges.
  var ROLES = [{ id: "kid", label: "Kid" }, { id: "adult", label: "Parent/Adult" }, { id: "grand", label: "Grandparent/Other" }];
  function validRole(r) { return r === "adult" || r === "grand" ? r : "kid"; }
  function isKid(p) { return validRole(p && p.role) === "kid"; }
  var COLORS = ["#e8a54b", "#3f8f9f", "#c0607a", "#6f8f7a", "#7b6bb0", "#d0703c"];

  function uid(prefix) {
    var r = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      var a = new Uint8Array(8); crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) r += a[i].toString(16).padStart(2, "0");
    } else { r = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2); }
    return (prefix || "id") + "_" + r.slice(0, 16);
  }

  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max || 200); }
  function validYear(y) { y = parseInt(y, 10); var now = new Date().getFullYear(); return y >= 1900 && y <= now ? y : null; }
  function validDate(d) { return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T12:00:00").getTime()) ? d : ""; }

  /** A person in the family. Stored in the "kids" store and backup key for v1 compatibility. */
  function newPerson(opts) {
    opts = opts || {};
    var name = clean(opts.name, 40);
    if (!name) throw new Error("Add a name or nickname.");
    var now = opts.now || new Date().toISOString();
    return { id: opts.id || uid("person"), name: name, role: validRole(opts.role), birthYear: validYear(opts.birthYear),
             color: COLORS.indexOf(opts.color) >= 0 ? opts.color : COLORS[0], states: {}, places: {}, parks: {}, createdAt: now, updatedAt: now };
  }
  var newKid = newPerson;

  /** Toggle a state / world place on a kid's map. Returns true if it's now colored. */
  function toggleArea(kid, kind, id, on, when) {
    var bag = kind === "state" ? kid.states : kid.places;
    var want = on == null ? !bag[id] : !!on;
    if (want) { if (!bag[id]) bag[id] = { at: validDate(when) || today() }; }
    else delete bag[id];
    kid.updatedAt = new Date().toISOString();
    return want;
  }
  function togglePark(kid, parkId, field, on) {
    var p = kid.parks[parkId] || null;
    if (field === "jr") {
      var jr = on == null ? !(p && p.jr) : !!on;
      if (jr) { p = p || { at: today() }; p.jr = true; kid.parks[parkId] = p; }
      else if (p) { p.jr = false; }
      kid.updatedAt = new Date().toISOString(); return jr;
    }
    var want = on == null ? !p : !!on;
    if (want) { if (!p) kid.parks[parkId] = { at: today(), jr: false }; }
    else delete kid.parks[parkId];
    kid.updatedAt = new Date().toISOString();
    return want;
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function newTrip(opts) {
    opts = opts || {};
    var place = clean(opts.place, 80);
    if (!place) throw new Error("Where did you go? Add a place.");
    var kidIds = (opts.kidIds || []).filter(function (x) { return typeof x === "string" && x; });
    if (!kidIds.length) throw new Error("Pick at least one person for this trip.");
    var stops = (Array.isArray(opts.stops) ? opts.stops : []).map(function (x) { return clean(x, 80); }).filter(Boolean).slice(0, MAX_STOPS);
    var mark = null;
    if (opts.mark && /^(state|place|park)$/.test(opts.mark.kind) && opts.mark.id) mark = { kind: opts.mark.kind, id: clean(opts.mark.id, 40) };
    var now = opts.now || new Date().toISOString();
    var t = { id: opts.id || uid("trip"), kidIds: kidIds, place: place, from: clean(opts.from, 80), stops: stops, date: validDate(opts.date), who: clean(opts.who, 120),
             memory: clean(opts.memory, 1000), photoId: opts.photoId || null, mark: mark, createdAt: opts.createdAt || now, updatedAt: now };
    // v1.4: route, stays, favorites, moments, story (all optional). No route given = build one from From / stops / To.
    var x = T.cleanExtras(opts, kidIds);
    Object.keys(x).forEach(function (k) { t[k] = x[k]; });
    if (t.endDate && t.date && t.endDate < t.date) t.endDate = "";
    if (t.route.length) T.syncLegacy(t); else t.route = T.routeFromLegacy(t);
    return T.fitSize(t);
  }
  /** Older trips (v1/v2) have no From or stops; a trip with no travelers belongs to the person it was saved under. */
  function migrateTrip(t, ownerId) {
    if (!t || typeof t !== "object") return t;
    var ids = Array.isArray(t.kidIds) ? t.kidIds.filter(function (x) { return typeof x === "string" && x; }) : [];
    if (!ids.length && typeof t.kidId === "string" && t.kidId) ids = [t.kidId];
    if (!ids.length && ownerId) ids = [ownerId];
    t.kidIds = ids.filter(function (x, i) { return ids.indexOf(x) === i; });
    if (typeof t.from !== "string") t.from = "";
    if (!Array.isArray(t.stops)) t.stops = [];
    delete t.kidId;
    // v1.4: older trips get a route built from their words (no locations yet, so their miles show as "?")
    if (!Array.isArray(t.route) || !t.route.length) t.route = T.routeFromLegacy(t);
    if (!Array.isArray(t.stays)) t.stays = [];
    if (!Array.isArray(t.favs)) t.favs = [];
    if (!t.moments || typeof t.moments !== "object") t.moments = {};
    return t;
  }
  /** "Orlando to Edinburgh", "Orlando to London to Edinburgh", or just "Edinburgh". Plain words, no arrows. */
  function routeText(t) {
    if (Array.isArray(t.route) && t.route.length > 1 && t.route.some(function (p) { return p.lat != null; })) return t.route.map(function (p) { return p.name; }).join(" to ");
    var parts = [t.from].concat(t.stops || []).concat([t.place]).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    return parts.filter(function (x, i) { return i === parts.length - 1 || x.toLowerCase() !== parts[i + 1].toLowerCase(); }).join(" to ");
  }
  /** "Lily", "Lily & Mom", "Lily, Mom & Dad". */
  function joinNames(list) {
    list = list.filter(Boolean);
    return list.length < 2 ? (list[0] || "") : list.slice(0, -1).join(", ") + " & " + list[list.length - 1];
  }
  /** Trips every one of these people went on (others may have come too), newest first. */
  function tripsTogether(trips, ids) {
    if (!ids || ids.length < 2) return [];
    return trips.filter(function (t) { return ids.every(function (id) { return t.kidIds.indexOf(id) >= 0; }); })
      .sort(function (a, b) { return (b.date || b.createdAt || "") < (a.date || a.createdAt || "") ? -1 : 1; });
  }
  /** Every pair in the family with how many trips they shared, most first. Pairs with none are left out. */
  function pairCounts(people, trips) {
    var out = [];
    for (var i = 0; i < people.length; i++) for (var j = i + 1; j < people.length; j++) {
      var n = tripsTogether(trips, [people[i].id, people[j].id]).length;
      if (n) out.push({ ids: [people[i].id, people[j].id], count: n });
    }
    return out.sort(function (a, b) { return b.count - a.count; });
  }
  /** Should we show the backup banner? Never backed up: after 3+ trips. Backed up: something changed since, and it's been 14+ days.
      Dismissing hides it for 7 days. Dates are ISO strings. */
  var BACKUP_DAYS = 14, SNOOZE_DAYS = 7, DAY = 864e5;
  function backupDue(o) {
    var now = o.now ? new Date(o.now).getTime() : Date.now(), last = o.lastBackupAt, trips = o.trips || [], people = o.people || [];
    if (o.dismissedAt && now - new Date(o.dismissedAt).getTime() < SNOOZE_DAYS * DAY) return false;
    if (!last) return trips.length >= 3;
    var changed = trips.some(function (t) { return (t.updatedAt || "") > last; }) || people.some(function (p) { return (p.updatedAt || "") > last; });
    return changed && now - new Date(last).getTime() >= BACKUP_DAYS * DAY;
  }
  /** Color in whatever the trip points at, plus every state, country, UK nation and park on its route, for everyone on it.
      Returns the ids of people whose maps changed. */
  var PARK_STATES = {}; PARKS.forEach(function (p) { PARK_STATES[p.id] = p.states.split(/,\s*/); });
  function applyTripMark(trip, kids) {
    var list = T.areas(trip, PARK_STATES).slice(), changed = [];
    if (trip.mark) list.push(trip.mark);
    kids.forEach(function (k) {
      if (trip.kidIds.indexOf(k.id) < 0) return;
      list.forEach(function (a) {
        if (a.kind === "park") { if (PARK_STATES[a.id] && !k.parks[a.id]) { k.parks[a.id] = { at: trip.date || today(), jr: false }; changed.push(k.id); } }
        else if (a.kind === "state" ? !k.states[a.id] : !k.places[a.id]) { toggleArea(k, a.kind, a.id, true, trip.date); changed.push(k.id); }
      });
    });
    return changed.filter(function (x, i) { return changed.indexOf(x) === i; });
  }

  function ageOn(birthYear, dateStr) {
    if (!birthYear || !dateStr) return null;
    var y = parseInt(dateStr.slice(0, 4), 10) - birthYear;
    return y >= 0 && y < 120 ? y : null;
  }

  /** world: { countries: [{id,name,cont}] } from maps.js. */
  function stats(kid, trips, world) {
    var countryById = {}; (world.countries || []).forEach(function (c) { countryById[c.id] = c; });
    var states = Object.keys(kid.states).filter(function (k) { return k !== "DC"; }).length;
    var seen = {}, uk = 0, other = 0;
    Object.keys(kid.places).forEach(function (id) {
      if (UK_NATIONS.indexOf(id) >= 0) { uk++; seen.GBR = 1; }
      else if (countryById[id]) seen[id] = 1;
      else other++;
    });
    if (Object.keys(kid.states).length) seen.USA = 1;   // any US state means the US counts
    var countries = Object.keys(seen).filter(function (id) { return countryById[id]; });
    var conts = {}; countries.forEach(function (id) { conts[countryById[id].cont] = 1; });
    var parkIds = Object.keys(kid.parks).filter(function (id) { return PARKS.some(function (p) { return p.id === id; }); });
    var jr = parkIds.filter(function (id) { return kid.parks[id].jr; }).length;
    var mine = trips.filter(function (t) { return t.kidIds.indexOf(kid.id) >= 0; });
    var dates = mine.map(function (t) { return t.date; }).filter(Boolean).sort();
    var years = {}; dates.forEach(function (d) { years[d.slice(0, 4)] = 1; });
    var abroad = countries.filter(function (id) { return id !== "USA"; }).length;
    var life = T.lifetime(kid.id, trips);
    return { miles: life.miles, flights: life.flights, flightMiles: life.flightMiles, airMin: life.airMin, bigRoad: life.bigRoad,
      role: validRole(kid.role), kid: isKid(kid), together: mine.filter(function (t) { return t.kidIds.length > 1; }).length,
      states: states, statesTotal: US_STATE_TOTAL, dc: !!kid.states.DC,
      countries: countries.length, countriesTotal: COUNTRY_TOTAL, abroad: abroad,
      ukNations: uk, ukTotal: UK_NATIONS.length, scotland: !!kid.places.SCT, otherPlaces: other,
      continents: Object.keys(conts).length, continentNames: Object.keys(conts).sort(),
      parks: parkIds.length, parksTotal: PARKS.length, juniorRanger: jr,
      trips: mine.length, photos: mine.filter(function (t) { return t.photoId; }).length,
      years: Object.keys(years).length, firstTrip: dates[0] || "", firstTripAge: isKid(kid) ? ageOn(kid.birthYear, dates[0] || "") : null
    };
  }

  var BADGES = [
    { id: "first-trip", name: "First trip", desc: "Add your first trip", need: 1, key: "trips" },
    { id: "storyteller", name: "Storyteller", desc: "Add 10 trips", need: 10, key: "trips" },
    { id: "photo", name: "Snapshot", desc: "Add a trip with a photo", need: 1, key: "photos" },
    { id: "states-5", name: "Road tripper", desc: "Color 5 states", need: 5, key: "states" },
    { id: "states-10", name: "State hopper", desc: "Color 10 states", need: 10, key: "states" },
    { id: "states-25", name: "Halfway there", desc: "Color 25 states", need: 25, key: "states" },
    { id: "states-50", name: "All 50!", desc: "Color every state", need: 50, key: "states" },
    { id: "abroad", name: "Passport power", desc: "Visit a country outside the US", need: 1, key: "abroad" },
    { id: "countries-5", name: "World explorer", desc: "Visit 5 countries", need: 5, key: "countries" },
    { id: "continents-3", name: "Three continents", desc: "Visit 3 continents", need: 3, key: "continents" },
    { id: "scotland", name: "Wee explorer", adultName: "Scotland calling", desc: "Visit Scotland", need: 1, key: "scotlandN" },
    { id: "uk-4", name: "All four nations", desc: "England, Scotland, Wales and Northern Ireland", need: 4, key: "ukNations" },
    { id: "park-1", name: "Park ranger", desc: "Visit a national park", need: 1, key: "parks" },
    { id: "parks-10", name: "Trail blazer", desc: "Visit 10 national parks", need: 10, key: "parks" },
    { id: "together", name: "Better together", desc: "Take 3 trips with family", need: 3, key: "together" },
    { id: "junior-ranger", name: "Junior Ranger", desc: "Earn a Junior Ranger badge", need: 1, key: "juniorRanger", kidsOnly: true },
    // v1.4: these come from trip routes
    { id: "first-flight", name: "First flight", desc: "Take a trip with a flight", need: 1, key: "flights" },
    { id: "frequent-flyer", name: "Frequent flyer", desc: "Take 5 flights", need: 5, key: "flights" },
    { id: "sky-miles", name: "Sky high", desc: "Fly 10,000 miles", need: 10000, key: "flightMiles" },
    { id: "road-trip", name: "Big road trip", desc: "Drive 500 miles on one trip", need: 500, key: "bigRoad" },
    { id: "miles-1000", name: "1,000 miles", desc: "Travel 1,000 miles", need: 1000, key: "miles" },
    { id: "miles-10000", name: "10,000 miles", desc: "Travel 10,000 miles", need: 10000, key: "miles" },
    { id: "around-world", name: "Around the world", desc: "Travel 24,901 miles, once around the Earth", need: 24901, key: "miles" }
  ];
  function badges(s) {
    var v = Object.assign({ scotlandN: s.scotland ? 1 : 0 }, s);
    var kid = s.kid !== false;   // older callers (no role) are kids
    return BADGES.filter(function (b) { return kid || !b.kidsOnly; }).map(function (b) {
      var have = Math.min(v[b.key] || 0, b.need);
      return { id: b.id, name: kid ? b.name : (b.adultName || b.name), desc: b.desc, earned: have >= b.need, have: Math.round(have), need: b.need };
    });
  }

  // ---------- family ----------
  /** The 195-list countries one person has been to (a UK nation counts as GBR, any state as USA). */
  function countrySet(p, world) {
    var byId = {}; (world.countries || []).forEach(function (c) { byId[c.id] = 1; });
    var out = {};
    Object.keys(p.places).forEach(function (id) { if (UK_NATIONS.indexOf(id) >= 0) out.GBR = 1; else if (byId[id]) out[id] = 1; });
    if (Object.keys(p.states).length) out.USA = 1;
    return out;
  }
  /** Who has been where: { id: [personId, ...] } for "state", "place" (map areas), "park" or "country". */
  function whoBeen(people, kind, world) {
    var out = {};
    people.forEach(function (p) {
      var bag = kind === "state" ? p.states : kind === "park" ? p.parks : kind === "country" ? countrySet(p, world) : p.places;
      Object.keys(bag).forEach(function (id) { (out[id] = out[id] || []).push(p.id); });
    });
    return out;
  }
  /** Family totals for the chosen people. "Together" = places every chosen person has been, and trips they all went on. */
  function familyStats(people, trips, world) {
    var n = people.length, ids = people.map(function (p) { return p.id; });
    function count(kind, skip) {
      var w = whoBeen(people, kind, world), any = 0, all = 0;
      Object.keys(w).forEach(function (id) { if (skip && skip(id)) return; any++; if (n > 1 && w[id].length === n) all++; });
      return [any, all];
    }
    var st = count("state", function (id) { return id === "DC"; }), co = count("country"), pk = count("park", function (id) { return !PARKS.some(function (p) { return p.id === id; }); });
    var together = n > 1 ? trips.filter(function (t) { return ids.every(function (id) { return t.kidIds.indexOf(id) >= 0; }); }).length : 0;
    var anyTrips = trips.filter(function (t) { return t.kidIds.some(function (id) { return ids.indexOf(id) >= 0; }); }).length;
    return { people: n, states: st[0], countries: co[0], parks: pk[0], togetherStates: st[1], togetherCountries: co[1], togetherParks: pk[1],
             togetherTrips: together, trips: anyTrips };
  }

  // ---------- backup ----------
  function makeBackup(kids, trips, photos, now, settings) {
    var st = { home: clean(settings && settings.home, 80) };
    var hp = settings && settings.homePoint ? T.cleanPoint(settings.homePoint, true) : null; if (hp) st.homePoint = hp;
    if (settings && settings.units === "km") st.units = "km";
    return { app: APP_ID, version: BACKUP_VERSION, exportedAt: now || new Date().toISOString(),
             note: "Famstamp backup. Keep this file somewhere safe (email it to yourself, or save it to your cloud drive).",
             kids: kids, trips: trips, photos: photos, settings: st };
  }
  function cleanArea(bag, idRe) {
    var out = {};
    if (bag && typeof bag === "object") Object.keys(bag).slice(0, 400).forEach(function (k) {
      if (!idRe.test(k)) return; var v = bag[k] || {}; out[k] = { at: validDate(v.at) };
      if (v.jr) out[k].jr = true; else if ("jr" in v) out[k].jr = false;
    });
    return out;
  }
  /** Checks a parsed backup file and returns clean copies, or throws a friendly error. */
  function readBackup(obj) {
    if (!obj || typeof obj !== "object" || obj.app !== APP_ID) throw new Error("That file isn't a Famstamp backup.");
    if (typeof obj.version !== "number" || obj.version < 1 || obj.version > BACKUP_VERSION) throw new Error("This backup was made by a newer version of the app. Reload the app and try again.");
    if (!Array.isArray(obj.kids) || !Array.isArray(obj.trips) || !Array.isArray(obj.photos || [])) throw new Error("The backup file looks damaged.");
    var idOk = /^[a-z]+_[A-Za-z0-9]{4,40}$/;
    var kids = obj.kids.filter(function (k) { return k && idOk.test(k.id) && clean(k.name, 40); }).map(function (k) {
      // v1 files have no role: everyone in them was a kid
      var kid = newPerson({ id: k.id, name: k.name, role: obj.version >= 2 ? k.role : "kid", birthYear: k.birthYear, color: k.color, now: k.createdAt });
      kid.states = cleanArea(k.states, /^[A-Z]{2}$/); kid.places = cleanArea(k.places, /^[A-Z0-9]{3}$/); kid.parks = cleanArea(k.parks, /^[a-z0-9-]{2,40}$/);
      if (obj.version >= 4 && Array.isArray(k.stamps) && k.stamps.length) kid.stamps = P.cleanStamps(k.stamps);
      // kid quests and firsts: plain JSON, checked again by quests.js / firsts.js when shown
      ["quests", "firsts"].forEach(function (f) { var v = k[f]; if (v && typeof v === "object" && !Array.isArray(v)) { var j = JSON.stringify(v); if (j.length < 60000) kid[f] = JSON.parse(j); } });
      kid.createdAt = typeof k.createdAt === "string" ? k.createdAt.slice(0, 30) : kid.createdAt;
      kid.updatedAt = typeof k.updatedAt === "string" ? k.updatedAt.slice(0, 30) : kid.updatedAt;
      return kid;
    });
    var kidIds = kids.map(function (k) { return k.id; });
    var photos = (obj.photos || []).filter(function (p) {
      return p && idOk.test(p.id) && typeof p.dataUrl === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.dataUrl) && p.dataUrl.length < 4e6;
    }).map(function (p) { return { id: p.id, dataUrl: p.dataUrl }; });
    var photoIds = photos.map(function (p) { return p.id; });
    var trips = obj.trips.filter(function (t) { return t && idOk.test(t.id) && (Array.isArray(t.kidIds) || typeof t.kidId === "string"); }).map(function (t) {
      var v4 = obj.version >= 4; if (!v4) { t = JSON.parse(JSON.stringify(t)); delete t.route; }
      t = migrateTrip(JSON.parse(JSON.stringify(t)));
      var ids = t.kidIds.filter(function (id) { return kidIds.indexOf(id) >= 0; });
      if (!ids.length || !clean(t.place, 80)) return null;
      return keepUnknown(t, newTrip({ id: t.id, kidIds: ids, place: t.place, from: obj.version >= 3 ? t.from : "", stops: obj.version >= 3 ? t.stops : [], date: t.date, who: t.who, memory: t.memory, mark: t.mark,
                       photoId: photoIds.indexOf(t.photoId) >= 0 ? t.photoId : null, createdAt: t.createdAt, now: t.updatedAt,
                       route: v4 ? t.route : [], title: v4 ? t.title : "", endDate: v4 ? t.endDate : "", nights: v4 ? t.nights : null, roundTrip: v4 && t.roundTrip, done: v4 && t.done, fly: v4 ? t.fly : "", back: v4 ? t.back : null,
                       stays: v4 ? t.stays : [], favs: v4 ? t.favs : [], moments: v4 ? t.moments : {}, story: v4 ? t.story : null }));
    }).filter(Boolean);
    var home = obj.version >= 3 && obj.settings && typeof obj.settings === "object" ? clean(obj.settings.home, 80) : "";
    var settings = { home: home };
    if (obj.version >= 4 && obj.settings && typeof obj.settings === "object") { var hp = T.cleanPoint(obj.settings.homePoint, true); if (hp) settings.homePoint = hp; if (obj.settings.units === "km") settings.units = "km"; }
    return { kids: kids, trips: trips, photos: photos, settings: settings, exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "" };
  }

  /** Fields a newer app version (or Family Sync, e.g. copiedFrom) added that this version doesn't know: keep them as plain JSON, small ones only. */
  function keepUnknown(src, built) {
    var out = {};
    Object.keys(src || {}).forEach(function (k) {
      if (k in built || k === "kidId" || !/^[A-Za-z][A-Za-z0-9]{0,29}$/.test(k)) return;
      var j; try { j = JSON.stringify(src[k]); } catch (e) { return; }
      if (j && j.length <= 2000) out[k] = JSON.parse(j);
    });
    return Object.assign(out, built);
  }

  /** Long edge capped at max px, keeping the shape. */
  function fitDims(w, h, max) {
    max = max || 1280; if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
    var s = Math.min(1, max / Math.max(w, h)); return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function prettyDate(d) {
    if (!validDate(d)) return "";
    var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return m[parseInt(d.slice(5, 7), 10) - 1] + " " + parseInt(d.slice(8, 10), 10) + ", " + d.slice(0, 4);
  }
  function backupNudge(lastBackupAt, trips) {
    var since = trips.filter(function (t) { return !lastBackupAt || t.updatedAt > lastBackupAt; }).length;
    return since >= 3 ? since : 0;
  }

  return { APP_ID: APP_ID, BACKUP_VERSION: BACKUP_VERSION, PARKS: PARKS, PARK_SETS: PARK_SETS, COLORS: COLORS, UK_NATIONS: UK_NATIONS, ROLES: ROLES, validRole: validRole, isKid: isKid,
           newPerson: newPerson, countrySet: countrySet, whoBeen: whoBeen, familyStats: familyStats,
           US_STATE_TOTAL: US_STATE_TOTAL, COUNTRY_TOTAL: COUNTRY_TOTAL,
           slug: slug, uid: uid, newKid: newKid, toggleArea: toggleArea, togglePark: togglePark, newTrip: newTrip, applyTripMark: applyTripMark,
           ageOn: ageOn, stats: stats, badges: badges, BADGES: BADGES, makeBackup: makeBackup, readBackup: readBackup, fitDims: fitDims,
           esc: esc, prettyDate: prettyDate, validDate: validDate, today: today, backupNudge: backupNudge,
           MAX_STOPS: MAX_STOPS, migrateTrip: migrateTrip, routeText: routeText, joinNames: joinNames, tripsTogether: tripsTogether, pairCounts: pairCounts,
           backupDue: backupDue, BACKUP_DAYS: BACKUP_DAYS, SNOOZE_DAYS: SNOOZE_DAYS, PARK_STATES: PARK_STATES, T: T, P: P };
});
