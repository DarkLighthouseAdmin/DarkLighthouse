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
  if (typeof module === "object" && module.exports) module.exports = factory(require("./spots-data.js"), (function () { try { return require("./stamp-art.js"); } catch (e) { return null; } })());
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
    pubs: { key: "p", what: "pubs & breweries", one: "pub", label: "PUB", find: "Find a pub, brewery or town", ph: "e.g. Dublin or Hofbräuhaus", adult: 1 },
    hubs: { key: "h", what: "travel hubs", one: "hub", label: "TRAVEL HUB", find: "Find an airport, station or city", ph: "e.g. O'Hare or King's Cross" } };
  var BY = {}, LIST = { cities: [], food: [], pubs: [], hubs: [] };
  function add(cat, rows) { rows.forEach(function (r) { var it = { id: CATS[cat].key + "-" + r[0], cat: cat, name: r[1], sub: r[2], region: r[3], lat: r[4], lon: r[5], art: r[6], extra: r[7] || "" }; BY[it.id] = it; LIST[cat].push(it); }); }
  add("cities", D.CITIES); add("pubs", D.PUBS); add("food", D.FOOD); add("hubs", D.HUBS || []);
  // v58: any airport a trip flew through can be a hub stamp. Curated ones keep their entry; others are made from the flight's airport
  // (code, name, city) and the name rides along in person.spots[id] so it shows on every device.
  function airportId(code) { return /^[A-Za-z]{3}$/.test(code || "") ? "h-air-" + code.toLowerCase() : ""; }
  function airportItem(a) {
    var id = airportId(a && a.code); if (!id) return null; if (BY[id]) return BY[id]; if (DYN[id]) return DYN[id];
    var nm = String(a.name || a.code).replace(/\s*(International|Intercontinental|Regional)?\s*Airport\b.*$/i, "").trim() || a.code.toUpperCase();
    if (!/\b(airport|field|airfield)\b/i.test(nm)) nm += " airport";
    return (DYN[id] = { id: id, cat: "hubs", name: nm.slice(0, 40), sub: (a.code.toUpperCase() + (a.city ? " · " + a.city : "")).slice(0, 40), region: "", art: "air", extra: "airport", dyn: 1 });
  }
  var DYN = {};
  // v65: QR stamp stations (stations.js). The station's name and place ride along in person.spots[id] like airports.
  var STATION = /^c-st-[a-z0-9]{8}$/;
  function stationItem(id, v) { return { id: id, cat: "cities", name: String(v.name || "Stamp station").slice(0, 40), sub: String(v.sub || "").slice(0, 40), region: "", art: "station", extra: "station", dyn: 1 }; }
  /** Any stamp id -> its item (curated, a flown-through airport saved on someone, or a list entry made into a stamp). */
  function itemFor(id, people) {
    if (BY[id]) return BY[id];
    for (var i = 0; i < (people || []).length; i++) {
      var p = people[i], v = spotsOf(p)[id];
      if (v && STATION.test(id)) return stationItem(id, v);
      if (v && /^h-air-[a-z]{3}$/.test(id)) return { id: id, cat: "hubs", name: v.name || id.slice(6).toUpperCase(), sub: v.sub || id.slice(6).toUpperCase(), region: "", art: "air", extra: "airport", dyn: 1 };
      var e = eatsOf(p).filter(function (x) { return x.id === id; })[0]; if (e && e.stamp) return entryItem(e);
    }
    return DYN[id] || null;
  }
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
    // a stamp station: a signpost with a star (our own simple drawing)
    station: function () { return R(18.6, 8, 2.8, 30) + P("M6 9 H30 L34 13 L30 17 H6 Z") + P("M34 20 H10 L6 24 L10 28 H34 Z") + R(10, 37, 20, 2) + P("M20 0.6l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z"); },
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


  // ---------- v59: every stamp gets its own picture ----------
  // Pubs, breweries, airports and stations come from small drawing kits; each catalog entry gets its own mix of parts (by its
  // place in the list), and its initial or airport code. Food spots each have their own dish. Cities keep their landmark, drawn
  // smaller over their own skyline. A test checks no two stamps (and no park/country stamp) share a picture.
  function TX(x, y, s, size, col, mono) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="800" text-anchor="middle" font-family="' + (mono ? "ui-monospace, Menlo, Consolas, monospace" : "Georgia, 'Times New Roman', serif") + '" fill="' + (col || "currentColor") + '" stroke="none">' + esc(s) + '</text>'; }
  function G(t, s) { return '<g transform="' + t + '">' + s + '</g>'; }
  function initial(name) { var w = String(name || "").replace(/^(the|ye olde|ye|le|la|el|de|u|in de)\s+/i, "").replace(/[^A-Za-zÀ-ž]/g, ""); return (w[0] || "•").toUpperCase(); }
  function rnd(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pane(x, y, w, h, cols, rows) { var s = R(x, y, w, h, PAPER), i; for (i = 1; i < cols; i++) s += S("M" + (x + w * i / cols).toFixed(1) + " " + y + " v" + h, 0.5); for (i = 1; i < rows; i++) s += S("M" + x + " " + (y + h * i / rows).toFixed(1) + " h" + w, 0.5); return s; }
  function archWin(x, y, w, h) { return P("M" + x + " " + (y + h) + " V" + (y + w / 2) + " a" + (w / 2) + " " + (w / 2) + " 0 0 1 " + w + " 0 V" + (y + h) + "Z", PAPER); }

  function pubArt(i, name) {   // 4 roofs x 3 signs x 3 window styles = 36 different fronts
    var roof = i % 4, sign = Math.floor(i / 4) % 3, win = Math.floor(i / 12) % 3, L = initial(name), s = R(0, 36.4, 40, 1.6) + R(6, 15, 28, 21.4);
    s += [R(5, 13, 30, 2.4) + R(6, 11.4, 28, 1.6) + R(9, 9.4, 3, 2) + R(28, 9.4, 3, 2),
          P("M4 15.6 L20 4.6 L36 15.6Z") + R(27, 5, 3, 6) + C(20, 11.4, 1.6, PAPER),
          P("M5 15.6 L9 8 H31 L35 15.6Z") + R(12, 10.2, 3, 3.6, PAPER) + R(25, 10.2, 3, 3.6, PAPER) + R(19, 10.2, 2, 3.6, PAPER),
          P("M6 15.6 V12 H9 V9.4 H12 V7 H15 V4.6 H25 V7 H28 V9.4 H31 V12 H34 V15.6Z") + R(18.5, 7.6, 3, 3, PAPER)][roof];
    s += [pane(8.4, 20, 7, 8, 2, 2) + pane(24.6, 20, 7, 8, 2, 2), pane(8.4, 19.6, 7.4, 9, 3, 3) + pane(24.2, 19.6, 7.4, 9, 3, 3), archWin(9, 19, 6, 10) + archWin(25, 19, 6, 10) + S("M12 21 V29 M28 21 V29", 0.5)][win];
    s += archWin(17.4, 26, 5.2, 10.4) + C(21.4, 31.6, 0.45);
    s += [R(7, 16.2, 26, 2.8, PAPER) + TX(20, 18.5, L, 3.2) + S("M8.5 17.6 h7 M24.5 17.6 h7", 0.5),
          S("M6 17.4 H1.4 M2.4 17.4 v1.2 M5 17.4 v1.2", 0.8) + R(0.6, 18.6, 6, 7.2) + R(1.2, 19.2, 4.8, 6, PAPER) + TX(3.6, 24, L, 4.6),
          S("M34 17.4 H38.8 M37.2 17.4 v0.8", 0.8) + C(37.2, 21.6, 3.2) + C(37.2, 21.6, 2.5, PAPER) + TX(37.2, 23.3, L, 4.4)][sign];
    return s;
  }
  function brewArt(i, name) {   // 3 vessels x 2 roof tops x 2 walls x 2 yards = 24
    var k = i % 3, st = Math.floor(i / 3) % 2, hop = Math.floor(i / 6) % 2, yd = Math.floor(i / 12) % 2, s = R(0, 36.4, 40, 1.6);
    s += R(15, 17, 24, 19.4) + P("M13 17.6 L27 8.4 L41 17.6Z") + C(27, 13.6, 2.4, PAPER) + TX(27, 15, initial(name), 3.4);
    s += st ? R(23.6, 5, 6.8, 4.6) + P("M22.6 5 L27 1.6 L31.4 5Z") + S("M24.6 7.4 h4.8", 0.5, PAPER) : R(34, 3, 3.4, 9) + R(33.4, 2.4, 4.6, 1.2);
    s += hop ? S("M16 20 q2.6 2 5.2 0 t5.2 0 t5.2 0 t5.2 0", 0.8) + [18.6, 23.8, 29, 34.2].map(function (x) { return P("M" + x + " 21.4 q1 1 0 2.8 q-1 -1.8 0 -2.8Z"); }).join("") + archWin(18, 25, 4, 7) + archWin(25, 25, 4, 7) + archWin(32, 25, 4, 7)
               : pane(18, 21, 5, 5, 2, 2) + pane(25, 21, 5, 5, 2, 2) + pane(32, 21, 5, 5, 2, 2) + R(25.6, 29, 4.8, 7.4, PAPER);
    s += [P("M1 36.4 V27 Q1 20.4 7.6 20.4 Q14.2 20.4 14.2 27 V36.4Z") + R(6.4, 13, 2.4, 7.4) + S("M7.6 13 Q7.6 9 12 9 H16", 1.3) + S("M3.4 29 H12", 0.7, PAPER),
          R(2.4, 15.4, 10.4, 16.6) + P("M2.4 32 L7.6 36.4 L12.8 32Z") + S("M3.4 32 V36.4 M11.8 32 V36.4", 0.9) + S("M5 19 H10.2 M5 22 H10.2", 0.6, PAPER) + C(7.6, 26.6, 1.2, PAPER),
          R(1.4, 25, 13, 11.4) + P("M1.4 25 Q7.9 15 14.4 25Z") + R(7, 11.4, 1.8, 5.6) + S("M3 30 H12.8", 0.7, PAPER) + C(7.9, 21.6, 1, PAPER)][k];
    s += yd ? [C(36.4, 34, 2.4), C(32, 34, 2.4), C(34.2, 30, 2.4)].join("") + C(36.4, 34, 1, PAPER) + C(32, 34, 1, PAPER) + C(34.2, 30, 1, PAPER)
            : P("M30.6 36.4 Q29.8 33 30.6 29.6 H37.6 Q38.4 33 37.6 36.4Z") + S("M30.4 31.2 H37.8 M30.4 34.8 H37.8", 0.6, PAPER);
    return s;
  }
  function plane(x, y, a, sc, top) {
    var body = top ? P("M-9 0 Q-9 -0.9 -7 -0.9 H7 Q9.6 0 7 0.9 H-7 Q-9 0.9 -9 0Z") + P("M-1 -0.8 L-4.6 -8 H-2.6 L3 -0.8Z M-1 0.8 L-4.6 8 H-2.6 L3 0.8Z") + P("M-7.4 -0.6 L-9.2 -3.4 H-8 L-5.6 -0.6Z M-7.4 0.6 L-9.2 3.4 H-8 L-5.6 0.6Z")
                   : P("M-9 -0.6 L6 -1.2 Q9.6 -1 9.6 0 Q9.6 1 6 1.3 L-8.4 0.8Z") + P("M-1.6 0.4 L2.6 0.4 L-2.6 5.6 H-4.2Z") + P("M-8.8 -0.4 L-10 -5 H-8 L-5.4 -0.6Z") + S("M-4 -0.1 H5", 0.5, PAPER);
    return G("translate(" + x + " " + y + ") rotate(" + a + ") scale(" + sc + ")", body);
  }
  function airArt(i, code) {   // 3 towers x 3 planes x 4 grounds = 36, plus the airport's own code on the departures board
    var t = i % 3, p = Math.floor(i / 3) % 3, g = Math.floor(i / 9) % 4, s = "";
    s += R(1, 1.4, 19, 9.4, null) + R(2, 2.4, 17, 7.4, PAPER) + TX(10.5, 8.6, String(code || "").toUpperCase().slice(0, 3), 6.6, null, 1);
    s += [plane(12, 17.6, -18, 0.95), plane(12, 17, 0, 1), plane(12.6, 18, -35, 0.9, 1)][p];
    s += [R(29.2, 16, 3.8, 20.4) + P("M25.4 10 H36.8 L35.2 16 H27Z") + R(26.6, 11.4, 9, 2.4, PAPER) + S("M31.1 10 V4.6", 0.8) + C(31.1, 4.2, 0.8),
          P("M28.6 36.4 L29.8 17 H32.4 L33.6 36.4Z") + P("M24 12.4 H38.2 L36.2 17 H26Z") + P("M25 12.4 L31.1 8.6 L37.2 12.4Z") + R(26.4, 13.4, 9.4, 2, PAPER),
          R(30, 18, 2.4, 18.4) + C(31.2, 13.6, 4.6) + P("M27.2 13.4 a4 4 0 0 1 8 0Z", PAPER) + S("M31.2 9 V5", 0.8) + S("M27 20 H35.4", 1.4)][t];
    s += [R(0, 35, 40, 2.6) + S("M2 36.3 H6 M9 36.3 H13 M16 36.3 H20 M23 36.3 H27", 0.6, PAPER),
          R(0, 36.4, 40, 1.6) + P("M1 36.4 V30.4 Q12 25 24 30.4 V36.4Z") + pane(3, 31.4, 19, 3.6, 6, 1),
          R(0, 36.4, 40, 1.6) + P("M2 36.4 V31 a9 6 0 0 1 18 0 V36.4Z") + S("M6 36.4 V30 M11 36.4 V27.6 M16 36.4 V30", 0.6, PAPER),
          R(0, 36.4, 40, 1.6) + [2, 6, 10, 14, 18, 22].map(function (x) { return C(x, 34.6, 0.7); }).join("") + S("M24 36.4 V27", 0.8) + P("M24 27 L28 28 L27.6 29.6 L24 30Z")][g];
    return s;
  }
  function trainArt(i, name) {   // 4 buildings x 3 fronts x 2 platforms = 24
    var r = i % 4, f = Math.floor(i / 4) % 3, l = Math.floor(i / 12) % 2, s = "";
    s += [P("M2 31 V22 Q20 3 38 22 V31Z") + S("M7 22 Q20 9 33 22", 0.6, PAPER) + S("M12 21 Q20 14 28 21", 0.5, PAPER),
          R(4, 18, 32, 13) + R(16.4, 5, 7.2, 13) + P("M15.6 5 L20 0.8 L24.4 5Z") + C(20, 10.6, 2.6, PAPER) + S("M20 9.2 V10.6 H21.2", 0.5),
          R(4, 18, 32, 13) + P("M11 18.2 Q20 4 29 18.2Z") + R(19, 5, 2, 3) + C(20, 4.4, 1) + S("M14.6 15.4 Q20 9.6 25.4 15.4", 0.5, PAPER),
          R(4, 18, 32, 13) + R(4, 8, 6.4, 10) + R(29.6, 8, 6.4, 10) + P("M4 8 L7.2 3 L10.4 8Z M29.6 8 L32.8 3 L36 8Z") + P("M13 18 L20 11.6 L27 18Z") + C(20, 15.4, 1.4, PAPER)][r];
    var y = r === 0 ? 23 : 21;
    s += [archWin(8, y, 5, 8) + archWin(17.5, y, 5, 8) + archWin(27, y, 5, 8),
          pane(7, y, 2.6, 7, 1, 2) + pane(11.6, y, 2.6, 7, 1, 2) + pane(16.2, y, 2.6, 7, 1, 2) + pane(20.8, y, 2.6, 7, 1, 2) + pane(25.4, y, 2.6, 7, 1, 2) + pane(30, y, 2.6, 7, 1, 2),
          P("M13 " + (y + 8) + " V" + (y + 4) + " a7 4.6 0 0 1 14 0 V" + (y + 8) + "Z", PAPER) + S("M20 " + (y - 0.4) + " V" + (y + 8) + " M15.6 " + (y + 2) + " L17.4 " + (y + 8) + " M24.4 " + (y + 2) + " L22.6 " + (y + 8), 0.5) + R(6.4, y + 2, 4, 6, PAPER) + R(29.6, y + 2, 4, 6, PAPER)][f];
    s += l ? R(0, 31.6, 40, 1) + P("M2 38 V33.6 Q2 32.4 3.6 32.4 H28 Q33 32.4 34 38Z") + pane(5, 33.6, 3.4, 2, 1, 1) + pane(11, 33.6, 3.4, 2, 1, 1) + pane(17, 33.6, 3.4, 2, 1, 1) + pane(23, 33.6, 3.4, 2, 1, 1) + R(0, 38.2, 40, 0.9)
           : R(0, 31.6, 40, 1.4) + R(0, 36.6, 40, 0.9) + S("M3 34 V36.6 M9 34 V36.6 M15 34 V36.6 M21 34 V36.6 M27 34 V36.6 M33 34 V36.6", 0.9) + R(0, 34.4, 40, 0.7);
    return s;
  }
  function skyArt(seed) {   // a city's own skyline: widths and heights from its name
    var rr = rnd(seed), x = 0, bs = [];
    while (x < 38) { var w = 3.6 + Math.round(rr() * 4), hgt = 8 + Math.round(rr() * 24); bs.push([x, Math.min(w, 40 - x), hgt, rr() < 0.3 ? 2 + Math.round(rr() * 4) : 0]); x += w + (rr() < 0.4 ? 1 : 0); }
    return skyline(bs);
  }
  function stripArt(i) {   // the low skyline under a city's landmark: 6 roofs whose heights spell out the city's place in the list
    var s = R(0, 38, 40, 2), d = i;
    for (var b = 0; b < 6; b++) { var hgt = 2 + (d % 3) * 1.7; d = Math.floor(d / 3); s += R(b * 6.8 + 0.4, 38 - hgt, 5.6, hgt); }
    return s;
  }
  var DISH = {
    "cafe-du-monde": function () { return S("M3 31 Q20 37 37 31", 1.4) + [[8, 22], [17, 19], [13, 26], [22, 26]].map(function (b) { return P("M" + b[0] + " " + (b[1] + 6) + " q-1 -6 4 -6.4 q5 0.4 4 6.4Z") + C(b[0] + 3, b[1] + 2.4, 0.5, PAPER) + C(b[0] + 5, b[1] + 3.6, 0.5, PAPER); }).join("") + P("M28 18 H37 V24 Q37 28 32.5 28 Q28 28 28 24Z") + S("M37 20 q2.4 0 2.4 2 q0 2 -2.4 2", 1) + S("M31 15.4 q-1 -2 0 -4 M34 15.4 q-1 -2 0 -4", 0.7); },
    "katzs": function () { return P("M6 13 Q6 9 20 9 Q34 9 34 13 V15 H6Z") + [0, 1, 2, 3].map(function (n) { return S("M6 " + (17 + n * 2.6) + " q3.5 -1.6 7 0 t7 0 t7 0 t7 0", 1.6); }).join("") + P("M6 27 H34 V29 Q34 32 20 32 Q6 32 6 29Z") + P("M33 33 q4 -2 5.4 -8 q1 4 -2 8Z") + S("M2 35 H38", 1.2); },
    "pats-steaks": function () { return P("M2 22 Q2 15 9 15 H31 Q38 15 38 22 Q38 24 36 24 H4 Q2 24 2 22Z") + S("M4 25.4 q3 2 6 0 t6 0 t6 0 t6 0 t6 0", 1.6) + P("M8 26.6 q1 4 2.4 0Z M20 26.6 q1 5 2.6 0Z M29 26.6 q1 3.6 2.2 0Z") + P("M3 28 H37 Q37 31.6 31 31.6 H9 Q3 31.6 3 28Z") + S("M9 18 l3 -1 M18 18 l3 -1 M27 18 l3 -1", 0.6, PAPER); },
    "bens-chili-bowl": function () { return P("M3 25 H37 Q36 34 20 35.4 Q4 34 3 25Z") + S("M3 25 H37", 1.6) + P("M6 24 Q20 13 34 24Z") + [9, 14, 19, 24, 29].map(function (x, n) { return C(x, 21 - (n % 2) * 1.6, 1.1, PAPER); }).join("") + S("M24 13 L36 3", 1.4) + S("M10 11 q-1.6 -2.6 0 -5 M15 11 q-1.6 -2.6 0 -5", 0.8); },
    "franklin-bbq": function () { return R(2, 28, 36, 4) + C(36.4, 30, 1, PAPER) + [6, 13, 20, 27].map(function (x, n) { return G("rotate(" + (n * 3 - 4) + " " + (x + 3) + " 22)", P("M" + x + " 28 V18 Q" + (x + 3) + " 15.6 " + (x + 6) + " 18 V28Z") + S("M" + (x + 0.8) + " 19 V27", 0.7, PAPER)); }).join("") + S("M10 12 q-2 -3 0 -6 M18 12 q-2 -3 0 -6 M26 12 q-2 -3 0 -6", 0.9); },
    "pike-place": "MARKET:fish", "reading-terminal": "MARKET:pretzel", "borough-market": "MARKET:bread", "la-boqueria": "MARKET:fruit", "tsukiji-outer": "MARKET:sushi", "maxwell": "MARKET:noodles",
    "boudin": function () { return P("M4 30 Q4 13 20 13 Q36 13 36 30Z") + S("M10 20 l5 4 M17 17.6 l5 4 M24 17.6 l5 4", 1.2, PAPER) + S("M2 32 H38", 1.6) + P("M27 9 q4 -5 8 -1 q-4 2 -8 1Z"); },
    "lou-malnatis": function () { return P("M4 30 L20 9 L36 30Z") + P("M4 30 H36 V34.6 H4Z") + S("M5 32.3 H35", 0.6, PAPER) + C(17, 21, 1.8, PAPER) + C(23.4, 24, 1.8, PAPER) + C(14, 27, 1.6, PAPER) + C(22, 16, 1.2, PAPER) + S("M28 20 q3 -1 4 -4", 0.9); },
    "primanti": function () { return P("M4 14 Q4 8 20 8 Q36 8 36 14 V15.6 H4Z") + S("M3 18 L37 18", 1.6) + [6, 10, 14, 18, 22, 26, 30, 34].map(function (x, n) { return R(x - 0.8, 16 + (n % 3), 1.6, 5); }).join("") + S("M4 22.6 q4 -1.6 8 0 t8 0 t8 0 t8 0", 1.6) + P("M4 25 H36 V27 Q36 31 20 31 Q4 31 4 27Z") + S("M2 35 H38", 1.2); },
    "leonards": function () { return S("M2 33 H38", 1.6) + [[11, 24, 7], [27, 24, 7], [19, 17, 7]].map(function (b) { return C(b[0], b[1], b[2]) + C(b[0] - 2.4, b[1] - 2, 0.6, PAPER) + C(b[0] + 1.6, b[1] + 1, 0.6, PAPER) + C(b[0] - 0.4, b[1] + 3, 0.6, PAPER) + C(b[0] + 3, b[1] - 2.6, 0.6, PAPER); }).join(""); },
    "la-banquise": function () { return P("M3 22 H37 L34 34 H6Z") + [7, 11, 15, 19, 23, 27, 31].map(function (x, n) { return R(x, 12 + (n % 3) * 1.6, 2, 10); }).join("") + P("M6 22 Q10 17 15 21 Q20 16 25 21 Q30 17 34 22Z", PAPER) + C(12, 20, 1.6) + C(22, 19.4, 1.6) + C(29, 20.4, 1.4) + S("M10 28 H30", 0.7, PAPER); },
    "haggis": function () { return S("M2 26 a18 8 0 1 0 36 0 a18 8 0 1 0 -36 0", 1.4) + P("M9 25 Q9 14 17 14 Q25 14 25 25Z") + S("M12 18 q5 -2 10 0", 0.6, PAPER) + P("M23 27 q1 -6 6 -6 q5 0 5 6Z") + C(14, 28, 3.4) + S("M26.4 23.4 h4", 0.5, PAPER); },
    "fish-and-chips": function () { return P("M8 14 L26 14 L17 37Z") + S("M11 18 H23 M13.6 24 H20.6", 0.6, PAPER) + [10, 13, 16, 19, 22, 25].map(function (x, n) { return R(x, 6 + (n % 2) * 2, 2, 9); }).join("") + P("M26 12 Q31 7 37 11 L40 8 V16 L37 13 Q31 17 26 12Z") + C(29.4, 11.4, 0.7, PAPER); },
    "full-irish": function () { return S("M1.6 22 a18.4 14 0 1 0 36.8 0 a18.4 14 0 1 0 -36.8 0", 1.4) + P("M7 18 q3 -5 8 -2 q4 4 0 7 q-6 2 -8 -5Z", PAPER) + S("M7 18 q3 -5 8 -2 q4 4 0 7 q-6 2 -8 -5Z", 0.8) + C(11.6, 19.4, 2.2) +
      R(20, 13, 12, 3.4) + R(21, 17.8, 12, 3.4) + C(9, 28, 1.4) + C(12.6, 29.6, 1.4) + C(10.6, 25.6, 1.3) + P("M18 26 h14 a2 2 0 0 1 0 4 h-14 a2 2 0 0 1 0 -4Z"); },
    "pasteis-de-belem": function () { return S("M3 30 Q20 37 37 30", 1.4) + P("M7 27 L9 17 Q20 12 31 17 L33 27 Q20 31 7 27Z") + P("M10.4 18.6 Q20 14.6 29.6 18.6 Q20 22.4 10.4 18.6Z", PAPER) + C(16, 18.4, 1.2) + C(22.6, 17.6, 0.9) + C(19.6, 19.8, 0.7) + S("M11 21 L12 26 M15 22 L15.6 27 M20 22.4 V27.6 M25 22 L24.4 27 M29 21 L28 26", 0.6, PAPER); },
    "cafe-sacher": function () { return S("M2 33 Q20 38 38 33", 1.4) + P("M5 30 L22 14 L35 22 V31Z") + S("M6 26.4 L22 14.8 L35 22", 1.2, PAPER) + S("M7 28 L34 28", 0.7, PAPER) + P("M24 12 q1 -5 4 -6 q2 3 4 3 q2 2 -1 4 Z") + S("M38 6 L34 30", 1); },
    "da-michele": function () { return C(20, 21, 16) + C(20, 21, 13, PAPER) + C(20, 21, 11.6) + S("M20 9.4 V32.6 M8.4 21 H31.6", 0.8, PAPER) + [[14, 15], [26, 16], [15, 27], [26, 27]].map(function (p) { return P("M" + p[0] + " " + p[1] + " q2.4 -2.4 4 0 q-2 2.4 -4 0Z", PAPER); }).join("") + C(20, 21, 1.6, PAPER); }
  };
  var MARKET = { fish: 0, pretzel: 1, bread: 2, fruit: 3, sushi: 4, noodles: 5 };
  function marketArt(what) {   // a market stall: its own awning and what's on the counter
    var n = MARKET[what], st = [5, 6, 4, 7, 5, 6][n], w = 36 / st, s = R(4, 13, 1.6, 23) + R(34.4, 13, 1.6, 23) + R(0, 36.4, 40, 1.6) + R(3, 26, 34, 10.4);
    for (var i = 0; i < st; i++) s += (i % 2 ? "" : P("M" + (2 + i * w).toFixed(1) + " 6 H" + (2 + (i + 1) * w).toFixed(1) + " V12.4 " + (n % 2 ? "Q" + (2 + (i + 0.5) * w).toFixed(1) + " 15.6 " + (2 + i * w).toFixed(1) + " 12.4Z" : "L" + (2 + i * w).toFixed(1) + " 12.4Z")));
    s += S("M2 6 H38 V12.4 H2Z", 1) + S("M2 3.4 H38", 1.2) + S("M6 29 H34", 0.6, PAPER);
    s += [P("M8 22 Q14 18 20 22 L24 19 V25 L20 22 Q14 26 8 22Z") + P("M21 21 Q26 18 31 21 L34 18.6 V23.4 L31 21Z") + C(11, 21.6, 0.6, PAPER),
          [10, 20, 30].map(function (x) { return S("M" + x + " 25 q-4 -2 -2 -5 q3 -2 2 2 q-1 -4 2 -2 q2 3 -2 5", 1.4); }).join(""),
          P("M6 25 Q6 18 13 18 Q20 18 20 25Z") + P("M21 25 Q22 19 28 19.6 Q35 20 34 25Z") + S("M9 21 l2 -1 M13 20.4 l2 -1 M25 21 l3 -1", 0.6, PAPER),
          [8, 13, 18, 23, 28, 33].map(function (x, i) { return C(x, 22.6, 2.3) + (i % 2 ? S("M" + x + " 20 l1 -1.6", 0.6) : C(x - 0.7, 22, 0.5, PAPER)); }).join(""),
          [8, 15, 22, 29].map(function (x) { return R(x, 21.6, 5, 3.4) + P("M" + x + " 21.6 q2.5 -2.6 5 0Z") + S("M" + (x + 1) + " 23.4 h3", 0.5, PAPER); }).join(""),
          P("M7 20 H19 Q18 26 13 26 Q8 26 7 20Z") + P("M21 20 H33 Q32 26 27 26 Q22 26 21 20Z") + S("M15 19 L22 10 M17 19 L24 11", 0.8) + S("M10 18 q-1 -2 0 -3.4 M29 18 q-1 -2 0 -3.4", 0.6)][n];
    return s;
  }
  function ownArt(it, h) {   // your own finds: the kind of thing, with its own garnish from its id
    var v = h % 5, k = Math.floor(h / 5) % 4, dots = [0, 1, 2, 3].slice(0, k).map(function (n) { return C(31 + (n % 2) * 4, 6 + Math.floor(n / 2) * 4, 1.1); }).join("");
    var base = it.cat === "pubs" ? (v % 2 ? MINE.tankard() : MINE.pint()) : it.art === "cup" ? MINE.cup() : v % 2 ? MINE.bowl() : MINE.plate();
    return G(v > 2 ? "translate(40 0) scale(-1 1)" : "translate(0 0)", base) + dots + S("M2 " + (2 + v) + " h" + (3 + v), 0.8);
  }
  var IDX = null;
  function artIndex() {
    IDX = {}; var n = {};
    ["cities", "pubs", "hubs", "food"].forEach(function (c) { LIST[c].forEach(function (it) { var g = c + ":" + (c === "pubs" ? (it.art === "kettle" ? "brew" : "pub") : c === "hubs" ? it.extra : c === "cities" ? (/^sky/.test(it.art) ? "sky" : "hero") : "food"); IDX[it.id] = n[g] = n[g] == null ? 0 : n[g] + 1; }); });
  }
  /** The 40x40 picture inside a stamp. */
  function artFor(it, h) {
    if (!IDX) artIndex(); var i = IDX[it.id], code;
    if (it.own) return ownArt(it, h);
    if (it.cat === "hubs") { if (it.extra === "airport") { code = (/^([A-Z]{3})\b/.exec(it.sub || "") || [])[1] || String(it.id).slice(-3).toUpperCase(); return airArt(i != null ? i : h % 36, code); } return trainArt(i != null ? i : h % 24, it.name); }
    if (i == null) return glyph(it.art, h).svg;
    if (it.cat === "pubs") return it.art === "kettle" ? brewArt(i, it.name) : pubArt(i, it.name);
    if (it.cat === "food") { var d = DISH[it.id.replace(/^f-/, "")]; return typeof d === "function" ? d() : d ? marketArt(d.slice(7)) : glyph(it.art, h).svg; }
    if (/^sky/.test(it.art)) return skyArt(hash(it.id));
    var g = glyph(it.art, i % 3);
    return G("translate(5.6 0) scale(.72)", g.svg) + stripArt(i);
  }

  // ---------- the stamp: round engraved frame, name around the top, place around the bottom, date plate ----------
  var INKS = { cities: ["#2b4f5e", "#5b4a2f", "#4a3b6b", "#2f5d3a", "#6b3a2a"], food: ["#7a3b1d", "#2f5d3a", "#6b3a2a", "#5b4a2f"], pubs: ["#5b4a2f", "#7a3b1d", "#2f5d3a", "#3a3a3a"], hubs: ["#1f3f66", "#2b4f5e", "#4a3b6b", "#3a3a3a"] };
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
    var g = { svg: artFor(it, h), big: false }, sc = 2.1, gx = 38, gy = date ? 20 : 28;
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
    if (cat === "hubs") Object.keys(sp).forEach(function (id) { if (!BY[id] && /^h-air-[a-z]{3}$/.test(id)) out.push({ item: itemFor(id, [k]), at: sp[id].at || "", with: sp[id].with || [] }); });
    if (cat === "cities") Object.keys(sp).forEach(function (id) { if (STATION.test(id)) out.push({ item: stationItem(id, sp[id]), at: sp[id].at || "", with: sp[id].with || [] }); });
    if (cat === "food" || cat === "pubs") eatsOf(k, kidOf(k)).filter(function (e) { return e.stamp && entryItem(e).cat === cat; }).forEach(function (e) { out.push({ item: entryItem(e), at: e.at || "", with: e.with || [], entry: e }); });
    return out.sort(function (a, b) { return (a.at || "9") < (b.at || "9") ? -1 : 1; });
  }
  function counts(k) { return { cities: earned(k, "cities").length, hubs: earned(k, "hubs").length, food: earned(k, "food").length, pubs: earned(k, "pubs").length, list: eatsOf(k, kidOf(k)).length }; }
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
      if (w[p.id] && !has) { touch(p); sp[id] = { at: opts.date || opts.today || "" }; if (opts.item && opts.item.dyn) { sp[id].name = opts.item.name; sp[id].sub = opts.item.sub; } res.added.push(p.id); }
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
    if (e.stamp) o.stamp = true;
    if (/^trip_[A-Za-z0-9_-]{3,60}$/.test(e.tripId || "")) o.tripId = e.tripId;   // v58: the trip it was on
    if (/^([cfph]-[a-z0-9-]{1,60}|h-air-[a-z]{3}|e_[a-z0-9]{6,20})$/.test(e.link || "") && e.link !== o.id) o.link = e.link;   // the day's pub, food, city or hub stamp
    return o;
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
  // ---------- v58: food & drink by trip, and stamps from a trip's stops ----------
  function liveTrip(t) { return t && !t.deletedAt; }
  /** [{ trip | null, entries }]: trips newest first, then the entries not from a trip (or from a trip that's gone). */
  function groupByTrip(entries, trips) {
    var by = {}, order = [], loose = [];
    (trips || []).filter(liveTrip).forEach(function (t) { by[t.id] = t; });
    entries.forEach(function (e) { var t = e.tripId && by[e.tripId]; if (!t) return loose.push(e); if (!order.some(function (g) { return g.trip === t; })) order.push({ trip: t, entries: [] }); order.filter(function (g) { return g.trip === t; })[0].entries.push(e); });
    order.sort(function (a, b) { return (b.trip.date || "") < (a.trip.date || "") ? -1 : (b.trip.date || "") > (a.trip.date || "") ? 1 : 0; });
    if (loose.length) order.push({ trip: null, entries: loose });
    return order;
  }
  function addDay(iso, n) { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "") || !n) return iso || ""; var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  /** The day each stop starts: the trip's start plus the nights spent at the stops before it. */
  function stopDays(t) { var n = 0; return (t.route || []).map(function (p) { var d = addDay(t.date, n); n += (p && +p.nights) || 0; return d; }); }
  function tripPoints(t) {
    var days = stopDays(t), pts = (t.route || []).map(function (p, i) { return p && typeof p.lat === "number" && typeof p.lon === "number" ? { name: p.name || "", lat: p.lat, lon: p.lon, date: days[i] } : null; }).filter(Boolean);
    if (!pts.length && typeof t.lat === "number") pts.push({ name: t.place || "", lat: t.lat, lon: t.lon, date: t.date || "" });
    return pts;
  }
  var NEAR = { cities: 25, hubs: 3, food: 10, pubs: 10 };
  /** Stamps a trip can give, stop by stop: [{ stop, date, items: [item] }]. Airports come from the flights; pubs only when adult. */
  function tripStamps(t, adult) {
    var out = [], seen = {};
    function push(stop, date, it) { if (!it || seen[it.id]) return; seen[it.id] = 1; var g = out.filter(function (x) { return x.stop === stop; })[0]; if (!g) out.push(g = { stop: stop, date: date, items: [] }); g.items.push(it); }
    var days = stopDays(t);
    var r = t.route || [], last = r.length ? addDay(days[r.length - 1], (r[r.length - 1] && +r[r.length - 1].nights) || 0) : t.date;
    r.concat(t.back ? [t.back] : []).forEach(function (p, i) {   // one group per flight, on the day it lands
      if (!p || !(p.dep && p.dep.code || p.arr && p.arr.code)) return;
      var lbl = "✈️ " + [p.dep, p.arr].map(function (a) { return a && a.code ? String(a.code).toUpperCase() : "?"; }).join(" → ");
      [p.dep, p.arr].forEach(function (a) { if (a && a.code) push(lbl, i < r.length ? days[i] || t.date || "" : (t.endDate || last || ""), airportItem(a)); });
    });
    tripPoints(t).forEach(function (p) {
      ["cities", "hubs", "food"].concat(adult ? ["pubs"] : []).forEach(function (cat) {
        LIST[cat].filter(function (c) { return !(cat === "hubs" && c.extra === "airport") && miles(p, c) <= NEAR[cat]; }).forEach(function (c) { push(p.name, p.date, c); });
      });
    });
    return out;
  }
  /** The stamps someone already has that a list entry can point at, newest first (the day's ones first when a date is given). */
  function linkable(k, at) {
    var cats = ["food", "cities", "hubs"].concat(kidOf(k) ? [] : ["pubs"]), all = [];
    cats.forEach(function (c) { earned(k, c).forEach(function (x) { if (!x.entry || x.entry.stamp) all.push(x); }); });
    return all.sort(function (a, b) { var da = at && a.at === at ? 1 : 0, db = at && b.at === at ? 1 : 0; return db - da || ((b.at || "") < (a.at || "") ? -1 : 1); });
  }
  function restore(people, undo, now) {
    var by = {}; people.forEach(function (p) { by[p.id] = p; });
    return undo.map(function (u) { var p = by[u.id]; if (!p) return null; p.spots = u.spots; p.eats = u.eats; p.updatedAt = now || new Date().toISOString(); return p; }).filter(Boolean);
  }
  var core = { artFor: artFor, groupByTrip: groupByTrip, tripStamps: tripStamps, linkable: linkable, airportItem: airportItem, airportId: airportId, itemFor: itemFor, NEAR: NEAR, CATS: CATS, LIST: LIST, BY: BY, TYPES: TYPES, stampSVG: stampSVG, earned: earned, counts: counts, fromTrips: fromTrips, applySpot: applySpot, applyEntry: applyEntry, cleanEntry: cleanEntry, restore: restore, entryItem: entryItem, stampDate: stampDate, isCat: function (c) { return !!CATS[c]; } };
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
  function openSpot(page, id, after, date, who) {
    var it = itemFor(id, A().state.kids); if (!it) return; var adult = !!CATS[it.cat].adult, list = pickList(adult), had = holdersOf(id), me = W().whoAmI().me, on = startOn(list, had, page);
    if (!had.length && who) on = list.filter(function (p) { return who.indexOf(p.id) >= 0; }).map(function (p) { return p.id; });
    var el = U().sheet('<div class="sheethead"><h3>Who\'s been to ' + esc(it.name) + '?</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      '<p class="small muted">Tick everyone who was there. They each get the stamp.' + (adult ? " Pubs are for grown-ups, so kids aren't listed." : "") + '</p>' + whoBlock(list, on, me) +
      '<p class="small muted wlabel">When? (optional)</p>' + U().dateFields(date || "") +
      '<p class="err" id="sperr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="spok">Save</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
    var box = $(".sheetbox", el); box.classList.add("whosheet"); bindAll(box);
    $("#spok", box).onclick = function () {
      var want = W().picked(box); if (!want.length && !had.length) { var er = $("#sperr", box); er.hidden = false; er.textContent = "Tick who's been there."; return; }
      var r = applySpot(list, id, want, { date: U().readDate(), today: today(), item: it });
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
  function tripOptions(page, cur) {
    var l = A().state.trips.filter(function (t) { return liveTrip(t) && (t.kidIds || []).indexOf(page.id) >= 0 || t.id === cur; }).sort(function (a, b) { return (b.date || "") < (a.date || "") ? -1 : 1; });
    return '<option value="">Not from a trip</option>' + l.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === cur ? " selected" : "") + '>' + esc(tripName(t) + (t.date ? " · " + niceAt(t.date) : "")) + '</option>'; }).join("");
  }
  function linkOptions(page, e) {
    var l = linkable(page, e.at), o = '<option value="">None</option>', has = false;
    l.forEach(function (x) { if (x.item.id === e.id) return; if (x.item.id === e.link) has = true; o += '<option value="' + esc(x.item.id) + '"' + (x.item.id === e.link ? " selected" : "") + '>' + esc(x.item.name + (x.at ? " · " + niceAt(x.at) : "")) + '</option>'; });
    if (e.link && !has) { var it = itemFor(e.link, A().state.kids); if (it) o += '<option value="' + esc(it.id) + '" selected>' + esc(it.name) + '</option>'; }
    return o;
  }
  // ---------- v58: on a trip's page: its food & drink, and the stamps its stops can give ----------
  function tripHTML(k, t) {
    var kid = kidOf(k), people = A().state.kids, seen = {}, eats = [];
    people.forEach(function (p) { if ((t.kidIds || []).indexOf(p.id) < 0) return; eatsOf(p, kid).forEach(function (e) { if (e.tripId === t.id && !seen[e.id]) { seen[e.id] = 1; eats.push(e); } }); });
    eats.sort(function (a, b) { return (a.at || "") < (b.at || "") ? -1 : 1; });
    var sp = spotsOf(k), groups = tripStamps(t, !kid);
    return '<section class="tripfood"><h3 class="sec">Food &amp; drink</h3>' +
      (eats.length ? '<div class="elist parks">' + eats.map(eatRow).join("") + '</div>' : '<p class="small muted">What did you eat and drink? Add the dish, the drink and the place.</p>') +
      '<div class="actions noprint"><button type="button" class="btn btn-ghost" id="tfadd">🍽️ Add food &amp; drink</button></div>' +
      (groups.length ? '<h3 class="sec">Stamps from this trip</h3><div class="tstamps">' + groups.map(function (g) {
        return '<div class="tstop"><b>' + esc(g.stop || "A stop") + '</b>' + (g.date ? ' <span class="muted small">' + esc(niceAt(g.date)) + '</span>' : "") + '<div class="echips">' + g.items.map(function (it) {
          var on = !!sp[it.id]; return '<button type="button" class="chip' + (on ? " on" : "") + '" data-tspot="' + esc(it.id) + '" data-date="' + esc(g.date) + '" aria-pressed="' + on + '">' + (on ? "✓ " : "+ ") + ({ cities: "🏙️ ", hubs: it.extra === "airport" ? "✈️ " : "🚉 ", food: "🍽️ ", pubs: "🍺 " }[it.cat] || "") + esc(it.name) + '</button>'; }).join("") + '</div></div>';
      }).join("") + '</div>' : "") + '</section>';
  }
  function bindTrip(k, t, main, again) {
    var add = $("#tfadd", main); if (add) add.onclick = function () { openEntry(k, { type: "food", tripId: t.id, at: t.date || "" }, again); };
    $$(".tripfood [data-eat]", main).forEach(function (b) { b.onclick = function () { var e = null; A().state.kids.some(function (p) { e = eatsOf(p).filter(function (x) { return x.id === b.dataset.eat; })[0]; return !!e; }); if (e) openEntry(k, e, again); }; });
    $$("[data-tspot]", main).forEach(function (b) { b.onclick = function () { openSpot(k, b.dataset.tspot, again, b.dataset.date || "", t.kidIds); }; });
    lazy(main, k);
  }
  /** Add or edit a Food & drink list entry. e = existing entry (edit) or { type, stamp } defaults. */
  function openEntry(page, e, after) {
    e = e || {}; var editing = !!e.id, kid = kidOf(page), had = editing ? A().state.kids.filter(function (p) { return eatsOf(p).some(function (x) { return x.id === e.id; }); }).map(function (p) { return p.id; }) : [];
    var types = TYPES.filter(function (t) { return !(kid && isAdultType(t[0])); }), list = pickList(isAdultType(e.type)), me = W().whoAmI().me, on = startOn(list, had, page);
    var tt = !editing && e.tripId ? A().state.trips.filter(function (t) { return t.id === e.tripId; })[0] : null;
    if (tt) on = list.filter(function (p) { return tt.kidIds.indexOf(p.id) >= 0; }).map(function (p) { return p.id; });   // from a trip: its travelers
    var el = U().sheet('<div class="sheethead"><h3>' + (editing ? "Edit" : e.stamp ? "Add your own spot" : "Add to the list") + '</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      '<div class="field"><label for="ename">What was it?</label><input id="ename" maxlength="80" placeholder="e.g. Fish tacos, a pint of stout, Luigi\'s" value="' + esc(e.name || "") + '"></div>' +
      '<div class="field"><label for="etype">Type</label><select id="etype">' + types.map(function (t) { return '<option value="' + t[0] + '"' + (e.type === t[0] ? " selected" : "") + '>' + t[1] + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="eplace">Where?</label><select id="eplace">' + placeOptions(e.place || "") + '</select></div>' +
      '<div class="field"><label for="ewhere">Place name (optional)</label><input id="ewhere" maxlength="60" placeholder="e.g. a café in Galway" value="' + esc(e.placeName || "") + '"></div>' +
      '<p class="small muted wlabel">When? (optional)</p>' + U().dateFields(e.at || "") +
      '<div class="field"><label for="etrip">Trip</label><select id="etrip">' + tripOptions(page, e.tripId) + '</select></div>' +
      '<div class="field"><label for="elink">Goes with a stamp (optional)</label><select id="elink">' + linkOptions(page, e) + '</select></div>' +
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
      var r = applyEntry(A().state.kids, { id: e.id, name: name, type: $("#etype", box).value, place: $("#eplace", box).value, placeName: $("#ewhere", box).value, at: U().readDate(), note: $("#enote", box).value, rating: $("#erate", box).value, stamp: $("#estamp", box).checked, tripId: $("#etrip", box).value, link: $("#elink", box).value }, want);
      done(r, name + (editing ? " updated" : " added for " + W().names(want)));
    };
    if (editing) $("#edel", box).onclick = function () { done(applyEntry(A().state.kids, e, []), e.name + " removed"); };
  }

  // ---------- views ----------
  var io = null;
  function lazy(main, k) {
    var els = $$("[data-sp]", main);
    function fill(el) { var id = el.dataset.sp, at = el.dataset.at || ""; var it = itemFor(id, [k].concat(A().state.kids)); el.innerHTML = it ? stampSVG(it, at) : ""; el.removeAttribute("data-sp"); }
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
      (e.note ? '<span class="enote">' + esc(e.note) + '</span>' : "") + linkLine(e) + '</div><button type="button" class="pill" data-eat="' + esc(e.id) + '">Edit</button></div>';
  }
  function tripName(t) { return String(t.title || "").replace(/^\s*draft:\s*/i, "").trim() || String(t.place || "").replace(/^\s*draft:\s*/i, "").trim() || "A trip"; }
  function linkLine(e) { var it = e.link ? itemFor(e.link, A().state.kids) : null; return it ? '<span class="elink small">🔗 ' + esc(it.name) + '</span>' : ""; }
  function listHTML(k, f) {
    var kid = kidOf(k), l = eatsOf(k, kid).slice(), sort = f.sort || "new";
    l.sort(function (a, b) { return sort === "rating" ? (b.rating || 0) - (a.rating || 0) : sort === "name" ? a.name.localeCompare(b.name) : (b.at || "") < (a.at || "") ? -1 : 1; });
    var types = TYPES.filter(function (t) { return !(kid && isAdultType(t[0])); });
    return '<div class="panel eats"><div class="ehead"><h3>' + esc(M().who(k)) + '\'s food &amp; drink list <small class="muted">' + l.length + '</small></h3><button type="button" class="btn btn-beacon" id="eadd">+ Add</button></div>' +
      (l.length ? '<div class="field" style="margin-top:0"><label for="efind">Search the list</label><input id="efind" type="search" placeholder="e.g. tacos or Dublin" autocomplete="off"></div>' +
        '<div class="echips" role="group" aria-label="Show">' + [["", "All"]].concat(types).map(function (t) { return '<button type="button" class="chip' + ((f.type || "") === t[0] ? " on" : "") + '" data-etype="' + t[0] + '" aria-pressed="' + ((f.type || "") === t[0]) + '">' + t[1].replace(", wine & spirits", " & wine") + '</button>'; }).join("") +
        '<label class="esort">Sort <select id="esort"><option value="new"' + (sort === "new" ? " selected" : "") + '>Newest</option><option value="rating"' + (sort === "rating" ? " selected" : "") + '>Best rated</option><option value="name"' + (sort === "name" ? " selected" : "") + '>A–Z</option></select></label></div>' +
        groupByTrip(l, A().state.trips).map(function (g) {
          var t = g.trip, head = t ? '<a class="tapline" href="#/p/' + esc(k.id) + '/trip/' + esc(t.id) + '">🧳 ' + esc(tripName(t)) + '</a>' + (t.date ? ' <span class="muted small">' + esc(niceAt(t.date)) + '</span>' : "") : "Not from a trip";
          return '<div class="egroup" data-egroup><h4 class="eghead">' + head + ' <small class="muted">' + g.entries.length + '</small></h4><div class="elist parks">' + g.entries.map(eatRow).join("") + '</div></div>';
        }).join("") + '<p class="muted small" id="enone" hidden>Nothing matches.</p>'
        : '<p class="muted">Jot down the good stuff: a dish, a drink, a little place you loved. Tick "Make it a stamp" for the ones worth a passport stamp.</p>') + '</div>';
  }
  /** The page body for one category (inside the Parks tab shell). */
  function html(k, cat, trips) {
    var c = CATS[cat], sp = spotsOf(k), n = LIST[cat].filter(function (it) { return sp[it.id]; }).length, mine = cat === "cities" ? [] : earned(k, cat).filter(function (x) { return x.entry; });
    var sug = cat === "cities" ? fromTrips(k, trips) : [];
    if (cat === "hubs") { var hs = {}; (trips || []).filter(function (t) { return liveTrip(t) && (t.kidIds || []).indexOf(k.id) >= 0; }).forEach(function (t) {
      tripStamps(t, false).forEach(function (g) { g.items.forEach(function (it) { if (it.cat === "hubs" && !sp[it.id] && !hs[it.id]) { hs[it.id] = 1; sug.push({ item: it, date: g.date }); } }); }); }); }
    if (cat === "hubs") mine = earned(k, "hubs").filter(function (x) { return x.item.dyn; });
    var sts = cat === "cities" ? earned(k, "cities").filter(function (x) { return x.item.extra === "station"; }) : [];   // v65 stamp stations
    return counterHTML(n, LIST[cat].length, c.what) +
      (sts.length ? '<div class="panel"><h3>📍 Stamp stations <small class="muted">' + sts.length + '</small></h3><div class="spgrid">' +
        sts.map(function (x) { return '<button type="button" class="spitem" data-spot="' + esc(x.item.id) + '">' + stampSpan(x.item, { at: x.at }, "spst") + '</button>'; }).join("") + '</div></div>' : "") +
      (sug.length ? '<div class="panel spsug"><h3>From ' + esc(M().who(k)) + '\'s trips</h3><p class="small muted">' + (cat === "hubs" ? "Airports and stations these trips went through." : "These trips went to cities with a stamp.") + ' Tap one to stamp it.</p><div class="echips">' +
        sug.slice(0, 12).map(function (s) { return '<button type="button" class="chip" data-spot="' + esc(s.item.id) + '" data-date="' + esc(s.date) + '">+ ' + esc(s.item.name) + '</button>'; }).join("") + '</div></div>' : "") +
      (cat === "food" ? '<div data-elist>' + listHTML(k, {}) + '</div>' : "") +
      (cat === "hubs" && mine.length ? '<div class="panel"><h3>Other airports ' + esc(M().who(k)) + ' flew through <small class="muted">' + mine.length + '</small></h3><div class="spgrid">' +
        mine.map(function (x) { return '<button type="button" class="spitem" data-spot="' + esc(x.item.id) + '">' + stampSpan(x.item, { at: x.at }, "spst") + '</button>'; }).join("") + '</div></div>' : "") +
      (cat === "pubs" ? '<div class="panel"><div class="ehead"><h3>Your own pubs &amp; breweries <small class="muted">' + mine.length + '</small></h3><button type="button" class="btn btn-beacon" id="padd">+ Add your own</button></div>' +
        (mine.length ? '<div class="spgrid">' + mine.map(function (x) { return '<button type="button" class="spitem" data-eat="' + esc(x.entry.id) + '">' + stampSpan(x.item, { at: x.at }, "spst") + '</button>'; }).join("") + '</div>' : '<p class="muted small">A local you love, a brewery tour, a beer garden. Add it and it gets its own stamp.</p>') + '</div>' : "") +
      '<div class="panel parks plist" data-plist="spots-' + cat + ':' + esc(k.id) + '"><h3 class="plh">' + (cat === "food" ? "Famous food spots" : cat === "pubs" ? "Famous pubs & breweries" : cat === "hubs" ? "Big airports & train stations" : "Big cities") + '</h3>' +
        window.FS_FIND.tools('<div class="field" style="margin-top:0"><label for="spfind">' + esc(c.find) + '</label><input id="spfind" type="search" placeholder="' + esc(c.ph) + '" autocomplete="off"></div>') + curatedHTML(k, cat) + '</div>' +
      '<p class="hint">' + (cat === "cities" ? "Big cities around the world, each with its own stamp. A trip to one shows up above so you can stamp it." : cat === "hubs" ? "Airports and great train stations. Any airport on a trip's flights can be stamped, even if it isn't on this list." : cat === "pubs" ? "Famous old pubs, beer halls and brewery tours. Opening hours change, so check before you go. Only grown-ups see this page." : "Famous food spots get a stamp; your own finds go on the list above.") + '</p>';
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
      $$("[data-egroup]", host).forEach(function (g) { g.hidden = !$$(".row.eat", g).some(function (r) { return r.style.display !== "none"; }); });
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
    var kid = kidOf(k), cats = ["cities", "hubs", "food"].concat(kid ? [] : ["pubs"]), any = false;
    var body = cats.map(function (cat) {
      var l = earned(k, cat); if (!l.length) return ""; any = true;
      return '<div class="spsec"><div class="bshead"><h3>' + (cat === "cities" ? "Cities" : cat === "hubs" ? "Travel hubs" : cat === "food" ? "Food & drink" : "Pubs & breweries") + ' <small class="muted">' + l.length + '</small></h3><a class="tapline" href="#/p/' + esc(k.id) + '/parks/' + cat + '">See all ›</a></div>' +
        '<div class="spgrid">' + l.map(function (x) { return '<button type="button" class="spitem" data-spd="' + esc(x.item.id) + '" aria-label="' + esc(x.item.name) + '">' + stampSpan(x.item, { at: x.at }, "spst") + '</button>'; }).join("") + '</div></div>';
    }).join("");
    return any ? '<section class="spots">' + body + '</section>' : "";
  }
  function bindSection(k, main) {
    $$("[data-spd]", main).forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.spd, all = earned(k, "cities").concat(earned(k, "hubs"), earned(k, "food"), earned(k, "pubs")), x = all.filter(function (y) { return y.item.id === id; })[0]; if (!x) return;
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
  core.tripHTML = tripHTML; core.bindTrip = bindTrip; core.html = html; core.bind = bind; core.sectionHTML = sectionHTML; core.bindSection = bindSection; core.openSpot = openSpot; core.openEntry = openEntry; core.kidOf = kidOf;
  return core;
});
