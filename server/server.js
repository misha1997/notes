const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json()); // Встроенный аналог bodyParser

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

        const notes = rows.map(n => ({ ...n, hashtags: n.hashtags ? n.hashtags.split(',') : [] }));
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
        res.status(201).json({ id: noteId, content, type, hashtags });
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

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
    await pool.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Удалено' });
});

initDatabase().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
});