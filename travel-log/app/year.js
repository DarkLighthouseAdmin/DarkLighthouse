/* Famstamp: "Our <year> in stamps" (#/year, #/year/<personId>). A shareable card made on this device: counts, up to nine
   of the year's stamps and a map of the states from that year, drawn into a PNG on a <canvas>. Nothing is uploaded; Share
   uses the phone's own share sheet (Web Share), and Download saves the PNG. The counting part has no browser bits so it
   can be tested in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./passport-core.js"), require("./log-core.js"));
  else root.FS_YEAR = factory(root.WK_PASSPORT, root.MLTL);
})(typeof self !== "undefined" ? self : this, function (P, M) {
  "use strict";
  var CTX = { parkStates: M && M.PARK_STATES };

  function jr() { if (typeof window !== "undefined") return window.FS_JOURNAL || null; try { return require("./journal.js"); } catch (e) { return null; } }
  /** Every year that has at least one dated stamp or trip, newest first. */
  function years(people, trips) {
    var ys = {};
    (trips || []).forEach(function (t) { if (/^\d{4}/.test(t.date || "")) ys[t.date.slice(0, 4)] = 1; });
    P.familyStamps(people, trips, CTX).forEach(function (s) { if (/^\d{4}/.test(s.date || "")) ys[s.date.slice(0, 4)] = 1; });
    people.forEach(function (p) { Object.keys(p.parks || {}).forEach(function (id) { var at = p.parks[id] && p.parks[id].at; if (/^\d{4}/.test(at || "")) ys[at.slice(0, 4)] = 1; }); });
    return Object.keys(ys).sort().reverse();
  }

  /** What the family (or one person) collected in one year. A place counts once; parks colored in with a date count too. */
  function summary(people, trips, year) {
    year = String(year);
    var ids = people.map(function (p) { return p.id; }), seen = {}, stamps = [];
    P.familyStamps(people, trips, CTX).forEach(function (s) {
      if (String(s.date || "").slice(0, 4) !== year) return;
      var key = s.kind + ":" + s.area; if (seen[key]) return; seen[key] = 1; stamps.push(s);
    });
    people.forEach(function (p) {   // places colored in on the maps with a date count for that year too
      [["park", p.parks], ["state", p.states], ["place", p.places]].forEach(function (b) {
        Object.keys(b[1] || {}).forEach(function (id) {
          var v = b[1][id], at = (v && v.at) || ""; if (String(at).slice(0, 4) !== year || seen[b[0] + ":" + id]) return;
          seen[b[0] + ":" + id] = 1; stamps.push({ id: "y-" + b[0] + "-" + id, kind: b[0], area: id, date: String(at).slice(0, 10), who: [p.id] });
        });
      });
    });
    stamps.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var n = { state: 0, place: 0, park: 0 }, states = {};
    stamps.forEach(function (s) { n[s.kind] = (n[s.kind] || 0) + 1; if (s.kind === "state") states[s.area] = 1; });
    var tr = (trips || []).filter(function (t) { return !t.deletedAt && String(t.date || "").slice(0, 4) === year && (t.kidIds || []).some(function (id) { return ids.indexOf(id) >= 0; }); });
    // v52: miles, nights, flights, the farthest trip, and how many places were new to everyone (no earlier dated stamp)
    var T = M && M.T, miles = 0, nights = 0, flights = 0, far = null;
    tr.forEach(function (t) {
      var s = T && T.summary ? T.summary(t) : null; if (!s) return;
      miles += s.miles || 0; nights += s.nights || 0; flights += s.flights || 0;
      if (s.miles && (!far || s.miles > far.miles)) far = { id: t.id, miles: s.miles, label: M.tripLabel ? M.tripLabel(t).replace(/^\s*draft:\s*/i, "") : t.place };
    });
    var earlier = {};
    P.familyStamps(people, trips, CTX).forEach(function (s) { if (/^\d{4}/.test(s.date || "") && s.date.slice(0, 4) < year) earlier[s.kind + ":" + s.area] = 1; });
    people.forEach(function (p) { [["park", p.parks], ["state", p.states], ["place", p.places]].forEach(function (b) { Object.keys(b[1] || {}).forEach(function (id) { var at = String((b[1][id] && b[1][id].at) || ""); if (/^\d{4}/.test(at) && at.slice(0, 4) < year) earlier[b[0] + ":" + id] = 1; }); }); });
    var fresh = stamps.filter(function (s) { return !earlier[s.kind + ":" + s.area]; }).length;
    return { year: year, stamps: stamps, states: n.state, countries: n.place, parks: n.park, trips: tr.length, stateIds: Object.keys(states),
             miles: Math.round(miles), nights: nights, flights: flights, farthest: far, newPlaces: fresh,
             pick: stamps.slice(-9).reverse(),
             journal: jr() ? jr().yearBits(people, trips, year) : { pages: 0, quotes: [], bests: [] } };   // v63: the kids' journal pages   // the nine most recent
  }

  if (typeof document === "undefined") return { years: years, summary: summary };

  // ---------- screen ----------
  var esc = M.esc, main = document.getElementById("main"), lastBlob = null, lastURL = null;
  function A() { return window.MLTL_APP; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }
  function svgURL(svg) {
    if (svg.indexOf("xmlns=") < 0) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function stampName(s) {
    if (s.kind === "park") { var p = M.parkById(s.area); return p ? p.name : s.area; }
    if (s.kind === "state") { var st = window.MLTL_MAPS.us.shapes.filter(function (x) { return x.id === s.area; })[0]; return st ? st.name : s.area; }
    var c = window.MLTL_MAPS.world.countries.filter(function (x) { return x.id === s.area; })[0]; return c ? c.name : s.area;
  }
  function stampSub(s) {
    if (s.kind !== "park") return "";
    return M.parkSub(M.parkById(s.area));
  }
  function mapSVG(sum) {
    var u = window.MLTL_MAPS.us, on = {}; sum.stateIds.forEach(function (id) { on[id] = 1; });
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + u.w + ' ' + u.h + '">';
    u.shapes.forEach(function (p) { s += '<path d="' + p.d + '" fill="' + (on[p.id] ? "#e8a54b" : "#e9e2d2") + '" stroke="#7b8a93" stroke-width="1"/>'; });
    return s + '</svg>';
  }
  function km() { var a = A(); return a && a.state && a.state.meta && a.state.meta.units === "km"; }
  function distNum(mi) { return Math.round(km() ? mi * 1.609344 : mi); }
  function unitWord() { return km() ? "km" : "miles"; }
  function shortNum(n) { return n >= 100000 ? Math.round(n / 1000) + "k" : n >= 10000 ? (Math.round(n / 100) / 10) + "k" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  /** "12 nights away · 3 flights · 5 places new to us · Farthest: Rome" for the card and the page */
  function extraLine(sum) {
    var b = [];
    if (sum.nights) b.push(plural(sum.nights, "night") + " away");
    if (sum.flights) b.push(plural(sum.flights, "flight"));
    if (sum.newPlaces) b.push(sum.newPlaces + (sum.newPlaces === 1 ? " place" : " places") + " new to us");
    if (sum.farthest) b.push("Farthest: " + sum.farthest.label);
    if (sum.journal && sum.journal.pages) b.push(plural(sum.journal.pages, "journal page"));
    return b.join(" · ");
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  /** Draws the 1080x1350 card (a good size for phone sharing) and resolves with the canvas. */
  function people1(sum) { var w = {}; (sum.firsts || []).forEach(function (f) { w[f.who] = 1; }); return Object.keys(w).length === 1; }
  /** "Firsts: ✈️ first flight · 🏞️ first national park", cut to fit */
  function firstsLine(c, sum, one, max) {
    var f = sum.firsts || []; if (!f.length) return "";
    c.font = "700 34px Georgia, serif";
    var bits = f.map(function (x) { return x.emoji + " " + (one ? "" : x.who + "'s ") + (one ? x.title : x.title.charAt(0).toLowerCase() + x.title.slice(1)); }), line = "", used = 0;
    for (var i = 0; i < bits.length; i++) { var next = (line ? line + " · " : "") + bits[i], more = bits.length - i - 1, tail = more ? " +" + more : "";
      if (c.measureText(next + tail).width > max && line) { return line + " +" + (bits.length - used); } line = next; used++; }
    return line;
  }
  function draw(sum, title) {
    var W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var c = cv.getContext("2d");
    c.fillStyle = "#f7f3ea"; c.fillRect(0, 0, W, H);
    c.strokeStyle = "#16283a"; c.lineWidth = 6; rr(c, 30, 30, W - 60, H - 60, 28); c.stroke();
    c.fillStyle = "#16283a"; c.textAlign = "center";
    c.font = "700 72px Georgia, 'Times New Roman', serif"; c.fillText(title, W / 2, 140);
    c.font = "600 30px 'Helvetica Neue', Arial, sans-serif"; c.fillStyle = "#5b6b73";
    var bits = [[sum.trips, sum.trips === 1 ? "trip" : "trips"], [sum.states, sum.states === 1 ? "state" : "states"], [sum.countries, sum.countries === 1 ? "country" : "countries"], [sum.parks, sum.parks === 1 ? "park" : "parks"]];
    if (sum.miles) bits.push([shortNum(distNum(sum.miles)), unitWord()]);
    var colW = (W - 120) / bits.length;
    bits.forEach(function (b, i) {
      var x = 60 + colW * (i + 0.5);
      c.fillStyle = "#3f5f4c"; c.font = "700 76px Georgia, serif"; c.fillText(String(b[0]), x, 260);
      c.fillStyle = "#5b6b73"; c.font = "600 28px 'Helvetica Neue', Arial, sans-serif"; c.fillText(b[1], x, 300);
    });
    var hasMap = sum.stateIds && sum.stateIds.length, pick = hasMap ? sum.pick.slice(0, 6) : sum.pick;   // leave room for the map
    var jobs = pick.map(function (s) { return loadImg(svgURL(P.stampSVG(s, stampName(s), { sub: stampSub(s) }))); });
    jobs.push(hasMap ? loadImg(svgURL(mapSVG(sum))) : Promise.resolve(null));
    return Promise.all(jobs).then(function (imgs) {
      var map = imgs.pop(), n = imgs.length, cols = 3, sz = n > 6 ? 230 : n > 3 ? 250 : 290;
      var rows = Math.ceil(n / cols) || 0, top = 340, gx = (W - cols * sz) / (cols + 1);
      imgs.forEach(function (im, i) {
        if (!im) return;
        var r = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - r * cols), off = (W - inRow * sz - (inRow - 1) * gx) / 2;
        var x = off + col * (sz + gx), y = top + r * (sz + 16);
        c.save(); c.translate(x + sz / 2, y + sz / 2); c.rotate(((i * 37) % 11 - 5) * Math.PI / 180); c.globalAlpha = 0.95; c.drawImage(im, -sz / 2, -sz / 2, sz, sz); c.restore();
      });
      var fl = firstsLine(c, sum, people1(sum), W - 140);
      var mapTop = top + rows * (sz + 16) + 10, mapH = H - 130 - mapTop - (fl ? 70 : 0);
      if (map && mapH > 140) { var mw = Math.min(W - 160, mapH * 1000 / 620), mh = mw * 620 / 1000; c.drawImage(map, (W - mw) / 2, mapTop + (mapH - mh) / 2, mw, mh); }
      if (fl) { c.fillStyle = "#8a6a2f"; c.font = "800 22px 'Helvetica Neue', Arial, sans-serif"; c.fillText("⭐ FIRSTS THIS YEAR", W / 2, H - 186); c.fillStyle = "#3f5f4c"; c.font = "700 34px Georgia, serif"; c.fillText(fl, W / 2, H - 140); }
      var extra = extraLine(sum); if (extra) { c.fillStyle = "#5b6b73"; c.font = "600 26px 'Helvetica Neue', Arial, sans-serif"; c.fillText(extra, W / 2, H - 104); }
      c.fillStyle = "#16283a"; c.font = "700 30px Georgia, serif"; c.fillText("FAMSTAMP · STAMP EVERY TRIP", W / 2, H - 62);
      return cv;
    });
  }

  function view(personId) {
    var app = A(), st = app.state, one = personId && app.kidById(personId), people = one ? [one] : st.kids.slice();
    document.title = "Year in stamps · Famstamp";
    var ys = years(people, st.trips), now = String(new Date().getFullYear());
    var year = view.year && ys.indexOf(view.year) >= 0 ? view.year : (ys.indexOf(now) >= 0 ? now : ys[0] || now);
    var back = one ? "#/p/" + esc(one.id) + "/stats" : "#/";
    var who = '<div class="field"><label for="yr-who">Whose year</label><select id="yr-who"><option value="">The whole family</option>' +
      st.kids.map(function (k) { return '<option value="' + esc(k.id) + '"' + (one && one.id === k.id ? " selected" : "") + '>' + esc(window.MLTL.who(k)) + '</option>'; }).join("") + '</select></div>';
    var yearSel = ys.length > 1 ? '<div class="field"><label for="yr-year">Year</label><select id="yr-year">' + ys.map(function (y) { return '<option' + (y === year ? " selected" : "") + '>' + y + '</option>'; }).join("") + '</select></div>' : "";
    var sum = summary(people, st.trips, year);
    sum.firsts = window.FS_FIRSTS ? window.FS_FIRSTS.forYear(people, st.trips, year, window.FS_FIRSTS.ctx()) : [];
    var head = '<a class="back" href="' + back + '">← Back</a><h1>' + esc(year) + ' in stamps</h1>' +
      '<p class="lede">A card of the year to send to grandparents or post. It\'s made right here on your phone.</p><div class="yr-pick">' + who + yearSel + '</div>';
    if (!sum.stamps.length && !sum.trips) {
      main.innerHTML = head + '<div class="panel"><p>No dated stamps for ' + esc(year) + ' yet. Add a trip with a date, or stamp a place, and it shows up here.</p></div>';
      return bind(one);
    }
    main.innerHTML = head + '<div class="yr-card"><div class="yr-wait muted">Making your card…</div></div>' +
      '<div class="actions yr-actions"><button type="button" class="btn btn-beacon" id="yr-share" disabled>Share</button><button type="button" class="btn btn-ghost" id="yr-dl" disabled>Download</button></div>';
    bind(one);
    var title = one ? window.MLTL.who(one) + "'s " + year + " in stamps" : "Our " + year + " in stamps";
    draw(sum, title).then(function (cv) {
      cv.toBlob(function (blob) {
        if (!blob || !document.getElementById("yr-share")) return;
        if (lastURL) URL.revokeObjectURL(lastURL);
        lastBlob = blob; lastURL = URL.createObjectURL(blob);
        var box = main.querySelector(".yr-card"); box.innerHTML = '<img src="' + lastURL + '" alt="' + esc(title) + ': ' + plural(sum.trips, "trip") + ', ' + plural(sum.states, "state") + ', ' + plural(sum.countries, "country", "countries") + ', ' + plural(sum.parks, "park") + '">';
        var ex = extraLine(sum);
        box.insertAdjacentHTML("afterend", '<ul class="yr-facts">' + (sum.miles ? '<li><b>' + commas(distNum(sum.miles)) + '</b> ' + unitWord() + ' traveled</li>' : "") +
          (ex ? ex.split(" · ").map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") : "") +
          (sum.firsts && sum.firsts.length ? '<li>⭐ ' + esc(sum.firsts.map(function (f) { return f.title; }).join(", ")) + '</li>' : "") +
          (sum.journal && sum.journal.quotes.length ? sum.journal.quotes.map(function (q) { return '<li>😂 “' + esc(q.text) + '”' + (q.said ? ' (' + esc(q.said) + ')' : "") + '</li>'; }).join("") : "") +
          (sum.journal && sum.journal.bests.length ? '<li>🌟 ' + esc(sum.journal.bests[sum.journal.bests.length - 1].text) + '</li>' : "") + '</ul>');
        var fname = "famstamp-" + year + "-in-stamps.png", sh = document.getElementById("yr-share"), dl = document.getElementById("yr-dl");
        var file = typeof File === "function" ? new File([blob], fname, { type: "image/png" }) : null;
        var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
        sh.disabled = false; dl.disabled = false;
        if (!canShare) sh.hidden = true;
        sh.onclick = function () { navigator.share({ files: [file], title: title }).catch(function () {}); };
        dl.onclick = function () { var a = document.createElement("a"); a.href = lastURL; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); A().toast("Saved " + fname); };
      }, "image/png");
    });
  }
  function bind(one) {
    var w = document.getElementById("yr-who"), y = document.getElementById("yr-year");
    if (w) w.onchange = function () { location.hash = w.value ? "#/year/" + w.value : "#/year"; };
    if (y) y.onchange = function () { view.year = y.value; view(one ? one.id : ""); };
  }
  return { years: years, summary: summary, view: view, draw: draw };
});
