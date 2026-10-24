import { S, add, patch, remove } from '../store.js';
import { esc, fmt, field, input, pillBtn, plusBtn, btnPrimary, checkbox, openModal, toast, ICONS, $ } from '../ui.js';
import { taskRow, changed, msg } from '../common.js';
const P = window.AST.priority;
const uid = () => Math.random().toString(36).slice(2, 10);

export default {
  id: 'projects', label: 'Code', title: 'Coding & projects', icon: 'code',
  render() {
    const sessions = S.tasks.filter((t) => ['coding', 'project'].includes(t.category) && P.OPEN.includes(t.status));
    const cards = S.projects.map((p) => {
      const ms = p.milestones || [], done = ms.filter((m) => m.done).length, pct = ms.length ? Math.round(done / ms.length * 100) : 0;
      return `<section class="glass" aria-label="${esc(p.name)}"><div class="row between"><h3 style="margin:0">${esc(p.name)}</h3><button class="row-btn danger" data-act="del-project" data-id="${p.id}" aria-label="Delete ${esc(p.name)}">${ICONS.trash}</button></div>
        ${p.description ? `<p class="muted" style="margin-top:6px">${esc(p.description)}</p>` : ''}
        <div class="row" style="margin:12px 0 6px"><div class="bar" style="flex:1"><i style="width:${pct}%"></i></div><b>${pct}%</b></div><div class="hint">${done} of ${ms.length} milestones</div>
        <div class="stack" style="margin-top:12px">${ms.map((m) => `<div class="row">${checkbox({ id: 'ms-' + m.id, checked: m.done, label: m.title, desc: m.due ? 'Due ' + fmt(m.due + 'T00:00:00Z', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '', size: 'small', attrs: `data-chg="milestone" data-pid="${p.id}" data-mid="${m.id}"` })}<button class="row-btn danger" style="margin-left:auto" data-act="del-ms" data-pid="${p.id}" data-mid="${m.id}" aria-label="Remove ${esc(m.title)}">${ICONS.x}</button></div>`).join('')}
        <div class="row"><input class="ui-input" id="nm-${p.id}" maxlength="120" placeholder="Add a milestone" data-key="ms" data-pid="${p.id}" aria-label="New milestone"><input class="ui-input" id="nd-${p.id}" type="date" style="max-width:160px" aria-label="Milestone due date">${plusBtn('Add milestone', `data-act="add-ms" data-pid="${p.id}"`)}</div></div></section>`;
    }).join('');
    return `<div class="page-head"><div class="grow"><h1>Coding & projects</h1><p>Practice sessions, project milestones and debugging tasks.</p></div><div class="row">${plusBtn('New project', 'data-act="new-project"')}<span class="muted">New project</span></div></div>
    <div class="grid g-main"><div class="stack">${cards || '<div class="glass empty">No projects yet. Create one and break it into milestones.</div>'}</div>
    <section class="glass" aria-label="Coding sessions"><div class="row between"><h3 style="margin:0">Practice & debugging</h3>${plusBtn('New coding task', 'data-act="new-task" data-cat="coding"')}</div><div class="stack" style="margin-top:12px">${sessions.map((t) => taskRow(t)).join('') || '<p class="empty">No open coding or project tasks.</p>'}</div></section></div>`;
  },
  async act(name, el) {
    if (name === 'new-project') return openModal({ title: 'New project', body: `<form id="pf" class="stack" novalidate>${field('Project name', input('id="pf-n" maxlength="80" required placeholder="Astreoid web app"'))}${field('Description', `<textarea class="ui-input" id="pf-d" maxlength="500"></textarea>`)}<div class="err" id="pf-e" role="alert"></div><div>${btnPrimary('Create project', 'type="submit"', 'text-lg')}</div></form>`,
      onMount: (m, close) => { $('#pf', m).onsubmit = async (e) => { e.preventDefault(); try { await add('projects', { name: $('#pf-n', m).value, description: $('#pf-d', m).value, milestones: [] }); close(); changed(); toast('Project created', 'ok'); } catch (x) { $('#pf-e', m).textContent = msg(x); } }; } });
    if (name === 'del-project') { if (confirm('Delete this project?')) { await remove('projects', el.dataset.id); changed(); } return; }
    if (name === 'add-ms') return this.addMs(el.dataset.pid);
    if (name === 'del-ms') { const p = S.projects.find((x) => x.id === el.dataset.pid); await patch('projects', p.id, { milestones: p.milestones.filter((m) => m.id !== el.dataset.mid) }); changed(); }
  },
  async key(name, el) { await this.addMs(el.dataset.pid); },
  async addMs(pid) {
    const t = document.getElementById('nm-' + pid).value.trim(); if (!t) return; const d = document.getElementById('nd-' + pid).value || undefined;
    const p = S.projects.find((x) => x.id === pid); await patch('projects', pid, { milestones: [...(p.milestones || []), { id: uid(), title: t, done: false, due: d }] }); changed();
    document.getElementById('nm-' + pid)?.focus();
  },
  async chg(name, el) {
    if (name !== 'milestone') return; const p = S.projects.find((x) => x.id === el.dataset.pid);
    await patch('projects', p.id, { milestones: p.milestones.map((m) => (m.id === el.dataset.mid ? { ...m, done: el.checked } : m)) }); changed();
  },
};
