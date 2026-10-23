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

// ---------------------------------------------------------------- Grocery (USDA Food Plans, Sept 2026)
// Data integrity: USDA says monthly = weekly x 4.333, each rounded to 10 cents -> every row must agree within rounding.
for (const g of C.FOOD_GROUPS) for (let k = 0; k < 4; k++) {
  const wk = g[2 + 2 * k], mo = g[3 + 2 * k];
  ok(Math.abs(wk * 4.333 - mo) <= 0.3, `USDA row ${g[0]} plan ${k}: weekly ${wk} x 4.333 ~ monthly ${mo}`);
}
ok(C.FOOD_GROUPS.length === 15 && C.FOOD_PLANS.length === 4, "15 age-sex groups, 4 plans");
// Reference family (man + woman 20-50, kids 6-8 and 9-11): USDA publishes Thrifty $236.30/wk, $1,024.00/mo
let g = C.groceries(["m20", "f20", "c6", "c9"], 21);
near(g.plans[0].weekly, 236.3, 0.001, "reference family thrifty weekly"); near(g.plans[0].monthly, 1024.0, 0.11, "reference family thrifty monthly");
ok(g.adjust === 0 && g.share === 1, "family of 4: no size adjustment, full share");
ok(g.plans.every((p, i, a) => i === 0 || p.monthly >= a[i - 1].monthly), "plans increase thrifty < low < moderate < liberal for the reference family");
// One person +20%
g = C.groceries(["m20"], 21);
near(g.plans[0].weekly, 88.32, 0.001, "single man thrifty weekly (73.60 x 1.2)"); near(g.plans[2].weekly, 110.28, 0.001, "single man moderate weekly");
g = C.groceries(["f20"], 21); near(g.plans[0].weekly, 70.32, 0.001, "single woman thrifty weekly"); near(g.plans[2].weekly, 93.12, 0.001, "single woman moderate weekly");
near(C.groceries(["f20"], 21).plans[0].monthly, 304.68, 0.001, "single woman thrifty monthly (253.90 x 1.2)");
// Couple +10% (matches the worked example in the page copy)
g = C.groceries(["m20", "f20"], 21);
near(g.plans[2].monthly, 808.28, 0.001, "couple moderate monthly (734.80 x 1.1)"); near(g.plans[2].weekly, 186.45, 0.001, "couple moderate weekly");
near(g.plans[0].monthly, 630.19, 0.001, "couple thrifty monthly");
// Size adjustment table
ok([1, 2, 3, 4, 5, 6, 7, 12].map(C.householdAdjust).join() === [0.2, 0.1, 0.05, 0, -0.05, -0.05, -0.1, -0.1].join(), "USDA household-size adjustments");
g = C.groceries(["m20", "f20", "c1", "c2", "c4", "c6", "c9"], 21);
near(g.plans[1].monthly, (317.7 + 276.3 + 165 + 173.5 + 179 + 261.5 + 271.4) * 0.9, 0.006, "7 people: -10% on the low-cost plan");
// Meals-at-home scaling
const full = C.groceries(["m20", "f20"], 21), part = C.groceries(["m20", "f20"], 14);
ok(part.plans.every((p, i) => Math.abs(p.monthly - full.plans[i].monthly * 2 / 3) <= 0.01 && p.fullMonthly === full.plans[i].monthly), "14 of 21 meals = 2/3 of the full-at-home amount");
// Band
const pl = C.groceries(["m20", "f20", "c6", "c9"], 21).plans;
ok(C.groceryBand(500, pl) === 0 && C.groceryBand(pl[0].monthly, pl) === 0 && C.groceryBand(1100, pl) === 1 && C.groceryBand(1300, pl) === 2 &&
   C.groceryBand(1500, pl) === 3 && C.groceryBand(1681.8, pl) === 3 && C.groceryBand(2000, pl) === 4, "grocery band boundaries");
ok(C.validateGroceries([], 0, -1).length === 3, "grocery validation: no people, bad meals, negative spend");
ok(C.validateGroceries(["f20"], 21, null).length === 0 && C.validateGroceries(["f20"], 7.5, 100).length === 1, "grocery validation: ok / fractional meals");

// ---------------------------------------------------------------- Moving
const T = new Date(2026, 9, 22);
const EXM = [["Deposit", 1500, -28], ["Rent", 1500, -7], ["Movers deposit", 200, -28], ["Movers balance", 900, 0], ["Boxes", 120, -14], ["Utilities", 150, -7],
             ["Cleaning", 200, 0], ["Travel", 150, 0], ["Takeout", 200, 7], ["Furniture", 400, 30]].map(x => ({ name: x[0], amount: x[1], offset: x[2] }));
