/* Famstamp v78: every town worldwide in place search (and, from v79, sights), loaded a small file at a time.
   data/towns/<key>.json holds every place whose name (or English / local name: Ghent/Gent, Bruges/Brugge, Cologne/Köln)
   starts with <key>: the first 2 letters, or 3 for busy prefixes (listed in data/towns/index.json "split").
   Built by scripts/build_towns.py from GeoNames (CC BY 4.0). data/places.json is unchanged; this is a layer on top.
   fold() must match fold() in scripts/build_towns.py. The core runs in Node (tests). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_TOWNS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SPECIAL = { "ß": "ss", "ẞ": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŀ": "l", "ŧ": "t", "ŋ": "n", "ĸ": "k", "ſ": "s" };
  /** Lowercase, accents off (Köln -> koln, Liège -> liege), punctuation to spaces, St/Ste/Saint, Mt/Mount, Ft/Fort the same. */
  function fold(s) {
    s = String(s == null ? "" : s).toLowerCase();
    if (/[^\x00-\x7f]/.test(s) && s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g, "");
    if (/[^\x00-\x7f]/.test(s)) s = s.replace(/[ßẞæœøłđðþıħŀŧŋĸſ]/g, function (c) { return SPECIAL[c]; });
    s = s.replace(/['’`ʻ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    s = (s + " ").replace(/\b(st|ste|saint) /g, "saint ").replace(/\bmt /g, "mount ").replace(/\bft /g, "fort ");
    return s.trim();
  }
  /** Which file a query needs ("" when it's too short to pick one). index = data/towns/index.json */
  function keyFor(q, index) {
    var f = fold(q).replace(/ /g, ""); if (f.length < 2) return "";
    var k2 = f.slice(0, 2), split = (index && index.split) || [];
    if (split.indexOf(k2) < 0) return k2;
    return f.length >= 3 ? f.slice(0, 3) : k2 + "_";
  }
  /** One file's rows: names (first = the place's own name), position, country (ISO3), admin1, population, and for sights type/town. */
  function row(l) {
    var c = l.split("\t"), names = c[0].split("|");
    var r = { names: names, folds: names.map(fold), lat: +c[1], lon: +c[2], country: c[3], admin1: c[4] || "", pop: +c[5] || 0 };
    if (c[6]) r.type = c[6];
    if (c[7]) r.town = c[7];
    if (c[8]) r.rank = +c[8] || 0;
    if (c[9]) r.wd = c[9];
    if (c[10] === "U") r.unesco = true;   // v97: UNESCO World Heritage (Wikidata P1435)
    return r;
  }
  function parse(j) {
    var rows = String((j && j.rows) || "").split("\n").filter(Boolean).map(row);
    return { key: j && j.key, admin: (j && j.admin) || {}, countries: (j && j.countries) || {}, rows: rows };
  }
  /** v94: the same, in small slices with breaks between, so a big file doesn't freeze typing. Resolves to what parse() gives. */
  function parseAsync(j) {
    var lines = String((j && j.rows) || "").split("\n").filter(Boolean), rows = new Array(lines.length), i = 0;
    return new Promise(function (done) {
      (function slice() {
        var t0 = Date.now();
        for (; i < lines.length && (i % 100 || Date.now() - t0 < 12); i++) rows[i] = row(lines[i]);
        if (i < lines.length) return setTimeout(slice, 0);
        done({ key: j && j.key, admin: (j && j.admin) || {}, countries: (j && j.countries) || {}, rows: rows });
      })();
    });
  }
  /** Rows whose name (any spelling) starts with the query's first part, best first: an exact name, then famous / big places.
      Each hit: { row, name (the spelling they typed), exact }. Words inside a name match too ("castle" finds "Edinburgh Castle")
      when opts.words is set. */
  function match(q, shard, opts) {
    opts = opts || {};
    var head = fold(String(q || "").split(",")[0]); if (head.length < 2 || !shard) return [];
    var out = [], lim = opts.limit || 40;
    for (var i = 0; i < shard.rows.length; i++) {
      var r = shard.rows[i], hit = -1, exact = false;
      for (var n = 0; n < r.folds.length; n++) {
        var f = r.folds[n];
        if (f === head) { hit = n; exact = true; break; }
        if (hit < 0 && (f.indexOf(head) === 0 || (opts.words && head.length >= 3 && f.indexOf(" " + head) > 0))) hit = n;
      }
      if (hit >= 0) out.push({ row: r, name: r.names[hit], exact: exact });
    }
    out.sort(function (a, b) { return (b.exact - a.exact) || ((b.row.rank || 0) - (a.row.rank || 0)) || (b.row.pop - a.row.pop); });
    return out.slice(0, lim);
  }
  return { fold: fold, keyFor: keyFor, parse: parse, parseAsync: parseAsync, match: match };
});
