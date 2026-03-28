const pool = require('../config/db');

const getSubscriptions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, p.name as product_name, p.amount, p.billing_day, p.category
       FROM subscriptions s
       JOIN products p ON s.product_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const createSubscription = async (req, res) => {
  try {
    const { product_id, account_id, payment_method = 'account' } = req.body;
    if (!product_id || !account_id) {
      return res.status(400).json({ error: 'product_id and account_id are required' });
    }
    const acct = await pool.query(`SELECT user_id FROM accounts WHERE id = $1`, [account_id]);
    if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
    if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    const prod = await pool.query(`SELECT id FROM products WHERE id = $1 AND is_active = true`, [product_id]);
    if (!prod.rows[0]) return res.status(404).json({ error: 'Product not found' });

    const dup = await pool.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND product_id = $2 AND status = 'active'`,
      [req.user.userId, product_id]
    );
    if (dup.rows.length > 0) return res.status(409).json({ error: 'Already subscribed' });

    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, product_id, account_id, payment_method) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.userId, product_id, account_id, payment_method]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const updateSubscription = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const sub = await pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [req.params.id]);
    if (!sub.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (sub.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      `UPDATE subscriptions SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const sub = await pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [req.params.id]);
    if (!sub.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (sub.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      `UPDATE subscriptions SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

module.exports = { getSubscriptions, createSubscription, updateSubscription, cancelSubscription };