let m = C.moving(EXM, new Date(2026, 11, 3), T, { bufferPct: 10, saved: 0, refund: 0 });
ok(m.subtotal === 5320 && m.buffer === 532 && m.total === 5852, "moving example: 5320 + 10% buffer = 5852");
ok(m.byMoveDay === 5252 && m.afterMove === 600, "moving example: 5252 by move day, 600 after (matches page copy)");
ok(m.weekly === 875.34 && m.shortNow === 0 && m.weeksToMove === 6, "moving example: 1700 due in 2 weeks drives 875.34/wk, got " + m.weekly);
ok(m.schedule.every((x, i, a) => i === 0 || a[i - 1].due <= x.due), "moving schedule sorted by date");
ok(m.schedule[m.schedule.length - 1].cumulative === 5852 && m.schedule[0].due.getTime() === new Date(2026, 10, 5).getTime(), "running total ends at total; first cost 4 weeks before Dec 3 = Nov 5");
m = C.moving(EXM, new Date(2026, 11, 3), T, { bufferPct: 10, saved: 6000, refund: 1500, refundDays: 21 });
ok(m.weekly === 0 && m.shortNow === 0, "already saved more than total -> $0/week");
ok(m.net === 4352 && m.refundDate.getTime() === new Date(2026, 11, 24).getTime(), "refund: net 5852-1500, back 21 days after move");
m = C.moving(EXM, new Date(2026, 10, 1), T, { bufferPct: 0, saved: 500, refund: 0 });
ok(m.schedule.filter(x => x.clamped).length === 3 && m.schedule[0].due.getTime() === T.getTime(), "costs before today are clamped to today (3 items: 2x -28, -14)");
ok(m.shortNow === 1820 + 1650 - 500, "short now = costs due within a week (clamped + 1-week-before items) minus saved, got " + m.shortNow);
m = C.moving([{ name: "x", amount: 700, offset: 0 }], new Date(2026, 11, 3), T, { bufferPct: 0, saved: 0 });
ok(m.weekly === 116.67, "700 over 6 weeks = 116.67 rounded up");
// Property: the weekly amount always has the cash ready by each due date, and one cent less would miss one.
let seed2 = 7; const rnd2 = () => ((seed2 = (seed2 * 1103515245 + 12345) % 2147483648) / 2147483648);
const OFFS = [-56, -42, -28, -14, -7, 0, 7, 30];
for (let n = 0; n < 1000; n++) {
  const items = Array.from({ length: 1 + Math.floor(rnd2() * 8) }, (_, i) => ({ name: "c" + i, amount: Math.round(rnd2() * 300000) / 100, offset: OFFS[Math.floor(rnd2() * 8)] }));
  const mv = C.addDays(T, Math.floor(rnd2() * 120)), saved = Math.round(rnd2() * 2000), buf = Math.floor(rnd2() * 20);
  const r = C.moving(items, mv, T, { bufferPct: buf, saved });
  const covered = (w) => r.schedule.every(x => { const wk = Math.floor(C.dayDiff(T, x.due) / 7); return wk < 1 || saved + r.shortNow + w * wk >= x.cumulative - 0.01; });
  ok(covered(r.weekly), "moving weekly covers every due date " + JSON.stringify({ items, mv, saved, buf }));
  if (r.weekly > 0.01) ok(!covered(r.weekly - 0.02), "moving weekly is minimal (2 cents less misses a date)");
  ok(Math.abs(r.byMoveDay + r.afterMove - r.total) < 0.01, "moving: by-move-day + after = total");
}
ok(C.validateMoving([{ name: "a", amount: -1, offset: 0 }], new Date(2020, 0, 1), T, { bufferPct: 80, saved: -1, refund: -1 }).length === 5, "moving validation catches 5 problems");
ok(C.validateMoving(EXM, new Date(2026, 11, 3), T, { bufferPct: 10, saved: 0, refund: 0 }).length === 0, "valid move passes");
ok(C.validateMoving(EXM, T, T, { bufferPct: 10, saved: 0, refund: 0 }).length === 0, "moving today is allowed");

