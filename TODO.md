# Jamie CMS TODO

## ✅ 완료

### 버그 수정 / 에러 핸들링
- [x] 빈 `.catch(() => {})` 패턴 12곳 → `console.error` 또는 에러 상태 표시로 교체
- [x] `AccountDetail.jsx` `handleDeposit` try-catch + finally 추가
- [x] `Profile.jsx` `handleSave` try-catch + finally 추가
- [x] `Landing.jsx` 이메일 placeholder에서 admin 계정 힌트 제거

### UX 개선
- [x] `react-hot-toast` 도입 — 성공/실패 피드백 toast로 통일
- [x] `ConsentPage.jsx`, `ProductDetail.jsx` `<a href>` → `<Link>` 교체 (리로드 버그 수정)
- [x] 결제수단 "준비중" 버튼 `disabled` + `cursor-not-allowed opacity-50` 적용
- [x] `AccountDetail.jsx` 입금 성공 toast, 계좌 삭제 인라인 confirm
- [x] `Subscriptions.jsx` 구독 해지 인라인 confirm + 성공 toast, 빈 상태 "상품 둘러보기 →" CTA
- [x] `Profile.jsx` 저장 alert → toast
- [x] `CompanyCustomers.jsx` 청구서 발행 / 링크 복사 alert → toast
- [x] `ProductDetail.jsx`, `AccountDetail.jsx` 뒤로가기 버튼 추가

### 중복 구독 차단
- [x] `ProductDetail.jsx` 이미 구독 중인 상품 → 버튼 숨기고 "이미 구독 중" 안내 표시
- [ ] **Supabase SQL Editor 실행 필요**: `supabase/migrations/037_prevent_duplicate_subscription_direct.sql`

---

## 🔴 다음 작업

### 연체료 + 청구서 번호/유형 (설계 완료, 구현 대기)
> 상세 설계: `memory/design_late_fee.md`

**DB**
- [ ] `invoices` 테이블에 `late_fee BIGINT DEFAULT 0`, `invoice_no VARCHAR UNIQUE`, `type VARCHAR('regular'|'retry')` 컬럼 추가 (migration 038~)
- [ ] `retry_billing` RPC 수정
  - 납입기한 = 청구 실패 월 말일
  - 납입기한 미초과 시 EXCEPTION (재청구 불가)
  - 초과 시 연체료 계산 (원금 × 0.0005 × 연체일수) 후 invoice.amount에 합산
- [ ] `retry_billing_bulk` 동일하게 수정 (건별 연체일수 개별 계산)
- [ ] `run_auto_debit`, `retry_billing`, `create_invoice_manual` RPC에 `invoice_no` 채번 로직 추가
  - 일반 청구서: `YYYYMMDD-INV-NNN`
  - 재청구서: `YYYYMMDD-RET-NNN`
- [ ] `get_unpaid_list`, `get_company_unpaid` RPC에 `deadline DATE`, `overdue_days INT`, `estimated_late_fee BIGINT` 컬럼 추가

**UI**
- [ ] `AdminUnpaid.jsx`, `CompanyUnpaid.jsx`
  - 납입기한 표시
  - 납입기한 미초과 → 재청구 버튼 비활성화 + "납입기한 전" 안내
  - 납입기한 초과 → "예상 연체료 N원" 표시
- [ ] `InvoiceModal.jsx` 연체료 항목 별도 표시, 청구서 유형 배지 (일반청구서 / 재청구서)
- [ ] `Invoices.jsx`, `ReceiptModal.jsx` 청구서 유형 배지 표시

### 복수 구독 허용 방안
- [ ] 기획 미정 — 동일 상품 복수 구독이 필요한 케이스 정의 후 구현

---

## 🟡 이후 작업

### 업체 페이지 개선
-[ ] 고객이 https://jamie-cms.vercel.app/products 직접 가입한 상품 > https://jamie-cms.vercel.app/company/customers에 없음
**네비게이션 (CompanyLayout)**
- [ ] 현재 페이지 active 하이라이트 없음
- [ ] "미수납" 메뉴에 미수납 건수 배지 표시

