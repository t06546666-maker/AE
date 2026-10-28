const assert=require('node:assert/strict');
const {checkinPins}=require('../backend/field-checkin-map.cjs');
const row={id:'a',started_at:'2026-10-28T03:00:00Z',latitude:10,longitude:76,accuracy_m:8,ended_at:'2026-10-28T12:00:00Z',end_latitude:11,end_longitude:77,end_accuracy_m:24};
const {pins}=checkinPins([row],[]);
assert.equal(pins.length,2);assert.equal(pins[1].kind,'attendance_end');assert.equal(pins[1].accuracy_m,24);assert.equal(pins[1].latitude,11);assert.equal(pins[0].accuracy_m,8);
assert.equal(checkinPins([{...row,end_latitude:null}],[]).pins.length,1);
assert.equal(checkinPins([{...row,end_latitude:999}],[]).pins.length,1);
console.log('PASS: separate ending GPS/accuracy, old records and invalid GPS.');
