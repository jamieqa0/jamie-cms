const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let token, userId, accountId, productId, subscriptionId;

beforeAll(async () => {
  await pool.query(`DELETE FROM users WHERE kakao_id = 'sub_test_kakao_777'`);
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('sub_test_kakao_777', 'SubUser') RETURNING id, role`
  );
  userId = user.rows[0].id;
  token = signAccessToken({ userId, role: 'user' });

  const account = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '테스트 계좌', 100000) RETURNING id`,
    [userId]
  );
  accountId = account.rows[0].id;

  await pool.query(`DELETE FROM products WHERE name = '우유배달_테스트'`);
  const product = await pool.query(
    `INSERT INTO products (name, category, amount, billing_day) VALUES ('우유배달_테스트', 'delivery', 30000, 5) RETURNING id`
  );
  productId = product.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
});

test('POST /api/subscriptions - 상품 가입', async () => {
  const res = await request(app)
    .post('/api/subscriptions')
    .set('Authorization', `Bearer ${token}`)
    .send({ product_id: productId, account_id: accountId });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe('active');
  subscriptionId = res.body.id;
});

test('GET /api/subscriptions - 구독 목록 조회', async () => {
  const res = await request(app)
    .get('/api/subscriptions')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
});

test('PUT /api/subscriptions/:id - 구독 일시정지', async () => {
  const res = await request(app)
    .put(`/api/subscriptions/${subscriptionId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'paused' });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('paused');
});

test('DELETE /api/subscriptions/:id - 구독 해지', async () => {
  const res = await request(app)
    .delete(`/api/subscriptions/${subscriptionId}`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('cancelled');
});
