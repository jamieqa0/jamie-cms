# Jamie-CMS Troubleshooting History (2026-03-28)

이 문서는 프로젝트 개발 중 발생한 주요 환경 설정 오류와 그에 대한 해결책을 기록한 문서입니다.

## 1. 카카오 로그인 관련 해결 (Kakao Auth)

### 🔐 카카오 로그인 401 Unauthorized (`KOE010`, `invalid_client`)
- **증상:** 로그인 창까지는 뜨지만, 백엔드 콜백에서 `Request failed with status code 401` 발생.
- **원인:** 카카오 디벨로퍼스 콘솔의 **[Client Secret]** 보안 기능이 활성화(ON) 상태였으나, 코드상에서는 해당 키를 전송하지 않아 인증이 거부됨.
- **해결:** 카카오 콘솔 -> 보안 -> **Client Secret 사용 설정을 [사용 안 함]**으로 변경하여 해결.

### 🐢 카카오 API 요청 제한 (`KOE237`, `Rate Limit Exceeded`)
- **증상:** `token request rate limit exceeded` 오류 발생.
- **원인:** 짧은 시간 내에 테스트 목적으로 로그인을 수십 번 시도하여 카카오 서버 측에서 일시적으로 앱을 차단함.
- **해결:** **약 5~10분간 대기** 후 다시 시도하면 자동으로 해제됨.

---

## 2. 데이터베이스 관련 해결 (Supabase/PostgreSQL)

### 🐘 Supabase DB 연결 끊김 (`Tenant or user not found`, `Connection Reset`)
- **증상:** `DB pool error`가 뜨거나 데이터베이스를 찾지 못함.
- **원인:** Supabase 직접 연결 주소(5432 포트)는 특정 네트워크나 로컬 개발 환경에서 연결이 불안정하거나 보안 패킷에 걸릴 수 있음.
- **해결:** Supabase 대시보드에서 **Connection Pooler 주소(6543 포트)**를 복사하여 사용하고, 주소 뒤에 `?pgbouncer=true` 옵션을 붙여 안정성 확보.

### 🛡️ DB 보안 정책 충돌 (Row Level Security - RLS)
- **증상:** DB 연결은 되지만 `users` 테이블 등에 데이터를 저장(`INSERT`)할 때 권한 에러 발생.
- **원인:** Supabase의 테이블별 보안 정책(RLS)이 켜져 있어 인증되지 않은 외부 요청(우리 백엔드 서버)을 거부함.
- **해결:** SQL Editor에서 다음 명령어를 실행하여 보안 정책을 일시적으로 비활성화:
  ```sql
  ALTER TABLE users DISABLE ROW LEVEL SECURITY;
  ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
  -- 필요한 모든 테이블에 대해 적용
  ```

---

## 3. 환경 설정 관련 해결 (Environment Variables)

### 🌐 클라이언트 API 호출 실패 (404/Unknown Host)
- **증상:** 로그인 버튼을 눌러도 서버(`4000`)로 아무런 로그가 남지 않음.
- **원인:** `client/.env` 파일이 없어 프론트엔드가 백엔드 서버의 주소를 알지 못함.
- **해결:** `client/.env` 파일을 새로 생성하고 아래 내용을 입력:
  ```text
  VITE_API_URL=http://localhost:4000/api
  ```

### 🧹 `.env` 파일의 줄바꿈 이슈
- **증상:** 서버 로그에 `injecting env (7)` 대신 적은 수의 환경변수만 읽혔다고 나옴.
- **원인:** 수동으로 파일을 편집하다가 보이지 않는 공백이나 중복 줄바꿈이 생겨 특정 변수를 무시함.
- **해결:** 파일 내용을 전부 지우고 공백 없이 깨끗하게 다시 작성 후 저장. (서버에서 `rs` 입력 필수)
