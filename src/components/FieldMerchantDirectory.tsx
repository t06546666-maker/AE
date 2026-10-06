import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Search, Store } from 'lucide-react';
import { MERCHANT_ROUTES } from '../merchantRoutes';
type Merchant = { id: string; name: string; merchant_code: string; phone?: string; email?: string; address?: string; image_url?: string; route_name?: string; merchant_categories?: { name?: string } };
export function FieldMerchantDirectory({ merchants }: { merchants: Merchant[] }) {
  const [search, setSearch] = useState(''); const [route, setRoute] = useState(''); const [page, setPage] = useState(1);
  const matching = useMemo(() => merchants.filter(merchant => (!route || merchant.route_name === route) && [merchant.name,merchant.merchant_code,merchant.phone,merchant.email,merchant.address].some(value => value?.toLowerCase().includes(search.trim().toLowerCase()))), [merchants,route,search]);
  const pages = Math.max(1,Math.ceil(matching.length / 20)); const current = Math.min(page,pages);
  return <section className="field-card-directory"><header className="field-page-title"><Link to="/field?section=home" aria-label="Back to home">←</Link><h1>All Merchants</h1><Link className="button primary" to="/field?section=onboarding">+ Add</Link></header>
    <label className="field-directory-search"><Search size={20} /><input placeholder="Search merchants…" aria-label="Search merchants" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    <select aria-label="Filter merchants by route" value={route} onChange={event => { setRoute(event.target.value); setPage(1); }}><option value="">All routes</option>{MERCHANT_ROUTES.map(item => <option key={item}>{item}</option>)}</select>
    <p className="field-directory-count">{matching.length} merchants</p>
    <div className="field-merchant-cards">{matching.slice((current-1)*20,current*20).map(merchant => <Link key={merchant.id} to={`/field/merchants/${encodeURIComponent(merchant.id)}`} className="field-merchant-card">{merchant.image_url ? <img src={merchant.image_url} alt="" loading="lazy" /> : <span className="field-store-placeholder"><Store /></span>}<div><strong>{merchant.name}</strong><small>Code: {merchant.merchant_code}</small><small>{merchant.merchant_categories?.name || 'General'}</small><span><MapPin size={13} />{merchant.route_name || merchant.address || 'Location not added'}</span></div><ChevronRight size={18} /></Link>)}</div>
    {!matching.length && <p>No merchants match your search.</p>}
    {pages > 1 && <div className="field-directory-pagination"><button disabled={current === 1} onClick={() => setPage(current-1)}>Previous</button><span>{current} / {pages}</span><button disabled={current === pages} onClick={() => setPage(current+1)}>Next</button></div>}
  </section>;
}
