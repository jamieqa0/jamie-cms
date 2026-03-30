-- 031_run_auto_debit_advisory_lock.sql
-- run_auto_debit 동시 호출 방지: advisory lock으로 직렬화
-- 문제: 데모 버튼 연속 클릭 시 NOT EXISTS 체크가 동시에 통과 → 동일 구독 중복 청구
-- 해결: 함수 진입 시 advisory lock 획득 → 한 번에 하나만 실행

CREATE OR REPLACE FUNCTION run_auto_debit(target_day INT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_today                 INT;
  v_collection_account_id UUID;
  v_sub                   RECORD;
  v_balance               BIGINT;
  v_company_account_id    UUID;
  v_commission_rate       NUMERIC;
  v_settlement_amount     BIGINT;
  v_success_count         INT := 0;
  v_fail_count            INT := 0;
  v_invoice_id            UUID;
  v_billing_log_id        UUID;
  v_supply                BIGINT;
  v_vat                   BIGINT;
BEGIN
  -- 동시 실행 방지: 트랜잭션 범위 advisory lock (같은 lock_id를 가진 다른 호출은 대기)
  PERFORM pg_advisory_xact_lock(hashtext('run_auto_debit'));

  v_today := COALESCE(target_day, EXTRACT(DAY FROM NOW())::INT);

  -- 집금 계좌 조회 (없으면 전체 중단)
  SELECT id INTO v_collection_account_id
  FROM accounts WHERE type = 'collection' LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
  END IF;

  -- 오늘 청구 대상 조회 (이미 성공한 건 제외 — 멱등성)
  FOR v_sub IN
    SELECT
      s.id AS subscription_id,
      s.account_id,
      p.id AS product_id,
      p.amount,
      p.company_id
    FROM subscriptions s
    JOIN products p ON s.product_id = p.id
    WHERE p.billing_day = v_today
      AND s.status = 'active'
      AND p.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM billing_logs bl
        WHERE bl.subscription_id = s.id
          AND bl.status = 'success'
          AND DATE(bl.executed_at) = CURRENT_DATE
      )
  LOOP
    BEGIN
      -- 업체 계좌 + 수수료율 조회
      v_company_account_id := NULL;
      v_commission_rate := 0;

      IF v_sub.company_id IS NOT NULL THEN
        SELECT a.id, COALESCE(c.commission_rate, 0)
        INTO v_company_account_id, v_commission_rate
        FROM accounts a
        LEFT JOIN companies c ON c.user_id = v_sub.company_id
        WHERE a.user_id = v_sub.company_id AND a.type = 'company'
        LIMIT 1;
      END IF;

      v_settlement_amount := FLOOR(v_sub.amount * (1 - v_commission_rate / 100.0))::BIGINT;

      -- ① invoice INSERT (issued)
      v_supply := FLOOR(v_sub.amount / 1.1)::BIGINT;
      v_vat    := v_sub.amount - v_supply;

      INSERT INTO invoices (subscription_id, amount, supply_amount, vat, status)
      VALUES (v_sub.subscription_id, v_sub.amount, v_supply, v_vat, 'issued')
      RETURNING id INTO v_invoice_id;

      -- 잠금 순서: 유저계좌 → 집금계좌 → 업체계좌 (데드락 방지)
      SELECT balance INTO v_balance
      FROM accounts WHERE id = v_sub.account_id FOR UPDATE;

      PERFORM id FROM accounts WHERE id = v_collection_account_id FOR UPDATE;

      IF v_company_account_id IS NOT NULL THEN
        PERFORM id FROM accounts WHERE id = v_company_account_id FOR UPDATE;
      END IF;

      IF v_balance < v_sub.amount THEN
        -- 잔액 부족 → failed 기록
        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
        VALUES (v_sub.subscription_id, v_sub.product_id, v_sub.account_id, v_sub.amount, 'failed', '잔액 부족')
        RETURNING id INTO v_billing_log_id;

        -- ② invoice UPDATE (failed)
        UPDATE invoices SET status = 'failed', billing_log_id = v_billing_log_id
        WHERE id = v_invoice_id;

        v_fail_count := v_fail_count + 1;
      ELSE
        -- 1. 유저계좌 차감
        UPDATE accounts SET balance = balance - v_sub.amount WHERE id = v_sub.account_id;
        -- 2. 집금계좌 입금 (전체 금액)
        UPDATE accounts SET balance = balance + v_sub.amount WHERE id = v_collection_account_id;

        -- 3. 업체계좌 정산 (수수료 제외 금액)
        IF v_company_account_id IS NOT NULL AND v_settlement_amount > 0 THEN
          UPDATE accounts SET balance = balance - v_settlement_amount WHERE id = v_collection_account_id;
          UPDATE accounts SET balance = balance + v_settlement_amount WHERE id = v_company_account_id;
          INSERT INTO transactions (account_id, type, amount, description)
          VALUES (v_company_account_id, 'deposit', v_settlement_amount, '자동이체 정산');
        END IF;

        -- 거래 기록 (invoice_id 포함)
        INSERT INTO transactions (account_id, type, amount, description, invoice_id)
        VALUES (v_sub.account_id, 'auto_debit', v_sub.amount, '자동이체', v_invoice_id);
        INSERT INTO transactions (account_id, type, amount, description)
        VALUES (v_collection_account_id, 'deposit', v_sub.amount, '자동이체 수납');

        -- 성공 로그
        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
        VALUES (v_sub.subscription_id, v_sub.product_id, v_sub.account_id, v_sub.amount, 'success')
        RETURNING id INTO v_billing_log_id;

        -- ③ invoice UPDATE (paid)
        UPDATE invoices
        SET status = 'paid', billing_log_id = v_billing_log_id, paid_at = NOW()
        WHERE id = v_invoice_id;

        v_success_count := v_success_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoDebit] subscription % 처리 실패: %', v_sub.subscription_id, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object(
    'day',       v_today,
    'processed', v_success_count + v_fail_count,
    'success',   v_success_count,
    'failed',    v_fail_count
  );
END;
$func$;
