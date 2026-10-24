/* Famstamp: Family Sync (optional). The app works fully without it. When it's on, this phone keeps its own
   full copy in IndexedDB and trades changes with the family's shared copy in Supabase in the background.
   Supabase's library is only loaded once someone turns sync on or opens an invite. */
(function () {
  "use strict";
  var A = window.MLTL_APP, M = window.MLTL, S = window.MLTL_SYNCCORE, CFG = window.MLTL_SYNC_CONFIG || {}, esc = M.esc;
  if (!A || !S) return;
  var main = document.getElementById("main");
  // ?google=1 shows "Continue with Google" for this tab even while the flag is off (live testing); ?google=0 hides it again.
  var GOOGLE_TRY = (function () {
    try {
      var m = /[?&]google=([01])\b/.exec(location.search);
      if (m) {
        if (m[1] === "1") sessionStorage.setItem("mltl-google", "1"); else sessionStorage.removeItem("mltl-google");
        var q = location.search.replace(/([?&])google=[01]&?/, "$1").replace(/[?&]$/, "");
        history.replaceState(null, "", location.pathname + q + location.hash);
      }
      return sessionStorage.getItem("mltl-google") === "1";
    } catch (e) { return false; }
  })();
  var FLAGS = { testing: !!CFG.testing, google: !!CFG.google || GOOGLE_TRY, email: !!CFG.email };   // email codes need custom SMTP: off until then
  var ROLE_NAME = { owner: "Organizer", adult: "Grown-up", kid: "Kid" };

  // ---------- sync settings on this phone (meta "sync") ----------
  function cfg() { return A.state.meta.sync || null; }
  function on() { var c = cfg(); return !!(c && c.familyId); }
  function save(c) { noteLog(c); return A.setMeta("sync", c); }

  // ---------- family logs on this phone (one database each; see sync-core.js) ----------
  var HERE = A.dbName || S.DEFAULT_DB;
  function reg() { try { return S.readLogs(localStorage); } catch (e) { return S.cleanLogs(null); } }
  function regSave(r) { try { S.writeLogs(localStorage, r); } catch (e) {} renderChip(); return r; }
  function noteLog(c) {
    var r = reg(), l = S.findLog(r, HERE);
    if (!l) { r.logs.push({ db: HERE }); l = S.findLog(r, HERE); }
    S.updateLog(r, HERE, c && c.familyId ? { familyId: c.familyId, name: c.familyName || l.name || "", myPerson: c.myPerson || null, myName: c.myName || "" }
                                         : { familyId: null, myPerson: null });
    regSave(r);
  }
  /** Open another log: the page reloads so every screen starts fresh from that log's own data. */
  function switchTo(db, hash) {
    var r = reg(); if (!S.findLog(r, db)) return;
    r.active = db; regSave(r);
    var go = function () { history.replaceState(null, "", location.pathname + (hash || "#/")); location.reload(); };
    if (history.state && history.state.fsovl) { ovlOpen = false; window.addEventListener("popstate", go, { once: true }); history.back(); } else go();   // step off the open menu's Back entry first
  }
  /** A new, empty log for another family, then straight to creating or joining it there. */
  function newLogThen(hash, name) {
    var r = reg();
    if (S.linkedCount(r) >= S.MAX_FAMILIES) { A.toast("You can be in up to " + S.MAX_FAMILIES + " families. Leave one to add another."); return false; }
    var empty = r.logs.filter(function (l) { return !l.familyId && l.db !== S.DEFAULT_DB && l.db !== HERE; })[0];   // reuse an unused empty one
    var db = empty ? empty.db : S.addLog(r, name || "");
    regSave(r); switchTo(db, hash); return true;
  }
  function freshCfg(fid, uid, extra) {
    return Object.assign({ familyId: fid, userId: uid, familyName: "", role: "adult", plan: null, cursor: {}, shadow: S.emptyShadow(),
                           seen: {}, authors: {}, members: [], sharedTrip: false, lastSync: "" }, extra || {});
  }

  // ---------- remote: Supabase (or a stand-in for tests) ----------
  var remoteP = null;
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("offline")); }; document.head.appendChild(s); });
  }
  function friendly(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/anonymous sign-ins are disabled|Anonymous sign-ins are disabled/i.test(m)) return new Error("Family Sync isn't switched on for invites yet. Try again soon.");
    if (/Founders plan covers up to|people_cap/i.test(m)) return new Error("Your Founders plan covers up to " + ((m.match(/up to (\d+)/) || [])[1] || 10) + " people. Remove someone to add someone new.");
    if (/Too many open invites/i.test(m)) return new Error("This family has 10 open invites, the most it can have. Turn one off below, then make a new one.");
    if (/over_email_send_rate_limit|email rate limit|email.*too many|too many.*email|you can only request this/i.test(m)) return new Error("Too many emails were sent just now. Wait a few minutes and try again, or use an invite code.");
    if (/Failed to fetch|NetworkError|offline|Load failed/i.test(m)) return new Error("You're offline. Your log is safe on this phone; try again when you're connected.");
    if (/expired|invalid.*(otp|token)|Token has expired/i.test(m)) return new Error("That code didn't work or has expired. Ask for a new one.");
    if (/identity.*already|already linked|identity_already_exists/i.test(m)) return new Error("That Google account is already used with Famstamp on another phone. Open Family Sync there, or sign in with it here from \"I already set this up on another phone\".");
    if (/flow.?state|code.?verifier|code challenge|invalid flow|bad_code_verifier/i.test(m)) return new Error("Google sign-in started in a different app or browser, or took too long. Tap \"Try Google again\" and finish it without switching apps.");
    if (/access_denied|access denied|cancel/i.test(m)) return new Error("Google sign-in was cancelled or blocked by Google. Tap \"Try Google again\". If Google said \"Access blocked\", tell us so we can fix it.");
    if (/manual linking|provider is not enabled|Unsupported provider/i.test(m)) return new Error("Google sign-in isn't switched on yet. Use an invite code or email for now.");
    if (/exchange external code|server_error|unexpected_failure/i.test(m)) return new Error("Google said yes, but our sign-in server couldn't finish the hand-off with Google. That's a setup problem on our side, not your account. Nothing changed on this device; please try again a little later.");
    var rest = scrub(m.replace(/^.*?:\s*/, ""));
    return new Error(rest && /[a-z]{3,}\s+[a-z]{2,}/i.test(rest) ? rest : "Something went wrong. Try again.");
  }
  // One-time codes and tokens from Google or Supabase never reach the screen.
  function scrub(t) { return String(t || "").replace(/\b\d\/0[\w.\/-]*/g, "").replace(/[\w-]{24,}/g, "").replace(/[\w.-]+\.[\w-]+\.[\w-]{10,}/g, "").replace(/\s{2,}/g, " ").trim(); }
  function rxChk(r) {
    if (r && r.error) { var e = r.error, x = new Error(e.message || "reactions"); x.code = e.code; x.missing = e.code === "PGRST205" || e.code === "PGRST202" || e.code === "42P01" || e.code === "42883" || /schema cache|does not exist|Could not find the function/i.test(e.message || ""); throw x; }
    return r ? r.data : null;
  }
  function chk(r) { if (r && r.error) throw friendly(r.error); return r ? r.data : null; }
  function sbAdapter(sb) {
    var B = CFG.bucket || "trip-photos";
    function user(u) {
      if (!u) return null;
      var m = u.user_metadata || {};
      return { userId: u.id, email: u.email || u.new_email || "", anon: !!u.is_anonymous, name: u.is_anonymous ? "" : String(m.full_name || m.name || ""), avatar: u.is_anonymous ? "" : String(m.avatar_url || m.picture || "") };
    }
    return {
      // The account as Supabase really has it (getUser asks the server): anonymous or not, and whether Google is linked.
      whoami: function () {
        return sb.auth.getSession().then(function (r) {
          if (!r.data || !r.data.session) return null;
          return sb.auth.getUser().then(function (x) {
            var u = x.data && x.data.user;
            if (!u) { if (x.error && /fetch|network|offline|load failed/i.test(x.error.message || "")) throw x.error; return null; }
            var o = user(u), gi = (u.identities || []).filter(function (i) { return i.provider === "google"; })[0];
            o.google = !!gi && !u.is_anonymous;
            if (o.google && !o.email) o.email = String((gi.identity_data || {}).email || "");
            return o;
          });
        });
      },
      session: function () { return sb.auth.getSession().then(function (r) { return r.data && r.data.session ? user(r.data.session.user) : null; }); },
      signInAnon: function () { return sb.auth.signInAnonymously().then(chk).then(function (d) { return user(d.user); }); },
      sendCode: function (email, create) { return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: !!create, emailRedirectTo: location.origin + location.pathname } }).then(chk); },
      verifyCode: function (email, token, type) { return sb.auth.verifyOtp({ email: email, token: token, type: type || "email" }).then(chk).then(function (d) { return user(d.user); }); },
      addEmail: function (email) { return sb.auth.updateUser({ email: email }, { emailRedirectTo: location.origin + location.pathname }).then(chk); },
      signOut: function () { return sb.auth.signOut().catch(function () {}); },
      // Google: an anonymous member links Google to the same account (their families come along); anyone else signs in with it.
      google: function (kind) {
        var opts = { provider: "google", options: { redirectTo: location.origin + location.pathname } };
        return sb.auth.getSession().then(function (r) {
          var u = r.data && r.data.session && r.data.session.user;
          return kind === "link" && u && u.is_anonymous ? sb.auth.linkIdentity(opts) : sb.auth.signInWithOAuth(opts);
        }).then(chk);
      },
      // Back from Google with ?code=: swap it for a session here (not silently on load), so a failure is reported instead of
      // falling back to the old anonymous session and looking like it worked.
      finishOAuth: function (code) {
        if (!code) return sb.auth.getSession().then(function (r) { return r.data && r.data.session ? user(r.data.session.user) : null; });
        return sb.auth.exchangeCodeForSession(code).then(function (r) {
          if (r.error) throw friendly(r.error);
          var d = r.data || {}; return user(d.user || (d.session && d.session.user));
        });
      },
      rpc: function (fn, args) { return sb.rpc(fn, args || {}).then(chk); },
      cupRpc: function (fn, args) { return sb.rpc(fn, args || {}).then(rxChk); },   // v65 Cousin Cup: a missing function comes back as {missing:true}
      pull: function (table, fid, since) {
        var out = [];
        function page(from) {
          return sb.from(table).select("*").eq("family_id", fid).gt("server_at", since || "1970-01-01T00:00:00Z").order("server_at").range(from, from + 999).then(chk)
            .then(function (rows) { out = out.concat(rows || []); return rows && rows.length === 1000 ? page(from + 1000) : out; });
        }
        return page(0);
      },
      upsert: function (table, rows) {
        var key = table === "visits" ? "family_id,person_id,kind,place_id" : "family_id,id", jobs = Promise.resolve();
        for (var i = 0; i < rows.length; i += 400) (function (chunk) {
          jobs = jobs.then(function () { return sb.from(table).upsert(chunk, { onConflict: key, defaultToNull: false }).then(chk); });
        })(rows.slice(i, i + 400));
        return jobs;
      },
      family: function (fid) { return sb.from("families").select("*").eq("id", fid).maybeSingle().then(chk); },
      myFamilies: function (uid) { return sb.from("family_members").select("family_id, role, families(name)").eq("user_id", uid).then(chk); },
      // Highlights reactions (table public.reactions; RLS: family members read, people add/remove only their own).
      // A missing table comes back as {missing:true} so the app can hide the buttons until it exists.
      reactions: function (fid) { return sb.from("reactions").select("item_ref, user_id, emoji, created_at, family_id").eq("family_id", fid).order("created_at", { ascending: false }).limit(2000).then(rxChk); },
      react: function (fid, uid, ref, emoji, add) {
        var q = add ? sb.from("reactions").insert({ family_id: fid, user_id: uid, item_ref: ref, emoji: emoji })
                    : sb.from("reactions").delete().eq("family_id", fid).eq("user_id", uid).eq("item_ref", ref).eq("emoji", emoji);
        return q.then(function (r) { if (r && r.error && r.error.code === "23505") return null; return rxChk(r); });
      },
      // Web push: save this phone's subscription (RPC push_save) and ask the famstamp-push function for a test of each type.
      pushSave: function (a) { return sb.rpc("push_save", a).then(rxChk); },
      pushTest: function (endpoint) {
        return sb.functions.invoke(CFG.pushFunction || "famstamp-push", { body: { action: "test", endpoint: endpoint } }).then(function (r) {
          if (!r.error) return r.data;
          var st = r.error.context && r.error.context.status, x = new Error(r.error.message || "push test failed"); x.status = st; x.missing = st === 404 || /not found|failed to send a request/i.test(r.error.message || ""); throw x;
        });
      },
      members: function (fid) { return sb.from("family_members").select("*").eq("family_id", fid).order("joined_at").then(chk); },
      allInvites: function (fid) { return sb.from("invites").select("*").eq("family_id", fid).order("created_at", { ascending: false }).limit(40).then(chk); },
      invites: function (fid) { return sb.from("invites").select("*").eq("family_id", fid).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).then(chk); },
      updateMe: function (fid, uid, vals) { return sb.from("family_members").update(vals).eq("family_id", fid).eq("user_id", uid).then(chk); },
      updateFamily: function (fid, vals) { return sb.from("families").update(vals).eq("id", fid).then(chk); },
      linkPerson: function (fid, pid, uid) { return sb.from("people").update({ user_id: uid }).eq("family_id", fid).eq("id", pid).then(chk); },
      upload: function (path, blob, mime) { return sb.storage.from(B).upload(path, blob, { upsert: true, contentType: mime, cacheControl: "31536000" }).then(chk); },
      download: function (path) { return sb.storage.from(B).download(path).then(chk); },
      removeFiles: function (paths) { return paths.length ? sb.storage.from(B).remove(paths).then(chk) : Promise.resolve(); },
      listFiles: function (fid) { return sb.storage.from(B).list(fid, { limit: 1000 }).then(chk).then(function (l) { return (l || []).map(function (f) { return fid + "/" + f.name; }); }); }
    };
  }
  function remote() {
    if (window.MLTL_SYNC_REMOTE) return Promise.resolve(window.MLTL_SYNC_REMOTE);   // test stand-in
    if (!CFG.url || !CFG.key) return Promise.reject(new Error("Family Sync isn't set up in this version yet."));
    if (!remoteP) remoteP = (window.supabase ? Promise.resolve() : loadScript("vendor/supabase.js")).then(function () {
      return sbAdapter(window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce", storageKey: "mltl-auth" } }));
    }).catch(function (e) { remoteP = null; throw friendly(e); });
    return remoteP;
  }
  function ensureSession(r) {
    return r.session().then(function (s) { return s || r.signInAnon(); });
  }

  // ---------- status pill ----------
  var status = "off", statusMsg = "", pendingN = 0, pendT = null;
  /** v64: count what's waiting (edits since the last sync + reactions queued offline), then redraw the pill. Quietly. */
  function countPending(ms) {
    clearTimeout(pendT);
    pendT = setTimeout(function () {
      if (!on()) { pendingN = 0; offlineChip(); return; }
      var c = cfg(), rq = window.FS_HL && window.FS_HL.queued ? window.FS_HL.queued() : 0;
      snapshot().then(function (local) { var pl = S.planPush(local, c.shadow, c.familyId); if (!S.allows(S.access(c.plan, FLAGS), "photos")) pl.uploads = []; return S.pendingCount(pl); }).catch(function () { return pendingN; })
        .then(function (n) { var was = pendingN; pendingN = n + rq; if (was !== pendingN) setStatus(status, statusMsg); else offlineChip(); });
    }, ms == null ? 400 : ms);
  }
  /** A small banner while there's no signal: everything still works and is saved on this phone. */
  function offlineChip() {
    var el = document.getElementById("offlinechip"), off = navigator.onLine === false;
    if (!off) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement("div"); el.id = "offlinechip"; el.className = "offlinechip noprint"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.hidden = false;
    el.textContent = "📴 No signal. Everything still works and is saved on this phone" + (on() ? (pendingN ? " · " + pendingN + (pendingN === 1 ? " change" : " changes") + " will sync when you're back online" : " · it syncs when you're back online") : "") + ".";
  }
  function setStatus(s, msg) {
    status = s; statusMsg = msg || "";
    renderChip();
    var el = document.getElementById("syncpill"); if (!el) return;
    el.hidden = !on() && !CFG.showEntry;   // while sync is off it's the way in: "Family Sync" right next to Back up
    var L = { synced: ["✓", "Synced"], syncing: ["↻", "Syncing"], offline: ["☁", "Offline"], error: ["!", "Sync paused"], off: ["☁", entryLabel()] }[on() ? s : "off"] || ["", ""];
    // v64: changes made on this phone that haven't reached the family's copy yet
    if (on() && pendingN > 0 && s !== "syncing") L = [s === "synced" ? "↻" : L[0], (s === "synced" ? "" : L[1] + " · ") + pendingN + " to sync"];
    offlineChip();
    el.className = "syncpill s-" + s;
    el.innerHTML = '<span aria-hidden="true">' + L[0] + '</span><span class="sl"> ' + esc(L[1]) + '</span>' + (on() ? "" : '<span class="ss" aria-hidden="true"> Sync</span>');   // "Sync" on the narrowest phones
    el.title = statusMsg || (s === "synced" && cfg() && cfg().lastSync ? "Last synced " + S.ago(cfg().lastSync) : L[1]);
    el.setAttribute("aria-label", "Family Sync: " + L[1] + (statusMsg ? ". " + statusMsg : ""));
  }

  function entryLabel() { return FLAGS.google ? "Sync & sign in" : "Family Sync"; }

  // ---------- photos ----------
  function dataUrlToImage(u) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = u; }); }
  function canvasBlob(c, type, q) { return new Promise(function (res) { c.toBlob(res, type, q); }); }
  /** The small shared copy: 1024px long edge, WebP (JPEG where WebP can't be made), aiming for about 100 KB. */
  function makeThumb(dataUrl) {
    return dataUrlToImage(dataUrl).then(function (img) {
      var d = S.thumbDims(img.naturalWidth, img.naturalHeight, 1024), c = document.createElement("canvas");
      c.width = d.w; c.height = d.h; c.getContext("2d").drawImage(img, 0, 0, d.w, d.h);
      var q = 0.72, type = "image/webp";
      function go() {
        return canvasBlob(c, type, q).then(function (b) {
          if (!b || (type === "image/webp" && b.type !== "image/webp")) { type = "image/jpeg"; return canvasBlob(c, type, q).then(fin); }
          return fin(b);
        });
      }
      function fin(b) {
        if (b.size > 110000 && q > 0.42) { q -= 0.1; return go(); }
        return { blob: b, mime: b.type === "image/webp" ? "image/webp" : "image/jpeg", w: d.w, h: d.h };
      }
      return go();
    });
  }
  function blobToDataUrl(b) { return new Promise(function (res, rej) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.onerror = rej; f.readAsDataURL(b); }); }

  // ---------- the sync loop ----------
  var running = null, again = false, timer = null;
  function schedule(ms) { if (!on()) return; clearTimeout(timer); timer = setTimeout(function () { syncNow(); }, ms == null ? 2500 : ms); }
  var wantNow = false;
  function syncNow(opts) {
    if (!on()) { setStatus("off"); return Promise.resolve(); }
    if (opts && opts.throwErrors) wantNow = true;   // someone is waiting on this one: redraw right away when it lands
    if (running) { again = true; return wantNow ? running.then(function (x) { if (rrWaiting) rerender(true); return x; }) : running; }
    if (navigator.onLine === false) { setStatus("offline", "Changes are saved on this phone and will sync when you're back online."); return Promise.resolve(); }
    setStatus("syncing");
    running = doSync(opts || {}).then(function (ch) {
      setStatus("synced"); countPending(0); if (window.FS_CUP && window.FS_CUP.report) window.FS_CUP.report(); return ch;
    }).catch(function (e) {
      var m = friendly(e).message;
      setStatus(/offline/i.test(m) ? "offline" : "error", m); countPending(0);
      if (opts && opts.throwErrors) throw e;
    }).then(function (x) {
      running = null; if (again) { again = false; schedule(1000); } return x;
    }, function (e) { running = null; throw e; });
    return running;
  }
  function snapshot() {
    return Promise.all([A.all("kids"), A.all("trips"), A.all("photos")]).then(function (r) {
      return { people: r[0], trips: r[1].map(function (t) { return M.migrateTrip(t); }), photoIds: r[2].map(function (p) { return p.id; }) };
    });
  }
  function nameOf(members, uid) { var m = (members || []).filter(function (x) { return x.user_id === uid; })[0]; return m ? m.display_name || "" : ""; }

  function doSync(opts) {
    var c = cfg(), fid = c.familyId, r, acc, changed = false, photosIn = 0, celebrate = [];
    var metaWas = metaHash(c);   // who's in, names, role, plan: shown in the header and on Family Sync
    return remote().then(function (x) { r = x; return r.session(); }).then(function (sess) {
      if (!sess) throw new Error("Signed out. Open Family Sync to sign back in.");
      return (r.rpc ? r.rpc("refresh_my_plan", {}).catch(function () {}) : Promise.resolve()).then(function () { return Promise.all([r.family(fid), r.members(fid)]); });   // founder plan is decided on the server
    }).then(function (fm) {
      var fam = fm[0], members = fm[1] || [];
      if (!fam) return dropped();
      c.familyName = fam.name; c.plan = { plan: fam.plan, keeper_until: fam.keeper_until, trial_ends_at: fam.trial_ends_at, founder: !!fam.founder, max_people: fam.max_people || null }; c.home = fam.home || "";
      var me = members.filter(function (m) { return m.user_id === c.userId; })[0]; if (me) c.role = me.role;
      // Which person is this login? The family's member row is the source of truth (it's set when you join or pick "This is me"):
      // a phone that doesn't know yet (signed in again, an older join) picks it up, and a link only this phone knew goes up.
      if (me && me.person_id && me.person_id !== c.myPerson && A.kidById(me.person_id)) { c.myPerson = me.person_id; c.myName = M.who(A.kidById(me.person_id)) || c.myName; }
      else if (me && !me.person_id && c.myPerson && A.kidById(c.myPerson) && r.updateMe) r.updateMe(fid, c.userId, { person_id: c.myPerson }).catch(function () {});
      if (!opts.quiet) S.newMembers(members, c.seen, c.userId).forEach(function (m) { if (c.lastSync) celebrate.push(m); });
      members.forEach(function (m) { c.seen[m.user_id] = 1; });
      c.members = members.map(function (m) { return { user_id: m.user_id, role: m.role, display_name: m.display_name, person_id: m.person_id, joined_at: m.joined_at }; });
      acc = S.access(c.plan, FLAGS);
      return push();
    }).then(function () { return pull(); }).then(function () {
      c.lastSync = new Date().toISOString();
      return save(c);
    }).then(function () {
      celebrate.forEach(function (m) { cheer(S.joinLine(m.display_name || "Someone new", m.user_id), personFor(m)); });
      var metaNow = metaHash(c) !== (drawnMeta == null ? metaWas : drawnMeta), now = !!opts.throwErrors || wantNow; wantNow = false;   // an explicit sync (a button, joining) redraws right away; background ones wait for a pause
      if (!changed) { if (metaNow) rerender(now); return; }
      var was = stateHash();
      return A.load().then(function () { if (photosIn || metaNow || stateHash() !== was) rerender(now); });
    });

    function push() {
      return snapshot().then(function (local) {
        var plan = S.planPush(local, c.shadow, fid);
        if (!S.allows(acc, "photos")) plan.uploads = [];
        var firstShared = !c.sharedTrip && plan.trips.some(function (t) { return !t.deleted && !c.shadow.trips[t.id]; }) && c.lastSync;
        plan.trips.forEach(function (t) { if (!t.deleted && !c.authors[t.id]) c.authors[t.id] = nameOf(c.members, c.userId) || "you"; });
        var jobs = Promise.resolve();
        ["people", "visits", "trips"].forEach(function (tb) { if (plan[tb].length) jobs = jobs.then(function () { return r.upsert(tb, plan[tb]); }); });
        plan.uploads.forEach(function (u) {
          jobs = jobs.then(function () { return A.getOne("photos", u.id); }).then(function (p) {
            if (!p) return;
            return makeThumb(p.dataUrl).then(function (th) {
              var path = S.photoPath(fid, u.id, th.mime);
              return r.upload(path, th.blob, th.mime).then(function () {
                plan.photos.push({ family_id: fid, id: u.id, path: path, mime: th.mime, width: th.w, height: th.h, bytes: th.blob.size, updated_at: new Date().toISOString(), deleted: false });
                c.shadow.photos[u.id] = th.mime;
              });
            });
          }).catch(function (e) { if (/offline|fetch/i.test(String(e && e.message))) throw e; });   // one bad photo shouldn't stop the rest
        });
        return jobs.then(function () { return plan.photos.length ? r.upsert("photos", plan.photos) : null; })
          .then(function () { return r.removeFiles(plan.removes).catch(function () {}); })
          .then(function () {
            S.afterPush(c.shadow, plan);
            if (firstShared) { c.sharedTrip = true; setTimeout(function () { confetti(); A.toast("Your first shared trip! The whole family can see it now 🎉"); }, 400); }
          });
      });
    }
    function pull() {
      var rows = {}, tables = ["people", "visits", "trips", "photos"];
      return tables.reduce(function (p, tb) {
        return p.then(function () { return r.pull(tb, fid, c.cursor[tb]); }).then(function (got) { rows[tb] = got; });
      }, Promise.resolve()).then(function () {
        if (!tables.some(function (tb) { return rows[tb].length; })) return;
        return snapshot().then(function (local) {
          var before = { people: local.people.map(function (p) { return p.id; }), trips: local.trips.map(function (t) { return t.id; }) };
          var ch = S.applyPull(local, c.shadow, rows);
          (rows.trips || []).forEach(function (t) { if (!t.deleted && !c.authors[t.id] && t.updated_by) c.authors[t.id] = nameOf(c.members, t.updated_by); });
          tables.forEach(function (tb) { c.cursor[tb] = S.nextCursor(c.cursor[tb], rows[tb]); });
          var touched = Object.keys(ch.touched);
          var write = ch.people || ch.visits || ch.trips;
          var jobs = write ? A.tx(["kids", "trips"], "readwrite", function (s) {
            local.people.forEach(function (p) { if (ch.touched[p.id]) s[0].put(p); });
            ch.removedPeople.forEach(function (id) { s[0].delete(id); });
            local.trips.forEach(function (t) { if (before.trips.indexOf(t.id) < 0 || rows.trips.some(function (x) { return x.id === t.id && !x.deleted; })) s[1].put(t); });
            ch.removedTrips.forEach(function (id) { s[1].delete(id); });
          }) : Promise.resolve();
          if (write) changed = true;
          return jobs.then(function () {
            return ch.downloads.reduce(function (p, d) {
              return p.then(function () { return r.download(d.path); }).then(blobToDataUrl).then(function (u) {
                if (!/^data:image\/(jpeg|webp|png);base64,/.test(u)) return;
                changed = true; photosIn++; return A.put("photos", { id: d.id, dataUrl: u, thumb: true }, true);
              }).catch(function () {});
            }, Promise.resolve());
          }).then(function () { return touched; });
        });
      });
    }
    function dropped() {
      return save(null).then(function () {
        setStatus("off"); A.toast("You're no longer in the family log. Everything is still on this phone.");
        throw new Error("Not in a family any more");
      });
    }
  }
  /** What the screen shows, as one string: re-render only when this changes. */
  var drawnMeta = null, rrWaiting = false;   // the members/family details the screen was last drawn with
  function metaHash(c) { return JSON.stringify([c.familyName, c.role, c.plan, c.home, (c.members || []).map(function (m) { return [m.user_id, m.role, m.display_name, m.person_id]; })]); }
  function stateHash() {
    var st = A.state, h = 0, str = JSON.stringify([st.kids, st.trips]);
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return str.length + ":" + h;
  }
  var lastTouch = 0, rrTimer = null;
  var lastInput = 0;   // scrolls count only when a person started them (a fling keeps scrolling after the finger lifts); the app's own scroll-to-top doesn't
  ["touchstart", "touchmove", "wheel", "keydown", "pointerdown"].forEach(function (ev) { window.addEventListener(ev, function () { lastInput = Date.now(); if (ev !== "pointerdown") lastTouch = lastInput; }, { passive: true, capture: true }); });
  window.addEventListener("scroll", function () { if (Date.now() - lastInput < 3000) lastTouch = Date.now(); }, { passive: true, capture: true });
  function userBusy() {
    var a = document.activeElement;
    return Date.now() - lastTouch < 2000 || !!(a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && main.contains(a));
  }
  /** Background sync brought new data: redraw the screen in place, keeping scroll, open sections, typed text and focus.
      Never while someone is scrolling or typing (it waits for a pause), never on a form. */
  function rerender(now) {
    var h = location.hash;
    if (/\/(new|edit)\b|^#\/add|^#\/join|^#\/sync\/(email|create)/.test(h)) return;   // don't yank a form out from under someone
    clearTimeout(rrTimer);
    rrWaiting = false;
    if (!now && userBusy()) { rrWaiting = true; rrTimer = setTimeout(rerender, 1500); return; }
    var y = window.scrollY, x = window.scrollX, open = [], vals = [];
    main.querySelectorAll("details").forEach(function (d, i) { if (d.open) open.push(i); });
    main.querySelectorAll("input, textarea, select").forEach(function (el, i) {
      if (el.type === "radio" || el.type === "checkbox" || el.type === "file") return;
      if (el.value) vals.push({ key: el.id || el.name || "#" + i, i: i, v: el.value });
    });
    window.MLTL_RENDERS = (window.MLTL_RENDERS || 0) + 1;
    A.clearPhotos(); A.route(); drawnMeta = metaHash(cfg());
    if (location.hash !== h) return;
    var ds = main.querySelectorAll("details"); open.forEach(function (i) { if (ds[i]) ds[i].open = true; });
    var els = main.querySelectorAll("input, textarea, select");
    vals.forEach(function (o) {
      var el = (o.key.charAt(0) !== "#" && (document.getElementById(o.key) || main.querySelector('[name="' + o.key.replace(/"/g, "") + '"]'))) || els[o.i];
      if (el && main.contains(el) && el.value !== o.v) { el.value = o.v; el.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    window.scrollTo(x, y);
    requestAnimationFrame(function () { if (Math.abs(window.scrollY - y) > 2) window.scrollTo(x, y); });
  }
  function personFor(m) { return m && m.person_id ? A.kidById(m.person_id) : null; }

  // ---------- fun ----------
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var c = document.createElement("canvas"), W = c.width = innerWidth, H = c.height = innerHeight, ctx = c.getContext("2d");
    c.className = "confetti"; c.setAttribute("aria-hidden", "true"); document.body.appendChild(c);
    var cols = M.COLORS.concat(["#16283a", "#ffffff"]), bits = [];
    for (var i = 0; i < 110; i++) bits.push({ x: W / 2 + (Math.random() - .5) * 80, y: H * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3, r: Math.random() * 6.3, s: 5 + Math.random() * 6, c: cols[i % cols.length] });
    var t0 = performance.now();
    (function frame(t) {
      var k = (t - t0) / 1800; ctx.clearRect(0, 0, W, H);
      bits.forEach(function (b) { b.vy += .32; b.x += b.vx; b.y += b.vy; b.r += .12; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); });
      if (k < 1) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }
  function cheer(line, person) {
    var el = document.createElement("div"); el.className = "cheer"; el.setAttribute("role", "status");
    el.innerHTML = (person ? '<span class="avatar" style="--kid:' + esc(person.color) + '">' + esc(person.name.charAt(0).toUpperCase()) + '</span>' : '<span class="avatar" aria-hidden="true">🎉</span>') +
      '<b>' + esc(line) + '</b><button type="button" class="x" aria-label="Close">×</button>';
    document.body.appendChild(el); confetti();
    var close = function () { el.classList.add("out"); setTimeout(function () { el.remove(); }, 300); };
    el.querySelector(".x").onclick = close; setTimeout(close, 5000);
  }

  // ---------- QR code (drawn here, no outside service) ----------
  function qrSVG(text) {
    if (!window.qrcode) return "";
    var q = window.qrcode(0, "M"); q.addData(text); q.make();
    var n = q.getModuleCount(), pad = 4, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += "M" + (x + pad) + " " + (y + pad) + "h1v1h-1z";
    return '<svg class="qr" viewBox="0 0 ' + (n + 2 * pad) + ' ' + (n + 2 * pad) + '" role="img" aria-label="QR code for the invite link" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#16283a"/></svg>';
  }
  var qrP = null;
  function needQR() { if (window.qrcode) return Promise.resolve(); if (!qrP) qrP = loadScript("vendor/qrcode.js").catch(function () { qrP = null; }); return qrP; }

  // ---------- little view helpers ----------
  function dot(p, big) {
    var name = p ? (M.who(p) || p.name) : "?";
    if (p && okAvatar(p.avatar)) return '<span class="' + (big ? "avatar" : "dotp") + ' hasimg" style="--kid:' + esc(p.color || "#6f8f7a") + '" title="' + esc(name) + '"><img src="' + esc(p.avatar) + '" alt="" referrerpolicy="no-referrer" loading="lazy"></span>';
    return '<span class="' + (big ? "avatar" : "dotp") + '" style="--kid:' + esc(p && p.color || "#6f8f7a") + '" title="' + esc(name) + '">' + esc(String(name || "?").charAt(0).toUpperCase()) + '</span>';
  }
  function memberPerson(m) {
    var p = personFor(m);
    return p || { name: m.display_name || "Family member", color: "#6f8f7a" };
  }
  function err(id, e) { var el = document.getElementById(id); if (!el) return; el.textContent = e ? (e.message || String(e)) : ""; el.hidden = !e; }
  function busy(btn, yes, label) { if (!btn) return; if (yes) { btn.dataset.label = btn.textContent; btn.textContent = label || "One moment…"; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } }
  function back(href, label) { return '<a class="back" href="' + href + '">← ' + esc(label || "Back") + '</a>'; }
  function peoplePicker(name, list, selected, extra) {
    return '<div class="kidpick" role="radiogroup">' + list.map(function (p) {
      return '<label style="--kid:' + esc(p.color) + '"><input type="radio" name="' + name + '" value="' + esc(p.id) + '"' + (p.id === selected ? " checked" : "") + (p.taken ? ' data-taken="1"' : "") + '> ' + dot(p) + ' ' + esc(M.who(p)) + (M.realName(p) ? ' <span class="muted small">(' + esc(M.realName(p)) + ')</span>' : "") + (p.taken ? ", that\'s me (on another device)" : "") + '</label>';
    }).join("") + (extra || "") + '</div>';
  }

  // ---------- screens ----------
  function viewSync(sub) {
    var r = viewSync0(sub); putNote(); return r;
  }
  // The result of coming back from Google stays on Family Sync until dismissed (a toast is too easy to miss while the app loads).
  var oauthNote = null;
  function putNote() {
    var main = document.getElementById("main"); if (!oauthNote || !main || main.querySelector(".gnote")) return;
    var n = oauthNote, d = document.createElement("div"), c = cfg();
    d.className = "panel gnote " + (n.ok ? "ok" : "bad"); d.setAttribute("role", n.ok ? "status" : "alert");
    d.innerHTML = '<h3>' + (n.ok ? "You're signed in with Google" : "Google sign-in didn't finish") + '</h3><p class="small">' + esc(n.msg) + '</p><div class="actions">' +
      (n.ok ? "" : googleBtn(on() && c && c.anonymous !== false ? "link" : "signin", "Try Google again")) + '<button type="button" class="btn btn-ghost small" data-gnote-x>OK</button></div>';
    var after = main.querySelector(".back"); if (after && after.parentNode === main) main.insertBefore(d, after.nextSibling); else main.insertBefore(d, main.firstChild);
  }
  document.addEventListener("click", function (e) { var x = e.target.closest && e.target.closest("[data-gnote-x]"); if (!x) return; oauthNote = null; var n = x.closest(".gnote"); if (n) n.remove(); });
  function viewSync0(sub) {
    document.title = "Family Sync · Famstamp";
    if (sub === "invite") return viewInvite();
    if (sub === "email") return FLAGS.email ? viewEmail() : viewOther();
    if (sub === "other") return viewOther();
    if (sub === "create") return viewCreate();
    if (sub === "leave") return viewLeave();
    if (sub === "new") { if (!newLogThen("#/sync/create")) location.hash = "#/sync"; return; }
    if (sub === "addjoin") { if (!newLogThen("#/join")) location.hash = "#/sync"; return; }
    if (sub === "me") return viewMe();
    if (sub === "logs") return viewLogs();
    if (!on()) return viewTurnOn();
    return viewHub();
  }

  function viewTurnOn() {
    main.innerHTML = back("#/", "Home") + '<div class="synchero"><div class="beam" aria-hidden="true">👨‍👩‍👧‍👦</div><h1>Turn on Family Sync</h1>' +
      '<p class="lede">Your family\'s travel story, on everyone\'s phone. Add a trip on yours and it shows up in Grandma\'s Famstamp too.</p></div>' +
      '<div class="panel perks"><div><b>🗺️ Everyone\'s maps, everywhere</b><span>Each phone keeps its own full copy, so it still works with no signal.</span></div>' +
      '<div><b>🔑 Invite with a code</b><span>Kids and grandparents join with a code or a QR scan. No email or password needed.</span></div>' +
      '<div><b>📸 Photos, kindly sized</b><span>A small copy of each trip photo is shared. The full-size photo stays on the phone that took it.</span></div>' +
      '<div><b>🤫 Private by design</b><span>Only people you invite can see your family\'s log. No ads, no tracking.</span></div></div>' +
      '<div class="actions stack"><a class="btn btn-beacon big" href="#/sync/create">Start our family log</a>' +
      '<a class="btn btn-primary" href="#/join">I have an invite code</a>' +
      googleBtn("signin", "Continue with Google") + '<a class="btn btn-ghost" href="#/sync/other">I already set this up on another phone</a></div>' + signedInNote() +
      '<p class="hint">Family Sync is optional. Without it, everything stays on this device only, just like now. ' + (FLAGS.testing ? "While we test with families, every Family Keeper feature is free." : "") + '</p>';
  }

  function viewCreate() {
    if (on()) { location.hash = "#/sync"; return; }
    var people = A.state.kids, guess = (people.filter(function (p) { return p.role !== "kid"; })[0] || {}).id || "";
    main.innerHTML = back("#/sync") + '<h1>Start your family log</h1><div class="panel">' +
      '<div class="field" style="margin-top:0"><label for="fname">Family name</label><input id="fname" type="text" maxlength="40" placeholder="e.g. Rivera, or The Rivera crew" autocomplete="off"></div>' +
      '<p class="small muted" id="fprev">Invites will say: "You\'re joining your family\'s log!"</p>' +
      '<div class="field"><label>Which one is you?</label>' + (people.length ? peoplePicker("me", people, guess, '<label><input type="radio" name="me" value=""' + (guess ? "" : " checked") + '> I\'m not on the list yet</label>') : "") + '</div>' +
      '<div class="field" id="mynamebox"' + (guess ? " hidden" : "") + '><label for="myname">Your name or nickname</label><input id="myname" type="text" maxlength="40" placeholder="e.g. Mom, Dad, Sam"></div>' +
      (people.length ? '<p class="small muted">Everything already on this phone (' + people.length + (people.length === 1 ? " person, " : " people, ") + A.state.trips.length + (A.state.trips.length === 1 ? " trip" : " trips") + ') goes into the family log.</p>' : "") +
      '<p class="err" id="cerr" hidden></p><div class="actions"><button class="btn btn-beacon" id="cgo">Create our family log</button></div></div>';
    var fn = document.getElementById("fname");
    fn.addEventListener("input", function () { document.getElementById("fprev").textContent = 'Invites will say: "You\'re joining ' + S.familyTitle(fn.value) + '!"'; });
    main.querySelectorAll("input[name=me]").forEach(function (r) { r.onchange = function () { document.getElementById("mynamebox").hidden = !!r.value && r.checked; }; });
    setTimeout(function () { fn.focus(); }, 50);
    document.getElementById("cgo").onclick = function () {
      var b = this, name = S.cleanName(fn.value, 40), meSel = main.querySelector("input[name=me]:checked"), pid = meSel ? meSel.value : "";
      var me = pid ? A.kidById(pid) : null, myName = me ? me.name : S.cleanName((document.getElementById("myname") || {}).value, 40);
      if (!name) return err("cerr", new Error("Give your family log a name."));
      if (!myName) return err("cerr", new Error("Add your name so the family knows who's who."));
      err("cerr"); busy(b, true, "Setting up…");
      var r;
      remote().then(function (x) { r = x; return ensureSession(r); }).then(function (sess) {
        return r.rpc("create_family", { p_name: name, p_display_name: myName, p_person_id: pid || null, p_home: A.state.meta.home || "" }).then(function (fam) {
          fam = Array.isArray(fam) ? fam[0] : fam;
          return save(freshCfg(fam.id, sess.userId, { familyName: fam.name, role: "owner", myPerson: pid || null, myName: myName }));
        });
      }).then(function () { return syncNow({ throwErrors: true, quiet: true }); })
        .then(function () { var c = cfg(); return c.myPerson ? r.linkPerson(c.familyId, c.myPerson, c.userId).catch(function () {}) : null; })
        .then(function () { confetti(); A.toast("Your family log is ready! Now invite the crew."); location.hash = "#/sync/invite"; })
        .catch(function (e) { busy(b, false); err("cerr", friendly(e)); });
    };
  }

  function viewHub() {
    var c = cfg(), acc = S.access(c.plan, FLAGS), owner = c.role === "owner", grown = c.role !== "kid";
    drawnMeta = metaHash(c);
    var groups = [], byPerson = {};   // one person can be signed in on several devices: show them once, "a user (2 devices)"
    (c.members || []).forEach(function (m) {
      if (m.person_id && byPerson[m.person_id]) return byPerson[m.person_id].push(m);
      var g = [m]; groups.push(g); if (m.person_id) byPerson[m.person_id] = g;
    });
    var members = groups.map(function (g) {
      var m = g[0], p = memberPerson(m), me = g.some(function (x) { return x.user_id === c.userId; }), n = g.length;
      var oldest = g.map(function (x) { return x.joined_at; }).sort()[0];
      return '<div class="row member">' + dot(p) + '<span class="nm"><b>' + esc((p && M.who(p)) || m.display_name) + (n > 1 ? ' <span class="muted small">(' + n + ' devices)</span>' : "") + (me ? ' <span class="muted small">(you)</span>' : "") + '</b><span>' + (p && M.realName(p) ? esc(M.realName(p)) + ' · ' : "") + (p ? esc(M.relLabel(p)) + ' · ' : "") + esc(ROLE_NAME[m.role] || "") + ' · joined ' + esc(S.ago(oldest)) + '</span></span>' +
        (owner && !me && n === 1 ? '<button type="button" class="pill" data-rm="' + esc(m.user_id) + '" aria-label="Remove ' + esc(m.display_name) + '">Remove</button>' : "") + '</div>';
    }).join("");
    main.innerHTML = back("#/", "Home") + '<h1>' + esc(c.familyName || "Family log") + '</h1>' +
      '<div class="syncstate"><span class="syncpill s-' + esc(status) + '">' + (status === "synced" ? "✓ Synced" : status === "syncing" ? "↻ Syncing" : status === "offline" ? "☁ Offline" : status === "error" ? "! Sync paused" : "") + '</span>' +
      '<span class="small muted">' + esc(statusMsg || (c.lastSync ? "Last synced " + S.ago(c.lastSync) : "Not synced yet")) + (pendingN ? " · " + pendingN + (pendingN === 1 ? " change" : " changes") + " waiting to sync" : "") + '</span><button type="button" class="linkbtn" id="snow">Sync now</button></div>' +
      '<div class="actions">' + (grown ? '<a class="btn btn-beacon" href="#/sync/invite">＋ Invite someone</a>' : "") + '<a class="btn btn-primary" href="#/feed">📰 Family feed</a>' + (grown ? '<a class="btn" href="#/highlights">✨ Highlights</a><a hidden href="#/follow">👵 Grandparent follow-along</a>' : "") + '</div>' +
      '<h2>Who\'s in <span class="muted small">' + (c.members || []).length + '</span></h2><div class="panel members">' + (members || '<p class="muted">Just you so far.</p>') + '</div>' +
      mePanel(c) + logsPanel() +
      '<div class="panel"><h3>Plan</h3><p class="small">' + esc(acc.label) + '</p><p class="small muted">' + (acc.tier === "founder" ? "Everyone you invite into this family gets every feature free, on every device, up to " + (c.plan.max_people || 10) + " people." : 'Family Keeper (' + esc(CFG.price || "") + ') will cover everyone you invite with one subscription. Nothing is charged today.') + '</p></div>' +
      (c.anonymous !== false && (FLAGS.email || FLAGS.google) ? '<div class="panel keepspot"><h3>' + (FLAGS.google ? "Link Google so you can sign in on the web" : "Keep your spot") + '</h3><p class="small muted">You joined without signing in. ' + (FLAGS.google ? "Link Google so you can sign in on the web and on a new phone, as the same you" : "Add your email so you can get back into the family log on a new phone") + '. Optional.</p><div class="actions">' + googleBtn("link", "Link my Google account") + (FLAGS.email ? '<a class="btn btn-ghost" href="#/sync/email">Add my email</a>' : "") + '</div></div>' : "") +
      '<div class="panel"><h3>Privacy</h3><p class="small muted">The family\'s shared copy (names, map colors, trips and small photo copies) is stored with our database provider, Supabase, in the US. Only members of this family can read it. Full-size photos never leave the phone that took them. No ads, no analytics.</p>' +
      '<div class="actions"><a class="btn btn-danger" href="#/sync/leave">Leave family or delete my cloud data</a></div></div>';
    document.getElementById("snow").onclick = function () { syncNow().then(function () { viewHub(); }); };
    main.querySelectorAll("[data-rm]").forEach(function (b) {
      b.onclick = function () {
        var m = c.members.filter(function (x) { return x.user_id === b.dataset.rm; })[0];
        if (!confirm("Remove " + (m.display_name || "this person") + " from the family log? Their phone keeps its own copy, but stops syncing.")) return;
        remote().then(function (r) { return r.rpc("remove_member", { p_family: c.familyId, p_user: m.user_id }); })
          .then(function () { c.members = c.members.filter(function (x) { return x !== m; }); return save(c); }).then(function () { A.toast("Removed"); viewHub(); })
          .catch(function (e) { A.toast(friendly(e).message); });
      };
    });
    remote().then(function (r) { return r.session(); }).then(function (s) { if (s && !s.anon && s.email && c.anonymous !== false) { c.anonymous = false; c.email = s.email; save(c); viewHub(); } }).catch(function () {});
  }

  var lastInvite = null;
  // Who each invite is for. Kept on this device right away, and saved to the invite (set_invite_for) when the server has it,
  // so the Open invites list can say "For Rosie" everywhere. Older servers without that function just keep the local label.
  var FOR_KEY = "fs-invite-for";
  function forMap() { try { return JSON.parse(localStorage.getItem(FOR_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function forSet(code, pid) {
    var m = forMap(); if (pid) m[code] = pid; else delete m[code];
    var keys = Object.keys(m); if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(function (k) { delete m[k]; });
    try { localStorage.setItem(FOR_KEY, JSON.stringify(m)); } catch (e) {}
    remote().then(function (r) { return r.rpc("set_invite_for", { p_code: code, p_person: pid || "" }); }).catch(function () {});
  }
  function invFor(i) { return (i && (i.for_person || forMap()[i.code])) || ""; }
  function viewInvite() {
    var c = cfg(); if (!c) { location.hash = "#/sync"; return; }
    document.title = "Invite · Famstamp";
    main.innerHTML = back("#/sync", "Family") + '<h1>Invite the crew</h1><p class="lede small">Send the link, or let them scan the code. It works for 7 days, up to 10 people.</p>' +
      '<div class="seg" role="group" aria-label="Who are you inviting?"><button type="button" data-irole="adult" aria-pressed="true">A grown-up</button><button type="button" data-irole="grand" aria-pressed="false">A grandparent</button><button type="button" data-irole="kid" aria-pressed="false">A kid with their own phone</button></div>' +
      (A.state.kids.length ? '<div class="field"><label for="ifor">Who is it for?</label><select id="ifor"><option value="">Anyone (they pick themselves)</option>' +
        A.state.kids.map(function (k) { return '<option value="' + esc(k.id) + '">' + esc(M.who(k)) + '</option>'; }).join("") + '</select></div>' : "") +
      '<div class="panel invite" id="invbox"><p class="muted">Making a code…</p></div><p class="err" id="ierr" hidden></p>' +
      '<h2 id="invhead">Open invites</h2><div class="panel" id="invlist"><p class="muted small">Loading…</p></div>';
    var role = "adult", lastRows = [];
    // Reuse an open invite for this role when there is one (opening this screen used to make a new code every time,
    // and a family can only have 10 open). At the cap, turn off the oldest unused one and make a fresh code.
    // "A grandparent" is a grown-up invite on the server; the link adds &rel=grandparent so the join screen picks Grandparent,
    // which gives them the Highlights tab.
    function srole() { return role === "kid" ? "kid" : "adult"; }
    function usable(i) { return i.role === srole() && i.uses < i.max_uses && Date.parse(i.expires_at) > Date.now() + 2 * 864e5; }
    function make(fresh) {
      var box = document.getElementById("invbox"); box.innerHTML = '<p class="muted">Making a code…</p>'; err("ierr");
      Promise.all([remote().then(function (r) {
        function create() { return r.rpc("create_invite", { p_family: c.familyId, p_role: srole(), p_days: 7, p_max_uses: 10 }); }
        return (fresh ? Promise.resolve([]) : r.invites(c.familyId).catch(function () { return []; })).then(function (rows) {
          var have = (rows || []).filter(usable)[0]; if (have) return have;
          return create().catch(function (e) {
            if (!/Too many open invites|10 open invites/i.test(String(e && e.message))) throw e;
            return r.invites(c.familyId).then(function (all) {
              // codes saved for someone go last, so a code you just gave Grandma isn't the one turned off
              var old = (all || []).slice().sort(function (a, b) { return (!!invFor(a) - !!invFor(b)) || (a.uses - b.uses) || (Date.parse(a.created_at) - Date.parse(b.created_at)); })[0];
              if (!old) throw e;
              return r.rpc("revoke_invite", { p_code: old.code }).then(create);
            });
          });
        });
      }), needQR()]).then(function (res) {
        var inv = Array.isArray(res[0]) ? res[0][0] : res[0]; lastInvite = inv;
        var fsel = document.getElementById("ifor");
        if (fsel) { if (fsel.value && fsel.value !== invFor(inv)) forSet(inv.code, fsel.value); else if (!fsel.value && invFor(inv)) fsel.value = invFor(inv); }
        showInvite(inv);
      }).catch(function (e) {
        box.innerHTML = '<p class="muted small">No code yet.</p><div class="actions"><button type="button" class="btn btn-beacon" id="iretry">Try again</button></div>';
        document.getElementById("iretry").onclick = function () { make(); };
        err("ierr", friendly(e));
      }).then(list);
    }
    function showInvite(inv) {
      var forSel = document.getElementById("ifor"), forPid = forSel ? forSel.value : "";
      var link = S.inviteLink(location.origin + location.pathname, inv.code) + (forPid ? "&for=" + encodeURIComponent(forPid) : "") + (role === "grand" ? "&rel=grandparent" : ""), title = S.familyTitle(c.familyName);
      document.getElementById("invbox").innerHTML = '<div class="code" aria-label="Invite code">' + esc(inv.code) + '</div>' + qrSVG(link) +
        '<p class="small muted">Scan with a phone camera, or open the link. ' + (inv.role === "kid" ? "They'll join as a kid." : "They'll join as a grown-up.") + '</p>' +
        '<div class="actions center"><button class="btn btn-beacon" id="ishare">Share invite</button><button class="btn btn-ghost" id="icopy">Copy link</button></div>' +
        '<p class="small muted linkline">' + esc(link) + '</p><p class="small muted">Text it yourself: tap Share invite and pick Messages. <button type="button" class="linkbtn" id="inew2">Make a new code</button></p>';
      var text = "Join " + title + " on Famstamp! Tap the link, or open the app and enter " + inv.code + ".";
      document.getElementById("ishare").onclick = function () {
        if (navigator.share) navigator.share({ title: "Join " + title, text: text, url: link }).catch(function () {});
        else copy(text + " " + link);
      };
      document.getElementById("icopy").onclick = function () { copy(link); };
      document.getElementById("inew2").onclick = function () { make(true); };
    }
    function list() {
      remote().then(function (r) { return r.allInvites ? r.allInvites(c.familyId) : r.invites(c.familyId); }).then(function (rows) {
        var el = document.getElementById("invlist"); if (!el) return;
        rows = rows || []; lastRows = rows;
        function state(i) { return i.revoked_at ? "Cancelled" : i.uses >= i.max_uses ? "Used up" : Date.parse(i.expires_at) <= Date.now() ? "Expired" : ""; }
        var open = rows.filter(function (i) { return !state(i); }), closed = rows.filter(function (i) { return state(i); });
        var h = document.getElementById("invhead"); if (h) h.innerHTML = 'Open invites <span class="muted small">' + open.length + ' of 10</span>';
        function line(i) {
          var st = state(i), shown = lastInvite && lastInvite.code === i.code;
          var fp = invFor(i), fk = fp && A.state.kids.filter(function (k) { return k.id === fp; })[0];
          var meta = (fk ? "For " + M.who(fk) + " · " : "") + (i.role === "kid" ? "Kid" : "Grown-up") + " · " + (i.uses ? "used " + i.uses + " of " + i.max_uses : "not used yet") + " · " + (st === "Expired" ? "ended " : "ends ") + M.prettyDate(String(i.expires_at).slice(0, 10)) + " · made " + M.prettyDate(String(i.created_at).slice(0, 10));
          return '<div class="row invrow' + (st ? " invdone" : "") + '"><span class="nm"><b class="mono">' + esc(i.code) + (st ? ' <span class="invtag">' + esc(st) + '</span>' : shown ? ' <span class="invtag invon">Shown above</span>' : "") + '</b><span>' + esc(meta) + '</span></span>' +
            (st ? "" : '<span class="invbtns">' + (shown ? "" : '<button type="button" class="pill" data-ishow="' + esc(i.code) + '" aria-label="Show code and QR for ' + esc(i.code) + '">Show</button>') +
              '<button type="button" class="pill" data-ishare="' + esc(i.code) + '" aria-label="Share ' + esc(i.code) + '">Share</button><button type="button" class="pill" data-icp="' + esc(i.code) + '" aria-label="Copy the link for ' + esc(i.code) + '">Copy</button>' +
              '<button type="button" class="pill fx" data-revoke="' + esc(i.code) + '" aria-label="Cancel ' + esc(i.code) + '">Cancel</button></span>') + '</div>';
        }
        el.innerHTML = (open.length ? open.map(line).join("") : '<p class="muted small">No open invites.</p>') +
          (closed.length ? '<details class="invold"><summary>Earlier invites (' + closed.length + ')</summary>' + closed.map(line).join("") + '</details>' : "");
        function byCode(code) { return rows.filter(function (i) { return i.code === code; })[0]; }
        function linkFor(i) { var pid = invFor(i); return S.inviteLink(location.origin + location.pathname, i.code) + (pid ? "&for=" + encodeURIComponent(pid) : ""); }
        el.querySelectorAll("[data-ishow]").forEach(function (b) { b.onclick = function () {
          var inv = byCode(b.dataset.ishow); if (!inv) return;
          needQR().then(function () { lastInvite = inv; var fsel = document.getElementById("ifor"); if (fsel) fsel.value = invFor(inv); showInvite(inv); list(); document.getElementById("invbox").scrollIntoView({ block: "center", behavior: "smooth" }); });
        }; });
        el.querySelectorAll("[data-icp]").forEach(function (b) { b.onclick = function () { var i = byCode(b.dataset.icp); if (i) copy(linkFor(i)); }; });
        el.querySelectorAll("[data-ishare]").forEach(function (b) { b.onclick = function () {
          var i = byCode(b.dataset.ishare); if (!i) return; var title = S.familyTitle(c.familyName), text = "Join " + title + " on Famstamp! Tap the link, or open the app and enter " + i.code + ".";
          if (navigator.share) navigator.share({ title: "Join " + title, text: text, url: linkFor(i) }).catch(function () {}); else copy(text + " " + linkFor(i));
        }; });
        el.querySelectorAll("[data-revoke]").forEach(function (b) {
          b.onclick = function () {
            if (!confirm("Cancel invite " + b.dataset.revoke + "? Anyone who hasn't used it yet won't be able to join with it.")) return;
            remote().then(function (r) { return r.rpc("revoke_invite", { p_code: b.dataset.revoke }); }).then(function () { A.toast("Invite cancelled"); if (lastInvite && lastInvite.code === b.dataset.revoke) { lastInvite = null; document.getElementById("invbox").innerHTML = '<p class="muted small">That code is off. Make a new one any time.</p><div class="actions"><button class="btn btn-beacon" id="inew">New code</button></div>'; document.getElementById("inew").onclick = function () { make(true); }; } list(); }).catch(function (e) { A.toast(friendly(e).message); }); };
        });
      }).catch(function () { var el = document.getElementById("invlist"); if (el) el.innerHTML = '<p class="muted small">Couldn\'t load your invites just now. The code above still works.</p>'; });
    }
    // Picking someone labels the code on screen. If that code is already someone else's, they get their own fresh code.
    var fs = document.getElementById("ifor"); if (fs) fs.onchange = function () {
      if (!lastInvite) return;
      var was = invFor(lastInvite);
      if (fs.value && was && was !== fs.value) {
        var theirs = lastRows.filter(function (i) { return !i.revoked_at && usable(i) && invFor(i) === fs.value; })[0];
        if (theirs) { lastInvite = theirs; showInvite(theirs); list(); } else make(true);
        return;
      }
      forSet(lastInvite.code, fs.value); lastInvite.for_person = fs.value || null; showInvite(lastInvite); list();
    };
    main.querySelectorAll("[data-irole]").forEach(function (b) { b.onclick = function () { role = b.dataset.irole; main.querySelectorAll("[data-irole]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); make(); }; });
    if (lastInvite && lastInvite.family_id === c.familyId && Date.parse(lastInvite.expires_at) > Date.now() && lastInvite.role === role) needQR().then(function () { if (fs) fs.value = invFor(lastInvite); showInvite(lastInvite); list(); }); else make();
  }
  function copy(text) {
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { A.toast("Copied! Paste it in a text to your family."); }, function () {
      var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); A.toast("Copied!"); } catch (e) { prompt("Copy this:", text); } t.remove();
    });
  }

  // ---------- join ----------
  function viewJoin(code) {
    document.title = "Join a family log · Famstamp";
    var typed = String(code || "").trim(); try { typed = decodeURIComponent(typed); } catch (x) {}
    code = S.codeFromLink(typed);
    if (!code) {
      main.innerHTML = back("#/sync") + '<h1>Join your family</h1><div class="panel"><div class="field" style="margin-top:0"><label for="jcode">Invite code</label>' +
        '<input id="jcode" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="e.g. MAPLE-COMPASS-4821" class="codein"></div>' +
        '<p class="small muted">It\'s in the invite someone sent you. Spaces or dashes are fine.</p><p class="err" id="jerr" hidden></p><div class="actions"><button class="btn btn-beacon" id="jgo">Next</button></div></div>';
      var go = function () { var c2 = S.codeFromLink(document.getElementById("jcode").value); if (!c2) return err("jerr", new Error("That doesn't look like a code. It's two words and four numbers, like MAPLE-COMPASS-4821.")); location.hash = "#/join/" + c2; };
      document.getElementById("jgo").onclick = go; document.getElementById("jcode").onkeydown = function (e) { if (e.key === "Enter") go(); };
      if (typed) { document.getElementById("jcode").value = typed.slice(0, 60); err("jerr", new Error("That invite code doesn't look right. It's two words and four numbers, like MAPLE-COMPASS-4821. Check the message it came in, or ask for a fresh one.")); }
      setTimeout(function () { document.getElementById("jcode").focus(); }, 50); return;
    }
    if (on() && !viewJoin.asked) return remote().then(function (r) {
      return r.session().then(function (sess) {
        if (!sess || sess.anon) { viewJoin.asked = true; try { viewJoin(code); } finally { viewJoin.asked = false; } return; }
        return Promise.all([r.rpc("invite_preview", { p_code: code }), r.myFamilies(sess.userId)]).then(function (x) {
          var inv = Array.isArray(x[0]) ? x[0][0] : x[0];
          if (!inv) { main.innerHTML = back("#/join", "Try another code") + '<div class="synchero"><div class="beam" aria-hidden="true">🤔</div><h1>That invite didn\'t work</h1><p class="lede small">It may have expired, been used up, or been turned off. Ask for a fresh one.</p></div>'; return; }
          return identityJoin(code, inv, sess, r, x[1] || []);
        });
      });
    }).catch(function (e) {
      if (/Too many tries/i.test(String(e && e.message))) { main.innerHTML = back("#/sync", "Family") + '<div class="panel"><h3>Couldn\'t open the invite</h3><p class="muted">' + esc(friendly(e).message) + '</p></div>'; return; }
      viewJoin.asked = true; try { viewJoin(code); } finally { viewJoin.asked = false; }
    });
    if (on()) {
      var rg = reg(), full = S.linkedCount(rg) >= S.MAX_FAMILIES;
      main.innerHTML = back("#/sync") + '<div class="synchero"><div class="beam" aria-hidden="true">🏡</div><h1>Join another family?</h1><p class="lede small">This log syncs with <b>' + esc(cfg().familyName) + '</b>. ' +
        (full ? "You're already in " + S.MAX_FAMILIES + " families, the most for now. Leave one first to join this one." : "The new family gets its own log on this phone, kept separate. Switch between them from the family button at the top.") + '</p><p class="mono">' + esc(code) + '</p></div>' +
        (full ? "" : '<div class="actions stack"><button class="btn btn-beacon big" id="jsecond">Add it as a separate family log</button><a class="btn btn-ghost" href="#/sync">Not now</a></div>');
      var js = document.getElementById("jsecond"); if (js) js.onclick = function () { newLogThen("#/join/" + code); };
      return;
    }
    main.innerHTML = back("#/", "Home") + '<div class="synchero"><div class="beam" aria-hidden="true">🧭</div><h1>Checking your invite…</h1><p class="mono">' + esc(code) + '</p></div>';
    var r;
    remote().then(function (x) { r = x; return ensureSession(r); }).then(function (sess) {
      return r.rpc("invite_preview", { p_code: code }).then(function (rows) { return { sess: sess, inv: Array.isArray(rows) ? rows[0] : rows }; });
    }).then(function (x) {
      if (!x.inv) {
        main.innerHTML = back("#/join", "Try another code") + '<div class="synchero"><div class="beam" aria-hidden="true">🤔</div><h1>That invite didn\'t work</h1><p class="lede small">It may have expired, been used up, or been turned off. Ask for a fresh one; it only takes a second.</p></div>'; return;
      }
      joinScreen(code, x.inv, x.sess, r);
    }).catch(function (e) {
      main.innerHTML = back("#/", "Home") + '<div class="panel"><h3>Couldn\'t open the invite</h3><p class="muted">' + esc(friendly(e).message) + '</p><div class="actions"><button class="btn btn-primary" id="jretry">Try again</button></div></div>';
      document.getElementById("jretry").onclick = function () { viewJoin(code); };
    });
  }
  function okAvatar(u) { return /^https:\/\/lh3\.googleusercontent\.com\/[^"'\s<>]+$/.test(String(u || "")); }
  function firstName(n) { return S.cleanName(String(n || "").split(/\s+/)[0], 40); }
  /** Who an invite link was made for (?join=CODE&for=PERSON), remembered for this tab. */
  function joinRel(code) { try { var j = JSON.parse(sessionStorage.getItem("mltl-join-rel") || "null"); return j && j.code === S.normCode(code) && M.RELATIONS.some(function (x) { return x.id === j.rel; }) ? j.rel : ""; } catch (x) { return ""; } }
  function joinFor(code) { try { var j = JSON.parse(sessionStorage.getItem("mltl-join-for") || "null"); return j && j.code === code ? j.pid : ""; } catch (x) { return ""; } }

  /** Login = identity. A signed-in account that's already in any family never sees "Which one is you?":
      in this family already → open its log; in other families → join as the invited person / the person with their name / a new person. */
  function joinScreen(code, inv, sess, r) {
    if (!sess || sess.anon) return joinPicker(code, inv, sess, r);
    r.myFamilies(sess.userId).then(function (rows) {
      rows = rows || [];
      if (!rows.length) return joinPicker(code, inv, sess, r);   // brand-new account: pick yourself once
      return identityJoin(code, inv, sess, r, rows);
    }).catch(function (e) {
      main.innerHTML = back("#/", "Home") + '<div class="panel"><h3>Couldn\'t open the invite</h3><p class="muted">' + esc(friendly(e).message) + '</p></div>';
    });
  }
  function identityJoin(code, inv, sess, r, rows) {
    var fam = inv.people || [], forPid = joinFor(code), gFirst = firstName(sess.name), title = S.familyTitle(inv.family_name);
    var known = fam.filter(function (p) { return p.id === forPid; })[0] ||
      fam.filter(function (p) { var n = String(p.name).toLowerCase(); return !p.taken && gFirst && (n === gFirst.toLowerCase() || n === String(sess.name).toLowerCase()); })[0];
    var newP = null, myName = known ? known.name : (gFirst || "Me");
    if (!known) { newP = M.newPerson({ name: myName, role: inv.role === "kid" ? "kid" : "adult", color: M.COLORS[fam.length % M.COLORS.length] }); if (okAvatar(sess.avatar)) newP.avatar = sess.avatar; }
    var pid = known ? known.id : newP.id;
    main.innerHTML = '<div class="synchero"><div class="beam" aria-hidden="true">🏡</div><h1>Opening ' + esc(title) + '…</h1></div>';
    return r.rpc("redeem_invite", { p_code: code, p_display_name: myName, p_person_id: pid }).then(function (fid) {
      fid = Array.isArray(fid) ? fid[0] : fid;
      if (!fid) throw new Error("That invite just stopped working. Ask for a fresh one.");
      var already = rows.some(function (f) { return f.family_id === fid; }), local = S.logForFamily(reg(), fid);
      if (local) { if (local.db === HERE) { location.hash = "#/"; A.route && A.route(); return; } return switchTo(local.db, "#/"); }
      if (already && !on()) return welcomeBack(r, sess, sess.email || "");
      if (already) return addFamilyLogs(rows.filter(function (f) { return !S.logForFamily(reg(), f.family_id); }), sess.userId, { anonymous: !sess.email, email: sess.email || "" })
        .then(function () { var l = S.logForFamily(reg(), fid); if (l) switchTo(l.db, "#/"); else location.hash = "#/"; });
      var extra = { familyName: inv.family_name, role: inv.role, myPerson: pid, myName: myName, anonymous: !sess.email, email: sess.email || "", seenAll: true };
      if (!on()) {   // this log isn't in a family yet: it becomes this family's log (anything on it joins in)
        return (newP ? A.put("kids", newP) : Promise.resolve()).then(function () { return save(freshCfg(fid, sess.userId, extra)); })
          .then(A.load).then(function () { return syncNow({ throwErrors: true, quiet: true }); })
          .then(function () { cheer("Welcome to " + title.replace(/ log$/, "") + ", " + myName + "! 🎉", A.kidById(pid)); location.hash = "#/"; });
      }
      return addFamilyLogs([{ family_id: fid, role: inv.role, families: { name: inv.family_name } }], sess.userId, extra).then(function () {
        var l = S.logForFamily(reg(), fid); if (!l) throw new Error("You're already in " + S.MAX_FAMILIES + " family logs on this phone.");
        return (newP ? A.txIn(l.db, "kids", "readwrite", function (st) { st.put(newP); }) : Promise.resolve()).then(function () { switchTo(l.db, "#/"); });
      });
    }).catch(function (e) {
      main.innerHTML = back("#/", "Home") + '<div class="panel"><h3>Couldn\'t join</h3><p class="muted">' + esc(friendly(e).message) + '</p></div>';
    });
  }
  function joinPicker(code, inv, sess, r) {
    var fam = inv.people || [], mine = A.state.kids, hasLocal = mine.length > 0, title = S.familyTitle(inv.family_name);
    var free = fam.filter(function (p) { return !p.taken; }), forPid = joinFor(code), gFirst = sess && !sess.anon ? firstName(sess.name) : "";
    var match = fam.filter(function (p) { return p.id === forPid; })[0] ||
      free.filter(function (p) { var n = String(p.name).toLowerCase(); return (gFirst && n === gFirst.toLowerCase()) || mine.some(function (m) { return m.name.toLowerCase() === n; }); })[0];
    main.innerHTML = '<div class="synchero join"><div class="faces">' + fam.slice(0, 6).map(function (p) { return dot(p, true); }).join("") + '</div>' +
      '<h1>You\'re joining ' + esc(title) + '!</h1><p class="lede small">' + (inv.invited_by ? esc(inv.invited_by) + " invited you. " : "") + inv.members + (inv.members === 1 ? " person is" : " people are") + ' already in.' + '</p></div>' +
      (FLAGS.google && (!sess || sess.anon) ? '<div class="panel gjoin"><p class="small"><b>Already in this family on another phone?</b> Sign in with the same Google account.</p><div class="actions">' + googleBtn("join", "Continue with Google", code) + '</div></div>' : "") +
      '<div class="panel"><div class="field" style="margin-top:0"><label>Which one is you?</label>' +
      (fam.length ? peoplePicker("jme", fam, match ? match.id : "", '<label><input type="radio" name="jme" value=""' + (match ? "" : " checked") + '> I\'m new to the log</label>') : "") + '</div>' +
      '<div class="field" id="jnamebox"' + (match ? " hidden" : "") + '><label for="jname">Your name or nickname</label><input id="jname" type="text" maxlength="40" placeholder="e.g. Grandma, Pop, Lily" value="' + esc(gFirst) + '">' +
        '<label for="jnick" style="margin-top:10px">Nickname (optional)</label><input id="jnick" type="text" maxlength="' + M.NICK_MAX + '" placeholder="e.g. Nana, Papa">' +
        '<label for="jrel" style="margin-top:10px">You are the family\'s…</label><select id="jrel">' + M.RELATIONS.map(function (x) { var d = (inv.role !== "kid" && joinRel(code)) || M.defaultRel(inv.role === "kid" ? "kid" : "adult"); return '<option value="' + x.id + '"' + (x.id === d ? " selected" : "") + '>' + esc(x.label) + '</option>'; }).join("") + '</select></div>' +
      (hasLocal ? '<div class="field"><label>This phone already has a log (' + mine.length + (mine.length === 1 ? " person" : " people") + ', ' + A.state.trips.length + ' trips)</label>' +
        '<div class="seg col" role="radiogroup"><label class="opt"><input type="radio" name="jmerge" value="combine" checked> <span><b>Put them together</b><br><span class="small muted">Your maps and trips join the family log. Same names become one person.</span></span></label>' +
        '<label class="opt"><input type="radio" name="jmerge" value="separate"> <span><b>Keep them separate</b><br><span class="small muted">This phone\'s log stays as it is, and ' + esc(title) + ' gets its own log. Switch between them any time.</span></span></label>' +
        '<label class="opt"><input type="radio" name="jmerge" value="replace"> <span><b>Use the family\'s log on this phone</b><br><span class="small muted">We\'ll save a backup file of this phone\'s log first.</span></span></label></div></div>' : "") +
      '<p class="err" id="jerr" hidden></p><div class="actions"><button class="btn btn-beacon big" id="jyes">Join the family</button><a class="btn btn-ghost" href="#/">Not now</a></div>' +
      '<p class="small muted">Everyone in ' + esc(title) + ' will see the maps and trips you add. You can leave any time.</p></div>';
    main.querySelectorAll("input[name=jme]").forEach(function (x) { x.onchange = function () { document.getElementById("jnamebox").hidden = !!x.value && x.checked; }; });
    document.getElementById("jyes").onclick = function () {
      var b = this, sel = main.querySelector("input[name=jme]:checked"), pid = sel ? sel.value : "", famP = fam.filter(function (p) { return p.id === pid; })[0];
      var myName = famP ? famP.name : S.cleanName(document.getElementById("jname").value, 40), mode = (main.querySelector("input[name=jmerge]:checked") || {}).value || "combine";
      if (mode === "separate") { newLogThen("#/join/" + code, inv.family_name); return; }
      if (!myName) return err("jerr", new Error("Add your name so everyone knows who joined."));
      if (famP && famP.taken && !confirm("This will link this device to " + famP.name + ". Only continue if you're " + famP.name + ", joining from another phone or computer.")) return;
      err("jerr"); busy(b, true, "Joining…");
      var newPerson = null;
      (mode === "replace" ? A.doBackup().then(function () { return A.tx(["kids", "trips", "photos"], "readwrite", function (s) { s.forEach(function (st) { st.clear(); }); }); }).then(A.load) : Promise.resolve()).then(function () {
        if (!famP) {   // new to the log: use a matching local profile, or make one
          var loc = A.state.kids.filter(function (k) { return k.name.toLowerCase() === myName.toLowerCase(); })[0];
          if (loc) { pid = loc.id; return; }
          newPerson = M.newPerson({ name: myName, role: inv.role === "kid" ? "kid" : "adult", color: M.COLORS[(fam.length + A.state.kids.length) % M.COLORS.length],
            nickname: (document.getElementById("jnick") || {}).value, relationship: (document.getElementById("jrel") || {}).value });
          if (newPerson.relationship === "grandparent") newPerson.role = "grand";
          if (sess && !sess.anon && okAvatar(sess.avatar)) newPerson.avatar = sess.avatar;   // Google photo, for new people only
          pid = newPerson.id; return A.put("kids", newPerson);
        }
      }).then(function () {
        return r.rpc("redeem_invite", { p_code: code, p_display_name: myName, p_person_id: pid || null });
      }).then(function (fid) {
        fid = Array.isArray(fid) ? fid[0] : fid;
        if (!fid) throw new Error("That invite just stopped working. Ask for a fresh one.");
        // same names become one person: rename this phone's ids to the family's before the first push
        return snapshot().then(function (local) {
          var mapping = S.matchPeople(local.people, fam);
          if (!Object.keys(mapping).length) return;
          var oldIds = local.people.map(function (p) { return p.id; });
          S.remapPeople(local, mapping);
          return A.tx(["kids", "trips"], "readwrite", function (s) {
            oldIds.forEach(function (id) { if (mapping[id]) s[0].delete(id); });
            local.people.forEach(function (p) { s[0].put(p); }); local.trips.forEach(function (t) { s[1].put(t); });
          }).then(function () { if (mapping[pid]) pid = mapping[pid]; });
        }).then(function () {
          return save(freshCfg(fid, sess.userId, { familyName: inv.family_name, role: inv.role, myPerson: pid, myName: myName, seenAll: true, anonymous: !(sess && !sess.anon && sess.email), email: sess && !sess.anon ? sess.email || "" : "" }));
        });
      }).then(A.load).then(function () { return syncNow({ throwErrors: true, quiet: true }); }).then(function () {
        cheer("Welcome to " + title.replace(/ log$/, "") + ", " + myName + "! 🎉", A.kidById(pid));
        location.hash = "#/";
      }).catch(function (e) { busy(b, false); err("jerr", friendly(e)); });
    };
  }

  // ---------- already set up on another phone (no email codes while there's no mail server) ----------
  function viewOther() {
    main.innerHTML = back("#/sync") + '<h1>Already using Family Sync on another phone?</h1>' +
      (FLAGS.google ? '<div class="panel"><h3>If you linked Google there</h3><p class="small muted">Sign in with the same Google account and your family logs come back here.</p><div class="actions">' + googleBtn("signin", "Continue with Google") + '</div></div>' : "") +
      '<div class="panel"><h3>' + (FLAGS.google ? "Otherwise, invite this phone" : "Invite this phone") + '</h3><ol class="small steps"><li>On the other phone, open <b>Family Sync</b> and tap <b>Invite someone</b>.</li><li>Open that invite link on this phone, or type the code here.</li><li>Pick yourself from the list, and you\'re in.</li></ol>' +
      '<div class="actions"><a class="btn btn-primary" href="#/join">Type an invite code</a></div></div>' +
      (FLAGS.email ? '<p class="small"><a href="#/sync/email">Sign in with an email code instead</a></p>' : "");
  }
  function signedInNote() {
    var g = localSignedIn(); if (gAcct && !gAcct.linked) g = null;
    return g && g.email ? '<p class="small muted">Signed in with Google as ' + esc(g.email) + '. Start your family log or join with an invite.</p>' : "";
  }
  /** Settings (Backup page): sign in / Family Sync next to Backup. */
  function settingsPanel() {
    var c = cfg();
    if (!CFG.showEntry && !on()) return '<div class="panel syncsettings">' + googleRow() + '</div>';
    return '<div class="panel syncsettings"><h3>' + esc(entryLabel()) + '</h3><p class="muted small">' + (on() ? "This log syncs with " + esc(c.familyName || "your family") + "." : "Share one log across everyone's phones, or sign in to get your family logs back on this device.") + '</p>' +
      '<div class="actions"><a class="btn btn-ghost" href="#/sync">' + (on() ? "Family Sync settings" : "Turn on Family Sync") + '</a></div>' + googleRow() + '</div>';
  }

  // ---------- email: sign in on a new phone, or keep your spot ----------
  function viewEmail() {
    var upgrading = on();
    main.innerHTML = back("#/sync") + '<h1>' + (upgrading ? "Keep your spot with email" : "Sign in with email") + '</h1><div class="panel">' +
      '<p class="small muted">' + (upgrading ? "We'll send a 6-digit code. After that, you can get back into the family log on any phone." : "Use the email you added on your other phone. We'll send a 6-digit code.") + '</p>' +
      '<div class="field"><label for="em">Email</label><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>' +
      '<div class="actions"><button class="btn btn-primary" id="esend">Send my code</button></div>' +
      '<div class="field" id="otpbox" hidden><label for="otp">6-digit code</label><input id="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="codein" placeholder="123456"><div class="actions"><button class="btn btn-beacon" id="ever">Confirm</button></div></div>' +
      '<p class="err" id="eerr" hidden></p><p class="hint">No code after a few minutes? Check spam. We can only send a few emails an hour while Family Sync is in testing, so an invite code is quickest.</p></div>';
    var email = "";
    document.getElementById("esend").onclick = function () {
      var b = this; email = String(document.getElementById("em").value || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("eerr", new Error("That email doesn't look right."));
      err("eerr"); busy(b, true, "Sending…");
      remote().then(function (r) { return upgrading ? r.addEmail(email) : r.sendCode(email, false); })
        .then(function () { busy(b, false); b.textContent = "Send again"; document.getElementById("otpbox").hidden = false; document.getElementById("otp").focus(); A.toast("Code sent to " + email); })
        .catch(function (e) { busy(b, false); err("eerr", friendly(e)); });
    };
    document.getElementById("ever").onclick = function () {
      var b = this, code = String(document.getElementById("otp").value || "").replace(/\D/g, ""), r;
      if (code.length !== 6) return err("eerr", new Error("The code is 6 numbers."));
      err("eerr"); busy(b, true, "Checking…");
      remote().then(function (x) { r = x; return r.verifyCode(email, code, upgrading ? "email_change" : "email"); }).then(function (u) {
        if (upgrading) { var c = cfg(); c.anonymous = false; c.email = email; return save(c).then(function () { A.toast("Saved. You can sign in with " + email + " on any phone."); location.hash = "#/sync"; }); }
        return welcomeBack(r, u, email);
      }).catch(function (e) { busy(b, false); err("eerr", friendly(e)); });
    };
  }
  /** Signed in on this phone (email code or Google): bring the family logs here. */
  function welcomeBack(r, u, email) {
        return r.myFamilies(u.userId).then(function (rows) {
          if (!rows || !rows.length) { A.toast("You're signed in. Start your family log or join with an invite."); location.hash = "#/sync"; if (location.hash === "#/sync") A.route(); return; }
          var f = rows.filter(function (x) { return !S.logForFamily(reg(), x.family_id); })[0];
          if (!f) { A.toast("Welcome back! Your family logs are already on this phone."); location.hash = "#/sync"; return; }
          if (on()) return addFamilyLogs(rows.filter(function (x) { return !S.logForFamily(reg(), x.family_id); }), u.userId, { anonymous: false, email: email })
            .then(function () { A.toast("Welcome back! Your other family logs are in the family menu at the top."); location.hash = "#/sync"; });
          var extra = rows.filter(function (x) { return x !== f && !S.logForFamily(reg(), x.family_id); });
          var keepLocal = A.state.kids.length ? confirm("Put this phone's log together with " + S.familyTitle(f.families && f.families.name) + "? (Cancel keeps them apart: we'll save a backup and use the family's log here.)") : true;
          return (keepLocal ? Promise.resolve() : A.doBackup().then(function () { return A.tx(["kids", "trips", "photos"], "readwrite", function (s) { s.forEach(function (st) { st.clear(); }); }); }))
            .then(function () { return save(freshCfg(f.family_id, u.userId, { familyName: f.families ? f.families.name : "", role: f.role, anonymous: false, email: email })); })
            .then(function () { return addFamilyLogs(extra, u.userId, { anonymous: false, email: email }); })
            .then(A.load).then(function () { return syncNow({ throwErrors: true, quiet: true }); })
            .then(function () { A.toast("Welcome back! Your family log is on this phone now."); location.hash = "#/"; });
        });
  }


  /** Signing in on a new phone when you're in more than one family: each extra family gets its own log, ready to sync when opened. */
  function addFamilyLogs(rows, uid, extra) {
    return rows.reduce(function (p, f) {
      return p.then(function () {
        var r = reg(); if (S.linkedCount(r) >= S.MAX_FAMILIES) return;
        var db = S.addLog(r, f.families ? f.families.name : ""), c2 = freshCfg(f.family_id, uid, Object.assign({ familyName: f.families ? f.families.name : "", role: f.role, seenAll: true }, extra || {}));
        S.updateLog(r, db, Object.assign({ familyId: f.family_id, name: c2.familyName }, c2.myPerson ? { myPerson: c2.myPerson, myName: c2.myName || "" } : {})); regSave(r);
        return A.txIn(db, "meta", "readwrite", function (s) { s.put({ key: "sync", value: c2 }); });
      });
    }, Promise.resolve());
  }

  // ---------- leave / delete ----------
  function viewLeave(checked) {
    var c = cfg(); if (!c) { location.hash = "#/sync"; return; }
    var owner = c.role === "owner", alone = (c.members || []).length <= 1;
    if (!checked) remote().then(function (r) { return r.members(c.familyId); }).then(function (rows) {   // someone may have left since the last sync
      if (!rows || location.hash !== "#/sync/leave" || !cfg()) return;
      var n = rows.length; c.members = rows; save(c);
      if ((n <= 1) !== alone) viewLeave(true);
    }).catch(function () {});
    main.innerHTML = back("#/sync", "Family") + '<h1>Leave or delete</h1>' +
      '<div class="panel"><h3>Leave ' + esc(c.familyName || "the family") + '</h3><p class="small muted">This phone stops syncing and keeps its own copy of everything. ' +
      (alone ? "You're the only one in, so the family's cloud copy and its photos are deleted too." : "The family keeps the shared log, including trips you added." + (owner ? " The longest-standing grown-up becomes the organizer." : "")) + '</p>' +
      '<div class="actions"><button class="btn btn-danger" id="lleave">Leave the family log</button></div></div>' +
      (owner && !alone ? '<div class="panel"><h3>Delete the family\'s cloud copy</h3><p class="small muted">Removes the shared log and all shared photo copies for everyone. Each phone keeps what it has on the device.</p><div class="actions"><button class="btn btn-danger" id="lwipe">Delete the cloud copy for everyone</button></div></div>' : "") +
      '<div class="panel"><h3>Delete my cloud account</h3><p class="small muted">Leaves the family and deletes your sign-in' + (c.email ? " (" + esc(c.email) + ")" : "") + '. Nothing on this phone is deleted.</p><div class="actions"><button class="btn btn-danger" id="lacct">Delete my cloud account</button></div></div>' +
      '<p class="err" id="lerr" hidden></p>';
    function finish(msg) {
      return save(null).then(function () {
        setStatus("off"); A.toast(msg);
        if (HERE !== S.DEFAULT_DB && confirm("Also remove " + (c.familyName || "this log") + " from this phone? We'll save a backup file first. (Cancel keeps it here as a log that isn't shared.)"))
          return A.doBackup().then(function () { forgetLog(HERE); });
        location.hash = "#/";
      });
    }
    function wipeFiles(r) { return r.listFiles(c.familyId).then(function (paths) { return r.removeFiles(paths); }).catch(function () {}); }
    document.getElementById("lleave").onclick = function () {
      if (!confirm(alone ? "Leave and delete the family's cloud copy? This phone keeps everything." : "Leave " + (c.familyName || "the family") + "? This phone keeps everything.")) return;
      var r; remote().then(function (x) { r = x; return alone ? wipeFiles(r) : null; }).then(function () { return r.rpc("leave_family", { p_family: c.familyId }); })
        .then(function () { return finish("You've left the family log. Everything is still on this phone."); }).catch(function (e) { err("lerr", friendly(e)); });
    };
    var w = document.getElementById("lwipe");
    if (w) w.onclick = function () {
      if (!confirm("Delete the shared log for everyone in " + c.familyName + "? Phones keep their own copies.")) return;
      var r; remote().then(function (x) { r = x; return wipeFiles(r); }).then(function () { return r.rpc("delete_family", { p_family: c.familyId }); })
        .then(function () { return finish("The family's cloud copy is deleted."); }).catch(function (e) { err("lerr", friendly(e)); });
    };
    document.getElementById("lacct").onclick = function () {
      if (!confirm("Delete your cloud account and leave the family? This phone keeps everything.")) return;
      var r; remote().then(function (x) { r = x; return alone ? wipeFiles(r) : null; }).then(function () { return r.rpc("delete_my_account"); }).then(function () { return r.signOut(); })
        .then(function () { return finish("Your cloud account is deleted. Everything is still on this phone."); }).catch(function (e) { err("lerr", friendly(e)); });
    };
  }


  // ---------- "this is me", and the family logs on this phone ----------
  function mePanel(c) {
    var p = c.myPerson ? A.kidById(c.myPerson) : null;
    return '<div class="panel mepanel"><h3>This is you</h3>' + (p ? '<p class="row">' + dot(p) + ' <span><b>' + esc(M.who(p)) + '</b> <span class="muted small">in ' + esc(c.familyName || "this log") + '</span></span></p>'
      : '<p class="small muted">Pick which person on the log is you, so stamps you mark go on your own passport, and trips you add can also go to your other family logs.</p>') +
      '<div class="actions"><a class="btn btn-ghost" href="#/sync/me">' + (p ? "Change" : "Choose which one is me") + '</a></div></div>';
  }
  function logsPanel() {
    var r = reg(), full = S.linkedCount(r) >= S.MAX_FAMILIES;
    return '<div class="panel logspanel"><h3>Family logs on this phone</h3>' + r.logs.map(function (l) {
      return '<div class="row"><span class="fam-ic small" aria-hidden="true">' + (l.familyId ? "🏡" : "📱") + '</span><span class="nm"><b>' + esc(S.logLabel(l)) + '</b><span>' +
        esc(l.db === HERE ? "Open now" : l.familyId ? "Syncs when you open it" : "Not shared") + '</span></span>' +
        (l.db === HERE ? '<span class="pill on">✓</span>' : '<button type="button" class="pill" data-open-log="' + esc(l.db) + '">Open</button>') + '</div>';
    }).join("") +
      (full ? '<p class="small muted">You\'re in ' + S.MAX_FAMILIES + ' families, the most for now.</p>' : '<div class="actions"><a class="btn btn-ghost" href="#/sync/addjoin">＋ Join another family</a><a class="btn btn-ghost" href="#/sync/new">＋ Start another family log</a></div>') + '</div>';
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-open-log]");
    if (b) { e.preventDefault(); switchTo(b.getAttribute("data-open-log"), "#/"); }
  });
  function viewMe() {
    var c = cfg(); if (!c) { location.hash = "#/sync"; return; }
    var taken = {}; (c.members || []).forEach(function (m) { if (m.person_id && m.user_id !== c.userId) taken[m.person_id] = 1; });
    var list = A.state.kids.map(function (p) { return { id: p.id, name: p.name, color: p.color, taken: !!taken[p.id] }; });
    main.innerHTML = back("#/sync", "Family") + '<h1>Which one is you?</h1><p class="lede small">If you\'re also in another family (say, your own and your parents\'), pick yourself in each one. Then any trip you\'re on can be added to your other family\'s log with one tap.</p>' +
      '<div class="panel">' + (list.length ? peoplePicker("mepick", list, c.myPerson || "") : '<p class="muted">Add yourself to the log first.</p>') + '<p class="err" id="meerr" hidden></p><div class="actions"><button class="btn btn-beacon" id="mego">That\'s me</button></div></div>';
    document.getElementById("mego").onclick = function () {
      var b = this, sel = main.querySelector("input[name=mepick]:checked"); if (!sel) return err("meerr", new Error("Pick a person."));
      var pid = sel.value, p = A.kidById(pid);
      if (sel.dataset.taken && !confirm("This will link this device to " + (p ? p.name : "that person") + ". Only continue if that's you.")) return;
      busy(b, true, "Saving…");
      remote().then(function (r) { return r.updateMe(c.familyId, c.userId, { person_id: pid }).then(function () { return r.linkPerson(c.familyId, pid, c.userId).catch(function () {}); }); })
        .then(function () {
          c.myPerson = pid; c.myName = p ? p.name : c.myName;
          (c.members || []).forEach(function (m) { if (m.user_id === c.userId) m.person_id = pid; });
          return save(c);
        }).then(function () { A.toast("Got it, that's you!"); location.hash = "#/sync"; })
        .catch(function (e) { busy(b, false); err("meerr", friendly(e)); });
    };
  }
  function viewLogs() {
    main.innerHTML = back("#/", "Home") + '<h1>Your family logs</h1><p class="lede small">Each family gets its own log on this phone, synced on its own and backed up on its own.</p>' + logsPanel();
  }

  // ---------- the family button at the top ----------
  function renderChip() {
    var top = document.querySelector(".topright"); if (!top) return;
    var el = document.getElementById("famchip"), r = reg(), l = S.findLog(r, HERE) || { db: HERE };
    var show = r.logs.length > 1 || on();
    if (!show) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement("button"); el.type = "button"; el.id = "famchip"; el.className = "famchip"; el.setAttribute("aria-haspopup", "true"); el.setAttribute("aria-expanded", "false");
      top.insertBefore(el, top.firstChild);
      el.onclick = function (e) { e.stopPropagation(); toggleMenu(); };
    }
    el.hidden = false;
    var name = S.logLabel(on() ? Object.assign({}, l, { familyId: cfg().familyId, name: cfg().familyName || l.name }) : l);
    el.innerHTML = '<span aria-hidden="true">' + (on() ? "🏡" : "📱") + '</span> <span class="fcname">' + esc(name) + '</span> <span aria-hidden="true">▾</span>';
    el.setAttribute("aria-label", "Family log: " + name + ". Switch family");
  }
  /** Keep the menu on screen: a bottom sheet on narrow phones, otherwise under the button, clamped 8px inside the viewport. */
  function placeMenu() {
    var m = document.getElementById("fammenu"), chip = document.getElementById("famchip"), sc = document.getElementById("fmscrim"); if (!m || !chip) return;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight, rc = chip.getBoundingClientRect(), sheet = vw < 480;
    m.classList.toggle("sheet", sheet); if (sc) sc.hidden = !sheet;
    if (sheet) { m.style.left = m.style.right = m.style.top = ""; m.style.maxHeight = Math.max(160, vh - Math.max(rc.bottom, 0) - 16) + "px"; return; }
    var w = Math.min(320, vw - 16), top = Math.max(8, rc.bottom + 6);
    var left = rc.right > vw / 2 ? rc.right - w : rc.left;                       // near the right edge: line up the right sides
    left = Math.max(8, Math.min(left, vw - 8 - w));
    m.style.width = w + "px"; m.style.left = left + "px"; m.style.right = "auto"; m.style.top = top + "px";
    m.style.maxHeight = Math.max(120, vh - top - 8) + "px";
  }
  window.addEventListener("resize", placeMenu);
  window.addEventListener("orientationchange", function () { setTimeout(placeMenu, 150); });
  window.addEventListener("scroll", placeMenu, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", placeMenu);
  function closeMenu() { var sc = document.getElementById("fmscrim"); if (sc) sc.remove(); var m = document.getElementById("fammenu"); if (m) m.remove(); var c = document.getElementById("famchip"); if (c) c.setAttribute("aria-expanded", "false"); }
  // the logo (logo.js) and any navigation close the menu, scrim included
  window.addEventListener("hashchange", closeMenu);
  function markView() { document.body.classList.toggle("fsui", /^#\/(sync|join|backup)/.test(location.hash)); }   // Family Sync, join and Backup screens: roomy tap targets
  window.addEventListener("hashchange", markView); markView();
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".brand")) closeMenu(); }, true);
  function toggleMenu() {
    if (document.getElementById("fammenu")) { dismissed = true; return closeMenu(); }
    var r = reg(), m = document.createElement("div"), c = cfg(), grown = !c || c.role !== "kid";
    m.id = "fammenu"; m.className = "fammenu"; m.setAttribute("role", "menu"); m.setAttribute("aria-label", "Family logs");
    m.innerHTML = (on() ? "" : '<a role="menuitem" class="fmitem turnon" href="#/sync"><span aria-hidden="true">☁</span> <span class="nm">Turn on ' + esc(entryLabel()) + '</span></a>') +
      '<div class="fmtop"><span class="fmhead small muted">Switch family log</span><button type="button" class="fmx" data-close-menu aria-label="Close menu">✕</button></div>' + r.logs.map(function (l) {
      var cur = l.db === HERE;
      return '<button type="button" role="menuitem" class="fmitem' + (cur ? " cur" : "") + '"' + (cur ? ' data-current="1" aria-current="true"' : ' data-open-log="' + esc(l.db) + '"') + '><span aria-hidden="true">' + (l.familyId ? "🏡" : "📱") + '</span> <span class="nm">' + esc(S.logLabel(l)) + '</span>' + (cur ? ' <span aria-hidden="true">✓</span>' : "") + '</button>';
    }).join("") +
      '<div class="fmsep" role="separator"></div>' +
      (grown ? '<a role="menuitem" class="fmitem add" href="' + (on() ? "#/sync/invite" : "#/sync") + '">✉︎ Invite someone</a>' : "") +
      '<a role="menuitem" class="fmitem add" href="#/sync/addjoin">＋ Join another family</a><a role="menuitem" class="fmitem add" href="#/sync/new">＋ Start another family log</a>' +
      '<a role="menuitem" class="fmitem add" href="#/cup">🏆 Cousin Cup</a><a role="menuitem" class="fmitem add" href="#/stations">📍 Stamp stations</a><a role="menuitem" class="fmitem add" href="#/postcards">💌 Postcards</a>' +
      '<a role="menuitem" class="fmitem add" href="#/sync">⚙︎ ' + esc(entryLabel()) + ' settings</a>' +
      menuGoogle();
    var scrim = document.createElement("div"); scrim.id = "fmscrim"; scrim.className = "fmscrim";
    document.body.appendChild(scrim); document.body.appendChild(m);
    placeMenu();
    document.getElementById("famchip").setAttribute("aria-expanded", "true");
    var first = m.querySelector(".fmitem:not(.cur)"); if (first) first.focus();
  }
  document.addEventListener("click", function (e) {
    var inMenu = e.target.closest && e.target.closest("#fammenu");
    if (!inMenu) { if (document.getElementById("fammenu")) dismissed = true; closeMenu(); }
    else if (e.target.closest(".fmitem.cur, [data-close-menu]")) { dismissed = true; closeMenu(); }
    else if (e.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || document.querySelector(".ppk-bg")) return;   // the place picker (placepick.js) handles its own Esc
    if (document.getElementById("fammenu")) { dismissed = true; closeMenu(); }
    else if (document.querySelector(".sheetbg")) { dismissed = true; document.querySelectorAll(".sheetbg").forEach(function (x) { x.remove(); }); }
  });

  // ---------- Back closes what's open (Android back button, browser Back) ----------
  // Opening the family menu or a bottom sheet adds a history entry, so Back closes it instead of leaving the screen.
  // Dismissed (✕, tap outside, Esc): that entry is taken back off. Closed by an action (a link, Save): it's marked spent and Back skips it.
  var ovlOpen = false, dismissed = false;
  function ovlCheck() {
    var now = !!(document.getElementById("fammenu") || document.querySelector(".sheetbg"));
    if (now && !ovlOpen) { ovlOpen = true; if (!(history.state && history.state.fsovl === 1)) history.pushState({ fsovl: 1 }, ""); }
    else if (!now && ovlOpen) {
      ovlOpen = false;
      if (history.state && history.state.fsovl === 1) history.back();   // still on the same screen (a Save, ✕, Esc): take the entry off so the next Back leaves the screen
    }
    if (!now) dismissed = false;
  }
  new MutationObserver(ovlCheck).observe(document.body, { childList: true });
  document.addEventListener("click", function (e) { var bg = e.target.closest && e.target.closest(".sheetbg"); if (bg && (e.target === bg || e.target.closest("[data-close]"))) dismissed = true; }, true);
  window.addEventListener("popstate", function () {
    if (history.state && history.state.fsovl === 2) return history.back();   // a spent entry: keep going
    if (ovlOpen && !(history.state && history.state.fsovl === 1)) { ovlOpen = false; closeMenu(); document.querySelectorAll(".sheetbg").forEach(function (x) { x.remove(); }); }
  });

  // ---------- "also add to my other family's log" ----------
  function tripExtra(t) {
    var c = cfg(); if (!c || !c.myPerson || t.kidIds.indexOf(c.myPerson) < 0) return "";
    var done = (A.state.meta.copies || {})[t.id] || [], src = t.copiedFrom || {};
    return S.copyTargets(reg(), HERE).filter(function (l) { return l.familyId !== src.familyId; }).map(function (l) {
      return done.indexOf(l.db) >= 0 ? '<div class="small muted alsoin noprint">✓ Also in ' + esc(l.name || "your other family log") + '</div>'
        : '<button type="button" class="linkbtn alsoadd noprint" data-copy-trip="' + esc(t.id) + '" data-copy-to="' + esc(l.db) + '">＋ Also add to ' + esc(l.name || "my other family log") + '</button>';
    }).join("") + (src.familyName ? '<div class="small muted alsoin">Copied from ' + esc(src.familyName) + '</div>' : "");
  }
  function copyTripTo(tripId, db) {
    var c = cfg(), t = A.state.trips.filter(function (x) { return x.id === tripId; })[0], l = S.findLog(reg(), db);
    if (!c || !t || !l || !l.myPerson) return Promise.reject(new Error("Pick which one is you in that family first."));
    var now = new Date().toISOString(), copy = S.copyTrip(t, l.myPerson, { familyName: c.familyName, familyId: c.familyId }, M.uid("trip"), now);
    return (t.photoId ? A.getOne("photos", t.photoId) : Promise.resolve(null)).then(function (ph) {
      var newPh = ph ? { id: M.uid("photo"), dataUrl: ph.dataUrl } : null;
      if (newPh) copy.photoId = newPh.id; else delete copy.photoId;
      return A.txIn(db, ["kids", "trips", "photos"], "readwrite", function (s) {
        var g = s[0].get(l.myPerson);
        g.onsuccess = function () {
          var p = g.result; if (!p) return;   // that person is gone from that log: add nothing
          M.applyTripMark(copy, [p]); p.updatedAt = now; s[0].put(p);
          s[1].put(copy); if (newPh) s[2].put(newPh);
        };
      });
    }).then(function () {
      var copies = Object.assign({}, A.state.meta.copies || {}); copies[tripId] = (copies[tripId] || []).concat([db]);
      return A.setMeta("copies", copies);
    }).then(function () { return A.txIn(db, "trips", "readonly", function (s) { return s.get(copy.id); }); }).then(function (got) {
      if (!got) throw new Error("Couldn't find you in that family log. Open it and choose which one is you.");
      return l;
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy-trip]"); if (!b) return;
    b.disabled = true;
    copyTripTo(b.getAttribute("data-copy-trip"), b.getAttribute("data-copy-to")).then(function (l) {
      A.toast("Added to " + (l.name || "your other family log") + "! It shares when you open that log."); rerender();
    }).catch(function (x) { b.disabled = false; A.toast(friendly(x).message); });
  });

  /** Drop a log from the list; its database is deleted the next time another log is open (it can't be while it's in use). */
  function forgetLog(db) {
    var r = reg(); S.removeLog(r, db); regSave(r);
    try { var tr = JSON.parse(localStorage.getItem("mltl-trash") || "[]"); if (tr.indexOf(db) < 0) tr.push(db); localStorage.setItem("mltl-trash", JSON.stringify(tr)); } catch (e) {}
    switchTo(r.active, "#/");
  }
  function emptyTrash() {
    try {
      var tr = JSON.parse(localStorage.getItem("mltl-trash") || "[]"), keep = [];
      tr.forEach(function (db) { if (db === HERE || db === S.DEFAULT_DB) keep.push(db); else A.deleteDb(db); });
      localStorage.setItem("mltl-trash", JSON.stringify(keep.filter(function (d) { return d !== S.DEFAULT_DB; })));
    } catch (e) {}
  }

  // ---------- family feed ----------
  function viewFeed() {
    document.title = "Family feed · Famstamp";
    var c = cfg(), items = S.feed(A.state.trips, c ? c.authors : {}, 30);
    main.innerHTML = back(on() ? "#/sync" : "#/", on() ? "Family" : "Home") + '<h1>Family feed</h1><p class="lede small">The newest trips from everyone' + (c ? " in " + esc(c.familyName) : "") + '.</p>' +
      (items.length ? '<div class="feed">' + items.map(feedItem).join("") + '</div>' : '<div class="panel"><p class="muted">No trips yet. Add one and it shows up here for the whole family.</p></div>');
    A.fillPhotos();
  }
  function feedItem(it) {
    var t = it.trip, who = t.kidIds.map(A.kidById).filter(Boolean), route = M.routeText(t), owner = who[0];
    return '<article class="feeditem">' + '<div class="fhead"><span class="dots">' + who.map(function (p) { return dot(p); }).join("") + '</span><span class="small"><b>' + esc(M.joinNames(who.map(function (p) { return M.who(p); }))) + '</b> went to <b>' + esc(t.place) + '</b></span></div>' +
      (t.photoId ? '<img alt="" data-photo="' + esc(t.photoId) + '">' : "") +
      '<div class="fbody">' + (route !== t.place ? '<div class="route small">' + esc(route) + '</div>' : "") + (t.memory ? '<p class="mem">' + esc(t.memory) + '</p>' : "") +
      '<div class="small muted">' + esc([M.prettyDate(t.date), it.by ? "added by " + it.by : "", S.ago(it.at)].filter(Boolean).join(" · ")) + '</div>' +
      (owner ? '<a class="small" href="#/p/' + esc(owner.id) + '/trips">See ' + esc(owner.name) + '\'s trips →</a>' : "") + '</div></article>';
  }

  // ---------- home card ----------
  function homeCard() {
    if (on()) {
      var c = cfg(), items = S.feed(A.state.trips, c.authors, 2);
      return '<a class="panel familycard synccard" href="#/sync"><span class="fam-ic" aria-hidden="true">🏡</span><span><h3>' + esc(c.familyName || "Family log") + '</h3><span class="muted small">' +
        (c.members || []).length + ((c.members || []).length === 1 ? " member" : " members") + ' · ' + esc(status === "synced" ? "synced " + S.ago(c.lastSync) : status === "offline" ? "offline, saved on this phone" : status === "syncing" ? "syncing…" : "sync paused") +
        '</span><br><span class="small">Invite someone, see the family feed →</span></span></a>' +
        (items.length ? '<div class="feed mini">' + items.map(function (it) {
          var who = it.trip.kidIds.map(A.kidById).filter(Boolean);
          return '<a class="row" href="#/feed"><span class="dots">' + who.map(function (p) { return dot(p); }).join("") + '</span><span class="nm"><b>' + esc(it.trip.place) + '</b><span>' + esc(M.joinNames(who.map(function (p) { return M.who(p); })) + (it.by ? " · added by " + it.by : "") + " · " + S.ago(it.at)) + '</span></span></a>';
        }).join("") + '</div>' : "");
    }
    return "";   // while sync is off, homeTop() shows the invitation near the top instead
  }
  function homeTop() {
    var t = homeTop0();
    return t && !on() && FLAGS.google && !signedInNote() ? t + '<div class="actions gtop">' + googleBtn("signin", "Continue with Google") + '</div>' : t;
  }
  function homeTop0() {
    if (on()) {
      var c = cfg();
      if (!(c.myPerson && A.kidById(c.myPerson)) && A.state.kids.length) return '<a class="panel familycard menudge" href="#/sync/me"><span class="fam-ic" aria-hidden="true">🙋</span><span><h3>Which one is you?</h3><span class="small">Pick yourself once, so stamps you mark go on your own passport →</span></span></a>';
      return FLAGS.google && c.anonymous !== false && !c.googleNudgeOff ? '<div class="panel gnudge"><p class="small"><b>Link Google so you can sign in on the web.</b> Your phone and computer become the same you, in every family.</p><div class="actions">' + googleBtn("link", "Link Google") + '<a class="btn btn-ghost small" href="#/sync">Later</a></div></div>' : "";
    }
    if (!CFG.showEntry) return "";
    return '<a class="panel familycard synccard synctop" href="#/sync"><span class="fam-ic" aria-hidden="true">👨‍👩‍👧‍👦</span><span><h3>Family Sync</h3><span class="muted small">Share one log across everyone\'s phones. Grandma can join with a code.</span><br><span class="btn btn-beacon small synccta">Turn on ' + esc(entryLabel()) + ' →</span></span></a>';
  }


  // ---------- Google account row: always on Settings and in the family menu, never hidden ----------
  // gAcct is what Supabase says (checked on load); until then we go by what this device remembers.
  var gAcct = null;
  function localSignedIn() { try { var g = JSON.parse(localStorage.getItem("mltl-signedin") || "null"); return g && g.email ? g : null; } catch (e) { return null; } }
  function googleState() {
    if (gAcct) return gAcct;
    var c = cfg();
    if (on()) return { linked: c.anonymous === false && !!c.email, email: c.anonymous === false ? c.email || "" : "" };
    var g = localSignedIn(); return { linked: !!g, email: g ? g.email : "" };
  }
  function gKind() { return on() ? "link" : "signin"; }
  function googleRow() {
    var g = googleState();
    return '<div class="grow" data-grow="' + (g.linked ? "in" : "out") + '"><span class="g gbig" aria-hidden="true">G</span><span class="gtxt"><b>Google account</b><span class="small' + (g.linked ? "" : " muted") + '">' +
      (g.linked ? esc(g.email || "Google") + ' · <span class="gok">Signed in</span>' : "Not signed in") + '</span></span>' +
      (g.linked ? '<button type="button" class="btn btn-ghost small" data-gsignout>Sign out</button>' : googleBtn(gKind(), "Sign in with Google")) + '</div>';
  }
  function menuGoogle() {
    var g = googleState();
    if (g.linked) return '<div class="fmitem fmg" data-grow="in"><span class="g" aria-hidden="true">G</span> <span class="nm">' + esc(g.email || "Google") + '<span class="small muted gsub">Signed in with Google</span></span><button type="button" role="menuitem" class="btn btn-ghost small" data-gsignout>Sign out</button></div>';
    return '<button type="button" role="menuitem" class="fmitem add fmg" data-grow="out" data-google="' + gKind() + '"><span class="g" aria-hidden="true">G</span> Sign in with Google</button>';
  }
  function redrawGoogle() {
    if (/^#\/(sync|backup)/.test(location.hash)) A.route();
    var m = document.getElementById("fammenu"), old = m && m.querySelector(".fmg");
    if (old) { var t = document.createElement("div"); t.innerHTML = menuGoogle(); old.replaceWith(t.firstChild); }
  }
  /** Self-heal: a device that says "signed in" but whose account has no email and no Google is really anonymous, so the
      Google buttons come back. (Before v18 a failed return from Google could leave anonymous:false with an empty email.) */
  function checkGoogle() {
    var c = cfg(), fixed = false;
    if (c && c.familyId && c.anonymous === false && !c.email) { c.anonymous = true; c.email = ""; fixed = true; }
    try { var raw = JSON.parse(localStorage.getItem("mltl-signedin") || "null"); if (raw && !raw.email) localStorage.removeItem("mltl-signedin"); } catch (e) { localStorage.removeItem("mltl-signedin"); }
    var p = fixed ? save(c) : Promise.resolve();
    if (!on() && !localSignedIn()) { gAcct = { linked: false, email: "" }; return p.then(redrawGoogle); }
    return p.then(remote).then(function (r) {
      return r.whoami ? r.whoami() : r.session().then(function (s) { return s && Object.assign({ google: !s.anon && !!s.email }, s); });
    }).then(function (u) {
      var linked = !!(u && !u.anon && (u.email || u.google)), c2 = cfg();
      gAcct = { linked: linked, email: linked ? u.email || "" : "" };
      if (!linked) {
        try { localStorage.removeItem("mltl-signedin"); } catch (e) {}
        if (c2 && c2.familyId && c2.anonymous === false) { c2.anonymous = true; c2.email = ""; return save(c2); }
      } else if (c2 && c2.familyId && (c2.anonymous !== false || c2.email !== gAcct.email)) { c2.anonymous = false; c2.email = gAcct.email; return save(c2); }
    }).then(redrawGoogle, function () { redrawGoogle(); });   // offline: keep what this device remembers
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-gsignout]"); if (!b) return;
    var c = cfg();
    if (!confirm(on() ? "Sign out of Google on this device? " + (c.familyName || "This family log") + " stops syncing here until you sign in with Google again. Everything stays on this device." : "Sign out of Google on this device? Everything stays on this device.")) return;
    busy(b, true, "Signing out…");
    remote().then(function (r) { return r.signOut(); }).catch(function () {}).then(function () {
      try { localStorage.removeItem("mltl-signedin"); } catch (e) {}
      gAcct = { linked: false, email: "" }; closeMenu();
      return on() ? save(null).then(function () { setStatus("off"); }) : null;
    }).then(function () { A.toast("Signed out of Google. Sign in again any time to get your family logs back."); redrawGoogle(); A.route(); });
  });

  // ---------- Google (behind FLAGS.google until the provider is set up in Supabase) ----------
  function googleBtn(kind, label, code) {
    if (!FLAGS.google) return "";
    return '<button type="button" class="btn btn-ghost gbtn" data-google="' + kind + '"' + (code ? ' data-code="' + esc(code) + '"' : "") + '><span class="g" aria-hidden="true">G</span> ' + esc(label) + '</button>';
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-google]"); if (!b) return;
    var kind = b.getAttribute("data-google"); busy(b, true, "Opening Google…");
    try { localStorage.setItem("mltl-oauth", JSON.stringify({ kind: kind, db: HERE, at: Date.now(), code: b.getAttribute("data-code") || "" })); } catch (x) {}
    var left = false, stuck = setTimeout(function () { if (left) return; busy(b, false); A.toast("Google didn't open. Check your connection and tap it again."); }, 10000);
    window.addEventListener("pagehide", function () { left = true; clearTimeout(stuck); }, { once: true });
    remote().then(function (r) { return r.google(kind === "link" && on() ? "link" : "signin"); }).catch(function (x) {
      clearTimeout(stuck); busy(b, false); try { localStorage.removeItem("mltl-oauth"); } catch (y) {}
      var m = friendly(x).message; oauthNote = { ok: false, msg: m }; A.toast(m); if (/^#\/sync/.test(location.hash)) A.route(); else location.hash = "#/sync";
    });
  });
  /** Back from Google: the URL has ?code=… (or ?error=…). Finish signing in, then tidy the URL. */
  function oauthReturn() {
    var q = location.search, intent = null;
    if (/^#.*\berror(_description)?=/.test(location.hash) && !/[?&]error/.test(q)) q = "?" + location.hash.slice(1).replace(/^\/?\??/, "");   // errors can come back in the #fragment
    if (!/[?&](code|error|error_description)=/.test(q)) return;
    try { intent = JSON.parse(localStorage.getItem("mltl-oauth") || "null"); localStorage.removeItem("mltl-oauth"); } catch (x) {}
    if (!intent || Date.now() - intent.at > 30 * 60 * 1000) intent = { kind: on() ? "link" : "signin", code: "", at: Date.now() };   // back without our note (older version, other tab): still finish
    var params = new URLSearchParams(q), bad = params.get("error_description") || params.get("error"), code = params.get("code");
    function tidy(hash) { history.replaceState(null, "", location.pathname + (hash || "#/sync")); A.route(); }
    function fail(m) { oauthNote = { ok: false, msg: scrub(m) }; tidy("#/sync"); A.toast(oauthNote.msg); checkGoogle(); }
    if (bad) { fail(friendly(new Error(bad)).message); return; }
    var r;
    remote().then(function (x) { r = x; return r.finishOAuth ? r.finishOAuth(code) : r.session(); }).then(function (u) {
      if (!u || u.anon) throw new Error("Google sign-in didn't finish on this phone. Tap \"Try Google again\".");
      oauthNote = { ok: true, msg: "Signed in" + (u.email ? " as " + u.email : "") + ". Use the same Google account on the web or a new phone and you'll be the same you." };
      try { if (u.email) localStorage.setItem("mltl-signedin", JSON.stringify({ email: u.email, at: Date.now() })); } catch (x) {}
      gAcct = { linked: true, email: u.email || "" };
      if (intent.kind === "link" && on()) {
        var c = cfg(); c.anonymous = false; c.email = u.email || c.email || "";
        return save(c).then(function () { tidy("#/sync"); A.toast("Saved. Sign in with Google on any phone to get your family logs back."); });
      }
      history.replaceState(null, "", location.pathname + "#/sync");
      if (intent.kind === "join" && intent.code) { location.hash = "#/join/" + intent.code; return; }   // the invite again, now as the Google account (login = identity)
      return welcomeBack(r, u, u.email || "");
    }).catch(function (x) { fail(friendly(x).message); });
  }

  function backupTag() {
    var c = cfg(), l = S.findLog(reg(), HERE) || {};
    var name = c && c.familyId ? c.familyName : (HERE !== S.DEFAULT_DB ? l.name || "log" : "");
    var t = S.slug(name); return t ? t + "-" : "";
  }

  // ---------- wiring ----------
  window.MLTL_onChange = function (store) { if (store !== "meta") { schedule(2500); countPending(); } };
  window.MLTL_SYNC = {
    peopleCap: function () { var c = cfg(); return c && c.plan && c.plan.founder ? (c.plan.max_people || 10) : 0; },
    route: function (h) {
      if (h[0] === "sync") { viewSync(h[1]); return true; }
      if (h[0] === "join") { viewJoin(h[1]); return true; }
      if (h[0] === "feed") { viewFeed(); return true; }
      return false;
    },
    homeCard: homeCard, homeTop: homeTop, settingsPanel: settingsPanel, isOn: on, syncNow: syncNow, status: function () { return status; },
    pending: function () { return pendingN; }, countPending: countPending, tripExtra: tripExtra, backupTag: backupTag,
    logs: reg, switchTo: switchTo,
    photoNote: function () { return on() ? "We shrink it and keep the full photo on this device. A small copy is shared with your family log. Location data is removed." : null; },
    storageNote: function () { return on() ? "Your maps are on this device and synced with " + (cfg().familyName || "your family log") + ". A backup file is still a good idea." : null; },
    // for follow.js (grandparent follow-along): call() signs in first; open() is for the read-only page (no sign-in)
    follow: {
      cfg: function () { return cfg(); },
      access: function () { var c = cfg(); return S.access(c && c.plan, FLAGS); },
      call: function (fn, args) { return remote().then(function (r) { return ensureSession(r).then(function () { return r.rpc(fn, args); }); }); },
      open: function (fn, args) { return remote().then(function (r) { return r.rpc(fn, args); }); }
    },
    // for push.js: notifications for this signed-in person
    push: {
      on: function () { return on(); }, key: function () { return CFG.pushKey || ""; },
      save: function (a) { return remote().then(function (r) { return ensureSession(r).then(function () { return r.pushSave(a); }); }); },
      test: function (endpoint) { return remote().then(function (r) { return ensureSession(r).then(function () { return r.pushTest(endpoint); }); }); }
    },
    // for highlights.js: reactions for this family, as the signed-in member
    hl: {
      on: function () { return on(); }, cfg: function () { return cfg(); },
      list: function () { var c = cfg(); return remote().then(function (r) { return ensureSession(r).then(function () { return r.reactions(c.familyId); }); }); },
      react: function (ref, emoji, add) { var c = cfg(); return remote().then(function (r) { return ensureSession(r).then(function () { return r.react(c.familyId, c.userId, ref, emoji, add); }); }); }
    },
    // for cup.js: Cousin Cup calls, as the signed-in member (missing functions are flagged so the page can say "almost ready")
    cup: {
      on: function () { return on(); }, cfg: function () { return cfg(); },
      rpc: function (fn, args) { return remote().then(function (r) { return ensureSession(r).then(function () { return r.cupRpc ? r.cupRpc(fn, args) : r.rpc(fn, args); }); }); }
    },
    _core: S, _confetti: confetti, _cheer: cheer
  };
  // ?join=CODE links: turn them into the in-app join screen
  (function () {
    var m = /[?&]join=([^&#]+)/.exec(location.search), f = /[?&]for=([\w-]{1,64})/.exec(location.search);
    var rl = /[?&]rel=(grandparent|auntuncle|friend|parent|other)\b/.exec(location.search);
    if (m && rl) try { sessionStorage.setItem("mltl-join-rel", JSON.stringify({ code: S.normCode(decodeURIComponent(m[1])), rel: rl[1] })); } catch (x) {}
    if (m && f) try { sessionStorage.setItem("mltl-join-for", JSON.stringify({ code: S.normCode(decodeURIComponent(m[1])), pid: f[1] })); } catch (x) {}
    if (m) history.replaceState(null, "", location.pathname + "#/join/" + encodeURIComponent(S.normCode(decodeURIComponent(m[1]))));
  })();
  window.addEventListener("online", function () { offlineChip(); schedule(500); if (window.FS_HL && window.FS_HL.flush) window.FS_HL.flush(); });
  window.addEventListener("offline", function () { countPending(0); offlineChip(); if (on()) setStatus("offline", "Changes are saved on this phone and will sync when you're back online."); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") schedule(800); });
  setInterval(function () { if (document.visibilityState === "visible") syncNow(); }, 90000);
  A.ready.then(function () {
    var c = cfg(), l = S.findLog(reg(), HERE);
    if (!l || (c && c.familyId ? l.familyId !== c.familyId || (c.familyName && l.name !== c.familyName) : l.familyId)) noteLog(c);   // keep the list in step with this log
    if (!on()) setStatus("off"); renderChip(); emptyTrash();
    if (/[?&#](code|error|error_description)=/.test(location.search + location.hash)) oauthReturn(); else checkGoogle();
    if (on()) { setStatus("syncing"); schedule(300); }
    countPending(0); offlineChip();
  });
})();
