// 기존 axios 클라이언트를 Supabase 클라이언트로 교체
// api/*.js 파일들이 이 파일을 import하므로 supabase를 re-export
export { supabase as default } from '../lib/supabase';
