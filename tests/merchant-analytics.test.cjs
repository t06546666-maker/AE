const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
// Compile only the pure calculation module in memory; no application build/output.
const filename = path.resolve(__dirname, '../src/pages/merchantAnalytics.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const modelModule = new Module(filename, module);
modelModule._compile(compiled.outputText, filename);
const { buildMerchantAnalytics, changePercent, indiaDate, previousMonth, monthDays } = modelModule.exports;
const now = new Date('2026-09-20T12:00:00Z');
const order = (id, cid, timestamp, amount = 100) => ({ id, cid, customer: cid, phone: '', timestamp, amount, orderNo: id });
const customer = id => ({ id, name: id, phone: '', registeredAt: '2026-08-01T00:00:00Z' });
const orders = [order('a3', 'a', '2026-09-15T10:00:00Z'), order('b1', 'b', '2026-09-05T10:00:00Z', 200), order('a1', 'a', '2026-08-02T10:00:00Z'), order('a2', 'a', '2026-09-01T10:00:00Z'), order('b2', 'b', '2026-09-08T10:00:00Z', 300), order('late', 'a', '2026-10-01T10:00:00Z')];
test('monthly cohorts are unique and add up to total even with repeat purchases', () => {
  const m = buildMerchantAnalytics(orders, [customer('a'), customer('b'), customer('zero')], '2026-09', now);
  assert.equal(m.current.active.length, 2); assert.equal(m.current.fresh.length, 1); assert.equal(m.current.returning.length, 1);
  assert.equal(m.current.orders.length, 4); assert.equal(m.current.sales, 700); assert.equal(m.current.average, 175);
  assert.equal(m.current.repeat.length, 2); assert.equal(m.current.loyal.length, 1);
  assert.equal(m.newSpend + m.returningSpend, m.current.sales);
});
test('customer list includes zero-purchase registrations and sorts visit history', () => {
  const m = buildMerchantAnalytics([...orders].reverse(), [customer('zero')], '2026-09', now);
  assert.equal(m.customers.length, 3); assert.equal(m.customers.find(c => c.id === 'zero').spend, 0);
  assert.equal(m.customers.find(c => c.id === 'a').first, '2026-08-02T10:00:00Z');
  assert.equal(m.customers.find(c => c.id === 'a').visits[0].id, 'a3');
});
test('historical loyalty does not leak later purchases', () => {
  const m = buildMerchantAnalytics(orders, [], '2026-08', now);
  assert.equal(m.current.active.length, 1); assert.equal(m.current.repeat.length, 0); assert.equal(m.current.loyal.length, 0);
});
test('growth is cumulative, distinct, and stops at today for the current month', () => {
  const m = buildMerchantAnalytics(orders, [], '2026-09', now);
  assert.equal(m.growth.length, 20); assert.equal(m.growth[0].total, 1); assert.equal(m.growth[4].total, 2);
  assert.equal(m.growth.at(-1).total, m.current.active.length);
  m.growth.forEach(p => assert.equal(p.total, p.fresh + p.returning));
});
test('current month compares like-for-like days rather than a full prior month', () => {
  const m = buildMerchantAnalytics([...orders, order('aug-late', 'z', '2026-08-25T12:00:00Z', 999)], [], '2026-09', now);
  assert.equal(m.previous.sales, 100); assert.match(m.comparisonLabel, /first 20 days/);
});
test('heatmap uses IST day and all purchases are counted exactly once', () => {
  const m = buildMerchantAnalytics([order('midnight', 'a', '2026-08-31T20:00:00Z')], [], '2026-09', now);
  assert.equal(indiaDate('2026-08-31T20:00:00Z'), '2026-09-01');
  assert.equal(m.heat[1][0], 1); assert.equal(m.heat.flat().reduce((a, b) => a + b, 0), 1);
});
test('empty data has no invented growth, busiest day, or percentages', () => {
  const m = buildMerchantAnalytics([], [], '2026-09', now);
  assert.equal(m.current.average, 0); assert.equal(m.busiestDay, -1); assert.equal(changePercent(10, 0), null);
  assert.ok(m.growth.every(p => p.total === 0)); assert.equal(changePercent(90, 100), -10);
});
test('month boundaries include leap years and prior December', () => {
  assert.equal(previousMonth('2026-01'), '2025-12'); assert.equal(monthDays('2024-02'), 29);
  const m = buildMerchantAnalytics([], [], '2026-03', new Date('2026-03-31T10:00:00Z'));
  assert.match(m.comparisonLabel, /first 28 days/);
});
test('invalid and future-dated orders are ignored', () => {
  const m = buildMerchantAnalytics([order('invalid', 'a', 'invalid'), order('future', 'a', '2026-10-01T00:00:00Z')], [], '2026-09', now);
  assert.equal(m.current.sales, 0); assert.equal(m.customers.length, 0);
});
