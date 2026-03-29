-- 021_invoice_rpcs.sql
-- Invoice 조회 및 수동 발행 RPC 함수

-- 유저 청구서 목록 (업체명, 상품명 포함)
CREATE OR REPLACE FUNCTION get_user_invoices(p_user_id UUID)
RETURNS TABLE (
  id              UUID,
  status          VARCHAR,
  amount          BIGINT,
  supply_amount   BIGINT,
  vat             BIGINT,
  issued_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  company_name    VARCHAR,
  product_name    VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    inv.id,
    inv.status,
    inv.amount,
    inv.supply_amount,
    inv.vat,
    inv.issued_at,
    inv.paid_at,
    u.nickname    AS company_name,
    p.name        AS product_name
  FROM invoices inv
  JOIN subscriptions s  ON s.id  = inv.subscription_id
  JOIN products p       ON p.id  = s.product_id
  JOIN users u          ON u.id  = p.company_id
  WHERE s.user_id = p_user_id
  ORDER BY inv.issued_at DESC;
END;
$func$;


-- 업체 수동 발행 (이미 issued 이면 에러)
CREATE OR REPLACE FUNCTION create_invoice_manual(p_subscription_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_amount      BIGINT;
  v_supply      BIGINT;
  v_vat         BIGINT;
  v_invoice_id  UUID;
BEGIN
  -- 이미 issued 상태 청구서 존재하면 에러
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE subscription_id = p_subscription_id AND status = 'issued'
  ) THEN
    RAISE EXCEPTION '이미 발행된 청구서가 있습니다.';
  END IF;

  -- 상품 금액 조회
  SELECT p.amount INTO v_amount
  FROM subscriptions s
  JOIN products p ON p.id = s.product_id
  WHERE s.id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '구독 정보를 찾을 수 없습니다.';
  END IF;

  v_supply := FLOOR(v_amount / 1.1)::BIGINT;
  v_vat    := v_amount - v_supply;

  INSERT INTO invoices (subscription_id, amount, supply_amount, vat, status)
  VALUES (p_subscription_id, v_amount, v_supply, v_vat, 'issued')
  RETURNING id INTO v_invoice_id;

  RETURN json_build_object('invoice_id', v_invoice_id);
END;
$func$;


-- 업체별 청구서 목록 (billing_log_id 포함)
DROP FUNCTION IF EXISTS get_company_invoices(UUID);

CREATE OR REPLACE FUNCTION get_company_invoices(p_company_id UUID)
RETURNS TABLE (
  id              UUID,
  billing_log_id  UUID,
  status          VARCHAR,
  amount          BIGINT,
  supply_amount   BIGINT,
  vat             BIGINT,
  issued_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  user_nickname   VARCHAR,
  product_name    VARCHAR,
  subscription_id UUID
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    inv.id,
    inv.billing_log_id,
    inv.status,
    inv.amount,
    inv.supply_amount,
    inv.vat,
    inv.issued_at,
    inv.paid_at,
    u.nickname    AS user_nickname,
    p.name        AS product_name,
    s.id          AS subscription_id
  FROM invoices inv
  JOIN subscriptions s  ON s.id  = inv.subscription_id
  JOIN products p       ON p.id  = s.product_id
  JOIN users u          ON u.id  = s.user_id
  WHERE p.company_id = p_company_id
  ORDER BY inv.issued_at DESC;
END;
$func$;
