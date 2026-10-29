/* Famstamp map zoom, pan, country names and "Jump to" (v1.5). Works on every .mapbox map the app draws (world, USA, the family
   maps and trip route maps) without changing how they're drawn: it wraps the map in one <g> and moves only that group's transform
   (one attribute per animation frame, nothing re-rendered). Pinch, drag, double-tap, mouse wheel, + / − / fit buttons, keyboard.
   Names are placed at each shape's visual center (map-labels.js), stay the same size on screen, and appear as you zoom in
   without overlapping. The view is remembered per map, so a re-render (a tap, a sync) never resets it. No network, no timers. */
(function () {
  "use strict";
  var MAPS = window.MLTL_MAPS, LBL = window.MLTL_LABELS || { world: {}, us: {} }, F = window.FS_FIND;
  var NS = "http://www.w3.org/2000/svg";
  var VIEWS = {};
  try { VIEWS = JSON.parse(sessionStorage.getItem("fs-mapviews") || "{}") || {}; } catch (e) {}
  function saveViews() { try { sessionStorage.setItem("fs-mapviews", JSON.stringify(VIEWS)); } catch (e) {} }
  var reduced = function () { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var NAMES = { world: {}, us: {} };
  if (MAPS) { MAPS.world.shapes.forEach(function (s) { NAMES.world[s.id] = s.name; }); MAPS.us.shapes.forEach(function (s) { NAMES.us[s.id] = s.name; }); }
  // shorter names used when the full one doesn't fit yet
  var SHORT = { USA: "USA", COD: "DR Congo", CAF: "C. African Rep.", RUS: "Russia", SAU: "Saudi Arabia", ARE: "UAE", GBR: "UK", PNG: "PNG", BIH: "Bosnia", DOM: "Dom. Rep.",
    MKD: "N. Macedonia", CZE: "Czechia", ZAF: "S. Africa", KOR: "S. Korea", PRK: "N. Korea", NZL: "NZ", GNQ: "Eq. Guinea", SSD: "S. Sudan", TTO: "Trinidad", ATF: "Fr. S. Lands", NIR: "N. Ireland" };
  var MAXK = { world: 48, us: 10, route: 10 };
  var active = null;   // the map that plain mouse-wheel scrolling zooms (the one last clicked); otherwise the page scrolls

  function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function enhance(svg) {
    if (svg.__pz) return; svg.__pz = true; svg.setAttribute("data-pzon", "1");
    var box = svg.parentNode, vbA = (svg.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number);
    var vb = { x: vbA[0], y: vbA[1], w: vbA[2], h: vbA[3] };
    var type = svg.dataset.pz || (box.classList.contains("us") ? "us" : (box.classList.contains("routebox") ? "route" : "world"));
    var labelsOn = type === "world" || type === "us";
    var key = svg.dataset.pzkey || svg.dataset.pz || "route:" + (svg.getAttribute("aria-label") || "");
    var maxK = MAXK[type] || 10;
    // one group holds everything that moves
    var view = el("g", { "class": "pz-view" });
    Array.prototype.slice.call(svg.childNodes).forEach(function (n) { if (n.nodeName !== "title" && n.nodeName !== "defs") view.appendChild(n); });
    svg.appendChild(view);
    var lg = el("g", { "class": "pz-labels", "aria-hidden": "true" }); view.appendChild(lg);
    box.classList.add("pz"); box.setAttribute("tabindex", "0");
    if (!box.getAttribute("aria-label")) box.setAttribute("aria-label", (svg.getAttribute("aria-label") || "Map") + ". Use plus and minus to zoom, arrow keys to move, 0 to fit.");
    var ctl = document.createElement("div"); ctl.className = "pzctl";
    ctl.innerHTML = '<button type="button" data-pzb="in" aria-label="Zoom in" title="Zoom in">+</button><button type="button" data-pzb="out" aria-label="Zoom out" title="Zoom out">−</button>' +
      '<button type="button" data-pzb="fit" aria-label="Show the whole map" title="Show the whole map"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>';
    box.appendChild(ctl);
    var hint = document.createElement("div"); hint.className = "pzhint"; hint.setAttribute("aria-hidden", "true"); box.appendChild(hint);

    var v = { k: 1, tx: 0, ty: 0 }, s = 1, ox = 0, oy = 0, rect = null, raf = 0, idle = 0, anim = 0;
    // v96: the map's box only changes when its size does (ResizeObserver) or the window resizes, so the end of a pan or zoom
    // doesn't have to read layout again (that read forced a full layout on phones). ctlBox = the zoom buttons, relative to the map.
    var sizeDirty = true, ctlBox = null;
    if (window.ResizeObserver) try { new ResizeObserver(function () { sizeDirty = true; }).observe(svg); } catch (e) {}
    function measure() {
      rect = svg.getBoundingClientRect(); sizeDirty = false;
      var c = labels && labels.length ? ctl.getBoundingClientRect() : null;
      ctlBox = c && c.width ? [c.left - rect.left, c.top - rect.top, c.right - rect.left, c.bottom - rect.top] : null;
      s = Math.min(rect.width / vb.w, rect.height / vb.h) || 1;
      ox = rect.left + (rect.width - vb.w * s) / 2; oy = rect.top + (rect.height - vb.h * s) / 2;
    }
    function toUnit(cx, cy) { measure(); return [vb.x + (cx - ox) / s, vb.y + (cy - oy) / s]; }
    // Keep the map filling the window when it's bigger than the window, centered when it's smaller: it can't get lost off-screen.
    function clampV(o) {
      o.k = clamp(o.k, 1, maxK);
      if (!rect || !rect.width) measure();
      var wx = vb.x - (ox - rect.left) / s, wy = vb.y - (oy - rect.top) / s, ww = rect.width / s, wh = rect.height / s;
      function axis(t, a, len, w0, wl) {
        var cl = o.k * len;
        if (cl >= wl) return clamp(t, w0 + wl - o.k * (a + len), w0 - o.k * a);
        return w0 + (wl - cl) / 2 - o.k * a;
      }
      o.tx = axis(o.tx, vb.x, vb.w, wx, ww); o.ty = axis(o.ty, vb.y, vb.h, wy, wh);
      return o;
    }
    function set(o, user) {
      v = clampV({ k: o.k, tx: o.tx, ty: o.ty });
      VIEWS[key] = { k: +v.k.toFixed(4), tx: +v.tx.toFixed(3), ty: +v.ty.toFixed(3) };
      if (!raf) raf = requestAnimationFrame(frame);
      if (user) box.dispatchEvent(new CustomEvent("pzuser", { bubbles: true }));
    }
    var FPX = 11;
    function frame() {
      raf = 0;
      view.setAttribute("transform", "matrix(" + v.k + " 0 0 " + v.k + " " + v.tx + " " + v.ty + ")");
      if (!rect) measure();
      lg.style.fontSize = (FPX / (v.k * s)) + "px";   // labels keep their size on screen
      box.classList.toggle("zoomed", v.k > 1.01);
      box.dataset.k = v.k.toFixed(3);
      clearTimeout(idle); idle = setTimeout(settle, 90);
    }
    function settle() { saveViews(); if (sizeDirty || !rect || !rect.width || !window.ResizeObserver) measure(); layout(); }

    // ---- labels ----
    var labels = [];
    if (labelsOn) {
      var names = NAMES[type], anchors = LBL[type] || {};
      var hitSel = svg.querySelector("[data-kind]") ? "data-id" : (svg.querySelector("[data-fam]") ? "data-fam" : "data-id");
      var shapes = {}; view.querySelectorAll("path[" + hitSel + "]").forEach(function (p) { shapes[p.getAttribute(hitSel)] = p; });
      var dots = {}; view.querySelectorAll("circle.dot").forEach(function (c) { dots[c.getAttribute("data-id")] = c; });
      Object.keys(anchors).forEach(function (id) {
        if (!shapes[id] || !names[id]) return;
        var a = anchors[id], isDot = !!dots[id], t = el("text", { x: isDot ? dots[id].getAttribute("cx") : a[0], y: isDot ? dots[id].getAttribute("cy") : a[1], "class": "pzl" + (isDot ? " pzd" : "") });
        if (isDot) t.setAttribute("dy", "1.35em");
        var full = names[id], short = type === "us" ? id : (SHORT[id] || full);
        t.textContent = full; t.style.display = "none"; lg.appendChild(t);
        labels.push({ id: id, t: t, x: a[0], y: a[1], area: a[2], bw: a[5], bh: a[6], dot: isDot, full: full, short: short, cur: full, on: false });
      });
      labels.sort(function (a, b) { return b.area - a.area; });
    }
    var dotEls = Array.prototype.slice.call(view.querySelectorAll("circle.dot"));
    var focusId = null;
    function layout() {
      var W = rect.width, H = rect.height, ks = v.k * s, placed = [], cw = FPX * 0.58, lh = FPX * 1.25;
      // v94/v96: no layout reads here; the zoom buttons' box comes from measure()
      // dots mark places too small to tap. At the whole-world view they're just clutter (and too close together to tap), so they
      // appear from 2x zoom; a steady 4.5px on screen, hidden again once the place itself is big enough to tap.
      dotEls.forEach(function (c) {
        c.setAttribute("r", (4.5 / ks).toFixed(3));
        var a = (LBL[type] || {})[c.getAttribute("data-id")];
        c.style.display = (type === "world" && v.k < 2 && !c.classList.contains("on")) || (a && Math.max(a[5], a[6]) * ks > 22) ? "none" : "";
      });
      if (!labels.length) return;
      // keep names out from under the + / − / fit buttons (cr, read above)
      if (ctlBox) placed.push([ctlBox[0] - 4, ctlBox[1] - 4, ctlBox[2] + 4, ctlBox[3] + 4]);
      // Pass 1: labels that only fit in one spot (small countries like Wales). Pass 2: big countries, which can slide inside
      // their own outline to make room. Within a pass, bigger first. A label is never drawn over another.
      var cand = [];
      labels.forEach(function (l) {
        var sx = (v.k * l.x + v.tx - vb.x) * s, sy = (v.k * l.y + v.ty - vb.y) * s, ok = false, txt = l.full;
        if (sx > -20 && sx < W + 20 && sy > -10 && sy < H + 10) {
          var ext = Math.max(l.bw, l.bh) * ks, room = Math.sqrt(l.area) * ks, wFull = l.full.length * cw + 6, wShort = l.short.length * cw + 6;
          if (l.dot) ok = v.k >= (type === "world" ? 7 : 3);
          else if (ext >= wFull * 0.45 && (room >= wFull * 0.25 || ext >= wFull * 0.8)) ok = true;
          else if (l.short !== l.full && ext >= wShort * 0.45 && (room >= wShort * 0.25 || ext >= wShort * 0.8)) { ok = true; txt = l.short; }
          if (l.id === focusId) ok = true;
          if (ok) { var w = txt.length * cw + 6; cand.push({ l: l, txt: txt, sx: sx, sy: l.dot ? sy + FPX * 1.35 : sy, w: w, roomy: !l.dot && l.bh * ks > lh * 3 && l.bw * ks > w * 1.4, focus: l.id === focusId }); }
        }
      });
      function fits(r) { for (var i = 0; i < placed.length; i++) { var p = placed[i]; if (r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]) return false; } return true; }
      var show = {};
      function place(c) {
        var tries = [[0, 0]];
        if (c.roomy) { var dy = Math.min(c.l.bh * ks * 0.22, lh * 2.2), dx = Math.min(c.l.bw * ks * 0.18, c.w); tries.push([0, -dy], [0, dy], [-dx, 0], [dx, 0], [-dx, -dy], [dx, dy], [dx, -dy], [-dx, dy]); }
        for (var i = 0; i < tries.length; i++) {
          var x = c.sx + tries[i][0], y = c.sy + tries[i][1], r = [x - c.w / 2, y - lh / 2, x + c.w / 2, y + lh / 2];
          if (fits(r)) { placed.push(r); show[c.l.id] = { txt: c.txt, dx: tries[i][0] / ks, dy: tries[i][1] / ks }; return; }
        }
      }
      cand.filter(function (c) { return c.focus; }).forEach(place);
      cand.filter(function (c) { return !c.focus && !c.roomy; }).forEach(place);
      cand.filter(function (c) { return !c.focus && c.roomy; }).forEach(place);
      labels.forEach(function (l) {
        var o = show[l.id], on = !!o;
        if (on) {
          if (l.cur !== o.txt) { l.t.textContent = o.txt; l.cur = o.txt; }
          var key2 = o.dx.toFixed(2) + "," + o.dy.toFixed(2);
          if (l.off !== key2) { l.off = key2; l.t.setAttribute("transform", o.dx || o.dy ? "translate(" + o.dx + " " + o.dy + ")" : ""); }
        }
        if (on !== l.on) { l.t.style.display = on ? "" : "none"; l.on = on; }
      });
    }

    // ---- moving ----
    function zoomAt(f, cx, cy, user) {
      var p = toUnit(cx, cy), k2 = clamp(v.k * f, 1, maxK), q = [(p[0] - v.tx) / v.k, (p[1] - v.ty) / v.k];
      set({ k: k2, tx: p[0] - k2 * q[0], ty: p[1] - k2 * q[1] }, user);
    }
    function center() { measure(); return [rect.left + rect.width / 2, rect.top + rect.height / 2]; }
    function animateTo(o, user) {
      cancelAnimationFrame(anim); o = clampV(o);
      if (reduced()) return set(o, user);
      var a = { k: v.k, tx: v.tx, ty: v.ty }, t0 = performance.now(), D = 260;
      (function step(now) {
        var t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 3);
        // interpolate zoom in log space so it feels even
        var k = Math.exp(Math.log(a.k) + (Math.log(o.k) - Math.log(a.k)) * e);
        set({ k: k, tx: a.tx + (o.tx - a.tx) * e, ty: a.ty + (o.ty - a.ty) * e }, user);
        if (t < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    function boxView(b, pad) {
      pad = pad || 0.8;
      var k = clamp(Math.min(vb.w / Math.max(b[2], 0.5), vb.h / Math.max(b[3], 0.5)) * pad, 1, maxK);
      var cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
      return { k: k, tx: vb.x + vb.w / 2 - k * cx, ty: vb.y + vb.h / 2 - k * cy };
    }
    function zoomStep(f) { var c = center(); var p = toUnit(c[0], c[1]), k2 = clamp(v.k * f, 1, maxK), q = [(p[0] - v.tx) / v.k, (p[1] - v.ty) / v.k]; animateTo({ k: k2, tx: p[0] - k2 * q[0], ty: p[1] - k2 * q[1] }, true); }
    function fit() { animateTo({ k: 1, tx: 0, ty: 0 }, true); }
    ctl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pzb]"); if (!b) return;
      if (b.dataset.pzb === "in") zoomStep(2); else if (b.dataset.pzb === "out") zoomStep(0.5); else fit();
    });

    // ---- pointers: drag to pan, pinch to zoom; a tap still colors a country ----
    var pts = {}, n = 0, start = null, moved = false, lastDrag = 0, lastDown = 0, pend = null;
    function snap() { var ids = Object.keys(pts); return ids.map(function (i) { return pts[i]; }); }
    function begin() {
      var p = snap(); measure();
      if (p.length === 1) start = { x: p[0].x, y: p[0].y, v: { k: v.k, tx: v.tx, ty: v.ty } };
      else if (p.length >= 2) {
        var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        start = { pinch: true, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, m: toUnit(mx, my), v: { k: v.k, tx: v.tx, ty: v.ty } };
      }
    }
    svg.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return;
      active = box; cancelAnimationFrame(anim);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY }; n = Object.keys(pts).length; lastDown = Date.now();
      if (n === 1) moved = false;
      if (n >= 2) { moved = true; try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
      begin();
    });
    svg.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId] || !start) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var p = snap();
      if (start.pinch && p.length >= 2) {
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        var k2 = clamp(start.v.k * d / start.d, 1, maxK), q = [(start.m[0] - start.v.tx) / start.v.k, (start.m[1] - start.v.ty) / start.v.k], m = toUnit(mx, my);
        set({ k: k2, tx: m[0] - k2 * q[0], ty: m[1] - k2 * q[1] }, true);
      } else if (!start.pinch) {
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) > 7) { moved = true; try { svg.setPointerCapture(e.pointerId); } catch (x) {} box.classList.add("dragging"); }
        if (moved) set({ k: start.v.k, tx: start.v.tx + dx / s, ty: start.v.ty + dy / s }, true);
      }
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId]; n = Object.keys(pts).length;
      if (moved) lastDrag = Date.now();
      if (n) begin(); else { start = null; box.classList.remove("dragging"); }
    }
    svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up); svg.addEventListener("lostpointercapture", up);
    // clicks: swallow the click that ends a drag. A tap colors the place at once (optimistic), and the app gets the click
    // a beat later (200ms) unless a second tap comes: then it's a double-tap, which zooms in and leaves the color as it was.
    var replay = false, TAP = 200;
    function optimistic(p, on) {
      var el = p.target && p.target.closest && p.target.closest("[data-kind]"); if (!el || !svg.contains(el)) return;
      if (on) { p.el = el; el.classList.add(el.classList.contains("on") ? "pz-opt-off" : "pz-opt-on"); }
      else if (p.el) p.el.classList.remove("pz-opt-on", "pz-opt-off");
    }
    svg.addEventListener("click", function (e) {
      if (replay) return;
      if (Date.now() - lastDrag < 350) { e.stopPropagation(); e.preventDefault(); return; }
      if (Date.now() - lastDown > 1000) return;   // a click with no pointer (keyboard, scripts): let it through untouched
      e.stopPropagation(); e.preventDefault();
      if (pend && Date.now() - pend.t < TAP + 60 && Math.hypot(e.clientX - pend.x, e.clientY - pend.y) < 30) {
        clearTimeout(pend.timer); optimistic(pend, false); pend = null;
        var p = toUnit(e.clientX, e.clientY), k2 = clamp(v.k * 2, 1, maxK), q = [(p[0] - v.tx) / v.k, (p[1] - v.ty) / v.k];
        animateTo({ k: k2, tx: p[0] - k2 * q[0], ty: p[1] - k2 * q[1] }, true);
        return;
      }
      if (pend) { clearTimeout(pend.timer); fire(pend); }
      var tgt = e.target, cx = e.clientX, cy = e.clientY;
      pend = { t: Date.now(), x: cx, y: cy, target: tgt };
      optimistic(pend, true);
      pend.timer = setTimeout(function () { var p0 = pend; pend = null; if (p0) fire(p0); }, TAP);
    }, true);
    function fire(p) {
      optimistic(p, false);
      replay = true;
      try { p.target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, view: window })); } finally { replay = false; }
    }
    // mouse wheel / trackpad: pinch (ctrl+wheel) always zooms; plain scrolling zooms only after you click the map
    box.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && active !== box) { showHint("Click the map, then scroll to zoom. Or use + and −."); return; }
      e.preventDefault(); cancelAnimationFrame(anim);
      var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX, e.clientY, true);
    }, { passive: false });
    var hintT = 0;
    function showHint(t) { hint.textContent = t; hint.classList.add("show"); clearTimeout(hintT); hintT = setTimeout(function () { hint.classList.remove("show"); }, 1400); }
    box.addEventListener("keydown", function (e) {
      if (e.target !== box) return;
      var step = 0.18, k = e.key;
      if (k === "+" || k === "=") zoomStep(1.6);
      else if (k === "-" || k === "_") zoomStep(1 / 1.6);
      else if (k === "0" || k === "Home") fit();
      else if (k.indexOf("Arrow") === 0) {
        var dx = k === "ArrowLeft" ? 1 : k === "ArrowRight" ? -1 : 0, dy = k === "ArrowUp" ? 1 : k === "ArrowDown" ? -1 : 0;
        animateTo({ k: v.k, tx: v.tx + dx * vb.w * step, ty: v.ty + dy * vb.h * step }, true);
      } else return;
      e.preventDefault();
    });

    // ---- API on the box ----
    box.__pz = {
      key: key, type: type,
      view: function () { return { k: v.k, tx: v.tx, ty: v.ty }; },
      set: function (o) { set(o); },
      zoomToBox: function (b, pad) { animateTo(boxView(b, pad)); },
      zoomToId: function (id) {
        var a = (LBL[type] || {})[id], ids = id === "GBR" ? ["ENG", "SCT", "WLS", "NIR"] : [id];
        var bb = null;
        ids.forEach(function (i) { var x = (LBL[type] || {})[i]; if (!x) return; var b = [x[3], x[4], x[3] + x[5], x[4] + x[6]]; bb = bb ? [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])] : b; });
        if (!bb && !a) return false;
        var b = [bb[0], bb[1], Math.max(bb[2] - bb[0], 1.2), Math.max(bb[3] - bb[1], 1.2)];
        b[0] -= (b[2] - (bb[2] - bb[0])) / 2; b[1] -= (b[3] - (bb[3] - bb[1])) / 2;
        focusId = ids.length === 1 ? id : null;
        animateTo(boxView(b, ids.length > 1 ? 0.85 : 0.42));
        ids.forEach(function (i) { var p = view.querySelector('path[data-id="' + i + '"],path[data-fam="' + i + '"]'); if (p) { p.classList.remove("pzflash"); void p.getBoundingClientRect(); p.classList.add("pzflash"); } });
        return true;
      },
      remeasure: function () { measure(); set(v); }, fit: fit, zoomIn: function () { zoomStep(2); }, zoomOut: function () { zoomStep(0.5); },
      labels: function () { return labels.filter(function (l) { return l.on; }).map(function (l) { return l.cur; }); }
    };
    // first view: what this map showed last time (survives re-renders), else a preset region, else the whole map
    measure();
    var init = VIEWS[key];
    if (!init && svg.dataset.pzinit) init = boxView(svg.dataset.pzinit.split(" ").map(Number), 1);
    v = clampV(init ? { k: init.k, tx: init.tx, ty: init.ty } : { k: 1, tx: 0, ty: 0 });
    frame(); clearTimeout(idle); settle();
    if (labelsOn) addFinder(box, type);
  }

  // ---- "Jump to" box above the world and US maps ----
  function addFinder(box, type) {
    if (!F) return;
    var prev = box.previousElementSibling, wrap;
    if (prev && prev.classList.contains("pzfind")) { if (prev.firstChild) return; wrap = prev; }   // app.js leaves an empty slot so the page doesn't shift
    else { wrap = document.createElement("div"); wrap.className = "pzfind"; box.parentNode.insertBefore(wrap, box); }
    var list = [];
    if (type === "world") {
      MAPS.world.shapes.forEach(function (s) { list.push({ id: s.id, name: s.name, n: F.norm(s.name + " " + F.alias(s.id)) }); });
      list.push({ id: "GBR", name: "United Kingdom", n: F.norm("united kingdom " + F.alias("GBR")) });
    } else MAPS.us.shapes.forEach(function (s) { list.push({ id: s.id, name: s.name, n: F.norm(s.name + " " + s.id) }); });
    var uid = "pzq-" + type + "-" + Math.random().toString(36).slice(2, 7);
    wrap.innerHTML = '<label for="' + uid + '" class="sr">' + (type === "us" ? "Jump to a state" : "Jump to a country") + '</label>' +
      '<input id="' + uid + '" type="search" autocomplete="off" enterkeyhint="go" placeholder="' + (type === "us" ? "Jump to a state, e.g. Utah or UT" : "Jump to a country, e.g. Scot") + '" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="' + uid + '-l">' +
      '<ul class="pzsug" id="' + uid + '-l" role="listbox" hidden></ul>';
    var inp = wrap.querySelector("input"), ul = wrap.querySelector("ul"), hits = [], sel = 0;
    function render() {
      var q = F.norm(inp.value);
      hits = !q ? [] : list.filter(function (x) { return x.n.indexOf(q) >= 0; }).sort(function (a, b) {
        var an = F.norm(a.name), bn = F.norm(b.name), as = an.indexOf(q) === 0 ? 0 : an.indexOf(q) > 0 ? 1 : 2, bs = bn.indexOf(q) === 0 ? 0 : bn.indexOf(q) > 0 ? 1 : 2;
        return as - bs || an.length - bn.length; }).slice(0, 6);
      sel = 0;
      ul.innerHTML = hits.map(function (h, i) { return '<li role="option" id="' + uid + '-o' + i + '" data-i="' + i + '" aria-selected="' + (i === sel) + '"><span>' + F.highlight(h.name, q) + '</span></li>'; }).join("") ||
        (q ? '<li class="none" aria-disabled="true">No matches</li>' : "");
      ul.hidden = !q; inp.setAttribute("aria-expanded", String(!!q));
    }
    function go(h) { if (!h) return; box.__pz.zoomToId(h.id); inp.value = h.name; ul.hidden = true; inp.setAttribute("aria-expanded", "false"); }
    inp.addEventListener("input", render);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); go(hits[sel]); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!hits.length) return; sel = (sel + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
        ul.querySelectorAll("li").forEach(function (li, i) { li.setAttribute("aria-selected", String(i === sel)); }); inp.setAttribute("aria-activedescendant", uid + "-o" + sel); }
      else if (e.key === "Escape") { ul.hidden = true; }
    });
    ul.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // keep focus in the box
    ul.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (li) go(hits[+li.dataset.i]); });
    inp.addEventListener("blur", function () { setTimeout(function () { ul.hidden = true; }, 150); });
  }

  function scan() {
    document.querySelectorAll("#main .mapbox > svg:not([data-pzon])").forEach(function (svg) {
      if (svg.closest(".sheet, .slide, .noprint-skip")) return;   // print sheets and the story slideshow stay still
      enhance(svg);
    });
  }
  var queued = false;
  function queue() { if (queued) return; queued = true; Promise.resolve().then(function () { queued = false; scan(); }); }
  function start() {
    var main = document.getElementById("main"); if (!main) return;
    new MutationObserver(queue).observe(main, { childList: true, subtree: true });
    scan();
  }
  document.addEventListener("pointerdown", function (e) { if (active && !active.contains(e.target)) active = null; }, true);
  window.addEventListener("resize", function () { document.querySelectorAll(".mapbox.pz").forEach(function (b) { if (b.__pz) b.__pz.remeasure(); }); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.FS_MAP = {
    of: function (elm) { var b = elm && (elm.closest ? elm.closest(".mapbox") : null); return b && b.__pz; },
    views: VIEWS, scan: scan
  };
})();
