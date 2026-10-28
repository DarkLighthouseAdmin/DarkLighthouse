const potrace = require("potrace"), fs = require("fs");
const P = JSON.parse(fs.readFileSync("picked.json", "utf8")).filter(r => r.bw && r.file !== "World landmarks icons - Colosseum.svg");
const out = [];
(async () => {
  for (const r of P) {
    const tr = (f, k, opt) => new Promise((res, rej) => potrace.trace(f, Object.assign({ threshold: 128, turdSize: 6, optTolerance: 0.4, color: "#000" }, opt), (e, s) => e ? rej(e) : res(s))).then(svg => ((svg.match(/ d="([^"]+)"/) || [])[1] || "").replace(/-?\d+(\.\d+)?/g, n => String(Math.round(parseFloat(n) * k * 10) / 10)).replace(/\s+/g, " ").replace(/ ,/g, ",").trim());
    let sd = await tr(r.bw, 0.2, {});
    if (sd.length > 5000) sd = await tr(r.bw.replace("bw/", "bw/s_"), 40 / 120, { turdSize: 4, optTolerance: 0.8 });
    out.push(Object.assign({}, r, { d: sd }));
    console.log(r.qid, r.name, sd.length);
  }
  fs.writeFileSync("traced.json", JSON.stringify(out, null, 1));
})();
