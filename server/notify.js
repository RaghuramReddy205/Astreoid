const { db, save, id, col } = require('./db');
const mailer = require('./mailer');

const DEFAULT_PREFS = { timeZone: 'Asia/Kolkata', dayStartsAt: '07:00', dayEndsAt: '22:00', notificationsEnabled: true, emailReminders: true, emailDeadlines: true, emailBriefing: true };
const prefsOf = (u) => ({ ...DEFAULT_PREFS, ...(u.prefs || {}) });

// Stores an in-app notification and, when allowed, emails it to the account address.
// kind: reminder | deadline | briefing | system | review ; flag: pref key that gates email.
async function notify(user, { title, body, kind = 'system', flag, mail, force = false }) {
  const n = { id: id(), kind, title, body, createdAt: new Date().toISOString(), read: false, email: 'none' };
  const p = prefsOf(user);
  const wantMail = mail && (force || (p.notificationsEnabled && (!flag || p[flag])));
  let err = null;
  if (wantMail) {
    try { const r = await mailer.send({ to: user.email, ...mail }); n.email = r.mode === 'smtp' ? 'sent' : 'preview'; }
    catch (e) { n.email = 'failed'; err = e; console.error('[mail] failed:', e.message); }
  }
  const list = col(user.id, 'notifications');
  list.unshift(n); if (list.length > 100) list.length = 100;
  save();
  if (err) throw err;
  return n;
}
module.exports = { notify, prefsOf, DEFAULT_PREFS };
