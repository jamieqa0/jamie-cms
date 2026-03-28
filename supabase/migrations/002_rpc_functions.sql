-- =============================================
-- Migration 002: RPC Functions
-- Supabase SQL Editor에서 실행하세요.
-- (001_v2_schema.sql 실행 후 실행)
-- =============================================


-- ─────────────────────────────────────────────
-- 1. get_admin_users()
--    어드민용 전체 유저 목록 반환
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE(
  id UUID,
  nickname TEXT,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, nickname, email, role, created_at
  FROM users
  ORDER BY created_at DESC;
$$;


-- ─────────────────────────────────────────────
-- 2. get_admin_transfers()
--    자동이체 실행 내역 (billing_logs + 유저/상품 정보)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_transfers()
RETURNS TABLE(
  id UUID,
  nickname TEXT,
  product_name TEXT,
  amount BIGINT,
  status TEXT,
  reason TEXT,
  executed_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    bl.id,
    u.nickname,
    p.name AS product_name,
    bl.amount,
    bl.status,
    bl.reason,
    bl.executed_at
  FROM billing_logs bl
  JOIN subscriptions s ON bl.subscription_id = s.id
  JOIN users u ON s.user_id = u.id
  JOIN products p ON bl.product_id = p.id
  ORDER BY bl.executed_at DESC
  LIMIT 100;
$$;


-- ─────────────────────────────────────────────
-- 3. get_admin_stats()
--    이번 달 수납 통계 (수납률, 총 수납액, 실패 건수)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_success_count BIGINT;
  v_fail_count    BIGINT;
  v_total_amount  BIGINT;
  v_total         BIGINT;
  v_success_rate  NUMERIC;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'success'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0)
  INTO v_success_count, v_fail_count, v_total_amount
  FROM billing_logs
  WHERE DATE_TRUNC('month', executed_at) = DATE_TRUNC('month', NOW());

  v_total := v_success_count + v_fail_count;
  v_success_rate := CASE
    WHEN v_total = 0 THEN 0
    ELSE ROUND((v_success_count::NUMERIC / v_total) * 1000) / 10
  END;

  RETURN json_build_object(
    'successRate',   v_success_rate,
    'totalAmount',   v_total_amount,
    'failCount',     v_fail_count,
    'successCount',  v_success_count,
    'month',         TO_CHAR(NOW(), 'YYYY-MM')
  );
END;
$$;


-- ─────────────────────────────────────────────
-- 4. get_unpaid_list()
--    미수납 내역 (status='failed' billing_logs + 유저/상품 정보)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_unpaid_list()
RETURNS TABLE(
  id              UUID,
  subscription_id UUID,
  account_id      UUID,
  product_id      UUID,
  amount          BIGINT,
  reason          TEXT,
  executed_at     TIMESTAMPTZ,
  nickname        TEXT,
  product_name    TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    bl.id,
    bl.subscription_id,
    bl.account_id,
    bl.product_id,
    bl.amount,
    bl.reason,
    bl.executed_at,
    u.nickname,
    p.name AS product_name
  FROM billing_logs bl
  JOIN subscriptions s ON bl.subscription_id = s.id
  JOIN users u ON s.user_id = u.id
  JOIN products p ON bl.product_id = p.id
  WHERE bl.status = 'failed'
  ORDER BY bl.executed_at DESC;
$$;


-- ─────────────────────────────────────────────
-- 5. retry_billing(log_id UUID)
--    실패 billing_log 재청구
--    - 잔액 부족 시 RAISE EXCEPTION '잔액 부족'
--    - 성공 시 단일 트랜잭션: 차감 + 집금계좌 입금 + 거래 기록 + 성공 로그
--    - 잠금 순서: 개인계좌 → 집금계좌 (데드락 방지)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION retry_billing(log_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id       UUID;
  v_product_id            UUID;
  v_account_id            UUID;
  v_amount                BIGINT;
  v_balance               BIGINT;
  v_collection_account_id UUID;
BEGIN
  -- 실패 billing_log 조회
  SELECT bl.subscription_id, bl.product_id, s.account_id, bl.amount
  INTO v_subscription_id, v_product_id, v_account_id, v_amount
  FROM billing_logs bl
  JOIN subscriptions s ON bl.subscription_id = s.id
  WHERE bl.id = log_id AND bl.status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION '미수납 내역을 찾을 수 없습니다.';
  END IF;

  -- 집금 계좌 조회
  SELECT id INTO v_collection_account_id
  FROM accounts WHERE type = 'collection' LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
  END IF;

  -- 잠금 순서: 개인계좌 → 집금계좌 (데드락 방지)
  SELECT balance INTO v_balance
  FROM accounts WHERE id = v_account_id FOR UPDATE;

  PERFORM id FROM accounts WHERE id = v_collection_account_id FOR UPDATE;

  IF v_balance < v_amount THEN
    RAISE EXCEPTION '잔액 부족';
  END IF;

  -- 개인계좌 차감
  UPDATE accounts SET balance = balance - v_amount WHERE id = v_account_id;
  -- 집금계좌 입금
  UPDATE accounts SET balance = balance + v_amount WHERE id = v_collection_account_id;
  -- 거래 기록 (차감)
  INSERT INTO transactions (account_id, type, amount, description)
  VALUES (v_account_id, 'auto_debit', v_amount, '재청구');
  -- 거래 기록 (입금)
  INSERT INTO transactions (account_id, type, amount, description)
  VALUES (v_collection_account_id, 'deposit', v_amount, '재청구 수납');
  -- 성공 billing_log 기록
  INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
  VALUES (v_subscription_id, v_product_id, v_account_id, v_amount, 'success');

  RETURN json_build_object('message', '재청구 완료', 'status', 'success');
END;
$$;


-- ─────────────────────────────────────────────
-- 6. run_auto_debit(target_day INT)
--    자동이체 실행 (Edge Function에서 호출)
--    - 집금 계좌 없으면 RAISE EXCEPTION
--    - 멱등성: 오늘 이미 성공한 구독은 스킵
--    - 잔액 부족 → failed 기록
--    - 성공 → 단일 트랜잭션으로 [차감 + 입금 + 거래 2건 + 성공 로그]
--    - 잠금 순서: 개인계좌 → 집금계좌 (데드락 방지)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION run_auto_debit(target_day INT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today                 INT;
  v_collection_account_id UUID;
  v_sub                   RECORD;
  v_balance               BIGINT;
  v_success_count         INT := 0;
  v_fail_count            INT := 0;
BEGIN
  v_today := COALESCE(target_day, EXTRACT(DAY FROM NOW())::INT);

  -- 집금 계좌 조회 (없으면 전체 중단)
  SELECT id INTO v_collection_account_id
  FROM accounts WHERE type = 'collection' LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
  END IF;

  -- 오늘 청구 대상 조회 (이미 성공한 건 제외 — 멱등성)
  FOR v_sub IN
    SELECT s.id AS subscription_id, s.account_id, p.id AS product_id, p.amount
    FROM subscriptions s
    JOIN products p ON s.product_id = p.id
    WHERE p.billing_day = v_today
      AND s.status = 'active'
      AND p.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM billing_logs bl
        WHERE bl.subscription_id = s.id
          AND bl.status = 'success'
          AND DATE(bl.executed_at) = CURRENT_DATE
      )
  LOOP
    BEGIN
      -- 잠금 순서: 개인계좌 → 집금계좌 (데드락 방지)
      SELECT balance INTO v_balance
      FROM accounts WHERE id = v_sub.account_id FOR UPDATE;

      PERFORM id FROM accounts WHERE id = v_collection_account_id FOR UPDATE;

      IF v_balance < v_sub.amount THEN
        -- 잔액 부족 → failed 기록
        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
        VALUES (v_sub.subscription_id, v_sub.product_id, v_sub.account_id, v_sub.amount, 'failed', '잔액 부족');
        v_fail_count := v_fail_count + 1;
      ELSE
        -- 성공 처리
        UPDATE accounts SET balance = balance - v_sub.amount WHERE id = v_sub.account_id;
        UPDATE accounts SET balance = balance + v_sub.amount WHERE id = v_collection_account_id;
        INSERT INTO transactions (account_id, type, amount, description)
        VALUES (v_sub.account_id, 'auto_debit', v_sub.amount, '자동이체');
        INSERT INTO transactions (account_id, type, amount, description)
        VALUES (v_collection_account_id, 'deposit', v_sub.amount, '자동이체 수납');
        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
        VALUES (v_sub.subscription_id, v_sub.product_id, v_sub.account_id, v_sub.amount, 'success');
        v_success_count := v_success_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- 개별 구독 오류는 경고만 남기고 다음 건 계속 처리
      RAISE WARNING '[AutoDebit] subscription % 처리 실패: %', v_sub.subscription_id, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object(
    'day',       v_today,
    'processed', v_success_count + v_fail_count,
    'success',   v_success_count,
    'failed',    v_fail_count
  );
END;
$$;
