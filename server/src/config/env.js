require('dotenv').config();

const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'KAKAO_CLIENT_ID',
  'KAKAO_REDIRECT_URI',
  'CLIENT_URL',
  'SCHEDULER_SECRET',
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing env: ${key}`);
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID,
  KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI,
  CLIENT_URL: process.env.CLIENT_URL,
  SCHEDULER_SECRET: process.env.SCHEDULER_SECRET,
  PORT: process.env.PORT || 4000,
};
