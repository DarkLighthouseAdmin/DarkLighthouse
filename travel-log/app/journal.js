/* Famstamp: the kids' daily journal (#/journal/<tripId>/<day>/<personId>). Three prompts a day per kid: the best part of
   the day, the funniest thing someone said, and a photo of a drawing. Pages live on the trip (trip.journal), so they work
   offline, sync with the trip, and feed Highlights, the weekly recap, the travel book and the year in review.
   The data part runs in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_JOURNAL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var PROMPTS = [["best", "🌟", "Best part of the day", "What was the best thing today?"], ["funny", "😂", "Funniest thing someone said", "Who said what?"], ["drawing", "🎨", "A drawing", "Draw something from today, then take a photo of it"]];
  var DAY = /^\d{4}-\d{2}-\d{2}$/, MAX = 60;
  function clean(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n); }
  function list(t) { return t && Array.isArray(t.journal) ? t.journal : []; }
  function entry(t, kid, day) { return list(t).filter(function (j) { return j && j.kid === kid && j.day === day; })[0] || null; }
  /** Write (or clear) one kid's page for one day. vals: { best, funny, said, photoId }. Returns the entry, or null if it's now empty. */
  function upsert(t, kid, day, vals, now, rid) {
    if (!t || !kid || !DAY.test(day || "")) return null;
    t.journal = list(t).filter(function (j) { return j && j.kid && DAY.test(j.day || ""); });
    var e = entry(t, kid, day), v = { best: clean(vals.best, 280), funny: clean(vals.funny, 200), said: clean(vals.said, 40), photoId: typeof vals.photoId === "string" ? vals.photoId : "" };
    if (!v.best && !v.funny && !v.photoId) {
      if (e) {   // v71: a tombstone so a merge with another phone's copy can't bring the page back
        t.journal = t.journal.filter(function (j) { return j !== e; });
        var g = t.journalGone && typeof t.journalGone === "object" ? t.journalGone : {}; g[kid + "|" + day] = String(now || new Date().toISOString());
        var ks = Object.keys(g); if (ks.length > 300) ks.sort(function (a, b) { return g[a] < g[b] ? -1 : 1; }).slice(0, ks.length - 300).forEach(function (k) { delete g[k]; });
        t.journalGone = g;
      }
      return null;
    }
    if (!e) {
      if (t.journal.length >= MAX) return null;
      e = { id: rid || ("j" + Math.random().toString(36).slice(2, 12)), kid: kid, day: day }; t.journal.push(e);
    }
    e.best = v.best; e.funny = v.funny; e.said = v.funny ? v.said : ""; e.photoId = v.photoId || null; e.at = String(now || new Date().toISOString());
    ["best", "funny", "said"].forEach(function (k) { if (!e[k]) delete e[k]; }); if (!e.photoId) delete e.photoId;
    t.journal.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.kid < b.kid ? -1 : 1; });
    return e;
  }
  /** One person's pages across trips, oldest first: [{ trip, e }] */
  function forPerson(trips, pid, year) {
    var out = [];
    (trips || []).forEach(function (t) { if (t && !t.deletedAt) list(t).forEach(function (e) { if (e && e.kid === pid && (!year || String(e.day).slice(0, 4) === String(year))) out.push({ trip: t, e: e }); }); });
    return out.sort(function (a, b) { return a.e.day < b.e.day ? -1 : 1; });
  }
  /** For the year in review: how many pages, and a few quotes. */
  function yearBits(people, trips, year) {
    var ids = {}, pages = 0, quotes = [], bests = [];
    (people || []).forEach(function (p) { ids[p.id] = p; });
    (trips || []).forEach(function (t) {
      if (!t || t.deletedAt) return;
      list(t).forEach(function (e) {
        if (!e || !ids[e.kid] || String(e.day).slice(0, 4) !== String(year)) return;
        pages++; if (e.funny) quotes.push({ text: e.funny, said: e.said || "", day: e.day, kid: e.kid }); if (e.best) bests.push({ text: e.best, day: e.day, kid: e.kid });
      });
    });
    return { pages: pages, quotes: quotes.slice(-3), bests: bests.slice(-3) };
  }
  function days(t, M) {
    var out = [], d = t && t.date; if (!DAY.test(d || "")) return [];
    var end = M && M.tripEnd ? M.tripEnd(t) : d;
    for (var i = 0; i < 31 && d <= end; i++) { out.push(d); d = M.addDays(d, 1); }
    return out;
  }
  var core = { PROMPTS: PROMPTS, MAX: MAX, entry: entry, upsert: upsert, forPerson: forPerson, yearBits: yearBits, days: days, list: list };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function esc(s) { return M().esc(s); }
  function tripById(id) { return A().state.trips.filter(function (t) { return t.id === id && !t.deletedAt; })[0] || null; }
  function writers(t) { var ks = (t.kidIds || []).map(A().kidById).filter(Boolean), kids = ks.filter(function (p) { return p.role === "kid"; }); return kids.length ? kids : ks; }
  function pickDay(t) { var td = M().today(), ds = days(t, M()); return ds.indexOf(td) >= 0 ? td : ds[0] || td; }
  var pending = null;   // a photo picked but not saved yet: { id, dataUrl }
  function view(tid, day, pid) {
    var t = tripById(tid); if (!t) { location.hash = "#/"; return; }
    var ws = writers(t), p = A().kidById(pid) || ws[0], ds = days(t, M());
    day = DAY.test(day || "") ? day : pickDay(t);
    if (!p) { location.hash = "#/"; return; }
    document.title = "Journal · " + M().who(p) + " · Famstamp";
    var e = entry(t, p.id, day) || {}, ph = pending && pending.key === tid + day + p.id ? pending : null;
    var html = '<a class="back" href="#/p/' + esc(p.id) + '/trip/' + esc(t.id) + '">← ' + esc(M().tripLabel(t)) + '</a><h1>📓 ' + esc(M().who(p)) + '\'s journal</h1>' +
      (ws.length > 1 ? '<div class="wwho jwho">' + ws.map(function (w) { return '<a class="chip' + (w.id === p.id ? " on" : "") + '" style="' + A().kidStyle(w) + '" href="#/journal/' + esc(t.id) + '/' + day + '/' + esc(w.id) + '">' + esc(M().who(w)) + (entry(t, w.id, day) ? " ✓" : "") + '</a>'; }).join("") + '</div>' : "") +
      (ds.length > 1 ? '<div class="field"><label for="jday">Day</label><select id="jday">' + ds.map(function (d, i) { return '<option value="' + d + '"' + (d === day ? " selected" : "") + '>Day ' + (i + 1) + ' · ' + esc(M().prettyDate(d)) + (entry(t, p.id, d) ? " ✓" : "") + '</option>'; }).join("") + '</select></div>' : '<p class="small muted">' + esc(M().prettyDate(day)) + '</p>') +
      '<div class="panel jpage"><div class="field"><label for="jbest">🌟 Best part of the day</label><textarea id="jbest" maxlength="280" rows="3" placeholder="What was the best thing today?">' + esc(e.best || "") + '</textarea></div>' +
      '<div class="field"><label for="jfunny">😂 Funniest thing someone said</label><textarea id="jfunny" maxlength="200" rows="2" placeholder="“…”">' + esc(e.funny || "") + '</textarea>' +
      '<input id="jsaid" maxlength="40" placeholder="Who said it?" value="' + esc(e.said || "") + '"></div>' +
      '<div class="field"><span class="lbl">🎨 A drawing</span><p class="small muted">Draw something from today, then snap a photo of it.</p>' +
      ((ph || e.photoId) ? '<img alt="The drawing" class="jdraw" ' + (ph ? 'src="' + esc(ph.dataUrl) + '"' : 'data-photo="' + esc(e.photoId) + '"') + '>' : "") +
      '<label class="btn btn-ghost wpick">📷 ' + ((ph || e.photoId) ? "Change the photo" : "Add a photo of the drawing") + '<input type="file" id="jphoto" accept="image/*" hidden></label>' +
      ((ph || e.photoId) ? ' <button type="button" class="linkbtn sm" id="jnophoto">Remove photo</button>' : "") + '</div>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="jsave">Save this page</button></div></div>';
    A().main.innerHTML = html; A().fillPhotos();
    var $ = function (s) { return A().main.querySelector(s); };
    if ($("#jday")) $("#jday").onchange = function () { location.hash = "#/journal/" + t.id + "/" + $("#jday").value + "/" + p.id; };
    var drop = false;
    $("#jphoto").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      A().shrinkPhoto(f).then(function (u) { pending = { key: tid + day + p.id, id: M().uid("photo"), dataUrl: u }; keepTyping(); view(tid, day, p.id); restoreTyping(); })
        .catch(function () { A().toast("Couldn't read that photo. Try another one."); });
    };
    var typed = null;
    function keepTyping() { typed = { best: $("#jbest").value, funny: $("#jfunny").value, said: $("#jsaid").value }; }
    function restoreTyping() { if (!typed) return; var m = A().main; m.querySelector("#jbest").value = typed.best; m.querySelector("#jfunny").value = typed.funny; m.querySelector("#jsaid").value = typed.said; }
    if ($("#jnophoto")) $("#jnophoto").onclick = function () { keepTyping(); pending = null; drop = true; var im = A().main.querySelector(".jdraw"); if (im) im.remove(); this.remove(); };
    $("#jsave").onclick = function () {
      var old = e.photoId || "", photo = ph ? ph.id : drop ? "" : old, jobs = [];
      var res = upsert(t, p.id, day, { best: $("#jbest").value, funny: $("#jfunny").value, said: $("#jsaid").value, photoId: photo });
      if (!res && !entry(t, p.id, day) && ($("#jbest").value.trim() || $("#jfunny").value.trim() || photo)) { A().toast("This trip's journal is full (" + MAX + " pages)."); return; }
      if (ph) jobs.push(A().put("photos", { id: ph.id, dataUrl: ph.dataUrl }));
      if (old && old !== photo) jobs.push(A().del("photos", old));
      t.updatedAt = new Date().toISOString(); jobs.push(A().put("trips", t));
      Promise.all(jobs).then(function () {
        pending = null; A().toast(res ? "📓 Saved " + M().who(p) + "'s page" : "Page cleared");
        var next = writers(t).filter(function (w) { return !entry(t, w.id, day); })[0];
        location.hash = next ? "#/journal/" + t.id + "/" + day + "/" + next.id : "#/p/" + p.id + "/trip/" + t.id;
      });
    };
  }
  /** On a trip page: the journal so far, and a button per kid. */
  function tripHTML(k, t) {
    if (!DAY.test(t.date || "")) return "";
    var ws = writers(t), day = pickDay(t), l = list(t).filter(function (e) { return A().kidById(e.kid); });
    return '<div class="tripjournal"><h3 class="sec">📓 Kids\' journal</h3>' + (l.length ? '<div class="jlist">' + l.map(function (e) {
      var w = A().kidById(e.kid);
      return '<div class="jent panel"><p class="small"><b>' + esc(M().who(w)) + '</b> · ' + esc(M().prettyDate(e.day)) + '</p>' +
        (e.best ? '<p>🌟 ' + esc(e.best) + '</p>' : "") + (e.funny ? '<p>😂 “' + esc(e.funny) + '”' + (e.said ? ' <span class="muted">(' + esc(e.said) + ')</span>' : "") + '</p>' : "") +
        (e.photoId ? '<img alt="A drawing" class="jdraw" data-photo="' + esc(e.photoId) + '">' : "") + '<a class="small noprint" href="#/journal/' + esc(t.id) + '/' + e.day + '/' + esc(e.kid) + '">Edit</a></div>';
    }).join("") + '</div>' : '<p class="small muted">One page a day: the best part, the funniest quote, a drawing.</p>') +
      '<div class="actions noprint">' + ws.map(function (w) { return '<a class="btn btn-ghost btn-sm" href="#/journal/' + esc(t.id) + '/' + day + '/' + esc(w.id) + '">✏️ ' + esc(M().who(w)) + '</a>'; }).join("") + '</div></div>';
  }
  /** Home, while a trip is on: who still has today's page to write. */
  function homeCard() {
    var td = M().today(), now = M().onTripNow(A().state.trips, td); if (!now.length) return "";
    var t = now[0].trip, todo = writers(t).filter(function (w) { return !entry(t, w.id, td); }); if (!todo.length) return "";
    return '<a class="panel familycard jcard" href="#/journal/' + esc(t.id) + '/' + td + '/' + esc(todo[0].id) + '"><span class="fam-ic" aria-hidden="true">📓</span><span><h3>Today\'s journal</h3><span class="small">' +
      esc(M().joinNames(todo.map(M().who))) + ': best part of the day, a funny quote, a drawing →</span></span></a>';
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "journal") return false; view(h[1], h[2], h[3]); return true; });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(homeCard);
  (window.FS_TRIPX = window.FS_TRIPX || []).push({ html: tripHTML });
  core.view = view;
  return core;
});
