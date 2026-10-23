// Math tests for /tools/calc.js. Run: node scripts/test_tools.js
const C = require("../tools/calc.js");
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b} ±${tol}`); }

// 1. Textbook amortization: $10,000 at 12% APR, payment 222.45 (222.4445 rounded up) -> 60 months, interest ~$3,346.4
let r = C.payoff([{ name: "Loan", balance: 10000, apr: 12, min: 222.45 }], 0, "avalanche");
ok(r.ok && r.months === 60, "10k@12% 222.45 should be 60 months, got " + r.months);
near(r.totalInterest, 3346.4, 1.5, "10k@12% interest");
// 2. $5,000 at 18% with $150/mo -> 47 months (standard calculators: 46.6 -> 47), interest ~$1,979
r = C.payoff([{ name: "Card", balance: 5000, apr: 18, min: 150 }], 0, "avalanche");
ok(r.months === 47, "5k@18% $150 -> 47 months, got " + r.months);
near(r.totalInterest, 1979, 10, "5k@18% interest");
// 3. 0% APR: $1,200 at $100 -> 12 months, $0 interest
r = C.payoff([{ name: "Zero", balance: 1200, apr: 0, min: 100 }], 0, "snowball");
ok(r.months === 12 && r.totalInterest === 0, "0% loan 12 months/no interest");
// 4. Mortgage-style check: $200,000 at 6% with 1199.11 -> 360 months
r = C.payoff([{ name: "M", balance: 200000, apr: 6, min: 1199.11 }], 0, "avalanche");
ok(r.months === 360, "200k@6% 1199.11 -> 360 months, got " + r.months);
// 5. Never paid off: minimum below interest
r = C.payoff([{ name: "Bad", balance: 10000, apr: 24, min: 150 }], 0, "avalanche");
ok(!r.ok && r.reason === "never", "min below interest should be flagged");
// 6. Order + conservation on a 3-debt example
const debts = [{ name: "Card A", balance: 4000, apr: 24.99, min: 120 }, { name: "Card B", balance: 900, apr: 15, min: 35 },
               { name: "Car", balance: 9000, apr: 6.5, min: 260 }];
const av = C.payoff(debts, 200, "avalanche"), sn = C.payoff(debts, 200, "snowball");
ok(av.order[0].name === "Card A", "avalanche pays highest APR first, got " + av.order[0].name);
ok(sn.order[0].name === "Card B", "snowball pays smallest balance first, got " + sn.order[0].name);
ok(av.totalInterest <= sn.totalInterest, "avalanche interest <= snowball");
for (const x of [av, sn]) {
  near(x.totalPaid, 13900 + x.totalInterest, 0.05, x.method + " paid = principal + interest");
  ok(x.rows.every(rw => rw.paid <= x.budget + 0.001), x.method + " never pays more than the monthly budget");
  ok(x.rows[x.rows.length - 1].balance === 0, x.method + " ends at zero");
}
console.log(`3-debt example, $200 extra: avalanche ${av.months} mo / $${av.totalInterest} interest; snowball ${sn.months} mo / $${sn.totalInterest}`);
// 7. Randomised: avalanche never costs more interest than snowball; both finish; conservation
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let worse = 0;
for (let t = 0; t < 2000; t++) {
  const n = 1 + Math.floor(rnd() * 5), ds = [];
  for (let k = 0; k < n; k++) { const b = 200 + Math.round(rnd() * 20000), a = Math.round(rnd() * 3000) / 100; ds.push({ name: "D" + k, balance: b, apr: a, min: Math.max(25, Math.round(b * (a / 1200 + 0.01 + rnd() * 0.02))) }); }
  const ex = Math.round(rnd() * 500), A = C.payoff(ds, ex, "avalanche"), S = C.payoff(ds, ex, "snowball");
  const P = ds.reduce((s, d) => s + d.balance, 0);
  if (!A.ok || !S.ok) { ok(false, "random case did not finish " + JSON.stringify(ds)); continue; }
  if (A.totalInterest > S.totalInterest + 0.05) worse++;
  ok(Math.abs(A.totalPaid - P - A.totalInterest) < 0.05 && Math.abs(S.totalPaid - P - S.totalInterest) < 0.05, "random conservation");
}
ok(worse === 0, `avalanche cost more than snowball in ${worse}/2000 random cases`);
// 8. Validation
ok(C.validateDebts([{ name: "", balance: 0, apr: 120, min: 0 }], -5).length === 4, "debt validation catches 4 problems");
ok(C.validateDebts(debts, 0).length === 0, "valid debts pass");

// Wedding
for (const s of Object.keys(C.WED_SPLITS)) ok(Object.values(C.WED_SPLITS[s]).reduce((a, b) => a + b, 0) === 100, s + " split sums to 100");
const today = new Date(2026, 9, 22);
const w = C.wedding(30000, 120, "classic", new Date(2027, 9, 16), today);
ok(Math.abs(w.lines.reduce((s, l) => s + l.amount, 0) - 30000) <= 7, "wedding lines add up to total");
near(w.perGuest, 250, 0.001, "per guest"); near(w.cateringPerGuest, 62.5, 0.01, "catering per guest");
ok(w.schedule.every((x, i, a) => i === 0 || a[i - 1].due <= x.due), "schedule sorted by date");
ok(w.schedule.reduce((s, x) => s + x.amount, 0) === 30000 - 1500, "schedule covers everything except buffer");
ok(w.schedule[0].due.getTime() === new Date(2026, 9, 22).getTime(), "venue deposit due (clamped to today, 12 months before Oct 16 2027 is past)");
const w2 = C.wedding(15000, 0, "simple", new Date(2027, 5, 1), today);
ok(w2.perGuest === 0 && !w2.lines.some(l => l.key === "video"), "simple style has no video line, 0 guests safe");

// Sinking funds
let s = C.sinking([{ name: "Christmas", target: 1200, saved: 0, due: new Date(2027, 9, 22) }], "monthly", today);
ok(s.goals[0].months === 12 && s.goals[0].monthly === 100, "1200 over 12 months = 100/mo, got " + s.goals[0].monthly);
s = C.sinking([{ name: "Christmas", target: 1200, saved: 0, due: new Date(2027, 9, 22) }], "biweekly", today);
ok(s.goals[0].paychecks === 26 && s.goals[0].perPaycheck === 46.16, "1200 over 26 biweekly checks = 46.16 (rounded up), got " + s.goals[0].perPaycheck);
s = C.sinking([{ name: "Car", target: 800, saved: 240, due: new Date(2027, 3, 22) }, { name: "Done", target: 100, saved: 150, due: new Date(2027, 0, 1) }], "weekly", today);
ok(s.goals[0].months === 6 && s.goals[0].monthly === 93.34, "560 over 6 months = 93.34, got " + s.goals[0].monthly);
ok(s.goals[0].paychecks === 26, "weekly checks Oct 22 -> Apr 22 = 26, got " + s.goals[0].paychecks);
ok(s.goals[1].funded && s.goals[1].monthly === 0, "over-saved goal shows funded");
ok(C.sinking([{ name: "x", target: 300, saved: 0, due: new Date(2027, 0, 21) }], "semimonthly", today).goals[0].paychecks === 4, "Oct 22 -> Jan 21: 2 full months -> 4 semimonthly checks");
ok(C.monthsUntil(new Date(2026, 10, 5), today) === 1, "due in 2 weeks -> 1 month minimum");
ok(C.validateGoals([{ name: "a", target: 0, saved: -1, due: new Date(2020, 0, 1) }], today).length === 3, "goal validation catches 3 problems");
ok(C.validateGoals([{ name: "a", target: 10, saved: 0, due: new Date("x") }], today).length === 1, "invalid date caught");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
