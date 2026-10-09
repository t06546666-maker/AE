import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store, MapPin } from 'lucide-react';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { UserProfile } from '../types';

type Business = { name: string; merchant_code?: string; email?: string; phone?: string; address?: string; image_url?: string; images?: string[]; opening_time?: string; closing_time?: string; created_at?: string; latitude?: number; longitude?: number; merchant_categories?: { name?: string }; };
const shopTime = (value?: string) => {
  if (!value) return uiText('Not provided');
  const [hour, minute] = value.split(':').map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}` : value;
};
export function MerchantProfile({ user }: { user: UserProfile }) {
  const profile = useQuery({ queryKey: ['merchant-profile', user.merchant_id], queryFn: ({ signal }) => apiFetch<{ data: Business }>('/api/merchant-profile', { signal }), enabled: !!user.merchant_id });
  if (!user.merchant_id) return <section className="panel"><p>{uiText('No merchant account is linked to this login.')}</p><Link to="/more">{uiText('Back to More')}</Link></section>;
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />;
  const shop = profile.data.data;
  const details = [['Store name', shop.name], ['Merchant code', shop.merchant_code], ['Category', shop.merchant_categories?.name], ['Account holder', user.full_name], ['Email', shop.email || user.email], ['Phone number', shop.phone], ['Address', shop.address], ['Opening time', shopTime(shop.opening_time)], ['Closing time', shopTime(shop.closing_time)]];
  const photos = [...new Set([shop.image_url, ...(shop.images || [])].filter((value): value is string => !!value))];
  return <div style={{ maxWidth: 850, margin: 'auto', paddingBottom: 90 }}>
    <Link to="/more" className="button secondary"><ArrowLeft size={17} />{uiText('Back to More')}</Link>
    <PageHeader title={uiText('Merchant Profile')} subtitle={uiText('Your business and account details')} />
    <section className="panel">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}><span className="mobile-transaction-avatar blue"><Store size={28} /></span><div><h2 style={{ margin: 0 }}>{shop.name}</h2><p>{shop.merchant_categories?.name || uiText('Merchant')}</p></div></div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>{details.map(([label, value]) => <div key={label} style={{ padding: 14, background: 'var(--bg-subtle, #f5f8fd)', borderRadius: 12 }}><dt style={{ fontSize: 13, marginBottom: 7 }}>{uiText(label)}</dt><dd style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{value || uiText('Not provided')}</dd></div>)}</dl>
      {shop.latitude != null && shop.longitude != null && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`}><MapPin size={17} />{uiText('View shop on map')}</a>}
      <p style={{ marginTop: 20 }}>{uiText('Contact admin to update your business details.')}</p>
    </section>
    {photos.length > 0 && <section className="panel"><h2>{uiText('Shop photos')}</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>{photos.map(photo => <img key={photo} src={photo} alt={shop.name} loading="lazy" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 14 }} />)}</div></section>}
  </div>;
}
