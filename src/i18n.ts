import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import english from '../backend/locales/en.json';
import malayalam from '../backend/locales/ml.json';

const languages = ['en', 'ml'] as const;
const cacheKey = (language: string) => `ae-language-pack-v1-${language}`;
function savedLanguage() { try { const saved = localStorage.getItem('ae_language'); return saved ? (saved.startsWith('ml') ? 'ml' : 'en') : 'ml'; } catch { return 'ml'; } }
function validPack(value: unknown): value is Record<string,string> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([key,text]) => !['__proto__','prototype','constructor'].includes(key) && typeof text === 'string');
}
function cached(language: string, fallback: Record<string,string>) {
  try { const pack=JSON.parse(localStorage.getItem(cacheKey(language)) || 'null'); return validPack(pack) ? mergePack(language, fallback, pack) : fallback; } catch { return fallback; }
}
function mergePack(language: string, fallback: Record<string,string>, pack: Record<string,string>) {
  // Old cached/server packs may still contain untranslated English. Never let
  // those replace Malayalam that already ships with the installed application.
  const entries = Object.entries(pack).filter(([key,text]) => language !== 'ml' || !/[\u0d00-\u0d7f]/.test(fallback[key] || '') || /[\u0d00-\u0d7f]/.test(text));
  return { ...fallback, ...Object.fromEntries(entries) };
}
void i18n.use(initReactI18next).init({
  resources: { en: { translation: cached('en', english) }, ml: { translation: cached('ml', malayalam) } },
  lng: savedLanguage(), supportedLngs: [...languages], fallbackLng: 'en',
  keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false },
});
const apiRoot = Capacitor.isNativePlatform() ? import.meta.env.VITE_AE_ENV === 'staging' ? import.meta.env.VITE_API_URL || '' : 'https://www.affiliateae.co.in' : window.location.hostname.endsWith('affiliateae.co.in') ? '' : import.meta.env.VITE_API_URL || '';
const inFlight = new Map<string,Promise<void>>();
export function refreshLanguagePack(language: string) {
  const locale = language.startsWith('ml') ? 'ml' : 'en';
  if (inFlight.has(locale)) return inFlight.get(locale)!;
  const request = (async () => {
    try {
      const response=await fetch(`${apiRoot}/api/languages/${locale}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if(!response.ok) return;
      const result=await response.json();
      if(result.locale!==locale || result.schemaVersion!==1 || !validPack(result.translations)) return;
      i18n.addResourceBundle(locale,'translation',mergePack(locale, locale === 'ml' ? malayalam : english, result.translations),true,true);
      try { localStorage.setItem(cacheKey(locale),JSON.stringify(result.translations)); } catch { /* Offline fallback remains bundled. */ }
      if(i18n.resolvedLanguage===locale) i18n.emit('loaded', { [locale]: { translation: true } });
    } catch { /* Keep cached or bundled text while offline. */ }
  })().finally(()=>inFlight.delete(locale));
  inFlight.set(locale,request);
  return request;
}
i18n.on('languageChanged', language => {
  const locale=language.startsWith('ml') ? 'ml' : 'en';
  try { localStorage.setItem('ae_language',locale); } catch { /* Private storage may be unavailable. */ }
  document.documentElement.lang=locale;
  void refreshLanguagePack(locale);
});
document.documentElement.lang=savedLanguage();
// The bundled language strings are available immediately. Refresh only the
// active language at startup; the other pack is fetched when the user switches.
void refreshLanguagePack(i18n.language);
window.setInterval(()=>{ if(!document.hidden) void refreshLanguagePack(i18n.language); },5*60_000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) void refreshLanguagePack(i18n.language); });
export default i18n;
