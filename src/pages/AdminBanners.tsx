import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ImagePlus,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Eye,
  ExternalLink,
  Store,
  Tag,
  Compass,
  ArrowUpDown,
  Sparkles,
  Power,
  X,
  Upload,
  Layers,
  Search,
} from 'lucide-react';
import { apiFetch } from '../api';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/Common';
import { useToast } from '../toast';
import { uiText } from '../uiText';
import type { AdBanner, BannerPlacement, BannerLinkType, UserProfile } from '../types';

export function AdminBanners({ user }: { user?: UserProfile }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [placementFilter, setPlacementFilter] = useState<'all' | BannerPlacement>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [search, setSearch] = useState('');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdBanner | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<AdBanner | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [placement, setPlacement] = useState<BannerPlacement>('top');
  const [linkType, setLinkType] = useState<BannerLinkType>('explore');
  const [linkValue, setLinkValue] = useState('');
  const [active, setActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');

  // Fetch banners
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => apiFetch<{ banners: AdBanner[] }>('/api/admin/banners'),
  });

  // Fetch merchants for quick linking
  const { data: merchantsData } = useQuery({
    queryKey: ['admin-merchants-quick'],
    queryFn: () => apiFetch<{ merchants: Array<{ id: string; name: string; merchantCode?: string }> }>('/api/merchants?pageSize=100'),
    staleTime: 5 * 60 * 1000,
  });

  const merchants = merchantsData?.merchants || [];
  const banners = data?.banners || [];

  // Filtered banners
  const filteredBanners = banners.filter((b) => {
    if (placementFilter !== 'all' && (b.placement || 'top') !== placementFilter) return false;
    if (statusFilter === 'active' && !b.active) return false;
    if (statusFilter === 'paused' && b.active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = b.title.toLowerCase().includes(q);
      const matchSubtitle = (b.subtitle || '').toLowerCase().includes(q);
      if (!matchTitle && !matchSubtitle) return false;
    }
    return true;
  });

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingBanner(null);
    setTitle('');
    setSubtitle('');
    setPlacement('top');
    setLinkType('explore');
    setLinkValue('');
    setActive(true);
    setDisplayOrder(0);
    setImageFile(null);
    setImagePreviewUrl('');
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (b: AdBanner) => {
    setEditingBanner(b);
    setTitle(b.title);
    setSubtitle(b.subtitle || '');
    setPlacement(b.placement || 'top');
    setLinkType(b.linkType || 'explore');
    setLinkValue(b.linkValue || '');
    setActive(Boolean(b.active));
    setDisplayOrder(Number(b.displayOrder || 0));
    setImageFile(null);
    setImagePreviewUrl(b.imageUrl || '');
    setModalOpen(true);
  };

  // Image file select
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreviewUrl(objectUrl);
    }
  };

  // Create or Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('subtitle', subtitle.trim());
      form.append('placement', placement);
      form.append('linkType', linkType);
      form.append('linkValue', linkValue.trim());
      form.append('active', String(active));
      form.append('displayOrder', String(displayOrder));

      if (imageFile) {
        form.append('image', imageFile);
      } else if (editingBanner?.imageUrl) {
        form.append('imageUrl', editingBanner.imageUrl);
      }

      if (editingBanner) {
        return apiFetch<{ success: boolean; banner: AdBanner }>(`/api/admin/banners/${editingBanner.id}`, {
          method: 'PUT',
          body: form,
        });
      } else {
        return apiFetch<{ success: boolean; banner: AdBanner }>('/api/admin/banners', {
          method: 'POST',
          body: form,
        });
      }
    },
    onSuccess: () => {
      showToast(editingBanner ? 'Banner updated successfully' : 'Banner created successfully');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', 'banners'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', 'ads'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to save banner', 'error');
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiFetch<{ success: boolean; banner: AdBanner }>(`/api/admin/banners/${bannerId}/toggle-active`, {
        method: 'PATCH',
      });
    },
    onSuccess: (res) => {
      showToast(res.banner.active ? 'Banner activated' : 'Banner paused');
      void queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', 'banners'] });
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
      void queryClient.invalidateQueries({ queryKey: ['customer', 'banners'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', 'ads'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete banner', 'error');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a banner title', 'error');
      return;
    }
    if (!editingBanner && !imageFile) {
      showToast('Please select a banner image file', 'error');
      return;
    }
    saveMutation.mutate();
  };

  const getPlacementBadge = (p: BannerPlacement) => {
    switch (p) {
      case 'top':
        return { label: 'Top Carousel', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'downside':
        return { label: 'Downside Banner', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
      case 'explore':
        return { label: 'Explore Page', bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
      default:
        return { label: p, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    }
  };

  const getLinkTypeBadge = (type: BannerLinkType, val?: string) => {
    switch (type) {
      case 'explore':
        return { icon: Compass, text: 'Explore Shops' };
      case 'merchant': {
        const found = merchants.find((m) => m.id === val);
        return { icon: Store, text: found ? `Shop: ${found.name}` : `Shop ID: ${val || 'Any'}` };
      }
      case 'offer':
        return { icon: Tag, text: `Offer: ${val || 'All Offers'}` };
      case 'external':
        return { icon: ExternalLink, text: val ? (val.length > 25 ? `${val.slice(0, 25)}…` : val) : 'External URL' };
      default:
        return { icon: Compass, text: 'Explore' };
    }
  };

  return (
    <div className="admin-banners-page" style={{ paddingBottom: '60px' }}>
      <PageHeader
        title={uiText("Ad Banners & Placements")}
        subtitle={uiText("Manage promotional banners for top carousel and downside feed sections.")}
        actions={
          <button className="button primary" onClick={handleOpenCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            <span>{uiText("Add New Banner")}</span>
          </button>
        }
      />

      {/* Filter and Stats Bar */}
      <div
        className="panel"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          padding: '14px 18px',
        }}
      >
        {/* Placement tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { id: 'all', label: 'All Banners', count: banners.length },
            { id: 'top', label: 'Top Carousel', count: banners.filter((b) => (b.placement || 'top') === 'top').length },
            { id: 'downside', label: 'Downside Banners', count: banners.filter((b) => b.placement === 'downside').length },
            { id: 'explore', label: 'Explore Page', count: banners.filter((b) => b.placement === 'explore').length },
          ].map((tab) => {
            const isSelected = placementFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPlacementFilter(tab.id as any)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  border: isSelected ? '1px solid #087a4b' : '1px solid #e2e8f0',
                  background: isSelected ? '#087a4b' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{uiText(tab.label)}</span>
                <span
                  style={{
                    background: isSelected ? 'rgba(255,255,255,0.28)' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#64748b',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status filter & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder={uiText("Search banners…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: '32px',
                paddingRight: '12px',
                paddingTop: '6px',
                paddingBottom: '6px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                width: '180px',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
            }}
          >
            <option value="all">{uiText("All Status")}</option>
            <option value="active">{uiText("Active Only")}</option>
            <option value="paused">{uiText("Paused Only")}</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <LoadingState label="Loading ad banners…" />
      ) : error ? (
        <ErrorState error={error as Error} retry={() => void refetch()} />
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
            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>{uiText("No banners found")}</h3>
            <p style={{ color: '#64748b', fontSize: '13px', maxWidth: '400px', margin: '0 auto 18px' }}>
              {search || placementFilter !== 'all' || statusFilter !== 'all'
                ? uiText("Try adjusting your filters or search term to see more banners.")
                : uiText("Create promotional banners to showcase top deals or downside campaigns for customers.")}
            </p>
            <button className="button primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>{uiText("Add First Banner")}</span>
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
          {filteredBanners.map((banner) => {
            const badge = getPlacementBadge(banner.placement);
            const linkBadge = getLinkTypeBadge(banner.linkType, banner.linkValue);
            const LinkIcon = linkBadge.icon;

            return (
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
                  transition: 'all 0.2s ease',
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
                  {/* Top badges */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      right: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {uiText(badge.label)}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate(banner.id)}
                      title={banner.active ? uiText("Click to pause") : uiText("Click to activate")}
                      style={{
                        padding: '3px 9px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: banner.active ? '#dcfce7' : '#fee2e2',
                        color: banner.active ? '#15803d' : '#b91c1c',
                        border: `1px solid ${banner.active ? '#86efac' : '#fca5a5'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
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

                {/* Banner Details */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      {banner.title}
                    </h3>
                    {banner.subtitle && (
                      <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>{banner.subtitle}</p>
                    )}
                  </div>

                  {/* Destination badge */}
                  <div style={{ marginTop: 'auto', marginBottom: '14px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#334155',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <LinkIcon size={13} style={{ flexShrink: 0, color: '#64748b' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkBadge.text}</span>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '12px',
                    }}
                  >
                    <a
                      href={banner.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button secondary"
                      style={{ padding: '6px 10px', fontSize: '12px', gap: '4px' }}
                      title={uiText("Preview full image in browser")}
                    >
                      <Eye size={13} />
                      <span>{uiText("View Image")}</span>
                    </a>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => handleOpenEdit(banner)}
                        style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
                      >
                        <Edit2 size={13} />
                        <span>{uiText("Edit")}</span>
                      </button>

                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setDeletingBanner(banner)}
                        style={{ padding: '6px 10px', fontSize: '12px', color: '#dc2626' }}
                        title={uiText("Delete banner")}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
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
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a' }}>
                  {editingBanner ? uiText("Edit Ad Banner") : uiText("Create New Ad Banner")}
                </h2>
                <p style={{ fontSize: '12px', color: '#64748b' }}>
                  {uiText("Set placement, promotional image, and target action for customers.")}
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Banner Title */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  {uiText("Banner Title *")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={uiText("e.g. Grand Chittur Shopping Festival")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              {/* Subtitle */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  {uiText("Subtitle / Campaign Tagline (Optional)")}
                </label>
                <input
                  type="text"
                  placeholder={uiText("e.g. Save flat 20% on fashion & grocery stores")}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              {/* Placement Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  {uiText("Placement Location *")}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'top', label: 'Top Carousel', desc: 'Main home header scroll' },
                    { id: 'downside', label: 'Downside Banner', desc: 'Lower feed promotions' },
                    { id: 'explore', label: 'Explore Page', desc: 'Shop discovery header' },
                  ].map((p) => {
                    const isSelected = placement === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlacement(p.id as BannerPlacement)}
                        style={{
                          padding: '12px 10px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #087a4b' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#f0fdf4' : '#f8fafc',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#15803d' : '#1e293b' }}>
                          {uiText(p.label)}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{uiText(p.desc)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Banner Image Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  {uiText("Banner Image * (Recommended ratio 16:9 or 21:9)")}
                </label>

                {imagePreviewUrl ? (
                  <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                    <img
                      src={imagePreviewUrl}
                      alt="Banner Preview"
                      style={{ width: '100%', aspectRatio: '21/9', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Upload size={13} />
                      <span>{uiText("Change Image")}</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '14px',
                      padding: '30px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#f8fafc',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <Upload size={28} style={{ color: '#087a4b', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>
                      {uiText("Click to upload banner image")}
                    </p>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>
                      {uiText("Supports JPG, PNG, WebP up to 10MB")}
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

              {/* Target Click Action */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  {uiText("When Customer Taps Banner:")}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '10px' }}>
                  {[
                    { id: 'explore', label: 'Open Nearby Shops (Explore)', icon: Compass },
                    { id: 'merchant', label: 'Go to Specific Merchant', icon: Store },
                    { id: 'offer', label: 'Open Offers Preview', icon: Tag },
                    { id: 'external', label: 'External Website / WhatsApp', icon: ExternalLink },
                  ].map((act) => {
                    const isSelected = linkType === act.id;
                    const Icon = act.icon;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setLinkType(act.id as BannerLinkType)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #087a4b' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Icon size={16} style={{ color: isSelected ? '#15803d' : '#64748b', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#15803d' : '#1e293b' }}>
                          {uiText(act.label)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Target Input */}
                {linkType === 'merchant' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      {uiText("Select Merchant or type Merchant Name/ID:")}
                    </label>
                    <select
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="">{uiText("-- Choose a merchant --")}</option>
                      {merchants.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} {m.merchantCode ? `(${m.merchantCode})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkType === 'external' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      {uiText("Destination URL or WhatsApp link (https://...):")}
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com or https://wa.me/91..."
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                )}

                {linkType === 'offer' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      {uiText("Offer ID (optional, leave blank to open customer offers):")}
                    </label>
                    <input
                      type="text"
                      placeholder={uiText("Offer ID (optional)")}
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                )}
              </div>

              {/* Status & Display Order */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#087a4b' }}
                  />
                  <span>{uiText("Active banner (visible to customers)")}</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>{uiText("Order:")}</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
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
                  disabled={saveMutation.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {saveMutation.isPending ? uiText("Saving…") : editingBanner ? uiText("Update Banner") : uiText("Create Banner")}
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
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Trash2 size={24} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                {uiText("Delete Ad Banner?")}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                {uiText("Are you sure you want to delete")} <strong>"{deletingBanner.title}"</strong>? {uiText("This action cannot be undone.")}
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
                {deleteMutation.isPending ? uiText("Deleting…") : uiText("Delete Banner")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
