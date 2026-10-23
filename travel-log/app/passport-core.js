/* Famstamp passport: turns map visits, hand-added stamps and trip stops into passport stamps, and draws them as SVG.
   No browser parts, so it runs in Node tests. Stamps from trips are worked out on the fly (never stored), so editing a
   trip moves its stamps; stamps someone adds by hand live on the person as person.stamps (see trips-data-model.md). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trips-core.js"));
  else root.WK_PASSPORT = factory(root.WK_TRIPS);
})(typeof self !== "undefined" ? self : this, function (T) {
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
  // Our own simple design (a colored sign on two posts with a little motif). Not any real state's sign artwork.
  var STATES50 = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
  var MOTIF_OF = {};
  (function (m) { Object.keys(m).forEach(function (k) { m[k].split(" ").forEach(function (id) { MOTIF_OF[id] = k; }); }); })({ mountain: "CO MT WY ID UT WV NH VT TN NC", palm: "FL HI", sun: "AZ NM NV CA",
    pine: "ME OR WA MI MN WI AK", wave: "MA RI CT NJ DE MD SC NY", wheat: "KS NE IA ND SD OK IL IN OH MO", star: "TX PA VA DC", leaf: "KY AR LA MS AL GA" });
  var SIGN_THEMES = [["#1f6f4a", "#f4efe1"], ["#1d4f8c", "#fdf6e3"], ["#8a2f3c", "#fff4e4"], ["#c8792a", "#fffaf0"], ["#4a3a7a", "#f6f0ff"], ["#0f6e7a", "#effafa"], ["#3d5a2a", "#f7f3e3"], ["#7a4b1e", "#fff6e8"]];
  var MOTIFS = {
    mountain: '<path d="M0,22 L12,6 L18,13 L24,4 L36,22 Z"/><path d="M21,8 L24,4 L27,8 Z" fill="#fff" opacity=".85"/>',
    palm: '<path d="M17,22 Q19,13 18,7" fill="none" stroke-width="2.2"/><path d="M18,7 Q10,3 4,8 Q11,6 18,8 Q24,2 32,6 Q25,5 18,8 Q14,12 9,15 Q15,10 18,8 Q23,10 27,15 Q22,9 18,8Z"/>',
    sun: '<circle cx="18" cy="14" r="6"/><path d="M18,2v4M18,22v4M6,14h4M26,14h4M9.5,5.5l2.8,2.8M23.7,19.7l2.8,2.8M26.5,5.5l-2.8,2.8M12.3,19.7l-2.8,2.8" fill="none" stroke-width="2"/>',
    pine: '<path d="M10,23 L10,20 L3,20 L8,14 L5,14 L10,7 L8,7 L12,1 L16,7 L14,7 L19,14 L16,14 L21,20 L14,20 L14,23Z"/><path d="M25,23 L25,21 L20,21 L24,16 L22,16 L27,9 L32,16 L30,16 L34,21 L29,21 L29,23Z"/>',
    wave: '<path d="M0,16 Q5,8 10,14 T20,14 T30,14 T36,12 L36,22 L0,22Z"/><path d="M0,10 Q5,4 10,9 T20,9 T30,9" fill="none" stroke-width="1.6"/>',
    wheat: '<path d="M18,24 L18,4" fill="none" stroke-width="1.8"/>' + [6, 11, 16].map(function (y) { return '<ellipse cx="14.5" cy="' + y + '" rx="3.6" ry="1.8" transform="rotate(-35 14.5 ' + y + ')"/><ellipse cx="21.5" cy="' + y + '" rx="3.6" ry="1.8" transform="rotate(35 21.5 ' + y + ')"/>'; }).join("") + '<ellipse cx="18" cy="2.5" rx="1.6" ry="2.6"/>',
    star: '<path d="M18,1 L21.5,9.5 L30.5,10 L23.5,15.8 L26,24.5 L18,19.6 L10,24.5 L12.5,15.8 L5.5,10 L14.5,9.5Z"/>',
    leaf: '<path d="M6,22 Q4,6 28,3 Q30,22 6,22Z"/><path d="M7,21 Q15,13 24,7" fill="none" stroke="#fff" stroke-width="1.3" opacity=".8"/>'
  };
  function signLook(id) { var h = hash("sign:" + id); return { theme: SIGN_THEMES[h % SIGN_THEMES.length], motif: MOTIF_OF[id] || "leaf", shape: ["rect", "arch", "shield"][(h >>> 4) % 3] }; }
  /** Which states someone (or a group) has, with the first dated visit. Same sources as the passport's state stamps:
      trip stops in the US, stamps added by hand, and states colored in on the map. DC is a bonus, not one of the 50. */
  function signsFor(people, trips, ctx) {
    var out = {};
    (people || []).forEach(function (p) {
      stampsFor(p, trips, ctx).forEach(function (s) {
        if (s.kind !== "state") return;
        var o = out[s.area] || (out[s.area] = { id: s.area, first: "", who: [], trips: [], hand: false });
        if (s.date && (!o.first || s.date < o.first)) o.first = s.date;
        if (o.who.indexOf(p.id) < 0) o.who.push(p.id);
        if (s.tripId && o.trips.indexOf(s.tripId) < 0) o.trips.push(s.tripId);
        if (s.source === "hand") o.hand = true;
      });
    });
    return out;
  }
  function signCount(signs) { var n = 0; STATES50.forEach(function (id) { if (signs[id]) n++; }); return { have: n, of: 50, dc: !!signs.DC }; }
  /** The sign card: a 200x150 SVG. info = the signsFor entry, or null for a faded one still to collect. */
  function signSVG(id, name, info) {
    var L = signLook(id), on = !!info, bg = on ? L.theme[0] : "#d9d4c8", fg = on ? L.theme[1] : "#f3f0e8", NAME = esc(String(name || id).toUpperCase());
    var fs = NAME.length > 13 ? 13 : NAME.length > 10 ? 16 : NAME.length > 7 ? 19 : 22;
    var board = L.shape === "arch" ? '<path d="M12,48 Q100,6 188,48 L188,118 Q188,124 182,124 L18,124 Q12,124 12,118Z"/>'
      : L.shape === "shield" ? '<path d="M12,22 L188,22 L188,104 Q188,112 180,114 L100,128 L20,114 Q12,112 12,104Z"/>'
      : '<rect x="12" y="22" width="176" height="102" rx="12"/>';
    var inner = L.shape === "arch" ? '<path d="M20,52 Q100,14 180,52 L180,114 Q180,117 177,117 L23,117 Q20,117 20,114Z" fill="none" stroke="' + fg + '" stroke-width="2"/>'
      : L.shape === "shield" ? '<path d="M19,29 L181,29 L181,102 Q181,107 176,108 L100,121 L24,108 Q19,107 19,102Z" fill="none" stroke="' + fg + '" stroke-width="2"/>'
      : '<rect x="19" y="29" width="162" height="88" rx="8" fill="none" stroke="' + fg + '" stroke-width="2"/>';
    var d = on ? (info.first ? "FIRST VISIT " + fmtDate(info.first) : "DATE? TAP TO ADD") : "NOT YET";
    return '<svg class="signsvg' + (on ? "" : " faded") + '" viewBox="0 0 200 150" role="img" aria-label="' + esc((name || id) + (on ? ", " + (info.first ? "first visit " + fmtDate(info.first) : "visited") : ", not visited yet")) + '">' +
      '<rect x="50" y="118" width="9" height="32" fill="' + (on ? "#6b5a45" : "#cfc9bc") + '"/><rect x="141" y="118" width="9" height="32" fill="' + (on ? "#6b5a45" : "#cfc9bc") + '"/>' +
      '<g fill="' + bg + '">' + board + '</g>' + inner +
      '<text x="100" y="' + (L.shape === "arch" ? 50 : 44) + '" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="700" font-size="9" letter-spacing="2.5" fill="' + fg + '">WELCOME TO</text>' +
      '<g transform="translate(82,' + (L.shape === "arch" ? 54 : 49) + ')" fill="' + fg + '" stroke="' + fg + '" opacity="' + (on ? 1 : .7) + '">' + MOTIFS[L.motif] + '</g>' +
      '<text x="100" y="' + (L.shape === "shield" ? 96 : 98) + '" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="' + fs + '" fill="' + fg + '">' + NAME + '</text>' +
      '<text x="100" y="' + (L.shape === "shield" ? 108 : 112) + '" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="600" font-size="7" letter-spacing="1.2" fill="' + fg + '" opacity=".9">' + esc(d) + '</text></svg>';
  }

  return { newStamp: newStamp, cleanStamps: cleanStamps, cleanDate: cleanDate, fmtDate: fmtDate, addDays: addDays, pointAreas: pointAreas, tripVisits: tripVisits,
           stampsFor: stampsFor, familyStamps: familyStamps, pages: pages, look: look, flag: flag, stampSVG: stampSVG, ISO32: ISO32, NATIONS: NATIONS, MAX_STAMPS: MAX_STAMPS, SHAPES: SHAPES,
           STATES50: STATES50, signsFor: signsFor, signCount: signCount, signSVG: signSVG, signLook: signLook };
});
