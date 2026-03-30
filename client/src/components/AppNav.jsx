import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const VARIANTS = {
  user: {
    nav: 'bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10',
    logo: 'text-slate-900',
    nickname: 'text-slate-400',
    activeLink: 'bg-blue-600 text-white shadow-sm',
    inactiveLink: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
    profileActive: 'bg-slate-900 text-white',
    profileInactive: 'text-slate-500 hover:bg-slate-100',
    logout: 'text-slate-400 hover:text-red-500',
    badge: null,
  },
  company: {
    nav: 'bg-emerald-900',
    logo: 'text-white',
    nickname: 'text-emerald-300',
    activeLink: 'bg-emerald-700 text-white',
    inactiveLink: 'text-emerald-100 hover:bg-emerald-700/60',
    profileActive: 'bg-emerald-700 text-white',
    profileInactive: 'text-emerald-100 hover:bg-emerald-700/60',
    logout: 'text-red-300 hover:text-red-100',
    badge: { label: '업체', className: 'bg-emerald-600 text-white' },
  },
  admin: {
    nav: 'bg-blue-900',
    logo: 'text-white',
    nickname: 'text-blue-300',
    activeLink: 'bg-blue-700 text-white',
    inactiveLink: 'text-blue-100 hover:bg-blue-700/60',
    profileActive: 'bg-blue-700 text-white',
    profileInactive: 'text-blue-100 hover:bg-blue-700/60',
    logout: 'text-red-300 hover:text-red-100',
    badge: { label: '어드민', className: 'bg-blue-700 text-white' },
  },
};

export default function AppNav({ variant, navLinks, profileTo = null, extraLinks = [] }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const v = VARIANTS[variant];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
      isActive ? v.activeLink : v.inactiveLink
    }`;

  return (
    <nav className={`${v.nav} px-4 py-3`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`font-extrabold text-lg tracking-tight ${v.logo}`}>Jamie</span>
            {v.badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${v.badge.className}`}>
                {v.badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm hidden sm:block ${v.nickname}`}>{user?.nickname}</span>
            {extraLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={`text-sm px-2 py-2 transition ${v.profileInactive}`}
              >
                {label}
              </NavLink>
            ))}
            {profileTo && (
              <NavLink
                to={profileTo}
                className={({ isActive }) =>
                  `text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                    isActive ? v.profileActive : v.profileInactive
                  }`
                }
              >
                프로필
              </NavLink>
            )}
            <button
              onClick={handleLogout}
              className={`text-sm px-3 py-1.5 transition ${v.logout}`}
            >
              로그아웃
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
          {navLinks.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
