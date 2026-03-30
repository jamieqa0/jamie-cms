-- 030_prevent_duplicate_subscription.sql
-- 동일 유저가 동일 상품에 active/paused 구독이 있으면 동의 수락 차단

CREATE OR REPLACE FUNCTION accept_consent(p_token VARCHAR, p_account_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $func$
DECLARE
  v_req    consent_requests%ROWTYPE;
  v_sub_id UUID;
BEGIN
  SELECT * INTO v_req
  FROM consent_requests
  WHERE invite_token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent_request not found or already processed';
  END IF;

  -- 동일 상품 활성/일시정지 구독 중복 체크
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = auth.uid()
      AND product_id = v_req.product_id
      AND status IN ('active', 'paused')
  ) THEN
    RAISE EXCEPTION '이미 해당 상품을 구독 중입니다.';
  END IF;

  INSERT INTO subscriptions (user_id, product_id, account_id, status)
  VALUES (auth.uid(), v_req.product_id, p_account_id, 'active')
  RETURNING id INTO v_sub_id;

  UPDATE consent_requests
  SET status          = 'accepted',
      user_id         = auth.uid(),
      subscription_id = v_sub_id
  WHERE id = v_req.id;

  RETURN json_build_object('subscription_id', v_sub_id);
END;
$func$;
