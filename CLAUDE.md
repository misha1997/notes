# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack notes application with JWT authentication, file attachments, hashtag support, and Telegram login.

- **Frontend**: React 18 + React Router 7 + TailwindCSS + Framer Motion
- **Backend**: Express 4 + MySQL2 + JWT + Multer (file uploads)
- **Authentication**: JWT-based with username/password and optional Telegram login

## Development Commands

### Root (Frontend)

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm start

# Build for production
npm run build

# Run tests
npm test
```

### Server (Backend)

```bash
cd server/

# Install dependencies
npm install

# Start production server
npm start

# Start development server with hot reload
npm run dev
```

### Running Both

The frontend runs on `localhost:3000` and expects the backend at `localhost:3001`. Run both simultaneously during development.

## Architecture

### Frontend Structure

- `src/App.jsx` - Main router with PrivateRoute protection
- `src/context/AuthContext.jsx` - Authentication state management
- `src/api.js` - API service layer (noteService, authService)
- `src/components/TodoNotesApp.jsx` - Main notes UI with drag-and-drop
- `src/components/Login.jsx` / `Register.jsx` - Auth forms
- `src/components/TelegramLogin.jsx` - Telegram widget integration

### Backend Structure

- `server/server.js` - Single-file Express app with all routes
- `server/uploads/` - File upload storage directory
- Database tables: `users`, `notes`, `hashtags`, `attachments`

### Key Design Patterns

**API Layer**: All HTTP requests go through `src/api.js`. Services handle token management automatically via `localStorage` and redirect to `/login` on 403 responses.

**Authentication Flow**:
- JWT token stored in `localStorage` under key `token`
- Token automatically included in all API requests via `Authorization: Bearer` header
- AuthContext checks for token on app load
- Server validates JWT on protected routes via `authenticateToken` middleware

**Note Features**:
- Soft delete via `deleted_at` column (not hard deletion)
- Drag-and-drop reordering with `position` column
- Two types: `text` and `code`
- Hashtags stored in separate table with `note_id` FK
- Attachments stored with original filename preserved

**File Handling**:
- Multer stores files in `server/uploads/`
- Filenames prefixed with timestamp: `{timestamp}_{sanitized_original_name}`
- Download via `/download/:filename` endpoint (not direct file access)
- 10MB file size limit

## Environment Configuration

### Root `.env`
None required for frontend (defaults to localhost:3001 for API).

### Server `.env`
```
PORT=3001
JWT_SECRET=<random_secret>
DB_HOST=localhost
DB_USER=<mysql_user>
DB_PASSWORD=<mysql_password>
DB_NAME=notes_db
TELEGRAM_BOT_TOKEN=<optional_for_tg_login>
```

## Database Schema

The server auto-initializes tables on startup via `initDatabase()`:
- `users`: id, username, email, password_hash, telegram_id, telegram_username
- `notes`: id, user_id, content, type (text|code), timestamp, deleted_at, position
- `hashtags`: id, note_id, tag
- `attachments`: id, note_id, filename, original_name, mime_type, size, created_at, deleted_at

## Important Implementation Notes

**Frontend-Backend Coupling**: The frontend API layer (`src/api.js`) hardcodes `const api = 'http://localhost:3001'`. This must match the server port.

**Upload Security**: Files are served via `/download/:filename` with auth headers checked. Direct `/uploads/` access is static but should be protected in production.

**Telegram Login**: Requires `TELEGRAM_BOT_TOKEN` env var. Uses HMAC-SHA256 verification of Telegram widget data.

**Soft Deletes**: Notes and attachments use `deleted_at` timestamps for deletion. The `deleted_at IS NULL` check is required in all queries.

**Transaction Safety**: All multi-query operations (create note with hashtags, reorder, etc.) use explicit `beginTransaction/commit/rollback`.
