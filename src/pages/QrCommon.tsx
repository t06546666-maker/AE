import { useDeferredValue, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { apiFetch, queryString } from '../api';
import { headingPresets, assignedHeading, loadPosterLogo, batchPosterDocument, type PosterPage } from '../merchantPoster';
import './merchant-qr-poster.css';
import './qr-common.css';

type Shop = { id: string; name: string; merchant_code: string };
type List = { merchants: Shop[]; total: number; page: number; pageSize: number };

function QrThumbnail({ shop, onOpen }: { shop: Shop; onOpen: (shop: Shop, qr: string) => void }) {
  const { i18n } = useTranslation();
  const ml = i18n.language.startsWith('ml');
  const qr = useQuery({
    queryKey: ['admin-shop-qr-thumbnail', shop.id],
    staleTime: 300000,
    gcTime: 60000,
    queryFn: async ({ signal }) => {
      const data = await apiFetch<{ payload: string }>(`/api/admin/merchants/${encodeURIComponent(shop.id)}/qr-poster`, { signal });
      return QRCode.toDataURL(data.payload, { width: 180, margin: 4, errorCorrectionLevel: 'H' });
    },
  });
  return (
    <button
      className="ae-common-qr"
      type="button"
      disabled={!qr.data}
      onClick={() => qr.data && onOpen(shop, qr.data)}
      aria-label={`${ml ? 'QR തുറക്കുക' : 'Open QR'}: ${shop.name}`}
    >
      {qr.data ? <img src={qr.data} alt="" /> : <span>{qr.isError ? '⚠' : '…'}</span>}
    </button>
  );
}

export function QrCommon() {
  const { i18n } = useTranslation();
  const ml = i18n.language.startsWith('ml');
  const t = (en: string, mal: string) => (ml ? mal : en);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, Shop>>(new Map());
  const [rotate, setRotate] = useState(true);
  const [fixed, setFixed] = useState(0);
  const [size, setSize] = useState(27);
  const [weight, setWeight] = useState(900);
  const [design, setDesign] = useState('bold');
  const [scan, setScan] = useState('സ്കാൻ ചെയ്യൂ');
  const [paperSize, setPaperSize] = useState<'A3' | 'A5'>('A3');
  const [showDetails, setShowDetails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState<{ shop: Shop; qr: string } | null>(null);

  const deferred = useDeferredValue(search);
  const rows = [...selected.values()];
  const [printDocument, setPrintDocument] = useState('');
  const printFrame = useRef<HTMLIFrameElement>(null);

  const list = useQuery({
    queryKey: ['qr-common-merchants', page, deferred],
    queryFn: ({ signal }) => apiFetch<List>(`/api/admin/qr-merchants?${queryString({ page, search: deferred })}`, { signal }),
  });

  function toggle(shop: Shop) {
    setSelected(old => {
      const next = new Map(old);
      if (next.has(shop.id)) next.delete(shop.id);
      else next.set(shop.id, shop);
      return next;
    });
  }

  function moveShop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const next = [...rows];
    const [removed] = next.splice(index, 1);
    next.splice(targetIndex, 0, removed);
    const newMap = new Map<string, Shop>();
    next.forEach(s => newMap.set(s.id, s));
    setSelected(newMap);
  }

  function removeShop(id: string) {
    setSelected(old => {
      const next = new Map(old);
      next.delete(id);
      return next;
    });
  }

  async function selectMatching() {
    setBusy(true);
    setError('');
    const snapshot = new Map(selected);
    try {
      for (let current = 1; ; current++) {
        const data = await apiFetch<List>(`/api/admin/qr-merchants?${queryString({ page: current, search })}`);
        data.merchants.forEach(shop => snapshot.set(shop.id, shop));
        setProgress(`${snapshot.size}`);
        if (current * data.pageSize >= data.total || !data.merchants.length) break;
      }
      setSelected(snapshot);
    } catch {
      setError(t('Unable to load all merchants. Selection was not changed.', 'എല്ലാ സ്ഥാപനങ്ങളും ലോഡ് ചെയ്യാനായില്ല. തിരഞ്ഞെടുപ്പ് മാറ്റിയിട്ടില്ല.'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function printSelected() {
    if (!rows.length || busy || !scan.trim()) return;
    setBusy(true);
    setError('');
    setPrintDocument('');
    try {
      const prepared: PosterPage[] = new Array(rows.length);
      let completed = 0;
      // Bounded concurrency avoids flooding the backend for large selections.
      for (let offset = 0; offset < rows.length; offset += 4) {
        await Promise.all(
          rows.slice(offset, offset + 4).map(async (shop, j) => {
            const index = offset + j;
            const data = await apiFetch<{ merchant: Shop; payload: string }>(`/api/admin/merchants/${encodeURIComponent(shop.id)}/qr-poster`);
            if (data.merchant.id !== shop.id) throw new Error('Merchant mismatch');
            prepared[index] = {
              name: data.merchant.name,
              merchant_code: data.merchant.merchant_code,
              qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                await QRCode.toString(data.payload, { type: 'svg', margin: 4, errorCorrectionLevel: 'H' })
              )}`,
              lines: assignedHeading(index, rotate, fixed).lines,
            };
            setProgress(`${++completed} / ${rows.length}`);
          })
        );
      }
      setPrintDocument(
        batchPosterDocument(await loadPosterLogo(), prepared, {
          size,
          weight,
          design,
          scan,
          paperSize,
          showDetails,
        })
      );
    } catch (e) {
      setError(t('No partial batch was printed. ', 'അപൂർണ്ണമായ ബാച്ച് പ്രിന്റ് ചെയ്തിട്ടില്ല. ') + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function printPrepared() {
    const frame = printFrame.current;
    const doc = frame?.contentDocument;
    if (!doc || !frame?.contentWindow) return;
    setBusy(true);
    setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([doc.fonts.ready, ...Array.from(doc.images).map(img => img.decode())]),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(t('Print assets took too long to load. Retry the preview.', 'പ്രിന്റ് ഉള്ളടക്കം ലോഡ് ചെയ്യാൻ വൈകി. വീണ്ടും ശ്രമിക്കുക.'))), 15000);
        }),
      ]);
      if (
        Array.from(doc.querySelectorAll('.ae-poster-paper')).some(p =>
          Array.from(p.children).some(c => !c.classList.contains('ae-poster-wave') && c.getBoundingClientRect().bottom > p.getBoundingClientRect().bottom - 12)
        )
      ) {
        throw new Error(t('Some text does not fit poster. Reduce headline size and prepare again.', 'ചില വാചകങ്ങൾ പോസ്റ്ററിൽ ഒതുങ്ങുന്നില്ല. വലുപ്പം കുറച്ച് വീണ്ടും തയ്യാറാക്കുക.'));
      }
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (timer) clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <div className="ae-common-page">
      <header>
        <h1>{t('QR Common', 'QR കോമൺ')}</h1>
        <p>
          {t(
            'Select and arrange shops, review headings, and print 4 shops per A3 sheet or 1 per A5.',
            'സ്ഥാപനങ്ങൾ തിരഞ്ഞെടുത്ത് ക്രമീകരിക്കുക. ഓരോ A3 ഷീറ്റിലും 4 സ്ഥാപനങ്ങളുടെ QR അല്ലെങ്കിൽ A5-ൽ പ്രിന്റ് ചെയ്യാം.'
          )}
        </p>
      </header>

      <div className="ae-common-toolbar">
        <label>
          {t('Search shops', 'സ്ഥാപനങ്ങൾ തിരയുക')}
          <input value={search} disabled={busy} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </label>
        <button className="button secondary" disabled={busy || list.isPending} onClick={() => void selectMatching()}>
          {t('Select all matching', 'പൊരുത്തപ്പെടുന്ന എല്ലാം തിരഞ്ഞെടുക്കുക')}
        </button>
        <button className="button secondary" disabled={busy || !rows.length} onClick={() => setSelected(new Map())}>
          {t('Clear selection', 'തിരഞ്ഞെടുപ്പ് നീക്കുക')}
        </button>
        <strong>{rows.length} {t('selected', 'തിരഞ്ഞെടുത്തു')}</strong>
      </div>

      {error && <p role="alert" className="form-error">{error}</p>}
      {progress && <p role="status">{t('Preparing', 'തയ്യാറാക്കുന്നു')} {progress}</p>}

      <div className="ae-common-layout">
        <section className="panel">
          <h2>{t('Merchants and QRs', 'സ്ഥാപനങ്ങളും QR-കളും')}</h2>
          {list.isPending ? (
            <p role="status">{t('Loading…', 'ലോഡ് ചെയ്യുന്നു…')}</p>
          ) : list.isError ? (
            <div role="alert">
              {t('Unable to load merchants.', 'സ്ഥാപനങ്ങൾ ലോഡ് ചെയ്യാനായില്ല.')}
              <button onClick={() => void list.refetch()}>{t('Retry', 'വീണ്ടും ശ്രമിക്കുക')}</button>
            </div>
          ) : (
            <>
              <label className="ae-common-check">
                <input
                  type="checkbox"
                  disabled={busy || !list.data.merchants.length}
                  checked={!!list.data.merchants.length && list.data.merchants.every(shop => selected.has(shop.id))}
                  onChange={e => {
                    const checked = e.target.checked;
                    setSelected(old => {
                      const next = new Map(old);
                      list.data.merchants.forEach(shop => (checked ? next.set(shop.id, shop) : next.delete(shop.id)));
                      return next;
                    });
                  }}
                />
                {t('Select this page', 'ഈ പേജ് തിരഞ്ഞെടുക്കുക')}
              </label>

              <div className="ae-common-list">
                {list.data.merchants.map(shop => (
                  <div className="ae-common-shop" key={shop.id}>
                    <label className="ae-common-check">
                      <input type="checkbox" disabled={busy} checked={selected.has(shop.id)} onChange={() => toggle(shop)} />
                      <span>
                        <strong>{shop.name}</strong>
                        <small>{shop.merchant_code}</small>
                      </span>
                    </label>
                    <QrThumbnail shop={shop} onOpen={(s, qr) => setOpen({ shop: s, qr })} />
                    <Link to={`/merchants/${shop.id}/qr-poster`}>{t('Edit poster', 'പോസ്റ്റർ തിരുത്തുക')}</Link>
                  </div>
                ))}
              </div>

              {!list.data.merchants.length && <p>{t('No matching shops.', 'പൊരുത്തപ്പെടുന്ന സ്ഥാപനങ്ങളില്ല.')}</p>}

              <div className="ae-common-paging">
                <button disabled={busy || page === 1} onClick={() => setPage(p => p - 1)}>
                  {t('Previous', 'മുൻപത്തെ')}
                </button>
                <span>{page} / {Math.max(1, Math.ceil(list.data.total / list.data.pageSize))}</span>
                <button disabled={busy || page * list.data.pageSize >= list.data.total} onClick={() => setPage(p => p + 1)}>
                  {t('Next', 'അടുത്തത്')}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="panel ae-common-settings">
          <h2>{t('Poster options', 'പോസ്റ്റർ ഓപ്ഷനുകൾ')}</h2>

          <fieldset className="ae-common-fieldset">
            <legend>{t('Paper & layout', 'പേപ്പർ & ലേഔട്ട്')}</legend>
            <div className="ae-common-paper-options">
              <button
                type="button"
                aria-pressed={paperSize === 'A3'}
                onClick={() => setPaperSize('A3')}
              >
                <strong>{t('A3 Sheet (4 in 1)', 'A3 ഷീറ്റ് (4 എണ്ണം)')}</strong>
                <small>{t('2×2 grid · Cut into 4 A5 posters', '2×2 ഗ്രിഡ് · 4 പോസ്റ്ററുകൾ')}</small>
              </button>
              <button
                type="button"
                aria-pressed={paperSize === 'A5'}
                onClick={() => setPaperSize('A5')}
              >
                <strong>{t('A5 Single', 'A5 ഒരെണ്ണം')}</strong>
                <small>{t('1 poster per page', 'ഒരു പേജിൽ ഒരെണ്ണം')}</small>
              </button>
            </div>
          </fieldset>

          <label className="ae-common-check">
            <input
              type="checkbox"
              checked={showDetails}
              disabled={busy}
              onChange={e => setShowDetails(e.target.checked)}
            />
            {t('Show merchant code on poster', 'പോസ്റ്ററിൽ സ്ഥാപന കോഡ് കാണിക്കുക')}
          </label>

          <label className="ae-common-check">
            <input
              type="checkbox"
              checked={rotate}
              disabled={busy}
              onChange={e => setRotate(e.target.checked)}
            />
            {t('Rotate headings', 'തലക്കെട്ടുകൾ മാറിമാറി നൽകുക')}
          </label>
          <p>{t('Original → Happiness → Savings → Growth → repeat. Order follows your arrangement below.', 'പ്രധാനം → സന്തോഷങ്ങൾ → സമ്പാദ്യം → വളർച്ച → വീണ്ടും. താഴെ നിങ്ങൾ ക്രമീകരിച്ച ക്രമത്തിൽ.')}</p>

          {!rotate && (
            <label>
              {t('Use one heading', 'ഒരു തലക്കെട്ട് ഉപയോഗിക്കുക')}
              <select value={fixed} disabled={busy} onChange={e => setFixed(Number(e.target.value))}>
                {headingPresets.map((h, i) => (
                  <option key={h.id} value={i}>
                    {ml ? h.ml : h.en}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            {t('Style', 'ശൈലി')}
            <select disabled={busy} value={design} onChange={e => setDesign(e.target.value)}>
              <option value="bold">{t('Bold', 'ബോൾഡ്')}</option>
              <option value="clean">{t('Clean', 'ലളിതം')}</option>
            </select>
          </label>

          <label>
            {t('Headline size', 'തലക്കെട്ടിന്റെ വലുപ്പം')} · {size} pt
            <input disabled={busy} type="range" min="18" max="30" value={size} onChange={e => setSize(Number(e.target.value))} />
          </label>

          <label>
            {t('Boldness', 'അക്ഷരങ്ങളുടെ കനം')}
            <select disabled={busy} value={weight} onChange={e => setWeight(Number(e.target.value))}>
              <option value={700}>Bold</option>
              <option value={900}>Extra bold</option>
            </select>
          </label>

          <label>
            {t('Scan instruction', 'സ്കാൻ നിർദ്ദേശം')}
            <input disabled={busy} maxLength={24} value={scan} onChange={e => setScan(e.target.value)} />
          </label>

          <div className="ae-common-arrange-header">
            <h3>{t('Arrange & review shops', 'സ്ഥാപനങ്ങളുടെ ക്രമം നിശ്ചയിക്കുക')}</h3>
            {paperSize === 'A3' && rows.length > 0 && (
              <span className="ae-common-sheet-count">
                {Math.ceil(rows.length / 4)} {t('A3 sheets', 'A3 ഷീറ്റുകൾ')}
              </span>
            )}
          </div>

          {!rows.length && <p>{t('Select merchants to begin.', 'ആരംഭിക്കാൻ സ്ഥാപനങ്ങൾ തിരഞ്ഞെടുക്കുക.')}</p>}

          {paperSize === 'A3' ? (
            <div className="ae-common-sheets-container">
              {Array.from({ length: Math.ceil(rows.length / 4) }, (_, sheetIdx) => {
                const sheetShops = rows.slice(sheetIdx * 4, sheetIdx * 4 + 4);
                const slotNames = [
                  t('Slot 1: Top-Left', 'സ്ലോട്ട് 1: മുകളിൽ ഇടത്'),
                  t('Slot 2: Top-Right', 'സ്ലോട്ട് 2: മുകളിൽ വലത്'),
                  t('Slot 3: Bottom-Left', 'സ്ലോട്ട് 3: താഴെ ഇടത്'),
                  t('Slot 4: Bottom-Right', 'സ്ലോട്ട് 4: താഴെ വലത്'),
                ];
                return (
                  <div key={sheetIdx} className="ae-common-sheet-card">
                    <header className="ae-common-sheet-header">
                      <strong>{t(`A3 Sheet ${sheetIdx + 1}`, `A3 ഷീറ്റ് ${sheetIdx + 1}`)}</strong>
                      <span>{sheetShops.length} / 4 {t('posters', 'പോസ്റ്ററുകൾ')}</span>
                    </header>
                    <div className="ae-common-sheet-grid">
                      {[0, 1, 2, 3].map(slotIdx => {
                        const globalIdx = sheetIdx * 4 + slotIdx;
                        const shop = sheetShops[slotIdx];
                        if (!shop) {
                          return (
                            <div key={slotIdx} className="ae-common-slot-empty">
                              <small>{slotNames[slotIdx]}</small>
                              <span>{t('Empty slot', 'ഒഴിവ്')}</span>
                            </div>
                          );
                        }
                        const heading = assignedHeading(globalIdx, rotate, fixed);
                        return (
                          <div key={shop.id} className="ae-common-slot-card">
                            <div className="ae-common-slot-badge">
                              <span>{slotNames[slotIdx]}</span>
                              <span className="ae-heading-pill">{ml ? heading.ml : heading.en}</span>
                            </div>
                            <div className="ae-common-slot-info">
                              <strong>{shop.name}</strong>
                              <small>{shop.merchant_code}</small>
                            </div>
                            <div className="ae-common-slot-actions">
                              <button
                                type="button"
                                title={t('Move up', 'മുകളിലേക്ക്')}
                                disabled={busy || globalIdx === 0}
                                onClick={() => moveShop(globalIdx, -1)}
                                className="ae-slot-btn"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                title={t('Move down', 'താഴേക്ക്')}
                                disabled={busy || globalIdx === rows.length - 1}
                                onClick={() => moveShop(globalIdx, 1)}
                                className="ae-slot-btn"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                title={t('Remove', 'ഒഴിവാക്കുക')}
                                disabled={busy}
                                onClick={() => removeShop(shop.id)}
                                className="ae-slot-btn ae-slot-remove"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <ol className="ae-common-assignments">
              {rows.map((shop, i) => {
                const heading = assignedHeading(i, rotate, fixed);
                return (
                  <li key={shop.id} className="ae-common-assignment-row">
                    <div className="ae-common-assignment-info">
                      <strong>{shop.name}</strong>
                      <small>{shop.merchant_code}</small>
                      <span className="ae-heading-pill">{ml ? heading.ml : heading.en}</span>
                    </div>
                    <div className="ae-common-slot-actions">
                      <button
                        type="button"
                        title={t('Move up', 'മുകളിലേക്ക്')}
                        disabled={busy || i === 0}
                        onClick={() => moveShop(i, -1)}
                        className="ae-slot-btn"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title={t('Move down', 'താഴേക്ക്')}
                        disabled={busy || i === rows.length - 1}
                        onClick={() => moveShop(i, 1)}
                        className="ae-slot-btn"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        title={t('Remove', 'ഒഴിവാക്കുക')}
                        disabled={busy}
                        onClick={() => removeShop(shop.id)}
                        className="ae-slot-btn ae-slot-remove"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <button
            className="button primary"
            disabled={busy || !rows.length || !scan.trim()}
            onClick={() => void printSelected()}
          >
            {t('Print / Save selected as PDF', 'തിരഞ്ഞെടുത്തവ പ്രിന്റ് / PDF ആയി സൂക്ഷിക്കുക')} ({rows.length})
          </button>
          <p>
            {paperSize === 'A3'
              ? t(
                  'Choose Save as PDF, A3, 100%, no margins, backgrounds on, browser headers/footers off. 4 shops per A3 page.',
                  'PDF ആയി സൂക്ഷിക്കുക, A3, 100%, മാർജിൻ ഇല്ല, പശ്ചാത്തലം ഓൺ, ബ്രൗസർ ഹെഡർ/ഫൂട്ടർ ഓഫ്. ഒരു A3 പേജിൽ 4 സ്ഥാപനങ്ങൾ.'
                )
              : t(
                  'Choose Save as PDF, A5, 100%, no margins, backgrounds on, browser headers/footers off. One shop per page.',
                  'PDF ആയി സൂക്ഷിക്കുക, A5, 100%, മാർജിൻ ഇല്ല, പശ്ചാത്തലം ഓൺ, ബ്രൗസർ ഹെഡർ/ഫൂട്ടർ ഓഫ്. ഒരു പേജിൽ ഒരു സ്ഥാപനം.'
                )}
          </p>
        </section>
      </div>

      {printDocument && (
        <section className="panel ae-common-batch">
          <h2>
            {paperSize === 'A3'
              ? t('Combined A3 preview (4 per page)', 'ഒന്നിച്ചുള്ള A3 പ്രിവ്യൂ (പേജിൽ 4 എണ്ണം)')
              : t('Combined A5 preview', 'ഒന്നിച്ചുള്ള A5 പ്രിവ്യൂ')}
          </h2>
          <p>
            {t(
              'This preview is a snapshot of the prepared selection. Review every page before saving.',
              'തയ്യാറാക്കിയ തിരഞ്ഞെടുപ്പിന്റെ പ്രിവ്യൂ ആണിത്. സൂക്ഷിക്കുന്നതിന് മുമ്പ് എല്ലാ പേജുകളും പരിശോധിക്കുക.'
            )}
          </p>
          <button className="button primary" disabled={busy} onClick={() => void printPrepared()}>
            {t('Print preview / Save PDF', 'പ്രിവ്യൂ പ്രിന്റ് / PDF ആയി സൂക്ഷിക്കുക')}
          </button>
          <button className="button secondary" disabled={busy} onClick={() => setPrintDocument('')}>
            {t('Close preview', 'പ്രിവ്യൂ അടയ്ക്കുക')}
          </button>
          <iframe ref={printFrame} title={t('Combined merchant posters', 'ഒന്നിച്ചുള്ള സ്ഥാപന പോസ്റ്ററുകൾ')} srcDoc={printDocument} />
        </section>
      )}

      {open && (
        <div
          className="ae-common-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t('Shop QR', 'സ്ഥാപന QR')}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(null); }}
        >
          <section>
            <button autoFocus className="button secondary" onClick={() => setOpen(null)}>
              {t('Close', 'അടയ്ക്കുക')}
            </button>
            <h2>{open.shop.name}</h2>
            <p style={{ margin: '4px 0 14px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>{open.shop.merchant_code}</p>
            <img src={open.qr} alt={t('Shop QR', 'സ്ഥാപന QR')} />
          </section>
        </div>
      )}
    </div>
  );
}
