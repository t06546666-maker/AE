import { useEffect, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import './merchant-qr-poster.css';
import { headingPresets, singlePosterDocument, loadPosterLogo, type PaperLayout } from '../merchantPoster';

const defaults = ['നമ്മുടെ നാട്', 'നമ്മുടെ സ്ഥാപനങ്ങൾ', 'നമ്മുടെ നേട്ടങ്ങൾ'];

export function MerchantQrPoster() {
  const { id = '' } = useParams();
  const { i18n } = useTranslation();
  const ml = i18n.language.startsWith('ml');
  const text = (en: string, malayalam: string) => (ml ? malayalam : en);

  const [lines, setLines] = useState(defaults);
  const [scan, setScan] = useState('സ്കാൻ ചെയ്യൂ');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [design, setDesign] = useState('bold');
  const [size, setSize] = useState(27);
  const [alignment, setAlignment] = useState('center');
  const [colours, setColours] = useState(['#102967', '#7533c9', '#086de0']);
  const [weight, setWeight] = useState(900);
  const [scanStyle, setScanStyle] = useState('pill');
  const [accents, setAccents] = useState(true);
  const [paperSize, setPaperSize] = useState<PaperLayout>('2in1');
  const [showDetails, setShowDetails] = useState(true);

  const styleVars = {
    '--poster-size': `${size}pt`,
    '--poster-align': alignment,
    '--poster-weight': weight,
    '--poster-colour-1': colours[0],
    '--poster-colour-2': colours[1],
    '--poster-colour-3': colours[2],
  } as CSSProperties;

  const result = useQuery({
    queryKey: ['admin-qr-poster', id],
    queryFn: ({ signal }) =>
      apiFetch<{ merchant: { id: string; name: string; merchant_code: string }; payload: string }>(
        `/api/admin/merchants/${encodeURIComponent(id)}/qr-poster`,
        { signal }
      ),
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    let active = true;
    setQr('');
    setError('');
    if (result.data) {
      void QRCode.toString(result.data.payload, { type: 'svg', margin: 4, errorCorrectionLevel: 'H' })
        .then(svg => {
          if (active) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        })
        .catch(() => {
          if (active) setError('Unable to generate QR. Please retry.');
        });
    }
    return () => {
      active = false;
    };
  }, [result.data]);

  const valid = !!qr && lines.every(line => line.trim()) && !!scan.trim();

  async function exportPoster(print: boolean) {
    if (!valid || !result.data) return;
    const paper = document.querySelector('.ae-poster-page .ae-poster-paper');
    if (
      paper &&
      Array.from(paper.children).some(
        child => !child.classList.contains('ae-poster-wave') && child.getBoundingClientRect().bottom > paper.getBoundingClientRect().bottom - 12
      )
    ) {
      setError(
        text(
          'The text does not fit poster. Shorten the headline or shop name before printing.',
          'വാചകം പോസ്റ്ററിൽ ഒതുങ്ങുന്നില്ല. പ്രിന്റ് ചെയ്യുന്നതിന് മുമ്പ് തലക്കെട്ടോ സ്ഥാപനത്തിന്റെ പേരോ ചുരുക്കുക.'
        )
      );
      return;
    }

    const popup = print ? window.open('', '_blank') : null;
    if (print && !popup) {
      setError(text('Allow pop-ups to open the print preview.', 'പ്രിന്റ് പ്രിവ്യൂ തുറക്കാൻ പോപ്പ്-അപ്പുകൾ അനുവദിക്കുക.'));
      return;
    }

    setExporting(true);
    setError('');
    try {
      const logo = await loadPosterLogo();
      const html = singlePosterDocument(
        logo,
        {
          name: result.data.merchant.name,
          merchant_code: result.data.merchant.merchant_code,
          qr,
          lines,
        },
        {
          size,
          weight,
          design,
          scan,
          alignment,
          colours,
          scanStyle,
          accents,
          paperSize,
          showDetails,
        }
      );

      if (popup) {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        await Promise.all(Array.from(popup.document.images).map(img => img.decode()));
        await popup.document.fonts.ready;
        popup.focus();
        popup.print();
      } else {
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        const storeName =
          result.data.merchant.name
            .normalize('NFC')
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
            .trim()
            .slice(0, 80) || 'Store';
        a.download = `AE-${paperSize}-${storeName}-${result.data.merchant.merchant_code.replace(/[^a-zA-Z0-9_-]/g, '')}.html`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch {
      popup?.close();
      setError(text('Unable to prepare poster. Please retry.', 'പോസ്റ്റർ തയ്യാറാക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.'));
    } finally {
      setExporting(false);
    }
  }

  if (result.isPending) return <LoadingState />;
  if (result.isError) return <ErrorState error={result.error} retry={() => void result.refetch()} />;

  return (
    <div className="ae-poster-page">
      <Link className="button secondary" to={`/merchants/${encodeURIComponent(id)}`}>
        {text('Back to merchant', 'സ്ഥാപനത്തിലേക്ക് മടങ്ങുക')}
      </Link>
      <h1>{text('QR Poster', 'QR പോസ്റ്റർ')}</h1>
      <p>
        {result.data.merchant.name} · {result.data.merchant.merchant_code}
      </p>

      <section className="ae-heading-presets" aria-label={text('Choose a heading', 'തലക്കെട്ട് തിരഞ്ഞെടുക്കുക')}>
        {headingPresets.map(preset => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={lines.every((line, i) => line === preset.lines[i])}
            onClick={() => {
              setLines([...preset.lines]);
              setError('');
            }}
          >
            <strong>{text(preset.en, preset.ml)}</strong>
            <span>
              {preset.lines.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </span>
          </button>
        ))}
      </section>

      <div className="ae-poster-workspace">
        <section className="panel ae-poster-editor">
          <h2>{text('Counter display poster', 'കൗണ്ടർ ഡിസ്പ്ലേ പോസ്റ്റർ')}</h2>
          <p>
            {paperSize === '2in1'
              ? text('2 QR codes in 1 page (A4 landscape · 2 copies)', 'ഒരു പേജിൽ 2 എണ്ണം (A4 ലാൻഡ്‌സ്‌കേപ്പ്)')
              : paperSize === 'A3'
              ? text('A3 sheet (4 copies · 2×2 grid)', 'A3 ഷീറ്റ് (4 എണ്ണം)')
              : 'A5 (148 × 210 mm)'}
          </p>

          <fieldset className="ae-poster-design-controls">
            <legend>{text('Paper layout', 'പേപ്പർ ലേഔട്ട്')}</legend>
            <div className="ae-poster-style-options">
              <button
                type="button"
                className="button secondary"
                aria-pressed={paperSize === '2in1'}
                onClick={() => setPaperSize('2in1')}
              >
                {text('2 in 1 Page', 'പേജിൽ 2 എണ്ണം')}
              </button>
              <button
                type="button"
                className="button secondary"
                aria-pressed={paperSize === 'A3'}
                onClick={() => setPaperSize('A3')}
              >
                {text('4 in 1 (A3)', '4 എണ്ണം (A3)')}
              </button>
              <button
                type="button"
                className="button secondary"
                aria-pressed={paperSize === 'A5'}
                onClick={() => setPaperSize('A5')}
              >
                {text('1 per page (A5)', 'ഒരെണ്ണം (A5)')}
              </button>
            </div>
          </fieldset>

          <fieldset className="ae-poster-design-controls">
            <legend>{text('Presentation style', 'അവതരണ ശൈലി')}</legend>
            <div className="ae-poster-style-options">
              {[
                ['bold', 'Bold / reference', 'ബോൾഡ് / മാതൃക'],
                ['clean', 'Clean', 'ലളിതം'],
              ].map(([value, en, mal]) => (
                <button
                  type="button"
                  className="button secondary"
                  aria-pressed={design === value}
                  key={value}
                  onClick={() => {
                    setDesign(value);
                    setSize(value === 'bold' ? 27 : 24);
                  }}
                >
                  {text(en, mal)}
                </button>
              ))}
            </div>
            <label>
              {text('Headline size', 'തലക്കെട്ടിന്റെ വലുപ്പം')} · {size} pt
              <input type="range" min="18" max="30" value={size} onChange={e => setSize(Number(e.target.value))} />
            </label>
            <label>
              {text('Text boldness', 'അക്ഷരങ്ങളുടെ കനം')}
              <select value={weight} onChange={e => setWeight(Number(e.target.value))}>
                <option value={600}>{text('Medium', 'ഇടത്തരം')}</option>
                <option value={700}>{text('Bold', 'ബോൾഡ്')}</option>
                <option value={900}>{text('Extra bold', 'കൂടുതൽ ബോൾഡ്')}</option>
              </select>
            </label>
            <label>
              {text('Scan label style', 'സ്കാൻ നിർദ്ദേശത്തിന്റെ ശൈലി')}
              <select value={scanStyle} onChange={e => setScanStyle(e.target.value)}>
                <option value="pill">{text('Gradient pill', 'ഗ്രേഡിയന്റ് ബട്ടൺ')}</option>
                <option value="outline">{text('Clean outline', 'ലളിതമായ ബോർഡർ')}</option>
              </select>
            </label>
            <label className="ae-poster-accent-toggle">
              <input type="checkbox" checked={accents} onChange={e => setAccents(e.target.checked)} />
              {text('Small headline accents', 'തലക്കെട്ടിന് ചെറിയ അലങ്കാരങ്ങൾ')}
            </label>
            <label className="ae-poster-accent-toggle">
              <input type="checkbox" checked={showDetails} onChange={e => setShowDetails(e.target.checked)} />
              {text('Show merchant code', 'സ്ഥാപന കോഡ് കാണിക്കുക')}
            </label>
            <label>
              {text('Text alignment', 'വാചക വിന്യാസം')}
              <select value={alignment} onChange={e => setAlignment(e.target.value)}>
                <option value="center">{text('Centre', 'മധ്യത്തിൽ')}</option>
                <option value="left">{text('Left', 'ഇടത്')}</option>
                <option value="right">{text('Right', 'വലത്')}</option>
              </select>
            </label>
            <p>{text('Type English or Malayalam below. Text is printed exactly as entered.', 'താഴെ ഇംഗ്ലീഷിലോ മലയാളത്തിലോ എഴുതാം. നൽകിയ വാചകം അതേപടി പ്രിന്റ് ചെയ്യും.')}</p>
          </fieldset>

          {lines.map((line, index) => (
            <div className="ae-poster-line-editor" key={index}>
              <label>
                {text(`Headline · Line ${index + 1}`, `തലക്കെട്ട് · വരി ${index + 1}`)}
                <input maxLength={60} value={line} onChange={e => setLines(old => old.map((v, i) => (i === index ? e.target.value : v)))} />
              </label>
              <label className="ae-poster-colour-label">
                {text('Colour', 'നിറം')}
                <input type="color" value={colours[index]} onChange={e => setColours(old => old.map((v, i) => (i === index ? e.target.value : v)))} />
              </label>
            </div>
          ))}

          <label>
            {text('Scan instruction', 'സ്കാൻ നിർദ്ദേശം')}
            <input maxLength={24} value={scan} onChange={e => setScan(e.target.value)} />
          </label>

          <label>
            {text('Shop name (from merchant profile)', 'സ്ഥാപനത്തിന്റെ പേര് (പ്രൊഫൈലിൽ നിന്ന്)')}
            <input readOnly value={result.data.merchant.name} />
          </label>

          <p>{text('This is the same shop QR used in the merchant app. Editing the headline does not change the QR.', 'മെർച്ചന്റ് ആപ്പിലെ അതേ സ്ഥാപന QR ആണ് ഇത്. തലക്കെട്ട് മാറ്റിയാലും QR മാറില്ല.')}</p>

          <button className="button primary" disabled={!valid || exporting} onClick={() => void exportPoster(true)}>
            {text('Print / Save PDF', 'പ്രിന്റ് / PDF ആയി സൂക്ഷിക്കുക')}
          </button>
          <button className="button secondary" disabled={!valid || exporting} onClick={() => void exportPoster(false)}>
            {text('Download printable poster', 'പ്രിന്റ് ചെയ്യാവുന്ന പോസ്റ്റർ ഡൗൺലോഡ്')}
          </button>
          <p>
            {paperSize === '2in1'
              ? text(
                  'Choose A4 Landscape, actual size (100%), no margins, and background graphics. Prints 2 copies on 1 page to cut in half.',
                  'A4 ലാൻഡ്‌സ്‌കേപ്പ്, യഥാർത്ഥ വലുപ്പം (100%), മാർജിൻ ഇല്ല, പശ്ചാത്തല ഗ്രാഫിക്സ് എന്നിവ തിരഞ്ഞെടുക്കുക. ഒരു പേജിൽ 2 എണ്ണം പ്രിന്റ് ചെയ്ത് മുറിച്ചെടുക്കാം.'
                )
              : paperSize === 'A3'
              ? text(
                  'Choose A3, actual size (100%), no margins, and background graphics. Prints 4 copies on 1 A3 sheet to cut into 4.',
                  'A3, യഥാർത്ഥ വലുപ്പം (100%), മാർജിൻ ഇല്ല, പശ്ചാത്തല ഗ്രാഫിക്സ് എന്നിവ തിരഞ്ഞെടുക്കുക. ഒരു A3 ഷീറ്റിൽ 4 എണ്ണം പ്രിന്റ് ചെയ്ത് മുറിച്ചെടുക്കാം.'
                )
              : text(
                  'Choose A5, actual size (100%), no margins, and background graphics. Test-scan the printed copy in the AE customer app.',
                  'A5, യഥാർത്ഥ വലുപ്പം (100%), മാർജിൻ ഇല്ല, പശ്ചാത്തല ഗ്രാഫിക്സ് എന്നിവ തിരഞ്ഞെടുക്കുക. പ്രിന്റ് ചെയ്ത QR, AE കസ്റ്റമർ ആപ്പിൽ സ്കാൻ ചെയ്ത് പരിശോധിക്കുക.'
                )}
          </p>
          {error && <p role="alert">{error}</p>}
        </section>

        <section className="ae-poster-preview" aria-label={text('Poster preview', 'പോസ്റ്റർ പ്രിവ്യൂ')}>
          <article className={`ae-counter-poster ae-poster-${design} ae-scan-${scanStyle}${accents ? ' ae-poster-accents' : ''}`} style={styleVars}>
            <div className="ae-poster-paper">
              <img className="ae-poster-logo" src="/logo.png" alt="AE" />
              <div className="ae-poster-divider" />
              <h2 className="ae-poster-headline">
                {lines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </h2>
              <div className="ae-poster-scan">{scan}</div>
              <div className="ae-poster-qr">
                {qr ? <img src={qr} alt={text('Merchant QR', 'സ്ഥാപന QR')} /> : <span role="status">{text('Preparing QR…', 'QR തയ്യാറാക്കുന്നു…')}</span>}
              </div>
              <div className="ae-poster-shop">
                <div className="ae-poster-shop-name">{result.data.merchant.name}</div>
                {showDetails && result.data.merchant.merchant_code && (
                  <div className="ae-poster-shop-code">{result.data.merchant.merchant_code}</div>
                )}
              </div>
              <div className="ae-poster-divider" />
              <div className="ae-poster-wave" />
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
