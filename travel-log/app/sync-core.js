/* Famstamp: Family Sync logic with no browser parts, so it can be tested in Node.
   Local-first: the phone's IndexedDB is the truth on the device. A "shadow" remembers what this phone last agreed with
   the family's cloud copy, so we can tell local edits (push) from remote ones (pull). Each record is last-write-wins by
   its updatedAt; map coloring syncs one place at a time, so two phones coloring different states never clobber each other. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MLTL_SYNCCORE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Same 64 words as public.invite_words() in the SQL. Codes look like MAPLE-COMPASS-4821.
  var WORDS = ["ACORN", "ANCHOR", "ATLAS", "AURORA", "BADGER", "BEACON", "BISON", "CABIN", "CAMPFIRE", "CANYON", "CASTLE", "COMET",
    "COMPASS", "CORAL", "COVE", "DUNE", "EAGLE", "EMBER", "FERRY", "FJORD", "FOREST", "GEYSER", "GLACIER", "HARBOR", "HERON", "HIGHLAND",
    "ISLAND", "JUNIPER", "KAYAK", "LAGOON", "LANTERN", "LIGHTHOUSE", "MAPLE", "MEADOW", "MESA", "MOOSE", "ORCHARD", "OTTER", "PADDLE",
    "PASSPORT", "POSTCARD", "PELICAN", "PINE", "PRAIRIE", "PUFFIN", "QUEST", "RANGER", "ROAMER", "REDWOOD", "RIVER", "ROADTRIP", "SAGUARO",
    "SEASHELL", "SEQUOIA", "SPARROW", "SUMMIT", "THISTLE", "TIDE", "TRAIL", "VALLEY", "VOYAGE", "WAVE", "WILLOW", "ZEPHYR"];
  var CODE_RE = /^[A-Z]+-[A-Z]+-[0-9]{4}$/;

  /** "maple compass 4821", " Maple-Compass-4821 " and "MAPLE_COMPASS_4821" all become MAPLE-COMPASS-4821. */
  function normCode(s) {
    return String(s == null ? "" : s).toUpperCase().trim().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/([A-Z])([0-9])/g, "$1-$2");
  }
  function isCode(s) {
    var c = normCode(s); if (!CODE_RE.test(c)) return false;
    var p = c.split("-"); return WORDS.indexOf(p[0]) >= 0 && WORDS.indexOf(p[1]) >= 0;
  }
  /** Client-side twin of new_invite_code(), for tests and previews. rnd = 4 bytes (0..255). */
  function makeCode(rnd) {
    var n = WORDS.length;
    return WORDS[rnd[0] % n] + "-" + WORDS[rnd[1] % n] + "-" + String(1000 + ((rnd[2] * 256 + rnd[3]) % 9000));
  }
  /** Pull ?join=CODE out of a link (or accept a bare code). Returns "" if nothing usable. */
  function codeFromLink(s) {
    s = String(s || "").trim();
    var m = /[?&#]join=([^&#\s]+)/i.exec(s);
    var c = normCode(m ? decodeURIComponent(m[1]) : s);
    return isCode(c) ? c : "";
  }
  function inviteLink(base, code) { return String(base).replace(/[?#].*$/, "") + "?join=" + encodeURIComponent(normCode(code)); }
  /** "The Rivera family log" from "Rivera", "The Riveras" or "The Rivera family". */
  function familyTitle(name) {
    var n = String(name || "").trim().replace(/\s+/g, " ");
    if (!n) return "your family's log";
    if (!/^the\s/i.test(n)) n = "the " + n;
    if (/family$/i.test(n)) return n + " log";
    return /s$/i.test(n) ? n + "' log" : n + " family log";
  }

  // ---------- time ----------
  function ms(t) { var v = t ? Date.parse(t) : NaN; return isNaN(v) ? 0 : v; }
  function iso(t) { return new Date(ms(t) || Date.now()).toISOString(); }
  function newer(a, b) { return ms(a) > ms(b); }

  // ---------- record <-> row ----------
  // People and trips sync as a JSONB "data" blob next to a few key columns, so new fields added to the app later
  // (badges, favorites, stays, legs...) sync with no database change. Map colors go in their own per-place rows instead.
  var PERSON_SKIP = { id: 1, states: 1, places: 1, parks: 1, updatedAt: 1 };
  function personRow(p, fid) {
    var data = {}; Object.keys(p).forEach(function (k) { if (!PERSON_SKIP[k] && p[k] !== undefined) data[k] = JSON.parse(JSON.stringify(p[k])); });
    return { family_id: fid, id: p.id, data: data, updated_at: iso(p.updatedAt), deleted: false };
  }
  function tripRow(t, fid) {
    var data = JSON.parse(JSON.stringify(t));
    return { family_id: fid, id: t.id, data: data, traveler_ids: (t.kidIds || []).slice(), from_place: t.from || "", to_place: t.place || "",
             trip_date: /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") ? t.date : null, photo_id: t.photoId || null, updated_at: iso(t.updatedAt), deleted: false };
  }
  /** Every colored-in place, flattened: "personId|kind|placeId" -> { at, jr } */
  function flatVisits(people) {
    var out = {};
    people.forEach(function (p) {
      [["state", p.states], ["place", p.places], ["park", p.parks]].forEach(function (b) {
        Object.keys(b[1] || {}).forEach(function (id) { var v = b[1][id] || {}; out[p.id + "|" + b[0] + "|" + id] = { at: v.at || "", jr: !!v.jr }; });
      });
    });
    return out;
  }
  function sameVisit(a, b) { return !!a && !!b && (a.at || "") === (b.at || "") && !!a.jr === !!b.jr; }
  function bagOf(p, kind) { return kind === "state" ? (p.states = p.states || {}) : kind === "park" ? (p.parks = p.parks || {}) : (p.places = p.places || {}); }

  function emptyShadow() { return { people: {}, visits: {}, trips: {}, photos: {} }; }

  /** What this phone needs to send. local = { people, trips, photoIds }. Returns rows per table plus photo ids to upload. */
  function planPush(local, shadow, fid, now) {
    shadow = shadow || emptyShadow(); now = iso(now);
    var out = { people: [], visits: [], trips: [], photos: [], uploads: [], removes: [] };
    var byId = {};
    local.people.forEach(function (p) {
      byId[p.id] = p;
      if (!shadow.people[p.id] || shadow.people[p.id] !== iso(p.updatedAt)) out.people.push(personRow(p, fid));
    });
    Object.keys(shadow.people).forEach(function (id) {
      if (!byId[id]) out.people.push({ family_id: fid, id: id, data: {}, updated_at: now, deleted: true });
    });
    var flat = flatVisits(local.people);
    Object.keys(flat).forEach(function (k) {
      if (sameVisit(flat[k], shadow.visits[k])) return;
      var parts = k.split("|"), p = byId[parts[0]];
      out.visits.push({ family_id: fid, person_id: parts[0], kind: parts[1], place_id: parts[2], at: /^\d{4}-\d{2}-\d{2}$/.test(flat[k].at || "") ? flat[k].at : null, jr: flat[k].jr,
                        updated_at: iso(p && p.updatedAt || now), deleted: false });
    });
    Object.keys(shadow.visits).forEach(function (k) {
      if (flat[k]) return;
      var parts = k.split("|"), p = byId[parts[0]];
      if (!p) return;   // the whole person went; their tombstone covers it
      out.visits.push({ family_id: fid, person_id: parts[0], kind: parts[1], place_id: parts[2], at: null, jr: false, updated_at: iso(p.updatedAt), deleted: true });
    });
    var tripIds = {};
    local.trips.forEach(function (t) {
      tripIds[t.id] = 1;
      if (!shadow.trips[t.id] || shadow.trips[t.id] !== iso(t.updatedAt)) out.trips.push(tripRow(t, fid));
      if (t.photoId && !shadow.photos[t.photoId] && (local.photoIds || []).indexOf(t.photoId) >= 0) out.uploads.push({ id: t.photoId, tripId: t.id });
    });
    Object.keys(shadow.trips).forEach(function (id) {
      if (!tripIds[id]) out.trips.push({ family_id: fid, id: id, data: {}, traveler_ids: [], from_place: "", to_place: "", trip_date: null, photo_id: null, updated_at: now, deleted: true });
    });
    var used = {}; local.trips.forEach(function (t) { if (t.photoId) used[t.photoId] = 1; });
    Object.keys(shadow.photos).forEach(function (id) {
      if (!used[id]) { out.photos.push({ family_id: fid, id: id, path: photoPath(fid, id, shadow.photos[id]), updated_at: now, deleted: true }); out.removes.push(photoPath(fid, id, shadow.photos[id])); }
    });
    return out;
  }
  /** After a push succeeds, remember what the cloud now has. */
  function afterPush(shadow, plan) {
    plan.people.forEach(function (r) { if (r.deleted) { delete shadow.people[r.id]; dropPersonVisits(shadow, r.id); } else shadow.people[r.id] = r.updated_at; });
    plan.visits.forEach(function (r) { var k = r.person_id + "|" + r.kind + "|" + r.place_id; if (r.deleted) delete shadow.visits[k]; else shadow.visits[k] = { at: r.at || "", jr: !!r.jr }; });
    plan.trips.forEach(function (r) { if (r.deleted) delete shadow.trips[r.id]; else shadow.trips[r.id] = r.updated_at; });
    plan.photos.forEach(function (r) { if (r.deleted) delete shadow.photos[r.id]; });
    return shadow;
  }
  function dropPersonVisits(shadow, pid) { Object.keys(shadow.visits).forEach(function (k) { if (k.indexOf(pid + "|") === 0) delete shadow.visits[k]; }); }
  function photoPath(fid, id, mime) { return fid + "/" + id + (mime === "image/webp" ? ".webp" : ".jpg"); }

  /** Apply rows pulled from the cloud. Changes local + shadow in place and reports what changed.
      rows = { people, visits, trips, photos } as returned by the server (snake_case). Local wins only when it has an
      unsynced edit that is newer than the cloud row. */
  function applyPull(local, shadow, rows, opts) {
    opts = opts || {};
    var ch = { people: 0, visits: 0, trips: 0, removedPeople: [], removedTrips: [], downloads: [], newTrips: [], touched: {} };
    var byId = {}; local.people.forEach(function (p) { byId[p.id] = p; });
    (rows.people || []).forEach(function (r) {
      var p = byId[r.id], localDirty = p && shadow.people[r.id] !== iso(p.updatedAt);
      if (r.deleted) {
        if (p && !(localDirty && newer(p.updatedAt, r.updated_at))) {
          local.people = local.people.filter(function (x) { return x.id !== r.id; }); delete byId[r.id]; ch.removedPeople.push(r.id); ch.people++;
        }
        delete shadow.people[r.id]; dropPersonVisits(shadow, r.id); return;
      }
      if (p && localDirty && !newer(r.updated_at, p.updatedAt)) return;   // our newer edit goes up on the next push
      if (p && !localDirty && shadow.people[r.id] === iso(r.updated_at)) return;   // already have exactly this version (cursor overlap, our own push echoing back)
      var d = r.data || {};
      if (!p) { p = { id: r.id, states: {}, places: {}, parks: {} }; local.people.push(p); byId[r.id] = p; }
      Object.keys(d).forEach(function (k) { if (!PERSON_SKIP[k]) p[k] = d[k]; });
      p.updatedAt = iso(r.updated_at); shadow.people[r.id] = p.updatedAt; ch.people++; ch.touched[r.id] = 1;
    });
    (rows.visits || []).forEach(function (r) {
      var p = byId[r.person_id]; if (!p) return;
      var k = r.person_id + "|" + r.kind + "|" + r.place_id, bag = bagOf(p, r.kind), cur = bag[r.place_id];
      var curFlat = cur ? { at: cur.at || "", jr: !!cur.jr } : null, sh = shadow.visits[k];
      var localDirty = !(curFlat ? sameVisit(curFlat, sh) : !sh);
      if (localDirty && newer(p.updatedAt, r.updated_at)) return;
      if (r.deleted) { if (cur) { delete bag[r.place_id]; ch.visits++; ch.touched[p.id] = 1; } delete shadow.visits[k]; return; }
      var v = { at: r.at ? String(r.at).slice(0, 10) : "" }; if (r.kind === "park") v.jr = !!r.jr;
      if (!curFlat || !sameVisit(curFlat, { at: v.at, jr: !!v.jr })) { bag[r.place_id] = v; ch.visits++; ch.touched[p.id] = 1; }
      shadow.visits[k] = { at: v.at, jr: !!v.jr };
    });
    var tById = {}; local.trips.forEach(function (t) { tById[t.id] = t; });
    (rows.trips || []).forEach(function (r) {
      var t = tById[r.id], localDirty = t && shadow.trips[r.id] !== iso(t.updatedAt);
      if (r.deleted) {
        if (t && !(localDirty && newer(t.updatedAt, r.updated_at))) { local.trips = local.trips.filter(function (x) { return x.id !== r.id; }); ch.removedTrips.push(r.id); ch.trips++; }
        delete shadow.trips[r.id]; return;
      }
      if (t && localDirty && !newer(r.updated_at, t.updatedAt)) return;
      if (t && !localDirty && shadow.trips[r.id] === iso(r.updated_at)) return;   // same version we already have: not a change
      var d = JSON.parse(JSON.stringify(r.data || {})); d.id = r.id; d.updatedAt = iso(r.updated_at);
      if (!Array.isArray(d.kidIds)) d.kidIds = (r.traveler_ids || []).slice();
      if (!t) ch.newTrips.push(r.id);
      local.trips = local.trips.filter(function (x) { return x.id !== r.id; }).concat([d]); tById[r.id] = d;
      shadow.trips[r.id] = d.updatedAt; ch.trips++;
    });
    (rows.photos || []).forEach(function (r) {
      if (r.deleted) { delete shadow.photos[r.id]; return; }
      shadow.photos[r.id] = r.mime || "image/jpeg";
      if ((local.photoIds || []).indexOf(r.id) < 0) ch.downloads.push({ id: r.id, path: r.path, mime: r.mime });
    });
    return ch;
  }
  /** Highest server_at seen, minus a little overlap so a slow transaction committing late isn't skipped. Re-applying is harmless. */
  function nextCursor(prev, rows, overlapMs) {
    var max = ms(prev);
    (rows || []).forEach(function (r) { if (ms(r.server_at) > max) max = ms(r.server_at); });
    return max ? new Date(Math.max(0, max - (overlapMs == null ? 10000 : overlapMs))).toISOString() : "";
  }

  // ---------- joining a family that already has a log ----------
  /** Suggest which of this phone's people are the same as people already in the family (same name, ignoring case). */
  function matchPeople(localPeople, remotePeople) {
    var out = {};
    localPeople.forEach(function (lp) {
      var hit = remotePeople.filter(function (rp) { return String(rp.name || "").trim().toLowerCase() === String(lp.name || "").trim().toLowerCase(); })[0];
      if (hit && hit.id !== lp.id) out[lp.id] = hit.id;
    });
    return out;
  }
  /** Rename local person ids (mapping localId -> familyId) so both maps become one. Trips follow; a person merged into
      someone who already exists locally gets their map colors added together. */
  function remapPeople(local, mapping) {
    var ids = Object.keys(mapping || {}); if (!ids.length) return local;
    var now = new Date().toISOString(), byId = {};
    local.people.forEach(function (p) { byId[p.id] = p; });
    ids.forEach(function (from) {
      var to = mapping[from], p = byId[from]; if (!p || !to || to === from) return;
      var target = byId[to];
      if (target) {
        ["states", "places", "parks"].forEach(function (b) { Object.keys(p[b] || {}).forEach(function (k) { if (!target[b][k]) target[b][k] = p[b][k]; else if (p[b][k].jr) target[b][k].jr = true; }); });
        target.updatedAt = now;
        local.people = local.people.filter(function (x) { return x !== p; });
      } else {
        // becoming the family's person: their profile (name, color...) in the family log wins, so mark ours as oldest.
        // Map colors still go up, since each place is its own row.
        p.id = to; p.updatedAt = new Date(1).toISOString(); byId[to] = p;
      }
      delete byId[from];
    });
    local.trips.forEach(function (t) {
      var changed = false;
      t.kidIds = t.kidIds.map(function (id) { if (mapping[id]) { changed = true; return mapping[id]; } return id; })
        .filter(function (id, i, a) { return a.indexOf(id) === i; });
      if (t.mark) { /* marks are applied at save time; nothing to move */ }
      if (changed) t.updatedAt = now;
    });
    return local;
  }

  // ---------- plan / entitlement ----------
  /** Family Keeper ($24.99/yr covers the whole family). flags.testing unlocks everything while the family tests. */
  var FREE = { members: 2, photos: false };
  function access(family, flags, now) {
    now = ms(now) || Date.now(); flags = flags || {};
    if (flags.testing) return { tier: "testing", unlocked: true, label: "Family testing: everything is unlocked" };
    if (!family) return { tier: "free", unlocked: false, label: "Free" };
    if (family.plan === "keeper" && (!family.keeper_until || ms(family.keeper_until) > now)) return { tier: "keeper", unlocked: true, label: "Family Keeper" };
    if (family.trial_ends_at && ms(family.trial_ends_at) > now) {
      var days = Math.ceil((ms(family.trial_ends_at) - now) / 864e5);
      return { tier: "trial", unlocked: true, label: "Free trial: " + days + (days === 1 ? " day" : " days") + " left" };
    }
    return { tier: "free", unlocked: false, label: "Free" };
  }
  function allows(acc, feature, count) {
    if (acc.unlocked) return true;
    if (feature === "members") return (count || 0) < FREE.members;
    if (feature === "photos") return FREE.photos;
    return true;
  }

  // ---------- fun bits ----------
  var JOIN_LINES = ["{n} joined the crew! 🎉", "{n} is on board! 🧭", "Welcome aboard, {n}! 🗺️", "{n} just joined the family log! ✨"];
  /** Same person always gets the same cheer, so it doesn't flicker between renders. */
  function joinLine(name, seed) {
    var s = String(seed || name || ""), h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return JOIN_LINES[h % JOIN_LINES.length].replace("{n}", String(name || "Someone").trim() || "Someone");
  }
  /** Members we haven't celebrated yet (not me, joined after this phone joined). */
  function newMembers(members, seen, myId) {
    return (members || []).filter(function (m) { return m.user_id !== myId && !(seen || {})[m.user_id]; });
  }
  /** "just now", "5 min ago", "3 hours ago", "yesterday", "4 days ago", or a date. */
  function ago(t, now) {
    var d = (ms(now) || Date.now()) - ms(t); if (!ms(t)) return "";
    if (d < 6e4) return "just now";
    if (d < 36e5) return Math.round(d / 6e4) + " min ago";
    if (d < 864e5) { var h = Math.round(d / 36e5); return h + (h === 1 ? " hour ago" : " hours ago"); }
    if (d < 2 * 864e5) return "yesterday";
    if (d < 30 * 864e5) return Math.round(d / 864e5) + " days ago";
    return new Date(ms(t)).toISOString().slice(0, 10);
  }
  /** Family feed: newest trips first (by when they were added), with who added them when we know. */
  function feed(trips, authors, limit) {
    return trips.slice().sort(function (a, b) { return ms(b.createdAt || b.updatedAt) - ms(a.createdAt || a.updatedAt); })
      .slice(0, limit || 20).map(function (t) { return { trip: t, by: (authors || {})[t.id] || "", at: t.createdAt || t.updatedAt }; });
  }

  /** Long edge capped for the shared photo copy. */
  function thumbDims(w, h, max) {
    max = max || 1024; if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
    var s = Math.min(1, max / Math.max(w, h)); return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  function cleanName(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ").slice(0, max || 40); }


  // ---------- family logs on this phone ----------
  // Each log is its own IndexedDB database. "mltl" is the phone's original log (it may or may not be linked to a family);
  // every other family gets "mltl-<random>". The list lives in localStorage "mltl-logs" so app.js can open the right one at start.
  var LOGS_KEY = "mltl-logs", DEFAULT_DB = "mltl", MAX_FAMILIES = 3;
  function defaultLogs() { return { active: DEFAULT_DB, logs: [{ db: DEFAULT_DB, name: "", familyId: null }] }; }
  function cleanLogs(x) {
    var out = defaultLogs();
    if (!x || typeof x !== "object" || !Array.isArray(x.logs)) return out;
    var seen = {}; out.logs = [];
    x.logs.forEach(function (l) {
      if (!l || typeof l.db !== "string" || !/^mltl(-[a-z0-9]{4,24})?$/.test(l.db) || seen[l.db]) return;
      seen[l.db] = 1;
      out.logs.push({ db: l.db, name: cleanName(l.name, 60), familyId: typeof l.familyId === "string" ? l.familyId : null,
                      myPerson: typeof l.myPerson === "string" ? l.myPerson : null, myName: cleanName(l.myName, 40) });
    });
    if (!seen[DEFAULT_DB]) out.logs.unshift({ db: DEFAULT_DB, name: "", familyId: null, myPerson: null, myName: "" });
    out.active = seen[x.active] ? x.active : DEFAULT_DB;
    return out;
  }
  function readLogs(store) { try { return cleanLogs(JSON.parse(store.getItem(LOGS_KEY) || "null")); } catch (e) { return defaultLogs(); } }
  function writeLogs(store, reg) { try { store.setItem(LOGS_KEY, JSON.stringify(cleanLogs(reg))); } catch (e) {} return reg; }
  function findLog(reg, db) { return reg.logs.filter(function (l) { return l.db === db; })[0] || null; }
  function linkedCount(reg) { return reg.logs.filter(function (l) { return l.familyId; }).length; }
  function logForFamily(reg, fid) { return reg.logs.filter(function (l) { return fid && l.familyId === fid; })[0] || null; }
  /** Add an empty log. rand() gives the random part (tests pass a fixed one). */
  function addLog(reg, name, rand) {
    var id, n = 0;
    do { id = "mltl-" + String(rand ? rand() : Math.random().toString(36).slice(2, 10)).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12); if (n++ > 20) id = "mltl-log" + n + Date.now().toString(36); }
    while (findLog(reg, id) || id.length < 9);
    reg.logs.push({ db: id, name: cleanName(name, 60), familyId: null, myPerson: null, myName: "" });
    return id;
  }
  function updateLog(reg, db, vals) { var l = findLog(reg, db); if (l) Object.keys(vals).forEach(function (k) { l[k] = vals[k]; }); return l; }
  function removeLog(reg, db) {
    if (db === DEFAULT_DB) return false;
    var n = reg.logs.length; reg.logs = reg.logs.filter(function (l) { return l.db !== db; });
    if (reg.active === db) reg.active = DEFAULT_DB;
    return reg.logs.length < n;
  }
  function logLabel(l) { return l.familyId ? (l.name || "Family log") : (l.db === DEFAULT_DB ? "This phone only" : (l.name ? l.name + " (this phone only)" : "Another log on this phone")); }
  /** "Also add to my other family's log" targets: other linked logs where I've said which person is me. */
  function copyTargets(reg, fromDb) {
    return reg.logs.filter(function (l) { return l.db !== fromDb && l.familyId && l.myPerson; });
  }
  /** A copy of a trip for another family's log: new id, just me on it, and a note of where it came from. */
  function copyTrip(t, toPerson, from, newId, now) {
    var c = JSON.parse(JSON.stringify(t));
    c.id = newId; c.kidIds = [toPerson]; c.createdAt = now; c.updatedAt = now;
    c.copiedFrom = { familyName: cleanName(from.familyName, 60), familyId: from.familyId || null, tripId: t.id };
    if (c.who === undefined) c.who = "";
    return c;
  }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30); }

  return { WORDS: WORDS, normCode: normCode, isCode: isCode, makeCode: makeCode, codeFromLink: codeFromLink, inviteLink: inviteLink, familyTitle: familyTitle,
           ms: ms, iso: iso, newer: newer, personRow: personRow, tripRow: tripRow, flatVisits: flatVisits, emptyShadow: emptyShadow,
           planPush: planPush, afterPush: afterPush, applyPull: applyPull, nextCursor: nextCursor, photoPath: photoPath,
           matchPeople: matchPeople, remapPeople: remapPeople, access: access, allows: allows, FREE: FREE,
           joinLine: joinLine, newMembers: newMembers, ago: ago, feed: feed, thumbDims: thumbDims, cleanName: cleanName,
           LOGS_KEY: LOGS_KEY, DEFAULT_DB: DEFAULT_DB, MAX_FAMILIES: MAX_FAMILIES, readLogs: readLogs, writeLogs: writeLogs, cleanLogs: cleanLogs, findLog: findLog,
           linkedCount: linkedCount, logForFamily: logForFamily, addLog: addLog, updateLog: updateLog, removeLog: removeLog, logLabel: logLabel,
           copyTargets: copyTargets, copyTrip: copyTrip, slug: slug };
});
