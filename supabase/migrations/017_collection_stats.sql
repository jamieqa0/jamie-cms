-- 집금 계좌 잔액 + 업체별 정산 내역 조회
CREATE OR REPLACE FUNCTION get_collection_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_collection_balance BIGINT;
  v_result JSON;
BEGIN
  -- 집금 계좌 잔액
  SELECT COALESCE(balance, 0) INTO v_collection_balance
  FROM accounts WHERE type = 'collection' LIMIT 1;

  -- 업체별 정산 내역 (이번 달)
  SELECT json_build_object(
    'collectionBalance', v_collection_balance,
    'settlements', COALESCE(
      (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            u.nickname AS company_name,
            COALESCE(c.commission_rate, 0) AS commission_rate,
            COALESCE(a.balance, 0) AS company_balance,
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
          LEFT JOIN accounts a ON a.user_id = u.id AND a.type = 'company'
          LEFT JOIN products p ON p.company_id = u.id
          LEFT JOIN billing_logs bl ON bl.product_id = p.id
            AND DATE_TRUNC('month', bl.executed_at) = DATE_TRUNC('month', NOW())
          WHERE u.role = 'company'
          GROUP BY u.nickname, c.commission_rate, a.balance
          ORDER BY total_collected DESC
        ) t
      ),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$func$;
