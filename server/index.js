require('./env');
const path = require('path'), express = require('express'), cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { db, save, id, col, secret } = require('./db');
const { S, clean, cleanPrefs, bad } = require('./validate');
const { notify, prefsOf } = require('./notify');
const mailer = require('./mailer');
const T = require('./templates');
const chat = require('./chat');
const scheduler = require('./scheduler');
const TZ = require('../shared/tz');
const P = require('../shared/priority');

const PORT = +(process.env.PORT || 3000);
let _S; const SECRET = () => (_S ||= secret());
const ALLOWED = (process.env.ALLOWED_EMAIL_DOMAINS || 'gmail.com,googlemail.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const COOKIE = 'ast_token';
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);   // set when running behind Caddy/nginx/Cloud Run
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  // CSRF defence in depth: browsers send Origin on cross-site writes.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin request blocked' }); } catch (e) { return res.status(403).json({ error: 'Bad origin' }); }
  }
  next();
});

// ---------- static ----------
const ROOT = path.join(__dirname, '..');
app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules', 'three')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

// ---------- auth ----------
const fails = new Map();
function throttle(key) { const f = fails.get(key); if (f && f.n >= 8 && Date.now() - f.t < 15 * 60000) { const e = new Error('Too many attempts. Try again in a few minutes.'); e.status = 429; throw e; } }
function fail(key) { const f = fails.get(key); fails.set(key, { n: (f && Date.now() - f.t < 15 * 60000 ? f.n : 0) + 1, t: Date.now() }); }
const DUMMY = bcrypt.hashSync('not-a-real-password', 10);
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, prefs: prefsOf(u), createdAt: u.createdAt });

function setSession(req, res, uid, remember) {
  const days = remember ? 30 : 1;
  const token = jwt.sign({ uid }, SECRET(), { expiresIn: `${days}d` });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure || process.env.NODE_ENV === 'production', maxAge: remember ? days * 864e5 : undefined, path: '/' });
}
function auth(req, res, next) {
  try {
    const p = jwt.verify(req.cookies[COOKIE] || '', SECRET());
    const u = db.users[p.uid]; if (!u) throw 0;
    req.user = u; next();
  } catch (e) { res.status(401).json({ error: 'Please sign in' }); }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post('/api/register', wrap(async (req, res) => {
  const { email, password, name, remember, timeZone } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]{3,64}@[a-z0-9.-]+\.[a-z]{2,}$/.test(em)) bad('Enter a valid email address');
  const domain = em.split('@')[1];
  if (ALLOWED.length && !ALLOWED.includes(domain)) bad(`Please use your Gmail address (${ALLOWED.map((d) => '@' + d).join(', ')})`);
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) bad('Password must be 8–128 characters');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) bad('Password needs at least one letter and one number');
  throttle('reg:' + req.ip);
  if (Object.values(db.users).some((u) => u.email === em)) { fail('reg:' + req.ip); const e = new Error('An account with this email already exists. Try signing in.'); e.status = 409; throw e; }
  const u = { id: id(), email: em, name: String(name || '').trim().slice(0, 60) || em.split('@')[0], passHash: await bcrypt.hash(password, 11), createdAt: new Date().toISOString(), prefs: {} };
  if (timeZone && TZ.isValid(timeZone)) u.prefs.timeZone = timeZone;
  db.users[u.id] = u; save();
  setSession(req, res, u.id, !!remember);
  notify(u, { kind: 'system', title: 'Welcome to Astreoid', body: `Notifications will be sent to ${u.email}.`, mail: T.welcome(u), force: true }).catch(() => {});
  res.status(201).json({ user: publicUser(u) });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { email, password, remember } = req.body || {};
  const em = String(email || '').trim().toLowerCase(), key = 'login:' + req.ip + ':' + em;
  throttle(key);
  const u = Object.values(db.users).find((x) => x.email === em);
  const ok = await bcrypt.compare(String(password || ''), u ? u.passHash : DUMMY);
  if (!u || !ok) { fail(key); const e = new Error('Incorrect email or password'); e.status = 401; throw e; }
  fails.delete(key);
  setSession(req, res, u.id, !!remember);
  res.json({ user: publicUser(u) });
}));
app.post('/api/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });
app.get('/healthz', (req, res) => res.type('text').send('ok'));
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user), mail: { mode: mailer.mode } }));

