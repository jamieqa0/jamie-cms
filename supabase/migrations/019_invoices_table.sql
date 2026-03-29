-- 019_invoices_table.sql
-- Invoice 테이블: 자동이체 실행 시 자동 발행, 업체 수동 발행 지원
-- 상태 흐름: issued → paid | failed

-- invoices 테이블
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  billing_log_id  UUID REFERENCES billing_logs(id) ON DELETE SET NULL,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  supply_amount   BIGINT NOT NULL CHECK (supply_amount >= 0),
  vat             BIGINT NOT NULL CHECK (vat >= 0),
  status          VARCHAR NOT NULL DEFAULT 'issued'
                  CHECK (status IN ('issued', 'paid', 'failed')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  CHECK (status != 'paid' OR billing_log_id IS NOT NULL)
);

-- 인덱스
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_billing_log_id  ON invoices(billing_log_id);
CREATE INDEX idx_invoices_status          ON invoices(status);

-- transactions에 invoice_id 추가 (nullable FK)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_invoice_id ON transactions(invoice_id);
