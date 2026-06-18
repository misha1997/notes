# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack notes application with JWT auth, file attachments, hashtags, drag-and-drop reordering, and optional Google OAuth login.

- **Frontend**: React 18 (Create React App) + React Router 7 + TailwindCSS + Framer Motion
- **Backend**: Express 4 + MySQL2 + JWT + Multer (uploads) + Helmet + express-rate-limit
- **Auth**: username/password JWT, plus optional Google Sign-In (`/api/auth/google`)

## Development Commands

### Frontend (root)

```bash
npm install
npm start          # dev server on http://localhost:3000
npm run build      # production build → build/
npm test           # react-scripts test (no test files currently exist)
```

### Backend (server/)

```bash
cd server
npm install
npm start          # node server.js (port 3001)
npm run dev        # nodemon hot reload
```

There is no test setup on the backend.

Run both simultaneously in dev: frontend on `localhost:3000`, backend on `localhost:3001`.

### Docker (full stack)

```bash
cp .env.docker.example .env.docker   # set JWT_SECRET (min 32 chars), DB creds, CLIENT_URL
docker compose --env-file .env.docker up -d --build
# app on http://localhost:8080 (FRONTEND_PORT)
docker compose --env-file .env.docker down   # add -v to drop DB volume
```

A separate `--env-file .env.docker` is used so the dev root `.env` is not overwritten. See `docker-compose.yml`, root `Dockerfile` + `nginx.conf`, `server/Dockerfile`.

## Architecture

### Frontend

- `src/App.jsx` — router with `PrivateRoute` guarding authenticated routes
- `src/context/AuthContext.jsx` — auth state, token in `localStorage` under key `token`
- `src/api.js` — single API service layer (`noteService`, `authService`, `userService`, `tagService`); every request injects `Authorization: Bearer` and `handleForbidden` clears the token + redirects to `/login` on `403`
- `src/components/TodoNotesApp.jsx` — main UI: drag-and-drop notes, sidebar tag cloud (search + sort), markdown rendering, attachments
- `src/components/Login.jsx`, `Register.jsx`, `GoogleLogin.jsx` — auth forms (there is no `TelegramLogin.jsx`)

### Backend

- `server/server.js` — single-file Express app containing all routes, DB init, middleware, validation
- `server/uploads/` — Multer upload destination (filename = `{timestamp}_{sanitized_name}`)
- Tables auto-created on startup by `initDatabase()`; migrations are done inline via `SHOW COLUMNS ... ADD COLUMN` guards (MySQL has no `ADD COLUMN IF NOT EXISTS`)

### Key flows

**API base URL**: `src/api.js` reads `process.env.REACT_APP_API_URL` (baked at build time). Unset → `http://localhost:3001` (dev). Empty string → relative paths (`/api/...`), which is what the Docker nginx setup uses to reverse-proxy to the backend. The same-origin proxy means the browser never talks to `:3001` directly in production.

**Auth**: JWT signed HS256, expires in 7d, validated by `authenticateToken` middleware. Token format checked for 3 segments before `jwt.verify`. Expired → `403`.

**Notes list is paginated**, not bulk-fetched: `GET /api/notes?limit=&offset=` (default 25, max 100). The query fetches `limit + 1` rows to detect `hasMore`. Attachments are fetched in a second query and joined in memory by `note_id`. Frontend loads more on scroll — do not assume all notes are in memory.

**Ordering**: notes are ordered `ORDER BY n.position ASC, n.timestamp DESC`. `position` is set by `PUT /api/notes/reorder` (accepts `{ noteIds }`, writes index per note in a transaction). The `position` column is auto-added on startup if missing.

**Tags**: `GET /api/tags` returns each tag with note count (`COUNT(DISTINCT n.id)`). `tag_clicks` table tracks per-user click counts (popularity). `POST /api/tags/click` upserts via `INSERT ... ON DUPLICATE KEY UPDATE click_count = click_count + 1` (`unique_user_tag` = `(user_id, tag)`). The sidebar sorts by click count → note count → alphabet (popularity mode), or alphabet (name mode).

