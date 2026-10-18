import i18n from './i18n';

// For interface copy only. Do not pass customer/shop names, IDs or stored values.
export function uiText(value: string | number | undefined, values: Record<string, string | number> = {}) {
  const source=String(value ?? '');
  const normalized=source.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (_match, entity: string) => ({ amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'",'#x27':"'" }[entity] || _match)).replace(/\s+/g,' ').trim();
  const key=`ui.${normalized}`;
  // Variable chart labels must use stable translation keys, not English-only
  // keys containing a different number for every week/reporting period.
  const week = /^Week (\d+)$/.exec(normalized);
  if (week) return uiText('Week {{count}}', { count: week[1] });
  const comparison = /^vs first (\d+) days of last month$/.exec(normalized);
  if (comparison) return uiText('vs first {{count}} days of last month', { count: comparison[1] });
  if(i18n.resolvedLanguage==='ml' && /^Good (afternoon|evening)!/.test(normalized)) {
    const base=normalized.replace(/^Good (afternoon|evening)/,'Good morning');
    if(i18n.exists(`ui.${base}`,{lng:'ml'})) {
      const morning=String(i18n.t('ui.Good morning',{defaultValue:'സുപ്രഭാതം'}));
      const greeting=String(i18n.t(normalized.startsWith('Good afternoon')?'ui.Good afternoon':'ui.Good evening'));
      return String(i18n.t(`ui.${base}`,values)).replace(morning,greeting);
    }
  }
  const translated=String(i18n.t(key,{defaultValue:normalized,...values}));
  return `${/^\s/.test(source)?' ':''}${translated}${/\s$/.test(source)?' ':''}`;
}
