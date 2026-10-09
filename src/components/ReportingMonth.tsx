import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uiText } from '../uiText';

export function ReportingMonth({ value, maximum, onChange }: { value: string; maximum: string; onChange: (value: string) => void }) {
  const { i18n } = useTranslation();
  const year = Number(value.slice(0,4));
  const month = Number(value.slice(5));
  const maxYear = Number(maximum.slice(0,4)), maxMonth = Number(maximum.slice(5));
  const locale = i18n.resolvedLanguage === 'ml' ? 'ml-IN' : 'en-IN';
  return <div className="mo-month mo-month-select"><CalendarDays size={17} aria-hidden="true" />
    <select aria-label={uiText('Reporting month')} value={month} onChange={event => onChange(`${year}-${String(event.target.value).padStart(2,'0')}`)}>
      {Array.from({length:year === maxYear ? maxMonth : 12},(_,index) => <option key={index+1} value={index+1}>{new Date(2020,index,1).toLocaleDateString(locale,{month:'short'})}</option>)}
    </select>
    <select aria-label={uiText('Reporting year')} value={year} onChange={event => { const nextYear=Number(event.target.value); const nextMonth=nextYear === maxYear ? Math.min(month,maxMonth) : month; onChange(`${nextYear}-${String(nextMonth).padStart(2,'0')}`); }}>
      {Array.from({length:maxYear-1999},(_,index)=>maxYear-index).map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>;
}
