# Intercom Connect

Vite + React frontend with a small Express backend for IMAP/Intercom integration.

## Running the app (development)

This repository now contains a frontend built with Vite. Run the dev server with the standard Vite command:

```bash
npm install
npm run dev
```

For production, build and preview the static site:

```bash
npm run build
npm run start
```

Notes

- This is a frontend-focused repository. Any previous backend (Express/IMAP) was removed to simplify development and avoid native build issues.
- If you need remote sync or IMAP fetching, consider running a separate service or re-adding a server component.

## Building (production)

```bash
npm run build
npm start
```