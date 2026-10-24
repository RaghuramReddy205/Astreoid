// UI helpers + the Uiverse components as HTML builders.
import { tz } from './store.js';
const TZ = window.AST.tz;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let uidN = 0; export const uid = (p = 'u') => `${p}${++uidN}`;

/* ---------------- date formatting (always in the user's chosen time zone) ---------------- */
export function fmt(iso, o = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) {
  if (!iso) return ''; const t = typeof iso === 'number' ? iso : Date.parse(iso); if (isNaN(t)) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz(), ...o }).format(new Date(t));
}
export const fmtTime = (iso) => fmt(iso, { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (key) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(key + 'T00:00:00Z'));
export const todayKey = () => TZ.dayKey(Date.now(), tz());
export function relDue(iso) {
  const t = Date.parse(iso); if (isNaN(t)) return ''; const d = t - Date.now(), a = Math.abs(d), m = Math.round(a / 60000);
  const s = m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  return d < 0 ? `${s} overdue` : `in ${s}`;
}

/* ---------------- icons ---------------- */
const sk = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  // the four SVGs from the Uiverse menu snippet
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6" aria-hidden="true"><path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z"></path><path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z"></path></svg>`,
  files: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6" aria-hidden="true"><path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z"></path></svg>`,
  plans: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6" aria-hidden="true"><path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd"></path></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6" aria-hidden="true"><path d="M17.004 10.407c.138.435-.216.842-.672.842h-3.465a.75.75 0 0 1-.65-.375l-1.732-3c-.229-.396-.053-.907.393-1.004a5.252 5.252 0 0 1 6.126 3.537ZM8.12 8.464c.307-.338.838-.235 1.066.16l1.732 3a.75.75 0 0 1 0 .75l-1.732 3c-.229.397-.76.5-1.067.161A5.23 5.23 0 0 1 6.75 12a5.23 5.23 0 0 1 1.37-3.536ZM10.878 17.13c-.447-.098-.623-.608-.394-1.004l1.733-3.002a.75.75 0 0 1 .65-.375h3.465c.457 0 .81.407.672.842a5.252 5.252 0 0 1-6.126 3.539Z"></path><path fill-rule="evenodd" d="M21 12.75a.75.75 0 1 0 0-1.5h-.783a8.22 8.22 0 0 0-.237-1.357l.734-.267a.75.75 0 1 0-.513-1.41l-.735.268a8.24 8.24 0 0 0-.689-1.192l.6-.503a.75.75 0 1 0-.964-1.149l-.6.504a8.3 8.3 0 0 0-1.054-.885l.391-.678a.75.75 0 1 0-1.299-.75l-.39.676a8.188 8.188 0 0 0-1.295-.47l.136-.77a.75.75 0 0 0-1.477-.26l-.136.77a8.36 8.36 0 0 0-1.377 0l-.136-.77a.75.75 0 1 0-1.477.26l.136.77c-.448.121-.88.28-1.294.47l-.39-.676a.75.75 0 0 0-1.3.75l.392.678a8.29 8.29 0 0 0-1.054.885l-.6-.504a.75.75 0 1 0-.965 1.149l.6.503a8.243 8.243 0 0 0-.689 1.192L3.8 8.216a.75.75 0 1 0-.513 1.41l.735.267a8.222 8.222 0 0 0-.238 1.356h-.783a.75.75 0 0 0 0 1.5h.783c.042.464.122.917.238 1.356l-.735.268a.75.75 0 0 0 .513 1.41l.735-.268c.197.417.428.816.69 1.191l-.6.504a.75.75 0 0 0 .963 1.15l.601-.505c.326.323.679.62 1.054.885l-.392.68a.75.75 0 0 0 1.3.75l.39-.679c.414.192.847.35 1.294.471l-.136.77a.75.75 0 0 0 1.477.261l.137-.772a8.332 8.332 0 0 0 1.376 0l.136.772a.75.75 0 1 0 1.477-.26l-.136-.771a8.19 8.19 0 0 0 1.294-.47l.391.677a.75.75 0 0 0 1.3-.75l-.393-.679a8.29 8.29 0 0 0 1.054-.885l.601.504a.75.75 0 0 0 .964-1.15l-.6-.503c.261-.375.492-.774.69-1.191l.735.267a.75.75 0 1 0 .512-1.41l-.734-.267c.115-.439.195-.892.237-1.356h.784Zm-2.657-3.06a6.744 6.744 0 0 0-1.19-2.053 6.784 6.784 0 0 0-1.82-1.51A6.705 6.705 0 0 0 12 5.25a6.8 6.8 0 0 0-1.225.11 6.7 6.7 0 0 0-2.15.793 6.784 6.784 0 0 0-2.952 3.489.76.76 0 0 1-.036.098A6.74 6.74 0 0 0 5.251 12a6.74 6.74 0 0 0 3.366 5.842l.009.005a6.704 6.704 0 0 0 2.18.798l.022.003a6.792 6.792 0 0 0 2.368-.004 6.704 6.704 0 0 0 2.205-.811 6.785 6.785 0 0 0 1.762-1.484l.009-.01.009-.01a6.743 6.743 0 0 0 1.18-2.066c.253-.707.39-1.469.39-2.263a6.74 6.74 0 0 0-.408-2.309Z" clip-rule="evenodd"></path></svg>`,
  orbit: sk('<circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-25 12 12)"/>'),
  chat: sk('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  academics: sk('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5v4.5c3.5 2.5 8.5 2.5 12 0v-4.5"/>'),
  code: sk('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
  habits: sk('<path d="M12 3c1 3-2 4-2 7a4 4 0 0 0 8 0c0-2-1-3-1-5-2 .5-3-1-5-2z"/><path d="M8 16a5 5 0 0 0 9 3"/>'),
  review: sk('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>'),
  bell: sk('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
  edit: sk('<path d="M4 20l1-4L16 5l3 3L8 19z"/>'),
  trash: sk('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  x: sk('<path d="M6 6l12 12M18 6L6 18"/>'),
  logout: sk('<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h11"/>'),
  asteroid: '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a99bff"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs><path fill="url(#lg1)" d="M15 2l9 3.5 5 8-2.5 9.5-8.5 6.5-9.5-3L3 17.5 6 8z"/><circle cx="12" cy="13" r="2.6" fill="#0003"/><circle cx="20" cy="19" r="3" fill="#0003"/><circle cx="19" cy="9" r="1.6" fill="#0003"/></svg>',
};

/* ---------------- Uiverse components ---------------- */
// 1) rose hover button (SmookyDev) — Tailwind classes copied verbatim, only the text size is a parameter.
export const btnPrimary = (label, attrs = '', size = 'text-xl', extra = '') =>
  `<button ${attrs} class="px-8 z-30 py-4 bg-rose-400 rounded-md text-white relative font-semibold after:-z-20 after:absolute after:h-1 after:w-1 after:bg-rose-800 after:left-5 overflow-hidden after:bottom-0 after:translate-y-full after:rounded-md after:hover:scale-[300] after:hover:transition-all after:hover:duration-700 after:transition-all after:duration-700 transition-all duration-700 [text-shadow:3px_5px_2px_#be123c;] hover:[text-shadow:2px_2px_2px_#fda4af] ${size} ${extra}">${label}</button>`;
// 2) plus button (OnCloud125252)
export const plusBtn = (label, attrs = '') =>
  `<div tabindex="0" role="button" aria-label="${esc(label)}" title="${esc(label)}" class="plusButton" ${attrs}><svg class="plusIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" aria-hidden="true"><path d="M13.75 23.75V16.25H6.25V13.75H13.75V6.25H16.25V13.75H23.75V16.25H16.25V23.75H13.75Z"></path></svg></div>`;
// 3) pill button (FColombati)
export const pillBtn = (label, attrs = '', cls = '') => `<button type="button" class="button ${cls}" ${attrs}><div class="button-outer"><div class="button-inner"><span>${label}</span></div></div></button>`;
// prism checkbox (safir_3014)
export function checkbox({ id = uid('cb'), checked = false, label = '', desc = '', size = '', iconOnly = false, attrs = '', name = '' }) {
  return `<label class="prism-checkbox ${size ? 'prism-checkbox--' + size : ''} ${iconOnly ? 'prism-checkbox--icon-only' : ''}" ${iconOnly ? `title="${esc(label)}"` : ''}>
  <input class="prism-checkbox__input" type="checkbox" id="${id}" ${name ? `name="${name}"` : ''} aria-label="${esc(label || 'Toggle')}" ${checked ? 'checked' : ''} ${attrs} />
  <span class="prism-checkbox__box" aria-hidden="true"><span class="prism-checkbox__grid"></span><span class="prism-checkbox__glow"></span>
    <svg class="prism-checkbox__check" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5L9.5 17L19 7.5"></path></svg>
    ${[1, 2, 3, 4, 5, 6].map((n) => `<span class="prism-checkbox__particle prism-checkbox__particle--${n}"></span>`).join('')}
  </span>
  <span class="prism-checkbox__content"><span class="prism-checkbox__label">${esc(label)}</span>${desc ? `<span class="prism-checkbox__description">${esc(desc)}</span>` : ''}</span></label>`;
}
// radio glider (june7011)
export function radioGroup(name, options, value, { attrs = '', compact = true, color = '' } = {}) {
  const k = uid('rg');
  return `<div class="radio-container ${compact ? 'compact' : ''}" style="--total-radio:${options.length};${color ? `--main-color:${color};--main-color-opacity:${color}1c;` : ''}" role="radiogroup" aria-label="${esc(name)}">
  ${options.map((o) => `<input type="radio" name="${esc(name)}" id="${k}-${esc(o.value)}" value="${esc(o.value)}" ${o.value === value ? 'checked' : ''} ${attrs}><label for="${k}-${esc(o.value)}">${esc(o.label)}</label>`).join('')}
  <div class="glider-container"><div class="glider"></div></div></div>`;
}
export const val = (root, name) => { const el = root.querySelector(`input[name="${name}"]:checked`); return el ? el.value : undefined; };
// input (escannord)
export const input = (attrs = '') => `<input class="ui-input" ${attrs}>`;
export const field = (label, control, hint = '') => `<div class="field"><label>${esc(label)}</label>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
// day / night toggle (mobinkakei)
export const themeToggle = (night) => `<div class="toggleWrapper" title="Switch day / night"><input class="toggle-input" id="theme-toggle" type="checkbox" ${night ? 'checked' : ''} aria-label="Night mode" /><label class="toggle" for="theme-toggle"><span class="toggle__handler"><span class="crater crater--1"></span><span class="crater crater--2"></span><span class="crater crater--3"></span></span><span class="star star--1"></span><span class="star star--2"></span><span class="star star--3"></span><span class="star star--4"></span><span class="star star--5"></span><span class="star star--6"></span></label></div>`;
// glass menu (mymiamo)
export function menu(items, active) {
  return `<nav class="menu" aria-label="Main navigation">${items.map((i) => `<a href="#/${i.id}" class="${i.id === active ? 'active' : ''}" ${i.id === active ? 'aria-current="page"' : ''} title="${esc(i.title)}">${ICONS[i.icon]}<span>${esc(i.label)}</span></a>`).join('')}</nav>`;
}
// tooltip (ayman-ashine) — used as the link to the author's GitHub
export const githubTip = () => `<a class="group relative flex justify-center items-center text-zinc-600 text-sm font-bold gh" href="https://github.com/RaghuramReddy205" target="_blank" rel="noopener noreferrer" aria-label="Visit RaghuramReddy205 on GitHub">
  <div class="absolute opacity-0 group-hover:opacity-100 group-hover:-translate-y-[150%] -translate-y-[300%] duration-500 group-hover:delay-500 skew-y-[20deg] group-hover:skew-y-0 shadow-md">
    <div class="bg-lime-200 flex items-center gap-1 p-2 rounded-md">
      <svg fill="none" viewBox="0 0 24 24" height="20px" width="20px" xmlns="http://www.w3.org/2000/svg" class="stroke-zinc-600"><circle stroke-linejoin="round" r="9" cy="12" cx="12"></circle><path stroke-linejoin="round" d="M12 3C12 3 8.5 6 8.5 12C8.5 18 12 21 12 21"></path><path stroke-linejoin="round" d="M12 3C12 3 15.5 6 15.5 12C15.5 18 12 21 12 21"></path><path stroke-linejoin="round" d="M3 12H21"></path><path stroke-linejoin="round" d="M19.5 7.5H4.5"></path><path stroke-linejoin="round" d="M19.5 16.5H4.5"></path></svg>
      <span>RaghuramReddy205</span>
    </div>
    <div class="shadow-md bg-lime-200 absolute bottom-0 translate-y-1/2 left-1/2 translate-x-full rotate-45 p-1"></div>
    <div class="rounded-md bg-white group-hover:opacity-0 group-hover:scale-[115%] group-hover:delay-700 duration-500 w-full h-full absolute top-0 left-0"><div class="border-b border-r border-white bg-white absolute bottom-0 translate-y-1/2 left-1/2 translate-x-full rotate-45 p-1"></div></div>
  </div>
  <div class="shadow-md flex items-center group-hover:gap-2 bg-gradient-to-br from-lime-200 to-yellow-200 p-3 rounded-full cursor-pointer duration-300">
    <svg fill="none" viewBox="0 0 24 24" height="20px" width="20px" xmlns="http://www.w3.org/2000/svg" class="fill-zinc-600"><path stroke-linejoin="round" stroke-linecap="round" d="M15.4306 7.70172C7.55045 7.99826 3.43929 15.232 2.17021 19.3956C2.07701 19.7014 2.31139 20 2.63107 20C2.82491 20 3.0008 19.8828 3.08334 19.7074C6.04179 13.4211 12.7066 12.3152 15.514 12.5639C15.7583 12.5856 15.9333 12.7956 15.9333 13.0409V15.1247C15.9333 15.5667 16.4648 15.7913 16.7818 15.4833L20.6976 11.6784C20.8723 11.5087 20.8993 11.2378 20.7615 11.037L16.8456 5.32965C16.5677 4.92457 15.9333 5.12126 15.9333 5.61253V7.19231C15.9333 7.46845 15.7065 7.69133 15.4306 7.70172Z"></path></svg>
    <span class="text-[0px] group-hover:text-sm duration-300">My GitHub</span>
  </div></a>`;
// analytics card (themrsami) — filled with real numbers from the user's tasks
export const RANGES = {
  '7d': { label: 'Last 7 days', title: 'Weekly momentum', vs: 'last week' },
  '1m': { label: 'Last 1 month', title: 'Monthly momentum', vs: 'last month' },
  '6m': { label: 'Last 6 months', title: '6-month momentum', vs: 'previous 6 months' },
  '1y': { label: 'Last 1 year', title: 'Yearly momentum', vs: 'last year' },
};
export function analyticsCard({ range = '7d', totalLabel, totalValue, totalDelta, secLabel, secValue, secDelta, bars }) {
  const bar = (b) => `<div class="rounded-sm bg-indigo-500/30" style="height:${b.outer}%;flex:1 1 0;max-width:14px;min-width:3px" title="${esc(b.title)}"><div class="w-full rounded-sm bg-indigo-500 transition-all duration-300" style="height:${b.inner}%"></div></div>`;
  return `<div class="ast-card group relative flex w-full flex-col rounded-xl bg-slate-950 p-4 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/20">
  <div class="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-sm transition-opacity duration-300 group-hover:opacity-30"></div>
  <div class="ast-card-face absolute inset-px rounded-[11px] bg-slate-950"></div>
  <div class="relative">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500"><svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg></div>
        <h3 class="text-sm font-semibold text-white" style="margin:0">${esc(RANGES[range].title)}</h3>
      </div>
      <span class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-500"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Live</span>
    </div>
    <div class="mb-4 grid grid-cols-2 gap-4">
      <div class="rounded-lg bg-slate-900/50 p-3"><p class="text-xs font-medium text-slate-400">${esc(totalLabel)}</p><p class="text-lg font-semibold text-white">${esc(totalValue)}</p><span class="text-xs font-medium text-emerald-500">${esc(totalDelta)}</span></div>
      <div class="rounded-lg bg-slate-900/50 p-3"><p class="text-xs font-medium text-slate-400">${esc(secLabel)}</p><p class="text-lg font-semibold text-white">${esc(secValue)}</p><span class="text-xs font-medium ${/overdue|late/i.test(secDelta) && !/^0 /.test(secDelta) ? 'text-rose-400' : 'text-emerald-500'}">${esc(secDelta)}</span></div>
    </div>
    <div class="mb-4 h-24 w-full overflow-hidden rounded-lg bg-slate-900/50 p-3"><div class="flex h-full w-full items-end justify-between gap-1">${bars.map(bar).join('')}</div></div>
    <div class="flex items-center justify-between">
      <label class="ast-range flex items-center gap-2"><span class="sr">Time range</span>
        <select data-chg="range" class="ast-select text-xs font-medium text-slate-400" aria-label="Time range">${Object.entries(RANGES).map(([k, r]) => `<option value="${k}" ${k === range ? 'selected' : ''}>${r.label}</option>`).join('')}</select>
        <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="margin-left:-22px;pointer-events:none"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></label>
      <button data-act="go-review" class="flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-1 text-xs font-medium text-white transition-all duration-300 hover:from-indigo-600 hover:to-purple-600">View Details <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button>
    </div>
  </div></div>`;
}

/* ---------------- toast + modal ---------------- */
export function toast(msg, type = 'info', title = '') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.innerHTML = (title ? `<b>${esc(title)}</b>` : '') + `<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), type === 'err' ? 7000 : 4500);
}
export function openModal({ title, body, wide = false, onMount }) {
  const prev = document.activeElement, back = document.createElement('div'); back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="row-btn" data-close aria-label="Close">${ICONS.x}</button></div><div class="modal-body">${body}</div></div>`;
  document.body.appendChild(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.querySelector('[data-close]').onclick = close;
  const m = back.querySelector('.modal'); onMount?.(m, close);
  (m.querySelector('input:not([type=radio]):not([type=checkbox]),textarea,select') || m.querySelector('button'))?.focus();
  return { close, el: m };
}
export async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } finally { if (btn) btn.disabled = false; }
}
export const CATS = [{ value: 'academics', label: 'Academics' }, { value: 'coding', label: 'Coding' }, { value: 'project', label: 'Project' }, { value: 'personal', label: 'Personal' }, { value: 'habit', label: 'Habit' }];
export const PRIOS = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }];
export const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.value, c.label]));
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('plusButton')) { e.preventDefault(); e.target.click(); } });
