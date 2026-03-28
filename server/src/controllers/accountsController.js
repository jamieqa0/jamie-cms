const pool = require('../config/db');

const getAccounts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const createAccount = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO accounts (user_id, name) VALUES ($1, $2) RETURNING *`,
      [req.user.userId, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getAccount = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
    const account = result.rows[0];
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    const txResult = await pool.query(
      `SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ ...account, transactions: txResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const deposit = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const acct = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
    if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
    if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING *`,
        [amount, req.params.id]
      );
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'deposit', $2, '입금')`,
        [req.params.id, amount]
      );
      await client.query('COMMIT');
      res.json(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const withdraw = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const acct = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
    if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
    if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    if (Number(acct.rows[0].balance) < amount) return res.status(400).json({ error: 'Insufficient balance' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING *`,
        [amount, req.params.id]
      );
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'withdrawal', $2, '출금')`,
        [req.params.id, amount]
      );
      await client.query('COMMIT');
      res.json(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const acct = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
    if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
    if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    const subs = await pool.query(
      `SELECT id FROM subscriptions WHERE account_id = $1 AND status = 'active'`,
      [req.params.id]
    );
    if (subs.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete account with active subscriptions' });
    }
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

module.exports = { getAccounts, createAccount, getAccount, deposit, withdraw, deleteAccount };
