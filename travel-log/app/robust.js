/* v70+: keeping the log safe. Asks the browser to keep this app's storage (navigator.storage.persist), keeps a small
   privacy-safe error log on this phone, and a "Report a problem" page that opens an email to support with the app
   version and that log. Nothing is sent automatically. More safety pieces land here in later versions. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_ROBUST = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MAX_LOG = 15;
  /** Strip anything personal from an error line: emails, links, long numbers, ids, and anything in quotes (place names, notes). */
  function clean(s) {
    return String(s == null ? "" : s)
      .replace(/[^\s@()<>"']+@[^\s@()<>"']+\.[A-Za-z]{2,}/g, "<email>")
      .replace(/(https?:\/\/[^\s/)]+)?(\/[^\s:)?#]*\/)?([A-Za-z0-9_.-]+\.js)(\?[^\s:)]*)?/g, "$3")
      .replace(/https?:\/\/\S+/g, "<url>").replace(/(["'“‘`])[^"'”’`]{0,200}\1/g, "<text>")
      .replace(/\b(person|trip|photo|fam)_[A-Za-z0-9]+/g, "$1_<id>").replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>").replace(/\d{5,}/g, "<n>")
      .replace(/\s+/g, " ").trim().slice(0, 180);
  }
  /** Add one entry to the log (newest last, at most MAX_LOG, repeats counted instead of added). */
  function addLog(log, msg, at) {
    log = Array.isArray(log) ? log.slice() : []; msg = clean(msg); if (!msg) return log;
    var last = log[log.length - 1]; if (last && last.m === msg) { last.n = (last.n || 1) + 1; last.at = at; return log; }
    log.push({ m: msg, at: at, n: 1 }); return log.slice(-MAX_LOG);
  }
  /** The email to support: subject + body with version, device kind and the log. */
  function reportMail(o) {
    var to = o.to || "support@darklighthousesolutions.com";
    var body = "What happened:\n" + (o.what || "(please describe)") + "\n\n---\nApp version: " + (o.version || "?") + "\nDevice: " + (o.platform || "?") + "\nScreen: " + (o.route || "?") +
      "\nRecent errors on this phone (no trip names, notes, photos or emails):\n" + ((o.log || []).map(function (e) { return "- " + String(e.at || "").slice(0, 16) + " " + e.m + (e.n > 1 ? " (x" + e.n + ")" : ""); }).join("\n") || "- none");
    return "mailto:" + to + "?subject=" + encodeURIComponent("Famstamp problem report " + (o.version || "")) + "&body=" + encodeURIComponent(body);
  }
  var core = { clean: clean, addLog: addLog, reportMail: reportMail, MAX_LOG: MAX_LOG };
  if (typeof document === "undefined") return core;

  function A() { return window.MLTL_APP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var KEY = "fs-errlog";
  function readLog() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function log(msg) { try { localStorage.setItem(KEY, JSON.stringify(addLog(readLog(), msg, new Date().toISOString()))); } catch (e) {} }
  window.addEventListener("error", function (e) { if (e && e.filename && !/\/travel-log\/app\//.test(e.filename)) return; log((e && e.message) || "error"); });
  window.addEventListener("unhandledrejection", function (e) { var r = e && e.reason; if (r && (r.name === "AbortError" || /Failed to fetch|NetworkError|Load failed/.test(r.message || ""))) return; log((r && (r.message || r.name)) || String(r)); });

  // B1: ask the browser not to clear this app's storage when the phone runs low
  function persist() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
    return navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).then(function (ok) { try { localStorage.setItem("fs-persist", ok ? "1" : "0"); } catch (e) {} return ok; }).catch(function () { return null; });
  }

  function platformOf() { return window.FS_LAUNCH && window.FS_LAUNCH.platform ? window.FS_LAUNCH.platform(navigator.userAgent) : "?"; }
  function viewReport() {
    var a = A(), v = a.version, l = readLog(), sup = (window.FS_BRAND && window.FS_BRAND.CONTACT && window.FS_BRAND.CONTACT.support) || "support@darklighthousesolutions.com";
    a.main.innerHTML = '<a class="back" href="#/more">← More</a><h1>Report a problem</h1><p class="lede small">Tell us what went wrong. Your email app opens with a note to <b>' + esc(sup) + '</b>; nothing is sent until you press Send there.</p>' +
      '<div class="panel"><div class="field" style="margin-top:0"><label for="rpwhat">What happened?</label><textarea id="rpwhat" rows="4" maxlength="1500" placeholder="e.g. I tapped Save on a trip and it spun forever"></textarea></div>' +
      '<p class="small">Added to the email: app version <b>' + esc(v) + '</b>, <b>' + esc(platformOf()) + '</b>, and ' + (l.length ? '<b>' + l.length + '</b> recent error ' + (l.length === 1 ? "line" : "lines") : "no error lines") + ' from this phone. No trip names, notes, photos or email addresses are included.</p>' +
      (l.length ? '<details><summary>See exactly what\'s included</summary><pre class="errlog">' + esc(l.map(function (e) { return String(e.at).slice(0, 16) + " " + e.m + (e.n > 1 ? " (x" + e.n + ")" : ""); }).join("\n")) + '</pre></details>' : "") +
      '<div class="actions"><a class="btn btn-primary" id="rpsend" href="#">Open my email app</a>' + (l.length ? '<button type="button" class="btn btn-ghost" id="rpclear">Clear the error lines</button>' : "") + '</div></div>';
    document.title = "Report a problem · Famstamp";
    var s = document.getElementById("rpsend");
    s.onclick = function () { s.href = reportMail({ to: sup, what: document.getElementById("rpwhat").value.trim(), version: v, platform: platformOf(), route: (window.FS_LAUNCH && window.FS_LAUNCH.routeKey ? window.FS_LAUNCH.routeKey(sessionStorage.getItem("fs-last-route") || "") : ""), log: readLog() }); };
    var c = document.getElementById("rpclear"); if (c) c.onclick = function () { localStorage.removeItem(KEY); viewReport(); };
  }
  window.addEventListener("hashchange", function (e) { try { if (!/#\/report/.test(location.hash)) sessionStorage.setItem("fs-last-route", location.hash); else if (e && e.oldURL) sessionStorage.setItem("fs-last-route", e.oldURL.split("#")[1] ? "#" + e.oldURL.split("#")[1] : ""); } catch (x) {} });
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "report") return false; viewReport(); return true; });
  setTimeout(persist, 1500);
  core.persist = persist; core.readLog = readLog; core.log = log;
  return core;
});
