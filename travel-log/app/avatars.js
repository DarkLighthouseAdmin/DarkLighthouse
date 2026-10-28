/* Famstamp v87: placeholder avatars people can pick for themselves (About me on the passport, and Edit person).
   Friendly, generic drawings: no real people. They sit on the person's map color, so families still tell them apart.
   TO SWAP IN THE NEW SET: add files (say avatars/kid-1.svg or .png) and give each entry below a `src`
   (e.g. { id: "k1", label: "…", group: "kid", src: "avatars/kid-1.svg" }). Keep the ids so everyone's pick carries over;
   new ids can be added and old ones left out (an unknown id just falls back to the person's initial). */
(function (root) {
  "use strict";
  var SKIN = ["#f6d7bf", "#eec39f", "#d9a27a", "#b97c52", "#8d5a3b", "#5f3b26"];
  var HAIR = { black: "#2a211c", brown: "#6b4426", auburn: "#9a4a25", blond: "#e0b85c", gray: "#b9b6b0", red: "#c8642e" };
  function hairPath(style, c, kid) {
    var top = kid ? 22 : 19;
    var cap = '<path d="M14.5 ' + (top + 14) + 'C14.5 ' + (top - 2) + ' 49.5 ' + (top - 2) + ' 49.5 ' + (top + 14) + 'C44 ' + (top + 5) + ' 22 ' + (top + 4) + ' 14.5 ' + (top + 14) + 'Z" fill="' + c + '"/>';
    switch (style) {
      case "short": return cap;
      // v90: fuller short hair (covers the crown down to the temples, with a side part); used by the beard avatars
      case "full": return '<path d="M14.2 ' + (top + 13) + 'C12.5 ' + (top - 1) + ' 20 ' + (top - 8) + ' 32 ' + (top - 8) + 'C44 ' + (top - 8) + ' 51.5 ' + (top - 2) + ' 49.8 ' + (top + 13) + 'C48.6 ' + (top + 8) + ' 46.5 ' + (top + 5) + ' 44 ' + (top + 4) + 'C37 ' + (top + 7) + ' 29 ' + (top + 7) + ' 25 ' + (top + 3) + 'C21 ' + (top + 5) + ' 17 ' + (top + 8) + ' 14.2 ' + (top + 13) + 'Z" fill="' + c + '"/>' +
        '<path d="M25 ' + (top + 3) + 'C27 ' + (top - 2) + ' 31 ' + (top - 5) + ' 37 ' + (top - 6) + '" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.4" stroke-linecap="round"/>';
      case "curly": return [18, 25, 32, 39, 46].map(function (x, i) { return '<circle cx="' + x + '" cy="' + (top + 4 + (i % 2) * 2) + '" r="6.2" fill="' + c + '"/>'; }).join("") + '<circle cx="15.5" cy="' + (top + 11) + '" r="4.5" fill="' + c + '"/><circle cx="48.5" cy="' + (top + 11) + '" r="4.5" fill="' + c + '"/>';
      case "long": return '<path d="M13 ' + (top + 12) + 'C12 ' + (top - 3) + ' 52 ' + (top - 3) + ' 51 ' + (top + 12) + 'L52 54L44 54L44 ' + (top + 12) + 'L20 ' + (top + 12) + 'L20 54L12 54Z" fill="' + c + '"/>';
      case "bun": return cap + '<circle cx="32" cy="' + (top - 4) + '" r="6" fill="' + c + '"/>';
      case "pigtails": return cap + '<circle cx="12" cy="' + (top + 14) + '" r="5.5" fill="' + c + '"/><circle cx="52" cy="' + (top + 14) + '" r="5.5" fill="' + c + '"/>';
      case "spiky": return '<path d="M15 ' + (top + 13) + 'L17 ' + (top + 1) + 'L22 ' + (top + 5) + 'L25 ' + (top - 3) + 'L30 ' + (top + 3) + 'L34 ' + (top - 4) + 'L38 ' + (top + 3) + 'L43 ' + (top - 2) + 'L45 ' + (top + 5) + 'L49 ' + (top + 2) + 'L49 ' + (top + 13) + 'C43 ' + (top + 6) + ' 21 ' + (top + 6) + ' 15 ' + (top + 13) + 'Z" fill="' + c + '"/>';
      case "cap": return '<path d="M15 ' + (top + 12) + 'C15 ' + (top - 2) + ' 49 ' + (top - 2) + ' 49 ' + (top + 12) + 'Z" fill="#3f6fb5"/><path d="M40 ' + (top + 11) + 'L58 ' + (top + 13) + 'L58 ' + (top + 15) + 'L40 ' + (top + 14) + 'Z" fill="#2f5590"/><circle cx="32" cy="' + (top - 0.5) + '" r="1.8" fill="#2f5590"/>';
      case "bald": return '<path d="M15 ' + (top + 15) + 'C15 ' + (top + 9) + ' 18 ' + (top + 8) + ' 18 ' + (top + 13) + 'Z M49 ' + (top + 15) + 'C49 ' + (top + 9) + ' 46 ' + (top + 8) + ' 46 ' + (top + 13) + 'Z" fill="' + c + '"/>';
      default: return "";
    }
  }
  function person(o) {
    var kid = o.group === "kid", cy = kid ? 37 : 35, r = kid ? 15.5 : 16.5, ey = cy - 1, er = kid ? 2.3 : 1.8;
    var s = '<path d="M10 64C11 52 20 48 32 48S53 52 54 64Z" fill="' + o.shirt + '"/>';
    if (o.hair === "long") s += hairPath("long", o.hc, kid);
    s += '<circle cx="32" cy="' + cy + '" r="' + r + '" fill="' + o.skin + '"/>';
    s += '<circle cx="' + (32 - r) + '" cy="' + (cy + 1) + '" r="2.6" fill="' + o.skin + '"/><circle cx="' + (32 + r) + '" cy="' + (cy + 1) + '" r="2.6" fill="' + o.skin + '"/>';
    if (o.hair !== "long") s += hairPath(o.hair, o.hc, kid); else s += hairPath("short", o.hc, kid);
    s += '<circle cx="26" cy="' + ey + '" r="' + er + '" fill="#2a211c"/><circle cx="38" cy="' + ey + '" r="' + er + '" fill="#2a211c"/>';
    if (kid) s += '<circle cx="26.8" cy="' + (ey - 0.8) + '" r=".8" fill="#fff"/><circle cx="38.8" cy="' + (ey - 0.8) + '" r=".8" fill="#fff"/><circle cx="22" cy="' + (cy + 5) + '" r="2.6" fill="#f08a7e" opacity=".45"/><circle cx="42" cy="' + (cy + 5) + '" r="2.6" fill="#f08a7e" opacity=".45"/>';
    if (o.glasses) s += '<g fill="none" stroke="#2a211c" stroke-width="1.6"><circle cx="26" cy="' + ey + '" r="4.6"/><circle cx="38" cy="' + ey + '" r="4.6"/><path d="M30.6 ' + ey + 'H33.4"/></g>';
    if (o.beard === "full" || o.beard === "short") {   // v89: young-adult beards (full = with mustache; short = trimmed)
      var bl = o.beard === "full" ? 20 : 15, op = o.beard === "full" ? "" : ' opacity=".8"';
      s += '<path d="M15.5 ' + (cy - 5) + 'C15.5 ' + (cy + bl - 4) + ' 23 ' + (cy + bl) + ' 32 ' + (cy + bl) + 'S48.5 ' + (cy + bl - 4) + ' 48.5 ' + (cy - 5) + 'L46 ' + (cy - 5) + 'C45.5 ' + (cy + 3) + ' 40 ' + (cy + 4.5) + ' 32 ' + (cy + 4.5) + 'S18.5 ' + (cy + 3) + ' 18 ' + (cy - 5) + 'Z" fill="' + o.hc + '"' + op + '/>';
      s += '<ellipse cx="32" cy="' + (cy + 8) + '" rx="5.6" ry="2.6" fill="' + o.skin + '"/>';
      if (o.beard === "full") s += '<path d="M24.5 ' + (cy + 6) + 'Q32 ' + (cy + 2) + ' 39.5 ' + (cy + 6) + 'Q32 ' + (cy + 4.6) + ' 24.5 ' + (cy + 6) + 'Z" fill="' + o.hc + '"/>';
    } else if (o.beard) s += '<path d="M17 ' + (cy + 1) + 'C18 ' + (cy + 18) + ' 46 ' + (cy + 18) + ' 47 ' + (cy + 1) + 'C44 ' + (cy + 8) + ' 20 ' + (cy + 8) + ' 17 ' + (cy + 1) + 'Z" fill="' + o.hc + '"/>';
    s += '<path d="M26.5 ' + (cy + 6) + 'Q32 ' + (cy + (kid ? 11.5 : 10.5)) + ' 37.5 ' + (cy + 6) + '" fill="none" stroke="#7a3b2e" stroke-width="2" stroke-linecap="round"/>';
    if (o.bow) s += '<path d="M40 ' + (cy - 15) + 'L46 ' + (cy - 19) + 'L46 ' + (cy - 11) + 'Z M52 ' + (cy - 19) + 'L46 ' + (cy - 15) + 'L52 ' + (cy - 11) + 'Z" fill="#e2557a"/>';
    return s;
  }
  function animal(kind) {
    var eyes = function (y, c) { return '<circle cx="26" cy="' + y + '" r="2.4" fill="' + (c || "#2a211c") + '"/><circle cx="38" cy="' + y + '" r="2.4" fill="' + (c || "#2a211c") + '"/><circle cx="26.8" cy="' + (y - .8) + '" r=".8" fill="#fff"/><circle cx="38.8" cy="' + (y - .8) + '" r=".8" fill="#fff"/>'; };
    switch (kind) {
      case "fox": return '<path d="M14 14L26 24L38 24L50 14L50 36C50 48 40 54 32 56C24 54 14 48 14 36Z" fill="#e07a34"/><path d="M18 18L24 24L18 28Z M46 18L40 24L46 28Z" fill="#7a3b1c"/><path d="M20 38C24 46 28 50 32 56C36 50 40 46 44 38C40 42 24 42 20 38Z" fill="#fff6ea"/>' + eyes(34) + '<circle cx="32" cy="47" r="2.4" fill="#2a211c"/>';
      case "bear": return '<circle cx="18" cy="20" r="7" fill="#8a5a3a"/><circle cx="46" cy="20" r="7" fill="#8a5a3a"/><circle cx="18" cy="20" r="3.5" fill="#d9a27a"/><circle cx="46" cy="20" r="3.5" fill="#d9a27a"/><circle cx="32" cy="36" r="18" fill="#8a5a3a"/><ellipse cx="32" cy="43" rx="8" ry="6" fill="#e8c39c"/>' + eyes(33) + '<ellipse cx="32" cy="40.5" rx="3" ry="2.2" fill="#2a211c"/><path d="M29 45Q32 47.5 35 45" fill="none" stroke="#2a211c" stroke-width="1.6" stroke-linecap="round"/>';
      case "cat": return '<path d="M15 30L17 12L27 21Z M49 30L47 12L37 21Z" fill="#9aa3ab"/><path d="M18 26L19 16L24 21Z M46 26L45 16L40 21Z" fill="#f2b3b8"/><circle cx="32" cy="36" r="18" fill="#9aa3ab"/>' + eyes(34, "#2f5f3c") + '<path d="M30 40L34 40L32 42.5Z" fill="#e2557a"/><path d="M29 44.5Q32 47 35 44.5" fill="none" stroke="#2a211c" stroke-width="1.5" stroke-linecap="round"/><g stroke="#4a4f55" stroke-width="1" stroke-linecap="round"><path d="M14 38L23 40M14 43L23 42M50 38L41 40M50 43L41 42"/></g>';
      case "owl": return '<path d="M14 22L22 14L28 22Z M50 22L42 14L36 22Z" fill="#7b5a3c"/><ellipse cx="32" cy="38" rx="18" ry="19" fill="#9b7350"/><ellipse cx="32" cy="46" rx="10" ry="9" fill="#e9d2a8"/><circle cx="25" cy="32" r="7" fill="#fff6ea"/><circle cx="39" cy="32" r="7" fill="#fff6ea"/>' + '<circle cx="25" cy="32" r="3.2" fill="#2a211c"/><circle cx="39" cy="32" r="3.2" fill="#2a211c"/><circle cx="26" cy="31" r="1" fill="#fff"/><circle cx="40" cy="31" r="1" fill="#fff"/><path d="M29.5 37L34.5 37L32 41.5Z" fill="#e8a54b"/>';
      default: return "";
    }
  }
  // id, what a screen reader hears, group, and the drawing.
  var LIST = [
    { id: "k1", label: "Kid with curly hair", group: "kid", art: { skin: SKIN[3], hair: "curly", hc: HAIR.black, shirt: "#e8a54b" } },
    { id: "k2", label: "Kid with pigtails", group: "kid", art: { skin: SKIN[0], hair: "pigtails", hc: HAIR.blond, shirt: "#5aa9a0", bow: 1 } },
    { id: "k3", label: "Kid with spiky hair", group: "kid", art: { skin: SKIN[1], hair: "spiky", hc: HAIR.brown, shirt: "#e2557a" } },
    { id: "k4", label: "Kid in a ball cap", group: "kid", art: { skin: SKIN[4], hair: "cap", hc: HAIR.black, shirt: "#f2c84b" } },
    { id: "k5", label: "Kid with long hair", group: "kid", art: { skin: SKIN[2], hair: "long", hc: HAIR.auburn, shirt: "#8a6fd1" } },
    { id: "k6", label: "Kid with glasses", group: "kid", art: { skin: SKIN[1], hair: "short", hc: HAIR.red, shirt: "#4f9be0", glasses: 1 } },
    { id: "k7", label: "Kid with a bun", group: "kid", art: { skin: SKIN[5], hair: "bun", hc: HAIR.black, shirt: "#ef7d54" } },
    { id: "k8", label: "Little one", group: "kid", art: { skin: SKIN[0], hair: "bald", hc: HAIR.blond, shirt: "#9fd0b0" } },
    { id: "a1", label: "Grown-up with short hair", group: "adult", art: { skin: SKIN[2], hair: "short", hc: HAIR.brown, shirt: "#3f5f4c" } },
    { id: "a2", label: "Grown-up with long hair", group: "adult", art: { skin: SKIN[0], hair: "long", hc: HAIR.brown, shirt: "#c4574a" } },
    { id: "a3", label: "Grown-up with a beard", group: "adult", art: { skin: SKIN[1], hair: "short", hc: HAIR.auburn, shirt: "#2f5590", beard: 1 } },
    { id: "a4", label: "Grown-up with curly hair", group: "adult", art: { skin: SKIN[4], hair: "curly", hc: HAIR.black, shirt: "#d98b25" } },
    { id: "a5", label: "Grown-up with glasses", group: "adult", art: { skin: SKIN[3], hair: "bun", hc: HAIR.black, shirt: "#6a5acd", glasses: 1 } },
    { id: "a6", label: "Grown-up in a cap", group: "adult", art: { skin: SKIN[5], hair: "cap", hc: HAIR.black, shirt: "#4a9a6a", beard: 1 } },
    { id: "a7", label: "Grandparent with gray hair", group: "adult", art: { skin: SKIN[1], hair: "bald", hc: HAIR.gray, shirt: "#8a6fd1", glasses: 1 } },
    { id: "a8", label: "Grandparent with a bun", group: "adult", art: { skin: SKIN[2], hair: "bun", hc: HAIR.gray, shirt: "#5aa9a0" } },
    { id: "a9", label: "Beard", group: "adult", art: { skin: SKIN[1], hair: "full", hc: HAIR.brown, shirt: "#3f6fb5", beard: "full" } },
    { id: "a10", label: "Short beard", group: "adult", art: { skin: SKIN[0], hair: "full", hc: HAIR.blond, shirt: "#4a9a6a", beard: "short" } },
    { id: "a11", label: "Beard with dark curly hair", group: "adult", art: { skin: SKIN[3], hair: "curly", hc: HAIR.black, shirt: "#c4574a", beard: "full" } },
    { id: "x1", label: "Fox", group: "animal", art: "fox" },
    { id: "x2", label: "Bear", group: "animal", art: "bear" },
    { id: "x3", label: "Cat", group: "animal", art: "cat" },
    { id: "x4", label: "Owl", group: "animal", art: "owl" }
  ];
  var BY = {}; LIST.forEach(function (a) { BY[a.id] = a; });
  var cache = {};
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function has(id) { return typeof id === "string" && Object.prototype.hasOwnProperty.call(BY, id); }
  // The picture for one avatar, sized by its container (CSS: .avimg).
  function html(id) {
    if (!has(id)) return "";
    if (cache[id]) return cache[id];
    var a = BY[id];
    return (cache[id] = a.src ? '<img class="avimg" src="' + esc(a.src) + '" alt="" />' :
      '<svg class="avimg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + (typeof a.art === "string" ? animal(a.art) : person(Object.assign({ group: a.group }, a.art))) + '</svg>');
  }
  // A grid of choices for a picker; `cur` is the person's current pick ("" = their initial).
  function pickerHTML(cur, initialLetter, style) {
    var b = function (id, inner, label) { return '<button type="button" class="avpick" data-av="' + esc(id) + '" aria-pressed="' + ((cur || "") === id) + '" aria-label="' + esc(label) + '" style="' + (style || "") + '">' + inner + '</button>'; };
    return '<div class="avgrid" role="group" aria-label="Picture">' + b("", '<span class="avlet">' + esc(initialLetter || "?") + '</span>', "No picture, just the first letter") +
      LIST.map(function (a) { return b(a.id, html(a.id), a.label); }).join("") + '</div>';
  }
  function bindPicker(scope, onPick) {
    Array.prototype.forEach.call(scope.querySelectorAll(".avpick"), function (b) {
      b.onclick = function () { Array.prototype.forEach.call(scope.querySelectorAll(".avpick"), function (x) { x.setAttribute("aria-pressed", String(x === b)); }); onPick(b.dataset.av); };
    });
  }
  var api = { list: LIST, has: has, html: html, pickerHTML: pickerHTML, bindPicker: bindPicker };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FS_AVATARS = api;
})(typeof window !== "undefined" ? window : globalThis);
