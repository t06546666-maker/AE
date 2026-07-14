import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { apiFetch, clearAccessToken, getAccessToken } from './api';
import { Layout } from './components/Layout';
import { AddCustomer } from './pages/AddCustomer';
import { Administrators } from './pages/Administrators';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { MerchantProfile, Merchants } from './pages/Merchants';
import { Orders } from './pages/Orders';
import { RewardSettingsPage } from './pages/RewardSettings';
import type { Role, UserProfile } from './types';

function RoleRoute({ user, role, children }: { user: UserProfile; role: Role; children: ReactNode }) {
  return user.role === role ? children : <Navigate to="/dashboard" replace />;
}

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [restoring, setRestoring] = useState(Boolean(getAccessToken()));
  const queryClient = useQueryClient();

  function logout() {
    clearAccessToken(); setUser(null); queryClient.clear();
  }

  useEffect(() => {
    const unauthorized = () => logout();
    window.addEventListener('ae:unauthorized', unauthorized);
    return () => window.removeEventListener('ae:unauthorized', unauthorized);
  });

  useEffect(() => {
    if (!getAccessToken()) { setRestoring(false); return; }
    apiFetch<{ user: UserProfile }>('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => logout())
      .finally(() => setRestoring(false));
  }, []);

  if (restoring) return <div className="boot-screen"><div className="boot-brand">Affiliate <span>AE</span></div><div className="boot-line" /></div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <Layout user={user} onLogout={logout}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/add-customer" element={<AddCustomer user={user} />} />
        <Route path="/orders" element={<Orders user={user} />} />
        <Route path="/customers" element={<Customers user={user} />} />
        <Route path="/reward-settings" element={<RewardSettingsPage user={user} />} />
        <Route path="/merchants" element={<RoleRoute user={user} role="admin"><Merchants /></RoleRoute>} />
        <Route path="/merchants/:id" element={<RoleRoute user={user} role="admin"><MerchantProfile /></RoleRoute>} />
        <Route path="/administrators" element={<RoleRoute user={user} role="admin"><Administrators /></RoleRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
