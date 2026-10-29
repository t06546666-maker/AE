const fs=require('node:fs');
const path='src/pages/MerchantOverview.tsx';
let source=fs.readFileSync(path,'utf8');
const before='<label className="mo-month"><CalendarDays size={17} /><span>{new Date(`${month}-01T00:00:00`).toLocaleDateString(\'en-IN\', { month: \'short\', year: \'numeric\' })}</span><input aria-label={uiText("Reporting month")} type="month" min="2000-01" max={currentMonth} value={month} onChange={e => { if (e.target.value) { const next = new URLSearchParams(params); next.set(\'month\', e.target.value); setParams(next, { replace: true }); } }} /></label>';
const after='<ReportingMonth value={month} maximum={currentMonth} onChange={value => { const next = new URLSearchParams(params); next.set("month", value); setParams(next, { replace:true }); }} />';
if (!source.includes(before)) throw new Error('Month selector source has changed; no files edited.');
source=source.replace(before,after);
source="import { ReportingMonth } from '../components/ReportingMonth';\n"+source;
fs.writeFileSync(path,source);
