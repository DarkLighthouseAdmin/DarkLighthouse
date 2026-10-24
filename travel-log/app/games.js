/* Famstamp: road-trip games that earn stamps (#/games). License plates by state, the road-sign alphabet and a scavenger
   hunt, each played on one trip day. A finished game gives every player a game stamp (person.games, which syncs and
   counts toward rewards). Boards live on the trip (trip.games), so they work offline and sync like the rest of a trip.
   #/games/print shows print-friendly sheets (print or save as PDF). The counting part runs in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_GAMES = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
    "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  // Things to spot from the car (no animals: those are for another day)
  var HUNT = [["redcar", "🚗", "A red car"], ["bus", "🚌", "A school bus"], ["bridge", "🌉", "A bridge"], ["tower", "🗼", "A water tower"], ["train", "🚆", "A train"],
    ["motorbike", "🏍️", "A motorcycle"], ["windmill", "🌬️", "A wind turbine"], ["tunnel", "🕳️", "A tunnel"], ["stop", "🛑", "A stop sign"], ["flag", "🏳️", "A flag"],
    ["mountain", "⛰️", "A mountain"], ["water", "🌊", "A lake or river"], ["truck", "🚚", "A big truck"], ["bike", "🚲", "A bicycle"], ["police", "🚓", "A police car"],
    ["tractor", "🚜", "A tractor"], ["plane", "✈️", "An airplane"], ["billboard", "🪧", "A funny billboard"], ["cone", "🚧", "A traffic cone"], ["firetruck", "🚒", "A fire truck"],
    ["camper", "🚐", "A camper or RV"], ["barn", "🏚️", "A barn"], ["church", "⛪", "A steeple"], ["boat", "⛵", "A boat"]];
  var GAMES = {
    plates: { name: "License plate hunt", emoji: "🚘", goal: 10, how: "Spot plates from different states. 10 states earns the stamp; all 50 is legendary." },
    alpha: { name: "Road-sign alphabet", emoji: "🔤", goal: 26, how: "Find A to Z in order on signs, trucks and stores. Tap each letter as you spot it." },
    hunt: { name: "Scavenger hunt", emoji: "🔍", goal: 12, how: "Find all 12 things out the window. A new list every day." }
  };
  var KINDS = ["plates", "alpha", "hunt"], DAY = /^\d{4}-\d{2}-\d{2}$/;
  function seedRand(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  /** The things on one day's scavenger hunt (12, the same on every phone). */
  function huntList(seed) {
    var r = seedRand(String(seed || "famstamp")), l = HUNT.slice();
    for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = l[i]; l[i] = l[j]; l[j] = x; }
    return l.slice(0, 12);
  }
  function items(kind, seed) { return kind === "plates" ? STATES.slice() : kind === "alpha" ? LETTERS.slice() : huntList(seed).map(function (x) { return x[0]; }); }
  function key(kind, day) { return day + "|" + kind; }
  function board(t, kind, day) { var g = (t && t.games) || {}; return g[key(kind, day)] || null; }
  /** Tap a tile: found or not. Alphabet letters must go in order (tapping the last one found takes it back). Returns the board. */
  function tap(t, kind, day, item, now) {
    if (!t || !GAMES[kind] || !DAY.test(day || "")) return null;
    var all = items(kind, t.id + ":" + day); if (all.indexOf(item) < 0) return board(t, kind, day);
    t.games = t.games && typeof t.games === "object" ? t.games : {};
    var b = t.games[key(kind, day)] = t.games[key(kind, day)] || { found: [], who: [], done: "" };
    var i = b.found.indexOf(item);
    if (kind === "alpha") {
      if (i >= 0) { if (i === b.found.length - 1) b.found.pop(); }
      else if (LETTERS[b.found.length] === item) b.found.push(item);
    } else if (i >= 0) b.found.splice(i, 1); else b.found.push(item);
    if (!b.done && b.found.length >= GAMES[kind].goal) b.done = String(now || new Date().toISOString());
    return b;
  }
  /** Give each player the stamp for a finished board (once). Returns the people who got a new one. */
  function award(t, kind, day, people, place) {
    var b = board(t, kind, day); if (!b || !b.done) return [];
    var gk = kind + ":" + t.id + ":" + day, got = [];
    (people || []).forEach(function (p) {
      p.games = p.games && typeof p.games === "object" ? p.games : {};
      if (!p.games[gk]) { p.games[gk] = { at: day, kind: kind, trip: t.id, place: String(place || "").slice(0, 60) }; got.push(p); }
      if (b.who.indexOf(p.id) < 0) b.who.push(p.id);
    });
    return got;
  }
  /** Game stamps a person has, newest first: [{ key, kind, at, trip, place }] */
  function stampsOf(p) {
    return Object.keys((p && p.games) || {}).map(function (k) { var g = p.games[k] || {}; return { key: k, kind: g.kind, at: g.at || "", trip: g.trip || "", place: g.place || "" }; })
      .filter(function (g) { return GAMES[g.kind]; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  /** Which day of a trip to play: today if the trip is on, else its first day. */
  function playDay(t, today, end) { return t && DAY.test(t.date || "") ? (today >= t.date && today <= (end || t.date) ? today : t.date) : today; }
  var core = { GAMES: GAMES, KINDS: KINDS, STATES: STATES, LETTERS: LETTERS, HUNT: HUNT, huntList: huntList, items: items, board: board, tap: tap, award: award, stampsOf: stampsOf, playDay: playDay };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function esc(s) { return M().esc(s); }
  var HUNT_BY = {}; HUNT.forEach(function (x) { HUNT_BY[x[0]] = x; });
  function stName(id) { var s = window.MLTL_MAPS.us.shapes.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function label(kind, it) { return kind === "plates" ? stName(it) : kind === "alpha" ? it : (HUNT_BY[it] ? HUNT_BY[it][1] + " " + HUNT_BY[it][2] : it); }
  function trips() { return A().state.trips.filter(function (t) { return !t.deletedAt && !M().isDraft(t); }); }
  /** The trip to play on: one going on now, else the next one, else the most recent. */
  function bestTrip() {
    var td = M().today(), now = M().onTripNow(A().state.trips, td), up = M().upcoming(A().state.trips, td);
    if (now.length) return now[0].trip;
    if (up.length) return up[0].trip;
    return trips().filter(function (t) { return DAY.test(t.date || ""); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0] || null;
  }
  function players(t) {
    var ids = (t.kidIds || []).filter(function (id) { var p = A().kidById(id); return p && p.role === "kid"; });
    return (ids.length ? ids : (t.kidIds || [])).map(A().kidById).filter(Boolean);
  }
  function days(t) { var out = [], d = t.date, end = M().tripEnd(t); if (!DAY.test(d || "")) return [M().today()]; for (var i = 0; i < 31 && d <= end; i++) { out.push(d); d = M().addDays(d, 1); } return out; }
  function hub(tid, day) {
    document.title = "Road-trip games · Famstamp";
    var t = tid ? A().state.trips.filter(function (x) { return x.id === tid; })[0] : bestTrip();
    var html = '<a class="back" href="#/">← Home</a><h1>🚗 Road-trip games</h1><p class="lede small">Play in the car, earn a stamp. Works with no signal.</p>';
    if (!t) { A().main.innerHTML = html + '<div class="panel"><p>Add a trip first, then the games are tied to its days.</p></div>' + printLink(); return; }
    day = DAY.test(day || "") ? day : playDay(t, M().today(), M().tripEnd(t));
    var list = trips().filter(function (x) { return DAY.test(x.date || ""); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 30);
    html += '<div class="field"><label for="gtrip">Trip</label><select id="gtrip">' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === t.id ? " selected" : "") + '>' + esc(M().tripLabel(x) + " · " + M().prettyDate(x.date)) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="gday">Day</label><select id="gday">' + days(t).map(function (d, i) { return '<option value="' + d + '"' + (d === day ? " selected" : "") + '>Day ' + (i + 1) + ' · ' + esc(M().prettyDate(d)) + '</option>'; }).join("") + '</select></div>' +
      '<div class="ggrid">' + KINDS.map(function (kd) {
        var G = GAMES[kd], b = board(t, kd, day), n = b ? b.found.length : 0;
        return '<a class="panel gcard' + (b && b.done ? " done" : "") + '" href="#/games/' + esc(t.id) + '/' + day + '/' + kd + '"><span class="gic" aria-hidden="true">' + G.emoji + '</span><b>' + esc(G.name) + '</b>' +
          '<span class="small">' + (b && b.done ? "✓ Stamp earned" : n + " / " + G.goal) + '</span></a>';
      }).join("") + '</div>' + mine(t) + printLink();
    A().main.innerHTML = html;
    var gt = document.getElementById("gtrip"), gd = document.getElementById("gday");
    gt.onchange = function () { location.hash = "#/games/" + gt.value; };
    gd.onchange = function () { location.hash = "#/games/" + t.id + "/" + gd.value; };
  }
  function mine(t) {
    var ps = players(t).filter(function (p) { return stampsOf(p).length; });
    return ps.length ? '<h3 class="sec">Game stamps</h3>' + ps.map(function (p) { var s = stampsOf(p); return '<p class="small"><b>' + esc(M().who(p)) + '</b>: ' + s.length + ' · ' + esc(s.slice(0, 4).map(function (g) { return GAMES[g.kind].emoji + " " + (g.place || GAMES[g.kind].name); }).join(", ")) + '</p>'; }).join("") : "";
  }
  function printLink() { return '<p class="small"><a class="tapline" href="#/games/print">🖨️ Printable game sheets (print or save as PDF) →</a></p>'; }
  function play(tid, day, kind) {
    var t = A().state.trips.filter(function (x) { return x.id === tid; })[0], G = GAMES[kind];
    if (!t || !G || !DAY.test(day || "")) { location.hash = "#/games"; return; }
    document.title = G.name + " · Famstamp";
    var b = board(t, kind, day) || { found: [], done: "" }, ps = players(t), all = items(kind, t.id + ":" + day);
    var html = '<a class="back" href="#/games/' + esc(t.id) + '/' + day + '">← Games</a><h1>' + G.emoji + ' ' + esc(G.name) + '</h1>' +
      '<p class="small muted">' + esc(M().tripLabel(t) + " · " + M().prettyDate(day)) + ' · ' + esc(G.how) + '</p>' +
      '<p class="gcount" id="gcount" role="status"><b>' + b.found.length + '</b> / ' + (kind === "plates" ? G.goal + " (" + all.length + " in all)" : G.goal) + (b.done ? ' · ✓ Stamp earned for ' + esc(M().joinNames(ps.map(M().who))) : "") + '</p>' +
      '<div class="gboard g-' + kind + '">' + all.map(function (it) {
        var on = b.found.indexOf(it) >= 0, nxt = kind === "alpha" && LETTERS[b.found.length] === it;
        return '<button type="button" class="gtile' + (on ? " on" : "") + (nxt ? " next" : "") + '" data-gi="' + esc(it) + '" aria-pressed="' + on + '">' + esc(label(kind, it)) + '</button>';
      }).join("") + '</div><p class="small muted">Players: ' + esc(M().joinNames(ps.map(M().who)) || "everyone on the trip") + '</p>';
    A().main.innerHTML = html;
    A().main.querySelectorAll("[data-gi]").forEach(function (el) {
      el.onclick = function () {
        var was = !!(board(t, kind, day) || {}).done, nb = tap(t, kind, day, el.dataset.gi);
        var jobs = [];
        if (nb && nb.done && !was) {
          var got = award(t, kind, day, ps, M().tripLabel(t));
          got.forEach(function (p) { p.updatedAt = new Date().toISOString(); jobs.push(A().saveKid(p)); });
          setTimeout(function () { if (window.MLTL_SYNC && window.MLTL_SYNC._confetti) window.MLTL_SYNC._confetti(); A().toast(G.emoji + " Stamp earned: " + G.name + "!"); }, 50);
        }
        t.updatedAt = new Date().toISOString(); jobs.push(A().put("trips", t));
        Promise.all(jobs).then(function () { var y = window.scrollY; play(tid, day, kind); window.scrollTo(0, y); });
      };
    });
  }
  function sheet(kind) {
    var G = GAMES[kind], all = items(kind, "print:" + kind);
    return '<section class="gsheet"><h2>' + G.emoji + ' ' + esc(G.name) + '</h2><p class="gsub">' + esc(G.how) + '</p><div class="gprintgrid g-' + kind + '">' +
      all.map(function (it) { return '<span class="gbox"><i></i>' + esc(label(kind, it)) + '</span>'; }).join("") +
      '</div><p class="gname">Name: ____________________ &nbsp; Date: ____________ &nbsp; Where to: ____________________</p><p class="gfoot">' + esc(((typeof self !== "undefined" && self.FS_BRAND && self.FS_BRAND.NAME) || "Famstamp")) + ' · family travel log · darklighthousesolutions.com</p></section>';
  }
  function printView(kind) {
    document.title = "Printable road-trip games · Famstamp";
    var ks = GAMES[kind] ? [kind] : KINDS;
    document.body.classList.add("gprintview");
    A().main.innerHTML = '<div class="noprint certbar"><a class="back" href="#/games">← Games</a> <button type="button" class="btn btn-primary" id="gprint">🖨️ Print or save as PDF</button>' +
      '<p class="small">' + KINDS.map(function (k) { return '<a href="#/games/print/' + k + '">' + GAMES[k].emoji + ' ' + esc(GAMES[k].name) + '</a>'; }).join(" · ") + ' · <a href="#/games/print">All three</a></p></div>' + ks.map(sheet).join("");
    document.getElementById("gprint").onclick = function () { window.print(); };
  }
  /** On a trip page: the day's games. */
  function tripHTML(k, t) {
    if (!DAY.test(t.date || "")) return "";
    var day = playDay(t, M().today(), M().tripEnd(t)), done = 0;
    Object.keys(t.games || {}).forEach(function (x) { if (t.games[x] && t.games[x].done) done++; });
    return '<div class="tripgames noprint"><a class="panel familycard" href="#/games/' + esc(t.id) + '/' + day + '"><span class="fam-ic" aria-hidden="true">🚗</span><span><h3>Road-trip games</h3><span class="small">' +
      (done ? done + (done === 1 ? " game" : " games") + " finished · " : "") + 'License plates, sign alphabet, scavenger hunt →</span></span></a></div>';
  }
  function homeCard() {
    var now = M().onTripNow(A().state.trips, M().today()); if (!now.length) return "";
    return '<a class="panel familycard gcardhome" href="#/games/' + esc(now[0].trip.id) + '/' + M().today() + '"><span class="fam-ic" aria-hidden="true">🚗</span><span><h3>Road-trip games</h3><span class="small">On the road? Plates, sign alphabet and today\'s scavenger hunt earn stamps →</span></span></a>';
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) {
    document.body.classList.remove("gprintview");
    if (h[0] !== "games") return false;
    if (h[1] === "print") printView(h[2] || ""); else if (h[3]) play(h[1], h[2], h[3]); else hub(h[1] || "", h[2] || "");
    return true;
  });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(homeCard);
  (window.FS_TRIPX = window.FS_TRIPX || []).push({ html: tripHTML });
  core.view = hub; core.play = play;
  return core;
});
