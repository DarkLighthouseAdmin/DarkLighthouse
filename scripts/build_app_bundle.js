#!/usr/bin/env node
/* Famstamp: join the app's scripts into one minified file for a fast first visit (v74).
   The ordered list is the commented <script> block in travel-log/app/index.html (between "bundle:start" and "bundle:end").
   Output: travel-log/app/app-bundle.js (+ .map). Needs the free `terser` package (npm i terser), e.g.
     NODE_PATH=/tmp/jsd/node_modules node scripts/build_app_bundle.js
   Edit the source files, never the bundle; rebuild before every release (a test checks the bundle matches the sources). */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const APP = path.join(__dirname, "..", "travel-log", "app");
function list() {
  const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
  const m = /<!-- bundle:start([\s\S]*?)bundle:end -->/.exec(html);
  const block = m ? m[1] : "";
  return Array.from(block.matchAll(/src="([\w.-]+\.js)"/g)).map(x => x[1]);
}
function hash(files) {
  const h = crypto.createHash("sha256");
  files.forEach(f => { h.update(f + "\n"); h.update(fs.readFileSync(path.join(APP, f))); h.update("\n"); });
  return h.digest("hex").slice(0, 16);
}
module.exports = { list, hash, APP };
if (require.main === module) {
  const { minify } = require("terser");
  const files = list(); if (files.length < 10) throw new Error("bundle list not found in index.html");
  const code = {}; files.forEach(f => { code[f] = fs.readFileSync(path.join(APP, f), "utf8") + "\n;"; });
  const sum = hash(files);
  minify(code, {
    ecma: 2017, compress: { passes: 2 }, mangle: true, toplevel: false,
    format: { comments: false, preamble: "/* Famstamp app bundle " + sum + ": " + files.length + " files joined by scripts/build_app_bundle.js. Don't edit; edit the sources and rebuild. */" },
    sourceMap: { filename: "app-bundle.js", url: "app-bundle.js.map", includeSources: false }
  }).then(r => {
    fs.writeFileSync(path.join(APP, "app-bundle.js"), r.code + "\n");
    fs.writeFileSync(path.join(APP, "app-bundle.js.map"), r.map);
    const raw = files.reduce((s, f) => s + fs.statSync(path.join(APP, f)).size, 0);
    console.log("app-bundle.js: " + files.length + " files, " + Math.round(raw / 1024) + " KB -> " + Math.round(r.code.length / 1024) + " KB (" + sum + ")");
  }).catch(e => { console.error(e); process.exit(1); });
}
