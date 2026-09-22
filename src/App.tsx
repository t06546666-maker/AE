import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { apiFetch, clearAccessToken, getAccessToken } from './api';
import { Layout } from './components/Layout';
import { AddCustomer } from './pages/AddCustomer';
import { Administrators } from './pages/Administrators';
import { ChangePassword } from './pages/ChangePassword';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { MerchantOverview } from './pages/MerchantOverview';
import { ForgotPassword } from './pages/ForgotPassword';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Locations } from './pages/Locations';
import { LocationProfile } from './pages/LocationProfile';
import { MerchantProfile, Merchants } from './pages/Merchants';
import { MerchantCategories } from './pages/MerchantCategories';
import { Offers } from './pages/Offers';
import { Orders } from './pages/Orders';
import { Products } from './pages/Products';
import { CustomerOrders } from './pages/CustomerOrders';
import { ProductLists } from './pages/ProductLists';
import { RewardSettingsPage } from './pages/RewardSettings';
import { More } from './pages/More';
import { Feedback } from './pages/Feedback';
import { Rewards } from './pages/Rewards';
import { CustomerLayout } from './components/CustomerLayout';
import { CustomerHome } from './pages/customer/Home';
import { CustomerExplore } from './pages/customer/Explore';
import { CustomerLogin } from './pages/customer/CustomerLogin';
import { CustomerSignup } from './pages/customer/CustomerSignup';
import { CustomerChangePassword } from './pages/customer/CustomerChangePassword';
import { CustomerForgotPassword } from './pages/customer/CustomerForgotPassword';
import { CustomerScan } from './pages/customer/Scan';
import { CustomerRewards } from './pages/customer/Rewards';
import { CustomerProfile } from './pages/customer/Profile';
import { CustomerTransactions } from './pages/customer/Transactions';
import { CustomerOffers } from './pages/customer/Offers';
import { CustomerNotifications } from './pages/customer/Notifications';
import { CustomerReferral } from './pages/customer/Referral';
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
      const isRoot = (location.pathname === '/dashboard' && !location.search) || location.pathname === '/' || location.pathname === '/login';
      if (!canGoBack || isRoot) {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    });
    return () => {
      listener.then((l: any) => l.remove()).catch(() => {});
    };
  }, [location.pathname, location.search, navigate]);

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
    if (user && CapacitorApp && Capacitor.isNativePlatform()) {
      Promise.all([
        import('@capacitor/push-notifications'),
        import('@capacitor/geolocation'),
      ]).then(async ([{ PushNotifications }, { Geolocation }]) => {
        // Ask for the permissions needed by the native app at first use.
        // Android controls the actual system prompts; GPS cannot be enabled silently.
        const locationStatus = await Geolocation.checkPermissions();
        if (locationStatus.location !== 'granted') await Geolocation.requestPermissions();

        const pushStatus = await PushNotifications.checkPermissions();
        if (pushStatus.receive !== 'granted') await PushNotifications.requestPermissions();
        const finalPushStatus = await PushNotifications.checkPermissions();
        if (finalPushStatus.receive === 'granted') await PushNotifications.register();

        PushNotifications.addListener('registration', (token) => {
          apiFetch(user.role === 'customer' ? '/api/customer/preferences' : '/api/profile/preferences', {
            method: 'PUT',
            body: JSON.stringify({ push_token: token.value })
          }).catch(console.error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          if (notification.notification.data?.url) {
            navigate(notification.notification.data.url);
          }
        });
      }).catch((error) => console.error('Native permission setup failed', error));
    }
  }, [user?.role, navigate]);

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

    // Never reuse an admin/merchant session when opening a customer URL.
    // This can happen when the same browser previously used the merchant portal.
    // Clear that session and let the customer login page render instead of
    // restoring the merchant dashboard and navigating away from the customer area.
    if (location.pathname.startsWith('/customer/') && !isCustomerToken) {
      clearAccessToken();
      setRestoring(false);
      return;
    }

    const endpoint = isCustomerToken ? '/api/auth/customer/me' : '/api/auth/me';

    let active = true;
    apiFetch<{ user: UserProfile }>(endpoint)
      .then((data) => {
        if (!active || getAccessToken() !== token) return;
        // The customer-only endpoint has already authenticated this identity.
        // Keep older deployments that omit role out of the merchant routes.
        setUser(isCustomerToken ? { ...data.user, role: 'customer' } : data.user);
      })
      .catch(() => { if (active && getAccessToken() === token) logout(); })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, []);

  if (restoring) return <div className="boot-screen"><div className="boot-brand"><img src="/logo.png" alt="AE" /></div></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/customer/forgot-password" element={<CustomerForgotPassword />} />
        <Route path="/customer/login" element={<CustomerLogin onLogin={setUser} />} />
        <Route path="/customer/signup" element={<CustomerSignup onLogin={setUser} />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/customer/login" replace />} />
      </Routes>
    );
  }
  if (user.must_change_password) {
    return user.role === 'customer' 
      ? <CustomerChangePassword onChanged={() => {
          setUser({ ...user, must_change_password: false });
          void queryClient.invalidateQueries();
        }} />
      : <ChangePassword onChanged={() => {
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
            <Route path="/customer/transactions" element={<CustomerTransactions user={user} />} />
            <Route path="/customer/offers" element={<CustomerOffers />} />
            <Route path="/customer/notifications" element={<CustomerNotifications />} />
            <Route path="/customer/referral" element={<CustomerReferral user={user} />} />
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
          <Route path="/dashboard" element={user.role === 'merchant' ? <MerchantOverview user={user} /> : <Dashboard user={user} />} />
          <Route path="/add-customer" element={<AddCustomer user={user} />} />
          <Route path="/orders" element={<Orders user={user} />} />
          <Route path="/customer-orders" element={<CustomerOrders user={user} />} />
          <Route path="/customer-product-lists" element={<RoleRoute user={user} role="admin"><ProductLists /></RoleRoute>} />
          <Route path="/customers" element={user.role === 'merchant' && new URLSearchParams(location.search).get('view') !== 'qr' ? <MerchantOverview user={user} /> : <Customers user={user} />} />
          <Route path="/products" element={<Products user={user} />} />
          <Route path="/offers" element={<Offers user={user} />} />
          <Route path="/rewards" element={<Rewards user={user} />} />
          <Route path="/more" element={<More user={user} onLogout={logout} />} />
          <Route path="/feedback" element={<Feedback user={user} />} />
          <Route path="/reward-settings" element={<RewardSettingsPage user={user} />} />
          <Route path="/merchants" element={<RoleRoute user={user} role="admin"><Merchants /></RoleRoute>} />
          <Route path="/merchant-categories" element={<RoleRoute user={user} role="admin"><MerchantCategories /></RoleRoute>} />
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
