/* Famstamp: "Who's been there?" (runs in Node too). Marking a park, state or country by hand, or fixing who has a stamp,
   goes through one picker: tick everyone who was there and each of them gets the same stamp and date. Nobody is stamped
   twice, stamps that come from a trip stay with that trip's travelers, and every change can be undone.
   Data: the existing person fields only (states / places / parks color-ins, and person.stamps for dated hand stamps), so it
   syncs through Family Sync's people and visits tables as before. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./log-core.js"), require("./passport-core.js"));
  else root.FS_WHO_CORE = factory(root.MLTL, root.WK_PASSPORT);
})(typeof self !== "undefined" ? self : this, function (M, P) {
  "use strict";
  function bagOf(p, kind) { return kind === "state" ? (p.states = p.states || {}) : kind === "park" ? (p.parks = p.parks || {}) : (p.places = p.places || {}); }

  /** Does this person have the place, and how: "trip" (a trip they went on; edit the trip to change it), "hand" (a stamp
      added by hand), "map" (colored in, no date) or "" (not yet). */
  function holdOf(p, trips, kind, area, ctx) {
    var list = P.stampsFor(p, trips || [], ctx || {}).filter(function (s) { return s.kind === kind && s.area === area; });
    if (list.some(function (s) { return s.source === "trip"; })) return "trip";
    if (list.some(function (s) { return s.source === "hand"; })) return "hand";
    if (list.length || bagOf(p, kind)[area]) return "map";
    return "";
  }
  function holders(people, trips, kind, area, ctx) {
    var out = {}; (people || []).forEach(function (p) { out[p.id] = holdOf(p, trips, kind, area, ctx); }); return out;
  }
  /** Who starts ticked. me = the person linked to this login (Family Sync), page = whose page you're on.
      Signed in and linked: you. Signed in but not linked: nobody (we ask). Not using Family Sync: the page's person. */
  function startWith(people, hold, opts) {
    opts = opts || {};
    var ids = (people || []).map(function (p) { return p.id; }), on = {};
    ids.forEach(function (id) { if (hold[id]) on[id] = 1; });
    if (opts.mode !== "edit") {
      if (opts.synced) { if (opts.me && ids.indexOf(opts.me) >= 0) on[opts.me] = 1; }
      else if (opts.page && ids.indexOf(opts.page) >= 0) on[opts.page] = 1;
    }
    return ids.filter(function (id) { return on[id]; });
  }
  /** "Everyone on this trip": the trip that was going on on that date (or the latest trip of whoever is ticked). */
  function tripFor(trips, date, ids) {
    var list = (trips || []).filter(function (t) { return (t.kidIds || []).length > 1; });
    if (date) {
      var d = String(date), hit = list.filter(function (t) { var a = t.date || "", b = t.end || a; return a && (a.indexOf(d) === 0 || d.indexOf(a) === 0 || (d.length === 10 && d >= a && d <= b)); });
      if (hit.length) return hit.sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      return null;
    }
    var mine = list.filter(function (t) { return (ids || []).some(function (id) { return t.kidIds.indexOf(id) >= 0; }); });
    return mine.sort(function (a, b) { return (a.date || "") < (b.date || "") ? 1 : -1; })[0] || null;
  }
  function snap(p) { return JSON.parse(JSON.stringify({ id: p.id, states: p.states || {}, places: p.places || {}, parks: p.parks || {}, stamps: p.stamps || [], updatedAt: p.updatedAt })); }
  /** Make `want` (person ids) the people who have kind/area. Newly ticked people get it colored in and, with a date, a dated
      passport stamp; people already holding it are left alone; un-ticked ones lose their hand stamps and color-in (trip
      stamps can't be taken off here). Changes people in place. Returns { added, removed, kept, locked, changed, undo }. */
  function apply(people, trips, kind, area, want, opts) {
    opts = opts || {};
    var date = P.cleanDate(opts.date || ""), now = opts.now || new Date().toISOString(), today = opts.today || M.today();
    var visit = opts.visitDate != null ? P.cleanDate(opts.visitDate) : null;   // editing one visit: only its stamps change
    var hold = holders(people, trips, kind, area, opts.ctx), res = { added: [], removed: [], kept: [], locked: [], changed: [], undo: [] };
    var w = {}; (want || []).forEach(function (id) { w[id] = 1; });
    var touched = {};
    function touch(p) { if (!touched[p.id]) { touched[p.id] = 1; res.undo.push(snap(p)); res.changed.push(p); p.updatedAt = now; } }
    (people || []).forEach(function (p) {
      var h = hold[p.id], bag = bagOf(p, kind);
      if (w[p.id] && h) { res.kept.push(p.id); return; }
      if (!w[p.id] && !h) return;
      if (!w[p.id] && h === "trip") { res.locked.push(p.id); return; }
      touch(p);
      if (w[p.id]) {
        if (!bag[area]) { bag[area] = { at: date.length === 10 ? date : today }; if (kind === "park") bag[area].jr = false; }
        res.added.push(p.id);
      } else {
        p.stamps = (p.stamps || []).filter(function (s) { return !(s.kind === kind && s.area === area && (visit == null || (s.date || "") === visit)); });
        var left = (p.stamps || []).some(function (s) { return s.kind === kind && s.area === area; });
        if (!left) delete bag[area];
        res.removed.push(p.id);
      }
    });
    // A shared visit: everyone ticked (who didn't get it from a trip) holds a stamp for it that lists who was there together.
    var day = visit != null ? visit : date, group = (people || []).filter(function (p) { return w[p.id] && hold[p.id] !== "trip"; });
    var ids = group.map(function (p) { return p.id; });
    group.forEach(function (p) {
      var st = (p.stamps || []).filter(function (s) { return s.kind === kind && s.area === area && (s.date || "") === day; })[0];
      var isNew = res.added.indexOf(p.id) >= 0;
      if (st) {
        var cur = JSON.stringify(st.with || []), next = ids.length > 1 ? JSON.stringify(ids) : "[]";
        if (cur !== next) { touch(p); p.stamps = p.stamps.map(function (x) { if (x !== st) return x; var y = Object.assign({}, x); if (ids.length > 1) y.with = ids.slice(); else delete y.with; return y; }); }
      } else if (day || ids.length > 1 && (isNew || visit != null)) {
        touch(p);
        p.stamps = P.cleanStamps((p.stamps || []).concat([P.newStamp({ kind: kind, area: area, date: day, via: opts.via || "", with: ids })]));
      }
    });
    return res;
  }
  /** "+ Add a stamp": give each ticked person this stamp (another visit is fine), unless they already have it on that date. */
  function addFor(people, trips, kind, area, want, opts) {
    opts = opts || {};
    var date = P.cleanDate(opts.date || ""), now = opts.now || new Date().toISOString(), today = opts.today || M.today();
    var res = { added: [], removed: [], kept: [], locked: [], changed: [], undo: [] }, w = {}; (want || []).forEach(function (id) { w[id] = 1; });
    (people || []).forEach(function (p) {
      if (!w[p.id]) return;
      var mine = P.stampsFor(p, trips || [], opts.ctx || {}).filter(function (s) { return s.kind === kind && s.area === area; }), bag = bagOf(p, kind);
      var dup = date ? mine.some(function (s) { return s.date === date; }) : mine.length > 0;
      if (dup) { res.kept.push(p.id); return; }
      res.undo.push(snap(p));
      if (!bag[area]) { bag[area] = { at: date.length === 10 ? date : today }; if (kind === "park") bag[area].jr = false; }
      p.updatedAt = now; res.added.push(p.id); res.changed.push(p);
    });
    var ids = res.added.slice();
    res.changed.forEach(function (p) {
      if (date || ids.length > 1) p.stamps = P.cleanStamps((p.stamps || []).concat([P.newStamp({ kind: kind, area: area, date: date, via: opts.via || "", with: ids })]));
    });
    return res;
  }
  /** Take one stamp off one person (with undo). Hand stamps go; a map-only one un-colors the place. */
  function removeOne(p, trips, stamp, opts) {
    opts = opts || {};
    if (!stamp || stamp.source === "trip") return null;
    var u = snap(p), bag = bagOf(p, stamp.kind);
    if (stamp.source === "hand") p.stamps = (p.stamps || []).filter(function (s) { return s.id !== stamp.id; });
    var more = (p.stamps || []).some(function (s) { return s.kind === stamp.kind && s.area === stamp.area; });
    var byTrip = P.stampsFor(p, trips || [], opts.ctx || {}).some(function (s) { return s.source === "trip" && s.kind === stamp.kind && s.area === stamp.area; });
    if (!more && !byTrip) delete bag[stamp.area];
    p.updatedAt = opts.now || new Date().toISOString();
    return u;
  }
  /** Put people back the way a snapshot had them (Undo). */
  function restore(people, undo, now) {
    var by = {}; (people || []).forEach(function (p) { by[p.id] = p; });
    return (undo || []).map(function (u) {
      var p = by[u.id]; if (!p) return null;
      p.states = u.states; p.places = u.places; p.parks = u.parks; p.stamps = u.stamps; p.updatedAt = now || new Date().toISOString();
      return p;
    }).filter(Boolean);
  }
  return { holdOf: holdOf, holders: holders, startWith: startWith, tripFor: tripFor, apply: apply, addFor: addFor, removeOne: removeOne, restore: restore };
});
