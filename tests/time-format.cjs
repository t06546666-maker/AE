const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const m = { exports: {} };
  new Function('require', 'exports', 'module', code)(require, m.exports, m);
  return m.exports;
}
const { formatTime, formatDateTime, formatClockTime, SIX_HOUR_LABELS } = load('src/utils.ts');
for (const zone of ['UTC', 'America/New_York', 'Asia/Kolkata']) {
  process.env.TZ = zone;
  assert.equal(formatTime('2026-10-08T09:00:00Z'), '2:30 PM');
  assert.equal(formatTime('2026-10-07T18:30:00Z'), '12:00 AM');
  assert.equal(formatTime('2026-10-08T06:30:00Z'), '12:00 PM');
  assert.match(formatDateTime('2026-10-07T18:30:00Z'), /08 Oct 2026.*12:00 AM/);
}
for (const [input, expected] of [['00:00', '12:00 AM'], ['09:00', '9:00 AM'], ['12:00', '12:00 PM'], ['14:30:00', '2:30 PM'], ['23:59', '11:59 PM'], ['', '—'], ['25:00', '—']]) assert.equal(formatClockTime(input), expected);
assert.deepEqual(SIX_HOUR_LABELS, ['12 AM–6 AM', '6 AM–12 PM', '12 PM–6 PM', '6 PM–12 AM']);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { TimeInput, DateTimeInput } = load('src/components/TimeInput.tsx');
const html = renderToStaticMarkup(React.createElement(TimeInput, { value: '14:30', onChange: () => {}, required: true }));
assert.match(html, /value="2" selected/);
assert.match(html, /value="30" selected/);
assert.match(html, /selected="">PM/);
const datetime = renderToStaticMarkup(React.createElement(DateTimeInput, { value: '2026-10-08T14:30', onChange: () => {} }));
assert.match(datetime, /India Standard Time/);
assert.doesNotMatch(datetime, /type="(?:time|datetime-local)"/);
console.log('Passed: AM/PM timestamp display, IST across device timezones, shop hours and 12-hour pickers.');
