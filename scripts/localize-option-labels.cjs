// Localize display labels without changing the values persisted by forms.
const fs = require('node:fs');
for (const path of ['src/components/FieldAttendance.tsx', 'src/pages/FieldMerchantVisit.tsx']) {
  const source = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, source.replaceAll('<option key={item}>{item}</option>', '<option key={item} value={item}>{uiText(item)}</option>'));
}
for (const path of ['src/components/RedemptionModal.tsx', 'src/pages/Dashboard.tsx']) {
  const source = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, source.replace(/[\t ]+\r?$/gm, ''));
}
