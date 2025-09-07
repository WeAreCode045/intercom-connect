import fetch from 'node-fetch';

const API = process.env.API_ROOT || 'http://localhost:4000';
const settings = [
  { key: 'imap_host', value: 'imap.test.example', is_encrypted: false },
  { key: 'imap_username', value: 'user@test.example', is_encrypted: false },
  { key: 'imap_password', value: 's3cr3t', is_encrypted: true },
  { key: 'imap_port', value: '993', is_encrypted: false },
  { key: 'imap_use_ssl', value: 'true', is_encrypted: false },
  { key: 'imap_folder', value: 'INBOX', is_encrypted: false },
  { key: 'imap_connection_timeout', value: '45', is_encrypted: false },
];

async function post(s) {
  const res = await fetch(`${API}/api/settings/imap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  const data = await res.json().catch(() => null);
  console.log(s.key, res.status, data);
}

(async () => {
  for (const s of settings) {
    try {
      await post(s);
    } catch (err) {
      console.error('ERR', s.key, err.message);
    }
  }
})();
