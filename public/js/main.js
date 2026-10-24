import { api } from './api.js';
import { S, setUser, loadAll, reset, tz } from './store.js';
import { esc, $, $$, ICONS, btnPrimary, checkbox, field, input, themeToggle, menu, githubTip, toast, busy, fmt } from './ui.js';
import { common, changed, msg } from './common.js';
import { createScene } from './scene.js';
import dashboard from './pages/dashboard.js';
import orbit from './pages/orbit.js';
import chat from './pages/chat.js';
import tasks from './pages/tasks.js';
import calendar from './pages/calendar.js';
import academics from './pages/academics.js';
import projects from './pages/projects.js';
import habits from './pages/habits.js';
import review from './pages/review.js';
import settings from './pages/settings.js';

const PAGES = [dashboard, orbit, chat, tasks, calendar, academics, projects, habits, review, settings];
const NAV = PAGES.map((p) => ({ id: p.id, label: p.label, title: p.title, icon: p.icon }));
const app = $('#app'), loader = $('#loader');
let scene = null, current = null, polling = null, seen = new Set(), notifOpen = false;
try { scene = createScene($('#bg')); } catch (e) { console.warn('3D disabled:', e); }
const theme = () => document.documentElement.dataset.theme;
scene?.setTheme(theme());

function applyTheme(t) {
  document.documentElement.dataset.theme = t; try { localStorage.setItem('astreoid-theme', t); } catch (e) {}
  document.querySelector('meta[name=theme-color]').content = t === 'day' ? '#5aa9f0' : '#05070f'; scene?.setTheme(t);
}
document.addEventListener('change', (e) => { if (e.target.id === 'theme-toggle') applyTheme(e.target.checked ? 'night' : 'day'); });
const hideLoader = () => loader.classList.add('off');

