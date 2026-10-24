// Task rows, the task form, and click handlers shared by several pages.
import { S, add, patch, remove, byId, tz } from './store.js';
import { esc, fmt, relDue, checkbox, radioGroup, val, field, input, pillBtn, btnPrimary, openModal, toast, ICONS, CATS, PRIOS, CAT_LABEL, $ } from './ui.js';
const TZ = window.AST.tz, P = window.AST.priority;
export const changed = () => window.dispatchEvent(new Event('data:changed'));
export const msg = (e) => (e && e.message) || 'Something went wrong';

export function taskRow(t, { actions = true, drag = false, extra = '' } = {}) {
  const done = t.status === 'completed', over = !done && t.dueAt && Date.parse(t.dueAt) < Date.now();
  const rem = S.reminders.find((r) => r.taskId === t.id && r.status !== 'cancelled');
  return `<div class="task ${done ? 'done' : ''}" data-id="${t.id}" ${drag ? 'draggable="true"' : ''}>
    ${checkbox({ id: 'tk-' + t.id, checked: done, label: done ? 'Mark as not done' : 'Mark as done', size: 'small', iconOnly: true, attrs: `data-chg="toggle-task" data-id="${t.id}"` })}
    <div class="t-main"><div class="t-title">${esc(t.title)}</div><div class="t-meta">
      <span class="pill cat cat-${t.category}">${CAT_LABEL[t.category] || t.category}</span>
      <span class="pill ${t.priority}">${esc(t.priority)}</span>
      ${t.status === 'in_progress' ? '<span class="pill" style="color:var(--accent-2)">In progress</span>' : ''}${t.status === 'blocked' ? '<span class="pill high">Blocked</span>' : ''}
      ${t.dueAt ? `<span class="pill ${over ? 'overdue' : ''}" title="${esc(fmt(t.dueAt))}">${done ? 'Due ' + esc(fmt(t.dueAt, { day: 'numeric', month: 'short' })) : (over ? '' : 'Due ') + esc(relDue(t.dueAt))}</span>` : ''}
      ${t.estimatedMinutes ? `<span class="pill">${t.estimatedMinutes} min</span>` : ''}${t.subject ? `<span class="pill">${esc(t.subject)}</span>` : ''}
      ${t.scheduledStart ? `<span class="pill" title="Scheduled">📅 ${esc(fmt(t.scheduledStart))}</span>` : ''}
      ${rem ? `<span class="pill" title="Email reminder ${esc(rem.status)} · ${esc(fmt(rem.scheduledAt))}">🔔 ${rem.status === 'sent' ? 'sent' : esc(fmt(rem.scheduledAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</span>` : ''}
    </div>${extra}</div>
    ${actions ? `<div class="t-actions"><button class="row-btn" data-act="edit-task" data-id="${t.id}" aria-label="Edit ${esc(t.title)}" title="Edit">${ICONS.edit}</button><button class="row-btn danger" data-act="del-task" data-id="${t.id}" aria-label="Delete ${esc(t.title)}" title="Delete">${ICONS.trash}</button></div>` : ''}
  </div>`;
}

// Shows the strike-through right away and keeps the row visible for a moment before the page redraws.
export async function strike(id) {
  document.querySelectorAll(`.task[data-id="${id}"]`).forEach((r) => r.classList.add('done', 'striking'));
  document.querySelectorAll(`[data-strike="${id}"]`).forEach((r) => r.classList.add('struck'));
  await new Promise((r) => setTimeout(r, 1000));
}
export async function setDone(id, done) {
  try {
    const p = patch('tasks', id, { status: done ? 'completed' : 'pending' });
    if (done) await strike(id);
    await p; if (done) toast('Nice work — task completed.', 'ok');
  } catch (e) { toast(msg(e), 'err'); }
  changed();
}

const PRESETS = [['', 'No reminder'], ['0', 'At the due time'], ['15', '15 minutes before'], ['60', '1 hour before'], ['1440', '1 day before'], ['custom', 'Custom time…']];
export function openTaskForm(task, defaults = {}) {
  const t = task || { category: 'personal', priority: 'medium', status: 'pending', ...defaults };
  const zone = tz();
  let preset = '';
  if (t.remindAt) { const diff = t.dueAt ? Math.round((Date.parse(t.dueAt) - Date.parse(t.remindAt)) / 60000) : null; preset = PRESETS.some((p) => p[0] === String(diff)) && diff !== null ? String(diff) : 'custom'; }
  const others = S.tasks.filter((x) => x.id !== t.id && P.OPEN.includes(x.status));
  const body = `<form id="tf" class="stack" novalidate>
    ${field('Title', input(`id="tf-title" maxlength="140" placeholder="e.g. Practise Java loops" value="${esc(t.title || '')}" required`))}
    ${field('Details (optional)', `<textarea class="ui-input" id="tf-desc" maxlength="2000" placeholder="Notes, links, what “done” looks like…">${esc(t.description || '')}</textarea>`)}
    <div class="radio-wrap"><div class="field"><span class="lbl">Category</span>${radioGroup('tf-cat', CATS, t.category)}</div>
      <div class="field"><span class="lbl">Priority</span>${radioGroup('tf-pri', PRIOS, t.priority, { color: '#2dd4bf' })}</div>
      <div class="field" style="flex:1;min-width:200px">${field('Due', input(`id="tf-due" type="datetime-local" value="${TZ.toInput(t.dueAt, zone)}"`))}
        <div style="height:10px"></div>${field('Estimated minutes', input(`id="tf-est" type="number" min="1" max="1440" placeholder="45" value="${t.estimatedMinutes || ''}"`))}</div></div>
    <div class="field-row">
      ${field('Subject / topic', `<input class="ui-input" id="tf-sub" list="tf-subs" maxlength="80" placeholder="DSA, Physics…" value="${esc(t.subject || '')}"><datalist id="tf-subs">${S.subjects.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>`)}
      ${field('Status', `<select class="ui-input" id="tf-status">${[['pending', 'Pending'], ['in_progress', 'In progress'], ['blocked', 'Blocked'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([v, l]) => `<option value="${v}" ${t.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${field('Depends on', `<select class="ui-input" id="tf-dep"><option value="">Nothing</option>${others.map((o) => `<option value="${o.id}" ${t.dependsOn?.[0] === o.id ? 'selected' : ''}>${esc(o.title.slice(0, 50))}</option>`).join('')}</select>`)}</div>
    <div class="field-row">
      ${field('Email reminder', `<select class="ui-input" id="tf-rem">${PRESETS.map(([v, l]) => `<option value="${v}" ${preset === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`, `Sent to ${S.user.email}`)}
      <div class="field" id="tf-remc" ${preset === 'custom' ? '' : 'style="display:none"'}>${field('Remind me at', input(`id="tf-remat" type="datetime-local" value="${TZ.toInput(t.remindAt, zone)}"`))}</div>
      ${field('Schedule start (optional)', input(`id="tf-sched" type="datetime-local" value="${TZ.toInput(t.scheduledStart, zone)}"`), 'You decide when — nothing is auto-scheduled.')}</div>
    <div class="err" id="tf-err" role="alert"></div>
    <div class="row between wrapx"><span>${btnPrimary(task ? 'Save changes' : 'Add task', 'type="submit"', 'text-lg')}</span>${task ? `<button type="button" class="link-btn danger" id="tf-del">Delete task</button>` : ''}</div></form>`;
  openModal({ title: task ? 'Edit task' : 'New task', body, onMount: (m, close) => {
    $('#tf-rem', m).onchange = (e) => ($('#tf-remc', m).style.display = e.target.value === 'custom' ? '' : 'none');
    if (task) $('#tf-del', m).onclick = async () => { if (!confirm('Delete this task?')) return; try { await remove('tasks', task.id); close(); changed(); toast('Task deleted'); } catch (e) { toast(msg(e), 'err'); } };
    $('#tf', m).onsubmit = async (ev) => {
      ev.preventDefault(); const err = $('#tf-err', m); err.textContent = '';
      try {
        const title = $('#tf-title', m).value.trim(); if (!title) throw new Error('Give the task a title');
        const dueAt = TZ.fromInput($('#tf-due', m).value, zone), est = parseInt($('#tf-est', m).value, 10) || null;
        const rs = $('#tf-rem', m).value; let remindAt = null;
        if (rs === 'custom') { remindAt = TZ.fromInput($('#tf-remat', m).value, zone); if (!remindAt) throw new Error('Pick a reminder time'); }
        else if (rs !== '') { if (!dueAt) throw new Error('Set a due date to use a relative reminder'); remindAt = new Date(Date.parse(dueAt) - +rs * 60000).toISOString(); }
        const ss = TZ.fromInput($('#tf-sched', m).value, zone);
        const data = { title, description: $('#tf-desc', m).value.trim() || null, category: val(m, 'tf-cat'), priority: val(m, 'tf-pri'), status: $('#tf-status', m).value, dueAt: dueAt || null, estimatedMinutes: est, subject: $('#tf-sub', m).value.trim() || null, dependsOn: $('#tf-dep', m).value ? [$('#tf-dep', m).value] : [], remindAt: remindAt || null, scheduledStart: ss || null, scheduledEnd: ss ? new Date(Date.parse(ss) + (est || 60) * 60000).toISOString() : null };
        if (task && remindAt === task.remindAt) delete data.remindAt;      // unchanged reminders are not re-validated
        if (task) await patch('tasks', task.id, data); else await add('tasks', data);
        close(); changed(); toast(task ? 'Task updated' : 'Task added', 'ok');
      } catch (e) { err.textContent = msg(e); }
    };
  } });
}

// Click / change handlers that behave identically on every page.
export async function common(name, el) {
  const id = el.dataset.id;
  try {
    if (name === 'edit-task') { openTaskForm(byId('tasks', id)); return true; }
    if (name === 'del-task') { const t = byId('tasks', id); if (confirm(`Delete “${t.title}”?`)) { await remove('tasks', id); changed(); toast('Task deleted'); } return true; }
    if (name === 'toggle-task') { await setDone(id, el.checked); return true; }
    if (name === 'new-task') { openTaskForm(null, el.dataset.cat ? { category: el.dataset.cat, subject: el.dataset.subject } : {}); return true; }
  } catch (e) { toast(msg(e), 'err'); changed(); return true; }
  return false;
}
