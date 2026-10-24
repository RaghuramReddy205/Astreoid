// Tiny JSON-file datastore. Every record lives under data[uid][collection], so a
// user can only ever reach their own records through the API.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DIR, { recursive: true });
const FILE = path.join(DIR, 'db.json');
// With DATABASE_URL set (Render + a free Postgres) the same JSON document is stored in
// one Postgres row, so data survives restarts and redeploys. Otherwise: a local file.
const PG_URL = process.env.DATABASE_URL;
let pool = null;
if (PG_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: PG_URL, max: 3, ssl: /localhost|127\.0\.0\.1/.test(PG_URL) ? false : { rejectUnauthorized: false } });
}
let db = { users: {}, data: {} };
if (!pool) { try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* first run */ } }
db.users ||= {}; db.data ||= {};
let storedSecret = null;
// Must finish before the server starts listening.
async function init() {
  if (!pool) return;
  await pool.query('CREATE TABLE IF NOT EXISTS astreoid_store (k text PRIMARY KEY, v jsonb NOT NULL)');
  const r = await pool.query("SELECT v FROM astreoid_store WHERE k='db'");
  if (r.rows[0]) { const v = r.rows[0].v; db.users = v.users || {}; db.data = v.data || {}; }
  const sr = await pool.query("SELECT v FROM astreoid_store WHERE k='secret'");
  if (sr.rows[0]) storedSecret = sr.rows[0].v;
  else { storedSecret = crypto.randomBytes(48).toString('hex'); await pool.query("INSERT INTO astreoid_store(k,v) VALUES('secret',$1)", [JSON.stringify(storedSecret)]); }
}

let timer = null;
function writeNow() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (pool) {
    return pool.query("INSERT INTO astreoid_store(k,v) VALUES('db',$1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v", [JSON.stringify(db)])
      .catch((e) => console.error('[db] save failed:', e.message));
  }
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
function save() { if (!timer) timer = setTimeout(writeNow, 150); }
process.on('exit', () => { try { if (timer && !pool) writeNow(); } catch (e) {} });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { try { await writeNow(); } catch (e) {} process.exit(0); });

const id = () => crypto.randomBytes(9).toString('base64url');
function col(uid, name) { const d = (db.data[uid] ||= {}); return (d[name] ||= []); }

// The signing secret is generated once and kept next to the data (override with JWT_SECRET).
function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (pool) return storedSecret;
  const f = path.join(DIR, '.secret');
  try { return fs.readFileSync(f, 'utf8'); } catch (e) {}
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
module.exports = { db, save, writeNow, init, id, col, secret, DIR };
