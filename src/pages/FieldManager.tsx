import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Eye,
  KeyRound,
  LogOut,
  MapPin,
  MapPinned,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Store,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../api';
import type { MerchantCategory, UserProfile } from '../types';
import { LoadingState, ErrorState, PageHeader } from '../components/Common';
import { useToast } from '../toast';

interface FieldMerchant {
  id: string;
  name: string;
  merchant_code: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category_id?: string;
  created_at?: string;
  active?: boolean;
  image_url?: string;
  images?: string[];
  merchant_categories?: { name?: string };
}

interface Visit {
  id: string;
  merchant_id: string;
  status: string;
  check_in_at: string;
  check_out_at?: string;
  distance_m?: number;
  accuracy_m?: number;
  merchants?: { name?: string; merchant_code?: string };
}

interface CredentialResult {
  merchantCode: string;
  userId?: string;
  loginEmail: string;
  temporaryPassword: string;
  phone?: string;
  storeName?: string;
  whatsapp: { sent: boolean; status: string; error: string | null };
}

interface CreateMerchantApiResponse {
  success: boolean;
  merchant: {
    id: string;
    merchantCode: string;
    name: string;
    email: string;
    phone: string;
    joined: string;
  };
  temporaryPassword: string;
  whatsapp: { sent: boolean; status: string; error: string | null };
}

interface ShopImageItem {
  id: string;
  url: string;
  path?: string;
}

