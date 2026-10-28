/* Famstamp dark mode switch. Loaded in <head> before the page draws, so there's no white flash.
   Choice is kept on this device ("auto" follows the phone's setting; "light" or "dark" pins it). */
(function () {
  var KEY = "fs-theme", mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function pref() { try { var v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "auto"; } catch (e) { return "auto"; } }
  function apply() {
    var p = pref(), dark = p === "dark" || (p === "auto" && !!(mq && mq.matches));
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#0c1823" : "#16283a");
  }
  function set(v) { try { if (v === "light" || v === "dark") localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} apply(); }
  apply();
  if (mq) { if (mq.addEventListener) mq.addEventListener("change", apply); else if (mq.addListener) mq.addListener(apply); }
  window.FS_THEME = { get: pref, set: set, isDark: function () { return document.documentElement.getAttribute("data-theme") === "dark"; } };
})();
