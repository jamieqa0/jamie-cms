-- =============================================
-- Migration 006: Account Deposit / Withdraw RPC
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

-- ─────────────────────────────────────────────
-- 1. account_deposit(account_id, amount)
--    입금: balance 증가 + transactions 기록
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION account_deposit(account_id UUID, amount BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION '입금 금액은 0보다 커야 합니다.';
  END IF;

  UPDATE accounts SET balance = balance + amount WHERE id = account_id;

  INSERT INTO transactions (account_id, type, amount, description)
  VALUES (account_id, 'deposit', amount, '입금');

  RETURN json_build_object('message', '입금 완료', 'amount', amount);
END;
$$;


-- ─────────────────────────────────────────────
-- 2. account_withdraw(account_id, amount)
--    출금: 잔액 확인 후 차감 + transactions 기록
--    잔액 부족 시 RAISE EXCEPTION '잔액 부족'
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION account_withdraw(account_id UUID, amount BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION '출금 금액은 0보다 커야 합니다.';
  END IF;

  SELECT balance INTO v_balance
  FROM accounts WHERE id = account_id FOR UPDATE;

  IF v_balance < amount THEN
    RAISE EXCEPTION '잔액 부족';
  END IF;

  UPDATE accounts SET balance = balance - amount WHERE id = account_id;

  INSERT INTO transactions (account_id, type, amount, description)
  VALUES (account_id, 'withdraw', amount, '출금');

  RETURN json_build_object('message', '출금 완료', 'amount', amount);
END;
$$;
