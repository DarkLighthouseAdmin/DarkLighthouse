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
    // ---- park pictures added for the national parks passport
    lighthouse: function () { return P("M16 37 L18 12 H22 L24 37 Z") + P("M17.4 19 H22.6 V22 H17.4 Z M16.9 28 H23.1 V31 H16.9 Z", PAPER) + P("M15 12 H25 V9 H15 Z") + P("M17 9 Q20 3 23 9 Z") + S("M25 8 L37 4 M25 10 L38 11", 1.2) + P("M0 37 Q10 33 20 37 Q30 33 40 37 V40 H0 Z"); },
    hoodoo: function () { return P("M5 38 V22 Q4 18 7 16 Q5 13 8 11 H12 Q14 14 12 17 Q15 20 13 24 V38 Z M16 38 V14 Q14 10 18 8 Q16 5 20 3 H23 Q25 6 23 9 Q26 12 24 16 V38 Z M28 38 V26 Q26 23 29 21 Q27 18 31 17 H34 Q36 20 34 22 Q37 25 35 28 V38 Z"); },
    spires: function () { return P("M4 38 V20 Q4 16 7 16 Q10 16 10 20 V38 Z M14 38 V12 Q14 8 17 8 Q20 8 20 12 V38 Z M26 38 V22 Q26 19 29 19 Q32 19 32 22 V38 Z") + E(29, 14.5, 5.4, 4) + P("M0 37 H40 V40 H0 Z"); },
    turtle: function () { return E(10, 30, 4.4, 2.2, 30) + E(29, 30, 4.4, 2.2, -30) + E(11, 12, 4.4, 2.2, -30) + E(28, 12, 4.4, 2.2, 30) + E(19, 21, 11, 8.6) + C(33, 21, 3.6) + S("M13 15 L19 21 L25 15 M13 27 L19 21 L25 27 M9 21 H29", 1, PAPER); },
    gator: function () { return P("M1 24 Q3 19 10 19 L28 19 Q34 18 39 21 L39 23 L31 24 L39 25 L38 27 Q31 28 26 27 L10 27 Q3 27 1 24 Z") + P("M10 26 L8 32 H11 L14 26 Z M21 26 L20 32 H23 L25 26 Z") + S("M5 19 L7 16.6 L9 19 L11 16.6 L13 19 L15 16.6 L17 19 L19 16.6 L21 19", 1) + C(27, 20.8, 1, PAPER) + S("M0 36 Q6 34 12 36 Q18 38 24 36 Q30 34 40 36", 1.2); },
    steelarch: function () { return S("M6 39 Q20 -24 34 39", 3.6) + S("M11 39 Q20 4 29 39", 1) + P("M0 37 H40 V40 H0 Z"); },
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
    // v68: same gull, drawn at the set's size (it sat small and high with hairline water, so Utah looked unlike the other states)
    gull: function (v) { return '<g transform="translate(20 20) scale(1.06 1.5) translate(-20 -16.5)">' + P("M2 16 Q10 9 20 17 Q30 9 38 16 Q30 13 22 20 L20 23 L18 20 Q10 13 2 16 Z") + E(20, 22, 7, 3.4) + C(27, 20, 2.8) + P("M29.4 19.4 L33 20.4 L29.4 21.6 Z") + P("M13 22 L9 24 L14 24 Z") + "</g>" + (v === 1 ? S("M1 36 Q6 34 11 36 T21 36 T31 36 T40 36", 1.6) : S("M0 37.5 Q20 35.5 40 37.5", 1.6)); },
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
    obelisk: function () { return P("M17 36 L18.2 9 L20 5 L21.8 9 L23 36 Z") + P("M20 5 L21.8 9 L23 36 L20.6 36 Z", PAPER) + S("M20 5 L21.8 9 L23 36", 0.9) + P("M10 36 H30 V38 H10 Z") + S("M2 39 H38", 1.3); },
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
    // v100: ski resort, campground and university stamps
    ski: function () { return P("M-1 30 L13 10 L19 17 L26 6 L41 30 Z") + P("M13 10 L10 15 L13.6 14 L16 15.4 Z M26 6 L22.4 12 L26 11 L29.4 12 Z", PAPER) + S("M3 39 L37 32", 1.8) + S("M3 32.4 L37 39", 1.8) + C(36, 31.6, 1.2) + C(36, 39.4, 1.2); },
    tent: function () { return P("M20 5 L38 34 H2 Z") + P("M20 16 L26 34 H14 Z", PAPER) + S("M20 5 L16.6 0.6 M20 5 L23.4 0.6", 1.2) + S("M0 37 H40", 1.3) + C(5, 9, 1.3) + C(33, 7, 1) + C(36, 15, 0.8); },
    mortarboard: function () { return P("M20 6 L39 14 L20 22 L1 14 Z") + P("M10 18 V27 Q20 32 30 27 V18 L20 22 Z") + S("M20 14 L35 15.6 V28", 1.2) + C(35, 29.6, 1.7) + S("M4 37 H36", 1.3); },
    plane: function () { return P("M2 21 L14 20 L22 6 H26 L21 20 L33 19.6 L37 14 H40 L38 21 L40 28 H37 L33 22.4 L21 22 L26 36 H22 L14 22 L2 21 Z") + S("M0 32 Q6 30 12 32", 1); },
    leaf: function () { return P("M6 34 Q4 12 34 6 Q36 34 6 34 Z") + S("M6 34 Q18 22 30 10 M14 26 L12 19 M14 26 L22 25 M21 19 L20 13 M21 19 L28 18", 1, PAPER); },
    mountainlake: function () { return P("M0 26 L12 10 L18 18 L26 6 L40 26 Z") + P("M12 10 L15 14 L12 13.4 L9.6 13.4 Z M26 6 L30 12 L27 11 L24 12.6 L22.6 11 Z", PAPER) + S("M2 30 H38 M6 34 H34 M10 38 H30", 1.3); }
  };
  // ---------- national park pictures: one scene per park, drawn for a round window (centre 20,20, radius 20) ----------
  // Keep the subject between y 3 and y 34: the date plate covers the bottom of the window.
  function PO(d, o) { return '<path d="' + d + '" fill-opacity="' + o + '"/>'; }
  function H(d, w) { return S(d, w + 1.8, PAPER) + S(d, w); }   // a line with a paper halo, readable over ink
  function HP(d) { return S(d, 2.2, PAPER) + P(d); }              // a shape with a paper halo
  function wv(y, w, col) { return S("M-2 " + y + " q2.5 -1.6 5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0", w || 1.1, col); }
  function sub(k, tx, ty, sc, v) { return '<g transform="translate(' + tx + " " + ty + ") scale(" + sc + ')">' + G[k](v || 0) + "</g>"; }
  function pines(xs, y, h) { return P(xs.map(function (x) { return "M" + (x - h * 0.36) + " " + y + " L" + x + " " + (y - h) + " L" + (x + h * 0.36) + " " + y + "Z"; }).join(" ")); }
  function person(x, y, s) { s = s || 1; return C(x, y, 0.9 * s) + S("M" + x + " " + (y + 1.2 * s) + " V" + (y + 4 * s) + " M" + x + " " + (y + 4 * s) + " L" + (x - s) + " " + (y + 6.4 * s) + " M" + x + " " + (y + 4 * s) + " L" + (x + s) + " " + (y + 6.4 * s) + " M" + x + " " + (y + 2.2 * s) + " L" + (x - 1.3 * s) + " " + (y + 3.6 * s) + " M" + x + " " + (y + 2.2 * s) + " L" + (x + 1.3 * s) + " " + (y + 3.6 * s), 0.8); }
  var GROUND = function (y) { return P("M-1 " + y + " H41 V41 H-1Z"); };
  var NPG = {
    acadia: function () { return P("M-1 30 L5 27 L9 28.5 L13 25.5 L19 26.5 L25 25 L30 27.5 L35 26 L41 28 V41 H-1Z") + S("M5 31 L9 29.6 M24 28.4 L29 30 M13 29.4 L17 28.8 M33 30 L37 29.4", 0.9, PAPER) +
      P("M18.4 26 L19.4 10 H24.6 L25.6 26Z") + P("M19.1 16.5 H24.9 V19.2 H19.1Z", PAPER) + P("M18 10 H26 V8.3 H18Z") + P("M19.6 8.3 V5 H24.4 V8.3Z") + P("M20.6 5.6 H23.4 V7.7 H20.6Z", PAPER) + P("M19 5 L22 2.3 L25 5Z") +
      P("M9 26 V21.5 L13 18.2 L17 21.5 V26Z") + P("M12 26 V22.8 H14 V26Z", PAPER) + S("M26.5 5.2 L37 1.6 M26.5 7 L37.6 9 M17.4 6 L6 3.4", 1.1) + S("M2 34 q2 -1.4 4 0 M30 34.4 q2 -1.4 4 0", 1, PAPER); },
    samoa: function () { return C(8, 8, 3) + P("M5 31 L9.6 15 Q12 8 14.4 15 L17 23 L19.4 19.6 Q21 17.4 22.6 20.6 L26 31Z") + S("M11.6 14 L10.6 24 M21 21 L20.6 28", 0.9, PAPER) +
      P("M31.2 34 Q33.2 24 31.6 15 L33 15 Q35 24 33.6 34Z") + P("M32.2 14.6 Q26 10 21 13.5 Q27 11.5 32 15.6Z M32.2 14.6 Q38 9 43 12 Q37 11 32.6 15.6Z M32.2 14.6 Q28 6 23.5 6 Q29 8 32 15Z M32.2 14.6 Q36 6 41 5.5 Q36 8 32.6 15Z M32.2 14.6 Q32.5 7 31 3.5 Q34 7.5 33 14.6Z") +
      C(31.6, 16, 1.2) + C(33.8, 16.2, 1.2) + P("M24 41 V35 Q32 32.4 41 33 V41Z") + wv(32.2, 1.1) + S("M-2 35.5 q2.5 -1.6 5 0 t5 0 t5 0 t5 0 t5 0", 1.1); },
    arches: function () { return PO("M-1 23 L4 17 L8 19.6 L13 13.6 L17 17.6 L22 12 L27 17 L31 14.4 L36 18 L41 16.4 V31 H-1Z", 0.32) + S("M13 13.6 L12.4 16.4 M22 12 L22.6 15 M31 14.4 L30.6 16.8", 0.9, PAPER) +
        '<path fill-rule="evenodd" d="M12.4 31.4 L13.6 26 Q11 18 13.2 12 Q15.6 4.6 20.8 4.4 Q26.4 4.8 28.2 12 Q30.2 19.4 28.8 25 L30.4 31.4Z M15.9 31.4 L16.2 26 Q14.8 18.4 16.6 13 Q18.4 7.8 20.8 7.8 Q23.4 8 24.8 13 Q26.2 19.4 25.2 25.2 L25.8 31.4Z"/>' +
        S("M14 21 Q13.6 17 15 13.6 M27 15 Q27.8 19 27.2 22", 0.7, PAPER) + P("M-1 31 Q6 28.6 12 30.4 Q20 32 29 30.2 Q35 28.6 41 30.4 V41 H-1Z") + S("M2 33.6 Q10 31.6 18 33.4 M24 33.2 Q32 31.4 39 33", 0.8, PAPER); },
    badlands: function () { return P("M-1 33 V22 L3 18.6 L5 20.4 L8 13 L10 15.4 L12.4 10 L14.6 14 L17 12 L19.4 17 L22 7.4 L24.4 12 L27 9.4 L29.6 15 L32 13 L35 18 L38 16 L41 20 V33Z") +
      S("M0 24.6 H40 M0 29.2 H40 M4 20.6 H37 M9 16.8 H31 M19 12.6 H28.6", 1.1, PAPER) + GROUND(33) + S("M4 33 L3 30.4 M6 33 L6.8 30.4 M30 33 L29.2 30.4 M33 33 L34 30.4 M18 33 L18.6 30.6", 0.9) + S("M0 32 H40", 0.8, PAPER); },
    bigbend: function () { return PO("M-1 22 L5 17 L8 18.6 L12 12 L15 14 L17 10.4 L21 15 L26 13 L30 17 L34 15 L41 21 V24 H-1Z", 0.42) + sub("roadrunner", 1.4, -2, 0.94) + GROUND(33); },
    biscayne: function () { return wv(3.4, 1.1) + P("M8 18 Q15 9 24 14 L31 9.6 L29.6 18 L31 26.4 L24 22 Q15 27 8 18Z") + P("M14 12.6 Q16.6 3 22.4 5.8 Q19.4 9 20.4 13Z M14 23.4 Q16.6 33 22.4 30.2 Q19.4 27 20.4 23Z") +
      C(11.6, 17, 1.2, PAPER) + C(11.8, 17, 0.5) + S("M16.4 11.6 Q14.4 18 16.4 24.4 M20.8 12.2 Q19.2 18 20.8 23.8", 1.2, PAPER) + C(28, 7, 1) + C(30, 4.4, 0.8) +
      S("M34 34 V27 M34 30 L31 26 M34 29 L37 25 M31 26 L30 23 M37 25 L38 22", 1.8) + E(8, 34, 6.4, 3.6) + S("M3.6 34 Q8 31.4 12.4 34 M5 32 Q8 30.4 11 32", 0.8, PAPER); },
    blackcanyon: function () { return pines([5.2, 35.2], 6.2, 4.6) + P("M-1 6.6 L14 5.6 L15.4 16 L17.4 27 L19 36 H-1Z") + P("M41 5 L26 6 L24.8 15 L22.8 27 L21 36 H41Z") +
      S("M27.6 8.6 L31 14 L29.4 18 L34 23 L32.4 28 M33.6 7.4 L36.4 12 L35 17 L39 22 M24.6 20 L27 25.6 L25.6 31", 1.1, PAPER) + S("M5.6 10 L9 16 L7 21 L11 27 M2 16 L4 22", 1.1, PAPER) + S("M19.4 35 Q20.6 31.6 20 29", 0.9) + GROUND(36); },
    bryce: function () { var s = "", h = [[3.4, 15, 2.2], [8.6, 9.6, 2.4], [13.8, 16, 2.1], [19.6, 5.6, 2.6], [25.4, 12.4, 2.3], [30.6, 8.6, 2.4], [36, 16.6, 2.2]]; h.forEach(function (o) { var x = o[0], t = o[1], w = o[2];
      s += P("M" + (x - w) + " 34 V" + (t + 9) + " Q" + (x - w - 1.2) + " " + (t + 6.6) + " " + (x - w + 0.4) + " " + (t + 4.6) + " Q" + (x - w - 0.8) + " " + (t + 2.2) + " " + (x - w * 0.7) + " " + (t + 1.2) + " Q" + x + " " + (t - 1.4) + " " + (x + w * 0.7) + " " + (t + 1.2) + " Q" + (x + w + 0.8) + " " + (t + 2.2) + " " + (x + w - 0.4) + " " + (t + 4.6) + " Q" + (x + w + 1.2) + " " + (t + 6.6) + " " + (x + w) + " " + (t + 9) + " V34Z") + E(x, t, w + 1.2, 1.3); });
      return s + S("M0 22.6 H40 M0 27.6 H40", 1, PAPER) + pines([16.6, 22.6], 34, 5) + GROUND(33.4); },
    canyonlands: function () { return C(20, 25.4, 3.4) + S("M20 19.6 V18 M14.6 22 L13.4 21 M25.4 22 L26.6 21 M13 25.6 H11.4 M27 25.6 H28.6", 1) +
        PO("M5 31 V27.4 H10 V25.4 H14.6 V31Z M25 31 V24.4 H30.4 V26.6 H35 V31Z", 0.55) + S("M6 29 H40", 0.8) +
        '<path fill-rule="evenodd" d="M-1 9.6 Q20 6.4 41 9.6 V41 H-1Z M3.6 31 Q4 18.6 20 16.4 Q36 18.6 36.4 31Z"/>' + S("M-1 12.6 Q20 9.6 41 12.6", 0.8, PAPER) + S("M3 34 H37", 0.9, PAPER); },
    capitolreef: function () { var dm = function (x, w, h, y) { var d = "M" + (x - w) + " " + y + " Q" + (x - w) + " " + (y - h) + " " + x + " " + (y - h) + " Q" + (x + w) + " " + (y - h) + " " + (x + w) + " " + y + "Z";
        return PO(d, 0.38) + S(d, 1.3) + S("M" + (x - w * 0.8) + " " + (y - h * 0.3) + " Q" + x + " " + (y - h * 0.62) + " " + (x + w * 0.8) + " " + (y - h * 0.3) + " M" + (x - w * 0.55) + " " + (y - h * 0.62) + " Q" + x + " " + (y - h * 0.86) + " " + (x + w * 0.55) + " " + (y - h * 0.62), 0.7); };
      return dm(9, 7, 10, 16) + dm(25, 8.6, 13, 16.4) + dm(37.6, 5, 6.6, 16.6) + P("M-1 16 L5 15.4 L11 16.6 L17 15.6 L24 16.6 L30 15.6 L36 16.6 L41 15.8 V31 H-1Z") +
        S("M3 18 L2.6 24 L3.4 30 M7 17.4 L7.6 25 M11 18 L10.6 23 L11.2 30 M15 17 L15.4 26 M19 18 L18.4 24.6 L19 30 M23 17.6 L23.6 25 M27 18 L26.6 23.4 L27.2 30 M31 17.2 L31.4 26 M35 18 L34.6 24 L35.2 30 M39 17.4 V25", 0.8, PAPER) + GROUND(31); },
    carlsbad: function () { return P("M-1 -1 H41 V8 L38 8 L36.6 17 L35 8 L32 8 L30.8 13 L29.6 8 L26 8 L24 21 L22 8 L19 8 L17.6 14 L16.2 8 L13 8 L11 18 L9 8 L6 8 L5 12.6 L4 8 L-1 8Z") +
      P("M-1 41 V33 L3 33 L5 22 L7 33 L13 33 L14.6 27 L16 33 L22 33 L24 21 L26 33 L29 33 L30.6 25 L32 33 L35 33 L36.6 28.6 L38 33 L41 33 V41Z") + sub("bat", 8.6, 18, 0.34) + S("M24 21 V21", 1); },
    channel: function () { return P("M28.6 31 V22.4 Q28.6 18 32 18 Q36.4 18 37 22.4 L38.6 31 H35.6 V25.6 Q35.4 22.8 33.2 22.8 Q31.2 22.8 31.2 25.6 V31Z") + wv(32.4, 1.1) + P("M2 41 V32 Q12 28.6 26 31.4 V41Z") +
      P("M12 31 Q8.6 24 12.4 18 Q14.6 14.6 18 14.8 L18.6 10 L18 5.6 L20.8 8.4 L22.4 5.6 L23 9.4 Q26 10 28 12.6 L25.4 14.4 L22.6 14.6 Q24.4 19 23.2 24 L25 31 H21 L19.6 27 Q17 31.4 12 31Z") +
      P("M22.6 14.6 Q24.2 19 22.6 23 Q20.6 19 21.4 15Z", PAPER) + C(23.4, 10.8, 0.7, PAPER) + P("M12 30.4 Q3.6 32 2.4 26.4 Q7.6 28.6 12.6 26.6Z") + C(27.8, 12.8, 0.6); },
    chiricahua: function () { var s = PO("M-1 22 Q10 17 20 19 Q30 16.6 41 21 V31 H-1Z", 0.3), col = function (x, w, n) { var r = "", y = 31; for (var i = 0; i < n; i++) { var ww = w * (1 - i * 0.09); r += E(x + (i % 2 ? 0.5 : -0.5), y - 1.6, ww, 2); y -= 3.1; } return P("M" + (x - w * 0.7) + " 31 L" + (x - w * 0.3) + " " + (y + 2) + " H" + (x + w * 0.3) + " L" + (x + w * 0.7) + " 31Z") + r; };
      s += col(4.6, 2.6, 5) + col(11.6, 3, 7) + col(28.6, 2.8, 6) + col(35.6, 2.4, 4) + col(20.2, 1.8, 4) + E(20.4, 15.4, 1.3, 1) + E(20.6, 11.8, 3.6, 2.8);
      return s + pines([8.2, 24.4, 32.2], 31.4, 6) + GROUND(31); },
    congaree: function () { var t = function (x, top, k) { var r = P("M" + (x - 0.9 * k) + " " + top + " L" + (x - 1.3 * k) + " " + (31 - 7 * k) + " Q" + (x - 2.2 * k) + " " + (31 - 2 * k) + " " + (x - 5 * k) + " 31 H" + (x + 5 * k) + " Q" + (x + 2.2 * k) + " " + (31 - 2 * k) + " " + (x + 1.3 * k) + " " + (31 - 7 * k) + " L" + (x + 0.9 * k) + " " + top + "Z");
        [[-3.6, 1, 3.6, 1.4], [3.4, 2.2, 3.8, 1.5], [-3, 5.6, 3.2, 1.2], [3.2, 7.4, 3, 1.2], [0, -0.6, 3.2, 1.5], [-0.4, 3.2, 2.4, 1.2]].forEach(function (c) { r += E(x + c[0] * k, top + c[1] * k, c[2] * k, c[3] * k); });
        return r + S("M" + (x - 3.4 * k) + " " + (top + 2.2 * k) + " v3.6 M" + (x + 4.6 * k) + " " + (top + 3.4 * k) + " v3.4 M" + (x - 2 * k) + " " + (top + 6.6 * k) + " v3", 0.7); };
      return t(31, 12.4, 0.9) + t(12, 4.6, 1.4) + PO("M-1 26 H41 V31 H-1Z", 0.32) + P("M20 26 L21 23.6 L22 26Z M25 26 L25.8 24.4 L26.6 26Z M37 26 L37.8 24 L38.6 26Z M2 26 L2.8 24.6 L3.6 26Z") + S("M10 6 Q9.6 9 10.4 11 M14 7 Q14.6 9.6 13.8 12 M29.4 13.6 Q29 16 29.8 17.4", 0.6) +
        P("M-1 29 H41 V30.4 H-1Z") + S("M1 29 V26.4 M7 29 V26.4 M13 29 V26.4 M19 29 V26.4 M25 29 V26.4 M31 29 V26.4 M37 29 V26.4 M-1 26.6 H41", 0.8) + S("M2 30.4 V33 M10 30.4 V33 M18 30.4 V33 M26 30.4 V33 M34 30.4 V33", 0.9) + P("M-1 33 H41 V41 H-1Z"); },
    craterlake: function () { return P("M-1 18 L5 13 L10 15 L15 11 L21 13 L27 10.4 L32 14 L37 12 L41 15 V19.6 H-1Z") + S("M5 13 L6 18 M15 11 L14.6 17 M27 10.4 L27.6 17", 0.9, PAPER) +
      P("M8.6 25 L12.6 20.4 H13.6 L14.4 21 L15 20.4 H15.8 L19.6 25Z") + S("M3 22.6 H7 M22 22.4 H35 M4 27 H38 M24 25 H31", 0.9) +
      P("M-1 28.4 Q10 26.6 20 29 Q30 27 41 28.4 V41 H-1Z") + pines([5, 33, 37], 28.8, 7.6) + S("M2 31.6 Q10 30 18 32", 0.9, PAPER); },
    cuyahoga: function () { return pines([2, 6, 34, 38], 9, 6.4) + C(10.6, 6.6, 2.8) + C(29.4, 6.8, 2.8) + P("M-1 9 Q10 7.6 20 8.4 Q30 7.6 41 9 V31 H-1Z") +
        S("M-1 13 H12 M-1 17 H11 M-1 21 H10 M-1 25 H9 M29 13 H41 M30 17 H41 M31 21 H41 M32 25 H41", 0.8, PAPER) +
        P("M13 8.6 Q20 7.4 27 8.6 Q27.6 18 31.4 31 H8.6 Q12.4 18 13 8.6Z", PAPER) + S("M13 8.6 Q20 7.4 27 8.6", 1.3) +
        S("M16 10 Q15.4 20 13.4 29 M20 10 Q19.8 18 19.4 24 M23.8 10 Q24.4 20 26.4 29", 0.8) +
        C(11.6, 30, 2.2, PAPER) + C(16, 29.6, 2.4, PAPER) + C(20.4, 30.2, 2.2, PAPER) + C(25, 29.6, 2.4, PAPER) + C(29, 30.2, 2, PAPER) + S("M9.4 30 Q11.6 27.4 13.8 29.4 Q16 27 18.4 29 Q20.4 27.8 22.6 29.4 Q25 27 27.4 29 Q29 27.8 31 29.6", 0.8) +
        P("M-1 31 H41 V41 H-1Z") + S("M6 33 Q12 31.6 20 33 Q28 31.6 34 33", 1, PAPER); },
    deathvalley: function () { var s = C(28, 8.6, 4.6); for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; s += S("M" + (28 + 6.4 * Math.cos(a)).toFixed(1) + " " + (8.6 + 6.4 * Math.sin(a)).toFixed(1) + " L" + (28 + 8.4 * Math.cos(a)).toFixed(1) + " " + (8.6 + 8.4 * Math.sin(a)).toFixed(1), 1.1); }
      return s + HP("M-1 23 L6 15.6 L10 18.4 L16 11 L22 17 L26 14.6 L33 19.6 L41 15 V24 H-1Z") + S("M16 11 L14 18 M6 15.6 L5 20.6 M26 14.6 L25.6 19", 0.9, PAPER) + S("M-1 26.4 H41", 1.2) +
        S("M1 30 L7 27.6 L13 30 L19 28 L26 30.2 L33 28 L40 29.8 M5 34 L7 27.6 M13 30 L11.6 34 M19 28 L21 33.6 M26 30.2 L25 34 M33 28 L35 33.6", 0.9); },
    denali: function () { var pk = "M-1 31 L8 20.4 L12 22.4 L18 9 L21 6.6 L23.6 9.4 L26.2 7.8 L32 18 L35 16.8 L41 23.6"; return P(pk + " V31Z") + P("M14.6 16.4 L18 9 L21 6.6 L23.6 9.4 L26.2 7.8 L29.6 13.8 L27 12.6 L24.6 15.4 L21.6 11.6 L19.2 15.4 L17 13.4Z", PAPER) + S(pk, 1.3) + S("M21 12 L20 18 M24.6 15.4 L25.4 20", 0.9, PAPER) +
      P("M-1 31 Q20 27.6 41 31 V41 H-1Z") + pines([5, 8, 33, 36], 31, 6.6) + S("M0 33.4 Q20 30.6 40 33.4", 0.8, PAPER); },
    drytortugas: function () { var s = P("M2 30 V25.4 L8.4 21 H31.6 L38 25.4 V30Z") + S("M2 25.4 H38", 0.9, PAPER); for (var x = 4.4; x < 36; x += 3.4) s += P("M" + x + " 29.4 V28 Q" + (x + 0.9) + " 26.6 " + (x + 1.8) + " 28 V29.4Z", PAPER);
      return s + [10.6, 14, 17.4, 20.8, 24.2].map(function (x) { return P("M" + x + " 23.6 H" + (x + 1.6) + " V22.4 H" + x + "Z", PAPER); }).join("") +
        P("M28.4 21 L29.2 11.6 H31.6 L32.4 21Z") + P("M28.6 11.6 H32.4 V10 H28.6Z") + P("M29.4 10 V7.8 H31.6 V10Z") + P("M29 7.8 L30.5 6.2 L32 7.8Z") + S("M33 8.6 L39 6.4 M28 8.6 L22 6.4", 1) + palmlet(12, 21) + wv(32.4, 1.2) + wv(35.6, 1.1); },
    everglades: function () { return S("M3 34 L1 26.6 M5 34 L5.6 25.6 M7 34 L9.2 27.6 M33.6 34 L31.6 27.4 M35.6 34 L36.2 26 M37.6 34 L40 28", 1.1) +
      P("M0 21.4 Q7 18.4 14 18.4 L27 18.4 Q31 17.6 35 19 L39.8 20.4 L39.8 22.2 L33.6 22.6 L39.4 23.4 L38.8 24.8 L31 25.4 Q27 25.8 23 25.2 L13 25 Q6 24.4 0 21.4Z") +
      P("M12.4 24 L10 29.4 H13.8 L16.4 24.4Z M24.4 24.6 L23.2 29.4 H26.8 L28 24.6Z") + S("M5.2 19.4 L6.6 17 L8 19 L9.4 16.8 L10.8 18.8 L12.2 16.6 L13.6 18.6 L15 16.6 L16.4 18.6 L17.8 16.6 L19.2 18.6 L20.6 16.8 L22 18.6 L23.4 17 L24.8 18.6", 1.1) +
      C(30, 17.8, 1.8) + C(30.3, 17.4, 0.7, PAPER) + C(38.6, 19.8, 0.9) + S("M31.4 22.5 L32.3 23.6 L33.2 22.5 L34.1 23.6 L35 22.5 L35.9 23.6 L36.8 22.5", 0.7, PAPER) + S("M9 23 Q18 24.4 28 23.4", 0.8, PAPER) +
      wv(29.2, 1.2) + S("M8 7 Q10 5 12 7 Q14 5 16 7 M24 4.4 Q25.4 3 26.8 4.4 Q28.2 3 29.6 4.4", 1); },
    gates: function () { return P("M-1 31 L2 18 L5 20 L9 6 L12 10 L14 8 L18 24 L20 31Z") + P("M41 31 L38 16 L35 18 L31 5 L28.6 9 L26.6 7.6 L22 24 L20 31Z") + S("M9 6 L8 14 M12 10 L11.6 16 M31 5 L32 13 M28.6 9 L29 15 M5 20 L4.4 25", 1, PAPER) +
      GROUND(31) + P("M18.6 31 Q21.4 33 18.4 36 Q16.4 39 19 41 H23.6 Q20.4 38 23 35.4 Q25 32.6 21.4 31Z", PAPER) + S("M7 2 Q9 0.6 11 2 M13 4 Q14.6 2.6 16.2 4", 0.9); },
    gateway: function () { return P("M6 34 Q20 -20 34 34 H30.6 Q20 -13 9.4 34Z") + S("M-1 34 H41", 1.4) + wv(36.6, 1.1) + P("M12 34 V30.4 H14.6 V28 H17 V34Z M23 34 V29 H25.4 V31 H28 V34Z"); },
    glacier: function () { var g = "M12 22.4 Q12 18.4 16 18.2 L25 18.2 Q27 15.2 28.4 14.6 L28.6 12.4 L29.6 14 L30.4 12.6 L30.6 14.8 Q32.6 16 32.8 18 L31.6 19.6 L30.4 19.6 Q30.6 21 29.6 22 L29 28.4 H27.4 L26.8 23.8 L17 24 L16.4 28.4 H14.8 L14.6 23.6 Q12 23.2 12 22.4Z";
      return P("M-1 27 L6 14 L10 18 L17 5 L22 13 L26 9 L33 18 L41 12 V27Z") + S("M17 5 L16 11 M26 9 L26.4 13 M6 14 L5.4 18", 1, PAPER) + P(g, PAPER) + S(g, 1.1) + S("M14 21 Q20 22.6 26 21", 0.7) + P("M30.4 19.4 L31 22.4 L29.8 21.4Z") + S("M28.8 13.4 Q28.4 11 27 10", 1) + C(30.4, 15.8, 0.6) +
        P("M-1 30 L8 28.4 L14 28.2 L28 28.2 L34 29 L41 30.4 V41 H-1Z") + S("M6 32 L12 31 M26 31.6 L33 32.4", 0.9, PAPER); },
    glacierbay: function () { return P("M-1 20 L5 9 L10 14 L16 4 L20 10 L24 5 L30 12 L35 7 L41 15 V20Z") + P("M13.6 8 L16 4 L18.4 8 L16.6 7.2Z M22 8.4 L24 5 L26.4 8.6 L24.4 7.6Z M3.6 11.4 L5 9 L6.6 11.6Z M33.4 9.4 L35 7 L36.6 9.6Z", PAPER) +
        P("M10 20 Q14 13 20 11 Q26 13 30 20Z", PAPER) + S("M10 20 Q14 13 20 11 Q26 13 30 20 M15 19 Q18 14 20 13 M25 19 Q22 14 20 13", 0.9) +
        P("M1 26 V20.4 L3 19 L5 20.6 L8 18.8 L10.4 20.2 L13 18.6 L15.6 20 L18 18.4 L20.6 19.8 L23 18.2 L25.6 19.8 L28 18.6 L30.6 20.2 L33 18.8 L35.4 20.4 L37.6 19 L39.4 20.6 V26Z", PAPER) +
        S("M1 26 V20.4 L3 19 L5 20.6 L8 18.8 L10.4 20.2 L13 18.6 L15.6 20 L18 18.4 L20.6 19.8 L23 18.2 L25.6 19.8 L28 18.6 L30.6 20.2 L33 18.8 L35.4 20.4 L37.6 19 L39.4 20.6 V26", 1.1) +
        P("M5 20.6 L6.2 26 H4.4Z M12.4 19.4 L13.4 26 H11.2Z M19.6 19.6 L21 26 H18.8Z M27 19.4 L27.6 26 H25.8Z M33.6 19.6 L35 26 H33Z") +
        P("M-1 26 H41 V41 H-1Z") + P("M10 28.6 L11 27.4 L15 27.6 L15.8 28.8Z M24 31 L25.2 29.8 L28.6 30 L29 31.2Z M3 31 L4 30.2 L6.6 30.4 L7 31.2Z M33 28.4 L34 27.6 L36.6 27.8 L37 28.6Z", PAPER); },
    grandcanyon: function () { return PO("M-1 8.6 H14 L15 9.4 H30 L31 8.4 H41 V20 H-1Z", 0.3) + S("M-1 11.4 H41 M-1 14 H41 M-1 16.8 H41", 0.5, PAPER) +
      P("M3 21 V16.4 H5 L6 14 H9.4 L10.4 16.4 H12.6 V21Z M23 21 V15.4 H25 L26 12.6 L27.6 9.6 L29.2 12.6 H30.4 L31.4 15.4 H34 V21Z") + S("M3 18.6 H12.6 M23 18 H34 M25.4 15 H30.6", 0.6, PAPER) +
      P("M-1 20 H13 L14.6 22.6 H16 L17 25.4 H18.2 L19 29 L19.4 31 H-1Z M41 19.6 H28 L26.4 22.4 H24.8 L23.8 25.4 H22.6 L21.8 29 L21.4 31 H41Z") + S("M-1 22.6 H14.4 M-1 25.4 H16.8 M41 22.4 H26.6 M41 25.4 H24 M-1 28 H18.6 M41 28 H22", 0.6, PAPER) +
      S("M19.6 29.4 Q20.8 30.2 20.2 31.4", 0.9, PAPER) + P("M28 31 Q33 26.4 41 25.6 V31Z") + pines([35.6], 29.4, 15) + S("M35.6 29.4 V31", 1) + S("M7 6 Q8.4 5 9.6 6 Q10.8 5 12 6", 0.7); },
    teton: function () { var b = "M9 33 V27.4 L14 25.2 L15.4 21 L20 17.6 L24.6 21 L26 25.2 L31 27.4 V33Z"; return P("M-1 25 L5 16 L9 19 L13 9 L16 12 L19 3 L22 9 L25 7 L28 14 L32 12 L41 21 V25Z") + S("M19 3 L18 10 M13 9 L12.6 14 M25 7 L25.4 12 M32 12 L32.6 16", 1.1, PAPER) +
      S(b, 2.6, PAPER) + P(b) + P("M18.2 33 V28.6 H21.8 V33Z M19.2 22.4 H20.8 V24.2 H19.2Z", PAPER) + S("M15.4 21 L24.6 21", 0.7, PAPER) + GROUND(33) + S("M0 32.2 H8 M32 32.2 H40", 0.8, PAPER); },
    greatbasin: function () { return PO("M8 26 L18 9 L21 11.6 L24 8 L35 26Z", 0.4) + P("M16 13.2 L18 9 L21 11.6 L24 8 L26.4 12 L24 11.4 L22 13.4 L20 12 L18 14Z", PAPER) +
        P("M15 31 Q12.6 26 15.4 22 Q18.4 18.4 15 14 Q12.6 11 9.4 10.4 L9.8 9.2 Q13.6 9.4 16.4 12.6 Q19.4 15.6 19.6 19.4 Q21.4 15.4 26 13.6 Q29 12 30.4 9 L31.6 9.6 Q30.4 13.6 26.6 16 Q22.4 18.6 22.4 23.4 Q22.4 28 25.4 31Z") +
        S("M17.6 30 Q15.6 26 17.8 22.4 Q20 19 19 15.4", 0.8, PAPER) +
        E(7, 8.6, 3.8, 2.2) + E(3.6, 10, 2.4, 1.6) + E(8.6, 6, 2.2, 1.4) + E(33.4, 7.4, 3.8, 2.2) + E(36.8, 9.4, 2.4, 1.6) + E(31.6, 5, 2.2, 1.4) + E(28.4, 15, 2.8, 1.6) + E(12.6, 14.6, 2, 1.6) +
        P("M-1 31 Q8 29 15 30.6 L25 30.6 Q32 29 41 31 V41 H-1Z") + C(6, 30.4, 1.6) + C(33.4, 30.2, 1.8); },
    sanddunes: function () { return P("M-1 16 L5 9 L9 12 L14 4.6 L19 10.6 L23 7 L28 11.6 L33 5.6 L41 13 V16Z") + S("M14 4.6 L13 9 M33 5.6 L33.6 10 M5 9 L4.6 12.6", 1, PAPER) +
      S("M-1 26 Q9 19 17 17.6 Q22 20.6 29 19.6 Q35 19.4 41 22.6", 1.4) + P("M17 17.6 Q16 24 24 30 H31 Q22 25 17 17.6Z") + P("M29 19.6 Q30.4 25 38 30 H41 V22.6 Q35 19.4 29 19.6Z") + S("M3 27 Q8 24 12 26.6 M5 31 Q10 28 15 30.6", 0.8) + S("M-1 30 H41", 1) + wv(33, 1); },
    smoky: function () { return PO("M-1 14 Q5 9 11 12 Q17 6 24 11 Q31 7 41 12 V41 H-1Z", 0.25) + C(30, 6.4, 2.6) + S("M-1 18.6 Q8 13.6 16 18 Q24 12.6 31 17 Q36 14.4 41 17", 2, PAPER) + PO("M-1 18.6 Q8 13.6 16 18 Q24 12.6 31 17 Q36 14.4 41 17 V41 H-1Z", 0.45) +
      S("M-1 24.6 Q10 19.4 20 24 Q28 20.4 41 23.2", 2, PAPER) + PO("M-1 24.6 Q10 19.4 20 24 Q28 20.4 41 23.2 V41 H-1Z", 0.7) + S("M-1 31 Q12 26 22 30.4 Q30 27.4 41 30", 2, PAPER) + P("M-1 31 Q12 26 22 30.4 Q30 27.4 41 30 V41 H-1Z") + pines([4, 7, 10, 30, 33.4], 31, 5.4); },
    guadalupe: function () { return P("M-1 31 L4 27 L8 25 L11 19 L12.6 11 L14.4 5 H18.4 L21.6 7 L28 7.6 L34 9.6 L41 10.4 V31Z") + S("M14.4 7 L13 20 M17 6.4 L16 21 M15.6 6.6 L14.6 19", 0.9, PAPER) + S("M20 11.6 H40 M22 15.6 H40", 0.8, PAPER) +
      S("M5.4 34 L3.6 29 M5.4 34 L5.4 28.4 M5.4 34 L7.4 29 M5.4 34 L1.6 31.6 M5.4 34 L9.4 31.6", 1.1) + S("M30 34 V25 M30 30 L28 28 M30 28 L32 26", 1) + S("M-1 34 H41", 1.2) + S("M0 31 H40", 0.8, PAPER); },
    haleakala: function () { var s = C(31, 6.6, 3.2) + PO("M-1 14 Q6 10 14 13 Q22 9 30 12.6 Q36 10.6 41 13 V20 H-1Z", 0.4) + S("M-1 17 q3 -2.4 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0", 1, PAPER) + P("M-1 31 Q8 24.6 20 26 Q32 24.6 41 31 V41 H-1Z");
      for (var a = 180; a <= 360; a += 15) { var t = a * Math.PI / 180; s += S("M20 26.4 L" + (20 + 8.6 * Math.cos(t)).toFixed(2) + " " + (26.4 + 6.6 * Math.sin(t)).toFixed(2), 1.5); }
      for (var b = 195; b <= 345; b += 30) { var u = b * Math.PI / 180; s += S("M20 26 L" + (20 + 5 * Math.cos(u)).toFixed(2) + " " + (26 + 4 * Math.sin(u)).toFixed(2), 0.7, PAPER); }
      s += S("M20 20 V5", 1.6); for (var y = 6; y < 19; y += 2.6) s += E(18.4, y, 1.3, 0.9) + E(21.6, y + 1.3, 1.3, 0.9);
      return s + S("M4 28.6 L6 26.8 M34 28.4 L36 27", 1); },
    hawaii: function () { return PO("M24 6 Q26 1.6 30 3.6 Q34 2 35 6 Q37.4 8.4 34 9.6 H25 Q22 8.4 24 6Z", 0.4) + P("M-1 31 Q10 22.6 15 20 H25 Q30 22.6 41 31 V41 H-1Z") + P("M18 20 Q16.6 13 20 5.6 Q23.4 13 22 20Z") +
      C(14.6, 10, 1.1) + C(25.6, 9, 1.3) + C(12.6, 14.4, 0.9) + C(27.4, 13.4, 1) + C(16.6, 5, 0.9) + C(24, 3.6, 1) + C(11, 9, 0.7) + C(29, 7.6, 0.7) +
      S("M21 21.4 Q24.6 25 22.4 29 Q20.4 33 25 37 M18.6 21.4 Q14 26 10 29 Q7 31 6 35", 1.6, PAPER) + S("M0 39 H40", 0.6); },
    hotsprings: function () { var s = P("M6 31 V18 H34 V31Z") + P("M4.6 18 H35.4 L32 14 H8Z") + P("M15 14 L20 9.6 L25 14Z"); [8.4, 12.4, 16.4, 21.2, 25.2, 29.2].forEach(function (x) { s += P("M" + x + " 27 V22.6 Q" + (x + 1.2) + " 21 " + (x + 2.4) + " 22.6 V27Z", PAPER); });
      return s + P("M18.4 31 V28 H21.6 V31Z", PAPER) + S("M4.6 18 H35.4", 0.7, PAPER) + S("M10 9 Q8 6.4 10 4 Q12 1.6 10 -1 M30 9 Q28 6.4 30 4 Q32 1.6 30 -1 M20 7.6 Q18.6 5.6 20 3.6", 1.2) + S("M-1 31 H41", 1.2) + E(20, 34, 10, 2) + S("M14 33.6 Q20 32.6 26 33.6", 0.8, PAPER); },
    indianadunes: function () { return PO("M32.6 26 V23 H34 V19.6 H35.6 V23 H36.6 V21.4 H38.2 V26Z", 0.5) + S("M27 8 Q29 6 31 8 Q33 6 35 8", 1.1) + C(8, 8, 3) +
      P("M-1 27 Q8 15.6 18 16.6 Q26 17.6 31 26 L41 27.4 V30 H-1Z") + S("M12.6 17 L11.6 12.6 M14 16.8 L15 12.4 M18 16.6 L18.6 12.6 M20 17 L20 13.2 M24 17.8 L25.6 14 M9 18.8 L7.6 15.4", 1) + S("M6 24 L5.4 21 M8 23.4 L9 20.6 M16 22 L15.4 19.4 M24 22.6 L25 20", 0.9, PAPER) +
      wv(31.6, 1.2) + wv(34.8, 1.2); },
    isleroyale: function () { return PO("M-1 21 L2 15 L4 21 L6 13.4 L8 21 L32 21 L34 14 L36 21 L38 15.6 L41 21 V23 H-1Z", 0.45) + sub("moose", 0.6, -5.4, 0.98) + wv(31, 1.1, PAPER) + wv(31.4, 1) + wv(34.6, 1); },
    joshua: function () { var sp = function (x, y) { return S("M" + (x - 3) + " " + y + " L" + (x + 3) + " " + y + " M" + x + " " + (y - 3) + " L" + x + " " + (y + 3) + " M" + (x - 2.2) + " " + (y - 2.2) + " L" + (x + 2.2) + " " + (y + 2.2) + " M" + (x - 2.2) + " " + (y + 2.2) + " L" + (x + 2.2) + " " + (y - 2.2), 1.1); };
      return P("M19 33 L19.4 21 Q19 17.6 16 15.4 L12.6 11.4 L14.2 10.2 L17.4 13.6 Q20 15.6 20.4 15 L20.8 9 H23 L22.8 16 Q24 18 27 15 L29 11 L30.6 12 L28.4 16.6 Q25 20.6 22.6 21 L22.6 33Z") + sp(13.2, 10) + sp(21.9, 7.6) + sp(29.8, 10.6) + S("M20 25 L21.6 27 M21 29 L19.6 30.6", 0.8, PAPER) +
        P("M26 33.4 Q26 27 31 26.4 Q35 25 37.4 28 Q41 29 41 33.4Z") + P("M-1 33.4 Q0 28.6 4 28.4 Q8 28.4 9 33.4Z") + S("M31 28 Q33.4 29 34 31.6", 0.8, PAPER) + GROUND(33.4); },
    katmai: function () { return PO("M-1 12 L5 6 L10 10 L16 3 L23 9 L30 4 L41 12 V16 H-1Z", 0.32) +
        P("M5 24 V19 Q5 13 10 11 Q13 8.6 17 9.4 Q19.6 9.8 21 12 L24.4 12.4 Q27 13 27.2 15 L25.8 16.4 L22.6 16.2 Q21.4 19 19 20 L19 24Z") + C(19.4, 10.4, 1.2) + C(23, 13.6, 0.4, PAPER) + P("M24.8 15.4 L27 15.8 L25.4 16.8Z", PAPER) +
        P("M29.6 6.6 Q32.6 5 35 7 L37.4 5.6 L37 9 L38.4 11.4 L35.4 9.8 Q32 11 29.6 6.6Z").replace("<path", '<path transform="rotate(-20 33 8)"') + C(31.6, 7.4, 0.4, PAPER) + S("M30 12 Q31 14 30.6 16", 0.7) +
        P("M-1 24 H41 V25.6 H-1Z") + P("M-1 25.6 H41 V31 H-1Z", PAPER) + S("M4 25.6 Q5 28.6 3.4 31 M13 25.6 Q14 28.4 12.6 31 M24 25.6 Q25 28.6 23.4 31 M34 25.6 Q35 28.4 33.6 31", 0.7) + C(8, 31, 1.8, PAPER) + C(18.6, 31.2, 2, PAPER) + C(29, 31, 1.8, PAPER) +
        P("M-1 31 H41 V41 H-1Z") + S("M2 33 q3 -2 6 0 t6 0 t6 0 t6 0 t6 0 t6 0", 0.9, PAPER); },
    kenai: function () { return PO("M-1 17 L6 7 L11 12 L16 4.6 L22 12.6 L27 7.6 L33 13.6 L41 6 V18 H-1Z", 0.4) + S("M6 7 L5.6 11 M16 4.6 L15.4 9 M27 7.6 L27.4 11", 0.9, PAPER) + S("M-1 19 H41", 0.8) + sub("orca", 0, 2.2, 1); },
    kings: function () { return P("M-1 4 Q8 3 12 8 Q14 14 14.6 31 H-1Z") + P("M41 6 Q32 4 28 10 Q26 16 25.4 31 H41Z") + S("M5 8 L6 26 M9 9 L10.6 27 M31 10 L30 26 M35 8 L34.6 27", 0.9, PAPER) +
      HP("M14.6 31 L17.2 20.6 L19.8 31Z M20 31 L22.6 22.4 L25.2 31Z") + GROUND(31) + S("M20.4 31 Q17 34 21 37 Q24 40 20 42", 1.9, PAPER) + S("M17 4 Q18.6 2.6 20.2 4 Q21.8 2.6 23.4 4", 0.9); },
    kobuk: function () { return PO("M-1 26 Q10 14 22 20 Q30 15 41 21 V41 H-1Z", 0.32) + S("M-1 26 Q10 14 22 20 Q30 15 41 21", 1) +
      P("M7 18 Q6 15 10 15 Q17 16 26 15 L29 18 Q30 23 28 25 L28 33.4 H26 L25 26 L13 26 L11.4 33.4 H9.4 L9.6 25 Q6 23 7 18Z") + P("M26 15 L29 11 Q31 9.6 33 10.6 L36.4 13.4 L35.4 15 L31.6 14.6 L29 18Z") + P("M26.6 16.4 Q28 21 29.2 20 L29.6 17Z", PAPER) +
      S("M30 10.4 Q27 5 30 1.4 M28.8 6 L26.4 5 M29.6 3.4 L27.6 2 M31.6 10 Q34 5 33 1 M33.2 5.4 L35.6 4 M31.4 10.4 L33.6 9", 1.2) + C(32.6, 12, 0.6, PAPER) + P("M7 16.6 L4.6 15.4 L6 18Z") + S("M-1 33.6 H41", 1); },
    lakeclark: function () { return P("M-1 19 L6 12 L10 14.6 L17 5 L21 8.6 L24 7 L31 14 L35 12.6 L41 17 V19Z") + S("M17 5 L16 10 M24 7 L24.6 11 M6 12 L5.4 15", 1, PAPER) +
      P("M6 23.4 Q7 21 11 21 L25 21 L30 17.6 H32.4 L31.6 21.6 L30 23.4 L25 24 H8Z") + P("M12 19.4 H27.4 V20.6 H12Z") + S("M5.2 20.4 V26.4", 1) + P("M8 27.4 H26 Q27.6 27.4 27 28.6 H9 Q7.4 28.6 8 27.4Z") + S("M11 23.8 L11 27.4 M22 24 L22.4 27.4 M14 20.6 L17 23", 0.8) +
      P("M13 21.8 H16 V22.8 H13Z M17 21.8 H20 V22.8 H17Z", PAPER) + wv(31, 1) + wv(34.4, 1); },
    lassen: function () { return P("M-1 28 L9 17 L13 12 L16 8 L19 7 L22 8.6 L27 14 L33 20 L41 26 V28Z") + S("M16 8 L15 14 M19 7 L19 13 M22 8.6 L23.4 14 M13 12 L11.6 16 M27 14 L27.4 18", 1.1, PAPER) + GROUND(28) +
      E(10, 32.6, 4.4, 1.4, 0, PAPER) + E(28, 32, 5, 1.6, 0, PAPER) + H("M10 31 Q8 27.6 10 24.6 Q12 21.6 10 18.6 M28 30.4 Q26 27.4 28 24.4 Q30 21.4 28 18.2 M32 30.4 Q30.8 27.6 32.4 25", 1.1); },
    mammoth: function () { return PO("M-1 31 V18 Q8 9 22 8.4 Q34 9 41 15 V31Z", 0.42) + pines([4, 30, 34, 38], 13.6, 6) + pines([25.4], 10.6, 5) +
        P("M5 31 Q5.4 19.6 15 17.4 Q24 16.4 28 22 Q30.4 26 30.6 31Z") + S("M8 21.6 Q13 18.6 19 18.6", 0.8, PAPER) +
        S("M27 31 H24 V29 H21 V27 H18.4 V25.2 H16.2", 1.1, PAPER) + S("M28.4 29.4 L17.4 23.4", 0.6, PAPER) + person(25.6, 24.4, 0.7).replace(/<path/g, '<path stroke="#fff"').replace(/<circle/g, '<circle fill="#fff"') +
        P("M-1 31 H41 V41 H-1Z") + S("M6 33 H34", 0.8, PAPER); },
    mesaverde: function () { return P("M-1 3 H41 V12.4 Q30 9 20 9.2 Q10 9 -1 12.4Z") + S("M-1 6 H41 M-1 9 Q20 6.4 41 9", 0.7, PAPER) + PO("M-1 12.4 Q10 9 20 9.2 Q30 9 41 12.4 V27 H-1Z", 0.62) +
        P("M3 27 V20 H8 V27Z M8 27 V17 H13 V27Z M13 27 V21.4 H17 V27Z M22 27 V18.6 H27 V27Z M27 27 V21 H31 V27Z M31 27 V19 H36 V27Z", PAPER) + P("M17.4 27 V15 Q19.6 13.6 21.8 15 V27Z", PAPER) +
        S("M3 27 V20 H8 V17 H13 V21.4 H17.4 V15 Q19.6 13.6 21.8 15 V18.6 H27 V21 H31 V19 H36 V27", 0.8) +
        P("M5 22 h1.4 v1.8 h-1.4Z M10 19.4 h1.4 v2 h-1.4Z M10 23.4 h1.6 v3.6 h-1.6Z M14.6 23 h1.2 v1.8 h-1.2Z M19 17 h1.2 v2 h-1.2Z M19 22 h1.2 v2 h-1.2Z M24 21 h1.4 v2 h-1.4Z M28.4 23 h1.2 v1.8 h-1.2Z M33 21.4 h1.4 v2 h-1.4Z M33 24.4 h1.4 v2.6 h-1.4Z") +
        P("M-1 27 H41 V41 H-1Z") + S("M-1 30 H41 M-1 33 H41", 0.8, PAPER); },
    rainier: function () { var lup = function (x, y) { return S("M" + x + " " + (y + 5) + " V" + (y + 1), 0.8, PAPER) + E(x, y, 0.8, 1.2, 0, PAPER) + E(x, y + 1.8, 1, 1.1, 0, PAPER) + E(x, y + 3.4, 1.2, 1.1, 0, PAPER); };
      return P("M-1 23 L7 18 Q13 11 16.4 7.4 Q20 5 23.6 7.4 Q27 11 33 18 L41 23 V31 H-1Z") +
        P("M11.6 14 Q14.4 10 16.4 7.4 Q20 5 23.6 7.4 Q25.6 10 28.4 14 L26.4 13 L25 16.4 L23 13.4 L21 17.6 L19 13.6 L16.6 16.6 L15 13.2Z", PAPER) + S("M18 9 L16 13 M22 9 L24.4 13.4 M20 8 V11.6", 0.8) +
        pines([2, 5, 35, 38.4], 26, 7) + P("M-1 25 Q20 21.4 41 25 V41 H-1Z") + lup(8, 24.6) + lup(12, 26) + lup(16.6, 24) + lup(21, 25.6) + lup(25.6, 24.2) + lup(30, 25.8) + lup(34, 24.8); },
    newriver: function () { return P("M-1 14 L6 15 L10 22 L14 30 L16 41 H-1Z") + P("M41 14 L34 15 L30 22 L26 30 L24 41 H41Z") + S("M2 19 L5 21 M4 25 L8 27 M34 20 L37 18 M31 26 L35 24.6", 1, PAPER) +
      S("M-1 11.6 H41", 2.2) + H("M7.6 19.4 Q20 3 32.4 19.4", 2) + S("M9.6 12.4 V16.6 M12.6 12.4 V14.2 M15.6 12.4 V13 M24.4 12.4 V13 M27.4 12.4 V14.2 M30.4 12.4 V16.6", 1) + wv(36.4, 1.1, PAPER); },
    northcascades: function () { return P("M-1 24 L4 16 L6 18 L10 6 L12 10 L14 4 L17 12 L20 9 L24 16 L27 8 L29 11 L31 5 L35 14 L41 18 V24Z") + S("M10 6 L9.6 11 M14 4 L14.4 10 M27 8 L26.6 13 M31 5 L31.6 11 M20 9 L20.2 13", 1, PAPER) +
      pines([2, 5, 8, 33, 36, 39], 24.4, 4.4) + S("M2 27 H38 M5 29.6 H35 M9 32.2 H31", 1) + PO("M10 26.6 L14 33 L18 26.6Z M22 26.6 L27 32.4 L31 26.6Z", 0.25); },
    olympic: function () { return C(17, 11, 3.4) + P("M6 4 L9.6 12 H8 L11 19 H9 L12.4 26 H-0.4 L3 19 H1 L4 12 H2.4Z") + P("M5 26 H7 V31 H5Z") +
      P("M24 30 V16 Q24 12 27 11.4 Q29 10 30 13 L31 30Z") + P("M33 30 V22 Q34 19.6 36 20.4 L37.6 30Z") + P("M15 30 V24.6 Q16 22 17.6 23 L19 30Z") + pines([27, 35.4], 11.8, 5) +
      wv(31.2, 1.1) + wv(34.2, 1) + S("M2 37 L13 35.4 M9 35.6 L11 33.6", 1.4); },
    petrified: function () { var seg = function (x, y, L, r) { return P("M" + x + " " + (y - r) + " H" + (x + L) + " V" + (y + r) + " H" + x + "Z") + S("M" + (x + 1) + " " + (y - r * 0.4) + " H" + (x + L - 1) + " M" + (x + 2) + " " + (y + r * 0.4) + " H" + (x + L - 2), 0.6, PAPER) +
        E(x + L, y, r * 0.55, r, 0, PAPER) + E(x + L, y, r * 0.55, r).replace("<ellipse", '<ellipse fill="none" stroke-width="1.1"') + E(x + L, y, r * 0.3, r * 0.6).replace("<ellipse", '<ellipse fill="none" stroke-width=".7"') + E(x + L, y, 0.5, 0.8); };
      return PO("M-1 19 L4 14 H11 L14 17 L19 16 L23 12 H30 L33 16 L41 15 V24 H-1Z", 0.4) + S("M0 17.6 H40 M0 20.6 H40", 0.8, PAPER) + P("M-1 31 Q20 27 41 31 V41 H-1Z").replace("<path", '<path fill-opacity=".55"') +
        seg(3, 26, 9, 4) + seg(15.4, 27.6, 7, 3.6) + seg(26, 28.4, 8, 3.2) + P("M-1 32 H41 V41 H-1Z"); },
    pinnacles: function () { return P("M1 34 L3.6 24 L6 20 L8 23 L10 17 L12 21 L14.4 26 L16 34Z M23 34 L25.6 25 L28 19 L30 22 L32 16 L34.4 21 L38 34Z") + S("M5 26 L8 25 M27 26 L31 25 M10 30 L13 29", 0.9, PAPER) + GROUND(34) +
      P("M2 12 Q10 7 18 10.4 L20 9 L22 10.4 Q30 7 38 12 L36.6 12.6 L37.4 14 L35.4 13.6 L35.8 15 L33.6 14.2 Q28 13 23 14.4 L21.6 17 L18.4 17 L17 14.4 Q12 13 6.4 14.2 L4.2 15 L4.6 13.6 L2.6 14 L3.4 12.6Z") +
      C(20, 8.6, 1.5) + S("M8 12.4 Q12 11.2 16 12.2 M24 12.2 Q28 11.2 32 12.4", 1, PAPER) + P("M18.4 17 L20 20 L21.6 17Z"); },
    redwood: function () { var fern = function (x) { return S("M" + x + " 34 Q" + (x - 4) + " 30 " + (x - 7) + " 31 M" + x + " 34 Q" + (x + 4) + " 30 " + (x + 7) + " 31 M" + x + " 34 Q" + (x - 2) + " 28 " + (x - 3) + " 26 M" + x + " 34 Q" + (x + 2) + " 28 " + (x + 3) + " 26", 1.1); };
      return P("M6 -1 H10.4 L11 33 H5.4Z M15 -1 H17.6 L18 33 H14.6Z M25 -1 H30 L30.8 33 H24.2Z M34 -1 H36 L36.4 33 H33.6Z") + S("M7.6 2 V31 M27.2 2 V31 M28.8 4 V29", 0.8, PAPER) + S("M17.6 6 L22 4 M24.6 10 L21 8 M33.8 8 L31 6", 1) +
        person(21.6, 26.4, 1) + fern(4) + fern(31) + S("M-1 34 H41", 1); },
    rocky: function () { return PO("M-1 22 L6 12 L10 16 L17 6 L22 13 L27 9 L34 17 L41 13 V22Z", 0.38) + S("M17 6 L16.4 10 M27 9 L27.4 12.6", 0.9, PAPER) +
        P("M13 21 Q12.6 17.4 16 17 H27 Q30.6 17 31 19.6 L31 23 Q31 25 29.4 25.4 L29.6 31 H28 L27.4 26 H17.2 L16.4 31 H14.8 L14.4 25.4 Q13 24.6 13 21Z") +
        P("M16.6 18 Q14 14.6 11.6 11.2 L7.6 11.8 Q6 12.2 6.2 13.6 L9 14.4 Q11 17.4 13.6 21.4Z") + P("M11.6 11.4 L12.6 9.4 L13.4 11.6Z") + C(9.6, 12.2, 0.45, PAPER) +
        S("M12 10.8 Q13 6 18 3 M14 7.6 L12.2 4.6 M15.6 5.4 L15 2 M17.6 3.4 L18.4 0.4 M18 3 L21.6 2", 1.1) + S("M11 11 Q10.4 6 13.6 2.4 M11.2 7.6 L8.8 5.4 M12 5 L10.8 2.2", 1) +
        S("M14.6 18 Q13.4 21 14.4 24", 1.4) + GROUND(31.4); },
    saguaro: function () { return C(30.4, 12, 4.4) + PO("M-1 28 L6 23 L12 25 L18 21 L25 24 L31 20.6 L41 25 V30 H-1Z", 0.4) + sub("saguaro", 1, 0.4, 0.92) + S("M0 33.6 H40", 1) + P("M5 33.6 Q5 30 7.6 29.6 Q9 30 9 33.6Z"); },
    sequoia: function () { return P("M10 41 Q12 34 13 26 L14 -1 H26 L27 26 Q28 34 30 41Z") + S("M17 2 V34 M20 0 V36 M23 2 V34", 0.9, PAPER) + P("M18.4 35 Q19.6 29 20.4 28 Q21.4 29.6 22 35Z", PAPER) + S("M14 6 L8 2 M26 8 L33 3 M14.4 14 L10 12", 1.6) +
      person(5.4, 26, 1.1) + person(34.6, 26, 1.1) + S("M-1 33.4 H41", 1); },
    shenandoah: function () { return PO("M-1 17 Q8 10 16 14 Q24 8 32 13 Q37 11 41 13 V41 H-1Z", 0.25) + S("M-1 22 Q10 15 20 20 Q30 15.6 41 19", 2, PAPER) + PO("M-1 22 Q10 15 20 20 Q30 15.6 41 19 V41 H-1Z", 0.45) +
        P("M11 19.6 Q11 17 14 16.8 H23.6 Q26 16.8 26.6 18.4 L26.6 20.4 Q26.4 22.4 25 22.8 H15 Q11 22.6 11 19.6Z") + S("M14 22 L13.4 26 L14 30.6 M16 22.4 L16.6 26.4 L16 30.6 M23.4 22.4 L23.8 26.4 L23.4 30.6 M25.4 22 L26 26 L25.6 30.6", 1.1) +
        P("M23.6 17.8 Q25.6 13.4 27.6 10.6 L29.2 11.2 Q27.8 14.4 26.8 18.6Z") + P("M27.4 9.6 Q29.6 8.6 31 9.6 L33.6 11.6 Q33.6 12.8 32.2 12.6 L28.8 11.8Z") +
        P("M28 9.6 L25.8 7.2 L28.8 8.8Z M29.2 9.2 L29.8 6.4 L30.4 9Z") + C(30.4, 10.2, 0.35, PAPER) + P("M11.4 17.6 L9.4 16 L10.6 19Z") + S("M-1 31 H41", 1.1); },
    roosevelt: function () { return PO("M-1 21 L4 15 L7 16.4 L11 12 L15 14.4 L18 10 L22 13 L26 9.4 L30 12.4 L33 10 L37 12 L41 15 V21Z", 0.38) + S("M0 15.6 H40 M0 18.4 H40", 0.7, PAPER) +
      P("M-1 30 Q20 27 41 30 V41 H-1Z") + bison(4.6, 9.6, 1.08) + S("M3 33 H37", 0.8, PAPER); },
    virginislands: function () { return P("M28 13 Q32 9.4 41 10.6 V14 H27Z") + palmlet(33.4, 11) + wv(15.4, 1, null) +
        P("M24.6 17.4 Q28.6 11.4 33.4 10.6 Q30 14.6 26.4 19.4Z M24.6 26.6 Q28.6 32.6 33.4 33.4 Q30 29.4 26.4 24.6Z M13.4 18.4 Q10.4 15.6 8 16.4 Q10 18.4 13 20Z M13.4 25.6 Q10.4 28.4 8 27.6 Q10 25.6 13 24Z") +
        E(19.6, 22, 7.6, 5.8) + E(28.8, 22, 2.6, 1.9) + C(29.8, 21.2, 0.4, PAPER) + P("M11.8 22 L9 22.6 L11.8 23Z") +
        S("M16.4 19.4 L19.6 18 L22.8 19.4 L22.8 24.6 L19.6 26 L16.4 24.6Z M19.6 18 V16.4 M16.4 19.4 L13.6 18.6 M22.8 19.4 L25.4 18.6 M16.4 24.6 L13.6 25.4 M22.8 24.6 L25.4 25.4 M19.6 26 V27.6", 0.8, PAPER) +
        wv(31, 1, null) + wv(35, 1, null); },
    voyageurs: function () { var s = PO("M-1 17 H41 V19 H-1Z", 0.5); for (var x = 0; x <= 40; x += 3.2) s += PO("M" + (x - 1.6) + " 18 L" + x + " " + (10 + (x * 7) % 5) + " L" + (x + 1.6) + " 18Z", 0.5);
      var pd = function (x) { return C(x, 17.6, 1.6) + P("M" + (x - 1.6) + " 25 L" + (x - 1.2) + " 20 Q" + x + " 19 " + (x + 1.2) + " 20 L" + (x + 1.6) + " 25Z") + S("M" + (x + 3) + " 18.6 L" + (x - 2) + " 29", 1.1) + E(x - 2.4, 29.6, 0.9, 2, 20); };
      return s + pd(13) + pd(26) + P("M3 23.4 Q4 27 9 28 H31 Q36 27 37 23.4 Q30 25.4 20 25.4 Q10 25.4 3 23.4Z") + wv(31.6, 1) + wv(34.8, 1); },
    whitesands: function () { return PO("M-1 18 L5 13 L9 15 L14 10 L19 14 L24 12 L30 15 L35 11 L41 15 V19 H-1Z", 0.45) + C(9, 6.4, 3) + C(9, 6.4, 1.9, PAPER) + S("M-1 24 Q9 17.6 19 20.6 Q27 16.8 41 21.4", 1.4) + S("M-1 30.4 Q12 25.6 24 28.6 Q32 26.6 41 29.6", 1.2) +
      S("M3 27 Q8 25 12 26.6 M26 25.4 Q30 23.6 34 25 M12 33 Q17 31 22 32.4 M30 32.6 Q34 31 38 32.4", 0.8) +
      S("M30 26 V15 M30 26 L26 22 M30 26 L34 22 M30 26 L27 20.6 M30 26 L33 20.6 M30 26 L25.4 24.6 M30 26 L34.6 24.6", 1) + E(30, 13, 1.4, 2.4) + C(28.6, 16, 0.8) + C(31.4, 16.6, 0.8); },
    windcave: function () { var g = ""; for (var i = -40; i < 44; i += 4.4) g += "M" + i + " -1 L" + (i + 32) + " 31 M" + (i + 32) + " -1 L" + i + " 31 ";
      return PO("M6 31 Q13 22 21 25 Q28 21 34 26 V31Z", 0.35) + bison(12.4, 20.8, 0.3, 1) + S("M9 13 Q14 11 18 13.4 Q21 15.4 18.6 17 M11 16.6 Q14.6 15.4 16.6 16.6 M23 15 Q27 13.4 30 15", 0.7) +
        P("M-1 -1 H41 V31 H34.6 Q35 13 20 10.4 Q5 13 5.4 31 H-1Z") + S(g, 0.55, PAPER) + S("M5.4 31 Q5 13 20 10.4 Q35 13 34.6 31", 1.6) + S("M-1 31.4 H41", 1); },
    wrangell: function () { var bl = function (x, y, w, h) { return P("M" + x + " " + (y + h) + " V" + y + " L" + (x + w / 2) + " " + (y - w * 0.42) + " L" + (x + w) + " " + y + " V" + (y + h) + "Z"); };
      var b = bl(10.6, 15, 8, 6.4) + bl(15.4, 20, 8.6, 6.6) + bl(21, 24.6, 9, 6.4);
      return P("M-1 20 L6 10 L11 14 L17 3 L23 12 L28 7 L35 15 L41 11 V20Z") + S("M17 3 L16 9 M28 7 L28.6 12 M6 10 L5.4 14", 1, PAPER) + PO("M-1 30 Q20 25 41 29 V41 H-1Z", 0.5) + '<g stroke="#fff" stroke-width="2.6" stroke-linejoin="round">' + b + "</g>" + b +
        P("M12.4 17 H14 V18.6 H12.4Z M15.4 17 H17 V18.6 H15.4Z M17.4 22 H19 V23.6 H17.4Z M20.4 22 H22 V23.6 H20.4Z M23 26.6 H24.6 V28.2 H23Z M26 26.6 H27.6 V28.2 H26Z", PAPER); },
    yellowstone: function () { var pl = "M18.6 31 L17.8 23 Q15.8 15 15.2 9 Q14.6 4 18.4 2.6 Q21.2 1.6 23.4 3.2 Q27.4 2 30.4 4.2 Q33.6 6.4 31.2 8.6 Q28 9.6 25.6 9 Q24.6 14 23.8 19 L22.8 31Z", dots = "";
      [[13.4, 12], [12.4, 15.4], [12, 19], [12.2, 22.6], [27, 14], [27.8, 17.6], [28.2, 21.2], [28.2, 24.6]].forEach(function (p) { dots += C(p[0], p[1], 0.7); });
      return P(pl, PAPER) + S(pl, 1.4) + S("M19.6 29 L19 22 Q17.6 15 17.6 9 M21.8 29 L22 22 Q22.4 14 21.8 6 M24.6 6 Q27.6 5.6 29.6 6.6", 0.85) + dots +
        S("M33 5 Q36 4 37.6 6 Q39.6 6.6 39 8.6 M33.6 11 Q36 10.6 37.4 12", 1) +
        P("M3 34 Q11 28.6 20 29.4 Q29 28.6 37 34Z") + S("M10 31.6 Q20 29.6 30 31.6", 0.9, PAPER) + bison(0.4, 20, 0.5) + pines([36.4], 30, 7) + S("M-1 33.6 H41", 1); },
    yosemite: function () { return PO("M-1 30 L-1 10 Q3 9 5 14 L6 30Z", 0.5) + P("M2 30 Q4 18 11 10 Q16 5 21 5 Q24 5.6 24.4 8 L24.6 20 L30 30Z") + S("M23.4 9 V19 M21.8 7.6 V18 M19.6 7 Q16 12 13 20", 0.9, PAPER) +
      S("M-1 30.4 H41", 2, PAPER) + pines([2, 5.4, 9, 12.4, 27.4, 31, 34.4, 38], 33.4, 7.4) + S("M14 33.4 H26", 1) + S("M30 6 Q32 4.4 34 6 Q36 4.4 38 6", 0.9); },
    zion: function () { return P("M-1 -1 H11 Q12 6 10.6 12 Q13 18 12 24 L15 34 H-1Z") + P("M41 -1 H29 Q27.6 6 29.4 12 Q27 18 28 24 L25 34 H41Z") +
      S("M0 6 Q5 7 10.6 6 M0 13 Q6 14 11 12.4 M0 20 Q6 21 12.4 19.6 M0 27 Q7 28 13.4 27 M29 6 Q35 7 40 6 M29 12.4 Q35 14 40 13 M28 19.6 Q34 21 40 20 M27 27 Q34 28 40 27", 0.9, PAPER) +
      S("M15.6 31.6 Q20 30.4 24.4 31.6 M17 28.4 Q20 27.6 23 28.4", 0.9) + person(19.4, 20.6, 1.1) + S("M21.6 23 V28.4", 0.7) + C(20, 4, 2.4); }
  };
  function palmlet(x, y) { return S("M" + x + " " + y + " Q" + (x + 0.6) + " " + (y - 4) + " " + x + " " + (y - 7), 1) + P("M" + x + " " + (y - 7) + " q-3 -1.6 -5 0.6 q3 -0.8 5 0.2Z M" + x + " " + (y - 7) + " q3 -1.6 5 0.6 q-3 -0.8 -5 0.2Z M" + x + " " + (y - 7) + " q-1 -2.6 -3.4 -3 q2 1.4 3.2 3.2Z M" + x + " " + (y - 7) + " q1 -2.6 3.4 -3 q-2 1.4 -3.2 3.2Z"); }
  Object.keys(NPG).forEach(function (k) { G["np_" + k] = NPG[k]; });
  // ---------- state parks, monuments and memorials: one scene per place, drawn for the round window ----------
  function T(tx, ty, s, inner) { return '<g transform="translate(' + tx + " " + ty + ") scale(" + s + ')">' + inner + "</g>"; }
  function R(x, y, w, h, f) { return P("M" + x + " " + y + " h" + w + " v" + h + " h" + (-w) + "Z", f); }
  function fall(x0, x1, y0, y1, n) { var w = x1 - x0, m = (y0 + y1) / 2, s = P("M" + x0 + " " + y0 + " H" + x1 + " Q" + (x1 + w * 0.06) + " " + m + " " + (x1 + w * 0.14) + " " + y1 + " H" + (x0 - w * 0.14) + " Q" + (x0 - w * 0.06) + " " + m + " " + x0 + " " + y0 + "Z", PAPER), st = "";
    n = n || 3; for (var i = 1; i <= n; i++) { var x = x0 + w * i / (n + 1), dx = (x - (x0 + x1) / 2) * 0.22; st += "M" + x.toFixed(1) + " " + (y0 + 1) + " Q" + (x + dx * 0.4).toFixed(1) + " " + m + " " + (x + dx).toFixed(1) + " " + (y1 - 1 - (i % 2) * 2); }
    return s + S(st, 0.7) + S("M" + x0 + " " + y0 + " H" + x1, 1.2); }
  function mist(x0, x1, y) { var s = "", o = ""; for (var x = x0; x <= x1; x += 3.4) { s += C(x, y, 2, PAPER); o += (o ? " " : "M") + (x - 2) + " " + y + " Q" + x + " " + (y - 3) + " " + (x + 2) + " " + y; } return s + S(o, 0.7); }
  function sky(d) { return PO(d, 0.3); }
  function bison(x, y, s, f) { return T(x, y, s * 0.86, (f ? '<g transform="matrix(-1 0 0 1 36 0)">' : "<g>") +
    P("M1 17 Q0 13 2 11 L4 9 Q6 1 13 0.6 Q19 0.4 22 4 Q28 4.6 32 7 Q34.6 9 34 14 L33.6 22 H32 L31.4 16 Q29 16.8 27.4 16.2 L27 22 H25.4 L25 16.4 Q20 17.4 15.4 16.6 L15 22 H13.4 L12.8 17.4 L11.8 22 H10.2 L10.2 16.4 Q8.6 19.6 6 20 Q3.6 20.4 2.6 18.6 Q1.4 18.6 1 17Z") +
    S("M3.6 10 Q1.8 8 3.4 6.2", 1.1) + C(4, 12.4, 0.6, PAPER) + S("M33.8 8.6 Q36 10 35.4 14", 0.9) + S("M6 8 Q9 4 13 3 M7.4 13 Q10 11 13.4 12", 0.7, PAPER) + "</g>"); }
  function conifers(xs, y, h) { return pines(xs, y, h) + S(xs.map(function (x) { return "M" + x + " " + y + " v1.6"; }).join(" "), 0.8); }
  function lighthouse(x, y, h, w, band) { var t = y - h, s = P("M" + (x - w) + " " + y + " L" + (x - w * 0.62) + " " + t + " H" + (x + w * 0.62) + " L" + (x + w) + " " + y + "Z");
    if (band) s += P("M" + (x - w * 0.86) + " " + (y - h * 0.3) + " L" + (x - w * 0.78) + " " + (y - h * 0.5) + " H" + (x + w * 0.78) + " L" + (x + w * 0.86) + " " + (y - h * 0.3) + "Z M" + (x - w * 0.72) + " " + (y - h * 0.7) + " L" + (x - w * 0.66) + " " + (y - h * 0.88) + " H" + (x + w * 0.66) + " L" + (x + w * 0.72) + " " + (y - h * 0.7) + "Z", PAPER);
    return s + R(x - w * 0.9, t - 0.8, w * 1.8, 0.8) + R(x - w * 0.45, t - 3.2, w * 0.9, 2.4, PAPER) + S("M" + (x - w * 0.45) + " " + (t - 0.8) + " V" + (t - 3.2) + " H" + (x + w * 0.45) + " V" + (t - 0.8), 0.8) + P("M" + (x - w * 0.6) + " " + (t - 3.2) + " Q" + x + " " + (t - 5.6) + " " + (x + w * 0.6) + " " + (t - 3.2) + "Z"); }
  function water(y) { return P("M-1 " + y + " H41 V41 H-1Z") + S("M3 " + (y + 2) + " q3 -1.4 6 0 t6 0 M22 " + (y + 2.6) + " q3 -1.4 6 0 t6 0", 0.8, PAPER); }
  function cols(x, y, w, h, n) { var s = R(x - 1, y - h - 2.4, w + 2, 2.4) + R(x - 1.4, y, w + 2.8, 1.6); for (var i = 0; i < n; i++) s += R(x + i * w / n + w / n * 0.2, y - h, w / n * 0.6, h); return s; }
  function ped(x, y, w, h) { return P("M" + (x - w / 2) + " " + y + " L" + x + " " + (y - h) + " L" + (x + w / 2) + " " + y + "Z"); }
  function heads(x, y, s) { return T(x, y, s, P("M0 10 Q0 3 4 2 Q8 3 8 10Z M3 1.4 Q4 -0.6 5.4 1.4") ); }
  function stair(x, y, n, dx, dy, w) { var d = "M" + x + " " + y; for (var i = 0; i < n; i++) d += " h" + dx + " v" + dy; return S(d, w || 0.9); }

  var XPG = {
    "sp-custer": function () { return sky("M-1 20 L5 14 L8 16 L12 11 L16 15 L21 9 L25 14 L29 12 L34 16 L41 13 V24 H-1Z") + conifers([3, 6, 33, 36.4], 24, 7) + P("M13 14 L14 9 L15 14Z M17 13 L18.2 6.6 L19.4 13Z", 0) +
        PO("M-1 24 Q20 21 41 24 V31 H-1Z", 0.3) + bison(4.4, 10.4, 1.04) + P("M-1 30 H41 V41 H-1Z"); },
    "sp-niagara-falls": function () { return sky("M-1 14 H41 V17 H-1Z") + P("M-1 16 Q20 12 41 16 V19 Q20 15 -1 19Z") +
        P("M1 19 Q20 15 39 19 L37 29 Q20 26 3 29Z", PAPER) + S("M5 19 L4.4 27.6 M11 17.6 L10.6 26.4 M17 17 V26 M23 17 V26 M29 17.6 L29.4 26.4 M35 19 L35.6 27.6", 0.7) + S("M1 19 Q20 15 39 19", 1.2) + mist(4, 36, 29.4) +
        water(31) + P("M24 30.6 H33 L32 32.2 H25Z M27 30.6 V28.6 H30 V30.6Z", PAPER); },
    "sp-letchworth": function () { var tr = "M2 4 H38"; for (var x = 4; x <= 36; x += 4) tr += " M" + x + " 4 L" + (x + 2) + " 9 L" + (x + 4) + " 4"; return P("M-1 9 H11 L13 31 H-1Z M41 9 H29 L27 31 H41Z") + S(tr, 0.8) + S("M2 4 H38 M2 9 H38", 1.2) + S("M8 9 V31 M32 9 V31 M14 9 L13 31 M26 9 L27 31", 0.8) +
        fall(15, 25, 13, 30, 3) + mist(14, 26, 30) + water(31); },
    "sp-watkins-glen": function () { return P("M-1 3 H13 Q16 14 15 31 H-1Z M41 3 H27 Q24 14 25 31 H41Z") + S("M1 8 H11 M1 14 H12 M1 20 H13 M29 8 H39 M28 14 H39 M27 20 H39", 0.7, PAPER) +
        '<path fill="none" stroke="currentColor" stroke-width="2.4" d="M13.6 12 Q20 6 26.4 12"/>' + S("M13 12.6 Q20 8.6 27 12.6", 0.6, PAPER) + fall(17.6, 22.4, 12.4, 22, 2) + fall(18, 22, 24, 30, 1) + S("M14 23 H26", 1.2) + stair(4, 30, 4, 1.4, -1.4, 0.8) + water(31); },
    "sp-valley-of-fire": function () { return C(32, 8, 3) + P("M2 31 Q2 21 8 18 Q14 15 20 17 Q26 17 28 21 Q30 25 29 31 H24 Q24 25 21 24 Q18 23.6 17 27 L16 31Z") + P("M4 31 Q4 26 7 24 Q9 26 9 31Z", PAPER) +
        S("M6 21 Q14 18 24 20 M8 25 Q12 23 15 25", 0.8, PAPER) + P("M28 31 Q31 25 35 26 Q39 27 41 31Z") + GROUND(31); },
    "sp-anza-borrego-desert": function () { var oc = ""; [[-9, 2], [-5, 5], [-1, 6], [3, 5], [7, 2]].forEach(function (a) { oc += "M20 31 Q" + (20 + a[0] * 0.5) + " 20 " + (20 + a[0]) + " " + (10 - a[1] * 0.6); });
      var tk = ""; for (var y = 13; y < 29; y += 2.6) tk += "M" + (20 - (31 - y) * 0.32) + " " + y + " l-1 -0.8 M" + (20 + (31 - y) * 0.3) + " " + y + " l1 -0.8 ";
      return C(31, 7, 3.2) + sky("M-1 24 L6 18 L12 21 L18 16 L26 21 L33 17 L41 22 V31 H-1Z") + S(oc, 1.3) + S(tk, 0.6) + P("M10 8.4 l0.6 -2.4 l0.6 2.4Z M13 6.6 l0.6 -2.4 l0.6 2.4Z M24 5.4 l0.6 -2.4 l0.6 2.4Z M27 8.6 l0.6 -2.4 l0.6 2.4Z") + GROUND(31) + S("M4 33 H36", 0.7, PAPER); },
    "sp-julia-pfeiffer-burns": function () { return P("M-1 6 Q8 4 18 8 L20 20 Q22 26 26 28 L-1 31Z") + conifers([3, 7, 11], 7, 5) + fall(17.6, 19.6, 9, 26, 1) + P("M14 31 Q20 24.6 41 26 V31Z", PAPER) + S("M14 31 Q20 24.6 41 26", 1) +
        P("M26 26 V31 H41 V26Z").replace("<path", '<path fill-opacity=".45"') + water(31) + S("M28 27.4 q2 -1 4 0 t4 0", 0.8); },
    "sp-humboldt-redwoods": function () { return P("M1 31 L3 -1 H9 L10 31Z M30 31 L31 -1 H38 L40 31Z") + P("M12 31 L13.4 -1 H16 L16.6 31Z M23.4 31 L24 -1 H26.6 L28 31Z").replace("<path", '<path fill-opacity=".5"') +
        S("M4 6 V26 M7 4 V24 M33 8 V27 M36 5 V22", 0.7, PAPER) + P("M16.6 31 L19.4 12 H20.6 L23.4 31Z", PAPER) + S("M20 30 V27 M20 24 V22 M20 19 V17.6", 0.8) + GROUND(31) + P("M17.6 28.4 h4.8 v-1.4 l-1 -1.4 h-2.8 l-1 1.4Z") + C(18.6, 29, 0.7, PAPER) + C(21.4, 29, 0.7, PAPER); },
    "sp-emerald-bay": function () { return P("M-1 20 L5 10 L9 14 L14 6 L20 13 L26 7 L31 12 L36 8 L41 13 V22 H-1Z") + P("M12.6 8.6 L14 6 L15.6 8.6 L14.2 8Z M24.6 9.2 L26 7 L27.4 9.4Z", PAPER) +
        P("M-1 22 Q20 18 41 22 V31 H-1Z").replace("<path", '<path fill-opacity=".45"') + P("M15 24 Q20 19.4 25 24Z") + conifers([18.4, 20, 21.6], 22.4, 3.4) + P("M19.4 19 h1.4 v-1.6 l-0.7 -0.8 l-0.7 0.8Z", PAPER) +
        conifers([2, 5, 35, 38], 31, 8) + S("M8 27 q3 -1.4 6 0 M26 28 q3 -1.4 6 0", 0.7) + GROUND(31); },
    "sp-starved-rock": function () { return sky("M-1 20 Q20 17 41 20 V24 H-1Z") + P("M8 31 V12 Q8 8 12 8 H26 Q30 8 31 12 L33 31Z") + conifers([12, 15, 18, 22, 25, 28], 8.6, 4) + S("M10 14 H31 M10 19 H32 M10 24 H32", 0.8, PAPER) +
        P("M30 4 q2 -1.6 4 0 q2 -1.6 4 0 q-2 -0.6 -4 1 q-2 -1.6 -4 -1Z") + water(29) + P("M-1 29 H8 V31 H-1Z"); },
    "sp-dead-horse-point": function () { return C(33, 6, 2.6) + sky("M-1 12 L6 10 H14 L16 12 H26 L28 10 H41 V16 H-1Z") + P("M-1 15 H41 V31 H-1Z") +
        P("M8 31 Q6 22 13 20 Q22 18 24 23 Q26 28 20 28 Q15 28 16 24", "none").replace('fill="none"', 'fill="none" stroke="#fff" stroke-width="3"') + S("M-1 19 H8 M30 19 H41 M-1 24 H5 M32 24 H41", 0.8, PAPER) + P("M18 15 L24 9.4 L30 15Z"); },
    "sp-goblin-valley": function () { var g = function (x, h, w) { return P("M" + (x - w * 0.5) + " 31 L" + (x - w * 0.4) + " " + (31 - h + w * 0.6) + " L" + (x + w * 0.4) + " " + (31 - h + w * 0.6) + " L" + (x + w * 0.5) + " 31Z") + E(x, 31 - h + w * 0.4, w * 0.75, w * 0.55); };
      return sky("M-1 16 L4 12 H16 L18 14 H30 L33 11 H41 V20 H-1Z") + g(5, 9, 4) + g(11, 14, 5) + g(18, 10, 4.4) + g(24.6, 16, 5.4) + g(31, 11, 4) + g(36.6, 8, 3.6) + GROUND(31) + S("M4 33 H36", 0.7, PAPER); },
    "sp-palo-duro-canyon": function () { return sky("M-1 14 H9 L10 17 H30 L31 14 H41 V31 H-1Z") + P("M15 31 Q14 22 17 20 L17 16 Q16.4 13 18.6 12 L18 9.6 Q18.6 7 20.6 7 Q22.6 7 23 9.6 L22.4 12 Q24.4 13 24 16 L24 20 Q27 22 26 31Z") + S("M16 24 H25 M17.6 16 H23", 0.8, PAPER) +
        P("M-1 22 H6 L8 26 L10 31 H-1Z M41 22 H34 L32 26 L30 31 H41Z") + GROUND(31); },
    "sp-hocking-hills": function () { return P("M-1 2 H41 V11 Q30 15 20 13 Q10 15 -1 11Z") + S("M-1 5 H41 M-1 8 Q20 10 41 8", 0.7, PAPER) + conifers([4, 9, 31, 36], 3, 5) + PO("M-1 11 Q10 15 20 13 Q30 15 41 11 V31 H-1Z", 0.55) +
        fall(24, 26, 13.4, 29, 1) + P("M2 31 V24 Q6 21 10 24 V31Z M30 31 V26 Q35 23 41 27 V31Z") + mist(22, 28, 29.6) + water(31); },
    "sp-ichetucknee-springs": function () { var cy = function (x, k) { return P("M" + (x - 0.6 * k) + " 4 L" + (x - 1 * k) + " 24 Q" + (x - 3 * k) + " 27 " + (x - 4 * k) + " 28 H" + (x + 4 * k) + " Q" + (x + 3 * k) + " 27 " + (x + 1 * k) + " 24 L" + (x + 0.6 * k) + " 4Z") + E(x, 5, 4 * k, 2) + E(x - 3, 9, 3, 1.4) + E(x + 3, 12, 3, 1.4); };
      return cy(6, 1) + cy(34, 0.9) + P("M-1 26 Q20 22 41 26 V31 H-1Z").replace("<path", '<path fill-opacity=".4"') + E(20, 25.6, 5, 1.8, 0, PAPER) + E(20, 25.6, 5, 1.8).replace("<ellipse", '<ellipse fill="none" stroke-width="1.4"') + C(20, 22.4, 1.2) + P("M18.6 25 L19.2 23.6 H20.8 L21.4 25Z") + water(31); },
    "sp-bahia-honda": function () { var t = "M-1 14 H22 M-1 19 H22"; for (var x = 0; x <= 20; x += 4) t += " M" + x + " 14 L" + (x + 2) + " 19 L" + (x + 4) + " 14"; return S(t, 0.8) + S("M-1 14 H22 M-1 19 H22", 1.4) + P("M2 19 h2 v12 h-2Z M12 19 h2 v12 h-2Z M27 19 h2 v12 h-2Z M37 19 h2 v12 h-2Z") + S("M26 14 H41 M26 19 H41", 1.4) + palmlet(35, 12) + water(26) + S("M-1 26 H41", 1); },
    "sp-john-pennekamp-coral-reef": function () { var f = function (x, y, s) { return P("M" + x + " " + y + " q" + 3 * s + " -" + 2 * s + " " + 6 * s + " 0 l" + 2 * s + " -" + 1.4 * s + " v" + 2.8 * s + " l-" + 2 * s + " -" + 1.4 * s + " q-" + 3 * s + " " + 2 * s + " -" + 6 * s + " 0Z"); };
      return wv(4, 1) + f(4, 11, 1) + f(24, 8, 0.8) + f(14, 15, 0.7) + C(31, 4, 0.8) + C(33, 1.6, 0.6) +
        T(22, 11, 1, P("M0 6 Q3 0 6 0 Q9 0 10 4 L14 6 L10 7 Q7 9 3 8Z") + S("M10 4 L13 1 M10 7 L13 10", 1)) +
        E(12, 27, 8, 5) + S("M5 27 Q8 23 12 25 Q16 22 19 26 M6 29 Q10 27 14 29 Q17 27 19 29", 0.7, PAPER) + P("M24 31 L25 22 L26.4 25 L28 18 L29 25 L31 21 L32 31Z") + GROUND(31); },
    "sp-blue-spring": function () { return P("M-1 6 Q20 3 41 6 V31 H-1Z").replace("<path", '<path fill-opacity=".28"') + wv(6, 1) +
        P("M5 17 Q8 11 18 11.6 Q26 12 31 15 Q34 13 37 12 Q37 16 36 19 Q34 18 31 18 Q25 22 15 21 Q7 21 5 17Z") + P("M12 20 Q11 24 14 25 L15 21Z M22 20 Q22 23.4 24 24 L25 20Z") + C(8.4, 15, 0.5, PAPER) + S("M5.6 17.4 Q7 18.4 8.4 17.6", 0.7, PAPER) +
        S("M14 6 V2 M24 7 V3", 0.6) + C(14, 1.6, 0.6) + P("M-1 28 Q6 25 12 28 Q18 25 24 28 Q32 25 41 28 V41 H-1Z") + S("M2 26 V20 M30 27 V19 M33 27 V21", 1) ; },
    "sp-hunting-island": function () { return sky("M-1 28 Q20 26 41 28 V31 H-1Z") + lighthouse(20, 29, 22, 3.4, false) + P("M17.4 7.4 H22.6 L23.4 17 H16.6Z") + palmlet(8, 29) + palmlet(33, 29) + S("M3 31 Q4 27 5 25 M37 31 Q36 27 35.4 25 M30 31 Q30 28 29 26", 0.8) + GROUND(31); },
    "sp-kartchner-caverns": function () { var s = P("M-1 -1 H41 V6 Q30 3 20 5 Q10 3 -1 6Z") + P("M-1 31 Q10 28 20 29 Q30 28 41 31 V41 H-1Z"); [4, 7, 10, 30, 33, 36].forEach(function (x, i) { s += P("M" + (x - 1) + " 5 L" + x + " " + (10 + (i % 3) * 3) + " L" + (x + 1) + " 5Z"); });
      s += P("M17 5 Q16 14 18 18 Q16 24 17 29 H24 Q25 24 23 18 Q25 14 24 5Z") + S("M19 8 Q18.4 12 19.6 16 M21.6 20 Q22.6 24 21.6 28", 0.8, PAPER); [6, 9, 32, 35].forEach(function (x) { s += P("M" + (x - 1.4) + " 29 L" + x + " 23 L" + (x + 1.4) + " 29Z"); }); return s + S("M12 8 V11 M13.4 7.6 V12 M27 8 V10.6", 0.5); },
    "sp-slide-rock": function () { return P("M-1 4 L4 2 L8 6 V20 L-1 22Z M41 4 L35 2 L32 7 V19 L41 21Z") + S("M1 8 H7 M1 13 H8 M33 9 H40 M33 14 H40", 0.7, PAPER) + PO("M-1 22 L8 20 V24 L-1 26Z M41 21 L32 19 V24 L41 26Z", 0.5) +
        P("M-1 24 Q12 22 18 25 Q24 28 41 25 V31 H-1Z") + P("M9 24.6 Q18 23 24 27.4 Q28 29 33 27.6 L33 29.4 Q26 31 22 28.6 Q16 25.6 9 26.4Z", PAPER) + person(17, 20.4, 0.8) + S("M14 25.4 l-2 1 M20 26.6 l2 1", 0.6) + GROUND(31); },
    "sp-silver-falls": function () { return P("M-1 4 H41 V12 Q30 10 20 11 Q10 10 -1 12Z") + conifers([3, 7, 33, 37], 5, 6) + PO("M-1 12 Q10 10 20 11 Q30 10 41 12 V31 H-1Z", 0.62) + fall(17, 21, 11, 29, 2) +
        S("M4 22 Q12 17 17 18 M23 18 Q30 17 36 22", 0.9, PAPER) + person(9, 18.4, 0.6).replace(/<path/g, '<path stroke="#fff"').replace(/<circle/g, '<circle fill="#fff"') + mist(15, 23, 29.4) + water(31) + S("M2 30 q1 -3 3 -4 M36 30 q1 -3 3 -4", 0.8); },
    "sp-smith-rock": function () { return sky("M-1 20 L8 18 L16 20 L26 17 L41 19 V24 H-1Z") + P("M4 31 L6 16 L9 12 L12 14 L16 6 L20 8 L22 12 L26 10 L30 18 L34 31Z") + P("M26 10 Q29 4 31.4 4 Q33.4 5 32.6 7.6 L31 8 L32 10 L30.4 12 L28 12Z") + C(31, 6, 0.5, PAPER) +
        S("M10 22 V30 M16 12 V28 M22 16 V30", 0.7, PAPER) + P("M-1 27 Q10 26 20 29 Q30 31 41 28 V31 H-1Z", PAPER) + S("M-1 27 Q10 26 20 29 Q30 31 41 28", 1) + GROUND(31); },
    "sp-ecola": function () { return C(9, 7, 2.6) + P("M-1 10 Q6 9 10 14 Q12 18 14 22 L-1 26Z") + conifers([1, 4, 7], 12, 6) + P("M27 23 Q28 17 31 16 Q34 17 34 23Z") + lighthouse(31, 16.4, 4.6, 1.2, false) + P("M18 25 Q19 21 21 21 Q22.6 22 23 25Z") + water(23) + S("M-1 26 Q10 24 14 22", 1); },
    "sp-deception-pass": function () { return P("M-1 18 Q4 12 10 14 L12 31 H-1Z M41 18 Q36 12 30 14 L28 31 H41Z") + conifers([2, 5, 8, 32, 35, 38], 14, 5) +
        S("M10 15 Q20 4 30 15", 2) + S("M7 9.6 H33", 1.4) + S("M12 9.6 V12.4 M15 9.6 V8 M18 9.6 V6.6 M22 9.6 V6.6 M25 9.6 V8 M28 9.6 V12.4", 0.8) + water(24) + P("M18 26 h4 l-1 1.2 h-2Z", PAPER); },
    "sp-palouse-falls": function () { var c = ""; for (var x = 0; x < 40; x += 2.6) if (x < 14 || x > 26) c += "M" + x + " 10 V" + (24 - Math.abs(20 - x) * 0.2); return sky("M-1 6 Q20 4 41 6 V10 H-1Z") + P("M-1 10 H16 L17 31 H-1Z M41 10 H24 L23 31 H41Z") + S(c, 0.6, PAPER) +
        P("M16 10 Q20 8.6 24 10 L23.6 12 H16.4Z") + fall(18, 22, 11, 27, 2) + E(20, 29, 8, 2.4, 0, PAPER) + E(20, 29, 8, 2.4).replace("<ellipse", '<ellipse fill="none" stroke-width="0.9"') + GROUND(31); },
    "sp-eldorado-canyon": function () { return P("M-1 31 L2 6 L7 2 L12 8 L14 31Z M41 31 L38 10 L33 4 L28 9 L26 31Z") + S("M4 10 L5 28 M9 8 L10 28 M31 10 L30 28 M36 12 L37 28", 0.7, PAPER) + S("M12 18 L13.4 16", 0.6) + person(12.6, 12, 0.6).replace(/<path/g, '<path stroke="#fff"').replace(/<circle/g, '<circle fill="#fff"') + S("M12.6 12 V2", 0.4, PAPER) +
        P("M14 31 Q20 27 26 31Z", PAPER) + S("M15 30 q2 -1 4 0 t4 0", 0.7) + GROUND(31); },
    "sp-petit-jean": function () { return P("M-1 4 H14 L15 31 H-1Z M41 4 H26 L25 31 H41Z") + S("M1 9 H12 M1 15 H13 M1 21 H13 M28 9 H40 M27 15 H40 M27 21 H40", 0.7, PAPER) + T(0, 0, 1, '<path d="M14 4 Q20 3 26 4" fill="none" stroke="currentColor" stroke-width="1.2"/>') + fall(19, 21, 4, 27, 1) + mist(16, 24, 27.6) +
        C(4, 3, 2.4) + C(8, 2, 2.4) + C(34, 2.4, 2.6) + C(38, 3.6, 2.2) + water(29) + P("M-1 29 H10 L12 31 H-1Z"); },
    "sp-tallulah-gorge": function () { return P("M-1 8 L6 7 L13 31 H-1Z M41 8 L34 7 L27 31 H41Z") + conifers([1, 4, 36, 39], 8, 5) + S("M5 7.6 Q20 14 35 7.6", 1) + S("M5 7.6 Q20 12.4 35 7.6", 0.6) + S("M8 9 V10.4 M12 10.4 V11.8 M16 11.4 V12.6 M20 11.8 V12.8 M24 11.4 V12.6 M28 10.4 V11.8 M32 9 V10.4", 0.6) +
        fall(18, 22, 20, 29, 2) + PO("M13 20 H27 L27 31 H13Z", 0.35) + water(30); },
    "sp-providence-canyon": function () { return sky("M-1 7 Q20 5 41 7 V10 H-1Z") + P("M-1 10 H41 V31 H-1Z") + P("M6 10 Q7 20 10 31 H14 Q15 20 15 10Z M19 10 Q19.6 22 18 31 H24 Q22 22 23 10Z M28 10 Q29 20 28 31 H33 Q33 20 34 10Z", PAPER) +
        S("M-1 14 H41 M-1 18 H41 M-1 22 H41 M-1 26 H41", 0.5) + S("M8 12 L9 28 M12.4 12 L12.8 29 M21 12 V29 M30.6 12 L30.4 29", 0.6) + conifers([3, 17, 26, 37], 10, 4); },
    "sp-fall-creek-falls": function () { return P("M-1 5 Q10 4 18 6 V31 H-1Z M41 5 Q30 4 22 6 V31 H41Z") + conifers([2, 6, 10, 30, 34, 38], 5.4, 4.4) + S("M2 10 H16 M2 16 H16 M2 22 H16 M24 10 H38 M24 16 H38 M24 22 H38", 0.6, PAPER) +
        P("M18 6 Q20 5.4 22 6 L22 31 H18Z", PAPER) + S("M20 7 V27", 0.7) + mist(16, 24, 28.6) + water(31) + P("M26 8 h6 v1.2 h-6Z", PAPER); },
    "sp-cumberland-falls": function () { return C(33, 5, 2.2) + S("M2 22 Q20 2 38 22", 1.2) + S("M4.6 22 Q20 5.6 35.4 22", 0.6) + P("M-1 16 H6 L7 31 H-1Z M41 16 H34 L33 31 H41Z") + conifers([1, 4, 36, 39], 16, 4) +
        P("M6 18 H34 V19.6 H6Z") + fall(7, 33, 19.6, 27.6, 6) + mist(7, 33, 28) + water(30); },
    "sp-blackwater-falls": function () { return P("M-1 6 H41 V15 H-1Z") + conifers([3, 7, 11, 29, 33, 37], 6.6, 5) + S("M-1 9 H41 M-1 12 H41", 0.6, PAPER) + P("M-1 15 H13 L11 31 H-1Z M41 15 H27 L30 31 H41Z") +
        P("M13 15 H27 L28 22 L30 31 H11 L12 22Z", PAPER) + S("M15 16 Q14.4 24 13.4 30 M18.6 16 V30 M22 16 V30 M25 16 Q26 24 27.4 30", 0.7) + S("M12 22.4 H28", 1.2) + stair(31, 30, 4, 1.6, -1.6, 0.9) + water(31); },
    "sp-ricketts-glen": function () { return P("M-1 -1 H41 V31 H-1Z").replace("<path", '<path fill-opacity=".55"') + conifers([3, 8, 32, 37], 12, 9) + fall(22, 26, 3, 9, 1) + S("M20 9 H28", 1.2) + fall(18, 23, 11, 18, 2) + S("M16 18 H25", 1.2) + fall(14, 20, 20, 28, 2) + S("M12 28 H22", 1.2) + mist(12, 22, 29) + water(31); },
    "sp-ohiopyle": function () { return sky("M-1 14 L8 12 L16 14 L26 11 L41 14 V18 H-1Z") + conifers([2, 5, 8, 33, 36, 39], 18, 6) + P("M-1 18 H41 V20 H-1Z") + fall(10, 30, 20, 24, 5) + P("M-1 24 H41 V41 H-1Z") +
        P("M10 26.4 Q20 24.6 30 26.4 L29 29 Q20 30 11 29Z", PAPER) + S("M10 26.4 Q20 24.6 30 26.4 L29 29 Q20 30 11 29Z", 0.9) + person(15, 24.4, 0.6) + person(20, 24, 0.6) + person(25, 24.4, 0.6) + S("M12 28 L9 31 M27 28 L31 31", 0.8); },
    "sp-baxter": function () { return C(9, 6, 2.4) + P("M-1 24 L6 18 L12 14 L17 8 L21 6 L25 9 L31 13 L36 18 L41 21 V24Z") + S("M17 8 L15 14 M21 6 L22 12 M25 9 L27 14", 0.8, PAPER) +
        PO("M-1 24 H41 V31 H-1Z", 0.4) + conifers([2, 5, 34, 37], 31, 9) + E(20, 28, 9, 1.4, 0, PAPER) + S("M13 28 q2 -0.8 4 0 t4 0 t4 0", 0.6) + GROUND(31); },
    "sp-franconia-notch": function () { return P("M-1 31 V4 H16 L15 7 L17.6 8.4 L16 10.6 L19.4 12.4 L17 14 L18.4 16.6 L16 18 L17 21 L14 24 L16 31Z") + S("M2 8 H12 M2 14 H12 M2 20 H11", 0.7, PAPER) +
        P("M41 31 L36 14 L30 20 L26 31Z").replace("<path", '<path fill-opacity=".45"') + conifers([22, 25, 28, 31, 34], 31, 6) + E(28, 30.4, 10, 1.4, 0, PAPER) + GROUND(31); },
    "sp-cape-henlopen": function () { return sky("M-1 26 Q12 22 24 25 Q32 23 41 26 V31 H-1Z") + P("M6 31 L7 11 H13 L14 31Z") + R(6, 9, 8, 2) + P("M8.4 14 h3 v2 h-3Z M8.4 20 h3 v2 h-3Z", PAPER) + lighthouse(31, 22, 9, 2, false) + R(26, 22, 10, 2) + water(27.4) + S("M18 27 Q19 24 20 23 M22 27 Q22 25 23 23.6", 0.7); },
    "sp-assateague": function () { var hs = function (x, y, s, f) { return T(x, y, s, (f ? '<g transform="matrix(-1 0 0 1 22 0)">' : "<g>") + P("M2 8 Q2 5 5 5 H14 L17 1 L20 1.6 L21 4 L19 4.4 L16.6 7 L16 9 L15.6 15 H14.4 L13.6 10 H6 L5 15 H3.8 L3.6 10 Q2 9.6 2 8Z") + S("M2.4 6 Q0 8 1 11", 0.9) + S("M16.6 1.6 L14 5", 0.8) + "</g>"); };
      return sky("M-1 20 Q10 16 20 19 Q30 15 41 19 V24 H-1Z") + S("M3 19 Q3.4 16 4 15 M8 18 Q8 15.4 9 14.6 M34 18 Q34.6 15 35.4 14", 0.7) + hs(4, 14, 0.9) + hs(20, 16, 0.7, 1) + P("M-1 28 H41 V41 H-1Z") + P("M-1 27 Q20 24 41 27 V28.4 H-1Z", PAPER) + S("M-1 27 Q20 24 41 27", 0.9); },
    "sp-jockey-s-ridge": function () { return C(30, 7, 2.6) + P("M-1 31 Q8 18 20 16 Q28 16 34 22 Q38 26 41 27 V31Z") + S("M6 26 Q14 20 22 19 M10 29 Q18 24 28 24", 0.8, PAPER) + P("M8 7 L20 4 L14 9Z") + S("M14 6.6 L14.6 11", 0.6) + person(14.6, 10.6, 0.5) + GROUND(31); },
    "sp-hanging-rock": function () { return sky("M-1 19 Q8 14 16 17 Q24 12 32 16 Q37 14 41 16 V22 H-1Z") + PO("M-1 22 Q10 18 20 21 Q30 18 41 22 V31 H-1Z", 0.45) + P("M-1 12 L10 10 L22 13 L26 15 L19 17 L10 18 L-1 22Z") + S("M2 14 L18 15", 0.7, PAPER) + person(18, 7, 0.8) + P("M-1 22 L10 18 L16 31 H-1Z") + GROUND(31); },
    "sp-chimney-rock": function () { return sky("M-1 14 Q10 10 20 13 Q30 9 41 13 V18 H-1Z") + P("M-1 31 V18 Q6 14 12 18 L14 31Z M41 31 V16 Q34 12 28 16 L26 31Z") + P("M16 31 L17 10 Q17.4 7 20 7 Q22.6 7 23 10 L24 31Z") + S("M20 7 V1", 0.7) + P("M20 1 h4 v2.4 h-4Z") +
        S("M18 14 H22 M18 20 H23 M17.6 26 H23", 0.6, PAPER) + conifers([3, 8, 32, 37], 20, 4) + water(28); },
    "sp-gulf": function () { var pl = "M4 18 H36"; for (var x = 6; x <= 34; x += 4) pl += " M" + x + " 18 V24"; return sky("M-1 26 Q20 24 41 26 V31 H-1Z") + C(30, 7, 2.6) + S(pl, 0.9) + S("M4 18 H36", 1.6) +
        T(8, 8, 0.7, P("M2 10 Q0 6 3 4 Q5 2.4 7 4 L13 5 L7 6 Q8 9 6 11 L10 14 L4 14Z") + C(5.4, 4.6, 0.5, PAPER)) + water(24) + S("M24 26 Q25 22 26 21 M28 26 Q28 23 29 22", 0.7); },
    "sp-itasca": function () { return conifers([2, 6, 10, 14, 26, 30, 34, 38], 14, 10) + PO("M-1 14 H41 V31 H-1Z", 0.4) + P("M-1 18 Q20 16 41 18 V29 Q20 27 -1 29Z", PAPER) + S("M-1 18 Q20 16 41 18 M-1 29 Q20 27 -1 29", 0.9) +
        E(6, 23, 2.2, 1.2) + E(11, 22.4, 2, 1.1) + E(16, 23.6, 2.3, 1.2) + E(21, 22.6, 2, 1.1) + E(26, 23.4, 2.3, 1.2) + E(31, 22.8, 2, 1.1) + E(36, 23.4, 2.2, 1.2) + S("M2 26 q2 -1 4 0 M30 26 q2 -1 4 0", 0.6) + GROUND(31); },
    "sp-gooseberry-falls": function () { return S("M-1 6 Q20 -1 41 6", 2) + S("M-1 4 H41", 1.2) + P("M-1 6 Q20 -1 41 6 V8 H-1Z").replace("<path", '<path fill-opacity="0"') + R(-1, 6, 6, 25) + R(35, 6, 6, 25) + conifers([7, 10, 30, 33], 14, 6) +
        P("M5 14 H35 V31 H5Z").replace("<path", '<path fill-opacity=".5"') + fall(14, 26, 14, 21, 3) + S("M12 21 H28", 1.2) + fall(10, 30, 22, 29, 5) + mist(10, 30, 29.4) + water(31); },
    "sp-devil-s-lake": function () { return P("M-1 31 V12 L4 8 L10 10 L14 14 L15 31Z") + S("M2 14 H12 M2 19 H13 M2 24 H14", 0.6, PAPER) + P("M28 31 L29 16 L33 12 L38 13 L41 16 V31Z") + P("M31 12 L30.4 9 Q32 6.6 34.6 7.4 L35.6 9.6 L34 12Z") +
        conifers([5, 9, 36], 9, 4) + P("M15 22 H28 V31 H15Z").replace("<path", '<path fill-opacity=".4"') + S("M16 25 q2 -1 4 0 t4 0", 0.7) + GROUND(31); },
    "sp-mackinac-island": function () { return P("M-1 31 V14 Q8 10 14 12 Q20 8 28 11 Q34 10 41 13 V31Z") + conifers([3, 7, 30, 35, 39], 12, 5) + '<path fill="#fff" d="M11 31 Q11 18 20 17 Q29 18 29 31Z"/>' + S("M11 31 Q11 18 20 17 Q29 18 29 31", 1) +
        P("M11 31 V24 Q14 22 16 25 V31Z M24 31 V25 Q27 22 29 25 V31Z").replace("<path", '<path fill-opacity=".5"') + water(27) + S("M13 27 H27", 0.7); },
    "sp-tahquamenon-falls": function () { return conifers([2, 5, 8, 11, 14, 26, 29, 32, 35, 38], 12, 7) + P("M-1 12 H41 V15 H-1Z") + PO("M-1 12 H41 V31 H-1Z", 0.3) + fall(2, 38, 15, 23, 8) + PO("M-1 23 H41 V31 H-1Z", 0.6) + mist(2, 38, 23.4) + water(28); },
    "sp-indiana-dunes": function () { return sky("M-1 22 Q20 19 41 22 V24 H-1Z") + P("M-1 31 Q6 14 20 10 Q30 12 36 22 L41 26 V31Z") + S("M24 31 L21 27 L23 24 L20 20 L22 17 L19.6 13", 1.6, PAPER) + S("M24 31 L21 27 L23 24 L20 20 L22 17 L19.6 13", 0.6) + person(19.6, 9.2, 0.5) +
        S("M5 26 q1 -3 2 -4 M8 25 q0 -3 1 -4 M31 22 q1 -3 2 -4 M34 24 q0 -3 1 -4", 0.7, PAPER) + GROUND(31); },
    "sp-turkey-run": function () { return P("M-1 -1 H13 Q15 14 13 31 H-1Z M41 -1 H27 Q25 14 27 31 H41Z") + S("M1 4 H11 M1 10 H12 M1 16 H12 M1 22 H12 M29 4 H39 M28 10 H39 M28 16 H39 M28 22 H39", 0.6, PAPER) + conifers([3, 8, 32, 37], 2, 4) +
        S("M17 8 L15 30 M23 8 L25 30", 0.9) + S("M16.6 11 H23.4 M16.2 15 H23.8 M15.8 19 H24.2 M15.4 23 H24.6 M15.1 27 H24.9", 0.8) + water(30); },
    "sp-ha-ha-tonka": function () { return sky("M-1 22 Q20 19 41 22 V26 H-1Z") + P("M-1 24 Q6 18 14 19 L30 19 Q36 18 41 22 V31 H-1Z") + P("M10 19 V10 H15 V7 H18 V10 H24 V8 H27 V19Z") + P("M12 13 h1.6 v2.4 h-1.6Z M16.4 12 h1.6 v3 h-1.6Z M20 12 h1.6 v3 h-1.6Z M24 13 h1.6 v2.4 h-1.6Z M18 16 h2 v3 h-2Z", PAPER) + P("M10 10 l1 -1 l1 1Z M22 10 l1 -1.4 l1 1.4Z") + conifers([4, 33, 37], 21, 5) + water(27); },
    "sp-waimea-canyon": function () { return sky("M-1 9 Q8 6 14 8 Q22 5 30 8 Q36 6 41 8 V12 H-1Z") + P("M-1 12 H41 V31 H-1Z") + P("M10 12 L14 18 L16 24 L18 31 H22 L24 24 L27 18 L31 12Z", PAPER) + S("M-1 16 H11 M-1 20 H14 M-1 24 H16 M29 16 H41 M27 20 H41 M25 24 H41", 0.6, PAPER) +
        S("M14 18 H27 M16 24 H24", 0.6) + fall(29, 30, 13, 19, 0) + P("M5 4 q2 -1.4 4 0 l3 -1 l-3 2 q-2 1 -4 -1Z") + S("M12 3 L16 1.6", 0.6); },
    "sp-chugach": function () { return P("M-1 22 L5 14 L9 17 L15 7 L19 11 L24 5 L30 12 L35 9 L41 15 V22Z") + P("M13.4 9.4 L15 7 L16.6 9.6 L15 9Z M22.4 7.6 L24 5 L25.8 8 L24 7.4Z M33.4 10.6 L35 9 L36.6 11Z", PAPER) + water(22) + S("M-1 22 H41", 0.9) +
        T(4, 22, 0.55, P("M2 8 Q2 5 5 5 H12 Q14 2 16 2 Q18 2 18 4 L17 6 L15 6 L14 9 L13.6 15 H12.4 L12 10 H6 L5.4 15 H4.2 L4 10 Q2 9.6 2 8Z") + S("M15.6 2.6 Q14 0 11 1 Q13.6 1.6 14.6 3", 0.9)) + P("M-1 28 Q10 26 18 28.6 L18 31 H-1Z"); },
    "sp-natural-bridge": function () { return P("M-1 -1 H41 V31 H-1Z") + P("M12 31 Q11 14 13 10 Q20 6 27 10 Q29 14 28 31Z", PAPER) + S("M-1 3 H41", 0.8, PAPER) + conifers([3, 7, 33, 37], 3, 4) +
        S("M1 9 H10 M1 15 H10 M1 21 H10 M30 9 H39 M30 15 H39 M30 21 H39", 0.6, PAPER) + conifers([16, 20, 24], 31, 8) + water(30); },
    "sp-gillette-castle": function () { return sky("M-1 20 Q20 16 41 20 V24 H-1Z") + P("M-1 31 V22 Q8 14 20 16 Q32 14 41 22 V31Z") + P("M10 17 V9 H12 V7 H14 V9 H17 V6 H19 V4 H21 V6 H24 V9 H27 V7 H29 V9 H31 V17Z") +
        P("M12.6 11 h1.4 v2 h-1.4Z M19.2 8.6 h1.6 v2.4 h-1.6Z M26 11 h1.4 v2 h-1.4Z M16 12 h1.4 v2 h-1.4Z M22.6 12 h1.4 v2 h-1.4Z", PAPER) + conifers([5, 35], 22, 5) + water(27) + P("M24 28 h7 l-1 1.4 h-5Z", PAPER); },
    "sp-liberty": function () { return sky("M-1 18 H3 V12 H6 V16 H8 V9 H10 V18 H41 V22 H-1Z") + T(29, 1, 0.42, G.x_lib()) + P("M2 26 V16 H22 V26Z") + P("M10 16 V9 H14 V16Z M11 9 L12 6 L13 9Z") + C(12, 11.6, 1, PAPER) + P("M4 19 h2 v4 h-2Z M8 19 h2 v4 h-2Z M14 19 h2 v4 h-2Z M18 19 h2 v4 h-2Z", PAPER) + water(26); },
    "sp-robbers-cave": function () { return conifers([3, 7, 31, 35, 39], 12, 7) + P("M4 31 Q3 18 10 14 Q18 10 26 13 Q34 16 36 31Z") + P("M14 31 Q14 23 19 21 Q25 22 25 31Z", PAPER) + S("M14 31 Q14 23 19 21 Q25 22 25 31", 0.9) + S("M7 20 Q10 17 14 17 M27 18 Q31 19 33 23", 0.7, PAPER) +
        T(17, 25, 0.5, P("M2 8 Q2 5 5 5 H12 L14 1.4 L16 2 L15.6 5 L14 8 L13.6 12 H12.4 L12 9 H6 L5.4 12 H4.2 L4 9 Q2 8.6 2 8Z")) + GROUND(31); },
    "sp-bruneau-dunes": function () { return C(8, 4, 0.5) + C(14, 2.6, 0.4) + C(24, 5, 0.5) + C(33, 3, 0.4) + P("M28 12 Q28 8.6 31.4 8.6 Q34.8 8.6 34.8 12Z M28 12 h6.8 v3 h-6.8Z") + S("M31.4 8.6 L29 7", 0.8) +
        P("M-1 28 Q8 22 14 14 Q18 10 22 14 Q30 24 41 26 V31 H-1Z") + S("M14 14 Q16 22 22 28", 0.9, PAPER) + P("M2 29 Q12 27 22 29 Q30 30 38 28 V31 H2Z", PAPER) + GROUND(31); },

    "nm-statue-of-liberty": function () { return sky("M-1 27 H41 V31 H-1Z") + T(10, 0, 0.74, G.x_lib()) + water(29); },
    "nm-devils-tower": function () { var c = ""; for (var x = 13; x <= 27; x += 1.8) c += "M" + x.toFixed(1) + " " + (6 + Math.abs(20 - x) * 0.12).toFixed(1) + " L" + (x + (x - 20) * 0.14).toFixed(1) + " 22"; return sky("M-1 26 Q20 22 41 26 V31 H-1Z") + P("M12 23 L13 7 Q20 4.6 27 7 L28 23Z") + S(c, 0.6, PAPER) +
        P("M5 31 Q9 23 12 22 H28 Q31 23 35 31Z").replace("<path", '<path fill-opacity=".6"') + conifers([4, 7, 10, 30, 33, 36], 28, 5) + GROUND(30.4); },
    "nm-muir-woods": function () { return P("M2 31 L3.4 -1 H8.6 L9.4 31Z M31 31 L32 -1 H37 L38.4 31Z M16 31 L17 -1 H20 L20.6 31Z") + PO("M24 31 L24.6 -1 H27 L27.6 31Z M11.4 31 L12 -1 H13.6 L14 31Z", 0.5) +
        S("M22 0 L13 31 M23 0 L26 31", 1.4, PAPER).replace("<path", '<path stroke-opacity=".5"') + P("M-1 26 H41 V27.4 H-1Z") + S("M-1 26 H41", 0.7, PAPER) + S("M4 26 V31 M14 26 V31 M26 26 V31 M36 26 V31", 0.8) + person(22, 21, 0.6) + P("M-1 29 Q4 25 8 29 M30 29 Q35 25 40 29").replace("<path", '<path fill="none" stroke="currentColor"') + GROUND(30); },
    "nm-canyon-de-chelly": function () { return P("M-1 6 H8 L10 31 H-1Z M41 6 H32 L30 31 H41Z") + S("M1 10 H8 M1 16 H9 M1 22 H9 M33 10 H40 M32 16 H40 M32 22 H40", 0.6, PAPER) +
        P("M15 31 L16 12 L17 4 L18 3 L19 12 L19.4 31Z M20 31 L20.6 18 L21.4 10 L22.4 9.6 L23 18 L24 31Z") + P("M26 31 Q26 27 29 27 Q32 27 32 31Z") + PO("M-1 28 Q20 26 41 28 V31 H-1Z", 0.5) + GROUND(31); },
    "nm-natural-bridges": function () { return C(6, 4, 0.5) + C(12, 7, 0.4) + C(20, 3, 0.5) + C(28, 6, 0.4) + C(35, 3.6, 0.5) + C(16, 10, 0.3) + C(32, 10.6, 0.3) +
        P("M2 31 L3 20 Q8 14 20 14 Q32 14 37 20 L38 31 H33 Q33 22 28 19.6 Q20 17 12 19.6 Q7 22 7 31Z") + S("M6 21 Q20 13.6 34 21", 0.6, PAPER) + P("M-1 29 Q20 26 41 29 V41 H-1Z"); },
    "nm-dinosaur": function () { var b = "M5 18 Q8 14 13 15 Q18 16 22 15 Q26 14 28 10 Q30 6 34 6", r = ""; for (var x = 14; x < 23; x += 2) r += "M" + x + " 15.4 Q" + (x + 0.4) + " 19 " + (x - 0.4) + " 21 ";
      return P("M-1 4 L41 1 V31 H-1Z").replace("<path", '<path fill-opacity=".42"') + S("M-1 9 L41 6 M-1 25 L41 22", 0.6, PAPER) + S(b, 1.4) + S("M5 18 Q2 20 -1 19", 1) + S(r, 0.9) + C(34.6, 6, 1.4) + S("M12 16 L11 22 L12.6 25 M14 16 L15 22 L14 25 M24 14.6 L23 21 L24.4 25 M26 14 L27 21 L26 25", 1.1) +
        S("M17 15.4 Q20 13 23 15", 0.8) + E(18, 16, 4.6, 2.6).replace("<ellipse", '<ellipse fill="none" stroke-width=".9"') + GROUND(31); },
    "nm-craters-of-the-moon": function () { return C(31, 7, 4) + C(29.6, 6, 3.4, PAPER) + P("M-1 24 Q5 14 11 14 Q15 14 20 22 Q24 16 28 16 Q33 16 41 24 V31 H-1Z") + S("M8 16 Q11 13.6 14 16 M25 17 Q28 15.4 31 17", 0.8, PAPER) +
        P("M-1 27 Q10 25 20 27 Q30 25 41 27 V31 H-1Z").replace("<path", '<path fill-opacity=".6"') + S("M3 29 l2 -1 l2 1 M14 30 l2 -1 l2 1 M27 29 l2 -1 l2 1", 0.7, PAPER) + C(18, 26, 1.4, PAPER) + C(20, 25, 1.2, PAPER) + C(19, 24, 1, PAPER) + GROUND(31); },
    "nm-sunset-crater-volcano": function () { return sky("M-1 20 L5 14 L9 18 Z") + P("M1 27 Q10 22 15 12 Q20 9.6 25 12 Q30 22 39 27Z") + P("M15 12 Q20 9.6 25 12 Q23 15 20 14.6 Q17 15 15 12Z").replace("<path", '<path fill-opacity=".45"') + S("M15.6 12.4 Q20 10.6 24.4 12.4", 1.2, PAPER) +
        S("M10 22 L13 16 M27 16 L30 22", 0.6, PAPER) + conifers([3, 6, 33, 36, 39], 30, 8) + GROUND(30); },
    "nm-montezuma-castle": function () { return PO("M-1 -1 H41 V31 H-1Z", 0.3) + S("M-1 3 H41 M-1 26 H41 M-1 22 H8 M32 22 H41", 0.6) + P("M8 18 Q8 6 20 5 Q32 6 32 18Z") +
        R(11, 10, 8, 8, PAPER) + R(19, 8, 9, 10, PAPER) + R(14, 6, 9, 4, PAPER) + S("M11 18 V10 H14 V6 H23 V8 H28 V18 M11 14 H28 M14 10 H23", 0.7) + S("M13 10.6 h1 M17 10.6 h1 M21 8.6 h1 M25 8.6 h1 M16 6.6 h1 M20 6.6 h1", 0.6) +
        P("M15 15 h1.2 v3 h-1.2Z M23 15 h1.2 v3 h-1.2Z M18 11 h-1 v-0.8 h2.8 v0.8 h-1 v2 h-0.8Z M25.4 11.6 h1.4 v2 h-1.4Z") + P("M-1 18 H8 V20 H32 V18 H41 V20 H-1Z") +
        T(2, 22, 1, E(3, 3, 3.4, 2.6) + E(7, 2, 2.6, 2) + S("M4 4 L4.6 9", 1)) + T(29, 22, 1, E(4, 3, 3.4, 2.6) + E(8, 4, 2.4, 2) + S("M5 4 L5 9", 1)) + water(30); },
    "nm-walnut-canyon": function () { return P("M-1 -1 H41 V31 H-1Z").replace("<path", '<path fill-opacity=".5"') + P("M-1 8 Q20 4 41 8 V10 Q20 6 -1 10Z M-1 17 Q20 13 41 17 V19 Q20 15 -1 19Z") +
        P("M4 16 h4 v-4 h-4Z M10 15 h5 v-4.4 h-5Z M24 14.6 h5 v-4.4 h-5Z M31 15.2 h4 v-4 h-4Z M14 25 h5 v-4 h-5Z M22 24.4 h4 v-3.6 h-4Z", PAPER) + P("M5.4 14 h1 v2 h-1Z M12 13 h1 v2 h-1Z M26 12.6 h1 v2 h-1Z M32.6 13.2 h1 v2 h-1Z M16 23 h1 v2 h-1Z M23.4 22.6 h1 v1.8 h-1Z") +
        conifers([5, 11, 30, 36], 4, 4) + P("M-1 27 Q20 23 41 27 V31 H-1Z"); },
    "nm-organ-pipe-cactus": function () { var s = C(20, 9, 4) + sky("M-1 26 L6 21 L12 24 L19 19 L27 24 L34 20 L41 24 V31 H-1Z"); [[-8, 16], [-5, 9], [-2, 5], [1, 4], [4, 7], [7, 12], [10, 18]].forEach(function (a) { s += S("M" + (20 + a[0] * 0.3) + " 31 Q" + (20 + a[0]) + " 26 " + (20 + a[0]) + " " + (a[1] + 2), 2.2); }); return s + GROUND(31); },
    "nm-bandelier": function () { var s = P("M-1 -1 H41 V20 H-1Z").replace("<path", '<path fill-opacity=".5"'); [[4, 6], [9, 10], [15, 5], [22, 9], [28, 6], [34, 11]].forEach(function (h) { s += E(h[0], h[1], 1.8, 1.4); });
      return s + S("M9 11 V18 M11 11 V18 M9 13 H11 M9 15.4 H11", 0.6) + P("M-1 20 H41 V31 H-1Z").replace("<path", '<path fill-opacity=".25"') + E(20, 26, 12, 4).replace("<ellipse", '<ellipse fill="none" stroke-width="1.6"') + E(20, 26, 8, 2.4).replace("<ellipse", '<ellipse fill="none" stroke-width=".8"') + S("M10 24 L12 26 M30 24 L28 26 M20 22 V24", 0.6) + GROUND(31); },
    "nm-el-morro": function () { return sky("M-1 26 H41 V31 H-1Z") + P("M2 26 L4 10 L10 8 H30 L34 9 L37 26Z") + S("M8 14 h3 M13 14 h5 M20 14 h2 M8 17 h6 M16 17 h4 M8 20 h3 M13 20 h6 M22 17 h5", 0.6, PAPER) + E(20, 28.4, 6, 1.2, 0, PAPER) + conifers([2, 36, 39], 30, 5) + GROUND(30); },
    "nm-capulin-volcano": function () { return sky("M-1 26 L6 22 L12 25Z") + P("M2 30 Q12 24 15 12 Q20 10 25 12 Q28 24 38 30Z") + S("M6 28 Q20 24 32 27 Q28 22 16 22 Q12 19 22 17 Q26 15 18 13.6", 0.8, PAPER) + S("M15.4 12.4 Q20 11 24.6 12.4", 1.1, PAPER) + GROUND(30); },
    "nm-colorado": function () { return sky("M-1 10 H8 L10 14 H30 L32 10 H41 V16 H-1Z") + P("M15 31 L16 12 L17.4 6 H22.6 L24 12 L25 31Z") + S("M16 14 H24 M15.6 20 H24.4", 0.7, PAPER) + P("M-1 16 H7 L10 31 H-1Z M41 16 H33 L30 31 H41Z") + S("M20 6 V2", 0.6) + P("M20 2 h3 v1.8 h-3Z") + GROUND(31); },
    "nm-florissant-fossil-beds": function () { return sky("M-1 18 L8 13 L14 15 L22 7 L30 14 L41 12 V22 H-1Z") + P("M19.6 8.6 L22 7 L24 9 L22 8.4Z", PAPER) + P("M8 31 Q9 26 10 22 Q10 18 13 17 H27 Q30 18 30 22 Q31 26 32 31Z") + E(20, 17.4, 7, 1.6).replace("<ellipse", '<ellipse fill="#fff"') + E(20, 17.4, 7, 1.6).replace("<ellipse", '<ellipse fill="none" stroke-width="1"') +
        E(20, 17.4, 3.6, 0.8).replace("<ellipse", '<ellipse fill="none" stroke-width=".6"') + S("M13 20 L12 28 M17 20 V29 M23 20 V29 M27 20 L28 28", 0.6, PAPER) + GROUND(31); },
    "nm-cedar-breaks": function () { var s = P("M-1 8 Q10 6 20 7 Q30 6 41 8 V31 H-1Z"); [6, 11, 16, 21, 26, 31].forEach(function (x, i) { s += P("M" + (x - 1.8) + " 31 L" + (x - 1) + " " + (14 + (i % 3) * 3) + " Q" + x + " " + (12 + (i % 3) * 3) + " " + (x + 1) + " " + (14 + (i % 3) * 3) + " L" + (x + 1.8) + " 31Z", PAPER); });
      return s + S("M-1 12 H41 M-1 18 H41 M-1 24 H41", 0.5, PAPER) + conifers([3, 9, 28, 36], 8, 5) + S("M15 7.4 L14 3 M14.4 4.6 L12.6 3.6 M14.6 5 L16.6 3.4", 0.9); },
    "nm-timpanogos-cave": function () { var s = P("M-1 -1 H41 V31 H-1Z").replace("<path", '<path fill-opacity=".62"'), sp = "";
      for (var i = 0; i < 9; i++) { var x = 4 + i * 4, a = i % 2 ? 1 : -1; sp += "M" + x + " 0 Q" + (x + a * 2) + " 3 " + (x - a) + " 5 Q" + (x + a * 2) + " 7 " + x + " " + (8 + (i % 3)); }
      return s + S(sp, 0.8, PAPER) + P("M20 12 Q16 9 14 12 Q12 16 20 24 Q28 16 26 12 Q24 9 20 12Z", PAPER) + S("M20 14 V21 M17 15 Q18 18 20 21 M23 15 Q22 18 20 21", 0.6) + P("M-1 31 Q6 27 12 31 Q20 26 28 31 Q34 27 41 31Z", PAPER); },
    "nm-rainbow-bridge": function () { return P("M-1 31 V4 L4 2 L10 6 L12 31Z M41 31 V6 L36 3 L32 6 L30 31Z").replace("<path", '<path fill-opacity=".45"') + P("M5 31 L6 18 Q8 4 20 4 Q32 4 34 18 L35 31 H31 Q31 10 20 9 Q10 10 10 31Z") + S("M7 18 Q9 6 20 6", 0.6, PAPER) + water(27) + P("M21 28 h6 l-1 1.2 h-4Z", PAPER); },
    "nm-jewel-cave": function () { var s = P("M-1 -1 H41 V31 H-1Z").replace("<path", '<path fill-opacity=".62"'), c = ""; [[4, 10, 6], [10, 6, 8], [17, 12, 5], [24, 4, 9], [31, 10, 6], [36, 6, 8], [8, 24, 5], [28, 26, 4]].forEach(function (k) { var x = k[0], y = k[1], h = k[2]; c += "M" + (x - 2) + " " + y + " L" + x + " " + (y + h) + " L" + (x + 2) + " " + y + "Z M" + (x + 1) + " " + y + " L" + (x + 3) + " " + (y + h * 0.6) + " L" + (x + 4) + " " + y + "Z "; });
      return s + P(c, PAPER) + S("M18 31 V21 M18 21 l-3 -2 M18 23 l3 -2", 0.9) + C(18, 19, 1.2, PAPER) + P("M-1 31 Q20 27 41 31Z", PAPER); },
    "nm-lava-beds": function () { return sky("M24 16 L30 6 L36 16Z") + P("M28.4 8.6 L30 6 L31.8 9Z", PAPER) + P("M-1 31 V18 Q10 14 20 17 Q30 15 41 18 V31Z") + P("M8 31 Q8 22 18 21 Q28 22 28 31Z", PAPER) + S("M8 31 Q8 22 18 21 Q28 22 28 31", 1) + PO("M11 31 Q12 25 18 24.4 Q24 25 25 31Z", 0.8) +
        S("M16 31 V23 M20 31 V23 M16 25 H20 M16 27.6 H20 M16 30 H20", 0.8, PAPER); },
    "nm-cabrillo": function () { return sky("M-1 24 Q20 22 41 24 V28 H-1Z") + P("M2 24 V18 L9 13 L16 18 V24Z") + lighthouse(9, 13, 5, 1.6, false) + P("M4 20 h2 v2 h-2Z M12 20 h2 v2 h-2Z", PAPER) +
        P("M24 22 H38 L36 25 H26Z") + S("M30 22 V9 M27 22 V12", 0.8) + P("M30.4 10 Q34 12 30.4 19Z M27.4 13 Q30 15 27.4 20Z M30 9 l3 1 l-3 1Z") + water(26); },
    "nm-devils-postpile": function () { var s = ""; for (var i = 0; i < 9; i++) { var x = 4 + i * 3.6, top = 8 + (i % 3) * 1.4 - (i > 3 && i < 7 ? 2 : 0); s += P("M" + x + " " + top + " h3 v18 h-3Z") + P("M" + x + " " + top + " l0.8 -1.2 h1.4 l0.8 1.2Z", PAPER); }
      return conifers([2, 38], 10, 6) + s + S("M5.6 10 V25 M9.2 10 V25 M12.8 9 V25 M16.4 8 V25 M20 7 V25 M23.6 8 V25 M27.2 9 V25 M30.8 10 V25 M34.4 10 V25", 0.4, PAPER) + P("M-1 31 Q4 26 8 27 L12 25 L16 27 L22 25 L28 27 L34 25 L41 28 V31Z") + GROUND(31); },
    "nm-oregon-caves": function () { return conifers([2, 6, 10, 30, 34, 38], 14, 10) + P("M11 22 V13 L20 6 L29 13 V22Z") + P("M13 12 L20 7.4 L27 12Z", PAPER) + P("M13 15 h2 v2 h-2Z M17 15 h2 v2 h-2Z M21 15 h2 v2 h-2Z M25 15 h2 v2 h-2Z M18 19 h4 v3 h-4Z", PAPER) +
        P("M-1 31 V22 H41 V31Z") + P("M15 31 Q15 26 20 25 Q25 26 25 31Z", PAPER) + S("M15 31 Q15 26 20 25 Q25 26 25 31", 0.8); },
    "nm-little-bighorn-battlefield": function () { var m = ""; [[6, 24], [10, 23], [13, 26], [26, 25], [29, 22], [33, 26], [17, 27]].forEach(function (p) { m += "M" + p[0] + " " + p[1] + " h1.2 v2 h-1.2Z "; });
      return sky("M-1 14 Q10 10 20 13 Q30 9 41 14 V18 H-1Z") + P("M-1 31 V22 Q10 16 22 17 Q32 17 41 22 V31Z") + P(m, PAPER) + P("M20 17 L21 6 L22 17Z") + R(18.6, 17, 4.8, 1.4) + S("M2 28 q2 -2 4 0 M32 29 q2 -2 4 0", 0.6, PAPER); },
    "nm-effigy-mounds": function () { return sky("M-1 8 H41 V11 H-1Z") + P("M-1 11 H41 V31 H-1Z").replace("<path", '<path fill-opacity=".42"') + P("M8 20 Q8 14 14 14 Q18 12 24 13 Q30 13 32 17 Q34 18 34 20 L32 21 Q31 24 28 24 L27 27 H25 L24 24 H16 L15 27 H13 L12 23 Q8 22 8 20Z") + S("M10 17 Q16 15.6 22 16", 0.6, PAPER) +
        conifers([3, 37], 12, 5) + S("M2 29 q3 -2 6 0 M30 29 q3 -2 6 0", 0.6); },
    "nm-castillo-de-san-marcos": function () { return sky("M-1 26 H41 V31 H-1Z") + P("M2 26 L6 14 H14 L16 18 H24 L26 14 H34 L38 26Z") + S("M6 14 H34 M4 20 H36", 0.7, PAPER) + P("M5 14 V10 Q6 8 7 10 V14Z M33 14 V10 Q34 8 35 10 V14Z") + P("M5.4 9 L6 7 L6.6 9Z M33.4 9 L34 7 L34.6 9Z") + P("M17 26 V21 Q20 18.6 23 21 V26Z", PAPER) + palmlet(39, 26) + water(28); },
    "nm-fort-pulaski": function () { var s = ""; for (var x = 4; x < 36; x += 4.6) s += "M" + x + " 24 V19 Q" + (x + 1.6) + " 16.6 " + (x + 3.2) + " 19 V24Z "; return sky("M-1 9 H41 V12 H-1Z") + P("M1 26 V12 H39 V26Z") + S("M1 14 H39", 0.7, PAPER) + P(s, PAPER) + palmlet(4, 12) + palmlet(36, 12) + water(26) + S("M-1 26 H41", 1); },
    "nm-fort-mchenry": function () { var f = "", y; for (var i = 0; i < 7; i++) { y = 3 + i * 1.6; f += i % 2 ? "" : "M20 " + y + " h16 v1.6 h-16Z "; } return P("M2 31 L5 22 H13 L15 25 H25 L27 22 H35 L38 31Z") + S("M5 22 H35", 0.6, PAPER) + S("M20 2 V25", 1) + P(f) + R(20, 3, 7, 5.6) + P("M21 4 h1 v1 h-1Z M23.4 4 h1 v1 h-1Z M25.6 4 h1 v1 h-1Z M22.2 6 h1 v1 h-1Z M24.6 6 h1 v1 h-1Z", PAPER) + S("M36 3 V14", 0.5) + GROUND(31); },
    "nm-scotts-bluff": function () { return sky("M-1 22 H41 V26 H-1Z") + P("M4 26 L6 14 L9 10 L14 8 H22 L24 11 L28 12 L31 18 L34 26Z") + S("M8 16 H30 M7 20 H32", 0.6, PAPER) +
        T(9, 20, 0.7, P("M2 6 Q4 -1 11 -1 Q18 -1 20 6Z", PAPER) + S("M2 6 Q4 -1 11 -1 Q18 -1 20 6Z M7 0 V6 M11 -1 V6 M15 0 V6", 0.8) + R(1, 6, 20, 1.4) + C(5, 9, 2.4).replace("<circle", '<circle fill="none" stroke="currentColor" stroke-width="1"') + C(17, 9, 2.4).replace("<circle", '<circle fill="none" stroke="currentColor" stroke-width="1"')) + GROUND(29.4); },
    "nm-stonewall": function () { var fl = ""; for (var i = 0; i < 6; i++) fl += (i % 2 ? "" : "M30 " + (3 + i * 1.2) + " h8 v1.2 h-8Z "); return R(4, 6, 24, 25) + S("M4 10 H28 M4 14 H28 M4 18 H28 M4 22 H28 M4 26 H28", 0.4, PAPER) + P("M7 31 V22 Q10 18 13 22 V31Z M19 31 V22 Q22 18 25 22 V31Z", PAPER) + R(6, 8, 20, 4, PAPER) + S("M8 10 H24", 1) +
        P("M8 15 h3 v4 h-3Z M14.4 15 h3 v4 h-3Z M21 15 h3 v4 h-3Z", PAPER) + S("M30 2 V31", 0.8) + P(fl) + S("M30 3 H38 V10.2 H30", 0.6); },
    "nm-katahdin-woods-and-waters": function () { return P("M-1 20 L8 12 L14 9 L20 4 L25 8 L31 11 L41 18 V20Z") + P("M18 6 L20 4 L22.4 6.6 L20 6Z", PAPER) + conifers([2, 5, 8, 32, 35, 38], 22, 6) + water(22) +
        P("M10 26 Q20 28.4 30 26 Q28 28.6 20 28.6 Q12 28.6 10 26Z", PAPER) + S("M10 26 Q20 28.4 30 26 Q28 28.6 20 28.6 Q12 28.6 10 26Z", 0.9) + person(15, 22, 0.6) + person(24, 22, 0.6) + S("M13 24 L11 30 M26 24 L28.6 29", 0.7); },
    "mem-mount-rushmore": function () { return sky("M-1 26 H41 V31 H-1Z") + PO("M-1 26 L2 12 L8 6 L16 4 L26 4 L34 7 L39 12 L41 26Z", 0.34) + heads(5, 9, 1.05) + heads(13, 7, 1.1) + heads(21, 8, 1.05) + heads(29, 10, 1) + T(0, 0, 1, "").replace("<g", "<g") +
        S("M6 18 H38", 0) + P("M-1 26 Q10 22 20 24 Q30 22 41 26 V31 H-1Z").replace("<path", '<path fill-opacity=".6"') + conifers([2, 6, 34, 38], 31, 6) + S("M3 14 L5 20 M12 13 L13 20 M20.6 13 L21 20 M28.4 14 L29 21 M36.6 15 L37 21", 0.5, PAPER) + GROUND(31); },
    "mem-lincoln-memorial": function () { return sky("M-1 10 H41 V12 H-1Z") + R(4, 7, 32, 3) + cols(5, 22, 30, 10, 9) + stair(2, 25, 0, 0, 0) + R(2, 23.6, 36, 1.4) + R(0, 25, 40, 1.4) + P("M-1 27 H41 V41 H-1Z") + P("M6 28 H34 V30 H6Z", PAPER) + S("M20 28.4 V29.6", 0.8); },
    "mem-jefferson-memorial": function () { var s = P("M8 15 Q8 6 20 5 Q32 6 32 15Z") + S("M10 11 Q20 8 30 11", 0.6, PAPER) + R(7, 15, 26, 1.6) + P("M13 17 L20 13 L27 17Z") + cols(13, 25, 14, 7, 4) + R(5, 19, 8, 6) + R(27, 19, 8, 6) + S("M7 21 V24 M10 21 V24 M30 21 V24 M33 21 V24", 0.7, PAPER) + R(3, 25, 34, 1.6);
      return s + T(-1, 20, 0.8, C(2, 2, 2) + C(5, 1, 2) + C(4, 4, 1.8) + S("M3 4 V10", 1)) + T(35, 20, 0.8, C(2, 2, 2) + C(5, 1, 2) + C(4, 4, 1.8) + S("M3 4 V10", 1)) + water(27); },
    "mem-washington-monument": function () { var r = ""; for (var a = 0; a < 7; a++) r += "M" + (6 + a * 4.6) + " 27 V22"; return P("M18 26 L18.6 6 L20 3 L21.4 6 L22 26Z") + S("M18.4 14 H21.6", 0.5, PAPER) + S(r, 0.6) + P("M6 22 h2 v1.2 h-2Z M15.2 22 h2 v1.2 h-2Z M24.4 22 h2 v1.2 h-2Z M33.6 22 h2 v1.2 h-2Z") + P("M-1 27 Q20 24 41 27 V28 H-1Z") + water(28) + P("M19 29 L20 35 L21 29Z", PAPER); },
    "mem-vietnam-veterans-memorial": function () { var n = ""; for (var i = 0; i < 6; i++) n += "M" + (3 + i * 2.6) + " " + (16 + i * 1.4) + " L" + (3 + i * 2.6) + " " + (23 + i * 0.4) + " M" + (37 - i * 2.6) + " " + (16 + i * 1.4) + " L" + (37 - i * 2.6) + " " + (23 + i * 0.4);
      return sky("M-1 11 Q20 8 41 11 V14 H-1Z") + P("M-1 15 L20 25 L41 15 V24 L20 27 L-1 24Z") + S(n, 0.4, PAPER) + person(26, 19.4, 0.7) + P("M-1 24 L20 27 L41 24 V31 H-1Z").replace("<path", '<path fill-opacity=".35"') + GROUND(31); },
    "mem-korean-war-veterans-memorial": function () { var sd = function (x, y, s) { return T(x, y, s, P("M2 0 Q4 -1 5 1 L6 3 Q7 6 7 10 L6 12 L5.4 18 H4.4 L4 13 H3 L2.6 18 H1.6 L1.4 12 L0 10 Q0 6 1 3Z") + S("M6 4 L9 -2", 0.7)); };
      return P("M-1 4 H41 V16 H-1Z").replace("<path", '<path fill-opacity=".4"') + S("M2 8 h3 M8 7 h2 M14 9 h3 M22 7 h3 M30 9 h2 M35 7 h3", 0.6, PAPER) + sd(4, 12, 0.9) + sd(13, 10, 1) + sd(22, 12, 0.9) + sd(30, 11, 0.95) +
        S("M-1 30 q2 -3 4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0", 1.2) + GROUND(30.4); },
    "mem-world-war-ii-memorial": function () { var p = ""; for (var i = 0; i < 9; i++) p += R(2 + i * 4.2, 14 + (i === 4 ? 0 : 2), 1.6, 8); return sky("M-1 10 H41 V12 H-1Z") + p + P("M15 22 V10 Q20 5 25 10 V22H22.6 V12 Q20 9.6 17.4 12 V22Z") + R(-1, 22, 42, 1.4) + P("M-1 24 H41 V31 H-1Z").replace("<path", '<path fill-opacity=".45"') + S("M10 28 Q20 22 30 28 M14 27 Q20 24 26 27 M20 26 V23", 1, PAPER) + GROUND(31); },
    "mem-mlk-jr-memorial": function () { return C(32, 6, 2.6) + P("M2 31 V8 L8 6 L10 31Z M38 31 V8 L32 6 L30 31Z").replace("<path", '<path fill-opacity=".5"') + P("M13 31 V10 L20 8 L27 10 V31Z") + P("M17 17 Q17 12 20 12 Q23 12 23 17 L25 19 V24 H15 V19Z", PAPER) + S("M17 20 L23 20 M18 22 L22 22", 0.6) + C(20, 14, 2, PAPER) + S("M13 26 L27 25 M13 29 L27 28", 0.5, PAPER) + T(-1, 22, 1, C(3, 2, 2.2) + C(6, 1, 2) + S("M4 3 V9", 1)) + GROUND(31); },
    "mem-fdr-memorial": function () { return R(-1, 6, 13, 25) + R(28, 10, 13, 21) + S("M-1 10 H12 M-1 16 H12 M-1 22 H12 M28 14 H41 M28 20 H41", 0.6, PAPER) + R(12, 14, 16, 3) + fall(13, 27, 17, 25, 4) + mist(13, 27, 25.4) + water(27) +
        T(30, 20, 0.5, P("M2 6 Q2 3 4 3 Q5 1 7 1.6 L8 0 L8.6 2 Q9.6 3 9 5 L8 5.6 L8 10 H7 L6.6 7 H4 L3.6 10 H2.6 L2.6 7Z")); },
    "mem-flight-93": function () { var w = ""; for (var y = 4; y < 26; y += 2.6) w += "M14 " + y + " h12 "; return sky("M-1 24 Q20 20 41 24 V31 H-1Z") + P("M15 27 L16 2 H24 L25 27Z") + S(w, 0.5, PAPER) + S("M20 4 V25", 0.6, PAPER) +
        S("M3 26 q0 -4 1 -6 M6 26 q-1 -3 0 -5 M34 26 q0 -4 1 -6 M37 26 q-1 -3 0 -5", 0.7) + C(4, 19.6, 0.8) + C(35, 19.6, 0.8) + C(6, 20.6, 0.7) + GROUND(29); },
    "mem-pearl-harbor": function () { return sky("M-1 16 L8 12 L14 14 L22 10 L30 14 L41 12 V18 H-1Z") + P("M3 18 Q20 22.6 37 18 L36 24 Q20 26 4 24Z", PAPER) + S("M3 18 Q20 22.6 37 18 L36 24 Q20 26 4 24Z", 1.2) + S("M9 21 V24 M14 22 V24.6 M20 22.4 V25 M26 22 V24.6 M31 21 V24", 0.7) + S("M20 20.6 V6", 0.8) + P("M20 6 h6 v3 h-6Z") + water(25) + S("M3 28 H37", 0.7, PAPER); },
    "mem-wright-brothers": function () { return sky("M-1 26 Q20 22 41 26 V31 H-1Z") + P("M24 26 Q30 18 38 18 L41 26Z") + P("M30.6 18 L31.4 8 H33.6 L34.4 18Z") + S("M31 11 H34", 0.6, PAPER) +
        S("M3 10 H21 M3 14 H21", 1.2) + S("M5 10 V14 M9 10 V14 M13 10 V14 M17 10 V14 M21 10 V14", 0.6) + S("M-1 12 H3 M0 10.6 V13.4 M21 12 H24 M24 10 V14", 0.8) + P("M11 12.4 h2 v1 h-2Z") + GROUND(31); },
    "mem-de-soto": function () { return sky("M-1 20 H41 V22 H-1Z") + P("M6 21 H34 L31 26 H9Z") + P("M31 21 L36 18 V21Z M6 21 L4 18 L9 19Z") + S("M14 21 V5 M24 21 V7 M33 19 L37 13", 0.9) + P("M10 7 Q14 9 18 7 L18 17 Q14 19 10 17Z M20 9 Q24 11 28 9 L28 18 Q24 20 20 18Z") + S("M14 8 V18 M24 10 V18", 0.6, PAPER) + water(26); },
    "mem-fort-caroline": function () { var pal = ""; for (var x = 6; x <= 34; x += 2) pal += "M" + x + " " + (x < 20 ? 24 - (x - 6) * 0.6 : 15.6 + (x - 20) * 0.6) + " V27 "; return sky("M-1 26 H41 V28 H-1Z") + S(pal, 1.4) + P("M6 24 L20 15.6 L34 24 L34 27 H6Z").replace("<path", '<path fill-opacity="0"') + S("M20 15 V4", 0.7) + P("M20 4 h5 v3 h-5Z") + palmlet(37, 26) + water(28); },
    "mem-chamizal": function () { return sky("M-1 18 L6 10 L10 14 L16 6 L22 13 L28 9 L35 14 L41 11 V20 H-1Z") + R(6, 18, 28, 7) + P("M6 18 L20 15 L34 18Z") + R(9, 20, 22, 3.4, PAPER) + S("M10 22 q2 -2 4 0 t4 0 t4 0 t4 0 t4 0", 0.7) + S("M4 13 V25 M36 13 V25", 0.6) + P("M4 13 h3 v2 h-3Z M36 13 h3 v2 h-3Z") + water(26); },
    "mem-coronado": function () { return sky("M-1 26 L8 20 L14 23 L22 16 L30 22 L41 18 V31 H-1Z") + T(9, 2, 1, P("M2 12 Q1 4 11 4 Q21 4 20 12 Z") + P("M-2 12 Q11 9 24 12 Q24 15 21 14 Q11 12 1 14 Q-2 15 -2 12Z") + P("M10 4 Q11 -1 12 4Z") + S("M5 9 Q11 6 17 9", 0.7, PAPER)) + GROUND(31); },
    "mem-perry-s-victory": function () { return sky("M-1 24 H41 V27 H-1Z") + R(17.6, 6, 4.8, 18) + S("M19 7 V23 M21 7 V23", 0.5, PAPER) + R(16, 4.6, 8, 1.6) + P("M18 4.6 Q18 1.6 20 1.6 Q22 1.6 22 4.6Z") + R(15, 23, 10, 2.4) + P("M2 26 Q12 22 30 23 Q38 23 41 26Z") + water(26) + P("M30 28 h6 l-1 1.4 h-4Z M33 28 V24 L35 27Z", 0); },
    "mem-federal-hall": function () { return R(4, 9, 32, 2.6) + P("M4 9 L20 3 L36 9Z") + P("M10 8 L20 4.6 L30 8Z", PAPER) + cols(5, 24, 30, 12, 6) + R(2, 25.4, 36, 1.6) + R(0, 27, 40, 1.6) + T(17, 15, 0.7, C(4, 1.6, 1.6) + P("M1.6 3.6 H6.4 L7 10 H5.6 V14 H2.4 V10 H1Z")) + R(16, 24.2, 8, 1.4) + GROUND(29); },
    "mem-general-grant": function () { return R(6, 18, 28, 8) + cols(8, 18, 24, 0, 0) + S("M9 19 V25 M12 19 V25 M15 19 V25 M25 19 V25 M28 19 V25 M31 19 V25", 1.2, PAPER) + R(5, 16.6, 30, 1.6) + R(12, 10, 16, 6.6) + S("M14 11 V16 M17 11 V16 M20 11 V16 M23 11 V16 M26 11 V16", 1, PAPER) + P("M12 10 L14 6 H26 L28 10Z") + R(15, 4.6, 10, 1.6) + R(3, 26, 34, 1.8) + R(1, 27.8, 38, 1.6) + P("M17 26 V21 H23 V26Z", PAPER) + GROUND(31); },
    "mem-johnstown-flood": function () { return sky("M-1 16 Q10 12 20 15 Q30 11 41 15 V20 H-1Z") + P("M-1 31 V18 Q6 16 12 20 L16 31Z M41 31 V18 Q34 16 28 20 L24 31Z") + conifers([2, 6, 34, 38], 18, 5) + PO("M12 20 H28 L26 31 H14Z", 0.35) + fall(16, 24, 20, 30, 3) + S("M10 20 H16 M24 20 H30", 1.4) + water(30); },
    "mem-lincoln-boyhood": function () { var lg = ""; for (var y = 16; y < 27; y += 2.2) lg += "M7 " + y + " H25 "; return conifers([30, 34, 38], 26, 10) + P("M6 15 L16 8 L26 15Z") + R(7, 15, 18, 12) + S(lg, 0.6, PAPER) + R(19, 6, 2.6, 5) + P("M14 27 V20 H18 V27Z M9 19 h3 v3 h-3Z", PAPER) +
        S("M-1 28 L6 24 M-1 30 L6 26 M1 30 V25 M4 29 V24", 0.9) + GROUND(29); },
    "mem-arkansas-post": function () { return conifers([4, 8, 12, 33, 37], 16, 8) + P("M-1 16 H41 V20 H-1Z") + water(20) + P("M-1 23 Q20 21 41 24 V31 H-1Z") + C(16, 26, 2.6, PAPER) + C(16, 26, 2.6).replace("<circle", '<circle fill="none" stroke="currentColor" stroke-width="0.9"') + P("M17 24 L30 21 L31 23 L18 27Z") + S("M16 23.4 V28.6 M13.4 26 H18.6", 0.6) + S("M3 27 H10", 0.8, PAPER); }
  };
  // shared parts used by more than one scene
  G.x_lib = function () { return P("M14 31 V27 H26 V31Z M15.4 27 V20 H24.6 V27Z") + S("M15.4 23 H24.6", 0.6, PAPER) + P("M17 20 L17.6 12 Q17 9 19 8.4 L20.6 8.4 Q23 9 22.4 12 L23 20Z") +
      C(20, 7, 1.6) + P("M17.4 6 L16 3.6 L18.2 5.4 L18.4 2.6 L19.6 5 L20.4 2 L21 5 L22.4 2.8 L22.2 5.4 L24.4 3.6 L22.8 6Z") + S("M22 10 L25 4 L25.2 1.4", 1.4) + P("M24.2 1.6 Q25 -1.6 26 1.6Z") + R(16.4, 11, 1.6, 3.4) + S("M18.4 13 L22 15", 0.6, PAPER); };
  Object.keys(XPG).forEach(function (k) { G["x_" + k] = XPG[k]; });
  // ---------- landmark drawings for countries that had a generic or wrong picture ----------
  var CTYG = {
    c_eiffel: function () { return P("M19 2 h2 l0.6 6 h-3.2Z M18.4 8 h3.2 l1.6 10 h-6.4Z M16.8 18 h6.4 l5.8 18 h-4.4 Q20 27 15.4 36 H11Z") + R(16, 7.4, 8, 1.4) + R(14.6, 17.4, 10.8, 1.6) + P("M16.6 36 Q20 29 23.4 36Z", PAPER) + S("M18.6 11 L21.4 15 M21.4 11 L18.6 15 M17.6 21 L22.4 26 M22.4 21 L17.6 26", 0.5, PAPER) + S("M4 37 H36", 1.2); },
    c_sagrada: function () { var s = ""; [[8, 14], [14, 6], [20, 3], [26, 6], [32, 14]].forEach(function (t) { s += P("M" + (t[0] - 2.4) + " 34 V" + (t[1] + 6) + " Q" + t[0] + " " + (t[1] - 3) + " " + (t[0] + 2.4) + " " + (t[1] + 6) + " V34Z") + C(t[0], t[1] - 1.4, 1.1); });
      return s + R(4, 26, 32, 8) + P("M16 34 V28 Q20 24 24 28 V34Z", PAPER) + S("M5.6 22 h4.8 M11.6 16 h4.8 M17.6 12 h4.8 M23.6 16 h4.8 M29.6 22 h4.8", 0.6, PAPER) + S("M2 36 H38", 1.2); },
    c_brandenburg: function () { return R(5, 13, 30, 4) + R(3, 11.6, 34, 1.6) + cols(5, 33, 30, 16, 6) + R(3, 33, 34, 2) + P("M15 11.6 V8 H25 V11.6Z") + T(15, 2, 0.5, P("M2 12 Q1 7 4 6 L6 2 L7 6 L12 5 L13 1.4 L14 5 L18 5 L19 1 L20 5 Q22 6 21 12Z")) + S("M20 2 V0", 0.8); },
    c_atomium: function () { var p = [[20, 4], [10, 12], [30, 12], [20, 18], [10, 26], [30, 26], [20, 20.4], [20, 32], [14, 19]], l = "M20 4 L10 12 L20 18 L30 12Z M10 12 L10 26 M30 12 L30 26 M10 26 L20 32 L30 26 M20 18 L20 32 M20 4 L20 18", s = S(l, 1.4); [[20, 4], [10, 12], [30, 12], [20, 18], [10, 26], [30, 26], [20, 32]].forEach(function (q) { s += C(q[0], q[1], 3.4) + C(q[0] - 1, q[1] - 1, 0.9, PAPER); }); return s + S("M17 36 h6 M20 32 V36", 1.2); },
    c_marinabay: function () { return R(8, 10, 6, 24) + R(17, 10, 6, 24) + R(26, 10, 6, 24) + P("M4 7 H38 Q38 9.6 35 10 H6 Q4 9.6 4 7Z") + S("M9.6 14 V30 M18.6 14 V30 M27.6 14 V30", 0.6, PAPER) + water(34) + S("M2 34 H38", 1); },
    c_tajmahal: function () { return P("M13 20 Q11 12 20 8 Q29 12 27 20Z") + P("M19.4 8 L20 3 L20.6 8Z") + E(13.4, 18, 2.4, 2.6) + E(26.6, 18, 2.4, 2.6) + R(10, 20, 20, 12) + P("M17 32 V25 Q20 21 23 25 V32Z M11.6 23 h3 v3 h-3Z M25.4 23 h3 v3 h-3Z M11.6 28 h3 v3 h-3Z M25.4 28 h3 v3 h-3Z", PAPER) +
        R(3.4, 14, 2, 18) + R(34.6, 14, 2, 18) + P("M3 14 Q4.4 11 5.8 14Z M34.2 14 Q35.6 11 37 14Z") + R(1, 32, 38, 1.8) + P("M17 34 H23 L22 39 H18Z", PAPER); },
    c_greatwall: function () { var w = "M-1 30 Q6 26 10 22 Q14 16 20 18 Q26 20 30 12 Q33 7 41 8"; return PO("M-1 34 L6 22 L12 26 L20 14 L28 20 L34 8 L41 14 V41 H-1Z", 0.35) + S(w, 3.6) + S(w, 1, PAPER) + R(8, 18, 4.4, 5) + R(27.6, 8, 4.4, 5) + P("M8 18 h1 v-1 h1 v1 h1 v-1 h1.4 v1Z M27.6 8 h1 v-1 h1 v1 h1 v-1 h1.4 v1Z") + S("M-1 36 H41", 1); },
    c_nyhavn: function () { var s = ""; [[2, 16, 0], [9, 13, 1], [16, 15, 0], [23, 12, 1], [30, 14, 0]].forEach(function (h) { s += P("M" + h[0] + " 28 V" + h[1] + " L" + (h[0] + 3.5) + " " + (h[1] - 4) + " L" + (h[0] + 7) + " " + h[1] + " V28Z", h[2] ? 0 : 0) + P("M" + (h[0] + 1.4) + " " + (h[1] + 2) + " h1.4 v2 h-1.4Z M" + (h[0] + 4.2) + " " + (h[1] + 2) + " h1.4 v2 h-1.4Z M" + (h[0] + 1.4) + " " + (h[1] + 6) + " h1.4 v2 h-1.4Z M" + (h[0] + 4.2) + " " + (h[1] + 6) + " h1.4 v2 h-1.4Z", PAPER); });
      return s + water(28) + S("M10 30 V18 M26 30 V20", 0.8) + P("M6 31 H16 L15 33 H7Z M22 31 H32 L31 33 H23Z"); },
    c_dubrovnik: function () { return P("M2 28 V18 H8 V14 H12 V18 H22 V16 H26 V18 H31 V8 H37 V28Z") + P("M2 18 h1.4 v-1.4 h1.4 v1.4 h1.4 v-1.4 h1.4 v1.4 M31 8 h1.2 v-1.4 h1.2 v1.4 h1.2 v-1.4 h1.2 v1.4 h1.2", 0) + P("M12 20 L16 16 L20 20Z M22 22 L25 19 L28 22Z") + P("M5 22 h2 v2 h-2Z M14 22 h2 v2 h-2Z M33 12 h2 v3 h-2Z M24 24 h2 v2 h-2Z", PAPER) + water(28); },
    c_obelisco: function () { return P("M18 32 L18.6 8 L20 4.6 L21.4 8 L22 32Z") + C(20, 12, 0.7, PAPER) + S("M18.4 20 H21.6", 0.5, PAPER) + R(16, 32, 8, 1.6) + S("M2 37 L14 33 M38 37 L26 33 M8 37 L16 33.6 M32 37 L24 33.6", 0.9) + S("M4 30 H12 M28 30 H36", 0.6) + P("M5 30 V24 h1.6 V30Z M9 30 V22 h1.6 V30Z M30 30 V23 h1.6 V30Z M34 30 V25 h1.6 V30Z"); },
    c_koutoubia: function () { return R(14, 10, 12, 24) + R(13, 8.4, 14, 1.6) + R(17, 3.6, 6, 4.8) + P("M17 3.6 L20 1 L23 3.6Z") + S("M20 1 V-1", 0.6) + P("M17 14 h2 v4 h-2Z M21 14 h2 v4 h-2Z M18 22 Q19 19.6 20 22 V26 H18Z M20 22 Q21 19.6 22 22 V26 H20Z", PAPER) + S("M14 30 H26", 0.6, PAPER) + palmlet(6, 34) + palmlet(34, 34) + S("M1 34 H39", 1.2); },
    c_parliament: function () { var sp = ""; for (var x = 3; x <= 37; x += 4.2) sp += "M" + (x - 0.8) + " 18 L" + x + " 13 L" + (x + 0.8) + " 18Z "; return R(2, 18, 36, 9) + P(sp) + P("M14 18 Q14 10 20 9 Q26 10 26 18Z") + P("M19 9 L20 2 L21 9Z") + P("M5 21 h1.4 v3 h-1.4Z M9 21 h1.4 v3 h-1.4Z M13 21 h1.4 v3 h-1.4Z M25.6 21 h1.4 v3 h-1.4Z M29.6 21 h1.4 v3 h-1.4Z M33.6 21 h1.4 v3 h-1.4Z M18.6 20 h2.8 v4 h-2.8Z", PAPER) + water(27); }
  };
  CTYG.c_bahamas = function () { return P("M6 29 Q20 24 34 29Z") + lighthouse(20, 27.6, 21, 3.6, 1) + palmlet(8.4, 28) + palmlet(31.4, 28) + water(29) + S("M27 9 Q28.4 8 29.8 9 Q31.2 8 32.6 9", 0.7); };
  Object.keys(CTYG).forEach(function (k) { G[k] = CTYG[k]; });

  // ---------- v79: place types (sights, nature, kid favorites, drinks, getting there...): one picture per type ----------
  // Placeholder designs in the Famstamp stamp style, our own drawings; the type stamps get new art later.
  var TG = {
    castle: function () { return P("M4 38 V16 H3 V11 H6 V13 H8 V11 H11 V16 H10 V22 H30 V16 H29 V11 H32 V13 H34 V11 H37 V16 H36 V38 Z") + P("M15 22 V9 H14 V5 H17 V7 H19 V5 H21 V7 H23 V5 H26 V9 H25 V22 Z") +
      P("M17 38 V31 Q20 27 23 31 V38 Z M6.5 20 h2 v4 h-2Z M31.5 20 h2 v4 h-2Z M19 12 h2 v4 h-2Z", PAPER) + S("M20 5 V0.6", 1) + P("M20 0.6 L25 2 L20 3.4Z") + S("M0 39 H40", 1.3); },
    ruin: function () { return P("M2 38 V12 L5 9 L7 13 L9 10 V38 Z") + P("M13 38 V18 Q20 9 27 18 V38 H24 V22 Q20 16 16 22 V38 Z") + P("M31 38 V22 L33 19 L35 23 L37 20 V38 Z") +
      S("M2 20 H9 M2 28 H9 M31 30 H37", 0.8, PAPER) + C(11, 37.4, 1.6) + C(29, 37.6, 1.2) + S("M0 39 H40", 1.3); },
    cathedral: function () { return P("M8 38 V18 L11 6 L14 18 V38 Z M26 38 V18 L29 6 L32 18 V38 Z") + P("M14 38 V22 L20 15 L26 22 V38 Z") + C(20, 25.5, 3, PAPER) +
      P("M18 38 V33 Q20 30.5 22 33 V38 Z M10 24 h2 v5 h-2Z M28 24 h2 v5 h-2Z", PAPER) + S("M11 6 V2 M9.6 3.4 H12.4 M29 6 V2 M27.6 3.4 H30.4", 0.9) + S("M0 39 H40", 1.3); },
    abbey: function () { return P("M2 38 V24 L10 18 L18 24 V38 Z") + P("M18 38 V10 H28 V38 Z") + P("M18 10 V7 H20.4 V10 Z M21.8 10 V7 H24.2 V10 Z M25.6 10 V7 H28 V10 Z") + P("M28 38 V26 L34 21 L40 26 V38 Z") +
      P("M21.5 14 h3 v6 h-3Z M6 31 Q8 28 10 31 V35 H6Z M12 31 Q14 28 16 31 V35 H12Z M31 31 Q33 28 35 31 V35 H31Z", PAPER) + S("M0 39 H40", 1.3); },
    viewer: function () { return S("M0 31 L7 24 L12 28 L18 22", 1.1) + S("M26 25 L32 20 L40 27", 1.1) + P("M9 12 Q9 8 13 8 H27 Q31 8 31 12 V17 Q31 21 27 21 H13 Q9 21 9 17 Z") +
      C(15, 14.5, 3.6, PAPER) + C(25, 14.5, 3.6, PAPER) + C(15, 14.5, 1.5) + C(25, 14.5, 1.5) + P("M18.5 21 H21.5 V35 H18.5Z M13 35 H27 V38 H13Z") + S("M0 39 H40", 1.3); },
    beach: function () { return S("M20 13 L21 36", 1.6) + P("M5 15 Q20 1 35 15 Z") + P("M5 15 Q8.75 12 12.5 15 Q16.25 12 20 15 Q23.75 12 27.5 15 Q31.25 12 35 15 Z", PAPER) + C(34, 5, 2.8) +
      P("M0 37 Q20 33 40 37 V40 H0Z") + S("M0 31 Q5 29 10 31 T20 31", 1.1); },
    boot: function () { return P("M10 5 H21 V21 Q29 21 33 26 Q35.5 29 34.5 32 H8 V29 Q8 24 10 20 Z") + P("M7 32 H35.5 V36 H7Z") + S("M12.5 9 H18.5 M12.5 13 H18.5 M12.5 17 H18.5", 1.1, PAPER) +
      S("M9 36.3 V35 M14 36.3 V35 M19 36.3 V35 M24 36.3 V35 M29 36.3 V35", 1, PAPER); },
    fish: function () { return P("M5 21 Q14 9 27 21 Q14 33 5 21 Z") + P("M26 21 L35 13 V29 Z") + C(11, 19.5, 1.5, PAPER) + S("M17 15 Q19.5 21 17 27", 1, PAPER) + C(31, 7, 1.6) + C(35, 3, 1.1) + C(27, 4, 1) +
      S("M0 38 Q5 36 10 38 T20 38 T30 38 T40 38", 1.2); },
    ferris: function () { return S("M20 4 A12 12 0 1 1 19.9 4", 1.8) + S("M20 4 V28 M8 16 H32 M11.5 7.5 L28.5 24.5 M28.5 7.5 L11.5 24.5", 0.9) + C(20, 16, 2) +
      P("M18 2 h4 v4 h-4Z M30 14 h4 v4 h-4Z M18 26 h4 v4 h-4Z M6 14 h4 v4 h-4Z") + S("M20 16 L12 38 M20 16 L28 38", 2) + S("M0 39 H40", 1.3); },
    swing: function () { return S("M4 38 L10 6 H30 L36 38", 2.2) + S("M16 6 V25 M24 6 V25", 1) + P("M14 25 H26 V27.5 H14Z") + C(20, 19.5, 2.6) + S("M0 39 H40", 1.3); },
    still: function () { return P("M7 38 V28 Q7 17 19 17 Q31 17 31 28 V38 Z") + P("M15 17 V11 Q19 7 23 11 V17 Z") + S("M19 8 Q21 2 29 5 L37 12 V22", 2) + P("M34 22 H40 V30 H34Z") +
      S("M8 30 H30 M8 34 H30", 1, PAPER) + S("M0 39 H40", 1.3); },
    mug: function () { return P("M8 12 H26 V36 Q26 38 24 38 H10 Q8 38 8 36 Z") + S("M26 17 H31 Q33 17 33 19 V27 Q33 29 31 29 H26", 2.4) + P("M7 13 V10 Q8 5 13 6.5 Q16 3 21 5.5 Q26 4.5 27 9.5 V13 Z") +
      S("M13 17 V33 M17 17 V33 M21 17 V33", 1, PAPER); },
    grapes: function () { return S("M20 10 Q20 5 24 3", 1.4) + P("M21 7 Q27 0.5 35 5 Q30 11.5 21 7Z") + C(13, 14, 3.4) + C(20, 14, 3.4) + C(27, 14, 3.4) + C(16.5, 20, 3.4) + C(23.5, 20, 3.4) + C(13, 20, 2.6) + C(27, 20, 2.6) +
      C(20, 26, 3.4) + C(16.5, 31.5, 3) + C(23.5, 31.5, 3) + C(20, 36.5, 2.6) + C(12, 13, 0.8, PAPER) + C(19, 13, 0.8, PAPER) + C(15.5, 19, 0.8, PAPER) + C(19, 25, 0.8, PAPER); },
    pint: function () { return P("M11 9 H29 L26.6 36 Q26.4 38 24.4 38 H15.6 Q13.6 38 13.4 36 Z") + P("M10.5 10 V8 Q11 3.5 15.5 4.6 Q20 1.5 24.5 4.4 Q29 3.5 29.5 8 V12 H10.5 Z") +
      S("M12.6 15 H27.4", 1.2, PAPER) + S("M16 19 L15.4 34", 1, PAPER) + S("M0 39 H40", 1.3); },
    train: function () { return P("M10 5 H30 Q33.5 5 33.5 8.5 V31 H6.5 V8.5 Q6.5 5 10 5 Z") + P("M10 9 H30 V18 H10Z M17 5.8 H23 V7.2 H17Z", PAPER) + C(12, 25.5, 2, PAPER) + C(28, 25.5, 2, PAPER) + P("M17 24 H23 V27 H17Z", PAPER) +
      S("M11 31 L6 37 M29 31 L34 37", 1.8) + S("M1 37 H39 M3 39.4 H37", 1.2); },
    road: function () { return S("M0 21 L8 13 L14 18 L20 12", 1.2) + S("M27 14 L33 9 L40 15", 1.2) + P("M13 40 Q6 31 17 25 Q28 19 22 13 Q18 9 23 3 H26 Q22 8.6 26.4 12.6 Q33 19.5 22 26.5 Q14 31.5 21 40 Z") +
      S("M17 37 Q13.6 31.4 19.6 27.6 M24.6 21 Q28.4 17 24.4 12.2", 0.9, PAPER); },
    stadium: function () { return P("M2 21 Q20 13 38 21 V32 Q20 40 2 32 Z") + P("M8 24.5 Q20 19.5 32 24.5 V28.5 Q20 33.5 8 28.5 Z", PAPER) + S("M20 20.6 V32", 0.8) + S("M4 21 V5 M36 21 V5", 1.4) +
      P("M1 2.5 H7 V7 H1Z M33 2.5 H39 V7 H33Z") + C(2.6, 4.7, 0.7, PAPER) + C(5.4, 4.7, 0.7, PAPER) + C(34.6, 4.7, 0.7, PAPER) + C(37.4, 4.7, 0.7, PAPER); },
    clapper: function () { return P("M6 16 H34 V37 H6Z") + P("M6 9.5 L33 3 L34.2 8 L7.2 14.5 Z") + P("M11 12.3 L14.3 6.8 L17.4 6.1 L14.1 11.6Z M20.4 10.1 L23.7 4.6 L26.8 3.9 L23.5 9.4Z", PAPER) +
      S("M10 22 H30 M10 27 H24 M10 32 H27", 1.2, PAPER); },
    bridge: function () { return P("M9 5 H12 V33 H9Z M28 5 H31 V33 H28Z") + S("M0 13 Q6 8 10.5 5.5 Q20 22 29.5 5.5 Q34 8 40 13", 1.1) + S("M15 12 V24 M20 15 V24 M25 12 V24 M5 9.4 V24 M35 9.4 V24", 0.7) +
      P("M0 23.4 H40 V26 H0Z") + S("M0 35 Q5 33 10 35 T20 35 T30 35 T40 35", 1.2); },
    pin: function () { return P("M20 38 Q9 24 9 15.5 A11 11 0 1 1 31 15.5 Q31 24 20 38 Z") + C(20, 15.5, 4.4, PAPER) + E(20, 38.4, 7, 1.4); },
    star5: function () { return P("M20 3 L24.5 15 L37 15.4 L27 23.2 L30.8 36 L20 28.4 L9.2 36 L13 23.2 L3 15.4 L15.5 15 Z") + C(20, 20, 3.6, PAPER); }
  };
  Object.keys(TG).forEach(function (k) { G[k] = TG[k]; });

  // ---------- v94: places of worship and more cultural sights, each with its own picture (our own drawings, same style) ----------
  var WG = {
    mosque: function () { return P("M9 38 V27 Q9 16 20 12 Q31 16 31 27 V38 Z") + P("M19.2 12 V8.5 H20.8 V12 Z") + S("M21.6 4.2 A2.6 2.6 0 1 0 21.6 8.2 A2 2 0 1 1 21.6 4.2", 0.8) +
      P("M2.4 38 V13 H5.6 V38 Z M2.4 13 L4 6 L5.6 13 Z M34.4 38 V13 H37.6 V38 Z M34.4 13 L36 6 L37.6 13 Z") + P("M1.6 19 H6.4 V20.4 H1.6Z M33.6 19 H38.4 V20.4 H33.6Z") +
      P("M17 38 V31 Q20 27.5 23 31 V38 Z M12.5 27 Q13.5 25 14.5 27 V31 H12.5Z M25.5 27 Q26.5 25 27.5 27 V31 H25.5Z", PAPER) + S("M0 39 H40", 1.3); },
    church: function () { return P("M6 38 V22 L18 13 L18 38 Z") + P("M18 38 V12 L23.5 4.5 L29 12 V38 Z") + P("M29 38 V24 H35 V38 Z") + S("M23.5 4.5 V0.8 M21.8 2.2 H25.2", 0.9) +
      P("M21.3 38 V31 Q23.5 28 25.7 31 V38 Z M22 16 Q23.5 13.6 25 16 V20 H22Z M10 27 h3 v5 h-3Z", PAPER) + S("M0 39 H40", 1.3); },
    basilica: function () { return P("M12 21 Q12 10 20 7.5 Q28 10 28 21 Z") + P("M18.8 7.6 V4 H21.2 V7.6Z") + S("M20 4 V0.8 M18.6 2.1 H21.4", 0.9) + P("M3 38 V23 L20 17 L37 23 V38 Z") +
      P("M7 38 V27 h2.4 V38Z M12 38 V27 h2.4 V38Z M25.6 38 V27 h2.4 V38Z M30.6 38 V27 h2.4 V38Z M17.6 38 V30 Q20 27 22.4 30 V38Z", PAPER) + S("M14 14.5 Q20 11.5 26 14.5", 0.8, PAPER) + S("M0 39 H40", 1.3); },
    synagogue: function () { return P("M4 38 V18 L20 9 L36 18 V38 Z") + S("M20 12.6 L23.7 19 H16.3 Z M20 21.4 L16.3 15 H23.7 Z", 1.1, PAPER) +
      P("M16 38 V30 Q20 25.5 24 30 V38 Z M8 26 Q9.5 23.5 11 26 V32 H8Z M29 26 Q30.5 23.5 32 26 V32 H29Z", PAPER) + S("M0 39 H40", 1.3); },
    torii: function () { return P("M2 7 Q20 11 38 7 L37 11.4 Q20 14.6 3 11.4 Z") + P("M6 15 H34 V18 H6Z") + P("M9 11.6 H12.4 V38 H9Z M27.6 11.6 H31 V38 H27.6Z") + P("M18.6 13 H21.4 V15 H18.6Z") +
      P("M7.6 36 H13.8 V38.6 H7.6Z M26.2 36 H32.4 V38.6 H26.2Z") + S("M0 39 H40", 1.3); },
    bell: function () { return P("M14 38 V10 L20 4 L26 10 V38 Z") + P("M16.4 13 Q20 9.5 23.6 13 V19 H16.4Z", PAPER) + P("M18 13.6 Q20 12 22 13.6 L22.6 17.6 H17.4 Z") + C(20, 18.4, 0.8) +
      P("M2 38 V26 L8 22 L14 26 V38Z M26 38 V26 L32 22 L38 26 V38Z") + P("M17.6 38 V31 Q20 28.5 22.4 31 V38Z M5 30 h2 v4 h-2Z M33 30 h2 v4 h-2Z", PAPER) + S("M0 39 H40", 1.3); },
    stupa: function () { return P("M7 38 V34 H33 V38Z M9 34 V31 H31 V34Z") + P("M10 31 Q10 17 20 15 Q30 17 30 31 Z") + P("M17 15 V12 H23 V15Z") + P("M18 12 L20 1.5 L22 12 Z") +
      S("M18.6 9 H21.4 M18.9 6 H21.1", 0.7, PAPER) + E(16, 19.6, 1.3, 0.7, 0, PAPER) + E(24, 19.6, 1.3, 0.7, 0, PAPER) + S("M0 39 H40", 1.3); },
    gurdwara: function () { return P("M11 24 Q11 14 20 10 Q29 14 29 24 Z") + P("M19.2 10 L20 3.5 L20.8 10Z") + P("M4 38 V24 H36 V38 Z") + C(6, 21.6, 2.4) + C(34, 21.6, 2.4) +
      P("M5.6 19.2 L6 16.4 L6.4 19.2Z M33.6 19.2 L34 16.4 L34.4 19.2Z") + P("M8 38 V31 Q10 28.5 12 31 V38Z M17 38 V30 Q20 26.5 23 30 V38Z M28 38 V31 Q30 28.5 32 31 V38Z", PAPER) +
      S("M0 39.4 Q5 38 10 39.4 T20 39.4 T30 39.4 T40 39.4", 0.9); },
    cistern: function () { var s = P("M1 4 H39 V8 H1Z"); [3, 12, 21, 30].forEach(function (x) { s += P("M" + x + " 8 Q" + (x + 4.5) + " 1 " + (x + 9) + " 8 Z", PAPER) + P("M" + x + " 8 H" + (x + 2) + " V30 H" + x + "Z"); });
      return s + P("M37 8 H39 V30 H37Z") + S("M0 33 Q5 31 10 33 T20 33 T30 33 T40 33 M0 37.5 Q5 35.5 10 37.5 T20 37.5 T30 37.5 T40 37.5", 1.2); },
    market: function () { return P("M3 12 L7 4 H33 L37 12 Z") + P("M3 12 Q5.5 16 8 12 Q10.5 16 13 12 Q15.5 16 18 12 Q20.5 16 23 12 Q25.5 16 28 12 Q30.5 16 33 12 Q35.5 16 37 12 Z") +
      S("M11 4 L9 12 M17 4 L16 12 M23 4 L24 12 M29 4 L31 12", 0.9, PAPER) + P("M5 16 H7.6 V38 H5Z M32.4 16 H35 V38 H32.4Z M6 27 H34 V30.5 H6Z") +
      C(12, 25, 2.2) + C(17, 25, 2.2) + C(22.5, 25, 2.2) + C(28, 25, 2.2) + S("M0 39 H40", 1.3); },
    square: function () { return S("M2 30 L20 22 L38 30 L20 38 Z", 1.2) + S("M11 26 L29 34 M11 34 L29 26", 0.7) + P("M17 26 H23 V29 H17Z") + P("M19 13 H21 V26 H19Z") +
      S("M20 13 Q15 11 13.6 17 M20 13 Q25 11 26.4 17", 1) + C(20, 11.6, 1.6) + P("M3 8 V22 H6 V8Z M34 8 V22 H37 V8Z") + C(4.5, 7, 3) + C(35.5, 7, 3); },
    fort: function () { return P("M2 38 L5 22 H35 L38 38 Z") + P("M5 22 V18 H8 V20 H11 V18 H14 V20 H17 V18 H23 V20 H26 V18 H29 V20 H32 V18 H35 V22 Z") + P("M15 18 V8 H25 V18 Z") +
      P("M15 8 V5 H17.5 V8Z M18.75 8 V5 H21.25 V8Z M22.5 8 V5 H25 V8Z") + S("M20 5 V1", 0.9) + P("M20 1 L24 2.4 L20 3.8Z") + P("M16.5 38 V31 Q20 27 23.5 31 V38Z M19 11 h2 v4 h-2Z", PAPER) + S("M0 39 H40", 1.3); },
    oldtown: function () { return P("M1 38 V20 L6 15 L11 20 V38Z") + P("M11 38 V16 L16 8 L21 16 V38Z") + P("M21 38 V22 L26 17 L31 22 V38Z") + P("M31 38 V14 L33.5 6 L36 14 H39 V38Z") +
      P("M4.4 24 h3 v3 h-3Z M14.4 20 h3 v3 h-3Z M14.4 27 h3 v3 h-3Z M24.4 26 h3 v3 h-3Z M32.4 19 h3 v3 h-3Z M4.4 31 h3 v7 h-3Z M24.4 32 h3 v6 h-3Z", PAPER) + S("M0 39 H40", 1.3); },
    street: function () { return P("M18.6 4 H21.4 V38 H18.6Z") + P("M6 7 H30 L34 10.5 L30 14 H6Z") + P("M34 17 H10 L6 20.5 L10 24 H34Z") + S("M9 10.5 H26 M13 20.5 H30", 1.1, PAPER) +
      C(20, 3, 1.6) + P("M14 38 H26 V39.6 H14Z") + S("M0 39.6 H40", 1); },
    tomb: function () { return P("M12 23 Q12 12 20 9 Q28 12 28 23 Z") + P("M19.2 9 L20 4 L20.8 9Z") + P("M7 38 V23 H33 V38Z") + P("M2 38 V12 H4.4 V38Z M35.6 38 V12 H38 V38Z M2 12 L3.2 8.6 L4.4 12Z M35.6 12 L36.8 8.6 L38 12Z") +
      C(10.5, 21, 2.2) + C(29.5, 21, 2.2) + P("M16.5 38 V29 Q20 24.5 23.5 29 V38Z", PAPER) + P("M0 38 H40 V40 H0Z"); },
    amphi: function () { var s = P("M2 14 Q20 4 38 14 V34 Q20 42 2 34 Z"); [6, 12, 18, 24, 30].forEach(function (x) { s += P("M" + (x + 0.6) + " 20 Q" + (x + 2.6) + " 16.6 " + (x + 4.6) + " 20 V25 H" + (x + 0.6) + "Z M" + (x + 0.6) + " 29.5 Q" + (x + 2.6) + " 26.4 " + (x + 4.6) + " 29.5 V34 H" + (x + 0.6) + "Z", PAPER); });
      return s + S("M2 16 Q20 7 38 16", 0.8, PAPER) + S("M0 39 H40", 1.3); },
    onsen: function () { return P("M4 26 Q4 38 20 38 Q36 38 36 26 Z") + E(20, 26, 16, 3.2) + E(20, 26, 13, 2, 0, PAPER) + S("M12 21 Q9 17 12 13 T12 5 M20 21 Q17 17 20 13 T20 3 M28 21 Q25 17 28 13 T28 5", 1.7); },
    deck: function () { return P("M18.4 13 H21.6 L24 38 H16 Z") + P("M9 9 H31 L28 14 H12 Z") + S("M7 9 V5 H33 V9", 1.1) + S("M11 5 V9 M15 5 V9 M19 5 V9 M23 5 V9 M27 5 V9", 0.8) + P("M19.4 0.6 H20.6 V5 H19.4Z") +
      S("M17.4 20 H22.6 M17 27 H23", 0.8, PAPER) + S("M0 39 H40", 1.3); }
  };
  Object.keys(WG).forEach(function (k) { G[k] = WG[k]; });
  /** Place types for sights and other stops (search, trip stops, their passport stamps). label, emoji, picture, ink, group. */
  var TYPES = {
    castle: ["Castle", "🏰", "castle", "#6b3a2a", "sights"], palace: ["Palace", "👑", "dome", "#5f35a0", "sights"], ruin: ["Ruins", "🏚️", "ruin", "#5b4a2f", "sights"],
    ancient: ["Ancient site", "🏺", "pyramid", "#8a4a17", "sights"], historic: ["Historic site", "📜", "columns", "#5b4a2f", "sights"], abbey: ["Abbey", "⛪", "abbey", "#3b4048", "worship"],
    cathedral: ["Cathedral", "⛪", "cathedral", "#23262c", "worship"], temple: ["Temple", "🛕", "pagoda", "#962043", "worship"], monument: ["Monument", "🗿", "obelisk", "#1f4f9e", "sights"],
    tower: ["Tower", "🗼", "tower", "#3b4048", "sights"], landmark: ["Landmark", "📍", "star5", "#b02a2a", "sights"], museum: ["Museum", "🏛️", "temple", "#17608a", "sights"],
    viewpoint: ["Viewpoint", "🔭", "viewer", "#2b4f5e", "sights"], waterfall: ["Waterfall", "💦", "waterfall", "#17608a", "nature"],
    beach: ["Beach", "🏖️", "beach", "#17608a", "nature"], lake: ["Lake", "🏞️", "mountainlake", "#1f4f9e", "nature"], island: ["Island", "🏝️", "palm", "#2b7340", "nature"],
    peak: ["Mountain", "⛰️", "peaks", "#4a6a24", "nature"], cave: ["Cave", "🦇", "cave", "#3b4048", "nature"], garden: ["Garden", "🌷", "tulip", "#2b7340", "nature"],
    trail: ["Trail", "🥾", "boot", "#5b4a2f", "nature"], park: ["Park", "🌳", "pine", "#2f5d3a", "nature"], canyon: ["Canyon", "🏜️", "canyon", "#8a4a17", "nature"],
    glacier: ["Glacier", "🧊", "peaks", "#17608a", "nature"], geyser: ["Geyser", "♨️", "geyser", "#2b4f5e", "nature"],
    zoo: ["Zoo", "🦒", "giraffe", "#8a4a17", "fun"], aquarium: ["Aquarium", "🐠", "fish", "#17608a", "fun"], themepark: ["Theme park", "🎡", "ferris", "#962043", "fun"],
    waterpark: ["Water park", "🌊", "wave", "#1f4f9e", "fun"], playground: ["Playground", "🛝", "swing", "#b02a2a", "fun"],
    distillery: ["Distillery", "🥃", "still", "#8a4a17", "drinks"], brewery: ["Brewery", "🍺", "mug", "#6c3a1f", "drinks"], winery: ["Winery", "🍇", "grapes", "#83388a", "drinks"],
    pub: ["Pub", "🍺", "pint", "#6c3a1f", "drinks"], lighthouse: ["Lighthouse", "🚨", "lighthouse", "#b02a2a", "sights"],
    ferry: ["Ferry port", "⛴️", "ship", "#1f4f9e", "getting"], station: ["Train station", "🚉", "train", "#3b4048", "getting"], drive: ["Scenic drive", "🛣️", "road", "#4a6a24", "getting"],
    stadium: ["Stadium", "🏟️", "stadium", "#2b7340", "fun"], film: ["Film location", "🎬", "clapper", "#23262c", "sights"], bridge: ["Bridge", "🌉", "bridge", "#2b4f5e", "sights"],
    pin: ["Pinned place", "📍", "pin", "#b02a2a", "sights"],
    // v94: places of worship (each its own stamp; they count like every sight) and more of the world's sights
    mosque: ["Mosque", "🕌", "mosque", "#17608a", "worship"], church: ["Church", "⛪", "church", "#3b4048", "worship"], basilica: ["Basilica", "⛪", "basilica", "#5f35a0", "worship"],
    synagogue: ["Synagogue", "🕍", "synagogue", "#1f4f9e", "worship"], shrine: ["Shrine", "⛩️", "torii", "#b02a2a", "worship"], monastery: ["Monastery", "🔔", "bell", "#5b4a2f", "worship"],
    pagoda: ["Pagoda", "🏯", "pagoda", "#962043", "worship"], stupa: ["Stupa", "🪷", "stupa", "#8a4a17", "worship"], gurdwara: ["Gurdwara", "🪯", "gurdwara", "#c26a00", "worship"],
    cistern: ["Cistern", "🏛️", "cistern", "#17608a", "sights"], market: ["Market or bazaar", "🛍️", "market", "#962043", "sights"], square: ["Square", "⛲", "square", "#2b4f5e", "sights"],
    fort: ["Fort", "🏯", "fort", "#6b3a2a", "sights"], oldtown: ["Old town", "🏘️", "oldtown", "#8a4a17", "sights"], street: ["Famous street", "🪧", "street", "#3b4048", "sights"],
    tomb: ["Mausoleum", "🕌", "tomb", "#5f35a0", "sights"], amphitheater: ["Amphitheater", "🏟️", "amphi", "#8a4a17", "sights"], onsen: ["Hot spring", "♨️", "onsen", "#b02a2a", "nature"],
    deck: ["Observation deck", "🔭", "deck", "#2b4f5e", "sights"],
    // v100: volcanoes, ski resorts, campgrounds, universities, airports and cruise ports
    volcano: ["Volcano", "🌋", "volcano", "#b02a2a", "nature"], ski: ["Ski resort", "⛷️", "ski", "#17608a", "fun"], campground: ["Campground", "🏕️", "tent", "#2f5d3a", "nature"],
    university: ["University", "🎓", "mortarboard", "#5f35a0", "sights"], airport: ["Airport", "✈️", "plane", "#1f4f9e", "getting"], cruise: ["Cruise port", "🛳️", "ship", "#17608a", "getting"]
  };
  function typeOf(t) { var x = TYPES[t] || TYPES.landmark; return { id: TYPES[t] ? t : "landmark", label: x[0], emoji: x[1], motif: x[2], ink: x[3], group: x[4] }; }


  // ---------- countries: hand tuned for the most visited, the rest made from the code ----------
  // code: shape, border, ink (palette key or index), motif, font, label
  var COUNTRY = {
    ENG: "shield|double|red|rose|serif|ARRIVAL", SCT: "octagon|toothed|violet|thistle|slab|WELCOME", WLS: "arch|dashed|green|dragon|sans|CROESO",
    NIR: "hexagon|dotted|blue|columns|cond|ENTRY", IRL: "circle|toothed|green|shamrock|serif|FÁILTE", GBR: "rect|double|blue|clock|mono|ARRIVED",
    VAT: "circle|double|brown|lm_Q12512|serif|ENTRATA", // v115: Vatican City: St Peter's dome (drawn in landmark-art.js)
    FRA: "oval|dashed|blue|c_eiffel|serif|ENTRÉE", CAN: "rect|toothed|red|maple|sans|WELCOME", JPN: "circle|solid|red|fuji|cond|ARRIVAL",
    MEX: "double|dotted|green|cactus|slab|BIENVENIDO", ITA: "shield|solid|green|arches|serif|ARRIVO", ESP: "cancel|dashed|red|c_sagrada|slab|LLEGADA",
    DEU: "hexagon|double|black|c_brandenburg|cond|EINREISE", NLD: "octagon|solid|brown|windmill|sans|AANKOMST", GRC: "rect|dotted|blue|temple|serif|ARRIVAL",
    PRT: "arch|double|brown|ship|slab|CHEGADA", CHE: "triangle|solid|red|peaks|sans|ENTRY", AUT: "shield|dotted|red|edelweiss|serif|ANKUNFT",
    BEL: "cancel|solid|black|c_atomium|mono|ARRIVÉE", DNK: "oval|solid|red|c_nyhavn|cond|ANKOMST", NOR: "triangle|toothed|blue|mountainlake|slab|ANKOMST",
    SWE: "circle|dashed|blue|horse|cond|ANKOMST", ISL: "hexagon|toothed|blue|geyser|sans|ARRIVAL", USA: "shield|double|blue|x_lib|slab|ADMITTED",
    AUS: "oval|toothed|brown|kangaroo|sans|ARRIVED", NZL: "circle|double|black|kiwi|cond|ARRIVAL", CHN: "rect|double|red|c_greatwall|serif|ENTRY",
    IND: "octagon|dotted|brown|c_tajmahal|slab|ARRIVAL", THA: "arch|toothed|violet|lotus|serif|ARRIVAL", EGY: "triangle|double|brown|pyramid|slab|ARRIVAL",
    MAR: "arch|dotted|red|c_koutoubia|serif|ARRIVÉE", ZAF: "hexagon|solid|green|acacia|sans|ADMITTED", KEN: "oval|dotted|brown|giraffe|cond|ENTRY",
    BRA: "double|toothed|green|parrot|sans|CHEGADA", ARG: "circle|dotted|blue|c_obelisco|serif|ENTRADA", PER: "shield|toothed|brown|llama|slab|ENTRADA",
    CHL: "rect|dashed|blue|volcano|cond|ENTRADA", TUR: "oval|double|red|balloon|serif|GİRİŞ", CRI: "cancel|dotted|green|parrot|cond|ENTRADA",
    BHS: "circle|dashed|blue|c_bahamas|sans|WELCOME", JAM: "octagon|dashed|green|palm|slab|WELCOME", ISR: "hexagon|dashed|blue|olive|serif|ENTRY",
    KOR: "rect|solid|blue|gate|cond|ARRIVAL", VNM: "cancel|double|red|lotus|serif|ARRIVAL", SGP: "oval|solid|violet|c_marinabay|cond|ARRIVED",
    CUB: "arch|solid|blue|palm|slab|ENTRADA", DOM: "triangle|dotted|blue|palm|sans|ENTRADA", PHL: "shield|dashed|blue|volcano|cond|ARRIVAL",
    IDN: "octagon|double|red|volcano|serif|ARRIVAL", POL: "rect|toothed|red|tower|serif|PRZYJAZD", CZE: "arch|dashed|blue|clock|cond|PŘÍJEZD",
    HRV: "cancel|toothed|blue|c_dubrovnik|sans|DOLAZAK", HUN: "circle|double|green|c_parliament|serif|ÉRKEZÉS", FIN: "oval|dotted|blue|pine|cond|SAAPUMINEN"
  };
  var GENERIC = ["sun", "star", "peaks", "wave", "palm", "leaf", "hills", "compass", "plane", "pine", "mountainlake", "olive", "volcano", "dunes", "sequoia"];
  var PARK_WORDS = [[/arch|bridge/i, "rockarch"], [/canyon|bend|badland|capitol|bryce/i, "canyon"], [/volcan|lassen|haleakal/i, "volcano"], [/yellowstone|geyser/i, "geyser"],
    [/sequoia|redwood|congaree|kings/i, "sequoia"], [/cave|carlsbad|cavern|wind cave/i, "cave"], [/sand|dune/i, "dunes"], [/saguaro|joshua|cactus/i, "cactus"],
    [/yosemite|falls|cuyahoga/i, "waterfall"], [/everglades|biscayne|dry tortugas|virgin islands|channel|acadia|isle|bay|key/i, "wave"],
    [/bison|theodore|roosevelt|wind/i, "bison"], [/denali|katmai|kenai|kobuk|wrangell|lake clark|gates/i, "bear"], [/crater|lake|glacier|teton|rainier|olympic|north cascades/i, "mountainlake"],
    [/smoky|shenandoah|blue ridge|hot springs|gateway|new river/i, "hills"], [/rocky|great basin|mountain/i, "peaks"]];

  // Every national park gets its own picture (something you'd actually see there) and its own frame: shape, border and ink
  // come from the park's place in this list, so no two of the 64 stamps look alike. Our own drawings, never park or agency emblems.
  var PARK_ART = [["acadia", "np_acadia"], ["american-samoa", "np_samoa"], ["arches", "np_arches"], ["badlands", "np_badlands"], ["big-bend", "np_bigbend"],
    ["biscayne", "np_biscayne"], ["black-canyon-of-the-gunnison", "np_blackcanyon"], ["bryce-canyon", "np_bryce"], ["canyonlands", "np_canyonlands"], ["capitol-reef", "np_capitolreef"],
    ["carlsbad-caverns", "np_carlsbad"], ["channel-islands", "np_channel"], ["chiricahua", "np_chiricahua"], ["congaree", "np_congaree"], ["crater-lake", "np_craterlake"],
    ["cuyahoga-valley", "np_cuyahoga"], ["death-valley", "np_deathvalley"], ["denali", "np_denali"], ["dry-tortugas", "np_drytortugas"], ["everglades", "np_everglades"],
    ["gates-of-the-arctic", "np_gates"], ["gateway-arch", "np_gateway"], ["glacier", "np_glacier"], ["glacier-bay", "np_glacierbay"], ["grand-canyon", "np_grandcanyon"],
    ["grand-teton", "np_teton"], ["great-basin", "np_greatbasin"], ["great-sand-dunes", "np_sanddunes"], ["great-smoky-mountains", "np_smoky"], ["guadalupe-mountains", "np_guadalupe"],
    ["haleakala", "np_haleakala"], ["hawaii-volcanoes", "np_hawaii"], ["hot-springs", "np_hotsprings"], ["indiana-dunes", "np_indianadunes"], ["isle-royale", "np_isleroyale"],
    ["joshua-tree", "np_joshua"], ["katmai", "np_katmai"], ["kenai-fjords", "np_kenai"], ["kings-canyon", "np_kings"], ["kobuk-valley", "np_kobuk"],
    ["lake-clark", "np_lakeclark"], ["lassen-volcanic", "np_lassen"], ["mammoth-cave", "np_mammoth"], ["mesa-verde", "np_mesaverde"], ["mount-rainier", "np_rainier"],
    ["new-river-gorge", "np_newriver"], ["north-cascades", "np_northcascades"], ["olympic", "np_olympic"], ["petrified-forest", "np_petrified"], ["pinnacles", "np_pinnacles"],
    ["redwood", "np_redwood"], ["rocky-mountain", "np_rocky"], ["saguaro", "np_saguaro"], ["sequoia", "np_sequoia"], ["shenandoah", "np_shenandoah"],
    ["theodore-roosevelt", "np_roosevelt"], ["virgin-islands", "np_virginislands"], ["voyageurs", "np_voyageurs"], ["white-sands", "np_whitesands"], ["wind-cave", "np_windcave"],
    ["wrangell-st-elias", "np_wrangell"], ["yellowstone", "np_yellowstone"], ["yosemite", "np_yosemite"], ["zion", "np_zion"]];
  var PARK_IX = {}; PARK_ART.forEach(function (a, i) { PARK_IX[a[0]] = i; });
  var PARK_SHAPES = ["circle", "double", "arch", "shield", "octagon", "cancel", "oval"], PARK_INKS = ["#5b4a2f", "#2f5d3a", "#6b3a2a", "#2b4f5e", "#4b5320", "#7a3b1d"];
  /** A known park's look by its list position: 7 shapes x 5 borders cover the first 35, and the ink tells #i from #i+35. */
  function parkLook(id) {
    var i = PARK_IX[id]; if (i == null) return null;
    return { shape: "circle", border: i % 3 === 2 ? "toothed" : "solid", ink: PARK_INKS[i % 6], motif: PARK_ART[i][1] };
  }
  // State parks, national monuments and national memorials: a picture of something you'd see there (our own drawings).
  var MORE_ART = {"sp-custer":"bison","sp-niagara-falls":"waterfall","sp-letchworth":"waterfall","sp-watkins-glen":"waterfall","sp-valley-of-fire":"hoodoo","sp-anza-borrego-desert":"cactus","sp-julia-pfeiffer-burns":"waterfall","sp-humboldt-redwoods":"sequoia","sp-emerald-bay":"mountainlake","sp-starved-rock":"canyon","sp-dead-horse-point":"canyon","sp-goblin-valley":"hoodoo","sp-palo-duro-canyon":"canyon","sp-hocking-hills":"cave","sp-ichetucknee-springs":"turtle","sp-bahia-honda":"palm","sp-john-pennekamp-coral-reef":"wave","sp-blue-spring":"gator","sp-hunting-island":"lighthouse","sp-kartchner-caverns":"cave","sp-slide-rock":"canyon","sp-silver-falls":"waterfall","sp-smith-rock":"spires","sp-ecola":"wave","sp-deception-pass":"steelarch","sp-palouse-falls":"waterfall","sp-eldorado-canyon":"canyon","sp-petit-jean":"pine","sp-tallulah-gorge":"canyon","sp-providence-canyon":"canyon","sp-fall-creek-falls":"waterfall","sp-cumberland-falls":"waterfall","sp-blackwater-falls":"waterfall","sp-ricketts-glen":"waterfall","sp-ohiopyle":"waterfall","sp-baxter":"moose","sp-franconia-notch":"peaks","sp-cape-henlopen":"lighthouse","sp-assateague":"horse","sp-jockey-s-ridge":"dunes","sp-hanging-rock":"peaks","sp-chimney-rock":"spires","sp-gulf":"pelican","sp-itasca":"loon","sp-gooseberry-falls":"waterfall","sp-devil-s-lake":"mountainlake","sp-mackinac-island":"horse","sp-tahquamenon-falls":"waterfall","sp-indiana-dunes":"dunes","sp-turkey-run":"canyon","sp-ha-ha-tonka":"cave","sp-waimea-canyon":"canyon","sp-chugach":"bear","sp-natural-bridge":"rockarch","sp-gillette-castle":"tower","sp-liberty":"sun","sp-robbers-cave":"cave","sp-bruneau-dunes":"dunes","nm-statue-of-liberty":"sun","nm-devils-tower":"columns","nm-muir-woods":"sequoia","nm-canyon-de-chelly":"canyon","nm-natural-bridges":"rockarch","nm-dinosaur":"peaks","nm-craters-of-the-moon":"volcano","nm-sunset-crater-volcano":"volcano","nm-montezuma-castle":"canyon","nm-walnut-canyon":"canyon","nm-organ-pipe-cactus":"saguaro","nm-bandelier":"canyon","nm-el-morro":"hoodoo","nm-capulin-volcano":"volcano","nm-colorado":"spires","nm-florissant-fossil-beds":"sequoia","nm-cedar-breaks":"hoodoo","nm-timpanogos-cave":"cave","nm-rainbow-bridge":"rockarch","nm-jewel-cave":"cave","nm-lava-beds":"volcano","nm-cabrillo":"lighthouse","nm-devils-postpile":"columns","nm-oregon-caves":"cave","nm-little-bighorn-battlefield":"horse","nm-effigy-mounds":"hills","nm-castillo-de-san-marcos":"star","nm-fort-pulaski":"star","nm-fort-mchenry":"star","nm-scotts-bluff":"hoodoo","nm-stonewall":"star","nm-katahdin-woods-and-waters":"moose","mem-mount-rushmore":"peaks","mem-lincoln-memorial":"temple","mem-jefferson-memorial":"dome","mem-washington-monument":"obelisk","mem-vietnam-veterans-memorial":"rose","mem-korean-war-veterans-memorial":"pine","mem-world-war-ii-memorial":"arches","mem-mlk-jr-memorial":"peaks","mem-fdr-memorial":"waterfall","mem-flight-93":"hills","mem-pearl-harbor":"ship","mem-wright-brothers":"plane","mem-de-soto":"ship","mem-fort-caroline":"star","mem-chamizal":"sun","mem-coronado":"peaks","mem-perry-s-victory":"ship","mem-federal-hall":"temple","mem-general-grant":"dome","mem-johnstown-flood":"wave","mem-lincoln-boyhood":"leaf","mem-arkansas-post":"star"};
  var PARK_GEN = ["pine", "peaks", "mountainlake", "sequoia", "hills", "bear", "deer", "elk", "waterfall"];

  function pick(list, h) { return list[h % list.length]; }
  function inkOf(k, h) { return INKS[k] ? INKS[k][h & 1] : INK_LIST[h % INK_LIST.length]; }
  var STATE_ORDER = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
  var MODES = ["bird", "flower", "animal"];
  function stateMode(id, art) { return art === "bird" || art === "flower" || art === "animal" ? art : MODES[hash("mix:" + id) % 3]; }

  /** How a place's stamp looks. kind = "place" (country or UK nation), "state" or "park". art = bird|flower|animal|mix (states). */
  function design(kind, area, name, art, sx) {
    var h = hash(kind + ":" + area), h2 = hash(area + "#2"), d;
    if (kind === "state") {
      var i = STATE_ORDER.indexOf(area); if (i < 0) i = h % 51;
      var mode = stateMode(area, art), sym = SYM && SYM.DATA[area] ? SYM.DATA[area][mode] : null, m = MODES.indexOf(mode);
      d = { shape: SHAPES[(i * 3 + m) % SHAPES.length], border: BORDERS[(i + m * 2) % BORDERS.length], ink: INK_LIST[(i * 5 + m * 3) % INK_LIST.length],
            motif: sym && G[sym.glyph] ? sym.glyph : "star", pose: (i + m) % 3, flip: ((i >> 1) + m) % 2 === 1, font: FONT_KEYS[(i * 2 + m) % FONT_KEYS.length],
            label: "", symbol: sym ? sym.name.toUpperCase() : "", mode: mode };
    } else if (kind === "park") {
      var pl = parkLook(area);
      if (pl) d = { shape: pl.shape, border: pl.border, ink: pl.ink, motif: pl.motif, pose: h % 3, flip: false, font: pick(["slab", "serif", "cond"], h >>> 9), label: "NATIONAL PARK" };
      else { var mt = G["x_" + area] ? "x_" + area : G[MORE_ART[area]] ? MORE_ART[area] : ""; if (!mt) PARK_WORDS.some(function (w) { if (w[0].test(name || area)) { mt = w[1]; return true; } return false; });
      d = { shape: pick((name || "").length > 14 ? ["arch", "shield", "octagon"] : (name || "").length > 11 ? ["arch", "shield", "octagon", "oval"] : ["circle", "double", "arch", "shield", "octagon", "cancel", "oval"], h),   // long names only on frames with room to print them big
            border: pick(BORDERS, h2), ink: pick(["#5b4a2f", "#2f5d3a", "#6b3a2a", "#2b4f5e", "#4b5320", "#7a3b1d"], h >>> 4),
            motif: mt || pick(PARK_GEN, h >>> 7), pose: h % 3, flip: false, font: pick(["slab", "serif", "cond"], h >>> 9), label: /^sp-/.test(area) ? "STATE PARK" : /^nm-/.test(area) ? "NATIONAL MONUMENT" : /^mem-/.test(area) ? "NATIONAL MEMORIAL" : "NATIONAL PARK" }; }
    } else if (kind === "sight") {
      // v79: a sight's stamp shows its type's picture (castle, ruin, viewpoint...); a famous landmark with its own drawing shows that
      var ty = typeOf(sx && sx.type), lm = sx && sx.ref && G["lm_" + sx.ref] ? "lm_" + sx.ref : "";
      // v115: a stop saved without its Wikidata id: its exact name + country (from the stamp's area) can still find the drawing; never for pubs, food or stays
      if (!lm && sx && !sx.ref && API.LM_NAMES && !/^(pub|distillery|brewery|winery|station|airport|ferry|cruise|market|street|pin|playground|university|ski|campground|onsen)$/.test(ty.id)) { var lq = API.LM_NAMES[String(area || "").replace(/^[a-z]+-/, "")]; if (lq && G["lm_" + lq]) lm = "lm_" + lq; }
      d = { shape: "circle", border: lm ? "double" : pick(BORDERS, h2), ink: lm === "lm_Q44440" ? "#b0412e" /* v117: Golden Gate in International Orange */ : lm && (ty.ink === "#23262c" || ty.ink === "#3b4048") ? "#34507a" : ty.ink /* v115: near-black inks vanish on dark paper; a drawn landmark gets slate blue */, motif: lm || ty.motif, pose: h % 3, flip: false, font: "serif", label: ty.label.toUpperCase(), type: ty.id, landmark: !!lm };
    } else if (kind === "region") {
      // v110: a province / state of Canada, Australia, Mexico or Germany: its country's look, labelled PROVINCE / STATE
      var rc = COUNTRY[String(area).split(".")[0]], RL = { CAN: "PROVINCE", AUS: "STATE", MEX: "ESTADO", DEU: "LAND" }[String(area).split(".")[0]] || "REGION";
      if (rc) { rc = rc.split("|"); d = { shape: pick(SHAPES, h), border: rc[1], ink: inkOf(rc[2], h), motif: rc[3], font: rc[4], label: RL, pose: h % 3, flip: false }; }
      else d = { shape: pick(SHAPES, h), border: pick(BORDERS, h2), ink: INK_LIST[(h >>> 5) % INK_LIST.length], motif: pick(GENERIC, h2 >>> 3), font: pick(FONT_KEYS, h >>> 11), label: RL, pose: h % 3, flip: false };
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
    var main = border === "dashed" ? ' stroke-dasharray="9 5"' : border === "dotted" ? ' stroke-dasharray="0.1 6.4" stroke-linecap="round" stroke-width="4.4"' : border === "toothed" ? ' stroke-dasharray="2.6 2.6" stroke-width="6.5"' : "";
    var s = '<path d="' + o.d + '"' + main + '/>';
    if (border === "double") s += inset(o.d, 0.9, o.cx).replace("<path", '<path stroke-width="1.6"');
    if (border === "toothed" || border === "dotted") s += inset(o.d, 0.92, o.cx).replace("<path", '<path stroke-width="1.6"');
    if (o.inner) s += '<path d="' + o.inner + '" stroke-width="1.8"/>';
    if (o.waves) for (var i = 0; i < 5; i++) { var y = 56 + i * 12; s += '<path d="M120,' + y + ' q6,-5 12,0 t12,0 t12,0 t2,0" stroke-width="2.4"/>'; }
    return s;
  }
  // text ink: the stamp's own color, a shade darker, so names and dates clear WCAG AA on the cream page
  function deep(hex, k) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return hex;
    var n = parseInt(m[1], 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * (1 - k)); });
    return "#" + c.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16); }).join("");
  }
  function width(t, fs, font) { return t.length * fs * (font === "mono" ? 0.62 : font === "sans" ? 0.68 : font === "cond" ? 0.48 : 0.6); }
  function line(t, x, y, fs, font, max, extra) {
    if (!t) return "";
    var w = width(t, fs, font), fit = "";
    if (w > max) { var nf = Math.max(8, fs * max / w); if (width(t, nf, font) > max) fit = ' textLength="' + Math.round(max) + '" lengthAdjust="spacingAndGlyphs"'; fs = nf; }
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

  // ---------- park stamps: one round, engraved-cancel layout for every park, monument and state park ----------
  // Name in big bold letters around the top, "UT · NATIONAL PARK" around the bottom, the picture in a round window,
  // the date on a plate across the bottom of the window. Same frame for all, so the pictures do the talking.
  function arcPath(id, r, a0, a1, sweep) { var p = function (a) { var t = a * Math.PI / 180; return (80 + r * Math.cos(t)).toFixed(2) + "," + (80 + r * Math.sin(t)).toFixed(2); };
    return '<path id="' + id + '" d="M' + p(a0) + " A" + r + "," + r + " 0 1 " + sweep + " " + p(a1) + '"/>'; }
  function pstar(a, r) { var t = a * Math.PI / 180, x = 80 + r * Math.cos(t), y = 80 + r * Math.sin(t), s = "";
    for (var i = 0; i < 10; i++) { var b = (i * 36 - 90) * Math.PI / 180, q = i % 2 ? 1.7 : 4.2; s += (i ? " L" : "M") + (x + q * Math.cos(b)).toFixed(2) + " " + (y + q * Math.sin(b)).toFixed(2); } return '<path d="' + s + 'Z"/>'; }
  function parkSVG(s, text, d, opts) {
    var ink = d.ink, uid = "pk" + (hash((s.id || "") + s.area) % 1e8), SER = FONTS.serif;
    var NAME = String(text.name || s.area).toUpperCase(), date = String(text.date || "") + (s.kind !== "park" && text.end && text.end !== text.date ? " – " + text.end : ""), BOT = String(s.kind === "state" ? d.symbol || "" : s.kind === "park" || s.kind === "sight" ? text.sub || d.label || "" : d.label || "").toUpperCase();
    var RT = 56.5, RB = 66.6, RW = 51;
    // top name: as big as fits in ~236 degrees, never bigger than 17
    var m = BOT.length, bf = Math.min(10.4, RB * 1.75 / (m * 0.7 || 1)), bw = m * bf * 0.7, ba = bw / (RB - bf * 0.36) * 180 / Math.PI, tmax = Math.min(RT * 4.1, (322 - ba) * Math.PI / 180 * RT);
    var n = NAME.length, nf = Math.min(17, tmax / (n * 0.74 + 0.6)), nw = Math.min(tmax, n * nf * 0.74 + (n < 9 ? (n - 1) * 1.8 : 0)), na = nw / RT * 180 / Math.PI;
    var bd = d.border, out = bd === "toothed" ? '<circle cx="80" cy="80" r="76.5" stroke-width="5.4" stroke-dasharray="2.4 2.6"/><circle cx="80" cy="80" r="72" stroke-width="1.6"/>'
      : bd === "dashed" ? '<circle cx="80" cy="80" r="76" stroke-width="3" stroke-dasharray="7 3.4"/><circle cx="80" cy="80" r="71.6" stroke-width="1.2"/>'
      : bd === "dotted" ? '<circle cx="80" cy="80" r="76" stroke-width="3.6" stroke-dasharray="0.1 5" stroke-linecap="round"/><circle cx="80" cy="80" r="72" stroke-width="1.4"/>'
      : bd === "double" ? '<circle cx="80" cy="80" r="76.4" stroke-width="2"/><circle cx="80" cy="80" r="73.4" stroke-width="2"/><circle cx="80" cy="80" r="70.6" stroke-width=".9"/>'
      : '<circle cx="80" cy="80" r="76" stroke-width="3.4"/><circle cx="80" cy="80" r="71.6" stroke-width="1.2"/>';
    var g = '<g fill="none" stroke="' + ink + '">' + out + '<circle cx="80" cy="80" r="' + RW + '" stroke-width="1.8"/></g>';
    // the gaps between the name and the bottom line get a small star each
    var lg = ((270 - na / 2) + (90 + ba / 2)) / 2, rg = ((270 + na / 2) + (450 - ba / 2)) / 2, gap = (270 - na / 2) - (90 + ba / 2);
    var st = gap > 16 ? pstar(lg, 62) + pstar(rg, 62) : "";
    var art = G[d.motif] ? (d.flip && !/^(np|x|c|lm)_/.test(d.motif) ? '<g transform="matrix(-1 0 0 1 40 0)">' + G[d.motif](d.pose) + "</g>" : G[d.motif](d.pose)) : "", np = /^(np|x)_/.test(d.motif), sc = np ? 2.6 : 2.1, gx = np ? 28 : 38, gy = np ? (date ? 22 : 26) : (date ? 20 : 28);
    var body = '<defs><clipPath id="' + uid + 'c"><circle cx="80" cy="80" r="' + (RW - 0.9) + '"/></clipPath></defs><g clip-path="url(#' + uid + 'c)"><g class="motif" transform="translate(' + gx + " " + gy + ") scale(" + sc + ')">' + art + "</g></g>";
    var plate = "";
    if (date) { var df = Math.min(12.4, 76 / (date.length * 0.62)), pw = Math.min(90, Math.max(62, date.length * df * 0.62 + 14));
      plate = '<rect x="' + (80 - pw / 2).toFixed(1) + '" y="103" width="' + pw.toFixed(1) + '" height="18" rx="1.5" fill="#fff" stroke="' + ink + '" stroke-width="2"/>' +
        '<rect x="' + (80 - pw / 2 + 2.6).toFixed(1) + '" y="105.4" width="' + (pw - 5.2).toFixed(1) + '" height="13.2" fill="none" stroke="' + ink + '" stroke-width=".8"/>'; }
    var txt = "<defs>" + arcPath(uid + "t", RT, 270 - 150, 270 + 150, 1) + arcPath(uid + "b", RB, 90 + 140, 90 - 140, 0) + "</defs>" +
      '<text font-size="' + nf.toFixed(1) + '" font-family="' + SER + '"><textPath href="#' + uid + 't" startOffset="50%" textLength="' + nw.toFixed(1) + '" lengthAdjust="spacingAndGlyphs">' + esc(NAME) + "</textPath></text>" +
      (BOT ? '<text font-size="' + bf.toFixed(1) + '" font-family="' + SER + '"><textPath href="#' + uid + 'b" startOffset="50%" textLength="' + bw.toFixed(1) + '" lengthAdjust="spacingAndGlyphs">' + esc(BOT) + "</textPath></text>" : "") +
      (date ? '<text x="80" y="' + (112 + df * 0.36).toFixed(1) + '" font-size="' + df.toFixed(1) + '" font-family="' + FONTS.mono + '" font-weight="800" stroke="none">' + esc(date) + "</text>" : "");
    var aria = (text.name || s.area) + (s.kind === "state" && d.symbol ? ", state " + d.mode + ": " + d.symbol.toLowerCase() : "") + (date ? ", " + date : "");
    return '<svg class="stampsvg" viewBox="0 0 160 160" role="img" aria-label="' + esc(aria) + '" data-look="' + esc(["circle", d.border, d.ink, d.motif, "serif", "", d.pose].join(" ")) + '">' +
      '<g filter="url(#inkrough)" opacity=".92" color="' + ink + '"><g fill="' + ink + '" stroke="' + ink + '" stroke-width="0">' + body + st + "</g>" + g + "</g>" +
      '<g filter="url(#inkrough)" opacity=".95">' + plate.replace(/fill="#fff"/, 'fill="#fbf6ea"') + "</g>" +
      '<g class="stxt" fill="' + deep(ink, 0.25) + '" font-weight="800" text-anchor="middle" stroke="#fbf6ea" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke">' + txt + "</g></svg>";
  }
  /** The stamp as SVG. s = {kind, area, id, via}; text = {name, date, end, sub} already formatted (empty date = nothing shown);
      opts = {art: bird|flower|animal|mix, flag}. */
  function stampSVG(s, text, opts) {
    opts = opts || {}; text = text || {};
    var d = design(s.kind, s.area, text.name, opts.art, s);
    return parkSVG(s, text, d, opts);
  }

  var API = { stampSVG: stampSVG, design: design, TYPES: TYPES, typeOf: typeOf, SYM: SYM, GLYPHS: G, COUNTRY: COUNTRY, SHAPES: SHAPES, BORDERS: BORDERS, INKS: INKS, INK_LIST: INK_LIST, FONTS: FONTS, MODES: MODES, stateMode: stateMode, hash: hash, PARK_ART: PARK_ART, parkLook: parkLook, LM_NAMES: {} };
  return API;
});
