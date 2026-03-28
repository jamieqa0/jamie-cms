-- =============================================
-- Migration 005: Auth Trigger 중복 키 버그 수정
-- ※ 003_auth_trigger.sql 실행 후 실행하세요.
--
-- 문제: kakao_id UNIQUE 제약으로 인해 동일 카카오 계정
--       재시도 시 "duplicate key" 오류 발생
-- 해결: ON CONFLICT DO NOTHING (조건 없이) 으로 변경
--       → id, kakao_id 어떤 충돌이 발생해도 무시
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, kakao_id, nickname, email, role)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'provider_id', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1),
      'User'
    ),
    NEW.email,
    'user'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
