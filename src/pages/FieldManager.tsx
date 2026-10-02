import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  MapPin,
  MapPinned,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Store,
  Trash2,
  Upload,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../api';
import type { MerchantCategory, UserProfile } from '../types';
import { LoadingState, ErrorState, PageHeader } from '../components/Common';

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

interface CreatedMerchantCredentials {
  merchantCode: string;
  name: string;
  loginEmail: string;
  temporaryPassword: string;
  phone: string;
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'onboarding' | 'directory' | 'visits'>('onboarding');

  // Location tracking
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState('');

  // Onboarding form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generateStrongPassword());
  const [showPassword, setShowPassword] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Shop Images State
  const [shopImages, setShopImages] = useState<ShopImageItem[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Result modal/card for created credentials
  const [credentials, setCredentials] = useState<CreatedMerchantCredentials | null>(null);
  const [formError, setFormError] = useState('');

  // Search & visit state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<FieldMerchant | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

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
      () => setLocationError('Location permission is required for GPS proximity and store verification.'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Sync active visit
  useEffect(() => {
    const active = visitsQuery.data?.visits.find((v) => v.status === 'active');
    if (active) setActiveVisit(active);
  }, [visitsQuery.data]);

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

  // Capture GPS coordinates for the onboarding store
  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported on this browser');
      return;
    }
    setIsCapturingGps(true);
    setGpsStatus('Capturing accurate store coordinates…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsStatus(
          `Location acquired: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(
            pos.coords.accuracy
          )}m)`
        );
        setIsCapturingGps(false);
      },
      (err) => {
        setGpsStatus(`GPS error: ${err.message}`);
        setIsCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Handle uploading shop images
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);
    setUploadError('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          setUploadError('Only image files (JPG, PNG, WEBP) are supported.');
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
        }
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload shop image');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const removeShopImage = (id: string) => {
    setShopImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Create Merchant Mutation
  const createMerchantMutation = useMutation({
    mutationFn: () => {
      setFormError('');
      const cleanPhone = phone.replace(/\D/g, '');
      return apiFetch<CreateMerchantApiResponse>('/api/merchants', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
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
        name: data.merchant.name,
        loginEmail: data.merchant.email,
        temporaryPassword: data.temporaryPassword,
        phone: data.merchant.phone,
        whatsapp: data.whatsapp,
      });
      // Clear inputs for next entry, generate new password
      setName('');
      setPhone('');
      setEmail('');
      setPassword(generateStrongPassword());
      setAddress('');
      setLatitude('');
      setLongitude('');
      setGpsStatus('');
      setShopImages([]);
      setStatusMessage(`Merchant ${data.merchant.name} onboarded successfully!`);
      void queryClient.invalidateQueries({ queryKey: ['field-merchants'] });
    },
    onError(err) {
      setFormError(err.message);
    },
  });

  const handleOnboardSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMerchantMutation.mutate();
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
      setStatusMessage('Checked in at merchant store.');
      void queryClient.invalidateQueries({ queryKey: ['field-visits'] });
    },
    onError: (e) => setStatusMessage(e.message),
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
      setStatusMessage('Store visit completed and recorded.');
      void queryClient.invalidateQueries({ queryKey: ['field-visits'] });
    },
    onError: (e) => setStatusMessage(e.message),
  });

  const updateVisitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch(`/api/field/visits/${activeVisit?.id}/update`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => setStatusMessage('Store update submitted for Admin review.'),
    onError: (e) => setStatusMessage(e.message),
  });

  const handleSignOut = async () => {
    try {
      await apiFetch('/api/field/sessions/end', { method: 'POST' });
    } finally {
      onLogout();
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getWhatsAppShareUrl = (
    phoneNum: string,
    merchantCode: string,
    storeName: string,
    storeEmail: string,
    pass: string
  ) => {
    const clean = phoneNum.replace(/\D/g, '');
    const recipient = clean.startsWith('91') ? clean : `91${clean}`;
    const loginUrl = `${window.location.origin}/login`;
    const messageText =
      `*Welcome to AE Reward Network!*\n\n` +
      `Hello ${storeName}, your merchant account has been onboarded and is now live.\n\n` +
      `*Your Login Credentials:*\n` +
      `🏪 *Store:* ${storeName}\n` +
      `🏷️ *Merchant Code:* ${merchantCode}\n` +
      `📧 *Login Email:* ${storeEmail}\n` +
      `🔑 *Temporary Password:* ${pass}\n\n` +
      `👉 *Sign in here:* ${loginUrl}\n\n` +
      `Please log in to verify your profile and start issuing rewards.`;
    return `https://wa.me/${recipient}?text=${encodeURIComponent(messageText)}`;
  };

  if (merchantsQuery.isPending) return <LoadingState />;
  if (merchantsQuery.isError) {
    return <ErrorState error={merchantsQuery.error} retry={() => merchantsQuery.refetch()} />;
  }

  const allMerchants = merchantsQuery.data?.merchants || [];
  const categories = categoriesQuery.data?.categories || [];

  return (
    <div className="dashboard-page" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header bar */}
      <PageHeader
        title="Field Manager"
        subtitle={`Signed in as ${user.full_name || user.email} · Onboard stores & record field visits`}
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

      {/* Global notifications/alerts */}
      {statusMessage && (
        <div
          className="state-panel"
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--green-soft)',
            borderColor: 'var(--green)',
            color: 'var(--green)',
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
          }}
        >
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage('')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {locationError && (
        <div
          className="state-panel"
          role="alert"
          style={{
            background: 'var(--amber-soft)',
            borderColor: 'var(--amber)',
            color: 'var(--amber)',
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
          }}
        >
          {locationError}
        </div>
      )}

      {/* Active Visit Banner if checked in */}
      {activeVisit && (
        <section
          className="panel"
          style={{
            borderColor: '#0f8a54',
            borderWidth: '2px',
            background: 'var(--surface)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="tag success" style={{ marginBottom: '6px', display: 'inline-block' }}>
                Active Visit in Progress
              </span>
              <h2 style={{ margin: '4px 0', fontSize: '18px' }}>
                {activeVisit.merchants?.name || selectedMerchant?.name || 'Merchant'}
              </h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                Checked in at {new Date(activeVisit.check_in_at).toLocaleTimeString()} · Accuracy ±
                {Math.round(activeVisit.accuracy_m || 0)}m
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button primary"
                onClick={() => checkOutMutation.mutate()}
                disabled={checkOutMutation.isPending}
              >
                <CheckCircle2 size={16} />
                {checkOutMutation.isPending ? 'Checking out…' : 'Check out'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Visit notes / store updates
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. Verified QR placement, updated shop timings, merchant requested materials"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="button secondary"
                onClick={() => updateVisitMutation.mutate({ notes })}
                disabled={updateVisitMutation.isPending || !notes.trim()}
              >
                <Save size={15} /> Save update
              </button>
            </div>
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
      {/* TAB 1: ONBOARDING SECTION */}
      {/* ========================================================================= */}
      {activeTab === 'onboarding' && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Newly Created Credentials Modal / Banner */}
          {credentials && (
            <section
              className="panel"
              style={{
                borderColor: 'var(--green)',
                borderWidth: '2px',
                background: 'var(--surface)',
                boxShadow: '0 8px 24px rgba(8, 122, 75, 0.12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--green-soft)',
                      color: 'var(--green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text)' }}>
                      Merchant Onboarded Successfully!
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                      Account created for <strong>{credentials.name}</strong>. Share login credentials below.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCredentials(null)}
                  className="icon-button"
                  title="Dismiss banner"
                  style={{ color: 'var(--muted)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Credentials summary box */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  background: 'var(--surface-alt)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <small style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    Merchant Code
                  </small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
                      {credentials.merchantCode}
                    </strong>
                    <button
                      className="icon-button"
                      title="Copy code"
                      onClick={() => copyToClipboard(credentials.merchantCode, 'code')}
                    >
                      {copiedKey === 'code' ? <Check size={14} color="green" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <small style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    Login Email
                  </small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{credentials.loginEmail}</span>
                    <button
                      className="icon-button"
                      title="Copy email"
                      onClick={() => copyToClipboard(credentials.loginEmail, 'email')}
                    >
                      {copiedKey === 'email' ? <Check size={14} color="green" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <small style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    Temporary Password
                  </small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <code
                      style={{
                        fontSize: '13px',
                        background: 'var(--surface)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {credentials.temporaryPassword}
                    </code>
                    <button
                      className="icon-button"
                      title="Copy password"
                      onClick={() => copyToClipboard(credentials.temporaryPassword, 'pwd')}
                    >
                      {copiedKey === 'pwd' ? <Check size={14} color="green" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <small style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    WhatsApp Notification
                  </small>
                  <div style={{ marginTop: '4px' }}>
                    {credentials.whatsapp.sent ? (
                      <span className="tag success">Sent via WhatsApp</span>
                    ) : (
                      <span className="tag amber">Pending / Manual Share</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={getWhatsAppShareUrl(
                    credentials.phone,
                    credentials.merchantCode,
                    credentials.name,
                    credentials.loginEmail,
                    credentials.temporaryPassword
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button primary"
                  style={{ background: '#25D366', borderColor: '#25D366', color: '#ffffff' }}
                >
                  <MessageCircle size={16} /> Send via WhatsApp
                </a>

                <button
                  className="button secondary"
                  onClick={() => {
                    const text = `AE Merchant Account:\nStore: ${credentials.name}\nCode: ${credentials.merchantCode}\nEmail: ${credentials.loginEmail}\nPassword: ${credentials.temporaryPassword}\nLogin: ${window.location.origin}/login`;
                    copyToClipboard(text, 'all');
                  }}
                >
                  {copiedKey === 'all' ? <Check size={16} color="green" /> : <Copy size={16} />}
                  {copiedKey === 'all' ? 'Copied all details!' : 'Copy credentials'}
                </button>

                <button className="button secondary" onClick={() => setCredentials(null)}>
                  <Plus size={16} /> Onboard another merchant
                </button>
              </div>
            </section>
          )}

          {/* Main Onboarding Form */}
          <section className="panel" style={{ background: 'var(--surface)' }}>
            <div className="panel-heading">
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={20} color="var(--primary)" /> Onboard New Merchant Store
                </h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
                  Capture store details, photos, business category, pin GPS coordinates, and set up instant login access.
                </p>
              </div>
              <Sparkles size={20} color="var(--primary)" />
            </div>

            <form onSubmit={handleOnboardSubmit} style={{ marginTop: '16px' }}>
              <div
                className="form-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* Store Name */}
                <label>
                  <span>Store / Business Name *</span>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Grand Mart Supermarket"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                  />
                </label>

                {/* Business Category */}
                <label>
                  <span>Business Category</span>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select category (optional)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Phone Number */}
                <label>
                  <span>WhatsApp / Contact Number *</span>
                  <div style={{ display: 'flex' }}>
                    <span
                      style={{
                        padding: '9px 12px',
                        background: 'var(--surface-alt)',
                        border: '1px solid var(--border)',
                        borderRight: 'none',
                        borderRadius: '6px 0 0 6px',
                        fontSize: '13px',
                        color: 'var(--muted)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      +91
                    </span>
                    <input
                      required
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      pattern="[0-9]{10}"
                      style={{ borderRadius: '0 6px 6px 0' }}
                    />
                  </div>
                </label>

                {/* Login Email */}
                <label>
                  <span>Merchant Login Email *</span>
                  <input
                    required
                    type="email"
                    placeholder="e.g. store@ae-rewards.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  />
                </label>

                {/* Password with generator */}
                <label style={{ gridColumn: 'span 1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Initial Password *</span>
                    <button
                      type="button"
                      onClick={() => setPassword(generateStrongPassword())}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0,
                      }}
                    >
                      <RefreshCw size={12} /> Regenerate
                    </button>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={10}
                      style={{ borderRadius: '6px 0 0 6px' }}
                    />
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        borderRadius: '0 6px 6px 0',
                        borderLeft: 'none',
                        padding: '0 12px',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                    Must have 10+ characters with uppercase, lowercase, numbers & symbols.
                  </small>
                </label>

                {/* Store Address */}
                <label style={{ gridColumn: 'span 1' }}>
                  <span>Store Street Address / Landmark</span>
                  <input
                    type="text"
                    placeholder="e.g. Shop 4, Market Junction, MG Road"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={300}
                  />
                </label>
              </div>

              {/* ============================================================= */}
              {/* SHOP IMAGES / PHOTOS SECTION */}
              {/* ============================================================= */}
              <div
                style={{
                  marginTop: '18px',
                  padding: '16px',
                  background: 'var(--surface-alt)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon size={16} color="var(--primary)" /> Storefront & Signboard Images
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Capture or upload photos of the shop exterior, signboard, and entrance.
                    </span>
                  </div>

                  {/* Hidden inputs for Camera and Gallery */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleImageFileChange}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImageFileChange}
                  />

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="button primary"
                      disabled={isUploadingImage}
                      onClick={() => cameraInputRef.current?.click()}
                      style={{ padding: '7px 12px', fontSize: '12px' }}
                    >
                      <Camera size={14} />
                      Take Photo
                    </button>

                    <button
                      type="button"
                      className="button secondary"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '7px 12px', fontSize: '12px' }}
                    >
                      <Upload size={14} />
                      Choose from Gallery
                    </button>
                  </div>
                </div>

                {isUploadingImage && (
                  <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500, margin: '6px 0' }}>
                    Uploading shop image to storage…
                  </p>
                )}

                {uploadError && (
                  <p style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500, margin: '6px 0' }}>
                    {uploadError}
                  </p>
                )}

                {/* Image Thumbnails Grid */}
                {shopImages.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginTop: '10px',
                    }}
                  >
                    {shopImages.map((img, idx) => (
                      <div
                        key={img.id}
                        style={{
                          position: 'relative',
                          width: '100px',
                          height: '100px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '2px solid var(--border)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                          background: 'var(--surface)',
                        }}
                      >
                        <img
                          src={img.url}
                          alt={`Shop image ${idx + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            cursor: 'pointer',
                          }}
                          onClick={() => setPreviewImageUrl(img.url)}
                          title="Click to view full image"
                        />
                        {idx === 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              background: 'rgba(81, 69, 215, 0.85)',
                              color: '#fff',
                              fontSize: '9px',
                              fontWeight: 600,
                              textAlign: 'center',
                              padding: '2px 0',
                            }}
                          >
                            Signboard
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeShopImage(img.id)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.65)',
                            color: '#fff',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="Remove image"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border)',
                      borderRadius: '6px',
                      padding: '16px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: 'var(--surface)',
                      marginTop: '6px',
                    }}
                  >
                    No images attached. Tap <strong>Take Photo</strong> or <strong>Choose from Gallery</strong> to add shop pictures.
                  </div>
                )}
              </div>

              {/* Store GPS Coordinates Section */}
              <div
                style={{
                  marginTop: '18px',
                  padding: '16px',
                  background: 'var(--surface-alt)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: '10px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPinned size={16} color="var(--primary)" /> Store GPS Location
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Capture the exact storefront location while standing at the shop.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={captureGps}
                      disabled={isCapturingGps}
                      className="button primary"
                      style={{ padding: '7px 12px', fontSize: '12px' }}
                    >
                      <MapPin size={14} />
                      {isCapturingGps ? 'Acquiring GPS…' : 'Capture Live Store Location'}
                    </button>

                    {(latitude || longitude) && (
                      <button
                        type="button"
                        onClick={() => {
                          setLatitude('');
                          setLongitude('');
                          setGpsStatus('');
                        }}
                        className="button secondary"
                        style={{ padding: '7px 10px', fontSize: '12px' }}
                      >
                        Clear GPS
                      </button>
                    )}
                  </div>
                </div>

                {gpsStatus && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: gpsStatus.includes('error') ? 'var(--danger)' : 'var(--green)',
                      fontWeight: 500,
                      margin: '4px 0 10px 0',
                    }}
                  >
                    {gpsStatus}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label>
                    <span style={{ fontSize: '11px' }}>Latitude</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 10.023456"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                  </label>
                  <label>
                    <span style={{ fontSize: '11px' }}>Longitude</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 76.312345"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {formError && (
                <div
                  role="alert"
                  style={{
                    background: 'var(--danger-soft)',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger)',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginTop: '16px',
                  }}
                >
                  {formError}
                </div>
              )}

              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="button primary"
                  disabled={createMerchantMutation.isPending || isUploadingImage}
                  style={{ minWidth: '180px', padding: '10px 20px', fontSize: '14px' }}
                >
                  <UserPlus size={16} />
                  {createMerchantMutation.isPending ? 'Onboarding Store…' : 'Complete Onboarding'}
                </button>
              </div>
            </form>
          </section>

          {/* Recently Onboarded Stores Preview */}
          <section className="panel" style={{ background: 'var(--surface)' }}>
            <div className="panel-heading">
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Store size={18} /> Recently Onboarded Merchants
                </h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                  Stores registered in the network. Click to share login or call.
                </p>
              </div>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Store Name</th>
                    <th>Category</th>
                    <th>Contact & Login</th>
                    <th>Address & GPS</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allMerchants.slice(0, 10).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {m.image_url ? (
                            <img
                              src={m.image_url}
                              alt={m.name}
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '6px',
                                objectFit: 'cover',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                              }}
                              onClick={() => setPreviewImageUrl(m.image_url!)}
                              title="Click to view shop photo"
                            />
                          ) : (
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '6px',
                                background: 'var(--surface-alt)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--muted)',
                              }}
                            >
                              <Store size={20} />
                            </div>
                          )}
                          <div>
                            <strong>{m.name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                              {m.merchant_code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="tag info">{m.merchant_categories?.name || 'General'}</span>
                      </td>
                      <td>
                        {m.phone && (
                          <div style={{ fontSize: '12px' }}>
                            <a href={`tel:${m.phone}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                              {m.phone}
                            </a>
                          </div>
                        )}
                        <small style={{ color: 'var(--muted)' }}>{m.email}</small>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}>{m.address || '—'}</div>
                        {m.latitude && m.longitude ? (
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--green)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              marginTop: '2px',
                            }}
                          >
                            <MapPin size={11} /> GPS Pinned
                          </span>
                        ) : (
                          <small style={{ color: 'var(--muted)' }}>No GPS</small>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {m.phone && (
                            <a
                              href={`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `Hello ${m.name}, regarding your AE Merchant account (${m.merchant_code}). Please let us know if you need any assistance!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="button secondary"
                              style={{ padding: '5px 8px', fontSize: '11px' }}
                              title="Message on WhatsApp"
                            >
                              <MessageCircle size={14} color="#25D366" />
                            </a>
                          )}
                          <button
                            className="button secondary"
                            style={{ padding: '5px 8px', fontSize: '11px' }}
                            title="Start Visit / Check in"
                            onClick={() => {
                              setSelectedMerchant(m);
                              checkInMutation.mutate(m);
                            }}
                            disabled={Boolean(activeVisit)}
                          >
                            <MapPin size={14} /> Visit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allMerchants.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                        No merchants onboarded yet. Use the form above to add your first merchant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALL MERCHANTS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <section className="panel" style={{ background: 'var(--surface)' }}>
          <div className="panel-heading">
            <div>
              <h2>Merchant Directory</h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                Complete list of merchants registered in the system ({filteredMerchants.length} matching)
              </p>
            </div>
          </div>

          {/* Search and Category Filter Toolbar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search store name, code, phone, address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>

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

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Merchant Store</th>
                  <th>Category</th>
                  <th>Phone & WhatsApp</th>
                  <th>Store Address</th>
                  <th>Location</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMerchants.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {m.image_url ? (
                          <img
                            src={m.image_url}
                            alt={m.name}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                            }}
                            onClick={() => setPreviewImageUrl(m.image_url!)}
                            title="Click to view shop photo"
                          />
                        ) : (
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '6px',
                              background: 'var(--surface-alt)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--muted)',
                            }}
                          >
                            <Store size={18} />
                          </div>
                        )}
                        <div>
                          <strong>{m.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                            {m.merchant_code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="tag info">{m.merchant_categories?.name || 'General'}</span>
                    </td>
                    <td>
                      {m.phone ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{m.phone}</span>
                          <a
                            href={`https://wa.me/${m.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#25D366' }}
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </a>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{m.address || 'No address saved'}</td>
                    <td>
                      {m.latitude && m.longitude ? (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--green)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <MapPin size={12} /> {Number(m.latitude).toFixed(4)}, {Number(m.longitude).toFixed(4)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>No GPS</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="button primary"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        disabled={Boolean(activeVisit) || checkInMutation.isPending}
                        onClick={() => {
                          setSelectedMerchant(m);
                          checkInMutation.mutate(m);
                        }}
                      >
                        <MapPin size={13} /> Check in
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredMerchants.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                      No merchants found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VISITS & CHECK-IN */}
      {/* ========================================================================= */}
      {activeTab === 'visits' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Nearby Merchants Radius Table */}
          <section className="panel" style={{ background: 'var(--surface)' }}>
            <div className="panel-heading">
              <div>
                <h2>Nearby Merchants for Store Verification</h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                  GPS distance calculated from your phone. Check in is enabled when nearby.
                </p>
              </div>
              <MapPin color="var(--primary)" />
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
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.merchant_code}</div>
                      </td>
                      <td>{m.address || 'No address saved'}</td>
                      <td>
                        {m.distance == null ? (
                          <span style={{ color: 'var(--muted)' }}>Location unavailable</span>
                        ) : (
                          <strong style={{ color: m.distance <= 150 ? 'var(--green)' : 'var(--text)' }}>
                            {Math.round(m.distance)} m
                          </strong>
                        )}
                      </td>
                      <td>
                        <button
                          className="button primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          disabled={Boolean(activeVisit) || checkInMutation.isPending || m.distance == null}
                          onClick={() => {
                            setSelectedMerchant(m);
                            checkInMutation.mutate(m);
                          }}
                        >
                          <MapPin size={14} /> Check in
                        </button>
                      </td>
                    </tr>
                  ))}
                  {nearbyMerchants.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                        No merchants found nearby.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Completed Visits Log */}
          <section className="panel" style={{ background: 'var(--surface)' }}>
            <div className="panel-heading">
              <div>
                <h2>Completed Field Visits</h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                  History of your physical store check-ins and completed visits.
                </p>
              </div>
              <XCircle color="var(--muted)" />
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Store Name</th>
                    <th>Status</th>
                    <th>Check-in Time</th>
                    <th>GPS Proximity</th>
                  </tr>
                </thead>
                <tbody>
                  {visitsQuery.data?.visits.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.merchants?.name || v.merchant_id}</strong>
                        {v.merchants?.merchant_code && (
                          <small style={{ display: 'block', color: 'var(--muted)' }}>
                            {v.merchants.merchant_code}
                          </small>
                        )}
                      </td>
                      <td>
                        <span className={`tag ${v.status === 'completed' ? 'success' : 'info'}`}>
                          {v.status}
                        </span>
                      </td>
                      <td>{new Date(v.check_in_at).toLocaleString()}</td>
                      <td>{v.distance_m ? `${Math.round(v.distance_m)}m` : '—'}</td>
                    </tr>
                  ))}
                  {(!visitsQuery.data?.visits || visitsQuery.data.visits.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                        No store visits recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

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
