/* v68: search (#/search), "What's new" after updates, optional stamp sound, a rate-limited "enjoying it?" prompt after happy
   moments, storage used, units and reminder-time settings. Settings live in this phone's localStorage. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_EXTRAS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NOTES = [
    { v: "v69", items: ["🎒 Homeschool field-trip log: subjects, hours and what you learned, printable as a PDF (menu, or a kid's page).", "⏳ Time capsules: notes for a kid that open on a date you pick.", "💌 Invite another family."] },
    { v: "v68", items: ["🔎 Search every trip, stamp and journal page (the 🔎 bar on Home, or 🔎 in the menu).", "↩️ Deleted something by mistake? Tap Undo on the bar that pops up.", "⚙️ Miles or kilometers, reminder time and quiet hours in Help & settings.", "🔈 Stamp sounds are now off unless you switch them on."] },
    { v: "v67", items: ["💬 Help & feedback, text size and Export everything (.zip).", "🗑️ Family organizers can delete their account and data in the app."] }
  ];
  // ---------- pure helpers ----------
  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); }
  /** Every piece of text in a trip a person typed or picked (title, places, memories, journal pages), not ids or dates. */
  function tripText(t) {
    var out = [];
    (function walk(v, key, depth) {
      if (v == null || depth > 4) return;
      if (typeof v === "string") { if (!/(^id$|Id$|Ids$|At$|^date$|^endDate$|^day$|^kid$|^photo|^dataUrl$|^mark$|^kind$)/.test(key || "") && !/^data:/.test(v) && v.length < 4000) out.push(v); return; }
      if (Array.isArray(v)) { v.forEach(function (x) { walk(x, key, depth + 1); }); return; }
      if (typeof v === "object") Object.keys(v).forEach(function (k) { if (!/^(photos?|art|drawing|story)$/.test(k) || k === "story") walk(v[k], k, depth + 1); });
    })(t, "", 0);
    return out.join(" \u2022 ");
  }
  function snippet(text, q, n) {
    var i = norm(text).indexOf(q); n = n || 90; if (i < 0) return text.slice(0, n);
    var a = Math.max(0, i - 30), s = text.slice(a, a + n); return (a ? "…" : "") + s + (a + n < text.length ? "…" : "");
  }
  /** Search people, trips (incl. journal pages) and stamps. names = { state(id), place(id), park(id) } -> display name. */
  function search(q, kids, trips, names) {
    q = norm(q); var res = { people: [], trips: [], stamps: [] }; if (q.length < 2) return res;
    var words = q.split(" ");
    var hit = function (s) { var n = norm(s); return words.every(function (w) { return n.indexOf(w) >= 0; }); };
    (kids || []).forEach(function (k) { if (hit(k.name)) res.people.push({ id: k.id, name: k.name }); });
    (trips || []).forEach(function (t) {
      var txt = tripText(t); if (!hit(txt + " " + (t.date || ""))) return;
      res.trips.push({ id: t.id, kid: (t.kidIds || [])[0] || "", title: t.title || t.place || "Trip", date: t.date || "", snip: snippet(txt, words[0]) });
    });
    res.trips.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var seen = {};
    (kids || []).forEach(function (k) {
      [["state", k.states], ["place", k.places], ["park", k.parks]].forEach(function (g) {
        Object.keys(g[1] || {}).forEach(function (id) {
          var nm = (names && names[g[0]] ? names[g[0]](id) : id) || id;
          if (!hit(nm + " " + id)) return;
          var key = g[0] + ":" + id; if (!seen[key]) { seen[key] = { kind: g[0], id: id, name: nm, who: [] }; res.stamps.push(seen[key]); }
          seen[key].who.push({ id: k.id, name: k.name });
        });
      });
    });
    res.stamps.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return res;
  }
  /** Should we ask "enjoying it?" now? Rules: 7+ days after first use, 90 days between asks, at most 3 asks, never after "rated" or "no". */
  function shouldAsk(st, now) {
    st = st || {}; now = now || Date.now();
    if (st.done || (st.asks || 0) >= 3 || !st.first) return false;
    if (now - st.first < 7 * 864e5) return false;
    if (st.last && now - st.last < 90 * 864e5) return false;
    return true;
  }
  function notesSince(seen) {   // notes newer than the version this phone last saw
    var n = function (v) { return parseInt(String(v || "").replace(/\D/g, ""), 10) || 0; };
    return NOTES.filter(function (x) { return n(x.v) > n(seen); });
  }
  function fmtBytes(b) { return b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB"; }

  if (typeof document === "undefined") return { search: search, tripText: tripText, norm: norm, shouldAsk: shouldAsk, notesSince: notesSince, fmtBytes: fmtBytes, NOTES: NOTES };

  // ---------- browser ----------
  function ls(k, v) { try { if (arguments.length > 1) { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } return localStorage.getItem(k); } catch (e) { return null; } }
  function lj(k, v) { if (arguments.length > 1) return ls(k, JSON.stringify(v)); try { return JSON.parse(ls(k) || "null"); } catch (e) { return null; } }
  function A() { return window.MLTL_APP; }
  function B() { return window.FS_BRAND || { NAME: "Famstamp", CONTACT: {}, PAGES: {} }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function soundOn() { return ls("fs-sound") === "on"; }
  function track(k) { if (window.FS_LAUNCH && window.FS_LAUNCH.track) window.FS_LAUNCH.track(k); }

  // first-use date for the rating prompt
  var rate = lj("fs-rate") || {}; if (!rate.first) { rate.first = Date.now(); lj("fs-rate", rate); }

  // ---------- search ----------
  function names() { var a = A(); return { state: function (id) { return a.placeName("state", id); }, place: function (id) { return a.placeName("place", id); }, park: function (id) { return a.placeName("park", id); } }; }
  var lastQ = "";
  function searchView() {
    var a = A();
    a.main.innerHTML = '<a class="back" href="#/">← Home</a><h1>🔎 Search</h1>' +
      '<div class="field"><label for="sq" class="sr">Search trips, stamps, journal pages and people</label><input id="sq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search trips, stamps, journals…" value="' + esc(lastQ) + '"></div>' +
      '<div id="sres" aria-live="polite"></div>';
    var inp = document.getElementById("sq"), out = document.getElementById("sres"), t;
    var draw = function () {
      lastQ = inp.value; var q = inp.value.trim();
      if (q.length < 2) { out.innerHTML = a.state.trips.length || a.state.kids.length ? '<p class="muted small">Type a place, a trip name, or something someone wrote in a journal, e.g. "pancakes" or "Utah".</p>' : '<div class="empty panel"><p>Nothing to search yet.</p><p class="small muted">Add a person and a trip, and everything you write shows up here.</p><a class="btn btn-primary" href="#/">Get started</a></div>'; return; }
      var r = search(q, a.state.kids, a.state.trips, names()), n = r.people.length + r.trips.length + r.stamps.length;
      if (!n) { out.innerHTML = '<p class="muted">No matches for “' + esc(q) + '”. Try fewer letters or another word.</p>'; return; }
      out.innerHTML = '<p class="small muted">' + n + (n === 1 ? " match" : " matches") + '</p>' +
        (r.people.length ? '<h2>People</h2><ul class="sresl">' + r.people.map(function (p) { return '<li><a href="#/p/' + esc(p.id) + '">' + esc(p.name) + '</a></li>'; }).join("") + '</ul>' : "") +
        (r.trips.length ? '<h2>Trips and journals</h2><ul class="sresl">' + r.trips.slice(0, 60).map(function (x) { return '<li><a href="#/p/' + esc(x.kid) + '/trip/' + esc(x.id) + '"><b>' + esc(x.title) + '</b> <span class="muted small">' + esc(x.date) + '</span><br><span class="small">' + esc(x.snip) + '</span></a></li>'; }).join("") + '</ul>' : "") +
        (r.stamps.length ? '<h2>Stamps</h2><ul class="sresl">' + r.stamps.slice(0, 60).map(function (s) { return '<li><a href="#/p/' + esc(s.who[0].id) + '/passport">' + esc(s.name) + '</a> <span class="muted small">' + esc(s.who.map(function (w) { return w.name; }).join(", ")) + '</span></li>'; }).join("") + '</ul>' : "");
    };
    inp.oninput = function () { clearTimeout(t); t = setTimeout(draw, 120); };
    draw(); setTimeout(function () { inp.focus(); }, 50);
    track("search:open");
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "search") return false; searchView(); return true; });
  document.addEventListener("keydown", function (e) { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); location.hash = "#/search"; } });

  // ---------- What's new ----------
  function whatsNew() {
    var a = A(), main = a && a.main; if (!main || !/^#?\/?$/.test(location.hash)) return;
    var seen = ls("fs-seen-version");
    if (!seen) { ls("fs-seen-version", a.version); return; }   // first install: nothing to announce
    if (seen === a.version || main.querySelector(".whatsnew")) return;
    var notes = notesSince(seen); if (!notes.length) { ls("fs-seen-version", a.version); return; }
    var el = document.createElement("div"); el.className = "panel whatsnew"; el.setAttribute("role", "status");
    el.innerHTML = '<h3>What\'s new in ' + esc(B().NAME) + '</h3><ul>' + notes.map(function (n) { return n.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join(""); }).join("") + '</ul><button type="button" class="btn btn-ghost btn-sm">Got it</button>';
    el.querySelector("button").onclick = function () { ls("fs-seen-version", a.version); el.remove(); };
    main.insertBefore(el, main.firstChild);
  }
  // ---------- rating prompt after happy moments ----------
  var stampsThisSession = 0;
  function maybeAsk(reason) {
    var st = lj("fs-rate") || {}; if (!shouldAsk(st)) return;
    st.asks = (st.asks || 0) + 1; st.last = Date.now(); lj("fs-rate", st);
    var C = B().CONTACT || {}, store = B().RATE_URL || "";
    var el = document.createElement("div"); el.className = "undotoast ratebar"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Enjoying " + B().NAME + "?");
    el.innerHTML = '<span>Enjoying ' + esc(B().NAME) + '? 🎉</span><button type="button" data-r="yes" class="undobtn">' + (store ? "Rate it" : "Yes!") + '</button><button type="button" data-r="meh" class="undobtn">Not really</button><button type="button" class="undox" aria-label="Not now">✕</button>';
    document.body.appendChild(el); track("rate:ask:" + reason);
    el.onclick = function (e) {
      var r = e.target.getAttribute("data-r"); if (!r && !e.target.classList.contains("undox")) return;
      el.remove(); var s2 = lj("fs-rate") || {};
      if (r === "yes") { s2.done = "yes"; lj("fs-rate", s2); track("rate:yes"); if (store) window.open(store, "_blank", "noopener"); else A().toast("Thank you! That made our day."); }
      else if (r === "meh") { s2.done = "no"; lj("fs-rate", s2); track("rate:no"); location.href = "mailto:" + C.support + "?subject=" + encodeURIComponent(B().NAME + " could be better"); }
    };
    setTimeout(function () { el.remove(); }, 15000);
  }
  document.addEventListener("fs:stamp", function () {
    stampsThisSession++;
    var a = A(), total = 0; (a.state.kids || []).forEach(function (k) { total += Object.keys(k.states || {}).length + Object.keys(k.places || {}).length + Object.keys(k.parks || {}).length; });
    if (total >= 10) setTimeout(function () { maybeAsk("stamps"); }, 3500);
  });

  // ---------- settings panel (shown on Help) ----------
  function settingsHTML() {
    var a = A(), m = a.state.meta || {}, units = m.units === "km" ? "km" : "mi", temp = m.tempUnit === "C" || m.tempUnit === "F" ? m.tempUnit : units === "km" ? "C" : "F";
    var push = lj("fs-push-times") || {}, hour = push.hour == null ? 9 : push.hour;
    var hours = function (sel, id) { var o = ""; for (var h = 0; h < 24; h++) o += '<option value="' + h + '"' + (h === sel ? " selected" : "") + '>' + ((h % 12) || 12) + (h < 12 ? " AM" : " PM") + '</option>'; return '<select id="' + id + '">' + o + '</select>'; };
    return '<div class="panel" id="xsettings"><h2>Settings</h2>' +
      '<p class="small"><b>Distance</b></p><div class="seg" role="group" aria-label="Distance units"><button type="button" data-xunits="mi" aria-pressed="' + (units === "mi") + '">Miles</button><button type="button" data-xunits="km" aria-pressed="' + (units === "km") + '">Kilometers</button></div>' +
      '<p class="small"><b>Temperature</b></p><div class="seg" role="group" aria-label="Temperature"><button type="button" data-xtemp="F" aria-pressed="' + (temp === "F") + '">°F</button><button type="button" data-xtemp="C" aria-pressed="' + (temp === "C") + '">°C</button></div>' +
      '<label class="chk"><input type="checkbox" id="xsound"' + (soundOn() ? " checked" : "") + '> Play a little sound when a stamp lands (off unless you turn it on; the haptic buzz still works)</label>' +
      '<h3>Notifications</h3><p class="small muted">Turn notifications on and pick which ones on the Family Sync page. Times use this phone\'s time zone.</p>' +
      '<div class="field"><label for="xhour">Send reminders and recaps at</label>' + hours(hour, "xhour") + '</div>' +
      '<label class="chk"><input type="checkbox" id="xquiet"' + (push.quiet ? " checked" : "") + '> Quiet hours (no notifications)</label>' +
      '<div class="xquiet"' + (push.quiet ? "" : " hidden") + '><div class="field"><label for="xqs">From</label>' + hours(push.qs == null ? 20 : push.qs, "xqs") + '</div><div class="field"><label for="xqe">Until</label>' + hours(push.qe == null ? 7 : push.qe, "xqe") + '</div></div>' +
      '<p class="small" id="xstore">Storage: checking…</p></div>';
  }
  function bindSettings(redraw) {
    var a = A(), $ = function (s) { return document.querySelector(s); };
    Array.prototype.forEach.call(document.querySelectorAll("[data-xunits]"), function (b) { b.onclick = function () { a.setMeta("units", b.dataset.xunits).then(redraw); }; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-xtemp]"), function (b) { b.onclick = function () { a.setMeta("tempUnit", b.dataset.xtemp).then(redraw); }; });
    $("#xsound").onchange = function (e) { ls("fs-sound", e.target.checked ? "on" : null); };
    var savePush = function () {
      var p = { hour: +$("#xhour").value, quiet: $("#xquiet").checked, qs: +$("#xqs").value, qe: +$("#xqe").value };
      lj("fs-push-times", p); document.querySelector(".xquiet").hidden = !p.quiet;
      if (window.FS_PUSH && window.FS_PUSH.saveTimes) window.FS_PUSH.saveTimes(p);
    };
    ["#xhour", "#xquiet", "#xqs", "#xqe"].forEach(function (s) { $(s).onchange = savePush; });
    storage().then(function (t) { var el = $("#xstore"); if (el) el.innerHTML = t; });
  }
  function storage() {
    var a = A();
    return a.all("photos").then(function (ph) {
      var bytes = 0; ph.forEach(function (p) { bytes += (p.dataUrl || "").length * 0.75; });
      var est = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null);
      return est.then(function (e) {
        var used = e && e.usage ? e.usage : 0, quota = e && e.quota ? e.quota : 0, pct = quota ? Math.min(100, Math.round(used / quota * 100)) : 0;
        return '<b>Storage used:</b> ' + fmtBytes(used || bytes) + (quota ? " of " + fmtBytes(quota) + " this browser allows" : "") + (ph.length ? '. Photos: ' + ph.length + ' (' + fmtBytes(bytes) + '). Photos are shrunk when you add them, so they take little space.' : '. No photos yet.') +
          (quota ? '<span class="meter" role="meter" aria-label="Storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + Math.max(2, pct) + '%"></span></span>' : "");
      });
    }).catch(function () { return "Storage: couldn't check."; });
  }
  function injectHelp() {
    var a = A(); if (!a || !/^#\/help/.test(location.hash) || document.getElementById("xsettings")) return;
    var anchor = a.main.querySelector(".panel:nth-of-type(2)"); if (!anchor) return;
    var div = document.createElement("div"); div.innerHTML = settingsHTML(); anchor.parentNode.insertBefore(div.firstChild, anchor.nextSibling);
    bindSettings(function () { var x = document.getElementById("xsettings"); if (x) x.remove(); injectHelp(); });
  }
  // On narrow phones the header is full, so Home and Trips also get a search bar (only once there's something to search).
  function homeSearch() {
    var a = A(); if (!a || !a.main || a.main.querySelector(".homesearch")) return;
    var hh = location.hash; if (!(/^#?\/?$/.test(hh) || /^#\/p\/[^/]+\/trips$/.test(hh) || hh === "#/trips")) return;
    if (!(a.state.trips || []).length) return;
    var el = document.createElement("a"); el.className = "homesearch"; el.href = "#/search";
    el.innerHTML = '<span aria-hidden="true">🔎</span> Search trips, stamps and journals';
    var w = a.main.querySelector(".whatsnew"); a.main.insertBefore(el, w ? w.nextSibling : a.main.firstChild);
  }
  function after() { setTimeout(function () { whatsNew(); homeSearch(); injectHelp(); }, 0); }
  window.addEventListener("hashchange", after);
  var mo = new MutationObserver(function () { after(); });
  var start = function () { var m = document.getElementById("main") || (A() && A().main); if (m) mo.observe(m, { childList: true }); after(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);

  return { search: search, tripText: tripText, norm: norm, shouldAsk: shouldAsk, notesSince: notesSince, fmtBytes: fmtBytes, NOTES: NOTES, soundOn: soundOn, maybeAsk: maybeAsk, storage: storage };
});
