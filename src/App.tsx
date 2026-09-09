import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { apiFetch, clearAccessToken, getAccessToken } from './api';
import { Layout } from './components/Layout';
import { AddCustomer } from './pages/AddCustomer';
import { Administrators } from './pages/Administrators';
import { ChangePassword } from './pages/ChangePassword';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { ForgotPassword } from './pages/ForgotPassword';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Locations } from './pages/Locations';
import { LocationProfile } from './pages/LocationProfile';
import { MerchantProfile, Merchants } from './pages/Merchants';
import { Offers } from './pages/Offers';
import { Orders } from './pages/Orders';
import { Products } from './pages/Products';
import { CustomerOrders } from './pages/CustomerOrders';
import { RewardSettingsPage } from './pages/RewardSettings';
import { More } from './pages/More';
import { Rewards } from './pages/Rewards';
import { CustomerLayout } from './components/CustomerLayout';
import { CustomerLogin } from './pages/customer/CustomerLogin';
import { CustomerHome } from './pages/customer/Home';
import { CustomerExplore } from './pages/customer/Explore';
import { CustomerScan } from './pages/customer/Scan';
import { CustomerRewards } from './pages/customer/Rewards';
import { CustomerProfile } from './pages/customer/Profile';
import type { Role, UserProfile } from './types';

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="state-panel error-state page-crash-state">
        <strong>This page could not load.</strong>
        <span>{this.state.error.message || 'An unexpected display error occurred.'}</span>
        <button className="button primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}

function RoleRoute({ user, role, children }: { user: UserProfile; role: Role; children: ReactNode }) {
  return user.role === role ? children : <Navigate to="/dashboard" replace />;
}

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [restoring, setRestoring] = useState(Boolean(getAccessToken()));
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  function logout() {
    clearAccessToken(); setUser(null); queryClient.clear();
  }

  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const isRoot = location.pathname === '/dashboard' || location.pathname === '/' || location.pathname === '/login';
      if (!canGoBack || isRoot) {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    });
    return () => {
      listener.then((l: any) => l.remove()).catch(() => {});
    };
  }, [location.pathname, navigate]);

  useEffect(() => {
    const unauthorized = () => logout();
    const passwordRequired = () => setUser((current) => current
      ? { ...current, must_change_password: true }
      : current);
    window.addEventListener('ae:unauthorized', unauthorized);
    window.addEventListener('ae:password-change-required', passwordRequired);
    return () => {
      window.removeEventListener('ae:unauthorized', unauthorized);
      window.removeEventListener('ae:password-change-required', passwordRequired);
    };
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setRestoring(false); return; }
    
    // Check if it's a customer JWT (has 3 parts) or Supabase token
    const isCustomerToken = token.split('.').length === 3 && (() => {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.role === 'customer';
      } catch (e) { return false; }
    })();

    const endpoint = isCustomerToken ? '/api/auth/customer/me' : '/api/auth/me';

    apiFetch<{ user: UserProfile }>(endpoint)
      .then((data) => setUser(data.user))
      .catch(() => logout())
      .finally(() => setRestoring(false));
  }, []);

  if (restoring) return <div className="boot-screen"><div className="boot-brand">Affiliate <span>AE</span></div><div className="boot-line" /></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/customer/login" element={<CustomerLogin onLogin={setUser} />} />
        <Route path="*" element={<Login onLogin={setUser} />} />
      </Routes>
    );
  }
  if (user.role === 'merchant' && user.must_change_password) {
    return <ChangePassword onChanged={() => {
      setUser({ ...user, must_change_password: false });
      void queryClient.invalidateQueries();
    }} />;
  }

  if (user.role === 'customer') {
    return (
      <CustomerLayout user={user} onLogout={logout}>
        <PageErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/customer/home" element={<CustomerHome user={user} />} />
            <Route path="/customer/explore" element={<CustomerExplore />} />
            <Route path="/customer/scan" element={<CustomerScan user={user} />} />
            <Route path="/customer/rewards" element={<CustomerRewards user={user} />} />
            <Route path="/customer/profile" element={<CustomerProfile user={user} onLogout={logout} />} />
            <Route path="*" element={<Navigate to="/customer/home" replace />} />
          </Routes>
        </PageErrorBoundary>
      </CustomerLayout>
    );
  }

  return (
    <Layout user={user} onLogout={logout}>
      <PageErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/add-customer" element={<AddCustomer user={user} />} />
          <Route path="/orders" element={<Orders user={user} />} />
          <Route path="/customer-orders" element={<CustomerOrders user={user} />} />
          <Route path="/customers" element={<Customers user={user} />} />
          <Route path="/products" element={<Products user={user} />} />
          <Route path="/offers" element={<Offers user={user} />} />
          <Route path="/rewards" element={<Rewards user={user} />} />
          <Route path="/more" element={<More user={user} />} />
          <Route path="/reward-settings" element={<RewardSettingsPage user={user} />} />
          <Route path="/merchants" element={<RoleRoute user={user} role="admin"><Merchants /></RoleRoute>} />
          <Route path="/merchants/:id" element={<RoleRoute user={user} role="admin"><MerchantProfile /></RoleRoute>} />
          <Route path="/locations" element={<RoleRoute user={user} role="admin"><Locations /></RoleRoute>} />
          <Route path="/locations/:id" element={<RoleRoute user={user} role="admin"><LocationProfile /></RoleRoute>} />
          <Route path="/administrators" element={<RoleRoute user={user} role="admin"><Administrators /></RoleRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </PageErrorBoundary>
    </Layout>
  );
}
