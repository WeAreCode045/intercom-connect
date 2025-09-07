# Intercom Connect

Vite + React frontend with a small Express backend for IMAP/Intercom integration.

## Running the app (development)

All dependencies are consolidated in the repository root. Use the single dev command to start both the backend (Express) and the frontend (Vite middleware).

```bash
npm install
npm run dev
```

Environment variables

Create a `.env` in the repository root (or set environment variables in your shell). Important variables:

- `PORT` - server port (default: 4000)
- `SETTINGS_SECRET` - AES-256-GCM key used to encrypt sensitive settings (required for encrypted fields)
- IMAP credentials when using IMAP endpoints:
	- `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_SECURE`

Notes

- The server exposes API routes under `/api/*` and serves the frontend via Vite in development or the built `dist/` in production.
- Use `npm run build` then `npm start` to serve the built frontend in production mode.

## Building (production)

```bash
npm run build
npm start
```