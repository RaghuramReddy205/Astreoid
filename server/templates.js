const APP = () => process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (iso, tz) => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

function shell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#070a18;font-family:Segoe UI,Arial,sans-serif;color:#e8ecff">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0e1430;border:1px solid #232c57;border-radius:16px;overflow:hidden">
<tr><td style="padding:22px 28px;background:linear-gradient(135deg,#3b2fa8,#0f766e)"><span style="font-size:22px;font-weight:700;letter-spacing:.5px">&#9788; Astreoid</span></td></tr>
<tr><td style="padding:28px"><h2 style="margin:0 0 14px;font-size:20px">${esc(title)}</h2>${bodyHtml}
<p style="margin:26px 0 0"><a href="${esc(APP())}" style="background:#fb7185;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Open Astreoid</a></p></td></tr>
<tr><td style="padding:14px 28px;font-size:12px;color:#8a96bf;border-top:1px solid #232c57">You get this because notifications are on for your account. Change this any time in Settings &rarr; Notifications.</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (t) => `<p style="margin:0 0 12px;line-height:1.55;color:#c9d2f5">${t}</p>`;
const row = (t) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #232c57"><b>${esc(t.title)}</b><br><span style="color:#8a96bf;font-size:13px">${esc(t.meta || '')}</span></td></tr>`;
const table = (rows) => `<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f26;border-radius:10px;margin:8px 0">${rows.join('')}</table>`;

module.exports = {
  welcome: (u) => ({ subject: 'Welcome to Astreoid', html: shell(`Welcome aboard, ${u.name}!`, p('Your account is ready. Reminders, deadline alerts and your daily briefing will arrive at <b>' + esc(u.email) + '</b>.') + p('Tip: open <b>Settings</b> to choose your time zone and quiet hours, and press <b>Send test email</b> to confirm delivery.')), text: `Welcome to Astreoid, ${u.name}! Notifications will be sent to ${u.email}.` }),
  test: (u) => ({ subject: 'Astreoid test notification', html: shell('Test notification', p('If you can read this, email notifications are working for <b>' + esc(u.email) + '</b>.')), text: 'Astreoid test notification: email delivery works.' }),
  reminder: (u, t, tz) => ({ subject: `Reminder: ${t.title}`, html: shell('Reminder', p(`<b>${esc(t.title)}</b>`) + (t.dueAt ? p('Due: ' + esc(when(t.dueAt, tz))) : '') + (t.estimatedMinutes ? p(`Estimated: ${t.estimatedMinutes} minutes`) : '') + (t.description ? p(esc(t.description)) : '')), text: `Reminder: ${t.title}${t.dueAt ? ' (due ' + when(t.dueAt, tz) + ')' : ''}` }),
  deadline: (u, t, tz, overdue) => ({ subject: `${overdue ? 'Overdue' : 'Due soon'}: ${t.title}`, html: shell(overdue ? 'This task is overdue' : 'Deadline coming up', p(`<b>${esc(t.title)}</b> ${overdue ? 'was due' : 'is due'} ${esc(when(t.dueAt, tz))}.`) + p(overdue ? 'Reschedule it or mark it complete in Astreoid.' : 'You have less than an hour left.')), text: `${overdue ? 'Overdue' : 'Due soon'}: ${t.title} (${when(t.dueAt, tz)})` }),
  briefing: (u, items, dueToday, tz) => ({ subject: `Your Astreoid briefing — ${new Date().toLocaleDateString('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' })}`, html: shell(`Good morning, ${u.name}`, p(`You have <b>${items.length}</b> open task(s) and <b>${dueToday}</b> due today. Your top priorities:`) + (items.length ? table(items.slice(0, 5).map((r) => row({ title: r.task.title, meta: r.reasons.join(' · ') || 'On your list' }))) : p('Nothing pending — enjoy the free time.'))), text: `Open: ${items.length}, due today: ${dueToday}.\n` + items.slice(0, 5).map((r) => '- ' + r.task.title).join('\n') }),
  review: (u, r, done, left) => ({ subject: `Daily review — ${r.date}`, html: shell(`Daily review for ${r.date}`, p(`Completed: <b>${done.length}</b> · Unfinished: <b>${left.length}</b>`) + (done.length ? table(done.map((t) => row({ title: t.title, meta: 'Completed' }))) : '') + (r.wins?.length ? p('<b>Wins</b><br>' + r.wins.map(esc).join('<br>')) : '') + (r.blockers?.length ? p('<b>Blockers</b><br>' + r.blockers.map(esc).join('<br>')) : '') + (r.notes ? p(esc(r.notes)) : '')), text: `Daily review ${r.date}: ${done.length} completed, ${left.length} unfinished.` }),
};
