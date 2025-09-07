import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const projectRoot = (typeof globalThis !== 'undefined' && typeof globalThis.process !== 'undefined' && typeof globalThis.process.cwd === 'function')
  ? globalThis.process.cwd()
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_DIR = path.resolve(projectRoot, 'server', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Try to use better-sqlite3 if available, otherwise fall back to a simple JSON file store
let usingSqlite = false;
let sqliteDb = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
  const Database = await import('better-sqlite3').then(m => m.default || m);
  const dbPath = path.join(DB_DIR, 'mail.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      subject TEXT,
      fromAddr TEXT,
      date INTEGER,
      isRead INTEGER,
      body TEXT,
      processed INTEGER DEFAULT 0,
      error TEXT,
      processing_message TEXT,
      intercom_id TEXT,
      processing_time INTEGER
    );
  `);
  try { sqliteDb.exec(`ALTER TABLE emails ADD COLUMN processing_message TEXT`); } catch { /* ignore */ }
  try { sqliteDb.exec(`ALTER TABLE emails ADD COLUMN intercom_id TEXT`); } catch { /* ignore */ }
  try { sqliteDb.exec(`ALTER TABLE emails ADD COLUMN processing_time INTEGER`); } catch { /* ignore */ }
  usingSqlite = true;
} catch (err) {
  console.warn('better-sqlite3 not available, falling back to JSON file store:', err && err.message);
}

const JSON_DB_PATH = path.join(DB_DIR, 'mail.json');
function loadJsonDb() {
  try {
    if (!fs.existsSync(JSON_DB_PATH)) return [];
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.debug('loadJsonDb error', err && err.message);
    return [];
  }
}

function saveJsonDb(data) {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('saveJsonDb error', err && err.message);
  }
}

export function upsertEmail(email) {
  if (usingSqlite && sqliteDb) {
    const stmt = sqliteDb.prepare(`INSERT INTO emails (id, subject, fromAddr, date, isRead, body, processed, error, processing_message, intercom_id, processing_time)
      VALUES (@id, @subject, @fromAddr, @date, @isRead, @body, @processed, @error, @processing_message, @intercom_id, @processing_time)
      ON CONFLICT(id) DO UPDATE SET
        subject=excluded.subject,
        fromAddr=excluded.fromAddr,
        date=excluded.date,
        isRead=excluded.isRead,
        body=COALESCE(excluded.body, emails.body),
        processed=excluded.processed,
        error=excluded.error,
        processing_message=COALESCE(excluded.processing_message, emails.processing_message),
        intercom_id=COALESCE(excluded.intercom_id, emails.intercom_id),
        processing_time=COALESCE(excluded.processing_time, emails.processing_time);
    `);
    stmt.run({
      id: String(email.id),
      subject: email.subject || '',
      fromAddr: email.from || '',
      date: email.date ? new Date(email.date).getTime() : Date.now(),
      isRead: email.isRead ? 1 : 0,
      body: email.body || null,
      processed: email.processed ? 1 : 0,
      error: email.error || null,
      processing_message: email.processing_message || null,
      intercom_id: email.intercom_id || null,
      processing_time: email.processing_time || null,
    });
    return;
  }

  // JSON fallback
  const data = loadJsonDb();
  const idx = data.findIndex(d => String(d.id) === String(email.id));
  const record = {
    id: String(email.id),
    subject: email.subject || '',
    fromAddr: email.from || '',
    date: email.date ? new Date(email.date).getTime() : Date.now(),
    isRead: email.isRead ? 1 : 0,
    body: email.body || null,
    processed: email.processed ? 1 : 0,
    error: email.error || null,
    processing_message: email.processing_message || null,
    intercom_id: email.intercom_id || null,
    processing_time: email.processing_time || null,
  };
  if (idx === -1) data.push(record); else data[idx] = { ...data[idx], ...record };
  saveJsonDb(data);
}

export function getEmails(limit = 50) {
  if (usingSqlite && sqliteDb) {
    const stmt = sqliteDb.prepare('SELECT * FROM emails ORDER BY date DESC LIMIT ?');
    return stmt.all(limit).map(r => ({ ...r, isRead: !!r.isRead, processed: !!r.processed, date: new Date(r.date) }));
  }
  const data = loadJsonDb();
  const sorted = data.sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, limit);
  return sorted.map(r => ({ ...r, isRead: !!r.isRead, processed: !!r.processed, date: new Date(r.date) }));
}

export default usingSqlite ? sqliteDb : null;
