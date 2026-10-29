/* Famstamp v105: Kid mode. A grown-up hands a kid the phone: the kid gets big buttons for their own map and passport
   (look only), games, quests and Firsts. Nothing is collected from the kid: no typing, no photos, nothing saved on the
   phone (app.js put/del do nothing) and nothing sent (sync.js waits). Ending it takes the grown-up PIN; the phone then
   reloads the saved log, so whatever happened in Kid mode is simply gone. The PIN lives only on this phone, hashed. */
(function (root, factory) {
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core; else root.FS_KIDLOCK = core;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var core = {};
  var LOOK = { "": 1, us: 1, world: 1, parks: 1, passport: 1, signs: 1, badges: 1, stats: 1, quests: 1, firsts: 1 };
  /** Screens a kid may open in Kid mode (h = the hash split on "/"). Their own pages only, no editing screens. */
  function allowed(h, kid) {
    h = h || []; var a = h[0] || "";
    if (a === "kidmode") return true;
    if (a === "games") return h[1] !== "print";
    if ((a === "p" || a === "kid") && kid && h[1] === kid) { var t = (h[2] || "").split("?")[0]; return !!LOOK[t] && !h[3]; }
    return false;
  }
  function validPin(p) { return /^\d{4}$/.test(String(p || "")); }
  function fnv(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
  function slowHash(salt, pin) { var x = salt + "|" + pin; for (var i = 0; i < 2000; i++) x = fnv(x + i) + x.slice(0, 24); return fnv(x) + fnv(x + salt); }
  /** After 5 wrong PINs, wait a minute (then 2, 4... up to 15). */
  function waitAfter(n) { return n < 5 ? 0 : Math.min(15, Math.pow(2, n - 5)) * 60000; }
  core.allowed = allowed; core.validPin = validPin; core.slowHash = slowHash; core.waitAfter = waitAfter;
  if (typeof window === "undefined" || typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function jget(k) { try { return JSON.parse(ls(k) || "null"); } catch (e) { return null; } }
  ls("fs-kidmode", null);   // the old unlocked Kid mode (v60s) is gone; the new one starts from More
  function lock() { var l = jget("fs-kidlock"); return l && l.kid ? l : null; }
  function on() { return !!lock(); }
  function kid() { var l = lock(); return l ? l.kid : ""; }
  function pinSet() { var p = jget("fs-kidpin"); return !!(p && p.s && p.h); }
  function pinOk(pin) { var p = jget("fs-kidpin"); return !!(p && validPin(pin) && slowHash(p.s, pin) === p.h); }
  function setPin(pin) { var s = Math.random().toString(36).slice(2) + Date.now().toString(36); ls("fs-kidpin", JSON.stringify({ s: s, h: slowHash(s, pin) })); }
  function grownUpSignedIn() { var c = A() && A().state.meta.sync; return !!(c && c.familyId && !c.anonymous && c.role && c.role !== "kid"); }
  function people() { var ks = (A() && A().state.kids) || []; return ks.filter(function (k) { return k.role === "kid"; }).concat(ks.filter(function (k) { return k.role !== "kid"; })); }
  function nameOf(k) { return k ? k.name || "" : ""; }
  function first(k) { return String(nameOf(k) || "").split(" ")[0]; }
  function toast(m) { if (A() && A().toast) A().toast(m); }
  function redraw() { if (window.FS_NAV && window.FS_NAV.refresh) window.FS_NAV.refresh(); }

  function start(id) {
    ls("fs-kidlock", JSON.stringify({ kid: id, at: new Date().toISOString() })); ls("fs-kidtries", null);
    document.body.classList.add("kidlock"); location.hash = "#/kidmode"; redraw();
  }
  function stop() {
    ls("fs-kidlock", null); ls("fs-kidtries", null); document.body.classList.remove("kidlock");
    var a = A(); (a && a.load ? a.load() : Promise.resolve()).then(function () {   // drop anything that happened in Kid mode
      location.hash = "#/"; if (a && a.route) a.route(); redraw(); toast("Kid mode is off");
      try { if (window.MLTL_SYNC && window.MLTL_SYNC.syncNow) window.MLTL_SYNC.syncNow(); } catch (e) {}
    });
  }

  // ---- setup (a grown-up) ----
  function setupView() {
    var a = A(), ps = people(), main = a.main;
    document.title = "Kid mode · Famstamp";
    if (!ps.length) { main.innerHTML = '<a class="back" href="#/more">← More</a><h1>🧒 Kid mode</h1><div class="panel empty"><p>Add a kid first, then hand them the phone.</p><a class="btn btn-primary" href="#/add">Add someone</a></div>'; return; }
    var have = pinSet(), easy = have && grownUpSignedIn();
    main.innerHTML = '<a class="back" href="#/more">← More</a><h1>🧒 Kid mode</h1>' +
      '<div class="panel kidsetup"><p>Hand the phone to a kid. They get <b>their map and passport</b> (just to look), <b>games</b>, <b>quests</b> and <b>Firsts</b> in big buttons.</p>' +
      '<ul class="small"><li>Nothing they do is saved or sent: no typing, no photos, no sync.</li><li>Only a grown-up with the PIN can end it.</li></ul>' +
      '<h2>Who\'s playing?</h2><div class="kidpick" role="radiogroup" aria-label="Who\'s playing?">' + ps.map(function (k, i) {
        return '<button type="button" class="kidchip" role="radio" data-kpick="' + esc(k.id) + '" aria-checked="' + (i === 0) + '" style="' + (a.kidStyle ? a.kidStyle(k) : "") + '"><span class="avatar">' + (a.initial ? a.initial(k) : "") + '</span>' + esc(nameOf(k)) + '</button>';
      }).join("") + '</div>' +
      (have ? (easy ? '<p class="small muted">You\'re signed in as a grown-up, so no PIN needed to start. It still takes the PIN to end.</p>'
                    : '<div class="field"><label for="kpin">Grown-up PIN</label><input id="kpin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>')
            : '<div class="field"><label for="kpin">Make a 4-number grown-up PIN</label><input id="kpin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password"></div>' +
              '<div class="field"><label for="kpin2">Type it again</label><input id="kpin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password"></div>' +
              '<p class="small muted">Kept only on this phone. You need it to end Kid mode.</p>') +
      '<p class="err" id="kerr" hidden></p><div class="actions"><button type="button" class="btn btn-beacon big" id="kstart">Start Kid mode</button></div></div>';
    var pick = ps[0].id;
    main.querySelectorAll("[data-kpick]").forEach(function (b) { b.onclick = function () { pick = b.dataset.kpick; main.querySelectorAll("[data-kpick]").forEach(function (x) { x.setAttribute("aria-checked", x === b); }); }; });
    function err(m) { var e = document.getElementById("kerr"); e.textContent = m; e.hidden = !m; }
    document.getElementById("kstart").onclick = function () {
      var p1 = (document.getElementById("kpin") || {}).value, p2 = (document.getElementById("kpin2") || {}).value;
      if (!have) { if (!validPin(p1)) return err("The PIN is 4 numbers."); if (p1 !== p2) return err("Those two PINs don't match."); setPin(p1); }
      else if (!easy && !pinOk(p1)) return err("That's not the grown-up PIN.");
      start(pick);
    };
  }

  // ---- the kid's home ----
  function homeView() {
    var a = A(), k = a.kidById(kid()) || people()[0];
    if (!k) { stop(); return; }
    if (k.id !== kid()) ls("fs-kidlock", JSON.stringify({ kid: k.id, at: new Date().toISOString() }));
    document.title = "Kid mode · Famstamp";
    function tile(href, ic, label) { return '<a class="kidtile" href="' + href + '"><span class="ic" aria-hidden="true">' + ic + '</span><span class="tl">' + label + '</span></a>'; }
    var base = "#/p/" + esc(k.id);
    a.main.innerHTML = '<div class="kidhello" style="' + (a.kidStyle ? a.kidStyle(k) : "") + '"><span class="avatar">' + (a.initial ? a.initial(k) : "") + '</span><h1>Hi, ' + esc(first(k)) + '! 👋</h1></div>' +
      '<div class="kidtiles">' + tile(base + "/us", "🗺️", "My map") + tile(base + "/passport", "🛂", "My passport") + tile("#/games", "🎲", "Games") +
      tile(base + "/quests", "🧭", "Quests") + tile(base + "/firsts", "⭐", "My Firsts") + '</div>' +
      '<p class="small muted kidnote">Kid mode: just for looking and playing. Nothing here gets saved or shared.</p>' +
      '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-kidmode-off>🔒 Grown-up: end Kid mode</button></div>';
  }

  // ---- ending it: the PIN pad ----
  function askExit() {
    var UI = window.FS_UI; if (!UI || !UI.sheet) return;
    var typed = "";
    UI.sheet('<div class="sheethead"><h3>🔒 Grown-up PIN</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      '<div class="pindots" id="kdots" aria-live="polite">' + "○○○○" + '</div><p class="err small" id="kperr" hidden></p>' +
      '<div class="pinpad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(function (n) { return n === "" ? "<span></span>" : '<button type="button" data-pin="' + n + '" aria-label="' + (n === "⌫" ? "Delete" : n) + '">' + n + '</button>'; }).join("") + '</div>' +
      '<div class="actions"><button type="button" class="linkbtn small" id="kforgot">Forgot the PIN?</button></div>');
    var dots = document.getElementById("kdots"), perr = document.getElementById("kperr");
    function show() { dots.textContent = "●●●●".slice(0, typed.length) + "○○○○".slice(typed.length); }
    function msg(m) { perr.textContent = m; perr.hidden = !m; }
    document.querySelectorAll("[data-pin]").forEach(function (b) {
      b.onclick = function () {
        var t = jget("fs-kidtries") || { n: 0, until: 0 };
        if (t.until > Date.now()) { msg("Too many tries. Wait " + Math.ceil((t.until - Date.now()) / 60000) + " min."); return; }
        var v = b.dataset.pin; if (v === "⌫") typed = typed.slice(0, -1); else if (typed.length < 4) typed += v; show();
        if (typed.length < 4) return;
        if (pinOk(typed)) { UI.closeSheet(); stop(); return; }
        t.n++; t.until = Date.now() + waitAfter(t.n); ls("fs-kidtries", JSON.stringify(t)); typed = ""; show();
        msg(t.n >= 5 ? "Too many tries. Wait " + Math.ceil(waitAfter(t.n) / 60000) + " min." : "Not quite. Try again.");
      };
    });
    document.getElementById("kforgot").onclick = forgot;
  }
  // Forgot the PIN: a grown-up check (a times table a young kid won't know, then hold a button 5 seconds). It ends Kid
  // mode and clears the PIN, so a new one is made next time. Nothing in the log is touched.
  function forgot() {
    var UI = window.FS_UI, x = 12 + Math.floor(Math.random() * 7), y = 6 + Math.floor(Math.random() * 4);
    UI.sheet('<div class="sheethead"><h3>Grown-up check</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
      '<p>What is ' + x + ' × ' + y + '?</p><div class="field"><input id="kmath" type="text" inputmode="numeric" autocomplete="off" aria-label="Answer"></div>' +
      '<p class="small muted">Then press and hold the button for 5 seconds. This ends Kid mode and clears the PIN on this phone.</p>' +
      '<p class="err small" id="kferr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="khold">Hold to end Kid mode</button></div>');
    var b = document.getElementById("khold"), t = null, e2 = document.getElementById("kferr");
    function down(ev) { ev.preventDefault(); if (+document.getElementById("kmath").value !== x * y) { e2.textContent = "That's not it."; e2.hidden = false; return; } b.textContent = "Keep holding…"; t = setTimeout(function () { ls("fs-kidpin", null); UI.closeSheet(); stop(); }, 5000); }
    function up() { if (t) { clearTimeout(t); t = null; b.textContent = "Hold to end Kid mode"; } }
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up); b.addEventListener("pointercancel", up);
  }

  // ---- while it's on ----
  // nav.js calls this first thing on every screen change (nav.js loads last, so its route check runs first).
  function guard(h) {
    if (h[0] === "kidsetup") { if (on()) { location.replace("#/kidmode"); return true; } setupView(); return true; }
    if (!on()) { if (h[0] === "kidmode") { location.replace("#/"); return true; } return false; }
    document.body.classList.add("kidlock");
    if (!allowed(h, kid())) { location.replace("#/kidmode"); return true; }
    if (h[0] === "kidmode") { homeView(); return true; }
    return false;
  }
  // No typing, no photos, no changing the map: typed fields and file pickers are switched off, taps on map places and
  // check boxes do nothing. Games keep their own buttons (their scores aren't saved).
  var BLOCK = "[data-kind], [data-jr], input, textarea, select, label, [contenteditable], [data-edit], [data-rm]";
  document.addEventListener("click", function (e) {
    if (!on() || !e.target.closest) return;
    var main = A() && A().main; if (!main || !main.contains(e.target)) return;
    if (/^#\/?games/.test(location.hash)) { if (!e.target.closest("input[type=file], textarea, input[type=text]")) return; }
    if (e.target.closest("[data-kidmode-off], .kidtile, .kidchip")) return;
    var hit = e.target.closest(BLOCK); if (!hit) return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  function lockFields() {
    if (!on()) return; var main = A() && A().main; if (!main) return;
    main.querySelectorAll("input, textarea, select, [contenteditable]").forEach(function (el) { if (el.getAttribute("contenteditable")) el.setAttribute("contenteditable", "false"); else el.disabled = true; });
    main.querySelectorAll("input[type=file]").forEach(function (el) { el.hidden = true; });
  }
  var mo = new MutationObserver(function () { lockFields(); });
  function boot() {
    var tries = 0; (function wait() {
      if (A() && A().main) {
        mo.observe(A().main, { childList: true, subtree: true });
        if (on()) { document.body.classList.add("kidlock"); var h = location.hash.replace(/^#\/?/, "").split("/"); if (!allowed(h, kid())) location.replace("#/kidmode"); lockFields(); }
      } else if (tries++ < 100) setTimeout(wait, 50);
    })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);
  core.guard = guard; core.on = on; core.kid = kid; core.askExit = askExit; core.start = start; core.pinSet = pinSet;
  return core;
});
