/* Famstamp: "Where have you been?" (#/where), the 2-minute start for new families, plus "pick a photo, then pick a place"
   (#/where/photo) for past visits. Everything stays on this device like the rest of the app (Family Sync picks it up as usual).
   Quick stamps have no date (at: ""), so they never show up as "new today" in Highlights or Firsts. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_WHERE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var GOAL = 10;
  var POPULAR = {
    state: ["FL", "CA", "NY", "TX", "NV", "HI", "AZ", "CO", "IL", "GA", "NC", "TN", "WA", "MA", "PA", "VA", "SC", "MI", "OH", "DC", "UT", "OR", "NJ", "MD"],
    place: ["CAN", "MEX", "GBR", "FRA", "ITA", "ESP", "DEU", "IRL", "JPN", "BHS", "JAM", "DOM", "CRI", "GRC", "NLD", "PRT", "CHE", "AUS", "PRI", "ISL"],
    park: ["great-smoky-mountains", "grand-canyon", "zion", "rocky-mountain", "acadia", "yosemite", "yellowstone", "grand-teton", "olympic", "glacier", "joshua-tree", "cuyahoga-valley",
           "shenandoah", "hot-springs", "bryce-canyon", "arches", "mount-rainier", "indiana-dunes", "gateway-arch", "everglades"]
  };
  function bag(p, kind) { var k = kind === "state" ? "states" : kind === "place" ? "places" : "parks"; if (!p[k] || typeof p[k] !== "object") p[k] = {}; return p[k]; }
  function has(p, kind, id) { return !!(p && bag(p, kind)[id]); }
  /** Everyone chosen already has it? */
  function allHave(people, kind, id) { return people.length > 0 && people.every(function (p) { return has(p, kind, id); }); }
  /** Tap: give the stamp to each chosen person who doesn't have it (no date: a past visit). Returns the ids that got it.
      Tapping again takes back only what this tap session added (s.added), never an older stamp. */
  function tap(people, kind, id, s, now) {
    s.added = s.added || {}; now = now || new Date().toISOString();
    if (allHave(people, kind, id)) {
      var undone = [];
      people.forEach(function (p) { var key = p.id + "|" + kind + "|" + id; if (s.added[key]) { delete bag(p, kind)[id]; delete s.added[key]; p.updatedAt = now; undone.push(p.id); } });
      return { on: false, ids: undone };
    }
    var got = [];
    people.forEach(function (p) {
      if (has(p, kind, id)) return;
      bag(p, kind)[id] = kind === "park" ? { at: "", jr: false } : { at: "" };
      s.added[p.id + "|" + kind + "|" + id] = 1; p.updatedAt = now; got.push(p.id);
    });
    return { on: true, ids: got };
  }
  function added(s) { return Object.keys((s && s.added) || {}).length; }
  function total(people) { return (people || []).reduce(function (n, p) { return n + Object.keys(p.states || {}).length + Object.keys(p.places || {}).filter(function (x) { return x !== "USA"; }).length + Object.keys(p.parks || {}).length; }, 0); }
  /** Popular first (in popularity order), then the rest A-Z; a search shows every match. */
  function order(list, kind, q, norm) {
    norm = norm || function (s) { return String(s).toLowerCase(); };
    var pop = POPULAR[kind] || [], nq = norm(q || "").trim();
    var l = list.filter(function (x) { return !nq || norm(x.name).indexOf(nq) >= 0 || norm(x.id) === nq; });
    return l.slice().sort(function (a, b) { var pa = pop.indexOf(a.id), pb = pop.indexOf(b.id); if (pa < 0) pa = 999; if (pb < 0) pb = 999; return pa - pb || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
  }
  /** Photo visit: from a place lookup ({country, region, park, town}) to the stamps it gives. */
  function stampsFrom(look) {
    var out = []; if (!look) return out;
    if (look.country === "USA" && look.region) out.push({ kind: "state", id: look.region });
    if (look.country && look.country !== "USA") out.push({ kind: "place", id: look.region && look.country === "GBR" ? look.region : look.country });
    if (look.park) out.push({ kind: "park", id: look.park });
    return out;
  }
  /** Local calendar day of an EXIF time ({ms, wall?}). */
  function exifDay(t) {
    if (!t) return ""; if (t.wall && /^\d{4}-\d{2}-\d{2}$/.test(t.wall)) return t.wall;
    if (!isFinite(t.ms)) return ""; var d = new Date(t.ms); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  var core = { GOAL: GOAL, POPULAR: POPULAR, tap: tap, added: added, total: total, allHave: allHave, order: order, stampsFrom: stampsFrom, exifDay: exifDay };
  if (typeof document === "undefined") return core;

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function esc(s) { return M().esc(s); }
  var S = { added: {}, who: null, tab: "state", q: "" };
  function people() { var st = A().state; return st.kids; }
  function chosen() { return (S.who || []).map(A().kidById).filter(Boolean); }
  function defaultWho() { var st = A().state, me = A().myPersonId && A().myPersonId(); if (me) return [me]; var g = st.kids.filter(function (k) { return k.role !== "kid"; })[0] || st.kids[0]; return g ? [g.id] : []; }
  function lists() {
    var maps = window.MLTL_MAPS;
    return { state: maps.us.shapes.map(function (s) { return { id: s.id, name: s.name }; }),
             place: maps.world.countries.filter(function (c) { return c.id !== "USA"; }).map(function (c) { return { id: c.id, name: c.name }; }),
             park: M().PARKS.map(function (p) { return { id: p.id, name: p.name }; }) };
  }
  var TABS = [["state", "🇺🇸 States"], ["place", "🌍 Countries"], ["park", "🏞️ Parks"], ["photo", "📷 From a photo"]];
  function counter() {
    var n = added(S), left = GOAL - n;
    return '<div class="wcount" id="wcount" role="status"><b>' + n + '</b> new stamp' + (n === 1 ? "" : "s") + ' <span class="small">' + (left > 0 ? "· " + left + " more to reach " + GOAL : "· nice! 🎉 Keep going or tap Done") + '</span>' +
      '<span class="wbar"><i style="width:' + Math.min(100, n * 100 / GOAL) + '%"></i></span></div>';
  }
  function whoRow() {
    return '<div class="wwho" role="group" aria-label="Who went?"><span class="small muted">Stamps for:</span> ' + people().map(function (k) {
      var on = S.who.indexOf(k.id) >= 0;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-wwho="' + esc(k.id) + '" aria-pressed="' + on + '" style="' + A().kidStyle(k) + '">' + esc(M().who(k)) + '</button>';
    }).join("") + '</div>';
  }
  function grid() {
    var L = lists()[S.tab], FF = window.FS_FIND, ch = chosen(), l = order(L, S.tab, S.q, FF && FF.norm);
    if (!S.q) { var pop = POPULAR[S.tab]; l = l.slice(0, S.all ? l.length : Math.max(pop.length, 24)); }
    return '<div class="wgrid">' + l.map(function (x) {
      var on = allHave(ch, S.tab, x.id), some = !on && ch.some(function (p) { return has(p, S.tab, x.id); });
      return '<button type="button" class="wtile' + (on ? " on" : some ? " some" : "") + '" data-wt="' + esc(x.id) + '" aria-pressed="' + on + '">' + (on ? "✓ " : "") + esc(x.name) + '</button>';
    }).join("") + (l.length ? "" : '<p class="muted small">No match. Try another spelling.</p>') + '</div>' +
      (!S.q && !S.all && L.length > l.length ? '<button type="button" class="btn btn-ghost" id="wall">Show all ' + L.length + '</button>' : "");
  }
  function view(sub) {
    if (!people().length) { location.hash = "#/add"; return; }
    if (!S.who || !S.who.filter(A().kidById).length) S.who = defaultWho();
    if (sub === "done") return viewDone();
    if (sub === "photo") S.tab = "photo";
    document.title = "Where have you been? · Famstamp";
    var main = A().main;
    main.innerHTML = '<a class="back" href="#/">← Home</a><h1>Where have you been?</h1><p class="lede small">Tap every place you\'ve already been. About 2 minutes gets most families past ' + GOAL + ' stamps.</p>' +
      whoRow() + counter() +
      '<div class="seg wtabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" data-wtab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>'; }).join("") + '</div>' +
      (S.tab === "photo" ? photoHTML() : '<input type="search" id="wq" class="wq" placeholder="Search ' + (S.tab === "state" ? "states" : S.tab === "place" ? "countries" : "national parks") + '" value="' + esc(S.q) + '" autocomplete="off"><div id="wgridbox">' + grid() + '</div>') +
      '<div class="actions wdone"><a class="btn btn-primary btn-big" href="#/where/done">Done</a></div>';
    bind(main);
  }
  var saveT = null, dirty = {};
  function saveSoon(ids) { ids.forEach(function (id) { dirty[id] = 1; }); clearTimeout(saveT); saveT = setTimeout(flush, 400); }
  function flush() { var ids = Object.keys(dirty); dirty = {}; return Promise.all(ids.map(A().kidById).filter(Boolean).map(function (k) { return A().saveKid(k); })); }
  function bind(main) {
    main.querySelectorAll("[data-wwho]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.wwho, i = S.who.indexOf(id); if (i >= 0) { if (S.who.length > 1) S.who.splice(i, 1); } else S.who.push(id); view(S.tab === "photo" ? "photo" : "");
    }; });
    main.querySelectorAll("[data-wtab]").forEach(function (b) { b.onclick = function () { S.tab = b.dataset.wtab; S.q = ""; S.all = false; view(S.tab === "photo" ? "photo" : ""); }; });
    var q = main.querySelector("#wq"); if (q) q.oninput = function () { S.q = q.value; main.querySelector("#wgridbox").innerHTML = grid(); bindGrid(main); };
    bindGrid(main);
    if (S.tab === "photo") bindPhoto(main);
  }
  function bindGrid(main) {
    main.querySelectorAll("[data-wt]").forEach(function (b) { b.onclick = function () {
      var r = tap(chosen(), S.tab, b.dataset.wt, S);
      if (!r.on && !r.ids.length) { A().toast("Already on the map. To remove an older stamp, open that person's map."); return; }
      saveSoon(r.ids);
      var on = allHave(chosen(), S.tab, b.dataset.wt); b.className = "wtile" + (on ? " on" : ""); b.setAttribute("aria-pressed", on); b.textContent = (on ? "✓ " : "") + b.textContent.replace(/^✓ /, "");
      var c = main.querySelector("#wcount"); if (c) c.outerHTML = counter();
      if (r.on && added(S) === GOAL && window.MLTL_SYNC && window.MLTL_SYNC._confetti) try { window.MLTL_SYNC._confetti(); } catch (e) {}
    }; });
    var all = main.querySelector("#wall"); if (all) all.onclick = function () { S.all = true; main.querySelector("#wgridbox").innerHTML = grid(); bindGrid(main); };
  }
  function viewDone() {
    flush(); A().setMeta("whereDone", new Date().toISOString());
    var n = added(S), per = {};
    Object.keys(S.added).forEach(function (k) { var id = k.split("|")[0]; per[id] = (per[id] || 0) + 1; });
    var who = Object.keys(per).map(A().kidById).filter(Boolean);
    A().main.innerHTML = '<div class="wfinish"><div class="wbig" aria-hidden="true">' + (n >= GOAL ? "🎉" : n ? "🗺️" : "👋") + '</div><h1>' + (n >= GOAL ? "Look at that map!" : n ? "Nice start!" : "Come back any time") + '</h1>' +
      '<p class="lede">' + (n ? "You added <b>" + n + "</b> stamp" + (n === 1 ? "" : "s") + (who.length ? ": " + esc(who.map(function (k) { return M().who(k) + " " + per[k.id]; }).join(", ")) : "") + "." : "Tap places you've been whenever you remember one.") + '</p>' +
      '<p class="small muted">Got dates or photos? Add a past visit from a photo, or open a stamp on the map to set its date.</p>' +
      '<div class="actions">' + (who[0] ? '<a class="btn btn-primary" href="#/p/' + esc(who[0].id) + '">See ' + esc(M().who(who[0])) + '\'s map</a>' : "") +
      '<a class="btn btn-beacon" href="#/where/photo">📷 Add a visit from a photo</a><a class="btn" href="#/where">Add more places</a><a class="btn btn-ghost" href="#/">Home</a></div></div>';
    if (n >= GOAL && window.MLTL_SYNC && window.MLTL_SYNC._confetti) try { window.MLTL_SYNC._confetti(); } catch (e) {}
  }

  // ---------- pick a photo, then pick a place ----------
  var P = null;   // { dataUrl, look, date, stamps:[{kind,id}], place }
  function opt(list, sel, none) { return '<option value="">' + esc(none) + '</option>' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === sel ? " selected" : "") + '>' + esc(x.name) + '</option>'; }).join(""); }
  function photoHTML() {
    if (!P) return '<div class="panel"><p class="small">Pick a photo from a past trip. If it has a location and date, we fill them in; if not, you pick them.</p>' +
      '<label class="btn btn-beacon btn-big wpick">📷 Pick a photo<input type="file" id="wphoto" accept="image/*" hidden></label><p class="small muted" id="wpmsg" role="status"></p></div>';
    var L = lists(), pick = function (kind) { var s = P.stamps.filter(function (x) { return x.kind === kind; })[0]; return s ? s.id : ""; };
    return '<div class="panel wphoto"><img alt="" src="' + esc(P.dataUrl) + '" class="wprev"><p class="small ' + (P.look ? "" : "muted") + '">' + esc(P.note) + '</p>' +
      '<div class="field"><label for="wpplace">Place</label><input id="wpplace" value="' + esc(P.place) + '" placeholder="e.g. Grandma\'s lake house, Rome"></div>' +
      '<div class="field"><label for="wpdate">Date</label><input id="wpdate" type="date" value="' + esc(P.date) + '" max="' + M().today() + '"></div>' +
      '<div class="field"><label for="wpstate">US state</label><select id="wpstate">' + opt(L.state, pick("state"), "Not in the US / none") + '</select></div>' +
      '<div class="field"><label for="wpcountry">Country</label><select id="wpcountry">' + opt(L.place, pick("place"), P.stamps.some(function (x) { return x.kind === "state"; }) ? "United States" : "Pick a country") + '</select></div>' +
      '<div class="field"><label for="wppark">National park</label><select id="wppark">' + opt(L.park, pick("park"), "None") + '</select></div>' +
      '<p class="err" id="wperr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="wpsave">Add this visit</button><button type="button" class="btn btn-ghost" id="wpcancel">Pick another photo</button></div></div>';
  }
  function readExif(file) {
    var I = window.FS_IMPORT; if (!I || !I.exif) return Promise.resolve(null);
    return file.slice(0, 131072).arrayBuffer().then(function (b) { try { return I.exif(b); } catch (e) { return null; } }).catch(function () { return null; });
  }
  function lookUp(loc) {
    var X = window.MLTL_IMPORT; if (!loc || !X || !X.geo) return Promise.resolve(null);
    return X.geo().then(function (g) { return g.lookup(loc.lat, loc.lon); }).catch(function () { return null; });
  }
  function bindPhoto(main) {
    var f = main.querySelector("#wphoto");
    if (f) f.onchange = function () {
      var file = f.files && f.files[0]; if (!file) return;
      main.querySelector("#wpmsg").textContent = "Reading the photo…";
      Promise.all([readExif(file), A().shrinkPhoto(file)]).then(function (r) {
        var ex = r[0] || {}, loc = ex.loc && isFinite(ex.loc.lat) ? ex.loc : (ex.loc && ex.loc.length === 2 ? { lat: ex.loc[0], lon: ex.loc[1] } : null);
        return lookUp(loc).then(function (look) {
          var date = exifDay(ex.time), st = stampsFrom(look), nm = look ? (look.town || "") : "";
          var L = lists(), name = function (kind, id) { var x = L[kind].filter(function (y) { return y.id === id; })[0]; return x ? x.name : ""; };
          var park = look && look.park ? name("park", look.park) : "";
          P = { dataUrl: r[1], look: look, date: date, stamps: st, place: park || nm || (look && look.region ? name("state", look.region) : look && look.country ? name("place", look.country) : ""),
                note: look ? "Found in the photo: " + [park, nm, look.country === "USA" ? name("state", look.region) : name("place", look.country)].filter(Boolean).join(", ") + (date ? " · " + M().prettyDate(date) : "") + ". Change anything that's off."
                           : (ex.redacted ? "This photo's location was removed when it was shared (Android does that). " : "No location in this photo. ") + (date ? "Taken " + M().prettyDate(date) + ". " : "") + "Pick the place below." };
          view("photo");
        });
      }).catch(function () { var m = main.querySelector("#wpmsg"); if (m) m.textContent = "Couldn't read that photo. Try another one."; });
    };
    var c = main.querySelector("#wpcancel"); if (c) c.onclick = function () { P = null; view("photo"); };
    var s = main.querySelector("#wpsave"); if (s) s.onclick = function () {
      var $ = function (id) { return main.querySelector(id); }, err = $("#wperr");
      var stv = $("#wpstate").value, cv = $("#wpcountry").value, pk = $("#wppark").value, date = $("#wpdate").value, place = $("#wpplace").value.trim();
      var L = lists(), nm = function (kind, id) { var x = L[kind].filter(function (y) { return y.id === id; })[0]; return x ? x.name : ""; };
      place = place || nm("park", pk) || nm("state", stv) || nm("place", cv);
      if (!place) { err.textContent = "Where was it? Type a place or pick a state, country or park."; err.hidden = false; return; }
      var ids = S.who.slice(), photoId = M().uid("photo"), trip;
      try { trip = M().newTrip({ kidIds: ids, place: place, date: date, photoId: photoId, mark: pk ? { kind: "park", id: pk } : stv ? { kind: "state", id: stv } : cv ? { kind: "place", id: cv } : null }); }
      catch (x) { err.textContent = x.message; err.hidden = false; return; }
      trip.done = true; s.disabled = true;
      var at = date || "", jobs = [A().put("photos", { id: photoId, dataUrl: P.dataUrl }), A().put("trips", trip)];
      chosen().forEach(function (p) {
        [["state", stv], ["place", cv], ["park", pk]].forEach(function (x) {
          if (!x[1]) return; var b = bag(p, x[0]), key = p.id + "|" + x[0] + "|" + x[1];
          if (!b[x[1]]) { b[x[1]] = x[0] === "park" ? { at: at, jr: false } : { at: at }; S.added[key] = 1; }
          else if (!b[x[1]].at && at) b[x[1]].at = at;   // a quick stamp gets its date from the photo
        });
        p.updatedAt = new Date().toISOString(); jobs.push(A().saveKid(p));
      });
      A().state.trips = A().state.trips.filter(function (x) { return x.id !== trip.id; }).concat([trip]);
      Promise.all(jobs).then(function () { A().clearPhotos(); P = null; A().toast("Visit added: " + place); view("photo"); })
        .catch(function () { s.disabled = false; err.textContent = "Couldn't save that. Is the phone's storage full?"; err.hidden = false; });
    };
  }
  /** Home: the big start card for a new family (under 10 stamps, not finished yet), a small link for everyone else. */
  function homeCard() {
    var st = A().state; if (!st.kids.length) return "";
    if (total(st.kids) < GOAL && !st.meta.whereDone) return '<a class="panel familycard wstart" href="#/where"><span class="fam-ic" aria-hidden="true">🗺️</span><span><h3>Where have you been?</h3><span class="small">Tap the states, countries and parks you\'ve already visited. 2 minutes, ' + GOAL + '+ stamps →</span></span></a>';
    return '<p class="small nearlink"><a class="tapline" href="#/where">🗺️ Quick add: places you\'ve been</a> · <a class="tapline" href="#/where/photo">📷 a visit from a photo</a></p>';
  }
  core.view = view; core.homeCard = homeCard; core._state = function () { return S; };
  return core;
});
