// Server-side reminder delivery. Reminders never depend on a browser tab being open,
// and each reminder is claimed ("sending") before delivery so retries cannot double-send.
const { db, save, col } = require('./db');
const { notify, prefsOf } = require('./notify');
const T = require('./templates');
const TZ = require('../shared/tz');
const P = require('../shared/priority');

function inQuiet(p, now) {
  if (!p.quietHoursStart || !p.quietHoursEnd) return false;
  const pt = TZ.parts(now, p.timeZone), m = pt.h * 60 + pt.mi;
  const a = TZ.minutes(p.quietHoursStart), b = TZ.minutes(p.quietHoursEnd);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

async function tickUser(user, now) {
  const p = prefsOf(user), tasks = col(user.id, 'tasks'), quiet = inQuiet(p, now);

  // 1. Task reminders
  for (const r of col(user.id, 'reminders')) {
    if (r.status !== 'scheduled' || Date.parse(r.scheduledAt) > now) continue;
    const task = tasks.find((t) => t.id === r.taskId);
    if (!task || ['completed', 'cancelled'].includes(task.status)) { r.status = 'cancelled'; save(); continue; }
    if (quiet) continue;                       // keep scheduled, deliver after quiet hours
    r.status = 'sending'; r.attempts = (r.attempts || 0) + 1; save();
    try {
      await notify(user, { kind: 'reminder', title: `Reminder: ${task.title}`, body: task.dueAt ? 'Due ' + new Date(task.dueAt).toLocaleString('en-IN', { timeZone: p.timeZone }) : 'Time to get started.', flag: 'emailReminders', mail: T.reminder(user, task, p.timeZone) });
      r.status = 'sent'; r.sentAt = new Date().toISOString();
    } catch (e) {
      if (r.attempts >= 3) r.status = 'failed';
      else { r.status = 'scheduled'; r.scheduledAt = new Date(now + 60000 * r.attempts).toISOString(); }
    }
    save();
  }

  // 2. Deadline alerts (due within the hour, and overdue in the last day) — once per due date
  if (!quiet) for (const t of tasks) {
    if (!P.OPEN.includes(t.status) || !t.dueAt) continue;
    const due = Date.parse(t.dueAt); if (isNaN(due)) continue;
    const soon = due > now && due - now <= 3600000, over = due <= now && now - due <= 86400000;
    if (soon && t.alertedDue !== t.dueAt) {
      t.alertedDue = t.dueAt; save();
      notify(user, { kind: 'deadline', title: `Due soon: ${t.title}`, body: 'Due within the hour.', flag: 'emailDeadlines', mail: T.deadline(user, t, p.timeZone, false) }).catch(() => {});
    } else if (over && t.alertedOverdue !== t.dueAt) {
      t.alertedOverdue = t.dueAt; save();
      notify(user, { kind: 'deadline', title: `Overdue: ${t.title}`, body: 'This task is past its deadline.', flag: 'emailDeadlines', mail: T.deadline(user, t, p.timeZone, true) }).catch(() => {});
    }
  }

  // 3. Morning briefing, once per local day, from day-start time until day-end
  if (!quiet && p.emailBriefing) {
    const key = TZ.dayKey(now, p.timeZone), pt = TZ.parts(now, p.timeZone), m = pt.h * 60 + pt.mi;
    if (user.lastBriefing !== key && m >= TZ.minutes(p.dayStartsAt) && m < TZ.minutes(p.dayEndsAt)) {
      user.lastBriefing = key; save();
      const ranked = P.rank(tasks, { now });
      const dueToday = ranked.filter((r) => r.task.dueAt && TZ.dayKey(Date.parse(r.task.dueAt), p.timeZone) === key).length;
      notify(user, { kind: 'briefing', title: 'Your morning briefing', body: `${ranked.length} open task(s), ${dueToday} due today.`, flag: 'emailBriefing', mail: T.briefing(user, ranked, dueToday, p.timeZone) }).catch(() => {});
    }
  }
}

let busy = false;
function start(intervalMs = 15000) {
  const run = async () => {
    if (busy) return; busy = true;
    try { const now = Date.now(); for (const u of Object.values(db.users)) await tickUser(u, now).catch((e) => console.error('[scheduler]', e.message)); }
    finally { busy = false; }
  };
  // A reminder claimed as "sending" before a crash is re-queued on boot.
  for (const u of Object.values(db.users)) for (const r of col(u.id, 'reminders')) if (r.status === 'sending') r.status = 'scheduled';
  setInterval(run, intervalMs).unref?.();
  setTimeout(run, 2000);
  return run;
}
module.exports = { start, tickUser, inQuiet };
