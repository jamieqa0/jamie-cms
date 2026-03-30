-- 032_user_withdrawal.sql
-- 회원 탈퇴 기능: 기존 데이터 보존 + 재가입 허용

-- 1. users 테이블에 탈퇴 시각 컬럼 추가 (NULL이면 활성 계정)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

-- 2. 회원 탈퇴 RPC
-- SECURITY DEFINER: postgres 권한으로 실행되어 auth.users 삭제 가능
-- - public.users의 withdrawn_at 기록 → 기존 구독/결제 내역 보존
-- - auth.users 삭제 → 세션 무효화 + 동일 이메일 재가입 허용
CREATE OR REPLACE FUNCTION withdraw_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 사용자입니다.';
  END IF;

  -- 탈퇴 시각 기록 + 고유 식별자 해제 (재가입 허용을 위함)
  UPDATE public.users 
  SET 
    withdrawn_at = NOW(),
    kakao_id = NULL, -- 동일 카카오 계정 재가입 허용
    email = email || '_withdrawn_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') -- 동일 이메일 재가입 시 충돌 방지 (혹시 unique 면)
  WHERE id = v_user_id;

  -- auth.users 삭제: 동일 이메일 재가입 허용 + 세션 자동 무효화
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$func$;
