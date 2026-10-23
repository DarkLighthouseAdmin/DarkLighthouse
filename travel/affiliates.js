/* Swaps plain partner links for tracked ones from /travel/affiliates.json, only for programs marked "active".
   Links keep rel="sponsored nofollow noopener". Nothing changes until a tracked_url is filled in. */
(function () {
  "use strict";
  var links = document.querySelectorAll("a[data-affiliate]");
  if (!links.length || !window.fetch) return;
  fetch("/travel/affiliates.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.links) return;
    links.forEach(function (a) {
      var x = j.links[a.getAttribute("data-affiliate")];
      if (x && x.status === "active" && /^https:\/\//.test(x.tracked_url || "")) a.href = x.tracked_url;
      a.addEventListener("click", function () { if (typeof gtag === "function") gtag("event", "affiliate_click", { partner: a.getAttribute("data-affiliate") }); });
    });
  }).catch(function () {});
})();
