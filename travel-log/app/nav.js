/* v70: the new way around the app. A 5-tab bottom bar (Home, Map, + Stamp, Trips, More), one back arrow at the top left
   that works like the phone's Back, a search link on every tab, "You're on" (which family log, whose page), a skippable
   3-step tour, a grouped More page so nothing is reachable only by a link, one-handed kid mode, and a simple 3-tab view
   for grandparents (big text, big buttons, no editing). Pure helpers are exported for tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_NAV = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // ---------- pure helpers (tested in node) ----------
  function parts(hash) { return String(hash || "").replace(/^#\/?/, "").split("?")[0].split("/").filter(function (x, i) { return i === 0 || x !== ""; }); }
  var MAPSUB = { us: 1, world: 1, parks: 1 };
  /** Which bottom tab a screen belongs to: home, map, trips or more. */
  function tabOf(hash) {
    var h = parts(hash), a = h[0] || "";
    if (a === "") return "home";
    if (a === "map" || a === "family" && (!h[1] || h[1] === "signs") || a === "together" || a === "near") return "map";
    if ((a === "p" || a === "kid") && h[1]) { var t = h[2] || "us"; if (MAPSUB[t] || t === "signs" || t === "print") return "map"; if (t === "trips" || t === "trip") return "trips"; return "more"; }
    if (a === "trips" || a === "fieldtrips" || a === "journal" || a === "import" || a === "where" || a === "games") return "trips";
    if (a === "stamp") return "stamp";
    return "more";
  }
  /** Tab roots get no back arrow; everything else does. */
  function isRoot(hash, grand) {
    var h = parts(hash), a = h[0] || "";
    if (grand) return a === "" || a === "highlights" || a === "news" || a === "recap" && !h[1];
    if (a === "" || a === "trips" && !h[1] || a === "more" || a === "map" || a === "family" && !h[1]) return true;
    if ((a === "p" || a === "kid") && h[1] && (!h[2] || MAPSUB[h[2]]) && !h[3]) return true;
    return false;
  }
  /** Grandparent simple view: the screens that stay; anything else goes to Highlights. */
  var GRAND_OK = { "": 1, highlights: 1, recap: 1, news: 1, more: 1, help: 1, sharecard: 1, postcard: 1, postcards: 1, follow: 1, report: 1, sync: 1 };   // v75: Report a problem and Family & sign-in (incl. leaving) work here too
  function grandAllowed(hash) { var h = parts(hash); return !!GRAND_OK[h[0] || ""]; }
  /** All trips, newest first, optionally only one person's; deleted ones never. */
  function tripList(trips, pid) {
    return (trips || []).filter(function (t) { return !t.deletedAt && (!pid || (t.kidIds || []).indexOf(pid) >= 0); })
      .slice().sort(function (a, b) { return (b.date || "") < (a.date || "") ? -1 : (b.date || "") > (a.date || "") ? 1 : 0; });
  }
  /** Does this visible text have an emoji but no words? (Those buttons get a written label.) */
  var PICTO = /\p{Extended_Pictographic}/u;
  function emojiOnly(text) { var s = String(text || "").replace(/\s+/g, ""); return !!s && PICTO.test(s) && !/[A-Za-z0-9\u00C0-\u024F]/.test(s); }
  /** The tour's three steps. */
  var TOUR = [
    ["Home", "Today's cards live here: a trip you're on, On this day, and trips from your photos to review."],
    ["＋ Stamp", "The big button in the middle adds a trip, colors in places you've been, stamps a stop or finds what's near you."],
    ["Map, Trips and More", "Map and Trips show one person or the whole family (switch at the top). Everything else, from badges to backups, is in More."]
  ];
  /** The More page's groups: [title, [[label, href, emoji]]]. who = the person the Earn links are for. */
  function moreGroups(o) {
    var w = o.who ? "#/p/" + o.who : "", g = [];
    g.push(["Our family", [["Everyone in the family", "#/family/people", "👨‍👩‍👧"], ["Add someone", "#/add", "＋"], ["Family map", "#/family", "🗺️"], ["Trips together", "#/together/top", "🤝"], ["Family passport", "#/family/passport", "🛂"], ["Family wish list", "#/family/wishes", "⭐"]].concat(o.sync ? [["Family feed", "#/feed", "📰"]] : [])]);
    if (w) g.push(["Earn", [["Badges", w + "/stats", "🏅"], ["Quests", w + "/quests", "🧭"], ["Rewards and certificates", w + "/rewards", "🎖️"], ["Firsts", w + "/firsts", "✨"], ["Passport stamps", w + "/passport", "🛂"], ["State signs", w + "/signs", "🪧"]]]);
    g.push(["Play & make", [["Road-trip games", "#/games", "🎲"], ["Drawn stamps (open a stamp, then Draw)", w ? w + "/passport" : "#/family/passport", "🎨"], ["Postcards", "#/postcards", "💌"], ["Stamp stations", "#/stations", "📮"], ["Cousin Cup", "#/cup", "🏆"], ["What's near me", "#/near", "📍"]]]);
    g.push(["Share & keep", [["Our year in stamps", "#/year", "🎉"], ["Weekly recap", "#/recap", "📬"], ["Print a map", w ? w + "/print" : "#/family", "🖨️"], ["Make a book", w ? w + "/book" : "#/family", "📕"], ["Follow link for friends", "#/follow", "🔗"], ["Time capsules", "#/capsules", "⏳"], ["Field-trip log (homeschool)", "#/fieldtrips", "🎒"], ["Invite a family", "#/invite", "💌"]]]);
    g.push(["Account", [["Family Sync and sign-in", "#/sync", "☁️"], ["Back up and restore", "#/backup", "💾"], ["Recently deleted", "#/deleted", "🗑️"], ["Settings (units, sound, reminders)", "#/help/settings", "⚙️"], ["Help and feedback", "#/help", "❓"], ["Report a problem", "#/report", "🛠️"], ["Privacy", "/travel-log/privacy/", "🔒"]]]);
    return g;
  }
  var core = { parts: parts, tabOf: tabOf, isRoot: isRoot, grandAllowed: grandAllowed, tripList: tripList, emojiOnly: emojiOnly, TOUR: TOUR, moreGroups: moreGroups };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function kids() { return (A() && A().state.kids) || []; }
  function me() { var c = A().state.meta.sync; return c && c.myPerson && A().kidById(c.myPerson) ? c.myPerson : ""; }
  function who() { var p = ls("fs-who"); return p && A().kidById(p) ? p : me() || (kids()[0] && kids()[0].id) || ""; }
  function name(p) { return M().who(p); }
  function isGrand() { try { return !!(window.FS_HL && window.FS_HL.iAmGrand()); } catch (e) { return false; } }
  function grandView() { return isGrand() && ls("fs-full-app") !== "1"; }
  function kidMode() { return ls("fs-kidmode") === "1" && !grandView(); }
  function syncOn() { return !!(window.MLTL_SYNC && window.MLTL_SYNC.isOn && window.MLTL_SYNC.isOn()); }
  function mapHref() {
    var m = ls("fs-map-who") || "", sub = ls("fs-map-sub") || "us"; if (!MAPSUB[sub]) sub = "us";
    if (m === "family" && kids().length > 1) return "#/family";
    var p = m && A().kidById(m) ? m : who(); return p ? "#/p/" + p + "/" + sub : "#/add";
  }

  // ---- history depth: lets the back arrow know there's an in-app screen to go back to ----
  function depth() { return history.state && typeof history.state.fsd === "number" ? history.state.fsd : -1; }
  var lastDepth = 0;
  function stampDepth() {
    if (depth() >= 0) { lastDepth = depth(); return; }
    try { history.replaceState(Object.assign({}, history.state || {}, { fsd: lastDepth + 1 }), ""); lastDepth = lastDepth + 1; } catch (e) {}
  }
  function goBack() {
    if (document.querySelector(".sheetbg, #fammenu")) { history.back(); return; }   // same as the phone's Back: closes what's open first
    if (depth() > 0) { history.back(); return; }
    var old = A().main.querySelector("a.back"); location.hash = old ? old.getAttribute("href") : (grandView() ? "#/highlights" : { map: mapHref(), trips: "#/trips", more: "#/more" }[tabOf(location.hash)] || "#/");
  }

  // ---- the bars ----
  function tabsHTML() {
    var cur = tabOf(location.hash), h = parts(location.hash)[0] || "";
    function t(id, href, ic, label, curNow) { return '<a href="' + href + '" class="nt-' + id + '"' + (curNow ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + ic + '</span><span class="tl">' + label + '</span></a>'; }
    if (grandView()) return t("hl", "#/highlights", "✨", "Highlights", h === "highlights" || h === "") + t("recap", "#/recap", "📬", "Weekly recap", h === "recap") + t("news", "#/news", "💬", "Reactions &amp; news", h === "news");
    if (kidMode()) return t("map", mapHref(), "🗺️", "My map", cur === "map") + '<button type="button" class="nt-stamp" data-fs-stamp><span class="ic" aria-hidden="true">＋</span><span class="tl">Stamp</span></button>' + t("games", "#/games", "🎲", "Games", h === "games") + '<button type="button" class="nt-exit" data-kidmode-off><span class="ic" aria-hidden="true">👋</span><span class="tl">Grown-ups</span></button>';
    return t("home", "#/", "🏠", "Home", cur === "home") + t("map", mapHref(), "🗺️", "Map", cur === "map") +
      '<button type="button" class="nt-stamp" data-fs-stamp aria-label="Stamp: add a trip or a place"><span class="ic" aria-hidden="true">＋</span><span class="tl">Stamp</span></button>' +
      t("trips", "#/trips", "📖", "Trips", cur === "trips") + t("more", "#/more", "☰", "More", cur === "more");
  }
  function drawBars() {
    var b = document.body, gv = grandView(), km = kidMode();
    b.classList.add("fsnew"); b.classList.toggle("grandview", gv); b.classList.toggle("kidmode", km);
    var nav = document.getElementById("fsnav");
    if (!nav) { nav = document.createElement("nav"); nav.id = "fsnav"; nav.className = "fsnav"; nav.setAttribute("aria-label", "Main"); document.body.appendChild(nav); }
    var html = '<div class="wrap">' + tabsHTML() + '</div>'; if (nav.innerHTML !== html) nav.innerHTML = html;
    nav.hidden = !kids().length && !gv;
    // top left: one back arrow; top right: Search (and More for grandparents)
    var top = document.querySelector(".topbar .wrap");
    if (top && !document.getElementById("navback")) {
      var bk = document.createElement("button"); bk.type = "button"; bk.id = "navback"; bk.className = "navback"; bk.setAttribute("aria-label", "Back"); bk.innerHTML = '<span aria-hidden="true">←</span><span class="tl">Back</span>'; bk.onclick = goBack;
      top.insertBefore(bk, top.firstChild);
    }
    var nb = document.getElementById("navback"); if (nb) nb.hidden = isRoot(location.hash, gv) && !document.querySelector(".sheetbg, #fammenu");
    var tr = document.querySelector(".topbar .topright");
    if (tr && !document.getElementById("navsearch")) {
      var s = document.createElement("a"); s.id = "navsearch"; s.className = "toplink navsearch"; s.href = "#/search"; s.innerHTML = '<span aria-hidden="true">🔎</span><span class="tl">Search</span>'; tr.appendChild(s);
      var mo = document.createElement("a"); mo.id = "navmore"; mo.className = "toplink navmore"; mo.href = "#/more"; mo.textContent = "More"; tr.appendChild(mo);
    }
    youreOn();
  }
  function youreOn() {
    var el = document.getElementById("youreon"), tb = document.querySelector(".topbar");
    if (!kids().length || !tb) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement("div"); el.id = "youreon"; el.className = "youreon"; el.setAttribute("role", "status"); tb.parentNode.insertBefore(el, tb.nextSibling); }
    var fc = document.querySelector("#famchip .fcname"), log = fc && fc.textContent || (syncOn() ? "Family log" : "This phone's log");
    var h = parts(location.hash), p = (h[0] === "p" || h[0] === "kid") && A().kidById(h[1]);
    var html = '<span class="small">You\'re on <b>' + esc(log) + '</b>' + (p ? ' · <b>' + esc(name(p)) + (p.id === me() ? " (you)" : "") + '</b>' : "") + '</span>' + (fc ? ' <button type="button" class="linkbtn small" data-open-fam>Switch</button>' : "");
    if (el.innerHTML !== html) el.innerHTML = html; el.hidden = false;
  }

  // ---- + Stamp ----
  function stampChoices() {
    var w = A().kidById(who()), onTrip = (M().onTripNow ? M().onTripNow(A().state.trips, M().today()) : [])[0];
    var trip = onTrip && (onTrip.trip || onTrip), tw = trip && (trip.kidIds || []).filter(A().kidById)[0];
    function c(href, ic, label, sub, attr) { return '<a class="stampopt" href="' + href + '"' + (attr || "") + '><span class="ic" aria-hidden="true">' + ic + '</span><span><b>' + label + '</b><br><span class="small muted">' + sub + '</span></span></a>'; }
    return '<div class="stampopts">' +
      c("#/stamp/trip", "🧳", "Add a trip", "Stops, flights and miles; everyone on it gets the stamps", ' data-fs-addtrip') +
      (w ? c("#/p/" + esc(w.id) + "/us?list=1", "✅", "Quick-add places", "Check off states, countries and parks " + esc(name(w)) + " has been to") : "") +
      c("#/import", "📷", "From photos", "Make trips from the dates and places in your photos") +
      c("#/near", "📍", "Near me", "Parks and places to stamp close by") +
      (trip && tw ? c("#/p/" + esc(tw) + "/trips/edit/" + esc(trip.id), "🛑", "Stamp a stop", "Add where you are to " + esc(trip.place || "this trip"), ' data-fs-stop') : "") +
      '</div>';
  }
  function openStamp() {
    if (!kids().length) { location.hash = "#/add"; return; }
    var UI = window.FS_UI; if (!UI || !UI.sheet) { location.hash = "#/stamp"; return; }
    UI.sheet('<div class="sheethead"><h3>Stamp</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' + stampChoices() + '<div class="actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>');
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-fs-stamp],[data-fs-addtrip],[data-fs-stop],[data-kidmode-off],[data-kidmode-on],[data-open-fam],[data-tour],[data-full-app],[data-grand-view],[data-gtip]");
    if (!t) return;
    if (t.hasAttribute("data-fs-stamp")) { e.preventDefault(); openStamp(); }
    else if (t.hasAttribute("data-fs-addtrip")) { e.preventDefault(); if (window.FS_UI) { window.FS_UI.closeSheet(); setTimeout(function () { window.FS_UI.whoWentSheet(); }, 0); } }
    else if (t.hasAttribute("data-fs-stop")) { window.FS_FOCUS_STOP = true; }
    else if (t.hasAttribute("data-kidmode-off")) { ls("fs-kidmode", null); refresh(); A().toast && A().toast("Kid mode is off"); }
    else if (t.hasAttribute("data-kidmode-on")) { e.preventDefault(); ls("fs-kidmode", "1"); location.hash = mapHref(); refresh(); }
    else if (t.hasAttribute("data-open-fam")) { var fc = document.getElementById("famchip"); if (fc) { e.stopPropagation(); fc.click(); } }
    else if (t.hasAttribute("data-full-app")) { e.preventDefault(); ls("fs-full-app", "1"); location.hash = "#/"; refresh(); }
    else if (t.hasAttribute("data-grand-view")) { e.preventDefault(); ls("fs-full-app", null); location.hash = "#/highlights"; refresh(); }
    else if (t.hasAttribute("data-gtip")) { ls("fs-gtip", "1"); var g = document.querySelector(".gtip"); if (g) g.remove(); }
    else if (t.hasAttribute("data-tour")) {
      var v = t.getAttribute("data-tour"); if (v === "skip" || v === "done") { ls("fs-tour", "done"); var c = document.querySelector(".fstour"); if (c) c.remove(); return; }
      ls("fs-tour-step", v); var card = document.querySelector(".fstour"); if (card) card.outerHTML = tourHTML();
    }
  });

  // ---- pages ----
  function chips(cur, hrefFor, withFamily) {
    var list = kids(), m = me();
    return '<nav class="pchips" aria-label="Whose">' + (withFamily ? '<a href="' + hrefFor("") + '"' + (!cur ? ' aria-current="page"' : "") + '>' + withFamily + '</a>' : "") + list.map(function (p) {
      return '<a href="' + hrefFor(p.id) + '" style="' + A().kidStyle(p) + '"' + (cur === p.id ? ' aria-current="page"' : "") + '><span class="dotp" aria-hidden="true">' + esc(A().initial(name(p))) + '</span>' + esc(name(p)) + (p.id === m ? ' <small>(you)</small>' : "") + '</a>';
    }).join("") + '</nav>';
  }
  function viewTrips(pid) {
    var a = A(), p = pid && a.kidById(pid); if (pid && !p) pid = "";
    var list = tripList(a.state.trips, pid), UI = window.FS_UI, html = '<h1>Trips</h1>';
    if (kids().length > 1) html += chips(pid, function (id) { return "#/trips" + (id ? "/" + id : ""); }, "Everyone");
    html += '<div class="actions tripsacts"><button type="button" class="btn btn-beacon" data-fs-addtrip>＋ Add a trip</button><a class="btn btn-ghost" href="#/fieldtrips">🎒 Field-trip log &amp; PDF</a></div>';
    var drafts = M().draftTrips ? M().draftTrips(a.state.trips).length : 0;
    if (drafts) html += '<p><a class="tapline" href="#/p/' + esc(pid || who()) + '/trips/review">📷 ' + drafts + (drafts === 1 ? " trip" : " trips") + ' from your photos to review →</a></p>';
    if (!list.length) html += '<div class="panel empty"><p><b>' + (p ? esc(name(p)) + " has no trips yet." : "No trips yet.") + '</b></p><p class="small muted">Add your first one, even a trip from years ago. Each trip keeps its own journal, road-trip games, photos and postcards.</p><button type="button" class="btn btn-primary" data-fs-addtrip>Add a trip</button></div>';
    var year = "";
    list.forEach(function (t) {
      var y = String(t.date || "").slice(0, 4) || "No date"; if (y !== year) { html += '<h2 class="tyear">' + esc(y) + '</h2>'; year = y; }
      html += UI ? UI.tripCard(t, p || a.kidById((t.kidIds || [])[0])) : '<p>' + esc(t.place) + '</p>';
    });
    a.main.innerHTML = html; document.title = "Trips · Famstamp";
    if (a.fillPhotos) a.fillPhotos();
  }
  function viewMore() {
    var a = A(), w = who(), gv = grandView(), html = '<h1>More</h1>';
    if (gv) {
      html += '<div class="panel"><p>This is the simple view for grandparents. You can switch to the full app any time, and come back here from More.</p><div class="actions"><button type="button" class="btn btn-primary" data-full-app>Switch to the full app</button></div></div>' +
        '<ul class="morelist"><li><a href="#/highlights">Highlights</a></li><li><a href="#/recap">Weekly recap</a></li><li><a href="#/news">Reactions &amp; news</a></li><li><button type="button" class="linkbtn" data-gtip-again>How to use this</button></li><li><a href="#/help">Help</a></li><li><a href="#/sync">Family and sign-in</a></li><li><a href="#/report">Report a problem</a></li></ul>';
      a.main.innerHTML = html; document.title = "More · Famstamp"; return;
    }
    if (kids().length > 1) html += '<p class="small muted">Badges and other personal pages are for:</p>' + chips(w, function (id) { return "#/more/" + id; });
    moreGroups({ who: w, sync: syncOn() }).forEach(function (g) {
      html += '<section class="moregroup"><h2>' + esc(g[0]) + '</h2><ul class="morelist">' + g[1].map(function (l) {
        var ext = l[1].charAt(0) === "/"; return '<li><a href="' + esc(l[1]) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + '><span class="ic" aria-hidden="true">' + l[2] + '</span>' + esc(l[0]) + '</a></li>';
      }).join("") + (g[0] === "Our family" ? kids().map(function (p) { return '<li class="sub"><a href="#/p/' + esc(p.id) + '"><span class="ic" aria-hidden="true">·</span>' + esc(name(p)) + '\'s page</a></li>'; }).join("") : "") +
        (g[0] === "Account" ? '<li><button type="button" class="linkbtn" data-kidmode-on><span class="ic" aria-hidden="true">🧒</span>Kid mode (one-handed: Map, Stamp, Games)</button></li>' +
          (isGrand() ? '<li><a href="#/highlights"><span class="ic" aria-hidden="true">✨</span>Highlights</a></li><li><button type="button" class="linkbtn" data-grand-view><span class="ic" aria-hidden="true">👵</span>Simple grandparent view</button></li>' : "") +
          '<li><button type="button" class="linkbtn" data-tour-again><span class="ic" aria-hidden="true">🧭</span>Take the 3-step tour again</button></li>' : "") + '</ul></section>';
    });
    a.main.innerHTML = html; document.title = "More · Famstamp";
  }
  function viewPeople() {
    var a = A(), html = '<a class="back" href="#/more">← More</a><h1>Our family</h1><div class="kids">';
    kids().forEach(function (k) { html += '<a class="kidcard" href="#/p/' + esc(k.id) + '" style="' + a.kidStyle(k) + '"><span class="avatar">' + esc(a.initial(name(k))) + '</span><span><h3>' + esc(name(k)) + '</h3></span></a>'; });
    a.main.innerHTML = html + '<a class="kidcard add" href="#/add">+ Add someone</a></div>'; document.title = "Our family · Famstamp";
  }
  function viewStampPage() {
    var a = A(); a.main.innerHTML = '<h1>Stamp</h1>' + (kids().length ? stampChoices() : '<div class="panel empty"><p>Add someone first, then stamp their trips.</p><a class="btn btn-primary" href="#/add">Add someone</a></div>'); document.title = "Stamp · Famstamp";
  }
  function viewNews() {
    var a = A(), H = window.FS_HL, rows = [], items = {};
    try { rows = (H && H.cached ? H.cached() : []).slice().sort(function (x, y) { return x.created_at < y.created_at ? 1 : -1; }); (H.items() || []).forEach(function (i) { items[i.ref] = i; }); } catch (e) {}
    var EM = { heart: ["❤️", "Love it"], wow: ["😮", "Wow"], clap: ["👏", "Bravo"], laugh: ["😂", "Ha!"] };
    var html = '<h1>Reactions &amp; news</h1><h2>Reactions</h2>';
    var rx = rows.filter(function (r) { return items[r.item_ref]; }).slice(0, 20);
    html += rx.length ? '<ul class="newslist">' + rx.map(function (r) { var e = EM[r.emoji] || ["", r.emoji]; return '<li><span aria-hidden="true">' + e[0] + '</span> <b>' + esc(H.nameOf(r.user_id)) + '</b> said “' + esc(e[1]) + '” to <b>' + esc(items[r.item_ref].title) + '</b><br><span class="small muted">' + esc(String(r.created_at).slice(0, 10)) + '</span></li>'; }).join("") + '</ul>'
      : '<div class="panel empty"><p>No reactions yet. Open Highlights and tap Love it, Wow, Bravo or Ha! on something the grandkids did.</p><a class="btn btn-primary" href="#/highlights">Open Highlights</a></div>';
    var trips = tripList(a.state.trips).slice(0, 8);
    html += '<h2>Newest trips</h2>' + (trips.length ? '<ul class="newslist">' + trips.map(function (t) { return '<li><b>' + esc(M().joinNames((t.kidIds || []).map(a.kidById).filter(Boolean).map(name))) + '</b> went to <b>' + esc(t.place) + '</b><br><span class="small muted">' + esc(M().prettyDate(t.date)) + '</span></li>'; }).join("") + '</ul>' : '<p class="muted">No trips yet.</p>');
    var notes = (window.FS_EXTRAS && window.FS_EXTRAS.NOTES || []).slice(-3).reverse();
    if (notes.length) html += '<h2>New in the app</h2><ul class="newslist">' + notes.map(function (n) { return '<li>' + esc(n.items ? n.items.join(" · ") : n.text || "") + '</li>'; }).join("") + '</ul>';
    a.main.innerHTML = html; document.title = "Reactions & news · Famstamp";
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).unshift(function (h) {
    var a = h[0];
    if (grandView() && !grandAllowed("#/" + h.join("/"))) { location.replace("#/highlights"); return true; }
    if (a === "" && grandView()) { location.replace("#/highlights"); return true; }
    if (a === "map") { var t = h[1] === "family" ? "#/family" : (h[1] && A().kidById(h[1]) ? "#/p/" + h[1] + "/" + (MAPSUB[h[2]] ? h[2] : "us") : mapHref()); location.replace(t); return true; }
    if (a === "trips") { viewTrips(h[1] || ""); return true; }
    if (a === "more") { if (h[1] && A().kidById(h[1])) ls("fs-who", h[1]); viewMore(); return true; }
    if (a === "family" && h[1] === "people") { viewPeople(); return true; }
    if (a === "stamp") { if (h[1] === "trip" && window.FS_UI) { history.replaceState(history.state, "", "#/trips"); viewTrips(""); window.FS_UI.whoWentSheet(); return true; } viewStampPage(); return true; }
    if (a === "news") { viewNews(); return true; }
    if (a === "help" && h[1] === "settings") { location.replace("#/help"); setTimeout(function () { var x = document.getElementById("xsettings"); if (x) x.scrollIntoView(); }, 120); return true; }
    return false;
  });

  // ---- after every screen draws ----
  function tourHTML() {
    var i = Math.max(0, Math.min(2, +(ls("fs-tour-step") || 0))), s = TOUR[i];
    return '<section class="panel fstour" aria-label="Quick tour"><p class="small muted">Quick tour · ' + (i + 1) + ' of 3</p><h3>' + esc(s[0]) + '</h3><p>' + esc(s[1]) + '</p><div class="actions">' +
      (i < 2 ? '<button type="button" class="btn btn-primary" data-tour="' + (i + 1) + '">Next</button><button type="button" class="btn btn-ghost" data-tour="skip">Skip tour</button>' : '<button type="button" class="btn btn-primary" data-tour="done">Got it</button>') + '</div></section>';
  }
  function decorate() {
    var a = A(); if (!a || !a.main) return;
    var main = a.main, h = parts(location.hash), gv = grandView();
    // remember which map the person looked at last
    if ((h[0] === "p" || h[0] === "kid") && a.kidById(h[1]) && (!h[2] || MAPSUB[h[2]])) { ls("fs-map-who", h[1]); ls("fs-map-sub", h[2] || "us"); }
    if (h[0] === "family" && !h[1]) ls("fs-map-who", "family");
    // Map: Family / person picker and USA / World / Parks
    var onMap = (h[0] === "p" || h[0] === "kid") && a.kidById(h[1]) && (!h[2] || MAPSUB[h[2]]) || h[0] === "family" && !h[1];
    if (onMap && !main.querySelector(".mapnav") && kids().length) {
      var sub = h[0] === "family" ? "" : h[2] || "us", pid = h[0] === "family" ? "" : h[1];
      var div = document.createElement("div"); div.className = "mapnav";
      div.innerHTML = (kids().length > 1 ? chips(pid, function (id) { return id ? "#/p/" + id + "/" + (sub || ls("fs-map-sub") || "us") : "#/family"; }, '<span aria-hidden="true">👨‍👩‍👧</span> Family') : "") +
        (pid ? '<nav class="seg mapseg" aria-label="Which map">' + [["us", "USA"], ["world", "World"], ["parks", "Parks"]].map(function (x) { return '<a href="#/p/' + esc(pid) + '/' + x[0] + '"' + (x[0] === sub ? ' aria-current="page"' : "") + '>' + x[1] + '</a>'; }).join("") + '</nav>' : "");
      main.insertBefore(div, main.firstChild);
      if (/[?&]list=1/.test(location.hash)) { var d = main.querySelector("details.list"); if (d) { d.open = true; setTimeout(function () { d.scrollIntoView({ block: "start" }); }, 50); } }
    }
    // Home: the tour (once), and a sample-family nudge stays as it is
    if (h[0] === "" && !gv && kids().length && ls("fs-tour") !== "done" && !main.querySelector(".fstour")) { var t = document.createElement("div"); t.innerHTML = tourHTML(); main.insertBefore(t.firstChild, main.firstChild); }
    // grandparent: a one-screen tip the first time
    if (gv && h[0] === "highlights" && ls("fs-gtip") !== "1" && !main.querySelector(".gtip")) {
      var g = document.createElement("div"); g.className = "panel gtip"; g.setAttribute("role", "note");
      g.innerHTML = '<h2>How to use this</h2><ol><li><b>Highlights</b> shows the grandkids\' newest stamps, trips and badges.</li><li>Tap <b>Love it</b>, <b>Wow</b>, <b>Bravo</b> or <b>Ha!</b> to cheer them on. They see it.</li><li><b>Weekly recap</b> is the week in one page. <b>Reactions &amp; news</b> shows who cheered and what\'s new.</li><li>The <b>Back</b> button at the top left always takes you back.</li></ol><button type="button" class="btn btn-primary" data-gtip>Got it</button>';
      main.insertBefore(g, main.firstChild);
    }
    // Help: how to get around
    if (h[0] === "help" && !main.querySelector(".navhelp")) {
      var hp = document.createElement("section"); hp.className = "panel navhelp";
      hp.innerHTML = '<h2>Getting around</h2><ul><li><b>Home</b>: today\'s cards, On this day, and trips from your photos to review.</li><li><b>Map</b>: one person\'s map or the whole family\'s (pick at the top), with USA, World and Parks.</li><li><b>＋ Stamp</b> (the big middle button): add a trip, quick-add places, make trips from photos, find what\'s near you, or stamp a stop on the trip you\'re on.</li><li><b>Trips</b>: every trip, with its journal, games, photos and postcards. The homeschool field-trip log and its PDF are here too.</li><li><b>More</b>: our family, badges and rewards, games and postcards, sharing and keepsakes, and your account (Family Sync, backups, Recently deleted, help and privacy).</li><li><b>Back</b> (top left) goes to the screen you were on, just like your phone\'s Back button. <b>Search</b> is at the top right.</li><li><b>Kid mode</b> (More → Account) puts Map, Stamp and Games in big buttons for one hand. Grandparents get a simple 3-tab view with big text.</li></ul>';
      main.insertBefore(hp, main.children[1] || null);
    }
    if (window.FS_ROBUST && window.FS_ROBUST.decorate) { try { window.FS_ROBUST.decorate(h, gv); } catch (e) {} }
    labelEmoji(document.getElementById("main")); labelEmoji(document.querySelector(".sheetbg"));
  }
  /** Buttons and links that are only an emoji get their name written next to it. */
  function labelEmoji(root) {
    if (!root) return;
    root.querySelectorAll("a, button").forEach(function (el) {
      if (el.querySelector(".elab") || !emojiOnly(el.textContent)) return;
      var l = (el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/,\s*\d+$/, "").trim(); if (!l) return;
      var s = document.createElement("span"); s.className = "elab"; s.textContent = l; el.appendChild(s);
    });
  }
  function refresh() { drawBars(); decorate(); }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-tour-again],[data-gtip-again]"); if (!t) return;
    if (t.hasAttribute("data-tour-again")) { ls("fs-tour", null); ls("fs-tour-step", null); location.hash = "#/"; }
    else { ls("fs-gtip", null); location.hash = "#/highlights"; }
  });
  window.addEventListener("hashchange", function () { stampDepth(); refresh(); });
  window.addEventListener("popstate", function () { if (depth() >= 0) lastDepth = depth(); });
  var mo = new MutationObserver(function (recs) { if (recs.some(function (r) { return r.target.id === "main" || r.target === document.body && !(r.addedNodes.length === 1 && r.addedNodes[0].id === "fsnav"); })) { drawBars(); decorate(); } });
  function start() {
    try { history.replaceState(Object.assign({}, history.state || {}, { fsd: depth() >= 0 ? depth() : 0 }), ""); lastDepth = depth(); } catch (e) {}
    var m = document.getElementById("main"); if (m) mo.observe(m, { childList: true }); mo.observe(document.body, { childList: true });
    var tries = 0; (function wait() { if (A() && A().state && A().main) { refresh(); if (grandView() && (!parts(location.hash)[0] || !grandAllowed(location.hash))) location.replace("#/highlights"); } else if (tries++ < 100) setTimeout(wait, 50); })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);
  core.refresh = refresh; core.openStamp = openStamp; core.grandView = grandView; core.kidMode = kidMode; core.mapHref = mapHref;
  return core;
});
