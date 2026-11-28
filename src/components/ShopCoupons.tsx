import './shop-coupons.css';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ticket, Search, CheckCircle2, AlertCircle, Loader2, Gift, Plus, Minus, Store, Check, X } from 'lucide-react';
import { apiFetch } from '../api';
import { PageHeader, LoadingState, EmptyState } from './Common';
import { formatCurrency } from '../utils';

type Shop = { merchantId: string; name?: string; limit: number; issued?: number };

export function AdminShopCoupons(){
 const query=useQuery({queryKey:['shop-coupon-settings'],queryFn:({signal})=>apiFetch<{settings:{active:boolean;shops:Shop[]};merchants:{id:string;name:string}[]}>('/api/admin/shop-coupons',{signal}),refetchOnWindowFocus:false});
 const [shops,setShops]=useState<Shop[]>([]),[active,setActive]=useState(false),[message,setMessage]=useState(''),[search,setSearch]=useState(''),[selectedOnly,setSelectedOnly]=useState(false);
 useEffect(()=>{if(query.data){setShops(query.data.settings.shops);setActive(query.data.settings.active);}},[query.data]);
 const save=useMutation({mutationFn:()=>apiFetch('/api/admin/shop-coupons',{method:'PUT',body:JSON.stringify({shops:shops.map(({merchantId,limit})=>({merchantId,limit})),active})}),onSuccess:()=>{setMessage('Coupon campaign saved.');void query.refetch();}});
 const total=shops.reduce((n,s)=>n+s.limit,0),issued=shops.reduce((n,s)=>n+(s.issued||0),0);
 const merchants=query.data?.merchants||[];
 const visible=merchants.filter(m=>m.name.toLowerCase().includes(search.trim().toLowerCase())&&(!selectedOnly||shops.some(s=>s.merchantId===m.id)));
 const changeQuantity=(id:string,value:number)=>{setMessage('');setShops(old=>old.map(s=>s.merchantId===id?{...s,limit:value}:s));};
 const toggle=(m:{id:string;name:string})=>{setMessage('');setShops(old=>old.some(s=>s.merchantId===m.id)?old.filter(s=>s.merchantId!==m.id):[...old,{merchantId:m.id,name:m.name,limit:10,issued:0}]);};
 const invalid=shops.some(s=>!Number.isInteger(s.limit)||s.limit<Math.max(1,s.issued||0)||s.limit>10000);
 return <main className="ac-coupons ac-admin">
 <header className="ac-title"><span className="ac-icon"><Gift/></span><div><h1>Coupon campaign</h1><p>Choose your partner shops. Set their coupon allocation.</p></div><span className={'ac-status '+(query.data?.settings.active?'ac-live':'')}>{query.data?.settings.active?'Active':'Inactive'}</span></header>
 <div className="ac-rules"><span>₹100 per coupon</span><span>1 per customer</span><span>Valid for 7 days</span></div>
 <div className="ac-campaign-layout"><section className="panel ac-picker"><div className="ac-section-heading"><div><span className="ac-eyebrow">01 · PARTNER SHOPS</span><h2>Select shops</h2></div><span className="ac-count">{shops.length} selected</span></div>
 <label className="ac-find"><Search size={19}/><input aria-label="Search shops" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by shop name"/>{search&&<button type="button" aria-label="Clear search" onClick={()=>setSearch('')}><X size={17}/></button>}</label>
 <div className="ac-filter-tabs" role="group" aria-label="Shop filter"><button aria-pressed={!selectedOnly} onClick={()=>setSelectedOnly(false)}>All shops <span>{merchants.length}</span></button><button aria-pressed={selectedOnly} onClick={()=>setSelectedOnly(true)}>Selected <span>{shops.length}</span></button></div>
 {query.isPending?<p role="status">Loading shops…</p>:query.isError?<p role="alert">{query.error.message}</p>:<fieldset disabled={save.isPending} className="ac-shop-cards">{visible.map(m=>{const row=shops.find(s=>s.merchantId===m.id);return <article className={'ac-shop-card '+(row?'is-selected':'')} key={m.id}><button type="button" className="ac-card-select" aria-pressed={!!row} disabled={!!row?.issued} onClick={()=>toggle(m)}><span className="ac-store-avatar"><Store size={21}/></span><span className="ac-card-name">{m.name}<small>{row?'Included in this campaign':'Add to campaign'}</small></span><span className="ac-checkmark">{row?<Check size={16}/>:<Plus size={16}/>}</span></button>{row&&<div className="ac-card-allocation"><label htmlFor={'qty-'+m.id}>Coupons<small>{row.issued||0} issued · {Math.max(0,row.limit-(row.issued||0))||0} available</small></label><div className="ac-stepper"><button type="button" aria-label={'Fewer coupons for '+m.name} disabled={row.limit<=Math.max(1,row.issued||0)} onClick={()=>changeQuantity(m.id,row.limit-1)}><Minus size={15}/></button><input id={'qty-'+m.id} aria-label={'Coupon quantity for '+m.name} type="number" min={Math.max(1,row.issued||0)} max={10000} step={1} value={row.limit} onChange={e=>changeQuantity(m.id,Number(e.target.value))}/><button type="button" aria-label={'More coupons for '+m.name} disabled={row.limit>=10000} onClick={()=>changeQuantity(m.id,row.limit+1)}><Plus size={15}/></button></div></div>}</article>;})}{!visible.length&&<div className="ac-no-shops"><Store size={32}/><h3>{selectedOnly?'No selected shops':'No shops found'}</h3><p>{selectedOnly?'Choose shops from the All shops tab.':'Try another shop name.'}</p></div>}</fieldset>}
 </section><aside className="ac-campaign-side"><section className="panel ac-allocation"><span className="ac-eyebrow">02 · CAMPAIGN SUMMARY</span><h2>Your allocation</h2><div className="ac-allocation-total"><strong>{Number.isFinite(total)?total:0}</strong><span>total coupons</span></div><div className="ac-totals-row"><span>Partner shops</span><strong>{shops.length}</strong></div><div className="ac-totals-row"><span>Already issued</span><strong>{issued}</strong></div><div className="ac-totals-row"><span>Available to issue</span><strong>{Math.max(0,total-issued)||0}</strong></div><div className="ac-selected-summary">{shops.map(s=><div key={s.merchantId}><span>{s.name||merchants.find(m=>m.id===s.merchantId)?.name||'Shop'}</span><strong>{s.limit}</strong></div>)}</div><label className="ac-activation"><span><strong>Campaign active</strong><small>Issue coupons after completed purchases</small></span><input type="checkbox" role="switch" checked={active} onChange={e=>{setActive(e.target.checked);setMessage('');}} disabled={save.isPending||query.isPending||query.isError}/></label><button className="button primary ac-save-button" disabled={save.isPending||query.isPending||query.isError||invalid||(active&&!shops.length)} onClick={()=>save.mutate()}>{save.isPending?'Saving…':'Save campaign'}</button>{invalid&&<p role="alert" className="form-error">Enter a whole quantity between the issued count (at least 1) and 10,000.</p>}{save.isError&&<p role="alert" className="form-error">{save.error.message}</p>}{message&&<p role="status" className="ac-saved"><CheckCircle2 size={17}/>{message}</p>}</section></aside></div></main>;

}

