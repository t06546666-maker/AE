const assert=require('node:assert/strict');
const {validateProspect,registerShopProspects}=require('../backend/shop-prospects.cjs');
const valid={name:'Test shop',address:'Test address',category:'Grocery',status:'interested',latitude:10.7,longitude:76.75,notes:'Follow up next week',follow_up_date:'2026-11-20'};
assert.equal(validateProspect(valid).status,'interested');
for(const patch of [{name:''},{address:''},{status:'bad'},{latitude:''},{latitude:91},{longitude:181},{follow_up_date:'2026-02-30'}])assert.throws(()=>validateProspect({...valid,...patch}));
const routes={};let reads=0,writes=0;
const records=[{id:'a',manager_id:'m1',manager_name:'First manager',created_at:'2026-11-12T20:00:00Z',updated_at:'2026-11-12T20:00:00Z',...valid},{id:'b',manager_id:'m2',manager_name:'Second manager',created_at:'2026-11-12T17:00:00Z',updated_at:'2026-11-12T17:00:00Z',...valid}];
let historyReads=0;
const database={
 collection(){
  let manager;
  const query={
   where(key,op,value){manager=value;return query;},
   async get(){reads++;return{docs:records.filter(row=>!manager||row.manager_id===manager).map(row=>({id:row.id,data:()=>row}))};},
   doc(id){return{
    id:id||'new',
    get:async()=>({exists:true,data:()=>records.find(row=>row.id===id)}),
    collection(){return{doc(){return{id:'event'};},orderBy(){historyReads++;throw Error('Unexpected history read');}};}
   };}
  };
  return query;
 },
 batch(){return{set(){writes++;},async commit(){}};},
 runTransaction:async fn=>fn({get:async()=>({exists:true,data:()=>records[0]}),set(){writes++;}})
};
registerShopProspects({get:(path,...handlers)=>routes['GET '+path]=handlers,post:(path,...handlers)=>routes['POST '+path]=handlers,put:(path,...handlers)=>routes['PUT '+path]=handlers},{auth(){},database:async()=>database});
function response(){return{code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
function request(role='field_manager',id='m1'){return{auth:{profile:{role,id,full_name:'Manager'}},query:{},params:{id:'a'},body:valid};}
(async()=>{
 const list=routes['GET /api/shop-visit-tracking'].at(-1);
 let req=request(),res=response();req.query.managerId='m2';await list(req,res);assert.equal(res.body.visits.length,1);assert.equal(res.body.visits[0].manager_id,'m1');
 req=request('admin');req.query.from='2026-11-13';req.query.to='2026-11-13';res=response();await list(req,res);assert.equal(res.body.visits.length,1);assert.equal(res.body.visits[0].id,'a','Date filter must use IST midnight');
 req=request();req.params.id='b';res=response();await routes['GET /api/shop-visit-tracking/:id/history'].at(-1)(req,res);assert.equal(res.code,403);
 req=request('admin');res=response();await routes['POST /api/shop-visit-tracking'].at(-1)(req,res);assert.equal(res.code,403);
 req=request();req.body={...valid,latitude:''};res=response();await routes['POST /api/shop-visit-tracking'].at(-1)(req,res);assert.equal(res.code,400);
 req=request('field_manager','m2');res=response();await routes['PUT /api/shop-visit-tracking/:id'].at(-1)(req,res);assert.equal(res.code,403);
 req=request();req.body={...valid,updated_at:'old'};res=response();await routes['PUT /api/shop-visit-tracking/:id'].at(-1)(req,res);assert.equal(res.code,409);assert.equal(writes,0);assert.equal(historyReads,0);
 req=request();req.body={...valid,manager_id:'m2',created_at:'fake'};res=response();await routes['POST /api/shop-visit-tracking'].at(-1)(req,res);assert.equal(res.code,201);assert.equal(res.body.visit.manager_id,'m1');assert.notEqual(res.body.visit.created_at,'fake');assert.equal(writes,2,'Visit and audit history are written together');
 console.log('PASS: validation, ownership, spoofed filters, private history, stale-edit prevention and IST date filtering');
})().catch(error=>{console.error(error);process.exitCode=1;});