function generateStrongPassword() {
  const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const charsLower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!';

  let pwd = 'Ae@';
  for (let i = 0; i < 4; i++) pwd += charsUpper[Math.floor(Math.random() * charsUpper.length)];
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 3; i++) pwd += charsLower[Math.floor(Math.random() * charsLower.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  return pwd;
}

function generateMerchantUserId(storeName: string) {
  const clean = storeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'store';
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${clean}${randomNum}`;
}

const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export function FieldManager({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'onboarding' | 'directory' | 'visits'>('onboarding');

  // Location tracking
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState('');

  // Form state - exactly matching Admin Merchants form
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Shop Images State
  const [shopImages, setShopImages] = useState<ShopImageItem[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Map Picker State (identical to Admin Merchants)
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [mapSearch, setMapSearch] = useState('');

  // Result credentials modal
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);

  // Search & visit state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<FieldMerchant | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [notes, setNotes] = useState('');

  // Queries
  const merchantsQuery = useQuery({
    queryKey: ['field-merchants'],
    queryFn: () => apiFetch<{ merchants: FieldMerchant[] }>('/api/field/merchants'),
  });

  const categoriesQuery = useQuery({
    queryKey: ['merchant-categories'],
    queryFn: () => apiFetch<{ categories: MerchantCategory[] }>('/api/merchant-categories'),
  });

  const visitsQuery = useQuery({
    queryKey: ['field-visits'],
    queryFn: () => apiFetch<{ visits: Visit[] }>('/api/field/visits'),
  });

  // Watch position for distance and check-in
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition(pos);
        setLocationError('');
      },
      () => setLocationError('Location permission is required for GPS proximity and store check-in.'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Sync active visit
  useEffect(() => {
    const active = visitsQuery.data?.visits.find((v) => v.status === 'active');
    if (active) setActiveVisit(active);
  }, [visitsQuery.data]);

  // Google Maps picker lifecycle (identical to Admin Merchants)
  useEffect(() => {
    if (!mapPickerOpen || !pickerRef.current) return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) {
      if (pickerRef.current) pickerRef.current.textContent = 'Map key is not available in this deployment.';
      return;
    }
    const start = () => {
      const google = (window as any).google;
      if (!google?.maps || !pickerRef.current) {
        if (pickerRef.current) pickerRef.current.textContent = 'Google Maps did not initialize. Enable Maps JavaScript API for this key.';
        return;
      }
      const map = new google.maps.Map(pickerRef.current, {
        center: { lat: Number(latitude) || 10, lng: Number(longitude) || 76.3 },
        zoom: 12,
      });
      mapRef.current = map;
      const placePin = (pos: any) => {
        setLatitude(pos.lat().toFixed(6));
        setLongitude(pos.lng().toFixed(6));
        markerRef.current?.setMap(null);
        markerRef.current = new google.maps.Marker({
          map,
          position: pos,
          draggable: true,
          title: 'Merchant location',
        });
        markerRef.current.addListener('dragend', (dragEvent: any) => {
          if (dragEvent.latLng) placePin(dragEvent.latLng);
        });
      };
      map.addListener('click', (event: any) => {
        if (event.latLng) placePin(event.latLng);
      });
    };

    if ((window as any).google?.maps) {
      start();
    } else {
      const callbackName = `aeMapsReady_${Date.now()}`;
      (window as any)[callbackName] = start;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callbackName}`;
      script.async = true;
      script.onerror = () => {
        if (pickerRef.current) pickerRef.current.textContent = 'Google Maps could not load. Check API enablement and network.';
      };
      document.head.appendChild(script);
      window.setTimeout(() => {
        if (pickerRef.current && !(window as any).google?.maps) {
          pickerRef.current.textContent = 'Google Maps is still loading or blocked. Check network connection.';
        }
      }, 8000);
    }
  }, [mapPickerOpen]);

  // Compute nearby merchants with distance
  const nearbyMerchants = useMemo(() => {
    const list = merchantsQuery.data?.merchants || [];
    return list
      .map((m) => {
        const dist =
          position && m.latitude && m.longitude
            ? calculateDistanceMeters(
                position.coords.latitude,
                position.coords.longitude,
                Number(m.latitude),
                Number(m.longitude)
              )
            : null;
        return { ...m, distance: dist };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [merchantsQuery.data, position]);

  // Filtered merchants for directory
  const filteredMerchants = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = merchantsQuery.data?.merchants || [];
    return list.filter((m) => {
      const matchSearch =
        !term ||
        m.name.toLowerCase().includes(term) ||
        m.merchant_code.toLowerCase().includes(term) ||
        (m.phone && m.phone.toLowerCase().includes(term)) ||
        (m.address && m.address.toLowerCase().includes(term));
      const matchCategory = !categoryFilter || m.category_id === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [merchantsQuery.data, search, categoryFilter]);

  // Generators for User ID and Password
  const handleGenerateBoth = () => {
    const newId = generateMerchantUserId(name);
    const newPwd = generateStrongPassword();
    setUserId(newId);
    setEmail(`${newId}@ae-rewards.com`);
    setPassword(newPwd);
    showToast('Generated User ID and Password');
  };

  const handleUserIdChange = (val: string) => {
    setUserId(val);
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!email || email.endsWith('@ae-rewards.com')) {
      setEmail(sanitized ? `${sanitized}@ae-rewards.com` : '');
    }
  };

  // Capture GPS coordinates for the onboarding store
  const captureGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported on this browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        showToast(`Store GPS acquired (±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        showToast(`GPS error: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Image Upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          showToast('Only image files (JPG, PNG, WEBP) are supported.', 'error');
          continue;
        }

        const formData = new FormData();
        formData.append('image', file);

        const res = await apiFetch<{ success: boolean; url: string; path?: string }>('/api/field/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (res.url) {
          setShopImages((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, url: res.url, path: res.path },
          ]);
          showToast('Shop photo uploaded');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const removeShopImage = (id: string) => {
    setShopImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Create Merchant Mutation (same endpoint & payload as Admin)
  const create = useMutation({
    mutationFn: () => {
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanUserId = userId.trim();
      const finalEmail = (email.trim() || (cleanUserId ? `${cleanUserId.toLowerCase()}@ae-rewards.com` : '')).toLowerCase();
      return apiFetch<CreateMerchantApiResponse>('/api/merchants', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          userId: cleanUserId || undefined,
          email: finalEmail,
          phone: `+91${cleanPhone}`,
          password,
          category_id: categoryId || undefined,
          address: address.trim() || undefined,
          latitude: latitude || undefined,
          longitude: longitude || undefined,
          image_url: shopImages[0]?.url || undefined,
          images: shopImages.map((img) => img.url),
        }),
      });
    },
    onSuccess(data) {
      setCredentials({
        merchantCode: data.merchant.merchantCode,
        userId: userId.trim() || data.merchant.merchantCode,
        loginEmail: data.merchant.email,
        temporaryPassword: data.temporaryPassword,
        phone: data.merchant.phone,
        storeName: data.merchant.name,
        whatsapp: data.whatsapp,
      });
      setName('');
      setUserId('');
      setEmail('');
      setPhone('');
      setPassword('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setShopImages([]);
      showToast(t('merchants.created'));
      void queryClient.invalidateQueries({ queryKey: ['field-merchants'] });
    },
    onError(error) {
      showToast(error.message, 'error');
    },
  });

  const handleOnboardSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  // Visit check-in/out mutations
  const checkInMutation = useMutation({
    mutationFn: async (merchant: FieldMerchant) => {
      const p = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      );
      return apiFetch<{ visit: Visit }>(`/api/field/visits/check-in`, {
        method: 'POST',
        body: JSON.stringify({
          merchantId: merchant.id,
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      });
    },
    onSuccess: (data) => {
      setActiveVisit(data.visit);
      showToast('Checked in successfully');
      void queryClient.invalidateQueries({ queryKey: ['field-visits'] });
    },
    onError: (e) => showToast(e.message, 'error'),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const p = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      );
      return apiFetch<{ visit: Visit }>(`/api/field/visits/${activeVisit?.id}/check-out`, {
        method: 'POST',
        body: JSON.stringify({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          notes,
        }),
      });
    },
    onSuccess: () => {
      setActiveVisit(null);
      setNotes('');
      showToast('Visit completed');
      void queryClient.invalidateQueries({ queryKey: ['field-visits'] });
    },
    onError: (e) => showToast(e.message, 'error'),
  });

  const handleSignOut = async () => {
    try {
      await apiFetch('/api/field/sessions/end', { method: 'POST' });
    } finally {
      onLogout();
    }
  };

  if (merchantsQuery.isPending) return <LoadingState />;
  if (merchantsQuery.isError) {
    return <ErrorState error={merchantsQuery.error} retry={() => merchantsQuery.refetch()} />;
  }

  const allMerchants = merchantsQuery.data?.merchants || [];
  const categories = categoriesQuery.data?.categories || [];

  return (
    <div className="dashboard-page">
      {/* Header bar */}
      <PageHeader
        title="Field Manager"
        subtitle={`Signed in as ${user.full_name || user.email}`}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {position && (
              <span
                style={{
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  background: 'var(--green-soft)',
                  color: 'var(--green)',
                  borderRadius: '12px',
                  fontWeight: 500,
                }}
              >
                <Compass size={13} /> GPS Live (±{Math.round(position.coords.accuracy)}m)
              </span>
            )}
            <button className="button secondary" onClick={() => void handleSignOut()}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        }
      />

      {/* Global alert / location message */}
      {locationError && (
        <div className="state-panel" role="alert">
          {locationError}
        </div>
      )}

      {/* Active Visit Banner if checked in */}
      {activeVisit && (
        <section className="panel" style={{ borderColor: '#0f8a54' }}>
          <h2>Active visit: {activeVisit.merchants?.name || selectedMerchant?.name || 'Merchant'}</h2>
          <p>
            Checked in at {new Date(activeVisit.check_in_at).toLocaleString()} · GPS accuracy{' '}
            {Math.round(activeVisit.accuracy_m || 0)}m
          </p>
          <div className="form-grid">
            <label>
              Visit notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              className="button primary"
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
            >
              <CheckCircle2 size={16} />
              {checkOutMutation.isPending ? 'Checking out…' : 'Check out'}
            </button>
          </div>
        </section>
      )}

      {/* Top Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '10px',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('onboarding')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            background: activeTab === 'onboarding' ? 'var(--primary)' : 'var(--surface)',
            color: activeTab === 'onboarding' ? '#ffffff' : 'var(--text)',
            boxShadow: activeTab === 'onboarding' ? '0 2px 8px rgba(81,69,215,0.25)' : 'none',
          }}
        >
          <UserPlus size={17} /> Onboard Merchant
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            background: activeTab === 'directory' ? 'var(--primary)' : 'var(--surface)',
            color: activeTab === 'directory' ? '#ffffff' : 'var(--text)',
          }}
        >
          <Store size={17} /> All Merchants ({allMerchants.length})
        </button>

        <button
          onClick={() => setActiveTab('visits')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            background: activeTab === 'visits' ? 'var(--primary)' : 'var(--surface)',
            color: activeTab === 'visits' ? '#ffffff' : 'var(--text)',
          }}
        >
          <MapPin size={17} /> Visits & Check-in {activeVisit ? '•' : ''}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ONBOARDING SECTION (SAME AS ALL OTHER FORMS) */}
      {/* ========================================================================= */}
      {activeTab === 'onboarding' && (
        <>
          <form className="panel merchant-form" onSubmit={handleOnboardSubmit}>
            <div className="panel-heading">
              <div>
                <h2>{t('merchants.add')}</h2>
                <p>{t('merchants.createSecure')}</p>
              </div>
              <Plus />
            </div>

            <div className="four-column-form">
              <label>
                {t('merchants.storeName')}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>

              <label>
                User ID
                <input
                  value={userId}
                  onChange={(event) => handleUserIdChange(event.target.value)}
                  placeholder="e.g. store101"
                  required
                />
              </label>

              <label>
                {t('login.email')}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value.toLowerCase())}
                  placeholder="e.g. store101@ae-rewards.com"
                  required
                />
              </label>

              <label>
                {t('merchants.phone')}
                <div className="phone-field">
                  <span>+91</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    required
                  />
                </div>
              </label>

              <label>
                {t('merchants.tempPassword')}
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={10}
                  required
                />
                <small>{t('merchants.passwordHelp')}</small>
              </label>

              <label>
                Category (Optional)
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">No Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Store address{' '}
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Street, city"
                />
              </label>

              <label>
                Shop image (Optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  disabled={isUploadingImage}
                />
              </label>
            </div>

            {/* Uploaded thumbnails preview if any */}
            {shopImages.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {shopImages.map((img, idx) => (
                  <div
                    key={img.id}
                    style={{
                      position: 'relative',
                      width: '74px',
                      height: '74px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-alt)',
                    }}
                  >
                    <img
                      src={img.url}
                      alt={`Shop ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => setPreviewImageUrl(img.url)}
                      title="View full image"
                    />
                    <button
                      type="button"
                      onClick={() => removeShopImage(img.id)}
                      style={{
                        position: 'absolute',
                        top: '3px',
                        right: '3px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                      title="Remove image"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isUploadingImage && (
              <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500, marginBottom: '12px' }}>
                Uploading shop photo…
              </p>
            )}

            {/* Form Action Buttons */}
            <div className="form-actions">
              <button className="button primary" disabled={create.isPending || isUploadingImage}>
                <Plus size={16} />
                {create.isPending ? t('merchants.creating') : t('merchants.add')}
              </button>

              <button
                type="button"
                className="button secondary"
                onClick={handleGenerateBoth}
              >
                <Sparkles size={16} /> Generate User ID & Password
              </button>

              <button
                type="button"
                className="button secondary"
                onClick={() => setMapPickerOpen(true)}
              >
                <MapPinned size={16} /> Select location on map
              </button>

              <button
                type="button"
                className="button secondary"
                onClick={captureGps}
              >
                <MapPin size={16} /> Use current location
              </button>

              {latitude && longitude ? (
                <span style={{ fontSize: '12px', color: '#0f8a54', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Location pinned ({Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)})
                </span>
              ) : null}
            </div>
          </form>

          {/* Recently Onboarded Stores Preview */}
          <section className="table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('merchants.code')}</th>
                    <th>{t('merchants.storeName')}</th>
                    <th>Category</th>
                    <th>{t('login.email')}</th>
                    <th>{t('merchants.phone')}</th>
                    <th>Address</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allMerchants.slice(0, 10).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.merchant_code}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {m.image_url ? (
                            <img
                              src={m.image_url}
                              alt={m.name}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '4px',
                                objectFit: 'cover',
                                cursor: 'pointer',
                              }}
                              onClick={() => setPreviewImageUrl(m.image_url!)}
                              title="Click to view image"
                            />
                          ) : (
                            <Store size={18} style={{ color: 'var(--muted)' }} />
                          )}
                          <strong>{m.name}</strong>
                        </div>
                      </td>
                      <td>{m.merchant_categories?.name || 'General'}</td>
                      <td>{m.email}</td>
                      <td>{m.phone}</td>
                      <td>{m.address || '—'}</td>
                      <td>
                        <div className="table-actions">
                          {m.phone && (
                            <a
                              href={`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `Hello ${m.name}, regarding your AE Merchant account (${m.merchant_code}). Please let us know if you need any assistance!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-button"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle color="#25D366" />
                            </a>
                          )}
                          <button
                            className="icon-button"
                            title="Check in"
                            disabled={Boolean(activeVisit)}
                            onClick={() => {
                              setSelectedMerchant(m);
                              checkInMutation.mutate(m);
                            }}
                          >
                            <MapPin />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allMerchants.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                        No merchants onboarded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALL MERCHANTS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <>
          <div className="list-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search store name, code, phone, address…"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <section className="table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('merchants.code')}</th>
                    <th>{t('merchants.storeName')}</th>
                    <th>Category</th>
                    <th>{t('login.email')}</th>
                    <th>{t('merchants.phone')}</th>
                    <th>Address</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMerchants.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.merchant_code}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {m.image_url ? (
                            <img
                              src={m.image_url}
                              alt={m.name}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '4px',
                                objectFit: 'cover',
                                cursor: 'pointer',
                              }}
                              onClick={() => setPreviewImageUrl(m.image_url!)}
                              title="Click to view image"
                            />
                          ) : (
                            <Store size={18} style={{ color: 'var(--muted)' }} />
                          )}
                          <strong>{m.name}</strong>
                        </div>
                      </td>
                      <td>{m.merchant_categories?.name || 'General'}</td>
                      <td>{m.email}</td>
                      <td>{m.phone}</td>
                      <td>{m.address || '—'}</td>
                      <td>
                        <div className="table-actions">
                          {m.phone && (
                            <a
                              href={`https://wa.me/${m.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-button"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle color="#25D366" />
                            </a>
                          )}
                          <button
                            className="icon-button"
                            title="Check in"
                            disabled={Boolean(activeVisit) || checkInMutation.isPending}
                            onClick={() => {
                              setSelectedMerchant(m);
                              checkInMutation.mutate(m);
                            }}
                          >
                            <MapPin />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMerchants.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                        No merchants found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VISITS & CHECK-IN */}
      {/* ========================================================================= */}
      {activeTab === 'visits' && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Nearby merchants</h2>
                <p>Allow browser location to calculate distance. Check-in is allowed within 150m.</p>
              </div>
              <MapPin />
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Address</th>
                    <th>Distance</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {nearbyMerchants.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.name}</strong>
                        <small>{m.merchant_code}</small>
                      </td>
                      <td>{m.address || 'No address saved'}</td>
                      <td>
                        {m.distance == null ? (
                          'Location unavailable'
                        ) : (
                          `${Math.round(m.distance)} m`
                        )}
                      </td>
                      <td>
                        <button
                          className="button primary"
                          disabled={Boolean(activeVisit) || checkInMutation.isPending || m.distance == null}
                          onClick={() => {
                            setSelectedMerchant(m);
                            checkInMutation.mutate(m);
                          }}
                        >
                          <MapPin size={15} /> Check in
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Recent visits</h2>
                <p>Your completed field activity.</p>
              </div>
              <XCircle />
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {visitsQuery.data?.visits.map((v) => (
                    <tr key={v.id}>
                      <td>{v.merchants?.name || v.merchant_id}</td>
                      <td>
                        <span className={`tag ${v.status === 'completed' ? 'success' : 'info'}`}>
                          {v.status}
                        </span>
                      </td>
                      <td>{new Date(v.check_in_at).toLocaleString()}</td>
                      <td>{v.distance_m ? `${Math.round(v.distance_m)}m` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* EXACT ADMIN CREDENTIALS MODAL */}
      {/* ========================================================================= */}
      <FieldCredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />

      {/* ========================================================================= */}
      {/* EXACT ADMIN GOOGLE MAPS PICKER MODAL */}
      {/* ========================================================================= */}
      {mapPickerOpen ? (
        <div className="modal-backdrop" onClick={() => setMapPickerOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="icon-button modal-close" onClick={() => setMapPickerOpen(false)}>
              <X />
            </button>
            <h2>Select merchant location</h2>
            <p>Search for a place or click the exact location.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={mapSearch}
                onChange={(event) => setMapSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    (event.currentTarget.nextElementSibling as HTMLButtonElement)?.click();
                  }
                }}
                placeholder="Search address or place"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  const google = (window as any).google;
                  if (!mapSearch.trim() || !google?.maps || !mapRef.current) return;
                  setLocationMessage('Searching...');
                  new google.maps.Geocoder().geocode(
                    { address: mapSearch.trim() },
                    (results: any[], status: string) => {
                      const point = results?.[0]?.geometry?.location;
                      if (status !== 'OK' || !point) {
                        setLocationMessage('Place not found. Try a more specific address.');
                        return;
                      }
                      const position = { lat: point.lat(), lng: point.lng() };
                      setLatitude(position.lat.toFixed(6));
                      setLongitude(position.lng.toFixed(6));
                      mapRef.current.setCenter(position);
                      mapRef.current.setZoom(16);
                      markerRef.current?.setMap(null);
                      markerRef.current = new google.maps.Marker({
                        map: mapRef.current,
                        position,
                        title: results[0].formatted_address,
                      });
                      setLocationMessage('Location selected.');
                    }
                  );
                }}
              >
                Search
              </button>
            </div>
            <div ref={pickerRef} style={{ height: 360, borderRadius: 12, overflow: 'hidden' }} />
            <div className="form-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setLocationMessage('');
                  if (!navigator.geolocation) {
                    setLocationMessage('Location is not supported by this browser.');
                    return;
                  }
                  setLocationMessage('Finding your location...');
                  navigator.geolocation.getCurrentPosition(
                    ({ coords }) => {
                      const lat = coords.latitude.toFixed(6);
                      const lng = coords.longitude.toFixed(6);
                      setLatitude(lat);
                      setLongitude(lng);
                      const pos = { lat: coords.latitude, lng: coords.longitude };
                      mapRef.current?.setCenter(pos);
                      mapRef.current?.setZoom(16);
                      const google = (window as any).google;
                      if (google?.maps && mapRef.current) {
                        markerRef.current?.setMap(null);
                        markerRef.current = new google.maps.Marker({
                          map: mapRef.current,
                          position: pos,
                          title: 'Your current location',
                        });
                      }
                      setLocationMessage('Current location selected.');
                    },
                    () => setLocationMessage('Unable to get your location. Allow location access and try again.'),
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
              >
                Use my current location
              </button>
              <button type="button" className="button primary" onClick={() => setMapPickerOpen(false)}>
                Use this location
              </button>
            </div>
            {locationMessage ? <p style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>{locationMessage}</p> : null}
          </div>
        </div>
      ) : null}

      {/* Image Preview Lightbox Modal */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '85vh',
              background: 'var(--surface)',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            }}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <X size={18} />
            </button>
            <img
              src={previewImageUrl}
              alt="Store Preview"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FieldCredentialsModal({
  credentials,
  onClose,
}: {
  credentials: CredentialResult | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  if (!credentials) return null;

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    showToast('Copied');
  }

  const cleanPhone = (credentials.phone || '').replace(/\D/g, '');
  const recipient = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  const loginUrl = `${window.location.origin}/login`;
  const displayUserId = credentials.userId || credentials.merchantCode;
  const messageText =
    `*Welcome to AE Reward Network!*\n\n` +
    `Hello ${credentials.storeName || 'Merchant'}, your merchant account has been onboarded and is now live.\n\n` +
    `*Your Login Credentials:*\n` +
    `👤 *User ID:* ${displayUserId}\n` +
    `🏷️ *Merchant Code:* ${credentials.merchantCode}\n` +
    `📧 *Login Email:* ${credentials.loginEmail}\n` +
    `🔑 *Temporary Password:* ${credentials.temporaryPassword}\n\n` +
    `👉 *Sign in here:* ${loginUrl}\n\n` +
    `Please log in to verify your profile and start issuing rewards.`;
  const waUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(messageText)}`;

  return (
    <div className="modal-backdrop">
      <div className="modal credentials-modal">
        <button className="icon-button modal-close" title={t('common.close')} onClick={onClose}>
          <X />
        </button>
        <h2>{t('merchants.credentials')}</h2>
        <p className={credentials.whatsapp.sent ? 'credential-delivery success' : 'credential-delivery error'}>
          {t(credentials.whatsapp.sent ? 'merchants.messageSent' : 'merchants.messageFailed')}
        </p>
        {credentials.whatsapp.error ? <small className="form-error">{credentials.whatsapp.error}</small> : null}
        <div className="credential-row">
          <span>User ID</span>
          <strong>{displayUserId}</strong>
          <button className="icon-button" title="Copy" onClick={() => void copy(displayUserId)}>
            <Copy />
          </button>
        </div>
        <div className="credential-row">
          <span>{t('merchants.code')}</span>
          <strong>{credentials.merchantCode}</strong>
          <button className="icon-button" title="Copy" onClick={() => void copy(credentials.merchantCode)}>
            <Copy />
          </button>
        </div>
        <div className="credential-row">
          <span>{t('merchants.loginEmail')}</span>
          <strong>{credentials.loginEmail}</strong>
          <button className="icon-button" title="Copy" onClick={() => void copy(credentials.loginEmail)}>
            <Copy />
          </button>
        </div>
        <div className="credential-row sensitive">
          <span>{t('merchants.oneTimePassword')}</span>
          <strong>{credentials.temporaryPassword}</strong>
          <button className="icon-button" title="Copy" onClick={() => void copy(credentials.temporaryPassword)}>
            <Copy />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          {cleanPhone && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button primary"
              style={{ background: '#25D366', borderColor: '#25D366', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <MessageCircle size={16} /> Send via WhatsApp
            </a>
          )}
          <button className="button secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
