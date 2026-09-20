import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'outputs';
await fs.mkdir(outputDir, { recursive: true });
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Client Questions');
sheet.showGridLines = false;
sheet.tabColor = '#26337D';

const rows = [
  ['AE Client Discussion Sheet', '', '', '', ''],
  ['Purpose', 'Capture client decisions for the AE app pilot, future development, reward rules, notifications, and launch plan.', '', '', ''],
  ['', '', '', '', ''],
  ['Area', 'Question for the client', 'Client answer / decision', 'Priority', 'Notes / owner'],
  ['Product direction', 'Are any changes needed in the merchant section?', '', 'High', ''],
  ['Product direction', 'Are any changes needed in the admin section?', '', 'High', ''],
  ['Product direction', 'Which features are required for the first pilot release?', '', 'High', ''],
  ['Customer advertising', 'How should merchants advertise to customers?', '', 'High', ''],
  ['Customer advertising', 'Should advertisements appear on the customer home page?', '', 'Medium', ''],
  ['Customer advertising', 'Do you have any banner, grid, or app design references?', '', 'Medium', ''],
  ['Customer advertising', 'Should advertising be based on location, category, merchant, or all three?', '', 'Medium', ''],
  ['Merchant requirements', 'Should merchants create offers, rewards, and campaigns?', '', 'High', ''],
  ['Merchant requirements', 'Should merchants upload product lists or catalogues?', '', 'Medium', ''],
  ['Merchant requirements', 'Should merchants receive notifications for customer requests?', '', 'High', ''],
  ['Admin dashboard', 'Should admin view all customers, merchants, offers, rewards, and transactions?', '', 'High', ''],
  ['Admin dashboard', 'Which reports and exports are required?', '', 'High', ''],
  ['Admin dashboard', 'Should admin approve offers and campaigns?', '', 'High', ''],
  ['Admin dashboard', 'Which admin sections should be removed or restricted?', '', 'Medium', ''],
  ['Reward points', 'How many points should customers receive for each purchase?', '', 'High', ''],
  ['Reward points', 'Should points be calculated per ₹100, by percentage, or by a fixed rule?', '', 'High', ''],
  ['Reward points', 'What percentage or points conversion should be used?', '', 'High', ''],
  ['Reward points', 'Should each merchant have separate reward rules?', '', 'High', ''],
  ['Reward points', 'Should points expire? If yes, after how long?', '', 'Medium', ''],
  ['Reward points', 'Should customers receive welcome, referral, birthday, or campaign bonus points?', '', 'Medium', ''],
  ['Reward points', 'What are the minimum and maximum redemption limits?', '', 'High', ''],
  ['Push notifications', 'Which events should trigger push notifications?', '', 'High', ''],
  ['Push notifications', 'Should notifications be sent to customers, merchants, admins, or all users?', '', 'High', ''],
  ['Push notifications', 'Should users be able to enable or disable notification categories?', '', 'Medium', ''],
  ['Push notifications', 'Which notification title and message wording should be used?', '', 'Medium', ''],
  ['Push notifications', 'Should notifications open a specific screen when tapped?', '', 'Medium', ''],
  ['WhatsApp', 'Which messages should be sent through WhatsApp?', '', 'High', ''],
  ['WhatsApp', 'Should registration, temporary password, order, reward, offer, and status messages be enabled?', '', 'High', ''],
  ['WhatsApp', 'Do you have the final approved WhatsApp templates?', '', 'High', ''],
  ['WhatsApp', 'What should happen when a WhatsApp message fails?', '', 'Medium', ''],
  ['Testing', 'Is the app working correctly on Android and web?', '', 'High', ''],
  ['Testing', 'Which phone sizes and network conditions should be tested?', '', 'Medium', ''],
  ['Testing', 'Which pages need faster loading or offline retry support?', '', 'Medium', ''],
  ['Launch', 'Which features must be ready for the pilot launch?', '', 'High', ''],
  ['Launch', 'What is the expected launch date?', '', 'High', ''],
  ['Launch', 'Who approves each feature and design decision?', '', 'High', ''],
  ['Launch', 'What is the bug reporting and change request process?', '', 'Medium', ''],
  ['Launch', 'What is the plan for Play Store publishing and production support?', '', 'High', ''],
];

sheet.getRange(`A1:E${rows.length}`).values = rows;
sheet.getRange('A1:E1').format = { fill: '#26337D', font: { color: '#FFFFFF', bold: true, size: 16 }, rowHeight: 30 };
sheet.getRange('A2:E2').format = { font: { italic: true, color: '#475569' }, wrapText: true, rowHeight: 30 };
sheet.getRange('A4:E4').format = { fill: '#4F46E5', font: { color: '#FFFFFF', bold: true }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, rowHeight: 28 };
sheet.getRange(`A5:E${rows.length}`).format = { verticalAlignment: 'center', wrapText: true };
sheet.getRange(`A5:A${rows.length}`).format.font = { bold: true, color: '#1E3A8A' };
sheet.getRange(`C5:C${rows.length}`).format = { fill: '#FFF7D6', wrapText: true, verticalAlignment: 'center' };
sheet.getRange(`D5:D${rows.length}`).format.horizontalAlignment = 'center';
sheet.getRange(`A4:E${rows.length}`).format.borders = { preset: 'outside', style: 'thin', color: '#CBD5E1' };
sheet.getRange('A:A').format.columnWidth = 22;
sheet.getRange('B:B').format.columnWidth = 58;
sheet.getRange('C:C').format.columnWidth = 34;
sheet.getRange('D:D').format.columnWidth = 12;
sheet.getRange('E:E').format.columnWidth = 28;
sheet.getRange(`D5:D${rows.length}`).dataValidation = { rule: { type: 'list', values: ['High', 'Medium', 'Low'] } };
sheet.freezePanes.freezeRows(4);

workbook.recalculate();
await workbook.inspect({ kind: 'table', range: `Client Questions!A1:E12`, include: 'values', tableMaxRows: 12, tableMaxCols: 5 });
const preview = await workbook.render({ sheetName: 'Client Questions', range: 'A1:E18', scale: 1, format: 'png' });
await fs.writeFile(`${outputDir}/client_questions_preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/AE_Client_Discussion_Questions.xlsx`);
