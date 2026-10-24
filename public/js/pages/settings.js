import { api } from '../api.js';
import { S, setUser, tz } from '../store.js';
import { esc, fmt, field, input, pillBtn, btnPrimary, checkbox, openModal, toast, busy, $ } from '../ui.js';
import { msg } from '../common.js';
let mode = null;

export default {
  id: 'settings', label: 'Settings', title: 'Settings', icon: 'settings',
  render() {
    const p = S.user.prefs, zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['Asia/Kolkata', 'UTC']);
    if (!zones.includes(p.timeZone)) zones.unshift(p.timeZone);
    const cb = (id, label, desc, k) => checkbox({ id, label, desc, checked: !!p[k], attrs: `data-pref="${k}"` });
    return `<div class="page-head"><div class="grow"><h1>Settings</h1><p>Notification permissions, preferences and quiet hours.</p></div></div>
    <div class="grid g2"><form class="glass stack" data-submit="save" novalidate id="sf-prefs"><h3 style="margin:0">Profile & day</h3>
      ${field('Display name', input(`id="s-name" maxlength="60" value="${esc(S.user.name)}"`))}${field('Email (notifications go here)', input(`value="${esc(S.user.email)}" disabled`))}
      ${field('Time zone', `<select class="ui-input" id="s-tz">${zones.map((z) => `<option ${z === p.timeZone ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>`, 'Used for dates in chat, reminders, briefings and quiet hours.')}
      <div class="field-row">${field('Day starts', input(`id="s-ds" type="time" value="${p.dayStartsAt}"`))}${field('Day ends', input(`id="s-de" type="time" value="${p.dayEndsAt}"`))}</div>
      <h3 style="margin:10px 0 0">Notifications</h3>
      ${cb('s-n', `Email me at ${S.user.email}`, 'Master switch for every email below', 'notificationsEnabled')}${cb('s-r', 'Task reminders', 'When a reminder you set comes due', 'emailReminders')}${cb('s-d', 'Deadline alerts', 'One hour before a deadline, and when one is missed', 'emailDeadlines')}${cb('s-b', 'Morning briefing', 'Your top priorities when the day starts', 'emailBriefing')}
      <div class="field-row">${field('Quiet hours from', input(`id="s-qs" type="time" value="${p.quietHoursStart || ''}"`), 'Reminders wait until quiet hours end.')}${field('Quiet hours until', input(`id="s-qe" type="time" value="${p.quietHoursEnd || ''}"`))}</div>
      ${checkbox({ id: 's-pop', label: 'Browser pop-ups while Astreoid is open', desc: 'Needs your browser’s permission', checked: localStorage.getItem('astreoid-popups') === '1' && 'Notification' in window && Notification.permission === 'granted' })}
      <div class="row wrapx">${btnPrimary('Save settings', 'type="submit" id="s-save"', 'text-lg')}${pillBtn('Send test email', 'type="button" data-act="test"', 'is-sm')}</div></form>
    <div class="stack"><section class="glass"><h3>Email delivery</h3><div id="mail-box" class="stack"><p class="hint">Checking…</p></div></section>
      <section class="glass"><h3>Password</h3><form class="stack" data-submit="pw" novalidate>${field('Current password', input('id="pw-c" type="password" autocomplete="current-password"'))}${field('New password', input('id="pw-n" type="password" autocomplete="new-password"'), '8+ characters with a letter and a number')}<div>${pillBtn('Change password', 'type="submit"', 'is-sm')}</div></form></section>
      <section class="glass"><h3>Delete account</h3><p class="hint">Permanently removes your account and every task, subject and review.</p><form class="stack" data-submit="del" novalidate style="margin-top:10px">${field('Confirm with your password', input('id="del-p" type="password" autocomplete="current-password"'))}<div><button class="link-btn danger" type="submit">Delete my account</button></div></form></section></div></div>`;
  },
  async mount() {
    try {
      const o = await api('GET', '/outbox'); mode = o.mode; const box = $('#mail-box'); if (!box) return;
      box.innerHTML = mode === 'smtp' ? `<p><span class="pill" style="color:var(--ok)">● Live</span> Emails are sent through SMTP to <b>${esc(S.user.email)}</b>.</p>`
        : `<p><span class="pill" style="color:var(--warn)">● Preview mode</span></p><p class="hint">No SMTP credentials are configured on the server, so emails are saved to an in-app inbox instead of being delivered to Gmail. Add <code>SMTP_USER</code> and <code>SMTP_PASS</code> (a Gmail App Password) to <code>.env</code> and restart to deliver real email.</p>
        <div class="stack list-scroll">${o.items.map((m, i) => `<div class="row between"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(m.subject)}</b><div class="hint">${esc(fmt(m.createdAt))}</div></span>${pillBtn('View', `data-act="view-mail" data-i="${i}"`, 'is-sm')}</div>`).join('') || '<p class="hint">No emails yet.</p>'}</div>`;
      mount.items = o.items;
    } catch (e) {}
  },
  async submit(name, el) {
    if (name === 'save') {
      const g = (id) => $('#' + id).checked, v = (id) => $('#' + id).value;
      const body = { displayName: v('s-name'), timeZone: v('s-tz'), dayStartsAt: v('s-ds'), dayEndsAt: v('s-de'), quietHoursStart: v('s-qs') || null, quietHoursEnd: v('s-qe') || null, notificationsEnabled: g('s-n'), emailReminders: g('s-r'), emailDeadlines: g('s-d'), emailBriefing: g('s-b') };
      await busy($('#s-save'), async () => {
        const { user } = await api('PUT', '/prefs', body); setUser(user);
        if (g('s-pop') && 'Notification' in window) { const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); localStorage.setItem('astreoid-popups', perm === 'granted' ? '1' : '0'); if (perm !== 'granted') toast('Browser pop-ups were not allowed.', 'err'); } else localStorage.setItem('astreoid-popups', '0');
        toast('Settings saved', 'ok'); window.dispatchEvent(new Event('data:changed'));
      });
    }
    if (name === 'pw') { await api('POST', '/password', { current: $('#pw-c').value, next: $('#pw-n').value }); $('#pw-c').value = $('#pw-n').value = ''; toast('Password changed', 'ok'); }
    if (name === 'del') { if (!confirm('This cannot be undone. Delete your account?')) return; await api('DELETE', '/account', { password: $('#del-p').value }); location.reload(); }
  },
  async act(name, el) {
    if (name === 'test') await busy(el, async () => { const r = await api('POST', '/notifications/test'); toast(r.mode === 'smtp' ? `Test email sent to ${S.user.email}` : 'Saved to the preview inbox — configure SMTP to reach Gmail.', 'ok'); this.mount(); });
    if (name === 'view-mail') { const m = mount.items[+el.dataset.i]; openModal({ title: m.subject, wide: true, body: `<p class="hint">To: ${esc(m.to)}</p><iframe class="preview-frame" sandbox="" srcdoc="${esc(m.html)}" title="Email preview"></iframe>` }); }
  },
};
const mount = { items: [] };
