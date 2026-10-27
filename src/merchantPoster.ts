import posterCss from './pages/merchant-qr-poster.css?inline';

export const headingPresets = [
  { id: 'original', en: 'Original', ml: 'പ്രധാന തലക്കെട്ട്', lines: ['നമ്മുടെ നാട്', 'നമ്മുടെ സ്ഥാപനങ്ങൾ', 'നമ്മുടെ നേട്ടങ്ങൾ'] },
  { id: 'happiness', en: 'Happiness', ml: 'സന്തോഷങ്ങൾ', lines: ['നമ്മുടെ നാട്', 'നമ്മുടെ സ്ഥാപനങ്ങൾ', 'നമ്മുടെ സന്തോഷങ്ങൾ'] },
  { id: 'savings', en: 'Savings', ml: 'സമ്പാദ്യം', lines: ['നമ്മുടെ നാട്', 'നമ്മുടെ സ്ഥാപനങ്ങൾ', 'നമ്മുടെ സമ്പാദ്യം'] },
  { id: 'growth', en: 'Growth', ml: 'വളർച്ച', lines: ['നമ്മുടെ നാട്', 'നമ്മുടെ സ്ഥാപനങ്ങൾ', 'നമ്മുടെ വളർച്ച'] },
];

export const assignedHeading = (index: number, rotate: boolean, fixed: number) =>
  headingPresets[rotate ? index % headingPresets.length : fixed];

export type PosterPage = {
  name: string;
  qr: string;
  lines: string[];
  merchant_code?: string;
  details?: string;
};

