/* Famstamp importer: reads Google Maps Timeline, Takeout (Location History, saved places, Google Photos sidecars), KML/KMZ,
   GPX, GeoJSON, CSV and photo EXIF, and turns them into trips and places. Pure JavaScript with no browser parts, so the same
   code runs in the import Web Worker (import-worker.js), on the main thread as a fallback, and in Node for tests
   (node scripts/test_import.js). Files are read on the device; nothing here touches the network.

   Pipeline:  files -> parse (streaming for big JSON / zip entries) -> Collector (hour x 0.1-degree buckets, visits)
              -> entries (one per local day x place, with country / state / park / town from import-geo.js)
              -> detectTrips (runs of days away from home) + places + tracks -> review screen (import.js) -> app trips. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_IMPORT = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var AWAY_KM = 80, GAP_DAYS = 2, HOME_KM = 25, STOP_KM = 25, CELL = 0.1, MAX_ROUTE = 11, SMALL_JSON = 16e6, MAX_XML = 160e6;
  var US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
  var UK_NATIONS = ["ENG", "SCT", "WLS", "NIR"];

  // ---------- small helpers ----------
  function rad(d) { return d * Math.PI / 180; }
  function km(aLat, aLon, bLat, bLon) {
    var dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function okLL(lat, lon) {
    return typeof lat === "number" && typeof lon === "number" && isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
      !(Math.abs(lat) < 1e-6 && Math.abs(lon) < 1e-6);
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function utcDay(ms) { var d = new Date(ms); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function dayMs(d) { return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)); }
  function addDays(d, n) { return utcDay(dayMs(d) + n * 864e5); }
  function dayDiff(a, b) { return Math.round((dayMs(b) - dayMs(a)) / 864e5); }
  function str(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 120); }
  function num(v) { if (typeof v === "number") return v; if (typeof v === "string" && v.trim() !== "") return Number(v); return NaN; }
  /** "40.7128°, -74.006°" (Android), "geo:40.7128,-74.006" (iPhone), "40.7128,-74.006" */
  function parseLatLng(s) {
    if (s && typeof s === "object") {
      if ("latitudeE7" in s) return ll(num(s.latitudeE7) / 1e7, num(s.longitudeE7) / 1e7);
      if ("latE7" in s) return ll(num(s.latE7) / 1e7, num(s.lngE7) / 1e7);
      if ("latLng" in s) return parseLatLng(s.latLng);
      if ("LatLng" in s) return parseLatLng(s.LatLng);
      if ("latitude" in s) return ll(num(s.latitude), num(s.longitude));
      if ("lat" in s) return ll(num(s.lat), num(s.lng != null ? s.lng : s.lon));
      return null;
    }
    var m = /(-?\d+(?:\.\d+)?)\s*°?\s*,\s*(-?\d+(?:\.\d+)?)/.exec(String(s || ""));
    return m ? ll(+m[1], +m[2]) : null;
  }
  function ll(lat, lon) { return okLL(lat, lon) ? { lat: lat, lon: lon } : null; }
  /** Any timestamp Google or a CSV might use. Returns { ms, off } where off = minutes east of UTC if the text said so, or
      { ms, wall: "YYYY-MM-DD" } when it was a local wall-clock time with no zone (we trust its date as the local day). */
  function parseTime(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number" || /^\d{9,13}(\.\d+)?$/.test(String(v).trim())) {
      var n = Number(v); if (!isFinite(n)) return null;
      if (n < 1e11) n *= 1000;   // seconds
      return n > 0 && n < 4.2e12 ? { ms: Math.round(n), off: null } : null;
    }
    var s = String(v).trim();
    var m = /^(\d{4})[-:/](\d{2})[-:/](\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2}|UTC|GMT)?$/i.exec(s);
    if (!m) {
      var mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s);   // 6/14/2023 (US spreadsheets)
      if (mdy) return parseTime(mdy[3] + "-" + pad(+mdy[1]) + "-" + pad(+mdy[2]) + (mdy[4] ? "T" + pad(+mdy[4]) + ":" + mdy[5] : ""));
      return null;
    }
    var y = +m[1], mo = +m[2], d = +m[3], h = +(m[4] || 12), mi = +(m[5] || 0), se = +(m[6] || 0);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || y < 1900 || y > 2200) return null;
    var wallMs = Date.UTC(y, mo - 1, d, h, mi, se), z = m[7];
    if (!z) return { ms: wallMs, wall: m[1] + "-" + m[2] + "-" + m[3], off: null };
    if (/^(Z|UTC|GMT)$/i.test(z)) return { ms: wallMs, off: null, utc: true };
    var sign = z[0] === "-" ? -1 : 1, zz = z.slice(1).replace(":", ""), off = sign * (+zz.slice(0, 2) * 60 + +zz.slice(2, 4));
    return { ms: wallMs - off * 60000, off: off };
  }
  function hash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }

  // ---------- time zones: local day for a UTC instant, using the browser's own time zone data ----------
  var dtf = {}, offCache = new Map();
  function tzOffset(tz, ms) {
    var hk = tz + "|" + Math.floor(ms / 36e5), c = offCache.get(hk);
    if (c != null) return c;
    var f = dtf[tz], off;
    try {
      if (!f) f = dtf[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      var p = {}; f.formatToParts(new Date(Math.floor(ms / 36e5) * 36e5)).forEach(function (x) { p[x.type] = x.value; });
      var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
      off = Math.round((asUtc - Math.floor(ms / 36e5) * 36e5) / 6e4);
    } catch (e) { off = null; }
    if (offCache.size > 400000) offCache.clear();
    offCache.set(hk, off);
    return off;
  }
  /** Local calendar day for an instant. off (minutes) wins, then the place's time zone, then a longitude guess. */
  function localDay(ms, off, tz, lon) {
    if (off == null && tz) off = tzOffset(tz, ms);
    if (off == null) off = Math.round((lon || 0) / 15) * 60;
    return utcDay(ms + off * 60000);
  }

  // ---------- offline place lookup (import-geo.js) ----------
  /** G = FS_IMPORT_GEO; small = FS_IMPORT_TOWNS (optional: small-town rows, so stops get names like "Mineral Point, WI"). */
  function Geo(G, small) {
    if (!G) throw new Error("Place data didn't load.");
    function decode(list) {
      return list.map(function (s) {
        var rings = s[1].map(function (d) {
          var a = new Int32Array(d.length), x = 0, y = 0, bb = [1e9, 1e9, -1e9, -1e9];
          for (var i = 0; i < d.length; i += 2) { x += d[i]; y += d[i + 1]; a[i] = x; a[i + 1] = y; if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y; }
          return { p: a, bb: bb };
        });
        var bb = [1e9, 1e9, -1e9, -1e9];
        rings.forEach(function (r) { bb[0] = Math.min(bb[0], r.bb[0]); bb[1] = Math.min(bb[1], r.bb[1]); bb[2] = Math.max(bb[2], r.bb[2]); bb[3] = Math.max(bb[3], r.bb[3]); });
        return { id: s[0], rings: rings, bb: bb };
      });
    }
    function gridOf(shapes) {
      var g = {};
      shapes.forEach(function (s, i) {
        s.rings.forEach(function (r) {
          for (var gx = Math.floor((r.bb[0] - 60) / 1000); gx <= Math.floor((r.bb[2] + 60) / 1000); gx++)
            for (var gy = Math.floor((r.bb[1] - 60) / 1000); gy <= Math.floor((r.bb[3] + 60) / 1000); gy++) {
              var k = gx + "," + gy; (g[k] = g[k] || []); if (g[k].indexOf(i) < 0) g[k].push(i);
            }
        });
      });
      return g;
    }
    function inRing(r, x, y) {
      var p = r.p, n = p.length, inside = false;
      if (x < r.bb[0] || x > r.bb[2] || y < r.bb[1] || y > r.bb[3]) return false;
      for (var i = 0, j = n - 2; i < n; j = i, i += 2) {
        var xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    function find(shapes, grid, lat, lon, nearKm) {
      var x = Math.round(lon * 100), y = Math.round(lat * 100), cand = grid[Math.floor(x / 1000) + "," + Math.floor(y / 1000)] || [];
      for (var c = 0; c < cand.length; c++) { var s = shapes[cand[c]]; for (var r = 0; r < s.rings.length; r++) if (inRing(s.rings[r], x, y)) return s.id; }
      // just offshore, on a beach or a pier the simplified outline missed: take the nearest outline within nearKm
      var best = null, bd = nearKm;
      for (c = 0; c < cand.length; c++) {
        s = shapes[cand[c]];
        for (r = 0; r < s.rings.length; r++) {
          var R = s.rings[r]; if (x < R.bb[0] - 60 || x > R.bb[2] + 60 || y < R.bb[1] - 60 || y > R.bb[3] + 60) continue;
          for (var i = 0; i < R.p.length; i += 2) { var d = km(lat, lon, R.p[i + 1] / 100, R.p[i] / 100); if (d < bd) { bd = d; best = s.id; } }
        }
      }
      return best;
    }
    var countries = decode(G.countries), states = decode(G.states), cg = gridOf(countries), sg = gridOf(states);
    var T = { lat: [], lon: [], name: [], cc: [], a1: [], tz: [], pop: [] }, tg = {};
    (String(G.towns || "") + (small ? "\n" + small : "")).split("\n").forEach(function (row, i) {
      var c = row.split("\t"); if (c.length < 7) return;
      var k = T.lat.length; T.name.push(c[0]); T.lat.push(+c[1]); T.lon.push(+c[2]); T.cc.push(c[3]); T.a1.push(c[4]); T.tz.push(G.tz[+c[5]] || ""); T.pop.push(+c[6]);
      var gk = Math.floor(+c[1]) + "," + Math.floor(+c[2]); (tg[gk] = tg[gk] || []).push(k);
    });
    function nearTown(lat, lon, rings) {
      var best = -1, bd = 1e9, gy = Math.floor(lat), gx = Math.floor(lon);
      for (var dy = -rings; dy <= rings; dy++) for (var dx = -rings; dx <= rings; dx++) {
        var xx = gx + dx; if (xx < -180) xx += 360; if (xx >= 180) xx -= 360;
        var l = tg[(gy + dy) + "," + xx]; if (!l) continue;
        for (var i = 0; i < l.length; i++) { var k = l[i], d = km(lat, lon, T.lat[k], T.lon[k]); if (d < bd) { bd = d; best = k; } }
      }
      return best < 0 ? null : { i: best, km: bd };
    }
    var parks = Object.keys(G.parks || {}).map(function (id) { var p = G.parks[id]; return { id: id, lat: p[0], lon: p[1], r: p[2] }; });
    var cache = new Map();
    function lookup(lat, lon) {
      var key = Math.round(lat * 50) + "," + Math.round(lon * 50), hit = cache.get(key);
      if (hit) return hit;
      var c = find(countries, cg, lat, lon, 25), region = "", country = c || "";
      if (UK_NATIONS.indexOf(c) >= 0) { country = "GBR"; region = c; }
      if (c === "USA" || (!c && lat > 15 && lon < -60 && lon > -180)) {
        var st = find(states, sg, lat, lon, 25);
        if (st) { region = st; country = "USA"; if (!c) c = "USA"; }
      }
      var park = null, pd = 1e9;
      if (country === "USA" || country === "ASM" || country === "VIR" || !country) parks.forEach(function (p) { var d = km(lat, lon, p.lat, p.lon); if (d <= p.r && d < pd) { pd = d; park = p.id; } });
      var t = nearTown(lat, lon, 1), tz = "";
      if (t) tz = T.tz[t.i]; else { var far = nearTown(lat, lon, 4); if (far) tz = T.tz[far.i]; }
      var out = { c: c || "", country: country, region: region, park: park, tz: tz };
      if (t && t.km <= 45) {
        var ti = t.i;
        // right next to a city, say the city rather than the village on its edge (Paris, not Neuilly, for the Eiffel Tower)
        var t0 = ti;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var l = tg[(Math.floor(lat) + dy) + "," + (Math.floor(lon) + dx)] || [];
          for (var q = 0; q < l.length; q++) {
            var k2 = l[q], pk = T.pop[k2], dk = km(lat, lon, T.lat[k2], T.lon[k2]);
            if (pk <= T.pop[ti]) continue;
            if ((T.pop[t0] < 10 && pk >= 25 && dk < 10) || (pk >= 500 && pk >= 10 * T.pop[t0] && dk < 9)) ti = k2;
          }
        }
        out.town = T.name[ti]; out.townKm = Math.round(km(lat, lon, T.lat[ti], T.lon[ti]));
      }
      if (cache.size > 200000) cache.clear();
      cache.set(key, out);
      return out;
    }
    /** "Orlando" or "Orlando, FL" typed as the home town -> best matching town. */
    function findTown(text) {
      var q = str(text, 80).toLowerCase().replace(/\./g, ""); if (!q) return null;
      var parts = q.split(/\s*,\s*/), nm = parts[0], hint = (parts[1] || "").toUpperCase(), best = null;
      for (var k = 0; k < T.name.length; k++) {
        if (T.name[k].toLowerCase() !== nm) continue;
        var score = T.pop[k] + (T.cc[k] === "USA" ? 50 : 0) + (hint && (T.a1[k] === hint || T.cc[k] === hint) ? 1e6 : 0);
        if (!best || score > best.score) best = { score: score, k: k };
      }
      return best ? { lat: T.lat[best.k], lon: T.lon[best.k], name: T.name[best.k], country: T.cc[best.k], region: T.a1[best.k] } : null;
    }
    return { lookup: lookup, findTown: findTown, towns: T.name.length };
  }

  // ---------- streaming JSON: hands back each item of the big arrays without holding the whole file ----------
  /** want(path) says which containers to read: "[]" = items of a top-level array, "key[]" = items of a top-level key's
      array, "key" = a top-level key's object value. onItem(path, value). Feed text chunks in order, then call end(). */
  function JsonStream(want, onItem) {
    var buf = "", i = 0, depth = 0, stack = [], inStr = false, esc = false, strStart = -1, lastStr = null, key = null;
    var itemStart = -1, itemDepth = 0, itemPath = "", arrPath = null, items = 0, bad = 0;
    function push(text) {
      buf += text;
      var n = buf.length;
      while (i < n) {
        if (inStr) {
          var q = buf.indexOf('"', i);
          if (q < 0) { i = n; break; }
          var b = q - 1, slashes = 0; while (b >= i && buf.charCodeAt(b) === 92) { slashes++; b--; }
          if (esc) { esc = false; slashes++; }   // a backslash that ended the last chunk
          i = q + 1;
          if (slashes % 2 === 1) continue;
          inStr = false;
          if (strStart >= 0) { lastStr = buf.slice(strStart + 1, q); strStart = -1; }
          continue;
        }
        var c = buf.charCodeAt(i);
        if (c === 34) { inStr = true; strStart = depth === 1 && itemStart < 0 && stack[0] === 123 ? i : -1; i++; continue; }
        if (c === 58) { if (depth === 1) key = lastStr; i++; continue; }
        if (c === 123 || c === 91) {
          depth++; stack.push(c);
          if (itemStart < 0) {
            if (depth === 2 && stack[0] === 91) { if (c === 123 && want("[]")) { itemStart = i; itemDepth = 2; itemPath = "[]"; } }
            else if (depth === 2 && stack[0] === 123) {
              if (c === 91) arrPath = want(key + "[]") ? key + "[]" : null;
              else if (want(key)) { itemStart = i; itemDepth = 2; itemPath = key; }
            } else if (depth === 3 && arrPath && stack[1] === 91) { itemStart = i; itemDepth = 3; itemPath = arrPath; }
          }
          i++; continue;
        }
        if (c === 125 || c === 93) {
          if (itemStart >= 0 && depth === itemDepth) {
            var txt = buf.slice(itemStart, i + 1), v = null; itemStart = -1;
            try { v = JSON.parse(txt); } catch (e) { bad++; }
            if (v) { items++; onItem(itemPath, v); }
          }
          if (depth === 2 && stack[0] === 123 && c === 93) arrPath = null;
          depth--; stack.pop(); i++; continue;
        }
        i++;
      }
      // a string ending in an odd run of backslashes at the chunk edge: remember it
      if (inStr && i >= n) { var k = n - 1, s = 0; while (k >= 0 && buf.charCodeAt(k) === 92) { s++; k--; } esc = s % 2 === 1 && !esc; }
      var keep = itemStart >= 0 ? itemStart : (strStart >= 0 ? strStart : i);
      if (keep > 0) { buf = buf.slice(keep); i -= keep; if (itemStart >= 0) itemStart -= keep; if (strStart >= 0) strStart -= keep; }
    }
    return { push: push, end: function () { return { items: items, bad: bad, open: depth !== 0 }; } };
  }

  // ---------- collecting what the files say ----------
  /** Everything parsed lands here. Raw points and photos are bucketed by hour x 0.1-degree cell (or local day x cell when
      the local date is already known), so a 150 MB Records.json becomes a few thousand small buckets. */
  function Collector() {
    this.buckets = new Map(); this.visits = []; this.acts = []; this.places = []; this.tracks = []; this.homeHints = [];
    this.kinds = {}; this.warn = []; this.seenPhoto = new Set(); this.points = 0; this.photos = 0; this.skipped = 0; this.noLoc = 0;
    this.ptracks = {}; this.firstMs = Infinity; this.lastMs = -Infinity; this.psides = []; this.pmedia = new Map();
    this.photoList = []; this.located = []; this.unplaced = []; this.cameras = {}; this.notYours = 0; this.notWhy = {};
  }
  Collector.prototype.kind = function (k, n) { this.kinds[k] = (this.kinds[k] || 0) + (n == null ? 1 : n); };
  Collector.prototype.span = function (ms) { if (ms < this.firstMs) this.firstMs = ms; if (ms > this.lastMs) this.lastMs = ms; };
  /** A raw location fix or a photo. t = parseTime() result. */
  Collector.prototype.point = function (p, t, photo, unsure) {
    if (!p || !t) { this.skipped++; return; }
    var cy = Math.round(p.lat / CELL), cx = Math.round(p.lon / CELL), key = (unsure ? "U" : "") + (t.wall ? "D" + t.wall : "H" + Math.floor(t.ms / 36e5)) + "|" + cy + "," + cx;
    var b = this.buckets.get(key);
    if (!b) { b = { wall: t.wall || "", off: t.off, lat: 0, lon: 0, n: 0, ph: 0, t1: t.ms, t2: t.ms, unsure: unsure || "" }; this.buckets.set(key, b); }
    b.lat += p.lat; b.lon += p.lon; b.n++; if (photo) b.ph++;
    if (t.ms < b.t1) b.t1 = t.ms; if (t.ms > b.t2) b.t2 = t.ms; if (t.off != null) b.off = t.off;
    if (photo) this.photos++; else this.points++;
    this.span(t.ms);
  };
  /** A place visit with a start and end (Google Timeline / Semantic Location History). */
  Collector.prototype.visit = function (p, t1, t2, info) {
    if (!p || !t1) { this.skipped++; return; }
    if (!t2 || t2.ms < t1.ms) t2 = t1;
    info = info || {};
    if (t2.ms - t1.ms > 60 * 864e5) t2 = { ms: t1.ms + 864e5, off: t1.off };   // a "visit" over two months is a glitch
    this.visits.push({ lat: p.lat, lon: p.lon, t1: t1.ms, t2: t2.ms, off: t1.off != null ? t1.off : (t1.wall ? 0 : null), wall: !!t1.wall,
                       name: str(info.name, 80), addr: str(info.addr, 160), home: !!info.home });
    if (info.home) this.homeHints.push({ lat: p.lat, lon: p.lon, w: Math.max(1, (t2.ms - t1.ms) / 36e5), how: "timeline" });
    this.span(t1.ms); this.span(t2.ms);
  };
  Collector.prototype.activity = function (t1, t2, meters, type) {
    if (!t1) return;
    this.acts.push({ t1: t1.ms, t2: (t2 || t1).ms, m: isFinite(meters) && meters > 0 ? meters : 0, mode: actMode(type) });
  };
  function actMode(type) {
    var s = String(type || "").toUpperCase().replace(/\s+/g, "_");
    if (/FLY|PLANE|AIR/.test(s)) return "plane";
    if (/TRAIN|SUBWAY|TRAM|RAIL|METRO/.test(s)) return "train";
    if (/FERRY|BOAT|SAIL|KAYAK|ROW/.test(s)) return "boat";
    if (/WALK|RUN|HIK|FOOT/.test(s)) return "walk";
    return "car";
  }
  function semHome(s) { return /^(TYPE_)?(INFERRED_)?HOME$/i.test(String(s || "").replace(/\s+/g, "_")) || /^home$/i.test(String(s || "")); }

  // ---------- one handler per JSON shape ----------
  var JSON_PATHS = { "locations[]": 1, "semanticSegments[]": 1, "rawSignals[]": 1, "userLocationProfile": 1, "timelineObjects[]": 1, "features[]": 1, "[]": 1 };
  function wantPath(p) { return !!JSON_PATHS[p]; }
  function onItem(C, path, it, ctx) {
    if (!it || typeof it !== "object") return;
    if (path === "locations[]") return record(C, it);
    if (path === "semanticSegments[]" || path === "[]") {
      if (path === "[]" && it.photoTakenTime) return photoSidecar(C, it, ctx);
      if (path === "[]" && (it.type === "Feature" || it.geometry)) return feature(C, it, ctx);
      return segment(C, it);
    }
    if (path === "rawSignals[]") { var pos = it.position; if (pos) { C.point(parseLatLng(pos.LatLng || pos.latLng), parseTime(pos.timestamp)); C.kind("timeline-raw"); } return; }
    if (path === "userLocationProfile") {
      (it.frequentPlaces || []).forEach(function (f) {
        if (/home/i.test(f.label || "")) { var p = parseLatLng(f.placeLocation); if (p) C.homeHints.push({ lat: p.lat, lon: p.lon, w: 1e6, how: "timeline" }); }
      });
      return;
    }
    if (path === "timelineObjects[]") return semantic(C, it);
    if (path === "features[]") return feature(C, it, ctx);
  }
  /** Takeout Records.json: { latitudeE7, longitudeE7, accuracy, timestamp | timestampMs } */
  function record(C, it) {
    if (it.accuracy != null && num(it.accuracy) > 2500) { C.skipped++; return; }
    C.point(ll(num(it.latitudeE7) / 1e7, num(it.longitudeE7) / 1e7), parseTime(it.timestamp != null ? it.timestamp : it.timestampMs));
    C.kind("records");
  }
  /** On-device Timeline export, Android (Timeline.json semanticSegments) and iPhone (location-history.json, a plain array). */
  function segment(C, it) {
    var t1 = parseTime(it.startTime), t2 = parseTime(it.endTime);
    if (t1 && it.startTimeTimezoneUtcOffsetMinutes != null && t1.off == null && !t1.wall) t1.off = num(it.startTimeTimezoneUtcOffsetMinutes);
    if (t2 && it.endTimeTimezoneUtcOffsetMinutes != null && t2.off == null && !t2.wall) t2.off = num(it.endTimeTimezoneUtcOffsetMinutes);
    var kind = Array.isArray(it.timelinePath) || it.visit || it.activity ? (C.ios ? "timeline-ios" : "timeline") : null;
    if (it.visit) {
      var tc = it.visit.topCandidate || {}, p = parseLatLng(tc.placeLocation && (tc.placeLocation.latLng || tc.placeLocation));
      C.visit(p, t1, t2, { home: semHome(tc.semanticType), name: "" });
    }
    if (it.activity) {
      var a = it.activity, tca = a.topCandidate || {};
      C.activity(t1, t2, num(a.distanceMeters), tca.type);
      var s = parseLatLng(a.start && (a.start.latLng || a.start)), e = parseLatLng(a.end && (a.end.latLng || a.end));
      if (s && t1) C.point(s, t1); if (e && t2) C.point(e, t2);
    }
    if (Array.isArray(it.timelinePath)) it.timelinePath.forEach(function (q) {
      var p = parseLatLng(q.point), t = q.time ? parseTime(q.time) : (t1 && q.durationMinutesOffsetFromStartTime != null ? { ms: t1.ms + num(q.durationMinutesOffsetFromStartTime) * 6e4, off: t1.off, wall: null } : null);
      if (t && t.wall === null) delete t.wall;
      C.point(p, t);
    });
    if (it.timelineMemory || it.timelineEdit) return;
    if (kind) C.kind(/geo:/.test(JSON.stringify(it).slice(0, 400)) ? "timeline-ios" : "timeline");
  }
  /** Takeout Semantic Location History (monthly files): placeVisit / activitySegment. */
  function semantic(C, it) {
    function dur(d, k) { return d ? parseTime(d[k + "Timestamp"] != null ? d[k + "Timestamp"] : d[k + "TimestampMs"]) : null; }
    if (it.placeVisit) {
      var v = it.placeVisit, L = v.location || {}, p = parseLatLng(L);
      C.visit(p, dur(v.duration, "start"), dur(v.duration, "end"), { name: L.name, addr: L.address, home: semHome(L.semanticType) });
      C.kind("semantic");
    } else if (it.activitySegment) {
      var a = it.activitySegment, t1 = dur(a.duration, "start"), t2 = dur(a.duration, "end");
      C.activity(t1, t2, num(a.distance), a.activityType);
      var s = parseLatLng(a.startLocation || {}), e = parseLatLng(a.endLocation || {});
      if (s && t1) C.point(s, t1); if (e && t2) C.point(e, t2);
      C.kind("semantic");
    }
  }
  /** Google Photos Takeout sidecar (IMG_1234.jpg.json, .supplemental-metadata.json, .supplemental-metadata(1).json, cut-off
      names like .supp.json). Matched to its photo later (flushPhotos), because the photo's own EXIF is often the better source:
      many sidecars say 0,0 even when the JPEG has GPS. */
  function photoSidecar(C, it, cx) {
    var t = parseTime(it.photoTakenTime && it.photoTakenTime.timestamp), g = it.geoData, ge = it.geoDataExif;
    var p = (g && ll(num(g.latitude), num(g.longitude))) || (ge && ll(num(ge.latitude), num(ge.longitude)));
    C.kind("photos-takeout");
    var o = it.googlePhotosOrigin || {}, origin = "", folder = "";
    if (o.mobileUpload) { origin = "mobile"; folder = str(o.mobileUpload.deviceFolder && o.mobileUpload.deviceFolder.localFolderName, 80); }
    else if (o.webUpload) origin = "web";
    else if (o.fromPartnerSharing) origin = "partner";
    else if (o.fromSharedAlbum) origin = "shared";
    else { var k0 = Object.keys(o)[0] || ""; origin = /third.?party|app/i.test(k0) ? "app" : /drive|desktop/i.test(k0) ? "desktop" : k0 ? "other" : ""; }
    C.psides.push({ path: cx && cx.path || "", title: str(it.title, 200), t: t, p: p, origin: origin, folder: folder });
  }
  // ---------- whose photo is it? ----------
  var DOWNLOADED = /^(screenshot|screen[ _-]?shot|screen[ _-]?recording|fb_img|received_|img-\d{8}-wa|images?\s*(\(\d+\))?\.|unnamed|download)|download|[0-9a-f]{24,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  var STOCK = /unsplash|pexels|pixabay|shutterstock|istock|gettyimages|adobestock|depositphotos|dreamstime|wallpaper|^[a-z]+(-[a-z]+)*-\d{5,7}(_\d+)?(-[a-z0-9]+)*\.[a-z]+$/i;
  var SAVED_FOLDER = /screenshot|download|whatsapp|messenger|telegram|facebook|instagram|twitter|pinterest|reddit|saved|browser|chrome/i;
  function cameraName(make, model) {
    make = str(make, 40); model = str(model, 60);
    if (/^(unknown|none|default|null)$/i.test(make)) make = "";
    if (/^(unknown|none|default|null)$/i.test(model)) model = "";
    if (!make && !model) return "";
    if (make && model.toLowerCase().indexOf(make.toLowerCase().split(" ")[0]) === 0) return model;
    return (make + " " + model).trim();
  }
  /** "own", "unsure" (ask on the review screen) or "no" (skip), and why. ph = { name, camera, origin, folder, src }. prefs: camera -> "mine" | "not". */
  function photoTrust(ph, prefs) {
    var cam = ph.camera, pref = cam && prefs ? prefs[cam] : null;
    if (pref === "not") return { level: "no", why: "camera" };
    if (pref === "mine") return { level: "own" };
    if (ph.origin === "shared") return { level: "no", why: "shared" };
    if (ph.src === "csv-unsure") return { level: "unsure", why: "nocamera" };
    if ((DOWNLOADED.test(ph.name || "") || STOCK.test(ph.name || "")) && !/^snapchat-/i.test(ph.name || "")) return { level: "unsure", why: "download" };
    if (cam) return { level: "own" };
    if (/^snapchat-/i.test(ph.name || "") || ph.origin === "app") return { level: "own" };
    if (ph.origin === "mobile") return ph.folder && SAVED_FOLDER.test(ph.folder) ? { level: "unsure", why: "download" } : { level: "own" };
    if (ph.origin === "partner" || ph.origin === "desktop" || ph.src === "csv") return { level: "own" };
    if (ph.origin === "web") return { level: "unsure", why: "web" };
    return { level: "unsure", why: "nocamera" };
  }
  /** Where a sidecar's photo should be: "dir/IMG_1.jpg.supplemental-metadata(2).json" -> "dir/IMG_1(2).jpg". */
  function sidecarMedia(path, title) {
    var slash = path.lastIndexOf("/"), dir = path.slice(0, slash + 1), base = path.slice(slash + 1), out = [];
    var dup = /\((\d+)\)\.json$/i.exec(base), stem = base.replace(/(\(\d+\))?\.json$/i, "");
    var dot = stem.lastIndexOf("."), tail = dot > 0 ? stem.slice(dot + 1).toLowerCase() : "";
    var cut = tail && "supplemental-metadata".indexOf(tail) === 0 ? dot : -1;   // ".supplemental-metadata", or cut short: ".supplemental-metad", ".supp"
    var media = cut > 0 && /\.[a-z0-9]{2,4}$/i.test(stem.slice(0, cut)) ? stem.slice(0, cut) : stem;
    function withN(n) { var i = n.lastIndexOf("."); return dup ? (i > 0 ? n.slice(0, i) + "(" + dup[1] + ")" + n.slice(i) : n + "(" + dup[1] + ")") : n; }
    out.push(dir + withN(media));
    if (title && title !== media) out.push(dir + withN(title));
    return out;
  }
  /** Joins sidecars to their photos (EXIF first for both place and time, then the sidecar), drops album copies, decides
      whose photo each one is, and sorts them into located photos and ones still to be placed by time (finalize). */
  Collector.prototype.flushPhotos = function (prefs) {
    var C = this, byMedia = new Map(), used = new Set();
    C.psides.forEach(function (s) { if (s.path) sidecarMedia(s.path, s.title).forEach(function (m) { if (!byMedia.has(m)) byMedia.set(m, s); }); });
    C.pmedia.forEach(function (m, path) {
      var s = byMedia.get(path); if (s) used.add(s);
      if (m.loc && s && !s.p) C.kind("exif-gps");
      C.photoList.push({ name: baseName(path), t: m.time || (s && s.t) || null, p: m.loc || (s && s.p) || null, camera: cameraName(m.make, m.model),
                         origin: s ? s.origin : "", folder: s ? s.folder : "", exifTime: !!m.time });
    });
    C.psides.forEach(function (s) { if (!used.has(s)) C.photoList.push({ name: s.title || baseName(s.path), t: s.t, p: s.p, camera: "", origin: s.origin, folder: s.folder }); });
    C.photoList.forEach(function (ph) {
      if (!ph.t) { C.skipped++; return; }
      var k = String(ph.name).replace(/-(edited|bearbeitet|modifié|editado|modificato)(?=\.[^.]+$)/i, "") + "|" + ph.t.ms;   // an edited copy is the same photo
      if (C.seenPhoto.has(k)) { C.kind("photo-dupes"); return; }   // the same photo shows up in "Photos from 2019" and in each album
      C.seenPhoto.add(k);
      var tr = photoTrust(ph, prefs);
      if (ph.camera) { var cs = C.cameras[ph.camera] || (C.cameras[ph.camera] = { n: 0, gps: 0 }); cs.n++; if (ph.p) cs.gps++; }
      if (tr.level === "no") { C.notYours++; C.notWhy[tr.why] = (C.notWhy[tr.why] || 0) + 1; return; }
      if (ph.p) { C.point(ph.p, ph.t, true, tr.level === "unsure" ? tr.why : null); if (tr.level === "own") C.located.push({ lat: ph.p.lat, lon: ph.p.lon, ms: ph.t.ms, wall: !!ph.t.wall, off: ph.t.off }); }
      else if (tr.level === "own") C.unplaced.push({ t: ph.t, camera: ph.camera });   // placed by time later, or counted on a trip
      else C.noLoc++;
    });
    C.psides = []; C.pmedia = new Map(); C.photoList = [];
  };
  function urlLL(u) {
    var s = String(u || ""), m = /[?&](?:q|ll|query|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(s) || /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s) || /\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/.exec(s) ||
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(s);
    return m ? ll(+m[1], +m[2]) : null;
  }
  function dateProp(pr) {
    var keys = ["date", "visited", "visit_date", "time", "timestamp", "when", "datetime", "start", "begin", "taken_at", "Date", "Time", "Timestamp"];
    for (var i = 0; i < keys.length; i++) if (pr[keys[i]] != null) { var t = parseTime(pr[keys[i]]); if (t) return t; }
    return null;
  }
  /** GeoJSON feature: Takeout saved places (Saved Places.json), a plain point (with or without a date), or a line. */
  function feature(C, f, ctx) {
    var g = f.geometry || {}, pr = f.properties || {}, loc = pr.location || pr.Location || {};
    var gmaps = pr.google_maps_url || pr["Google Maps URL"];
    if (g.type === "Point" || gmaps) {
      var c = g.coordinates || [], p = ll(num(c[1]), num(c[0])) || urlLL(gmaps);
      var geo = loc["Geo Coordinates"]; if (!p && geo) p = ll(num(geo.Latitude), num(geo.Longitude));
      var name = str(loc.name || loc["Business Name"] || pr.name || pr.Name || pr.title || pr.Title || loc.address || loc.Address, 100);
      if (gmaps) {   // a starred / saved place
        C.places.push({ name: name || "Saved place", lat: p ? p.lat : null, lon: p ? p.lon : null, addr: str(loc.address || loc.Address, 160), url: str(gmaps, 300),
                        note: str(pr.Comment || pr.comment || pr.note, 280), list: ctx.list || "Saved places", date: (parseTime(pr.date || pr.Published) || {}).ms || null });
        C.kind("saved-places"); if (!p) C.noLoc++; return;
      }
      var t = dateProp(pr);
      if (t && p) { C.visit(p, t, t.wall ? t : { ms: t.ms + 36e5, off: t.off }, { name: name }); C.kind("geojson-dated"); return; }
      if (p) { C.places.push({ name: name || "Place", lat: p.lat, lon: p.lon, note: str(pr.description || pr.note, 280), list: ctx.list || "Map points" }); C.kind("geojson-places"); }
      return;
    }
    if (g.type === "LineString" || g.type === "MultiLineString") {
      var lines = g.type === "LineString" ? [g.coordinates] : g.coordinates, times = pr.coordTimes || (pr.coordinateProperties && pr.coordinateProperties.times) || null;
      var pts = [];
      (lines || []).forEach(function (line, li) {
        var tl = Array.isArray(times) && Array.isArray(times[0]) ? times[li] : times;
        (line || []).forEach(function (q, qi) { var p = ll(num(q[1]), num(q[0])); if (p) { var t = tl && tl[qi] ? parseTime(tl[qi]) : null; pts.push([p.lat, p.lon, t ? t.ms : null, t ? t.off : null]); } });
      });
      if (pts.length > 1) { C.tracks.push({ name: str(pr.name || pr.Name || pr.title, 80) || ctx.docName || "Route", pts: pts, wpts: [], src: "geojson", t0: (dateProp(pr) || {}).ms || null }); C.kind("geojson-lines"); }
    }
  }

  // ---------- CSV ----------
  /** Streaming CSV rows (quotes, commas and newlines inside quotes all handled). */
  function CsvStream(onRow) {
    var row = [], field = "", inQ = false, pending = "", lastWasQuote = false;
    function push(text) {
      var s = pending + text; pending = "";
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (inQ) {
          if (c === '"') { if (i + 1 >= s.length) { pending = '"'; return; } if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
          else field += c;
          continue;
        }
        if (c === '"') { if (field === "") inQ = true; else field += c; }
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\r") { /* CRLF: the \n ends the row */ }
        else if (c === "\n") { row.push(field); field = ""; emit(); }
        else field += c;
      }
    }
    function emit() { if (row.length > 1 || (row[0] || "").trim() !== "") onRow(row); row = []; }
    return { push: push, end: function () { if (pending === '"') inQ = false; if (field !== "" || row.length) { row.push(field); field = ""; emit(); } } };
  }
  function csvHandler(C, ctx) {
    var head = null, col = {}, n = 0, savedList = false;
    function pick(names) { for (var i = 0; i < head.length; i++) if (names.indexOf(head[i]) >= 0) return i; return -1; }
    return CsvStream(function (r) {
      if (!head) {
        head = r.map(function (h) { return String(h).replace(/^\ufeff/, "").trim().toLowerCase().replace(/[\s-]+/g, "_"); });
        col = { lat: pick(["lat", "latitude", "lat_deg", "y"]), lon: pick(["lng", "lon", "long", "longitude", "lon_deg", "x"]),
                name: pick(["name", "title", "place", "location", "label"]), date: pick(["taken_at", "date", "datetime", "time", "timestamp", "start", "start_time", "visited", "when"]),
                end: pick(["end", "end_time", "end_date"]), trust: pick(["trust", "mine"]), camera: pick(["camera"]), note: pick(["note", "notes", "comment", "description"]), url: pick(["url", "link", "google_maps_url"]) };
        if (col.lat < 0 && col.url >= 0 && col.name >= 0) savedList = true;   // Takeout "Saved" list: Title, Note, URL
        else if (col.lat < 0 || col.lon < 0) { C.warn.push(ctx.name + ": no latitude / longitude columns, so it was skipped."); head = []; }
        ctx.photoCsv = head[0] === "taken_at" || /photo/i.test(ctx.name);
        return;
      }
      if (!head.length) return;
      n++;
      function v(i) { return i >= 0 ? str(r[i], 300) : ""; }
      if (savedList) {
        var u = v(col.url), p = urlLL(u);
        if (!v(col.name) && !u) return;
        C.places.push({ name: v(col.name) || "Saved place", lat: p ? p.lat : null, lon: p ? p.lon : null, url: u, note: v(col.note), list: ctx.list || "Saved list" });
        if (!p) C.noLoc++; C.kind("saved-list"); return;
      }
      var q = ll(num(v(col.lat)), num(v(col.lon)));
      if (!q && !(ctx.photoCsv && v(col.date))) { C.skipped++; return; }   // photo rows may have no place yet: placed by time
      var t = col.date >= 0 ? parseTime(v(col.date)) : null;
      if (ctx.photoCsv && !t) { C.skipped++; return; }
      if (ctx.photoCsv && t) {
        var trust = col.trust >= 0 ? v(col.trust).toLowerCase() : "";
        if (trust === "no" || trust === "not") { C.notYours++; return; }
        C.photoList.push({ name: v(col.name) || "csv:" + n, t: t, p: q, camera: col.camera >= 0 ? v(col.camera) : "", origin: "", src: trust === "unsure" ? "csv-unsure" : "csv" });
        C.kind("photo-csv"); return;
      }
      if (t) { var e = col.end >= 0 ? parseTime(v(col.end)) : null; C.visit(q, t, e || (t.wall ? t : { ms: t.ms + 36e5, off: t.off }), { name: v(col.name) }); C.kind("csv-dated"); return; }
      C.places.push({ name: v(col.name) || "Place", lat: q.lat, lon: q.lon, note: v(col.note), url: v(col.url), list: ctx.list || "CSV places" }); C.kind("csv-places");
    });
  }

  // ---------- KML (Google My Maps / Earth) and GPX ----------
  function xmlText(s) {
    if (s == null) return "";
    s = String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ");
    return str(s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, "&"), 280);
  }
  function tag(block, name) { var m = new RegExp("<(?:\\w+:)?" + name + "\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?" + name + ">", "i").exec(block); return m ? m[1] : null; }
  function coordsList(s) {
    var out = []; String(s || "").trim().split(/\s+/).forEach(function (tok) { var c = tok.split(","), p = ll(num(c[1]), num(c[0])); if (p) out.push(p); }); return out;
  }
  function parseKML(C, text, ctx) {
    var docName = xmlText(tag(text, "name")) || ctx.list, n = 0;
    // Walk folders so each My Maps layer becomes its own list
    var re = /<Folder\b[\s\S]*?<\/Folder>|<Placemark\b[\s\S]*?<\/Placemark>/gi, m;
    function placemark(pm, list) {
      n++;
      var name = xmlText(tag(pm, "name")), desc = xmlText(tag(pm, "description"));
      var when = parseTime(xmlText(tag(pm, "when"))), begin = parseTime(xmlText(tag(pm, "begin"))), end = parseTime(xmlText(tag(pm, "end")));
      var track = /<gx:Track\b[\s\S]*?<\/gx:Track>/i.exec(pm);
      if (track) {   // Google Earth / old Location History KML: <when> + <gx:coord lon lat alt>
        var ws = track[0].match(/<when>[^<]*<\/when>/gi) || [], cs = track[0].match(/<gx:coord>[^<]*<\/gx:coord>/gi) || [], pts = [];
        for (var i = 0; i < Math.min(ws.length, cs.length); i++) {
          var t = parseTime(xmlText(ws[i])), c = xmlText(cs[i]).split(/\s+/), p = ll(num(c[1]), num(c[0]));
          if (p && t) pts.push([p.lat, p.lon, t.ms, t.off]);
        }
        if (pts.length > 1) C.tracks.push({ name: name || docName || "Track", pts: pts, wpts: [], src: "kml" });
        C.kind("kml-tracks"); return;
      }
      var lines = pm.match(/<LineString\b[\s\S]*?<\/LineString>/gi);
      if (lines) {
        var lp = []; lines.forEach(function (L) { coordsList(tag(L, "coordinates")).forEach(function (p) { lp.push([p.lat, p.lon, null, null]); }); });
        if (lp.length > 1) C.tracks.push({ name: name || docName || "Route", pts: lp, wpts: [], src: "kml", t0: (when || begin || {}).ms || null });
        C.kind("kml-lines"); return;
      }
      var pt = /<Point\b[\s\S]*?<\/Point>/i.exec(pm), pp = pt ? coordsList(tag(pt[0], "coordinates"))[0] : null;
      if (!pp) { var poly = /<Polygon\b[\s\S]*?<\/Polygon>/i.exec(pm); if (poly) { var ring = coordsList(tag(poly[0], "coordinates")); if (ring.length) pp = centerOf(ring); } }
      if (!pp) { C.skipped++; return; }
      var t1 = when || begin;
      if (t1) { C.visit(pp, t1, end || (t1.wall ? t1 : { ms: t1.ms + 36e5, off: t1.off }), { name: name }); C.kind("kml-dated"); }
      else { C.places.push({ name: name || "Place", lat: pp.lat, lon: pp.lon, note: desc, list: list || docName || "My Maps" }); C.kind("kml-places"); }
    }
    while ((m = re.exec(text))) {
      if (/^<Folder/i.test(m[0])) {
        var fname = xmlText(tag(m[0].replace(/<Placemark\b[\s\S]*$/i, ""), "name")) || docName;
        var pms = m[0].match(/<Placemark\b[\s\S]*?<\/Placemark>/gi) || [];
        pms.forEach(function (pm) { placemark(pm, (docName && fname !== docName ? docName + ": " : "") + fname); });
      } else placemark(m[0], docName);
    }
    if (!n) C.warn.push((ctx.name || "KML") + ": no placemarks found.");
    ctx.docName = docName;
  }
  function attr(s, a) { var m = new RegExp("\\b" + a + "\\s*=\\s*[\"']([^\"']*)[\"']", "i").exec(s); return m ? m[1] : null; }
  function parseGPX(C, text, ctx) {
    var meta = tag(text, "metadata"), fileName = xmlText(meta ? tag(meta, "name") : null);
    var wpts = [], tracks = 0;
    (text.match(/<wpt\b[\s\S]*?(?:<\/wpt>|\/>)/gi) || []).forEach(function (w) {
      var p = ll(num(attr(w, "lat")), num(attr(w, "lon"))); if (!p) return;
      var t = parseTime(xmlText(tag(w, "time")));
      wpts.push({ lat: p.lat, lon: p.lon, name: xmlText(tag(w, "name")), t: t ? t.ms : null, off: t ? t.off : null });
    });
    function pts(block, el) {
      var out = [], re = new RegExp("<" + el + "\\b([^>]*?)(?:/>|>([\\s\\S]*?)</" + el + ">)", "gi"), m;
      while ((m = re.exec(block))) { var p = ll(num(attr(m[1], "lat")), num(attr(m[1], "lon"))); if (!p) continue; var t = m[2] ? parseTime(xmlText(tag(m[2], "time"))) : null; out.push([p.lat, p.lon, t ? t.ms : null, t ? t.off : null]); }
      return out;
    }
    (text.match(/<trk\b[\s\S]*?<\/trk>/gi) || []).forEach(function (trk) {
      var p = pts(trk, "trkpt"); if (p.length < 2) return; tracks++;
      C.tracks.push({ name: xmlText(tag(trk.replace(/<trkseg[\s\S]*$/i, ""), "name")) || fileName || str(ctx.name.replace(/\.gpx$/i, ""), 60) || "Track", pts: p, wpts: wpts, src: "gpx" });
    });
    (text.match(/<rte\b[\s\S]*?<\/rte>/gi) || []).forEach(function (rte) {
      var p = pts(rte, "rtept"); if (p.length < 2) return; tracks++;
      C.tracks.push({ name: xmlText(tag(rte.replace(/<rtept[\s\S]*$/i, ""), "name")) || fileName || "Route", pts: p, wpts: wpts, src: "gpx" });
    });
    if (!tracks) wpts.forEach(function (w) {   // waypoints only: dated ones are stops, the rest are places
      if (w.t) C.visit(w, { ms: w.t, off: w.off }, { ms: w.t + 36e5, off: w.off }, { name: w.name });
      else C.places.push({ name: w.name || "Waypoint", lat: w.lat, lon: w.lon, list: fileName || "GPX waypoints" });
    });
    C.kind("gpx");
    if (!tracks && !wpts.length) C.warn.push((ctx.name || "GPX") + ": no tracks or waypoints found.");
  }
  function centerOf(list) {   // mean of unit vectors, so a cluster on the 180th meridian doesn't average to 0
    var x = 0, y = 0, z = 0;
    list.forEach(function (p) { var la = rad(p.lat), lo = rad(p.lon); x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la); });
    var h = Math.sqrt(x * x + y * y);
    return { lat: Math.atan2(z, h) * 180 / Math.PI, lon: Math.atan2(y, x) * 180 / Math.PI };
  }

  // ---------- photo EXIF (JPEG / HEIC / TIFF / DNG): GPS + date from the first 128 KB ----------
  function exif(buf) {
    var u = new Uint8Array(buf), n = u.length, tiff = -1;
    if (u[0] === 0x49 && u[1] === 0x49 && u[2] === 0x2a || u[0] === 0x4d && u[1] === 0x4d && u[3] === 0x2a) tiff = 0;
    for (var i = 0; tiff < 0 && i < n - 10; i++) {
      if (u[i] === 0x45 && u[i + 1] === 0x78 && u[i + 2] === 0x69 && u[i + 3] === 0x66 && u[i + 4] === 0 && u[i + 5] === 0 &&
          ((u[i + 6] === 0x49 && u[i + 7] === 0x49 && u[i + 8] === 0x2a) || (u[i + 6] === 0x4d && u[i + 7] === 0x4d && u[i + 9] === 0x2a))) tiff = i + 6;
    }
    if (tiff < 0) return null;
    var dv = new DataView(u.buffer, u.byteOffset, u.byteLength), le = u[tiff] === 0x49;
    function u16(o) { return dv.getUint16(tiff + o, le); }
    function u32(o) { return dv.getUint32(tiff + o, le); }
    function ifd(off) {
      var out = {}; if (!off || tiff + off + 2 > n) return out;
      var cnt = u16(off); if (cnt > 500) return out;
      for (var k = 0; k < cnt; k++) {
        var e = off + 2 + k * 12; if (tiff + e + 12 > n) break;
        var type = u16(e + 2), count = u32(e + 4), size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 1) * count;
        out[u16(e)] = { type: type, count: count, at: size <= 4 ? e + 8 : u32(e + 8) };
      }
      return out;
    }
    function ascii(t) { if (!t || t.type !== 2) return ""; var s = ""; for (var k = 0; k < t.count && tiff + t.at + k < n; k++) { var ch = u[tiff + t.at + k]; if (!ch) break; s += String.fromCharCode(ch); } return s; }
    function rats(t) { var out = []; if (!t || t.type !== 5) return out; for (var k = 0; k < t.count; k++) { if (tiff + t.at + k * 8 + 8 > n) return []; var a = u32(t.at + k * 8), b = u32(t.at + k * 8 + 4); out.push(b ? a / b : NaN); } return out; }
    try {
      var i0 = ifd(u32(4)), ex = i0[0x8769] ? ifd(u32(i0[0x8769].at)) : {}, gp = i0[0x8825] ? ifd(u32(i0[0x8825].at)) : {};
      var dto = ascii(ex[0x9003]) || ascii(i0[0x0132]), offs = ascii(ex[0x9011]), out = { make: str(ascii(i0[0x010f]), 40), model: str(ascii(i0[0x0110]), 60) };
      var m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dto);
      if (m) out.time = parseTime(m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + (/^[+-]\d{2}:\d{2}$/.test(offs) ? offs : ""));
      var la = rats(gp[2]), lo = rats(gp[4]);
      if (la.length === 3 && lo.length === 3) {
        var lat = la[0] + la[1] / 60 + la[2] / 3600, lon = lo[0] + lo[1] / 60 + lo[2] / 3600;
        if (/S/i.test(ascii(gp[1]))) lat = -lat; if (/W/i.test(ascii(gp[3]))) lon = -lon;
        out.loc = ll(lat, lon);
        if (!out.loc && gp[2]) out.redacted = true;   // Android's photo picker zeroes these out
      }
      if (!out.time) {   // no camera date: GPS date + time are UTC
        var gd = /^(\d{4}):(\d{2}):(\d{2})/.exec(ascii(gp[0x1d])), gt = rats(gp[7]);
        if (gd && gt.length === 3 && isFinite(gt[0])) out.time = { ms: Date.UTC(+gd[1], +gd[2] - 1, +gd[3], gt[0], gt[1], Math.floor(gt[2])), off: null };
      }
      return out;
    } catch (e) { return null; }
  }

  // ---------- zip (Takeout, KMZ): central directory only, so a 50 GB Photos zip costs a few reads ----------
  function rd(blob, a, b) { return blob.slice(a, b).arrayBuffer().then(function (x) { return new DataView(x); }); }
  function zipEntries(blob) {
    var size = blob.size, tail = Math.min(size, 65557 + 20);
    return rd(blob, size - tail, size).then(function (dv) {
      var e = -1;
      for (var i = dv.byteLength - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
      if (e < 0) throw new Error("This zip file looks damaged or incomplete. If it was still downloading, wait for it to finish.");
      var count = dv.getUint16(e + 10, true), cdSize = dv.getUint32(e + 12, true), cdOff = dv.getUint32(e + 16, true);
      var z64 = count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff;
      if (z64 && e >= 20 && dv.getUint32(e - 20, true) === 0x07064b50) {
        var at = Number(dv.getBigUint64 ? dv.getBigUint64(e - 12, true) : dv.getUint32(e - 12, true) + dv.getUint32(e - 8, true) * 4294967296);
        return rd(blob, at, at + 56).then(function (z) {
          if (z.getUint32(0, true) !== 0x06064b50) throw new Error("This zip file looks damaged.");
          return readCD(blob, u64(z, 48), u64(z, 40));
        });
      }
      return readCD(blob, cdOff, cdSize);
    });
  }
  function u64(dv, o) { return dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 4294967296; }
  function readCD(blob, off, len) {
    return rd(blob, off, off + len).then(function (dv) {
      var out = [], p = 0, dec = new TextDecoder();
      while (p + 46 <= dv.byteLength && dv.getUint32(p, true) === 0x02014b50) {
        var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
        var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
        var name = dec.decode(new Uint8Array(dv.buffer, dv.byteOffset + p + 46, nl));
        var x = p + 46 + nl, xe = x + xl;
        while (x + 4 <= xe) {   // ZIP64 extra field: the real sizes / offset for big entries
          var id = dv.getUint16(x, true), sz = dv.getUint16(x + 2, true), q = x + 4;
          if (id === 1) {
            if (usize === 0xffffffff) { usize = u64(dv, q); q += 8; }
            if (csize === 0xffffffff) { csize = u64(dv, q); q += 8; }
            if (lho === 0xffffffff) { lho = u64(dv, q); }
          }
          x += 4 + sz;
        }
        out.push({ name: name, method: method, csize: csize, usize: usize, off: lho });
        p = xe + cl;
      }
      return out;
    });
  }
  /** One zip entry as a Blob-like source with .size and a chunked reader. */
  function zipSource(blob, ent) {
    return rd(blob, ent.off, ent.off + 30).then(function (dv) {
      if (dv.getUint32(0, true) !== 0x04034b50) throw new Error("bad zip entry");
      var start = ent.off + 30 + dv.getUint16(26, true) + dv.getUint16(28, true), data = blob.slice(start, start + ent.csize);
      if (ent.method === 0) return { name: ent.name, size: ent.usize, blob: data, csize: ent.csize };
      if (ent.method !== 8) throw new Error("unsupported compression");
      if (typeof DecompressionStream === "undefined") throw new Error("This browser can't open zip files. Unzip it first and pick the files inside.");
      return { name: ent.name, size: ent.usize, csize: ent.csize, stream: function () { return data.stream().pipeThrough(new DecompressionStream("deflate-raw")); } };
    });
  }
  /** The first max bytes of an entry, inflating only that much (a 6 MB JPEG costs one ~130 KB read). */
  function zipHead(blob, ent, max) {
    var extraGuess = 600 + ent.name.length * 2, want = ent.method === 0 ? max : Math.min(ent.csize, max + (max >> 2) + 4096);
    return blob.slice(ent.off, ent.off + 30 + extraGuess + want).arrayBuffer().then(function (ab) {
      var dv = new DataView(ab);
      if (dv.getUint32(0, true) !== 0x04034b50) throw new Error("bad zip entry");
      var start = 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
      var data = new Uint8Array(ab, start, Math.max(0, Math.min(ab.byteLength - start, ent.method === 0 ? Math.min(ent.csize, max) : want)));
      if (ent.method === 0) return data.slice().buffer;
      if (ent.method !== 8) throw new Error("unsupported compression");
      var reader = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader(), parts = [], got = 0;
      function done() {
        try { reader.cancel().catch(function () {}); } catch (e) {}
        var out = new Uint8Array(Math.min(got, max)), o = 0;
        for (var i = 0; i < parts.length && o < out.length; i++) { var n = Math.min(parts[i].length, out.length - o); out.set(parts[i].subarray(0, n), o); o += n; }
        return out.buffer;
      }
      return (function next() {
        return reader.read().then(function (r) {
          if (r.done) return done();
          parts.push(r.value); got += r.value.length;
          return got >= max ? done() : next();
        }, function () { return done(); });   // cut off mid-stream on purpose: keep what we have
      })();
    });
  }
  /** Whole small entry as text (sidecars, KML). Reads header + data in one go. */
  function zipText(blob, ent) {
    var extraGuess = 600 + ent.name.length * 2;
    return blob.slice(ent.off, ent.off + 30 + extraGuess + ent.csize).arrayBuffer().then(function (ab) {
      var dv = new DataView(ab);
      if (dv.getUint32(0, true) !== 0x04034b50) throw new Error("bad zip entry");
      var start = 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
      if (start + ent.csize > ab.byteLength) return zipSource(blob, ent).then(readAllText);
      var data = new Uint8Array(ab, start, ent.csize);
      if (ent.method === 0) return new TextDecoder().decode(data);
      if (ent.method !== 8) throw new Error("unsupported compression");
      return readAllText({ stream: function () { return new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw")); } });
    });
  }
  function readAllText(src) {
    var parts = [];
    return eachChunk(src, function (t) { parts.push(t); }).then(function () { return parts.join(""); });
  }
  /** Calls fn(text) for each ~4 MB piece of a File/Blob/zip entry, in order. onBytes(n) reports progress in source bytes. */
  function eachChunk(src, fn, onBytes) {
    var dec = new TextDecoder("utf-8");
    if (src.stream) {
      var reader = src.stream().getReader(), got = 0, ratio = src.csize && src.size ? src.csize / src.size : 1;
      return (function next() {
        return reader.read().then(function (r) {
          if (r.done) { var tail = dec.decode(); if (tail) fn(tail); return; }
          got += r.value.byteLength; if (onBytes) onBytes(r.value.byteLength * ratio);
          fn(dec.decode(r.value, { stream: true }));
          return next();
        });
      })();
    }
    var blob = src.blob || src, size = blob.size, pos = 0, CH = 4 << 20;
    return (function next() {
      if (pos >= size) { var tail = dec.decode(); if (tail) fn(tail); return Promise.resolve(); }
      var end = Math.min(size, pos + CH);
      return blob.slice(pos, end).arrayBuffer().then(function (ab) { pos = end; if (onBytes) onBytes(ab.byteLength); fn(dec.decode(new Uint8Array(ab), { stream: true })); return next(); });
    })();
  }

  // ---------- reading files ----------
  var EXT_DATA = /\.(json|geojson|csv|kml|gpx)$/i, EXT_PHOTO = /\.(jpe?g|heic|heif|tiff?|dng|webp)$/i, EXT_EXIF = /\.(jpe?g|heic|heif|dng|tiff?)$/i, HEAD = 131072;
  function baseName(n) { return String(n || "").split("/").pop(); }
  function listName(n) { return str(baseName(n).replace(/\.(json|geojson|csv|kml|kmz|gpx)$/i, "").replace(/[_]+/g, " "), 60); }
  function sniff(head) {
    var s = head.replace(/^\ufeff/, "").trimStart();
    if (/^<\?xml|^</.test(s)) return /<gpx\b/i.test(s) ? "gpx" : /<kml\b/i.test(s) ? "kml" : "xml";
    if (/^[\[{]/.test(s)) return "json";
    return "csv";
  }
  /** Parse one source (a File, or an entry inside a zip). */
  function parseSource(C, src, ctx, prog) {
    var name = src.name || "", size = src.size || 0, lower = name.toLowerCase();
    var cx = { name: baseName(name), list: listName(name) };
    return (src.stream ? Promise.resolve("") : (src.blob || src).slice(0, 4096).arrayBuffer().then(function (ab) { return new TextDecoder().decode(ab); })).then(function (head) {
      var kind = /\.gpx$/i.test(lower) ? "gpx" : /\.kml$/i.test(lower) ? "kml" : /\.csv$/i.test(lower) ? "csv" : /\.(json|geojson)$/i.test(lower) ? "json" : head ? sniff(head) : "json";
      if (kind === "json" && size > SMALL_JSON) {
        var js = JsonStream(wantPath, function (p, it) { onItem(C, p, it, cx); });
        return eachChunk(src, js.push, prog).then(function () { var r = js.end(); if (!r.items) C.warn.push(cx.name + ": nothing we recognize inside."); });
      }
      if (kind === "csv") { var cs = csvHandler(C, cx); return eachChunk(src, cs.push, prog).then(cs.end); }
      if ((kind === "kml" || kind === "gpx") && size > MAX_XML) { C.warn.push(cx.name + " is too big to read on a phone (over 160 MB)."); return; }
      return readAllText(src).then(function (text) {
        if (prog) prog(src.csize || size);
        if (kind === "kml") return parseKML(C, text, cx);
        if (kind === "gpx") return parseGPX(C, text, cx);
        if (kind === "xml") { C.warn.push(cx.name + ": not a KML or GPX file."); return; }
        parseJsonDoc(C, text, cx);
      });
    });
  }
  function parseJsonDoc(C, text, cx) {
    var v;
    try { v = JSON.parse(text.replace(/^\ufeff/, "")); } catch (e) { C.warn.push(cx.name + ": couldn't be read (it isn't valid JSON)."); return; }
    if (Array.isArray(v)) { v.forEach(function (it) { onItem(C, "[]", it, cx); }); return; }
    if (!v || typeof v !== "object") { C.warn.push(cx.name + ": nothing we recognize inside."); return; }
    if (v.photoTakenTime || v.geoData || v.geoDataExif) return photoSidecar(C, v, cx);
    if (v.type === "Feature") return feature(C, v, cx);
    if (v.app === "my-lifetime-travel-log") { C.warn.push(cx.name + " is a Famstamp backup. Restore it from Back up instead."); return; }
    var hit = false;
    Object.keys(JSON_PATHS).forEach(function (p) {
      if (p === "[]") return;
      var k = p.replace("[]", ""), val = v[k];
      if (p.slice(-2) === "[]" && Array.isArray(val)) { hit = true; val.forEach(function (it) { onItem(C, p, it, cx); }); }
      else if (p.slice(-2) !== "[]" && val && typeof val === "object" && !Array.isArray(val)) { hit = true; onItem(C, p, val, cx); }
    });
    if (!hit && !/metadata|print-subscriptions|shared_album_comments|user-generated-memory-titles/i.test(cx.name)) C.warn.push(cx.name + ": nothing we recognize inside.");
  }
  function parseZip(C, file, prog, depth) {
    return zipEntries(file).then(function (ents) {
      var names = ents.map(function (e) { return e.name; });
      var ok = function (e) { return !/\/$/.test(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name); };
      var data = ents.filter(function (e) { return ok(e) && (EXT_DATA.test(e.name) || /\.kmz$/i.test(e.name)); });
      var media = ents.filter(function (e) { return ok(e) && EXT_EXIF.test(e.name) && e.usize > 64; });
      if (!data.length && !media.length) {
        if (names.some(function (n) { return /archive_browser\.html$/i.test(n); }))
          C.warn.push("TOC:" + baseName(file.name || "zip") + " is just the table of contents; add the other zip(s) from the same export.");
        else C.warn.push((file.name || "That zip") + ": no map, location or photo info inside.");
        return;
      }
      C.kind("zip");
      // sidecar-sized entries first, many at a time; big ones (Records.json) one by one, streamed
      var small = data.filter(function (e) { return e.usize <= 2e6 && !/\.kmz$/i.test(e.name); }), big = data.filter(function (e) { return small.indexOf(e) < 0; });
      var other = file.size - data.reduce(function (s, e) { return s + e.csize; }, 0) - media.reduce(function (s, e) { return s + e.csize; }, 0);
      if (prog) prog(Math.max(0, other));   // the photos and videos we skip count as done
      var i = 0;
      function worker() {
        if (i >= small.length) return Promise.resolve();
        var e = small[i++];
        return zipText(file, e).then(function (text) {
          if (prog) prog(e.csize);
          var cx = { name: baseName(e.name), list: listName(e.name), path: e.name }, k = /\.gpx$/i.test(e.name) ? "gpx" : /\.kml$/i.test(e.name) ? "kml" : /\.csv$/i.test(e.name) ? "csv" : "json";
          if (k === "json") parseJsonDoc(C, text, cx); else if (k === "kml") parseKML(C, text, cx); else if (k === "gpx") parseGPX(C, text, cx);
          else { var cs = csvHandler(C, cx); cs.push(text); cs.end(); }
        }).catch(function () { C.warn.push(baseName(e.name) + ": couldn't be unzipped."); }).then(worker);
      }
      var mi = 0;
      function mediaWorker() {   // the photo itself: just its first 128 KB, for EXIF GPS + date
        if (mi >= media.length) return Promise.resolve();
        var e = media[mi++];
        return zipHead(file, e, HEAD).then(function (buf) {
          var x = exif(buf);
          C.pmedia.set(e.name, x ? { loc: x.loc || null, time: x.time || null, make: x.make, model: x.model } : {});
        }).catch(function () { C.pmedia.set(e.name, {}); }).then(function () { if (prog) prog(e.csize); return mediaWorker(); });
      }
      if (media.length) C.kind("photos-in-zip", media.length);
      var pool = []; for (var w = 0; w < 12; w++) { pool.push(worker()); pool.push(mediaWorker()); }
      return Promise.all(pool).then(function () {
        return big.reduce(function (p, e) {
          return p.then(function () {
            if (/\.kmz$/i.test(e.name)) {
              if (depth) return;
              return zipSource(file, e).then(function (src) { return src.stream ? new Response(src.stream()).blob() : src.blob; })
                .then(function (b) { b.name = e.name; if (prog) prog(e.csize); return parseZip(C, b, null, 1); });
            }
            return zipSource(file, e).then(function (src) { return parseSource(C, src, {}, prog); });
          }).catch(function (x) { C.warn.push(baseName(e.name) + ": " + (x && x.message || "couldn't be read")); });
        }, Promise.resolve());
      });
    });
  }
  function parsePhoto(C, file) {
    return file.slice(0, 131072).arrayBuffer().then(function (ab) {
      var x = exif(ab); C.kind("photos-picked");
      if (!x || !x.time) { C.skipped++; if (x && x.redacted) C.redacted = (C.redacted || 0) + 1; else C.noLoc++; return; }
      if (!x.loc && x.redacted) C.redacted = (C.redacted || 0) + 1;
      C.photoList.push({ name: file.name || "", t: x.time, p: x.loc || null, camera: cameraName(x.make, x.model), origin: "", folder: "", exifTime: true });
    });
  }
  /** Reads every file. files = File/Blob list. opts.progress(done, total, label). Resolves to a Collector. */
  function parseFiles(files, opts) {
    opts = opts || {};
    var C = new Collector(), total = 0, done = 0, last = 0;
    files = Array.prototype.slice.call(files || []);
    files.forEach(function (f) { total += EXT_PHOTO.test(f.name || "") ? 131072 : f.size || 0; });
    function prog(n, label) { done += n; var now = Date.now(); if (opts.progress && (now - last > 120 || done >= total)) { last = now; opts.progress(Math.min(done, total), total, label); } }
    var photos = files.filter(function (f) { return EXT_PHOTO.test(f.name || "") || /^image\//.test(f.type || ""); }), rest = files.filter(function (f) { return photos.indexOf(f) < 0; });
    var pi = 0;
    function photoWorker() { if (pi >= photos.length) return Promise.resolve(); var f = photos[pi++]; return parsePhoto(C, f).catch(function () { C.skipped++; }).then(function () { prog(131072); return photoWorker(); }); }
    var pool = []; for (var w = 0; w < 8; w++) pool.push(photoWorker());
    return Promise.all(pool).then(function () {
      return rest.reduce(function (p, f) {
        return p.then(function () {
          if (!f.size) { C.warn.push((f.name || "A file") + " is empty."); return; }
          return f.slice(0, 4).arrayBuffer().then(function (ab) {
            var b = new Uint8Array(ab);
            if (b[0] === 0x50 && b[1] === 0x4b) return parseZip(C, f, prog);
            if (b[0] === 0x1f && b[1] === 0x8b) { C.warn.push((f.name || "That file") + " is a .tgz. When you make the Takeout export, pick .zip instead (it's the default)."); prog(f.size); return; }
            if (/\.kmz$/i.test(f.name || "")) { C.warn.push(f.name + " doesn't look like a KMZ (zip) file."); prog(f.size); return; }
            return parseSource(C, f, {}, prog);
          });
        }).catch(function (x) { C.warn.push((f.name || "A file") + ": " + (x && x.message ? x.message : "couldn't be read.")); });
      }, Promise.resolve());
    }).then(function () { C.flushPhotos(opts.cameras); if (opts.progress) opts.progress(total, total, "done"); return C; });
  }

  // ---------- from raw collections to day x place entries (needs the place data) ----------
  function r4(v) { return Math.round(v * 1e4) / 1e4; }
  /** Turns a Collector into the plain result the review screen works from. geo = Geo(FS_IMPORT_GEO). */
  function finalize(C, geo, opts) {
    opts = opts || {};
    var placed = placeByTime(C, geo), map = new Map();
    function add(day, lat, lon, w, ph, first, last, name, addr, home, unsure) {
      var cy = Math.round(lat / CELL), cx = Math.round(lon / CELL), k = day + "|" + cy + "," + cx + (unsure ? "|u" : ""), e = map.get(k);
      if (!e) { e = { day: day, sl: 0, so: 0, sw: 0, w: 0, ph: 0, first: first, last: last, names: {}, addr: "", home: 0, tl: false, unsure: unsure || "" }; map.set(k, e); }
      if (!ph) e.tl = true;
      var ww = Math.max(w, 0.01); e.sl += lat * ww; e.so += lon * ww; e.sw += ww;
      e.w += w; e.ph += ph; if (first < e.first) e.first = first; if (last > e.last) e.last = last;
      if (name) e.names[name] = (e.names[name] || 0) + w + 0.01; if (addr && !e.addr) e.addr = addr; if (home) e.home++;
    }
    C.buckets.forEach(function (b) {
      var lat = b.lat / b.n, lon = b.lon / b.n, g = geo.lookup(lat, lon);
      var day = b.wall || localDay(b.t1, b.off, g.tz, lon);
      var w = b.wall ? 0.25 * Math.max(1, b.n) : Math.min(1, Math.max(0.25, (b.t2 - b.t1) / 36e5 + 0.25));
      add(day, lat, lon, b.ph && b.ph === b.n ? 0.25 * b.ph : w, b.ph, b.t1, b.t2, "", "", false, b.unsure);
    });
    C.visits.forEach(function (v) {
      var g = geo.lookup(v.lat, v.lon), off = v.off != null ? v.off : g.tz ? tzOffset(g.tz, v.t1) : null;
      if (off == null) off = Math.round(v.lon / 15) * 60;
      if (v.t2 <= v.t1) { add(utcDay(v.t1 + off * 6e4), v.lat, v.lon, 0.5, 0, v.t1, v.t1, v.name, v.addr, v.home); return; }
      var s = v.t1, guard = 0;
      while (s < v.t2 && guard++ < 62) {   // split at each local midnight so an overnight visit counts for both days
        var d = utcDay(s + off * 6e4), dayEnd = dayMs(d) + 864e5 - off * 6e4, e = Math.min(v.t2, dayEnd);
        add(d, v.lat, v.lon, (e - s) / 36e5, 0, s, e, v.name, v.addr, v.home);
        s = e;
      }
    });
    var entries = [];
    map.forEach(function (e) {
      var lat = e.sl / e.sw, lon = e.so / e.sw, g = geo.lookup(lat, lon), best = "", bw = 0;
      Object.keys(e.names).forEach(function (n) { if (e.names[n] > bw) { bw = e.names[n]; best = n; } });
      entries.push({ day: e.day, lat: r4(lat), lon: r4(lon), w: Math.round(e.w * 100) / 100, ph: e.ph, first: e.first, last: e.last, name: best, addr: e.addr, home: e.home > 0, tl: e.tl, unsure: e.unsure,
                     c: g.c, country: g.country, region: g.region, park: g.park || "", town: g.town || "", tz: g.tz || "" });
    });
    entries.sort(function (a, b) { return a.first - b.first; });
    var places = [], seen = {};
    C.places.forEach(function (p) {
      var key = placeKey(p); if (seen[key]) return; seen[key] = 1;
      var o = { key: key, name: p.name, list: p.list || "Places", note: p.note || "", url: p.url || "", addr: p.addr || "", date: p.date || null };
      if (p.lat != null) { var g = geo.lookup(p.lat, p.lon); o.lat = r4(p.lat); o.lon = r4(p.lon); o.c = g.c; o.country = g.country; o.region = g.region; o.park = g.park || ""; o.town = g.town || ""; }
      places.push(o);
    });
    var tracks = C.tracks.map(function (t) { return trackSummary(t, geo); }).filter(Boolean);
    var hints = C.homeHints.slice();
    var homeText = opts.homeText ? geo.findTown(opts.homeText) : null;
    return { kinds: C.kinds, warn: C.warn, points: C.points, photos: C.photos, skipped: C.skipped, noLoc: C.noLoc, redacted: C.redacted || 0,
             first: isFinite(C.firstMs) ? C.firstMs : null, last: isFinite(C.lastMs) ? C.lastMs : null,
             notYours: C.notYours, notWhy: C.notWhy, cameras: C.cameras, placedByTime: placed.n, loose: placed.loose,
             entries: entries, acts: C.acts.sort(function (a, b) { return a.t1 - b.t1; }), places: places, tracks: tracks, homeHints: hints, homeText: homeText };
  }
  /** Photos with no GPS but a date we trust (a Sony or a Camp Snap, or a phone with location off) borrow the place of the
      nearest phone photo with GPS taken within 6 hours. Camera times with no zone are local wall-clock time, so they are
      compared with the phone photos' local time. What's left is counted on whichever trip covers its day (detectTrips). */
  function placeByTime(C, geo) {
    var WIN = 6 * 36e5, loc = C.located.map(function (q) {
      var off = q.off != null ? q.off : tzOffset(geo.lookup(q.lat, q.lon).tz || "UTC", q.ms);
      if (off == null) off = Math.round(q.lon / 15) * 60;
      return q.wall ? { lat: q.lat, lon: q.lon, local: q.ms, utc: q.ms - off * 6e4 } : { lat: q.lat, lon: q.lon, local: q.ms + off * 6e4, utc: q.ms };
    });
    var byLocal = loc.slice().sort(function (a, b) { return a.local - b.local; }), byUtc = loc.slice().sort(function (a, b) { return a.utc - b.utc; });
    function nearest(list, k, ms) {
      var lo = 0, hi = list.length - 1, best = null;
      while (lo <= hi) { var mid = (lo + hi) >> 1; if (list[mid][k] < ms) lo = mid + 1; else hi = mid - 1; }
      [lo - 1, lo].forEach(function (i) { var q = list[i]; if (q && Math.abs(q[k] - ms) <= WIN && (!best || Math.abs(q[k] - ms) < Math.abs(best[k] - ms))) best = q; });
      return best;
    }
    var n = 0, loose = {};
    C.unplaced.forEach(function (u) {
      var q = u.t.wall ? nearest(byLocal, "local", u.t.ms) : nearest(byUtc, "utc", u.t.ms);
      if (q) { C.point({ lat: q.lat, lon: q.lon }, u.t, true, null); n++; return; }
      var day = u.t.wall || utcDay(u.t.ms + (u.t.off || 0) * 6e4);
      loose[day] = (loose[day] || 0) + 1;
    });
    C.unplaced = []; C.located = [];
    return { n: n, loose: loose };
  }
  function placeKey(p) {
    var cid = /[?&]cid=(\d+)/.exec(p.url || "") || /(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(p.url || "");
    if (cid) return "g" + hash(cid[1]);
    return "p" + hash(String(p.name || "").toLowerCase() + "|" + (p.lat != null ? p.lat.toFixed(4) + "," + p.lon.toFixed(4) : p.url || ""));
  }
  function trackSummary(t, geo) {
    var pts = t.pts; if (!pts || pts.length < 2) return null;
    var total = 0, cum = [0];
    for (var i = 1; i < pts.length; i++) { total += km(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); cum.push(total); }
    var g0 = geo.lookup(pts[0][0], pts[0][1]), times = pts.filter(function (p) { return p[2] != null; });
    var t1 = times.length ? times[0][2] : (t.t0 || null), t2 = times.length ? times[times.length - 1][2] : t1;
    var off1 = times.length ? times[0][3] : null;
    var gEnd = geo.lookup(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    // a stop every time the nearest town changes (sampled every ~3 km), plus named waypoints
    var stops = [{ lat: pts[0][0], lon: pts[0][1], g: g0, at: 0 }], lastTown = g0.town || g0.park || g0.region, next = 3;
    var areas = { s: {}, p: {}, k: {} };
    function area(g) { if (g.country === "USA" && g.region) areas.s[g.region] = 1; else if (g.c && g.c !== "USA") areas.p[g.c] = 1; if (g.park) areas.k[g.park] = 1; }
    area(g0);
    for (i = 1; i < pts.length; i++) {
      if (cum[i] < next && i < pts.length - 1) continue;
      next = cum[i] + 3;
      var g = geo.lookup(pts[i][0], pts[i][1]); area(g);
      var lbl = g.park || g.town || g.region;
      if (lbl && lbl !== lastTown && cum[i] - stops[stops.length - 1].at > 15) { stops.push({ lat: pts[i][0], lon: pts[i][1], g: g, at: cum[i] }); lastTown = lbl; }
    }
    var end = { lat: pts[pts.length - 1][0], lon: pts[pts.length - 1][1], g: gEnd, at: total };
    if (km(end.lat, end.lon, stops[stops.length - 1].lat, stops[stops.length - 1].lon) > 1) stops.push(end); else stops[stops.length - 1] = stops.length > 1 ? end : stops[0];
    (t.wpts || []).forEach(function (w) {
      if (!w.name) return;
      var bi = 0, bd = 1e9; for (var j = 0; j < pts.length; j += Math.max(1, Math.floor(pts.length / 2000))) { var d = km(w.lat, w.lon, pts[j][0], pts[j][1]); if (d < bd) { bd = d; bi = j; } }
      if (bd < 5) stops.push({ lat: w.lat, lon: w.lon, g: geo.lookup(w.lat, w.lon), at: cum[bi], name: w.name });
    });
    stops.sort(function (a, b) { return a.at - b.at; });
    if (stops.length > MAX_ROUTE) { var keep = [stops[0]]; var step = (stops.length - 2) / (MAX_ROUTE - 2); for (var s = 1; s < MAX_ROUTE - 1; s++) keep.push(stops[Math.round(s * step)]); keep.push(stops[stops.length - 1]); stops = keep; }
    var hours = t1 != null && t2 != null ? (t2 - t1) / 36e5 : null, speed = hours ? total / hours : null;
    return { name: t.name, src: t.src, km: Math.round(total * 10) / 10, t1: t1, t2: t2,
             day: t1 != null ? localDay(t1, off1, g0.tz, pts[0][1]) : "", endDay: t2 != null ? localDay(t2, off1, gEnd.tz, pts[pts.length - 1][1]) : "",
             mode: speed != null ? (speed > 180 ? "plane" : speed < 7 ? "walk" : "car") : (total < 40 ? "walk" : "car"),
             stops: stops.map(function (p) { return { lat: r4(p.lat), lon: r4(p.lon), at: Math.round(p.at * 10) / 10, name: p.name || "", c: p.g.c, country: p.g.country, region: p.g.region, park: p.g.park || "", town: p.g.town || "" }; }),
             states: Object.keys(areas.s), places: Object.keys(areas.p), parks: Object.keys(areas.k), n: pts.length };
  }

  // ---------- home ----------
  /** Where home is: Google's own HOME label if the file has one, else the place you were on the most days. */
  function detectHome(R) {
    var out = { home: null, candidates: [] };
    var hints = R.homeHints || [];
    if (hints.length) {
      var cl = clusterPts(hints.map(function (h) { return { lat: h.lat, lon: h.lon, w: h.w }; }), HOME_KM);
      cl.sort(function (a, b) { return b.w - a.w; });
      out.home = { lat: r4(cl[0].lat), lon: r4(cl[0].lon), how: "timeline" };
    }
    var cells = {};
    (R.entries || []).forEach(function (e) {
      var k = Math.round(e.lat / CELL) + "," + Math.round(e.lon / CELL), c = cells[k];
      if (!c) c = cells[k] = { lat: e.lat, lon: e.lon, days: {}, e: e };
      c.days[e.day] = 1;
    });
    var list = Object.keys(cells).map(function (k) { var c = cells[k]; return { lat: c.lat, lon: c.lon, w: Object.keys(c.days).length, e: c.e, days: c.days }; });
    list.sort(function (a, b) { return b.w - a.w; });
    var groups = [];
    list.slice(0, 400).forEach(function (c) {
      var g = groups.filter(function (x) { return km(x.lat, x.lon, c.lat, c.lon) < HOME_KM; })[0];
      if (g) { Object.keys(c.days).forEach(function (d) { g.days[d] = 1; }); } else groups.push({ lat: c.lat, lon: c.lon, e: c.e, days: Object.assign({}, c.days) });
    });
    groups.forEach(function (g) { g.n = Object.keys(g.days).length; });
    groups.sort(function (a, b) { return b.n - a.n; });
    out.candidates = groups.slice(0, 3).map(function (g) { return { lat: g.lat, lon: g.lon, days: g.n, town: g.e.town, region: g.e.region, country: g.e.country, c: g.e.c }; });
    if (!out.home && out.candidates.length && out.candidates[0].days >= 3) { var h = out.candidates[0]; out.home = { lat: h.lat, lon: h.lon, how: "most-days", town: h.town, region: h.region, country: h.country }; }
    if (out.home && !out.home.town) {
      var near = (R.entries || []).filter(function (e) { return km(e.lat, e.lon, out.home.lat, out.home.lon) < 15; })[0];
      if (near) { out.home.town = near.town; out.home.region = near.region; out.home.country = near.country; }
    }
    return out;
  }
  /** Greedy clustering of {lat, lon, w}; centers are weighted unit-vector means (safe across the 180th meridian). */
  function clusterPts(pts, radius) {
    var cl = [];
    pts.forEach(function (p) {
      var best = null, bd = radius;
      for (var i = 0; i < cl.length; i++) { var d = km(cl[i].lat, cl[i].lon, p.lat, p.lon); if (d < bd) { bd = d; best = cl[i]; } }
      if (!best) { best = { x: 0, y: 0, z: 0, w: 0, items: [] }; cl.push(best); }
      var la = rad(p.lat), lo = rad(p.lon), w = Math.max(p.w || 1, 0.01);
      best.x += Math.cos(la) * Math.cos(lo) * w; best.y += Math.cos(la) * Math.sin(lo) * w; best.z += Math.sin(la) * w; best.w += p.w || 1; best.items.push(p);
      var h = Math.sqrt(best.x * best.x + best.y * best.y); best.lat = Math.atan2(best.z, h) * 180 / Math.PI; best.lon = Math.atan2(best.y, best.x) * 180 / Math.PI;
    });
    return cl;
  }

  // ---------- trips ----------
  var LONG_GAP = 16;   // with no sign of being home in between, sparse days (photos) this close still count as one trip
  function sig(e) { return e.w >= 0.25 || e.ph >= 1; }
  function shortTown(g) { return g.town ? (g.country === "USA" && g.region ? g.town + ", " + g.region : g.town) : ""; }
  /** A route point's words: a national park, else the town, else Google's place name, else the state / country. */
  function pointLabel(g, nm, N) {
    if (g.park) return { name: N.park(g.park), kind: "park", ref: g.park };
    var t = shortTown(g);
    if (t) return { name: t, kind: "city" };
    if (nm) return { name: nm, kind: "place" };
    if (g.country === "USA" && g.region) return { name: N.state(g.region), kind: "place", ref: g.region };
    return { name: N.place(g.c || g.country) || "Somewhere", kind: "place", ref: g.c || "" };
  }
  function defaultNames(o) {
    o = o || {};
    return { park: o.park || function (id) { return id.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }) + " National Park"; },
             state: o.state || function (id) { return id; }, place: o.place || function (id) { return id; },
             validPlace: o.validPlace || function () { return true; }, validState: o.validState || function (id) { return US_STATES.indexOf(id) >= 0; },
             validPark: o.validPark || function () { return true; } };
  }
  function listJoin(a) { return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " & " + a[a.length - 1]; }
  /** Groups day x place entries into trips. opts: { home: {lat, lon} | null, names, awayKm, gapDays }.
      With no home known, every day with a location counts as away (the review screen asks for a home town). */
  function detectTrips(R, opts) {
    opts = opts || {};
    var home = opts.home && isFinite(opts.home.lat) ? opts.home : null, N = defaultNames(opts.names);
    var awayKm = opts.awayKm || AWAY_KM, gap = opts.gapDays != null ? opts.gapDays : GAP_DAYS;
    var ents = (R.entries || []).filter(sig);
    function far(e) { return home ? km(home.lat, home.lon, e.lat, e.lon) : 1e9; }
    var all = {};
    ents.forEach(function (e) { e._d = far(e); e._u = e.unsure || ""; (all[e.day] = all[e.day] || []).push(e); });
    function near(e, fn) {   // other entries within 50 km and 2 days
      for (var k = -2; k <= 2; k++) { var l = all[addDays(e.day, k)]; if (l) for (var i = 0; i < l.length; i++) if (l[i] !== e && km(l[i].lat, l[i].lon, e.lat, e.lon) <= 50 && fn(l[i])) return true; }
      return false;
    }
    // a saved or no-camera photo right where your own photos or Timeline put you is fine; a lone photo far from home is a question
    ents.forEach(function (e) { if (e._u && near(e, function (o) { return !o.unsure; })) e._u = ""; });
    ents.forEach(function (e) {
      if (e._u || e.tl || e.ph !== 1 || e._d <= awayKm) return;
      var n = 0; near(e, function (o) { if (!o._u) n += o.ph + (o.tl ? 2 : 0); return n > 0; });
      if (!n) e._u = "single";
    });
    var sure = ents.filter(function (e) { return !e._u; }), unsure = ents.filter(function (e) { return e._u; });
    var trips = groupTrips(sure, R, home, N, awayKm, gap, false).concat(groupTrips(unsure, R, home, N, awayKm, gap, true));
    var loose = R.loose || {}, left = 0;
    Object.keys(loose).forEach(function (d) {   // camera photos with no place: count them on the trip that covers that day (camera clocks drift, so +/- 1 day)
      var t = trips.filter(function (f) { return !f.unsure && f.start && dayDiff(f.start, d) >= -1 && dayDiff(d, f.end) >= -1; })[0];
      if (t) { t.photos += loose[d]; t.extraPhotos = (t.extraPhotos || 0) + loose[d]; } else left += loose[d];
    });
    trips = trips.concat(tracksToTrips(R.tracks || [], home, N));
    trips.unplaced = left;
    return trips;
  }
  function groupTrips(ents, R, home, N, awayKm, gap, unsure) {
    var byDay = {};
    ents.forEach(function (e) { (byDay[e.day] = byDay[e.day] || []).push(e); });
    var days = Object.keys(byDay).sort(), away = days.filter(function (d) { return byDay[d].some(function (e) { return e._d > awayKm; }); });
    var runs = [], cur = null;
    away.forEach(function (d) {
      if (cur) {
        var g = dayDiff(cur.e, d) - 1, quiet = true;
        if (g > gap) for (var x = 1; x <= g && quiet; x++) if (byDay[addDays(cur.e, x)]) quiet = false;   // any day seen in the gap (home or nearby) splits it
        if (g <= gap || (quiet && g <= LONG_GAP)) { cur.e = d; return; }
      }
      cur = { s: d, e: d }; runs.push(cur);
    });
    return runs.map(function (r) {
      var f = buildTrip(r, byDay, R, home, N, awayKm);
      if (f && unsure) {
        var why = {}; for (var d = r.s; d <= r.e; d = addDays(d, 1)) (byDay[d] || []).forEach(function (e) { why[e._u] = 1; });
        f.unsure = true; f.why = Object.keys(why); f.key = "uns:" + f.key.slice(4);
      }
      return f;
    }).filter(Boolean);
  }
  function buildTrip(r, byDay, R, home, N, awayKm) {
    var list = [];
    for (var d = r.s; d <= r.e; d = addDays(d, 1)) (byDay[d] || []).forEach(function (e) { if (e._d > HOME_KM) list.push(e); });
    if (!list.length) return null;
    list.sort(function (a, b) { return a.first - b.first; });
    var cl = clusterPts(list.map(function (e) { return { lat: e.lat, lon: e.lon, w: e.w + e.ph * 0.25, e: e }; }), STOP_KM);
    cl.forEach(function (c) {
      c.first = Math.min.apply(null, c.items.map(function (i) { return i.e.first; }));
      c.last = Math.max.apply(null, c.items.map(function (i) { return i.e.last; }));
      c.ph = 0; c.hours = 0; c.days = {}; c.nights = 0; var bw = -1, nm = {};
      c.items.forEach(function (i) {
        c.ph += i.e.ph; c.hours += i.e.w; c.days[i.e.day] = 1;
        if (i.w > bw) { bw = i.w; c.g = i.e; }
        if (i.e.name) nm[i.e.name] = (nm[i.e.name] || 0) + i.e.w;
      });
      c.name = Object.keys(nm).sort(function (a, b) { return nm[b] - nm[a]; })[0] || "";
      c.label = pointLabel(c.g, c.name, N);
    });
    // where you slept: the last place seen each evening (the day's last entry), for every day but the last
    var nights = 0;
    for (d = r.s; d < r.e; d = addDays(d, 1)) {
      var todays = list.filter(function (e) { return e.day === d; });
      var lastE = todays.length ? todays.reduce(function (a, b) { return b.last > a.last ? b : a; }) : null;
      if (!lastE) { var prev = list.filter(function (e) { return e.day < d; }); lastE = prev.length ? prev[prev.length - 1] : null; }   // no data that day: still away
      if (!lastE) continue;
      var c = cl.filter(function (c) { return c.items.some(function (i) { return i.e === lastE; }); })[0];
      if (c) { c.nights++; nights++; }
    }
    // route: stops in the order first seen, same-name neighbors merged
    var stops = cl.slice().sort(function (a, b) { return a.first - b.first; }), merged = [];
    stops.forEach(function (c) {
      var p = merged[merged.length - 1];
      if (p && p.label.name === c.label.name) { p.nights += c.nights; p.ph += c.ph; p.hours += c.hours; p.last = Math.max(p.last, c.last); return; }
      merged.push(c);
    });
    if (merged.length > MAX_ROUTE - 1) {   // keep the biggest stops, in order
      var keep = merged.slice().sort(function (a, b) { return (b.nights * 24 + b.hours + b.ph / 4) - (a.nights * 24 + a.hours + a.ph / 4); }).slice(0, MAX_ROUTE - 1);
      merged = merged.filter(function (c) { return keep.indexOf(c) >= 0; });
    }
    var dest = merged.reduce(function (a, b) {
      if (b.nights !== a.nights) return b.nights > a.nights ? b : a;
      var da = home ? km(home.lat, home.lon, a.lat, a.lon) : a.hours + a.ph, db = home ? km(home.lat, home.lon, b.lat, b.lon) : b.hours + b.ph;
      return db > da ? b : a;
    });
    var route = [], prevPt = home ? { lat: home.lat, lon: home.lon, t: null } : null;
    if (home) route.push({ name: home.name || "Home", kind: "city", lat: rnd3(home.lat), lon: rnd3(home.lon), country: home.country || "", region: home.region || "" });
    merged.forEach(function (c) {
      var p = { name: c.label.name, kind: c.label.kind, lat: rnd3(c.lat), lon: rnd3(c.lon), country: c.g.country || "", region: c.g.region || "", nights: c.nights };
      if (c.label.ref) p.ref = c.label.ref;
      if (prevPt) p.mode = legMode(R.acts || [], prevPt, c, !route.length || route.length === 1 && home);
      route.push(p); prevPt = { lat: c.lat, lon: c.lon, t: c.last };
    });
    if (route.length && !route[0].mode && !home) route[0] = Object.assign({}, route[0]);
    // what to color in: states / countries / parks seen with real time spent there
    var st = {}, pl = {}, pk = {}, cw = {};
    list.forEach(function (e) {
      if (e.country === "USA" && e.region && N.validState(e.region)) st[e.region] = 1;
      var cid = e.c || e.country;
      if (cid && cid !== "USA") cw[cid] = (cw[cid] || 0) + e.w + e.ph + (e.day < r.e ? 0.5 : 0);
      if (e.park && N.validPark(e.park)) pk[e.park] = 1;
    });
    Object.keys(cw).forEach(function (cid) { if (cw[cid] >= 1.5 && N.validPlace(cid)) pl[cid] = 1; });   // a two-hour layover isn't a visit
    if (home && home.country && home.country !== "USA") { var hc = home.c || home.country; delete pl[hc]; }
    var g = dest.g, mark = g.park && pk[g.park] ? { kind: "park", id: g.park } : g.country === "USA" && st[g.region] ? { kind: "state", id: g.region } : pl[g.c || g.country] ? { kind: "place", id: g.c || g.country } : null;
    var photos = list.reduce(function (s, e) { return s + e.ph; }, 0);
    var hl = merged.filter(function (c) { return c.ph >= 5; }).sort(function (a, b) { return b.ph - a.ph; }).slice(0, 3).map(function (c) { return { name: c.label.name, photos: c.ph }; });
    var regions = []; merged.forEach(function (c) { var n = c.g.country === "USA" ? N.state(c.g.region) : N.place(c.g.c || c.g.country); if (n && regions.indexOf(n) < 0) regions.push(n); });
    var tkm = (R.acts || []).filter(function (a) { return a.t1 >= list[0].first - 6 * 36e5 && a.t2 <= list[list.length - 1].last + 18 * 36e5; }).reduce(function (s, a) { return s + a.m; }, 0) / 1000;
    var homeG = home || {}, destName = dest.label.name;
    var place = regions.length > 1 && merged.length > 2 ? listJoin(regions.slice(0, 3)) + (regions.length > 3 ? " and more" : "") : destName;
    return {
      key: "imp:" + r.s + ":" + r.e + ":" + Math.round(dest.lat * 2) + "," + Math.round(dest.lon * 2),
      start: r.s, end: r.e, nights: nights, days: dayDiff(r.s, r.e) + 1, dayTrip: nights === 0, place: str(place, 80), dest: destName,
      from: home ? str(homeG.name || "", 80) : "", route: route, roundTrip: !!home,
      states: Object.keys(st), places: Object.keys(pl), parks: Object.keys(pk), mark: mark,
      photos: photos, highlights: hl, trackedKm: Math.round(tkm), src: photos && photos >= list.length ? "photos" : "timeline"
    };
  }
  function rnd3(v) { return Math.round(v * 1000) / 1000; }
  function legMode(acts, a, b, fromHome) {
    var t1 = a.t, t2 = b.first, byMode = {}, best = null, bm = 0;
    if (t1 != null) acts.forEach(function (x) { if (x.t2 > t1 && x.t1 < t2) byMode[x.mode] = (byMode[x.mode] || 0) + (x.m || 1); });
    Object.keys(byMode).forEach(function (m) { if (byMode[m] > bm) { bm = byMode[m]; best = m; } });
    if (best && best !== "walk") return best;
    var d = km(a.lat, a.lon, b.lat, b.lon), h = t1 != null ? (t2 - t1) / 36e5 : null;
    if (d > 300 && h != null && h > 0 && d / h > 200) return "plane";
    if (d > 800) return "plane";
    return "car";
  }
  /** GPX / KML / GeoJSON lines: one trip each, with the real measured miles on each leg. */
  function tracksToTrips(tracks, home, N) {
    N = N || defaultNames();
    return tracks.map(function (t) {
      if (!t.stops || t.stops.length < 1) return null;
      var route = [], prevAt = 0;
      t.stops.forEach(function (s, i) {
        var lab = s.name ? { name: s.name, kind: "place" } : pointLabel(s, "", N);
        var p = { name: str(lab.name, 80), kind: lab.kind, lat: rnd3(s.lat), lon: rnd3(s.lon), country: s.country || "", region: s.region || "" };
        if (lab.ref) p.ref = lab.ref;
        if (i) { p.mode = t.mode; p.miles = Math.round((s.at - prevAt) * 0.621371 * 10) / 10; }
        prevAt = s.at;
        route.push(p);
      });
      var last = route[route.length - 1], first = route[0];
      var loop = route.length > 1 && km(first.lat, first.lon, last.lat, last.lon) < 1;
      var dest = route.length > 2 && loop ? route.slice(1, -1).reduce(function (a, b) { return km(first.lat, first.lon, b.lat, b.lon) > km(first.lat, first.lon, a.lat, a.lon) ? b : a; }) : last;
      var st = t.states.filter(N.validState), pl = t.places.filter(N.validPlace), pk = t.parks.filter(N.validPark);
      var mark = pk.length ? { kind: "park", id: pk[0] } : dest.region && dest.country === "USA" && st.indexOf(dest.region) >= 0 ? { kind: "state", id: dest.region } : pl.length ? { kind: "place", id: pl[0] } : null;
      var start = t.day || "", end = t.endDay || t.day || "";
      return { key: "trk:" + start + ":" + hash(t.name + "|" + t.km + "|" + t.n), start: start, end: end, nights: start && end ? Math.max(0, dayDiff(start, end)) : 0,
               days: start && end ? dayDiff(start, end) + 1 : 1, dayTrip: start === end, place: str(t.name && !/^(track|route|untitled)/i.test(t.name) ? t.name : dest.name, 80),
               dest: dest.name, from: first.name, route: loop && route.length > 1 ? route.slice(0, -1) : route, roundTrip: loop,
               states: st, places: pl, parks: pk, mark: mark, photos: 0, highlights: [], trackedKm: t.km, trackMiles: Math.round(t.km * 0.621371 * 10) / 10, src: t.src, track: true };
    }).filter(Boolean);
  }

  // ---------- re-imports and trips you already have ----------
  /** Marks each found trip against the log: status "imported" (this exact trip came in before), "maybe" (a trip on the same
      dates that looks like the same one), or "new". Imported and maybe trips start unchecked. */
  function matchExisting(found, existing, opts) {
    opts = opts || {};
    var keys = {}; (existing || []).forEach(function (t) { var k = t.importKey || (t.import && t.import.key); if (k) keys[k] = t; });
    (opts.importedKeys || []).forEach(function (k) { keys[k] = keys[k] || { id: null }; });
    found.forEach(function (f) {
      f.status = "new"; f.match = null;
      if (keys[f.key]) { f.status = "imported"; f.match = keys[f.key].id || null; }
      else (existing || []).some(function (t) {
        if (!t.date || !f.start) return false;
        var tEnd = t.endDate || t.date;
        if (dayDiff(tEnd, f.start) > 1 || dayDiff(f.end || f.start, t.date) > 1) return false;
        var same = t.mark && (f.states.indexOf(t.mark.id) >= 0 || f.places.indexOf(t.mark.id) >= 0 || f.parks.indexOf(t.mark.id) >= 0);
        var words = String(t.place || "").toLowerCase();
        if (!same && words) {   // any real word of the trip's name in one of the found stops ("Chicago" ~ "Chicago, IL")
          var toks = words.split(/[^a-z0-9\u00c0-\u024f]+/).filter(function (w) { return w.length > 3 && !/^(trip|with|from|visit|weekend|the|and)$/.test(w); });
          var stopsTxt = f.route.map(function (p) { return String(p.name || "").toLowerCase(); }).concat([String(f.dest || "").toLowerCase()]).join(" | ");
          same = toks.some(function (w) { return stopsTxt.indexOf(w) >= 0; });
        }
        if (!same && (!t.mark && !words)) same = true;
        if (same) { f.status = "maybe"; f.match = t.id; return true; }
        return false;
      });
      f.checked = f.status === "new" && !f.dayTrip && !f.unsure;
    });
    return found;
  }
  function matchPlaces(places, wantToGo) {
    var have = {}; (wantToGo || []).forEach(function (w) { have[w.key] = 1; });
    places.forEach(function (p) { p.status = have[p.key] ? "saved" : "new"; });
    return places;
  }

  // ---------- into the app's shapes ----------
  /** What to save for one reviewed trip: the v1.2 trip fields (for M.newTrip) and the 1.4 extras (route, end date, nights). */
  function toAppTrip(f, opts) {
    opts = opts || {};
    var names = f.route.map(function (p) { return p.name; }), mid = names.slice(f.roundTrip || f.from ? 1 : 0);
    var title = str(opts.title || f.place, 80), last = mid[mid.length - 1];
    var stops = mid.filter(function (n) { return n !== title && n !== last; }).slice(0, 5);
    var base = { kidIds: opts.kidIds || [], place: title, from: f.roundTrip ? str(f.from, 80) : "", stops: stops, date: f.start, who: str(opts.who, 120),
                 memory: f.highlights && f.highlights.length ? "Most photos: " + f.highlights.map(function (h) { return h.name + " (" + h.photos + ")"; }).join(", ") + "." : "",
                 mark: f.mark };
    if (title !== last && last && stops.indexOf(last) < 0 && base.stops.length < 5) base.stops.push(last);
    var extra = { endDate: f.end && f.end !== f.start ? f.end : "", nights: f.nights, route: f.route, roundTrip: !!f.roundTrip, title: title !== f.place ? title : "",
                  importKey: f.key, import: { key: f.key, src: f.src, at: opts.now || new Date().toISOString(), photos: f.photos || 0, trackedMiles: f.trackMiles || (f.trackedKm ? Math.round(f.trackedKm * 0.621371) : 0) } };
    return { base: base, extra: extra };
  }
  /** Every area a trip adds, for each traveler: [{ kind: "state" | "place" | "park", id }]. */
  function areasOf(f) {
    return f.states.map(function (id) { return { kind: "state", id: id }; })
      .concat(f.places.map(function (id) { return { kind: "place", id: id }; }), f.parks.map(function (id) { return { kind: "park", id: id }; }));
  }
  function wantItem(p, now) { return { key: p.key, name: p.name, list: p.list, lat: p.lat != null ? p.lat : null, lon: p.lon != null ? p.lon : null, url: p.url || "", note: p.note || "", region: p.region || "", country: p.country || "", c: p.c || "", park: p.park || "", addedAt: now || new Date().toISOString() }; }

  /** Everything at once, for Node tests and the no-worker fallback. */
  function run(files, geoData, opts) {
    opts = opts || {};
    var geo = opts.geo || Geo(geoData, opts.towns);
    return parseFiles(files, opts).then(function (C) { return finalize(C, geo, opts); });
  }

  return {
    AWAY_KM: AWAY_KM, GAP_DAYS: GAP_DAYS, km: km, parseTime: parseTime, parseLatLng: parseLatLng, localDay: localDay, tzOffset: tzOffset, hash: hash,
    Geo: Geo, JsonStream: JsonStream, CsvStream: CsvStream, Collector: Collector, exif: exif, zipEntries: zipEntries,
    parseFiles: parseFiles, finalize: finalize, run: run, detectHome: detectHome, detectTrips: detectTrips, tracksToTrips: tracksToTrips,
    matchExisting: matchExisting, matchPlaces: matchPlaces, toAppTrip: toAppTrip, areasOf: areasOf, wantItem: wantItem, placeKey: placeKey, centerOf: centerOf, photoTrust: photoTrust, cameraName: cameraName, sidecarMedia: sidecarMedia, zipHead: zipHead
  };
});
