/* Wanderkin trips: the route / miles / stays / favorites / story logic, with no browser parts so it can be tested in Node.
   Data model: see /workspace/new-streams/travel-app/trips-data-model.md. Everything is additive to the v1.2 trip
   (from / stops / place stay filled in from the route so older code keeps working). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WK_TRIPS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var EARTH_MI = 3958.8, KM_PER_MI = 1.609344, AROUND_WORLD = 24901;
  var MAX_POINTS = 50, MAX_STAYS = 8, MAX_FAVS = 12;
  // Flights: time in the air is a rough "gate to gate" guess (525 mph cruise plus 30 minutes for taxi, climb and landing).
  // A drive to or from the airport counts once it's 25 miles or more (closer than that and it's just the airport run).
  var CRUISE_MPH = 525, TAXI_MIN = 30, GROUND_MIN_MI = 25;
  // How each leg was traveled. Ground legs are estimated as great-circle x factor and shown as "about".
  var MODES = [
    { id: "car", label: "Car", ic: "🚗", factor: 1.2, road: true },
    { id: "rv", label: "RV", ic: "🚐", factor: 1.2, road: true },
    { id: "plane", label: "Plane", ic: "✈️", factor: 1 },
    { id: "train", label: "Train", ic: "🚆", factor: 1.2 },
    { id: "boat", label: "Boat", ic: "⛴️", factor: 1.1 },
    { id: "walk", label: "Walk", ic: "🚶", factor: 1.2 }];
  var MODE = {}; MODES.forEach(function (m) { MODE[m.id] = m; });
  var STAY_TYPES = [
    { id: "hotel", label: "Hotel", ic: "🏨" }, { id: "camp", label: "Campground / RV park", ic: "🏕️" },
    { id: "rental", label: "Rental", ic: "🏡" }, { id: "family", label: "Family's house", ic: "👵" }, { id: "other", label: "Other", ic: "⛺" }];
  var FAV_CATS = [
    { id: "restaurant", label: "Favorite restaurant", short: "Restaurant", ic: "🍽️" },
    { id: "activity", label: "Favorite thing we did", short: "Thing we did", ic: "🎢" },
    { id: "treat", label: "Best treat or ice cream", short: "Treat", ic: "🍦" },
    { id: "pub", label: "Best pub", short: "Pub", ic: "🍺", adult: true },
    { id: "drink", label: "Best pint or drink", short: "Pint / drink", ic: "🍻", adult: true },
    { id: "coffee", label: "Best coffee", short: "Coffee", ic: "☕", adult: true }];
  var FAV = {}; FAV_CATS.forEach(function (c) { FAV[c.id] = c; });
  var US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
  var UK_NATIONS = ["ENG", "SCT", "WLS", "NIR"];

  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max || 200); }
  function num(v, lo, hi, dp) { v = v == null || typeof v === "boolean" || (typeof v === "string" && v.trim() === "") ? NaN : Number(v); if (!isFinite(v) || v < lo || v > hi) return null; var f = Math.pow(10, dp || 0); return Math.round(v * f) / f; }
  function vdate(d) { return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T12:00:00").getTime()) ? d : ""; }
  function rid(prefix) { var r = ""; for (var i = 0; i < 12; i++) r += "0123456789abcdef"[Math.floor(Math.random() * 16)]; return prefix + "_" + r; }

  // ---------- distance ----------
  function rad(d) { return d * Math.PI / 180; }
  /** Great-circle miles between two {lat, lon}. null if either has no location. */
  function gcMiles(a, b) {
    if (!hasLoc(a) || !hasLoc(b)) return null;
    var dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function hasLoc(p) { return !!p && typeof p.lat === "number" && typeof p.lon === "number" && isFinite(p.lat) && isFinite(p.lon); }
  /** One leg into point b from point a. how: "manual" (they typed real miles), "flight" (great circle), "about" (estimate), "unknown". */
  /** A leg no one drives: across an ocean (the Americas to Europe/Africa/Asia) or longer than coast to coast. */
  function mustFly(a, b) {
    var g = gcMiles(a, b); if (g == null) return false;
    return g > 2800 || (g > 1000 && (a.lon < -30) !== (b.lon < -30));
  }
  /** A stop that's really the place you're already at (typed "Orlando" again after starting at home in Orlando). */
  function sameStop(a, b) {
    if (!a || !b) return false;
    // v79: a castle or viewpoint is its own stop even inside the town before it (Edinburgh, then Edinburgh Castle)
    if ((a.kind === "sight") !== (b.kind === "sight")) return false;
    if (a.kind === "sight") return (!!a.ref && a.ref === b.ref) || String(a.name || "").trim().toLowerCase() === String(b.name || "").trim().toLowerCase();
    var g = gcMiles(a, b); if (g != null) return g < 5;
    return String(a.name || "").trim().toLowerCase() === String(b.name || "").trim().toLowerCase();
  }
  /** v80: after stops move or one is added in the middle, a leg whose previous stop changed loses what was only true of the old leg
   *  (typed miles, the airports flown between). The stops themselves, their nights, notes and stamps are kept. Returns the changed indexes. */
  function relink(before, after) {
    var changed = [];
    after.forEach(function (p, i) {
      if (i === 0) { delete p.mode; delete p.miles; delete p.dep; delete p.arr; return; }
      var j = before.indexOf(p);
      if (j < 1 || before[j - 1] !== after[i - 1]) { delete p.miles; delete p.dep; delete p.arr; changed.push(i); }
    });
    return changed;
  }
  /** Move stop from -> to (the start, index 0, stays put). Same stop objects, new order. */
  function moveStop(route, from, to) {
    var r = (route || []).slice();
    if (from < 1 || to < 1 || from >= r.length || to >= r.length || from === to) return { route: r, changed: [] };
    var p = r.splice(from, 1)[0]; r.splice(to, 0, p);
    return { route: r, changed: relink(route, r) };
  }
  /** Put a new stop in at index at (between at-1 and at). */
  function insertStop(route, at, p) {
    var r = (route || []).slice(); at = Math.max(r.length ? 1 : 0, Math.min(r.length, at | 0));
    r.splice(at, 0, p);
    return { route: r, at: at, changed: relink(route, r) };
  }
  /** The route without stops that repeat the one before them; at (optional) gets each kept stop's index. */
  function stops(r0, at) {
    var r = [];
    (r0 || []).forEach(function (p, j) { if (!r.length || !sameStop(r[r.length - 1], p) || (typeof p.miles === "number" && p.miles > 0)) { r.push(p); if (at) at.push(j); } });
    return r;
  }
  function legMiles(a, b) {
    var m = MODE[b.mode] || MODE.car;
    if (typeof b.miles === "number" && b.miles >= 0) return { miles: b.miles, how: "manual", mode: m.id };
    if (m.id !== "plane" && m.id !== "boat" && mustFly(a, b)) m = MODE.plane;   // Skip on "Did you fly?" doesn't make Rome -> Orlando a drive
    if (m.id === "plane") {
      var from = hasLoc(b.dep) ? b.dep : a, to = hasLoc(b.arr) ? b.arr : b, g = gcMiles(from, to);
      var o = { miles: g == null ? null : g, how: g == null ? "unknown" : "flight", mode: m.id, air: g == null ? null : airMinutes(g) };
      // the drive to the airport and from the one you landed at, when it's more than an airport run
      var gA = hasLoc(b.dep) ? gcMiles(a, b.dep) : null, gB = hasLoc(b.arr) ? gcMiles(b.arr, b) : null;
      if (gA != null && gA >= GROUND_MIN_MI) o.toAp = gA * MODE.car.factor;
      if (gB != null && gB >= GROUND_MIN_MI) o.fromAp = gB * MODE.car.factor;
      return o;
    }
    var d = gcMiles(a, b);
    return { miles: d == null ? null : d * m.factor, how: d == null ? "unknown" : "about", mode: m.id };
  }
  /** Rough minutes in the air for one flight of this many miles. */
  function airMinutes(mi) { return mi == null || !isFinite(mi) || mi <= 0 ? null : Math.round(mi / CRUISE_MPH * 60 + TAXI_MIN); }
  /** "8h 5m", "45m". Rounded to 5 minutes, since it's a guess. */
  function fmtAir(min) {
    if (min == null || !(min > 0)) return "";
    var m = Math.max(5, Math.round(min / 5) * 5), h = Math.floor(m / 60), r = m % 60;
    return h ? h + "h" + (r ? " " + r + "m" : "") : r + "m";
  }
  /** Does the route leave the home country (its first stop's country)? */
  function crossesBorder(route, homeCountry) {
    var r = route || [], home = homeCountry || (r[0] && r[0].country) || "";
    if (!home) { var seen = {}; r.forEach(function (p) { if (p.country) seen[p.country] = 1; }); return Object.keys(seen).length > 1; }
    return r.slice(1).some(function (p) { return p.country && p.country !== home; });
  }
  function fmtDist(mi, units, opts) {
    if (mi == null) return "? " + (units === "km" ? "km" : "mi");
    var v = units === "km" ? mi * KM_PER_MI : mi, r = Math.round(v);
    var s = r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return s + (opts && opts.long ? (units === "km" ? " kilometers" : r === 1 ? " mile" : " miles") : (units === "km" ? " km" : " mi"));
  }

  // ---------- cleaning ----------
  function fold(x) { return String(x || "").normalize ? String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : String(x || "").toLowerCase(); }
  /** The city people know an airport by. OurAirports' "municipality" is often the suburb it sits in ("Ingliston, Edinburgh",
      "Paris (Roissy-en-France, Val-d'Oise)", "Geelong/Melbourne"): use the part that's also in the airport's name, else the
      part before any comma or bracket. */
  var AP_CITY = { LYS: "Lyon", MRS: "Marseille", MXP: "Milan", LIN: "Milan", BGY: "Bergamo", FLR: "Florence", GOA: "Genoa", BSL: "Basel", LPB: "La Paz",
    NRT: "Tokyo", HND: "Tokyo", KIX: "Osaka", NOU: "Nouméa", IAD: "Washington", DCA: "Washington", BWI: "Baltimore", ICN: "Seoul", GMP: "Seoul", CGK: "Jakarta" };
  function airportCity(city, name, code) {
    if (code && AP_CITY[code]) return AP_CITY[code];
    city = String(city || "").trim(); if (!city) return "";
    var parts = city.split(/\s*[,/()]\s*/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 1 && !/^[A-Z]{2}$/.test(x); });
    if (!parts.length) return city;
    var n = fold(name), hit = parts.filter(function (x) { return n.indexOf(fold(x)) >= 0; })[0];
    return hit || parts[0];
  }
  // the 2026 place list had France named "Mayotte" and Norway "Svalbard and Jan Mayen"; fix trips saved with that
  function fixSub(sub, p) {
    if (p.country === "FRA" && !(p.lat < -12.4 && p.lat > -13.1 && p.lon > 44.9 && p.lon < 45.4)) return sub.replace(/, Mayotte$/, ", France");
    if (p.country === "NOR" && !(p.lat > 70.5)) return sub.replace(/, Svalbard and Jan Mayen$/, ", Norway");
    return sub;
  }
  function cleanAirport(a) {
    if (!a || typeof a !== "object" || !/^[A-Z]{3}$/.test(a.code || "")) return null;
    var o = { code: a.code, name: clean(a.name, 80), city: airportCity(clean(a.city, 60), a.name, a.code), country: /^[A-Z]{3}$/.test(a.country || "") ? a.country : "" };
    var lat = num(a.lat, -90, 90, 3), lon = num(a.lon, -180, 180, 3);
    if (lat != null && lon != null) { o.lat = lat; o.lon = lon; }
    return o;
  }
  /** The way home on a round trip, when it isn't just the first leg backwards (e.g. drove to Miami, flew to London). */
  function cleanBack(b) {
    if (!b || typeof b !== "object" || !MODE[b.mode]) return null;
    var o = { mode: b.mode };
    if (b.mode === "plane") { var d = cleanAirport(b.dep), r = cleanAirport(b.arr); if (d) o.dep = d; if (r) o.arr = r; }
    if (b.picked) o.picked = true;   // the family chose this airport home themselves: don't re-guess it when stops change
    return o;
  }
  function cleanPoint(p, first) {
    if (!p || typeof p !== "object") return null;
    var name = clean(p.name, 80); if (!name) return null;
    var o = { name: name, kind: /^(city|park|place|sight)$/.test(p.kind) ? p.kind : "place" };
    if (p.ref) o.ref = clean(p.ref, 40);
    // v79: a sight (castle, ruin, viewpoint, beach, distillery, a pin you dropped...): its type, the town it's in, and how famous it is
    if (o.kind === "sight") {
      o.type = /^[a-z]{2,16}$/.test(p.type || "") ? p.type : "landmark";
      if (clean(p.town, 60)) o.town = clean(p.town, 60);
      var fm = num(p.fame, 0, 999); if (fm) o.fame = fm;
    }
    var lat = num(p.lat, -90, 90, 3), lon = num(p.lon, -180, 180, 3);
    if (lat != null && lon != null) { o.lat = lat; o.lon = lon; }
    if (/^[A-Z]{3}$/.test(p.country || "")) o.country = p.country;
    if (/^[A-Z0-9]{1,3}$/.test(p.region || "")) o.region = p.region;
    if (p.sub) o.sub = fixSub(clean(p.sub, 80), o);
    if (p.near) o.near = clean(p.near, 60);
    var n = num(p.nights, 0, 366); if (n != null) o.nights = n;
    // v95: a stop's own date and notes (from Edit stop)
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.date || "") && !isNaN(Date.parse(p.date))) o.date = p.date;
    if (clean(p.note, 300)) o.note = clean(p.note, 300);
    if (!first) {
      o.mode = MODE[p.mode] ? p.mode : "car";
      var mi = num(p.miles, 0, 30000, 1); if (mi != null) o.miles = mi;
      if (o.mode === "plane") { var d = cleanAirport(p.dep), r = cleanAirport(p.arr); if (d) o.dep = d; if (r) o.arr = r; }
    }
    return o;
  }
  function cleanRoute(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (p) { if (out.length >= MAX_POINTS) return; var c = cleanPoint(p, out.length === 0); if (c) out.push(c); });
    return out;
  }
  function stars(v) { var n = num(v, 0, 5); return n == null ? 0 : n; }
  function cleanStays(list) {
    return (Array.isArray(list) ? list : []).map(function (s) {
      if (!s || !clean(s.name, 80)) return null;
      var o = { id: /^stay_[a-z0-9]{4,20}$/.test(s.id || "") ? s.id : rid("stay"), name: clean(s.name, 80), type: STAY_TYPES.some(function (t) { return t.id === s.type; }) ? s.type : "hotel" };
      var n = num(s.nights, 0, 366); if (n != null) o.nights = n;
      if (stars(s.rating)) o.rating = stars(s.rating);
      if (clean(s.note, 140)) o.note = clean(s.note, 140);
      if (clean(s.where, 60)) o.where = clean(s.where, 60);
      return o;
    }).filter(Boolean).slice(0, MAX_STAYS);
  }
  function cleanFavs(list) {
    return (Array.isArray(list) ? list : []).map(function (f) {
      if (!f || !FAV[f.cat] || !clean(f.name, 80)) return null;
      var o = { id: /^fav_[a-z0-9]{4,20}$/.test(f.id || "") ? f.id : rid("fav"), cat: f.cat, name: clean(f.name, 80) };
      if (clean(f.where, 60)) o.where = clean(f.where, 60);
      if (stars(f.rating)) o.rating = stars(f.rating);
      if (clean(f.note, 140)) o.note = clean(f.note, 140);
      return o;
    }).filter(Boolean).slice(0, MAX_FAVS);
  }
  function cleanMoments(m, ids) {
    var out = {};
    if (m && typeof m === "object") Object.keys(m).forEach(function (id) { var v = clean(m[id], 280); if (v && (!ids || ids.indexOf(id) >= 0)) out[id] = v; });
    return out;
  }
  // Trip memories: optional answers to a few prompts (the free-text notes stay in trip.memory). Synced with the trip.
  var MEM_PROMPTS = [["best", "Best part", "🌟", "The thing everyone will talk about"], ["food", "Favorite food", "🍦", "The best thing anyone ate"],
    ["moment", "Most memorable moment", "📸", "The moment to never forget"], ["funny", "Funniest moment", "😂", "What made everyone laugh"],
    ["again", "Would go back for", "🔁", "The reason to come back"]];
  function cleanMemories(o) {
    var out = {}; if (!o || typeof o !== "object") return out;
    MEM_PROMPTS.forEach(function (p) { var v = String(o[p[0]] == null ? "" : o[p[0]]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, 400); if (v) out[p[0]] = v; });
    return out;
  }
  function cleanStory(s) {
    if (!s || typeof s !== "object") return null;
    var text = String(s.text == null ? "" : s.text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, 3000);
    if (!text) return null;
    return { text: text, style: s.style === "journal" ? "journal" : "storybook", edited: !!s.edited, seed: num(s.seed, 0, 1e9) || 0, at: typeof s.at === "string" ? s.at.slice(0, 30) : "" };
  }
  /** Family Sync stores each trip as one JSON row capped at 16 KB. Trim the least important text until it fits
   *  (route, dates, names and who went are never touched). Mutates and returns t. */
  var TRIP_BUDGET = 15000;
  function bytes(o) { var j = JSON.stringify(o); return typeof Buffer !== "undefined" ? Buffer.byteLength(j) : new Blob([j]).size; }
  function fitSize(t, max) {
    max = max || TRIP_BUDGET; if (!t || bytes(t) <= max) return t;
    function cut(s, n) { return typeof s === "string" && s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
    var steps = [
      function () { (t.route || []).forEach(function (p) { delete p.sub; delete p.near; delete p.ref; [p.dep, p.arr].forEach(function (a) { if (a) a.name = cut(a.name, 30); }); }); },
      function () { (t.stays || []).forEach(function (x) { x.note = cut(x.note, 80); }); (t.favs || []).forEach(function (x) { x.note = cut(x.note, 80); }); },
      function () { Object.keys(t.moments || {}).forEach(function (k) { t.moments[k] = cut(t.moments[k], 140); }); t.memory = cut(t.memory, 300); t.who = cut(t.who, 80); Object.keys(t.memories || {}).forEach(function (k) { t.memories[k] = cut(t.memories[k], 160); }); },
      function () { if (t.story) t.story.text = cut(t.story.text, 1500); },
      function () { (t.stays || []).forEach(function (x) { delete x.note; x.where = cut(x.where, 30); }); (t.favs || []).forEach(function (x) { delete x.note; x.where = cut(x.where, 30); }); },
      function () { if (t.story) t.story.text = cut(t.story.text, 600); (t.route || []).forEach(function (p) { p.name = cut(p.name, 40); }); }
    ];
    for (var i = 0; i < steps.length && bytes(t) > max; i++) steps[i]();
    return t;
  }

  /** The trip fields added in v1.4 (backup v4), cleaned. Anything missing comes back empty. */
  function cleanExtras(o, kidIds) {
    o = o || {};
    var x = { route: cleanRoute(o.route), title: clean(o.title, 80), endDate: vdate(o.endDate), roundTrip: !!o.roundTrip, done: !!o.done,
              stays: cleanStays(o.stays), favs: cleanFavs(o.favs), moments: cleanMoments(o.moments, kidIds) };
    var n = num(o.nights, 0, 999); x.nights = n == null ? null : n;
    x.story = cleanStory(o.story);
    // v1.6: the "Did you fly?" answer ("yes", "no", "skip" or "" = not asked yet) and an optional way home
    x.fly = /^(yes|no|skip)$/.test(o.fly || "") ? o.fly : "";
    x.back = cleanBack(o.back);
    x.memories = cleanMemories(o.memories);
    x.wx = wxClean(o.wx);   // v1.7: weather picked by hand, per day
    return x;
  }

  function wxClean(o) {
    var W = (typeof self !== "undefined" && self.WK_WX) || (typeof require === "function" ? require("./weather-core.js") : null);
    return W ? W.cleanWx(o) : {};
  }
  // a line about the weather: only days the family picked by hand, or real recorded past weather (never a forecast)
  var WX_LINES = {
    storybook: { rainy: ["It was a rainy day in {p}, so they splashed through the puddles!", "The rain pitter-pattered all day in {p}, but nobody minded!"],
      sunny: ["The sun shone bright and warm in {p}!", "It was a sunny day in {p}, perfect for exploring!"], stormy: ["A big thunderstorm rumbled over {p}!"],
      snowy: ["Snowflakes fell in {p}!"], windy: ["The wind whooshed and whistled in {p}!"], foggy: ["Fog wrapped around {p} like a big gray blanket."],
      hot: ["It was a hot, hot day in {p}!"], cold: ["It was a chilly day in {p}, so everyone bundled up!"], cloudy: ["Clouds filled the sky over {p}."], partly: ["The sun peeked through the clouds in {p}."] },
    journal: { rainy: ["We had a rainy day in {p}.", "It rained in {p}, and we didn't let it stop us."], sunny: ["We got a sunny day in {p}.", "The sun came out for us in {p}."],
      stormy: ["A thunderstorm rolled through {p}."], snowy: ["We saw snow in {p}."], windy: ["It was a windy day in {p}."], foggy: ["Fog rolled into {p}."],
      hot: ["It was a hot day in {p}."], cold: ["It was a cold day in {p}."], cloudy: ["It was a cloudy day in {p}."], partly: ["We had sun and clouds in {p}."] } };

  // ---------- migration ----------
  /** v1.2 trips have From / stops / To as words. Turn them into route points with no location (miles show as "?" until
      someone finds each place). The trip's map mark, if any, tells us where the destination was. */
  function routeFromLegacy(t) {
    var names = [t.from].concat(Array.isArray(t.stops) ? t.stops : []).concat([t.place]).map(function (x) { return clean(x, 80); }).filter(Boolean);
    names = names.filter(function (x, i) { return i === 0 || x.toLowerCase() !== names[i - 1].toLowerCase(); });
    var pts = names.map(function (n, i) { var p = { name: n, kind: "place" }; if (i) p.mode = "car"; return p; });
    var last = pts[pts.length - 1];
    if (last && t.mark && t.mark.id) {
      if (t.mark.kind === "state") { last.country = "USA"; last.region = t.mark.id; }
      else if (t.mark.kind === "place") { if (UK_NATIONS.indexOf(t.mark.id) >= 0) { last.country = "GBR"; last.region = t.mark.id; } else last.country = t.mark.id; }
      else if (t.mark.kind === "park") { last.kind = "park"; last.ref = t.mark.id; last.country = "USA"; }
    }
    return pts.slice(0, MAX_POINTS);
  }
  var UK_NAME = { ENG: "England", SCT: "Scotland", WLS: "Wales", NIR: "Northern Ireland" };
  function countryLabel(id) {
    var w = typeof self !== "undefined" && self.MLTL_MAPS && self.MLTL_MAPS.world, c = w && w.countries ? w.countries.filter(function (x) { return x.id === id; })[0] : null;
    return c ? c.name : "";
  }
  /** What the trip was "to": a trip abroad that stayed in one country or UK nation is "Scotland" / "France" (one stop abroad keeps its
      town, "Paris"); a trip across countries is the longest stay, else the first stop abroad. Trips at home: the last stop, as before. */
  function mainDest(route) {
    var r = stops(route); if (!r.length) return "";
    var last = r[r.length - 1].name, home = r[0];
    if (r.length < 2 || !home.country) return last;
    var abroad = r.slice(1).filter(function (p) { return p.country && p.country !== home.country; });
    if (!abroad.length) return last;
    var one = abroad.every(function (p) { return p.country === abroad[0].country; });
    if (one && abroad.length > 1) {
      if (abroad[0].country === "GBR" && UK_NAME[abroad[0].region] && abroad.every(function (p) { return p.region === abroad[0].region; })) return UK_NAME[abroad[0].region];
      return countryLabel(abroad[0].country) || abroad[0].name;
    }
    if (one) return abroad[0].name;
    var stay = null; abroad.forEach(function (p) { if (typeof p.nights === "number" && p.nights > 0 && (!stay || p.nights > stay.nights)) stay = p; });
    return (stay || abroad[0]).name;
  }
  /** Keep the v1.2 fields in step with the route, so older code, sync's from_place / to_place and print all still read right. */
  function syncLegacy(t) {
    var r = t.route || [];
    if (r.length) {
      t.from = r.length > 1 ? r[0].name : (t.from || "");
      t.stops = r.slice(1, -1).map(function (p) { return p.name; }).slice(0, 5);
      t.place = t.title || mainDest(r) || r[r.length - 1].name;
    }
    return t;
  }

  // ---------- summaries ----------
  function nightsBetween(a, b) { a = vdate(a); b = vdate(b); if (!a || !b) return null; var n = Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5); return n >= 0 ? n : null; }
  /** Legs, miles and what the trip saw. Skips the start point when the trip has more than one stop (that's home). */
  function summary(t) {
    var r0 = t.route || [], r = [], at = [], legs = [], miles = 0, known = true, flights = 0, road = 0;
    // a stop repeating the one before it (Orlando -> Orlando, ~0 mi) isn't a leg, a town or a story line
    stops(r0, at).forEach(function (p) { r.push(p); });
    for (var i = 1; i < r.length; i++) {
      var L = legMiles(r[i - 1], r[i]); L.from = r[i - 1].name; L.to = r[i].name; L.i = at[i]; L.dep = r[i].dep || null; L.arr = r[i].arr || null;
      legs.push(L);
    }
    if (t.roundTrip && r.length > 1) {
      var first = r[1], bk = cleanBack(t.back), back = { name: r[0].name, lat: r[0].lat, lon: r[0].lon, mode: bk ? bk.mode : first.mode || "car" };
      if (bk) { if (bk.dep) back.dep = bk.dep; if (bk.arr) back.arr = bk.arr; }
      else if (first.mode === "plane" && !(hasLoc(first.arr) && gcMiles(r[r.length - 1], first.arr) > 300)) { if (first.arr) back.dep = first.arr; if (first.dep) back.arr = first.dep; }   // Rome isn't 1,000 road miles from London City
      var R = legMiles(r[r.length - 1], back); R.from = r[r.length - 1].name; R.to = r[0].name; R.i = r0.length; R.home = true; R.dep = back.dep || null; R.arr = back.arr || null;
      legs.push(R);
    }
    var flown = 0, air = 0;
    legs.forEach(function (L) {
      if (L.miles == null) known = false; else { miles += L.miles; if (MODE[L.mode].road) road += L.miles; }
      if (L.mode === "plane") {
        flights++;
        if (L.miles != null) { flown += L.miles; air += L.air || airMinutes(L.miles) || 0; }
        var g = (L.toAp || 0) + (L.fromAp || 0); miles += g; road += g;
      }
    });
    var seen = r.length > 1 ? r.slice(1) : r.slice();
    var cities = [], parks = [], states = [], countries = [], uk = [], sights = [];
    function add(a, v) { if (v && a.indexOf(v) < 0) a.push(v); }
    seen.forEach(function (p) {
      if (p.kind === "park") add(parks, p.ref || p.name); else if (p.kind === "sight") { add(sights, p.name); if (p.town) add(cities, p.town); } else add(cities, p.name);
      if (p.country === "USA" && US_STATES.indexOf(p.region) >= 0) add(states, p.region);
      if (p.country === "GBR" && UK_NATIONS.indexOf(p.region) >= 0) add(uk, p.region);
      add(countries, p.country);
    });
    var nights = typeof t.nights === "number" ? t.nights : nightsBetween(t.date, t.endDate);
    if (nights == null) { var s = 0, any = false; r.forEach(function (p) { if (typeof p.nights === "number") { s += p.nights; any = true; } }); nights = any ? s : null; }
    return { legs: legs, miles: Math.round(miles), milesKnown: known && legs.length > 0, flights: flights, roadMiles: Math.round(road), flightMiles: Math.round(flown), airMin: air,
             cities: cities, sights: sights, parks: parks, states: states, countries: countries, ukNations: uk, nights: nights, days: nights == null ? null : nights + 1 };
  }
  /** Map areas a trip colors in for everyone on it: [{ kind: "state"|"place"|"park", id }]. */
  function areas(t, parkStates) {
    var out = [], keys = {};
    function add(kind, id) { if (id && !keys[kind + id]) { keys[kind + id] = 1; out.push({ kind: kind, id: id }); } }
    var r = stops(t.route), seen = r.length > 1 ? r.slice(1) : r;
    seen.forEach(function (p) {
      if (p.kind === "park" && p.ref) {
        add("park", p.ref);
        var st = parkStates && parkStates[p.ref];
        if (st && st.length === 1) add("state", st[0]);   // a park in two states doesn't say which one you were in
      }
      if (p.country === "USA") { if (US_STATES.indexOf(p.region) >= 0) add("state", p.region); }
      else if (p.country === "GBR") { if (UK_NATIONS.indexOf(p.region) >= 0) add("place", p.region); }
      else if (p.country) add("place", p.country);
    });
    return out;
  }
  function isAdult(p) { return !!p && (p.role === "adult" || p.role === "grand"); }
  /** Grown-up favorites (pub, pint, coffee) show only when a grown-up went, and not on a kid's own pages unless the family turned that on. */
  function showAdult(trip, people, viewer, allowOnKidPages) {
    var grownUp = (trip.kidIds || []).some(function (id) { return people.some(function (p) { return p.id === id && isAdult(p); }); });
    if (!grownUp) return false;
    if (viewer && !isAdult(viewer) && !allowOnKidPages) return false;
    return true;
  }
  function visibleFavs(trip, people, viewer, allowOnKidPages) {
    var ok = showAdult(trip, people, viewer, allowOnKidPages);
    return (trip.favs || []).filter(function (f) { return ok || !(FAV[f.cat] && FAV[f.cat].adult); });
  }
  function tripMiles(t) { return summary(t).miles; }
  /** Lifetime numbers for one person (personId) or the whole family (personId = null, each trip counted once). */
  function lifetime(personId, trips) {
    var mine = trips.filter(function (t) { return !personId || (t.kidIds || []).indexOf(personId) >= 0; });
    var miles = 0, flights = 0, flown = 0, air = 0, bigRoad = 0, longest = null, stateCount = {}, restaurants = [];
    mine.forEach(function (t) {
      var s = summary(t); miles += s.miles; flights += s.flights; flown += s.flightMiles; air += s.airMin; bigRoad = Math.max(bigRoad, s.roadMiles);
      if (s.miles > 0 && (!longest || s.miles > longest.miles)) longest = { id: t.id, name: t.place, miles: s.miles };
      s.states.forEach(function (st) { stateCount[st] = (stateCount[st] || 0) + 1; });
      (t.favs || []).forEach(function (f) { if (f.cat === "restaurant") restaurants.push({ name: f.name, where: f.where || "", rating: f.rating || 0, tripId: t.id, trip: t.place, date: t.date || "" }); });
    });
    var top = Object.keys(stateCount).sort(function (a, b) { return stateCount[b] - stateCount[a] || (a < b ? -1 : 1); })[0];
    restaurants.sort(function (a, b) { return (b.rating - a.rating) || (b.date < a.date ? -1 : 1); });
    return { trips: mine.length, miles: Math.round(miles), flights: flights, flightMiles: Math.round(flown), airMin: air, bigRoad: Math.round(bigRoad), longest: longest,
             topState: top ? { id: top, count: stateCount[top] } : null, restaurants: restaurants, aroundWorld: Math.round(miles / AROUND_WORLD * 100) / 100 };
  }

  // ---------- map drawing (same projections the maps were built with) ----------
  var PROJ = { world: [-2.655438, 1.305259, 185.903488, 4.0, 6.222778], us48: [-0.368425, 0.245647, 1318.370346, 24.470927, 10.0],
               ak: [-0.256228, 0.372867, 470.225176, 10.0, 445.164583], hi: [-0.324121, 0.276334, 416.272337, 250.0, 526.706234] };
  function equalEarth(lon, lat) {
    var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    var th = Math.asin(M * Math.sin(rad(lat))), t2 = th * th, t6 = t2 * t2 * t2;
    return [rad(lon) * Math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
  }
  function albers(lat1, lat2, lat0, lon0) {
    var n = (Math.sin(rad(lat1)) + Math.sin(rad(lat2))) / 2, C = Math.pow(Math.cos(rad(lat1)), 2) + 2 * n * Math.sin(rad(lat1));
    var rho0 = Math.sqrt(C - 2 * n * Math.sin(rad(lat0))) / n;
    return function (lon, lat) { var rho = Math.sqrt(Math.max(C - 2 * n * Math.sin(rad(lat)), 0)) / n, th = n * rad(lon - lon0); return [rho * Math.sin(th), rho0 - rho * Math.cos(th)]; };
  }
  var P48 = albers(29.5, 45.5, 37.5, -96), PAK = albers(55, 65, 50, -154), PHI = albers(8, 18, 13, -157);
  function fit(f, xy) { return [Math.round((f[3] + (xy[0] - f[0]) * f[2]) * 10) / 10, Math.round((f[4] + (f[1] - xy[1]) * f[2]) * 10) / 10]; }
  /** SVG x,y for a point on the world map (1000x500) or the US map (1000x620). */
  function project(p, map) {
    if (!hasLoc(p)) return null;
    if (map === "us") {
      if (p.region === "AK" || (p.lat > 51 && p.lon < -129)) return fit(PROJ.ak, PAK(p.lon > 0 ? p.lon - 360 : p.lon, p.lat));
      if (p.region === "HI" || (p.lat < 23 && p.lon < -150)) return fit(PROJ.hi, PHI(p.lon, p.lat));
      return fit(PROJ.us48, P48(p.lon, p.lat));
    }
    return fit(PROJ.world, equalEarth(p.lon, p.lat));
  }
  /** Which map to draw a route on: the US map when every located stop is in the 50 states, otherwise the world. */
  function routeMap(t) {
    var pts = (t.route || []).filter(hasLoc);
    if (!pts.length) return null;
    var us = pts.every(function (p) { return p.country === "USA" && (!p.region || US_STATES.indexOf(p.region) >= 0); });
    return us ? "us" : "world";
  }

  // ---------- story ----------
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function joinNames(list) { list = list.filter(Boolean); return list.length < 2 ? (list[0] || "") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1]; }
  function nameOf(p) { return p ? (clean(p.nickname, 40) || p.name || "") : ""; }   // the nickname the family uses, else the name
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function monthYear(d) { return vdate(d) ? MONTHS[parseInt(d.slice(5, 7), 10) - 1] + " " + d.slice(0, 4) : ""; }
  function longDate(d) { return vdate(d) ? MONTHS[parseInt(d.slice(5, 7), 10) - 1] + " " + parseInt(d.slice(8, 10), 10) + ", " + d.slice(0, 4) : ""; }
  function fill(tpl, v) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return v[k] == null ? "" : v[k]; }); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function numWord(n) { return ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] || String(n); }

  var LEX = {
    storybook: {
      open: ["Once upon a time, {who} packed their bags for {dest}.", "This is the story of the {when}trip {who} took to {dest}.",
             "{When}{who} set off on a big adventure to {dest}.", "Grab a snack and get comfy, because this is the tale of {who} and their trip to {dest}."],
      plane: ["{tr} they flew {mi} from {a} to {b}, way up above the clouds.", "{tr} a big airplane carried them {mi} from {a} all the way to {b}.", "{tr} they zoomed through the sky, {mi} from {a} to {b}!"],
      car: ["{tr} they drove about {mi} to {b}.", "{tr} they hit the road for about {mi} and rolled into {b}.", "{tr} the car hummed along for about {mi} until they reached {b}."],
      rv: ["{tr} the RV rumbled about {mi} down the road to {b}.", "{tr} they rolled their home-on-wheels about {mi} to {b}."],
      train: ["{tr} they rode the train about {mi} to {b}, choo-choo!", "{tr} a train whooshed them about {mi} to {b}."],
      boat: ["{tr} they sailed about {mi} across the water to {b}.", "{tr} a boat bobbed them about {mi} over the waves to {b}."],
      walk: ["{tr} they walked about {mi} to {b}, one step at a time.", "{tr} their feet carried them about {mi} to {b}."],
      home: ["At the end, they headed home to {b}, about {mi} away.", "Then it was time to go home to {b}."],
      tr: ["First,", "Next,", "After that,", "Then", "Before long,", "Later,"], last: ["Finally,", "At last,", "And then,"],
      nights: ["They stayed {n} in {b}.", "{b} was home for {n}."],
      stay: { hotel: ["They slept at {name}{where}.", "Bedtime was at {name}{where}."], camp: ["They camped at {name}{where}, under the stars.", "They pitched camp at {name}{where}."],
              rental: ["They made themselves at home at {name}{where}.", "Their cozy hideout was {name}{where}."], family: ["They stayed with family at {name}{where}.", "Hugs and sleepovers happened at {name}{where}."],
              other: ["They stayed at {name}{where}."] },
      loved: [" Everyone loved it.", " It was a five-star sleep!"],
      fav: { restaurant: ["The yummiest meal was at {name}{where}.", "Everyone agreed {name}{where} was the best place to eat."],
             activity: ["The best thing they did? {name}!", "The most fun of all was {name}."],
             treat: ["And the best treat of the whole trip was {name}{where}!", "The sweetest moment came with {name}{where}. Yum!"] },
      moment: ["{p}'s favorite moment was this: {m}", "Ask {p} about the best part and you'll hear: {m}", "For {p}, the best part was this: {m}"],
      memory: ["Everyone still talks about this: {m}", "And here's the moment they keep remembering: {m}"],
      firstCountry: ["It was {p}'s very first time in {c}!", "{p} had never been to {c} before, and now they had!"],
      firstPark: ["{p} visited {c} for the very first time.", "{c} was brand new for {p}."],
      badge: ["{p} even earned a new badge: {c}!", "And guess what? {p} unlocked the {c} badge!"],
      badges: ["{p} earned {n} new badges: {c}!", "And guess what? {p} unlocked {n} new badges: {c}!"],
      mem: { best: ["The best part of the whole trip? {m}", "Everyone agrees the best part was this: {m}"],
             food: ["The yummiest thing anyone ate: {m}", "Tummies were happiest with this: {m}"],
             moment: ["The moment nobody will ever forget: {m}", "Here's a moment to keep forever: {m}"],
             funny: ["The giggliest moment of all: {m}", "Everyone laughed so hard at this: {m}"],
             again: ["They'd go back in a heartbeat for this: {m}", "Someday they'll go back, just for this: {m}"] },
      total: ["All together, they traveled {mi}{nights}.", "When they added it all up, they had gone {mi}{nights}."],
      air: ["They spent about {h} up in the sky on {f} {fl}.", "That's about {h} of looking out the airplane window!"],
      close: ["And they all lived happily ever after, already dreaming about the next trip. The end.", "They came home tired, happy and full of stories. The end.",
              "And that is how {who} made a memory to keep forever. The end."]
    },
    journal: {
      open: ["{When}we set out for {dest}: {who}.", "We'll always remember {month} as the trip to {dest}.", "This is the story of our trip to {dest}, with {who}.",
             "Some trips you plan and some just happen. Our trip to {dest}, with {who}, was the best kind."],
      plane: ["{tr} we flew {mi} from {a} to {b}.", "{tr} we caught the flight from {a}, and {mi} later we landed in {b}.", "{tr} {mi} in the air took us from {a} to {b}."],
      car: ["{tr} we drove about {mi} to {b}.", "{tr} about {mi} of road brought us to {b}.", "{tr} we put about {mi} on the car getting to {b}."],
      rv: ["{tr} we took the RV about {mi} to {b}.", "{tr} the RV carried us about {mi} to {b}."],
      train: ["{tr} we took the train about {mi} to {b}.", "{tr} we watched the miles go by from the train, about {mi} to {b}."],
      boat: ["{tr} we crossed the water to {b}, about {mi}.", "{tr} the ferry took us about {mi} to {b}."],
      walk: ["{tr} we walked about {mi} to {b}.", "{tr} we went on foot, about {mi}, to {b}."],
      home: ["Then home again to {b}, about {mi}.", "And at the end, the long way home to {b}."],
      tr: ["First,", "From there,", "Next,", "After that,", "Then", "A little later,"], last: ["Finally,", "Last of all,", "And then,"],
      nights: ["We spent {n} in {b}.", "{b} got {n} of our time."],
      stay: { hotel: ["We stayed at {name}{where}.", "Home base was {name}{where}."], camp: ["We camped at {name}{where}.", "We set up camp at {name}{where}."],
              rental: ["We rented {name}{where}.", "Our place was {name}{where}."], family: ["We stayed with family at {name}{where}.", "Family put us up at {name}{where}."],
              other: ["We stayed at {name}{where}."] },
      loved: [" We'd go back in a heartbeat.", " Highly recommended."],
      fav: { restaurant: ["The best meal was at {name}{where}.", "If you go, eat at {name}{where}."],
             activity: ["The highlight was {name}.", "The thing we did that topped them all: {name}."],
             treat: ["The best treat was {name}{where}.", "Nobody skipped dessert, especially {name}{where}."],
             pub: ["The pub we liked best was {name}{where}.", "Our favorite pub turned out to be {name}{where}."],
             drink: ["The best pint (or drink) of the trip: {name}{where}.", "Raise a glass to {name}{where}, the best drink of the trip."],
             coffee: ["Best coffee: {name}{where}.", "Mornings started with the best coffee at {name}{where}."] },
      moment: ["{p}'s favorite moment: {m}", "For {p}, it was this: {m}", "Ask {p} and you'll hear about this: {m}"],
      memory: ["The moment we keep coming back to: {m}", "What we'll remember most: {m}"],
      firstCountry: ["It was {p}'s first time in {c}.", "{c} was a first for {p}."],
      firstPark: ["It was {p}'s first visit to {c}.", "{p} saw {c} for the first time."],
      badge: ["{p} earned the {c} badge on this one.", "New badge for {p}: {c}."],
      badges: ["{p} earned {n} new badges on this one: {c}.", "New badges for {p}: {c}."],
      mem: { best: ["The best part: {m}", "If we had to pick a best part: {m}"],
             food: ["Favorite food: {m}", "The best thing we ate: {m}"],
             moment: ["The moment we'll never forget: {m}", "Most memorable of all: {m}"],
             funny: ["Funniest moment: {m}", "We still laugh about this: {m}"],
             again: ["We'd go back for this: {m}", "The reason we'll go back: {m}"] },
      total: ["All told, we covered {mi}{nights}.", "By the end we'd traveled {mi}{nights}."],
      air: ["About {h} of that was in the air, on {f} {fl}.", "We spent about {h} in the air."],
      close: ["Already wondering where we'll go next.", "Here's to the next one.", "A trip worth writing down."]
    }
  };
  function airWords(min) { var h = Math.round(min / 60); return h < 1 ? "an hour" : h === 1 ? "an hour" : numWord(h) + " hours"; }
  function sentenceEnd(m) { m = clean(m, 280); return /[.!?"”]$/.test(m) ? m : m + "."; }
  /** Turn a trip into a short story. ctx = { travelers: [{id,name,role}], units, allowAdult, firsts: [{who, what, kind: "country"|"park"}],
      badges: [{who, name}], countryName(id), parkName(id), familyName }. opts = { style, seed }. Same trip + seed = same story. */
  function makeStory(t, ctx, opts) {
    ctx = ctx || {}; opts = opts || {};
    var style = opts.style === "journal" ? "journal" : "storybook", L = LEX[style];
    var R = rng(hash(String(t.id || "trip") + ":" + style + ":" + (opts.seed || 0)));
    function pick(a) { return a[Math.floor(R() * a.length)]; }
    var units = ctx.units === "km" ? "km" : "mi";
    var travelers = (ctx.travelers || []).filter(Boolean), names = travelers.map(nameOf);
    var who = ctx.familyName && travelers.length > 2 ? "the " + ctx.familyName + " family" : (joinNames(names) || (style === "journal" ? "the family" : "our travelers"));
    var s = summary(t), r = t.route || [], dest = clean(t.title, 80) || t.place || (r.length ? r[r.length - 1].name : "somewhere new");
    var when = monthYear(t.date), out = [];
    out.push(cap(fill(pick(L.open), { who: who, dest: dest, when: when ? when + " " : "", When: when ? "In " + when + ", " : "One day, ", month: when || "that year" })));
    // legs
    s.legs.forEach(function (Lg, i) {
      var isLast = i === s.legs.length - 1 && s.legs.length > 2;
      var mi = Lg.miles == null ? "a long way" : fmtDist(Lg.miles, units, { long: true });
      var a = Lg.dep && style === "journal" ? Lg.from + " (" + Lg.dep.code + ")" : Lg.from, b = Lg.arr && style === "journal" ? Lg.to + " (" + Lg.arr.code + ")" : Lg.to;
      if (Lg.home) { out.push(fill(pick(L.home), { b: Lg.to, mi: mi })); return; }
      var tr = i === 0 ? pick(L.tr.slice(0, 1).concat(["", ""])) : isLast ? pick(L.last) : pick(L.tr.slice(1));
      var line = fill(pick(L[Lg.mode] || L.car), { tr: tr, a: a, b: b, mi: mi }).replace(/^\s+/, "");
      if (Lg.miles == null) line = line.replace(/about a long way/, "a long way");
      out.push(cap(line));
      var p = r[Lg.i];
      if (p && typeof p.nights === "number" && p.nights > 0 && R() < 0.8) out.push(fill(pick(L.nights), { n: plural(p.nights, "night"), b: p.name }));
    });
    if (!s.legs.length && r.length) out.push(style === "journal" ? "We made it to " + r[r.length - 1].name + "." : "They made it all the way to " + r[r.length - 1].name + "!");
    // weather (ctx.wx = [{ kind, place }] from WK_WX.storyNotes: hand-picked or real past days only)
    (ctx.wx || []).slice(0, 2).forEach(function (w) { var a = WX_LINES[style][w && w.kind]; if (a && w.place) out.push(fill(pick(a), { p: w.place })); });
    // stays
    (t.stays || []).forEach(function (st) {
      var where = st.where ? " in " + st.where : "", tpl = pick(L.stay[st.type] || L.stay.other);
      var line = fill(tpl, { name: st.name, where: where });
      if (st.nights) line = line.replace(/\.$/, ", for " + plural(st.nights, "night") + ".");
      if (st.rating >= 5) line += pick(L.loved);
      out.push(line);
    });
    // favorites (grown-up ones only in the journal, and only when allowed)
    (t.favs || []).forEach(function (f) {
      var cat = FAV[f.cat]; if (!cat) return;
      if (cat.adult && (style !== "journal" || !ctx.allowAdult)) return;
      var tpls = L.fav[f.cat]; if (!tpls) return;
      out.push(cap(fill(pick(tpls), { name: f.name, where: f.where ? " in " + f.where : "" })));
    });
    // firsts and badges
    (ctx.firsts || []).slice(0, 4).forEach(function (f) { out.push(fill(pick(f.kind === "park" ? L.firstPark : L.firstCountry), { p: f.who, c: f.what })); });
    // badges: one sentence per set of people who earned the same ones ("Rosie and Sam earned three new badges: A, B and C!")
    var byWho = {}, whoOrder = [];
    (ctx.badges || []).forEach(function (b) { if (!byWho[b.who]) { byWho[b.who] = []; whoOrder.push(b.who); } if (byWho[b.who].indexOf(b.name) < 0) byWho[b.who].push(b.name); });
    var sets = {}, setOrder = [];
    whoOrder.forEach(function (w) { var k = byWho[w].join("|"); if (!sets[k]) { sets[k] = { who: [], names: byWho[w] }; setOrder.push(k); } sets[k].who.push(w); });
    setOrder.slice(0, 3).forEach(function (k) {
      var g = sets[k], p = joinNames(g.who), list = g.names.slice(0, 6);
      out.push(list.length === 1 ? fill(pick(L.badge), { p: p, c: list[0] }) : fill(pick(L.badges), { p: p, n: numWord(list.length), c: joinNames(list) }));
    });
    // moments
    var moments = t.moments || {};
    travelers.forEach(function (p) { if (moments[p.id]) out.push(fill(pick(L.moment), { p: nameOf(p), m: sentenceEnd(moments[p.id]) })); });
    if (t.memory) out.push(fill(pick(L.memory), { m: sentenceEnd(t.memory) }));
    // trip memories (Best part, Favorite food, ...): one line each that's filled in
    var mems = t.memories || {};
    MEM_PROMPTS.forEach(function (mp) { var v = clean(mems[mp[0]], 400); if (v && L.mem[mp[0]]) out.push(fill(pick(L.mem[mp[0]]), { m: cap(sentenceEnd(v)) })); });
    // totals
    var nights = s.nights ? " over " + plural(s.nights, "night") : "";
    if (s.miles > 0) out.push(fill(pick(L.total), { mi: fmtDist(s.miles, units, { long: true }), nights: nights }));
    if (s.flights && s.airMin) { var al = L.air, ah = airWords(s.airMin); out.push(fill(al[hash(String(t.id || "trip") + ":air") % al.length], { h: ah, f: numWord(s.flights), fl: s.flights === 1 ? "flight" : "flights" })); }
    var seen = [];
    if (s.cities.length > 1) seen.push(numWord(s.cities.length) + " towns and cities");
    if (s.parks.length) seen.push(plural(s.parks.length, "national park"));
    if (s.states.length > 1) seen.push(numWord(s.states.length) + " states");
    if (s.countries.length > 1) seen.push(numWord(s.countries.length) + " countries");
    if (seen.length) out.push((style === "journal" ? "We saw " : "They saw ") + joinNames(seen) + ".");
    out.push(fill(pick(L.close), { who: who }));
    var sentences = out.map(function (x) { return x.replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim(); }).filter(Boolean);
    return { text: sentences.join(" "), sentences: sentences, style: style, seed: opts.seed || 0 };
  }
  /** Split saved (maybe hand-edited) story text into sentences for read-aloud and highlighting. */
  function splitSentences(text) {
    return String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?]["”']?)\s+(?=[A-Z0-9"“'(])/).filter(Boolean);
  }
  function wordCount(text) { return String(text || "").split(/\s+/).filter(Boolean).length; }

  return { EARTH_MI: EARTH_MI, KM_PER_MI: KM_PER_MI, AROUND_WORLD: AROUND_WORLD, MAX_POINTS: MAX_POINTS, MAX_STAYS: MAX_STAYS, MAX_FAVS: MAX_FAVS,
           MODES: MODES, MODE: MODE, STAY_TYPES: STAY_TYPES, FAV_CATS: FAV_CATS, FAV: FAV, US_STATES: US_STATES,
           gcMiles: gcMiles, legMiles: legMiles, airportCity: airportCity, mustFly: mustFly, sameStop: sameStop, stops: stops, relink: relink, moveStop: moveStop, insertStop: insertStop, mainDest: mainDest, fitSize: fitSize, TRIP_BUDGET: TRIP_BUDGET, hasLoc: hasLoc, fmtDist: fmtDist, cleanPoint: cleanPoint, cleanRoute: cleanRoute, cleanAirport: cleanAirport, cleanBack: cleanBack,
           airMinutes: airMinutes, fmtAir: fmtAir, crossesBorder: crossesBorder, CRUISE_MPH: CRUISE_MPH, GROUND_MIN_MI: GROUND_MIN_MI,
           cleanStays: cleanStays, cleanFavs: cleanFavs, cleanMoments: cleanMoments, cleanStory: cleanStory, cleanMemories: cleanMemories, MEM_PROMPTS: MEM_PROMPTS, cleanExtras: cleanExtras,
           routeFromLegacy: routeFromLegacy, syncLegacy: syncLegacy, nightsBetween: nightsBetween, summary: summary, areas: areas, isAdult: isAdult,
           showAdult: showAdult, visibleFavs: visibleFavs, tripMiles: tripMiles, lifetime: lifetime, project: project, routeMap: routeMap, PROJ: PROJ,
           hash: hash, rng: rng, makeStory: makeStory, splitSentences: splitSentences, wordCount: wordCount, longDate: longDate };
});
