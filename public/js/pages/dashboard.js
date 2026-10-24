import { S, patch, tz } from '../store.js';
import { esc, fmt, relDue, analyticsCard, RANGES, pillBtn, plusBtn, btnPrimary, toast, CAT_LABEL } from '../ui.js';
import { taskRow, changed, msg, strike } from '../common.js';
const TZ = window.AST.tz, P = window.AST.priority;

function greeting() { const h = TZ.parts(Date.now(), tz()).h; return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

let range = (() => { try { return localStorage.getItem('astreoid-range') || '7d'; } catch (e) { return '7d'; } })();
if (!RANGES[range]) range = '7d';

// Buckets of day keys (inclusive lo..hi) for each range; counts come from the user's tasks.
function rangeData() {
  const zone = tz(), today = TZ.dayKey(Date.now(), zone), tasks = S.tasks;
  const count = (field, lo, hi) => tasks.filter((t) => t[field] && (() => { const k = TZ.dayKey(Date.parse(t[field]), zone); return k >= lo && k <= hi; })()).length;
  let buckets = [], span = 0;
  if (range === '7d' || range === '1m') {
    span = range === '7d' ? 7 : 30;
    buckets = Array.from({ length: span }, (_, i) => { const k = TZ.addDays(today, i - span + 1); return { lo: k, hi: k, label: fmt(k + 'T12:00:00Z', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) }; });
  } else if (range === '6m') {
    span = 182;
    buckets = Array.from({ length: 26 }, (_, i) => { const lo = TZ.addDays(today, -181 + i * 7); return { lo, hi: TZ.addDays(lo, 6), label: 'Week of ' + fmt(lo + 'T12:00:00Z', { day: 'numeric', month: 'short', timeZone: 'UTC' }) }; });
  } else {
    span = 365; const [y, m] = today.split('-').map(Number);
    buckets = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1)), ym = d.toISOString().slice(0, 7); return { lo: ym + '-01', hi: ym + '-31', label: fmt(d.getTime(), { month: 'long', year: 'numeric', timeZone: 'UTC' }) }; });
  }
  const rows = buckets.map((b) => ({ ...b, d: count('completedAt', b.lo, b.hi), u: count('dueAt', b.lo, b.hi) }));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.d, r.u)));
  const first = buckets[0].lo, prevLo = TZ.addDays(first, -span), prevHi = TZ.addDays(first, -1);
  return { rows, max, cur: count('completedAt', first, today), prev: count('completedAt', prevLo, prevHi) };
}

