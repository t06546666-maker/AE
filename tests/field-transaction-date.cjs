const assert=require('node:assert/strict');
const {transactionDateBounds}=require('../backend/field-transaction-date.cjs');
assert.deepEqual(transactionDateBounds('2026-11-14'),{start:'2026-11-13T18:30:00.000Z',end:'2026-11-14T18:30:00.000Z'});
assert.deepEqual(transactionDateBounds('2024-02-29'),{start:'2024-02-28T18:30:00.000Z',end:'2024-02-29T18:30:00.000Z'});
assert.equal(transactionDateBounds(''),null);
for(const value of ['2026-02-29','2026-11-31','2026-13-01','14-11-2026',['2026-11-14']])assert.throws(()=>transactionDateBounds(value));
console.log('PASS: IST day boundaries, leap day, all dates and invalid transaction dates');
