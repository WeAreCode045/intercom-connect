import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { upsertEmail, getEmails } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

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

app.listen(PORT, () => console.log(`Mail-sync server running on http://localhost:${PORT}`));
