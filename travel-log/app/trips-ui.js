/* Famstamp 1.4: Trips (builder, trip page, story read-aloud) and the Passport. Plain JavaScript, no network calls: the
   place and airport lists are this app's own files (data/places.json, data/airports.json), fetched the first time a
   trip is built and kept by the service worker. The app shell (app.js) hands over its helpers as window.MLTL_APP. */
(function () {
  "use strict";
  var T = window.WK_TRIPS, P = window.WK_PASSPORT, M = window.MLTL, MAPS = window.MLTL_MAPS, esc = M.esc;
  function A() { return window.MLTL_APP; }
  function S() { return A().state; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function units() { return S().meta.units === "km" ? "km" : "mi"; }
  function dist(mi, long) { return T.fmtDist(mi, units(), long ? { long: true } : null); }
  function tripById(id) { return S().trips.filter(function (t) { return t.id === id; })[0]; }
  function people(ids) { return (ids || []).map(A().kidById).filter(Boolean); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function reduced() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }
  var PARK_BY = {}; M.ALL_PARKS.forEach(function (p) { PARK_BY[p.id] = p; });
  function parkName(id) { return PARK_BY[id] ? PARK_BY[id].name : id; }
  function areaName(kind, id) { return A().placeName(kind, id); }
  function shortArea(kind, id) { return kind === "park" ? parkName(id) : areaName(kind, id); }
  function num(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function stars(n) { n = n || 0; return n ? '<span class="stars-ro" aria-label="' + n + ' out of 5">' + "★★★★★".slice(0, n) + '<i>' + "★★★★★".slice(n) + '</i></span>' : ""; }
  function dateRange(t) {
    var a = M.prettyDate(t.date), b = M.prettyDate(t.endDate);
    if (a && b && t.date.slice(0, 4) === t.endDate.slice(0, 4)) a = a.replace(/, \d{4}$/, "");
    return a && b ? a + " – " + b : a || b;
  }

  // ---------- place + airport lists (lazy) ----------
  var DATA = { places: null, airports: null }, pending = {};
  function getJSON(name) {
    if (pending[name]) return pending[name];
    pending[name] = fetch("data/" + name + ".json").then(function (r) { if (!r.ok) throw new Error("offline"); return r.json(); })
      .catch(function (e) { pending[name] = null; throw e; });
    return pending[name];
  }
  // v94: the big places list is read in small slices with breaks between, so typing the first letters of a stop no longer
  // freezes the phone for most of a second; it also starts loading in the background as soon as a trip form opens.
  var placesP = null;
  function loadPlaces() {
    if (DATA.places) return Promise.resolve(DATA.places);
    if (placesP) return placesP;
    placesP = getJSON("places").then(function (j) {
      var lines = j.rows.split("\n"), rows = new Array(lines.length), i = 0;
      return new Promise(function (done) {
        (function slice() {
          var t0 = Date.now();
          for (; i < lines.length && (i % 200 || Date.now() - t0 < 12); i++) { var c = lines[i].split("\t"); rows[i] = { name: c[0], low: normQ(c[1] || c[0]), nlow: normQ(c[0]), lat: +c[2], lon: +c[3], country: c[4], admin1: c[5], pop: +c[6] || 0 }; }
          if (i < lines.length) return setTimeout(slice, 0);
          DATA.places = { rows: rows, countries: j.countries, admin: j.admin, parks: j.parks }; done(DATA.places);
        })();
      });
    }).catch(function (e) { placesP = null; throw e; });
    return placesP;
  }
  function warmPlaces() { var go = function () { loadPlaces().catch(function () {}); if (TW) layerIndex(TOWNS).catch(function () {}), layerIndex(SIGHTS).catch(function () {}); }; if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 400); }
  // v78: every town worldwide, one small file per name prefix (towns-core.js). Searches use what's loaded and
  // redraw when the file for what they typed arrives. A missing file (offline, or no such prefix) just means no extra towns.
  var TW = window.FS_TOWNS, TOWNS = { index: null, files: {}, loading: {}, admin: {}, countries: {} };
  // v79: sights (castles, viewpoints, beaches, distilleries...) load the same way from data/sights/ (scripts/build_sights.py)
  var SIGHTS = { dir: "data/sights/", index: null, files: {}, loading: {}, admin: {}, countries: {} }; TOWNS.dir = "data/towns/";
  var FAMOUS = 40;   // Wikipedia in 40+ languages = a famous landmark (Edinburgh Castle, Eiffel Tower, Stonehenge)
  function layerIndex(L) {
    if (L.index) return Promise.resolve(L.index);
    if (!L.loading.index) L.loading.index = fetch(L.dir + "index.json").then(function (r) { if (!r.ok) throw new Error("offline"); return r.json(); })
      .then(function (j) { L.index = j; return j; }).catch(function (e) { L.loading.index = null; throw e; });
    return L.loading.index;
  }
  function layerKey(L, q) { return L.index ? TW.keyFor(String(q || "").split(",")[0], L.index) : ""; }
  function ensureLayer(L, q) {
    return layerIndex(L).then(function () {
      var k = layerKey(L, q); if (!k || L.files[k]) return false;
      if (!L.loading[k]) L.loading[k] = fetch(L.dir + k + ".json").then(function (r) { return r.ok ? r.json() : { rows: "" }; })
        .then(function (j) { return TW.parseAsync ? TW.parseAsync(j) : TW.parse(j); }).then(function (f) { Object.keys(f.admin).forEach(function (a) { L.admin[a] = f.admin[a]; TOWNS.admin[a] = TOWNS.admin[a] || f.admin[a]; }); Object.keys(f.countries).forEach(function (c) { L.countries[c] = f.countries[c]; TOWNS.countries[c] = TOWNS.countries[c] || f.countries[c]; }); L.files[k] = f; return true; }).catch(function () { L.loading[k] = null; return false; });
      return L.loading[k];
    }).catch(function () { return false; });
  }
  function layerReady(L, q) { if (!L.index) return false; var k = layerKey(L, q); return !k || !!L.files[k]; }
  function townKey(q) { return layerKey(TOWNS, q); }
  /** Resolves true when a towns or sights file for this query just arrived (so the list should redraw). */
  function ensureTowns(q) {
    if (!TW) return Promise.resolve(false);
    return Promise.all([ensureLayer(TOWNS, q), ensureLayer(SIGHTS, q)]).then(function (r) { return r[0] || r[1]; });
  }
  function townsReady(q) { return !TW || (layerReady(TOWNS, q) && layerReady(SIGHTS, q)); }
  function loadAirports() {
    if (DATA.airports) return Promise.resolve(DATA.airports);
    return getJSON("airports").then(function (j) {
      DATA.airports = j.rows.split("\n").map(function (l) {
        var c = l.split("\t"); return { code: c[0], name: c[1], city: T.airportCity(c[2], c[1], c[0]), town: c[2], country: c[3], region: c[4], lat: +c[5], lon: +c[6], size: c[7], low: (c[0] + " " + c[2] + " " + c[1]).toLowerCase() };
      });
      return DATA.airports;
    });
  }
  function regionOf(country, admin1) { return country === "USA" || country === "GBR" ? admin1 : (/^[A-Z0-9]{1,3}$/.test(admin1 || "") ? admin1 : ""); }
  function subOf(d, country, admin1) {
    var c = d.countries[country] || TOWNS.countries[country] || country, ad = d.admin[country + "." + admin1] || TOWNS.admin[country + "." + admin1];
    if (country === "USA") return ad || c;
    if (country === "GBR") return (ad ? ad + ", " : "") + "UK";
    return ad && ad !== c ? ad + ", " + c : c;
  }
  /** A sight as a trip stop: its type, its town (it counts for that town's country / state) and how famous it is. */
  function typeEmoji(t) { var SA = window.WK_STAMPART; return SA && SA.typeOf ? SA.typeOf(t).emoji : "📍"; }
  function sightPoint(d, r, typed) {
    var SA = window.WK_STAMPART, ty = SA && SA.typeOf ? SA.typeOf(r.type) : { id: r.type || "landmark", label: "Sight", emoji: "📍" };
    var name = typed && typed !== r.names[0] && TW.fold(typed).indexOf(TW.fold(r.names[0])) < 0 ? typed : r.names[0];
    var where = subOf(d, r.country, r.admin1), famous = (r.rank || 0) >= FAMOUS;
    var o = { name: name, kind: "sight", type: ty.id, lat: r.lat, lon: r.lon, country: r.country, region: regionOf(r.country, r.admin1),
      sub: ty.label + " · " + (r.town ? r.town + ", " : "") + where, label: ty.emoji + " " + name };
    if (r.town) o.town = r.town; if (r.wd) o.ref = r.wd; if (r.rank) o.fame = Math.min(999, r.rank); if (famous) o.badge = "⭐ Famous landmark";
    if (r.unesco) { o.unesco = true; o.sub += " · UNESCO World Heritage"; }
    return o;
  }
  function cityPoint(d, r) { return { name: r.name, kind: "city", lat: r.lat, lon: r.lon, country: r.country, region: regionOf(r.country, r.admin1), sub: subOf(d, r.country, r.admin1) }; }
  function parkPoint(d, p) {
    var ll = (d && d.parks[p.id]) || (p.lat != null ? [p.lat, p.lon] : null), st = p.states.split(/,\s*/);
    var o = { name: p.full, kind: "park", ref: p.id, country: "USA", sub: p.states };
    if (st.length === 1 && T.US_STATES.indexOf(st[0]) >= 0) o.region = st[0];
    if (ll) { o.lat = ll[0]; o.lon = ll[1]; }
    return o;
  }
  // "St Andrews" / "St. Andrews" / "Saint Andrews", "Mt" / "Mount", "Ft" / "Fort" all find the same town
  function normQ(s) {
    s = String(s || "");
    if (TW) return s.split(",").map(function (x) { return TW.fold(x); }).join(", ");   // v78: accents optional (Koln = Köln), punctuation-proof
    return s.toLowerCase().replace(/\b(st|saint|ste)\.?(\s|-)/g, "saint ").replace(/\bmt\.?(\s|-)/g, "mount ").replace(/\bft\.?(\s|-)/g, "fort ").replace(/\s+/g, " ");
  }
  // famous islands, lochs and glens that aren't towns: a point people know, at the main village
  var ALIASES = [
    { k: ["isle of skye", "skye"], name: "Isle of Skye", lat: 57.413, lon: -6.194, country: "GBR", admin1: "SCT" },
    { k: ["loch ness"], name: "Loch Ness", lat: 57.334, lon: -4.48, country: "GBR", admin1: "SCT" },
    { k: ["glencoe", "glen coe"], name: "Glencoe", lat: 56.682, lon: -5.102, country: "GBR", admin1: "SCT" },
    { k: ["loch lomond"], name: "Loch Lomond", lat: 56.083, lon: -4.633, country: "GBR", admin1: "SCT" },
    { k: ["isle of mull", "mull"], name: "Isle of Mull", lat: 56.622, lon: -6.067, country: "GBR", admin1: "SCT" },
    { k: ["lake district"], name: "Lake District", lat: 54.43, lon: -2.96, country: "GBR", admin1: "ENG" },
    { k: ["cotswolds"], name: "Cotswolds", lat: 51.83, lon: -1.83, country: "GBR", admin1: "ENG" }];
  /** Cities, towns and national parks matching what they typed ("Edinburgh", "inver", "portland, me", "zion").
      near = the country of the stop before, whose matches come first ("Glencoe" after Edinburgh is the Scottish one). */
  function searchPlaces(q, d, near) {
    q = normQ(q.trim()); if (q.length < 2) return [];
    var parts = q.split(","), head = parts[0].trim(), tail = (parts[1] || "").trim(), out = [];
    // v99: a whole UK nation, US state or country comes first when its name is typed ("Scotland", "Wales", "Florida", "Japan")
    var whole = !tail && head.length >= 3 ? wholePlaces(d, head) : [];
    M.ALL_PARKS.forEach(function (p) { var n = p.full.toLowerCase(); if (n.indexOf(head) === 0 || (head.length > 3 && n.indexOf(head) > 0)) out.push(parkPoint(d, p)); });
    out = out.slice(0, 3);
    var al = ALIASES.filter(function (a) { return a.k.some(function (k) { return k.indexOf(head) === 0 && (head.length >= 3 || k === head); }); });
    al.forEach(function (a) { out.push(cityPoint(d, a)); });
    var nParks = out.length, cities = [];
    for (var i = 0; i < d.rows.length && cities.length < 40; i++) {
      var r = d.rows[i];
      if (r.low.indexOf(head) !== 0 && r.nlow.indexOf(head) !== 0) continue;
      var pt = cityPoint(d, r);
      if (tail && (normQ(pt.sub).indexOf(tail) < 0 && (r.admin1 || "").toLowerCase() !== tail && r.country.toLowerCase() !== tail)) continue;
      if (al.some(function (a) { return a.name === pt.name && a.country === pt.country; })) continue;
      pt._pop = r.pop * 1000; cities.push(pt);
    }
    // v78: towns from the worldwide files (Ghent finds Gent; small towns everywhere). Same place as a list town = skipped.
    var k = TW ? townKey(head) : "", file = k && TOWNS.files[k];
    if (file) {
            TW.match(head, file, { limit: 40 }).forEach(function (h) {
        var r = h.row, pt = cityPoint(d, { name: h.name, lat: r.lat, lon: r.lon, country: r.country, admin1: r.admin1 });
        if (tail && (normQ(pt.sub).indexOf(tail) < 0 && (r.admin1 || "").toLowerCase() !== tail && r.country.toLowerCase() !== tail)) return;
        if (cities.some(function (c) { return c.country === pt.country && Math.abs(c.lat - pt.lat) < 0.04 && Math.abs(c.lon - pt.lon) < 0.06; })) return;
        if (h.name !== r.names[0]) pt.sub = r.names[0] + " · " + pt.sub;   // typed the English name: show the local one too
        pt._pop = r.pop; pt._exact = h.exact; cities.push(pt);
      });
      cities.forEach(function (c, i) { c._i = i; if (c._exact == null) c._exact = TW.fold(c.name) === TW.fold(head); });
      cities.sort(function (a, b) { return (b._exact - a._exact) || (b._pop - a._pop) || (a._i - b._i); });
    }
    // v79: sights. Exact names first, then famous landmarks, then the rest by size / fame; at most 5 sights so towns still show.
    var sk = TW ? layerKey(SIGHTS, head) : "", sfile = sk && SIGHTS.files[sk];
    if (sfile) {
      var ns = 0;
      cities.forEach(function (c, i) { if (c._exact == null) c._exact = TW.fold(c.name) === TW.fold(head); c._score = Math.log(Math.max(1, c._pop || 1)) / Math.LN10 + 1; c._i = i; });
      TW.match(head, sfile, { limit: 30, words: true }).forEach(function (h) {
        var r = h.row, pt = sightPoint(d, r, h.name);
        if (tail && (normQ(pt.sub).indexOf(tail) < 0 && (r.admin1 || "").toLowerCase() !== tail && r.country.toLowerCase() !== tail)) return;
        pt._exact = h.exact; pt._famous = (r.rank || 0) >= FAMOUS; pt._score = 2 + Math.min(r.rank || 0, 120) / 12; pt._i = 100 + ns++; cities.push(pt);
      });
      cities.sort(function (a, b) { return (b._exact - a._exact) || ((b._famous ? 1 : 0) - (a._famous ? 1 : 0)) || (b._score - a._score) || (a._i - b._i); });
      var nsight = 0; cities = cities.filter(function (c) { return c.kind !== "sight" || ++nsight <= 5; });
    }
    cities.forEach(function (c) { delete c._pop; delete c._exact; delete c._i; delete c._score; delete c._famous; });
    if (near) cities = cities.filter(function (p) { return p.country === near; }).concat(cities.filter(function (p) { return p.country !== near; }));
    return whole.concat(out.concat(cities).slice(0, Math.max(9, nParks + 6)));
  }
  /** v99: UK nations, US states and countries whose name starts with what was typed, as whole-place stops (exact names first, at most 3). */
  function wholePlaces(d, head) {
    var hits = [];
    function add(name, country, region, sub) {
      var n = normQ(name); if (n.indexOf(head) !== 0) return;
      hits.push({ name: name, kind: "place", country: country, region: region || undefined, sub: sub, label: (region ? "🗺️ " : "🌍 ") + name, _exact: n === head ? 1 : 0, _o: hits.length });
    }
    ["ENG", "SCT", "WLS", "NIR"].forEach(function (c) { var n = d.admin["GBR." + c]; if (n) add(n, "GBR", c, "UK nation"); });
    Object.keys(d.admin).forEach(function (k) { var m = /^USA\.([A-Z]{2})$/.exec(k); if (m) add(d.admin[k], "USA", m[1], "US state"); });
    Object.keys(d.countries).forEach(function (c) { add(d.countries[c], c, "", "Country"); });
    hits.sort(function (a, b) { return (b._exact - a._exact) || (a._o - b._o); });
    return hits.slice(0, 3).map(function (h) {
      var o = { name: h.name, kind: "place", country: h.country, sub: h.sub, label: h.label };
      if (h.region) o.region = h.region;
      var b = null; for (var i = 0; i < d.rows.length; i++) { var r = d.rows[i]; if (r.country === h.country && (!h.region || r.admin1 === h.region) && (!b || r.pop > b.pop)) b = r; }
      if (b) { o.lat = b.lat; o.lon = b.lon; }
      return o;
    });
  }
  // v1.8 wishlist search: countries, US states and UK nations first, then towns and parks, then airports (by code or city)
  function areaPoints(d, q) {
    var out = [];
    function centre(c, a1) { var b = null; for (var i = 0; i < d.rows.length; i++) { var r = d.rows[i]; if (r.country === c && (!a1 || r.admin1 === a1) && (!b || r.pop > b.pop)) b = r; } return b; }
    function push(name, area, c, a1, sub) {
      var b = centre(c, a1), o = { name: name, kind: "area", area: area, country: c, sub: sub };
      if (a1) o.region = a1; if (b) { o.lat = b.lat; o.lon = b.lon; } out.push(o);
    }
    Object.keys(d.countries).forEach(function (c) { var n = d.countries[c]; if (normQ(n).indexOf(q) === 0 && out.length < 3) push(n, "place:" + c, c, "", "Country"); });
    Object.keys(d.admin).forEach(function (k) {
      var m = /^(USA|GBR)\.([A-Z]{2,3})$/.exec(k); if (!m || out.length >= 4 || normQ(d.admin[k]).indexOf(q) !== 0) return;
      if (m[1] === "GBR" && ["ENG", "SCT", "WLS", "NIR"].indexOf(m[2]) < 0) return;
      push(d.admin[k], m[1] === "USA" ? "state:" + m[2] : "place:" + m[2], m[1], m[2], m[1] === "USA" ? "US state" : "United Kingdom");
    });
    return out;
  }
  function findPlaces(q) {
    return Promise.all([loadPlaces(), loadAirports().catch(function () { return null; }), ensureTowns(q)]).then(function (r) {
      var d = r[0], aps = r[1], nq = normQ((q || "").trim()); if (nq.length < 2) return [];
      var out = areaPoints(d, nq.split(",")[0].trim()).concat(searchPlaces(q, d).filter(function (p) { return p.kind !== "place"; }));   // v99: whole places come from areaPoints here
      if (aps) searchAirports(q, aps).slice(0, 3).forEach(function (a) {
        var p = { name: a.city || a.town || a.name, kind: "city", lat: a.lat, lon: a.lon, country: a.country, region: a.country === "USA" || a.country === "GBR" ? a.region : "", sub: a.code + " · " + a.name };
        if (!out.some(function (o) { return o.lat != null && T.gcMiles(o, p) < 15; })) out.push(p);
      });
      return out.slice(0, 12);
    });
  }
  function searchAirports(q, list) {
    q = q.trim().toLowerCase(); if (q.length < 2) return [];
    var exact = list.filter(function (a) { return a.code.toLowerCase() === q; });
    var rest = list.filter(function (a) { return a.code.toLowerCase() !== q && (a.city.toLowerCase().indexOf(q) === 0 || a.name.toLowerCase().indexOf(q) >= 0 || a.low.indexOf(q) >= 0); })
      .sort(function (a, b) { return (a.size === "L" ? 0 : 1) - (b.size === "L" ? 0 : 1); });
    return exact.concat(rest).slice(0, 7);
  }
  function airportObj(a) { return { code: a.code, name: a.name, city: a.city, country: a.country, lat: a.lat, lon: a.lon }; }
  function nearestAirport(p, list) {
    if (!T.hasLoc(p) || !list) return null;
    var best = null, bd = 1e9;
    list.forEach(function (a) { var d = T.gcMiles(p, a) * (a.size === "L" ? 0.6 : 1); if (d < bd) { bd = d; best = a; } });
    return best && bd < 250 ? airportObj(best) : null;
  }
  /** The n closest airports to a place, big ones first when they're about as close (for "Which airports?"). */
  function nearAirports(p, list, n) {
    if (!T.hasLoc(p) || !list) return [];
    return list.map(function (a) { var g = T.gcMiles(p, a); return { a: a, g: g, w: g * (a.size === "L" ? 0.6 : 1) }; })
      .filter(function (x) { return x.g < 300; }).sort(function (x, y) { return x.w - y.w; }).slice(0, n || 3)
      .map(function (x) { var o = airportObj(x.a); o.away = Math.round(x.g); return o; });
  }
  function placeLine(p) { return p.sub ? p.name + ", " + p.sub : p.name; }

  // ---------- the route drawn on the map ----------
  function routeSVG(t, opts) {
    opts = opts || {};
    var map = T.routeMap(t); if (!map) return "";
    var r = t.route || [], pts = r.map(function (p) { return T.project(p, map); });
    var xy = pts.filter(Boolean), base = map === "us" ? MAPS.us : MAPS.world;
    // v1.7: zoom to the stops when home is far away (Orlando -> a Scotland loop): the loop fills the map and the long
    // flights run off the edge, with a small "✈️ to Orlando" marker pointing home
    var far = null, away = pts.slice(1).filter(Boolean);
    if (pts[0] && away.length > 1) {
      var ax = away.map(function (p) { return p[0]; }), ay = away.map(function (p) { return p[1]; });
      var sw = Math.max(Math.max.apply(null, ax) - Math.min.apply(null, ax), map === "us" ? 120 : 40), sh = Math.max(Math.max.apply(null, ay) - Math.min.apply(null, ay), map === "us" ? 70 : 24);
      var acx = (Math.max.apply(null, ax) + Math.min.apply(null, ax)) / 2, acy = (Math.max.apply(null, ay) + Math.min.apply(null, ay)) / 2;
      if (Math.abs(pts[0][0] - acx) > sw * 1.6 || Math.abs(pts[0][1] - acy) > sh * 1.6) { far = pts[0]; xy = away; }
    }
    var minx = Math.min.apply(null, xy.map(function (p) { return p[0]; })), maxx = Math.max.apply(null, xy.map(function (p) { return p[0]; }));
    var miny = Math.min.apply(null, xy.map(function (p) { return p[1]; })), maxy = Math.max.apply(null, xy.map(function (p) { return p[1]; }));
    var w = Math.max(maxx - minx, map === "us" ? (far ? 60 : 120) : (far ? 14 : 40)), h = Math.max(maxy - miny, map === "us" ? (far ? 35 : 70) : (far ? 9 : 24));
    w *= 1.35; h *= 1.35; if (w / h < 1.5) w = h * 1.5; else h = w / 1.5;
    var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, vb = [cx - w / 2, cy - h / 2, w, h];
    vb[0] = Math.max(0, Math.min(vb[0], base.w - w)); vb[1] = Math.max(0, Math.min(vb[1], base.h - h));
    if (w > base.w) { vb = [0, 0, base.w, base.h]; }
    var u = vb[2] / 300, sum = T.summary(t), hl = {};
    T.areas(t, M.PARK_STATES).forEach(function (a) { hl[a.id] = 1; });
    var s = '<svg viewBox="' + vb.map(function (v) { return v.toFixed(1); }).join(" ") + '" role="img" aria-label="Map of the route: ' + esc(M.routeText(t)) + '">';
    if (map === "world") s += '<path class="ocean" d="' + base.outline + '"/>';
    base.shapes.forEach(function (p) { s += '<path class="a' + (hl[p.id] ? " on" : "") + (p.uk ? " uk" : "") + '" d="' + p.d + '"/>'; });
    var legs = sum.legs, line = "";
    legs.forEach(function (L) {
      var a = pts[L.i - 1], b = L.home ? pts[0] : pts[L.i];
      if (L.mode === "plane" && L.dep && L.dep.lat != null) a = T.project(L.dep, map) || a;
      if (L.mode === "plane" && L.arr && L.arr.lat != null) b = T.project(L.arr, map) || b;
      if (!a || !b) return;
      if (L.mode === "plane") {
        var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, k = len * 0.22;
        line += '<path class="leg plane" d="M' + a[0] + ',' + a[1] + ' Q' + (mx + dy / len * k).toFixed(1) + ',' + (my - dx / len * k).toFixed(1) + ' ' + b[0] + ',' + b[1] + '" stroke-width="' + (u * 2.2).toFixed(2) + '" stroke-dasharray="' + (u * 5).toFixed(2) + ' ' + (u * 3.5).toFixed(2) + '"/>';
      } else line += '<path class="leg ' + esc(L.mode) + '" d="M' + a[0] + ',' + a[1] + ' L' + b[0] + ',' + b[1] + '" stroke-width="' + (u * 2.6).toFixed(2) + '"/>';
    });
    s += line;
    if (far) {   // where home is, off the edge of the map
      var hx = far[0], hy = far[1], ccx = vb[0] + vb[2] / 2, ccy = vb[1] + vb[3] / 2, m = u * 14, dx2 = hx - ccx, dy2 = hy - ccy;
      var tt = Math.min(dx2 ? (vb[2] / 2 - m) / Math.abs(dx2) : 1e9, dy2 ? (vb[3] / 2 - m) / Math.abs(dy2) : 1e9, 1);
      var ex = ccx + dx2 * tt, ey = ccy + dy2 * tt, left = ex < ccx, fs = u * 8.5, lbl = "✈️ " + (r[0].name || "home");
      var tw = lbl.length * fs * 0.55 + u * 10, tx = left ? Math.max(vb[0] + u * 3, ex - u * 5) : Math.min(vb[0] + vb[2] - u * 3 - tw, ex - tw + u * 5), ty = Math.max(vb[1] + u * 3, Math.min(vb[1] + vb[3] - u * 17, ey - u * 8));
      s += '<g class="homeflag"><rect x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" width="' + tw.toFixed(1) + '" height="' + (u * 15).toFixed(1) + '" rx="' + (u * 7).toFixed(1) + '"/>' +
        '<text x="' + (tx + u * 5).toFixed(1) + '" y="' + (ty + u * 10.5).toFixed(1) + '" font-size="' + fs.toFixed(2) + '">' + esc(lbl) + '</text><title>Home: ' + esc(r[0].name || "") + '</title></g>';
    }
    pts.forEach(function (p, i) {
      if (!p || (far && i === 0)) return;
      s += '<g class="stopdot"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (u * (i ? 6 : 5)).toFixed(2) + '" stroke-width="' + (u * 1.6).toFixed(2) + '"' + (i ? "" : ' class="home"') + '/>' +
        (i ? '<text x="' + p[0] + '" y="' + (p[1] + u * 2.6).toFixed(2) + '" font-size="' + (u * 7.5).toFixed(2) + '">' + i + '</text>' : "") + '<title>' + esc(r[i].name) + '</title></g>';
    });
    return s + '</svg>';
  }

  // ---------- trip card on the Trips tab ----------
  function tripCard(t, k) {
    var A_ = A(), age = k && M.isKid(k) ? M.ageOn(k.birthYear, t.date) : null, owner = k || A_.kidById(t.kidIds[0]), s = T.summary(t);
    var route = M.routeText(t), link = owner ? "#/p/" + esc(owner.id) + "/trip/" + esc(t.id) : "";
    var bits = [dateRange(t) || "", s.nights ? s.nights + (s.nights === 1 ? " night" : " nights") : "", age != null ? "age " + age : ""].filter(Boolean);
    var miles = s.legs.length && s.miles ? '<span class="tmiles">' + (s.milesKnown ? "" : "at least ") + esc(dist(s.miles)) + '</span>' + (s.flights ? ' · <span class="tfly">✈️ ' + s.flights + (s.flights === 1 ? " flight" : " flights") + '</span>' : "") : "";
    var draft = M.isDraft(t);
    return '<article class="trip' + (draft ? " isdraft" : "") + '">' + (t.photoId ? '<img alt="" data-photo="' + esc(t.photoId) + '">' : "") + '<div class="body">' +
      (draft ? '<span class="drafttag">Needs review</span>' : "") + '<h3>' + (link ? '<a class="tlink" href="' + link + '">' + esc(t.place) + '</a>' : esc(t.place)) + '</h3>' +
      (route !== t.place ? '<div class="route">' + esc(route) + '</div>' : "") +
      '<div class="when">' + esc(bits.join(" · ")) + (miles ? (bits.length ? " · " : "") + miles : "") + (t.mark && !s.legs.length ? " · 🖍 " + esc(areaName(t.mark.kind, t.mark.id)) : "") + '</div>' +
      (t.memory ? '<p class="mem">' + esc(t.memory) + '</p>' : "") +
      '<div class="travelers"><span class="dots">' + A_.avatars(t.kidIds) + '</span><span>' + esc(A_.travelerNames(t.kidIds)) + '</span></div>' +
      (t.who ? '<div class="who">Also along: ' + esc(t.who) + '</div>' : "") +
      (draft ? '<div class="tactions noprint"><button type="button" class="btn btn-primary btn-small" data-review="' + esc(t.id) + '">✓ Looks good</button></div>' : "") +
      (owner ? '<div class="tactions noprint"><a href="' + link + '">Open trip' + (t.story ? " & story" : "") + ' →</a><a class="edit" href="#/p/' + esc(owner.id) + '/trips/edit/' + esc(t.id) + '">Edit</a></div>' : "") + syncExtra(t) + '</div></article>';
  }

  // Family Sync's per-trip extras ("Also add to my other family", "Copied from ..."); empty when sync is off.
  function syncExtra(t) { try { return window.MLTL_SYNC && window.MLTL_SYNC.tripExtra ? window.MLTL_SYNC.tripExtra(t) || "" : ""; } catch (e) { return ""; } }

  // ---------- trip builder ----------
  var MODE_LABEL = { car: "Car", rv: "RV", plane: "Plane", train: "Train", boat: "Boat", walk: "Walk" };
  function modeIc(m) { return (T.MODE[m] || T.MODE.car).ic; }
  function adultOn(ids) { return people(ids).some(T.isAdult); }
  function builder(k, tripId, opts) {
    opts = opts || {};
    var A_ = A(), st = S(), old = tripId ? tripById(tripId) : null;
    if (tripId && !old) { location.hash = "#/p/" + k.id + "/trips"; return; }
    // Work on a copy of the whole trip, so fields this version doesn't know about ride along untouched.
    var d = old ? copy(old) : { kidIds: opts.all ? st.kids.map(function (x) { return x.id; }) : [k.id], route: [], date: M.today(), endDate: "", nights: null, roundTrip: true, done: true, stays: [], favs: [], moments: {}, memory: "", who: "", title: "", mark: null };
    if (!d.route) d.route = [];
    if (!old && st.meta.homePoint) d.route = [copy(st.meta.homePoint)];
    else if (!old && st.meta.home) d.route = [{ name: st.meta.home, kind: "place" }];
    // v1.8: "Plan this trip" from the family wishlist: the dream place is the destination, the people who voted are going, not done yet
    var wishDest = null, fromWish = !old && window.FS_WISH && window.FS_WISH.take ? window.FS_WISH.take() : null;
    if (fromWish) {
      var wd = copy(fromWish.stop); d.done = false; d.title = "Trip to " + wd.name; d.date = ""; d.plan = true;
      // the dream place is a stop, never the start: with no home saved yet, it's added right after they pick where they start
      if (d.route.length) { wd.mode = guessMode(d.route[0], wd); d.route.push(wd); }
      else { wishDest = wd; setTimeout(function () { A_.toast("Where do you start from? " + wd.name + " goes in next."); }, 400); }
      if (fromWish.who && fromWish.who.length) d.kidIds = fromWish.who.filter(function (id) { return st.kids.some(function (x) { return x.id === id; }); });
      if (!d.kidIds.length) d.kidIds = [k.id];
    }
    // v84: "Paste a booking": what we read from a flight or hotel confirmation fills in the new trip (the pasted text itself is never kept)
    var fromBooking = !old && !fromWish ? pendingBooking : null; pendingBooking = null;
    var mailId = fromBooking ? pendingMail : null; pendingMail = null;
    if (fromBooking) {
      ["date", "endDate", "done", "roundTrip", "title", "fly"].forEach(function (x) { if (fromBooking[x] !== undefined && fromBooking[x] !== "") d[x] = fromBooking[x]; });
      if (fromBooking.route.length) d.route = fromBooking.route[0].mode ? (d.route.slice(0, 1)).concat(copy(fromBooking.route)) : copy(fromBooking.route);
      if (fromBooking.stays.length) d.stays = copy(fromBooking.stays);
    }
    // v71 (B2): an unfinished new trip is kept on this phone as you type; "Continue" on Home brings it back here
    var RB = window.FS_ROBUST, resumed = !old && !fromWish && !fromBooking && RB && RB.resumeDraft ? RB.resumeDraft(k.id) : null;
    if (resumed && resumed.d) { Object.keys(resumed.d).forEach(function (x) { if (x !== "id" && x !== "photoId") d[x] = copy(resumed.d[x]); }); if (!d.kidIds || !d.kidIds.length) d.kidIds = [k.id]; }
    var newPhoto = null, removePhoto = false, saveHome = !st.meta.homePoint && !fromBooking, places = null, airports = null;
    function memVals() { var o = {}; document.querySelectorAll("[data-memf]").forEach(function (el) { o[el.dataset.memf] = el.value; }); return o; }
    loadPlaces().then(function (x) { places = x; renderRoute(); }).catch(function () {});
    loadAirports().then(function (x) { airports = x; renderFly(); }).catch(function () {});
    // "Did you fly?": "" = not answered, "yes", "no" or "skip". Older trips that already have a flight count as yes.
    var fly = d.fly || (old && (d.route || []).some(function (p) { return p.mode === "plane"; }) ? "yes" : ""), flyOpen = false, flyPick = { dep: null, arr: null, ti: 0 };
    var picks = st.kids.map(function (x) {
      return '<label style="' + A_.kidStyle(x) + '"><input type="checkbox" name="kids" value="' + esc(x.id) + '"' + (d.kidIds.indexOf(x.id) >= 0 ? " checked" : "") + '> <span class="dotp" aria-hidden="true">' + A_.initial(x) + '</span> ' + esc(M.who(x)) + '</label>';
    }).join("");
    var html = '<h2>' + (old ? "Edit trip" : "Add a trip") + '</h2>' + (old ? "" : '<p class="small bkpaste">' + (fromBooking ? '✓ Filled in from your booking. Check it over, then Save. ' : "") + '<button type="button" class="linkbtn" id="tpaste">📋 Paste a flight or hotel booking</button></p>') + '<div class="panel builder">' +
      '<div class="field" style="margin-top:0"><label>Who went?</label><div class="kidpick">' + picks + '</div>' +
      (st.kids.length > 2 ? '<button type="button" class="linkbtn" id="tall">Everyone went</button>' : "") + '</div>' +
      '<div class="bsec"><h3>Where did you go? <span class="muted small">Tap places in order</span></h3><ol class="route" id="broute"></ol><div id="bundo" class="undobar" role="status" hidden></div>' +
      '<div class="addplace"><label for="psearch" id="pslabel">Add a stop</label><div class="pswhere" id="pswhere" hidden></div><input id="psearch" type="search" autocomplete="off" placeholder="City, town or national park" aria-controls="presults">' +
      '<div class="results" id="presults" role="listbox"></div></div>' +
      '<label class="check small"><input type="checkbox" id="tround"' + (d.roundTrip ? " checked" : "") + '> Round trip (came back home at the end)</label>' +
      '<div class="btotal" id="btotal"></div><div id="bfly" class="bfly"></div></div>' +
      '<div class="bsec"><h3>When?</h3>' + (d.plan ? '<p class="small muted planhint">Pick your dates and Home counts down to the trip. While you\'re there, tap Stamp a stop.</p>' : "") + '<div class="fields"><div class="field"><label for="tdate">Start</label><input id="tdate" type="date" value="' + esc(d.date || "") + '"></div>' +
      '<div class="field"><label for="tend">End <span class="muted small">(optional)</span></label><input id="tend" type="date" value="' + esc(d.endDate || "") + '"></div>' +
      '<div class="field"><label for="tnights">Or how many nights?</label><input id="tnights" type="number" inputmode="numeric" min="0" max="999" value="' + (typeof d.nights === "number" ? d.nights : "") + '" placeholder="e.g. 7"></div></div>' +
      '<label class="check small"><input type="checkbox" id="tdone"' + (d.done || d.endDate ? " checked" : "") + '> We\'re home: this trip is done (unlocks its story)</label></div>' +
      '<details class="bsec more" id="dstays"' + (d.stays.length ? " open" : "") + '><summary>🏨 Where you stayed <span class="cnt"></span></summary><div id="bstays"></div><button type="button" class="linkbtn" id="addstay">+ Add a place you stayed</button></details>' +
      '<details class="bsec more" id="dfavs"' + (d.favs.length ? " open" : "") + '><summary>⭐ Favorites <span class="cnt"></span></summary><div id="bfavs"></div><div class="favadd" id="favadd"></div></details>' +
      '<details class="bsec more tmems"' + (Object.keys(d.moments || {}).length || d.memory || Object.keys(d.memories || {}).length ? " open" : "") + '><summary>💬 Trip memories</summary>' +
      '<p class="small muted">All optional. Fill in what you like, now or later.</p>' +
      '<div class="field"><label for="tmem">Notes</label><textarea id="tmem" maxlength="1000" rows="4" placeholder="Anything you want to remember about this trip">' + esc(d.memory || "") + '</textarea></div>' +
      T.MEM_PROMPTS.map(function (p) { return '<div class="field"><label for="tmm-' + p[0] + '">' + p[2] + ' ' + esc(p[1]) + '</label><textarea id="tmm-' + p[0] + '" data-memf="' + p[0] + '" maxlength="400" rows="2" placeholder="' + esc(p[3]) + '">' + esc((d.memories || {})[p[0]] || "") + '</textarea></div>'; }).join("") +
      '<h4 class="tmh">Each person\'s favorite moment</h4><div id="bmoments"></div></details>' +
      '<details class="bsec more"' + (d.photoId ? " open" : "") + '><summary>📷 Photo</summary><div class="field"><input id="tphoto" type="file" accept="image/*" aria-label="Photo"><p class="small muted">' +
      esc((window.MLTL_SYNC && window.MLTL_SYNC.photoNote()) || "We shrink it and keep it only on this device. Location data in the photo is removed.") + '</p>' +
      '<img id="tprev" class="photo-prev" alt="" hidden>' + (d.photoId ? '<button type="button" class="btn btn-ghost" id="trmphoto" style="margin-top:.5rem">Remove photo</button>' : "") + '</div></details>' +
      '<details class="bsec more"' + (d.title || d.who ? " open" : "") + '><summary>✏️ Name, who else, map</summary>' +
      '<div class="field"><label for="ttitle">Trip name (optional)</label><input id="ttitle" type="text" maxlength="80" value="' + esc(d.title || "") + '" placeholder="e.g. Scotland 2026, Smokies RV trip"></div>' +
      '<div class="field"><label for="twho">Anyone else along?</label><input id="twho" type="text" maxlength="120" value="' + esc(d.who || "") + '" placeholder="e.g. cousins, the Smiths, the dog"></div>' +
      '<div class="field"><label for="tmark">Color in one more place on the map? <span class="muted small">Stops above color in on their own</span></label><select id="tmark">' + A_.markOptions(d.mark) + '</select></div></details>' +
      (old && M.isDraft(old) ? '<div class="panel draftzone"><h3>From your photos</h3><p class="small muted">We made this trip from your photo dates and places. Fix anything that\'s off, then mark it reviewed.</p>' +
        '<div class="actions"><button type="button" class="btn btn-primary" id="treview">✓ Mark as reviewed</button></div></div>' : "") +
      '<p class="err" id="terr" hidden></p><div class="actions sticky"><button type="button" class="btn btn-beacon" id="addstopbig">＋ Add a stop</button><button class="btn btn-primary" id="tsave">Save trip</button>' +
      '<a class="btn btn-ghost" href="' + (old ? "#/p/" + esc(k.id) + "/trip/" + esc(old.id) : "#/p/" + esc(k.id) + "/trips") + '">Cancel</a>' + '</div>' +
      // Kept out of the pinned Save bar on purpose: on a phone that bar floats over the stays and favorites, and a tap meant for
      // a pub's Remove link once landed on Delete trip.
      (old ? '<div class="panel tdelzone"><h3>Delete this trip</h3><p class="small muted">It goes to Recently deleted for ' + M.BIN_DAYS + ' days, so you can bring it back.</p>' +
        '<div class="actions"><button type="button" class="btn btn-danger" id="tdel">Delete "' + esc(M.tripLabel(old)) + '"</button></div></div>' : "") + '</div>';
    A_.main.innerHTML = A_.shell(k, "trips", html);
    var routeEl = $("#broute"), search = $("#psearch"), results = $("#presults");
    // v53 "Stamp a stop" from Home's on-a-trip card: straight to adding a stop
    if (window.FS_FOCUS_STOP) { window.FS_FOCUS_STOP = false; if (search) setTimeout(function () { search.scrollIntoView({ block: "center" }); search.focus(); A_.toast("Type where you are now to stamp it"); }, 150); }
    function kidIds() { return $$("input[name=kids]:checked").map(function (c) { return c.value; }); }

    // route list
    function legLine(i) {
      var a = d.route[i - 1], b = d.route[i], L = T.legMiles(a, b);
      var how = L.how === "manual" ? "your miles" : L.how === "flight" ? "flying distance" : L.how === "about" ? "about, by " + MODE_LABEL[b.mode || "car"].toLowerCase() : "add both places to work it out";
      return (L.how === "about" ? "about " : "") + dist(L.miles) + ' <span class="muted">· ' + how + '</span>';
    }
    var replaceAt = null, undoStop = null;   // v95: "Change place" / "Change" start swaps a stop; undoStop = the last removed stop
    var insertAt = null;   // v80: "Add a stop here" puts the next pick between two stops
    function setRoute(res) { Array.prototype.splice.apply(d.route, [0, d.route.length].concat(res.route)); res.changed.forEach(function (i) { var p = d.route[i]; if (i > 0 && p.mode === "plane") fillAirports(d.route[i - 1], p); }); if (!planes()) d.back = null; flyPick.ti = 0; }
    function renderRoute() {
      var r = d.route;
      if (insertAt != null && (insertAt < 1 || insertAt >= r.length)) insertAt = null;
      routeEl.innerHTML = r.map(function (p, i) {
        var leg = "";
        if (i > 0) {
          var mode = p.mode || "car";
          leg = '<div class="leg" data-i="' + i + '"><div class="modes" role="group" aria-label="How did you get to ' + esc(p.name) + '?">' + T.MODES.map(function (m) {
              return '<button type="button" data-mode="' + m.id + '" aria-pressed="' + (m.id === mode) + '" title="' + MODE_LABEL[m.id] + '"><span aria-hidden="true">' + m.ic + '</span><span class="lbl">' + MODE_LABEL[m.id] + '</span></button>'; }).join("") + '</div>' +
            '<div class="legmi">' + legLine(i) + ' <button type="button" class="linkbtn sm" data-realmi="' + i + '">' + (typeof p.miles === "number" ? "Change" : "Know the real miles?") + '</button></div>' +
            '<div class="realmi" data-mi="' + i + '"' + (typeof p.miles === "number" ? "" : " hidden") + '><input type="number" inputmode="decimal" min="0" max="30000" step="any" data-miles="' + i + '" value="' + (typeof p.miles === "number" ? (units() === "km" ? Math.round(p.miles * T.KM_PER_MI) : p.miles) : "") + '" aria-label="Real distance in ' + (units() === "km" ? "kilometers" : "miles") + '" placeholder="' + (units() === "km" ? "km" : "miles") + '"> ' + units() + (typeof p.miles === "number" ? ' <button type="button" class="linkbtn sm" data-clearmi="' + i + '">Use the estimate</button>' : "") + '</div>' +
            (mode === "plane" ? '<div class="airports">' + ["dep", "arr"].map(function (w) {
              var ap = p[w];
              return '<div class="ap"><label>' + (w === "dep" ? "Left from airport" : "Landed at airport") + '</label><input type="search" autocomplete="off" data-ap="' + w + '" data-i="' + i + '" value="' + (ap ? esc(ap.code + " · " + (T.airportCity(ap.city, ap.name, ap.code) || ap.name)) : "") + '" placeholder="Code or city, e.g. MCO"><div class="results" data-apres="' + w + i + '"></div></div>';
            }).join("") + '</div>' : "") + '</div>';
        }
        var nights = typeof p.nights === "number" ? p.nights : 0;
        var here = i > 0 ? '<button type="button" class="addhere' + (insertAt === i ? " on" : "") + '" data-addat="' + i + '" aria-label="Add a stop between ' + esc(r[i - 1].name) + ' and ' + esc(p.name) + '">＋ Add a stop here</button>' : "";
        var mover = i > 0 && r.length > 2 ? '<div class="mover"><button type="button" data-mv="' + i + '" data-dir="-1" aria-label="Move ' + esc(p.name) + ' up (earlier)"' + (i === 1 ? " disabled" : "") + '>▲<small>Up</small></button>' +
          '<span class="grip" data-grip="' + i + '" title="Drag to move" aria-hidden="true">⠿</span>' +
          '<button type="button" data-mv="' + i + '" data-dir="1" aria-label="Move ' + esc(p.name) + ' down (later)"' + (i === r.length - 1 ? " disabled" : "") + '>▼<small>Down</small></button></div>' : "";
        return '<li class="rp" data-ri="' + i + '">' + here + leg + '<div class="pt' + (T.hasLoc(p) ? "" : " noloc") + '">' + mover + '<span class="pin" aria-hidden="true">' + (i === 0 ? "🏠" : p.kind === "park" ? "🌲" : p.kind === "sight" ? typeEmoji(p.type) : i) + '</span>' +
          '<div class="nm"><b>' + esc(p.name) + '</b><span>' + (i === 0 ? "Start · " : "") + esc(p.sub || (p.near ? "near " + p.near : T.hasLoc(p) ? "Your own place" : "No location yet")) + '</span>' +
          (p.date || p.note ? '<span class="stopmeta">' + (p.date ? '📅 ' + esc(stopDay(p.date)) : "") + (p.date && p.note ? " · " : "") + (p.note ? '📝 ' + esc(p.note) : "") + '</span>' : "") +
          (T.hasLoc(p) ? "" : '<button type="button" class="linkbtn sm" data-locate="' + i + '">📍 Find it on the map</button>') + '</div>' +
          '<div class="ptact">' + (i > 0 ? '<div class="stepper" aria-label="Nights in ' + esc(p.name) + '"><button type="button" data-n="-1" data-ni="' + i + '" aria-label="One less night">−</button><span>' + nights + '<small>' + (nights === 1 ? "night" : "nights") + '</small></span><button type="button" data-n="1" data-ni="' + i + '" aria-label="One more night">+</button></div>' : "") +
          (i === 0 ? '<button type="button" class="btn btn-ghost btn-small startchg" data-startchg="1" aria-label="Change where the trip starts">Change</button>' :
            '<button type="button" class="editstop" data-edit="' + i + '" aria-label="Edit stop ' + esc(p.name) + '"><span aria-hidden="true">✏️</span>Edit</button>') + '</div></div>' +
          (i === 0 && !st.meta.homePoint && !old ? '<label class="check small homechk"><input type="checkbox" id="thome"' + (saveHome ? " checked" : "") + '> Save as our home, so new trips start here</label>' : "") +
          '<div class="locate" data-loc="' + i + '" hidden><input type="search" autocomplete="off" data-near="' + i + '" placeholder="A town nearby, or lat, lon like 57.27, -6.20"><div class="results" data-nearres="' + i + '"></div></div></li>';
      }).join("");
      if (replaceAt != null && replaceAt >= r.length) replaceAt = null;
      $("#pslabel").textContent = replaceAt === 0 ? "Change where the trip starts" : replaceAt != null ? "Change " + r[replaceAt].name + " to…" : insertAt != null ? "Add a stop between " + r[insertAt - 1].name + " and " + r[insertAt].name : r.length ? "Add the next stop" : "Where did the trip start? (home)";
      var pw = $("#pswhere"); pw.hidden = insertAt == null && replaceAt == null;
      pw.innerHTML = replaceAt != null ? '<button type="button" class="linkbtn sm" id="pscancel">Cancel, keep ' + esc(r[replaceAt].name) + '</button>' : insertAt != null ? '<button type="button" class="linkbtn sm" id="pscancel">Add it at the end instead</button>' : "";
      if (insertAt != null || replaceAt != null) $("#pscancel").onclick = function () { insertAt = null; replaceAt = null; renderRoute(); };
      var ub = $("#bundo"); ub.hidden = !undoStop;
      ub.innerHTML = undoStop ? 'Removed ' + esc(undoStop.p.name) + '. <button type="button" class="btn btn-ghost btn-small" id="undostop">Undo</button>' : "";
      if (undoStop) $("#undostop").onclick = undoRemove;
      search.placeholder = r.length ? "City, town or national park" : "Your town, e.g. Orlando";
      $("#tround").parentNode.hidden = r.length < 2;
      var s = T.summary(Object.assign({}, d, { roundTrip: $("#tround").checked }));
      $("#btotal").innerHTML = s.legs.length ? '<span>Total: <b>' + (s.milesKnown ? "" : "at least ") + esc(dist(s.miles)) + '</b>' + (s.flights ? ' · ✈️ ' + s.flights : "") + '</span>' + unitToggle() : "";
      bindUnits($("#btotal"), renderRoute);
      renderFly();
    }
    // ---- "Did you fly? Which airports?" (asked when the trip leaves the home country; a quiet link otherwise) ----
    function homeCountry() { var h = d.route[0]; return (h && h.country) || (st.meta.homePoint && st.meta.homePoint.country) || ""; }
    function abroad() { return d.route.length > 1 && T.crossesBorder(d.route, homeCountry()); }
    function flyTarget() {   // the leg the flight is on: into the first stop abroad, or the longest leg at home
      var r = d.route, hc = homeCountry(), best = 1, bd = -1;
      for (var i = 1; i < r.length; i++) if (r[i].country && hc && r[i].country !== hc) return i;
      for (var j = 1; j < r.length; j++) { var g = T.gcMiles(r[j - 1], r[j]) || 0; if (g > bd) { bd = g; best = j; } }
      return best;
    }
    function planes() { return d.route.filter(function (p, i) { return i > 0 && p.mode === "plane"; }).length; }
    // ---- the way home (open-jaw): fly home from the airport nearest the last stop when that isn't where we landed ----
    function outFlight() { for (var i = 1; i < d.route.length; i++) if (d.route[i].mode === "plane" && d.route[i].dep && d.route[i].arr) return i; return 0; }
    function autoBack() {
      var rt = $("#tround") ? $("#tround").checked : d.roundTrip, fi = outFlight(), r = d.route;
      if (!rt || !fi || fly === "no") { if (d.back && d.back.mode === "plane" && (!rt || !fi)) d.back = null; return; }
      if (d.back && d.back.picked && d.back.mode === "plane" && d.back.dep) { d.back.arr = r[fi].dep; return; }
      var b = r[fi], last = r[r.length - 1], ap = airports && r.length - 1 > fi ? nearestAirport(last, airports) : null;
      if (ap && ap.code !== b.arr.code && T.gcMiles(last, r[0]) > 300) d.back = { mode: "plane", dep: ap, arr: b.dep };
      else d.back = fi > 1 ? { mode: "plane", dep: b.arr, arr: b.dep } : null;
    }
    function backHTML() {
      var fi = outFlight(), r = d.route; if (!fi || !airports || !($("#tround") && $("#tround").checked)) return "";
      var cur = d.back && d.back.mode === "plane" && d.back.dep ? d.back.dep : r[fi].arr, last = r[r.length - 1];
      var list = nearAirports(last, airports, 3); [r[fi].arr, cur].forEach(function (x) { if (x && !list.some(function (y) { return y.code === x.code; })) { var o = Object.assign({}, x), g = T.gcMiles(last, x); if (g != null) o.away = Math.round(g); list.push(o); } });
      return '<div class="flyhome" id="flyhome"><div class="aplabel" id="flyl-back">🏠 Flew home from <span class="muted small">near ' + esc(last.name) + ' · to ' + esc(r[fi].dep.code) + '</span></div>' +
        '<div class="chips apchips" role="group" aria-labelledby="flyl-back">' + list.map(function (x) { return apChip("back", x, x.code === cur.code); }).join("") + '</div>' +
        '<input type="search" autocomplete="off" id="flyq-back" data-flyq="back" placeholder="Another airport: code or city" aria-label="Flew home from: search airports"><div class="results" data-flyres="back"></div></div>';
    }
    function pickBack(o) {
      var fi = outFlight(); if (!fi || !o) return;
      d.back = { mode: "plane", dep: airportObj(o), arr: d.route[fi].dep, picked: true }; renderRoute();
      var again = $('[data-flyap="back"][data-code="' + o.code + '"]'); if (again) again.focus();
    }
    function apChip(w, a, on) {
      return '<button type="button" class="chip apchip" data-flyap="' + w + '" data-code="' + esc(a.code) + '" aria-pressed="' + !!on + '"><b>' + esc(a.code) + '</b> <span>' + esc(T.airportCity(a.city, a.name, a.code) || a.name) + '</span>' +
        (a.away != null ? ' <small>' + esc(dist(a.away)) + '</small>' : "") + '</button>';
    }
    function flySummary(s) {
      var outL = s.legs.filter(function (L) { return L.mode === "plane" && !L.home && L.dep && L.arr; }), out = outL.map(function (L) { return L.dep.code + " → " + L.arr.code; }),
        hl = s.legs.filter(function (L) { return L.mode === "plane" && L.home; })[0], home = !!hl;
      if (hl && hl.dep && outL[0] && hl.dep.code !== outL[0].arr.code) { out.push(hl.dep.code + " → " + (hl.arr ? hl.arr.code : "home")); home = false; }
      return (out.length ? esc(out.join(", ")) + (home ? " and back" : "") + ': ' : "") + '<b>' + s.flights + (s.flights === 1 ? " flight" : " flights") + '</b> · ' + esc(dist(s.flightMiles)) + ' flown' + (s.airMin ? ' · about ' + esc(T.fmtAir(s.airMin)) + ' in the air' : "");
    }
    function renderFly() {
      var box = $("#bfly"); if (!box) return;
      var r = d.route, rt = $("#tround") && $("#tround").checked;
      if (r.length < 2) { box.innerHTML = ""; return; }
      var intl = abroad(), n = planes(), ask = flyOpen || (intl && !fly);
      if (!ask) {
        autoBack();
        var s = T.summary(Object.assign({}, d, { roundTrip: rt }));
        if (n) box.innerHTML = '<div class="flydone" id="flydone"><span aria-hidden="true">✈️</span><span>' + flySummary(s) + '</span><span class="flybtns"><button type="button" class="linkbtn sm" id="flyedit">Change airports</button><button type="button" class="linkbtn sm" id="flyno">We didn\'t fly</button></span></div>' + backHTML();
        else box.innerHTML = '<p class="flylink small">' + (fly === "no" && intl ? '<span class="muted">No flights on this one. </span>' : "") + '<button type="button" class="linkbtn sm" id="flyedit">✈️ ' + (fly === "no" && intl ? "We did fly" : "Did you fly? Add airports") + '</button></p>';
        return;
      }
      var ti = flyTarget(), a = r[ti - 1], b = r[ti], cur = b.mode === "plane" ? b : {};
      if (flyPick.ti !== ti) flyPick = { ti: ti, dep: cur.dep || null, arr: cur.arr || null };
      var depS = nearAirports(a, airports, 3), arrS = nearAirports(b, airports, 3);
      if (!flyPick.dep && depS[0]) flyPick.dep = depS[0];
      if (!flyPick.arr && arrS[0]) flyPick.arr = arrS[0];
      function group(w, label, near, sugg) {
        var pick = flyPick[w], list = sugg.slice();
        if (pick && !list.some(function (x) { return x.code === pick.code; })) list.unshift(pick);
        return '<div class="apgroup"><div class="aplabel" id="flyl-' + w + '">' + label + ' <span class="muted small">' + esc(near) + '</span></div>' +
          (list.length ? '<div class="chips apchips" role="group" aria-labelledby="flyl-' + w + '">' + list.map(function (x) { return apChip(w, x, pick && pick.code === x.code); }).join("") + '</div>' : "") +
          '<input type="search" autocomplete="off" id="flyq-' + w + '" data-flyq="' + w + '" placeholder="' + (list.length ? "Another airport: code or city" : "Airport code or city, e.g. " + (w === "dep" ? "MCO" : "EDI")) + '" aria-label="' + esc(label) + ': search airports"><div class="results" data-flyres="' + w + '"></div></div>';
      }
      var prev = "";
      if (flyPick.dep && flyPick.arr) {
        var g = T.gcMiles(flyPick.dep, flyPick.arr), air = T.airMinutes(g), gA = T.gcMiles(a, flyPick.dep);
        prev = '<p class="flyprev" id="flyprev"><b>' + esc(flyPick.dep.code) + ' → ' + esc(flyPick.arr.code) + '</b> · ' + esc(dist(g)) + (air ? ' · about ' + esc(T.fmtAir(air)) + ' in the air' : "") + (rt ? ", each way" : "") +
          (gA != null && gA >= T.GROUND_MIN_MI ? '<br><span class="small muted">Plus about ' + esc(dist(gA * T.MODE.car.factor)) + ' by car to ' + esc(flyPick.dep.code) + '</span>' : "") + '</p>';
      }
      box.innerHTML = '<section class="flyask" id="flyask" aria-labelledby="flyh"><h4 id="flyh">✈️ Did you fly? <span>Which airports?</span></h4>' +
        '<p class="small muted">' + (intl ? "This trip goes abroad. " : "") + 'Pick the airports and Famstamp adds the flights, the miles flown and the time in the air.</p>' +
        (airports ? group("dep", "Flew from", "near " + a.name, depS) + group("arr", "Landed at", "near " + b.name, arrS) : '<p class="small muted">Loading airports…</p>') + prev +
        '<div class="actions flyacts"><button type="button" class="btn btn-primary" id="flyyes">✈️ Yes, add the flights</button><button type="button" class="btn btn-ghost" id="flyno">We didn\'t fly</button>' +
        '<button type="button" class="btn btn-ghost" id="flyskip">Skip</button></div></section>';
      if (airports && flyShown !== ti) { flyShown = ti; showFlyButtons(); }
    }
    // the sticky Save bar (and the phone tab bar) sit over the bottom of the screen: bring the yes / didn't fly / Skip row
    // up above them once, when the question first shows
    var flyShown = null;
    function showFlyButtons() {
      var acts = $("#flyask .flyacts"), card = $("#flyask"), bar = $(".actions.sticky"); if (!acts || !card || !window.scrollBy) return;
      var limit = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      var over = acts.getBoundingClientRect().bottom + 12 - limit;
      if (over > 0) window.scrollBy(0, over);   // on a short phone the heading may scroll up; the airports, preview and buttons stay in view
    }
    function setFly(v) {
      if (v === "yes") {
        var ti = flyPick.ti || flyTarget(), b = d.route[ti];
        if (!flyPick.dep || !flyPick.arr) return A_.toast("Pick both airports, or tap Skip");
        if (flyPick.dep.code === flyPick.arr.code) return A_.toast("Those are the same airport");
        b.mode = "plane"; b.dep = { code: flyPick.dep.code, name: flyPick.dep.name, city: flyPick.dep.city, country: flyPick.dep.country, lat: flyPick.dep.lat, lon: flyPick.dep.lon };
        b.arr = { code: flyPick.arr.code, name: flyPick.arr.name, city: flyPick.arr.city, country: flyPick.arr.country, lat: flyPick.arr.lat, lon: flyPick.arr.lon };
        // home again: the first leg backwards covers it; a flight later in the trip flies home from the same airport
        d.back = ti > 1 ? { mode: "plane", dep: b.arr, arr: b.dep } : null; autoBack();
        A_.toast("Flights added ✈️");
      } else if (v === "no") {
        d.route.forEach(function (p, i) { if (i && p.mode === "plane") { p.mode = "car"; delete p.dep; delete p.arr; } });
        d.back = null;
      }
      fly = v; flyOpen = false; renderRoute();
      var f = v === "yes" ? $("#flydone") : $("#flyedit"); if (f && f.scrollIntoView) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    }
    $("#bfly").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.id === "flyyes") setFly("yes");
      else if (b.id === "flyno") setFly("no");
      else if (b.id === "flyskip") setFly("skip");
      else if (b.id === "flyedit") { flyOpen = true; flyPick.ti = 0; renderFly(); var q = $("#flyask"); if (q && q.scrollIntoView) q.scrollIntoView({ block: "nearest" }); }
      else if (b.dataset.flyap === "back") { var fi = outFlight(), cand = nearAirports(d.route[d.route.length - 1], airports, 3).concat([d.route[fi] && d.route[fi].arr, d.back && d.back.dep].filter(Boolean)); pickBack(cand.filter(function (x) { return x.code === b.dataset.code; })[0]); }
      else if (b.dataset.flyap) {
        var w = b.dataset.flyap, ti = flyPick.ti, near = nearAirports(w === "dep" ? d.route[ti - 1] : d.route[ti], airports, 3).concat(flyPick[w] ? [flyPick[w]] : []);
        flyPick[w] = near.filter(function (x) { return x.code === b.dataset.code; })[0] || flyPick[w]; renderFly();
        var again = $('[data-flyap="' + w + '"][data-code="' + b.dataset.code + '"]'); if (again) again.focus();
      }
    });
    $("#bfly").addEventListener("input", function (e) {
      var el = e.target, w = el.dataset.flyq; if (!w || !airports) return;
      var box = $('[data-flyres="' + w + '"]');
      if (el.value.trim().length < 2) { box.innerHTML = ""; return; }
      showResults(box, searchAirports(el.value, airports).map(function (a) { return { label: a.code + " · " + a.city, sub: a.name, a: a }; }), function (x) {
        if (x && w === "back") return pickBack(x.a);
        if (!x) return; var o = airportObj(x.a), ref = w === "dep" ? d.route[flyPick.ti - 1] : d.route[flyPick.ti], g = T.gcMiles(ref, o); if (g != null) o.away = Math.round(g);
        flyPick[w] = o; renderFly();
      });
    });
    function addPoint(p) {
      if (replaceAt != null && replaceAt < d.route.length) return replacePoint(p);
      var c = T.cleanPoint(p, d.route.length === 0); if (!c) return;
      if (d.route.length >= T.MAX_POINTS) { A_.toast("That's the most stops one trip can hold (" + T.MAX_POINTS + ")"); return; }
      if (insertAt != null && insertAt >= 1 && insertAt < d.route.length) {
        var at = insertAt, a = d.route[at - 1], b = d.route[at];
        if (T.sameStop(a, c) || T.sameStop(b, c)) { search.value = ""; results.innerHTML = ""; A_.toast("That's already the stop " + (T.sameStop(a, c) ? "before" : "after") + " this spot"); return; }
        c.mode = guessMode(a, c); insertAt = null;
        setRoute(T.insertStop(d.route, at, c));
        if (c.mode === "plane") fillAirports(a, c);
        search.value = ""; results.innerHTML = ""; renderRoute(); A_.toast("Added " + c.name + " between " + a.name + " and " + b.name);
        return;
      }
      var last = d.route[d.route.length - 1];
      if (last && T.sameStop(last, c)) { search.value = ""; results.innerHTML = ""; A_.toast(d.route.length === 1 ? "You're already starting from " + last.name + ". Where did you go next?" : "That's the stop you're already at"); return; }
      if (d.route.length) { c.mode = guessMode(d.route[d.route.length - 1], c); if (c.mode === "plane") fillAirports(d.route[d.route.length - 1], c); }
      d.route.push(c); search.value = ""; results.innerHTML = ""; renderRoute();
      if (wishDest && d.route.length === 1) { var wdst = wishDest; wishDest = null; addPoint(wdst); }
    }
    // v95: swap one stop for another place (or the start), keeping its spot, nights, date and notes
    function replacePoint(p) {
      var at = replaceAt, old0 = d.route[at], c = T.cleanPoint(p, at === 0); replaceAt = null; if (!c) return;
      ["nights", "date", "note"].forEach(function (k) { if (old0[k] != null && c[k] == null) c[k] = old0[k]; });
      var before = d.route.slice(), r = d.route.slice(); r[at] = c;
      if (at > 0) c.mode = guessMode(r[at - 1], c);   // a new place is a new trip there: re-guess car or plane
      setRoute({ route: r, changed: T.relink(before, r) });
      if (at > 0 && c.mode === "plane") fillAirports(r[at - 1], c);
      if (at === 0 && r[1]) { var g1 = guessMode(c, r[1]); if (g1 === "plane" && r[1].mode !== "plane") r[1].mode = "plane"; if (r[1].mode === "plane") fillAirports(c, r[1]); }
      search.value = ""; results.innerHTML = ""; undoStop = null; renderRoute();
      A_.toast(at === 0 ? "The trip now starts in " + c.name : "Changed " + old0.name + " to " + c.name);
    }
    function stopDay(x) { var t = new Date(x + "T12:00:00"); return isNaN(t) ? x : t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
    function focusSearch(msg) { setTimeout(function () { search.scrollIntoView({ block: "center" }); search.focus(); if (msg) A_.toast(msg); }, 60); }
    function removeStop(i) {
      var before = d.route.slice(), p = d.route[i]; d.route.splice(i, 1);
      setRoute({ route: d.route.slice(), changed: T.relink(before, d.route) });
      if (insertAt != null && i < insertAt) insertAt--; if (replaceAt != null) replaceAt = null;
      undoStop = { p: p, i: i, route: before }; renderRoute(); A_.toast("Removed " + p.name + ". Tap Undo to bring it back");
    }
    function undoRemove() {
      var u = undoStop; undoStop = null; if (!u) return;
      var before = d.route.slice(), r = d.route.slice(), at = Math.min(u.i, r.length); r.splice(at, 0, u.p);
      // put back the exact stop (its miles and airports too) when nothing else changed since
      var same = u.route.length === r.length && u.route.every(function (x, j) { return x === r[j]; });
      setRoute(same ? { route: u.route.slice(), changed: [] } : { route: r, changed: T.relink(before, r) });
      renderRoute(); A_.toast(u.p.name + " is back");
    }
    // v95: one sheet for everything about a stop: change the place, its date, notes, move it, or remove it (with a confirm and Undo)
    function editStop(i) {
      var p = d.route[i]; if (!p || i < 1) return; var last = i === d.route.length - 1;
      var el = sheet('<h3>Edit stop</h3><p class="esname"><b>' + esc(p.name) + '</b><span class="muted small">' + esc(p.sub || "") + '</span></p>' +
        '<button type="button" class="btn btn-ghost esrow" id="es-place">🔁 Change place</button>' +
        '<div class="field"><label for="es-date">Date you were there <span class="muted small">(optional)</span></label><input id="es-date" type="date" value="' + esc(p.date || "") + '"></div>' +
        '<div class="field"><label for="es-note">Notes <span class="muted small">(optional)</span></label><textarea id="es-note" maxlength="300" rows="2" placeholder="What you did here">' + esc(p.note || "") + '</textarea></div>' +
        '<div class="esmove"><button type="button" class="btn btn-ghost" id="es-up"' + (i === 1 ? " disabled" : "") + '>▲ Move up</button><button type="button" class="btn btn-ghost" id="es-down"' + (last ? " disabled" : "") + '>▼ Move down</button></div>' +
        '<div class="esrm" id="es-rmbox"><button type="button" class="btn btn-ghost esdanger" id="es-rm">Remove this stop</button></div>' +
        '<div class="actions"><button type="button" class="btn btn-primary" id="es-save">Done</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
      function keep() { var dt = $("#es-date", el).value, nt = $("#es-note", el).value.trim().slice(0, 300); if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) p.date = dt; else delete p.date; if (nt) p.note = nt; else delete p.note; }
      $("#es-save", el).onclick = function () { keep(); closeSheet(); undoStop = null; renderRoute(); };
      $("#es-place", el).onclick = function () { keep(); closeSheet(); insertAt = null; replaceAt = i; renderRoute(); focusSearch(); };
      function mv(dir) { keep(); closeSheet(); setRoute(T.moveStop(d.route, i, i + dir)); undoStop = null; renderRoute(); A_.toast("Moved " + p.name + (dir < 0 ? " up" : " down")); }
      $("#es-up", el).onclick = function () { mv(-1); };
      $("#es-down", el).onclick = function () { mv(1); };
      $("#es-rm", el).onclick = function () {
        // trip stamps come from the stops, so say so: nothing is deleted until Save, and Undo puts it back
        $("#es-rmbox", el).innerHTML = '<p class="small">Remove <b>' + esc(p.name) + '</b> from this trip? Its stamp from this trip goes too when you save. Your photos stay.</p>' +
          '<div class="actions"><button type="button" class="btn btn-danger" id="es-rmyes">Yes, remove</button><button type="button" class="btn btn-ghost" id="es-rmno">Keep it</button></div>';
        $("#es-rmyes", el).onclick = function () { closeSheet(); removeStop(i); };
        $("#es-rmno", el).onclick = function () { editStop(i); };
        $("#es-rmyes", el).focus();
      };
    }
    function guessMode(a, b) { var g = T.gcMiles(a, b); return g == null ? "car" : g > 600 || T.mustFly(a, b) || (a.country && b.country && a.country !== b.country && g > 300) ? "plane" : "car"; }
    function fillAirports(a, b) { if (!airports) return; if (!b.dep) { var x = nearestAirport(a, airports); if (x) b.dep = x; } if (!b.arr) { var y = nearestAirport(b, airports); if (y) b.arr = y; } }
    function showResults(box, list, onPick, custom) {
      box.innerHTML = list.map(function (p, i) { return '<button type="button" role="option" data-pick="' + i + '"' + (p.badge ? ' class="famous"' : "") + '><b>' + esc(p.label || p.name) + (p.badge ? ' <em class="fambadge">' + esc(p.badge) + '</em>' : "") + '</b><span>' + esc(p.sub || "") + '</span></button>'; }).join("") +
        (custom && custom !== "osm" ? '<button type="button" role="option" data-pick="custom" class="custom">➕ Use “' + esc(custom) + '” as our own place<span>For a cabin, a beach or anywhere not on the list</span></button>' : "") +
        // v81: not on our lists? look it up on OpenStreetMap (only when tapped), or drop a pin on the map
        (custom && window.FS_PIN && custom.length >= 3 && custom !== "osm" ? '<button type="button" role="option" data-pick="osm" class="custom osm">🔎 Not here? Search OpenStreetMap for “' + esc(custom) + '”<span>Looks it up when you tap · © OpenStreetMap contributors</span></button>' : "") +
        (custom && window.FS_PIN ? '<button type="button" role="option" data-pick="pin" class="custom pin">📍 Drop a pin on the map<span>Name it and pick what kind of place it is (beach, cabin, waterfall…)</span></button>' : "");
      $$("[data-pick]", box).forEach(function (b) { b.onclick = function () {
        var k = b.dataset.pick;
        if (k === "osm") return osmSearch(custom);
        if (k === "pin") return openPin(custom === "osm" ? search.value.trim() : custom);
        onPick(k === "custom" ? null : list[+k]);
      }; });
    }
    function osmSearch(q) {
      results.innerHTML = '<p class="small muted" role="status">Looking on OpenStreetMap…</p>';
      window.FS_PIN.search(q).then(function (list) {
        if (search.value.trim() !== q) return;
        showResults(results, list, function (p) { if (p) addPoint(p); }, "osm");
        results.insertAdjacentHTML(list.length ? "afterbegin" : "beforeend", list.length ? '<p class="small muted osmhead">From OpenStreetMap · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></p>' : '<p class="small muted">OpenStreetMap has nothing called “' + esc(q) + '” either. Drop a pin instead, or add it as our own place.</p>');
      }).catch(function (e) { results.innerHTML = '<p class="small muted">Couldn\'t reach OpenStreetMap right now (' + esc(e.message || "offline") + '). Drop a pin or try again in a minute.</p>'; showResults(results, [], function () {}, q); });
    }
    function openPin(name) {
      var r = d.route, ref = insertAt != null && r[insertAt - 1] ? r[insertAt - 1] : r[r.length - 1], c = null;
      for (var i = r.length - 1; !c && i >= 0; i--) if (r[i] && r[i].lat != null) c = r[i];
      if (ref && ref.lat != null) c = ref;
      window.FS_PIN.open({ name: /^osm$/.test(name || "") ? "" : name, center: c ? { lat: c.lat, lon: c.lon } : null,
        findLocal: function (q) { var x = searchPlaces(q, places || [], null)[0]; return x && x.lat != null ? x : null; },
        onDone: function (pt) { addPoint(pt); A_.toast("Added " + pt.name + " 📍"); } });
    }
    warmPlaces();
    var typeT = 0;   // v94: wait for a short pause in typing before searching (each search walks thousands of places)
    search.addEventListener("input", function (e) { clearTimeout(typeT); if (e.isTrusted) typeT = setTimeout(runSearch, 140); else runSearch(); });
    function runSearch() {
      typeT = 0; var q = search.value.trim();
      if (q.length < 2) { results.innerHTML = ""; return; }
      if (!places) { results.innerHTML = '<p class="small muted">Loading places…</p>'; loadPlaces().then(function (x) { places = x; search.dispatchEvent(new Event("input")); }).catch(function () { showResults(results, [], function () { addPoint({ name: q, kind: "place" }); }, q); }); return; }
      if (!townsReady(q)) ensureTowns(q).then(function (got) { if (got && search.value.trim() === q) search.dispatchEvent(new Event("input")); });
      showResults(results, searchPlaces(q, places, d.route.length > 1 ? d.route[d.route.length - 1].country : null), function (p) { addPoint(p || { name: q, kind: "place" }); if (!p) A_.toast("Added. Tap 📍 to put it on the map, or type the real miles."); }, q);
    }
    search.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (typeT) { clearTimeout(typeT); runSearch(); } var b = $("[data-pick]", results); if (b) b.click(); } });
    $("#addstopbig").onclick = function () { replaceAt = null; renderRoute(); focusSearch(); };
    routeEl.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.mode) { var i = +b.closest(".leg").dataset.i, p = d.route[i]; p.mode = b.dataset.mode; if (p.mode === "plane") { fillAirports(d.route[i - 1], p); fly = "yes"; flyOpen = false; } else { delete p.dep; delete p.arr; if (!planes()) d.back = null; } renderRoute(); }
      else if (b.dataset.ni) { var q = d.route[+b.dataset.ni]; q.nights = Math.max(0, Math.min(366, (q.nights || 0) + (+b.dataset.n))); renderRoute(); }
      else if (b.dataset.rm) { if (confirm("Remove " + d.route[+b.dataset.rm].name + " from this trip?")) removeStop(+b.dataset.rm); }
      else if (b.dataset.edit) editStop(+b.dataset.edit);
      else if (b.dataset.startchg) { insertAt = null; replaceAt = 0; renderRoute(); focusSearch(); }
      else if (b.dataset.mv) { var from = +b.dataset.mv, to = from + (+b.dataset.dir); setRoute(T.moveStop(d.route, from, to)); renderRoute(); var mb = $('[data-mv="' + to + '"][data-dir="' + b.dataset.dir + '"]', routeEl) || $('[data-mv="' + to + '"]', routeEl); if (mb && !mb.disabled) mb.focus(); A_.toast("Moved " + d.route[to].name); }
      else if (b.dataset.addat) { insertAt = +b.dataset.addat === insertAt ? null : +b.dataset.addat; replaceAt = null; renderRoute(); if (insertAt != null) { search.scrollIntoView({ block: "center" }); search.focus(); } }
      else if (b.dataset.realmi) { var box = $('[data-mi="' + b.dataset.realmi + '"]', routeEl); box.hidden = false; $("input", box).focus(); }
      else if (b.dataset.clearmi) { delete d.route[+b.dataset.clearmi].miles; renderRoute(); }
      else if (b.dataset.locate) { var l = $('[data-loc="' + b.dataset.locate + '"]', routeEl); l.hidden = !l.hidden; if (!l.hidden) $("input", l).focus(); }
    });
    // v80: drag a stop by its ⠿ grip to a new place in the list (the start stays first)
    routeEl.addEventListener("pointerdown", function (e) {
      var g = e.target.closest("[data-grip]"); if (!g) return;
      e.preventDefault();
      var from = +g.dataset.grip, li = g.closest("li.rp"), y0 = e.clientY, to = from;
      var rows = $$("li.rp", routeEl), mids = rows.map(function (x) { var b = x.getBoundingClientRect(); return b.top + b.height / 2; });
      li.classList.add("dragging"); try { g.setPointerCapture(e.pointerId); } catch (x) {}
      function mark() { rows.forEach(function (x, i) { x.classList.toggle("dropat", i === to && to !== from); }); }
      function move(ev) {
        var dy = ev.clientY - y0; li.style.transform = "translateY(" + dy + "px)";
        var y = mids[from] + dy, t = from;
        for (var i = 1; i < mids.length; i++) { if (i < from && y < mids[i]) { t = i; break; } }
        if (t === from) for (var k = mids.length - 1; k > from; k--) { if (y > mids[k]) { t = k; break; } }
        to = t; mark();
      }
      function up() {
        g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up);
        li.classList.remove("dragging"); li.style.transform = ""; rows.forEach(function (x) { x.classList.remove("dropat"); });
        if (to !== from) { setRoute(T.moveStop(d.route, from, to)); renderRoute(); A_.toast("Moved " + d.route[to].name); }
      }
      g.addEventListener("pointermove", move); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
    });
    routeEl.addEventListener("change", function (e) {
      var el = e.target;
      if (el.dataset.miles) { var v = parseFloat(el.value), p = d.route[+el.dataset.miles]; if (isFinite(v) && v >= 0) p.miles = Math.round((units() === "km" ? v / T.KM_PER_MI : v) * 10) / 10; else delete p.miles; renderRoute(); }
      if (el.id === "thome") saveHome = el.checked;
    });
    routeEl.addEventListener("input", function (e) {
      var el = e.target;
      if (el.dataset.ap) {
        var i = +el.dataset.i, w = el.dataset.ap, box = $('[data-apres="' + w + i + '"]', routeEl);
        if (!airports) { loadAirports().then(function (x) { airports = x; el.dispatchEvent(new Event("input", { bubbles: true })); }).catch(function () {}); return; }
        if (!el.value.trim()) { delete d.route[i][w]; renderRoute(); return; }
        showResults(box, searchAirports(el.value, airports).map(function (a) { return { label: a.code + " · " + a.city, sub: a.name, a: a }; }), function (x) { if (x) { d.route[i][w] = airportObj(x.a); fly = "yes"; flyPick.ti = 0; renderRoute(); } });
      }
      if (el.dataset.near) {
        var j = +el.dataset.near, box2 = $('[data-nearres="' + j + '"]', routeEl), m = el.value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
        var opts = [];
        if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) opts.push({ label: "Pin it at " + (+m[1]).toFixed(3) + ", " + (+m[2]).toFixed(3), sub: "Latitude, longitude", ll: [+m[1], +m[2]] });
        else if (places) { if (!townsReady(el.value)) { var nv = el.value; ensureTowns(nv).then(function (got) { if (got && el.value === nv) el.dispatchEvent(new Event("input", { bubbles: true })); }); } opts = searchPlaces(el.value, places).filter(function (p) { return p.kind === "city"; }).slice(0, 6).map(function (p) { return { label: "Near " + p.name, sub: p.sub, p: p }; }); }
        showResults(box2, opts, function (x) {
          if (!x) return; var pt = d.route[j];
          if (x.ll) { pt.lat = x.ll[0]; pt.lon = x.ll[1]; }
          else { pt.lat = x.p.lat; pt.lon = x.p.lon; pt.country = x.p.country; if (x.p.region) pt.region = x.p.region; pt.near = x.p.name; pt.sub = "near " + x.p.name + ", " + x.p.sub; }
          renderRoute();
        });
      }
    });
    $("#tround").onchange = function () { d.roundTrip = this.checked; if (!this.checked) d.back = null; renderRoute(); };
    renderRoute();

    // stays, favorites, moments
    function starsInput(path, n) {
      return '<span class="starsin" role="group" aria-label="Rating">' + [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" data-star="' + path + '" data-v="' + v + '" aria-pressed="' + (v <= (n || 0)) + '" aria-label="' + v + ' star' + (v > 1 ? "s" : "") + '">★</button>'; }).join("") + '</span>';
    }
    function renderStays() {
      $("#bstays").innerHTML = d.stays.map(function (s, i) {
        return '<div class="item" data-stay="' + i + '"><div class="fields"><div class="field"><label>Name</label><input type="text" maxlength="80" data-sf="name" value="' + esc(s.name || "") + '" placeholder="e.g. The Highland Inn"></div>' +
          '<div class="field"><label>Type</label><select data-sf="type">' + T.STAY_TYPES.map(function (x) { return '<option value="' + x.id + '"' + (x.id === s.type ? " selected" : "") + '>' + x.ic + ' ' + esc(x.label) + '</option>'; }).join("") + '</select></div>' +
          '<div class="field"><label>Nights</label><input type="number" inputmode="numeric" min="0" max="366" data-sf="nights" value="' + (s.nights != null ? s.nights : "") + '"></div>' +
          (d.route.length > 1 ? '<div class="field"><label>Where</label><select data-sf="where"><option value="">Somewhere on the way</option>' + d.route.slice(1).map(function (p) { return p.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).concat(s.where && !d.route.some(function (p) { return p.name === s.where; }) ? [s.where] : [])
            .map(function (n) { return '<option' + (n === s.where ? " selected" : "") + '>' + esc(n) + '</option>'; }).join("") + '</select></div>' : "") + '</div>' +
          '<div class="field"><label>How was it?</label>' + starsInput("stay." + i, s.rating) + '</div>' +
          '<div class="field"><input type="text" maxlength="140" data-sf="note" value="' + esc(s.note || "") + '" placeholder="A note (optional): the view, the pool, the creaky stairs" aria-label="Note"></div>' +
          '<button type="button" class="linkbtn sm danger" data-rmstay="' + i + '">Remove</button></div>';
      }).join("");
      $("#dstays .cnt").textContent = d.stays.length ? "(" + d.stays.length + ")" : "";
      $("#addstay").hidden = d.stays.length >= T.MAX_STAYS;
    }
    function renderFavs() {
      var grown = adultOn(kidIds());
      $("#bfavs").innerHTML = d.favs.map(function (f, i) {
        var c = T.FAV[f.cat]; if (c.adult && !grown) return "";
        return '<div class="item fav' + (c.adult ? " adult" : "") + '" data-fav="' + i + '"><div class="favcat">' + c.ic + ' ' + esc(c.label) + (c.adult ? ' <span class="tag">grown-ups</span>' : "") + '</div>' +
          '<div class="fields"><div class="field"><label>Name</label><input type="text" maxlength="80" data-ff="name" value="' + esc(f.name || "") + '" placeholder="' + esc(favHint(f.cat)) + '"></div>' +
          '<div class="field"><label>Where <span class="muted small">(optional)</span></label><input type="text" maxlength="60" data-ff="where" value="' + esc(f.where || "") + '" placeholder="Town or stop"></div></div>' +
          '<div class="field">' + starsInput("fav." + i, f.rating) + '</div>' +
          '<div class="field"><input type="text" maxlength="140" data-ff="note" value="' + esc(f.note || "") + '" placeholder="Why it was the best (optional)" aria-label="Note"></div>' +
          '<button type="button" class="linkbtn sm danger" data-rmfav="' + i + '">Remove</button></div>';
      }).join("");
      $("#favadd").innerHTML = '<p class="small muted">Add a favorite:</p><div class="chips">' + T.FAV_CATS.filter(function (c) { return !c.adult || grown; }).map(function (c) {
        return '<button type="button" class="chip addfav' + (c.adult ? " adult" : "") + '" data-addfav="' + c.id + '">' + c.ic + ' ' + esc(c.short) + '</button>'; }).join("") + '</div>' +
        (grown ? "" : '<p class="small muted">Pub, pint and coffee picks show up when a grown-up is on the trip.</p>');
      $("#dfavs .cnt").textContent = d.favs.length ? "(" + d.favs.length + ")" : "";
    }
    function favHint(cat) { return { restaurant: "e.g. The Fish Shack", activity: "e.g. Loch Ness boat ride", treat: "e.g. Mint chip at Mo's", pub: "e.g. The Clachaig Inn", drink: "e.g. Cuillin Pale Ale", coffee: "e.g. Sweet Pea Café" }[cat] || ""; }
    function renderMoments() {
      var ids = kidIds();
      $("#bmoments").innerHTML = people(ids).map(function (p) {
        return '<div class="field"><label for="mo-' + esc(p.id) + '" style="' + A_.kidStyle(p) + '"><span class="dotp" aria-hidden="true">' + A_.initial(p) + '</span> ' + esc(M.who(p)) + '\'s favorite moment</label>' +
          '<input id="mo-' + esc(p.id) + '" type="text" maxlength="280" data-moment="' + esc(p.id) + '" value="' + esc((d.moments || {})[p.id] || "") + '" placeholder="' + (M.isKid(p) ? "e.g. Seeing a real castle!" : "e.g. The sunset on the ferry") + '"></div>';
      }).join("") || '<p class="small muted">Check who went first.</p>';
    }
    var panel = $(".builder");
    panel.addEventListener("input", function (e) {
      var el = e.target, it;
      if (el.dataset.sf && (it = el.closest("[data-stay]"))) { var s = d.stays[+it.dataset.stay]; s[el.dataset.sf] = el.dataset.sf === "nights" ? (el.value === "" ? null : +el.value) : el.value; }
      if (el.dataset.ff && (it = el.closest("[data-fav]"))) d.favs[+it.dataset.fav][el.dataset.ff] = el.value;
      if (el.dataset.moment) { d.moments = d.moments || {}; d.moments[el.dataset.moment] = el.value; }
    });
    panel.addEventListener("change", function (e) { if (e.target.dataset.sf === "type" || e.target.dataset.sf === "where") d.stays[+e.target.closest("[data-stay]").dataset.stay][e.target.dataset.sf] = e.target.value; if (e.target.name === "kids") { renderFavs(); renderMoments(); } });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.star) { var pp = b.dataset.star.split("."), list = pp[0] === "stay" ? d.stays : d.favs, o = list[+pp[1]], v = +b.dataset.v; o.rating = o.rating === v ? 0 : v; pp[0] === "stay" ? renderStays() : renderFavs(); }
      if (b.dataset.rmstay) { d.stays.splice(+b.dataset.rmstay, 1); renderStays(); }
      if (b.dataset.rmfav) { d.favs.splice(+b.dataset.rmfav, 1); renderFavs(); }
      if (b.dataset.addfav) { if (d.favs.length >= T.MAX_FAVS) return A_.toast("That's plenty of favorites for one trip!"); d.favs.push({ cat: b.dataset.addfav, name: "" }); renderFavs(); var ins = $$("#bfavs [data-ff=name]"); if (ins.length) ins[ins.length - 1].focus(); }
      if (b.id === "addstay") { var last = d.route[d.route.length - 1]; d.stays.push({ name: "", type: "hotel", nights: null, where: last && d.route.length > 1 ? last.name : "" }); renderStays(); var si = $$("#bstays [data-sf=name]"); si[si.length - 1].focus(); }
    });
    renderStays(); renderFavs(); renderMoments();
    var tp = $("#tpaste"); if (tp) tp.onclick = function () { bookingSheet(k, opts); };
    if (tp && openPaste) { openPaste = false; setTimeout(function () { if (document.body.contains(tp)) tp.click(); }, 50); }   // v92: from an email note
    var tall = $("#tall"); if (tall) tall.onclick = function () { $$("input[name=kids]").forEach(function (c) { c.checked = true; }); renderFavs(); renderMoments(); };
    var end = $("#tend"), done = $("#tdone");
    // The end can't be before the start: the picker won't offer earlier days, and Save says so if one is typed anyway.
    var startIn = $("#tdate"); function endMin() { end.min = startIn.value || ""; } endMin();
    startIn.addEventListener("change", endMin);
    end.onchange = function () { if (end.value && end.value <= M.today()) done.checked = true; };

    // photo
    var prev = $("#tprev");
    if (d.photoId) A_.photoURL(d.photoId).then(function (u) { if (u) { prev.src = u; prev.hidden = false; } });
    $("#tphoto").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      A_.shrinkPhoto(f).then(function (x) { newPhoto = x; removePhoto = false; prev.src = x; prev.hidden = false; })
        .catch(function (er) { var el = $("#terr"); el.textContent = er.message; el.hidden = false; });
    };
    var rmp = $("#trmphoto"); if (rmp) rmp.onclick = function () { removePhoto = true; newPhoto = null; prev.hidden = true; rmp.hidden = true; };

    // save
    var saving = false, reviewing = false, dupOk = false;
    // Mark as reviewed = take "Draft:" off the name and save, keeping anything else changed on this screen
    var rv = $("#treview"); if (rv) rv.onclick = function () { var ti = $("#ttitle"); ti.value = ti.value.replace(/^\s*draft:\s*/i, "").trim(); reviewing = true; $("#tsave").onclick(); };
    $("#tsave").onclick = function () {
      if (saving) return;   // a double tap mustn't add the trip twice
      var err = $("#terr"); err.hidden = true;
      var ids = kidIds(), mv = $("#tmark").value, jobs = [];
      if (!d.route.length) { err.textContent = "Add where you went (type a town or park above)."; err.hidden = false; search.focus(); return; }
      if (end.value && $("#tdate").value && end.value < $("#tdate").value) { err.textContent = "The end date is before the start date. Pick an end on or after " + M.prettyDate($("#tdate").value) + "."; err.hidden = false; end.focus(); return; }
      var photoId = d.photoId || null;
      if (removePhoto && photoId) { jobs.push(A_.del("photos", photoId)); photoId = null; }
      if (newPhoto) { if (photoId) jobs.push(A_.del("photos", photoId)); photoId = M.uid("photo"); }
      autoBack();
      var nightsV = $("#tnights").value, title = $("#ttitle").value.trim();
      var before = stampKeys(ids), grown = adultOn(ids), trip;
      try {
        var made = M.newTrip({ id: old ? old.id : undefined, createdAt: old ? old.createdAt : undefined, kidIds: ids,
          place: title || T.mainDest(d.route) || (d.route[d.route.length - 1] || {}).name, route: T.stops(d.route), title: title, date: $("#tdate").value, endDate: end.value,
          nights: end.value ? null : (nightsV === "" ? null : +nightsV), roundTrip: d.route.length > 1 && $("#tround").checked, done: done.checked,
          fly: fly, back: $("#tround").checked ? d.back : null, stays: d.stays, favs: d.favs.filter(function (f) { return grown || !T.FAV[f.cat].adult; }), moments: d.moments, story: d.story, memories: memVals(), wx: d.wx,
          who: $("#twho").value, memory: $("#tmem").value, mark: mv ? { kind: mv.split(":")[0], id: mv.split(":")[1] } : null, photoId: photoId });
        trip = Object.assign(old ? copy(old) : {}, made);
        if (reviewing) trip = M.reviewTrip(trip);
      } catch (x) { reviewing = false; err.textContent = x.message; err.hidden = false; return; }
      // v71 (B10): the same trip already here (same people, same place, same days)? Offer to merge instead of a copy.
      if (!old && RB && RB.dupMatch) {
        var dm = RB.dupMatch(trip, st.trips);
        if (dm && !dupOk) { RB.askDup(dm, trip).then(function (how) { if (!how) return; dupOk = how; $("#tsave").onclick(); }); return; }
        if (dm && dupOk === "merge") trip = RB.mergeDup(dm, trip);
      }
      if (trip.endDate && trip.endDate <= M.today()) trip.done = true;
      saving = true; $("#tsave").disabled = true;
      if (newPhoto) jobs.push(A_.put("photos", { id: photoId, dataUrl: newPhoto }));
      A_.clearPhotos();
      var changedIds = M.applyTripMark(trip, st.kids) || [];
      st.kids.forEach(function (x) { if (trip.kidIds.indexOf(x.id) >= 0 && changedIds.indexOf(x.id) >= 0) { x.updatedAt = new Date().toISOString(); jobs.push(A_.saveKid(x)); } });
      jobs.push(A_.put("trips", trip));
      st.trips = st.trips.filter(function (x) { return x.id !== trip.id; }).concat([trip]);
      var first = trip.route[0];
      if (!old && first && saveHome && $("#thome") && $("#thome").checked) { jobs.push(A_.setMeta("home", first.name)); if (T.hasLoc(first)) jobs.push(A_.setMeta("homePoint", T.cleanPoint(first, true))); }
      var fresh = newStamps(before, ids);
      Promise.all(jobs).then(function () {
        if (!old && RB && RB.clearDraft) RB.clearDraft();
        if (mailId) mailCall("booking_inbox_mark", { p_id: mailId, p_status: "used" }).catch(function () {});
        location.hash = "#/p/" + (trip.kidIds.indexOf(k.id) >= 0 ? k.id : trip.kidIds[0]) + "/trip/" + trip.id;
        A_.toast(reviewing ? M.tripLabel(trip) + " reviewed ✓" : dupOk === "merge" ? "Added to " + M.tripLabel(trip) : old ? "Trip saved" : "Trip added!");
        if (fresh.length) setTimeout(function () { celebrate(fresh); }, 350);
      }).catch(function () { saving = false; $("#tsave").disabled = false; err.textContent = "Couldn't save. Is the device out of space?"; err.hidden = false; });
    };
    if (!old && !fromWish && RB && RB.watchDraft) RB.watchDraft(k.id, function () {
      var x = copy(d); delete x.photoId;
      x.kidIds = kidIds(); x.date = $("#tdate") ? $("#tdate").value : d.date; x.endDate = end.value; x.nights = $("#tnights").value === "" ? null : +$("#tnights").value;
      x.title = $("#ttitle").value; x.who = $("#twho").value; x.memory = $("#tmem").value; x.roundTrip = $("#tround").checked; x.done = done.checked; x.memories = memVals(); x.fly = fly;
      return x;
    }, function () { return !saving; });
    var del = $("#tdel");
    if (del) del.onclick = function () {
      var name = M.tripLabel(old);
      // v68: no confirm dialog. The trip goes to Recently deleted, with an Undo bar right away.
      A_.trashTrip(old).then(function () {
        location.hash = "#/p/" + k.id + "/trips";
        var undo = function () { A_.restoreTrip(old.id).then(function () { A_.toast(name + " is back"); A_.route(); }); };
        if (window.FS_WHO && window.FS_WHO.undoToast) window.FS_WHO.undoToast(name + " moved to Recently deleted", undo); else A_.toast("Trip moved to Recently deleted");
      });
    };
  }
  function unitToggle() {
    return '<span class="units seg sm" role="group" aria-label="Units"><button type="button" data-units="mi" aria-pressed="' + (units() === "mi") + '">mi</button><button type="button" data-units="km" aria-pressed="' + (units() === "km") + '">km</button></span>';
  }
  function bindUnits(root, again) { $$("[data-units]", root).forEach(function (b) { b.onclick = function () { A().setMeta("units", b.dataset.units).then(again); }; }); }

  // ---------- trip page ----------
  function order(t) { return (t.date || "9999") + (t.createdAt || ""); }
  function group(list, key) {   // [{who, ...}] with the same key -> one entry with the names joined
    var by = {}, out = [];
    list.forEach(function (x) { var k = key(x); if (by[k]) by[k].names.push(x.who); else { by[k] = Object.assign({}, x, { names: [x.who] }); out.push(by[k]); } });
    return out.map(function (x) { x.who = M.joinNames(x.names); return x; });
  }
  /** Countries, UK nations and parks this trip was someone's first time in. */
  function firstsFor(t) {
    var out = [], mine = T.areas(t, M.PARK_STATES).filter(function (a) { return a.kind !== "state"; });
    people(t.kidIds).forEach(function (p) {
      var seen = {};
      S().trips.forEach(function (o) { if (o.id !== t.id && o.kidIds.indexOf(p.id) >= 0 && order(o) < order(t)) T.areas(o, M.PARK_STATES).forEach(function (a) { seen[a.kind + a.id] = 1; }); });
      (p.stamps || []).forEach(function (s) { if (s.date && t.date && s.date < t.date) seen[s.kind + s.area] = 1; });
      mine.forEach(function (a) {
        if (seen[a.kind + a.id]) return;
        var v = (a.kind === "park" ? p.parks : p.places) || {}; v = v[a.id];
        if (v && v.at && t.date && v.at < t.date) return;
        out.push({ who: M.who(p), what: a.kind === "park" ? (PARK_BY[a.id] ? PARK_BY[a.id].full : parkName(a.id)) : areaName("place", a.id), kind: a.kind === "park" ? "park" : "country" });
      });
    });
    return group(out, function (x) { return x.what; });
  }
  /** Miles badges this trip earned (1,000 miles, first flight...). */
  function badgesFor(t) {
    var out = [];
    people(t.kidIds).forEach(function (p) {
      var before = S().trips.filter(function (o) { return o.id !== t.id && o.kidIds.indexOf(p.id) >= 0 && order(o) < order(t); });
      var a = T.lifetime(null, before), b = T.lifetime(null, before.concat([t]));
      M.BADGES.forEach(function (bd) { if (["miles", "flights", "flightMiles", "bigRoad"].indexOf(bd.key) >= 0 && a[bd.key] < bd.need && b[bd.key] >= bd.need) out.push({ who: M.who(p), name: bd.name }); });
    });
    return group(out, function (x) { return x.name; });
  }
  function storyCtx(t, viewer) {
    return { travelers: people(t.kidIds), units: units(), allowAdult: T.showAdult(t, S().kids, viewer, !!S().meta.adultInKid),
             firsts: firstsFor(t), badges: badgesFor(t), familyName: S().meta.familyName || "", wx: wxNotes(t) };
  }
  function storyText(t, viewer, style, seed) { return T.makeStory(t, storyCtx(t, viewer), { style: style, seed: seed }).text; }
  function canStory(t) { return !!(t.done || (t.endDate && t.endDate <= M.today())); }
  function saveTrip(t) { T.fitSize(t); t.updatedAt = new Date().toISOString(); return A().put("trips", t); }

  function detail(k, tid) {
    var A_ = A(), t = tripById(tid);
    if (!t) { location.hash = "#/p/" + k.id + "/trips"; return; }
    stopSpeech();
    var s = T.summary(t), allow = T.showAdult(t, S().kids, k, !!S().meta.adultInKid), favs = T.visibleFavs(t, S().kids, k, !!S().meta.adultInKid);
    var grownTrip = adultOn(t.kidIds), hiddenAdult = grownTrip && !allow && (t.favs || []).some(function (f) { return T.FAV[f.cat].adult; });
    document.title = t.place + " · Famstamp";
    var nightsTxt = s.nights != null ? s.nights + (s.nights === 1 ? " night" : " nights") : "";
    var html = '<a class="back" href="#/p/' + esc(k.id) + '/trips">← All trips</a><article class="scrap">' +
      '<header class="scraphead">' + (t.photoId ? '<img class="polaroid" alt="" data-photo="' + esc(t.photoId) + '">' : "") +
      '<div><h2 class="ttl">' + esc(t.place) + '</h2><p class="when">' + esc([dateRange(t), nightsTxt].filter(Boolean).join(" · ")) + '</p>' +
      '<div class="travelers"><span class="dots">' + A_.avatars(t.kidIds) + '</span><span>' + esc(A_.travelerNames(t.kidIds)) + (t.who ? ", plus " + esc(t.who) : "") + '</span></div></div></header>' +
      (s.legs.length ? '<p class="routeline">' + t.route.map(function (p) { return esc(p.name); }).join(' <span aria-hidden="true">→</span> ') + (t.roundTrip ? ' <span aria-hidden="true">→</span> home' : "") +
        ' · <b>' + (s.milesKnown ? "" : "at least ") + esc(dist(s.miles, true)) + '</b> ' + unitToggle() + '</p>' : "") +
      (T.routeMap(t) ? '<div class="mapbox routebox">' + routeSVG(t) + '</div>' : (s.legs.length ? '<p class="hint">Find each stop on the map (Edit) to see the route drawn here.</p>' : "")) +
      '<h3 class="sec">Trip stats</h3><div class="tstats">' + tstat("🧭", dist(s.miles), s.milesKnown || !s.legs.length ? "traveled" : "so far") +
      (s.flights ? tstat("✈️", s.flights, s.flights === 1 ? "flight" : "flights") + (s.flightMiles ? tstat("🛫", dist(s.flightMiles), "flown") : "") + (s.airMin ? tstat("⏱️", "~" + T.fmtAir(s.airMin), "in the air") : "") : "") + (s.roadMiles ? tstat("🚗", dist(s.roadMiles), "on the road") : "") +
      (s.nights != null ? tstat("🌙", s.nights, s.nights === 1 ? "night" : "nights") : "") + (s.cities.length ? tstat("🏙️", s.cities.length, s.cities.length === 1 ? "town or city" : "towns & cities") : "") +
      (s.parks.length ? tstat("🌲", s.parks.length, s.parks.length === 1 ? "national park" : "national parks") : "") + (s.states.length ? tstat("🇺🇸", s.states.length, s.states.length === 1 ? "state" : "states") : "") +
      (s.countries.length ? tstat("🌍", s.countries.length, s.countries.length === 1 ? "country" : "countries") : "") + (s.ukNations.length ? tstat("🇬🇧", s.ukNations.length, "UK " + (s.ukNations.length === 1 ? "nation" : "nations")) : "") + '</div>' +
      (s.legs.length ? '<h3 class="sec">The way we went</h3><ol class="legs">' + s.legs.map(function (L) {
        var how = L.how === "manual" ? "real miles" : L.how === "flight" ? "flying distance" : L.how === "about" ? "about" : "";
        var gnd = [L.toAp ? "~" + dist(L.toAp) + " by car to " + (L.dep ? L.dep.code : "the airport") : "", L.fromAp ? "~" + dist(L.fromAp) + " by car from " + (L.arr ? L.arr.code : "the airport") : ""].filter(Boolean);
        return '<li><span class="lic" aria-hidden="true">' + modeIc(L.mode) + '</span><div><b>' + esc(L.from) + ' → ' + esc(L.home ? L.to + " (home)" : L.to) + '</b><span>' + esc([MODE_LABEL[L.mode], L.dep && L.arr ? L.dep.code + " → " + L.arr.code : "", how, L.air ? "about " + T.fmtAir(L.air) + " in the air" : ""].filter(Boolean).join(" · ")) + '</span>' +
          (gnd.length ? '<span class="gnd">🚗 ' + esc(gnd.join(" · ")) + '</span>' : "") + '</div>' +
          '<b class="lmi">' + (L.how === "about" ? "~" : "") + esc(dist(L.miles)) + '</b></li>'; }).join("") + '</ol>' : "") +
      seenBlock(t, s) + weatherBlock(t) +
      ((t.stays || []).length ? '<h3 class="sec">Where we stayed</h3><div class="cards">' + t.stays.map(function (x) {
        var ty = T.STAY_TYPES.filter(function (y) { return y.id === x.type; })[0] || T.STAY_TYPES[0];
        return '<div class="card stay"><span class="cic" aria-hidden="true">' + ty.ic + '</span><div><b>' + esc(x.name) + '</b><span class="meta">' + esc([ty.label, x.where, x.nights ? x.nights + (x.nights === 1 ? " night" : " nights") : ""].filter(Boolean).join(" · ")) + '</span>' + stars(x.rating) + (x.note ? '<p>' + esc(x.note) + '</p>' : "") + '</div></div>'; }).join("") + '</div>' : "") +
      favBlock(favs.filter(function (f) { return !T.FAV[f.cat].adult; }), "Favorites", "") +
      favBlock(favs.filter(function (f) { return T.FAV[f.cat].adult; }), "🍻 For the grown-ups", " adultbox") +
      (hiddenAdult ? '<p class="small muted adultnote">The grown-ups\' picks (pub, pint, coffee) are hidden on kids\' pages. <button type="button" class="linkbtn sm" data-adultkid="1">Show them here too</button></p>' : "") +
      (grownTrip && !T.isAdult(k) && S().meta.adultInKid && (t.favs || []).some(function (f) { return T.FAV[f.cat].adult; }) ? '<p class="small muted adultnote"><button type="button" class="linkbtn sm" data-adultkid="0">Hide grown-up picks on kids\' pages</button></p>' : "") +
      (window.FS_HL ? window.FS_HL.tripLine(t) : "") + (window.FS_TRIPX || []).map(function (x) { try { return x.html(k, t) || ""; } catch (e) { return ""; } }).join("") + momentsBlock(t) + (window.FS_SPOTS ? window.FS_SPOTS.tripHTML(k, t) : "") + storyBlock(t) +
      '<div class="actions noprint"><a class="btn btn-primary" href="#/p/' + esc(k.id) + '/trips/edit/' + esc(t.id) + '">Edit trip</a><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/passport">🛂 Passport</a></div>' + syncExtra(t) + '</article>';
    A_.main.innerHTML = A_.shell(k, "trips", html);
    A_.fillPhotos();
    bindUnits(A_.main, function () { detail(k, tid); });
    if (window.FS_HL) window.FS_HL.refresh();
    (window.FS_TRIPX || []).forEach(function (x) { if (x.bind) try { x.bind(k, t, A_.main); } catch (e) {} });
    if (window.FS_SPOTS) window.FS_SPOTS.bindTrip(k, t, A_.main, function () { var y = window.scrollY; detail(k, tid); window.scrollTo(0, y); });
    $$("[data-adultkid]").forEach(function (b) { b.onclick = function () { A_.setMeta("adultInKid", b.dataset.adultkid === "1").then(function () { detail(k, tid); }); }; });
    var storyRender = bindStory(k, t);
    bindWeather(k, t, function () { if (storyRender && !(t.story && t.story.edited)) storyRender(); });
  }
  function tstat(ic, v, label) { return '<div class="tstat"><span aria-hidden="true">' + ic + '</span><b>' + esc(String(v)) + '</b><small>' + esc(label) + '</small></div>'; }
  function seenBlock(t, s) {
    var chips = [];
    s.cities.forEach(function (c) { chips.push(["🏙️", c]); });
    s.parks.forEach(function (p) { chips.push(["🌲", PARK_BY[p] ? parkName(p) : p]); });
    s.states.forEach(function (x) { chips.push(["📍", areaName("state", x)]); });
    s.ukNations.forEach(function (x) { chips.push([P.flag("place", x) || "🇬🇧", areaName("place", x)]); });
    s.countries.forEach(function (x) { if (x !== "GBR" || !s.ukNations.length) chips.push([P.flag("place", x) || "🌍", areaName("place", x)]); });
    return chips.length ? '<h3 class="sec">What we saw</h3><div class="seen">' + chips.map(function (c) { return '<span class="seenchip"><span aria-hidden="true">' + c[0] + '</span> ' + esc(c[1]) + '</span>'; }).join("") + '</div>' : "";
  }
  function favBlock(list, title, cls) {
    if (!list.length) return "";
    return '<div class="favs' + cls + '"><h3 class="sec">' + esc(title) + '</h3><div class="cards">' + list.map(function (f) {
      var c = T.FAV[f.cat];
      return '<div class="card fav"><span class="cic" aria-hidden="true">' + c.ic + '</span><div><span class="meta up">' + esc(c.label) + '</span><b>' + esc(f.name) + '</b>' + (f.where ? '<span class="meta">' + esc(f.where) + '</span>' : "") + stars(f.rating) + (f.note ? '<p>' + esc(f.note) + '</p>' : "") + '</div></div>';
    }).join("") + '</div></div>';
  }
  function memoriesHTML(t) {
    var m = t.memories || {}, rows = T.MEM_PROMPTS.filter(function (p) { return m[p[0]]; });
    if (!rows.length && !t.memory) return "";
    return '<div class="tripmem">' + (t.memory ? '<div class="tmnote"><span class="tmq">📝 Notes</span><p>' + esc(t.memory) + '</p></div>' : "") +
      rows.map(function (p) { return '<div class="tmrow"><span class="tmq">' + p[2] + ' ' + esc(p[1]) + '</span><p>' + esc(m[p[0]]) + '</p></div>'; }).join("") + '</div>';
  }
  function momentsBlock(t) {
    var A_ = A(), m = t.moments || {}, list = people(t.kidIds).filter(function (p) { return m[p.id]; }), mem = memoriesHTML(t);
    if (!list.length && !mem) return "";
    return '<h3 class="sec">Trip memories</h3>' + mem + (!list.length ? "" : '<div class="moments">' + list.map(function (p) {
      return '<blockquote style="' + A_.kidStyle(p) + '"><p>“' + esc(m[p.id]) + '”</p><cite><span class="dotp" aria-hidden="true">' + A_.initial(p) + '</span> ' + esc(M.who(p)) + '</cite></blockquote>'; }).join("") +
      '</div>');
  }

  // ---------- weather, day by day (v1.7) ----------
  var WX = window.WK_WX;
  function tempUnit() { var m = S().meta.tempUnit; return m === "C" || m === "F" ? m : units() === "km" ? "C" : "F"; }
  function wxStore() { try { return window.localStorage; } catch (e) { return null; } }
  function wxDays(t) { return WX ? WX.build(t, WX.cached(t, M.today(), wxStore()), M.today()) : []; }
  function wxNotes(t) { return WX ? WX.storyNotes(wxDays(t), 2) : []; }
  var WXFMT = null, WXD = {};   // one formatter, cached labels: toLocaleDateString builds a new Intl formatter per call (slow on phones)
  function wxDate(d) { if (WXD[d]) return WXD[d]; var x = new Date(d + "T12:00:00"); WXFMT = WXFMT || (window.Intl ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }) : null); return (WXD[d] = WXFMT ? WXFMT.format(x) : x.toDateString()); }
  var WX_TAG = { manual: "Your pick", past: "Real weather", forecast: "Forecast", typical: "Typical" };
  function wxStop(s, unit) {
    if (!s.kind) return '<span class="wxstop none"><b>' + esc(s.name) + '</b> <span class="muted">' + (navigator.onLine === false ? "offline" : "no data yet") + '</span></span>';
    var hi = WX.fmtT(s.hi, unit), lo = WX.fmtT(s.lo, unit), rain = "";
    if (s.src === "past" && typeof s.mm === "number") rain = s.mm < 0.2 ? "dry" : unit === "F" ? (s.mm / 25.4).toFixed(2).replace(/^0/, "") + " in" : (Math.round(s.mm * 10) / 10) + " mm";
    else if (typeof s.pop === "number") rain = Math.round(s.pop) + "%";
    return '<span class="wxstop"><span class="wxic" aria-hidden="true">' + s.ic + '</span><span class="wxname"><b>' + esc(s.name) + '</b> <span class="sr">' + esc(WX.KIND[s.kind].label) + '</span></span>' +
      (hi || lo ? '<span class="wxt">' + esc(hi) + (lo ? ' <span class="muted">/ ' + esc(lo) + '</span>' : "") + '</span>' : "") +
      (rain ? '<span class="wxr" title="' + (s.src === "past" ? "Rain that fell" : "Chance of rain") + '">💧 ' + esc(rain) + '</span>' : "") + '</span>';
  }
  function wxRowsHTML(t, days) {
    var unit = tempUnit();
    return days.map(function (d) {
      var src = d.manual ? "manual" : (d.stops.filter(function (s) { return s.src; })[0] || {}).src || "";
      return '<li class="wxday' + (d.manual ? " manual" : "") + '" data-wxday="' + d.date + '"><span class="wxdate">' + esc(wxDate(d.date)) + '</span>' +
        '<span class="wxstops">' + d.stops.map(function (s) { return wxStop(s, unit); }).join("") + '</span>' +
        '<span class="wxside">' + (src ? '<span class="wxtag ' + src + '">' + WX_TAG[src] + '</span>' : "") +
        (d.manual ? '<button type="button" class="linkbtn sm" data-wxreal="' + d.date + '">Use real weather</button>' : "") +
        '<button type="button" class="linkbtn sm wxedit" data-wxpick="' + d.date + '" aria-label="Pick the weather for ' + esc(wxDate(d.date)) + '">✏️ Pick</button></span></li>';
    }).join("");
  }
  function weatherBlock(t) {
    if (!WX) return "";
    var days = wxDays(t); if (!days.length) return "";
    var typ = days.some(function (d) { return d.src === "typical"; }), unit = tempUnit();
    return '<section class="wxsec" id="wxsec"><h3 class="sec">🌦️ Weather, day by day <span class="units seg sm" role="group" aria-label="Temperature"><button type="button" data-tunit="F" aria-pressed="' + (unit === "F") + '">°F</button><button type="button" data-tunit="C" aria-pressed="' + (unit === "C") + '">°C</button></span></h3>' +
      '<ol class="wxdays" id="wxdays">' + wxRowsHTML(t, days) + '</ol>' +
      '<p class="small muted wxnote">' + (typ ? '“Typical” days are too far ahead for a forecast: they show the same dates averaged over the last ' + WX.TYPICAL_YEARS + ' years. ' : "") +
      'Tap ✏️ Pick to choose a day\'s weather yourself. Weather data: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (only each stop\'s location and the dates are sent).</p></section>';
  }
  function wxPicker(t, date) {
    var m = (t.wx || {})[date] || {}, unit = tempUnit(), tv = typeof m.t === "number" ? Math.round(unit === "C" ? WX.toC(m.t) : m.t) : "";
    return '<li class="wxpick" id="wxpick" data-for="' + date + '"><div class="wxpickh"><b>Weather on ' + esc(wxDate(date)) + '</b></div>' +
      '<div class="chips wxkinds" role="group" aria-label="Weather">' + WX.KINDS.map(function (k) { return '<button type="button" class="chip" data-wxk="' + k.id + '" aria-pressed="' + (m.k === k.id) + '"><span aria-hidden="true">' + k.ic + '</span> ' + esc(k.label) + '</button>'; }).join("") + '</div>' +
      '<label class="wxtemp">Temperature <small class="muted">(optional)</small> <input type="number" inputmode="numeric" id="wxtemp" min="-60" max="140" step="1" value="' + tv + '" aria-label="Temperature in degrees ' + (unit === "C" ? "Celsius" : "Fahrenheit") + '"> °' + unit + '</label>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="wxdone">Done</button>' + (m.k ? '<button type="button" class="btn btn-ghost" data-wxreal="' + date + '">Use real weather</button>' : "") + '</div></li>';
  }
  /** Wire the weather section on a trip page; onChange runs when the story-worthy weather changes. */
  function bindWeather(k, t, onChange) {
    var sec = $("#wxsec"); if (!sec || !WX) return;
    var open = null, notes = JSON.stringify(wxNotes(t));
    function paint() {
      var list = $("#wxdays"); if (!list) return;
      list.innerHTML = wxRowsHTML(t, wxDays(t));
      if (open) { var row = $('[data-wxday="' + open + '"]', list); if (row) row.insertAdjacentHTML("afterend", wxPicker(t, open)); }
      var n = JSON.stringify(wxNotes(t)); if (n !== notes) { notes = n; if (onChange) onChange(); }
    }
    function setPick(date, kind, temp) {
      var wx = Object.assign({}, t.wx || {});
      if (!kind) delete wx[date]; else { var e = { k: kind }; if (typeof temp === "number" && isFinite(temp)) e.t = temp; wx[date] = e; }
      t.wx = WX.cleanWx(wx); saveTrip(t); paint();
    }
    function tempF() { var el = $("#wxtemp"); if (!el || el.value === "") return null; var v = +el.value; return isFinite(v) ? (tempUnit() === "C" ? v * 9 / 5 + 32 : v) : null; }
    sec.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.tunit) { A().setMeta("tempUnit", b.dataset.tunit).then(function () { $$("[data-tunit]", sec).forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.tunit === tempUnit()); }); paint(); }); }
      else if (b.dataset.wxpick) { open = open === b.dataset.wxpick ? null : b.dataset.wxpick; paint(); var f = $("#wxpick [data-wxk]"); if (f) f.focus(); }
      else if (b.dataset.wxk) { setPick(open, b.dataset.wxk, tempF()); var again = $('#wxpick [data-wxk="' + b.dataset.wxk + '"]'); if (again) again.focus(); }
      else if (b.dataset.wxreal) { var d = b.dataset.wxreal; open = null; setPick(d, null); A().toast("Back to the real weather"); }
      else if (b.id === "wxdone") { open = null; paint(); }
    });
    sec.addEventListener("change", function (e) { if (e.target.id === "wxtemp" && open) { var m = (t.wx || {})[open]; if (m) setPick(open, m.k, tempF()); } });
    // fetch what's missing; a forecast refreshes after a few hours; offline / API down = quietly keep what's saved
    // started after the page has painted, never awaited; results are cached per trip in localStorage
    setTimeout(function () { if (!document.body.contains(sec)) return;
      WX.load(t, M.today(), { store: wxStore(), fetch: window.fetch ? function (u) { return fetchT(u, 9000); } : null, offline: navigator.onLine === false })
        .then(function (r) { if (r.fetched && document.body.contains(sec)) paint(); }).catch(function () {}); }, 0);
  }
  function fetchT(u, ms) {
    var ac = window.AbortController ? new AbortController() : null, tm = ac ? setTimeout(function () { ac.abort(); }, ms) : 0;
    return fetch(u, ac ? { signal: ac.signal } : undefined).then(function (r) { clearTimeout(tm); return r; }, function (e) { clearTimeout(tm); throw e; });
  }

  // ---------- the story ----------
  function storyBlock(t) {
    if (!canStory(t)) return '<section class="panel story locked"><h3>📖 Our story</h3><p class="muted small">When you\'re home, Famstamp can tell this trip\'s story and read it out loud.</p>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" id="markdone">We\'re home: tell our story</button></div></section>';
    return '<section class="panel story" id="story"><h3>📖 Our story</h3>' +
      '<div class="seg" role="group" aria-label="Story style"><button type="button" data-style="storybook">Storybook</button><button type="button" data-style="journal">Family journal</button></div>' +
      '<div class="slides" id="slides" aria-hidden="true"></div>' +
      '<div class="storytext" id="stext"></div><div id="sedit" hidden><textarea id="stextarea" maxlength="3000" aria-label="Edit the story"></textarea>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="ssave">Save my version</button><button type="button" class="btn btn-ghost" id="scancel">Cancel</button></div></div>' +
      '<div class="player" id="player"><button type="button" class="btn btn-beacon" id="splay">▶ Read it to us</button><button type="button" class="btn btn-ghost" id="spause" hidden>⏸ Pause</button><button type="button" class="btn btn-ghost" id="sstop" hidden>⏹ Stop</button></div>' +
      '<div class="voicebar" id="voicebar"><label>Voice <select id="svoice"></select></label><label>Speed <select id="srate">' + [["0.8", "Slow"], ["0.9", "Easy"], ["1", "Normal"], ["1.15", "Quick"]].map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join("") + '</select></label></div>' +
      '<p class="small muted" id="snospeech" hidden>Read-aloud isn\'t available in this browser, but the story is all here to read.</p>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" id="sshuffle">🔀 Shuffle</button><button type="button" class="btn btn-ghost" id="sedit-b">✏️ Edit</button><button type="button" class="btn btn-ghost" id="sshare">📤 Share story</button></div>' +
      '<p class="small muted" id="sedited" hidden>You edited this story. <button type="button" class="linkbtn sm" id="sreset">Go back to Famstamp\'s version</button></p></section>';
  }
  var SP = { on: false, i: 0, list: [], u: null, slides: 0 };
  function synth() { return window.speechSynthesis || null; }
  function stopSpeech() { SP.on = false; SP.u = null; var s = synth(); if (s) try { s.cancel(); } catch (e) {} }
  window.addEventListener("hashchange", stopSpeech);
  function enVoices() { var s = synth(); return s ? s.getVoices().filter(function (v) { return /^en(-|_|$)/i.test(v.lang); }) : []; }
  function bestVoice() {
    var vs = enVoices(), want = S().meta.voice, hit = vs.filter(function (v) { return v.name === want; })[0];
    if (hit) return hit;
    function score(v) { return (/en[-_](GB|US)/i.test(v.lang) ? 2 : 0) + (/natural|neural|enhanced|premium|google|siri|samantha|daniel|serena|aria|jenny|libby/i.test(v.name) ? 3 : 0) + (v.localService ? 0.5 : 0); }
    return vs.slice().sort(function (a, b) { return score(b) - score(a); })[0] || null;
  }
  function bindStory(k, t) {
    var A_ = A(), md = $("#markdone");
    if (md) { md.onclick = function () { t.done = true; saveTrip(t).then(function () { detail(k, t.id); setTimeout(function () { var el = $("#story"); if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); }, 50); }); }; return; }
    if (!$("#story")) return;
    var story = t.story || null, style = story ? story.style : (M.isKid(k) ? "storybook" : "storybook"), seed = story ? story.seed : 0;
    function current() { return story && story.edited && story.style === style ? story.text : storyText(t, k, style, seed); }
    function persist(text, edited) {
      var next = T.cleanStory({ text: text, style: style, seed: seed, edited: edited, at: new Date().toISOString() });
      if (story && next && story.text === next.text && story.style === next.style && story.edited === next.edited) return;
      t.story = story = next; saveTrip(t);
    }
    // Only a first story or a tap (style, shuffle, reset) is saved. Re-renders on open, a sync or fresh weather never write:
    // two phones with different weather caches used to keep re-saving each other's story, re-rendering the trip on every sync.
    function render(user) {
      stopSpeech(); showPlayer(false);
      var text = current();
      if (!story || (user === true && !story.edited)) persist(text, false);
      SP.list = T.splitSentences(text); SP.i = 0;
      $("#stext").innerHTML = SP.list.map(function (x, i) { return '<span class="sn" data-s="' + i + '">' + esc(x) + '</span>'; }).join(" ");
      $$("[data-style]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.style === style); });
      $("#sedited").hidden = !(story && story.edited);
      $$(".sn").forEach(function (el) { el.onclick = function () { if (synth()) speakFrom(+el.dataset.s); }; });
    }
    // slideshow: the trip photo, the route map and a few stat cards, crossfading with the sentences
    var s = T.summary(t), slides = [];
    if (t.photoId) slides.push('<div class="slide photo"><img alt="" data-photo="' + esc(t.photoId) + '"></div>');
    if (T.routeMap(t)) slides.push('<div class="slide map"><div class="mapbox routebox">' + routeSVG(t) + '</div></div>');
    if (s.miles) slides.push(card("🧭", dist(s.miles, true), M.routeText(t)));
    if (s.nights) slides.push(card("🌙", s.nights + (s.nights === 1 ? " night" : " nights"), dateRange(t)));
    var seenN = s.cities.length + s.parks.length;
    if (seenN) slides.push(card(s.parks.length ? "🌲" : "🏙️", seenN + (seenN === 1 ? " place" : " places"), s.cities.concat(s.parks.map(parkName)).slice(0, 6).join(" · ")));
    if (!slides.length) slides.push(card("📖", t.place, dateRange(t)));
    $("#slides").innerHTML = slides.map(function (h, i) { return h.replace('class="slide', 'class="slide' + (i === 0 ? " on" : "")); }).join("");
    SP.slides = slides.length; A_.fillPhotos();
    function card(ic, big, small) { return '<div class="slide card"><span aria-hidden="true">' + ic + '</span><b>' + esc(big) + '</b><small>' + esc(small || "") + '</small></div>'; }

    $$("[data-style]").forEach(function (b) { b.onclick = function () {
      if (b.dataset.style === style) return;
      if (story && story.edited && !confirm("Switch styles? Your edits to this story will be replaced.")) return;
      style = b.dataset.style; if (story) story.edited = false; render(true); }; });
    $("#sshuffle").onclick = function () {
      if (story && story.edited && !confirm("Shuffle the story? Your edits will be replaced.")) return;
      seed = (seed + 1 + Math.floor(Math.random() * 997)) % 1e9; if (story) story.edited = false; render(true); };
    $("#sedit-b").onclick = function () { stopSpeech(); showPlayer(false); $("#stextarea").value = current(); $("#sedit").hidden = false; $("#stext").hidden = true; $("#stextarea").focus(); };
    $("#scancel").onclick = function () { $("#sedit").hidden = true; $("#stext").hidden = false; };
    $("#ssave").onclick = function () { var v = $("#stextarea").value.trim(); if (!v) return A_.toast("The story can't be empty"); story = story || {}; persist(v, true); $("#sedit").hidden = true; $("#stext").hidden = false; render(); A_.toast("Story saved"); };
    $("#sreset").onclick = function () { if (story) story.edited = false; render(true); };
    $("#sshare").onclick = function () { shareStory(t, current()); };
    // read aloud
    var sy = synth();
    if (!sy || typeof window.SpeechSynthesisUtterance !== "function") { $("#player").hidden = true; $("#voicebar").hidden = true; $("#snospeech").hidden = false; }
    else {
      var fillVoices = function () {
        var vs = enVoices(), best = bestVoice(), sel = $("#svoice"); if (!sel) return;
        sel.innerHTML = vs.length ? vs.map(function (v) { return '<option value="' + esc(v.name) + '"' + (best && v.name === best.name ? " selected" : "") + '>' + esc(v.name.replace(/^(Microsoft|Google) /, "") + " (" + v.lang + ")") + '</option>'; }).join("") : '<option value="">Default voice</option>';
      };
      fillVoices(); sy.onvoiceschanged = fillVoices;
      $("#svoice").onchange = function () { A_.setMeta("voice", this.value); };
      $("#srate").value = String(S().meta.rate || 1); if (!$("#srate").value) $("#srate").value = "1";
      $("#srate").onchange = function () { A_.setMeta("rate", +this.value); };
      $("#splay").onclick = function () { speakFrom(SP.i >= SP.list.length ? 0 : SP.i); };
      $("#spause").onclick = function () { SP.on = false; SP.u = null; sy.cancel(); showPlayer(false, true); };
      $("#sstop").onclick = function () { stopSpeech(); SP.i = 0; highlight(-1); showPlayer(false); };
    }
    render();
    return render;
  }
  function showPlayer(playing, paused) {
    var p = $("#splay"); if (!p) return;
    p.hidden = playing; p.textContent = paused ? "▶ Keep going" : "▶ Read it to us";
    $("#spause").hidden = !playing; $("#sstop").hidden = !playing && !paused;
  }
  function highlight(i) {
    $$(".sn").forEach(function (el) { el.classList.toggle("now", +el.dataset.s === i); });
    var el = $('.sn[data-s="' + i + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    if (i >= 0 && SP.slides > 1) { var n = Math.floor(i / 2) % SP.slides; $$("#slides .slide").forEach(function (s, j) { s.classList.toggle("on", j === n); }); }
  }
  function speakFrom(i) {
    var sy = synth(); if (!sy || !SP.list.length) return;
    sy.cancel(); SP.on = true; SP.i = i; showPlayer(true);
    setTimeout(speakNext, 80);   // Chrome on Android drops a speak() that comes right after cancel()
  }
  function speakNext() {
    var sy = synth(); if (!SP.on || !sy) return;
    if (SP.i >= SP.list.length) { SP.on = false; SP.i = 0; highlight(-1); showPlayer(false); return; }
    var u = new SpeechSynthesisUtterance(SP.list[SP.i]), v = bestVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    u.rate = +(S().meta.rate || 1) || 1;
    u.onend = u.onerror = function () { if (SP.u !== u) return; SP.i++; speakNext(); };
    SP.u = u; highlight(SP.i); sy.speak(u);
  }

  // share: the story as text, plus a picture card of the route and stats when the phone can share files
  function shareStory(t, text) {
    var A_ = A(), title = t.place + ": our Famstamp story", body = text + "\n\nMade with Famstamp";
    storyCard(t).then(function (blob) {
      var data = { title: title, text: body }, file = null;
      try { file = blob && new File([blob], "famstamp-" + M.slug(t.place || "trip") + ".png", { type: "image/png" }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      if (navigator.share) return navigator.share(data).catch(function () {});
      if (navigator.clipboard) navigator.clipboard.writeText(body).catch(function () {});
      if (blob) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file ? file.name : "famstamp-story.png"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
      A_.toast("Story copied, and the picture card is saved");
    });
  }
  function wrap(ctx, text, max) {
    var words = String(text).split(" "), lines = [], line = "";
    words.forEach(function (w) { var tryL = line ? line + " " + w : w; if (ctx.measureText(tryL).width > max && line) { lines.push(line); line = w; } else line = tryL; });
    if (line) lines.push(line); return lines;
  }
  function storyCard(t) {
    return new Promise(function (res) {
      try {
        var W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
        var g = c.getContext("2d"), s = T.summary(t), owner = A().kidById(t.kidIds[0]), color = owner ? owner.color : "#e8a54b";
        g.fillStyle = "#f7f3ea"; g.fillRect(0, 0, W, H);
        g.fillStyle = "#16283a"; g.fillRect(0, 0, W, 150);
        g.fillStyle = "#e8a54b"; g.font = "700 54px Georgia, serif"; g.fillText("Famstamp", 70, 98);
        g.fillStyle = "#c9d5e2"; g.font = "500 30px sans-serif"; g.textAlign = "right"; g.fillText("Stamp every trip", W - 70, 96); g.textAlign = "left";
        g.fillStyle = "#16283a"; g.font = "700 76px Georgia, serif";
        var y = 270; wrap(g, t.place, W - 140).slice(0, 2).forEach(function (l) { g.fillText(l, 70, y); y += 86; });
        g.fillStyle = "#5b6b73"; g.font = "500 34px sans-serif"; g.fillText([dateRange(t), A().travelerNames(t.kidIds)].filter(Boolean).join(" · ").slice(0, 60), 70, y); y += 40;
        // route box
        var bx = 70, by = y + 20, bw = W - 140, bh = 560, pts = (t.route || []).filter(T.hasLoc);
        g.fillStyle = "#dfeef2"; g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, 28); else g.rect(bx, by, bw, bh); g.fill();
        if (pts.length > 1) {
          var lat0 = pts.reduce(function (a, p) { return a + p.lat; }, 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
          var xs = pts.map(function (p) { return p.lon * k; }), ys = pts.map(function (p) { return -p.lat; });
          var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs), mny = Math.min.apply(null, ys), mxy = Math.max.apply(null, ys);
          var sc = Math.min((bw - 160) / Math.max(mxx - mnx, 0.01), (bh - 160) / Math.max(mxy - mny, 0.01));
          var ox = bx + bw / 2 - (mnx + mxx) / 2 * sc, oy = by + bh / 2 - (mny + mxy) / 2 * sc;
          var P2 = pts.map(function (p, i) { return [xs[i] * sc + ox, ys[i] * sc + oy]; });
          g.strokeStyle = "#16283a"; g.lineWidth = 7; g.lineCap = "round"; g.setLineDash([]);
          for (var i = 1; i < P2.length; i++) {
            var plane = pts[i].mode === "plane"; g.setLineDash(plane ? [22, 16] : []);
            g.beginPath(); g.moveTo(P2[i - 1][0], P2[i - 1][1]);
            if (plane) { var mx = (P2[i - 1][0] + P2[i][0]) / 2, my = (P2[i - 1][1] + P2[i][1]) / 2, dx = P2[i][0] - P2[i - 1][0], dy = P2[i][1] - P2[i - 1][1]; g.quadraticCurveTo(mx + dy * 0.2, my - dx * 0.2, P2[i][0], P2[i][1]); }
            else g.lineTo(P2[i][0], P2[i][1]);
            g.stroke();
          }
          g.setLineDash([]);
          P2.forEach(function (p, i) { g.fillStyle = i ? color : "#fff"; g.strokeStyle = "#16283a"; g.lineWidth = 5; g.beginPath(); g.arc(p[0], p[1], i ? 20 : 15, 0, 7); g.fill(); g.stroke(); });
          g.fillStyle = "#16283a"; g.font = "600 28px sans-serif";
          P2.forEach(function (p, i) { var nm = pts[i].name.slice(0, 22), w = g.measureText(nm).width, x = Math.min(Math.max(p[0] - w / 2, bx + 16), bx + bw - w - 16); g.fillText(nm, x, p[1] + (p[1] > by + bh - 70 ? -32 : 52)); });
        } else { g.fillStyle = "#3f5f4c"; g.font = "600 40px sans-serif"; g.fillText(M.routeText(t).slice(0, 40), bx + 40, by + bh / 2); }
        y = by + bh + 110;
        g.fillStyle = "#16283a"; g.font = "700 96px Georgia, serif"; g.fillText(dist(s.miles), 70, y);
        g.fillStyle = "#5b6b73"; g.font = "500 34px sans-serif";
        var bits = [s.nights != null ? s.nights + " nights" : "", s.flights ? s.flights + (s.flights === 1 ? " flight" : " flights") : "", s.cities.length + s.parks.length ? (s.cities.length + s.parks.length) + " places" : "", s.countries.length ? s.countries.length + (s.countries.length === 1 ? " country" : " countries") : ""].filter(Boolean);
        g.fillText(bits.join(" · "), 70, y + 60);
        g.fillStyle = color; g.fillRect(0, H - 24, W, 24);
        c.toBlob(function (b) { res(b); }, "image/png");
      } catch (e) { res(null); }
    });
  }

  // ---------- passport ----------
  var CTX = { parkStates: M.PARK_STATES };
  // v81: kids' passports skip drink stamps (distillery, brewery, winery, pub) unless the family turned on grown-up bits on kids' pages
  function sctx() { return Object.assign({}, CTX, { adultInKid: !!S().meta.adultInKid }); }
  // v94: stamps are worked out once per change, not on every tab switch (the passport was the slowest switch on a big family)
  var STAMPMEMO = {};
  function tripsSig() { var t = S().trips, out = t.length + ""; for (var i = 0; i < t.length; i++) out += "|" + t[i].id + (t[i].updatedAt || "") + (t[i].kidIds || []).length + (t[i].stops || []).length; return out; }
  function personSig(p) { return p.id + "|" + (p.updatedAt || "") + "|" + p.birthday + "|" + p.role + "|" + JSON.stringify([p.stamps, p.places, p.states, p.parks, p.sights]); }
  function memo(key, sig, make) { var m = STAMPMEMO[key]; if (m && m.sig === sig) return m.val; var v = make(); STAMPMEMO[key] = { sig: sig, val: v }; return v; }
  function stampsOf(p) { var c = sctx(); return memo("p:" + p.id, tripsSig() + "#" + personSig(p) + "#" + c.adultInKid, function () { return P.stampsFor(p, S().trips, sctx()); }).slice(); }
  function familyStampsMemo() { var c = sctx(); return memo("fam", tripsSig() + "#" + S().kids.map(personSig).join(",") + "#" + c.adultInKid, function () { return P.familyStamps(S().kids, S().trips, c); }).slice(); }
  function stampName(s) { return s.kind === "sight" ? s.name || s.area : s.kind === "park" ? parkName(s.area) : areaName(s.kind, s.area); }
  function stampKeys(ids) { var out = {}; people(ids).forEach(function (p) { stampsOf(p).forEach(function (s) { out[p.id + "|" + s.id] = 1; if (s.kind === "state") out["sign|" + p.id + "|" + s.area] = 1; }); }); return out; }
  function newStamps(before, ids) {
    var seen = {}, out = [];
    people(ids).forEach(function (p) { stampsOf(p).forEach(function (s) { var k = s.kind + ":" + s.area; if (!before[p.id + "|" + s.id] && s.source !== "map" && !seen[k]) { seen[k] = 1; out.push(Object.assign({}, s, { holder: p.id, newSign: s.kind === "state" && !before["sign|" + p.id + "|" + s.area] })); } }); });
    return out.sort(function (a, b) { return (b.newSign ? 1 : 0) - (a.newSign ? 1 : 0); });
  }
  var SECTIONS = [["world", "🌍 Countries"], ["states", "🇺🇸 States"], ["parks", "🌲 Parks"], ["sights", "🏰 Sights"]];
  var psec = "world";
  // v94: the Sights pages can show just the places of worship (mosques, churches, temples, shrines...), or just the other sights
  var pgrp = "all";
  function sightGroup(s) { var SA = window.WK_STAMPART; return SA && SA.typeOf ? (SA.typeOf(s.type).group === "worship" ? "worship" : "other") : "other"; }
  function inSection(s, sec) { return sec === "parks" ? s.kind === "park" : sec === "states" ? s.kind === "state" : sec === "sights" ? s.kind === "sight" : s.kind === "place"; }
  // State stamps can show the state's bird, flower or animal (or a mix). Each person (and the family passport) keeps
  // their own choice on this device, like the State Signs seen list; press and hold one stamp to switch just that one.
  var ART_MODES = [["bird", "🐦 Bird"], ["flower", "🌸 Flower"], ["animal", "🦌 Animal"], ["mix", "🔀 Mix"]];
  function artKey(personId) { var log = "mltl"; try { log = window.MLTL_SYNCCORE.readLogs(localStorage).active || log; } catch (e) {} return "famstamp-stampart:" + log + ":" + (personId || "all"); }
  function readArt(personId) {
    var o = null; try { o = JSON.parse(localStorage.getItem(artKey(personId)) || "null"); } catch (e) {}
    o = o && typeof o === "object" ? o : {}; var ok = function (m) { return m === "bird" || m === "flower" || m === "animal" || m === "mix"; };
    var one = {}; if (o.one && typeof o.one === "object") Object.keys(o.one).forEach(function (id) { if (/^[A-Z]{2}$/.test(id) && ok(o.one[id]) && o.one[id] !== "mix") one[id] = o.one[id]; });
    return { mode: ok(o.mode) ? o.mode : "mix", one: one };
  }
  function writeArt(personId, o) { try { localStorage.setItem(artKey(personId), JSON.stringify(o)); } catch (e) {} }
  var heldAt = 0;   // the lift after a press-and-hold lands on the redrawn stamp: don't open it
  function artFor(personId, area) { var o = readArt(personId); return o.one[area] || o.mode; }
  function symLine(s, personId) {
    var D = s.kind === "state" && P.STATE_SYMBOLS ? P.STATE_SYMBOLS[s.area] : null; if (!D) return "";
    var mode = P.stampArtMode(s.area, artFor(personId, s.area)), x = D[mode];
    return '<p class="small symline">State ' + mode + ': <b>' + esc(x.name) + '</b>' + (x.fallback ? ' <span class="muted">(' + esc(areaName("state", s.area)) + ' has no official state animal, so this shows its bird)</span>' : "") + '</p>';
  }
  function stampSVG(s, personId) {
    return P.stampSVG(s, stampName(s), { art: s.kind === "state" ? artFor(personId, s.area) : "", holder: personId || s.holder || "",
      sub: s.kind === "park" ? M.parkSub(PARK_BY[s.area]) : "" });
  }
  var LAZY_FROM = 2, lazyPages = {}, bookStamps = [];
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }
  /** v94: "12 of 50 states + DC · 9 countries · 3 parks · 14 sights": unique places. */
  function coverLine(c) {
    return [c.states + " of 50 states" + (c.dc ? " + DC" : ""), plural(c.countries, "country", "countries") + (c.nations ? " (+ " + plural(c.nations, "UK nation") + ")" : ""), plural(c.parks, "park"), c.sights ? plural(c.sights, "sight") : ""].filter(Boolean).join(" · ");
  }
  /** v94: "202 state visits · 31 country visits": every visit, repeats included. */
  function visitLine(c) {
    return [c.stateVisits ? plural(c.stateVisits, "state visit") : "", c.countryVisits ? plural(c.countryVisits, "country visit") : "", c.parkVisits ? plural(c.parkVisits, "park visit") : "", c.sightVisits ? plural(c.sightVisits, "sight visit") : ""].filter(Boolean).join(" · ");
  }
  function bookHTML(title, color, stamps, who, pid) {
    // v94: one stamp per place, with how many visits (each visit stays its own record underneath)
    var life = T.lifetime(pid || null, S().trips), pc = P.passportCounts(stamps); stamps = P.groupStamps(stamps);
    var counts = { world: 0, states: 0, parks: 0, sights: 0 }; stamps.forEach(function (s) { counts[s.kind === "park" ? "parks" : s.kind === "state" ? "states" : s.kind === "sight" ? "sights" : "world"]++; });
    bookStamps = stamps; lazyPages = {};
    var all = stamps.filter(function (s) { return inSection(s, psec); }), nWor = psec === "sights" ? all.filter(function (s) { return sightGroup(s) === "worship"; }).length : 0;
    if (psec !== "sights" || !nWor) pgrp = "all";
    var list = pgrp === "all" ? all : all.filter(function (s) { return sightGroup(s) === pgrp; }), pages = P.pages(list, 4);
    var secName = { world: "Countries", states: "Domestic stamps", parks: "National parks", sights: "Sights and places" }[psec]
    if (pgrp === "worship") secName = "Places of worship"; else if (pgrp === "other") secName = "Other sights";
    var art = readArt(pid);
    var html = '<div class="seg" role="group" aria-label="Passport section">' + SECTIONS.map(function (x) { return '<button type="button" data-psec="' + x[0] + '" aria-pressed="' + (psec === x[0]) + '">' + x[1] + ' <small>' + counts[x[0]] + '</small></button>'; }).join("") + '</div>' +
      (psec === "sights" && nWor ? '<div class="seg pgrpseg" role="group" aria-label="Which sights">' + [["all", "All sights", all.length], ["worship", "🕌 Places of worship", nWor], ["other", "🏰 Other sights", all.length - nWor]].map(function (x) {
        return '<button type="button" data-pgrp="' + x[0] + '" aria-pressed="' + (pgrp === x[0]) + '">' + x[1] + ' <small>' + x[2] + '</small></button>'; }).join("") + '</div>' : "") +
      (psec === "states" ? '<div class="seg artseg" role="group" aria-label="State stamp pictures">' + ART_MODES.map(function (x) { return '<button type="button" data-art="' + x[0] + '" aria-pressed="' + (art.mode === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>' +
        '<p class="small muted arthint">Each state stamp shows its state bird, flower or animal. Press and hold a stamp to switch just that one.</p>' : "") +
      '<div class="pbook" style="--pc:' + esc(color) + '"><div class="pages" id="pages" tabindex="0" aria-label="Passport pages. Swipe to turn.">' +
      '<section class="ppage cover"><div class="crest" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="3"/><ellipse cx="50" cy="50" rx="18" ry="40" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M10 50h80M16 30h68M16 70h68" stroke="currentColor" stroke-width="2.5" fill="none"/></svg></div>' +
      '<p class="ptype">PASSPORT</p><h2>' + esc(title) + '</h2><p class="pcount">' + esc(coverLine(pc)) + '</p>' + (pc.visits > pc.places ? '<p class="pvisits">' + esc(visitLine(pc)) + '</p>' : "") +
      (life.flights ? '<p class="pfly">✈️ ' + life.flights + (life.flights === 1 ? " flight" : " flights") + ' · ' + esc(dist(life.flightMiles)) + ' in the air</p>' : "") + '<p class="pswipe">Swipe to open →</p></section>' +
      (pid && A().kidById(pid) ? idPageHTML(A().kidById(pid)) : "") +
      (pages.length ? pages.map(function (pg, n) {
        // v94: only the first pages are drawn now; the rest draw as you swipe to them (a big passport no longer freezes the phone)
        var body = function () { return pg.map(function (c) {
          return '<button type="button" class="stamp" data-sid="' + esc(c.stamp.id) + '" style="left:' + (c.x / 3).toFixed(1) + '%;top:' + (c.y / 4).toFixed(1) + '%;--r:' + c.rot + 'deg" aria-label="' + esc(stampName(c.stamp) + (c.stamp.kind === "state" ? ", " + artFor(pid, c.stamp.area) : "") + (P.fmtDate(c.stamp.date) ? ", " + P.fmtDate(c.stamp.date) : "") + (c.stamp.count > 1 ? ", visited " + c.stamp.count + " times" : "")) + '">' + stampSVG(c.stamp, pid) +
            (c.stamp.count > 1 ? '<span class="vcount" aria-hidden="true">×' + c.stamp.count + '</span>' : "") +
            (who && c.stamp.who.length ? '<span class="dots">' + A().avatars(c.stamp.who) + '</span>' : "") + '</button>';
        }).join(""); };
        if (n >= LAZY_FROM) lazyPages[n] = body;
        return '<section class="ppage"' + (n >= LAZY_FROM ? ' data-lazy="' + n + '"' : "") + '><header><span>' + esc(secName.toUpperCase()) + '</span><span>' + (n + 1) + '</span></header>' + (n >= LAZY_FROM ? "" : body()) + '</section>';
      }).join("") : '<section class="ppage empty"><header><span>' + esc(secName.toUpperCase()) + '</span><span>1</span></header><p>' + esc({ world: "No country stamps yet.", states: "No state stamps yet.", parks: "No national park stamps yet.", sights: "No sight stamps yet." }[psec]) + '<br>' +
        (psec === "sights" ? "Add a castle, a viewpoint, a beach or any sight as a stop on a trip." : psec === "parks" ? "Mark a park on the Parks tab, or add one to a trip." : psec === "states" ? "Color a state on the USA map, or add a trip." : "Color a country on the World map, or add a trip abroad.") + '</p></section>') +
      '</div><div class="pager"><button type="button" class="btn btn-ghost" id="pprev" aria-label="Previous page">‹</button><span id="pgn">Cover</span><button type="button" class="btn btn-ghost" id="pnext" aria-label="Next page">›</button></div></div>';
    // v82: credit the artists of any famous-landmark drawings on these pages (CC0 / CC BY icons from Wikimedia Commons)
    var LM = window.FS_LANDMARKS, seenLm = {}, cr = psec === "sights" && LM ? list.filter(function (s) { return s.ref && LM.has(s.ref) && !seenLm[s.ref] && (seenLm[s.ref] = 1); }).map(function (s) { var c = LM.credit(s.ref); return '<a href="' + esc(c.page) + '" target="_blank" rel="noopener">' + esc(c.name) + '</a> by ' + esc(c.artist || "unknown") + ' (' + esc(c.license) + ')'; }) : [];
    if (cr.length) html += '<p class="small muted lmcredit">Landmark drawings from Wikimedia Commons, traced for stamps: ' + cr.join(" · ") + '</p>';
    return html;
  }
  // v82: the "about me" page right after the cover: name, nickname, favorites and an optional birthday (month + day only, never the year).
  // A pretend passport: it never asks for real passport or ID details. Family members see it (and anyone the family invites to follow).
  function idPageHTML(k) {
    var A_ = A(), d = P.cleanIdPage(k.pp), bd = P.bdayText(d.bday), today = P.isBirthday(d.bday), real = M.realName(k);
    var favs = P.ID_FIELDS.filter(function (f) { return d[f[0]]; }).map(function (f) { return '<div class="idrow"><dt>' + esc(f[1]) + '</dt><dd>' + esc(d[f[0]]) + '</dd></div>'; }).join("");
    return '<section class="ppage idpage"><header><span>ABOUT ME</span><span>✦</span></header>' +
      '<div class="idtop"><span class="dotp idav" style="' + A_.kidStyle(k) + '" aria-hidden="true">' + A_.initial(k) + '</span><div><h3>' + esc(M.who(k)) + '</h3>' +
      (real ? '<p class="small muted">' + esc(real) + '</p>' : "") + (bd ? '<p class="small idbday">🎂 Birthday: ' + esc(bd) + '</p>' : "") + '</div></div>' +
      (today ? '<p class="idhb">🎉 Happy birthday, ' + esc(M.who(k)) + '!</p>' : "") +
      (favs ? '<dl class="idfavs">' + favs + '</dl>' : '<p class="small muted">Favorite snack, dream trip, favorite animal… fill in this page together.</p>') +
      '<button type="button" class="btn btn-ghost idedit" data-idedit>✏️ ' + (favs || bd ? "Edit this page" : "Fill in this page") + '</button>' +
      '<p class="tiny muted idnote">Pretend passport, just for fun. Never put real passport or ID numbers here.</p></section>';
  }
  function idSheet(k, again) {
    var d = P.cleanIdPage(k.pp), mo = d.bday ? +d.bday.slice(0, 2) : 0, dy = d.bday ? +d.bday.slice(3) : 0;
    var AV = window.FS_AVATARS, av = AV && AV.has(k.av) ? k.av : "";
    var html = '<h3>About ' + esc(M.who(k)) + '</h3><p class="small muted">All optional. Shows on the first page of the passport.</p>' +
      (AV ? '<div class="field"><label>Picture</label>' + AV.pickerHTML(av, M.who(k).trim().charAt(0).toUpperCase(), A().kidStyle(k)) + '</div>' : "") +
      P.ID_FIELDS.map(function (f) { return '<div class="field"><label for="id-' + f[0] + '">' + esc(f[1]) + '</label><input id="id-' + f[0] + '" type="text" maxlength="40" autocomplete="off" value="' + esc(d[f[0]] || "") + '" placeholder="' + esc(f[2]) + '" /></div>'; }).join("") +
      '<div class="field"><label for="id-bm">Birthday (month and day only, no year)</label><div class="idbd"><select id="id-bm" aria-label="Birthday month"><option value="">Month</option>' +
      P.MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (mo === i + 1 ? " selected" : "") + '>' + m + '</option>'; }).join("") + '</select>' +
      '<select id="id-bd" aria-label="Birthday day"><option value="">Day</option>' + Array.from({ length: 31 }, function (_, i) { return '<option value="' + (i + 1) + '"' + (dy === i + 1 ? " selected" : "") + '>' + (i + 1) + '</option>'; }).join("") + '</select></div></div>' +
      '<p class="small muted">This is a pretend passport. Never add real passport, ID or document numbers; long numbers are left out.</p><p class="small err" id="iderr" role="alert"></p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="idsave">Save</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>';
    sheet(html);
    if (AV) AV.bindPicker(document.querySelector(".sheetbox") || document, function (id) { av = id; });
    $("#idsave").onclick = function () {
      var o = {}; P.ID_FIELDS.forEach(function (f) { o[f[0]] = $("#id-" + f[0]).value; });
      if (AV) { if (av) k.av = av; else delete k.av; }
      var m = $("#id-bm").value, dd = $("#id-bd").value;
      if (m && dd) { o.bday = m + "-" + dd; if (!P.cleanBday(o.bday)) { $("#iderr").textContent = P.MONTHS[m - 1] + " doesn't have a day " + dd + "."; return; } }
      else if (m || dd) { $("#iderr").textContent = "Pick both the month and the day, or neither."; return; }
      var clean = P.cleanIdPage(o), dropped = P.ID_FIELDS.some(function (f) { return o[f[0]].trim() && !clean[f[0]]; });
      if (Object.keys(clean).length) k.pp = clean; else delete k.pp;
      k.updatedAt = new Date().toISOString();
      A().saveKid(k).then(function () { closeSheet(); again(1); A().toast(dropped ? "Saved (left out something that looked like an ID number)" : "Saved"); });
    };
  }
  function bindBook(again, stamps, owner) {
    $$("[data-psec]").forEach(function (b) { b.onclick = function () { psec = b.dataset.psec; again(1); }; });
    $$("[data-pgrp]").forEach(function (b) { b.onclick = function () { pgrp = b.dataset.pgrp; again(1); }; });
    var pages = $("#pages"), n = $$(".ppage", pages).length, pid = owner ? owner.id : null;
    var ide = $("[data-idedit]"); if (ide && owner) ide.onclick = function () { idSheet(owner, again); };
    function at() { return Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth)); }
    $$("[data-art]").forEach(function (b) { b.onclick = function () { writeArt(pid, { mode: b.dataset.art, one: {} }); again(Math.max(1, at())); var f = $('[data-art="' + b.dataset.art + '"]'); if (f) f.focus(); }; });
    function label() { var i = at(); $("#pgn").textContent = i === 0 ? "Cover" : "Page " + i + " of " + (n - 1); }
    var fillAt = -1;
    function fill() {   // v94: draw the pages near the one showing
      var i = at(); if (i === fillAt) return; fillAt = i;
      $$("[data-lazy]", pages).forEach(function (sec) { var k = +sec.dataset.lazy; if (k <= i + 1 && lazyPages[k]) { var f = lazyPages[k]; delete lazyPages[k]; sec.removeAttribute("data-lazy"); sec.insertAdjacentHTML("beforeend", f()); bindStamps(sec); } });
    }
    pages.addEventListener("scroll", function () { label(); fill(); }, { passive: true });
    $("#pprev").onclick = function () { pages.scrollTo({ left: (at() - 1) * pages.clientWidth, behavior: reduced() ? "auto" : "smooth" }); };
    $("#pnext").onclick = function () { pages.scrollTo({ left: (at() + 1) * pages.clientWidth, behavior: reduced() ? "auto" : "smooth" }); };
    pages.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") $("#pnext").click(); if (e.key === "ArrowLeft") $("#pprev").click(); });
    var byId = {}; (bookStamps.length ? bookStamps : stamps).forEach(function (x) { byId[x.id] = x; });
    function bindStamps(root) { $$(".stamp", root).forEach(function (b) {
      var s = byId[b.dataset.sid], timer = 0, held = false;
      b.onclick = function (e) { if (held || Date.now() - heldAt < 900) { held = false; e.preventDefault(); return; } if (s) openStamp(s, owner, again); };
      if (!s || s.kind !== "state") return;
      // press and hold a state stamp: bird → flower → animal → back to the page's choice
      var stop = function () { clearTimeout(timer); timer = 0; };
      b.addEventListener("pointerdown", function () {
        held = false; stop();
        timer = setTimeout(function () {
          held = true; heldAt = Date.now(); var o = readArt(pid), cur = o.one[s.area] || (o.mode === "mix" ? P.stampArtMode(s.area, "mix") : o.mode), order = ["bird", "flower", "animal"];
          var next = order[(order.indexOf(cur) + 1) % 3]; o.one[s.area] = next;
          if (o.mode === next || (o.mode === "mix" && P.stampArtMode(s.area, "mix") === next)) delete o.one[s.area];
          writeArt(pid, o); var pg = at(); again(Math.max(1, pg));
          A().toast(stampName(s) + ": " + next);
        }, 550);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, stop); });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }); }
    bindStamps(pages);
    label();
    return { open: function (i) { pages.scrollLeft = i * pages.clientWidth; label(); fill(); } };
  }
  function passport(k, openAt) {
    var A_ = A(); document.title = k.name + "'s passport · Famstamp";
    var stamps = stampsOf(k);
    A_.main.innerHTML = A_.shell(k, "passport", '<div class="seg pswitch" role="group" aria-label="Passport or State Signs"><a class="btn" aria-current="page">🛂 Passport</a><a class="btn" href="#/p/' + esc(k.id) + '/signs">🪧 State Signs</a></div>' +
      (A_.badgeStrip ? A_.badgeStrip(k) : "") +
      (window.FS_RANGER ? window.FS_RANGER.sectionHTML(k) : "") + (window.FS_SPOTS ? window.FS_SPOTS.sectionHTML(k) : "") +
      '<p class="lede small">Every place ' + esc(k.name) + ' has been gets a stamp, with the date. Trips add them on their own; tap a stamp to see it.</p>' +
      bookHTML(k.name + "'s Famstamp Passport", k.color, stamps, false, k.id) +
      '<div class="actions"><button type="button" class="btn btn-beacon" id="addstamp">+ Add a stamp</button>' + (S().kids.length > 1 ? '<a class="btn btn-ghost" href="#/family/passport">👨‍👩‍👧 Family passport</a>' : "") + '</div>');
    var bk = bindBook(function (pg) { passport(k, pg); }, stamps, k);
    if (openAt) bk.open(openAt);
    if (A_.bindBadgeStrip) A_.bindBadgeStrip(k);
    if (window.FS_RANGER) window.FS_RANGER.bind(k, A_.main);
    if (window.FS_SPOTS) window.FS_SPOTS.bindSection(k, A_.main);
    $("#addstamp").onclick = function () { addStampSheet(k); };
  }
  function passportFamily(openAt) {
    var A_ = A(); document.title = "Family passport · Famstamp";
    var stamps = familyStampsMemo(), title = S().meta.familyName ? "The " + S().meta.familyName + " Family Passport" : "Our Family's Famstamp Passport";
    A_.main.innerHTML = '<a class="back" href="#/family">← Family map</a><h1>Family passport</h1><div class="seg pswitch" role="group" aria-label="Passport or State Signs"><a class="btn" aria-current="page">🛂 Passport</a><a class="btn" href="#/family/signs">🪧 State Signs</a></div><p class="lede small">Every stamp anyone in the family has, with who was there. A trip you took together is one stamp.</p>' +
      bookHTML(title, "#16283a", stamps, true, null) +
      '<h2>Passports</h2><div class="stats">' + S().kids.map(function (p) {
        var n = P.groupStamps(stampsOf(p)).length;
        return '<a class="stat person" href="#/p/' + esc(p.id) + '/passport" style="' + A_.kidStyle(p) + '"><div class="v"><span class="dotp">' + A_.initial(p) + '</span> ' + esc(M.who(p)) + '</div><div class="k">' + n + (n === 1 ? " place" : " places") + '</div></a>'; }).join("") + '</div>';
    var bk = bindBook(function (pg) { passportFamily(pg); }, stamps, null);
    if (openAt) bk.open(openAt);
  }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function dateFields(v) {
    v = P.cleanDate(v); var y = v.slice(0, 4), m = v.length >= 7 ? v.slice(5, 7) : "";
    return '<div class="fields"><div class="field"><label for="sdate">The exact day</label><input id="sdate" type="date" value="' + (v.length === 10 ? v : "") + '" max="' + M.today() + '"></div></div>' +
      '<p class="small muted orline">or just the month and year:</p><div class="fields two"><div class="field"><label for="smonth">Month</label><select id="smonth"><option value="">Not sure</option>' +
      MONTHS.map(function (n, i) { var mm = ("0" + (i + 1)).slice(-2); return '<option value="' + mm + '"' + (m === mm && v.length === 7 ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="syear">Year</label><input id="syear" type="number" inputmode="numeric" min="1900" max="' + new Date().getFullYear() + '" value="' + (v.length < 10 ? y : "") + '" placeholder="' + new Date().getFullYear() + '"></div></div>';
  }
  function readDate() {
    var d = $("#sdate").value; if (d) return P.cleanDate(d);
    var y = $("#syear").value.trim(), m = $("#smonth").value; if (!/^\d{4}$/.test(y)) return "";
    return P.cleanDate(m ? y + "-" + m : y);
  }
  function sheet(html) {
    closeSheet();
    var el = document.createElement("div"); el.className = "sheetbg"; el.innerHTML = '<div class="sheetbox" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) { if (e.target === el || e.target.closest("[data-close]")) closeSheet(); });
    var f = $("input,select,button", el); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
    return el;
  }
  function closeSheet() { $$(".sheetbg").forEach(function (x) { x.remove(); }); }
  // ---------- v88: bookings forwarded by email to trips+CODE@ (Family Sync only; see travel-log/mail/famstamp-mail.gs) ----------
  // The mail script keeps only airports, dates and hotel names (booking_inbox in famstamp-v88/booking-inbox.sql);
  // each one waits on the Trips page until someone makes it a trip (opens a filled-in draft) or says "Not ours".
  var pendingMail = null, MAIL_DOMAIN = "darklighthousesolutions.com", mailListAt = 0, mailList = null;
  function mailFam() { var S_ = window.MLTL_SYNC, c = S_ && S_.isOn && S_.isOn() && S_.cup && S_.cup.cfg(); return c && c.familyId ? c.familyId : ""; }
  function mailCall(fn, args) { var S_ = window.MLTL_SYNC; return mailFam() && S_.cup && S_.cup.rpc ? S_.cup.rpc(fn, args) : Promise.reject(new Error("Family Sync is off")); }
  function mailAddress() {
    var f = mailFam(); if (!f) return Promise.resolve(null);
    return mailCall("my_booking_address", { p_family: f }).then(function (c) { return typeof c === "string" && /^[a-z2-9]{6}$/.test(c) ? "trips+" + c + "@" + MAIL_DOMAIN : null; }).catch(function () { return null; });
  }
  function mailLines(p) {
    var out = [];
    (p.flights || []).forEach(function (f) { out.push("✈️ " + esc(f.dep + " → " + f.arr) + (f.date ? " · " + esc(f.date) : "")); });
    (p.hotels || []).forEach(function (h) { out.push("🏨 " + esc(h.name) + (h.city ? ", " + esc(h.city) : "") + (h.checkIn ? " · " + esc(h.checkIn) : "")); });
    return out.join("<br>");
  }
  function mailToTrip(p) {
    var BK = window.FS_BOOKING_CORE; if (!BK) return Promise.resolve(null);
    var res = { flights: (p.flights || []).map(function (f) { return { dep: f.dep, arr: f.arr, date: f.date || "" }; }),
                hotels: (p.hotels || []).map(function (h) { return { name: h.name, city: h.city || "", checkIn: h.checkIn || "", checkOut: h.checkOut || "", nights: h.nights == null ? null : h.nights }; }) };
    return loadAirports().catch(function () { return []; }).then(function (list) {
      var by = {}; (list || []).forEach(function (a) { by[a.code] = a; });
      return BK.toTrip(res, function (c) { var a = by[c]; return a ? airportObj(a) : null; }, M.today());
    });
  }
  // v92: forwarded emails that couldn't be used (booking_notes_list: arrival time, sender's domain, short subject, reason only)
  var openPaste = false, notesAt = 0, notesList = null;
  function mailNotes() {
    var f = mailFam(); if (!f) return Promise.resolve([]);
    if (notesList && Date.now() - notesAt < 60000) return Promise.resolve(notesList);
    return mailCall("booking_notes_list", { p_family: f }).then(function (l) { notesList = Array.isArray(l) ? l : []; notesAt = Date.now(); return notesList; }).catch(function () { return []; });
  }
  function noteText(n) {
    var d = String(n.received_at || "").slice(0, 10), day = /^\d{4}-\d{2}-\d{2}$/.test(d) ? M.prettyDate(d) : "recently";
    return n.reason === "limit" ? "We got an email on " + day + " but couldn't add it: more than 30 came in that day. Try Paste a booking instead."
      : "We got an email on " + day + " but couldn't read it. Try Paste a booking instead.";
  }
  function noteHTML(n) {
    var from = [n.sender_domain ? "from " + n.sender_domain : "", n.subject ? "“" + n.subject + "”" : ""].filter(Boolean).join(" · ");
    return '<div class="mailitem mailnote" data-nid="' + esc(n.id) + '"><p>📭 ' + esc(noteText(n)) + (from ? '<br><span class="small muted">' + esc(from) + '</span>' : "") + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-notepaste="' + esc(n.id) + '">Paste a booking</button><button type="button" class="btn btn-ghost" data-noteok="' + esc(n.id) + '">Got it</button></div></div>';
  }
  function mailInbox(main) {
    var f = mailFam(); if (!f || !main) return;
    var draw = function (list, notes) {
      notes = notes || [];
      if ((!list || !list.length) && !notes.length || !/^#\/trips/.test(location.hash) || main.querySelector(".mailbox")) return;
      list = list || [];
      var box = document.createElement("section"); box.className = "panel mailbox";
      box.innerHTML = '<h2>✉️ From your email</h2>' + (list.length ? '<p class="small muted">Bookings your family forwarded. Make each one a trip and check it over, or skip it.</p>' : "") +
        notes.map(noteHTML).join("") +
        list.map(function (it) {
          return '<div class="mailitem" data-mid="' + esc(it.id) + '"><p>' + mailLines(it.parsed || {}) + '</p><div class="actions"><button type="button" class="btn btn-primary" data-mailuse="' + esc(it.id) + '">Make a trip</button><button type="button" class="btn btn-ghost" data-maildrop="' + esc(it.id) + '">Not ours</button></div></div>';
        }).join("");
      var h1 = main.querySelector("h1"); if (h1) h1.parentNode.insertBefore(box, h1.nextSibling); else main.insertBefore(box, main.firstChild);
      $$("[data-mailuse]", box).forEach(function (b) {
        b.onclick = function () {
          var it = list.filter(function (x) { return x.id === b.dataset.mailuse; })[0]; if (!it) return;
          b.disabled = true;
          mailToTrip(it.parsed || {}).then(function (found) {
            b.disabled = false;
            if (!found) { A().toast("We couldn't read that one. Add it by hand, or tap Not ours."); return; }
            var st = S(), mine = st.meta && st.meta.sync && st.meta.sync.myPerson, k = A().kidById(mine) || st.kids[0];
            if (!k) { A().toast("Add someone to the family first."); return; }
            pendingBooking = found; pendingMail = it.id; mailList = null;
            location.hash = "#/p/" + k.id + "/trips/new";
          });
        };
      });
      var who = function () { var st = S(), mine = st.meta && st.meta.sync && st.meta.sync.myPerson; return A().kidById(mine) || st.kids[0]; };
      var gone = function (b) { var row = b.closest(".mailitem"); if (row) row.remove(); if (!$(".mailitem", box)) box.remove(); };
      $$("[data-noteok]", box).forEach(function (b) {
        b.onclick = function () {
          b.disabled = true;
          mailCall("booking_note_seen", { p_id: b.dataset.noteok }).then(function () { notesList = null; gone(b); })
            .catch(function () { b.disabled = false; A().toast("Couldn't reach Family Sync. Try again in a moment."); });
        };
      });
      $$("[data-notepaste]", box).forEach(function (b) {
        b.onclick = function () {
          var k = who(); if (!k) { A().toast("Add someone to the family first."); return; }
          mailCall("booking_note_seen", { p_id: b.dataset.notepaste }).catch(function () {}); notesList = null;
          openPaste = true; location.hash = "#/p/" + k.id + "/trips/new";
        };
      });
      $$("[data-maildrop]", box).forEach(function (b) {
        b.onclick = function () {
          b.disabled = true;
          mailCall("booking_inbox_mark", { p_id: b.dataset.maildrop, p_status: "dismissed" }).then(function () {
            mailList = null; var row = b.closest(".mailitem"); if (row) row.remove(); if (!$(".mailitem", box)) box.remove();
          }).catch(function () { b.disabled = false; A().toast("Couldn't reach Family Sync. Try again in a moment."); });
        };
      });
    };
    var lists = mailList && Date.now() - mailListAt < 60000 ? Promise.resolve(mailList) :
      mailCall("booking_inbox_list", { p_family: f }).then(function (list) { mailList = Array.isArray(list) ? list : []; mailListAt = Date.now(); return mailList; }).catch(function () { return []; });
    Promise.all([lists, mailNotes()]).then(function (r) { draw(r[0], r[1]); });
  }
  // ---------- v84: paste a booking (flight or hotel confirmation) into a new trip ----------
  var pendingBooking = null;
  function bookingSheet(k, opts) {
    var BK = window.FS_BOOKING_CORE; if (!BK) return;
    var el = sheet('<h3>📋 Paste a booking</h3><p class="small muted">Copy the text of a flight or hotel confirmation email and paste it here. We pick out the airports, dates and hotel name, and it stays on this phone: names, confirmation numbers and prices are left out.</p>' +
      '<div class="field"><label for="bktext">Booking email</label><textarea id="bktext" rows="7" maxlength="60000" placeholder="e.g. Edinburgh (EDI) to London Heathrow (LHR), Fri 3 July 2026"></textarea></div>' +
      '<div id="bkout" class="small" aria-live="polite"></div><p class="small bknote" id="bknote" hidden></p><p class="small muted bkmail" id="bkmail" hidden></p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="bkread">Read it</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
    var ta = $("#bktext", el), out = $("#bkout", el), btn = $("#bkread", el), found = null;
    mailNotes().then(function (notes) { var n = notes[0], o = $("#bknote", el); if (!n || !o) return; o.hidden = false; o.textContent = "📭 " + noteText(n) + " Paste it here instead."; });
    mailAddress().then(function (addr) { var m = $("#bkmail", el); if (!addr || !m) return; m.hidden = false; m.innerHTML = '✉️ Or forward the confirmation email to <b class="bkaddr">' + esc(addr) + '</b>. It shows up on the Trips page for your family to check. Only the places, dates and hotel name are kept.'; });
    ta.oninput = function () { found = null; btn.textContent = "Read it"; out.innerHTML = ""; };
    btn.onclick = function () {
      if (found) { pendingBooking = found; closeSheet(); builder(k, null, opts); return; }
      btn.disabled = true;
      loadAirports().catch(function () { return []; }).then(function (list) {
        btn.disabled = false;
        var by = {}; (list || []).forEach(function (a) { by[a.code] = a; });
        var res = BK.parse(ta.value, M.today());
        found = BK.toTrip(res, function (c) { var a = by[c]; return a ? airportObj(a) : null; }, M.today());
        if (!found) { out.innerHTML = '<p class="err">We couldn\'t find any flights or a hotel in that. Try pasting the whole email, or add the trip by hand.</p>'; return; }
        var lines = [];
        res.flights.forEach(function (f) { if (by[f.dep] && by[f.arr]) lines.push("✈️ " + esc(f.dep + " → " + f.arr) + (f.date ? " · " + esc(f.date) : "")); });
        found.stays.forEach(function (h) { lines.push("🏨 " + esc(h.name) + (h.nights != null ? " · " + h.nights + (h.nights === 1 ? " night" : " nights") : "")); });
        out.innerHTML = '<p><b>We found:</b></p><ul class="bkfound">' + lines.map(function (l) { return "<li>" + l + "</li>"; }).join("") + '</ul>';
        btn.textContent = "Fill in the trip";
      });
    };
  }
  window.addEventListener("hashchange", closeSheet);
  /** "With Mom & Dad" on a stamp from a shared visit (nicknames when set). Old stamps have no list and show nothing. */
  function withLine(s, owner) {
    var others = (s.with || []).filter(function (id) { return !owner || id !== owner.id; }).map(function (id) { return A().kidById(id); }).filter(Boolean);
    if (!others.length || !owner) return "";
    return '<p class="small withline"><span class="dots">' + A().avatars(others.map(function (p) { return p.id; })) + '</span> With ' + esc(window.FS_WHO ? window.FS_WHO.names(others.map(function (p) { return p.id; })) : others.map(M.who).join(", ")) + '</p>';
  }
  /** v94: a place visited more than once opens the list of its visits; tap one for that visit's own sheet. */
  function openStamp(g, owner, again) {
    var vs = (g.visits || [g]).filter(function (v) { return v.source !== "map"; });
    if (vs.length <= 1) return stampSheet(vs[0] || (g.visits || [g])[0], owner, again);
    var span = P.fmtDate(g.first) ? "First " + P.fmtDate(g.first) + (g.last && g.last !== g.first ? " · latest " + P.fmtDate(g.last) : "") : "";
    sheet('<div class="sheethead"><h3>' + esc(stampName(g)) + '</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      '<div class="bigstamp">' + stampSVG(g, owner ? owner.id : null) + '</div><p class="vtimes"><b>Visited ' + vs.length + ' times</b></p>' + (span ? '<p class="muted">' + esc(span) + '</p>' : "") +
      '<ul class="pvisitlist">' + vs.map(function (v, i) {
        var t = v.tripId ? tripById(v.tripId) : null, d = P.fmtDate(v.date) ? P.fmtDate(v.date) + (v.end && v.end !== v.date ? " to " + P.fmtDate(v.end) : "") : "No date yet";
        return '<li><button type="button" class="btn btn-ghost visitbtn" data-visit="' + i + '"><span>' + esc(d) + '</span><span class="muted small">' + esc(t ? "Trip: " + t.place : v.source === "hand" ? "Stamped by hand" : "") + '</span></button></li>';
      }).join("") + '</ul><div class="actions"><button type="button" class="btn btn-ghost" data-close>Close</button></div>');
    $$("[data-visit]").forEach(function (b) { b.onclick = function () { stampSheet(vs[+b.dataset.visit], owner, again); }; });
  }
  function stampSheet(s, owner, again) {
    var A_ = A(), name = stampName(s), dates = P.fmtDate(s.date) ? P.fmtDate(s.date) + (s.end ? " to " + P.fmtDate(s.end) : "") : "";
    var t = s.tripId ? tripById(s.tripId) : null, holder = owner || (s.who.length === 1 ? A_.kidById(s.who[0]) : null);
    var html = '<div class="bigstamp">' + stampSVG(s, owner ? owner.id : null) + '</div><h3>' + esc(name) + '</h3>' + symLine(s, owner ? owner.id : null) + (dates || s.via ? '<p class="muted">' + esc(dates) + (s.via ? (dates ? " · " : "") + "via " + esc(s.via) : "") + '</p>' : "") + '' +
      (s.who.length > 1 || !owner ? '<p class="small"><span class="dots">' + A_.avatars(s.who) + '</span> ' + esc(A_.travelerNames(s.who)) + '</p>' : "") + withLine(s, owner);
    if (t) html += '<p class="small">From the trip <a href="#/p/' + esc((holder || A_.kidById(t.kidIds[0])).id) + '/trip/' + esc(t.id) + '">' + esc(t.place) + ' →</a></p><p class="small muted">Its dates come from the trip, so edit the trip to change them.</p><div class="actions"><button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    else if (holder) {
      html += (s.note ? '<p class="small">' + esc(s.note) + '</p>' : "") + '<p class="small muted">' + (s.source === "map" ? "Colored in on the map. When were you there?" : "Change the date:") + '</p>' + dateFields(s.date) +
        '<div class="actions"><button type="button" class="btn btn-primary" id="sok">Save date</button><button type="button" class="btn btn-ghost" id="swho2">👥 Change who has it</button><button type="button" class="btn btn-danger" id="sdel">Remove from ' + esc(M.who(holder)) + '\'s passport</button><button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    } else html += '<div class="actions"><button type="button" class="btn btn-ghost" id="swho2">👥 Change who has it</button><button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    if (window.FS_SX && holder) html += window.FS_SX.buttons(s, holder);   // v65: share card, postcard, draw your own stamp
    sheet(html);
    var sw = $("#swho2");
    if (sw && window.FS_WHO) sw.onclick = function () { window.FS_WHO.open({ kind: s.kind, area: s.area, page: owner, mode: "edit", date: s.date || "", visitDate: s.source === "hand" ? s.date || "" : null, after: function () { again(); } }); };
    var ok = $("#sok");
    if (ok) ok.onclick = function () {
      var date = readDate(); if (!date) return A_.toast("Pick a day, or a month and year");
      if (s.source === "hand") holder.stamps = (holder.stamps || []).map(function (x) { return x.id === s.id ? Object.assign({}, x, { date: date }) : x; });
      else holder.stamps = P.cleanStamps((holder.stamps || []).concat([P.newStamp({ kind: s.kind, area: s.area, date: date })]));
      holder.updatedAt = new Date().toISOString();
      A_.saveKid(holder).then(function () { closeSheet(); again(); A_.toast("Stamp dated"); });
    };
    var dl = $("#sdel");
    if (dl) dl.onclick = function () { window.FS_WHO.removeStamp(holder, s, function () { closeSheet(); again(); }); };
  }
  function areaOptions(sec) {
    if (sec === "parks") return M.PARK_SETS.map(function (set) { return '<optgroup label="' + esc(set.name) + '">' + M.parksIn(set.id).map(function (p) { return '<option value="park:' + p.id + '">' + esc(set.id === "np" ? p.name : p.full) + '</option>'; }).join("") + '</optgroup>'; }).join("");
    if (sec === "states") return MAPS.us.shapes.map(function (p) { return '<option value="state:' + p.id + '">' + esc(p.name) + '</option>'; }).join("");
    return '<optgroup label="UK nations">' + MAPS.world.uk.map(function (u) { return '<option value="place:' + u.id + '">' + esc(u.name) + '</option>'; }).join("") + '</optgroup><optgroup label="Countries">' +
      MAPS.world.countries.filter(function (c) { return c.id !== "GBR"; }).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return '<option value="place:' + c.id + '">' + esc(c.name) + '</option>'; }).join("") + '</optgroup>';
  }
  function addStampSheet(k) {
    var A_ = A(), W = window.FS_WHO, list = W.people(), on = W.startIds(k), me = W.whoAmI().me;
    sheet('<div class="sheethead"><h3>Add a stamp</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div><div class="field"><label for="sarea">Where?</label><select id="sarea">' + areaOptions(psec) + '</select></div>' +
      '<div class="field"><label>Who\'s been there?</label>' + W.askLine() + W.chipsHTML(list, on, {}, me) + '</div>' + dateFields("") +
      '<div class="field"><label for="svia">Came in through <span class="muted small">(optional)</span></label><input id="svia" type="text" maxlength="40" placeholder="e.g. EDI, Dover, the ferry"></div>' +
      '<p class="err" id="werr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="sok">Stamp it</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
    $("#sok").onclick = function () {
      var box = $(".sheetbox"), want = W.picked(box), v = $("#sarea").value.split(":"), date = readDate();
      if (!want.length) { var e = $("#werr"); e.hidden = false; e.textContent = "Tick who's been there."; return; }
      var r = window.FS_WHO_CORE.addFor(S().kids, S().trips, v[0], v[1], want, { date: date, via: $("#svia").value, ctx: CTX });
      W.finish(r, v[0], v[1], date, function () { passport(A_.kidById(k.id) || k); });
    };
  }
  function addStamp(k, stamp, colorIn) {
    k.stamps = P.cleanStamps((k.stamps || []).concat([stamp]));
    if (colorIn) { if (stamp.kind === "park") { if (!k.parks[stamp.area]) k.parks[stamp.area] = { at: stamp.date.length === 10 ? stamp.date : M.today(), jr: false }; } else M.toggleArea(k, stamp.kind, stamp.area, true, stamp.date.length === 10 ? stamp.date : ""); }
    k.updatedAt = new Date().toISOString();
    return A().saveKid(k);
  }
  /** After someone colors in a place on a map: ask when, and stamp the passport. */
  function askDate(k, kind, id, after) {
    var name = shortArea(kind, id);
    if (kind === "place" && id === "USA") return;
    var html = '<div class="askhead"><span aria-hidden="true">🛂</span><div><h3>Stamp ' + esc(M.who(k)) + '\'s passport?</h3><p class="muted small">When ' + (M.isKid(k) ? "were you" : "were you") + ' in ' + esc(name) + '?</p></div></div>' + dateFields("") +
      '<div class="actions"><button type="button" class="btn btn-primary" id="sok">Stamp it</button><button type="button" class="btn btn-ghost" data-close id="snot">Not sure</button></div>';
    sheet(html);
    $("#sok").onclick = function () {
      var date = readDate(); if (!date) return A().toast("Pick a day, or a month and year, or tap Not sure");
      var stamp = P.newStamp({ kind: kind, area: id, date: date });
      var bag = kind === "state" ? k.states : kind === "park" ? k.parks : k.places;
      if (bag[id] && date.length === 10) bag[id].at = date;
      addStamp(k, stamp, false).then(function () { closeSheet(); celebrate([Object.assign({}, stamp, { newSign: kind === "state" })]); if (after) after(); });
    };
    // Not sure of the date: no passport stamp, but a new state still collects its sign.
    if (kind === "state") $("#snot").addEventListener("click", function () { celebrate([{ kind: "state", area: id, date: "", newSign: true, signOnly: true }]); });
  }
  var audio = null;
  function thunk() {
    if (!window.FS_EXTRAS || !window.FS_EXTRAS.soundOn()) return;   // v68: sound is off unless turned on in Help & settings
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      audio = audio || new AC(); var t0 = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + 0.16);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.25);
    } catch (e) {}
  }
  /** "New stamp!" with an ink thunk (and a buzz on phones that can). */
  function celebrate(list) {
    if (!list || !list.length) return;
    $$(".stampfx").forEach(function (x) { x.remove(); });
    var s = list.filter(function (x) { return x.newSign; })[0] || list[0], el = document.createElement("div"), more = list.length - 1;
    el.className = "stampfx" + (s.newSign ? " signfx" : "") + (reduced() ? " calm" : ""); el.setAttribute("role", "status");
    el.innerHTML = s.newSign
      ? '<div class="fxbox"><div class="fxsign">' + P.signSVG(s.area, areaName("state", s.area), { first: s.date, visits: 1 }) + '</div><b>Sign collected: ' + esc(areaName("state", s.area)) + '!</b><span>' +
        (s.signOnly ? "It's in your State Signs." : "Plus a new passport stamp" + (more ? " and " + more + " more" : "") + ".") + '</span></div>'
      : '<div class="fxbox"><div class="fxstamp">' + stampSVG(s, s.holder) + '</div><b>New stamp: ' + esc(stampName(s)) + '</b>' + (more ? '<span>+ ' + more + ' more in the passport</span>' : "") +
        (window.FS_SHARECARD && s.holder && /^(state|place|park)$/.test(s.kind) ? '<a class="btn btn-sm fxshare" href="#/sharecard/' + window.FS_SX.path(s, s.holder) + '">📲 Make a share card</a>' : "") + '</div>';
    document.body.appendChild(el);
    try { document.dispatchEvent(new CustomEvent("fs:stamp", { detail: { n: list.length, holder: s.holder && s.holder.id } })); } catch (e) {}
    setTimeout(function () { thunk(); if (navigator.vibrate) try { navigator.vibrate(reduced() ? 20 : [18, 40, 28]); } catch (e) {} }, reduced() ? 0 : 260);
    el.onclick = function () { el.remove(); };
    setTimeout(function () { el.classList.add("out"); setTimeout(function () { el.remove(); }, 400); }, el.querySelector(".fxshare") ? 4200 : 2300);
  }

  // ---------- lifetime stats ----------
  function lifetimeHTML(personId) {
    var A_ = A(), L = T.lifetime(personId, S().trips); if (!L.trips) return "";
    var lt = L.longest ? tripById(L.longest.id) : null, pid = personId || (lt ? lt.kidIds[0] : "");
    return '<h2>' + (personId ? "Miles and favorites" : "Family miles and favorites") + ' ' + unitToggle() + '</h2><div class="tstats life">' +
      tstat("🧭", dist(L.miles), "traveled") + tstat("🌍", (Math.round(L.aroundWorld * 100) / 100) + "×", "around the world") + tstat("✈️", L.flights, L.flights === 1 ? "flight" : "flights") +
      (L.flightMiles ? tstat("🛫", dist(L.flightMiles), "flown") : "") + (L.airMin ? tstat("⏱️", "~" + T.fmtAir(L.airMin), "in the air") : "") +
      (L.bigRoad ? tstat("🚗", dist(L.bigRoad), "biggest road trip") : "") + (L.topState ? tstat("📍", areaName("state", L.topState.id), "most visited · " + L.topState.count + (L.topState.count === 1 ? " trip" : " trips")) : "") + '</div>' +
      (lt ? '<p class="small">Longest trip: <a href="#/p/' + esc(pid) + '/trip/' + esc(lt.id) + '">' + esc(lt.place) + '</a>, ' + esc(dist(L.longest.miles, true)) + '</p>' : "") +
      (L.restaurants.length ? '<h3 class="sec">Favorite restaurants</h3><ol class="rlist">' + L.restaurants.slice(0, 8).map(function (r) {
        var tt = tripById(r.tripId);
        return '<li><b>' + esc(r.name) + '</b>' + stars(r.rating) + '<span class="meta">' + esc([r.where, tt ? tt.place : ""].filter(Boolean).join(" · ")) + '</span></li>'; }).join("") + '</ol>' : "");
  }
  function bindLifetime(again) { bindUnits(A().main, again); }

  // ---------- print ----------
  function printExtra(k) {
    var A_ = A(), list = S().trips.filter(function (t) { return t.kidIds.indexOf(k.id) >= 0; }).sort(function (a, b) { return order(a) < order(b) ? -1 : 1; });
    var out = list.filter(function (t) { return (t.route || []).length > 1 || (t.stays || []).length || (t.favs || []).length || t.story; }).map(function (t) {
      var s = T.summary(t), favs = T.visibleFavs(t, S().kids, k, !!S().meta.adultInKid), m = t.moments || {};
      return '<section class="page tripprint"><h1>' + esc(t.place) + '</h1><p class="statline">' + esc([dateRange(t), s.nights != null ? s.nights + " nights" : "", s.legs.length ? dist(s.miles, true) : "", A_.travelerNames(t.kidIds)].filter(Boolean).join(" · ")) + '</p>' +
        (T.routeMap(t) ? '<div class="mapbox routebox">' + routeSVG(t) + '</div>' : "") + '<div class="cols"><div>' +
        (s.legs.length ? '<h2>The way we went</h2><ul>' + s.legs.map(function (L) { return '<li>' + modeIc(L.mode) + ' ' + esc(L.from + " → " + L.to) + ': ' + esc((L.how === "about" ? "about " : "") + dist(L.miles)) + '</li>'; }).join("") + '</ul>' : "") +
        ((t.stays || []).length ? '<h2>Where we stayed</h2><ul>' + t.stays.map(function (x) { return '<li>' + esc(x.name) + (x.nights ? ", " + x.nights + " nights" : "") + (x.rating ? " " + "★★★★★".slice(0, x.rating) : "") + (x.note ? ": " + esc(x.note) : "") + '</li>'; }).join("") + '</ul>' : "") +
        (favs.length ? '<h2>Favorites</h2><ul>' + favs.map(function (f) { return '<li>' + T.FAV[f.cat].ic + ' ' + esc(T.FAV[f.cat].short) + ': <b>' + esc(f.name) + '</b>' + (f.where ? " (" + esc(f.where) + ")" : "") + (f.rating ? " " + "★★★★★".slice(0, f.rating) : "") + '</li>'; }).join("") + '</ul>' : "") +
        (people(t.kidIds).some(function (p) { return m[p.id]; }) ? '<h2>Favorite moments</h2><ul>' + people(t.kidIds).filter(function (p) { return m[p.id]; }).map(function (p) { return '<li><b>' + esc(M.who(p)) + ':</b> ' + esc(m[p.id]) + '</li>'; }).join("") + '</ul>' : "") +
        '</div><div>' + (t.story && canStory(t) ? '<h2>Our story</h2><p class="storyprint">' + esc(storyTextForPrint(t, k)) + '</p>' : "") + '</div></div></section>';
    }).join("");
    var stamps = stampsOf(k);
    if (stamps.length) {
      var chunks = []; for (var ci = 0; ci < stamps.length; ci += 12) chunks.push(stamps.slice(ci, ci + 12).map(function (x, j) { return { stamp: x, rot: (T.hash(x.id) % 17) - 8 }; }));
      out += chunks.map(function (pg, n) {
        return '<section class="page passprint"><h1>' + esc(M.who(k)) + '\'s passport' + (n ? " (" + (n + 1) + ")" : "") + '</h1><div class="pgrid">' + pg.map(function (c) {
          return '<div class="pstamp" style="--r:' + c.rot + 'deg">' + stampSVG(c.stamp, k.id) + '</div>'; }).join("") + '</div></section>';
      }).join("");
    }
    return out;
  }
  function storyTextForPrint(t, k) {
    var st = t.story; if (!st) return "";
    if (st.edited) return st.text;
    if (st.style === "journal" && !T.showAdult(t, S().kids, k, !!S().meta.adultInKid)) return storyText(t, k, "journal", st.seed);
    return storyText(t, k, st.style, st.seed);
  }

  // shared ink filter for the stamps
  function inkDefs() {
    if (document.getElementById("inkdefs")) return;
    var d = document.createElement("div"); d.id = "inkdefs"; d.setAttribute("aria-hidden", "true");
    d.innerHTML = '<svg width="0" height="0" style="position:absolute"><filter id="inkrough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/><feComponentTransfer in="n" result="speck"><feFuncA type="discrete" tableValues="1 1 1 0.35 1 1 1 1"/></feComponentTransfer>' +
      '<feComposite in="d" in2="speck" operator="in"/></filter></svg>';
    document.body.appendChild(d);
  }
  if (document.body) inkDefs(); else document.addEventListener("DOMContentLoaded", inkDefs);

  // ---------- State Signs ----------
  // A separate collection from the passport: one "Welcome to" sign per state. Same sources as the state stamps
  // (US trip stops, hand-added state stamps, states colored on the map), so there is nothing extra to store.
  // Each sign's art comes from state-signs.js; its frame is bronze (1 visit), silver (2-3) or gold (4+).
  var TIER_NAME = { bronze: "Bronze", silver: "Silver", gold: "Gold" };
  function collectBar(personId) {
    if (S().kids.length < 2) return "";
    return '<div class="chips signwho" role="group" aria-label="Whose signs">' + '<a class="chip" href="#/family/signs"' + (personId ? "" : ' aria-current="true"') + '>Everyone</a>' +
      S().kids.map(function (p) { return '<a class="chip" style="' + A().kidStyle(p) + '" href="#/p/' + esc(p.id) + '/signs"' + (p.id === personId ? ' aria-current="true"' : "") + '><span class="dotp" aria-hidden="true">' + A().initial(p) + '</span> ' + esc(M.who(p)) + '</a>'; }).join("") + '</div>';
  }
  // Which signs this screen has already shown, so a newly collected one flips in once (kept on this device only).
  function seenKey(personId) { var log = "mltl"; try { log = window.MLTL_SYNCCORE.readLogs(localStorage).active || log; } catch (e) {} return "famstamp-signs-seen:" + log + ":" + (personId || "all"); }
  function readSeen(personId) { try { var v = localStorage.getItem(seenKey(personId)); return v == null ? null : v.split(",").filter(Boolean); } catch (e) { return null; } }
  function writeSeen(personId, ids) { try { localStorage.setItem(seenKey(personId), ids.join(",")); } catch (e) {} }
  function signsHTML(personId, fresh) {
    var who = personId ? [A().kidById(personId)] : S().kids, signs = P.signsFor(who, S().trips, CTX), c = P.signCount(signs);
    var list = P.STATES50.slice().sort(function (a, b) { return areaName("state", a).localeCompare(areaName("state", b)); });
    var tiers = { bronze: 0, silver: 0, gold: 0 }, n = 0;
    Object.keys(signs).forEach(function (id) { tiers[P.signTier(signs[id])]++; });
    var card = function (id, bonus) {
      var info = signs[id], t = P.signTier(info), isNew = info && fresh && fresh.indexOf(id) >= 0;
      return '<button type="button" class="signcard' + (info ? " got t-" + t : " todo") + (bonus ? " bonus" : "") + (isNew ? " fresh" : "") + '" data-sign="' + id + '"' + (isNew ? ' style="--d:' + (n++ * 140) + 'ms"' : "") + '>' +
        P.signSVG(id, areaName("state", id), info || null) +
        (!personId && info ? '<span class="dots">' + A().avatars(info.who) + '</span>' : "") + (bonus ? '<span class="bonustag">Bonus</span>' : "") + (isNew ? '<span class="newtag">New!</span>' : "") + '</button>';
    };
    var got = list.filter(function (id) { return signs[id]; }), todo = list.filter(function (id) { return !signs[id]; });
    var key = '<ul class="tierkey" aria-label="Sign frames">' + ["bronze", "silver", "gold"].map(function (t) {
      return '<li class="t-' + t + '"><i aria-hidden="true"></i><b>' + TIER_NAME[t] + '</b> <span>' + (t === "bronze" ? "1 visit" : t === "silver" ? "2–3 visits" : "4+ visits") + '</span> <em>' + tiers[t] + '</em></li>'; }).join("") + '</ul>';
    return '<div class="signhead"><div class="signcount"><b>' + c.have + '</b> of 50 states' + (c.dc ? ' <span class="bonusnote">+ DC</span>' : "") + '</div><div class="signbar" aria-hidden="true"><span style="width:' + (c.have * 2) + '%"></span></div></div>' + key +
      '<div class="signbook">' + (got.length ? '<h3 class="sec">Collected</h3><div class="signgrid">' + got.map(function (id) { return card(id); }).join("") + '</div>' : "") +
      (todo.length ? '<h3 class="sec">Still to find <span class="muted small">' + todo.length + ' to go</span></h3><div class="signgrid">' + todo.map(function (id) { return card(id); }).join("") + '</div>' : '<p class="allfifty">All 50! What a road trip family. 🎉</p>') +
      '<h3 class="sec">Bonus</h3><div class="signgrid">' + card("DC", true) + '</div></div>' +
      '<p class="small muted">Signs fill in from trips, passport stamps and the states you color in on the map. Tap one to see its trips and dates. The designs are Famstamp originals, not real state signs.</p>';
  }
  function signs(k) {
    var A_ = A(), pid = k ? k.id : null; document.title = (k ? M.who(k) + "'s state signs" : "State signs") + " · Famstamp";
    var have = Object.keys(P.signsFor(k ? [k] : S().kids, S().trips, CTX)), seen = readSeen(pid);
    // First visit to this screen: nothing flips. After that, signs collected since last time get a flip-in and a shine.
    var fresh = seen ? have.filter(function (id) { return seen.indexOf(id) < 0; }) : [];
    writeSeen(pid, have);
    var body = '<div class="seg pswitch" role="group" aria-label="Passport or State Signs">' + (k ? '<a class="btn" href="#/p/' + esc(k.id) + '/passport">🛂 Passport</a>' : '<a class="btn" href="#/family/passport">🛂 Passport</a>') +
      '<a class="btn" aria-current="page">🪧 State Signs</a></div>' + collectBar(pid) + signsHTML(pid, fresh);
    A_.main.innerHTML = k ? A_.shell(k, "passport", body) : '<a class="back" href="#/family">← Family map</a><h1>State signs</h1>' + body;
    $$("[data-sign]").forEach(function (b) { b.onclick = function () { signSheet(k, b.dataset.sign); }; });
  }
  function visitRow(v, k, i) {
    var A_ = A(), t = v.tripId ? tripById(v.tripId) : null, d = t ? dateRange(t) : (P.fmtDate(v.date) ? P.fmtDate(v.date) + (v.end ? " to " + P.fmtDate(v.end) : "") : "");
    var how = t ? '<a href="#/p/' + esc((k || A_.kidById(v.who[0]) || { id: t.kidIds[0] }).id) + '/trip/' + esc(t.id) + '">' + esc(t.place) + ' →</a>' : v.source === "hand" ? "Added by hand" : "Colored in on the map";
    var owner = k || (v.who.length === 1 ? A_.kidById(v.who[0]) : null);
    return '<li><span class="vnum" aria-hidden="true">' + (i + 1) + '</span><div>' + (d ? '<b>' + esc(d) + '</b>' : "") + '<span class="small">' + how + '</span>' + (!k && v.who.length ? '<span class="dots">' + A_.avatars(v.who) + '</span>' : "") + '</div>' +
      (!t && owner ? '<button type="button" class="btn btn-ghost btn-sm" data-vdate="' + i + '">' + (d ? "Change date" : "Add date") + '</button>' : "") + '</li>';
  }
  function signSheet(k, id) {
    var A_ = A(), name = areaName("state", id), who = k ? [k] : S().kids, info = P.signsFor(who, S().trips, CTX)[id], again = function () { signs(k ? A_.kidById(k.id) : null); };
    var look = P.signInfo(id), t = P.signTier(info), missing = S().kids.filter(function (p) { return !P.signsFor([p], S().trips, CTX)[id]; });
    var html = '<div class="signdetail"><div class="bigsign' + (info ? " t-" + t : "") + '">' + P.signSVG(id, name, info || null) + '</div><h3>' + esc(name) + (id === "DC" ? ' <span class="tag">bonus</span>' : "") + '</h3>' +
      (look ? '<p class="signnick">' + esc(look.nick) + '</p>' : "");
    if (info) {
      var next = t === "gold" ? "Top frame. Gold!" : (t === "silver" ? 4 - info.visits : 1) + (t === "silver" && 4 - info.visits > 1 ? " more visits" : " more visit") + " for " + (t === "silver" ? "Gold" : "Silver");
      html += '<div class="signmeta"><span class="tierpill t-' + t + '"><i aria-hidden="true"></i>' + TIER_NAME[t] + ' sign</span><span><b>' + info.visits + '</b> ' + (info.visits === 1 ? "visit" : "visits") + '</span>' + (info.first ? "<span>First visit <b>" + esc(P.fmtDate(info.first)) + "</b></span>" : "") + '</div>' +
        '<p class="small muted">' + esc(next) + '</p>' +
        '<p class="small"><span class="dots">' + A_.avatars(info.who) + '</span> ' + esc(A_.travelerNames(info.who)) + '</p>' +
        '<h4 class="sec">Visits</h4><ol class="visitlist">' + info.list.map(function (v, i) { return visitRow(v, k, i); }).join("") + '</ol>';
    } else html += '<p class="muted">Not collected yet. Visit ' + esc(name) + ' on a trip and this sign fills in by itself.</p>';
    var canAdd = true;
    if (canAdd) html += '<p class="small muted">' + (info ? "Another visit to " + esc(name) + "? Add it here." : "Been to " + esc(name) + "? Add the sign by hand.") + '</p>' + ('<div class="field"><label>Who\'s been there?</label>' + window.FS_WHO.askLine() + window.FS_WHO.chipsHTML(window.FS_WHO.people(), window.FS_WHO.startIds(k), {}, window.FS_WHO.whoAmI().me) + '</div><p class="err" id="werr" hidden></p>') + dateFields("") +
      '<div class="actions"><button type="button" class="btn btn-primary" id="sok">' + (info ? "Add this visit" : "Collect this sign") + '</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>';
    else html += '<div class="actions"><button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    sheet(html + '</div>');
    $$("[data-vdate]").forEach(function (b) {
      b.onclick = function () {
        var v = info.list[+b.dataset.vdate], owner = k || A_.kidById(v.who[0]), st = owner && stampsOf(owner).filter(function (x) { return x.id === v.stampId; })[0];
        if (st) stampSheet(st, owner, again);
      };
    });
    var ok = $("#sok");
    if (ok) ok.onclick = function () {
      var want = window.FS_WHO.picked($(".sheetbox")), date = readDate();
      if (!want.length) { var e = $("#werr"); e.hidden = false; e.textContent = "Tick who's been there."; return; }
      // No date? Color in the state only (a shared visit still keeps who was together); with a date it's also a passport stamp.
      window.FS_WHO.finish(window.FS_WHO_CORE.addFor(S().kids, S().trips, "state", id, want, { date: date, ctx: CTX }), "state", id, date, again);
    };
  }

  // ---------- "+ Add a trip" on the home screen: one tap to the builder ----------
  function addTripHref(p, all) { return "#/p/" + p.id + "/trips/new" + (all ? "/all" : ""); }
  function whoWentSheet() {
    var A_ = A(), kids = S().kids, me = S().meta.sync && S().meta.sync.myPerson;
    if (!kids.length) { location.hash = "#/add"; return; }
    if (kids.length === 1) { location.hash = addTripHref(kids[0]); return; }
    var list = kids.slice().sort(function (a, b) { return (b.id === me ? 1 : 0) - (a.id === me ? 1 : 0); }), lead = A_.kidById(me) || list[0];
    sheet('<div class="sheethead"><h3 id="wwh">Who went?</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div><p class="small muted">Pick one to start. You can check everyone else on the next screen.</p>' +
      '<div class="whowent" role="group" aria-labelledby="wwh"><a class="wwall" href="' + esc(addTripHref(lead, true)) + '"><span aria-hidden="true">👨‍👩‍👧</span> Everyone went</a>' +
      list.map(function (p) { return '<a class="wwone" href="' + esc(addTripHref(p)) + '" style="' + A_.kidStyle(p) + '"><span class="dotp" aria-hidden="true">' + A_.initial(p) + '</span> ' + esc(M.who(p)) + (p.id === me ? ' <small>(you)</small>' : "") + '</a>'; }).join("") + '</div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
  }

  window.FS_UI = { mailInbox: mailInbox, mailAddress: mailAddress, findPlaces: findPlaces, builder: builder, whoWentSheet: whoWentSheet, addTripHref: addTripHref, detail: detail, tripCard: tripCard, passport: passport, passportFamily: passportFamily, askDate: askDate, celebrate: celebrate,
                   lifetimeHTML: lifetimeHTML, bindLifetime: bindLifetime, printExtra: printExtra, loadPlaces: loadPlaces, loadAirports: loadAirports, ensureTowns: ensureTowns, routeSVG: routeSVG,
                   searchPlaces: searchPlaces, searchAirports: searchAirports, stampsOf: stampsOf, unitToggle: unitToggle, stopSpeech: stopSpeech, signs: signs,
                   sheet: sheet, closeSheet: closeSheet, dateFields: dateFields, readDate: readDate, shortArea: shortArea, stampName: stampName, CTX: CTX };
})();
