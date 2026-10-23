/* Famstamp kid travel quests: little scavenger hunts for a place (Scotland, Ireland, England, Florida, a few national parks)
   or any trip (road trip, flight, beach, anywhere new). Tick things off as you spot them; finish a quest to earn its badge.
   Progress lives on the person as person.quests = { questId: { done: { "0": "2026-10-23", ... }, at: "2026-10-23" } },
   so it syncs with the rest of the person (JSONB data blob) and goes into backups. Pure logic is testable in Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.FS_QUESTS = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // match: what in the person's log makes a quest "for your trips": places (country codes), states, parks (ids) or anyPark
  // the park explorer quest: one per national park in the person's log, tied to that park's stamp. Item 0 is the
  // Junior Ranger badge, which is the same tick as "Ranger?" on the Parks tab (person.parks[id].jr).
  var PARK_ITEMS = [["🎖️", "Earn a Junior Ranger badge"], ["🦌", "Spot wildlife (from a safe distance)"], ["🥾", "Hike a trail"], ["💡", "Learn a fact about the park"],
    ["🧢", "Talk to a ranger"], ["📮", "Get the visitor center stamp"], ["🐾", "Find animal tracks"], ["🗑️", "Leave no trace: pack out your trash"]];
  var JR_URL = "https://www.nps.gov/kids/junior-rangers.htm";
  var PARKS = [];   // set by setParks(MLTL.PARKS)
  function setParks(list) { if (Array.isArray(list)) PARKS = list; }
  function parkOf(pid) { return PARKS.filter(function (x) { return x.id === pid; })[0] || null; }
  var QUESTS = [
    { id: "scotland", name: "Scotland quest", emoji: "🏰", badge: "Highland explorer", match: { places: ["SCT"] }, items: [
      ["🐮", "Spot a shaggy Highland cow"], ["🎶", "Hear someone play the bagpipes"], ["🏰", "Explore a castle"], ["🌸", "Find a purple thistle"],
      ["🍪", "Taste shortbread"], ["👘", "Spot someone wearing a kilt"], ["🦕", "Look for Nessie in a loch"], ["🐑", "Count 10 sheep on a hill"]] },
    { id: "ireland", name: "Ireland quest", emoji: "☘️", badge: "Emerald explorer", match: { places: ["IRL", "NIR"] }, items: [
      ["☘️", "Find a shamrock"], ["🌈", "Spot a rainbow"], ["🏰", "Climb around a castle ruin"], ["🐑", "Wait for sheep crossing the road"],
      ["🎻", "Hear Irish music"], ["🍞", "Try soda bread"], ["🌊", "Stand on top of a sea cliff (behind the fence!)"], ["🪢", "Find a Celtic knot pattern"]] },
    { id: "england", name: "England quest", emoji: "💂", badge: "Royal rambler", match: { places: ["ENG", "GBR"] }, items: [
      ["🚌", "Ride or spot a red double-decker bus"], ["☎️", "Find a red phone box"], ["🏰", "Visit a castle"], ["🐟", "Eat fish and chips"],
      ["👑", "Spot a crown on a sign or building"], ["🚇", "Ride the Underground or a train"], ["🫖", "Have a scone with jam"], ["🕰️", "Hear a big clock bell chime"]] },
    { id: "florida", name: "Florida quest", emoji: "🌴", badge: "Sunshine scout", match: { states: ["FL"] }, items: [
      ["🐊", "Spot an alligator (from far away!)"], ["🐚", "Find a seashell"], ["🌴", "Count 20 palm trees"], ["🐦", "See a pelican dive"],
      ["🍊", "Drink fresh orange juice"], ["🚀", "Find something about rockets or space"], ["🦭", "Look for a manatee"], ["🏖️", "Build a sandcastle"]] },
    { id: "yellowstone", name: "Yellowstone quest", emoji: "♨️", badge: "Geyser gazer", match: { parks: ["yellowstone"] }, items: [
      ["⛲", "Watch a geyser erupt"], ["🦬", "Spot a bison (stay far back)"], ["🌫️", "See steam rising from the ground"], ["🌈", "Find a rainbow-colored hot spring"],
      ["🦌", "Spot an elk"], ["🥾", "Walk a boardwalk trail"], ["🏅", "Earn a Junior Ranger badge"], ["📮", "Get the visitor center stamp"]] },
    { id: "grand-canyon", name: "Grand Canyon quest", emoji: "🏜️", badge: "Canyon climber", match: { parks: ["grand-canyon"] }, items: [
      ["🌅", "Watch the canyon change color at sunset"], ["🐦‍⬛", "Spot a raven or a condor"], ["🪨", "Count the rock layers you can see"], ["🫏", "See a mule"],
      ["🔭", "Find the river at the very bottom"], ["🥾", "Walk part of a rim trail"], ["🏅", "Earn a Junior Ranger badge"], ["📮", "Get the visitor center stamp"]] },
    { id: "smokies", name: "Great Smoky Mountains quest", emoji: "🌲", badge: "Smoky Mountain scout", match: { parks: ["great-smoky-mountains"] }, items: [
      ["🌫️", "See the blue 'smoke' over the mountains"], ["💧", "Find a waterfall"], ["🦎", "Spot a salamander (look, don't touch)"], ["🛖", "Visit an old log cabin"],
      ["🐻", "Learn what to do if you see a bear"], ["🦋", "Spot a butterfly"], ["🏅", "Earn a Junior Ranger badge"], ["📮", "Get the visitor center stamp"]] },
    { id: "park", name: "Any national park quest", emoji: "🏞️", badge: "Park Explorer", items: PARK_ITEMS },
    { id: "road-trip", name: "Road trip quest", emoji: "🚗", badge: "Road trip champ", items: [
      ["🔢", "Spot license plates from 5 states"], ["🐄", "Count 10 cows"], ["🗼", "Find a water tower"], ["🌉", "Cross a big bridge"],
      ["😂", "See a town with a funny name"], ["🚐", "Spot an RV"], ["🎤", "Sing a whole song together"], ["🗺️", "Cross a state line"]] },
    { id: "flight", name: "Flying quest", emoji: "✈️", badge: "Sky captain", items: [
      ["🛫", "Watch a plane take off"], ["☁️", "Look down on the clouds"], ["🧳", "Find your bag on the carousel"], ["🚪", "Find your gate"],
      ["👋", "Wave to a pilot"], ["🥤", "Pick your own snack or drink"], ["🪟", "Spot a city from the window"], ["🛬", "Feel the bump of landing"]] },
    { id: "beach", name: "Beach quest", emoji: "🏖️", badge: "Beachcomber", items: [
      ["🏰", "Build a sandcastle"], ["🐚", "Find a shell"], ["🌊", "Dip your toes in the ocean"], ["🦀", "Spot a crab"],
      ["🐦", "Count 5 seagulls"], ["🗼", "See a lighthouse"], ["🌅", "Watch the sun set or rise"], ["🪸", "Find a smooth sea glass or stone"]] },
    { id: "anywhere", name: "New place quest", emoji: "🧭", badge: "World explorer", items: [
      ["🍜", "Try a food you've never had"], ["👋", "Learn to say hello the local way"], ["💌", "Send a postcard"], ["📸", "Take a family photo"],
      ["🏛️", "Find the oldest building you can"], ["✏️", "Draw something you saw"], ["🗺️", "Find where you are on a map"], ["⭐", "Pick a favorite moment"]] }
  ];
  var BY = {}; QUESTS.forEach(function (q) { BY[q.id] = q; });
  /** a quest by id, including "park-<parkId>" explorer quests */
  function get(id) {
    if (BY[id]) return BY[id];
    var m = /^park-([a-z0-9-]{2,40})$/.exec(id || ""), pk = m && parkOf(m[1]);
    return pk ? { id: id, park: pk.id, name: pk.name + " explorer quest", emoji: "🏞️", badge: pk.name + " Explorer", items: PARK_ITEMS } : null;
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function has(bag, id) { return !!(bag && bag[id]); }
  function stamped(p, kind, id) { return (p.stamps || []).some(function (s) { return s.kind === kind && s.area === id; }); }
  /** true when the person's log has been somewhere this quest is about */
  function matches(q, p) {
    if (q.park) return !!(p && p.parks && p.parks[q.park]);
    var m = q.match; if (!m || !p) return false;
    if (m.anyPark && Object.keys(p.parks || {}).length) return true;
    return (m.places || []).some(function (c) { return has(p.places, c) || stamped(p, "place", c); }) ||
      (m.states || []).some(function (c) { return has(p.states, c) || stamped(p, "state", c); }) ||
      (m.parks || []).some(function (c) { return has(p.parks, c); });
  }
  function jrOn(p, q) { return !!(q.park && p && p.parks && p.parks[q.park] && p.parks[q.park].jr); }
  function prog(p, id) { var r = p && p.quests && p.quests[id]; return r && r.done ? r : { done: {} }; }
  function progress(p, id) {
    var q = get(id); if (!q) return null; var r = prog(p, id), n = q.items.filter(function (x, i) { return r.done[i] || (i === 0 && jrOn(p, q)); }).length;
    return { have: n, need: q.items.length, complete: n === q.items.length, at: r.at || "" };
  }
  /** tick or untick one thing; returns true when that tick finished the quest */
  function toggle(p, id, i, on, when) {
    var q = get(id); if (!q || !(i >= 0 && i < q.items.length)) return false;
    if (q.park && i === 0) {   // Junior Ranger: same record as the Parks tab, so it counts for badges and Firsts too
      p.parks = p.parks || {};
      if (on) { p.parks[q.park] = p.parks[q.park] || { at: when || today() }; p.parks[q.park].jr = true; } else if (p.parks[q.park]) p.parks[q.park].jr = false;
    }
    p.quests = p.quests || {}; var r = p.quests[id] = p.quests[id] || { done: {} }; r.done = r.done || {};
    var was = progress(p, id).complete;
    if (on) r.done[i] = when || today(); else delete r.done[i];
    var now = progress(p, id).complete;
    if (now && !was) r.at = when || today(); if (!now) delete r.at;
    if (!Object.keys(r.done).length) delete p.quests[id];
    p.updatedAt = new Date().toISOString();
    return now && !was;
  }
  /** quests sorted: ones for this person's places first, then started ones, then the rest */
  function list(p) {
    var parkQs = Object.keys((p && p.parks) || {}).map(function (pid) { return get("park-" + pid); }).filter(Boolean);
    return parkQs.concat(QUESTS).map(function (q, i) { var pr = progress(p, q.id); return { q: q, pr: pr, mine: matches(q, p), i: i }; })
      .sort(function (a, b) { return (b.mine - a.mine) || ((b.pr.have > 0) - (a.pr.have > 0)) || (a.i - b.i); });
  }
  function earned(p) {
    var ids = QUESTS.map(function (q) { return q.id; }).concat(Object.keys((p && p.quests) || {}).filter(function (id) { return /^park-/.test(id); }));
    return ids.map(get).filter(function (q) { return q && progress(p, q.id).complete; }).map(function (q) { return { q: q, at: progress(p, q.id).at }; }); }
  /** keep only known quests and sane dates (backups, synced data) */
  function clean(x) {
    var out = {}; if (!x || typeof x !== "object") return out;
    Object.keys(x).forEach(function (id) {
      var q = get(id) || (/^park-[a-z0-9-]{2,40}$/.test(id) ? { items: PARK_ITEMS } : null), r = x[id]; if (!q || !r || typeof r.done !== "object" || !r.done) return;
      var d = {}; Object.keys(r.done).forEach(function (i) { var v = r.done[i]; if (/^\d+$/.test(i) && +i < q.items.length && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) d[i] = v; });
      if (!Object.keys(d).length) return; out[id] = { done: d };
      if (typeof r.at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.at) && Object.keys(d).length === q.items.length) out[id].at = r.at;
    });
    return out;
  }

  // ---------- browser view: #/p/<id>/quests and #/p/<id>/quests/<questId> ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ring(pr) { var f = pr.need ? pr.have / pr.need : 0, C = 2 * Math.PI * 20;
    return '<svg class="qring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="#e4ddcf" stroke-width="5"/>' + (f > 0 ? '<circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 24 24)"/>' : "") + '</svg>'; }
  function card(k, x) {
    var q = x.q, pr = x.pr;
    return '<a class="qcard' + (pr.complete ? " done" : "") + '" href="#/p/' + esc(k.id) + '/quests/' + q.id + '"><span class="qemo" aria-hidden="true">' + ring(pr) + '<i>' + q.emoji + '</i></span>' +
      '<span class="qtxt"><b>' + esc(q.name) + '</b><span>' + (pr.complete ? "🏅 " + esc(q.badge) + " badge earned" : pr.have ? pr.have + " of " + pr.need + " found" : pr.need + " things to find") + '</span></span><span class="qgo" aria-hidden="true">›</span></a>';
  }
  function view(k, qid) {
    var A = window.MLTL_APP, main = A.main; if (window.MLTL) setParks(window.MLTL.PARKS); var q = qid && get(qid);
    document.title = (q ? q.name : "Quests") + " · Famstamp";
    if (!q) {
      var L = list(k), mine = L.filter(function (x) { return x.mine; }), rest = L.filter(function (x) { return !x.mine; }), got = earned(k);
      main.innerHTML = A.shell(k, "stats", '<div class="qhead"><h2>🧭 ' + esc(window.MLTL.who(k)) + '\'s travel quests</h2><p class="muted">Little scavenger hunts for your trips. Tick things off as you spot them and finish a quest to earn its badge.</p></div>' +
        (got.length ? '<div class="qbadges" aria-label="Quest badges">' + got.map(function (g) { return '<span class="qbadge" title="' + esc(g.q.badge) + '"><i aria-hidden="true">' + g.q.emoji + '</i>' + esc(g.q.badge) + '</span>'; }).join("") + '</div>' : "") +
        (mine.length ? '<h3 class="qsec">For your trips</h3><div class="qlist">' + mine.map(function (x) { return card(k, x); }).join("") + '</div>' : "") +
        '<h3 class="qsec">' + (mine.length ? "More quests" : "Pick a quest") + '</h3><div class="qlist">' + rest.map(function (x) { return card(k, x); }).join("") + '</div>' +
        '<div class="actions"><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/stats">Back to badges</a></div>');
      return;
    }
    var pr = progress(k, q.id), r = prog(k, q.id), pk = q.park && parkOf(q.park);
    main.innerHTML = A.shell(k, "stats", '<p class="qback"><a href="#/p/' + esc(k.id) + '/quests">‹ All quests</a></p>' +
      '<div class="qhero' + (pr.complete ? " done" : "") + '"><span class="qemo big" aria-hidden="true">' + ring(pr) + '<i>' + q.emoji + '</i></span><div><h2>' + esc(q.name) + '</h2>' +
      '<p class="qcount" aria-live="polite">' + (pr.complete ? "🏅 You earned the " + esc(q.badge) + " badge!" : pr.have + " of " + pr.need + " found") + '</p></div></div>' +
      (pk && A.parkStamp ? '<div class="qstamp' + (k.parks[pk.id] ? " on" : "") + '" aria-hidden="true">' + A.parkStamp(pk, k.parks[pk.id]) + '</div>' : "") +
      '<ul class="qitems">' + q.items.map(function (it, i) { var on = !!r.done[i] || (i === 0 && jrOn(k, q));
        return '<li><label class="qitem' + (on ? " on" : "") + '"><input type="checkbox" data-qi="' + i + '"' + (on ? " checked" : "") + '><span class="qe" aria-hidden="true">' + it[0] + '</span><span class="qt">' + esc(it[1]) + '</span><span class="qbox" aria-hidden="true">' + (on ? "✓" : "") + '</span></label></li>'; }).join("") + '</ul>' +
      (q.items === PARK_ITEMS ? '<p class="hint qjr">Junior Ranger is a free program from the National Park Service: ask for the activity booklet at the visitor center. Famstamp isn\'t part of the National Park Service; this checklist is just for fun. <a href="' + JR_URL + '" target="_blank" rel="noopener">About Junior Rangers (nps.gov)</a></p>' : "") +
      '<p class="hint">Grown-ups: stay safe and keep a good distance from wild animals. Nothing here needs buying.</p>');
    main.querySelectorAll("[data-qi]").forEach(function (b) {
      b.onchange = function () {
        var fin = toggle(k, q.id, +b.dataset.qi, b.checked); A.saveKid(k);
        if (fin) A.toast("🏅 " + q.badge + " badge earned!"); else if (b.checked) A.toast("Found it! ✓");
        var y = window.scrollY; view(k, q.id); window.scrollTo(0, y);
        var nb = main.querySelector('[data-qi="' + b.dataset.qi + '"]'); if (nb) nb.focus({ preventScroll: true });
      };
    });
  }
  return { QUESTS: QUESTS, byId: BY, get: get, setParks: setParks, PARK_ITEMS: PARK_ITEMS, JR_URL: JR_URL, matches: matches, progress: progress, toggle: toggle, list: list, earned: earned, clean: clean, view: view };
});
