const API_ROOT = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:4000';

async function postJson(path, body) {
	const res = await fetch(`${API_ROOT}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
	return res.json();
}

async function getJson(path) {
	const res = await fetch(`${API_ROOT}${path}`);
	return res.json();
}

export const Setting = {
	list: async () => {
		const r = await getJson('/api/settings');
		return r.settings || [];
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
		const r = await getJson(`/api/settings/${category}/object`);
		return r.settings || {};
	},
	// save a whole object of settings to a category
	saveObject: async (category, settingsObj) => {
		return postJson(`/api/settings/${category}/bulk`, { settings: settingsObj });
	}
};

export const EmailLog = {
	list: async () => {
		const r = await getJson('/api/stored-emails');
		return r.emails || [];
	}
};

export const ConversationStatus = {};
export const UnlinkedCase = {};
export const User = {};