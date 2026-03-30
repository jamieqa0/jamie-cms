-- 035_withdraw_block_unpaid.sql
-- 미청구(활성 구독) 또는 미수납(실패 청구) 내역이 있으면 탈퇴 차단

DROP FUNCTION IF EXISTS withdraw_user();

CREATE OR REPLACE FUNCTION withdraw_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id      UUID;
  v_unpaid_count INT;
  v_active_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 사용자입니다.';
  END IF;

  -- 미수납 확인: 실패한 청구 내역
  SELECT COUNT(*) INTO v_unpaid_count
  FROM billing_logs bl
  JOIN subscriptions s ON bl.subscription_id = s.id
  WHERE s.user_id = v_user_id AND bl.status = 'failed';

  IF v_unpaid_count > 0 THEN
    RAISE EXCEPTION '미수납 내역이 %건 있습니다. 해결 후 탈퇴해 주세요.', v_unpaid_count;
  END IF;

  -- 미청구 확인: 활성 구독이 남아 있음
  SELECT COUNT(*) INTO v_active_count
  FROM subscriptions
  WHERE user_id = v_user_id AND status = 'active';

  IF v_active_count > 0 THEN
    RAISE EXCEPTION '활성 구독이 %건 있습니다. 구독을 해지한 후 탈퇴해 주세요.', v_active_count;
  END IF;

  -- 탈퇴 처리
  UPDATE public.users SET withdrawn_at = NOW() WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$func$;
