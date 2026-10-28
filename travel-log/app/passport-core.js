/* Famstamp passport: turns map visits, hand-added stamps and trip stops into passport stamps, and draws them as SVG.
   No browser parts, so it runs in Node tests. Stamps from trips are worked out on the fly (never stored), so editing a
   trip moves its stamps; stamps someone adds by hand live on the person as person.stamps (see trips-data-model.md). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trips-core.js"), require("./state-signs.js"), require("./stamp-art.js"));
  else root.WK_PASSPORT = factory(root.WK_TRIPS, root.WK_SIGNS, root.WK_STAMPART);
})(typeof self !== "undefined" ? self : this, function (T, SG, SA) {
  "use strict";
  var MAX_STAMPS = 60, STAMP_BUDGET = 6000;   // hand-added only (trip stamps are worked out, not stored); keeps a person under sync's 8 KB
  var ISO32 = {}; "ABWAWAFGAFAGOAOAIAAIALBALALDAXANDADAREAEARGARARMAMASMASATAAQATFTFATGAGAUSAUAUTATAZEAZBDIBIBELBEBENBJBESBQBFABFBGDBDBGRBGBHRBHBHSBSBIHBABLMBLBLRBYBLZBZBMUBMBOLBOBRABRBRBBBBRNBNBTNBTBVTBVBWABWCAFCFCANCACCKCCCHECHCHLCLCHNCNCIVCICMRCMCODCDCOGCGCOKCKCOLCOCOMKMCPVCVCRICRCUBCUCUWCWCXRCXCYMKYCYPCYCZECZDEUDEDJIDJDMADMDNKDKDOMDODZADZECUECEGYEGERIERESPESESTEEETHETFINFIFJIFJFLKFKFRAFRFROFOFSMFMGABGAGBRGBGEOGEGGYGGGHAGHGIBGIGINGNGLPGPGMBGMGNBGWGNQGQGRCGRGRDGDGRLGLGTMGTGUFGFGUMGUGUYGYHKGHKHMDHMHNDHNHRVHRHTIHTHUNHUIDNIDIMNIMINDINIOTIOIRLIEIRNIRIRQIQISLISISRILITAITJAMJMJEYJEJORJOJPNJPKAZKZKENKEKGZKGKHMKHKIRKIKNAKNKORKRKOSXKKWTKWLAOLALBNLBLBRLRLBYLYLCALCLIELILKALKLSOLSLTULTLUXLULVALVMACMOMAFMFMARMAMCOMCMDAMDMDGMGMDVMVMEXMXMHLMHMKDMKMLIMLMLTMTMMRMMMNEMEMNGMNMNPMPMOZMZMRTMRMSRMSMTQMQMUSMUMWIMWMYSMYMYTYTNAMNANCLNCNERNENFKNFNGANGNICNINIUNUNLDNLNORNONPLNPNRUNRNZLNZOMNOMPAKPKPANPAPCNPNPERPEPHLPHPLWPWPNGPGPOLPLPRIPRPRKKPPRTPTPRYPYPSXPSPYFPFQATQAREUREROURORUSRURWARWSAHEHSAUSASDNSDSDSSSSENSNSGPSGSGSGSSHNSHSJMSJSLBSBSLESLSLVSVSMRSMSOMSOSPMPMSRBRSSTPSTSURSRSVKSKSVNSISWESESWZSZSXMSXSYCSCSYRSYTCATCTCDTDTGOTGTHATHTJKTJTKLTKTKMTMTLSTLTONTOTTOTTTUNTNTURTRTUVTVTWNTWTZATZUGAUGUKRUAUMIUMURYUYUSAUSUZBUZVATVAVCTVCVENVEVGBVGVIRVIVNMVNVUTVUWLFWFWSMWSYEMYEZAFZAZMBZMZWEZW".replace(/([A-Z]{3})([A-Z]{2})/g, function (_, a, b) { ISO32[a] = b; return ""; });
  var UK = { ENG: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F", SCT: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
             WLS: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F", NIR: "\uD83C\uDDEC\uD83C\uDDE7" };
  var NATIONS = ["ENG", "SCT", "WLS", "NIR"];
  // stamp shapes and inks come from stamp-art.js (seeded from the place, so the same place always looks the same)
  var SHAPES = SA.SHAPES, INKS = SA.INK_LIST;
  var MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, "").trim().slice(0, max || 80); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /** "2026-07-10", "2026-07", "2026" or "" (not sure). */
  function cleanDate(d) {
    d = String(d || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { var t = new Date(d + "T12:00:00Z"); return isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d ? "" : d; }
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
    // a shared visit: everyone who was there together (person ids), kept on each of their stamps
    if (Array.isArray(o.with)) { var w = o.with.filter(function (x, i, a) { return typeof x === "string" && /^[A-Za-z0-9_-]{2,60}$/.test(x) && a.indexOf(x) === i; }).slice(0, 20); if (w.length > 1) s.with = w; }
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
    var r = T.stops ? T.stops(t.route) : (t.route || []), start = /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") ? t.date : "";
    var out = {}, order = [], day = start;
    var pts = r.length > 1 ? r.slice(1) : r;
    pts.forEach(function (p, i) {
      var arrive = day, leave = typeof p.nights === "number" && day ? addDays(day, p.nights) : "";
      if (i === pts.length - 1 && !leave && t.endDate) leave = t.endDate;
      var via = p.arr && p.arr.code ? p.arr.code + (p.arr.city ? " " + T.airportCity(p.arr.city, p.arr.name, p.arr.code) : "") : p.name;
      var pa = pointAreas(p, parkStates);
      // v79: a sight stop (castle, viewpoint, beach...) is its own stamp too, and still counts for its country / state
      if (p.kind === "sight") pa.push({ kind: "sight", area: sightArea(p), name: p.name, type: p.type || "landmark", town: p.town || "", ref: p.ref || "", fame: p.fame || 0 });
      pa.forEach(function (a) {
        var k = a.kind + ":" + a.area;
        if (!out[k]) { out[k] = { kind: a.kind, area: a.area, date: arrive || (t.date ? cleanDate(t.date) : ""), end: leave, via: via }; if (a.kind === "sight") sightInfo(out[k], a); order.push(k); }
        else if (leave) out[k].end = leave;
      });
      if (leave) day = leave;
    });
    if (!r.length && t.mark && t.mark.id) { var mk = t.mark.kind + ":" + t.mark.id; out[mk] = { kind: t.mark.kind, area: t.mark.id, date: cleanDate(t.date), end: t.endDate || "", via: "" }; order.push(mk); }
    return order.map(function (k) { var v = out[k]; if (v.end && v.date && v.end < v.date) v.end = ""; if (v.end === v.date) v.end = ""; return v; });
  }
  /** A sight's stamp id: its Wikidata id when known (Q1234), else type + name + country ("castle-edinburgh-castle-GBR"). */
  function sightArea(p) {
    if (/^Q\d{1,12}$/.test(p.ref || "")) return p.ref;
    var f = String(p.name || "").toLowerCase().normalize ? String(p.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : String(p.name || "").toLowerCase();
    return ((p.type || "landmark") + "-" + f.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) + (p.country ? "-" + p.country : "")).slice(0, 40);
  }
  function sightInfo(o, a) { o.name = a.name; o.type = a.type; if (a.town) o.town = a.town; if (a.ref) o.ref = a.ref; if (a.fame) o.fame = a.fame; return o; }
  function sameVisit(a, b) { var x = a.date || "", y = b.date || ""; return !!x && !!y && (x.indexOf(y) === 0 || y.indexOf(x) === 0); }
  function section(kind, area, isCountry) {
    if (kind === "park") return "parks";
    if (kind === "state") return "states";
    if (kind === "sight") return "sights";
    return "world";
  }
  /** Every stamp in one person's passport, oldest first. Sources: trips they went on, stamps added by hand, and places colored
      on the map with no visit yet (shown with no date). The same visit is never stamped twice. */
  function drinkHidden(person, type, ctx) {
    var ty = SA.typeOf ? SA.typeOf(type) : null;
    return !!(ty && ty.group === "drinks" && !(person && (person.role === "adult" || person.role === "grand")) && !(ctx && ctx.adultInKid));
  }
  function stampsFor(person, trips, ctx) {
    ctx = ctx || {};
    var out = [], have = {};
    (trips || []).forEach(function (t) {
      if ((t.kidIds || []).indexOf(person.id) < 0) return;
      tripVisits(t, ctx.parkStates).forEach(function (v) {
        var st = { id: "t-" + t.id + "-" + v.kind + "-" + v.area, kind: v.kind, area: v.area, date: v.date, end: v.end || "", via: v.via || "", tripId: t.id, trip: t.place, source: "trip", who: [person.id] };
        if (v.kind === "sight") {
          sightInfo(st, v);
          // v81: distillery / brewery / winery / pub stamps are for grown-ups; a kid's passport skips them unless the family turned on "show grown-up bits on kids' pages"
          if (drinkHidden(person, v.type, ctx)) return;
        }
        out.push(st);
        have[v.kind + ":" + v.area] = 1;
      });
    });
    (person.stamps || []).forEach(function (s) {
      if (out.some(function (o) { return o.source === "trip" && o.kind === s.kind && o.area === s.area && sameVisit(o, s); })) return;
      out.push({ id: s.id, kind: s.kind, area: s.area, date: s.date || "", end: s.end || "", via: s.via || "", note: s.note || "", source: "hand", who: [person.id], with: Array.isArray(s.with) ? s.with.slice() : [] });
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
        var key = s.source === "trip" ? s.id : s.kind + ":" + s.area + ":" + (s.date || "");
        if (byKey[key]) { if (byKey[key].who.indexOf(p.id) < 0) byKey[key].who.push(p.id); return; }
        var c = Object.assign({}, s, { who: [p.id] }); byKey[key] = c; out.push(c);
      });
    });
    return sortStamps(out);
  }

  // ---------- look ----------
  function hash(s) { return T.hash(String(s)); }
  /** How a stamp looks: shape, ink and motif come from the place (stamp-art.js); the tilt comes from the stamp itself. */
  function look(s, name, art) {
    var h = hash(s.id), R = T.rng(h), d = SA.design(s.kind, s.area, name, art, s);
    return { shape: d.shape, ink: d.ink, motif: d.motif, border: d.border, rot: Math.round((R() * 2 - 1) * 16), r: R };
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
  /** One stamp as SVG (viewBox 160x160), drawn by stamp-art.js. name = place name; opts.sub = park line under the name,
      opts.art = bird | flower | animal | mix for state stamps, opts.flag = false to leave the flag off.
      No date means no date line at all (never a placeholder). */
  /** The line under a sight's name: "CASTLE · EDINBURGH" (type and town). */
  function sightSub(s) { var ty = SA.typeOf ? SA.typeOf(s.type) : { label: "" }; return ty.label + (s.town && s.town !== s.name ? " · " + s.town : ""); }
  function stampSVG(s, name, opts) {
    opts = opts || {};
    if (s.kind === "sight") { if (s.name) name = s.name; if (!opts.sub) opts = Object.assign({}, opts, { sub: sightSub(s) }); }
    // v65: a kid's own drawn stamp for this place (kidart.js), when the stamp is one person's
    var KA = typeof self !== "undefined" && self.FS_KIDART;
    if (KA && KA.svgFor && opts.kid !== false && (opts.holder || s.holder || (s.who && s.who.length === 1))) {
      var own = KA.svgFor(opts.holder ? Object.assign({}, s, { holder: opts.holder }) : s, name || s.area, fmtDate(s.date)); if (own) return own;
    }
    return SA.stampSVG(s, { name: name || s.area, date: fmtDate(s.date), end: fmtDate(s.end), sub: opts.sub || "" },
      { art: opts.art, flag: opts.flag === false || s.kind === "park" ? "" : flag(s.kind, s.area) });
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

  // v82: the passport's "about me" page. A pretend passport: favorites and an optional birthday (month + day, NEVER the year).
  // It never asks for or keeps real passport / ID details: anything that looks like an ID or document number is dropped.
  var ID_FIELDS = [["snack", "Favorite snack", "e.g. Pretzels"], ["food", "Favorite food on a trip", "e.g. Pancakes"], ["animal", "Favorite animal", "e.g. Puffins"],
                   ["dream", "Dream trip", "e.g. Japan"], ["pack", "Never travels without", "e.g. Blue bunny"], ["best", "Best trip so far", "e.g. The beach in July"]];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function cleanBday(v) {
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(String(v == null ? "" : v).trim()); if (!m) return "";
    var mo = +m[1], d = +m[2]; if (mo < 1 || mo > 12 || d < 1 || d > DIM[mo - 1]) return "";
    return (mo < 10 ? "0" : "") + mo + "-" + (d < 10 ? "0" : "") + d;
  }
  function looksLikeId(t) { var digits = String(t).replace(/[^0-9]/g, "").length; return digits >= 6 || /\b(passport|ssn|social security|licen[cs]e)\s*(no|number|#)/i.test(t); }
  function cleanIdPage(o) {
    var out = {}; if (!o || typeof o !== "object") return out;
    ID_FIELDS.forEach(function (f) { var v = typeof o[f[0]] === "string" ? o[f[0]].replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) : ""; if (v && !looksLikeId(v)) out[f[0]] = v; });
    var b = cleanBday(o.bday); if (b) out.bday = b;
    return out;
  }
  function bdayText(b) { b = cleanBday(b); return b ? MONTHS[+b.slice(0, 2) - 1] + " " + (+b.slice(3)) : ""; }
  function isBirthday(b, now) { b = cleanBday(b); if (!b) return false; now = now || new Date(); var mo = now.getMonth() + 1, d = now.getDate();
    if (b === "02-29" && mo === 2 && d === 28 && new Date(now.getFullYear(), 1, 29).getMonth() !== 1) return true;   // Feb 29 birthdays get Feb 28 in other years
    return +b.slice(0, 2) === mo && +b.slice(3) === d; }

  return { newStamp: newStamp, cleanStamps: cleanStamps, cleanDate: cleanDate, fmtDate: fmtDate, addDays: addDays, pointAreas: pointAreas, tripVisits: tripVisits, sightArea: sightArea, sightSub: sightSub, drinkHidden: drinkHidden, section: section,
           stampsFor: stampsFor, familyStamps: familyStamps, pages: pages, look: look, flag: flag, stampSVG: stampSVG, ISO32: ISO32, NATIONS: NATIONS, MAX_STAMPS: MAX_STAMPS, SHAPES: SHAPES,
           STATES50: STATES50, signsFor: signsFor, signCount: signCount, signSVG: signSVG, signLook: signLook, signTier: signTier, signInfo: SG.look, ID_FIELDS: ID_FIELDS, MONTHS: MONTHS, cleanBday: cleanBday, cleanIdPage: cleanIdPage, bdayText: bdayText, isBirthday: isBirthday,
           stampArtMode: function (id, art) { return SA.stateMode(id, art); }, stampDesign: SA.design, STATE_SYMBOLS: SA.SYM ? SA.SYM.DATA : null };
});
