# 청구서(Invoice) 기능 설계

**Goal:** 자동이체 실행 시 청구서를 자동 발행하고, 업체/유저 화면에서 조회 및 수동 발행 가능하게 한다.

**Architecture:** invoices 테이블을 신규 생성하고 run_auto_debit/retry_billing RPC에 청구서 생성·상태 업데이트 로직을 추가한다. 프론트는 공통 InvoiceModal 컴포넌트를 만들어 유저/업체 화면에서 공용으로 사용한다.

**Tech Stack:** Supabase PostgreSQL (RPC), React + Tailwind

---

## DB 스키마

```sql
invoices (
  id              UUID PK DEFAULT gen_random_uuid(),
  subscription_id UUID FK → subscriptions NOT NULL,
  billing_log_id  UUID FK → billing_logs,   -- 결제 후 연결 (nullable)
  amount          BIGINT NOT NULL,           -- 총 청구금액 (부가세 포함)
  supply_amount   BIGINT NOT NULL,           -- 공급가액 (FLOOR(amount / 1.1))
  vat             BIGINT NOT NULL,           -- 부가세 (amount - supply_amount)
  status          VARCHAR NOT NULL DEFAULT 'issued'
                  CHECK (status IN ('issued', 'paid', 'failed')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ
)
```

## run_auto_debit 플로우 변경

```
① 구독별 invoice INSERT (status='issued')
② 결제 시도
   성공 → billing_log INSERT + invoice UPDATE (paid, billing_log_id, paid_at=NOW())
   실패 → billing_log INSERT (failed) + invoice UPDATE (failed)
```

retry_billing도 동일하게 invoice 상태 업데이트.

## 신규 RPC

- `get_user_invoices(p_user_id UUID)` — 유저의 청구서 목록 (업체명, 상품명 포함)
- `create_invoice_manual(p_subscription_id UUID)` — 업체 수동 발행 (이미 issued 이면 에러)

## 화면 구성

**유저 `/accounts/:id`**
- 거래내역 각 항목 옆에 📄 아이콘
- 클릭 → InvoiceModal

**업체 `/company/transfers`**
- 수납내역 각 행 옆에 "청구서" 버튼 → InvoiceModal

**업체 `/company/customers`**
- 고객 목록에서 "청구서 발행" 버튼 (수동 발행, issued 상태면 비활성화)

## InvoiceModal 내용

- 청구서 번호 (invoice.id 앞 8자리 대문자)
- 상태 배지 (issued/paid/failed)
- 업체명, 상품명
- 공급가액, 부가세(10%), 합계
- 청구일, 납부일
- 인쇄/PDF 버튼 (window.print())

## API 파일

- `client/src/api/invoices.js` 신규
- `client/src/api/company.js` — createManualInvoice, getCompanyInvoices 추가
- `client/src/components/InvoiceModal.jsx` 신규 (공통)
