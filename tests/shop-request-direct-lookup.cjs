const assert = require('node:assert/strict');
const {registerShopRequests} = require('../backend/shop-checkout-requests.cjs');

async function main() {
  const routes = new Map();
  const app = {get(path,...handlers){routes.set(path,handlers.at(-1));},post(){}};
  let reads=0;
  let row={merchantId:'shop-a',customerId:'private-customer',status:'pending',expiresAt:Date.now()+60000};
  registerShopRequests(app,{
    database:async()=>({collection:()=>({doc:id=>({get:async()=>{reads++;return {id,exists:!!row,data:()=>row};}})})}),
    auth(){},merchantRole(){},customerAuth(){},
  });
  const handler=routes.get('/api/merchant/shop-requests');
  async function request(id,merchantId='shop-a') {
    const res={statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
    await handler({query:{requestId:id},auth:{profile:{merchant_id:merchantId}}},res);
    return res;
  }
  const id='abcdefghijklmnopqrst';
  let res=await request(id);
  assert.equal(res.body.requests[0].id,id);
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal('customerId' in res.body.requests[0],false);
  assert.equal(reads,1,'Selected checkout must use one document read, not a collection scan');
  assert.equal((await request(id,'shop-b')).statusCode,404);
  const before=reads;
  assert.equal((await request('bad')).statusCode,400);
  assert.equal(reads,before);
  for(const status of ['completed','processing','needs_review']) {
    row={...row,status};
    assert.deepEqual((await request(id)).body.requests,[]);
  }
  row={...row,status:'pending',expiresAt:Date.now()-1};
  assert.deepEqual((await request(id)).body.requests,[]);
  row=null;
  assert.equal((await request(id)).statusCode,404);
  console.log('PASS: direct checkout lookup, ownership, privacy, expiry and handled-request guards');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
