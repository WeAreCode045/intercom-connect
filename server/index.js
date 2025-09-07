import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { upsertEmail, getEmails, listSettings, createOrUpdateSetting, saveSettingsObject, saveEmailsArray } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Placeholder for Vite middleware (set later in startup). Register a wrapper early so
// API routes are always handled by Express; non-/api requests are forwarded to Vite when ready.
let viteMiddleware = null;
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  if (viteMiddleware) return viteMiddleware(req, res, next);
  return next();
});

function withImapConnection(fn) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_HOST,
      port: Number(process.env.IMAP_PORT) || 993,
      tls: (process.env.IMAP_SECURE || 'true') === 'true',
    });

    imap.once('ready', async () => {
      try {
        const result = await fn(imap);
        imap.end();
        resolve(result);
      } catch (error) {
        try { imap.end(); } catch (endErr) { console.debug('imap end error', endErr && endErr.message); }
        reject(error);
      }
    });

    imap.once('error', (err) => reject(err));
    imap.connect();
  });
}

// Fetch emails (with optional includeBody)
app.post('/api/fetch-emails', async (req, res) => {
  const { includeBody } = req.body || {};

  try {
    const result = await withImapConnection((imap) => new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) return reject(err);

        const fetchCount = 5;
        const from = Math.max(1, box.messages.total - fetchCount + 1);
        const seq = `${from}:${box.messages.total}`;

        const f = imap.seq.fetch(seq, { bodies: includeBody ? '' : 'HEADER.FIELDS (FROM TO SUBJECT DATE)', struct: true });
        const emails = [];

        f.on('message', (msg) => {
          let uid;
          let flags = [];
          let internalDate = new Date();
          msg.on('attributes', (attrs) => {
            uid = attrs.uid;
            flags = attrs.flags || [];
            internalDate = attrs.date || internalDate;
          });

          let raw = '';
          msg.on('body', (stream) => { stream.on('data', (chunk) => { raw += chunk.toString('utf8'); }); });

          msg.once('end', async () => {
            try {
              let subject = '';
              let fromAddr = '';
              if (includeBody && raw) {
                const parsed = await simpleParser(raw);
                subject = parsed.subject || '';
                fromAddr = parsed.from?.value?.[0]?.address || '';
                const body = parsed.text || parsed.html || '';
                const e = { id: String(uid), subject, from: fromAddr, date: internalDate, isRead: flags.includes('\\Seen'), body };
                emails.push(e);
                try { await upsertEmail(e); } catch (err) { console.error('db upsert error', err); }
              } else {
                const parsed = await simpleParser(raw || '');
                subject = parsed.subject || '';
                fromAddr = parsed.from?.value?.[0]?.address || '';
                const e = { id: String(uid), subject, from: fromAddr, date: internalDate, isRead: flags.includes('\\Seen'), body: undefined };
                emails.push(e);
                try { await upsertEmail(e); } catch (err) { console.error('db upsert error', err); }
              }
            } catch (error) {
              console.debug('parse message error', error && error.message);
            }
          });
        });

        f.once('error', (err) => reject(err));
        f.once('end', () => resolve({ emails, total: box.messages.total, server: process.env.IMAP_HOST, folder: 'INBOX' }));
      });
    }));

    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk fetch multiple message bodies by UID
app.post('/api/fetch-email-messages', async (req, res) => {
  const { emailIds } = req.body || {};
  if (!Array.isArray(emailIds)) return res.status(400).json({ success: false, error: 'emailIds must be an array' });

  try {
    const result = await withImapConnection((imap) => new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err) => {
        if (err) return reject(err);
        const uids = emailIds.map(id => Number(id));
        const f = imap.fetch(uids, { bodies: '' });
        const messages = [];

        f.on('message', (msg) => {
          let uid;
          let raw = '';
          msg.on('attributes', (attrs) => { uid = attrs.uid; });
          msg.on('body', (stream) => { stream.on('data', (chunk) => raw += chunk.toString('utf8')); });
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(raw);
              messages.push({ id: String(uid), body: parsed.text || parsed.html || '' });
            } catch (error) { console.debug('parse bulk message error', error && error.message); }
          });
        });

        f.once('error', (err) => reject(err));
        f.once('end', () => resolve({ messages }));
      });
    }));

    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch single message body by UID
