import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (accessToken) navigate('/dashboard');
  }, [accessToken, navigate]);

  const handleKakaoLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    window.location.href = `${apiUrl}/auth/kakao`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">Jamie CMS</h1>
        <p className="text-slate-500">정기결제 자동이체 관리 서비스</p>
        <button
          onClick={handleKakaoLogin}
          className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold px-8 py-3 rounded-xl flex items-center gap-2 mx-auto transition"
        >
          카카오로 로그인
        </button>
      </div>
    </div>
  );
}
