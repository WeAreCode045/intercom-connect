// Simple frontend-only settings store using localStorage.
// Optional client-side encryption with a passphrase stored in sessionStorage under 'SETTINGS_PASSPHRASE'.

const SETTINGS_CATEGORIES = ['imap', 'intercom', 'filters', 'general'];

function storageKey(category) {
  return `settings:${category}`;
}

function loadCategory(category) {
  try {
    const raw = localStorage.getItem(storageKey(category));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.debug('localStore load error', err && err.message);
    return [];
  }
}

function saveCategory(category, arr) {
  try {
    localStorage.setItem(storageKey(category), JSON.stringify(arr));
  } catch (err) {
    console.error('localStore save error', err && err.message);
  }
}

function nextId(arr) {
  const max = arr.reduce((acc, s) => Math.max(acc, Number(s.id || 0)), 0);
  return String(max + 1);
}

// Optional simple encryption using Web Crypto if a passphrase is provided in sessionStorage
async function deriveKey(passphrase) {
  if (!passphrase) return null;
  const enc = new TextEncoder();
  const salt = enc.encode('intercom-connect-settings-salt');
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return key;
}

async function encryptValue(plain) {
  try {
    const pass = sessionStorage.getItem('SETTINGS_PASSPHRASE');
    if (!pass) return plain;
    const key = await deriveKey(pass);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(plain)));
    const combined = new Uint8Array(iv.byteLength + ct.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ct), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.debug('encryptValue failed', err && err.message);
    return plain;
  }
}

async function decryptValue(stored) {
  try {
    const pass = sessionStorage.getItem('SETTINGS_PASSPHRASE');
    if (!pass) return stored;
    const key = await deriveKey(pass);
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const decStr = new TextDecoder().decode(dec);
    return decStr;
  } catch (err) {
    console.debug('decryptValue failed', err && err.message);
    return stored;
  }
}

export const LocalStore = {
  list: async (category) => {
    const cats = category && SETTINGS_CATEGORIES.includes(category) ? [category] : SETTINGS_CATEGORIES;
    const out = [];
    for (const c of cats) {
      const arr = loadCategory(c);
      for (const s of arr) {
        const val = s.is_encrypted ? await decryptValue(s.value) : s.value;
        out.push({ id: s.id, key: s.key, value: val, category: c, is_encrypted: !!s.is_encrypted });
      }
    }
    return out;
  },
  object: async (category) => {
    const arr = loadCategory(category || 'general');
    const obj = {};
    for (const s of arr) {
      obj[s.key] = s.is_encrypted ? await decryptValue(s.value) : s.value;
    }
    return obj;
  },
  createOrUpdate: async ({ id, key, value, category, is_encrypted }) => {
    const cat = SETTINGS_CATEGORIES.includes(category) ? category : 'general';
    const arr = loadCategory(cat);
    let val = value;
    if (is_encrypted) val = await encryptValue(value);
    if (id) {
      const idx = arr.findIndex(s => String(s.id) === String(id));
      if (idx !== -1) {
        arr[idx] = { id, key, value: val, is_encrypted: !!is_encrypted };
        saveCategory(cat, arr);
        return true;
      }
    }
    const existing = arr.find(s => s.key === key);
    if (existing) {
      existing.value = val;
      existing.is_encrypted = !!is_encrypted;
      saveCategory(cat, arr);
      return true;
    }
    const newId = nextId(arr);
    arr.push({ id: newId, key, value: val, is_encrypted: !!is_encrypted });
    saveCategory(cat, arr);
    return true;
  },
  saveObject: async (category, settingsObj) => {
    const cat = SETTINGS_CATEGORIES.includes(category) ? category : 'general';
    const arr = [];
    for (const [k, v] of Object.entries(settingsObj || {})) {
      arr.push({ id: String(nextId(arr)), key: k, value: v, is_encrypted: false });
    }
    saveCategory(cat, arr);
    return { success: true };
  }
};

export default LocalStore;
