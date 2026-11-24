const assert=require('node:assert/strict');
const {registerDeletedMerchants}=require('../backend/deleted-merchants.cjs');
const routes={},auth=()=>{},admin=()=>{};let rpcCalls=0,rpcError=null,queryError=null;
const query={select(){return this},not(...args){assert.deepEqual(args,['deleted_at','is',null]);return this},ilike(){return this},order(){return this},range(){return Promise.resolve({data:[{id:'shop',name:'Saved shop'}],count:1,error:queryError})}};
registerDeletedMerchants({get(path,...handlers){assert.equal(handlers[0],auth);assert.equal(handlers[1],admin);routes.get=handlers.at(-1)},post(path,...handlers){assert.equal(handlers[0],auth);assert.equal(handlers[1],admin);routes.post=handlers.at(-1)}},{auth,adminRole:admin,db:{from(table){assert.equal(table,'merchants');return query},async rpc(name,args){assert.equal(name,'admin_archive_merchant');assert.equal(args.p_admin,'authenticated-admin');rpcCalls++;return {error:rpcError}}}});
const response=()=>({code:200,status(code){this.code=code;return this},json(body){this.body=body;return this}});
(async()=>{
 let r=response();await routes.get({query:{}},r);assert.equal(r.body.merchants[0].name,'Saved shop');assert.equal(r.body.pagination.total,1);
 queryError=Error('offline');r=response();await routes.get({query:{}},r);assert.equal(r.code,503);
 const req={params:{id:'11111111-1111-4111-8111-111111111111'},body:{},auth:{profile:{id:'authenticated-admin'}}};
 r=response();await routes.post(req,r);assert.equal(r.code,400);assert.equal(rpcCalls,0);
 req.body.confirmation='DELETE';r=response();await routes.post(req,r);assert.equal(r.body.archived,true);
 rpcError={code:'P0002'};r=response();await routes.post(req,r);assert.equal(r.code,404);
 const sql=require('node:fs').readFileSync('supabase-merchant-archive.sql','utf8');
 assert.doesNotMatch(sql,/delete\s+from/i);assert.match(sql,/for update/);assert.match(sql,/role='admin'/);assert.match(sql,/from public,anon,authenticated/);
 console.log('PASS: admin-only archived list, confirmed removal, preserved records, safe failures and atomic SQL');
})().catch(error=>{console.error(error);process.exitCode=1});
