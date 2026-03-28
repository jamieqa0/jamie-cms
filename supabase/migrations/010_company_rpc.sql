-- 업체용 RPC 함수 4개

-- 1) 업체별 통계: 수납률, 수납액, 미수납 건수
CREATE OR REPLACE FUNCTION get_company_stats(p_company_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_total   INT;
  v_success INT;
  v_amount  NUMERIC;
  v_fail    INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  WHERE p.company_id = p_company_id
    AND DATE_TRUNC('month', bl.billed_at) = DATE_TRUNC('month', NOW());

  SELECT COUNT(*), COALESCE(SUM(bl.amount), 0)
  INTO v_success, v_amount
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  WHERE p.company_id = p_company_id
    AND bl.status = 'success'
    AND DATE_TRUNC('month', bl.billed_at) = DATE_TRUNC('month', NOW());

  SELECT COUNT(*) INTO v_fail
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  WHERE p.company_id = p_company_id
    AND bl.status = 'failed'
    AND DATE_TRUNC('month', bl.billed_at) = DATE_TRUNC('month', NOW());

  RETURN json_build_object(
    'successRate', CASE WHEN v_total = 0 THEN 0 ELSE ROUND(v_success * 100.0 / v_total) END,
    'totalAmount', v_amount,
    'failCount',   v_fail
  );
END;
$$;

-- 2) 업체별 자동이체 내역
CREATE OR REPLACE FUNCTION get_company_transfers(p_company_id UUID)
RETURNS TABLE (
  id            UUID,
  status        VARCHAR,
  amount        NUMERIC,
  billed_at     TIMESTAMPTZ,
  reason        TEXT,
  product_name  VARCHAR,
  user_nickname VARCHAR
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    bl.id,
    bl.status,
    bl.amount,
    bl.billed_at,
    bl.reason,
    p.name        AS product_name,
    u.nickname    AS user_nickname
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  JOIN users u ON u.id = s.user_id
  WHERE p.company_id = p_company_id
  ORDER BY bl.billed_at DESC;
END;
$$;

-- 3) 업체별 미수납 목록
CREATE OR REPLACE FUNCTION get_company_unpaid(p_company_id UUID)
RETURNS TABLE (
  id              UUID,
  amount          NUMERIC,
  billed_at       TIMESTAMPTZ,
  reason          TEXT,
  product_name    VARCHAR,
  user_nickname   VARCHAR,
  subscription_id UUID
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    bl.id,
    bl.amount,
    bl.billed_at,
    bl.reason,
    p.name        AS product_name,
    u.nickname    AS user_nickname,
    bl.subscription_id
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  JOIN users u ON u.id = s.user_id
  WHERE p.company_id = p_company_id
    AND bl.status = 'failed'
  ORDER BY bl.billed_at DESC;
END;
$$;

-- 4) 동의 수락: subscription 생성 + consent_request 업데이트 (단일 트랜잭션)
CREATE OR REPLACE FUNCTION accept_consent(p_token VARCHAR, p_account_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_req     consent_requests%ROWTYPE;
  v_product products%ROWTYPE;
  v_sub_id  UUID;
BEGIN
  -- 동의 요청 잠금 후 로드
  SELECT * INTO v_req
  FROM consent_requests
  WHERE invite_token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent_request not found or already processed';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = v_req.product_id;

  -- 구독 생성
  INSERT INTO subscriptions (user_id, product_id, account_id, billing_day, status)
  VALUES (auth.uid(), v_req.product_id, p_account_id, v_product.billing_day, 'active')
  RETURNING id INTO v_sub_id;

  -- 동의 요청 수락 처리
  UPDATE consent_requests
  SET status          = 'accepted',
      user_id         = auth.uid(),
      subscription_id = v_sub_id
  WHERE id = v_req.id;

  RETURN json_build_object('subscription_id', v_sub_id);
END;
$$;
