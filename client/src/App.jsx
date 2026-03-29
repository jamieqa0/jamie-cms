import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Subscriptions from './pages/Subscriptions';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Profile from './pages/Profile';
import Invoices from './pages/Invoices';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTransfers from './pages/admin/AdminTransfers';
import AdminUnpaid from './pages/admin/AdminUnpaid';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminCompanyForm from './pages/admin/AdminCompanyForm';
import AdminCollection from './pages/admin/AdminCollection';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import CompanyRoute from './components/CompanyRoute';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import CompanyLayout from './components/CompanyLayout';
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyProducts from './pages/company/CompanyProducts';
import CompanyProductForm from './pages/company/CompanyProductForm';
import CompanyCustomers from './pages/company/CompanyCustomers';
import CompanyCustomerForm from './pages/company/CompanyCustomerForm';
import CompanyTransfers from './pages/company/CompanyTransfers';
import CompanyUnpaid from './pages/company/CompanyUnpaid';
import CompanyProfile from './pages/company/CompanyProfile';
import CompanyTaxInvoices from './pages/company/CompanyTaxInvoices';
import ConsentPage from './pages/ConsentPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/consent/:token" element={<ConsentPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:id" element={<AccountDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/invoices" element={<Invoices />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/products/new" element={<AdminProductForm />} />
              <Route path="/admin/products/:id" element={<AdminProductForm />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/transfers" element={<AdminTransfers />} />
              <Route path="/admin/unpaid" element={<AdminUnpaid />} />
              <Route path="/admin/companies" element={<AdminCompanies />} />
              <Route path="/admin/companies/new" element={<AdminCompanyForm />} />
              <Route path="/admin/collection" element={<AdminCollection />} />
            </Route>
          </Route>
          <Route element={<CompanyRoute />}>
            <Route element={<CompanyLayout />}>
              <Route path="/company" element={<CompanyDashboard />} />
              <Route path="/company/products" element={<CompanyProducts />} />
              <Route path="/company/products/new" element={<CompanyProductForm />} />
              <Route path="/company/products/:id" element={<CompanyProductForm />} />
              <Route path="/company/customers" element={<CompanyCustomers />} />
              <Route path="/company/customers/new" element={<CompanyCustomerForm />} />
              <Route path="/company/transfers" element={<CompanyTransfers />} />
              <Route path="/company/unpaid" element={<CompanyUnpaid />} />
              <Route path="/company/profile" element={<CompanyProfile />} />
              <Route path="/company/tax-invoices" element={<CompanyTaxInvoices />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
