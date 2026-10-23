/* Free calculators: pure math (no DOM). Used by /tools/* pages and by scripts/test_tools.js. */
(function (root) {
  "use strict";
  var MAX_MONTHS = 1200; // 100 years: anything longer is treated as "never paid off"
  function r2(x) { return Math.round(x * 100) / 100; }

  /* debts: [{name, balance, apr (percent), min}], extra: number, method: "avalanche" | "snowball"
     Each month: interest accrues (APR/12 on the balance), every debt gets its minimum (or what's left of it),
     then the extra amount plus minimums freed up by paid-off debts goes to the focus debt (roll-over). */
  function payoff(debts, extra, method) {
    var ds = debts.map(function (d, i) { return { i: i, name: d.name, bal: +d.balance, apr: +d.apr, min: +d.min, paidMonth: null, interest: 0 }; });
    var order = ds.slice().sort(method === "snowball"
      ? function (a, b) { return a.bal - b.bal || b.apr - a.apr || a.i - b.i; }
      : function (a, b) { return b.apr - a.apr || a.bal - b.bal || a.i - b.i; });
    var budget = ds.reduce(function (s, d) { return s + d.min; }, 0) + (+extra || 0);
    var rows = [], month = 0, totalInterest = 0, totalPaid = 0;
    while (ds.some(function (d) { return d.bal > 0.005; })) {
      month++;
      if (month > MAX_MONTHS) return { ok: false, reason: "never", method: method };
      var mInt = 0, mPaid = 0, left = budget, closed = [];
      ds.forEach(function (d) {
        if (d.bal <= 0.005) return;
        var int = r2(d.bal * d.apr / 1200); d.bal = r2(d.bal + int); d.interest += int; mInt += int;
      });
      ds.forEach(function (d) {
        if (d.bal <= 0.005) return;
        var p = Math.min(d.min, d.bal, left); d.bal = r2(d.bal - p); left = r2(left - p); mPaid += p;
      });
      for (var k = 0; k < order.length && left > 0.005; k++) {
        var d = order[k]; if (d.bal <= 0.005) continue;
        var p = Math.min(d.bal, left); d.bal = r2(d.bal - p); left = r2(left - p); mPaid += p;
      }
      ds.forEach(function (d) { if (d.bal <= 0.005 && d.paidMonth === null) { d.bal = 0; d.paidMonth = month; closed.push(d.name); } });
      totalInterest += mInt; totalPaid += mPaid;
      rows.push({ month: month, paid: r2(mPaid), interest: r2(mInt), balance: r2(ds.reduce(function (s, d) { return s + d.bal; }, 0)), closed: closed });
    }
    var seq = ds.filter(function (d) { return d.paidMonth !== null; }).sort(function (a, b) { return a.paidMonth - b.paidMonth || a.i - b.i; });
    return { ok: true, method: method, months: month, totalInterest: r2(totalInterest), totalPaid: r2(totalPaid), budget: r2(budget),
             order: seq.map(function (d) { return { name: d.name, month: d.paidMonth, interest: r2(d.interest) }; }), rows: rows };
  }

  function validateDebts(debts, extra) {
    var errs = [];
    if (!debts.length) errs.push("Add at least one debt.");
    debts.forEach(function (d, n) {
      var label = d.name || "Debt " + (n + 1);
      if (!(d.balance > 0)) errs.push(label + ": enter a balance above $0.");
      if (!(d.apr >= 0 && d.apr <= 100)) errs.push(label + ": APR should be between 0 and 100%.");
      if (!(d.min > 0)) errs.push(label + ": enter a minimum payment above $0.");
    });
    if (!(extra >= 0)) errs.push("Extra payment can't be negative.");
    return errs;
  }

  /* Wedding: rough guideline splits (percent of total) by style. Each sums to 100. */
  var WED_CATS = [
    ["venue", "Venue & rentals"], ["catering", "Food & drink (catering)"], ["photo", "Photography"], ["video", "Videography"],
    ["attire", "Attire, hair & makeup"], ["flowers", "Flowers & decor"], ["music", "Music / DJ / band"], ["planner", "Planner or day-of coordinator"],
    ["stationery", "Invitations & stationery"], ["cake", "Cake & desserts"], ["transport", "Transportation"], ["officiant", "Officiant & ceremony fees"],
    ["favors", "Favors & gifts"], ["buffer", "Buffer for surprises"]];
  var WED_SPLITS = {
    simple:  { venue: 15, catering: 28, photo: 12, video: 0, attire: 10, flowers: 6,  music: 6, planner: 2, stationery: 3, cake: 3, transport: 1, officiant: 2, favors: 2, buffer: 10 },
    classic: { venue: 20, catering: 25, photo: 10, video: 4, attire: 8,  flowers: 8,  music: 7, planner: 4, stationery: 2, cake: 2, transport: 2, officiant: 1, favors: 2, buffer: 5 },
    formal:  { venue: 22, catering: 24, photo: 9,  video: 5, attire: 8,  flowers: 10, music: 8, planner: 4, stationery: 2, cake: 2, transport: 2, officiant: 1, favors: 1, buffer: 2 }
  };
  // [category, typical deposit share, months before the wedding it's usually due]
  var WED_DEPOSITS = [["venue", 0.5, 12], ["photo", 0.3, 11], ["planner", 0.3, 11], ["catering", 0.3, 9], ["music", 0.3, 9],
                      ["video", 0.3, 9], ["attire", 0.5, 8], ["flowers", 0.25, 6], ["stationery", 1, 4], ["cake", 0.5, 3]];

  function addMonths(date, n) { var d = new Date(date.getFullYear(), date.getMonth() + n, 1); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(date.getDate(), last)); return d; }

  function wedding(total, guests, style, weddingDate, today) {
    var split = WED_SPLITS[style] || WED_SPLITS.classic; today = today || new Date();
    var lines = WED_CATS.map(function (c) { return { key: c[0], label: c[1], pct: split[c[0]], amount: Math.round(total * split[c[0]] / 100) }; })
      .filter(function (l) { return l.pct > 0; });
    var by = {}; lines.forEach(function (l) { by[l.key] = l; });
    var sched = [];
    WED_DEPOSITS.forEach(function (d) {
      var l = by[d[0]]; if (!l) return;
      var due = addMonths(weddingDate, -d[2]); if (due < today) due = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      sched.push({ label: l.label + (d[1] < 1 ? " deposit (~" + Math.round(d[1] * 100) + "%)" : " (paid in full)"), amount: Math.round(l.amount * d[1]), due: due });
    });
    var deposits = sched.reduce(function (s, x) { return s + x.amount; }, 0);
    var finalDue = addMonths(weddingDate, 0); finalDue.setDate(finalDue.getDate() - 14);
    if (finalDue < today) finalDue = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var spendable = total - (by.buffer ? by.buffer.amount : 0);
    sched.push({ label: "Final balances to vendors (typically 2–4 weeks before)", amount: Math.max(0, spendable - deposits), due: finalDue });
    sched.sort(function (a, b) { return a.due - b.due; });
    return { lines: lines, perGuest: guests > 0 ? total / guests : 0, cateringPerGuest: guests > 0 ? by.catering.amount / guests : 0, schedule: sched };
  }

  /* Sinking funds. Contributions start this month/pay period and the last one lands before the due date. */
  function monthsUntil(due, today) {
    var m = (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth());
    if (due.getDate() < today.getDate()) m--;
    return Math.max(1, m);
  }
  function paychecksUntil(due, today, freq) {
    var days = Math.floor((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
    var n = freq === "weekly" ? Math.floor(days / 7) : freq === "biweekly" ? Math.floor(days / 14)
          : freq === "semimonthly" ? monthsUntil(due, today) * 2 : monthsUntil(due, today);
    return Math.max(1, n);
  }
  var PER_MONTH = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 };
  function sinking(goals, freq, today) {
    today = today || new Date();
    var out = goals.map(function (g) {
      var need = Math.max(0, g.target - (g.saved || 0));
      var m = monthsUntil(g.due, today), p = paychecksUntil(g.due, today, freq);
      return { name: g.name, need: r2(need), months: m, paychecks: p, monthly: need ? Math.ceil(need / m * 100) / 100 : 0,
               perPaycheck: need ? Math.ceil(need / p * 100) / 100 : 0, funded: need === 0 };
    });
    var perPay = out.reduce(function (s, g) { return s + g.perPaycheck; }, 0);
    return { goals: out, totalMonthly: r2(out.reduce(function (s, g) { return s + g.monthly; }, 0)), totalPerPaycheck: r2(perPay),
             perPaycheckAsMonthly: r2(perPay * PER_MONTH[freq]) };
  }
  function validateGoals(goals, today) {
    var errs = []; today = today || new Date();
    var t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!goals.length) errs.push("Add at least one goal.");
    goals.forEach(function (g, n) {
      var label = g.name || "Goal " + (n + 1);
      if (!(g.target > 0)) errs.push(label + ": enter a target above $0.");
      if (!(g.saved >= 0)) errs.push(label + ": 'already saved' can't be negative.");
      if (!(g.due instanceof Date) || isNaN(g.due)) errs.push(label + ": pick a due date.");
      else if (g.due <= t0) errs.push(label + ": the due date needs to be in the future.");
    });
    return errs;
  }

  var api = { payoff: payoff, validateDebts: validateDebts, wedding: wedding, WED_SPLITS: WED_SPLITS, WED_CATS: WED_CATS,
              sinking: sinking, validateGoals: validateGoals, monthsUntil: monthsUntil, paychecksUntil: paychecksUntil, addMonths: addMonths };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.DLCalc = api;
})(this);
