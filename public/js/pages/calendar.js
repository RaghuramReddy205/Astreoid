import { S, add, patch, remove, tz } from '../store.js';
import { esc, fmt, fmtDay, todayKey, field, input, pillBtn, plusBtn, btnPrimary, checkbox, openModal, toast, ICONS, $ } from '../ui.js';
import { taskRow, changed, msg } from '../common.js';
const TZ = window.AST.tz, P = window.AST.priority;
let month = null, sel = null;     // month = 'YYYY-MM', sel = 'YYYY-MM-DD'
const H0 = 6, H1 = 23;

function init() { if (!month) { sel = todayKey(); month = sel.slice(0, 7); } }
function cells() {
  const [y, m] = month.split('-').map(Number), first = `${month}-01`, lead = TZ.weekday(first), start = TZ.addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => TZ.addDays(start, i));
}
function dayItems(key) {
  const z = tz(), s = TZ.at(key, '00:00', z), e = TZ.at(TZ.addDays(key, 1), '00:00', z);
  const sched = S.tasks.filter((t) => t.scheduledStart && t.status !== 'cancelled' && Date.parse(t.scheduledStart) >= s && Date.parse(t.scheduledStart) < e);
  const due = S.tasks.filter((t) => t.dueAt && P.OPEN.includes(t.status) && Date.parse(t.dueAt) >= s && Date.parse(t.dueAt) < e);
  return { sched, due, events: P.eventsOn(S.events, key, z) };
}
function timeline(key) {
  const z = tz(), it = dayItems(key), rows = [];
  for (let h = H0; h <= H1; h++) {
    const inHour = (ms) => { const hr = TZ.parts(ms, z).h; return Math.min(Math.max(hr, H0), H1) === h; };
    const blocks = [
      ...it.events.filter((e) => inHour(e.start)).map((e) => `<div class="block ev"><span class="grow">🗓 ${esc(e.title)} · ${esc(fmt(e.start, { hour: 'numeric', minute: '2-digit' }))}–${esc(fmt(e.end, { hour: 'numeric', minute: '2-digit' }))}${e.event.repeat === 'weekly' ? ' · weekly' : ''}</span><button class="row-btn danger" data-act="del-event" data-id="${e.id}" aria-label="Delete ${esc(e.title)}">${ICONS.x}</button></div>`),
      ...it.sched.filter((t) => inHour(Date.parse(t.scheduledStart))).map((t) => `<div class="block"><span class="grow"><b>${esc(fmt(t.scheduledStart, { hour: 'numeric', minute: '2-digit' }))}</b> · ${esc(t.title)}${t.estimatedMinutes ? ` (${t.estimatedMinutes}m)` : ''}</span><button class="row-btn" data-act="unschedule" data-id="${t.id}" aria-label="Unschedule ${esc(t.title)}" title="Remove from schedule">${ICONS.x}</button></div>`)];
    rows.push(`<div class="hour"><div class="h">${new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: true, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h)))}</div>
      <div class="slot" data-drop="${h}">${blocks.join('')}<div><button class="link-btn" data-act="slot" data-h="${h}" aria-label="Plan something at ${h}:00">+ Plan here</button></div></div></div>`);
  }
  return rows.join('');
}
function eventForm(key, h) {
  const body = `<form id="ev" class="stack" novalidate>${field('Title', input('id="ev-t" maxlength="100" placeholder="Operating Systems lecture" required'))}
    <div class="field-row">${field('Date', input(`id="ev-d" type="date" value="${key}"`))}${field('Starts', input(`id="ev-s" type="time" value="${String(h ?? 9).padStart(2, '0')}:00"`))}${field('Ends', input(`id="ev-e" type="time" value="${String(Math.min((h ?? 9) + 1, 23)).padStart(2, '0')}:00"`))}</div>
    ${checkbox({ id: 'ev-w', label: 'Repeats every week', desc: 'Good for classes and fixed commitments' })}<div class="err" id="ev-err" role="alert"></div>
    <div>${btnPrimary('Add commitment', 'type="submit"', 'text-lg')}</div></form>`;
  openModal({ title: 'Fixed commitment', body, onMount: (m, close) => { $('#ev', m).onsubmit = async (e) => { e.preventDefault(); try { await add('events', { title: $('#ev-t', m).value, date: $('#ev-d', m).value, startTime: $('#ev-s', m).value, endTime: $('#ev-e', m).value, repeat: $('#ev-w', m).checked ? 'weekly' : 'none' }); close(); changed(); toast('Commitment added', 'ok'); } catch (x) { $('#ev-err', m).textContent = msg(x); } }; } });
}
function slotForm(key, h) {
  const free = S.tasks.filter((t) => P.OPEN.includes(t.status) && !t.scheduledStart);
  const body = `<form id="sl" class="stack" novalidate>${free.length ? `${field('Task', `<select class="ui-input" id="sl-t">${free.map((t) => `<option value="${t.id}">${esc(t.title.slice(0, 70))}</option>`).join('')}</select>`)}
    <div class="field-row">${field('Starts', input(`id="sl-s" type="time" value="${String(h).padStart(2, '0')}:00"`))}${field('Minutes', input(`id="sl-m" type="number" min="5" max="600" value="${free[0].estimatedMinutes || 60}"`))}</div><div class="err" id="sl-err" role="alert"></div><div>${btnPrimary('Schedule it', 'type="submit"', 'text-lg')}</div>` : '<p class="empty">Every open task is already scheduled. Add a task first.</p>'}
    <p class="hint">Or <button type="button" class="link-btn" id="sl-ev">add a fixed commitment</button> at this time.</p></form>`;
  openModal({ title: `Plan ${fmtDay(key)}`, body, onMount: (m, close) => {
    $('#sl-ev', m).onclick = () => { close(); eventForm(key, h); };
    const f = $('#sl', m); const tsel = $('#sl-t', m); if (tsel) tsel.onchange = () => { $('#sl-m', m).value = S.tasks.find((t) => t.id === tsel.value).estimatedMinutes || 60; };
    f.onsubmit = async (e) => { e.preventDefault(); try { const start = TZ.at(key, $('#sl-s', m).value, tz()), mins = parseInt($('#sl-m', m).value, 10) || 60; await patch('tasks', tsel.value, { scheduledStart: new Date(start).toISOString(), scheduledEnd: new Date(start + mins * 60000).toISOString() }); close(); changed(); toast('Scheduled', 'ok'); } catch (x) { $('#sl-err', m).textContent = msg(x); } };
  } });
}
export default {
  id: 'calendar', label: 'Calendar', title: 'Calendar', icon: 'plans',
  render() {
    init(); const today = todayKey(), it = dayItems(sel), name = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(month + '-01T00:00:00Z'));
    const free = S.tasks.filter((t) => P.OPEN.includes(t.status) && !t.scheduledStart);
    return `<div class="page-head"><div class="grow"><h1>Calendar</h1><p>Classes, deadlines and the work you schedule yourself. You approve every block.</p></div>
      <div class="row">${plusBtn('Add fixed commitment', 'data-act="add-event"')}<span class="muted">Commitment</span></div></div>
    <div class="grid g-main"><section class="glass" aria-label="Month view"><div class="row between wrapx" style="margin-bottom:12px"><h2 style="font-size:1.25rem">${esc(name)}</h2><div class="row">${pillBtn('‹', 'data-act="prev" aria-label="Previous month"', 'is-sm')}${pillBtn('Today', 'data-act="today"', 'is-sm')}${pillBtn('›', 'data-act="next" aria-label="Next month"', 'is-sm')}</div></div>
      <div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells().map((k) => { const d = dayItems(k); return `<button class="day ${k.slice(0, 7) !== month ? 'dim' : ''} ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''}" data-act="pick" data-k="${k}" aria-label="${esc(fmtDay(k))}${d.due.length ? ', ' + d.due.length + ' due' : ''}"><span>${+k.slice(8)}</span><span class="dots">${d.due.length ? '<i class="due"></i>' : ''}${d.sched.length ? '<i></i>' : ''}${d.events.length ? '<i class="ev"></i>' : ''}</span></button>`; }).join('')}</div>
      <p class="hint" style="margin-top:10px"><span class="legend-dot" style="background:var(--danger)"></span>due <span class="legend-dot" style="background:var(--accent);margin-left:10px"></span>scheduled <span class="legend-dot" style="background:var(--accent-2);margin-left:10px"></span>commitment</p></section>
    <div class="stack"><section class="glass" aria-label="Unscheduled tasks"><h3>Unscheduled <span class="hint">drag onto an hour →</span></h3><div class="stack list-scroll">${free.length ? free.slice(0, 12).map((t) => taskRow(t, { actions: false, drag: true })).join('') : '<p class="empty">Everything open is scheduled.</p>'}</div></section></div></div>
    <section class="glass" style="margin-top:16px" aria-label="Day planner"><h3>${esc(fmtDay(sel))}${sel === today ? ' · today' : ''}</h3>
      ${it.due.length ? `<div class="stack" style="margin-bottom:12px"><span class="hint">Due this day</span>${it.due.map((t) => taskRow(t)).join('')}</div>` : ''}<div>${timeline(sel)}</div></section>`;
  },
  act(name, el) {
    if (name === 'prev' || name === 'next') { month = TZ.addDays(month + '-15', name === 'next' ? 30 : -30).slice(0, 7); changed(); }
    else if (name === 'today') { sel = todayKey(); month = sel.slice(0, 7); changed(); }
    else if (name === 'pick') { sel = el.dataset.k; if (sel.slice(0, 7) !== month) month = sel.slice(0, 7); changed(); }
    else if (name === 'add-event') eventForm(sel);
    else if (name === 'slot') slotForm(sel, +el.dataset.h);
    else if (name === 'unschedule') return patch('tasks', el.dataset.id, { scheduledStart: null, scheduledEnd: null }).then(changed);
    else if (name === 'del-event') { if (confirm('Delete this commitment (all repeats)?')) return remove('events', el.dataset.id).then(changed); }
  },
  async drop(id, slot) {
    const t = S.tasks.find((x) => x.id === id); if (!t) return;
    const start = TZ.at(sel, `${String(slot.dataset.drop).padStart(2, '0')}:00`, tz());
    try { await patch('tasks', id, { scheduledStart: new Date(start).toISOString(), scheduledEnd: new Date(start + (t.estimatedMinutes || 60) * 60000).toISOString() }); changed(); toast(`Scheduled “${t.title}”`, 'ok'); } catch (e) { toast(msg(e), 'err'); }
  },
};
