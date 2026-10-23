/* My Lifetime Travel Log: the app. Plain JavaScript, no libraries, no network calls.
   Data lives in this browser's IndexedDB ("mltl"); photos are shrunk and re-saved as JPEG, which also drops GPS/EXIF data. */
(function () {
  "use strict";
  var M = window.MLTL, MAPS = window.MLTL_MAPS, esc = M.esc;
  // Swap in the Amazon link once the paperback is live. Until then the link shows a "coming soon" note.
  var BOOK_URL = null;

  // ---------- storage ----------
  var DB_NAME = "mltl", DB_VER = 1, dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        ["kids", "trips", "photos"].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" }); });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), out;
        var s = Array.isArray(store) ? store.map(function (n) { return t.objectStore(n); }) : t.objectStore(store);
        out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
      });
    });
  }
  function all(store) { return tx(store, "readonly", function (s) { return s.getAll(); }); }
  function put(store, v) { return tx(store, "readwrite", function (s) { s.put(v); }); }
  function del(store, id) { return tx(store, "readwrite", function (s) { s.delete(id); }); }
  function getOne(store, id) { return tx(store, "readonly", function (s) { return s.get(id); }); }

  var state = { kids: [], trips: [], meta: {} };
  function load() {
    return Promise.all([all("kids"), all("trips"), all("meta")]).then(function (r) {
      state.kids = r[0].map(function (p) { p.role = M.validRole(p.role); return p; }).sort(byRole);
      state.trips = r[1].map(function (t) { return M.migrateTrip(t); }).filter(function (t) { return t.kidIds.length; });
      state.meta = {}; r[2].forEach(function (m) { state.meta[m.key] = m.value; });
    });
  }
  var ROLE_ORDER = { kid: 0, adult: 1, grand: 2 };
  function byRole(a, b) { return (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || (a.createdAt < b.createdAt ? -1 : 1); }
  function roleLabel(p) { return M.ROLES.filter(function (r) { return r.id === M.validRole(p.role); })[0].label; }
  function saveKid(k) { return put("kids", k); }
  function setMeta(key, value) { state.meta[key] = value; return put("meta", { key: key, value: value }); }
  function kidById(id) { return state.kids.filter(function (k) { return k.id === id; })[0]; }

  // ---------- helpers ----------
  var main = document.getElementById("main"), toastEl = document.getElementById("toast"), toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200); }
  function initial(name) { return esc((name || "?").trim().charAt(0).toUpperCase()); }
  function kidStyle(k) { return "--kid:" + esc(k.color); }
  var COUNTRY = {}; MAPS.world.countries.forEach(function (c) { COUNTRY[c.id] = c; });
  var SHAPE = {}; MAPS.world.shapes.forEach(function (s) { SHAPE[s.id] = s; });
  var STATE_NAME = {}; MAPS.us.shapes.forEach(function (s) { STATE_NAME[s.id] = s.name; });
  function placeName(kind, id) {
    if (kind === "state") return STATE_NAME[id] || id;
    if (kind === "park") { var p = M.PARKS.filter(function (x) { return x.id === id; })[0]; return p ? p.name + " National Park" : id; }
    return (SHAPE[id] && SHAPE[id].name) || (COUNTRY[id] && COUNTRY[id].name) || id;
  }
  function summaryLine(k) {
    var s = M.stats(k, state.trips, MAPS.world);
    return s.states + " states · " + s.countries + (s.countries === 1 ? " country" : " countries") + " · " + s.parks + (s.parks === 1 ? " park" : " parks");
  }

  function avatars(ids) {
    return ids.map(kidById).filter(Boolean).map(function (x) { return '<span class="dotp" title="' + esc(x.name) + '" style="' + kidStyle(x) + '">' + initial(x.name) + '</span>'; }).join("");
  }
  function travelerNames(ids) { return M.joinNames(names(ids)); }

  // ---------- backup reminder ----------
  function backupBanner() {
    if (!M.backupDue({ lastBackupAt: state.meta.lastBackupAt, dismissedAt: state.meta.backupDismissedAt, trips: state.trips, people: state.kids })) return "";
    var last = state.meta.lastBackupAt;
    return '<div class="nudge backupnag" role="region" aria-label="Backup reminder"><button type="button" class="x" data-backup-dismiss aria-label="Not now">×</button>' +
      '<b>Save a backup so your log is safe if this phone is lost or reset.</b> ' +
      '<span class="small">' + (last ? "Your last backup was " + esc(M.prettyDate(last.slice(0, 10))) + ", and you've added to the log since." : "You haven't saved one yet.") + '</span>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-backup-now>Back up now</button><button type="button" class="btn btn-ghost" data-backup-dismiss>Not now</button></div></div>';
  }
  function doBackup() {
    return all("photos").then(function (photos) {
      var data = M.makeBackup(state.kids, state.trips, photos, null, { home: state.meta.home || "" }), blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "my-lifetime-travel-log-backup-" + M.today() + ".json";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return setMeta("lastBackupAt", data.exportedAt);
    });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-backup-now],[data-backup-dismiss]");
    if (!t) return;
    var banner = document.querySelector(".backupnag");
    if (t.hasAttribute("data-backup-now")) doBackup().then(function () { if (banner) banner.remove(); toast("Backup saved. Keep the file somewhere safe."); }).catch(function () { toast("Couldn't make the backup. Try Back up at the top."); });
    else setMeta("backupDismissedAt", new Date().toISOString()).then(function () { if (banner) banner.remove(); toast("OK, we'll remind you in a week"); });
  });

  // ---------- router ----------
  function route() {
    var h = location.hash.replace(/^#\/?/, "").split("/");
    document.body.classList.remove("kidview");
    if (h[0] === "family") return viewFamily();
    if (h[0] === "together") return viewTogether(h[1]);
    if ((h[0] === "p" || h[0] === "kid") && kidById(h[1])) {
      document.body.classList.add("kidview");
      var k = kidById(h[1]), tab = h[2] || "us";
      if (tab === "trips" && h[3] === "new") return viewTripForm(k, null);
      if (tab === "trips" && h[3] === "edit") return viewTripForm(k, h[4]);
      if (tab === "print") return viewPrint(k);
      if (tab === "edit") return viewKidForm(k);
      return viewKid(k, tab);
    }
    if (h[0] === "add") return viewKidForm(null);
    if (h[0] === "backup") return viewBackup();
    return viewHome();
  }
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });

  // ---------- home ----------
  function viewHome() {
    var html = '<h1>Color in every place your family goes, from the first road trip on.</h1>' +
      '<p class="lede">A travel map for each kid, and for the grown-ups too: states, countries and national parks, plus the little stories from every trip. It all stays right here on this device.</p>';
    html = backupBanner() + html;
    html += '<h2>Who\'s traveling?</h2><div class="kids">';
    state.kids.forEach(function (k) {
      html += '<a class="kidcard" href="#/p/' + esc(k.id) + '" style="' + kidStyle(k) + '"><span class="avatar">' + initial(k.name) + '</span>' +
              '<span><h3>' + esc(k.name) + ' <span class="role">' + esc(roleLabel(k)) + '</span></h3><span class="muted">' + esc(summaryLine(k)) + '</span></span></a>';
    });
    html += '<a class="kidcard add" href="#/add">+ Add someone</a></div>';
    if (!state.kids.length) html += '<p class="hint">Start with the kids, then add Mom, Dad, Grandma or anyone else who travels with you. Nicknames work great.</p>';
    if (state.kids.length > 1) {
      var fs = M.familyStats(state.kids, state.trips, MAPS.world);
      html += '<a class="panel familycard" href="#/family"><span class="fam-ic" aria-hidden="true">🗺️</span><span><h3>Family map</h3><span class="muted small">' +
        esc(fs.states + " states · " + fs.countries + (fs.countries === 1 ? " country" : " countries") + " · " + fs.parks + (fs.parks === 1 ? " park" : " parks") + " between all of you") +
        '</span><br><span class="small">See every place anyone has been, and the places you\'ve been together →</span></span></a>';
      var top = M.pairCounts(state.kids, state.trips)[0];
      html += '<a class="panel familycard" href="#/together/top"><span class="fam-ic" aria-hidden="true">🤝</span><span><h3>Trips together</h3><span class="muted small">' +
        esc(top ? travelerNames(top.ids) + ": " + top.count + (top.count === 1 ? " trip" : " trips") + " together" : "Check who went on each trip to see who travels together") +
        '</span><br><span class="small">Pick two or more people to see the trips you shared →</span></span></a>';
    }
    html += '<div class="panel book"><span class="cover" aria-hidden="true">My Lifetime Travel Log</span><div>' +
            '<h3>Like paper too?</h3><p class="small muted">The matching paperback has the same maps to color, all 64 parks and 40 trip pages, for the shelf. ' +
            '<a href="' + (BOOK_URL ? esc(BOOK_URL) : "#book") + '" data-book' + (BOOK_URL ? ' target="_blank" rel="noopener"' : "") + '>See the book</a></p></div></div>';
    main.innerHTML = html;
    document.title = "My Lifetime Travel Log: color in every place your family goes";
  }

  // ---------- add / edit a person ----------
  var PLACEHOLDER = { kid: "e.g. Bug, Ellie, Captain", adult: "e.g. Mom, Dad, Jess", grand: "e.g. Grandma, Pop, Aunt Jo" };
  function viewKidForm(k) {
    var editing = !!k, color = k ? k.color : M.COLORS[state.kids.length % M.COLORS.length], role = k ? M.validRole(k.role) : (state.kids.length ? "" : "kid");
    if (!editing && !role) role = state.kids.some(function (x) { return x.role === "kid"; }) && !state.kids.some(function (x) { return x.role !== "kid"; }) ? "adult" : "kid";
    var html = '<a class="back" href="' + (k ? "#/p/" + esc(k.id) + "/stats" : "#/") + '">← Back</a>' +
      '<h1>' + (editing ? "Edit " + esc(k.name) : "Add someone") + '</h1><div class="panel">' +
      '<div class="field" style="margin-top:0"><label>Who is this?</label><div class="seg" role="group" aria-label="Who is this?">' + M.ROLES.map(function (r) {
        return '<button type="button" data-role="' + r.id + '" aria-pressed="' + (r.id === role) + '">' + esc(r.label) + '</button>'; }).join("") + '</div></div>' +
      '<div class="field"><label for="kname">Name or nickname</label><input id="kname" type="text" maxlength="40" autocomplete="off" value="' + (k ? esc(k.name) : "") + '" placeholder="' + PLACEHOLDER[role] + '" /></div>' +
      '<div class="field"><label for="kyear">Year they were born (optional, shows a kid\'s age on each trip)</label><input id="kyear" type="number" inputmode="numeric" min="1900" max="' + new Date().getFullYear() + '" value="' + (k && k.birthYear ? k.birthYear : "") + '" /></div>' +
      '<div class="field"><label>Map color</label><div class="swatches" role="group" aria-label="Map color">' +
      M.COLORS.map(function (c) { return '<button type="button" class="swatch" data-color="' + c + '" aria-pressed="' + (c === color) + '" aria-label="Color ' + c + '" style="background:' + c + '"></button>'; }).join("") +
      '</div></div><p class="err" id="kerr" hidden></p><div class="actions"><button class="btn btn-primary" id="ksave">' + (editing ? "Save" : "Add") + '</button>' +
      (editing ? '<button class="btn btn-danger" id="kdel">Remove ' + esc(k.name) + '</button>' : "") + '</div></div>';
    main.innerHTML = html;
    main.querySelectorAll("[data-role]").forEach(function (b) {
      b.onclick = function () { role = b.dataset.role; document.getElementById("kname").placeholder = PLACEHOLDER[role]; main.querySelectorAll("[data-role]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
    });
    main.querySelectorAll(".swatch").forEach(function (b) {
      b.onclick = function () { color = b.dataset.color; main.querySelectorAll(".swatch").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
    });
    document.getElementById("ksave").onclick = function () {
      var name = document.getElementById("kname").value, year = document.getElementById("kyear").value, err = document.getElementById("kerr");
      try {
        var kid = editing ? k : M.newPerson({ name: name, role: role, birthYear: year, color: color });
        if (editing) { var tmp = M.newPerson({ name: name, role: role, birthYear: year, color: color }); k.name = tmp.name; k.role = tmp.role; k.birthYear = tmp.birthYear; k.color = tmp.color; k.updatedAt = new Date().toISOString(); }
        saveKid(kid).then(function () { if (!editing) state.kids.push(kid); state.kids.sort(byRole); location.hash = "#/p/" + kid.id + (editing ? "/stats" : "/us"); toast(editing ? "Saved" : "Welcome aboard, " + kid.name + "!"); });
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    };
    if (editing) document.getElementById("kdel").onclick = function () {
      if (!confirm("Remove " + k.name + " and their map from this device? Trips shared with others stay. This can't be undone unless you have a backup.")) return;
      var jobs = [del("kids", k.id)];
      state.trips.slice().forEach(function (t) {
        if (t.kidIds.indexOf(k.id) < 0) return;
        t.kidIds = t.kidIds.filter(function (x) { return x !== k.id; });
        if (t.kidIds.length) jobs.push(put("trips", t));
        else { jobs.push(del("trips", t.id)); if (t.photoId) jobs.push(del("photos", t.photoId)); state.trips = state.trips.filter(function (x) { return x !== t; }); }
      });
      state.kids = state.kids.filter(function (x) { return x !== k; });
      Promise.all(jobs).then(function () { location.hash = "#/"; toast("Removed"); });
    };
    if (!editing) setTimeout(function () { document.getElementById("kname").focus(); }, 50);
  }

  // ---------- kid view ----------
  var TABS = [["us", "USA", "🇺🇸"], ["world", "World", "🌍"], ["parks", "Parks", "🏞️"], ["trips", "Trips", "📖"], ["stats", "Badges", "⭐"]];
  var worldZoom = "world";
  function shell(k, tab, inner) {
    return (tab === "trips" ? backupBanner() : "") + '<div style="' + kidStyle(k) + '"><a class="back" href="#/">← Everyone</a><div class="kidhead"><span class="avatar">' + initial(k.name) + '</span><h1>' + esc(k.name) + ' <span class="role">' + esc(roleLabel(k)) + '</span></h1></div>' +
      '<nav class="tabs" aria-label="Sections" style="' + kidStyle(k) + '"><div class="wrap">' + TABS.map(function (t) {
        return '<a href="#/p/' + esc(k.id) + '/' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + t[2] + '</span>' + t[1] + '</a>';
      }).join("") + '</div></nav>' + inner + '</div>';
  }
  function viewKid(k, tab) {
    document.title = k.name + " · My Lifetime Travel Log";
    if (tab === "world") return viewWorld(k);
    if (tab === "parks") return viewParks(k);
    if (tab === "trips") return viewTrips(k);
    if (tab === "stats") return viewStats(k);
    return viewUS(k);
  }
  function counter(n, total, label, extra) {
    return '<div class="count"><div class="big">' + n + ' <small>of ' + total + ' ' + label + '</small></div>' + (extra || "") + '</div><div class="bar"><i style="width:' + Math.round(100 * n / total) + '%"></i></div>';
  }
  function usSVG(k, opts) {
    var u = MAPS.us, s = '<svg viewBox="0 0 ' + u.w + ' ' + u.h + '" role="img" aria-label="US map with ' + esc(k.name) + '\'s states colored in">';
    u.insets.forEach(function (b) { s += '<rect class="inset" x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="' + (b[2] + 8) + '" height="' + (b[3] + 8) + '" rx="8"/>'; });
    u.shapes.forEach(function (p) { s += '<path class="a' + (k.states[p.id] ? " on" : "") + '" data-kind="state" data-id="' + p.id + '" d="' + p.d + '"><title>' + esc(p.name) + '</title></path>'; });
    return s + '</svg>';
  }
  var ZOOMS = { world: null, europe: [452, 32, 130, 80], uk: [467, 44, 38, 33], na: [60, 15, 330, 190] };
  function worldSVG(k, zoom) {
    var w = MAPS.world, vb = ZOOMS[zoom] || [0, 0, w.w, w.h];
    var s = '<svg viewBox="' + vb.join(" ") + '" role="img" aria-label="World map with ' + esc(k.name) + '\'s places colored in"><path class="ocean" d="' + w.outline + '"/><path class="grat" d="' + w.grat + '"/>';
    var r = Math.max(vb[2] / 260, 0.25);
    w.shapes.forEach(function (p) {
      var on = !!k.places[p.id] || (p.id === "USA" && Object.keys(k.states).length > 0);
      s += '<path class="a' + (p.other ? " o" : "") + (p.uk ? " uk" : "") + (on ? " on" : "") + '" data-kind="place" data-id="' + p.id + '" d="' + p.d + '"><title>' + esc(p.name) + '</title></path>';
    });
    w.shapes.forEach(function (p) { if (p.dot && !p.other) s += '<circle class="dot' + (k.places[p.id] ? " on" : "") + '" data-kind="place" data-id="' + p.id + '" cx="' + p.c[0] + '" cy="' + p.c[1] + '" r="' + (r * 1.15).toFixed(2) + '"><title>' + esc(p.name) + '</title></circle>'; });
    return s + '</svg>';
  }
  function bindMap(k, rerender) {
    main.querySelectorAll("[data-kind]").forEach(function (el) {
      if (el.tagName === "INPUT") return;
      el.addEventListener("click", function () {
        var kind = el.dataset.kind, id = el.dataset.id;
        if (kind === "place" && id === "USA" && Object.keys(k.states).length) { toast("Color states on the USA map"); return; }
        var on = M.toggleArea(k, kind, id, null);
        saveKid(k); toast(on ? placeName(kind, id) + ": colored in!" : placeName(kind, id) + ": color removed"); rerender();
      });
    });
    main.querySelectorAll("input[data-kind]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        M.toggleArea(k, cb.dataset.kind, cb.dataset.id, cb.checked); saveKid(k);
        toast(placeName(cb.dataset.kind, cb.dataset.id) + (cb.checked ? ": colored in!" : ": color removed")); rerender(true);
      });
    });
  }
  function keepOpen(fn) {
    var d = main.querySelector("details.list"), open = d && d.open, y = window.scrollY, q = main.querySelector("#find"), qv = q ? q.value : "";
    fn();
    var d2 = main.querySelector("details.list"); if (d2 && open) d2.open = true;
    var q2 = main.querySelector("#find"); if (q2 && qv) { q2.value = qv; q2.dispatchEvent(new Event("input")); }
    window.scrollTo(0, y);
  }
  function viewUS(k) {
    var s = M.stats(k, state.trips, MAPS.world);
    var list = MAPS.us.shapes.map(function (p) {
      return '<label class="check"><input type="checkbox" data-kind="state" data-id="' + p.id + '"' + (k.states[p.id] ? " checked" : "") + '> ' + esc(p.name) + (p.id === "DC" ? '<span class="meta">bonus</span>' : "") + '</label>';
    }).join("");
    main.innerHTML = shell(k, "us", counter(s.states, 50, "states") +
      '<div class="mapbox us">' + usSVG(k) + '</div><p class="hint">Tap a state to color it in. Tap again to undo. Tiny states are easier in the list.</p>' +
      '<details class="list"><summary>Pick from a list</summary><div class="checks">' + list + '</div></details>');
    bindMap(k, function () { keepOpen(function () { viewUS(k); }); });
  }
  function viewWorld(k) {
    var s = M.stats(k, state.trips, MAPS.world);
    var byCont = {};
    MAPS.world.countries.forEach(function (c) { (byCont[c.cont] = byCont[c.cont] || []).push(c); });
    var list = Object.keys(byCont).map(function (cont) {
      return '<h3>' + esc(cont) + '</h3>' + byCont[cont].map(function (c) {
        if (c.id === "GBR") {
          return '<div class="check" data-name="united kingdom england scotland wales northern ireland"><b>United Kingdom</b><span class="meta">' + s.ukNations + ' of 4</span></div>' +
            MAPS.world.uk.map(function (u) { return '<label class="check sub" data-name="' + esc(u.name.toLowerCase()) + ' united kingdom"><input type="checkbox" data-kind="place" data-id="' + u.id + '"' + (k.places[u.id] ? " checked" : "") + '> ' + esc(u.name) + '</label>'; }).join("");
        }
        var on = c.id === "USA" ? Object.keys(k.states).length > 0 || !!k.places.USA : !!k.places[c.id];
        return '<label class="check" data-name="' + esc(c.name.toLowerCase()) + '"><input type="checkbox" data-kind="place" data-id="' + c.id + '"' + (on ? " checked" : "") + (c.id === "USA" && Object.keys(k.states).length ? " disabled" : "") + '> ' + esc(c.name) + '</label>';
      }).join("");
    }).join("");
    var others = MAPS.world.shapes.filter(function (p) { return p.other; });
    list += '<h3>Other places</h3><p class="small muted">Territories and places that aren\'t on the list of 195, like Puerto Rico or Greenland. They\'re on your map but don\'t add to the country count.</p>' +
      others.map(function (p) { return '<label class="check" data-name="' + esc(p.name.toLowerCase()) + '"><input type="checkbox" data-kind="place" data-id="' + p.id + '"' + (k.places[p.id] ? " checked" : "") + '> ' + esc(p.name) + '</label>'; }).join("");
    var extra = '<div class="muted small">UK nations: ' + s.ukNations + ' of 4</div>';
    main.innerHTML = shell(k, "world", counter(s.countries, 195, "countries", extra) +
      '<div class="seg" role="group" aria-label="Zoom">' + [["world", "Whole world"], ["na", "North America"], ["europe", "Europe"], ["uk", "UK & Ireland"]].map(function (z) {
        return '<button type="button" data-zoom="' + z[0] + '" aria-pressed="' + (worldZoom === z[0]) + '">' + z[1] + '</button>'; }).join("") + '</div>' +
      '<div class="mapbox">' + worldSVG(k, worldZoom) + '</div><p class="hint">Tap a country to color it in. England, Scotland, Wales and Northern Ireland each get their own color. Tiny countries have a dot.</p>' +
      '<details class="list"><summary>Pick from a list</summary><div class="checks"><div class="field"><label for="find">Find a place</label><input id="find" type="search" placeholder="Type a country" autocomplete="off"></div>' + list + '</div></details>');
    main.querySelectorAll("[data-zoom]").forEach(function (b) { b.onclick = function () { worldZoom = b.dataset.zoom; keepOpen(function () { viewWorld(k); }); }; });
    var find = main.querySelector("#find");
    find.addEventListener("input", function () {
      var q = find.value.trim().toLowerCase();
      main.querySelectorAll(".checks .check").forEach(function (el) { el.hidden = q && (el.dataset.name || "").indexOf(q) < 0; });
      main.querySelectorAll(".checks h3").forEach(function (h) { h.hidden = !!q; });
    });
    bindMap(k, function () { keepOpen(function () { viewWorld(k); }); });
  }
  function viewParks(k) {
    var s = M.stats(k, state.trips, MAPS.world), kidMode = M.isKid(k);
    var rows = M.PARKS.map(function (p) {
      var v = k.parks[p.id];
      return '<div class="row" data-name="' + esc((p.name + " " + p.states).toLowerCase()) + '"><div class="nm"><b>' + esc(p.name) + '</b><span>' + esc(p.states) + '</span></div>' +
        '<button type="button" class="pill" data-park="' + p.id + '" aria-pressed="' + !!v + '">' + (v ? "✓ Been here" : "Been here?") + '</button>' +
        (kidMode ? '<button type="button" class="pill jr" data-jr="' + p.id + '" aria-pressed="' + !!(v && v.jr) + '" aria-label="Junior Ranger badge at ' + esc(p.name) + '">' + (v && v.jr ? "★ Ranger" : "Ranger?") + '</button>' : "") + '</div>';
    }).join("");
    main.innerHTML = shell(k, "parks", counter(s.parks, 64, "national parks", kidMode ? '<div class="muted small">Junior Ranger badges: ' + s.juniorRanger + '</div>' : "") +
      '<div class="panel parks"><div class="field" style="margin-top:0"><label for="pfind">Find a park or state</label><input id="pfind" type="search" placeholder="e.g. Zion or UT" autocomplete="off"></div>' + rows + '</div>' +
      (kidMode ? '<p class="hint">Earned a Junior Ranger badge? Tap "Ranger?" too. Ask at any park visitor center; most parks have a free booklet.</p>' : ""));
    var f = main.querySelector("#pfind");
    f.addEventListener("input", function () { var q = f.value.trim().toLowerCase(); main.querySelectorAll(".parks .row").forEach(function (r) { r.hidden = q && r.dataset.name.indexOf(q) < 0; }); });
    function again() { var q = f.value, y = window.scrollY; viewParks(k); var f2 = main.querySelector("#pfind"); f2.value = q; f2.dispatchEvent(new Event("input")); window.scrollTo(0, y); }
    main.querySelectorAll("[data-park]").forEach(function (b) { b.onclick = function () { var on = M.togglePark(k, b.dataset.park, "visit"); saveKid(k); toast(on ? placeName("park", b.dataset.park) + ": visited!" : "Removed"); again(); }; });
    main.querySelectorAll("[data-jr]").forEach(function (b) { b.onclick = function () { var on = M.togglePark(k, b.dataset.jr, "jr"); saveKid(k); if (on) toast("Junior Ranger! ★"); again(); }; });
  }

  // ---------- trips ----------
  var photoCache = {};
  function photoURL(id) {
    if (!id) return Promise.resolve(null);
    if (photoCache[id]) return Promise.resolve(photoCache[id]);
    return getOne("photos", id).then(function (p) { if (p) photoCache[id] = p.dataUrl; return p ? p.dataUrl : null; });
  }
  function kidTrips(k) {
    return state.trips.filter(function (t) { return t.kidIds.indexOf(k.id) >= 0; })
      .sort(function (a, b) { return (b.date || b.createdAt) < (a.date || a.createdAt) ? -1 : 1; });
  }
  /** k = whose list this card is on (for their age and the Edit link); leave it off on the Trips together view. */
  function tripCard(t, k) {
    var age = k && M.isKid(k) ? M.ageOn(k.birthYear, t.date) : null, route = M.routeText(t), owner = k || kidById(t.kidIds[0]);
    return '<article class="trip">' + (t.photoId ? '<img alt="" data-photo="' + esc(t.photoId) + '">' : "") + '<div class="body"><h3>' + esc(t.place) + '</h3>' +
      (route !== t.place ? '<div class="route">' + esc(route) + '</div>' : "") +
      '<div class="when">' + esc([M.prettyDate(t.date), age != null ? "age " + age : "", t.mark ? "🖍 " + placeName(t.mark.kind, t.mark.id) : ""].filter(Boolean).join(" · ")) + '</div>' +
      (t.memory ? '<p class="mem">' + esc(t.memory) + '</p>' : "") +
      '<div class="travelers"><span class="dots">' + avatars(t.kidIds) + '</span><span>' + esc(travelerNames(t.kidIds)) + '</span></div>' +
      (t.who ? '<div class="who">Also along: ' + esc(t.who) + '</div>' : "") +
      (owner ? '<a class="edit noprint" href="#/p/' + esc(owner.id) + '/trips/edit/' + esc(t.id) + '">Edit</a>' : "") + '</div></article>';
  }
  function fillPhotos() { main.querySelectorAll("img[data-photo]").forEach(function (img) { photoURL(img.dataset.photo).then(function (u) { if (u) img.src = u; }); }); }
  function viewTrips(k) {
    var list = kidTrips(k);
    main.innerHTML = shell(k, "trips", '<div class="actions"><a class="btn btn-beacon" href="#/p/' + esc(k.id) + '/trips/new">+ Add a trip</a>' +
      (state.kids.length > 1 ? '<a class="btn btn-ghost" href="#/together/' + esc(k.id) + '">🤝 Trips together</a>' : "") + '</div>' +
      (list.length ? '<div class="trips">' + list.map(function (t) { return tripCard(t, k); }).join("") + '</div>'
                   : '<div class="panel"><h3>No trips yet</h3><p class="muted">A weekend at Grandma\'s counts just as much as a plane to the other side of the world. Add the first one!</p></div>'));
    fillPhotos();
  }
  function markOptions(sel) {
    var v = sel ? sel.kind + ":" + sel.id : "";
    var o = '<option value="">No, just save the trip</option><optgroup label="US states">' +
      MAPS.us.shapes.map(function (p) { return '<option value="state:' + p.id + '"' + (v === "state:" + p.id ? " selected" : "") + '>' + esc(p.name) + '</option>'; }).join("") + '</optgroup>';
    o += '<optgroup label="UK nations">' + MAPS.world.uk.map(function (u) { return '<option value="place:' + u.id + '"' + (v === "place:" + u.id ? " selected" : "") + '>' + esc(u.name) + '</option>'; }).join("") + '</optgroup>';
    o += '<optgroup label="Countries">' + MAPS.world.countries.filter(function (c) { return c.id !== "GBR" && c.id !== "USA"; }).slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (c) { return '<option value="place:' + c.id + '"' + (v === "place:" + c.id ? " selected" : "") + '>' + esc(c.name) + '</option>'; }).join("") + '</optgroup>';
    o += '<optgroup label="National parks">' + M.PARKS.map(function (p) { return '<option value="park:' + p.id + '"' + (v === "park:" + p.id ? " selected" : "") + '>' + esc(p.name) + '</option>'; }).join("") + '</optgroup>';
    return o;
  }
  function shrinkPhoto(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var d = M.fitDims(img.naturalWidth, img.naturalHeight, 1280), c = document.createElement("canvas");
        c.width = d.w; c.height = d.h; c.getContext("2d").drawImage(img, 0, 0, d.w, d.h); URL.revokeObjectURL(url);
        var q = 0.82, out = c.toDataURL("image/jpeg", q);
        while (out.length > 360000 && q > 0.45) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }   // aim for ~250 KB or less
        res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("That photo couldn't be opened. Try a JPEG or PNG.")); };
      img.src = url;
    });
  }
  function viewTripForm(k, tripId) {
    var t = tripId ? state.trips.filter(function (x) { return x.id === tripId; })[0] : null;
    if (tripId && !t) { location.hash = "#/p/" + k.id + "/trips"; return; }
    var newPhoto = null, removePhoto = false;
    var picks = state.kids.map(function (x) {
      var on = t ? t.kidIds.indexOf(x.id) >= 0 : x.id === k.id;
      return '<label style="' + kidStyle(x) + '"><input type="checkbox" name="kids" value="' + esc(x.id) + '"' + (on ? " checked" : "") + '> <span class="dotp" aria-hidden="true">' + initial(x.name) + '</span> ' + esc(x.name) + '</label>';
    }).join("");
    var home = state.meta.home || "", fromVal = t ? t.from : home;
    function stopRow(v) { return '<div class="stop"><input type="text" name="stop" maxlength="80" value="' + esc(v || "") + '" placeholder="Stop along the way, e.g. London" aria-label="Stop along the way"><button type="button" class="btn btn-ghost rmstop" aria-label="Remove this stop">×</button></div>'; }
    main.innerHTML = shell(k, "trips", '<h2>' + (t ? "Edit trip" : "Add a trip") + '</h2><div class="panel">' +
      '<div class="field" style="margin-top:0"><label>Who went? <span class="muted small">Check everyone who traveled</span></label><div class="kidpick">' + picks + '</div>' +
      (state.kids.length > 2 ? '<button type="button" class="linkbtn" id="tall">Everyone went</button>' : "") + '</div>' +
      '<div class="field"><label for="tfrom">From</label><input id="tfrom" type="text" maxlength="80" value="' + esc(fromVal) + '" placeholder="e.g. Orlando (where you started)">' +
      '<label class="check small homechk"><input type="checkbox" id="thome"' + (!home ? " checked" : "") + '> ' + (home ? "Make this our new home town" : "Save as our home town, so it\'s filled in next time") + '</label>' +
      '<div id="stops">' + (t ? t.stops : []).map(stopRow).join("") + '</div><button type="button" class="linkbtn" id="addstop">+ Add a stop along the way</button></div>' +
      '<div class="field"><label for="tplace">To (where did you go?)</label><input id="tplace" type="text" maxlength="80" value="' + (t ? esc(t.place) : "") + '" placeholder="e.g. Grandma\'s lake house, Edinburgh, Zion"></div>' +
      '<div class="fields"><div class="field"><label for="tdate">When?</label><input id="tdate" type="date" value="' + (t ? esc(t.date) : M.today()) + '"></div>' +
      '<div class="field"><label for="tmark">Color it in on the map?</label><select id="tmark">' + markOptions(t && t.mark) + '</select></div></div>' +
      '<div class="field"><label for="twho">Anyone else along?</label><input id="twho" type="text" maxlength="120" value="' + (t ? esc(t.who) : "") + '" placeholder="e.g. cousins, the Smiths, the dog"></div>' +
      '<div class="field"><label for="tmem">Favorite memory</label><textarea id="tmem" maxlength="1000" placeholder="The funny thing, the best food, the moment you want to remember">' + (t ? esc(t.memory) : "") + '</textarea></div>' +
      '<div class="field"><label for="tphoto">Photo (optional)</label><input id="tphoto" type="file" accept="image/*"><p class="small muted">We shrink it and keep it only on this device. Location data in the photo is removed.</p>' +
      '<img id="tprev" class="photo-prev" alt="" hidden>' + (t && t.photoId ? '<button type="button" class="btn btn-ghost" id="trmphoto" style="margin-top:.5rem">Remove photo</button>' : "") + '</div>' +
      '<p class="err" id="terr" hidden></p><div class="actions"><button class="btn btn-primary" id="tsave">Save trip</button>' +
      '<a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/trips">Cancel</a>' + (t ? '<button class="btn btn-danger" id="tdel">Delete trip</button>' : "") + '</div></div>');
    var stopsEl = document.getElementById("stops"), addStop = document.getElementById("addstop");
    function syncStops() {
      stopsEl.querySelectorAll(".rmstop").forEach(function (b) { b.onclick = function () { b.parentNode.remove(); syncStops(); }; });
      addStop.hidden = stopsEl.querySelectorAll(".stop").length >= M.MAX_STOPS;
    }
    addStop.onclick = function () { stopsEl.insertAdjacentHTML("beforeend", stopRow("")); syncStops(); stopsEl.lastElementChild.querySelector("input").focus(); };
    syncStops();
    var tall = document.getElementById("tall");
    if (tall) tall.onclick = function () { main.querySelectorAll("input[name=kids]").forEach(function (c) { c.checked = true; }); };
    var fromIn = document.getElementById("tfrom"), homeChk = document.getElementById("thome");
    fromIn.addEventListener("input", function () { if (home) homeChk.parentNode.hidden = fromIn.value.trim() === home || !fromIn.value.trim(); });
    if (home) homeChk.parentNode.hidden = fromIn.value.trim() === home || !fromIn.value.trim();
    var prev = document.getElementById("tprev");
    if (t && t.photoId) photoURL(t.photoId).then(function (u) { if (u) { prev.src = u; prev.hidden = false; } });
    document.getElementById("tphoto").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      shrinkPhoto(f).then(function (d) { newPhoto = d; removePhoto = false; prev.src = d; prev.hidden = false; })
        .catch(function (er) { var el = document.getElementById("terr"); el.textContent = er.message; el.hidden = false; });
    };
    var rm = document.getElementById("trmphoto");
    if (rm) rm.onclick = function () { removePhoto = true; newPhoto = null; prev.hidden = true; rm.hidden = true; };
    document.getElementById("tsave").onclick = function () {
      var err = document.getElementById("terr"); err.hidden = true;
      var mv = document.getElementById("tmark").value, mark = mv ? { kind: mv.split(":")[0], id: mv.split(":")[1] } : null;
      var kidIds = Array.prototype.map.call(main.querySelectorAll('input[name=kids]:checked'), function (c) { return c.value; });
      var photoId = t ? t.photoId : null, jobs = [];
      if (removePhoto && photoId) { jobs.push(del("photos", photoId)); delete photoCache[photoId]; photoId = null; }
      if (newPhoto) { if (photoId) { jobs.push(del("photos", photoId)); delete photoCache[photoId]; } photoId = M.uid("photo"); }
      var trip;
      try {
        trip = M.newTrip({ id: t ? t.id : undefined, createdAt: t ? t.createdAt : undefined, kidIds: kidIds, place: document.getElementById("tplace").value,
          from: fromIn.value, stops: Array.prototype.map.call(stopsEl.querySelectorAll("input[name=stop]"), function (i) { return i.value; }),
          date: document.getElementById("tdate").value, who: document.getElementById("twho").value, memory: document.getElementById("tmem").value, mark: mark, photoId: photoId });
      } catch (e) { err.textContent = e.message; err.hidden = false; return; }
      if (newPhoto) { jobs.push(put("photos", { id: photoId, dataUrl: newPhoto })); photoCache[photoId] = newPhoto; }
      M.applyTripMark(trip, state.kids);
      state.kids.forEach(function (x) { if (trip.kidIds.indexOf(x.id) >= 0) jobs.push(saveKid(x)); });
      jobs.push(put("trips", trip));
      if (trip.from && homeChk.checked && !homeChk.parentNode.hidden && trip.from !== home) jobs.push(setMeta("home", trip.from));
      state.trips = state.trips.filter(function (x) { return x.id !== trip.id; }).concat([trip]);
      Promise.all(jobs).then(function () {
        location.hash = "#/p/" + (trip.kidIds.indexOf(k.id) >= 0 ? k.id : trip.kidIds[0]) + "/trips";
        toast(t ? "Trip saved" : "Trip added!" + (trip.mark ? " " + placeName(trip.mark.kind, trip.mark.id) + " is colored in." : ""));
      }).catch(function () { err.textContent = "Couldn't save. Is the device out of space?"; err.hidden = false; });
    };
    var d = document.getElementById("tdel");
    if (d) d.onclick = function () {
      if (!confirm("Delete this trip? The map stays colored in.")) return;
      var jobs = [del("trips", t.id)]; if (t.photoId) jobs.push(del("photos", t.photoId));
      state.trips = state.trips.filter(function (x) { return x !== t; });
      Promise.all(jobs).then(function () { location.hash = "#/p/" + k.id + "/trips"; toast("Trip deleted"); });
    };
  }

  // ---------- stats + badges ----------
  var MEDALS = { "first-trip": "🎒", storyteller: "📖", photo: "📷", "states-5": "🚗", "states-10": "🗺️", "states-25": "🏁", "states-50": "🏆",
                 abroad: "🛂", "countries-5": "🌍", "continents-3": "🧭", scotland: "🏴", "uk-4": "👑", "park-1": "🌲", "parks-10": "🥾", "junior-ranger": "⭐", together: "🤝" };
  function statBox(v, total, k) { return '<div class="stat"><div class="v">' + v + (total ? ' <small>/ ' + total + '</small>' : "") + '</div><div class="k">' + k + '</div></div>'; }
  function viewStats(k) {
    var s = M.stats(k, state.trips, MAPS.world), b = M.badges(s), earned = b.filter(function (x) { return x.earned; }).length;
    main.innerHTML = shell(k, "stats", '<h2>' + esc(k.name) + '\'s travel stats</h2><div class="stats">' +
      statBox(s.states, 50, "States") + statBox(s.countries, 195, "Countries") + statBox(s.ukNations, 4, "UK nations") + statBox(s.parks, 64, "National parks") +
      (s.kid ? statBox(s.juniorRanger, 0, "Junior Ranger") : "") + statBox(s.continents, 7, "Continents") + statBox(s.trips, 0, "Trips") + statBox(s.together, 0, "Trips together") + statBox(s.photos, 0, "Photos") +
      (s.years ? statBox(s.years, 0, s.years === 1 ? "Year of trips" : "Years of trips") : "") + (s.firstTripAge != null ? statBox(s.firstTripAge, 0, "Age on first trip") : "") + '</div>' +
      '<h2>Badges <span class="muted small">' + earned + ' of ' + b.length + '</span></h2><div class="badges">' + b.map(function (x) {
        return '<div class="badge' + (x.earned ? "" : " locked") + '"><div class="medal" aria-hidden="true">' + (MEDALS[x.id] || "★") + '</div><b>' + esc(x.name) + '</b><span>' + esc(x.desc) + '</span>' +
          (x.earned ? "" : '<span>' + x.have + ' / ' + x.need + '</span>') + '</div>';
      }).join("") + '</div>' +
      '<div class="actions"><a class="btn btn-primary" href="#/p/' + esc(k.id) + '/print">🖨 Print my map</a><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/edit">Edit name or color</a><a class="btn btn-ghost" href="#/backup">Back up</a></div>' +
      '<div class="panel book"><span class="cover" aria-hidden="true">My Lifetime Travel Log</span><div><h3>' + (s.kid ? "Want this on paper?" : "A paper copy for the kids?") + '</h3><p class="small muted">The paperback has the same maps to color and 40 trip pages' + (s.kid ? "" : ", made for kids 3 to 18") + '. ' +
      '<a href="' + (BOOK_URL ? esc(BOOK_URL) : "#book") + '" data-book' + (BOOK_URL ? ' target="_blank" rel="noopener"' : "") + '>See the book</a></p></div></div>');
  }

  // ---------- family map ----------
  var famSel = null, famMode = "any", famMap = "us";
  function famPeople() {
    if (famSel) famSel = famSel.filter(function (id) { return kidById(id); });
    if (!famSel || !famSel.length) famSel = state.kids.map(function (k) { return k.id; });
    return state.kids.filter(function (k) { return famSel.indexOf(k.id) >= 0; });
  }
  function names(ids) { return ids.map(kidById).filter(Boolean).map(function (p) { return p.name; }); }
  function famTitle(people) {
    var adults = people.filter(function (p) { return !M.isKid(p); });
    if (people.length === 2 && adults.length === 2) return "you two";
    if (people.length === state.kids.length) return "the whole family";
    return names(people.map(function (p) { return p.id; })).join(" & ");
  }
  function viewFamily() {
    document.title = "Family map · My Lifetime Travel Log";
    var people = famPeople(), n = people.length, together = famMode === "together" && n > 1;
    var fs = M.familyStats(people, state.trips, MAPS.world);
    function fillFor(who) {   // who = ids of chosen people who've been there
      if (!who || !who.length) return null;
      if (together) return who.length === n ? { cls: " on fam-all" } : null;
      if (who.length === 1) return { style: "fill:" + kidById(who[0]).color };
      return { cls: " on fam-" + Math.min(who.length, 4) };
    }
    function pathTag(kind, p, who, extraCls) {
      var f = fillFor(who), nm = esc(p.name) + (who && who.length ? ": " + esc(names(who).join(", ")) : "");
      return '<path class="a' + (extraCls || "") + (f ? (f.cls || " on") : "") + '"' + (f && f.style ? ' style="' + f.style + '"' : "") + ' data-fam="' + p.id + '" data-names="' + nm + '" d="' + p.d + '"><title>' + nm + '</title></path>';
    }
    var chips = state.kids.map(function (k) {
      return '<button type="button" class="chip" data-person="' + esc(k.id) + '" aria-pressed="' + (famSel.indexOf(k.id) >= 0) + '" style="' + kidStyle(k) + '"><i aria-hidden="true"></i>' + esc(k.name) + '</button>';
    }).join("");
    var map = "", line = "";
    if (famMap === "us") {
      var w = M.whoBeen(people, "state", MAPS.world), u = MAPS.us;
      map = '<div class="mapbox us"><svg viewBox="0 0 ' + u.w + ' ' + u.h + '" role="img" aria-label="Family map of US states">' +
        u.insets.map(function (b) { return '<rect class="inset" x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="' + (b[2] + 8) + '" height="' + (b[3] + 8) + '" rx="8"/>'; }).join("") +
        u.shapes.map(function (p) { return pathTag("state", p, w[p.id]); }).join("") + '</svg></div>';
      line = together ? fs.togetherStates + " <small>of 50 states together</small>" : fs.states + " <small>of 50 states between " + (n === 1 ? "them" : "you") + "</small>";
    } else if (famMap === "world") {
      var wp = M.whoBeen(people, "place", MAPS.world), vb = ZOOMS[worldZoom] || [0, 0, MAPS.world.w, MAPS.world.h];
      people.forEach(function (p) { if (Object.keys(p.states).length && !(wp.USA || []).some(function (x) { return x === p.id; })) (wp.USA = wp.USA || []).push(p.id); });
      map = '<div class="seg" role="group" aria-label="Zoom">' + [["world", "Whole world"], ["na", "North America"], ["europe", "Europe"], ["uk", "UK & Ireland"]].map(function (z) {
          return '<button type="button" data-zoom="' + z[0] + '" aria-pressed="' + (worldZoom === z[0]) + '">' + z[1] + '</button>'; }).join("") + '</div>' +
        '<div class="mapbox"><svg viewBox="' + vb.join(" ") + '" role="img" aria-label="Family world map"><path class="ocean" d="' + MAPS.world.outline + '"/><path class="grat" d="' + MAPS.world.grat + '"/>' +
        MAPS.world.shapes.map(function (p) { return pathTag("place", p, wp[p.id], (p.other ? " o" : "") + (p.uk ? " uk" : "")); }).join("") + '</svg></div>';
      line = together ? fs.togetherCountries + " <small>of 195 countries together</small>" : fs.countries + " <small>of 195 countries between " + (n === 1 ? "them" : "you") + "</small>";
    } else {
      var wk = M.whoBeen(people, "park", MAPS.world);
      var rows = M.PARKS.filter(function (p) { var who = wk[p.id]; return who && (!together || who.length === n); }).map(function (p) {
        return '<div class="row"><div class="nm"><b>' + esc(p.name) + '</b><span>' + esc(p.states) + '</span></div><span class="dots">' + wk[p.id].map(function (id) {
          var x = kidById(id); return '<span class="dotp" title="' + esc(x.name) + '" style="' + kidStyle(x) + '">' + initial(x.name) + '</span>'; }).join("") + '</span></div>';
      }).join("");
      map = '<div class="panel parks">' + (rows || '<p class="muted">' + (together ? "No parks you've all been to yet. Time to plan one?" : "No national parks yet.") + '</p>') + '</div>';
      line = together ? fs.togetherParks + " <small>of 64 parks together</small>" : fs.parks + " <small>of 64 national parks between " + (n === 1 ? "them" : "you") + "</small>";
    }
    var legend = together ? '<p class="hint"><span class="key fam-all"></span> Places ' + esc(famTitle(people)) + (n === 2 ? ' have both been.' : ' have all been.') + '</p>'
      : '<p class="hint">One person: their color. <span class="key fam-2"></span> 2 people <span class="key fam-3"></span> 3 <span class="key fam-4"></span> 4 or more. Tap a place to see who\'s been.</p>';
    main.innerHTML = '<a class="back" href="#/">← Everyone</a><h1>Family map</h1>' +
      '<p class="lede small">Every place anyone in the family has been. Pick two people, like the two of you, to see the places you\'ve been together.</p>' +
      '<div class="chips" role="group" aria-label="Who\'s on the map">' + chips + '</div>' +
      '<div class="seg" role="group" aria-label="Show">' + [["any", "Anyone's been"], ["together", "Been together"]].map(function (m) {
        return '<button type="button" data-mode="' + m[0] + '" aria-pressed="' + (famMode === m[0]) + '"' + (m[0] === "together" && n < 2 ? " disabled" : "") + '>' + m[1] + '</button>'; }).join("") + '</div>' +
      '<div class="seg" role="group" aria-label="Map">' + [["us", "🇺🇸 USA"], ["world", "🌍 World"], ["parks", "🏞️ Parks"]].map(function (m) {
        return '<button type="button" data-fmap="' + m[0] + '" aria-pressed="' + (famMap === m[0]) + '">' + m[1] + '</button>'; }).join("") + '</div>' +
      '<div class="count"><div class="big">' + line + '</div></div>' + map + (famMap !== "parks" ? legend : "") +
      '<h2>' + (n > 1 ? "Together" : "Totals") + (n > 1 ? ' <span class="muted small">' + esc(n === state.kids.length ? "the whole family" : names(famSel).join(" & ")) + '</span>' : "") + '</h2><div class="stats">' +
      (n > 1 ? '<a class="stat person" href="#/together/fam" style="--kid:var(--sage-deep)"><div class="v">' + fs.togetherTrips + '</div><div class="k">Trips together · see them →</div></a>' + statBox(fs.togetherStates, 50, "States together") + statBox(fs.togetherCountries, 195, "Countries together") + statBox(fs.togetherParks, 64, "Parks together") : "") +
      statBox(fs.states, 50, "States, anyone") + statBox(fs.countries, 195, "Countries, anyone") + statBox(fs.parks, 64, "Parks, anyone") + statBox(fs.trips, 0, "Trips logged") + '</div>' +
      '<h2>Everyone</h2><div class="stats">' + people.map(function (p) {
        var ps = M.stats(p, state.trips, MAPS.world);
        return '<a class="stat person" href="#/p/' + esc(p.id) + '" style="' + kidStyle(p) + '"><div class="v"><span class="dotp">' + initial(p.name) + '</span> ' + esc(p.name) + '</div><div class="k">' + ps.states + ' states · ' + ps.countries + ' countries · ' + ps.parks + ' parks</div></a>';
      }).join("") + '</div>';
    main.querySelectorAll("[data-person]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.person, i = famSel.indexOf(id);
      if (i >= 0) { if (famSel.length > 1) famSel.splice(i, 1); else return toast("Keep at least one person on the map"); } else famSel.push(id);
      if (famSel.length < 2) famMode = "any"; viewFamily(); }; });
    main.querySelectorAll("[data-mode]").forEach(function (b) { b.onclick = function () { famMode = b.dataset.mode; viewFamily(); }; });
    main.querySelectorAll("[data-fmap]").forEach(function (b) { b.onclick = function () { famMap = b.dataset.fmap; viewFamily(); }; });
    main.querySelectorAll("[data-zoom]").forEach(function (b) { b.onclick = function () { worldZoom = b.dataset.zoom; viewFamily(); }; });
    main.querySelectorAll("[data-fam]").forEach(function (el) { el.addEventListener("click", function () { toast(el.dataset.names.indexOf(":") > 0 ? el.dataset.names : el.dataset.names + ": not yet"); }); });
  }

  // ---------- trips together ----------
  var togSel = null;
  function viewTogether(startId) {
    document.title = "Trips together · My Lifetime Travel Log";
    if (startId === "fam" && famSel && famSel.length >= 2) { togSel = famSel.slice(); history.replaceState(null, "", "#/together"); }
    else if (startId === "top") { togSel = null; history.replaceState(null, "", "#/together"); }
    else if (startId && kidById(startId)) {   // coming from someone's Trips tab: start with them and the person they travel with most
      var best = M.pairCounts(state.kids, state.trips).filter(function (p) { return p.ids.indexOf(startId) >= 0; })[0];
      togSel = best ? best.ids.slice() : [startId].concat(state.kids.filter(function (x) { return x.id !== startId; }).slice(0, 1).map(function (x) { return x.id; }));
      history.replaceState(null, "", "#/together");
    }
    if (togSel) togSel = togSel.filter(function (id) { return kidById(id); });
    if (!togSel || togSel.length < 2) {
      var top = M.pairCounts(state.kids, state.trips)[0];
      togSel = top ? top.ids.slice() : (famSel && famSel.length >= 2 ? famSel.slice() : state.kids.slice(0, 2).map(function (x) { return x.id; }));
    }
    var chosen = state.kids.filter(function (x) { return togSel.indexOf(x.id) >= 0; }).map(function (x) { return x.id; });
    var list = M.tripsTogether(state.trips, chosen), pairs = M.pairCounts(state.kids, state.trips);
    var chips = state.kids.map(function (x) {
      return '<button type="button" class="chip" data-tp="' + esc(x.id) + '" aria-pressed="' + (chosen.indexOf(x.id) >= 0) + '" style="' + kidStyle(x) + '"><i aria-hidden="true"></i>' + esc(x.name) + '</button>';
    }).join("");
    var head = chosen.length < 2 ? "Pick two or more people" : esc(travelerNames(chosen)) + ': <span class="big-n">' + list.length + '</span> ' + (list.length === 1 ? "trip" : "trips") + " together";
    main.innerHTML = '<a class="back" href="#/">← Everyone</a><h1>Trips together</h1>' +
      '<p class="lede small">Pick two or more people to see every trip they went on together.</p>' +
      '<div class="chips" role="group" aria-label="Who">' + chips + '</div>' +
      '<div class="count together-head"><div class="big">' + head + '</div><span class="dots">' + avatars(chosen) + '</span></div>' +
      (chosen.length < 2 ? "" : list.length ? '<div class="trips">' + list.map(function (t) { return tripCard(t, null); }).join("") + '</div>'
        : '<div class="panel"><p class="muted">No trips together yet. When you add a trip, check everyone who went under "Who went?".</p></div>') +
      (pairs.length ? '<h2>Who travels together most</h2><div class="panel pairs">' + pairs.slice(0, 10).map(function (p) {
        return '<button type="button" class="row pairrow" data-pair="' + esc(p.ids.join(",")) + '"><span class="dots">' + avatars(p.ids) + '</span><span class="nm"><b>' + esc(travelerNames(p.ids)) + '</b></span><span class="meta">' + p.count + (p.count === 1 ? " trip" : " trips") + '</span></button>';
      }).join("") + '</div>' : "") +
      '<div class="actions"><a class="btn btn-ghost" href="#/family">🗺️ See the places you\'ve been together</a></div>';
    fillPhotos();
    main.querySelectorAll("[data-tp]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.tp, i = togSel.indexOf(id);
      if (i >= 0) togSel.splice(i, 1); else togSel.push(id);
      if (togSel.length < 2) { toast("Pick at least two people"); if (i >= 0) { togSel.splice(i, 0, id); return; } }
      viewTogether(); }; });
    main.querySelectorAll("[data-pair]").forEach(function (b) { b.onclick = function () { togSel = b.dataset.pair.split(","); famSel = togSel.slice(); famMode = "together"; viewTogether(); window.scrollTo(0, 0); }; });
  }

  // ---------- print ----------
  function viewPrint(k) {
    var s = M.stats(k, state.trips, MAPS.world), list = kidTrips(k);
    var parks = M.PARKS.filter(function (p) { return k.parks[p.id]; });
    var places = Object.keys(k.places).map(function (id) { return placeName("place", id); }).sort();
    document.title = k.name + "'s travel map";
    main.innerHTML = '<div class="sheet" style="' + kidStyle(k) + '"><a class="back" href="#/p/' + esc(k.id) + '/stats">← Back</a>' +
      '<div class="actions noprint"><button class="btn btn-primary" id="doprint">🖨 Print or save as PDF</button></div>' +
      '<p class="hint noprint">Tip: choose "Landscape" and turn on "Background graphics" so the colors print.</p>' +
      '<section class="page"><h1>' + esc(k.name) + '\'s United States</h1><p class="statline">' + s.states + ' of 50 states · ' + s.parks + ' of 64 national parks · ' + s.trips + ' trips</p>' +
      '<div class="mapbox us">' + usSVG(k) + '</div></section>' +
      '<section class="page"><h1>' + esc(k.name) + '\'s world</h1><p class="statline">' + s.countries + ' of 195 countries · ' + s.continents + ' continents · UK nations ' + s.ukNations + ' of 4</p>' +
      '<div class="mapbox">' + worldSVG(k, "world") + '</div></section>' +
      '<section class="page"><h1>Where ' + esc(k.name) + ' has been</h1><div class="cols">' +
      '<div><h2>States</h2><p>' + (Object.keys(k.states).sort().map(function (x) { return esc(STATE_NAME[x]); }).join(", ") || "Not yet!") + '</p>' +
      '<h2>Countries and places</h2><p>' + (places.map(esc).join(", ") || "Not yet!") + '</p></div>' +
      '<div><h2>National parks</h2>' + (parks.length ? '<ul>' + parks.map(function (p) { return '<li>' + esc(p.name) + (k.parks[p.id].jr ? " ★ Junior Ranger" : "") + '</li>'; }).join("") + '</ul>' : "<p>Not yet!</p>") + '</div></div>' +
      (list.length ? '<h2>Trips</h2><ul>' + list.map(function (t) {
        var r = M.routeText(t), others = t.kidIds.filter(function (x) { return x !== k.id; });
        return '<li><b>' + esc(t.place) + '</b>' + (t.date ? ", " + esc(M.prettyDate(t.date)) : "") + (r !== t.place ? " (" + esc(r) + ")" : "") +
          (others.length ? ". With " + esc(travelerNames(others)) : "") + (t.who ? (others.length ? ", plus " : ". With ") + esc(t.who) : "") + (t.memory ? ": " + esc(t.memory) : "") + '</li>'; }).join("") + '</ul>' : "") +
      '<p class="small muted" style="margin-top:1rem">My Lifetime Travel Log · Map data: Natural Earth (public domain). Alaska and Hawaii are not to scale.</p></section></div>';
    document.getElementById("doprint").onclick = function () { window.print(); };
  }

  // ---------- backup / restore ----------
  function viewBackup() {
    var last = state.meta.lastBackupAt;
    main.innerHTML = '<a class="back" href="#/">← Home</a><h1>Back up and restore</h1>' +
      '<p class="lede">Your maps live only on this device. A backup file keeps them safe if the phone is lost, replaced or cleared.</p>' +
      '<div class="panel"><h3>Back up</h3><p class="muted small">Saves one file with everyone\'s maps, trips and photos. Email it to yourself or save it to your cloud drive.</p>' +
      '<p class="small">' + (last ? "Last backup: " + esc(M.prettyDate(last.slice(0, 10))) : "No backup yet.") + '</p>' +
      '<div class="actions"><button class="btn btn-primary" id="bdown">Save a backup file</button></div></div>' +
      '<div class="panel"><h3>Restore</h3><p class="muted small">Pick a backup file. Kids and trips in the file are added back; anything with the same name in both places is replaced by the file\'s copy.</p>' +
      '<div class="field"><label for="bfile">Backup file (.json)</label><input id="bfile" type="file" accept="application/json,.json"></div><p class="err" id="berr" hidden></p></div>' +
      '<div class="panel"><h3>Start over</h3><p class="muted small">Deletes everyone\'s maps, trips and photos from this device. Make a backup first if you might want them later.</p>' +
      '<div class="actions"><button class="btn btn-danger" id="bwipe">Delete everything on this device</button></div></div>';
    document.getElementById("bdown").onclick = function () { doBackup().then(function () { toast("Backup saved"); viewBackup(); }); };
    document.getElementById("bfile").onchange = function (e) {
      var f = e.target.files[0], err = document.getElementById("berr"); err.hidden = true; if (!f) return;
      if (f.size > 200e6) { err.textContent = "That file is too big to be a backup."; err.hidden = false; return; }
      f.text().then(function (txt) {
        var data; try { data = M.readBackup(JSON.parse(txt)); } catch (x) { throw new Error(x instanceof SyntaxError ? "That file isn't a backup (it couldn't be read)." : x.message); }
        if (!confirm("Restore " + data.kids.length + (data.kids.length === 1 ? " person, " : " people, ") + data.trips.length + " trip(s) and " + data.photos.length + " photo(s) from this backup?")) return null;
        return tx(["kids", "trips", "photos"], "readwrite", function (s) {
          data.kids.forEach(function (k) { s[0].put(k); }); data.trips.forEach(function (t) { s[1].put(t); }); data.photos.forEach(function (p) { s[2].put(p); });
        }).then(function () { return data.settings.home && !state.meta.home ? setMeta("home", data.settings.home) : null; })
          .then(load).then(function () { photoCache = {}; toast("Restored!"); location.hash = "#/"; });
      }).catch(function (x) { err.textContent = x.message; err.hidden = false; });
    };
    document.getElementById("bwipe").onclick = function () {
      if (!confirm("Delete everyone's maps, trips and photos on this device? This can't be undone.")) return;
      tx(["kids", "trips", "photos", "meta"], "readwrite", function (s) { s.forEach(function (st) { st.clear(); }); })
        .then(load).then(function () { photoCache = {}; toast("All cleared"); location.hash = "#/"; });
    };
  }

  // ---------- boot ----------
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-book]");
    if (a && !BOOK_URL) { e.preventDefault(); toast("The paperback is on its way to Amazon. Check back soon!"); }
  });
  load().then(route).catch(function () {
    main.innerHTML = '<div class="panel"><h3>Storage isn\'t available</h3><p class="muted">This browser is blocking on-device storage (private browsing can do this). Try a normal window so your maps can be saved.</p></div>';
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
