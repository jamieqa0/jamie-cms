const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signRefreshToken } = require('../src/utils/jwt');

let userId, refreshToken;

beforeAll(async () => {
  await pool.query(`DELETE FROM users WHERE kakao_id = 'auth_rotation_test'`);
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('auth_rotation_test', 'RotationUser') RETURNING id`
  );
  userId = user.rows[0].id;
});

beforeEach(async () => {
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
  refreshToken = signRefreshToken({ userId, role: 'user' });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, refreshToken, expiresAt]
  );
});

afterEach(async () => {
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
});

test('refresh 성공 시 새 accessToken과 새 refreshToken 반환', async () => {
  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });
  expect(res.status).toBe(200);
  expect(res.body.accessToken).toBeDefined();
  expect(res.body.refreshToken).toBeDefined();
  expect(res.body.refreshToken).not.toBe(refreshToken);
});

test('기존 refreshToken은 로테이션 후 재사용 불가 (401)', async () => {
  const first = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });
  expect(first.status).toBe(200);

  const second = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });
  expect(second.status).toBe(401);
});

test('유효하지 않은 refreshToken → 401', async () => {
  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: 'invalid.token.here' });
  expect(res.status).toBe(401);
});
