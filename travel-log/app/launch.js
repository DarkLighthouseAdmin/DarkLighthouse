/* v67 launch basics: Help & feedback (#/help), text size, Export everything (.zip), anonymous error reports and anonymous
   feature-use counts (both off with one switch), and the account and data deletion entry point.
   Privacy rules for what leaves the phone (see /travel-log/privacy/):
   - error reports: app version, error message and stack (emails, long numbers, ids and web addresses scrubbed), which
     screen (e.g. "kid:passport", never an id), and a coarse device type ("Android Chrome"). No user id, device id or IP.
   - usage counts: per day, how many times each screen was opened (e.g. {"home": 4}). No user id, device id or IP.
   Both go to Supabase functions (log_client_error, usage_bump) that only add to anonymous tables. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_LAUNCH = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var LS = { tele: "fs-telemetry", size: "fs-textsize", usage: "fs-usage", errs: "fs-errs", off: "fs-tele-missing" };
  var SIZES = { s: "93.75%", m: "100%", l: "112.5%", xl: "125%" }, SIZE_LABEL = { s: "Small", m: "Standard", l: "Large", xl: "Extra large" };

  // ---------- pure helpers (tested in node) ----------
  /** Removes anything personal-looking from an error text. */
  function scrub(s, max) {
    return String(s == null ? "" : s)
      .replace(/[^\s@()<>"']+@[^\s@()<>"']+\.[A-Za-z]{2,}/g, "<email>")
      .replace(/(https?:\/\/[^\s/)]+)?(\/[^\s:)?#]*\/)?([A-Za-z0-9_.-]+\.js)(\?[^\s:)]*)?/g, "$3")   // keep only the file name
      .replace(/https?:\/\/[^\s)]+/g, "<url>")
      .replace(/\b(person|trip|photo|kid|st|cup)_[A-Za-z0-9]{4,}\b/g, "$1_<id>")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
      .replace(/#\/[^\s)'"]*/g, "#/<route>")
      .replace(/\d{6,}/g, "<n>")
      .slice(0, max || 300);
  }
  /** Which screen, with no ids: "#/p/person_x/passport" -> "kid:passport". */
  function routeKey(hash) {
    var h = String(hash || "").replace(/^#\/?/, "").split("?")[0].split("/");
    var a = (h[0] || "home").toLowerCase(), b = (h[2] || "").toLowerCase();
    if (a === "p" || a === "kid") return "kid:" + (/^[a-z]{2,16}$/.test(b) ? b : "map");
    var sub = (h[1] || "").toLowerCase();
    if (/^(sync|family|stations|postcards|help|cup|kidart)$/.test(a) && /^[a-z]{2,12}$/.test(sub) && !/^[A-Z0-9]{8}$/.test(h[1])) return a + ":" + sub;
    return /^[a-z][a-z0-9_-]{0,30}$/.test(a) ? a : "other";
  }
  /** Coarse device label, e.g. "Android Chrome", "iOS Safari", "Desktop Firefox". */
  function platform(ua) {
    ua = String(ua || "");
    var os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Mac OS X/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : /Linux|CrOS/i.test(ua) ? "Linux" : "Other";
    var br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Other";
    return os + " " + br;
  }
  /** Adds one use to the day's counts (a plain object kept in localStorage). */
  function bump(store, day, key) {
    store = store && typeof store === "object" ? store : {};
    if (!/^[a-z0-9:_-]{1,40}$/.test(key)) return store;
    var d = store[day] = store[day] || {}; if (Object.keys(d).length >= 60 && !(key in d)) return store;
    d[key] = Math.min(200, (d[key] || 0) + 1); return store;
  }
  // ---------- zip (store only, no compression: photos are JPEGs already) ----------
  var CRC = null;
  function crc32(u8) {
    if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var x = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) x = CRC[(x ^ u8[i]) & 0xFF] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) { return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, "utf8")); }
  /** files: [{name, data: Uint8Array|string}] -> Uint8Array of a .zip */
  function zip(files, when) {
    var d = when || new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF,
        dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), data = typeof f.data === "string" ? utf8(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      parts.push(new Uint8Array(h.buffer), name, data); central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (n, p) { return n + p.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    var all = parts.concat(central, [new Uint8Array(e.buffer)]), out = new Uint8Array(off + csize + 22), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; }); return out;
  }
  function dataUrlBytes(u) {
    var m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(String(u || "")); if (!m) return null;
    if (!m[2]) return utf8(decodeURIComponent(m[3]));
    var bin = typeof atob !== "undefined" ? atob(m[3]) : Buffer.from(m[3], "base64").toString("binary"), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return { mime: m[1] || "", bytes: out };
  }
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  /** Builds the export file list from a backup object (the same one "Save a backup file" makes). */
  function exportFiles(backup, brandName, version) {
    var files = [], names = {};
    (backup.kids || []).forEach(function (k) { names[k.id] = k.name; });
    files.push({ name: "backup.json", data: JSON.stringify(backup) });
    var rows = [["date", "end date", "title", "place", "who", "memory", "journal pages", "photo"]];
    (backup.trips || []).forEach(function (t) {
      rows.push([t.date, t.endDate || "", t.title || "", t.place || "", (t.kidIds || []).map(function (id) { return names[id] || ""; }).join("; "), t.memory || "",
        Array.isArray(t.journal) ? t.journal.length : 0, t.photoId ? "photos/" + t.photoId + ".jpg" : ""]);
    });
    files.push({ name: "trips.csv", data: rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n") + "\n" });
    var n = 0;
    (backup.photos || []).forEach(function (ph) {
      var b = ph && ph.dataUrl && dataUrlBytes(ph.dataUrl); if (!b || !b.bytes) return;
      var ext = /png/.test(b.mime) ? "png" : /webp/.test(b.mime) ? "webp" : "jpg";
      files.push({ name: "photos/" + String(ph.id).replace(/[^A-Za-z0-9_-]/g, "") + "." + ext, data: b.bytes }); n++;
    });
    files.unshift({ name: "README.txt", data: [
      brandName + " export, made " + (backup.exportedAt || "") + " by version " + version + ".",
      "",
      "backup.json  everything in the app: people, passports and stamps, trips, journal pages, kid-drawn stamps and settings.",
      "             To put it back, open the app, go to Back up > Restore everything and pick this file.",
      "trips.csv    your trips as a spreadsheet.",
      "photos/      " + n + " photo(s), as saved in the app (shrunk, with location and camera details already removed).",
      "",
      "Printed book: open a person's Travel Book in the app and choose Print or save as PDF.",
      "Questions: see Help & feedback in the app."].join("\n") });
    return files;
  }

  // ---------- browser part ----------
  if (typeof document === "undefined") return { scrub: scrub, routeKey: routeKey, platform: platform, bump: bump, zip: zip, crc32: crc32, exportFiles: exportFiles, dataUrlBytes: dataUrlBytes, SIZES: SIZES };

  function ls(k, v) { try { if (arguments.length > 1) { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } return localStorage.getItem(k); } catch (e) { return null; } }
  function B() { return window.FS_BRAND || { NAME: "Famstamp", CONTACT: {}, PAGES: {} }; }
  function A() { return window.MLTL_APP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function version() { return (A() && A().version) || ""; }

  // text size: applied before anything is drawn
  function setSize(k) { if (!SIZES[k]) k = "m"; document.documentElement.style.fontSize = k === "m" ? "" : SIZES[k]; document.documentElement.setAttribute("data-textsize", k); ls(LS.size, k === "m" ? null : k); }
  setSize(ls(LS.size) || "m");

  function teleOn() { var demo = false; try { demo = sessionStorage.getItem("fs-demo") === "1"; } catch (e) {} return !demo && ls(LS.tele) !== "off" && !/[?&]notele\b/.test(location.search); }
  function cfg() { return window.MLTL_SYNC_CONFIG; }
  function send(fn, body) {
    var c = cfg(); if (!c || !c.url || !c.key || !teleOn() || ls(LS.off) === today() || !/^https?:/.test(location.protocol)) return Promise.resolve(false);
    if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(false);
    return fetch(c.url + "/rest/v1/rpc/" + fn, { method: "POST", keepalive: true, headers: { apikey: c.key, "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (r.status === 404) ls(LS.off, today()); return r.ok; })   // the SQL isn't installed yet: try again tomorrow
      .catch(function () { return false; });
  }

  // ---------- error reports ----------
  var sent = 0, seen = {};
  function report(kind, msg, stack) {
    if (!teleOn() || sent >= 5) return;
    msg = scrub(msg, 300); if (!msg || /ResizeObserver loop|Script error\.?$/.test(msg) || seen[msg]) return; seen[msg] = 1;
    var day = today(), q; try { q = JSON.parse(ls(LS.errs) || "{}"); } catch (e) { q = {}; }
    if (q.day !== day) q = { day: day, n: 0 }; if (q.n >= 20) return; q.n++; ls(LS.errs, JSON.stringify(q));
    sent++;
    send("log_client_error", { p_version: version() || "?", p_kind: kind, p_message: msg, p_stack: scrub(String(stack || "").split("\n").slice(0, 6).join("\n"), 800),
      p_route: routeKey(location.hash).slice(0, 40), p_platform: platform(navigator.userAgent) });
  }
  window.addEventListener("error", function (e) {
    if (e && e.filename && !/\/travel-log\/app\//.test(e.filename)) return;   // browser extensions and other sites' scripts
    report("error", (e && e.message) || "error", e && e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason; if (r && (r.name === "AbortError" || /Failed to fetch|NetworkError|Load failed/.test(r.message || ""))) return;   // being offline isn't a bug
    report("rejection", (r && (r.message || r.name)) || String(r), r && r.stack);
  });

  // ---------- anonymous usage counts ----------
  function readUsage() { try { return JSON.parse(ls(LS.usage) || "{}") || {}; } catch (e) { return {}; } }
  function track(key) {
    if (!teleOn()) return;
    ls(LS.usage, JSON.stringify(bump(readUsage(), today(), key)));
    flush(false);
  }
  var lastFlush = 0;
  function flush(force) {
    if (!teleOn()) return;
    var u = readUsage(), t = today(), days = Object.keys(u);
    if (!days.length) return;
    if (!force && days.every(function (d) { return d === t; }) && Date.now() - lastFlush < 30 * 60 * 1000) return;
    lastFlush = Date.now();
    days.forEach(function (d) {
      var counts = u[d]; delete u[d];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !counts || !Object.keys(counts).length) return;
      send("usage_bump", { p_day: d, p_counts: counts }).then(function (ok) {
        if (ok) return; var now = readUsage(); now[d] = now[d] || {};   // put them back for next time
        Object.keys(counts).forEach(function (k) { now[d][k] = Math.min(200, (now[d][k] || 0) + counts[k]); });
        Object.keys(now).sort().slice(0, -8).forEach(function (old) { delete now[old]; }); ls(LS.usage, JSON.stringify(now));
      });
    });
    ls(LS.usage, JSON.stringify(u));
  }
  var lastKey = null;
  function onRoute() { var k = routeKey(location.hash); if (k !== lastKey) { lastKey = k; track(k); } }
  window.addEventListener("hashchange", onRoute);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(true); });
  setTimeout(onRoute, 1500);

  // ---------- export everything ----------
  function exportZip() {
    var app = A(); if (!app || !app.doBackupData) return Promise.reject(new Error("Not ready yet"));
    app.toast("Making your zip…");
    return app.doBackupData().then(function (backup) {
      var files = exportFiles(backup, B().NAME, version()), bytes = zip(files);
      var blob = new Blob([bytes], { type: "application/zip" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = String(B().NAME).toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-export-" + today() + ".zip";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      track("export:zip");
      return app.setMeta("lastBackupAt", backup.exportedAt).then(function () { app.toast("Export saved: " + files.length + " files"); return files.length; });
    });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-export-zip]"); if (!t) return;
    e.preventDefault(); exportZip().catch(function (x) { A() && A().toast("Couldn't make the zip: " + x.message); });
  });

  // ---------- Help & feedback ----------
  function deviceInfo() {
    var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    return [B().NAME + " " + version(), platform(navigator.userAgent) + (standalone ? ", installed app" : ", in the browser"),
      "Screen " + screen.width + "x" + screen.height + ", text size " + (SIZE_LABEL[document.documentElement.getAttribute("data-textsize")] || "Standard"),
      "Language " + (navigator.language || "?") + ", " + (navigator.onLine === false ? "offline" : "online"),
      "Family Sync " + (window.MLTL_SYNC && window.MLTL_SYNC.isOn && window.MLTL_SYNC.isOn() ? "on" : "off")];
  }
  function mailto(addr, subject, body) { return "mailto:" + addr + "?subject=" + encodeURIComponent(subject) + (body ? "&body=" + encodeURIComponent(body) : ""); }
  function syncRole() { var s = window.MLTL_SYNC; var c = s && s.cup && s.cup.cfg && s.cup.cfg(); return c ? c.role || "adult" : null; }
  function helpView() {
    var b = B(), C = b.CONTACT || {}, P = b.PAGES || {}, info = deviceInfo(), size = document.documentElement.getAttribute("data-textsize") || "m";
    var bug = mailto(C.support, "[" + b.NAME + " " + version() + "] Bug report", "What happened:\n\nWhat you expected:\n\nSteps (if you remember):\n\n---\n" + info.join("\n") + "\n(No names, trips or photos are attached.)");
    var role = syncRole();
    A().main.innerHTML = '<a class="back" href="#/">← Home</a><h1>💬 Help &amp; feedback</h1>' +
      '<div class="panel"><h2>Get help or report a bug</h2><p class="small muted">Opens your email app with a message to us. It includes only the app version and device details shown below. No names, trips, photos or account details are attached.</p>' +
      '<div class="actions"><a class="btn btn-primary" id="hbug" href="' + esc(bug) + '">🐞 Report a bug</a><a class="btn btn-ghost" href="' + esc(mailto(C.support, b.NAME + " question", "\n\n---\n" + b.NAME + " " + version())) + '">✉️ Ask a question</a><a class="btn btn-ghost" href="' + esc(mailto(C.support, b.NAME + " idea")) + '">💡 Suggest an idea</a></div>' +
      '<details class="small"><summary>What gets included</summary><ul id="hinfo">' + info.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + '</ul></details></div>' +
      '<div class="panel"><h2>Text size</h2><div class="seg" role="group" aria-label="Text size">' + Object.keys(SIZES).map(function (k) { return '<button type="button" data-size="' + k + '" aria-pressed="' + (k === size) + '">' + SIZE_LABEL[k] + '</button>'; }).join("") + '</div></div>' +
      '<div class="panel"><h2>Your data</h2><p class="small muted">Everything you add is kept on this device' + (role ? " and in your family's private cloud copy" : "") + '. Download all of it any time.</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-export-zip>📦 Export everything (.zip)</button><a class="btn btn-ghost" href="#/backup">Back up and restore</a></div>' +
      '<label class="chk"><input type="checkbox" id="htele"' + (teleOn() ? " checked" : "") + '> Send anonymous usage counts and error reports</label>' +
      '<p class="small muted">Counts which screens get opened each day and sends crash details, so we can fix bugs and know what to improve. No names, trips, photos, ids or locations. No ads, no third-party trackers.</p></div>' +
      '<div class="panel" id="hdelete"><h2>Delete my account and data</h2>' +
        (role === "owner" ? '<p class="small muted">As the family organizer you can delete the family\'s cloud copy and your sign-in.</p><div class="actions"><a class="btn btn-danger" href="#/sync/leave">Delete my account and data…</a></div>'
        : role === "kid" ? '<p class="small muted">Ask a parent. Only the family organizer can delete the family\'s data.</p>'
        : role ? '<p class="small muted">Only the family organizer can delete the whole family\'s data. You can delete your own sign-in or leave the family on <a href="#/sync/leave">Leave or delete</a>.</p>'
        : '<p class="small muted">You don\'t have a cloud account: everything is only on this device. To erase it, use <a href="#/backup">Back up › Start over</a>, or remove the app.</p>') +
        '<p class="small muted">Can\'t open the app? See <a href="' + esc(P.deletion) + '" target="_blank" rel="noopener">how to request deletion</a>.</p></div>' +
      '<div class="panel"><h2>Policies and contacts</h2><ul class="hlinks">' +
        '<li><a href="' + esc(P.privacy) + '" target="_blank" rel="noopener">Privacy policy</a> · <a href="' + esc(P.terms) + '" target="_blank" rel="noopener">Terms</a> · <a href="' + esc(P.deletion) + '" target="_blank" rel="noopener">Deleting your data</a></li>' +
        '<li>Help, bugs and account deletion: <a href="mailto:' + esc(C.support) + '">' + esc(C.support) + '</a></li>' +
        '<li>Privacy and parent requests: <a href="mailto:' + esc(C.privacy) + '">' + esc(C.privacy) + '</a></li>' +
        '<li>Parks, libraries, museums and stamp stations: <a href="mailto:' + esc(C.partners) + '">' + esc(C.partners) + '</a></li>' +
        '<li>Press: <a href="mailto:' + esc(C.press) + '">' + esc(C.press) + '</a></li></ul>' +
      '<p class="small muted">' + esc(b.NAME) + ' · Version ' + esc(version()) + '</p></div>';
    Array.prototype.forEach.call(document.querySelectorAll("[data-size]"), function (x) {
      x.onclick = function () { setSize(x.getAttribute("data-size")); helpView(); var f = document.querySelector('[data-size="' + x.getAttribute("data-size") + '"]'); if (f) f.focus(); };
    });
    document.getElementById("htele").onchange = function (e) { ls(LS.tele, e.target.checked ? null : "off"); if (!e.target.checked) ls(LS.usage, null); A().toast(e.target.checked ? "Thanks! Anonymous counts are on." : "Anonymous counts and error reports are off."); };
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "help") return false; helpView(); return true; });

  return { scrub: scrub, routeKey: routeKey, platform: platform, bump: bump, zip: zip, crc32: crc32, exportFiles: exportFiles, dataUrlBytes: dataUrlBytes, SIZES: SIZES,
           track: track, flush: flush, exportZip: exportZip, report: report, setSize: setSize, teleOn: teleOn, deviceInfo: deviceInfo };
});
