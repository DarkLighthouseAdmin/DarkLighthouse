/* Famstamp: the weekly grandparent recap (#/recap, #/recap/<week end YYYY-MM-DD>). The grandkids' new stamps, badges,
   rewards, game stamps, journal pages, milestones and trips from one week, with the same one-tap emoji reactions as
   Highlights (public.reactions). Nothing is emailed: renderHTML() makes an email-ready page (inline styles, table layout,
   reaction links that open #/recap/r/<emoji>/<item>) and emailPayload() returns { subject, html, text } so an email sender
   can be plugged in later. The building part runs in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_RECAP = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  /** The week ending on `end` (7 days, inclusive). H = FS_HL_CORE. Returns { since, until, items, kids: [{ kid, items }], counts } */
  function build(H, people, trips, ctx, end) {
    var until = DAY.test(end || "") ? end : new Date().toISOString().slice(0, 10), since = addDays(until, -6);
    var items = H.feed(people, trips, ctx, { since: since, limit: 200 }).filter(function (x) { return x.at <= until; });
    var kids = (people || []).filter(H.isKid).map(function (k) { return { kid: k, items: items.filter(function (x) { return x.kidIds.indexOf(k.id) >= 0; }) }; }).filter(function (g) { return g.items.length; });
    var counts = { stamps: 0, badges: 0, trips: 0, journal: 0, milestones: 0 };
    items.forEach(function (x) {
      if (x.kind === "stamps") counts.stamps += /^New stamp/.test(x.title) ? 1 : parseInt(x.title, 10) || 1;
      else if (x.kind === "badge") counts.badges++; else if (x.kind === "trip") counts.trips++; else if (x.kind === "journal") counts.journal++; else counts.milestones++;
    });
    return { since: since, until: until, items: items, kids: kids, counts: counts };
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }
  function summaryLine(rc) {
    var c = rc.counts, b = [];
    if (c.stamps) b.push(plural(c.stamps, "new stamp")); if (c.badges) b.push(plural(c.badges, "badge")); if (c.trips) b.push(plural(c.trips, "trip"));
    if (c.journal) b.push(plural(c.journal, "journal page")); if (c.milestones) b.push(plural(c.milestones, "milestone"));
    return b.length ? b.join(" · ") : "A quiet week";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pretty(d) { var x = new Date(d + "T12:00:00Z"); return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); }
  function subject(rc, o) { return (o && o.family ? o.family + ": " : "") + "This week with the grandkids · " + summaryLine(rc); }
  /** Email-ready HTML (inline styles only). o: { appUrl, family, who(person) -> name, emoji: [[id, char, label]] } */
  function renderHTML(rc, o) {
    o = o || {}; var app = String(o.appUrl || "").replace(/#.*$/, ""), who = o.who || function (p) { return p.nickname || p.name; }, emo = o.emoji || [];
    function react(ref) {
      return emo.map(function (e) { return '<a href="' + esc(app + "#/recap/r/" + e[0] + "/" + encodeURIComponent(ref)) + '" style="display:inline-block;margin:0 6px 0 0;padding:6px 10px;border:1px solid #d9d2c3;border-radius:18px;text-decoration:none;font-size:18px" title="' + esc(e[2]) + '">' + e[1] + '</a>'; }).join("");
    }
    var rows = rc.kids.map(function (g) {
      return '<tr><td style="padding:18px 0 6px;font:700 20px Georgia,serif;color:#1d2b3a">' + esc(who(g.kid)) + '</td></tr>' + g.items.map(function (x) {
        return '<tr><td style="padding:10px 14px;background:#fff;border:1px solid #ece5d6;border-radius:10px"><div style="font:600 16px Arial,sans-serif;color:#1d2b3a">' + x.emoji + ' ' + esc(x.title) + '</div>' +
          (x.detail ? '<div style="font:14px Arial,sans-serif;color:#5b6b73;margin-top:2px">' + esc(x.detail) + '</div>' : "") +
          '<div style="font:12px Arial,sans-serif;color:#8a8f93;margin:4px 0 8px">' + esc(pretty(x.at)) + '</div>' + react(x.ref) + '</td></tr><tr><td style="height:8px"></td></tr>';
      }).join("");
    }).join("");
    return '<!doctype html><html><body style="margin:0;background:#fbf7ef"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7ef"><tr><td align="center" style="padding:20px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">' +
      '<tr><td style="font:700 12px Arial,sans-serif;letter-spacing:2px;color:#c9962b">FAMSTAMP · WEEKLY RECAP</td></tr>' +
      '<tr><td style="font:700 26px Georgia,serif;color:#1d2b3a;padding:6px 0">This week with the grandkids</td></tr>' +
      '<tr><td style="font:14px Arial,sans-serif;color:#5b6b73">' + esc(pretty(rc.since) + " – " + pretty(rc.until)) + ' · ' + esc(summaryLine(rc)) + '</td></tr>' +
      (rows || '<tr><td style="padding:18px 0;font:15px Arial,sans-serif;color:#5b6b73">No new stamps this week. Maybe next week!</td></tr>') +
      '<tr><td style="padding:18px 0;font:14px Arial,sans-serif"><a href="' + esc(app + "#/recap") + '" style="color:#2c6e8f">Open Famstamp to see it all →</a></td></tr>' +
      '<tr><td style="font:11px Arial,sans-serif;color:#9a9a9a">Tap an emoji to send a reaction. ' + esc(o.family || "") + '</td></tr></table></td></tr></table></body></html>';
  }
  function text(rc, o) {
    o = o || {}; var who = o.who || function (p) { return p.name; };
    return "This week with the grandkids (" + pretty(rc.since) + " – " + pretty(rc.until) + "): " + summaryLine(rc) + "\n" +
      rc.kids.map(function (g) { return "\n" + who(g.kid) + "\n" + g.items.map(function (x) { return "• " + x.title + (x.detail ? " — " + x.detail : ""); }).join("\n"); }).join("\n");
  }
  var core = { build: build, renderHTML: renderHTML, text: text, subject: subject, summaryLine: summaryLine, addDays: addDays };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function HL() { return window.FS_HL; }
  function appUrl() { return location.origin + location.pathname; }
  function current(end) { return build(window.FS_HL_CORE, A().state.kids, A().state.trips, HL().ctx(), end || M().today()); }
  function opts() { var c = A().state.meta.sync; return { appUrl: appUrl(), family: (c && c.familyName) || "", who: M().who, emoji: window.FS_HL_CORE.EMOJI }; }
  /** For a future email sender: everything one recap email needs (nothing is sent from here). */
  function emailPayload(end) { var rc = current(end), o = opts(); return { subject: subject(rc, o), html: renderHTML(rc, o), text: text(rc, o), since: rc.since, until: rc.until }; }
  function view(sub, a, b) {
    if (sub === "r" && a && b) return reactFromLink(a, decodeURIComponent(b));
    var end = DAY.test(sub || "") ? sub : M().today(), rc = current(end), H = HL();
    document.title = "Weekly recap · Famstamp";
    var html = '<a class="back" href="#/highlights">← Highlights</a><h1>📬 This week with the grandkids</h1>' +
      '<p class="lede small">' + esc(pretty(rc.since) + " – " + pretty(rc.until)) + ' · <b>' + esc(summaryLine(rc)) + '</b></p>' +
      '<div class="actions noprint"><a class="btn btn-ghost btn-sm" href="#/recap/' + addDays(rc.until, -7) + '">‹ Week before</a>' + (rc.until < M().today() ? '<a class="btn btn-ghost btn-sm" href="#/recap/' + addDays(rc.until, 7) + '">Next week ›</a>' : "") +
      '<button type="button" class="btn btn-ghost btn-sm" id="rcshare">📤 Share</button><button type="button" class="btn btn-ghost btn-sm" id="rcmail">✉️ Email preview</button><button type="button" class="btn btn-ghost btn-sm" id="rcprint">🖨️ Print</button></div>' +
      (H.on() ? "" : '<div class="panel"><p class="small">Reactions work once this phone is in a family log. <a href="#/sync">Family Sync →</a></p></div>') +
      (rc.kids.length ? rc.kids.map(function (g) { return '<h2 class="rckid">' + esc(M().who(g.kid)) + '</h2><div class="hlfeed">' + g.items.map(H.card).join("") + '</div>'; }).join("") :
        '<div class="panel"><p class="muted">Nothing new this week. When the kids get stamps, badges, journal pages or trips, they show up here.</p></div>') +
      '<div id="rcpreview" class="noprint" hidden><h3 class="sec">Email preview</h3><p class="small muted">What a weekly email would look like. Nothing is sent: email isn\'t set up yet.</p><iframe title="Email preview" class="rcframe"></iframe></div>';
    A().main.innerHTML = html; A().fillPhotos(); H.bindBars(A().main); H.refresh();
    var $ = function (s) { return A().main.querySelector(s); };
    $("#rcprint").onclick = function () { window.print(); };
    $("#rcmail").onclick = function () { var p = $("#rcpreview"); p.hidden = !p.hidden; if (!p.hidden) p.querySelector("iframe").srcdoc = renderHTML(rc, opts()); };
    $("#rcshare").onclick = function () {
      var t = text(rc, opts()), url = appUrl() + "#/recap/" + rc.until;
      if (navigator.share) navigator.share({ title: "This week with the grandkids", text: t, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(t + "\n" + url).then(function () { A().toast("Recap copied"); }, function () {});
    };
  }
  /** #/recap/r/<emoji>/<item>: the one-tap reaction from a recap email. Turns it on (never off), then shows the week. */
  function reactFromLink(emoji, ref) {
    var H = HL(), C = window.FS_HL_CORE, c = H.cfg();
    function back() { history.replaceState(null, "", "#/recap"); view(""); }
    if (!H.on() || !C.EMO[emoji] || !C.REF.test(ref)) { back(); return; }
    var has = H.cached().some(function (r) { return r.item_ref === ref && r.emoji === emoji && r.user_id === c.userId; });
    if (!has) {
      var was = H.cached(), t = C.toggle(was, c.familyId, ref, emoji, c.userId); H.keep(t.rows);
      window.MLTL_SYNC.hl.react(ref, emoji, true).then(function () { A().toast(C.EMO[emoji] + " Sent!"); }, function (e) { if (H.offlineErr(e)) { H.enqueue(ref, emoji, true); A().toast(C.EMO[emoji] + " Saved. It'll send when you're back online."); return; } H.keep(was); A().toast("Couldn't save that reaction. Try again when you're online."); if (/^#\/recap/.test(location.hash)) H.rebar(A().main); });
    }
    back();
  }
  function homeCard() {
    var H = HL(); if (!H || !H.iAmGrand()) return "";
    var rc = current();
    return '<a class="panel familycard rccard" href="#/recap"><span class="fam-ic" aria-hidden="true">📬</span><span><h3>This week\'s recap</h3><span class="small">' + esc(summaryLine(rc)) + ' · tap to cheer them on →</span></span></a>';
  }
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) { if (h[0] !== "recap" || !HL()) return false; view(h[1] || "", h[2], h.slice(3).join("/")); return true; });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(homeCard);
  core.view = view; core.emailPayload = emailPayload; core.current = current;
  return core;
});
