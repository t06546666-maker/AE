import { uiText } from '../uiText';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';

export function CustomerPaymentRequests() {
  const { data, error } = useQuery({
    queryKey: ['customer', 'payment-requests'],
    queryFn: () => apiFetch<{ payments: Array<{ id: string; amount: number; merchantName: string; upiUrl: string | null }> }>('/api/customer/payment-requests'),
    refetchInterval: 10000,
  });
  if (error) return <p role="alert" className="m-4 text-sm text-red-700">{uiText("Payment requests unavailable. ")}{error.message}</p>;
  if (!data?.payments.length) return null;
  return <section className="m-4 space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-label={uiText("Pending payments")}>
    <h2 className="font-bold">{uiText("Payment requests")}</h2>
    {data.payments.map(payment => <div key={payment.id} className="rounded-xl bg-white p-4">
      <p className="font-bold">{payment.merchantName}</p><p>₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      {payment.upiUrl ? <a className="my-2 block rounded-xl bg-blue-600 p-3 text-center font-bold text-white" href={payment.upiUrl}>{uiText("Pay with a UPI app")}</a> : <p>{uiText("Merchant payments are currently disabled.")}</p>}
      <p className="text-xs text-gray-600">{uiText("After paying, return to AE. Your merchant will confirm receipt. Opening UPI does not mark this as paid.")}</p>
    </div>)}
  </section>;
}
