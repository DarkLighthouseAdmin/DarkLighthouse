/* Famstamp "Trips to plan": the family wishlist. Anyone, kids included, adds a dream place; everyone gets one vote per
   place and can toggle emoji reactions. Places move to "Made it!" by themselves once a finished trip goes there or the
   place gets stamped.
   Storage rides on the people the app already syncs (people.data JSONB), so no new table is needed:
     person.wishes = [{ id, name, sub, kind: "city"|"park"|"area", lat, lon, country, region, ref, area, note, at, ts, had }]
       (the places that person added)
     person.wv = { wishId: { v: 1, r: ["😍", "🍕"] } }   (that person's own vote and reactions)
   Each member only ever writes their own row, so two phones voting at the same time can't overwrite each other.
   Pure logic, testable in Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.FS_WISHES = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var REACTIONS = ["😍", "🏖️", "🏔️", "🎢", "🍕", "🤔"];
  var MAX_PER_PERSON = 40, NOTE_MAX = 140, NEAR_MI = 25;
  var UK = ["ENG", "SCT", "WLS", "NIR"];
  function str(s, n) { return typeof s === "string" ? s.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : ""; }
  function num(x, lo, hi) { x = +x; return isFinite(x) && x >= lo && x <= hi ? Math.round(x * 1e4) / 1e4 : null; }
  function vdate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; }
  function uid() { return "wish_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function miles(a, b) {
    var R = 3958.8, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function hasLoc(p) { return p && typeof p.lat === "number" && typeof p.lon === "number"; }

  /** One wish, cleaned. Returns null when there's no place name. */
  function cleanWish(w) {
    if (!w || typeof w !== "object") return null;
    var name = str(w.name, 80); if (!name) return null;
    var kind = /^(city|park|area)$/.test(w.kind) ? w.kind : "city";
    var o = { id: /^wish_[\w-]{1,40}$/.test(w.id) ? w.id : uid(), name: name, kind: kind };
    var sub = str(w.sub, 80); if (sub) o.sub = sub;
    var lat = num(w.lat, -90, 90), lon = num(w.lon, -180, 180); if (lat != null && lon != null) { o.lat = lat; o.lon = lon; }
    var c = str(w.country, 3); if (/^[A-Z]{3}$/.test(c)) o.country = c;
    var rg = str(w.region, 6); if (rg) o.region = rg;
    if (kind === "park") { var ref = str(w.ref, 40); if (ref) o.ref = ref; }
    if (kind === "area" && /^(state|place):[A-Z]{2,3}$/.test(w.area || "")) o.area = w.area;
    if (kind === "area" && !o.area) o.kind = "city";
    var note = str(w.note, NOTE_MAX); if (note) o.note = note;
    o.at = vdate(w.at) || today();
    if (typeof w.ts === "string" && !isNaN(Date.parse(w.ts))) o.ts = w.ts;
    if (Array.isArray(w.had)) o.had = w.had.filter(function (x) { return typeof x === "string" && x.length <= 64; }).slice(0, 30);
    return o;
  }
  function cleanWishes(a) {
    var seen = {}; return (Array.isArray(a) ? a : []).map(cleanWish).filter(function (w) { if (!w || seen[w.id]) return false; seen[w.id] = 1; return true; }).slice(0, MAX_PER_PERSON);
  }
  function cleanVotes(o) {
    var out = {}; if (!o || typeof o !== "object") return out;
    Object.keys(o).slice(0, 400).forEach(function (id) {
      if (!/^wish_[\w-]{1,40}$/.test(id)) return;
      var e = o[id] || {}, r = (Array.isArray(e.r) ? e.r : []).filter(function (x, i, a) { return REACTIONS.indexOf(x) >= 0 && a.indexOf(x) === i; });
      if (e.v || r.length) { out[id] = {}; if (e.v) out[id].v = 1; if (r.length) out[id].r = r; }
    });
    return out;
  }
  function stampBag(p, area) {
    if (!p || !area) return null; var k = area.split(":"), bag = k[0] === "state" ? p.states : p.places;
    return bag && bag[k[1]] ? bag[k[1]] : null;
  }
  function stampOf(p, w) {
    if (w.kind === "park" && w.ref) return p.parks && p.parks[w.ref] ? p.parks[w.ref] : null;
    if (w.kind === "area") return stampBag(p, w.area);
    return null;
  }
  /** Who already had this place stamped when it went on the list (so an old stamp doesn't count as "made it"). */
  function hadNow(w, people) { return (people || []).filter(function (p) { return !!stampOf(p, w); }).map(function (p) { return p.id; }); }

  /** Make a new wish for a person (they vote for it too). Throws on a duplicate place. */
  function addWish(person, place, note, all, people, now) {
    if (!person) throw new Error("Pick who's adding it.");
    var w = cleanWish({ name: place && place.name, sub: place && place.sub, kind: place && place.kind, lat: place && place.lat, lon: place && place.lon,
      country: place && place.country, region: place && place.region, ref: place && place.ref, area: place && place.area, note: note,
      at: (now || "").slice(0, 10) || today(), ts: now || new Date().toISOString() });
    if (!w) throw new Error("Pick a place first.");
    var dup = (all || []).filter(function (x) { return !x.made && samePlace(x.w, w); })[0];
    if (dup) throw new Error(dup.w.name + " is already on the list. Give it a vote!");
    var mine = cleanWishes(person.wishes); if (mine.length >= MAX_PER_PERSON) throw new Error("That's a lot of dreams! Plan or remove a few first.");
    var had = hadNow(w, people); if (had.length) w.had = had;
    mine.push(w); person.wishes = mine;
    var v = cleanVotes(person.wv); v[w.id] = { v: 1 }; person.wv = v;
    return w;
  }
  function samePlace(a, b) {
    if (a.kind === "park" || b.kind === "park") return a.kind === b.kind && a.ref === b.ref;
    if (a.kind === "area" || b.kind === "area") return a.kind === b.kind && a.area === b.area;
    if (hasLoc(a) && hasLoc(b)) return miles(a, b) < 3;
    return a.name.toLowerCase() === b.name.toLowerCase() && (a.country || "") === (b.country || "");
  }
  function toggleVote(person, id) {
    var v = cleanVotes(person.wv), e = v[id] || {};
    if (e.v) delete e.v; else e.v = 1;
    if (e.v || (e.r && e.r.length)) v[id] = e; else delete v[id];
    person.wv = v; return !!e.v;
  }
  function toggleReact(person, id, emo) {
    if (REACTIONS.indexOf(emo) < 0) return false;
    var v = cleanVotes(person.wv), e = v[id] || {}, r = (e.r || []).slice(), i = r.indexOf(emo);
    if (i >= 0) r.splice(i, 1); else r.push(emo);
    if (r.length) e.r = r; else delete e.r;
    if (e.v || e.r) v[id] = e; else delete v[id];
    person.wv = v; return i < 0;
  }
  function removeWish(people, id) {
    var owner = null;
    (people || []).forEach(function (p) {
      var before = (p.wishes || []).length;
      if (before) { p.wishes = (p.wishes || []).filter(function (w) { return w && w.id !== id; }); if (p.wishes.length !== before) owner = p; }
    });
    return owner;
  }

  /** Does a trip stop count as this wish's place? */
  function stopMatches(w, s) {
    if (!s) return false;
    if (w.kind === "park") return !!w.ref && s.ref === w.ref;
    if (w.kind === "area") {
      var k = w.area.split(":");
      if (k[0] === "state") return s.country === "USA" && s.region === k[1];
      if (UK.indexOf(k[1]) >= 0) return s.country === "GBR" && s.region === k[1];
      return s.country === k[1];
    }
    if (hasLoc(w) && hasLoc(s)) return miles(w, s) <= NEAR_MI;
    return String(s.name || "").toLowerCase() === w.name.toLowerCase();
  }
  function tripDone(t, now) { return !!(t && (t.done || (t.endDate && t.endDate <= now))); }
  /** { how: "trip"|"stamp", at, trip, who: [personIds] } once the family has been there since adding it; else null. */
  function madeIt(w, trips, people, now) {
    now = now || today();
    var best = null;
    (trips || []).forEach(function (t) {
      if (!tripDone(t, now)) return;
      var end = t.endDate || t.date || "", fresh = (end && end >= w.at) || (w.ts && t.createdAt && t.createdAt >= w.ts);
      if (!fresh) return;
      var stops = (t.route || []).slice(1).concat(t.route && t.route.length === 1 ? t.route : []);
      if (!stops.some(function (s) { return stopMatches(w, s); })) return;
      if (!best || end < best.at) best = { how: "trip", at: end || now, trip: t.id, who: (t.kidIds || []).slice() };
    });
    if (best) return best;
    var had = w.had || [], who = [], at = "";
    (people || []).forEach(function (p) {
      var s = stampOf(p, w); if (!s) return;
      var sa = typeof s === "object" && s.at ? s.at : "";
      if (had.indexOf(p.id) < 0 || (sa && sa >= w.at)) { who.push(p.id); if (!at || (sa && sa < at)) at = sa; }
    });
    return who.length ? { how: "stamp", at: at || w.at, who: who } : null;
  }

  /** Everything on the list: [{ w, owner, votes: [ids], reacts: { emo: [ids] }, made }]; open wishes by votes, then made-it. */
  function list(people, trips, now) {
    var out = [], byId = {};
    (people || []).forEach(function (p) {
      cleanWishes(p.wishes).forEach(function (w) { if (byId[w.id]) return; var e = { w: w, owner: p.id, votes: [], reacts: {} }; byId[w.id] = e; out.push(e); });
    });
    (people || []).forEach(function (p) {
      var v = cleanVotes(p.wv);
      Object.keys(v).forEach(function (id) {
        var e = byId[id]; if (!e) return;
        if (v[id].v) e.votes.push(p.id);
        (v[id].r || []).forEach(function (emo) { (e.reacts[emo] = e.reacts[emo] || []).push(p.id); });
      });
    });
    out.forEach(function (e) { e.made = madeIt(e.w, trips, people, now); });
    function nReacts(e) { return Object.keys(e.reacts).reduce(function (n, k) { return n + e.reacts[k].length; }, 0); }
    var open = out.filter(function (e) { return !e.made; }).sort(function (a, b) {
      return b.votes.length - a.votes.length || nReacts(b) - nReacts(a) || (b.w.ts || b.w.at).localeCompare(a.w.ts || a.w.at) || a.w.name.localeCompare(b.w.name);
    });
    var made = out.filter(function (e) { return e.made; }).sort(function (a, b) { return String(b.made.at).localeCompare(String(a.made.at)); });
    return { open: open, made: made };
  }
  /** A planned-trip starting point for "Plan this trip": the place as the trip's destination. */
  function tripStop(w) {
    var o = { name: w.name, kind: w.kind === "park" ? "park" : "city" };
    ["lat", "lon", "country", "region", "sub"].forEach(function (k) { if (w[k] != null) o[k] = w[k]; });
    if (w.kind === "park" && w.ref) o.ref = w.ref;
    return o;
  }
  return { REACTIONS: REACTIONS, MAX_PER_PERSON: MAX_PER_PERSON, NOTE_MAX: NOTE_MAX, cleanWish: cleanWish, cleanWishes: cleanWishes, cleanVotes: cleanVotes,
           addWish: addWish, samePlace: samePlace, toggleVote: toggleVote, toggleReact: toggleReact, removeWish: removeWish, stopMatches: stopMatches,
           madeIt: madeIt, list: list, tripStop: tripStop, hadNow: hadNow };
});
