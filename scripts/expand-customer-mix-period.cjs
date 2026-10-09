const fs = require('node:fs');
const path = 'src/pages/MerchantOverview.tsx';
let source = fs.readFileSync(path, 'utf8');
const before = '<select aria-label={uiText("Customer mix period")} value={mixPeriod} onChange={event => setMixPeriod(event.target.value as typeof mixPeriod)}><option value="week">{uiText("This Week")}</option><option value="month">{uiText("This Month")}</option></select>';
const after = '<div><select aria-label={uiText("Customer mix period")} value={mixPeriod} onChange={event => setMixPeriod(event.target.value as typeof mixPeriod)}><option value="today">{uiText("Today")}</option><option value="week">{uiText("This Week")}</option><option value="month">{uiText("This Month")}</option><option value="date">{uiText("Choose Date")}</option></select>{mixPeriod === "date" && <input type="date" aria-label={uiText("Choose Date")} value={mixDate} max={indiaDate(new Date())} onChange={event => { if(event.target.value) setMixDate(event.target.value); }} />}</div>';
if (source.includes(before)) fs.writeFileSync(path, source.replace(before, after));
else if (!source.includes(after)) throw new Error('Expected customer mix selector not found');
