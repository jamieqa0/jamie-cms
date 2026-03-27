// server/tests/setup.js
// DB 연결 정리 - db.js는 Task 2에서 생성됩니다
let pool;
try {
  pool = require('../src/config/db');
} catch {
  pool = null;
}

afterAll(async () => {
  if (pool) await pool.end();
});
