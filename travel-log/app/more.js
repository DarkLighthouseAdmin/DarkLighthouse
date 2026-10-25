/* v69: try-it sample family (demo mode), homeschool field-trip log with a printable PDF, time-capsule notes, a kid's move
   to their own login (13+, parent-approved), and "invite a family" referrals (design + tracking only, no billing). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_MORE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SUBJECTS = ["Science", "History", "Geography", "Nature", "Art", "Math", "Reading & writing", "Social studies", "Music", "PE & outdoors"];
  var DEMO_DB = "mltl-demo";
  // ---------- pure helpers ----------
  /** School year for a date: Aug 1 starts a new one. "2026-09-03" -> "2026-27". */
  function schoolYear(d) { var y = +String(d).slice(0, 4), m = +String(d).slice(5, 7); if (!y) return ""; var s = m >= 8 ? y : y - 1; return s + "-" + String(s + 1).slice(2); }
  function cleanField(f) {
    f = f || {}; var h = Math.round(Math.max(0, Math.min(24, parseFloat(f.hours) || 0)) * 4) / 4;
    return { on: !!f.on, subjects: (Array.isArray(f.subjects) ? f.subjects : []).filter(function (s) { return SUBJECTS.indexOf(s) >= 0; }), hours: h, learned: String(f.learned || "").replace(/[\u0000-\u0008]/g, "").slice(0, 1000) };
  }
  /** Field-trip rows for one kid and school year, oldest first, plus total hours. */
  function fieldLog(trips, kidId, year) {
    var rows = (trips || []).filter(function (t) { return !t.deletedAt && t.field && t.field.on && (t.kidIds || []).indexOf(kidId) >= 0 && (!year || schoolYear(t.date) === year); })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .map(function (t) { var f = cleanField(t.field); return { id: t.id, date: t.date, place: t.title || t.place || "", subjects: f.subjects, hours: f.hours, learned: f.learned }; });
    return { rows: rows, hours: rows.reduce(function (s, r) { return s + r.hours; }, 0) };
  }
  function years(trips) { var o = {}; (trips || []).forEach(function (t) { var y = schoolYear(t.date); if (y) o[y] = 1; }); return Object.keys(o).sort().reverse(); }
  /** A capsule is open when its date has come (phone's own date), or for "login" ones once the kid has their own login. */
  function capsuleOpen(c, kid, today) {
    if (!c) return false;
    if (c.unlock === "login") return !!(kid && kid.ownLogin);
    return !!c.date && String(today) >= c.date;
  }
  function cleanCapsule(c) {
    var d = /^\d{4}-\d{2}-\d{2}$/.test(c.date || "") ? c.date : "";
    return { id: String(c.id || ""), from: String(c.from || "").slice(0, 40), text: String(c.text || "").slice(0, 2000), unlock: c.unlock === "login" ? "login" : "date", date: c.unlock === "login" ? "" : d, createdAt: c.createdAt || new Date().toISOString() };
  }
  /** Old enough for their own login? Uses birth year; a parent still has to confirm. */
  function canGraduate(kid, year) { return !!(kid && kid.role === "kid" && kid.birthYear && (year || new Date().getFullYear()) - kid.birthYear >= 13); }
  /** The sample family: friendly, clearly fake names, no real places beyond public landmarks. */
  function sampleData(now) {
    var y = (now || new Date()).getFullYear(), at = new Date(now || Date.now()).toISOString();
    var kid = function (id, name, role, by, color) { return { id: id, name: name, role: role, birthYear: by, color: color, states: {}, places: {}, parks: {}, sample: true, createdAt: at, updatedAt: at }; };
    var pt = function (n, lat, lon, c, r) { return { name: n, kind: "city", lat: lat, lon: lon, country: c, region: r }; };
    var trip = function (id, date, title, route, ids, x) { return Object.assign({ id: id, kidIds: ids, place: title, title: title, date: date, endDate: "", from: "", stops: [], route: route, who: "", memory: "", mark: null, photoId: null, sample: true, createdAt: at, updatedAt: at }, x || {}); };
    var A = "person_sample0parent", B = "person_sample000kida", C = "person_sample000kidb", all = [A, B, C];
    return {
      kids: [kid(A, "Sam (sample grown-up)", "adult", null, "#e8a54b"), kid(B, "Juniper (sample)", "kid", y - 9, "#4b8be8"), kid(C, "Otis (sample)", "kid", y - 6, "#3f8f5a")],
      trips: [
        trip("trip_sample00000001", (y - 1) + "-07-12", "Sample: Grand Canyon road trip", [pt("Denver", 39.74, -104.99, "USA", "CO"), pt("Moab", 38.57, -109.55, "USA", "UT"), pt("Grand Canyon Village", 36.05, -112.14, "USA", "AZ")], all, { memory: "Otis counted 41 lizards.", field: { on: true, subjects: ["Science", "Geography"], hours: 5, learned: "How the river carved the canyon." } }),
        trip("trip_sample00000002", y + "-03-21", "Sample: Science museum day", [pt("Chicago", 41.88, -87.63, "USA", "IL")], [B, C], { memory: "Juniper's favorite: the coal mine.", field: { on: true, subjects: ["Science", "History"], hours: 3, learned: "How trains and mines worked." } }),
        trip("trip_sample00000003", y + "-06-02", "Sample: Beach weekend", [pt("San Diego", 32.72, -117.16, "USA", "CA")], all, { memory: "Sandcastle lost to the tide." })
      ]
    };
  }
  if (typeof document === "undefined") return { SUBJECTS: SUBJECTS, schoolYear: schoolYear, cleanField: cleanField, fieldLog: fieldLog, years: years, capsuleOpen: capsuleOpen, cleanCapsule: cleanCapsule, canGraduate: canGraduate, sampleData: sampleData, DEMO_DB: DEMO_DB };

  // ---------- browser ----------
  function A() { return window.MLTL_APP; }
  function B() { return window.FS_BRAND || { NAME: "Famstamp", CONTACT: {} }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmt(d) { if (!d) return ""; var t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function isDemo() { try { return sessionStorage.getItem("fs-demo") === "1"; } catch (e) { return false; } }
  function SYNC() { return window.MLTL_SYNC; }
  function myRole() { var s = SYNC(); var c = s && s.cup && s.cup.cfg(); return c ? c.role : null; }
  function kids() { return A().state.kids || []; }
  function stamp(x) { x.updatedAt = new Date().toISOString(); return x; }

  // ---------- demo mode ----------
  function startDemo() { try { sessionStorage.setItem("fs-demo", "1"); } catch (e) {} location.hash = "#/"; location.reload(); }
  function endDemo() {
    try { sessionStorage.removeItem("fs-demo"); } catch (e) {}
    var r = indexedDB.deleteDatabase(DEMO_DB); r.onsuccess = r.onerror = r.onblocked = function () { location.hash = "#/"; location.reload(); };
  }
  function seedDemo() {
    var a = A(); if (!isDemo() || a.dbName !== DEMO_DB || kids().length) return Promise.resolve();
    var d = sampleData();
    try { d.trips.forEach(function (t) { window.MLTL.applyTripMark(t, d.kids); }); } catch (e) {}   // color in their maps from the trips
    return Promise.all(d.kids.map(function (k) { return a.put("kids", k, true); }).concat(d.trips.map(function (t) { return a.put("trips", t, true); })))
      .then(function () { return a.setMeta("backupDismissedAt", new Date(Date.now() + 365 * 864e5).toISOString()); }).then(a.load).then(function () { a.route(); });
  }
  function demoBanner() {
    if (!isDemo() || document.getElementById("demobar")) return;
    document.body.classList.add("fsdemo");
    var el = document.createElement("div"); el.id = "demobar"; el.setAttribute("role", "status");
    el.innerHTML = '<span><b>Sample family.</b> Look around and tap anything. Nothing here is saved or shared.</span><button type="button" class="btn btn-sm btn-beacon" id="demoend">Start my own family</button>';
    document.body.insertBefore(el, document.body.firstChild);
    document.getElementById("demoend").onclick = endDemo;
  }

  // ---------- field-trip log ----------
  function fieldView(h) {
    var a = A(), ks = kids().filter(function (k) { return k.role === "kid"; }), kidId = h[1] || (ks[0] && ks[0].id) || "", ys = years(a.state.trips), yr = h[2] || ys[0] || schoolYear(today());
    var k = a.kidById(kidId), log = fieldLog(a.state.trips, kidId, yr);
    var mine = (a.state.trips || []).filter(function (t) { return !t.deletedAt && (t.kidIds || []).indexOf(kidId) >= 0 && schoolYear(t.date) === yr; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
    var html = '<a class="back noprint" href="#/">← Home</a><h1 class="noprint">🎒 Field-trip log</h1>';
    if (!ks.length) { a.main.innerHTML = html + '<div class="empty panel"><p>Add a kid first, then mark trips as field trips here.</p><a class="btn btn-primary" href="#/add">Add a kid</a></div>'; return; }
    html += '<p class="lede small noprint">For homeschool records: mark trips as field trips, pick subjects, hours and what you learned, then print or save it as a PDF.</p>' +
      '<div class="row noprint fieldpick"><div class="field"><label for="fkid">Kid</label><select id="fkid">' + ks.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === kidId ? " selected" : "") + '>' + esc(x.name) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="fyr">School year (Aug to Jul)</label><select id="fyr">' + (ys.indexOf(yr) < 0 ? ys.concat([yr]) : ys).map(function (y) { return '<option' + (y === yr ? " selected" : "") + '>' + esc(y) + '</option>'; }).join("") + '</select></div></div>';
    html += '<section class="fieldsheet"><h2>' + esc(B().NAME) + ' field-trip log: ' + esc(k ? k.name : "") + ', ' + esc(yr.replace("-", "–")) + '</h2>' +
      '<p class="small">' + log.rows.length + ' field trip' + (log.rows.length === 1 ? "" : "s") + ', ' + log.hours + ' hour' + (log.hours === 1 ? "" : "s") + ' total. Printed ' + esc(fmt(today())) + '.</p>' +
      (log.rows.length ? '<table class="fieldtable"><thead><tr><th scope="col">Date</th><th scope="col">Where</th><th scope="col">Subjects</th><th scope="col">Hours</th><th scope="col">What we learned</th></tr></thead><tbody>' +
        log.rows.map(function (r) { return '<tr><td>' + esc(fmt(r.date)) + '</td><td>' + esc(r.place) + '</td><td>' + esc(r.subjects.join(", ")) + '</td><td>' + r.hours + '</td><td>' + esc(r.learned) + '</td></tr>'; }).join("") + '</tbody></table>' : '<p class="muted">No field trips marked for this year yet. Tick “Field trip” on a trip below.</p>') +
      '<p class="small sig">Parent or teacher signature: ____________________________</p></section>' +
      '<div class="actions noprint"><button type="button" class="btn btn-primary" id="fprint"' + (log.rows.length ? "" : " disabled") + '>Print or save as PDF</button></div>' +
      '<h2 class="noprint">Trips this school year</h2>' + (mine.length ? mine.map(function (t) {
        var f = cleanField(t.field);
        return '<div class="panel noprint fieldtrip" data-ft="' + esc(t.id) + '"><label class="chk"><input type="checkbox" data-fon' + (f.on ? " checked" : "") + '> <b>Field trip:</b> ' + esc(t.title || t.place) + ' <span class="muted small">' + esc(fmt(t.date)) + '</span></label>' +
          '<div class="ftmore"' + (f.on ? "" : " hidden") + '><fieldset class="chips"><legend class="small">Subjects</legend>' + SUBJECTS.map(function (s) { return '<label class="chip"><input type="checkbox" data-fsub="' + esc(s) + '"' + (f.subjects.indexOf(s) >= 0 ? " checked" : "") + '> ' + esc(s) + '</label>'; }).join("") + '</fieldset>' +
          '<div class="field"><label for="fh_' + esc(t.id) + '">Hours</label><input id="fh_' + esc(t.id) + '" type="number" min="0" max="24" step="0.25" inputmode="decimal" data-fh value="' + (f.hours || "") + '"></div>' +
          '<div class="field"><label for="fl_' + esc(t.id) + '">What we learned</label><textarea id="fl_' + esc(t.id) + '" rows="2" maxlength="1000" data-fl>' + esc(f.learned) + '</textarea></div></div></div>';
      }).join("") : '<div class="empty panel noprint"><p>No trips for ' + esc(k ? k.name : "") + ' in ' + esc(yr) + '.</p><a class="btn btn-primary" href="#/p/' + esc(kidId) + '">Add a trip</a></div>');
    a.main.innerHTML = html;
    var go = function () { location.hash = "#/fieldtrips/" + encodeURIComponent(document.getElementById("fkid").value) + "/" + encodeURIComponent(document.getElementById("fyr").value); };
    document.getElementById("fkid").onchange = go; document.getElementById("fyr").onchange = go;
    document.getElementById("fprint").onclick = function () { document.title = B().NAME + " field-trip log " + (k ? k.name : "") + " " + yr; window.print(); };
    var t0;
    Array.prototype.forEach.call(a.main.querySelectorAll("[data-ft]"), function (box) {
      var save = function (redraw) {
        var t = (a.state.trips || []).filter(function (x) { return x.id === box.dataset.ft; })[0]; if (!t) return;
        t.field = cleanField({ on: box.querySelector("[data-fon]").checked, subjects: Array.prototype.filter.call(box.querySelectorAll("[data-fsub]"), function (c) { return c.checked; }).map(function (c) { return c.dataset.fsub; }), hours: box.querySelector("[data-fh]").value, learned: box.querySelector("[data-fl]").value });
        box.querySelector(".ftmore").hidden = !t.field.on;
        a.put("trips", stamp(t)).then(function () {
          if (!redraw) return;
          // v74: keep whatever someone is typing in another box when the page redraws (their words were being lost)
          var ae = document.activeElement, keep = ae && ae.id && a.main.contains(ae) && (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !/^(checkbox|radio)$/.test(ae.type))) ? { id: ae.id, v: ae.value, s: ae.selectionStart, e: ae.selectionEnd } : null;
          var y = window.scrollY; fieldView(h); window.scrollTo(0, y);
          var n = keep && document.getElementById(keep.id);
          if (n) { if (n.value !== keep.v) { n.value = keep.v; n.dispatchEvent(new Event("input", { bubbles: true })); } n.focus({ preventScroll: true }); try { n.setSelectionRange(keep.s, keep.e); } catch (x) {} }
        });
      };
      box.addEventListener("change", function () { save(true); });
      box.addEventListener("input", function (e) { if (e.target.matches("[data-fl],[data-fh]")) { clearTimeout(t0); t0 = setTimeout(function () { save(false); }, 600); } });
    });
  }

  // ---------- time capsules ----------
  function capsView() {
    var a = A(), ks = kids(), t = today(), mineId = (SYNC() && SYNC().cup && SYNC().cup.cfg() || {}).myPerson;
    var html = '<a class="back" href="#/">← Home</a><h1>⏳ Time capsules</h1><p class="lede small">Write a note to a kid that stays sealed until a date you pick, or until they get their own login. Sealed notes are hidden in the app (they aren\'t encrypted, so don\'t put passwords in them).</p>';
    if (!ks.length) { a.main.innerHTML = html + '<div class="empty panel"><p>Add someone first, then write them a note for the future.</p><a class="btn btn-primary" href="#/add">Add someone</a></div>'; return; }
    var any = false;
    ks.forEach(function (k) {
      (k.capsules || []).forEach(function (c) {
        any = true; var open = capsuleOpen(c, k, t);
        html += '<div class="panel capsule' + (open ? " open" : "") + '"><h3>' + (open ? "📬 " : "🔒 ") + 'To ' + esc(k.name) + (c.from ? ' <span class="muted small">from ' + esc(c.from) + '</span>' : "") + '</h3>' +
          (open ? '<p class="captext">' + esc(c.text).replace(/\n/g, "<br>") + '</p><p class="small muted">Written ' + esc(fmt(String(c.createdAt).slice(0, 10))) + '</p>'
                : '<p class="small">Sealed. Opens ' + (c.unlock === "login" ? "when " + esc(k.name) + " gets their own login" : "on " + esc(fmt(c.date))) + '.</p>') +
          (mineId === k.id ? "" : '<button type="button" class="btn btn-ghost btn-sm" data-cdel="' + esc(k.id + "|" + c.id) + '">Delete</button>') + '</div>';
      });
    });
    if (!any) html += '<div class="empty panel"><p>No time capsules yet.</p><p class="small muted">Ideas: a note for their 18th birthday, what they were like this year, or a letter to open when they get their own login.</p></div>';
    if (myRole() !== "kid") html += '<div class="panel"><h2>Write a new one</h2><div class="field"><label for="cto">To</label><select id="cto">' + ks.map(function (k) { return '<option value="' + esc(k.id) + '">' + esc(k.name) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="cfrom">From (shown on the note)</label><input id="cfrom" maxlength="40" placeholder="Mom"></div>' +
      '<div class="field"><label for="ctext">Your note</label><textarea id="ctext" rows="5" maxlength="2000"></textarea></div>' +
      '<fieldset><legend class="small">Opens</legend><label class="chk"><input type="radio" name="cun" value="date" checked> On a date <input type="date" id="cdate" aria-label="Opening date" min="' + t + '"></label>' +
      '<label class="chk"><input type="radio" name="cun" value="login"> When they get their own login</label></fieldset>' +
      '<p class="small err" id="cerr" hidden></p><button type="button" class="btn btn-primary" id="csave">Seal it</button></div>';
    a.main.innerHTML = html;
    Array.prototype.forEach.call(a.main.querySelectorAll("[data-cdel]"), function (b) {
      b.onclick = function () {
        var p = b.dataset.cdel.split("|"), k = a.kidById(p[0]); if (!k) return; var before = (k.capsules || []).slice();
        k.capsules = before.filter(function (c) { return c.id !== p[1]; }); var goneBefore = k.capsGone; k.capsGone = (k.capsGone || []).concat([p[1]]).slice(-200);
        a.saveKid(stamp(k)).then(function () { capsView(); if (window.FS_WHO && window.FS_WHO.undoToast) window.FS_WHO.undoToast("Time capsule deleted", function () { k.capsules = before; k.capsGone = goneBefore; a.saveKid(stamp(k)).then(capsView); }); });
      };
    });
    var sv = document.getElementById("csave"); if (!sv) return;
    sv.onclick = function () {
      var err = document.getElementById("cerr"), un = a.main.querySelector('[name="cun"]:checked').value, d = document.getElementById("cdate").value, txt = document.getElementById("ctext").value.trim();
      var bad = !txt ? "Write a note first." : un === "date" && !(d > t) ? "Pick a date after today." : "";
      if (bad) { err.textContent = bad; err.hidden = false; return; }
      var k = a.kidById(document.getElementById("cto").value);
      k.capsules = (k.capsules || []).concat([cleanCapsule({ id: "cap_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), from: document.getElementById("cfrom").value.trim(), text: txt, unlock: un, date: d })]);
      a.saveKid(stamp(k)).then(function () { a.toast("Sealed ⏳"); capsView(); });
    };
  }
  function capsuleHomeCard() {
    var t = today(), seen = {}; try { seen = JSON.parse(localStorage.getItem("fs-caps-seen") || "{}"); } catch (e) {}
    var ready = []; kids().forEach(function (k) { (k.capsules || []).forEach(function (c) { if (capsuleOpen(c, k, t) && !seen[c.id]) ready.push({ k: k, c: c }); }); });
    if (!ready.length) return "";
    return '<div class="panel capready"><h3>📬 A time capsule just opened</h3><p>For ' + esc(ready[0].k.name) + (ready.length > 1 ? " and " + (ready.length - 1) + " more" : "") + '.</p><a class="btn btn-primary" href="#/capsules" data-capseen="' + esc(ready.map(function (r) { return r.c.id; }).join(",")) + '">Read it</a></div>';
  }

  // ---------- own login for a kid (parent side) ----------
  function gradView(pid) {
    var a = A(), k = a.kidById(pid), s = SYNC();
    var html = '<a class="back" href="#/p/' + esc(pid) + '">← Back</a><h1>🎓 ' + esc(k ? k.name : "") + '\'s own login</h1>';
    if (!k) { a.main.innerHTML = html + '<p>Not found.</p>'; return; }
    var role = myRole();
    if (!s || !s.isOn()) { a.main.innerHTML = html + '<div class="panel"><p>Own logins need Family Sync, so the history can move with them.</p><a class="btn btn-primary" href="#/sync">Turn on Family Sync</a></div>'; return; }
    if (role !== "owner" && role !== "adult") { a.main.innerHTML = html + '<div class="panel"><p>A parent in the family sets this up.</p></div>'; return; }
    if (!canGraduate(k)) { a.main.innerHTML = html + '<div class="panel"><p>Own logins are for kids 13 and older. ' + (k.birthYear ? "" : "Add " + esc(k.name) + "'s birth year on their profile first.") + '</p></div>'; return; }
    a.main.innerHTML = html + '<div class="panel"><ul><li>' + esc(k.name) + ' signs in with their <b>own</b> Google account or email on their own phone.</li><li>All their stamps, trips and journals stay and move with them.</li><li>You keep the full family view, and they stay a kid member you can remove.</li><li>Time capsules set to “when they get their own login” open.</li></ul>' +
      '<label class="chk"><input type="checkbox" id="g13"> I\'m their parent or guardian, and ' + esc(k.name) + ' is 13 or older.</label>' +
      '<p class="small err" id="gerr" hidden></p><button type="button" class="btn btn-primary" id="gmake" disabled>Make a one-time code</button><div id="gout" aria-live="polite"></div></div>';
    var cb = document.getElementById("g13"), mk = document.getElementById("gmake");
    cb.onchange = function () { mk.disabled = !cb.checked; };
    mk.onclick = function () {
      mk.disabled = true; var c = s.cup.cfg();
      s.cup.rpc("create_graduation", { p_family: c.familyId, p_person: k.id, p_birth_year: k.birthYear, p_confirm13: true }).then(function (code) {
        if (code && code.missing) throw new Error("Own logins aren't switched on for Family Sync yet (the server part is waiting to be installed).");
        code = Array.isArray(code) ? code[0] : code;
        var link = location.origin + location.pathname + "#/grad/" + encodeURIComponent(code);
        document.getElementById("gout").innerHTML = '<p>Code: <b class="mono">' + esc(code) + '</b> (works once, for 3 days)</p><p class="small">On ' + esc(k.name) + '\'s phone, open: <span class="mono">' + esc(link) + '</span></p>';
      }).catch(function (e) { var el = document.getElementById("gerr"); el.textContent = (e && e.message) || "Couldn't make a code."; el.hidden = false; mk.disabled = false; });
    };
  }
  function personInject(pid) {
    var a = A(), k = a.kidById(pid); if (!k || a.main.querySelector(".gradcta")) return;
    var r = myRole(), bits = "";
    if (canGraduate(k) && SYNC() && SYNC().isOn() && (r === "owner" || r === "adult") && !k.ownLogin) bits += '<a class="tapline gradcta" href="#/graduate/' + esc(k.id) + '">🎓 Ready for their own login? (13+)</a>';
    if (k.role === "kid") bits += '<a class="tapline gradcta" href="#/fieldtrips/' + esc(k.id) + '">🎒 Field-trip log (homeschool)</a>';
    if (!bits) return; var el = document.createElement("p"); el.className = "small gradwrap noprint"; el.innerHTML = bits; a.main.appendChild(el);
  }
  // teen side, after redeeming: mark the profile as having its own login (syncs to the family, opens login capsules)
  function markOwnLogin() {
    var s = SYNC(), c = s && s.cup && s.cup.cfg(); if (!c || c.role !== "kid" || c.anonymous || !c.email || !c.myPerson) return;
    var k = A().kidById(c.myPerson); if (k && !k.ownLogin) { k.ownLogin = today(); A().saveKid(stamp(k)); }
  }

  // ---------- invite a family (referral design; no billing yet) ----------
  // v73: the reward comes from FS_BRAND.REFERRAL: both families get 1 free month of Premium, granted once payments are live.
  function refPromise() {
    var r = (B() && B().REFERRAL) || { REWARD: "1 free month of Premium", BOTH: true, LIVE: false };
    return "When they start their own family log, " + (r.BOTH ? "both families get " : "you get ") + r.REWARD + (r.LIVE ? "." : " once paid plans start. (Nothing is charged today.)");
  }
  function inviteView() {
    var a = A(), s = SYNC(), html = '<a class="back" href="#/">← Home</a><h1>💌 Invite another family</h1>' +
      '<p class="lede small">Know a family that travels? Send them your link. ' + esc(refPromise()) + '</p>';
    if (!s || !s.isOn() || myRole() !== "owner") { a.main.innerHTML = html + '<div class="panel"><p>Your family organizer can get your family\'s invite link here once Family Sync is on.</p></div>'; return; }
    a.main.innerHTML = html + '<div class="panel" id="refbox"><p>Getting your link…</p></div>';
    var c = s.cup.cfg();
    Promise.all([s.cup.rpc("my_referral_code", { p_family: c.familyId }), s.cup.rpc("my_referrals", { p_family: c.familyId })]).then(function (r) {
      if (r[0] && r[0].missing) throw new Error("Invites aren't switched on yet.");
      var code = Array.isArray(r[0]) ? r[0][0] : r[0], st = r[1] && !r[1].missing ? r[1] : { joined: 0 };
      var link = location.origin + location.pathname.replace(/app\/?.*$/, "app/") + "?ref=" + encodeURIComponent(code);
      document.getElementById("refbox").innerHTML = '<p>Your link: <span class="mono">' + esc(link) + '</span></p><button type="button" class="btn btn-primary" id="refshare">Share link</button>' +
        '<p class="small">' + (st.joined || 0) + ' famil' + ((st.joined || 0) === 1 ? "y has" : "ies have") + ' joined with your link.</p>';
      document.getElementById("refshare").onclick = function () {
        var r = B().REFERRAL, txt = "We keep our family travel stamps in " + B().NAME + ". Try it: " + link + (r && r.BOTH ? " (Start your family log with this link and we both get " + r.REWARD + (r.LIVE ? ".)" : " once paid plans start.)") : "");
        if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { a.toast("Link copied"); });
      };
    }).catch(function (e) { document.getElementById("refbox").innerHTML = '<p class="muted">' + esc(e.message || "Couldn't get your link.") + '</p>'; });
  }
  // remember ?ref= so a new organizer's family can be credited after they create it (sync.js calls FS_MORE.claimRef)
  try { var rm = /[?&]ref=([A-Za-z0-9-]{6,40})/.exec(location.search); if (rm) localStorage.setItem("fs-ref", rm[1]); } catch (e) {}
  function claimRef() {
    var s = SYNC(), c = s && s.cup && s.cup.cfg(), code = null; try { code = localStorage.getItem("fs-ref"); } catch (e) {}
    if (!code || !c || c.role !== "owner") return;
    s.cup.rpc("record_referral", { p_code: code, p_family: c.familyId }).then(function (r) { if (!(r && r.missing)) try { localStorage.removeItem("fs-ref"); } catch (e) {} }).catch(function () {});
  }

  // ---------- wiring ----------
  (window.FS_ROUTES = window.FS_ROUTES || []).push(function (h) {
    if (isDemo() && (h[0] === "sync" || h[0] === "join" || h[0] === "grad" || h[0] === "graduate" || h[0] === "invite")) { A().main.innerHTML = '<a class="back" href="#/">← Home</a><div class="panel"><h2>Not in the sample family</h2><p>Family Sync and invites work once you start your own family.</p><button class="btn btn-beacon" type="button" onclick="">Start my own family</button></div>'; A().main.querySelector("button").onclick = endDemo; return true; }
    if (h[0] === "fieldtrips") { fieldView(h); return true; }
    if (h[0] === "capsules") { capsView(); return true; }
    if (h[0] === "graduate") { gradView(h[1]); return true; }
    if (h[0] === "invite") { inviteView(); return true; }
    return false;
  });
  (window.FS_HOME_TOP = window.FS_HOME_TOP || []).push(function () {
    var out = capsuleHomeCard(), pend = null; try { pend = sessionStorage.getItem("fs-grad-code"); } catch (e) {}
    if (pend) out += '<div class="panel"><h3>🎓 Finish moving to your own login</h3><a class="btn btn-primary" href="#/grad/' + esc(pend) + '">Continue</a></div>';
    if (!kids().length && !isDemo()) out += '<div class="panel demotry"><h3>Just looking?</h3><p class="small">Try a sample family first. It stays on this screen and goes away when you start your own.</p><button type="button" class="btn btn-ghost" data-demo>Try a sample family</button></div>';
    return out;
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-demo],[data-capseen]"); if (!t) return;
    if (t.hasAttribute("data-demo")) { e.preventDefault(); startDemo(); }
    else { var seen = {}; try { seen = JSON.parse(localStorage.getItem("fs-caps-seen") || "{}"); } catch (x) {} t.dataset.capseen.split(",").forEach(function (id) { seen[id] = 1; }); try { localStorage.setItem("fs-caps-seen", JSON.stringify(seen)); } catch (x) {} }
  });
  function after() {
    setTimeout(function () {
      var a = A(); if (!a) return; demoBanner();
      var m = /^#\/p\/([^/]+)$/.exec(location.hash); if (m) personInject(decodeURIComponent(m[1]));
    }, 0);
  }
  window.addEventListener("hashchange", after);
  function start() {
    var m = document.getElementById("main"); if (m) new MutationObserver(after).observe(m, { childList: true });
    var tries = 0, w = setInterval(function () { var a = A(); if ((a && a.state && a.state.ready !== false && a.dbName) || ++tries > 40) { clearInterval(w); if (a) { seedDemo(); markOwnLogin(); claimRef(); } after(); } }, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);
  return { isDemo: isDemo, startDemo: startDemo, endDemo: endDemo, SUBJECTS: SUBJECTS, schoolYear: schoolYear, cleanField: cleanField, fieldLog: fieldLog, capsuleOpen: capsuleOpen, cleanCapsule: cleanCapsule, canGraduate: canGraduate, sampleData: sampleData, claimRef: claimRef };
});