// ---------------------------------------------------------------- Budget by paycheck
const D = (y, mo, d) => new Date(y, mo - 1, d).getTime(), ts = a => a.map(x => x.getTime());
ok(ts(C.payDates("biweekly", new Date(2026, 9, 23), null, T, 1)).join() === [D(2026, 10, 23), D(2026, 11, 6), D(2026, 11, 20)].join(), "biweekly from Oct 23: 3 checks in a month");
ok(C.payDates("weekly", new Date(2026, 9, 23), null, T, 1).length === 5, "weekly from Oct 23: Oct 23, 30, Nov 6, 13, 20");
ok(ts(C.payDates("monthly", new Date(2027, 0, 31), null, T, 3)).join() === [D(2027, 1, 31), D(2027, 2, 28), D(2027, 3, 31)].join(), "monthly on the 31st clamps to Feb 28 then back to Mar 31");
ok(ts(C.payDates("semimonthly", null, [15, 31], T, 1)).join() === [D(2026, 10, 31), D(2026, 11, 15)].join(), "semimonthly 15th/last from Oct 22: Oct 31, Nov 15");
ok(ts(C.payDates("semimonthly", null, [1, 15], T, 2)).join() === [D(2026, 11, 1), D(2026, 11, 15), D(2026, 12, 1), D(2026, 12, 15)].join(), "semimonthly 1st/15th, 2 months");
ok(ts(C.payDates("semimonthly", null, [30, 31], new Date(2027, 1, 1), 1)).join() === [D(2027, 2, 28)].join(), "30th and 31st both clamp to Feb 28 -> one check, not two");
const BILLS = [{ name: "Rent", amount: 1200, day: 1 }, { name: "Car", amount: 350, day: 10 }, { name: "Phone", amount: 60, day: 20 }, { name: "Groceries", amount: 150, every: "check" }];
let pp = C.paycheckPlan({ freq: "biweekly", first: new Date(2026, 9, 23), amount: 1400, today: T, lead: 0, bills: BILLS });
const where = (plan, name) => plan.checks.map(c => c.bills.filter(b => b.name === name).map(b => [c.date.getTime(), b.due && b.due.getTime()])).flat();
ok(JSON.stringify(where(pp, "Rent")) === JSON.stringify([[D(2026, 10, 23), D(2026, 11, 1)], [D(2026, 11, 20), D(2026, 12, 1)]]), "rent Nov 1 from Oct 23 check; Dec 1 from Nov 20 check (before next payday Dec 4)");
ok(JSON.stringify(where(pp, "Car")) === JSON.stringify([[D(2026, 11, 6), D(2026, 11, 10)]]) && JSON.stringify(where(pp, "Phone")) === JSON.stringify([[D(2026, 11, 20), D(2026, 11, 20)]]), "car from Nov 6; phone due on a payday is paid that day");
ok(pp.checks.every(c => c.bills.filter(b => b.perCheck).length === 1), "groceries on every check");
ok(pp.income === 4200 && pp.bills === 1200 * 2 + 350 + 60 + 450 && pp.left === 4200 - pp.bills, "biweekly totals");
ok(pp.windowEnd.getTime() === D(2026, 12, 4), "window ends at the next payday after the plan (Dec 4)");
pp = C.paycheckPlan({ freq: "biweekly", first: new Date(2026, 9, 23), amount: 1400, today: T, lead: 2, bills: BILLS });
ok(JSON.stringify(where(pp, "Phone")) === JSON.stringify([[D(2026, 11, 6), D(2026, 11, 20)]]), "2 days early: phone due Nov 20 moves to the Nov 6 check");
pp = C.paycheckPlan({ freq: "monthly", first: new Date(2026, 9, 30), amount: 3000, today: T, lead: 0, bills: [{ name: "R", amount: 1000, day: 1 }, { name: "L", amount: 50, day: 31 }] });
ok(pp.checks.length === 1 && pp.checks[0].bills.length === 2 && pp.checks[0].left === 1950, "monthly: one check pays each monthly bill once (Oct 31 and Nov 1)");
// Rebalancing: an overloaded check pushes the smallest bill that fixes it to an earlier check with room
pp = C.paycheckPlan({ freq: "biweekly", first: new Date(2026, 9, 23), amount: 1200, today: T, lead: 0, bills: [
  { name: "Rent", amount: 700, day: 1 }, { name: "Car", amount: 400, day: 10 }, { name: "Ins", amount: 300, day: 12 }, { name: "Water", amount: 150, day: 15 }, { name: "Gym", amount: 450, day: 18 }] });
