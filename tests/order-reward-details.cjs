const assert=require('node:assert/strict');
const {orderRewardDetails}=require('../backend/order-reward-details.cjs');
const orders=[{id:'percentage',merchant_id:'shop-a'},{id:'flat',merchant_id:'shop-a'},{id:'earn-only',merchant_id:'shop-a'},{id:'legacy',merchant_id:'shop-a'}];
const snapshot=(id,type,value,amount,redeem=100,merchant_id='shop-a')=>({merchant_id,parameters:{rate:10,redeem,discountType:type,discountValue:value},result:{purchase:{order_id:id},redemption:redeem?{id:'red-'+id}:null,discountAmount:amount}});
function database(rows,error=null){return {from(table){assert.equal(table,'ae_points_requests');return {select(){return this},in(field,ids){assert.equal(field,'result->purchase->>order_id');assert.deepEqual(ids,orders.map(o=>o.id));return this},async range(){return {data:rows,error}}}}};}
(async()=>{
 const result=await orderRewardDetails(database([snapshot('percentage','percentage',2,10),snapshot('flat','flat',5,5),snapshot('earn-only','percentage',2,0,0),snapshot('legacy','percentage',99,99,100,'other-shop')]),orders);
 assert.deepEqual(result.get('percentage'),{earningPointsPer100:10,discountType:'percentage',discountPercentage:2,discountAmount:10});
 assert.deepEqual(result.get('flat'),{earningPointsPer100:10,discountType:'flat',discountPercentage:null,discountAmount:5});
 assert.deepEqual(result.get('earn-only'),{earningPointsPer100:10,discountType:'none',discountPercentage:0,discountAmount:0});
 assert.equal(result.has('legacy'),false,'Do not guess historical rates or use another shop snapshot');
 assert.equal((await orderRewardDetails(database([],{code:'PGRST205'}),orders)).size,0);
 await assert.rejects(()=>orderRewardDetails(database([],{code:'network'}),orders),/unavailable/);
 const conflict=await orderRewardDetails(database([snapshot('percentage','percentage',2,10),snapshot('percentage','percentage',3,15)]),orders);
 assert.equal(conflict.get('percentage').discountAmount,null);
 console.log('PASS saved rate, percentage/flat discounts, earning-only, legacy unknown, shop isolation, failures and conflicts');
})().catch(e=>{console.error(e);process.exitCode=1});
