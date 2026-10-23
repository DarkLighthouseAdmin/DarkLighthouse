/* Famstamp stamp art: every passport stamp drawn from a few numbers. Our own simple drawings (nature, animals, landmark
   ideas that belong to everyone), never real seals, coats of arms, emblems or anyone's artwork. The look of a place's stamp
   (shape, border, ink, motif, lettering) comes from its code, so it is the same on every device. No browser parts. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./state-symbols.js"));
  else root.WK_STAMPART = factory(root.WK_STATESYM);
})(typeof self !== "undefined" ? self : this, function (SYM) {
  "use strict";
  function hash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ---------- ink, shapes, borders, lettering ----------
  var INKS = { red: ["#b02a2a", "#962043"], blue: ["#1f4f9e", "#17608a"], green: ["#2b7340", "#4a6a24"], violet: ["#5f35a0", "#83388a"], black: ["#23262c", "#3b4048"], brown: ["#8a4a17", "#6c3a1f"] };
  var INK_LIST = []; ["red", "blue", "green", "violet", "black", "brown"].forEach(function (k) { INK_LIST.push(INKS[k][0]); }); ["red", "blue", "green", "violet", "black", "brown"].forEach(function (k) { INK_LIST.push(INKS[k][1]); });
  var SHAPES = ["circle", "oval", "rect", "hexagon", "triangle", "shield", "arch", "octagon", "double", "cancel"];
  var BORDERS = ["solid", "dashed", "dotted", "double", "toothed"];
  var FONTS = { mono: "'Courier New', Courier, monospace", serif: "Georgia, 'Times New Roman', serif", slab: "Rockwell, 'Roboto Slab', 'Courier New', serif", sans: "'Arial Black', 'Helvetica Neue', Arial, sans-serif", cond: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif" };
  var FONT_KEYS = ["mono", "serif", "slab", "sans", "cond"];
  var LABELS = ["ARRIVAL", "ARRIVED", "ENTRY", "ADMITTED", "VISITED", "WELCOME"];

  // ---------- motif glyphs: 40x40 box, ink fill; "#fff" bits read as bare paper (stamps print with multiply) ----------
  var PAPER = "#fff";
  function C(x, y, r, f) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"' + (f ? ' fill="' + f + '"' : "") + '/>'; }
  function E(x, y, rx, ry, rot, f) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '"' + (rot ? ' transform="rotate(' + rot + " " + x + " " + y + ')"' : "") + (f ? ' fill="' + f + '"' : "") + '/>'; }
  function P(d, f) { return '<path d="' + d + '"' + (f ? ' fill="' + f + '"' : "") + '/>'; }
  function S(d, w, col) { return '<path d="' + d + '" fill="none" stroke="' + (col || "currentColor") + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  function petals(cx, cy, n, d, rx, ry, r0, f) { var s = ""; for (var i = 0; i < n; i++) { var a = (r0 || 0) + i * 360 / n, t = a * Math.PI / 180; s += E(+(cx + d * Math.sin(t)).toFixed(2), +(cy - d * Math.cos(t)).toFixed(2), rx, ry, Math.round(a), f); } return s; }
  function stem(x, y0, y1, leafs) { var s = S("M" + x + " " + y0 + " V" + y1, 1.8); (leafs || []).forEach(function (l) { s += E(x + l[1] * 4, l[0], 4.2, 1.8, l[1] * -35); }); return s; }

  // songbird family: one body, small changes tell them apart (crest, long tail, cocked tail, cap, breast, bars)
  function bird(o, v) {
    var s = "", fly = v === 2, sing = v === 1;
    s += E(20, 22, 11, 7.2, -18) + C(29, 13.5, 5.2);
    s += o.wren ? P("M12 21 L5 9 L8.5 8 L15.5 18 Z") : o.longtail ? P("M12 24 L0 33 L2 36 L14 27 Z") : P("M11 25 L2 31 L4.5 34 L14 27.5 Z");
    s += sing ? P("M33.5 12.2 L39 9.8 L34.2 13.6 Z M33.6 14.2 L38.6 16.4 L33.4 15.6 Z") : P("M33.6 12 L39 14 L33.4 16 Z");
    if (o.crest) s += P("M25.2 10.5 L23.2 2 L31 9 Z");
    s += C(30.4, 12.4, 1.1, PAPER);
    if (o.cheek) s += E(29.5, 15.6, 3, 1.7, -10, PAPER) + P("M24 9.4 Q29 6.5 34 10.4 L33 11 Q29 9 25 11 Z");
    if (o.breast === "ring") s += E(23.5, 23.5, 5, 3.6, -25, PAPER) + C(23.5, 23.5, 1.1) + C(21.5, 25, 1) + C(25.4, 22, 0.9);
    if (o.breast === "v") s += E(24.5, 22.5, 5.4, 4, -25, PAPER) + P("M21 19.5 L24.6 24 L28 18.6 L26.8 18 L24.6 21.6 L22.3 18.8 Z");
    if (o.breast === "spots") s += E(24, 23, 5, 3.6, -25, PAPER) + C(22.5, 22, 0.9) + C(25, 21.4, 0.9) + C(24, 24.4, 0.9) + C(21.6, 25, 0.8) + C(26.6, 23.4, 0.8);
    if (o.bars) s += S("M13 20.5 L21 18.5 M14 23.5 L22 21.5", 1.1, PAPER);
    else s += S("M12 20.5 Q18 17.5 24 19.5", 1.1, PAPER);
    if (o.beak === "cone") s += P("M33 11.2 L37.5 14 L33 16.8 Z");
    if (fly) s += P("M15 18 L10 4 L17 7 L22 2 L23 16 Z");
    else s += S("M18 28.4 L17 33.5 M22.5 28 L22.5 33.5", 1.4) + S("M1 34.5 Q20 31.5 39 34.5", 2.2) + (o.longtail ? "" : E(34.5, 31.5, 3, 1.4, -30));
    return s;
  }
  var G = {
    // ---- birds
    song: function (v) { return bird({}, v); },
    robin: function (v) { return bird({ breast: "spots" }, v); },
    finch: function (v) { return bird({ bars: 1, beak: "cone" }, v); },
    lark: function (v) { return bird({ breast: "v" }, v); },
    chickadee: function (v) { return bird({ cheek: 1 }, v); },
    wren: function (v) { return bird({ wren: 1, breast: "ring" }, v); },
    mocker: function (v) { return bird({ longtail: 1, bars: 1 }, v); },
    crest: function (v) { return bird({ crest: 1 }, v); },
    flycatcher: function () { return E(20, 18, 9, 5, -10) + C(28, 13.5, 4.4) + P("M32 12.6 L37.5 14 L32 15.2 Z") + C(29, 12.6, 1, PAPER) + P("M12 19 L0 36 L3 36.5 L13.5 22 L8 37 L11 37.5 L16 22 Z") + S("M18 22.5 L17 30 M22 22 L22 30", 1.3) + S("M4 30 Q22 29 38 31", 2); },
    roadrunner: function () { return P("M6 26 Q12 17 24 17 L30 9 Q34 6 37 9 L40 11.5 L35.5 12 L31 19 Q30 26 22 28 L9 29 Z") + P("M29.5 9.2 L28 2 L32 7 L33 1.5 L34 8 Z") + C(34, 9.3, 1, PAPER) + P("M8 25 L0 18 L1 15.5 L11 22 Z") + S("M18 28 L12 37 M24 28 L28 37 M12 37 H8 M28 37 H32", 1.6); },
    quail: function (v) { return E(18, 25, 13, 9.5) + C(29.5, 15, 5.4) + P("M34.3 13.6 L38.5 15.2 L34.3 16.8 Z") + C(31, 14, 1, PAPER) + S("M29 10 Q28 3 34 3.5", 2.4) + S("M10 23 Q17 19.5 24 23 M11 27 Q17 24 23 27", 1, PAPER) + S("M15 34 L14 38 M21 34 L22 38", 1.5) + (v === 1 ? S("M2 38.5 H38", 1.6) : ""); },
    grouse: function (v) { return E(20, 26, 12, 8.5) + C(30, 17, 5) + P("M34.6 15.6 L38.6 17.2 L34.6 18.8 Z") + C(31.4, 16, 1, PAPER) + P("M10 23 L1 9 L5 7.5 L8.5 15 L9 6 L13 6.5 L12.5 16 L16 9 L19 11 Z") + S("M13 26 Q20 22 27 26", 1, PAPER) + S("M17 34 V38 M23 34 V38", 1.5) + (v ? S("M2 38.5 Q20 36.5 38 38.5", 1.6) : ""); },
    pheasant: function () { return E(19, 24, 10, 7, -8) + C(28.5, 15, 4.4) + P("M28 11 L31 15 L28 21.5 L25 18 Z") + P("M32.6 13.6 L37 15 L32.6 16.6 Z") + C(29.4, 14.2, 1, PAPER) + S("M25.5 19 Q28.5 21 31 19", 1.3, PAPER) + P("M11 23 L-1 15 L0 12.5 L13 20 Z") + S("M17 30 L16 37 M22 30 L23 37", 1.4); },
    hen: function (v) { return P("M8 22 Q8 34 21 34 Q32 34 31 24 L33 17 Q34 10 28 10 Q23 10 23.5 16 L22 21 Q16 21 13 16 L9 7 L7 14 L4 9 L5 18 Z") + P("M25 10.4 Q25 6 27.6 7.4 Q28.8 4.6 31 7 Q33 6.8 32 10.6 Z") + P("M33 14.6 L37 16 L33 17.6 Z") + C(29.4, 13.6, 1.1, PAPER) + P("M31.5 18.5 Q33 22 30.5 22 Z") + S("M11 24 Q18 21 24 25", 1.1, PAPER) + S("M17 34 V38.5 M23 34 V38.5 M15 38.5 H19 M21 38.5 H25", 1.5) + (v === 1 ? S("M2 39 H38", 1.4) : ""); },
    goose: function () { return E(17, 27, 12, 7) + P("M24 24 Q27 20 26 13 Q25 5 30 4.5 Q35 4.5 35 8.5 L39 10 L34.5 11.2 Q31 11 30.5 14 Q31 22 28 27 Z") + C(32, 7.4, 1, PAPER) + S("M10 26 Q17 23 24 27", 1.1, PAPER) + S("M15 33.5 V38.5 M20 33.5 V38.5", 1.6) + S("M3 39 H37", 1.4); },
    pelican: function () { return E(14, 25, 11, 8) + P("M20 21 Q23 10 22 6 Q24 1.5 28.5 3 L40 9 L39 12 Q33 16 26 12.5 Q25 18 25 24 Z") + C(25, 5.8, 1, PAPER) + S("M27 7 L39.5 10.4", 0.9, PAPER) + P("M4 22 L-1 27 L5 27 Z") + S("M12 33 V37 M17 33 V37", 1.6) + S("M0 37.5 Q20 35.5 40 37.5", 1.6); },
    loon: function () { return P("M3 25 Q6 18 20 19 Q25 19 26 14 Q27 8.5 31.5 8.5 Q35 8.5 35.5 12 L40 14 L35 14.6 Q31.5 15 30.5 19 Q30 27 20 28 L6 28 Z") + C(32.6, 11.4, 1, PAPER) + S("M27.6 16.4 Q30 15.2 31 18", 1.2, PAPER) + C(12, 23, 0.9, PAPER) + C(16, 22, 0.9, PAPER) + C(20, 23, 0.9, PAPER) + C(14, 25.6, 0.9, PAPER) + C(18, 25.6, 0.9, PAPER) + S("M1 31 Q6 29 11 31 T21 31 T31 31 T40 31 M5 35 Q10 33 15 35 T25 35 T35 35", 1.5); },
    gull: function (v) { return P("M2 16 Q10 9 20 17 Q30 9 38 16 Q30 13 22 20 L20 23 L18 20 Q10 13 2 16 Z") + E(20, 22, 7, 3.4) + C(27, 20, 2.8) + P("M29.4 19.4 L33 20.4 L29.4 21.6 Z") + P("M13 22 L9 24 L14 24 Z") + (v === 1 ? S("M2 33 Q8 30 14 33 T26 33 T38 33", 1.5) : S("M4 32 L10 29 L16 32 M24 34 L28 32 L32 34", 1.4)); },
    woodpecker: function () { return P("M33 0 H39 V40 H33 Z") + P("M20 10 Q28 8 31 14 L31 30 Q28 36 22 37 L16 38 L20 32 Q14 26 15 18 Q15 12 20 10 Z") + C(23, 9.5, 5.2) + P("M18.5 8.4 L9 9.6 L18.6 11.4 Z") + C(22, 8.6, 1, PAPER) + P("M23 4.5 Q28 4 28.6 8.6 L25 8 Z", PAPER) + S("M19 19 Q22 24 20 30", 1.1, PAPER) + S("M30 22 L33.5 20 M30 27 L33.5 26", 1.5); },
    // ---- flowers
    blossom: function (v) { return stem(20, 24, 39, [[33, 1], [29, -1]]) + petals(20, 17, 5, 6.5, 4.6, 6, v * 18) + C(20, 17, 3.2, PAPER) + C(20, 17, 1.6) + (v === 2 ? petals(33, 7, 5, 2.6, 1.8, 2.4, 0) + C(33, 7, 1, PAPER) : ""); },
    dogwood: function (v) { return stem(20, 26, 39, [[33, 1]]) + petals(20, 17, 4, 7.4, 5.6, 7.6, 45 + v * 10) + C(13, 10, 1.1, PAPER) + C(27, 10, 1.1, PAPER) + C(13, 24, 1.1, PAPER) + C(27, 24, 1.1, PAPER) + C(20, 17, 2.8, PAPER) + petals(20, 17, 6, 1.4, 0.8, 0.8, 0); },
    rose: function (v) { return stem(20, 27, 39, [[31, 1], [35, -1]]) + P("M10 18 Q9 6 20 6 Q31 6 30 18 Q30 27 20 27 Q10 27 10 18 Z") + S("M20 11 Q25 11 24.5 16 Q24 20 19.5 20 Q15.5 20 15.5 16.5 Q16 13.5 19.5 14 M12 19 Q15 24 20 24 Q26 24 28 18.5", 1.2, PAPER) + (v === 1 ? P("M8 13 L4 9 L9 10 Z M32 13 L36 9 L31 10 Z") : ""); },
    wildrose: function (v) { return stem(20, 26, 39, [[31, -1], [35, 1]]) + petals(20, 17, 5, 6.6, 5.2, 6.2, v * 36) + C(20, 17, 3, PAPER) + petals(20, 17, 8, 2, 0.6, 0.6, 0) + S("M20 17 L20 17", 1); },
    poppy: function (v) { return S("M20 24 Q18 32 20 39", 1.8) + P("M9 12 Q8 26 20 27 Q32 26 31 12 Q27 17 24 9 Q20 16 16 9 Q13 17 9 12 Z") + S("M20 27 L20 13 M15 24 L13 15 M25 24 L27 15", 1, PAPER) + (v === 1 ? E(30, 33, 4, 1.8, -30) + E(10, 33, 4, 1.8, 30) : P("M22 34 Q30 30 33 33 Q28 36 22 34 Z")); },
    magnolia: function (v) { return E(14, 33, 8, 3.4, -20) + E(27, 33, 8, 3.4, 20) + P("M20 6 Q27 13 25 25 Q20 29 15 25 Q13 13 20 6 Z") + P("M7 14 Q15 15 18 27 Q11 28 7 14 Z M33 14 Q25 15 22 27 Q29 28 33 14 Z") + S("M20 10 Q22 17 20 26", 1, PAPER) + (v ? C(20, 27, 1.5, PAPER) : ""); },
    sunflower: function (v) { return stem(20, 28, 40, [[34, 1], [30, -1]]) + petals(20, 16, 14, 9, 2.4, 5.4, v * 12) + C(20, 16, 7, PAPER) + C(20, 16, 5.8) + C(18, 14.6, 0.8, PAPER) + C(21.8, 15, 0.8, PAPER) + C(20, 18.4, 0.8, PAPER); },
    daisy: function (v) { return stem(20, 25, 39, [[33, -1]]) + petals(20, 16, 12, 7.5, 1.9, 5, v * 15) + C(20, 16, 4.4) + C(19, 15, 1, PAPER); },
    bitterroot: function (v) { return E(13, 34, 6, 1.6, -15) + E(27, 34, 6, 1.6, 15) + petals(20, 22, 13, 8.5, 1.6, 6, v * 14) + C(20, 22, 3.4, PAPER) + C(20, 22, 1.8); },
    columbine: function (v) { return stem(20, 24, 39, [[33, 1]]) + P("M20 4 L23 12 L32 9 L26 16 L33 22 L24 20.5 L20 28 L16 20.5 L7 22 L14 16 L8 9 L17 12 Z") + petals(20, 16, 5, 3.4, 1.8, 2.8, 36, PAPER) + C(20, 16, 1.6) + (v ? S("M20 4 Q22 0 25 1 M32 9 Q36 7 37 10", 1.3) : ""); },
    forgetmenot: function (v) { return S("M20 39 Q19 30 16 24 M20 39 Q22 30 26 22", 1.4) + [[13, 16], [25, 12], [19, 24], [29, 22], [9, 26]].map(function (p, i) { return petals(p[0], p[1], 5, 2.4, 2, 2.4, (i + v) * 15) + C(p[0], p[1], 1, PAPER); }).join(""); },
    violet: function (v) { return P("M7 34 Q4 27 10 26 Q13 29 12 35 Z M33 34 Q36 27 30 26 Q27 29 28 35 Z") + S("M20 39 Q20 30 21 24", 1.6) + E(15, 13, 4.6, 5.6, -30) + E(25, 13, 4.6, 5.6, 30) + E(13.5, 21, 4.6, 4, -10) + E(26.5, 21, 4.6, 4, 10) + E(20, 23, 4.6, 5) + S("M18 22 L20 26 L22 22", 0.9, PAPER) + C(20, 19.5, 1.4, PAPER) + (v === 1 ? S("M10 31 L12 34 M30 31 L28 34", 0.9, PAPER) : ""); },
    peony: function (v) { return stem(20, 27, 39, [[32, 1], [32, -1]]) + petals(20, 17, 9, 7, 4.2, 6, v * 20) + petals(20, 17, 6, 3.6, 3, 4, 30, PAPER) + C(20, 17, 3); },
    carnation: function (v) { return S("M20 26 Q19 33 20 39", 1.8) + P("M10 33 L18 29 L17 31 Z M30 33 L22 29 L23 31 Z") + P("M16 27 L24 27 L23 20 L17 20 Z") + P("M7 14 L10 10 L12 13 L15 8 L17 12 L20 6 L23 12 L25 8 L28 13 L30 10 L33 14 L30 20 L10 20 Z") + S("M12 17 L16 13 M20 17 L20 11 M28 17 L24 13", 1, PAPER) + (v ? C(20, 22.6, 1, PAPER) : ""); },
    spike: function (v) { var s = S("M20 39 V6", 1.8) + E(15, 35, 5, 1.6, -30) + E(25, 34, 5, 1.6, 30); for (var i = 0; i < 6; i++) { var y = 8 + i * 4, w = 2.2 + i * 0.5; s += E(20 - w, y, w * 0.85, 1.9, -20 - v * 10) + E(20 + w, y, w * 0.85, 1.9, 20 + v * 10); } return s + C(20, 6, 2.2); },
    sage: function (v) { return S("M20 39 V24 M20 30 L13 22 M20 30 L27 21 M20 26 L17 15 M20 26 L24 14", 1.6) + [[13, 21], [10, 17], [16, 13], [20, 10], [25, 12], [29, 18], [24, 18], [15, 18], [21, 15]].map(function (p) { return E(p[0], p[1], 2.6, 1.5, (p[0] * 37 + v * 20) % 180); }).join("") + E(10, 38, 8, 1.4) + E(30, 38, 8, 1.4); },
    cluster: function (v) { var s = E(9, 31, 8, 3, 30) + E(31, 31, 8, 3, -30) + E(20, 34, 7, 2.6); [[20, 15], [14, 12], [26, 12], [13, 19], [27, 19], [20, 22], [17, 8], [23, 8]].forEach(function (p, i) { s += petals(p[0], p[1], 5, 2, 1.7, 2.1, i * 20 + v * 9) + C(p[0], p[1], 0.8, PAPER); }); return s; },
    clover: function (v) { return S("M20 39 Q19 30 20 25", 1.6) + P("M9 34 Q11 26 17 31 Q13 37 9 34 Z M31 34 Q29 26 23 31 Q27 37 31 34 Z") + C(20, 15, 9) + [[20, 7], [14, 10], [26, 10], [12, 16], [28, 16], [16, 21], [24, 21], [20, 14]].map(function (p) { return S("M" + p[0] + " " + (p[1] + 2.5) + " L" + p[0] + " " + p[1], 1.1, PAPER); }).join("") + (v ? E(20, 24.5, 6, 2, 0) : ""); },
    slipper: function (v) { return S("M20 39 V24", 1.8) + E(13, 34, 7, 2.4, -40) + E(27, 34, 7, 2.4, 40) + P("M13 15 Q12 26 20 27 Q28 26 27 15 Q20 18 13 15 Z") + S("M16 19 Q20 22 24 19", 1, PAPER) + P("M13 14 L4 8 L7 15 Z M27 14 L36 8 L33 15 Z M17 13 L20 3 L23 13 Z") + (v ? C(20, 23, 1, PAPER) : ""); },
    iris: function (v) { return S("M20 39 V24", 1.8) + P("M14 34 L16 22 L17 34 Z M26 34 L24 23 L23 34 Z") + P("M20 3 Q25 8 22.5 15 L20 17 L17.5 15 Q15 8 20 3 Z") + P("M19 16 Q10 12 6 18 Q9 26 18 21 Z M21 16 Q30 12 34 18 Q31 26 22 21 Z") + S("M10 18 L16 19 M30 18 L24 19", 1, PAPER) + (v ? P("M18 19 L20 26 L22 19 Z") : ""); },
    lily: function (v) { return S("M20 39 V22", 1.6) + E(15, 34, 5, 1.4, -45) + P("M20 21 Q8 18 9 7 Q16 10 20 21 Z M20 21 Q32 18 31 7 Q24 10 20 21 Z M20 21 Q15 12 20 3 Q25 12 20 21 Z") + C(20, 17, 1.6, PAPER) + (v ? S("M13 12 L16 14 M27 12 L24 14", 1, PAPER) : ""); },
    trumpet: function (v) { return S("M4 38 Q14 26 18 14 Q22 6 34 4", 1.5) + [[12, 26, 30], [20, 11, -20], [30, 5, -60]].map(function (p, i) { return '<g transform="rotate(' + (p[2] + v * 8) + ' ' + p[0] + ' ' + p[1] + ')">' + P("M" + (p[0] - 1.6) + " " + p[1] + " L" + (p[0] - 2) + " " + (p[1] + 8) + " L" + (p[0] + 2) + " " + (p[1] + 8) + " L" + (p[0] + 1.6) + " " + p[1] + " Z") + petals(p[0], p[1] + 9.4, 5, 2.2, 1.6, 2.2, 0) + '</g>'; }).join("") + E(9, 33, 3.6, 1.4, -40) + E(26, 9, 3.6, 1.4, -10); },
    berries: function (v) { return P("M6 18 L11 15 L10 11 L15 12 L17 7 L20 11 L24 9 L23 14 L28 15 L23 18 L24 22 L19 20 L16 24 L14 19 L9 21 Z") + S("M16 18 L22 34", 1.2) + [[22, 26], [26, 28], [19, 30], [23, 31], [27, 33], [20, 35], [24, 36], [29, 30]].map(function (p) { return C(p[0], p[1], 2.4) + C(p[0] - 0.7, p[1] - 0.7, 0.6, PAPER); }).join("") + (v ? petals(32, 12, 5, 2, 1.4, 1.8, 0) : ""); },
    saguaro: function (v) { return P("M16 39 V10 Q16 6 20 6 Q24 6 24 10 V39 Z") + P("M16 26 H10 Q7 26 7 22 V15 Q7 12.5 9.5 12.5 Q12 12.5 12 15 V21 H16 Z") + P("M24 22 H29 V17 Q29 14.5 31.5 14.5 Q34 14.5 34 17 V24 Q34 27 30 27 H24 Z") + S("M20 9 V37", 0.9, PAPER) + petals(20, 5, 5, 2.6, 1.8, 2.4, 0) + C(20, 5, 1.1, PAPER) + petals(9.5, 11.5, 5, 2, 1.4, 1.8, 0) + (v ? petals(31.5, 13.5, 5, 2, 1.4, 1.8, 0) : ""); },
    yucca: function (v) { var s = S("M20 38 V4", 1.6); [[8, -1], [12, 1], [16, -1], [20, 1], [24, -1], [28, 1]].forEach(function (b) { s += P("M" + (20 + b[1] * 1) + " " + b[0] + " l" + (b[1] * 5) + " 1.6 l" + (b[1] * -0.4) + " 3.6 l" + (b[1] * -3.6) + " -1.2 Z"); }); return s + P("M20 38 L5 27 L19 36 Z M20 38 L35 27 L21 36 Z M20 38 L10 22 L20.5 36 Z M20 38 L30 22 L19.5 36 Z") + (v ? P("M20 38 L1 33 L19 37.5 Z M20 38 L39 33 L21 37.5 Z") : ""); },
    pinecone: function (v) { var s = S("M20 6 Q18 1 12 2 M20 6 Q22 1 28 2 M20 6 L16 0 M20 6 L24 0 M20 6 Q14 4 9 7 M20 6 Q26 4 31 7", 1.1) + P("M20 7 Q30 11 28 25 Q26 35 20 38 Q14 35 12 25 Q10 11 20 7 Z"); for (var r = 0; r < 5; r++) { var y = 13 + r * 5; s += S("M" + (13.5 + r * 0.4) + " " + y + " Q20 " + (y + 3) + " " + (26.5 - r * 0.4) + " " + y, 1, PAPER); } return s + S("M20 10 V36", 0.9, PAPER) + (v ? S("M4 12 L9 7 M36 12 L31 7", 1) : ""); },
    hibiscus: function (v) { return E(10, 33, 6, 2.4, -30) + E(30, 33, 6, 2.4, 30) + petals(20, 19, 5, 7.6, 6.2, 7.6, 18 + v * 15) + S("M14 25 L19 20 M26 25 L21 20 M20 12 V18", 1, PAPER) + C(20, 19, 2.4, PAPER) + S("M20 19 L30 9", 1.7) + C(30.6, 8.4, 1.5) + C(28.4, 7, 1) + C(32, 10.4, 1); },
    // ---- animals
    deer: function (v) { var head = v === 1 ? "M28 21 Q31 27 35 30 L33.6 31.5 Q29 28 25.5 24 Z" : "M27 15 L29 9 Q31 6 34 7 L38 9 L37 11 L33 12 L30 18 Z"; var ant = v === 1 ? "" : S("M31 8 L29 2 M30 4.6 L27 3 M33 7.4 L35 1.6 M34.2 4 L37 3", 1.3); return P("M8 17 Q6 15 8 14 Q14 15 27 15 L30 18 Q31 23 28 25 L28 37 H26 L25 26 L13 26 L11 37 H9 L9.5 25 Q6 23 8 17 Z") + P(head) + ant + P("M7 15 L3 13 L5 17 Z") + (v === 2 ? C(14, 19, 0.9, PAPER) + C(18, 18, 0.9, PAPER) + C(16, 21.5, 0.9, PAPER) : C(32, 8.6, 0.8, PAPER)) + S("M2 38.4 Q20 36.6 38 38.4", 1.4); },
    elk: function (v) { return P("M6 17 Q6 14 10 14 Q16 15 26 14 L30 18 Q31 23 28 25 L28 37 H26 L25 26 L13 26 L11 37 H9 L9.5 25 Q5 23 6 17 Z") + P("M26 14 L28 8 Q30 5 33 6 L37 8.4 L36.4 10.6 L32 11.2 L30 17 Z M26 14 Q28 19 30 18 Z") + S("M30 6 Q26 2 22 2 M27 3.4 L26 0 M24.4 2.2 L23 -1 M33 5.6 Q35 1 39 0 M35.6 2.4 L37.8 4 M34 4 L36 -0.6", 1.3) + C(32, 7.6, 0.8, PAPER) + P("M24 20 Q27 24 29 22 L28 17 Z", PAPER) + (v ? S("M2 38.4 Q20 36.6 38 38.4", 1.4) : ""); },
    moose: function (v) { return P("M6 17 Q8 11 16 11 Q22 9 27 12 L29 16 Q30 22 28 24 L28 37 H26 L25 25 L13 25 L11 37 H9 L9 24 Q5 22 6 17 Z") + P("M26 13 L31 13 Q36 14 38 18 Q38.5 21 36 21 Q33 20.5 31 18 L28 18 Z") + P("M30 19 L30.5 25 L29 24.6 Z") + P("M28 11 Q23 4 21 6 Q20 2 23 1.6 L25 4 L25.5 0.4 L28 4 L29.5 0.6 Q31 6 29 11 Z") + P("M30 11 Q35 4 37 6 Q38.5 2 35.5 1.6 L34 4.4 L33 1 L31 5 Z") + C(32.6, 15, 0.8, PAPER) + (v ? S("M2 38.4 Q20 36.6 38 38.4", 1.4) : ""); },
    bear: function (v) { return P("M4 26 Q4 15 16 14 Q24 13 28 15 Q31 12 35 14 Q39 17 38.5 20 L36 21 Q33 23 31 23 L30 37 H25.5 L25 29 L14 29 L13 37 H8.5 L8 29 Q4 28 4 26 Z") + C(31, 13.6, 2.2) + C(35.5, 17, 0.9, PAPER) + C(38.5, 19.4, 1) + (v === 1 ? S("M2 38.4 Q20 36.4 38 38.4", 1.4) + P("M2 32 L5 24 L8 32 Z") : v === 2 ? S("M9 37 H6 M30 37 H33", 1.2) : ""); },
    grizzly: function (v) { return P("M4 27 Q3 16 13 13 Q18 9.5 24 13 Q27 13 29 15 Q32 12 35.5 14.4 Q39.5 17.6 38.5 20.4 L36 21.4 Q33 23.4 31 23 L30 37 H25.5 L25 29 L14 29 L13 37 H8.5 L8 29 Q4 28.5 4 27 Z") + C(31, 13.4, 2.2) + C(35.5, 17, 0.9, PAPER) + C(38.5, 19.6, 1) + S("M9 37 L7.5 39 M11 37 L10.5 39.2 M27 37 L26 39 M29 37 L29 39.2", 1) + S("M13 14 Q18 12 23 14", 0.9, PAPER) + (v ? S("M0 39.5 H40", 1.2) : ""); },
    bighorn: function (v) { return P("M6 19 Q6 15 11 15 Q18 16 26 15 L29 18 Q30 23 28 25 L28 37 H26 L25 26 L13 26 L11.5 37 H9.5 L9.5 25 Q6 23 6 19 Z") + P("M26 15 L29 10 Q31 7.4 34 8.4 L37 11.6 L36 13.4 L32 13.4 L30 18 Z") + P("M28.5 11 Q24 5 28 2.6 Q33 1 34 5.4 Q34.6 9 31 9.6 Q29 9.4 29.6 7.4 Q31.6 8.2 31.8 6 Q31.4 4 29 5 Q27.6 7 30 10.4 Z") + C(33, 10.4, 0.8, PAPER) + S("M10 17 Q17 19 25 17", 1, PAPER) + (v ? P("M0 39 L6 31 L10 35 L14 30 L20 39 Z") : S("M2 38.4 Q20 36.6 38 38.4", 1.4)); },
    cat: function (v) { return P("M5 22 Q5 17 11 17 L25 17 Q27 13 30 13 L31 10 L33 13 L35 11 L35.6 14.6 Q38 17 36.5 19.6 Q34.5 21 31 20.6 L29 24 L29 35 H27 L26 26 L14 26 L13 35 H11 L10.4 26 Q7 25 5 22 Z") + S(v ? "M5 21 Q-1 22 1 31 Q2 35 6 35" : "M5 20 Q0 15 2 9 Q3 6 6 7", 2.2) + C(33, 15.4, 0.9, PAPER) + S("M35 17.5 L39 16.6 M35 18.4 L39 19", 0.6) + S("M2 37 H38", 1.3); },
    ringtail: function (v) { return P("M10 24 Q10 18 16 18 L26 18 Q28 14 31 14 L32 11 L34.5 13.6 L38 16.6 L35.8 18.6 L31.6 19.6 L29 24 L29 33 H27 L26 27 L15 27 L14 33 H12 L12 27 Q10 26 10 24 Z") + P("M10 22 Q2 22 1.5 14 Q1 6 6 4 L7.5 6 Q4 9 5 14 Q6 19 11 19 Z") + S("M2.4 11 L6 10.6 M2 15.6 L5.6 15 M4.6 19.4 L7.6 17.4 M4 6.6 L6.6 7.6", 1.3, PAPER) + C(32.4, 15.6, 1.2, PAPER) + C(32.6, 15.6, 0.6) + (v ? S("M4 34 L36 34", 1.4) : S("M1 36 Q12 31 20 34 T39 33", 1.4)); },
    fox: function (v) { return P("M9 21 Q9 16 15 16 L25 16 Q26 12 29 11 L29.5 6.5 L32 10 L34 8 L33.6 12 L39 16 L37.8 17.6 L32 18 L29 22 L29 34 H27 L26 26 L15 26 L14 34 H12 L11.6 26 Q9 25 9 21 Z") + P("M10 20 Q2 18 1 26 Q0 33 6 34 Q4 28 11 25 Z") + S("M1.4 29 Q2.6 33 6 34", 2, PAPER) + C(32, 13, 0.8, PAPER) + (v ? C(37.6, 16.8, 0.8) : "") + S("M2 36.4 H38", 1.3); },
    coyote: function (v) { return P("M11 37 L12 24 Q12 17 18 16 L20 9 Q21 5 24 6 L25 1.5 L27 5.6 L29 3.5 L28.6 7.6 L34 4 L35 5.6 L29 11 L26 14 Q28 20 28 26 L29 37 H26 L25 30 L22 30 L21 37 Z") + P("M12 30 Q4 30 2 36 Q6 38.4 12 35 Z") + C(25.6, 7, 0.8, PAPER) + (v ? C(34, 3, 3) + C(33, 2.4, 3, PAPER) : S("M28 2 Q32 0 33 3 M30 -0.5 Q36 -1 36 4", 0.9)) + S("M0 38.6 H40", 1.3); },
    dog: function (v) { return P("M6 20 Q6 15 12 15 L25 15 Q26 9 31 8.5 Q35 8.4 36 11 L39 13 L38.4 16 L33 16.4 L30 21 L29.6 35 H27.4 L26.4 25 L14 25 L13 35 H10.8 L10.2 25 Q6 24 6 20 Z") + P("M29 9.4 Q26 11 27 17 L30.4 15.6 Q30.8 11 29 9.4 Z", PAPER) + S("M29 9.4 Q26 11 27 17", 1.2) + C(33, 11.4, 0.9, PAPER) + S("M7 17 Q2 16 1 11", 2.4) + S("M10 19 Q16 21 22 19", 0.9, PAPER) + (v ? P("M33 18 L37 22 L35 24 Z") : "") + S("M2 37 H38", 1.3); },
    squirrel: function (v) { return P("M18 20 Q16 30 20 34 L28 34 Q31 31 30 24 Q32 21 32 17 L34 15.6 Q37 16 37.6 14 Q37.4 10 34 9 L33 6 L31 8.6 Q27 9 26 13 Q20 13 18 20 Z") + P("M19 24 Q8 26 6 16 Q4 6 12 3 Q19 1.4 21 8 Q17 6.4 14 9 Q12 12.4 14 16 Q16 20 20 19 Z") + S("M10.4 8 Q8 13 11 18", 1, PAPER) + C(33.6, 11.6, 0.9, PAPER) + E(31, 23, 2.6, 1.6, 30, PAPER) + E(31, 23, 1.6, 0.9, 30) + (v ? C(36, 20, 2) + S("M36 18 V16.6", 1) : "") + S("M2 35.4 H38", 1.3); },
    bison: function (v) { return P("M4 24 Q3 17 9 15 Q14 8 22 9 Q30 9 32 14 L34 17 Q38 19 38 24 L36 27 Q34 30 32 29 L31 37 H28 L27.4 30 L15 30 L13.6 37 H10.6 L10 30 Q5 29 4 24 Z") + S("M33 14 Q36 12 36 9.6", 1.6) + C(34.4, 19, 0.9, PAPER) + P("M30 26 Q33 32 31 33 Q28 31 29 26 Z") + S("M4 22 Q0 23 1 28", 1.4) + S("M17 12 Q21 10 25 12 M14 16 Q19 14 24 15", 0.9, PAPER) + (v ? S("M0 39 H40", 1.3) + P("M4 39 L6 35 L7 39 M33 39 L35 34.6 L37 39") : S("M2 38.4 H38", 1.3)); },
    horse: function (v) { var ears = v === 9 ? "M27.4 9 L25 0.5 L29 8 Z M29.6 8.4 L29.6 -0.4 L31.4 8 Z" : "M28 8.4 L27.6 4 L29.6 7.4 Z"; return P("M6 17 Q6 13 11 13 L24 13 Q26 8 28.5 7.4 Q31 7 33 9 L38 15 L37 17.2 L34 17.2 L30 14 L29 22 L28.5 36 H26.4 L25.6 24 L13 24 L12 36 H9.8 L9.6 23 Q6 21.6 6 17 Z") + P(ears) + P("M26 9 Q21 11 23 16 L27 14 Z") + P("M7 15 Q1 17 2.4 28 Q3 24 7.4 20 Z") + C(31.4, 10.8, 0.9, PAPER) + (v === 1 ? C(14, 17, 1.1, PAPER) + C(18, 15.6, 0.9, PAPER) + C(11, 19.6, 0.9, PAPER) + C(16, 20.4, 0.8, PAPER) : "") + S("M2 37.6 H38", 1.3); },
    mule: function (v) { return G.horse(9) + (v ? S("M30 18 Q33 21 36 18", 1, PAPER) : ""); },
    beaver: function (v) { return P("M7 28 Q6 18 17 15 Q26 13 31 18 Q34 16 36 18 Q39 21 37 23.6 L34 24 Q32 29 26 31 L14 32 Q8 32 7 28 Z") + P("M9 27 Q1 27 0.6 33 Q1.6 37 8 34 Q11 31 12 30 Z") + S("M1.6 31 L7 30 M2.4 34 L7 32.6", 0.8, PAPER) + C(32.6, 18.6, 0.9, PAPER) + P("M35 23 L35 26 L36.6 25.6 L36.6 23 Z", PAPER) + C(31.6, 15.6, 1.4) + S("M20 31 L19 34 M28 30 L29 33.6", 1.6) + (v ? S("M0 37 Q10 35 20 37 T40 37", 1.3) : S("M4 36.4 H38", 1.3)); },
    raccoon: function (v) { return P("M10 23 Q10 16 17 16 L26 16 Q28 12 31 12 L32 8.6 L34.4 11.4 L36 10 L36 13.6 L39 17 L37.6 19 L32 19.6 L29 23 L29 33 H27 L26 27 L15 27 L14 33 H12 L12 27 Q10 26 10 23 Z") + P("M10.4 20 Q2 19 1.6 27 Q2 33 7 33.4 Q5 28 11 24 Z") + S("M2.6 24 L7.6 23 M2.4 28.6 L7 27.4 M4 32 L8 30", 1.3, PAPER) + P("M30 13.6 L37.4 15.6 L36 17 L30.4 16.4 Z", PAPER) + C(33, 15, 1) + (v ? S("M2 35 H38", 1.3) : S("M2 35 Q12 33 20 35 T38 35", 1.3)); },
    armadillo: function (v) { var s = P("M6 30 Q5 16 19 15 Q31 15 33 26 L37 25 Q40 27 38.5 29 L33 30 L32 34 H29 L28.6 31 L13 31 L12 34 H9 L8.6 31 Z") + P("M6 29 Q1 29 0 33 Q4 31 7 31.4 Z"); for (var i = 0; i < 5; i++) s += S("M" + (11 + i * 4.4) + " 16.6 Q" + (10 + i * 4.4) + " 23 " + (11 + i * 4.4) + " 30", 1, PAPER); return s + P("M30 18 L31.6 13.6 L33 18.6 Z") + C(34.6, 26.4, 0.8, PAPER) + S("M1 36 H39", 1.3) + (v ? P("M30 36 L33 31 L36 36 Z") : ""); },
    badger: function (v) { return P("M3 30 Q2 21 13 19 Q24 18 30 21 L36 25 Q39.6 27 38.4 29.6 L34 30 L32 34 H29 L28.4 31 L13 31 L11.6 34 H8.6 L8 31 Q3 31 3 30 Z") + P("M29 21 L38 27.6 L36 28.4 L28 23 Z", PAPER) + C(33.6, 24.6, 0.8) + S("M10 20 Q16 18.4 24 19.4", 1, PAPER) + S("M9 34 L7.4 36 M31 34 L29.4 36", 1) + (v ? S("M0 36.6 Q12 34.6 22 36.6 T40 36", 1.3) : S("M0 36.4 H40", 1.3)); },
    whale: function (v) { return P("M2 22 Q2 14 14 13 L30 13 Q37 13 38 19 Q38 26 30 27 Q20 29 12 26 L5 24 L0 30 L-1 21 L4 19 Z") + S("M14 23 Q22 25 31 23", 1, PAPER) + C(33, 17, 0.9, PAPER) + P("M18 26 L16 31 L22 27 Z") + S("M34 11 Q33 7 35 5 M34 11 Q36 7 39 7.4", 1.1) + S("M0 34 Q5 32 10 34 T20 34 T30 34 T40 34", 1.4) + (v ? S("M5 38 Q10 36 15 38 T25 38 T35 38", 1.2) : ""); },
    orca: function (v) { return P("M2 22 Q6 15 18 15 L20 6 L24 15 Q35 15 39 21 Q36 26 26 27 L12 27 L5 25 L0 30 L0 21 Z") + E(31, 19.6, 3, 1.4, 10, PAPER) + P("M10 24 Q20 30 33 24 Q22 27 10 24 Z", PAPER) + P("M19 26 L17 31 L23 27 Z") + S("M0 34 Q5 32 10 34 T20 34 T30 34 T40 34", 1.4) + (v ? S("M5 38 Q10 36 15 38 T25 38 T35 38", 1.2) : ""); },
    seal: function (v) { return P("M3 30 Q2 26 8 24 Q18 21 24 16 Q28 12 32 13 Q37 14 37 18 Q37 21 34 22 Q31 26 30 30 L24 31 L10 32 Q4 32 3 30 Z") + P("M4 29 L-1 25 L0 31 L-1 34 L5 31.6 Z") + C(33.4, 16.4, 1, PAPER) + S("M36.6 19 L40 18 M36.4 20 L40 20.6", 0.6) + P("M22 30 L19 35 L26 31 Z") + (v ? S("M0 36.4 Q10 34.4 20 36.4 T40 36.4", 1.4) : P("M0 34 Q20 31 40 34 L40 38 L0 38 Z")); },
    bat: function (v) { return P("M20 14 Q23 14 23 18 L24 13.6 L25.6 17 Q30 12 38 13 Q35 15 36 19 Q32 18 31 22 Q27 20 25 24 Q22 22 20 26 Q18 22 15 24 Q13 20 9 22 Q8 18 4 19 Q5 15 2 13 Q10 12 14.4 17 L16 13.6 L17 18 Q17 14 20 14 Z") + C(18.6, 17, 0.7, PAPER) + C(21.4, 17, 0.7, PAPER) + (v ? C(31, 5, 4) + C(32.6, 4, 3.6, PAPER) : C(8, 5, 0.7) + C(33, 31, 0.7) + C(14, 33, 0.6)); },
    // ---- places and nature (countries, parks, generated stamps)
    thistle: function () { return S("M20 39 V22", 1.8) + P("M20 30 L9 26 L13 29 L7 31 L14 32 L20 33 Z M20 28 L31 24 L27 27 L33 29 L26 30 L20 31 Z") + E(20, 20, 6, 5) + S("M16 18 L24 22 M24 18 L16 22", 0.9, PAPER) + P("M15 15 L13 4 L17 13 L17.6 2.6 L20 13 L22.4 2.6 L23 13 L27 4 L25 15 Z"); },
    tower: function () { return P("M11 39 V14 H9 V8 H12 V11 H15 V8 H18 V11 H22 V8 H25 V11 H28 V8 H31 V14 H29 V39 Z") + P("M17 39 V31 Q20 27 23 31 V39 Z", PAPER) + P("M18.6 17 H21.4 V22 H18.6 Z", PAPER) + S("M2 39 H38", 1.3); },
    hills: function () { return C(30, 9, 5) + P("M-1 30 Q10 16 22 26 Q30 18 41 24 V40 H-1 Z") + S("M2 33 Q12 27 20 32 M22 31 Q30 26 38 30", 1, PAPER) + P("M8 21 L10 15 L12 21 Z M14 20 L16 13 L18 20 Z"); },
    dragon: function () { return P("M3 30 Q2 24 8 25 Q14 26 18 22 L22 20 Q24 14 28 12 L31 9 L33 11 L36 11 L39 14 L34.6 15.4 L32 18 Q30 24 26 27 L27.4 35 H24.6 L23 28.6 L16.6 30 L16.4 35 H13.6 L13 30.4 Q8 31 5 34 Q2 36 0 33 Q4 33 3 30 Z") + P("M17 22 L11 6 L17 11 L19 4 L23 11 L27 7 L24 19 Z") + P("M0 33 L-1.4 28.6 L3 31 Z") + C(33.6, 12.4, 0.8, PAPER) + S("M13 7.6 L19 20 M19.4 6 L21 19", 0.8, PAPER) + S("M19 27 Q22 25 26 26", 0.9, PAPER) + S("M1 38 H39", 1.3); },
    columns: function () { var s = "", hs = [[4, 24], [10, 16], [16, 20], [22, 12], [28, 18], [34, 26]]; hs.forEach(function (h) { s += P("M" + h[0] + " 40 V" + (h[1] + 2) + " L" + (h[0] + 3) + " " + h[1] + " L" + (h[0] + 6) + " " + (h[1] + 2) + " V40 Z") + S("M" + (h[0] + 0.6) + " " + (h[1] + 2.6) + " H" + (h[0] + 5.4), 0.8, PAPER); }); return s + S("M0 34 Q10 31 20 34 T40 34", 1.2, PAPER); },
    shamrock: function () { var leaf = C(-3.4, -3, 4.6) + C(3.4, -3, 4.6) + P("M-7.8 -1.6 L0 7 L7.8 -1.6 Z"); return S("M20 24 Q21 33 27 39", 2.2) + [0, 120, 240].map(function (r) { return '<g transform="rotate(' + r + ' 20 21) translate(20 12.5)">' + leaf + '</g>'; }).join("") + S("M20 21 L20 15 M20 21 L14.6 24 M20 21 L25.4 24", 0.9, PAPER); },
    lattice: function () { return P("M10 39 Q17 26 17.4 14 L19 3 H21 L22.6 14 Q23 26 30 39 H25 Q20 30 15 39 Z") + P("M15 22 H25 V24 H15 Z M17 13 H23 V14.6 H17 Z") + S("M14 34 L26 27 M26 34 L14 27 M17 20 L23 16 M23 20 L17 16", 0.8, PAPER) + S("M4 39 H36", 1.3); },
    maple: function () { return P("M20 2 L22.4 8.6 L26 6.6 L25 14.4 L30.4 9.6 L31.6 12.6 L37 11.6 L35 17 L38 18.4 L29.6 25 L31 28.4 L22 27.4 L21 37 H19 L18 27.4 L9 28.4 L10.4 25 L2 18.4 L5 17 L3 11.6 L8.4 12.6 L9.6 9.6 L15 14.4 L14 6.6 L17.6 8.6 Z") + S("M20 26 V10 M20 22 L12 16 M20 22 L28 16", 0.8, PAPER); },
    fuji: function () { return P("M-1 38 L14 14 Q20 9 26 14 L41 38 Z") + P("M14 14 Q20 9 26 14 L29 19 L26 18 L23.4 21 L20 17.6 L16.6 21 L14 18 L11 19 Z", PAPER) + C(32, 7, 3.6) + S("M0 34 Q10 31 20 34 T40 34", 1, PAPER); },
    gate: function () { return P("M3 7 Q20 11 37 7 L36 11.4 Q20 14 4 11.4 Z") + P("M7 16 H33 V18.6 H7 Z") + P("M10 11 H13.6 V39 H10 Z M26.4 11 H30 V39 H26.4 Z") + P("M18.6 13 H21.4 V16 H18.6 Z") + S("M2 39 H38", 1.4); },
    cactus: function () { return P("M17 39 V11 Q17 7 20 7 Q23 7 23 11 V39 Z") + P("M17 27 H11 Q8 27 8 23 V16 Q8 14 10 14 Q12 14 12 16 V22 H17 Z") + P("M23 23 H28 V18 Q28 16 30 16 Q32 16 32 18 V24 Q32 28 28 28 H23 Z") + S("M20 10 V37", 0.9, PAPER) + C(33, 6, 3.6) + S("M2 39 H38", 1.4); },
    sun: function () { var s = C(20, 20, 8.4) + C(20, 20, 5.4, PAPER) + C(20, 20, 3.4); for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; s += S("M" + (20 + 11 * Math.cos(a)).toFixed(1) + " " + (20 + 11 * Math.sin(a)).toFixed(1) + " L" + (20 + (i % 2 ? 15 : 18) * Math.cos(a)).toFixed(1) + " " + (20 + (i % 2 ? 15 : 18) * Math.sin(a)).toFixed(1), 2); } return s; },
    pagoda: function () { return P("M20 1 L22 5 H18 Z") + P("M9 9 Q20 5 31 9 L27 10.4 H13 Z M14 10 H26 V14 H14 Z") + P("M6 17 Q20 12 34 17 L29 18.6 H11 Z M13 18 H27 V23 H13 Z") + P("M3 26 Q20 20 37 26 L31 27.6 H9 Z M11 27 H29 V39 H11 Z") + P("M18 39 V32 H22 V39 Z", PAPER) + S("M2 39 H38", 1.3); },
    windmill: function () { return P("M14 39 L16.5 16 H23.5 L26 39 Z") + P("M17 39 V33 Q20 30 23 33 V39 Z", PAPER) + P("M15.5 16 L20 11 L24.5 16 Z") + '<g transform="rotate(20 20 13)">' + P("M19 13 L19 -3 L23 -3 L21 13 Z M21 13 L37 13 L37 17 L21 15 Z M21 13 L21 29 L17 29 L19 13 Z M19 13 L3 13 L3 9 L19 11 Z") + '</g>' + C(20, 13, 1.6, PAPER) + S("M0 39 H40", 1.3); },
    tulip: function () { return S("M20 39 V20", 1.8) + P("M20 34 Q10 30 9 22 Q16 25 20 32 Z M20 36 Q29 30 31 24 Q24 26 20 33 Z") + P("M12 7 L16 11 L20 5 L24 11 L28 7 Q29 19 20 21 Q11 19 12 7 Z") + S("M20 9 V19", 0.9, PAPER); },
    palm: function () { return P("M18 39 Q20 26 19 16 L21.6 16 Q23 27 22 39 Z") + P("M20 15 Q10 8 2 13 Q10 10 18 16 Z M20 15 Q30 7 38 12 Q30 10 22 16 Z M20 15 Q14 4 6 4 Q14 7 19 16 Z M20 15 Q27 3 34 4 Q26 7 21 16 Z M20 15 Q21 5 19 0 Q23 5 21.5 15 Z") + C(19, 17.6, 1.6) + C(22, 17.4, 1.6) + S("M0 37 Q10 34 20 37 T40 37", 1.3); },
    kangaroo: function () { return P("M10 37 L13 31 Q11 24 15 18 Q18 13 22 13 L24 8 L25 3 L26.6 7 L28 3.4 L28 8 Q32 9 33 12 L31 13.6 L28 13 Q27 19 26 25 L28 31 L34 33 L33 34.6 L24 34 Q22 30 20 31 L15 34 Z") + P("M14 31 Q6 35 0 39 L2 40 Q9 37 16 33 Z") + S("M26 17 L30 21", 1.4) + C(28.4, 9.6, 0.7, PAPER) + S("M0 39.6 H40", 1.2); },
    kiwi: function () { return E(18, 24, 12, 10) + C(28, 17, 4.4) + S("M31 18 Q36 25 39 32", 1.4) + C(29, 15.6, 0.8, PAPER) + S("M14 33 L12 38 M20 34 L21 38 M10 38 H14 M19 38 H23", 1.4) + S("M10 20 Q14 18 18 20 M9 25 Q14 23 19 25", 0.8, PAPER); },
    elephant: function () { return P("M4 24 Q4 12 17 12 Q24 12 27 15 Q31 12 35 15 Q38 19 36 26 L37 34 L39 35 L38 36.4 L35 36 L34 27 L32 26 L31 36 H27 L26.6 29 L14 29 L13 36 H9 L8.6 28 Q4 27 4 24 Z") + P("M27 15 Q24 17 25 24 L29 25 Q31 19 30 15.4 Z", PAPER) + S("M27 15 Q24 17 25 24 L29 25", 1.1) + C(32.6, 18.6, 0.8, PAPER) + S("M33 22 L29 24", 1.1, PAPER) + S("M4 22 Q1 24 1.6 28", 1.2) + S("M0 37 H40", 1.3); },
    pyramid: function () { return P("M2 36 L18 8 L34 36 Z") + P("M18 8 L34 36 L26 36 Z", PAPER) + S("M18 8 L34 36 L26 36", 1.2) + P("M28 36 L35 24 L40 36 Z") + C(32, 6, 3.6) + S("M0 37.4 H40", 1.4); },
    arches: function () { var s = P("M2 38 V10 Q20 3 38 10 V38 Z"); [6, 15, 24].forEach(function (x) { s += P("M" + x + " 38 V31 Q" + (x + 3.6) + " 27 " + (x + 7.2) + " 31 V38 Z", PAPER) + P("M" + x + " 24 V19 Q" + (x + 3.6) + " 15.4 " + (x + 7.2) + " 19 V24 Z", PAPER); }); return s + S("M2 26.6 H38 M2 14 Q20 9 38 14", 1, PAPER); },
    temple: function () { var s = P("M3 13 L20 4 L37 13 Z") + P("M4 14 H36 V17 H4 Z M3 35 H37 V39 H3 Z"); [6, 12.6, 19.2, 25.8, 32.4].forEach(function (x) { s += P("M" + x + " 18 H" + (x + 3.2) + " V34 H" + x + " Z"); }); return s; },
    ship: function () { return P("M2 26 Q4 35 12 35 H28 Q36 35 38 26 Q30 29 20 29 Q10 29 2 26 Z") + P("M2 26 L0 21 L3 23 Z M38 26 L40 20 L37 23 Z") + S("M20 28 V3", 1.6) + P("M10 6 H30 L29 22 H11 Z") + S("M10 14 H30 M20 6 V22", 0.9, PAPER) + C(9, 28.6, 1, PAPER) + C(15, 29.6, 1, PAPER) + C(25, 29.6, 1, PAPER) + C(31, 28.6, 1, PAPER) + S("M0 38 Q5 36 10 38 T20 38 T30 38 T40 38", 1.3); },
    peaks: function () { return P("M-1 38 L12 14 L18 24 L26 8 L41 38 Z") + P("M12 14 L15.6 20.6 L13.4 19.6 L11.6 21.4 L9.6 18.6 Z M26 8 L31 17.6 L28.6 16.6 L26 19 L23.4 16.6 L21 18 Z", PAPER) + S("M4 33 L10 29 M24 32 L32 26", 0.9, PAPER); },
    edelweiss: function () { return S("M20 39 V24", 1.6) + E(15, 33, 5, 1.6, -30) + E(25, 31, 5, 1.6, 30) + petals(20, 16, 9, 8.6, 2.6, 6.4, 0) + petals(20, 16, 9, 8.6, 1, 4, 0, PAPER) + C(20, 16, 3.6) + C(18.6, 15, 0.8, PAPER) + C(21.6, 17, 0.8, PAPER); },
    geyser: function () { return P("M14 38 Q16 26 18 16 Q14 14 15 9 Q15 4 20 4 Q25 4 25 9 Q26 14 22 16 Q24 26 26 38 Z") + C(11, 10, 4) + C(29, 10, 4) + C(13.6, 4.6, 3) + C(26.4, 4.6, 3) + S("M18 13 V35", 1, PAPER) + P("M0 38 Q20 32 40 38 V40 H0 Z"); },
    rockarch: function () { return P("M2 38 V22 Q2 6 20 6 Q38 6 38 22 V38 H29 V24 Q29 15 20 15 Q11 15 11 24 V38 Z") + S("M6 26 V36 M33 26 V36 M11 10 Q20 7 29 10", 0.9, PAPER) + S("M0 39 H40", 1.3); },
    canyon: function () { return P("M-1 10 H12 L14 18 H18 L20 28 L22 40 H-1 Z") + P("M41 6 H28 L26 15 H24 L23 26 L22 40 H41 Z") + C(20, 5, 3.4) + S("M0 18 H10 M0 26 H15 M41 15 H29 M41 25 H26", 1, PAPER) + S("M19 32 Q21 36 20 40", 1.4); },
    waterfall: function () { return P("M0 4 H16 V34 H0 Z M24 4 H40 V34 H24 Z") + S("M18 6 V32 M20.5 6 V34 M23 6 V32", 1.3) + S("M2 38 Q8 34 14 37 Q20 34 26 37 Q32 34 38 38", 1.4) + S("M3 12 H12 M28 14 H37", 0.9, PAPER); },
    volcano: function () { return P("M-1 38 L14 13 H26 L41 38 Z") + P("M14 13 L17 18 L20 15 L23 19 L26 13 Z", PAPER) + C(16, 7, 3.6) + C(22, 4.6, 4) + C(27, 8.6, 3) + S("M19 21 L17 30 M22 22 L24 31", 1.1, PAPER); },
    dunes: function () { return P("M-1 30 Q12 16 26 28 Q33 22 41 26 V40 H-1 Z") + S("M4 34 Q14 26 22 33 M26 33 Q32 29 38 31", 1, PAPER) + C(30, 9, 5) + S("M2 22 Q8 18 12 21", 1.2); },
    pine: function () { return P("M20 1 L28 12 H24 L31 22 H26 L34 33 H6 L14 22 H9 L16 12 H12 Z") + P("M18 33 H22 V39 H18 Z") + S("M1 39 H39", 1.3) + S("M16 18 L20 15 L24 18 M13 28 L20 24 L27 28", 0.9, PAPER); },
    sequoia: function () { return P("M16 39 L17 18 H23 L24 39 Z") + C(20, 10, 9) + C(13, 16, 6) + C(27, 16, 6) + S("M19.4 22 V37", 1, PAPER) + S("M1 39 H39", 1.3); },
    cave: function () { return P("M-1 38 Q0 8 20 6 Q40 8 41 38 Z") + P("M9 38 Q10 18 20 17 Q30 18 31 38 Z", PAPER) + P("M14 18 L16 25 L18 18 Z M22 18 L24 27 L26 18.6 Z") + S("M0 39 H40", 1.3); },
    wave: function () { return P("M0 30 Q4 12 20 10 Q32 9 36 18 Q30 14 25 18 Q31 20 30 26 Q24 22 20 26 Q16 32 0 34 Z") + S("M0 37 Q5 35 10 37 T20 37 T30 37 T40 37", 1.4) + C(33, 6, 3.4); },
    star: function () { return P("M20 2 L24.7 14.5 L38 15 L27.6 23.4 L31.2 36.4 L20 29 L8.8 36.4 L12.4 23.4 L2 15 L15.3 14.5 Z") + P("M20 9 L22.6 16.4 L30 16.6 L24.2 21.4 L26.2 28.6 L20 24.4 L13.8 28.6 L15.8 21.4 L10 16.6 L17.4 16.4 Z", PAPER) + C(20, 20, 3); },
    llama: function () { return P("M8 22 Q8 17 14 17 L23 17 L24 7 L23 3.6 L25 5 L26 2.6 L27 5.4 Q31 6 31 9 L28 10 L28 20 Q29 25 27 27 L27 37 H25 L24.4 28 L14 28 L13 37 H11 L10.6 27 Q8 26 8 22 Z") + C(27.4, 7, 0.7, PAPER) + S("M10 21 Q16 23 22 21 M24 12 V20", 0.9, PAPER) + S("M2 38 H38", 1.3); },
    balloon: function () { return P("M20 2 Q32 2 32 14 Q32 22 23 28 H17 Q8 22 8 14 Q8 2 20 2 Z") + S("M20 2 Q14 14 17 28 M20 2 Q26 14 23 28 M9 12 H31", 1, PAPER) + S("M17 28 L17.5 32 M23 28 L22.5 32", 1) + P("M16.6 32 H23.4 V37 H16.6 Z") + S("M1 39 Q10 35 20 39 T40 38", 1.2); },
    lotus: function () { return P("M20 4 Q27 13 20 30 Q13 13 20 4 Z") + P("M20 30 Q6 26 6 12 Q15 16 20 30 Z M20 30 Q34 26 34 12 Q25 16 20 30 Z") + P("M20 30 Q4 31 0 22 Q11 21 20 30 Z M20 30 Q36 31 40 22 Q29 21 20 30 Z") + S("M20 10 V26", 0.9, PAPER) + S("M2 35 Q11 32 20 35 T38 35", 1.3); },
    acacia: function () { return P("M2 14 Q6 7 15 9 Q20 5 26 9 Q35 7 38 14 Q30 17 20 16 Q10 17 2 14 Z") + S("M20 39 L20 26 L12 16 M20 26 L28 16 M20 30 L23 21", 2) + S("M0 39 H40", 1.3) + P("M30 39 Q33 33 36 39 Z"); },
    giraffe: function () { return P("M9 22 Q10 17 16 17 L22 17 L26 5 L25 2 L27.4 3.4 L28.6 1.6 L29 4.6 Q33 5 34 8 L30 9 L26 19 Q27 23 25 25 L25 37 H23 L22 26 L15 26 L14 37 H12 L11.6 26 Q9 25 9 22 Z") + C(16, 20.6, 1.5, PAPER) + C(20, 19.6, 1.4, PAPER) + C(18, 23.6, 1.2, PAPER) + C(25, 13, 1.1, PAPER) + C(26.4, 9.4, 1, PAPER) + S("M2 38 H38", 1.3); },
    parrot: function () { return P("M14 36 L18 24 Q12 18 15 10 Q18 3 25 4 Q30 5 31 10 L35 12 Q36 16 32 17 L29 15 Q28 22 22 26 L19 39 Z") + C(26, 9, 1.4, PAPER) + C(26, 9, 0.6) + P("M31 10.6 Q34 13 32 16.4 L29.6 14 Z", PAPER) + S("M17 14 Q20 20 18 25", 1, PAPER) + S("M4 30 H32", 2.2); },
    dome: function () { return P("M10 30 Q10 14 20 10 Q30 14 30 30 Z") + P("M19 10 L20 3 L21 10 Z") + P("M4 30 H36 V39 H4 Z") + P("M2 20 H5 V39 H2 Z M35 20 H38 V39 H35 Z M2.6 20 L3.5 15 L4.4 20 Z M35.6 20 L36.5 15 L37.4 20 Z") + P("M17 39 V33 Q20 30 23 33 V39 Z", PAPER) + S("M14 22 Q20 18 26 22", 0.9, PAPER); },
    olive: function () { return S("M4 36 Q18 24 34 6", 1.8) + [[10, 30, -60], [15, 25, 20], [19, 21, -60], [24, 16, 20], [27, 12, -60], [31, 8, 20]].map(function (l) { return E(l[0], l[1], 5, 1.8, l[2]); }).join("") + E(13, 32, 2.2, 3) + E(22, 23, 2.2, 3) + E(29, 15, 2, 2.6); },
    clock: function () { return P("M14 39 V12 L20 2 L26 12 V39 Z") + C(20, 16, 3.6, PAPER) + S("M20 16 V14 M20 16 H21.6", 1) + P("M17.6 39 V31 Q20 28 22.4 31 V39 Z", PAPER) + S("M14 22 H26 M14 26 H26", 0.9, PAPER) + S("M2 39 H38", 1.3); },
    compass: function () { return C(20, 20, 16) + C(20, 20, 13, PAPER) + P("M20 6 L24 20 L20 34 L16 20 Z") + P("M20 20 L24 20 L20 34 Z", PAPER) + S("M20 20 L24 20 L20 34", 0.9) + P("M6 20 L20 17.6 L34 20 L20 22.4 Z") + C(20, 20, 1.6, PAPER); },
    plane: function () { return P("M2 21 L14 20 L22 6 H26 L21 20 L33 19.6 L37 14 H40 L38 21 L40 28 H37 L33 22.4 L21 22 L26 36 H22 L14 22 L2 21 Z") + S("M0 32 Q6 30 12 32", 1); },
    leaf: function () { return P("M6 34 Q4 12 34 6 Q36 34 6 34 Z") + S("M6 34 Q18 22 30 10 M14 26 L12 19 M14 26 L22 25 M21 19 L20 13 M21 19 L28 18", 1, PAPER); },
    mountainlake: function () { return P("M0 26 L12 10 L18 18 L26 6 L40 26 Z") + P("M12 10 L15 14 L12 13.4 L9.6 13.4 Z M26 6 L30 12 L27 11 L24 12.6 L22.6 11 Z", PAPER) + S("M2 30 H38 M6 34 H34 M10 38 H30", 1.3); }
  };

  // ---------- countries: hand tuned for the most visited, the rest made from the code ----------
  // code: shape, border, ink (palette key or index), motif, font, label
  var COUNTRY = {
    ENG: "shield|double|red|rose|serif|ARRIVAL", SCT: "octagon|toothed|violet|thistle|slab|WELCOME", WLS: "arch|dashed|green|dragon|sans|CROESO",
    NIR: "hexagon|dotted|blue|columns|cond|ENTRY", IRL: "circle|toothed|green|shamrock|serif|FÁILTE", GBR: "rect|double|blue|clock|mono|ARRIVED",
    FRA: "oval|dashed|blue|lattice|serif|ENTRÉE", CAN: "rect|toothed|red|maple|sans|WELCOME", JPN: "circle|solid|red|fuji|cond|ARRIVAL",
    MEX: "double|dotted|green|cactus|slab|BIENVENIDO", ITA: "shield|solid|green|arches|serif|ARRIVO", ESP: "cancel|dashed|red|sun|slab|LLEGADA",
    DEU: "hexagon|double|black|tower|cond|EINREISE", NLD: "octagon|solid|brown|windmill|sans|AANKOMST", GRC: "rect|dotted|blue|temple|serif|ARRIVAL",
    PRT: "arch|double|brown|ship|slab|CHEGADA", CHE: "triangle|solid|red|peaks|sans|ENTRY", AUT: "shield|dotted|red|edelweiss|serif|ANKUNFT",
    BEL: "cancel|solid|black|tower|mono|ARRIVÉE", DNK: "oval|solid|red|ship|cond|ANKOMST", NOR: "triangle|toothed|blue|mountainlake|slab|ANKOMST",
    SWE: "circle|dashed|blue|horse|cond|ANKOMST", ISL: "hexagon|toothed|blue|geyser|sans|ARRIVAL", USA: "shield|double|blue|star|slab|ADMITTED",
    AUS: "oval|toothed|brown|kangaroo|sans|ARRIVED", NZL: "circle|double|black|kiwi|cond|ARRIVAL", CHN: "rect|double|red|pagoda|serif|ENTRY",
    IND: "octagon|dotted|brown|elephant|slab|ARRIVAL", THA: "arch|toothed|violet|lotus|serif|ARRIVAL", EGY: "triangle|double|brown|pyramid|slab|ARRIVAL",
    MAR: "arch|dotted|red|dome|serif|ARRIVÉE", ZAF: "hexagon|solid|green|acacia|sans|ADMITTED", KEN: "oval|dotted|brown|giraffe|cond|ENTRY",
    BRA: "double|toothed|green|parrot|sans|CHEGADA", ARG: "circle|dotted|blue|sun|serif|ENTRADA", PER: "shield|toothed|brown|llama|slab|ENTRADA",
    CHL: "rect|dashed|blue|volcano|cond|ENTRADA", TUR: "oval|double|red|balloon|serif|GİRİŞ", CRI: "cancel|dotted|green|parrot|cond|ENTRADA",
    BHS: "circle|dashed|blue|wave|sans|WELCOME", JAM: "octagon|dashed|green|palm|slab|WELCOME", ISR: "hexagon|dashed|blue|olive|serif|ENTRY",
    KOR: "rect|solid|blue|gate|cond|ARRIVAL", VNM: "cancel|double|red|lotus|serif|ARRIVAL", SGP: "oval|solid|violet|edelweiss|cond|ARRIVED",
    CUB: "arch|solid|blue|palm|slab|ENTRADA", DOM: "triangle|dotted|blue|palm|sans|ENTRADA", PHL: "shield|dashed|blue|volcano|cond|ARRIVAL",
    IDN: "octagon|double|red|volcano|serif|ARRIVAL", POL: "rect|toothed|red|tower|serif|PRZYJAZD", CZE: "arch|dashed|blue|clock|cond|PŘÍJEZD",
    HRV: "cancel|toothed|blue|wave|sans|DOLAZAK", HUN: "circle|double|green|dome|serif|ÉRKEZÉS", FIN: "oval|dotted|blue|pine|cond|SAAPUMINEN"
  };
  var GENERIC = ["sun", "star", "peaks", "wave", "palm", "leaf", "hills", "compass", "plane", "pine", "mountainlake", "olive", "volcano", "dunes", "sequoia"];
  var PARK_WORDS = [[/arch|bridge/i, "rockarch"], [/canyon|bend|badland|capitol|bryce/i, "canyon"], [/volcan|lassen|haleakal/i, "volcano"], [/yellowstone|geyser/i, "geyser"],
    [/sequoia|redwood|congaree|kings/i, "sequoia"], [/cave|carlsbad|cavern|wind cave/i, "cave"], [/sand|dune/i, "dunes"], [/saguaro|joshua|cactus/i, "cactus"],
    [/yosemite|falls|cuyahoga/i, "waterfall"], [/everglades|biscayne|dry tortugas|virgin islands|channel|acadia|isle|bay|key/i, "wave"],
    [/bison|theodore|roosevelt|wind/i, "bison"], [/denali|katmai|kenai|kobuk|wrangell|lake clark|gates/i, "bear"], [/crater|lake|glacier|teton|rainier|olympic|north cascades/i, "mountainlake"],
    [/smoky|shenandoah|blue ridge|hot springs|gateway|new river/i, "hills"], [/rocky|great basin|mountain/i, "peaks"]];
  var PARK_GEN = ["pine", "peaks", "mountainlake", "sequoia", "hills", "bear", "deer", "elk", "waterfall"];

  function pick(list, h) { return list[h % list.length]; }
  function inkOf(k, h) { return INKS[k] ? INKS[k][h & 1] : INK_LIST[h % INK_LIST.length]; }
  var STATE_ORDER = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
  var MODES = ["bird", "flower", "animal"];
  function stateMode(id, art) { return art === "bird" || art === "flower" || art === "animal" ? art : MODES[hash("mix:" + id) % 3]; }

  /** How a place's stamp looks. kind = "place" (country or UK nation), "state" or "park". art = bird|flower|animal|mix (states). */
  function design(kind, area, name, art) {
    var h = hash(kind + ":" + area), h2 = hash(area + "#2"), d;
    if (kind === "state") {
      var i = STATE_ORDER.indexOf(area); if (i < 0) i = h % 51;
      var mode = stateMode(area, art), sym = SYM && SYM.DATA[area] ? SYM.DATA[area][mode] : null, m = MODES.indexOf(mode);
      d = { shape: SHAPES[(i * 3 + m) % SHAPES.length], border: BORDERS[(i + m * 2) % BORDERS.length], ink: INK_LIST[(i * 5 + m * 3) % INK_LIST.length],
            motif: sym && G[sym.glyph] ? sym.glyph : "star", pose: (i + m) % 3, flip: ((i >> 1) + m) % 2 === 1, font: FONT_KEYS[(i * 2 + m) % FONT_KEYS.length],
            label: "", symbol: sym ? sym.name.toUpperCase() : "", mode: mode };
    } else if (kind === "park") {
      var mt = ""; PARK_WORDS.some(function (w) { if (w[0].test(name || area)) { mt = w[1]; return true; } return false; });
      d = { shape: pick(["circle", "double", "arch", "shield", "octagon", "cancel", "oval"], h), border: pick(BORDERS, h2), ink: pick(["#5b4a2f", "#2f5d3a", "#6b3a2a", "#2b4f5e", "#4b5320", "#7a3b1d"], h >>> 4),
            motif: mt || pick(PARK_GEN, h >>> 7), pose: h % 3, flip: false, font: pick(["slab", "serif", "cond"], h >>> 9), label: "NATIONAL PARK" };
    } else {
      var c = COUNTRY[area];
      if (c) { c = c.split("|"); d = { shape: c[0], border: c[1], ink: inkOf(c[2], h), motif: c[3], font: c[4], label: c[5], pose: h % 3, flip: false, tuned: true }; }
      else d = { shape: pick(SHAPES, h), border: pick(BORDERS, h2), ink: INK_LIST[(h >>> 5) % INK_LIST.length], motif: pick(GENERIC, h2 >>> 3), font: pick(FONT_KEYS, h >>> 11), label: pick(LABELS, h2 >>> 9), pose: h2 % 3, flip: false };
    }
    return d;
  }

  // ---------- outlines (160x160) ----------
  function poly(n, r, rot) { var p = []; for (var i = 0; i < n; i++) { var a = (rot + i * 360 / n) * Math.PI / 180; p.push((80 + r * Math.cos(a)).toFixed(1) + "," + (80 + r * Math.sin(a)).toFixed(1)); } return "M" + p.join(" L") + " Z"; }
  var OUT = {
    circle: { d: "M80,10 A70,70 0 1 1 79.9,10 Z", box: [32, 128, 104], ring: 70 },
    double: { d: "M80,8 A72,72 0 1 1 79.9,8 Z", box: [44, 116, 84], ring: 72, inner: "M80,24 A56,56 0 1 1 79.9,24 Z" },
    cancel: { d: "M66,18 A62,62 0 1 1 65.9,18 Z", box: [40, 120, 84], ring: 62, cx: 66, waves: 1 },
    oval: { d: "M6,80 A74,56 0 1 1 154,80 A74,56 0 1 1 6,80 Z", box: [32, 128, 120] },
    rect: { d: "M10,28 H150 Q154,28 154,32 V128 Q154,132 150,132 H10 Q6,132 6,128 V32 Q6,28 10,28 Z", box: [32, 128, 136] },
    hexagon: { d: poly(6, 74, 0), box: [22, 138, 104] },
    octagon: { d: poly(8, 74, 22.5), box: [16, 144, 112] },
    triangle: { d: "M80,6 L154,146 L6,146 Z", box: [40, 135, 96], tri: 1 },
    shield: { d: "M14,14 H146 V76 Q146,124 80,154 Q14,124 14,76 Z", box: [20, 134, 116] },
    arch: { d: "M14,152 V76 A66,66 0 0 1 146,76 V152 Z", box: [26, 148, 116] }
  };
  function inset(d, k, cx) { cx = cx || 80; return '<path d="' + d + '" transform="translate(' + cx + ' 80) scale(' + k + ') translate(-' + cx + ' -80)" vector-effect="non-scaling-stroke"/>'; }
  function outline(o, border) {
    var main = border === "dashed" ? ' stroke-dasharray="9 5"' : border === "dotted" ? ' stroke-dasharray="0.1 6.4" stroke-linecap="round" stroke-width="4.4"' : border === "toothed" ? ' stroke-dasharray="2.6 2.6" stroke-width="8"' : "";
    var s = '<path d="' + o.d + '"' + main + '/>';
    if (border === "double") s += inset(o.d, 0.9, o.cx).replace("<path", '<path stroke-width="1.6"');
    if (border === "toothed" || border === "dotted") s += inset(o.d, 0.92, o.cx).replace("<path", '<path stroke-width="1.6"');
    if (o.inner) s += '<path d="' + o.inner + '" stroke-width="1.8"/>';
    if (o.waves) for (var i = 0; i < 5; i++) { var y = 56 + i * 12; s += '<path d="M120,' + y + ' q6,-5 12,0 t12,0 t12,0 t2,0" stroke-width="2.4"/>'; }
    return s;
  }
  function width(t, fs, font) { return t.length * fs * (font === "mono" ? 0.62 : font === "sans" ? 0.68 : font === "cond" ? 0.48 : 0.6); }
  function line(t, x, y, fs, font, max, extra) {
    if (!t) return "";
    var w = width(t, fs, font), fit = "";
    if (w > max) { var nf = Math.max(7, fs * max / w); if (width(t, nf, font) > max) fit = ' textLength="' + Math.round(max) + '" lengthAdjust="spacingAndGlyphs"'; fs = nf; }
    return '<text x="' + x + '" y="' + y.toFixed(1) + '" font-size="' + fs.toFixed(1) + '"' + fit + (extra || "") + '>' + esc(t) + '</text>';
  }

  // usable width inside each shape at height y (so text and motif never run over the edge)
  function widthAt(shape, y) {
    var dy = Math.abs(y - 80), w;
    if (shape === "rect") w = 140;
    else if (shape === "oval") w = dy >= 55 ? 0 : 148 * Math.sqrt(1 - dy * dy / 3136);
    else if (shape === "hexagon") w = dy >= 64 ? 74 : 148 - dy / 64 * 74;
    else if (shape === "octagon") w = dy <= 28 ? 136 : Math.max(0, 136 - (dy - 28) / 40 * 80);
    else if (shape === "triangle") w = Math.max(0, (y - 6) / 140 * 148);
    else if (shape === "shield") w = y <= 76 ? 132 : y >= 154 ? 0 : 132 * Math.sqrt(1 - Math.pow((y - 76) / 78, 2));
    else if (shape === "arch") w = y >= 76 ? 132 : 2 * Math.sqrt(Math.max(0, 4356 - (76 - y) * (76 - y)));
    else w = 120;
    return Math.max(0, w - 18);
  }
  function minWidth(shape, y0, y1) { var m = 999; for (var y = y0; y <= y1; y += 2) m = Math.min(m, widthAt(shape, y)); return m; }

  /** The stamp as SVG. s = {kind, area, id, via}; text = {name, date, end, sub} already formatted (empty date = nothing shown);
      opts = {art: bird|flower|animal|mix, flag}. */
  function stampSVG(s, text, opts) {
    opts = opts || {}; text = text || {};
    var d = design(s.kind, s.area, text.name, opts.art), o = OUT[d.shape] || OUT.circle, ink = d.ink, F = FONTS[d.font] || FONTS.mono;
    var uid = "st" + (hash((s.id || "") + s.kind + s.area + (opts.art || "")) % 1e8), cx = o.cx || 80;
    var NAME = String(text.name || s.area).toUpperCase(), date = String(text.date || ""), end = text.end ? "TO " + text.end : "", via = String(s.via || "").toUpperCase().slice(0, 18);
    var ring = !!o.ring, rows = [], body = "", txt = "", mono = FONTS.mono;
    var lab = s.kind === "state" ? d.symbol : s.kind === "park" ? (text.sub || d.label) : d.label;
    var top, bot, wAt;
    if (ring) {
      // name around the top edge, label (or the state's bird/flower/animal) around the bottom, the picture and date inside
      var R = o.ring, inner = o.inner ? 56 : R - 14;
      var nfs = Math.min(d.shape === "cancel" ? 11 : 13, Math.PI * (R - 12) * 0.8 / Math.max(4, NAME.length) / 0.64);
      if (o.inner) nfs = Math.min(nfs, R - inner - 7.5);
      var r = o.inner ? inner + 2.5 : R - 5 - nfs, rb = o.inner ? R - 4 : R - 6;
      var bottom = s.kind === "park" ? (text.sub || "NATIONAL PARK SERVICE") : lab;
      var bfs = Math.min(o.inner ? 9 : 8.5, Math.PI * (rb - 8) * 0.78 / Math.max(6, bottom.length) / 0.62);
      txt += '<defs><path id="' + uid + 't" d="M' + (cx - r) + ',80 A' + r + ',' + r + ' 0 0 1 ' + (cx + r) + ',80"/><path id="' + uid + 'b" d="M' + (cx - rb) + ',80 A' + rb + ',' + rb + ' 0 0 0 ' + (cx + rb) + ',80"/></defs>';
      txt += '<text font-size="' + nfs.toFixed(1) + '" letter-spacing="' + (NAME.length < 9 ? 2 : 0.4) + '"><textPath href="#' + uid + 't" startOffset="50%">' + esc(NAME) + '</textPath></text>';
      if (bottom) txt += '<text font-size="' + bfs.toFixed(1) + '" letter-spacing="0.8"><textPath href="#' + uid + 'b" startOffset="50%">' + esc(bottom) + '</textPath></text>';
      var lim = Math.min(r, rb - bfs) - 3; top = 80 - lim; bot = 80 + lim;
      wAt = function (y) { var dy = y - 80; return Math.max(0, 2 * Math.sqrt(Math.max(0, lim * lim - dy * dy)) - 6); };
      rows.push({ k: "motif", h: date ? 50 : 62 });
      if (date) rows.push({ k: "date", h: 11 });
      if (end || via) rows.push({ k: "small", t: end || via, h: 7 });
    } else {
      top = o.box[0]; bot = o.box[1]; wAt = function (y) { return widthAt(d.shape, y); };
      rows.push({ k: "name", h: 14 });
      rows.push({ k: "motif", h: date ? 46 : 58 });
      if (lab) rows.push({ k: "label", t: lab + (via && !end && s.kind === "place" ? " · " + via : ""), h: d.font === "cond" ? 9 : 8 });
      if (date) rows.push({ k: "date", h: 12 });
      if (end) rows.push({ k: "small", t: end, h: 7 });
      if (d.shape === "triangle") { var m = rows[1]; rows[1] = rows[0]; rows[0] = m; m.h = date ? 40 : 50; }
    }
    // stack the rows in the middle of the shape; with no date the picture just grows and everything stays centered
    var gap = 3.5, total = rows.reduce(function (a, b) { return a + b.h; }, 0) + gap * (rows.length - 1), avail = bot - top;
    if (total > avail) { var k = avail / total; rows.forEach(function (rw) { rw.h *= k; }); gap *= k; total = avail; }
    var y = d.shape === "triangle" && !ring ? bot - total : top + (avail - total) / 2;   // a triangle is roomiest at the bottom
    rows.forEach(function (rw) {
      var base = y + rw.h * 0.8, w = rw.k === "motif" ? 0 : minWidth(d.shape === "cancel" || ring ? "" : d.shape, y, y + rw.h);
      if (ring && rw.k !== "motif") w = Math.min(wAt(y), wAt(y + rw.h));
      if (rw.k === "motif") {
        var sz = rw.h; for (var t = 0; t < 6; t++) { var mw = Math.min(wAt(y + (d.shape === "triangle" ? sz * 0.22 : 0)), wAt(y + sz)); if (mw >= sz * 0.95) break; sz *= 0.9; }
        var gx = cx - sz / 2, gy = y + (rw.h - sz) / 2, sc = sz / 40, art = G[d.motif] ? G[d.motif](d.pose) : "";
        body += '<g class="motif" transform="translate(' + gx.toFixed(1) + " " + gy.toFixed(1) + ") scale(" + sc.toFixed(3) + ")" + (d.flip ? " translate(40 0) scale(-1 1)" : "") + '">' + art + '</g>';
      } else if (rw.k === "name") txt += line(NAME, cx, base, rw.h, d.font, w, ' letter-spacing="' + (NAME.length < 8 ? 1.5 : 0.3) + '"');
      else if (rw.k === "label") txt += line(rw.t, cx, base, rw.h, d.font, w, ' letter-spacing="0.8"');
      else txt += line(rw.k === "date" ? date : rw.t, cx, base, rw.h, "mono", w, ' font-family="' + mono + '"');
      y += rw.h + gap;
    });
    var fl = opts.flag || "", fx = 0, fy = 0;
    if (fl) { if (ring) { fx = cx + o.ring * 0.74; fy = 80 + o.ring * 0.8; } else if (d.shape === "rect") { fx = 138; fy = 48; } else if (d.shape === "oval") { fx = 140; fy = 46; } else if (d.shape === "shield" || d.shape === "arch") { fx = 128; fy = d.shape === "arch" ? 142 : 34; } else if (d.shape === "hexagon" || d.shape === "octagon") { fx = 128; fy = 36; } else fl = ""; }
    var flagTxt = fl ? '<text x="' + fx.toFixed(0) + '" y="' + fy.toFixed(0) + '" font-size="13" text-anchor="middle">' + fl + '</text>' : "";
    var aria = (text.name || s.area) + (s.kind === "state" && d.symbol ? ", state " + d.mode + ": " + d.symbol.toLowerCase() : "") + (date ? ", " + date : "");
    return '<svg class="stampsvg" viewBox="0 0 160 160" role="img" aria-label="' + esc(aria) + '" data-look="' + esc([d.shape, d.border, d.ink, d.motif, d.font, d.flip ? "flip" : "", d.pose].join(" ")) + '">' +
      '<g filter="url(#inkrough)" opacity=".9" color="' + ink + '"><g fill="none" stroke="' + ink + '" stroke-width="3">' + outline(o, d.border) + '</g>' +
      '<g fill="' + ink + '" stroke="' + ink + '" stroke-width="0">' + body + '</g><g fill="' + ink + '" font-family="' + F + '" font-weight="700" text-anchor="middle">' + txt + '</g></g>' + flagTxt + '</svg>';
  }

  return { stampSVG: stampSVG, design: design, SYM: SYM, GLYPHS: G, COUNTRY: COUNTRY, SHAPES: SHAPES, BORDERS: BORDERS, INKS: INKS, INK_LIST: INK_LIST, FONTS: FONTS, MODES: MODES, stateMode: stateMode, hash: hash };
});
