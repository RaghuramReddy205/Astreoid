import { api } from '../api.js';
import { S, add, patch, tz } from '../store.js';
import { esc, fmt, field, input, pillBtn, btnPrimary, toast, busy, CATS, PRIOS, CAT_LABEL, $, $$ } from '../ui.js';
import { changed, msg } from '../common.js';
const TZ = window.AST.tz;

const log = [{ role: 'bot', text: 'Hi! Tell me what you need to do in plain English — I will turn it into tasks, you check the preview, and only then do I save anything. You can also ask “what should I do next?” or “plan my day”.' }];
let nextId = 1;
const SUGGEST = ['Tomorrow I need to practise Java loops for 45 minutes and submit my DSA assignment by 8 PM.', 'Remind me to call the lab TA tomorrow at 4 pm', 'What should I do next?', 'Plan my day', "What's due?"];

function draftCard(d, i, mid) {
  const z = tz();
  return `<div class="draft" data-mid="${mid}" data-i="${i}">
    <div class="field-row">${field('Title', `<input class="ui-input" data-f="title" maxlength="140" value="${esc(d.title)}">`)}
    ${field('Category', `<select class="ui-input" data-f="category">${CATS.map((c) => `<option value="${c.value}" ${d.category === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}</select>`)}
    ${field('Priority', `<select class="ui-input" data-f="priority">${PRIOS.map((c) => `<option value="${c.value}" ${d.priority === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}</select>`)}</div>
    <div class="field-row" style="margin-top:10px">${field(d.scheduledStart ? 'Scheduled start' : 'Due', `<input class="ui-input" data-f="${d.scheduledStart ? 'scheduledStart' : 'dueAt'}" type="datetime-local" value="${TZ.toInput(d.scheduledStart || d.dueAt, z)}">`)}
    ${field('Minutes', `<input class="ui-input" data-f="estimatedMinutes" type="number" min="1" max="1440" value="${d.estimatedMinutes || ''}">`)}
    ${field('Subject', `<input class="ui-input" data-f="subject" maxlength="80" value="${esc(d.subject || '')}">`)}</div>
    ${d.remindAt ? `<p class="hint" style="margin-top:8px">🔔 Email reminder at ${esc(fmt(d.remindAt))}</p>` : ''}
    ${(d.assumptions || []).map((a) => `<p class="hint" style="margin-top:6px">ℹ️ ${esc(a)}</p>`).join('')}</div>`;
}
function msgHtml(m) {
  if (m.role === 'me') return `<div class="msg me">${esc(m.text)}</div>`;
  let h = `<div class="msg"><div>${esc(m.text)}</div>`;
  if (m.drafts?.length && !m.done) h += m.drafts.map((d, i) => draftCard(d, i, m.id)).join('') + `<div class="row wrapx" style="margin-top:12px">${btnPrimary(`Save ${m.drafts.length} task${m.drafts.length > 1 ? 's' : ''}`, `data-act="save-drafts" data-mid="${m.id}"`, 'text-base')}${pillBtn('Discard', `data-act="discard" data-mid="${m.id}"`, 'is-sm')}</div>`;
  if (m.recommendations) h += `<ol style="margin:10px 0 0;padding-left:20px">${m.recommendations.map((r) => `<li style="margin:6px 0"><b>${esc(r.title)}</b>${r.estimatedMinutes ? ` · ${r.estimatedMinutes} min` : ''}<div class="hint">${esc(r.reasons.join(' · ') || 'Next on your list')}</div></li>`).join('')}</ol>`;
  if (m.proposal && !m.done) h += `<div class="stack" style="margin-top:10px">${m.proposal.map((p) => `<div class="block"><span class="grow"><b>${esc(fmt(p.start, { hour: 'numeric', minute: '2-digit' }))}–${esc(fmt(p.end, { hour: 'numeric', minute: '2-digit' }))}</b> · ${esc(p.title)}</span></div>`).join('')}</div><div class="row wrapx" style="margin-top:12px">${btnPrimary('Apply to my schedule', `data-act="apply-plan" data-mid="${m.id}"`, 'text-base')}${pillBtn('Dismiss', `data-act="discard" data-mid="${m.id}"`, 'is-sm')}</div>`;
  return h + '</div>';
}
const scroll = () => { const l = $('#chat-log'); if (l) l.scrollTop = l.scrollHeight; };
const draw = () => { const l = $('#chat-log'); if (l) { l.innerHTML = log.map(msgHtml).join(''); scroll(); } };

async function send(text) {
  text = text.trim(); if (!text) return;
  log.push({ role: 'me', text }); const box = $('#chat-in'); if (box) box.value = ''; draw();
  try { const r = await api('POST', '/chat', { message: text }); log.push({ role: 'bot', id: nextId++, text: r.reply, drafts: r.drafts, recommendations: r.recommendations, proposal: r.proposal }); }
  catch (e) { log.push({ role: 'bot', text: 'Sorry — ' + msg(e) }); }
  draw();
}
export default {
  id: 'chat', label: 'Chat', title: 'Chat assistant', icon: 'chat',
  render() {
    return `<div class="page-head"><div class="grow"><h1>Chat assistant</h1><p>Add tasks in ordinary language and ask for recommendations.</p></div></div>
    <section class="glass" aria-label="Chat"><div class="chips">${SUGGEST.map((s) => `<button class="chip-btn" data-act="suggest" data-t="${esc(s)}">${esc(s.length > 48 ? s.slice(0, 46) + '…' : s)}</button>`).join('')}</div>
    <div class="chat-log" id="chat-log" aria-live="polite">${log.map(msgHtml).join('')}</div>
    <form class="row" style="margin-top:14px;align-items:flex-end" data-submit="send"><div style="flex:1"><label class="sr" for="chat-in">Message</label><textarea class="ui-input" id="chat-in" rows="2" maxlength="1500" placeholder="e.g. Tomorrow I need to revise DBMS for 2 hours and submit the lab record by 5 PM" data-key="send" style="min-height:3.2rem"></textarea></div>${pillBtn('Send', 'type="submit"')}</form>
    <p class="hint" style="margin-top:8px">Enter to send · Shift+Enter for a new line. Dates are read in your time zone (${esc(tz())}). Nothing is saved until you confirm.</p></section>`;
  },
  mount() { scroll(); },
  async submit(name) { await send($('#chat-in').value); },
  async key(name, el, e) { if (e.shiftKey) { el.value += '\n'; return; } await send(el.value); },
  async act(name, el) {
    const m = log.find((x) => x.id === +el.dataset.mid);
    if (name === 'suggest') return send(el.dataset.t);
    if (name === 'discard') { m.done = true; log.push({ role: 'bot', text: 'Discarded — nothing was saved.' }); draw(); return; }
    if (name === 'save-drafts') {
      const cards = $$(`.draft[data-mid="${m.id}"]`); let ok = 0; const zone = tz();
      await busy(el, async () => {
        for (const c of cards) {
          const g = (f) => c.querySelector(`[data-f="${f}"]`)?.value, d = m.drafts[+c.dataset.i];
          const title = g('title').trim(); if (!title) { toast('Every task needs a title.', 'err'); return; }
          const body = { title, category: g('category'), priority: g('priority'), estimatedMinutes: parseInt(g('estimatedMinutes'), 10) || null, subject: g('subject').trim() || null };
          const due = c.querySelector('[data-f="dueAt"]'), sch = c.querySelector('[data-f="scheduledStart"]');
          if (due) body.dueAt = TZ.fromInput(due.value, zone) || null;
          if (sch) { body.scheduledStart = TZ.fromInput(sch.value, zone) || null; if (body.scheduledStart) body.scheduledEnd = new Date(Date.parse(body.scheduledStart) + (body.estimatedMinutes || 60) * 60000).toISOString(); }
          if (d.remindAt && Date.parse(d.remindAt) > Date.now()) body.remindAt = d.remindAt;
          try { await add('tasks', body); ok++; } catch (e) { toast(`“${title}”: ${msg(e)}`, 'err'); }
        }
        if (ok === cards.length) { m.done = true; log.push({ role: 'bot', text: `Saved ${ok} task${ok > 1 ? 's' : ''}. They are on your dashboard now.` }); toast(`Saved ${ok} task${ok > 1 ? 's' : ''}`, 'ok'); }
      });
      draw(); if (ok) changed();
    }
    if (name === 'apply-plan') {
      let ok = 0;
      await busy(el, async () => { for (const p of m.proposal) { try { await patch('tasks', p.taskId, { scheduledStart: new Date(p.start).toISOString(), scheduledEnd: new Date(p.end).toISOString() }); ok++; } catch (e) { toast(msg(e), 'err'); } } });
      m.done = true; log.push({ role: 'bot', text: `Done — ${ok} task${ok === 1 ? '' : 's'} added to your calendar. You can still move them there.` }); draw(); changed();
    }
  },
};
