/* Famstamp (the My Lifetime Travel Log app): the app. Plain JavaScript, no libraries, and no network calls unless Family Sync (sync.js) is turned on.
   Data lives in this browser's IndexedDB ("mltl"); photos are shrunk and re-saved as JPEG, which also drops GPS/EXIF data. */
(function () {
  "use strict";
  var M = window.MLTL, MAPS = window.MLTL_MAPS, esc = M.esc;
  function UI() { return window.FS_UI; }   // trips-ui.js: trip builder, trip pages, stories and passports (v1.4)
  // Swap in the Amazon link once the paperback is live. Until then the link shows a "coming soon" note.
  var BOOK_URL = null;
  // Shown at the bottom of Settings (Back up page). Keep in step with CACHE in sw.js ("mltl-v66" -> "v66").
  var VERSION = "v89";

  // ---------- storage ----------
  // Each family log on this phone is its own database; "mltl" is the original one (see the logs list in sync-core.js).
  var DB_NAME = "mltl", DB_VER = 1, dbp = null;
  try { if (window.MLTL_SYNCCORE) DB_NAME = window.MLTL_SYNCCORE.readLogs(localStorage).active; } catch (e) {}
  try { if (sessionStorage.getItem("fs-demo") === "1") DB_NAME = "mltl-demo"; } catch (e) {}   // v69: sample family lives in its own throwaway database
  function db() { if (!dbp) dbp = openDb(DB_NAME); return dbp; }
  function openDb(name) {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(name, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        ["kids", "trips", "photos"].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" }); });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(store, mode, fn, other) {
    return (other ? openDb(other) : db()).then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), out;
        var s = Array.isArray(store) ? store.map(function (n) { return t.objectStore(n); }) : t.objectStore(store);
        out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
      }).then(function (x) { if (other) d.close(); return x; }, function (e) { if (other) d.close(); throw e; });
    });
  }
  /** Read or write another family log's database (used by the family switcher). */
  function txIn(name, store, mode, fn) { return name === DB_NAME ? tx(store, mode, fn) : tx(store, mode, fn, name); }
  function deleteDb(name) { return new Promise(function (res) { if (name === DB_NAME) return res(false); var r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = function () { res(true); }; }); }
  function all(store) { return tx(store, "readonly", function (s) { return s.getAll(); }); }
  // Family Sync (sync.js) listens for saves so it can share them in the background. silent = a change that came from sync itself.
  function changed(store, silent) { if (!silent && window.MLTL_onChange) try { window.MLTL_onChange(store); } catch (e) {} }
  function put(store, v, silent) { return tx(store, "readwrite", function (s) { s.put(v); }).then(function (x) { changed(store, silent); return x; }); }
  function del(store, id, silent) { return tx(store, "readwrite", function (s) { s.delete(id); }).then(function (x) { changed(store, silent); return x; }); }
  function getOne(store, id) { return tx(store, "readonly", function (s) { return s.get(id); }); }

  var state = { kids: [], trips: [], bin: [], meta: {} };
  function load() {
    return Promise.all([all("kids"), all("trips"), all("meta")]).then(function (r) {
      state.kids = r[0].map(function (p) { p.role = M.validRole(p.role); return p; }).sort(byRole);
      // Recently deleted trips stay in the database (and the cloud) for 30 days; only live ones are shown. Older ones go for good.
      var sp = M.splitTrips(r[1].map(function (t) { return M.migrateTrip(t); }));
      state.trips = sp.live.filter(function (t) { return t.kidIds.length; });
      state.bin = sp.bin;
      if (sp.purge.length) setTimeout(function () { sp.purge.forEach(function (t) { del("trips", t.id); if (t.photoId) del("photos", t.photoId); M.extraPhotoIds(t).forEach(function (id) { del("photos", id); }); }); }, 0);
      state.meta = {}; r[2].forEach(function (m) { state.meta[m.key] = m.value; });
    });
  }
  var ROLE_ORDER = { kid: 0, adult: 1, grand: 2 };
  function byRole(a, b) { return (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || (a.createdAt < b.createdAt ? -1 : 1); }
  function roleLabel(p) { return M.relLabel(p); }   // relationship in this log (Parent, Kid, Grandparent...), not the login role
  function saveKid(k) { return put("kids", k); }
  function setMeta(key, value) { state.meta[key] = value; return put("meta", { key: key, value: value }); }
  /** Delete a trip the safe way: it moves to Recently deleted (kept 30 days) and can be brought back. */
  function trashTrip(t) {
    var b = M.binTrip(t);
    return put("trips", b).then(function () { state.trips = state.trips.filter(function (x) { return x.id !== t.id; }); state.bin = [b].concat(state.bin.filter(function (x) { return x.id !== t.id; })); return b; });
  }
  function restoreTrip(id) {
    var t = state.bin.filter(function (x) { return x.id === id; })[0]; if (!t) return Promise.resolve(null);
    var u = M.unbinTrip(t);
    if (!u.kidIds.some(function (k) { return kidById(k); })) return Promise.reject(new Error("No one on this trip is in the log any more."));
    return put("trips", u).then(load).then(function () { return u; });
  }
  function kidById(id) { return state.kids.filter(function (k) { return k.id === id; })[0]; }

  // ---------- helpers ----------
  var main = document.getElementById("main"), toastEl = document.getElementById("toast"), toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200); }
  // A person's badge: their picked avatar (v87, avatars.js), else the first letter of their name. Takes a person or a name.
  function initial(x) {
    if (x && typeof x === "object") { var AV = window.FS_AVATARS; if (AV && AV.has(x.av)) return AV.html(x.av); x = M.who(x); }
    return esc((x || "?").trim().charAt(0).toUpperCase());
  }
  function kidStyle(k) { return "--kid:" + esc(k.color); }
  var COUNTRY = {}; MAPS.world.countries.forEach(function (c) { COUNTRY[c.id] = c; });
  var SHAPE = {}; MAPS.world.shapes.forEach(function (s) { SHAPE[s.id] = s; });
  var STATE_NAME = {}; MAPS.us.shapes.forEach(function (s) { STATE_NAME[s.id] = s.name; });
  function placeName(kind, id) {
    if (kind === "state") return STATE_NAME[id] || id;
    if (kind === "park") { var p = M.parkById(id); return p ? p.full : id; }
    return (SHAPE[id] && SHAPE[id].name) || (COUNTRY[id] && COUNTRY[id].name) || id;
  }
  function summaryLine(k) {
    var s = M.stats(k, state.trips, MAPS.world);
    return s.states + " states · " + s.countries + (s.countries === 1 ? " country" : " countries") + " · " + s.parks + (s.parks === 1 ? " park" : " parks");
  }

  function avatars(ids) {
    return ids.map(kidById).filter(Boolean).map(function (x) { return '<span class="dotp" title="' + esc(M.who(x)) + '" style="' + kidStyle(x) + '">' + initial(x) + '</span>'; }).join("");
  }
  function travelerNames(ids) { return M.joinNames(names(ids)); }

  // ---------- backup reminder ----------
  function backupBanner() {
    if (!M.backupDue({ lastBackupAt: state.meta.lastBackupAt, dismissedAt: state.meta.backupDismissedAt, trips: state.trips, people: state.kids })) return "";
    var last = state.meta.lastBackupAt;
    return '<div class="nudge backupnag" role="region" aria-label="Backup reminder"><button type="button" class="x" data-backup-dismiss aria-label="Not now">×</button>' +
      '<b>Save a backup so your log is safe if this phone is lost or reset.</b> ' +
      '<span class="small">' + (last ? "Your last backup was " + esc(M.prettyDate(last.slice(0, 10))) + ", and you've added to the log since." : "You haven't saved one yet.") + '</span>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-backup-now>Back up now</button><button type="button" class="btn btn-ghost" data-backup-dismiss>Not now</button></div></div>';
  }
  function doBackup() {
    return all("photos").then(function (photos) {
      var data = M.makeBackup(state.kids, state.trips.concat(state.bin), photos, null, { home: state.meta.home || "", homePoint: state.meta.homePoint, units: state.meta.units }), blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "famstamp-backup-" + ((window.MLTL_SYNC && window.MLTL_SYNC.backupTag && window.MLTL_SYNC.backupTag()) || "") + M.today() + ".json";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return setMeta("lastBackupAt", data.exportedAt);
    });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-backup-now],[data-backup-dismiss]");
    if (!t) return;
    var banner = document.querySelector(".backupnag");
    if (t.hasAttribute("data-backup-now")) doBackup().then(function () { if (banner) banner.remove(); toast("Backup saved. Keep the file somewhere safe."); }).catch(function () { toast("Couldn't make the backup. Try More → Back up and restore."); });
    else setMeta("backupDismissedAt", new Date().toISOString()).then(function () { if (banner) banner.remove(); toast("OK, we'll remind you in a week"); });
  });

  // ---------- router ----------
  var lastRouted = null;
  function route() {
    var same = lastRouted === location.hash; lastRouted = location.hash;
    if (!same) return routeView();
    // Same screen drawn again (a sync, a background save): keep the scroll spot, open lists, typed searches and focus.
    var y = window.scrollY, open = Array.prototype.map.call(main.querySelectorAll("details"), function (d) { return d.open; });
    var boxes = {}; main.querySelectorAll("input[type=search][id]").forEach(function (i) { if (i.value) boxes[i.id] = i.value; });
    var ae = document.activeElement, focusId = ae && main.contains(ae) && ae.id, sel = focusId && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;
    var r = routeView();
    var ds = main.querySelectorAll("details"); if (ds.length === open.length) ds.forEach(function (d, i) { if (open[i]) d.open = true; });
    Object.keys(boxes).forEach(function (id) { var i = document.getElementById(id); if (i && !i.value) { i.value = boxes[id]; i.dispatchEvent(new Event("input")); } });
    if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus({ preventScroll: true }); if (sel) try { f.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
    window.scrollTo(0, y);
    return r;
  }
  function routeView() {
    var h = location.hash.replace(/^#\/?/, "").split("/");
    document.body.classList.remove("kidview"); document.body.classList.remove("bookpdf");
    document.body.classList.remove("followview");
    if (h[0] === "follow" && window.FS_FOLLOW) return window.FS_FOLLOW.view(h[1] || "");
    if (h[0] === "where" && window.FS_WHERE) return window.FS_WHERE.view(h[1] || "");
    if (h[0] === "highlights" && window.FS_HL) { window.FS_HL.view(); main.insertAdjacentHTML("beforeend", homeTabs("highlights")); return; }
    // v63: feature pages (recap, rewards & certificates, road-trip games, kid journal) register here: f(h) -> true if it drew the page
    var xr = window.FS_ROUTES || []; for (var xi = 0; xi < xr.length; xi++) if (xr[xi](h)) return;
    if (window.MLTL_SYNC && window.MLTL_SYNC.route(h)) return;
    if (h[0] === "family" && h[1] === "passport") return UI().passportFamily();
    if (h[0] === "family" && h[1] === "cup") return viewCup();
    if (h[0] === "family" && h[1] === "signs") return UI().signs(null);
    if (h[0] === "family" && h[1] === "wishes" && window.FS_WISH) return window.FS_WISH.view();
    if (window.MLTL_IMPORT && window.MLTL_IMPORT.route(h)) return;
    if (h[0] === "year" && window.FS_YEAR && window.FS_YEAR.view) return window.FS_YEAR.view(h[1] && kidById(h[1]) ? h[1] : "");
    if (h[0] === "near" && window.FS_NEAR) return window.FS_NEAR.view();
    if (h[0] === "family") return viewFamily();
    if (h[0] === "together") return viewTogether(h[1]);
    if ((h[0] === "p" || h[0] === "kid") && kidById(h[1])) {
      document.body.classList.add("kidview");
      var k = kidById(h[1]), tab = h[2] || "us";
      if (tab === "trips" && h[3] === "new") return UI().builder(k, null, { all: h[4] === "all" });
      if (tab === "trips" && h[3] === "edit") return UI().builder(k, h[4]);
      if (tab === "trip" && h[3]) return UI().detail(k, h[3]);
      if (tab === "passport") return UI().passport(k);
      if (tab === "signs") return UI().signs(k);
      if (tab === "print") return viewPrint(k);
      if (tab === "quests" && window.FS_QUESTS) return window.FS_QUESTS.view(k, h[3] || "");
      if (tab === "book" && window.FS_BOOK) return window.FS_BOOK.view(k, h[3] || "");
      if (tab === "firsts" && window.FS_FIRSTS) return window.FS_FIRSTS.view(k, h[3] || "", h[4] || "");
      if (tab === "edit") return viewKidForm(k);
      return viewKid(k, tab, h[3]);
    }
    if (h[0] === "add") return viewKidForm(null);
    if (h[0] === "backup") return viewBackup();
    if (h[0] === "deleted") return viewDeleted();
    return viewHome();
  }
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });

  // ---------- home ----------
  /** Home's one-line nudge to the trips made from photos that still need a look; goes to the person with the most of them. */
  function reviewNudge() {
    var drafts = M.draftTrips(state.trips); if (!drafts.length) return "";
    var by = {}; drafts.forEach(function (t) { t.kidIds.forEach(function (id) { by[id] = (by[id] || 0) + 1; }); });
    var mine = myPersonId(), who = by[mine] ? mine : Object.keys(by).filter(kidById).sort(function (a, b) { return by[b] - by[a]; })[0];
    if (!who) return "";
    return '<p class="reviewnudge"><a class="tapline" href="#/p/' + esc(who) + '/trips/review">📷 ' + drafts.length + (drafts.length === 1 ? " trip" : " trips") + ' from your photos to review →</a></p>';
  }
  /** v51 On this day: trips from today's date in earlier years; nothing at all when there are none. */
  function onThisDayCard() {
    var hits = M.onThisDay(state.trips, M.today()); if (!hits.length) return onThisMonthCard();
    var rows = hits.slice(0, 3).map(function (x) {
      var who = x.trip.kidIds.filter(kidById)[0];
      var line = esc(M.onThisDayLine(x));
      return '<li>' + (who ? '<a class="tapline" href="#/p/' + esc(who) + '/trip/' + esc(x.trip.id) + '">' + line + '</a>' : line) +
        '<span class="muted small"> · ' + esc(travelerNames(x.trip.kidIds)) + '</span></li>';
    }).join("");
    return '<section class="panel onthisday" aria-label="On this day"><h3><span aria-hidden="true">🕰️</span> On this day</h3><ul>' + rows + '</ul>' +
      (hits.length > 3 ? '<p class="small muted">and ' + (hits.length - 3) + ' more from this date</p>' : "") + '</section>';
  }
  /** v57: nothing on today's date -> trips from this month in earlier years. Hidden only when the month is empty too. */
  function onThisMonthCard() {
    var hits = M.onThisMonth(state.trips, M.today()); if (!hits.length) return "";
    var rows = hits.slice(0, 5).map(function (x) {
      var who = x.trip.kidIds.filter(kidById)[0], line = esc(M.onThisMonthLine(x));
      return '<li>' + (who ? '<a class="tapline" href="#/p/' + esc(who) + '/trip/' + esc(x.trip.id) + '">' + line + '</a>' : line) +
        '<span class="muted small"> · ' + esc(travelerNames(x.trip.kidIds)) + '</span></li>';
    }).join("");
    return '<section class="panel onthisday onthismonth" aria-label="This month in past years"><h3><span aria-hidden="true">🗓️</span> This month in past years</h3><ul>' + rows + '</ul>' +
      (hits.length > 5 ? '<p class="small muted">and ' + (hits.length - 5) + ' more from ' + esc(hits[0].month) + '</p>' : "") + '</section>';
  }
  /** v53: on a trip right now -> quick stamp; otherwise a countdown to the next planned trip. Nothing when neither. */
  function tripsAheadCard() {
    var today = M.today(), now = M.onTripNow(state.trips, today), next = M.upcoming(state.trips, today), html = "";
    now.slice(0, 2).forEach(function (x) {
      var who = x.trip.kidIds.filter(kidById)[0]; if (!who) return;
      html += '<section class="panel tripnow" aria-label="On a trip now"><h3><span aria-hidden="true">🧳</span> ' + esc(M.tripLabel(x.trip)) + '</h3>' +
        '<p class="small muted">' + (x.of > 1 ? "Day " + x.day + " of " + x.of + " · " : "Today · ") + esc(travelerNames(x.trip.kidIds)) + '</p>' +
        '<div class="actions"><button type="button" class="btn btn-beacon" data-quickstamp="' + esc(who) + '|' + esc(x.trip.id) + '">📍 Stamp a stop</button>' +
        '<a class="btn btn-ghost" href="#/p/' + esc(who) + '/trip/' + esc(x.trip.id) + '">Open trip</a><a class="btn btn-ghost" href="#/near">📍 What\'s near me</a></div><p class="small" id="nearline"></p></section>';
    });
    if (!now.length && next.length) {
      var x = next[0], who = x.trip.kidIds.filter(kidById)[0];
      html += '<a class="panel familycard countdown" href="' + (who ? "#/p/" + esc(who) + "/trip/" + esc(x.trip.id) : "#/") + '"><span class="fam-ic cd-n" aria-hidden="true">' + (x.days > 99 ? "✈️" : x.days) + '</span><span><h3>' + esc(M.countdownLine(x)) + '</h3>' +
        '<span class="muted small">' + esc(M.prettyDate(x.trip.date) + " · " + travelerNames(x.trip.kidIds)) + (next.length > 1 ? " · " + (next.length - 1) + " more planned" : "") + '</span></span></a>';
    }
    return html;
  }
  /** "Looks good" on a draft trip card. */
  function reviewDraft(id) {
    var t = state.trips.filter(function (x) { return x.id === id; })[0]; if (!t) return Promise.resolve();
    var u = M.reviewTrip(t);
    return put("trips", u).then(function () {
      state.trips = state.trips.map(function (x) { return x.id === id ? u : x; });
      toast(M.tripLabel(u) + " reviewed ✓"); routeView();
    }).catch(function () { toast("Couldn't save. Is the device out of space?"); });
  }
  function viewHome() {
    var html = '<h1>Color in every place your family goes, from the first road trip on.</h1>' +
      '<p class="lede">A travel map for each kid, and for the grown-ups too: states, countries and national parks, plus the little stories from every trip. ' +
      (window.MLTL_SYNC && window.MLTL_SYNC.isOn() ? "It's saved on this device and shared with your family log." : "It all stays right here on this device.") + '</p>';
    html = backupBanner() + html;
    if (state.kids.length) html += '<div class="homeadd">' + (state.kids.length === 1 ? '<a class="btn btn-beacon btn-big" id="homeadd" href="' + esc(UI().addTripHref(state.kids[0])) + '">' : '<button type="button" class="btn btn-beacon btn-big" id="homeadd" aria-haspopup="dialog">') +
      '<span aria-hidden="true">＋</span> Add a trip' + (state.kids.length === 1 ? '</a>' : '</button>') + '<span class="small muted">Stops, flights and miles, and everyone on it gets the stamps</span></div>';
    if (window.MLTL_SYNC && window.MLTL_SYNC.homeTop) html += window.MLTL_SYNC.homeTop();
    if (window.FS_HL) html += window.FS_HL.homeCard();
    if (window.FS_WHERE) html += window.FS_WHERE.homeCard();
    (window.FS_HOME_TOP || []).forEach(function (f) { try { html += f() || ""; } catch (e) {} });   // v63: today's journal, games on a trip, weekly recap
    html += reviewNudge() + tripsAheadCard() + onThisDayCard();
    if (state.kids.length && window.FS_NEAR && !M.onTripNow(state.trips, M.today()).length) html += '<p class="small nearlink"><a class="tapline" href="#/near">📍 What\'s near me? Parks and places to stamp nearby</a></p>';
    html += '<h2>Who\'s traveling?</h2><div class="kids">';
    state.kids.forEach(function (k) {
      html += '<a class="kidcard" href="#/p/' + esc(k.id) + '" style="' + kidStyle(k) + '"><span class="avatar">' + initial(k) + '</span>' +
              '<span><h3>' + esc(M.who(k)) + ' <span class="role">' + esc(roleLabel(k)) + '</span></h3>' + (M.realName(k) ? '<span class="muted small realname">' + esc(M.realName(k)) + '</span><br>' : "") + '<span class="muted">' + esc(summaryLine(k)) + '</span></span></a>';
    });
    html += '<a class="kidcard add" href="#/add">+ Add someone</a></div>';
    if (!state.kids.length) html += '<p class="hint">Start with the kids, then add Mom, Dad, Grandma or anyone else who travels with you. Nicknames work great.</p>';
    if (state.kids.length > 1) {
      var fs = M.familyStats(state.kids, state.trips, MAPS.world);
      html += '<a class="panel familycard" href="#/family"><span class="fam-ic" aria-hidden="true">🗺️</span><span><h3>Family map</h3><span class="muted small">' +
        esc(fs.states + " states · " + fs.countries + (fs.countries === 1 ? " country" : " countries") + " · " + fs.parks + (fs.parks === 1 ? " park" : " parks") + " between all of you") +
        '</span><br><span class="small">See every place anyone has been, and the places you\'ve been together →</span></span></a>';
      var top = M.pairCounts(state.kids, state.trips)[0];
      html += '<a class="panel familycard" href="#/together/top"><span class="fam-ic" aria-hidden="true">🤝</span><span><h3>Trips together</h3><span class="muted small">' +
        esc(top ? travelerNames(top.ids) + ": " + top.count + (top.count === 1 ? " trip" : " trips") + " together" : "Check who went on each trip to see who travels together") +
        '</span><br><span class="small">Pick two or more people to see the trips you shared →</span></span></a>';
    }
    if (state.kids.length && window.FS_WISH) html += window.FS_WISH.card();
    if (state.kids.length) html += '<a class="panel familycard" href="#/year"><span class="fam-ic" aria-hidden="true">🎉</span><span><h3>Our ' + new Date().getFullYear() + ' in stamps</h3><span class="small">Make a card of this year\'s trips and stamps to share →</span></span></a>';
    if (window.MLTL_SYNC) html += window.MLTL_SYNC.homeCard();
    html += '<div class="panel book"><span class="cover" aria-hidden="true">My Lifetime Travel Log</span><div>' +
            '<h3>Like paper too?</h3><p class="small muted">The matching paperback, My Lifetime Travel Log, has the same maps to color, all 64 parks and 40 trip pages, for the shelf. ' +
            '<a href="' + (BOOK_URL ? esc(BOOK_URL) : "#book") + '" class="tapline" data-book' + (BOOK_URL ? ' target="_blank" rel="noopener"' : "") + '>See the book</a></p></div></div>';
    main.innerHTML = html + homeTabs();
    if (window.FS_HL) window.FS_HL.refresh();
    // a tap that's only closing the family menu (dropdown on wide screens) shouldn't also start a trip
    var ha = document.getElementById("homeadd"); if (ha) ha.onclick = function (e) { if (document.getElementById("fammenu")) { e.preventDefault(); return; } if (ha.tagName === "BUTTON") UI().whoWentSheet(); };
    document.title = "Famstamp: stamp every trip";
    if (window.FS_NEAR) window.FS_NEAR.homeAuto();
  }

  // ---------- add / edit a person ----------
  var PLACEHOLDER = { kid: "e.g. Bug, Ellie, Captain", adult: "e.g. Mom, Dad, Jess", grand: "e.g. Grandma, Pop, Aunt Jo" };
  function viewKidForm(k) {
    var editing = !!k, color = k ? k.color : M.COLORS[state.kids.length % M.COLORS.length], role = k ? M.validRole(k.role) : (state.kids.length ? "" : "kid");
    if (!editing && !role) role = state.kids.some(function (x) { return x.role === "kid"; }) && !state.kids.some(function (x) { return x.role !== "kid"; }) ? "adult" : "kid";
    var rel = k ? M.relOf(k) : M.defaultRel(role), relTouched = !!(k && k.relationship);
    var av = k && window.FS_AVATARS && window.FS_AVATARS.has(k.av) ? k.av : "";
    var html = '<a class="back" href="' + (k ? "#/p/" + esc(k.id) + "/stats" : "#/") + '">← Back</a>' +
      '<h1>' + (editing ? "Edit " + esc(M.who(k)) : "Add someone") + '</h1><div class="panel">' +
      '<div class="field" style="margin-top:0"><label>Who is this?</label><div class="seg" role="group" aria-label="Who is this?">' + M.ROLES.map(function (r) {
        return '<button type="button" data-role="' + r.id + '" aria-pressed="' + (r.id === role) + '">' + esc(r.label) + '</button>'; }).join("") + '</div></div>' +
      '<div class="field"><label for="kname">Name</label><input id="kname" type="text" maxlength="40" autocomplete="off" value="' + (k ? esc(k.name) : "") + '" placeholder="' + PLACEHOLDER[role] + '" /></div>' +
      '<div class="field"><label for="knick">Nickname (optional, shows instead of the name)</label><input id="knick" type="text" maxlength="' + M.NICK_MAX + '" autocomplete="off" value="' + (k && k.nickname ? esc(k.nickname) : "") + '" placeholder="e.g. Nana, Papa, Bug" /></div>' +
      '<div class="field"><label for="krel">Relationship in this family</label><select id="krel">' + M.RELATIONS.map(function (r) { return '<option value="' + r.id + '"' + (r.id === rel ? " selected" : "") + '>' + esc(r.label) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="kyear">Year they were born (optional, shows a kid\'s age on each trip)</label><input id="kyear" type="number" inputmode="numeric" min="1900" max="' + new Date().getFullYear() + '" value="' + (k && k.birthYear ? k.birthYear : "") + '" /></div>' +
      '<div class="field"><label>Map color</label><div class="swatches" role="group" aria-label="Map color">' +
      M.COLORS.map(function (c) { return '<button type="button" class="swatch" data-color="' + c + '" aria-pressed="' + (c === color) + '" aria-label="Color ' + c + '" style="background:' + c + '"></button>'; }).join("") +
      '</div></div>' + (window.FS_AVATARS ? '<div class="field"><label>Picture (optional)</label><div id="kav">' + window.FS_AVATARS.pickerHTML(av, k ? M.who(k).trim().charAt(0).toUpperCase() : "?", "--kid:" + esc(color)) + '</div></div>' : "") +
      '<p class="err" id="kerr" hidden></p><div class="actions"><button class="btn btn-primary" id="ksave">' + (editing ? "Save" : "Add") + '</button>' +
      (editing ? '<button class="btn btn-danger" id="kdel">Remove ' + esc(M.who(k)) + '</button>' : "") + '</div></div>';
    main.innerHTML = html;
    main.querySelectorAll("[data-role]").forEach(function (b) {
      b.onclick = function () { role = b.dataset.role; document.getElementById("kname").placeholder = PLACEHOLDER[role]; if (!relTouched) document.getElementById("krel").value = M.defaultRel(role); main.querySelectorAll("[data-role]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
    });
    main.querySelectorAll(".swatch").forEach(function (b) {
      b.onclick = function () { color = b.dataset.color; main.querySelectorAll(".swatch").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); main.querySelectorAll(".avpick").forEach(function (x) { x.style.setProperty("--kid", color); }); };
    });
    if (window.FS_AVATARS) window.FS_AVATARS.bindPicker(main, function (id) { av = id; });
    var ksaving = false;
    document.getElementById("ksave").onclick = function () {
      if (ksaving) return;   // a double tap mustn't add the person twice
      var name = document.getElementById("kname").value, year = document.getElementById("kyear").value, err = document.getElementById("kerr");
      var nick = document.getElementById("knick").value, relv = document.getElementById("krel").value;
      try {
        var cap = !editing && window.MLTL_SYNC && window.MLTL_SYNC.peopleCap ? window.MLTL_SYNC.peopleCap() : 0;
        if (cap && state.kids.length >= cap) throw new Error("Your Founders plan covers up to " + cap + " people. Remove someone to add someone new.");
        var kid = editing ? k : M.newPerson({ name: name, role: role, birthYear: year, color: color, nickname: nick, relationship: relv });
        if (window.FS_AVATARS) { if (av) kid.av = av; else delete kid.av; }
        if (editing) { var tmp = M.newPerson({ name: name, role: role, birthYear: year, color: color }); k.name = tmp.name; k.role = tmp.role; k.birthYear = tmp.birthYear; k.color = tmp.color; k.relationship = M.validRel(relv, tmp.role); var nk = M.newPerson({ name: "x", nickname: nick }).nickname; if (nk) k.nickname = nk; else delete k.nickname; k.updatedAt = new Date().toISOString(); }
        ksaving = true; document.getElementById("ksave").disabled = true;
        saveKid(kid).then(function () { if (!editing) state.kids.push(kid); state.kids.sort(byRole); location.hash = "#/p/" + kid.id + (editing ? "/stats" : "/us"); toast(editing ? "Saved" : "Welcome aboard, " + M.who(kid) + "!"); })
          .catch(function () { ksaving = false; document.getElementById("ksave").disabled = false; err.textContent = "Couldn't save. Is the device out of space?"; err.hidden = false; });
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    };
    if (editing) document.getElementById("kdel").onclick = function () {
      if (!confirm("Remove " + k.name + " and their map from this device? Trips shared with others stay. This can't be undone unless you have a backup.")) return;
      var jobs = [del("kids", k.id)];
      state.trips.slice().forEach(function (t) {
        if (t.kidIds.indexOf(k.id) < 0) return;
        t.kidIds = t.kidIds.filter(function (x) { return x !== k.id; });
        if (t.kidIds.length) jobs.push(put("trips", t));
        else { jobs.push(del("trips", t.id)); if (t.photoId) jobs.push(del("photos", t.photoId)); M.extraPhotoIds(t).forEach(function (id) { jobs.push(del("photos", id)); }); state.trips = state.trips.filter(function (x) { return x !== t; }); }
      });
      state.kids = state.kids.filter(function (x) { return x !== k; });
      Promise.all(jobs).then(function () { location.hash = "#/"; toast("Removed"); });
    };
    if (!editing) setTimeout(function () { document.getElementById("kname").focus(); }, 50);
  }

  // ---------- kid view ----------
  var TABS = [["us", "USA", "🇺🇸"], ["world", "World", "🌍"], ["parks", "Parks", "🏞️"], ["trips", "Trips", "📖"], ["passport", "Passport", "🛂"], ["stats", "Badges", "⭐"]];
  var worldZoom = "world";
  function shell(k, tab, inner) {
    var cur = tab === "trip" ? "trips" : tab;
    return (tab === "trips" ? backupBanner() : "") + '<div style="' + kidStyle(k) + '"><a class="back" href="#/">← Everyone</a><div class="kidhead"><span class="avatar">' + initial(k) + '</span><h1>' + esc(M.who(k)) + ' <span class="role">' + esc(roleLabel(k)) + '</span>' + (M.realName(k) ? ' <span class="muted small realname">' + esc(M.realName(k)) + '</span>' : "") + '</h1></div>' + whoBar(k, cur) +
      '<nav class="tabs" aria-label="Sections" style="' + kidStyle(k) + '"><div class="wrap">' + (window.FS_HL ? window.FS_HL.tab(false) : "") + TABS.map(function (t) {
        return '<a href="#/p/' + esc(k.id) + '/' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + t[2] + '</span>' + t[1] + '</a>';
      }).join("") + '</div></nav>' + inner + '</div>';
  }
  // Whose page is this? A strip of everyone to switch between, so it's always clear (and one tap to change).
  var TAB_WORD = { us: "USA map", world: "World map", parks: "parks", trips: "trips", passport: "passport", stats: "badges" };
  function myPersonId() { var c = state.meta.sync; return c && c.familyId && c.myPerson && kidById(c.myPerson) ? c.myPerson : ""; }
  function whoBar(k, tab) {
    if (state.kids.length < 2) return "";
    var me = myPersonId(), tabPath = tab === "us" ? "" : "/" + tab;
    return '<div class="whobar"><p class="whose">' + (k.id === me ? "Your " + esc(TAB_WORD[tab] || "page") : "You're viewing <b>" + esc(M.who(k)) + "'s " + esc(TAB_WORD[tab] || "page") + "</b>") + '</p>' +
      '<nav class="whoswitch" aria-label="Switch person">' + state.kids.map(function (p) {
        return '<a href="#/p/' + esc(p.id) + tabPath + '" style="' + kidStyle(p) + '"' + (p.id === k.id ? ' aria-current="page"' : "") + '><span class="dotp" aria-hidden="true">' + initial(p) + '</span>' + esc(M.who(p)) + (p.id === me ? ' <small>(you)</small>' : "") + '</a>';
      }).join("") + '</nav></div>';
  }
  /** The bottom tabs on the home screen go to your own pages (or the first person's when this phone isn't linked to anyone). */
  function homeTabs(cur) {
    if (!state.kids.length) return "";
    var p = kidById(myPersonId()) || state.kids[0];
    return '<nav class="tabs hometabs" aria-label="' + esc(M.who(p)) + '\'s sections"><div class="wrap">' + (window.FS_HL ? window.FS_HL.tab(cur === "highlights") : "") + TABS.map(function (t) {
      return '<a href="#/p/' + esc(p.id) + '/' + t[0] + '"><span class="ic" aria-hidden="true">' + t[2] + '</span>' + t[1] + '</a>';
    }).join("") + '</div></nav>';
  }
  function viewKid(k, tab, sub) {
    document.title = k.name + " · Famstamp";
    if (tab === "world") return viewWorld(k);
    if (tab === "parks") return viewParks(k, sub);
    if (tab === "trips") return viewTrips(k, sub === "review");
    if (tab === "stats") return viewStats(k);
    return viewUS(k);
  }
  function counter(n, total, label, extra) {
    return '<div class="count"><div class="big">' + n + ' <small>of ' + total + ' ' + label + '</small></div>' + (extra || "") + '</div><div class="bar"><i style="width:' + Math.round(100 * n / total) + '%"></i></div>';
  }
  function usSVG(k, opts) {
    var u = MAPS.us, s = '<svg viewBox="0 0 ' + u.w + ' ' + u.h + '" data-pz="us" role="img" aria-label="US map with ' + esc(M.who(k)) + '\'s states colored in">';
    u.insets.forEach(function (b) { s += '<rect class="inset" x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="' + (b[2] + 8) + '" height="' + (b[3] + 8) + '" rx="8"/>'; });
    u.shapes.forEach(function (p) { s += '<path class="a' + (k.states[p.id] ? " on" : "") + '" data-kind="state" data-id="' + p.id + '" d="' + p.d + '"><title>' + esc(p.name) + '</title></path>'; });
    return s + '</svg>';
  }
  var ZOOMS = { world: null, europe: [452, 32, 130, 80], uk: [467, 44, 38, 33], na: [60, 15, 330, 190] };
  function worldSVG(k, zoom) {
    var w = MAPS.world, vb = [0, 0, w.w, w.h], pre = ZOOMS[zoom];
    var s = '<svg viewBox="' + vb.join(" ") + '" data-pz="world"' + (pre ? ' data-pzinit="' + pre.join(" ") + '"' : "") + ' role="img" aria-label="World map with ' + esc(M.who(k)) + '\'s places colored in"><path class="ocean" d="' + w.outline + '"/><path class="grat" d="' + w.grat + '"/>';
    var r = Math.max(vb[2] / 260, 0.25) * (pre ? pre[2] / vb[2] : 1);
    w.shapes.forEach(function (p) {
      var on = !!k.places[p.id] || (p.id === "USA" && Object.keys(k.states).length > 0);
      s += '<path class="a' + (p.other ? " o" : "") + (p.uk ? " uk" : "") + (on ? " on" : "") + '" data-kind="place" data-id="' + p.id + '" d="' + p.d + '"><title>' + esc(p.name) + '</title></path>';
    });
    w.shapes.forEach(function (p) { if (p.dot && !p.other) s += '<circle class="dot' + (k.places[p.id] ? " on" : "") + '" data-kind="place" data-id="' + p.id + '" cx="' + p.c[0] + '" cy="' + p.c[1] + '" r="' + (r * 1.15).toFixed(2) + '"><title>' + esc(p.name) + '</title></circle>'; });
    return s + '</svg>';
  }
  // Region buttons (Whole world, North America, Europe, UK & Ireland) glide the map there instead of re-drawing it (mapzoom.js).
  function bindZoomButtons() {
    var box = main.querySelector(".mapbox.pz, .mapbox"), btns = main.querySelectorAll("[data-zoom]");
    btns.forEach(function (b) { b.onclick = function () {
      worldZoom = b.dataset.zoom; var pz = window.FS_MAP && window.FS_MAP.of(box), z = ZOOMS[worldZoom];
      if (pz) { if (z) pz.zoomToBox(z, 1); else pz.fit(); }
      btns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    }; });
    if (box) box.addEventListener("pzuser", function () { worldZoom = ""; btns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); });
  }
  function bindMap(k, rerender) {
    main.querySelectorAll("[data-kind]").forEach(function (el) {
      if (el.tagName === "INPUT") return;
      el.addEventListener("click", function () {
        var kind = el.dataset.kind, id = el.dataset.id;
        if (kind === "place" && id === "USA" && Object.keys(k.states).length) { toast("Color states on the USA map"); return; }
        whoBeen(k, kind, id, function () { rerender(); });
      });
    });
    main.querySelectorAll("input[data-kind]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        cb.checked = !cb.checked;   // nothing changes until "Who's been there?" is saved
        whoBeen(k, cb.dataset.kind, cb.dataset.id, function () { rerender(true); });
      });
    });
  }
  // Marking a place by hand always asks who's been there (starting with whoever is signed in, not whose page this is).
  function whoBeen(k, kind, id, after) {
    var bag = kind === "state" ? k.states : kind === "park" ? k.parks : k.places;
    window.FS_WHO.open({ kind: kind, area: id, page: k, mode: bag[id] ? "edit" : "add", after: after });
  }
  function keepOpen(fn) {
    var d = main.querySelector("details.list"), open = d && d.open, y = window.scrollY, q = main.querySelector("#find"), qv = q ? q.value : "";
    fn();
    var d2 = main.querySelector("details.list"); if (d2 && open) d2.open = true;
    var q2 = main.querySelector("#find"); if (q2 && qv) { q2.value = qv; q2.dispatchEvent(new Event("input")); }
    window.scrollTo(0, y);
  }
  var MAP_HINT = '<p class="hint">Pinch or use + and − to zoom, drag to move. Tap to color it in, tap again to undo.';
  function viewUS(k) {
    var s = M.stats(k, state.trips, MAPS.world), FF = window.FS_FIND, byReg = {};
    MAPS.us.shapes.forEach(function (p) { var r = FF.REGION[p.id] || "West"; (byReg[r] = byReg[r] || []).push(p); });
    var list = FF.REGIONS.filter(function (r) { return byReg[r]; }).map(function (r) {
      var ps = byReg[r], n = ps.filter(function (p) { return k.states[p.id] && p.id !== "DC"; }).length;
      return FF.group(r, r, n, ps.filter(function (p) { return p.id !== "DC"; }).length, ps.map(function (p) {
        return '<label class="check" data-name="' + esc(p.name + " " + p.id) + '"><input type="checkbox" data-kind="state" data-id="' + p.id + '"' + (k.states[p.id] ? " checked" : "") + '> <span data-hl>' + esc(p.name) + '</span>' + (p.id === "DC" ? '<span class="meta">bonus</span>' : "") + '</label>';
      }).join(""));
    }).join("");
    main.innerHTML = shell(k, "us", counter(s.states, 50, "states") +
      '<div class="pzfind"></div><div class="mapbox us">' + usSVG(k) + '</div>' + MAP_HINT + ' Tiny states are easy in the list too.</p>' +
        '<p class="small"><a class="tapline" href="#/p/' + esc(k.id) + '/signs">🪧 See ' + esc(M.who(k)) + '\'s State Signs →</a></p>' +
      '<details class="list"><summary>Pick from a list</summary><div class="checks plist" data-plist="us:' + esc(k.id) + '">' +
        FF.tools('<div class="field"><label for="find">Find a state</label><input id="find" type="search" placeholder="Type a state, e.g. Utah or UT" autocomplete="off"></div>') + list + '</div></details>');
    FF.bind(main.querySelector("[data-plist]"), main.querySelector("#find"), false);
    bindMap(k, function () { keepOpen(function () { viewUS(k); }); });
  }
  function viewWorld(k) {
    var s = M.stats(k, state.trips, MAPS.world), FF = window.FS_FIND;
    var byCont = {};
    MAPS.world.countries.forEach(function (c) { (byCont[c.cont] = byCont[c.cont] || []).push(c); });
    function row(id, name, on, extra, cls) {
      return '<label class="check' + (cls || "") + '" data-name="' + esc(name + " " + FF.alias(id) + (cls ? " united kingdom uk" : "")) + '"><input type="checkbox" data-kind="place" data-id="' + id + '"' + (on ? " checked" : "") + (extra || "") + '> <span data-hl>' + esc(name) + '</span></label>';
    }
    var list = Object.keys(byCont).map(function (cont) {
      var cs = byCont[cont], n = 0;
      var rows = cs.map(function (c) {
        if (c.id === "GBR") {
          if (s.ukNations) n++;
          return '<div class="check ukhead" data-name="' + esc("united kingdom england scotland wales northern ireland " + FF.alias("GBR")) + '"><b data-hl>United Kingdom</b><span class="meta">' + s.ukNations + ' of 4</span></div>' +
            MAPS.world.uk.map(function (u) { return row(u.id, u.name, !!k.places[u.id], "", " sub"); }).join("");
        }
        var on = c.id === "USA" ? Object.keys(k.states).length > 0 || !!k.places.USA : !!k.places[c.id];
        if (on) n++;
        return row(c.id, c.name, on, c.id === "USA" && Object.keys(k.states).length ? " disabled" : "");
      }).join("");
      return FF.group(cont, cont, n, cs.length, rows);
    }).join("");
    var others = MAPS.world.shapes.filter(function (p) { return p.other; });
    list += FF.group("Other places", "Other places", others.filter(function (p) { return k.places[p.id]; }).length, others.length,
      '<p class="small muted">Territories and places that aren\'t on the list of 195, like Puerto Rico or Greenland. They\'re on your map but don\'t add to the country count.</p>' +
      others.map(function (p) { return row(p.id, p.name, !!k.places[p.id]); }).join(""));
    var extra = '<div class="muted small">UK nations: ' + s.ukNations + ' of 4</div>';
    main.innerHTML = shell(k, "world", counter(s.countries, 195, "countries", extra) +
      '<div class="seg" role="group" aria-label="Zoom">' + [["world", "Whole world"], ["na", "North America"], ["europe", "Europe"], ["uk", "UK & Ireland"]].map(function (z) {
        return '<button type="button" data-zoom="' + z[0] + '" aria-pressed="' + (worldZoom === z[0]) + '">' + z[1] + '</button>'; }).join("") + '</div>' +
      '<div class="pzfind"></div><div class="mapbox">' + worldSVG(k, worldZoom) + '</div>' + MAP_HINT + ' England, Scotland, Wales and Northern Ireland each get their own color.</p>' +
      '<details class="list"><summary>Pick from a list</summary><div class="checks plist" data-plist="world:' + esc(k.id) + '">' +
        FF.tools('<div class="field"><label for="find">Find a place</label><input id="find" type="search" placeholder="Type a country, e.g. Holland or UK" autocomplete="off"></div>') + list + '</div></details>');
    bindZoomButtons();
    FF.bind(main.querySelector("[data-plist]"), main.querySelector("#find"), false);
    bindMap(k, function () { keepOpen(function () { viewWorld(k); }); });
  }
  // ---------- national parks: a stamp per park, dots on the US map ----------
  // toLocaleDateString and the stamp art are slow-ish and the same every time: remember them (a few hundred small strings at most)
  var NICE = {}, PKSTAMP = {};
  function niceDate(at) { var key = String(at).slice(0, 10); if (key in NICE) return NICE[key]; var d = new Date(key + "T12:00:00"); return (NICE[key] = isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })); }
  function parkStamp(p, v) {
    var PP = window.WK_PASSPORT; if (!PP) return "";
    var key = p.id + "|" + (v && v.at ? v.at : ""); if (PKSTAMP[key]) return PKSTAMP[key];
    return PKSTAMP[key] = PP.stampSVG({ id: "pk-" + p.id, kind: "park", area: p.id, date: v && v.at ? v.at : "" }, p.name, { sub: M.parkSub(p) });
  }
  /** Park stamps are drawn when their row comes near the screen (a list can be 100+ detailed stamps; drawing them all froze phones). */
  var pkIO = null;
  function lazyStamps(k) {
    var els = main.querySelectorAll(".pkstamp[data-pk]");
    function fill(el) { if (!el.dataset.pk) return; var p = M.parkById(el.dataset.pk); el.innerHTML = p ? parkStamp(p, k.parks[p.id]) : ""; el.removeAttribute("data-pk"); }
    if (pkIO) pkIO.disconnect();
    if (!window.IntersectionObserver) return Array.prototype.forEach.call(els, fill);
    pkIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { fill(e.target); pkIO.unobserve(e.target); } }); }, { rootMargin: "600px 0px" });
    Array.prototype.forEach.call(els, function (el) { pkIO.observe(el); });
  }
  var PARK_SETS_TXT = {
    np: { what: "national parks", find: "Find a park or state", ph: "e.g. Zion, Utah or UT", hint: "Every park has its own stamp below. American Samoa and the Virgin Islands are off the map." },
    sp: { what: "state parks", find: "Find a state park or state", ph: "e.g. Custer, Florida or NY", hint: "Some of the most loved state parks around the country, each with its own stamp. State parks are run by each state." },
    nm: { what: "monuments & memorials", find: "Find a monument, memorial or state", ph: "e.g. Lincoln or DC", hint: "National monuments and national memorials run by the National Park Service. Many have a Junior Ranger program too." } };
  function parksMapSVG(k, list, what) {
    var u = MAPS.us, T = window.WK_TRIPS, s = '<svg viewBox="0 0 ' + u.w + ' ' + u.h + '" role="img" aria-label="US map with ' + esc(what) + '; visited ones are filled in">';
    u.insets.forEach(function (b) { s += '<rect class="inset" x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="' + (b[2] + 8) + '" height="' + (b[3] + 8) + '" rx="8"/>'; });
    u.shapes.forEach(function (p) { s += '<path class="a pk" d="' + p.d + '"/>'; });
    list.forEach(function (p) {
      if (p.lat == null || p.states === "AS" || p.states === "VI" || !T) return;
      var xy = T.project({ lat: p.lat, lon: p.lon, region: p.states.split(/,\s*/)[0] }, "us"); if (!xy) return;
      var on = !!k.parks[p.id];
      s += '<circle class="pkdot' + (on ? " on" : "") + '" cx="' + xy[0].toFixed(1) + '" cy="' + xy[1].toFixed(1) + '" r="' + (on ? 7 : 5) + '"><title>' + esc(p.name) + (on ? " (visited)" : "") + '</title></circle>';
    });
    return s + '</svg>';
  }
  /** Parks | Cities | Food & drink | Pubs: the Parks tab's top switch (Pubs only on grown-ups' pages). */
  function kindSeg(k, cur) {
    var SP = window.FS_SPOTS, list = [["", "Parks", "Parks"], ["cities", "Cities", "Cities"], ["hubs", "Travel hubs", "Hubs"], ["food", "Food & drink", "Food"]].concat(SP && !M.isKid(k) ? [["pubs", "Pubs & breweries", "Pubs"]] : []);
    if (!SP) return "";
    return '<div class="seg kindseg" role="group" aria-label="What to collect">' + list.map(function (x) {
      return '<a href="#/p/' + esc(k.id) + '/parks' + (x[0] ? "/" + x[0] : "") + '"' + (x[0] === cur ? ' class="on" aria-current="page"' : "") + '><span class="lg">' + esc(x[1]) + '</span><span class="sh">' + esc(x[2]) + '</span></a>'; }).join("") + '</div>';
  }
  function viewParks(k, set) {
    var SP = window.FS_SPOTS;
    if (SP && SP.isCat(set)) {
      if (set === "pubs" && M.isKid(k)) { location.replace("#/p/" + k.id + "/parks/food"); return; }
      main.innerHTML = shell(k, "parks", kindSeg(k, set) + SP.html(k, set, state.trips));
      SP.bind(k, set, main, function () { var y = window.scrollY; viewParks(k, set); window.scrollTo(0, y); });
      return;
    }
    if (!PARK_SETS_TXT[set]) set = "np";
    var s = M.stats(k, state.trips, MAPS.world), kidMode = M.isKid(k), FF = window.FS_FIND, byReg = {}, list = M.parksIn(set), tx = PARK_SETS_TXT[set], jrOk = set !== "sp";
    var been = list.filter(function (p) { return k.parks[p.id]; }).length;
    list.forEach(function (p) { var r = FF.REGION[p.states.split(/,\s*/)[0]] || "West"; (byReg[r] = byReg[r] || []).push(p); });
    var groups = FF.REGIONS.filter(function (r) { return byReg[r]; }).map(function (r) {
      var ps = byReg[r];
      return FF.group(r, r, ps.filter(function (p) { return k.parks[p.id]; }).length, ps.length, ps.map(function (p) {
        var v = k.parks[p.id];
        return '<div class="row" data-name="' + esc(p.full + " " + p.states + " " + p.states.split(/,\s*/).map(function (x) { return STATE_NAME[x] || ""; }).join(" ")) + '"><span class="pkstamp' + (v ? " on" : "") + '" aria-hidden="true" data-pk="' + p.id + '"></span><div class="nm"><b data-hl>' + esc(p.name) + '</b><span>' + esc(p.states + (set === "np" ? "" : " · " + p.label.charAt(0) + p.label.slice(1).toLowerCase())) + (v && v.at ? " · " + esc(niceDate(v.at)) : "") + '</span></div>' +
          '<button type="button" class="pill" data-park="' + p.id + '" aria-pressed="' + !!v + '">' + (v ? "✓ Been here" : "Been here?") + '</button>' +
          (kidMode && jrOk ? '<button type="button" class="pill jr" data-jr="' + p.id + '" aria-pressed="' + !!(v && v.jr) + '" aria-label="Junior Ranger badge at ' + esc(p.name) + '">' + (v && v.jr ? "★ Ranger" : "Ranger?") + '</button>' : "") + '</div>';
      }).join(""));
    }).join("");
    var seg = '<div class="seg parkset" role="group" aria-label="Which parks">' + M.PARK_SETS.map(function (x) {
      return '<a href="#/p/' + esc(k.id) + '/parks' + (x.id === "np" ? "" : "/" + x.id) + '"' + (x.id === set ? ' class="on" aria-current="page"' : "") + '><span class="lg">' + esc(x.name) + '</span><span class="sh">' + esc(x.short) + '</span></a>'; }).join("") + '</div>';
    main.innerHTML = shell(k, "parks", kindSeg(k, "") + seg + counter(been, list.length, tx.what, kidMode && set === "np" ? '<div class="muted small">Junior Ranger badges: ' + s.juniorRanger + '</div>' : "") +
      '<div class="mapbox us parksmap">' + parksMapSVG(k, list, tx.what) + '</div><p class="hint">Green dots are places ' + esc(M.who(k)) + ' has been to. ' + esc(tx.hint) + '</p>' +
      '<div class="panel parks plist" data-plist="parks-' + set + ':' + esc(k.id) + '">' + FF.tools('<div class="field" style="margin-top:0"><label for="pfind">' + esc(tx.find) + '</label><input id="pfind" type="search" placeholder="' + esc(tx.ph) + '" autocomplete="off"></div>') + groups + '</div>' +
      (kidMode && jrOk ? '<p class="hint">Earned a Junior Ranger badge? Tap "Ranger?" too. Ask at the visitor center; most National Park Service sites have a free booklet.</p>' : ""));
    lazyStamps(k);
    var f = main.querySelector("#pfind");
    FF.bind(main.querySelector("[data-plist]"), f, true);
    function again() { var q = f.value, y = window.scrollY, foc = document.activeElement === f; viewParks(k, set); var f2 = main.querySelector("#pfind"); f2.value = q; f2.dispatchEvent(new Event("input")); if (foc) f2.focus({ preventScroll: true }); window.scrollTo(0, y); f = f2; }
    main.querySelectorAll("[data-park]").forEach(function (b) { b.onclick = function () { whoBeen(k, "park", b.dataset.park, again); }; });
    main.querySelectorAll("[data-jr]").forEach(function (b) { b.onclick = function () { var on = M.togglePark(k, b.dataset.jr, "jr"); saveKid(k); if (on) toast("Junior Ranger! ★"); again(); }; });
  }

  // ---------- trips ----------
  var photoCache = {};
  function photoURL(id) {
    if (!id) return Promise.resolve(null);
    if (photoCache[id]) return Promise.resolve(photoCache[id]);
    return getOne("photos", id).then(function (p) { if (p) photoCache[id] = p.dataUrl; return p ? p.dataUrl : null; });
  }
  function kidTrips(k) {
    return state.trips.filter(function (t) { return t.kidIds.indexOf(k.id) >= 0; })
      .sort(function (a, b) { return (b.date || b.createdAt) < (a.date || a.createdAt) ? -1 : 1; });
  }
  /** k = whose list this card is on (for their age and the Edit link); leave it off on the Trips together view. */
  function tripCard(t, k) {
    if (UI()) return UI().tripCard(t, k);
    var age = k && M.isKid(k) ? M.ageOn(k.birthYear, t.date) : null, route = M.routeText(t), owner = k || kidById(t.kidIds[0]);
    return '<article class="trip">' + (t.photoId ? '<img alt="" data-photo="' + esc(t.photoId) + '">' : "") + '<div class="body"><h3>' + esc(t.place) + '</h3>' +
      (route !== t.place ? '<div class="route">' + esc(route) + '</div>' : "") +
      '<div class="when">' + esc([M.prettyDate(t.date), age != null ? "age " + age : "", t.mark ? "🖍 " + placeName(t.mark.kind, t.mark.id) : ""].filter(Boolean).join(" · ")) + '</div>' +
      (t.memory ? '<p class="mem">' + esc(t.memory) + '</p>' : "") +
      '<div class="travelers"><span class="dots">' + avatars(t.kidIds) + '</span><span>' + esc(travelerNames(t.kidIds)) + '</span></div>' +
      (t.who ? '<div class="who">Also along: ' + esc(t.who) + '</div>' : "") +
      (owner ? '<a class="edit noprint" href="#/p/' + esc(owner.id) + '/trips/edit/' + esc(t.id) + '">Edit</a>' : "") +
      (window.MLTL_SYNC && window.MLTL_SYNC.tripExtra ? window.MLTL_SYNC.tripExtra(t) : "") + '</div></article>';
  }
  // v68 speed pass: photos load from the phone's database only as they come near the screen (the book, slideshows and
  // printing still load every photo at once so nothing prints blank).
  var photoIO = null;
  function fillOne(img) { if (img.dataset.filled) return; img.dataset.filled = "1"; photoURL(img.dataset.photo).then(function (u) { if (u) img.src = u; }); }
  function fillPhotos() {
    var imgs = main.querySelectorAll("img[data-photo]:not([data-filled])");
    var eager = typeof IntersectionObserver === "undefined" || /^#\/book|^#\/p\/[^/]+\/book/.test(location.hash) || main.querySelector(".bookpages, .slide");
    if (!eager && !photoIO) photoIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { photoIO.unobserve(e.target); fillOne(e.target); } }); }, { rootMargin: "800px 0px" });
    imgs.forEach(function (img) { img.decoding = "async"; if (eager) fillOne(img); else photoIO.observe(img); });
  }
  window.addEventListener("beforeprint", function () { main.querySelectorAll("img[data-photo]:not([data-filled])").forEach(fillOne); });
  function viewTrips(k, review) {
    var all = kidTrips(k), drafts = all.filter(M.isDraft), list = review ? drafts : all;
    var base = "#/p/" + esc(k.id) + "/trips";
    var filt = drafts.length || review ? '<div class="chips tripfilter" role="group" aria-label="Show"><a class="chip" href="' + base + '" aria-pressed="' + !review + '">All (' + all.length + ')</a>' +
      '<a class="chip" href="' + base + '/review" aria-pressed="' + !!review + '">To review (' + drafts.length + ')</a></div>' : "";
    main.innerHTML = shell(k, "trips", '<div class="actions"><a class="btn btn-beacon" href="#/p/' + esc(k.id) + '/trips/new">+ Add a trip</a>' +
      (state.kids.length > 1 ? '<a class="btn btn-ghost" href="#/together/' + esc(k.id) + '">🤝 Trips together</a>' : "") + '</div>' + filt +
      (review && !drafts.length ? '<div class="panel"><h3>All reviewed 🎉</h3><p class="muted">Every trip from your photos has been checked. <a class="tapline" href="' + base + '">See all trips</a></p></div>' : "") +
      (list.length ? '<div class="trips">' + list.map(function (t) { return tripCard(t, k); }).join("") + '</div>'
                   : review ? "" : '<div class="panel"><h3>No trips yet</h3><p class="muted">A weekend at Grandma\'s counts just as much as a plane to the other side of the world. Add the first one!</p>' +
                     (window.MLTL_IMPORT ? '<div class="actions">' + window.MLTL_IMPORT.emptyButton(k) + '</div>' : "") + '</div>') +
      (state.bin.length ? '<p class="small binlink"><a class="tapline" href="#/deleted">🗑 Recently deleted (' + state.bin.length + ')</a></p>' : ""));
    fillPhotos();
  }
  function markOptions(sel) {
    var v = sel ? sel.kind + ":" + sel.id : "";
    var o = '<option value="">No, just save the trip</option><optgroup label="US states">' +
      MAPS.us.shapes.map(function (p) { return '<option value="state:' + p.id + '"' + (v === "state:" + p.id ? " selected" : "") + '>' + esc(p.name) + '</option>'; }).join("") + '</optgroup>';
    o += '<optgroup label="UK nations">' + MAPS.world.uk.map(function (u) { return '<option value="place:' + u.id + '"' + (v === "place:" + u.id ? " selected" : "") + '>' + esc(u.name) + '</option>'; }).join("") + '</optgroup>';
    o += '<optgroup label="Countries">' + MAPS.world.countries.filter(function (c) { return c.id !== "GBR" && c.id !== "USA"; }).slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (c) { return '<option value="place:' + c.id + '"' + (v === "place:" + c.id ? " selected" : "") + '>' + esc(c.name) + '</option>'; }).join("") + '</optgroup>';
    M.PARK_SETS.forEach(function (set) { o += '<optgroup label="' + esc(set.name) + '">' + M.parksIn(set.id).map(function (p) { return '<option value="park:' + p.id + '"' + (v === "park:" + p.id ? " selected" : "") + '>' + esc(set.id === "np" ? p.name : p.full) + '</option>'; }).join("") + '</optgroup>'; });
    return o;
  }
  function shrinkPhoto(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var d = M.fitDims(img.naturalWidth, img.naturalHeight, 1280), c = document.createElement("canvas");
        c.width = d.w; c.height = d.h; c.getContext("2d").drawImage(img, 0, 0, d.w, d.h); URL.revokeObjectURL(url);
        var q = 0.82, out = c.toDataURL("image/jpeg", q);
        while (out.length > 360000 && q > 0.45) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }   // aim for ~250 KB or less
        res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("That photo couldn't be opened. Try a JPEG or PNG.")); };
      img.src = url;
    });
  }
  // The trip builder lives in trips-ui.js (v1.4).

  // ---------- stats + badges ----------
  var MEDALS = { "first-trip": "🎒", storyteller: "📖", photo: "📷", "states-5": "🚗", "states-10": "🗺️", "states-25": "🏁", "states-50": "🏆",
                 abroad: "🛂", "countries-5": "🌍", "continents-3": "🧭", scotland: "🏴", "uk-4": "👑", "park-1": "🌲", "parks-10": "🥾", "junior-ranger": "⭐", together: "🤝",
                 "first-flight": "✈️", "frequent-flyer": "🛫", "sky-miles": "☁️", "road-trip": "🚐", "miles-1000": "🧭", "miles-10000": "🚀", "around-world": "🌐" };
  function statBox(v, total, k) { return '<div class="stat"><div class="v">' + v + (total ? ' <small>/ ' + total + '</small>' : "") + '</div><div class="k">' + k + '</div></div>'; }
  function questsCard(k) {
    var Q = window.FS_QUESTS; if (!Q) return "";
    var got = Q.earned(k), going = Q.list(k).filter(function (x) { return x.pr.have && !x.pr.complete; }).length;
    return '<a class="familycard qentry" href="#/p/' + esc(k.id) + '/quests"><span class="qemo" aria-hidden="true"><i>🧭</i></span><span><b>Travel quests</b><span class="small muted">' +
      (got.length ? got.length + " quest badge" + (got.length === 1 ? "" : "s") + " earned" + (going ? " · " + going + " on the go" : "") : going ? going + " on the go" : "Scavenger hunts for your trips") + '</span></span><span class="qgo" aria-hidden="true">›</span></a>';
  }
  /** Earned badges at the top of a passport: achievements, finished quests, recent firsts (a kid's Junior Ranger badges get their own section). Tap one for what it's for. */
  function badgeStrip(k) {
    var s = M.stats(k, state.trips, MAPS.world), out = [];
    M.badges(s).forEach(function (x) { if (x.earned) out.push({ ic: MEDALS[x.id] || "★", name: x.name, desc: x.desc }); });
        if (window.FS_QUESTS) window.FS_QUESTS.earned(k).forEach(function (e) { out.push({ ic: e.q.emoji || "🧭", name: e.q.badge || e.q.name, desc: e.q.name + " done" + (e.at ? " · " + e.at : "") }); });
    if (window.FS_FIRSTS) { try { window.FS_FIRSTS.list(k).slice(-3).reverse().forEach(function (r) { out.push({ ic: r.emoji || "⭐", name: r.title, desc: "A first" + (r.at ? " · " + r.at : "") }); }); } catch (e) {} }
    var all = '<a class="pbadges-all" href="#/p/' + esc(k.id) + '/stats">See all badges ›</a>';
    if (!out.length) return '<section class="pbadges empty"><p class="small muted">No badges yet. They show up here as ' + esc(M.who(k)) + ' travels.</p>' + all + '</section>';
    return '<section class="pbadges" aria-label="' + esc(M.who(k)) + '\'s badges"><div class="pbh"><h3>Badges <span class="muted small">' + out.length + '</span></h3>' + all + '</div><div class="pbrow">' +
      out.map(function (b, i) { return '<button type="button" class="pbadge' + (b.cls || "") + '" data-pb="' + i + '" data-name="' + esc(b.name) + '" data-desc="' + esc(b.desc) + '"><span class="pbm" aria-hidden="true">' + b.ic + '</span><span class="pbn">' + esc(b.name) + '</span></button>'; }).join("") + '</div></section>';
  }
  function bindBadgeStrip(k) {
    Array.prototype.forEach.call(main.querySelectorAll(".pbadge"), function (b) {
      b.onclick = function () {
        UI().sheet('<div class="sheethead"><h3>' + esc(b.dataset.name) + '</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div><div class="pbig" aria-hidden="true">' + b.querySelector(".pbm").innerHTML + '</div><p>' + esc(b.dataset.desc) + '</p><div class="actions"><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/stats">See all badges</a><button type="button" class="btn btn-primary" data-close>Close</button></div>');
        Array.prototype.forEach.call(document.querySelectorAll(".sheetbox .sheetx, .sheetbox [data-close]"), function (x) { x.onclick = UI().closeSheet; });
      };
    });
  }
  function viewStats(k) {
    var s = M.stats(k, state.trips, MAPS.world), b = M.badges(s), earned = b.filter(function (x) { return x.earned; }).length;
    main.innerHTML = shell(k, "stats", '<h2>' + esc(M.who(k)) + '\'s travel stats</h2><div class="stats">' +
      statBox(s.states, 50, "States") + statBox(s.countries, 195, "Countries") + statBox(s.ukNations, 4, "UK nations") + statBox(s.parks, 64, "National parks") +
      (s.kid ? statBox(s.juniorRanger, 0, "Junior Ranger") : "") + (window.FS_SPOTS ? (function (c) { return statBox(c.cities, 0, "Cities") + statBox(c.hubs, 0, "Travel hubs") + statBox(c.food, 0, "Food stamps") + (s.kid ? "" : statBox(c.pubs, 0, "Pubs & breweries")); })(window.FS_SPOTS.counts(k)) : "") + statBox(s.continents, 7, "Continents") + statBox(s.trips, 0, "Trips") + statBox(s.together, 0, "Trips together") + statBox(s.photos, 0, "Photos") +
      (s.years ? statBox(s.years, 0, s.years === 1 ? "Year of trips" : "Years of trips") : "") + (s.firstTripAge != null ? statBox(s.firstTripAge, 0, "Age on first trip") : "") + '</div>' +
      UI().lifetimeHTML(k.id) + questsCard(k) + (window.FS_REWARDS ? window.FS_REWARDS.card(k) : "") + (window.FS_FIRSTS ? window.FS_FIRSTS.card(k) : "") + (window.FS_BOOK ? window.FS_BOOK.card(k) : "") +
      '<h2>Badges <span class="muted small">' + earned + ' of ' + b.length + '</span></h2><div class="badges">' + b.map(function (x) {
        return '<div class="badge' + (x.earned ? "" : " locked") + '"><div class="medal" aria-hidden="true">' + (MEDALS[x.id] || "★") + '</div><b>' + esc(x.name) + '</b><span>' + esc(x.desc) + '</span>' +
          (x.earned ? "" : '<span>' + x.have + ' / ' + x.need + '</span>') + '</div>';
      }).join("") + '</div>' +
      '<div class="actions"><a class="btn btn-primary" href="#/p/' + esc(k.id) + '/print">🖨 Print my map</a><a class="btn btn-ghost" href="#/year/' + esc(k.id) + '">🎉 My year in stamps</a><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/edit">Edit name or color</a><a class="btn btn-ghost" href="#/backup">Back up</a></div>' +
      '<div class="panel book"><span class="cover" aria-hidden="true">My Lifetime Travel Log</span><div><h3>' + (s.kid ? "Want this on paper?" : "A paper copy for the kids?") + '</h3><p class="small muted">The paperback has the same maps to color and 40 trip pages' + (s.kid ? "" : ", made for kids 3 to 18") + '. ' +
      '<a href="' + (BOOK_URL ? esc(BOOK_URL) : "#book") + '" class="tapline" data-book' + (BOOK_URL ? ' target="_blank" rel="noopener"' : "") + '>See the book</a></p></div></div>');
    UI().bindLifetime(function () { viewStats(k); });
  }

  // ---------- family map ----------
  var famSel = null, famMode = "any", famMap = "us";
  function famPeople() {
    if (famSel) famSel = famSel.filter(function (id) { return kidById(id); });
    if (!famSel || !famSel.length) famSel = state.kids.map(function (k) { return k.id; });
    return state.kids.filter(function (k) { return famSel.indexOf(k.id) >= 0; });
  }
  function names(ids) { return ids.map(kidById).filter(Boolean).map(function (p) { return M.who(p); }); }
  function famTitle(people) {
    var adults = people.filter(function (p) { return !M.isKid(p); });
    if (people.length === 2 && adults.length === 2) return "you two";
    if (people.length === state.kids.length) return "the whole family";
    return names(people.map(function (p) { return p.id; })).join(" & ");
  }
  // v56: Family cup, a friendly ranking between the kids (siblings and cousins), or everyone. Worked out on this phone only.
  var cupAll = null;
  function cupPeople() { var kids = state.kids.filter(M.isKid); return (cupAll === null ? kids.length < 2 : cupAll) ? state.kids.slice() : kids; }
  function cupCard() {
    if (state.kids.length < 2) return "";
    var c = M.familyCup(cupPeople(), state.trips, MAPS.world), lead = c.cats[0], who = lead ? lead.rows.filter(function (r) { return r.rank === 1; }).map(function (r) { return M.who(kidById(r.id)); }) : [];
    return '<a class="panel familycard cupcard" href="#/family/cup"><span class="fam-ic" aria-hidden="true">🏆</span><span><h3>Family cup</h3><span class="small">' +
      (lead ? esc(lead.label) + ": " + esc(who.join(" & ")) + " lead" + (who.length > 1 ? "" : "s") + " →" : "A friendly race once the stamps start →") + '</span></span></a>';
  }
  function viewCup() {
    document.title = "Family cup · Famstamp";
    var kids = state.kids.filter(M.isKid), people = cupPeople(), all = people.length !== kids.length || cupAll === true;
    var c = M.familyCup(people, state.trips, MAPS.world), medal = ["🥇", "🥈", "🥉"];
    var html = '<a class="back" href="#/family">← Family map</a><h1>🏆 Family cup</h1>' +
      '<p class="lede small">A friendly race inside your family. It\'s worked out on this phone from your own log and isn\'t compared with anyone else.</p>' +
      (kids.length >= 2 && kids.length < state.kids.length ? '<div class="seg" role="group" aria-label="Who\'s in the cup">' + [["kids", "Kids & cousins"], ["all", "Everyone"]].map(function (m) {
        return '<button type="button" data-cup="' + m[0] + '" aria-pressed="' + ((m[0] === "all") === all) + '">' + m[1] + '</button>'; }).join("") + '</div>' : "") +
      '<h2>Cheers</h2><div class="cheers">' + people.map(function (p) {
        return '<a class="stat person" href="#/p/' + esc(p.id) + '" style="' + kidStyle(p) + '"><div class="v"><span class="dotp">' + initial(p) + '</span> ' + esc(M.who(p)) + '</div><div class="k">' + esc(c.cheers[p.id]) + '</div></a>'; }).join("") + '</div>';
    if (!c.cats.length) html += '<div class="panel"><p>No stamps yet. The first trip starts the race!</p></div>';
    c.cats.forEach(function (cat) {
      html += '<section class="panel cupcat"><h3>' + cat.icon + ' ' + esc(cat.label) + '</h3><ol class="cuprows">' + cat.rows.map(function (r) {
        var p = kidById(r.id);
        return '<li' + (r.rank === 1 && r.val > 0 ? ' class="lead"' : "") + '><span class="medal" aria-label="Place ' + r.rank + '">' + (r.val > 0 && medal[r.rank - 1] || "·") + '</span><span class="nm">' + esc(M.who(p)) + '</span><b>' + r.val.toLocaleString() + '</b></li>'; }).join("") + '</ol></section>';
    });
    html += '<p class="small muted">Ties share a place. "New stamps this year" counts states, countries and parks first stamped in ' + c.year + ', so a younger kid can win it too.</p>';
    main.innerHTML = html;
    main.querySelectorAll("[data-cup]").forEach(function (b) { b.onclick = function () { cupAll = b.dataset.cup === "all"; viewCup(); }; });
  }
  function viewFamily() {
    document.title = "Family map · Famstamp";
    var people = famPeople(), n = people.length, together = famMode === "together" && n > 1;
    var fs = M.familyStats(people, state.trips, MAPS.world);
    function fillFor(who) {   // who = ids of chosen people who've been there
      if (!who || !who.length) return null;
      if (together) return who.length === n ? { cls: " on fam-all" } : null;
      if (who.length === 1) return { style: "fill:" + kidById(who[0]).color };
      return { cls: " on fam-" + Math.min(who.length, 4) };
    }
    function pathTag(kind, p, who, extraCls) {
      var f = fillFor(who), nm = esc(p.name) + (who && who.length ? ": " + esc(names(who).join(", ")) : "");
      return '<path class="a' + (extraCls || "") + (f ? (f.cls || " on") : "") + '"' + (f && f.style ? ' style="' + f.style + '"' : "") + ' data-fam="' + p.id + '" data-names="' + nm + '" d="' + p.d + '"><title>' + nm + '</title></path>';
    }
    var chips = state.kids.map(function (k) {
      return '<button type="button" class="chip" data-person="' + esc(k.id) + '" aria-pressed="' + (famSel.indexOf(k.id) >= 0) + '" style="' + kidStyle(k) + '"><i aria-hidden="true"></i>' + esc(k.name) + '</button>';
    }).join("");
    var map = "", line = "";
    if (famMap === "us") {
      var w = M.whoBeen(people, "state", MAPS.world), u = MAPS.us;
      map = '<div class="mapbox us"><svg viewBox="0 0 ' + u.w + ' ' + u.h + '" data-pz="us" role="img" aria-label="Family map of US states">' +
        u.insets.map(function (b) { return '<rect class="inset" x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="' + (b[2] + 8) + '" height="' + (b[3] + 8) + '" rx="8"/>'; }).join("") +
        u.shapes.map(function (p) { return pathTag("state", p, w[p.id]); }).join("") + '</svg></div>';
      line = together ? fs.togetherStates + " <small>of 50 states together</small>" : fs.states + " <small>of 50 states between " + (n === 1 ? "them" : "you") + "</small>";
    } else if (famMap === "world") {
      var wp = M.whoBeen(people, "place", MAPS.world), vb = [0, 0, MAPS.world.w, MAPS.world.h], pre = ZOOMS[worldZoom];
      people.forEach(function (p) { if (Object.keys(p.states).length && !(wp.USA || []).some(function (x) { return x === p.id; })) (wp.USA = wp.USA || []).push(p.id); });
      map = '<div class="seg" role="group" aria-label="Zoom">' + [["world", "Whole world"], ["na", "North America"], ["europe", "Europe"], ["uk", "UK & Ireland"]].map(function (z) {
          return '<button type="button" data-zoom="' + z[0] + '" aria-pressed="' + (worldZoom === z[0]) + '">' + z[1] + '</button>'; }).join("") + '</div>' +
        '<div class="mapbox"><svg viewBox="' + vb.join(" ") + '" data-pz="world"' + (pre ? ' data-pzinit="' + pre.join(" ") + '"' : "") + ' role="img" aria-label="Family world map"><path class="ocean" d="' + MAPS.world.outline + '"/><path class="grat" d="' + MAPS.world.grat + '"/>' +
        MAPS.world.shapes.map(function (p) { return pathTag("place", p, wp[p.id], (p.other ? " o" : "") + (p.uk ? " uk" : "")); }).join("") + '</svg></div>';
      line = together ? fs.togetherCountries + " <small>of 195 countries together</small>" : fs.countries + " <small>of 195 countries between " + (n === 1 ? "them" : "you") + "</small>";
    } else {
      var wk = M.whoBeen(people, "park", MAPS.world);
      var rows = M.PARKS.filter(function (p) { var who = wk[p.id]; return who && (!together || who.length === n); }).map(function (p) {
        return '<div class="row"><div class="nm"><b>' + esc(p.name) + '</b><span>' + esc(p.states) + '</span></div><span class="dots">' + wk[p.id].map(function (id) {
          var x = kidById(id); return '<span class="dotp" title="' + esc(M.who(x)) + '" style="' + kidStyle(x) + '">' + initial(x) + '</span>'; }).join("") + '</span></div>';
      }).join("");
      map = '<div class="panel parks">' + (rows || '<p class="muted">' + (together ? "No parks you've all been to yet. Time to plan one?" : "No national parks yet.") + '</p>') + '</div>';
      line = together ? fs.togetherParks + " <small>of 64 parks together</small>" : fs.parks + " <small>of 64 national parks between " + (n === 1 ? "them" : "you") + "</small>";
    }
    var legend = together ? '<p class="hint"><span class="key fam-all"></span> Places ' + esc(famTitle(people)) + (n === 2 ? ' have both been.' : ' have all been.') + '</p>'
      : '<p class="hint">One person: their color. <span class="key fam-2"></span> 2 people <span class="key fam-3"></span> 3 <span class="key fam-4"></span> 4 or more. Tap a place to see who\'s been.</p>';
    main.innerHTML = '<a class="back" href="#/">← Everyone</a><h1>Family map</h1>' +
      '<p class="lede small">Every place anyone in the family has been. Pick two people, like the two of you, to see the places you\'ve been together.</p>' +
      '<div class="chips" role="group" aria-label="Who\'s on the map">' + chips + '</div>' +
      '<div class="seg" role="group" aria-label="Show">' + [["any", "Anyone's been"], ["together", "Been together"]].map(function (m) {
        return '<button type="button" data-mode="' + m[0] + '" aria-pressed="' + (famMode === m[0]) + '"' + (m[0] === "together" && n < 2 ? " disabled" : "") + '>' + m[1] + '</button>'; }).join("") + '</div>' +
      '<div class="seg" role="group" aria-label="Map">' + [["us", "🇺🇸 USA"], ["world", "🌍 World"], ["parks", "🏞️ Parks"]].map(function (m) {
        return '<button type="button" data-fmap="' + m[0] + '" aria-pressed="' + (famMap === m[0]) + '">' + m[1] + '</button>'; }).join("") + '</div>' +
      '<div class="count"><div class="big">' + line + '</div></div>' + map + (famMap !== "parks" ? legend : "") +
      '<h2>' + (n > 1 ? "Together" : "Totals") + (n > 1 ? ' <span class="muted small">' + esc(n === state.kids.length ? "the whole family" : names(famSel).join(" & ")) + '</span>' : "") + '</h2><div class="stats">' +
      (n > 1 ? '<a class="stat person" href="#/together/fam" style="--kid:var(--sage-deep)"><div class="v">' + fs.togetherTrips + '</div><div class="k">Trips together · see them →</div></a>' + statBox(fs.togetherStates, 50, "States together") + statBox(fs.togetherCountries, 195, "Countries together") + statBox(fs.togetherParks, 64, "Parks together") : "") +
      statBox(fs.states, 50, "States, anyone") + statBox(fs.countries, 195, "Countries, anyone") + statBox(fs.parks, 64, "Parks, anyone") + statBox(fs.trips, 0, "Trips logged") + '</div>' +
      '<a class="panel familycard" href="#/year"><span class="fam-ic" aria-hidden="true">🎉</span><span><h3>Year in stamps</h3><span class="small">A card of the year to share →</span></span></a>' +
      cupCard() + (window.FS_WISH ? window.FS_WISH.card() : "") +
      '<a class="panel familycard" href="#/family/passport"><span class="fam-ic" aria-hidden="true">🛂</span><span><h3>Family passport</h3><span class="small">Every stamp, with who was there →</span></span></a>' +
      UI().lifetimeHTML(null) +
      '<h2>Everyone</h2><div class="stats">' + people.map(function (p) {
        var ps = M.stats(p, state.trips, MAPS.world);
        return '<a class="stat person" href="#/p/' + esc(p.id) + '" style="' + kidStyle(p) + '"><div class="v"><span class="dotp">' + initial(p) + '</span> ' + esc(M.who(p)) + '</div><div class="k">' + ps.states + ' states · ' + ps.countries + ' countries · ' + ps.parks + ' parks</div></a>';
      }).join("") + '</div>';
    main.querySelectorAll("[data-person]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.person, i = famSel.indexOf(id);
      if (i >= 0) { if (famSel.length > 1) famSel.splice(i, 1); else return toast("Keep at least one person on the map"); } else famSel.push(id);
      if (famSel.length < 2) famMode = "any"; viewFamily(); }; });
    main.querySelectorAll("[data-mode]").forEach(function (b) { b.onclick = function () { famMode = b.dataset.mode; viewFamily(); }; });
    main.querySelectorAll("[data-fmap]").forEach(function (b) { b.onclick = function () { famMap = b.dataset.fmap; viewFamily(); }; });
    bindZoomButtons();
    UI().bindLifetime(viewFamily);
    main.querySelectorAll("[data-fam]").forEach(function (el) { el.addEventListener("click", function () { toast(el.dataset.names.indexOf(":") > 0 ? el.dataset.names : el.dataset.names + ": not yet"); }); });
  }

  // ---------- trips together ----------
  var togSel = null;
  function viewTogether(startId) {
    document.title = "Trips together · Famstamp";
    if (startId === "fam" && famSel && famSel.length >= 2) { togSel = famSel.slice(); history.replaceState(null, "", "#/together"); }
    else if (startId === "top") { togSel = null; history.replaceState(null, "", "#/together"); }
    else if (startId && kidById(startId)) {   // coming from someone's Trips tab: start with them and the person they travel with most
      var best = M.pairCounts(state.kids, state.trips).filter(function (p) { return p.ids.indexOf(startId) >= 0; })[0];
      togSel = best ? best.ids.slice() : [startId].concat(state.kids.filter(function (x) { return x.id !== startId; }).slice(0, 1).map(function (x) { return x.id; }));
      history.replaceState(null, "", "#/together");
    }
    if (togSel) togSel = togSel.filter(function (id) { return kidById(id); });
    if (!togSel || togSel.length < 2) {
      var top = M.pairCounts(state.kids, state.trips)[0];
      togSel = top ? top.ids.slice() : (famSel && famSel.length >= 2 ? famSel.slice() : state.kids.slice(0, 2).map(function (x) { return x.id; }));
    }
    var chosen = state.kids.filter(function (x) { return togSel.indexOf(x.id) >= 0; }).map(function (x) { return x.id; });
    var list = M.tripsTogether(state.trips, chosen), pairs = M.pairCounts(state.kids, state.trips);
    var chips = state.kids.map(function (x) {
      return '<button type="button" class="chip" data-tp="' + esc(x.id) + '" aria-pressed="' + (chosen.indexOf(x.id) >= 0) + '" style="' + kidStyle(x) + '"><i aria-hidden="true"></i>' + esc(x.name) + '</button>';
    }).join("");
    var head = chosen.length < 2 ? "Pick two or more people" : esc(travelerNames(chosen)) + ': <span class="big-n">' + list.length + '</span> ' + (list.length === 1 ? "trip" : "trips") + " together";
    main.innerHTML = '<a class="back" href="#/">← Everyone</a><h1>Trips together</h1>' +
      '<p class="lede small">Pick two or more people to see every trip they went on together.</p>' +
      '<div class="chips" role="group" aria-label="Who">' + chips + '</div>' +
      '<div class="count together-head"><div class="big">' + head + '</div><span class="dots">' + avatars(chosen) + '</span></div>' +
      (chosen.length < 2 ? "" : list.length ? '<div class="trips">' + list.map(function (t) { return tripCard(t, null); }).join("") + '</div>'
        : '<div class="panel"><p class="muted">No trips together yet. When you add a trip, check everyone who went under "Who went?".</p></div>') +
      (pairs.length ? '<h2>Who travels together most</h2><div class="panel pairs">' + pairs.slice(0, 10).map(function (p) {
        return '<button type="button" class="row pairrow" data-pair="' + esc(p.ids.join(",")) + '"><span class="dots">' + avatars(p.ids) + '</span><span class="nm"><b>' + esc(travelerNames(p.ids)) + '</b></span><span class="meta">' + p.count + (p.count === 1 ? " trip" : " trips") + '</span></button>';
      }).join("") + '</div>' : "") +
      '<div class="actions"><a class="btn btn-ghost" href="#/family">🗺️ See the places you\'ve been together</a></div>';
    fillPhotos();
    main.querySelectorAll("[data-tp]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.tp, i = togSel.indexOf(id);
      if (i >= 0) togSel.splice(i, 1); else togSel.push(id);
      if (togSel.length < 2) { toast("Pick at least two people"); if (i >= 0) { togSel.splice(i, 0, id); return; } }
      viewTogether(); }; });
    main.querySelectorAll("[data-pair]").forEach(function (b) { b.onclick = function () { togSel = b.dataset.pair.split(","); famSel = togSel.slice(); famMode = "together"; viewTogether(); window.scrollTo(0, 0); }; });
  }

  // ---------- print ----------
  function viewPrint(k) {
    var s = M.stats(k, state.trips, MAPS.world), list = kidTrips(k);
    var parks = M.ALL_PARKS.filter(function (p) { return k.parks[p.id]; });
    var places = Object.keys(k.places).map(function (id) { return placeName("place", id); }).sort();
    document.title = k.name + "'s travel map · Famstamp";
    main.innerHTML = '<div class="sheet" style="' + kidStyle(k) + '"><a class="back" href="#/p/' + esc(k.id) + '/stats">← Back</a>' +
      '<div class="actions noprint"><button class="btn btn-primary" id="doprint">🖨 Print or save as PDF</button></div>' +
      '<p class="hint noprint">Tip: choose "Landscape" and turn on "Background graphics" so the colors print.</p>' +
      '<section class="page"><h1>' + esc(M.who(k)) + '\'s United States</h1><p class="statline">' + s.states + ' of 50 states · ' + s.parks + ' of 64 national parks · ' + s.trips + ' trips</p>' +
      '<div class="mapbox us">' + usSVG(k) + '</div></section>' +
      '<section class="page"><h1>' + esc(M.who(k)) + '\'s world</h1><p class="statline">' + s.countries + ' of 195 countries · ' + s.continents + ' continents · UK nations ' + s.ukNations + ' of 4</p>' +
      '<div class="mapbox">' + worldSVG(k, "world") + '</div></section>' +
      '<section class="page"><h1>Where ' + esc(M.who(k)) + ' has been</h1><div class="cols">' +
      '<div><h2>States</h2><p>' + (Object.keys(k.states).sort().map(function (x) { return esc(STATE_NAME[x]); }).join(", ") || "Not yet!") + '</p>' +
      '<h2>Countries and places</h2><p>' + (places.map(esc).join(", ") || "Not yet!") + '</p></div>' +
      '<div><h2>Parks, monuments & memorials</h2>' + (parks.length ? '<ul>' + parks.map(function (p) { return '<li>' + esc(p.full) + (k.parks[p.id].jr ? " ★ Junior Ranger" : "") + '</li>'; }).join("") + '</ul>' : "<p>Not yet!</p>") + '</div></div>' +
      (list.length ? '<h2>Trips</h2><ul>' + list.map(function (t) {
        var r = M.routeText(t), others = t.kidIds.filter(function (x) { return x !== k.id; });
        return '<li><b>' + esc(t.place) + '</b>' + (t.date ? ", " + esc(M.prettyDate(t.date)) : "") + (r !== t.place ? " (" + esc(r) + ")" : "") +
          (others.length ? ". With " + esc(travelerNames(others)) : "") + (t.who ? (others.length ? ", plus " : ". With ") + esc(t.who) : "") + (t.memory ? ": " + esc(t.memory) : "") + '</li>'; }).join("") + '</ul>' : "") +
      '<p class="small muted" style="margin-top:1rem">Famstamp · Map data: Natural Earth (public domain). Alaska and Hawaii are not to scale.</p></section>' + UI().printExtra(k) + '</div>';
    document.getElementById("doprint").onclick = function () { window.print(); };
  }

  // ---------- Recently deleted ----------
  function binRow(t) {
    var who = travelerNames(t.kidIds.filter(function (id) { return kidById(id); })), left = M.binDaysLeft(t);
    return '<div class="binrow"><div class="nm"><b>' + esc(M.tripLabel(t)) + '</b><span class="small muted">' + esc([t.date ? M.prettyDate(t.date) : "", who].filter(Boolean).join(" · ")) + '</span>' +
      '<span class="small muted">Deleted ' + esc(M.prettyDate(t.deletedAt.slice(0, 10))) + ' · gone for good in ' + left + (left === 1 ? " day" : " days") + '</span></div>' +
      '<button type="button" class="btn btn-primary" data-unbin="' + esc(t.id) + '">Restore</button></div>';
  }
  function viewDeleted() {
    main.innerHTML = '<a class="back" href="#/">← Home</a><h1>Recently deleted</h1>' +
      '<p class="lede small">Deleted trips wait here for ' + M.BIN_DAYS + ' days, then they\'re gone for good. Restore one and it comes back for everyone in the family.</p>' +
      (state.bin.length ? '<div class="panel binlist">' + state.bin.map(binRow).join("") + '</div>' : '<div class="panel"><p class="muted">Nothing here. Trips you delete wait here for ' + M.BIN_DAYS + ' days.</p></div>') +
      '<p class="small muted">Deleted before this was added? Restore it from a backup file on <a href="#/backup">Back up and restore</a>.</p>';
    Array.prototype.forEach.call(main.querySelectorAll("[data-unbin]"), function (b) {
      b.onclick = function () {
        b.disabled = true;
        restoreTrip(b.dataset.unbin).then(function (t) { if (!t) return; toast(M.tripLabel(t) + " is back"); location.hash = "#/p/" + t.kidIds.filter(function (id) { return kidById(id); })[0] + "/trip/" + t.id; })
          .catch(function (x) { b.disabled = false; toast(x.message); });
      };
    });
  }
  /** Restore one trip from a backup file: people on this phone are left alone, the trip gets today's time so it syncs. */
  function bindOneTrip() {
    var inp = document.getElementById("b1file"), box = document.getElementById("b1list"), err = document.getElementById("b1err");
    inp.onchange = function (e) {
      var f = e.target.files[0]; err.hidden = true; box.innerHTML = ""; if (!f) return;
      f.text().then(function (txt) {
        var data; try { data = M.readBackup(JSON.parse(txt)); } catch (x) { throw new Error(x instanceof SyntaxError ? "That file isn't a backup (it couldn't be read)." : x.message); }
        var have = {}; state.trips.forEach(function (t) { have[t.id] = 1; });
        var list = data.trips.filter(function (t) { return t.kidIds.some(function (id) { return kidById(id); }); }).sort(function (a, b) { return (a.date || "") < (b.date || "") ? 1 : -1; });
        if (!list.length) throw new Error("None of the trips in that file belong to people in this log.");
        box.innerHTML = '<p class="small muted">' + list.length + (list.length === 1 ? " trip" : " trips") + ' in this file. Trips you still have are marked.</p>' + list.map(function (t) {
          return '<div class="binrow"><div class="nm"><b>' + esc(M.tripLabel(t)) + '</b><span class="small muted">' + esc([t.date ? M.prettyDate(t.date) : "", t.place && t.title ? t.place : ""].filter(Boolean).join(" · ")) + '</span></div>' +
            (have[t.id] ? '<span class="small muted">Already here</span>' : '<button type="button" class="btn btn-primary" data-one="' + esc(t.id) + '">Restore</button>') + '</div>'; }).join("");
        Array.prototype.forEach.call(box.querySelectorAll("[data-one]"), function (b) {
          b.onclick = function () {
            var r; try { r = M.tripFromBackup(data, b.dataset.one, state.kids.map(function (k) { return k.id; })); } catch (x) { err.textContent = x.message; err.hidden = false; return; }
            if (!confirm("Bring back " + M.tripLabel(r.trip) + "? No one's map or passport is changed.")) return;
            b.disabled = true;
            tx(["trips", "photos"], "readwrite", function (s) { s[0].put(r.trip); if (r.photo) s[1].put(r.photo); })
              .then(function () { changed("trips"); return load(); })
              .then(function () { photoCache = {}; toast(M.tripLabel(r.trip) + " is back"); b.outerHTML = '<span class="small muted">Restored</span>'; });
          };
        });
      }).catch(function (x) { err.textContent = x.message; err.hidden = false; });
    };
  }

  // ---------- backup / restore ----------
  /** v71 (B9): restore a read backup (a file, or one of the automatic copies on this phone) after a preview of exactly
      what comes back, what gets replaced and what stays. Nothing on the phone is deleted by a restore. */
  function restoreBackup(data) {
    var ask = window.FS_ROBUST && window.FS_ROBUST.askRestore ? window.FS_ROBUST.askRestore(data) :
      Promise.resolve(confirm("Restore " + data.kids.length + (data.kids.length === 1 ? " person, " : " people, ") + data.trips.length + " trip(s) and " + data.photos.length + " photo(s) from this backup?"));
    return ask.then(function (ok) {
      if (!ok) return null;
      // v49: someone or something already on this phone keeps every field it has; only the fields in the file overwrite
      return tx(["kids", "trips", "photos"], "readwrite", function (s) {
        [["kids", 0], ["trips", 1], ["photos", 2]].forEach(function (x) {
          var keys = (data.present && data.present[x[0]]) || {};
          data[x[0]].forEach(function (rec) { var g = s[x[1]].get(rec.id); g.onsuccess = function () { s[x[1]].put(M.mergeRestore(g.result, rec, keys[rec.id])); }; });
        });
      }).then(function () { return data.settings.home && !state.meta.home ? setMeta("home", data.settings.home) : null; })
        .then(function () { return data.settings.homePoint && !state.meta.homePoint ? setMeta("homePoint", data.settings.homePoint) : null; })
        .then(function () { return data.settings.units && !state.meta.units ? setMeta("units", data.settings.units) : null; })
        .then(load).then(function () { photoCache = {}; toast("Restored!"); location.hash = "#/"; return true; });
    });
  }
  function viewBackup() {
    var last = state.meta.lastBackupAt;
    main.innerHTML = '<a class="back" href="#/">← Home</a><h1>Back up and restore</h1>' +
      '<p class="lede">' + esc((window.MLTL_SYNC && window.MLTL_SYNC.storageNote()) || "Your maps live only on this device. A backup file keeps them safe if the phone is lost, replaced or cleared.") + '</p>' +
      '<div class="panel"><h3>Back up</h3><p class="muted small">Saves one file with everyone\'s maps, trips and photos. Email it to yourself or save it to your cloud drive.</p>' +
      '<p class="small" id="lastbk">' + (last ? "Last backup file: " + esc(M.prettyDate(last.slice(0, 10))) : "No backup file yet.") + '</p>' +
      '<div class="actions"><button class="btn btn-primary" id="bdown">Save a backup file</button></div></div>' +
      (window.MLTL_IMPORT ? window.MLTL_IMPORT.backupCard() : "") +
      '<div class="panel" id="binpanel"><h3>Recently deleted</h3><p class="muted small">Deleted trips wait ' + M.BIN_DAYS + ' days before they\'re gone for good.</p><div class="actions"><a class="btn btn-ghost" href="#/deleted">🗑 Recently deleted (' + state.bin.length + ')</a></div></div>' +
      '<div class="panel" id="onetrip"><h3>Restore one trip</h3><p class="muted small">Pick a backup file, then tap Restore next to the trip you want back. Only that trip comes back; everyone\'s maps and passports stay as they are. It syncs to the family like a new edit.</p>' +
      '<div class="field"><label for="b1file">Backup file (.json)</label><input id="b1file" type="file" accept="application/json,.json"></div><p class="err" id="b1err" hidden></p><div id="b1list" class="binlist"></div></div>' +
      '<div class="panel"><h3>Restore everything</h3><p class="muted small">Pick a backup file. Kids and trips in the file are added back; anything with the same name in both places is replaced by the file\'s copy.</p>' +
      '<div class="field"><label for="bfile">Backup file (.json)</label><input id="bfile" type="file" accept="application/json,.json"></div><p class="err" id="berr" hidden></p></div>' +
      (window.FS_PUSH ? window.FS_PUSH.panel() : "") +
      (window.MLTL_SYNC && window.MLTL_SYNC.settingsPanel ? window.MLTL_SYNC.settingsPanel() : "") +
      '<div class="panel"><h3>Start over</h3><p class="muted small">Deletes everyone\'s maps, trips and photos from this device. Make a backup first if you might want them later.</p>' +
      '<div class="actions"><button class="btn btn-danger" id="bwipe">Delete everything on this device</button></div></div>' +
      '<div class="panel"><h3>Help, privacy and your data</h3><p class="muted small">Text size, a copy of everything as a zip, help and feedback, and deleting your account and data.</p><div class="actions"><a class="btn btn-ghost" href="#/help">💬 Help &amp; settings</a><button type="button" class="btn btn-ghost" data-export-zip>📦 Export everything (.zip)</button></div></div>' +
      '<p class="small muted appver" id="appver">' + esc((window.FS_BRAND && window.FS_BRAND.NAME) || "Famstamp") + ' · Version ' + esc(VERSION) + '</p>';
    bindOneTrip();
    if (window.FS_PUSH) window.FS_PUSH.bind();
    document.getElementById("bdown").onclick = function () { doBackup().then(function () { toast("Backup saved"); viewBackup(); }); };
    document.getElementById("bfile").onchange = function (e) {
      var f = e.target.files[0], err = document.getElementById("berr"); err.hidden = true; if (!f) return;
      if (f.size > 200e6) { err.textContent = "That file is too big to be a backup."; err.hidden = false; return; }
      f.text().then(function (txt) {
        var data; try { data = M.readBackup(JSON.parse(txt)); } catch (x) { throw new Error(x instanceof SyntaxError ? "That file isn't a backup (it couldn't be read)." : x.message); }
        return restoreBackup(data);
      }).catch(function (x) { err.textContent = x.message; err.hidden = false; });
    };
    document.getElementById("bwipe").onclick = function () {
      var synced = window.MLTL_SYNC && window.MLTL_SYNC.isOn();
      if (!confirm("Delete everyone's maps, trips and photos on this device? This can't be undone." + (synced ? " This phone also stops syncing; the family's shared copy stays in the family log." : ""))) return;
      tx(["kids", "trips", "photos", "meta"], "readwrite", function (s) { s.forEach(function (st) { st.clear(); }); })

        .then(load).then(function () { photoCache = {}; toast("All cleared"); location.hash = "#/"; });
    };
  }

  // ---------- boot ----------
  document.addEventListener("click", function (e) {
    var qs = e.target.closest && e.target.closest("[data-quickstamp]");
    if (qs) { var q = qs.dataset.quickstamp.split("|"); window.FS_FOCUS_STOP = true; location.hash = "#/p/" + q[0] + "/trips/edit/" + q[1]; return; }
    var rb = e.target.closest && e.target.closest("[data-review]");
    if (rb) { e.preventDefault(); rb.disabled = true; reviewDraft(rb.dataset.review); return; }
    var a = e.target.closest && e.target.closest("a[data-book]");
    if (a && !BOOK_URL) { e.preventDefault(); toast("The paperback is on its way to Amazon. Check back soon!"); }
  });
  // What sync.js needs from the app. Nothing here talks to the network.
  var readyRes; var ready = new Promise(function (r) { readyRes = r; });
  window.MLTL_APP = { version: VERSION, state: state, load: load, route: route, tx: tx, all: all, put: put, del: del, getOne: getOne, toast: toast, doBackupData: function () { return all("photos").then(function (photos) { return M.makeBackup(state.kids, state.trips.concat(state.bin), photos, null, { home: state.meta.home || "", homePoint: state.meta.homePoint, units: state.meta.units }); }); }, setMeta: setMeta,
                      kidById: kidById, myPersonId: myPersonId, doBackup: doBackup, restoreBackup: restoreBackup, readBackup: function (o) { return M.readBackup(o); }, setMeta: setMeta, fillPhotos: fillPhotos, clearPhotos: function () { photoCache = {}; }, ready: ready,
                      dbName: DB_NAME, txIn: txIn, deleteDb: deleteDb,
                      // for trips-ui.js
                      main: main, badgeStrip: badgeStrip, bindBadgeStrip: bindBadgeStrip, shell: shell, placeName: placeName, saveKid: saveKid, kidStyle: kidStyle, initial: initial, avatars: avatars, travelerNames: travelerNames,
                      trashTrip: trashTrip, restoreTrip: restoreTrip, photoURL: photoURL, shrinkPhoto: shrinkPhoto, usSVG: usSVG, worldSVG: worldSVG, markOptions: markOptions, parkStamp: parkStamp };
  load().then(function () { readyRes(); route(); }).catch(function () {
    main.innerHTML = '<div class="panel"><h3>Storage isn\'t available</h3><p class="muted">This browser is blocking on-device storage (private browsing can do this). Try a normal window so your maps can be saved.</p></div>';
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  // Updates: a new version installs in the background (cache first), then takes over. When that happens as the app is opened
  // or brought back to the front, reload once by ourselves (unless something is mid-edit) so phones get fixes on the next
  // open; otherwise, and as a fallback, show the "Update available" toast.
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
    var had = !!navigator.serviceWorker.controller, fresh = Date.now(), pending = false;
    function kick() { if (reg.waiting) reg.waiting.postMessage("skipWaiting"); }
    function apply() {
      if (!pending) return;
      if (document.visibilityState === "visible" && Date.now() - fresh < 20000 && !editing() && autoReload()) return;
      if (document.visibilityState === "visible") updateToast();
    }
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (had) { pending = true; apply(); } had = true; });
    reg.addEventListener("updatefound", function () { var w = reg.installing; if (w) w.addEventListener("statechange", function () { if (w.state === "installed") kick(); }); });
    kick();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      fresh = Date.now(); apply(); reg.update().then(kick).catch(function () {});
    });
    setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
  }).catch(function () {});
  /** Something typed but not saved (or a field in use)? Then don't reload under the user's fingers. */
  function editing() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "button" && a.type !== "file") return true;
    return Array.prototype.some.call(document.querySelectorAll("#main input, #main textarea"), function (el) {
      if (el.type === "checkbox" || el.type === "radio") return el.checked !== el.defaultChecked;
      return el.type !== "file" && el.type !== "button" && el.type !== "hidden" && el.value !== el.defaultValue;
    });
  }
  /** Reload at most once a minute for an update (never a loop if something keeps changing the worker). */
  function autoReload() {
    try { var last = +sessionStorage.getItem("mltl-autoreload") || 0; if (Date.now() - last < 60000) return false; sessionStorage.setItem("mltl-autoreload", String(Date.now())); } catch (e) { return false; }
    location.reload(); return true;
  }
  function updateToast() {
    if (document.getElementById("updtoast")) return;
    var b = document.createElement("button"); b.type = "button"; b.id = "updtoast"; b.className = "updtoast"; b.textContent = "Update available, tap to refresh";
    b.onclick = function () { location.reload(); }; document.body.appendChild(b);
  }
})();
