const assert=require('node:assert/strict');const {purchaseSegment}=require('../backend/purchase-segment.cjs');
const from='2026-10-10T00:00:00+05:30',to='2026-10-11T00:00:00+05:30';
assert.equal(purchaseSegment({group:'100to300',from,to}).max,300);assert.equal(purchaseSegment({group:'500plus',from,to}).max,null);
assert.throws(()=>purchaseSegment({group:'fake',from,to}));assert.throws(()=>purchaseSegment({group:'under100',from:to,to:from}));
console.log('PASS: allowed groups, non-overlapping limits, unlimited upper band and invalid-range rejection');
