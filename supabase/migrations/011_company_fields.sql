-- users 테이블에 업체 전용 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS industry VARCHAR,         -- 업종
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC CHECK (commission_rate >= 0 AND commission_rate <= 100); -- 수수료 (%)
