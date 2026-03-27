import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getMe } from '../api/auth';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { setTokens, setUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const code = params.get('code');
    if (!code) { navigate('/'); return; }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    fetch(`${apiUrl}/auth/token?code=${code}`)
      .then(r => r.json())
      .then(({ accessToken, refreshToken }) => {
        setTokens(accessToken, refreshToken);
        return getMe();
      })
      .then((res) => {
        setUser(res.data);
        navigate('/dashboard');
      })
      .catch(() => navigate('/'));
  }, [params, setTokens, setUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">로그인 중...</p>
    </div>
  );
}
