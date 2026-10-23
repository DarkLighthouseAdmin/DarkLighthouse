/* Famstamp: Junior Ranger badges on a kid's passport. One shield-shaped badge per park they earned it at (person.parks[id].jr),
   with the park's scene from the stamp art (read only), the park name big, and the date. Our own design: no agency marks or wording. */
(function (root) {
  "use strict";
  var M = root.MLTL, SA = function () { return root.WK_STAMPART; };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var INK = "#2f5d3a", GOLD = "#b8892e", PAPER = "#fbf7ec", n = 0, CACHE = {};
  var SHIELD = "M80 6 L150 22 V92 Q150 150 80 184 Q10 150 10 92 V22 Z", INNER = "M80 14 L142 28 V92 Q142 144 80 175 Q18 144 18 92 V28 Z";
  function fmt(at) { var d = new Date(String(at || "").slice(0, 10) + "T12:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase(); }
  function lines(name) {   // the park name on one or two lines, as big as fits
    var w = String(name).toUpperCase().split(/\s+/), one = w.join(" ");
    if (one.length <= 11 || w.length === 1) return [one];
    var best = [one], bl = 99;
    for (var i = 1; i < w.length; i++) { var a = w.slice(0, i).join(" "), b = w.slice(i).join(" "), l = Math.max(a.length, b.length); if (l < bl) { bl = l; best = [a, b]; } }
    return best;
  }
  function badgeSVG(parkId, name, at) {
    var key = parkId + "|" + name + "|" + (at || ""); if (CACHE[key]) return CACHE[key].replace(/rbX/g, "rb" + (++n));
    var S = SA(), look = S && S.parkLook ? S.parkLook(parkId) : null, art = look && S.GLYPHS[look.motif] ? S.GLYPHS[look.motif](0) : "";
    var L = lines(name), longest = Math.max.apply(null, L.map(function (x) { return x.length; })), fs = Math.min(L.length === 1 ? 17 : 11.5, (L.length === 1 ? 104 : 96) / (longest * 0.62)), date = fmt(at);
    var ny = L.length === 1 ? 139 : 133, dy = L.length === 1 ? 151 : Math.round(133 + fs + 10);
    var svg = '<svg class="rbadge-svg" viewBox="0 0 160 190" role="img" aria-label="Junior Ranger badge, ' + esc(name) + (date ? ", " + esc(date) : "") + '">' +
      '<defs><clipPath id="rbXw"><path d="M80 44 L128 52 V96 Q128 112 116 120 H44 Q32 112 32 96 V52 Z"/></clipPath></defs>' +
      '<path d="' + SHIELD + '" fill="' + GOLD + '"/><path d="' + INNER + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.4"/>' +
      '<path d="M80 19 L137 32 V92 Q137 140 80 169 Q23 140 23 92 V32 Z" fill="none" stroke="' + INK + '" stroke-width=".9" stroke-dasharray="2 2.2"/>' +
      '<text x="80" y="40" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="9.6" letter-spacing="1" fill="' + INK + '">JUNIOR RANGER</text>' +
      '<g clip-path="url(#rbXw)"><rect x="30" y="42" width="100" height="80" fill="#eef1e6"/><g transform="translate(40 44) scale(2)" fill="' + INK + '" color="' + INK + '">' + art + '</g></g>' +
      '<path d="M80 44 L128 52 V96 Q128 112 116 120 H44 Q32 112 32 96 V52 Z" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' +
      L.map(function (t, i) { return '<text x="80" y="' + (ny + i * (fs + 0.5)) + '" text-anchor="middle" font-family="\'Arial Narrow\', \'Roboto Condensed\', Arial, sans-serif" font-weight="800" font-size="' + fs.toFixed(1) + '" fill="' + INK + '">' + esc(t) + '</text>'; }).join("") +
      (date ? '<text x="80" y="' + dy + '" text-anchor="middle" font-family="\'Courier New\', monospace" font-weight="700" font-size="7.6" fill="' + GOLD + '">' + esc(date) + '</text>' : "") +
      '<path d="M66 ' + (L.length === 1 ? 121 : 120) + ' l14 4 l14 -4" fill="none" stroke="' + GOLD + '" stroke-width="1.4"/></svg>';
    CACHE[key] = svg; return svg.replace(/rbX/g, "rb" + (++n));
  }
  function earned(k) {
    if (!k || !M.isKid(k)) return [];
    return Object.keys(k.parks || {}).filter(function (id) { return k.parks[id] && k.parks[id].jr && M.parkById(id); })
      .map(function (id) { return { id: id, park: M.parkById(id), at: k.parks[id].at || "" }; })
      .sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
  }
  /** The passport section: nothing for grown-ups or kids without one yet. */
  function sectionHTML(k) {
    var list = earned(k); if (!list.length) return "";
    return '<section class="rbadges" aria-label="' + esc(M.who(k)) + '\'s Junior Ranger badges"><div class="pbh"><h3>Junior Ranger badges <span class="muted small">' + list.length + '</span></h3></div><div class="rbgrid">' +
      list.map(function (b) { return '<button type="button" class="rbadge" data-rb="' + esc(b.id) + '">' + badgeSVG(b.id, b.park.name, b.at) + '</button>'; }).join("") + '</div></section>';
  }
  function bind(k, main) {
    var U = root.FS_UI;
    Array.prototype.forEach.call(main.querySelectorAll(".rbadge"), function (el) {
      el.onclick = function () {
        var id = el.dataset.rb, p = M.parkById(id), v = (k.parks || {})[id] || {}, d = fmt(v.at);
        U.sheet('<div class="sheethead"><h3>' + esc(p.name) + '</h3><button type="button" class="sheetx" data-close aria-label="Close">✕</button></div>' +
          '<div class="rbig">' + badgeSVG(id, p.name, v.at) + '</div><p>' + esc(M.who(k)) + ' earned a Junior Ranger badge at ' + esc(p.name) + (d ? ' on ' + esc(fmt(v.at).replace(/^(\w)(\w+)/, function (m, a, b) { return a + b.toLowerCase(); })) : "") + '.</p>' +
          '<div class="actions"><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/parks">See it on Parks</a><button type="button" class="btn btn-primary" data-close>Close</button></div>');
      };
    });
  }
  root.FS_RANGER = { badgeSVG: badgeSVG, earned: earned, sectionHTML: sectionHTML, bind: bind };
})(typeof window !== "undefined" ? window : this);
