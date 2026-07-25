import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BadgeIndianRupee, Building2, Gift, Languages, LayoutDashboard, LogOut, Menu, Moon, Plus,
  ReceiptText, Settings2, Sun, UserCog, Users, X,
} from 'lucide-react';
import { apiFetch } from '../api';
import type { UserProfile } from '../types';

const adminNav = [
  ['/dashboard', 'nav.dashboard', LayoutDashboard],
  ['/add-customer', 'nav.addCustomer', Plus],
  ['/orders', 'nav.orders', ReceiptText],
  ['/customers', 'nav.customers', Users],
  ['/merchants', 'nav.merchants', Building2],
  ['/offers', 'nav.offers', Gift],
  ['/administrators', 'nav.administrators', UserCog],
  ['/reward-settings', 'nav.rewardSettings', Settings2],
] as const;

const merchantNav = [
  ['/dashboard', 'nav.dashboard', LayoutDashboard],
  ['/add-customer', 'nav.addBuyer', Plus],
  ['/orders', 'nav.orders', ReceiptText],
  ['/customers', 'nav.customers', Users],
  ['/offers', 'nav.offers', Gift],
  ['/reward-settings', 'nav.rewardSettings', BadgeIndianRupee],
] as const;

export function Layout({ user, onLogout, children }: { user: UserProfile; onLogout: () => void; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ae_theme') || 'light');
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => apiFetch<{ supabase: boolean; resend: boolean; whatsapp: boolean }>('/api/status', { signal }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  useEffect(() => setSidebarOpen(false), [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ae_theme', theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('ae_language', i18n.language);
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const nav = user.role === 'admin' ? adminNav : merchantNav;
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-menu" title="Open menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="brand"><span>Affiliate</span><small>AE</small></div>
        </div>
        <div className="topbar-right">
          <div className="integration-health" title={t('layout.integrationStatus')}>
            <span className={status.data?.resend ? 'online' : 'offline'}>{t('layout.email')}</span>
            <span className={status.data?.whatsapp ? 'online' : 'offline'}>{t('layout.whatsapp')}</span>
          </div>
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
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <span className={`role-pill ${user.role}`}>{user.role === 'admin' ? t('layout.admin') : t('layout.merchant')}</span>
          <span className="topbar-user">{user.full_name || user.email}</span>
          <button className="button secondary signout" onClick={onLogout}><LogOut size={15} />{t('layout.signOut')}</button>
        </div>
      </header>
      <div className="shell-body">
        {sidebarOpen ? <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-mobile-head"><strong>{t('layout.navigation')}</strong><button className="icon-button" title={t('common.close')} onClick={() => setSidebarOpen(false)}><X /></button></div>
          <nav>
            {nav.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive || (to === '/merchants' && location.pathname.startsWith('/merchants/')) ? 'active' : ''}>
                <Icon size={18} /><span>{t(label)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="status-dot online" /> {t('layout.secureWorkspace')}
          </div>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
