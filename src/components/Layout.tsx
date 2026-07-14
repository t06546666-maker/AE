import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BadgeIndianRupee, Building2, LayoutDashboard, LogOut, Menu, Moon, Plus,
  ReceiptText, Settings2, Sun, UserCog, Users, X,
} from 'lucide-react';
import { apiFetch } from '../api';
import type { UserProfile } from '../types';

const adminNav = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/add-customer', 'Add Customer', Plus],
  ['/orders', 'Order List', ReceiptText],
  ['/customers', 'Customers & QR', Users],
  ['/merchants', 'Merchants', Building2],
  ['/administrators', 'Administrators', UserCog],
  ['/reward-settings', 'Reward Settings', Settings2],
] as const;

const merchantNav = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/add-customer', 'Add Buyer', Plus],
  ['/orders', 'Order List', ReceiptText],
  ['/customers', 'Customers & QR', Users],
  ['/reward-settings', 'Reward Settings', BadgeIndianRupee],
] as const;

export function Layout({ user, onLogout, children }: { user: UserProfile; onLogout: () => void; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ae_theme') || 'light');
  const location = useLocation();
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

  const nav = user.role === 'admin' ? adminNav : merchantNav;
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-menu" title="Open menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="brand"><span>Affiliate</span><small>AE</small></div>
        </div>
        <div className="topbar-right">
          <div className="integration-health" title="Integration status">
            <span className={status.data?.resend ? 'online' : 'offline'}>Email</span>
            <span className={status.data?.whatsapp ? 'online' : 'offline'}>WhatsApp</span>
          </div>
          <button className="icon-button" title={theme === 'dark' ? 'Use light mode' : 'Use night mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <span className={`role-pill ${user.role}`}>{user.role === 'admin' ? 'Admin' : 'Merchant'}</span>
          <span className="topbar-user">{user.full_name || user.email}</span>
          <button className="button secondary signout" onClick={onLogout}><LogOut size={15} />Sign out</button>
        </div>
      </header>
      <div className="shell-body">
        {sidebarOpen ? <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-mobile-head"><strong>Navigation</strong><button className="icon-button" title="Close menu" onClick={() => setSidebarOpen(false)}><X /></button></div>
          <nav>
            {nav.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive || (to === '/merchants' && location.pathname.startsWith('/merchants/')) ? 'active' : ''}>
                <Icon size={18} /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="status-dot online" /> Secure workspace
          </div>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
