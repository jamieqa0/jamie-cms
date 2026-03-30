-- 037_prevent_duplicate_subscription_direct.sql
-- ProductDetail 직접 구독 플로우의 중복 구독 차단
-- accept_consent(migration 030)는 이미 체크 있음
-- subscriptions 테이블에 partial unique index 추가

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_unique_active
  ON subscriptions (user_id, product_id)
  WHERE status IN ('active', 'paused');
