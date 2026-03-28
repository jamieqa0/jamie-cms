-- 011에서 users에 추가했던 컬럼 제거
ALTER TABLE users
  DROP COLUMN IF EXISTS industry,
  DROP COLUMN IF EXISTS commission_rate;

-- 업체 전용 정보 테이블 분리
CREATE TABLE IF NOT EXISTS companies (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  industry        VARCHAR,
  commission_rate NUMERIC CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
