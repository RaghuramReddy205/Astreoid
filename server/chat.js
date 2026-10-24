// Rule-based chat assistant (no AI API needed for the first version). It turns natural
// language into task *drafts* — nothing is saved until the user confirms the preview —
// and answers "what next / plan my day / what's due". The output shape is what a later
// LLM backend would also have to return, and the server validates it either way.
const TZ = require('../shared/tz');
const P = require('../shared/priority');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
const VERBS = 'need|have|must|should|want|submit|finish|complete|revise|study|practi[cs]e|write|read|prepare|call|buy|send|do|fix|build|attend|remind|review|solve|learn|implement|work|meet|pay|clean|exercise|workout|run|push|deploy|upload|email|book|plan|watch|go|take|make|start|update|create|complete';

const ACADEMIC = /\b(assignment|exam|quiz|lecture|class|syllabus|revise|revision|study|homework|lab|record|viva|semester|internal|notes|textbook|chapter|unit|tutorial)\b/i;
const CODING = /\b(code|coding|java|python|javascript|typescript|react|node|c\+\+|leetcode|dsa|debug|algorithm|program(?:ming)?|git|github|sql|html|css|loops?|arrays?|recursion|api|compile|bug)\b/i;
const PROJECT = /\b(project|milestone|prototype|demo|deploy|deployment|capstone|feature|release|sprint)\b/i;
const HABIT = /\b(workout|exercise|gym|run|jog|walk|meditat\w*|sleep|water|stretch|yoga|journal|habit|routine|read(?:ing)?)\b/i;
const SUBJECTS = { dsa: 'DSA', dbms: 'DBMS', os: 'OS', cn: 'CN', mathematics: 'Maths', maths: 'Maths', physics: 'Physics', chemistry: 'Chemistry', english: 'English', java: 'Java', python: 'Python' };
delete SUBJECTS['maths?'];

function norm(t) { return t.replace(/\b([ap])\.m\./gi, '$1m').replace(/\s+/g, ' ').trim(); }

function splitClauses(t) {
  const re = new RegExp(`(?:[;!?\\n]+|\\.(?:\\s+|$)|,?\\s+(?:and then|then|also|plus)\\s+|,?\\s+and\\s+(?=(?:i\\s+|then\\s+)?(?:${VERBS})\\b))`, 'i');
  return t.split(re).map((x) => x.trim()).filter((x) => x.length > 2);
}

