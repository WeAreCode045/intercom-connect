const API_ROOT = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:4000';

async function postJson(path, body) {
	const res = await fetch(`${API_ROOT}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
	const data = await res.json();
	return { data };
}

export const fetchEmails = (opts) => postJson('/api/fetch-emails', opts);
export const fetchEmailMessage = (opts) => postJson('/api/fetch-email-message', opts);
export const fetchEmailMessages = (opts) => postJson('/api/fetch-email-messages', opts);
export const processEmail = (opts) => postJson('/api/process-email', opts);
export const testImapConnection = (opts) => postJson('/api/test-imap-connection', opts);
export const testIntercomConnection = (opts) => Promise.resolve({ data: { success: false, error: 'not implemented' } });
export const testMailAccount = (opts) => Promise.resolve({ data: { success: false, error: 'not implemented' } });
export const runAutomatedCheck = (opts) => Promise.resolve({ data: { success: false, error: 'not implemented' } });
export const syncConversations = (opts) => Promise.resolve({ data: { success: false, error: 'not implemented' } });
export const findUnlinkedCases = (opts) => Promise.resolve({ data: { success: false, error: 'not implemented' } });
export const linkCaseToConversation = (opts) => Promise.resolve({ data: { success: false, error: 'not implemented' } });
export const receiveEmailData = (opts) => Promise.resolve({ data: { success: false, error: 'not implemented' } });
export const getStoredEmails = (opts) => postJson('/api/stored-emails', opts);
export const markProcessed = (opts) => postJson('/api/mark-processed', opts);

