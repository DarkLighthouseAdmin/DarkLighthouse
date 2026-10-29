/* v68: search (#/search), "What's new" after updates, optional stamp sound, a rate-limited "enjoying it?" prompt after happy
   moments, storage used, units and reminder-time settings. Settings live in this phone's localStorage. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_EXTRAS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NOTES = [
    { v: "v75", items: ["Small phones: the top bar no longer slides sideways on inner pages.", "Grandparent view: “Report a problem” works, and “Family and sign-in” is back in More."] },
    { v: "v74", items: ["⚡ Opens much faster the first time, especially on slow connections.", "Typing “What we learned” in the field-trip log no longer loses words when you change the hours."] },
    { v: "v73", items: ["💌 Invite a family: when they start their own log, you both get 1 free month of Premium once paid plans start.", "🔒 Before a kid joins on their own device, a parent now sees what they can add and confirms it's OK."] },
    { v: "v72", items: ["🗺️ The family map tells you what to do first when nobody's on it yet."] },
    { v: "v71", items: ["🧩 Two phones writing different kids' journal pages or game boards on the same trip now both keep them.", "📝 A trip you started adding is saved as you type. Home asks \"Finish your trip?\"", "📷 Photos that didn't upload show up on Home with Try again, and a warning if sync is stuck.", "🔁 Adding a trip that's already here? You can add to that trip instead.", "💾 Restoring a backup shows exactly what comes back first, and the app keeps a weekly copy on this phone."] },
    { v: "v70", items: ["🧭 A simpler way around: Home, Map, ＋ Stamp, Trips and More at the bottom, and one Back arrow at the top left.", "👵 Grandparents get a simple view with big text: Highlights, Weekly recap, Reactions & news.", "🧒 Kid mode puts Map, Stamp and Games in big buttons (More → Account).", "🛠️ Report a problem (More → Account) emails us the details you choose."] },
    { v: "v69", items: ["🎒 Homeschool field-trip log: subjects, hours and what you learned, printable as a PDF (menu, or a kid's page).", "⏳ Time capsules: notes for a kid that open on a date you pick.", "💌 Invite another family."] },
    { v: "v68", items: ["🔎 Search every trip, stamp and journal page (Search at the top right).", "↩️ Deleted something by mistake? Tap Undo on the bar that pops up.", "⚙️ Miles or kilometers, reminder time and quiet hours in Help & settings.", "🔈 Stamp sounds are now off unless you switch them on."] },
    { v: "v67", items: ["💬 Help & feedback, text size and Export everything (.zip).", "🗑️ Family organizers can delete their account and data in the app."] }
  ];
  // ---------- pure helpers ----------
  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); }
  /** Every piece of text in a trip a person typed or picked (title, places, memories, journal pages), not ids or dates. */
  function tripText(t) {
    var out = [];
    (function walk(v, key, depth) {
      if (v == null || depth > 4) return;
      if (typeof v === "string") { if (!/(^id$|Id$|Ids$|At$|^date$|^endDate$|^day$|^kid$|^photo|^dataUrl$|^mark$|^kind$)/.test(key || "") && !/^data:/.test(v) && v.length < 4000) out.push(v); return; }
      if (Array.isArray(v)) { v.forEach(function (x) { walk(x, key, depth + 1); }); return; }
      if (typeof v === "object") Object.keys(v).forEach(function (k) { if (!/^(photos?|art|drawing|story)$/.test(k) || k === "story") walk(v[k], k, depth + 1); });
    })(t, "", 0);
    return out.join(" \u2022 ");
  }
  function snippet(text, q, n) {
    var i = norm(text).indexOf(q); n = n || 90; if (i < 0) return text.slice(0, n);
    var a = Math.max(0, i - 30), s = text.slice(a, a + n); return (a ? "…" : "") + s + (a + n < text.length ? "…" : "");
  }
  /** Search people, trips (incl. journal pages) and stamps. names = { state(id), place(id), park(id) } -> display name. */
  function search(q, kids, trips, names) {
    q = norm(q); var res = { people: [], trips: [], stamps: [] }; if (q.length < 2) return res;
    var words = q.split(" ");
    var hit = function (s) { var n = norm(s); return words.every(function (w) { return n.indexOf(w) >= 0; }); };
    (kids || []).forEach(function (k) { if (hit(k.name)) res.people.push({ id: k.id, name: k.name }); });
    (trips || []).forEach(function (t) {
      var txt = tripText(t); if (!hit(txt + " " + (t.date || ""))) return;
      res.trips.push({ id: t.id, kid: (t.kidIds || [])[0] || "", title: t.title || t.place || "Trip", date: t.date || "", snip: snippet(txt, words[0]) });
    });
    res.trips.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var seen = {};
    (kids || []).forEach(function (k) {
      [["state", k.states], ["place", k.places], ["park", k.parks]].forEach(function (g) {
        Object.keys(g[1] || {}).forEach(function (id) {
          var nm = (names && names[g[0]] ? names[g[0]](id) : id) || id;
          if (!hit(nm + " " + id)) return;
          var key = g[0] + ":" + id; if (!seen[key]) { seen[key] = { kind: g[0], id: id, name: nm, who: [] }; res.stamps.push(seen[key]); }
          seen[key].who.push({ id: k.id, name: k.name });
        });
      });
    });
    res.stamps.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return res;
  }
  /** Should we ask "enjoying it?" now? Rules: 7+ days after first use, 90 days between asks, at most 3 asks, never after "rated" or "no". */
  function shouldAsk(st, now) {
    st = st || {}; now = now || Date.now();
    if (st.done || (st.asks || 0) >= 3 || !st.first) return false;
    if (now - st.first < 7 * 864e5) return false;
    if (st.last && now - st.last < 90 * 864e5) return false;
    return true;
  }
  function notesSince(seen) {   // notes newer than the version this phone last saw
    var n = function (v) { return parseInt(String(v || "").replace(/\D/g, ""), 10) || 0; };
    return NOTES.filter(function (x) { return n(x.v) > n(seen); });
  }
  function fmtBytes(b) { return b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB"; }

  // ---------- v110: where a search result goes ----------
  // Every place result opens its own page (#/place/<kind>/<id>): a state, country / UK nation, province, park, or a point
  // (town, sight, airport) carried in the link. People open their page; trips open the trip.
  var NATIONS = ["ENG", "SCT", "WLS", "NIR"];
  function placeHref(r) {
    if (!r) return "#/search";
    if (r.kind === "area") { var a = String(r.area || "").split(":"); return "#/place/" + (a[0] === "state" ? "state" : "place") + "/" + encodeURIComponent(a[1] || ""); }
    if (r.kind === "region" && r.area) return "#/place/region/" + encodeURIComponent(r.area);
    if (r.kind === "park" && r.ref) return "#/place/park/" + encodeURIComponent(r.ref);
    if (r.kind === "place" && r.country) {
      if (r.country === "USA" && r.region) return "#/place/state/" + encodeURIComponent(r.region);
      if (r.country === "GBR" && NATIONS.indexOf(r.region) >= 0) return "#/place/place/" + r.region;
      return "#/place/place/" + encodeURIComponent(r.country);
    }
    var o = { n: r.name, k: r.kind === "sight" ? "sight" : "city" };
    [["t", "type"], ["c", "country"], ["r", "region"], ["la", "lat"], ["lo", "lon"], ["s", "sub"], ["w", "ref"], ["f", "fame"], ["tw", "town"], ["a", "area"]].forEach(function (x) { if (r[x[1]] != null && r[x[1]] !== "") o[x[0]] = r[x[1]]; });
    return "#/place/pt/" + encodeURIComponent(JSON.stringify(o));
  }
  function readPt(enc) {
    try { var o = JSON.parse(decodeURIComponent(enc || "")); if (!o || typeof o.n !== "string") return null;
      var p = { name: o.n.slice(0, 120), kind: o.k === "sight" ? "sight" : "city" };
      [["t", "type"], ["c", "country"], ["r", "region"], ["s", "sub"], ["w", "ref"], ["tw", "town"], ["a", "area"]].forEach(function (x) { if (typeof o[x[0]] === "string") p[x[1]] = o[x[0]].slice(0, 160); });
      if (typeof o.la === "number" && typeof o.lo === "number") { p.lat = o.la; p.lon = o.lo; }
      if (typeof o.f === "number") p.fame = o.f;
      return p;
    } catch (e) { return null; }
  }
  /** One row per visit: stamps from the same trip (or the same hand-stamped day) are one visit with everyone who was there. */
  function groupVisits(rows) {
    var by = {}, out = [];
    (rows || []).forEach(function (x) {
      var s = x.stamp; if (!s || s.source === "map") return;
      var key = s.tripId ? "t:" + s.tripId : "h:" + (s.date || "") + ":" + (s.id || "");
      if (!s.tripId && s.date) key = "h:" + s.date;
      var g = by[key]; if (!g) { g = by[key] = { date: s.date || "", end: s.end || "", tripId: s.tripId || "", trip: s.trip || "", source: s.source, who: [] }; out.push(g); }
      if (g.who.indexOf(x.person) < 0) g.who.push(x.person);
    });
    return out.sort(function (a, b) { return !a.date ? 1 : !b.date ? -1 : a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  if (typeof document === "undefined") return { placeHref: placeHref, readPt: readPt, groupVisits: groupVisits, search: search, tripText: tripText, norm: norm, shouldAsk: shouldAsk, notesSince: notesSince, fmtBytes: fmtBytes, NOTES: NOTES };

  // ---------- browser ----------
  function ls(k, v) { try { if (arguments.length > 1) { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } return localStorage.getItem(k); } catch (e) { return null; } }
  function lj(k, v) { if (arguments.length > 1) return ls(k, JSON.stringify(v)); try { return JSON.parse(ls(k) || "null"); } catch (e) { return null; } }
  function A() { return window.MLTL_APP; }
  function B() { return window.FS_BRAND || { NAME: "Famstamp", CONTACT: {}, PAGES: {} }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function soundOn() { return ls("fs-sound") === "on"; }
  function track(k) { if (window.FS_LAUNCH && window.FS_LAUNCH.track) window.FS_LAUNCH.track(k); }

  // first-use date for the rating prompt
  var rate = lj("fs-rate") || {}; if (!rate.first) { rate.first = Date.now(); lj("fs-rate", rate); }

  // ---------- search ----------
  function names() { var a = A(); return { state: function (id) { return a.placeName("state", id); }, place: function (id) { return a.placeName("place", id); }, park: function (id) { return a.placeName("park", id); } }; }
  var lastQ = "";
  var searchSeq = 0;
  /** v112: the Parks-tab stamps (cities, food spots, pubs, travel hubs; airports, stations and food-list stamps a person has) that match a search. */
  function kidLock() { try { return !!(window.FS_KIDLOCK && window.FS_KIDLOCK.on()); } catch (e) { return false; } }
  var SPOT_IC = { cities: "🏙️", food: "🍽️", pubs: "🍺", hubs: "🚉" };
  function spotMatches(q, max) {
    var S = window.FS_SPOTS, a = A(); if (!S || !S.LIST) return [];
    var words = norm(q).split(" ").filter(Boolean), adultOk = !kidLock(), seen = {}, out = [];
    var hit = function (it) {
      if (!it || seen[it.id] || (S.CATS[it.cat] && S.CATS[it.cat].adult && !adultOk)) return;
      var n = norm([it.name, it.sub, it.extra, it.extra === "airport" ? it.id.slice(6) : ""].join(" ")); if (!words.every(function (w) { return n.indexOf(w) >= 0; })) return;
      seen[it.id] = 1; out.push(it);
    };
    a.state.kids.forEach(function (k) {   // the family's own first: airports, stations and food-list stamps aren't in the curated lists
      Object.keys(k.spots && typeof k.spots === "object" ? k.spots : {}).forEach(function (id) { hit(S.itemFor(id, [k])); });
      (Array.isArray(k.eats) ? k.eats : []).forEach(function (e) { if (e && e.stamp) hit(S.entryItem(e)); });
    });
    ["cities", "hubs", "food", "pubs"].forEach(function (c) { (S.LIST[c] || []).forEach(hit); });
    return out.slice(0, max || 6);
  }
  function spotHref(it) { return "#/place/spot/" + encodeURIComponent(it.id); }
  function spotSub(it) { var S = window.FS_SPOTS, c = S && S.CATS[it.cat]; return [c ? c.one.charAt(0).toUpperCase() + c.one.slice(1) : "", it.sub].filter(Boolean).join(" · "); }
  function tripStamps(q, r) {
    var U = window.FS_UI, a = A(); if (!U || !U.stampsOf) return;
    var words = norm(q).split(" "), seen = {};
    r.stamps.forEach(function (s) { seen[s.kind + ":" + s.id] = s; });
    a.state.kids.forEach(function (k) {
      U.stampsOf(k).forEach(function (s) {
        if (s.source === "map") return;
        var nm = U.stampName(s), key = s.kind + ":" + s.area; if (!nm) return;
        var n = norm(nm + " " + s.area); if (!words.every(function (w) { return n.indexOf(w) >= 0; })) return;
        var g = seen[key]; if (!g) { g = seen[key] = { kind: s.kind, id: s.area, name: nm, who: [], href: s.kind === "sight" ? placeHref({ kind: "sight", name: nm, type: s.type, ref: s.ref, town: s.town, area: s.area }) : "" }; r.stamps.push(g); }
        if (!g.who.some(function (w) { return w.id === k.id; })) g.who.push({ id: k.id, name: k.name });
      });
    });
    var S = window.FS_SPOTS;
    if (S) spotMatches(q, 40).forEach(function (it) {
      var who = a.state.kids.filter(function (k) { return (k.spots && k.spots[it.id]) || (Array.isArray(k.eats) && k.eats.some(function (e) { return e && e.id === it.id && e.stamp; })); });
      if (!who.length || seen["spot:" + it.id]) return;
      seen["spot:" + it.id] = 1; r.stamps.push({ kind: "spot", id: it.id, name: it.name, who: who.map(function (k) { return { id: k.id, name: k.name }; }), href: spotHref(it) });
    });
    r.stamps.sort(function (x, y) { return x.name < y.name ? -1 : 1; });
  }
  // v110: places from the place search (states, countries, provinces, parks, towns, sights, airports), each to its own page
  function placesFor(q, seq) {
    var U = window.FS_UI, P = window.WK_PASSPORT; if (!U || !U.findPlaces) return;
    U.findPlaces(q).then(function (list) {
      if (seq !== searchSeq) return;
      var box = document.getElementById("splaces"); if (!box) return;
      var nq = norm(q), regs = [];
      if (P && P.REGIONS && nq.length >= 3) Object.keys(P.REGIONS).forEach(function (c) { var R = P.REGIONS[c]; Object.keys(R.names).forEach(function (a) { if (regs.length < 3 && norm(R.names[a]).indexOf(nq) === 0) regs.push({ kind: "region", area: c + "." + a, name: R.names[a], sub: R.label.charAt(0) + R.label.slice(1).toLowerCase() + " · " + R.country }); }); });
      // the USA is stamped state by state, so the country search list leaves it out; it still gets its own page
      if (/^(us|usa|u s a|united states( of america)?|america)$/.test(nq) || (nq.length >= 4 && "united states of america".indexOf(nq) === 0)) regs.unshift({ kind: "area", area: "place:USA", name: "United States", sub: "Country · stamped state by state" });
      var spots = spotMatches(q, 6).map(function (it) { return { kind: "spot", spot: it, name: it.name, sub: spotSub(it) }; });
      var byName = function (x) { var n = norm(x.name); return nq.split(" ").every(function (w) { return n.indexOf(w) >= 0; }); };
      var all = regs.concat(spots.filter(byName), list || [], spots.filter(function (x) { return !byName(x); }));   // a Parks-tab stamp found only by its town goes last if (!all.length) { if (box.previousElementSibling && box.previousElementSibling.classList.contains("nolog")) box.innerHTML = '<p class="muted small">No places called that either. Try fewer letters.</p>'; return; }
      var ic = function (r) { if (r.kind === "spot") return r.spot.extra === "airport" ? "✈️" : SPOT_IC[r.spot.cat] || "📍"; return r.kind === "area" ? (/^state:/.test(r.area) ? "🇺🇸" : "🌍") : r.kind === "region" ? "🗺️" : r.kind === "park" ? "🏞️" : r.kind === "sight" ? (r.type === "airport" ? "✈️" : "📍") : /·/.test(r.sub || "") && /^[A-Z]{3} · /.test(r.sub || "") ? "✈️" : "🏘️"; };
      box.innerHTML = '<h2>Places</h2><ul class="sresl splaces">' + all.slice(0, 18).map(function (r) {
        return '<li><a href="' + esc(r.kind === "spot" ? spotHref(r.spot) : placeHref(r)) + '" data-pkind="' + esc(r.kind) + '"><span aria-hidden="true">' + ic(r) + '</span> <b>' + esc(r.name) + '</b>' + (r.sub ? ' <span class="muted small">' + esc(r.sub) + '</span>' : "") + '</a></li>'; }).join("") + '</ul>';
    }).catch(function () {});
  }
  function searchView() {
    var a = A();
    a.main.innerHTML = '<a class="back" href="#/">← Home</a><h1>🔎 Search</h1>' +
      '<div class="field"><label for="sq" class="sr">Search trips, stamps, journal pages and people</label><input id="sq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search trips, stamps, journals…" value="' + esc(lastQ) + '"></div>' +
      '<div id="sres" aria-live="polite"></div>';
    var inp = document.getElementById("sq"), out = document.getElementById("sres"), t;
    var draw = function () {
      lastQ = inp.value; var q = inp.value.trim();
      if (q.length < 2) { out.innerHTML = a.state.trips.length || a.state.kids.length ? '<p class="muted small">Type a place, a trip name, or something someone wrote in a journal, e.g. "pancakes" or "Utah".</p>' : '<div class="empty panel"><p>Nothing to search yet.</p><p class="small muted">Add a person and a trip, and everything you write shows up here.</p><a class="btn btn-primary" href="#/">Get started</a></div>'; return; }
      var r = search(q, a.state.kids, a.state.trips, names());
      tripStamps(q, r);   // v110: stamps that come from trips (states, countries, provinces, parks, sights) are found too
      var n = r.people.length + r.trips.length + r.stamps.length;
      var seq = ++searchSeq;
      if (!n) out.innerHTML = '<p class="muted small nolog">Nothing in your log matches “' + esc(q) + '” yet.</p><div id="splaces"></div>';
      else out.innerHTML = '<p class="small muted">' + n + (n === 1 ? " match" : " matches") + ' in your log</p>' +
        (r.people.length ? '<h2>People</h2><ul class="sresl">' + r.people.map(function (p) { return '<li><a href="#/p/' + esc(p.id) + '">' + esc(p.name) + '</a></li>'; }).join("") + '</ul>' : "") +
        (r.trips.length ? '<h2>Trips and journals</h2><ul class="sresl">' + r.trips.slice(0, 60).map(function (x) { return '<li><a href="#/p/' + esc(x.kid) + '/trip/' + esc(x.id) + '"><b>' + esc(x.title) + '</b> <span class="muted small">' + esc(x.date) + '</span><br><span class="small">' + esc(x.snip) + '</span></a></li>'; }).join("") + '</ul>' : "") +
        (r.stamps.length ? '<h2>Stamps</h2><ul class="sresl">' + r.stamps.slice(0, 60).map(function (s) { return '<li><a href="' + esc(s.href || "#/place/" + s.kind + "/" + encodeURIComponent(s.id)) + '">' + esc(s.name) + '</a> <span class="muted small">' + esc(s.who.map(function (w) { return w.name; }).join(", ")) + '</span></li>'; }).join("") + '</ul>' : "") + '<div id="splaces"></div>';
      placesFor(q, seq);
    };
    inp.oninput = function () { clearTimeout(t); t = setTimeout(draw, 120); };
    draw(); setTimeout(function () { inp.focus(); }, 50);
    track("search:open");
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "search") return false; searchView(); return true; });
  // ---------- v110: one place's own page ----------
  function placeInfo(kind, id, pt) {
    var a = A(), P = window.WK_PASSPORT, M = window.MLTL, MAPS = window.MLTL_MAPS;
    if (kind === "state") { if (!MAPS.us.shapes.some(function (x) { return x.id === id; })) return null; return { stampKind: "state", area: id, name: a.placeName("state", id), sub: "US state", stop: { kind: "place", country: "USA", region: id }, canStamp: true }; }
    if (kind === "place") {
      var nat = NATIONS.indexOf(id) >= 0; if (!nat && !MAPS.world.countries.some(function (x) { return x.id === id; })) return null;
      return { stampKind: "place", area: id, name: a.placeName("place", id), sub: nat ? "UK nation" : "Country", stop: nat ? { kind: "place", country: "GBR", region: id } : { kind: "place", country: id }, canStamp: !(id === "USA"), parent: nat ? "#/place/place/GBR" : "" };
    }
    if (kind === "region") { var ri = P.regionInfo(id); if (!ri || P.regionName(id) === id) return null; return { stampKind: "region", area: id, name: P.regionName(id), sub: ri.countryName, parent: "#/place/place/" + ri.country, stop: { kind: "place", country: ri.country, region: id.split(".")[1] } }; }
    if (kind === "park") { var pk = M.parkById(id); if (!pk) return null; return { stampKind: "park", area: id, name: pk.full, sub: pk.states, park: pk, canStamp: true }; }
    if (kind === "spot") {   // v112: a Parks-tab stamp (city, food spot, pub, travel hub, airport, station, food-list stamp)
      var S = window.FS_SPOTS, it = S && S.itemFor(id, a.state.kids); if (!it) return null;
      var cat = S.CATS[it.cat] || {}; if (cat.adult && kidLock()) return null;
      var loc = typeof it.lat === "number" && typeof it.lon === "number";
      var entry = null; a.state.kids.some(function (k) { entry = (Array.isArray(k.eats) ? k.eats : []).filter(function (e) { return e && e.id === id; })[0] || null; return !!entry; });
      return { spot: it, entry: entry, adult: !!cat.adult, name: it.name, sub: spotSub(it), canStamp: true, stop: loc ? { name: it.name, kind: "city", lat: it.lat, lon: it.lon } : { name: it.name, kind: "city" },
        pt: loc ? { name: it.name, kind: "spot", lat: it.lat, lon: it.lon } : null, radius: (S.NEAR && S.NEAR[it.cat]) || 10 };
    }
    if (kind === "pt" && pt) {
      var par = pt.country === "USA" && pt.region ? "#/place/state/" + pt.region : P.regionKey && P.regionKey(pt.country, pt.region) ? "#/place/region/" + P.regionKey(pt.country, pt.region) : pt.country === "GBR" && NATIONS.indexOf(pt.region) >= 0 ? "#/place/place/" + pt.region : pt.country ? "#/place/place/" + pt.country : "";
      var o = { name: pt.name, sub: pt.sub || "", parent: par, stop: JSON.parse(JSON.stringify(pt)), pt: pt };
      if (pt.kind === "sight") { o.stampKind = "sight"; o.area = pt.area || P.sightArea({ ref: pt.ref || "", name: pt.name, type: pt.type || "landmark", country: pt.country }); }
      return o;
    }
    return null;
  }
  function placeView(kind, rawId) {
    var a = A(), U = window.FS_UI, P = window.WK_PASSPORT, T = window.WK_TRIPS, M = window.MLTL, st = a.state;
    var pt = kind === "pt" ? readPt(rawId) : null, id = kind === "pt" ? "" : decodeURIComponent(rawId || "");
    var info = U && P ? placeInfo(kind, id, pt) : null;
    var back = '<a class="back" href="#/search">← Search</a>';
    if (!info) { a.main.innerHTML = back + '<h1>Place not found</h1><p class="muted">We couldn\'t find that place. Try searching again.</p>'; return; }
    document.title = info.name + " · " + B().NAME;
    var rows = [], mapOnly = [];
    if (info.spot) st.kids.forEach(function (k) {
      if (info.adult && window.FS_SPOTS.kidOf(k)) return;
      var v = k.spots && k.spots[info.spot.id]; if (v) rows.push({ person: k.id, stamp: { date: v.at || "", tripId: v.tripId || "", source: "hand" } });
      (Array.isArray(k.eats) ? k.eats : []).forEach(function (e) { if (e && e.id === info.spot.id) rows.push({ person: k.id, stamp: { date: e.at || "", tripId: e.tripId || "", source: "hand" } }); });
    });
    st.kids.forEach(function (k) {
      if (info.stampKind) U.stampsOf(k).forEach(function (s) { if (s.kind === info.stampKind && s.area === info.area) rows.push({ person: k.id, stamp: s }); });
      var bag = info.stampKind === "state" ? k.states : info.stampKind === "park" ? k.parks : info.stampKind === "place" ? k.places : null;
      if (bag && bag[info.area] && !rows.some(function (r) { return r.person === k.id && r.stamp.source !== "map"; })) mapOnly.push(k.id);
    });
    if (info.pt && T.hasLoc(info.pt)) st.trips.forEach(function (t) {   // a town / airport / sight: trips that stopped within 15 miles
      if (t.deletedAt || t.planned === true) return;
      if (info.adult && !(t.kidIds || []).some(function (pid) { var k = a.kidById(pid); return k && !window.FS_SPOTS.kidOf(k); })) return;
      var stops = (T.stops ? T.stops(t.route) : (t.route || [])).slice(1);
      if (!stops.some(function (p) { return T.hasLoc(p) && T.gcMiles(p, info.pt) < (info.radius || (info.pt.kind === "sight" && info.pt.type !== "airport" ? 1 : 15)); })) return;
      (t.kidIds || []).forEach(function (pid) { if (info.adult) { var kk = a.kidById(pid); if (kk && window.FS_SPOTS.kidOf(kk)) return; } if (!rows.some(function (r) { return r.person === pid && r.stamp.tripId === t.id; })) rows.push({ person: pid, stamp: { tripId: t.id, trip: t.place, date: t.date || "", end: t.endDate || "", source: "trip" } }); });
    });
    if (kind === "place" && /^[A-Z]{3}$/.test(id)) st.trips.forEach(function (t) {   // a country: every trip with a stop in it (the USA is stamped by state)
      if (t.deletedAt || t.planned === true) return;
      if (!(t.route || []).slice(1).some(function (p) { return p && p.country === id; })) return;
      (t.kidIds || []).forEach(function (pid) { if (!rows.some(function (r) { return r.person === pid && r.stamp.tripId === t.id; })) rows.push({ person: pid, stamp: { tripId: t.id, trip: t.place, date: t.date || "", end: t.endDate || "", source: "trip" } }); });
    });
    var visits = groupVisits(rows), n = visits.length, first = visits.length ? visits[visits.length - 1].date : "";
    var stampObj = info.stampKind ? { kind: info.stampKind, area: info.area, date: first, who: [], name: info.pt ? info.pt.name : undefined, type: info.pt ? info.pt.type : undefined, ref: info.pt ? info.pt.ref : undefined }
      : { kind: "place", area: (info.pt && info.pt.country) || "", date: first, who: [] };
    var art = ""; try { art = info.spot ? window.FS_SPOTS.stampSVG(info.spot, first) : P.stampSVG(stampObj, info.name, { kid: false }); } catch (e) {}
    var planned = st.trips.filter(function (t) { return !t.deletedAt && t.planned === true; }).slice(0, 4);
    var me = a.kidById(a.myPersonId && a.myPersonId()) || st.kids[0];
    var tripLink = function (v) { var t = v.tripId ? st.trips.filter(function (x) { return x.id === v.tripId; })[0] : null; return t ? '<a href="#/p/' + esc(t.kidIds[0] || v.who[0]) + '/trip/' + esc(t.id) + '">' + esc(t.title || t.place || "Trip") + '</a>' : v.source === "hand" ? "Stamped by hand" : ""; };
    a.main.innerHTML = back + '<div class="placepage" data-place="' + esc(kind + ":" + (info.area || info.name)) + '"><div class="placehead"><div class="bigstamp' + (n ? "" : " unstamped") + '">' + art + '</div><div><h1>' + esc(info.name) + '</h1>' +
      '<p class="muted">' + esc(info.sub) + (info.parent ? ' · <a href="' + esc(info.parent) + '">in ' + esc(info.parent.indexOf("/state/") > 0 ? a.placeName("state", info.parent.split("/").pop()) : info.parent.indexOf("/region/") > 0 ? P.regionName(info.parent.split("/").pop()) : a.placeName("place", info.parent.split("/").pop())) + ' →</a>' : "") + '</p>' +
      '<p class="vtimes"><b>' + (n ? "Visited " + (n === 1 ? "once" : n + " times") : mapOnly.length ? "Colored in, no visit dated yet" : "Not stamped yet") + '</b></p></div></div>' +
      (n ? '<h2>Visits</h2><ul class="pvisitlist placevisits">' + visits.map(function (v) {
        var d = P.fmtDate(v.date) ? P.fmtDate(v.date) + (v.end && v.end !== v.date ? " to " + P.fmtDate(v.end) : "") : "No date yet";
        return '<li><b>' + esc(d) + '</b> <span class="small">' + tripLink(v) + '</span><br><span class="small muted">' + esc(a.travelerNames(v.who)) + '</span></li>'; }).join("") + '</ul>' : "") +
      (mapOnly.length ? '<p class="small muted">Colored in on the map: ' + esc(a.travelerNames(mapOnly)) + '. Tap Stamp it to add when.</p>' : "") +
      '<div class="panel placeacts"><h3>' + (n ? "Been again?" : "Been here?") + '</h3><div class="actions">' +
        (info.canStamp ? '<button type="button" class="btn btn-primary" id="plstamp">🛂 ' + (n ? "Add a visit" : "Stamp it") + '</button><button type="button" class="btn btn-ghost" data-pltrip="new">🧳 Add a trip we took here</button>'
          : '<button type="button" class="btn btn-primary" data-pltrip="new">🛂 ' + (n ? "Add a visit" : "Stamp it: add the trip") + '</button>') +
      '</div><h3>Going?</h3><div class="actions">' + planned.map(function (t) { return '<button type="button" class="btn btn-ghost" data-pladd="' + esc(t.id) + '">➕ Add to “' + esc(t.title || t.place || "upcoming trip") + '”</button>'; }).join("") +
        '<button type="button" class="btn btn-ghost" data-pltrip="plan">✈️ ' + (planned.length ? "Plan a new trip here" : "Add to a trip: plan one here") + '</button></div></div>' +
      '<div id="plsights"></div></div>';
    var stopOf = function () {
      return U.loadPlaces().then(function (d) {
        var s = Object.assign({ name: info.name }, info.stop);
        if (info.park && U.parkPoint) s = U.parkPoint(d, info.park);
        if (s.lat == null) { var b = null, reg = s.region; d.rows.forEach(function (r) { if (r.country === s.country && (!reg || r.admin1 === reg) && (!b || r.pop > b.pop)) b = r; }); if (b) { s.lat = b.lat; s.lon = b.lon; } }
        return s;
      });
    };
    var sb = document.getElementById("plstamp");
    if (sb && info.spot) sb.onclick = function () {   // the Parks tab's own who-was-there sheet (pubs list grown-ups only)
      if (!me) return a.toast("Add someone to the family first.");
      var again = function () { placeView(kind, rawId); };
      if (info.entry) window.FS_SPOTS.openEntry(me, info.entry, again); else window.FS_SPOTS.openSpot(me, info.spot.id, again);
    };
    else if (sb) sb.onclick = function () { if (!window.FS_WHO || !me) return a.toast("Add someone to the family first."); window.FS_WHO.open({ kind: info.stampKind, area: info.area, page: me, mode: "add", after: function () { placeView(kind, rawId); } }); };
    Array.prototype.forEach.call(a.main.querySelectorAll("[data-pltrip]"), function (b) { b.onclick = function () { stopOf().then(function (s) { U.startTripTo(s, b.dataset.pltrip === "plan"); }); }; });
    Array.prototype.forEach.call(a.main.querySelectorAll("[data-pladd]"), function (b) { b.onclick = function () {
      var t = st.trips.filter(function (x) { return x.id === b.dataset.pladd; })[0]; if (!t) return;
      stopOf().then(function (s) { t.route = t.route || []; if (t.route.length) s.mode = s.mode || "car"; t.route.push(s); return U.saveTrip(t); })
        .then(function () { a.toast(info.name + " is on “" + (t.title || t.place || "the trip") + "”"); location.hash = "#/p/" + (t.kidIds[0] || me.id) + "/trip/" + t.id; });
    }; });
    sightsIn(info, stopOf);
    track("place:open");
  }
  /** The best-known sights in a place (or within 15 miles of a town / sight / park), from the nearby-sights tiles. */
  function sightsIn(info, stopOf) {
    var U = window.FS_UI, P = window.WK_PASSPORT, T = window.WK_TRIPS, a = A(), box = document.getElementById("plsights"); if (!box || !U.nearBlocks) return;
    var stamped = {}; a.state.kids.forEach(function (k) { U.stampsOf(k).forEach(function (s) { if (s.kind === "sight") stamped[s.area] = 1; }); });
    Promise.all([stopOf(), U.loadPlaces()]).then(function (r) {
      var c = r[0], d = r[1]; if (c.lat == null) return;
      return U.nearBlocks(c).then(function (blocks) {
        var whole = !info.pt && !info.park, code = info.stop && info.stop.region, seen = {}, list = [];
        blocks.forEach(function (b) { (b.rows || []).forEach(function (row) {
          if (!row || seen[row.wd || row.names[0]]) return;
          if (whole) { if (row.country !== c.country) return; if (code && info.stampKind !== "place" && row.admin1 !== code && !(P.regionKey && P.regionKey(row.country, row.admin1) === info.area)) return; }
          else if (T.gcMiles(c, row) > 15) return;
          if (info.pt && row.names[0] === info.pt.name) return;
          seen[row.wd || row.names[0]] = 1; list.push(row);
        }); });
        list.sort(function (x, y) { return (y.rank || 0) - (x.rank || 0); });
        if (!list.length) return;
        box.innerHTML = '<h2>Sights ' + (whole ? "in " : "near ") + esc(info.name) + '</h2><ul class="sresl plsightlist">' + list.slice(0, 8).map(function (row) {
          var sp = U.sightPoint(d, row), ar = P.sightArea({ ref: sp.ref || "", name: sp.name, type: sp.type, country: sp.country });
          return '<li><a href="' + esc(placeHref(sp)) + '">' + esc(sp.label || sp.name) + '</a> <span class="muted small">' + esc(sp.sub || "") + '</span>' + (stamped[ar] ? ' <span class="small">✓ stamped</span>' : "") + '</li>'; }).join("") + '</ul>';
      });
    }).catch(function () {});
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "place" || !h[1]) return false; placeView(h[1], h.slice(2).join("/")); return true; });
  document.addEventListener("keydown", function (e) { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); location.hash = "#/search"; } });

  // ---------- What's new ----------
  function whatsNew() {
    var a = A(), main = a && a.main; if (!main || !/^#?\/?$/.test(location.hash)) return;
    var seen = ls("fs-seen-version");
    if (!seen) { ls("fs-seen-version", a.version); return; }   // first install: nothing to announce
    if (seen === a.version || main.querySelector(".whatsnew")) return;
    var notes = notesSince(seen); if (!notes.length) { ls("fs-seen-version", a.version); return; }
    var el = document.createElement("div"); el.className = "panel whatsnew"; el.setAttribute("role", "status");
    el.innerHTML = '<h3>What\'s new in ' + esc(B().NAME) + '</h3><ul>' + notes.map(function (n) { return n.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join(""); }).join("") + '</ul><button type="button" class="btn btn-ghost btn-sm">Got it</button>';
    el.querySelector("button").onclick = function () { ls("fs-seen-version", a.version); el.remove(); };
    main.insertBefore(el, main.firstChild);
  }
  // ---------- rating prompt after happy moments ----------
  var stampsThisSession = 0;
  function maybeAsk(reason) {
    var st = lj("fs-rate") || {}; if (!shouldAsk(st)) return;
    st.asks = (st.asks || 0) + 1; st.last = Date.now(); lj("fs-rate", st);
    var C = B().CONTACT || {}, store = B().RATE_URL || "";
    var el = document.createElement("div"); el.className = "undotoast ratebar"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Enjoying " + B().NAME + "?");
    el.innerHTML = '<span>Enjoying ' + esc(B().NAME) + '? 🎉</span><button type="button" data-r="yes" class="undobtn">' + (store ? "Rate it" : "Yes!") + '</button><button type="button" data-r="meh" class="undobtn">Not really</button><button type="button" class="undox" aria-label="Not now">✕</button>';
    document.body.appendChild(el); track("rate:ask:" + reason);
    el.onclick = function (e) {
      var r = e.target.getAttribute("data-r"); if (!r && !e.target.classList.contains("undox")) return;
      el.remove(); var s2 = lj("fs-rate") || {};
      if (r === "yes") { s2.done = "yes"; lj("fs-rate", s2); track("rate:yes"); if (store) window.open(store, "_blank", "noopener"); else A().toast("Thank you! That made our day."); }
      else if (r === "meh") { s2.done = "no"; lj("fs-rate", s2); track("rate:no"); location.href = "mailto:" + C.support + "?subject=" + encodeURIComponent(B().NAME + " could be better"); }
    };
    setTimeout(function () { el.remove(); }, 15000);
  }
  document.addEventListener("fs:stamp", function () {
    stampsThisSession++;
    var a = A(), total = 0; (a.state.kids || []).forEach(function (k) { total += Object.keys(k.states || {}).length + Object.keys(k.places || {}).length + Object.keys(k.parks || {}).length; });
    if (total >= 10) setTimeout(function () { maybeAsk("stamps"); }, 3500);
  });

  // ---------- settings panel (shown on Help) ----------
  function settingsHTML() {
    var a = A(), m = a.state.meta || {}, units = m.units === "km" ? "km" : "mi", temp = m.tempUnit === "C" || m.tempUnit === "F" ? m.tempUnit : units === "km" ? "C" : "F";
    var push = lj("fs-push-times") || {}, hour = push.hour == null ? 9 : push.hour;
    var hours = function (sel, id) { var o = ""; for (var h = 0; h < 24; h++) o += '<option value="' + h + '"' + (h === sel ? " selected" : "") + '>' + ((h % 12) || 12) + (h < 12 ? " AM" : " PM") + '</option>'; return '<select id="' + id + '">' + o + '</select>'; };
    return '<div class="panel" id="xsettings"><h2>Settings</h2>' +
      '<p class="small"><b>Distance</b></p><div class="seg" role="group" aria-label="Distance units"><button type="button" data-xunits="mi" aria-pressed="' + (units === "mi") + '">Miles</button><button type="button" data-xunits="km" aria-pressed="' + (units === "km") + '">Kilometers</button></div>' +
      '<p class="small"><b>Temperature</b></p><div class="seg" role="group" aria-label="Temperature"><button type="button" data-xtemp="F" aria-pressed="' + (temp === "F") + '">°F</button><button type="button" data-xtemp="C" aria-pressed="' + (temp === "C") + '">°C</button></div>' +
      '<label class="chk"><input type="checkbox" id="xsound"' + (soundOn() ? " checked" : "") + '> Play a little sound when a stamp lands (off unless you turn it on; the haptic buzz still works)</label>' +
      '<h3>Notifications</h3><p class="small muted">Turn notifications on and pick which ones on the Family Sync page. Times use this phone\'s time zone.</p>' +
      '<div class="field"><label for="xhour">Send reminders and recaps at</label>' + hours(hour, "xhour") + '</div>' +
      '<label class="chk"><input type="checkbox" id="xquiet"' + (push.quiet ? " checked" : "") + '> Quiet hours (no notifications)</label>' +
      '<div class="xquiet"' + (push.quiet ? "" : " hidden") + '><div class="field"><label for="xqs">From</label>' + hours(push.qs == null ? 20 : push.qs, "xqs") + '</div><div class="field"><label for="xqe">Until</label>' + hours(push.qe == null ? 7 : push.qe, "xqe") + '</div></div>' +
      '<p class="small" id="xstore">Storage: checking…</p></div>';
  }
  function bindSettings(redraw) {
    var a = A(), $ = function (s) { return document.querySelector(s); };
    Array.prototype.forEach.call(document.querySelectorAll("[data-xunits]"), function (b) { b.onclick = function () { a.setMeta("units", b.dataset.xunits).then(redraw); }; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-xtemp]"), function (b) { b.onclick = function () { a.setMeta("tempUnit", b.dataset.xtemp).then(redraw); }; });
    $("#xsound").onchange = function (e) { ls("fs-sound", e.target.checked ? "on" : null); };
    var savePush = function () {
      var p = { hour: +$("#xhour").value, quiet: $("#xquiet").checked, qs: +$("#xqs").value, qe: +$("#xqe").value };
      lj("fs-push-times", p); document.querySelector(".xquiet").hidden = !p.quiet;
      if (window.FS_PUSH && window.FS_PUSH.saveTimes) window.FS_PUSH.saveTimes(p);
    };
    ["#xhour", "#xquiet", "#xqs", "#xqe"].forEach(function (s) { $(s).onchange = savePush; });
    storage().then(function (t) { var el = $("#xstore"); if (el) el.innerHTML = t; });
  }
  function storage() {
    var a = A();
    return a.all("photos").then(function (ph) {
      var bytes = 0; ph.forEach(function (p) { bytes += (p.dataUrl || "").length * 0.75; });
      var est = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null);
      return est.then(function (e) {
        var used = e && e.usage ? e.usage : 0, quota = e && e.quota ? e.quota : 0, pct = quota ? Math.min(100, Math.round(used / quota * 100)) : 0;
        return '<b>Storage used:</b> ' + fmtBytes(used || bytes) + (quota ? " of " + fmtBytes(quota) + " this browser allows" : "") + (ph.length ? '. Photos: ' + ph.length + ' (' + fmtBytes(bytes) + '). Photos are shrunk when you add them, so they take little space.' : '. No photos yet.') +
          (quota ? '<span class="meter" role="meter" aria-label="Storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + Math.max(2, pct) + '%"></span></span>' : "");
      });
    }).catch(function () { return "Storage: couldn't check."; });
  }
  function injectHelp() {
    var a = A(); if (!a || !/^#\/help/.test(location.hash) || document.getElementById("xsettings")) return;
    var anchor = a.main.querySelector(".panel:nth-of-type(2)"); if (!anchor) return;
    var div = document.createElement("div"); div.innerHTML = settingsHTML(); anchor.parentNode.insertBefore(div.firstChild, anchor.nextSibling);
    bindSettings(function () { var x = document.getElementById("xsettings"); if (x) x.remove(); injectHelp(); });
  }
  // On narrow phones the header is full, so Home and Trips also get a search bar (only once there's something to search).
  function homeSearch() {
    var a = A(); if (!a || !a.main || a.main.querySelector(".homesearch")) return;
    var hh = location.hash; if (!(/^#?\/?$/.test(hh) || /^#\/p\/[^/]+\/trips$/.test(hh) || hh === "#/trips")) return;
    if (!(a.state.trips || []).length) return;
    var el = document.createElement("a"); el.className = "homesearch"; el.href = "#/search";
    el.innerHTML = '<span aria-hidden="true">🔎</span> Search trips, stamps and journals';
    var w = a.main.querySelector(".whatsnew"); a.main.insertBefore(el, w ? w.nextSibling : a.main.firstChild);
  }
  function after() { setTimeout(function () { whatsNew(); homeSearch(); injectHelp(); }, 0); }
  window.addEventListener("hashchange", after);
  var mo = new MutationObserver(function () { after(); });
  var start = function () { var m = document.getElementById("main") || (A() && A().main); if (m) mo.observe(m, { childList: true }); after(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);

  return { placeHref: placeHref, readPt: readPt, groupVisits: groupVisits, placeView: placeView, search: search, tripText: tripText, norm: norm, shouldAsk: shouldAsk, notesSince: notesSince, fmtBytes: fmtBytes, NOTES: NOTES, soundOn: soundOn, maybeAsk: maybeAsk, storage: storage };
});