ok(pp.overloaded === 1 && pp.checks[1].left === -100, "Nov 6 check is 100 short before the fix");
ok(pp.moves.length === 1 && pp.moves[0].name === "Water" && pp.moves[0].to.getTime() === D(2026, 10, 23) && pp.stillOverloaded === 0, "fix: pay Water early from the Oct 23 check");
ok(pp.balanced[0].left === 350 && pp.balanced[1].left === 50, "balanced plan leaves 350 and 50");
pp = C.paycheckPlan({ freq: "biweekly", first: new Date(2026, 9, 23), amount: 1000, today: T, lead: 0, bills: [{ name: "Rent", amount: 1100, day: 1 }] });
ok(pp.overloaded === 2 && pp.moves.length === 0 && pp.stillOverloaded === 2, "rent > any one check (Oct 23 and Nov 20): flagged, no fake fix");
// Properties over random plans: never late, latest eligible check, back-to-back windows count every due date exactly once
let seed3 = 11; const rnd3 = () => ((seed3 = (seed3 * 1103515245 + 12345) % 2147483648) / 2147483648);
const FREQS = ["weekly", "biweekly", "semimonthly", "monthly"];
for (let n = 0; n < 1500; n++) {
  const today = C.addDays(new Date(2026, 0, 1), Math.floor(rnd3() * 730)), freq = FREQS[n % 4], lead = Math.floor(rnd3() * 4), months = 1 + Math.floor(rnd3() * 3);
  const first = C.addDays(today, Math.floor(rnd3() * 20)), d1 = 1 + Math.floor(rnd3() * 31); let d2 = 1 + Math.floor(rnd3() * 31); if (d2 === d1) d2 = d1 === 31 ? 1 : d1 + 1;
  const days = [d1, d2].sort((a, b) => a - b);
  const bills = Array.from({ length: 1 + Math.floor(rnd3() * 8) }, (_, i) => rnd3() < 0.2 ? { name: "e" + i, amount: 10 + Math.round(rnd3() * 200), every: "check" } : { name: "b" + i, amount: 10 + Math.round(rnd3() * 1500), day: 1 + Math.floor(rnd3() * 31) });
  const a = C.paycheckPlan({ freq, first, days, amount: 2000, today, lead, months, bills });
  let good = true;
  a.checks.forEach((c, i) => c.bills.forEach(b => { if (b.perCheck) return; const payBy = C.addDays(b.due, -lead);
    if (c.date > payBy) good = false; if (i + 1 < a.checks.length && a.checks[i + 1].date <= payBy) good = false; if (!(payBy < a.windowEnd)) good = false; }));
  ok(good, `paycheck: each bill paid by latest check on/before due-lead (${freq} ${today.toDateString()})`);
  if (a.balanced) ok(a.moves.every(mv => mv.to < mv.from) && Math.abs(a.balanced.reduce((s, c) => s + c.total, 0) - a.bills) < 0.01, "paycheck: fixes only move bills earlier and keep totals");
  // Next window starts at this window's next payday. Together they must count each monthly due date in the span exactly once.
  const b2 = C.paycheckPlan({ freq, first: a.windowEnd, days, amount: 2000, today: a.windowEnd, lead, months: 1, bills });
  ok(b2.checks[0].date.getTime() === a.windowEnd.getTime(), "paycheck: next window starts on the next payday");
  const seen = {}; [a, b2].forEach(pl => pl.checks.forEach(c => c.bills.forEach(b => { if (!b.perCheck) { const k = b.name + "@" + b.due.getTime(); seen[k] = (seen[k] || 0) + 1; } })));
  const lo = C.addDays(a.windowStart, lead), hi = C.addDays(b2.windowEnd, lead); let tile = true;
  bills.filter(b => b.every !== "check").forEach(b => { for (let k = -1; k < 8; k++) { const due = C.clampDay(lo.getFullYear(), lo.getMonth() + k, b.day);
    const cnt = seen[b.name + "@" + due.getTime()] || 0; if (due >= lo && due < hi ? cnt !== 1 : cnt !== 0) tile = false; } });
  ok(tile, `paycheck: back-to-back windows count every due date exactly once (${freq}, lead ${lead}, ${months}mo)`);
}
ok(C.validatePaycheck({ freq: "biweekly", first: new Date(2020, 0, 1), amount: 0, bills: [{ name: "x", amount: 0, day: 40 }], lead: 20, today: T }).length === 5, "paycheck validation catches 5 problems");
ok(C.validatePaycheck({ freq: "semimonthly", days: [15, 15], amount: 100, bills: [{ name: "x", amount: 5, every: "check" }], lead: 0, today: T }).length === 1, "semimonthly needs two different days");
ok(C.validatePaycheck({ freq: "weekly", first: T, amount: 100, bills: [{ name: "x", amount: 5, day: 31 }], lead: 0, today: T }).length === 0, "valid paycheck plan passes");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
