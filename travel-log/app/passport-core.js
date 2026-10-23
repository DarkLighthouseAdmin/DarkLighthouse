/* Famstamp passport: turns map visits, hand-added stamps and trip stops into passport stamps, and draws them as SVG.
   No browser parts, so it runs in Node tests. Stamps from trips are worked out on the fly (never stored), so editing a
   trip moves its stamps; stamps someone adds by hand live on the person as person.stamps (see trips-data-model.md). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trips-core.js"), require("./state-signs.js"));
  else root.WK_PASSPORT = factory(root.WK_TRIPS, root.WK_SIGNS);
})(typeof self !== "undefined" ? self : this, function (T, SG) {
  "use strict";
  var MAX_STAMPS = 60, STAMP_BUDGET = 6000;   // hand-added only (trip stamps are worked out, not stored); keeps a person under sync's 8 KB
  var ISO32 = {}; "ABWAWAFGAFAGOAOAIAAIALBALALDAXANDADAREAEARGARARMAMASMASATAAQATFTFATGAGAUSAUAUTATAZEAZBDIBIBELBEBENBJBESBQBFABFBGDBDBGRBGBHRBHBHSBSBIHBABLMBLBLRBYBLZBZBMUBMBOLBOBRABRBRBBBBRNBNBTNBTBVTBVBWABWCAFCFCANCACCKCCCHECHCHLCLCHNCNCIVCICMRCMCODCDCOGCGCOKCKCOLCOCOMKMCPVCVCRICRCUBCUCUWCWCXRCXCYMKYCYPCYCZECZDEUDEDJIDJDMADMDNKDKDOMDODZADZECUECEGYEGERIERESPESESTEEETHETFINFIFJIFJFLKFKFRAFRFROFOFSMFMGABGAGBRGBGEOGEGGYGGGHAGHGIBGIGINGNGLPGPGMBGMGNBGWGNQGQGRCGRGRDGDGRLGLGTMGTGUFGFGUMGUGUYGYHKGHKHMDHMHNDHNHRVHRHTIHTHUNHUIDNIDIMNIMINDINIOTIOIRLIEIRNIRIRQIQISLISISRILITAITJAMJMJEYJEJORJOJPNJPKAZKZKENKEKGZKGKHMKHKIRKIKNAKNKORKRKOSXKKWTKWLAOLALBNLBLBRLRLBYLYLCALCLIELILKALKLSOLSLTULTLUXLULVALVMACMOMAFMFMARMAMCOMCMDAMDMDGMGMDVMVMEXMXMHLMHMKDMKMLIMLMLTMTMMRMMMNEMEMNGMNMNPMPMOZMZMRTMRMSRMSMTQMQMUSMUMWIMWMYSMYMYTYTNAMNANCLNCNERNENFKNFNGANGNICNINIUNUNLDNLNORNONPLNPNRUNRNZLNZOMNOMPAKPKPANPAPCNPNPERPEPHLPHPLWPWPNGPGPOLPLPRIPRPRKKPPRTPTPRYPYPSXPSPYFPFQATQAREUREROURORUSRURWARWSAHEHSAUSASDNSDSDSSSSENSNSGPSGSGSGSSHNSHSJMSJSLBSBSLESLSLVSVSMRSMSOMSOSPMPMSRBRSSTPSTSURSRSVKSKSVNSISWESESWZSZSXMSXSYCSCSYRSYTCATCTCDTDTGOTGTHATHTJKTJTKLTKTKMTMTLSTLTONTOTTOTTTUNTNTURTRTUVTVTWNTWTZATZUGAUGUKRUAUMIUMURYUYUSAUSUZBUZVATVAVCTVCVENVEVGBVGVIRVIVNMVNVUTVUWLFWFWSMWSYEMYEZAFZAZMBZMZWEZW".replace(/([A-Z]{3})([A-Z]{2})/g, function (_, a, b) { ISO32[a] = b; return ""; });
  var UK = { ENG: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F", SCT: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
             WLS: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F", NIR: "\uD83C\uDDEC\uD83C\uDDE7" };
  var NATIONS = ["ENG", "SCT", "WLS", "NIR"];
  var INKS = ["#2b4c9b", "#b23a48", "#2f7d4f", "#6b3fa0", "#1f2d3d", "#a5531c", "#0f6e7a"];
  var SHAPES = ["circle", "rect", "oval", "triangle", "double"];
  var MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, "").trim().slice(0, max || 80); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /** "2026-07-10", "2026-07", "2026" or "" (not sure). */
  function cleanDate(d) {
    d = String(d || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { var t = new Date(d + "T12:00:00"); return isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d ? "" : d; }
    if (/^\d{4}-\d{2}$/.test(d)) { var m = +d.slice(5); return m >= 1 && m <= 12 && +d.slice(0, 4) >= 1900 ? d : ""; }
    if (/^\d{4}$/.test(d)) return +d >= 1900 && +d <= 2100 ? d : "";
    return "";
  }
  function fmtDate(d) {
    d = cleanDate(d); if (!d) return "";
    if (d.length === 4) return d;
    var m = MON[+d.slice(5, 7) - 1];
    return d.length === 7 ? m + " " + d.slice(0, 4) : (+d.slice(8, 10)) + " " + m + " " + d.slice(0, 4);
  }
  function addDays(d, n) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return ""; var t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function rid() { var r = ""; for (var i = 0; i < 12; i++) r += "0123456789abcdef"[Math.floor(Math.random() * 16)]; return "stamp_" + r; }
  function validKind(k) { return k === "state" || k === "park" ? k : "place"; }

  /** A stamp someone adds by hand (from the map or the passport). */
  function newStamp(o) {
    o = o || {};
    var area = clean(o.area, 40); if (!/^[A-Za-z0-9-]{2,40}$/.test(area)) throw new Error("Pick a place for this stamp.");
    var s = { id: /^stamp_[a-z0-9]{6,20}$/.test(o.id || "") ? o.id : rid(), kind: validKind(o.kind), area: area, date: cleanDate(o.date) };
    var end = cleanDate(o.end); if (end && (!s.date || end >= s.date)) s.end = end;
    if (clean(o.via, 40)) s.via = clean(o.via, 40);
    if (clean(o.note, 140)) s.note = clean(o.note, 140);
    return s;
  }
  function cleanStamps(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (s) {
      if (out.length >= MAX_STAMPS || !s || seen[s.id]) return;
      try { var c = newStamp(s); seen[c.id] = 1; out.push(c); } catch (e) {}
    });
    // a person row syncs as 8 KB max (names, colors and other fields need room too): drop notes, then entry points, if needed
    var size = function () { return JSON.stringify(out).length; };
    for (var i = out.length - 1; i >= 0 && size() > STAMP_BUDGET; i--) delete out[i].note;
    for (i = out.length - 1; i >= 0 && size() > STAMP_BUDGET; i--) delete out[i].via;
    return out;
  }

  /** What one route point counts as: [{kind, area}] (a park in one state also counts the state; UK stops count their nation). */
  function pointAreas(p, parkStates) {
    var out = [];
    if (p.kind === "park" && p.ref) { out.push({ kind: "park", area: p.ref }); var st = parkStates && parkStates[p.ref]; if (st && st.length === 1) out.push({ kind: "state", area: st[0] }); }
    if (p.country === "USA") { if (T.US_STATES.indexOf(p.region) >= 0 && !out.some(function (a) { return a.kind === "state" && a.area === p.region; })) out.push({ kind: "state", area: p.region }); }
    else if (p.country === "GBR") { if (NATIONS.indexOf(p.region) >= 0) out.push({ kind: "place", area: p.region }); }
    else if (p.country) out.push({ kind: "place", area: p.country });
    return out;
  }
  /** Each place a trip went, with the day you got there and left (from the trip date plus nights at each stop), and how you came in. */
  function tripVisits(t, parkStates) {
    var r = t.route || [], start = /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") ? t.date : "";
    var out = {}, order = [], day = start;
    var pts = r.length > 1 ? r.slice(1) : r;
    pts.forEach(function (p, i) {
      var arrive = day, leave = typeof p.nights === "number" && day ? addDays(day, p.nights) : "";
      if (i === pts.length - 1 && !leave && t.endDate) leave = t.endDate;
      var via = p.arr && p.arr.code ? p.arr.code + (p.arr.city ? " " + p.arr.city : "") : p.name;
      pointAreas(p, parkStates).forEach(function (a) {
        var k = a.kind + ":" + a.area;
        if (!out[k]) { out[k] = { kind: a.kind, area: a.area, date: arrive || (t.date ? cleanDate(t.date) : ""), end: leave, via: via }; order.push(k); }
        else if (leave) out[k].end = leave;
      });
      if (leave) day = leave;
    });
    if (!r.length && t.mark && t.mark.id) { var mk = t.mark.kind + ":" + t.mark.id; out[mk] = { kind: t.mark.kind, area: t.mark.id, date: cleanDate(t.date), end: t.endDate || "", via: "" }; order.push(mk); }
    return order.map(function (k) { var v = out[k]; if (v.end && v.date && v.end < v.date) v.end = ""; if (v.end === v.date) v.end = ""; return v; });
  }
  function sameVisit(a, b) { var x = a.date || "", y = b.date || ""; return !!x && !!y && (x.indexOf(y) === 0 || y.indexOf(x) === 0); }
  function section(kind, area, isCountry) {
    if (kind === "park") return "parks";
    if (kind === "state") return "states";
    return "world";
  }
  /** Every stamp in one person's passport, oldest first. Sources: trips they went on, stamps added by hand, and places colored
      on the map with no visit yet (shown with "date not set"). The same visit is never stamped twice. */
  function stampsFor(person, trips, ctx) {
    ctx = ctx || {};
    var out = [], have = {};
    (trips || []).forEach(function (t) {
      if ((t.kidIds || []).indexOf(person.id) < 0) return;
      tripVisits(t, ctx.parkStates).forEach(function (v) {
        out.push({ id: "t-" + t.id + "-" + v.kind + "-" + v.area, kind: v.kind, area: v.area, date: v.date, end: v.end || "", via: v.via || "", tripId: t.id, trip: t.place, source: "trip", who: [person.id] });
        have[v.kind + ":" + v.area] = 1;
      });
    });
    (person.stamps || []).forEach(function (s) {
      if (out.some(function (o) { return o.source === "trip" && o.kind === s.kind && o.area === s.area && sameVisit(o, s); })) return;
      out.push({ id: s.id, kind: s.kind, area: s.area, date: s.date || "", end: s.end || "", via: s.via || "", note: s.note || "", source: "hand", who: [person.id] });
      have[s.kind + ":" + s.area] = 1;
    });
    [["state", person.states], ["place", person.places], ["park", person.parks]].forEach(function (b) {
      Object.keys(b[1] || {}).forEach(function (id) {
        if (have[b[0] + ":" + id]) return;
        if (b[0] === "place" && id === "USA" && Object.keys(person.states || {}).length) return;
        out.push({ id: "m-" + person.id + "-" + b[0] + "-" + id, kind: b[0], area: id, date: "", end: "", via: "", source: "map", who: [person.id] });
      });
    });
    out.forEach(function (s) { s.section = section(s.kind, s.area); s.nation = s.kind === "place" && NATIONS.indexOf(s.area) >= 0; });
    return sortStamps(out);
  }
  function sortStamps(list) { return list.sort(function (a, b) { return ((a.date || "9999") < (b.date || "9999") ? -1 : (a.date || "9999") > (b.date || "9999") ? 1 : a.id < b.id ? -1 : 1); }); }
  /** The family passport: a shared trip is one stamp with everyone on it; the same hand stamp for two people merges too. */
  function familyStamps(people, trips, ctx) {
    var byKey = {}, out = [];
    people.forEach(function (p) {
      stampsFor(p, trips, ctx).forEach(function (s) {
        var key = s.source === "trip" ? s.id : s.kind + ":" + s.area + ":" + (s.date || "?");
        if (byKey[key]) { if (byKey[key].who.indexOf(p.id) < 0) byKey[key].who.push(p.id); return; }
        var c = Object.assign({}, s, { who: [p.id] }); byKey[key] = c; out.push(c);
      });
    });
    return sortStamps(out);
  }

  // ---------- look ----------
  function hash(s) { return T.hash(String(s)); }
  function look(s) {
    var h = hash(s.id), R = T.rng(h);
    var shape = s.kind === "park" ? "park" : SHAPES[h % SHAPES.length];
    return { shape: shape, ink: s.kind === "park" ? ["#5b4a2f", "#2f5d3a", "#6b3a2a"][h % 3] : INKS[(h >>> 3) % INKS.length], rot: Math.round((R() * 2 - 1) * 16), r: R };
  }
  /** Spread stamps over passport pages: 4 per page, each nudged and turned a little (stable for the same stamp). */
  function pages(stamps, perPage) {
    perPage = Math.min(4, perPage || 4); var out = [];
    var cells = [[78, 100], [222, 112], [84, 280], [218, 292]];
    for (var i = 0; i < stamps.length; i += perPage) {
      out.push(stamps.slice(i, i + perPage).map(function (s, j) {
        var L = look(s), R = T.rng(hash(s.id + "pos"));
        // keep the whole stamp on the page (a stamp is about 130 wide on the 300x400 page)
        var x = Math.round(cells[j][0] + (R() * 2 - 1) * 18), y = Math.round(cells[j][1] + (R() * 2 - 1) * 20);
        return { stamp: s, x: Math.max(72, Math.min(228, x)), y: Math.max(92, Math.min(320, y)), rot: L.rot, shape: L.shape, ink: L.ink };
      }));
    }
    return out;
  }
  function flag(kind, area) {
    if (kind === "park") return "\uD83C\uDF32";
    if (kind === "state") return "";
    if (UK[area]) return UK[area];
    var two = ISO32[area]; if (!two) return "";
    return String.fromCodePoint(0x1F1E6 + two.charCodeAt(0) - 65, 0x1F1E6 + two.charCodeAt(1) - 65);
  }
  function fit(name, base, max) { var n = name.length; return n <= max ? base : Math.max(7, Math.round(base * max / n)); }
  /** One stamp as SVG (viewBox 160x160). name = place name; opts.label overrides ARRIVED / ENTRY. */
  function stampSVG(s, name, opts) {
    opts = opts || {};
    var L = look(s), ink = opts.ink || L.ink, uid = "s" + (hash(s.id) % 1e8);
    var NAME = esc(String(name || s.area).toUpperCase()), date = fmtDate(s.date), end = fmtDate(s.end);
    var label = s.kind === "park" ? "NATIONAL PARK" : (hash(s.id) % 2 ? "ARRIVED" : "ENTRY");
    var via = esc(String(s.via || "").toUpperCase().slice(0, 18)), fl = opts.flag === false ? "" : flag(s.kind, s.area);
    var g = '<g fill="none" stroke="' + ink + '" stroke-width="3">', t = '<g fill="' + ink + '" font-family="Courier New, Courier, monospace" font-weight="700" text-anchor="middle">';
    var body = "", txt = "", dTxt = esc(date || "DATE ?");
    if (L.shape === "park") {
      body = '<circle cx="80" cy="80" r="74"/><circle cx="80" cy="80" r="47" stroke-width="1.5"/>';
      txt = '<defs><path id="' + uid + 't" d="M23,80 A57,57 0 0 1 137,80"/><path id="' + uid + 'b" d="M14,80 A66,66 0 0 0 146,80"/></defs>' +
        '<text font-size="' + fit(NAME, 12, 18) + '"><textPath href="#' + uid + 't" startOffset="50%">' + NAME + '</textPath></text>' +
        '<text font-size="9"><textPath href="#' + uid + 'b" startOffset="50%">' + esc(opts.sub || "NATIONAL PARK SERVICE") + '</textPath></text>' +
        '<text x="80" y="84" font-size="' + (date.length > 8 ? 10 : 12) + '">' + dTxt + '</text>' +
        (end ? '<text x="80" y="96" font-size="7">TO ' + esc(end) + '</text>' : "");
    } else if (L.shape === "circle" || L.shape === "double") {
      body = '<circle cx="80" cy="80" r="68"/>' + (L.shape === "double" ? '<circle cx="80" cy="80" r="58" stroke-width="2"/>' : "") + '<line x1="28" y1="64" x2="132" y2="64" stroke-width="1.5"/><line x1="28" y1="102" x2="132" y2="102" stroke-width="1.5"/>';
      txt = '<text x="80" y="52" font-size="' + fit(NAME, 14, 11) + '">' + NAME + '</text><text x="80" y="78" font-size="10">' + label + '</text><text x="80" y="95" font-size="' + (date.length > 8 ? 11 : 13) + '">' + dTxt + '</text>' +
        (end ? '<text x="80" y="116" font-size="8">DEP ' + esc(end) + '</text>' : via ? '<text x="80" y="116" font-size="8">' + via + '</text>' : "");
    } else if (L.shape === "oval") {
      body = '<ellipse cx="80" cy="80" rx="74" ry="52"/><ellipse cx="80" cy="80" rx="66" ry="45" stroke-width="1.5"/>';
      txt = '<text x="80" y="62" font-size="' + fit(NAME, 13, 13) + '">' + NAME + '</text><text x="80" y="80" font-size="9">' + label + (via ? " · " + via : "") + '</text><text x="80" y="98" font-size="' + (date.length > 8 ? 11 : 13) + '">' + dTxt + '</text>' +
        (end ? '<text x="80" y="112" font-size="8">DEP ' + esc(end) + '</text>' : "");
    } else if (L.shape === "triangle") {
      body = '<path d="M80,8 L152,140 L8,140 Z"/><path d="M80,24 L138,132 L22,132 Z" stroke-width="1.5"/>';
      txt = '<text x="80" y="76" font-size="' + fit(NAME, 12, 11) + '">' + NAME + '</text><text x="80" y="94" font-size="8">' + label + '</text><text x="80" y="112" font-size="' + (date.length > 8 ? 10 : 12) + '">' + dTxt + '</text>' +
        (end ? '<text x="80" y="126" font-size="7">DEP ' + esc(end) + '</text>' : via ? '<text x="80" y="126" font-size="7">' + via + '</text>' : "");
    } else {
      body = '<rect x="8" y="30" width="144" height="100" rx="6"/><rect x="15" y="37" width="130" height="86" rx="3" stroke-width="1.5"/>';
      txt = '<text x="80" y="60" font-size="' + fit(NAME, 13, 14) + '">' + NAME + '</text><text x="80" y="78" font-size="9">' + label + (via ? " · " + via : "") + '</text><text x="80" y="98" font-size="' + (date.length > 8 ? 12 : 14) + '">' + dTxt + '</text>' +
        (end ? '<text x="80" y="114" font-size="8">DEP ' + esc(end) + '</text>' : "");
    }
    var flagTxt = fl && L.shape !== "park" ? '<text x="' + (L.shape === "triangle" ? 80 : 80) + '" y="' + (L.shape === "triangle" ? 56 : L.shape === "rect" ? 26 : L.shape === "oval" ? 38 : 36) + '" font-size="14" text-anchor="middle">' + fl + '</text>' : "";
    return '<svg class="stampsvg" viewBox="0 0 160 160" role="img" aria-label="' + esc((name || s.area) + (date ? ", " + date : "")) + '"><g filter="url(#inkrough)" opacity=".9">' + g + body + '</g>' + t + txt + '</g></g>' + flagTxt + '</svg>';
  }

  // ---------- State Signs: a "Welcome to ..." roadside sign for every state someone has been to ----------
  // Our own designs, drawn by state-signs.js from a compact table. Not any real state's sign artwork.
  var STATES50 = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
  function signLook(id) { return SG.look(id); }
  /** Which states someone (or a group) has, with the first dated visit. Same sources as the passport's state stamps:
      trip stops in the US, stamps added by hand, and states colored in on the map. DC is a bonus, not one of the 50. */
  function signsFor(people, trips, ctx) {
    var out = {};
    (people || []).forEach(function (p) {
      stampsFor(p, trips, ctx).forEach(function (s) {
        if (s.kind !== "state") return;
        var o = out[s.area] || (out[s.area] = { id: s.area, first: "", who: [], trips: [], hand: false, visits: 0, list: [] });
        if (s.date && (!o.first || s.date < o.first)) o.first = s.date;
        // one visit per trip, per dated hand stamp, or one for "colored in on the map"; a trip together counts once
        var key = s.tripId ? "t:" + s.tripId : s.source === "hand" ? "h:" + (s.date || s.id) : "m", v = o.list.filter(function (x) { return x.key === key; })[0];
        if (!v) { v = { key: key, date: s.date || "", end: s.end || "", tripId: s.tripId || "", source: s.source, stampId: s.id, who: [] }; o.list.push(v); }
        if (v.who.indexOf(p.id) < 0) v.who.push(p.id);
        if (o.who.indexOf(p.id) < 0) o.who.push(p.id);
        if (s.tripId && o.trips.indexOf(s.tripId) < 0) o.trips.push(s.tripId);
        if (s.source === "hand") o.hand = true;
      });
    });
    Object.keys(out).forEach(function (id) { var o = out[id]; o.list.sort(function (a, b) { return (a.date || "9999") < (b.date || "9999") ? -1 : 1; }); o.visits = o.list.length; });
    return out;
  }
  function signCount(signs) { var n = 0; STATES50.forEach(function (id) { if (signs[id]) n++; }); return { have: n, of: 50, dc: !!signs.DC }; }
  /** The sign card (drawn by state-signs.js). info = the signsFor entry, or null for a mystery sign still to collect. */
  function signSVG(id, name, info) { return SG.signSVG(id, name, info, { fmtDate: fmtDate }); }
  function signTier(info) { return info ? SG.tier(info.visits || 1) : ""; }

  return { newStamp: newStamp, cleanStamps: cleanStamps, cleanDate: cleanDate, fmtDate: fmtDate, addDays: addDays, pointAreas: pointAreas, tripVisits: tripVisits,
           stampsFor: stampsFor, familyStamps: familyStamps, pages: pages, look: look, flag: flag, stampSVG: stampSVG, ISO32: ISO32, NATIONS: NATIONS, MAX_STAMPS: MAX_STAMPS, SHAPES: SHAPES,
           STATES50: STATES50, signsFor: signsFor, signCount: signCount, signSVG: signSVG, signLook: signLook, signTier: signTier, signInfo: SG.look };
});
