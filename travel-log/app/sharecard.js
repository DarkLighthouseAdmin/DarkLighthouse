/* Famstamp: a story-size share card (1080x1920) for any passport stamp, drawn on this phone (no upload, no server).
   Private by default: no kid's name and no photos (so no faces); a toggle adds the first name. Share with the phone's
   share sheet or download the PNG. The app name and logo come from brand.js. Route: #/sharecard/<personId>/<kind>/<area>. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(typeof require === "function" ? require("./brand.js") : null);
  else root.FS_SHARECARD = factory(root.FS_BRAND);
})(typeof self !== "undefined" ? self : this, function (BR) {
  "use strict";
  var W = 1080, H = 1920;
  var KICK = { state: "NEW STATE STAMP", place: "NEW COUNTRY STAMP", park: "NEW PARK STAMP" };
  function brand() { return BR || (typeof self !== "undefined" && self.FS_BRAND) || { NAME: "Famstamp", URL_TEXT: "" }; }
  /** The words on the card. o = { kind, name, date (pretty), who (first name), includeName } */
  function lines(o) {
    var b = brand(), first = String(o.who || "").trim().split(/\s+/)[0] || "";
    return { kicker: KICK[o.kind] || "NEW STAMP", title: String(o.name || ""), date: String(o.date || ""),
             who: o.includeName && first ? first + "'s passport" : "", footer: "Collected with " + b.NAME + (b.URL_TEXT ? " · " + b.URL_TEXT : "") };
  }
  /** Split a title into at most 3 lines of about max characters. */
  function wrap(t, max) {
    var words = String(t).split(/\s+/), out = [], cur = "";
    words.forEach(function (w) { if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; });
    if (cur) out.push(cur);
    if (out.length > 3) out = out.slice(0, 2).concat([out.slice(2).join(" ")]);
    return out;
  }
  function fileName(name) { return (brand().NAME + "-" + String(name || "stamp")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png"; }
  var core = { W: W, H: H, lines: lines, wrap: wrap, fileName: fileName };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function X() { return window.FS_SX; }
  /** Draw the card; resolves to a PNG blob. */
  function render(st, nm, sub, L) {
    var b = brand(), c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d");
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#fbf6ea"); bg.addColorStop(1, "#efe3c8"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = 0.07; g.strokeStyle = b.INK || "#16283a"; g.lineWidth = 3;
    for (var y = 120; y < H; y += 64) { g.beginPath(); g.moveTo(60, y); g.lineTo(W - 60, y); g.stroke(); } g.restore();
    g.strokeStyle = b.INK || "#16283a"; g.lineWidth = 8; g.setLineDash([26, 14]); g.strokeRect(40, 40, W - 80, H - 80); g.setLineDash([]);
    var svgStamp = window.WK_PASSPORT.stampSVG(st, nm, { sub: sub });
    return Promise.all([X().loadImg(X().svgURL(b.logoSVG ? b.logoSVG(b.INK || "#16283a") : "<svg/>")), X().loadImg(X().svgURL(svgStamp))]).then(function (im) {
      if (im[0]) g.drawImage(im[0], (W - 600) / 2, 110, 600, 200);
      if (im[1]) { g.save(); g.translate(W / 2, 830); g.rotate(-0.06); g.globalCompositeOperation = "multiply"; g.drawImage(im[1], -420, -420, 840, 840); g.restore(); }
      g.textAlign = "center"; g.fillStyle = b.ACCENT || "#c8553d"; g.font = "800 44px 'Helvetica Neue', Arial, sans-serif";
      g.fillText(L.kicker.split("").join(String.fromCharCode(8202)), W / 2, 1360);
      g.fillStyle = b.INK || "#16283a"; var tl = wrap(L.title, 16), fs = tl.length > 2 ? 86 : 104; g.font = "700 " + fs + "px Georgia, 'Times New Roman', serif";
      var y0 = 1480; tl.forEach(function (t, i) { g.fillText(t, W / 2, y0 + i * (fs + 14)); }); var yy = y0 + tl.length * (fs + 14);
      g.font = "500 50px ui-monospace, Menlo, Consolas, monospace"; if (L.date) { g.fillText(L.date, W / 2, yy + 10); yy += 76; }
      if (L.who) { g.font = "italic 600 52px Georgia, serif"; g.fillText(L.who, W / 2, yy + 14); }
      g.font = "600 34px 'Helvetica Neue', Arial, sans-serif"; g.globalAlpha = 0.75; g.fillText(L.footer, W / 2, H - 100); g.globalAlpha = 1;
      return new Promise(function (res) { c.toBlob(function (bl) { res(bl); }, "image/png"); });
    });
  }
  var lastURL = null;
  function view(pid, kind, area) {
    var F = X().find(pid, kind, area); if (!F) { location.hash = "#/"; return; }
    var esc = M().esc, who = M().who(F.p), withName = false, blob = null;
    document.title = "Share card · " + F.name;
    A().main.innerHTML = '<a class="back" href="#/p/' + esc(F.p.id) + '/passport">← ' + esc(who) + '\'s passport</a><h1>📲 Share card</h1>' +
      '<p class="muted">A story-size picture of the ' + esc(F.name) + ' stamp, made on this phone. It has no name or photos unless you add the name.</p>' +
      '<label class="chk"><input type="checkbox" id="scname"> Add “' + esc((String(who).split(/\s+/)[0] || who)) + '’s passport” to the card</label>' +
      '<div class="scwrap"><img id="scimg" alt="The share card for the ' + esc(F.name) + ' stamp" width="270" height="480"></div>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="scshare">📤 Share</button><button type="button" class="btn btn-ghost" id="scdl">⬇️ Download</button></div>';
    var $ = function (q) { return A().main.querySelector(q); };
    function draw() {
      var L = lines({ kind: F.s.kind, name: F.name, date: window.WK_PASSPORT.fmtDate(F.s.date), who: who, includeName: withName });
      blob = null;
      return render(Object.assign({}, F.s, { holder: F.p.id }), F.name, F.sub, L).then(function (bl) {
        blob = bl; if (lastURL) URL.revokeObjectURL(lastURL); lastURL = URL.createObjectURL(bl); var im = $("#scimg"); if (im) im.src = lastURL;
      });
    }
    var ready = draw();
    $("#scname").onchange = function () { withName = this.checked; ready = draw(); };
    $("#scshare").onclick = function () { ready.then(function () { if (blob) X().shareFile(blob, fileName(F.name), F.name).then(function (r) { if (r === "downloaded") A().toast("Saved the picture"); }); }); };
    $("#scdl").onclick = function () { ready.then(function () { if (blob) { X().download(blob, fileName(F.name)); A().toast("Saved the picture"); } }); };
  }
  /** Home: the newest stamp from the last 3 days gets a share-card nudge. */
  function homeCard() {
    var best = A().memo ? A().memo("sharecard-home", bestNew) : bestNew();   // v109: memoized for big logs
    if (!best) return "";
    return homeCardHTML(best);
  }
  function bestNew() {
    var P = window.WK_PASSPORT, since = M().addDays(M().today(), -3), best = null;
    (A().state.kids || []).forEach(function (p) {
      P.stampsFor(p, A().state.trips, { parkStates: M().PARK_STATES }).forEach(function (s) {
        if (s.source !== "map" && s.date && s.date >= since && s.date <= M().today() && (!best || s.date > best.s.date)) best = { p: p, s: s };
      });
    });
    return best;
  }
  function homeCardHTML(best) {
    return '<a class="panel familycard sccard" href="#/sharecard/' + X().path(best.s, best.p.id) + '"><span class="fam-ic" aria-hidden="true">📲</span><span><h3>Share the new ' + M().esc(X().name(best.s)) + ' stamp</h3><span class="small">A story-size card, made on this phone. No names or photos unless you add them.</span></span></a>';
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "sharecard") return false; view(decodeURIComponent(h[1] || ""), h[2], decodeURIComponent(h[3] || "")); return true; });
  (window.FS_STAMPX = window.FS_STAMPX || []).push(function (s, holder, path) { return '<a class="btn btn-ghost btn-sm" href="#/sharecard/' + path + '">📲 Share card</a>'; });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(homeCard);
  core.render = render; core.homeCard = homeCard;
  return core;
});
