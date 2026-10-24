/* Famstamp: Cousin Cup (v65). Anyone in a family (a grandparent, a parent) hosts a shared stamp goal, like "200 stamps
   by summer", and other families (the cousins) join with a code or link. Each family's app adds up the stamps its
   people collected since the cup started and reports that number; everyone sees only the team total, the goal and which
   families are in. No per-person or per-family scores, no rankings, no losers. Needs Family Sync and the
   cousin-cup SQL (cups / cup_teams + functions); until that's applied the page says it's almost ready.
   Routes: #/cup, #/cup/<CODE>, #/cup/join/<CODE>. Cached on this phone: meta.cups = [{ id, code, name, goal, starts_on, ends_on, total }]. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(typeof require === "function" ? require("./rewards.js") : null);
  else root.FS_CUP = factory(root.FS_REWARDS);
})(typeof self !== "undefined" ? self : this, function (RW) {
  "use strict";
  var DAY = /^\d{4}-\d{2}-\d{2}/;
  function rw() { return RW || (typeof self !== "undefined" && self.FS_REWARDS); }
  function normCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }
  function isCode(c) { return /^[A-HJ-NP-Z2-9]{8}$/.test(c || ""); }
  /** Stamps this family collected in the cup's window: kids' stamps (everyone's when no one is marked a kid). */
  function count(people, since, until) {
    var ps = (people || []).filter(function (p) { return p && !p.deletedAt; }), kids = ps.filter(function (p) { return p.role === "kid" || p.kid; }), n = 0;
    (kids.length ? kids : ps).forEach(function (p) {
      rw().stamps(p).forEach(function (d) { if (!DAY.test(d)) return; d = d.slice(0, 10); if ((!since || d >= since) && (!until || d <= until)) n++; });
    });
    return n;
  }
  function progress(total, goal) {
    total = Math.max(0, +total || 0); goal = Math.max(1, +goal || 1);
    var pct = Math.min(100, Math.round(total / goal * 100));
    return { total: total, goal: goal, pct: pct, left: Math.max(0, goal - total), done: total >= goal,
             line: total >= goal ? "Goal reached! " + total + " stamps together 🎉" : total + " of " + goal + " stamps together · " + (goal - total) + " to go" };
  }
  function missing(e) { return !!(e && (e.missing || /PGRST202|PGRST205|42883|42P01|Could not find the function|schema cache|does not exist/i.test(String(e.code || "") + " " + (e.message || "")))); }
  var core = { normCode: normCode, isCode: isCode, count: count, progress: progress, missing: missing };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function esc(s) { return M().esc(s); }
  function X() { return window.MLTL_SYNC && window.MLTL_SYNC.cup; }
  function on() { var x = X(); return !!(x && x.on()); }
  function fid() { return (X().cfg() || {}).familyId; }
  function rpc(fn, args) { return X().rpc(fn, args); }
  function cached() { var l = A().state.meta.cups; return Array.isArray(l) ? l : []; }
  function cache(l) { return A().setMeta("cups", (l || []).map(function (c) { return { id: c.id, code: c.code, name: c.name, goal: c.goal, starts_on: c.starts_on, ends_on: c.ends_on, total: c.total, families: (c.families || []).length }; })); }
  function mine(c) { return count(A().state.kids, String(c.starts_on || "").slice(0, 10), String(c.ends_on || "").slice(0, 10)); }
  var lastReport = 0;
  /** Send this family's count to every cup it's in (after a sync, and when a cup page opens). Quiet on failure. */
  function report(force) {
    if (!on() || !cached().length || (!force && Date.now() - lastReport < 600000)) return Promise.resolve();
    lastReport = Date.now();
    return Promise.all(cached().map(function (c) { return rpc("cup_report", { p_cup: c.id, p_family: fid(), p_stamps: mine(c) }).catch(function () {}); }));
  }
  function bar(c) {
    var g = progress(c.total, c.goal);
    return '<div class="cupbar" role="img" aria-label="' + esc(g.line) + '"><span style="width:' + g.pct + '%"></span></div><p class="cupline">' + esc(g.line) + '</p>';
  }
  function needSync(code) {
    if (code) try { localStorage.setItem("fs-cup-pending", code); } catch (e) {}
    A().main.innerHTML = '<h1>🏆 Cousin Cup</h1><p>A Cousin Cup is a shared stamp goal for several families, like “200 stamps by summer”. Every family\'s new stamps add to one team total. No scores for anyone, just the team.</p>' +
      '<p>It uses Family Sync so the families can count together. Turn on Family Sync first' + (code ? ', then come back to this link to join' : "") + '.</p><p><a class="btn btn-primary" href="#/sync">Set up Family Sync</a></p>';
  }
  function soon() {
    A().main.innerHTML = '<h1>🏆 Cousin Cup</h1><p>A shared stamp goal for grandparents, cousins and the whole family. Every family\'s new stamps add to one team total.</p>' +
      '<div class="panel"><b>Almost ready.</b> <span class="small">Cousin Cup is being switched on for Family Sync. Check back soon!</span></div>';
  }
  function fail(e) { if (missing(e)) return soon(); A().main.insertAdjacentHTML("beforeend", '<p class="sterr small" role="alert">' + esc(e && e.message || "Something went wrong. Try again.") + '</p>'); }
  function home() {
    document.title = "Cousin Cup";
    if (!on()) return needSync();
    A().main.innerHTML = '<h1>🏆 Cousin Cup</h1><p class="muted">Loading…</p>';
    rpc("my_cups", { p_family: fid() }).then(function (l) {
      l = Array.isArray(l) ? l : []; cache(l);
      A().main.innerHTML = '<h1>🏆 Cousin Cup</h1><p class="muted">A shared stamp goal for several families. Every family\'s new stamps add to one team total. No scores for anyone, just the team.</p>' +
        (l.length ? l.map(function (c) { return '<a class="panel cupcard" href="#/cup/' + esc(c.code) + '"><h3>' + esc(c.name) + '</h3>' + bar(c) + '<span class="small muted">' + (c.families || []).length + ' ' + ((c.families || []).length === 1 ? "family" : "families") + '</span></a>'; }).join("") : "") +
        '<div class="panel"><h3>Host a Cousin Cup</h3><div class="field"><label for="cupname">Name</label><input id="cupname" maxlength="40" value="Cousin Cup"></div>' +
        '<div class="pcrow"><div class="field"><label for="cupgoal">Team goal (stamps)</label><input id="cupgoal" type="number" min="5" max="2000" value="50"></div>' +
        '<div class="field"><label for="cupend">Ends (optional)</label><input id="cupend" type="date" min="' + M().today() + '"></div></div>' +
        '<p class="small muted">Stamps count from today. Invite the other families with a code.</p><div class="actions"><button type="button" class="btn btn-primary" id="cupmake">Start the cup</button></div></div>' +
        '<div class="panel"><h3>Join one</h3><div class="field"><label for="cupcode">Code</label><input id="cupcode" maxlength="9" autocapitalize="characters" placeholder="e.g. ABCD2345"></div><div class="actions"><button type="button" class="btn btn-ghost" id="cupjoin">Join</button></div></div>';
      var $ = function (q) { return A().main.querySelector(q); };
      $("#cupmake").onclick = function () {
        rpc("create_cup", { p_family: fid(), p_name: $("#cupname").value, p_goal: +$("#cupgoal").value || 50, p_ends: $("#cupend").value || null })
          .then(function (c) { cache([c].concat(cached())); location.hash = "#/cup/" + c.code; }).catch(fail);
      };
      $("#cupjoin").onclick = function () { var c = normCode($("#cupcode").value); if (!isCode(c)) { A().toast("Codes are 8 letters and numbers"); return; } location.hash = "#/cup/join/" + c; };
    }).catch(function (e) { if (missing(e)) soon(); else { A().main.innerHTML = '<h1>🏆 Cousin Cup</h1>'; fail(e); } });
  }
  function show(code) {
    document.title = "Cousin Cup";
    if (!on()) return needSync();
    A().main.innerHTML = '<a class="back" href="#/cup">← Cousin Cup</a><h1>🏆 Cousin Cup</h1><p class="muted">Loading…</p>';
    var c0 = cached().filter(function (c) { return c.code === code; })[0];
    (c0 ? rpc("cup_report", { p_cup: c0.id, p_family: fid(), p_stamps: mine(c0) }).catch(function () {}) : Promise.resolve()).then(function () {
      return rpc("cup_status", { p_code: code, p_family: fid() });
    }).then(function (c) {
      if (!c) { A().main.innerHTML = '<a class="back" href="#/cup">← Cousin Cup</a><h1>🏆 Cousin Cup</h1><p>Your family isn\'t in this cup. <a href="#/cup/join/' + esc(code) + '">Join it</a>?</p>'; return; }
      if (!c0) { lastReport = 0; rpc("cup_report", { p_cup: c.id, p_family: fid(), p_stamps: mine(c) }).catch(function () {}); }
      cache([c].concat(cached().filter(function (x) { return x.id !== c.id; })));
      var link = (window.FS_BRAND ? window.FS_BRAND.appUrl() : location.href.replace(/#.*$/, "")) + "#/cup/join/" + c.code, g = progress(c.total, c.goal);
      A().main.innerHTML = '<a class="back" href="#/cup">← Cousin Cup</a><h1>🏆 ' + esc(c.name) + '</h1>' +
        '<div class="panel cupbig' + (g.done ? " done" : "") + '">' + bar(c) + '<p class="small muted">Counting stamps since ' + esc(M().prettyDate(String(c.starts_on).slice(0, 10))) + (c.ends_on ? ' until ' + esc(M().prettyDate(String(c.ends_on).slice(0, 10))) : "") + '. Every family\'s new stamps count toward the team.</p></div>' +
        '<h3>On the team</h3><div class="cupteam">' + (c.families || []).map(function (f) { return '<span class="chip">' + esc(f) + '</span>'; }).join("") + '</div>' +
        '<div class="panel"><h3>Invite another family</h3><p>Code: <b class="cupcode">' + esc(c.code) + '</b></p><p class="small muted">They open the link (or enter the code on their Cousin Cup page) from inside their own Family Sync.</p>' +
        '<div class="actions"><button type="button" class="btn btn-primary" id="cupshare">📤 Share the invite</button></div></div>' +
        '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" id="cupleave">Leave this cup</button></div>';
      A().main.querySelector("#cupshare").onclick = function () {
        var t = "Join our " + c.name + " on " + (window.FS_BRAND ? window.FS_BRAND.NAME : "Famstamp") + "! Code " + c.code + ".";
        if (navigator.share) navigator.share({ title: c.name, text: t, url: link }).catch(function () {}); else (navigator.clipboard ? navigator.clipboard.writeText(t + " " + link) : Promise.reject()).then(function () { A().toast("Invite copied"); }, function () { prompt("Copy the invite", t + " " + link); });
      };
      A().main.querySelector("#cupleave").onclick = function () {
        if (!confirm("Leave " + c.name + "? Your family's stamps stop counting toward it.")) return;
        rpc("leave_cup", { p_cup: c.id, p_family: fid() }).then(function () { return cache(cached().filter(function (x) { return x.id !== c.id; })); }).then(function () { location.hash = "#/cup"; }).catch(fail);
      };
    }).catch(function (e) { if (missing(e)) soon(); else fail(e); });
  }
  function join(code) {
    code = normCode(code); document.title = "Join a Cousin Cup";
    if (!on()) return needSync(code);
    try { localStorage.removeItem("fs-cup-pending"); } catch (e) {}
    var fam = (X().cfg() || {}).familyName || "your family";
    A().main.innerHTML = '<a class="back" href="#/cup">← Cousin Cup</a><h1>🏆 Join a Cousin Cup</h1><p>Join <b>' + esc(code) + '</b> as <b>' + esc(fam) + '</b>? Your family\'s new stamps will add to the team total. Other families see your family name, not your stamps or trips.</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="cupyes">Join the team</button><a class="btn btn-ghost" href="#/">Not now</a></div>';
    A().main.querySelector("#cupyes").onclick = function () {
      rpc("join_cup", { p_code: code, p_family: fid() }).then(function (c) { cache([c].concat(cached().filter(function (x) { return x.id !== c.id; }))); lastReport = 0; A().toast("🏆 You're on the team!"); location.hash = "#/cup/" + c.code; }).catch(fail);
    };
  }
  function homeCard() {
    var pend = ""; try { pend = localStorage.getItem("fs-cup-pending") || ""; } catch (e) {}
    if (pend && on()) return '<a class="panel familycard" href="#/cup/join/' + esc(pend) + '"><span class="fam-ic" aria-hidden="true">🏆</span><span><h3>Join the Cousin Cup</h3><span class="small">You opened an invite. Tap to join the team.</span></span></a>';
    var c = cached()[0]; if (!c || !on()) return "";
    var g = progress(c.total, c.goal);
    return '<a class="panel familycard cuphome" href="#/cup/' + esc(c.code) + '"><span class="fam-ic" aria-hidden="true">🏆</span><span><h3>' + esc(c.name) + '</h3><span class="small">' + esc(g.line) + '</span></span></a>';
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) {
    if (h[0] !== "cup") return false;
    if (h[1] === "join") join(decodeURIComponent(h[2] || "")); else if (h[1]) show(normCode(decodeURIComponent(h[1]))); else home();
    return true;
  });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(homeCard);
  core.report = report;
  return core;
});
