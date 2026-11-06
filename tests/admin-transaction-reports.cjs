const assert = require('node:assert/strict');
const { registerAdminTransactionReports, summarize } = require('../backend/admin-transaction-reports.cjs');
function setup(pages, journals=[]) {
  let route; const calls=[]; const auth=()=>{}, role=()=>{};
  const db={from(table){const q={}; calls.push(['table',table]); for(const name of ['select','gte','lt','order','eq','in'])q[name]=(...args)=>{calls.push([name,...args]);return q;};q.range=(from,to)=>{calls.push(['range',from,to]);return q;};q.then=(resolve,reject)=>Promise.resolve((table === 'ae_points_requests' ? journals : pages).shift() || {data:[]}).then(resolve,reject);return q;}};
  let exported;
  registerAdminTransactionReports({get(...args){route=args;}},{auth,adminRole:role,db,excel:async(...args)=>{exported=args;}});
  assert.equal(route[0],'/api/admin/transaction-report'); assert.equal(route[1],auth);assert.equal(route[2],role);
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
  return {run:query=>route[3]({query:{from:'2026-11-01T00:00:00+05:30',to:'2026-12-01T00:00:00+05:30',...query}},res),res,calls,get exported(){return exported;}};
}
const row=(i)=>({id:String(i),created_at:'2026-11-06T06:00:00Z',transaction_amount:'100.10',points_redeemed:100,discount_amount:'5.05',customers:{name:'Customer',customer_code:'C1'},merchants:{name:'Shop',merchant_code:'M1',route_name:'North'}});
(async()=>{
  const all=Array.from({length:1000},(_,i)=>row(i));const x=setup([{data:all},{data:[row(1000)]}]);await x.run({page:'2',area:'North'});
  assert.equal(x.res.statusCode,200);assert.equal(x.res.body.pagination.total,1001);assert.equal(x.res.body.records.length,25);assert.equal(x.res.body.summary.points,100100);assert.equal(x.res.body.summary.discountAmount,5055.05);assert.equal(x.res.headers['Cache-Control'],'no-store');assert.ok(x.calls.some(c=>c[0]==='eq'&&c[1]==='merchants.route_name'&&c[2]==='North'));assert.ok(x.calls.some(c=>c[0]==='range'&&c[1]===1000));
  const search=setup([{data:[row(1),{...row(2),customers:{name:'Different',customer_code:'C2'}}]}]);await search.run({search:'C2'});assert.equal(search.res.body.summary.count,1);assert.equal(search.res.body.records[0].customer,'Different');
  for(const query of [{kind:'payments'},{page:'-1'},{from:'bad'},{to:'2028-01-01'},{format:'bad'}]){const bad=setup([]);await bad.run(query);assert.equal(bad.res.statusCode,400);assert.equal(bad.calls.length,0);}
  const fail=setup([{error:{message:'private backend details'}}]);await fail.run({});assert.equal(fail.res.statusCode,503);assert.ok(!JSON.stringify(fail.res.body).includes('private backend'));
  const empty=setup([{data:[]}]);await empty.run({});assert.equal(empty.res.body.summary.count,0);
  const ex=setup([{data:[row(1)]}]);await ex.run({format:'xlsx'});assert.equal(ex.exported[1].length,1);assert.equal(ex.exported[1][0]['Net bill (INR)'],95.05);
  const purchases=setup([{data:[{id:'p1',amount:250,reward_points:25,created_at:'2026-11-06T00:00:00Z'}]}]);await purchases.run({kind:'purchases'});assert.equal(purchases.res.body.summary.pointsKind,'issued');assert.equal(purchases.res.body.summary.points,25);assert.ok(purchases.calls.some(c=>c[0]==='table'&&c[1]==='orders'));
  assert.equal(summarize([{amount:null,discount:5,points:100}],'redemptions').netAmount,null);
  const discounts=[{...row('flat'),merchant_id:'m1',discount_percentage:5},{...row('pct'),merchant_id:'m1',discount_percentage:5},{...row('old'),merchant_id:'m1',discount_percentage:5},{...row('zero'),merchant_id:'m1',discount_amount:0}];
  const journal=[{merchant_id:'m1',parameters:{discountType:'flat',discountValue:50},result:{redemption:{id:'flat'}}},{merchant_id:'m1',parameters:{discountType:'percentage',discountValue:5},result:{redemption:{id:'pct'}}},{merchant_id:'wrong-shop',parameters:{discountType:'flat',discountValue:10},result:{redemption:{id:'old'}}}];
  const split=setup([{data:discounts}],[{data:journal}]);await split.run({discountType:'flat'});
  assert.deepEqual(split.res.body.summary.discountCounts,{total:3,flat:1,percentage:1,unknown:1});assert.equal(split.res.body.records.length,1);assert.equal(split.res.body.records[0].id,'flat');assert.equal(split.res.body.records[0].discountValue,50);
  const only=setup([{data:discounts}],[{data:journal}]);await only.run({discountsOnly:'1'});assert.equal(only.res.body.records.length,3);
  const legacy=setup([{data:discounts}],[{error:{code:'42P01'}}]);await legacy.run({discountType:'unknown'});assert.equal(legacy.res.body.records.length,3);assert.equal(legacy.res.body.summary.discountHistoryUnavailable,true);
  const journalError=setup([{data:discounts}],[{error:{code:'57014'}}]);await journalError.run({});assert.equal(journalError.res.statusCode,503);
  const invalidType=setup([]);await invalidType.run({discountType:'other'});assert.equal(invalidType.res.statusCode,400);
  const photo=setup([{data:[{...row('photo'),merchants:{name:'Shop',image_url:'https://example.com/shop.jpg'}}]}]);await photo.run({});assert.equal(photo.res.body.records[0].merchantPhoto,'https://example.com/shop.jpg');
  const countOnly=setup([{data:[row('a'),{...row('b'),discount_amount:0}]}]);await countOnly.run({summaryOnly:'1'});assert.equal(countOnly.res.body.discountCount,1);assert.ok(!countOnly.calls.some(c=>c[0]==='table'&&c[1]==='ae_points_requests'));
  console.log('PASS: admin middleware, complete pagination totals, decimal money, area/search, validation, exports, purchase/redemption distinction and database errors.');
})().catch(error=>{console.error(error);process.exitCode=1;});
