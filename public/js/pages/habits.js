import { S, add, patch, remove, tz } from '../store.js';
import { esc, fmt, field, input, pillBtn, plusBtn, btnPrimary, checkbox, openModal, toast, ICONS, todayKey, $ } from '../ui.js';
import { changed, msg } from '../common.js';
const TZ = window.AST.tz;

function streak(log) {
  const set = new Set(log || []); let k = todayKey(), n = 0;
  if (!set.has(k)) k = TZ.addDays(k, -1);
  while (set.has(k)) { n++; k = TZ.addDays(k, -1); }
  return n;
}
export default {
  id: 'habits', label: 'Habits', title: 'Goals & habits', icon: 'habits',
  render() {
    const today = todayKey(), week = Array.from({ length: 7 }, (_, i) => TZ.addDays(today, i - 6));
    const hs = S.habits.map((h) => `<div class="task"><div class="t-main"><div class="t-title">${esc(h.title)}</div><div class="t-meta"><span class="pill">🔥 ${streak(h.log)} day streak</span><span class="day-dots" aria-label="Last 7 days">${week.map((k) => `<i class="${(h.log || []).includes(k) ? 'on' : ''}" title="${esc(k)}"></i>`).join('')}</span></div></div>
      ${checkbox({ id: 'h-' + h.id, checked: (h.log || []).includes(today), label: 'Done today', size: 'small', attrs: `data-chg="habit" data-id="${h.id}"` })}
      <button class="row-btn danger" data-act="del-habit" data-id="${h.id}" aria-label="Delete ${esc(h.title)}">${ICONS.trash}</button></div>`).join('');
    const gs = S.goals.map((g) => `<div class="task" style="flex-wrap:wrap"><div class="t-main"><div class="t-title">${esc(g.title)}</div><div class="t-meta">${g.due ? `<span class="pill">Target ${esc(fmt(g.due + 'T00:00:00Z', { day: 'numeric', month: 'short', timeZone: 'UTC' }))}</span>` : ''}<span class="pill">${g.progress || 0}%</span></div>
      <input type="range" min="0" max="100" step="5" value="${g.progress || 0}" data-chg="goal" data-id="${g.id}" aria-label="Progress for ${esc(g.title)}" style="width:100%;margin-top:8px;accent-color:var(--accent-2)"></div>
      <button class="row-btn danger" data-act="del-goal" data-id="${g.id}" aria-label="Delete ${esc(g.title)}">${ICONS.trash}</button></div>`).join('');
    return `<div class="page-head"><div class="grow"><h1>Goals & habits</h1><p>Learning progress, routines, breaks and sleep consistency.</p></div></div>
    <div class="grid g2"><section class="glass" aria-label="Habits"><h3>Daily habits</h3><div class="stack">${hs || '<p class="empty">Add a routine — sleep by 11, 30 min walk, drink water…</p>'}
      <div class="row"><input class="ui-input" id="nh" maxlength="80" placeholder="New habit, e.g. Sleep before 11 PM" data-key="habit" aria-label="New habit">${plusBtn('Add habit', 'data-act="add-habit"')}</div></div></section>
    <section class="glass" aria-label="Goals"><h3>Goals</h3><div class="stack">${gs || '<p class="empty">Set a learning goal — finish the DSA course, build a portfolio…</p>'}
      <div class="row"><input class="ui-input" id="ng" maxlength="120" placeholder="New goal" data-key="goal" aria-label="New goal"><input class="ui-input" id="ngd" type="date" style="max-width:160px" aria-label="Target date">${plusBtn('Add goal', 'data-act="add-goal"')}</div></div></section></div>`;
  },
  async act(name, el) {
    if (name === 'add-habit') return this.addHabit();
    if (name === 'add-goal') return this.addGoal();
    if (name === 'del-habit') { if (confirm('Delete this habit and its history?')) { await remove('habits', el.dataset.id); changed(); } }
    if (name === 'del-goal') { await remove('goals', el.dataset.id); changed(); }
  },
  async key(name, el) { return name === 'habit' ? this.addHabit() : this.addGoal(); },
  async addHabit() { const v = document.getElementById('nh').value.trim(); if (!v) return; await add('habits', { title: v, log: [] }); changed(); document.getElementById('nh')?.focus(); },
  async addGoal() { const v = document.getElementById('ng').value.trim(); if (!v) return; await add('goals', { title: v, progress: 0, due: document.getElementById('ngd').value || null }); changed(); document.getElementById('ng')?.focus(); },
  async chg(name, el) {
    if (name === 'habit') { const h = S.habits.find((x) => x.id === el.dataset.id), t = todayKey(); const log = el.checked ? [...new Set([...(h.log || []), t])] : (h.log || []).filter((k) => k !== t); await patch('habits', h.id, { log: log.slice(-800) }); changed(); }
    if (name === 'goal') { await patch('goals', el.dataset.id, { progress: +el.value }); changed(); }
  },
};
