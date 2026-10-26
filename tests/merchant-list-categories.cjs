const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('server.js','utf8');const start=source.indexOf("app.get('/api/merchants',");const route=source.slice(start,source.indexOf("app.get('/api/merchants/:id/summary'",start));
let handler;const calls=[];
const rows=[{id:'a',name:'Beauty shop',category_id:'beauty',merchant_categories:{name:'Beauty & Salon'}},{id:'b',name:'No category',category_id:null,merchant_categories:null}];
const db={from(table){const q={select(fields){calls.push([table,'select',fields]);return q},order(){return q},eq(...args){calls.push([table,'eq',...args]);return q},or(){return q},range(...args){calls.push([table,'range',...args]);return q},in(){return q},limit(){return q},then(resolve,reject){return Promise.resolve({data:table==='merchants'?rows:table==='orders'?[{merchant_id:'a'}]:[{merchant_id:'a',must_change_password:true}],count:2}).then(resolve,reject)}};return q}};
vm.runInNewContext(route,{app:{get(path,...handlers){handler=handlers.at(-1)}},requireAuth(){},paginationFromRequest:()=>({enabled:true,from:0,to:19,search:''}),paginationMeta:(_,count)=>({total:count}),supabaseAdmin:db});
(async()=>{
 let output;const res={json(body){output=body},status(){return this}};
 await handler({query:{},auth:{profile:{role:'admin'}}},res);
 assert.equal(output.merchants[0].category,'Beauty & Salon');assert.equal(output.merchants[0].categoryId,'beauty');assert.equal(output.merchants[1].category,undefined);assert.equal(output.merchants[0].orderCount,1);assert.equal(output.merchants[0].mustChangePassword,true);assert.equal(output.pagination.total,2);
 assert.ok(calls.some(c=>c[0]==='merchants'&&c[1]==='select'&&c[2].includes('merchant_categories(name)')));
 calls.length=0;await handler({query:{},auth:{profile:{role:'merchant',merchant_id:'a'}}},res);assert.ok(calls.some(c=>c[0]==='merchants'&&c[1]==='eq'&&c[2]==='id'&&c[3]==='a'));
 console.log('PASS: saved category name/id included, no category remains unset, order/password/pagination behavior preserved, merchant scoping unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1});
