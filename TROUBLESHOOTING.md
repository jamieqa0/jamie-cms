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

### 🔗 6. API Route Name Mismatch (`/auth/token` vs `/auth/exchange`)
- **증상:** 로그인은 되는 듯하나 대시보드로 넘어가지 않고 무한 루프 또는 에러 발생.
- **원인:** 프론트엔드는 `GET /auth/token`을 호출하는데, 백엔드는 해당 경로가 없거나 `POST /exchange`만 열려 있었음.
- **해결:** 백엔드 `auth.js`에서 `router.get('/token', exchangeToken);` 경로를 명시적으로 복구하여 해결.

### ♻️ React StrictMode로 인한 임시코드 이중 소비 (401)
- **증상:** 카카오 로그인 후 `/auth/callback`에서 `/api/auth/token` 요청이 401 반환, 랜딩 페이지로 돌아감.
- **원인:** React 18 StrictMode가 개발 모드에서 `useEffect`를 두 번 실행함. 1번째 요청에서 임시코드가 소비(Map에서 삭제)되고, 2번째 요청에서 같은 코드로 재요청 → 코드 없음 → 401.
- **해결:** `AuthCallback.jsx`에 `useRef(false)` 플래그를 추가해 두 번째 실행을 차단:
  ```js
  const called = useRef(false);
  useEffect(() => {
    if (called.current) return;
    called.current = true;
    // ... 기존 로직
  }, [...]);
  ```

---
**🏁 최종 결과 (2026-03-28 02:00)**
- 모든 설정이 완료되었습니다.
- **해결:** `client/.env` 파일을 새로 생성하고 아래 내용을 입력:
  ```text
  VITE_API_URL=http://localhost:4000/api
  ```

### 🧹 `.env` 파일의 줄바꿈 이슈
- **증상:** 서버 로그에 `injecting env (7)` 대신 적은 수의 환경변수만 읽혔다고 나옴.
- **원인:** 수동으로 파일을 편집하다가 보이지 않는 공백이나 중복 줄바꿈이 생겨 특정 변수를 무시함.
- **해결:** 파일 내용을 전부 지우고 공백 없이 깨끗하게 다시 작성 후 저장. (서버에서 `rs` 입력 필수)

---

## 4. Supabase Auth + 카카오 로그인 (2026-03-28)

### 🔴 `500: Error getting user email from external provider`
- **증상:** 카카오 로그인 시도 시 Supabase Auth 로그에 위 오류 발생. 브라우저에서 로그인 화면으로 돌아가는 현상.
- **원인:** 카카오가 이메일을 기본 제공하지 않음. Supabase Auth는 이메일 없이는 유저 생성 불가. 카카오 개인 개발 앱은 이메일 동의항목 활성화 불가 (사업자 인증 필요).
- **해결:** 카카오가 이메일을 전달하지 않아도 로그인 처리가 되도록 별도 대응 (아래 항목 참고).

### 🔴 `500: duplicate key value violates unique constraint "users_kakao_id_key"`
- **증상:** 카카오 로그인 재시도 시 `server_error` 발생. Supabase 로그에서 `duplicate key` 오류 확인.
- **원인:** `auth.users → public.users` 동기화 트리거가 `ON CONFLICT (id) DO NOTHING`만 처리했는데, `kakao_id` 컬럼에도 UNIQUE 제약이 있어 `id` 충돌 전에 `kakao_id` 충돌이 먼저 발생.
- **해결:** 트리거 함수를 `ON CONFLICT DO NOTHING` (조건 없이)으로 변경하여 모든 중복 충돌을 무시하도록 수정.
  - 수정 파일: `supabase/migrations/005_fix_auth_trigger.sql`
  ```sql
  -- Supabase SQL Editor에서 실행
  CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO public.users (id, kakao_id, nickname, email, role)
    VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'provider_id', ''),
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
      NEW.email,
      'user'
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END;
  $$;
  ```

### 🔴 로그인 200 OK인데 대시보드로 이동 안 됨 (session 저장 타이밍 버그)
- **증상:** `signInWithPassword` 200 OK 성공, 에러 없음. URL 변경 없이 Landing 화면에 그대로 머무름.
- **원인:** `authStore.js`의 `onAuthStateChange`에서 `public.users` 조회(`await`)가 끝난 후에야 `session`을 스토어에 저장. Landing.jsx의 `useEffect`가 `session` 변경을 감지 못해 `navigate('/dashboard')` 미실행.
- **해결:** `session`을 즉시 먼저 저장하고, `user` 정보를 별도로 업데이트 (`authStore.js`):
  ```js
  if (session) {
    useAuthStore.setState({ session }); // 즉시 저장
    const { data: userData } = await supabase.from('users')...
    useAuthStore.setState({ user: userData }); // 이후 업데이트
  }
  ```
