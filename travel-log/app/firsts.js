/* Famstamp: Firsts, a keepsake timeline of each person's big travel firsts (#/p/<id>/firsts).
   Some are found on their own from the maps and trips (first national park, first Junior Ranger badge, first new state,
   first new country, first trip abroad, first flight); the rest are marked by hand (first road trip, first time at the
   ocean, first camping trip, ...) with a date, a place and an optional note. Hand-marked ones live on the person as
   person.firsts = { <kind>: { at, place, note, label? } } and sync with the rest of the person. Marking one of the
   found kinds by hand overrides what we found (for firsts from before Famstamp). The counting part runs in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trips-core.js"));
  else root.FS_FIRSTS = factory(root.WK_TRIPS);
})(typeof self !== "undefined" ? self : this, function (T) {
  "use strict";
  // [kind, emoji, title, found automatically?]
  var KINDS = [
    ["flight", "✈️", "First flight", 1], ["abroad", "🌍", "First trip abroad", 1], ["country", "🗺️", "First new country", 1],
    ["state", "📍", "First new state", 1], ["park", "🏞️", "First national park", 1], ["jr", "🎖️", "First Junior Ranger badge", 1],
    ["road", "🚗", "First road trip"], ["beach", "🌊", "First time at the ocean"], ["camp", "⛺", "First camping trip"],
    ["snow", "❄️", "First time in snow"], ["train", "🚆", "First train ride"], ["boat", "⛴️", "First boat ride"],
    ["hike", "🥾", "First big hike"], ["hotel", "🏨", "First hotel stay"], ["other", "⭐", "Something else"]];
  var BY = {}; KINDS.forEach(function (k) { BY[k[0]] = k; });
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  function str(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
  function kindOf(key) { return BY[key] || (/^x\d{1,3}$/.test(key) ? BY.other : null); }

  /** keep only known kinds (plus custom x1, x2, ...) with sane values */
  function clean(x) {
    var out = {}; if (!x || typeof x !== "object") return out;
    Object.keys(x).forEach(function (key) {
      var r = x[key]; if (!kindOf(key) || key === "other" || !r || typeof r !== "object") return;
      var o = { at: DATE.test(r.at || "") ? r.at : "", place: str(r.place, 80), note: str(r.note, 200) };
      if (/^x/.test(key)) { o.label = str(r.label, 40); if (!o.label) return; }
      out[key] = o;
    });
    return out;
  }
  function earliest(bag, test) {
    var best = null; Object.keys(bag || {}).forEach(function (id) { var v = bag[id], at = v && v.at;
      if (DATE.test(at || "") && (!test || test(id, v)) && (!best || at < best.at)) best = { id: id, at: at }; });
    return best;
  }
  function planeLeg(t) { return (t.route || []).filter(function (p, i) { return i > 0 && p.mode === "plane"; })[0] || (t.fly === "yes" ? {} : null); }
  function tripName(t) { var r = t.route || [], last = r.length > 1 ? r[r.length - 1] : null; return t.title || (last && last.name) || t.place || ""; }

  /** what we can tell from the maps and trips. ctx: { home: {country, region}, park(id), state(id), country(id) } names */
  function found(p, trips, ctx) {
    ctx = ctx || {}; var home = ctx.home || {}, hc = home.country || "USA", nm = function (f, id) { return (ctx[f] && ctx[f](id)) || id; }, out = {};
    var pk = earliest(p.parks, function (id) { return !/^(sp|nm|mem)-/.test(id); }); if (pk) out.park = { at: pk.at, place: nm("park", pk.id) };
    var jr = earliest(p.parks, function (id, v) { return v.jr && !/^sp-/.test(id); }); if (jr) out.jr = { at: jr.at, place: nm("park", jr.id), text: "Earned a Junior Ranger badge at " + nm("park", jr.id) };
    var st = earliest(p.states, function (id) { return !(hc === "USA" && id === home.region); }); if (st) out.state = { at: st.at, place: nm("state", st.id) };
    var co = earliest(p.places, function (id) { return id !== hc; }); if (co) out.country = { at: co.at, place: nm("country", co.id) };
    var mine = (trips || []).filter(function (t) { return (t.kidIds || []).indexOf(p.id) >= 0 && DATE.test(t.date || ""); })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var ab = mine.filter(function (t) { return T && T.crossesBorder ? T.crossesBorder(t.route, hc) : false; })[0];
    if (ab) out.abroad = { at: ab.date, place: tripName(ab) };
    var fl = mine.filter(planeLeg)[0];
    if (fl) { var leg = planeLeg(fl), d = leg.dep && leg.dep.code, a = leg.arr && leg.arr.code; out.flight = { at: fl.date, place: d && a ? d + " → " + a : tripName(fl) }; }
    return out;
  }
  /** the whole timeline, oldest first; undated hand-marked ones go last */
  function timeline(p, trips, ctx) {
    var auto = found(p, trips, ctx), mine = clean(p.firsts), rows = [];
    Object.keys(auto).forEach(function (key) { if (!mine[key]) rows.push({ key: key, auto: true, at: auto[key].at, place: auto[key].place, note: "", text: auto[key].text }); });
    Object.keys(mine).forEach(function (key) { var m = mine[key]; rows.push({ key: key, auto: false, at: m.at, place: m.place, note: m.note, label: m.label }); });
    rows.forEach(function (r) { var k = kindOf(r.key); r.emoji = k[1]; r.title = r.label ? "First " + r.label.replace(/^first\s+/i, "") : k[2]; });
    return rows.sort(function (a, b) { return (!a.at - !b.at) || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || (a.title < b.title ? -1 : 1); });
  }
  /** firsts in a given year across people, for the year card: [{ who, emoji, title }] */
  function forYear(people, trips, year, ctx) {
    var out = []; (people || []).forEach(function (p) { timeline(p, trips, ctx).forEach(function (r) { if (String(r.at).slice(0, 4) === String(year)) out.push({ who: p.name, emoji: r.emoji, title: r.title, at: r.at }); }); });
    return out.sort(function (a, b) { return a.at < b.at ? -1 : 1; });
  }
  function nextCustom(p) { var n = 1; while (p.firsts && p.firsts["x" + n]) n++; return "x" + n; }
  /** save a hand-marked first; returns the key */
  function mark(p, key, o) {
    if (key === "other") key = nextCustom(p);
    var c = clean({ [key]: o }); if (!c[key]) return null;
    p.firsts = clean(p.firsts); p.firsts[key] = c[key]; p.updatedAt = new Date().toISOString(); return key;
  }
  function unmark(p, key) { if (p.firsts && p.firsts[key]) { p.firsts = clean(p.firsts); delete p.firsts[key]; p.updatedAt = new Date().toISOString(); return true; } return false; }

  // ---------- v54: kid milestones (age-based), built from the firsts timeline, the maps, trip stamps and finished quests ----------
  var GOALS = [["state", "states", "📍", [5, 10, 13, 18]], ["park", "national parks", "🏞️", [5, 10, 18]]];
  function isNP(id) { return !/^(sp|nm|mem)-/.test(id); }
  /** First date each state / national park was stamped: { "state:WI": "2020-05-01" or "" (undated) } */
  function firstDates(p, ctx) {
    var out = {};
    function add(kind, id, at) { if (kind === "park" && !isNP(id)) return; var k = kind + ":" + id, d = DATE.test(at || "") ? at : ""; if (!(k in out) || (d && (!out[k] || d < out[k]))) out[k] = d; }
    Object.keys(p.states || {}).forEach(function (id) { add("state", id, p.states[id] && p.states[id].at); });
    Object.keys(p.parks || {}).forEach(function (id) { add("park", id, p.parks[id] && p.parks[id].at); });
    ((ctx && ctx.stamps && ctx.stamps(p)) || []).forEach(function (s) { if (s.kind === "state" || s.kind === "park") add(s.kind, s.area, s.date); });
    return out;
  }
  function ageAt(by, at) { return by && DATE.test(at || "") ? +at.slice(0, 4) - by : null; }
  function ageWords(n) { return n <= 0 ? "as a baby" : n === 1 ? "at age 1" : "at age " + n; }
  /** { done: [{ emoji, text, at }], next: [{ emoji, text, have, need }] } for a kid with a birth year; empty otherwise. today = "YYYY-MM-DD" */
  function milestones(p, trips, ctx, today) {
    var out = { done: [], next: [] }, by = +(p && p.birthYear); if (!by || (p.role && p.role !== "kid")) return out;
    today = DATE.test(today || "") ? today : new Date().toISOString().slice(0, 10);
    var ageNow = +today.slice(0, 4) - by;
    timeline(p, trips, ctx).forEach(function (r) { var a = ageAt(by, r.at); if (a == null || a < 0 || a > 25) return; out.done.push({ emoji: r.emoji, text: r.title + " " + ageWords(a), at: r.at, key: "first-" + r.key }); });
    var fd = firstDates(p, ctx);
    GOALS.forEach(function (g) {
      var dates = Object.keys(fd).filter(function (k) { return k.indexOf(g[0] + ":") === 0; }).map(function (k) { return fd[k]; });
      var shown = false;
      g[3].forEach(function (x) {
        // counts if stamped before the year they turned x; undated ones only count while they're still under x
        var before = dates.filter(function (d) { return d ? ageAt(by, d) < x : ageNow < x; }).sort();
        if (before.length >= x) { var dated = before.filter(Boolean); out.done.push({ emoji: "🏆", text: x + " " + g[1] + " before " + x + "!", at: dated.length >= x ? dated[x - 1] : "", key: g[0] + "-" + x }); }
        else if (!shown && ageNow < x) { shown = true; out.next.push({ emoji: g[2], text: x + " " + g[1] + " before " + x, have: before.length, need: x, yearsLeft: x - ageNow }); }
      });
    });
    var q = (ctx && ctx.quests && ctx.quests(p)) || [];
    var qd = q.filter(function (e) { return DATE.test(e.at || ""); }).sort(function (a, b) { return a.at < b.at ? -1 : 1; })[0];
    if (qd) out.done.push({ emoji: "🧭", text: "First quest finished " + ageWords(ageAt(by, qd.at)), at: qd.at, key: "quest" });
    out.done.sort(function (a, b) { return (!a.at - !b.at) || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0); });
    return out;
  }

  var core = { milestones: milestones, KINDS: KINDS, kindOf: kindOf, clean: clean, found: found, timeline: timeline, forYear: forYear, mark: mark, unmark: unmark };
  if (typeof document === "undefined") return core;

  // ---------- browser: #/p/<id>/firsts, #/p/<id>/firsts/add, #/p/<id>/firsts/edit/<key> ----------
  function A() { return window.MLTL_APP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ctx() {
    var M = window.MLTL, maps = window.MLTL_MAPS || {}, st = A().state, hp = st.meta.homePoint || {};
    function find(list, id) { var x = (list || []).filter(function (s) { return s.id === id; })[0]; return x && x.name; }
    return { home: { country: hp.country || "USA", region: hp.region || "" }, park: function (id) { var p = M && M.parkById && M.parkById(id); return p ? p.name : find(M && M.PARKS, id); },
             state: function (id) { return find(maps.us && maps.us.shapes, id); }, country: function (id) { return find(maps.world && maps.world.countries, id); },
             stamps: function (p) { var P = window.WK_PASSPORT; try { return P && P.stampsFor ? P.stampsFor(p, st.trips, { parkStates: M && M.PARK_STATES }) : []; } catch (e) { return []; } },
             quests: function (p) { try { return window.FS_QUESTS && window.FS_QUESTS.earned ? window.FS_QUESTS.earned(p) : []; } catch (e) { return []; } } };
  }
  function fmt(at) { if (!at) return "Date not set"; var d = new Date(at + "T12:00:00"); return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
  function list(k) { return timeline(k, A().state.trips, ctx()); }
  function view(k, sub, key) {
    var a = A(), main = a.main, base = "#/p/" + esc(k.id) + "/firsts";
    if (sub === "add" || sub === "edit") return form(k, sub === "edit" ? key : "");
    document.title = k.name + "'s firsts · Famstamp";
    var rows = list(k), ms = milestones(k, A().state.trips, ctx(), window.MLTL.today());
    var msHTML = ms.done.length || ms.next.length ? '<section class="panel milestones"><h3>🎂 Milestones</h3>' +
      (ms.done.length ? '<ul class="mslist">' + ms.done.map(function (m) { return '<li><span aria-hidden="true">' + m.emoji + '</span> ' + esc(m.text) + (m.at ? ' <span class="muted small">' + esc(fmt(m.at)) + '</span>' : "") + '</li>'; }).join("") + '</ul>' : "") +
      ms.next.map(function (m) { return '<div class="msnext"><p><span aria-hidden="true">' + m.emoji + '</span> Next up: <b>' + esc(m.text) + '</b> · ' + m.have + ' of ' + m.need + ' · ' + m.yearsLeft + (m.yearsLeft === 1 ? " year" : " years") + ' to go</p>' +
        '<div class="msbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + m.need + '" aria-valuenow="' + m.have + '"><i style="width:' + Math.round(100 * m.have / m.need) + '%"></i></div></div>'; }).join("") + '</section>' : "";
    main.innerHTML = a.shell(k, "stats", msHTML + '<div class="qhead"><h2>⭐ ' + esc(k.name) + '\'s firsts</h2><p class="muted">The big travel moments, in order. We spot some from your maps and trips. Add the rest yourself: the first road trip, the first time at the ocean, the first snow.</p></div>' +
      '<div class="actions"><a class="btn btn-primary" href="' + base + '/add">+ Add a first</a></div>' +
      (rows.length ? '<ol class="ftl">' + rows.map(function (r) {
        return '<li class="fitem' + (r.auto ? " auto" : "") + '"><span class="fbadge" aria-hidden="true">' + r.emoji + '</span><div class="fbody"><p class="fdate">' + esc(fmt(r.at)) + '</p><h3>' + esc(r.title) + '</h3>' +
          (r.text ? '<p class="fplace">' + esc(r.text) + '</p>' : r.place ? '<p class="fplace">' + esc(r.place) + '</p>' : "") + (r.note ? '<p class="fnote">' + esc(r.note) + '</p>' : "") +
          '<p class="fmeta">' + (r.auto ? '<span>Found from your ' + (r.key === "flight" || r.key === "abroad" ? "trips" : "map") + '</span>' : "") +
          '<a href="' + base + '/edit/' + esc(r.key) + '" aria-label="' + (r.auto ? "Change" : "Edit") + ' ' + esc(r.title) + '">' + (r.auto ? "Change" : "Edit") + '</a></p></div></li>'; }).join("") + '</ol>'
        : '<div class="empty fempty"><p class="big" aria-hidden="true">⭐</p><p>No firsts yet. Color in a park or a state, add a trip, or mark one yourself.</p></div>') +
      '<div class="actions"><a class="btn btn-ghost" href="#/p/' + esc(k.id) + '/stats">Back to badges</a></div>');
  }
  function form(k, key) {
    var a = A(), main = a.main, base = "#/p/" + k.id + "/firsts", mine = clean(k.firsts), auto = found(k, a.state.trips, ctx());
    var cur = key ? (mine[key] || auto[key] || null) : null; if (key && !kindOf(key)) { location.hash = base; return; }
    var title = key ? (mine[key] && mine[key].label ? "First " + mine[key].label : kindOf(key)[2]) : "";
    document.title = (key ? title : "Add a first") + " · Famstamp";
    var opts = KINDS.filter(function (x) { return x[0] === "other" || !mine[x[0]]; });
    main.innerHTML = a.shell(k, "stats", '<p class="qback"><a href="' + esc(base) + '">‹ ' + esc(k.name) + '\'s firsts</a></p>' +
      '<form class="fform" id="fform" novalidate><h2>' + (key ? esc(kindOf(key)[1] + " " + title) : "Add a first") + '</h2>' +
      (key ? "" : '<div class="field"><label for="fkind">What was the first?</label><select id="fkind">' + opts.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + " " + esc(x[2]) + '</option>'; }).join("") + '</select></div>' +
        '<div class="field" id="flabelf" hidden><label for="flabel">First what?</label><input type="text" id="flabel" maxlength="40" placeholder="e.g. ski lesson, lobster roll"></div>') +
      (key && mine[key] && mine[key].label ? '<div class="field"><label for="flabel">First what?</label><input type="text" id="flabel" maxlength="40" value="' + esc(mine[key].label) + '"></div>' : "") +
      '<div class="field"><label for="fat">When?</label><input id="fat" type="date" value="' + esc((cur && cur.at) || "") + '"></div>' +
      '<div class="field"><label for="fplace">Where?</label><input type="text" id="fplace" maxlength="80" value="' + esc((cur && cur.place) || "") + '" placeholder="e.g. Cape Cod"></div>' +
      '<div class="field"><label for="fnote">A note <span class="muted">(optional)</span></label><textarea id="fnote" rows="3" maxlength="200" placeholder="What do you want to remember?">' + esc((cur && cur.note) || "") + '</textarea></div>' +
      (key && auto[key] && !mine[key] ? '<p class="hint">We found this one from your ' + (key === "flight" || key === "abroad" ? "trips" : "map") + '. Change it if the real first was earlier.</p>' : "") +
      '<p class="err" id="ferr" hidden></p><div class="actions"><button class="btn btn-primary" type="submit">Save</button><a class="btn btn-ghost" href="' + esc(base) + '">Cancel</a>' +
      (key && mine[key] ? '<button type="button" class="btn btn-danger" id="fdel">' + (auto[key] ? "Use what we found" : "Remove") + '</button>' : "") + '</div></form>');
    var kind = main.querySelector("#fkind"), lf = main.querySelector("#flabelf");
    if (kind) kind.onchange = function () { lf.hidden = kind.value !== "other"; };
    var del = main.querySelector("#fdel");
    if (del) del.onclick = function () { unmark(k, key); a.saveKid(k); a.toast("Removed"); location.hash = base; };
    main.querySelector("#fform").onsubmit = function (e) {
      e.preventDefault();
      var kk = key || kind.value, lab = main.querySelector("#flabel"), err = main.querySelector("#ferr");
      if ((kk === "other" || /^x/.test(kk)) && !(lab && lab.value.trim())) { err.textContent = "Say what the first was, like “ski lesson”."; err.hidden = false; lab.focus(); return; }
      var at = main.querySelector("#fat").value;
      if (at && at > new Date().toISOString().slice(0, 10)) { err.textContent = "That date is in the future. Pick the day it happened."; err.hidden = false; return; }
      var saved = mark(k, kk, { at: at, place: main.querySelector("#fplace").value, note: main.querySelector("#fnote").value, label: lab ? lab.value : "" });
      if (!saved) { err.textContent = "That didn't save. Try again?"; err.hidden = false; return; }
      a.saveKid(k); a.toast("⭐ Added to " + k.name + "'s firsts"); location.hash = base;
    };
  }
  function card(k) {
    var n = list(k).length, nx = milestones(k, A().state.trips, ctx(), window.MLTL.today()).next[0];
    return '<a class="familycard qentry fentry" href="#/p/' + esc(k.id) + '/firsts"><span class="qemo" aria-hidden="true"><i>⭐</i></span><span><b>Firsts & milestones</b><span class="small muted">' +
      (n ? n + " first" + (n === 1 ? "" : "s") + " so far" : "First flight, first park, first snow") + (nx ? " · Next: " + esc(nx.text) + " (" + nx.have + "/" + nx.need + ")" : "") + '</span></span><span class="qgo" aria-hidden="true">›</span></a>';
  }
  core.view = view; core.card = card; core.ctx = ctx;
  return core;
});
