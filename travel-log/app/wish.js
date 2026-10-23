/* Famstamp v1.8 "Trips to plan": the family wishlist page (#/family/wishes) and its home card. Logic is in wish-core.js.
   Everything is saved on this device first (the people store), and Family Sync carries it with each person. */
(function () {
  "use strict";
  var W = window.FS_WISHES, M = window.MLTL, esc = M.esc;
  function A() { return window.MLTL_APP; }
  var main = document.getElementById("main"), pending = null, picked = null, results = [], qSeq = 0;
  function who(p) { return M.who(p); }
  function names(ids) {
    var n = ids.map(function (id) { return A().kidById(id); }).filter(Boolean).map(who);
    return n.length <= 2 ? n.join(" & ") : n.slice(0, -1).join(", ") + " & " + n[n.length - 1];
  }
  function voter() {
    var st = A().state, id = st.meta.wishAs || (st.meta.sync && st.meta.sync.myPerson) || "";
    return A().kidById(id) || st.kids.filter(function (k) { return k.role !== "kid"; })[0] || st.kids[0] || null;
  }
  function save(p) { p.updatedAt = new Date().toISOString(); return A().saveKid(p); }
  function plural(n, a, b) { return n + " " + (n === 1 ? a : (b || a + "s")); }
  function kindIc(w) { return w.kind === "park" ? "🏞️" : w.kind === "area" ? (w.area.indexOf("state:") === 0 ? "🗺️" : "🌍") : "📍"; }
  function fmtDay(s) { try { return new Date(s + "T12:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" }); } catch (e) { return s; } }

  function card() {
    var st = A().state; if (!st.kids.length) return "";
    var L = W.list(st.kids, st.trips, M.today()), top = L.open[0];
    return '<a class="panel familycard wishcard" href="#/family/wishes"><span class="fam-ic" aria-hidden="true">🌠</span><span><h3>Trips to plan</h3><span class="muted small">' +
      esc(top ? "Top pick: " + top.w.name + " · " + plural(top.votes.length, "vote") + (L.open.length > 1 ? " · " + L.open.length + " dream places" : "") : "Everyone adds the places they dream of going, then you vote") +
      '</span><br><span class="small">' + (L.made.length ? "🎉 " + L.made.length + " made it · " : "") + 'Add a place, vote and react →</span></span></a>';
  }

  function itemHTML(e, me, i) {
    var w = e.w, mine = me && e.votes.indexOf(me.id) >= 0, owner = A().kidById(e.owner);
    var reacts = W.REACTIONS.map(function (emo) {
      var ids = e.reacts[emo] || [], on = me && ids.indexOf(me.id) >= 0;
      return '<button type="button" class="wreact" data-wreact="' + esc(w.id) + '|' + emo + '" aria-pressed="' + !!on + '" title="' + esc(ids.length ? names(ids) : "React") + '">' +
        '<span aria-hidden="true">' + emo + '</span>' + (ids.length ? '<b>' + ids.length + '</b>' : "") + '</button>';
    }).join("");
    var made = e.made;
    return '<li class="wish' + (made ? " made" : "") + '" data-wish="' + esc(w.id) + '">' +
      '<div class="wtop">' + (made ? '<span class="wrank wdone" aria-hidden="true">🎉</span>' : '<span class="wrank" aria-label="Number ' + (i + 1) + '">' + (i + 1) + '</span>') +
      '<div class="wname"><h3><span aria-hidden="true">' + kindIc(w) + '</span> ' + esc(w.name) + '</h3>' + (w.sub ? '<span class="muted small">' + esc(w.sub) + '</span>' : "") + '</div>' +
      '</div>' +
      (w.note ? '<p class="wnote">“' + esc(w.note) + '”' + (owner ? ' <span class="muted small">— ' + esc(who(owner)) + '</span>' : "") + '</p>' : (owner ? '<p class="muted small wby">Added by ' + esc(who(owner)) + '</p>' : "")) +
      (made ? '<p class="wmadeline"><b>Made it!</b> ' + esc(made.how === "trip" ? "Went " + fmtDay(made.at) : "Stamped" + (made.at ? " " + fmtDay(made.at) : "")) +
        (made.who && made.who.length ? " · " + esc(names(made.who)) : "") + (made.trip && made.who && made.who[0] ? ' · <a href="#/p/' + esc(made.who[0]) + '/trip/' + esc(made.trip) + '">See the trip</a>' : "") + '</p>'
        : '<p class="wwho">' + (e.votes.length ? '<span class="wav">' + A().avatars(e.votes) + '</span> <span class="small">' + esc(names(e.votes)) + (e.votes.length === 1 ? " wants" : " want") + ' to go</span>' : '<span class="muted small">No votes yet</span>') + '</p>' +
        '<div class="wreacts" role="group" aria-label="Reactions">' + reacts + '</div>' +
        '<div class="wact">' + (made ? "" : '<button type="button" class="wvote" data-wvote="' + esc(w.id) + '" aria-pressed="' + !!mine + '"><span aria-hidden="true">' + (mine ? "💖" : "🤍") + '</span> ' +
        (mine ? "I want to go" : "Me too!") + ' <b class="wcount">' + e.votes.length + '</b></button>') + '<button type="button" class="btn btn-beacon" data-wplan="' + esc(w.id) + '">✈️ Plan this trip</button><button type="button" class="btn btn-ghost small" data-wdel="' + esc(w.id) + '">Remove</button></div>') +
      '</li>';
  }

  function view() {
    var st = A().state; document.title = "Trips to plan · Famstamp";
    if (!st.kids.length) { main.innerHTML = '<a class="back" href="#/">← Everyone</a><h1>Trips to plan</h1><div class="panel"><p>Add the people in your family first, then everyone can add dream places.</p><a class="btn btn-primary" href="#/add">+ Add someone</a></div>'; return; }
    var me = voter(), L = W.list(st.kids, st.trips, M.today());
    var chips = st.kids.map(function (k) {
      return '<button type="button" class="wwhoami" data-wishas="' + esc(k.id) + '" aria-pressed="' + (me && me.id === k.id) + '" style="' + A().kidStyle(k) + '"><span class="dotp">' + A().initial(who(k)) + '</span>' + esc(who(k)) + '</button>';
    }).join("");
    main.innerHTML = '<a class="back" href="#/">← Everyone</a><section class="wishes"><h1>🌠 Trips to plan</h1>' +
      '<p class="lede">Everyone adds the places they dream of going. One vote each, plus as many reactions as you like. When you go, it moves to Made it!</p>' +
      '<div class="panel wme"><h2 class="small">Who\'s voting?</h2><div class="wwhorow" role="group" aria-label="Who\'s voting">' + chips + '</div></div>' +
      '<div class="panel wadd"><label for="wq"><b>' + esc(me ? who(me) : "") + ', where do you dream of going?</b></label>' +
      '<input id="wq" type="search" autocomplete="off" placeholder="A city, park, country or airport (MCO)" value="">' +
      '<ul class="wres" id="wres" role="listbox" aria-label="Places"></ul>' +
      '<div class="wpicked" id="wpicked"' + (picked ? "" : " hidden") + '>' + (picked ? pickedHTML() : "") + '</div>' +
      '<label for="wnote" class="small">Why? (optional)</label><input id="wnote" type="text" maxlength="' + W.NOTE_MAX + '" placeholder="e.g. I want to see a real castle!">' +
      '<p class="err" id="werr" hidden></p><div class="actions"><button type="button" class="btn btn-primary" id="wadd"' + (picked ? "" : " disabled") + '>Add to our list</button></div></div>' +
      (L.open.length ? '<h2>Our list <span class="muted small">most votes first</span></h2><ol class="wlist" id="wlist">' + L.open.map(function (e, i) { return itemHTML(e, me, i); }).join("") + '</ol>'
        : '<div class="panel"><p class="muted">No dream places yet. Add the first one above!</p></div>') +
      (L.made.length ? '<h2>Made it! 🎉</h2><ul class="wlist wmade" id="wmade">' + L.made.map(function (e, i) { return itemHTML(e, me, i); }).join("") + '</ul>' : "") +
      '<p class="small muted">' + (window.MLTL_SYNC && window.MLTL_SYNC.isOn() ? "Saved on this phone and shared with your family log." : "Saved on this phone. Turn on Family Sync to vote from everyone's phones.") + '</p></section>';
    bind(me, L);
  }
  function pickedHTML() { return '<span aria-hidden="true">' + kindIc(picked) + '</span> <b>' + esc(picked.name) + '</b>' + (picked.sub ? ' <span class="muted small">' + esc(picked.sub) + '</span>' : "") + ' <button type="button" class="btn btn-ghost small" id="wunpick">Change</button>'; }
  function showResults() {
    var ul = document.getElementById("wres"); if (!ul) return;
    ul.innerHTML = results.map(function (p, i) {
      return '<li><button type="button" data-wpick="' + i + '" role="option"><span aria-hidden="true">' + kindIc(p) + '</span> ' + esc(p.name) + (p.sub ? ' <span class="muted small">' + esc(p.sub) + '</span>' : "") + '</button></li>';
    }).join("");
  }
  function bind(me, L) {
    var st = A().state, q = document.getElementById("wq"), all = L.open.concat(L.made);
    function byId(id) { return all.filter(function (e) { return e.w.id === id; })[0]; }
    function err(m) { var e = document.getElementById("werr"); if (e) { e.textContent = m; e.hidden = !m; } }
    q.oninput = function () {
      var v = q.value, seq = ++qSeq;
      if (v.trim().length < 2) { results = []; showResults(); return; }
      if (!window.FS_UI || !window.FS_UI.findPlaces) return;
      window.FS_UI.findPlaces(v).then(function (r) { if (seq !== qSeq) return; results = r; showResults(); })
        .catch(function () { if (seq === qSeq) err("Couldn't load the place list. Check your connection and try again."); });
    };
    main.querySelector(".wishes").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.wishas) { A().setMeta("wishAs", b.dataset.wishas).then(view); return; }
      if (b.dataset.wpick != null) {
        picked = results[+b.dataset.wpick] || null; results = []; q.value = ""; showResults();
        var pk = document.getElementById("wpicked"); pk.innerHTML = picked ? pickedHTML() : ""; pk.hidden = !picked;
        document.getElementById("wadd").disabled = !picked; err(""); document.getElementById("wnote").focus(); return;
      }
      if (b.id === "wunpick") { picked = null; view(); setTimeout(function () { var x = document.getElementById("wq"); if (x) x.focus(); }, 0); return; }
      if (b.id === "wadd") {
        if (!me) return;
        try {
          var w = W.addWish(me, picked, document.getElementById("wnote").value, all, st.kids, new Date().toISOString());
          picked = null; b.disabled = true;
          save(me).then(function () { A().toast(w.name + " is on the list! 🌠"); view(); }).catch(function () { err("Couldn't save. Is the device out of space?"); });
        } catch (x) { err(x.message); }
        return;
      }
      if (b.dataset.wvote && me) { var on = W.toggleVote(me, b.dataset.wvote); save(me).then(function () { view(); if (on) A().toast("Vote counted! 💖"); }); return; }
      if (b.dataset.wreact && me) { var k = b.dataset.wreact.split("|"); W.toggleReact(me, k[0], k[1]); save(me).then(view); return; }
      if (b.dataset.wplan) {
        var e = byId(b.dataset.wplan); if (!e) return;
        pending = { stop: W.tripStop(e.w), who: e.votes.slice(), wish: e.w.id };
        var lead = (me && e.votes.indexOf(me.id) >= 0 ? me : A().kidById(e.votes[0])) || me || st.kids[0];
        location.hash = "#/p/" + lead.id + "/trips/new/all"; return;
      }
      if (b.dataset.wdel) {
        var d = byId(b.dataset.wdel); if (!d || !confirm("Take " + d.w.name + " off the list? Its votes go too.")) return;
        var owner = W.removeWish(st.kids, d.w.id); if (owner) save(owner).then(function () { view(); A().toast("Removed"); });
      }
    });
  }
  window.FS_WISH = { view: view, card: card, take: function () { var p = pending; pending = null; return p; } };
})();
