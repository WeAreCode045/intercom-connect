# Mail-sync Server

Small server for fetching IMAP messages for the local frontend.

Setup

1. Install dependencies

```bash
cd server
npm install
```

2. Copy the example env and set IMAP credentials

```bash
cp .env.example .env
# edit .env
```

3. Start server

```bash
npm start
```

Endpoints

- POST /api/fetch-emails { includeBody?: boolean }
- POST /api/fetch-email-messages { emailIds: string[] }
- POST /api/fetch-email-message { emailId: string }
- POST /api/process-email { email }

Notes

- This server uses a single IMAP account configured via env vars. For multiple accounts, implement a credential store and pass account identifiers to endpoints.
- Use `VITE_USE_LOCAL_API=true` in the frontend to direct API calls to this server.
