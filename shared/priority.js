// Deterministic priority engine + day-plan suggestions (server and browser).
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./tz.js') : root.AST.tz);
  if (isNode) module.exports = api;
  else { root.AST = root.AST || {}; root.AST.priority = api; }
})(this, function (TZ) {
  var OPEN = ['pending', 'in_progress', 'blocked'];
  function ms(s) { var t = Date.parse(s); return isNaN(t) ? null : t; }

  // Returns open tasks ordered by urgency, each with a score, reasons and `ready` flag.
  function rank(tasks, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var byId = {}; tasks.forEach(function (t) { byId[t.id] = t; });
    var out = tasks.filter(function (t) { return OPEN.indexOf(t.status) >= 0; }).map(function (t) {
      var s = { high: 30, medium: 20, low: 10 }[t.priority] || 10, reasons = [], ready = true;
      var due = t.dueAt ? ms(t.dueAt) : null;
      if (due !== null) {
        var h = (due - now) / 36e5;
        if (h < 0) { s += 50; reasons.push('Overdue'); }
        else if (h <= 24) { s += 35; reasons.push('Due within 24 hours'); }
        else if (h <= 72) { s += 20; reasons.push('Due within 3 days'); }
        else if (h <= 168) { s += 8; reasons.push('Due this week'); }
      }
      if (t.priority === 'high') reasons.push('High priority');
      if (t.status === 'in_progress') { s += 6; reasons.push('Already in progress'); }
      var waiting = (t.dependsOn || []).map(function (id) { return byId[id]; })
        .filter(function (d) { return d && d.status !== 'completed' && d.status !== 'cancelled'; });
      if (t.status === 'blocked') { s -= 15; ready = false; reasons.push('Blocked'); }
      if (waiting.length) { s -= 15; ready = false; reasons.push('Waiting on ' + waiting.length + ' task(s)'); }
      if (opts.availableMinutes && t.estimatedMinutes && t.estimatedMinutes > opts.availableMinutes) { s -= 10; reasons.push("Doesn't fit the time available"); }
      return { task: t, score: s, reasons: reasons, ready: ready };
    });
    out.sort(function (a, b) {
      return (b.score - a.score) || ((ms(a.task.dueAt) || 1e15) - (ms(b.task.dueAt) || 1e15));
    });
    return out;
  }
  function recommend(tasks, opts) { return rank(tasks, opts).filter(function (r) { return r.ready; })[0] || null; }

  // Events (fixed commitments) that fall on a given local date key.
  function eventsOn(events, key, tz) {
    return (events || []).filter(function (e) {
      if (e.date === key) return true;
      return e.repeat === 'weekly' && e.date < key && TZ.weekday(e.date) === TZ.weekday(key);
    }).map(function (e) {
      return { id: e.id, title: e.title, start: TZ.at(key, e.startTime, tz), end: TZ.at(key, e.endTime, tz), event: e };
    });
  }

  // Greedy suggestion only; the user approves before anything is scheduled.
  function suggestPlan(tasks, events, o) {
    var busy = (events || []).map(function (e) { return [e.start, e.end]; });
    tasks.forEach(function (t) {
      var a = ms(t.scheduledStart), b = ms(t.scheduledEnd);
      if (a && b && t.status !== 'completed' && b > o.from && a < o.dayEnd) busy.push([a, b]);
    });
    var step = 15 * 60000, gap = 5 * 60000, cursor = Math.ceil(o.from / step) * step, out = [];
    rank(tasks, { now: o.from }).filter(function (r) { return r.ready && !r.task.scheduledStart; }).forEach(function (r) {
      var dur = (r.task.estimatedMinutes || 30) * 60000, t = cursor, guard = 0;
      while (guard++ < 400 && t + dur <= o.dayEnd) {
        var clash = busy.filter(function (b) { return t < b[1] && t + dur > b[0]; })[0];
        if (!clash) { out.push({ taskId: r.task.id, title: r.task.title, start: t, end: t + dur }); busy.push([t, t + dur + gap]); return; }
        t = Math.ceil(clash[1] / step) * step;
      }
    });
    return out;
  }
  return { rank: rank, recommend: recommend, eventsOn: eventsOn, suggestPlan: suggestPlan, OPEN: OPEN };
});
