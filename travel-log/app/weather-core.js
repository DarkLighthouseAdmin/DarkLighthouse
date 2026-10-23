/* Famstamp weather: per-day weather for each trip, with no browser parts so it can be tested in Node.
   Data comes from Open-Meteo (free, no key; only each stop's rounded location and the dates are sent):
     - days up to 16 ahead: the forecast API (also used for the last few days, before the archive catches up)
     - past days: the archive API (real recorded weather)
     - further out: "Typical weather", the same dates averaged over the last 5 years from the archive
   A family can also pick a day's weather by hand (Sunny, Rainy, ...). A pick wins over fetched data, is saved with
   the trip (t.wx) and syncs with it. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WK_WX = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var KINDS = [
    { id: "sunny", ic: "☀️", label: "Sunny" }, { id: "partly", ic: "⛅", label: "Partly cloudy" }, { id: "cloudy", ic: "☁️", label: "Cloudy" },
    { id: "rainy", ic: "🌧️", label: "Rainy" }, { id: "stormy", ic: "⛈️", label: "Stormy" }, { id: "snowy", ic: "🌨️", label: "Snowy" },
    { id: "windy", ic: "💨", label: "Windy" }, { id: "foggy", ic: "🌫️", label: "Foggy" }, { id: "hot", ic: "🥵", label: "Hot" }, { id: "cold", ic: "🥶", label: "Cold" }];
  var KIND = {}; KINDS.forEach(function (k) { KIND[k.id] = k; });
  var MAX_DAYS = 45, FORECAST_AHEAD = 14, ARCHIVE_LAG = 5, TYPICAL_YEARS = 5, FORECAST_TTL = 3 * 3600e3;
  var DAILY = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum";

  function vdate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T12:00:00Z")) ? s : ""; }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5); }
  function shiftYears(iso, n) { var y = +iso.slice(0, 4) - n, md = iso.slice(5); if (md === "02-29") md = "02-28"; return y + "-" + md; }
  function hasLoc(p) { return p && typeof p.lat === "number" && typeof p.lon === "number" && isFinite(p.lat) && isFinite(p.lon); }
  function locKey(p) { return p.lat.toFixed(2) + "," + p.lon.toFixed(2); }

  /** WMO weather code -> one of our kinds. */
  function codeKind(c) {
    if (c == null || isNaN(c)) return "";
    c = +c;
    if (c === 0) return "sunny"; if (c <= 2) return "partly"; if (c === 3) return "cloudy"; if (c === 45 || c === 48) return "foggy";
    if (c >= 95) return "stormy"; if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snowy";
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rainy";
    return "cloudy";
  }

  /** The trip's days, each with the stop(s) the family was at. Nights come from the stop, else the stays there, else the
      nights left over are shared by the stops that have none. Day 0 is the travel day out; the last day is the way home. */
  function tripDays(t) {
    var start = vdate(t && t.date); if (!start) return [];
    var end = vdate(t.endDate), n = end ? daysBetween(start, end) : (typeof t.nights === "number" ? t.nights : 0);
    if (!(n >= 0)) n = 0; n = Math.min(n, MAX_DAYS - 1);
    var r = (t.route || []).filter(hasLoc), stops = r.length > 1 ? r.slice(1) : r.slice();
    if (!stops.length) return [];
    var stays = t.stays || [], nights = stops.map(function (p) {
      if (typeof p.nights === "number") return p.nights;
      var low = String(p.name || "").toLowerCase(), s = 0, any = false;
      stays.forEach(function (x) { if (typeof x.nights === "number" && x.where && String(x.where).toLowerCase() === low) { s += x.nights; any = true; } });
      return any ? s : null;
    });
    var known = 0, unknown = 0; nights.forEach(function (x) { if (x == null) unknown++; else known += x; });
    var left = Math.max(0, n - known), each = unknown ? Math.floor(left / unknown) : 0, extra = unknown ? left - each * unknown : 0;
    nights = nights.map(function (x) { if (x != null) return x; var v = each + (extra > 0 ? 1 : 0); extra--; return v; });
    var at = [], day = 0;
    for (var d = 0; d <= n; d++) at.push([]);
    stops.forEach(function (p, i) { var dd = Math.min(day, n); if (at[dd].indexOf(p) < 0) at[dd].push(p); day += nights[i]; });
    var cur = null;
    return at.map(function (list, i) {
      if (list.length) cur = list[list.length - 1]; else if (cur) list = [cur];
      return { date: addDays(start, i), stops: list.map(function (p) { return { name: p.name, lat: p.lat, lon: p.lon, key: locKey(p) }; }) };
    });
  }

  /** Where each day's data comes from, relative to today (YYYY-MM-DD). */
  function sourceFor(date, today) {
    var dd = daysBetween(today, date);
    if (dd < -ARCHIVE_LAG) return "archive";
    if (dd <= FORECAST_AHEAD) return "forecast";
    return "typical";
  }

  /** The requests a trip needs: [{ group, url, locs:[key], years }]. One request per group covers every stop at once. */
  function plan(days, today) {
    var groups = {};
    days.forEach(function (d) {
      var g = sourceFor(d.date, today), o = groups[g] || (groups[g] = { group: g, from: d.date, to: d.date, locs: {} });
      if (d.date < o.from) o.from = d.date; if (d.date > o.to) o.to = d.date;
      d.stops.forEach(function (s) { o.locs[s.key] = s; });
    });
    var out = [];
    Object.keys(groups).sort().forEach(function (g) {
      var o = groups[g], keys = Object.keys(o.locs).sort(), lat = keys.map(function (k) { return k.split(",")[0]; }).join(","), lon = keys.map(function (k) { return k.split(",")[1]; }).join(",");
      var q = "latitude=" + lat + "&longitude=" + lon + "&daily=" + DAILY + (g === "forecast" ? ",precipitation_probability_max" : "") + "&temperature_unit=fahrenheit&precipitation_unit=mm&timezone=" + keys.map(function () { return "auto"; }).join(",");
      if (g === "forecast") out.push({ group: g, sig: g + ":" + o.from + ":" + o.to + ":" + keys.join("|"), locs: keys, url: "https://api.open-meteo.com/v1/forecast?" + q + "&start_date=" + o.from + "&end_date=" + o.to, from: o.from, to: o.to });
      else if (g === "archive") out.push({ group: g, sig: g + ":" + o.from + ":" + o.to + ":" + keys.join("|"), locs: keys, url: "https://archive-api.open-meteo.com/v1/archive?" + q + "&start_date=" + o.from + "&end_date=" + o.to, from: o.from, to: o.to });
      else for (var y = 1; y <= TYPICAL_YEARS; y++) {
        var f = shiftYears(o.from, y), t = shiftYears(o.to, y);
        out.push({ group: "typical", year: y, sig: "typical" + y + ":" + o.from + ":" + o.to + ":" + keys.join("|"), locs: keys, url: "https://archive-api.open-meteo.com/v1/archive?" + q + "&start_date=" + f + "&end_date=" + t, from: o.from, to: o.to, shift: y });
      }
    });
    return out;
  }

  /** Open-Meteo JSON (one location = an object, several = an array) -> { "lat,lon|YYYY-MM-DD": {hi, lo, code, mm, pop} }.
      Typical-weather years are shifted back onto the trip's own dates. */
  function parse(json, req) {
    var list = Array.isArray(json) ? json : [json], out = {};
    list.forEach(function (j, i) {
      var key = req.locs[i], dl = j && j.daily; if (!key || !dl || !Array.isArray(dl.time)) return;
      dl.time.forEach(function (day, n) {
        var date = req.shift ? shiftYears(day, -req.shift) : day;
        function v(f) { var a = dl[f]; return a && typeof a[n] === "number" && isFinite(a[n]) ? a[n] : null; }
        var hi = v("temperature_2m_max"), lo = v("temperature_2m_min"); if (hi == null && lo == null) return;
        out[key + "|" + date] = { hi: hi, lo: lo, code: v("weather_code"), mm: v("precipitation_sum"), pop: v("precipitation_probability_max") };
      });
    });
    return out;
  }
  /** Average several years' rows for one key into a typical day. */
  function typicalOf(rows) {
    rows = rows.filter(Boolean); if (!rows.length) return null;
    function avg(f) { var a = rows.map(function (r) { return r[f]; }).filter(function (x) { return typeof x === "number"; }); return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
    var wet = rows.filter(function (r) { return typeof r.mm === "number" && r.mm >= 1; }).length, count = {};
    rows.forEach(function (r) { var k = codeKind(r.code); if (k) count[k] = (count[k] || 0) + 1; });
    var kind = Object.keys(count).sort(function (a, b) { return count[b] - count[a] || (a < b ? -1 : 1); })[0] || "";
    if (wet / rows.length >= 0.5 && kind !== "snowy" && kind !== "stormy") kind = "rainy";
    return { hi: avg("hi"), lo: avg("lo"), kind: kind, pop: Math.round(wet / rows.length * 100), years: rows.length };
  }

  /** Clean the hand-picked weather saved on a trip: { "YYYY-MM-DD": { k: "rainy", t: 61 } } (t = °F, optional). */
  function cleanWx(o) {
    var out = {}; if (!o || typeof o !== "object") return out;
    Object.keys(o).filter(vdate).sort().slice(0, MAX_DAYS).forEach(function (d) {
      var x = o[d]; if (!x || !KIND[x.k]) return;
      var e = { k: x.k }; if (typeof x.t === "number" && isFinite(x.t) && x.t >= -60 && x.t <= 140) e.t = Math.round(x.t);
      out[d] = e;
    });
    return out;
  }

  /** Each day's rows for display: [{ date, stops:[{name, kind, ic, hi, lo, pop, mm, src}] , manual }]
      src: "manual" | "past" (real recorded weather) | "forecast" | "typical" | "" (nothing yet). cache = { rows, typical }. */
  function build(t, cache, today) {
    var days = tripDays(t), man = cleanWx(t.wx), rows = (cache && cache.rows) || {}, typ = (cache && cache.typical) || {};
    return days.map(function (d) {
      var m = man[d.date], g = sourceFor(d.date, today);
      return { date: d.date, manual: m || null, src: g, stops: d.stops.map(function (s) {
        var k = s.key + "|" + d.date, o = { name: s.name, key: s.key, src: "" };
        if (g === "typical") { var y = typ[k]; if (y) { o.kind = y.kind; o.hi = y.hi; o.lo = y.lo; o.pop = y.pop; o.src = "typical"; } }
        else { var r = rows[k]; if (r) { o.kind = codeKind(r.code); o.hi = r.hi; o.lo = r.lo; o.mm = r.mm; o.pop = r.pop; o.src = d.date < today ? "past" : "forecast"; } }
        if (m) { o.real = o.src ? { kind: o.kind, hi: o.hi, lo: o.lo, src: o.src } : null; o.kind = m.k; o.src = "manual"; delete o.pop; delete o.mm; if (m.t != null) { o.hi = m.t; o.lo = null; } else if (!o.real) { o.hi = o.lo = null; } }
        if (o.kind) o.ic = KIND[o.kind].ic;
        return o;
      }) };
    });
  }

  /** Weather worth a line in the story: hand-picked days, and real past weather (never a forecast or a typical guess).
      Returns [{ kind, place, src }], the most notable first, one per kind. */
  var NOTABLE = ["stormy", "snowy", "rainy", "hot", "cold", "windy", "foggy", "sunny"];
  function storyNotes(days, max) {
    var seen = {}, list = [];
    days.forEach(function (d) { d.stops.forEach(function (s) {
      if (!s.kind || (s.src !== "manual" && s.src !== "past")) return;
      var k = s.kind; if (s.src === "past") { if (typeof s.hi === "number" && s.hi >= 88) k = "hot"; else if (typeof s.hi === "number" && s.hi <= 35 && k !== "snowy") k = "cold"; }
      if (s.src !== "manual" && NOTABLE.indexOf(k) < 0) return;
      if (seen[k]) return; seen[k] = 1; list.push({ kind: k, place: s.name, src: s.src, date: d.date });
    }); });
    list.sort(function (a, b) { return (a.src === "manual" ? 0 : 1) - (b.src === "manual" ? 0 : 1) || (NOTABLE.indexOf(a.kind) + 99) % 99 - (NOTABLE.indexOf(b.kind) + 99) % 99; });
    return list.slice(0, max || 2);
  }


  // ---------- fetching + the per-trip cache (browser; store = localStorage, fetchFn = fetch) ----------
  function ckey(t) { return "fs-wx:" + t.id; }
  function readStore(t, store) { try { var j = JSON.parse(store.getItem(ckey(t)) || "null"); return j && j.v === 1 && j.reqs ? j : { v: 1, reqs: {} }; } catch (e) { return { v: 1, reqs: {} }; } }
  function assemble(reqs, saved) {
    var rows = {}, years = {}, typical = {};
    reqs.forEach(function (r) {
      var c = saved.reqs[r.sig]; if (!c || !c.rows) return;
      if (r.group === "typical") Object.keys(c.rows).forEach(function (k) { (years[k] = years[k] || []).push(c.rows[k]); });
      else Object.keys(c.rows).forEach(function (k) { rows[k] = c.rows[k]; });
    });
    Object.keys(years).forEach(function (k) { typical[k] = typicalOf(years[k]); });
    return { rows: rows, typical: typical };
  }
  /** What's already saved for this trip, with no network. */
  function cached(t, today, store) { if (!store || !t || !t.id) return { rows: {}, typical: {} }; return assemble(plan(tripDays(t), today), readStore(t, store)); }
  /** Fetch what's missing or stale (forecasts refresh after a few hours; past and typical days are kept). Never rejects:
      offline or an API failure just leaves whatever was saved. Resolves { rows, typical, fetched, failed }. */
  function load(t, today, opts) {
    opts = opts || {};
    var store = opts.store, fetchFn = opts.fetch, now = opts.now || Date.now(), reqs = plan(tripDays(t), today), saved = store ? readStore(t, store) : { v: 1, reqs: {} };
    var need = reqs.filter(function (r) { var c = saved.reqs[r.sig]; return !c || (r.group === "forecast" && now - c.at > FORECAST_TTL); });
    if (!fetchFn || !need.length || opts.offline) { var a0 = assemble(reqs, saved); a0.fetched = 0; a0.failed = opts.offline && need.length ? need.length : 0; return Promise.resolve(a0); }
    var failed = 0;
    return Promise.all(need.map(function (r) {
      return fetchFn(r.url).then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
        .then(function (j) { saved.reqs[r.sig] = { at: now, rows: parse(j, r) }; }).catch(function () { failed++; });
    })).then(function () {
      var keep = {}; reqs.forEach(function (r) { if (saved.reqs[r.sig]) keep[r.sig] = saved.reqs[r.sig]; }); saved.reqs = keep;
      if (store) try { store.setItem(ckey(t), JSON.stringify(saved)); } catch (e) {}
      var a = assemble(reqs, saved); a.fetched = need.length - failed; a.failed = failed; return a;
    });
  }

  function toC(f) { return (f - 32) * 5 / 9; }
  function fmtT(f, unit) { if (typeof f !== "number") return ""; return Math.round(unit === "C" ? toC(f) : f) + "°"; }

  return { KINDS: KINDS, KIND: KIND, MAX_DAYS: MAX_DAYS, FORECAST_TTL: FORECAST_TTL, TYPICAL_YEARS: TYPICAL_YEARS, codeKind: codeKind, tripDays: tripDays,
           sourceFor: sourceFor, plan: plan, parse: parse, typicalOf: typicalOf, cleanWx: cleanWx, build: build, storyNotes: storyNotes,
           cached: cached, load: load, addDays: addDays, shiftYears: shiftYears, toC: toC, fmtT: fmtT, locKey: locKey };
});
