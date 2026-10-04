import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from './Common';

export function MerchantPointBalance({ merchantId, compact = false }: { merchantId: string; compact?: boolean }) {
  const query = useQuery({ queryKey: ['merchant-points', merchantId], queryFn: ({ signal }) => apiFetch<{ balance: number }>(`/api/merchants/${merchantId}/point-balance`, { signal }), refetchInterval: 30000 });
  if (compact) return <section className="mo-points-compact" aria-label="Available merchant points"><Coins size={22}/><div><span>Available points</span>{query.isPending ? <strong>Loading…</strong> : query.isError ? <button type="button" onClick={() => query.refetch()}>Unable to load · Retry</button> : <strong>{query.data.balance.toLocaleString('en-IN')} <small>points</small></strong>}</div></section>;
  return <section className="mo-points-balance" aria-label="Available merchant points"><Coins size={40}/><div><span>Available points to issue</span>{query.isPending ? <LoadingState/> : query.isError ? <ErrorState error={query.error} retry={() => query.refetch()}/> : <><strong>{query.data.balance.toLocaleString('en-IN')} <small>points</small></strong><p>{query.data.balance === 0 ? 'Ask Admin to allocate points before issuing customer rewards.' : 'Allocated by Admin · Deducted when you issue customer points'}</p></>}</div></section>;
}

export function AllocateMerchantPoints({ merchantId, name, onClose }: { merchantId: string; name: string; onClose: () => void }) {
  const client = useQueryClient();
  const [points, setPoints] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const amount = Number(points);
  const valid = Number.isInteger(amount) && amount > 0 && amount <= 1000000;
  const save = useMutation({ mutationFn: () => apiFetch(`/api/merchants/${merchantId}/point-allocation`, { method: 'POST', body: JSON.stringify({ points: amount, requestId }) }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['merchant-points'] }); void client.invalidateQueries({ queryKey: ['merchants'] }); onClose(); } });
  return <div className="modal-backdrop"><form className="modal" onSubmit={event => { event.preventDefault(); if (valid && window.confirm(`Allocate ${amount.toLocaleString('en-IN')} points to ${name}?`)) save.mutate(); }}><h2>Allocate merchant points</h2><p>{name}</p><MerchantPointBalance merchantId={merchantId}/><label>Points to add<input type="number" min="1" max="1000000" step="1" value={points} disabled={save.isPending} onChange={event => { setPoints(event.target.value); setRequestId(crypto.randomUUID()); save.reset(); }} required/></label><p>These points are added to the merchant’s existing balance.</p>{save.isError && <p className="form-error" role="alert">{save.error.message}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={save.isPending} onClick={onClose}>Cancel</button><button className="button primary" disabled={!valid || save.isPending}>{save.isPending ? 'Allocating…' : 'Allocate points'}</button></div></form></div>;
}