**대시보드 (CompanyDashboard)**
- [ ] 수납률/수납액 KPI 카드 클릭 시 해당 페이지로 이동 링크 없음
- [ ] 이번 달 고정 — 이전 달 비교 불가
- [ ] 상품별 매출 비중 차트 없음

**상품 관리 (CompanyProducts)**
- [ ] 상품 목록에 구독자 수 미표시
- [ ] 카테고리, 청구서 발송일(invoice_day) 목록에 미표시
- [ ] 상품 삭제 시 native `confirm()` → 인라인 confirm으로 교체 필요

**고객 관리 (CompanyCustomers)**
- [ ] 고객 정보 수정 불가 — 삭제 후 재등록만 가능
- [ ] pending 동의 링크 재전송 불가 (복사만 됨)
- [ ] 고객 목록 검색/필터 없음
- [ ] 구독 시작일, 구독 상태(active/paused/cancelled) 미표시

**수납 내역 (CompanyTransfers)**
- [ ] 날짜 필터/기간 선택 없음
- [ ] 기간 합계(총 수납액, 건수) 상단 요약 없음

**미수납 (CompanyUnpaid)**
- [ ] 미납 경과일 미표시 (연체료 기능 구현 시 같이 해결)
- [ ] 미납 총액 합계 없음

**프로필 (CompanyProfile)**
- [ ] 업체 정보(업종) 읽기 전용 — 수정 불가

**세금계산서 (CompanyTaxInvoices)**
- [ ] 청구서 번호 형식 임시 (`YYYY-MM-01`) → `invoice_no` 도입 후 개선 예정

---

### 어드민 페이지 개선

**네비게이션 (AdminLayout)**
- [ ] 현재 페이지 active 하이라이트 없음
- [ ] "미수납" 메뉴에 미처리 건수 배지 표시

**대시보드 (AdminDashboard)**
- [ ] 총 회원 수 KPI 카드 없음 (업체 수만 표시)
- [ ] 미수납 배너에 총 금액 미표시 (건수만 표시)
- [ ] 자동이체 시연 `confirm()` / `alert()` → 인라인 confirm / toast 교체 필요

**업체 관리 (AdminCompanies)**
- [ ] 업체별 상품 수, 구독자 수 미표시
- [ ] 검색/필터 없음
- [ ] EditModal 저장 실패 시 native `alert()` → toast 교체 필요

**상품 관리 (AdminProducts)**
- [ ] 상품별 구독자 수 미표시
- [ ] 검색/업체별 필터 없음
- [ ] 삭제 시 native `confirm()` → 인라인 confirm 교체 필요, 실패 에러 핸들링 없음

**일반 회원 (AdminUsers)**
- [ ] 구독 중인 상품 수 미표시
- [ ] 검색/필터 없음
- [ ] 유저 클릭 시 구독 내역/계좌 조회 드릴다운 없음

**자동이체 내역 (AdminTransfers)**
- [ ] 날짜/업체/상품 필터 없음
- [ ] 총 건수 · 총 금액 상단 요약 없음

**미수납 관리 (AdminUnpaid)**
- [ ] 업체명 컬럼 없음 — 어느 업체 상품인지 불명확
- [ ] 미납 총액 합계 없음
- [ ] 일괄 재청구 버튼 없음 (`retry_billing_bulk` RPC는 존재)
- [ ] 재청구 시 native `confirm()` / `alert()` → 인라인 confirm / toast 교체 필요

**집금 계좌 (AdminCollection)**
- [ ] `catch(() => {})` 에러 처리 누락 — 로드 실패 시 무응답

---

### 기타 기능
- [ ] 거래내역(`/accounts/:id`)에 업체명 표시 (`transactions.billing_log_id` FK 추가)
- [ ] 어드민 업체 수정 화면 (현재 등록만 있음)
- [ ] 상품 카테고리 필터 (상품 목록 페이지)

### UI
- [ ] 계좌 카드 잔액 큰 글씨, 입출금 색상 구분
- [ ] 모바일 반응형 최적화

### 기술
- [ ] 동의 페이지 URL 1회 사용 후 무효화
- [ ] 자동이체 성공/실패 알림 (이메일 또는 카카오)