/* ------------------------------ auth screen ------------------------------ */
function renderAuth(tab = 'login') {
  stopPolling(); current?.unmount?.(); current = null; scene?.setMode('auth'); document.body.className = 'mode-auth';
  const reg = tab === 'register';
  app.innerHTML = `<div class="topbar"><span class="brand">${ICONS.asteroid}Astreoid</span><span class="spacer"></span>${themeToggle(theme() === 'night')}</div>
  <div class="auth-wrap pt"><div class="glass auth-card ptn">
    <h1>Astreoid</h1><p class="tag">Your day, in orbit. Plan, study and build — and get reminders in your inbox.</p>
    <div class="tabs" role="tablist"><button class="tab ${reg ? '' : 'on'}" role="tab" aria-selected="${!reg}" data-tab="login">Sign in</button><button class="tab ${reg ? 'on' : ''}" role="tab" aria-selected="${reg}" data-tab="register">Create account</button></div>
    <form id="auth" class="stack" novalidate>
      ${reg ? field('Your name', input('id="a-name" autocomplete="name" maxlength="60" placeholder="Raghuram"')) : ''}
      ${field('Gmail address', input('id="a-email" type="email" autocomplete="email" inputmode="email" placeholder="you@gmail.com" required'), reg ? 'Notifications are sent to this address.' : '')}
      ${field('Password', input(`id="a-pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 8 characters, letters + a number' : 'Your password'}" required`))}
      <div class="row wrapx">${checkbox({ id: 'a-show', label: 'Show password', size: 'small' })}${checkbox({ id: 'a-rem', label: 'Keep me signed in', size: 'small', checked: true })}</div>
      <div class="err" id="a-err" role="alert"></div>
      <div>${btnPrimary(reg ? 'Launch my account' : 'Enter orbit', 'type="submit" id="a-go"', 'text-xl', 'w-full')}</div>
    </form></div></div>
  <p class="hero-note">Drag the asteroid to spin it · scroll to zoom</p>${githubTip()}`;
  $$('.tab', app).forEach((b) => (b.onclick = () => renderAuth(b.dataset.tab)));
  $('#a-show').onchange = (e) => ($('#a-pass').type = e.target.checked ? 'text' : 'password');
  $('#auth').onsubmit = async (ev) => {
    ev.preventDefault(); const err = $('#a-err'); err.textContent = '';
    const email = $('#a-email').value.trim(), password = $('#a-pass').value;
    if (!email || !password) { err.textContent = 'Enter your email and password.'; return; }
    await busy($('#a-go'), async () => {
      try {
        const { user } = await api('POST', reg ? '/register' : '/login', { email, password, name: reg ? $('#a-name').value : undefined, remember: $('#a-rem').checked, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        await enter(user, reg);
      } catch (e) { err.textContent = msg(e); }
    });
  };
}

/* ------------------------------ shell ------------------------------ */
async function enter(user, first = false) {
  loader.classList.remove('off'); setUser(user);
  try { await loadAll(); } catch (e) { toast(msg(e), 'err'); }
  S.notifications.forEach((n) => seen.add(n.id)); renderShell(); startPolling(); hideLoader();
  if (first) toast(`A welcome email is on its way to ${user.email}.`, 'ok', `Welcome, ${user.name}!`);
  if (!location.hash.startsWith('#/')) location.hash = '#/dashboard'; else route();
}
function renderShell() {
  const unread = S.notifications.filter((n) => !n.read).length;
  app.innerHTML = `<div class="topbar"><a class="brand" href="#/dashboard">${ICONS.asteroid}Astreoid</a><span class="spacer"></span>
    <button class="icon-btn" id="bell" aria-label="Notifications" aria-expanded="false">${ICONS.bell}<span class="badge-dot ${unread ? '' : 'hidden'}" id="bell-n">${unread}</span></button>
    <div class="chip-user"><span class="avatar">${esc(S.user.name[0]?.toUpperCase() || 'A')}</span><span title="${esc(S.user.email)}">${esc(S.user.name)}</span></div>
    ${themeToggle(theme() === 'night')}
    <button class="icon-btn" id="logout" aria-label="Sign out" title="Sign out">${ICONS.logout}</button></div>
    <main id="view" class="wrap" tabindex="-1"></main><div id="menu"></div><div id="notif"></div>${githubTip()}`;
  $('#logout').onclick = logout; $('#bell').onclick = toggleNotif;
  const view = $('#view');
  view.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el && view.contains(el)) dispatch('act', el, e); });
  view.addEventListener('change', (e) => { const el = e.target.closest('[data-chg]'); if (el) dispatch('chg', el, e); });
  view.addEventListener('input', (e) => { const el = e.target.closest('[data-inp]'); if (el) dispatch('inp', el, e); });
  view.addEventListener('submit', (e) => { const f = e.target.closest('[data-submit]'); if (f) { e.preventDefault(); dispatch('submit', f, e); } });
  view.addEventListener('keydown', (e) => { const el = e.target.closest('[data-key]'); if (el && e.key === 'Enter') { e.preventDefault(); dispatch('key', el, e); } });
  view.addEventListener('dragstart', (e) => { const el = e.target.closest?.('[draggable]'); if (el) { e.dataTransfer.setData('text/plain', el.dataset.id); e.dataTransfer.effectAllowed = 'move'; } });
  const dragOver = (e) => { const s = e.target.closest?.('[data-drop]'); if (s) { e.preventDefault(); s.closest('.hour')?.classList.add('drop'); } };
  view.addEventListener('dragover', dragOver);
  view.addEventListener('dragleave', (e) => e.target.closest?.('.hour')?.classList.remove('drop'));
  view.addEventListener('drop', (e) => { const s = e.target.closest?.('[data-drop]'); $$('.hour.drop', view).forEach((h) => h.classList.remove('drop')); if (s) { e.preventDefault(); current?.drop?.(e.dataTransfer.getData('text/plain'), s, ctx()); } });
}
const ctx = () => ({ scene, rerender: () => draw(true), go: (id) => (location.hash = '#/' + id) });
async function dispatch(kind, el, e) {
  const name = el.dataset[{ act: 'act', chg: 'chg', inp: 'inp', submit: 'submit', key: 'key' }[kind]];
  try {
    if (kind === 'act' && name === 'go-review') { location.hash = '#/review'; return; }
    if ((kind === 'act' || kind === 'chg') && (await common(name, el))) return;
    await current?.[kind]?.(name, el, e, ctx());
  } catch (err) { toast(msg(err), 'err'); }
}
function route() {
  if (!S.user) return;
  const id = (location.hash.match(/^#\/([a-z]+)/) || [])[1] || 'dashboard';
  const page = PAGES.find((p) => p.id === id) || dashboard;
  if (current && current !== page) current.unmount?.(ctx());
  current = page; document.body.className = 'mode-' + (page.orbit ? 'orbit' : 'page');
  scene?.setMode(page.orbit ? 'orbit' : 'ambient'); scene?.setTasks(S.tasks);
  $('#menu').innerHTML = menu(NAV, page.id); document.title = `${page.title} · Astreoid`;
  draw(false); window.scrollTo({ top: 0 });
}
function draw(keepScroll) {
  if (!current || !$('#view')) return; const y = window.scrollY, v = $('#view');
  const focusId = document.activeElement?.id;
  v.className = 'wrap' + (current.orbit ? ' pt' : ''); v.innerHTML = current.render(ctx());
  current.mount?.(v, ctx()); if (keepScroll) window.scrollTo({ top: y });
  if (focusId && !v.contains(document.activeElement)) document.getElementById(focusId)?.focus?.({ preventScroll: true });
}
window.addEventListener('hashchange', route);
window.addEventListener('data:changed', () => { scene?.setTasks(S.tasks); draw(true); updateBell(); });
window.addEventListener('auth:expired', () => { if (S.user) { reset(); toast('Your session expired — please sign in again.', 'err'); renderAuth(); } });

async function logout() { try { await api('POST', '/logout'); } catch (e) {} reset(); seen = new Set(); location.hash = ''; renderAuth(); }

/* ------------------------------ notifications ------------------------------ */
function updateBell() {
  const n = S.notifications.filter((x) => !x.read).length, b = $('#bell-n'); if (b) { b.textContent = n; b.classList.toggle('hidden', !n); }
  if (notifOpen) drawNotif();
}
function drawNotif() {
  const el = $('#notif'); if (!el) return;
  el.innerHTML = notifOpen ? `<div class="glass notif-panel" role="dialog" aria-label="Notifications"><div class="row between" style="margin-bottom:6px"><h3 style="margin:0">Notifications</h3><button class="link-btn" id="mark">Mark all read</button></div>
    ${S.notifications.length ? S.notifications.slice(0, 30).map((n) => `<div class="notif ${n.read ? '' : 'unread'}"><b>${esc(n.title)}</b><div class="muted">${esc(n.body || '')}</div><div class="hint">${esc(fmt(n.createdAt))}${n.email && n.email !== 'none' ? ` · email ${n.email === 'sent' ? 'sent to ' + esc(S.user.email) : n.email === 'preview' ? 'saved to preview inbox' : 'failed'}` : ''}</div></div>`).join('') : '<p class="empty">Nothing yet. Reminders and alerts appear here and in your inbox.</p>'}</div>` : '';
  const m = $('#mark'); if (m) m.onclick = async () => { await api('POST', '/notifications/read'); S.notifications.forEach((n) => (n.read = true)); updateBell(); };
}
async function toggleNotif() { notifOpen = !notifOpen; $('#bell').setAttribute('aria-expanded', notifOpen); drawNotif(); }
document.addEventListener('mousedown', (e) => { if (notifOpen && !e.target.closest('.notif-panel,#bell')) { notifOpen = false; drawNotif(); } });
async function poll() {
  try {
    const [{ items }, rem, tk] = await Promise.all([api('GET', '/notifications'), api('GET', '/reminders'), api('GET', '/tasks')]);
    const fresh = items.filter((n) => !seen.has(n.id)); items.forEach((n) => seen.add(n.id));
    S.notifications = items; S.reminders = rem.items; const sig = (a) => JSON.stringify(a.map((t) => [t.id, t.updatedAt])); const same = sig(tk.items) === sig(S.tasks); S.tasks = tk.items;
    fresh.forEach((n) => {
      toast(n.body || '', 'info', n.title);
      try { if (localStorage.getItem('astreoid-popups') === '1' && 'Notification' in window && Notification.permission === 'granted') new Notification(n.title, { body: n.body || '' }); } catch (e) {}
    });
    updateBell(); if (fresh.length || !same) { scene?.setTasks(S.tasks); draw(true); }
  } catch (e) { /* offline or signed out: ignore */ }
}
function startPolling() { stopPolling(); polling = setInterval(() => { if (!document.hidden) poll(); }, 20000); }
function stopPolling() { clearInterval(polling); polling = null; }
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.user) poll(); });

/* ------------------------------ boot ------------------------------ */
(async () => {
  try { const { user, mail } = await api('GET', '/me'); S.mail = mail; await enter(user); }
  catch (e) { renderAuth(); hideLoader(); }
})();
window.__astreoid = { scene, S };
