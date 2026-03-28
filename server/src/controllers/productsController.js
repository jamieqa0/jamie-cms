const pool = require('../config/db');

const getProducts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getProduct = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM products WHERE id = $1 AND is_active = true`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

module.exports = { getProducts, getProduct };
