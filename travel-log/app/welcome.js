/* Famstamp v93: first-time welcome for a brand-new family (3 short steps on Home: what Famstamp is, add your family, stamp your
   home town). Skippable; once skipped, finished, or once the phone has any data from before, it never shows again.
   It never shows for existing users: a phone that already has people, trips, a home town, a backup, Family Sync or the
   app tour done is marked "done" the first time this runs. State lives in localStorage "fs-welcome" ("on" / "done"). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_WELCOME = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  /** Pure: which step to show (1-3) or 0 for none, and what to remember. s = { flag, step, kids, trips, bin, home, backup, sync, tour } */
  function decide(s) {
    if (s.flag === "done") return { step: 0 };
    var used = s.trips > 0 || s.bin > 0 || !!s.home || !!s.backup || !!s.sync;
    if (s.flag !== "on") {
      if (used || s.kids > 0 || s.tour) return { step: 0, flag: "done" };   // an existing user: never
      return { step: 1, flag: "on" };
    }
    if (used) return { step: 0, flag: "done" };                               // they've started on their own: done
    var st = Math.max(1, Math.min(3, +s.step || 1));
    if (s.kids > 0 && st < 3) st = 3;                                          // family added: on to the home town
    return { step: st };
  }
  /** Pure: the stamp a home-town place gives (a US state, else a country), or null. */
  function homeStamp(p) {
    if (!p) return null;
    if (p.country === "USA" && /^[A-Z]{2}$/.test(p.region || "")) return { kind: "state", id: p.region };
    if (/^[A-Z]{3}$/.test(p.country || "") && p.country !== "USA") return { kind: "place", id: p.country };
    return null;
  }
  var core = { decide: decide, homeStamp: homeStamp };
  if (typeof document === "undefined") return core;

  function A() { return window.MLTL_APP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function now() {
    var a = A(), st = a && a.state; if (!st) return { step: 0 };
    var S = window.MLTL_SYNC;
    var d = decide({ flag: ls("fs-welcome"), step: ls("fs-welcome-step"), kids: st.kids.length, trips: st.trips.length, bin: (st.bin || []).length,
      home: st.meta.home || st.meta.homePoint, backup: st.meta.lastBackupAt, sync: (S && S.isOn && S.isOn()) || (st.meta.sync && st.meta.sync.familyId), tour: ls("fs-tour") });
    if (d.flag) ls("fs-welcome", d.flag);
    return d;
  }
  function active() { return now().step > 0; }
  var dots = function (i) { return '<p class="wl-dots small muted" aria-label="Step ' + i + ' of 3">' + [1, 2, 3].map(function (n) { return '<span class="' + (n === i ? "on" : "") + '"></span>'; }).join("") + ' Step ' + i + ' of 3</p>'; };
  var skip = '<button type="button" class="btn btn-ghost" data-wl="skip">Skip</button>';
  function stepHTML(i) {
    if (i === 1) return '<h2>Welcome to Famstamp</h2><p>A travel map and stamp passport for everyone in your family. Color in the states, countries and national parks you visit, collect stamps, and keep the little stories from every trip.</p>' +
      '<p class="small muted">It all stays on this phone unless you turn on Family Sync.</p>' + dots(1) + '<div class="actions"><button type="button" class="btn btn-primary" data-wl="2">Next</button>' + skip + '</div>';
    if (i === 2) return '<h2>Add your family</h2><p>Start with the kids, then the grown-ups and grandparents who travel with you. Nicknames are fine.</p>' +
      dots(2) + '<div class="actions"><a class="btn btn-primary" href="#/add" data-wl="add">＋ Add someone</a>' + skip + '</div>';
    var who = A().state.kids;
    return '<h2>Your first stamp: home</h2><p>' + (who.length ? "Where's home? Everyone gets their home state (or country) stamped." : "Where's home? We'll remember it for your first trip.") + '</p>' +
      '<div class="field"><label for="wl-home">Home town</label><input id="wl-home" type="text" maxlength="80" placeholder="e.g. Madison, WI" autocomplete="off"></div>' +
      '<div id="wl-res" class="wl-res" role="listbox" aria-label="Places"></div>' +
      dots(3) + '<div class="actions">' + (who.length ? "" : '<a class="btn btn-ghost" href="#/add">＋ Add someone first</a>') + skip + '</div>';
  }
  function homeHTML() {
    var d = now(); if (!d.step) return "";
    return '<section class="panel welcome" id="welcome" aria-label="Welcome">' + stepHTML(d.step) + '</section>';
  }
  function repaint() { var el = document.getElementById("welcome"); if (!el) return; var d = now(); if (!d.step) { el.remove(); return; } el.innerHTML = stepHTML(d.step); bind(); }
  function finish(msg) { ls("fs-welcome", "done"); ls("fs-welcome-step", null); var el = document.getElementById("welcome"); if (el) el.remove(); if (msg) A().toast(msg); }
  var timer = null, results = [];
  function bind() {
    var inp = document.getElementById("wl-home"), box = document.getElementById("wl-res"); if (!inp || !box) return;
    inp.oninput = function () {
      clearTimeout(timer); var q = inp.value.trim();
      if (q.length < 2) { box.innerHTML = ""; return; }
      timer = setTimeout(function () {
        var UI = window.FS_UI; if (!UI || !UI.findPlaces) return;
        UI.findPlaces(q).then(function (list) {
          if (inp.value.trim() !== q) return;
          results = (list || []).filter(function (p) { return p && p.name && p.lat != null; }).slice(0, 6);
          box.innerHTML = results.length ? results.map(function (p, i) {
            return '<button type="button" class="wl-pick" data-wlpick="' + i + '">' + esc(p.name) + (p.region || p.country ? '<span class="small muted"> · ' + esc([p.region, p.country].filter(Boolean).join(", ")) + '</span>' : "") + '</button>';
          }).join("") : '<p class="small muted">No match yet. Try the town and state, like "Madison, WI".</p>';
        }).catch(function () {});
      }, 250);
    };
  }
  function pickHome(p) {
    var a = A(), st = a.state, T = window.WK_TRIPS, jobs = [];
    var pt = T && T.cleanPoint ? T.cleanPoint({ name: p.name, kind: "city", lat: p.lat, lon: p.lon, country: p.country, region: p.region }, true) : { name: p.name, lat: p.lat, lon: p.lon };
    if (!st.meta.home) jobs.push(a.setMeta("home", p.name));
    if (!st.meta.homePoint && pt) jobs.push(a.setMeta("homePoint", pt));
    var s = homeStamp(p), got = 0;
    if (s && window.FS_WHERE && st.kids.length) {
      var r = window.FS_WHERE.tap(st.kids, s.kind, s.id, {});
      if (r.on) r.ids.forEach(function (id) { var k = a.kidById(id); if (k) { got++; jobs.push(a.saveKid(k)); } });
    }
    return Promise.all(jobs).then(function () {
      finish(got ? "🏠 Home stamped for " + (got === 1 ? "1 person" : got + " people") + "!" : "🏠 Home saved");
      if (a.route) a.route();
    });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-wl],[data-wlpick]"); if (!t || !document.getElementById("welcome")) return;
    if (t.hasAttribute("data-wlpick")) { var p = results[+t.getAttribute("data-wlpick")]; if (p) { t.disabled = true; pickHome(p); } return; }
    var v = t.getAttribute("data-wl");
    if (v === "skip") { finish("OK. You can always start from + Add someone."); return; }
    if (v === "add") { ls("fs-welcome-step", "3"); return; }   // the link goes on to Add someone; back on Home it's step 3
    ls("fs-welcome-step", v); repaint();
  });
  core.active = active; core.homeHTML = homeHTML; core.bind = bind; core.now = now;
  return core;
});
