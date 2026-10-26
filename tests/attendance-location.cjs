const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const scope={exports:{},setTimeout,clearTimeout};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/attendanceLocation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,scope);
const get=scope.exports.getAttendanceLocation;
const valid={coords:{latitude:10.7,longitude:76.7,accuracy:150},timestamp:Date.now()};
async function run(){
 let calls=0,attempts=[],options=[];
 const location={getCurrentPosition(ok,fail,opts){options.push(opts);calls++;calls<3?fail({code:3}):ok(valid)}};
 assert.equal(await get(location,n=>attempts.push(n)),valid);assert.equal(calls,3);assert.deepEqual(attempts,[1,2,3]);assert.deepEqual(options.map(x=>x.enableHighAccuracy),[true,true,false]);assert.ok(options.every(x=>x.maximumAge===0&&x.timeout===10000));
 calls=0;await assert.rejects(get({getCurrentPosition(ok,fail){calls++;fail({code:3})}}),/after 3 attempts/);assert.equal(calls,3);
 calls=0;await assert.rejects(get({getCurrentPosition(ok,fail){calls++;fail({code:1})}}),/Allow location access/);assert.equal(calls,1);
 await assert.rejects(get(undefined),/not supported/);
 calls=0;await assert.rejects(get({getCurrentPosition(ok){calls++;ok({coords:{latitude:NaN,longitude:76,accuracy:1}})}}),/after 3 attempts/);assert.equal(calls,3);
 calls=0;assert.equal(await get({getCurrentPosition(ok){calls++;ok(valid)}}),valid);assert.equal(calls,1);
 scope.setTimeout=fn=>{queueMicrotask(fn);return 1};scope.clearTimeout=()=>{};
 calls=0;await assert.rejects(get({getCurrentPosition(){calls++}}),/after 3 attempts/);assert.equal(calls,3,'Browser callbacks missing must not leave attendance hanging');
 const component=fs.readFileSync('src/components/FieldAttendance.tsx','utf8');assert.ok(component.indexOf('await getAttendanceLocation')<component.indexOf("return apiFetch('/api/field/attendance/start'"));assert.match(component,/role="status"/);
 console.log('PASS: two timeouts then successful third attempt; max three attempts; permission denial stops immediately; invalid/missing location never succeeds; progress and GPS-before-POST ordering');
}
run().catch(error=>{console.error(error);process.exitCode=1});
