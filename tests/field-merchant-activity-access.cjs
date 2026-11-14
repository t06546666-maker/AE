const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
const begin=source.indexOf('async function canReadFieldMerchantActivity('),end=source.indexOf("app.get('/api/field/merchants/:id/business-details'",begin);
let exists=true,failed=false,queries=0;
const context={supabaseAdmin:{from(table){assert.equal(table,'active_merchants');queries++;return{select(column){assert.equal(column,'id');return this},eq(column,id){assert.equal(column,'id');assert.equal(id,'admin-created-shop');return this},async maybeSingle(){return {data:exists?{id:'admin-created-shop'}:null,error:failed?{message:'offline'}:null}}}}}};
vm.createContext(context);vm.runInContext(source.slice(begin,end),context);
(async()=>{
 const request=role=>({auth:{profile:{role,id:'field1'}}});
 assert.equal(await context.canReadFieldMerchantActivity(request('field_manager'),'admin-created-shop'),true);
 const before=queries;
 for(const role of ['customer','merchant','counter_staff'])assert.equal(await context.canReadFieldMerchantActivity(request(role),'admin-created-shop'),false);
 assert.equal(queries,before);
 exists=false;assert.equal(await context.canReadFieldMerchantActivity(request('field_manager'),'admin-created-shop'),false);
 failed=true;await assert.rejects(()=>context.canReadFieldMerchantActivity(request('field_manager'),'admin-created-shop'));
 const write=source.slice(source.indexOf("app.patch('/api/field/merchants/:id/settings'"),source.indexOf("app.get('/api/merchants/:id'"));
 assert.match(write,/field_manager_merchant_updates/);assert.match(write,/status',\s*'approved'/);
 console.log('PASS: field read access includes Admin-created active shops; other roles and missing shops denied; settings write restrictions retained');
})().catch(error=>{console.error(error);process.exitCode=1;});
