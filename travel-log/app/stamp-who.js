/* Famstamp: the "Who's been there?" picker. Every hand-marked park, state park, monument, state or country, the passport's
   "+ Add a stamp", collecting a State Sign, and "Change who has it" on a stamp all come here. It starts with whoever is
   signed in on this phone (the person linked to their Family Sync login), never just whoever's page is open, and asks
   when the login isn't linked to anyone yet. The counting is in stamp-who-core.js. */
(function () {
  "use strict";
  var M = window.MLTL, C = window.FS_WHO_CORE, esc = M.esc;
  function A() { return window.MLTL_APP; }
  function U() { return window.FS_UI; }
  function S() { return A().state; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /** Who is signed in on this phone: { synced, me } (me = their person id, or "" when the login isn't linked to anyone). */
  function whoAmI() {
    var c = S().meta.sync; if (!c || !c.familyId) return { synced: false, me: "" };
    return { synced: true, me: c.myPerson && A().kidById(c.myPerson) ? c.myPerson : "" };
  }
  function people() {
    var me = whoAmI().me;
    return S().kids.slice().sort(function (a, b) { return (b.id === me ? 1 : 0) - (a.id === me ? 1 : 0); });
  }
  function names(ids) {
    var n = ids.map(function (id) { var p = A().kidById(id); return p ? M.who(p) : ""; }).filter(Boolean);
    return n.length <= 2 ? n.join(" & ") : n.slice(0, -1).join(", ") + " & " + n[n.length - 1];
  }

  // ---------- Undo toast ----------
  var undoT = 0;
  function undoToast(msg, undo) {
    $$(".undotoast").forEach(function (x) { x.remove(); }); clearTimeout(undoT);
    var el = document.createElement("div"); el.className = "undotoast"; el.setAttribute("role", "status");
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" class="undobtn">Undo</button>' : "") + '<button type="button" class="undox" aria-label="Dismiss">✕</button>';
    document.body.appendChild(el);
    var b = $(".undobtn", el); if (b) b.onclick = function () { el.remove(); undo(); };
    $(".undox", el).onclick = function () { el.remove(); };
    undoT = setTimeout(function () { el.remove(); }, 8000);
  }
  function saveAll(list) { return Promise.all(list.map(function (p) { return A().saveKid(p); })); }
  function undoFor(undo, after) {
    var h = location.hash;
    return function () { var back = C.restore(S().kids, undo); saveAll(back).then(function () { A().toast("Undone"); if (location.hash !== h) A().route(); else if (after) after(); }); };
  }

  /** The person chips: tick everyone who was there. hold = { personId: "trip" | "hand" | "map" | "" }. */
  function chipsHTML(list, on, hold, me) {
    return '<div class="whochips" role="group" aria-label="Who\'s been there?">' + list.map(function (p) {
      var h = hold[p.id] || "", lock = h === "trip", checked = on.indexOf(p.id) >= 0 || lock;
      return '<label class="wchip' + (lock ? " lock" : "") + '" style="' + A().kidStyle(p) + '"><input type="checkbox" data-who="' + esc(p.id) + '"' + (checked ? " checked" : "") + (lock ? " disabled" : "") + '>' +
        '<span class="dotp" aria-hidden="true">' + A().initial(p) + '</span><span class="wn">' + esc(M.who(p)) + (p.id === me ? ' <small>(you)</small>' : "") + '</span>' +
        (lock ? '<small class="wtag">from a trip</small>' : h ? '<small class="wtag">has it</small>' : "") + '</label>';
    }).join("") + '</div>';
  }
  function picked(root) { return $$("input[data-who]", root).filter(function (x) { return x.checked && !x.disabled; }).map(function (x) { return x.dataset.who; }); }

  /** Open the picker. o = { kind, area, page (whose screen it's on), mode: "add" | "edit", date, after(), via } */
  function open(o) {
    var kind = o.kind, area = o.area, list = people(), id = whoAmI(), trips = S().trips, ctx = U().CTX;
    if (kind === "place" && area === "USA") return;
    var hold = C.holders(list, trips, kind, area, ctx), page = o.page ? o.page.id : "";
    var on = C.startWith(list, hold, { mode: o.mode, synced: id.synced, me: id.me, page: page });
    var name = U().shortArea(kind, area), had = list.filter(function (p) { return hold[p.id]; }).map(function (p) { return p.id; });
    var ask = id.synced && !id.me;
    var html = '<div class="sheethead"><h3 id="whoh">Who\'s been to ' + esc(name) + '?</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      (ask ? '<p class="small whoask">Which one is you? Tick yourself below, and <a href="#/sync/me">tell Famstamp which one is you</a> so you\'re picked for you next time.</p>'
           : '<p class="small muted">Tick everyone who was there. They each get the stamp.</p>') +
      '<div class="whoshort"><button type="button" class="chip" id="wall">👨‍👩‍👧 Whole family</button><button type="button" class="chip" id="wtrip" hidden></button></div>' +
      chipsHTML(list, on, hold, id.me) +
      '<p class="small muted wlabel">' + (had.length ? "When? (for anyone you add, optional)" : "When? (optional)") + '</p>' + U().dateFields(o.date || "") +
      '<p class="err" id="werr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="wok">Save</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>';
    var el = U().sheet(html); el.querySelector(".sheetbox").classList.add("whosheet");
    var box = $(".whosheet");
    function syncTrip() {
      var b = $("#wtrip", box), t = C.tripFor(trips, U().readDate(), picked(box).length ? picked(box) : (id.me ? [id.me] : page ? [page] : []));
      if (!t) { b.hidden = true; return; }
      b.hidden = false; b.dataset.trip = t.id; b.textContent = "🧳 Everyone on " + t.place + (t.date ? " (" + M.prettyDate(t.date) + ")" : "");
    }
    $("#wall", box).onclick = function () {
      var boxes = $$("input[data-who]:not([disabled])", box), all = boxes.every(function (x) { return x.checked; });
      boxes.forEach(function (x) { x.checked = !all; }); syncTrip();
    };
    $("#wtrip", box).onclick = function () {
      var t = trips.filter(function (x) { return x.id === this.dataset.trip; }, this)[0]; if (!t) return;
      $$("input[data-who]:not([disabled])", box).forEach(function (x) { if (t.kidIds.indexOf(x.dataset.who) >= 0) x.checked = true; });
      if (!U().readDate() && t.date) { var d = $("#sdate", box); if (d) { d.value = t.date; } }
    };
    $$("input[data-who]", box).forEach(function (x) { x.onchange = syncTrip; });
    $$("#sdate, #syear, #smonth", box).forEach(function (x) { x.addEventListener("change", syncTrip); });
    syncTrip();
    $("#wok", box).onclick = function () {
      var want = picked(box), date = U().readDate(), err = $("#werr", box);
      if (!want.length && !had.length) { err.hidden = false; err.textContent = "Tick who's been there."; return; }
      var r = C.apply(S().kids, trips, kind, area, want, { date: date, ctx: ctx, via: o.via || "", visitDate: o.visitDate });
      finish(r, kind, area, date, o.after);
    };
    return el;
  }
  /** Re-draw only if they're still on the same screen (saving is async; they may have moved on). */
  function here(after) { var h = location.hash; return function (x) { if (after && location.hash === h) after(x); }; }
  /** Save what changed, then celebrate and offer Undo. */
  function finish(r, kind, area, date, after) {
    after = here(after);
    var name = U().shortArea(kind, area);
    if (!r.changed.length) {
      U().closeSheet();
      if (r.kept.length) A().toast(names(r.kept) + (r.kept.length === 1 ? " already has " : " already have ") + name);
      return Promise.resolve(r);
    }
    return saveAll(r.changed).then(function () {
      U().closeSheet(); if (after) after(r);
      var bits = [];
      if (r.added.length) bits.push(name + ": stamped for " + names(r.added));
      if (r.removed.length) bits.push((r.added.length ? "taken off " : name + ": taken off ") + names(r.removed));
      if (r.kept.length && r.added.length) bits.push(names(r.kept) + " already had it");
      if (r.added.length && U().celebrate) {
        var fresh = kind === "state" && r.undo.some(function (u) { return r.added.indexOf(u.id) >= 0 && !u.states[area]; });
        U().celebrate([{ kind: kind, area: area, date: date, newSign: fresh, signOnly: fresh && !date, holder: r.added[0], id: "who-" + area }]);
      }
      undoToast(bits.join(" · "), undoFor(r.undo, after));
      return r;
    });
  }
  /** Who to tick to start with when there's no place yet (+ Add a stamp, State Signs). */
  function startIds(page) { var id = whoAmI(); return id.synced ? (id.me ? [id.me] : []) : page ? [page.id] : []; }
  function askLine() { var id = whoAmI(); return id.synced && !id.me ? '<p class="small whoask">Which one is you? Tick yourself below, and <a href="#/sync/me">tell Famstamp which one is you</a> so you\'re picked for you next time.</p>' : ""; }
  /** Take a stamp off one person, with Undo. */
  function removeStamp(p, stamp, after) {
    after = here(after);
    var u = C.removeOne(p, S().trips, stamp, { ctx: U().CTX }); if (!u) return Promise.resolve(false);
    return A().saveKid(p).then(function () { if (after) after(); undoToast(U().stampName(stamp) + " taken off " + M.who(p) + "'s passport", undoFor([u], after)); return true; });
  }
  window.FS_WHO = { open: open, finish: finish, startIds: startIds, askLine: askLine, people: people, removeStamp: removeStamp, whoAmI: whoAmI, chipsHTML: chipsHTML, picked: picked, undoToast: undoToast, names: names };
})();
