// Field validation for every collection. Unknown fields are dropped, so clients can
// never write server-owned fields (ownerId, createdAt, alert flags, ...).
const bad = (m) => { const e = new Error(m); e.status = 400; throw e; };
const str = (max) => (v, k) => { if (v == null || v === '') return null; if (typeof v !== 'string') bad(`${k} must be text`); v = v.trim(); if (v.length > max) bad(`${k} is too long (max ${max})`); return v || null; };
const enm = (list) => (v, k) => { if (!list.includes(v)) bad(`${k} must be one of: ${list.join(', ')}`); return v; };
const iso = () => (v, k) => { if (v == null || v === '') return null; const t = Date.parse(v); if (typeof v !== 'string' || isNaN(t)) bad(`${k} is not a valid date`); return new Date(t).toISOString(); };
const int = (min, max) => (v, k) => { if (v == null || v === '') return null; v = Math.round(Number(v)); if (!Number.isFinite(v) || v < min || v > max) bad(`${k} must be between ${min} and ${max}`); return v; };
const ymd = () => (v, k) => { if (v == null || v === '') return null; if (!/^\d{4}-\d\d-\d\d$/.test(v) || isNaN(Date.parse(v))) bad(`${k} must be YYYY-MM-DD`); return v; };
const hhmm = () => (v, k) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '')) bad(`${k} must be HH:MM`); return v; };
const bool = () => (v) => !!v;
const list = (max, item) => (v, k) => { if (v == null) return []; if (!Array.isArray(v) || v.length > max) bad(`${k} is invalid`); return v.map((x) => item(x, k)); };
const sid = (x, k) => { if (typeof x !== 'string' || x.length > 40) bad(`${k} has an invalid id`); return x; };
const sline = (max) => (x, k) => { if (typeof x !== 'string' || x.length > max) bad(`${k} entry is invalid`); return x.trim(); };
const obj = (shape) => (x, k) => {
  if (!x || typeof x !== 'object') bad(`${k} entry is invalid`);
  const o = {};
  for (const [f, fn] of Object.entries(shape)) { const v = x[f]; if (v !== undefined) { const r = fn(v, `${k}.${f}`); if (r !== null && r !== undefined) o[f] = r; } }
  if (!o.id) o.id = require('./db').id();
  return o;
};
const milestone = obj({ id: sid, title: str(120), done: bool(), due: ymd() });
const topic = obj({ id: sid, title: str(120), done: bool() });

const S = {
  tasks: {
    req: ['title'],
    defaults: { category: 'personal', priority: 'medium', status: 'pending' },
    f: {
      title: str(140), description: str(2000),
      category: enm(['academics', 'coding', 'project', 'personal', 'habit']),
      priority: enm(['low', 'medium', 'high']),
      status: enm(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']),
      dueAt: iso(), estimatedMinutes: int(1, 1440), scheduledStart: iso(), scheduledEnd: iso(),
      subject: str(80), projectId: str(40), dependsOn: list(10, sid), remindAt: iso(),
    },
  },
  subjects: { req: ['name'], f: { name: str(80), examDate: ymd(), topics: list(120, topic), notes: str(1000) } },
  projects: { req: ['name'], f: { name: str(80), description: str(500), milestones: list(60, milestone) } },
  habits: { req: ['title'], f: { title: str(80), log: list(800, (x, k) => ymd()(x, k)) } },
  goals: { req: ['title'], f: { title: str(120), progress: int(0, 100), due: ymd() } },
  events: { req: ['title', 'date', 'startTime', 'endTime'], defaults: { repeat: 'none' }, f: { title: str(100), date: ymd(), startTime: hhmm(), endTime: hhmm(), repeat: enm(['none', 'weekly']) } },
  reviews: { req: ['date'], f: { date: ymd(), wins: list(20, sline(200)), blockers: list(20, sline(200)), notes: str(2000), completedTaskIds: list(200, sid), unfinishedTaskIds: list(200, sid) } },
};

function clean(name, body, { partial }) {
  const spec = S[name];
  if (!body || typeof body !== 'object' || Array.isArray(body)) bad('Invalid request body');
  const out = {};
  for (const [k, fn] of Object.entries(spec.f)) {
    if (body[k] === undefined) continue;
    const v = fn(body[k], k);
    out[k] = v;                     // null means "clear this field"
  }
  if (!partial) {
    for (const r of spec.req) if (out[r] == null) bad(`${r} is required`);
    for (const [k, v] of Object.entries(spec.defaults || {})) if (out[k] === undefined) out[k] = v;
  } else {
    for (const r of spec.req) if (r in out && out[r] == null) bad(`${r} is required`);
  }
  return out;
}

const PREFS = {
  displayName: str(60), timeZone: (v) => { if (!require('../shared/tz').isValid(v)) bad('Unknown time zone'); return v; },
  dayStartsAt: hhmm(), dayEndsAt: hhmm(), quietHoursStart: (v, k) => (v ? hhmm()(v, k) : null), quietHoursEnd: (v, k) => (v ? hhmm()(v, k) : null),
  notificationsEnabled: bool(), emailReminders: bool(), emailDeadlines: bool(), emailBriefing: bool(),
};
function cleanPrefs(body) {
  if (!body || typeof body !== 'object') bad('Invalid request body');
  const out = {};
  for (const [k, fn] of Object.entries(PREFS)) if (body[k] !== undefined) { const v = fn(body[k], k); out[k] = v; }
  return out;
}
module.exports = { S, clean, cleanPrefs, bad };
