/* Famstamp: Cities, Food & drink and Pubs & breweries. Lives on the Parks tab as extra segments (#/p/<id>/parks/cities|food|pubs).
   - Cities, famous food spots and famous pubs each get a round engraved stamp (same frame as the park stamps; our own simple
     line art here, or a picture from stamp-art.js used read-only through its GLYPHS export).
   - The Food & drink list: quick notes of what someone ate or drank (name, type, place, date, rating, note, who was there).
     Any entry can be made into a stamp (a beer one becomes a pub stamp, anything else a food stamp).
   - Pubs, breweries and beer entries are for grown-ups only: never shown on a kid's pages, and kids can't be ticked for them.
   Data, on each person (synced in Family Sync's people JSON like stamps; no database change):
     person.spots = { "<city|pub|food id>": { at: "YYYY-MM-DD", with: [person ids] } }
     person.eats = [{ id, name, type: food|drink|beer|other, place, at, note, rating 0-5, with, stamp }] */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./spots-data.js"), null);
  else root.FS_SPOTS = factory(root.FS_SPOTS_DATA, root.WK_STAMPART);
})(typeof self !== "undefined" ? self : this, function (D, SA) {
  "use strict";
  var PAPER = "#fbf6ea";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- catalog ----------
  var CATS = {
    cities: { key: "c", what: "cities", one: "city", label: "CITY", find: "Find a city or country", ph: "e.g. Edinburgh or Japan" },
    food: { key: "f", what: "famous food spots", one: "food spot", label: "FOOD & DRINK", find: "Find a food spot or place", ph: "e.g. beignets or Lisbon" },
    pubs: { key: "p", what: "pubs & breweries", one: "pub", label: "PUB", find: "Find a pub, brewery or town", ph: "e.g. Dublin or Hofbräuhaus", adult: 1 } };
  var BY = {}, LIST = { cities: [], food: [], pubs: [] };
  function add(cat, rows) { rows.forEach(function (r) { var it = { id: CATS[cat].key + "-" + r[0], cat: cat, name: r[1], sub: r[2], region: r[3], lat: r[4], lon: r[5], art: r[6], extra: r[7] || "" }; BY[it.id] = it; LIST[cat].push(it); }); }
  add("cities", D.CITIES); add("pubs", D.PUBS); add("food", D.FOOD);
  var TYPES = [["food", "Food"], ["drink", "Drink"], ["beer", "Beer, wine & spirits"], ["other", "Other"]];
  function isAdultType(t) { return t === "beer"; }
  function kidOf(k) { return k && (k.kid || k.role === "kid"); }
  /** The stamp item for a list entry made into a stamp. */
  function entryItem(e) { var pub = e.type === "beer"; return { id: e.id, cat: pub ? "pubs" : "food", name: e.name, sub: e.placeName || "", region: "", art: pub ? "pint" : e.type === "drink" ? "cup" : "plate", extra: "", own: 1 }; }

  // ---------- art: our own 40x40 line drawings (fill/stroke inherit the stamp ink) ----------
  function C(x, y, r, f) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"' + (f ? ' fill="' + f + '"' : "") + '/>'; }
  function P(d, f, o) { return '<path d="' + d + '"' + (f ? ' fill="' + f + '"' : "") + (o ? ' fill-opacity="' + o + '"' : "") + '/>'; }
  function S(d, w, col) { return '<path d="' + d + '" fill="none" stroke="' + (col || "currentColor") + '" stroke-width="' + (w || 1.4) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  function R(x, y, w, h, f) { return P("M" + x + " " + y + "h" + w + "v" + h + "h" + (-w) + "Z", f); }
  function wins(x, y, w, h) { var s = ""; for (var yy = y + 2; yy < y + h - 2; yy += 3.2) for (var xx = x + 1.2; xx < x + w - 1; xx += 2.6) s += R(xx.toFixed(1), yy.toFixed(1), 1.1, 1.4, PAPER); return s; }
  function skyline(bs) { var s = R(0, 35, 40, 1.6); bs.forEach(function (b) { s += R(b[0], 35 - b[2], b[1], b[2]) + wins(b[0], 35 - b[2], b[1], b[2]); if (b[3]) s += S("M" + (b[0] + b[1] / 2) + " " + (35 - b[2]) + " v-" + b[3], 0.9); }); return s; }
  var MINE = {
    sky1: function () { return skyline([[1, 6, 12], [7, 7, 20], [15, 6, 27, 5], [22, 7, 17], [30, 5, 23], [35, 5, 10]]); },
    sky2: function () { return skyline([[0, 5, 9], [5, 6, 18], [12, 5, 30, 4], [18, 7, 22], [26, 6, 26, 3], [33, 6, 14]]); },
    sky3: function () { return skyline([[2, 6, 15], [8, 5, 11], [13, 8, 24], [21, 5, 18, 2], [27, 7, 28], [34, 5, 12]]) + P("M13 11 L17 6 L21 11Z"); },
    castle: function () { return P("M0 37 Q5 29 11 28 Q20 25 29 27 Q36 29 40 37Z") + R(11, 18, 18, 10) + R(8, 12, 6, 16) + R(26, 13, 6, 15) +
      P("M8 12 v-2 h1.5 v2 h1.5 v-2 h1.5 v2 h1.5 v-2 h0 Z M26 13 v-2 h1.5 v2 h1.5 v-2 h1.5 v2 h1.5 v-2 Z") + S("M20 18 V6 M20 6 h5 l-1.5 1.5 l1.5 1.5 h-5", 0.9) + R(18.4, 22, 3.2, 6, PAPER) + R(10, 16, 1.4, 2.4, PAPER) + R(28.2, 17, 1.4, 2.4, PAPER); },
    needle: function () { return R(0, 35, 40, 1.6) + R(2, 27, 5, 8, null) + R(33, 25, 6, 10) + S("M16 35 L19 14 M24 35 L21 14 M17.4 26 H22.6", 1.4) + P("M10 12.5 Q20 8 30 12.5 Q20 15.5 10 12.5Z") + R(18.8, 7, 2.4, 3.5) + S("M20 7 V1.5", 0.8); },
    bridge: function () { return R(7, 5, 2.6, 30) + R(30.4, 5, 2.6, 30) + R(0, 23, 40, 2) + S("M0 15 Q4.5 6 8.3 5.5 Q20 22 31.7 5.5 Q35.5 6 40 15", 1) +
      S("M12 13.5 V23 M16 18 V23 M20 20 V23 M24 18 V23 M28 13.5 V23", 0.6) + S("M2 30 q2.5 -1.4 5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0", 0.8); },
    pint: function () { return S("M11.6 6 H28.4 L26.4 36 H13.6Z", 1.6) + P("M13 13.5 H27 L25.4 34.6 H14.6Z") + P("M11.4 6.5 Q13 3 16.5 4.6 Q19.5 1.6 23 4.4 Q26.5 2.6 28.6 6.5 L28.1 13 H11.9Z", null, 0.4) +
      C(17, 20, 0.9, PAPER) + C(21.5, 25, 0.7, PAPER) + C(19, 29.5, 0.8, PAPER) + C(23, 18, 0.6, PAPER) + S("M15.5 15 L16.4 32", 0.8, PAPER); },
    tankard: function () { return P("M9 11 H27 V33.5 Q27 36 24.5 36 H11.5 Q9 36 9 33.5Z") + S("M27 15 H32 Q34.5 15 34.5 17.5 V25.5 Q34.5 28 32 28 H27", 2.6) +
      P("M8 11.5 Q9.5 6.5 14 8 Q17 4.5 21 7.5 Q25.5 5 28 11.5Z", null, 0.45) + S("M9 16.5 H27 M9 31 H27", 0.9, PAPER) + S("M13 19 V28.5 M18 19 V28.5 M23 19 V28.5", 0.7, PAPER); },
    kettle: function () { return R(0, 35.4, 40, 1.4) + P("M6 35.4 V22 Q6 12 17 12 Q28 12 28 22 V35.4Z") + R(14.6, 3, 4.8, 10) + S("M28 26 H33 V35", 1.6) + S("M9 25 H25", 0.8, PAPER) +
      C(11, 19, 0.7, PAPER) + C(17, 16.5, 0.7, PAPER) + C(23, 19, 0.7, PAPER) + P("M32 35.4 V30 Q32 28 34.5 28 H37.5 Q40 28 40 30 V35.4Z") + S("M34 31 H38 M34 33.4 H38", 0.6, PAPER) + S("M17 2.5 q-2 -2 0 -3", 0.7); },
    plate: function () { return S("M8 21 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0", 1.6) + S("M12 21 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0", 0.8) + P("M15 22 Q16 16 20 16 Q24 16 25 22Z") +
      S("M2.5 7 V16 M4.5 7 V16 M6.5 7 V16 M2.5 16 Q4.5 19 6.5 16 M4.5 18 V36", 1.1) + P("M35.6 6.5 Q38.6 12 37.8 21 H35.6Z") + S("M36.7 21 V36", 1.6); },
    bowl: function () { return P("M5 20 H35 Q34 33 20 35 Q6 33 5 20Z") + S("M5 20 H35", 1.6) + S("M11 24 Q20 27 29 24", 0.8, PAPER) + S("M23 18 L36 3 M26 18.5 L38.5 5", 1.2) +
      S("M12 16 q-2 -3 0 -6 t0 -6 M18 16 q-2 -3 0 -6 t0 -6", 0.9); },
    cup: function () { return P("M4 33 Q20 38 36 33 Q20 31 4 33Z") + P("M10 17 H28 V25 Q28 32 19 32 Q10 32 10 25Z") + S("M28 19.5 Q33.5 19.5 33.5 23 Q33.5 27 27.5 27", 1.6) +
      S("M14.5 13.5 q-2 -3 0 -5.5 t0 -5 M19.5 13.5 q-2 -3 0 -5.5 t0 -5 M24.5 13.5 q-2 -3 0 -5.5 t0 -5", 0.9) + S("M13 21 H25", 0.7, PAPER); } };
  function glyph(art, h) {
    if (MINE[art]) return { svg: MINE[art](), big: false };
    var G = SA && SA.GLYPHS; if (G && G[art]) return { svg: G[art](h % 3), big: /^(np|x)_/.test(art) };
    return { svg: MINE.sky1(), big: false };
  }

  // ---------- the stamp: round engraved frame, name around the top, place around the bottom, date plate ----------
  var INKS = { cities: ["#2b4f5e", "#5b4a2f", "#4a3b6b", "#2f5d3a", "#6b3a2a"], food: ["#7a3b1d", "#2f5d3a", "#6b3a2a", "#5b4a2f"], pubs: ["#5b4a2f", "#7a3b1d", "#2f5d3a", "#3a3a3a"] };
  var cache = {}, MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], uidN = 0;
  function stampDate(at) { var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(at || ""); if (!m) return ""; return m[3] ? MON[+m[2] - 1] + " " + (+m[3]) + ", " + m[1] : MON[+m[2] - 1] + " " + m[1]; }
  function arcPath(id, r, a0, a1, sweep) { var p = function (a) { var t = a * Math.PI / 180; return (80 + r * Math.cos(t)).toFixed(2) + "," + (80 + r * Math.sin(t)).toFixed(2); };
    return '<path id="' + id + '" d="M' + p(a0) + " A" + r + "," + r + " 0 1 " + sweep + " " + p(a1) + '"/>'; }
  function stampSVG(it, at, opts) {
    var key = it.id + "|" + (at || "") + "|" + it.name + "|" + it.sub; if (cache[key]) return cache[key];
    var h = hash(it.id), list = INKS[it.cat] || INKS.cities, ink = list[h % list.length], uid = "sp" + (++uidN) + "x" + (h % 1e6);
    var NAME = String(it.name).toUpperCase(), SUB = String(it.sub || "").toUpperCase(), BOT = SUB.length > 16 || !SUB ? (SUB || CATS[it.cat].label).slice(0, 30) : SUB + " · " + CATS[it.cat].label, date = stampDate(at);
    var RT = 56.5, RB = 66.6, RW = 51, m = BOT.length, bf = Math.min(10.4, RB * 1.75 / (m * 0.7 || 1)), bw = m * bf * 0.7, ba = bw / (RB - bf * 0.36) * 180 / Math.PI;
    var tmax = Math.min(RT * 4.1, (322 - ba) * Math.PI / 180 * RT), n = NAME.length, nf = Math.min(17, tmax / (n * 0.74 + 0.6)), nw = Math.min(tmax, n * nf * 0.74 + (n < 9 ? (n - 1) * 1.8 : 0));
    var bd = h % 3, ring = bd === 0 ? '<circle cx="80" cy="80" r="76.5" stroke-width="5.4" stroke-dasharray="2.4 2.6"/><circle cx="80" cy="80" r="72" stroke-width="1.6"/>'
      : bd === 1 ? '<circle cx="80" cy="80" r="76.4" stroke-width="2"/><circle cx="80" cy="80" r="73.4" stroke-width="2"/><circle cx="80" cy="80" r="70.6" stroke-width=".9"/>'
      : '<circle cx="80" cy="80" r="76" stroke-width="3.4"/><circle cx="80" cy="80" r="71.6" stroke-width="1.2"/>';
    var g = glyph(it.art, h), sc = g.big ? 2.6 : 2.1, gx = g.big ? 28 : 38, gy = g.big ? (date ? 22 : 26) : (date ? 20 : 28);
    var plate = "", df = 0;
    if (date) { df = Math.min(12.4, 76 / (date.length * 0.62)); var pw = Math.min(90, Math.max(62, date.length * df * 0.62 + 14));
      plate = '<rect x="' + (80 - pw / 2).toFixed(1) + '" y="103" width="' + pw.toFixed(1) + '" height="18" rx="1.5" fill="' + PAPER + '" stroke="' + ink + '" stroke-width="2"/><rect x="' + (80 - pw / 2 + 2.6).toFixed(1) + '" y="105.4" width="' + (pw - 5.2).toFixed(1) + '" height="13.2" fill="none" stroke="' + ink + '" stroke-width=".8"/>'; }
    var ser = "Georgia, 'Times New Roman', serif", mono = "ui-monospace, Menlo, Consolas, monospace";
    var out = '<svg class="stampsvg" viewBox="0 0 160 160" role="img" aria-label="' + esc(it.name + (it.sub ? ", " + it.sub : "") + (date ? ", " + date : "")) + '">' +
      '<g filter="url(#inkrough)" opacity=".92" color="' + ink + '"><g fill="' + ink + '"><defs><clipPath id="' + uid + 'c"><circle cx="80" cy="80" r="' + (RW - 0.9) + '"/></clipPath></defs><g clip-path="url(#' + uid + 'c)"><g transform="translate(' + gx + " " + gy + ") scale(" + sc + ')">' + g.svg + '</g></g></g>' +
      '<g fill="none" stroke="' + ink + '">' + ring + '<circle cx="80" cy="80" r="' + RW + '" stroke-width="1.8"/></g></g>' + (plate ? '<g filter="url(#inkrough)">' + plate + "</g>" : "") +
      '<g fill="' + ink + '" font-weight="800" text-anchor="middle" stroke="' + PAPER + '" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke"><defs>' + arcPath(uid + "t", RT, 120, 420, 1) + arcPath(uid + "b", RB, 230, -50, 0) + '</defs>' +
      '<text font-size="' + nf.toFixed(1) + '" font-family="' + ser + '"><textPath href="#' + uid + 't" startOffset="50%" textLength="' + nw.toFixed(1) + '" lengthAdjust="spacingAndGlyphs">' + esc(NAME) + '</textPath></text>' +
      (BOT ? '<text font-size="' + bf.toFixed(1) + '" font-family="' + ser + '"><textPath href="#' + uid + 'b" startOffset="50%" textLength="' + bw.toFixed(1) + '" lengthAdjust="spacingAndGlyphs">' + esc(BOT) + '</textPath></text>' : "") +
      (date ? '<text x="80" y="' + (112 + df * 0.36).toFixed(1) + '" font-size="' + df.toFixed(1) + '" font-family="' + mono + '" stroke="none">' + esc(date) + '</text>' : "") + '</g></svg>';
    cache[key] = out; return out;
  }

  // ---------- counting (Node-safe) ----------
  function spotsOf(k) { return k.spots && typeof k.spots === "object" ? k.spots : {}; }
  function eatsOf(k, forKid) { var l = Array.isArray(k.eats) ? k.eats : []; return forKid ? l.filter(function (e) { return !isAdultType(e.type); }) : l; }
  /** Stamps someone has in a category: [{item, at, with}] (curated + list entries made into stamps), oldest first. */
  function earned(k, cat) {
    if (CATS[cat].adult && kidOf(k)) return [];
    var sp = spotsOf(k), out = LIST[cat].filter(function (it) { return sp[it.id]; }).map(function (it) { return { item: it, at: sp[it.id].at || "", with: sp[it.id].with || [] }; });
    if (cat !== "cities") eatsOf(k, kidOf(k)).filter(function (e) { return e.stamp && entryItem(e).cat === cat; }).forEach(function (e) { out.push({ item: entryItem(e), at: e.at || "", with: e.with || [], entry: e }); });
    return out.sort(function (a, b) { return (a.at || "9") < (b.at || "9") ? -1 : 1; });
  }
  function counts(k) { return { cities: earned(k, "cities").length, food: earned(k, "food").length, pubs: earned(k, "pubs").length, list: eatsOf(k, kidOf(k)).length }; }
  function miles(a, b) { var r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r, x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) * Math.sin(dn / 2); return 7918 * Math.asin(Math.min(1, Math.sqrt(x))); }
  /** Cities this person's trips went to (a stop within ~25 miles) that they don't have a stamp for yet: [{item, date}]. */
  function fromTrips(k, trips) {
    var sp = spotsOf(k), seen = {}, out = [];
    (trips || []).filter(function (t) { return (t.kidIds || []).indexOf(k.id) >= 0; }).forEach(function (t) {
      var pts = (t.route || []).slice(); if (typeof t.lat === "number") pts.push({ lat: t.lat, lon: t.lon, date: t.date });
      pts.forEach(function (p) {
        if (typeof p.lat !== "number" || typeof p.lon !== "number") return;
        LIST.cities.forEach(function (c) { if (sp[c.id] || seen[c.id] || miles(p, c) > 25) return; seen[c.id] = 1; out.push({ item: c, date: (p.arrive || p.date || t.date || "").slice(0, 10) }); });
      });
    });
    return out;
  }
  /** Who picks: make `want` the people with spot id (curated). Returns { changed, undo, added, removed }. */
  function snap(p) { return { id: p.id, spots: JSON.parse(JSON.stringify(p.spots || {})), eats: JSON.parse(JSON.stringify(p.eats || [])), updatedAt: p.updatedAt }; }
  function applySpot(people, id, want, opts) {
    opts = opts || {}; var w = {}; want.forEach(function (x) { w[x] = 1; }); var res = { changed: [], undo: [], added: [], removed: [] }, now = opts.now || new Date().toISOString();
    function touch(p) { if (res.changed.indexOf(p) < 0) { res.undo.push(snap(p)); res.changed.push(p); p.updatedAt = now; } }
    people.forEach(function (p) {
      var sp = p.spots = p.spots || {}, has = !!sp[id];
      if (w[p.id] && !has) { touch(p); sp[id] = { at: opts.date || opts.today || "" }; res.added.push(p.id); }
      else if (!w[p.id] && has) { touch(p); delete sp[id]; res.removed.push(p.id); }
    });
    var ids = people.filter(function (p) { return w[p.id]; }).map(function (p) { return p.id; });
    people.forEach(function (p) { if (!w[p.id]) return; var v = p.spots[id], next = ids.length > 1 ? ids.slice() : null;
      if (JSON.stringify(v.with || null) !== JSON.stringify(next)) { touch(p); if (next) v.with = next; else delete v.with; } });
    return res;
  }
  function cleanEntry(e) {
    var t = TYPES.some(function (x) { return x[0] === e.type; }) ? e.type : "food", s = function (v, n) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n); };
    var o = { id: /^e_[a-z0-9]{6,20}$/.test(e.id || "") ? e.id : "e_" + Math.random().toString(36).slice(2, 12), name: s(e.name, 80), type: t, place: s(e.place, 40), placeName: s(e.placeName, 60),
      at: /^\d{4}-\d{2}(-\d{2})?$/.test(e.at || "") ? e.at : "", note: s(e.note, 300), rating: Math.max(0, Math.min(5, +e.rating || 0)) };
    if (e.stamp) o.stamp = true; return o;
  }
  /** Put list entry e on exactly the people in want (same id everywhere); want = [] takes it off everyone. */
  function applyEntry(people, e, want, opts) {
    opts = opts || {}; e = cleanEntry(e); var w = {}, res = { changed: [], undo: [], entry: e }, now = opts.now || new Date().toISOString();
    var ids = people.filter(function (p) { return want.indexOf(p.id) >= 0; }).map(function (p) { return p.id; }); ids.forEach(function (x) { w[x] = 1; });
    people.forEach(function (p) {
      var l = Array.isArray(p.eats) ? p.eats : [], had = l.some(function (x) { return x.id === e.id; });
      if (!w[p.id] && !had) return;
      res.undo.push(snap(p)); res.changed.push(p); p.updatedAt = now;
      l = l.filter(function (x) { return x.id !== e.id; });
      if (w[p.id]) { var c = Object.assign({}, e); if (ids.length > 1) c.with = ids.slice(); l.push(c); }
      p.eats = l;
    });
    return res;
  }
  function restore(people, undo, now) {
    var by = {}; people.forEach(function (p) { by[p.id] = p; });
    return undo.map(function (u) { var p = by[u.id]; if (!p) return null; p.spots = u.spots; p.eats = u.eats; p.updatedAt = now || new Date().toISOString(); return p; }).filter(Boolean);
  }
  var core = { CATS: CATS, LIST: LIST, BY: BY, TYPES: TYPES, stampSVG: stampSVG, earned: earned, counts: counts, fromTrips: fromTrips, applySpot: applySpot, applyEntry: applyEntry, cleanEntry: cleanEntry, restore: restore, entryItem: entryItem, stampDate: stampDate, isCat: function (c) { return !!CATS[c]; } };
  if (typeof window === "undefined") return core;

  // ---------- browser UI ----------
  function A() { return window.MLTL_APP; } function U() { return window.FS_UI; } function W() { return window.FS_WHO; } function M() { return window.MLTL; }
  function $(s, r) { return (r || document).querySelector(s); } function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function niceAt(at) { return at ? M().prettyDate(at) : ""; }
  function today() { return M().today(); }
  function saveAll(list) { return Promise.all(list.map(function (p) { return A().saveKid(p); })); }
  function undoFor(undo, after) { return function () { saveAll(restore(A().state.kids, undo)).then(function () { A().toast("Undone"); if (after) after(); }); }; }
  function holdersOf(id) { return A().state.kids.filter(function (p) { return spotsOf(p)[id]; }).map(function (p) { return p.id; }); }
  function pickList(adult) { return W().people().filter(function (p) { return !adult || !kidOf(p); }); }
  function startOn(list, had, page) {
    if (had.length) return had.slice(); var me = W().whoAmI();
    if (me.synced) return me.me ? [me.me] : []; return page && list.some(function (p) { return p.id === page.id; }) ? [page.id] : [];
  }
  function whoBlock(list, on, me) { return '<div class="whoshort"><button type="button" class="chip" id="spall">👨‍👩‍👧 Whole family</button></div>' + W().chipsHTML(list, on, {}, me); }
  function bindAll(box) { $("#spall", box).onclick = function () { var b = $$("input[data-who]", box), all = b.every(function (x) { return x.checked; }); b.forEach(function (x) { x.checked = !all; }); }; }

  /** "Who's been?" for a city, famous food spot or pub. */
  function openSpot(page, id, after, date) {
    var it = BY[id]; if (!it) return; var adult = !!CATS[it.cat].adult, list = pickList(adult), had = holdersOf(id), me = W().whoAmI().me, on = startOn(list, had, page);
    var el = U().sheet('<div class="sheethead"><h3>Who\'s been to ' + esc(it.name) + '?</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      '<p class="small muted">Tick everyone who was there. They each get the stamp.' + (adult ? " Pubs are for grown-ups, so kids aren't listed." : "") + '</p>' + whoBlock(list, on, me) +
      '<p class="small muted wlabel">When? (optional)</p>' + U().dateFields(date || "") +
      '<p class="err" id="sperr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="spok">Save</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
    var box = $(".sheetbox", el); box.classList.add("whosheet"); bindAll(box);
    $("#spok", box).onclick = function () {
      var want = W().picked(box); if (!want.length && !had.length) { var er = $("#sperr", box); er.hidden = false; er.textContent = "Tick who's been there."; return; }
      var r = applySpot(list, id, want, { date: U().readDate(), today: today() });
      if (!r.changed.length) { U().closeSheet(); return; }
      saveAll(r.changed).then(function () {
        U().closeSheet(); if (after) after();
        var bits = []; if (r.added.length) bits.push(it.name + ": stamped for " + W().names(r.added)); if (r.removed.length) bits.push("taken off " + W().names(r.removed));
        if (!bits.length) bits.push("Saved who was there together");
        W().undoToast(bits.join(" · "), undoFor(r.undo, after));
      });
    };
  }
  function placeOptions(v) {
    var MP = window.MLTL_MAPS, o = '<option value="">Somewhere (optional)</option>'; if (!MP) return o;
    o += '<optgroup label="US states">' + MP.us.shapes.map(function (s) { return '<option value="state:' + s.id + '"' + (v === "state:" + s.id ? " selected" : "") + '>' + esc(s.name) + '</option>'; }).join("") + '</optgroup>';
    return o + '<optgroup label="Countries">' + MP.world.countries.map(function (c) { return '<option value="place:' + c.id + '"' + (v === "place:" + c.id ? " selected" : "") + '>' + esc(c.name) + '</option>'; }).join("") + '</optgroup>';
  }
  /** Add or edit a Food & drink list entry. e = existing entry (edit) or { type, stamp } defaults. */
  function openEntry(page, e, after) {
    e = e || {}; var editing = !!e.id, kid = kidOf(page), had = editing ? A().state.kids.filter(function (p) { return eatsOf(p).some(function (x) { return x.id === e.id; }); }).map(function (p) { return p.id; }) : [];
    var types = TYPES.filter(function (t) { return !(kid && isAdultType(t[0])); }), list = pickList(isAdultType(e.type)), me = W().whoAmI().me, on = startOn(list, had, page);
    var el = U().sheet('<div class="sheethead"><h3>' + (editing ? "Edit" : e.stamp ? "Add your own spot" : "Add to the list") + '</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      '<div class="field"><label for="ename">What was it?</label><input id="ename" maxlength="80" placeholder="e.g. Fish tacos, a pint of stout, Luigi\'s" value="' + esc(e.name || "") + '"></div>' +
      '<div class="field"><label for="etype">Type</label><select id="etype">' + types.map(function (t) { return '<option value="' + t[0] + '"' + (e.type === t[0] ? " selected" : "") + '>' + t[1] + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="eplace">Where?</label><select id="eplace">' + placeOptions(e.place || "") + '</select></div>' +
      '<div class="field"><label for="ewhere">Place name (optional)</label><input id="ewhere" maxlength="60" placeholder="e.g. a café in Galway" value="' + esc(e.placeName || "") + '"></div>' +
      '<p class="small muted wlabel">When? (optional)</p>' + U().dateFields(e.at || "") +
      '<div class="field"><label for="erate">How was it?</label><select id="erate">' + ["No rating", "★", "★★", "★★★", "★★★★", "★★★★★"].map(function (t, i) { return '<option value="' + i + '"' + ((+e.rating || 0) === i ? " selected" : "") + '>' + t + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="enote">Note (optional)</label><input id="enote" maxlength="300" value="' + esc(e.note || "") + '"></div>' +
      '<label class="check"><input type="checkbox" id="estamp"' + (e.stamp ? " checked" : "") + '> Make it a stamp</label>' +
      '<p class="small muted wlabel">Who was there?</p><div id="ewho">' + whoBlock(list, on, me) + '</div>' +
      '<p class="err" id="eerr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="eok">Save</button>' + (editing ? '<button type="button" class="btn btn-ghost" id="edel">Remove</button>' : "") + '<button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
    var box = $(".sheetbox", el); box.classList.add("whosheet"); bindAll(box);
    $("#etype", box).onchange = function () { var ad = isAdultType(this.value), keep = W().picked(box); var l2 = pickList(ad); $("#ewho", box).innerHTML = whoBlock(l2, keep.filter(function (id) { return l2.some(function (p) { return p.id === id; }); }), me); bindAll(box); };
    function done(r, msg) { saveAll(r.changed).then(function () { U().closeSheet(); if (after) after(); W().undoToast(msg, undoFor(r.undo, after)); }); }
    $("#eok", box).onclick = function () {
      var name = $("#ename", box).value.trim(), want = W().picked(box), er = $("#eerr", box);
      if (!name) { er.hidden = false; er.textContent = "Give it a name."; return; }
      if (!want.length) { er.hidden = false; er.textContent = "Tick who was there."; return; }
      var r = applyEntry(A().state.kids, { id: e.id, name: name, type: $("#etype", box).value, place: $("#eplace", box).value, placeName: $("#ewhere", box).value, at: U().readDate(), note: $("#enote", box).value, rating: $("#erate", box).value, stamp: $("#estamp", box).checked }, want);
      done(r, name + (editing ? " updated" : " added for " + W().names(want)));
    };
    if (editing) $("#edel", box).onclick = function () { done(applyEntry(A().state.kids, e, []), e.name + " removed"); };
  }

  // ---------- views ----------
  var io = null;
  function lazy(main, k) {
    var els = $$("[data-sp]", main);
    function fill(el) { var id = el.dataset.sp, at = el.dataset.at || ""; var it = BY[id] || (function () { var e = eatsOf(k).filter(function (x) { return x.id === id; })[0]; return e ? entryItem(e) : null; })(); el.innerHTML = it ? stampSVG(it, at) : ""; el.removeAttribute("data-sp"); }
    if (io) io.disconnect(); if (!window.IntersectionObserver) return els.forEach(fill);
    io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { fill(x.target); io.unobserve(x.target); } }); }, { rootMargin: "600px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }
  function stampSpan(it, v, cls) { return '<span class="' + (cls || "pkstamp") + (v ? " on" : "") + '" aria-hidden="true" data-sp="' + esc(it.id) + '" data-at="' + esc(v && v.at || "") + '"></span>'; }
  function curatedHTML(k, cat) {
    var FF = window.FS_FIND, sp = spotsOf(k), byReg = {};
    LIST[cat].forEach(function (it) { (byReg[it.region] = byReg[it.region] || []).push(it); });
    return D.REGIONS.filter(function (r) { return byReg[r]; }).map(function (r) {
      var l = byReg[r];
      return FF.group(r, r, l.filter(function (it) { return sp[it.id]; }).length, l.length, l.map(function (it) {
        var v = sp[it.id];
        return '<div class="row" data-name="' + esc(it.name + " " + it.sub + " " + it.extra) + '">' + stampSpan(it, v) + '<div class="nm"><b data-hl>' + esc(it.name) + '</b><span>' + esc(it.sub + (it.extra && cat === "food" ? " · " + it.extra : "")) + (v && v.at ? " · " + esc(niceAt(v.at)) : "") + '</span></div>' +
          '<button type="button" class="pill" data-spot="' + esc(it.id) + '" aria-pressed="' + !!v + '">' + (v ? "✓ Been here" : "Been here?") + '</button></div>';
      }).join(""));
    }).join("");
  }
  function counterHTML(n, total, what) { return '<div class="count"><div class="big">' + n + ' <small>of ' + total + ' ' + what + '</small></div></div><div class="bar"><i style="width:' + Math.round(100 * n / Math.max(1, total)) + '%"></i></div>'; }
  function eatRow(e) {
    var t = TYPES.filter(function (x) { return x[0] === e.type; })[0];
    return '<div class="row eat" data-name="' + esc(e.name + " " + (e.placeName || "") + " " + (e.note || "") + " " + (t ? t[1] : "")) + '" data-type="' + esc(e.type) + '">' +
      (e.stamp ? stampSpan(entryItem(e), { at: e.at }) : '<span class="eicon" aria-hidden="true">' + ({ food: "🍽️", drink: "☕", beer: "🍺", other: "⭐" }[e.type] || "🍽️") + '</span>') +
      '<div class="nm"><b data-hl>' + esc(e.name) + '</b><span>' + esc([t ? t[1] : "", e.placeName, niceAt(e.at), e.rating ? "★★★★★".slice(0, e.rating) : "", e.with && e.with.length > 1 ? "with " + W().names(e.with) : ""].filter(Boolean).join(" · ")) + '</span>' +
      (e.note ? '<span class="enote">' + esc(e.note) + '</span>' : "") + '</div><button type="button" class="pill" data-eat="' + esc(e.id) + '">Edit</button></div>';
  }
  function listHTML(k, f) {
    var kid = kidOf(k), l = eatsOf(k, kid).slice(), sort = f.sort || "new";
    l.sort(function (a, b) { return sort === "rating" ? (b.rating || 0) - (a.rating || 0) : sort === "name" ? a.name.localeCompare(b.name) : (b.at || "") < (a.at || "") ? -1 : 1; });
    var types = TYPES.filter(function (t) { return !(kid && isAdultType(t[0])); });
    return '<div class="panel eats"><div class="ehead"><h3>' + esc(M().who(k)) + '\'s food &amp; drink list <small class="muted">' + l.length + '</small></h3><button type="button" class="btn btn-beacon" id="eadd">+ Add</button></div>' +
      (l.length ? '<div class="field" style="margin-top:0"><label for="efind">Search the list</label><input id="efind" type="search" placeholder="e.g. tacos or Dublin" autocomplete="off"></div>' +
        '<div class="echips" role="group" aria-label="Show">' + [["", "All"]].concat(types).map(function (t) { return '<button type="button" class="chip' + ((f.type || "") === t[0] ? " on" : "") + '" data-etype="' + t[0] + '" aria-pressed="' + ((f.type || "") === t[0]) + '">' + t[1].replace(", wine & spirits", " & wine") + '</button>'; }).join("") +
        '<label class="esort">Sort <select id="esort"><option value="new"' + (sort === "new" ? " selected" : "") + '>Newest</option><option value="rating"' + (sort === "rating" ? " selected" : "") + '>Best rated</option><option value="name"' + (sort === "name" ? " selected" : "") + '>A–Z</option></select></label></div>' +
        '<div class="elist parks">' + l.map(eatRow).join("") + '</div><p class="muted small" id="enone" hidden>Nothing matches.</p>'
        : '<p class="muted">Jot down the good stuff: a dish, a drink, a little place you loved. Tick "Make it a stamp" for the ones worth a passport stamp.</p>') + '</div>';
  }
  /** The page body for one category (inside the Parks tab shell). */
  function html(k, cat, trips) {
    var c = CATS[cat], sp = spotsOf(k), n = LIST[cat].filter(function (it) { return sp[it.id]; }).length, mine = cat === "cities" ? [] : earned(k, cat).filter(function (x) { return x.entry; });
    var sug = cat === "cities" ? fromTrips(k, trips) : [];
    return counterHTML(n, LIST[cat].length, c.what) +
      (sug.length ? '<div class="panel spsug"><h3>From ' + esc(M().who(k)) + '\'s trips</h3><p class="small muted">These trips went to cities with a stamp. Tap one to stamp it.</p><div class="echips">' +
        sug.slice(0, 12).map(function (s) { return '<button type="button" class="chip" data-spot="' + esc(s.item.id) + '" data-date="' + esc(s.date) + '">+ ' + esc(s.item.name) + '</button>'; }).join("") + '</div></div>' : "") +
      (cat === "food" ? '<div data-elist>' + listHTML(k, {}) + '</div>' : "") +
      (cat === "pubs" ? '<div class="panel"><div class="ehead"><h3>Your own pubs &amp; breweries <small class="muted">' + mine.length + '</small></h3><button type="button" class="btn btn-beacon" id="padd">+ Add your own</button></div>' +
        (mine.length ? '<div class="spgrid">' + mine.map(function (x) { return '<button type="button" class="spitem" data-eat="' + esc(x.entry.id) + '">' + stampSpan(x.item, { at: x.at }, "spst") + '</button>'; }).join("") + '</div>' : '<p class="muted small">A local you love, a brewery tour, a beer garden. Add it and it gets its own stamp.</p>') + '</div>' : "") +
      '<div class="panel parks plist" data-plist="spots-' + cat + ':' + esc(k.id) + '"><h3 class="plh">' + (cat === "food" ? "Famous food spots" : cat === "pubs" ? "Famous pubs & breweries" : "Cities & travel hubs") + '</h3>' +
        window.FS_FIND.tools('<div class="field" style="margin-top:0"><label for="spfind">' + esc(c.find) + '</label><input id="spfind" type="search" placeholder="' + esc(c.ph) + '" autocomplete="off"></div>') + curatedHTML(k, cat) + '</div>' +
      '<p class="hint">' + (cat === "cities" ? "Big cities and travel hubs around the world, each with its own stamp. A trip to one shows up above so you can stamp it." : cat === "pubs" ? "Famous old pubs, beer halls and brewery tours. Opening hours change, so check before you go. Only grown-ups see this page." : "Famous food spots get a stamp; your own finds go on the list above.") + '</p>';
  }
  function bindList(k, main, f, again) {
    var host = $("[data-elist]", main); if (!host) return;
    function draw() { host.innerHTML = listHTML(k, f); wire(); lazy(main, k); }
    function wire() {
      var add = $("#eadd", host); if (add) add.onclick = function () { openEntry(k, { type: "food" }, again); };
      $$("[data-eat]", host).forEach(function (b) { b.onclick = function () { var e = eatsOf(k).filter(function (x) { return x.id === b.dataset.eat; })[0]; if (e) openEntry(k, e, again); }; });
      $$("[data-etype]", host).forEach(function (b) { b.onclick = function () { f.type = b.dataset.etype; draw(); }; });
      var so = $("#esort", host); if (so) so.onchange = function () { f.sort = so.value; draw(); };
      var q = $("#efind", host); if (q) { q.value = f.q || ""; q.oninput = filt; }
      filt();
    }
    function filt() {
      var q = $("#efind", host); f.q = q ? q.value : ""; var s = (f.q || "").toLowerCase().trim(), shown = 0;
      $$(".row.eat", host).forEach(function (r) { var ok = (!f.type || r.dataset.type === f.type) && (!s || r.dataset.name.toLowerCase().indexOf(s) >= 0); r.style.display = ok ? "" : "none"; if (ok) shown++; });
      var no = $("#enone", host); if (no) no.hidden = shown > 0;
    }
    wire();
  }
  var listState = {};
  function bind(k, cat, main, again) {
    $$("[data-spot]", main).forEach(function (b) { b.onclick = function () { openSpot(k, b.dataset.spot, again, b.dataset.date || ""); }; });
    var pa = $("#padd", main); if (pa) pa.onclick = function () { openEntry(k, { type: "beer", stamp: true }, again); };
    $$(".spgrid [data-eat]", main).forEach(function (b) { b.onclick = function () { var e = eatsOf(k).filter(function (x) { return x.id === b.dataset.eat; })[0]; if (e) openEntry(k, e, again); }; });
    var f = $("#spfind", main); if (f) window.FS_FIND.bind($("[data-plist]", main), f, true);
    if (cat === "food") bindList(k, main, listState[k.id] = listState[k.id] || {}, again);
    lazy(main, k);
  }

  // ---------- passport section ----------
  function sectionHTML(k) {
    var kid = kidOf(k), cats = ["cities", "food"].concat(kid ? [] : ["pubs"]), any = false;
    var body = cats.map(function (cat) {
      var l = earned(k, cat); if (!l.length) return ""; any = true;
      return '<div class="spsec"><div class="bshead"><h3>' + (cat === "cities" ? "Cities" : cat === "food" ? "Food & drink" : "Pubs & breweries") + ' <small class="muted">' + l.length + '</small></h3><a class="tapline" href="#/p/' + esc(k.id) + '/parks/' + cat + '">See all ›</a></div>' +
        '<div class="spgrid">' + l.map(function (x) { return '<button type="button" class="spitem" data-spd="' + esc(x.item.id) + '" aria-label="' + esc(x.item.name) + '">' + stampSpan(x.item, { at: x.at }, "spst") + '</button>'; }).join("") + '</div></div>';
    }).join("");
    return any ? '<section class="spots">' + body + '</section>' : "";
  }
  function bindSection(k, main) {
    $$("[data-spd]", main).forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.spd, all = earned(k, "cities").concat(earned(k, "food"), earned(k, "pubs")), x = all.filter(function (y) { return y.item.id === id; })[0]; if (!x) return;
        var w = (x.with || []).filter(function (p) { return p !== k.id; });
        var el = U().sheet('<div class="sheethead"><h3>' + esc(x.item.name) + '</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div><div class="spbig">' + stampSVG(x.item, x.at) + '</div>' +
          '<p>' + esc(M().who(k)) + (x.at ? " was here on " + esc(niceAt(x.at)) : " has been here") + (w.length ? ", with " + esc(W().names(w)) : "") + '.</p>' +
          (x.item.extra && x.item.cat === "food" ? '<p class="muted small">Known for: ' + esc(x.item.extra) + '</p>' : "") + (x.entry && x.entry.note ? '<p class="muted small">' + esc(x.entry.note) + '</p>' : "") +
          '<div class="actions"><button type="button" class="btn btn-ghost" id="spwho">' + (x.entry ? "Edit" : "Change who's been") + '</button><button type="button" class="btn btn-primary" data-close>Close</button></div>');
        $("#spwho", el).onclick = function () { var again = function () { A().route(); }; if (x.entry) openEntry(k, x.entry, again); else openSpot(k, id, again); };
      };
    });
    lazy(main, k);
  }
  core.html = html; core.bind = bind; core.sectionHTML = sectionHTML; core.bindSection = bindSection; core.openSpot = openSpot; core.openEntry = openEntry; core.kidOf = kidOf;
  return core;
});
