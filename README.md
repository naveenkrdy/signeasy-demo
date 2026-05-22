# Signeasy eSignature Demo

A small single-page demo that exercises the [Signeasy v3 API](https://docs.signeasy.com/) end to end:

1. Upload a document.
2. Send it to one signer (name + email).
3. Watch the signature request status (`sent` → `viewed` → `signed`).
4. Download the signed PDF.

## Architecture

```
React SPA (Vite, :5173)  ──/api──▶  Express backend (:3001)  ──Bearer──▶  Signeasy API v3
                                       │
                                       └─ OAuth client_credentials token cache (auto-refresh)
```

The browser never sees the Signeasy `client_id` / `client_secret`. The backend exchanges them for an access token (`POST https://auth.signeasy.com/oauth/token`), caches it in memory (Signeasy issues 30-day tokens), and re-uses it for every Signeasy call. On a 401 it transparently refreshes once and retries.

## Setup

```bash
# 1. From the repo root, create your env file (gitignored):
cp .env.example .env
# then edit .env and paste your SIGNEASY_CLIENT_ID and SIGNEASY_CLIENT_SECRET

# 2. Install + start the backend (terminal 1):
cd server
npm install
npm start                  # listens on http://localhost:3001

# 3. Install + start the frontend (terminal 2):
cd client
npm install
npm run dev                # opens http://localhost:5173
```

Open <http://localhost:5173> and run through the four steps. The backend logs each new token exchange and surfaces Signeasy errors verbatim if something fails.

Use your own document or the provided sample_doc.pdf to test.

