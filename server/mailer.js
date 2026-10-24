// Sends real email through SMTP (e.g. Gmail with an App Password). With no SMTP
// credentials it runs in "preview" mode: messages are written to data/outbox and
// are viewable inside the app, so every flow can still be tried.
const fs = require('fs'), path = require('path'), nodemailer = require('nodemailer');
const { DIR, id } = require('./db');
const OUT = path.join(DIR, 'outbox');
const BREVO = process.env.BREVO_API_KEY;   // HTTPS email API (works on Render free, where SMTP ports are blocked)
const mode = BREVO || (process.env.SMTP_USER && process.env.SMTP_PASS) ? 'smtp' : 'preview';
let transport = null;
if (mode === 'smtp' && !BREVO) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: +(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE ?? 'true') !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
const from = process.env.MAIL_FROM || `Astreoid <${process.env.SMTP_USER || 'no-reply@astreoid.local'}>`;
function parseFrom(f) { const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(f); return m ? { name: m[1] || 'Astreoid', email: m[2] } : { name: 'Astreoid', email: f.trim() }; }

async function send({ to, subject, html, text }) {
  if (BREVO) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, htmlContent: html, textContent: text }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${j.message || 'send failed'}`);
    return { mode, id: j.messageId };
  }
  if (mode === 'smtp') {
    const info = await transport.sendMail({ from, to, subject, html, text });
    return { mode, id: info.messageId };
  }
  fs.mkdirSync(OUT, { recursive: true });
  const rec = { id: id(), to, subject, html, text, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, `${Date.now()}-${rec.id}.json`), JSON.stringify(rec));
  console.log(`[mail:preview] to=${to} subject="${subject}"`);
  return { mode, id: rec.id };
}
function outboxFor(email, limit = 20) {
  if (!fs.existsSync(OUT)) return [];
  return fs.readdirSync(OUT).sort().reverse().slice(0, 300).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); } catch (e) { return null; }
  }).filter((r) => r && r.to === email).slice(0, limit);
}
module.exports = { send, outboxFor, mode };
