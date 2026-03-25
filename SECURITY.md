# Security Features

## Implemented Security Measures

### 1. Rate Limiting
- **Auth endpoints**: 5 attempts per 15 minutes (brute-force protection)
- **API endpoints**: 100 requests per minute
- **File uploads**: 10 uploads per minute

### 2. Input Validation & Sanitization
- All user inputs are sanitized to remove control characters
- Email validation with regex
- Username: 3-30 chars, alphanumeric + underscore only
- Password: min 8 chars, must contain letters AND numbers
- SQL injection protection via parameterized queries (mysql2)

### 3. Authentication & JWT
- JWT tokens expire after 7 days
- Only HS256 algorithm accepted
- Token format validation (3 parts)
- Bearer prefix required
- JWT_SECRET must be at least 32 chars

### 4. File Upload Security
- MIME type whitelist (images, documents, audio, video)
- Extension whitelist check
- 10MB file size limit
- Secure filename generation with timestamp prefix
- Path traversal protection (`path.basename()`)

### 5. Helmet Security Headers
- Content Security Policy (CSP)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options
- Referrer Policy

### 6. CORS
- Restricted to specific origin (CLIENT_URL)
- Credentials enabled only for trusted origins

### 7. Error Handling
- Generic error messages for users
- Detailed logging on server only
- 404 handler for unknown routes
- Multer error handling

### 8. Password Security
- bcrypt with salt rounds: 10
- Password verification required for profile changes
- Current password required before setting new password
- Secure comparison to prevent timing attacks

## Environment Variables Required

```env
PORT=3001
JWT_SECRET=<minimum_32_random_characters>
DB_HOST=localhost
DB_USER=<db_user>
DB_PASSWORD=<db_password>
DB_NAME=notes_db
CLIENT_URL=http://localhost:3000
REACT_APP_API_URL=http://localhost:3001
```

## Security Checklist for Production

- [ ] Use HTTPS (required for HSTS)
- [ ] Set strong JWT_SECRET (32+ random chars)
- [ ] Restrict CORS origin to actual domain
- [ ] Enable database SSL connections
- [ ] Set up fail2ban for SSH/server access
- [ ] Regular dependency updates (`npm audit fix`)
- [ ] Database backups encrypted
- [ ] Server behind reverse proxy (nginx)
- [ ] Disable server version headers
- [ ] Set secure cookie flags (if using cookies)
