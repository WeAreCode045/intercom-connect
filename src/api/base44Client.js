// Minimal local client stub for when @base44/sdk is not available in this environment.
// This provides the small surface the app expects: entities, functions, integrations, auth.
export const base44 = {
  entities: {
    Setting: {},
    EmailLog: {},
    ConversationStatus: {},
    UnlinkedCase: {},
  },
  functions: {},
  integrations: { Core: {} },
  auth: {},
};
