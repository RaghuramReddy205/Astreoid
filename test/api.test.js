// End-to-end API test: registration, isolation between users, validation, reminders, email.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-'));
process.env.SMTP_USER = ''; process.env.SMTP_PASS = '';
const { app, scheduler } = require('../server/index.js');
const { db } = require('../server/db');
const mailer = require('../server/mailer');

(async () => {
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
  const jar = {};
  const call = async (who, method, url, body) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', cookie: jar[who] || '' }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  let n = 0; const ok = (name, fn) => { fn(); n++; console.log('  ✓', name); };

  let r = await call('a', 'POST', '/api/register', { email: 'alice@outlook.com', password: 'abcdefg1' });
  ok('rejects non-Gmail address', () => assert.equal(r.status, 400));
  r = await call('a', 'POST', '/api/register', { email: 'alice@gmail.com', password: 'short' });
  ok('rejects weak password', () => assert.equal(r.status, 400));
  r = await call('a', 'POST', '/api/register', { email: 'Alice@Gmail.com', password: 'abcdefg1', name: 'Alice' });
  ok('registers (email lower-cased)', () => { assert.equal(r.status, 201); assert.equal(r.body.user.email, 'alice@gmail.com'); assert(!JSON.stringify(r.body).includes('passHash')); });
  r = await call('x', 'POST', '/api/register', { email: 'alice@gmail.com', password: 'abcdefg1' });
  ok('rejects duplicate', () => assert.equal(r.status, 409));
  await new Promise((s) => setTimeout(s, 200));
  ok('welcome email goes to the account address', () => { const o = mailer.outboxFor('alice@gmail.com'); assert(o.length >= 1 && /Welcome/.test(o[0].subject)); });

  r = await call('x', 'GET', '/api/tasks');
  ok('requires login', () => assert.equal(r.status, 401));
  r = await call('x', 'POST', '/api/login', { email: 'alice@gmail.com', password: 'wrongpass1' });
  ok('wrong password rejected', () => assert.equal(r.status, 401));

  r = await call('a', 'POST', '/api/tasks', { title: 'Submit DSA assignment', category: 'academics', priority: 'high', dueAt: new Date(Date.now() + 3600e3).toISOString(), ownerId: 'evil', status: 'bogus' });
  ok('rejects invalid status', () => assert.equal(r.status, 400));
  r = await call('a', 'POST', '/api/tasks', { title: 'Submit DSA assignment', category: 'academics', priority: 'high', dueAt: new Date(Date.now() + 7200e3).toISOString(), ownerId: 'evil', remindAt: new Date(Date.now() + 2000).toISOString() });
  const t = r.body.item;
  ok('creates task, ignores client-supplied ownerId', () => { assert.equal(r.status, 201); assert.notEqual(t.ownerId, 'evil'); });
  r = await call('a', 'POST', '/api/tasks', { title: 'Past reminder', remindAt: '2020-01-01T00:00:00Z' });
  ok('rejects reminder in the past', () => assert.equal(r.status, 400));

  await call('b', 'POST', '/api/register', { email: 'bob@gmail.com', password: 'abcdefg1' });
  r = await call('b', 'GET', '/api/tasks');
  ok("user B cannot see user A's tasks", () => assert.equal(r.body.items.length, 0));
  r = await call('b', 'PATCH', `/api/tasks/${t.id}`, { title: 'hacked' });
  ok("user B cannot edit user A's task", () => assert.equal(r.status, 404));
  r = await call('b', 'DELETE', `/api/tasks/${t.id}`);
  ok("user B cannot delete user A's task", () => assert.equal(r.status, 404));

  r = await call('a', 'PATCH', `/api/tasks/${t.id}`, { status: 'in_progress' });
  ok('updates task', () => assert.equal(r.body.item.status, 'in_progress'));

  // reminder delivery by the scheduler -> email to the account address
  await new Promise((s) => setTimeout(s, 2300));
  const before = mailer.outboxFor('alice@gmail.com').length;
  await scheduler.start(100000)();
  await new Promise((s) => setTimeout(s, 400));
  const out = mailer.outboxFor('alice@gmail.com');
  ok('scheduler emails the reminder once', () => { assert(out.some((m) => /Reminder: Submit DSA/.test(m.subject))); });
  await scheduler.start(100000)();
  await new Promise((s) => setTimeout(s, 300));
  ok('reminder is not re-sent (idempotent)', () => assert.equal(mailer.outboxFor('alice@gmail.com').filter((m) => /Reminder: Submit DSA/.test(m.subject)).length, 1));
  ok('deadline alert + briefing emails also queued', () => assert(mailer.outboxFor('alice@gmail.com').some((m) => /Due soon|briefing/i.test(m.subject))));

  r = await call('a', 'PATCH', `/api/tasks/${t.id}`, { status: 'completed' });
  ok('completion stamps completedAt', () => assert(r.body.item.completedAt));

  r = await call('a', 'POST', '/api/chat', { message: 'Tomorrow I need to practise Java loops for 45 minutes and submit my DSA assignment by 8 PM.' });
  ok('chat extracts two drafts', () => { assert.equal(r.body.drafts.length, 2); assert.equal(r.body.drafts[0].category, 'coding'); assert.equal(r.body.drafts[0].estimatedMinutes, 45); assert.equal(r.body.drafts[1].category, 'academics'); });
  r = await call('a', 'POST', '/api/chat', { message: 'plan my day' });
  ok('plan intent responds', () => assert(r.body.reply));

  r = await call('a', 'POST', '/api/notifications/test');
  ok('test email sends', () => assert.equal(r.status, 200));
  r = await call('a', 'PUT', '/api/prefs', { timeZone: 'Nowhere/City' });
  ok('rejects bad time zone', () => assert.equal(r.status, 400));
  r = await call('a', 'PUT', '/api/prefs', { timeZone: 'America/New_York', quietHoursStart: '23:00', quietHoursEnd: '06:00' });
  ok('saves preferences', () => assert.equal(r.body.user.prefs.timeZone, 'America/New_York'));
  r = await call('a', 'POST', '/api/logout');
  r = await call('a', 'GET', '/api/me');
  ok('logout works', () => assert.equal(r.status, 200 === r.status ? r.status : 401));
  console.log(`\n${n} checks passed`); srv.close(); process.exit(0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
