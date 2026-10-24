/* Famstamp: rewards at 3, 5, 10, 20 stamps per person (#/p/<id>/rewards) and a printable certificate for each
   (#/p/<id>/cert/<n>, print or save as PDF). Original artwork: a stamp-style border, stars and a compass rose, no
   animals, no park-service marks. A stamp is a colored-in state, country (the USA itself doesn't count), park, city or
   food stamp, or a road-trip game stamp. The counting part runs in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_REWARDS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var LEVELS = [
    { n: 3, name: "Explorer", line: "took the first steps of a great adventure", color: "#b8743a", ic: "🥉" },
    { n: 5, name: "Trailblazer", line: "kept on going and found new places", color: "#6f8796", ic: "🥈" },
    { n: 10, name: "Globetrotter", line: "collected ten travel stamps", color: "#c9962b", ic: "🥇" },
    { n: 20, name: "Master Voyager", line: "collected twenty travel stamps", color: "#2c6e8f", ic: "🏆" }
  ];
  var DATE = /^\d{4}-\d{2}-\d{2}/;
  /** Every stamp a person has, as dates ("" when undated). */
  function stamps(p) {
    var out = [];
    function bag(o, skip) { Object.keys(o || {}).forEach(function (id) { if (!skip || !skip(id)) out.push(String((o[id] && o[id].at) || "")); }); }
    if (!p) return out;
    bag(p.states); bag(p.places, function (id) { return id === "USA"; }); bag(p.parks);
    bag(p.spots, function (id) { return /^(p-|e_)/.test(id); });   // pubs and your-own entries aren't kids' stamps
    bag(p.games);
    return out;
  }
  function count(p) { return stamps(p).length; }
  /** Levels reached: [{ n, name, at }] (at = the day the nth dated stamp came, "" when that can't be told). */
  function earned(p) {
    var all = stamps(p), dated = all.filter(function (d) { return DATE.test(d); }).map(function (d) { return d.slice(0, 10); }).sort();
    return LEVELS.filter(function (L) { return all.length >= L.n; }).map(function (L) {
      return { n: L.n, name: L.name, at: dated.length >= L.n && dated.length === all.length ? dated[L.n - 1] : "" };
    });
  }
  function next(p) { var c = count(p); return LEVELS.filter(function (L) { return c < L.n; })[0] || null; }
  function level(n) { return LEVELS.filter(function (L) { return L.n === +n; })[0] || null; }
  /** Levels reached that this phone hasn't celebrated yet. seen = { personId: highest n shown } */
  function fresh(people, seen) {
    seen = seen || {}; var out = [];
    (people || []).forEach(function (p) { var e = earned(p), top = e.length ? e[e.length - 1].n : 0; if (top > (+seen[p.id] || 0)) out.push({ p: p, n: top }); });
    return out;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /** A medal: a round stamp with a star in the middle (original art). */
  function medal(L, on) {
    var c = on ? L.color : "#c9c3b8", pts = [];
    for (var i = 0; i < 10; i++) { var r = i % 2 ? 13 : 30, a = Math.PI / 5 * i - Math.PI / 2; pts.push((50 + r * Math.cos(a)).toFixed(1) + "," + (50 + r * Math.sin(a)).toFixed(1)); }
    return '<svg viewBox="0 0 100 100" class="rmedal" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="' + c + '" stroke-width="4" stroke-dasharray="3 3"/>' +
      '<circle cx="50" cy="50" r="40" fill="' + (on ? c : "#eee9e0") + '" opacity="' + (on ? ".18" : "1") + '"/><polygon points="' + pts.join(" ") + '" fill="' + c + '"/>' +
      '<text x="50" y="94" font-size="0" fill="' + c + '">' + L.n + '</text></svg>';
  }
  /** The certificate itself (letter landscape). o: { name, n, date, family } */
  function certHTML(o) {
    var L = level(o.n) || LEVELS[0], c = L.color, rays = "";
    for (var i = 0; i < 16; i++) { var a = Math.PI / 8 * i, r = i % 2 ? 22 : 40; rays += '<line x1="50" y1="50" x2="' + (50 + r * Math.cos(a)).toFixed(1) + '" y2="' + (50 + r * Math.sin(a)).toFixed(1) + '" stroke="' + c + '" stroke-width="' + (i % 2 ? 1.5 : 3) + '"/>'; }
    var rose = '<svg viewBox="0 0 100 100" class="crose" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="' + c + '" stroke-width="2"/><circle cx="50" cy="50" r="38" fill="none" stroke="' + c + '" stroke-width="1" stroke-dasharray="2 3"/>' + rays +
      '<polygon points="50,8 56,50 50,92 44,50" fill="' + c + '"/><polygon points="8,50 50,44 92,50 50,56" fill="' + c + '" opacity=".6"/><circle cx="50" cy="50" r="5" fill="#fff" stroke="' + c + '" stroke-width="2"/></svg>';
    var stars = '<span class="cstars" aria-hidden="true" style="color:' + c + '">★ ★ ★</span>';
    return '<div class="cert" style="--cc:' + c + '"><div class="cin">' +
      '<div class="ctop">' + stars + '<span class="ckick">FAMSTAMP · FAMILY TRAVEL LOG</span>' + stars + '</div>' +
      '<h1 class="ctitle">Certificate of Adventure</h1><p class="cthis">This certifies that</p>' +
      '<p class="cname">' + esc(o.name) + '</p>' +
      '<p class="cline">' + esc(L.line) + ' and earned the rank of</p>' +
      '<div class="crank">' + rose + '<div><b>' + esc(L.name) + '</b><span>' + L.n + ' travel stamps</span></div>' + rose + '</div>' +
      '<div class="cfoot"><div><span class="csig">' + esc(o.date || "") + '</span><small>Date</small></div>' +
      '<div><span class="csig"></span><small>Signed, Chief Family Explorer' + (o.family ? " · " + esc(o.family) : "") + '</small></div></div>' +
      '</div></div>';
  }
  var core = { LEVELS: LEVELS, stamps: stamps, count: count, earned: earned, next: next, level: level, fresh: fresh, certHTML: certHTML, medal: medal };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function card(k) {
    var c = count(k), nx = next(k), e = earned(k);
    return '<a class="familycard qentry rentry" href="#/p/' + esc(k.id) + '/rewards"><span class="qemo" aria-hidden="true"><i>🏅</i></span><span><b>Rewards</b><span class="small muted">' +
      esc(c + (c === 1 ? " stamp" : " stamps") + (e.length ? " · " + e[e.length - 1].name : "") + (nx ? " · " + (nx.n - c) + " more for " + nx.name : " · every reward unlocked!")) + '</span></span></a>';
  }
  function seen() { return (A().state.meta.rewardsSeen) || {}; }
  function markSeen(pid, n) { var s = Object.assign({}, seen()); if ((+s[pid] || 0) < n) { s[pid] = n; A().setMeta("rewardsSeen", s); } }
  function view(k) {
    document.title = "Rewards · " + M().who(k) + " · Famstamp";
    var c = count(k), nx = next(k);
    var html = '<h2>🏅 Rewards</h2><p class="lede small">' + esc(M().who(k)) + ' has <b>' + c + '</b> ' + (c === 1 ? "stamp" : "stamps") + '. ' +
      (nx ? (nx.n - c) + ' more for <b>' + esc(nx.name) + '</b>.' : 'Every reward unlocked!') + ' Each reward comes with a certificate to print.</p><div class="rgrid">' +
      LEVELS.map(function (L) {
        var on = c >= L.n;
        return '<div class="rlevel panel' + (on ? " on" : "") + '">' + medal(L, on) + '<b>' + esc(L.name) + '</b><span class="small muted">' + L.n + ' stamps</span>' +
          (on ? '<a class="btn btn-primary btn-sm" href="#/p/' + esc(k.id) + '/cert/' + L.n + '">🖨️ Certificate</a>' : '<span class="rbar"><i style="width:' + Math.round(Math.min(1, c / L.n) * 100) + '%"></i></span><span class="small">' + c + ' / ' + L.n + '</span>') + '</div>';
      }).join("") + '</div><p class="small muted">Stamps are states, countries, parks, cities and food stamps, plus <a href="#/games">road-trip game stamps</a>. Need more? <a href="#/where">Quick-add places you\'ve been</a>.</p>';
    A().main.innerHTML = A().shell(k, "stats", html);
    var e = earned(k); if (e.length) markSeen(k.id, e[e.length - 1].n);
  }
  function cert(k, n) {
    var L = level(n);
    if (!L || count(k) < L.n) { location.hash = "#/p/" + k.id + "/rewards"; return; }
    document.title = L.name + " certificate · " + M().who(k);
    var e = earned(k).filter(function (x) { return x.n === L.n; })[0], fam = (A().state.meta.sync && A().state.meta.sync.familyName) || "";
    document.body.classList.add("certview");
    A().main.innerHTML = '<div class="noprint certbar"><a class="back" href="#/p/' + esc(k.id) + '/rewards">← Rewards</a> <button type="button" class="btn btn-primary" id="certprint">🖨️ Print or save as PDF</button>' +
      '<p class="small muted">Tip: pick "Save as PDF" in the print window to keep a copy. Landscape, letter size.</p></div>' +
      certHTML({ name: M().who(k), n: L.n, date: M().prettyDate(e && e.at ? e.at : M().today()), family: fam });
    document.getElementById("certprint").onclick = function () { window.print(); };
    markSeen(k.id, L.n);
  }
  /** Home: a celebration card for a reward this phone hasn't shown yet. */
  function homeCard() {
    var st = A().state, f = fresh(st.kids, seen()); if (!f.length) return "";
    var x = f[0], L = level(x.n);
    return '<a class="panel familycard rcard" href="#/p/' + esc(x.p.id) + '/cert/' + x.n + '"><span class="fam-ic" aria-hidden="true">🏅</span><span><h3>' + esc(M().who(x.p)) + ' reached ' + x.n + ' stamps: ' + esc(L.name) + '!</h3>' +
      '<span class="small">' + (f.length > 1 ? "+" + (f.length - 1) + " more · " : "") + 'Print the certificate →</span></span></a>';
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) {
    document.body.classList.remove("certview");
    if (h[0] !== "p" || !A().kidById(h[1])) return false;
    if (h[2] === "rewards") { document.body.classList.add("kidview"); view(A().kidById(h[1])); return true; }
    if (h[2] === "cert") { cert(A().kidById(h[1]), h[3]); return true; }
    return false;
  });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(homeCard);
  core.card = card; core.view = view; core.homeCard = homeCard;
  return core;
});
