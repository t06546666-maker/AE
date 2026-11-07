const assert=require('node:assert/strict');
const crypto=require('node:crypto');const jwt=require('jsonwebtoken');
const {reminder,verifyScheduler,registerMerchantReminders}=require('../backend/merchant-daily-reminders.cjs');
async function run(){
 assert.equal(reminder(new Date('2026-11-07T03:29:59Z')),null);
 assert.equal(reminder(new Date('2026-11-07T03:30:00Z')).title,'Good morning! ☀️');
 assert.equal(reminder(new Date('2026-11-07T07:30:00Z')).title,'Good afternoon! 👋');
 assert.equal(reminder(new Date('2026-11-07T12:30:00Z')).title,'Good evening! 🌇');
 assert.equal(reminder(new Date('2026-11-07T04:30:00Z')).slot,'morning');
 assert.equal(reminder(new Date('2026-11-07T07:29:59Z')).slot,'morning');
 assert.equal(reminder(new Date('2026-11-07T12:29:59Z')).slot,'afternoon');
 assert.equal(reminder(new Date('2026-11-07T14:13:19Z')).slot,'evening');
 assert.equal(reminder(new Date('2026-11-07T15:29:59Z')).slot,'evening');
 assert.equal(reminder(new Date('2026-11-07T15:30:00Z')),null);
 assert.equal(reminder(new Date('2026-11-08T00:00:00Z')),null);
 assert.equal(reminder(new Date('2026-11-06T03:30:00Z')),null);
 assert.notEqual(reminder(new Date('2026-11-07T03:30:00Z')).body,reminder(new Date('2026-11-08T03:30:00Z')).body);
 assert.equal(reminder(new Date('2026-11-07T03:30:00Z')).body,reminder(new Date('2026-11-14T03:30:00Z')).body);
 const copy=require('../backend/merchant-reminder-messages.json');
 let total=0;
 for(const slot of ['morning','afternoon','evening']){
  assert.equal(copy[slot].messages.length,7);assert.equal(new Set(copy[slot].messages).size,7);
  for(let day=0;day<14;day++){
   const time=new Date(Date.parse(copy.rotationStart+'T00:00:00Z')+day*86400000+(copy[slot].hour*60-330)*60000);
   const value=reminder(time);assert.equal(value.slot,slot);assert.equal(value.title,copy[slot].title);assert.equal(value.body,copy[slot].messages[day%7]);assert.equal(value.url,copy[slot].url);
  }
  total+=copy[slot].messages.length;
 }
 assert.equal(total,21);
 const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'test'};
 const claims={repository:'t06546666-maker/AE',repository_id:'1287086199',ref:'refs/heads/main',workflow_ref:'t06546666-maker/AE/.github/workflows/merchant-daily-reminders.yml@refs/heads/main',event_name:'schedule'};
 const sign=extra=>jwt.sign({...claims,...extra},privateKey,{algorithm:'RS256',keyid:'test',issuer:'https://token.actions.githubusercontent.com',audience:'ae-merchant-daily-reminders',subject:'repo:t06546666-maker/AE:ref:refs/heads/main',expiresIn:'5m'});
 const fetcher=async()=>({ok:true,json:async()=>({keys:[jwk]})});await verifyScheduler(sign({}),fetcher);
 for(const extra of [{repository_id:'another'},{ref:'refs/heads/other'},{workflow_ref:'other.yml'},{event_name:'pull_request'}])await assert.rejects(()=>verifyScheduler(sign(extra),fetcher));
 await assert.rejects(()=>verifyScheduler(jwt.sign({},'wrong',{algorithm:'HS256'}),fetcher));
 let handler,sends=0,created=0;const locks=new Map();
 const records=new Map();
 const db={collection(name){return {doc(id){const key=name+'/'+id;return {async get(){return {exists:records.has(key),data:()=>records.get(key)};},async create(data){if(locks.has(key)){const error=Error('exists');error.code=6;throw error;}locks.set(key,data);records.set(key,data);created++;},async set(data,options){records.set(key,options?.merge?{...records.get(key),...data}:data);},collection(child){return db.collection(key+'/'+child)}};}};}};
 const profiles=[{id:'p1',push_token:'one'},{id:'p2',push_token:'one'},{id:'p3',push_token:'off',push_enabled:false},{id:'p4'}];
 const supabase={from(table){return {select(){return this},order(){return this},limit(){return this},gt(){return this},eq(){return this},in(){return this},then(resolve){resolve({data:table==='active_merchants'?[{id:'shop'}]:profiles})}}}};
 let instant=new Date('2026-11-07T03:30:00Z');
 let event='schedule';registerMerchantReminders({post(route,fn){handler=fn}},{supabase,firestore:async()=>db,getTarget:async(id,p)=>p,send:async()=>{sends++;return true},verify:async token=>{if(token==='bad')throw Error('bad');return {event_name:event}},now:()=>instant});
 const call=async(body={},token='good')=>{let code=200,data;await handler({body,headers:{authorization:'Bearer '+token}},{status(c){code=c;return this},json(d){data=d;return this}});return {code,data}};
 assert.equal((await call({},'bad')).code,401);assert.equal(created,0);
 const preview=await call({dryRun:true});assert.equal(preview.data.counts.eligible,1);assert.equal(preview.data.counts.disabled,1);assert.equal(preview.data.counts.missingToken,1);assert.equal(created,0);assert.equal(sends,0);
 event='workflow_dispatch';assert.equal((await call()).code,403);event='schedule';
 await Promise.all([call(),call()]);assert.equal(sends,1);assert.equal(created,1);
 const repeat=await call();assert.equal(repeat.data.alreadyCompleted,true);assert.equal(sends,1);
 profiles[0].push_token='refreshed';profiles[1].push_token='refreshed';assert.equal((await call()).data.alreadyCompleted,true);assert.equal(sends,1);
 instant=new Date('2026-11-07T14:13:19Z');const delayed=await call();assert.equal(delayed.data.slot,'evening');assert.equal(delayed.data.counts.accepted,1);assert.equal(sends,2);assert.equal((await call()).data.alreadyCompleted,true);assert.equal(sends,2);
 instant=new Date('2026-11-07T15:30:00Z');assert.equal((await call()).data.outsideWindow,true);assert.equal(sends,2);
 instant=new Date('2026-11-08T03:30:00Z');await call();assert.equal(sends,3);
 instant=new Date('2026-11-08T07:30:00Z');profiles.length=0;await call();assert.equal(records.get('ae_merchant_daily_reminder_runs/2026-11-08-afternoon').completed,true);assert.equal(sends,3);
 console.log('PASS: IST schedule boundaries, weekly rotation, signed identity and branch/workflow restrictions, dry-run isolation, opt-outs and concurrent duplicate prevention');
}
run().catch(error=>{console.error(error);process.exitCode=1});
