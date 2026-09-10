import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, QrCode, Gift, User, MapPin, Menu, X, LogOut, Moon, Languages, Search, Scan, Star } from 'lucide-react';
import { UserProfile } from '../types';

export function CustomerLayout({ user, onLogout, children }: { user: UserProfile; onLogout?: () => void; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ae_theme') || 'light');
  const location = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => setSidebarOpen(false), [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ae_theme', theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('ae_language', i18n.language);
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div className="app-shell theme-green">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-menu" title="Open menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="brand"><span>Affiliate</span><small>AE</small></div>
        </div>
        <div className="topbar-right">
          <label className="language-control" title={t('language.malayalam')}>
            <Languages size={17} />
            <select
              value={i18n.language.startsWith('ml') ? 'ml' : 'en'}
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
              aria-label={t('language.malayalam')}
            >
              <option value="en">EN</option>
              <option value="ml">മ</option>
            </select>
          </label>
          <button className="icon-button" title={theme === 'dark' ? t('layout.lightMode') : t('layout.nightMode')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Moon /> : <Moon />}
          </button>
          <span className="role-pill merchant">{t('layout.customer') || 'Customer'}</span>
          <span className="topbar-user">{user.full_name || user.phone || 'Customer'}</span>
          <button className="button secondary signout" onClick={onLogout}><LogOut size={15} />{t('layout.signOut')}</button>
        </div>
      </header>
      <div className="shell-body">
        {sidebarOpen ? <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-mobile-head"><strong>{t('layout.navigation')}</strong><button className="icon-button" title={t('common.close')} onClick={() => setSidebarOpen(false)}><X /></button></div>
          <nav>
            <NavLink to="/customer/home" className={({ isActive }) => isActive ? 'active' : ''}>
              <Home size={18} /><span>Home</span>
            </NavLink>
            <NavLink to="/customer/explore" className={({ isActive }) => isActive ? 'active' : ''}>
              <MapPin size={18} /><span>Explore</span>
            </NavLink>
            <NavLink to="/customer/scan" className={({ isActive }) => isActive ? 'active' : ''}>
              <QrCode size={18} /><span>Scan QR</span>
            </NavLink>
            <NavLink to="/customer/rewards" className={({ isActive }) => isActive ? 'active' : ''}>
              <Gift size={18} /><span>Rewards</span>
            </NavLink>
            <NavLink to="/customer/profile" className={({ isActive }) => isActive ? 'active' : ''}>
              <User size={18} /><span>Profile</span>
            </NavLink>
          </nav>
          <div className="sidebar-foot" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><span className="status-dot online" /> {t('layout.secureWorkspace')}</div>
            <button className="button secondary signout desktop-view-hidden" onClick={onLogout} style={{ width: '100%', justifyContent: 'center' }}>
              <LogOut size={15} />{t('layout.signOut')}
            </button>
          </div>
        </aside>
        <main className="main-content max-w-[430px] mx-auto bg-white relative min-h-screen border-x border-gray-100 shadow-[0_0_40px_rgba(0,0,0,0.05)] w-full" style={{ padding: 0 }}>
          {children}
        </main>
      </div>
      <div className="mobile-bottom-nav desktop-view-hidden max-w-[430px] mx-auto left-0 right-0 border-x border-gray-100">
        <NavLink to="/customer/home" className={({ isActive }) => isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <Home />
          <span>Home</span>
        </NavLink>
        <NavLink to="/customer/explore" className={({ isActive }) => isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <Search />
          <span>Explore</span>
        </NavLink>
        <div className="mobile-bottom-nav-item" style={{ position: 'relative' }}>
          <NavLink to="/customer/scan" className="bg-[#087a4b] text-white rounded-full p-[12px] shadow-lg shadow-green-600/30 hover:bg-[#0a7a46] transition-all transform hover:scale-105 active:scale-95" style={{ position: 'absolute', top: '-24px' }}>
            <Scan size={26} strokeWidth={2} />
          </NavLink>
        </div>
        <NavLink to="/customer/rewards" className={({ isActive }) => isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <Star />
          <span>Rewards</span>
        </NavLink>
        <NavLink to="/customer/profile" className={({ isActive }) => isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'}>
          <User />
          <span>Profile</span>
        </NavLink>
      </div>
    </div>
  );
}
