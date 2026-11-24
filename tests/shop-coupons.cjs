const assert=require('node:assert/strict');
const {registerShopCoupons}=require('../backend/shop-coupons.cjs');
const routes={},records=new Map(),pass=(req,res,next)=>next();
const db={collection:name=>({doc:id=>({key:name+'/'+id})}),runTransaction:async fn=>fn({get:async ref=>({exists:records.has(ref.key),data:()=>records.get(ref.key)}),update:(ref,value)=>records.set(ref.key,{...records.get(ref.key),...value})})};
registerShopCoupons({get(){},put(){},post(path,...handlers){routes[path]=handlers.at(-1);}},{auth:pass,customerAuth:pass,adminRole:pass,merchantRole:pass,database:async()=>db,supabase:{}});
const code='a'.repeat(32);records.set('ae_coupon_codes/'+code,{customerId:'customer'});records.set('ae_shop_coupons/customer',{merchantId:'shop',status:'available',value:100});
async function redeem(shop,bill){let status=200,body;const res={set(){},status(s){status=s;return this;},json(value){body=value;}};await routes['/api/merchant/shop-coupons/redeem']({body:{code,billAmount:bill},auth:{profile:{merchant_id:shop,id:'merchant'}}},res);return {status,body};}
(async()=>{assert.equal((await redeem('other',150)).status,400);assert.equal(records.get('ae_shop_coupons/customer').status,'available');assert.equal((await redeem('shop',99)).status,400);const success=await redeem('shop',150);assert.equal(success.body.discount,100);assert.equal(success.body.amountPayable,50);assert.equal((await redeem('shop',150)).status,400);console.log('PASS coupon wrong-shop, minimum bill, fixed discount and duplicate redemption');})().catch(e=>{console.error(e);process.exitCode=1;});