app.put('/api/prefs', auth, (req, res) => {
  const p = cleanPrefs(req.body);
  if (p.displayName !== undefined) { req.user.name = p.displayName || req.user.email.split('@')[0]; delete p.displayName; }
  req.user.prefs = { ...(req.user.prefs || {}) };
  for (const [k, v] of Object.entries(p)) { if (v === null) delete req.user.prefs[k]; else req.user.prefs[k] = v; }
  save(); res.json({ user: publicUser(req.user) });
});
app.post('/api/password', auth, wrap(async (req, res) => {
  const { current, next } = req.body || {};
  if (!(await bcrypt.compare(String(current || ''), req.user.passHash))) bad('Current password is incorrect');
  if (typeof next !== 'string' || next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) bad('New password needs 8+ characters with a letter and a number');
  req.user.passHash = await bcrypt.hash(next, 11); save(); res.json({ ok: true });
}));
app.delete('/api/account', auth, wrap(async (req, res) => {
  if (!(await bcrypt.compare(String(req.body?.password || ''), req.user.passHash))) bad('Password is incorrect');
  delete db.users[req.user.id]; delete db.data[req.user.id]; save(); res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true });
}));

// ---------- notifications / email ----------
app.get('/api/notifications', auth, (req, res) => res.json({ items: col(req.user.id, 'notifications') }));
app.post('/api/notifications/read', auth, (req, res) => { col(req.user.id, 'notifications').forEach((n) => (n.read = true)); save(); res.json({ ok: true }); });
app.post('/api/notifications/test', auth, wrap(async (req, res) => {
  const n = await notify(req.user, { kind: 'system', title: 'Test notification', body: `Sent to ${req.user.email}`, mail: T.test(req.user), force: true });
  res.json({ notification: n, mode: mailer.mode });
}));
app.get('/api/outbox', auth, (req, res) => res.json({ mode: mailer.mode, items: mailer.mode === 'preview' ? mailer.outboxFor(req.user.email) : [] }));

// ---------- generic per-user collections ----------
function syncReminder(uid, task) {
  const rs = col(uid, 'reminders'), cur = rs.filter((r) => r.taskId === task.id && r.status === 'scheduled');
  const want = task.remindAt && !['completed', 'cancelled'].includes(task.status);
  if (!want) { cur.forEach((r) => (r.status = 'cancelled')); return; }
  if (cur.length) { cur[0].scheduledAt = task.remindAt; cur.slice(1).forEach((r) => (r.status = 'cancelled')); }
  else if (!rs.some((r) => r.taskId === task.id && r.scheduledAt === task.remindAt && r.status !== 'cancelled'))
    rs.push({ id: id(), ownerId: uid, taskId: task.id, scheduledAt: task.remindAt, status: 'scheduled', attempts: 0, createdAt: new Date().toISOString() });
}
function applyTask(uid, task, changes, prev) {
  if (changes.status === 'completed' && prev?.status !== 'completed') task.completedAt = new Date().toISOString();
  if (changes.status && changes.status !== 'completed') delete task.completedAt;
  if ('dueAt' in changes && changes.dueAt !== prev?.dueAt) { delete task.alertedDue; delete task.alertedOverdue; }
  if (task.scheduledStart && task.scheduledEnd && Date.parse(task.scheduledEnd) <= Date.parse(task.scheduledStart)) bad('Scheduled end must be after the start');
  if (task.dependsOn?.includes(task.id)) bad('A task cannot depend on itself');
  if (changes.remindAt && changes.remindAt !== prev?.remindAt && Date.parse(changes.remindAt) < Date.now() - 60000) bad('Reminder time must be in the future');
  syncReminder(uid, task);
}
function assign(obj, changes) { for (const [k, v] of Object.entries(changes)) { if (v === null) delete obj[k]; else obj[k] = v; } }

