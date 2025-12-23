const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

app.use(cors());
app.use(express.json()); // Встроенный аналог bodyParser
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Настройка хранения файлов
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsDir),
    filename: (_, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${Date.now()}_${safeName}`);
    }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB limit

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
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

        connection.release();
        console.log('✅ База данных готова');
    } catch (err) {
        console.error('❌ Ошибка БД:', err.message);
        process.exit(1);
    }
}

// Middleware защиты роутов
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Доступ запрещен' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Токен невалиден' });
        req.user = user;
        next();
    });
}

function verifyTelegramData(data) {
    if (!TELEGRAM_BOT_TOKEN) return null;
    const { hash, ...rest } = data;
    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const dataCheckString = Object.keys(rest)
        .sort()
        .map(key => `${key}=${rest[key]}`)
        .join('\n');
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (hmac === hash) return rest;
    return null;
}

// --- AUTH ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
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
    const { login, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [login, login]);
    const user = users[0];

    if (user && await bcrypt.compare(password, user.password_hash)) {
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } else {
        res.status(401).json({ error: 'Неверные данные' });
    }
});

app.post('/api/auth/telegram', async (req, res) => {
    try {
        if (!TELEGRAM_BOT_TOKEN) {
            return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN не задан' });
        }

        const telegramData = req.body.telegramData;
        if (!telegramData) return res.status(400).json({ error: 'Нет данных Telegram' });

        const verified = verifyTelegramData(telegramData);
        if (!verified) return res.status(403).json({ error: 'Подпись Telegram невалидна' });

        const tgId = verified.id;
        const tgUsername = verified.username || `tg_${tgId}`;
        const tgEmail = `${tgId}@telegram.local`;
        const randomPass = crypto.randomBytes(16).toString('hex');
        const randomHash = await bcrypt.hash(randomPass, SALT_ROUNDS);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [existing] = await conn.query('SELECT * FROM users WHERE telegram_id = ?', [tgId]);
            let userRow = existing[0];

            if (!userRow) {
                // Пытаемся занять уникальный username
                let finalUsername = tgUsername;
                let suffix = 1;
                while (true) {
                    const [check] = await conn.query('SELECT id FROM users WHERE username = ?', [finalUsername]);
                    if (check.length === 0) break;
                    finalUsername = `${tgUsername}_${suffix}`;
                    suffix += 1;
                }

                const [result] = await conn.query(
                    'INSERT INTO users (username, email, password_hash, telegram_id, telegram_username) VALUES (?, ?, ?, ?, ?)',
                    [finalUsername, tgEmail, randomHash, tgId, tgUsername]
                );

                userRow = {
                    id: result.insertId,
                    username: finalUsername,
                    email: tgEmail
                };
            }

            await conn.commit();

            const token = jwt.sign({ id: userRow.id, username: userRow.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user: { id: userRow.id, username: userRow.username, email: userRow.email } });
        } catch (err) {
            await conn.rollback();
            res.status(500).json({ error: err.message });
        } finally {
            conn.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- NOTES ---

app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
      SELECT n.*, GROUP_CONCAT(h.tag) as hashtags 
      FROM notes n 
      LEFT JOIN hashtags h ON n.id = h.note_id 
      WHERE n.user_id = ? 
      GROUP BY n.id 
      ORDER BY n.position ASC, n.timestamp DESC`, [req.user.id]);

        const noteIds = rows.map(n => n.id);
        let attachmentsMap = {};

        if (noteIds.length) {
            const [attachmentRows] = await pool.query(`
        SELECT a.* FROM attachments a
        JOIN notes n ON a.note_id = n.id
        WHERE n.user_id = ? AND a.note_id IN (?)
      `, [req.user.id, noteIds]);

            attachmentsMap = attachmentRows.reduce((acc, att) => {
                const dto = {
                    id: att.id,
                    noteId: att.note_id,
                    filename: att.filename,
                    originalName: att.original_name,
                    mimeType: att.mime_type,
                    size: att.size,
                    url: `${req.protocol}://${req.get('host')}/uploads/${att.filename}`
                };
                if (!acc[att.note_id]) acc[att.note_id] = [];
                acc[att.note_id].push(dto);
                return acc;
            }, {});
        }

        const notes = rows.map(n => ({
            ...n,
            hashtags: n.hashtags ? n.hashtags.split(',') : [],
            attachments: attachmentsMap[n.id] || []
        }));
        res.json(notes);
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
            conn.query('UPDATE notes SET position = ? WHERE id = ? AND user_id = ?', [index, id, req.user.id])
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
        await conn.query('UPDATE notes SET content = ?, type = ? WHERE id = ? AND user_id = ?', [content, type, req.params.id, req.user.id]);
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

    const [notes] = await pool.query('SELECT id FROM notes WHERE id = ? AND user_id = ?', [noteId, req.user.id]);
    if (!notes.length) {
        fs.unlink(path.join(uploadsDir, req.file.filename), () => {});
        return res.status(404).json({ error: 'Заметка не найдена' });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const [result] = await pool.query(
        'INSERT INTO attachments (note_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
        [noteId, filename, originalname, mimetype, size]
    );

    const attachment = {
        id: result.insertId,
        noteId: Number(noteId),
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
        url: `${req.protocol}://${req.get('host')}/uploads/${filename}`
    };

    res.status(201).json(attachment);
});

app.delete('/api/notes/:noteId/attachments/:attachmentId', authenticateToken, async (req, res) => {
    const { noteId, attachmentId } = req.params;
    const [rows] = await pool.query(`
    SELECT a.* FROM attachments a
    JOIN notes n ON a.note_id = n.id
    WHERE a.id = ? AND a.note_id = ? AND n.user_id = ?
  `, [attachmentId, noteId, req.user.id]);

    const attachment = rows[0];
    if (!attachment) {
        return res.status(404).json({ error: 'Файл не найден' });
    }

    const filePath = path.join(uploadsDir, attachment.filename);
    fs.promises.unlink(filePath).catch(() => {});

    await pool.query('DELETE FROM attachments WHERE id = ?', [attachmentId]);
    res.json({ message: 'Вложение удалено' });
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
    const [attachments] = await pool.query(`
    SELECT a.filename FROM attachments a
    JOIN notes n ON a.note_id = n.id
    WHERE n.id = ? AND n.user_id = ?
  `, [req.params.id, req.user.id]);

    attachments.forEach(att => {
        const filePath = path.join(uploadsDir, att.filename);
        fs.promises.unlink(filePath).catch(() => {});
    });

    await pool.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Удалено' });
});

initDatabase().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
});