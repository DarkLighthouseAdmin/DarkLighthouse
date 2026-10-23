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
  var FLAGS = { testing: !!CFG.testing, google: !!CFG.google || GOOGLE_TRY };
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
    location.hash = hash || "#/"; location.reload();
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
    if (/rate limit|over_email_send_rate_limit|too many/i.test(m)) return new Error("Too many emails were sent just now. Wait a few minutes and try again, or use an invite code.");
    if (/Failed to fetch|NetworkError|offline|Load failed/i.test(m)) return new Error("You're offline. Your log is safe on this phone; try again when you're connected.");
    if (/expired|invalid.*(otp|token)|Token has expired/i.test(m)) return new Error("That code didn't work or has expired. Ask for a new one.");
    if (/identity.*already|already linked|identity_already_exists/i.test(m)) return new Error("That Google account is already used with Famstamp on another phone. Open Family Sync there, or sign in with it here from \"I already set this up on another phone\".");
    if (/manual linking|provider is not enabled|Unsupported provider/i.test(m)) return new Error("Google sign-in isn't switched on yet. Use an invite code or email for now.");
    return new Error(m.replace(/^.*?:\s*/, "") || "Something went wrong. Try again.");
  }
  function chk(r) { if (r && r.error) throw friendly(r.error); return r ? r.data : null; }
  function sbAdapter(sb) {
    var B = CFG.bucket || "trip-photos";
    function user(u) { return u ? { userId: u.id, email: u.email || u.new_email || "", anon: !!u.is_anonymous } : null; }
    return {
      session: function () { return sb.auth.getSession().then(function (r) { return r.data && r.data.session ? user(r.data.session.user) : null; }); },
      signInAnon: function () { return sb.auth.signInAnonymously().then(chk).then(function (d) { return user(d.user); }); },
      sendCode: function (email, create) { return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: !!create, emailRedirectTo: location.origin + location.pathname } }).then(chk); },
      verifyCode: function (email, token, type) { return sb.auth.verifyOtp({ email: email, token: token, type: type || "email" }).then(chk).then(function (d) { return user(d.user); }); },
      addEmail: function (email) { return sb.auth.updateUser({ email: email }, { emailRedirectTo: location.origin + location.pathname }).then(chk); },
      signOut: function () { return sb.auth.signOut().catch(function () {}); },
      // Google: an anonymous member links Google to the same account (their families come along); anyone else signs in with it.
      google: function () {
        var opts = { provider: "google", options: { redirectTo: location.origin + location.pathname } };
        return sb.auth.getSession().then(function (r) {
          var u = r.data && r.data.session && r.data.session.user;
          return u && u.is_anonymous ? sb.auth.linkIdentity(opts) : sb.auth.signInWithOAuth(opts);
        }).then(chk);
      },
      rpc: function (fn, args) { return sb.rpc(fn, args || {}).then(chk); },
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
      members: function (fid) { return sb.from("family_members").select("*").eq("family_id", fid).order("joined_at").then(chk); },
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
      return sbAdapter(window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "mltl-auth" } }));
    }).catch(function (e) { remoteP = null; throw friendly(e); });
    return remoteP;
  }
  function ensureSession(r) {
    return r.session().then(function (s) { return s || r.signInAnon(); });
  }

  // ---------- status pill ----------
  var status = "off", statusMsg = "";
  function setStatus(s, msg) {
    status = s; statusMsg = msg || "";
    renderChip();
    var el = document.getElementById("syncpill"); if (!el) return;
    el.hidden = !on() && !CFG.showEntry;   // while sync is off it's the way in: "Family Sync" right next to Back up
    var L = { synced: ["✓", "Synced"], syncing: ["↻", "Syncing"], offline: ["☁", "Offline"], error: ["!", "Sync paused"], off: ["☁", entryLabel()] }[on() ? s : "off"] || ["", ""];
    el.className = "syncpill s-" + s;
    el.innerHTML = '<span aria-hidden="true">' + L[0] + '</span><span class="sl"> ' + esc(L[1]) + '</span>';
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
  function syncNow(opts) {
    if (!on()) { setStatus("off"); return Promise.resolve(); }
    if (running) { again = true; return running; }
    if (navigator.onLine === false) { setStatus("offline", "Changes are saved on this phone and will sync when you're back online."); return Promise.resolve(); }
    setStatus("syncing");
    running = doSync(opts || {}).then(function (ch) {
      setStatus("synced"); return ch;
    }).catch(function (e) {
      var m = friendly(e).message;
      setStatus(/offline/i.test(m) ? "offline" : "error", m);
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
    var c = cfg(), fid = c.familyId, r, acc, changed = false, celebrate = [];
    return remote().then(function (x) { r = x; return r.session(); }).then(function (sess) {
      if (!sess) throw new Error("Signed out. Open Family Sync to sign back in.");
      return Promise.all([r.family(fid), r.members(fid)]);
    }).then(function (fm) {
      var fam = fm[0], members = fm[1] || [];
      if (!fam) return dropped();
      c.familyName = fam.name; c.plan = { plan: fam.plan, keeper_until: fam.keeper_until, trial_ends_at: fam.trial_ends_at }; c.home = fam.home || "";
      var me = members.filter(function (m) { return m.user_id === c.userId; })[0]; if (me) c.role = me.role;
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
      if (changed) return A.load().then(rerender);
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
                changed = true; return A.put("photos", { id: d.id, dataUrl: u, thumb: true }, true);
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
  function rerender() {
    var h = location.hash;
    if (/\/(new|edit)\b|^#\/add|^#\/join|^#\/sync\/(email|create)/.test(h)) return;   // don't yank a form out from under someone
    A.clearPhotos(); A.route();
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
    var name = p ? p.name : "?";
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
      return '<label style="--kid:' + esc(p.color) + '"><input type="radio" name="' + name + '" value="' + esc(p.id) + '"' + (p.id === selected ? " checked" : "") + (p.taken ? " disabled" : "") + '> ' + dot(p) + ' ' + esc(p.name) + (p.taken ? ' <span class="muted small">(already joined)</span>' : "") + '</label>';
    }).join("") + (extra || "") + '</div>';
  }

  // ---------- screens ----------
  function viewSync(sub) {
    document.title = "Family Sync · Famstamp";
    if (sub === "invite") return viewInvite();
    if (sub === "email") return viewEmail();
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
      '<a class="btn btn-ghost" href="#/sync/email">I already set this up on another phone</a>' + googleBtn("signin", "Continue with Google") + '</div>' +
      '<p class="hint">Family Sync is optional. Without it, everything stays on this device only, just like now. ' + (FLAGS.testing ? "While we test with families, every Family Keeper feature is free." : "") + '</p>';
  }

  function viewCreate() {
    if (on()) { location.hash = "#/sync"; return; }
    var people = A.state.kids, guess = (people.filter(function (p) { return p.role !== "kid"; })[0] || {}).id || "";
    main.innerHTML = back("#/sync") + '<h1>Start your family log</h1><div class="panel">' +
      '<div class="field" style="margin-top:0"><label for="fname">Family name</label><input id="fname" type="text" maxlength="40" placeholder="e.g. Hill, or The Hill crew" autocomplete="off"></div>' +
      '<p class="small muted" id="fprev">Invites will say: "You\'re joining your family\'s log!"</p>' +
      '<div class="field"><label>Which one is you?</label>' + (people.length ? peoplePicker("me", people, guess, '<label><input type="radio" name="me" value=""' + (guess ? "" : " checked") + '> I\'m not on the list yet</label>') : "") + '</div>' +
      '<div class="field" id="mynamebox"' + (guess ? " hidden" : "") + '><label for="myname">Your name or nickname</label><input id="myname" type="text" maxlength="40" placeholder="e.g. Mom, Dad, Matt"></div>' +
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
    var members = (c.members || []).map(function (m) {
      var p = memberPerson(m);
      return '<div class="row member">' + dot(p) + '<span class="nm"><b>' + esc(m.display_name || p.name) + (m.user_id === c.userId ? ' <span class="muted small">(you)</span>' : "") + '</b><span>' + esc(ROLE_NAME[m.role] || "") + ' · joined ' + esc(S.ago(m.joined_at)) + '</span></span>' +
        (owner && m.user_id !== c.userId ? '<button type="button" class="pill" data-rm="' + esc(m.user_id) + '" aria-label="Remove ' + esc(m.display_name) + '">Remove</button>' : "") + '</div>';
    }).join("");
    main.innerHTML = back("#/", "Home") + '<h1>' + esc(c.familyName || "Family log") + '</h1>' +
      '<div class="syncstate"><span class="syncpill s-' + esc(status) + '">' + (status === "synced" ? "✓ Synced" : status === "syncing" ? "↻ Syncing" : status === "offline" ? "☁ Offline" : status === "error" ? "! Sync paused" : "") + '</span>' +
      '<span class="small muted">' + esc(statusMsg || (c.lastSync ? "Last synced " + S.ago(c.lastSync) : "Not synced yet")) + '</span><button type="button" class="linkbtn" id="snow">Sync now</button></div>' +
      '<div class="actions">' + (grown ? '<a class="btn btn-beacon" href="#/sync/invite">＋ Invite someone</a>' : "") + '<a class="btn btn-primary" href="#/feed">📰 Family feed</a></div>' +
      '<h2>Who\'s in <span class="muted small">' + (c.members || []).length + '</span></h2><div class="panel members">' + (members || '<p class="muted">Just you so far.</p>') + '</div>' +
      mePanel(c) + logsPanel() +
      '<div class="panel"><h3>Plan</h3><p class="small">' + esc(acc.label) + '</p><p class="small muted">Family Keeper (' + esc(CFG.price || "") + ') will cover everyone you invite with one subscription. Nothing is charged today.</p></div>' +
      (c.anonymous !== false ? '<div class="panel"><h3>Keep your spot</h3><p class="small muted">You joined without an email. Add one so you can get back into the family log on a new phone. Optional.</p><div class="actions"><a class="btn btn-ghost" href="#/sync/email">Add my email</a>' + googleBtn("link", "Use my Google account") + '</div></div>' : "") +
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
    remote().then(function (r) { return r.session(); }).then(function (s) { if (s && !s.anon && c.anonymous !== false) { c.anonymous = false; c.email = s.email; save(c); viewHub(); } }).catch(function () {});
  }

  var lastInvite = null;
  function viewInvite() {
    var c = cfg(); if (!c) { location.hash = "#/sync"; return; }
    document.title = "Invite · Famstamp";
    main.innerHTML = back("#/sync", "Family") + '<h1>Invite the crew</h1><p class="lede small">Send the link, or let them scan the code. It works for 7 days, up to 10 people.</p>' +
      '<div class="seg" role="group" aria-label="Who are you inviting?"><button type="button" data-irole="adult" aria-pressed="true">A grown-up</button><button type="button" data-irole="kid" aria-pressed="false">A kid with their own phone</button></div>' +
      '<div class="panel invite" id="invbox"><p class="muted">Making a code…</p></div><p class="err" id="ierr" hidden></p>' +
      '<h2>Open invites</h2><div class="panel" id="invlist"><p class="muted small">Loading…</p></div>';
    var role = "adult";
    function make() {
      var box = document.getElementById("invbox"); box.innerHTML = '<p class="muted">Making a code…</p>'; err("ierr");
      Promise.all([remote().then(function (r) { return r.rpc("create_invite", { p_family: c.familyId, p_role: role, p_days: 7, p_max_uses: 10 }); }), needQR()]).then(function (res) {
        var inv = Array.isArray(res[0]) ? res[0][0] : res[0]; lastInvite = inv; showInvite(inv); list();
      }).catch(function (e) { box.innerHTML = ""; err("ierr", friendly(e)); });
    }
    function showInvite(inv) {
      var link = S.inviteLink(location.origin + location.pathname, inv.code), title = S.familyTitle(c.familyName);
      document.getElementById("invbox").innerHTML = '<div class="code" aria-label="Invite code">' + esc(inv.code) + '</div>' + qrSVG(link) +
        '<p class="small muted">Scan with a phone camera, or open the link. ' + (inv.role === "kid" ? "They'll join as a kid." : "They'll join as a grown-up.") + '</p>' +
        '<div class="actions center"><button class="btn btn-beacon" id="ishare">Share invite</button><button class="btn btn-ghost" id="icopy">Copy link</button></div>' +
        '<p class="small muted linkline">' + esc(link) + '</p>';
      var text = "Join " + title + " on Famstamp! Tap the link, or open the app and enter " + inv.code + ".";
      document.getElementById("ishare").onclick = function () {
        if (navigator.share) navigator.share({ title: "Join " + title, text: text, url: link }).catch(function () {});
        else copy(text + " " + link);
      };
      document.getElementById("icopy").onclick = function () { copy(link); };
    }
    function list() {
      remote().then(function (r) { return r.invites(c.familyId); }).then(function (rows) {
        var el = document.getElementById("invlist"); if (!el) return;
        el.innerHTML = rows.length ? rows.map(function (i) {
          return '<div class="row"><span class="nm"><b class="mono">' + esc(i.code) + '</b><span>' + esc((i.role === "kid" ? "Kid" : "Grown-up") + " · used " + i.uses + " of " + i.max_uses + " · ends " + M.prettyDate(String(i.expires_at).slice(0, 10))) + '</span></span><button type="button" class="pill" data-revoke="' + esc(i.code) + '">Turn off</button></div>';
        }).join("") : '<p class="muted small">No open invites.</p>';
        el.querySelectorAll("[data-revoke]").forEach(function (b) {
          b.onclick = function () { remote().then(function (r) { return r.rpc("revoke_invite", { p_code: b.dataset.revoke }); }).then(function () { A.toast("Invite turned off"); if (lastInvite && lastInvite.code === b.dataset.revoke) { lastInvite = null; document.getElementById("invbox").innerHTML = '<p class="muted small">That code is off. Make a new one any time.</p><div class="actions"><button class="btn btn-beacon" id="inew">New code</button></div>'; document.getElementById("inew").onclick = make; } list(); }).catch(function (e) { A.toast(friendly(e).message); }); };
        });
      }).catch(function () {});
    }
    main.querySelectorAll("[data-irole]").forEach(function (b) { b.onclick = function () { role = b.dataset.irole; main.querySelectorAll("[data-irole]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); make(); }; });
    if (lastInvite && lastInvite.family_id === c.familyId && Date.parse(lastInvite.expires_at) > Date.now() && lastInvite.role === role) needQR().then(function () { showInvite(lastInvite); list(); }); else make();
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
    code = S.codeFromLink(code || "");
    if (!code) {
      main.innerHTML = back("#/sync") + '<h1>Join your family</h1><div class="panel"><div class="field" style="margin-top:0"><label for="jcode">Invite code</label>' +
        '<input id="jcode" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="e.g. MAPLE-COMPASS-4821" class="codein"></div>' +
        '<p class="small muted">It\'s in the invite someone sent you. Spaces or dashes are fine.</p><p class="err" id="jerr" hidden></p><div class="actions"><button class="btn btn-beacon" id="jgo">Next</button></div></div>';
      var go = function () { var c2 = S.codeFromLink(document.getElementById("jcode").value); if (!c2) return err("jerr", new Error("That doesn't look like a code. It's two words and four numbers, like MAPLE-COMPASS-4821.")); location.hash = "#/join/" + c2; };
      document.getElementById("jgo").onclick = go; document.getElementById("jcode").onkeydown = function (e) { if (e.key === "Enter") go(); };
      setTimeout(function () { document.getElementById("jcode").focus(); }, 50); return;
    }
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
  function joinScreen(code, inv, sess, r) {
    var fam = inv.people || [], mine = A.state.kids, hasLocal = mine.length > 0, title = S.familyTitle(inv.family_name);
    var free = fam.filter(function (p) { return !p.taken; }), match = free.filter(function (p) { return mine.some(function (m) { return m.name.toLowerCase() === String(p.name).toLowerCase(); }); })[0];
    main.innerHTML = '<div class="synchero join"><div class="faces">' + fam.slice(0, 6).map(function (p) { return dot(p, true); }).join("") + '</div>' +
      '<h1>You\'re joining ' + esc(title) + '!</h1><p class="lede small">' + (inv.invited_by ? esc(inv.invited_by) + " invited you. " : "") + inv.members + (inv.members === 1 ? " person is" : " people are") + ' already in.' + '</p></div>' +
      '<div class="panel"><div class="field" style="margin-top:0"><label>Which one is you?</label>' +
      (fam.length ? peoplePicker("jme", fam, match ? match.id : "", '<label><input type="radio" name="jme" value=""' + (match ? "" : " checked") + '> I\'m new to the log</label>') : "") + '</div>' +
      '<div class="field" id="jnamebox"' + (match ? " hidden" : "") + '><label for="jname">Your name or nickname</label><input id="jname" type="text" maxlength="40" placeholder="e.g. Grandma, Pop, Lily"></div>' +
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
      err("jerr"); busy(b, true, "Joining…");
      var newPerson = null;
      (mode === "replace" ? A.doBackup().then(function () { return A.tx(["kids", "trips", "photos"], "readwrite", function (s) { s.forEach(function (st) { st.clear(); }); }); }).then(A.load) : Promise.resolve()).then(function () {
        if (!famP) {   // new to the log: use a matching local profile, or make one
          var loc = A.state.kids.filter(function (k) { return k.name.toLowerCase() === myName.toLowerCase(); })[0];
          if (loc) { pid = loc.id; return; }
          newPerson = M.newPerson({ name: myName, role: inv.role === "kid" ? "kid" : "adult", color: M.COLORS[(fam.length + A.state.kids.length) % M.COLORS.length] });
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
          return save(freshCfg(fid, sess.userId, { familyName: inv.family_name, role: inv.role, myPerson: pid, myName: myName, seenAll: true }));
        });
      }).then(A.load).then(function () { return syncNow({ throwErrors: true, quiet: true }); }).then(function () {
        cheer("Welcome to " + title.replace(/ log$/, "") + ", " + myName + "! 🎉", A.kidById(pid));
        location.hash = "#/";
      }).catch(function (e) { busy(b, false); err("jerr", friendly(e)); });
    };
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
          if (!rows || !rows.length) { A.toast("You're signed in, but not in a family log yet."); location.hash = "#/sync"; return; }
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
        S.updateLog(r, db, { familyId: f.family_id, name: c2.familyName }); regSave(r);
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
    return '<div class="panel mepanel"><h3>This is you</h3>' + (p ? '<p class="row">' + dot(p) + ' <span><b>' + esc(p.name) + '</b> <span class="muted small">in ' + esc(c.familyName || "this log") + '</span></span></p>'
      : '<p class="small muted">Pick which person on the log is you, so trips you add can also go to your other family logs.</p>') +
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
      var pid = sel.value, p = A.kidById(pid); busy(b, true, "Saving…");
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
  function toggleMenu() {
    if (document.getElementById("fammenu")) return closeMenu();
    var r = reg(), m = document.createElement("div"), c = cfg(), grown = !c || c.role !== "kid";
    m.id = "fammenu"; m.className = "fammenu"; m.setAttribute("role", "menu"); m.setAttribute("aria-label", "Family logs");
    m.innerHTML = (on() ? "" : '<a role="menuitem" class="fmitem turnon" href="#/sync"><span aria-hidden="true">☁</span> <span class="nm">Turn on ' + esc(entryLabel()) + '</span></a>') +
      '<div class="fmhead small muted">Switch family log</div>' + r.logs.map(function (l) {
      var cur = l.db === HERE;
      return '<button type="button" role="menuitem" class="fmitem' + (cur ? " cur" : "") + '"' + (cur ? "" : ' data-open-log="' + esc(l.db) + '"') + '><span aria-hidden="true">' + (l.familyId ? "🏡" : "📱") + '</span> <span class="nm">' + esc(S.logLabel(l)) + '</span>' + (cur ? ' <span aria-hidden="true">✓</span>' : "") + '</button>';
    }).join("") +
      '<div class="fmsep" role="separator"></div>' +
      (grown ? '<a role="menuitem" class="fmitem add" href="' + (on() ? "#/sync/invite" : "#/sync") + '">✉︎ Invite someone</a>' : "") +
      '<a role="menuitem" class="fmitem add" href="#/sync/addjoin">＋ Join another family</a><a role="menuitem" class="fmitem add" href="#/sync/new">＋ Start another family log</a>' +
      '<a role="menuitem" class="fmitem add" href="#/sync">⚙︎ ' + esc(entryLabel()) + ' settings</a>';
    var scrim = document.createElement("div"); scrim.id = "fmscrim"; scrim.className = "fmscrim";
    document.body.appendChild(scrim); document.body.appendChild(m);
    placeMenu();
    document.getElementById("famchip").setAttribute("aria-expanded", "true");
    var first = m.querySelector(".fmitem:not(.cur)"); if (first) first.focus();
  }
  document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest("#fammenu")) closeMenu(); else if (e.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

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
    return '<article class="feeditem">' + '<div class="fhead"><span class="dots">' + who.map(function (p) { return dot(p); }).join("") + '</span><span class="small"><b>' + esc(M.joinNames(who.map(function (p) { return p.name; }))) + '</b> went to <b>' + esc(t.place) + '</b></span></div>' +
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
          return '<a class="row" href="#/feed"><span class="dots">' + who.map(function (p) { return dot(p); }).join("") + '</span><span class="nm"><b>' + esc(it.trip.place) + '</b><span>' + esc(M.joinNames(who.map(function (p) { return p.name; })) + (it.by ? " · added by " + it.by : "") + " · " + S.ago(it.at)) + '</span></span></a>';
        }).join("") + '</div>' : "");
    }
    return "";   // while sync is off, homeTop() shows the invitation near the top instead
  }
  function homeTop() {
    if (on() || !CFG.showEntry) return "";
    return '<a class="panel familycard synccard synctop" href="#/sync"><span class="fam-ic" aria-hidden="true">👨‍👩‍👧‍👦</span><span><h3>Family Sync</h3><span class="muted small">Share one log across everyone\'s phones. Grandma can join with a code.</span><br><span class="btn btn-beacon small synccta">Turn on ' + esc(entryLabel()) + ' →</span></span></a>';
  }


  // ---------- Google (behind FLAGS.google until the provider is set up in Supabase) ----------
  function googleBtn(kind, label) {
    if (!FLAGS.google) return "";
    return '<button type="button" class="btn btn-ghost gbtn" data-google="' + kind + '"><span class="g" aria-hidden="true">G</span> ' + esc(label) + '</button>';
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-google]"); if (!b) return;
    var kind = b.getAttribute("data-google"); busy(b, true, "Opening Google…");
    try { localStorage.setItem("mltl-oauth", JSON.stringify({ kind: kind, db: HERE, at: Date.now() })); } catch (x) {}
    remote().then(function (r) { return r.google(); }).catch(function (x) { busy(b, false); try { localStorage.removeItem("mltl-oauth"); } catch (y) {} A.toast(friendly(x).message); });
  });
  /** Back from Google: the URL has ?code=… (or ?error=…). Finish signing in, then tidy the URL. */
  function oauthReturn() {
    var q = location.search, intent = null;
    if (!/[?&](code|error|error_description)=/.test(q)) return;
    try { intent = JSON.parse(localStorage.getItem("mltl-oauth") || "null"); localStorage.removeItem("mltl-oauth"); } catch (x) {}
    if (!intent || Date.now() - intent.at > 30 * 60 * 1000) return;
    var params = new URLSearchParams(q), bad = params.get("error_description") || params.get("error");
    function tidy(hash) { history.replaceState(null, "", location.pathname + (hash || "#/sync")); A.route(); }
    if (bad) { tidy("#/sync"); A.toast(friendly(new Error(bad)).message); return; }
    var r;
    remote().then(function (x) { r = x; return r.session(); }).then(function (u) {
      if (!u) throw new Error("Google sign-in didn't finish. Try again.");
      if (intent.kind === "link" && on()) {
        var c = cfg(); c.anonymous = false; c.email = u.email || c.email || "";
        return save(c).then(function () { tidy("#/sync"); A.toast("Saved. Sign in with Google on any phone to get your family logs back."); });
      }
      history.replaceState(null, "", location.pathname + "#/sync");
      return welcomeBack(r, u, u.email || "");
    }).catch(function (x) { tidy("#/sync"); A.toast(friendly(x).message); });
  }

  function backupTag() {
    var c = cfg(), l = S.findLog(reg(), HERE) || {};
    var name = c && c.familyId ? c.familyName : (HERE !== S.DEFAULT_DB ? l.name || "log" : "");
    var t = S.slug(name); return t ? t + "-" : "";
  }

  // ---------- wiring ----------
  window.MLTL_onChange = function (store) { if (store !== "meta") schedule(2500); };
  window.MLTL_SYNC = {
    route: function (h) {
      if (h[0] === "sync") { viewSync(h[1]); return true; }
      if (h[0] === "join") { viewJoin(h[1]); return true; }
      if (h[0] === "feed") { viewFeed(); return true; }
      return false;
    },
    homeCard: homeCard, homeTop: homeTop, isOn: on, syncNow: syncNow, status: function () { return status; }, tripExtra: tripExtra, backupTag: backupTag,
    logs: reg, switchTo: switchTo,
    photoNote: function () { return on() ? "We shrink it and keep the full photo on this device. A small copy is shared with your family log. Location data is removed." : null; },
    storageNote: function () { return on() ? "Your maps are on this device and synced with " + (cfg().familyName || "your family log") + ". A backup file is still a good idea." : null; },
    _core: S, _confetti: confetti, _cheer: cheer
  };
  // ?join=CODE links: turn them into the in-app join screen
  (function () {
    var m = /[?&]join=([^&#]+)/.exec(location.search);
    if (m) history.replaceState(null, "", location.pathname + "#/join/" + encodeURIComponent(S.normCode(decodeURIComponent(m[1]))));
  })();
  window.addEventListener("online", function () { schedule(500); });
  window.addEventListener("offline", function () { if (on()) setStatus("offline", "Changes are saved on this phone and will sync when you're back online."); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") schedule(800); });
  setInterval(function () { if (document.visibilityState === "visible") syncNow(); }, 90000);
  A.ready.then(function () {
    var c = cfg(), l = S.findLog(reg(), HERE);
    if (!l || (c && c.familyId ? l.familyId !== c.familyId || (c.familyName && l.name !== c.familyName) : l.familyId)) noteLog(c);   // keep the list in step with this log
    if (!on()) setStatus("off"); renderChip(); emptyTrash(); oauthReturn();
    if (on()) { setStatus("syncing"); schedule(300); }
  });
})();
