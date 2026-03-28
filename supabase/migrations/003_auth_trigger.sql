-- =============================================
-- Migration 003: Auth Trigger & Users Sync
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

-- 1. kakao_id NOT NULL 제약 해제 (이메일/비밀번호 로그인 유저 대응)
ALTER TABLE users ALTER COLUMN kakao_id DROP NOT NULL;

-- 2. auth.users → public.users 자동 동기화 트리거 함수
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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. 트리거 등록 (auth.users에 새 유저 생성 시 실행)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 4. 기존 auth.users 중 public.users에 없는 유저 백필
INSERT INTO public.users (id, kakao_id, nickname, email, role)
SELECT
  au.id,
  NULLIF(au.raw_user_meta_data->>'provider_id', ''),
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1),
    'User'
  ),
  au.email,
  'user'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;
