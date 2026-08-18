import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Gift, ImagePlus, Pencil, Search, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Offer, OfferStatus, Pagination, UserProfile } from '../types';
import { formatDate } from '../utils';
import { useToast } from '../toast';

type OffersResponse = { offers: Offer[]; pagination: Pagination };

function tomorrowInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function Offers({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState(tomorrowInput());
  const [image, setImage] = useState<File | null>(null);
  const [rejecting, setRejecting] = useState<Offer | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => setPage(1), [deferredSearch, status]);

  const offers = useQuery({
    queryKey: ['offers', page, deferredSearch, status],
    queryFn: ({ signal }) => apiFetch<OffersResponse>(`/api/offers?${queryString({
      page,
      pageSize: 12,
      search: deferredSearch,
      status,
    })}`, { signal }),
    placeholderData: (previous) => previous,
    refetchInterval: (query) => query.state.data?.offers.some((offer) =>
      offer.campaign?.status === 'queued' || offer.campaign?.status === 'processing') ? 5000 : false,
  });

  function resetForm() {
    setFormOpen(false);
    setEditing(null);
    setTitle('');
    setDescription('');
    setExpiresAt(tomorrowInput());
    setImage(null);
  }

  function editOffer(offer: Offer) {
    setEditing(offer);
    setTitle(offer.title);
    setDescription(offer.description);
    setExpiresAt(offer.expiresAt.slice(0, 10));
    setImage(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.set('title', title.trim());
      body.set('description', description.trim());
      body.set('expiresAt', new Date(`${expiresAt}T23:59:59+05:30`).toISOString());
      if (image) body.set('image', image);
      return apiFetch(editing ? `/api/offers/${encodeURIComponent(editing.id)}` : '/api/offers', {
        method: editing ? 'PUT' : 'POST',
        body,
      });
    },
    onSuccess() {
      showToast(t(editing ? 'offers.updated' : 'offers.created'));
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const approve = useMutation({
    mutationFn: (offer: Offer) => apiFetch(`/api/offers/${encodeURIComponent(offer.id)}/approve`, { method: 'POST' }),
    onSuccess() { showToast(t('offers.approvedToast')); void queryClient.invalidateQueries({ queryKey: ['offers'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });

  const reject = useMutation({
    mutationFn: () => apiFetch(`/api/offers/${encodeURIComponent(rejecting!.id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: rejectionReason.trim() }),
    }),
    onSuccess() {
      showToast(t('offers.rejectedToast'));
      setRejecting(null);
      setRejectionReason('');
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const send = useMutation({
    mutationFn: (offer: Offer) => apiFetch(`/api/offers/${encodeURIComponent(offer.id)}/send`, { method: 'POST' }),
    onSuccess() { showToast(t('offers.queuedToast')); void queryClient.invalidateQueries({ queryKey: ['offers'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });

  const retry = useMutation({
    mutationFn: (offer: Offer) => apiFetch<{ retried: number }>(
      `/api/offers/${encodeURIComponent(offer.id)}/retry`,
      { method: 'POST' },
    ),
    onSuccess(data) {
      showToast(t('offers.retryToast', { count: data.retried }));
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <>
      <PageHeader
        title={t('offers.title')}
        subtitle={t(user.role === 'admin' ? 'offers.adminSubtitle' : 'offers.merchantSubtitle')}
        actions={user.role === 'merchant' ? (
          <button className="button primary" onClick={() => { resetForm(); setFormOpen(true); }}>
            <ImagePlus size={17} />{t('offers.create')}
          </button>
        ) : undefined}
      />

      {user.role === 'merchant' && formOpen ? (
        <form className="panel offer-form" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <h2>{t(editing ? 'offers.editResubmit' : 'offers.create')}</h2>
              <p>{t('offers.merchantSubtitle')}</p>
            </div>
            <Gift />
          </div>
          <div className="offer-form-grid">
            <label>
              {t('offers.offerTitle')}
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
            </label>
            <label>
              {t('offers.expiry')}
              <input type="date" min={tomorrowInput()} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required />
            </label>
            <label className="offer-description-field">
              {t('offers.description')}
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} required />
            </label>
            <label className="offer-image-field">
              {t('offers.image')}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} required={!editing} />
              <small>{t('offers.imageHelp')}</small>
            </label>
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={save.isPending}>
              <Send size={16} />{t(editing ? 'offers.resubmit' : 'offers.submit')}
            </button>
            <button type="button" className="button secondary" onClick={resetForm}>{t('offers.cancel')}</button>
          </div>
        </form>
      ) : null}

      <div className="list-toolbar offer-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t('offers.search')} />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t('offers.title')}</option>
          <option value="pending">{t('offers.pending')}</option>
          <option value="approved">{t('offers.approved')}</option>
          <option value="rejected">{t('offers.rejected')}</option>
        </select>
      </div>

      {offers.isPending ? <LoadingState label={t('common.loading')} /> : offers.isError ? (
        <ErrorState error={offers.error} retry={() => offers.refetch()} />
      ) : (
        <>
          <section className="offer-grid">
            {offers.data?.offers.map((offer) => {
              const expired = new Date(offer.expiresAt) <= new Date();
              return (
                <article className="offer-card" key={offer.id}>
                  <div className="offer-image-wrap">
                    <img src={offer.imageUrl} alt={offer.title} />
                    <span className={`tag offer-status ${offer.status}`}>{t(`offers.${offer.status}`)}</span>
                  </div>
                  <div className="offer-card-body">
                    {user.role === 'admin' ? <small className="offer-merchant">{offer.merchantCode} · {offer.merchant}</small> : null}
                    <h2>{offer.title}</h2>
                    <p>{offer.description}</p>
                    <div className="offer-expiry"><CalendarDays size={15} />{t('offers.validUntil')} {formatDate(offer.expiresAt)}{expired ? ` · ${t('offers.expired')}` : ''}</div>
                    {offer.rejectionReason ? <div className="offer-rejection"><strong>{t('offers.rejectionReason')}</strong>{offer.rejectionReason}</div> : null}
                    {offer.campaign ? <CampaignSummary offer={offer} /> : null}
                    <div className="offer-actions">
                      {user.role === 'merchant' && offer.status === 'rejected' ? (
                        <button className="button secondary" onClick={() => editOffer(offer)}><Pencil size={16} />{t('offers.editResubmit')}</button>
                      ) : null}
                      {user.role === 'admin' && offer.status === 'pending' && !expired ? (
                        <>
                          <button className="button success-button" disabled={approve.isPending} onClick={() => approve.mutate(offer)}><Check size={16} />{t('offers.approve')}</button>
                          <button className="button danger-button" onClick={() => setRejecting(offer)}><X size={16} />{t('offers.reject')}</button>
                        </>
                      ) : null}
                      {user.role === 'admin' && offer.status === 'approved' && !offer.campaign && !expired ? (
                        <button className="button whatsapp-button" disabled={send.isPending} onClick={() => {
                          if (window.confirm(`Send "${offer.title}" to all eligible customers of ${offer.merchant}?`)) send.mutate(offer);
                        }}><Send size={16} />{t('offers.send')}</button>
                      ) : null}
                      {user.role === 'admin' && offer.campaign?.failed && !expired ? (
                        <button className="button secondary" disabled={retry.isPending} onClick={() => {
                          if (window.confirm(t('offers.retryConfirm'))) retry.mutate(offer);
                        }}><Send size={16} />{t(retry.isPending ? 'offers.retrying' : 'offers.retry')}</button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
          {!offers.data?.offers.length ? <EmptyState>{t('offers.noOffers')}</EmptyState> : null}
          <PaginationBar pagination={offers.data?.pagination} onPage={setPage} />
        </>
      )}

      {rejecting ? (
        <div className="modal-backdrop">
          <form className="modal reject-offer-modal" onSubmit={(event) => { event.preventDefault(); reject.mutate(); }}>
            <button type="button" className="icon-button modal-close" title={t('common.close')} onClick={() => setRejecting(null)}><X /></button>
            <h2>{t('offers.reject')}</h2>
            <p>{rejecting.title}</p>
            <label>{t('offers.rejectionReason')}<textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} required /></label>
            <div className="form-actions">
              <button className="button danger-button" disabled={reject.isPending}>{t('offers.reject')}</button>
              <button type="button" className="button secondary" onClick={() => setRejecting(null)}>{t('offers.cancel')}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function CampaignSummary({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  const campaign = offer.campaign!;
  return (
    <div className="campaign-summary">
      <div><span>{t('offers.broadcast')}</span><strong>{campaign.status.replace('_', ' ')}</strong></div>
      <div><span>{t('offers.recipients')}</span><strong>{campaign.totalRecipients}</strong></div>
      <div><span>{t('offers.queued')}</span><strong>{campaign.queued}</strong></div>
      <div><span>{t('offers.processing')}</span><strong>{campaign.processing}</strong></div>
      <div><span>{t('offers.sent')}</span><strong>{campaign.sent}</strong></div>
      <div><span>{t('offers.delivered')}</span><strong>{campaign.delivered}</strong></div>
      <div><span>{t('offers.read')}</span><strong>{campaign.read}</strong></div>
      <div><span>{t('offers.failed')}</span><strong>{campaign.failed}</strong></div>
      <div><span>{t('offers.skipped')}</span><strong>{campaign.skipped}</strong></div>
      {campaign.failureReason ? (
        <div className="campaign-failure">
          <span>{t('offers.failureReason')}</span>
          <strong>{campaign.failureCode ? `${campaign.failureCode}: ` : ''}{campaign.failureReason}</strong>
        </div>
      ) : null}
    </div>
  );
}
