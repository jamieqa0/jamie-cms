-- 027_fix_collection_stats_month.sql
-- DATE/TIMESTAMPTZ COALESCE 타입 충돌 수정
-- IF 분기로 명시적 타입 처리

DROP FUNCTION IF EXISTS get_collection_stats(DATE);
DROP FUNCTION IF EXISTS get_collection_stats();

CREATE OR REPLACE FUNCTION get_collection_stats(p_month DATE DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_collection_balance BIGINT;
  v_target_month       TIMESTAMPTZ;
  v_result             JSON;
BEGIN
  IF p_month IS NULL THEN
    v_target_month := DATE_TRUNC('month', NOW());
  ELSE
    v_target_month := DATE_TRUNC('month', p_month::TIMESTAMP);
  END IF;

  -- 집금 계좌 잔액
  SELECT COALESCE(balance, 0) INTO v_collection_balance
  FROM accounts WHERE type = 'collection' LIMIT 1;

  -- 업체별 정산 내역
  SELECT json_build_object(
    'collectionBalance', v_collection_balance,
    'settlements', COALESCE(
      (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            u.nickname AS company_name,
            COALESCE(c.commission_rate, 0) AS commission_rate,
            COUNT(bl.id) FILTER (WHERE bl.status = 'success') AS success_count,
            COALESCE(SUM(bl.amount) FILTER (WHERE bl.status = 'success'), 0) AS total_collected,
            COALESCE(SUM(
              FLOOR(bl.amount * (1 - COALESCE(c.commission_rate, 0) / 100.0))
            ) FILTER (WHERE bl.status = 'success'), 0) AS total_settled,
            COALESCE(SUM(
              bl.amount - FLOOR(bl.amount * (1 - COALESCE(c.commission_rate, 0) / 100.0))
            ) FILTER (WHERE bl.status = 'success'), 0) AS total_commission
          FROM users u
          JOIN companies c ON c.user_id = u.id
          LEFT JOIN products p ON p.company_id = u.id
          LEFT JOIN billing_logs bl ON bl.product_id = p.id
            AND DATE_TRUNC('month', bl.executed_at AT TIME ZONE 'UTC') = v_target_month AT TIME ZONE 'UTC'
          WHERE u.role = 'company'
          GROUP BY u.nickname, c.commission_rate
          ORDER BY total_collected DESC
        ) t
      ),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$func$;