function cut(s, re) { const m = re.exec(s); if (!m) return [null, s]; return [m, (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ')]; }

function parseDate(s, today) {
  let m, rest;
  const mk = (key, text) => ({ key, text });
  if ((m = /\bday after tomorrow\b/i.exec(s))) return [mk(TZ.addDays(today, 2)), s.replace(m[0], ' ')];
  if ((m = /\b(tomorrow|tmrw|tmr)\b/i.exec(s))) return [mk(TZ.addDays(today, 1)), s.replace(m[0], ' ')];
  if ((m = /\b(today|tonight|this evening|this morning|this afternoon)\b/i.exec(s))) return [mk(today, m[1], m[1].toLowerCase()), s.replace(m[0], ' ')];
  if ((m = /\bin (\d+) (day|days|week|weeks)\b/i.exec(s))) return [mk(TZ.addDays(today, +m[1] * (/week/i.test(m[2]) ? 7 : 1))), s.replace(m[0], ' ')];
  if ((m = /\bnext week\b/i.exec(s))) return [mk(TZ.addDays(today, 7)), s.replace(m[0], ' ')];
  if ((m = /\bthis weekend\b/i.exec(s))) { const wd = TZ.weekday(today); return [mk(TZ.addDays(today, wd === 0 ? 0 : (6 - wd + 7) % 7)), s.replace(m[0], ' ')]; }
  if ((m = new RegExp(`\\b(?:(next|this|on)\\s+)?${DAY_RE}\\b`, 'i').exec(s))) {
    const target = DAYS[m[2].slice(0, 3).toLowerCase()]; let diff = (target - TZ.weekday(today) + 7) % 7;
    if (diff === 0) diff = 7;
    return [mk(TZ.addDays(today, diff)), s.replace(m[0], ' ')];
  }
  const year = +today.slice(0, 4);
  const fix = (mo, d, y) => { let k = `${y || year}-${TZ.pad(mo)}-${TZ.pad(d)}`; if (!y && k < today) k = `${year + 1}-${TZ.pad(mo)}-${TZ.pad(d)}`; return k; };
  if ((m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RE}\\b(?:,?\\s+(\\d{4}))?`, 'i').exec(s)) && +m[1] <= 31) return [mk(fix(MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1], m[3] && +m[3])), s.replace(m[0], ' ')];
  if ((m = new RegExp(`\\b${MON_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'i').exec(s)) && +m[2] <= 31) return [mk(fix(MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2], m[3] && +m[3])), s.replace(m[0], ' ')];
  if ((m = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/.exec(s)) && +m[1] <= 31 && +m[2] <= 12) {
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null;
    return [mk(fix(+m[2], +m[1], y)), s.replace(m[0], ' ')];   // dd/mm (Indian convention)
  }
  return [null, s];
}

function parseTime(s) {
  let m;
  if ((m = /\b(?:(at|by|before|until|till|from|around|@)\s*)?(noon|midnight)\b/i.exec(s))) return [{ h: /noon/i.test(m[2]) ? 12 : 0, mi: 0, prep: (m[1] || '').toLowerCase() }, s.replace(m[0], ' ')];
  if ((m = /\b(?:(at|by|before|until|till|from|around|@)\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(s)) && +m[2] >= 1 && +m[2] <= 12) {
    let h = +m[2] % 12; if (/pm/i.test(m[4])) h += 12;
    return [{ h, mi: +(m[3] || 0), prep: (m[1] || '').toLowerCase() }, s.replace(m[0], ' ')];
  }
  if ((m = /\b(?:(at|by|before|until|till|from|around|@)\s*)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s))) return [{ h: +m[2], mi: +m[3], prep: (m[1] || '').toLowerCase() }, s.replace(m[0], ' ')];
  if ((m = /\b(at|by|before|until|till|@)\s*(\d{1,2})\b(?!\s*(?:min|hour|hr|day|week|%))/i.exec(s)) && +m[2] >= 1 && +m[2] <= 12) {
    const n = +m[2], h = n === 12 ? 12 : n <= 6 ? n + 12 : n;           // 1-6 → PM, 7-11 → AM, 12 → noon
    return [{ h, mi: 0, prep: m[1].toLowerCase(), assumed: true }, s.replace(m[0], ' ')];
  }
  return [null, s];
}

function parsePart(s) {
  const parts = { morning: 9, afternoon: 15, evening: 18, night: 21 };
  const m = /\b(?:(by|before|at|in the|this)\s+)?(morning|afternoon|evening|night)\b/i.exec(s);
  if (!m) return [null, s];
  return [{ h: parts[m[2].toLowerCase()], mi: 0, prep: (m[1] || '').toLowerCase(), part: true }, s.replace(m[0], ' ')];
}

function fmtTime(h, mi) { const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${TZ.pad(mi)} ${ap}`; }

function parseClause(raw, ctx) {
  let s = ' ' + raw + ' ', assumptions = [];
  const d = { assumptions };
  // priority
  if (/\b(urgent|asap|important|high priority|critical|top priority)\b/i.test(s)) { d.priority = 'high'; s = s.replace(/\b(urgent|asap|important|high priority|critical|top priority)\b/ig, ' '); }
  else if (/\b(low priority|whenever|someday|if i have time)\b/i.test(s)) { d.priority = 'low'; s = s.replace(/\b(low priority|whenever|someday|if i have time)\b/ig, ' '); }
  else d.priority = 'medium';
  // duration
  let m;
  if ((m = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i.exec(s)) && /\bfor\b/i.test(m[0]) || (m = /\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i.exec(s))) { d.estimatedMinutes = Math.round(+m[1] * 60); s = s.replace(m[0], ' '); }
  else if ((m = /\b(?:for\s+)?(\d+)\s*(minutes?|mins?|m)\b/i.exec(s))) { d.estimatedMinutes = +m[1]; s = s.replace(m[0], ' '); }
  else if ((m = /\bhalf an hour\b/i.exec(s))) { d.estimatedMinutes = 30; s = s.replace(m[0], ' '); }
  if (d.estimatedMinutes > 1440) d.estimatedMinutes = 1440;
  // reminder
  let remind = null;
  if ((m = /\bremind me\s*(?:(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\s*before)?\s*(?:to\b)?/i.exec(s))) {
    remind = m[1] ? +m[1] * (/day/i.test(m[2]) ? 1440 : /h/i.test(m[2]) ? 60 : 1) : 30; s = s.replace(m[0], ' ');
  }
  const deadlineWord = /\b(due|deadline|submit|submission|hand in|turn in|before)\b/i.test(s);
  // date & time
  let dt; [dt, s] = parseDate(s, ctx.today);
  let tm; [tm, s] = parseTime(s);
  if (!tm) { [tm, s] = parsePart(s); }
  let dateKey = dt?.key || null, usedCarry = false;
  if (!dateKey && ctx.carry && (tm || deadlineWord || true) && ctx.carry.key) { dateKey = ctx.carry.key; usedCarry = true; }
  const isDeadline = tm ? (['by', 'before', 'until', 'till'].includes(tm.prep) || (deadlineWord && !['at', 'from', '@'].includes(tm.prep))) : true;

  if (tm && tm.assumed) assumptions.push(`Assumed ${fmtTime(tm.h, tm.mi)} — change it if you meant a different time.`);
  if (tm && !dateKey) {
    const todayAt = TZ.at(ctx.today, `${TZ.pad(tm.h)}:${TZ.pad(tm.mi)}`, ctx.tz);
    dateKey = todayAt > ctx.now ? ctx.today : TZ.addDays(ctx.today, 1);
    assumptions.push(dateKey === ctx.today ? 'No date given — used today.' : 'That time has passed today — used tomorrow.');
  }
  if (dateKey) {
    if (tm) {
      const start = TZ.at(dateKey, `${TZ.pad(tm.h)}:${TZ.pad(tm.mi)}`, ctx.tz);
      if (isDeadline) d.dueAt = new Date(start).toISOString();
      else { d.scheduledStart = new Date(start).toISOString(); d.scheduledEnd = new Date(start + (d.estimatedMinutes || 60) * 60000).toISOString(); }
    } else {
      d.dueAt = new Date(TZ.at(dateKey, '23:59', ctx.tz)).toISOString();
      assumptions.push('No time given — due at the end of the day.');
    }
  } else if (deadlineWord) d.question = 'When is this due?';
  if (remind != null) {
    const base = d.dueAt || d.scheduledStart;
    if (base) d.remindAt = new Date(Math.max(Date.parse(base) - remind * 60000, ctx.now + 60000)).toISOString();
    else d.question = d.question || 'When should I remind you?';
  }
  // category
  const full = raw;
  d.category = ACADEMIC.test(full) ? 'academics' : PROJECT.test(full) ? 'project' : CODING.test(full) ? 'coding' : HABIT.test(full) ? 'habit' : 'personal';
  // subject
  const subj = (ctx.subjects || []).find((x) => new RegExp('\\b' + x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(full));
  if (subj) d.subject = subj.name;
  else if (d.category === 'academics') { const k = Object.keys(SUBJECTS).find((w) => new RegExp('\\b' + w + '\\b', 'i').test(full)); if (k) d.subject = SUBJECTS[k]; }
  // title
  let t = s.replace(/^\W+/, '');
  t = t.replace(/^(?:(?:so|okay|ok|please|hey|also|and|then)[, ]+)*(?:i\s+(?:need|have|want|must|should|gotta)\s+to|i'?ll|i will|i'?m going to|need to|have to|don'?t forget to|make sure (?:i|to)|i should)\s+/i, '');
  t = t.replace(/\b(?:i\s+)?(?:need|have|want)\s+to\b/ig, ' ');
  t = t.replace(/\s+(?:by|at|on|for|in|before|due|until|till|from|around|@|and|to)\s*$/i, '').replace(/^\s*(?:by|at|on|due)\s+/i, '');
  t = t.replace(/[,\s]+$/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+(?:by|at|on|for|before|due|until|till)\s*$/i, '').trim();
  if (t.length > 140) t = t.slice(0, 140);
  d.title = t ? t[0].toUpperCase() + t.slice(1) : '';
  return { draft: d, carry: dt ? { key: dt.key } : ctx.carry };
}

function summarize(tasks, ctx) {
  const open = tasks.filter((t) => P.OPEN.includes(t.status));
  const overdue = open.filter((t) => t.dueAt && Date.parse(t.dueAt) < ctx.now);
  const today = open.filter((t) => t.dueAt && TZ.dayKey(Date.parse(t.dueAt), ctx.tz) === ctx.today && Date.parse(t.dueAt) >= ctx.now);
  return { open, overdue, today };
}

function handle(message, ctx) {
  const text = norm(String(message || '').slice(0, 1500));
  if (!text) return { reply: 'Tell me what you need to do — for example “Tomorrow I need to practise Java loops for 45 minutes and submit my DSA assignment by 8 PM.”', drafts: [] };
  const low = text.toLowerCase();

  if (/^(hi|hello|hey|yo)\b|^help\b|what can you do/.test(low))
    return { reply: 'I can turn sentences into tasks (you confirm before anything is saved), recommend what to do next, and propose a plan for your day. Try “remind me to call the lab TA tomorrow at 4 pm”, “what should I do next?” or “plan my day”.', drafts: [] };

  if (/what (should|do) i (do|work on)|next task|what'?s next|what next|recommend|suggest (?:a )?task/.test(low)) {
    const top = P.rank(ctx.tasks, { now: ctx.now }).filter((r) => r.ready).slice(0, 3);
    if (!top.length) return { reply: 'You have nothing ready to work on. Add a task or enjoy the break.', drafts: [] };
    return { reply: `Here is what I would do next, in order. You decide what goes on your schedule.`, drafts: [], recommendations: top.map((r) => ({ id: r.task.id, title: r.task.title, reasons: r.reasons, estimatedMinutes: r.task.estimatedMinutes })) };
  }

  if (/plan (my )?(day|today|tomorrow)|schedule (my )?(day|today)|organi[sz]e (my )?day/.test(low)) {
    let key = ctx.today, from = ctx.now;
    const dayStart = TZ.at(key, ctx.prefs.dayStartsAt, ctx.tz), dayEnd = TZ.at(key, ctx.prefs.dayEndsAt, ctx.tz);
    if (/tomorrow/.test(low) || ctx.now >= dayEnd - 20 * 60000) { key = TZ.addDays(ctx.today, 1); from = TZ.at(key, ctx.prefs.dayStartsAt, ctx.tz); }
    else from = Math.max(ctx.now, dayStart);
    const end = TZ.at(key, ctx.prefs.dayEndsAt, ctx.tz);
    const proposal = P.suggestPlan(ctx.tasks, P.eventsOn(ctx.events, key, ctx.tz), { from, dayEnd: end });
    if (!proposal.length) return { reply: 'I could not find free time for unscheduled tasks in that day. Your day looks full — or everything is already scheduled.', drafts: [] };
    return { reply: `I suggest this plan for ${key === ctx.today ? 'today' : 'tomorrow'}, fitted around your fixed commitments. Nothing changes until you apply it.`, drafts: [], proposal };
  }

  if (/what'?s due|due (today|soon)|deadlines?|summary|how am i doing|progress|overview/.test(low)) {
    const s = summarize(ctx.tasks, ctx);
    const doneToday = ctx.tasks.filter((t) => t.completedAt && TZ.dayKey(Date.parse(t.completedAt), ctx.tz) === ctx.today).length;
    return { reply: `You have ${s.open.length} open task(s): ${s.overdue.length} overdue and ${s.today.length} due later today. You completed ${doneToday} today.` + (s.overdue.length ? ` Overdue: ${s.overdue.slice(0, 3).map((t) => t.title).join(', ')}.` : ''), drafts: [] };
  }

  const dctx = { now: ctx.now, tz: ctx.tz, today: ctx.today, subjects: ctx.subjects, carry: null };
  const drafts = [], questions = [];
  for (const clause of splitClauses(text)) {
    const rm = /^(?:and\s+)?remind me\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\s*before\W*$/i.exec(clause);
    if (rm && drafts.length) {                       // “…, remind me 30 minutes before” refers to the previous task
      const last = drafts[drafts.length - 1], base = last.dueAt || last.scheduledStart, off = +rm[1] * (/day/i.test(rm[2]) ? 1440 : /h/i.test(rm[2]) ? 60 : 1);
      if (base) { last.remindAt = new Date(Math.max(Date.parse(base) - off * 60000, ctx.now + 60000)).toISOString(); delete last.question; }
      continue;
    }
    const r = parseClause(clause, dctx); dctx.carry = r.carry;
    if (!r.draft.title || r.draft.title.length < 2 || /^(before|after|it|that|this|then|also|please)$/i.test(r.draft.title)) continue;
    if (r.draft.question) questions.push(`“${r.draft.title}”: ${r.draft.question}`);
    drafts.push(r.draft);
  }
  if (!drafts.length) return { reply: 'I could not find a task in that. Try something like “finish the DBMS record by Friday 5 pm”.', drafts: [] };
  return { reply: `I found ${drafts.length} task${drafts.length > 1 ? 's' : ''}. Check the preview, edit anything that is off, then confirm to save.` + (questions.length ? ' ' + questions.join(' ') : ''), drafts };
}
module.exports = { handle, splitClauses, parseClause };