export default {
  id: 'dashboard', label: 'Home', title: 'Dashboard', icon: 'home',
  render() {
    const now = Date.now(), zone = tz(), today = TZ.dayKey(now, zone);
    const ranked = P.rank(S.tasks, { now }), open = ranked.length;
    const doneToday = S.tasks.filter((t) => t.completedAt && TZ.dayKey(Date.parse(t.completedAt), zone) === today).length;
    const prios = ranked.filter((r) => r.ready && (r.task.priority === 'high' || r.reasons[0] === 'Overdue' || r.reasons[0] === 'Due within 24 hours'));
    const rec = P.recommend(S.tasks, { now }), w = rangeData(), overdue = ranked.filter((r) => r.reasons.includes('Overdue')).length;
    const upcoming = S.reminders.filter((r) => r.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, 3);
    const bars = w.rows.map((r) => { const top = Math.max(r.d, r.u); return { outer: Math.max(top / w.max * 100, 12), inner: top ? Math.round(r.d / top * 100) : 0, title: `${r.label}: ${r.d} done, ${r.u} due` }; });
    return `<div class="page-head"><div class="grow"><h1>${greeting()}, ${esc(S.user.name)}!</h1><p>Your day, organized in one place.</p></div>
      <div class="row">${plusBtn('New task', 'data-act="new-task"')}<span class="muted">New task</span></div></div>
    <div class="grid g3" style="margin-bottom:16px">
      <div class="glass stat"><b>${open}</b><span>Pending</span></div>
      <div class="glass stat"><b>${doneToday}</b><span>Completed today</span></div>
      <div class="glass stat ${overdue ? 'hot' : ''}"><b>${prios.length}</b><span>Priorities${overdue ? ` · ${overdue} overdue` : ''}</span></div></div>
    <div class="grid g-main">
      <div class="stack">
        <section class="glass recommend" aria-labelledby="rec-h"><h3 id="rec-h">Your next recommended task</h3>
        ${rec ? `<div style="font-size:1.35rem;font-weight:700" data-strike="${rec.task.id}">${esc(rec.task.title)}</div>
          <div class="muted">${rec.task.estimatedMinutes ? rec.task.estimatedMinutes + ' minutes · ' : ''}${CAT_LABEL[rec.task.category]}${rec.task.dueAt ? ' · due ' + esc(fmt(rec.task.dueAt)) : ''}</div>
          <div class="why">${rec.reasons.map((r) => `<span class="pill ${r === 'Overdue' ? 'overdue' : ''}">${esc(r)}</span>`).join('') || '<span class="pill">Next on your list</span>'}</div>
          <div class="row wrapx">${rec.task.status === 'in_progress' ? '' : pillBtn('Start now', `data-act="start" data-id="${rec.task.id}"`, 'is-sm')}${pillBtn('Mark done', `data-act="finish" data-id="${rec.task.id}"`, 'is-sm')}${rec.task.scheduledStart ? '' : pillBtn('Add to my plan', `data-act="plan-one" data-id="${rec.task.id}"`, 'is-sm')}</div>
          <p class="hint" style="margin-top:10px">Recommended from your deadlines, priority and dependencies. Nothing is scheduled unless you add it.</p>`
        : '<p class="empty">Nothing waiting — add a task or ask the chat assistant.</p>'}</section>
        <section class="glass" aria-labelledby="pr-h"><h3 id="pr-h">Today’s priorities</h3><div class="stack">${ranked.slice(0, 6).map((r) => taskRow(r.task)).join('') || '<p class="empty">No open tasks. Enjoy the quiet.</p>'}</div>
          ${ranked.length > 6 ? `<p style="margin-top:10px"><a href="#/tasks">See all ${ranked.length} tasks →</a></p>` : ''}</section>
      </div>
      <div class="stack">
        ${analyticsCard({ range, totalLabel: 'Completed', totalValue: String(w.cur), totalDelta: `${w.cur - w.prev >= 0 ? '+' : ''}${w.cur - w.prev} vs ${RANGES[range].vs}`, secLabel: 'Open tasks', secValue: String(open), secDelta: `${overdue} overdue`, bars })}
        <section class="glass" aria-labelledby="qa-h"><h3 id="qa-h">Quick actions</h3><div class="stack">
          <div class="row between wrapx"><div><b>Add by chat</b><div class="hint">Describe a task naturally</div></div>${pillBtn('Open chat', 'data-act="go" data-to="chat"', 'is-sm')}</div>
          <div class="row between wrapx"><div><b>Plan my day</b><div class="hint">Organize tasks manually</div></div>${pillBtn('Open planner', 'data-act="go" data-to="calendar"', 'is-sm')}</div>
          <div class="row between wrapx"><div><b>See them in 3D</b><div class="hint">Your tasks as an asteroid belt</div></div>${pillBtn('Enter orbit', 'data-act="go" data-to="orbit"', 'is-sm')}</div></div></section>
        <section class="glass" aria-labelledby="up-h"><h3 id="up-h">Upcoming email reminders</h3>${upcoming.length ? upcoming.map((r) => { const t = S.tasks.find((x) => x.id === r.taskId); return `<div class="row between" style="padding:6px 0"><span>${esc(t?.title || 'Task')}</span><span class="pill">🔔 ${esc(fmt(r.scheduledAt))}</span></div>`; }).join('') : '<p class="hint">None scheduled. Add a reminder when you create a task — it is emailed to ' + esc(S.user.email) + '.</p>'}</section>
      </div></div>`;
  },
  chg(name, el) { if (name === 'range' && RANGES[el.value]) { range = el.value; try { localStorage.setItem('astreoid-range', range); } catch (e) {} changed(); } },
  async act(name, el, e, c) {
    const id = el.dataset.id;
    if (name === 'go') c.go(el.dataset.to);
    else if (name === 'start') { await patch('tasks', id, { status: 'in_progress' }); changed(); toast('Marked as in progress', 'ok'); }
    else if (name === 'finish') { const pr = patch('tasks', id, { status: 'completed' }); await strike(id); await pr; changed(); toast('Nice work — task completed.', 'ok'); }
    else if (name === 'plan-one') {
      const t = S.tasks.find((x) => x.id === id), now = Date.now(), zone = tz(), key = TZ.dayKey(now, zone), pr = S.user.prefs;
      let from = Math.max(now, TZ.at(key, pr.dayStartsAt || '07:00', zone)), end = TZ.at(key, pr.dayEndsAt || '22:00', zone);
      if (from >= end - 15 * 60000) { const k2 = TZ.addDays(key, 1); from = TZ.at(k2, pr.dayStartsAt || '07:00', zone); end = TZ.at(k2, pr.dayEndsAt || '22:00', zone); }
      const day = TZ.dayKey(from, zone), slot = P.suggestPlan([t, ...S.tasks.filter((x) => x.id !== id)], P.eventsOn(S.events, day, zone), { from, dayEnd: end }).find((s) => s.taskId === id);
      if (!slot) { toast('No free slot left in that day. Pick a time from the calendar instead.', 'err'); return; }
      await patch('tasks', id, { scheduledStart: new Date(slot.start).toISOString(), scheduledEnd: new Date(slot.end).toISOString() }); changed(); toast(`Added to your plan: ${fmt(slot.start)}`, 'ok');
    }
  },
};
