import { uiText } from '../uiText';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Gift, User, Menu, X, LogOut, Languages, Search, ListPlus } from 'lucide-react';
import { UserProfile } from '../types';
import { CustomerBillPopup } from './CustomerBillPopup';

export function CustomerLayout({ user, onLogout, children }: { user: UserProfile; onLogout?: () => void; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => setSidebarOpen(false), [location.pathname]);
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme || (localStorage.getItem('ae_theme') === 'dark' ? 'dark' : 'light');
    root.dataset.theme = 'light';
    root.style.colorScheme = 'light';
    return () => {
      root.dataset.theme = previousTheme;
      root.style.colorScheme = previousTheme;
    };
  }, []);
  useEffect(() => {
    localStorage.setItem('ae_language', i18n.language);
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div className="app-shell theme-green customer-glass">
      <CustomerBillPopup key={user.id} customerId={user.id} />
      <header className="topbar hidden md:flex">
        <div className="topbar-left">
          <button className="icon-button mobile-menu" title={uiText("Open menu")} onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="brand"><img src="/logo.png" alt={uiText("AE")} style={{ height: '36px', width: 'auto', objectFit: 'contain' }} /></div>
        </div>
        <div className="topbar-right">
          <label className="language-control" title={t('language.malayalam')}>
            <Languages size={17} />
            <select
              value={i18n.language.startsWith('ml') ? 'ml' : 'en'}
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
              aria-label={t('language.malayalam')}
            >
              <option value="en">{uiText("EN")}</option>
              <option value="ml">മ</option>
            </select>
          </label>
          <span className="role-pill merchant">{t('layout.customer') || 'Customer'}</span>
          <span className="topbar-user">{user.full_name || user.phone || 'Customer'}</span>
          <button className="button secondary signout" onClick={onLogout}><LogOut size={15} />{t('layout.signOut')}</button>
        </div>
      </header>
      <div className="shell-body">
        {sidebarOpen ? <button className="sidebar-backdrop" aria-label={uiText("Close menu")} onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={`sidebar hidden md:flex ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-mobile-head"><strong>{t('layout.navigation')}</strong><button className="icon-button" title={t('common.close')} onClick={() => setSidebarOpen(false)}><X /></button></div>
          <nav>
            <NavLink to="/customer/home" className={({ isActive }) => isActive && !location.search.includes('productList=1') ? 'active' : ''}>
              <Home size={18} /><span>{uiText("Home")}</span>
            </NavLink>
            <NavLink to="/customer/explore" className={({ isActive }) => isActive ? 'active' : ''}>
              <Search size={18} /><span>{uiText("Explore")}</span>
            </NavLink>
            <NavLink to="/customer/home?productList=1" className={() => location.search.includes('productList=1') ? 'active' : ''}>
              <ListPlus size={18} /><span>{uiText("Products list")}</span>
            </NavLink>
            <NavLink to="/customer/offers" className={({ isActive }) => isActive ? 'active' : ''}>
              <Gift size={18} /><span>{uiText("Offers")}</span>
            </NavLink>
            <NavLink to="/customer/profile" className={({ isActive }) => isActive ? 'active' : ''}>
              <User size={18} /><span>{uiText("Profile")}</span>
            </NavLink>
          </nav>
          <div className="sidebar-foot" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><span className="status-dot online" /> {t('layout.secureWorkspace')}</div>
            <button className="button secondary signout desktop-view-hidden" onClick={onLogout} style={{ width: '100%', justifyContent: 'center' }}>
              <LogOut size={15} />{t('layout.signOut')}
            </button>
          </div>
        </aside>
        <main className="main-content max-w-[430px] mx-auto bg-white relative min-h-screen border-x border-gray-100 shadow-[0_0_40px_rgba(0,0,0,0.05)] w-full !p-0">
          {children}
        </main>
      </div>
      <nav className="mobile-bottom-nav customer-bottom-nav md:hidden" aria-label={uiText("Customer navigation")}>
        <NavLink to="/customer/home" end className={({ isActive }) => isActive && !location.search.includes('productList=1') ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <Home size={21} /><span>{uiText("Home")}</span>
        </NavLink>
        <NavLink to="/customer/explore" className={({ isActive }) => isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <Search size={21} /><span>{uiText("Explore")}</span>
        </NavLink>
        <NavLink to="/customer/home?productList=1" className={() => location.search.includes('productList=1') ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <ListPlus size={21} /><span>{uiText("Products list")}</span>
        </NavLink>
        <NavLink to="/customer/offers" className={({ isActive }) => isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <Gift size={21} /><span>{uiText("Offers")}</span>
        </NavLink>
        <NavLink to="/customer/profile" className={({ isActive }) => isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <User size={21} /><span>{uiText("Profile")}</span>
        </NavLink>
      </nav>
    </div>
  );
}
