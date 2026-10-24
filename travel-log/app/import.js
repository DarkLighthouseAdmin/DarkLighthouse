/* Famstamp: "Import from Google Maps & more" (#/import). Reads Google Maps Timeline, Takeout, Google Photos, KML/KMZ,
   GPX, GeoJSON and CSV files right here on the device (in import-worker.js) and turns them into trips to review.
   Nothing is uploaded. The parsing and trip-finding logic lives in import-core.js; this file is only the screens. */
(function () {
  "use strict";
  var M = window.MLTL, MAPS = window.MLTL_MAPS, I = window.FS_IMPORT, esc = M.esc;
  function A() { return window.MLTL_APP; }
  var main = document.getElementById("main");
  var ACCEPT = ".json,.geojson,.csv,.kml,.kmz,.gpx,.zip,application/json,application/geo+json,application/zip,text/csv,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/gpx+xml";
  // A non-image type in the list makes Android open its file picker, which keeps photo locations (its photo picker strips them).
  var PHOTO_ACCEPT = "image/jpeg,image/heic,image/heif,.jpg,.jpeg,.heic,.heif,text/plain";

  // ---------- names the importer uses for places ----------
  var STATE = {}, PLACE = {}, PARK = {};
  MAPS.us.shapes.forEach(function (s) { STATE[s.id] = s.name; });
  MAPS.world.countries.forEach(function (c) { PLACE[c.id] = c.name; });
  MAPS.world.shapes.forEach(function (s) { if (!PLACE[s.id]) PLACE[s.id] = s.name; });
  M.PARKS.forEach(function (p) { PARK[p.id] = p.name; });
  var NAMES = {
    state: function (id) { return STATE[id] || id; }, place: function (id) { return PLACE[id] || id; }, park: function (id) { return (PARK[id] || id) + " National Park"; },
    validState: function (id) { return !!STATE[id]; }, validPlace: function (id) { return !!PLACE[id]; }, validPark: function (id) { return !!PARK[id]; }
  };
  function areaName(a) { return a.kind === "state" ? NAMES.state(a.id) : a.kind === "park" ? NAMES.park(a.id) : NAMES.place(a.id); }

  // ---------- reading files (in a worker when we can) ----------
  var worker = null, townWaits = {}, townSeq = 0;
  function getWorker() {
    if (worker || typeof Worker === "undefined") return worker;
    try { worker = new Worker("import-worker.js"); } catch (e) { worker = null; }
    return worker;
  }
  var mainGeo = null;
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function mainThreadGeo() {
    if (mainGeo) return Promise.resolve(mainGeo);
    return (window.FS_IMPORT_GEO ? Promise.resolve() : loadScript("import-geo.js")).then(function () { return window.FS_IMPORT_TOWNS ? null : loadScript("import-towns.js").catch(function () {}); })
      .then(function () { mainGeo = I.Geo(window.FS_IMPORT_GEO, window.FS_IMPORT_TOWNS); return mainGeo; });
  }
  function camPrefs() { return A().state.meta.cameraPrefs || {}; }
  function readFiles(files, homeText, onProgress) {
    var w = getWorker(), cams = camPrefs();
    function onMain() { return mainThreadGeo().then(function (geo) { return I.run(files, null, { geo: geo, homeText: homeText, cameras: cams, progress: onProgress }); }); }
    if (!w) return onMain();
    return new Promise(function (res, rej) {
      var started = false;
      w.onmessage = function (e) {
        var d = e.data; started = true;
        if (d.type === "progress") onProgress(d.done, d.total, d.label);
        else if (d.type === "result") res(d.result);
        else if (d.type === "error") rej(new Error(d.message));
        else if (d.type === "town" && townWaits[d.id]) { townWaits[d.id](d.town); delete townWaits[d.id]; }
      };
      w.onerror = function (e) { e.preventDefault && e.preventDefault(); if (!started) { worker = null; onMain().then(res, rej); } else rej(new Error("Reading stopped partway. Try again with fewer files.")); };
      w.postMessage({ files: Array.prototype.slice.call(files), homeText: homeText, cameras: cams });
    });
  }
  function findTown(text) {
    var w = worker;
    if (!w) return mainThreadGeo().then(function (g) { return g.findTown(text); });
    return new Promise(function (res) { var id = ++townSeq; townWaits[id] = res; w.postMessage({ type: "town", id: id, text: text }); setTimeout(function () { if (townWaits[id]) { delete townWaits[id]; res(null); } }, 4000); });
  }

  // ---------- small helpers ----------
  var S = null;   // the import being reviewed
  function back(href, label) { return '<a class="back" href="' + href + '">← ' + esc(label) + '</a>'; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function fmtRange(a, b) {
    if (!a) return "";   // no date: show nothing
    if (!b || a === b) return M.prettyDate(a);
    var A1 = M.prettyDate(a), B1 = M.prettyDate(b);
    if (a.slice(0, 4) === b.slice(0, 4)) A1 = A1.replace(/,?\s*\d{4}$/, "");
    return A1 + " – " + B1;
  }
  function homeLabel(h) { return h ? (h.name || (h.town ? h.town + (h.country === "USA" && h.region ? ", " + h.region : "") : "")) || "Home" : ""; }
  function bytes(n) { return n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : n > 1e6 ? Math.round(n / 1e6) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB"; }
  var KIND = { records: "Location History (Records.json)", semantic: "Semantic Location History", timeline: "Google Maps Timeline (Android)", "timeline-ios": "Google Maps Timeline (iPhone)",
    "timeline-raw": "Timeline raw signals", "photos-takeout": "Google Photos info files", "photos-picked": "Photos", "photo-csv": "photo-locations.csv", "saved-places": "Saved places",
    "saved-list": "Saved lists", "kml-places": "My Maps / Google Earth", "kml-dated": "My Maps / Google Earth", "kml-lines": "My Maps routes", "kml-tracks": "Google Earth tracks",
    gpx: "GPX", "geojson-places": "GeoJSON", "geojson-dated": "GeoJSON", "geojson-lines": "GeoJSON lines", "csv-places": "CSV", "csv-dated": "CSV" };
  function kindsText(k) { var out = []; Object.keys(k || {}).forEach(function (x) { var n = KIND[x]; if (n && out.indexOf(n) < 0) out.push(n); }); return out.join(", "); }

  // ---------- #/import: pick files ----------
  function viewPick(forKid) {
    var A0 = A(), home = A0.state.meta.home || "";
    main.innerHTML = back("#/backup", "Back up") +
      '<h1>Import your trips</h1><p class="lede">Bring in years of trips from Google Maps Timeline, Google Photos and other map files. You\'ll see every trip we find before anything is added.</p>' +
      '<div class="panel imp-privacy"><b>🔒 Read on this phone, never uploaded.</b> <span class="small">Your files are opened right here in the app. Nothing is sent to us or anyone else, and the files themselves aren\'t kept.</span></div>' +
      '<label class="imp-drop" id="imp-drop" for="imp-files"><span class="imp-ic" aria-hidden="true">🗺️</span><b>Choose files</b><span class="small muted">or drop them here</span>' +
      '<span class="small muted">Timeline.json, location-history.json, Takeout .zip, .kml, .kmz, .gpx, .geojson, .csv</span>' +
      '<input id="imp-files" type="file" multiple accept="' + ACCEPT + '"></label>' +
      '<div class="panel"><h3>📷 Or use photo locations</h3><p class="small muted">Pick photos and we\'ll read just where and when each was taken (the photos aren\'t copied). Got a big library? A Google Photos Takeout zip works better; see the help.</p>' +
      '<div class="actions"><label class="btn btn-ghost" for="imp-photos">Choose photos</label></div><input id="imp-photos" class="imp-hidden" type="file" multiple accept="' + PHOTO_ACCEPT + '"></div>' +
      '<div class="field"><label for="imp-home">Home town</label><input id="imp-home" maxlength="80" placeholder="e.g. Madison, WI" value="' + esc(home) + '">' +
      '<p class="hint small">Trips are the days you were more than about 50 miles from home. Leave it blank and we\'ll guess from your files.</p></div>' +
      '<div class="imp-prog" id="imp-prog" hidden><div class="imp-bar"><i id="imp-bar"></i></div><p class="small muted" id="imp-ptext">Reading…</p></div>' +
      '<p class="err" id="imp-err" hidden></p>' +
      '<p class="small"><a href="#/import/help">How do I get my Google Maps Timeline or Takeout files?</a></p>' +
      (want().length ? '<p class="small"><a href="#/import/want">⭐ Your want-to-go list (' + want().length + ')</a></p>' : "");
    document.title = "Import trips · Famstamp";
    var drop = document.getElementById("imp-drop");
    function go(files) {
      if (!files || !files.length) return;
      var err = document.getElementById("imp-err"), prog = document.getElementById("imp-prog"), bar = document.getElementById("imp-bar"), pt = document.getElementById("imp-ptext");
      err.hidden = true; prog.hidden = false; bar.style.width = "2%";
      var total = 0; Array.prototype.forEach.call(files, function (f) { total += f.size || 0; });
      pt.textContent = "Reading " + plural(files.length, "file") + " (" + bytes(total) + ") on this phone…";
      var homeText = document.getElementById("imp-home").value.trim();
      if (homeText !== (A().state.meta.home || "")) A().setMeta("home", homeText);
      var names = Array.prototype.map.call(files, function (f) { return f.name; });
      readFiles(files, homeText, function (done, tot) {
        var pc = tot ? Math.max(2, Math.min(100, Math.round(done / tot * 100))) : 50; bar.style.width = pc + "%";
        pt.textContent = "Reading on this phone… " + pc + "%";
      }).then(function (R) {
        bar.style.width = "100%";
        startReview(R, names, homeText, forKid, files);
      }).catch(function (x) { prog.hidden = true; err.textContent = x.message || "Couldn't read those files."; err.hidden = false; });
    }
    document.getElementById("imp-files").onchange = function (e) { go(e.target.files); };
    document.getElementById("imp-photos").onchange = function (e) { go(e.target.files); };
    ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { go(e.dataTransfer && e.dataTransfer.files); });
  }

  // ---------- review ----------
  function existingKeys() { var log = A().state.meta.importLog || []; var k = []; log.forEach(function (l) { (l.keys || []).forEach(function (x) { k.push(x); }); }); return k; }
  function want() { return A().state.meta.wantToGo || []; }
  function startReview(R, fileNames, homeText, forKid, files) {
    rememberCameras(R.cameras);
    var H = I.detectHome(R), home = null, saved = A().state.meta.homeLoc;
    if (R.homeText) home = { lat: R.homeText.lat, lon: R.homeText.lon, name: R.homeText.name + (R.homeText.country === "USA" && R.homeText.region ? ", " + R.homeText.region : ""), country: R.homeText.country, region: R.homeText.region, how: "typed" };
    else if (H.home) home = H.home;
    else if (saved && isFinite(saved.lat)) home = saved;
    if (home && !home.name) home.name = homeLabel(home);
    var people = A().state.kids, pre = forKid && A().kidById(forKid) ? [forKid] : people.map(function (p) { return p.id; });
    S = { R: R, files: fileNames, fileObjs: files, homeText: homeText, forKid: forKid, home: home, cands: H.candidates, who: pre, trips: [], places: [], showDay: false };
    S.places = I.matchPlaces(R.places.slice(), want());
    S.places.forEach(function (p) { p.choice = p.status === "saved" ? "skip" : "skip"; });
    retrip();
    location.hash = "#/import/review";
  }
  function retrip() {
    var found = I.detectTrips(S.R, { home: S.home, names: NAMES });
    I.matchExisting(found, A().state.trips, { importedKeys: existingKeys() });
    found.sort(function (a, b) { return (b.start || "") < (a.start || "") ? -1 : 1; });
    found.forEach(function (f, i) { f.i = i; f.title = f.place; f.who = S.who.slice(); });
    S.trips = found;
  }
  function viewReview() {
    if (!S) { location.hash = "#/import"; return; }
    var R = S.R, people = A().state.kids, trips = S.trips, shown = trips.filter(function (t) { return S.showDay || !t.dayTrip || t.checked; });
    var unsureT = trips.filter(function (t) { return t.unsure; });
    shown = shown.filter(function (t) { return !t.unsure; });
    var dayN = trips.filter(function (t) { return t.dayTrip && !t.unsure; }).length, checked = trips.filter(function (t) { return t.checked; }).length;
    var facts = [], noPlace = (R.noLoc || 0) + (trips.unplaced || 0);
    if (R.photos) facts.push(plural(R.photos, "photo") + " with a location" + (R.placedByTime ? " (" + R.placedByTime + " placed by the time they were taken)" : ""));
    if (noPlace) facts.push(plural(noPlace, "photo") + " had no location");
    if (R.notYours) facts.push(plural(R.notYours, "photo") + " skipped as not yours (shared with you, or a camera you marked not mine)");
    if (R.redacted) facts.push(plural(R.redacted, "photo") + " had the location removed by the photo picker (see help)");
    var html = back("#/import", "Pick other files") + '<h1>Here\'s what we found</h1>' +
      '<p class="lede small">' + esc((function () { var u = trips.filter(function (t) { return !t.unsure; }).length, bits = [plural(u, "trip")]; if (S.places.length) bits.push(plural(S.places.length, "saved place")); return bits.join(" and "); })() + (kindsText(R.kinds) ? " from " + kindsText(R.kinds) : "")) + '.</p>' +
      (facts.length ? '<p class="small muted imp-facts">' + esc(facts.join(" · ")) + '</p>' : "") +
      R.warn.map(function (w) { var toc = /^TOC:/.test(w); return '<div class="nudge imp-warn' + (toc ? " toc" : "") + '">' + esc(w.replace(/^TOC:/, "")) + '</div>'; }).join("");
    // home
    var opts = (S.cands || []).map(function (c, i) { return '<option value="c' + i + '"' + (S.home && Math.abs(S.home.lat - c.lat) < 0.05 && Math.abs(S.home.lon - c.lon) < 0.05 ? " selected" : "") + '>' + esc(homeLabel(c) || NAMES.state(c.region) || "Place " + (i + 1)) + " (" + plural(c.days, "day") + ')</option>'; });
    html += '<div class="panel imp-home"><h3>Home</h3><p class="small muted">' + (S.home ? "Trips are the days you were 50+ miles from <b>" + esc(homeLabel(S.home)) + "</b>." : "We couldn't tell where home is, so every place below counts as a trip. Add your home town to split them up.") + '</p>' +
      '<div class="imp-row"><input id="imp-hometext" maxlength="80" placeholder="Home town, e.g. Madison, WI" value="' + esc(S.home && S.home.how === "typed" ? S.home.name : "") + '"><button class="btn btn-ghost" id="imp-homeset">Use</button></div>' +
      (opts.length ? '<div class="field"><label for="imp-homepick">Or pick from your files</label><select id="imp-homepick"><option value="">Choose…</option>' + opts.join("") + '<option value="none">No home (every day counts)</option></select></div>' : "") + '</div>';
    // who
    if (!people.length) html += '<div class="panel"><h3>Who traveled?</h3><p class="muted">Add the people in your family first, then come back. Your import will still be here.</p><div class="actions"><a class="btn btn-primary" href="#/add">+ Add someone</a></div></div>';
    else html += '<div class="panel"><h3>Who went?</h3><p class="small muted">Everyone checked here is on each trip. You can change it per trip below.</p><div class="chips" id="imp-who">' +
      people.map(function (p) { return '<label class="chip"><input type="checkbox" value="' + esc(p.id) + '"' + (S.who.indexOf(p.id) >= 0 ? " checked" : "") + '> ' + esc(p.name) + '</label>'; }).join("") + '</div></div>';
    // trips
    html += '<h2>Trips <span class="muted small">(' + checked + ' picked)</span></h2>';
    if (trips.length) html += '<div class="actions imp-bulk"><button class="btn btn-ghost" data-all="1">Pick all</button><button class="btn btn-ghost" data-all="0">Pick none</button>' +
      (dayN ? '<button class="btn btn-ghost" id="imp-days">' + (S.showDay ? "Hide" : "Show") + " " + plural(dayN, "day trip") + '</button>' : "") + '</div>';
    else html += '<div class="panel"><p class="muted">No trips in these files' + (S.home ? " (no days far from home)" : "") + '.' + (S.places.length ? " The saved places are below." : "") + '</p></div>';
    html += '<div class="imp-trips">' + shown.map(tripRow).join("") + '</div>';
    if (unsureT.length) html += '<h2>Did you actually go here?</h2><p class="small muted">These come from photos that might not be yours: screenshots, saved or downloaded pictures, or a single photo far from anywhere else you were. Nothing here is added unless you tick it.</p>' +
      '<div class="imp-trips imp-unsure">' + unsureT.map(tripRow).join("") + '</div>';
    html += camerasPanel(R.cameras);
    // places
    if (S.places.length) {
      var lists = {}; S.places.forEach(function (p, i) { p.i = i; (lists[p.list] = lists[p.list] || []).push(p); });
      html += '<h2>Saved places</h2><p class="small muted">Mark the ones you want to go to, or ones you\'ve already been (that colors in the state or country for everyone checked above).</p>';
      Object.keys(lists).forEach(function (L) {
        var ps = lists[L];
        html += '<details class="panel imp-list"' + (Object.keys(lists).length === 1 ? " open" : "") + '><summary><b>' + esc(L) + '</b> <span class="muted small">' + plural(ps.length, "place") + '</span></summary>' +
          '<div class="actions"><button class="btn btn-ghost" data-listall="' + esc(L) + '" data-v="want">All want to go</button><button class="btn btn-ghost" data-listall="' + esc(L) + '" data-v="skip">Skip all</button></div>' +
          ps.slice(0, 400).map(function (p) {
            var where = [p.town, p.region && p.country === "USA" ? p.region : p.c ? NAMES.place(p.c) : ""].filter(Boolean).join(", ");
            return '<div class="imp-place"><span><b>' + esc(p.name) + '</b>' + (p.status === "saved" ? ' <span class="badge">On your list</span>' : "") + '<br><span class="small muted">' + esc(where || (p.lat == null ? "No map location in the file" : "")) + '</span></span>' +
              '<select data-place="' + p.i + '" aria-label="' + esc(p.name) + '"><option value="skip">Skip</option><option value="want"' + (p.choice === "want" ? " selected" : "") + '>⭐ Want to go</option>' +
              (p.lat != null ? '<option value="been"' + (p.choice === "been" ? " selected" : "") + '>✓ Been there</option>' : "") + '</select></div>';
          }).join("") + (ps.length > 400 ? '<p class="small muted">Showing the first 400.</p>' : "") + '</details>';
      });
    }
    var nWant = S.places.filter(function (p) { return p.choice === "want"; }).length, nBeen = S.places.filter(function (p) { return p.choice === "been"; }).length;
    var can = people.length && (checked || nWant || nBeen);
    html += '<div class="imp-save"><button class="btn btn-beacon" id="imp-save"' + (can ? "" : " disabled") + '>' + esc(saveLabel(checked, nWant + nBeen)) + '</button>' +
      '<p class="small muted">You can edit or delete any of these later, like any other trip.</p></div>';
    main.innerHTML = html;
    document.title = "Review import · Famstamp";
    bindReview();
  }
  function saveLabel(t, p) { return t || p ? "Add " + [t ? plural(t, "trip") : "", p ? plural(p, "place") : ""].filter(Boolean).join(" and ") : "Pick something to add"; }
  function tripRow(t) {
    var people = A().state.kids, badges = [];
    if (t.status === "imported") badges.push('<span class="badge imp-b-done">Already imported</span>');
    if (t.status === "maybe") badges.push('<span class="badge imp-b-maybe">Looks like a trip you already have</span>');
    if (t.dayTrip) badges.push('<span class="badge">Day trip</span>');
    if (t.unsure) badges.push('<span class="badge imp-b-maybe">' + esc(whyText(t.why)) + '</span>');
    if (t.extraPhotos) badges.push('<span class="badge">' + esc("+" + t.extraPhotos + " camera photos") + '</span>');
    if (t.track) badges.push('<span class="badge">' + esc(Math.round(t.trackMiles) + " mi tracked") + '</span>');
    if (t.photos) badges.push('<span class="badge">📷 ' + t.photos + '</span>');
    var areas = I.areasOf(t).map(areaName);
    var routeTxt = t.route.map(function (p) { return p.name; }).join(" → ") + (t.roundTrip && t.route.length > 1 ? " → " + t.route[0].name : "");
    return '<article class="imp-trip' + (t.checked ? " on" : "") + '" data-trip="' + t.i + '">' +
      '<label class="imp-pick"><input type="checkbox" data-check="' + t.i + '"' + (t.checked ? " checked" : "") + ' aria-label="Add this trip"></label><div class="body">' +
      '<input class="imp-title" data-title="' + t.i + '" maxlength="80" value="' + esc(t.title) + '" aria-label="Trip name">' +
      '<div class="when small">' + esc([fmtRange(t.start, t.end), t.nights ? plural(t.nights, "night") : ""].filter(Boolean).join(" · ")) + '</div>' +
      '<div class="route small muted">' + esc(routeTxt) + '</div>' +
      (areas.length ? '<div class="small">🖍 ' + esc(areas.slice(0, 8).join(", ") + (areas.length > 8 ? " +" + (areas.length - 8) : "")) + '</div>' : "") +
      (t.highlights && t.highlights.length ? '<div class="small muted">Most photos: ' + esc(t.highlights.map(function (h) { return h.name + " (" + h.photos + ")"; }).join(", ")) + '</div>' : "") +
      (badges.length ? '<div class="badges">' + badges.join("") + '</div>' : "") +
      (people.length > 1 ? '<details class="imp-whotrip"><summary class="small">Who went: ' + esc(M.joinNames(t.who.map(function (id) { var p = A().kidById(id); return p ? p.name : ""; }).filter(Boolean)) || "nobody yet") + '</summary><div class="chips">' +
        people.map(function (p) { return '<label class="chip"><input type="checkbox" data-tw="' + t.i + '" value="' + esc(p.id) + '"' + (t.who.indexOf(p.id) >= 0 ? " checked" : "") + '> ' + esc(p.name) + '</label>'; }).join("") + '</div></details>' : "") +
      '</div></article>';
  }
  function bindReview() {
    function q(id) { return document.getElementById(id); }
    function refresh() { var y = window.scrollY; viewReview(); window.scrollTo(0, y); }
    var setBtn = q("imp-homeset");
    if (setBtn) setBtn.onclick = function () {
      var text = q("imp-hometext").value.trim(); if (!text) return;
      setBtn.disabled = true;
      findTown(text).then(function (t) {
        if (!t) { A().toast("Couldn't find that town. Try the nearest bigger one."); setBtn.disabled = false; return; }
        S.home = { lat: t.lat, lon: t.lon, name: t.name + (t.country === "USA" && t.region ? ", " + t.region : ""), country: t.country, region: t.region, how: "typed" };
        A().setMeta("home", text); retrip(); refresh();
      });
    };
    var pick = q("imp-homepick");
    if (pick) pick.onchange = function () {
      var v = pick.value; if (!v) return;
      if (v === "none") S.home = null; else { var c = S.cands[+v.slice(1)]; S.home = { lat: c.lat, lon: c.lon, town: c.town, region: c.region, country: c.country, how: "picked" }; S.home.name = homeLabel(S.home); }
      retrip(); refresh();
    };
    var who = q("imp-who");
    if (who) who.onchange = function () {
      var prev = S.who; S.who = Array.prototype.filter.call(who.querySelectorAll("input"), function (x) { return x.checked; }).map(function (x) { return x.value; });
      S.trips.forEach(function (t) { if (t.who.join() === prev.join()) t.who = S.who.slice(); });
      refresh();
    };
    main.onchange = function (e) {
      var el = e.target;
      if (el.dataset.check != null) { S.trips[+el.dataset.check].checked = el.checked; refresh(); }
      else if (el.dataset.tw != null) { var t = S.trips[+el.dataset.tw], i = t.who.indexOf(el.value); if (el.checked && i < 0) t.who.push(el.value); if (!el.checked && i >= 0) t.who.splice(i, 1); refresh(); }
      else if (el.dataset.place != null) { S.places[+el.dataset.place].choice = el.value; refresh(); }
    };
    main.oninput = function (e) { var el = e.target; if (el.dataset.title != null) S.trips[+el.dataset.title].title = el.value; };
    main.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.all != null) { S.trips.forEach(function (t) { if ((S.showDay || !t.dayTrip) && !t.unsure) t.checked = b.dataset.all === "1"; }); refresh(); }
      else if (b.id === "imp-days") { S.showDay = !S.showDay; refresh(); }
      else if (b.dataset.listall != null) { S.places.forEach(function (p) { if (p.list === b.dataset.listall) p.choice = b.dataset.v; }); refresh(); }
      else if (b.dataset.cam != null) { setCam(b.dataset.cam, b.dataset.v); refresh(); }
      else if (b.id === "imp-reread") { var files = S.fileObjs; if (!files) return; b.disabled = true; b.textContent = "Reading again…";
        readFiles(files, S.homeText, function () {}).then(function (R) { startReview(R, S.files, S.homeText, S.forKid, files); viewReview(); }).catch(function (x) { A().toast(x.message); }); }
      else if (b.id === "imp-save") { b.disabled = true; save().then(function (res) { S.result = res; location.hash = "#/import/done"; }).catch(function (x) { b.disabled = false; A().toast(x.message || "Couldn't save. Try again."); }); }
    };
  }

  // ---------- cameras ----------
  var WHY = { download: "Screenshot or saved picture", web: "Uploaded from a computer, no camera info", nocamera: "No camera info", single: "Just one photo, far from anywhere else" };
  function whyText(list) { return (list || []).map(function (w) { return WHY[w] || "Not sure it's yours"; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(" · ") || "Not sure"; }
  function rememberCameras(c) {
    if (!c || !Object.keys(c).length) return;
    var all = Object.assign({}, A().state.meta.cameras || {});
    Object.keys(c).forEach(function (k) { var o = all[k] || { n: 0, gps: 0 }; all[k] = { n: Math.max(o.n, c[k].n), gps: Math.max(o.gps, c[k].gps) }; });
    A().setMeta("cameras", all);
  }
  function setCam(name, v) { var p = Object.assign({}, camPrefs()); if (v === "auto") delete p[name]; else p[name] = v; A().setMeta("cameraPrefs", p); if (S) S.camsChanged = true; }
  function camRows(cams) {
    var prefs = camPrefs();
    return Object.keys(cams).sort(function (a, b) { return cams[b].n - cams[a].n; }).map(function (name) {
      var c = cams[name], v = prefs[name] || "auto";
      return '<div class="imp-place"><span><b>' + esc(name) + '</b><br><span class="small muted">' + esc(plural(c.n, "photo") + (c.gps ? ", " + c.gps + " with GPS" : ", no GPS (placed by time)")) + '</span></span>' +
        '<span class="seg imp-seg">' + ["mine", "not"].map(function (x) { return '<button type="button" class="btn btn-ghost' + (v === x ? " on" : "") + '" data-cam="' + esc(name) + '" data-v="' + (v === x ? "auto" : x) + '" aria-pressed="' + (v === x) + '">' + (x === "mine" ? "Mine" : "Not mine") + '</button>'; }).join("") + '</span></div>';
    }).join("");
  }
  function camerasPanel(cams) {
    if (!cams || !Object.keys(cams).length) return "";
    return '<details class="panel imp-cams"' + (S && S.camsChanged ? " open" : "") + '><summary><b>📸 My cameras</b> <span class="muted small">' + plural(Object.keys(cams).length, "camera") + ' in these photos</span></summary>' +
      '<p class="small muted">Photos from a real camera count as yours. Mark a camera "Not mine" (say, pictures someone sent you) to leave its photos out.</p>' + camRows(cams) +
      (S && S.camsChanged ? '<div class="actions"><button class="btn btn-primary" id="imp-reread">Read the files again with these cameras</button></div>' : "") + '</details>';
  }
  function viewCameras() {
    var cams = A().state.meta.cameras || {};
    main.innerHTML = back("#/backup", "Back up") + '<h1>📸 My cameras</h1><p class="lede small">Cameras found in your imported photos. Photos from a camera marked "Not mine" are left out of future imports.</p>' +
      (Object.keys(cams).length ? '<div class="panel">' + camRows(cams) + '</div>' : '<div class="panel"><p class="muted">No cameras yet. They show up here after you import photos.</p></div>');
    main.onclick = function (e) { var b = e.target.closest("[data-cam]"); if (b) { setCam(b.dataset.cam, b.dataset.v); setTimeout(viewCameras, 0); } };
    document.title = "My cameras · Famstamp";
  }

  // ---------- save ----------
  function save() {
    var app = A(), now = new Date().toISOString(), kids = app.state.kids, touched = {}, out = { trips: 0, areas: {}, want: 0, been: 0, people: {} };
    var picked = S.trips.filter(function (t) { return t.checked && t.who.length; });
    var jobs = [], keys = [];
    picked.forEach(function (f) {
      var a = I.toAppTrip(f, { kidIds: f.who, title: f.title.trim() || f.place, now: now });
      var trip = M.newTrip(a.base);
      var x = a.extra;
      if (window.WK_TRIPS && window.WK_TRIPS.cleanExtras) {   // the 1.4 trips model: let it check the route the same way the trip form does
        var clean = window.WK_TRIPS.cleanExtras(Object.assign({ done: (f.end || f.start) < M.today() }, x), trip.kidIds); Object.keys(clean).forEach(function (k) { trip[k] = clean[k]; });
        if (window.WK_TRIPS.syncLegacy) window.WK_TRIPS.syncLegacy(trip);
        if (window.WK_TRIPS.fitSize) window.WK_TRIPS.fitSize(trip);   // sync rows are capped at 16 KB
      } else Object.keys(x).forEach(function (k) { if (k !== "importKey" && k !== "import") trip[k] = x[k]; });
      trip.importKey = x.importKey; trip.import = x.import;
      jobs.push(trip); keys.push(f.key); out.trips++;
      kids.forEach(function (k) {
        if (f.who.indexOf(k.id) < 0) return;
        touched[k.id] = k; out.people[k.id] = 1;
        I.areasOf(f).forEach(function (ar) {
          if (ar.kind === "park") { if (!k.parks[ar.id]) { k.parks[ar.id] = { at: f.start || M.today(), jr: false }; out.areas["park:" + ar.id] = 1; } }
          else if (!(ar.kind === "state" ? k.states : k.places)[ar.id]) { M.toggleArea(k, ar.kind, ar.id, true, f.start); out.areas[ar.kind + ":" + ar.id] = 1; }
        });
        k.updatedAt = now;
      });
    });
    var wl = want().slice(), haveW = {}; wl.forEach(function (w) { haveW[w.key] = 1; });
    var whoAll = S.who.length ? S.who : [];
    S.places.forEach(function (p) {
      if (p.choice === "want" && !haveW[p.key]) { wl.push(I.wantItem(p, now)); haveW[p.key] = 1; out.want++; }
      if (p.choice === "been" && p.lat != null) {
        out.been++;
        kids.forEach(function (k) {
          if (whoAll.indexOf(k.id) < 0) return;
          var list = [];
          if (p.country === "USA" && NAMES.validState(p.region)) list.push({ kind: "state", id: p.region });
          else if (p.c && NAMES.validPlace(p.c)) list.push({ kind: "place", id: p.c });
          if (p.park && NAMES.validPark(p.park)) list.push({ kind: "park", id: p.park });
          list.forEach(function (ar) {
            if (ar.kind === "park") { if (!k.parks[ar.id]) { k.parks[ar.id] = { at: M.today(), jr: false }; out.areas["park:" + ar.id] = 1; } }
            else if (!(ar.kind === "state" ? k.states : k.places)[ar.id]) { M.toggleArea(k, ar.kind, ar.id, true); out.areas[ar.kind + ":" + ar.id] = 1; }
          });
          touched[k.id] = k; out.people[k.id] = 1;
        });
      }
    });
    var log = (app.state.meta.importLog || []).slice(-49);
    log.push({ at: now, files: S.files.slice(0, 20), keys: keys, trips: out.trips, places: out.want + out.been });
    var p = Promise.resolve();
    jobs.forEach(function (t) { p = p.then(function () { return app.put("trips", t); }); });
    Object.keys(touched).forEach(function (id) { p = p.then(function () { return app.put("kids", touched[id]); }); });
    if (out.want) p = p.then(function () { return app.setMeta("wantToGo", wl); });
    if (S.home && isFinite(S.home.lat)) p = p.then(function () { return app.setMeta("homeLoc", { lat: S.home.lat, lon: S.home.lon, name: S.home.name || "", country: S.home.country || "", region: S.home.region || "" }); });
    return p.then(function () { return app.setMeta("importLog", log); }).then(app.load).then(function () { return out; });
  }

  // ---------- done ----------
  function viewDone() {
    if (!S || !S.result) { location.hash = "#/import"; return; }
    var r = S.result, A0 = A(), who = Object.keys(r.people).map(function (id) { var p = A0.kidById(id); return p ? p.name : ""; }).filter(Boolean);
    var areas = Object.keys(r.areas), st = areas.filter(function (a) { return /^state:/.test(a); }).length, pl = areas.filter(function (a) { return /^place:/.test(a); }).length, pk = areas.filter(function (a) { return /^park:/.test(a); }).length;
    var first = who.length ? A0.state.kids.filter(function (k) { return r.people[k.id]; })[0] : A0.state.kids[0];
    var lines = [];
    if (r.trips) lines.push(plural(r.trips, "trip") + " added" + (who.length ? " for " + M.joinNames(who) : ""));
    if (st || pl || pk) lines.push("Newly colored in: " + [st ? plural(st, "state") : "", pl ? plural(pl, "country", "countries") : "", pk ? plural(pk, "national park") : ""].filter(Boolean).join(", "));
    if (r.want) lines.push(plural(r.want, "place") + " saved to your want-to-go list");
    if (r.been) lines.push(plural(r.been, "saved place") + " marked as been there");
    main.innerHTML = '<div class="synchero imp-done"><div class="beam" aria-hidden="true">🎉</div><h1>All set!</h1>' + lines.map(function (l) { return '<p class="lede small">' + esc(l) + '.</p>'; }).join("") + '</div>' +
      '<div class="actions">' + (first ? '<a class="btn btn-primary" href="#/p/' + esc(first.id) + '/trips">See the trips</a>' : "") +
      (r.want ? '<a class="btn btn-ghost" href="#/import/want">Want-to-go list</a>' : "") + '<a class="btn btn-ghost" href="#/import">Import more</a></div>' +
      '<p class="small muted">Importing the same file again is safe: trips you already brought in show up as "Already imported" and start unchecked.</p>';
    document.title = "Imported · Famstamp";
  }

  // ---------- want to go ----------
  function viewWant() {
    var wl = want();
    main.innerHTML = back("#/import", "Import") + '<h1>⭐ Want to go</h1><p class="lede small">Places from your saved lists. When you go, add the trip and it colors in the map.</p>' +
      (wl.length ? '<div class="imp-want">' + wl.map(function (w, i) {
        var where = [w.region && w.country === "USA" ? NAMES.state(w.region) : w.c ? NAMES.place(w.c) : ""].filter(Boolean).join(", ");
        return '<div class="imp-place"><span><b>' + esc(w.name) + '</b><br><span class="small muted">' + esc([where, w.list].filter(Boolean).join(" · ")) + '</span></span><button class="btn btn-ghost" data-wdel="' + i + '" aria-label="Remove ' + esc(w.name) + '">Remove</button></div>';
      }).join("") + '</div>' : '<div class="panel"><p class="muted">Nothing here yet. Import your Google Maps saved places to fill it up.</p></div>');
    main.onclick = function (e) {
      var b = e.target.closest("[data-wdel]"); if (!b) return;
      var l = want().slice(); l.splice(+b.dataset.wdel, 1); A().setMeta("wantToGo", l).then(viewWant);
    };
    document.title = "Want to go · Famstamp";
  }

  // ---------- help ----------
  function viewHelp() {
    main.innerHTML = back("#/import", "Import") + '<h1>Getting your files</h1>' +
      '<p class="lede small">Google now keeps Timeline on your phone, not online, so the export comes from the phone itself. Older trips (before 2024) may be in a Google Takeout download instead. Whichever you use, the file is read right here and never uploaded.</p>' +
      '<div class="panel imp-help"><h3>Android: Google Maps Timeline</h3><ol>' +
      '<li>Open your phone\'s <b>Settings</b> app.</li><li>Tap <b>Location</b>, then <b>Location services</b>, then <b>Timeline</b>.</li>' +
      '<li>Tap <b>Export Timeline data</b>, then <b>Continue</b>.</li><li>Pick a place to save it and tap <b>Save</b>. You\'ll get a file called <b>Timeline.json</b>.</li>' +
      '<li>Come back here, tap <b>Choose files</b> and pick Timeline.json.</li></ol><p class="small muted">Menu names vary a little between phone makers. If you don\'t see Timeline under Location services, search Settings for "Timeline".</p></div>' +
      '<div class="panel imp-help"><h3>iPhone: Google Maps Timeline</h3><ol>' +
      '<li>Open the <b>Google Maps</b> app and tap your profile picture.</li><li>Tap <b>Settings</b>, then <b>Location &amp; Privacy</b>.</li>' +
      '<li>Tap <b>Export Timeline data</b> and save it to <b>Files</b>. The file is called <b>location-history.json</b>.</li>' +
      '<li>Come back here, tap <b>Choose files</b> and pick it from Files.</li></ol><p class="small muted">The iPhone file is laid out differently from Android\'s. We read both.</p></div>' +
      '<div class="panel imp-help"><h3>Google Takeout (older history, saved places, photos)</h3><ol>' +
      '<li>On a computer, go to <b>takeout.google.com</b>.</li><li>Click <b>Deselect all</b>, then check what you want: <b>Location History (Timeline)</b>, <b>Maps (your places)</b>, <b>Saved</b> or <b>Google Photos</b>.</li>' +
      '<li>Click <b>Next step</b>, keep the file type <b>.zip</b>, and click <b>Create export</b>. Google emails you when it\'s ready.</li>' +
      '<li>Download the zip file(s) and pick them all here. No need to unzip.</li></ol>' +
      '<p class="small muted">Location History in Takeout stopped updating when Google moved Timeline onto phones, so for recent trips use the phone export above. Big Photos exports come in several zips plus a small one with just a table of contents (archive_browser.html); add the big ones too.</p></div>' +
      '<div class="panel imp-help"><h3>📷 From your photos</h3>' +
      '<p class="small"><b>Google Photos (best for big libraries):</b> make a Takeout export of Google Photos and pick all the zips here. We read the small info file that sits next to each photo and just the first few KB of each photo (the part that says where and when it was taken), so even a 50 GB zip goes quickly. If you only see a file called archive_browser.html, that zip is just the table of contents; add the other zips from the same export.</p>' +
      '<p class="small"><b>Photos on this phone:</b> tap <b>Choose photos</b>. We read the location and date tucked inside each photo and skip the rest.</p>' +
      '<ul class="small"><li><b>iPhone:</b> in the photo picker, tap <b>Options</b> at the top and turn on <b>Location</b>, or the picker removes it before the app sees it.</li>' +
      '<li><b>Android:</b> if it opens the Photos picker, locations come through as blank. Choose <b>Browse</b> (or Files) in the menu and pick the photos from there; that path keeps the location.</li>' +
      '<li>A camera with no GPS (most Sony, Canon and kids\' cameras) still helps: each photo takes the place of a phone photo taken within 6 hours, or counts toward the trip on that day.</li></ul>' +
      '<p class="small"><b>Whose photos count?</b> Photos from your phone or any real camera, and Snapchat saves, count as yours. Photos someone shared with you in an album are left out. Screenshots, saved or downloaded pictures, and one-off photos far from anywhere else you went go in a separate <b>Did you actually go here?</b> list, unticked, so nothing gets a passport stamp unless you say so. You can mark a camera as not yours under <a href="#/import/cameras">My cameras</a>.</p>' +
      '<p class="small"><b>On a computer?</b> Our free script <a href="photos-takeout-to-locations.py" download><code>photos-takeout-to-locations.py</code></a> (Python 3, nothing to install) reads a folder of Takeout zips and writes a tiny <b>photo-locations.csv</b> (taken_at, lat, lng, camera, trust) you can pick here.</p></div>' +
      '<div class="panel imp-help"><h3>Other map files</h3><ul class="small">' +
      '<li><b>Google My Maps:</b> open the map, use the three-dot menu and <b>Export to KML/KMZ</b>.</li><li><b>Google Earth:</b> .kml or .kmz files.</li>' +
      '<li><b>GPX:</b> from hiking, biking and GPS apps. Each track becomes a trip with its real miles.</li>' +
      '<li><b>CSV:</b> columns for name, lat, lng and date (any order). <b>GeoJSON</b> points and lines work too.</li></ul></div>';
    document.title = "Import help · Famstamp";
  }

  // ---------- hooks for app.js ----------
  window.MLTL_IMPORT = {
    geo: mainThreadGeo,   // for where.js (a visit from a photo): offline place lookup
    route: function (h) {
      if (main.dataset.imp) { main.onclick = main.onchange = main.oninput = null; delete main.dataset.imp; }
      if (h[0] !== "import") return false;
      main.dataset.imp = "1";
      if (h[1] === "help") viewHelp(); else if (h[1] === "review") viewReview(); else if (h[1] === "done") viewDone(); else if (h[1] === "want") viewWant(); else if (h[1] === "cameras") viewCameras();
      else viewPick(h[1] === "for" ? h[2] : null);
      return true;
    },
    backupCard: function () {
      return '<div class="panel imp-card"><h3>🗺️ Import from Google Maps &amp; more</h3><p class="muted small">Bring in past trips from Google Maps Timeline, Google Photos, Takeout, KML or GPX files. Read on this phone, never uploaded.</p>' +
        '<div class="actions"><a class="btn btn-primary" href="#/import">Import trips</a><a class="btn btn-ghost" href="#/import/help">How it works</a></div>' +
        (A().state.meta.cameras ? '<p class="small"><a href="#/import/cameras">📸 My cameras</a></p>' : "") + '</div>';
    },
    emptyButton: function (k) { return '<a class="btn btn-ghost imp-empty" href="#/import/for/' + esc(k.id) + '">🗺️ Import your trips from Google Maps</a>'; }
  };
})();
