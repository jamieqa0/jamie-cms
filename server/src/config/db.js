const { Pool } = require('pg');

// env.js는 환경변수 미설정 시 에러를 던지므로,
// 테스트 환경에서는 globalSetup이 먼저 dotenv를 로드한 뒤 이 파일이 require됩니다.
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('Missing env: DATABASE_URL');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('DB pool error:', err);
});

module.exports = pool;
