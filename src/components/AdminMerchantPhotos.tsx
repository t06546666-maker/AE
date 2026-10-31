import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Star, Trash2, ExternalLink, Plus, Link as LinkIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { useToast } from '../toast';
import './admin-merchant-photos.css';

interface AdminMerchantPhotosProps {
  merchantId: string;
  merchant: {
    id?: string;
    name?: string;
    image_url?: string | null;
    images?: string[] | null;
    [key: string]: any;
  };
  onUpdated?: () => void;
}

export function AdminMerchantPhotos({ merchantId, merchant, onUpdated }: AdminMerchantPhotosProps) {
  const client = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState<string | null>(null);
  const [showUrlBox, setShowUrlBox] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlSetAsFront, setUrlSetAsFront] = useState(false);

  // Extract unique valid photos list
  const photos = Array.from(
    new Set(
      [merchant.image_url, ...(merchant.images || [])].filter(
        (val): val is string => typeof val === 'string' && val.trim().length > 0
      )
    )
  );

  const currentFrontPhoto = merchant.image_url || photos[0] || null;

  async function refreshData() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin-merchant-details', merchantId] }),
      client.invalidateQueries({ queryKey: ['merchants'] }),
      client.invalidateQueries({ queryKey: ['customer-merchants'] }),
      client.invalidateQueries({ queryKey: ['merchant-profile', merchantId] }),
    ]);
    if (onUpdated) onUpdated();
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        showToast(uiText('Only image files (JPG, PNG, WebP) are supported.'), 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(uiText('Image must be under 10 MB.'), 'error');
        return;
      }
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('photo', files[i]);
      }
      // If there are no photos yet, mark this new photo as Front photo
      if (!currentFrontPhoto) {
        formData.append('setAsFront', 'true');
      }

      const res = await apiFetch<{
        success: boolean;
        uploaded: string[];
        image_url: string;
        images: string[];
      }>(`/api/admin/merchants/${encodeURIComponent(merchantId)}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        await refreshData();
        showToast(
          res.uploaded.length > 1
            ? uiText(`${res.uploaded.length} shop photos uploaded successfully.`)
            : uiText('Shop photo uploaded successfully.')
        );
      }
    } catch (err: any) {
      showToast(err.message || uiText('Failed to upload photo'), 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsUploading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        image_url: string;
        images: string[];
      }>(`/api/admin/merchants/${encodeURIComponent(merchantId)}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          setAsFront: urlSetAsFront || !currentFrontPhoto,
        }),
      });

      if (res.success) {
        setUrlInput('');
        setShowUrlBox(false);
        await refreshData();
        showToast(uiText('Photo added successfully.'));
      }
    } catch (err: any) {
      showToast(err.message || uiText('Failed to add photo URL'), 'error');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSetAsFront(photoUrl: string) {
    setBusyPhoto(photoUrl);
    try {
      const res = await apiFetch<{
        success: boolean;
        image_url: string;
        images: string[];
      }>(`/api/admin/merchants/${encodeURIComponent(merchantId)}/photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_front',
          imageUrl: photoUrl,
        }),
      });

      if (res.success) {
        await refreshData();
        showToast(uiText('Set as Front Photo. Customers will see this photo first on Explore cards.'));
      }
    } catch (err: any) {
      showToast(err.message || uiText('Failed to set front photo'), 'error');
    } finally {
      setBusyPhoto(null);
    }
  }

  async function handleDelete(photoUrl: string) {
    if (!window.confirm(uiText('Are you sure you want to remove this photo from the shop gallery?'))) {
      return;
    }

    setBusyPhoto(photoUrl);
    try {
      const res = await apiFetch<{
        success: boolean;
        image_url: string;
        images: string[];
      }>(`/api/admin/merchants/${encodeURIComponent(merchantId)}/photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          imageUrl: photoUrl,
        }),
      });

      if (res.success) {
        await refreshData();
        showToast(uiText('Photo removed.'));
      }
    } catch (err: any) {
      showToast(err.message || uiText('Failed to delete photo'), 'error');
    } finally {
      setBusyPhoto(null);
    }
  }

  return (
    <section className="admin-photos-panel">
      <div className="admin-photos-header">
        <div>
          <h2>
            <Camera size={22} color="#2563eb" />
            {uiText('Shop Photos & Front Display')}
            {photos.length > 0 && (
              <span className="admin-photos-badge-count">
                {photos.length} {photos.length === 1 ? uiText('photo') : uiText('photos')}
              </span>
            )}
          </h2>
          <p>
            {uiText(
              'Manage the merchant shop pictures. Pick which photo displays on the Front card when customers open Explore, upload high quality pictures, or remove old ones.'
            )}
          </p>
        </div>

        <div className="admin-photos-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => void handleFileUpload(e.target.files)}
            accept="image/jpeg,image/png,image/webp"
            multiple
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="button primary"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {uiText('Uploading…')}
              </>
            ) : (
              <>
                <Plus size={16} />
                {uiText('Upload Shop Photo')}
              </>
            )}
          </button>

          <button
            type="button"
            className="button secondary"
            disabled={isUploading}
            onClick={() => setShowUrlBox(!showUrlBox)}
          >
            <LinkIcon size={16} />
            {showUrlBox ? uiText('Close URL Box') : uiText('Add via URL')}
          </button>
        </div>
      </div>

      {showUrlBox && (
        <form className="admin-photos-url-box" onSubmit={(e) => void handleAddUrl(e)}>
          <div className="admin-photos-url-row">
            <input
              type="url"
              className="admin-photos-url-input"
              placeholder={uiText('Paste direct image URL (https://...)')}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              required
            />
            <button type="submit" className="button primary" disabled={isUploading || !urlInput.trim()}>
              {isUploading ? uiText('Adding…') : uiText('Add Photo')}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={urlSetAsFront}
              onChange={(e) => setUrlSetAsFront(e.target.checked)}
            />
            <span>{uiText('Set as Front / Cover Photo immediately')}</span>
          </label>
        </form>
      )}

      {photos.length === 0 ? (
        <div className="admin-photos-empty">
          <div className="admin-photos-empty-icon">
            <Camera size={26} />
          </div>
          <h3>{uiText('No shop photos uploaded yet')}</h3>
          <p>
            {uiText(
              'Add the merchant’s storefront or interior photos so customers can recognise the shop on Explore.'
            )}
          </p>
          <button
            type="button"
            className="button primary"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={16} />
            {uiText('Upload First Photo')}
          </button>
        </div>
      ) : (
        <div className="admin-photos-grid">
          {photos.map((photo, index) => {
            const isFront = photo === currentFrontPhoto;
            const isBusy = busyPhoto === photo;

            return (
              <div key={photo} className={`admin-photo-card ${isFront ? 'is-front' : ''}`}>
                <div className="admin-photo-image-wrap">
                  <img src={photo} alt={merchant.name || 'Shop photo'} className="admin-photo-image" loading="lazy" />
                  {isFront && (
                    <div className="admin-photo-front-badge">
                      <Star size={13} fill="#ffffff" color="#ffffff" />
                      <span>{uiText('Front Photo')}</span>
                    </div>
                  )}
                </div>

                <div className="admin-photo-body">
                  {isFront ? (
                    <div>
                      <div className="admin-photo-status-tag">
                        <CheckCircle2 size={15} />
                        <span>{uiText('Front Cover Display')}</span>
                      </div>
                      <p className="admin-photo-subtext">
                        {uiText('Customers see this image first on Explore cards.')}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        {uiText(`Gallery Photo #${index + 1}`)}
                      </span>
                      <p className="admin-photo-subtext">
                        {uiText('Visible in shop detail photo gallery.')}
                      </p>
                    </div>
                  )}

                  <div className="admin-photo-actions">
                    {!isFront && (
                      <button
                        type="button"
                        className="button primary"
                        disabled={isBusy || isUploading}
                        onClick={() => void handleSetAsFront(photo)}
                        title={uiText('Display this photo on the front Explore card')}
                      >
                        {isBusy ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Star size={13} />
                        )}
                        {uiText('Set as Front')}
                      </button>
                    )}

                    <a
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button secondary"
                      title={uiText('View full resolution in new tab')}
                    >
                      <ExternalLink size={13} />
                      {uiText('View')}
                    </a>

                    <button
                      type="button"
                      className="button secondary admin-photo-delete-btn"
                      disabled={isBusy || isUploading}
                      onClick={() => void handleDelete(photo)}
                      title={uiText('Delete photo from shop')}
                    >
                      {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      {uiText('Delete')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
