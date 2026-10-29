/* v70+: keeping the log safe. Asks the browser to keep this app's storage (navigator.storage.persist), keeps a small
   privacy-safe error log on this phone, and a "Report a problem" page that opens an email to support with the app
   version and that log. Nothing is sent automatically. More safety pieces land here in later versions. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_ROBUST = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MAX_LOG = 15;
  /** Strip anything personal from an error line: emails, links, long numbers, ids, and anything in quotes (place names, notes). */
  function clean(s) {
    return String(s == null ? "" : s)
      .replace(/[^\s@()<>"']+@[^\s@()<>"']+\.[A-Za-z]{2,}/g, "<email>")
      .replace(/(https?:\/\/[^\s/)]+)?(\/[^\s:)?#]*\/)?([A-Za-z0-9_.-]+\.js)(\?[^\s:)]*)?/g, "$3")
      .replace(/https?:\/\/\S+/g, "<url>").replace(/(["'“‘`])[^"'”’`]{0,200}\1/g, "<text>")
      .replace(/\b(person|trip|photo|fam)_[A-Za-z0-9]+/g, "$1_<id>").replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>").replace(/\d{5,}/g, "<n>")
      .replace(/\s+/g, " ").trim().slice(0, 180);
  }
  /** Add one entry to the log (newest last, at most MAX_LOG, repeats counted instead of added). */
  function addLog(log, msg, at) {
    log = Array.isArray(log) ? log.slice() : []; msg = clean(msg); if (!msg) return log;
    var last = log[log.length - 1]; if (last && last.m === msg) { last.n = (last.n || 1) + 1; last.at = at; return log; }
    log.push({ m: msg, at: at, n: 1 }); return log.slice(-MAX_LOG);
  }
  /** The email to support: subject + body with version, device kind and the log. */
  function reportMail(o) {
    var to = o.to || "support@darklighthousesolutions.com";
    var body = "What happened:\n" + (o.what || "(please describe)") + "\n\n---\nApp version: " + (o.version || "?") + "\nDevice: " + (o.platform || "?") + "\nScreen: " + (o.route || "?") +
      "\nRecent errors on this phone (no trip names, notes, photos or emails):\n" + ((o.log || []).map(function (e) { return "- " + String(e.at || "").slice(0, 16) + " " + e.m + (e.n > 1 ? " (x" + e.n + ")" : ""); }).join("\n") || "- none");
    return "mailto:" + to + "?subject=" + encodeURIComponent("Famstamp problem report " + (o.version || "")) + "&body=" + encodeURIComponent(body);
  }
  // ---------- v71 pure pieces (tested in scripts/test_travel_log.js) ----------
  function day(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; }
  function norm(s) { return String(s || "").toLowerCase().normalize ? String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() : String(s || "").toLowerCase().trim(); }
  function stopNames(t) { var r = Array.isArray(t.route) ? t.route : [], out = {}; r.forEach(function (p, i) { if (p && p.name && (i > 0 || r.length === 1)) out[norm(p.name)] = 1; }); return out; }
  /** B10: an existing trip that looks like the same one: shares a traveler, starts within a day, and goes to the same place. */
  function dupMatch(trip, trips) {
    if (!trip) return null;
    var d0 = day(trip.date), mine = stopNames(trip), place = norm(trip.place), ids = trip.kidIds || [];
    if (d0 == null) return null;
    return (trips || []).filter(function (t) {
      if (!t || t.id === trip.id || t.deletedAt) return false;
      var d1 = day(t.date); if (d1 == null || Math.abs(d1 - d0) > 1) return false;
      if (!(t.kidIds || []).some(function (id) { return ids.indexOf(id) >= 0; })) return false;
      if (place && norm(t.place) === place) return true;
      var theirs = stopNames(t); return Object.keys(mine).some(function (k) { return k && theirs[k]; });
    })[0] || null;
  }
  function cp(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function addUnique(a, b) { var out = cp(a || []), seen = out.map(function (x) { return JSON.stringify(x); }); (b || []).forEach(function (x) { var k = JSON.stringify(x); if (seen.indexOf(k) < 0) { out.push(cp(x)); seen.push(k); } }); return out; }
  /** B10: fold a new copy into the trip that's already here. Nothing already there is lost; new people, stops, notes and photos join. */
  function mergeDup(have, add, now) {
    var t = cp(have);
    t.kidIds = (have.kidIds || []).concat((add.kidIds || []).filter(function (id) { return (have.kidIds || []).indexOf(id) < 0; }));
    var names = (t.route || []).map(function (p) { return norm(p && p.name); });
    t.route = (t.route || []).concat((add.route || []).filter(function (p, i) { return p && i > 0 && names.indexOf(norm(p.name)) < 0; }).map(cp));
    if (add.endDate && (!t.endDate || add.endDate > t.endDate)) t.endDate = add.endDate;
    if (add.date && t.date && add.date < t.date) t.date = add.date;
    ["title", "who", "fly", "back", "story", "wx", "mark"].forEach(function (k) { if (!t[k] && add[k]) t[k] = cp(add[k]); });
    if (add.memory && norm(add.memory) !== norm(t.memory)) t.memory = t.memory ? t.memory + "\n" + add.memory : add.memory;
    if (add.photoId) t.photoId = add.photoId;
    t.stays = addUnique(t.stays, add.stays); t.favs = addUnique(t.favs, add.favs);
    ["moments", "memories"].forEach(function (k) { var o = t[k] && typeof t[k] === "object" ? t[k] : {}; Object.keys(add[k] || {}).forEach(function (x) { if (!o[x]) o[x] = cp(add[k][x]); }); t[k] = o; });
    t.done = !!(have.done || add.done); t.updatedAt = now || new Date().toISOString();
    return t;
  }
  function who(k) { return k ? String(k.nickname || k.name || "Someone") : "Someone"; }
  function tlabel(t) { var y = /^\d{4}/.exec(t.date || ""); return String(t.title || t.place || "A trip") + (y ? " (" + y[0] + ")" : ""); }
  /** B9: what a restore would do, before it does it. Restoring never deletes anything on the phone. */
  function restorePreview(data, kids, trips, photoIds) {
    var hk = {}, ht = {}, inK = {}, inT = {}; (kids || []).forEach(function (k) { hk[k.id] = k; }); (trips || []).forEach(function (t) { ht[t.id] = t; });
    var o = { at: data.exportedAt || "", addPeople: [], updPeople: [], addTrips: [], updTrips: [], keepTrips: [], newPhotos: 0, stayPeople: 0, stayTrips: 0 };
    (data.kids || []).forEach(function (k) { inK[k.id] = 1; (hk[k.id] ? o.updPeople : o.addPeople).push(who(k)); });
    (data.trips || []).forEach(function (t) {
      inT[t.id] = 1; var e = ht[t.id];
      if (!e) o.addTrips.push(tlabel(t)); else if (e.updatedAt && t.updatedAt && String(e.updatedAt) > String(t.updatedAt)) o.keepTrips.push(tlabel(e)); else o.updTrips.push(tlabel(t));
    });
    o.newPhotos = (data.photos || []).filter(function (p) { return (photoIds || []).indexOf(p.id) < 0; }).length;
    o.stayPeople = (kids || []).filter(function (k) { return !inK[k.id]; }).length; o.stayTrips = (trips || []).filter(function (t) { return !inT[t.id]; }).length;
    return o;
  }
  var HOUR = 36e5, STUCK_AFTER = 6 * HOUR;
  /** B3: "Sync stuck since …" when changes have waited (or sync has failed) for 6+ hours. */
  function stuckInfo(h, now) {
    if (!h || !h.on) return null;
    now = now || Date.now(); var last = Date.parse(h.lastSync || "") || 0;
    var waiting = h.pending > 0 || h.status === "error";
    if (!waiting || h.status === "syncing" || h.status === "offline" && !(h.pending > 0)) return null;
    if (last && now - last < STUCK_AFTER) return null;
    return { since: h.lastSync || "", pending: h.pending || 0, error: h.status === "error" ? (h.msg || "") : "" };
  }
  function failedList(h) { var f = (h && h.failed) || {}; return Object.keys(f).map(function (id) { return { id: id, trip: f[id].trip, n: f[id].n || 1, why: f[id].why || "upload failed", since: f[id].since || "" }; }); }
  var WEEK = 7 * 864e5;
  /** B5: an automatic copy is due when none was made in the last 7 days. */
  function autoDue(lastAt, now) { var l = Date.parse(lastAt || "") || 0; return !l || (now || Date.now()) - l >= WEEK; }
  /** B2: worth keeping as a draft: something beyond the starting point was entered. */
  function draftUseful(x, homeKnown) {
    if (!x) return false;
    return (x.route || []).length > (homeKnown ? 1 : 0) || !!(String(x.title || "").trim() || String(x.memory || "").trim() || String(x.who || "").trim()) || (x.stays || []).length > 0 || (x.favs || []).length > 0;
  }
  function draftFresh(dr, now) { return !!(dr && dr.d && dr.at && (now || Date.now()) - Date.parse(dr.at) < 30 * 864e5); }
  var core = { clean: clean, addLog: addLog, reportMail: reportMail, MAX_LOG: MAX_LOG,
               dupMatch: dupMatch, mergeDup: mergeDup, restorePreview: restorePreview, stuckInfo: stuckInfo, failedList: failedList, autoDue: autoDue, draftUseful: draftUseful, draftFresh: draftFresh, STUCK_AFTER: STUCK_AFTER };
  if (typeof document === "undefined") return core;

  function A() { return window.MLTL_APP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var KEY = "fs-errlog";
  function readLog() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function log(msg) { try { localStorage.setItem(KEY, JSON.stringify(addLog(readLog(), msg, new Date().toISOString()))); } catch (e) {} }
  window.addEventListener("error", function (e) { if (e && e.filename && !/\/travel-log\/app\//.test(e.filename)) return; log((e && e.message) || "error"); });
  window.addEventListener("unhandledrejection", function (e) { var r = e && e.reason; if (r && (r.name === "AbortError" || /Failed to fetch|NetworkError|Load failed/.test(r.message || ""))) return; log((r && (r.message || r.name)) || String(r)); });

  // B1: ask the browser not to clear this app's storage when the phone runs low
  function persist() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
    return navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).then(function (ok) { try { localStorage.setItem("fs-persist", ok ? "1" : "0"); } catch (e) {} return ok; }).catch(function () { return null; });
  }

  function platformOf() { return window.FS_LAUNCH && window.FS_LAUNCH.platform ? window.FS_LAUNCH.platform(navigator.userAgent) : "?"; }
  function viewReport() {
    var a = A(), v = a.version, l = readLog(), sup = (window.FS_BRAND && window.FS_BRAND.CONTACT && window.FS_BRAND.CONTACT.support) || "support@darklighthousesolutions.com";
    a.main.innerHTML = '<a class="back" href="#/more">← More</a><h1>Report a problem</h1><p class="lede small">Tell us what went wrong. Your email app opens with a note to <b>' + esc(sup) + '</b>; nothing is sent until you press Send there.</p>' +
      '<div class="panel"><div class="field" style="margin-top:0"><label for="rpwhat">What happened?</label><textarea id="rpwhat" rows="4" maxlength="1500" placeholder="e.g. I tapped Save on a trip and it spun forever"></textarea></div>' +
      '<p class="small">Added to the email: app version <b>' + esc(v) + '</b>, <b>' + esc(platformOf()) + '</b>, and ' + (l.length ? '<b>' + l.length + '</b> recent error ' + (l.length === 1 ? "line" : "lines") : "no error lines") + ' from this phone. No trip names, notes, photos or email addresses are included.</p>' +
      (l.length ? '<details><summary>See exactly what\'s included</summary><pre class="errlog">' + esc(l.map(function (e) { return String(e.at).slice(0, 16) + " " + e.m + (e.n > 1 ? " (x" + e.n + ")" : ""); }).join("\n")) + '</pre></details>' : "") +
      '<div class="actions"><a class="btn btn-primary" id="rpsend" href="#">Open my email app</a>' + (l.length ? '<button type="button" class="btn btn-ghost" id="rpclear">Clear the error lines</button>' : "") + '</div></div>';
    document.title = "Report a problem · Famstamp";
    var s = document.getElementById("rpsend");
    s.onclick = function () { s.href = reportMail({ to: sup, what: document.getElementById("rpwhat").value.trim(), version: v, platform: platformOf(), route: (window.FS_LAUNCH && window.FS_LAUNCH.routeKey ? window.FS_LAUNCH.routeKey(sessionStorage.getItem("fs-last-route") || "") : ""), log: readLog() }); };
    var c = document.getElementById("rpclear"); if (c) c.onclick = function () { localStorage.removeItem(KEY); viewReport(); };
  }
  window.addEventListener("hashchange", function (e) { try { if (!/#\/report/.test(location.hash)) sessionStorage.setItem("fs-last-route", location.hash); else if (e && e.oldURL) sessionStorage.setItem("fs-last-route", e.oldURL.split("#")[1] ? "#" + e.oldURL.split("#")[1] : ""); } catch (x) {} });
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "report") return false; viewReport(); return true; });

  // ---------- v71 on the phone ----------
  function M() { return window.MLTL; }
  function UI() { return window.FS_UI; }
  function dbKey() { var a = A(); return (a && a.dbName) || "famstamp"; }
  // v94: the date and time formats are made once (making them on every call was slow on long lists)
  var FMT_D = null, FMT_T = null;
  function when(isoS) {
    if (!isoS) return ""; var d = new Date(isoS); if (isNaN(d)) return "";
    if (!FMT_D && typeof Intl !== "undefined") { FMT_D = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }); FMT_T = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }); }
    return FMT_D ? FMT_D.format(d) + ", " + FMT_T.format(d) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function dayOnly(isoS) { return isoS && M() ? M().prettyDate(String(isoS).slice(0, 10)) : ""; }
  function sheetAsk(html, answers) {
    return new Promise(function (res) {
      var el = UI().sheet(html), done = false;
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ans]"); if (b) { done = true; UI().closeSheet(); res(answers[b.dataset.ans]); return; }
        if (!done && (e.target === el || e.target.closest("[data-close]"))) { done = true; res(null); }
      });
      var mo = new MutationObserver(function () { if (!document.body.contains(el)) { mo.disconnect(); if (!done) { done = true; res(null); } } }); mo.observe(document.body, { childList: true });
    });
  }
  function head(t) { return '<div class="sheethead"><h3>' + t + '</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>'; }
  function few(list) { return list.slice(0, 4).map(esc).join(", ") + (list.length > 4 ? " and " + (list.length - 4) + " more" : ""); }

  // B10: same trip twice?
  function askDup(have, add) {
    var names = (have.kidIds || []).map(function (id) { return who(A().kidById(id)); }).join(", ");
    return sheetAsk(head("Is this the same trip?") +
      '<p>You already have <b>' + esc(M().tripLabel ? M().tripLabel(have) : tlabel(have)) + '</b> on ' + esc(dayOnly(have.date)) + (names ? ' with ' + esc(names) : "") + '.</p>' +
      '<p class="small muted">Add to that trip keeps everything already there and adds the new people, stops, notes and photo.</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-ans="m">Add to that trip</button><button type="button" class="btn btn-ghost" data-ans="n">Save as a new trip</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>',
      { m: "merge", n: "new" });
  }
  // B9: look before you restore
  function askRestore(data) {
    var a = A(), st = a.state, o = restorePreview(data, st.kids, st.trips.concat(st.bin || []), []);
    var line = function (n, label, list) { return n ? '<li><b>' + n + '</b> ' + label + (list && list.length ? ': ' + few(list) : "") + '</li>' : ""; };
    var body = line(o.addPeople.length, o.addPeople.length === 1 ? "person comes back" : "people come back", o.addPeople) +
      line(o.updPeople.length, o.updPeople.length === 1 ? "person on this phone is updated from the backup" : "people on this phone are updated from the backup", o.updPeople) +
      line(o.addTrips.length, o.addTrips.length === 1 ? "trip comes back" : "trips come back", o.addTrips) +
      line(o.updTrips.length, o.updTrips.length === 1 ? "trip is replaced by the backup's copy" : "trips are replaced by the backup's copy", o.updTrips) +
      line(o.keepTrips.length, o.keepTrips.length === 1 ? "trip stays as it is (changed on this phone since)" : "trips stay as they are (changed on this phone since)", o.keepTrips) +
      line((data.photos || []).length, (data.photos || []).length === 1 ? "photo" : "photos");
    return sheetAsk(head("Restore this backup?") +
      (o.at ? '<p class="small muted">Backup from ' + esc(when(o.at)) + '</p>' : "") +
      '<ul class="rprev">' + (body || "<li>Nothing new in this backup.</li>") + '</ul>' +
      '<p class="small"><b>Nothing on this phone is deleted.</b>' + (o.stayPeople || o.stayTrips ? " " + o.stayPeople + (o.stayPeople === 1 ? " person" : " people") + " and " + o.stayTrips + (o.stayTrips === 1 ? " trip" : " trips") + " that aren't in the backup stay as they are." : "") + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-ans="y">Restore</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>',
      { y: true }).then(function (x) { return !!x; });
  }

  /** v91: preview for "Restore from a backup" (add only). add = MLTL.addOnlyRestore(...) */
  function askAddRestore(data, add) {
    var line = function (n, one, many) { return n ? '<li><b>' + n + '</b> ' + (n === 1 ? one : many) + '</li>' : ""; };
    var body = line(add.kids.length, "person is added", "people are added") + line(add.trips.length, "trip is added", "trips are added") + line(add.photos.length, "photo is added", "photos are added");
    var sk = add.skipped.kids + add.skipped.trips;
    return sheetAsk(head("Add from this backup?") +
      (data.exportedAt ? '<p class="small muted">Backup from ' + esc(when(data.exportedAt)) + '</p>' : "") +
      '<ul class="rprev">' + (body || "<li>Everything in this backup is already here.</li>") + '</ul>' +
      '<p class="small"><b>Nothing here is changed or deleted.</b>' + (sk ? " " + sk + (sk === 1 ? " thing is" : " things are") + " already here, so " + (sk === 1 ? "it's" : "they're") + " skipped." : "") + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-ans="y">' + (body ? "Add them" : "OK") + '</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>',
      { y: true }).then(function (x) { return !!x && !!body; });
  }

  // B2: unfinished new trips
  function DKEY() { return "fs-trip-draft:" + dbKey(); }
  function readDraft() { try { var x = JSON.parse(localStorage.getItem(DKEY()) || "null"); return draftFresh(x) && A().kidById(x.kid) ? x : null; } catch (e) { return null; } }
  function clearDraft() { try { localStorage.removeItem(DKEY()); } catch (e) {} }
  var draftTimer = null, resumedHash = "";
  function watchDraft(kid, snap, can) {
    clearInterval(draftTimer); var h0 = location.hash, last = "", m = A().state.meta, homeKnown = !!(m.home || m.homePoint);
    draftTimer = setInterval(function () {
      if (location.hash !== h0 || !document.getElementById("tsave")) { clearInterval(draftTimer); return; }
      if (!can()) return;
      var x; try { x = snap(); } catch (e) { return; }
      var j = JSON.stringify(x); if (j === last) return; last = j;
      if (!draftUseful(x, homeKnown)) return;
      try { localStorage.setItem(DKEY(), JSON.stringify({ kid: kid, at: new Date().toISOString(), d: x })); } catch (e) {}
    }, 1200);
  }
  function resumeDraft(kid) {
    var want = false; try { want = sessionStorage.getItem("fs-draft-resume") === "1"; sessionStorage.removeItem("fs-draft-resume"); } catch (e) {}
    if (!want) return null; var d = readDraft(); if (d) resumedHash = location.hash; return d;
  }
  function draftWhere(dr) { var d = dr.d || {}, r = d.route || [], last = r[r.length - 1]; return String(d.title || (r.length > 1 && last && last.name) || "a new trip"); }
  function continueDraft(dr) { try { sessionStorage.setItem("fs-draft-resume", "1"); } catch (e) {} var h = "#/p/" + dr.kid + "/trips/new"; if (location.hash === h) A().route(); else location.hash = h; }

  // B5: a weekly automatic copy on this phone (no photos, so it stays small); the last 4 are kept
  var CDB = "famstamp-autocopies", KEEP = 4;
  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open(CDB, 1); r.onupgradeneeded = function () { r.result.createObjectStore("copies", { keyPath: "key" }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function listCopies() {
    return idb().then(function (db) { return new Promise(function (res) { var out = [], q = db.transaction("copies").objectStore("copies").openCursor(); q.onsuccess = function () { var c = q.result; if (c) { if (c.value.db === dbKey()) out.push(c.value); c.continue(); } else res(out.sort(function (x, y) { return x.at < y.at ? 1 : -1; })); }; q.onerror = function () { res([]); }; }); }).catch(function () { return []; });
  }
  function lastCopyAt() { try { return localStorage.getItem("fs-autocopy-at:" + dbKey()) || ""; } catch (e) { return ""; } }
  function makeCopy() {
    var a = A(), st = a.state, m = st.meta; if (!st.kids.length) return Promise.resolve(null);
    var now = new Date().toISOString(), data = M().makeBackup(st.kids, st.trips.concat(st.bin || []), [], now, { home: m.home || "", homePoint: m.homePoint, units: m.units });
    var rec = { key: dbKey() + "|" + now, db: dbKey(), at: now, people: st.kids.length, trips: st.trips.length, data: data };
    return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction("copies", "readwrite"); tx.objectStore("copies").put(rec); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); })
      .then(listCopies).then(function (all) {
        var old = all.slice(KEEP); if (!old.length) return;
        return idb().then(function (db) { var tx = db.transaction("copies", "readwrite"); old.forEach(function (c) { tx.objectStore("copies").delete(c.key); }); });
      }).then(function () { try { localStorage.setItem("fs-autocopy-at:" + dbKey(), now); } catch (e) {} return rec; });
  }
  function autoCopy() { if (!window.indexedDB || !A() || !autoDue(lastCopyAt())) return Promise.resolve(null); return makeCopy().catch(function (e) { log("auto copy: " + ((e && e.message) || e)); return null; }); }
  function lastLine() {
    var f = A().state.meta.lastBackupAt, c = lastCopyAt();
    return "Last backup file: " + (f ? dayOnly(f) : "none yet") + " · Automatic copy on this phone: " + (c ? dayOnly(c) : "not yet");
  }

  // Home / More / Back up cards
  function card(cls, html) { var d = document.createElement("div"); d.className = "panel rbcard " + cls; d.setAttribute("role", "status"); d.innerHTML = html; return d; }
  function tripKid(tid) { var t = A().state.trips.filter(function (x) { return x.id === tid; })[0]; return t && t.kidIds && t.kidIds[0] ? { kid: t.kidIds[0], t: t } : null; }
  function retry(btn) {
    var S = window.MLTL_SYNC; if (!S) return; btn.disabled = true; btn.textContent = "Trying…";
    S.syncNow({ throwErrors: true }).then(function () { A().toast("Synced ✓"); }, function () { A().toast("Still couldn't sync. Your changes are safe on this phone."); }).then(function () { btn.disabled = false; btn.textContent = "Try again"; refreshCards(); });
  }
  function refreshCards() { var m = A().main; Array.prototype.forEach.call(m.querySelectorAll(".rbcard"), function (x) { x.remove(); }); decorate(parts(location.hash), false); }
  function parts(h) { return String(h || "").replace(/^#\/?/, "").split("?")[0].split("/"); }
  function healthCards(main, at) {
    var S = window.MLTL_SYNC, h = S && S.health ? S.health() : null, st = stuckInfo(h), fl = failedList(h);
    if (st && !main.querySelector(".rbstuck")) {
      var c = card("rbstuck", '<h3>Sync stuck' + (st.since ? " since " + esc(when(st.since)) : "") + '</h3><p class="small">' + (st.pending ? "<b>" + st.pending + "</b> " + (st.pending === 1 ? "change is" : "changes are") + " waiting on this phone. " : "") + "They're safe here and go up as soon as sync works again." + (st.error ? " (" + esc(st.error) + ")" : "") + '</p>' +
        '<div class="actions"><button type="button" class="btn btn-primary" data-rb-retry>Try again</button><a class="btn btn-ghost" href="#/sync">Family Sync</a><a class="btn btn-ghost" href="#/report">Report a problem</a></div>');
      main.insertBefore(c, at);
    }
    if (fl.length && !main.querySelector(".rbfail")) {
      var why = fl[0].why, first = tripKid(fl[0].trip);
      var c2 = card("rbfail", '<h3>' + fl.length + (fl.length === 1 ? " photo didn't" : " photos didn't") + ' reach the family log</h3><p class="small">Reason: ' + esc(why) + '. ' + (fl.length === 1 ? "It's" : "They're") + " still on this phone, and we try again every sync.</p>" +
        '<div class="actions"><button type="button" class="btn btn-primary" data-rb-retry>Try again</button>' + (first ? '<a class="btn btn-ghost" href="#/p/' + esc(first.kid) + '/trip/' + esc(first.t.id) + '">See the trip</a>' : "") + '</div>');
      main.insertBefore(c2, at);
    }
  }
  function decorate(h, gv) {
    var a = A(); if (!a || !a.main || gv) return; var main = a.main;
    if (h[0] === "" || h[0] === "sync") healthCards(main, h[0] === "" ? main.firstChild : main.children[1] || null);
    if (h[0] === "") {
      var dr = readDraft();
      if (dr && !main.querySelector(".rbdraft")) {
        var k = a.kidById(dr.kid), c = card("rbdraft", '<h3>Finish your trip?</h3><p class="small">You started adding <b>' + esc(draftWhere(dr)) + '</b>' + (k ? " for " + esc(who(k)) : "") + ' on ' + esc(when(dr.at)) + '. It was saved on this phone as you typed.</p>' +
          '<div class="actions"><button type="button" class="btn btn-primary" data-rb-draft="go">Continue</button><button type="button" class="btn btn-ghost" data-rb-draft="drop">Discard</button></div>');
        main.insertBefore(c, main.querySelector(".rbstuck, .rbfail") ? main.querySelector(".rbstuck, .rbfail").nextSibling : main.firstChild);
      }
    }
    if ((h[0] === "p" || h[0] === "kid") && h[2] === "trips" && h[3] === "new" && resumedHash !== location.hash && !main.querySelector(".rbdraft")) {
      var d2 = readDraft();
      if (d2) { var b = main.querySelector(".builder"); if (b) b.parentNode.insertBefore(card("rbdraft", '<p class="small" style="margin:0">You have an unfinished trip: <b>' + esc(draftWhere(d2)) + '</b> (' + esc(when(d2.at)) + '). <button type="button" class="linkbtn" data-rb-draft="go">Continue it</button></p>'), b); }
    }
    // empty state: the family map with nobody on it yet
    if (h[0] === "family" && !h[1] && !a.state.kids.length && !main.querySelector(".rbempty")) {
      var e0 = card("rbempty", '<p style="margin:0">Nobody on the map yet. Add the first person, then color in every state, country and park they\'ve been to.</p><div class="actions"><a class="btn btn-primary" href="#/add">Add someone</a></div>');
      main.insertBefore(e0, main.children[1] || null);
    }
    if (h[0] === "more" && !main.querySelector(".rblast")) {
      var bk = main.querySelector('a[href="#/backup"]'), li = bk && bk.closest("ul, .morelist");
      if (li) { var p = document.createElement("p"); p.className = "small muted rblast"; p.textContent = lastLine(); li.parentNode.insertBefore(p, li.nextSibling); }
    }
    if (h[0] === "backup" && !main.querySelector(".rbcopies")) {
      var lb = document.getElementById("lastbk"); if (lb) lb.textContent = lastLine();
      var pan = document.createElement("div"); pan.className = "panel rbcopies"; pan.innerHTML = '<h3>Automatic copies on this phone</h3><p class="muted small">Once a week the app keeps a copy of everyone\'s maps and trips here (photos aren\'t included, so it stays small). The last ' + KEEP + ' are kept. They help if something goes wrong on this phone; a backup file is still what saves you if the phone is lost.</p><div class="rbclist small muted">Looking…</div><div class="actions"><button type="button" class="btn btn-ghost" data-rb-copynow>Make a copy now</button></div>';
      var anchor = document.getElementById("onetrip"); main.insertBefore(pan, anchor || null);
      listCopies().then(function (all) {
        var box = pan.querySelector(".rbclist"); if (!box) return;
        box.innerHTML = all.length ? all.map(function (c) { return '<div class="binrow"><span>' + esc(when(c.at)) + ' · ' + c.people + (c.people === 1 ? " person" : " people") + ' · ' + c.trips + (c.trips === 1 ? " trip" : " trips") + '</span> <button type="button" class="btn btn-ghost" data-rb-copy="' + esc(c.key) + '">Preview and restore</button></div>'; }).join("") : "No automatic copy yet. The first one is made this week.";
        box.classList.remove("muted");
      });
    }
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-rb-retry],[data-rb-draft],[data-rb-copy],[data-rb-copynow]"); if (!t) return;
    if (t.hasAttribute("data-rb-retry")) return retry(t);
    if (t.dataset.rbDraft === "go") { var dr = readDraft(); if (dr) continueDraft(dr); return; }
    if (t.dataset.rbDraft === "drop") { var keep = readDraft(); clearDraft(); var c = t.closest(".rbdraft"); if (c) c.remove(); if (keep && window.FS_WHO && window.FS_WHO.undoToast) window.FS_WHO.undoToast("Unfinished trip discarded", function () { try { localStorage.setItem(DKEY(), JSON.stringify(keep)); } catch (x) {} A().route(); }); else A().toast("Discarded"); return; }
    if (t.hasAttribute("data-rb-copynow")) { t.disabled = true; makeCopy().then(function () { A().toast("Copy saved on this phone"); A().route(); }, function () { t.disabled = false; A().toast("Couldn't make a copy. Is the phone out of space?"); }); return; }
    if (t.dataset.rbCopy) listCopies().then(function (all) {
      var c = all.filter(function (x) { return x.key === t.dataset.rbCopy; })[0]; if (!c) return;
      var data; try { data = A().readBackup(c.data); } catch (x) { A().toast(x.message); return; }
      A().restoreBackup(data);
    });
  });
  if (A() && A().ready) A().ready.then(function () { setTimeout(autoCopy, 8000); });
  setTimeout(persist, 1500);
  core.persist = persist; core.readLog = readLog; core.log = log;
  core.decorate = decorate; core.askDup = askDup; core.askRestore = askRestore; core.askAddRestore = askAddRestore; core.watchDraft = watchDraft; core.resumeDraft = resumeDraft; core.clearDraft = clearDraft; core.readDraft = readDraft;
  core.makeCopy = makeCopy; core.listCopies = listCopies; core.autoCopy = autoCopy; core.lastLine = lastLine;
  return core;
});
