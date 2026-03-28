# Role Redesign: Admin / 업체 / 유저 — Design Spec
**Date:** 2026-03-29

---

## 1. 개요

기존 `admin | user` 2단계 권한을 `admin | company | user` 3단계로 확장한다.
업체(company)가 고객을 직접 등록하고 동의 요청을 보내면, 유저가 수락 후 자동이체가 실행되는 CMS 핵심 흐름을 구현한다.

---

## 2. 역할별 책임

| 역할 | 책임 |
|------|------|
| **admin** | 업체 등록/관리, 전체 시스템 통계, 자동이체 시연 실행 |
| **company** | 상품 등록/관리, 고객 등록, 동의 요청 발송, 수납/미수납 관리 |
| **user** | 동의 요청 수락 (계좌 입력), 구독 내역 확인 |

---

## 3. DB 스키마 변경

### 3-1. `users.role` 제약 변경
```sql
-- 기존: CHECK (role IN ('admin', 'user'))
-- 변경: CHECK (role IN ('admin', 'company', 'user'))
```

### 3-2. `products`에 `company_id` 추가
```sql
ALTER TABLE products
  ADD COLUMN company_id UUID REFERENCES users(id);
```
- 업체가 자기 상품만 조회/수정 가능
- admin은 전체 조회 가능

### 3-3. `consent_requests` 신규 테이블
```sql
CREATE TABLE consent_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES users(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  customer_name   VARCHAR NOT NULL,
  customer_contact VARCHAR NOT NULL,
  invite_token    VARCHAR UNIQUE NOT NULL,
  status          VARCHAR NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected')),
  user_id         UUID REFERENCES users(id),       -- 동의한 유저 (동의 후 채워짐)
  subscription_id UUID REFERENCES subscriptions(id), -- 생성된 구독 (동의 후 채워짐)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. 라우팅 구조

### Admin (`/admin/*`)
| 경로 | 페이지 |
|------|--------|
| `/admin` | 전체 통계 대시보드 + 자동이체 시연 버튼 |
| `/admin/companies` | 업체 목록 조회 |
| `/admin/companies/new` | 업체 등록 |
| `/admin/transfers` | 전체 자동이체 내역 |

### 업체 (`/company/*`)
| 경로 | 페이지 |
|------|--------|
| `/company` | 업체 대시보드 (내 수납률, 수납액, 미수납 건수) |
| `/company/products` | 내 상품 목록 |
| `/company/products/new` | 상품 등록 |
| `/company/products/:id` | 상품 수정 |
| `/company/customers` | 고객(동의 요청) 목록 |
| `/company/customers/new` | 동의 요청 생성 |
| `/company/transfers` | 내 수납 내역 |
| `/company/unpaid` | 미수납 관리 + 재청구 |

### 유저 (`/dashboard/*`)
| 경로 | 페이지 |
|------|--------|
| `/dashboard` | 대시보드 (잔액, 활성 구독) |
| `/accounts` | 계좌 관리 |
| `/subscriptions` | 구독 목록 (동의한 업체/상품) |

### 공개 페이지
| 경로 | 페이지 |
|------|--------|
| `/consent/:token` | 동의 요청 수락 (로그인 필요, 계좌 선택 + 동의) |

---

## 5. 핵심 흐름

### 5-1. 동의 요청 흐름
```
업체 → /company/customers/new
  → 고객 이름/연락처 입력 + 상품 선택
  → consent_requests INSERT (status: pending, invite_token 생성)
  → 링크 복사 버튼 (시연: 클립보드 복사)

유저 → /consent/:token 접속
  → 로그인/가입 (미로그인 시 리다이렉트 후 복귀)
  → 상품 정보 확인 (업체명, 상품명, 금액, 결제일)
  → 출금 계좌 선택
  → 동의 버튼 클릭
  → subscriptions INSERT
  → consent_requests UPDATE (status: accepted, user_id, subscription_id 채움)
```

### 5-2. 자동이체 흐름 (기존과 동일)
```
billing_day 도래 → run_auto_debit() RPC 실행
  → 잔액 확인 → 성공: 차감/입금/로그
              → 실패: failed 로그
```

### 5-3. 로그인 후 리다이렉트
| role | 이동 경로 |
|------|----------|
| admin | `/admin` |
| company | `/company` |
| user | `/dashboard` |

---

## 6. RPC / API 변경

### 신규 RPC
- `get_company_stats(company_id)` — 업체별 수납률, 수납액, 미수납 건수
- `get_company_transfers(company_id)` — 업체별 자동이체 내역
- `get_company_unpaid(company_id)` — 업체별 미수납 목록
- `accept_consent(token, account_id)` — 동의 수락: subscription 생성 + consent_request 업데이트 (단일 트랜잭션)

### 기존 RPC 유지
- `run_auto_debit(target_day)` — Admin 시연 버튼에서 호출
- `retry_billing(log_id)` — 업체 미수납 재청구에서 호출
- `get_admin_stats()` — Admin 전체 통계

### 기존 Admin RPC → 업체용으로 범위 조정
- `get_admin_transfers()` → Admin에서 전체 내역 조회용으로 유지
- 업체는 `get_company_transfers(company_id)` 별도 사용

---

## 7. 프론트엔드 변경 범위

### 신규 컴포넌트
- `CompanyRoute.jsx` — role === 'company' 체크 라우트 가드
- `CompanyLayout.jsx` — 업체 전용 네비게이션

### 수정 컴포넌트
- `authStore.js` — role 기반 리다이렉트 이미 적용됨
- `Landing.jsx` — company → /company 리다이렉트 추가
- `AdminDashboard.jsx` — 업체 관리 메뉴로 교체
- `AdminLayout.jsx` — 네비 메뉴 업체 관리로 변경

### 신규 페이지
- `pages/admin/AdminCompanies.jsx`
- `pages/admin/AdminCompanyForm.jsx`
- `pages/company/CompanyDashboard.jsx`
- `pages/company/CompanyProducts.jsx`
- `pages/company/CompanyProductForm.jsx`
- `pages/company/CompanyCustomers.jsx`
- `pages/company/CompanyCustomerForm.jsx`
- `pages/company/CompanyTransfers.jsx`
- `pages/company/CompanyUnpaid.jsx`
- `pages/ConsentPage.jsx`

---

## 8. 마이그레이션 순서

1. `007_role_company.sql` — users.role 제약 변경
2. `008_products_company.sql` — products.company_id 추가
3. `009_consent_requests.sql` — consent_requests 테이블 생성
4. `010_company_rpc.sql` — 업체용 RPC 함수
