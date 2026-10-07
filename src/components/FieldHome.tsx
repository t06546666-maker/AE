import { Link } from 'react-router-dom';
import { Building2, ChevronRight, ClipboardCheck, FileText, MapPin, Route, Store } from 'lucide-react';

export function FieldHome({ name }: { name: string }) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const actions = [
    { section: 'attendance', title: 'Attendance', detail: 'Start and end your day', Icon: ClipboardCheck },
    { section: 'onboarding', title: 'Onboard Merchant', detail: 'Add new merchant', Icon: Store },
    { section: 'directory', title: 'All Merchants', detail: 'View and manage', Icon: Building2 },
    { section: 'visits', title: 'Visits & Check-in', detail: 'Check in at locations', Icon: MapPin },
    { section: 'routes', title: 'Routes', detail: 'View your route plan', Icon: Route },
  ];
  return <section className="field-home">
    <header className="field-home-hero"><div><small>FIELD MANAGER</small><h1>{greeting},<br />{name}</h1><p>Your merchants. Your route. Your day.</p></div>
      <svg className="field-home-art" viewBox="0 0 230 180" aria-hidden="true"><defs><linearGradient id="fm-pin" x2="1" y2="1"><stop stopColor="#68bcff" /><stop offset="1" stopColor="#0064ff" /></linearGradient></defs><ellipse cx="120" cy="145" rx="105" ry="26" fill="#a8d9ff" opacity=".28" /><path d="M38 130 Q76 160 112 116 T193 131" fill="none" stroke="#1677ff" strokeWidth="3" strokeDasharray="5 6" />{[20,160].map(x => <g key={x} transform={`translate(${x} 100)`}><rect width="46" height="36" rx="6" fill="#9aceff" /><path d="M-5 0 L4-15 H41L51 0Z" fill="#69aeff" /><rect x="8" y="10" width="12" height="26" rx="2" fill="#5c9dec" /><rect x="28" y="10" width="11" height="11" rx="2" fill="#d8efff" /></g>)}<path d="M115 28 C75 28 72 67 91 89 L115 117 L139 89 C158 67 155 28 115 28Z" fill="url(#fm-pin)" /><circle cx="115" cy="57" r="13" fill="#e8f7ff" /></svg>
    </header>
    <div className="field-home-actions">{actions.map(({ section, title, detail, Icon }) => <Link to={`/field?section=${section}`} key={section}><span className="field-home-icon"><Icon size={26} /></span><ChevronRight className="field-home-chevron" size={18} /><strong>{title}</strong><small>{detail}</small></Link>)}</div>
  </section>;
}
