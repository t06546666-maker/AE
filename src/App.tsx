import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ApiError, apiFetch, clearAccessToken, getAccessToken } from './api';
import { Layout } from './components/Layout';
import { CustomerLayout } from './components/CustomerLayout';
import { useTranslation } from 'react-i18next';
import { LegalGate } from './components/LegalGate';
import { useUsageTracking } from './useUsageTracking';
import type { Role, UserProfile } from './types';

// Keep the startup bundle small. Route pages load only when needed, then the
// common next screens can be warmed after the first screen has appeared.
const AddCustomer = lazy(() => import('./pages/AddCustomer').then(m => ({ default: m.AddCustomer })));
const Administrators = lazy(() => import('./pages/Administrators').then(m => ({ default: m.Administrators })));
const ChangePassword = lazy(() => import('./pages/ChangePassword').then(m => ({ default: m.ChangePassword })));
const Legal = lazy(() => import('./pages/Legal').then(m => ({ default: m.Legal })));
const AccountDeletion = lazy(() => import('./pages/AccountDeletion').then(m => ({ default: m.AccountDeletion })));
const ReadOnlyProfiles = lazy(() => import('./pages/ReadOnlyProfiles').then(m => ({ default: m.ReadOnlyProfiles })));
const Customers = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const MerchantOverview = lazy(() => import('./pages/MerchantOverview').then(m => ({ default: m.MerchantOverview })));
const MerchantPoints = lazy(() => import('./pages/MerchantPoints').then(m => ({ default: m.MerchantPoints })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Expenses = lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const ExpenseStaff = lazy(() => import('./pages/ExpenseStaff').then(m => ({ default: m.ExpenseStaff })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Locations = lazy(() => import('./pages/Locations').then(m => ({ default: m.Locations })));
const LocationProfile = lazy(() => import('./pages/LocationProfile').then(m => ({ default: m.LocationProfile })));
const MerchantProfile = lazy(() => import('./pages/MerchantProfile').then(m => ({ default: m.MerchantProfile })));
const AdminMerchantDetails = lazy(() => import('./pages/AdminMerchantDetails').then(m => ({ default: m.AdminMerchantDetails })));
const MerchantQrPoster = lazy(() => import('./pages/MerchantQrPoster').then(m => ({ default: m.MerchantQrPoster })));
const QrCommon = lazy(() => import('./pages/QrCommon').then(m => ({ default: m.QrCommon })));
const AdminCustomers = lazy(() => import('./pages/AdminCustomers').then(m => ({ default: m.AdminCustomers })));
const AdminCustomerDetails = lazy(() => import('./pages/AdminCustomers').then(m => ({ default: m.AdminCustomerDetails })));
const LegalNavigation = lazy(() => import('./components/LegalNavigation').then(m => ({ default: m.LegalNavigation })));
const CustomerShopScan = lazy(() => import('./components/ShopCheckout').then(m => ({ default: m.CustomerShopScan })));
const MerchantShopCheckout = lazy(() => import('./components/ShopCheckout').then(m => ({ default: m.MerchantShopCheckout })));
const ShopRequestAlert = lazy(() => import('./components/ShopCheckout').then(m => ({ default: m.ShopRequestAlert })));
const Merchants = lazy(() => import('./pages/Merchants').then(m => ({ default: m.Merchants })));
const MerchantCategories = lazy(() => import('./pages/MerchantCategories').then(m => ({ default: m.MerchantCategories })));
const Offers = lazy(() => import('./pages/Offers').then(m => ({ default: m.Offers })));
const Orders = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Products = lazy(() => import('./pages/Products').then(m => ({ default: m.Products })));
const CustomerOrders = lazy(() => import('./pages/CustomerOrders').then(m => ({ default: m.CustomerOrders })));
const ProductLists = lazy(() => import('./pages/ProductLists').then(m => ({ default: m.ProductLists })));
const RewardSettingsPage = lazy(() => import('./pages/RewardSettings').then(m => ({ default: m.RewardSettingsPage })));
const More = lazy(() => import('./pages/More').then(m => ({ default: m.More })));
const Feedback = lazy(() => import('./pages/Feedback').then(m => ({ default: m.Feedback })));
const Rewards = lazy(() => import('./pages/Rewards').then(m => ({ default: m.Rewards })));
const CustomerHome = lazy(() => import('./pages/customer/Home').then(m => ({ default: m.CustomerHome })));
const CustomerExplore = lazy(() => import('./pages/customer/Explore').then(m => ({ default: m.CustomerExplore })));
const CustomerLogin = lazy(() => import('./pages/customer/CustomerLogin').then(m => ({ default: m.CustomerLogin })));
const CustomerSignup = lazy(() => import('./pages/customer/CustomerSignup').then(m => ({ default: m.CustomerSignup })));
const CustomerChangePassword = lazy(() => import('./pages/customer/CustomerChangePassword').then(m => ({ default: m.CustomerChangePassword })));
const CustomerForgotPassword = lazy(() => import('./pages/customer/CustomerForgotPassword').then(m => ({ default: m.CustomerForgotPassword })));
const CustomerRewards = lazy(() => import('./pages/customer/Rewards').then(m => ({ default: m.CustomerRewards })));
const CustomerProfile = lazy(() => import('./pages/customer/Profile').then(m => ({ default: m.CustomerProfile })));
const CustomerTransactions = lazy(() => import('./pages/customer/Transactions').then(m => ({ default: m.CustomerTransactions })));
const CustomerOffers = lazy(() => import('./pages/customer/Offers').then(m => ({ default: m.CustomerOffers })));
const CustomerNotifications = lazy(() => import('./pages/customer/Notifications').then(m => ({ default: m.CustomerNotifications })));
const CustomerReferral = lazy(() => import('./pages/customer/Referral').then(m => ({ default: m.CustomerReferral })));
const CustomerFavorites = lazy(() => import('./pages/customer/Favorites').then(m => ({ default: m.CustomerFavorites })));
const FieldManager = lazy(() => import('./pages/FieldManager').then(m => ({ default: m.FieldManager })));
const FieldManagers = lazy(() => import('./pages/FieldManagers').then(m => ({ default: m.FieldManagers })));
const FieldMerchantVisit = lazy(() => import('./pages/FieldMerchantVisit').then(m => ({ default: m.FieldMerchantVisit })));

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

function StartupFallback({ message = 'Opening AE…' }: { message?: string }) {
  return <div className="boot-screen"><div className="boot-brand"><img src="/logo.png" alt="AE" /></div><span>{message}</span></div>;
}

function RouteFallback() {
  return <div className="state-panel" role="status"><span>Loading this screen…</span></div>;
}

export function App() {
  useTranslation(undefined, { bindI18n: 'languageChanged loaded' });
  const [user, setUser] = useState<UserProfile | null>(null);
  useUsageTracking(user);
  const [restoring, setRestoring] = useState(Boolean(getAccessToken()));
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const warmScreens = () => {
      const loads = user.role === 'customer'
        ? [import('./pages/customer/Explore'), import('./pages/customer/Offers'), import('./pages/customer/Transactions'), import('./pages/customer/Notifications')]
        : user.role === 'merchant'
          ? [import('./pages/Orders'), import('./pages/AddCustomer'), import('./pages/Products'), import('./pages/Offers')]
          : user.role === 'admin'
            ? [import('./pages/Merchants'), import('./pages/Orders'), import('./pages/Products'), import('./pages/AdminCustomers')]
            : [import('./pages/FieldMerchantVisit')];
      void Promise.all(loads).catch(() => { /* The route will retry on demand if preloading fails. */ });
    };
    const timer = window.setTimeout(warmScreens, 8000);
    return () => window.clearTimeout(timer);
  }, [user?.id, user?.role]);

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
    let setupTimer: number | undefined;
    let registrationTimer: ReturnType<typeof setTimeout> | undefined;
    let registrationRetryTimer: ReturnType<typeof setInterval> | undefined;
    let registrationAttempts = 0;
    const reportPush = (message: string) => window.dispatchEvent(new CustomEvent('ae:push-status', { detail: message }));
    if (user && CapacitorApp && Capacitor.isNativePlatform()) {
      // Let the authenticated screen paint before loading native notification
      // and location code or showing any permission prompts.
      setupTimer = window.setTimeout(() => { void Promise.all([
        import('@capacitor/push-notifications'),
        import('@capacitor/geolocation'),
      ]).then(async ([{ PushNotifications }, { Geolocation }]) => {
        // Ask for the permissions needed by the native app at first use.
        // Android controls the actual system prompts; GPS cannot be enabled silently.
        // Location permission must never block push registration.
        if (!['staff','account_head'].includes(user.role)) void Geolocation.checkPermissions().then(status => {
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

        // Install delivery and tap handlers before register() so a fast token
        // registration or a notification that opens a cold app is not missed.
        listeners.push(await PushNotifications.addListener('pushNotificationReceived', () => {
          void queryClient.invalidateQueries({ queryKey: ['customer'] });
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          reportPush('A notification was received on this phone.');
        }));

        listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          if (typeof notification.notification.data?.url === 'string' && notification.notification.data.url.startsWith('/') && !notification.notification.data.url.startsWith('//')) {
            navigate(notification.notification.data.url);
          }
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
      }).catch((error) => reportPush(`Notification setup failed: ${error.message}`)); }, 8000);
    }
    return () => { disposed = true; clearTimeout(setupTimer); clearTimeout(registrationTimer); if (registrationRetryTimer) clearInterval(registrationRetryTimer); for (const listener of listeners) void listener.remove(); };
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

  if (location.pathname === '/delete-account') return <Suspense fallback={<StartupFallback />}><AccountDeletion /></Suspense>;
  if (import.meta.env.DEV && location.pathname === '/consent-preview') {
    const role = new URLSearchParams(location.search).get('role') === 'merchant' ? 'merchant' : 'customer';
    return <LegalGate preview user={{ id: 'local-preview', email: '', full_name: 'Preview', role, merchant_id: null }} onLogout={() => navigate('/customer/login')}>{null}</LegalGate>;
  }
  if (location.pathname === '/legal' || location.pathname === '/terms' || location.pathname === '/privacy') return <Suspense fallback={<StartupFallback />}><LegalNavigation backTo={user?.role === 'customer' ? '/customer/profile' : user?.role === 'merchant' ? '/more' : user?.role === 'field_manager' ? '/field' : user?.role === 'admin' ? '/dashboard' : '/customer/login'}><Legal /></LegalNavigation></Suspense>;
  if (restoring) return <div className="boot-screen"><div className="boot-brand"><img src="/logo.png" alt="AE" /></div></div>;
  if (restoreError && !user) return <div className="state-panel error-state"><strong>Your saved session has been kept.</strong><span>{restoreError}</span><button className="button primary" onClick={() => { setRestoreError(''); setRestoring(true); setRestoreAttempt(value => value + 1); }}>Retry connection</button><button className="button" onClick={() => { setRestoreError(''); logout(); }}>Sign out</button></div>;
  if (!user) {
    if (location.pathname === '/expenses' || location.pathname === '/accounts') return <Suspense fallback={<StartupFallback />}><Expenses user={null} onLogin={setUser} onLogout={logout} accounts={location.pathname==='/accounts'}/></Suspense>;
    return (
      <Suspense fallback={<StartupFallback />}><Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/customer/forgot-password" element={<CustomerForgotPassword />} />
        <Route path="/customer/login" element={<CustomerLogin onLogin={setUser} />} />
        <Route path="/customer/signup" element={<CustomerSignup onLogin={setUser} />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="/field" element={<Login field onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/customer/login" replace />} />
      </Routes></Suspense>
    );
  }
  if (user.must_change_password) {
    return user.role === 'customer' 
      ? <Suspense fallback={<StartupFallback message="Opening your account…" />}><CustomerChangePassword onChanged={() => {
          setUser({ ...user, must_change_password: false });
          void queryClient.invalidateQueries();
        }} /></Suspense>
      : <Suspense fallback={<StartupFallback message="Opening your account…" />}><ChangePassword onChanged={() => {
          setUser({ ...user, must_change_password: false });
          void queryClient.invalidateQueries();
        }} /></Suspense>;
  }

  if (location.pathname === '/expenses' || location.pathname === '/accounts') return <Suspense fallback={<StartupFallback />}><Expenses user={user} onLogin={setUser} onLogout={logout} accounts={location.pathname==='/accounts'}/></Suspense>;
  if (user.role === 'staff' || user.role === 'account_head') return <Navigate to={user.role==='account_head'?'/accounts':'/expenses'} replace/>;
  if (location.pathname === '/field' && user.role !== 'field_manager') {
    return <div className="state-panel"><h1>Field Manager portal</h1><p>You are signed in as {user.role}. Sign out here to use a field manager account, or open /field in a separate browser profile.</p><button className="button primary" onClick={logout}>Sign out to Field Manager Login</button><button className="button secondary" onClick={() => navigate(user.role === 'customer' ? '/customer/home' : '/dashboard')}>Back to my dashboard</button></div>;
  }

  if (user.role === 'customer') {
    return (
      <LegalGate user={user} onLogout={logout}><CustomerLayout user={user} onLogout={logout}>
        <PageErrorBoundary key={location.pathname}>
          <Suspense fallback={<RouteFallback />}><Routes>
            <Route path="/customer/home" element={<CustomerHome user={user} />} />
            <Route path="/customer/explore" element={<CustomerExplore />} />
            <Route path="/customer/scan" element={<Navigate to="/customer/shop-scan" replace />} />
            <Route path="/customer/shop-scan" element={<CustomerShopScan key={location.search} user={user} />} />
            <Route path="/customer/rewards" element={<CustomerRewards user={user} />} />
            <Route path="/customer/profile" element={<CustomerProfile user={user} onLogout={logout} />} />
            <Route path="/customer/favorites" element={<CustomerFavorites />} />
            <Route path="/customer/transactions" element={<CustomerTransactions user={user} />} />
            <Route path="/customer/offers" element={<CustomerOffers />} />
            <Route path="/customer/notifications" element={<CustomerNotifications />} />
            <Route path="/customer/referral" element={<CustomerReferral user={user} />} />
            <Route path="*" element={<Navigate to="/customer/home" replace />} />
          </Routes></Suspense>
        </PageErrorBoundary>
      </CustomerLayout></LegalGate>
    );
  }

  if (user.role === 'field_manager') {
    return <LegalGate user={user} onLogout={logout}><Layout user={user} onLogout={logout}><PageErrorBoundary key={location.pathname}><Suspense fallback={<RouteFallback />}><Routes><Route path="/field" element={<FieldManager user={user} onLogout={logout} />} /><Route path="/field/merchants/:id" element={<FieldMerchantVisit />} /><Route path="*" element={<Navigate to="/field" replace />} /></Routes></Suspense></PageErrorBoundary></Layout></LegalGate>;
  }

  return (
    <LegalGate user={user} onLogout={logout}><Layout user={user} onLogout={logout}>
      {user.role === 'merchant' && <Suspense fallback={null}><ShopRequestAlert /></Suspense>}
      <PageErrorBoundary key={location.pathname}>
        <Suspense fallback={<RouteFallback />}><Routes>
          <Route path="/dashboard" element={user.role === 'merchant' ? <MerchantOverview user={user} /> : user.role === 'admin' ? <AdminDashboard user={user} /> : <Dashboard user={user} />} />
          <Route path="/expense-staff" element={<RoleRoute user={user} role="admin"><ExpenseStaff/></RoleRoute>}/>
          <Route path="/add-customer" element={<AddCustomer user={user} />} />
          <Route path="/merchant-points" element={<RoleRoute user={user} role="merchant"><MerchantPoints user={user} /></RoleRoute>} />
          <Route path="/orders" element={<Orders user={user} />} />
          <Route path="/shop-checkout" element={<RoleRoute user={user} role="merchant"><MerchantShopCheckout /></RoleRoute>} />
          <Route path="/customer-orders" element={<CustomerOrders user={user} />} />
          <Route path="/customer-product-lists" element={<RoleRoute user={user} role="admin"><ProductLists /></RoleRoute>} />
          <Route path="/customers" element={user.role === 'admin' ? <AdminCustomers /> : user.role === 'merchant' && new URLSearchParams(location.search).get('view') !== 'qr' ? <MerchantOverview user={user} /> : <Customers user={user} />} />
          <Route path="/customers/:id" element={<RoleRoute user={user} role="admin"><AdminCustomerDetails /></RoleRoute>} />
          <Route path="/products" element={<Products user={user} />} />
          <Route path="/offers" element={<Offers user={user} />} />
          <Route path="/rewards" element={<Rewards user={user} />} />
          <Route path="/more" element={<More user={user} onLogout={logout} />} />
          <Route path="/merchant-profile" element={<RoleRoute user={user} role="merchant"><MerchantProfile user={user} /></RoleRoute>} />
          <Route path="/feedback" element={<Feedback user={user} />} />
          <Route path="/reward-settings" element={<RewardSettingsPage user={user} />} />
          <Route path="/merchants" element={<RoleRoute user={user} role="admin"><Merchants /></RoleRoute>} />
          <Route path="/add-merchant" element={<RoleRoute user={user} role="admin"><Merchants onboardingOnly /></RoleRoute>} />
          <Route path="/merchant-categories" element={<RoleRoute user={user} role="admin"><MerchantCategories /></RoleRoute>} />
          <Route path="/merchants/:id" element={<RoleRoute user={user} role="admin"><AdminMerchantDetails /></RoleRoute>} />
          <Route path="/merchants/:id/qr-poster" element={<RoleRoute user={user} role="admin"><MerchantQrPoster /></RoleRoute>} />
          <Route path="/qr-common" element={<RoleRoute user={user} role="admin"><QrCommon /></RoleRoute>} />
          <Route path="/field-managers/:id" element={<RoleRoute user={user} role="admin"><ReadOnlyProfiles kind="manager" /></RoleRoute>} />
          <Route path="/locations" element={<RoleRoute user={user} role="admin"><Locations /></RoleRoute>} />
          <Route path="/locations/:id" element={<RoleRoute user={user} role="admin"><LocationProfile /></RoleRoute>} />
          <Route path="/administrators" element={<RoleRoute user={user} role="admin"><Administrators /></RoleRoute>} />
          <Route path="/field-managers" element={<RoleRoute user={user} role="admin"><FieldManagers /></RoleRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes></Suspense>
      </PageErrorBoundary>
    </Layout></LegalGate>
  );
}
