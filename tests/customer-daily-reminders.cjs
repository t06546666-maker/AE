const assert=require('node:assert/strict'),crypto=require('node:crypto'),jwt=require('jsonwebtoken');
const {processPage,slotFor,messageFor,usedApp,verifyScheduler}=require('../backend/customer-daily-reminders.cjs');
const bank=require('../backend/customer-daily-messages.json'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function database(){const rows=new Map();const snap=key=>({exists:rows.has(key),data:()=>rows.get(key)});function ref(key){return{get:async()=>snap(key),create:async value=>{if(rows.has(key))throw Object.assign(Error('exists'),{code:6});rows.set(key,structuredClone(value));},set:async value=>rows.set(key,{...rows.get(key),...structuredClone(value)}),update:async value=>rows.set(key,{...rows.get(key),...structuredClone(value)}),collection:name=>collection(key+'/'+name)}}function collection(path){return{doc:id=>ref(path+'/'+id),get:async()=>({docs:[...rows.entries()].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([key])=>({id:key.split('/').at(-1),data:()=>rows.get(key)}))})}}return{rows,collection};}
async function run(){
 for(const values of Object.values(bank.groups))assert.equal(new Set(values).size,7);
 assert.equal(slotFor(new Date('2026-11-12T04:29:59Z')),null);assert.equal(slotFor(new Date('2026-11-12T04:30:00Z')).slot,'morning');assert.equal(slotFor(new Date('2026-11-12T11:30:00Z')).slot,'evening');assert.equal(slotFor(new Date('2026-11-12T13:30:00Z')),null);
 assert(usedApp({platforms:{android:true}}));assert(!usedApp({platforms:{web:true},lastSeen:'2026-11-12'}));
 const customer={created_at:'2020-01-01',reward_points:150},usage={lastAndroidSeen:'2026-11-12T03:00:00Z'};const morning=messageFor(customer,usage,{date:'2026-11-12',slot:'morning'},Date.parse('2026-11-12'));assert.equal(morning.group,'ready');assert(morning.body.includes('150'));assert.notEqual(morning.body,messageFor(customer,usage,{date:'2026-11-13',slot:'morning'},Date.parse('2026-11-13')).body);assert.notEqual(morning.body,messageFor(customer,usage,{date:'2026-11-12',slot:'evening'},Date.parse('2026-11-12')).body);
 const db=database(),customers=['a','b','c','d','e'].map((id,index)=>({id,name:'Demo '+id,phone:'91999999999'+index,created_at:'2020-01-01',reward_points:150,whatsapp_enabled:id!=='d'}));
 db.rows.set('ae_usage_users/'+hash('customer:a'),{platforms:{android:true},lastAndroidSeen:'2026-11-12T03:00:00Z'});db.rows.set('ae_usage_users/'+hash('customer:e'),{platforms:{android:true}});
 const targets={a:{push_token:'TOKEN_A',push_enabled:true},b:{push_token:'TOKEN_B',push_enabled:true},c:{},d:{},e:{push_token:'TOKEN_E',push_enabled:false}};
 const supabase={from(){return{select(){return this},order(){return this},limit(){return this},gt(){return this},then(resolve){return Promise.resolve({data:customers}).then(resolve)}}}};
 const pushes=[],whatsapp=[],deps={supabase,firestore:async()=>db,getTarget:async id=>targets[id],send:async(...args)=>{pushes.push(args);return true},sendUsage:async(...args)=>{whatsapp.push(args);return true},usageReady:async()=>true,now:()=>new Date('2026-11-12T04:30:00Z')};
 const initialSize=db.rows.size;await processPage({...deps,dryRun:true});assert.equal(db.rows.size,initialSize);assert.equal(pushes.length+whatsapp.length,0);
 const first=await processPage(deps);assert.equal(first.counts.pushAccepted,2);assert.equal(first.counts.whatsappAccepted,1);assert.equal(whatsapp[0][0],'c');assert(!JSON.stringify([...db.rows]).includes('TOKEN_A'));assert(!JSON.stringify([...db.rows]).includes('919999999992'));
 const second=await processPage(deps);assert.equal(second.counts.pushAccepted+second.counts.whatsappAccepted,0);assert.equal(pushes.length,2);assert.equal(whatsapp.length,1);
 await processPage({...deps,now:()=>new Date('2026-11-12T11:30:00Z')});assert.equal(pushes.length,4);assert.equal(whatsapp.length,1);
 await processPage({...deps,now:()=>new Date('2026-11-13T04:30:00Z')});assert.equal(whatsapp.length,2);
 db.rows.set('ae_usage_users/'+hash('customer:c'),{platforms:{android:true},lastAndroidSeen:'2026-11-13T05:00:00Z'});
 await processPage({...deps,now:()=>new Date('2026-11-14T04:30:00Z')});assert.equal(whatsapp.length,2);
 const before=await processPage({...deps,now:()=>new Date('2026-11-11T04:30:00Z')});assert.equal(before.notStarted,true);
 const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),key={...publicKey.export({format:'jwk'}),kid:'test-customer-reminder-key'};
 const claims={repository:'t06546666-maker/AE',repository_id:'1287086199',ref:'refs/heads/main',workflow_ref:'t06546666-maker/AE/.github/workflows/customer-daily-reminders.yml@refs/heads/main',event_name:'schedule'};
 const sign=value=>jwt.sign(value,privateKey,{algorithm:'RS256',keyid:key.kid,issuer:'https://token.actions.githubusercontent.com',audience:'ae-customer-daily-reminders',subject:'repo:t06546666-maker/AE:ref:refs/heads/main',expiresIn:'5m'}),fetcher=async()=>({ok:true,json:async()=>({keys:[key]})});
 await verifyScheduler(sign(claims),fetcher);await assert.rejects(verifyScheduler(sign({...claims,workflow_ref:'wrong-workflow'}),fetcher));await assert.rejects(verifyScheduler('invalid',fetcher));
 console.log('PASS: IST 10/17 windows, seven-day rotation, groups, opt-outs, daily WhatsApp until observed app use, no evening WhatsApp, duplicate prevention, dry-run isolation, private logs and scheduler identity; no real sends');
}
run().catch(e=>{console.error(e);process.exitCode=1});

