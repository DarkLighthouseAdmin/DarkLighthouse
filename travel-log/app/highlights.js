/* Famstamp: Highlights (#/highlights), the browser part. Grandparents get it as a tab; everyone in the family can open it
   from Family to see the reactions. Read-only: nothing here edits a map or a trip. Reactions go through MLTL_SYNC.hl. */
(function () {
  "use strict";
  var H = window.FS_HL_CORE; if (!H) return;
  function A() { return window.MLTL_APP; }
  function M() { return window.MLTL; }
  function X() { return window.MLTL_SYNC && window.MLTL_SYNC.hl; }
  function esc(s) { return M().esc(s); }
  var rows = null, status = "", fidSeen = "";
  function on() { var x = X(); return !!(x && x.on()); }
  function cfg() { var x = X(); return (x && x.cfg()) || {}; }
  function key() { return "mltl-rx-" + (cfg().familyId || ""); }
  function cached() {
    var fid = cfg().familyId || ""; if (fid !== fidSeen) { fidSeen = fid; rows = null; }
    if (rows) return rows; try { rows = JSON.parse(localStorage.getItem(key()) || "[]").filter(H.validRow); } catch (e) { rows = []; } return rows;
  }
  // v64: reactions tapped with no signal wait here and go up when the phone is back online
  function qkey() { return "mltl-rxq-" + (cfg().familyId || ""); }
  function queue() { try { return JSON.parse(localStorage.getItem(qkey()) || "[]"); } catch (e) { return []; } }
  function setQueue(q) { try { localStorage.setItem(qkey(), JSON.stringify(q.slice(-500))); } catch (e) {} }
  function enqueue(ref, emoji, add) { var q = queue().filter(function (x) { return !(x.ref === ref && x.emoji === emoji); }); q.push({ ref: ref, emoji: emoji, add: add }); setQueue(q); }
  function offlineErr(e) { return navigator.onLine === false || /offline|fetch|network|load failed/i.test(String(e && e.message)); }
  var flushing = null;
  function flush() {
    var x = X(); if (!x || !x.on() || flushing) return flushing || Promise.resolve();
    var q = queue(); if (!q.length) return Promise.resolve();
    flushing = q.reduce(function (p, op) {
      return p.then(function () { return x.react(op.ref, op.emoji, op.add); }).then(function () {
        setQueue(queue().filter(function (y) { return !(y.ref === op.ref && y.emoji === op.emoji && y.add === op.add); }));
      });
    }, Promise.resolve()).catch(function () {}).then(function () { flushing = null; if (window.MLTL_SYNC && window.MLTL_SYNC.countPending) window.MLTL_SYNC.countPending(0); });
    return flushing;
  }
  /** Server rows plus what's still waiting in the queue, so a reaction made offline doesn't blink away. */
  function withQueue(r) {
    var c = cfg();
    queue().forEach(function (op) {
      var has = r.some(function (x) { return x.item_ref === op.ref && x.emoji === op.emoji && x.user_id === c.userId; });
      if (op.add && !has) r = r.concat([{ family_id: c.familyId, item_ref: op.ref, user_id: c.userId, emoji: op.emoji, created_at: new Date().toISOString() }]);
      if (!op.add && has) r = r.filter(function (x) { return !(x.item_ref === op.ref && x.emoji === op.emoji && x.user_id === c.userId); });
    });
    return r;
  }
  function keep(r) { rows = r; try { localStorage.setItem(key(), JSON.stringify(r.slice(0, 2000))); } catch (e) {} }
  function me() { var c = A().state.meta.sync; return c && c.myPerson ? A().kidById(c.myPerson) : null; }
  /** Is the person using this phone a grandparent in this family? */
  function iAmGrand() { return on() && H.isGrand(me()); }
  function nameOf(uid) {
    var c = cfg(); if (uid && uid === c.userId) return "You";
    var m = (c.members || []).filter(function (x) { return x.user_id === uid; })[0], p = m && m.person_id && A().kidById(m.person_id);
    return p ? M().who(p) : (m && m.display_name) || "Someone";
  }
  function ctx() {
    var F = window.FS_FIRSTS, c = F && F.ctx ? F.ctx() : {}, SP = window.FS_SPOTS, st = A().state;
    return {
      name: function (kind, id) { if (kind === "spot") { var it = SP && SP.itemFor(id, st.kids); return it && it.name; } var f = c[kind]; return (f && f(id)) || id; },
      quests: function (p) { return window.FS_QUESTS ? window.FS_QUESTS.earned(p) : []; }, firsts: function (p) { return F ? F.timeline(p, st.trips, c) : []; },
      milestones: function (p) { return F ? F.milestones(p, st.trips, c, M().today()) : { done: [] }; },
      rewards: function (p) { return window.FS_REWARDS ? window.FS_REWARDS.earned(p) : []; }
    };
  }
  function items() { return H.feed(A().state.kids, A().state.trips, ctx(), { limit: 80 }); }
  function barHTML(ref) {
    var m = H.byItem(cached())[ref] || {}, uid = cfg().userId, line = H.whoLine(m, nameOf);
    if (status === "missing" || !on()) return line ? '<p class="rxwho small">' + esc(line) + '</p>' : "";
    return '<div class="rxbar" data-rx="' + esc(ref) + '">' + H.EMOJI.map(function (e) {
      var l = m[e[0]] || [], mine = l.indexOf(uid) >= 0;
      return '<button type="button" class="rx' + (mine ? " on" : "") + '" data-emo="' + e[0] + '" aria-pressed="' + mine + '" aria-label="' + esc(e[2]) + (l.length ? ", " + l.length : "") + '"><span aria-hidden="true">' + e[1] + '</span> <span class="rxl">' + esc(e[2]) + '</span>' + (l.length ? ' <small>' + l.length + '</small>' : "") + '</button>';
    }).join("") + '</div>' + (line ? '<p class="rxwho small">' + esc(line) + '</p>' : "");
  }
  function card(it) {
    var who = it.kidIds.map(A().kidById).filter(Boolean), names = M().joinNames(who.map(function (p) { return M().who(p); }));
    return '<article class="hlitem panel" data-ref="' + esc(it.ref) + '"><div class="hlhead"><span class="dots">' + who.map(function (p) { return '<span class="dotp" style="' + A().kidStyle(p) + '">' + A().initial(p) + '</span>'; }).join("") +
      '</span><span class="small"><b>' + esc(names) + '</b> · ' + esc(M().prettyDate(it.at)) + '</span></div>' +
      (it.photoId ? '<img alt="" class="hlphoto" data-photo="' + esc(it.photoId) + '">' : "") +
      '<h3><span aria-hidden="true">' + it.emoji + '</span> ' + esc(it.title) + '</h3>' + (it.detail ? '<p class="small muted">' + esc(it.detail) + '</p>' : "") +
      '<div class="rxwrap">' + barHTML(it.ref) + '</div></article>';
  }
  function view() {
    document.title = "Highlights · Famstamp";
    var main = A().main, list = items(), grand = iAmGrand();
    main.innerHTML = '<a class="back" href="#/">← Home</a><h1>✨ Highlights</h1><p class="lede small">' + (grand ? "The grandkids' newest stamps, badges, milestones, firsts and trips. Tap Love it, Wow, Bravo or Ha! to cheer them on." :
      "The kids' newest stamps, badges, milestones and trips, and who cheered.") + '</p>' +
      '<p class="small hllinks"><a class="tapline" href="#/recap">📬 This week\'s recap →</a> · <a class="tapline" href="#/cup">🏆 Cousin Cup</a> · <a class="tapline" href="#/postcards">💌 Postcards</a> · <a class="tapline" href="#/stations">📍 Stamp stations</a></p>' +
      (on() ? "" : '<div class="panel"><p class="small">Reactions work once this phone is in a family log. <a href="#/sync">Family Sync →</a></p></div>') +
      '<p class="small muted" id="rxnote"' + (status === "missing" ? "" : " hidden") + '>Reactions aren\'t switched on for this family log yet.</p>' +
      (list.length ? '<div class="hlfeed">' + list.map(card).join("") + '</div>' : '<div class="panel"><p class="muted">Nothing yet. When the kids get new stamps, badges or trips, they show up here.</p></div>') + tabs();
    A().fillPhotos(); bind(main); refresh();
  }
  function rebar(main) { main.querySelectorAll(".hlitem").forEach(function (a) { a.querySelector(".rxwrap").innerHTML = barHTML(a.dataset.ref); }); bind(main); var n = main.querySelector("#rxnote"); if (n) n.hidden = status !== "missing"; }
  function bind(main) {
    main.querySelectorAll(".rxbar [data-emo]").forEach(function (b) {
      b.onclick = function () {
        var ref = b.closest("[data-rx]").dataset.rx, c = cfg(), was = cached(), t = H.toggle(was, c.familyId, ref, b.dataset.emo, c.userId);
        if (t.on == null) return; keep(t.rows); rebar(main);
        X().react(ref, b.dataset.emo, t.on).catch(function (e) {
          if (offlineErr(e) && !(e && e.missing)) { enqueue(ref, b.dataset.emo, t.on); A().toast("Saved. It'll send when you're back online."); if (window.MLTL_SYNC && window.MLTL_SYNC.countPending) window.MLTL_SYNC.countPending(0); return; }
          keep(was); if (e && e.missing) status = "missing"; rebar(main); A().toast("Couldn't save that reaction. Try again when you're online."); });
      };
    });
  }
  var busy = null;
  /** Pull the family's reactions (quietly); re-draws open Highlights / trip pages. */
  function refresh() {
    var x = X(); if (!x || !x.on() || busy) return busy || Promise.resolve();
    busy = flush().then(function () { return x.list(); }).then(function (r) { status = "ok"; keep(withQueue((r || []).filter(H.validRow))); })
      .catch(function (e) { if (e && e.missing) status = "missing"; })
      .then(function () { busy = null; var main = A().main, h = location.hash; if (/^#\/(highlights|recap)/.test(h)) rebar(main); else if (/\/trip\//.test(h)) tripFill(main); else if (h === "#/" || h === "") homeFill(main); });
    return busy;
  }
  /** On a trip page: who reacted to it. */
  function tripLine(t) { return '<div class="rxtrip" data-rxt="' + esc("t:" + t.id) + '">' + lineFor("t:" + t.id) + '</div>'; }
  function lineFor(ref) { var l = H.whoLine(H.byItem(cached())[ref], nameOf); return l ? '<p class="small rxwho">💬 ' + esc(l) + '</p>' : ""; }
  function tripFill(main) { main.querySelectorAll("[data-rxt]").forEach(function (d) { d.innerHTML = lineFor(d.dataset.rxt); }); }
  /** Home: grandparents get a Highlights card; everyone else sees the newest reactions from the family (last 2 weeks). */
  function homeCard() {
    if (!on()) return "";
    if (iAmGrand()) { var n = items().length; return '<a class="panel familycard hlcard" href="#/highlights"><span class="fam-ic" aria-hidden="true">✨</span><span><h3>Highlights from the grandkids</h3><span class="small muted">' + (n ? n + " recent " + (n === 1 ? "thing" : "things") + " to see" : "New stamps, badges and trips show up here") + '</span></span></a>'; }
    return '<div id="rxhome">' + homeInner() + '</div>';
  }
  function homeInner() {
    var uid = cfg().userId, since = new Date(Date.now() - 14 * 864e5).toISOString(), mine = cached().filter(function (r) { return r.user_id !== uid && String(r.created_at) >= since; });
    if (!mine.length) return "";
    var by = {}; items().forEach(function (i) { by[i.ref] = i; });
    var refs = []; mine.slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).forEach(function (r) { if (by[r.item_ref] && refs.indexOf(r.item_ref) < 0) refs.push(r.item_ref); });
    if (!refs.length) return "";
    return '<a class="panel familycard hlcard" href="#/highlights"><span class="fam-ic" aria-hidden="true">💬</span><span><h3>New reactions</h3>' + refs.slice(0, 3).map(function (ref) {
      return '<span class="small">' + esc(by[ref].title) + ': ' + esc(H.whoLine(H.byItem(mine)[ref], nameOf)) + '</span><br>'; }).join("") + '<span class="small">See Highlights →</span></span></a>';
  }
  function homeFill(main) { var d = main.querySelector("#rxhome"); if (d) d.innerHTML = homeInner(); }
  /** The extra tab a grandparent gets (first in the bottom tabs). */
  function tabs() { return ""; }
  function tab(cur) { return iAmGrand() ? '<a href="#/highlights"' + (cur ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">✨</span>Highlights</a>' : ""; }
  window.FS_HL = { queued: function () { return on() ? queue().length : 0; }, flush: flush, enqueue: enqueue, offlineErr: offlineErr, card: card, bindBars: bind, rebar: rebar, ctx: ctx, cached: cached, keep: keep, cfg: cfg, nameOf: nameOf, on: on, view: view, refresh: refresh, tripLine: tripLine, homeCard: homeCard, tab: tab, iAmGrand: iAmGrand, items: items };
})();
