const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const api = 'http://localhost:3001';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Validate required environment variables
if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is not set in environment variables');
    process.exit(1);
}

if (JWT_SECRET.length < 32) {
    console.error('ERROR: JWT_SECRET should be at least 32 characters long');
    process.exit(1);
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", process.env.REACT_APP_API_URL || "http://localhost:3001"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // 5 попыток
    message: { error: 'Слишком много попыток, попробуйте позже' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 100, // 100 запросов в минуту
    message: { error: 'Превышен лимит запросов' },
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 загрузок файлов в минуту
    message: { error: 'Слишком много загрузок файлов' },
});

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// Apply rate limiting
app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);
app.use('/api/notes/:id/attachments', uploadLimiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/download/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);

    res.setHeader('X-Accel-Redirect', `/protected-uploads/${filename}`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    res.status(200).end();
});

// Настройка хранения файлов
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsDir),
    filename: (_, file, cb) => {
        const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const safeName = decodedName.replace(/\s+/g, '_');
        cb(null, `${Date.now()}_${safeName}`);
    }
});

// File type whitelist
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'text/plain', 'text/markdown', 'text/csv',
    'application/pdf', 'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
    'application/zip', 'application/x-zip-compressed',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/ogg'
];

const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|txt|md|csv|pdf|json|docx|xlsx|pptx|zip|mp3|wav|ogg|webm|mp4)$/i;

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимый тип файла'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// Инициализация БД
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

        // Дополнительные поля для Telegram (MySQL < 8: нет IF NOT EXISTS для ADD COLUMN)
        const [tgIdCol] = await connection.query(`SHOW COLUMNS FROM users LIKE 'telegram_id'`);
        if (tgIdCol.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN telegram_id BIGINT UNIQUE NULL`);
        }
        const [tgUserCol] = await connection.query(`SHOW COLUMNS FROM users LIKE 'telegram_username'`);
        if (tgUserCol.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN telegram_username VARCHAR(50) NULL`);
        }

        await connection.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        type ENUM('text', 'code') DEFAULT 'text',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

        await connection.query(`
      CREATE TABLE IF NOT EXISTS hashtags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        note_id INT NOT NULL,
        tag VARCHAR(100) NOT NULL,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

        await connection.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        note_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

        const [noteDeletedCol] = await connection.query(`SHOW COLUMNS FROM notes LIKE 'deleted_at'`);
        if (noteDeletedCol.length === 0) {
            await connection.query(`ALTER TABLE notes ADD COLUMN deleted_at DATETIME NULL`);
        }
        const [attachmentDeletedCol] = await connection.query(`SHOW COLUMNS FROM attachments LIKE 'deleted_at'`);
        if (attachmentDeletedCol.length === 0) {
            await connection.query(`ALTER TABLE attachments ADD COLUMN deleted_at DATETIME NULL`);
        }

        connection.release();
        console.log('✅ База данных готова');
    } catch (err) {
        console.error('❌ Ошибка БД:', err.message);
        process.exit(1);
    }
}

// Middleware защиты роутов
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Доступ запрещен' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.split('.').length !== 3) {
        return res.status(401).json({ error: 'Невалидный формат токена' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ error: 'Токен истёк' });
            }
            return res.status(403).json({ error: 'Токен невалиден' });
        }
        req.user = user;
        next();
    });
}

// --- INPUT VALIDATION ---

const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
};

const validatePassword = (password) => {
    // Минимум 8 символов, хотя бы одна буква и одна цифра
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
};

const sanitizeInput = (input) => {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
};

// --- AUTH ---

app.post('/api/auth/register', async (req, res) => {
    try {
        let { username, email, password } = req.body;

        // Sanitize inputs
        username = sanitizeInput(username);
        email = sanitizeInput(email);

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        if (!validateUsername(username)) {
            return res.status(400).json({ error: 'Имя пользователя: 3-30 символов, только буквы, цифры и подчёркивание' });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Некорректный email' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов, включая буквы и цифры' });
        }
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, hash]
        );
        const token = jwt.sign({ id: result.insertId, username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { username, email } });
    } catch (err) {
        res.status(400).json({ error: 'Пользователь уже существует' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    let { login, password } = req.body;

    login = sanitizeInput(login);
    password = sanitizeInput(password);

    if (!login || !password) {
        return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    // Дополнительная защита от инъекций
    if (login.length > 100 || password.length > 100) {
        return res.status(400).json({ error: 'Слишком длинные данные' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [login, login]);
    const user = users[0];

    if (user && await bcrypt.compare(password, user.password_hash)) {
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } else {
        res.status(401).json({ error: 'Неверные данные' });
    }
});

// Google OAuth
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Нет токена Google' });

        // Проверяем токен через Google API
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (!response.ok) {
            return res.status(401).json({ error: 'Невалидный токен Google' });
        }

        const googleData = await response.json();

        // Проверяем client_id если задан в env
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (googleClientId && googleClientId !== 'your_google_client_id.apps.googleusercontent.com') {
            if (googleData.aud !== googleClientId) {
                return res.status(401).json({ error: 'Неверный client_id' });
            }
        }

        // Проверяем что email подтвержден
        if (!googleData.email_verified) {
            return res.status(401).json({ error: 'Email не подтвержден' });
        }

        const email = googleData.email;
        const name = googleData.name || email.split('@')[0];

        // Ищем или создаем пользователя
        const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        let user = existing[0];

        if (!user) {
            // Создаем нового пользователя
            const username = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
            const randomPass = crypto.randomBytes(16).toString('hex');
            const passwordHash = await bcrypt.hash(randomPass, SALT_ROUNDS);

            const [result] = await pool.query(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                [username, email, passwordHash]
            );

            user = {
                id: result.insertId,
                username,
                email
            };
        }

        // Генерируем JWT
        const jwtToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token: jwtToken, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
        console.error('Google auth error:', err);
        res.status(500).json({ error: 'Ошибка при авторизации через Google' });
    }
});

// --- USER ---

// Получение данных пользователя
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, username, email, telegram_username, telegram_id FROM users WHERE id = ?',
            [req.user.id]
        );
        if (users.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(users[0]);
    } catch (err) {
        console.error('Get user profile error:', err);
        res.status(500).json({ error: 'Ошибка при получении профиля' });
    }
});

// Обновление данных пользователя
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        let { email, currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Sanitize
        email = sanitizeInput(email);
        if (currentPassword) currentPassword = sanitizeInput(currentPassword);
        if (newPassword) newPassword = sanitizeInput(newPassword);

        // Validate email if provided
        if (email && !validateEmail(email)) {
            return res.status(400).json({ error: 'Некорректный email' });
        }

        // Validate new password if provided
        if (newPassword && !validatePassword(newPassword)) {
            return res.status(400).json({ error: 'Новый пароль должен содержать минимум 8 символов, включая буквы и цифры' });
        }

        // Проверяем, существует ли пользователь
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = users[0];
        const updates = [];
        const values = [];

        // Проверяем и обновляем пароль если передан
        if (currentPassword && newPassword) {
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isPasswordValid) {
                return res.status(400).json({ error: 'Текущий пароль неверен' });
            }
            const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
            updates.push('password_hash = ?');
            values.push(newPasswordHash);
        }

        // Обновляем email если передан и отличается
        if (email && email !== user.email) {
            // Проверяем, не занят ли email другим пользователем
            const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (existingUsers.length > 0) {
                return res.status(400).json({ error: 'Этот email уже используется' });
            }
            updates.push('email = ?');
            values.push(email);
        }

        if (updates.length > 0) {
            values.push(userId);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        // Возвращаем обновленные данные
        const [updatedUsers] = await pool.query(
            'SELECT id, username, email FROM users WHERE id = ?',
            [userId]
        );
        res.json(updatedUsers[0]);
    } catch (err) {
        console.error('Update user profile error:', err);
        res.status(500).json({ error: 'Ошибка при обновлении профиля' });
    }
});

// --- NOTES ---

app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        const limitValue = Number.parseInt(req.query.limit, 10);
        const offsetValue = Number.parseInt(req.query.offset, 10);
        const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 25;
        const offset = Number.isFinite(offsetValue) && offsetValue >= 0 ? offsetValue : 0;
        const limitPlus = limit + 1;

        const [rows] = await pool.query(`
      SELECT n.*, GROUP_CONCAT(h.tag) as hashtags 
      FROM notes n 
      LEFT JOIN hashtags h ON n.id = h.note_id 
      WHERE n.user_id = ? AND n.deleted_at IS NULL
      GROUP BY n.id 
      ORDER BY n.position ASC, n.timestamp DESC
      LIMIT ? OFFSET ?`, [req.user.id, limitPlus, offset]);

        const hasMore = rows.length > limit;
        const slicedRows = rows.slice(0, limit);
        const noteIds = slicedRows.map(n => n.id);
        let attachmentsMap = {};

        if (noteIds.length) {
            const [attachmentRows] = await pool.query(`
        SELECT a.* FROM attachments a
        JOIN notes n ON a.note_id = n.id
        WHERE n.user_id = ? AND a.note_id IN (?) AND a.deleted_at IS NULL AND n.deleted_at IS NULL
      `, [req.user.id, noteIds]);

            attachmentsMap = attachmentRows.reduce((acc, att) => {
                const proto = req.headers['x-forwarded-proto'] || req.protocol;
                const dto = {
                    id: att.id,
                    noteId: att.note_id,
                    filename: att.filename,
                    originalName: att.original_name,
                    mimeType: att.mime_type,
                    size: att.size,
                    url: `${proto}://${req.get('host')}/download/${encodeURIComponent(att.filename)}`
                };
                if (!acc[att.note_id]) acc[att.note_id] = [];
                acc[att.note_id].push(dto);
                return acc;
            }, {});
        }

        const notes = slicedRows.map(n => ({
            ...n,
            hashtags: n.hashtags ? n.hashtags.split(',') : [],
            attachments: attachmentsMap[n.id] || []
        }));
        res.json({ notes, hasMore });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение общего количества заметок пользователя
