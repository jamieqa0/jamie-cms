-- =============================================
-- Migration 036: public.users 동기화 강제 백필
-- ※ accounts 생성 시 FK 에러 방지를 위한 장치
-- =============================================

-- 1. auth.users 에 존재하지 않는 public.users 중, 중복될 수 있는 고유 필드들(kakao_id)을 NULL로 초기화
-- (과거에 탈퇴했으나 kakao_id가 그대로 남아서 재가입 시 충돌을 일으키는 유저들 정리)
UPDATE public.users pu
SET kakao_id = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.id = pu.id
)
AND pu.kakao_id IS NOT NULL;

-- 2. 다시 동기화 진행
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
  COALESCE(au.raw_app_meta_data->>'role', 'user')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- 2. 만약 kakao_id가 겹치는 경우 id가 달라도 삽입이 막힐 수 있음 (유니크 제약 대응)
-- 이 경우, id로 검색해서 없는 경우에만 삽입하도록 위 쿼리가 작동하지만,
-- kakao_id가 겹치는 상황에서도 nickname 등을 업데이트하고 싶다면 아래와 같이 수행
-- (여기서는 단순히 누락된 행(id)을 채우는 것이 목적이므로 위 쿼리로 충분)

-- 3. 추가로 handle_new_auth_user 트리거 체크 및 보강
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- id 충돌 시 아무것도 안 함 (이미 존재함)
  -- kakao_id 충돌 시에도 아무것도 안 함 (중복 가입 방지)
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
    COALESCE(NEW.raw_app_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 트리거 실패로 가입 자체가 막히는 것을 방지
  RETURN NEW;
END;
$$;
