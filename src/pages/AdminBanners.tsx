import { useState, useRef, type FormEvent, type ChangeEvent, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ImagePlus,
  Plus,
  Trash2,
  Edit2,
  Store,
  Tag,
  Upload,
  X,
  Search,
  Eye,
  Check,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '../api';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/Common';
import { useToast } from '../toast';
import { uiText } from '../uiText';
import type { UserProfile, Offer } from '../types';

interface AdBannerItem {
  id: string;
  offerId?: string;
  merchantId?: string;
  merchantName?: string;
  merchantPhone?: string;
  merchantAddress?: string;
  title: string;
  subtitle?: string;
  category?: string;
  expiresAt?: string;
  imageUrl: string;
  bannerImageUrl?: string;
  offerImageUrl?: string;
  imagePath?: string;
  active: boolean;
  createdAt: string;
}

export function AdminBanners({ user }: { user?: UserProfile }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdBannerItem | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<AdBannerItem | null>(null);

  // Form states (minimal, focused purely on Merchant + Offer + Optional Image)
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [bannerImagePreview, setBannerImagePreview] = useState('');
  const [active, setActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch current ad banners
  const { data: bannersData, isLoading: bannersLoading, error: bannersError, refetch } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => apiFetch<{ banners: AdBannerItem[] }>('/api/admin/banners'),
  });

  // 2. Fetch approved offers to choose from
  const { data: offersData } = useQuery({
    queryKey: ['admin-approved-offers'],
    queryFn: () => apiFetch<{ offers: Offer[] }>('/api/offers?status=approved&pageSize=100'),
    staleTime: 60_000,
  });

  // 3. Fetch merchants for quick filtering
  const { data: merchantsData } = useQuery({
    queryKey: ['admin-merchants-selection'],
    queryFn: () => apiFetch<{ merchants: Array<{ id: string; name: string; merchantCode?: string }> }>('/api/merchants?pageSize=100'),
    staleTime: 5 * 60 * 1000,
  });

  const merchants = merchantsData?.merchants || [];
  const allApprovedOffers = offersData?.offers || [];
  const banners = bannersData?.banners || [];

  // Filter offers by selected merchant if one is picked
  const availableOffers = useMemo(() => {
    if (!selectedMerchantId) return allApprovedOffers;
    return allApprovedOffers.filter((o) => o.merchantId === selectedMerchantId);
  }, [allApprovedOffers, selectedMerchantId]);

  // Current selected offer object
  const selectedOffer = useMemo(() => {
    return allApprovedOffers.find((o) => o.id === selectedOfferId) || null;
  }, [allApprovedOffers, selectedOfferId]);

  // Filter existing banners by search
  const filteredBanners = useMemo(() => {
    if (!searchTerm.trim()) return banners;
    const q = searchTerm.toLowerCase();
    return banners.filter((b) =>
      b.title.toLowerCase().includes(q) ||
      (b.merchantName || '').toLowerCase().includes(q)
    );
  }, [banners, searchTerm]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingBanner(null);
    setSelectedMerchantId('');
    setSelectedOfferId('');
    setBannerTitle('');
    setBannerImageFile(null);
    setBannerImagePreview('');
    setActive(true);
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (b: AdBannerItem) => {
    setEditingBanner(b);
    setSelectedMerchantId(b.merchantId || '');
    setSelectedOfferId(b.offerId || '');
    setBannerTitle(b.title || '');
    setBannerImageFile(null);
    setBannerImagePreview(b.bannerImageUrl || b.imageUrl || '');
    setActive(Boolean(b.active));
    setModalOpen(true);
  };

  // Handle banner image file select
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerImageFile(file);
      setBannerImagePreview(URL.createObjectURL(file));
    }
  };

  // Save / Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedMerchant = merchants.find((m) => m.id === selectedMerchantId);
      const titleToUse = (bannerTitle || '').trim() || selectedOffer?.title || (selectedMerchant ? `${selectedMerchant.name} Promotion` : 'Special Promotion');

      if (!titleToUse) {
        throw new Error('Please enter a banner title or select an offer.');
      }

      if (!selectedOffer && !bannerImageFile && !editingBanner?.imageUrl && !bannerImagePreview) {
        throw new Error('Please select an offer or upload a banner photo.');
      }

      const form = new FormData();
      if (selectedOffer) {
        form.append('offerId', selectedOffer.id);
        form.append('title', titleToUse);
        form.append('subtitle', selectedOffer.description || '');
        form.append('merchantId', selectedOffer.merchantId || selectedMerchantId || '');
        form.append('merchantName', selectedOffer.merchant || selectedMerchant?.name || '');
        form.append('category', selectedOffer.category || '');
        form.append('expiresAt', selectedOffer.expiresAt || '');
        if (selectedOffer.imageUrl) {
          form.append('offerImageUrl', selectedOffer.imageUrl);
        }
      } else {
        if (selectedOfferId) form.append('offerId', selectedOfferId);
        form.append('title', titleToUse);
        if (selectedMerchantId) {
          form.append('merchantId', selectedMerchantId);
          form.append('merchantName', selectedMerchant?.name || '');
        }
      }

      form.append('active', String(active));
      form.append('placement', 'top');

      // If custom banner file selected, attach it
      if (bannerImageFile) {
        form.append('image', bannerImageFile);
      } else if (editingBanner?.imageUrl) {
        form.append('imageUrl', editingBanner.imageUrl);
      }

      if (editingBanner) {
        return apiFetch<{ success: boolean; banner: AdBannerItem }>(`/api/admin/banners/${editingBanner.id}`, {
          method: 'PUT',
          body: form,
        });
      } else {
        return apiFetch<{ success: boolean; banner: AdBannerItem }>('/api/admin/banners', {
          method: 'POST',
          body: form,
        });
      }
    },
    onSuccess: () => {
      showToast(editingBanner ? 'Ad Banner updated' : 'Ad Banner created successfully');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', 'ads'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to save banner', 'error');
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiFetch<{ success: boolean; banner: AdBannerItem }>(`/api/admin/banners/${bannerId}/toggle-active`, {
        method: 'PATCH',
      });
    },
    onSuccess: (res) => {
      showToast(res.banner.active ? 'Banner is now Active' : 'Banner Paused');
      void queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', 'ads'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update status', 'error');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiFetch<{ success: boolean }>(`/api/admin/banners/${bannerId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      showToast('Banner deleted successfully');
      setDeletingBanner(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', 'ads'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete banner', 'error');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOffer && !bannerTitle.trim() && !selectedMerchantId) {
      showToast('Please select an offer or enter a banner title', 'error');
      return;
    }
    if (!selectedOffer && !bannerImageFile && !editingBanner?.imageUrl && !bannerImagePreview) {
      showToast('Please select an offer with a photo or upload a banner image', 'error');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="admin-banners-page" style={{ paddingBottom: '60px' }}>
      <PageHeader
        title={uiText("Ad Banners")}
        subtitle={uiText("Select approved merchant offers and set optional wide banner photos for the customer app home screen.")}
        actions={
          <button
            className="button primary"
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>{uiText("Add Ad Banner")}</span>
          </button>
        }
      />

      {/* Search and Summary Bar */}
      <div
        className="panel"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          padding: '12px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
            {uiText("Active Home Banners")} ({banners.filter((b) => b.active).length} / {banners.length})
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder={uiText("Search banners…")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              paddingLeft: '32px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              width: '200px',
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      {bannersLoading ? (
        <LoadingState label="Loading ad banners…" />
      ) : bannersError ? (
        <ErrorState error={bannersError as Error} retry={() => void refetch()} />
      ) : filteredBanners.length === 0 ? (
        <EmptyState>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#64748b',
              }}
            >
              <ImagePlus size={28} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>{uiText("No Ad Banners")}</h3>
            <p style={{ color: '#64748b', fontSize: '13px', maxWidth: '380px', margin: '0 auto 18px' }}>
              {searchTerm
                ? uiText("No banners matching your search.")
                : uiText("Choose a merchant and an approved offer to show in the customer app's top carousel.")}
            </p>
            <button className="button primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>{uiText("Add First Ad Banner")}</span>
            </button>
          </div>
        </EmptyState>
      ) : (
        <div
          className="admin-banners-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredBanners.map((banner) => (
            <div
              key={banner.id}
              className="panel banner-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: 0,
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                background: '#ffffff',
              }}
            >
              {/* Banner Image Preview */}
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '21/9',
                  width: '100%',
                  backgroundColor: '#0f172a',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />

                {/* Status Toggle Badge */}
                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate(banner.id)}
                    title={banner.active ? uiText("Click to pause") : uiText("Click to activate")}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: banner.active ? '#dcfce7' : '#fee2e2',
                      color: banner.active ? '#15803d' : '#b91c1c',
                      border: `1px solid ${banner.active ? '#86efac' : '#fca5a5'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: banner.active ? '#16a34a' : '#dc2626',
                      }}
                    />
                    <span>{banner.active ? uiText("Active") : uiText("Paused")}</span>
                  </button>
                </div>
              </div>

              {/* Banner Info */}
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Store size={14} style={{ color: '#087a4b', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#087a4b' }}>
                      {banner.merchantName || uiText("Store")}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                    {banner.title}
                  </h3>
                  {banner.subtitle && (
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {banner.subtitle}
                    </p>
                  )}
                </div>

                {/* Footer Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '12px',
                    marginTop: 'auto',
                  }}
                >
                  <a
                    href={banner.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button secondary"
                    style={{ padding: '5px 10px', fontSize: '12px', gap: '4px' }}
                  >
                    <Eye size={13} />
                    <span>{uiText("Preview")}</span>
                  </a>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => handleOpenEdit(banner)}
                      style={{ padding: '5px 10px', fontSize: '12px', gap: '4px' }}
                    >
                      <Edit2 size={13} />
                      <span>{uiText("Edit")}</span>
                    </button>

                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDeletingBanner(banner)}
                      style={{ padding: '5px 8px', fontSize: '12px', color: '#dc2626' }}
                      title={uiText("Delete banner")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simplified Add / Edit Banner Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="modal"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {editingBanner ? uiText("Edit Ad Banner") : uiText("Add Ad Banner")}
                </h2>
                <p style={{ fontSize: '12px', color: '#64748b' }}>
                  {uiText("Select a merchant and offer. All details are linked automatically.")}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModalOpen(false)}
                title={uiText("Close")}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Step 1: Select Merchant */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  1. {uiText("Select Merchant")}
                </label>
                <select
                  value={selectedMerchantId}
                  onChange={(e) => {
                    const mid = e.target.value;
                    setSelectedMerchantId(mid);
                    setSelectedOfferId(''); // reset offer when merchant changes
                    if (!bannerTitle) {
                      const m = merchants.find(item => item.id === mid);
                      if (m) setBannerTitle(`${m.name} Promotion`);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">{uiText("-- All Merchants (or pick a merchant) --")}</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.merchantCode ? `(${m.merchantCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Which Offer */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    2. {uiText("Which Offer to Give / Promote")}
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {uiText("(Optional: link to an existing offer)")}
                  </span>
                </div>
                <select
                  value={selectedOfferId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedOfferId(id);
                    const found = allApprovedOffers.find((o) => o.id === id);
                    if (found) {
                      if (!selectedMerchantId && found.merchantId) {
                        setSelectedMerchantId(found.merchantId);
                      }
                      setBannerTitle(found.title);
                      if (!bannerImageFile && !editingBanner) {
                        setBannerImagePreview(found.bannerImageUrl || found.imageUrl || '');
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">{uiText("-- Choose an approved offer (or leave empty) --")}</option>
                  {availableOffers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} — ({o.merchant || 'Merchant'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Banner Title */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  3. {uiText("Banner Title")}
                </label>
                <input
                  type="text"
                  placeholder={selectedOffer?.title || uiText("e.g. Special Festive Deal")}
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>

              {/* Selected Offer Preview Card */}
              {selectedOffer && (
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    alignItems: 'center',
                  }}
                >
                  {selectedOffer.imageUrl ? (
                    <img
                      src={selectedOffer.imageUrl}
                      alt={selectedOffer.title}
                      style={{
                        width: '54px',
                        height: '54px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '8px',
                        backgroundColor: '#e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        flexShrink: 0,
                      }}
                    >
                      <Tag size={20} />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#087a4b', textTransform: 'uppercase' }}>
                      {selectedOffer.merchant || 'Store'}
                    </p>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedOffer.title}
                    </h4>
                    {selectedOffer.description && (
                      <p style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedOffer.description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Dedicated Ad Banner Photo (Optional) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    3. {uiText("Banner Image (Optional)")}
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {uiText("Wide 16:9 or 21:9 photo")}
                  </span>
                </div>

                {bannerImagePreview ? (
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <img
                      src={bannerImagePreview}
                      alt="Banner Preview"
                      style={{ width: '100%', aspectRatio: '21/9', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Upload size={12} />
                      <span>{uiText("Change Photo")}</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '12px',
                      padding: '24px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#f8fafc',
                    }}
                  >
                    <Upload size={24} style={{ color: '#087a4b', margin: '0 auto 6px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>
                      {uiText("Click to choose a dedicated wide banner photo")}
                    </p>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>
                      {uiText("(Optional: If left empty, the offer's poster will be used automatically)")}
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Active Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#087a4b' }}
                />
                <span>{uiText("Show immediately on customer home carousel")}</span>
              </label>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  {uiText("Cancel")}
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={saveMutation.isPending || (!selectedOfferId && !bannerTitle.trim() && !selectedMerchantId && !bannerImageFile && !bannerImagePreview)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {saveMutation.isPending ? uiText("Saving…") : editingBanner ? uiText("Update Banner") : uiText("Save Banner")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBanner && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setDeletingBanner(null)}
        >
          <div
            className="modal"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              maxWidth: '400px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Trash2 size={22} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                {uiText("Remove Ad Banner?")}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                {uiText("Remove banner for")} <strong>"{deletingBanner.title}"</strong>? {uiText("The offer itself will remain active in the Offers section.")}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setDeletingBanner(null)}
                disabled={deleteMutation.isPending}
              >
                {uiText("Cancel")}
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => deleteMutation.mutate(deletingBanner.id)}
                disabled={deleteMutation.isPending}
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
              >
                {deleteMutation.isPending ? uiText("Deleting…") : uiText("Remove Banner")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
