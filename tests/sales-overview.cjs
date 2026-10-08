const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => imports[name] || require(name), m.exports, m);
  return m.exports;
}
const utils = load('src/utils.ts');
const { salesOverviewBuckets } = load('src/pages/salesOverview.ts', { '../utils': utils });
const range = (from, to) => ({ from: `${from}T00:00:00+05:30`, to: `${to}T00:00:00+05:30` });
const order = (timestamp, amount) => ({ timestamp, amount });
const today = salesOverviewBuckets([
  order('2026-10-08T00:00:00+05:30', 10), order('2026-10-08T06:00:00+05:30', 20),
  order('2026-10-08T12:00:00+05:30', 30), order('2026-10-08T18:00:00+05:30', 40),
  order('2026-10-09T00:00:00+05:30', 999), order('invalid', 999),
], 'today', range('2026-10-08', '2026-10-09'), Date.parse('2026-10-08T23:59:59+05:30'));
assert.deepEqual(today.map(b => b.sales), [10, 20, 30, 40]);
assert.deepEqual(today.map(b => b.label), utils.SIX_HOUR_LABELS);
const week = salesOverviewBuckets([order('2026-10-05T12:00:00+05:30', 50), order('2026-10-11T12:00:00+05:30', 70)], 'week', range('2026-10-05', '2026-10-12'), Infinity);
assert.deepEqual(week.map(b => b.sales), [50, 0, 0, 0, 0, 0, 70]);
const month = salesOverviewBuckets([order('2026-10-01T12:00:00+05:30', 100), order('2026-10-08T12:00:00+05:30', 200), order('2026-10-31T12:00:00+05:30', 300)], 'month', range('2026-10-01', '2026-11-01'), Infinity);
assert.deepEqual(month.map(b => b.sales), [100, 200, 0, 0, 300]);
assert.equal(month[4].label, 'Week 5');
const future = salesOverviewBuckets([order('2026-10-08T18:00:00+05:30', 500)], 'today', range('2026-10-08', '2026-10-09'), Date.parse('2026-10-08T12:00:00+05:30'));
assert.equal(future.reduce((sum, b) => sum + b.sales, 0), 0);
console.log('Passed: today/week/month sales, IST boundaries, final partial week and future exclusion.');
