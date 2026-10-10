import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Building2, CalendarDays, ChevronRight, CircleDollarSign, Gift, ListChecks, ReceiptText, UserCog, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import type { DashboardData, Merchant, Offer, UserProfile } from '../types';
import { dateInput, formatCurrency, formatPoints } from '../utils';
import { uiText } from '../uiText';
import { AdminUsage } from '../components/AdminUsage';
import { ErrorState, LoadingState } from '../components/Common';
import '../admin-dashboard.css';

export function AdminDashboard({ user }: { user: UserProfile }) {
 const today=dateInput();
 const dashboard=useQuery({queryKey:['admin-dashboard',today],queryFn:()=>apiFetch<DashboardData>(`/api/dashboard?from=${today}&to=${today}`)});
 const customers=useQuery({queryKey:['admin-dashboard-customer-count'],queryFn:()=>apiFetch<{pagination:{total:number}}>('/api/admin/customers?page=1&pageSize=1')});
 const merchants=useQuery({queryKey:['admin-dashboard-merchants'],queryFn:()=>apiFetch<{merchants:Merchant[];pagination?:{total?:number}}>('/api/merchants?page=1&pageSize=1')});
 const offers=useQuery({queryKey:['admin-dashboard-offers'],queryFn:()=>apiFetch<{offers:Offer[];pagination?:{total?:number}}>('/api/offers?page=1&pageSize=50')});
 const lists=useQuery({queryKey:['admin-dashboard-lists'],queryFn:()=>apiFetch<{requests:Array<{status:string}>}>('/api/product-list-requests')});
 const pendingOffers=offers.data?.offers.filter(item=>item.status==='pending').length;
 const pendingLists=lists.data?.requests.filter(item=>item.status==='pending').length;
 const moreOffers=(offers.data?.pagination?.total||0)>(offers.data?.offers.length||0);
 const count=(loading:boolean,error:boolean,n:number|undefined)=>loading?'…':error||n==null?'—':n.toLocaleString('en-IN');
 return <div className="admin-dashboard admin-overview-v2">
 <header className="admin-dashboard-heading"><div><p className="admin-eyebrow">{uiText('AE ADMIN')}</p><h1>{uiText('Overview')}</h1><p>{uiText('Your network at a glance')}</p></div><div className="admin-date-chip"><CalendarDays size={18}/><time dateTime={today}>{new Date(`${today}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</time></div></header>
 <div className="admin-kpis">
 <Kpi icon={<Building2/>} label="Registered merchants" value={count(merchants.isPending,merchants.isError,merchants.data?.pagination?.total)} tone="blue" hint="All registered stores"/>
 <Kpi icon={<Users/>} label="Customers" value={count(customers.isPending,customers.isError,customers.data?.pagination.total)} tone="purple" hint="All customer accounts"/>
 <Kpi icon={<CircleDollarSign/>} label="Recorded sales" value={dashboard.isPending?'…':dashboard.isError?'—':formatCurrency(dashboard.data!.summary.totalRevenue)} tone="green" hint="Today’s recorded purchases"/>
 <Kpi icon={<Gift/>} label="Points issued" value={dashboard.isPending?'…':dashboard.isError?'—':formatPoints(dashboard.data!.summary.rewardPointsIssued)} tone="orange" hint="Issued today"/>
 </div>
 {(customers.isError||merchants.isError)&&<p role="alert" className="admin-data-note">{uiText('Some account totals could not be loaded. Refresh to retry.')}</p>}
 <div className="admin-dashboard-grid admin-overview-main"><AdminUsage/><section className="admin-card"><div className="admin-card-title"><div><h2>{uiText('Needs attention')}</h2><p>{uiText('Review requests and manage your network')}</p></div><ListChecks size={20}/></div>
 <Queue icon={<Gift/>} label="Offer approvals" count={offers.isPending?'…':offers.isError?'—':`${pendingOffers}${moreOffers?'+':''}`} href="/offers"/>
 <Queue icon={<ReceiptText/>} label="Product lists" count={count(lists.isPending,lists.isError,pendingLists)} href="/customer-product-lists"/>
 <Queue icon={<UserCog/>} label="Field manager updates" count="→" href="/field-managers"/>
 {moreOffers&&<p className="admin-data-note">{uiText('Offer count covers the loaded records. Open Offers for all reviews.')}</p>}
 {(offers.isError||lists.isError)&&<p role="alert" className="admin-data-note">{uiText('Some review counts are unavailable. Open the section to retry.')}</p>}
 <div className="admin-attention-footer"><span>{uiText('Signed in as')}</span><strong>{user.full_name||uiText('Admin')}</strong></div></section></div>
 <nav className="admin-directory-cards" aria-label={uiText('Admin directories')}><Directory icon={<Building2/>} title="Merchants" description="Stores and linked customers" href="/merchants" tone="blue"/><Directory icon={<Users/>} title="Customers" description="Profiles and onboarding source" href="/customers" tone="purple"/><Directory icon={<UserCog/>} title="Field Managers" description="Visits, attendance and onboarding" href="/field-managers" tone="green"/></nav>
 <section className="admin-card admin-recorded-summary"><div className="admin-card-title"><div><h2>{uiText('Recorded purchases today')}</h2><p>{uiText('Actual AE records, not total business sales')}</p></div><Link to="/orders">{uiText('View transactions')}<ChevronRight size={16}/></Link></div>{dashboard.isPending?<LoadingState/>:dashboard.isError?<ErrorState error={dashboard.error} retry={()=>void dashboard.refetch()}/>:<div className="admin-snapshot"><div><strong>{dashboard.data!.summary.totalOrders.toLocaleString('en-IN')}</strong><span>{uiText('Transactions today')}</span></div><div><strong>{formatCurrency(dashboard.data!.summary.totalRevenue)}</strong><span>{uiText('Recorded sales')}</span></div><div><strong>{formatPoints(dashboard.data!.summary.rewardPointsIssued)}</strong><span>{uiText('Points issued')}</span></div></div>}</section>
 </div>;
}
function Kpi({icon,label,value,tone,hint}:{icon:ReactNode;label:string;value:string;tone:string;hint:string}){return <article className={`admin-kpi ${tone}`}><span className="admin-kpi-icon">{icon}</span><div><span>{uiText(label)}</span><strong>{value}</strong><small>{uiText(hint)}</small></div></article>;}
function Queue({icon,label,count,href}:{icon:ReactNode;label:string;count:string;href:string}){return <Link className="admin-queue-row" to={href}><span className="admin-queue-icon">{icon}</span><span>{uiText(label)}</span><strong>{count}</strong><ChevronRight size={16}/></Link>;}
function Directory({icon,title,description,href,tone}:{icon:ReactNode;title:string;description:string;href:string;tone:string}){return <Link className={`admin-directory-card ${tone}`} to={href}><span className="admin-directory-icon">{icon}</span><div><h2>{uiText(title)}</h2><p>{uiText(description)}</p></div><span className="admin-directory-open">{uiText('Open')}<ChevronRight size={17}/></span></Link>;}
