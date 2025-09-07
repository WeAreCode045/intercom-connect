import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Prefer repository root (one level up from server folder) so DB files live in repo `data/`
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_DIR = path.resolve(repoRoot, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// JSON-only file store (reliable in dev): emails stored in mail.json, settings per-category

// Encryption key for sensitive settings (provide via env: SETTINGS_SECRET)
const SETTINGS_SECRET = process.env.SETTINGS_SECRET || null;
function getKey() {
  if (!SETTINGS_SECRET) return null;
  // Ensure 32-byte key
  return crypto.createHash('sha256').update(String(SETTINGS_SECRET)).digest();
}

function encryptValue(plain) {
  try {
    const key = getKey();
    if (!key) return plain;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // store as base64: iv:tag:cipher
    return Buffer.concat([iv, tag, ct]).toString('base64');
  } catch (err) {
    console.error('encryptValue error', err && err.message);
    return plain;
  }
}

function decryptValue(stored) {
  try {
    const key = getKey();
    if (!key) return stored;
    const buf = Buffer.from(stored, 'base64');
    if (buf.length < 28) return stored;
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const ct = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    return plain;
  } catch (err) {
    console.debug('decryptValue failed', err && err.message);
    return stored;
  }
}

// Use JSON file store for persistence: one JSON file for emails and one per-category JSON for settings
const JSON_DB_PATH = path.join(DB_DIR, 'mail.json');

const SETTINGS_CATEGORIES = ['imap', 'intercom', 'filters', 'general'];
const settingsJsonPaths = {};
for (const c of SETTINGS_CATEGORIES) settingsJsonPaths[c] = path.join(DB_DIR, `${c}.json`);
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

function loadJsonSettings(category) {
  try {
    const p = settingsJsonPaths[category] || settingsJsonPaths.general;
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.debug('loadJsonSettings error', err && err.message);
    return [];
  }
}

function saveJsonSettings(category, data) {
  try {
    const p = settingsJsonPaths[category] || settingsJsonPaths.general;
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('saveJsonSettings error', err && err.message);
  }
}

export function upsertEmail(email) {
  // JSON storage
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

// Settings helpers
export function listSettings(category) {
  const results = [];
  const cats = category && SETTINGS_CATEGORIES.includes(category) ? [category] : SETTINGS_CATEGORIES;
  for (const c of cats) {
    const data = loadJsonSettings(c);
    for (const s of data) {
      const val = !!s.is_encrypted ? decryptValue(s.value) : s.value;
      results.push({ id: s.id, key: s.key, value: val, category: c, is_encrypted: !!s.is_encrypted });
    }
  }
  return results;
}

export function createOrUpdateSetting({ id, key, value, category, is_encrypted }) {
  const cat = SETTINGS_CATEGORIES.includes(category) ? category : 'general';
  try {
    const settings = loadJsonSettings(cat);
    if (is_encrypted) {
      value = encryptValue(value);
    }
    if (id) {
      const idx = settings.findIndex(s => String(s.id) === String(id));
      if (idx !== -1) {
        settings[idx] = { id, key, value, is_encrypted: !!is_encrypted };
        saveJsonSettings(cat, settings);
        return true;
      }
    }
    const existing = settings.find(s => s.key === key);
    if (existing) {
      existing.value = value;
      existing.is_encrypted = !!is_encrypted;
      saveJsonSettings(cat, settings);
      return true;
    }
    const newId = settings.length ? (Math.max(...settings.map(s => Number(s.id || 0))) + 1) : 1;
    settings.push({ id: newId, key, value, is_encrypted: !!is_encrypted });
    saveJsonSettings(cat, settings);
    return true;
  } catch (err) {
    console.error('createOrUpdateSetting json error', cat, err && err.message);
    return false;
  }
}

// Overwrite a category file with a plain object (key -> value)
export function saveSettingsObject(category, obj) {
  try {
    const cat = SETTINGS_CATEGORIES.includes(category) ? category : 'general';
    const arr = [];
    let idx = 1;
    for (const [k, v] of Object.entries(obj || {})) {
      const is_encrypted = String(k || '').toLowerCase().includes('password') || String(k || '').toLowerCase().includes('token');
      const stored = is_encrypted ? encryptValue(v) : v;
      arr.push({ id: idx++, key: k, value: stored, is_encrypted: !!is_encrypted });
    }
    saveJsonSettings(cat, arr);
    return true;
  } catch (err) {
    console.error('saveSettingsObject error', err && err.message);
    return false;
  }
}

// Overwrite mail.json with provided array of email objects
export function saveEmailsArray(arr) {
  try {
    const emails = Array.isArray(arr) ? arr.map(e => ({
      id: String(e.id),
      subject: e.subject || '',
      fromAddr: e.from || e.fromAddr || '',
      date: e.date ? (new Date(e.date)).getTime() : Date.now(),
      isRead: e.isRead ? 1 : 0,
      body: e.body || null,
      processed: e.processed ? 1 : 0,
      error: e.error || null,
      processing_message: e.processing_message || null,
      intercom_id: e.intercom_id || null,
      processing_time: e.processing_time || null,
    })) : [];
    saveJsonDb(emails);
    return true;
  } catch (err) {
    console.error('saveEmailsArray error', err && err.message);
    return false;
  }
}

export function getEmails(limit = 50) {
  const data = loadJsonDb();
  const sorted = data.sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, limit);
  return sorted.map(r => ({ ...r, isRead: !!r.isRead, processed: !!r.processed, date: new Date(r.date) }));
}

export default null;
