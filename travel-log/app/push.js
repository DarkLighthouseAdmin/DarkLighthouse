/* Famstamp: push notifications (v61). Opt-in only: nothing is asked or sent until the person taps "Turn on notifications",
   and every type starts off. Real pushes come from the famstamp-push Supabase function (Family Sync users); "Send me a
   test of each" asks it for one of every type right now, and falls back to an on-phone preview if the server part isn't live. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_PUSH = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var KINDS = [
    { id: "reactions", label: "Someone reacted", desc: "When family reacts ❤️ 😮 👏 😂 to your stuff" },
    { id: "grandkids", label: "A grandkid earned something", desc: "New stamps and badges (for grandparents)" },
    { id: "onthisday", label: "On this day", desc: "Trips from this day, or this month, in past years" },
    { id: "countdown", label: "Trip countdown", desc: "30, 14, 7, 3, 2 and 1 days before a planned trip" },
    { id: "nudge", label: "Time for a stamp?", desc: "A gentle nudge if nobody has stamped in 3 weeks" },
    { id: "recap", label: "Weekly family recap", desc: "Sunday morning: the family's week in stamps" }
  ];
  var SAMPLE = {
    reactions: ["Grandma reacted ❤️", "She loved your Yellowstone trip. Tap to see Highlights.", "#/highlights"],
    grandkids: ["Your grandkid earned a Junior Ranger badge 🎖️", "Plus 2 new stamps this week. Tap to cheer them on.", "#/highlights"],
    onthisday: ["3 years ago today 📸", "Grand Canyon. Tap to relive it.", "#/"],
    countdown: ["Rome in 5 days 🧳", "The countdown is on. See what you can stamp along the way.", "#/"],
    nudge: ["Time for a new stamp? 🗺️", "A new park, a weekend walk or a city you drove through all count. Tap to add one.", "#/"],
    recap: ["Your family's week 🗺️", "5 new stamps, 1 trip and 4 reactions. Tap to see it all.", "#/highlights"]
  };
  function cleanKinds(list) { var ok = {}; KINDS.forEach(function (k) { ok[k.id] = 1; }); return (list || []).filter(function (k, i, a) { return ok[k] && a.indexOf(k) === i; }); }
  /** What this browser can do: "ok", "ios-home" (iPhone/iPad not added to Home Screen), or "no". */
  function support(env) {
    var ios = /iPad|iPhone|iPod/.test(env.ua || "") || (/Macintosh/.test(env.ua || "") && env.touch > 1);
    if (env.push && env.sw && env.notif) return "ok";
    if (ios && !env.standalone) return "ios-home";
    return "no";
  }
  /** On-phone preview text for each type, using the family's own trips where it can. */
  function previews(o) {
    return KINDS.map(function (k) {
      var s = SAMPLE[k.id].slice();
      if (k.id === "countdown" && o.next) s[0] = o.next.place + (o.next.days === 1 ? " is tomorrow 🧳" : " in " + o.next.days + " days 🧳");
      if (k.id === "onthisday" && o.past) { s[0] = o.past.years + (o.past.years === 1 ? " year" : " years") + " ago today 📸"; s[1] = o.past.place + ". Tap to relive it."; }
      return { kind: k.id, title: s[0] + " (preview)", body: s[1], url: s[2] };
    });
  }
  var core = { KINDS: KINDS, SAMPLE: SAMPLE, cleanKinds: cleanKinds, support: support, previews: previews };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function X() { return window.MLTL_SYNC && window.MLTL_SYNC.push; }
  function esc(s) { return M().esc(s); }
  var LS = "mltl-push";
  function st() { try { var s = JSON.parse(localStorage.getItem(LS) || "null"); if (s && typeof s === "object") { s.kinds = cleanKinds(s.kinds); return s; } } catch (e) {} return { on: false, kinds: [] }; }
  function keep(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }
  function env() { return { ua: navigator.userAgent, touch: navigator.maxTouchPoints || 0, push: "PushManager" in window, sw: "serviceWorker" in navigator, notif: "Notification" in window,
    standalone: window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) }; }
  function perm() { return "Notification" in window ? Notification.permission : "default"; }
  function b64u(s) { var p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), u = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) u[i] = r.charCodeAt(i); return u; }
  function swReg() { return navigator.serviceWorker.ready; }
  function getSub() { return swReg().then(function (r) { return r.pushManager ? r.pushManager.getSubscription() : null; }).catch(function () { return null; }); }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"; } catch (e) { return "America/New_York"; } }
  /** Push the current choices to the server (only for Family Sync, only once a subscription exists). */
  function save(s, enabled) {
    var x = X(); if (!x || !x.on()) return Promise.resolve("local");
    return getSub().then(function (sub) {
      if (!sub) return "nosub";
      var j = sub.toJSON(), k = j.keys || {};
      return x.save({ p_endpoint: j.endpoint, p_p256dh: k.p256dh, p_auth: k.auth, p_tz: tz(), p_kinds: s.kinds, p_enabled: enabled !== false, p_hour: 9 })
        .then(function () { s.pending = false; keep(s); return "saved"; })
        .catch(function (e) { s.pending = true; keep(s); return e && e.missing ? "missing" : "error"; });
    });
  }
  function panel() {
    var s = st(), sup = support(env()), x = X(), synced = !!(x && x.on());
    var h = '<div class="panel pushpanel" id="pushpanel"><h3>🔔 Notifications</h3>';
    if (sup === "ios-home") return h + '<p class="small">On iPhone and iPad, notifications only work once Famstamp is on your Home Screen (iOS 16.4 or newer): tap Share, then <b>Add to Home Screen</b>, open Famstamp from there, and turn them on here.</p></div>';
    if (sup === "no") return h + '<p class="small muted">This browser can\'t show notifications. Chrome on Android, or Famstamp from the Play Store, can.</p></div>';
    if (perm() === "denied") return h + '<p class="small">Notifications are blocked for Famstamp. To allow them: in Chrome tap ⋮ → Settings → Site settings → Notifications (or the app\'s notification settings in Android Settings), allow Famstamp, then come back.</p></div>';
    if (!s.on) return h + '<p class="small muted">Off. Nothing is sent until you turn them on, and then only the types you pick.' + (synced ? "" : " Real notifications need Family Sync; without it you can still preview them.") + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="pushon">Turn on notifications</button></div><p class="small" id="pushmsg" role="status"></p></div>';
    return h + '<p class="small muted">Pick the ones you like. Each one comes at most once a day, around 9 AM your time, and never more than 3 a day.</p>' +
      '<div class="pushkinds">' + KINDS.map(function (k) {
        var on = s.kinds.indexOf(k.id) >= 0;
        return '<label class="pushk"><input type="checkbox" data-pk="' + k.id + '"' + (on ? " checked" : "") + '><span><b>' + esc(k.label) + '</b><br><span class="small muted">' + esc(k.desc) + '</span></span></label>';
      }).join("") + '</div>' +
      '<div class="actions"><button type="button" class="btn btn-beacon" id="pushtest">Send me a test of each</button><button type="button" class="btn btn-ghost" id="pushoff">Turn off notifications</button></div>' +
      '<p class="small" id="pushmsg" role="status">' + (synced ? (s.pending ? "Saved on this phone. The notification server isn't switched on yet, so tests are previews from the app for now." : "") : "Without Family Sync these are previews only; real ones need Family Sync.") + '</p></div>';
  }
  function msg(t) { var m = document.getElementById("pushmsg"); if (m) m.textContent = t; }
  function redraw() { var p = document.getElementById("pushpanel"); if (!p) return; p.outerHTML = panel(); bind(); }
  function turnOn() {
    msg("Asking your phone…");
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") { redraw(); msg(p === "denied" ? "" : "Okay, still off. Tap again any time."); return; }
      var x = X(), key = x && x.key();
      var subP = key ? swReg().then(function (r) { return r.pushManager.getSubscription().then(function (s) { return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) }); }); }).catch(function (e) { return null; }) : Promise.resolve(null);
      return subP.then(function (sub) {
        var s = { on: true, kinds: [], sub: !!sub }; keep(s);
        return save(s, true).then(function (r) { redraw(); msg(!sub ? "On for previews. This phone couldn't sign up for real notifications from Famstamp." : r === "saved" ? "On. Now pick the types you want, or try a test." : r === "missing" ? "On for this phone. The notification server isn't switched on yet; tests will be previews from the app." : r === "error" ? "On for this phone; couldn't reach Family Sync just now. We'll try again." : "On. Pick the types you want."); });
      });
    });
  }
  function preview() {
    var st0 = A().state, today = M().today(), nx = M().upcoming ? M().upcoming(st0.trips, today)[0] : null, od = M().onThisDay ? M().onThisDay(st0.trips, today)[0] : null;
    var o = {};
    if (nx && nx.trip) o.next = { place: M().tripLabel(nx.trip), days: Math.max(1, nx.days) };
    if (od && od.trip) o.past = { place: M().tripLabel(od.trip), years: od.years };
    return swReg().then(function (r) {
      var list = previews(o), i = 0;
      return new Promise(function (res) {
        (function next() {
          if (i >= list.length) return res(list.length);
          var n = list[i++]; r.showNotification(n.title, { body: n.body, icon: "icon-192.png", badge: "icon-192.png", tag: "fs-" + n.kind, data: { url: n.url } }).then(function () { setTimeout(next, 700); }, function () { setTimeout(next, 700); });
        })();
      });
    });
  }
  function test() {
    var x = X(), b = document.getElementById("pushtest"); if (b) b.disabled = true;
    function done(t) { if (b) b.disabled = false; msg(t); }
    var real = x && x.on() ? save(st(), true).then(function (r) { return getSub().then(function (sub) { if (r !== "saved" || !sub) throw { missing: r === "missing" || r === "nosub" }; return x.test(sub.endpoint); }); }) : Promise.reject({ local: true });
    return real.then(function (r) { done("Sent " + ((r && r.sent) || 0) + " test notifications from the server. They usually land within a few seconds."); })
      .catch(function (e) {
        return preview().then(function (n) { done("Showed " + n + " previews from the app" + (e && e.local ? "." : e && e.missing ? " (the notification server isn't switched on yet)." : " (couldn't reach the server just now).")); }, function () { done("Couldn't show notifications on this phone."); });
      });
  }
  function bind() {
    var on = document.getElementById("pushon"); if (on) on.onclick = function () { on.disabled = true; turnOn().catch(function () { on.disabled = false; msg("Couldn't turn them on. Try again."); }); };
    document.querySelectorAll("#pushpanel [data-pk]").forEach(function (c) { c.onchange = function () {
      var s = st(); s.kinds = cleanKinds(c.checked ? s.kinds.concat(c.dataset.pk) : s.kinds.filter(function (k) { return k !== c.dataset.pk; })); keep(s);
      save(s, true).then(function (r) { msg(r === "saved" ? "Saved." : r === "missing" ? "Saved on this phone. The notification server isn't switched on yet." : r === "error" ? "Saved on this phone; we'll sync it when you're back online." : "Saved on this phone."); });
    }; });
    var t = document.getElementById("pushtest"); if (t) t.onclick = test;
    var off = document.getElementById("pushoff"); if (off) off.onclick = function () {
      var s = st(); s.on = false;
      save({ kinds: [] }, false).then(function () { return getSub().then(function (sub) { return sub && sub.unsubscribe(); }); }).catch(function () {}).then(function () { keep({ on: false, kinds: s.kinds }); redraw(); msg("Off. Nothing more will be sent to this phone."); });
    };
    var s = st(); if (s.on && s.pending) save(s, true).then(function (r) { if (r === "saved") msg(""); });
  }
  core.panel = panel; core.bind = bind; core.state = st;
  return core;
});
