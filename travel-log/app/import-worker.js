/* Famstamp importer worker: reads the picked files off the main thread so a 150 MB Records.json or a stack of 50 GB
   Google Photos zips doesn't freeze the page. Everything stays on the device; this worker makes no network calls
   beyond loading its own three scripts from the app. */
importScripts("import-geo.js", "import-towns.js", "import-core.js");
var geo = null;
function G() { return geo || (geo = self.FS_IMPORT.Geo(self.FS_IMPORT_GEO, self.FS_IMPORT_TOWNS)); }
self.onmessage = function (e) {
  var d = e.data || {}, last = 0;
  if (d.type === "town") { var t = null; try { t = G().findTown(d.text); } catch (x) {} self.postMessage({ type: "town", id: d.id, town: t }); return; }
  Promise.resolve().then(function () {
    return self.FS_IMPORT.run(d.files || [], null, {
      geo: G(), homeText: d.homeText || "", cameras: d.cameras || {},
      progress: function (done, total, label) { var now = Date.now(); if (now - last > 100 || done >= total) { last = now; self.postMessage({ type: "progress", done: done, total: total, label: label || "" }); } }
    });
  }).then(function (R) { self.postMessage({ type: "result", result: R }); },
          function (x) { self.postMessage({ type: "error", message: (x && x.message) || "Couldn't read those files." }); });
};
