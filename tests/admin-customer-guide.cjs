const assert=require('node:assert/strict');
const {registerCustomerGuide}=require('../backend/admin-customer-guide.cjs');
async function run(){
 let handler,sends=0,optOut=false,duplicate=false;let saved;
 const auth=()=>{},admin=()=>{};
 const db={from(table){return {select(){return this},eq(){return this},async maybeSingle(){return {data:table==='customers'?{id:'customer',phone:'919999999999',whatsapp_enabled:!optOut}:saved}},async insert(row){if(duplicate)return {error:{code:'23505'}};saved=row;return {}},update(){return this},then(resolve){resolve({})}}}};
 registerCustomerGuide({get(){},post(route,...args){assert.equal(route,'/api/admin/customers/:id/usage-message');assert.equal(args[0],auth);assert.equal(args[1],admin);handler=args[2]}},{auth,adminRole:admin,db,normalizePhone:p=>p,sendTemplate:async args=>{sends++;assert.equal(args.templateName,'ae_use');assert.equal(args.languageCode,'en');assert.equal(args.recipient,'919999999999');assert.equal(args.logId,'12345678-1234-4123-8123-123456789abc');assert.equal(args.components[0].parameters.length,2);saved.status='sent';return {sent:true}},appLink:'app',instagramLink:'instagram',usageTemplate:'ae_use'});
 const call=async body=>{let code=200,payload;await handler({params:{id:'customer'},body},{status(c){code=c;return this},json(p){payload=p;return this}});return {code,payload}};
 assert.equal((await call({})).code,400);assert.equal(sends,0);
 optOut=true;assert.equal((await call({requestId:'12345678-1234-4123-8123-123456789abc'})).code,409);assert.equal(sends,0);optOut=false;
 assert.equal((await call({requestId:'12345678-1234-4123-8123-123456789abc',phone:'attacker'})).payload.accepted,true);assert.equal(sends,1);
 duplicate=true;assert.equal((await call({requestId:'12345678-1234-4123-8123-123456789abc'})).payload.accepted,true);assert.equal(sends,1);
 saved.status='queued';assert.equal((await call({requestId:'12345678-1234-4123-8123-123456789abc'})).code,409);assert.equal(sends,1);
 console.log('PASS: admin protection, recipient isolation, opt-out, template parameters and duplicate/pending requests');
}run().catch(error=>{console.error(error);process.exitCode=1});


