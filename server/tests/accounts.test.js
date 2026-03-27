const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let token, userId, accountId;

beforeAll(async () => {
  await pool.query(`DELETE FROM users WHERE kakao_id IN ('test_kakao_acct_999', 'other_kakao_acct_999')`);
  const result = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('test_kakao_acct_999', 'TestUser') RETURNING id, role`
  );
  userId = result.rows[0].id;
  token = signAccessToken({ userId, role: 'user' });
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  } catch (_) {
    // pool may already be closed by global teardown
  }
});

test('POST /api/accounts - 계좌 생성', async () => {
  const res = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '생활비 계좌' });
  expect(res.status).toBe(201);
  expect(res.body.name).toBe('생활비 계좌');
  expect(Number(res.body.balance)).toBe(0);
  accountId = res.body.id;
});

test('GET /api/accounts - 계좌 목록 조회', async () => {
  const res = await request(app)
    .get('/api/accounts')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
});

test('POST /api/accounts/:id/deposit - 입금', async () => {
  const res = await request(app)
    .post(`/api/accounts/${accountId}/deposit`)
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 50000 });
  expect(res.status).toBe(200);
  expect(Number(res.body.balance)).toBe(50000);
});

test('POST /api/accounts/:id/withdraw - 잔액 초과 출금 거부', async () => {
  const res = await request(app)
    .post(`/api/accounts/${accountId}/withdraw`)
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 100000 });
  expect(res.status).toBe(400);
});

test('타인 계좌 접근 금지 (IDOR 방어)', async () => {
  const other = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('other_kakao_acct_999', 'Other') RETURNING id, role`
  );
  const otherToken = signAccessToken({ userId: other.rows[0].id, role: 'user' });
  const res = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set('Authorization', `Bearer ${otherToken}`);
  expect(res.status).toBe(403);
  await pool.query(`DELETE FROM users WHERE id = $1`, [other.rows[0].id]);
});
