import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import CompanyRoute from '../components/CompanyRoute';

// authStore를 직접 세팅하는 헬퍼
function setAuth(state) {
  useAuthStore.setState(state);
}

function renderWithRoute(element, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>홈</div>} />
        <Route path="/dashboard" element={<div>대시보드</div>} />
        <Route element={element}>
          <Route path="/protected" element={<div>보호된 페이지</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => setAuth({ session: null, user: null, initializing: false }));

  it('initializing 중에는 아무것도 렌더하지 않는다', () => {
    setAuth({ session: null, user: null, initializing: true });
    const { container } = renderWithRoute(<ProtectedRoute />);
    expect(container).toBeEmptyDOMElement();
  });

  it('세션이 없으면 홈(/)으로 리다이렉트한다', () => {
    setAuth({ session: null, user: null, initializing: false });
    renderWithRoute(<ProtectedRoute />);
    expect(screen.getByText('홈')).toBeInTheDocument();
  });

  it('세션이 있으면 보호된 페이지를 렌더한다', () => {
    setAuth({ session: { access_token: 'token' }, user: { role: 'user' }, initializing: false });
    renderWithRoute(<ProtectedRoute />);
    expect(screen.getByText('보호된 페이지')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('admin이면 보호된 페이지를 렌더한다', () => {
    setAuth({ user: { role: 'admin' }, initializing: false });
    renderWithRoute(<AdminRoute />);
    expect(screen.getByText('보호된 페이지')).toBeInTheDocument();
  });

  it('user role이면 대시보드로 리다이렉트한다', () => {
    setAuth({ user: { role: 'user' }, initializing: false });
    renderWithRoute(<AdminRoute />);
    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });

  it('company role이면 대시보드로 리다이렉트한다', () => {
    setAuth({ user: { role: 'company' }, initializing: false });
    renderWithRoute(<AdminRoute />);
    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });
});

describe('CompanyRoute', () => {
  it('company role이면 보호된 페이지를 렌더한다', () => {
    setAuth({ user: { role: 'company' }, initializing: false });
    renderWithRoute(<CompanyRoute />);
    expect(screen.getByText('보호된 페이지')).toBeInTheDocument();
  });

  it('admin도 company 페이지에 접근할 수 있다', () => {
    setAuth({ user: { role: 'admin' }, initializing: false });
    renderWithRoute(<CompanyRoute />);
    expect(screen.getByText('보호된 페이지')).toBeInTheDocument();
  });

  it('일반 user는 대시보드로 리다이렉트한다', () => {
    setAuth({ user: { role: 'user' }, initializing: false });
    renderWithRoute(<CompanyRoute />);
    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });
});
