/* Offline support for Famstamp (/travel-log/app/). Caches the app's own files only; your data lives in IndexedDB, never here.
   Family Sync talks to Supabase (another origin), which this worker never touches. vendor/*.js is cached the first time sync loads it,
   and the importer's place data (import-geo.js, import-towns.js) the first time someone imports. */
var CACHE = "mltl-v12";
var FILES = ["./", "index.html", "app.css", "app.js", "log-core.js", "trips-core.js", "passport-core.js", "trips-ui.js", "logo.js", "maps.js", "sync-core.js", "sync-config.js", "sync.js", "sync.css", "import-core.js", "import.js", "import.css", "import-worker.js", "manifest.webmanifest",
             "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "icon.svg"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("mltl-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
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
