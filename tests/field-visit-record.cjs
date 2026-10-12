const assert=require('node:assert/strict');
const {fieldVisitRecord}=require('../backend/field-visit-record.cjs');
const old=fieldVisitRecord({id:'old',status:'active',merchants:{name:'Store',merchant_code:'M1',secret:'hidden'},password:'hidden',future_private:'hidden'});
assert.equal(old.outcome,null);assert.equal(old.follow_up_date,null);assert.equal(old.problems,null);assert.equal(old.feedback,null);
assert.equal(old.password,undefined);assert.equal(old.future_private,undefined);assert.equal(old.merchants.secret,undefined);
const current=fieldVisitRecord({id:'new',outcome:'Completed',follow_up_date:'2026-10-12',photos:['https://example.com/photo']});
assert.equal(current.outcome,'Completed');assert.equal(current.follow_up_date,'2026-10-12');assert.equal(current.photos.length,1);
console.log('PASS: old and current visit schema projection; optional fields stay null and unknown sensitive columns are omitted');
