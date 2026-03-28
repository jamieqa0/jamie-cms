-- =============================================
-- Migration 004: 테스트 계정 생성
-- ※ 003_auth_trigger.sql 실행 후 실행하세요.
--
-- 생성되는 계정:
--   관리자: admin@jamie.com / admin1234!
--   사용자: user@jamie.com  / user1234!
-- =============================================

DO $$
DECLARE
  v_admin_id UUID;
  v_user_id  UUID;
BEGIN

  -- ── 1. 테스트 관리자 auth 계정 ──────────────────
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@jamie.com';

  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, is_sso_user,
      confirmation_token, recovery_token,
      email_change_token_new, email_change,
      email_change_confirm_status
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@jamie.com',
      crypt('admin1234!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"테스트관리자"}',
      false, false,
      '', '', '', '', 0
    );
  END IF;

  -- public.users 동기화 (트리거가 처리했을 수도 있음)
  INSERT INTO public.users (id, kakao_id, nickname, email, role)
  VALUES (v_admin_id, NULL, '테스트관리자', 'admin@jamie.com', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', nickname = '테스트관리자';

  -- ── 2. 테스트 사용자 auth 계정 ──────────────────
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'user@jamie.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, is_sso_user,
      confirmation_token, recovery_token,
      email_change_token_new, email_change,
      email_change_confirm_status
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'user@jamie.com',
      crypt('user1234!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"테스트사용자"}',
      false, false,
      '', '', '', '', 0
    );
  END IF;

  -- public.users 동기화
  INSERT INTO public.users (id, kakao_id, nickname, email, role)
  VALUES (v_user_id, NULL, '테스트사용자', 'user@jamie.com', 'user')
  ON CONFLICT (id) DO NOTHING;

END $$;
