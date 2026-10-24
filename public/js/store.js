import { api } from './api.js';
export const S = { user: null, prefs: {}, mail: {}, tasks: [], subjects: [], projects: [], habits: [], goals: [], events: [], reminders: [], reviews: [], notifications: [] };
const COLS = ['tasks', 'subjects', 'projects', 'habits', 'goals', 'events', 'reviews', 'reminders'];
export const tz = () => S.prefs.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
export function setUser(u) { S.user = u; S.prefs = u ? u.prefs : {}; }
export async function loadAll() {
  const res = await Promise.all([...COLS.map((c) => api('GET', '/' + c)), api('GET', '/notifications')]);
  COLS.forEach((c, i) => (S[c] = res[i].items)); S.notifications = res[COLS.length].items;
}
export function reset() { for (const c of COLS) S[c] = []; S.notifications = []; S.user = null; }
async function syncReminders() { try { S.reminders = (await api('GET', '/reminders')).items; } catch (e) {} }
export async function add(col, data) {
  const { item } = await api('POST', '/' + col, data);
  const i = S[col].findIndex((x) => x.id === item.id); if (i >= 0) S[col][i] = item; else S[col].push(item);
  if (col === 'tasks') await syncReminders();
  return item;
}
export async function patch(col, id, data) {
  const { item } = await api('PATCH', `/${col}/${id}`, data);
  const i = S[col].findIndex((x) => x.id === id); if (i >= 0) S[col][i] = item;
  if (col === 'tasks') await syncReminders();
  return item;
}
export async function remove(col, id) {
  await api('DELETE', `/${col}/${id}`); S[col] = S[col].filter((x) => x.id !== id);
  if (col === 'tasks') { S.tasks.forEach((t) => { if (t.dependsOn) t.dependsOn = t.dependsOn.filter((d) => d !== id); }); await syncReminders(); }
}
export const byId = (col, id) => S[col].find((x) => x.id === id);