export function CustomerShopCoupon() {
  const q = useQuery({
    queryKey: ['my-shop-coupon'],
    queryFn: () =>
      apiFetch<{
        coupon: null | { value: number; merchantName: string; status: string; code: string };
      }>('/api/customer/shop-coupon'),
    retry: false
  });
  const c = q.data?.coupon;

  return (
    <section className="mx-5 mt-5 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold">My Coupon</h2>
      {q.isPending ? (
        <p>Checking available coupons…</p>
      ) : q.error ? (
        <p role="alert">{(q.error as Error).message}</p>
      ) : c ? (
        <>
          <strong className="text-3xl text-emerald-600">₹100 OFF</strong>
          <p className="font-semibold text-gray-800">{c.merchantName} only</p>
          <p className="text-xs text-gray-500">Status: {c.status}</p>
          {c.status === 'available' && (
            <>
              <p className="text-sm text-gray-600 mt-2">
                Show this code to the merchant at checkout for a bill of ₹100 or more:
              </p>
              <code style={{ overflowWrap: 'anywhere', userSelect: 'all', fontSize: 13, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, display: 'inline-block', marginTop: 4 }}>
                {c.code}
              </code>
            </>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">
          No coupon yet. Coupons are available after a purchase at participating shops, while quantities last.
        </p>
      )}
    </section>
  );
}

export function MerchantShopCoupons() {
  const [code, setCode] = useState('');
  const [billAmount, setBill] = useState('');

  const redeem = useMutation({
    mutationFn: () =>
      apiFetch<{ discount: number; amountPayable: number }>('/api/merchant/shop-coupons/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim(), billAmount: Number(billAmount) })
      })
  });

  const bill = parseFloat(billAmount);
  const validBill = Number.isFinite(bill) && bill >= 100;
  const payable = validBill ? Math.max(0, bill - 100) : 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validBill || !code.trim() || redeem.isPending) return;
    if (window.confirm(`Apply ₹100 coupon discount to this bill?\n\nOriginal Bill: ₹${bill.toFixed(2)}\nDiscount: ₹100.00\nCustomer Pays: ₹${payable.toFixed(2)}`)) {
      redeem.mutate();
    }
  }

  return (
    <>
      <PageHeader
        title="Redeem ₹100 Coupon"
        subtitle="Apply a customer's ₹100 shop coupon discount to their bill. Minimum bill of ₹100 required."
      />

      <section className="panel" style={{ maxWidth: 520, margin: '0 auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Customer Coupon Code</span>
            <input
              required
              placeholder="e.g. 32-character code"
              value={code}
              onChange={e => setCode(e.target.value.toLowerCase())}
              style={{ fontFamily: 'monospace', letterSpacing: '0.04em', fontSize: 13 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Bill Amount (₹)</span>
            <input
              required
              type="number"
              min="100"
              step="any"
              placeholder="Minimum ₹100"
              value={billAmount}
              onChange={e => setBill(e.target.value)}
            />
          </label>

          {validBill && (
            <div
              style={{
                padding: '12px 14px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
                fontSize: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                <span>Bill Total:</span>
                <span>{formatCurrency(bill)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 700 }}>
                <span>Coupon Discount:</span>
                <span>- ₹100.00</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                  fontSize: 14,
                  borderTop: '1px solid #bbf7d0',
                  paddingTop: 4,
                  marginTop: 2,
                  color: '#15803d'
                }}
              >
                <span>Customer Amount Payable:</span>
                <span>{formatCurrency(payable)}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="button primary"
            disabled={!validBill || !code.trim() || redeem.isPending}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42 }}
          >
            {redeem.isPending ? <Loader2 size={16} className="spin" /> : <Ticket size={16} />}
            Confirm Coupon Discount
          </button>

          {redeem.error && (
            <div className="tag danger" style={{ padding: 10, borderRadius: 8 }}>
              <AlertCircle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {(redeem.error as Error).message}
            </div>
          )}

          {redeem.data && (
            <div className="tag success" style={{ padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <CheckCircle2 size={16} /> Coupon Redeemed Successfully!
              </div>
              <div style={{ fontSize: 12 }}>
                Discount applied: ₹100.00 · Customer pays: {formatCurrency(redeem.data.amountPayable)}
              </div>
            </div>
          )}
        </form>
      </section>
    </>
  );
}
