/* Famstamp v81: places that aren't on our lists.
   1. "Search OpenStreetMap" under the trip builder's results (only when tapped; 1 request a second at most; cached; credited).
   2. "Drop a pin": name it, pick what kind of place it is, tap the map (OpenStreetMap tiles) or use where you are. It becomes a stop
      with its own type stamp, and counts for its country / state (looked up once from OpenStreetMap when you save). */
(function () {
  "use strict";
  var O = function () { return window.FS_OSM; }, SA = function () { return window.WK_STAMPART; }, PP = function () { return window.WK_PASSPORT; };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var last = 0, chain = Promise.resolve();
  function iso23() { var m = {}, I = (PP() && PP().ISO32) || {}; Object.keys(I).forEach(function (k) { m[I[k].toLowerCase()] = k; }); return m; }
  function label(t) { var S = SA(); return S && S.typeOf ? S.typeOf(t).label : t; }
  /** One polite request to Nominatim: queued, spaced >= 1.1 s apart, cached for 30 days. */
  function get(url) {
    var hit = O().cacheGet(window.localStorage, url);
    if (hit) return Promise.resolve(hit);
    var p = chain.then(function () {
      return new Promise(function (res) { setTimeout(res, O().waitFor(last, Date.now())); }).then(function () {
        last = Date.now();
        return fetch(url, { headers: { Accept: "application/json" }, referrerPolicy: "strict-origin-when-cross-origin" }).then(function (r) { if (!r.ok) throw new Error("OpenStreetMap search is busy (" + r.status + ")"); return r.json(); });
      });
    });
    chain = p.catch(function () {});
    return p.then(function (j) { O().cachePut(window.localStorage, url, j); return j; });
  }
  function search(q) {
    var m = iso23();
    return get(O().searchURL(q)).then(function (list) { return (Array.isArray(list) ? list : []).map(function (r) { return O().toPoint(r, m, label); }).filter(Boolean); });
  }
  function reverse(lat, lon) { return get(O().reverseURL(lat, lon)).then(function (r) { return r && r.address ? r : null; }); }

  // ---- the Drop a pin sheet ----
  var TS = 256;
  function open(opts) {
    opts = opts || {};
    var S = SA(), types = S && S.TYPES ? Object.keys(S.TYPES) : ["pin"];
    var c0 = opts.center && isFinite(opts.center.lat) ? opts.center : { lat: 30, lon: 0 }, z = opts.center && isFinite(opts.center.lat) ? 12 : 2;
    var pin = null, cx, cy;
    function setCenter(lat, lon) { var t = O().tileXY(lat, lon, z); cx = t.x; cy = t.y; }
    setCenter(c0.lat, c0.lon);
    var groups = { sights: "Sights", nature: "Nature", fun: "Fun and kids", drinks: "Drinks (grown-ups)", getting: "Getting there" };
    var opt = Object.keys(groups).map(function (g) {
      var ts = types.filter(function (t) { return S.TYPES[t][4] === g; });
      return ts.length ? '<optgroup label="' + groups[g] + '">' + ts.map(function (t) { var ty = S.typeOf(t); return '<option value="' + t + '"' + (t === (opts.type || "pin") ? " selected" : "") + '>' + ty.emoji + " " + esc(ty.label) + '</option>'; }).join("") + '</optgroup>' : "";
    }).join("");
    var box = document.createElement("div"); box.className = "pinsheet"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Drop a pin");
    box.innerHTML = '<div class="pinpanel"><div class="pinhead"><h3>📍 Drop a pin</h3><button type="button" class="pinx" aria-label="Close">×</button></div>' +
      '<div class="field"><label for="pinname">What is it called?</label><input id="pinname" type="text" maxlength="80" value="' + esc(opts.name || "") + '" placeholder="e.g. Grandpa\'s cabin, Shell Beach"></div>' +
      '<div class="field"><label for="pintype">What kind of place?</label><select id="pintype">' + opt + '</select></div>' +
      '<div class="pinfind"><input id="pinq" type="search" placeholder="Move the map to a town or place" aria-label="Move the map to"><button type="button" class="btn btn-ghost sm" id="pingo">Go</button></div>' +
      '<p class="small muted pinhint">Tap the map where it is. Drag to move, + and − to zoom.</p>' +
      '<div class="pinmap" id="pinmap" tabindex="0" aria-label="Map. Tap to drop the pin."><div class="pintiles"></div><div class="pinmark" hidden>📍</div>' +
      '<div class="pinzoom"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="-1" aria-label="Zoom out">−</button></div></div>' +
      '<p class="osmattr">Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></p>' +
      '<div class="pinrow"><button type="button" class="linkbtn sm" id="pinme">🎯 Use where I am now</button><span class="small muted" id="pinll"></span></div>' +
      '<p class="small pinerr" id="pinerr" role="status"></p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="pinsave">Add this place</button><button type="button" class="btn btn-ghost" id="pincancel">Cancel</button></div></div>';
    document.body.appendChild(box);
    var $ = function (s) { return box.querySelector(s); }, map = $("#pinmap"), tiles = $(".pintiles"), mark = $(".pinmark");
    function draw() {
      var w = map.clientWidth || 320, h = map.clientHeight || 260, n = Math.pow(2, z), html = "";
      var x0 = Math.floor(cx - w / 2 / TS), x1 = Math.floor(cx + w / 2 / TS), y0 = Math.max(0, Math.floor(cy - h / 2 / TS)), y1 = Math.min(n - 1, Math.floor(cy + h / 2 / TS));
      for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++)
        html += '<img alt="" draggable="false" src="' + O().tileURL(x, y, z) + '" style="left:' + Math.round(w / 2 + (x - cx) * TS) + 'px;top:' + Math.round(h / 2 + (y - cy) * TS) + 'px">';
      tiles.innerHTML = html;
      if (pin) { var t = O().tileXY(pin.lat, pin.lon, z); mark.hidden = false; mark.style.left = Math.round(w / 2 + (t.x - cx) * TS) + "px"; mark.style.top = Math.round(h / 2 + (t.y - cy) * TS) + "px"; $("#pinll").textContent = pin.lat.toFixed(4) + ", " + pin.lon.toFixed(4); }
      else mark.hidden = true;
    }
    function drop(lat, lon) { pin = { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 }; $("#pinerr").textContent = ""; draw(); }
    var down = null;
    map.addEventListener("pointerdown", function (e) { if (e.target.closest("button")) return; down = { x: e.clientX, y: e.clientY, cx: cx, cy: cy, moved: false }; try { map.setPointerCapture(e.pointerId); } catch (x) {} });
    map.addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true; if (down.moved) { cx = down.cx - dx / TS; cy = down.cy - dy / TS; draw(); } });
    map.addEventListener("pointerup", function (e) {
      if (!down) return; var d = down; down = null; if (d.moved) return;
      var b = map.getBoundingClientRect(), x = cx + (e.clientX - b.left - b.width / 2) / TS, y = cy + (e.clientY - b.top - b.height / 2) / TS, ll = O().latLon(x, y, z);
      drop(ll.lat, ((ll.lon + 540) % 360) - 180);
    });
    map.addEventListener("pointercancel", function () { down = null; });
    box.querySelectorAll("[data-z]").forEach(function (b) { b.onclick = function () { var ll = O().latLon(cx, cy, z); z = Math.max(2, Math.min(18, z + (+b.dataset.z))); if (pin && b.dataset.z === "1") setCenter(pin.lat, pin.lon); else setCenter(ll.lat, ll.lon); draw(); }; });
    function close() { box.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    $(".pinx").onclick = close; $("#pincancel").onclick = close;
    function go() {
      var q = $("#pinq").value.trim(); if (q.length < 2) return;
      var near = opts.findLocal ? opts.findLocal(q) : null;
      if (near) { z = Math.max(z, 12); setCenter(near.lat, near.lon); draw(); return; }
      $("#pinerr").textContent = "Looking on OpenStreetMap…";
      search(q).then(function (l) { if (!l.length) { $("#pinerr").textContent = "Nothing found for that. Try a nearby town."; return; } $("#pinerr").textContent = ""; z = 13; setCenter(l[0].lat, l[0].lon); draw(); })
        .catch(function (e) { $("#pinerr").textContent = e.message; });
    }
    $("#pingo").onclick = go; $("#pinq").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
    $("#pinme").onclick = function () {
      if (!navigator.geolocation) { $("#pinerr").textContent = "This phone can't share its location here."; return; }
      $("#pinerr").textContent = "Finding you…";
      navigator.geolocation.getCurrentPosition(function (p) { z = 15; setCenter(p.coords.latitude, p.coords.longitude); drop(p.coords.latitude, p.coords.longitude); },
        function () { $("#pinerr").textContent = "Couldn't get your location. Tap the map instead."; }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    };
    $("#pinsave").onclick = function () {
      var name = $("#pinname").value.trim(), type = $("#pintype").value;
      if (!name) { $("#pinerr").textContent = "Give it a name first."; $("#pinname").focus(); return; }
      if (!pin) { $("#pinerr").textContent = "Tap the map to drop the pin."; return; }
      var pt = { name: name, kind: "sight", type: type, lat: pin.lat, lon: pin.lon, pinned: true };
      var btn = this; btn.disabled = true; $("#pinerr").textContent = "Saving…";
      var finish = function (r) {
        if (r) { var p2 = O().toPoint(Object.assign({}, r, { name: name, category: "pin", type: "pin", lat: pin.lat, lon: pin.lon }), iso23(), label); if (p2) { if (p2.country) pt.country = p2.country; if (p2.region) pt.region = p2.region; if (p2.town) pt.town = p2.town; } }
        var where = r && r.address ? [pt.town || "", r.address.state || "", r.address.country || ""].filter(Boolean).join(", ") : "Pinned on the map";
        pt.sub = label(type) + " · " + where;
        close(); if (opts.onDone) opts.onDone(pt);
      };
      reverse(pin.lat, pin.lon).then(finish, function () { finish(null); });
    };
    draw(); setTimeout(draw, 60); $("#pinname").focus();
    return { close: close, drop: drop };
  }
  window.FS_PIN = { search: search, reverse: reverse, open: open };
})();
