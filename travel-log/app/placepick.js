/* Famstamp 1.5: the "Where?" place pickers (add a passport stamp, color in a place from a trip) become a searchable list grouped by
   continent / US region, in a bottom sheet on phones and a dialog on bigger screens. Tap a place to choose it.
   It is a layer over the page's own <select>: the select stays in the form (hidden) and is what the app reads, so the screens that
   build these forms (trips-ui.js) don't change. Closes with X, a tap outside, Escape or the phone's Back. No network, no timers. */
(function () {
  "use strict";
  var FF = function () { return window.FS_FIND; };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var UK = { ENG: 1, SCT: 1, WLS: 1, NIR: 1 };
  // Which selects get the picker: any <select> of place values (place:XXX, state:XX, park:xxx) with a long list.
  function isPlaceSelect(sel) {
    if (sel.__ppk || sel.multiple) return false;
    var o = sel.options, n = 0;
    for (var i = 0; i < o.length; i++) if (/^(place|state|park):/.test(o[i].value)) n++;
    return n >= 12;
  }
  function info(kind, id) {
    var MAPS = window.MLTL_MAPS || {}, M = window.MLTL || {};
    if (kind === "place") {
      if (UK[id]) return { cont: "Europe" };
      var c = MAPS.world && MAPS.world.countries.filter(function (x) { return x.id === id; })[0];
      return { cont: c ? c.cont : "Other places" };
    }
    if (kind === "state") return { region: FF().REGION[id] || "Other" };
    var p = (M.PARKS || []).filter(function (x) { return x.id === id; })[0];
    var st = p ? p.states.split(/,\s*/)[0] : "";
    return { region: FF().REGION[st] || "West", states: p ? p.states : "" };
  }
  function contOrder() {
    var MAPS = window.MLTL_MAPS || {}, seen = [];
    ((MAPS.world && MAPS.world.countries) || []).forEach(function (c) { if (seen.indexOf(c.cont) < 0) seen.push(c.cont); });
    return seen.concat(["Other places"]);
  }
  // Build groups from the select's options.
  function model(sel) {
    var opts = Array.prototype.slice.call(sel.options), kinds = {}, lead = [], items = [];
    opts.forEach(function (o) {
      var m = /^(place|state|park):(.+)$/.exec(o.value);
      if (!m) { lead.push(o); return; }
      kinds[m[1]] = 1; items.push({ o: o, kind: m[1], id: m[2], name: o.textContent.trim() });
    });
    var mixed = Object.keys(kinds).length > 1, groups = {}, order = [];
    items.forEach(function (it) {
      var inf = info(it.kind, it.id), g;
      if (it.kind === "place") g = inf.cont;
      else if (it.kind === "state") g = mixed ? "US states" : inf.region;
      else g = mixed ? "National parks" : inf.region;
      it.extra = it.kind === "park" ? inf.states : "";
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(it);
    });
    var pref = contOrder().concat(FF().REGIONS, ["US states", "National parks"]);
    order.sort(function (a, b) { return pref.indexOf(a) - pref.indexOf(b); });
    return { lead: lead, order: order, groups: groups, key: "pick:" + Object.keys(kinds).sort().join("+") };
  }
  function labelFor(sel) {
    var l = sel.id && document.querySelector('label[for="' + sel.id + '"]');
    if (!l) return "Choose a place";
    var c = l.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll(".muted,.small"), function (x) { x.remove(); });
    return c.textContent.trim() || "Choose a place";
  }
  function current(sel) { var o = sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : ""; }

  var open = null, uid = 0, picking = false;
  function enhance(sel) {
    sel.__ppk = true; uid++;
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "ppk-btn"; btn.setAttribute("aria-haspopup", "dialog"); btn.id = "ppk-b" + uid;
    function paint() { btn.innerHTML = '<span class="ppk-v">' + (esc(current(sel)) || "Choose…") + '</span><span class="ppk-ch">Change</span>'; btn.setAttribute("aria-label", labelFor(sel) + " " + current(sel) + ". Tap to choose a different place"); }
    paint();
    sel.classList.add("ppk-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
    sel.parentNode.insertBefore(btn, sel.nextSibling);
    sel.addEventListener("change", function () { paint(); if (open && open.sel === sel && !picking) close(true); });   // chosen some other way
    sel.addEventListener("focus", function () { if (open && open.sel === sel) open.bg.querySelector(".ppk").focus({ preventScroll: true }); else btn.focus({ preventScroll: true }); });
    btn.addEventListener("click", function () { show(sel, btn, paint); });
    // "Add a stamp": nothing is chosen yet, so go straight to the list (pick a place, then fill in the date)
    var lead = Array.prototype.some.call(sel.options, function (o) { return !/^(place|state|park):/.test(o.value); });
    var chosen = Array.prototype.some.call(sel.options, function (o) { return o.defaultSelected; });
    if (sel.closest(".sheetbox") && !lead && !chosen) show(sel, btn, paint);
    var l = sel.id && document.querySelector('label[for="' + sel.id + '"]');
    if (l) l.addEventListener("click", function (e) { e.preventDefault(); btn.focus(); });
  }
  function show(sel, btn, paint) {
    if (open) close(true);
    var md = model(sel), title = labelFor(sel), id = "ppk" + (++uid);
    var real = sel.__ppkPicked || Array.prototype.some.call(sel.options, function (o) { return o.defaultSelected; });   // a real choice, not just "the first in the list"
    var lead = md.lead.map(function (o) {
      return '<button type="button" class="ppk-row ppk-lead" data-v="' + esc(o.value) + '"' + (o.selected ? ' aria-current="true"' : "") + '><span>' + esc(o.textContent.trim()) + '</span>' + (o.selected ? '<span class="ppk-tick" aria-hidden="true">✓</span>' : "") + '</button>';
    }).join("");
    var body = md.order.map(function (g) {
      return FF().group(g, g, null, null, md.groups[g].map(function (it) {
        var sel0 = it.o.selected && real;
        return '<button type="button" class="ppk-row" data-v="' + esc(it.o.value) + '" data-name="' + esc(it.name + " " + FF().alias(it.id) + " " + (it.extra || "") + (UK[it.id] ? " uk united kingdom" : "")) + '"' + (sel0 ? ' aria-current="true"' : "") + '>' +
          '<span data-hl>' + esc(it.name) + '</span>' + (it.extra ? '<span class="ppk-sub">' + esc(it.extra) + '</span>' : "") + (sel0 ? '<span class="ppk-tick" aria-hidden="true">✓</span>' : "") + '</button>';
      }).join(""));
    }).join("");
    var bg = document.createElement("div"); bg.className = "ppk-bg";
    bg.innerHTML = '<div class="ppk" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t"><div class="ppk-head"><h3 id="' + id + '-t">' + esc(title) + '</h3>' +
      '<button type="button" class="ppk-x" aria-label="Close">✕</button></div>' +
      '<div class="ppk-search"><label for="' + id + '-q" class="sr">Search places</label><input id="' + id + '-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Search, e.g. Scot, Holland, Utah"></div>' +
      '<div class="ppk-list plist" data-plist="' + esc(md.key) + '">' + FF().tools("") + lead + body + '</div></div>';
    document.body.appendChild(bg);
    var q = bg.querySelector("input"), list = bg.querySelector(".ppk-list");
    FF().bind(list, q, false);
    // open the group with the current choice so it's easy to see
    var cur = list.querySelector('.pgrp .ppk-row[aria-current]');
    if (cur) { var g = cur.closest(".pgrp"), h = g.querySelector(".pgh"); if (h.getAttribute("aria-expanded") !== "true") { h.setAttribute("aria-expanded", "true"); g.querySelector(".pgb").hidden = false; g.classList.remove("closed"); } }
    open = { bg: bg, sel: sel, btn: btn, hist: false };
    try { history.pushState({ ppk: uid }, ""); open.hist = true; } catch (e) {}
    bg.addEventListener("click", function (e) {
      if (e.target === bg || e.target.closest(".ppk-x")) { close(); return; }
      var r = e.target.closest(".ppk-row"); if (!r) return;
      sel.value = r.dataset.v; sel.__ppkPicked = true; picking = true;
      try { sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); } finally { picking = false; }
      paint(); close();
    });
    bg.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !(e.target === q && q.value)) { e.stopPropagation(); e.preventDefault(); close(); }
      if (e.key === "Enter" && e.target === q) { e.preventDefault(); var vis = Array.prototype.filter.call(list.querySelectorAll(".ppk-row"), function (x) { return x.offsetParent; }); if (q.value && vis.length) vis.filter(function (x) { return !x.classList.contains("ppk-lead"); })[0].click(); }
      if (e.key === "Tab") { // keep focus inside the dialog
        var f = Array.prototype.filter.call(bg.querySelectorAll("button,input"), function (x) { return x.offsetParent; }), a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
    document.documentElement.classList.add("ppk-lock");
    // phones: don't pop the keyboard over the list; people often just tap a continent. Bigger screens: type straight away.
    if (window.matchMedia("(pointer: fine)").matches) q.focus(); else bg.querySelector(".ppk").setAttribute("tabindex", "-1"), bg.querySelector(".ppk").focus({ preventScroll: true });
  }
  function close(silent, fromPop) {
    if (!open) return;
    var o = open; open = null;
    o.bg.remove(); document.documentElement.classList.remove("ppk-lock");
    if (o.hist && !fromPop) { skipPop = true; history.back(); }
    if (!silent && document.body.contains(o.btn)) o.btn.focus({ preventScroll: true });
  }
  var skipPop = false;
  window.addEventListener("popstate", function () { if (skipPop) { skipPop = false; return; } if (open) close(false, true); });
  window.addEventListener("hashchange", function () { if (open) { open.hist = false; close(true); } });
  function scan(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("select"), function (s) { if (isPlaceSelect(s)) enhance(s); });
    if (open && !document.body.contains(open.sel)) { open.hist && (skipPop = true, history.back()); open.hist = false; close(true); }
  }
  function start() {
    scan();
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes.length || ms[i].removedNodes.length) { scan(); return; }
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.FS_PICK = { scan: scan, isOpen: function () { return !!open; }, close: function () { close(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
