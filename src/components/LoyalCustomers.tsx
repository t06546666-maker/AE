import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from './Common';

type LoyalCustomer = { id: string; name: string; purchases: number };

export function LoyalCustomers() {
  const cache = useQueryClient();
  const [customer, setCustomer] = useState<LoyalCustomer | null>(null);
  const [option, setOption] = useState('5');
  const [other, setOther] = useState('');
  const [requestId, setRequestId] = useState('');
  const [message, setMessage] = useState('');
  const points = Number(option === 'other' ? other : option);
  const customers = useQuery({ queryKey: ['merchant-loyal-customers'], queryFn: () => apiFetch<{ customers: LoyalCustomer[] }>('/api/merchant/loyal-customers') });
  const award = useMutation({ mutationFn: () => apiFetch('/api/merchant/loyalty-bonus', { method: 'POST', body: JSON.stringify({ customerId: customer?.id, points, requestId }) }), onSuccess: () => {
    setMessage(`${points} loyalty points awarded to ${customer?.name}.`);
    setCustomer(null);
    void cache.invalidateQueries({ queryKey: ['merchant-overview'] });
    void cache.invalidateQueries({ queryKey: ['customer'] });
  } });
  return <section className="mo-panel" style={{ marginTop: 20 }}>
    <h2>Loyal customers</h2><p className="mo-subtitle">Five or more recorded purchases at your store. Bonus points do not count as purchases.</p>
    <Link className="mo-primary" to="/offers?create=1&audience=loyal">Create offer for all loyal customers</Link>
    <p className="mo-note">Offers follow the existing Admin approval process and are visible only to eligible customers.</p>
    {customers.isPending ? <LoadingState label="Loading loyal customers..." /> : customers.isError ? <ErrorState error={customers.error} retry={() => customers.refetch()} /> : <div className="mo-customer-list">
      {customers.data.customers.map(item => <div className="mo-customer" key={item.id}><span className="mo-customer-name"><strong>{item.name}</strong><small>{item.purchases} purchases</small></span><button className="button" onClick={() => { setCustomer(item); setOption('5'); setOther(''); setRequestId(crypto.randomUUID()); award.reset(); setMessage(''); }}>Give loyalty points</button></div>)}
      {!customers.data.customers.length && <p className="mo-empty">No customers with five purchases yet.</p>}
    </div>}
    {customer && <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-label="Give loyalty points" onSubmit={event => { event.preventDefault(); if (!award.isPending && Number.isInteger(points) && points >= 1 && points <= 100) award.mutate(); }}>
      <h3>Give loyalty points to {customer.name}</h3>
      <label>Bonus points <select disabled={award.isPending} value={option} onChange={event => { setOption(event.target.value); setRequestId(crypto.randomUUID()); }}>{[5,10,20,30].map(value => <option key={value} value={value}>{value} points</option>)}<option value="other">Other</option></select></label>
      {option === 'other' && <label>Points (1–100)<input type="number" min="1" max="100" step="1" required disabled={award.isPending} value={other} onChange={event => { setOther(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>}
      <p className="mo-note">This awards bonus points without recording a purchase.</p>
      <p>The customer will see: “You received {Number.isInteger(points) && points > 0 ? points : 'your'} AE loyalty points. Thank you for your loyalty!”</p>
      {award.error && <p role="alert">{award.error.message}</p>}
      <button className="button primary" disabled={award.isPending || !Number.isInteger(points) || points<1 || points>100}>{award.isPending ? 'Awarding...' : 'Confirm bonus'}</button>
      <button type="button" className="button" disabled={award.isPending} onClick={() => setCustomer(null)}>Cancel</button>
    </form></div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
