/* Famstamp "paste a booking": reads a flight or hotel confirmation someone pastes in (the email text, or its
   schema.org JSON-LD) and turns it into a trip to review. Runs on the phone only; the pasted text is never stored or sent.
   Only places, dates and the hotel's name come out. Names, confirmation codes, prices and emails are left behind.
   No browser parts, so it runs in Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_BOOKING_CORE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  // three capital letters that are not airports in booking emails
  var NOT_AIRPORT = /^(USD|EUR|GBP|CAD|AUD|NZD|CHF|JPY|MXN|THE|AND|FOR|YOU|PNR|REF|VAT|TAX|FEE|ETA|ETD|UTC|GMT|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|CET|AM|PM|NON|APP|PDF|FAQ|TBA|TBC|ONE|TWO|SEAT|ROW|DEP|ARR|OUT|RTN|MRS|MR|MS|DR|INF|CHD|ADT|YES)$/;
  var MAX_TEXT = 60000;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function realDay(y, m, d) { if (!(y >= 1950 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return ""; var t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1 ? y + "-" + pad(m) + "-" + pad(d) : ""; }
  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 80); }

  /** Every date in a line, in order: 2026-07-03, 3 Jul 2026, Fri 3 July, Jul 3, 2026, July 3rd. No year = ref's year (or next year if that's well past). */
  function datesIn(line, ref) {
    var out = [], s = String(line || ""), m, re;
    var ry = ref ? +String(ref).slice(0, 4) : new Date().getFullYear();
    function noYear(mo, d) {
      var x = realDay(ry, mo, d); if (x && ref && x < addDays(ref, -60)) x = realDay(ry + 1, mo, d); return x;
    }
    re = /\b(\d{4})-(\d{2})-(\d{2})/g;
    while ((m = re.exec(s))) { var a = realDay(+m[1], +m[2], +m[3]); if (a) out.push({ at: m.index, d: a }); }
    re = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?\s*(\d{4})?\b/g;
    while ((m = re.exec(s))) { var mo = MON[m[2].slice(0, 4).toLowerCase()] || MON[m[2].slice(0, 3).toLowerCase()]; if (!mo || !monthWord(m[2])) continue; var b = m[3] ? realDay(+m[3], mo, +m[1]) : noYear(mo, +m[1]); if (b) out.push({ at: m.index, d: b }); }
    re = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s*(\d{4}))?/g;
    while ((m = re.exec(s))) { var mo2 = MON[m[1].slice(0, 4).toLowerCase()] || MON[m[1].slice(0, 3).toLowerCase()]; if (!mo2 || !monthWord(m[1])) continue; var c = m[3] ? realDay(+m[3], mo2, +m[2]) : noYear(mo2, +m[2]); if (c) out.push({ at: m.index, d: c }); }
    out.sort(function (x, y) { return x.at - y.at; });
    return out.filter(function (x, i) { return !out.slice(0, i).some(function (y) { return Math.abs(y.at - x.at) < 6 && y.d === x.d; }); }).map(function (x) { return x.d; });
  }
  function monthWord(w) { var l = w.toLowerCase(); return /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?)$/.test(l); }
  function addDays(d, n) { var t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + n * 864e5, x = new Date(t); return x.getUTCFullYear() + "-" + pad(x.getUTCMonth() + 1) + "-" + pad(x.getUTCDate()); }
  function nights(a, b) { if (!a || !b) return null; var n = Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5); return n >= 0 && n <= 366 ? n : null; }
  function isoDay(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? realDay(+m[1], +m[2], +m[3]) : ""; }
  function code(v) { var c = String(v || "").trim().toUpperCase(); return /^[A-Z]{3}$/.test(c) && !NOT_AIRPORT.test(c) ? c : ""; }

  // ---------- schema.org JSON-LD (what airlines and hotels put in their emails for Gmail) ----------
  function ldBlocks(text) {
    var out = [], re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, m;
    while ((m = re.exec(text))) out.push(m[1]);
    var t = text.trim(); if (!out.length && /^[\[{]/.test(t)) out.push(t);
    var items = [];
    out.forEach(function (b) { try { var j = JSON.parse(b); (Array.isArray(j) ? j : j && j["@graph"] ? j["@graph"] : [j]).forEach(function (x) { if (x && typeof x === "object") items.push(x); }); } catch (e) { /* not JSON: read it as text */ } });
    return items;
  }
  function typeOf(x) { var t = x && x["@type"]; return String(Array.isArray(t) ? t[0] : t || ""); }
  function fromLd(items, res) {
    items.forEach(function (x) {
      var ty = typeOf(x), f = x.reservationFor || {};
      if (ty === "FlightReservation" || typeOf(f) === "Flight") {
        var dep = code((f.departureAirport || {}).iataCode), arr = code((f.arrivalAirport || {}).iataCode);
        if (dep && arr && dep !== arr) res.flights.push({ dep: dep, arr: arr, date: isoDay(f.departureTime) || isoDay(f.departureDate) });
      } else if (ty === "LodgingReservation" || /Hotel|Lodging/.test(typeOf(f))) {
        var name = clean(f.name, 80), ad = f.address || {}, a = isoDay(x.checkinTime || x.checkinDate), b = isoDay(x.checkoutTime || x.checkoutDate);
        if (name) res.hotels.push({ name: name, city: clean(typeof ad === "string" ? "" : ad.addressLocality, 60), checkIn: a, checkOut: b, nights: nights(a, b) });
      }
    });
  }

  // ---------- plain text ----------
  var HOTEL_WORD = /\b(hotel|inn|resort|lodge|suites|motel|hostel|b&b|guest ?house|apartments?|cottage|cabin|villa|chalet)\b/i;
  function fromText(text, res, ref) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    var seen = {};
    function near(i) { for (var k = 0; k <= 3; k++) { var a = lines[i - k] ? datesIn(lines[i - k], ref) : [], b = k && lines[i + k] ? datesIn(lines[i + k], ref) : []; if (a.length) return a[0]; if (b.length) return b[0]; } return ""; }
    function add(dep, arr, i) {
      dep = code(dep); arr = code(arr); if (!dep || !arr || dep === arr) return;
      var d = near(i), key = dep + arr + d; if (seen[key]) return; seen[key] = 1;
      res.flights.push({ dep: dep, arr: arr, date: d });
    }
    // "EDI → JFK", "EDI - JFK", "EDI to JFK"
    lines.forEach(function (l, i) {
      var re = /\b([A-Z]{3})\b\s*(?:→|->|—|–|-|>|to|✈️?|✈)\s*\b([A-Z]{3})\b/g, m, hit = false;
      while ((m = re.exec(l))) { add(m[1], m[2], i); hit = true; }
      if (hit) return;
      // "Edinburgh (EDI) to New York (JFK)" on one line
      var p = []; l.replace(/\(([A-Z]{3})\)/g, function (_, c) { if (code(c)) p.push(c); return _; });
      for (var j = 0; j + 1 < p.length; j += 2) add(p[j], p[j + 1], i);
    });
    // "Depart: Edinburgh (EDI)" on one line, "Arrive: New York (JFK)" on the next
    var lone = []; lines.forEach(function (l, i) { var m = /\(([A-Z]{3})\)/g.exec(l); if (m && code(m[1]) && (l.match(/\([A-Z]{3}\)/g) || []).length === 1 && !/\b[A-Z]{3}\b\s*(?:→|->|—|–|-|>|to)\s*\b[A-Z]{3}\b/.test(l)) lone.push({ c: m[1], i: i }); });
    for (var k = 0; k + 1 < lone.length; k += 2) if (lone[k + 1].i - lone[k].i <= 4) add(lone[k].c, lone[k + 1].c, lone[k].i); else k--;
    // hotels: check-in / check-out dates and the place's name
    var ci = "", co = "", name = "", city = "";
    lines.forEach(function (l, i) {
      var nx = lines[i + 1] || "";
      if (!ci && /check[- ]?in/i.test(l)) ci = datesIn(l.replace(/^.*?check[- ]?in/i, ""), ref)[0] || datesIn(nx, ref)[0] || "";
      if (!co && /check[- ]?out/i.test(l)) co = datesIn(l.replace(/^.*?check[- ]?out/i, ""), ref)[0] || datesIn(nx, ref)[0] || "";
      var m = /^(?:hotel|property|accommodation|where you're staying|you're staying at|your stay at|staying at)\s*(?:name)?\s*[:\-–]\s*(.+)$/i.exec(l);
      if (!name && m) name = m[1];
      if (!city) { var c = /^(?:city|location)\s*[:\-–]\s*(.+)$/i.exec(l); if (c) city = c[1]; }
    });
    if (!name && (ci || co)) lines.some(function (l) { if (HOTEL_WORD.test(l) && l.length <= 70 && !/check|cancel|policy|confirm|booking|reservation|thank|@|https?:|\d{3,}/i.test(l)) { name = l; return true; } return false; });
    var cm = /^([^,|]+)[,|]\s*([^,|]+)/.exec(name); if (cm && !city) city = cm[2];
    name = clean(name.replace(/[,|].*$/, ""), 80);
    if (name && !res.hotels.some(function (h) { return h.name === name; })) res.hotels.push({ name: name, city: clean(city.replace(/,.*$/, ""), 60), checkIn: ci, checkOut: co, nights: nights(ci, co) });
  }

  /** Read a pasted booking. ref = today ("YYYY-MM-DD"), used when a date has no year. */
  function parse(text, ref) {
    var t = String(text || "").slice(0, MAX_TEXT), res = { flights: [], hotels: [] };
    var ld = ldBlocks(t); if (ld.length) fromLd(ld, res);
    if (!res.flights.length && !res.hotels.length) fromText(t.replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"), res, ref);
    res.flights = res.flights.slice(0, 8); res.hotels = res.hotels.slice(0, 6);
    return res;
  }

  /** Turn what we read into trip-form values. air(code) gives an airport ({code,name,city,country,lat,lon}) or null.
      Unknown airport codes are dropped. Returns null when nothing usable was found. */
  function toTrip(res, air, today) {
    var fl = (res.flights || []).map(function (f) { var a = air(f.dep), b = air(f.arr); return a && b ? { dep: a, arr: b, date: f.date } : null; }).filter(Boolean);
    fl.sort(function (x, y) { return (x.date || "9") < (y.date || "9") ? -1 : (x.date || "9") > (y.date || "9") ? 1 : 0; });
    var hotels = (res.hotels || []).filter(function (h) { return h && h.name; });
    if (!fl.length && !hotels.length) return null;
    var route = [], first = fl[0], last = fl[fl.length - 1], round = false;
    function pt(a) { return { name: a.city || a.name, kind: "place", lat: a.lat, lon: a.lon }; }
    if (fl.length) {
      route.push(pt(first.dep));
      fl.forEach(function (f, i) {
        if (i && route[route.length - 1].name !== (f.dep.city || f.dep.name)) route.push(Object.assign(pt(f.dep), { mode: "car" }));
        var p = Object.assign(pt(f.arr), { mode: "plane", dep: f.dep, arr: f.arr }); route.push(p);
      });
      // back where it started: a round trip, and the last leg home stays a flight
      if (fl.length > 1 && last.arr.code === first.dep.code) { round = true; }
    }
    hotels.forEach(function (h) { if (!fl.length && h.city && !route.some(function (p) { return p.name === h.city; })) route.push({ name: h.city, kind: "place", mode: "car" }); });
    var dates = fl.map(function (f) { return f.date; }).concat(hotels.map(function (h) { return h.checkIn; }), hotels.map(function (h) { return h.checkOut; })).filter(Boolean).sort();
    var start = dates[0] || "", end = dates.length > 1 ? dates[dates.length - 1] : "";
    var dest = fl.length ? (round && fl.length > 1 ? fl[fl.length - 2].arr : last.arr) : null;
    var title = dest ? "Trip to " + (dest.city || dest.name) : hotels[0].city ? "Trip to " + hotels[0].city : "Stay at " + hotels[0].name;
    return {
      route: route, roundTrip: round, date: start, endDate: end, done: !!(end || start) && (end || start) < (today || "9999"), title: clean(title, 80),
      stays: hotels.map(function (h) { var o = { name: h.name, type: /apartment|cottage|cabin|villa|chalet/i.test(h.name) ? "rental" : "hotel" }; if (h.nights != null) o.nights = h.nights; if (h.city) o.where = h.city; return o; }),
      fly: fl.length ? "yes" : ""
    };
  }

  return { parse: parse, toTrip: toTrip, datesIn: datesIn, NOT_AIRPORT: NOT_AIRPORT };
});
