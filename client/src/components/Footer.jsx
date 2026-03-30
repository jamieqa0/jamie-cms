import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 py-6 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <span className="font-extrabold text-slate-900 text-base tracking-tight">Jamie</span>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            <Link to="/coming-soon" className="hover:text-blue-600 transition">주요기능</Link>
            <Link to="/coming-soon" className="hover:text-blue-600 transition">구독관리</Link>
            <Link to="/coming-soon" className="hover:text-blue-600 transition">공지사항</Link>
            <Link to="/coming-soon" className="hover:text-blue-600 transition">1:1 문의</Link>
            <Link to="/coming-soon" className="hover:text-blue-600 transition font-medium text-slate-400">개인정보처리방침</Link>
            <Link to="/coming-soon" className="hover:text-blue-600 transition text-slate-400">이용약관</Link>
          </div>
        </div>
        <div className="border-t border-slate-50 pt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span>(주)제이미씨엠에스</span>
          <span>대표이사: 이제이미</span>
          <span>사업자등록번호: 123-45-67890</span>
          <span>서울특별시 강남구 테헤란로 123, 제이미타워 15층</span>
          <span>© 2026 Jamie CMS. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
