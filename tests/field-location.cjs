const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {checkinDay,checkinPins}=require('../backend/field-checkin-map.cjs');
assert.deepEqual(checkinDay('2026-10-19'),{from:'2026-10-18T18:30:00.000Z',to:'2026-10-19T18:30:00.000Z'});
for(const day of ['2026-02-30','bad','2026-1-01',null])assert.equal(checkinDay(day),null);
const pins=checkinPins([{id:'a',started_at:'2026-10-19T03:00:00Z',latitude:0,longitude:0,accuracy_m:10}],[{id:'2',check_in_at:'2026-10-19T05:00:00Z',check_in_latitude:10,check_in_longitude:76},{id:'1',check_in_at:'2026-10-19T04:00:00Z',check_in_latitude:10,check_in_longitude:76,merchants:{name:'<unsafe shop>'}},{id:'missing',check_in_at:'2026-10-19T04:30:00Z',check_in_latitude:null,check_in_longitude:null}]);
assert.deepEqual(pins.pins.map(pin=>[pin.number,pin.id]),[[1,'attendance-a'],[2,'visit-1'],[3,'visit-2']]);
assert.equal(pins.missingLocations,1);assert.equal(pins.pins[0].latitude,0);assert.equal(pins.pins[1].name,'<unsafe shop>');
const server=fs.readFileSync('server.js','utf8');
const start=server.indexOf("app.get('/api/admin/field-managers/:id/check-in-map'");
const end=server.indexOf("app.get('/api/admin/field-managers/:id/profile'",start);const source=server.slice(start,end);
assert.ok(source.includes("requireRole('admin')"));
assert.ok(!fs.readFileSync('src/App.tsx','utf8').includes('FieldLocationSharing'));
const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
for(const permission of ['ACCESS_BACKGROUND_LOCATION','FOREGROUND_SERVICE','FOREGROUND_SERVICE_LOCATION'])assert.ok(manifest.includes('android.permission.'+permission+'" tools:node="remove"'));
assert.ok(!manifest.includes('FieldLocationForegroundService'));
assert.ok(!fs.readFileSync('android/app/src/main/java/com/affiliateae/app/MainActivity.java','utf8').includes('FieldLocationServicePlugin'));
assert.ok(fs.readFileSync('src/components/FieldAttendance.tsx','utf8').includes('maximumAge: 0'));
const component=fs.readFileSync('src/components/AdminCheckinMap.tsx','utf8');assert.ok(component.includes('heading.textContent'));assert.ok(!component.includes('innerHTML'));assert.ok(component.includes('marker.setMap(null)'));
assert.ok(fs.readFileSync('src/components/AdminFieldDetails.tsx','utf8').includes('<AdminCheckinMap key={id} managerId={id}/>'));
async function run(){
 let handler,calls=[];
 const visitRows=Array.from({length:501},(_,i)=>({id:String(i),check_in_at:'2026-10-19T05:00:00Z',check_in_latitude:10,check_in_longitude:76}));
 const db={from(table){let lo=0,hi=499;const filters=[];const q={select(){return q},eq(...args){filters.push(args);return q},gte(...args){filters.push(args);return q},lt(...args){filters.push(args);return q},order(){return q},range(a,b){lo=a;hi=b;return q},maybeSingle(){return Promise.resolve({data:{id:'manager-a'}})},then(resolve,reject){calls.push({table,filters,lo,hi});return Promise.resolve({data:table==='field_manager_visits'?visitRows.slice(lo,hi+1):[]}).then(resolve,reject)}};return q}};
 vm.runInNewContext(source,{app:{get(_url,...args){handler=args.at(-1)}},requireAuth(){},requireRole(){return()=>{}},checkinDay,checkinPins,supabaseAdmin:db});
 let status=200,body;const res={status(code){status=code;return this},json(value){body=value;return this},setHeader(){}};
 await handler({params:{id:'manager-a'},query:{day:'bad'}},res);assert.equal(status,400);assert.equal(calls.length,0);
 status=200;await handler({params:{id:'manager-a'},query:{day:'2026-10-19'}},res);assert.equal(status,200);assert.equal(body.pins.length,501);
 for(const call of calls){assert.ok(call.filters.some(([key,value])=>key==='manager_id'&&value==='manager-a'));assert.ok(call.filters.some(([,value])=>value==='2026-10-18T18:30:00.000Z'));}
 assert.ok(calls.some(call=>call.table==='field_manager_visits'&&call.lo===500));
 console.log('PASS: check-in map date bounds, ordered pins, missing GPS, manager isolation, pagination, no background service and fresh attendance GPS.');
}
run().catch(error=>{console.error(error);process.exitCode=1});
