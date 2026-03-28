import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

async function getRedirectPath(userId) {
  // 동의 페이지에서 카카오 로그인한 경우 동의 페이지로 복귀
  const consentToken = sessionStorage.getItem('consentToken');
  if (consentToken) {
    sessionStorage.removeItem('consentToken');
    return `/consent/${consentToken}`;
  }
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  if (data?.role === 'admin') return '/admin';
  if (data?.role === 'company') return '/company';
  return '/dashboard';
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        navigate('/');
        return;
      }

      if (code) {
        // PKCE flow: code를 세션으로 교환
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error('Exchange error:', exchangeError.message);
          navigate('/');
        } else if (data.session) {
          const path = await getRedirectPath(data.session.user.id);
          navigate(path);
        } else {
          navigate('/');
        }
        return;
      }

      // hash flow fallback
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const path = await getRedirectPath(session.user.id);
        navigate(path);
      } else {
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">로그인 중...</p>
    </div>
  );
}
