import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ticket, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';
import { PageHeader, LoadingState, EmptyState } from './Common';
import { formatCurrency } from '../utils';

type Shop = { merchantId: string; name?: string; limit: number; issued?: number };

export function AdminShopCoupons() {
  const q = useQuery({
    queryKey: ['shop-coupon-settings'],
    queryFn: () =>
      apiFetch<{
        settings: { active: boolean; shops: Shop[] };
        merchants: { id: string; name: string }[];
      }>('/api/admin/shop-coupons')
  });

  const [shops, setShops] = useState<Shop[]>([]);
  const [active, setActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (q.data) {
      setShops(q.data.settings.shops || []);
      setActive(Boolean(q.data.settings.active));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/shop-coupons', {
        method: 'PUT',
        body: JSON.stringify({ shops, active })
      }),
    onSuccess: () => {
      setMessage('Coupon campaign saved successfully.');
      void q.refetch();
    }
  });

  const merchants = q.data?.merchants || [];
  const filteredMerchants = merchants.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAllocated = shops.reduce((sum, s) => sum + (s.limit || 0), 0);
  const totalIssued = shops.reduce((sum, s) => sum + (s.issued || 0), 0);

  return (
    <>
      <PageHeader
        title="₹100 shop coupons"
        subtitle="One coupon per customer after a recorded purchase at a selected shop. Each coupon works only at that shop."
      />

      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {q.isPending ? (
          <LoadingState label="Loading coupon campaign settings..." />
        ) : q.error ? (
          <div className="state-panel error-state" role="alert">
            <AlertCircle size={20} />
            <span>{(q.error as Error).message}</span>
          </div>
        ) : (
          <>
            {/* Top Campaign Control Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--surface-alt, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 12
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span className={`tag ${active ? 'success' : ''}`}>
                  {active ? '● Campaign Active' : '○ Campaign Paused'}
                </span>
              </label>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, color: 'var(--muted, #64748b)' }}>
                <span>Participating Shops: <strong>{shops.length}</strong></span>
                <span>Total Coupons: <strong>{totalAllocated}</strong></span>
                <span>Issued: <strong style={{ color: '#059669' }}>{totalIssued}</strong></span>
              </div>
            </div>

            {/* Search Filter */}
            <div style={{ position: 'relative', maxWidth: 360 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted, #94a3b8)' }} />
              <input
                type="text"
                placeholder="Search shops by name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 36, width: '100%', height: 38 }}
              />
            </div>

            {/* Merchant Allocation Table */}
            <div className="table-scroll" style={{ maxHeight: 480 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>Active</th>
                    <th>Shop Name</th>
                    <th style={{ width: 160 }}>Allocated Coupons</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Issued</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMerchants.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted, #94a3b8)' }}>
                        No matching shops found.
                      </td>
                    </tr>
                  ) : (
                    filteredMerchants.map(m => {
                      const row = shops.find(s => s.merchantId === m.id);
                      const isSelected = Boolean(row);
                      const limit = row?.limit || 10;
                      const issued = row?.issued || 0;
                      const remaining = Math.max(0, limit - issued);

                      return (
                        <tr key={m.id} style={isSelected ? { background: 'rgba(49, 88, 245, 0.03)' } : undefined}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={Boolean(row?.issued)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setShops([...shops, { merchantId: m.id, limit: 10, issued: 0 }]);
                                } else {
                                  setShops(shops.filter(s => s.merchantId !== m.id));
                                }
                              }}
                              style={{ width: 16, height: 16, accentColor: '#3158f5', cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <strong>{m.name}</strong>
                          </td>
                          <td>
                            {row ? (
                              <input
                                type="number"
                                min={Math.max(1, row.issued || 0)}
                                max={10000}
                                value={row.limit}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10);
                                  setShops(
                                    shops.map(s =>
                                      s.merchantId === m.id ? { ...s, limit: Number.isFinite(val) ? val : 0 } : s
                                    )
                                  );
                                }}
                                style={{ width: 120, height: 32, padding: '2px 8px' }}
                              />
                            ) : (
                              <span style={{ color: 'var(--muted, #94a3b8)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: issued > 0 ? '#059669' : 'inherit' }}>
                            {issued}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {isSelected ? remaining : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Save Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="button primary"
                disabled={save.isPending || q.isPending}
                onClick={() => save.mutate()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {save.isPending ? <Loader2 size={16} className="spin" /> : <Ticket size={16} />}
                Save Campaign Configuration
              </button>
              {message && (
                <span className="tag success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> {message}
                </span>
              )}
              {save.error && (
                <span className="tag danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {(save.error as Error).message}
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
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
