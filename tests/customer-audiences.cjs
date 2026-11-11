const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {audienceFor,registerCustomerAudiences}=require('../backend/customer-audiences.cjs');
async function run(){
 const now=Date.now(),iso=days=>new Date(now-days*86400000).toISOString();
 assert.equal(audienceFor(null,30,now),'unobserved');
 assert.equal(audienceFor({lastSeen:iso(0)},30,now),'unobserved'); // Web is not Android evidence.
 assert.equal(audienceFor({lastAndroidSeen:'invalid'},30,now),'unobserved');
 assert.equal(audienceFor({lastAndroidSeen:iso(30)},30,now),'active');
 assert.equal(audienceFor({lastAndroidSeen:iso(31)},30,now),'inactive');
 const customers=[{id:'a',name:'A',merchant_id:'shop',registration_source:'merchant'},{id:'b',name:'B',registration_source:'self'},{id:'c',name:'C'}];
 const hash=id=>crypto.createHash('sha256').update('customer:'+id).digest('hex');
 const store={collection(name){return{where(){return this},select(){return this},async get(){return{docs:(name==='ae_usage_users'?[{id:hash('a'),data:()=>({lastAndroidSeen:iso(1)})},{id:hash('b'),data:()=>({lastAndroidSeen:iso(45)})}]:[{id:'a',data:()=>({push_token:'SECRET_TOKEN',push_enabled:true})},{id:'b',data:()=>({push_token:'OFF_TOKEN',push_enabled:false})}])}}}}};
 const db={from(table){return{select(){return this},order(){return this},range:async()=>({data:customers}),in:async()=>({data:[{id:'shop',name:'Shop',merchant_code:'MER001'}]})}}};
 const auth=()=>{},adminRole=()=>{};let handler;
 registerCustomerAudiences({get(path,a,b,h){assert.equal(path,'/api/admin/customer-audiences');assert.equal(a,auth);assert.equal(b,adminRole);handler=h;}},{auth,adminRole,db,database:async()=>store});
 async function call(query){let code=200,payload;await handler({query},{set(){},status(c){code=c;return this},json(p){payload=p;return this}});return{code,payload};}
 const all=await call({});assert.equal(all.code,200);assert.equal(all.payload.total,3);assert.deepEqual(all.payload.summary,{all:3,active:1,inactive:1,unobserved:1,push_ready:1,push_unavailable:2});assert.equal(all.payload.records[0].onboardingMerchant.name,'Shop');assert.equal(JSON.stringify(all).includes('SECRET_TOKEN'),false);assert.equal(JSON.stringify(all).includes('OFF_TOKEN'),false);
 const inactive=await call({audience:'inactive'});assert.equal(inactive.payload.total,1);assert.equal(inactive.payload.records[0].id,'b');assert.equal(inactive.payload.records[0].pushReady,false);
 assert.equal((await call({audience:'unobserved'})).payload.records[0].id,'c');
 assert.equal((await call({audience:'push_ready'})).payload.total,1);
 assert.equal((await call({search:'B'})).payload.records[0].id,'b');
 assert.equal((await call({days:999})).code,400);assert.equal((await call({audience:'not_installed'})).code,400);assert.equal((await call({page:-1})).code,400);
 console.log('PASS: Android/web distinction, inactivity boundary, recipient groups, private token exclusion, shop attribution and filter validation');
}
run().catch(e=>{console.error(e);process.exitCode=1});

