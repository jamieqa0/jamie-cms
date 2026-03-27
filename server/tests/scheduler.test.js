const pool = require('../src/config/db');
const { runAutoDebit } = require('../src/scheduler/autoDebit');

let userId, accountId, productId, subscriptionId;

beforeAll(async () => {
  await pool.query(`DELETE FROM users WHERE kakao_id = 'cron_test_kakao_777'`);
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('cron_test_kakao_777', 'CronUser') RETURNING id`
  );
  userId = user.rows[0].id;

  const account = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '자동이체 계좌', 50000) RETURNING id`,
    [userId]
  );
  accountId = account.rows[0].id;

  await pool.query(`DELETE FROM products WHERE name = '자동이체_테스트_상품'`);
  const product = await pool.query(
    `INSERT INTO products (name, category, amount, billing_day) VALUES ('자동이체_테스트_상품', 'etc', 10000, 15) RETURNING id`
  );
  productId = product.rows[0].id;

  const sub = await pool.query(
    `INSERT INTO subscriptions (user_id, product_id, account_id) VALUES ($1, $2, $3) RETURNING id`,
    [userId, productId, accountId]
  );
  subscriptionId = sub.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
});

test('자동이체 실행 - 잔액 차감 및 로그 기록', async () => {
  await pool.query(`UPDATE accounts SET balance = 50000 WHERE id = $1`, [accountId]);
  await runAutoDebit(15);

  const account = await pool.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
  expect(Number(account.rows[0].balance)).toBe(40000);

  const log = await pool.query(
    `SELECT * FROM billing_logs WHERE subscription_id = $1 ORDER BY executed_at DESC LIMIT 1`,
    [subscriptionId]
  );
  expect(log.rows[0].status).toBe('success');
});

test('자동이체 실패 - 잔액 부족', async () => {
  await pool.query(`UPDATE accounts SET balance = 5000 WHERE id = $1`, [accountId]);
  await runAutoDebit(15);

  const log = await pool.query(
    `SELECT * FROM billing_logs WHERE subscription_id = $1 ORDER BY executed_at DESC LIMIT 1`,
    [subscriptionId]
  );
  expect(log.rows[0].status).toBe('failed');
  expect(log.rows[0].reason).toBe('잔액 부족');
});
