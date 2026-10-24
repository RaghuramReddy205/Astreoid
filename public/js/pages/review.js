import { S, add, patch, tz } from '../store.js';
import { api } from '../api.js';
import { esc, fmt, fmtDay, todayKey, field, pillBtn, btnPrimary, checkbox, toast, busy, $, $$ } from '../ui.js';
import { taskRow, changed, msg } from '../common.js';
const TZ = window.AST.tz, P = window.AST.priority;
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);

function data() {
  const z = tz(), key = todayKey(), start = TZ.at(key, '00:00', z), end = TZ.at(TZ.addDays(key, 1), '00:00', z);
  const done = S.tasks.filter((t) => t.completedAt && Date.parse(t.completedAt) >= start && Date.parse(t.completedAt) < end);
  const left = S.tasks.filter((t) => P.OPEN.includes(t.status) && ((t.dueAt && Date.parse(t.dueAt) < end) || (t.scheduledStart && Date.parse(t.scheduledStart) < end && Date.parse(t.scheduledStart) >= start)));
  return { key, done, left, saved: S.reviews.find((r) => r.date === key) };
}
export default {
  id: 'review', label: 'Review', title: 'Daily review', icon: 'review',
  render() {
    const d = data(), r = d.saved || {}, next = P.rank(S.tasks.filter((t) => !d.left.some((l) => l.id === t.id) || true)).filter((x) => x.ready).slice(0, 3);
    const past = S.reviews.filter((x) => x.date !== d.key).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    return `<div class="page-head"><div class="grow"><h1>Daily review</h1><p>${esc(fmtDay(d.key))} — what got done, what is left, and tomorrow’s preparation.</p></div></div>
    <div class="grid g2"><div class="stack">
      <section class="glass"><h3>Completed today (${d.done.length})</h3><div class="stack">${d.done.map((t) => taskRow(t, { actions: false })).join('') || '<p class="empty">Nothing completed yet — one small task is a good start.</p>'}</div></section>
      <section class="glass"><h3>Still open (${d.left.length})</h3><div class="stack">${d.left.map((t) => `<div class="row">${checkbox({ id: 'cf-' + t.id, label: t.title, size: 'small', checked: true, attrs: `data-cf="${t.id}"` })}</div>`).join('') || '<p class="empty">All caught up for today.</p>'}</div>
        ${d.left.length ? `<p class="hint" style="margin:10px 0">Ticked tasks move to tomorrow when you press the button. You choose which ones.</p>${pillBtn('Move ticked to tomorrow', 'data-act="carry"', 'is-sm')}` : ''}</section>
      <section class="glass"><h3>Tomorrow’s preparation</h3><div class="stack">${next.map((x) => `<div class="row between"><span>${esc(x.task.title)}</span><span class="pill">${esc(x.reasons[0] || 'Next up')}</span></div>`).join('') || '<p class="empty">Nothing queued.</p>'}</div></section></div>
    <div class="stack"><form class="glass stack" data-submit="save" novalidate><h3 style="margin:0">Reflect</h3>
      ${field('Wins (one per line)', `<textarea class="ui-input" id="rv-w" rows="3">${esc((r.wins || []).join('\n'))}</textarea>`)}
      ${field('Blockers (one per line)', `<textarea class="ui-input" id="rv-b" rows="3">${esc((r.blockers || []).join('\n'))}</textarea>`)}
      ${field('Notes', `<textarea class="ui-input" id="rv-n" rows="3">${esc(r.notes || '')}</textarea>`)}
      <div class="row wrapx">${btnPrimary(d.saved ? 'Update review' : 'Save review', 'type="submit" id="rv-save"', 'text-lg')}${d.saved ? pillBtn('Email me this review', 'type="button" data-act="email"', 'is-sm') : ''}</div></form>
      <section class="glass"><h3>Past reviews</h3>${past.map((x) => `<div class="row between" style="padding:6px 0"><span>${esc(fmtDay(x.date))}</span><span class="pill">${(x.completedTaskIds || []).length} done · ${(x.wins || []).length} wins</span></div>`).join('') || '<p class="empty">Your saved reviews appear here.</p>'}</section></div></div>`;
  },
  async submit(name, el) {
    const d = data(), body = { date: d.key, wins: lines($('#rv-w').value), blockers: lines($('#rv-b').value), notes: $('#rv-n').value.trim() || null, completedTaskIds: d.done.map((t) => t.id), unfinishedTaskIds: d.left.map((t) => t.id) };
    await busy($('#rv-save'), async () => { await add('reviews', body); toast('Review saved', 'ok'); changed(); });
  },
  async act(name, el) {
    if (name === 'carry') {
      const ids = $$('[data-cf]').filter((c) => c.checked).map((c) => c.dataset.cf); if (!ids.length) return toast('Tick at least one task first.');
      const z = tz(), tmr = TZ.addDays(todayKey(), 1);
      for (const id of ids) { const t = S.tasks.find((x) => x.id === id); const due = t.dueAt && Date.parse(t.dueAt) > Date.now() ? t.dueAt : new Date(TZ.at(tmr, '23:59', z)).toISOString(); await patch('tasks', id, { dueAt: due, scheduledStart: null, scheduledEnd: null }); }
      toast(`Moved ${ids.length} task${ids.length > 1 ? 's' : ''} to tomorrow`, 'ok'); changed();
    }
    if (name === 'email') await busy(el, async () => { try { const r = await api('POST', `/reviews/${todayKey()}/email`); toast(r.mode === 'smtp' ? `Sent to ${S.user.email}` : 'Saved to the preview inbox (SMTP not configured — see Settings).', 'ok'); } catch (e) { toast(msg(e), 'err'); } });
  },
};
