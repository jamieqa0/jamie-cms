const pool = require('../config/db');
const { runAutoDebit } = require('../scheduler/autoDebit');

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nickname, email, role, created_at FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getBillingLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bl.*, p.name as product_name, u.nickname
       FROM billing_logs bl
       JOIN products p ON bl.product_id = p.id
       JOIN subscriptions s ON bl.subscription_id = s.id
       JOIN users u ON s.user_id = u.id
       ORDER BY bl.executed_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM products ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getAdminProduct = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, category, description, amount, billing_day } = req.body;
    if (!name || !category || !amount || !billing_day) {
      return res.status(400).json({ error: 'name, category, amount, billing_day are required' });
    }
    const result = await pool.query(
      `INSERT INTO products (name, category, description, amount, billing_day) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, category, description, amount, billing_day]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { name, category, description, amount, billing_day, is_active } = req.body;
    const result = await pool.query(
      `UPDATE products SET
         name = COALESCE($1, name),
         category = COALESCE($2, category),
         description = COALESCE($3, description),
         amount = COALESCE($4, amount),
         billing_day = COALESCE($5, billing_day),
         is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [name, category, description, amount, billing_day, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE products SET is_active = false WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'success') AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS fail_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) AS total_amount
      FROM billing_logs
      WHERE DATE_TRUNC('month', executed_at) = DATE_TRUNC('month', NOW())
    `);
    const { success_count, fail_count, total_amount } = result.rows[0];
    const successCount = Number(success_count);
    const failCount = Number(fail_count);
    const total = successCount + failCount;
    const successRate = total === 0 ? 0 : Math.round((successCount / total) * 1000) / 10;
    res.json({
      successRate,
      totalAmount: Number(total_amount),
      failCount,
      successCount,
      month: new Date().toISOString().slice(0, 7),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getUnpaid = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bl.id, bl.subscription_id, bl.account_id, bl.product_id,
             bl.amount, bl.reason, bl.executed_at,
             u.nickname, p.name AS product_name
      FROM billing_logs bl
      JOIN subscriptions s ON bl.subscription_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN products p ON bl.product_id = p.id
      WHERE bl.status = 'failed'
      ORDER BY bl.executed_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const retryBilling = async (req, res) => {
  try {
    const logResult = await pool.query(
      `SELECT bl.id, bl.subscription_id, bl.product_id, bl.amount, s.account_id
       FROM billing_logs bl
       JOIN subscriptions s ON bl.subscription_id = s.id
       WHERE bl.id = $1 AND bl.status = 'failed'`,
      [req.params.id]
    );
    if (!logResult.rows[0]) return res.status(404).json({ error: '미수납 내역을 찾을 수 없습니다.' });

    const { subscription_id, product_id, amount, account_id } = logResult.rows[0];

    const collectionRes = await pool.query(`SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`);
    if (!collectionRes.rows[0]) return res.status(500).json({ error: '집금 계좌가 존재하지 않습니다.' });
    const collectionAccountId = collectionRes.rows[0].id;

    const client = await pool.connect();
    let committed = false;
    try {
      await client.query('BEGIN');

      // 잠금 순서: 개인 계좌 → 집금 계좌 (데드락 방지)
      const acct = await client.query(
        `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [account_id]
      );
      await client.query(`SELECT id FROM accounts WHERE id = $1 FOR UPDATE`, [collectionAccountId]);

      if (!acct.rows[0]) throw new Error('계좌를 찾을 수 없습니다.');
      if (Number(acct.rows[0].balance) < amount) {
        await client.query('ROLLBACK');
        committed = true;
        return res.status(400).json({ error: '잔액 부족' });
      }

      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amount, account_id]);
      await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amount, collectionAccountId]);
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'auto_debit', $2, '재청구')`,
        [account_id, amount]
      );
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'deposit', $2, '재청구 수납')`,
        [collectionAccountId, amount]
      );
      await client.query(
        `UPDATE billing_logs SET status = 'success' WHERE id = $1`,
        [req.params.id]
      );

      await client.query('COMMIT');
      committed = true;
      res.json({ message: '재청구 완료', status: 'success' });
    } catch (err) {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch (_) {}
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Admin Retry] Error:', err);
    res.status(500).json({ error: '재청구 중 오류가 발생했습니다.' });
  }
};

const adminRunScheduler = async (req, res) => {
  const day = req.body?.day ?? new Date().getDate();
  try {
    await runAutoDebit(day);
    res.json({ message: 'AutoDebit complete', day });
  } catch (err) {
    console.error('[Admin Scheduler] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUsers, getBillingLogs, getAdminProducts, getAdminProduct,
  createProduct, updateProduct, deleteProduct,
  getStats, getUnpaid, retryBilling, adminRunScheduler,
};
