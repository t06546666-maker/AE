import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Activity, ArrowUpRight, Building2, ChevronRight, CircleDollarSign, Gift, ListChecks, Plus, ReceiptText, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import type { DashboardData, Merchant, Offer, UserProfile } from '../types';
import { dateInput, formatCurrency, formatPoints } from '../utils';

const empty: DashboardData = { summary: { totalOrders: 0, totalRevenue: 0, rewardPointsIssued: 0, totalCustomers: 0 }, intervals: [], retention: { lifetimeCustomers: 0, selectedVisits: 0, todayVisits: 0, weekVisits: 0, monthVisits: 0 } };

export function AdminDashboard({ user }: { user: UserProfile }) {
  const today = dateInput();
  const dashboard = useQuery({ queryKey: ['admin-dashboard', today], queryFn: () => apiFetch<DashboardData>(`/api/dashboard?from=${today}&to=${today}`) });
  const customers = useQuery({ queryKey: ['admin-dashboard-customers'], queryFn: () => apiFetch<{ customers: unknown[]; pagination?: { total?: number } }>('/api/customers?page=1&pageSize=1') });
  const merchants = useQuery({ queryKey: ['admin-dashboard-merchants'], queryFn: () => apiFetch<{ merchants: Merchant[]; pagination?: { total?: number } }>('/api/merchants?page=1&pageSize=1') });
  const offers = useQuery({ queryKey: ['admin-dashboard-offers'], queryFn: () => apiFetch<{ offers: Offer[] }>('/api/offers?page=1&pageSize=50') });
  const lists = useQuery({ queryKey: ['admin-dashboard-lists'], queryFn: () => apiFetch<{ requests: Array<{ id: string; status: string; product_list?: string; merchants?: { name?: string }; customers?: { name?: string } }> }>('/api/product-list-requests') });
  const data = dashboard.data || empty;
  const merchantTotal = merchants.data?.pagination?.total ?? merchants.data?.merchants?.length ?? 0;
  const customerTotal = customers.data?.pagination?.total ?? customers.data?.customers?.length ?? data.summary.totalCustomers;
  const pendingOffers = (offers.data?.offers || []).filter((item) => item.status === 'pending');
  const pendingLists = (lists.data?.requests || []).filter((item) => item.status === 'pending');
  const max = Math.max(1, ...data.intervals.map((item) => item.revenue));
  const name = user.full_name?.split(' ')[0] || 'Admin';

  return <div className="admin-dashboard">
    <div className="admin-dashboard-heading"><div><p className="admin-eyebrow">AFFILIATE AE · ADMIN PANEL</p><h1>Good morning, {name} <span aria-hidden>👋</span></h1><p>Here’s what’s happening across your network today.</p></div><div className="admin-heading-actions"><span className="admin-date-chip">Today <ChevronRight size={15} /></span><Link className="button primary" to="/offers"><ArrowUpRight size={16} /> Export report</Link></div></div>
    <div className="admin-kpis">
      <Kpi icon={<Users />} label="Total customers" value={customerTotal.toLocaleString()} tone="blue" />
      <Kpi icon={<Building2 />} label="Active merchants" value={merchantTotal.toLocaleString()} tone="purple" />
      <Kpi icon={<CircleDollarSign />} label="Total sales" value={formatCurrency(data.summary.totalRevenue)} tone="green" />
      <Kpi icon={<Gift />} label="Points issued" value={formatPoints(data.summary.rewardPointsIssued)} tone="orange" />
    </div>
    <div className="admin-dashboard-grid">
      <section className="admin-card admin-chart-card"><div className="admin-card-title"><div><h2>Sales and customer growth</h2><p>Revenue recorded for the selected period</p></div><Link to="/orders">View reports <ArrowUpRight size={15} /></Link></div><div className="admin-bars">{(data.intervals.length ? data.intervals : [{ label: 'Today', revenue: 0, orders: 0 }]).map((item) => <div className="admin-bar-column" key={item.label}><div className="admin-bar" style={{ height: `${Math.max(8, (item.revenue / max) * 150)}px` }} title={formatCurrency(item.revenue)} /><span>{item.label}</span></div>)}</div></section>
      <section className="admin-card"><div className="admin-card-title"><div><h2>Approval queue</h2><p>Items needing your attention</p></div><ListChecks size={20} /></div><QueueRow icon={<Gift />} label="Offers awaiting review" count={pendingOffers.length} href="/offers" /><QueueRow icon={<ReceiptText />} label="Product lists" count={pendingLists.length} href="/customer-product-lists" /><QueueRow icon={<ShieldCheck />} label="Merchant accounts" count={0} href="/merchants" /></section>
    </div>
    <div className="admin-dashboard-grid lower"><section className="admin-card"><div className="admin-card-title"><div><h2>Quick actions</h2><p>Jump straight into common tasks</p></div></div><div className="admin-quick-actions"><QuickAction icon={<Plus />} text="Add customer" href="/add-customer" /><QuickAction icon={<Building2 />} text="Add merchant" href="/merchants" /><QuickAction icon={<Gift />} text="Review offers" href="/offers" /><QuickAction icon={<Activity />} text="Reward settings" href="/reward-settings" /></div></section><section className="admin-card"><div className="admin-card-title"><div><h2>Network snapshot</h2><p>Live totals from Supabase</p></div></div><div className="admin-snapshot"><div><strong>{data.summary.totalOrders.toLocaleString()}</strong><span>Transactions today</span></div><div><strong>{data.retention.monthVisits.toLocaleString()}</strong><span>Visits this month</span></div><div><strong>{pendingOffers.length + pendingLists.length}</strong><span>Pending reviews</span></div></div></section></div>
  </div>;
}

function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) { return <div className={`admin-kpi ${tone}`}><div className="admin-kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small><ArrowUpRight size={13} /> Live data</small></div></div>; }
function QueueRow({ icon, label, count, href }: { icon: ReactNode; label: string; count: number; href: string }) { return <Link className="admin-queue-row" to={href}><span className="admin-queue-icon">{icon}</span><span>{label}</span><strong>{count}</strong><ChevronRight size={16} /></Link>; }
function QuickAction({ icon, text, href }: { icon: ReactNode; text: string; href: string }) { return <Link className="admin-quick-action" to={href}>{icon}<span>{text}</span><ChevronRight size={15} /></Link>; }
