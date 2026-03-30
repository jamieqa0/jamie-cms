-- 034_block_retry_billing_withdrawn.sql
-- 탈퇴 회원 재청구 차단
-- 1. get_unpaid_list에 withdrawn_at 추가 (UI 표시용)
-- 2. retry_billing에서 탈퇴 회원 차단 (retry_billing_bulk도 내부적으로 호출하므로 자동 적용)

-- 1. get_unpaid_list 재정의
DROP FUNCTION IF EXISTS get_unpaid_list();

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
  product_name    TEXT,
  withdrawn_at    TIMESTAMPTZ
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
    p.name AS product_name,
    u.withdrawn_at
  FROM billing_logs bl
  JOIN subscriptions s ON bl.subscription_id = s.id
  JOIN users u ON s.user_id = u.id
  JOIN products p ON bl.product_id = p.id
  WHERE bl.status = 'failed'
  ORDER BY bl.executed_at DESC;
$$;

-- 2. retry_billing에 탈퇴 회원 차단 추가
DROP FUNCTION IF EXISTS retry_billing(UUID);

CREATE OR REPLACE FUNCTION retry_billing(log_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_subscription_id       UUID;
  v_product_id            UUID;
  v_account_id            UUID;
  v_amount                BIGINT;
  v_balance               BIGINT;
  v_collection_account_id UUID;
  v_company_id            UUID;
  v_company_account_id    UUID;
  v_commission_rate       NUMERIC;
  v_settlement_amount     BIGINT;
  v_invoice_id            UUID;
  v_billing_log_id        UUID;
  v_supply                BIGINT;
  v_vat                   BIGINT;
  v_withdrawn_at          TIMESTAMPTZ;
BEGIN
  -- 실패 billing_log 조회
  SELECT bl.subscription_id, bl.product_id, s.account_id, bl.amount, p.company_id
  INTO v_subscription_id, v_product_id, v_account_id, v_amount, v_company_id
  FROM billing_logs bl
  JOIN subscriptions s ON bl.subscription_id = s.id
  JOIN products p ON bl.product_id = p.id
  WHERE bl.id = log_id AND bl.status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION '미수납 내역을 찾을 수 없습니다.';
  END IF;

  -- 탈퇴 회원 차단
  SELECT u.withdrawn_at INTO v_withdrawn_at
  FROM subscriptions s
  JOIN users u ON s.user_id = u.id
  WHERE s.id = v_subscription_id;

  IF v_withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION '탈퇴한 회원입니다. 재청구할 수 없습니다.';
  END IF;

  -- 집금 계좌 조회
  SELECT id INTO v_collection_account_id
  FROM accounts WHERE type = 'collection' LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
  END IF;

  -- 업체 계좌 + 수수료율 조회
  v_company_account_id := NULL;
  v_commission_rate := 0;

  IF v_company_id IS NOT NULL THEN
    SELECT a.id, COALESCE(c.commission_rate, 0)
    INTO v_company_account_id, v_commission_rate
    FROM accounts a
    LEFT JOIN companies c ON c.user_id = v_company_id
    WHERE a.user_id = v_company_id AND a.type = 'company'
    LIMIT 1;
  END IF;

  v_settlement_amount := FLOOR(v_amount * (1 - v_commission_rate / 100.0))::BIGINT;

  -- invoice: 기존 issued 있으면 재사용, 없으면 신규 생성
  v_supply := FLOOR(v_amount / 1.1)::BIGINT;
  v_vat    := v_amount - v_supply;

  SELECT id INTO v_invoice_id
  FROM invoices
  WHERE subscription_id = v_subscription_id AND status = 'issued'
  ORDER BY issued_at DESC
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    INSERT INTO invoices (subscription_id, amount, supply_amount, vat, status)
    VALUES (v_subscription_id, v_amount, v_supply, v_vat, 'issued')
    RETURNING id INTO v_invoice_id;
  END IF;

  -- 잠금 순서: 유저계좌 → 집금계좌 → 업체계좌 (데드락 방지)
  SELECT balance INTO v_balance
  FROM accounts WHERE id = v_account_id FOR UPDATE;

  PERFORM id FROM accounts WHERE id = v_collection_account_id FOR UPDATE;

  IF v_company_account_id IS NOT NULL THEN
    PERFORM id FROM accounts WHERE id = v_company_account_id FOR UPDATE;
  END IF;

  IF v_balance < v_amount THEN
    INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
    VALUES (v_subscription_id, v_product_id, v_account_id, v_amount, 'failed', '잔액 부족')
    RETURNING id INTO v_billing_log_id;

    UPDATE invoices SET status = 'failed', billing_log_id = v_billing_log_id
    WHERE id = v_invoice_id;

    RAISE EXCEPTION '잔액 부족';
  END IF;

  -- 유저계좌 차감
  UPDATE accounts SET balance = balance - v_amount WHERE id = v_account_id;
  -- 집금계좌 입금
  UPDATE accounts SET balance = balance + v_amount WHERE id = v_collection_account_id;

  -- 업체계좌 정산
  IF v_company_account_id IS NOT NULL AND v_settlement_amount > 0 THEN
    UPDATE accounts SET balance = balance - v_settlement_amount WHERE id = v_collection_account_id;
    UPDATE accounts SET balance = balance + v_settlement_amount WHERE id = v_company_account_id;
    INSERT INTO transactions (account_id, type, amount, description)
    VALUES (v_company_account_id, 'deposit', v_settlement_amount, '재청구 정산');
  END IF;

  -- 거래 기록
  INSERT INTO transactions (account_id, type, amount, description, invoice_id)
  VALUES (v_account_id, 'auto_debit', v_amount, '재청구', v_invoice_id);
  INSERT INTO transactions (account_id, type, amount, description)
  VALUES (v_collection_account_id, 'deposit', v_amount, '재청구 수납');

  -- 성공 billing_log 삽입
  INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
  VALUES (v_subscription_id, v_product_id, v_account_id, v_amount, 'success')
  RETURNING id INTO v_billing_log_id;

  -- invoice paid로 업데이트
  UPDATE invoices
  SET status = 'paid', billing_log_id = v_billing_log_id, paid_at = NOW()
  WHERE id = v_invoice_id;

  -- 원래 failed 로그를 'retried'로 표시
  UPDATE billing_logs SET status = 'retried' WHERE id = log_id;

  RETURN json_build_object('message', '재청구 완료', 'status', 'success');
END;
$func$;
