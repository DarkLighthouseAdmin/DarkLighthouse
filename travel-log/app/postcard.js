/* Famstamp: postcards to grandparents from any stamp (v65). A 6x4 inch card: the front shows the stamp (or the trip's
   photo with the stamp on it), the back has the kid's message, a stamp box and the address. "Send a postcard" saves the
   request on this phone (meta.postcards, never synced or sent anywhere). Mailing it for you is "coming soon"; until then
   print it yourself (6x4 card stock, or letter paper and trim). No print vendor, no price, no payment.
   Routes: #/postcard/<personId>/<kind>/<area> (make one), #/postcards (saved), #/postcards/<id> (one: mail / print). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(typeof require === "function" ? require("./brand.js") : null);
  else root.FS_POSTCARD = factory(root.FS_BRAND);
})(typeof self !== "undefined" ? self : this, function (BR) {
  "use strict";
  var MSG_MAX = 300, KEEP = 50;
  var STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI AS MP AA AE AP".split(" ");
  function brand() { return BR || (typeof self !== "undefined" && self.FS_BRAND) || { NAME: "Famstamp", INK: "#16283a", ACCENT: "#c8553d" }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clean(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
  function wrap(t, max, lines) {
    var out = [];
    String(t || "").split(/\n/).forEach(function (para) {
      var cur = ""; para.split(/\s+/).filter(Boolean).forEach(function (w) {
        while (w.length > max) { if (cur) { out.push(cur); cur = ""; } out.push(w.slice(0, max)); w = w.slice(max); }
        if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
      });
      out.push(cur);
    });
    while (out.length && !out[out.length - 1]) out.pop();
    if (out.length > lines) { out = out.slice(0, lines); out[lines - 1] = out[lines - 1].replace(/.{0,1}$/, "…"); }
    return out;
  }
  /** Tidy an address; returns { to, errors: [] }. US addresses (the mail step will be US-only to start). */
  function checkAddress(a) {
    a = a || {}; var to = { name: clean(a.name, 40), line1: clean(a.line1, 60), line2: clean(a.line2, 60), city: clean(a.city, 40), state: clean(a.state, 2).toUpperCase(), zip: clean(a.zip, 10) }, errors = [];
    if (!to.name) errors.push("Who is it for?");
    if (!to.line1) errors.push("Add the street address.");
    if (!to.city) errors.push("Add the city.");
    if (STATES.indexOf(to.state) < 0) errors.push("Pick the state.");
    if (!/^\d{5}(-\d{4})?$/.test(to.zip)) errors.push("The ZIP code should be 5 digits.");
    return { to: to, errors: errors };
  }
  function newRequest(o, now, id) {
    var chk = checkAddress(o.to), msg = String(o.message || "").replace(/\r/g, "").slice(0, MSG_MAX).trim();
    if (!msg) chk.errors.unshift("Write a message.");
    if (chk.errors.length) return { errors: chk.errors };
    return { request: { id: id || "pc_" + Math.random().toString(36).slice(2, 10), at: now || new Date().toISOString(), pid: o.pid, kind: o.kind, area: o.area, place: clean(o.place, 60),
      front: o.front === "photo" ? "photo" : "stamp", message: msg, from: clean(o.from, 40), to: chk.to, status: "saved" } };
  }
  /** Keep a request in the saved list (newest first, the last KEEP). */
  function keep(list, req) { return [req].concat((list || []).filter(function (x) { return x && x.id !== req.id; })).slice(0, KEEP); }
  function addressBook(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (r) { var t = r && r.to; if (!t) return; var k = (t.name + "|" + t.line1 + "|" + t.zip).toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(t); } });
    return out;
  }
  function inner(svg) { return String(svg || "").replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, ""); }
  /** Front, 600x400 (6x4 in). o = { stampSVG, name, photo (data URL or "") } */
  function frontSVG(o) {
    var b = brand(), ink = b.INK || "#16283a", acc = b.ACCENT || "#c8553d", N = String(o.name || ""), nf = Math.min(64, 520 / Math.max(1, N.length * 0.62));
    var st = '<svg x="' + (o.photo ? 392 : 330) + '" y="' + (o.photo ? 180 : 92) + '" width="' + (o.photo ? 190 : 250) + '" height="' + (o.photo ? 190 : 250) + '" viewBox="0 0 160 160">' + inner(o.stampSVG) + '</svg>';
    var head = '<text x="' + (o.photo ? 30 : 34) + '" y="60" font-family="Georgia, serif" font-style="italic" font-size="30" fill="' + acc + '">Greetings from</text>';
    if (o.photo) {
      return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 400" class="pcsvg" role="img" aria-label="Postcard front: ' + esc(N) + '">' +
        '<defs><clipPath id="pcph"><rect x="18" y="18" width="564" height="364" rx="6"/></clipPath></defs><rect width="600" height="400" fill="#fbf6ea"/>' +
        '<image href="' + o.photo + '" x="18" y="18" width="564" height="364" preserveAspectRatio="xMidYMid slice" clip-path="url(#pcph)"/>' +
        '<rect x="18" y="18" width="380" height="120" fill="#fbf6ea" opacity=".88"/>' + head +
        '<text x="30" y="' + (66 + nf) + '" font-family="Georgia, serif" font-weight="700" font-size="' + Math.min(nf, 54).toFixed(1) + '" fill="' + ink + '">' + esc(N) + '</text>' +
        '<g transform="rotate(-6 487 275)">' + st + '</g></svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" class="pcsvg" role="img" aria-label="Postcard front: ' + esc(N) + '">' +
      '<rect width="600" height="400" fill="#fbf6ea"/><rect x="12" y="12" width="576" height="376" fill="none" stroke="' + ink + '" stroke-width="3" stroke-dasharray="18 8"/>' +
      '<g opacity=".08" stroke="' + ink + '">' + [80, 120, 160, 200, 240, 280, 320, 360].map(function (y) { return '<line x1="30" x2="570" y1="' + y + '" y2="' + y + '"/>'; }).join("") + '</g>' + head +
      wrap(N, 14, 3).map(function (l, i) { return '<text x="34" y="' + (120 + i * (Math.min(nf, 52) + 8)) + '" font-family="Georgia, serif" font-weight="700" font-size="' + Math.min(nf, 52).toFixed(1) + '" fill="' + ink + '">' + esc(l) + '</text>'; }).join("") +
      '<g transform="rotate(-5 455 217)">' + st + '</g>' +
      '<g fill="' + ink + '">' + [[50, 330], [80, 352], [118, 336]].map(function (p) { return '<path transform="translate(' + p[0] + ' ' + p[1] + ') scale(1.1)" d="M0 -9l2.6 5.4 6 .9-4.3 4.2 1 5.9-5.3-2.8-5.3 2.8 1-5.9-4.3-4.2 6-.9z"/>'; }).join("") + '</g></svg>';
  }
  /** Back, 600x400. o = { message, from, to, place } */
  function backSVG(o) {
    var b = brand(), ink = b.INK || "#16283a", to = o.to || {}, lines = wrap(o.message, 30, 9), hand = "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive";
    var addr = [to.name, to.line1, to.line2, [to.city, [to.state, to.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" class="pcsvg" role="img" aria-label="Postcard back">' +
      '<rect width="600" height="400" fill="#fffdf8"/><line x1="320" y1="40" x2="320" y2="360" stroke="' + ink + '" stroke-width="1.4"/>' +
      lines.map(function (l, i) { return '<text x="30" y="' + (62 + i * 30) + '" font-family="' + hand + '" font-size="19" fill="' + ink + '">' + esc(l) + '</text>'; }).join("") +
      (o.from ? '<text x="30" y="' + (62 + lines.length * 30 + 14) + '" font-family="' + hand + '" font-size="19" fill="' + ink + '">— ' + esc(o.from) + '</text>' : "") +
      '<rect x="500" y="28" width="74" height="88" fill="none" stroke="' + ink + '" stroke-width="1.4" stroke-dasharray="4 3"/><text x="537" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="' + ink + '">PLACE</text><text x="537" y="78" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="' + ink + '">STAMP</text><text x="537" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="' + ink + '">HERE</text>' +
      [210, 250, 290, 330].map(function (y, i) { return '<line x1="345" x2="575" y1="' + y + '" y2="' + y + '" stroke="' + ink + '" stroke-width=".8" opacity=".5"/>' + (addr[i] ? '<text x="348" y="' + (y - 8) + '" font-family="Arial, sans-serif" font-size="15" fill="' + ink + '">' + esc(addr[i]) + '</text>' : ""); }).join("") +
      '<text x="30" y="378" font-family="Arial, sans-serif" font-size="9" fill="' + ink + '" opacity=".7">' + esc((o.place ? o.place + " · " : "") + "Made with " + b.NAME) + '</text></svg>';
  }
  var core = { MSG_MAX: MSG_MAX, KEEP: KEEP, STATES: STATES, wrap: wrap, checkAddress: checkAddress, newRequest: newRequest, keep: keep, addressBook: addressBook, frontSVG: frontSVG, backSVG: backSVG };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function X() { return window.FS_SX; }
  function saved() { var l = A().state.meta.postcards; return Array.isArray(l) ? l : []; }
  function tripPhoto(s) { var t = s.tripId ? A().state.trips.filter(function (x) { return x.id === s.tripId; })[0] : null; return t && t.photoId ? t.photoId : ""; }
  function frontFor(r, F, cb) {
    var svg = X().svg(Object.assign({}, F.s, { holder: F.p.id }), F.name), pid = r.front === "photo" ? tripPhoto(F.s) : "";
    if (!pid) return cb(frontSVG({ stampSVG: svg, name: F.name }));
    A().photoURL(pid).then(function (u) { cb(frontSVG({ stampSVG: svg, name: F.name, photo: u || "" })); }, function () { cb(frontSVG({ stampSVG: svg, name: F.name })); });
  }
  var draft = {};
  function make(pid, kind, area) {
    var F = X().find(pid, kind, area); if (!F) { location.hash = "#/"; return; }
    var esc_ = M().esc, who = M().who(F.p), k = pid + kind + area, hasPhoto = !!tripPhoto(F.s), book = addressBook(saved());
    if (draft.key !== k) draft = { key: k, front: "stamp", message: "", from: String(who).split(/\s+/)[0], to: book[0] || {} };
    document.title = "Postcard · " + F.name;
    var to = draft.to || {};
    A().main.innerHTML = '<a class="back" href="#/p/' + esc_(F.p.id) + '/passport">← ' + esc_(who) + '\'s passport</a><h1>💌 A postcard from ' + esc_(F.name) + '</h1>' +
      '<div class="pcprev"><div id="pcfront" class="pccard"></div><div id="pcback" class="pccard"></div></div>' +
      (hasPhoto ? '<div class="seg pcseg" role="group" aria-label="Front"><button type="button" data-front="stamp" class="' + (draft.front === "stamp" ? "on" : "") + '">Stamp front</button><button type="button" data-front="photo" class="' + (draft.front === "photo" ? "on" : "") + '">Trip photo front</button></div>' : "") +
      '<div class="panel"><div class="field"><label for="pcmsg">Message</label><textarea id="pcmsg" rows="4" maxlength="' + MSG_MAX + '" placeholder="Dear Grandma, today we…">' + esc_(draft.message) + '</textarea></div>' +
      '<div class="field"><label for="pcfrom">Signed</label><input id="pcfrom" maxlength="40" value="' + esc_(draft.from) + '"></div>' +
      (book.length > 1 ? '<div class="field"><label for="pcbook">Send to someone you\'ve sent to before</label><select id="pcbook"><option value="">Someone new</option>' + book.map(function (t, i) { return '<option value="' + i + '">' + esc_(t.name + ", " + t.city) + '</option>'; }).join("") + '</select></div>' : "") +
      '<div class="field"><label for="pcname">To</label><input id="pcname" maxlength="40" autocomplete="off" placeholder="Grandma and Grandpa" value="' + esc_(to.name || "") + '"></div>' +
      '<div class="field"><label for="pcl1">Street address</label><input id="pcl1" maxlength="60" autocomplete="off" value="' + esc_(to.line1 || "") + '"><input id="pcl2" maxlength="60" autocomplete="off" placeholder="Apt, suite (optional)" value="' + esc_(to.line2 || "") + '"></div>' +
      '<div class="pcrow"><div class="field"><label for="pccity">City</label><input id="pccity" maxlength="40" autocomplete="off" value="' + esc_(to.city || "") + '"></div>' +
      '<div class="field"><label for="pcst">State</label><select id="pcst"><option value=""></option>' + STATES.map(function (s) { return '<option' + (s === to.state ? " selected" : "") + '>' + s + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="pczip">ZIP</label><input id="pczip" inputmode="numeric" maxlength="10" autocomplete="off" value="' + esc_(to.zip || "") + '"></div></div>' +
      '<p class="small muted">The address stays on this phone. It isn\'t synced or sent anywhere.</p><p class="pcerr small" role="alert"></p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="pcsave">💌 Send a postcard</button></div></div>';
    var $ = function (q) { return A().main.querySelector(q); };
    function read() { draft.message = $("#pcmsg").value; draft.from = $("#pcfrom").value; draft.to = { name: $("#pcname").value, line1: $("#pcl1").value, line2: $("#pcl2").value, city: $("#pccity").value, state: $("#pcst").value, zip: $("#pczip").value }; }
    function preview() {
      read(); frontFor(draft, F, function (svg) { $("#pcfront").innerHTML = svg; });
      $("#pcback").innerHTML = backSVG({ message: draft.message || "Your message goes here.", from: draft.from, to: checkAddress(draft.to).to, place: F.name });
    }
    preview();
    A().main.querySelectorAll("input, textarea, select:not(#pcbook)").forEach(function (el) { el.addEventListener("input", preview); });
    A().main.querySelectorAll("[data-front]").forEach(function (b) { b.onclick = function () { read(); draft.front = b.dataset.front; make(pid, kind, area); }; });
    if ($("#pcbook")) $("#pcbook").onchange = function () { read(); if (this.value !== "") draft.to = book[+this.value]; else draft.to = {}; make(pid, kind, area); };
    $("#pcsave").onclick = function () {
      read();
      var r = newRequest({ pid: F.p.id, kind: kind, area: area, place: F.name, front: draft.front, message: draft.message, from: draft.from, to: draft.to });
      if (r.errors) { $(".pcerr").textContent = r.errors.join(" "); return; }
      A().setMeta("postcards", keep(saved(), r.request)).then(function () { draft = {}; A().toast("💌 Postcard saved"); location.hash = "#/postcards/" + r.request.id; });
    };
  }
  function one(id) {
    var r = saved().filter(function (x) { return x.id === id; })[0]; if (!r) { location.hash = "#/postcards"; return; }
    var F = X().find(r.pid, r.kind, r.area), esc_ = M().esc; if (!F) { location.hash = "#/postcards"; return; }
    document.title = "Postcard · " + r.place;
    A().main.innerHTML = '<a class="back noprint" href="#/postcards">← Postcards</a><h1 class="noprint">💌 Postcard to ' + esc_(r.to.name) + '</h1>' +
      '<div class="pcprev pcpages"><div id="pcfront" class="pccard pcpage"></div><div id="pcback" class="pccard pcpage"></div></div>' +
      '<div class="panel noprint pcorder"><h3>How should it get there?</h3>' +
      '<div class="pcopt soon"><b>📮 Mail it for me</b><span class="small">Coming soon: we\'ll print it on card stock and mail it with a stamp. Your postcard is saved, so it\'ll be ready.</span><button type="button" class="btn btn-ghost" disabled aria-disabled="true">Coming soon</button></div>' +
      '<div class="pcopt"><b>🖨️ Print it yourself (free)</b><span class="small">Prints the front and back as two 6×4 inch pages. Use 4×6 photo card stock, or print on letter paper and trim.</span><button type="button" class="btn btn-primary" id="pcprint">Print or save as PDF</button></div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" id="pcdel">Delete this postcard</button></div></div>';
    frontFor(r, F, function (svg) { A().main.querySelector("#pcfront").innerHTML = svg; });
    A().main.querySelector("#pcback").innerHTML = backSVG(r);
    A().main.querySelector("#pcprint").onclick = function () { document.body.classList.add("pcprintview"); setTimeout(function () { window.print(); }, 60); };
    A().main.querySelector("#pcdel").onclick = function () {   // v68: undo bar instead of a confirm dialog
      var before = saved();
      A().setMeta("postcards", before.filter(function (x) { return x.id !== id; })).then(function () {
        location.hash = "#/postcards";
        var u = function () { A().setMeta("postcards", before).then(function () { A().toast("Postcard is back"); A().route(); }); };
        if (window.FS_WHO && window.FS_WHO.undoToast) window.FS_WHO.undoToast("Postcard deleted", u); else A().toast("Postcard deleted");
      });
    };
  }
  function list() {
    var l = saved(), esc_ = M().esc; document.title = "Postcards";
    A().main.innerHTML = '<h1>💌 Postcards</h1><p class="muted">Open any stamp in a passport and tap “Send a postcard”. Saved postcards stay on this phone.</p>' +
      (l.length ? '<ul class="pclist">' + l.map(function (r) { return '<li><a href="#/postcards/' + esc_(r.id) + '"><b>' + esc_(r.place) + '</b> to ' + esc_(r.to.name) + ' <span class="small muted">' + esc_(M().prettyDate(String(r.at).slice(0, 10))) + ' · saved</span></a></li>'; }).join("") + '</ul>' : '<p class="small">No postcards yet.</p>');
  }
  window.addEventListener("afterprint", function () { document.body.classList.remove("pcprintview"); });
  window.addEventListener("hashchange", function () { document.body.classList.remove("pcprintview"); });
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) {
    if (h[0] === "postcard") { make(decodeURIComponent(h[1] || ""), h[2], decodeURIComponent(h[3] || "")); return true; }
    if (h[0] === "postcards") { if (h[1]) one(decodeURIComponent(h[1])); else list(); return true; }
    return false;
  });
  (window.FS_STAMPX = window.FS_STAMPX || []).push(function (s, holder, path) { return '<a class="btn btn-ghost btn-sm" href="#/postcard/' + path + '">💌 Send a postcard</a>'; });
  return core;
});
