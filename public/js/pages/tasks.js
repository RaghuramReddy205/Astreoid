import { S, tz } from '../store.js';
import { esc, field, input, radioGroup, val, plusBtn, CATS } from '../ui.js';
import { taskRow } from '../common.js';
const P = window.AST.priority;
let q = '', status = 'open', cat = 'all', sort = 'smart';

function list() {
  let items = S.tasks.filter((t) => (status === 'all' || (status === 'open' ? P.OPEN.includes(t.status) : status === 'in_progress' ? t.status === 'in_progress' : t.status === 'completed')) && (cat === 'all' || t.category === cat) && (!q || (t.title + ' ' + (t.subject || '') + ' ' + (t.description || '')).toLowerCase().includes(q.toLowerCase())));
  if (sort === 'smart') { const order = new Map(P.rank(S.tasks).map((r, i) => [r.task.id, i])); items.sort((a, b) => (order.has(a.id) ? order.get(a.id) : 1e6) - (order.has(b.id) ? order.get(b.id) : 1e6) || b.createdAt.localeCompare(a.createdAt)); }
  else if (sort === 'due') items.sort((a, b) => (Date.parse(a.dueAt) || 1e15) - (Date.parse(b.dueAt) || 1e15));
  else items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.length ? items.map((t) => taskRow(t)).join('') : `<p class="empty">No tasks match. ${S.tasks.length ? 'Try clearing the filters.' : 'Add your first one with the + button.'}</p>`;
}
export default {
  id: 'tasks', label: 'Tasks', title: 'My tasks', icon: 'files',
  render() {
    return `<div class="page-head"><div class="grow"><h1>My tasks</h1><p>Search, filter, edit, complete and reschedule.</p></div><div class="row">${plusBtn('New task', 'data-act="new-task"')}<span class="muted">New task</span></div></div>
    <div class="grid" style="grid-template-columns:260px minmax(0,1fr);align-items:start" id="tgrid">
      <aside class="glass stack"><div class="field"><label for="t-q">Search</label><input class="ui-input" id="t-q" type="search" placeholder="Title, subject, notes…" value="${esc(q)}" data-inp="q"></div>
        <div class="field"><span class="lbl">Status</span>${radioGroup('t-status', [{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All' }], status, { attrs: 'data-chg="f-status"' })}</div>
        <div class="field"><span class="lbl">Category</span>${radioGroup('t-cat', [{ value: 'all', label: 'All' }, ...CATS], cat, { attrs: 'data-chg="f-cat"', color: '#2dd4bf' })}</div>
        <div class="field"><label for="t-sort">Sort by</label><select class="ui-input" id="t-sort" data-chg="f-sort">${[['smart', 'Smart priority'], ['due', 'Due date'], ['new', 'Newest']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></aside>
      <section class="glass stack" id="tlist" aria-live="polite">${list()}</section></div>
    <style>@media(max-width:860px){#tgrid{grid-template-columns:minmax(0,1fr)!important}}</style>`;
  },
  inp(name, el) { q = el.value; document.getElementById('tlist').innerHTML = list(); },
  chg(name, el) {
    if (name === 'f-status') status = el.value; else if (name === 'f-cat') cat = el.value; else if (name === 'f-sort') sort = el.value; else return;
    document.getElementById('tlist').innerHTML = list();
  },
};
