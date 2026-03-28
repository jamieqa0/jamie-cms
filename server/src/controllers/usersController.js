const pool = require('../config/db');

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nickname, email, role, created_at FROM users WHERE id = $1`,
      [req.user.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const updateMe = async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname) return res.status(400).json({ error: 'nickname is required' });
    const result = await pool.query(
      `UPDATE users SET nickname = $1 WHERE id = $2 RETURNING id, nickname, email, role`,
      [nickname, req.user.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

module.exports = { getMe, updateMe };
