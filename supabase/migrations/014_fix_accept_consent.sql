-- accept_consent RPC에서 billing_day 제거 (subscriptions 테이블에 없는 컬럼)
CREATE OR REPLACE FUNCTION accept_consent(p_token VARCHAR, p_account_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_req     consent_requests%ROWTYPE;
  v_sub_id  UUID;
BEGIN
  SELECT * INTO v_req
  FROM consent_requests
  WHERE invite_token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent_request not found or already processed';
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
$$;
