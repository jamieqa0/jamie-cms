const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let userToken, userId, accountId;

beforeAll(async () => {
  await pool.query(`DELETE FROM users WHERE kakao_id = 'sec_user_777'`);
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname, role) VALUES ('sec_user_777', 'SecUser', 'user') RETURNING id, role`
  );
  userId = user.rows[0].id;
  userToken = signAccessToken({ userId, role: 'user' });

  const account = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '보안테스트 계좌', 10000) RETURNING id`,
    [userId]
  );
  accountId = account.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
});

// 1. JWT 위변조 테스트
test('JWT 위변조된 토큰 거부', async () => {
  const res = await request(app)
    .get('/api/users/me')
    .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJoYWNrIn0.fakesignature');
  expect(res.status).toBe(401);
});

// 2. 토큰 없이 요청
test('토큰 없이 보호된 라우트 접근 거부', async () => {
  const res = await request(app).get('/api/users/me');
  expect(res.status).toBe(401);
});

// 3. 관리자 권한 탈취 시도
test('일반 유저가 어드민 API 접근 불가 (403)', async () => {
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(403);
});

// 4. IDOR - 타인 계좌 접근
test('타인 계좌 접근 불가 (IDOR 방어)', async () => {
  await pool.query(`DELETE FROM users WHERE kakao_id = 'sec_other_777'`);
  const other = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('sec_other_777', 'Other') RETURNING id, role`
  );
  const otherToken = signAccessToken({ userId: other.rows[0].id, role: 'user' });
  const res = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set('Authorization', `Bearer ${otherToken}`);
  expect(res.status).toBe(403);
  await pool.query(`DELETE FROM users WHERE id = $1`, [other.rows[0].id]);
});

// 5. SQL Injection 시도
test('SQL Injection 입력 시 500 에러 없이 처리', async () => {
  const res = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ name: "'; DROP TABLE users; --" });
  // 400 (유효성 검사) 또는 201 (이름 그대로 저장) 중 하나, 500이면 안 됨
  expect(res.status).not.toBe(500);
  expect([201, 400]).toContain(res.status);
  // 생성됐으면 정리
  if (res.status === 201) {
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [res.body.id]);
  }
});

// 6. 입력값 검증 테스트
test('계좌명 빈 문자열 거부 (400)', async () => {
  const res = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ name: '   ' });
  expect(res.status).toBe(400);
});

// 7. Rate limit 테스트 (카카오 로그인 API)
test('로그인 API 6회 초과 시 429 반환', async () => {
  const results = [];
  for (let i = 0; i < 7; i++) {
    const r = await request(app).get('/api/auth/kakao');
    results.push(r.status);
  }
  // 리다이렉트(302)가 5번 나오고 이후 429가 나와야 함
  expect(results).toContain(429);
});
