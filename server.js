const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '10mb' })); 
app.use('/models', express.static('models'));

// Подключение к БД
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_wjCZvauGe4z9@ep-quiet-pine-zayrhgpz-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
    if (err) console.error('DB connection error:', err.stack);
    else console.log('Connected to DB');
});

// Авторизация
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const result = await pool.query(
            `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id`, 
            [username, hashedPassword]
        );
        res.json({ message: 'Регистрация успешна!', user: { id: result.rows[0].id, username } });
    } catch (err) {
        res.status(400).json({ error: 'Логин занят' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
        const user = result.rows[0];
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Неверный логин или пароль' });
        }
        res.json({ message: 'Вход выполнен', user: { id: user.id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Каталог
app.get('/api/frames', async (req, res) => {
    const result = await pool.query("SELECT * FROM frames");
    res.json(result.rows);
});
app.get('/api/cases', async (req, res) => {
    const result = await pool.query("SELECT * FROM cases");
    res.json(result.rows);
});
app.get('/api/pcbs', async (req, res) => {
    const result = await pool.query("SELECT * FROM pcbs");
    res.json(result.rows);
});
app.get('/api/switches', async (req, res) => {
    const result = await pool.query("SELECT * FROM switches");
    res.json(result.rows);
});
app.get('/api/keycaps', async (req, res) => {
    const result = await pool.query("SELECT * FROM keycaps");
    res.json(result.rows);
});

// Сборки
app.post('/api/builds', async (req, res) => {
    const { user_id, build_name, frame_id, case_id, pcb_id, switch_id, keycap_id, total_price, image_data, custom_colors } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO builds (user_id, build_name, frame_id, case_id, pcb_id, switch_id, keycap_id, total_price, image_data, custom_colors) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [user_id, build_name, frame_id, case_id, pcb_id, switch_id, keycap_id, total_price, image_data, custom_colors]
        );
        res.json({ message: 'Сборка сохранена', build_id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/:id/builds', async (req, res) => {
    const query = `
        SELECT b.id, b.build_name, b.total_price, b.image_data, b.custom_colors, b.created_at,
               f.name as frame_name, c.name as case_name, c.size as case_size, p.name as pcb_name,
               s.name as switch_name, k.name as keycap_name
        FROM builds b
        LEFT JOIN frames f ON b.frame_id = f.id
        LEFT JOIN cases c ON b.case_id = c.id
        LEFT JOIN pcbs p ON b.pcb_id = p.id
        LEFT JOIN switches s ON b.switch_id = s.id
        LEFT JOIN keycaps k ON b.keycap_id = k.id
        WHERE b.user_id = $1 ORDER BY b.created_at DESC
    `;
    try {
        const result = await pool.query(query, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/builds/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM builds WHERE id = $1`, [req.params.id]);
        res.json({ message: 'Сборка удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));