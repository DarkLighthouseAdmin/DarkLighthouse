/* Famstamp v55 "What's near me": stamps (parks, the state or country you're in) within about 30 miles.
   Opt-in and foreground only: we ask the phone for its location only when someone taps "Use my location", or, if they
   turned it on here, while Famstamp is open on Home during a trip's dates (and only if the phone already allows it, so
   it never pops up a prompt on its own). The location is kept in memory for a few minutes and is never saved or sent
   anywhere: it's matched against the place list that ships with the app. The matching is M.nearby in log-core.js. */
(function () {
  "use strict";
  var M = window.MLTL, T = window.WK_TRIPS, esc = M.esc;
  function A() { return window.MLTL_APP; }
  var last = null, lastAt = 0, autoDone = false;   // memory only
  var FRESH = 5 * 60 * 1000;

  function stateAt(pt) {
    try {
      var us = window.MLTL_MAPS && window.MLTL_MAPS.us, xy = T && T.project ? T.project(pt, "us") : null; if (!us || !xy) return "";
      var c = document.createElement("canvas").getContext("2d");
      for (var i = 0; i < us.shapes.length; i++) if (c.isPointInPath(new Path2D(us.shapes[i].d), xy[0], xy[1])) return us.shapes[i].id;
    } catch (e) {}
    return "";
  }
  function locate() {
    if (last && Date.now() - lastAt < FRESH) return Promise.resolve(last);
    return new Promise(function (res, rej) {
      if (!navigator.geolocation) return rej(new Error("nogeo"));
      navigator.geolocation.getCurrentPosition(function (p) { last = { lat: p.coords.latitude, lon: p.coords.longitude }; lastAt = Date.now(); res(last); },
        function (e) { rej(e); }, { enableHighAccuracy: false, maximumAge: FRESH, timeout: 15000 });
    });
  }
  function find(pt) {
    var ui = window.FS_UI, load = ui && ui.loadPlaces ? ui.loadPlaces().catch(function () { return null; }) : Promise.resolve(null);
    return load.then(function (d) { return M.nearby(pt, d, A().state.kids, M.NEAR_MILES, stateAt); });
  }
  function names(ids) { return A().travelerNames(ids); }
  function itemHTML(x) {
    var ic = x.kind === "park" ? "🏞️" : x.kind === "state" ? "📍" : "🌍";
    return '<li class="nearitem"><span class="nic" aria-hidden="true">' + ic + '</span><span><b>' + esc(x.name) + '</b>' +
      '<span class="muted small"> · ' + (x.miles ? x.miles + " mi away" : "you're here") + '</span><br>' +
      (x.who.length ? '<span class="small">✓ ' + esc(names(x.who)) + (x.who.length === A().state.kids.length ? "" : " · new for the others") + '</span>' : '<span class="newstamp">New stamp!</span>') + '</span></li>';
  }
  function resultHTML(r) {
    if (!r.items.length) return '<div class="panel"><p>No parks, states or countries to stamp within about ' + M.NEAR_MILES + ' miles' + (r.here ? " of " + esc(r.here.name) : "") + '.</p></div>';
    return (r.here ? '<p class="muted">Near ' + esc(r.here.name) + (r.here.country !== "USA" ? ", " + esc(r.here.countryName) : "") + '</p>' : "") + '<ul class="nearlist">' + r.items.map(itemHTML).join("") + '</ul>';
  }
  function activeTrip() { return M.onTripNow(A().state.trips, M.today())[0] || null; }
  function errText(e) {
    if (e && e.code === 1) return "Location is turned off for Famstamp. To use this, allow location for this site in your browser or phone settings, then try again.";
    if (e && e.message === "nogeo") return "This browser can't share a location.";
    return "Couldn't get your location just now. Try again in a moment, ideally outside or near a window.";
  }

  function view() {
    var a = A(), st = a.state, auto = !!st.meta.nearAuto, now = activeTrip();
    document.title = "What's near me · Famstamp";
    a.main.innerHTML = '<a class="back" href="#/">← Everyone</a><h1>📍 What\'s near me?</h1>' +
      '<div class="panel nearwhy"><p>We look for national parks and other parks, and the state or country you\'re in, within about ' + M.NEAR_MILES + ' miles, and show which ones are new stamps for your family.</p>' +
      '<p class="small"><b>About your location:</b> we only ask your phone for it when you tap the button below' + (auto ? ", or while Famstamp is open during a trip (you turned that on)" : "") +
      '. It stays on this phone: it isn\'t saved in your log, isn\'t synced and isn\'t sent anywhere. We match it against the place list already inside the app.</p>' +
      '<div class="actions"><button type="button" class="btn btn-beacon" id="neargo">📍 Use my location</button></div>' +
      '<label class="check small"><input type="checkbox" id="nearauto"' + (auto ? " checked" : "") + '> Also check when I open Famstamp during a trip (only while the app is open)</label></div>' +
      '<div id="nearout" aria-live="polite"></div>' +
      (now ? '<div class="actions"><button type="button" class="btn btn-ghost" data-quickstamp="' + esc(now.trip.kidIds.filter(a.kidById)[0] || "") + '|' + esc(now.trip.id) + '">Stamp a stop on ' + esc(M.tripLabel(now.trip)) + '</button></div>' : "");
    var out = document.getElementById("nearout"), go = document.getElementById("neargo");
    document.getElementById("nearauto").onchange = function (e) { a.setMeta("nearAuto", !!e.target.checked).then(function () { a.toast(e.target.checked ? "OK, we'll check during trips while the app is open" : "Turned off"); }); };
    go.onclick = function () {
      go.disabled = true; out.innerHTML = '<p class="muted">Finding where you are…</p>';
      locate().then(find).then(function (r) { out.innerHTML = resultHTML(r); }).catch(function (e) { out.innerHTML = '<p class="err">' + esc(errText(e)) + '</p>'; })
        .then(function () { go.disabled = false; });
    };
  }

  /** Home, during a trip, if they turned it on and the phone already allows location: one quiet check per app open. */
  function homeAuto() {
    var a = A(), el = document.getElementById("nearline");
    if (!el || autoDone || !a.state.meta.nearAuto || !activeTrip() || document.visibilityState !== "visible" || !navigator.permissions || !navigator.geolocation) return;
    autoDone = true;
    navigator.permissions.query({ name: "geolocation" }).then(function (p) {
      if (p.state !== "granted") return;
      return locate().then(find).then(function (r) {
        var fresh = r.items.filter(function (x) { return !x.who.length; });
        var line = document.getElementById("nearline"); if (!line || !r.items.length) return;
        var top = (fresh[0] || r.items[0]);
        line.innerHTML = '📍 Near you: <b>' + esc(top.name) + '</b>' + (top.miles ? " (" + top.miles + " mi)" : "") + (fresh.length ? " · new stamp!" : "") + ' <a class="tapline" href="#/near">See all</a>';
      });
    }).catch(function () {});
  }
  window.FS_NEAR = { view: view, homeAuto: homeAuto, stateAt: stateAt };
})();
