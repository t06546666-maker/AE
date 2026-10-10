import { maskedPhone } from '../maskedPhone';
import { Link,useSearchParams } from 'react-router-dom';
import { uiText } from '../uiText';
import { GraphPeriod,useGraphPeriod } from './GraphPeriod';
import { formatCurrency } from '../utils';
import type { MerchantAnalytics } from '../pages/merchantAnalytics';
const groups=[{id:'under100',label:'Under ₹100',min:0,max:100},{id:'100to300',label:'₹100–₹299.99',min:100,max:300},{id:'300to500',label:'₹300–₹499.99',min:300,max:500},{id:'500plus',label:'₹500 and above',min:500,max:Infinity}];
export function PurchaseAmountGroups({model,month}:{model:MerchantAnalytics;month:string}) {
 const period=useGraphPeriod(month);const [params]=useSearchParams();
 const selected=groups.find(group=>group.id===params.get('group'));
 const range=selected?{from:params.get('from')||period.range!.from,to:params.get('to')||period.range!.to}:period.range!;
 const start=Date.parse(range.from),end=Date.parse(range.to);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return <section className="mo-panel"><p>{uiText('Choose a valid date range.')}</p><Link to={`/customers?month=${month}`}>{uiText('Back to customers')}</Link></section>;
 const match=(order:MerchantAnalytics['current']['orders'][number],group:typeof groups[number])=>{const timestamp=Date.parse(order.timestamp);return timestamp>=start&&timestamp<end&&timestamp<=Date.now()&&order.amount>=group.min&&order.amount<group.max};
 const rows=groups.map(group=>({...group,count:model.customers.flatMap(customer=>customer.visits).filter(order=>match(order,group)).length}));
 const maximum=Math.max(1,...rows.map(row=>row.count));
 if(selected) {
  const customers=model.customers.map(customer=>({...customer,matches:customer.visits.filter(order=>match(order,selected))})).filter(customer=>customer.matches.length);
  const query=new URLSearchParams({create:'1',audience:'purchase_range',group:selected.id,from:range.from,to:range.to});
  return <section className="mo-panel"><Link className="button secondary" to={`/customers?month=${month}`}>{uiText('Back to customers')}</Link><h2>{uiText('Customers by purchase amount')} · {selected.label}</h2><p>{range.from.slice(0,10)} {uiText('to')} {new Date(Date.parse(range.to)-1+330*60000).toISOString().slice(0,10)}</p><p>{customers.length} {uiText('matching customers')}</p>{customers.length>0&&<Link className="button primary" to={`/offers?${query}`}>{uiText('Create offer for this group')}</Link>}<div className="mo-customer-list">{customers.map(customer=><div className="mo-customer" key={customer.id}><span className="mo-customer-name"><strong>{customer.name}</strong><small>{customer.id} · {maskedPhone(customer.phone)} · {customer.matches.length} {uiText('matching purchases')}</small></span><strong>{formatCurrency(customer.matches.reduce((sum,order)=>sum+order.amount,0))}</strong></div>)}</div>{!customers.length&&<p>{uiText('No customers in this range for the selected dates.')}</p>}</section>;
 }
 return <section className="mo-panel"><div className="mo-panel-heading"><div><h2>{uiText('Purchases by bill amount')}</h2><p>{uiText('Select a bar to view matching customers')}</p></div><GraphPeriod state={period} label="Purchase amount period"/></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12,alignItems:'stretch',marginTop:20}}>{rows.map(row=><Link key={row.id} to={`/customers?${new URLSearchParams({month,group:row.id,...range})}`} aria-label={`${row.label}: ${row.count} ${uiText('purchases')}`} style={{display:'grid',gridTemplateRows:'24px 140px minmax(3.5em,auto)',gap:8,textAlign:'center',color:'inherit'}}><strong style={{lineHeight:'24px'}}>{row.count}</strong><span style={{height:140,display:'flex',alignItems:'end',justifyContent:'center'}}><span style={{height:row.count/maximum*130,width:'70%',background:'#3169ef',borderRadius:'10px 10px 0 0'}}/></span><small style={{alignSelf:'start',overflowWrap:'anywhere'}}>{row.label}</small></Link>)}</div></section>;
}
