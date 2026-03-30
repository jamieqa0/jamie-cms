import { useNavigate } from 'react-router-dom';

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center animate-pulse">
        <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">준비 중인 기능이에요</h1>
        <p className="text-slate-500 max-w-sm mx-auto">
          더 나은 서비스를 위해 열심히 준비하고 있습니다.<br />
          조금만 기다려 주시면 곧 멋진 모습으로 찾아올게요!
        </p>
      </div>

      <button
        onClick={() => navigate(-1)}
        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
      >
        이전 페이지로 돌아가기
      </button>
    </div>
  );
}
