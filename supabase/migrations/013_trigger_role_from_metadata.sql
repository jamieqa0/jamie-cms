-- signUp 메타데이터에 role이 있으면 그 값 사용, 없으면 'user' 기본값
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
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
