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
    formal:  { venue: 21, catering: 23, photo: 9,  video: 5, attire: 7,  flowers: 10, music: 8, planner: 4, stationery: 2, cake: 2, transport: 2, officiant: 1, favors: 1, buffer: 5 }
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

  /* ---------------------------------------------------------------- groceries
     USDA Food Plans: Cost of Food at Home, U.S. average, September 2026 (published by USDA FNS, page updated Oct 19, 2026).
     https://www.fns.usda.gov/cnpp/usda-food-plans-cost-food-monthly-reports
     Per person, for someone in a 4-person household, all meals and snacks made at home.
     Columns: [key, label, thrifty weekly, thrifty monthly, low weekly, low monthly, moderate weekly, moderate monthly, liberal weekly, liberal monthly] */
  var USDA_MONTH = "September 2026";
  var FOOD_GROUPS = [
    ["c1", "Child, 1 year", 26.30, 114.20, 38.10, 165.00, 42.90, 185.70, 52.30, 226.40],
    ["c2", "Child, 2–3 years", 39.80, 172.50, 40.00, 173.50, 47.80, 207.20, 58.20, 252.10],
    ["c4", "Child, 4–5 years", 43.40, 188.30, 41.30, 179.00, 51.10, 221.50, 61.90, 268.30],
    ["c6", "Child, 6–8 years", 48.30, 209.10, 60.40, 261.50, 70.30, 304.70, 82.40, 357.20],
    ["c9", "Child, 9–11 years", 55.80, 241.90, 62.60, 271.40, 80.70, 349.70, 94.20, 408.20],
    ["f12", "Female, 12–13", 51.70, 224.00, 62.30, 269.80, 74.30, 321.70, 92.60, 401.10],
    ["f14", "Female, 14–19", 60.00, 260.00, 62.50, 270.90, 74.60, 323.30, 92.20, 399.70],
    ["f20", "Female, 20–50", 58.60, 253.90, 63.80, 276.30, 77.60, 336.40, 99.10, 429.60],
    ["f51", "Female, 51–70", 54.60, 236.40, 62.10, 268.90, 76.50, 331.30, 92.20, 399.50],
    ["f71", "Female, 71+", 60.10, 260.60, 61.90, 268.20, 76.10, 329.80, 91.00, 394.40],
    ["m12", "Male, 12–13", 59.70, 258.50, 73.00, 316.50, 90.50, 392.20, 106.30, 460.60],
    ["m14", "Male, 14–19", 75.30, 326.30, 74.50, 322.90, 93.10, 403.50, 109.40, 473.90],
    ["m20", "Male, 20–50", 73.60, 319.00, 73.30, 317.70, 91.90, 398.40, 112.30, 486.80],
    ["m51", "Male, 51–70", 64.90, 281.20, 69.10, 299.40, 86.50, 374.90, 103.60, 449.10],
    ["m71", "Male, 71+", 61.90, 268.40, 68.40, 296.30, 84.10, 364.30, 103.40, 448.10]];
  var FOOD_PLANS = [["thrifty", "Thrifty"], ["low", "Low-cost"], ["moderate", "Moderate-cost"], ["liberal", "Liberal"]];
  var WEEKS_PER_MONTH = 4.333; // USDA: monthly = weekly x 4.333
  // USDA's suggested adjustment for household size (the table assumes a 4-person household)
  function householdAdjust(n) { return n <= 1 ? 0.20 : n === 2 ? 0.10 : n === 3 ? 0.05 : n === 4 ? 0 : n <= 6 ? -0.05 : -0.10; }
  /* members: array of group keys; mealsAtHome: meals per week made at home (0-21). The USDA plans assume all 21 meals plus
     snacks are made at home, so we scale linearly by mealsAtHome / 21 (an approximation, labelled as such on the page). */
  function groceries(members, mealsAtHome) {
    var by = {}; FOOD_GROUPS.forEach(function (g) { by[g[0]] = g; });
    var adj = householdAdjust(members.length), share = Math.max(0, Math.min(21, mealsAtHome)) / 21;
    var plans = FOOD_PLANS.map(function (p, k) {
      var w = 0, m = 0;
      members.forEach(function (key) { var g = by[key]; w += g[2 + 2 * k]; m += g[3 + 2 * k]; });
      var f = (1 + adj) * share;
      return { key: p[0], label: p[1], weekly: r2(w * f), monthly: r2(m * f), fullWeekly: r2(w * (1 + adj)), fullMonthly: r2(m * (1 + adj)) };
    });
    return { plans: plans, adjust: adj, share: share, people: members.length };
  }
  /* Where does a monthly spend sit against the four plans? Returns an index 0..4: 0 = under Thrifty, 4 = over Liberal,
     otherwise k = between plan k-1 and plan k. */
  function groceryBand(monthly, plans) {
    var k = 0; while (k < plans.length && monthly > plans[k].monthly + 0.005) k++; return k;
  }
  function validateGroceries(members, meals, spend) {
    var errs = [];
    if (!members.length) errs.push("Add at least one person.");
    if (members.length > 20) errs.push("Up to 20 people, please.");
    if (!(meals >= 1 && meals <= 21 && Math.floor(meals) === meals)) errs.push("Meals made at home should be a whole number from 1 to 21.");
    if (spend !== null && !(spend >= 0 && spend < 100000)) errs.push("Your grocery spend should be a number of dollars (or leave it blank).");
    return errs;
  }

  /* ---------------------------------------------------------------- moving
     items: [{name, amount, offset}] where offset = days relative to move day (negative = before, 0 = move day, positive = after).
     opts: { bufferPct, saved, refund, refundDays } */
  function dayDiff(a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function moving(items, moveDate, today, opts) {
    opts = opts || {}; today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var mv = new Date(moveDate.getFullYear(), moveDate.getMonth(), moveDate.getDate());
    var subtotal = r2(items.reduce(function (s, x) { return s + x.amount; }, 0));
    var buffer = r2(subtotal * (opts.bufferPct || 0) / 100);
    var sched = items.map(function (x, i) {
      var due = addDays(mv, x.offset), late = due < today;
      return { i: i, name: x.name, amount: r2(x.amount), offset: x.offset, due: late ? today : due, clamped: late };
    });
    if (buffer > 0) sched.push({ i: items.length, name: "Buffer for surprises (" + opts.bufferPct + "%)", amount: buffer, offset: 0, due: mv < today ? today : mv, clamped: mv < today, buffer: true });
    sched.sort(function (a, b) { return a.due - b.due || a.offset - b.offset || a.i - b.i; });
    var cum = 0; sched.forEach(function (x) { cum = r2(cum + x.amount); x.cumulative = cum; });
    var total = r2(subtotal + buffer), saved = Math.max(0, opts.saved || 0);
    var byMove = r2(sched.filter(function (x) { return x.due <= mv || x.clamped; }).reduce(function (s, x) { return s + x.amount; }, 0));
    // Smallest steady weekly amount (starting now) that has the cash ready by every due date, after using what's already saved.
    var weekly = 0, shortNow = 0;
    sched.forEach(function (x) {
      var wk = Math.floor(dayDiff(today, x.due) / 7), need = x.cumulative - saved;
      if (need <= 0.005) return;
      if (wk < 1) shortNow = Math.max(shortNow, need);
      else weekly = Math.max(weekly, (need - shortNow) / wk);
    });
    var refund = Math.max(0, opts.refund || 0);
    return { schedule: sched, subtotal: subtotal, buffer: buffer, total: total, byMoveDay: byMove, afterMove: r2(total - byMove),
             weekly: Math.ceil(weekly * 100 - 1e-6) / 100, shortNow: r2(shortNow), weeksToMove: Math.max(0, Math.floor(dayDiff(today, mv) / 7)),
             refund: r2(refund), refundDate: refund ? addDays(mv, opts.refundDays == null ? 21 : opts.refundDays) : null, net: r2(total - refund) };
  }
  function validateMoving(items, moveDate, today, opts) {
    var errs = [];
    if (!items.length) errs.push("Add at least one cost.");
    items.forEach(function (x, n) { if (!(x.amount >= 0 && x.amount < 1e7)) errs.push((x.name || "Cost " + (n + 1)) + ": enter an amount in dollars (0 is fine)."); });
    if (!(moveDate instanceof Date) || isNaN(moveDate)) errs.push("Pick your move date (an estimate is fine).");
    else if (dayDiff(today, moveDate) < 0) errs.push("The move date should be today or later.");
    if (!(opts.bufferPct >= 0 && opts.bufferPct <= 50)) errs.push("Buffer should be between 0 and 50%.");
    if (!(opts.saved >= 0)) errs.push("'Already set aside' can't be negative.");
    if (!(opts.refund >= 0)) errs.push("The deposit you'll get back can't be negative.");
    return errs;
  }

  /* ---------------------------------------------------------------- budget by paycheck */
  function clampDay(y, m, d) { return new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate())); }
  /* Pay dates in [start, addMonths(start, months)). For weekly/biweekly/monthly, `first` is the next payday.
     For semimonthly, days = [d1, d2] (31 = last day of the month) and the window starts at the next one on/after today. */
  function payDates(freq, first, days, today, months) {
    months = months || 1;
    var out = [], start, stop;
    if (freq === "semimonthly") {
      var t = new Date(today.getFullYear(), today.getMonth(), today.getDate()), cands = [];
      for (var k = 0; k < 2; k++) days.forEach(function (d) { cands.push(clampDay(t.getFullYear(), t.getMonth() + k, d)); });
      start = cands.filter(function (d) { return d >= t; }).sort(function (a, b) { return a - b; })[0];
      stop = addMonths(start, months);
      for (var j = 0; j <= months + 1; j++) days.forEach(function (d) { var x = clampDay(start.getFullYear(), start.getMonth() + j, d); if (x >= start && x < stop) out.push(x); });
      out.sort(function (a, b) { return a - b; });
      return out.filter(function (d, i, a) { return i === 0 || d - a[i - 1] !== 0; }); // e.g. 30 and 31 both clamp to Feb 28
    }
    start = new Date(first.getFullYear(), first.getMonth(), first.getDate()); stop = addMonths(start, months);
    if (freq === "monthly") { for (var m = 0; m < months; m++) out.push(clampDay(start.getFullYear(), start.getMonth() + m, start.getDate())); return out; }
    var step = freq === "weekly" ? 7 : 14;
    for (var d = start; d < stop; d = addDays(d, step)) out.push(d);
    return out;
  }
  /* bills: [{name, amount, day (1-31, monthly due day; 29-31 clamp to the month's last day) | every: "check"}].
     lead = days before the due date you want it paid. Each bill is paid from the latest paycheck on or before (due - lead), so
     nothing is late. "check" items come out of every paycheck. The plan covers the paychecks in [next payday, +N months). */
  function paycheckPlan(p) {
    var months = p.months || 1, lead = p.lead || 0;
    var all = payDates(p.freq, p.first, p.days || [1, 15], p.today, months + 1), stop = addMonths(all[0], months);
    var dates = all.filter(function (d) { return d < stop; }), next = all.filter(function (d) { return d >= stop; })[0];
    // Bills due in [first payday + lead, next window's first payday + lead) belong to this window's checks, so back-to-back
    // windows tile exactly: every bill due date is counted once, by the last paycheck on or before (due - lead).
    var winStart = addDays(dates[0], lead), winEnd = addDays(next, lead);
    var checks = dates.map(function (d) { return { date: d, amount: r2(p.amount), bills: [], total: 0, left: 0 }; });
    p.bills.forEach(function (b, i) {
      if (b.every === "check") { checks.forEach(function (c) { c.bills.push({ i: i, name: b.name, amount: r2(b.amount), due: null, perCheck: true }); }); return; }
      for (var k = -1; k <= months + 2; k++) {
        var due = clampDay(winStart.getFullYear(), winStart.getMonth() + k, b.day);
        if (due < winStart || due >= winEnd) continue;
        var payBy = addDays(due, -lead), c = null;
        checks.forEach(function (x) { if (x.date <= payBy) c = x; });
        c.bills.push({ i: i, name: b.name, amount: r2(b.amount), due: due, perCheck: false });
      }
    });
    function settle(cs) { cs.forEach(function (c) { c.bills.sort(function (a, b) { return (a.due || 0) - (b.due || 0) || a.i - b.i; }); c.total = r2(c.bills.reduce(function (s, b) { return s + b.amount; }, 0)); c.left = r2(c.amount - c.total); }); }
    settle(checks);
    // Suggest moves: an overloaded check can push a monthly bill to an EARLIER check with room (paying early is always allowed).
    var bal = checks.map(function (c) { return { date: c.date, amount: c.amount, bills: c.bills.slice(), total: c.total, left: c.left }; }), moves = [];
    for (var i = bal.length - 1; i > 0; i--) {
      var guard = 0;
      while (bal[i].left < -0.005 && guard++ < 50) {
        var deficit = -bal[i].left, best = null;
        bal[i].bills.forEach(function (b) {
          if (b.perCheck) return;
          for (var j = i - 1; j >= 0; j--) if (bal[j].left + 0.005 >= b.amount) {
            var fixes = b.amount + 0.005 >= deficit, cand = { b: b, j: j, fixes: fixes };
            if (!best || (fixes && !best.fixes) || (fixes && best.fixes && b.amount < best.b.amount) || (!fixes && !best.fixes && b.amount > best.b.amount)) best = cand;
            break;
          }
        });
        if (!best) break;
        bal[i].bills.splice(bal[i].bills.indexOf(best.b), 1); bal[best.j].bills.push(best.b);
        moves.push({ name: best.b.name, amount: best.b.amount, due: best.b.due, from: bal[i].date, to: bal[best.j].date });
        settle(bal);
      }
    }
    var income = r2(checks.reduce(function (s, c) { return s + c.amount; }, 0)), billsTotal = r2(checks.reduce(function (s, c) { return s + c.total; }, 0));
    return { checks: checks, balanced: moves.length ? bal : null, moves: moves, income: income, bills: billsTotal, left: r2(income - billsTotal),
             overloaded: checks.filter(function (c) { return c.left < -0.005; }).length, stillOverloaded: (moves.length ? bal : checks).filter(function (c) { return c.left < -0.005; }).length,
             windowStart: dates[0], windowEnd: next, months: months };
  }
  function validatePaycheck(p) {
    var errs = [];
    if (!(p.amount > 0 && p.amount < 1e7)) errs.push("Enter your take-home pay per paycheck.");
    if (p.freq !== "semimonthly") {
      if (!(p.first instanceof Date) || isNaN(p.first)) errs.push("Pick your next payday.");
      else if (dayDiff(p.today, p.first) < 0) errs.push("Your next payday should be today or later.");
      else if (dayDiff(p.today, p.first) > 62) errs.push("Pick a payday within the next two months.");
    } else if (!(p.days && p.days.length === 2 && p.days.every(function (d) { return d >= 1 && d <= 31 && Math.floor(d) === d; }) && p.days[0] !== p.days[1]))
      errs.push("Pick two different paydays in the month (1–31).");
    if (!p.bills.length) errs.push("Add at least one bill.");
    p.bills.forEach(function (b, n) {
      var label = b.name || "Bill " + (n + 1);
      if (!(b.amount > 0 && b.amount < 1e7)) errs.push(label + ": enter an amount above $0.");
      if (b.every !== "check" && !(b.day >= 1 && b.day <= 31 && Math.floor(b.day) === b.day)) errs.push(label + ": due day should be 1–31.");
    });
    if (!(p.lead >= 0 && p.lead <= 10)) errs.push("Days early should be between 0 and 10.");
    return errs;
  }

  var api = { payoff: payoff, validateDebts: validateDebts, wedding: wedding, WED_SPLITS: WED_SPLITS, WED_CATS: WED_CATS,
              sinking: sinking, validateGoals: validateGoals, monthsUntil: monthsUntil, paychecksUntil: paychecksUntil, addMonths: addMonths,
              USDA_MONTH: USDA_MONTH, FOOD_GROUPS: FOOD_GROUPS, FOOD_PLANS: FOOD_PLANS, WEEKS_PER_MONTH: WEEKS_PER_MONTH, householdAdjust: householdAdjust,
              groceries: groceries, groceryBand: groceryBand, validateGroceries: validateGroceries,
              moving: moving, validateMoving: validateMoving, addDays: addDays, dayDiff: dayDiff,
              payDates: payDates, paycheckPlan: paycheckPlan, validatePaycheck: validatePaycheck, clampDay: clampDay };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.DLCalc = api;
})(this);
