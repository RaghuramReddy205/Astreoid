/* Astreoid core logic — pure functions (no DOM), unit-testable in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AstreoidCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATS = ['academics', 'coding', 'project', 'personal', 'habit'];
  const PRIOS = ['low', 'medium', 'high'];
  const STATUSES = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'];
  const REMIND = [0, 5, 15, 30, 60, 180, 1440];
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_RE = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
  const OPTIONAL = ['description', 'dueAt', 'dueHasTime', 'estimatedMinutes', 'scheduledStart', 'scheduledEnd', 'subject', 'dependsOn', 'remindBefore'];

  /* ---------- date helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseLocalDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const toMin = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  function isoOffset(d) {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const a = Math.abs(off);
    return `${todayStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
  }
  function validDate(v) { if (!v) return false; const d = new Date(v); return !isNaN(d.getTime()); }
  function toLocalInput(iso) {
    if (!validDate(iso)) return '';
    const d = new Date(iso);
    return `${todayStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromLocalInput(v) {
    if (!v) return undefined;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : isoOffset(d);
  }

  /* ---------- natural-language parsing ---------- */
  function parseDate(low, now = new Date()) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const add = n => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
    const mk = (y, mo, d, hasY) => {
      if (d < 1 || d > 31 || mo < 0 || mo > 11) return null;
      let dt = new Date(y, mo, d);
      if (dt.getMonth() !== mo) return null;
      if (!hasY && dt < base) dt = new Date(y + 1, mo, d);
      return dt;
    };
    let m;
    if ((m = low.match(/\bday after tomorrow\b/))) return { date: add(2), matched: m[0] };
    if ((m = low.match(/\btomorrow\b/))) return { date: add(1), matched: m[0] };
    if ((m = low.match(/\b(?:today|tonight)\b/))) return { date: add(0), matched: m[0] };
    if ((m = low.match(/\bin (\d{1,3}) days?\b/))) return { date: add(+m[1]), matched: m[0] };
    if ((m = low.match(/\bnext week\b/))) return { date: add(7), matched: m[0] };
    if ((m = low.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) {
      const dt = mk(+m[1], +m[2] - 1, +m[3], true);
      if (dt) return { date: dt, matched: m[0] };
    }
    const re1 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`);
    if ((m = low.match(re1))) {
      const dt = mk(m[3] ? +m[3] : base.getFullYear(), MONTHS.indexOf(m[2].slice(0, 3)), +m[1], !!m[3]);
      if (dt) return { date: dt, matched: m[0] };
    }
    const re2 = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`);
    if ((m = low.match(re2))) {
      const dt = mk(m[3] ? +m[3] : base.getFullYear(), MONTHS.indexOf(m[1].slice(0, 3)), +m[2], !!m[3]);
      if (dt) return { date: dt, matched: m[0] };
    }
    if ((m = low.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      let y = m[3] ? +m[3] : base.getFullYear();
      if (y < 100) y += 2000;
      const dt = mk(y, +m[2] - 1, +m[1], !!m[3]);
      if (dt) return { date: dt, matched: m[0] };
    }
    if ((m = low.match(/\b(?:on |by |this |next |coming )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
      let diff = (DAYS.indexOf(m[1]) - base.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return { date: add(diff), matched: m[0] };
    }
    return {};
  }

  function parseTime(low) {
    let m;
    if ((m = low.match(/\b(?:at |by |before |till |until |around )?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?!\w)/))) {
      const hh = +m[1];
      if (hh >= 1 && hh <= 12) {
        let h = hh % 12;
        if (/^p/.test(m[3])) h += 12;
        return { h, m: +(m[2] || 0), matched: m[0] };
      }
    }
    if ((m = low.match(/\b(?:at |by |before )(\d{1,2}):(\d{2})\b/))) {
      if (+m[1] < 24 && +m[2] < 60) return { h: +m[1], m: +m[2], matched: m[0] };
    }
    if ((m = low.match(/\b(?:at |by |before )?noon\b/))) return { h: 12, m: 0, matched: m[0] };
    if ((m = low.match(/\b(?:at |by |before )?midnight\b/))) return { h: 23, m: 59, matched: m[0] };
    return {};
  }

  function parseDuration(low) {
    let m;
    if ((m = low.match(/\b(?:for |about |around )?(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/))) {
      const n = parseFloat(m[1]);
      return { min: Math.max(1, Math.round(/^h/.test(m[2]) ? n * 60 : n)), matched: m[0] };
    }
    if ((m = low.match(/\b(?:for )?half an hour\b/))) return { min: 30, matched: m[0] };
    if ((m = low.match(/\b(?:for )?(?:an|one) hour\b/))) return { min: 60, matched: m[0] };
    return {};
  }

  const VERBS = 'submit|finish|practi[sc]e|study|revise|complete|write|read|prepare|call|buy|attend|solve|fix|build|learn|review|go|start|send|meet|work|implement|debug|push|upload|clean|exercise|run|watch|plan|finalize|email|pay|book';
  const TASK_RE = new RegExp(`\\b(need to|have to|must|should|remind me|todo|${VERBS}|assignment|exam|homework|deadline)\\b`);

  function splitClauses(text) {
    const s = String(text).replace(/[ \t]+/g, ' ').trim();
    const re = new RegExp(`\\s*(?:;|\\n|\\s+then\\s+|,?\\s+and\\s+(?=(?:(?:i\\s+)?(?:need|have|must|should|want)\\s+to\\s+)?(?:${VERBS})\\b)|\\.\\s+(?=[A-Z]))\\s*`, 'i');
    return s.split(re).map(x => x.replace(/[.\s]+$/, '').trim()).filter(Boolean);
  }

  function detectCategory(low) {
    if (/\b(assignment|exam|test|quiz|revise|revision|study|lecture|syllabus|homework|chapter|notes|class|viva|semester|physics|chemistry|maths?|biology|submit)\b/.test(low) &&
      !/\b(project|milestone)\b/.test(low)) return 'academics';
    if (/\b(project|milestone|prototype|deploy|release|portfolio|hackathon)\b/.test(low)) return 'project';
    if (/\b(java|python|javascript|c\+\+|code|coding|dsa|leetcode|debug|algorithm|loops?|function|git|api|program|programming|sql|react)\b/.test(low)) return 'coding';
    if (/\b(gym|workout|exercise|meditat\w*|sleep|water|walk|run|habit|routine|yoga|journal)\b/.test(low)) return 'habit';
    return 'personal';
  }

  function parseClause(c, globalDate, now, subjects) {
    const low = c.toLowerCase();
    const dd = parseDate(low, now), tm = parseTime(low), du = parseDuration(low);
    if (!(dd.date || tm.matched || du.matched || TASK_RE.test(low))) return null;

    let title = c;
    [dd.matched, tm.matched, du.matched].filter(Boolean).forEach(m => {
      title = title.replace(new RegExp(escapeRe(m), 'i'), ' ');
    });
    title = title
      .replace(/\b(?:i|we)\s+(?:need|have|must|should|want|got)\s+to\b/ig, ' ')
      .replace(/\b(?:remind me to|please|need to|have to|i'?ll|i will|todo:?)\b/ig, ' ')
      .replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 3; i++) {
      title = title
        .replace(/\s+(?:by|at|on|before|for|until|till|due|in|this|next|and|then)$/i, '')
        .replace(/^(?:by|at|on|and|then|also)\s+/i, '')
        .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '');
    }
    if (!title) return null;
    title = title.charAt(0).toUpperCase() + title.slice(1);

    const date = dd.date || globalDate || null;
    const deadline = /\b(submit|due|deadline|before|by)\b/.test(low);
    let dueAt, dueHasTime = false, needsDate = false, _time = null;
    if (tm.matched) {
      _time = { h: tm.h, m: tm.m };
      if (date) { const d = new Date(date); d.setHours(tm.h, tm.m, 0, 0); dueAt = isoOffset(d); dueHasTime = true; }
      else needsDate = true;
    } else if (date) {
      const d = new Date(date); d.setHours(23, 59, 0, 0); dueAt = isoOffset(d);
    }

    let priority = 'medium';
    if (/\b(urgent|asap|important|critical|high priority|immediately)\b/.test(low)) priority = 'high';
    else if (/\b(low priority|whenever|optional|someday|if time)\b/.test(low)) priority = 'low';
    else if (dueAt && deadline && (new Date(dueAt) - now) / 3.6e6 <= 48) priority = 'high';

    const category = detectCategory(low);
    let subject;
    const known = (subjects || []).find(s => s && low.includes(String(s).toLowerCase()));
    if (known) subject = known;
    else if (category === 'academics') {
      const ac = c.match(/\b[A-Z]{2,5}\b/g);
      if (ac) subject = ac.find(a => !['AM', 'PM'].includes(a));
    }

    return {
      title, category, priority, status: 'pending', dueAt, dueHasTime,
      estimatedMinutes: du.min, subject,
      remindBefore: dueAt && dueHasTime ? 60 : undefined,
      _needsDate: needsDate, _time, _inherited: !dd.date && !!globalDate,
    };
  }

  function parseMessage(text, now = new Date(), subjects = []) {
    const gd = parseDate(String(text).toLowerCase(), now);
    return splitClauses(text).map(c => parseClause(c, gd.date || null, now, subjects)).filter(Boolean);
  }

  /** Apply a date to a draft that was waiting for clarification. */
  function applyDate(draft, date) {
    const d = new Date(date);
    if (draft._time) d.setHours(draft._time.h, draft._time.m, 0, 0); else d.setHours(23, 59, 0, 0);
    draft.dueAt = isoOffset(d);
    draft.dueHasTime = !!draft._time;
    if (draft._time && draft.remindBefore == null) draft.remindBefore = 60;
    draft._needsDate = false;
    return draft;
  }

  /* ---------- validation (nothing from chat/AI bypasses this) ---------- */
  function validateTask(r, ctx = {}) {
    const errors = [], t = {};
    t.title = String(r.title || '').trim().slice(0, 120);
    if (!t.title) errors.push('Title is required');
    if (r.description) t.description = String(r.description).trim().slice(0, 500) || undefined;
    t.category = CATS.includes(r.category) ? r.category : 'personal';
    t.priority = PRIOS.includes(r.priority) ? r.priority : 'medium';
    t.status = STATUSES.includes(r.status) ? r.status : 'pending';
    if (r.dueAt) {
      if (validDate(r.dueAt)) { t.dueAt = isoOffset(new Date(r.dueAt)); t.dueHasTime = !!r.dueHasTime; }
      else errors.push('Invalid due date');
    }
    if (r.estimatedMinutes !== undefined && r.estimatedMinutes !== null && r.estimatedMinutes !== '') {
      const n = Math.round(Number(r.estimatedMinutes));
      if (n >= 1 && n <= 1440) t.estimatedMinutes = n; else errors.push('Estimate must be 1–1440 minutes');
    }
    if (r.scheduledStart) {
      if (!validDate(r.scheduledStart)) errors.push('Invalid scheduled start');
      else {
        t.scheduledStart = isoOffset(new Date(r.scheduledStart));
        const end = validDate(r.scheduledEnd) ? new Date(r.scheduledEnd) : new Date(new Date(r.scheduledStart).getTime() + (t.estimatedMinutes || 60) * 60000);
        if (end <= new Date(t.scheduledStart)) errors.push('Scheduled end must be after start');
        else t.scheduledEnd = isoOffset(end);
      }
    }
    if (r.subject) t.subject = String(r.subject).trim().slice(0, 60) || undefined;
    if (r.projectId) t.projectId = String(r.projectId);
    if (Array.isArray(r.dependsOn) && r.dependsOn.length) {
      const ids = ctx.taskIds ? r.dependsOn.filter(id => ctx.taskIds.includes(id)) : r.dependsOn;
      if (ids.length) t.dependsOn = ids;
    }
    if (r.remindBefore !== undefined && r.remindBefore !== null && r.remindBefore !== '') {
      const n = Number(r.remindBefore);
      if (REMIND.includes(n)) t.remindBefore = n; else errors.push('Invalid reminder offset');
    }
    return { ok: errors.length === 0, task: t, errors };
  }

  /* ---------- deterministic priority engine ---------- */
  const isOpen = t => ['pending', 'in_progress', 'blocked'].includes(t.status);
  const depsDone = (t, tasks) => !t.dependsOn || !t.dependsOn.length || t.dependsOn.every(id => {
    const x = tasks.find(y => y.id === id);
    return !x || x.status === 'completed' || x.status === 'cancelled';
  });
  function minutesLeftToday(now, prefs) {
    const end = toMin((prefs && prefs.dayEndsAt) || '22:00');
    return Math.max(0, end - (now.getHours() * 60 + now.getMinutes()));
  }
  function scoreTask(t, tasks, now, prefs) {
    let s = { high: 30, medium: 20, low: 10 }[t.priority] || 20;
    if (validDate(t.dueAt)) {
      const h = (new Date(t.dueAt) - now) / 3.6e6;
      if (h < 0) s += 50; else if (h <= 24) s += 35; else if (h <= 72) s += 20; else if (h <= 168) s += 8;
    }
    if (t.status === 'in_progress') s += 5;
    if (t.estimatedMinutes && t.estimatedMinutes <= minutesLeftToday(now, prefs)) s += 3;
    if (t.status === 'blocked' || !depsDone(t, tasks)) s -= 15;
    return s;
  }
  function rankTasks(tasks, now = new Date(), prefs = {}) {
    return tasks.filter(isOpen)
      .map(t => ({ t, s: scoreTask(t, tasks, now, prefs) }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.t);
  }
  function reasonFor(t, now) {
    if (validDate(t.dueAt)) {
      const h = (new Date(t.dueAt) - now) / 3.6e6;
      if (h < 0) return 'Overdue — finish this first.';
      if (h <= 24) return h < 1 ? `Due in ${Math.max(1, Math.round(h * 60))} minutes.` : `Due in about ${Math.round(h)} hours.`;
      if (h <= 72) return 'Due within 3 days.';
    }
    if (t.status === 'in_progress') return 'Already in progress — keep the momentum.';
    if (t.priority === 'high') return 'Marked high priority.';
    return 'Best fit for the time you have left today.';
  }
  /** A recommendation only — never schedules anything by itself. */
  function recommend(tasks, now = new Date(), prefs = {}) {
    const pick = rankTasks(tasks, now, prefs).find(t => t.status !== 'blocked' && depsDone(t, tasks));
    return pick ? { task: pick, reason: reasonFor(pick, now) } : null;
  }

  /* ---------- misc ---------- */
  function inQuiet(prefs, now = new Date()) {
    if (!prefs || !prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
    const m = now.getHours() * 60 + now.getMinutes(), a = toMin(prefs.quietHoursStart), b = toMin(prefs.quietHoursEnd);
    if (a === b) return false;
    return a < b ? (m >= a && m < b) : (m >= a || m < b);
  }
  function eventsOnDate(events, ds) {
    const dow = parseLocalDate(ds).getDay();
    return (events || []).filter(e => e.date === ds || (e.weekly && ds >= e.date && parseLocalDate(e.date).getDay() === dow));
  }
  function weekCounts(tasks, now = new Date()) {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const ds = todayStr(d);
      out.push({
        date: ds, label: d.toLocaleDateString([], { weekday: 'short' }),
        count: tasks.filter(t => t.status === 'completed' && t.completedAt && todayStr(new Date(t.completedAt)) === ds).length,
      });
    }
    return out;
  }
  function streak(habit, now = new Date()) {
    const log = new Set(habit.log || []);
    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!log.has(todayStr(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (log.has(todayStr(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /** Proposes time blocks in free gaps. The user must accept them. */
  function suggestPlan(tasks, events, ds, now, prefs) {
    const day = parseLocalDate(ds);
    const at = mins => { const d = new Date(day); d.setHours(0, mins, 0, 0); return d.getTime(); };
    const start = at(toMin(prefs.dayStartsAt || '07:00')), end = at(toMin(prefs.dayEndsAt || '22:00'));
    let cursor = start;
    if (ds === todayStr(now)) cursor = Math.max(start, Math.ceil(now.getTime() / 900000) * 900000);
    const busy = [];
    eventsOnDate(events, ds).forEach(e => busy.push({ s: at(toMin(e.start)), e: at(toMin(e.end)) }));
    tasks.filter(t => isOpen(t) && t.scheduledStart && t.scheduledEnd).forEach(t => {
      const s = new Date(t.scheduledStart).getTime(), e = new Date(t.scheduledEnd).getTime();
      if (todayStr(new Date(s)) === ds) busy.push({ s, e });
    });
    const cand = rankTasks(tasks, now, prefs).filter(t => !t.scheduledStart && t.status !== 'blocked' && depsDone(t, tasks)).slice(0, 6);
    const out = [];
    for (const t of cand) {
      const dur = (t.estimatedMinutes || 45) * 60000;
      let placed = false, guard = 0;
      while (guard++ < 60) {
        const s = cursor, e = s + dur;
        if (e > end) break;
        const c = busy.find(b => s < b.e && e > b.s);
        if (c) { cursor = Math.max(cursor, c.e); continue; }
        out.push({ taskId: t.id, start: isoOffset(new Date(s)), end: isoOffset(new Date(e)) });
        busy.push({ s, e });
        cursor = e + 10 * 60000;
        placed = true;
        break;
      }
      if (!placed && cursor >= end) break;
    }
    return out;
  }

  return {
    CATS, PRIOS, STATUSES, REMIND, OPTIONAL,
    pad, todayStr, parseLocalDate, toMin, isoOffset, validDate, toLocalInput, fromLocalInput,
    parseDate, parseTime, parseDuration, splitClauses, parseMessage, applyDate, validateTask,
    isOpen, depsDone, scoreTask, rankTasks, recommend, minutesLeftToday,
    inQuiet, eventsOnDate, weekCounts, streak, suggestPlan,
  };
});
