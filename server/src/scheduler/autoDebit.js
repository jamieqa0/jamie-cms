const cron = require('node-cron');
const pool = require('../config/db');

const runAutoDebit = async (targetDay = null) => {
  const today = targetDay ?? new Date().getDate();
  console.log(`[AutoDebit] Running for billing_day=${today}`);

  const result = await pool.query(
    `SELECT s.id as subscription_id, s.account_id, p.id as product_id, p.amount
     FROM subscriptions s
     JOIN products p ON s.product_id = p.id
     WHERE p.billing_day = $1
       AND s.status = 'active'
       AND p.is_active = true`,
    [today]
  );

  for (const row of result.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const acct = await client.query(
        `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [row.account_id]
      );
      const balance = Number(acct.rows[0].balance);

      if (balance < row.amount) {
        await client.query('ROLLBACK');
        await pool.query(
          `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
           VALUES ($1, $2, $3, $4, 'failed', '잔액 부족')`,
          [row.subscription_id, row.product_id, row.account_id, row.amount]
        );
        continue;
      }

      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [row.amount, row.account_id]
      );
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'auto_debit', $2, '자동이체')`,
        [row.account_id, row.amount]
      );
      await client.query('COMMIT');

      await pool.query(
        `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
         VALUES ($1, $2, $3, $4, 'success')`,
        [row.subscription_id, row.product_id, row.account_id, row.amount]
      );

      console.log(`[AutoDebit] Success: subscription ${row.subscription_id}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[AutoDebit] Error for subscription ${row.subscription_id}:`, err);
    } finally {
      client.release();
    }
  }
};

const startScheduler = () => {
  cron.schedule('0 0 * * *', runAutoDebit, { timezone: 'Asia/Seoul' });
  console.log('[AutoDebit] Scheduler started');
};

module.exports = { runAutoDebit, startScheduler };
