/* Famstamp: kid-designed stamps (v65). A kid draws a stamp for a place, a grown-up snaps a photo, crops it into the circle,
   and it becomes that kid's stamp for that place: in the passport, the stamp sheet, the printed book and share cards.
   Data, on the person (synced in Family Sync's people JSON; no database change):
     person.stampArt = { "<kind>:<area>": "data:image/jpeg;base64,..." }   (kind = state | place | park; a 256px circle crop)
   Route: #/kidart/<personId>/<kind>/<area>. The core runs in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_KIDART = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MAX = 60, MAX_LEN = 90000, SIZE = 256, KINDS = { state: 1, place: 1, park: 1 };
  var INKS = ["#1f4f9e", "#b02a2a", "#2b7340", "#5f35a0", "#8a4a17", "#17608a"];
  var DATA = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function key(kind, area) { return KINDS[kind] && /^[A-Za-z0-9_-]{1,40}$/.test(area || "") ? kind + ":" + area : ""; }
  function okData(u) { return typeof u === "string" && u.length <= MAX_LEN && DATA.test(u); }
  function get(p, kind, area) { var k = key(kind, area), o = p && p.stampArt; return k && o && typeof o === "object" && okData(o[k]) ? o[k] : ""; }
  /** Set (or with "" remove) a kid's art for a place. Returns true when it changed. */
  function set(p, kind, area, url) {
    var k = key(kind, area); if (!p || !k) return false;
    var o = p.stampArt && typeof p.stampArt === "object" ? p.stampArt : {};
    if (!url) { if (!o[k]) return false; delete o[k]; p.stampArt = o; return true; }
    if (!okData(url)) return false;
    if (!o[k] && Object.keys(o).length >= MAX) return false;
    o[k] = url; p.stampArt = o; return true;
  }
  function count(p) { return p && p.stampArt && typeof p.stampArt === "object" ? Object.keys(p.stampArt).length : 0; }
  var uidN = 0;
  /** The kid's stamp: their drawing in a perforated circle, the place name around the top and the date along the bottom.
      viewBox 160x160 like every other stamp. */
  function svg(url, name, date) {
    if (!okData(url)) return "";
    var h = hash(name || ""), ink = INKS[h % INKS.length], id = "ka" + (++uidN) + "x" + (h % 1e5), N = String(name || "").toUpperCase().slice(0, 28);
    var nf = Math.min(15, 210 / Math.max(1, N.length * 0.72)), D = String(date || "").toUpperCase(), df = D ? Math.min(11, 150 / Math.max(1, D.length * 0.66)) : 0;
    var arc = function (pid, r, a0, a1, sw) { var p = function (a) { var t = a * Math.PI / 180; return (80 + r * Math.cos(t)).toFixed(2) + "," + (80 + r * Math.sin(t)).toFixed(2); }; return '<path id="' + pid + '" d="M' + p(a0) + " A" + r + "," + r + " 0 1 " + sw + " " + p(a1) + '"/>'; };
    return '<svg xmlns="http://www.w3.org/2000/svg" class="stampsvg kidstamp" viewBox="0 0 160 160" role="img" aria-label="' + esc((name || "") + (date ? ", " + date : "") + ", a kid-drawn stamp") + '">' +
      '<defs><clipPath id="' + id + 'c"><circle cx="80" cy="80" r="50"/></clipPath>' + arc(id + "t", 60, 150, 390, 1) + (D ? arc(id + "b", 68.5, 220, -40, 0) : "") + '</defs>' +
      '<circle cx="80" cy="80" r="78" fill="#fffdf6"/>' +
      '<circle cx="80" cy="80" r="76" fill="none" stroke="' + ink + '" stroke-width="4.4" stroke-dasharray="3 2.4"/><circle cx="80" cy="80" r="71.5" fill="none" stroke="' + ink + '" stroke-width="1.4"/>' +
      '<image href="' + url + '" x="30" y="30" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + 'c)"/>' +
      '<circle cx="80" cy="80" r="50.6" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
      '<g fill="' + ink + '" font-weight="800" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif">' +
      '<text font-size="' + nf.toFixed(1) + '"><textPath href="#' + id + 't" startOffset="50%">' + esc(N) + '</textPath></text>' +
      (D ? '<text font-size="' + df.toFixed(1) + '" font-family="ui-monospace, Menlo, Consolas, monospace"><textPath href="#' + id + 'b" startOffset="50%">' + esc(D) + '</textPath></text>' : "") +
      '<path d="M80 143.5l1.4 2.8 3.1.5-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.5z"/></g></svg>';
  }
  /** Where a crop window sits on the photo: scale (>=1 = zoom in), offsets in -1..1 of the free room. Returns source rect. */
  function cropRect(w, h, zoom, ox, oy) {
    var side = Math.min(w, h) / Math.max(1, zoom || 1), fx = (w - side) / 2, fy = (h - side) / 2;
    var cl = function (v) { return Math.max(-1, Math.min(1, +v || 0)); };
    return { x: fx + cl(ox) * fx, y: fy + cl(oy) * fy, s: side };
  }
  var core = { MAX: MAX, MAX_LEN: MAX_LEN, SIZE: SIZE, key: key, okData: okData, get: get, set: set, count: count, svg: svg, cropRect: cropRect };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  /** Used by passport-core's stampSVG: the kid's own art when the stamp's person (or only person) drew one. */
  core.svgFor = function (s, name, date) {
    var who = s && s.holder ? [s.holder] : (s && s.who) || []; if (!who.length || !A()) return "";
    for (var i = 0; i < who.length; i++) { var p = A().kidById(who[i]), u = get(p, s.kind, s.area); if (u) return svg(u, name, date); }
    return "";
  };
  var pick = null;   // { img, zoom, ox, oy, key }
  function view(pid, kind, area) {
    var X = window.FS_SX.find(pid, kind, area); if (!X) { location.hash = "#/"; return; }
    var p = X.p, s = X.s, have = get(p, kind, area), who = M().who(p), esc_ = M().esc;
    document.title = "Draw a stamp · " + who;
    var k = pid + kind + area; if (pick && pick.key !== k) pick = null;
    A().main.innerHTML = '<a class="back" href="#/p/' + esc_(p.id) + '/passport">← ' + esc_(who) + '\'s passport</a><h1>🎨 ' + esc_(who) + ' designs the ' + esc_(X.name) + ' stamp</h1>' +
      '<p class="muted">Draw a stamp for ' + esc_(X.name) + ' on paper (a circle about the size of a cup works well), then take a photo of it. It becomes ' + esc_(who) + '\'s stamp for this place in the passport and the printed book.</p>' +
      '<div class="kagrid"><figure class="kaprev"><div class="kastamp">' + window.WK_PASSPORT.stampSVG(Object.assign({}, s, { holder: p.id }), X.name, { sub: X.sub }) + '</div><figcaption>' + (have ? "Now" : "The stamp now") + '</figcaption></figure>' +
      (pick ? '<figure class="kacrop"><canvas id="kacv" width="300" height="300" aria-label="Drag to move the drawing in the circle"></canvas><figcaption>Drag to move · zoom below</figcaption>' +
        '<input type="range" id="kazoom" min="1" max="3" step="0.05" value="' + pick.zoom + '" aria-label="Zoom"></figure>' : "") + '</div>' +
      '<div class="actions">' + (pick ? '<button type="button" class="btn btn-primary" id="kasave">✅ Make it ' + esc_(who) + '\'s stamp</button>' : "") +
      '<label class="btn ' + (pick ? "btn-ghost" : "btn-primary") + ' wpick">📷 ' + (pick ? "Use a different photo" : "Photo of the drawing") + '<input type="file" id="kafile" accept="image/*" hidden></label>' +
      (have && !pick ? '<button type="button" class="btn btn-ghost" id="kaoff">Go back to the regular stamp</button>' : "") + '</div>';
    var $ = function (q) { return A().main.querySelector(q); };
    $("#kafile").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      A().shrinkPhoto(f).then(function (u) { var im = new Image(); im.onload = function () { pick = { img: im, zoom: 1, ox: 0, oy: 0, key: k }; view(pid, kind, area); }; im.src = u; })
        .catch(function () { A().toast("Couldn't read that photo. Try another one."); });
    };
    if ($("#kaoff")) $("#kaoff").onclick = function () { if (set(p, kind, area, "")) { p.updatedAt = new Date().toISOString(); A().saveKid(p).then(function () { A().toast("Back to the regular stamp"); view(pid, kind, area); }); } };
    if (!pick) return;
    var cv = $("#kacv"), ctx = cv.getContext("2d");
    function draw(c, size) {
      var r = cropRect(pick.img.naturalWidth, pick.img.naturalHeight, pick.zoom, pick.ox, pick.oy), g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
      g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip();
      g.drawImage(pick.img, r.x, r.y, r.s, r.s, 0, 0, size, size); g.restore();
    }
    function paint() { draw(cv, 300); ctx.strokeStyle = "rgba(22,40,58,.6)"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(150, 150, 148, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    paint();
    $("#kazoom").oninput = function () { pick.zoom = +this.value; paint(); };
    var drag = null;
    cv.onpointerdown = function (e) { drag = { x: e.clientX, y: e.clientY, ox: pick.ox, oy: pick.oy }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = function (e) { if (!drag) return; pick.ox = Math.max(-1, Math.min(1, drag.ox - (e.clientX - drag.x) / 120)); pick.oy = Math.max(-1, Math.min(1, drag.oy - (e.clientY - drag.y) / 120)); paint(); };
    cv.onpointerup = cv.onpointercancel = function () { drag = null; };
    $("#kasave").onclick = function () {
      var c = document.createElement("canvas"); c.width = c.height = SIZE; draw(c, SIZE);
      var q = 0.82, u = c.toDataURL("image/jpeg", q); while (u.length > MAX_LEN && q > 0.4) { q -= 0.1; u = c.toDataURL("image/jpeg", q); }
      if (!set(p, kind, area, u)) { A().toast(count(p) >= MAX ? "That's the most drawn stamps one person can have (" + MAX + ")." : "That photo didn't work. Try another."); return; }
      p.updatedAt = new Date().toISOString(); pick = null;
      A().saveKid(p).then(function () { A().toast("🎨 " + who + "'s own " + X.name + " stamp is in the passport"); location.hash = "#/p/" + p.id + "/passport"; });
    };
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "kidart") return false; view(decodeURIComponent(h[1] || ""), h[2], decodeURIComponent(h[3] || "")); return true; });
  (window.FS_STAMPX = window.FS_STAMPX || []).push(function (s, holder, path) { return '<a class="btn btn-ghost btn-sm" href="#/kidart/' + path + '">🎨 ' + (get(holder, s.kind, s.area) ? "Change the drawn stamp" : "Draw this stamp") + '</a>'; });
  return core;
});