**Attachments**: URLs are built server-side as `${proto}://${req.get('host')}/download/<filename>`, reading `X-Forwarded-Proto` and the Host header so they resolve to the public origin behind a proxy. The `/download/:filename` route sets `X-Accel-Redirect: /protected-uploads/<file>` and ends the response — nginx serves the bytes from an `internal` location backed by the shared `uploads` volume. Direct `/uploads/` is also served statically by Express (convenience/legacy). 10MB upload limit (`LIMIT_FILE_SIZE`).

**Soft deletes**: `notes` and `attachments` have `deleted_at`; every query must include `deleted_at IS NULL`. Deletes are `UPDATE ... SET deleted_at = NOW()`.

**Transactions**: multi-statement writes (create note + hashtags, reorder, update note + hashtags) use explicit `beginTransaction/commit/rollback` with `conn.release()` in `finally`.

**Security middleware**: Helmet with a CSP that whitelists `connect-src` = `REACT_APP_API_URL || http://localhost:3001`; rate limiters on `/api/auth/*` (5 / 15min) and `/api/*` (100 / min); `app.set('trust proxy', 1)` for correct client IPs behind a reverse proxy. Input validation regexes for username/email/password + `sanitizeInput` strips control chars.

## Environment Configuration

### Frontend `.env` (build-time, CRA)
```
REACT_APP_API_URL=http://localhost:3001   # unset → dev default; empty → relative paths (Docker)
REACT_APP_GOOGLE_CLIENT_ID=<optional>
```

### Backend `server/.env`
```
PORT=3001
JWT_SECRET=<min 32 chars, required — server exits without it>
DB_HOST=localhost
DB_USER=<mysql_user>
DB_PASSWORD=<mysql_password>
DB_NAME=notes_db
CLIENT_URL=http://localhost:3000          # CORS origin (defaults to localhost:3000)
GOOGLE_CLIENT_ID=<optional, for verifying Google id_token aud>
TELEGRAM_BOT_TOKEN=<read but unused — no Telegram auth route exists>
```

`JWT_SECRET` is validated at startup: missing → exit; shorter than 32 chars → exit.

## Database Schema (auto-initialized)

- `users`: id, username (unique), email (unique), password_hash, created_at, telegram_id (unique, nullable), telegram_username (nullable)
- `notes`: id, user_id (FK→users CASCADE), content (TEXT), type (`text`|`code`), timestamp, deleted_at, position (INT default 0)
- `hashtags`: id, note_id (FK→notes CASCADE), tag
- `attachments`: id, note_id (FK→notes CASCADE), filename, original_name, mime_type, size, created_at, deleted_at
- `tag_clicks`: id, user_id (FK→users CASCADE), tag, click_count, updated_at, UNIQUE(user_id, tag)

## Important Implementation Notes

- **Single-file backend**: all routes, schema, and middleware live in `server/server.js`. There is no routing module split — add new endpoints there.
- **No migration system**: schema evolution is inline `SHOW COLUMNS` + `ALTER TABLE ADD COLUMN` guarded blocks inside `initDatabase()`. Mirror that pattern when adding columns; don't introduce a migration framework unless asked.
- **CSP coupling**: Helmet's `connect-src` is derived from `REACT_APP_API_URL`. If you change the API base for a deployment, the backend's CSP must allow it (or use the relative/empty value so `connect-src` falls back to `'self'`).
- **`position` column**: required by `/api/notes` ordering and `/api/notes/reorder`, auto-created on startup if absent. Don't remove the `ORDER BY n.position` without also reworking reorder.
- **`tag_clicks` popularity**: the frontend's "popular" sort depends on click counts recorded via `/api/tags/click`. Search-only or never-clicked tags fall through to note-count then alphabetical.
- **`TELEGRAM_BOT_TOKEN`** is read from env but no Telegram auth endpoint is implemented; do not assume Telegram login works without adding it.