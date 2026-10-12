const assert=require('node:assert/strict');
const fs=require('node:fs');
const {validFieldLocation}=require('../backend/field-location.cjs');
const now=Date.now(),sample={latitude:10.7,longitude:76.7,accuracy_m:12,captured_at:new Date(now).toISOString()};
assert.ok(validFieldLocation(sample,now));
for(const invalid of [{latitude:91},{longitude:-181},{accuracy_m:-1},{latitude:'10.7'},{accuracy_m:Infinity},{captured_at:new Date(now-121000).toISOString()},{captured_at:new Date(now+121000).toISOString()},{captured_at:'invalid'}])assert.equal(validFieldLocation({...sample,...invalid},now),false);
const server=fs.readFileSync('server.js','utf8');
for(const endpoint of ['/api/field/location/status','/api/field/location','/api/field/location/pause','/api/admin/field-manager-locations']){
 const at=server.indexOf(`('${endpoint}'`);assert.ok(at>=0);
 const header=server.slice(at,at+180);assert.ok(header.includes('requireAuth'));assert.ok(header.includes(`requireRole('${endpoint.includes('/admin/')?'admin':'field_manager'}')`));
}
const component=fs.readFileSync('src/components/FieldLocationSharing.tsx','utf8');
assert.ok(component.includes('!document.hidden'));assert.ok(component.includes("'appStateChange'"));assert.ok(component.includes('if(!allowed())return'));assert.ok(component.includes('status.active'));
const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8');assert.ok(!manifest.includes('ACCESS_BACKGROUND_LOCATION'));
console.log('PASS: fresh GPS validation, authenticated role guards, workday/foreground checks and no background location permission (source checks)');
