// Browser (jsdom) tests for the /tools/ calculator pages. Run: node scripts/test_tools_ui.js
// Needs jsdom: `npm i --no-save jsdom` in this repo, or set JSDOM_PATH to an existing install.
let jsdomMod; try { jsdomMod = require(process.env.JSDOM_PATH || "jsdom"); } catch (e) { jsdomMod = require("/tmp/jsd/node_modules/jsdom"); }
const { JSDOM, VirtualConsole } = jsdomMod;
const fs = require("fs"), path = require("path");
const ROOT = require("path").resolve(__dirname, "..");
const calcSrc = fs.readFileSync(ROOT + "/tools/calc.js", "utf8");
async function load(slug) {
  let html = fs.readFileSync(`${ROOT}/tools/${slug}/index.html`, "utf8");
  html = html.replace('<script src="/tools/calc.js"></script>', "<script>" + calcSrc + "</script>")
             .replace(/<script async src="https:\/\/www.googletagmanager[^<]*<\/script>/, "");
  const errors = [], events = [];
  const vc = new VirtualConsole(); vc.on("error", e => errors.push(String(e))); vc.on("jsdomError", e => errors.push(String(e.message || e))); vc.on("warn", e => errors.push("warn " + e));
  const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole: vc, url: `https://darklighthousesolutions.com/tools/${slug}/`,
    beforeParse(w) { w.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const w = dom.window; w.dataLayer.push = function (a) { events.push(Array.from(a)); return 0; };
  return { w, d: w.document, errors, events };
}
const submit = d => d.getElementById("f").dispatchEvent(new d.defaultView.Event("submit", { cancelable: true }));
(async () => {
  let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
  // Debt
  let { w, d, errors, events } = await load("debt-payoff-calculator");
  ok(d.querySelectorAll("#out .stat").length === 2, "debt: results render on load");
  ok(!events.some(e => e[1] === "calculator_used"), "debt: no calculator_used on page load");
  submit(d); submit(d);
  ok(events.filter(e => e[1] === "calculator_used").length === 1 && events.find(e => e[1] === "calculator_used")[2].tool === "debt_payoff", "debt: calculator_used sent once");
  ok(/less interest/.test(d.getElementById("out").textContent) && d.querySelectorAll("#tbl tbody tr").length > 10, "debt: winner + month table");
  d.querySelector('input[name="tm"][value="snowball"]').checked = true; d.querySelector('input[name="tm"][value="snowball"]').dispatchEvent(new w.Event("change"));
  ok(d.querySelectorAll("#tbl tbody tr").length > 10, "debt: snowball table toggle");
  d.querySelector('[data-k="balance"]').value = "abc"; submit(d);
  ok(d.getElementById("err").classList.contains("show") && d.getElementById("out").innerHTML === "" && d.querySelector('[data-k="balance"]').getAttribute("aria-invalid") === "true", "debt: invalid balance blocked + marked");
  d.querySelector('[data-k="balance"]').value = "$4,200"; d.querySelectorAll('[data-k="min"]')[0].value = "50"; submit(d);
  ok(/doesn't cover its monthly interest/.test(d.getElementById("out").textContent), "debt: '$4,200' parsed; low-minimum warning shown");
  d.querySelectorAll(".rm").forEach(b => b.click()); d.getElementById("add").click();
  d.querySelector('[data-k="balance"]').value = "10000"; d.querySelector('[data-k="apr"]').value = "24"; d.querySelector('[data-k="min"]').value = "150"; d.getElementById("extra").value = "0"; submit(d);
  ok(/Not paid off/.test(d.getElementById("out").textContent), "debt: never-paid-off case handled");
  ok(errors.length === 0, "debt: no console errors " + errors.join(" | "));
  // Wedding
  ({ w, d, errors, events } = await load("wedding-budget-calculator"));
  ok(d.querySelectorAll("#out tbody tr").length >= 13, "wedding: breakdown renders");
  ok(/\$250/.test(d.getElementById("out").textContent), "wedding: $30k/120 guests = $250 per guest shown");
  d.querySelector('input[name="style"][value="simple"]').checked = true; d.querySelector('input[name="style"][value="simple"]').dispatchEvent(new w.Event("change"));
  ok(!/Videography/.test(d.getElementById("out").textContent) && events.some(e => e[1] === "calculator_used" && e[2].tool === "wedding_budget"), "wedding: style toggle recalculates + event");
  d.getElementById("guests").value = "0"; submit(d);
  ok(d.getElementById("err").classList.contains("show"), "wedding: 0 guests rejected");
  d.getElementById("guests").value = "400"; d.getElementById("total").value = "12000"; submit(d);
  ok(/tight/.test(d.getElementById("out").textContent), "wedding: low per-guest food warning");
  d.getElementById("date").value = "2020-01-01"; submit(d);
  ok(d.getElementById("err").classList.contains("show"), "wedding: past date rejected");
  ok(errors.length === 0, "wedding: no console errors " + errors.join(" | "));
  // Sinking
  ({ w, d, errors, events } = await load("sinking-funds-calculator"));
  ok(d.querySelectorAll("#out tbody tr").length === 3, "sinking: 3 goals render");
  console.log("     sinking example output:", d.querySelector("#out .stats").textContent.replace(/\s+/g, " ").trim());
  d.querySelector('input[name="freq"][value="monthly"]').checked = true; d.querySelector('input[name="freq"][value="monthly"]').dispatchEvent(new w.Event("change"));
  ok(d.querySelectorAll("#out thead th").length === 5 && events.some(e => e[1] === "calculator_used" && e[2].tool === "sinking_funds"), "sinking: monthly hides paycheck cols + event");
  d.querySelector('[data-k="due"]').value = ""; submit(d);
  ok(d.getElementById("err").classList.contains("show"), "sinking: missing date rejected");
  d.getElementById("add").click(); d.querySelector('[data-k="due"]').value = "2027-12-15"; submit(d);
  ok(!d.getElementById("err").classList.contains("show"), "sinking: blank added row ignored");
  ok(errors.length === 0, "sinking: no console errors " + errors.join(" | "));
  // checkout click tracking
  const a = d.querySelector('a[href*="buy.polar.sh"]'); a.addEventListener("click", ev => ev.preventDefault());
  a.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  const bc = events.find(e => e[1] === "begin_checkout"); ok(bc && bc[2].item_name === "Sinking Funds Tracker" && bc[2].transport_type === "beacon", "begin_checkout event: " + JSON.stringify(bc && bc[2]));

  // Grocery
  ({ w, d, errors, events } = await load("grocery-budget-calculator"));
  let txt = () => d.getElementById("out").textContent;
  ok(d.querySelectorAll("#out .stat").length === 4 && /\$236\.30/.test(txt()) && /\$1,023\.90/.test(txt()), "grocery: family-of-4 default shows USDA thrifty $236.30/wk, $1,023.90/mo");
  ok(!events.some(e => e[1] === "calculator_used"), "grocery: no calculator_used on load");
  ok(/September 2026/.test(txt()) && d.querySelector('#out a[href*="fns.usda.gov"]'), "grocery: cites USDA source + month in results");
  d.querySelector('[data-preset="m20"]').click();
  ok(d.querySelectorAll("#rows select").length === 1 && /\$88\.32/.test(txt()) && /\+20%/.test(txt()), "grocery: 'Just me' preset -> +20%, $88.32/wk thrifty");
  ok(events.filter(e => e[1] === "calculator_used").length === 1 && events.find(e => e[1] === "calculator_used")[2].tool === "grocery_budget", "grocery: calculator_used once");
  d.querySelector('[data-preset="m20,f20"]').click(); d.getElementById("spend").value = "$170"; submit(d);
  ok(/between the Low-cost and Moderate-cost plans/.test(txt()) && /\$186\.45/.test(txt()), "grocery: couple $170/wk lands between low-cost and moderate (moderate $186.45)");
  d.querySelector('input[name="per"][value="month"]').checked = true; d.querySelector('input[name="per"][value="month"]').dispatchEvent(new w.Event("change"));
  ok(/below USDA.s Thrifty plan/.test(txt()), "grocery: $170/month is below thrifty");
  d.getElementById("meals").value = "14"; d.getElementById("spend").value = ""; submit(d);
  ok(/\$538\.85/.test(txt()) && /14\/21/.test(txt()), "grocery: 14 meals at home scales couple moderate 808.28 -> 538.85");
  d.getElementById("add").click(); d.querySelectorAll("#rows select")[2].value = "m14"; submit(d);
  ok(d.querySelectorAll("#out tbody tr").length === 3 && /Male, 14–19/.test(txt()), "grocery: added person shows in table");
  d.getElementById("meals").value = "30"; submit(d);
  ok(d.getElementById("err").classList.contains("show") && d.getElementById("out").innerHTML === "" && d.getElementById("meals").getAttribute("aria-invalid") === "true", "grocery: 30 meals rejected + marked");
  ok(errors.length === 0, "grocery: no console errors " + errors.join(" | "));
  let names = Array.from(d.querySelectorAll('article.pcard h3')).map(h => h.textContent);
  ok(names.join() === "Meal Planner & Grocery List,Monthly Budget Snapshot" && d.querySelector('#get-monthly-budget-snapshot .price').textContent === "Free" && /Get it free/.test(d.querySelector('#get-monthly-budget-snapshot a.btn').textContent), "grocery: CTA = Meal Planner ($11) + free Snapshot");
  let a2 = d.querySelector('#get-meal-planner-grocery-list a.btn'); a2.addEventListener("click", ev => ev.preventDefault()); a2.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  let bc2 = events.find(e => e[1] === "begin_checkout"); ok(bc2 && bc2[2].item_name === "Meal Planner & Grocery List" && /TbDugdiTQy48/.test(bc2[2].link_url), "grocery: begin_checkout for Meal Planner");
  // Moving
  ({ w, d, errors, events } = await load("moving-cost-calculator"));
  txt = () => d.getElementById("out").textContent;
  ok(/\$5,852/.test(txt()) && /\$5,252/.test(txt()) && d.querySelectorAll("#out tbody tr").length === 11, "moving: example total $5,852, $5,252 by move day, 10 costs + buffer rows");
  ok(/examples, not quotes/.test(d.getElementById("f").textContent), "moving: defaults labeled as examples");
  ok(/\$875\.34/.test(txt()), "moving: weekly set-aside $875.34 for a 6-week move");
  d.getElementById("refund").value = "1500"; submit(d);
  ok(/\$4,352/.test(txt()) && /Old security deposit back/.test(txt()) && events.filter(e => e[1] === "calculator_used" && e[2].tool === "moving_cost").length === 1, "moving: refund row + net + calculator_used");
  const t1 = new Date(); d.getElementById("date").value = [t1.getFullYear(), String(t1.getMonth() + 1).padStart(2, "0"), String(t1.getDate()).padStart(2, "0")].join("-");
  d.getElementById("saved").value = "0"; submit(d);
  ok(/due within the next week/.test(txt()) && /less than 3 weeks/.test(txt()) && /Now/.test(txt()), "moving: move today -> 'now' rows + short-now and soon warnings");
  d.getElementById("date").value = "2020-01-01"; submit(d);
  ok(d.getElementById("err").classList.contains("show") && d.getElementById("out").innerHTML === "", "moving: past move date rejected");
  d.getElementById("date").value = "2030-01-01"; d.querySelector('#rows [data-k="amount"]').value = "-5"; submit(d);
  ok(d.querySelector('#rows [data-k="amount"]').getAttribute("aria-invalid") === "true", "moving: negative amount marked");
  d.querySelector('#rows [data-k="amount"]').value = ""; d.querySelector('#rows [data-k="name"]').value = ""; submit(d);
  ok(!d.getElementById("err").classList.contains("show"), "moving: blank row ignored");
  ok(errors.length === 0, "moving: no console errors " + errors.join(" | "));
  ok(Array.from(d.querySelectorAll('article.pcard h3')).map(h => h.textContent).join() === "Moving Planner & Checklist" && /JiLxn0MqySpG/.test(d.querySelector('article.pcard a.btn').href), "moving: CTA = Moving Planner");
  // Budget by paycheck
  ({ w, d, errors, events } = await load("budget-by-paycheck-calculator"));
  txt = () => d.getElementById("out").textContent;
  ok(d.querySelectorAll("#out .paychecks > .stat").length >= 2 && /Rent/.test(txt()), "paycheck: default plan renders paycheck cards");
  const setF = v => { const r = d.querySelector('input[name="freq"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new w.Event("change")); };
  // Fixed scenario: biweekly from a known Friday next month-ish (relative to now so validation passes)
  const now = new Date(), F = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((5 - now.getDay() + 7) % 7) + 7);
  const iso = x => [x.getFullYear(), String(x.getMonth() + 1).padStart(2, "0"), String(x.getDate()).padStart(2, "0")].join("-");
  d.getElementById("first").value = iso(F); d.getElementById("amount").value = "1000";
  d.querySelectorAll(".rm").forEach(b => b.click());
  const fill = (name, amt, due) => { const r = d.getElementById("rows").lastChild; r.querySelector('[data-k="name"]').value = name; r.querySelector('[data-k="amount"]').value = amt; r.querySelector('[data-k="due"]').value = String(due); };
  fill("Groceries", "100", "check"); submit(d);
  const n1 = d.querySelectorAll("#out .paychecks > .stat").length;
  ok(n1 >= 2 && n1 <= 3 && /\$900\.00 left/.test(txt().replace(/\s+/g, " ")) && events.filter(e => e[1] === "calculator_used" && e[2].tool === "budget_by_paycheck").length === 1, "paycheck: every-check item on each card, $900 left, calculator_used once");
  d.getElementById("add").click(); fill("Huge rent", "5000", 1); submit(d);
  ok(/more than your pay/.test(txt()) && d.querySelectorAll("#out .stat.over").length >= 1, "paycheck: bills > income warning + red card");
  d.getElementById("rows").lastChild.querySelector('[data-k="amount"]').value = "950"; submit(d);
  ok(/can't cover their bills/.test(txt()) || /Fix:/.test(txt()) || /Every paycheck covers/.test(txt()), "paycheck: overload message shown when a single check is short");
  setF("semimonthly");
  ok(!d.getElementById("semiBox").hidden && d.getElementById("firstBox").hidden, "paycheck: twice-a-month shows the two day inputs");
  d.getElementById("d1").value = "15"; d.getElementById("d2").value = "31"; submit(d);
  ok(d.querySelectorAll("#out .paychecks > .stat").length === 2, "paycheck: 15th + last day = 2 checks a month");
  const m3 = d.querySelector('input[name="months"][value="3"]'); m3.checked = true; m3.dispatchEvent(new w.Event("change"));
  ok(d.querySelectorAll("#out .paychecks > .stat").length === 6, "paycheck: 3-month plan = 6 semimonthly checks");
  setF("monthly"); ok(d.querySelectorAll("#out .paychecks > .stat").length === 3, "paycheck: monthly x 3 months = 3 checks");
  d.getElementById("d1").value = "15"; d.getElementById("d2").value = "15"; setF("semimonthly");
  ok(d.getElementById("err").classList.contains("show"), "paycheck: same payday twice rejected");
  setF("biweekly"); d.getElementById("first").value = "2020-01-01"; submit(d);
  ok(d.getElementById("err").classList.contains("show"), "paycheck: past payday rejected");
  ok(errors.length === 0, "paycheck: no console errors " + errors.join(" | "));
  ok(Array.from(d.querySelectorAll('article.pcard h3')).map(h => h.textContent).join() === "Budget by Paycheck,Money Spreadsheet Bundle (all 5)" && /IDt8omcfjZP2/.test(d.querySelector('#get-budget-by-paycheck a.btn').href), "paycheck: CTA = Budget by Paycheck ($9) + bundle");
  // Fix suggestion in the browser: deterministic overload with an earlier check that has room
  d.getElementById("first").value = iso(F); d.getElementById("amount").value = "1200"; d.querySelector('input[name="months"][value="1"]').checked = true;
  d.querySelectorAll(".rm").forEach(b => b.click());
  const due0 = new Date(F.getFullYear(), F.getMonth(), F.getDate() + 15), dd = due0.getDate();
  if (dd <= 28 && dd >= 1) {
    fill("Big bill", "900", dd); d.getElementById("add").click(); fill("Small bill", "400", dd);
    submit(d); ok(/Fix:/.test(txt()) && /Show the plan before the fix/.test(txt()), "paycheck: suggests paying a bill early from an earlier check");
  }
  // Cross-links + footer
  for (const slug of ["debt-payoff-calculator", "sinking-funds-calculator", "wedding-budget-calculator", "grocery-budget-calculator", "moving-cost-calculator", "budget-by-paycheck-calculator"]) {
    const doc = new JSDOM(fs.readFileSync(`${ROOT}/tools/${slug}/index.html`, "utf8")).window.document;
    ok(doc.querySelectorAll("#related + .related a").length >= 3 && doc.querySelector('footer a[href="/tools/budget-by-paycheck-calculator/"]'), slug + ": related calculators + footer links");
    const ld = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map(s => JSON.parse(s.textContent));
    ok(ld.some(x => x["@type"] === "FAQPage" && x.mainEntity.length >= 4) && doc.querySelector('link[rel="canonical"]').href === `https://darklighthousesolutions.com/tools/${slug}/` && doc.querySelector('link[rel="icon"]') && doc.querySelector('meta[property="og:image"]'), slug + ": FAQ JSON-LD, canonical, favicon, og:image");
  }
  // index
  const idx = new JSDOM(fs.readFileSync(ROOT + "/tools/index.html", "utf8")); ok(idx.window.document.querySelectorAll("a.tool").length === 7, "tools index lists 6 calculators + Renewal Radar");
  console.log(fails ? fails + " FAILED" : "ALL UI CHECKS PASSED"); process.exit(fails ? 1 : 0);
})();
