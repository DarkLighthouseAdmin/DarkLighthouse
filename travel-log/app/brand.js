/* Famstamp brand: the app's name, tagline, colors and logo in ONE place. To rename the app, change NAME (and TAGLINE) here;
   the share cards, postcards, QR station posters and Cousin Cup pages all read from this, and the header logo is redrawn
   from it on load. The logo is our own stamp-frame mark: a dashed frame, a star, a little plane and the name. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_BRAND = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var B = {
    NAME: "Famstamp",                       // the app's name everywhere new (cards, posters, postcards)
    TAGLINE: "stamp every trip",
    URL_TEXT: "darklighthousesolutions.com/travel-log",
    APP_PATH: "/travel-log/app/",
    INK: "#16283a",                         // the logo/ink color
    ACCENT: "#c8553d",
    PAPER: "#fbf6ea"
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /** The logo as SVG (viewBox 150x50). color = ink color (default currentColor). */
  function logoSVG(color, cls) {
    var c = color || "currentColor", n = String(B.NAME).toUpperCase();
    return '<svg xmlns="http://www.w3.org/2000/svg" class="' + esc(cls || "fslogo") + '" viewBox="0 0 150 50" aria-hidden="true" focusable="false"><g transform="rotate(-4 75 25)" fill="' + c + '" stroke="' + c + '">' +
      '<rect x="3.5" y="4.5" width="143" height="41" rx="6" fill="none" stroke-width="2.6" stroke-dasharray="38 1.6 24 1.2 51 2 30 1"/><rect x="8" y="9" width="134" height="32" rx="3.5" fill="none" stroke-width="1"/>' +
      '<path stroke="none" d="M15.6 14.8l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z"/>' +
      '<path stroke="none" transform="translate(130.5 22.5) scale(.72) translate(-127 -22.5)" d="M134.4 18.6l-6.7 1.6-3.3-3.1-1.4.4 1.9 3.5-3.6.9-1.3-1.3-1 .3 1 2.1-.1 2.4.9-.1.6-1.7 3.6-.9.2 4 1.4-.3 1.6-4.4 6.7-1.6c.9-.2 1.4-.9 1.2-1.4s-.9-.6-1.8-.3z"/>' +
      '<text x="73" y="27.6" text-anchor="middle" font-family="Georgia,\'Times New Roman\',serif" font-weight="700" font-size="17" letter-spacing="1.4" textLength="88" lengthAdjust="spacingAndGlyphs" stroke="none">' + esc(n) + '</text>' +
      '<text x="75" y="38.9" text-anchor="middle" font-family="\'Helvetica Neue\',Arial,sans-serif" font-weight="700" font-size="6.6" letter-spacing="1.4" textLength="96" lengthAdjust="spacingAndGlyphs" stroke="none">' + esc(String(B.TAGLINE).toUpperCase()) + '</text></g></svg>';
  }
  /** The app's address (for QR codes and links), from this page when there is one. */
  function appUrl() {
    if (typeof location !== "undefined" && /^https?:/.test(location.protocol)) return location.origin + location.pathname;
    return "https://" + B.URL_TEXT.replace(/\/travel-log$/, "") + B.APP_PATH;
  }
  B.logoSVG = logoSVG; B.appUrl = appUrl; B.esc = esc;
  if (typeof document !== "undefined") {
    // keep the header name and title in step with NAME (only touches text when the name was changed here)
    var apply = function () {
      var a = document.querySelector(".brand"); if (!a) return;
      if (B.NAME !== "Famstamp" || B.TAGLINE !== "stamp every trip") {
        a.setAttribute("aria-label", B.NAME + " home");
        var t = a.querySelectorAll(".logomark text"); if (t[0]) t[0].textContent = B.NAME.toUpperCase(); if (t[1]) t[1].textContent = String(B.TAGLINE).toUpperCase();
        document.title = document.title.replace(/Famstamp/g, B.NAME);
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  }
  return B;
});
