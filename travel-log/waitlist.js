/* Waitlist form: stores the email through the join_waitlist database function (rate limited, adults only). No other tracking. */
(function () {
  "use strict";
  var f = document.getElementById("wl"); if (!f) return;
  var msg = document.getElementById("wlmsg"), btn = f.querySelector("button");
  var text = { ok: "Thanks! We'll email you when it launches.", invalid: "That email doesn't look right.", adult_only: "Please tick the box to confirm you're 18 or older.",
    slow_down: "Too many tries. Please try again tomorrow.", error: "Something went wrong. Please try again later." };
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("wlemail").value.trim(), adult = document.getElementById("wladult").checked, c = window.MLTL_SYNC_CONFIG;
    if (!adult) { msg.textContent = text.adult_only; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = text.invalid; return; }
    if (!c || !c.url || !c.key) { msg.textContent = text.error; return; }
    btn.disabled = true; msg.textContent = "Saving…";
    fetch(c.url + "/rest/v1/rpc/join_waitlist", { method: "POST", headers: { apikey: c.key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_source: (new URLSearchParams(location.search).get("src") || "site").replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "site", p_adult: true }) })
      .then(function (r) { return r.ok ? r.json() : "error"; })
      .then(function (res) { msg.textContent = text[res] || text.error; if (res === "ok") f.reset(); })
      .catch(function () { msg.textContent = text.error; })
      .then(function () { btn.disabled = false; });
  });
})();
