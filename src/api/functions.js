import { base44 } from './base44Client';

const USE_LOCAL = import.meta.env.VITE_USE_LOCAL_API === 'true';

async function postJson(path, body) {
	const res = await fetch(`${import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:4000'}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body || {}),
	});
	const data = await res.json();
	return { data };
}

// Helper to safely call SDK functions when present
const sdkCall = (name) => {
	return (...args) => {
		if (base44 && base44.functions && typeof base44.functions[name] === 'function') {
			return base44.functions[name](...args);
		}
		return Promise.resolve({ data: { success: false, error: `${name} not available` } });
	};
};

export const fetchEmails = USE_LOCAL ? (opts) => postJson('/api/fetch-emails', opts) : sdkCall('fetchEmails');

export const fetchEmailMessage = USE_LOCAL ? (opts) => postJson('/api/fetch-email-message', opts) : sdkCall('fetchEmailMessage');

export const fetchEmailMessages = USE_LOCAL ? (opts) => postJson('/api/fetch-email-messages', opts) : sdkCall('fetchEmailMessages');

export const processEmail = USE_LOCAL ? (opts) => postJson('/api/process-email', opts) : sdkCall('processEmail');

export const testImapConnection = USE_LOCAL ? (opts) => postJson('/api/test-imap-connection', opts) : sdkCall('testImapConnection');

export const testIntercomConnection = sdkCall('testIntercomConnection');

export const testMailAccount = sdkCall('testMailAccount');

export const runAutomatedCheck = sdkCall('runAutomatedCheck');

export const syncConversations = sdkCall('syncConversations');

export const findUnlinkedCases = sdkCall('findUnlinkedCases');

export const linkCaseToConversation = sdkCall('linkCaseToConversation');

export const receiveEmailData = sdkCall('receiveEmailData');

export const getStoredEmails = USE_LOCAL ? (opts) => postJson('/api/stored-emails', opts) : sdkCall('getStoredEmails');

export const markProcessed = USE_LOCAL ? (opts) => postJson('/api/mark-processed', opts) : sdkCall('markProcessed');

