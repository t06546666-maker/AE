import { uiText } from '../uiText';
import { TimeInput } from '../components/TimeInput';
import { formatClockTime } from '../utils';
import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Download, Eye, KeyRound, Plus, Search, Trash2, X, MapPinned, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, ExportModal, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Merchant, MerchantSummaryResponse, Pagination, MerchantCategory } from '../types';
import { formatDate, formatPoints } from '../utils';
import { useToast } from '../toast';
import { AllocateMerchantPoints } from '../components/MerchantPointBalance';
import { MERCHANT_ROUTES, routeLabel } from '../merchantRoutes';
import { LiveCamera } from '../components/LiveCamera';
import '../admin-directory.css';

interface CredentialResult {
  merchantCode: string;
  loginEmail: string;
  temporaryPassword: string;
  whatsapp: { sent: boolean; status: string; error: string | null };
}

interface CreateMerchantResponse {
  merchant: Merchant;
  temporaryPassword: string;
  whatsapp: CredentialResult['whatsapp'];
}

export function Merchants({onboardingOnly=false}:{onboardingOnly?:boolean}) {
  const [showOnboarding, setShowOnboarding] = useState(onboardingOnly);
  const [allocation, setAllocation] = useState<Merchant | null>(null);
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [address, setAddress] = useState('');
  const [onboardStep, setOnboardStep] = useState(0);
  const [merchantRoute, setMerchantRoute] = useState('');
  const [openingTime, setOpeningTime] = useState(''); const [closingTime, setClosingTime] = useState('');
  const [shopImages, setShopImages] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => setPage(1), [deferredSearch]);

  async function uploadShopPhoto(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      showToast('Choose a JPG or PNG image under 5 MB.', 'error'); return;
    }
    setUploadingPhoto(true);
    try {
      const body = new FormData(); body.append('image', file);
      const result = await apiFetch<{ url: string }>('/api/field/upload-image', { method: 'POST', body });
      setShopImages(previous => [...previous, result.url]);
    } catch (error) { showToast((error as Error).message, 'error'); }
    finally { setUploadingPhoto(false); }
  }

  function generateCredentials() {
    const random = crypto.randomUUID().replaceAll('-', '');
    setEmail(`store${random.slice(0, 10)}@ae-rewards.com`);
    setPassword(`Ae@${random.slice(10, 22)}9`);
  }


  const categoriesQuery = useQuery({
    queryKey: ['merchant-categories'],
    queryFn: ({ signal }) => apiFetch<{ categories: MerchantCategory[] }>('/api/merchant-categories', { signal }),
  });
  const merchants = useQuery({
    queryKey: ['merchants', page, deferredSearch],
    queryFn: ({ signal }) => apiFetch<{ merchants: Merchant[]; pagination: Pagination }>(`/api/merchants?${queryString({
      page,
      pageSize: 20,
      search: deferredSearch,
    })}`, { signal }),
    placeholderData: (previous) => previous,
  });

  const create = useMutation({
    mutationFn: () => apiFetch<CreateMerchantResponse>('/api/merchants', {
      method: 'POST',
      body: JSON.stringify({ images: shopImages, image_url: shopImages[0], route_name: merchantRoute || undefined, opening_time: openingTime || undefined, closing_time: closingTime || undefined, name: name.trim(), email: email.trim(), phone: `+91${phone.trim()}`, password, category_id: categoryId === '__other__' ? "__other__" : (categoryId || undefined), new_category_name: categoryId === '__other__' ? customCategory.trim() : undefined, address: address.trim() || undefined, latitude: latitude || undefined, longitude: longitude || undefined }),
    }),
    onSuccess(data) {
      setCredentials({
        merchantCode: data.merchant.merchantCode,
        loginEmail: data.merchant.email,
        temporaryPassword: data.temporaryPassword,
        whatsapp: data.whatsapp,
      });
      setName('');
      setMerchantRoute('');
      setOpeningTime(''); setClosingTime('');
      setShopImages([]); setOnboardStep(0);
      setEmail('');
      setPhone('');
      setPassword('');
      setAddress(''); setLatitude(''); setLongitude(''); setCategoryId(''); setCustomCategory('');
      void queryClient.invalidateQueries({ queryKey: ['merchant-categories'] });
      showToast(t('merchants.created'));
      void queryClient.invalidateQueries({ queryKey: ['merchants'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const reset = useMutation({
    mutationFn: (merchant: Merchant) => apiFetch<CredentialResult>(
      `/api/merchants/${encodeURIComponent(merchant.id)}/reset-password`,
      { method: 'POST' },
    ),
    onSuccess(data) {
      setCredentials(data);
      showToast(t('merchants.resetDone'));
      void queryClient.invalidateQueries({ queryKey: ['merchants'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const remove = useMutation({
    mutationFn: (merchant: Merchant) => apiFetch<{ deletedCustomers?: number }>(
      `/api/merchants/${encodeURIComponent(merchant.id)}`,
      { method: 'DELETE' },
    ),
    onSuccess(data) {
      showToast(data.deletedCustomers
        ? `Merchant removed · ${data.deletedCustomers} customer records removed`
        : "Merchant removed");
      void queryClient.invalidateQueries({ queryKey: ['merchants'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (onboardStep >= 2 && !shopImages.length) { showToast('Add at least one shop photo.', 'error'); return; }
    if (onboardStep < 3) { setOnboardStep(onboardStep + 1); return; }
    create.mutate();
  }

  useEffect(() => {
    if (!mapPickerOpen || !pickerRef.current) return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) { pickerRef.current.textContent = 'Map key is not available in this deployment.'; return; }
    const start = () => {
      const google = (window as any).google;
      if (!google?.maps || !pickerRef.current) { if (pickerRef.current) pickerRef.current.textContent = 'Google Maps did not initialize. Enable Maps JavaScript API for this key.'; return; }
      const map = new google.maps.Map(pickerRef.current, { center: { lat: Number(latitude) || 10, lng: Number(longitude) || 76.3 }, zoom: 12 });
      mapRef.current = map;
      const placePin = (position: any) => {
        setLatitude(position.lat().toFixed(6));
        setLongitude(position.lng().toFixed(6));
        markerRef.current?.setMap(null);
        markerRef.current = new google.maps.Marker({ map, position, draggable: true, title: 'Merchant location' });
        markerRef.current.addListener('dragend', (dragEvent: any) => { if (dragEvent.latLng) placePin(dragEvent.latLng); });
      };
      map.addListener('click', (event: any) => { if (event.latLng) placePin(event.latLng); });
    };
    if ((window as any).google?.maps) start();
    else {
      const callbackName = `aeMapsReady_${Date.now()}`;
      (window as any)[callbackName] = start;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callbackName}`;
      script.async = true;
      script.onerror = () => { if (pickerRef.current) pickerRef.current.textContent = 'Google Maps could not load. Check API enablement, billing, and domain restrictions.'; };
      document.head.appendChild(script);
      window.setTimeout(() => { if (pickerRef.current && !(window as any).google?.maps) pickerRef.current.textContent = 'Google Maps is still loading or blocked. Check the browser console and API key restrictions.'; }, 8000);
    }
  }, [mapPickerOpen]);

  function deleteMerchant(merchant: Merchant) {
    if (window.confirm(`Delete ${merchant.name} fully?\n\nThis removes the merchant login, orders, links, and customers that belong only to this merchant.`)) {
      remove.mutate(merchant);
    }
  }

  function resetMerchant(merchant: Merchant) {
    if (window.confirm(`${t('merchants.resetConfirm')}\n\n${merchant.name} · ${merchant.merchantCode}`)) {
      reset.mutate(merchant);
    }
  }

  return (
    <div className={`admin-directory-page ${onboardingOnly?'admin-onboarding-only':''}`}>
      <PageHeader title={onboardingOnly?uiText('Add merchant'):t('merchants.title')} subtitle={onboardingOnly?t('merchants.createSecure'):uiText('Stores and linked customers across your network')} actions={onboardingOnly?<Link className="button secondary" to="/merchants">{uiText('Back to merchants')}</Link>:<><button type="button" className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />{t('dashboard.excel')}</button><button type="button" className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />{t('dashboard.pdf')}</button><button type="button" className="button primary" aria-expanded={showOnboarding} onClick={()=>setShowOnboarding(!showOnboarding)}><Plus size={16}/>{uiText(showOnboarding?'Close onboarding':'Add merchant')}</button></>} />
      <div className="admin-directory-metrics"><article><span>{uiText('Matching merchants')}</span><strong>{merchants.isPending?'…':merchants.isError?'—':merchants.data?.pagination.total.toLocaleString('en-IN')}</strong></article><article><span>{uiText('Categories')}</span><strong>{categoriesQuery.isPending?'…':categoriesQuery.isError?'—':categoriesQuery.data?.categories.length}</strong></article><article><span>{uiText('Showing on this page')}</span><strong>{merchants.isPending?'…':merchants.isError?'—':merchants.data?.merchants.length}</strong></article></div>
      {(onboardingOnly || showOnboarding) && <form className="panel merchant-form" onSubmit={submit}>
        <div className="panel-heading">
          <div><h2>{t('merchants.add')}</h2><p>{t('merchants.createSecure')}</p></div>
          <Plus />
        </div>
        <nav aria-label={uiText("Onboarding steps")} className="attendance-actions">{['Business Details','Location','Photos','Review'].map((title,index) => <span key={title} aria-current={onboardStep === index ? 'step' : undefined} style={{ padding: 10, color: onboardStep === index ? '#0064ff' : '#64748b', fontWeight: 700 }}>{index + 1}. {title}</span>)}</nav><fieldset disabled={onboardStep !== 0} hidden={onboardStep !== 0} style={{ border: 0 }}><div className="four-column-form">
          <label>{t('merchants.storeName')}<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>{t('login.email')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>{t('merchants.phone')}<div className="phone-field"><span>+91</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" pattern="[6-9][0-9]{9}" required /></div></label>
          <label>
            {t('merchants.tempPassword')}
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required />
            <small>{t('merchants.passwordHelp')}</small>
          </label>
          
          <label>{uiText(" Category (Optional) ")}<select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); if (e.target.value !== '__other__') setCustomCategory(''); }}>
              <option value="">{uiText("No Category")}</option>
              {categoriesQuery.data?.categories?.filter(c => c.name.trim().toLowerCase() !== 'other').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__other__">{uiText("Other")}</option>
            </select>
            {categoryId === '__other__' && <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder={uiText("Enter new category")} style={{ marginTop: '6px' }} required autoFocus />}
          </label>
          </div></fieldset><fieldset disabled={onboardStep !== 1} hidden={onboardStep !== 1} style={{ border: 0 }}><div className="four-column-form"><label>{uiText("Store address ")}<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={uiText("Street, city")} /></label>
          <label>{uiText("Merchant route")}<select value={merchantRoute} onChange={event => setMerchantRoute(event.target.value)}><option value="">{uiText("Select route")}</option>{MERCHANT_ROUTES.map(route => <option key={route} value={route}>{routeLabel(route)}</option>)}</select></label>
          <label>{uiText("Opening Time")}<TimeInput value={openingTime} required={!!closingTime} onChange={setOpeningTime} /></label><label>{uiText("Closing Time")}<TimeInput value={closingTime} required={!!openingTime} onChange={setClosingTime} /></label>
          <label>{uiText("Latitude ")}<input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="e.g. 9.9312" /></label>
          <label>{uiText("Longitude ")}<input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="e.g. 76.2673" /></label>
          </div><button type="button" className="button secondary" onClick={() => setMapPickerOpen(true)}>{uiText("Select location on map")}</button></fieldset><fieldset disabled={onboardStep !== 2} hidden={onboardStep !== 2} style={{ border: 0 }}><div className="four-column-form"><label>{uiText("Upload Photo (required)")}<input type="file" accept="image/jpeg,image/png" disabled={uploadingPhoto || create.isPending} onChange={event => { void uploadShopPhoto(event.target.files?.[0]); event.target.value = ''; }} /><small>{uiText("JPG or PNG, maximum 5 MB.")}</small></label><LiveCamera facing="environment" disabled={uploadingPhoto || create.isPending} label="Take Photo" onCapture={file => void uploadShopPhoto(file)} />
        </div>
        {shopImages.map((url, index) => <div key={url}><img src={url} alt={`Shop photo ${index + 1}`} style={{ width: 120, height: 80, objectFit: 'cover' }} /><button type="button" className="button secondary" onClick={() => setShopImages(images => images.filter((_, position) => position !== index))}>{uiText("Remove photo")}</button></div>)}
        </fieldset>{onboardStep === 3 && <div className="field-review"><h3>{uiText("Review merchant details")}</h3>{[['Shop name',name],['Email',email],['Phone',phone],['Category',categoryId === '__other__' ? customCategory : categoriesQuery.data?.categories.find(c => c.id === categoryId)?.name],['Address',address],['Route',routeLabel(merchantRoute)],['Opening time',formatClockTime(openingTime)],['Closing time',formatClockTime(closingTime)],['Location',`${latitude}, ${longitude}`]].map(([label,value]) => <p key={label}><strong>{uiText(label)}:</strong> {value || 'Not provided'}</p>)}{shopImages.map(url => <img key={url} src={url} alt={uiText("Shop photo review")} style={{ width: 120, borderRadius: 12 }} />)}</div>}{onboardStep === 0 && <button type="button" className="button secondary" onClick={generateCredentials}>{uiText("Generate login email & password")}</button>}{onboardStep > 0 && <button type="button" className="button secondary" onClick={() => setOnboardStep(onboardStep - 1)}>{uiText("Back")}</button>}
        <button className="button primary" disabled={create.isPending || uploadingPhoto}>
          <Plus size={16} />{create.isPending ? t('merchants.creating') : onboardStep < 3 ? uiText("Next") : t('merchants.add')}
        </button>
        <button type="button" className="button secondary" onClick={() => setMapPickerOpen(true)}><MapPinned size={16} />{uiText(" Select location on map")}</button>
      </form>}

      <div className="list-toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={uiText('Search merchants')} aria-label={t('common.search')} /></label>
      </div>

      {!onboardingOnly && (merchants.isPending ? <LoadingState label={t('common.loading')} /> : merchants.isError ? (
        <ErrorState error={merchants.error} retry={() => merchants.refetch()} />
      ) : (
        <section className="table-panel">
          <div className="table-scroll">
            <table>
              <thead><tr><th>{t('merchants.storeName')}</th><th>{uiText('Category')}</th><th>{uiText('Contact')}</th><th>{t('merchants.joined')}</th><th>{t('dashboard.orders')}</th><th>{t('merchants.actions')}</th></tr></thead>
              <tbody>
                {merchants.data?.merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td><Link className="admin-merchant-name" to={`/merchants/${merchant.id}`}><span className="admin-directory-avatar">{merchant.name.slice(0,1)}</span><span><strong>{merchant.name}</strong><small>{merchant.merchantCode}</small></span></Link>{merchant.mustChangePassword ? <small className="table-note">{uiText('Password change required')}</small> : null}</td>
                    <td>{merchant.category || <span className="text-gray-400">{uiText("None")}</span>}</td>
                    <td><span className="admin-contact-stack"><span>{merchant.email}</span><small>{merchant.phone}</small></span></td>
                    <td>{formatDate(merchant.joined)}</td>
                    <td>{merchant.orderCount ?? 0}</td>
                    <td>
                      <div className="table-actions">
                        <button className="button secondary" onClick={() => setAllocation(merchant)}>{uiText("Allocate points")}</button>
                        <Link className="icon-button" title={uiText("View merchant")} to={`/merchants/${merchant.id}`}><Eye /></Link>
                        <button className="icon-button" title={t('merchants.reset')} disabled={reset.isPending} onClick={() => resetMerchant(merchant)}><KeyRound /></button>
                        <button className="icon-button danger-icon" title={uiText("Delete merchant")} disabled={remove.isPending} onClick={() => deleteMerchant(merchant)}><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!merchants.data?.merchants.length ? <EmptyState>{uiText("No merchants found.")}</EmptyState> : null}
          <PaginationBar pagination={merchants.data?.pagination} onPage={setPage} />
        </section>
      ))}

      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin defaultSection="merchants" fixedSection onClose={() => setExportFormat(null)} />
      {allocation && <AllocateMerchantPoints merchantId={allocation.id} name={allocation.name} onClose={() => setAllocation(null)}/>}
      {mapPickerOpen ? <div className="modal-backdrop" onClick={() => setMapPickerOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button type="button" className="icon-button modal-close" onClick={() => setMapPickerOpen(false)}><X /></button><h2>{uiText("Select merchant location")}</h2><p>{uiText("Search for a place or click the exact location.")}</p><div style={{ display: 'flex', gap: 8, marginBottom: 10 }}><input value={mapSearch} onChange={event => setMapSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); (event.currentTarget.nextElementSibling as HTMLButtonElement)?.click(); } }} placeholder={uiText("Search address or place")} style={{ flex: 1 }} /><button type="button" className="button secondary" onClick={() => { const google = (window as any).google; if (!mapSearch.trim() || !google?.maps || !mapRef.current) return; setLocationMessage('Searching...'); new google.maps.Geocoder().geocode({ address: mapSearch.trim() }, (results: any[], status: string) => { const point = results?.[0]?.geometry?.location; if (status !== 'OK' || !point) { setLocationMessage('Place not found. Try a more specific address.'); return; } const position = { lat: point.lat(), lng: point.lng() }; setLatitude(position.lat.toFixed(6)); setLongitude(position.lng.toFixed(6)); mapRef.current.setCenter(position); mapRef.current.setZoom(16); markerRef.current?.setMap(null); markerRef.current = new google.maps.Marker({ map: mapRef.current, position, title: results[0].formatted_address }); setLocationMessage('Location selected.'); }); }}>{uiText("Search")}</button></div><div ref={pickerRef} style={{ height: 360, borderRadius: 12, overflow: 'hidden' }} /><div className="form-actions"><button type="button" className="button secondary" onClick={() => { setLocationMessage(''); if (!navigator.geolocation) { setLocationMessage('Location is not supported by this browser.'); return; } setLocationMessage('Finding your location...'); navigator.geolocation.getCurrentPosition(({ coords }) => { const lat = coords.latitude.toFixed(6); const lng = coords.longitude.toFixed(6); setLatitude(lat); setLongitude(lng); const position = { lat: coords.latitude, lng: coords.longitude }; mapRef.current?.setCenter(position); mapRef.current?.setZoom(16); const google = (window as any).google; if (google?.maps && mapRef.current) { markerRef.current?.setMap(null); markerRef.current = new google.maps.Marker({ map: mapRef.current, position, title: 'Your current location' }); } setLocationMessage('Current location selected.'); }, () => setLocationMessage('Unable to get your location. Allow location access and try again.'), { enableHighAccuracy: true, timeout: 10000 }); }}>{uiText("Use my current location")}</button><button type="button" className="button primary" onClick={() => setMapPickerOpen(false)}>{uiText("Use this location")}</button></div>{locationMessage ? <p style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>{locationMessage}</p> : null}</div></div> : null}
    </div>
  );
}

export function MerchantProfile() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', address: '', latitude: '', longitude: '' });
  const summary = useQuery({
    queryKey: ['merchant-summary', id],
    queryFn: ({ signal }) => apiFetch<MerchantSummaryResponse>(`/api/merchants/${encodeURIComponent(id)}/summary`, { signal }),
    enabled: Boolean(id),
  });
  const entitlements = useQuery({ queryKey: ['merchant-entitlements', id], queryFn: () => apiFetch<any>(`/api/merchants/${encodeURIComponent(id)}/entitlements`), enabled: Boolean(id) });
  const paymentSettings = useQuery({ queryKey: ['merchant-payment-settings', id], queryFn: () => apiFetch<any>(`/api/merchants/${encodeURIComponent(id)}/payment-settings`), enabled: Boolean(id) });
  const [entitlementForm, setEntitlementForm] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState<any>(null);
  useEffect(() => { if (entitlements.data?.data) setEntitlementForm(entitlements.data.data); }, [entitlements.data]);
  useEffect(() => { if (paymentSettings.data?.data) setPaymentForm(paymentSettings.data.data); }, [paymentSettings.data]);
  const saveEntitlements = useMutation({ mutationFn: () => apiFetch(`/api/merchants/${encodeURIComponent(id)}/entitlements`, { method: 'PATCH', body: JSON.stringify(entitlementForm) }), onSuccess: () => { void entitlements.refetch(); showToast('Merchant plan and feature access updated.'); }, onError: error => showToast(error.message, 'error') });
  const savePaymentSettings = useMutation({ mutationFn: () => apiFetch(`/api/merchants/${encodeURIComponent(id)}/payment-settings`, { method: 'PATCH', body: JSON.stringify(paymentForm) }), onSuccess: () => { void paymentSettings.refetch(); showToast('Merchant payment settings updated.'); }, onError: error => showToast(error.message, 'error') });
  const reset = useMutation({
    mutationFn: () => apiFetch<CredentialResult>(`/api/merchants/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
    onSuccess(data) { setCredentials(data); showToast(t('merchants.resetDone')); },
    onError(error) { showToast(error.message, 'error'); },
  });
  const update = useMutation({ mutationFn: () => apiFetch(`/api/merchants/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(editForm) }), onSuccess: () => { setEditing(false); void summary.refetch(); showToast('Merchant details updated.'); }, onError: error => showToast(error.message, 'error') });

  if (summary.isPending) return <LoadingState label="Loading merchant profile" />;
  if (summary.isError) return <ErrorState error={summary.error} retry={() => summary.refetch()} />;
  const data = summary.data!;
  const stats = data.summary;

  return (
    <>
      <PageHeader
        title={data.merchant.name}
        subtitle={`${data.merchant.merchantCode} · ${data.merchant.email} · ${data.merchant.phone} · ${t('merchants.joined')} ${formatDate(data.merchant.joined)}`}
        actions={(
          <>
            <button className="button secondary" onClick={() => {
              if (window.confirm(t('merchants.resetConfirm'))) reset.mutate();
            }}><KeyRound size={16} />{t('merchants.reset')}</button>
            <button className="button primary" onClick={() => { setEditForm({ name: data.merchant.name || '', email: data.merchant.email || '', phone: data.merchant.phone || '', address: data.merchant.address || '', latitude: data.merchant.latitude?.toString() || '', longitude: data.merchant.longitude?.toString() || '' }); setEditing(true); }}><Pencil size={16} />Edit merchant</button>
            <button className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />Excel</button>
            <button className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />PDF</button>
            <button className="button secondary" onClick={() => navigate('/merchants')}><ArrowLeft size={16} />Back</button>
          </>
        )}
      />
      <div className="metric-grid merchant-metrics">
        <article className="metric-card violet"><div><span>{uiText("Total orders")}</span><strong>{stats.totalOrders}</strong><small>{uiText("All time")}</small></div></article>
        <article className="metric-card blue"><div><span>{uiText("Points issued")}</span><strong>{formatPoints(stats.pointsIssued)}</strong><small>{uiText("From orders")}</small></div></article>
        <article className="metric-card pink"><div><span>{uiText("Customers")}</span><strong>{stats.totalCustomers}</strong><small>{uiText("Linked to this merchant")}</small></div></article>
        <article className="metric-card green"><div><span>{uiText("Retention")}</span><strong>{stats.retainedCustomers}</strong><small>{stats.retentionRate}{uiText("% retained")}</small></div></article>
      </div>
      {entitlementForm ? <section className="panel merchant-entitlements"><div className="panel-heading"><div><h2>{uiText("Subscription & feature access")}</h2><p>{uiText("Admin controls what this merchant can use.")}</p></div><span className="tag violet">{uiText("Admin controlled")}</span></div><div className="form-grid"><label>{uiText("Plan")}<select value={entitlementForm.plan} onChange={e => setEntitlementForm({ ...entitlementForm, plan: e.target.value })}><option value="free">{uiText("Free")}</option><option value="basic">{uiText("Basic")}</option><option value="premium">{uiText("Premium")}</option><option value="enterprise">{uiText("Enterprise")}</option></select></label><label>{uiText("Expiry date")}<input type="date" value={entitlementForm.expiresAt ? entitlementForm.expiresAt.slice(0, 10) : ''} onChange={e => setEntitlementForm({ ...entitlementForm, expiresAt: e.target.value || null })} /></label><label>{uiText("Customer limit")}<input type="number" min="0" value={entitlementForm.limits.customers} onChange={e => setEntitlementForm({ ...entitlementForm, limits: { ...entitlementForm.limits, customers: Number(e.target.value) } })} /></label><label>{uiText("Offer limit")}<input type="number" min="0" value={entitlementForm.limits.offers} onChange={e => setEntitlementForm({ ...entitlementForm, limits: { ...entitlementForm.limits, offers: Number(e.target.value) } })} /></label></div><label className="checkbox-row"><input type="checkbox" checked={entitlementForm.paid} onChange={e => setEntitlementForm({ ...entitlementForm, paid: e.target.checked })} />{uiText(" Paid subscription active")}</label><div className="merchant-feature-grid">{Object.entries(entitlementForm.features).map(([key, enabled]) => <label className="checkbox-row" key={key}><input type="checkbox" checked={Boolean(enabled)} onChange={e => setEntitlementForm({ ...entitlementForm, features: { ...entitlementForm.features, [key]: e.target.checked } })} /> {key === 'crm' ? uiText("CRM & customer management") : key[0].toUpperCase() + key.slice(1)}</label>)}</div><button className="button primary" disabled={saveEntitlements.isPending} onClick={() => saveEntitlements.mutate()}>{saveEntitlements.isPending ? uiText("Saving…") : uiText("Save subscription & features")}</button></section> : null}
      {paymentForm ? <section className="panel merchant-entitlements"><div className="panel-heading"><div><h2>{uiText("Payment & UPI settings")}</h2><p>{uiText("Configure where this merchant receives customer payments.")}</p></div><span className="tag green">{uiText("Admin editable")}</span></div><div className="form-grid"><label>{uiText("UPI ID")}<input value={paymentForm.upiId || ''} onChange={e => setPaymentForm({ ...paymentForm, upiId: e.target.value })} placeholder={uiText("merchant@upi")} /></label><label>{uiText("Display name")}<input value={paymentForm.displayName || ''} onChange={e => setPaymentForm({ ...paymentForm, displayName: e.target.value })} /></label><label>{uiText("Provider")}<input value="Razorpay" readOnly /></label><label>{uiText("Mode")}<select value={paymentForm.mode || 'test'} onChange={e => setPaymentForm({ ...paymentForm, mode: e.target.value })}><option value="test">{uiText("Test")}</option><option value="live">{uiText("Live")}</option></select></label></div><label className="checkbox-row"><input type="checkbox" checked={Boolean(paymentForm.paymentEnabled)} onChange={e => setPaymentForm({ ...paymentForm, paymentEnabled: e.target.checked })} />{uiText(" Enable UPI payments")}</label><button className="button primary" disabled={savePaymentSettings.isPending} onClick={() => savePaymentSettings.mutate()}>{savePaymentSettings.isPending ? uiText("Saving…") : uiText("Save payment settings")}</button></section> : null}
      <section className="panel">
        <div className="panel-heading"><div><h2>{uiText("Merchant customers")}</h2><p>{uiText("Orders, points, and retention for this store only.")}</p></div></div>
        <div className="profile-customer-list">
          {data.customers.map((customer) => (
            <div className="profile-customer" key={customer.databaseId}>
              <div><strong>{customer.name}</strong><small>{customer.id} · {formatPhoneSafe(customer.phone)}</small></div>
              <span><small>{uiText("Orders")}</small><strong>{customer.orderCount || 0}</strong></span>
              <span><small>{uiText("Balance")}</small><strong className="points-text">{formatPoints(customer.rewardPoints)}{uiText(" pts")}</strong></span>
              <span className={`tag ${customer.isRetained ? 'success' : 'info'}`}>{customer.isRetained ? uiText("Returning") : uiText("New")}</span>
            </div>
          ))}
        </div>
        {!data.customers.length ? <EmptyState>{uiText("No customers linked to this merchant.")}</EmptyState> : null}
      </section>
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} merchantId={id} isAdmin onClose={() => setExportFormat(null)} />
      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      {editing ? <div className="modal-backdrop" onClick={() => setEditing(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); update.mutate(); }}><button type="button" className="icon-button modal-close" onClick={() => setEditing(false)}><X /></button><h2>{uiText("Edit merchant details")}</h2><div className="form-grid"><label>{uiText("Business name")}<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></label><label>{uiText("Email")}<input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required /></label><label>{uiText("Phone")}<input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} required /></label><label>{uiText("Address")}<input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></label><label>{uiText("Latitude")}<input value={editForm.latitude} onChange={e => setEditForm({ ...editForm, latitude: e.target.value })} /></label><label>{uiText("Longitude")}<input value={editForm.longitude} onChange={e => setEditForm({ ...editForm, longitude: e.target.value })} /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={() => setEditing(false)}>{uiText("Cancel")}</button><button className="button primary" disabled={update.isPending}>{update.isPending ? uiText("Saving…") : uiText("Save changes")}</button></div></form></div> : null}
    </>
  );
}

function CredentialsModal({ credentials, onClose }: { credentials: CredentialResult | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  if (!credentials) return null;
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    showToast('Copied');
  }
  return (
    <div className="modal-backdrop">
      <div className="modal credentials-modal">
        <button className="icon-button modal-close" title={t('common.close')} onClick={onClose}><X /></button>
        <h2>{t('merchants.credentials')}</h2>
        <p className={credentials.whatsapp.sent ? 'credential-delivery success' : 'credential-delivery error'}>
          {t(credentials.whatsapp.sent ? 'merchants.messageSent' : 'merchants.messageFailed')}
        </p>
        {credentials.whatsapp.error ? <small className="form-error">{credentials.whatsapp.error}</small> : null}
        <div className="credential-row"><span>{t('merchants.code')}</span><strong>{credentials.merchantCode}</strong><button className="icon-button" title={uiText("Copy")} onClick={() => void copy(credentials.merchantCode)}><Copy /></button></div>
        <div className="credential-row"><span>{t('merchants.loginEmail')}</span><strong>{credentials.loginEmail}</strong><button className="icon-button" title={uiText("Copy")} onClick={() => void copy(credentials.loginEmail)}><Copy /></button></div>
        <div className="credential-row sensitive"><span>{t('merchants.oneTimePassword')}</span><strong>{credentials.temporaryPassword}</strong><button className="icon-button" title={uiText("Copy")} onClick={() => void copy(credentials.temporaryPassword)}><Copy /></button></div>
        <button className="button primary" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}

function formatPhoneSafe(value: string) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : value;
}
