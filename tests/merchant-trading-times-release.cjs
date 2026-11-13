const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
const start=source.indexOf('function validateTradingTimes('),end=source.indexOf("app.get('/api/merchant-trading-times",start);
let linked=false;
const context={supabaseAdmin:{from(){return{select(){return this},eq(){return this},limit:async()=>({data:linked?[{id:'approved-link'}]:[],error:null})}}}};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
(async()=>{
 assert.equal(context.validateTradingTimes({peak_hours:[{start:'12:00',end:'14:00'},{start:'18:00',end:'21:00'}],low_hours:[{start:'23:00',end:'02:00'}]}).peak_hours.length,2);
 for(const body of [{peak_hours:[{start:'25:00',end:'02:00'}]},{low_hours:[{start:'12:00',end:'12:00'}]},{peak_hours:'bad'}])assert.throws(()=>context.validateTradingTimes(body));
 assert.equal(await context.canReadTradingTimes({auth:{profile:{role:'merchant',merchant_id:'shop1'}}},'shop2'),false);
 assert.equal(await context.canReadTradingTimes({auth:{profile:{role:'customer'}}},'shop1'),false);
 assert.equal(await context.canReadTradingTimes({auth:{profile:{role:'field_manager',id:'field1'}}},'shop1'),false);
 linked=true;assert.equal(await context.canReadTradingTimes({auth:{profile:{role:'field_manager',id:'field1'}}},'shop1'),true);
 assert.equal(await context.canReadTradingTimes({auth:{profile:{role:'admin'}}},'shop1'),true);
 console.log('PASS: multiple/overnight ranges; invalid ranges rejected; assigned-shop and role access enforced');
})().catch(error=>{console.error(error);process.exitCode=1;});
