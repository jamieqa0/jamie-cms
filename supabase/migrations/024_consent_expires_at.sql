-- 024_consent_expires_at.sql
-- consent_requests에 만료기간 추가 (기본 30일)

ALTER TABLE consent_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days');

-- 기존 pending 토큰: 생성일 기준 30일로 일괄 세팅
UPDATE consent_requests
SET expires_at = created_at + INTERVAL '30 days'
WHERE status = 'pending';
