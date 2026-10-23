/* Famstamp: grandparent follow-along (Premium). #/follow is where a grown-up makes a private, read-only link for the
   people who follow the family (Grandma, an aunt, a friend), picks whose updates it shows, and can turn it off again.
   #/follow/<token> is the page that link opens: the newest stamps, trips and trip memories, nothing to edit, no sign-in.
   Needs Family Sync (the updates come from the family's shared copy) and the follow_links database update. */
(function () {
  "use strict";
  function A() { return window.MLTL_APP; }
  function C() { return window.FS_FOLLOW_CORE; }
  function SY() { return window.MLTL_SYNC && window.MLTL_SYNC.follow; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(at) { if (!at) return ""; var d = new Date(String(at).slice(0, 10) + "T12:00:00"); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
  function back(href, label) { return '<a class="back" href="' + href + '">← ' + esc(label) + '</a>'; }
  var ICON = { park: "🏞️", state: "🗺️", place: "🌍" };
  function notReady(e) {
    var m = String((e && e.message) || e || "");
    return /follow_(feed|links?)|create_follow_link|my_follow_links|PGRST202|Could not find the function|schema cache/i.test(m);
  }
  var NOT_READY = "Follow-along links aren't switched on for Famstamp yet. Your preview below is exactly what they'll see once they are.";

  // ---------- the updates (same drawing for the preview and the real page) ----------
  function dotFor(p) { return '<span class="dotp" style="--kid:' + esc(p.color || "#6f8f7a") + '" aria-hidden="true">' + esc(String(p.nickname || p.name || "?").charAt(0).toUpperCase()) + '</span>'; }
  function stampLine(list, feed) {
    return '<ul class="fstamps">' + list.map(function (v) {
      return '<li><span aria-hidden="true">' + ICON[v.kind] + '</span> ' + esc(A().placeName(v.kind, v.id)) + (v.jr ? ' <span class="fjr">Junior Ranger</span>' : "") +
        (feed && !v.everyone ? ' <span class="fwho">' + esc(C().names(feed, v.who)) + '</span>' : "") + '</li>';
    }).join("") + '</ul>';
  }
  function tripCard(feed, it) {
    var t = it.trip, T = window.WK_TRIPS, by = {}; feed.people.forEach(function (p) { by[p.id] = p; });
    var who = C().names(feed, it.who), mem = (T.MEM_PROMPTS || []).filter(function (p) { return t.memories && t.memories[p[0]]; });
    var moments = Object.keys(t.moments || {}).filter(function (id) { return by[id]; });
    var head = t.title ? esc(t.title) : esc(who) + " went to " + esc(t.place || t.to || "a new place");
    return '<article class="fupd ftrip"><div class="fwhen">' + esc(fmt(t.date) || "Recently") + '</div>' +
      '<h3><span aria-hidden="true">🧳</span> ' + head + '</h3>' + (t.title ? '<p class="small muted">' + esc(who) + ' · ' + esc(t.place) + '</p>' : "") +
      (it.stamps.length ? '<p class="fsub">New stamps on this trip</p>' + stampLine(it.stamps, feed) : "") +
      (mem.length ? '<dl class="fmem">' + mem.map(function (p) { return '<div><dt><span aria-hidden="true">' + p[2] + '</span> ' + esc(p[1]) + '</dt><dd>' + esc(t.memories[p[0]]) + '</dd></div>'; }).join("") + '</dl>' : "") +
      (moments.length ? '<ul class="fmoments">' + moments.map(function (id) { return '<li>' + dotFor(by[id]) + '<span><b>' + esc(by[id].nickname || by[id].name) + ':</b> ' + esc(t.moments[id]) + '</span></li>'; }).join("") + '</ul>' : "") +
      (t.memory ? '<p class="fnote">“' + esc(t.memory) + '”</p>' : "") + '</article>';
  }
  function stampCard(feed, it) {
    var n = it.stamps.length, who = C().names(feed, it.who), jr = it.stamps.filter(function (v) { return v.jr; }).length;
    return '<article class="fupd fst"><div class="fwhen">' + esc(fmt(it.at)) + '</div>' +
      '<h3><span aria-hidden="true">⭐</span> ' + esc(who) + ' got ' + (n === 1 ? "a new stamp" : n + " new stamps") + (jr ? ' <span class="small">and ' + (jr === 1 ? "a Junior Ranger badge" : jr + " Junior Ranger badges") + '</span>' : "") + '</h3>' +
      stampLine(it.stamps) + '</article>';
  }
  function updatesHTML(feed) {
    var items = C().updates(feed);
    if (!items.length) return '<div class="panel fempty"><p><b>No updates yet.</b></p><p class="small muted">New stamps and trips will show up here as soon as they\'re added.</p></div>';
    return '<div class="fupds">' + items.map(function (it) { return it.type === "trip" ? tripCard(feed, it) : stampCard(feed, it); }).join("") + '</div>';
  }
  function hello(feed) {
    var who = C().names(feed, feed.people.map(function (p) { return p.id; }));
    return '<div class="fhello"><span class="dots">' + feed.people.map(dotFor).join("") + '</span><div>' +
      '<h1>' + (feed.label ? "Hi " + esc(feed.label) + "!" : "Hello!") + '</h1>' +
      '<p class="lede small">Here\'s what ' + esc(who || "the family") + (feed.people.length === 1 ? " has" : " have") + ' been up to: new stamps, trips and trip memories' + (feed.family ? ' from ' + esc(feed.family) : "") + '.</p></div></div>';
  }

  // ---------- #/follow/<token>: the page Grandma opens ----------
  function cacheKey(token) { return "fs-follow-" + token.slice(0, 12); }
  function viewPublic(token) {
    var main = A().main; document.title = "Family updates · Famstamp"; document.body.classList.add("followview");
    if (!C().validToken(token)) { main.innerHTML = '<div class="panel"><h1>This link doesn\'t look right</h1><p class="muted">Check that the whole link was copied, or ask the family to send it again.</p></div>'; return; }
    var saved = null; try { saved = JSON.parse(localStorage.getItem(cacheKey(token)) || "null"); } catch (e) {}
    function draw(feed, note) {
      main.innerHTML = hello(feed) + (note ? '<p class="small muted fnoteline">' + esc(note) + '</p>' : "") + updatesHTML(feed) +
        '<p class="small muted ffoot">This page is read-only and private to whoever has the link. Photos stay with the family. <a href="#/follow/' + esc(token) + '" id="frefresh">Check for new updates</a></p>';
      var r = document.getElementById("frefresh"); if (r) r.onclick = function (e) { e.preventDefault(); load(); };
    }
    function load() {
      if (!saved) main.innerHTML = '<div class="panel"><p class="muted">Loading the newest updates…</p></div>';
      var s = SY(); if (!s) return fail(new Error("unavailable"));
      s.open("follow_feed", { p_token: token }).then(function (raw) {
        var feed = C().clean(raw);
        if (!feed) { try { localStorage.removeItem(cacheKey(token)); } catch (e) {} main.innerHTML = '<div class="panel"><h1>This link has been turned off</h1><p class="muted">The family turned this link off, or it was never finished. Ask them to send you a new one.</p></div>'; return; }
        if (feed.paused) { main.innerHTML = '<div class="panel"><h1>Updates are paused</h1><p class="muted">' + esc(feed.family || "The family") + '\'s follow-along page is part of Famstamp Premium, which isn\'t on right now. Nothing has been deleted; it\'ll be back when they turn it on again.</p></div>'; return; }
        try { localStorage.setItem(cacheKey(token), JSON.stringify({ at: Date.now(), feed: feed })); } catch (e) {}
        saved = { at: Date.now(), feed: feed }; draw(feed);
      }).catch(fail);
    }
    function fail(e) {
      if (saved && saved.feed) return draw(C().clean(saved.feed), "Couldn't get new updates just now, so this is the copy from " + new Date(saved.at).toLocaleString() + ".");
      main.innerHTML = '<div class="panel"><h1>Couldn\'t load the updates</h1><p class="muted">' + esc(notReady(e) ? "Follow-along pages aren't switched on yet. Try again a little later." : /offline/i.test(String(e && e.message)) ? "You're offline. Try again when you're connected." : "Something went wrong on our side. Try again in a minute.") + '</p><button type="button" class="btn btn-primary" id="fretry">Try again</button></div>';
      document.getElementById("fretry").onclick = load;
    }
    if (saved && saved.feed) draw(C().clean(saved.feed));
    load();
  }

  // ---------- #/follow: make and manage links ----------
  var links = null, linksErr = "", made = null;
  function viewManage() {
    var app = A(), M = window.MLTL, main = app.main, s = SY(), c = s && s.cfg(), on = !!(c && c.familyId);
    var acc = s ? s.access() : { unlocked: false, tier: "free", label: "Free" }, grown = !c || c.role !== "kid";
    document.title = "Grandparent follow-along · Famstamp";
    var people = app.state.kids, share = C().shareable(people), fol = M.followers(people);
    var pick = viewManage.pick && viewManage.pick.filter(function (id) { return share.some(function (p) { return p.id === id; }); });
    if (!pick || !pick.length) pick = C().defaultShare(people);
    viewManage.pick = pick;
    var forSel = viewManage.forId != null ? viewManage.forId : (fol[0] ? fol[0].id : "");
    var preview = C().fromLocal(people, app.state.trips, pick, { family: c && c.familyName, label: forSel ? C().labelFor(M.followers(people).filter(function (p) { return p.id === forSel; })[0]) : (viewManage.typed || "") });

    var form = '';
    if (!on) form = '<div class="panel"><h3>Turn on Family Sync first</h3><p class="small muted">The follow-along page shows your family\'s shared copy, so it needs Family Sync. It\'s free to turn on.</p><a class="btn btn-primary" href="#/sync">☁ Set up Family Sync</a></div>';
    else if (!grown) form = '<div class="panel"><p class="small muted">Ask a grown-up in the family to make a follow-along link.</p></div>';
    else if (!acc.unlocked) form = '<div class="panel"><span class="pchip">Premium</span><h3>Part of Famstamp Premium</h3><p class="small muted">Follow-along links come with Family Keeper. Your preview below shows what they\'d see.</p></div>';
    else form = '<div class="panel fform"><h3>Make a private link</h3>' +
      '<div class="field"><label for="ffor">Who\'s it for?</label><select id="ffor">' +
        fol.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === forSel ? " selected" : "") + '>' + esc(M.who(p)) + ' (' + esc(M.relLabel(p)) + ')</option>'; }).join("") +
        '<option value=""' + (!forSel ? " selected" : "") + '>Someone else…</option></select></div>' +
      (forSel ? "" : '<div class="field"><label for="fname">Their name</label><input id="fname" maxlength="40" placeholder="e.g. Grandma &amp; Grandpa" value="' + esc(viewManage.typed || "") + '"></div>') +
      (fol.length ? "" : '<p class="small muted">Tip: add Grandma as a person with the relationship "Grandparent" and she\'ll show up here.</p>') +
      '<fieldset class="field fwho"><legend>Whose updates?</legend>' + share.map(function (p) {
        return '<label class="check"><input type="checkbox" data-fp="' + esc(p.id) + '"' + (pick.indexOf(p.id) >= 0 ? " checked" : "") + '> ' + esc(M.who(p)) + '<span class="meta">' + esc(M.relLabel(p)) + '</span></label>';
      }).join("") + '</fieldset>' +
      '<div class="actions"><button type="button" class="btn btn-beacon" id="fmake">🔗 Make the link</button></div><p class="small muted" id="fmsg" role="status"></p>' +
      (made ? '<div class="fmade"><p><b>Your link for ' + esc(made.label || "them") + ' is ready.</b> Send it in a text or email.</p><input readonly id="flink" value="' + esc(C().linkURL(location.href, made.token)) + '" aria-label="Follow-along link">' +
        '<div class="actions"><button type="button" class="btn btn-primary" data-fcopy="' + esc(made.token) + '">Copy link</button>' + (navigator.share ? '<button type="button" class="btn" data-fshare="' + esc(made.token) + '">Share…</button>' : "") + '</div></div>' : "") +
      '</div>';

    var list = "";
    if (on && grown && acc.unlocked) {
      list = '<h2>Your links</h2><div class="panel flinks">' + (linksErr ? '<p class="small muted">' + esc(linksErr) + '</p>' : links == null ? '<p class="small muted">Loading…</p>' : !links.length ? '<p class="small muted">No links yet. Nothing is shared until you make one.</p>' :
        links.map(function (l) {
          var whose = l.person_ids.map(function (id) { var p = app.kidById(id); return p ? M.who(p) : ""; }).filter(Boolean);
          return '<div class="row flink"><span class="nm"><b>' + esc(l.label || "Follow-along link") + '</b><span>' + esc(M.joinNames(whose) || "") + ' · made ' + esc(fmt(l.created_at)) + (l.last_seen_at ? " · last opened " + esc(fmt(l.last_seen_at)) : " · not opened yet") + '</span></span>' +
            '<span class="flbtns"><button type="button" class="pill" data-fcopy="' + esc(l.token) + '" aria-label="Copy the link for ' + esc(l.label || "this link") + '">Copy</button><button type="button" class="pill fx" data-foff="' + esc(l.token) + '" aria-label="Turn off the link for ' + esc(l.label || "this link") + '">Turn off</button></span></div>';
        }).join("")) + '</div>';
    }

    main.innerHTML = back(on ? "#/sync" : "#/", on ? "Family" : "Home") + '<h1>Grandparent follow-along</h1>' +
      '<p class="lede">Send Grandma (or anyone who loves hearing about your trips) a private page with the newest stamps, trips and trip memories. It\'s read-only, nothing is shared until you make a link, and you can turn a link off any time.</p>' +
      '<p><span class="pchip">Premium · Family Keeper</span>' + (acc.unlocked && acc.tier !== "keeper" ? ' <span class="small muted">' + esc(acc.tier === "testing" ? "Unlocked for family testing" : acc.label) + '</span>' : "") + '</p>' +
      form + list +
      '<h2>What they\'ll see</h2><p class="small muted">A preview from what\'s on this phone. Photos, your home and your routes aren\'t shared.</p>' +
      '<div class="fpreview">' + hello(preview) + updatesHTML(preview) + '</div>';

    var ff = document.getElementById("ffor"); if (ff) ff.onchange = function () { viewManage.forId = ff.value; made = null; viewManage(); };
    var fn = document.getElementById("fname"); if (fn) fn.oninput = function () { viewManage.typed = fn.value; };
    main.querySelectorAll("[data-fp]").forEach(function (b) { b.onchange = function () {
      viewManage.pick = Array.prototype.filter.call(main.querySelectorAll("[data-fp]"), function (x) { return x.checked; }).map(function (x) { return x.dataset.fp; });
      viewManage(); var again = main.querySelector('[data-fp="' + b.dataset.fp + '"]'); if (again) again.focus();
    }; });
    var mk = document.getElementById("fmake"); if (mk) mk.onclick = function () {
      var msg = document.getElementById("fmsg"), ids = viewManage.pick, label = forSel ? C().labelFor(app.kidById(forSel)) : C().labelFor(null, viewManage.typed);
      if (!ids.length) { msg.textContent = "Tick at least one person to share."; return; }
      if (!label) { msg.textContent = "Add their name so you can tell your links apart."; if (fn) fn.focus(); return; }
      mk.disabled = true; msg.textContent = "Making your link…";
      s.call("create_follow_link", { p_family: c.familyId, p_person_ids: ids, p_label: label, p_follower: forSel || null }).then(function (l) {
        made = l; links = null; viewManage(); loadLinks(); var x = document.getElementById("flink"); if (x) x.scrollIntoView({ block: "center" });
      }).catch(function (e) { mk.disabled = false; msg.textContent = notReady(e) ? NOT_READY : String((e && e.message) || "That didn't work. Try again."); });
    };
    main.querySelectorAll("[data-fcopy]").forEach(function (b) { b.onclick = function () { copy(C().linkURL(location.href, b.dataset.fcopy)); }; });
    main.querySelectorAll("[data-fshare]").forEach(function (b) { b.onclick = function () { navigator.share({ title: "Our travel updates", text: "Here's a page with our newest trips and stamps:", url: C().linkURL(location.href, b.dataset.fshare) }).catch(function () {}); }; });
    main.querySelectorAll("[data-foff]").forEach(function (b) { b.onclick = function () {
      if (!confirm("Turn off this link? Anyone who has it won't see updates anymore. You can always make a new one.")) return;
      b.disabled = true;
      s.call("revoke_follow_link", { p_token: b.dataset.foff }).then(function () {
        if (made && made.token === b.dataset.foff) made = null;
        links = (links || []).filter(function (l) { return l.token !== b.dataset.foff; }); app.toast("Link turned off"); viewManage();
      }).catch(function (e) { b.disabled = false; app.toast(String((e && e.message) || "Couldn't turn it off. Try again.")); });
    }; });
    if (on && grown && acc.unlocked && links == null && !linksErr && !loadLinks.busy) loadLinks();
  }
  function loadLinks() {
    var s = SY(), c = s && s.cfg(); if (!c || !c.familyId) return;
    loadLinks.busy = true;
    s.call("my_follow_links", { p_family: c.familyId }).then(function (rows) { links = (rows || []).filter(function (l) { return !l.revoked_at; }); linksErr = ""; })
      .catch(function (e) { links = []; linksErr = notReady(e) ? NOT_READY : "Couldn't load your links just now."; })
      .then(function () { loadLinks.busy = false; if (/^#\/follow\/?$/.test(location.hash)) viewManage(); });
  }
  function copy(text) {
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { A().toast("Copied! Paste it in a text to Grandma."); }, function () {
      var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); A().toast("Copied!"); } catch (e) { prompt("Copy this link:", text); } t.remove();
    });
  }

  function view(token) { if (token) return viewPublic(token); links = null; linksErr = ""; return viewManage(); }
  window.FS_FOLLOW = { view: view, updatesHTML: updatesHTML };
})();
