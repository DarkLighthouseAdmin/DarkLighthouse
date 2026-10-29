/* Famstamp: the printed passport book (#/p/<id>/book). A premium "coming soon" page with a live preview of the book made
   from this person's own maps, stamps, trips, trip memories and firsts, plus a sample PDF (made from a fake family).
   Nothing to sign up for: no waitlist, no backend. #/p/<id>/book/pdf shows just the pages (how the sample PDF is made). */
(function () {
  "use strict";
  function A() { return window.MLTL_APP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var SAMPLE = "samples/famstamp-sample-book.pdf";
  // v110: no caps. Every stamp, trip and first goes in (a whole life of travel, or one year if you pick one).
  var PER_PAGE = 9, FIRSTS_PER_PAGE = 12, PREVIEW_PAGES = 40;

  function fmt(at) { if (!at) return ""; var d = new Date(String(at).slice(0, 10) + "T12:00:00"); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
  function stampName(s) {
    if (s.kind === "sight") return s.name || s.area;
    if (s.kind === "region" && window.WK_PASSPORT) return window.WK_PASSPORT.regionName(s.area);   // v110
    var M = window.MLTL, maps = window.MLTL_MAPS;
    if (s.kind === "park") { var p = M.parkById(s.area); return p ? p.name : s.area; }
    if (s.kind === "state") { var st = maps.us.shapes.filter(function (x) { return x.id === s.area; })[0]; return st ? st.name : s.area; }
    var c = maps.world.countries.filter(function (x) { return x.id === s.area; })[0]; return c ? c.name : s.area;
  }
  function stampsOf(k) {
    var P = window.WK_PASSPORT, M = window.MLTL;
    return P.stampsFor(k, A().state.trips, { parkStates: M.PARK_STATES }).slice().sort(function (a, b) { return (a.date || "9") < (b.date || "9") ? -1 : (a.date || "9") > (b.date || "9") ? 1 : 0; });
  }
  function tripsOf(k) {
    return A().state.trips.filter(function (t) { return t.kidIds.indexOf(k.id) >= 0 && t.planned !== true; })
      .sort(function (a, b) { return (a.date || a.createdAt || "") < (b.date || b.createdAt || "") ? -1 : 1; });
  }
  function years(k, trips, stamps) {
    var marks = [k.states, k.places, k.parks].reduce(function (o, m) { return o.concat(Object.keys(m || {}).map(function (id) { return m[id] && m[id].at; })); }, []);
    var ys = trips.map(function (t) { return t.date; }).concat(stamps.map(function (s) { return s.date; }), marks).filter(Boolean).map(function (d) { return +String(d).slice(0, 4); }).sort();
    if (!ys.length) return String(new Date().getFullYear());
    return ys[0] === ys[ys.length - 1] ? String(ys[0]) : ys[0] + "–" + ys[ys.length - 1];
  }
  function map(svg) { return '<div class="mapbox bookmap"><div>' + svg.replace(/ data-pz(init)?="[^"]*"/g, "") + '</div></div>'; }
  function bn() { return (window.FS_BRAND && window.FS_BRAND.NAME) || "Famstamp"; }
  function page(cls, inner, n) { return '<section class="bpage ' + cls + '">' + inner + (n ? '<span class="bpn">' + n + '</span>' : "") + '</section>'; }

  /** All the pages of k's book as HTML. */
  /** v63: this person's journal pages from a trip (best part, funny quote, a drawing). */
  function journalBits(k, t) {
    var J = window.FS_JOURNAL, l = J ? J.list(t).filter(function (e) { return e && e.kid === k.id; }).slice(0, 4) : [];
    if (!l.length) return "";
    return '<div class="bjournal"><h3>📓 From the journal</h3>' + l.map(function (e) {
      return '<div class="bjent"><span class="bjd">' + esc(fmt(e.day)) + '</span>' + (e.best ? '<p>🌟 ' + esc(e.best) + '</p>' : "") +
        (e.funny ? '<p>😂 “' + esc(e.funny) + '”' + (e.said ? ' (' + esc(e.said) + ')' : "") + '</p>' : "") + (e.photoId ? '<img class="bjdraw" alt="A drawing" data-photo="' + esc(e.photoId) + '">' : "") + '</div>';
    }).join("") + '</div>';
  }
  /** v65: the stamps this trip gave k (a kid's own drawn stamp shows here too). */
  function tripStampsHTML(k, t, stamps) {
    var P = window.WK_PASSPORT, M = window.MLTL, l = stamps.filter(function (s) { return s.tripId === t.id; }).slice(0, 4);
    return l.length ? '<div class="btstamps">' + l.map(function (x) { return '<figure>' + P.stampSVG(x, stampName(x), { holder: k.id, sub: x.kind === "park" ? M.parkSub(M.parkById(x.area)) : "" }) + '</figure>'; }).join("") + '</div>' : "";
  }
  function inYear(d, year) { return !year || String(d || "").slice(0, 4) === String(year); }
  /** v110: the years this person has dated trips or stamps in, newest first (for "a book of one year"). */
  function bookYears(k) {
    var ys = {}; tripsOf(k).forEach(function (t) { if (/^\d{4}/.test(t.date || "")) ys[t.date.slice(0, 4)] = 1; });
    stampsOf(k).forEach(function (x) { if (/^\d{4}/.test(x.date || "")) ys[x.date.slice(0, 4)] = 1; });
    return Object.keys(ys).sort().reverse();
  }
  function pagesHTML(k, year) {
    var M = window.MLTL, P = window.WK_PASSPORT, T = window.WK_TRIPS, app = A(), who = M.who(k);
    year = /^\d{4}$/.test(String(year || "")) ? String(year) : "";
    var s = M.stats(k, app.state.trips, window.MLTL_MAPS.world), trips = tripsOf(k).filter(function (t) { return inYear(t.date, year); }), stamps = stampsOf(k).filter(function (x) { return inYear(x.date, year); }), n = 1, out = [];
    var cover = stamps.slice(-3);
    out.push(page("bcover", '<div class="bcv">' + (window.FS_BRAND && window.FS_BRAND.logoSVG ? '<div class="blogo" aria-hidden="true">' + window.FS_BRAND.logoSVG(window.FS_BRAND.PAPER || "#fffdf8") + '</div>' : "") + '<span class="bkick">' + esc(bn().toUpperCase()) + ' · TRAVEL BOOK</span><h1>' + esc(who) + '\'s<br>' + (year ? esc(year) + ' ' : '') + 'Travel Book</h1><p class="byrs">' + esc(years(k, trips, stamps)) + '</p>' +
      '<div class="bcstamps" aria-hidden="true">' + cover.map(function (x) { return '<span>' + P.stampSVG(x, stampName(x), { sub: x.kind === "park" ? M.parkSub(M.parkById(x.area)) : "" }) + '</span>'; }).join("") + '</div>' +
      '<p class="bstat">' + (year ? [stamps.length + (stamps.length === 1 ? " stamp" : " stamps"), trips.length + (trips.length === 1 ? " trip" : " trips") + " in " + esc(year)] : [s.states + " states", s.countries + " countries", s.parks + " national parks", s.trips + " trips"]).join(" · ") + '</p></div>'));
    var crew = {}; trips.forEach(function (t) { t.kidIds.forEach(function (id) { if (id !== k.id) crew[id] = (crew[id] || 0) + 1; }); });
    var crewL = Object.keys(crew).map(function (id) { return { p: app.kidById(id), n: crew[id] }; }).filter(function (x) { return x.p && !x.p.deletedAt; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    if (crewL.length) out.push(page("bfamily", '<h2>' + esc(who) + '\'s travel crew</h2><p class="bsub">The people on the road with ' + esc(who) + '</p><ul class="bcrew">' +
      [{ p: k, n: trips.length, me: 1 }].concat(crewL).map(function (x) { return '<li><span class="bav" style="' + app.kidStyle(x.p) + '">' + esc(M.who(x.p).slice(0, 1)) + '</span><b>' + esc(M.who(x.p)) + '</b><span>' + (x.me ? x.n + (x.n === 1 ? ' trip' : ' trips') + ' in this book' : x.n + (x.n === 1 ? ' trip' : ' trips') + ' together') + '</span></li>'; }).join("") + '</ul>', n++));
    out.push(page("bmap", '<h2>' + esc(who) + '\'s United States</h2><p class="bsub">' + s.states + ' of 50 states colored in</p>' + map(app.usSVG(k)), n++));
    out.push(page("bmap", '<h2>' + esc(who) + '\'s world</h2><p class="bsub">' + s.countries + ' ' + (s.countries === 1 ? "country" : "countries") + ' · ' + s.continents + ' ' + (s.continents === 1 ? "continent" : "continents") + '</p>' + map(app.worldSVG(k, "world")), n++));
    for (var i = 0; i < stamps.length; i += PER_PAGE) {
      out.push(page("bstamps", '<h2>Passport stamps' + (year ? " of " + esc(year) : "") + '</h2><div class="bgrid">' + stamps.slice(i, i + PER_PAGE).map(function (x) {
        return '<figure>' + P.stampSVG(x, stampName(x), { holder: k.id, sub: x.kind === "park" ? M.parkSub(M.parkById(x.area)) : "" }) + '</figure>'; }).join("") + '</div>', n++));
    }
    trips.forEach(function (t) {
      var m = t.memories || {}, rows = T.MEM_PROMPTS.filter(function (p) { return m[p[0]]; }), route = M.routeText(t);
      var age = M.isKid(k) ? M.ageOn(k.birthYear, t.date) : null;
      out.push(page("btrip", (t.photoId ? '<img class="bphoto" alt="" data-photo="' + esc(t.photoId) + '">' : "") +
        '<h2>' + esc(t.title || t.place) + '</h2><p class="bsub">' + esc([fmt(t.date), age != null ? "age " + age : ""].filter(Boolean).join(" · ")) + '</p>' +
        (route && route !== (t.title || t.place) ? '<p class="broute">' + esc(route) + '</p>' : "") +
        (t.memory ? '<p class="bnote">“' + esc(t.memory) + '”</p>' : "") +
        (rows.length ? '<dl class="bmems">' + rows.map(function (p) { return '<div><dt>' + p[2] + ' ' + esc(p[1]) + '</dt><dd>' + esc(m[p[0]]) + '</dd></div>'; }).join("") + '</dl>' : "") + tripStampsHTML(k, t, stamps), n++));
      var jb = journalBits(k, t);   // v65: the journal gets its own page so nothing is cut off when printed
      if (jb) out.push(page("btrip bjpage", '<h2>' + esc(who) + '\'s journal</h2><p class="bsub">' + esc(t.title || t.place) + '</p>' + jb, n++));
    });
    var F = window.FS_FIRSTS, firsts = F ? F.timeline(k, app.state.trips, F.ctx()).filter(function (r) { return r.at && inYear(r.at, year); }) : [];
    for (var j = 0; j < firsts.length; j += FIRSTS_PER_PAGE) out.push(page("bfirsts", '<h2>' + esc(who) + '\'s firsts' + (year ? " in " + esc(year) : "") + '</h2><ol>' + firsts.slice(j, j + FIRSTS_PER_PAGE).map(function (r) {
      return '<li><span class="bfe" aria-hidden="true">' + r.emoji + '</span><div><b>' + esc(r.title) + '</b><span>' + esc([fmt(r.at), r.place].filter(Boolean).join(" · ")) + '</span></div></li>'; }).join("") + '</ol>', n++));
    out.push(page("bback", '<div class="bcv"><p class="bend">The end… until the next trip.</p><span class="bkick">MADE WITH ' + esc(bn().toUpperCase()) + '</span></div>'));
    return out;
  }

  function view(k, sub) {
    var app = A(), main = app.main, M = window.MLTL, who = M.who(k), ym = /^(?:pdf-)?(\d{4})$/.exec(String(sub || "")), year = ym ? ym[1] : "";
    var pages = pagesHTML(k, year), ys = bookYears(k), base = "#/p/" + esc(k.id) + "/book";
    document.title = who + "'s travel book · " + bn();
    if (sub === "pdf" || /^pdf-\d{4}$/.test(String(sub || ""))) {   // just the pages, for printing the sample PDF
      document.body.classList.add("bookpdf");
      main.innerHTML = '<div class="bookpages" style="' + app.kidStyle(k) + '">' + pages.join("") + '</div>'; app.fillPhotos(); return;
    }
    main.innerHTML = app.shell(k, "stats",
      '<a class="back" href="#/p/' + esc(k.id) + '/stats">← Badges</a>' +
      '<div class="panel bookhero"><span class="pchip">Premium · coming soon</span><h2>A real printed book of ' + esc(who) + '\'s travels</h2>' +
      '<p>We\'re working on a hardcover book made from ' + esc(who) + '\'s maps, passport stamps, trips and trip memories. One to keep on the shelf, or to give to Grandma.</p>' +
      '<p class="small muted">It\'ll be part of ' + esc(bn()) + ' Premium (Family Keeper). There\'s nothing to sign up for yet; when it\'s ready, you\'ll see it right here.</p>' +
      '<div class="actions"><a class="btn btn-primary" href="' + SAMPLE + '" target="_blank" rel="noopener">📘 See a sample book (PDF)</a>' +
      '<a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/print">🖨 Print my map at home (free)</a></div></div>' +
      (ys.length > 1 ? '<div class="bkyears" role="group" aria-label="Which years"><span class="small muted">Book of:</span> <a class="chip' + (year ? "" : " on") + '" href="' + base + '">All years</a>' +
        ys.map(function (y) { return ' <a class="chip' + (y === year ? " on" : "") + '" href="' + base + '/' + y + '">' + y + '</a>'; }).join("") + '</div>' : "") +
      '<h2 class="bprevh">Your preview' + (year ? " of " + esc(year) : "") + ' <span class="muted small">' + pages.length + ' pages</span></h2>' +
      '<p class="hint">Made from ' + esc(who) + '\'s own maps and trips, so it grows with every trip. Every stamp, trip and first is in it' + (year ? " for " + esc(year) : "") + '.</p>' +
      (pages.length > PREVIEW_PAGES ? '<p class="small muted bkmore">The preview shows the first ' + PREVIEW_PAGES + ' of ' + pages.length + ' pages so this page stays quick. Pick a year above to see that year\'s pages.</p>' : "") +
      '<div class="bookpages preview" style="' + app.kidStyle(k) + '">' + pages.slice(0, PREVIEW_PAGES).join("") + '</div>');
    app.fillPhotos();
  }
  function card(k) {
    return '<a class="familycard qentry bentry" href="#/p/' + esc(k.id) + '/book"><span class="qemo" aria-hidden="true"><i>📘</i></span><span><b>Printed travel book</b><span class="small muted">Premium · coming soon. Peek at a preview</span></span><span class="qgo" aria-hidden="true">›</span></a>';
  }
  window.FS_BOOK = { view: view, card: card, pagesHTML: pagesHTML, bookYears: bookYears, PREVIEW_PAGES: PREVIEW_PAGES, SAMPLE: SAMPLE };
})();
