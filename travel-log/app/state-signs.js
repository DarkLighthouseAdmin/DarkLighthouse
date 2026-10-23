/* Famstamp State Signs: a collectible "Welcome to ..." roadside sign for every state (and DC), drawn as SVG from the
   compact table below. Every design is our own: a made-up palette, a simple nature or landmark motif, and a sign shape.
   None of it copies a real state's welcome sign, seal, logo or trademark. No browser parts, so it runs in Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WK_SIGNS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // id: nickname | shape | style | scene | motif | sky top, sky bottom, far land, near land, panel, panel text, accent
  var TABLE = {
    AL: "The Yellowhammer State|shield|enamel|hills|rocket|#8fd3f4,#fdf1c7,#6fae5a,#3f7a3a,#7a1f2b,#fff6e5,#f2c14e",
    AK: "The Last Frontier|arch|enamel|peaks|aurora|#0b1d3a,#2a5a7a,#cfe0ec,#8fb0c6,#12305a,#ffffff,#5ef0b0",
    AZ: "The Grand Canyon State|rect|wood|desert|cactus|#ff9f5a,#ffe2a8,#d0683a,#9a4422,#7a2e1a,#fff3e0,#ffd23f",
    AR: "The Natural State|oval|wood|hills|duck|#a6dcef,#eaf7e9,#5a9a52,#2f6b3a,#1f4f3a,#f6f0dc,#f2b134",
    CA: "The Golden State|arch|retro|sea|sunset|#ff8f5a,#ffd36e,#2a8bb5,#1b5f8a,#9c3a14,#ffffff,#ffd23f",
    CO: "The Centennial State|rect|enamel|peaks|snowflake|#4f9be0,#d6ecff,#7d8fb3,#3d5a80,#1d3f6e,#ffffff,#f5c542",
    CT: "The Constitution State|shield|wood|hills|oak|#bfe3f2,#f1f8ee,#79ad66,#3e7a3e,#1b3a6b,#fff7e6,#c9a227",
    DE: "The First State|ticket|enamel|sea|umbrella|#9fd8ff,#fff4d6,#3b9cc4,#e9d29a,#19456b,#ffffff,#e8473a",
    FL: "The Sunshine State|arch|retro|sea|palm|#ff7e5f,#feb47b,#0f9fb5,#0a6f86,#0c5566,#ffffff,#ffde59",
    GA: "The Peach State|oval|enamel|hills|peach|#ffd1b3,#fff3e0,#86ba60,#4e8a3c,#8a3b1f,#fff6ea,#ff9a62",
    HI: "The Aloha State|arch|wood|sea|volcano|#7fd4f5,#fff0c9,#1aa6b7,#0c7489,#0b5458,#ffffff,#ff6f91",
    ID: "The Gem State|shield|enamel|peaks|gem|#8ec9f0,#e9f6ff,#6f90a8,#355f73,#3a2f6b,#ffffff,#b388ff",
    IL: "The Prairie State|rect|enamel|plains|tophat|#8fc1e3,#e8f3fa,#8ab655,#557f33,#1c3d6e,#ffffff,#e8b04a",
    IN: "The Hoosier State|ticket|retro|plains|flag|#9bd0f0,#f2f9ff,#9cbd55,#5e8a2e,#9a1f1e,#ffffff,#f2c14e",
    IA: "The Hawkeye State|oval|wood|plains|corn|#a9dcf5,#fff7d6,#a6c65a,#6b9a35,#2f5a2a,#fff3d6,#f4c430",
    KS: "The Sunflower State|arch|enamel|plains|sunflower|#6fb7e9,#e5f4ff,#dcb850,#b08a2e,#4a3216,#ffe9a8,#f6c324",
    KY: "The Bluegrass State|rect|wood|hills|horse|#bfe0f7,#f3faf2,#6aa89a,#3b7a6c,#1e3f75,#ffffff,#c9a24a",
    LA: "The Pelican State|oval|retro|lake|pelican|#f9b57a,#fde7c4,#4c7a3d,#5f97a0,#4b2a6b,#ffffff,#f3c04f",
    ME: "The Pine Tree State|shield|wood|forest|lighthouse|#a7cbe8,#edf5fb,#3f7550,#1f4630,#1f3b57,#ffffff,#e9473a",
    MD: "The Old Line State|ticket|enamel|sea|crab|#a8dcf7,#f0faff,#2f7fb5,#1e5d8a,#12355e,#ffffff,#e2552d",
    MA: "The Bay State|rect|enamel|sea|sailboat|#9fd3f2,#eef8ff,#2a6f9e,#1a4e75,#23395d,#ffffff,#d94f3d",
    MI: "The Great Lakes State|arch|wood|lake|cherry|#9cd4f6,#eaf6ff,#4b8d5a,#2b7fb0,#0f3e66,#ffffff,#d7263d",
    MN: "The North Star State|oval|enamel|lake|loon|#5d97d0,#d7ebf8,#2b5d3a,#3a7fb0,#143d5a,#ffffff,#ffd447",
    MS: "The Magnolia State|shield|enamel|hills|magnolia|#f6d2c1,#fff6ec,#6aa866,#3e7a45,#2e4d2a,#fff7ea,#f4e9c8",
    MO: "The Show-Me State|arch|retro|city|gatearch|#ffb37a,#ffe6c2,#7a8aa3,#4c5f7a,#8a2331,#ffffff,#d9e1ea",
    MT: "The Treasure State|rect|wood|peaks|bear|#4f8fd6,#cfe6ff,#7c8a68,#3f5a3a,#3a2a1a,#ffe9c2,#e3b23c",
    NE: "The Cornhusker State|ticket|wood|plains|windmill|#9ed2f2,#fff4d8,#d0b450,#8fae4a,#7a1d1d,#ffffff,#f3d36b",
    NV: "The Silver State|oval|neon|desert|sparkle|#1b1036,#4a2a6b,#6c5a8a,#3d2f5a,#111827,#e6f7ff,#5ce1e6",
    NH: "The Granite State|shield|wood|peaks|moose|#a3cbe8,#f0f6fb,#97a6b1,#5d6f7c,#1f4a2f,#ffffff,#c4542f",
    NJ: "The Garden State|rect|enamel|hills|berries|#a7dbf5,#fff5e0,#66ab62,#3a7f45,#1e3a6b,#ffffff,#4a5fc1",
    NM: "Land of Enchantment|arch|retro|desert|balloon|#ff9e6b,#ffe1a6,#d07a45,#9a4a2a,#0d5f5f,#ffffff,#e8463a",
    NY: "The Empire State|ticket|retro|city|skyline|#ffb38a,#ffe9cf,#6a7a99,#2f3d57,#1d2d50,#ffffff,#ffd166",
    NC: "The Tar Heel State|oval|wood|sea|biplane|#8fd0f2,#fff4dc,#2a8fb8,#e6cf95,#123f6b,#ffffff,#e9473a",
    ND: "The Peace Garden State|rect|wood|plains|bison|#9fcff0,#fff2d3,#cdb45a,#8a9a45,#2b3d1e,#fff5dc,#e7b84a",
    OH: "The Buckeye State|shield|enamel|hills|buckeye|#bfe2f7,#f7fbef,#6fa858,#3f7a35,#8a1f2b,#ffffff,#d9b07a",
    OK: "The Sooner State|arch|wood|plains|cowhat|#ff9f68,#ffe2b5,#c86f3a,#7f8a3a,#3a2a6b,#ffffff,#e1a33a",
    OR: "The Beaver State|rect|wood|forest|beaver|#9fcbe8,#eef6f0,#3f7a55,#1f5038,#20402a,#fff6e3,#e0a24a",
    PA: "The Keystone State|shield|enamel|hills|keystone|#a8d4f0,#f2f8ff,#5e9a58,#2f6a35,#1c3466,#ffffff,#d6a636",
    RI: "The Ocean State|oval|enamel|sea|anchor|#9fd8f5,#effaff,#2378a8,#145a85,#0f3557,#ffffff,#e7b84a",
    SC: "The Palmetto State|arch|wood|sea|turtle|#ffc69a,#fff1dc,#2a9cb0,#e5cf9a,#1c2f63,#ffffff,#6fbf8a",
    SD: "The Mount Rushmore State|ticket|wood|desert|prairiedog|#9fd0f2,#fff0d2,#c9a27a,#9a7650,#3b2a1e,#ffeccc,#e0b062",
    TN: "The Volunteer State|rect|neon|hills|guitar|#2a1b4a,#6a3a7a,#46336b,#2a1d45,#150f2a,#ffe6f0,#ff5fa2",
    TX: "The Lone Star State|shield|wood|desert|star|#ffb36b,#ffe4b8,#cf8f48,#8f5a2a,#1f3a70,#ffffff,#d6243a",
    UT: "The Beehive State|arch|retro|desert|rockarch|#7ec4f0,#fde6c4,#d26a3a,#93361d,#5a1f12,#ffecd6,#f2b134",
    VT: "The Green Mountain State|shield|wood|hills|maple|#b5dcf2,#fff4e0,#4a9a55,#256b35,#1f4a2a,#ffffff,#d9541f",
    VA: "The Old Dominion|oval|enamel|hills|cardinal|#b8dff5,#f5fbf0,#7aa86a,#4f7fa0,#1b2f5a,#ffffff,#c8202e",
    WA: "The Evergreen State|rect|enamel|peaks|orca|#8cc8ee,#e8f5ff,#5f8fa6,#2a6a8a,#163d4f,#ffffff,#7fd1c7",
    WV: "The Mountain State|arch|wood|hills|canoe|#a9d6f2,#f3faef,#4f8a55,#2a5f3a,#1f3550,#ffffff,#e9a23b",
    WI: "The Badger State|oval|enamel|lake|cow|#9fd4f3,#effaff,#74b058,#3b8ab5,#7a1f2b,#ffffff,#f5d36b",
    WY: "The Equality State|ticket|wood|peaks|geyser|#7fb8e8,#e7f3ff,#85805c,#4a4a35,#3b2416,#ffe7c2,#bfe6ff",
    DC: "The Nation's Capital|shield|enamel|city|dome|#a9cdf0,#f3f7ff,#95a1b3,#5f6b80,#1d2f5a,#ffffff,#c9a227"
  };
  var DISPLAY = { DC: "Washington, D.C." };
  var SHAPES = {
    rect: "M20,8 H180 Q190,8 190,18 V108 Q190,118 180,118 H20 Q10,118 10,108 V18 Q10,8 20,8Z",
    arch: "M10,42 Q100,-16 190,42 V110 Q190,118 182,118 H18 Q10,118 10,110Z",
    shield: "M10,10 H190 V84 Q190,100 172,106 L100,121 L28,106 Q10,100 10,84Z",
    oval: "M8,63 A92,56 0 1 0 192,63 A92,56 0 1 0 8,63Z",
    ticket: "M24,8 H176 Q176,22 190,22 V104 Q176,104 176,118 H24 Q24,104 10,104 V22 Q24,22 24,8Z"
  };
  var NAME_ROOM = { rect: 164, arch: 164, shield: 148, oval: 128, ticket: 146 };
  var TIERS = [["bronze", "#7a4a1f", "#e6ae72"], ["silver", "#7d8996", "#f4f7fa"], ["gold", "#a87808", "#ffe98a"]];
  var MONO = { a: "#cdc5b4", d: "#bdb4a2", l: "#ddd6c8" };
  var uid = 0;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function look(id) {
    var row = TABLE[id]; if (!row) return null;
    var f = row.split("|"), c = f[5].split(",");
    return { id: id, nick: f[0], shape: f[1], style: f[2], scene: f[3], motif: f[4], sky: [c[0], c[1]], land: [c[2], c[3]], panel: c[4], text: c[5], accent: c[6] };
  }
  /** 1 visit bronze, 2-3 silver, 4 or more gold. */
  function tier(visits) { return visits >= 4 ? "gold" : visits >= 2 ? "silver" : "bronze"; }

  // ---------- colors for motifs: real ones, or all one soft grey for a sign still to collect ----------
  var REAL = { w: "#fffdf7", k: "#1c1c1f", br: "#7a4a22", dbr: "#4a2f1a", g: "#3f8a4a", dg: "#255c33", y: "#f6c324", o: "#f2994a", r: "#d7303a", gr: "#8a8f99", s: "#cfd6de", b: "#3a7fc0", p: "#ff8fa8", sand: "#e2c48a" };
  function colors(L, on) {
    var k = {}, key;
    if (on) { for (key in REAL) k[key] = REAL[key]; k.a = L.accent; k.d = L.panel; k.l = L.text; return k; }
    for (key in REAL) k[key] = MONO.a;
    k.w = MONO.l; k.l = MONO.l; k.a = MONO.a; k.d = MONO.d; k.k = MONO.d; k.dbr = MONO.d; k.dg = MONO.d;
    return k;
  }
  function ell(cx, cy, rx, ry, fill, extra) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (extra || "") + '/>'; }
  function circ(cx, cy, r, fill, extra) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"' + (extra || "") + '/>'; }
  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || "") + '/>'; }
  function line(d, stroke, w, extra) { return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") + '/>'; }
  function ring(n, fn) { var s = ""; for (var i = 0; i < n; i++) s += fn(i, 360 / n * i); return s; }

  // Each motif fits a 60 x 44 box sitting on the horizon. Simple shapes from nature and landmarks, drawn from scratch.
  var MOTIFS = {
    rocket: function (k) { return path("M30,1 C39,9 39,25 36,34 H24 C21,25 21,9 30,1Z", k.w, ' stroke="' + k.gr + '" stroke-width="1"') + circ(30, 15, 4, k.b, ' stroke="' + k.gr + '"') + path("M24,24 L16,36 L24,34Z M36,24 L44,36 L36,34Z", k.r) + path("M25,34 Q30,47 35,34Z", k.o) + path("M27,34 Q30,42 33,34Z", k.y); },
    aurora: function (k) { return line("M0,16 Q15,4 30,12 T60,8", k.a, 5, ' opacity=".85"') + line("M0,26 Q16,14 30,22 T60,18", "#9be7ff", 4, ' opacity=".6"') + line("M4,34 Q18,26 32,31 T60,28", "#c3a6ff", 3, ' opacity=".5"') + path("M48,0 L49.5,4 L54,4.5 L50.5,7 L51.5,11 L48,8.6 L44.5,11 L45.5,7 L42,4.5 L46.5,4Z", k.w); },
    cactus: function (k) { return circ(48, 8, 7, k.a) + line("M30,43 V8 M30,27 H21 V16 M30,31 H39 V19", k.dg, 10) + line("M30,43 V8 M30,27 H21 V16 M30,31 H39 V19", k.g, 7) + line("M28,12 V40", k.w, 0.8, ' opacity=".5"'); },
    duck: function (k) { return ell(28, 31, 17, 9, k.br) + path("M12,29 Q6,25 10,22 Q14,26 18,26Z", k.dbr) + path("M38,28 Q40,18 42,14 L48,16 Q46,22 44,30Z", k.dg) + circ(45, 14, 6, k.dg) + path("M50,13 L58,15 L50,18Z", k.y) + circ(46, 12, 1.2, k.k) + path("M38,24 Q43,22 46,24 L45,26 Q42,24 38,26Z", k.w) + line("M8,42 Q14,39 20,42 T32,42 T44,42 T56,42", k.w, 1.4, ' opacity=".8"'); },
    sunset: function (k) { return path("M6,40 A24,24 0 0 1 54,40Z", k.a) + '<path d="M8,30 H52 M6,35 H54" stroke="' + k.o + '" stroke-width="2.4"/>' + path("M0,40 Q8,35 15,40 T30,40 T45,40 T60,40 V44 H0Z", k.b) + line("M4,43 Q10,40 16,43", k.w, 1.2) + path("M42,30 Q44,20 48,14 L50,15 Q46,22 45,31Z", k.w, ' opacity=".9"'); },
    snowflake: function (k) { return '<g transform="translate(30,22)">' + ring(6, function (i, a) { return '<g transform="rotate(' + a + ')">' + line("M0,0 V-19 M0,-12 L-5,-16 M0,-12 L5,-16 M0,-6 L-4,-9 M0,-6 L4,-9", k.w, 2.4) + '</g>'; }) + circ(0, 0, 3, k.a) + '</g>'; },
    oak: function (k) { return path("M27,44 L28,26 Q24,24 22,20 L26,22 L29,20 L31,22 L35,20 Q34,24 32,26 L33,44Z", k.br) + circ(30, 14, 12, k.g) + circ(18, 20, 9, k.g) + circ(42, 20, 9, k.g) + circ(24, 10, 7, k.dg, ' opacity=".35"') + circ(38, 24, 2, k.dbr) + circ(20, 24, 2, k.dbr); },
    umbrella: function (k) { return line("M30,8 L34,43", k.br, 2) + path("M8,20 Q30,-6 52,20 Q46.5,16 41,20 Q35.5,16 30,20 Q24.5,16 19,20 Q13.5,16 8,20Z", k.a) + path("M24,17 Q26,5 30,3 Q34,5 36,17 Q33,16 30,20 Q27,16 24,17Z", k.w) + circ(13, 38, 6, k.w) + path("M13,32 A6,6 0 0 1 19,38 H13Z", k.r) + path("M7,38 A6,6 0 0 0 13,44 V38Z", k.b) + path("M40,44 Q44,36 52,38 L54,44Z", k.sand); },
    palm: function (k) { var leaf = "M0,0 Q11,-8 24,1 Q12,-3 0,0Z"; return circ(46, 12, 9, k.a, ' opacity=".95"') + line("M30,44 Q33,28 27,10", k.br, 4.5) + line("M28,40 L33,40 M29,32 L34,31 M29,24 L33,23 M28,17 L31,16", k.dbr, 1) +
        [-170, -135, -40, -5, 150, 200].map(function (a) { return '<path d="' + leaf + '" fill="' + k.g + '" transform="translate(27,10) rotate(' + a + ')"/>'; }).join("") + circ(25, 13, 2.4, k.dbr) + circ(29, 13, 2.4, k.dbr); },
    peach: function (k) { return circ(30, 27, 16, k.o) + circ(24, 21, 5, k.w, ' opacity=".35"') + line("M30,12 Q25,27 30,42", "#d9612e", 1.6) + path("M30,12 Q38,0 48,6 Q40,12 30,12Z", k.g) + line("M30,12 L29,6", k.br, 2); },
    volcano: function (k) { return circ(20, 6, 5, k.w, ' opacity=".7"') + circ(28, 3, 4, k.w, ' opacity=".6"') + path("M4,44 L23,14 H37 L56,44Z", "#6b4a3a") + path("M23,14 H37 L34,24 L31,18 L28,27 L25,19Z", "#ff6a3d") + path("M10,44 Q16,36 22,40 L26,44Z", k.g) + path("M42,44 Q46,34 52,38 L56,44Z", k.g) + '<g transform="translate(48,30)">' + ring(5, function (i, a) { return ell(0, -4, 2.6, 4, k.p, ' transform="rotate(' + a + ')"'); }) + circ(0, 0, 1.6, k.y) + '</g>'; },
    gem: function (k) { return path("M12,16 L22,5 H38 L48,16 L30,41Z", k.a, ' stroke="' + k.w + '" stroke-width="1"') + line("M12,16 H48 M22,5 L26,16 L30,41 M38,5 L34,16 L30,41 M26,16 L30,5 L34,16", k.w, 1, ' opacity=".75"') + path("M22,5 L26,16 H12Z", k.w, ' opacity=".35"') + path("M8,8 L9,11 L12,12 L9,13 L8,16 L7,13 L4,12 L7,11Z", k.w); },
    tophat: function (k) { return ell(30, 39, 22, 4.5, k.k) + path("M20,38 L21,6 Q30,3 39,6 L40,38Z", k.k) + path("M20.6,30 H39.4 V35 H20.6Z", k.a) + path("M23,9 L23.5,28", k.w, ' stroke="' + k.w + '" stroke-width="1.2" opacity=".25"'); },
    flag: function (k) { var s = ""; for (var r = 0; r < 4; r++) for (var c = 0; c < 6; c++) s += '<rect x="' + (15 + c * 6) + '" y="' + (4 + r * 6) + '" width="6" height="6" fill="' + ((r + c) % 2 ? k.k : k.w) + '"/>'; return line("M14,44 V2", k.gr, 2.6) + '<g transform="skewY(-8) translate(0,4)">' + s + '</g>' + circ(14, 2, 2, k.a); },
    corn: function (k) { var s = ""; for (var y = 8; y < 38; y += 4) for (var x = -2; x <= 2; x++) if (Math.abs(x) < 2 || (y > 12 && y < 34)) s += circ(30 + x * 3, y + (x % 2 ? 2 : 0), 1.5, "#e0a820"); return ell(30, 22, 8, 17, k.y) + s + path("M22,26 Q12,18 17,2 Q22,20 30,43Z", k.g) + path("M38,26 Q48,18 43,2 Q38,20 30,43Z", k.dg); },
    sunflower: function (k) { return line("M30,26 V44", k.g, 3) + path("M30,36 Q20,30 16,36 Q24,40 30,38Z", k.g) + '<g transform="translate(30,17)">' + ring(14, function (i, a) { return ell(0, -11, 3.4, 7, k.a, ' transform="rotate(' + a + ')"'); }) + circ(0, 0, 7, "#6b3e1a") + circ(-2, -2, 1, "#a0662f") + circ(2, 1, 1, "#a0662f") + circ(-1, 3, 1, "#a0662f") + '</g>'; },
    horse: function (k) { return path("M14,23 Q4,25 7,38 Q11,30 16,26Z", k.dbr) + ell(28, 24, 15, 7.5, k.br) + path("M37,22 L45,7 L52,10 L45,27Z", k.br) + path("M45,6 L56,11 L55,15 L47,13Z", k.br) + path("M44,7 L38,20 L41,21 L46,9Z", k.dbr) + line("M19,29 L17,43 M24,30 L25,43 M34,30 L33,43 M38,28 L42,42", k.br, 3.2) + circ(51, 10, 0.9, k.k); },
    pelican: function (k) { return path("M22,44 V36 H30 V44Z", k.br) + ell(26, 28, 13, 8.5, k.w, ' stroke="' + k.gr + '" stroke-width="1"') + path("M14,26 Q20,18 30,22 Q22,24 14,26Z", k.gr) + line("M34,24 Q42,20 40,10", k.w, 5) + circ(40, 9, 5, k.w) + path("M44,8 L58,15 L56,19 Q48,20 43,13Z", k.y) + circ(40, 8, 1, k.k) + line("M24,36 V44 M28,36 V44", k.o, 1.4); },
    lighthouse: function (k) { return path("M22,10 L30,7 L58,0 L58,14 L30,9Z M22,10 L2,0 L2,14Z", k.y, ' opacity=".45"') + path("M24,43 L27,11 H35 L38,43Z", k.w) + path("M25.4,26 L26.1,18 H35.9 L36.6,26Z M24.3,38 L24.9,32 H37.1 L37.7,38Z", k.r) + path("M26,5 H36 V11 H26Z", k.y) + path("M24,5 L31,-1 L38,5Z", k.r) + path("M14,44 Q20,38 30,41 Q40,38 48,44Z", k.gr); },
    crab: function (k) { return line("M18,30 L8,34 L6,40 M18,33 L10,38 M42,30 L52,34 L54,40 M42,33 L50,38 M20,24 L13,17 M40,24 L47,17", k.r, 2.4) + ell(30, 29, 14, 9, k.r) + path("M8,12 A6,6 0 1 1 18,14 L13,15Z", k.r) + path("M52,12 A6,6 0 1 0 42,14 L47,15Z", k.r) + line("M26,21 V16 M34,21 V16", k.r, 1.6) + circ(26, 15, 2.2, k.w) + circ(34, 15, 2.2, k.w) + circ(26, 15, 1, k.k) + circ(34, 15, 1, k.k) + path("M26,32 Q30,35 34,32", "none", ' stroke="' + k.k + '" stroke-width="1"'); },
    sailboat: function (k) { return line("M30,34 V3", k.br, 1.6) + path("M31.5,5 V32 H52Z", k.w) + path("M28.5,9 V32 H12Z", k.a) + path("M10,34 H50 L44,42 H16Z", k.d) + line("M4,43 Q10,40 16,43 T28,43 T40,43 T52,43", k.w, 1.2); },
    cherry: function (k) { return line("M22,24 Q25,10 34,5 M40,26 Q38,14 34,5", k.dg, 1.8) + path("M34,5 Q44,0 50,6 Q42,10 34,5Z", k.g) + circ(22, 32, 9, k.r) + circ(40, 34, 9, k.r) + circ(19, 29, 2.4, k.w, ' opacity=".6"') + circ(37, 31, 2.4, k.w, ' opacity=".6"'); },
    loon: function (k) { return ell(30, 39, 26, 3, k.w, ' opacity=".35"') + path("M6,31 Q14,21 33,23 Q43,23 45,16 Q47,9 53,11 L59,13 L53,15 Q52,24 46,29 Q36,37 12,35Z", k.k) + ring(9, function (i) { return circ(14 + i * 3.2, 27 + (i % 2), 0.9, k.w); }) + line("M44,19 L49,20 M44,22 L48,23", k.w, 1) + circ(52, 12.5, 1.2, k.r); },
    magnolia: function (k) { return path("M4,34 Q16,24 26,32 Q14,40 4,34Z M56,34 Q44,24 34,32 Q46,40 56,34Z", k.dg) + '<g transform="translate(30,22)">' + ring(6, function (i, a) { return ell(0, -11, 6, 12, k.w, ' stroke="#d8cfb8" stroke-width=".8" transform="rotate(' + (a + 30) + ')"'); }) + circ(0, 0, 4.5, "#c9b65a") + '</g>'; },
    gatearch: function (k) { return line("M6,44 Q30,-30 54,44", k.a, 5) + line("M12,44 Q30,-18 48,44", k.w, 1.2, ' opacity=".7"') + path("M0,44 H60 V42 H0Z", k.gr); },
    bear: function (k) { return path("M6,42 Q6,24 22,21 Q32,15 43,19 L49,17 Q57,18 57,25 L52,29 Q50,41 46,42 H41 V33 H30 L28,42 H22 L20,33 Q14,35 13,42Z", k.dbr) + circ(48, 16, 2.6, k.dbr) + circ(56, 24, 1.4, k.k) + circ(50, 21, 0.9, k.w); },
    windmill: function (k) { return path("M25,44 L28.5,14 H31.5 L35,44Z", k.gr) + line("M26,34 L34,24 M34,34 L26,24", k.s, 0.8) + '<g transform="translate(30,13)">' + ring(10, function (i, a) { return '<rect x="-1.6" y="-13" width="3.2" height="11" fill="' + k.w + '" transform="rotate(' + a + ')"/>'; }) + circ(0, 0, 2.4, k.a) + path("M2,0 L18,-3 L18,4Z", k.r) + '</g>'; },
    sparkle: function (k) { var st = function (x, y, r) { return path("M" + x + "," + (y - r) + " Q" + (x + r * .12) + "," + (y - r * .12) + " " + (x + r) + "," + y + " Q" + (x + r * .12) + "," + (y + r * .12) + " " + x + "," + (y + r) + " Q" + (x - r * .12) + "," + (y + r * .12) + " " + (x - r) + "," + y + " Q" + (x - r * .12) + "," + (y - r * .12) + " " + x + "," + (y - r) + "Z", k.a); };
      return st(30, 22, 19) + st(10, 10, 6) + st(50, 34, 7) + circ(30, 22, 3, k.w); },
    moose: function (k) { return path("M8,40 Q8,24 20,22 H40 Q45,16 50,19 L57,27 Q57,31 53,30 L48,28 Q46,34 44,40 H40 V32 H24 L22,40 H18 L17,32 Q14,34 13,40Z", k.br) + path("M44,18 Q38,14 37,6 L40,9 L41,4 L43,9 L45,5 L46,12Z M50,17 Q56,12 58,5 L55,8 L55,3 L52,8 L51,4 L49,12Z", k.dbr) + path("M50,28 Q52,34 49,35 Q48,31 48,28Z", k.dbr); },
    berries: function (k) { var b = function (x, y) { return circ(x, y, 7, k.a) + circ(x - 2, y - 2, 1.8, k.w, ' opacity=".5"') + path("M" + (x - 2) + "," + (y - 6) + " L" + x + "," + (y - 4) + " L" + (x + 2) + "," + (y - 6), "none", ' stroke="' + k.d + '" stroke-width="1"'); };
      return path("M10,14 Q22,2 32,10 Q20,16 10,14Z", k.g) + path("M50,12 Q38,4 30,12 Q40,18 50,12Z", k.dg) + b(22, 24) + b(38, 24) + b(30, 34) + b(16, 36) + b(44, 36); },
    balloon: function (k) { return path("M30,2 C45,2 49,17 40,28 L34,34 H26 L20,28 C11,17 15,2 30,2Z", k.a) + path("M30,2 C23,9 23,23 28,34 H32 C37,23 37,9 30,2Z", k.y) + path("M30,2 C27,9 27,23 29.5,34 H30.5 C33,23 33,9 30,2Z", k.w, ' opacity=".8"') + line("M26,34 L27,39 M34,34 L33,39", k.br, 0.9) + '<rect x="26" y="38" width="8" height="6" rx="1" fill="' + k.br + '"/>'; },
    skyline: function (k) { var w = ""; [[8, 20, 8], [17, 12, 7], [36, 16, 8], [45, 24, 9]].forEach(function (b) { w += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (44 - b[1]) + '" fill="' + k.d + '" opacity=".85"/>'; for (var y = b[1] + 3; y < 42; y += 5) w += '<rect x="' + (b[0] + 2) + '" y="' + y + '" width="' + (b[2] - 4) + '" height="1.6" fill="' + k.y + '" opacity=".75"/>'; });
      return w + path("M25,44 V12 L27,10 V5 L30,0 L33,5 V10 L35,12 V44Z", k.d) + line("M30,0 V-4", k.d, 1) + '<rect x="27" y="14" width="6" height="1.6" fill="' + k.y + '"/><rect x="27" y="20" width="6" height="1.6" fill="' + k.y + '"/><rect x="27" y="26" width="6" height="1.6" fill="' + k.y + '"/>' + circ(49, 6, 5, k.r) + line("M49,1 Q50,-2 52,-2", k.g, 1.4); },
    biplane: function (k) { return '<rect x="14" y="9" width="34" height="3.4" rx="1.7" fill="' + k.a + '"/><rect x="12" y="25" width="36" height="3.4" rx="1.7" fill="' + k.a + '"/>' + line("M20,12 L22,25 M40,12 L40,25", k.br, 1.4) + path("M6,19 Q30,14 50,17 Q55,19 50,22 Q30,24 6,21Z", k.w, ' stroke="' + k.gr + '" stroke-width=".8"') + path("M4,13 L10,19 L4,21Z", k.a) + line("M54,12 V28", k.gr, 1.6) + circ(52, 19.5, 2, k.d) + line("M4,36 Q12,32 20,34", k.w, 1, ' opacity=".7"'); },
    bison: function (k) { return path("M8,40 V30 Q6,16 23,12 Q34,9 40,15 Q48,13 52,21 L55,29 Q53,34 49,32 L47,40 H43 V33 H27 L25,40 H21 L20,33 Q15,33 14,40Z", k.dbr) + path("M8,30 Q2,30 3,36", "none", ' stroke="' + k.dbr + '" stroke-width="1.6"') + path("M50,18 Q54,12 52,10", "none", ' stroke="' + k.s + '" stroke-width="1.6"') + path("M50,30 Q50,36 47,37 Q47,33 47,30Z", k.k) + circ(51, 22, 0.9, k.w); },
    buckeye: function (k) { return '<g transform="translate(30,15)">' + [-70, -35, 0, 35, 70].map(function (a) { return ell(0, -9, 3.6, 9, k.g, ' transform="rotate(' + a + ')"'); }).join("") + '</g>' + circ(30, 30, 12, "#6b3a1a") + ell(30, 35, 6, 4, k.a) + circ(25, 25, 2.4, k.w, ' opacity=".4"'); },
    cowhat: function (k) { return path("M3,34 Q30,46 57,34 Q51,30 45,32 L41,14 Q35,10 30,14 Q25,10 19,14 L15,32 Q9,30 3,34Z", k.br) + path("M16,28 Q30,32 44,28 L45,32 Q30,36 15,32Z", k.a) + line("M30,14 V22", k.dbr, 1.2) + circ(30, 30, 1.6, k.w); },
    beaver: function (k) { return ell(10, 37, 9, 4, k.dbr) + line("M4,37 H16 M7,35 V39 M12,35 V39", k.br, 0.7) + ell(27, 30, 14, 11, k.br) + circ(41, 21, 8, k.br) + circ(36, 15, 2.2, k.dbr) + circ(44, 19, 1.3, k.k) + circ(48, 23, 1.6, k.k) + '<rect x="44" y="26" width="3.4" height="3.4" fill="' + k.w + '"/>' + ell(34, 39, 4, 2, k.dbr) + ell(22, 40, 4, 2, k.dbr); },
    keystone: function (k) { return path("M10,5 H50 L43,41 H17Z", k.a, ' stroke="' + k.d + '" stroke-width="1.4"') + path("M16,10 H44 L39,36 H21Z", "none", ' stroke="' + k.w + '" stroke-width="1.4" opacity=".8"') + path("M30,15 L32.4,21 L38.6,21.3 L33.8,25.2 L35.4,31.2 L30,27.8 L24.6,31.2 L26.2,25.2 L21.4,21.3 L27.6,21Z", k.w); },
    anchor: function (k) { return '<circle cx="30" cy="6" r="4" fill="none" stroke="' + k.a + '" stroke-width="3"/>' + line("M30,10 V40 M20,16 H40 M10,28 Q12,42 30,41 Q48,42 50,28", k.a, 3.6) + path("M6,30 L10,24 L14,30Z M46,30 L50,24 L54,30Z", k.a) + line("M22,40 Q30,36 40,40", k.w, 0.8, ' opacity=".5"'); },
    turtle: function (k) { return ell(14, 34, 7, 3.4, "#6fae7a", ' transform="rotate(30 14 34)"') + ell(44, 34, 7, 3.4, "#6fae7a", ' transform="rotate(-30 44 34)"') + ell(14, 14, 8, 3.6, "#6fae7a", ' transform="rotate(-30 14 14)"') + ell(44, 14, 8, 3.6, "#6fae7a", ' transform="rotate(30 44 14)"') +
        circ(52, 24, 5.4, "#6fae7a") + circ(54, 22, 1, k.k) + ell(30, 24, 17, 12, k.dg) + path("M30,14 L37,19 L35,28 H25 L23,19Z M18,20 L23,19 M37,19 L42,20 M25,28 L21,32 M35,28 L39,32 M30,14 V12", "none", ' stroke="' + k.a + '" stroke-width="1.2"'); },
    prairiedog: function (k) { return ell(30, 42, 18, 3.5, k.dbr) + path("M23,43 Q18,30 23,17 Q25,8 31,8 Q37,8 39,17 Q44,30 38,43Z", "#c79a5a") + ell(31, 30, 5, 10, "#e8cf9f") + circ(27, 15, 1.3, k.k) + circ(35, 15, 1.3, k.k) + ell(31, 19, 1.6, 1.1, k.dbr) + line("M26,26 Q29,28 30,25 M36,26 Q33,28 32,25", "#8a6234", 2) + circ(25, 10, 2, "#a77b44") + circ(37, 10, 2, "#a77b44"); },
    guitar: function (k) { return '<g transform="rotate(-24 30 26)">' + circ(30, 33, 11, k.a) + circ(30, 20, 8, k.a) + circ(30, 25, 3.6, k.k) + '<rect x="28.4" y="-4" width="3.2" height="22" fill="' + k.dbr + '"/><rect x="27" y="-8" width="6" height="6" rx="1.4" fill="' + k.dbr + '"/>' + line("M29.3,-2 V40 M30.7,-2 V40", k.w, 0.4) + '<rect x="26" y="37" width="8" height="2" fill="' + k.k + '"/></g>' + path("M50,8 L51,11 L54,12 L51,13 L50,16 L49,13 L46,12 L49,11Z", k.y) + path("M8,30 L9,32 L11,33 L9,34 L8,36 L7,34 L5,33 L7,32Z", k.y); },
    star: function (k) { return circ(30, 22, 21, "none", ' stroke="' + k.a + '" stroke-width="2"') + path("M30,3 L34.9,16.3 L49,16.8 L37.9,25.5 L41.8,39 L30,31.2 L18.2,39 L22.1,25.5 L11,16.8 L25.1,16.3Z", k.w, ' stroke="' + k.a + '" stroke-width="1.6"'); },
    rockarch: function (k) { return path("M3,44 L7,22 Q12,4 30,4 Q48,4 53,22 L57,44 H46 L44,28 Q41,15 30,15 Q19,15 16,28 L14,44Z", "#c4512a") + path("M7,22 Q12,4 30,4 Q20,8 14,22 L12,44 H3Z", "#e07a4a", ' opacity=".7"') + line("M10,32 H15 M46,34 H52", "#93361d", 1); },
    maple: function (k) { return path("M30,2 L34,12 L42,8 L40,18 L52,16 L46,24 L54,28 L40,30 L42,36 L32,32 L31,44 H29 L28,32 L18,36 L20,30 L6,28 L14,24 L8,16 L20,18 L18,8 L26,12Z", k.a) + line("M30,8 V40 M30,24 L18,18 M30,24 L42,18 M30,30 L20,29 M30,30 L40,29", k.w, 0.7, ' opacity=".6"'); },
    cardinal: function (k) { return line("M2,40 Q30,34 58,42", k.br, 2.4) + path("M10,30 Q16,17 31,17 L35,7 L40,15 Q48,15 50,21 L56,23 L50,25 Q48,34 34,36 L17,38 L7,44 L12,35Z", k.a) + path("M44,17 Q50,18 51,22 L50,26 Q45,26 43,21Z", k.k) + path("M50,21 L57,23 L50,26Z", k.o) + circ(46, 20, 0.9, k.w) + path("M20,24 Q28,22 34,28 Q26,30 20,24Z", "#a01722"); },
    orca: function (k) { return line("M2,38 Q10,34 18,38 T34,38 T50,38 T60,38", k.w, 1.2, ' opacity=".8"') + path("M4,30 Q20,13 44,19 Q54,21 58,27 Q52,33 40,33 H30 Q16,35 4,30Z", k.k) + path("M27,19 L32,3 L37,19Z", k.k) + path("M4,30 L-1,24 L3,29 L-1,35Z", k.k) + ell(48, 22, 3.6, 1.8, k.w) + path("M24,31 Q38,28 52,30 Q44,34 30,33Z", k.w); },
    canoe: function (k) { return line("M0,40 Q8,37 16,40 T32,40 T48,40 T64,40", k.w, 1.4, ' opacity=".8"') + path("M4,30 Q30,42 56,30 L52,28 Q30,36 8,28Z", k.a) + line("M8,28 Q30,36 52,28", k.dbr, 1) + circ(22, 20, 3.2, k.o) + path("M19,30 V24 Q22,21 25,24 V30Z", k.r) + circ(38, 20, 3.2, k.o) + path("M35,30 V24 Q38,21 41,24 V30Z", k.b) + line("M16,16 L28,38 M44,16 L34,38", k.br, 1.4); },
    cow: function (k) { return line("M16,30 V43 M22,31 V43 M36,31 V43 M42,30 V43", k.k, 3) + '<rect x="11" y="15" width="34" height="17" rx="7" fill="' + k.w + '" stroke="' + k.k + '" stroke-width="1"/>' + path("M18,17 Q25,15 26,21 Q22,26 17,22Z M33,24 Q38,20 41,25 Q38,30 33,28Z", k.k) + '<rect x="41" y="9" width="13" height="15" rx="4" fill="' + k.w + '" stroke="' + k.k + '" stroke-width="1"/>' + ell(48, 21, 6, 4, k.p) +
        circ(45, 14, 1.1, k.k) + circ(51, 14, 1.1, k.k) + line("M42,10 L39,6 M53,10 L56,6", k.y, 1.6) + line("M11,18 Q6,22 7,30", k.k, 1.2) + ell(30, 34, 3, 2, k.p); },
    geyser: function (k) { return circ(22, 6, 5, k.w, ' opacity=".55"') + circ(38, 5, 6, k.w, ' opacity=".5"') + circ(30, 2, 4, k.w, ' opacity=".6"') + path("M24,44 Q27,22 23,7 Q30,2 37,7 Q33,22 36,44Z", k.a, ' opacity=".9"') + path("M28,40 Q30,22 28,10 Q31,8 33,10 Q31,22 32,40Z", k.w, ' opacity=".8"') + circ(18, 18, 1.6, k.a) + circ(43, 22, 1.6, k.a) + path("M4,44 Q30,34 56,44Z", "#c9b07a"); },
    dome: function (k) { return '<rect x="8" y="36" width="44" height="8" fill="' + k.w + '" stroke="' + k.gr + '" stroke-width=".8"/><rect x="16" y="24" width="28" height="12" fill="' + k.w + '" stroke="' + k.gr + '" stroke-width=".8"/>' + line("M20,26 V35 M25,26 V35 M30,26 V35 M35,26 V35 M40,26 V35", k.gr, 0.8) + path("M17,24 Q30,4 43,24Z", k.w, ' stroke="' + k.gr + '" stroke-width=".8"') + '<rect x="27.5" y="6" width="5" height="6" fill="' + k.w + '" stroke="' + k.gr + '" stroke-width=".8"/>' + line("M30,6 V1", k.gr, 1.2) + circ(30, 1, 1.2, k.a); }
  };

  // Backdrops behind the motif: board coordinates (the board is x 10-190, the scene stops at the name panel, y 80).
  function scene(L, k, on, night) {
    var f = on ? L.land[0] : "#ddd6c8", n = on ? L.land[1] : "#d2cab9", w = on ? "#ffffff" : "#ece7dc", s = "";
    switch (L.scene) {
      case "peaks": s = path("M0,82 V62 L30,40 L52,58 L84,28 L114,58 L140,36 L168,56 L200,40 V82Z", f) + path("M84,28 L76,36 L84,34 L90,37Z M140,36 L133,42 L140,41 L146,43Z M30,40 L24,45 L30,44 L35,46Z", w, ' opacity=".9"') + path("M0,82 V72 Q50,62 100,72 T200,68 V82Z", n); break;
      case "hills": s = path("M0,82 V66 Q40,50 90,62 T200,56 V82Z", f) + path("M0,82 V74 Q60,60 120,72 T200,68 V82Z", n); break;
      case "sea": s = path("M0,70 Q20,62 40,68 V70Z", f, ' opacity=".6"') + '<rect x="0" y="66" width="200" height="16" fill="' + f + '"/>' + line("M10,71 Q16,68 22,71 M60,74 Q66,71 72,74 M130,72 Q136,69 142,72 M170,76 Q176,73 182,76", w, 1.2, ' opacity=".7"') + path("M0,82 V77 Q60,72 110,78 T200,76 V82Z", n); break;
      case "desert": s = path("M0,82 V62 H26 L32,52 H64 L70,62 H118 L124,46 H156 L162,58 H200 V82Z", f) + path("M0,82 V74 Q70,66 130,74 T200,72 V82Z", n); break;
      case "plains": s = '<rect x="0" y="64" width="200" height="18" fill="' + f + '"/>' + line("M100,64 L40,82 M100,64 L80,82 M100,64 L120,82 M100,64 L160,82 M100,64 L0,78 M100,64 L200,78", n, 1.6) + path("M0,65 H200", n, ' stroke="' + n + '" stroke-width="1"'); break;
      case "forest": s = path("M0,82 V68 Q60,58 120,66 T200,62 V82Z", f); for (var x = 4; x < 200; x += 13) s += path("M" + x + "," + (76 - (x % 3) * 2) + " l5,-12 l5,12Z", n); s += '<rect x="0" y="76" width="200" height="6" fill="' + n + '"/>'; break;
      case "lake": s = path("M0,82 V64 Q50,52 100,62 T200,58 V82Z", f) + '<rect x="0" y="70" width="200" height="12" fill="' + n + '"/>' + line("M20,74 H40 M70,77 H96 M140,74 H160", w, 1, ' opacity=".6"'); break;
      case "city": [[0, 58, 18], [20, 50, 14], [36, 62, 22], [140, 54, 16], [158, 46, 14], [174, 60, 26]].forEach(function (b) { s += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (82 - b[1]) + '" fill="' + f + '"/>'; }); s += '<rect x="0" y="74" width="200" height="8" fill="' + n + '"/>'; break;
    }
    return s;
  }

  function nameSize(NAME, room) { var fs = Math.min(21, room / (NAME.length * 0.74)); return Math.max(9, Math.round(fs * 10) / 10); }
  function fmtShort(d, fmt) { return fmt ? fmt(d) : d; }

  /** The sign: a 200x168 SVG. info = the signsFor entry ({ first, visits, ... }), or null for a mystery sign still to collect.
      opts.fmtDate formats a date; opts.name overrides the name. */
  function signSVG(id, name, info, opts) {
    opts = opts || {};
    var L = look(id) || look("DC"), on = !!info, u = "sg" + id + (++uid), k = colors(L, on), night = L.style === "neon" || L.sky[0] === "#0b1d3a";
    var visits = on ? Math.max(1, +info.visits || (info.trips && info.trips.length) || 1) : 0, T = on ? tier(visits) : "", TI = TIERS[T === "gold" ? 2 : T === "silver" ? 1 : 0];
    var label = DISPLAY[id] || name || id, NAME = esc(String(label).toUpperCase()), room = NAME_ROOM[L.shape], fs = nameSize(NAME, room), nick = esc(L.nick.toUpperCase());
    var over = NAME.length * fs * 0.74 > room ? ' textLength="' + room + '" lengthAdjust="spacingAndGlyphs"' : "";
    var board = SHAPES[L.shape], panel = on ? L.panel : "#d6cfbf", ptext = on ? L.text : "#57524a", wood = L.style === "wood";
    var date = on ? (info.first ? fmtShort(info.first, opts.fmtDate).toUpperCase() : "DATE? TAP TO ADD") : "";
    var aria = on ? "Welcome to " + label + " sign, " + L.nick + ". Collected, " + T + ": " + (info.first ? "first visit " + fmtShort(info.first, opts.fmtDate) : "date not set") + ", " + visits + (visits === 1 ? " visit" : " visits")
                  : label + ", " + L.nick + ": not collected yet";
    var defs = '<defs><clipPath id="' + u + 'c"><path d="' + board + '"/></clipPath>' +
      '<linearGradient id="' + u + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (on ? L.sky[0] : "#ebe6da") + '"/><stop offset="1" stop-color="' + (on ? L.sky[1] : "#f3efe6") + '"/></linearGradient>' +
      (on ? '<linearGradient id="' + u + 'm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + TI[1] + '"/><stop offset=".45" stop-color="' + TI[2] + '"/><stop offset=".55" stop-color="' + TI[2] + '"/><stop offset="1" stop-color="' + TI[1] + '"/></linearGradient>' +
        '<linearGradient id="' + u + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' : "") +
      (on && wood ? '<pattern id="' + u + 'w" width="44" height="9" patternUnits="userSpaceOnUse"><rect width="44" height="9" fill="#9a6636"/><path d="M0,3 Q11,1 22,3 T44,3" stroke="#6e4220" stroke-width=".9" fill="none" opacity=".7"/><path d="M0,7 Q13,5.5 24,7.5 T44,6.5" stroke="#c08a52" stroke-width=".8" fill="none"/></pattern>' : "") +
      '</defs>';
    var postFill = !on ? "#d6d0c3" : wood ? "url(#" + u + "w)" : "#8d96a0";
    var posts = '<rect x="48" y="110" width="10" height="54" rx="2" fill="' + postFill + '"/><rect x="142" y="110" width="10" height="54" rx="2" fill="' + postFill + '"/>' +
      (on && !wood ? '<rect x="49.5" y="110" width="2.4" height="54" fill="#fff" opacity=".35"/><rect x="143.5" y="110" width="2.4" height="54" fill="#fff" opacity=".35"/>' : "");
    var shadow = ell(100, 164, 72, 3.6, "#000", ' opacity=".14"') + (on ? '<path d="' + board + '" fill="#000" opacity=".16" transform="translate(3,4)"/>' : "");
    // the board: sky, scene, motif, then the solid name panel (text sits on a solid color for contrast)
    var inside = '<g clip-path="url(#' + u + 'c)"><rect x="0" y="0" width="200" height="130" fill="url(#' + u + 's)"/>';
    if (on && night) for (var i = 0; i < 14; i++) inside += circ(18 + (i * 53) % 166, 14 + (i * 29) % 40, i % 3 ? 0.7 : 1.1, "#fff", ' opacity=".8"');
    else if (on && L.style === "retro") inside += '<g opacity=".18" transform="translate(100,62)">' + ring(16, function (i, a) { return '<path d="M0,0 L-7,-120 L7,-120Z" fill="#fff" transform="rotate(' + a + ')"/>'; }) + '</g>';
    else if (on) inside += circ(162, 30, 10, "#fff", ' opacity=".45"');
    inside += scene(L, k, on, night) + '<g transform="translate(66.4,31) scale(1.12)" opacity="' + (on ? 1 : .75) + '">' + MOTIFS[L.motif](k) + '</g>';
    if (!on) inside += '<g transform="translate(100,58)"><circle r="13" fill="#f6f2ea" stroke="#a39c8c" stroke-width="1.4" stroke-dasharray="3 2.4"/><text y="6.5" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="19" fill="#6b655a">?</text></g>';
    inside += '<rect x="0" y="80" width="200" height="50" fill="' + panel + '"/>' + (on ? '<rect x="0" y="80" width="200" height="1.6" fill="' + L.accent + '" opacity=".9"/>' : "");
    if (on && !wood && L.style !== "neon") inside += '<path d="M0,0 H200 V34 Q100,46 0,34Z" fill="url(#' + u + 'g)"/>';
    inside += '</g>';
    var tY = L.shape === "arch" ? 30 : L.shape === "oval" ? 24 : 22;
    var welcome = '<rect x="66" y="' + (tY - 8.5) + '" width="68" height="12" rx="6" fill="' + panel + '" opacity=".92"/><text x="100" y="' + tY + '" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="700" font-size="7" letter-spacing="2.2" fill="' + ptext + '">WELCOME TO</text>';
    var nameY = L.shape === "shield" ? 97 : L.shape === "oval" ? 96 : 99, nickY = L.shape === "shield" ? 108 : L.shape === "oval" ? 107 : 110;
    var nameTxt = '<text x="100" y="' + nameY + '" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="' + fs + '"' + over + ' fill="' + ptext + '">' + NAME + '</text>';
    if (on && L.style === "neon") nameTxt = '<text x="100" y="' + nameY + '" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="' + fs + '"' + over + ' fill="none" stroke="' + L.accent + '" stroke-width="3" opacity=".45">' + NAME + '</text>' + nameTxt;
    var nickTxt = '<text x="100" y="' + nickY + '" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="600" font-size="6.4" letter-spacing="1.1" fill="' + ptext + '" opacity="' + (on ? .92 : 1) + '">' + nick + '</text>';
    // the frame: tier metal on the outside, then the style's own border (wood, enamel pinstripe, or neon tubes)
    var frame;
    if (!on) frame = '<path d="' + board + '" fill="none" stroke="#a39c8c" stroke-width="2" stroke-dasharray="6 4"/>';
    else {
      frame = '<path d="' + board + '" fill="none" stroke="url(#' + u + 'm)" stroke-width="7"/>';
      if (wood) frame += '<path d="' + board + '" fill="none" stroke="url(#' + u + 'w)" stroke-width="4.2"/>';
      else if (L.style === "neon" || L.style === "retro") frame += '<path d="' + board + '" fill="none" stroke="' + L.accent + '" stroke-width="3.2" opacity=".35" transform="translate(100,63) scale(.955) translate(-100,-63)"/><path d="' + board + '" fill="none" stroke="' + L.accent + '" stroke-width="1.2" transform="translate(100,63) scale(.955) translate(-100,-63)"/>';
      else frame += '<path d="' + board + '" fill="none" stroke="' + L.text + '" stroke-width="1" opacity=".7" transform="translate(100,63) scale(.955) translate(-100,-63)"/>';
    }
    var bolts = on ? [[22, 20], [178, 20], [22, 100], [178, 100]].filter(function (b) { return L.shape === "rect" || L.shape === "ticket" ? true : L.shape === "arch" ? b[1] > 50 : L.shape === "shield" ? b[1] < 50 : false; })
      .map(function (b) { return circ(b[0], b[1], 2.2, TI[1]) + circ(b[0] - .6, b[1] - .6, .9, "#fff", ' opacity=".7"'); }).join("") : "";
    // the little plate on the posts: first visit and how many visits
    var plate = on ? '<g><rect x="44" y="124" width="112" height="25" rx="3.5" fill="url(#' + u + 'm)"/><rect x="46.5" y="126.5" width="107" height="20" rx="2.4" fill="#fbf6e9"/>' +
        circ(50.5, 136.5, 1.3, TI[1]) + circ(149.5, 136.5, 1.3, TI[1]) +
        '<text x="56" y="133.6" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="700" font-size="5" letter-spacing=".9" fill="#5a5246">FIRST VISIT</text>' +
        '<text x="56" y="143" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="700" font-size="' + (date.length > 12 ? 6.4 : 7.6) + '" fill="#22303c">' + esc(date) + '</text>' +
        '<rect x="118" y="128.5" width="31" height="16" rx="2" fill="' + L.panel + '"/><text x="133.5" y="138.4" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="9" fill="' + L.text + '">' + visits + '</text>' +
        '<text x="133.5" y="143.4" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="700" font-size="3.6" letter-spacing=".5" fill="' + L.text + '">' + (visits === 1 ? "VISIT" : "VISITS") + '</text></g>'
      : '<g><rect x="56" y="126" width="88" height="20" rx="3" fill="#f6f2ea" stroke="#a39c8c" stroke-width="1" stroke-dasharray="3 2.4"/><text x="100" y="138.6" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-weight="700" font-size="6.4" letter-spacing="1.2" fill="#57524a">NOT YET VISITED</text></g>';
    var rosette = on ? '<g transform="translate(' + (L.shape === "oval" ? 172 : 182) + ',' + (L.shape === "oval" ? 22 : L.shape === "arch" ? 36 : 14) + ')"><circle r="9" fill="url(#' + u + 'm)" stroke="#fff" stroke-width="1.2"/><path d="M0,-5 L1.5,-1.6 L5,-1.4 L2.3,.9 L3.1,4.4 L0,2.5 L-3.1,4.4 L-2.3,.9 L-5,-1.4 L-1.5,-1.6Z" fill="#fff" opacity=".9"/></g>' : "";
    return '<svg class="signsvg ' + (on ? "s-" + T : "faded") + ' st-' + L.style + '" viewBox="0 0 200 168" role="img" aria-label="' + esc(aria) + '">' + defs + shadow + posts + plate +
      '<path d="' + board + '" fill="' + (on ? L.panel : "#ebe6da") + '"/>' + inside + frame + bolts + welcome + nameTxt + nickTxt + rosette + '</svg>';
  }

  // WCAG contrast, for the tests (every panel color against its text).
  function lum(hex) { var c = hex.replace("#", ""); return [0, 2, 4].map(function (i) { var v = parseInt(c.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  return { signSVG: signSVG, look: look, tier: tier, TABLE: TABLE, MOTIFS: MOTIFS, SHAPES: SHAPES, contrast: contrast, MYSTERY: { panel: "#d6cfbf", text: "#57524a" } };
});
