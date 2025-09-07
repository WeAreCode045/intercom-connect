import { LocalStore } from './localStore';

const API_ROOT = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:4000';
const OFFLINE_MODE = import.meta.env.VITE_OFFLINE_MODE === 'true';

async function postJson(path, body) {
	const res = await fetch(`${API_ROOT}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
	return res.json();
}

async function getJson(path) {
	if (OFFLINE_MODE) throw new Error('offline mode');
	const res = await fetch(`${API_ROOT}${path}`);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

export const Setting = {
	list: async () => {
		if (OFFLINE_MODE) return await LocalStore.list();
		try {
			const r = await getJson('/api/settings');
			return r.settings || [];
		} catch (err) {
			console.debug('remote settings.list failed, falling back to LocalStore', err && err.message);
			return await LocalStore.list();
		}
	},
	create: async (data) => {
		if (data && data.category) return postJson(`/api/settings/${data.category}`, data);
		return postJson('/api/settings', data);
	},
	update: async (id, data) => {
		if (data && data.category) return postJson(`/api/settings/${data.category}`, { id, ...data });
		return postJson('/api/settings', { id, ...data });
	},
	// fetch settings as a key->value object
	object: async (category) => {
		if (OFFLINE_MODE) return await LocalStore.object(category);
		try {
			const r = await getJson(`/api/settings/${category}/object`);
			return r.settings || {};
		} catch (err) {
			console.debug('remote settings.object failed, falling back to LocalStore', err && err.message);
			return await LocalStore.object(category);
		}
	},
	// save a whole object of settings to a category
	saveObject: async (category, settingsObj) => {
		if (OFFLINE_MODE) return await LocalStore.saveObject(category, settingsObj);
		try {
			return await postJson(`/api/settings/${category}/bulk`, { settings: settingsObj });
		} catch (err) {
			console.debug('remote settings.saveObject failed, falling back to LocalStore', err && err.message);
			return await LocalStore.saveObject(category, settingsObj);
		}
	}
};

export const EmailLog = {
	list: async () => {
		if (OFFLINE_MODE) {
			// LocalStore does not maintain emails; fallback to empty list
			return [];
		}
		try {
			const r = await getJson('/api/stored-emails');
			return r.emails || [];
		} catch (err) {
			console.debug('remote stored-emails failed', err && err.message);
			return [];
		}
	}
};

export const ConversationStatus = {};
export const UnlinkedCase = {};
export const User = {};