export interface PosterSettings {
  size: number;
  weight: number;
  design: string;
  scan: string;
  paperSize?: 'A3' | 'A5';
  showDetails?: boolean;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function loadPosterLogo() {
  const r = await fetch('/logo.png');
  if (!r.ok) throw new Error('Logo unavailable');
  const blob = await r.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function renderPosterArticle(page: PosterPage, logo: string, settings: PosterSettings): string {
  const showCode = settings.showDetails !== false && !!page.merchant_code;
  return `<article class="ae-counter-poster ae-poster-${escape(settings.design)} ae-poster-accents ae-scan-pill" style="--poster-size:${settings.size}pt;--poster-weight:${settings.weight};--poster-align:center"><div class="ae-poster-paper"><img class="ae-poster-logo" src="${logo}" alt="AE"><div class="ae-poster-divider"></div><h1 class="ae-poster-headline">${page.lines.map(line => `<span>${escape(line)}</span>`).join('')}</h1><div class="ae-poster-scan">${escape(settings.scan)}</div><div class="ae-poster-qr"><img src="${page.qr}" alt="Merchant QR"></div><div class="ae-poster-shop"><div class="ae-poster-shop-name">${escape(page.name)}</div>${showCode ? `<div class="ae-poster-shop-code">${escape(page.merchant_code || '')}</div>` : ''}</div><div class="ae-poster-divider"></div><div class="ae-poster-wave"></div></div></article>`;
}

export function batchPosterDocument(
  logo: string,
  pages: PosterPage[],
  settings: PosterSettings
) {
  const isA3 = settings.paperSize !== 'A5';

  if (!isA3) {
    return `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>AE Merchant Posters</title><style>${posterCss}\n.ae-poster-export .ae-counter-poster{break-after:page;page-break-after:always}.ae-poster-export .ae-counter-poster:last-child{break-after:auto;page-break-after:auto}\n@page{size:A5 portrait;margin:0}</style></head><body class="ae-poster-export">${pages.map(page => renderPosterArticle(page, logo, settings)).join('')}</body></html>`;
  }

  const sheets: PosterPage[][] = [];
  for (let i = 0; i < pages.length; i += 4) {
    sheets.push(pages.slice(i, i + 4));
  }

  const sheetsHtml = sheets.map((sheet, sheetIdx) => {
    return `<div class="ae-a3-sheet" data-sheet="${sheetIdx + 1}">
  <div class="ae-a3-slot ae-a3-slot-1">${sheet[0] ? renderPosterArticle(sheet[0], logo, settings) : '<div class="ae-a3-slot-empty"><div class="ae-a3-empty-hint"><span>Slot 1</span></div></div>'}</div>
  <div class="ae-a3-slot ae-a3-slot-2">${sheet[1] ? renderPosterArticle(sheet[1], logo, settings) : '<div class="ae-a3-slot-empty"><div class="ae-a3-empty-hint"><span>Slot 2</span></div></div>'}</div>
  <div class="ae-a3-slot ae-a3-slot-3">${sheet[2] ? renderPosterArticle(sheet[2], logo, settings) : '<div class="ae-a3-slot-empty"><div class="ae-a3-empty-hint"><span>Slot 3</span></div></div>'}</div>
  <div class="ae-a3-slot ae-a3-slot-4">${sheet[3] ? renderPosterArticle(sheet[3], logo, settings) : '<div class="ae-a3-slot-empty"><div class="ae-a3-empty-hint"><span>Slot 4</span></div></div>'}</div>
  <div class="ae-a3-cut-line-h" aria-hidden="true"></div>
  <div class="ae-a3-cut-line-v" aria-hidden="true"></div>
  <div class="ae-a3-cut-center" aria-hidden="true">✂</div>
</div>`;
  }).join('');

  return `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>AE Merchant Posters (A3)</title><style>${posterCss}\n@page{size:A3 portrait;margin:0}\n.ae-poster-export .ae-counter-poster{break-after:avoid;page-break-after:avoid}\n.ae-poster-export .ae-a3-sheet{break-after:page;page-break-after:always}\n.ae-poster-export .ae-a3-sheet:last-child{break-after:auto;page-break-after:auto}</style></head><body class="ae-poster-export ae-export-a3">${sheetsHtml}</body></html>`;
}

export function singlePosterDocument(
  logo: string,
  page: PosterPage,
  settings: PosterSettings & { alignment?: string; colours?: string[]; scanStyle?: string; accents?: boolean }
) {
  const isA3 = settings.paperSize === 'A3';
  const colours = settings.colours || ['#102967', '#7533c9', '#086de0'];
  const alignment = settings.alignment || 'center';
  const scanStyle = settings.scanStyle || 'pill';
  const accents = settings.accents ?? true;
  const showCode = settings.showDetails !== false && !!page.merchant_code;
  const cssVars = `--poster-size:${settings.size}pt;--poster-align:${alignment};--poster-weight:${settings.weight};${colours.map((c, i) => `--poster-colour-${i + 1}:${c}`).join(';')}`;

  const articleHtml = `<article class="ae-counter-poster ae-poster-${escape(settings.design)} ae-scan-${escape(scanStyle)}${accents ? ' ae-poster-accents' : ''}" style="${cssVars}"><div class="ae-poster-paper"><img class="ae-poster-logo" src="${logo}" alt="AE"><div class="ae-poster-divider"></div><h1 class="ae-poster-headline">${page.lines.map(line => `<span>${escape(line)}</span>`).join('')}</h1><div class="ae-poster-scan">${escape(settings.scan)}</div><div class="ae-poster-qr"><img src="${page.qr}" alt="Merchant QR"></div><div class="ae-poster-shop"><div class="ae-poster-shop-name">${escape(page.name)}</div>${showCode ? `<div class="ae-poster-shop-code">${escape(page.merchant_code || '')}</div>` : ''}</div><div class="ae-poster-divider"></div><div class="ae-poster-wave"></div></div></article>`;

  if (!isA3) {
    return `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${escape(page.name)} - AE A5</title><style>${posterCss}\n@page{size:A5 portrait;margin:0}</style></head><body class="ae-poster-export">${articleHtml}</body></html>`;
  }

  return `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${escape(page.name)} - AE A3 (4 in 1)</title><style>${posterCss}\n@page{size:A3 portrait;margin:0}\n.ae-poster-export .ae-counter-poster{break-after:avoid;page-break-after:avoid}\n.ae-poster-export .ae-a3-sheet{break-after:avoid;page-break-after:avoid}</style></head><body class="ae-poster-export ae-export-a3"><div class="ae-a3-sheet" data-sheet="1">
  <div class="ae-a3-slot ae-a3-slot-1">${articleHtml}</div>
  <div class="ae-a3-slot ae-a3-slot-2">${articleHtml}</div>
  <div class="ae-a3-slot ae-a3-slot-3">${articleHtml}</div>
  <div class="ae-a3-slot ae-a3-slot-4">${articleHtml}</div>
  <div class="ae-a3-cut-line-h" aria-hidden="true"></div>
  <div class="ae-a3-cut-line-v" aria-hidden="true"></div>
  <div class="ae-a3-cut-center" aria-hidden="true">✂</div>
</div></body></html>`;
}
