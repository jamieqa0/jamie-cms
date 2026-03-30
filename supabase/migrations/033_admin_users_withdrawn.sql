-- 033_admin_users_withdrawn.sql
-- get_admin_users에 withdrawn_at 포함 (탈퇴 회원 표기용)

DROP FUNCTION IF EXISTS get_admin_users();

CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE(
  id           UUID,
  nickname     TEXT,
  email        TEXT,
  role         TEXT,
  is_kakao     BOOLEAN,
  created_at   TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ
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
    created_at,
    withdrawn_at
  FROM public.users
  ORDER BY created_at DESC;
$$;
