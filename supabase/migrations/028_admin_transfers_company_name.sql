-- 028_admin_transfers_company_name.sql
-- get_admin_transfers에 company_name 컬럼 추가

DROP FUNCTION IF EXISTS get_admin_transfers();

CREATE OR REPLACE FUNCTION get_admin_transfers()
RETURNS TABLE(
  id           UUID,
  nickname     TEXT,
  product_name TEXT,
  company_name TEXT,
  amount       BIGINT,
  status       TEXT,
  reason       TEXT,
  executed_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    bl.id,
    u.nickname,
    p.name      AS product_name,
    cu.nickname AS company_name,
    bl.amount,
    bl.status,
    bl.reason,
    bl.executed_at
  FROM billing_logs bl
  JOIN subscriptions s  ON bl.subscription_id = s.id
  JOIN users u          ON s.user_id = u.id
  JOIN products p       ON bl.product_id = p.id
  LEFT JOIN users cu    ON p.company_id = cu.id
  ORDER BY bl.executed_at DESC
  LIMIT 100;
$$;
