/* Famstamp grouped pick lists (countries by continent, states by region, parks by region): collapsible groups whose open/closed
   state is remembered per person on this device, plus a fast search (debounced, accent-insensitive, alternate names like "UK" or
   "Holland") that hides empty groups, opens groups with matches, highlights the match and never re-renders or moves the page.
   Also shared by the map's "Jump to" box (mapzoom.js). No network, no timers except the search debounce. */
(function () {
  "use strict";
  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f\u02bb\u02bc'’.]/g, "").toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim(); }
  // Alternate names people actually type. Keys are shape ids (ISO3, UK nations, US states).
  var ALIAS = {
    GBR: "uk united kingdom great britain britain gb", ENG: "uk britain great britain gb", SCT: "uk britain great britain gb alba", WLS: "uk britain great britain gb cymru", NIR: "uk britain ni ulster",
    NLD: "holland the netherlands dutch", USA: "us usa america united states of america", ARE: "uae emirates dubai abu dhabi", CZE: "czech republic czechia",
    CIV: "ivory coast cote divoire", MMR: "burma", SWZ: "swaziland eswatini", MKD: "macedonia", IRN: "persia", KOR: "south korea korea", PRK: "north korea",
    VAT: "vatican holy see", COD: "drc congo kinshasa democratic republic of the congo", COG: "congo brazzaville republic of the congo", TUR: "turkey turkiye",
    TLS: "east timor", CPV: "cape verde cabo verde", IRL: "eire ireland republic of ireland", DEU: "germany deutschland", ESP: "spain espana", CHE: "switzerland swiss schweiz",
    AUT: "austria osterreich", GRC: "greece hellas", CHN: "china prc", TWN: "taiwan roc", RUS: "russia russian federation", BLR: "belarus byelorussia",
    LKA: "sri lanka ceylon", THA: "thailand siam", BIH: "bosnia herzegovina", DOM: "dominican republic dr", CAF: "car central african republic",
    VNM: "vietnam viet nam", LAO: "laos", SYR: "syria", BHS: "bahamas", GMB: "gambia", FSM: "micronesia", PSX: "palestine", XKX: "kosovo", KOS: "kosovo",
    JPN: "japan nippon", MEX: "mexico", BRA: "brazil brasil", ISL: "iceland island", GRL: "greenland kalaallit nunaat", PRI: "puerto rico pr"
  };
  function alias(id) { return ALIAS[id] || ""; }
  // Highlight q inside text (accent-insensitive). Returns escaped HTML.
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function highlight(text, q) {
    if (!q) return esc(text);
    var map = [], n = "";
    for (var i = 0; i < text.length; i++) { var c = norm(text[i]); if (text[i] === " ") c = " "; for (var j = 0; j < c.length; j++) { n += c[j]; map.push(i); } }
    var at = n.indexOf(q); if (at < 0) return esc(text);
    var a = map[at], b = map[at + q.length - 1] + 1;
    return esc(text.slice(0, a)) + "<mark>" + esc(text.slice(a, b)) + "</mark>" + esc(text.slice(b));
  }
  function load(key) { try { return JSON.parse(localStorage.getItem("fs-plist:" + key) || "null"); } catch (e) { return null; } }
  function save(key, v) { try { localStorage.setItem("fs-plist:" + key, JSON.stringify(v)); } catch (e) {} }

  /** Wire up one list. root: element with data-plist="<key>"; input: its search box. defaultOpen: groups start open. */
  function bind(root, input, defaultOpen) {
    if (!root || root.__pl) return; root.__pl = true;
    var key = root.dataset.plist, saved = load(key) || {};
    var groups = Array.prototype.map.call(root.querySelectorAll(".pgrp"), function (g) {
      var rows = Array.prototype.map.call(g.querySelectorAll("[data-name]"), function (r) {
        var hl = r.querySelector("[data-hl]");
        return { el: r, name: norm(r.dataset.name), hl: hl, text: hl ? hl.textContent : "" };
      });
      return { el: g, id: g.dataset.g, btn: g.querySelector(".pgh"), body: g.querySelector(".pgb"), m: g.querySelector(".pgm"), rows: rows };
    });
    var none = root.querySelector(".plist-none"), q = "", t = null;
    function isOpen(g) { return saved[g.id] == null ? !!defaultOpen : !saved[g.id]; }
    function show(g, open) { g.btn.setAttribute("aria-expanded", String(open)); g.body.hidden = !open; g.el.classList.toggle("closed", !open); }
    function apply() {
      var total = 0;
      groups.forEach(function (g) {
        if (!q) {
          g.el.hidden = false; g.m.hidden = true; show(g, isOpen(g));
          g.rows.forEach(function (r) { r.el.hidden = false; if (r.hl && r.hl.__h) { r.hl.textContent = r.text; r.hl.__h = false; } });
          return;
        }
        var n = 0;
        g.rows.forEach(function (r) {
          var hit = r.name.indexOf(q) >= 0; r.el.hidden = !hit; if (hit) n++;
          if (r.hl) { r.hl.innerHTML = hit ? highlight(r.text, q) : esc(r.text); r.hl.__h = true; }
        });
        total += n; g.el.hidden = !n; g.m.hidden = !n; g.m.textContent = n + (n === 1 ? " match" : " matches"); show(g, n > 0);
      });
      if (none) none.hidden = !q || total > 0;
      root.classList.toggle("searching", !!q);
    }
    function setQ(v) { q = norm(v); apply(); }
    groups.forEach(function (g) {
      g.btn.addEventListener("click", function () {
        var open = g.btn.getAttribute("aria-expanded") !== "true";
        show(g, open);
        if (!q) { saved[g.id] = !open; save(key, saved); }
      });
    });
    root.querySelectorAll("[data-pl]").forEach(function (b) {
      b.addEventListener("click", function () {
        var open = b.dataset.pl === "expand";
        groups.forEach(function (g) { saved[g.id] = !open; });
        save(key, saved);
        if (input && input.value) { input.value = ""; q = ""; }
        apply();
      });
    });
    if (input) {
      // typed input is debounced; programmatic input (e.g. restoring the box after a re-render) applies at once so nothing flickers
      input.addEventListener("input", function (e) { clearTimeout(t); if (!e.isTrusted) return setQ(input.value); t = setTimeout(function () { setQ(input.value); }, 110); });
      input.addEventListener("search", function () { clearTimeout(t); setQ(input.value); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && input.value) { input.value = ""; setQ(""); e.preventDefault(); }
        // Enter (or Search/Go on a phone keyboard): filter now and jump to the first match, ready to tap or press Enter again
        if (e.key === "Enter") {
          e.preventDefault(); clearTimeout(t); setQ(input.value); if (!q) return;
          var first = null; groups.some(function (g) { return g.rows.some(function (r) { if (!r.el.hidden) { first = r.el; return true; } }); });
          if (!first) return;
          var btn = first.querySelector("button, [role=button], a, input");
          first.scrollIntoView({ block: "center" });
          if (btn) btn.focus({ preventScroll: true });
        }
      });
    }
    setQ(input ? input.value : "");
    return { set: setQ, groups: groups };
  }
  /** HTML for a group. id: stable group id; name; visited, total; rowsHTML. */
  function group(id, name, visited, total, rowsHTML) {
    var gid = "pg-" + String(id).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return '<section class="pgrp" data-g="' + esc(id) + '"><h3 class="pgt"><button type="button" class="pgh" aria-expanded="true" aria-controls="' + gid + '">' +
      '<span class="pgn">' + esc(name) + '</span><span class="pgc">' + (total != null ? "visited " + visited + " of " + total : "") + '</span><span class="pgm" hidden></span><span class="chev" aria-hidden="true"></span></button></h3>' +
      '<div class="pgb" id="' + gid + '">' + rowsHTML + '</div></section>';
  }
  function tools(fieldHTML) {
    return '<div class="plist-tools">' + fieldHTML + '<div class="plist-btns"><button type="button" class="linkbtn" data-pl="expand">Expand all</button><button type="button" class="linkbtn" data-pl="collapse">Collapse all</button></div></div>' +
      '<p class="plist-none muted" hidden>No matches. Try another spelling.</p>';
  }
  // US Census regions, used to group states and parks.
  var REGION = {};
  [["Northeast", "CT ME MA NH RI VT NJ NY PA"], ["Midwest", "IL IN MI OH WI IA KS MN MO NE ND SD"], ["South", "DE DC FL GA MD NC SC VA WV AL KY MS TN AR LA OK TX"],
   ["West", "AZ CO ID MT NV NM UT WY AK CA HI OR WA"], ["Territories", "AS VI PR GU MP"]].forEach(function (r) { r[1].split(" ").forEach(function (s) { REGION[s] = r[0]; }); });
  window.FS_FIND = { norm: norm, alias: alias, highlight: highlight, bind: bind, group: group, tools: tools, REGION: REGION, REGIONS: ["Northeast", "Midwest", "South", "West", "Territories"] };
})();
