/* Famstamp 1.4: Trips (builder, trip page, story read-aloud) and the Passport. Plain JavaScript, no network calls: the
   place and airport lists are this app's own files (data/places.json, data/airports.json), fetched the first time a
   trip is built and kept by the service worker. The app shell (app.js) hands over its helpers as window.MLTL_APP. */
(function () {
  "use strict";
  var T = window.WK_TRIPS, P = window.WK_PASSPORT, M = window.MLTL, MAPS = window.MLTL_MAPS, esc = M.esc;
  function A() { return window.MLTL_APP; }
  function S() { return A().state; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function units() { return S().meta.units === "km" ? "km" : "mi"; }
  function dist(mi, long) { return T.fmtDist(mi, units(), long ? { long: true } : null); }
  function tripById(id) { return S().trips.filter(function (t) { return t.id === id; })[0]; }
  function people(ids) { return (ids || []).map(A().kidById).filter(Boolean); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function reduced() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }
  var PARK_BY = {}; M.PARKS.forEach(function (p) { PARK_BY[p.id] = p; });
  function parkName(id) { return PARK_BY[id] ? PARK_BY[id].name : id; }
  function areaName(kind, id) { return A().placeName(kind, id); }
  function shortArea(kind, id) { return kind === "park" ? parkName(id) : areaName(kind, id); }
  function num(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function stars(n) { n = n || 0; return n ? '<span class="stars-ro" aria-label="' + n + ' out of 5">' + "★★★★★".slice(0, n) + '<i>' + "★★★★★".slice(n) + '</i></span>' : ""; }
  function dateRange(t) {
    var a = M.prettyDate(t.date), b = M.prettyDate(t.endDate);
    if (a && b && t.date.slice(0, 4) === t.endDate.slice(0, 4)) a = a.replace(/, \d{4}$/, "");
    return a && b ? a + " – " + b : a || b;
  }

  // ---------- place + airport lists (lazy) ----------
  var DATA = { places: null, airports: null }, pending = {};
  function getJSON(name) {
    if (pending[name]) return pending[name];
    pending[name] = fetch("data/" + name + ".json").then(function (r) { if (!r.ok) throw new Error("offline"); return r.json(); })
      .catch(function (e) { pending[name] = null; throw e; });
    return pending[name];
  }
  function loadPlaces() {
    if (DATA.places) return Promise.resolve(DATA.places);
    return getJSON("places").then(function (j) {
      var rows = j.rows.split("\n").map(function (l) {
        var c = l.split("\t"); return { name: c[0], low: (c[1] || c[0]).toLowerCase(), nlow: c[0].toLowerCase(), lat: +c[2], lon: +c[3], country: c[4], admin1: c[5], pop: +c[6] || 0 };
      });
      DATA.places = { rows: rows, countries: j.countries, admin: j.admin, parks: j.parks }; return DATA.places;
    });
  }
  function loadAirports() {
    if (DATA.airports) return Promise.resolve(DATA.airports);
    return getJSON("airports").then(function (j) {
      DATA.airports = j.rows.split("\n").map(function (l) {
        var c = l.split("\t"); return { code: c[0], name: c[1], city: c[2], country: c[3], region: c[4], lat: +c[5], lon: +c[6], size: c[7], low: (c[0] + " " + c[2] + " " + c[1]).toLowerCase() };
      });
      return DATA.airports;
    });
  }
  function regionOf(country, admin1) { return country === "USA" || country === "GBR" ? admin1 : (/^[A-Z0-9]{1,3}$/.test(admin1 || "") ? admin1 : ""); }
  function subOf(d, country, admin1) {
    var c = d.countries[country] || country, ad = d.admin[country + "." + admin1];
    if (country === "USA") return ad || c;
    if (country === "GBR") return (ad ? ad + ", " : "") + "UK";
    return ad && ad !== c ? ad + ", " + c : c;
  }
  function cityPoint(d, r) { return { name: r.name, kind: "city", lat: r.lat, lon: r.lon, country: r.country, region: regionOf(r.country, r.admin1), sub: subOf(d, r.country, r.admin1) }; }
  function parkPoint(d, p) {
    var ll = d && d.parks[p.id], st = p.states.split(/,\s*/);
    var o = { name: p.name + " National Park", kind: "park", ref: p.id, country: "USA", sub: p.states };
    if (st.length === 1 && T.US_STATES.indexOf(st[0]) >= 0) o.region = st[0];
    if (ll) { o.lat = ll[0]; o.lon = ll[1]; }
    return o;
  }
  /** Cities, towns and national parks matching what they typed ("Edinburgh", "inver", "portland, me", "zion"). */
  function searchPlaces(q, d) {
    q = q.trim().toLowerCase(); if (q.length < 2) return [];
    var parts = q.split(","), head = parts[0].trim(), tail = (parts[1] || "").trim(), out = [];
    M.PARKS.forEach(function (p) { var n = p.name.toLowerCase(); if (n.indexOf(head) === 0 || (head.length > 3 && n.indexOf(head) > 0)) out.push(parkPoint(d, p)); });
    out = out.slice(0, 3);
    for (var i = 0; i < d.rows.length && out.length < 9; i++) {
      var r = d.rows[i];
      if (r.low.indexOf(head) !== 0 && r.nlow.indexOf(head) !== 0) continue;
      var pt = cityPoint(d, r);
      if (tail && (pt.sub.toLowerCase().indexOf(tail) < 0 && (r.admin1 || "").toLowerCase() !== tail && r.country.toLowerCase() !== tail)) continue;
      out.push(pt);
    }
    return out;
  }
  function searchAirports(q, list) {
    q = q.trim().toLowerCase(); if (q.length < 2) return [];
    var exact = list.filter(function (a) { return a.code.toLowerCase() === q; });
    var rest = list.filter(function (a) { return a.code.toLowerCase() !== q && (a.city.toLowerCase().indexOf(q) === 0 || a.name.toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return (a.size === "L" ? 0 : 1) - (b.size === "L" ? 0 : 1); });
    return exact.concat(rest).slice(0, 7);
  }
  function airportObj(a) { return { code: a.code, name: a.name, city: a.city, country: a.country, lat: a.lat, lon: a.lon }; }
  function nearestAirport(p, list) {
    if (!T.hasLoc(p) || !list) return null;
    var best = null, bd = 1e9;
    list.forEach(function (a) { var d = T.gcMiles(p, a) * (a.size === "L" ? 0.6 : 1); if (d < bd) { bd = d; best = a; } });
    return best && bd < 250 ? airportObj(best) : null;
  }
  /** The n closest airports to a place, big ones first when they're about as close (for "Which airports?"). */
  function nearAirports(p, list, n) {
    if (!T.hasLoc(p) || !list) return [];
    return list.map(function (a) { var g = T.gcMiles(p, a); return { a: a, g: g, w: g * (a.size === "L" ? 0.6 : 1) }; })
      .filter(function (x) { return x.g < 300; }).sort(function (x, y) { return x.w - y.w; }).slice(0, n || 3)
      .map(function (x) { var o = airportObj(x.a); o.away = Math.round(x.g); return o; });
  }
  function placeLine(p) { return p.sub ? p.name + ", " + p.sub : p.name; }

  // ---------- the route drawn on the map ----------
  function routeSVG(t, opts) {
    opts = opts || {};
    var map = T.routeMap(t); if (!map) return "";
    var r = t.route || [], pts = r.map(function (p) { return T.project(p, map); });
    var xy = pts.filter(Boolean), base = map === "us" ? MAPS.us : MAPS.world;
    var minx = Math.min.apply(null, xy.map(function (p) { return p[0]; })), maxx = Math.max.apply(null, xy.map(function (p) { return p[0]; }));
    var miny = Math.min.apply(null, xy.map(function (p) { return p[1]; })), maxy = Math.max.apply(null, xy.map(function (p) { return p[1]; }));
    var w = Math.max(maxx - minx, map === "us" ? 120 : 40), h = Math.max(maxy - miny, map === "us" ? 70 : 24);
    w *= 1.35; h *= 1.35; if (w / h < 1.5) w = h * 1.5; else h = w / 1.5;
    var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, vb = [cx - w / 2, cy - h / 2, w, h];
    vb[0] = Math.max(0, Math.min(vb[0], base.w - w)); vb[1] = Math.max(0, Math.min(vb[1], base.h - h));
    if (w > base.w) { vb = [0, 0, base.w, base.h]; }
    var u = vb[2] / 300, sum = T.summary(t), hl = {};
    T.areas(t, M.PARK_STATES).forEach(function (a) { hl[a.id] = 1; });
    var s = '<svg viewBox="' + vb.map(function (v) { return v.toFixed(1); }).join(" ") + '" role="img" aria-label="Map of the route: ' + esc(M.routeText(t)) + '">';
    if (map === "world") s += '<path class="ocean" d="' + base.outline + '"/>';
    base.shapes.forEach(function (p) { s += '<path class="a' + (hl[p.id] ? " on" : "") + (p.uk ? " uk" : "") + '" d="' + p.d + '"/>'; });
    var legs = sum.legs, line = "";
    legs.forEach(function (L) {
      var a = pts[L.i - 1], b = L.home ? pts[0] : pts[L.i];
      if (L.mode === "plane" && L.dep && L.dep.lat != null) a = T.project(L.dep, map) || a;
      if (L.mode === "plane" && L.arr && L.arr.lat != null) b = T.project(L.arr, map) || b;
      if (!a || !b) return;
      if (L.mode === "plane") {
        var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, k = len * 0.22;
        line += '<path class="leg plane" d="M' + a[0] + ',' + a[1] + ' Q' + (mx + dy / len * k).toFixed(1) + ',' + (my - dx / len * k).toFixed(1) + ' ' + b[0] + ',' + b[1] + '" stroke-width="' + (u * 2.2).toFixed(2) + '" stroke-dasharray="' + (u * 5).toFixed(2) + ' ' + (u * 3.5).toFixed(2) + '"/>';
      } else line += '<path class="leg ' + esc(L.mode) + '" d="M' + a[0] + ',' + a[1] + ' L' + b[0] + ',' + b[1] + '" stroke-width="' + (u * 2.6).toFixed(2) + '"/>';
    });
    s += line;
    pts.forEach(function (p, i) {
      if (!p) return;
      s += '<g class="stopdot"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (u * (i ? 6 : 5)).toFixed(2) + '" stroke-width="' + (u * 1.6).toFixed(2) + '"' + (i ? "" : ' class="home"') + '/>' +
        (i ? '<text x="' + p[0] + '" y="' + (p[1] + u * 2.6).toFixed(2) + '" font-size="' + (u * 7.5).toFixed(2) + '">' + i + '</text>' : "") + '<title>' + esc(r[i].name) + '</title></g>';
    });
    return s + '</svg>';
  }

  // ---------- trip card on the Trips tab ----------
  function tripCard(t, k) {
    var A_ = A(), age = k && M.isKid(k) ? M.ageOn(k.birthYear, t.date) : null, owner = k || A_.kidById(t.kidIds[0]), s = T.summary(t);
    var route = M.routeText(t), link = owner ? "#/p/" + esc(owner.id) + "/trip/" + esc(t.id) : "";
    var bits = [dateRange(t) || "", s.nights ? s.nights + (s.nights === 1 ? " night" : " nights") : "", age != null ? "age " + age : ""].filter(Boolean);
    var miles = s.legs.length && s.miles ? '<span class="tmiles">' + (s.milesKnown ? "" : "at least ") + esc(dist(s.miles)) + '</span>' + (s.flights ? ' · <span class="tfly">✈️ ' + s.flights + (s.flights === 1 ? " flight" : " flights") + '</span>' : "") : "";
    return '<article class="trip">' + (t.photoId ? '<img alt="" data-photo="' + esc(t.photoId) + '">' : "") + '<div class="body"><h3>' + (link ? '<a class="tlink" href="' + link + '">' + esc(t.place) + '</a>' : esc(t.place)) + '</h3>' +
      (route !== t.place ? '<div class="route">' + esc(route) + '</div>' : "") +
      '<div class="when">' + esc(bits.join(" · ")) + (miles ? (bits.length ? " · " : "") + miles : "") + (t.mark && !s.legs.length ? " · 🖍 " + esc(areaName(t.mark.kind, t.mark.id)) : "") + '</div>' +
      (t.memory ? '<p class="mem">' + esc(t.memory) + '</p>' : "") +
      '<div class="travelers"><span class="dots">' + A_.avatars(t.kidIds) + '</span><span>' + esc(A_.travelerNames(t.kidIds)) + '</span></div>' +
      (t.who ? '<div class="who">Also along: ' + esc(t.who) + '</div>' : "") +
      (owner ? '<div class="tactions noprint"><a href="' + link + '">Open trip' + (t.story ? " & story" : "") + ' →</a><a class="edit" href="#/p/' + esc(owner.id) + '/trips/edit/' + esc(t.id) + '">Edit</a></div>' : "") + syncExtra(t) + '</div></article>';
  }

  // Family Sync's per-trip extras ("Also add to my other family", "Copied from ..."); empty when sync is off.
  function syncExtra(t) { try { return window.MLTL_SYNC && window.MLTL_SYNC.tripExtra ? window.MLTL_SYNC.tripExtra(t) || "" : ""; } catch (e) { return ""; } }

  // ---------- trip builder ----------
  var MODE_LABEL = { car: "Car", rv: "RV", plane: "Plane", train: "Train", boat: "Boat", walk: "Walk" };
  function modeIc(m) { return (T.MODE[m] || T.MODE.car).ic; }
  function adultOn(ids) { return people(ids).some(T.isAdult); }
  function builder(k, tripId, opts) {
    opts = opts || {};
    var A_ = A(), st = S(), old = tripId ? tripById(tripId) : null;
    if (tripId && !old) { location.hash = "#/p/" + k.id + "/trips"; return; }
    // Work on a copy of the whole trip, so fields this version doesn't know about ride along untouched.
    var d = old ? copy(old) : { kidIds: opts.all ? st.kids.map(function (x) { return x.id; }) : [k.id], route: [], date: M.today(), endDate: "", nights: null, roundTrip: true, done: true, stays: [], favs: [], moments: {}, memory: "", who: "", title: "", mark: null };
    if (!d.route) d.route = [];
    if (!old && st.meta.homePoint) d.route = [copy(st.meta.homePoint)];
    else if (!old && st.meta.home) d.route = [{ name: st.meta.home, kind: "place" }];
    var newPhoto = null, removePhoto = false, saveHome = !st.meta.homePoint, places = null, airports = null;
    function memVals() { var o = {}; document.querySelectorAll("[data-memf]").forEach(function (el) { o[el.dataset.memf] = el.value; }); return o; }
    loadPlaces().then(function (x) { places = x; renderRoute(); }).catch(function () {});
    loadAirports().then(function (x) { airports = x; renderFly(); }).catch(function () {});
    // "Did you fly?": "" = not answered, "yes", "no" or "skip". Older trips that already have a flight count as yes.
    var fly = d.fly || (old && (d.route || []).some(function (p) { return p.mode === "plane"; }) ? "yes" : ""), flyOpen = false, flyPick = { dep: null, arr: null, ti: 0 };
    var picks = st.kids.map(function (x) {
      return '<label style="' + A_.kidStyle(x) + '"><input type="checkbox" name="kids" value="' + esc(x.id) + '"' + (d.kidIds.indexOf(x.id) >= 0 ? " checked" : "") + '> <span class="dotp" aria-hidden="true">' + A_.initial(x.name) + '</span> ' + esc(x.name) + '</label>';
    }).join("");
    var html = '<h2>' + (old ? "Edit trip" : "Add a trip") + '</h2><div class="panel builder">' +
      '<div class="field" style="margin-top:0"><label>Who went?</label><div class="kidpick">' + picks + '</div>' +
      (st.kids.length > 2 ? '<button type="button" class="linkbtn" id="tall">Everyone went</button>' : "") + '</div>' +
      '<div class="bsec"><h3>Where did you go? <span class="muted small">Tap places in order</span></h3><ol class="route" id="broute"></ol>' +
      '<div class="addplace"><label for="psearch" id="pslabel">Add a stop</label><input id="psearch" type="search" autocomplete="off" placeholder="City, town or national park" aria-controls="presults">' +
      '<div class="results" id="presults" role="listbox"></div></div>' +
      '<label class="check small"><input type="checkbox" id="tround"' + (d.roundTrip ? " checked" : "") + '> Round trip (came back home at the end)</label>' +
      '<div class="btotal" id="btotal"></div><div id="bfly" class="bfly"></div></div>' +
      '<div class="bsec"><h3>When?</h3><div class="fields"><div class="field"><label for="tdate">Start</label><input id="tdate" type="date" value="' + esc(d.date || "") + '"></div>' +
      '<div class="field"><label for="tend">End <span class="muted small">(optional)</span></label><input id="tend" type="date" value="' + esc(d.endDate || "") + '"></div>' +
      '<div class="field"><label for="tnights">Or how many nights?</label><input id="tnights" type="number" inputmode="numeric" min="0" max="999" value="' + (typeof d.nights === "number" ? d.nights : "") + '" placeholder="e.g. 7"></div></div>' +
      '<label class="check small"><input type="checkbox" id="tdone"' + (d.done || d.endDate ? " checked" : "") + '> We\'re home: this trip is done (unlocks its story)</label></div>' +
      '<details class="bsec more" id="dstays"' + (d.stays.length ? " open" : "") + '><summary>🏨 Where you stayed <span class="cnt"></span></summary><div id="bstays"></div><button type="button" class="linkbtn" id="addstay">+ Add a place you stayed</button></details>' +
      '<details class="bsec more" id="dfavs"' + (d.favs.length ? " open" : "") + '><summary>⭐ Favorites <span class="cnt"></span></summary><div id="bfavs"></div><div class="favadd" id="favadd"></div></details>' +
      '<details class="bsec more tmems"' + (Object.keys(d.moments || {}).length || d.memory || Object.keys(d.memories || {}).length ? " open" : "") + '><summary>💬 Trip memories</summary>' +
      '<p class="small muted">All optional. Fill in what you like, now or later.</p>' +
      '<div class="field"><label for="tmem">Notes</label><textarea id="tmem" maxlength="1000" rows="4" placeholder="Anything you want to remember about this trip">' + esc(d.memory || "") + '</textarea></div>' +
      T.MEM_PROMPTS.map(function (p) { return '<div class="field"><label for="tmm-' + p[0] + '">' + p[2] + ' ' + esc(p[1]) + '</label><textarea id="tmm-' + p[0] + '" data-memf="' + p[0] + '" maxlength="400" rows="2" placeholder="' + esc(p[3]) + '">' + esc((d.memories || {})[p[0]] || "") + '</textarea></div>'; }).join("") +
      '<h4 class="tmh">Each person\'s favorite moment</h4><div id="bmoments"></div></details>' +
      '<details class="bsec more"' + (d.photoId ? " open" : "") + '><summary>📷 Photo</summary><div class="field"><input id="tphoto" type="file" accept="image/*" aria-label="Photo"><p class="small muted">' +
      esc((window.MLTL_SYNC && window.MLTL_SYNC.photoNote()) || "We shrink it and keep it only on this device. Location data in the photo is removed.") + '</p>' +
      '<img id="tprev" class="photo-prev" alt="" hidden>' + (d.photoId ? '<button type="button" class="btn btn-ghost" id="trmphoto" style="margin-top:.5rem">Remove photo</button>' : "") + '</div></details>' +
      '<details class="bsec more"' + (d.title || d.who ? " open" : "") + '><summary>✏️ Name, who else, map</summary>' +
      '<div class="field"><label for="ttitle">Trip name (optional)</label><input id="ttitle" type="text" maxlength="80" value="' + esc(d.title || "") + '" placeholder="e.g. Scotland 2026, Smokies RV trip"></div>' +
      '<div class="field"><label for="twho">Anyone else along?</label><input id="twho" type="text" maxlength="120" value="' + esc(d.who || "") + '" placeholder="e.g. cousins, the Smiths, the dog"></div>' +
      '<div class="field"><label for="tmark">Color in one more place on the map? <span class="muted small">Stops above color in on their own</span></label><select id="tmark">' + A_.markOptions(d.mark) + '</select></div></details>' +
      '<p class="err" id="terr" hidden></p><div class="actions sticky"><button class="btn btn-primary" id="tsave">Save trip</button>' +
      '<a class="btn btn-ghost" href="' + (old ? "#/p/" + esc(k.id) + "/trip/" + esc(old.id) : "#/p/" + esc(k.id) + "/trips") + '">Cancel</a>' + (old ? '<button class="btn btn-danger" id="tdel">Delete trip</button>' : "") + '</div></div>';
    A_.main.innerHTML = A_.shell(k, "trips", html);
    var routeEl = $("#broute"), search = $("#psearch"), results = $("#presults");
    function kidIds() { return $$("input[name=kids]:checked").map(function (c) { return c.value; }); }

    // route list
    function legLine(i) {
      var a = d.route[i - 1], b = d.route[i], L = T.legMiles(a, b);
      var how = L.how === "manual" ? "your miles" : L.how === "flight" ? "flying distance" : L.how === "about" ? "about, by " + MODE_LABEL[b.mode || "car"].toLowerCase() : "add both places to work it out";
      return (L.how === "about" ? "about " : "") + dist(L.miles) + ' <span class="muted">· ' + how + '</span>';
    }
    function renderRoute() {
      var r = d.route;
      routeEl.innerHTML = r.map(function (p, i) {
        var leg = "";
        if (i > 0) {
          var mode = p.mode || "car";
          leg = '<div class="leg" data-i="' + i + '"><div class="modes" role="group" aria-label="How did you get to ' + esc(p.name) + '?">' + T.MODES.map(function (m) {
              return '<button type="button" data-mode="' + m.id + '" aria-pressed="' + (m.id === mode) + '" title="' + MODE_LABEL[m.id] + '"><span aria-hidden="true">' + m.ic + '</span><span class="lbl">' + MODE_LABEL[m.id] + '</span></button>'; }).join("") + '</div>' +
            '<div class="legmi">' + legLine(i) + ' <button type="button" class="linkbtn sm" data-realmi="' + i + '">' + (typeof p.miles === "number" ? "Change" : "Know the real miles?") + '</button></div>' +
            '<div class="realmi" data-mi="' + i + '"' + (typeof p.miles === "number" ? "" : " hidden") + '><input type="number" inputmode="decimal" min="0" max="30000" step="any" data-miles="' + i + '" value="' + (typeof p.miles === "number" ? (units() === "km" ? Math.round(p.miles * T.KM_PER_MI) : p.miles) : "") + '" aria-label="Real distance in ' + (units() === "km" ? "kilometers" : "miles") + '" placeholder="' + (units() === "km" ? "km" : "miles") + '"> ' + units() + (typeof p.miles === "number" ? ' <button type="button" class="linkbtn sm" data-clearmi="' + i + '">Use the estimate</button>' : "") + '</div>' +
            (mode === "plane" ? '<div class="airports">' + ["dep", "arr"].map(function (w) {
              var ap = p[w];
              return '<div class="ap"><label>' + (w === "dep" ? "Left from airport" : "Landed at airport") + '</label><input type="search" autocomplete="off" data-ap="' + w + '" data-i="' + i + '" value="' + (ap ? esc(ap.code + " · " + (ap.city || ap.name)) : "") + '" placeholder="Code or city, e.g. MCO"><div class="results" data-apres="' + w + i + '"></div></div>';
            }).join("") + '</div>' : "") + '</div>';
        }
        var nights = typeof p.nights === "number" ? p.nights : 0;
        return '<li class="rp">' + leg + '<div class="pt' + (T.hasLoc(p) ? "" : " noloc") + '"><span class="pin" aria-hidden="true">' + (i === 0 ? "🏠" : p.kind === "park" ? "🌲" : i) + '</span>' +
          '<div class="nm"><b>' + esc(p.name) + '</b><span>' + (i === 0 ? "Start · " : "") + esc(p.sub || (p.near ? "near " + p.near : T.hasLoc(p) ? "Your own place" : "No location yet")) + '</span>' +
          (T.hasLoc(p) ? "" : '<button type="button" class="linkbtn sm" data-locate="' + i + '">📍 Find it on the map</button>') + '</div>' +
          (i > 0 ? '<div class="stepper" aria-label="Nights in ' + esc(p.name) + '"><button type="button" data-n="-1" data-ni="' + i + '" aria-label="One less night">−</button><span>' + nights + '<small>' + (nights === 1 ? "night" : "nights") + '</small></span><button type="button" data-n="1" data-ni="' + i + '" aria-label="One more night">+</button></div>' : "") +
          '<button type="button" class="rm" data-rm="' + i + '" aria-label="Remove ' + esc(p.name) + '">×</button></div>' +
          (i === 0 && !st.meta.homePoint && !old ? '<label class="check small homechk"><input type="checkbox" id="thome"' + (saveHome ? " checked" : "") + '> Save as our home, so new trips start here</label>' : "") +
          '<div class="locate" data-loc="' + i + '" hidden><input type="search" autocomplete="off" data-near="' + i + '" placeholder="A town nearby, or lat, lon like 57.27, -6.20"><div class="results" data-nearres="' + i + '"></div></div></li>';
      }).join("");
      $("#pslabel").textContent = r.length ? "Add the next stop" : "Where did the trip start? (home)";
      search.placeholder = r.length ? "City, town or national park" : "Your town, e.g. Orlando";
      $("#tround").parentNode.hidden = r.length < 2;
      var s = T.summary(Object.assign({}, d, { roundTrip: $("#tround").checked }));
      $("#btotal").innerHTML = s.legs.length ? '<span>Total: <b>' + (s.milesKnown ? "" : "at least ") + esc(dist(s.miles)) + '</b>' + (s.flights ? ' · ✈️ ' + s.flights : "") + '</span>' + unitToggle() : "";
      bindUnits($("#btotal"), renderRoute);
      renderFly();
    }
    // ---- "Did you fly? Which airports?" (asked when the trip leaves the home country; a quiet link otherwise) ----
    function homeCountry() { var h = d.route[0]; return (h && h.country) || (st.meta.homePoint && st.meta.homePoint.country) || ""; }
    function abroad() { return d.route.length > 1 && T.crossesBorder(d.route, homeCountry()); }
    function flyTarget() {   // the leg the flight is on: into the first stop abroad, or the longest leg at home
      var r = d.route, hc = homeCountry(), best = 1, bd = -1;
      for (var i = 1; i < r.length; i++) if (r[i].country && hc && r[i].country !== hc) return i;
      for (var j = 1; j < r.length; j++) { var g = T.gcMiles(r[j - 1], r[j]) || 0; if (g > bd) { bd = g; best = j; } }
      return best;
    }
    function planes() { return d.route.filter(function (p, i) { return i > 0 && p.mode === "plane"; }).length; }
    function apChip(w, a, on) {
      return '<button type="button" class="chip apchip" data-flyap="' + w + '" data-code="' + esc(a.code) + '" aria-pressed="' + !!on + '"><b>' + esc(a.code) + '</b> <span>' + esc(a.city || a.name) + '</span>' +
        (a.away != null ? ' <small>' + esc(dist(a.away)) + '</small>' : "") + '</button>';
    }
    function flySummary(s) {
      var out = s.legs.filter(function (L) { return L.mode === "plane" && !L.home && L.dep && L.arr; }).map(function (L) { return L.dep.code + " → " + L.arr.code; }),
        home = s.legs.some(function (L) { return L.mode === "plane" && L.home; });
      return (out.length ? esc(out.join(", ")) + (home ? " and back" : "") + ': ' : "") + '<b>' + s.flights + (s.flights === 1 ? " flight" : " flights") + '</b> · ' + esc(dist(s.flightMiles)) + ' flown' + (s.airMin ? ' · about ' + esc(T.fmtAir(s.airMin)) + ' in the air' : "");
    }
    function renderFly() {
      var box = $("#bfly"); if (!box) return;
      var r = d.route, rt = $("#tround") && $("#tround").checked;
      if (r.length < 2) { box.innerHTML = ""; return; }
      var intl = abroad(), n = planes(), ask = flyOpen || (intl && !fly);
      if (!ask) {
        var s = T.summary(Object.assign({}, d, { roundTrip: rt }));
        if (n) box.innerHTML = '<div class="flydone" id="flydone"><span aria-hidden="true">✈️</span><span>' + flySummary(s) + '</span><span class="flybtns"><button type="button" class="linkbtn sm" id="flyedit">Change airports</button><button type="button" class="linkbtn sm" id="flyno">We didn\'t fly</button></span></div>';
        else box.innerHTML = '<p class="flylink small">' + (fly === "no" && intl ? '<span class="muted">No flights on this one. </span>' : "") + '<button type="button" class="linkbtn sm" id="flyedit">✈️ ' + (fly === "no" && intl ? "We did fly" : "Did you fly? Add airports") + '</button></p>';
        return;
      }
      var ti = flyTarget(), a = r[ti - 1], b = r[ti], cur = b.mode === "plane" ? b : {};
      if (flyPick.ti !== ti) flyPick = { ti: ti, dep: cur.dep || null, arr: cur.arr || null };
      var depS = nearAirports(a, airports, 3), arrS = nearAirports(b, airports, 3);
      if (!flyPick.dep && depS[0]) flyPick.dep = depS[0];
      if (!flyPick.arr && arrS[0]) flyPick.arr = arrS[0];
      function group(w, label, near, sugg) {
        var pick = flyPick[w], list = sugg.slice();
        if (pick && !list.some(function (x) { return x.code === pick.code; })) list.unshift(pick);
        return '<div class="apgroup"><div class="aplabel" id="flyl-' + w + '">' + label + ' <span class="muted small">' + esc(near) + '</span></div>' +
          (list.length ? '<div class="chips apchips" role="group" aria-labelledby="flyl-' + w + '">' + list.map(function (x) { return apChip(w, x, pick && pick.code === x.code); }).join("") + '</div>' : "") +
          '<input type="search" autocomplete="off" id="flyq-' + w + '" data-flyq="' + w + '" placeholder="' + (list.length ? "Another airport: code or city" : "Airport code or city, e.g. " + (w === "dep" ? "MCO" : "EDI")) + '" aria-label="' + esc(label) + ': search airports"><div class="results" data-flyres="' + w + '"></div></div>';
      }
      var prev = "";
      if (flyPick.dep && flyPick.arr) {
        var g = T.gcMiles(flyPick.dep, flyPick.arr), air = T.airMinutes(g), gA = T.gcMiles(a, flyPick.dep);
        prev = '<p class="flyprev" id="flyprev"><b>' + esc(flyPick.dep.code) + ' → ' + esc(flyPick.arr.code) + '</b> · ' + esc(dist(g)) + (air ? ' · about ' + esc(T.fmtAir(air)) + ' in the air' : "") + (rt ? ", each way" : "") +
          (gA != null && gA >= T.GROUND_MIN_MI ? '<br><span class="small muted">Plus about ' + esc(dist(gA * T.MODE.car.factor)) + ' by car to ' + esc(flyPick.dep.code) + '</span>' : "") + '</p>';
      }
      box.innerHTML = '<section class="flyask" id="flyask" aria-labelledby="flyh"><h4 id="flyh">✈️ Did you fly? <span>Which airports?</span></h4>' +
        '<p class="small muted">' + (intl ? "This trip goes abroad. " : "") + 'Pick the airports and Famstamp adds the flights, the miles flown and the time in the air.</p>' +
        (airports ? group("dep", "Flew from", "near " + a.name, depS) + group("arr", "Landed at", "near " + b.name, arrS) : '<p class="small muted">Loading airports…</p>') + prev +
        '<div class="actions flyacts"><button type="button" class="btn btn-primary" id="flyyes">✈️ Yes, add the flights</button><button type="button" class="btn btn-ghost" id="flyno">We didn\'t fly</button>' +
        '<button type="button" class="btn btn-ghost" id="flyskip">Skip</button></div></section>';
    }
    function setFly(v) {
      if (v === "yes") {
        var ti = flyPick.ti || flyTarget(), b = d.route[ti];
        if (!flyPick.dep || !flyPick.arr) return A_.toast("Pick both airports, or tap Skip");
        if (flyPick.dep.code === flyPick.arr.code) return A_.toast("Those are the same airport");
        b.mode = "plane"; b.dep = { code: flyPick.dep.code, name: flyPick.dep.name, city: flyPick.dep.city, country: flyPick.dep.country, lat: flyPick.dep.lat, lon: flyPick.dep.lon };
        b.arr = { code: flyPick.arr.code, name: flyPick.arr.name, city: flyPick.arr.city, country: flyPick.arr.country, lat: flyPick.arr.lat, lon: flyPick.arr.lon };
        // home again: the first leg backwards covers it; a flight later in the trip flies home from the same airport
        d.back = ti > 1 ? { mode: "plane", dep: b.arr, arr: b.dep } : null;
        A_.toast("Flights added ✈️");
      } else if (v === "no") {
        d.route.forEach(function (p, i) { if (i && p.mode === "plane") { p.mode = "car"; delete p.dep; delete p.arr; } });
        d.back = null;
      }
      fly = v; flyOpen = false; renderRoute();
      var f = v === "yes" ? $("#flydone") : $("#flyedit"); if (f && f.scrollIntoView) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    }
    $("#bfly").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.id === "flyyes") setFly("yes");
      else if (b.id === "flyno") setFly("no");
      else if (b.id === "flyskip") setFly("skip");
      else if (b.id === "flyedit") { flyOpen = true; flyPick.ti = 0; renderFly(); var q = $("#flyask"); if (q && q.scrollIntoView) q.scrollIntoView({ block: "nearest" }); }
      else if (b.dataset.flyap) {
        var w = b.dataset.flyap, ti = flyPick.ti, near = nearAirports(w === "dep" ? d.route[ti - 1] : d.route[ti], airports, 3).concat(flyPick[w] ? [flyPick[w]] : []);
        flyPick[w] = near.filter(function (x) { return x.code === b.dataset.code; })[0] || flyPick[w]; renderFly();
        var again = $('[data-flyap="' + w + '"][data-code="' + b.dataset.code + '"]'); if (again) again.focus();
      }
    });
    $("#bfly").addEventListener("input", function (e) {
      var el = e.target, w = el.dataset.flyq; if (!w || !airports) return;
      var box = $('[data-flyres="' + w + '"]');
      if (el.value.trim().length < 2) { box.innerHTML = ""; return; }
      showResults(box, searchAirports(el.value, airports).map(function (a) { return { label: a.code + " · " + a.city, sub: a.name, a: a }; }), function (x) {
        if (!x) return; var o = airportObj(x.a), ref = w === "dep" ? d.route[flyPick.ti - 1] : d.route[flyPick.ti], g = T.gcMiles(ref, o); if (g != null) o.away = Math.round(g);
        flyPick[w] = o; renderFly();
      });
    });
    function addPoint(p) {
      var c = T.cleanPoint(p, d.route.length === 0); if (!c) return;
      if (d.route.length >= T.MAX_POINTS) { A_.toast("That's the most stops one trip can hold (" + T.MAX_POINTS + ")"); return; }
      if (d.route.length) { c.mode = guessMode(d.route[d.route.length - 1], c); if (c.mode === "plane") fillAirports(d.route[d.route.length - 1], c); }
      d.route.push(c); search.value = ""; results.innerHTML = ""; renderRoute();
    }
    function guessMode(a, b) { var g = T.gcMiles(a, b); return g == null ? "car" : g > 600 || (a.country && b.country && a.country !== b.country && g > 300) ? "plane" : "car"; }
    function fillAirports(a, b) { if (!airports) return; if (!b.dep) { var x = nearestAirport(a, airports); if (x) b.dep = x; } if (!b.arr) { var y = nearestAirport(b, airports); if (y) b.arr = y; } }
    function showResults(box, list, onPick, custom) {
      box.innerHTML = list.map(function (p, i) { return '<button type="button" role="option" data-pick="' + i + '"><b>' + esc(p.label || p.name) + '</b><span>' + esc(p.sub || "") + '</span></button>'; }).join("") +
        (custom ? '<button type="button" role="option" data-pick="custom" class="custom">➕ Use “' + esc(custom) + '” as our own place<span>For a cabin, a beach or anywhere not on the list</span></button>' : "");
      $$("[data-pick]", box).forEach(function (b) { b.onclick = function () { onPick(b.dataset.pick === "custom" ? null : list[+b.dataset.pick]); }; });
    }
    search.addEventListener("input", function () {
      var q = search.value.trim();
      if (q.length < 2) { results.innerHTML = ""; return; }
      if (!places) { results.innerHTML = '<p class="small muted">Loading places…</p>'; loadPlaces().then(function (x) { places = x; search.dispatchEvent(new Event("input")); }).catch(function () { showResults(results, [], function () { addPoint({ name: q, kind: "place" }); }, q); }); return; }
      showResults(results, searchPlaces(q, places), function (p) { addPoint(p || { name: q, kind: "place" }); if (!p) A_.toast("Added. Tap 📍 to put it on the map, or type the real miles."); }, q);
    });
    search.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var b = $("[data-pick]", results); if (b) b.click(); } });
    routeEl.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.mode) { var i = +b.closest(".leg").dataset.i, p = d.route[i]; p.mode = b.dataset.mode; if (p.mode === "plane") { fillAirports(d.route[i - 1], p); fly = "yes"; flyOpen = false; } else { delete p.dep; delete p.arr; if (!planes()) d.back = null; } renderRoute(); }
      else if (b.dataset.ni) { var q = d.route[+b.dataset.ni]; q.nights = Math.max(0, Math.min(366, (q.nights || 0) + (+b.dataset.n))); renderRoute(); }
      else if (b.dataset.rm) { d.route.splice(+b.dataset.rm, 1); if (d.route[0]) { delete d.route[0].mode; delete d.route[0].miles; delete d.route[0].dep; delete d.route[0].arr; } if (!planes()) d.back = null; flyPick.ti = 0; renderRoute(); }
      else if (b.dataset.realmi) { var box = $('[data-mi="' + b.dataset.realmi + '"]', routeEl); box.hidden = false; $("input", box).focus(); }
      else if (b.dataset.clearmi) { delete d.route[+b.dataset.clearmi].miles; renderRoute(); }
      else if (b.dataset.locate) { var l = $('[data-loc="' + b.dataset.locate + '"]', routeEl); l.hidden = !l.hidden; if (!l.hidden) $("input", l).focus(); }
    });
    routeEl.addEventListener("change", function (e) {
      var el = e.target;
      if (el.dataset.miles) { var v = parseFloat(el.value), p = d.route[+el.dataset.miles]; if (isFinite(v) && v >= 0) p.miles = Math.round((units() === "km" ? v / T.KM_PER_MI : v) * 10) / 10; else delete p.miles; renderRoute(); }
      if (el.id === "thome") saveHome = el.checked;
    });
    routeEl.addEventListener("input", function (e) {
      var el = e.target;
      if (el.dataset.ap) {
        var i = +el.dataset.i, w = el.dataset.ap, box = $('[data-apres="' + w + i + '"]', routeEl);
        if (!airports) { loadAirports().then(function (x) { airports = x; el.dispatchEvent(new Event("input", { bubbles: true })); }).catch(function () {}); return; }
        if (!el.value.trim()) { delete d.route[i][w]; renderRoute(); return; }
        showResults(box, searchAirports(el.value, airports).map(function (a) { return { label: a.code + " · " + a.city, sub: a.name, a: a }; }), function (x) { if (x) { d.route[i][w] = airportObj(x.a); fly = "yes"; flyPick.ti = 0; renderRoute(); } });
      }
      if (el.dataset.near) {
        var j = +el.dataset.near, box2 = $('[data-nearres="' + j + '"]', routeEl), m = el.value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
        var opts = [];
        if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) opts.push({ label: "Pin it at " + (+m[1]).toFixed(3) + ", " + (+m[2]).toFixed(3), sub: "Latitude, longitude", ll: [+m[1], +m[2]] });
        else if (places) opts = searchPlaces(el.value, places).filter(function (p) { return p.kind === "city"; }).slice(0, 6).map(function (p) { return { label: "Near " + p.name, sub: p.sub, p: p }; });
        showResults(box2, opts, function (x) {
          if (!x) return; var pt = d.route[j];
          if (x.ll) { pt.lat = x.ll[0]; pt.lon = x.ll[1]; }
          else { pt.lat = x.p.lat; pt.lon = x.p.lon; pt.country = x.p.country; if (x.p.region) pt.region = x.p.region; pt.near = x.p.name; pt.sub = "near " + x.p.name + ", " + x.p.sub; }
          renderRoute();
        });
      }
    });
    $("#tround").onchange = function () { d.roundTrip = this.checked; if (!this.checked) d.back = null; renderRoute(); };
    renderRoute();

    // stays, favorites, moments
    function starsInput(path, n) {
      return '<span class="starsin" role="group" aria-label="Rating">' + [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" data-star="' + path + '" data-v="' + v + '" aria-pressed="' + (v <= (n || 0)) + '" aria-label="' + v + ' star' + (v > 1 ? "s" : "") + '">★</button>'; }).join("") + '</span>';
    }
    function renderStays() {
      $("#bstays").innerHTML = d.stays.map(function (s, i) {
        return '<div class="item" data-stay="' + i + '"><div class="fields"><div class="field"><label>Name</label><input type="text" maxlength="80" data-sf="name" value="' + esc(s.name || "") + '" placeholder="e.g. The Highland Inn"></div>' +
          '<div class="field"><label>Type</label><select data-sf="type">' + T.STAY_TYPES.map(function (x) { return '<option value="' + x.id + '"' + (x.id === s.type ? " selected" : "") + '>' + x.ic + ' ' + esc(x.label) + '</option>'; }).join("") + '</select></div>' +
          '<div class="field"><label>Nights</label><input type="number" inputmode="numeric" min="0" max="366" data-sf="nights" value="' + (s.nights != null ? s.nights : "") + '"></div>' +
          (d.route.length > 1 ? '<div class="field"><label>Where</label><select data-sf="where"><option value="">Somewhere on the way</option>' + d.route.slice(1).map(function (p) { return p.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).concat(s.where && !d.route.some(function (p) { return p.name === s.where; }) ? [s.where] : [])
            .map(function (n) { return '<option' + (n === s.where ? " selected" : "") + '>' + esc(n) + '</option>'; }).join("") + '</select></div>' : "") + '</div>' +
          '<div class="field"><label>How was it?</label>' + starsInput("stay." + i, s.rating) + '</div>' +
          '<div class="field"><input type="text" maxlength="140" data-sf="note" value="' + esc(s.note || "") + '" placeholder="A note (optional): the view, the pool, the creaky stairs" aria-label="Note"></div>' +
          '<button type="button" class="linkbtn sm danger" data-rmstay="' + i + '">Remove</button></div>';
      }).join("");
      $("#dstays .cnt").textContent = d.stays.length ? "(" + d.stays.length + ")" : "";
      $("#addstay").hidden = d.stays.length >= T.MAX_STAYS;
    }
    function renderFavs() {
      var grown = adultOn(kidIds());
      $("#bfavs").innerHTML = d.favs.map(function (f, i) {
        var c = T.FAV[f.cat]; if (c.adult && !grown) return "";
        return '<div class="item fav' + (c.adult ? " adult" : "") + '" data-fav="' + i + '"><div class="favcat">' + c.ic + ' ' + esc(c.label) + (c.adult ? ' <span class="tag">grown-ups</span>' : "") + '</div>' +
          '<div class="fields"><div class="field"><label>Name</label><input type="text" maxlength="80" data-ff="name" value="' + esc(f.name || "") + '" placeholder="' + esc(favHint(f.cat)) + '"></div>' +
          '<div class="field"><label>Where <span class="muted small">(optional)</span></label><input type="text" maxlength="60" data-ff="where" value="' + esc(f.where || "") + '" placeholder="Town or stop"></div></div>' +
          '<div class="field">' + starsInput("fav." + i, f.rating) + '</div>' +
          '<div class="field"><input type="text" maxlength="140" data-ff="note" value="' + esc(f.note || "") + '" placeholder="Why it was the best (optional)" aria-label="Note"></div>' +
          '<button type="button" class="linkbtn sm danger" data-rmfav="' + i + '">Remove</button></div>';
      }).join("");
      $("#favadd").innerHTML = '<p class="small muted">Add a favorite:</p><div class="chips">' + T.FAV_CATS.filter(function (c) { return !c.adult || grown; }).map(function (c) {
        return '<button type="button" class="chip addfav' + (c.adult ? " adult" : "") + '" data-addfav="' + c.id + '">' + c.ic + ' ' + esc(c.short) + '</button>'; }).join("") + '</div>' +
        (grown ? "" : '<p class="small muted">Pub, pint and coffee picks show up when a grown-up is on the trip.</p>');
      $("#dfavs .cnt").textContent = d.favs.length ? "(" + d.favs.length + ")" : "";
    }
    function favHint(cat) { return { restaurant: "e.g. The Fish Shack", activity: "e.g. Loch Ness boat ride", treat: "e.g. Mint chip at Mo's", pub: "e.g. The Clachaig Inn", drink: "e.g. Cuillin Pale Ale", coffee: "e.g. Sweet Pea Café" }[cat] || ""; }
    function renderMoments() {
      var ids = kidIds();
      $("#bmoments").innerHTML = people(ids).map(function (p) {
        return '<div class="field"><label for="mo-' + esc(p.id) + '" style="' + A_.kidStyle(p) + '"><span class="dotp" aria-hidden="true">' + A_.initial(p.name) + '</span> ' + esc(p.name) + '\'s favorite moment</label>' +
          '<input id="mo-' + esc(p.id) + '" type="text" maxlength="280" data-moment="' + esc(p.id) + '" value="' + esc((d.moments || {})[p.id] || "") + '" placeholder="' + (M.isKid(p) ? "e.g. Seeing a real castle!" : "e.g. The sunset on the ferry") + '"></div>';
      }).join("") || '<p class="small muted">Check who went first.</p>';
    }
    var panel = $(".builder");
    panel.addEventListener("input", function (e) {
      var el = e.target, it;
      if (el.dataset.sf && (it = el.closest("[data-stay]"))) { var s = d.stays[+it.dataset.stay]; s[el.dataset.sf] = el.dataset.sf === "nights" ? (el.value === "" ? null : +el.value) : el.value; }
      if (el.dataset.ff && (it = el.closest("[data-fav]"))) d.favs[+it.dataset.fav][el.dataset.ff] = el.value;
      if (el.dataset.moment) { d.moments = d.moments || {}; d.moments[el.dataset.moment] = el.value; }
    });
    panel.addEventListener("change", function (e) { if (e.target.dataset.sf === "type" || e.target.dataset.sf === "where") d.stays[+e.target.closest("[data-stay]").dataset.stay][e.target.dataset.sf] = e.target.value; if (e.target.name === "kids") { renderFavs(); renderMoments(); } });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.star) { var pp = b.dataset.star.split("."), list = pp[0] === "stay" ? d.stays : d.favs, o = list[+pp[1]], v = +b.dataset.v; o.rating = o.rating === v ? 0 : v; pp[0] === "stay" ? renderStays() : renderFavs(); }
      if (b.dataset.rmstay) { d.stays.splice(+b.dataset.rmstay, 1); renderStays(); }
      if (b.dataset.rmfav) { d.favs.splice(+b.dataset.rmfav, 1); renderFavs(); }
      if (b.dataset.addfav) { if (d.favs.length >= T.MAX_FAVS) return A_.toast("That's plenty of favorites for one trip!"); d.favs.push({ cat: b.dataset.addfav, name: "" }); renderFavs(); var ins = $$("#bfavs [data-ff=name]"); if (ins.length) ins[ins.length - 1].focus(); }
      if (b.id === "addstay") { var last = d.route[d.route.length - 1]; d.stays.push({ name: "", type: "hotel", nights: null, where: last && d.route.length > 1 ? last.name : "" }); renderStays(); var si = $$("#bstays [data-sf=name]"); si[si.length - 1].focus(); }
    });
    renderStays(); renderFavs(); renderMoments();
    var tall = $("#tall"); if (tall) tall.onclick = function () { $$("input[name=kids]").forEach(function (c) { c.checked = true; }); renderFavs(); renderMoments(); };
    var end = $("#tend"), done = $("#tdone");
    end.onchange = function () { if (end.value && end.value <= M.today()) done.checked = true; };

    // photo
    var prev = $("#tprev");
    if (d.photoId) A_.photoURL(d.photoId).then(function (u) { if (u) { prev.src = u; prev.hidden = false; } });
    $("#tphoto").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      A_.shrinkPhoto(f).then(function (x) { newPhoto = x; removePhoto = false; prev.src = x; prev.hidden = false; })
        .catch(function (er) { var el = $("#terr"); el.textContent = er.message; el.hidden = false; });
    };
    var rmp = $("#trmphoto"); if (rmp) rmp.onclick = function () { removePhoto = true; newPhoto = null; prev.hidden = true; rmp.hidden = true; };

    // save
    $("#tsave").onclick = function () {
      var err = $("#terr"); err.hidden = true;
      var ids = kidIds(), mv = $("#tmark").value, jobs = [];
      if (!d.route.length) { err.textContent = "Add where you went (type a town or park above)."; err.hidden = false; search.focus(); return; }
      var photoId = d.photoId || null;
      if (removePhoto && photoId) { jobs.push(A_.del("photos", photoId)); photoId = null; }
      if (newPhoto) { if (photoId) jobs.push(A_.del("photos", photoId)); photoId = M.uid("photo"); }
      var nightsV = $("#tnights").value, title = $("#ttitle").value.trim();
      var before = stampKeys(ids), grown = adultOn(ids), trip;
      try {
        var made = M.newTrip({ id: old ? old.id : undefined, createdAt: old ? old.createdAt : undefined, kidIds: ids,
          place: title || (d.route[d.route.length - 1] || {}).name, route: d.route, title: title, date: $("#tdate").value, endDate: end.value,
          nights: end.value ? null : (nightsV === "" ? null : +nightsV), roundTrip: d.route.length > 1 && $("#tround").checked, done: done.checked,
          fly: fly, back: $("#tround").checked ? d.back : null, stays: d.stays, favs: d.favs.filter(function (f) { return grown || !T.FAV[f.cat].adult; }), moments: d.moments, story: d.story, memories: memVals(),
          who: $("#twho").value, memory: $("#tmem").value, mark: mv ? { kind: mv.split(":")[0], id: mv.split(":")[1] } : null, photoId: photoId });
        trip = Object.assign(old ? copy(old) : {}, made);
      } catch (x) { err.textContent = x.message; err.hidden = false; return; }
      if (trip.endDate && trip.endDate <= M.today()) trip.done = true;
      if (newPhoto) jobs.push(A_.put("photos", { id: photoId, dataUrl: newPhoto }));
      A_.clearPhotos();
      var changedIds = M.applyTripMark(trip, st.kids) || [];
      st.kids.forEach(function (x) { if (trip.kidIds.indexOf(x.id) >= 0 && changedIds.indexOf(x.id) >= 0) { x.updatedAt = new Date().toISOString(); jobs.push(A_.saveKid(x)); } });
      jobs.push(A_.put("trips", trip));
      st.trips = st.trips.filter(function (x) { return x.id !== trip.id; }).concat([trip]);
      var first = trip.route[0];
      if (!old && first && saveHome && $("#thome") && $("#thome").checked) { jobs.push(A_.setMeta("home", first.name)); if (T.hasLoc(first)) jobs.push(A_.setMeta("homePoint", T.cleanPoint(first, true))); }
      var fresh = newStamps(before, ids);
      Promise.all(jobs).then(function () {
        location.hash = "#/p/" + (trip.kidIds.indexOf(k.id) >= 0 ? k.id : trip.kidIds[0]) + "/trip/" + trip.id;
        A_.toast(old ? "Trip saved" : "Trip added!");
        if (fresh.length) setTimeout(function () { celebrate(fresh); }, 350);
      }).catch(function () { err.textContent = "Couldn't save. Is the device out of space?"; err.hidden = false; });
    };
    var del = $("#tdel");
    if (del) del.onclick = function () {
      if (!confirm("Delete this trip? The map stays colored in.")) return;
      var jobs = [A_.del("trips", old.id)]; if (old.photoId) jobs.push(A_.del("photos", old.photoId));
      st.trips = st.trips.filter(function (x) { return x.id !== old.id; });
      Promise.all(jobs).then(function () { location.hash = "#/p/" + k.id + "/trips"; A_.toast("Trip deleted"); });
    };
  }
  function unitToggle() {
    return '<span class="units seg sm" role="group" aria-label="Units"><button type="button" data-units="mi" aria-pressed="' + (units() === "mi") + '">mi</button><button type="button" data-units="km" aria-pressed="' + (units() === "km") + '">km</button></span>';
  }
  function bindUnits(root, again) { $$("[data-units]", root).forEach(function (b) { b.onclick = function () { A().setMeta("units", b.dataset.units).then(again); }; }); }

  // ---------- trip page ----------
  function order(t) { return (t.date || "9999") + (t.createdAt || ""); }
  function group(list, key) {   // [{who, ...}] with the same key -> one entry with the names joined
    var by = {}, out = [];
    list.forEach(function (x) { var k = key(x); if (by[k]) by[k].names.push(x.who); else { by[k] = Object.assign({}, x, { names: [x.who] }); out.push(by[k]); } });
    return out.map(function (x) { x.who = M.joinNames(x.names); return x; });
  }
  /** Countries, UK nations and parks this trip was someone's first time in. */
  function firstsFor(t) {
    var out = [], mine = T.areas(t, M.PARK_STATES).filter(function (a) { return a.kind !== "state"; });
    people(t.kidIds).forEach(function (p) {
      var seen = {};
      S().trips.forEach(function (o) { if (o.id !== t.id && o.kidIds.indexOf(p.id) >= 0 && order(o) < order(t)) T.areas(o, M.PARK_STATES).forEach(function (a) { seen[a.kind + a.id] = 1; }); });
      (p.stamps || []).forEach(function (s) { if (s.date && t.date && s.date < t.date) seen[s.kind + s.area] = 1; });
      mine.forEach(function (a) {
        if (seen[a.kind + a.id]) return;
        var v = (a.kind === "park" ? p.parks : p.places) || {}; v = v[a.id];
        if (v && v.at && t.date && v.at < t.date) return;
        out.push({ who: p.name, what: a.kind === "park" ? parkName(a.id) + " National Park" : areaName("place", a.id), kind: a.kind === "park" ? "park" : "country" });
      });
    });
    return group(out, function (x) { return x.what; });
  }
  /** Miles badges this trip earned (1,000 miles, first flight...). */
  function badgesFor(t) {
    var out = [];
    people(t.kidIds).forEach(function (p) {
      var before = S().trips.filter(function (o) { return o.id !== t.id && o.kidIds.indexOf(p.id) >= 0 && order(o) < order(t); });
      var a = T.lifetime(null, before), b = T.lifetime(null, before.concat([t]));
      M.BADGES.forEach(function (bd) { if (["miles", "flights", "flightMiles", "bigRoad"].indexOf(bd.key) >= 0 && a[bd.key] < bd.need && b[bd.key] >= bd.need) out.push({ who: p.name, name: bd.name }); });
    });
    return group(out, function (x) { return x.name; });
  }
  function storyCtx(t, viewer) {
    return { travelers: people(t.kidIds), units: units(), allowAdult: T.showAdult(t, S().kids, viewer, !!S().meta.adultInKid),
             firsts: firstsFor(t), badges: badgesFor(t), familyName: S().meta.familyName || "" };
  }
  function storyText(t, viewer, style, seed) { return T.makeStory(t, storyCtx(t, viewer), { style: style, seed: seed }).text; }
  function canStory(t) { return !!(t.done || (t.endDate && t.endDate <= M.today())); }
  function saveTrip(t) { T.fitSize(t); t.updatedAt = new Date().toISOString(); return A().put("trips", t); }

  function detail(k, tid) {
    var A_ = A(), t = tripById(tid);
    if (!t) { location.hash = "#/p/" + k.id + "/trips"; return; }
    stopSpeech();
    var s = T.summary(t), allow = T.showAdult(t, S().kids, k, !!S().meta.adultInKid), favs = T.visibleFavs(t, S().kids, k, !!S().meta.adultInKid);
    var grownTrip = adultOn(t.kidIds), hiddenAdult = grownTrip && !allow && (t.favs || []).some(function (f) { return T.FAV[f.cat].adult; });
    document.title = t.place + " · Famstamp";
    var nightsTxt = s.nights != null ? s.nights + (s.nights === 1 ? " night" : " nights") : "";
    var html = '<a class="back" href="#/p/' + esc(k.id) + '/trips">← All trips</a><article class="scrap">' +
      '<header class="scraphead">' + (t.photoId ? '<img class="polaroid" alt="" data-photo="' + esc(t.photoId) + '">' : "") +
      '<div><h2 class="ttl">' + esc(t.place) + '</h2><p class="when">' + esc([dateRange(t), nightsTxt].filter(Boolean).join(" · ")) + '</p>' +
      '<div class="travelers"><span class="dots">' + A_.avatars(t.kidIds) + '</span><span>' + esc(A_.travelerNames(t.kidIds)) + (t.who ? ", plus " + esc(t.who) : "") + '</span></div></div></header>' +
      (s.legs.length ? '<p class="routeline">' + t.route.map(function (p) { return esc(p.name); }).join(' <span aria-hidden="true">→</span> ') + (t.roundTrip ? ' <span aria-hidden="true">→</span> home' : "") +
        ' · <b>' + (s.milesKnown ? "" : "at least ") + esc(dist(s.miles, true)) + '</b> ' + unitToggle() + '</p>' : "") +
      (T.routeMap(t) ? '<div class="mapbox routebox">' + routeSVG(t) + '</div>' : (s.legs.length ? '<p class="hint">Find each stop on the map (Edit) to see the route drawn here.</p>' : "")) +
      '<h3 class="sec">Trip stats</h3><div class="tstats">' + tstat("🧭", dist(s.miles), s.milesKnown || !s.legs.length ? "traveled" : "so far") +
      (s.flights ? tstat("✈️", s.flights, s.flights === 1 ? "flight" : "flights") + (s.flightMiles ? tstat("🛫", dist(s.flightMiles), "flown") : "") + (s.airMin ? tstat("⏱️", "~" + T.fmtAir(s.airMin), "in the air") : "") : "") + (s.roadMiles ? tstat("🚗", dist(s.roadMiles), "on the road") : "") +
      (s.nights != null ? tstat("🌙", s.nights, s.nights === 1 ? "night" : "nights") : "") + (s.cities.length ? tstat("🏙️", s.cities.length, s.cities.length === 1 ? "town or city" : "towns & cities") : "") +
      (s.parks.length ? tstat("🌲", s.parks.length, s.parks.length === 1 ? "national park" : "national parks") : "") + (s.states.length ? tstat("🇺🇸", s.states.length, s.states.length === 1 ? "state" : "states") : "") +
      (s.countries.length ? tstat("🌍", s.countries.length, s.countries.length === 1 ? "country" : "countries") : "") + (s.ukNations.length ? tstat("🇬🇧", s.ukNations.length, "UK " + (s.ukNations.length === 1 ? "nation" : "nations")) : "") + '</div>' +
      (s.legs.length ? '<h3 class="sec">The way we went</h3><ol class="legs">' + s.legs.map(function (L) {
        var how = L.how === "manual" ? "real miles" : L.how === "flight" ? "flying distance" : L.how === "about" ? "about" : "";
        var gnd = [L.toAp ? "~" + dist(L.toAp) + " by car to " + (L.dep ? L.dep.code : "the airport") : "", L.fromAp ? "~" + dist(L.fromAp) + " by car from " + (L.arr ? L.arr.code : "the airport") : ""].filter(Boolean);
        return '<li><span class="lic" aria-hidden="true">' + modeIc(L.mode) + '</span><div><b>' + esc(L.from) + ' → ' + esc(L.home ? L.to + " (home)" : L.to) + '</b><span>' + esc([MODE_LABEL[L.mode], L.dep && L.arr ? L.dep.code + " → " + L.arr.code : "", how, L.air ? "about " + T.fmtAir(L.air) + " in the air" : ""].filter(Boolean).join(" · ")) + '</span>' +
          (gnd.length ? '<span class="gnd">🚗 ' + esc(gnd.join(" · ")) + '</span>' : "") + '</div>' +
          '<b class="lmi">' + (L.how === "about" ? "~" : "") + esc(dist(L.miles)) + '</b></li>'; }).join("") + '</ol>' : "") +
      seenBlock(t, s) +
      ((t.stays || []).length ? '<h3 class="sec">Where we stayed</h3><div class="cards">' + t.stays.map(function (x) {
        var ty = T.STAY_TYPES.filter(function (y) { return y.id === x.type; })[0] || T.STAY_TYPES[0];
        return '<div class="card stay"><span class="cic" aria-hidden="true">' + ty.ic + '</span><div><b>' + esc(x.name) + '</b><span class="meta">' + esc([ty.label, x.where, x.nights ? x.nights + (x.nights === 1 ? " night" : " nights") : ""].filter(Boolean).join(" · ")) + '</span>' + stars(x.rating) + (x.note ? '<p>' + esc(x.note) + '</p>' : "") + '</div></div>'; }).join("") + '</div>' : "") +
      favBlock(favs.filter(function (f) { return !T.FAV[f.cat].adult; }), "Favorites", "") +
      favBlock(favs.filter(function (f) { return T.FAV[f.cat].adult; }), "🍻 For the grown-ups", " adultbox") +
      (hiddenAdult ? '<p class="small muted adultnote">The grown-ups\' picks (pub, pint, coffee) are hidden on kids\' pages. <button type="button" class="linkbtn sm" data-adultkid="1">Show them here too</button></p>' : "") +
      (grownTrip && !T.isAdult(k) && S().meta.adultInKid && (t.favs || []).some(function (f) { return T.FAV[f.cat].adult; }) ? '<p class="small muted adultnote"><button type="button" class="linkbtn sm" data-adultkid="0">Hide grown-up picks on kids\' pages</button></p>' : "") +
      momentsBlock(t) + storyBlock(t) +
      '<div class="actions noprint"><a class="btn btn-primary" href="#/p/' + esc(k.id) + '/trips/edit/' + esc(t.id) + '">Edit trip</a><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/passport">🛂 Passport</a></div>' + syncExtra(t) + '</article>';
    A_.main.innerHTML = A_.shell(k, "trips", html);
    A_.fillPhotos();
    bindUnits(A_.main, function () { detail(k, tid); });
    $$("[data-adultkid]").forEach(function (b) { b.onclick = function () { A_.setMeta("adultInKid", b.dataset.adultkid === "1").then(function () { detail(k, tid); }); }; });
    bindStory(k, t);
  }
  function tstat(ic, v, label) { return '<div class="tstat"><span aria-hidden="true">' + ic + '</span><b>' + esc(String(v)) + '</b><small>' + esc(label) + '</small></div>'; }
  function seenBlock(t, s) {
    var chips = [];
    s.cities.forEach(function (c) { chips.push(["🏙️", c]); });
    s.parks.forEach(function (p) { chips.push(["🌲", PARK_BY[p] ? parkName(p) : p]); });
    s.states.forEach(function (x) { chips.push(["📍", areaName("state", x)]); });
    s.ukNations.forEach(function (x) { chips.push([P.flag("place", x) || "🇬🇧", areaName("place", x)]); });
    s.countries.forEach(function (x) { if (x !== "GBR" || !s.ukNations.length) chips.push([P.flag("place", x) || "🌍", areaName("place", x)]); });
    return chips.length ? '<h3 class="sec">What we saw</h3><div class="seen">' + chips.map(function (c) { return '<span class="seenchip"><span aria-hidden="true">' + c[0] + '</span> ' + esc(c[1]) + '</span>'; }).join("") + '</div>' : "";
  }
  function favBlock(list, title, cls) {
    if (!list.length) return "";
    return '<div class="favs' + cls + '"><h3 class="sec">' + esc(title) + '</h3><div class="cards">' + list.map(function (f) {
      var c = T.FAV[f.cat];
      return '<div class="card fav"><span class="cic" aria-hidden="true">' + c.ic + '</span><div><span class="meta up">' + esc(c.label) + '</span><b>' + esc(f.name) + '</b>' + (f.where ? '<span class="meta">' + esc(f.where) + '</span>' : "") + stars(f.rating) + (f.note ? '<p>' + esc(f.note) + '</p>' : "") + '</div></div>';
    }).join("") + '</div></div>';
  }
  function memoriesHTML(t) {
    var m = t.memories || {}, rows = T.MEM_PROMPTS.filter(function (p) { return m[p[0]]; });
    if (!rows.length && !t.memory) return "";
    return '<div class="tripmem">' + (t.memory ? '<div class="tmnote"><span class="tmq">📝 Notes</span><p>' + esc(t.memory) + '</p></div>' : "") +
      rows.map(function (p) { return '<div class="tmrow"><span class="tmq">' + p[2] + ' ' + esc(p[1]) + '</span><p>' + esc(m[p[0]]) + '</p></div>'; }).join("") + '</div>';
  }
  function momentsBlock(t) {
    var A_ = A(), m = t.moments || {}, list = people(t.kidIds).filter(function (p) { return m[p.id]; }), mem = memoriesHTML(t);
    if (!list.length && !mem) return "";
    return '<h3 class="sec">Trip memories</h3>' + mem + (!list.length ? "" : '<div class="moments">' + list.map(function (p) {
      return '<blockquote style="' + A_.kidStyle(p) + '"><p>“' + esc(m[p.id]) + '”</p><cite><span class="dotp" aria-hidden="true">' + A_.initial(p.name) + '</span> ' + esc(p.name) + '</cite></blockquote>'; }).join("") +
      '</div>');
  }

  // ---------- the story ----------
  function storyBlock(t) {
    if (!canStory(t)) return '<section class="panel story locked"><h3>📖 Our story</h3><p class="muted small">When you\'re home, Famstamp can tell this trip\'s story and read it out loud.</p>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" id="markdone">We\'re home: tell our story</button></div></section>';
    return '<section class="panel story" id="story"><h3>📖 Our story</h3>' +
      '<div class="seg" role="group" aria-label="Story style"><button type="button" data-style="storybook">Storybook</button><button type="button" data-style="journal">Family journal</button></div>' +
      '<div class="slides" id="slides" aria-hidden="true"></div>' +
      '<div class="storytext" id="stext"></div><div id="sedit" hidden><textarea id="stextarea" maxlength="3000" aria-label="Edit the story"></textarea>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="ssave">Save my version</button><button type="button" class="btn btn-ghost" id="scancel">Cancel</button></div></div>' +
      '<div class="player" id="player"><button type="button" class="btn btn-beacon" id="splay">▶ Read it to us</button><button type="button" class="btn btn-ghost" id="spause" hidden>⏸ Pause</button><button type="button" class="btn btn-ghost" id="sstop" hidden>⏹ Stop</button></div>' +
      '<div class="voicebar" id="voicebar"><label>Voice <select id="svoice"></select></label><label>Speed <select id="srate">' + [["0.8", "Slow"], ["0.9", "Easy"], ["1", "Normal"], ["1.15", "Quick"]].map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join("") + '</select></label></div>' +
      '<p class="small muted" id="snospeech" hidden>Read-aloud isn\'t available in this browser, but the story is all here to read.</p>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" id="sshuffle">🔀 Shuffle</button><button type="button" class="btn btn-ghost" id="sedit-b">✏️ Edit</button><button type="button" class="btn btn-ghost" id="sshare">📤 Share story</button></div>' +
      '<p class="small muted" id="sedited" hidden>You edited this story. <button type="button" class="linkbtn sm" id="sreset">Go back to Famstamp\'s version</button></p></section>';
  }
  var SP = { on: false, i: 0, list: [], u: null, slides: 0 };
  function synth() { return window.speechSynthesis || null; }
  function stopSpeech() { SP.on = false; SP.u = null; var s = synth(); if (s) try { s.cancel(); } catch (e) {} }
  window.addEventListener("hashchange", stopSpeech);
  function enVoices() { var s = synth(); return s ? s.getVoices().filter(function (v) { return /^en(-|_|$)/i.test(v.lang); }) : []; }
  function bestVoice() {
    var vs = enVoices(), want = S().meta.voice, hit = vs.filter(function (v) { return v.name === want; })[0];
    if (hit) return hit;
    function score(v) { return (/en[-_](GB|US)/i.test(v.lang) ? 2 : 0) + (/natural|neural|enhanced|premium|google|siri|samantha|daniel|serena|aria|jenny|libby/i.test(v.name) ? 3 : 0) + (v.localService ? 0.5 : 0); }
    return vs.slice().sort(function (a, b) { return score(b) - score(a); })[0] || null;
  }
  function bindStory(k, t) {
    var A_ = A(), md = $("#markdone");
    if (md) { md.onclick = function () { t.done = true; saveTrip(t).then(function () { detail(k, t.id); setTimeout(function () { var el = $("#story"); if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); }, 50); }); }; return; }
    if (!$("#story")) return;
    var story = t.story || null, style = story ? story.style : (M.isKid(k) ? "storybook" : "storybook"), seed = story ? story.seed : 0;
    function current() { return story && story.edited && story.style === style ? story.text : storyText(t, k, style, seed); }
    function persist(text, edited) {
      var next = T.cleanStory({ text: text, style: style, seed: seed, edited: edited, at: new Date().toISOString() });
      if (story && next && story.text === next.text && story.style === next.style && story.edited === next.edited) return;
      t.story = story = next; saveTrip(t);
    }
    function render() {
      stopSpeech(); showPlayer(false);
      var text = current();
      if (!story || !story.edited) persist(text, false);
      SP.list = T.splitSentences(text); SP.i = 0;
      $("#stext").innerHTML = SP.list.map(function (x, i) { return '<span class="sn" data-s="' + i + '">' + esc(x) + '</span>'; }).join(" ");
      $$("[data-style]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.style === style); });
      $("#sedited").hidden = !(story && story.edited);
      $$(".sn").forEach(function (el) { el.onclick = function () { if (synth()) speakFrom(+el.dataset.s); }; });
    }
    // slideshow: the trip photo, the route map and a few stat cards, crossfading with the sentences
    var s = T.summary(t), slides = [];
    if (t.photoId) slides.push('<div class="slide photo"><img alt="" data-photo="' + esc(t.photoId) + '"></div>');
    if (T.routeMap(t)) slides.push('<div class="slide map"><div class="mapbox">' + routeSVG(t) + '</div></div>');
    if (s.miles) slides.push(card("🧭", dist(s.miles, true), M.routeText(t)));
    if (s.nights) slides.push(card("🌙", s.nights + (s.nights === 1 ? " night" : " nights"), dateRange(t)));
    var seenN = s.cities.length + s.parks.length;
    if (seenN) slides.push(card(s.parks.length ? "🌲" : "🏙️", seenN + (seenN === 1 ? " place" : " places"), s.cities.concat(s.parks.map(parkName)).slice(0, 6).join(" · ")));
    if (!slides.length) slides.push(card("📖", t.place, dateRange(t)));
    $("#slides").innerHTML = slides.map(function (h, i) { return h.replace('class="slide', 'class="slide' + (i === 0 ? " on" : "")); }).join("");
    SP.slides = slides.length; A_.fillPhotos();
    function card(ic, big, small) { return '<div class="slide card"><span aria-hidden="true">' + ic + '</span><b>' + esc(big) + '</b><small>' + esc(small || "") + '</small></div>'; }

    $$("[data-style]").forEach(function (b) { b.onclick = function () {
      if (b.dataset.style === style) return;
      if (story && story.edited && !confirm("Switch styles? Your edits to this story will be replaced.")) return;
      style = b.dataset.style; if (story) story.edited = false; render(); }; });
    $("#sshuffle").onclick = function () {
      if (story && story.edited && !confirm("Shuffle the story? Your edits will be replaced.")) return;
      seed = (seed + 1 + Math.floor(Math.random() * 997)) % 1e9; if (story) story.edited = false; render(); };
    $("#sedit-b").onclick = function () { stopSpeech(); showPlayer(false); $("#stextarea").value = current(); $("#sedit").hidden = false; $("#stext").hidden = true; $("#stextarea").focus(); };
    $("#scancel").onclick = function () { $("#sedit").hidden = true; $("#stext").hidden = false; };
    $("#ssave").onclick = function () { var v = $("#stextarea").value.trim(); if (!v) return A_.toast("The story can't be empty"); story = story || {}; persist(v, true); $("#sedit").hidden = true; $("#stext").hidden = false; render(); A_.toast("Story saved"); };
    $("#sreset").onclick = function () { if (story) story.edited = false; render(); };
    $("#sshare").onclick = function () { shareStory(t, current()); };
    // read aloud
    var sy = synth();
    if (!sy || typeof window.SpeechSynthesisUtterance !== "function") { $("#player").hidden = true; $("#voicebar").hidden = true; $("#snospeech").hidden = false; }
    else {
      var fillVoices = function () {
        var vs = enVoices(), best = bestVoice(), sel = $("#svoice"); if (!sel) return;
        sel.innerHTML = vs.length ? vs.map(function (v) { return '<option value="' + esc(v.name) + '"' + (best && v.name === best.name ? " selected" : "") + '>' + esc(v.name.replace(/^(Microsoft|Google) /, "") + " (" + v.lang + ")") + '</option>'; }).join("") : '<option value="">Default voice</option>';
      };
      fillVoices(); sy.onvoiceschanged = fillVoices;
      $("#svoice").onchange = function () { A_.setMeta("voice", this.value); };
      $("#srate").value = String(S().meta.rate || 1); if (!$("#srate").value) $("#srate").value = "1";
      $("#srate").onchange = function () { A_.setMeta("rate", +this.value); };
      $("#splay").onclick = function () { speakFrom(SP.i >= SP.list.length ? 0 : SP.i); };
      $("#spause").onclick = function () { SP.on = false; SP.u = null; sy.cancel(); showPlayer(false, true); };
      $("#sstop").onclick = function () { stopSpeech(); SP.i = 0; highlight(-1); showPlayer(false); };
    }
    render();
  }
  function showPlayer(playing, paused) {
    var p = $("#splay"); if (!p) return;
    p.hidden = playing; p.textContent = paused ? "▶ Keep going" : "▶ Read it to us";
    $("#spause").hidden = !playing; $("#sstop").hidden = !playing && !paused;
  }
  function highlight(i) {
    $$(".sn").forEach(function (el) { el.classList.toggle("now", +el.dataset.s === i); });
    var el = $('.sn[data-s="' + i + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    if (i >= 0 && SP.slides > 1) { var n = Math.floor(i / 2) % SP.slides; $$("#slides .slide").forEach(function (s, j) { s.classList.toggle("on", j === n); }); }
  }
  function speakFrom(i) {
    var sy = synth(); if (!sy || !SP.list.length) return;
    sy.cancel(); SP.on = true; SP.i = i; showPlayer(true);
    setTimeout(speakNext, 80);   // Chrome on Android drops a speak() that comes right after cancel()
  }
  function speakNext() {
    var sy = synth(); if (!SP.on || !sy) return;
    if (SP.i >= SP.list.length) { SP.on = false; SP.i = 0; highlight(-1); showPlayer(false); return; }
    var u = new SpeechSynthesisUtterance(SP.list[SP.i]), v = bestVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    u.rate = +(S().meta.rate || 1) || 1;
    u.onend = u.onerror = function () { if (SP.u !== u) return; SP.i++; speakNext(); };
    SP.u = u; highlight(SP.i); sy.speak(u);
  }

  // share: the story as text, plus a picture card of the route and stats when the phone can share files
  function shareStory(t, text) {
    var A_ = A(), title = t.place + ": our Famstamp story", body = text + "\n\nMade with Famstamp";
    storyCard(t).then(function (blob) {
      var data = { title: title, text: body }, file = null;
      try { file = blob && new File([blob], "famstamp-" + M.slug(t.place || "trip") + ".png", { type: "image/png" }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      if (navigator.share) return navigator.share(data).catch(function () {});
      if (navigator.clipboard) navigator.clipboard.writeText(body).catch(function () {});
      if (blob) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file ? file.name : "famstamp-story.png"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
      A_.toast("Story copied, and the picture card is saved");
    });
  }
  function wrap(ctx, text, max) {
    var words = String(text).split(" "), lines = [], line = "";
    words.forEach(function (w) { var tryL = line ? line + " " + w : w; if (ctx.measureText(tryL).width > max && line) { lines.push(line); line = w; } else line = tryL; });
    if (line) lines.push(line); return lines;
  }
  function storyCard(t) {
    return new Promise(function (res) {
      try {
        var W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
        var g = c.getContext("2d"), s = T.summary(t), owner = A().kidById(t.kidIds[0]), color = owner ? owner.color : "#e8a54b";
        g.fillStyle = "#f7f3ea"; g.fillRect(0, 0, W, H);
        g.fillStyle = "#16283a"; g.fillRect(0, 0, W, 150);
        g.fillStyle = "#e8a54b"; g.font = "700 54px Georgia, serif"; g.fillText("Famstamp", 70, 98);
        g.fillStyle = "#c9d5e2"; g.font = "500 30px sans-serif"; g.textAlign = "right"; g.fillText("Stamp every trip", W - 70, 96); g.textAlign = "left";
        g.fillStyle = "#16283a"; g.font = "700 76px Georgia, serif";
        var y = 270; wrap(g, t.place, W - 140).slice(0, 2).forEach(function (l) { g.fillText(l, 70, y); y += 86; });
        g.fillStyle = "#5b6b73"; g.font = "500 34px sans-serif"; g.fillText([dateRange(t), A().travelerNames(t.kidIds)].filter(Boolean).join(" · ").slice(0, 60), 70, y); y += 40;
        // route box
        var bx = 70, by = y + 20, bw = W - 140, bh = 560, pts = (t.route || []).filter(T.hasLoc);
        g.fillStyle = "#dfeef2"; g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, 28); else g.rect(bx, by, bw, bh); g.fill();
        if (pts.length > 1) {
          var lat0 = pts.reduce(function (a, p) { return a + p.lat; }, 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
          var xs = pts.map(function (p) { return p.lon * k; }), ys = pts.map(function (p) { return -p.lat; });
          var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs), mny = Math.min.apply(null, ys), mxy = Math.max.apply(null, ys);
          var sc = Math.min((bw - 160) / Math.max(mxx - mnx, 0.01), (bh - 160) / Math.max(mxy - mny, 0.01));
          var ox = bx + bw / 2 - (mnx + mxx) / 2 * sc, oy = by + bh / 2 - (mny + mxy) / 2 * sc;
          var P2 = pts.map(function (p, i) { return [xs[i] * sc + ox, ys[i] * sc + oy]; });
          g.strokeStyle = "#16283a"; g.lineWidth = 7; g.lineCap = "round"; g.setLineDash([]);
          for (var i = 1; i < P2.length; i++) {
            var plane = pts[i].mode === "plane"; g.setLineDash(plane ? [22, 16] : []);
            g.beginPath(); g.moveTo(P2[i - 1][0], P2[i - 1][1]);
            if (plane) { var mx = (P2[i - 1][0] + P2[i][0]) / 2, my = (P2[i - 1][1] + P2[i][1]) / 2, dx = P2[i][0] - P2[i - 1][0], dy = P2[i][1] - P2[i - 1][1]; g.quadraticCurveTo(mx + dy * 0.2, my - dx * 0.2, P2[i][0], P2[i][1]); }
            else g.lineTo(P2[i][0], P2[i][1]);
            g.stroke();
          }
          g.setLineDash([]);
          P2.forEach(function (p, i) { g.fillStyle = i ? color : "#fff"; g.strokeStyle = "#16283a"; g.lineWidth = 5; g.beginPath(); g.arc(p[0], p[1], i ? 20 : 15, 0, 7); g.fill(); g.stroke(); });
          g.fillStyle = "#16283a"; g.font = "600 28px sans-serif";
          P2.forEach(function (p, i) { var nm = pts[i].name.slice(0, 22), w = g.measureText(nm).width, x = Math.min(Math.max(p[0] - w / 2, bx + 16), bx + bw - w - 16); g.fillText(nm, x, p[1] + (p[1] > by + bh - 70 ? -32 : 52)); });
        } else { g.fillStyle = "#3f5f4c"; g.font = "600 40px sans-serif"; g.fillText(M.routeText(t).slice(0, 40), bx + 40, by + bh / 2); }
        y = by + bh + 110;
        g.fillStyle = "#16283a"; g.font = "700 96px Georgia, serif"; g.fillText(dist(s.miles), 70, y);
        g.fillStyle = "#5b6b73"; g.font = "500 34px sans-serif";
        var bits = [s.nights != null ? s.nights + " nights" : "", s.flights ? s.flights + (s.flights === 1 ? " flight" : " flights") : "", s.cities.length + s.parks.length ? (s.cities.length + s.parks.length) + " places" : "", s.countries.length ? s.countries.length + (s.countries.length === 1 ? " country" : " countries") : ""].filter(Boolean);
        g.fillText(bits.join(" · "), 70, y + 60);
        g.fillStyle = color; g.fillRect(0, H - 24, W, 24);
        c.toBlob(function (b) { res(b); }, "image/png");
      } catch (e) { res(null); }
    });
  }

  // ---------- passport ----------
  var CTX = { parkStates: M.PARK_STATES };
  function stampsOf(p) { return P.stampsFor(p, S().trips, CTX); }
  function stampName(s) { return s.kind === "park" ? parkName(s.area) : areaName(s.kind, s.area); }
  function stampKeys(ids) { var out = {}; people(ids).forEach(function (p) { stampsOf(p).forEach(function (s) { out[p.id + "|" + s.id] = 1; if (s.kind === "state") out["sign|" + p.id + "|" + s.area] = 1; }); }); return out; }
  function newStamps(before, ids) {
    var seen = {}, out = [];
    people(ids).forEach(function (p) { stampsOf(p).forEach(function (s) { var k = s.kind + ":" + s.area; if (!before[p.id + "|" + s.id] && s.source !== "map" && !seen[k]) { seen[k] = 1; out.push(Object.assign({}, s, { holder: p.id, newSign: s.kind === "state" && !before["sign|" + p.id + "|" + s.area] })); } }); });
    return out.sort(function (a, b) { return (b.newSign ? 1 : 0) - (a.newSign ? 1 : 0); });
  }
  var SECTIONS = [["world", "🌍 Countries"], ["states", "🇺🇸 States"], ["parks", "🌲 Parks"]];
  var psec = "world";
  function inSection(s, sec) { return sec === "parks" ? s.kind === "park" : sec === "states" ? s.kind === "state" : s.kind === "place"; }
  // State stamps can show the state's bird, flower or animal (or a mix). Each person (and the family passport) keeps
  // their own choice on this device, like the State Signs seen list; press and hold one stamp to switch just that one.
  var ART_MODES = [["bird", "🐦 Bird"], ["flower", "🌸 Flower"], ["animal", "🦌 Animal"], ["mix", "🔀 Mix"]];
  function artKey(personId) { var log = "mltl"; try { log = window.MLTL_SYNCCORE.readLogs(localStorage).active || log; } catch (e) {} return "famstamp-stampart:" + log + ":" + (personId || "all"); }
  function readArt(personId) {
    var o = null; try { o = JSON.parse(localStorage.getItem(artKey(personId)) || "null"); } catch (e) {}
    o = o && typeof o === "object" ? o : {}; var ok = function (m) { return m === "bird" || m === "flower" || m === "animal" || m === "mix"; };
    var one = {}; if (o.one && typeof o.one === "object") Object.keys(o.one).forEach(function (id) { if (/^[A-Z]{2}$/.test(id) && ok(o.one[id]) && o.one[id] !== "mix") one[id] = o.one[id]; });
    return { mode: ok(o.mode) ? o.mode : "mix", one: one };
  }
  function writeArt(personId, o) { try { localStorage.setItem(artKey(personId), JSON.stringify(o)); } catch (e) {} }
  var heldAt = 0;   // the lift after a press-and-hold lands on the redrawn stamp: don't open it
  function artFor(personId, area) { var o = readArt(personId); return o.one[area] || o.mode; }
  function symLine(s, personId) {
    var D = s.kind === "state" && P.STATE_SYMBOLS ? P.STATE_SYMBOLS[s.area] : null; if (!D) return "";
    var mode = P.stampArtMode(s.area, artFor(personId, s.area)), x = D[mode];
    return '<p class="small symline">State ' + mode + ': <b>' + esc(x.name) + '</b>' + (x.fallback ? ' <span class="muted">(' + esc(areaName("state", s.area)) + ' has no official state animal, so this shows its bird)</span>' : "") + '</p>';
  }
  function stampSVG(s, personId) {
    return P.stampSVG(s, stampName(s), { art: s.kind === "state" ? artFor(personId, s.area) : "",
      sub: s.kind === "park" ? (PARK_BY[s.area] ? PARK_BY[s.area].states.replace(/,\s*/g, " · ") + " · NATIONAL PARK" : "NATIONAL PARK") : "" });
  }
  function bookHTML(title, color, stamps, who, pid) {
    var life = T.lifetime(pid || null, S().trips), counts = { world: 0, states: 0, parks: 0 }; stamps.forEach(function (s) { counts[s.kind === "park" ? "parks" : s.kind === "state" ? "states" : "world"]++; });
    var list = stamps.filter(function (s) { return inSection(s, psec); }), pages = P.pages(list, 4);
    var secName = { world: "Countries", states: "Domestic stamps", parks: "National parks" }[psec];
    var art = readArt(pid);
    var html = '<div class="seg" role="group" aria-label="Passport section">' + SECTIONS.map(function (x) { return '<button type="button" data-psec="' + x[0] + '" aria-pressed="' + (psec === x[0]) + '">' + x[1] + ' <small>' + counts[x[0]] + '</small></button>'; }).join("") + '</div>' +
      (psec === "states" ? '<div class="seg artseg" role="group" aria-label="State stamp pictures">' + ART_MODES.map(function (x) { return '<button type="button" data-art="' + x[0] + '" aria-pressed="' + (art.mode === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>' +
        '<p class="small muted arthint">Each state stamp shows its state bird, flower or animal. Press and hold a stamp to switch just that one.</p>' : "") +
      '<div class="pbook" style="--pc:' + esc(color) + '"><div class="pages" id="pages" tabindex="0" aria-label="Passport pages. Swipe to turn.">' +
      '<section class="ppage cover"><div class="crest" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="3"/><ellipse cx="50" cy="50" rx="18" ry="40" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M10 50h80M16 30h68M16 70h68" stroke="currentColor" stroke-width="2.5" fill="none"/></svg></div>' +
      '<p class="ptype">PASSPORT</p><h2>' + esc(title) + '</h2><p class="pcount">' + counts.world + (counts.world === 1 ? " country stamp" : " country stamps") + ' · ' + counts.states + ' states · ' + counts.parks + ' parks</p>' +
      (life.flights ? '<p class="pfly">✈️ ' + life.flights + (life.flights === 1 ? " flight" : " flights") + ' · ' + esc(dist(life.flightMiles)) + ' in the air</p>' : "") + '<p class="pswipe">Swipe to open →</p></section>' +
      (pages.length ? pages.map(function (pg, n) {
        return '<section class="ppage"><header><span>' + esc(secName.toUpperCase()) + '</span><span>' + (n + 1) + '</span></header>' + pg.map(function (c) {
          return '<button type="button" class="stamp" data-sid="' + esc(c.stamp.id) + '" style="left:' + (c.x / 3).toFixed(1) + '%;top:' + (c.y / 4).toFixed(1) + '%;--r:' + c.rot + 'deg" aria-label="' + esc(stampName(c.stamp) + (c.stamp.kind === "state" ? ", " + artFor(pid, c.stamp.area) : "") + (P.fmtDate(c.stamp.date) ? ", " + P.fmtDate(c.stamp.date) : "")) + '">' + stampSVG(c.stamp, pid) +
            (who && c.stamp.who.length ? '<span class="dots">' + A().avatars(c.stamp.who) + '</span>' : "") + '</button>';
        }).join("") + '</section>';
      }).join("") : '<section class="ppage empty"><header><span>' + esc(secName.toUpperCase()) + '</span><span>1</span></header><p>No ' + esc(secName.toLowerCase()) + ' stamps yet.<br>' +
        (psec === "parks" ? "Mark a park on the Parks tab, or add one to a trip." : psec === "states" ? "Color a state on the USA map, or add a trip." : "Color a country on the World map, or add a trip abroad.") + '</p></section>') +
      '</div><div class="pager"><button type="button" class="btn btn-ghost" id="pprev" aria-label="Previous page">‹</button><span id="pgn">Cover</span><button type="button" class="btn btn-ghost" id="pnext" aria-label="Next page">›</button></div></div>';
    return html;
  }
  function bindBook(again, stamps, owner) {
    $$("[data-psec]").forEach(function (b) { b.onclick = function () { psec = b.dataset.psec; again(1); }; });
    var pages = $("#pages"), n = $$(".ppage", pages).length, pid = owner ? owner.id : null;
    function at() { return Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth)); }
    $$("[data-art]").forEach(function (b) { b.onclick = function () { writeArt(pid, { mode: b.dataset.art, one: {} }); again(Math.max(1, at())); var f = $('[data-art="' + b.dataset.art + '"]'); if (f) f.focus(); }; });
    function label() { var i = at(); $("#pgn").textContent = i === 0 ? "Cover" : "Page " + i + " of " + (n - 1); }
    pages.addEventListener("scroll", function () { label(); }, { passive: true });
    $("#pprev").onclick = function () { pages.scrollTo({ left: (at() - 1) * pages.clientWidth, behavior: reduced() ? "auto" : "smooth" }); };
    $("#pnext").onclick = function () { pages.scrollTo({ left: (at() + 1) * pages.clientWidth, behavior: reduced() ? "auto" : "smooth" }); };
    pages.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") $("#pnext").click(); if (e.key === "ArrowLeft") $("#pprev").click(); });
    $$(".stamp", pages).forEach(function (b) {
      var s = stamps.filter(function (x) { return x.id === b.dataset.sid; })[0], timer = 0, held = false;
      b.onclick = function (e) { if (held || Date.now() - heldAt < 900) { held = false; e.preventDefault(); return; } if (s) stampSheet(s, owner, again); };
      if (!s || s.kind !== "state") return;
      // press and hold a state stamp: bird → flower → animal → back to the page's choice
      var stop = function () { clearTimeout(timer); timer = 0; };
      b.addEventListener("pointerdown", function () {
        held = false; stop();
        timer = setTimeout(function () {
          held = true; heldAt = Date.now(); var o = readArt(pid), cur = o.one[s.area] || (o.mode === "mix" ? P.stampArtMode(s.area, "mix") : o.mode), order = ["bird", "flower", "animal"];
          var next = order[(order.indexOf(cur) + 1) % 3]; o.one[s.area] = next;
          if (o.mode === next || (o.mode === "mix" && P.stampArtMode(s.area, "mix") === next)) delete o.one[s.area];
          writeArt(pid, o); var pg = at(); again(Math.max(1, pg));
          A().toast(stampName(s) + ": " + next);
        }, 550);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, stop); });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
    label();
    return { open: function (i) { pages.scrollLeft = i * pages.clientWidth; label(); } };
  }
  function passport(k, openAt) {
    var A_ = A(); document.title = k.name + "'s passport · Famstamp";
    var stamps = stampsOf(k);
    A_.main.innerHTML = A_.shell(k, "passport", '<div class="seg pswitch" role="group" aria-label="Passport or State Signs"><a class="btn" aria-current="page">🛂 Passport</a><a class="btn" href="#/p/' + esc(k.id) + '/signs">🪧 State Signs</a></div>' +
      '<p class="lede small">Every place ' + esc(k.name) + ' has been gets a stamp, with the date. Trips add them on their own; tap a stamp to see it.</p>' +
      bookHTML(k.name + "'s Famstamp Passport", k.color, stamps, false, k.id) +
      '<div class="actions"><button type="button" class="btn btn-beacon" id="addstamp">+ Add a stamp</button>' + (S().kids.length > 1 ? '<a class="btn btn-ghost" href="#/family/passport">👨‍👩‍👧 Family passport</a>' : "") + '</div>');
    var bk = bindBook(function (pg) { passport(k, pg); }, stamps, k);
    if (openAt) bk.open(openAt);
    $("#addstamp").onclick = function () { addStampSheet(k); };
  }
  function passportFamily(openAt) {
    var A_ = A(); document.title = "Family passport · Famstamp";
    var stamps = P.familyStamps(S().kids, S().trips, CTX), title = S().meta.familyName ? "The " + S().meta.familyName + " Family Passport" : "Our Family's Famstamp Passport";
    A_.main.innerHTML = '<a class="back" href="#/family">← Family map</a><h1>Family passport</h1><div class="seg pswitch" role="group" aria-label="Passport or State Signs"><a class="btn" aria-current="page">🛂 Passport</a><a class="btn" href="#/family/signs">🪧 State Signs</a></div><p class="lede small">Every stamp anyone in the family has, with who was there. A trip you took together is one stamp.</p>' +
      bookHTML(title, "#16283a", stamps, true, null) +
      '<h2>Passports</h2><div class="stats">' + S().kids.map(function (p) {
        var n = stampsOf(p).length;
        return '<a class="stat person" href="#/p/' + esc(p.id) + '/passport" style="' + A_.kidStyle(p) + '"><div class="v"><span class="dotp">' + A_.initial(p.name) + '</span> ' + esc(p.name) + '</div><div class="k">' + n + (n === 1 ? " stamp" : " stamps") + '</div></a>'; }).join("") + '</div>';
    var bk = bindBook(function (pg) { passportFamily(pg); }, stamps, null);
    if (openAt) bk.open(openAt);
  }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function dateFields(v) {
    v = P.cleanDate(v); var y = v.slice(0, 4), m = v.length >= 7 ? v.slice(5, 7) : "";
    return '<div class="fields"><div class="field"><label for="sdate">The exact day</label><input id="sdate" type="date" value="' + (v.length === 10 ? v : "") + '" max="' + M.today() + '"></div></div>' +
      '<p class="small muted orline">or just the month and year:</p><div class="fields two"><div class="field"><label for="smonth">Month</label><select id="smonth"><option value="">Not sure</option>' +
      MONTHS.map(function (n, i) { var mm = ("0" + (i + 1)).slice(-2); return '<option value="' + mm + '"' + (m === mm && v.length === 7 ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="syear">Year</label><input id="syear" type="number" inputmode="numeric" min="1900" max="' + new Date().getFullYear() + '" value="' + (v.length < 10 ? y : "") + '" placeholder="' + new Date().getFullYear() + '"></div></div>';
  }
  function readDate() {
    var d = $("#sdate").value; if (d) return P.cleanDate(d);
    var y = $("#syear").value.trim(), m = $("#smonth").value; if (!/^\d{4}$/.test(y)) return "";
    return P.cleanDate(m ? y + "-" + m : y);
  }
  function sheet(html) {
    closeSheet();
    var el = document.createElement("div"); el.className = "sheetbg"; el.innerHTML = '<div class="sheetbox" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) { if (e.target === el || e.target.closest("[data-close]")) closeSheet(); });
    var f = $("input,select,button", el); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
    return el;
  }
  function closeSheet() { $$(".sheetbg").forEach(function (x) { x.remove(); }); }
  window.addEventListener("hashchange", closeSheet);
  function stampSheet(s, owner, again) {
    var A_ = A(), name = stampName(s), dates = P.fmtDate(s.date) ? P.fmtDate(s.date) + (s.end ? " to " + P.fmtDate(s.end) : "") : "";
    var t = s.tripId ? tripById(s.tripId) : null, holder = owner || (s.who.length === 1 ? A_.kidById(s.who[0]) : null);
    var html = '<div class="bigstamp">' + stampSVG(s, owner ? owner.id : null) + '</div><h3>' + esc(name) + '</h3>' + symLine(s, owner ? owner.id : null) + (dates || s.via ? '<p class="muted">' + esc(dates) + (s.via ? (dates ? " · " : "") + "via " + esc(s.via) : "") + '</p>' : "") + '' +
      (s.who.length > 1 || !owner ? '<p class="small"><span class="dots">' + A_.avatars(s.who) + '</span> ' + esc(A_.travelerNames(s.who)) + '</p>' : "");
    if (t) html += '<p class="small">From the trip <a href="#/p/' + esc((holder || A_.kidById(t.kidIds[0])).id) + '/trip/' + esc(t.id) + '">' + esc(t.place) + ' →</a></p><p class="small muted">Its dates come from the trip, so edit the trip to change them.</p><div class="actions"><button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    else if (holder) {
      html += (s.note ? '<p class="small">' + esc(s.note) + '</p>' : "") + '<p class="small muted">' + (s.source === "map" ? "Colored in on the map. When were you there?" : "Change the date:") + '</p>' + dateFields(s.date) +
        '<div class="actions"><button type="button" class="btn btn-primary" id="sok">Save date</button>' + (s.source === "hand" ? '<button type="button" class="btn btn-danger" id="sdel">Remove stamp</button>' : "") + '<button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    } else html += '<div class="actions"><button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    sheet(html);
    var ok = $("#sok");
    if (ok) ok.onclick = function () {
      var date = readDate(); if (!date) return A_.toast("Pick a day, or a month and year");
      if (s.source === "hand") holder.stamps = (holder.stamps || []).map(function (x) { return x.id === s.id ? Object.assign({}, x, { date: date }) : x; });
      else holder.stamps = P.cleanStamps((holder.stamps || []).concat([P.newStamp({ kind: s.kind, area: s.area, date: date })]));
      holder.updatedAt = new Date().toISOString();
      A_.saveKid(holder).then(function () { closeSheet(); again(); A_.toast("Stamp dated"); });
    };
    var dl = $("#sdel");
    if (dl) dl.onclick = function () { holder.stamps = (holder.stamps || []).filter(function (x) { return x.id !== s.id; }); holder.updatedAt = new Date().toISOString(); A_.saveKid(holder).then(function () { closeSheet(); again(); A_.toast("Stamp removed"); }); };
  }
  function areaOptions(sec) {
    if (sec === "parks") return M.PARKS.map(function (p) { return '<option value="park:' + p.id + '">' + esc(p.name) + '</option>'; }).join("");
    if (sec === "states") return MAPS.us.shapes.map(function (p) { return '<option value="state:' + p.id + '">' + esc(p.name) + '</option>'; }).join("");
    return '<optgroup label="UK nations">' + MAPS.world.uk.map(function (u) { return '<option value="place:' + u.id + '">' + esc(u.name) + '</option>'; }).join("") + '</optgroup><optgroup label="Countries">' +
      MAPS.world.countries.filter(function (c) { return c.id !== "GBR"; }).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return '<option value="place:' + c.id + '">' + esc(c.name) + '</option>'; }).join("") + '</optgroup>';
  }
  function addStampSheet(k) {
    var A_ = A();
    sheet('<h3>Add a stamp to ' + esc(k.name) + '\'s passport</h3><div class="field"><label for="sarea">Where?</label><select id="sarea">' + areaOptions(psec) + '</select></div>' + dateFields("") +
      '<div class="field"><label for="svia">Came in through <span class="muted small">(optional)</span></label><input id="svia" type="text" maxlength="40" placeholder="e.g. EDI, Dover, the ferry"></div>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="sok">Stamp it</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
    $("#sok").onclick = function () {
      var v = $("#sarea").value.split(":"), stamp = P.newStamp({ kind: v[0], area: v[1], date: readDate(), via: $("#svia").value });
      var fresh = v[0] === "state" && !stampsOf(k).some(function (x) { return x.kind === "state" && x.area === v[1]; });
      addStamp(k, stamp, true).then(function () { closeSheet(); passport(k); celebrate([Object.assign({}, stamp, { newSign: fresh })]); });
    };
  }
  function addStamp(k, stamp, colorIn) {
    k.stamps = P.cleanStamps((k.stamps || []).concat([stamp]));
    if (colorIn) { if (stamp.kind === "park") { if (!k.parks[stamp.area]) k.parks[stamp.area] = { at: stamp.date.length === 10 ? stamp.date : M.today(), jr: false }; } else M.toggleArea(k, stamp.kind, stamp.area, true, stamp.date.length === 10 ? stamp.date : ""); }
    k.updatedAt = new Date().toISOString();
    return A().saveKid(k);
  }
  /** After someone colors in a place on a map: ask when, and stamp the passport. */
  function askDate(k, kind, id, after) {
    var name = shortArea(kind, id);
    if (kind === "place" && id === "USA") return;
    var html = '<div class="askhead"><span aria-hidden="true">🛂</span><div><h3>Stamp ' + esc(k.name) + '\'s passport?</h3><p class="muted small">When ' + (M.isKid(k) ? "were you" : "were you") + ' in ' + esc(name) + '?</p></div></div>' + dateFields("") +
      '<div class="actions"><button type="button" class="btn btn-primary" id="sok">Stamp it</button><button type="button" class="btn btn-ghost" data-close id="snot">Not sure</button></div>';
    sheet(html);
    $("#sok").onclick = function () {
      var date = readDate(); if (!date) return A().toast("Pick a day, or a month and year, or tap Not sure");
      var stamp = P.newStamp({ kind: kind, area: id, date: date });
      var bag = kind === "state" ? k.states : kind === "park" ? k.parks : k.places;
      if (bag[id] && date.length === 10) bag[id].at = date;
      addStamp(k, stamp, false).then(function () { closeSheet(); celebrate([Object.assign({}, stamp, { newSign: kind === "state" })]); if (after) after(); });
    };
    // Not sure of the date: no passport stamp, but a new state still collects its sign.
    if (kind === "state") $("#snot").addEventListener("click", function () { celebrate([{ kind: "state", area: id, date: "", newSign: true, signOnly: true }]); });
  }
  var audio = null;
  function thunk() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      audio = audio || new AC(); var t0 = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + 0.16);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.25);
    } catch (e) {}
  }
  /** "New stamp!" with an ink thunk (and a buzz on phones that can). */
  function celebrate(list) {
    if (!list || !list.length) return;
    $$(".stampfx").forEach(function (x) { x.remove(); });
    var s = list.filter(function (x) { return x.newSign; })[0] || list[0], el = document.createElement("div"), more = list.length - 1;
    el.className = "stampfx" + (s.newSign ? " signfx" : "") + (reduced() ? " calm" : ""); el.setAttribute("role", "status");
    el.innerHTML = s.newSign
      ? '<div class="fxbox"><div class="fxsign">' + P.signSVG(s.area, areaName("state", s.area), { first: s.date, visits: 1 }) + '</div><b>Sign collected: ' + esc(areaName("state", s.area)) + '!</b><span>' +
        (s.signOnly ? "It's in your State Signs." : "Plus a new passport stamp" + (more ? " and " + more + " more" : "") + ".") + '</span></div>'
      : '<div class="fxbox"><div class="fxstamp">' + stampSVG(s, s.holder) + '</div><b>New stamp: ' + esc(stampName(s)) + '</b>' + (more ? '<span>+ ' + more + ' more in the passport</span>' : "") + '</div>';
    document.body.appendChild(el);
    setTimeout(function () { thunk(); if (navigator.vibrate) try { navigator.vibrate(reduced() ? 20 : [18, 40, 28]); } catch (e) {} }, reduced() ? 0 : 260);
    el.onclick = function () { el.remove(); };
    setTimeout(function () { el.classList.add("out"); setTimeout(function () { el.remove(); }, 400); }, 2300);
  }

  // ---------- lifetime stats ----------
  function lifetimeHTML(personId) {
    var A_ = A(), L = T.lifetime(personId, S().trips); if (!L.trips) return "";
    var lt = L.longest ? tripById(L.longest.id) : null, pid = personId || (lt ? lt.kidIds[0] : "");
    return '<h2>' + (personId ? "Miles and favorites" : "Family miles and favorites") + ' ' + unitToggle() + '</h2><div class="tstats life">' +
      tstat("🧭", dist(L.miles), "traveled") + tstat("🌍", (Math.round(L.aroundWorld * 100) / 100) + "×", "around the world") + tstat("✈️", L.flights, L.flights === 1 ? "flight" : "flights") +
      (L.flightMiles ? tstat("🛫", dist(L.flightMiles), "flown") : "") + (L.airMin ? tstat("⏱️", "~" + T.fmtAir(L.airMin), "in the air") : "") +
      (L.bigRoad ? tstat("🚗", dist(L.bigRoad), "biggest road trip") : "") + (L.topState ? tstat("📍", areaName("state", L.topState.id), "most visited · " + L.topState.count + (L.topState.count === 1 ? " trip" : " trips")) : "") + '</div>' +
      (lt ? '<p class="small">Longest trip: <a href="#/p/' + esc(pid) + '/trip/' + esc(lt.id) + '">' + esc(lt.place) + '</a>, ' + esc(dist(L.longest.miles, true)) + '</p>' : "") +
      (L.restaurants.length ? '<h3 class="sec">Favorite restaurants</h3><ol class="rlist">' + L.restaurants.slice(0, 8).map(function (r) {
        var tt = tripById(r.tripId);
        return '<li><b>' + esc(r.name) + '</b>' + stars(r.rating) + '<span class="meta">' + esc([r.where, tt ? tt.place : ""].filter(Boolean).join(" · ")) + '</span></li>'; }).join("") + '</ol>' : "");
  }
  function bindLifetime(again) { bindUnits(A().main, again); }

  // ---------- print ----------
  function printExtra(k) {
    var A_ = A(), list = S().trips.filter(function (t) { return t.kidIds.indexOf(k.id) >= 0; }).sort(function (a, b) { return order(a) < order(b) ? -1 : 1; });
    var out = list.filter(function (t) { return (t.route || []).length > 1 || (t.stays || []).length || (t.favs || []).length || t.story; }).map(function (t) {
      var s = T.summary(t), favs = T.visibleFavs(t, S().kids, k, !!S().meta.adultInKid), m = t.moments || {};
      return '<section class="page tripprint"><h1>' + esc(t.place) + '</h1><p class="statline">' + esc([dateRange(t), s.nights != null ? s.nights + " nights" : "", s.legs.length ? dist(s.miles, true) : "", A_.travelerNames(t.kidIds)].filter(Boolean).join(" · ")) + '</p>' +
        (T.routeMap(t) ? '<div class="mapbox routebox">' + routeSVG(t) + '</div>' : "") + '<div class="cols"><div>' +
        (s.legs.length ? '<h2>The way we went</h2><ul>' + s.legs.map(function (L) { return '<li>' + modeIc(L.mode) + ' ' + esc(L.from + " → " + L.to) + ': ' + esc((L.how === "about" ? "about " : "") + dist(L.miles)) + '</li>'; }).join("") + '</ul>' : "") +
        ((t.stays || []).length ? '<h2>Where we stayed</h2><ul>' + t.stays.map(function (x) { return '<li>' + esc(x.name) + (x.nights ? ", " + x.nights + " nights" : "") + (x.rating ? " " + "★★★★★".slice(0, x.rating) : "") + (x.note ? ": " + esc(x.note) : "") + '</li>'; }).join("") + '</ul>' : "") +
        (favs.length ? '<h2>Favorites</h2><ul>' + favs.map(function (f) { return '<li>' + T.FAV[f.cat].ic + ' ' + esc(T.FAV[f.cat].short) + ': <b>' + esc(f.name) + '</b>' + (f.where ? " (" + esc(f.where) + ")" : "") + (f.rating ? " " + "★★★★★".slice(0, f.rating) : "") + '</li>'; }).join("") + '</ul>' : "") +
        (people(t.kidIds).some(function (p) { return m[p.id]; }) ? '<h2>Favorite moments</h2><ul>' + people(t.kidIds).filter(function (p) { return m[p.id]; }).map(function (p) { return '<li><b>' + esc(p.name) + ':</b> ' + esc(m[p.id]) + '</li>'; }).join("") + '</ul>' : "") +
        '</div><div>' + (t.story && canStory(t) ? '<h2>Our story</h2><p class="storyprint">' + esc(storyTextForPrint(t, k)) + '</p>' : "") + '</div></div></section>';
    }).join("");
    var stamps = stampsOf(k);
    if (stamps.length) {
      var chunks = []; for (var ci = 0; ci < stamps.length; ci += 12) chunks.push(stamps.slice(ci, ci + 12).map(function (x, j) { return { stamp: x, rot: (T.hash(x.id) % 17) - 8 }; }));
      out += chunks.map(function (pg, n) {
        return '<section class="page passprint"><h1>' + esc(k.name) + '\'s passport' + (n ? " (" + (n + 1) + ")" : "") + '</h1><div class="pgrid">' + pg.map(function (c) {
          return '<div class="pstamp" style="--r:' + c.rot + 'deg">' + stampSVG(c.stamp, k.id) + '</div>'; }).join("") + '</div></section>';
      }).join("");
    }
    return out;
  }
  function storyTextForPrint(t, k) {
    var st = t.story; if (!st) return "";
    if (st.edited) return st.text;
    if (st.style === "journal" && !T.showAdult(t, S().kids, k, !!S().meta.adultInKid)) return storyText(t, k, "journal", st.seed);
    return storyText(t, k, st.style, st.seed);
  }

  // shared ink filter for the stamps
  function inkDefs() {
    if (document.getElementById("inkdefs")) return;
    var d = document.createElement("div"); d.id = "inkdefs"; d.setAttribute("aria-hidden", "true");
    d.innerHTML = '<svg width="0" height="0" style="position:absolute"><filter id="inkrough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/><feComponentTransfer in="n" result="speck"><feFuncA type="discrete" tableValues="1 1 1 0.35 1 1 1 1"/></feComponentTransfer>' +
      '<feComposite in="d" in2="speck" operator="in"/></filter></svg>';
    document.body.appendChild(d);
  }
  if (document.body) inkDefs(); else document.addEventListener("DOMContentLoaded", inkDefs);

  // ---------- State Signs ----------
  // A separate collection from the passport: one "Welcome to" sign per state. Same sources as the state stamps
  // (US trip stops, hand-added state stamps, states colored on the map), so there is nothing extra to store.
  // Each sign's art comes from state-signs.js; its frame is bronze (1 visit), silver (2-3) or gold (4+).
  var TIER_NAME = { bronze: "Bronze", silver: "Silver", gold: "Gold" };
  function collectBar(personId) {
    if (S().kids.length < 2) return "";
    return '<div class="chips signwho" role="group" aria-label="Whose signs">' + '<a class="chip" href="#/family/signs"' + (personId ? "" : ' aria-current="true"') + '>Everyone</a>' +
      S().kids.map(function (p) { return '<a class="chip" style="' + A().kidStyle(p) + '" href="#/p/' + esc(p.id) + '/signs"' + (p.id === personId ? ' aria-current="true"' : "") + '><span class="dotp" aria-hidden="true">' + A().initial(p.name) + '</span> ' + esc(p.name) + '</a>'; }).join("") + '</div>';
  }
  // Which signs this screen has already shown, so a newly collected one flips in once (kept on this device only).
  function seenKey(personId) { var log = "mltl"; try { log = window.MLTL_SYNCCORE.readLogs(localStorage).active || log; } catch (e) {} return "famstamp-signs-seen:" + log + ":" + (personId || "all"); }
  function readSeen(personId) { try { var v = localStorage.getItem(seenKey(personId)); return v == null ? null : v.split(",").filter(Boolean); } catch (e) { return null; } }
  function writeSeen(personId, ids) { try { localStorage.setItem(seenKey(personId), ids.join(",")); } catch (e) {} }
  function signsHTML(personId, fresh) {
    var who = personId ? [A().kidById(personId)] : S().kids, signs = P.signsFor(who, S().trips, CTX), c = P.signCount(signs);
    var list = P.STATES50.slice().sort(function (a, b) { return areaName("state", a).localeCompare(areaName("state", b)); });
    var tiers = { bronze: 0, silver: 0, gold: 0 }, n = 0;
    Object.keys(signs).forEach(function (id) { tiers[P.signTier(signs[id])]++; });
    var card = function (id, bonus) {
      var info = signs[id], t = P.signTier(info), isNew = info && fresh && fresh.indexOf(id) >= 0;
      return '<button type="button" class="signcard' + (info ? " got t-" + t : " todo") + (bonus ? " bonus" : "") + (isNew ? " fresh" : "") + '" data-sign="' + id + '"' + (isNew ? ' style="--d:' + (n++ * 140) + 'ms"' : "") + '>' +
        P.signSVG(id, areaName("state", id), info || null) +
        (!personId && info ? '<span class="dots">' + A().avatars(info.who) + '</span>' : "") + (bonus ? '<span class="bonustag">Bonus</span>' : "") + (isNew ? '<span class="newtag">New!</span>' : "") + '</button>';
    };
    var got = list.filter(function (id) { return signs[id]; }), todo = list.filter(function (id) { return !signs[id]; });
    var key = '<ul class="tierkey" aria-label="Sign frames">' + ["bronze", "silver", "gold"].map(function (t) {
      return '<li class="t-' + t + '"><i aria-hidden="true"></i><b>' + TIER_NAME[t] + '</b> <span>' + (t === "bronze" ? "1 visit" : t === "silver" ? "2–3 visits" : "4+ visits") + '</span> <em>' + tiers[t] + '</em></li>'; }).join("") + '</ul>';
    return '<div class="signhead"><div class="signcount"><b>' + c.have + '</b> of 50 states' + (c.dc ? ' <span class="bonusnote">+ DC</span>' : "") + '</div><div class="signbar" aria-hidden="true"><span style="width:' + (c.have * 2) + '%"></span></div></div>' + key +
      '<div class="signbook">' + (got.length ? '<h3 class="sec">Collected</h3><div class="signgrid">' + got.map(function (id) { return card(id); }).join("") + '</div>' : "") +
      (todo.length ? '<h3 class="sec">Still to find <span class="muted small">' + todo.length + ' to go</span></h3><div class="signgrid">' + todo.map(function (id) { return card(id); }).join("") + '</div>' : '<p class="allfifty">All 50! What a road trip family. 🎉</p>') +
      '<h3 class="sec">Bonus</h3><div class="signgrid">' + card("DC", true) + '</div></div>' +
      '<p class="small muted">Signs fill in from trips, passport stamps and the states you color in on the map. Tap one to see its trips and dates. The designs are Famstamp originals, not real state signs.</p>';
  }
  function signs(k) {
    var A_ = A(), pid = k ? k.id : null; document.title = (k ? k.name + "'s state signs" : "State signs") + " · Famstamp";
    var have = Object.keys(P.signsFor(k ? [k] : S().kids, S().trips, CTX)), seen = readSeen(pid);
    // First visit to this screen: nothing flips. After that, signs collected since last time get a flip-in and a shine.
    var fresh = seen ? have.filter(function (id) { return seen.indexOf(id) < 0; }) : [];
    writeSeen(pid, have);
    var body = '<div class="seg pswitch" role="group" aria-label="Passport or State Signs">' + (k ? '<a class="btn" href="#/p/' + esc(k.id) + '/passport">🛂 Passport</a>' : '<a class="btn" href="#/family/passport">🛂 Passport</a>') +
      '<a class="btn" aria-current="page">🪧 State Signs</a></div>' + collectBar(pid) + signsHTML(pid, fresh);
    A_.main.innerHTML = k ? A_.shell(k, "passport", body) : '<a class="back" href="#/family">← Family map</a><h1>State signs</h1>' + body;
    $$("[data-sign]").forEach(function (b) { b.onclick = function () { signSheet(k, b.dataset.sign); }; });
  }
  function visitRow(v, k, i) {
    var A_ = A(), t = v.tripId ? tripById(v.tripId) : null, d = t ? dateRange(t) : (P.fmtDate(v.date) ? P.fmtDate(v.date) + (v.end ? " to " + P.fmtDate(v.end) : "") : "");
    var how = t ? '<a href="#/p/' + esc((k || A_.kidById(v.who[0]) || { id: t.kidIds[0] }).id) + '/trip/' + esc(t.id) + '">' + esc(t.place) + ' →</a>' : v.source === "hand" ? "Added by hand" : "Colored in on the map";
    var owner = k || (v.who.length === 1 ? A_.kidById(v.who[0]) : null);
    return '<li><span class="vnum" aria-hidden="true">' + (i + 1) + '</span><div>' + (d ? '<b>' + esc(d) + '</b>' : "") + '<span class="small">' + how + '</span>' + (!k && v.who.length ? '<span class="dots">' + A_.avatars(v.who) + '</span>' : "") + '</div>' +
      (!t && owner ? '<button type="button" class="btn btn-ghost btn-sm" data-vdate="' + i + '">' + (d ? "Change date" : "Add date") + '</button>' : "") + '</li>';
  }
  function signSheet(k, id) {
    var A_ = A(), name = areaName("state", id), who = k ? [k] : S().kids, info = P.signsFor(who, S().trips, CTX)[id], again = function () { signs(k ? A_.kidById(k.id) : null); };
    var look = P.signInfo(id), t = P.signTier(info), missing = S().kids.filter(function (p) { return !P.signsFor([p], S().trips, CTX)[id]; });
    var html = '<div class="signdetail"><div class="bigsign' + (info ? " t-" + t : "") + '">' + P.signSVG(id, name, info || null) + '</div><h3>' + esc(name) + (id === "DC" ? ' <span class="tag">bonus</span>' : "") + '</h3>' +
      (look ? '<p class="signnick">' + esc(look.nick) + '</p>' : "");
    if (info) {
      var next = t === "gold" ? "Top frame. Gold!" : (t === "silver" ? 4 - info.visits : 1) + (t === "silver" && 4 - info.visits > 1 ? " more visits" : " more visit") + " for " + (t === "silver" ? "Gold" : "Silver");
      html += '<div class="signmeta"><span class="tierpill t-' + t + '"><i aria-hidden="true"></i>' + TIER_NAME[t] + ' sign</span><span><b>' + info.visits + '</b> ' + (info.visits === 1 ? "visit" : "visits") + '</span>' + (info.first ? "<span>First visit <b>" + esc(P.fmtDate(info.first)) + "</b></span>" : "") + '</div>' +
        '<p class="small muted">' + esc(next) + '</p>' +
        '<p class="small"><span class="dots">' + A_.avatars(info.who) + '</span> ' + esc(A_.travelerNames(info.who)) + '</p>' +
        '<h4 class="sec">Visits</h4><ol class="visitlist">' + info.list.map(function (v, i) { return visitRow(v, k, i); }).join("") + '</ol>';
    } else html += '<p class="muted">Not collected yet. Visit ' + esc(name) + ' on a trip and this sign fills in by itself.</p>';
    var canAdd = k ? !info : missing.length;
    if (canAdd) html += '<p class="small muted">Been to ' + esc(name) + '? Add the sign by hand.</p>' + (k ? "" : '<div class="field"><label for="swho">Who?</label><select id="swho">' + missing.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join("") + '</select></div>') + dateFields("") +
      '<div class="actions"><button type="button" class="btn btn-primary" id="sok">Collect this sign</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>';
    else html += '<div class="actions"><button type="button" class="btn btn-ghost" data-close>Close</button></div>';
    sheet(html + '</div>');
    $$("[data-vdate]").forEach(function (b) {
      b.onclick = function () {
        var v = info.list[+b.dataset.vdate], owner = k || A_.kidById(v.who[0]), st = owner && stampsOf(owner).filter(function (x) { return x.id === v.stampId; })[0];
        if (st) stampSheet(st, owner, again);
      };
    });
    var ok = $("#sok");
    if (ok) ok.onclick = function () {
      var p = k || A_.kidById($("#swho").value), date = readDate(), stamp = P.newStamp({ kind: "state", area: id, date: date });
      // No date? Color in the state only; with a date it's also a passport stamp.
      var job = date ? addStamp(p, stamp, true) : (M.toggleArea(p, "state", id, true), p.updatedAt = new Date().toISOString(), A_.saveKid(p));
      job.then(function () { closeSheet(); again(); celebrate([Object.assign({}, stamp, { newSign: true, signOnly: !date })]); });
    };
  }

  // ---------- "+ Add a trip" on the home screen: one tap to the builder ----------
  function addTripHref(p, all) { return "#/p/" + p.id + "/trips/new" + (all ? "/all" : ""); }
  function whoWentSheet() {
    var A_ = A(), kids = S().kids, me = S().meta.sync && S().meta.sync.myPerson;
    if (!kids.length) { location.hash = "#/add"; return; }
    if (kids.length === 1) { location.hash = addTripHref(kids[0]); return; }
    var list = kids.slice().sort(function (a, b) { return (b.id === me ? 1 : 0) - (a.id === me ? 1 : 0); }), lead = A_.kidById(me) || list[0];
    sheet('<div class="sheethead"><h3 id="wwh">Who went?</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div><p class="small muted">Pick one to start. You can check everyone else on the next screen.</p>' +
      '<div class="whowent" role="group" aria-labelledby="wwh"><a class="wwall" href="' + esc(addTripHref(lead, true)) + '"><span aria-hidden="true">👨‍👩‍👧</span> Everyone went</a>' +
      list.map(function (p) { return '<a class="wwone" href="' + esc(addTripHref(p)) + '" style="' + A_.kidStyle(p) + '"><span class="dotp" aria-hidden="true">' + A_.initial(p.name) + '</span> ' + esc(p.name) + (p.id === me ? ' <small>(you)</small>' : "") + '</a>'; }).join("") + '</div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
  }

  window.FS_UI = { builder: builder, whoWentSheet: whoWentSheet, addTripHref: addTripHref, detail: detail, tripCard: tripCard, passport: passport, passportFamily: passportFamily, askDate: askDate, celebrate: celebrate,
                   lifetimeHTML: lifetimeHTML, bindLifetime: bindLifetime, printExtra: printExtra, loadPlaces: loadPlaces, loadAirports: loadAirports, routeSVG: routeSVG,
                   searchPlaces: searchPlaces, searchAirports: searchAirports, stampsOf: stampsOf, unitToggle: unitToggle, stopSpeech: stopSpeech, signs: signs };
})();
