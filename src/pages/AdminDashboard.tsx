import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Building2, ChevronRight, Download, Activity, Gift, ListChecks, ReceiptText, UserCog, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import type { DashboardData, Offer, UserProfile } from '../types';
import { formatCurrency, formatPoints } from '../utils';
import { uiText } from '../uiText';
import { AdminUsage } from '../components/AdminUsage';
import { ErrorState, LoadingState } from '../components/Common';
import '../admin-dashboard.css';
import { useAdminReportFilters } from '../components/AdminReportFilters';
import { AdminDashboardToolbar } from '../components/AdminDashboardToolbar';

export function AdminDashboard({ user }: { user: UserProfile }) {
 const filters=useAdminReportFilters();
 const areas=useQuery({queryKey:['admin-report-areas'],queryFn:()=>apiFetch<{areas:string[]}>('/api/admin/report-areas')});
 const dashboard=useQuery({queryKey:['admin-dashboard',filters.range?.from,filters.range?.to,filters.area],queryFn:()=>apiFetch<DashboardData>(`/api/admin/report-summary?${new URLSearchParams({...filters.range!,area:filters.area})}`),enabled:filters.valid});
 const totals=useQuery({queryKey:['admin-overview-totals'],queryFn:()=>apiFetch<Record<string,number|null>>('/api/admin/overview-totals'),refetchInterval:60000});
 const totalValue=(key:string,points=false)=>totals.isPending?'…':totals.isError||totals.data?.[key]==null?'—':points?formatPoints(totals.data[key]!):totals.data[key]!.toLocaleString('en-IN');
 const offers=useQuery({queryKey:['admin-dashboard-offers'],queryFn:()=>apiFetch<{offers:Offer[];pagination?:{total?:number}}>('/api/offers?page=1&pageSize=50')});
 const lists=useQuery({queryKey:['admin-dashboard-lists'],queryFn:()=>apiFetch<{requests:Array<{status:string}>}>('/api/product-list-requests')});
 const pendingOffers=offers.data?.offers.filter(item=>item.status==='pending').length;
 const pendingLists=lists.data?.requests.filter(item=>item.status==='pending').length;
 const moreOffers=(offers.data?.pagination?.total||0)>(offers.data?.offers.length||0);
 const count=(loading:boolean,error:boolean,n:number|undefined)=>loading?'…':error||n==null?'—':n.toLocaleString('en-IN');
 return <div className="admin-dashboard admin-overview-v2 admin-dashboard-compact">
 <header className="admin-dashboard-heading"><div><h1>{uiText('Overview')}</h1><p>{uiText('Your network at a glance')}</p></div></header>
 <div className="admin-kpis">
 <Kpi icon={<Building2/>} label="Total merchants" value={totalValue('merchants')} tone="blue" hint="All registered stores"/>
 <Kpi icon={<Users/>} label="Total customers" value={totalValue('customers')} tone="purple" hint="All customer accounts"/>
 <Kpi icon={<Gift/>} label="Total points issued" value={totalValue('pointsIssued',true)} tone="orange" hint="All-time purchases and loyalty rewards"/>
 <Kpi icon={<ReceiptText/>} label="Total points redeemed" value={totalValue('pointsRedeemed',true)} tone="green" hint="All-time recorded redemptions"/>
 <Kpi icon={<Download/>} label="App installations" value={totalValue('appInstallations')} tone="blue" hint="Observed Android sign-ins, not Play Store downloads"/>
 <Kpi icon={<Activity/>} label="Active app users" value={totalValue('activeAppUsers')} tone="purple" hint="Android accounts active in the last 5 minutes"/>
 </div>
 {(totals.isError||Object.values(totals.data||{}).some(value=>value==null))&&<p role="alert" className="admin-data-note">{uiText('Some account totals could not be loaded. Refresh to retry.')}</p>}
 <section className="admin-reporting-toolbar" aria-label={uiText('Activity & reports')}><h2>{uiText('Activity & reports')}</h2><AdminDashboardToolbar state={filters} areas={areas.data?.areas||[]} areaError={areas.isError}/></section>
 <div className="admin-dashboard-grid admin-overview-main"><AdminUsage range={filters.range||undefined} area={filters.area} valid={filters.valid}/><section className="admin-card"><div className="admin-card-title"><div><h2>{uiText('Needs attention')}</h2><p>{uiText('Review requests and manage your network')}</p></div><ListChecks size={20}/></div>
 <Queue icon={<Gift/>} label="Offer approvals" count={offers.isPending?'…':offers.isError?'—':`${pendingOffers}${moreOffers?'+':''}`} href="/offers"/>
 <Queue icon={<ReceiptText/>} label="Product lists" count={count(lists.isPending,lists.isError,pendingLists)} href="/customer-product-lists"/>
 <Queue icon={<UserCog/>} label="Field manager updates" count="→" href="/field-managers"/>
 {moreOffers&&<p className="admin-data-note">{uiText('Offer count covers the loaded records. Open Offers for all reviews.')}</p>}
 {(offers.isError||lists.isError)&&<p role="alert" className="admin-data-note">{uiText('Some review counts are unavailable. Open the section to retry.')}</p>}
 <div className="admin-attention-footer"><span>{uiText('Signed in as')}</span><strong>{user.full_name||uiText('Admin')}</strong></div></section></div>
 <nav className="admin-directory-cards" aria-label={uiText('Admin directories')}><Directory icon={<Building2/>} title="Merchants" description="Stores and linked customers" href="/merchants" tone="blue"/><Directory icon={<Users/>} title="Customers" description="Profiles and onboarding source" href="/customers" tone="purple"/><Directory icon={<UserCog/>} title="Field Managers" description="Visits, attendance and onboarding" href="/field-managers" tone="green"/></nav>
 <section className="admin-card admin-recorded-summary"><div className="admin-card-title"><div><h2>{uiText('Recorded purchases - selected period')}</h2><p>{uiText('Actual AE records, not total business sales')}</p></div></div>{!filters.valid?<p>{uiText('Choose a valid date range.')}</p>:dashboard.isPending?<LoadingState/>:dashboard.isError?<ErrorState error={dashboard.error} retry={()=>void dashboard.refetch()}/>:<div className="admin-snapshot"><div><strong>{dashboard.data!.summary.totalOrders.toLocaleString('en-IN')}</strong><span>{uiText('Recorded transactions')}</span></div><div><strong>{formatCurrency(dashboard.data!.summary.totalRevenue)}</strong><span>{uiText('Recorded sales')}</span></div><div><strong>{formatPoints(dashboard.data!.summary.rewardPointsIssued)}</strong><span>{uiText('Points issued')}</span></div></div>}</section>
 </div>;
}
function Kpi({icon,label,value,tone,hint}:{icon:ReactNode;label:string;value:string;tone:string;hint:string}){return <article className={`admin-kpi ${tone}`}><span className="admin-kpi-icon">{icon}</span><div><span>{uiText(label)}</span><strong>{value}</strong><small>{uiText(hint)}</small></div></article>;}
function Queue({icon,label,count,href}:{icon:ReactNode;label:string;count:string;href:string}){return <Link className="admin-queue-row" to={href}><span className="admin-queue-icon">{icon}</span><span>{uiText(label)}</span><strong>{count}</strong><ChevronRight size={16}/></Link>;}
function Directory({icon,title,description,href,tone}:{icon:ReactNode;title:string;description:string;href:string;tone:string}){return <Link className={`admin-directory-card ${tone}`} to={href}><span className="admin-directory-icon">{icon}</span><div><h2>{uiText(title)}</h2><p>{uiText(description)}</p></div><span className="admin-directory-open">{uiText('Open')}<ChevronRight size={17}/></span></Link>;}
