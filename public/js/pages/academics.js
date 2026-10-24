import { S, add, patch, remove, tz } from '../store.js';
import { esc, fmt, field, input, pillBtn, plusBtn, btnPrimary, checkbox, openModal, toast, ICONS, todayKey, $ } from '../ui.js';
import { taskRow, changed, msg } from '../common.js';
const P = window.AST.priority;
const uid = () => Math.random().toString(36).slice(2, 10);
const days = (k) => Math.round((Date.parse(k + 'T00:00:00Z') - Date.parse(todayKey() + 'T00:00:00Z')) / 864e5);

function subjectForm() {
  openModal({ title: 'New subject', body: `<form id="sf" class="stack" novalidate>${field('Subject name', input('id="sf-n" maxlength="80" placeholder="Data Structures" required'))}${field('Exam date (optional)', input('id="sf-d" type="date"'))}<div class="err" id="sf-e" role="alert"></div><div>${btnPrimary('Add subject', 'type="submit"', 'text-lg')}</div></form>`,
    onMount: (m, close) => { $('#sf', m).onsubmit = async (e) => { e.preventDefault(); try { await add('subjects', { name: $('#sf-n', m).value, examDate: $('#sf-d', m).value || null, topics: [] }); close(); changed(); toast('Subject added', 'ok'); } catch (x) { $('#sf-e', m).textContent = msg(x); } }; } });
}
export default {
  id: 'academics', label: 'Study', title: 'Academics', icon: 'academics',
  render() {
    const cards = S.subjects.map((s) => {
      const tp = s.topics || [], done = tp.filter((t) => t.done).length, pct = tp.length ? Math.round(done / tp.length * 100) : 0;
      const d = s.examDate ? days(s.examDate) : null, rel = S.tasks.filter((t) => t.subject && t.subject.toLowerCase() === s.name.toLowerCase() && P.OPEN.includes(t.status));
      return `<section class="glass" aria-label="${esc(s.name)}"><div class="row between wrapx"><h3 style="margin:0">${esc(s.name)}</h3><div class="row">${d !== null ? `<span class="pill ${d < 0 ? '' : d <= 7 ? 'high' : d <= 21 ? 'medium' : 'low'}">${d < 0 ? 'Exam passed' : d === 0 ? 'Exam today' : `Exam in ${d} day${d > 1 ? 's' : ''}`}</span>` : ''}<button class="row-btn danger" data-act="del-subject" data-id="${s.id}" aria-label="Delete ${esc(s.name)}">${ICONS.trash}</button></div></div>
        <div class="row" style="margin:12px 0 6px"><div class="bar grow" style="flex:1"><i style="width:${pct}%"></i></div><b>${pct}%</b></div><div class="hint">Revision: ${done} of ${tp.length} topics covered</div>
        <div class="stack" style="margin-top:12px">${tp.map((t) => `<div class="row">${checkbox({ id: 'tp-' + t.id, checked: t.done, label: t.title, size: 'small', attrs: `data-chg="topic" data-sid="${s.id}" data-tid="${t.id}"` })}<button class="row-btn danger" style="margin-left:auto" data-act="del-topic" data-sid="${s.id}" data-tid="${t.id}" aria-label="Remove ${esc(t.title)}">${ICONS.x}</button></div>`).join('')}
          <div class="row"><input class="ui-input" id="nt-${s.id}" maxlength="120" placeholder="Add a topic or chapter" data-key="topic" data-sid="${s.id}" aria-label="New topic">${plusBtn('Add topic', `data-act="add-topic" data-sid="${s.id}"`)}</div></div>
        <h4 style="margin:16px 0 8px">Open tasks (${rel.length})</h4><div class="stack">${rel.slice(0, 3).map((t) => taskRow(t)).join('') || '<p class="hint">No open tasks for this subject.</p>'}</div>
        <p style="margin-top:10px">${pillBtn('Add task', `data-act="new-task" data-cat="academics" data-subject="${esc(s.name)}"`, 'is-sm')}</p></section>`;
    }).join('');
    const upcoming = S.subjects.filter((s) => s.examDate && days(s.examDate) >= 0).sort((a, b) => a.examDate.localeCompare(b.examDate));
    return `<div class="page-head"><div class="grow"><h1>Academics</h1><p>Subjects, exams, assignments and revision.</p></div><div class="row">${plusBtn('New subject', 'data-act="new-subject"')}<span class="muted">New subject</span></div></div>
    ${upcoming.length ? `<div class="glass" style="margin-bottom:16px"><h3>Upcoming exams</h3><div class="row wrapx">${upcoming.map((s) => `<span class="pill ${days(s.examDate) <= 7 ? 'high' : ''}">${esc(s.name)} · ${esc(fmt(s.examDate + 'T00:00:00Z', { day: 'numeric', month: 'short', timeZone: 'UTC' }))}</span>`).join('')}</div></div>` : ''}
    <div class="grid g2">${cards || '<div class="glass empty" style="grid-column:1/-1">No subjects yet. Add one to track exams and revision. Tasks whose subject matches are listed under it.</div>'}</div>`;
  },
  async act(name, el) {
    if (name === 'new-subject') return subjectForm();
    if (name === 'del-subject') { if (confirm('Delete this subject and its topics?')) { await remove('subjects', el.dataset.id); changed(); } return; }
    if (name === 'add-topic' || name === 'topic-key') return this.addTopic(el.dataset.sid);
    if (name === 'del-topic') { const s = S.subjects.find((x) => x.id === el.dataset.sid); await patch('subjects', s.id, { topics: s.topics.filter((t) => t.id !== el.dataset.tid) }); changed(); }
  },
  async key(name, el) { await this.addTopic(el.dataset.sid); },
  async addTopic(sid) {
    const inp = document.getElementById('nt-' + sid), v = inp.value.trim(); if (!v) return;
    const s = S.subjects.find((x) => x.id === sid); await patch('subjects', sid, { topics: [...(s.topics || []), { id: uid(), title: v, done: false }] }); changed();
    document.getElementById('nt-' + sid)?.focus();
  },
  async chg(name, el) {
    if (name !== 'topic') return; const s = S.subjects.find((x) => x.id === el.dataset.sid);
    await patch('subjects', s.id, { topics: s.topics.map((t) => (t.id === el.dataset.tid ? { ...t, done: el.checked } : t)) }); changed();
  },
};
