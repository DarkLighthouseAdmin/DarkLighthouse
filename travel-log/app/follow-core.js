/* Famstamp: grandparent follow-along, the counting part (runs in Node too). A follow-along link shows the people who
   follow the family (Grandma, an aunt, a friend) a read-only page of recent updates for the travelers it shares: new
   stamps (states, countries, parks), trips and trip memories. The server's follow_feed() returns a "feed" object; the
   app builds the very same object from what's on this phone for the "what they'll see" preview, so both look alike.
   feed = { family, label, people: [{ id, name, nickname, color, role }], trips: [{ id, place, title, date, to, memory,
            memories, moments, kidIds }], visits: [{ person, kind, id, at, jr }] }
   Nothing else is in it: no photos, no home or route, no other people. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./log-core.js"));
  else root.FS_FOLLOW_CORE = factory(root.MLTL);
})(typeof self !== "undefined" ? self : this, function (M) {
  "use strict";
  var MAX_TRIPS = 25, MAX_VISITS = 120, MAX_ITEMS = 40;
  var TOKEN = /^[A-Za-z0-9_-]{24,64}$/;
  function validToken(t) { return typeof t === "string" && TOKEN.test(t); }
  function day(s) { return /^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : ""; }
  function str(s, n) { return String(s == null ? "" : s).trim().slice(0, n || 400); }

  /** Who can be shared: everyone in the log who isn't a follower. Kids are ticked to start with. */
  function shareable(people) { return (people || []).filter(function (p) { return !M.isFollower(p); }); }
  function defaultShare(people) {
    var s = shareable(people), kids = s.filter(function (p) { return M.isKid(p); });
    return (kids.length ? kids : s).map(function (p) { return p.id; });
  }
  /** "Grandma June" for a follower profile, else what was typed. */
  function labelFor(p, typed) { return str(p ? M.who(p) : typed, 40); }

  /** The feed object for these people, from the log on this phone (same shape and limits as the server's). */
  function fromLocal(people, trips, ids, o) {
    o = o || {}; ids = (ids || []).slice(0, 12);
    var keep = {}; ids.forEach(function (id) { keep[id] = 1; });
    var ps = (people || []).filter(function (p) { return keep[p.id] && !M.isFollower(p); });
    keep = {}; ps.forEach(function (p) { keep[p.id] = 1; });
    var ts = (trips || []).filter(function (t) { return (t.kidIds || []).some(function (id) { return keep[id]; }); })
      .sort(function (a, b) { return (day(b.date) || "0") < (day(a.date) || "0") ? -1 : (day(b.date) || "0") > (day(a.date) || "0") ? 1 : 0; }).slice(0, MAX_TRIPS)
      .map(function (t) {
        var mo = {}; Object.keys(t.moments || {}).forEach(function (k) { if (keep[k] && t.moments[k]) mo[k] = t.moments[k]; });
        var last = t.route && t.route.length ? t.route[t.route.length - 1] : null;
        return { id: t.id, place: t.place || "", title: t.title || "", date: day(t.date) || null, to: (last && last.name) || t.place || "",
                 memory: t.memory || "", memories: t.memories || {}, moments: mo, kidIds: t.kidIds.filter(function (id) { return keep[id]; }) };
      });
    var vs = [];
    ps.forEach(function (p) {
      [["state", p.states], ["place", p.places], ["park", p.parks]].forEach(function (b) {
        Object.keys(b[1] || {}).forEach(function (id) { var v = b[1][id] || {}; if (day(v.at)) vs.push({ person: p.id, kind: b[0], id: id, at: day(v.at), jr: !!v.jr }); });
      });
    });
    vs.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
    return { family: o.family || "", label: o.label || "",
             people: ps.map(function (p) { return { id: p.id, name: p.name || "", nickname: p.nickname || "", color: p.color || "", role: p.role || "" }; })
               .sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; }),
             trips: ts, visits: vs.slice(0, MAX_VISITS) };
  }

  /** Make whatever came back from the server safe to draw. Returns null for "no such link". */
  function clean(f) {
    if (!f || typeof f !== "object") return null;
    if (f.paused) return { paused: true, family: str(f.family, 60) };
    var people = (Array.isArray(f.people) ? f.people : []).filter(function (p) { return p && typeof p.id === "string"; }).slice(0, 12)
      .map(function (p) { return { id: p.id, name: str(p.name, 40), nickname: str(p.nickname, 20), color: /^#[0-9a-fA-F]{3,8}$/.test(p.color || "") ? p.color : "", role: str(p.role, 20) }; });
    var ids = {}; people.forEach(function (p) { ids[p.id] = 1; });
    var trips = (Array.isArray(f.trips) ? f.trips : []).filter(function (t) { return t && typeof t === "object"; }).slice(0, MAX_TRIPS).map(function (t) {
      var mem = {}, mo = {};
      if (t.memories && typeof t.memories === "object") Object.keys(t.memories).forEach(function (k) { if (typeof t.memories[k] === "string" && t.memories[k].trim()) mem[k] = str(t.memories[k], 400); });
      if (t.moments && typeof t.moments === "object") Object.keys(t.moments).forEach(function (k) { if (ids[k] && typeof t.moments[k] === "string" && t.moments[k].trim()) mo[k] = str(t.moments[k], 140); });
      return { id: str(t.id, 50), place: str(t.place, 120), title: str(t.title, 80), date: day(t.date) || null, to: str(t.to, 120), memory: str(t.memory, 300), memories: mem, moments: mo,
               kidIds: (Array.isArray(t.kidIds) ? t.kidIds : []).filter(function (id) { return ids[id]; }) };
    }).filter(function (t) { return t.kidIds.length; });
    var visits = (Array.isArray(f.visits) ? f.visits : []).filter(function (v) { return v && ids[v.person] && /^(state|place|park)$/.test(v.kind) && day(v.at) && /^[A-Za-z0-9-]{2,40}$/.test(v.id || ""); })
      .slice(0, MAX_VISITS).map(function (v) { return { person: v.person, kind: v.kind, id: v.id, at: day(v.at), jr: !!v.jr }; });
    return { family: str(f.family, 60), label: str(f.label, 40), people: people, trips: trips, visits: visits };
  }

  /** The updates to show, newest first: one card per trip, and one per person per day for new stamps. Stamps from the
   *  day of a trip that person was on ride along with that trip's card instead. */
  function updates(feed, o) {
    o = o || {}; if (!feed || feed.paused) return [];
    var items = [], onTrip = {};
    (feed.trips || []).forEach(function (t) {
      var it = { type: "trip", at: t.date || "", trip: t, who: t.kidIds.slice(), stamps: [] };
      if (t.date) t.kidIds.forEach(function (id) { onTrip[id + "|" + t.date] = onTrip[id + "|" + t.date] || it; });
      items.push(it);
    });
    var days = {};
    (feed.visits || []).forEach(function (v) {
      var t = onTrip[v.person + "|" + v.at];
      if (t) { t.stamps.push(v); return; }
      var k = v.person + "|" + v.at;
      if (!days[k]) { days[k] = { type: "stamps", at: v.at, who: [v.person], stamps: [] }; items.push(days[k]); }
      days[k].stamps.push(v);
    });
    var rank = { park: 0, place: 1, state: 2 };
    items.forEach(function (it) {   // one chip per place; who got it when not everyone on the card did
      var by = {}, out = [];
      it.stamps.forEach(function (v) { var k = v.kind + "|" + v.id; if (!by[k]) { by[k] = { kind: v.kind, id: v.id, jr: false, who: [] }; out.push(by[k]); } if (by[k].who.indexOf(v.person) < 0) by[k].who.push(v.person); by[k].jr = by[k].jr || v.jr; });
      out.forEach(function (v) { v.person = v.who[0]; v.everyone = it.who.every(function (id) { return v.who.indexOf(id) >= 0; }); });
      it.stamps = out;
    });
    items.forEach(function (it) { it.stamps.sort(function (a, b) { return (b.jr - a.jr) || (rank[a.kind] - rank[b.kind]) || (a.id < b.id ? -1 : 1); }); });
    items.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : (a.type === "trip" ? -1 : 0) - (b.type === "trip" ? -1 : 0); });
    return items.slice(0, o.limit || MAX_ITEMS);
  }

  /** "Rosie and Max" from ids, using nicknames. */
  function names(feed, ids) {
    var by = {}; (feed.people || []).forEach(function (p) { by[p.id] = p; });
    return M.joinNames(ids.map(function (id) { return by[id] ? (by[id].nickname || by[id].name) : ""; }).filter(Boolean));
  }
  function linkURL(base, token) { return String(base || "").replace(/#.*$/, "") + "#/follow/" + token; }

  return { validToken: validToken, shareable: shareable, defaultShare: defaultShare, labelFor: labelFor, fromLocal: fromLocal, clean: clean,
           updates: updates, names: names, linkURL: linkURL, MAX_TRIPS: MAX_TRIPS, MAX_VISITS: MAX_VISITS };
});