for (const name of Object.keys(S)) {
  app.get(`/api/${name}`, auth, (req, res) => res.json({ items: col(req.user.id, name) }));
  app.post(`/api/${name}`, auth, (req, res) => {
    const uid = req.user.id, changes = clean(name, req.body, { partial: false }), list = col(uid, name), now = new Date().toISOString();
    if (name === 'reviews') { const ex = list.find((r) => r.date === changes.date); if (ex) { assign(ex, changes); ex.updatedAt = now; save(); return res.json({ item: ex }); } }
    if (list.length >= 5000) bad('Storage limit reached for this list');
    const item = { id: id(), ownerId: uid, createdAt: now, updatedAt: now };
    assign(item, changes);
    if (name === 'tasks') applyTask(uid, item, changes, null);
    list.push(item); save(); res.status(201).json({ item });
  });
  app.patch(`/api/${name}/:id`, auth, (req, res) => {
    const uid = req.user.id, item = col(uid, name).find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const changes = clean(name, req.body, { partial: true }), prev = { ...item };
    assign(item, changes); item.updatedAt = new Date().toISOString();
    if (name === 'tasks') { try { applyTask(uid, item, changes, prev); } catch (e) { for (const k of Object.keys(item)) delete item[k]; Object.assign(item, prev); throw e; } }
    save(); res.json({ item });
  });
  app.delete(`/api/${name}/:id`, auth, (req, res) => {
    const uid = req.user.id, list = col(uid, name), i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    list.splice(i, 1);
    if (name === 'tasks') {
      col(uid, 'reminders').forEach((r) => { if (r.taskId === req.params.id && r.status === 'scheduled') r.status = 'cancelled'; });
      col(uid, 'tasks').forEach((t) => { if (t.dependsOn?.includes(req.params.id)) t.dependsOn = t.dependsOn.filter((d) => d !== req.params.id); });
    }
    save(); res.json({ ok: true });
  });
}
app.get('/api/reminders', auth, (req, res) => res.json({ items: col(req.user.id, 'reminders') }));

// ---------- chat ----------
app.post('/api/chat', auth, (req, res) => {
  const u = req.user, p = prefsOf(u), now = Date.now();
  const out = chat.handle(req.body?.message, { now, tz: p.timeZone, today: TZ.dayKey(now, p.timeZone), prefs: p, tasks: col(u.id, 'tasks'), events: col(u.id, 'events'), subjects: col(u.id, 'subjects') });
  res.json(out);
});

// ---------- daily review email ----------
app.post('/api/reviews/:date/email', auth, wrap(async (req, res) => {
  const u = req.user, r = col(u.id, 'reviews').find((x) => x.date === req.params.date);
  if (!r) bad('Save the review first');
  const tasks = col(u.id, 'tasks');
  const done = tasks.filter((t) => (r.completedTaskIds || []).includes(t.id)), left = tasks.filter((t) => (r.unfinishedTaskIds || []).includes(t.id));
  const n = await notify(u, { kind: 'review', title: `Daily review ${r.date} emailed`, body: `${done.length} completed, ${left.length} unfinished`, mail: T.review(u, r, done, left), force: true });
  res.json({ notification: n, mode: mailer.mode });
}));

// ---------- errors ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? (err.message?.includes('Invalid login') || err.code === 'EAUTH' ? 'Email provider rejected the SMTP login — check SMTP_USER / SMTP_PASS' : 'Something went wrong') : err.message });
});

if (require.main === module) {
  require('./db').init().then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Astreoid running → http://localhost:${PORT}`);
      console.log(`  Email delivery: ${mailer.mode === 'smtp' ? (process.env.BREVO_API_KEY ? 'Brevo API' : 'SMTP (' + (process.env.SMTP_HOST || 'smtp.gmail.com') + ')') : 'PREVIEW MODE — set BREVO_API_KEY or SMTP_USER / SMTP_PASS to send real email'}`);
      console.log(`  Storage: ${process.env.DATABASE_URL ? 'Postgres' : 'local file'}\n`);
    });
    scheduler.start(+(process.env.SCHEDULER_MS || 15000));
  }).catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
}
module.exports = { app, scheduler };
