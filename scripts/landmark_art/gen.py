import os
import json
T = json.load(open("traced.json"))
seen, lines, cred, rows = {}, [], [], []
for r in T:
    q = r["qid"]
    if q in seen: continue
    seen[q] = 1
    lines.append('    %s: "%s"' % (q, r["d"]))
    cred.append('    %s: ["%s", "%s", "%s", "%s"]' % (q, r["name"].replace('"', '').replace(" (statue)", ""), r["artist"].replace('"', "'"), r["lic"], r["page"]))
    rows.append("| %s | %s | %s | %s | %s |" % (r["name"], q, r["artist"], r["lic"], r["page"]))
js = '''/* Famstamp v82: famous-landmark stamps. A landmark with its own drawing gets it on its Sights stamp (looked up by its Wikidata id),
   instead of its type's picture. Stamps already earned upgrade by themselves when a drawing is added; nothing is ever removed.
   Drawings: CC0 / public domain / CC BY icons from Wikimedia Commons, traced to one ink shape for the stamp (a change from the
   original). Credits (name, artist, license, source page) show under the Sights pages and in travel-log/LANDMARK-CREDITS.md. */
(function () {
  "use strict";
  var W = typeof window !== "undefined" ? window : globalThis, SA = W.WK_STAMPART; if (!SA || !SA.GLYPHS) return;
  var D = {
%s
  };
  var CREDITS = {
%s
  };
  Object.keys(D).forEach(function (q) { var d = D[q]; SA.GLYPHS["lm_" + q] = function () { return '<path fill-rule="evenodd" d="' + d + '"/>'; }; });
  function credit(q) { var c = CREDITS[q]; return c ? { name: c[0], artist: c[1], license: c[2], page: c[3] } : null; }
  W.FS_LANDMARKS = { ids: Object.keys(D), credit: credit, has: function (q) { return !!D[q]; } };
})();
''' % (",\n".join(lines), ",\n".join(cred))
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../travel-log/app/landmark-art.js"), "w").write(js)
md = ("# Famstamp landmark stamp drawings\n\nEach famous-landmark stamp uses an icon from Wikimedia Commons under CC0, public domain or CC BY, "
      "traced to a single ink shape for the stamp (so it is changed from the original). Thank you to the artists.\n\n"
      "| Landmark | Wikidata | Artist | License | Source |\n|---|---|---|---|---|\n" + "\n".join(rows) + "\n")
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../travel-log/LANDMARK-CREDITS.md"), "w").write(md)
print(len(seen))