app.get('/api/notes/count', authenticateToken, async (req, res) => {
    try {
        const [result] = await pool.query(
            'SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND deleted_at IS NULL',
            [req.user.id]
        );
        res.json({ total: result[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notes', authenticateToken, async (req, res) => {
    const { content, type, hashtags } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query('INSERT INTO notes (user_id, content, type) VALUES (?, ?, ?)', [req.user.id, content, type]);
        const noteId = result.insertId;

        if (hashtags?.length) {
            const values = hashtags.map(tag => [noteId, tag]);
            await conn.query('INSERT INTO hashtags (note_id, tag) VALUES ?', [values]);
        }
        await conn.commit();
        res.status(201).json({ id: noteId, content, type, hashtags, attachments: [] });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.put('/api/notes/reorder', authenticateToken, async (req, res) => {
    const { noteIds } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Обновляем позицию для каждой заметки
        const queries = noteIds.map((id, index) =>
            conn.query('UPDATE notes SET position = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [index, id, req.user.id])
        );

        await Promise.all(queries);
        await conn.commit();
        res.json({ message: 'Порядок обновлен' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.put('/api/notes/:id', authenticateToken, async (req, res) => {
    const { content, type, hashtags } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('UPDATE notes SET content = ?, type = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [content, type, req.params.id, req.user.id]);
        await conn.query('DELETE FROM hashtags WHERE note_id = ?', [req.params.id]);

        if (hashtags?.length) {
            const values = hashtags.map(tag => [req.params.id, tag]);
            await conn.query('INSERT INTO hashtags (note_id, tag) VALUES ?', [values]);
        }
        await conn.commit();
        res.json({ message: 'Обновлено' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.post('/api/notes/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
    const noteId = req.params.id;
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не найден' });
    }

    const [notes] = await pool.query('SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [noteId, req.user.id]);
    if (!notes.length) {
        fs.unlink(path.join(uploadsDir, req.file.filename), () => { });
        return res.status(404).json({ error: 'Заметка не найдена' });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const decodedOriginalName = Buffer.from(originalname, 'latin1').toString('utf8');
    const [result] = await pool.query(
        'INSERT INTO attachments (note_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
        [noteId, filename, decodedOriginalName, mimetype, size]
    );

    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const attachment = {
        id: result.insertId,
        noteId: Number(noteId),
        filename,
        originalName: decodedOriginalName,
        mimeType: mimetype,
        size,
        url: `${proto}://${req.get('host')}/download/${encodeURIComponent(filename)}`
    };

    res.status(201).json(attachment);
});

app.delete('/api/notes/:noteId/attachments/:attachmentId', authenticateToken, async (req, res) => {
    const { noteId, attachmentId } = req.params;
    const [rows] = await pool.query(`
    SELECT a.* FROM attachments a
    JOIN notes n ON a.note_id = n.id
    WHERE a.id = ? AND a.note_id = ? AND n.user_id = ? AND a.deleted_at IS NULL AND n.deleted_at IS NULL
  `, [attachmentId, noteId, req.user.id]);

    const attachment = rows[0];
    if (!attachment) {
        return res.status(404).json({ error: 'Файл не найден' });
    }

    await pool.query('UPDATE attachments SET deleted_at = NOW() WHERE id = ?', [attachmentId]);
    res.json({ message: 'Вложение удалено' });
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
    await pool.query('UPDATE notes SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [req.params.id, req.user.id]);
    await pool.query('UPDATE attachments SET deleted_at = NOW() WHERE note_id = ? AND deleted_at IS NULL', [req.params.id]);
    res.json({ message: 'Удалено' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Файл слишком большой (макс. 10MB)' });
        }
        return res.status(400).json({ error: 'Ошибка загрузки файла' });
    }

    // File type error
    if (err.message === 'Недопустимый тип файла') {
        return res.status(400).json({ error: 'Недопустимый тип файла' });
    }

    // Generic error
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

initDatabase().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
});
