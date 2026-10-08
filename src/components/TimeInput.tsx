import { useId } from 'react';

// Keep the API's HH:mm value, but always offer an explicit 12-hour picker.
export function TimeInput({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const id = useId();
  const hour = value ? Number(value.slice(0, 2)) : null;
  const minute = value ? value.slice(3, 5) : '';
  const period = hour !== null && hour >= 12 ? 'PM' : 'AM';
  const update = (h: string, m: string, p: string) => {
    if (!h) { onChange(''); return; }
    const clockHour = Number(h) % 12 + (p === 'PM' ? 12 : 0);
    onChange(`${String(clockHour).padStart(2, '0')}:${m || '00'}`);
  };
  return <span style={{ display: 'flex', gap: 6 }}>
    <select id={id} aria-label="Hour" required={required} value={hour === null ? '' : String(hour % 12 || 12)} onChange={event => update(event.target.value, minute, period)}>
      <option value="">Hour</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
    </select>
    <select aria-label="Minute" value={minute} onChange={event => update(hour === null ? '12' : String(hour % 12 || 12), event.target.value, period)}>
      <option value="">Min</option>{Array.from({ length: 60 }, (_, i) => <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>)}
    </select>
    <select aria-label="AM or PM" value={period} onChange={event => update(hour === null ? '12' : String(hour % 12 || 12), minute, event.target.value)}><option>AM</option><option>PM</option></select>
  </span>;
}

export function DateTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [date = '', time = ''] = value.split('T');
  return <span style={{ display: 'grid', gap: 8 }}>
    <input aria-label="Date" required type="date" value={date} onChange={event => onChange(event.target.value ? `${event.target.value}T${time}` : '')} />
    <TimeInput required value={time} onChange={next => onChange(`${date}T${next}`)} />
    <small>India Standard Time (IST)</small>
  </span>;
}
