/* Famstamp: extras on every passport stamp (v65). The stamp sheet shows a row of buttons from window.FS_STAMPX
   (share card, postcard, draw your own stamp) and this file has the shared bits: find a person's stamp by kind + place,
   its name, and turning SVG into a picture for the canvas. Routes use #/<feature>/<personId>/<kind>/<area>. */
(function () {
  "use strict";
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  var KINDS = { state: 1, place: 1, park: 1 };
  function name(s) {
    var maps = window.MLTL_MAPS;
    if (s.kind === "park") { var p = M().parkById(s.area); return p ? p.name : s.area; }
    if (s.kind === "state") { var st = maps.us.shapes.filter(function (x) { return x.id === s.area; })[0]; return st ? st.name : s.area; }
    var c = maps.world.countries.filter(function (x) { return x.id === s.area; })[0]; return c ? c.name : s.area;
  }
  function sub(s) { return s.kind === "park" ? M().parkSub(M().parkById(s.area)) : ""; }
  /** { p, s, name } for a person's stamp, or null. The earliest dated one when they have several of the same place. */
  function find(pid, kind, area) {
    var p = A().kidById(pid); if (!p || !KINDS[kind]) return null;
    var l = window.WK_PASSPORT.stampsFor(p, A().state.trips, { parkStates: M().PARK_STATES }).filter(function (s) { return s.kind === kind && s.area === area; });
    l.sort(function (a, b) { return (a.date || "9") < (b.date || "9") ? -1 : 1; });
    var s = l[0] || { id: "x-" + kind + "-" + area, kind: kind, area: area, date: "", who: [p.id], source: "none" };
    return { p: p, s: s, name: name(s), sub: sub(s) };
  }
  function svg(s, nm) { return window.WK_PASSPORT.stampSVG(s, nm || name(s), { sub: sub(s) }); }
  function svgURL(svg) {
    if (svg.indexOf("xmlns=") < 0) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function path(s, pid) { return encodeURIComponent(pid) + "/" + s.kind + "/" + encodeURIComponent(s.area); }
  /** Buttons for the stamp sheet (person known). */
  function buttons(s, holder) {
    if (!holder || !KINDS[s.kind]) return "";
    var l = (window.FS_STAMPX || []).map(function (f) { try { return f(s, holder, path(s, holder.id)); } catch (e) { return ""; } }).filter(Boolean);
    return l.length ? '<div class="stampx">' + l.join("") + '</div>' : "";
  }
  /** Save a file: the share sheet when the phone has one, else a download. */
  function shareFile(blob, fname, title) {
    var file = null; try { file = new File([blob], fname, { type: blob.type }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: title || "" }).then(function () { return "shared"; }, function (e) { if (e && e.name === "AbortError") return "cancelled"; return download(blob, fname); });
    return Promise.resolve(download(blob, fname));
  }
  function download(blob, fname) {
    var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000); return "downloaded";
  }
  window.FS_STAMPX = window.FS_STAMPX || [];
  window.FS_SX = { find: find, name: name, sub: sub, svg: svg, svgURL: svgURL, loadImg: loadImg, buttons: buttons, path: path, shareFile: shareFile, download: download };
})();
