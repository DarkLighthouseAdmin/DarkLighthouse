// Math tests for /travel/tools/travel-calc.js. Run: node scripts/test_travel.js
const C = require("../travel/tools/travel-calc.js");
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL:", m); } }
function near(a, b, t, m) { ok(Math.abs(a - b) <= t, `${m}: got ${a}, want ${b}`); }
const D = (y, m, d) => new Date(y, m - 1, d), iso = d => d.toISOString().slice(0, 10);

// Trip cost: 4 people, 7 nights, $650 flights pp, $180/night, $40 food pp/day, 300 activities, 450 car, 100 other, 10% buffer
let t = C.tripCost({ travelers: 4, nights: 7, flight: 650, lodging: 180, food: 40, activities: 300, transport: 450, other: 100, buffer: 10 });
ok(t.days === 8, "7 nights = 8 days");
ok(t.subtotal === 2600 + 1260 + 1280 + 850, "subtotal by hand = 5990, got " + t.subtotal);
ok(t.total === 6589, "total incl 10% buffer = 6589, got " + t.total);
near(t.perPerson, 1647.25, 0.001, "per person");
ok(t.lines.reduce((s, l) => s + l.amount, 0) === t.total, "lines add up to total");
t = C.tripCost({ travelers: 1, nights: 0, flight: 0, lodging: 0, food: 25, buffer: 0 });
ok(t.total === 25 && t.days === 1, "day trip, food only");

// Paydays
let p = C.paydays(D(2026, 10, 23), D(2027, 6, 1), "biweekly");
ok(p.length === 16, "biweekly Oct 23 2026 -> Jun 1 2027 = 16 paydays, got " + p.length);
ok(iso(p[15]) === iso(D(2027, 5, 21)), "last biweekly payday May 21, got " + p[15]);
ok(C.paydays(D(2026, 10, 23), D(2026, 10, 23), "weekly").length === 0, "payday on departure day doesn't count");
ok(C.paydays(D(2026, 10, 23), D(2026, 10, 24), "weekly").length === 1, "payday the day before counts");
p = C.paydays(D(2026, 1, 31), D(2026, 6, 1), "monthly");
ok(p.map(d => d.getDate()).join() === "31,28,31,30,31", "monthly on the 31st clamps: " + p.map(d => d.getDate()));
p = C.paydays(D(2026, 10, 20), D(2026, 12, 20), "semimonthly");
ok(p.map(d => iso(d)).join() === [D(2026,11,1),D(2026,11,15),D(2026,12,1),D(2026,12,15)].map(iso).join(), "semimonthly 1st & 15th");
ok(C.paydays(D(2026, 10, 1), D(2026, 10, 2), "semimonthly").length === 1, "semimonthly starting on the 1st");
ok(C.paydays(D(2026, 10, 1), D(2027, 10, 1), "weekly").length === 53, "weekly for a year (365 days) = 53");

// Save plan
let s = C.savePlan(5037.40, 200, D(2026, 10, 23), D(2027, 6, 1), "biweekly");
ok(s.ok && s.count === 16 && s.per === 303, "4837.40 over 16 -> 303/payday (rounded up), got " + s.per);
ok(s.per * s.count >= s.left, "rounded amount reaches the goal");
ok(C.savePlan(1000, 1500, D(2026, 10, 23), D(2027, 1, 1), "weekly").done, "already saved enough");
ok(!C.savePlan(1000, 0, D(2027, 2, 1), D(2027, 1, 1), "weekly").ok, "no paydays before departure is flagged");

// Daily budget: $3,000 total, $1,800 prepaid, 6 days, 2 adults + 2 kids at 50%, rate 0.79 GBP per USD, 10% buffer
let b = C.dailyBudget({ total: 3000, prepaid: 1800, days: 6, adults: 2, kids: 2, kidShare: 50, rate: 0.79, buffer: 10 });
ok(b.ok && b.hold === 120 && b.pot === 1080, "pot 1080 after 120 buffer");
ok(b.perDay.home === 180 && b.perDay.local === 142.2, "180/day = 142.20 local, got " + JSON.stringify(b.perDay));
ok(b.perAdult.home === 60 && b.perKid.home === 30, "adult 60, kid 30 (3 adult-equivalents)");
near(b.perAdult.home * 2 + b.perKid.home * 2, b.perDay.home, 0.01, "shares add back to the day");
ok(b.perPersonEven.home === 45, "even split 45");
ok(!C.dailyBudget({ total: 1000, prepaid: 1000, days: 3, adults: 1 }).ok, "nothing left after prepaid is flagged");
b = C.dailyBudget({ total: 700, days: 7, adults: 1, kids: 0, rate: 1 });
ok(b.perDay.home === 100 && b.perAdult.home === 100, "defaults: no buffer, kids 0, rate 1");
// Randomised: shares always sum back to the daily pot
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let k = 0; k < 1000; k++) {
  const i = { total: 500 + rnd() * 20000, prepaid: rnd() * 400, days: 1 + Math.floor(rnd() * 30), adults: 1 + Math.floor(rnd() * 4),
              kids: Math.floor(rnd() * 5), kidShare: Math.floor(rnd() * 101), rate: 0.2 + rnd() * 150, buffer: Math.floor(rnd() * 30) };
  const r = C.dailyBudget(i);
  if (!r.ok) continue;
  const back = r.perAdult.home * i.adults + r.perKid.home * i.kids;
  if (Math.abs(back - r.perDay.home) > 0.02 * (i.adults + i.kids) + 0.01) { ok(false, "shares sum " + JSON.stringify(i)); break; }
}
ok(true, "random share check");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
