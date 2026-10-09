import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ApiError, apiFetch, clearAccessToken, getAccessToken } from './api';
import { Layout } from './components/Layout';
import { AddCustomer } from './pages/AddCustomer';
import { Administrators } from './pages/Administrators';
import { ChangePassword } from './pages/ChangePassword';
import { Legal } from './pages/Legal';
import { AccountDeletion } from './pages/AccountDeletion';
import { useTranslation } from 'react-i18next';
import { LegalGate } from './components/LegalGate';
import { ReadOnlyProfiles } from './pages/ReadOnlyProfiles';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { MerchantOverview } from './pages/MerchantOverview';
import { MerchantPoints } from './pages/MerchantPoints';
import { ForgotPassword } from './pages/ForgotPassword';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Locations } from './pages/Locations';
import { LocationProfile } from './pages/LocationProfile';
import { MerchantProfile } from './pages/MerchantProfile';
import { Merchants } from './pages/Merchants';
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
import { CustomerFavorites } from './pages/customer/Favorites';
import { FieldManager } from './pages/FieldManager';
import { FieldManagers } from './pages/FieldManagers';
import { FieldMerchantVisit } from './pages/FieldMerchantVisit';
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
  useTranslation(undefined, { bindI18n: 'languageChanged loaded' });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [restoring, setRestoring] = useState(Boolean(getAccessToken()));
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
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
    let disposed = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];
    let registrationTimer: ReturnType<typeof setTimeout> | undefined;
    let registrationRetryTimer: ReturnType<typeof setInterval> | undefined;
    let registrationAttempts = 0;
    const reportPush = (message: string) => window.dispatchEvent(new CustomEvent('ae:push-status', { detail: message }));
    if (user && CapacitorApp && Capacitor.isNativePlatform()) {
      Promise.all([
        import('@capacitor/push-notifications'),
        import('@capacitor/geolocation'),
      ]).then(async ([{ PushNotifications }, { Geolocation }]) => {
        // Ask for the permissions needed by the native app at first use.
        // Android controls the actual system prompts; GPS cannot be enabled silently.
        // Location permission must never block push registration.
        void Geolocation.checkPermissions().then(status => {
          if (status.location !== 'granted') return Geolocation.requestPermissions();
        }).catch(error => console.warn('Location permission unavailable', error));

        try {
          await PushNotifications.createChannel({
            id: 'ae_notifications',
            name: 'AE Notifications',
            description: 'Notifications for AE rewards, orders, and payments',
            importance: 5,
            visibility: 1,
            vibration: true,
            lights: true
          });
        } catch (e) {
          console.warn('Could not create notification channel:', e);
        }

        const pushStatus = await PushNotifications.checkPermissions();
        if (pushStatus.receive !== 'granted') await PushNotifications.requestPermissions();
        // Attach the registration listener before register(). Android may emit
        // the token immediately; registering first can lose that event and
        // leave the customer without a saved push token.
        listeners.push(await PushNotifications.addListener('registration', (token) => {
          if (disposed) return;
          clearTimeout(registrationTimer);
          if (registrationRetryTimer) clearInterval(registrationRetryTimer);
          void apiFetch(user.role === 'customer' ? '/api/customer/preferences' : '/api/profile/preferences', {
            method: 'PUT',
            body: JSON.stringify({ push_token: token.value, push_enabled: true })
          }).then(() => reportPush('Phone registered for notifications.')).catch(error => reportPush(`Could not save phone registration: ${error.message}`));
        }));
        listeners.push(await PushNotifications.addListener('registrationError', error => {
          clearTimeout(registrationTimer);
          reportPush(`Phone notification registration failed: ${error.error}`);
        }));

        const finalPushStatus = await PushNotifications.checkPermissions();
        if (disposed) { for (const listener of listeners) void listener.remove(); return; }
        if (finalPushStatus.receive === 'granted') {
          registrationTimer = setTimeout(() => reportPush('Still waiting for Google notification registration. Check your connection and retry.'), 20000);
          await PushNotifications.register();
          registrationRetryTimer = setInterval(() => {
            if (disposed || registrationAttempts >= 3) {
              if (registrationRetryTimer) clearInterval(registrationRetryTimer);
              return;
            }
            registrationAttempts += 1;
            void PushNotifications.register();
          }, 15000);
        } else reportPush('Allow notifications in Android settings to receive alerts.');

        listeners.push(await PushNotifications.addListener('pushNotificationReceived', () => {
          void queryClient.invalidateQueries({ queryKey: ['customer'] });
          reportPush('A notification was received on this phone.');
        }));

        listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          if (typeof notification.notification.data?.url === 'string' && notification.notification.data.url.startsWith('/') && !notification.notification.data.url.startsWith('//')) {
            navigate(notification.notification.data.url);
          }
        }));
      }).catch((error) => reportPush(`Notification setup failed: ${error.message}`));
    }
    return () => { disposed = true; clearTimeout(registrationTimer); if (registrationRetryTimer) clearInterval(registrationRetryTimer); for (const listener of listeners) void listener.remove(); };
  }, [user?.id, user?.role, navigate, queryClient]);

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

    // Restore the saved identity; role-specific routes still enforce access.

    const endpoint = isCustomerToken ? '/api/auth/customer/me' : '/api/auth/me';

    let active = true;
    apiFetch<{ user: UserProfile }>(endpoint)
      .then((data) => {
        if (!active || !getAccessToken()) return;
        // The customer-only endpoint has already authenticated this identity.
        // Keep older deployments that omit role out of the merchant routes.
        setUser(isCustomerToken ? { ...data.user, role: 'customer' } : data.user);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) logout();
        else setRestoreError(error instanceof Error ? error.message : 'Unable to restore your session. Please retry.');
      })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [restoreAttempt]);

  if (location.pathname === '/delete-account') return <AccountDeletion />;
  if (location.pathname === '/legal' || location.pathname === '/terms' || location.pathname === '/privacy') return <Legal />;
  if (restoring) return <div className="boot-screen"><div className="boot-brand"><img src="/logo.png" alt="AE" /></div></div>;
  if (restoreError && !user) return <div className="state-panel error-state"><strong>Your saved session has been kept.</strong><span>{restoreError}</span><button className="button primary" onClick={() => { setRestoreError(''); setRestoring(true); setRestoreAttempt(value => value + 1); }}>Retry connection</button><button className="button" onClick={() => { setRestoreError(''); logout(); }}>Sign out</button></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/customer/forgot-password" element={<CustomerForgotPassword />} />
        <Route path="/customer/login" element={<CustomerLogin onLogin={setUser} />} />
        <Route path="/customer/signup" element={<CustomerSignup onLogin={setUser} />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="/field" element={<Login field onLogin={setUser} />} />
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

  if (location.pathname === '/field' && user.role !== 'field_manager') {
    return <div className="state-panel"><h1>Field Manager portal</h1><p>You are signed in as {user.role}. Sign out here to use a field manager account, or open /field in a separate browser profile.</p><button className="button primary" onClick={logout}>Sign out to Field Manager Login</button><button className="button secondary" onClick={() => navigate(user.role === 'customer' ? '/customer/home' : '/dashboard')}>Back to my dashboard</button></div>;
  }

  if (user.role === 'customer') {
    return (
      <LegalGate user={user} onLogout={logout}><CustomerLayout user={user} onLogout={logout}>
        <PageErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/customer/home" element={<CustomerHome user={user} />} />
            <Route path="/customer/explore" element={<CustomerExplore />} />
            <Route path="/customer/scan" element={<CustomerScan user={user} />} />
            <Route path="/customer/rewards" element={<CustomerRewards user={user} />} />
            <Route path="/customer/profile" element={<CustomerProfile user={user} onLogout={logout} />} />
            <Route path="/customer/favorites" element={<CustomerFavorites />} />
            <Route path="/customer/transactions" element={<CustomerTransactions user={user} />} />
            <Route path="/customer/offers" element={<CustomerOffers />} />
            <Route path="/customer/notifications" element={<CustomerNotifications />} />
            <Route path="/customer/referral" element={<CustomerReferral user={user} />} />
            <Route path="*" element={<Navigate to="/customer/home" replace />} />
          </Routes>
        </PageErrorBoundary>
      </CustomerLayout></LegalGate>
    );
  }

  if (user.role === 'field_manager') {
    return <LegalGate user={user} onLogout={logout}><Layout user={user} onLogout={logout}><PageErrorBoundary key={location.pathname}><Routes><Route path="/field" element={<FieldManager user={user} onLogout={logout} />} /><Route path="/field/merchants/:id" element={<FieldMerchantVisit />} /><Route path="*" element={<Navigate to="/field" replace />} /></Routes></PageErrorBoundary></Layout></LegalGate>;
  }

  return (
    <LegalGate user={user} onLogout={logout}><Layout user={user} onLogout={logout}>
      <PageErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/dashboard" element={user.role === 'merchant' ? <MerchantOverview user={user} /> : user.role === 'admin' ? <AdminDashboard user={user} /> : <Dashboard user={user} />} />
          <Route path="/add-customer" element={<AddCustomer user={user} />} />
          <Route path="/merchant-points" element={<RoleRoute user={user} role="merchant"><MerchantPoints user={user} /></RoleRoute>} />
          <Route path="/orders" element={<Orders user={user} />} />
          <Route path="/customer-orders" element={<CustomerOrders user={user} />} />
          <Route path="/customer-product-lists" element={<RoleRoute user={user} role="admin"><ProductLists /></RoleRoute>} />
          <Route path="/customers" element={user.role === 'merchant' && new URLSearchParams(location.search).get('view') !== 'qr' ? <MerchantOverview user={user} /> : <Customers user={user} />} />
          <Route path="/products" element={<Products user={user} />} />
          <Route path="/offers" element={<Offers user={user} />} />
          <Route path="/rewards" element={<Rewards user={user} />} />
          <Route path="/more" element={<More user={user} onLogout={logout} />} />
          <Route path="/merchant-profile" element={<RoleRoute user={user} role="merchant"><MerchantProfile user={user} /></RoleRoute>} />
          <Route path="/feedback" element={<Feedback user={user} />} />
          <Route path="/reward-settings" element={<RewardSettingsPage user={user} />} />
          <Route path="/merchants" element={<RoleRoute user={user} role="admin"><Merchants /></RoleRoute>} />
          <Route path="/merchant-categories" element={<RoleRoute user={user} role="admin"><MerchantCategories /></RoleRoute>} />
          <Route path="/merchants/:id" element={<RoleRoute user={user} role="admin"><ReadOnlyProfiles kind="merchant" /></RoleRoute>} />
          <Route path="/field-managers/:id" element={<RoleRoute user={user} role="admin"><ReadOnlyProfiles kind="manager" /></RoleRoute>} />
          <Route path="/locations" element={<RoleRoute user={user} role="admin"><Locations /></RoleRoute>} />
          <Route path="/locations/:id" element={<RoleRoute user={user} role="admin"><LocationProfile /></RoleRoute>} />
          <Route path="/administrators" element={<RoleRoute user={user} role="admin"><Administrators /></RoleRoute>} />
          <Route path="/field-managers" element={<RoleRoute user={user} role="admin"><FieldManagers /></RoleRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </PageErrorBoundary>
    </Layout></LegalGate>
  );
}
