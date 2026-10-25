/* Famstamp: QR stamp stations (v65). A library, museum or shop puts up a printed poster; scanning its QR code opens the
   app at #/st/<code> and gives each person here that place's stamp (a round "city" stamp with a signpost). Anti-abuse,
   kept simple: once per person per day, and stations can ask for a location check (only counts within a set distance).
   The code carries the station itself (id, name, place, optional spot + distance) with a check digit, so no server or
   sign-up is needed. Stations made on this phone are kept in meta.stations. Routes: #/stations, #/stations/new,
   #/stations/poster/<id>, #/st/<code>. Data: person.spots["c-st-<id>"] = { at, name, sub, days: [last 30 days] }. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(typeof require === "function" ? require("./brand.js") : null);
  else root.FS_STATIONS = factory(root.FS_BRAND);
})(typeof self !== "undefined" ? self : this, function (BR) {
  "use strict";
  var DAY = /^\d{4}-\d{2}-\d{2}$/, RADII = [150, 400, 1500];
  function brand() { return BR || (typeof self !== "undefined" && self.FS_BRAND) || { NAME: "Famstamp" }; }
  function hash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function clean(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
  function b64e(s) {
    var u = unescape(encodeURIComponent(s)), b = typeof btoa === "function" ? btoa(u) : Buffer.from(u, "binary").toString("base64");
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64d(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var u = typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("binary"); return decodeURIComponent(escape(u));
  }
  function newId() { var a = "abcdefghijkmnpqrstuvwxyz23456789", o = ""; for (var i = 0; i < 8; i++) o += a[Math.floor(Math.random() * a.length)]; return o; }
  /** A station, tidied: { id, name, place, lat?, lon?, r? }. Returns null when it can't be one. */
  function make(o) {
    if (!o) return null;
    var st = { id: String(o.id || ""), name: clean(o.name, 40), place: clean(o.place, 40) };
    if (!/^[a-z0-9]{8}$/.test(st.id) || !st.name) return null;
    if (isFinite(o.lat) && isFinite(o.lon) && o.lat !== null && o.lon !== null && Math.abs(o.lat) <= 90 && Math.abs(o.lon) <= 180 && o.lat !== "" && o.lon !== "") {
      st.lat = Math.round(+o.lat * 1e5) / 1e5; st.lon = Math.round(+o.lon * 1e5) / 1e5; st.r = Math.max(50, Math.min(5000, Math.round(+o.r || 400)));
    }
    return st;
  }
  /** The code in the QR link: base64url(JSON) + "." + 5-char check. */
  function encode(st) {
    st = make(st); if (!st) return "";
    var j = JSON.stringify(st.lat != null ? [1, st.id, st.name, st.place, st.lat, st.lon, st.r] : [1, st.id, st.name, st.place]), p = b64e(j);
    return p + "." + (hash("fs-station|" + j) % 1e6).toString(36).padStart(4, "0");
  }
  function decode(code) {
    try {
      var m = /^([A-Za-z0-9_-]{8,400})\.([a-z0-9]{4,5})$/.exec(String(code || "")); if (!m) return null;
      var j = b64d(m[1]); if ((hash("fs-station|" + j) % 1e6).toString(36).padStart(4, "0") !== m[2]) return null;
      var a = JSON.parse(j); if (!Array.isArray(a) || a[0] !== 1) return null;
      return make({ id: a[1], name: a[2], place: a[3], lat: a.length > 4 ? a[4] : null, lon: a.length > 4 ? a[5] : null, r: a[6] });
    } catch (e) { return null; }
  }
  function link(st, base) { var c = encode(st); return c ? String(base || "").replace(/#.*$/, "") + "#/st/" + c : ""; }
  function spotId(st) { return "c-st-" + st.id; }
  /** Meters between two points. */
  function meters(a, b) {
    var R = 6371000, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
    var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /** Is this spot close enough? (true when the station has no location check) pos = { lat, lon, acc } */
  function near(st, pos) { if (st.lat == null) return true; if (!pos) return false; return meters(st, pos) <= st.r + Math.min(+pos.acc || 0, 200); }
  /** Give one person the station's stamp for the day. "new" = first time, "again" = a new day, "today" = already got it today. */
  function award(p, st, day) {
    if (!p || !st || !DAY.test(day || "")) return "";
    var sp = p.spots && typeof p.spots === "object" ? p.spots : (p.spots = {}), id = spotId(st), v = sp[id];
    if (v && Array.isArray(v.days) && v.days.indexOf(day) >= 0) return "today";
    if (v && !Array.isArray(v.days) && v.at === day) return "today";
    if (!v) { sp[id] = { at: day, name: st.name, sub: st.place, days: [day] }; return "new"; }
    v.days = (Array.isArray(v.days) ? v.days : [v.at].filter(Boolean)).concat([day]).slice(-30); v.name = st.name; v.sub = st.place;
    if (!v.at || v.at > day) v.at = day;
    return "again";
  }
  function visits(p, st) { var v = p && p.spots && p.spots[spotId(st)]; return v ? (Array.isArray(v.days) ? v.days.length : 1) : 0; }
  var core = { RADII: RADII, newId: newId, make: make, encode: encode, decode: decode, link: link, spotId: spotId, meters: meters, near: near, award: award, visits: visits };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function esc(s) { return M().esc(s); }
  function mine() { var l = A().state.meta.stations; return Array.isArray(l) ? l : []; }
  var qrP = null;
  function needQR() {
    if (window.qrcode) return Promise.resolve();
    if (!qrP) qrP = new Promise(function (res, rej) { var s = document.createElement("script"); s.src = "vendor/qrcode.js"; s.onload = res; s.onerror = function () { qrP = null; rej(new Error("offline")); }; document.head.appendChild(s); });
    return qrP;
  }
  function qrSVG(text) {
    var q = window.qrcode(0, "M"); q.addData(text); q.make();
    var n = q.getModuleCount(), pad = 4, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += "M" + (x + pad) + " " + (y + pad) + "h1v1h-1z";
    return '<svg class="qr" viewBox="0 0 ' + (n + 2 * pad) + ' ' + (n + 2 * pad) + '" role="img" aria-label="QR code for this stamp station" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  function stampFor(st, day) { return window.FS_SPOTS ? window.FS_SPOTS.stampSVG({ id: spotId(st), cat: "cities", name: st.name, sub: st.place, art: "station", extra: "station", dyn: 1 }, day || "") : ""; }
  function listView() {
    var l = mine(); document.title = "Stamp stations";
    A().main.innerHTML = '<h1>📍 Stamp stations</h1><p class="muted">Make a QR poster for a library, museum, shop or anywhere families visit. Scanning it with a phone that has ' + esc(brand().NAME) + ' gives each person there a stamp for that place (once a day each).</p>' +
      '<div class="actions"><a class="btn btn-primary" href="#/stations/new">➕ Create a station</a></div>' +
      (brand().CONTACT ? '<p class="small muted stpartners">Run a park, library, museum or attraction and want an official station? Email <a href="mailto:' + esc(brand().CONTACT.partners) + '?subject=' + encodeURIComponent(brand().NAME + " stamp station") + '">' + esc(brand().CONTACT.partners) + '</a>.</p>' : "") +
      (l.length ? '<h2>Made on this phone</h2><ul class="stlist">' + l.map(function (st) { return '<li><a href="#/stations/poster/' + esc(st.id) + '"><b>' + esc(st.name) + '</b>' + (st.place ? ' · ' + esc(st.place) : "") + (st.lat != null ? ' <span class="small muted">📍 location check</span>' : "") + '</a></li>'; }).join("") + '</ul>' : "");
  }
  var spot = null;
  function newView() {
    document.title = "Create a stamp station";
    A().main.innerHTML = '<a class="back" href="#/stations">← Stamp stations</a><h1>➕ Create a stamp station</h1><div class="panel">' +
      '<div class="field"><label for="stname">Name on the stamp</label><input id="stname" maxlength="40" placeholder="e.g. Main Street Library"></div>' +
      '<div class="field"><label for="stplace">Town or place</label><input id="stplace" maxlength="40" placeholder="e.g. Springfield"></div>' +
      '<label class="chk"><input type="checkbox" id="stgeo"' + (spot ? " checked" : "") + '> Only give the stamp near this spot (asks the phone where it is)</label>' +
      '<div id="stgeobox"' + (spot ? "" : " hidden") + '><p class="small" id="stspot">' + (spot ? "📍 Spot saved (" + spot.lat.toFixed(4) + ", " + spot.lon.toFixed(4) + ")" : "Stand where the poster will hang and tap the button.") + '</p>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="sthere">📍 Use where I am now</button> <label class="small">Within <select id="strad">' + RADII.map(function (r) { return '<option value="' + r + '"' + (r === 400 ? " selected" : "") + '>' + (r >= 1000 ? (r / 1000) + " km" : r + " m") + '</option>'; }).join("") + '</select></label></div>' +
      '<p class="sterr small" role="alert"></p><div class="actions"><button type="button" class="btn btn-primary" id="stmake">Make the poster</button></div></div>';
    var $ = function (q) { return A().main.querySelector(q); };
    $("#stgeo").onchange = function () { $("#stgeobox").hidden = !this.checked; };
    $("#sthere").onclick = function () {
      if (!navigator.geolocation) { $("#stspot").textContent = "This phone can't share its location."; return; }
      $("#stspot").textContent = "Finding this spot…";
      navigator.geolocation.getCurrentPosition(function (p) { spot = { lat: p.coords.latitude, lon: p.coords.longitude }; $("#stspot").textContent = "📍 Spot saved (" + spot.lat.toFixed(4) + ", " + spot.lon.toFixed(4) + ")"; },
        function () { $("#stspot").textContent = "Couldn't get the location. Check that location is allowed for this site."; }, { enableHighAccuracy: true, timeout: 12000 });
    };
    $("#stmake").onclick = function () {
      var geo = $("#stgeo").checked;
      if (geo && !spot) { $(".sterr").textContent = "Tap “Use where I am now” first, or untick the location check."; return; }
      var st = make({ id: newId(), name: $("#stname").value, place: $("#stplace").value, lat: geo ? spot.lat : null, lon: geo ? spot.lon : null, r: +$("#strad").value });
      if (!st) { $(".sterr").textContent = "Give the station a name."; return; }
      st.at = new Date().toISOString(); spot = null;
      A().setMeta("stations", [st].concat(mine()).slice(0, 40)).then(function () { location.hash = "#/stations/poster/" + st.id; });
    };
  }
  function posterView(id) {
    var st = mine().filter(function (x) { return x.id === id; })[0]; if (!st) { location.hash = "#/stations"; return; }
    var b = brand(), url = link(st, b.appUrl()); document.title = "Poster · " + st.name;
    document.body.classList.add("stposterview");
    A().main.innerHTML = '<div class="noprint"><a class="back" href="#/stations">← Stamp stations</a><div class="actions"><button type="button" class="btn btn-primary" id="stprint">🖨️ Print or save as PDF</button><button type="button" class="btn btn-ghost" id="stcopy">🔗 Copy the link</button><button type="button" class="btn btn-ghost" id="stdel">Delete</button></div></div>' +
      '<div class="stposter"><div class="stlogo">' + (b.logoSVG ? b.logoSVG(b.INK) : esc(b.NAME)) + '</div><h1>Collect a stamp here!</h1><p class="stwhere">' + esc(st.name) + (st.place ? '<br><span>' + esc(st.place) + '</span>' : "") + '</p>' +
      '<div class="stqr" id="stqr">Loading the QR code…</div><div class="ststamp">' + stampFor(st, "") + '</div>' +
      '<ol class="ststeps"><li>Open your phone\'s camera and point it at the code.</li><li>Tap the link, pick who\'s here, and tap <b>Collect</b>.</li><li>The stamp goes in your ' + esc(b.NAME) + ' passport. One stamp per person per day.</li></ol>' +
      (st.lat != null ? '<p class="small">This station checks that you\'re here, so allow location when asked.</p>' : "") + '<p class="stfoot">' + esc(b.NAME + " · " + (b.URL_TEXT || "")) + '</p></div>';
    var $ = function (q) { return A().main.querySelector(q); };
    needQR().then(function () { var el = $("#stqr"); if (el) el.innerHTML = qrSVG(url); }, function () { var el = $("#stqr"); if (el) el.textContent = "The QR code needs a connection the first time. Try again when you're online."; });
    $("#stprint").onclick = function () { window.print(); };
    $("#stcopy").onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { A().toast("Link copied"); }, function () { prompt("Copy this link", url); }); };
    $("#stdel").onclick = function () { if (!confirm("Delete this station from this phone? Posters already printed keep working.")) return; A().setMeta("stations", mine().filter(function (x) { return x.id !== id; })).then(function () { location.hash = "#/stations"; }); };
  }
  var PEND = "fs-st-pending";
  function scanView(code) {
    var st = decode(code); document.title = "Stamp station";
    if (!st) { A().main.innerHTML = '<h1>Hmm, that code didn\'t work</h1><p>This stamp station link looks broken. Try scanning the poster again.</p><p><a href="#/">Go home</a></p>'; return; }
    var people = (A().state.kids || []).filter(function (p) { return !p.deletedAt; }), day = M().today(), kids = people.filter(function (p) { return p.role === "kid" || p.kid; });
    if (!people.length) {
      try { localStorage.setItem(PEND, code); } catch (e) {}
      A().main.innerHTML = '<h1>📍 ' + esc(st.name) + '</h1><p>Add your family first, then come back to collect this stamp. We\'ll remind you on the home page.</p><p><a class="btn btn-primary" href="#/">Start my passport</a></p>'; return;
    }
    var on = {}; (kids.length ? kids : people).forEach(function (p) { on[p.id] = 1; });
    function draw(msg) {
      A().main.innerHTML = '<h1>📍 ' + esc(st.name) + '</h1>' + (st.place ? '<p class="muted">' + esc(st.place) + '</p>' : "") +
        '<div class="stbig">' + stampFor(st, day) + '</div><h3>Who\'s here?</h3><div class="wwho">' + people.map(function (p) {
          var got = (p.spots && p.spots[spotId(st)] && (p.spots[spotId(st)].days || [p.spots[spotId(st)].at]).indexOf(day) >= 0);
          return '<button type="button" class="chip' + (on[p.id] && !got ? " on" : "") + '" data-p="' + esc(p.id) + '" style="' + A().kidStyle(p) + '"' + (got ? " disabled" : "") + '>' + esc(M().who(p)) + (got ? " ✓ today" : "") + '</button>'; }).join("") + '</div>' +
        (st.lat != null ? '<p class="small muted">This station checks that you\'re here, so allow location when asked.</p>' : "") +
        '<p class="sterr small" role="alert">' + esc(msg || "") + '</p><div class="actions"><button type="button" class="btn btn-primary" id="stgo">Collect</button></div>';
      A().main.querySelectorAll("[data-p]").forEach(function (b) { b.onclick = function () { if (on[b.dataset.p]) delete on[b.dataset.p]; else on[b.dataset.p] = 1; b.classList.toggle("on"); }; });
      A().main.querySelector("#stgo").onclick = go;
    }
    function where() {
      if (st.lat == null) return Promise.resolve(null);
      return new Promise(function (res, rej) {
        if (!navigator.geolocation) return rej(new Error("This phone can't share its location, and this station needs it."));
        navigator.geolocation.getCurrentPosition(function (p) { res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }); },
          function () { rej(new Error("We need your location to give this stamp. Allow location for this site and try again.")); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
      });
    }
    function go() {
      var ids = Object.keys(on).filter(function (id) { var b = A().main.querySelector('[data-p="' + id + '"]'); return b && !b.disabled; });
      if (!ids.length) { draw(A().main.querySelector("[data-p]:not([disabled])") ? "Pick who's here." : "Everyone already has today's stamp. Come back another day!"); return; }
      where().then(function (pos) {
        if (!near(st, pos)) throw new Error("Looks like you're not at " + st.name + " yet. Try again when you're there.");
        var got = [], jobs = [];
        ids.forEach(function (id) { var p = A().kidById(id), r = award(p, st, day); if (r === "new" || r === "again") { got.push({ p: p, r: r }); p.updatedAt = new Date().toISOString(); jobs.push(A().saveKid(p)); } });
        try { localStorage.removeItem(PEND); } catch (e) {}
        return Promise.all(jobs).then(function () {
          if (!got.length) { draw("Everyone already has today's stamp. Come back another day!"); return; }
          A().toast("📍 " + st.name + " stamp for " + got.map(function (g) { return M().who(g.p); }).join(", "));
          A().main.innerHTML = '<h1>🎉 Stamped!</h1><div class="stbig">' + stampFor(st, day) + '</div><p>' + got.map(function (g) { return esc(M().who(g.p)) + (g.r === "again" ? " (visit " + visits(g.p, st) + ")" : " (new stamp!)"); }).join("<br>") + '</p>' +
            '<div class="actions"><a class="btn btn-primary" href="#/p/' + esc(got[0].p.id) + '/parks/cities">See it in the passport</a><a class="btn btn-ghost" href="#/">Home</a></div>';
        });
      }).catch(function (e) { draw(e.message); });
    }
    draw("");
  }
  function homeCard() {
    var c = ""; try { c = localStorage.getItem(PEND) || ""; } catch (e) {}
    var st = c && decode(c); if (!st || !(A().state.kids || []).length) return "";
    return '<a class="panel familycard" href="#/st/' + esc(c) + '"><span class="fam-ic" aria-hidden="true">📍</span><span><h3>Collect your ' + esc(st.name) + ' stamp</h3><span class="small">You scanned a stamp station. Tap to add it.</span></span></a>';
  }
  window.addEventListener("hashchange", function () { if (!/^#\/stations\/poster\//.test(location.hash)) document.body.classList.remove("stposterview"); });
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) {
    if (h[0] === "st") { scanView(decodeURIComponent(h[1] || "")); return true; }
    if (h[0] !== "stations") return false;
    if (h[1] === "new") newView(); else if (h[1] === "poster") posterView(h[2] || ""); else listView();
    return true;
  });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(homeCard);
  core.qrSVG = qrSVG; core.needQR = needQR;
  return core;
});
