import posterCss from './pages/merchant-qr-poster.css?inline';
export const headingPresets=[
  {id:'original',en:'Original',ml:'പ്രധാന തലക്കെട്ട്',lines:['നമ്മുടെ നാട്','നമ്മുടെ സ്ഥാപനങ്ങൾ','നമ്മുടെ നേട്ടങ്ങൾ']},
  {id:'happiness',en:'Happiness',ml:'സന്തോഷങ്ങൾ',lines:['നമ്മുടെ നാട്','നമ്മുടെ സ്ഥാപനങ്ങൾ','നമ്മുടെ സന്തോഷങ്ങൾ']},
  {id:'savings',en:'Savings',ml:'സമ്പാദ്യം',lines:['നമ്മുടെ നാട്','നമ്മുടെ സ്ഥാപനങ്ങൾ','നമ്മുടെ സമ്പാദ്യം']},
  {id:'growth',en:'Growth',ml:'വളർച്ച',lines:['നമ്മുടെ നാട്','നമ്മുടെ സ്ഥാപനങ്ങൾ','നമ്മുടെ വളർച്ച']},
];
export const assignedHeading=(index:number,rotate:boolean,fixed:number)=>headingPresets[rotate?index%headingPresets.length:fixed];
export type PosterPage={name:string;qr:string;lines:string[]};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function loadPosterLogo(){const r=await fetch('/logo.png');if(!r.ok)throw new Error('Logo unavailable');const blob=await r.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
export function batchPosterDocument(logo:string,pages:PosterPage[],settings:{size:number;weight:number;design:string;scan:string}){
  return `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>AE Merchant Posters</title><style>${posterCss}\n.ae-poster-export .ae-counter-poster{break-after:page;page-break-after:always}.ae-poster-export .ae-counter-poster:last-child{break-after:auto;page-break-after:auto}</style></head><body class="ae-poster-export">${pages.map(page=>`<article class="ae-counter-poster ae-poster-${escape(settings.design)} ae-poster-accents ae-scan-pill" style="--poster-size:${settings.size}pt;--poster-weight:${settings.weight};--poster-align:center"><div class="ae-poster-paper"><img class="ae-poster-logo" src="${logo}" alt="AE"><div class="ae-poster-divider"></div><h1 class="ae-poster-headline">${page.lines.map(line=>`<span>${escape(line)}</span>`).join('')}</h1><div class="ae-poster-scan">${escape(settings.scan)}</div><div class="ae-poster-qr"><img src="${page.qr}" alt="Merchant QR"></div><div class="ae-poster-shop">${escape(page.name)}</div><div class="ae-poster-divider"></div><div class="ae-poster-wave"></div></div></article>`).join('')}</body></html>`;
}
