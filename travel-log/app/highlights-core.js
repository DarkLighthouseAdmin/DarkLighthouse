/* Famstamp: Highlights, the grandparents' tab (#/highlights). A read-only feed of the grandkids' (kid profiles') newest
   stamps, badges, milestones, Firsts and trips, newest first, plus emoji reactions (heart, wow, clap, laugh) that sync
   through the family's server copy (table public.reactions: one row per person per emoji per item). Pubs and grown-up-only
   things never show. The counting part runs in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_HL_CORE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var EMOJI = [["heart", "❤️", "Love it"], ["wow", "😮", "Wow"], ["clap", "👏", "Bravo"], ["laugh", "😂", "Ha!"]], EMO = {};
  EMOJI.forEach(function (e) { EMO[e[0]] = e[1]; });
  var DATE = /^\d{4}-\d{2}-\d{2}$/, REF = /^(s|jr|q|f|m|t|r|g|j):[A-Za-z0-9_:.-]{3,116}$/;
  function isKid(p) { return !!p && p.role === "kid"; }
  /** A grandparent is marked by their relationship (picked when they join with the family invite) or the Grandparent role. */
  function isGrand(p) { return !!p && (p.relationship === "grandparent" || p.role === "grand"); }
  function draft(t) { return t.draft === true || /^\s*draft:/i.test(String(t.title || "")); }
  /** people, trips -> [{ ref, kind, kidIds, at, emoji, title, detail, tripId?, photoId? }] newest first.
      ctx (all optional): name(kind, id), quests(p) -> [{ q, at }], firsts(p) -> timeline rows, milestones(p) -> { done } */
  function feed(people, trips, ctx, o) {
    ctx = ctx || {}; o = o || {};
    var kids = (people || []).filter(isKid), kidIds = {}, out = [], since = o.since || "", nm = ctx.name || function (k, id) { return id; };
    kids.forEach(function (k) { kidIds[k.id] = 1; });
    function ok(at) { return DATE.test(at || "") && at >= since; }
    function safe(f, k, d) { try { return (f && f(k)) || d; } catch (e) { return d; } }
    kids.forEach(function (k) {
      var days = {};
      function stamp(at, label) { if (ok(at) && label) (days[at] = days[at] || []).push(label); }
      Object.keys(k.states || {}).forEach(function (id) { stamp(k.states[id] && k.states[id].at, nm("state", id)); });
      Object.keys(k.places || {}).forEach(function (id) { stamp(k.places[id] && k.places[id].at, nm("country", id)); });
      Object.keys(k.parks || {}).forEach(function (id) {
        var v = k.parks[id] || {}; stamp(v.at, nm("park", id));
        if (v.jr && ok(v.at)) out.push({ ref: "jr:" + k.id + ":" + id, kind: "badge", kidIds: [k.id], at: v.at, emoji: "🎖️", title: "Junior Ranger badge", detail: nm("park", id) });
      });
      // city, hub and food stamps; pubs (p-) and your-own entries (e_, could be a beer) never show here
      Object.keys(k.spots || {}).forEach(function (id) { if (!/^(p-|e_)/.test(id)) stamp(k.spots[id] && k.spots[id].at, nm("spot", id)); });
      Object.keys(days).forEach(function (at) {
        var l = days[at];
        out.push({ ref: "s:" + k.id + ":" + at, kind: "stamps", kidIds: [k.id], at: at, emoji: "🛂", title: l.length === 1 ? "New stamp: " + l[0] : l.length + " new stamps", detail: l.length === 1 ? "" : l.slice(0, 6).join(", ") + (l.length > 6 ? " and " + (l.length - 6) + " more" : "") });
      });
      // v63: reward levels (3, 5, 10, 20 stamps) and road-trip game stamps
      safe(ctx.rewards, k, []).forEach(function (r) {
        if (r && ok(r.at)) out.push({ ref: "r:" + k.id + ":" + r.n, kind: "badge", kidIds: [k.id], at: r.at, emoji: "🏅", title: r.n + " stamps: " + r.name + "!", detail: "Reward unlocked" });
      });
      Object.keys(k.games || {}).forEach(function (gk) {
        var g = k.games[gk] || {}, nm2 = { plates: "License plate hunt", alpha: "Road-sign alphabet", hunt: "Scavenger hunt" }[g.kind];
        if (nm2 && ok(g.at)) out.push({ ref: "g:" + k.id + ":" + gk, kind: "badge", kidIds: [k.id], at: g.at, emoji: "🚗", title: "Game stamp: " + nm2, detail: g.place || "" });
      });
      safe(ctx.quests, k, []).forEach(function (e) {
        if (e && e.q && ok(e.at))
          out.push({ ref: "q:" + k.id + ":" + e.q.id, kind: "badge", kidIds: [k.id], at: e.at, emoji: e.q.emoji || "🧭", title: "Badge: " + (e.q.badge || e.q.name), detail: e.q.name || "" });
      });
      safe(ctx.firsts, k, []).forEach(function (r) { if (ok(r.at)) out.push({ ref: "f:" + k.id + ":" + r.key, kind: "first", kidIds: [k.id], at: r.at, emoji: r.emoji || "⭐", title: r.title, detail: r.place || "" }); });
      (safe(ctx.milestones, k, {}).done || []).forEach(function (m) {
        if (ok(m.at) && !/^first-/.test(m.key || "")) out.push({ ref: "m:" + k.id + ":" + m.key, kind: "milestone", kidIds: [k.id], at: m.at, emoji: m.emoji || "🏆", title: m.text, detail: "" });
      });
    });
    (trips || []).forEach(function (t) {
      if (!t || t.deletedAt || draft(t) || t.planned === true || !ok(t.date)) return;
      var ks = (t.kidIds || []).filter(function (id) { return kidIds[id]; }); if (!ks.length) return;
      // v63: the kids' journal pages (best part of the day, a funny quote, a drawing)
      (Array.isArray(t.journal) ? t.journal : []).forEach(function (j) {
        if (!j || !kidIds[j.kid] || !ok(j.day) || !/^[A-Za-z0-9_-]{3,40}$/.test(j.id || "")) return;
        var txt = j.best ? "🌟 " + j.best : j.funny ? "😂 “" + j.funny + "”" + (j.said ? " (" + j.said + ")" : "") : "";
        out.push({ ref: "j:" + t.id + ":" + j.id, kind: "journal", kidIds: [j.kid], at: j.day, emoji: "📓", title: "Journal: " + String(t.place || t.title || "a trip"), detail: txt + (j.best && j.funny ? " · 😂 “" + j.funny + "”" : ""), tripId: t.id, photoId: j.photoId || null });
      });
      out.push({ ref: "t:" + t.id, kind: "trip", kidIds: ks, at: t.date, emoji: "🧳", title: String(t.place || t.title || "A trip"), detail: t.memory || "", tripId: t.id, photoId: t.photoId || null });
    });
    var order = { trip: 0, journal: 1, first: 2, milestone: 3, badge: 4, stamps: 5 };
    return out.filter(function (x) { return REF.test(x.ref); })
      .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : (order[a.kind] - order[b.kind]) || (a.ref < b.ref ? -1 : 1); }).slice(0, o.limit || 80);
  }
  function validRow(r) { return !!r && REF.test(r.item_ref || "") && !!EMO[r.emoji] && !!r.user_id; }
  /** rows -> { ref: { heart: [user ids in order], ... } } */
  function byItem(rows) {
    var out = {};
    (rows || []).filter(validRow).sort(function (a, b) { return String(a.created_at || "") < String(b.created_at || "") ? -1 : 1; }).forEach(function (r) {
      var m = out[r.item_ref] = out[r.item_ref] || {}, l = m[r.emoji] = m[r.emoji] || []; if (l.indexOf(r.user_id) < 0) l.push(r.user_id);
    });
    return out;
  }
  /** Tap an emoji: on if I hadn't, off if I had. Returns { rows, on } (a new list; the caller saves the change to the server). */
  function toggle(rows, fid, ref, emoji, uid, now) {
    if (!REF.test(ref || "") || !EMO[emoji] || !uid) return { rows: rows || [], on: null };
    var had = (rows || []).some(function (r) { return r.item_ref === ref && r.emoji === emoji && r.user_id === uid; });
    return had ? { rows: rows.filter(function (r) { return !(r.item_ref === ref && r.emoji === emoji && r.user_id === uid); }), on: false }
               : { rows: (rows || []).concat([{ family_id: fid, item_ref: ref, user_id: uid, emoji: emoji, created_at: now || new Date().toISOString() }]), on: true };
  }
  /** "Grandma ❤️ · Pop 👏😂" */
  function whoLine(m, nameOf) {
    var per = {}, order = [];
    EMOJI.forEach(function (e) { (m && m[e[0]] || []).forEach(function (u) { if (!per[u]) { per[u] = ""; order.push(u); } per[u] += e[1]; }); });
    return order.map(function (u) { return nameOf(u) + " " + per[u]; }).join(" · ");
  }
  return { EMOJI: EMOJI, EMO: EMO, REF: REF, isKid: isKid, isGrand: isGrand, feed: feed, byItem: byItem, toggle: toggle, whoLine: whoLine, validRow: validRow };
});
