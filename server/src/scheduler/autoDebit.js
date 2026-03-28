const pool = require('../config/db');

const runAutoDebit = async (targetDay = null) => {
  const today = targetDay ?? new Date().getDate();
  console.log(`[AutoDebit] Running for billing_day=${today}`);

  // 집금 계좌 조회 (없으면 전체 중단)
  const collectionRes = await pool.query(
    `SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`
  );
  if (collectionRes.rows.length === 0) {
    console.error('[AutoDebit] FATAL: No collection account found');
    throw new Error('집금 계좌가 존재하지 않습니다.');
  }
  const collectionAccountId = collectionRes.rows[0].id;

  // 오늘 청구 대상 조회 (이미 성공한 건 제외 - 멱등성)
  const result = await pool.query(
    `SELECT s.id as subscription_id, s.account_id, p.id as product_id, p.amount
     FROM subscriptions s
     JOIN products p ON s.product_id = p.id
     WHERE p.billing_day = $1
       AND s.status = 'active'
       AND p.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM billing_logs bl
         WHERE bl.subscription_id = s.id
           AND bl.status = 'success'
           AND DATE(bl.executed_at) = CURRENT_DATE
       )`,
    [today]
  );

  for (const row of result.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 잠금 순서: 개인 계좌 → 집금 계좌 (데드락 방지)
      const acct = await client.query(
        `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [row.account_id]
      );
      await client.query(
        `SELECT id FROM accounts WHERE id = $1 FOR UPDATE`,
        [collectionAccountId]
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

      // 개인 계좌 차감
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [row.amount, row.account_id]
      );
      // 집금 계좌 입금
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [row.amount, collectionAccountId]
      );
      // 트랜잭션 기록 - 차감
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description)
         VALUES ($1, 'auto_debit', $2, '자동이체')`,
        [row.account_id, row.amount]
      );
      // 트랜잭션 기록 - 집금 입금
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description)
         VALUES ($1, 'deposit', $2, '자동이체 수납')`,
        [collectionAccountId, row.amount]
      );
      // billing_log (트랜잭션 안에서)
      await client.query(
        `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
         VALUES ($1, $2, $3, $4, 'success')`,
        [row.subscription_id, row.product_id, row.account_id, row.amount]
      );

      await client.query('COMMIT');
      console.log(`[AutoDebit] Success: subscription ${row.subscription_id}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[AutoDebit] Error for subscription ${row.subscription_id}:`, err);
    } finally {
      client.release();
    }
  }
};

module.exports = { runAutoDebit };
