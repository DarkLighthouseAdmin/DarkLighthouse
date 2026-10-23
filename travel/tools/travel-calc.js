/* Travel calculators: pure math (no DOM). Used by /travel/tools/* pages and by scripts/test_travel.js. */
(function (root) {
  "use strict";
  function r2(x) { return Math.round(x * 100) / 100; }
  function day(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addMonths(d, n) { var y = d.getFullYear(), m = d.getMonth() + n, last = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(d.getDate(), last)); }

  /* Trip cost. i: {travelers, nights, flight (per person), lodging (per night, whole party), food (per person per day),
     activities (whole trip), transport (whole trip), other (whole trip), buffer (percent)}. Days = nights + 1. */
  function tripCost(i) {
    var t = +i.travelers, n = +i.nights, days = n + 1;
    var lines = [
      ["Flights", t * (+i.flight || 0)], ["Lodging", n * (+i.lodging || 0)], ["Food", t * days * (+i.food || 0)],
      ["Activities & tickets", +i.activities || 0], ["Getting around", +i.transport || 0], ["Other", +i.other || 0]];
    var sub = lines.reduce(function (s, l) { return s + l[1]; }, 0), buf = r2(sub * (+i.buffer || 0) / 100);
    lines = lines.map(function (l) { return { name: l[0], amount: r2(l[1]) }; });
    lines.push({ name: "Buffer (" + (+i.buffer || 0) + "%)", amount: buf });
    var total = r2(sub + buf);
    return { lines: lines, subtotal: r2(sub), total: total, days: days, perPerson: r2(total / t), perDay: r2(total / days) };
  }

  /* Paydays from `next` (inclusive) up to the day before `depart`. freq: weekly | biweekly | semimonthly (1st & 15th) | monthly.
     For monthly, every payday falls on next's day of the month (clamped to the month's last day). */
  function paydays(next, depart, freq) {
    var out = [], d = day(next), end = day(depart), k = 0;
    if (freq === "semimonthly") {
      d = d.getDate() <= 1 ? new Date(d.getFullYear(), d.getMonth(), 1) : d.getDate() <= 15 ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 1);
      while (d < end && k++ < 2000) { out.push(d); d = d.getDate() === 1 ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 1); }
      return out;
    }
    var start = d;
    while (d < end && k < 2000) { out.push(d); k++; d = freq === "weekly" ? addDays(start, 7 * k) : freq === "biweekly" ? addDays(start, 14 * k) : addMonths(start, k); }
    return out;
  }

  /* How much to set aside each payday. Rounded up to the next whole currency unit so the goal is reached. */
  function savePlan(total, saved, next, depart, freq) {
    var left = Math.max(0, r2(total - (+saved || 0))), p = paydays(next, depart, freq);
    if (!left) return { ok: true, left: 0, count: p.length, per: 0, dates: p, done: true };
    if (!p.length) return { ok: false, left: left, count: 0, per: null, dates: p, reason: "nopaydays" };
    return { ok: true, left: left, count: p.length, per: Math.ceil(left / p.length), exact: r2(left / p.length), dates: p, done: false };
  }

  /* Daily spending budget, currency aware. i: {total, prepaid, days, adults, kids, kidShare (percent of an adult), rate
     (local currency per 1 home currency), buffer (percent held back)}. Returns home and local amounts. */
  function dailyBudget(i) {
    var total = +i.total, pre = +i.prepaid || 0, days = +i.days, a = +i.adults, k = +i.kids || 0, share = (i.kidShare == null ? 50 : +i.kidShare) / 100, rate = +i.rate || 1;
    var spend = total - pre, hold = r2(Math.max(0, spend) * (+i.buffer || 0) / 100), pot = r2(spend - hold);
    if (pot <= 0) return { ok: false, reason: "noroom", spend: r2(spend), hold: hold, pot: pot };
    var perDay = pot / days, units = a + k * share, perAdult = perDay / units, perKid = perAdult * share;
    function both(x) { return { home: r2(x), local: r2(x * rate) }; }
    return { ok: true, spend: r2(spend), hold: hold, pot: pot, perDay: both(perDay), perAdult: both(perAdult), perKid: both(perKid),
             perPersonEven: both(perDay / (a + k)) };
  }

  var api = { tripCost: tripCost, paydays: paydays, savePlan: savePlan, dailyBudget: dailyBudget, addDays: addDays, addMonths: addMonths };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DLTravel = api;
})(this);
