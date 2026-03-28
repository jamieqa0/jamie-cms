const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let adminToken, adminId;
let userId, accountId, productId, subscriptionId, billingLogId, collectionAccountId;

beforeAll(async () => {
  // 어드민 유저
  await pool.query(`DELETE FROM users WHERE kakao_id = 'admin_test_999'`);
  const admin = await pool.query(
    `INSERT INTO users (kakao_id, nickname, role) VALUES ('admin_test_999', 'AdminTest', 'admin') RETURNING id`
  );
  adminId = admin.rows[0].id;
  adminToken = signAccessToken({ userId: adminId, role: 'admin' });

  // 일반 유저
  await pool.query(`DELETE FROM users WHERE kakao_id = 'user_test_999'`);
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('user_test_999', 'UserTest') RETURNING id`
  );
  userId = user.rows[0].id;

  // 개인 계좌
  const acct = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '테스트계좌', 50000) RETURNING id`,
    [userId]
  );
  accountId = acct.rows[0].id;

  // 집금 계좌 확보
  const col = await pool.query(`SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`);
  if (col.rows.length > 0) {
    collectionAccountId = col.rows[0].id;
  } else {
    const sys = await pool.query(`SELECT id FROM users WHERE kakao_id = 'system'`);
    const sysId = sys.rows.length > 0 ? sys.rows[0].id : (
      await pool.query(`INSERT INTO users (kakao_id, nickname, role) VALUES ('system', '시스템', 'admin') RETURNING id`)
    ).rows[0].id;
    const newCol = await pool.query(
      `INSERT INTO accounts (user_id, name, type, balance) VALUES ($1, '집금계좌', 'collection', 0) RETURNING id`,
      [sysId]
    );
    collectionAccountId = newCol.rows[0].id;
  }

  // 상품
  await pool.query(`DELETE FROM products WHERE name = '어드민테스트상품'`);
  const prod = await pool.query(
    `INSERT INTO products (name, category, amount, billing_day) VALUES ('어드민테스트상품', 'etc', 10000, 15) RETURNING id`
  );
  productId = prod.rows[0].id;

  // 구독
  const sub = await pool.query(
    `INSERT INTO subscriptions (user_id, product_id, account_id) VALUES ($1, $2, $3) RETURNING id`,
    [userId, productId, accountId]
  );
  subscriptionId = sub.rows[0].id;

  // 실패 billing_log
  const log = await pool.query(
    `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
     VALUES ($1, $2, $3, 10000, 'failed', '잔액 부족') RETURNING id`,
    [subscriptionId, productId, accountId]
  );
  billingLogId = log.rows[0].id;

  // 성공 billing_log (이번 달)
  await pool.query(
    `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
     VALUES ($1, $2, $3, 10000, 'success')`,
    [subscriptionId, productId, accountId]
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
  await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [adminId, userId]);
});

// --- Stats ---

test('GET /api/admin/stats - 이번 달 수납 통계 반환', async () => {
  const res = await request(app)
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('successRate');
  expect(res.body).toHaveProperty('totalAmount');
  expect(res.body).toHaveProperty('failCount');
  expect(res.body).toHaveProperty('successCount');
  expect(res.body).toHaveProperty('month');
  expect(res.body.successCount).toBeGreaterThanOrEqual(1);
  expect(res.body.failCount).toBeGreaterThanOrEqual(1);
  expect(typeof res.body.successRate).toBe('number');
});

test('GET /api/admin/stats - 일반 유저 접근 불가 (403)', async () => {
  const userToken = signAccessToken({ userId, role: 'user' });
  const res = await request(app)
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(403);
});

// --- Unpaid ---

test('GET /api/admin/unpaid - 실패 billing_logs 반환', async () => {
  const res = await request(app)
    .get('/api/admin/unpaid')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  const found = res.body.find(r => r.id === billingLogId);
  expect(found).toBeDefined();
  expect(found.nickname).toBe('UserTest');
  expect(found.product_name).toBe('어드민테스트상품');
  expect(found.reason).toBe('잔액 부족');
});

// --- Retry ---

test('POST /api/admin/unpaid/:id/retry - 잔액 부족 시 400', async () => {
  await pool.query(`UPDATE accounts SET balance = 0 WHERE id = $1`, [accountId]);
  const res = await request(app)
    .post(`/api/admin/unpaid/${billingLogId}/retry`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('잔액 부족');
});

test('POST /api/admin/unpaid/:id/retry - 잔액 충분 시 재청구 성공', async () => {
  await pool.query(`UPDATE accounts SET balance = 50000 WHERE id = $1`, [accountId]);
  const res = await request(app)
    .post(`/api/admin/unpaid/${billingLogId}/retry`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('재청구 완료');

  const acct = await pool.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
  expect(Number(acct.rows[0].balance)).toBe(40000);
});

// --- Admin Scheduler ---

test('POST /api/admin/scheduler/run - 어드민 JWT로 자동이체 실행', async () => {
  const res = await request(app)
    .post('/api/admin/scheduler/run')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ day: 99 }); // billing_day=99인 구독 없으므로 0건 처리
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('AutoDebit complete');
  expect(res.body.day).toBe(99);
});