app.post('/api/fetch-email-message', async (req, res) => {
  const { emailId } = req.body || {};
  if (!emailId) return res.status(400).json({ success: false, error: 'emailId required' });

  try {
    const result = await withImapConnection((imap) => new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err) => {
        if (err) return reject(err);
        const uid = Number(emailId);
        const f = imap.fetch(uid, { bodies: '' });
        let found = false;
        f.on('message', (msg) => {
          let raw = '';
          let uidLocal;
          msg.on('attributes', (attrs) => { uidLocal = attrs.uid; });
          msg.on('body', (stream) => { stream.on('data', (chunk) => raw += chunk.toString('utf8')); });
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(raw);
              found = true;
              resolve({ id: String(uidLocal), body: parsed.text || parsed.html || '' });
            } catch (error) {
              console.debug('parse single message error', error && error.message);
              resolve({ id: String(uidLocal || uid), body: '' });
            }
          });
        });
        f.once('end', () => { if (!found) resolve({ id: String(uid), body: '' }); });
        f.once('error', (err) => reject(err));
      });
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Return locally stored emails from json
app.get('/api/stored-emails', async (req, res) => {
  try {
    const emails = await getEmails(100);
    res.json({ success: true, emails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await listSettings(req.query?.category);
    res.json({ success: true, settings });
  } catch (err) {
    console.error('settings list error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Convenience: per-category routes
app.get('/api/settings/:category', async (req, res) => {
  try {
    const { category } = req.params || {};
    const settings = await listSettings(category);
    res.json({ success: true, settings });
  } catch (err) {
    console.error('settings list by category error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Return per-category settings as a single key->value object (helpful for frontend)
app.get('/api/settings/:category/object', async (req, res) => {
  try {
    const { category } = req.params || {};
    const arr = await listSettings(category);
    const settingsObj = {};
    for (const s of arr) settingsObj[s.key] = s.value;
    res.json({ success: true, settings: settingsObj });
  } catch (err) {
    console.error('settings object by category error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/:category', async (req, res) => {
  try {
    const payload = req.body || {};
    const { category } = req.params || {};
    payload.category = category;
    const ok = await createOrUpdateSetting(payload);
    if (ok) return res.json({ success: true });
    return res.status(500).json({ success: false, error: 'failed to save setting' });
  } catch (err) {
    console.error('settings save by category error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk update: accept an object of key->value pairs and write them atomically per-category
app.post('/api/settings/:category/bulk', async (req, res) => {
  try {
    const { category } = req.params || {};
    const payload = req.body || {};
    const settings = payload.settings || {};
    const existing = (await listSettings(category)).reduce((acc, s) => { acc[s.key] = s; return acc; }, {});
    for (const [key, value] of Object.entries(settings)) {
      const is_encrypted = key.includes('password') || key.includes('token');
      const id = existing[key] ? existing[key].id : undefined;
      const ok = await createOrUpdateSetting({ id, key, value, category, is_encrypted });
      if (!ok) return res.status(500).json({ success: false, error: `failed to save ${key}` });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('settings bulk save error', err && err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Replace entire settings object for a category with a plain key->value object
app.post('/api/sync/settings', async (req, res) => {
  try {
    const { category, object } = req.body || {};
    if (!category || typeof object !== 'object') return res.status(400).json({ ok: false, error: 'category and object required' });
    const ok = await saveSettingsObject(category, object);
    return res.json({ ok });
  } catch (err) { console.error(err); return res.status(500).json({ ok: false, error: err.message }); }
});

// Replace entire emails array (mail.json)
app.post('/api/sync/emails', async (req, res) => {
  try {
    const { emails } = req.body || {};
    if (!Array.isArray(emails)) return res.status(400).json({ ok: false, error: 'emails array required' });
    const ok = await saveEmailsArray(emails);
    return res.json({ ok });
  } catch (err) { console.error(err); return res.status(500).json({ ok: false, error: err.message }); }
});

// Mark an existing email as processed (convenience endpoint)
app.post('/api/mark-processed', async (req, res) => {
  const { id, message, intercomId, processingTime } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'id required' });
  try {
    await upsertEmail({ id, processed: 1, processing_message: message || null, intercom_id: intercomId || null, processing_time: processingTime || null });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, error: err.message }); }
});

// Start server with Vite middleware in development or serve built files in production
(async () => {
  const isProd = (process.env.NODE_ENV === 'production');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '..');

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({ server: { middlewareMode: 'ssr' }, root: projectRoot });
      // Expose vite.middleware through a wrapper registered earlier.
      viteMiddleware = vite.middlewares;
      console.log('Vite middleware ready');
      console.log('Vite middleware enabled (development)');
    } catch (err) {
      console.error('Failed to start Vite middleware:', err && err.message);
    }
  } else {
    const distPath = path.join(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    console.log('Serving static files from', distPath);
  }

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`App listening on http://localhost:${PORT}`));
})();
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSettings, createOrUpdateSetting, getEmails, saveSettingsObject, saveEmailsArray, upsertEmail } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// API
app.get('/api/settings/:category/object', async (req, res) => {
  try {
    const arr = await listSettings(req.params.category || 'general');
    const obj = {};
    for (const s of arr) obj[s.key] = s.value;
    res.json({ success: true, settings: obj });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/settings/:category/bulk', async (req, res) => {
  try {
    const { category } = req.params || {};
    const payload = req.body || {};
    const settings = payload.settings || {};
    for (const [key, value] of Object.entries(settings)) {
      const is_encrypted = key.includes('password') || key.includes('token');
      const ok = await createOrUpdateSetting({ key, value, category, is_encrypted });
      if (!ok) return res.status(500).json({ success: false, error: `failed to save ${key}` });
    }
    return res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/sync/settings', async (req, res) => {
  const { category, object } = req.body || {};
  if (!category || typeof object !== 'object') return res.status(400).json({ ok: false, error: 'category and object required' });
  const ok = await saveSettingsObject(category, object);
  return res.json({ ok });
});

app.get('/api/stored-emails', async (req, res) => {
  try {
    const emails = await getEmails(200);
    res.json({ success: true, emails });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/sync/emails', async (req, res) => {
  const { emails } = req.body || {};
  if (!Array.isArray(emails)) return res.status(400).json({ ok: false, error: 'emails array required' });
  const ok = await saveEmailsArray(emails);
  return res.json({ ok });
});

app.post('/api/process-email', async (req, res) => {
  const { email, processingResult } = req.body || {};
  if (!email) return res.status(400).json({ success: false, error: 'email required' });
  try {
    const e = {
      id: email.id,
      subject: email.subject,
      from: email.from || email.fromAddr,
      date: email.date,
      isRead: email.isRead,
      body: email.body,
      processed: processingResult?.success ? 1 : 0,
      error: processingResult?.success ? null : (processingResult?.error || null),
      processing_message: processingResult?.message || null,
      intercom_id: processingResult?.intercomConversationId || null,
      processing_time: processingResult?.processingTime || null,
    };
    await upsertEmail(e);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Vite middleware in dev: serve frontend and use middleware to render index.html
(async () => {
  const isProd = (process.env.NODE_ENV === 'production');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '..');
  let viteMiddleware = null;

  if (!isProd) {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({ server: { middlewareMode: 'ssr' }, root: projectRoot });
      viteMiddleware = vite.middlewares;
      app.use((req, res, next) => {
        if (req.url.startsWith('/api')) return next();
        return viteMiddleware(req, res, next);
      });
      console.log('Vite middleware ready');
    } catch (err) { console.error('failed to start vite middleware', err && err.message); }
  } else {
    const dist = path.join(projectRoot, 'dist');
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`App listening on http://localhost:${PORT}`));
})();
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { upsertEmail, getEmails } from './db.js';
import { saveSettingsObject, saveEmailsArray } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Placeholder for Vite middleware (set later in startup). Register a wrapper early so
// API routes are always handled by Express; non-/api requests are forwarded to Vite when ready.
let viteMiddleware = null;
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  if (viteMiddleware) return viteMiddleware(req, res, next);
  // Vite not ready yet: continue to next handlers (may 404), or we could return a 503.
  return next();
});

const PORT = globalThis.process?.env?.PORT || 4000;

function withImapConnection(fn) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: globalThis.process?.env?.IMAP_USER,
      password: globalThis.process?.env?.IMAP_PASSWORD,
      host: globalThis.process?.env?.IMAP_HOST,
      port: Number(globalThis.process?.env?.IMAP_PORT) || 993,
      tls: (globalThis.process?.env?.IMAP_SECURE || 'true') === 'true',
    });

    imap.once('ready', async () => {
      try {
        const result = await fn(imap);
        imap.end();
        resolve(result);
      } catch (error) {
        try { imap.end(); } catch (endErr) { console.debug('imap end error', endErr && endErr.message); }
        reject(error);
      }
    });

    imap.once('error', (err) => reject(err));
    imap.connect();
  });
}

// Fetch emails (with optional includeBody)
app.post('/api/fetch-emails', async (req, res) => {
  const { includeBody } = req.body || {};

  try {
    const result = await withImapConnection((imap) => new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) return reject(err);

        const fetchCount = 5;
        const from = Math.max(1, box.messages.total - fetchCount + 1);
        const seq = `${from}:${box.messages.total}`;

        const f = imap.seq.fetch(seq, { bodies: includeBody ? '' : 'HEADER.FIELDS (FROM TO SUBJECT DATE)', struct: true });
        const emails = [];

        f.on('message', (msg) => {
          // seqno not used
          let uid;
          let flags = [];
          let internalDate = new Date();
          msg.on('attributes', (attrs) => {
            uid = attrs.uid;
            flags = attrs.flags || [];
            internalDate = attrs.date || internalDate;
          });

          let raw = '';
          msg.on('body', (stream) => {
            stream.on('data', (chunk) => { raw += chunk.toString('utf8'); });
          });

          msg.once('end', async () => {
            try {
              let subject = '';
              let fromAddr = '';
              if (includeBody && raw) {
                const parsed = await simpleParser(raw);
                subject = parsed.subject || '';
                fromAddr = parsed.from?.value?.[0]?.address || '';
                const body = parsed.text || parsed.html || '';
                const e = { id: String(uid), subject, from: fromAddr, date: internalDate, isRead: flags.includes('\\Seen'), body };
                emails.push(e);
                try { upsertEmail(e); } catch (err) { console.error('db upsert error', err); }
              } else {
                // parse headers
                const parsed = await simpleParser(raw || '');
                subject = parsed.subject || '';
                fromAddr = parsed.from?.value?.[0]?.address || '';
                const e = { id: String(uid), subject, from: fromAddr, date: internalDate, isRead: flags.includes('\\Seen'), body: undefined };
                emails.push(e);
                try { upsertEmail(e); } catch (err) { console.error('db upsert error', err); }
              }
            } catch (error) {
              console.debug('parse message error', error && error.message);
            }
          });
        });

  f.once('error', (err) => reject(err));
  f.once('end', () => resolve({ emails, total: box.messages.total, server: globalThis.process?.env?.IMAP_HOST, folder: 'INBOX' }));
      });
    }));

    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk fetch multiple message bodies by UID
app.post('/api/fetch-email-messages', async (req, res) => {
  const { emailIds } = req.body || {};
  if (!Array.isArray(emailIds)) return res.status(400).json({ success: false, error: 'emailIds must be an array' });

  try {
    const result = await withImapConnection((imap) => new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err) => {
        if (err) return reject(err);
        const uids = emailIds.map(id => Number(id));
        const f = imap.fetch(uids, { bodies: '' });
        const messages = [];

        f.on('message', (msg) => {
          let uid;
          let raw = '';
          msg.on('attributes', (attrs) => { uid = attrs.uid; });
          msg.on('body', (stream) => { stream.on('data', (chunk) => raw += chunk.toString('utf8')); });
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(raw);
              messages.push({ id: String(uid), body: parsed.text || parsed.html || '' });
            } catch (error) { console.debug('parse bulk message error', error && error.message); }
          });
        });

        f.once('error', (err) => reject(err));
        f.once('end', () => resolve({ messages }));
      });
    }));

    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch single message body by UID
app.post('/api/fetch-email-message', async (req, res) => {
  const { emailId } = req.body || {};
  if (!emailId) return res.status(400).json({ success: false, error: 'emailId required' });

  try {
    const result = await withImapConnection((imap) => new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err) => {
        if (err) return reject(err);
        const uid = Number(emailId);
        const f = imap.fetch(uid, { bodies: '' });
        let found = false;
        f.on('message', (msg) => {
          let raw = '';
          let uidLocal;
          msg.on('attributes', (attrs) => { uidLocal = attrs.uid; });
          msg.on('body', (stream) => { stream.on('data', (chunk) => raw += chunk.toString('utf8')); });
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(raw);
              found = true;
              resolve({ id: String(uidLocal), body: parsed.text || parsed.html || '' });
            } catch (error) {
              console.debug('parse single message error', error && error.message);
              resolve({ id: String(uidLocal || uid), body: '' });
            }
          });
        });
        f.once('end', () => { if (!found) resolve({ id: String(uid), body: '' }); });
        f.once('error', (err) => reject(err));
      });
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Return locally stored emails from sqlite
app.get('/api/stored-emails', async (req, res) => {
  try {
    const emails = getEmails(100);
    res.json({ success: true, emails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  try {
    // eslint-disable-next-line import/no-unresolved
  const { listSettings } = await import('./db.js');
  const settings = listSettings(req.query?.category);
    res.json({ success: true, settings });
  } catch (err) {
    console.error('settings list error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Convenience: per-category routes
app.get('/api/settings/:category', async (req, res) => {
  try {
    const { category } = req.params || {};
    // eslint-disable-next-line import/no-unresolved
    const { listSettings } = await import('./db.js');
    const settings = listSettings(category);
    res.json({ success: true, settings });
  } catch (err) {
    console.error('settings list by category error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Return per-category settings as a single key->value object (helpful for frontend)
app.get('/api/settings/:category/object', async (req, res) => {
  try {
  console.log('Received request for settings object, category=', req.params.category);
    const { category } = req.params || {};
    // eslint-disable-next-line import/no-unresolved
    const { listSettings } = await import('./db.js');
    const arr = listSettings(category);
    const settingsObj = {};
    for (const s of arr) settingsObj[s.key] = s.value;
    res.json({ success: true, settings: settingsObj });
  } catch (err) {
    console.error('settings object by category error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/:category', async (req, res) => {
  try {
    const payload = req.body || {};
    const { category } = req.params || {};
    payload.category = category;
    // eslint-disable-next-line import/no-unresolved
    const { createOrUpdateSetting } = await import('./db.js');
    const ok = createOrUpdateSetting(payload);
    if (ok) return res.json({ success: true });
    return res.status(500).json({ success: false, error: 'failed to save setting' });
  } catch (err) {
    console.error('settings save by category error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk update: accept an object of key->value pairs and write them atomically per-category
app.post('/api/settings/:category/bulk', async (req, res) => {
  try {
    const { category } = req.params || {};
    const payload = req.body || {};
    const settings = payload.settings || {};
    // eslint-disable-next-line import/no-unresolved
    const { createOrUpdateSetting, listSettings } = await import('./db.js');
    const existing = listSettings(category).reduce((acc, s) => { acc[s.key] = s; return acc; }, {});
    for (const [key, value] of Object.entries(settings)) {
      const is_encrypted = key.includes('password') || key.includes('token');
      const id = existing[key] ? existing[key].id : undefined;
      const ok = createOrUpdateSetting({ id, key, value, category, is_encrypted });
      if (!ok) return res.status(500).json({ success: false, error: `failed to save ${key}` });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('settings bulk save error', err && err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

  // Replace entire settings object for a category with a plain key->value object
  app.post('/api/sync/settings', (req, res) => {
    const { category, object } = req.body || {};
    if (!category || typeof object !== 'object') {
      return res.status(400).json({ ok: false, error: 'category and object required' });
    }
    const ok = saveSettingsObject(category, object);
    return res.json({ ok });
  });

  // Replace entire emails array (mail.json)
  app.post('/api/sync/emails', (req, res) => {
    const { emails } = req.body || {};
    if (!Array.isArray(emails)) {
      return res.status(400).json({ ok: false, error: 'emails array required' });
    }
    const ok = saveEmailsArray(emails);
    return res.json({ ok });
  });

app.post('/api/settings', async (req, res) => {
  try {
    const payload = req.body || {};
    // eslint-disable-next-line import/no-unresolved
    const { createOrUpdateSetting } = await import('./db.js');
    const ok = createOrUpdateSetting(payload);
    if (ok) return res.json({ success: true });
    return res.status(500).json({ success: false, error: 'failed to save setting' });
  } catch (err) {
    console.error('settings save error', err && err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Placeholder for processEmail - forward to existing processing logic or mock
app.post('/api/process-email', async (req, res) => {
  const { email, processingResult } = req.body || {};
  if (!email) return res.status(400).json({ success: false, error: 'email required' });

  // Accept an optional processingResult payload to persist
  const result = processingResult || { success: true, message: 'Processed (mock)', intercomConversationId: null, processingTime: 120 };

  try {
    const e = {
      id: email.id,
      subject: email.subject,
      from: email.from,
      date: email.date,
      isRead: email.isRead,
      body: email.body,
      processed: result.success ? 1 : 0,
      error: result.success ? null : (result.error || null),
      processing_message: result.message || null,
      intercom_id: result.intercomConversationId || null,
      processing_time: result.processingTime || null,
    };
    upsertEmail(e);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark an existing email as processed (convenience endpoint)
app.post('/api/mark-processed', async (req, res) => {
  const { id, message, intercomId, processingTime } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'id required' });
  try {
    upsertEmail({ id, processed: 1, processing_message: message || null, intercom_id: intercomId || null, processing_time: processingTime || null });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server with Vite middleware in development or serve built files in production
(async () => {
  const isProd = (process.env.NODE_ENV === 'production');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '..');

  if (!isProd) {
    // Use Vite dev server as middleware so a single process serves both frontend and backend
    try {
      const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ server: { middlewareMode: 'ssr' }, root: projectRoot });
  // Expose vite.middleware through a wrapper registered earlier.
  viteMiddleware = vite.middlewares;
  console.log('Vite middleware ready');
      console.log('Vite middleware enabled (development)');
    } catch (err) {
      console.error('Failed to start Vite middleware:', err && err.message);
    }
  } else {
    // Serve static built frontend
    const distPath = path.join(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    console.log('Serving static files from', distPath);
  }

  app.listen(PORT, () => console.log(`Mail-sync server running on http://localhost:${PORT}`));
})().catch(err => { console.error(err); process.exit(1); });
