/* Offline support for Famstamp (/travel-log/app/). Caches the app's own files only; your data lives in IndexedDB, never here.
   Family Sync talks to Supabase (another origin), which this worker never touches. vendor/*.js is cached the first time sync loads it,
   and the importer's place data (import-geo.js, import-towns.js) the first time someone imports. */
var CACHE = "mltl-v91";
var FILES = ["./", "index.html", "app.css", "map.css", "sync.css", "import.css", "dark.css", "theme.js", "app-bundle.js", "import-worker.js", "manifest.webmanifest",
             "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "icon.svg"];
// v74: the app's 54 scripts ship as one minified app-bundle.js (see the bundle:start block in index.html and
// scripts/build_app_bundle.js), so a first visit downloads them once instead of twice (page + this cache).
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("message", function (e) { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("mltl-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Web push (v61): show what the famstamp-push function sent; a tap opens (or focuses) Famstamp at the right page.
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(String(d.title || "Famstamp"), { body: String(d.body || ""), icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || "famstamp", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { var c = list[i]; if (c.url.indexOf(self.registration.scope) === 0 && "focus" in c) { c.navigate && c.navigate(url).catch(function () {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/download/") >= 0) return;   // the Android download page and APK go straight to the network, never into the cache
  // Cache first, then refresh the cached copy in the background so updates land on the next visit.
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(function (res) { return res || (req.mode === "navigate" ? c.match("index.html") : res); });
    });
  }));
});
