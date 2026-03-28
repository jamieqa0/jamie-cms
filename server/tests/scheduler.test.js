const pool = require('../src/config/db');
const { runAutoDebit } = require('../src/scheduler/autoDebit');

let userId, accountId, productId, subscriptionId, collectionAccountId;

beforeAll(async () => {
  // 이전 테스트 데이터 정리
  const prevUser = await pool.query(`SELECT id FROM users WHERE kakao_id = 'cron_test_kakao_777'`);
  if (prevUser.rows.length > 0) {
    const prevUserId = prevUser.rows[0].id;
    const prevAccounts = await pool.query(`SELECT id FROM accounts WHERE user_id = $1`, [prevUserId]);
    for (const acc of prevAccounts.rows) {
      const prevSubs = await pool.query(`SELECT id FROM subscriptions WHERE account_id = $1`, [acc.id]);
      for (const sub of prevSubs.rows) {
        await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [sub.id]);
      }
      await pool.query(`DELETE FROM subscriptions WHERE account_id = $1`, [acc.id]);
      await pool.query(`DELETE FROM billing_logs WHERE account_id = $1`, [acc.id]);
    }
    await pool.query(`DELETE FROM accounts WHERE user_id = $1`, [prevUserId]);
  }
  await pool.query(`DELETE FROM users WHERE kakao_id = 'cron_test_kakao_777'`);

  // 테스트 유저/계좌/상품/구독 생성
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

  // 집금 계좌 확보 (없으면 시스템 유저와 함께 생성)
  const existing = await pool.query(`SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`);
  if (existing.rows.length > 0) {
    collectionAccountId = existing.rows[0].id;
  } else {
    let sysUser = await pool.query(`SELECT id FROM users WHERE kakao_id = 'system'`);
    if (sysUser.rows.length === 0) {
      sysUser = await pool.query(
        `INSERT INTO users (kakao_id, nickname, role) VALUES ('system', '시스템', 'admin') RETURNING id`
      );
    }
    const col = await pool.query(
      `INSERT INTO accounts (user_id, name, type, balance) VALUES ($1, '기관 집금 계좌', 'collection', 0) RETURNING id`,
      [sysUser.rows[0].id]
    );
    collectionAccountId = col.rows[0].id;
  }
});

afterAll(async () => {
  await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM transactions WHERE account_id = $1 AND description = '자동이체 수납'`, [collectionAccountId]);
  await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
  // 집금 계좌는 공유 인프라이므로 삭제하지 않음
});

test('자동이체 실행 - 잔액 차감 및 집금 계좌 입금', async () => {
  await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  await pool.query(`UPDATE accounts SET balance = 50000 WHERE id = $1`, [accountId]);
  await pool.query(`UPDATE accounts SET balance = 0 WHERE id = $1`, [collectionAccountId]);

  await runAutoDebit(15);

  const account = await pool.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
  expect(Number(account.rows[0].balance)).toBe(40000);

  const collection = await pool.query(`SELECT balance FROM accounts WHERE id = $1`, [collectionAccountId]);
  expect(Number(collection.rows[0].balance)).toBe(10000);

  const log = await pool.query(
    `SELECT * FROM billing_logs WHERE subscription_id = $1 ORDER BY executed_at DESC LIMIT 1`,
    [subscriptionId]
  );
  expect(log.rows[0].status).toBe('success');
});

test('자동이체 실패 - 잔액 부족', async () => {
  await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  await pool.query(`UPDATE accounts SET balance = 5000 WHERE id = $1`, [accountId]);

  await runAutoDebit(15);

  const log = await pool.query(
    `SELECT * FROM billing_logs WHERE subscription_id = $1 ORDER BY executed_at DESC LIMIT 1`,
    [subscriptionId]
  );
  expect(log.rows[0].status).toBe('failed');
  expect(log.rows[0].reason).toBe('잔액 부족');
});

test('멱등성 - 같은 날 중복 실행 시 재청구 없음', async () => {
  await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  await pool.query(`UPDATE accounts SET balance = 50000 WHERE id = $1`, [accountId]);
  await pool.query(`UPDATE accounts SET balance = 0 WHERE id = $1`, [collectionAccountId]);

  await runAutoDebit(15); // 첫 번째 실행
  await runAutoDebit(15); // 두 번째 실행 (멱등성 - 스킵되어야 함)

  const logs = await pool.query(
    `SELECT * FROM billing_logs WHERE subscription_id = $1 AND status = 'success'`,
    [subscriptionId]
  );
  expect(logs.rows.length).toBe(1); // 성공 로그 1개만 있어야 함

  const account = await pool.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
  expect(Number(account.rows[0].balance)).toBe(40000); // 한 번만 차감
});
