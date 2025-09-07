import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// When developing locally we may want to avoid the SDK's auth redirect to
// base44.com. Use VITE_USE_LOCAL_API=true to disable requiresAuth and point
// the SDK at a local server.
const USE_LOCAL = import.meta.env.VITE_USE_LOCAL_API === 'true';

export const base44 = createClient({
  appId: "68bb869b5569b72db637ed3d",
  // disable auth redirects in local dev
  requiresAuth: !USE_LOCAL,
  // allow overriding the API url for the SDK in local dev (if supported)
  baseUrl: USE_LOCAL ? (import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:4000') : undefined,
});
