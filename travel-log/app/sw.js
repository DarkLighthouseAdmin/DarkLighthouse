/* Offline support for My Lifetime Travel Log. Caches the app's own files only; your data lives in IndexedDB, never here. */
var CACHE = "mltl-v3";
var FILES = ["./", "index.html", "app.css", "app.js", "log-core.js", "maps.js", "manifest.webmanifest",
             "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];
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
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Cache first, then refresh the cached copy in the background so updates land on the next visit.
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(function (res) { return res || (req.mode === "navigate" ? c.match("index.html") : res); });
    });
  }));
});
