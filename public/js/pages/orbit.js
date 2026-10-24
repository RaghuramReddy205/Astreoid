import { S } from '../store.js';
import { esc, fmt, relDue, pillBtn, CAT_LABEL } from '../ui.js';
import { openTaskForm, setDone } from '../common.js';

const CATC = { academics: '#8b7bff', coding: '#2dd4bf', project: '#f59e0b', personal: '#fb7185', habit: '#84cc16' };
let sel = null, tip = null, ref = null;
function panel() {
  const t = S.tasks.find((x) => x.id === sel);
  if (!t) return `<p class="empty" style="padding:8px">Click an asteroid to inspect a task.<br><span class="hint">Closer rings = more urgent. Bigger = higher priority.</span></p>`;
  return `<div class="stack"><div><span class="pill cat cat-${t.category}">${CAT_LABEL[t.category]}</span> <span class="pill ${t.priority}">${esc(t.priority)}</span></div>
    <div style="font-size:1.2rem;font-weight:700;overflow-wrap:anywhere" data-strike="${t.id}">${esc(t.title)}</div>
    ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ''}
    <div class="muted">${t.dueAt ? 'Due ' + esc(fmt(t.dueAt)) + ' (' + esc(relDue(t.dueAt)) + ')' : 'No deadline'}${t.estimatedMinutes ? ' · ' + t.estimatedMinutes + ' min' : ''}</div>
    <div class="row wrapx">${pillBtn('Complete', 'data-act="orb-done"', 'is-sm')}${pillBtn('Edit', 'data-act="orb-edit"', 'is-sm')}</div></div>`;
}
export default {
  id: 'orbit', label: 'Orbit', title: 'Task orbit', icon: 'orbit', orbit: true,
  render() {
    const open = S.tasks.filter((t) => ['pending', 'in_progress', 'blocked'].includes(t.status));
    return `<div class="page-head pt"><div class="grow glass ptn" style="padding:12px 16px;max-width:520px"><h1 style="font-size:1.6rem">Task orbit</h1><p>${open.length} open task${open.length === 1 ? '' : 's'} circling your day. Drag to rotate · scroll to zoom · click to inspect.</p></div></div>
    <aside class="glass ptn orbit-side" aria-live="polite" id="orb-side">${window.__astreoid?.scene ? panel() : '<p class="empty">3D needs WebGL, which is unavailable in this browser. Use the Tasks page instead.</p>'}</aside>
    <div class="glass ptn orbit-hint"><div class="orbit-legend">${Object.entries(CATC).map(([k, c]) => `<span style="--c:${c}"><i></i>${CAT_LABEL[k]}</span>`).join('')}</div>
    <p class="hint" style="margin-top:8px">Rings, inner → outer: overdue · today · 3 days · this week · later.</p></div>`;
  },
  mount(root, c) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'orbit-tip hidden'; document.body.appendChild(tip); }
    c.scene?.onPick((id) => { sel = id; c.scene.select(id); const s = document.getElementById('orb-side'); if (s) s.innerHTML = panel(); });
    c.scene?.onHover((id, x, y) => { if (!id) { tip.classList.add('hidden'); return; } const t = S.tasks.find((k) => k.id === id); if (!t) return; tip.textContent = t.title; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.remove('hidden'); });
    if (sel && !S.tasks.find((t) => t.id === sel && ['pending', 'in_progress', 'blocked'].includes(t.status))) sel = null;
    c.scene?.select(sel);
  },
  unmount(c) { tip?.classList.add('hidden'); c?.scene?.onPick(() => {}); c?.scene?.onHover(() => {}); },
  async act(name) {
    const t = S.tasks.find((x) => x.id === sel); if (!t) return;
    if (name === 'orb-done') { const id = t.id; await setDone(id, true); sel = null; }
    if (name === 'orb-edit') openTaskForm(t);
  },
};
