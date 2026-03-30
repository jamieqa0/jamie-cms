-- 029_admin_users_provider.sql
-- get_admin_users에 kakao_id 포함 (SNS 여부 판별용)

DROP FUNCTION IF EXISTS get_admin_users();

CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE(
  id         UUID,
  nickname   TEXT,
  email      TEXT,
  role       TEXT,
  is_kakao   BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    id,
    nickname,
    email,
    role,
    (kakao_id IS NOT NULL) AS is_kakao,
    created_at
  FROM public.users
  ORDER BY created_at DESC;
$$;
